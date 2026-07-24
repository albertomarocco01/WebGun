/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * SPINA `hub.sqlite` — CONTRATTO WAVE-0 CONGELATO (v0.6). Autorità di stato di
 * tutte le run, machine-scoped: un solo `~/.bugbay/hub.sqlite` per TUTTI i repo
 * (node:sqlite / DatabaseSync, WAL, foreign_keys ON). DDL autoritativo: roadmap
 * Appendice A. Congelato ⇒ FK pinnate qui una volta; le tabelle
 * usage_blocks/daemon_sessions/config_versions ricevono i VALORI in v0.7,
 * radar_findings è usata in v0.9 — ma tabelle, tipi TS e EVENT_NAMES freezano QUI.
 *
 * Invarianti onorati:
 *  - INSERT-before-emit: `appendEvent()` fa l'INSERT (atomico) e ritorna l'id =
 *    events.id monotono = SSE Last-Event-ID; il W1 emette DOPO il commit.
 *  - transizione-run + suo evento nella STESSA `transact()` (helper atomico).
 *  - events append-only (mai update/delete); id = AUTOINCREMENT.
 *  - usage_blocks MATERIALIZZATA (tabella, non VIEW).
 *  - observations flat snake_case, parent_id self-FK nullable, span_kind.
 *  - HARD-FAIL su Node < 22.13 e su storage non apribile (nessun fallback JSON).
 *
 * SCOPE: solo la fondazione di storage + il contratto. Nessun parser stream-json,
 * nessun server SSE, nessuna UI (Wave 1). Qui si espongono solo le API che W1 usa.
 *
 * @indice
 * - openHubDb    → apre/inizializza la spina (singleton per processo), hard-fail
 * - transact     → esegue `fn` in una transazione atomica sulla spina
 * - appendEvent  → INSERT su events, ritorna l'id (INSERT-before-emit friendly)
 * - EVENT_NAMES / EventName / RunPhase → vocabolari congelati
 * - *Row         → tipi TS delle 10 righe (congelati con lo schema)
 *
 * @indice (helper di consumo W1, differiti da W0 — aggiunti UNA volta dal Contract
 *          Steward così i 4 track di fan-out non toccano più hub.ts)
 * - appendObservation     → INSERT su observations (A/parser), ritorna l'id
 * - appendObservationBody → UPSERT del corpo pesante in observation_bodies (A)
 * - appendObsEvent        → emette obs.started/obs.ended legato a un observation id (A)
 * - getEventsSince        → replay eventi con id > cursore, ORDER BY id ASC (B/SSE)
 * - getMaxEventId         → id massimo corrente in events (cursore di partenza) (B/SSE)
 * - addScore              → INSERT su scores, ritorna l'id (writer verdetti)
 *
 * @indice (getter READ-ONLY della console-hub, v0.6 Wave-2 — additivi: nessuna
 *          tabella/firma cambia, solo SELECT su colonne esplicite = *Row)
 * - getRunRow             → riga `runs` grezza (phase autoritativa + timestamps)
 * - getObservations       → observations di una run, ORDER BY started_at ASC
 * - getObservationBody    → corpo pesante di una observation (o null)
 * - getObservationBodyIds → id delle observations che HANNO un corpo (affordance expand)
 * - getEventsForRun       → tutti gli eventi di una run, ORDER BY id ASC
 */

import fs from 'fs';
import { openWalDatabase, transact as sqliteTransact, type SqliteDatabase } from './sqlite';
import { bugbayHubDir, hubDbPath } from './target-root';
import type { RunPhase } from './types';
import { onVerdict } from './distill';

// RunPhase è single-source in types.ts (identico all'elenco di Appendice A):
// 'queued'|'interpreting'|'needs_clarification'|'fixing'|'verifying'|'review'|
// 'paused'|'approved'|'discarded'|'aborted'|'error'.
export type { RunPhase } from './types';

// ── Set nomi eventi (CONGELATO) ──────────────────────────────────────────────
//   • run.created    → nascita run (phase_to = 'queued')
//   • run.transition → UPDATE runs.phase + INSERT events nella STESSA transact()
//   • obs.started / obs.ended → INSERT observation poi INSERT event (INSERT-before-emit)
//   • score.recorded → verdetto scritto (HUMAN/JUDGE/IMPLICIT)
//   • alert.raised   → riga alerts (budget/watchdog/parse/eval/stuck)
export const EVENT_NAMES = [
  'run.created',
  'run.transition',
  'obs.started',
  'obs.ended',
  'score.recorded',
  'alert.raised',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

// ── Tipi TS delle righe (congelati con lo schema, Appendice A) ────────────────
export interface RunRow {
  id: string;
  report_id: string;
  project_id: string | null;
  phase: RunPhase;
  branch: string | null;
  session_id: string | null;
  data: string;
  created_at: string;
  updated_at: string;
}
export interface EventRow {
  id: number;
  run_id: string;
  name: EventName;
  phase_from: RunPhase | null;
  phase_to: RunPhase | null;
  payload: string | null;
  ts: string;
}
export type SpanKind = 'llm' | 'tool' | 'gate' | 'phase' | 'repair' | 'plan';
export interface ObservationRow {
  id: string;
  run_id: string;
  parent_id: string | null;
  span_kind: SpanKind;
  name: string;
  stage: string | null;
  sym: string | null;
  model: string | null;
  status: 'ok' | 'error' | 'running' | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  started_at: string;
  ended_at: string | null;
  ms: number | null;
}
export interface ObservationBodyRow {
  observation_id: string;
  body: string;
}
export interface ScoreRow {
  id: string;
  run_id: string;
  report_id: string | null;
  source: 'HUMAN' | 'JUDGE' | 'IMPLICIT';
  verdict: string;
  weight: number;
  detail: string | null;
  created_at: string;
}
export interface AlertRow {
  id: string;
  channel: 'budget' | 'watchdog' | 'parse' | 'eval' | 'stuck';
  severity: 'info' | 'warn' | 'error';
  run_id: string | null;
  message: string;
  detail: string | null;
  created_at: string;
  ack_at: string | null;
}
export interface UsageBlockRow {
  id: string;
  channel: string;
  window_kind: 'block_5h' | 'weekly';
  started_at: string;
  ends_at: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  paused_until: string | null;
  updated_at: string;
}
export interface DaemonSessionRow {
  session_id: string;
  started_at: string;
  last_seen_at: string;
  meta: string | null;
}
export interface ConfigVersionRow {
  id: string;
  scope: 'routing' | 'budget' | 'threshold';
  value: string;
  author: string | null;
  created_at: string;
}
export interface RadarFindingRow {
  id: string;
  project_id: string | null;
  kind: string;
  title: string;
  detail: string | null;
  status: 'new' | 'filed' | 'dismissed';
  created_at: string;
}

// ── DDL congelato (Appendice A). Le PRAGMA WAL/foreign_keys sono per-connessione
//    e le mette openWalDatabase; qui solo tabelle + indici. Tutti IF NOT EXISTS:
//    l'init è idempotente. FK pinnate una volta.
const HUB_SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  report_id   TEXT NOT NULL,
  project_id  TEXT,
  phase       TEXT NOT NULL,
  branch      TEXT,
  session_id  TEXT,
  data        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_report_idx ON runs (report_id);
CREATE INDEX IF NOT EXISTS runs_phase_idx  ON runs (phase);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  name        TEXT NOT NULL,
  phase_from  TEXT,
  phase_to    TEXT,
  payload     TEXT,
  ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_run_idx ON events (run_id, id);

CREATE TABLE IF NOT EXISTS observations (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(id),
  parent_id     TEXT REFERENCES observations(id),
  span_kind     TEXT NOT NULL,
  name          TEXT NOT NULL,
  stage         TEXT,
  sym           TEXT,
  model         TEXT,
  status        TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      REAL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  ms            INTEGER
);
CREATE INDEX IF NOT EXISTS obs_run_idx    ON observations (run_id, started_at);
CREATE INDEX IF NOT EXISTS obs_parent_idx ON observations (parent_id);

CREATE TABLE IF NOT EXISTS observation_bodies (
  observation_id TEXT PRIMARY KEY REFERENCES observations(id),
  body           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  report_id   TEXT,
  source      TEXT NOT NULL,
  verdict     TEXT NOT NULL,
  weight      REAL NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_run_idx ON scores (run_id);

CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  severity    TEXT NOT NULL,
  run_id      TEXT,
  message     TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL,
  ack_at      TEXT
);
CREATE INDEX IF NOT EXISTS alerts_channel_idx ON alerts (channel, created_at);

CREATE TABLE IF NOT EXISTS usage_blocks (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL,
  window_kind   TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL    NOT NULL DEFAULT 0,
  paused_until  TEXT,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_blocks_win_idx ON usage_blocks (channel, window_kind, started_at);

CREATE TABLE IF NOT EXISTS daemon_sessions (
  session_id   TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  meta         TEXT
);

CREATE TABLE IF NOT EXISTS config_versions (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  value       TEXT NOT NULL,
  author      TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS radar_findings (
  id          TEXT PRIMARY KEY,
  project_id  TEXT,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TEXT NOT NULL
);
`;

// Singleton su `global`, non su una `let` di modulo: gli hot-reload del dev
// server di Next ri-valutano il modulo e una `let` aprirebbe un NUOVO handle
// SQLite a ogni reload (accumulo di handle/lock WAL). Su global l'handle è uno
// solo per processo — e la spina è machine-scoped, quindi un handle per daemon.
const gh = global as unknown as { __bugbay_hub_db__?: SqliteDatabase };

/**
 * Apre (una volta per processo) e inizializza la spina machine-scoped.
 * HARD-FAIL: propaga se Node < 22.13 o se il file non si apre (nessun degrade).
 */
export function openHubDb(): SqliteDatabase {
  if (gh.__bugbay_hub_db__) return gh.__bugbay_hub_db__;
  fs.mkdirSync(bugbayHubDir(), { recursive: true });
  const db = openWalDatabase(hubDbPath()); // hard-fail incorporato
  db.exec(HUB_SCHEMA);
  gh.__bugbay_hub_db__ = db;
  return db;
}

/**
 * Esegue `fn` in una transazione ATOMICA sulla spina (BEGIN/COMMIT, ROLLBACK su
 * errore). È il meccanismo con cui una transizione di fase e il suo evento (o un
 * observation + il suo event) commitano insieme — invariante centrale di W0.
 * NB: node:sqlite non annida le transazioni; non chiamare `transact` dentro
 * `transact`. `appendEvent` NON apre una transazione propria, così partecipa a
 * quella ambientale quando invocato dentro `fn`.
 */
export function transact<T>(fn: (db: SqliteDatabase) => T): T {
  const db = openHubDb();
  return sqliteTransact(db, () => fn(db));
}

export interface AppendEventInput {
  run_id: string;
  name: EventName;
  phase_from?: RunPhase | null;
  phase_to?: RunPhase | null;
  payload?: string | null;
  ts?: string;
}

/**
 * INSERT append-only su `events`, ritorna l'id assegnato (= events.id monotono =
 * SSE Last-Event-ID). "INSERT-before-emit": il W1 chiama appendEvent, poi emette
 * sull'SSE con l'id ritornato — mai un emit senza riga persistita.
 * Un singolo INSERT è già atomico; se invocato dentro `transact(fn)` partecipa
 * alla transazione ambientale (stessa connessione singleton).
 */
export function appendEvent(e: AppendEventInput): number {
  const db = openHubDb();
  const res = db
    .prepare(
      'INSERT INTO events (run_id, name, phase_from, phase_to, payload, ts) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      e.run_id,
      e.name,
      e.phase_from ?? null,
      e.phase_to ?? null,
      e.payload ?? null,
      e.ts ?? new Date().toISOString(),
    );
  return Number(res.lastInsertRowid);
}

/** Input di un alert (colonne `alerts` congelate W0). `severity` default 'warn'. */
export interface AppendAlertInput {
  channel: string;
  message: string;
  severity?: string;
  run_id?: string | null;
  detail?: string | null;
}

/**
 * INSERT su `alerts` (riga persistente ack-abile, distinta dall'evento SSE
 * `alert.raised`). Se invocato dentro `transact(fn)` partecipa alla transazione
 * ambientale. Ritorna l'id generato.
 */
export function appendAlert(a: AppendAlertInput): string {
  const db = openHubDb();
  const id = `alert-${a.channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db
    .prepare('INSERT INTO alerts (id, channel, severity, run_id, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, a.channel, a.severity ?? 'warn', a.run_id ?? null, a.message, a.detail ?? null, new Date().toISOString());
  return id;
}

// ── Helper di consumo W1 (differiti da W0) ───────────────────────────────────
// Regola comune ad appendEvent: un singolo INSERT è già atomico; se invocati
// dentro `transact(fn)` partecipano alla transazione ambientale (stessa
// connessione singleton) — es. observation + suo evento nella STESSA txn. Nessuna
// tabella/colonna cambia: qui solo scritture/letture sulle righe già congelate.

// Input del parser (A): i campi NOT NULL (id, run_id, span_kind, name) sono
// obbligatori; i nullable sono opzionali (default null). `started_at` default =
// now(), in parità con `ts` di appendEvent. Derivato dalla riga congelata.
export type ObservationInput = Pick<ObservationRow, 'id' | 'run_id' | 'span_kind' | 'name'> &
  Partial<Omit<ObservationRow, 'id' | 'run_id' | 'span_kind' | 'name'>>;

/**
 * INSERT su `observations` (flat snake_case), ritorna l'id (TEXT fornito dal
 * chiamante — a differenza di events.id AUTOINCREMENT). INSERT-before-emit: il
 * parser scrive l'observation e POI l'evento obs.* con `appendObsEvent`.
 */
export function appendObservation(o: ObservationInput): string {
  const db = openHubDb();
  db
    .prepare(
      `INSERT INTO observations
         (id, run_id, parent_id, span_kind, name, stage, sym, model, status,
          input_tokens, output_tokens, cost_usd, started_at, ended_at, ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      o.id,
      o.run_id,
      o.parent_id ?? null,
      o.span_kind,
      o.name,
      o.stage ?? null,
      o.sym ?? null,
      o.model ?? null,
      o.status ?? null,
      o.input_tokens ?? null,
      o.output_tokens ?? null,
      o.cost_usd ?? null,
      o.started_at ?? new Date().toISOString(),
      o.ended_at ?? null,
      o.ms ?? null,
    );
  return o.id;
}

/**
 * UPSERT del corpo pesante di un'observation in `observation_bodies` (stesso DB).
 * observation_id è PK: un secondo write (es. corpo aggiornato a fine span) fa
 * UPDATE invece di violare la PK. Un solo statement, nessuna transazione propria.
 */
export function appendObservationBody(observation_id: string, body: string): void {
  const db = openHubDb();
  db
    .prepare(
      `INSERT INTO observation_bodies (observation_id, body) VALUES (?, ?)
       ON CONFLICT(observation_id) DO UPDATE SET body = excluded.body`,
    )
    .run(observation_id, body);
}

/**
 * Emette l'evento obs.started / obs.ended legato a un'observation. `events` non ha
 * colonna observation_id: l'id dell'observation viaggia nel `payload` (JSON) —
 * `{ observation_id, ...payload }` — così i consumer SSE mappano evento→observation.
 * Ritorna events.id (= SSE Last-Event-ID). Riusa `appendEvent` (INSERT-before-emit).
 */
export function appendObsEvent(
  runId: string,
  kind: 'started' | 'ended',
  observationId: string,
  payload?: Record<string, unknown>,
): number {
  return appendEvent({
    run_id: runId,
    name: kind === 'started' ? 'obs.started' : 'obs.ended',
    payload: JSON.stringify({ observation_id: observationId, ...(payload ?? {}) }),
  });
}

/**
 * Replay dell'SSE: eventi con id > `lastEventId`, opz. filtrati per run, ORDER BY
 * id ASC (monotono). È ciò che il server emette dopo un reconnect con l'header
 * Last-Event-ID. `lastEventId = 0` → dall'inizio. Colonne esplicite = EventRow.
 */
export function getEventsSince(lastEventId: number, runId?: string): EventRow[] {
  const db = openHubDb();
  const rows = runId
    ? db
        .prepare(
          'SELECT id, run_id, name, phase_from, phase_to, payload, ts FROM events WHERE id > ? AND run_id = ? ORDER BY id ASC',
        )
        .all(lastEventId, runId)
    : db
        .prepare(
          'SELECT id, run_id, name, phase_from, phase_to, payload, ts FROM events WHERE id > ? ORDER BY id ASC',
        )
        .all(lastEventId);
  return rows as EventRow[];
}

/** Id massimo corrente in `events` (0 se vuota): cursore di partenza di un nuovo stream. */
export function getMaxEventId(): number {
  const db = openHubDb();
  const row = db.prepare('SELECT MAX(id) AS max_id FROM events').get() as
    | { max_id: number | null }
    | undefined;
  return row?.max_id ?? 0;
}

// Input dei verdetti: NOT NULL (id, run_id, source, verdict, weight) obbligatori;
// report_id/detail opzionali (default null); created_at default = now().
export type ScoreInput = Pick<ScoreRow, 'id' | 'run_id' | 'source' | 'verdict' | 'weight'> &
  Partial<Omit<ScoreRow, 'id' | 'run_id' | 'source' | 'verdict' | 'weight'>>;

/**
 * INSERT su `scores` (verdetto HUMAN/JUDGE/IMPLICIT), ritorna l'id. Solo il writer:
 * l'eventuale evento `score.recorded` lo emette il chiamante (nella stessa
 * `transact()` se serve l'atomicità scrittura+evento), non questo helper.
 *
 * INNESCO DISTILLAZIONE (v0.8): questo è il collo di bottiglia PIÙ STRETTO dove
 * ogni verdetto viene registrato, quindi il hook `onVerdict` è cablato qui UNA
 * volta (fan-out: i track non lo replicano). `onVerdict` è fire-and-forget e
 * non-throwing (dispaccia in `setImmediate`, post-commit); il try/catch è
 * cintura+bretelle: la distillazione non deve MAI rompere la scrittura dello score.
 */
export function addScore(s: ScoreInput): string {
  const db = openHubDb();
  db
    .prepare(
      `INSERT INTO scores (id, run_id, report_id, source, verdict, weight, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      s.id,
      s.run_id,
      s.report_id ?? null,
      s.source,
      s.verdict,
      s.weight,
      s.detail ?? null,
      s.created_at ?? new Date().toISOString(),
    );
  try {
    onVerdict(s.run_id, {
      source: s.source,
      verdict: s.verdict,
      reportId: s.report_id ?? null,
      detail: s.detail ?? null,
    });
  } catch {
    /* la distillazione non deve mai rompere la registrazione del verdetto */
  }
  return s.id;
}

// ── Getter READ-ONLY della console-hub (v0.6 Wave-2) ─────────────────────────
// Additivi: nessuna tabella/colonna cambia, nessuna firma esistente toccata.
// La console li consuma SEMPRE dietro una API route (i client non importano mai
// questo modulo, che tira dentro fs/node:sqlite). SELECT su colonne esplicite =
// *Row tipizzate; zero scritture sulla spina.

/** Riga `runs` grezza (phase autoritativa + timestamps di riga) per un runId, o undefined. */
export function getRunRow(runId: string): RunRow | undefined {
  const db = openHubDb();
  const row = db
    .prepare(
      'SELECT id, report_id, project_id, phase, branch, session_id, data, created_at, updated_at FROM runs WHERE id = ?',
    )
    .get(runId);
  return (row as RunRow | undefined) ?? undefined;
}

/**
 * Observations di una run, ORDER BY started_at ASC (poi id per stabilità a parità
 * di timestamp). L'albero per `parent_id` lo ricostruisce il chiamante (la UI):
 * qui si ritorna la sequenza piatta già ordinata cronologicamente.
 */
export function getObservations(runId: string): ObservationRow[] {
  const db = openHubDb();
  const rows = db
    .prepare(
      `SELECT id, run_id, parent_id, span_kind, name, stage, sym, model, status,
              input_tokens, output_tokens, cost_usd, started_at, ended_at, ms
         FROM observations WHERE run_id = ? ORDER BY started_at ASC, id ASC`,
    )
    .all(runId);
  return rows as ObservationRow[];
}

/** Corpo pesante di una observation (prompt/diff/stdout), o null se assente/non caricato. */
export function getObservationBody(observationId: string): string | null {
  const db = openHubDb();
  const row = db
    .prepare('SELECT body FROM observation_bodies WHERE observation_id = ?')
    .get(observationId) as { body: string } | undefined;
  return row?.body ?? null;
}

/**
 * Id delle observations di una run che HANNO un corpo pesante: la UI mostra
 * l'affordance di espansione senza spedire i corpi (fetch lazy per singolo id).
 */
export function getObservationBodyIds(runId: string): string[] {
  const db = openHubDb();
  const rows = db
    .prepare(
      `SELECT observation_id FROM observation_bodies
        WHERE observation_id IN (SELECT id FROM observations WHERE run_id = ?)`,
    )
    .all(runId) as { observation_id: string }[];
  return rows.map((r) => r.observation_id);
}

/** Tutti gli eventi di una run, ORDER BY id ASC (monotono): la striscia eventi del detail. */
export function getEventsForRun(runId: string): EventRow[] {
  return getEventsSince(0, runId);
}
