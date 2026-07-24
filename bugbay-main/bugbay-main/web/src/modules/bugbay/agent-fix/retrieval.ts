/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * INTERFACCIA DI RECUPERO (v0.8) — STUB. Firma condivisa che il track R
 * implementa: dato un contesto di run, recupera i casi episodici (e in futuro i
 * bullet ACE) più rilevanti da iniettare nel prompt del FIXER.
 *
 * CONTRATTO (congelato per il fan-out; il corpo lo riempie R):
 *  - GUARDIA CONTAMINAZIONE: `query` DEVE essere inglese / stringhe d'errore. Chi
 *    chiama ri-formula l'italiano PRIMA — il recupero non re-indicizza italiano.
 *  - Read-only: `retrieve` NON scrive sulla spina. Sotto usa
 *    `queryEpisodicCases` di `./episodic` (FTS5 BM25).
 *  - Track R possiede la costruzione del prompt del fixer QUESTA wave: qui vive
 *    solo la firma + uno stub sicuro (ritorna vuoto) finché R non la implementa.
 *
 * @indice
 * - RetrievalContext → contesto della run per cui si recupera
 * - RetrievedCase    → un caso recuperato (proiezione leggera per il prompt)
 * - RetrievalResult  → esito del recupero (casi ordinati per rilevanza)
 * - retrieve         → STUB: firma implementata da R
 */

import type { VerdictSource } from './distill';
import { queryEpisodicCases } from './episodic';
import { rankMemory, type RankCandidate } from './memory-rank';
import { recordInjection, caseStats } from './memory-feedback';
import { verdictPolarity } from './verdict-polarity';
import { queryArchetypes } from './archetypes';

export interface RetrievalContext {
  runId?: string;
  reportId?: string | null;
  projectId?: string | null;
  /** Numero massimo di casi da ritornare (default deciso da R). */
  limit?: number;
}

export interface RetrievedCase {
  caseId: string;
  /** bm25: più BASSO = più rilevante. */
  score: number;
  problem: string;
  fixStrategy: string | null;
  outcome: string | null;
  verdict: string;
  source: VerdictSource;
}

/** Un archetipo recuperato: la LEZIONE ad alto livello, sopra i casi-esempio (F4). */
export interface RetrievedArchetype {
  archetypeId: string;
  title: string;
  problemClass: string | null;
  strategy: string | null;
  memberCount: number;
}

export interface RetrievalResult {
  cases: RetrievedCase[];
  /** Archetipi rilevanti (recupero a due livelli): la generalizzazione dei casi. */
  archetypes?: RetrievedArchetype[];
}

/** Default top-k e tetto duro (il prompt del fixer resta compatto). */
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 8;
/** Il pool di candidati BM25 da cui il ranking composito sceglie i top-k (F3). */
const CANDIDATE_FACTOR = 4;

/**
 * Recupero dei casi episodici più rilevanti per l'iniezione nel prompt del fixer.
 * `query` DEVE essere inglese / stringhe d'errore — la guardia contaminazione è del
 * CHIAMANTE, che ri-formula l'italiano PRIMA. Pipeline (fix concilio F2/F3/F5):
 *  1) FTS5 BM25 raccoglie un POOL di candidati (limit×4), filtrato per progetto (F2).
 *  2) `rankMemory` riordina col punteggio composito — sorgente/esito/recency/utilità,
 *     con pavimento di rilevanza — e taglia ai top-`limit` (F3).
 *  3) i casi scelti vengono registrati come iniettati per la run (F5 credit-assignment):
 *     al verdetto della run, `creditRun` ne aggiorna l'utilità osservata.
 * Read-only sulla spina salvo la riga d'iniezione. Best-effort: qualunque errore
 * → nessun risultato, MAI un throw che rompa il fixer.
 */
export async function retrieve(
  query: string,
  ctx?: RetrievalContext,
): Promise<RetrievalResult> {
  const limit = Math.max(1, Math.min(ctx?.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  if (!query || !query.trim()) return { cases: [] };
  try {
    const pool = queryEpisodicCases(query, limit * CANDIDATE_FACTOR, ctx?.projectId);
    if (pool.length === 0) return { cases: [] };

    const stats = caseStats(pool.map(({ case: c }) => c.id));
    const candidates: RankCandidate[] = pool.map(({ case: c, bm25 }) => {
      const s = stats.get(c.id);
      return {
        caseId: c.id,
        bm25,
        verdictSource: c.verdict_source,
        // Polarità dal VERDETTO (approved/merged=positivo · discarded/fail=negativo),
        // non dal campo `outcome` che è testo descrittivo (gate tsc/test). Ignoto → positivo.
        outcome: verdictPolarity(c.verdict) === 'negative' ? 'negative' : 'positive',
        createdAt: c.created_at,
        useful: s?.useful ?? 0,
        harmful: s?.harmful ?? 0,
      };
    });
    const ranked = rankMemory(candidates, { limit, nowMs: Date.now() });

    const byId = new Map(pool.map(({ case: c, bm25 }) => [c.id, { c, bm25 }]));
    const cases: RetrievedCase[] = ranked.flatMap((r) => {
      const hit = byId.get(r.caseId);
      if (!hit) return [];
      const { c, bm25 } = hit;
      return [{
        caseId: c.id,
        score: bm25,
        problem: c.problem,
        fixStrategy: c.fix_strategy,
        outcome: c.outcome,
        verdict: c.verdict,
        source: c.verdict_source,
      }];
    });

    // F5: registra i casi effettivamente iniettati in questa run → base del credit.
    if (ctx?.runId && cases.length) recordInjection(ctx.runId, cases.map((c) => c.caseId));

    // Recupero a due livelli (F4): gli archetipi rilevanti — la LEZIONE ad alto
    // livello — sopra i casi-esempio. Read-only, best-effort (tabella può non esistere).
    const archetypes: RetrievedArchetype[] = queryArchetypes(query, ctx?.projectId, 2).map(
      ({ archetype: a }) => ({
        archetypeId: a.id,
        title: a.title,
        problemClass: a.problem_class,
        strategy: a.canonical_strategy,
        memberCount: a.member_count,
      }),
    );

    return { cases, archetypes: archetypes.length ? archetypes : undefined };
  } catch {
    return { cases: [] };
  }
}
