/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * SHELL DB-backed dello shadow Thompson bandit v0.9 — la controparte impura di
 * `bandit-core.ts` (come `consolidation.ts` sta a `consolidation-core.ts`). Legge i
 * posteriori Beta dei bracci e le soglie A33 dalla spina, delega la DECISIONE al
 * nucleo puro (`decideShadow`), e PERSISTE ogni "would have chosen X" in
 * `bandit_shadow_decisions` (surfaceable). La scelta LIVE ritornata resta quella
 * DETERMINISTICA finché le soglie non sono superate — invariante garantita dal
 * nucleo e provata in `test/bandit.test.mjs`.
 *
 * WIRING: `routing.chooseModel`, quando `BUGBAY_BANDIT=1`, carica QUESTO modulo in
 * modo pigro (dynamic import) e registra `shadowRoute` come hook via
 * `installShadowHook`. Così `routing.ts` resta un modulo FOGLIA (nessun import
 * runtime di hub/ledger): il runner nativo può importarlo, e questa catena DB-backed
 * (import estensione-less) resta fuori dal runner, garantita solo da `tsc --noEmit`.
 *
 * ADDITIVO: crea le proprie tabelle (`bandit_arms`, `bandit_shadow_decisions`) con
 * CREATE TABLE IF NOT EXISTS su `openHubDb()` — non tocca lo schema congelato di
 * hub.ts. Best-effort assoluto: qualsiasi errore del percorso shadow degrada in
 * silenzio al deterministico — lo shadow non può MAI rompere il routing.
 *
 * @indice
 * - installShadowHook          → registra shadowRoute come hook di routing (idempotente)
 * - shadowRoute                → hook: legge DB, decide (core), persiste, ritorna il live
 * - recordOutcome              → aggiorna i posteriori Beta da esito (merge-verdict), non wired qui
 * - readArmPosteriors / listShadowDecisions → letture surfaceable (console/diagnostica)
 */

import { openHubDb } from './hub';
import type { SqliteDatabase } from './sqlite';
import { getLatestConfig } from './ledger';
import { registerShadowHook } from './routing';
import type { ModelContext } from './routing';
import {
  decideShadow,
  parseThreshold,
  armsForContext,
  banditContextKey,
  type ArmPosterior,
  type BanditContextKey,
  type Rng,
} from './bandit-core';

// ── Persistenza additiva (tabelle proprie, schema hub NON toccato) ───────────

const BANDIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS bandit_arms (
  context_key  TEXT NOT NULL,
  model        TEXT NOT NULL,
  alpha        REAL NOT NULL DEFAULT 1,
  beta         REAL NOT NULL DEFAULT 1,
  observations INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (context_key, model)
);
CREATE TABLE IF NOT EXISTS bandit_shadow_decisions (
  id                  TEXT PRIMARY KEY,
  context_key         TEXT NOT NULL,
  deterministic_model TEXT NOT NULL,
  shadow_model        TEXT NOT NULL,
  live                INTEGER NOT NULL,
  live_model          TEXT NOT NULL,
  diverged            INTEGER NOT NULL,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bandit_shadow_ctx_idx ON bandit_shadow_decisions (context_key, created_at);
`;

// Init idempotente una-volta-per-processo (come le cache-su-global del modulo:
// sopravvive agli hot-reload di Next senza ri-esecuzioni ridondanti).
const gb = global as unknown as { __bugbay_bandit_ready__?: boolean };
function getBanditDb(): SqliteDatabase {
  const db = openHubDb();
  if (!gb.__bugbay_bandit_ready__) {
    db.exec(BANDIT_SCHEMA);
    gb.__bugbay_bandit_ready__ = true;
  }
  return db;
}

/** Posteriori dei bracci per un contesto; braccio mai visto ⇒ prior Beta(1,1). */
export function readArmPosteriors(key: BanditContextKey, arms: string[]): ArmPosterior[] {
  const db = getBanditDb();
  const stmt = db.prepare('SELECT alpha, beta, observations FROM bandit_arms WHERE context_key = ? AND model = ?');
  return arms.map((model) => {
    const row = stmt.get(key, model) as { alpha: number; beta: number; observations: number } | undefined;
    if (!row) return { model, alpha: 1, beta: 1, observations: 0 };
    return { model, alpha: row.alpha, beta: row.beta, observations: row.observations };
  });
}

// ── Hook live-neutro registrato da routing.chooseModel ───────────────────────

/** Opzioni di iniezione (test): RNG e orologio deterministici. */
export interface ShadowRouteOptions {
  rng?: Rng;
  now?: () => number;
}

/**
 * Registra `shadowRoute` come hook di routing. Chiamato una volta dal dynamic import
 * pigro di `routing.chooseModel` quando `BUGBAY_BANDIT=1`. Idempotente e best-effort.
 */
export function installShadowHook(): void {
  registerShadowHook(shadowRoute);
}

/**
 * Registra la decisione shadow e ritorna la scelta LIVE. Contratto di sicurezza:
 *   • Sotto soglia ⇒ ritorna `deterministic` (invariato) — garantito da `decideShadow`.
 *   • Sopra soglia ⇒ ritorna la scelta Thompson (comunque un braccio dell'insieme).
 *   • QUALSIASI errore (DB, parse, sampling) ⇒ ritorna `deterministic`.
 * Persiste sempre "would have chosen X" (best-effort) per renderla surfaceable.
 */
export function shadowRoute(ctx: ModelContext, deterministic: string, opts: ShadowRouteOptions = {}): string {
  try {
    const rng = opts.rng ?? Math.random;
    const key = banditContextKey(ctx);
    const arms = armsForContext(ctx);
    const posteriors = readArmPosteriors(key, arms);
    const cfg = parseThreshold(getLatestConfig('threshold')?.value ?? null);
    const decision = decideShadow(ctx, deterministic, posteriors, cfg, rng);
    persistShadow(key, deterministic, decision.shadowModel, decision.live, decision.liveModel, opts.now?.() ?? Date.now());
    return decision.liveModel;
  } catch {
    // Fail-safe assoluto: mai spostare il live su un errore dello shadow.
    return deterministic;
  }
}

/** INSERT best-effort della decisione shadow (mai lancia verso il chiamante). */
function persistShadow(
  key: BanditContextKey,
  deterministic: string,
  shadowModel: string,
  live: boolean,
  liveModel: string,
  nowMs: number,
): void {
  try {
    const db = getBanditDb();
    const id = `sd-${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
    db
      .prepare(
        `INSERT INTO bandit_shadow_decisions
           (id, context_key, deterministic_model, shadow_model, live, live_model, diverged, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        key,
        deterministic,
        shadowModel,
        live ? 1 : 0,
        liveModel,
        liveModel !== deterministic ? 1 : 0,
        new Date(nowMs).toISOString(),
      );
  } catch {
    /* persistenza best-effort: non deve mai far fallire il routing */
  }
}

/** Riga surfaceable di una decisione shadow (console/diagnostica). */
export interface ShadowDecisionRow {
  id: string;
  context_key: string;
  deterministic_model: string;
  shadow_model: string;
  live: number;
  live_model: string;
  diverged: number;
  created_at: string;
}

/** Ultime decisioni shadow (più recenti prima), opz. filtrate per contesto. */
export function listShadowDecisions(limit = 50, contextKey?: BanditContextKey): ShadowDecisionRow[] {
  const db = getBanditDb();
  if (contextKey) {
    return db
      .prepare(
        `SELECT id, context_key, deterministic_model, shadow_model, live, live_model, diverged, created_at
           FROM bandit_shadow_decisions WHERE context_key = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(contextKey, limit) as ShadowDecisionRow[];
  }
  return db
    .prepare(
      `SELECT id, context_key, deterministic_model, shadow_model, live, live_model, diverged, created_at
         FROM bandit_shadow_decisions ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as ShadowDecisionRow[];
}

// ── Aggiornamento posteriori da esito (merge-verdict, non wired qui) ─────────

/**
 * Aggiorna il posteriore Beta di un braccio da un esito in [0,1] (reward=1 successo
 * pieno). α += reward, β += (1−reward), observations += 1. Aggancio con cui la
 * verdetto-di-merge UMANO (peso 1.0) alimenterà il bandit; il wiring nel percorso di
 * scoring è fuori dallo scope di questo modulo (single-owner). UPSERT idempotente per
 * (context_key, model).
 */
export function recordOutcome(key: BanditContextKey, model: string, reward: number, nowMs = Date.now()): void {
  const r = Math.min(1, Math.max(0, reward));
  const db = getBanditDb();
  db
    .prepare(
      `INSERT INTO bandit_arms (context_key, model, alpha, beta, observations, updated_at)
       VALUES (?, ?, 1 + ?, 1 + ?, 1, ?)
       ON CONFLICT(context_key, model) DO UPDATE SET
         alpha        = bandit_arms.alpha + ?,
         beta         = bandit_arms.beta + ?,
         observations = bandit_arms.observations + 1,
         updated_at   = excluded.updated_at`,
    )
    .run(key, model, r, 1 - r, new Date(nowMs).toISOString(), r, 1 - r);
}
