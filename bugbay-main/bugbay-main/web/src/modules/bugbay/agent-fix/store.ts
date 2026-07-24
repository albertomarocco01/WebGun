/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Store delle run del fix agentico, persistito su disco per sopravvivere agli
 * hot-reload del dev server di Next (che azzererebbero uno stato in memoria e
 * bloccherebbero il polling).
 *
 * Backend v0.6 (Wave 0): la SPINA machine-scoped `~/.bugbay/hub.sqlite` (node:
 * sqlite, WAL) — tabella `runs`, AUTORITÀ dello stato. Il blob `AgentRun` resta
 * in `runs.data` (campi non-spina, compat), mentre `runs.phase` è la colonna
 * autoritativa. NIENTE fallback JSON: un guasto di storage emerge RUMOROSO
 * (openHubDb hard-fail). Il per-riga resta il motivo di SQLite: log/updateRun
 * toccano UNA riga (O(1)) invece di riscrivere l'intero blob (O(n) su tutte le
 * run). INVARIANTE: una transizione di fase e il suo evento `events` commitano
 * nella STESSA `transact()` — qui `update()`/`set()` lo fanno automaticamente,
 * così ogni chiamante esistente eredita la garanzia senza cambiare firma.
 * Migrazione una-tantum idempotente del vecchio `.bugbay/agent-runs.sqlite`
 * per-repo dentro la spina. File dati gitignored. Più run convivono.
 *
 * @indice
 * - getSettings / saveSettings        → impostazioni agente (piccolo file JSON a parte)
 * - getRun / setRun / updateRun / log → accesso allo store (per-riga)
 * - getActiveRuns / getVisibleRuns    → run per la re-idratazione UI
 * - hasActiveRunFor                   → idempotenza per segnalazione
 * - sanitizeRunsOnStartup             → rimette in coda le run interrotte da un riavvio
 */

import { bugbayDataDir } from './target-root';
import { cleanupTscBuildInfo, pruneOrphanBuildInfo } from './exec';
import { openWalDatabase, transact as sqliteTransact, type SqliteDatabase } from './sqlite';
import { openHubDb, transact as hubTransact, appendEvent, appendAlert } from './hub';
import { reapOrphans } from './process-registry';
import fs from 'fs';
import path from 'path';
import type { AgentRun, RunPhase } from './types';
import * as git from './git';

// Cartella dei dati di runtime (run + impostazioni), fonte unica in target-root.
const DATA_DIR = bugbayDataDir();
const RUNS_FILE = path.join(DATA_DIR, '.agent-fix-runs.json');
const RUNS_DB = path.join(DATA_DIR, 'agent-runs.sqlite');
const SETTINGS_FILE = path.join(DATA_DIR, '.agent-settings.json');
const TERMINAL = ['approved', 'discarded', 'aborted', 'error'];

/* ── STATE-MACHINE delle fasi: grafo delle transizioni LEGALI (TRACK C) ───────
 * Derivato da come esecuzione.ts + runner.ts pilotano davvero le fasi, NON dalla
 * lista teorica. Ogni chiave è una fase sorgente; il set è l'insieme delle fasi
 * destinazione raggiungibili con UNA transizione. Modello (principiato, così il
 * grafo resta leggibile e non una lista piatta di archi):
 *
 *  1) FLUSSO automatico del workflow (dispatcher → interprete → fixer → gate → review):
 *       queued→interpreting|fixing · interpreting→needs_clarification|fixing|queued ·
 *       needs_clarification→queued · fixing→verifying|queued · verifying→review|fixing|queued ·
 *       review→approved|queued (rifiuto) · paused→queued (ripresa) · error→queued (rilancio).
 *  2) USCITE di lifecycle guidate dall'utente, disponibili da ~ogni fase NON terminale:
 *       → aborted   (abortRun, da ogni non-terminale)
 *       → discarded (discard,  da ogni non-terminale)
 *       → error     (sink di fallimento: un'eccezione in qualunque fase attiva)
 *       → paused    (pauseRun, da ogni non-terminale tranne `error`, che si rilancia)
 *
 * TERMINALI VERI (nessun arco uscente): approved, discarded, aborted — una run
 * conclusa NON può essere resuscitata (una transizione da qui è un bug → rifiutata).
 * `error` è recuperabile: solo → queued (rilancio) / aborted / discarded.
 * Le auto-transizioni (X→X) NON passano di qui: `update()` valida solo quando la
 * fase CAMBIA davvero, così log/trace/addUsage e i patch di soli dati restano no-op.
 */
const LEGAL_TRANSITIONS: Record<RunPhase, readonly RunPhase[]> = {
  queued:              ['interpreting', 'fixing', 'aborted', 'discarded', 'error', 'paused'],
  interpreting:        ['needs_clarification', 'fixing', 'queued', 'aborted', 'discarded', 'error', 'paused'],
  needs_clarification: ['queued', 'aborted', 'discarded', 'error', 'paused'],
  fixing:              ['verifying', 'queued', 'aborted', 'discarded', 'error', 'paused'],
  verifying:           ['review', 'fixing', 'queued', 'aborted', 'discarded', 'error', 'paused'],
  review:              ['approved', 'queued', 'aborted', 'discarded', 'error', 'paused'],
  paused:              ['queued', 'aborted', 'discarded', 'error'],
  error:               ['queued', 'aborted', 'discarded'],
  approved:            [],
  discarded:           [],
  aborted:             [],
};

/** True se `from → to` è una transizione di fase LEGALE (`from === to` è sempre lecito). */
/**
 * Registra un tentativo di transizione ILLECITA (rifiutato): log stderr + evento SSE
 * `alert.raised` (canale watchdog) + riga `alerts` ack-abile — tutto nella txn
 * ambientale. Prima l'alert viveva SOLO nell'SSE, invisibile alle query su `alerts`.
 */
function recordIllegalTransition(runId: string, from: RunPhase, to: RunPhase): void {
  console.error(`[bugbay][store] transizione di fase ILLECITA rifiutata per la run ${runId}: ${from} → ${to} (no-op).`);
  const payload = JSON.stringify({ channel: 'watchdog', kind: 'illegal_transition', from, to });
  appendEvent({ run_id: runId, name: 'alert.raised', phase_from: from, phase_to: to, payload });
  appendAlert({ channel: 'watchdog', severity: 'warn', run_id: runId, message: `Transizione illecita rifiutata: ${from} → ${to}`, detail: payload });
}

function isLegalTransition(from: RunPhase, to: RunPhase): boolean {
  if (from === to) return true;
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

export interface AgentSettings {
  provider: 'claude-headless' | 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepseekApiKey?: string;
  /**
   * API key Anthropic OPZIONALE: fast-path REST (Haiku, ~1-3s) per i task di
   * solo testo (riformulazioni, giudice). Senza, si usa la CLI headless.
   */
  anthropicApiKey?: string;
  /** Numero massimo di run agentiche eseguite in parallelo (default 2). */
  maxParallelRuns?: number;
}

export function getSettings(): AgentSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return { provider: 'claude-headless' };
}

export function saveSettings(settings: AgentSettings): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${SETTINGS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf-8');
    fs.renameSync(tmp, SETTINGS_FILE);
  } catch {
    // ignore
  }
}

/* ── Backend delle run: tabella `runs` della SPINA hub.sqlite (per-riga) ──────
 * Interfaccia comune. `update` fa un read-modify-write ATOMICO di UNA riga
 * dentro una `transact()` della spina: la funzione riceve lo stato corrente e ne
 * ritorna il nuovo; se ritorna lo STESSO riferimento non viene scritto nulla
 * (dedup di log). INVARIANTE W0: se `phase` cambia, l'UPDATE della riga e
 * l'INSERT del suo evento `run.transition` commitano NELLA STESSA transazione. */
interface RunBackend {
  get(runId: string): AgentRun | undefined;
  set(run: AgentRun): void;
  update(runId: string, fn: (cur: AgentRun) => AgentRun): AgentRun | undefined;
  all(): AgentRun[];
  remove(runIds: string[]): void;
}

// Path legacy per-repo (spina v0.5): sorgenti della migrazione una-tantum.
const LEGACY_RUNS_DB = RUNS_DB;           // .bugbay/agent-runs.sqlite (tabella agent_runs)
const LEGACY_RUNS_JSON = RUNS_FILE;       // .bugbay/.agent-fix-runs.json (blob ancora più vecchio)
const MIGRATION_MARKER = path.join(DATA_DIR, '.agent-runs.migrated'); // guardia per-repo

const parse = (row: unknown): AgentRun | undefined => {
  try { return JSON.parse((row as { data: string }).data) as AgentRun; } catch { return undefined; }
};

// Colonne-spina estratte dal blob per la riga `runs` (phase è autoritativa).
const RUN_UPSERT_SQL = `INSERT INTO runs
  (id, report_id, project_id, phase, branch, session_id, data, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    report_id  = excluded.report_id,
    project_id = excluded.project_id,
    phase      = excluded.phase,
    branch     = excluded.branch,
    session_id = excluded.session_id,
    data       = excluded.data,
    updated_at = excluded.updated_at`;

function runUpsertArgs(run: AgentRun): unknown[] {
  const now = new Date().toISOString();
  return [
    run.runId,
    run.reportId,
    run.projectId ?? null,
    run.phase,
    run.branch ?? null,
    run.sessionId ?? null,
    JSON.stringify(run),
    run.createdAt ?? now,
    now,
  ];
}

/**
 * Migrazione una-tantum, IDEMPOTENTE e PER-REPO, delle vecchie run nella spina.
 * Sorgente: `.bugbay/agent-runs.sqlite` (tabella agent_runs) o, in mancanza, il
 * blob JSON ancora precedente. `INSERT ... ON CONFLICT DO NOTHING` rende sicuro
 * un secondo passaggio (più repo scrivono nella stessa spina). Un marker per-repo
 * evita il ri-innesco; le sorgenti vengono ritirate (rinominate) a fine import.
 * Best-effort MA RUMOROSO: se fallisce, NON scrive il marker (riprova al prossimo
 * boot, l'ON CONFLICT lo rende innocuo) e logga su stderr — non fa brickare il
 * daemon (la spina nuova funziona comunque), ma l'errore resta visibile.
 */
function migrateLegacyRuns(hub: SqliteDatabase): void {
  if (fs.existsSync(MIGRATION_MARKER)) return;
  try {
    const toImport: AgentRun[] = [];
    if (fs.existsSync(LEGACY_RUNS_DB)) {
      const old = openWalDatabase(LEGACY_RUNS_DB);
      try {
        for (const row of old.prepare('SELECT data FROM agent_runs').all()) {
          const r = parse(row);
          if (r?.runId) toImport.push(r);
        }
      } finally {
        try { old.close(); } catch { /* già chiuso */ }
      }
    } else if (fs.existsSync(LEGACY_RUNS_JSON)) {
      const blob = JSON.parse(fs.readFileSync(LEGACY_RUNS_JSON, 'utf-8')) as Record<string, AgentRun>;
      for (const r of Object.values(blob)) if (r?.runId) toImport.push(r);
    }
    if (toImport.length) {
      const ins = hub.prepare(`INSERT INTO runs
        (id, report_id, project_id, phase, branch, session_id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING`);
      sqliteTransact(hub, () => { for (const run of toImport) ins.run(...runUpsertArgs(run)); });
    }
    // Ordine: prima il marker (l'import è già committato), poi ritiro le sorgenti.
    fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString(), 'utf-8');
    for (const f of [LEGACY_RUNS_DB, LEGACY_RUNS_JSON]) {
      if (fs.existsSync(f)) { try { fs.renameSync(f, `${f}.migrated`); } catch { /* ritiro best-effort */ } }
    }
  } catch (e) {
    // RUMOROSO ma non fatale: marker NON scritto → riprova (ON CONFLICT = innocuo).
    console.error('[bugbay] migrazione run legacy → hub.sqlite fallita (riprovo al prossimo avvio):', e);
  }
}

function createRunBackend(): RunBackend {
  const db = openHubDb(); // hard-fail su Node < 22.13 o storage non apribile
  migrateLegacyRuns(db);

  const getStmt = db.prepare('SELECT data FROM runs WHERE id = ?');
  const allStmt = db.prepare('SELECT data FROM runs');
  const upsertStmt = db.prepare(RUN_UPSERT_SQL);
  // Cancellazione: le FK (events/observations/scores → runs) impongono di togliere
  // prima i figli. In W0 solo `events` viene scritto, ma ripuliamo tutti i figli
  // per restare corretti anche quando W1+ popolerà observations/scores.
  const delBodies = db.prepare(
    'DELETE FROM observation_bodies WHERE observation_id IN (SELECT id FROM observations WHERE run_id = ?)',
  );
  const delObs = db.prepare('DELETE FROM observations WHERE run_id = ?');
  const delEvents = db.prepare('DELETE FROM events WHERE run_id = ?');
  const delScores = db.prepare('DELETE FROM scores WHERE run_id = ?');
  const delRun = db.prepare('DELETE FROM runs WHERE id = ?');

  return {
    get(runId) {
      const row = getStmt.get(runId);
      return row ? parse(row) : undefined;
    },
    set(run) {
      // Nascita run (o overwrite): riga + evento nella STESSA txn.
      hubTransact(() => {
        const prevRow = getStmt.get(run.runId);
        if (!prevRow) {
          upsertStmt.run(...runUpsertArgs(run));
          appendEvent({ run_id: run.runId, name: 'run.created', phase_from: null, phase_to: run.phase });
          return;
        }
        // Overwrite: valida la legalità come update() — senza, setRun() poteva saltare
        // la state-machine (anche rianimare un terminale) senza no-op del watchdog.
        const prevPhase = parse(prevRow)?.phase;
        if (prevPhase !== undefined && prevPhase !== run.phase && !isLegalTransition(prevPhase, run.phase)) {
          // Rifiuta il salto di fase, ma conserva i dati del patch (riscrive con la fase
          // PRECEDENTE); alert; niente run.transition.
          upsertStmt.run(...runUpsertArgs({ ...run, phase: prevPhase }));
          recordIllegalTransition(run.runId, prevPhase, run.phase);
          return;
        }
        upsertStmt.run(...runUpsertArgs(run));
        // Overwrite che cambia fase (lecito): transizione + evento nella STESSA txn (W0).
        if (prevPhase !== undefined && prevPhase !== run.phase) {
          appendEvent({ run_id: run.runId, name: 'run.transition', phase_from: prevPhase, phase_to: run.phase });
        }
      });
    },
    update(runId, fn) {
      return hubTransact(() => {
        const row = getStmt.get(runId);
        const cur = row ? parse(row) : undefined;
        if (!cur) return undefined;
        const next = fn(cur);
        if (next === cur) return next; // ref uguale = no-op (dedup log): nessuna scrittura, nessun evento
        // VALIDAZIONE state-machine (TRACK C): una transizione di fase ILLECITA
        // viene RIFIUTATA — no-op RUMOROSO. La riga NON viene riscritta (fase e
        // dati del patch restano invariati), si logga su stderr e si emette un
        // evento `alert.raised` (canale watchdog) NELLA STESSA transazione, così
        // la sequenza dell'SSE registra il tentativo illecito. Le auto-transizioni
        // (fase invariata) non arrivano qui: passano diritte al ramo di scrittura.
        if (next.phase !== cur.phase && !isLegalTransition(cur.phase, next.phase)) {
          recordIllegalTransition(runId, cur.phase, next.phase);
          // NON scartare l'intero patch: applica i campi NON-fase (es. error/sessionId
          // bundlati con la fase illecita) tenendo la fase PRECEDENTE. Nessun
          // run.transition (la fase resta invariata).
          const corrected = { ...next, phase: cur.phase };
          upsertStmt.run(...runUpsertArgs(corrected));
          return corrected;
        }
        upsertStmt.run(...runUpsertArgs(next));
        // INVARIANTE W0: transizione di fase + suo evento nella STESSA transazione.
        if (next.phase !== cur.phase) {
          appendEvent({ run_id: runId, name: 'run.transition', phase_from: cur.phase, phase_to: next.phase });
        }
        return next;
      });
    },
    all() {
      return (allStmt.all() as unknown[]).map(parse).filter((r): r is AgentRun => !!r);
    },
    remove(runIds) {
      hubTransact(() => {
        for (const id of runIds) {
          delBodies.run(id);
          delObs.run(id);
          delEvents.run(id);
          delScores.run(id);
          delRun.run(id);
        }
      });
    },
  };
}

// Singleton su `global`, non su una `let` di modulo: gli hot-reload del dev
// server di Next ri-valutano il modulo e una `let` ricreerebbe il backend a ogni
// reload. Su global il backend (e l'handle spina sotto) è uno solo per processo.
const gb = global as unknown as { __bugbay_run_backend__?: RunBackend };
function rb(): RunBackend {
  if (gb.__bugbay_run_backend__) return gb.__bugbay_run_backend__;
  gb.__bugbay_run_backend__ = createRunBackend();
  return gb.__bugbay_run_backend__;
}

export function setRun(run: AgentRun): void {
  rb().set(run);
}

export function getRun(runId: string): AgentRun | undefined {
  return rb().get(runId);
}

export function updateRun(runId: string, patch: Partial<AgentRun>): AgentRun | undefined {
  return rb().update(runId, (cur) => ({ ...cur, ...patch }));
}

/** Accumula token/costo di una chiamata LLM sulla telemetria della run. */
export function addUsage(runId: string, usage: { inputTokens: number; outputTokens: number; costUsd: number }): void {
  rb().update(runId, (cur) => {
    const prev = cur.usage ?? { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0 };
    return {
      ...cur,
      usage: {
        inputTokens: prev.inputTokens + (usage.inputTokens || 0),
        outputTokens: prev.outputTokens + (usage.outputTokens || 0),
        calls: prev.calls + 1,
        costUsd: prev.costUsd + (usage.costUsd || 0),
      },
    };
  });
}

/** Tetto di righe di log per run: oltre, si scartano le più vecchie (lo store non
 *  può crescere all'infinito; un eventuale loop di log non lo fa esplodere). */
const LOG_CAP = 1000;

export function log(runId: string, line: string): void {
  rb().update(runId, (cur) => {
    // Dedup: se il messaggio è identico all'ultimo (timestamp a parte) NON si
    // riscrive nulla — ritornare lo stesso riferimento segnala "no-op" al backend.
    const last = cur.log[cur.log.length - 1];
    if (last && last.slice(last.indexOf('] ') + 2) === line) return cur;
    const log = [...cur.log, `[${new Date().toLocaleTimeString('it-IT')}] ${line}`];
    if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
    return { ...cur, log };
  });
}

/** Tetto di eventi timeline per run (osservabilità, mai crescita illimitata). */
const TIMELINE_CAP = 300;

/**
 * Observability: registra un evento SIMBOLICO nella timeline tipizzata della run
 * E nel log leggibile (stessa riga, prefissata dal simbolo) — la UI esistente lo
 * mostra subito, la timeline resta interrogabile. Vocabolario simboli in types.ts.
 */
export function trace(
  runId: string,
  sym: string,
  stage: string,
  msg: string,
  meta?: { ms?: number; model?: string },
): void {
  rb().update(runId, (cur) => {
    const ev = { ts: new Date().toISOString(), sym, stage, msg, ...(meta?.ms ? { ms: meta.ms } : {}), ...(meta?.model ? { model: meta.model } : {}) };
    const timeline = [...(cur.timeline ?? []), ev];
    if (timeline.length > TIMELINE_CAP) timeline.splice(0, timeline.length - TIMELINE_CAP);
    const extra = [meta?.model, meta?.ms ? `${(meta.ms / 1000).toFixed(1)}s` : ''].filter(Boolean).join(' · ');
    const line = `${sym} [${stage}] ${msg}${extra ? ` (${extra})` : ''}`;
    const last = cur.log[cur.log.length - 1];
    const log = last && last.slice(last.indexOf('] ') + 2) === line
      ? cur.log
      : [...cur.log, `[${new Date().toLocaleTimeString('it-IT')}] ${line}`];
    if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
    return { ...cur, timeline, log };
  });
}

// Ordine stabile per createdAt: `all()` legge le righe `runs` senza ORDER BY,
// quindi ordiniamo esplicitamente in JS per un output deterministico (il campo
// createdAt vive nel blob, non è garantito l'ordine fisico delle righe).
const byCreatedAsc = (a: AgentRun, b: AgentRun) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Run non concluse, per ricostruire lo stato della UI dopo un refresh. */
export function getActiveRuns(): AgentRun[] {
  return rb().all().filter((r) => !TERMINAL.includes(r.phase)).sort(byCreatedAsc);
}

/**
 * Run visibili nella UI: tutte tranne quelle chiuse senza interesse
 * (le run in `error` restano visibili — la riga deve poterle mostrare/rilanciare).
 */
export function getVisibleRuns(): AgentRun[] {
  const hidden = ['approved', 'discarded', 'aborted'];
  return rb().all().filter((r) => !hidden.includes(r.phase)).sort(byCreatedAsc);
}

/** Tutte le run, comprese quelle concluse (per lo storico/gestione agenti). */
export function getAllRuns(): AgentRun[] {
  return rb().all().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** True se esiste una run non conclusa per quella segnalazione (idempotenza). */
export function hasActiveRunFor(reportId: string): AgentRun | undefined {
  return rb().all().find(
    (r) => r.reportId === reportId && !TERMINAL.includes(r.phase),
  );
}

export function deleteRuns(runIds: string[]): void {
  rb().remove(runIds);
  // La cache tsc per-run non serve più: rimuovila per non far crescere .cache.
  for (const id of runIds) cleanupTscBuildInfo(id);
}

export function sanitizeRunsOnStartup(): void {
  try {
    // Le run con un processo in volo muoiono col riavvio. Invece di metterle in
    // PAUSA (dove sparivano dalla strip e richiedevano una ripresa manuale), le
    // rimettiamo in CODA per la ripresa AUTOMATICA: ricompaiono subito nella
    // Sala Macchine e il dispatcher le riprende al primo tick del poller.
    // Prima però annulliamo le loro modifiche PARZIALI in scope (mai il lavoro
    // non committato dell'utente, protetto da preDirty) così la ripresa riparte
    // da un albero pulito e non lascia mezzi-edit orfani.
    const activePhases = ['interpreting', 'fixing', 'verifying'];
    for (const run of rb().all()) {
      if (!activePhases.includes(run.phase)) continue;
      try {
        if (run.preDirty) {
          const pre = new Set(run.preDirty);
          const orfani = git.changedFiles().filter((f) => !pre.has(f) && run.scopedFiles.includes(f));
          if (orfani.length) git.restoreFiles(orfani);
        }
      } catch {
        /* ripristino best-effort: se git non è disponibile, si riprende comunque */
      }
      rb().update(run.runId, (cur) => ({
        ...cur,
        phase: 'queued',
        error: undefined,
        log: [...cur.log, `[${new Date().toLocaleTimeString('it-IT')}] Server riavviato: modifiche parziali annullate, run rimessa in coda per la ripresa automatica.`],
      }));
    }
  } catch {
    // ignore
  }
}

// Pulizia automatica al caricamento del modulo, una sola volta per processo
// (evita interruzioni da hot-reload). store.ts è importato da quasi tutte le API
// route → il reaper degli orfani gira al primo hit dopo un riavvio.
const g = global as unknown as { __runs_sanitized__?: boolean };
if (!g.__runs_sanitized__) {
  g.__runs_sanitized__ = true;
  try { reapOrphans(); } catch { /* best-effort */ }
  try { sanitizeRunsOnStartup(); } catch { /* ignore */ }
  // Pota i tsbuildinfo delle run non più attive (crescita limitata).
  try { pruneOrphanBuildInfo(getActiveRuns().map((r) => r.runId)); } catch { /* best-effort */ }
}
