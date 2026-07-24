/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CORE PURO del consolidamento memoria (v0.9, TRACK C) — la logica DECISIONALE,
 * senza alcuna dipendenza da DB/fs/git. Estratto da `consolidation.ts` così è
 * IMPORTABILE dal runner nativo `node:test` (come i `vendor/*` import-free): il
 * grafo DB-backed di `consolidation.ts` resta fuori dal runner, questa parte è
 * unit-testata. Tutte le funzioni sono PURE e deterministiche.
 *
 * @indice
 * - ConsolidationOptions / DEFAULTS → soglie del trigger e cap per progetto
 * - TriggerReason / ConsolidationState → motivo dello scatto e stato differenziale
 * - BulletLike / EpisodicPlanRow       → proiezioni minime su cui il piano opera
 * - decideTrigger     → scatta o no dato lo stato + il conteggio verdetti
 * - bulletDedupPlan   → id dei bullet da rimuovere (dedup contenuto + cap/progetto)
 * - episodicDedupPlan → id dei casi episodici da rimuovere (stessa logica)
 */

export interface ConsolidationOptions {
  /** Nuovi verdetti dall'ultima consolidazione che fanno scattare il trigger. */
  verdictThreshold?: number;
  /** Intervallo del trigger periodico (ms): scatta se scaduto E c'è ≥1 nuovo verdetto. */
  periodicMs?: number;
  /** Tetto di bullet ACE per progetto (dopo il dedup, i più vecchi in eccesso sono potati). */
  maxBulletsPerProject?: number;
  /** Tetto di casi episodici per progetto (dopo il dedup, i più vecchi in eccesso sono potati). */
  maxCasesPerProject?: number;
  /** Soglia di Jaccard per il dedup NEAR-duplicate (fix concilio F9): oltre questa, due
   *  testi quasi-identici (parafrasi minima) sono unificati tenendo il più recente. Alta
   *  di proposito: unifica i near-dup, NON gli archetipi (quello è il motore F4). */
  nearDupThreshold?: number;
}

export const DEFAULTS: Required<ConsolidationOptions> = {
  verdictThreshold: 25,
  periodicMs: 24 * 60 * 60 * 1000,
  maxBulletsPerProject: 200,
  maxCasesPerProject: 500,
  nearDupThreshold: 0.85,
};

export type TriggerReason = 'initial' | 'verdict-count' | 'periodic' | 'manual' | 'none';

/** Stato dell'ultima consolidazione (dal log): base del trigger differenziale. */
export interface ConsolidationState {
  verdictsAt: number;
  ranAtMs: number;
}

/** Proiezione minima di un bullet ACE su cui il piano di dedup opera (sottotipo strutturale). */
export interface BulletLike {
  id: string;
  project: string;
  outcome: 'positive' | 'negative';
  insight: string;
  /** ISO. */
  created: string;
}

/** Proiezione minima di un caso episodico su cui il piano di dedup opera. */
export interface EpisodicPlanRow {
  id: string;
  project_id: string | null;
  reformulated: string;
  verdict: string;
  outcome: string | null;
  created_at: string;
}

/** Normalizza un testo per il confronto di duplicati: trim + whitespace collassato + lowercase. */
function normText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** ISO desc con tie-break stabile sull'id (determinismo: stessa scelta a ogni run). */
function newerFirst(a: { created: string; id: string }, b: { created: string; id: string }): number {
  if (a.created !== b.created) return a.created < b.created ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// ── Near-dup Jaccard (F9) ─────────────────────────────────────────────────────
// Tokenizzazione + Jaccard INLINE (non importate da archetype-core: quel modulo
// sarebbe un import relativo extension-less che il runner nativo `node:test` non
// risolve — il vincolo leaf). ~10 righe duplicate, prezzo per restare unit-testabile.

/** Token alfanumerici unicode (len>2), lowercase, per il confronto near-dup. */
function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) if (t.length > 2) out.add(t);
  return out;
}

/** Jaccard |A∩B|/|A∪B|; set vuoti → 0. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * PURA. Id da rimuovere per NEAR-duplicazione entro ogni gruppo: due item con Jaccard
 * dei token ≥ soglia sono quasi-identici → si tiene il PIÙ RECENTE, si rimuove l'altro.
 * Deterministica: ordina newest-first (tie-break id) così la scelta è stabile.
 * ponytail: O(n²) entro il gruppo (progetto) — ok alla scala locale; se un progetto
 * accumulasse decine di migliaia di casi, qui il punto di upgrade (blocking/LSH).
 */
function nearDupRemovals(
  items: { id: string; group: string; text: string; created: string }[],
  threshold: number,
): Set<string> {
  const remove = new Set<string>();
  const byGroup = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byGroup.get(it.group);
    if (arr) arr.push(it); else byGroup.set(it.group, [it]);
  }
  for (const arr of byGroup.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort(newerFirst); // newest first
    const toks = sorted.map((it) => tokenize(it.text));
    for (let i = 0; i < sorted.length; i++) {
      if (remove.has(sorted[i].id)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (remove.has(sorted[j].id)) continue;
        if (jaccard(toks[i], toks[j]) >= threshold) remove.add(sorted[j].id); // j è il più vecchio
      }
    }
  }
  return remove;
}

/**
 * PURA. Decide se il trigger scatta. Prima volta (nessuno stato): scatta al
 * raggiungimento della soglia di verdetti. Poi: soglia differenziale di nuovi
 * verdetti, oppure periodico MA solo con ≥1 nuovo verdetto (niente churn a vuoto).
 */
export function decideTrigger(
  state: ConsolidationState | null,
  verdictCount: number,
  nowMs: number,
  options?: ConsolidationOptions,
): { run: boolean; reason: TriggerReason } {
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  if (!state) {
    return verdictCount >= opts.verdictThreshold
      ? { run: true, reason: 'initial' }
      : { run: false, reason: 'none' };
  }
  const delta = verdictCount - state.verdictsAt;
  if (delta >= opts.verdictThreshold) return { run: true, reason: 'verdict-count' };
  if (delta > 0 && nowMs - state.ranAtMs >= opts.periodicMs) return { run: true, reason: 'periodic' };
  return { run: false, reason: 'none' };
}

/**
 * PURA. Piano di potatura dei bullet ACE. Due passi deterministici:
 *  1) DEDUP per contenuto: chiave (project | outcome | insight-normalizzato). In un
 *     gruppo tiene il PIÙ RECENTE (created desc, tie-break id), rimuove gli altri.
 *  2) CAP per progetto: sui superstiti, oltre `maxBulletsPerProject` (più recenti
 *     prima) i più vecchi in eccesso sono potati.
 * Ritorna gli id da rimuovere (insieme, senza ripetizioni).
 */
export function bulletDedupPlan(
  bullets: BulletLike[],
  options?: ConsolidationOptions,
): { deleteIds: string[] } {
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  const remove = new Set<string>();

  // 1) Dedup per contenuto.
  const byContent = new Map<string, BulletLike[]>();
  for (const b of bullets) {
    const key = `${b.project} ${b.outcome} ${normText(b.insight)}`;
    const arr = byContent.get(key);
    if (arr) arr.push(b);
    else byContent.set(key, [b]);
  }
  for (const arr of byContent.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort(newerFirst);
    for (let i = 1; i < sorted.length; i++) remove.add(sorted[i].id);
  }

  // 1.5) Near-dup (F9): unifica i parafrasi minimi che il match esatto ha mancato.
  const nd = nearDupRemovals(
    bullets.filter((b) => !remove.has(b.id)).map((b) => ({
      id: b.id, group: `${b.project} ${b.outcome}`, text: b.insight, created: b.created,
    })),
    opts.nearDupThreshold,
  );
  for (const id of nd) remove.add(id);

  // 2) Cap per progetto (solo sui superstiti del dedup).
  const survivors = bullets.filter((b) => !remove.has(b.id));
  const byProject = new Map<string, BulletLike[]>();
  for (const b of survivors) {
    const arr = byProject.get(b.project);
    if (arr) arr.push(b);
    else byProject.set(b.project, [b]);
  }
  for (const arr of byProject.values()) {
    if (arr.length <= opts.maxBulletsPerProject) continue;
    const sorted = [...arr].sort(newerFirst);
    for (let i = opts.maxBulletsPerProject; i < sorted.length; i++) remove.add(sorted[i].id);
  }

  return { deleteIds: [...remove] };
}

/**
 * PURA. Piano di compattazione dei casi episodici — stessa logica dei bullet:
 *  1) DEDUP per contenuto: chiave (project | verdict | outcome | reformulated-norm).
 *  2) CAP per progetto oltre `maxCasesPerProject`.
 * Tiene sempre il PIÙ RECENTE (created_at desc, tie-break id). Ritorna gli id da eliminare.
 */
export function episodicDedupPlan(
  rows: EpisodicPlanRow[],
  options?: ConsolidationOptions,
): { deleteIds: string[] } {
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  const remove = new Set<string>();
  const key = (r: EpisodicPlanRow) =>
    `${r.project_id ?? ''} ${r.verdict} ${r.outcome ?? ''} ${normText(r.reformulated)}`;
  const cmp = (a: EpisodicPlanRow, b: EpisodicPlanRow) =>
    newerFirst({ created: a.created_at, id: a.id }, { created: b.created_at, id: b.id });

  // 1) Dedup per contenuto.
  const byContent = new Map<string, EpisodicPlanRow[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = byContent.get(k);
    if (arr) arr.push(r);
    else byContent.set(k, [r]);
  }
  for (const arr of byContent.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort(cmp);
    for (let i = 1; i < sorted.length; i++) remove.add(sorted[i].id);
  }

  // 1.5) Near-dup (F9): unifica i casi quasi-identici sfuggiti al match esatto.
  const nd = nearDupRemovals(
    rows.filter((r) => !remove.has(r.id)).map((r) => ({
      id: r.id, group: `${r.project_id ?? ''} ${r.verdict} ${r.outcome ?? ''}`, text: r.reformulated, created: r.created_at,
    })),
    opts.nearDupThreshold,
  );
  for (const id of nd) remove.add(id);

  // 2) Cap per progetto.
  const survivors = rows.filter((r) => !remove.has(r.id));
  const byProject = new Map<string, EpisodicPlanRow[]>();
  for (const r of survivors) {
    const p = r.project_id ?? '';
    const arr = byProject.get(p);
    if (arr) arr.push(r);
    else byProject.set(p, [r]);
  }
  for (const arr of byProject.values()) {
    if (arr.length <= opts.maxCasesPerProject) continue;
    const sorted = [...arr].sort(cmp);
    for (let i = opts.maxCasesPerProject; i < sorted.length; i++) remove.add(sorted[i].id);
  }

  return { deleteIds: [...remove] };
}
