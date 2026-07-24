/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CONTRATTO MINI-FREEZE v0.7 — ledger duale del budget + firma del breaker.
 * Questo file è la SUPERFICIE CONDIVISA su cui si bindano i track di fan-out v0.7:
 *   • L (Ledger duale)  → IMPLEMENTA `budgetGate` + materializza `usage_blocks`
 *                          (block 5h + weekly rollup), dedup `daemon_sessions`,
 *                          park `session_id` → `paused_until`. Scrive tramite le
 *                          primitive CRUD qui sotto.
 *   • S (Scheduler)     → GATE: chiama `budgetGate(channel)` ai siti dispatch/poll
 *                          (runner.ts dispatchQueue/watchTick, audits.ts auditTick)
 *                          e mette in pausa il canale finché `pausedUntil`.
 *   • R (Routing)       → legge/scrive `config_versions` scope='routing' per l'audit
 *                          trail delle decisioni deterministiche di chooseModel.
 *
 * FREEZE (immutabile dopo questo slice — L/S/R vi si bindano):
 *   • `BudgetChannel`   — granularità dei canali di SPESA, derivata dai DUE loop di
 *                          dispatch del daemon (NON dai ruoli-modello: interprete/
 *                          repro/giudice/piano sono sotto-fasi di UNA run 'fixer').
 *   • `budgetGate(channel): { ok, pausedUntil }` — firma SINCRONA del breaker.
 *     STUB in questo slice: ritorna sempre `{ ok: true, pausedUntil: null }`.
 *     Track L ne sostituisce il corpo SENZA cambiare la firma.
 *   • i tipi-riga di `usage_blocks` / `daemon_sessions` / `config_versions`
 *     (ri-esportati da hub.ts = single source, + i narrow `WindowKind`/`ConfigScope`).
 *
 * ADDITIVO: NON tocca la superficie esistente di hub.ts. Le primitive CRUD qui
 * girano sulle colonne GIÀ CONGELATE in v0.6 (Appendice A) via `openHubDb()` —
 * un singolo INSERT/UPSERT è atomico. La SEMANTICA di alto livello (mapping dei
 * totali ccusage → canali, riserva umana, algoritmo del blocco 5h, breaker) resta
 * a Track L: qui si freeza solo il CRUD tipizzato di riga, non la policy.
 *
 * @indice
 * - BudgetChannel / WindowKind / ConfigScope → vocabolari congelati del ledger
 * - UsageBlockRow / DaemonSessionRow / ConfigVersionRow → tipi-riga (re-export hub)
 * - budgetGate                → breaker per-canale (IMPLEMENTATO da Track L)
 * - readUsageBlock / listUsageBlocks / upsertUsageBlock / setUsageBlockPause → usage_blocks CRUD (L materializza, S gate)
 * - getDaemonSession / upsertDaemonSession / touchDaemonSession → daemon_sessions dedup (L)
 * - getLatestConfig / appendConfigVersion → config_versions audit trail (R/L)
 *
 * @indice (implementazione Track L — ledger duale, additivo sotto le primitive)
 * - refreshLedger         → (ri)materializza usage_blocks da ccusage/JSONL (tick di S o lazy)
 * - getBudgetConfig       → config budget corrente (scope='budget'), seed dei preset se assente
 * - parkRun / listResumableSessions / clearPark → park del session_id → --resume post-reset (zero re-spend)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { openHubDb, transact } from './hub';
import type { UsageBlockRow, DaemonSessionRow, ConfigVersionRow } from './hub';
import { costFromTokens, type TokenUsage } from './vendor/pricing';
import { identifySessionBlocks, SESSION_DURATION_MS, type UsageEntry } from './vendor/ccusage-blocks';
import { isUsageDrift } from './usage-drift';

// Tipi-riga: single source in hub.ts (congelati con lo schema, Appendice A).
// Ri-esportati qui così L/S/R importano tutto il contratto ledger da un solo modulo.
export type { UsageBlockRow, DaemonSessionRow, ConfigVersionRow } from './hub';

// ── Vocabolari congelati ─────────────────────────────────────────────────────

/**
 * Canali di SPESA del budget — granularità del breaker `budgetGate`.
 * Derivata dai DUE loop di dispatch del daemon che spendono contro la quota
 * Anthropic (block 5h + weekly), NON dai ruoli-modello:
 *   • 'fixer' → pipeline di fix-run (runner.ts: dispatchQueue + watchTick).
 *               Interprete/repro/fix/repair/giudice sono sotto-fasi di UNA run
 *               dispatchata: rollano tutte qui.
 *   • 'audit' → loop degli audit schedulati (audits.ts: auditTick).
 * Gate per-canale = shedding a zone: si può fermare 'audit' (basso valore) prima
 * di 'fixer' (alto valore) man mano che la weekly con riserva-umana si esaurisce.
 * NB: la quota è condivisa con l'uso interattivo UMANO di Claude Code (misurato
 * anch'esso da ccusage): la "riserva umana" NON è un canale — è la frazione di
 * quota che Track L sottrae alla soglia del gate. Il gate NON mette mai in pausa
 * l'umano (fuori dal daemon).
 */
export type BudgetChannel = 'fixer' | 'audit';

/** Finestra del ledger duale (usage_blocks.window_kind). Weekly = vincolo 24/7. */
export type WindowKind = 'block_5h' | 'weekly';

/** Scope dell'audit trail config (config_versions.scope). */
export type ConfigScope = 'routing' | 'budget' | 'threshold';

// ── Firma del breaker (CONGELATA; stub in questo slice) ──────────────────────

/**
 * Breaker di budget per-canale. FIRMA CONGELATA: S la chiama ai siti dispatch/poll
 * e mette in pausa il canale quando `ok === false` fino a `pausedUntil` (ISO).
 * `ok:true, pausedUntil:null` = via libera. `ok:false` con `pausedUntil` = parcheggia
 * fino al prossimo reset; `ok:false, pausedUntil:null` = breaker aperto per budget
 * UNKNOWN (es. parse-failure ccusage) — NON riparte da solo, richiede intervento.
 *
 * IMPLEMENTAZIONE (Track L): materializza lazy il ledger da ccusage/JSONL (throttle),
 * poi confronta l'uso TOTALE (umano+daemon) della finestra corrente col cap effettivo
 * del canale = cap × (1 − riserva-umana, solo weekly) × zona-canale. Fail-safe: su
 * budget UNKNOWN o QUALSIASI errore → breaker CHIUSO (mai via libera sull'ignoto).
 */
export function budgetGate(channel: BudgetChannel): { ok: boolean; pausedUntil: string | null } {
  try {
    ensureFresh();
    if (ledgerCache().unknown) return { ok: false, pausedUntil: null };
    return computeGate(channel);
  } catch (e) {
    // Mai contare zero su un errore imprevisto: breaker chiuso + alert (throttle).
    ledgerCache().unknown = true;
    maybeAlert(e);
    return { ok: false, pausedUntil: null };
  }
}

// ── Primitive CRUD di riga (additive, colonne v0.6 congelate) ────────────────
// Thin CRUD tipizzato: L materializza / S ispeziona. NIENTE policy (algoritmo
// blocco 5h, mapping ccusage→canale, riserva) — quella vive in Track L.
// `channel` resta `string` (colonna TEXT): L sceglie le chiavi di materializzazione
// (può servire una riga-totale distinta dai canali-gate); `budgetGate` è la
// superficie tipizzata `BudgetChannel` che S consuma.

/** Input di UPSERT su usage_blocks: `id` (PK) obbligatorio; token/costo default 0. */
export type UsageBlockUpsert = Pick<UsageBlockRow, 'id' | 'channel' | 'window_kind' | 'started_at' | 'ends_at'> &
  Partial<Pick<UsageBlockRow, 'input_tokens' | 'output_tokens' | 'cost_usd' | 'paused_until' | 'updated_at'>>;

/**
 * UPSERT di UNA riga usage_blocks (PK = id). Idempotente sul re-tick di
 * materializzazione: un secondo write dello stesso blocco AGGIORNA i contatori.
 * Non tocca `paused_until` se assente nell'input (lo gestisce `setUsageBlockPause`).
 */
export function upsertUsageBlock(row: UsageBlockUpsert): void {
  const db = openHubDb();
  const now = row.updated_at ?? new Date().toISOString();
  db
    .prepare(
      `INSERT INTO usage_blocks
         (id, channel, window_kind, started_at, ends_at, input_tokens, output_tokens, cost_usd, paused_until, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         channel       = excluded.channel,
         window_kind   = excluded.window_kind,
         started_at    = excluded.started_at,
         ends_at       = excluded.ends_at,
         input_tokens  = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         cost_usd      = excluded.cost_usd,
         paused_until  = COALESCE(excluded.paused_until, usage_blocks.paused_until),
         updated_at    = excluded.updated_at`,
    )
    .run(
      row.id,
      row.channel,
      row.window_kind,
      row.started_at,
      row.ends_at,
      row.input_tokens ?? 0,
      row.output_tokens ?? 0,
      row.cost_usd ?? 0,
      row.paused_until ?? null,
      now,
    );
}

/** Setta (o azzera) `paused_until` di un blocco: park all'esaurimento / reset. */
export function setUsageBlockPause(id: string, pausedUntil: string | null): void {
  const db = openHubDb();
  db
    .prepare('UPDATE usage_blocks SET paused_until = ?, updated_at = ? WHERE id = ?')
    .run(pausedUntil, new Date().toISOString(), id);
}

/** Blocco puntuale per (channel, window_kind, started_at), o undefined. */
export function readUsageBlock(channel: string, windowKind: WindowKind, startedAt: string): UsageBlockRow | undefined {
  const db = openHubDb();
  const row = db
    .prepare(
      `SELECT id, channel, window_kind, started_at, ends_at, input_tokens, output_tokens, cost_usd, paused_until, updated_at
         FROM usage_blocks WHERE channel = ? AND window_kind = ? AND started_at = ?`,
    )
    .get(channel, windowKind, startedAt);
  return (row as UsageBlockRow | undefined) ?? undefined;
}

/**
 * Blocchi usage, opz. filtrati per canale e/o finestra, ORDER BY started_at DESC
 * (il più recente prima: S guarda il blocco corrente, L rolla la weekly).
 */
export function listUsageBlocks(channel?: string, windowKind?: WindowKind): UsageBlockRow[] {
  const db = openHubDb();
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (channel !== undefined) { clauses.push('channel = ?'); args.push(channel); }
  if (windowKind !== undefined) { clauses.push('window_kind = ?'); args.push(windowKind); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT id, channel, window_kind, started_at, ends_at, input_tokens, output_tokens, cost_usd, paused_until, updated_at
         FROM usage_blocks ${where} ORDER BY started_at DESC`,
    )
    .all(...args);
  return rows as UsageBlockRow[];
}

/** Input di UPSERT su daemon_sessions: `session_id` (PK) obbligatorio. */
export type DaemonSessionUpsert = Pick<DaemonSessionRow, 'session_id'> &
  Partial<Pick<DaemonSessionRow, 'started_at' | 'last_seen_at' | 'meta'>>;

/** Sessione daemon per id (dedup ccusage/JSONL), o undefined. */
export function getDaemonSession(sessionId: string): DaemonSessionRow | undefined {
  const db = openHubDb();
  const row = db
    .prepare('SELECT session_id, started_at, last_seen_at, meta FROM daemon_sessions WHERE session_id = ?')
    .get(sessionId);
  return (row as DaemonSessionRow | undefined) ?? undefined;
}

/**
 * UPSERT di UNA sessione daemon (PK = session_id): dedup delle sessioni ccusage.
 * Alla prima vista fissa `started_at`; sui re-tick aggiorna solo `last_seen_at`
 * (e `meta` se fornito), senza far arretrare `started_at`.
 */
export function upsertDaemonSession(row: DaemonSessionUpsert): void {
  const db = openHubDb();
  const now = new Date().toISOString();
  db
    .prepare(
      `INSERT INTO daemon_sessions (session_id, started_at, last_seen_at, meta)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         meta         = COALESCE(excluded.meta, daemon_sessions.meta)`,
    )
    .run(row.session_id, row.started_at ?? now, row.last_seen_at ?? now, row.meta ?? null);
}

/** Aggiorna solo l'heartbeat `last_seen_at` di una sessione già nota (no-op se assente). */
export function touchDaemonSession(sessionId: string, lastSeenAt?: string): void {
  const db = openHubDb();
  db
    .prepare('UPDATE daemon_sessions SET last_seen_at = ? WHERE session_id = ?')
    .run(lastSeenAt ?? new Date().toISOString(), sessionId);
}

/** Input di INSERT su config_versions: `id`+`scope`+`value` obbligatori. */
export type ConfigVersionInput = Pick<ConfigVersionRow, 'id' | 'scope' | 'value'> &
  Partial<Pick<ConfigVersionRow, 'author' | 'created_at'>>;

/**
 * Ultima versione di config per scope (audit trail append-only, il più recente
 * per `created_at`), o undefined. R legge scope='routing', L scope='budget'.
 */
export function getLatestConfig(scope: ConfigScope): ConfigVersionRow | undefined {
  const db = openHubDb();
  const row = db
    .prepare(
      `SELECT id, scope, value, author, created_at FROM config_versions
        WHERE scope = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(scope);
  return (row as ConfigVersionRow | undefined) ?? undefined;
}

/** INSERT append-only di una versione di config (audit trail routing/budget/soglie). */
export function appendConfigVersion(row: ConfigVersionInput): string {
  const db = openHubDb();
  db
    .prepare('INSERT INTO config_versions (id, scope, value, author, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(row.id, row.scope, row.value, row.author ?? null, row.created_at ?? new Date().toISOString());
  return row.id;
}

// ═════════════════════════════════════════════════════════════════════════════
// TRACK L — LEDGER DUALE (implementazione sotto le primitive congelate)
//   Materializza `usage_blocks` (block 5h + weekly) dai token EFFETTIVI di Claude
//   letti da ccusage/JSONL (uso UMANO + daemon condividono la quota Anthropic).
//   `budgetGate` legge il materializzato + la config e gata per canale. Fail-safe:
//   parse-failure/drift → alert (canale 'budget') + budget UNKNOWN → breaker, MAI
//   zero-count. Park: `session_id` → daemon_sessions.meta per il `--resume` post-reset.
// ═════════════════════════════════════════════════════════════════════════════

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Materializzazione lazy: rilegge JSONL al più una volta ogni REFRESH_TTL. */
const REFRESH_TTL_MS = 30_000;
/** Anti-spam degli alert di parse-failure. */
const ALERT_THROTTLE_MS = 5 * 60_000;

// Cache di processo su `global` (come il resto del modulo: sopravvive agli
// hot-reload di Next). `unknown:true` alla partenza a freddo ⇒ il gate è CHIUSO
// finché una prima materializzazione non riesce (mai via libera su ledger vuoto/ignoto).
const gl = global as unknown as {
  __bugbay_ledger_cache__?: { lastRefreshMs: number; unknown: boolean; lastAlertMs: number };
};
function ledgerCache(): { lastRefreshMs: number; unknown: boolean; lastAlertMs: number } {
  if (!gl.__bugbay_ledger_cache__) gl.__bugbay_ledger_cache__ = { lastRefreshMs: 0, unknown: true, lastAlertMs: 0 };
  return gl.__bugbay_ledger_cache__;
}

// ── Config budget (scope='budget', preset-seeded, editabile) ─────────────────

/** Cap e riserva del ledger duale. Preset seminati; l'utente li edita via config_versions. */
export interface BudgetConfig {
  /** Cap di costo (USD) della finestra WEEKLY — vincolo binding per il 24/7. */
  weeklyCostCapUsd: number;
  /** Cap di costo (USD) della finestra block 5h. */
  blockCostCapUsd: number;
  /** Frazione della weekly RISERVATA all'umano (default 40%): sottratta alla soglia. */
  humanReserveFraction: number;
  /** Zona per canale: 'audit' < 'fixer' ⇒ l'audit viene shedato PRIMA (zone shedding). */
  channelZone: Record<BudgetChannel, number>;
  /** Ancora della finestra weekly (UTC): giorno 0=Dom..6=Sab (default 1=Lun) + ora. */
  weeklyAnchorWeekdayUtc: number;
  weeklyAnchorHourUtc: number;
}

// Preset seminati al primo avvio. NB: cap in USD = proxy misurabile della quota
// (la subscription non pubblica limiti in token); il learner P90 è differito a v0.9.
const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  weeklyCostCapUsd: 700,
  blockCostCapUsd: 50,
  humanReserveFraction: 0.4,
  channelZone: { fixer: 1.0, audit: 0.75 },
  weeklyAnchorWeekdayUtc: 1,
  weeklyAnchorHourUtc: 0,
};

/**
 * Config budget corrente (ultima versione scope='budget'). Se assente, SEMINA i
 * preset (audit trail append-only) e li ritorna. Merge coi default per forward-compat
 * (chiavi mancanti in una vecchia versione ⇒ default).
 */
export function getBudgetConfig(): BudgetConfig {
  const latest = getLatestConfig('budget');
  if (!latest) {
    appendConfigVersion({
      id: `budget-seed-${Date.now()}`,
      scope: 'budget',
      value: JSON.stringify(DEFAULT_BUDGET_CONFIG),
      author: 'system',
    });
    return DEFAULT_BUDGET_CONFIG;
  }
  try {
    const parsed = JSON.parse(latest.value) as Partial<BudgetConfig>;
    return {
      ...DEFAULT_BUDGET_CONFIG,
      ...parsed,
      channelZone: { ...DEFAULT_BUDGET_CONFIG.channelZone, ...(parsed.channelZone ?? {}) },
    };
  } catch {
    return DEFAULT_BUDGET_CONFIG;
  }
}

/** Inizio (ms) della finestra weekly corrente, ancorata a (weekday, hour) UTC. */
function weekStartMs(nowMs: number, cfg: BudgetConfig): number {
  const d = new Date(nowMs);
  const deltaDays = (d.getUTCDay() - cfg.weeklyAnchorWeekdayUtc + 7) % 7;
  const anchorToday = Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), cfg.weeklyAnchorHourUtc, 0, 0, 0,
  );
  let start = anchorToday - deltaDays * 86_400_000;
  if (start > nowMs) start -= WEEK_MS; // l'ora d'ancora di oggi è ancora nel futuro
  return start;
}

// ── Lettura ccusage/JSONL ────────────────────────────────────────────────────

/** Dir dei transcript Claude (`<base>/projects`), con override per test/sandbox. */
function claudeProjectDirs(): string[] {
  const override = process.env.BUGBAY_CCUSAGE_DIR;
  if (override) return override.split(path.delimiter).filter(Boolean).map((p) => path.resolve(p));
  const cfg = process.env.CLAUDE_CONFIG_DIR;
  const bases = cfg
    ? cfg.split(',').map((s) => s.trim()).filter(Boolean)
    : [path.join(os.homedir(), '.claude'), path.join(os.homedir(), '.config', 'claude')];
  return bases.map((b) => path.join(b, 'projects'));
}

/** Elenca ricorsivamente i *.jsonl sotto `dir` (dir mancante ⇒ [], nessun throw). */
function listJsonlFiles(dir: string): string[] {
  let ents: fs.Dirent[];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; // dir assente = nessun dato
    throw e; // permessi/I-O: propaga → trattato come UNKNOWN a monte
  }
  const out: string[] = [];
  for (const ent of ents) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsonlFiles(full));
    else if (ent.isFile() && ent.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

interface ScanResult {
  entries: UsageEntry[];
  sessions: Map<string, { minMs: number; maxMs: number }>;
  drift: boolean;
  ioError: boolean;
}

/**
 * Legge TUTTI i JSONL, estrae gli entry di usage (dedup per messageId:requestId,
 * come ccusage) e raccoglie le sessioni. Righe malformate = SKIP silenzioso (come
 * ccusage). DRIFT sospetto = ci sono righe assistant ma NESSUNA con usage estraibile
 * (formato Anthropic cambiato) ⇒ budget UNKNOWN. I/O error (permessi) ⇒ ioError.
 */
function readAllUsageEntries(): ScanResult {
  const entries: UsageEntry[] = [];
  const sessions = new Map<string, { minMs: number; maxMs: number }>();
  const seen = new Set<string>();
  let assistantLike = 0;
  let usageExtracted = 0;
  let recognizable = 0;  // righe transcript-like (type|message|usage), schema-agnostico
  let parsedLines = 0;   // righe che parsano come JSON-oggetto
  let sawContent = false; // almeno un file JSONL non-vuoto letto
  let ioError = false;

  for (const dir of claudeProjectDirs()) {
    let files: string[];
    try {
      files = listJsonlFiles(dir);
    } catch {
      ioError = true;
      continue;
    }
    for (const file of files) {
      let text: string;
      try {
        text = fs.readFileSync(file, 'utf-8');
      } catch {
        ioError = true;
        continue;
      }
      if (text.trim()) sawContent = true;
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          continue; // riga malformata: skip (normale, come ccusage)
        }
        parsedLines++;
        // Segnale schema-agnostico: la riga "sembra" un entry di transcript. Coglie
        // il drift anche se `type` è rinominato o `message` rimosso (il vecchio
        // criterio assistant-only li mancava → fail-open).
        if (typeof obj.type === 'string' || obj.message !== undefined || obj.usage !== undefined) recognizable++;
        const msg = obj.message as Record<string, unknown> | undefined;
        if (obj.type !== 'assistant' || !msg || typeof msg !== 'object') continue;
        assistantLike++;
        const usage = msg.usage as TokenUsage | undefined;
        const tsRaw = obj.timestamp;
        const tsMs = typeof tsRaw === 'string' ? Date.parse(tsRaw) : NaN;
        if (!usage || (typeof usage.input_tokens !== 'number' && typeof usage.output_tokens !== 'number') || Number.isNaN(tsMs)) {
          continue; // assistant senza usage/timestamp riconoscibili → possibile drift
        }
        // Dedup per messageId:requestId (solo se entrambi presenti, come ccusage).
        const msgId = typeof msg.id === 'string' ? msg.id : undefined;
        const reqId = typeof obj.requestId === 'string' ? obj.requestId : undefined;
        if (msgId && reqId) {
          const key = `${msgId}:${reqId}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        usageExtracted++;
        const model = typeof msg.model === 'string' ? msg.model : undefined;
        const envelopeCost = typeof obj.costUSD === 'number' ? obj.costUSD : undefined;
        entries.push({
          timestampMs: tsMs,
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          costUsd: envelopeCost !== undefined && envelopeCost > 0 ? envelopeCost : costFromTokens(model, usage),
        });
        const sid = typeof obj.sessionId === 'string' ? obj.sessionId : undefined;
        if (sid) {
          const cur = sessions.get(sid);
          if (!cur) sessions.set(sid, { minMs: tsMs, maxMs: tsMs });
          else { if (tsMs < cur.minMs) cur.minMs = tsMs; if (tsMs > cur.maxMs) cur.maxMs = tsMs; }
        }
      }
    }
  }
  // Drift = formato non riconosciuto → budget UNKNOWN → breaker chiuso (fail-closed).
  // Predicato in modulo foglia testabile (usage-drift.ts): copre `type` rinominato,
  // `message` rimosso e corruzione totale, non solo lo schema assistant noto.
  const drift = isUsageDrift({ usageExtracted, assistantLike, recognizable, parsedLines, sawContent });
  return { entries, sessions, drift, ioError };
}

// ── Materializzazione ────────────────────────────────────────────────────────

/**
 * (Ri)materializza `usage_blocks` dai token effettivi di ccusage/JSONL, per ENTRAMBE
 * le finestre (block 5h via algoritmo vendorizzato + weekly rollup). Idempotente:
 * ricomputa da zero e UPSERT le righe-totale (channel='total') — nessun rischio di
 * doppio conteggio tra tick. Su parse-failure/drift/I-O error: NON azzera nulla,
 * setta budget UNKNOWN + alza un alert (throttle). Pubblica: S può chiamarla sul tick.
 */
export function refreshLedger(): void {
  const c = ledgerCache();
  const nowMs = Date.now();
  let scan: ScanResult;
  try {
    scan = readAllUsageEntries();
  } catch (e) {
    c.unknown = true; c.lastRefreshMs = nowMs; maybeAlert(e);
    return;
  }
  if (scan.ioError || scan.drift) {
    // MAI zero-count: budget UNKNOWN → il gate resta chiuso finché non si ripara.
    c.unknown = true; c.lastRefreshMs = nowMs;
    maybeAlert(new Error(scan.drift ? 'ccusage/JSONL: formato usage non riconosciuto (drift)' : 'ccusage/JSONL: errore di I/O in lettura'));
    return;
  }

  const cfg = getBudgetConfig();
  const blocks = identifySessionBlocks(scan.entries);

  // Weekly rollup: bucket per inizio-settimana ancorato.
  const weekly = new Map<number, { input: number; output: number; cost: number }>();
  for (const e of scan.entries) {
    const ws = weekStartMs(e.timestampMs, cfg);
    const agg = weekly.get(ws) ?? { input: 0, output: 0, cost: 0 };
    agg.input += e.inputTokens; agg.output += e.outputTokens; agg.cost += e.costUsd;
    weekly.set(ws, agg);
  }

  try {
    transact(() => {
      // Registro sessioni (dedup: una riga per sessione ccusage; started_at pinnato).
      for (const [sid, span] of scan.sessions) {
        upsertDaemonSession({
          session_id: sid,
          started_at: new Date(span.minMs).toISOString(),
          last_seen_at: new Date(span.maxMs).toISOString(),
        });
      }
      // block 5h.
      for (const b of blocks) {
        const startIso = new Date(b.startMs).toISOString();
        upsertUsageBlock({
          id: `total|block_5h|${startIso}`,
          channel: 'total',
          window_kind: 'block_5h',
          started_at: startIso,
          ends_at: new Date(b.startMs + SESSION_DURATION_MS).toISOString(),
          input_tokens: b.inputTokens,
          output_tokens: b.outputTokens,
          cost_usd: b.costUsd,
          updated_at: new Date(nowMs).toISOString(),
        });
      }
      // weekly.
      for (const [ws, agg] of weekly) {
        const startIso = new Date(ws).toISOString();
        upsertUsageBlock({
          id: `total|weekly|${startIso}`,
          channel: 'total',
          window_kind: 'weekly',
          started_at: startIso,
          ends_at: new Date(ws + WEEK_MS).toISOString(),
          input_tokens: agg.input,
          output_tokens: agg.output,
          cost_usd: agg.cost,
          updated_at: new Date(nowMs).toISOString(),
        });
      }
    });
    c.unknown = false;
    c.lastRefreshMs = nowMs;
  } catch (e) {
    c.unknown = true; c.lastRefreshMs = nowMs; maybeAlert(e);
  }
}

/** Materializza al più ogni REFRESH_TTL (throttle): il gate resta O(1) sul DB. */
function ensureFresh(): void {
  const c = ledgerCache();
  if (Date.now() - c.lastRefreshMs >= REFRESH_TTL_MS) refreshLedger();
}

// ── Gate deterministico ──────────────────────────────────────────────────────

/**
 * Confronto uso-vs-cap per canale sulla finestra materializzata. Cap effettivo =
 * cap × (1 − riserva, solo weekly) × zona-canale. Over su una finestra ⇒ pausa fino
 * al reset della PIÙ TARDA finestra sforata (deve liberarsi tutto prima di ripartire).
 */
function computeGate(channel: BudgetChannel): { ok: boolean; pausedUntil: string | null } {
  const cfg = getBudgetConfig();
  const nowMs = Date.now();
  const zone = cfg.channelZone[channel] ?? 1;

  // Finestra block 5h corrente (start ≤ now < ends).
  const curBlock = listUsageBlocks('total', 'block_5h').find(
    (b) => Date.parse(b.started_at) <= nowMs && nowMs < Date.parse(b.ends_at),
  );
  const blockUsed = curBlock?.cost_usd ?? 0;
  const blockCap = cfg.blockCostCapUsd * zone;
  const blockOver = blockUsed >= blockCap;

  // Finestra weekly corrente.
  const ws = weekStartMs(nowMs, cfg);
  const weeklyRow = readUsageBlock('total', 'weekly', new Date(ws).toISOString());
  const weeklyUsed = weeklyRow?.cost_usd ?? 0;
  const weeklyCap = cfg.weeklyCostCapUsd * (1 - cfg.humanReserveFraction) * zone;
  const weeklyOver = weeklyUsed >= weeklyCap;

  if (!blockOver && !weeklyOver) return { ok: true, pausedUntil: null };
  const resets: number[] = [];
  if (blockOver && curBlock) resets.push(Date.parse(curBlock.ends_at));
  if (weeklyOver) resets.push(ws + WEEK_MS);
  const pausedUntil = resets.length ? new Date(Math.max(...resets)).toISOString() : null;
  return { ok: false, pausedUntil };
}

// ── Alert (canale 'budget') ──────────────────────────────────────────────────

/** Alza un alert di budget (INSERT diretto su `alerts`, colonne v0.6 congelate). */
function raiseAlert(message: string, detail: string | null): void {
  const db = openHubDb();
  const id = `alert-budget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db
    .prepare('INSERT INTO alerts (id, channel, severity, run_id, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, 'budget', 'error', null, message, detail, new Date().toISOString());
}

/** Alert con throttle (evita spam a ogni tick mentre il drift persiste). Best-effort. */
function maybeAlert(e: unknown): void {
  const c = ledgerCache();
  const now = Date.now();
  if (now - c.lastAlertMs < ALERT_THROTTLE_MS) return;
  c.lastAlertMs = now;
  try {
    raiseAlert('Budget UNKNOWN: ledger ccusage non materializzabile — breaker chiuso.', e instanceof Error ? e.message : String(e));
  } catch { /* alert best-effort: non deve mai far fallire il gate */ }
}

// ── Park / resume (zero re-spend) ────────────────────────────────────────────

/** Sessione parcheggiata pronta al rilancio `--resume`. */
export interface ResumableSession {
  sessionId: string;
  channel: string;
  resumeAt: string;
}

/**
 * Parcheggia il `session_id` di una run fermata dal breaker: lo scheduler la
 * rilancerà con `--resume` DOPO il reset (`pausedUntil`), a costo zero (nessun
 * re-spend dell'interpretazione/repro già fatti). Persistito in daemon_sessions.meta.
 */
export function parkRun(channel: BudgetChannel, sessionId: string, pausedUntil: string): void {
  upsertDaemonSession({
    session_id: sessionId,
    meta: JSON.stringify({ parked: true, channel, resumeAt: pausedUntil }),
  });
}

/** Sessioni parcheggiate il cui reset è passato (`resumeAt` ≤ now): pronte a `--resume`. */
export function listResumableSessions(nowIso?: string): ResumableSession[] {
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  const db = openHubDb();
  const rows = db
    .prepare('SELECT session_id, meta FROM daemon_sessions WHERE meta IS NOT NULL')
    .all() as { session_id: string; meta: string | null }[];
  const out: ResumableSession[] = [];
  for (const r of rows) {
    if (!r.meta) continue;
    try {
      const m = JSON.parse(r.meta) as { parked?: boolean; channel?: string; resumeAt?: string };
      if (m.parked && m.resumeAt && Date.parse(m.resumeAt) <= now) {
        out.push({ sessionId: r.session_id, channel: m.channel ?? 'fixer', resumeAt: m.resumeAt });
      }
    } catch { /* meta non-JSON: ignora */ }
  }
  return out;
}

/** Azzera lo stato di park dopo il rilancio (mantiene la sessione nel registro). */
export function clearPark(sessionId: string): void {
  upsertDaemonSession({ session_id: sessionId, meta: JSON.stringify({ parked: false }) });
}
