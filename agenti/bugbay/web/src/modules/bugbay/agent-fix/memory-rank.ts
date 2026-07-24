/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CORE PURO del ranking della memoria (v1.0, fix concilio F3+F5) — la logica
 * DECISIONALE del recupero, senza dipendenze da DB/fs. Estratto come i `*-core`
 * così è IMPORTABILE dal runner nativo `node:test`. Il BM25 grezzo (rilevanza
 * lessicale) NON basta: il concilio ha rilevato che un anti-esempio `discarded`
 * scavalca un `merged` umano solo per overlap di token, e che sorgente/recency/
 * utilità (dal credit-assignment) non pesano affatto. Qui il punteggio composito
 * fonde: BM25 (rilevanza) · fiducia della sorgente (HUMAN>JUDGE>IMPLICIT) ·
 * recency · esito (anti-esempio penalizzato ma non escluso) · utilità osservata
 * (quante run che l'hanno visto sono poi passate/fallite). Più un PAVIMENTO di
 * rilevanza: un match lessicale troppo debole non entra mai nel prompt (rumore).
 *
 * @indice
 * - RankCandidate → riga candidata (proiezione dello store + stats di utilità)
 * - RANK_DEFAULTS → costanti tunabili (pavimento, pesi, orizzonte recency)
 * - rankMemory    → PURA: filtra sotto-soglia, calcola score composito, top-k
 */

export interface RankCandidate {
  caseId: string;
  /** BM25 SQLite: più BASSO (più negativo) = più rilevante. */
  bm25: number;
  verdictSource: 'HUMAN' | 'JUDGE' | 'IMPLICIT';
  /** Esito distillato del caso (positive = fix riuscito, negative = da evitare). */
  outcome: 'positive' | 'negative';
  /** created_at ISO del caso (per il boost di recency). */
  createdAt: string;
  /** Credit-assignment (F5): run che hanno consumato il caso e poi sono passate. */
  useful?: number;
  /** Credit-assignment (F5): run che l'hanno consumato e poi sono fallite. */
  harmful?: number;
}

export interface RankOptions {
  /** Quanti casi ritornare (top-k dopo il ranking). */
  limit?: number;
  /** Ora corrente (ms) per il calcolo della recency; iniettata per il determinismo. */
  nowMs?: number;
}

export const RANK_DEFAULTS = {
  /** Pavimento di rilevanza: scarta un candidato se il suo BM25 dista dal MIGLIORE
   *  più di questo (unità BM25). Un match lessicale troppo debole = rumore, mai iniettato. */
  maxBm25Gap: 6,
  /** Moltiplicatori per fiducia della sorgente (più basso = spinta più forte). */
  sourceMult: { HUMAN: 0.6, JUDGE: 0.8, IMPLICIT: 1.0 } as Record<RankCandidate['verdictSource'], number>,
  /** Penalità per un anti-esempio (negative): resta recuperabile ma sotto un positivo pari-rilevanza. */
  negativeMult: 1.25,
  /** Orizzonte di recency (ms): oltre questo l'età non penalizza più. 90 giorni. */
  recencyHorizonMs: 90 * 24 * 60 * 60 * 1000,
  /** Ampiezza del boost/penalità di recency attorno a 1.0 (±). */
  recencySpan: 0.1,
  /** Ampiezza del boost/penalità di utilità attorno a 1.0 (±), saturata. */
  utilitySpan: 0.3,
};

/** Boost di recency in [1-span, 1+span]: recente→<1 (meglio), vecchio→>1 (peggio). */
function recencyMult(createdAt: string, nowMs: number, d = RANK_DEFAULTS): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 1;
  const age = Math.max(0, nowMs - t);
  const frac = Math.min(1, age / d.recencyHorizonMs); // 0 (nuovo) → 1 (oltre orizzonte)
  return 1 - d.recencySpan + frac * (2 * d.recencySpan);
}

/** Boost di utilità in [1-span, 1+span] da (useful-harmful)/(useful+harmful). */
function utilityMult(useful: number, harmful: number, d = RANK_DEFAULTS): number {
  const total = useful + harmful;
  if (total <= 0) return 1; // nessun segnale ancora → neutro
  const ratio = (useful - harmful) / total; // +1 sempre utile … -1 sempre dannoso
  return 1 - ratio * d.utilitySpan; // utile→<1 (meglio), dannoso→>1 (peggio)
}

/**
 * PURA. Ordina i candidati per punteggio composito e ritorna i top-`limit` che
 * superano il pavimento di rilevanza. Il punteggio parte dal BM25 (negativo=meglio)
 * e lo modula per sorgente/esito/recency/utilità; l'ordine finale è crescente
 * (più basso = più rilevante). Deterministica: nessun accesso a orologio/DB, `nowMs`
 * è iniettato. Tie-break stabile su caseId.
 */
export function rankMemory(
  candidates: RankCandidate[],
  options?: RankOptions,
): RankCandidate[] {
  const d = RANK_DEFAULTS;
  const limit = Math.max(1, options?.limit ?? 3);
  const nowMs = options?.nowMs ?? 0;
  if (candidates.length === 0) return [];

  // Pavimento di rilevanza: rispetto al BM25 migliore (più negativo).
  const bestBm25 = Math.min(...candidates.map((c) => c.bm25));
  const relevant = candidates.filter((c) => c.bm25 - bestBm25 <= d.maxBm25Gap);

  const scored = relevant.map((c) => {
    const src = d.sourceMult[c.verdictSource] ?? 1;
    const neg = c.outcome === 'negative' ? d.negativeMult : 1;
    const rec = recencyMult(c.createdAt, nowMs, d);
    const util = utilityMult(c.useful ?? 0, c.harmful ?? 0, d);
    // BM25 è negativo: moltiplicare per un fattore >1 lo rende PIÙ negativo (meglio),
    // quindi invertiamo — applichiamo i moltiplicatori sulla MAGNITUDINE e riportiamo il segno.
    const composite = -Math.abs(c.bm25) / (src * neg * rec * util);
    return { c, composite };
  });

  scored.sort((a, b) =>
    a.composite !== b.composite ? a.composite - b.composite : a.c.caseId < b.c.caseId ? -1 : 1,
  );
  return scored.slice(0, limit).map((s) => s.c);
}
