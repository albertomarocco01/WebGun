/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Contesto condiviso delle run agentiche: lettura delle segnalazioni da
 * Supabase, risoluzione di provider/chiavi da settings+env (mai dalle run),
 * sincronizzazione dello stato pipeline sulle segnalazioni e helper comuni
 * (file→area, parsing JSON, file toccati dalla run).
 *
 * @indice
 * - RUNNING_PHASES            → fasi con un processo in esecuzione
 * - RawReport / fetchReport   → segnalazione dal DB
 * - resolveKeys               → provider e API key da settings/env
 * - runReports / setReportsStatus → segnalazioni della run e sync stato
 * - reopenReports             → riapre le segnalazioni non già chiuse a mano
 * - fileToArea / extractJson / runTouchedFiles → helper
 */

import type { AgentRun, RunReport } from './types';
import { getSettings, getAllRuns } from './store';
import * as git from './git';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { projectId, ensureProjectRegistered } from '@/modules/bugbay/lib/project';

export const RUNNING_PHASES = ['interpreting', 'fixing', 'verifying'];

/**
 * File "occupati" da altre run: quelle IN ESECUZIONE (sui file in scope) e quelle
 * in REVIEW non committate (sui file già modificati, che restano nel working tree).
 * UNICA fonte di verità per il dispatcher (runner) e per doFix (esecuzione): se le
 * due divergono nasce un busy-loop infinito — il dispatcher avvia una run che doFix
 * poi rifiuta per conflitto, all'infinito. `exceptRunId` esclude la run che valuta sé stessa.
 */
export function lockedFiles(exceptRunId?: string): Set<string> {
  const set = new Set<string>();
  for (const r of getAllRuns()) {
    if (r.runId === exceptRunId) continue;
    if (RUNNING_PHASES.includes(r.phase)) for (const f of r.scopedFiles) set.add(f);
    else if (r.phase === 'review' && !r.committed) for (const m of r.modifiche) set.add(m.path);
  }
  return set;
}

export interface RawReport {
  id: string; projectId?: string | null; notes: string; area?: string; subArea?: string; url?: string | null;
  category?: string; priority?: string; status?: string; resolutionNotes?: string;
  resolvedAt?: string | null;
}

export async function fetchReport(id: string): Promise<RawReport | null> {
  try {
    const supabase = createAdminClient() as any;
    const { data, error } = await supabase.from('debug_reports').select('*').eq('id', id).single();
    if (!error && data) {
      return {
        id: data.id, projectId: data.project_id ?? null, notes: data.notes, area: data.area, subArea: data.sub_area,
        url: data.url, category: data.category, priority: data.priority,
        status: data.status, resolutionNotes: data.resolution_notes, resolvedAt: data.resolved_at,
      };
    }
  } catch (err) {
    console.error('Error fetching report from Supabase:', err);
  }
  return null;
}

/** Chiavi e provider risolti da settings + env. Mai letti dalla run (P18). */
export function resolveKeys(): { provider: string; gemini?: string; deepseek?: string; anthropic?: string } {
  const s = getSettings();
  return {
    provider: s.provider,
    gemini: s.geminiApiKey || process.env.GEMINI_API_KEY,
    deepseek: s.deepseekApiKey || process.env.DEEPSEEK_API_KEY,
    // NB: variabile dedicata — NON process.env.ANTHROPIC_API_KEY, che quando il
    // dev server è avviato da una sessione Claude Code contiene una chiave di
    // sessione non valida per la Messages API.
    anthropic: s.anthropicApiKey || process.env.CONSOLE_ANTHROPIC_API_KEY,
  };
}

/** Le segnalazioni di una run (1 per le run singole, N per le batch). */
export function runReports(run: AgentRun): RunReport[] {
  return run.reports?.length
    ? run.reports
    : [{ reportId: run.reportId, titolo: run.reportTitolo, url: run.reportUrl }];
}

/**
 * Sincronizza lo stato della pipeline su TUTTE le segnalazioni della run
 * (Aperto → In Lavorazione → In Chiarimento → In Verifica → Risolto).
 */
export async function setReportsStatus(run: AgentRun, status: string, extra?: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createAdminClient() as any;
    for (const rep of runReports(run)) {
      await supabase.from('debug_reports').update({ status, ...(extra ?? {}) }).eq('id', rep.reportId);
    }
  } catch (err) {
    console.error('Error syncing report status:', err);
  }
}

/** Come setReportsStatus ma per uno specifico elenco di reportId (accept parziale dei batch). */
export async function setReportsStatusByIds(ids: string[], status: string, extra?: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createAdminClient() as any;
    for (const id of ids) {
      await supabase.from('debug_reports').update({ status, ...(extra ?? {}) }).eq('id', id);
    }
  } catch (err) {
    console.error('Error syncing report status by ids:', err);
  }
}

/**
 * Riporta in 'Aperto' le segnalazioni della run abortita/scartata, MA solo
 * quelle non già chiuse: una segnalazione marcata 'Risolto' a mano non deve
 * essere riaperta dall'eliminazione di una run vecchia o fallita.
 */
export async function reopenReports(run: AgentRun): Promise<void> {
  try {
    const supabase = createAdminClient() as any;
    for (const rep of runReports(run)) {
      await supabase
        .from('debug_reports')
        .update({ status: 'Aperto' })
        .eq('id', rep.reportId)
        .neq('status', 'Risolto');
    }
  } catch (err) {
    console.error('Error reopening reports:', err);
  }
}

/**
 * Riallinea lo stato: riapre (→ 'Aperto') le segnalazioni rimaste 'In Lavorazione'
 * o 'In Chiarimento' che NON hanno PIÙ alcuna run nello store (es. file run perso
 * a un restart). Difende l'invariante "segnalazione in lavorazione ⇒ run visibile":
 * senza una run viva, la segnalazione non deve restare bloccata in lavorazione.
 */
export async function reconcileOrphanedReports(): Promise<void> {
  try {
    // Prima del riallineamento: registra il progetto e (in locale) back-fillа i
    // report legacy senza project_id, altrimenti il filtro .eq('project_id') sotto
    // non li vedrebbe e resterebbero bloccati "in lavorazione".
    await ensureProjectRegistered();
    const referenced = new Set<string>();
    for (const r of getAllRuns()) {
      for (const rep of runReports(r)) referenced.add(rep.reportId);
    }
    const supabase = createAdminClient() as any;
    // Scope al progetto: nel hub multi-progetto non dobbiamo riaprire le
    // segnalazioni "in lavorazione" di ALTRI progetti (che questo daemon non
    // referenzia con le sue run, ma sono comunque attive altrove).
    const pid = projectId();
    let q = supabase.from('debug_reports').select('id, status').in('status', ['In Lavorazione', 'In Chiarimento']);
    if (pid) q = q.eq('project_id', pid);
    const { data } = await q;
    for (const row of (data ?? []) as { id: string }[]) {
      if (!referenced.has(row.id)) {
        let upd = supabase.from('debug_reports').update({ status: 'Aperto' }).eq('id', row.id);
        if (pid) upd = upd.eq('project_id', pid);
        await upd;
      }
    }
  } catch (err) {
    console.error('Error reconciling orphaned reports:', err);
  }
}

/** Dal path di una pagina/route deriva la rotta navigabile, se esiste. */
export function fileToArea(rel: string): string | undefined {
  const m = rel.match(/^src\/app\/(.*)\/(page|route)\.(tsx?|jsx?)$/);
  if (!m) return undefined;
  const seg = m[1].split('/').filter((s) => !/^\(.*\)$/.test(s));
  return '/' + seg.join('/');
}

/** Estrae il primo oggetto JSON da un testo LLM (dal primo { all'ultimo }). */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/** File toccati DALLA run (sporchi ora, non sporchi prima del fix). */
export function runTouchedFiles(run: AgentRun): string[] {
  // Senza snapshot preDirty il fix non è mai partito: la run non ha scritto
  // nulla, e ripristinare i file in scope toccherebbe il lavoro dell'utente.
  if (!run.preDirty) return [];
  const pre = new Set(run.preDirty);
  return git.changedFiles().filter((f) => !pre.has(f) && run.scopedFiles.includes(f));
}
