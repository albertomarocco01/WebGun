/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CREDIT-ASSIGNMENT della memoria (v1.0, fix concilio F5) — chiude il buco per cui
 * NIENTE legava "il caso X è stato iniettato nella run Y" a "Y è poi passata/fallita",
 * rendendo il "gate misurato delta>=0" promesso da prompts.ts insoddisfacibile. Qui:
 *  - `memory_injections`: quali casi sono stati iniettati in quale run (al retrieval).
 *  - `memory_case_stats`: utilità osservata per caso (useful/harmful pesati dalla
 *    fiducia della sorgente del verdetto), aggiornata quando la run riceve un verdetto.
 * Additivo come `episodic_cases`: fuori dallo schema congelato, init pigro su global.
 *
 * INVARIANTI:
 *  - ADDITIVO: nuove tabelle, nessuna delle 10 congelate cambia.
 *  - BEST-EFFORT & NON-THROWING: sta su un path di recupero/verdetto che non deve
 *    MAI rompersi; ogni confine pubblico inghiotte gli errori.
 *  - CREDIT PER-VERDETTO PESATO: `creditRun` accredita i casi iniettati a ogni
 *    verdetto della run, incrementando di `weight` (HUMAN 1.0 > JUDGE 0.5 > IMPLICIT
 *    0.25). Nessun dedup per-run: HUMAN e JUDGE contano entrambi — è segnale, non
 *    doppio conteggio (un fail-poi-approve si media a incertezza, che è corretto).
 *
 * @indice
 * - recordInjection → registra i casi iniettati in una run (al retrieval)
 * - creditRun       → accredita utilità ai casi iniettati, dato il verdetto della run
 * - caseStats       → utilità corrente per un set di caseId (per il ranking)
 */

import { openHubDb, transact } from './hub';
import type { SqliteDatabase } from './sqlite';

const FEEDBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS memory_injections (
  run_id     TEXT NOT NULL,
  case_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, case_id)
);
CREATE INDEX IF NOT EXISTS memory_injections_run_idx ON memory_injections (run_id);

CREATE TABLE IF NOT EXISTS memory_case_stats (
  case_id    TEXT PRIMARY KEY,
  useful     REAL NOT NULL DEFAULT 0,
  harmful    REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

const gf = global as unknown as { __bugbay_feedback_inited__?: boolean };
function ensureSchema(db: SqliteDatabase): void {
  if (gf.__bugbay_feedback_inited__) return;
  db.exec(FEEDBACK_SCHEMA);
  gf.__bugbay_feedback_inited__ = true;
}

export interface CaseStat {
  useful: number;
  harmful: number;
}

/**
 * Registra i casi iniettati nel prompt di una run (chiamato dal retrieval). INSERT
 * OR IGNORE: la stessa coppia (run, caso) non si duplica se il retrieval rigira.
 * Best-effort: mai un throw sul path del fix.
 */
export function recordInjection(runId: string, caseIds: string[]): void {
  if (!runId || caseIds.length === 0) return;
  try {
    const db = openHubDb();
    ensureSchema(db);
    const now = new Date().toISOString();
    transact((tdb) => {
      const stmt = tdb.prepare(
        'INSERT OR IGNORE INTO memory_injections (run_id, case_id, created_at) VALUES (?, ?, ?)',
      );
      for (const caseId of caseIds) if (caseId) stmt.run(runId, caseId, now);
    });
  } catch {
    /* credit-assignment best-effort: non deve mai rompere il fix */
  }
}

/**
 * Accredita l'utilità ai casi iniettati in `runId`, dato l'esito del verdetto. Un
 * verdetto positivo → +weight su `useful` per ogni caso iniettato; negativo →
 * +weight su `harmful`. Idempotenza a livello di verdetto singolo (non per-run):
 * chiamarla una volta per verdetto è il contratto. Best-effort: mai un throw.
 */
export function creditRun(runId: string, polarity: 'positive' | 'negative', weight = 1): void {
  if (!runId || weight <= 0) return;
  try {
    const db = openHubDb();
    ensureSchema(db);
    const rows = db
      .prepare('SELECT case_id FROM memory_injections WHERE run_id = ?')
      .all(runId) as { case_id: string }[];
    if (rows.length === 0) return;
    const col = polarity === 'positive' ? 'useful' : 'harmful';
    const now = new Date().toISOString();
    transact((tdb) => {
      const stmt = tdb.prepare(
        `INSERT INTO memory_case_stats (case_id, useful, harmful, updated_at)
           VALUES (?, ?, ?, ?)
         ON CONFLICT(case_id) DO UPDATE SET ${col} = ${col} + ?, updated_at = ?`,
      );
      for (const { case_id } of rows) {
        const u = polarity === 'positive' ? weight : 0;
        const h = polarity === 'negative' ? weight : 0;
        stmt.run(case_id, u, h, now, weight, now);
      }
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Utilità corrente per un set di caseId (per il ranking). Ritorna una mappa
 * caseId → {useful, harmful}; i casi senza statistiche sono assenti (il ranking
 * li tratta come neutri). Best-effort: su errore ritorna mappa vuota.
 */
export function caseStats(caseIds: string[]): Map<string, CaseStat> {
  const out = new Map<string, CaseStat>();
  if (caseIds.length === 0) return out;
  try {
    const db = openHubDb();
    ensureSchema(db);
    const placeholders = caseIds.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT case_id, useful, harmful FROM memory_case_stats WHERE case_id IN (${placeholders})`,
      )
      .all(...caseIds) as { case_id: string; useful: number; harmful: number }[];
    for (const r of rows) out.set(r.case_id, { useful: r.useful, harmful: r.harmful });
  } catch {
    /* best-effort */
  }
  return out;
}
