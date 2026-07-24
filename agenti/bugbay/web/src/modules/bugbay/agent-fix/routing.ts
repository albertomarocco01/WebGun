/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Instradamento del modello per ogni fase di una run agentica.
 * Prima questa scelta era hardcoded caso per caso dentro esecuzione.ts
 * (interprete→Haiku, repro→Sonnet, fix heavy?Opus:Sonnet, piano→Opus,
 * escalation→Opus, giudice→Haiku). Qui è centralizzata in `deterministicModel(ctx)`:
 * la logica è BEHAVIOUR-PRESERVING — ogni contesto ritorna lo STESSO modello
 * che selezionava prima.
 *
 * v0.9 SHADOW BANDIT: `chooseModel(ctx)` è l'entry LIVE. Di default (senza
 * `BUGBAY_BANDIT=1`) è un passthrough puro su `deterministicModel` — nessun I/O,
 * comportamento invariato. Con `BUGBAY_BANDIT=1` delega all'hook shadow (bandit.ts),
 * che REGISTRA "quale modello avrebbe scelto il bandit" (Thompson sampling,
 * persistito e surfaceable) ma ritorna comunque la scelta DETERMINISTICA finché le
 * soglie A33 scritte (config_versions scope='threshold') non vengono superate per
 * quel contesto. Sotto soglia: live == deterministico, per ogni contesto (invariante
 * provata da test/bandit.test.mjs).
 *
 * MODULO FOGLIA (invariante di test): routing.ts NON importa a runtime lo shell
 * DB-backed del bandit (che tira dentro hub/ledger via import estensione-less, non
 * risolvibili dal runner nativo). L'hook è iniettato via `registerShadowHook`; lo
 * shell viene caricato PIGRAMENTE con un dynamic import (non-eager) solo al primo
 * routing con `BUGBAY_BANDIT=1`. Così `routing.test.mjs` continua a importare questo
 * modulo, e `chooseModel` resta deterministico finché (e se) l'hook si registra.
 * Unica fonte di verità delle costanti MODEL_*, da cui claude.ts le ri-esporta.
 *
 * @indice
 * - MODEL_HAIKU / MODEL_SONNET / MODEL_OPUS → id modello per la CLI headless
 * - ModelContext        → contesto di scelta (discriminato per fase)
 * - isHeavyFix          → un fix è "pesante" (→ Opus)? complessità/priorità/escalation
 * - deterministicModel  → fase → id modello (puro, deterministico, caratterizzabile)
 * - registerShadowHook  → inietta l'hook shadow del bandit (chiamato da bandit.installShadowHook)
 * - chooseModel         → entry LIVE: deterministico + shadow-record opzionale (bandit)
 */

/** Id modello passati a `claude --model` (login locale, niente API key). */
export const MODEL_HAIKU = 'haiku';
export const MODEL_SONNET = 'claude-sonnet-5';
export const MODEL_OPUS = 'claude-opus-4-8';

/**
 * Segnali che rendono un fix "pesante" e quindi degno di Opus. `tipoTask` NON
 * influenza il modello (oggi decide solo se pianificare, e il piano è sempre
 * Opus): lo teniamo qui per rendere esplicita — e testabile — quella invarianza.
 */
export interface FixSignals {
  complessita?: string | null;
  priority?: string | null;
  escalated?: boolean;
  tipoTask?: string;
}

/** Contesto di scelta del modello, discriminato per fase della run. */
export type ModelContext =
  | { phase: 'interprete' }
  | { phase: 'repro' }
  | { phase: 'piano' }
  | { phase: 'escalation' }
  | { phase: 'giudice' }
  | ({ phase: 'fix' } & FixSignals);

/**
 * Un fix è pesante (→ Opus) se la complessità è alta, la priorità è
 * Critica/Urgente, oppure dopo un'escalation. Estratto tale e quale dal ramo
 * `heavy` di esecuzione.ts: riusato sia per il modello sia per `planNeeded`,
 * così le due decisioni restano coerenti.
 */
export function isHeavyFix(s: FixSignals): boolean {
  return s.complessita === 'alta'
    || ['Critica', 'Urgente'].includes(s.priority ?? '')
    || s.escalated === true;
}

/**
 * Scelta DETERMINISTICA del modello per un contesto. Puro: nessun I/O, nessuno
 * stato. Sonnet è il default degli edit (rapido/economico), Opus solo dove il
 * ragionamento pesa (fix pesante, piano, escalation); Haiku per i task mini di solo
 * testo (interprete, giudice); repro con Sonnet. È il riferimento contro cui il
 * bandit shadow è vincolato (sotto soglia il live coincide con questo).
 */
export function deterministicModel(ctx: ModelContext): string {
  switch (ctx.phase) {
    case 'interprete':
    case 'giudice':
      return MODEL_HAIKU;
    case 'repro':
      return MODEL_SONNET;
    case 'piano':
    case 'escalation':
      return MODEL_OPUS;
    case 'fix':
      return isHeavyFix(ctx) ? MODEL_OPUS : MODEL_SONNET;
  }
}

/**
 * Hook shadow del bandit: `(ctx, deterministic) => modello live`. Iniettato da
 * `bandit.installShadowHook` (via dynamic import pigro) così routing.ts non dipende
 * a runtime dallo shell DB-backed. Contratto dell'hook: sotto soglia DEVE ritornare
 * `deterministic`; fail-safe verso `deterministic` su qualsiasi errore.
 */
export type ShadowHook = (ctx: ModelContext, deterministic: string) => string;

let shadowHook: ShadowHook | null = null;
let hookLoading = false;

/** Registra (o azzera con `null`) l'hook shadow. Chiamato una volta all'avvio del bandit. */
export function registerShadowHook(hook: ShadowHook | null): void {
  shadowHook = hook;
}

/**
 * Carica PIGRAMENTE lo shell del bandit al primo uso (dynamic import non-eager: non
 * viene risolto al load del modulo, quindi routing.ts resta importabile dal runner
 * nativo). Fire-and-forget: la prima decisione può ancora essere deterministica prima
 * che l'hook si registri — accettabile per lo shadow (si perde al più una riga). Ogni
 * errore di import (es. runner nativo che non risolve la catena estensione-less) è
 * ingoiato: l'hook resta null ⇒ deterministico.
 */
function ensureShadowHook(): void {
  if (shadowHook || hookLoading) return;
  hookLoading = true;
  import('./bandit')
    .then((m) => m.installShadowHook())
    .catch(() => {
      /* shell non caricabile (es. runner nativo): resta deterministico */
    });
}

/**
 * Entry LIVE del routing (firma invariata: tutti i call-site esistenti la usano).
 * Default (`BUGBAY_BANDIT` ≠ '1'): passthrough PURO su `deterministicModel` — zero
 * I/O, comportamento identico a prima. Con `BUGBAY_BANDIT=1`: attiva lo shadow bandit,
 * che registra la scelta ipotetica ma ritorna comunque il deterministico finché le
 * soglie A33 non sono superate. Finché l'hook non è caricato, ritorna deterministico.
 */
export function chooseModel(ctx: ModelContext): string {
  const deterministic = deterministicModel(ctx);
  if (process.env.BUGBAY_BANDIT !== '1') return deterministic;
  ensureShadowHook();
  if (!shadowHook) return deterministic;
  try {
    return shadowHook(ctx, deterministic);
  } catch {
    return deterministic;
  }
}
