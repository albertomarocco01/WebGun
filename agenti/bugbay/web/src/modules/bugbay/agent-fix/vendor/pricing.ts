/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * VENDORED — sottoinsieme del listino prezzi Claude, hash-pinnato.
 *
 * PROVENIENZA: prezzi pubblici Anthropic per 1M token (https://www.anthropic.com/pricing,
 * modellazione allineata a ccusage `@ccusage/*` → LiteLLM `model_prices_and_context_window.json`,
 * MIT). Estratto e CONGELATO qui deliberatamente: il ledger duale NON deve dipendere
 * da una fetch di rete a runtime né da una dep npm che possa driftare sotto i piedi
 * del breaker di budget. Aggiornare a mano (bump di VENDOR_PIN) quando i prezzi cambiano.
 *
 * VENDOR_PIN: pricing-2026-01 — subset {opus4, sonnet4/3.x, haiku3.5/4, haiku3}.
 * Unità: USD per 1_000_000 token. cacheWrite = scrittura cache 5m (1.25×input);
 * cacheRead = lettura cache (0.1×input). Fonte dei moltiplicatori: Anthropic prompt-caching.
 *
 * @indice
 * - VENDOR_PIN        → etichetta di versione del subset congelato
 * - TokenUsage        → conteggi token di una singola chiamata (shape ccusage/JSONL)
 * - costFromTokens    → costo USD di una chiamata dal listino (modello ignoto ⇒ tariffa Opus, conservativa)
 */

export const VENDOR_PIN = 'pricing-2026-01' as const;

/** Prezzo per 1M token di un tier di modello. */
interface ModelPrice {
  input: number;
  output: number;
  cacheWrite: number; // scrittura cache (5m): 1.25 × input
  cacheRead: number; // lettura cache: 0.10 × input
}

/**
 * Listino per PREFISSO di model id (match dal più specifico). Anthropic versiona i
 * modelli con date/suffissi (`claude-opus-4-20250514`, `claude-3-5-haiku-...`):
 * il match a prefisso assorbe le minor senza inseguire ogni snapshot.
 */
const PRICE_TABLE: ReadonlyArray<readonly [prefix: string, price: ModelPrice]> = [
  // Opus (tutte le 4.x, incl. 4.8): input 15 / output 75.
  ['claude-opus-4', { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }],
  ['claude-3-opus', { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 }],
  // Sonnet (4.x e 3.5/3.7): input 3 / output 15.
  ['claude-sonnet-4', { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  ['claude-3-7-sonnet', { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  ['claude-3-5-sonnet', { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }],
  // Haiku 3.5 / 4: input 0.80 / output 4.
  ['claude-haiku-4', { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 }],
  ['claude-3-5-haiku', { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 }],
  // Haiku 3 (legacy): input 0.25 / output 1.25.
  ['claude-3-haiku', { input: 0.25, output: 1.25, cacheWrite: 0.3, cacheRead: 0.03 }],
];

/** Conteggi token di una chiamata (nomi = shape usage di ccusage/JSONL Anthropic). */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

function priceFor(model: string | undefined | null): ModelPrice | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();
  for (const [prefix, price] of PRICE_TABLE) {
    if (m.includes(prefix)) return price;
  }
  return undefined;
}

// Tariffa più CARA del listino (Opus): fallback per modello ignoto. Un id non a
// listino (es. un nuovo modello) NON deve costare 0 — sarebbe un under-count che
// tiene il breaker aperto oltre il budget (fail-open sul costo). Stimare al rialzo
// fa scattare il gate prima: fail-CLOSED (recuperabile), mai spesa illimitata.
const FALLBACK_PRICE: ModelPrice = PRICE_TABLE[0][1];

/**
 * Costo USD di UNA chiamata dai token, via listino vendorizzato. Modello IGNOTO ⇒
 * tariffa conservativa (Opus, la più cara): il costo dell'envelope, se presente, resta
 * l'autorità nel ledger; questo è il fallback di calcolo, volutamente al rialzo per
 * non sotto-contare. Somma input+output+cache-write+cache-read pesati.
 */
export function costFromTokens(model: string | undefined | null, u: TokenUsage): number {
  const p = priceFor(model) ?? FALLBACK_PRICE;
  const inTok = u.input_tokens || 0;
  const outTok = u.output_tokens || 0;
  const cw = u.cache_creation_input_tokens || 0;
  const cr = u.cache_read_input_tokens || 0;
  return (
    (inTok / 1_000_000) * p.input +
    (outTok / 1_000_000) * p.output +
    (cw / 1_000_000) * p.cacheWrite +
    (cr / 1_000_000) * p.cacheRead
  );
}
