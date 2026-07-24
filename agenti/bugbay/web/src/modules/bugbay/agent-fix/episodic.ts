/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * MEMORIA EPISODICA (v0.8) — casi ExpeRepair, ADDITIVO sulla spina `hub.sqlite`.
 * Ogni VERDETTO distilla un "caso" (problema/contesto/repro/strategia/esito +
 * verdetto + traiettoria) in una tabella dedicata `episodic_cases`, indicizzata
 * per il recupero da un indice FTS5 BM25.
 *
 * INVARIANTI (load-bearing, dal design memo):
 *  - ADDITIVO: NON tocca le 10 tabelle congelate. `episodic_cases` +
 *    `episodic_cases_fts` sono nuove; lo schema è idempotente (IF NOT EXISTS) e
 *    inizializzato pigramente, FUORI dallo HUB_SCHEMA congelato di hub.ts.
 *  - GUARDIA CONTAMINAZIONE: l'indice FTS copre SOLO testo ri-formulato in
 *    INGLESE (`reformulated`) + stringhe d'errore (`error_strings`). MAI
 *    indicizzare/interrogare italiano grezzo — il chiamante ri-formula prima.
 *  - node:sqlite / DatabaseSync via `openHubDb()` (stessa spina machine-scoped).
 *    Niente sqlite-vec: BM25 basta (cosine brute-force <10ms se mai servisse).
 *
 * @indice
 * - EpisodicCaseRow    → riga tipizzata di `episodic_cases`
 * - EpisodicCaseInput  → input di scrittura (E, distiller episodico)
 * - EpisodicMatch      → risultato di query (riga + punteggio bm25)
 * - writeEpisodicCase  → INSERT caso + riga FTS (transazione atomica), ritorna id
 * - queryEpisodicCases → FTS5 BM25 su reformulated+error_strings, top-k (R, retrieve)
 * - getEpisodicCase    → riga singola per id (o undefined)
 */

import crypto from 'crypto';
import { openHubDb, transact } from './hub';
import type { SqliteDatabase } from './sqlite';

export interface EpisodicCaseRow {
  id: string;
  run_id: string | null;
  report_id: string | null;
  project_id: string | null;
  problem: string;
  context: string | null;
  repro: string | null;
  fix_strategy: string | null;
  outcome: string | null;
  verdict: string;
  verdict_source: 'HUMAN' | 'JUDGE' | 'IMPLICIT';
  trajectory: string | null;
  reformulated: string;
  error_strings: string | null;
  created_at: string;
}

export interface EpisodicCaseInput {
  id?: string;
  runId?: string | null;
  reportId?: string | null;
  projectId?: string | null;
  /** Descrizione del difetto/richiesta. Preferibilmente già in inglese. */
  problem: string;
  context?: string | null;
  /** Come riprodurre / test di repro (BRT). */
  repro?: string | null;
  /** Strategia/approccio del fix. */
  fixStrategy?: string | null;
  /** Esito osservato del fix. */
  outcome?: string | null;
  /** Verdetto (es. 'approved' | 'merged' | 'discarded' | 'pass' | 'fail'). */
  verdict: string;
  verdictSource: 'HUMAN' | 'JUDGE' | 'IMPLICIT';
  /** Traiettoria (passi/decisioni). Serializzata a JSON se non è già stringa. */
  trajectory?: unknown;
  /**
   * GUARDIA CONTAMINAZIONE: testo INGLESE ri-formulato — è ciò che l'FTS indicizza.
   * Il chiamante DEVE ri-formulare l'italiano in inglese prima di scrivere qui.
   */
  reformulated: string;
  /** Stringhe d'errore estratte (indicizzate insieme a `reformulated`). */
  errorStrings?: string | null;
}

export interface EpisodicMatch {
  case: EpisodicCaseRow;
  /** Punteggio bm25 (più BASSO = più rilevante). */
  bm25: number;
}

// Schema ADDITIVO — fuori dallo HUB_SCHEMA congelato. FTS5 come tabella
// autonoma con `case_id UNINDEXED`: la PK di `episodic_cases` è TEXT (no rowid
// intero mappabile a external-content), quindi popoliamo l'FTS manualmente in
// `writeEpisodicCase`. Solo `reformulated` + `error_strings` sono indicizzati
// (guardia contaminazione: nessun italiano grezzo nell'indice).
const EPISODIC_SCHEMA = `
CREATE TABLE IF NOT EXISTS episodic_cases (
  id             TEXT PRIMARY KEY,
  run_id         TEXT,
  report_id      TEXT,
  project_id     TEXT,
  problem        TEXT NOT NULL,
  context        TEXT,
  repro          TEXT,
  fix_strategy   TEXT,
  outcome        TEXT,
  verdict        TEXT NOT NULL,
  verdict_source TEXT NOT NULL,
  trajectory     TEXT,
  reformulated   TEXT NOT NULL,
  error_strings  TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS episodic_run_idx    ON episodic_cases (run_id);
CREATE INDEX IF NOT EXISTS episodic_report_idx ON episodic_cases (report_id);
CREATE INDEX IF NOT EXISTS episodic_project_idx ON episodic_cases (project_id);

CREATE VIRTUAL TABLE IF NOT EXISTS episodic_cases_fts USING fts5(
  case_id UNINDEXED,
  reformulated,
  error_strings,
  tokenize = 'porter unicode61'
);
`;

// Init idempotente pigro, su `global` (hot-reload safe come l'handle DB di hub.ts).
const ge = global as unknown as { __bugbay_episodic_inited__?: boolean };
function ensureSchema(db: SqliteDatabase): void {
  if (ge.__bugbay_episodic_inited__) return;
  db.exec(EPISODIC_SCHEMA);
  ge.__bugbay_episodic_inited__ = true;
}

function asJson(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

/**
 * Scrive un caso episodico + la sua riga FTS in UNA transazione atomica.
 * Ritorna l'id del caso (generato se non fornito).
 */
export function writeEpisodicCase(c: EpisodicCaseInput): string {
  const db = openHubDb();
  ensureSchema(db);
  const provided = c.id != null;
  const id = c.id ?? crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const errorStrings = c.errorStrings ?? null;
  const reformulated = c.reformulated;
  transact((tdb) => {
    // Id deterministico fornito (per-run) → idempotente latest-wins: ripulisci il caso
    // e la sua riga FTS prima di reinserire, così un run con più score non duplica.
    if (provided) {
      tdb.prepare('DELETE FROM episodic_cases WHERE id = ?').run(id);
      tdb.prepare('DELETE FROM episodic_cases_fts WHERE case_id = ?').run(id);
    }
    tdb
      .prepare(
        `INSERT INTO episodic_cases
           (id, run_id, report_id, project_id, problem, context, repro,
            fix_strategy, outcome, verdict, verdict_source, trajectory,
            reformulated, error_strings, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        c.runId ?? null,
        c.reportId ?? null,
        c.projectId ?? null,
        c.problem,
        c.context ?? null,
        c.repro ?? null,
        c.fixStrategy ?? null,
        c.outcome ?? null,
        c.verdict,
        c.verdictSource,
        asJson(c.trajectory),
        reformulated,
        errorStrings,
        createdAt,
      );
    tdb
      .prepare(
        `INSERT INTO episodic_cases_fts (case_id, reformulated, error_strings)
         VALUES (?, ?, ?)`,
      )
      .run(id, reformulated, errorStrings ?? '');
  });
  return id;
}

// Costruisce una MATCH FTS5 sicura: estrae i token alfanumerici (unicode), li
// quota come stringhe e li unisce in OR (recall > precisione per il recupero).
// Neutralizza la sintassi FTS5 dell'input (NEAR/":"/"*"/parentesi) che altrimenti
// lancerebbe. Ritorna '' se non resta alcun token → query salta (nessun match).
function ftsMatch(raw: string): string {
  const tokens = (raw.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => t.length > 1)
    .slice(0, 32);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
}

/**
 * Recupero FTS5 BM25 sui casi episodici. `query` DEVE essere inglese/stringhe
 * d'errore (guardia contaminazione: il chiamante ri-formula prima). Ordina per
 * rilevanza (bm25 crescente) e ritorna i top-`limit` casi con il punteggio.
 *
 * ISOLAMENTO PER PROGETTO (fix concilio F2): se `projectId` è passato, i casi di
 * ALTRI progetti sono esclusi (l'hub è machine-scoped e condiviso tra repo: senza
 * questo filtro un caso del repo A finiva nel prompt del repo B — bleed cross-tenant
 * e canale di poisoning). I casi senza project_id (legacy/generali) restano visibili.
 */
export function queryEpisodicCases(
  query: string,
  limit = 5,
  projectId?: string | null,
): EpisodicMatch[] {
  const db = openHubDb();
  ensureSchema(db);
  const match = ftsMatch(query);
  if (!match) return [];
  const clauses = ['episodic_cases_fts MATCH ?'];
  const params: unknown[] = [match];
  if (projectId != null && projectId !== '') {
    clauses.push('(c.project_id = ? OR c.project_id IS NULL)');
    params.push(projectId);
  }
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT c.id, c.run_id, c.report_id, c.project_id, c.problem, c.context,
              c.repro, c.fix_strategy, c.outcome, c.verdict, c.verdict_source,
              c.trajectory, c.reformulated, c.error_strings, c.created_at,
              bm25(episodic_cases_fts) AS bm25
         FROM episodic_cases_fts
         JOIN episodic_cases c ON c.id = episodic_cases_fts.case_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY bm25 ASC
        LIMIT ?`,
    )
    .all(...params) as (EpisodicCaseRow & { bm25: number })[];
  return rows.map(({ bm25, ...row }) => ({ case: row as EpisodicCaseRow, bm25 }));
}

/** Riga singola di `episodic_cases` per id (o undefined). */
export function getEpisodicCase(id: string): EpisodicCaseRow | undefined {
  const db = openHubDb();
  ensureSchema(db);
  const row = db
    .prepare(
      `SELECT id, run_id, report_id, project_id, problem, context, repro,
              fix_strategy, outcome, verdict, verdict_source, trajectory,
              reformulated, error_strings, created_at
         FROM episodic_cases WHERE id = ?`,
    )
    .get(id);
  return (row as EpisodicCaseRow | undefined) ?? undefined;
}
