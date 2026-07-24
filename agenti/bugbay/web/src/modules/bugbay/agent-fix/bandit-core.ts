/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * NUCLEO PURO dello shadow Thompson bandit v0.9 (nessun I/O, nessuno stato). Come
 * `consolidation-core.ts` sta a `consolidation.ts`, questo modulo isola la LOGICA
 * caratterizzabile — sampling, spazio dei bracci, gate delle soglie A33 — così è
 * testabile nel runner nativo (`test/bandit.test.mjs`), mentre lo shell DB-backed
 * (`bandit.ts`) resta garantito solo da `tsc --noEmit` (import estensione-less).
 *
 * INVARIANTE SHADOW-FIRST (safety): `decideShadow` ritorna `liveModel === deterministic`
 * ogni volta che il contesto NON ha superato la soglia (`isContextLive` falso). Il
 * bandit "osserva" (registra `shadowModel`) ma non "guida" finché le soglie scritte
 * non lo autorizzano.
 *
 * MODULO FOGLIA: nessun import a RUNTIME (solo `type ModelContext`, erasa dal
 * type-stripping) così il runner nativo può importarlo. Le costanti-modello e il
 * predicato "heavy" sono RIPETUTI qui dalle definizioni canoniche di routing.ts; la
 * PARITÀ è vincolata da `test/bandit.test.mjs` (la scelta deterministica reale deve
 * sempre essere un braccio, e la chiave heavy/light deve seguire `isHeavyFix`), così
 * un drift dei valori rompe i test invece di passare in silenzio.
 *
 * @indice
 * - Rng / sampleBeta / chooseArm       → Thompson sampling puro (RNG iniettabile)
 * - BanditContextKey / banditContextKey / armsForContext → spazio dei bracci per fase
 * - ThresholdConfig / parseThreshold / isContextLive     → gate soglie A33 (conservativo)
 * - ShadowDecision / decideShadow      → decisione shadow pura (live == deterministico sotto soglia)
 */

import type { ModelContext } from './routing';

// Ripetizione vincolata-da-test delle costanti canoniche di routing.ts (foglia: no
// import a runtime). La parità è garantita dai test, non dalla sintassi.
const MODEL_HAIKU = 'haiku';
const MODEL_SONNET = 'claude-sonnet-5';
const MODEL_OPUS = 'claude-opus-4-8';

/** Replica del predicato `routing.isHeavyFix` (parità vincolata dai test). */
function ctxIsHeavy(ctx: Extract<ModelContext, { phase: 'fix' }>): boolean {
  return ctx.complessita === 'alta'
    || ['Critica', 'Urgente'].includes(ctx.priority ?? '')
    || ctx.escalated === true;
}

// ── Thompson sampling puro (RNG iniettabile per test deterministici) ──────────

/** Sorgente di uniformi in [0,1). Default `Math.random`; iniettabile nei test. */
export type Rng = () => number;

/** Normale standard via Box-Muller (consuma due uniformi). */
function sampleNormal(rng: Rng): number {
  const u1 = Math.max(rng(), Number.MIN_VALUE); // evita log(0)
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Campione da Gamma(shape, 1) con Marsaglia–Tsang (shape ≥ 1); per shape < 1 usa il
 * boost di Stuart. Base del campionamento Beta. Cap difensivo del ciclo di rifiuto
 * per non ciclare all'infinito su un RNG patologico (al peggio ritorna la media d).
 */
function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) {
    const u = Math.max(rng(), Number.MIN_VALUE);
    return sampleGamma(1 + shape, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let i = 0; i < 1000; i++) {
    let x: number;
    let v: number;
    do {
      x = sampleNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.max(rng(), Number.MIN_VALUE);
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d;
}

/**
 * Campione θ ~ Beta(alpha, beta) via due Gamma: θ = G(α)/(G(α)+G(β)). Con
 * alpha=beta=1 (prior uniforme) ⇒ θ ~ Uniform(0,1). Puro: nessun I/O.
 */
export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = sampleGamma(Math.max(alpha, 1e-6), rng);
  const y = sampleGamma(Math.max(beta, 1e-6), rng);
  const s = x + y;
  return s > 0 ? x / s : 0.5;
}

/** Posteriore Beta di un braccio (modello candidato) per un contesto. */
export interface ArmPosterior {
  model: string;
  alpha: number;
  beta: number;
  observations: number;
}

/**
 * Thompson sampling: campiona θ da ogni braccio e ritorna il modello con θ massimo
 * (esplora in proporzione all'incertezza). Puro. `arms` non vuoto per costruzione
 * (armsForContext ne garantisce ≥ 2); fallback difensivo al primo braccio.
 */
export function chooseArm(arms: ArmPosterior[], rng: Rng): string {
  let best = arms[0]?.model ?? MODEL_SONNET;
  let bestTheta = -Infinity;
  for (const a of arms) {
    const theta = sampleBeta(a.alpha, a.beta, rng);
    if (theta > bestTheta) {
      bestTheta = theta;
      best = a.model;
    }
  }
  return best;
}

// ── Spazio dei bracci per fase ───────────────────────────────────────────────

/**
 * Chiave di contesto del bandit: la fase, col fix separato in heavy/light perché la
 * scelta deterministica (e quindi i bracci sensati) differiscono. Stessa granularità
 * su cui viaggia il gate delle soglie A33.
 */
export type BanditContextKey =
  | 'interprete'
  | 'giudice'
  | 'repro'
  | 'piano'
  | 'escalation'
  | 'fix:heavy'
  | 'fix:light';

/** Contesto di routing → chiave del bandit (puro). */
export function banditContextKey(ctx: ModelContext): BanditContextKey {
  if (ctx.phase === 'fix') return ctxIsHeavy(ctx) ? 'fix:heavy' : 'fix:light';
  return ctx.phase;
}

/**
 * Bracci candidati per un contesto. INVARIANTE: la scelta deterministica di
 * `chooseModel` è SEMPRE tra i bracci — così, quando (e solo quando) il gate va live,
 * il bandit può al più scegliere un'alternativa già nell'insieme, e sotto soglia il
 * live coincide col deterministico. Costruiti a call-time per evitare TDZ sul ciclo
 * di import routing↔bandit.
 */
export function armsForContext(ctx: ModelContext): string[] {
  switch (banditContextKey(ctx)) {
    case 'interprete':
    case 'giudice':
      return [MODEL_HAIKU, MODEL_SONNET];
    case 'repro':
    case 'piano':
    case 'escalation':
    case 'fix:heavy':
    case 'fix:light':
      return [MODEL_SONNET, MODEL_OPUS];
  }
}

// ── Gate delle soglie A33 (conservativo, puro) ───────────────────────────────

/**
 * Vista LETTORE della calibration table A33 (config_versions scope='threshold',
 * scritta ALTROVE dalla governance). Conservativa per costruzione: campi assenti ⇒
 * contesto NON live. Il bandit non scrive mai questa config.
 */
export interface ThresholdConfig {
  /** Chiavi di contesto autorizzate ad andare LIVE (whitelist esplicita). */
  liveContexts?: BanditContextKey[];
  /** Osservazioni minime (somma sui bracci) prima del live. Assente ⇒ mai live. */
  minObservations?: number;
}

/** Parsa la threshold-config; assente/malformata ⇒ null (⇒ nessun live). */
export function parseThreshold(raw: string | undefined | null): ThresholdConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    return p as ThresholdConfig;
  } catch {
    return null;
  }
}

/**
 * Il contesto ha SUPERATO la soglia A33 (⇒ il bandit può guidare il live)? Vero SSE:
 * config presente, contesto in whitelist, e osservazioni ≥ minObservations (con
 * minObservations FINITO). Ogni altra combinazione ⇒ falso ⇒ live deterministico.
 */
export function isContextLive(
  key: BanditContextKey,
  cfg: ThresholdConfig | null,
  totalObservations: number,
): boolean {
  if (!cfg) return false;
  if (!Array.isArray(cfg.liveContexts) || !cfg.liveContexts.includes(key)) return false;
  const min = cfg.minObservations;
  if (typeof min !== 'number' || !Number.isFinite(min)) return false; // assente ⇒ mai live
  return totalObservations >= min;
}

// ── Decisione shadow pura ────────────────────────────────────────────────────

/** Esito di una decisione shadow (ciò che lo shell persiste e ritorna). */
export interface ShadowDecision {
  /** Modello che il bandit AVREBBE scelto (Thompson). */
  shadowModel: string;
  /** Il contesto è oltre soglia (⇒ il bandit può guidare il live)? */
  live: boolean;
  /** Modello effettivamente ritornato: deterministic sotto soglia, shadowModel sopra. */
  liveModel: string;
  /** liveModel diverge dal deterministico? (sotto soglia: sempre false). */
  diverged: boolean;
}

/**
 * Decisione shadow PURA: dati i posteriori e la threshold-config, campiona il braccio
 * (Thompson) e ritorna cosa si sarebbe scelto + cosa si ritorna LIVE. GARANZIA: se il
 * contesto non è live, `liveModel === deterministic` e `diverged === false`, sempre.
 * Nessun I/O: lo shell (`bandit.ts`) fornisce posteriori/soglia e persiste l'esito.
 */
export function decideShadow(
  ctx: ModelContext,
  deterministic: string,
  posteriors: ArmPosterior[],
  cfg: ThresholdConfig | null,
  rng: Rng,
): ShadowDecision {
  const key = banditContextKey(ctx);
  const shadowModel = chooseArm(posteriors, rng);
  const totalObs = posteriors.reduce((s, a) => s + a.observations, 0);
  const live = isContextLive(key, cfg, totalObs);
  const liveModel = live ? shadowModel : deterministic;
  return { shadowModel, live, liveModel, diverged: liveModel !== deterministic };
}
