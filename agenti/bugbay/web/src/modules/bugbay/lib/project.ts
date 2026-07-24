/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Contesto del progetto corrente per il hub multi-progetto: un DB centrale può
 * raccogliere le segnalazioni di TUTTE le tue app, ciascuna taggata col proprio
 * `project_id`. L'identità arriva dall'env impostato da `bugbay dev`
 * (BUGBAY_PROJECT_ID / BUGBAY_PROJECT_NAME). Quando l'id manca (setup legacy) il
 * modulo degrada al comportamento mono-progetto: niente stamp, niente filtro.
 *
 * @indice
 * - projectId / projectContext   → id/nome del progetto corrente (o null)
 * - ensureProjectRegistered      → una volta per processo: upsert in `projects` + back-fill legacy locale
 */

import { createAdminClient } from './supabase-admin';

/** project_id corrente (o null): da stampare in scrittura e filtrare in lettura. */
export function projectId(): string | null {
  return process.env.BUGBAY_PROJECT_ID || null;
}

/**
 * true se il daemon governa PIÙ repo locali (modalità hub, `bugbay dev --hub`).
 * In hub le letture non filtrano per project_id (un operatore vede/fixa tutte le
 * app registrate); fuori dall'hub ogni daemon resta confinato al proprio progetto.
 */
export function isHub(): boolean {
  return process.env.BUGBAY_HUB === '1';
}

/** project_id da usare come filtro nelle query: null in hub (nessun filtro), altrimenti il proprio. */
export function scopeFilter(): string | null {
  return isHub() ? null : projectId();
}

/** { id, name } del progetto corrente, o null se non impostato (setup legacy). */
export function projectContext(): { id: string; name: string } | null {
  const id = process.env.BUGBAY_PROJECT_ID;
  if (!id) return null;
  return { id, name: process.env.BUGBAY_PROJECT_NAME || 'progetto' };
}

const SEP = '::';

/**
 * Namespacing per progetto degli id a chiave STABILE (slug della checklist, id
 * delle note `__general`/`__refresh_meta`…). A differenza dei report (uuid), questi
 * id sono slug deterministici condivisi tra progetti: senza namespace, nel DB
 * centrale la stessa chiave collide (stessa PK) e un progetto sovrascrive l'altro.
 * `<project_id>::<id>` li rende unici per progetto. Senza project_id (legacy) è no-op.
 */
export function scopeId(id: string): string {
  const pid = projectId();
  return pid ? `${pid}${SEP}${id}` : id;
}

/** Inverso di scopeId: rimuove il prefisso del progetto corrente, se presente. */
export function unscopeId(id: string): string {
  const pid = projectId();
  const pref = pid ? `${pid}${SEP}` : '';
  return pref && id.startsWith(pref) ? id.slice(pref.length) : id;
}

/** True se `id` appartiene al progetto corrente (o se non c'è progetto: legacy). */
export function belongsToProject(id: string): boolean {
  const pid = projectId();
  return !pid || id.startsWith(`${pid}${SEP}`);
}

/** True se il backend dati attivo è quello LOCALE (stessa logica di createAdminClient). */
export function isLocalBackend(): boolean {
  return (
    process.env.BUGBAY_LOCAL_DB === '1' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let _ensured = false;
/**
 * Una volta per processo: registra il progetto in `projects` (upsert col nome e
 * l'ultimo accesso) e, sul DB LOCALE (un DB locale = un solo progetto), rivendica
 * le righe legacy prive di project_id taggandole col progetto corrente — così il
 * filtro per project_id non nasconde le segnalazioni create prima di F2. Sul
 * backend Supabase NON si fa back-fill (righe altrui potrebbero non avere il tag).
 * `_ensured` diventa true SOLO dopo un successo: i client (locale e supabase-js)
 * ritornano l'errore nel risultato senza lanciarlo, quindi un fallimento viene
 * rilevato controllando `.error` e la registrazione viene ritentata al prossimo giro.
 */
export async function ensureProjectRegistered(): Promise<void> {
  const ctx = projectContext();
  if (!ctx || _ensured) return;
  try {
    const supabase = createAdminClient() as unknown as {
      from: (t: string) => {
        upsert: (r: Record<string, unknown>) => Promise<{ error: unknown }>;
        update: (r: Record<string, unknown>) => { is: (c: string, v: unknown) => Promise<{ error: unknown }> };
      };
    };
    const up = await supabase.from('projects').upsert({
      id: ctx.id,
      name: ctx.name,
      repo_path: process.env.BUGBAY_TARGET_ROOT || null,
      last_seen_at: new Date().toISOString(),
    });
    if (up?.error) return; // fallito: non segnare _ensured → ritenta
    // Back-fill SOLO in locale: un DB locale appartiene a un unico progetto, quindi
    // ogni riga senza tag è sua. Su Supabase (multi-progetto) sarebbe scorretto.
    if (isLocalBackend()) {
      const bf = await supabase.from('debug_reports').update({ project_id: ctx.id }).is('project_id', null);
      if (bf?.error) return; // back-fill fallito → ritenta al prossimo giro
    }
    _ensured = true; // solo ora: registrazione + back-fill riusciti
  } catch (e) {
    console.error('[bugbay] ensureProjectRegistered:', e);
  }
}
