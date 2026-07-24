/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CONSOLIDAMENTO MEMORIA TRIGGER-BASED (v0.9, TRACK C) — igiene periodica delle due
 * memorie del sistema: i bullet ACE (`.bugbay/knowledge/*.md`) e i casi episodici
 * (`episodic_cases`). Su un TRIGGER (conteggio verdetti oltre soglia / periodico)
 * de-duplica e pota le due superfici, mantenendo la memoria compatta e rilevante.
 * Qui vive lo SHELL di I/O; il core decisionale PURO è in `./consolidation-core`.
 *
 * INVARIANTI (load-bearing, dal design memo — Track C):
 *  - TRIGGER-BASED: nessun timer proprio. `maybeConsolidate()` è chiamata dai loop
 *    esistenti (dispatch/audit tick) e decide da sé se scattare, leggendo il proprio
 *    log di stato (`consolidation_log`) + il conteggio `scores`. `consolidate()` è la
 *    variante forzata (manuale/test).
 *  - IDEMPOTENTE & SAFE-TO-RERUN: la potatura è deterministica (dedup per contenuto,
 *    tiene il PIÙ RECENTE). Una seconda passata non trova più duplicati ⇒ no-op. Il
 *    trigger periodico richiede almeno un nuovo verdetto (niente churn a vuoto).
 *  - VIA LE API DI A / SPINA (mai bypassare il committer): i bullet si LEGGONO con
 *    `loadBullets`, la potatura rimuove il file e COMMITTA con `commitKnowledge`
 *    (identità bot dedicata) — MAI un commit del source tree, MAI un bullet scritto a
 *    mano. I casi episodici si compattano sulla spina condivisa via `transact`
 *    (DELETE su `episodic_cases` + riga FTS nella STESSA transazione: mai un indice
 *    orfano). NON tocca le 10 tabelle congelate né gli internals di ace/knowledge/episodic.
 *  - BEST-EFFORT: al confine pubblico ogni errore è inghiottito (la consolidazione
 *    non deve MAI rompere un loop del daemon).
 *
 * @indice
 * - ConsolidationReport → resoconto di una consolidazione
 * - consolidate         → esegue una consolidazione (forzata), ritorna il resoconto
 * - maybeConsolidate    → esegue SOLO se il trigger scatta (per i tick dei loop)
 * - (re-export) decideTrigger / bulletDedupPlan / episodicDedupPlan / ConsolidationOptions
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { loadBullets, knowledgeDir, commitKnowledge } from './knowledge';
import { openHubDb, transact } from './hub';
import type { SqliteDatabase } from './sqlite';
import {
  decideTrigger,
  bulletDedupPlan,
  episodicDedupPlan,
  type ConsolidationOptions,
  type ConsolidationState,
  type TriggerReason,
  type EpisodicPlanRow,
} from './consolidation-core';

// Ri-esporto il core puro così i consumer importano l'intero contratto da qui.
export {
  decideTrigger,
  bulletDedupPlan,
  episodicDedupPlan,
} from './consolidation-core';
export type {
  ConsolidationOptions,
  ConsolidationState,
  TriggerReason,
  BulletLike,
  EpisodicPlanRow,
} from './consolidation-core';

export interface ConsolidationReport {
  /** true se la consolidazione è stata eseguita (false = trigger non scattato / errore). */
  ran: boolean;
  reason: TriggerReason;
  verdictCount: number;
  bulletsPruned: number;
  casesPruned: number;
  /** Presente solo se un errore è stato inghiottito (best-effort). */
  error?: string;
}

// ── Stato di consolidazione (tabella ADDITIVA, fuori dallo schema congelato) ──

// Log append-only delle consolidazioni: la riga più recente è lo stato del trigger
// differenziale (quanti verdetti c'erano, quando). ADDITIVO come `episodic_cases`:
// IF NOT EXISTS, init pigro guardato su global (hot-reload safe).
const CONSOLIDATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS consolidation_log (
  id             TEXT PRIMARY KEY,
  reason         TEXT NOT NULL,
  verdicts_at    INTEGER NOT NULL,
  bullets_pruned INTEGER NOT NULL DEFAULT 0,
  cases_pruned   INTEGER NOT NULL DEFAULT 0,
  ran_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS consolidation_log_ran_idx ON consolidation_log (ran_at);
`;

const gc = global as unknown as { __bugbay_consolidation_inited__?: boolean };
function ensureSchema(db: SqliteDatabase): void {
  if (gc.__bugbay_consolidation_inited__) return;
  db.exec(CONSOLIDATION_SCHEMA);
  gc.__bugbay_consolidation_inited__ = true;
}

/** true se una tabella esiste (guardia: l'episodica può non essere ancora inizializzata). */
function tableExists(db: SqliteDatabase, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return !!row;
}

/** Conteggio totale dei verdetti registrati (tabella `scores` congelata). */
function countVerdicts(db: SqliteDatabase): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM scores').get() as { n: number } | undefined;
  return row?.n ?? 0;
}

/** Ultima consolidazione (riga più recente del log), o null se mai eseguita. */
function lastState(db: SqliteDatabase): ConsolidationState | null {
  const row = db
    .prepare('SELECT verdicts_at, ran_at FROM consolidation_log ORDER BY ran_at DESC LIMIT 1')
    .get() as { verdicts_at: number; ran_at: string } | undefined;
  if (!row) return null;
  const ranAtMs = Date.parse(row.ran_at);
  return { verdictsAt: row.verdicts_at, ranAtMs: Number.isNaN(ranAtMs) ? 0 : ranAtMs };
}

/** INSERT append-only di una riga di log (audit trail delle consolidazioni). */
function appendLog(
  db: SqliteDatabase,
  reason: TriggerReason,
  verdictsAt: number,
  bulletsPruned: number,
  casesPruned: number,
): void {
  db
    .prepare(
      `INSERT INTO consolidation_log (id, reason, verdicts_at, bullets_pruned, cases_pruned, ran_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `consolidation-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      reason,
      verdictsAt,
      bulletsPruned,
      casesPruned,
      new Date().toISOString(),
    );
}

// ── Potatura dei bullet ACE (via loadBullets + commitKnowledge) ──────────────

/** Elenco ricorsivo dei `*.md` sotto `dir` (dir assente → []); mai un throw. */
function listMarkdown(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(full));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Mappa id-bullet → path del file, ricostruita scansionando `knowledgeDir` e leggendo
 * il frontmatter (drift-proof rispetto allo slug interno di knowledge.ts). Read-only.
 */
function bulletFileIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const file of listMarkdown(knowledgeDir())) {
    try {
      const id = matter(fs.readFileSync(file, 'utf-8')).data?.id;
      if (typeof id === 'string' && id) index.set(id, file);
    } catch {
      /* file non parsabile: lo gestisce la quarantena di loadBullets, qui si ignora */
    }
  }
  return index;
}

/**
 * Pota i bullet ACE: `loadBullets` (validati) → piano di dedup → rimozione dei file
 * → commit via `commitKnowledge` (identità bot, solo pathspec conoscenza). MAI scrive
 * un bullet a mano; la rimozione è committata dal committer di A. Ritorna quanti potati.
 */
function pruneBullets(options?: ConsolidationOptions): number {
  const bullets = loadBullets();
  const { deleteIds } = bulletDedupPlan(bullets, options);
  if (deleteIds.length === 0) return 0;

  const index = bulletFileIndex();
  let removed = 0;
  for (const id of deleteIds) {
    const file = index.get(id);
    if (!file) continue;
    try {
      fs.rmSync(file, { force: true });
      removed++;
    } catch {
      /* best-effort: un file non rimovibile non blocca gli altri */
    }
  }
  if (removed > 0) {
    commitKnowledge(`memoria(consolidamento): potati ${removed} bullet duplicati/eccedenti`);
  }
  return removed;
}

// ── Compattazione dei casi episodici (sulla spina condivisa, FTS in sync) ────

/**
 * Compatta i casi episodici: legge la proiezione minima, calcola il piano di dedup e
 * ELIMINA gli id in eccesso da `episodic_cases` + `episodic_cases_fts` nella STESSA
 * transazione (mai un indice orfano). Guardia: se la tabella non esiste ancora (nessun
 * caso mai scritto) → no-op. Ritorna quanti casi eliminati.
 */
function pruneEpisodic(db: SqliteDatabase, options?: ConsolidationOptions): number {
  if (!tableExists(db, 'episodic_cases')) return 0;
  const rows = db
    .prepare('SELECT id, project_id, reformulated, verdict, outcome, created_at FROM episodic_cases')
    .all() as EpisodicPlanRow[];
  const { deleteIds } = episodicDedupPlan(rows, options);
  if (deleteIds.length === 0) return 0;

  const hasFts = tableExists(db, 'episodic_cases_fts');
  transact((tdb) => {
    const delCase = tdb.prepare('DELETE FROM episodic_cases WHERE id = ?');
    const delFts = hasFts ? tdb.prepare('DELETE FROM episodic_cases_fts WHERE case_id = ?') : null;
    for (const id of deleteIds) {
      delCase.run(id);
      if (delFts) delFts.run(id);
    }
  });
  return deleteIds.length;
}

// ── API pubblica ─────────────────────────────────────────────────────────────

/**
 * Esegue una consolidazione (FORZATA, senza controllare il trigger): pota bullet e
 * casi episodici, poi registra la riga di log. Idempotente: rieseguita subito non
 * trova più duplicati → 0 potati. Best-effort: un errore è catturato nel resoconto,
 * mai propagato (non deve rompere il chiamante). `reason` etichetta il log/resoconto.
 */
export function consolidate(
  options?: ConsolidationOptions,
  reason: TriggerReason = 'manual',
): ConsolidationReport {
  try {
    const db = openHubDb();
    ensureSchema(db);
    const verdictCount = countVerdicts(db);
    const bulletsPruned = pruneBullets(options);
    const casesPruned = pruneEpisodic(db, options);
    appendLog(db, reason, verdictCount, bulletsPruned, casesPruned);
    return { ran: true, reason, verdictCount, bulletsPruned, casesPruned };
  } catch (e) {
    return {
      ran: false,
      reason: 'none',
      verdictCount: 0,
      bulletsPruned: 0,
      casesPruned: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * TRIGGER-BASED: eseguita dai tick dei loop esistenti. Valuta il trigger (soglia di
 * nuovi verdetti / periodico) e consolida SOLO se scatta; altrimenti no-op leggero
 * (una SELECT COUNT + una SELECT sull'ultimo log). Best-effort: mai un throw.
 */
export function maybeConsolidate(options?: ConsolidationOptions): ConsolidationReport {
  try {
    const db = openHubDb();
    ensureSchema(db);
    const verdictCount = countVerdicts(db);
    const decision = decideTrigger(lastState(db), verdictCount, Date.now(), options);
    if (!decision.run) {
      return { ran: false, reason: decision.reason, verdictCount, bulletsPruned: 0, casesPruned: 0 };
    }
    return consolidate(options, decision.reason);
  } catch (e) {
    return {
      ran: false,
      reason: 'none',
      verdictCount: 0,
      bulletsPruned: 0,
      casesPruned: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
