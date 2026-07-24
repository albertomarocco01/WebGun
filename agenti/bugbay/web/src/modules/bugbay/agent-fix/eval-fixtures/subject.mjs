/**
 * SOGGETTO DI CONTROLLO del gate di eval (coppia di controllo seminata).
 *
 * È il file che le smoke-case curate sondano. Il META-TEST muta questo soggetto
 * con due varianti permanenti tenute in `control/` :
 *   • subject.good.mjs → cambiamento BENIGNO (le invarianti reggono → gate VERDE)
 *   • subject.bad.mjs  → REGRESSIONE (rompe `classify` → gate ROSSO)
 * Questa è la versione BASELINE (known-good): tutte le smoke-case passano.
 *
 * NB: `.mjs` ESM puro con estensioni esplicite negli import → eseguibile con
 * `node <file>` dentro il worktree isolato, senza type-stripping né node_modules.
 */

/** Soglia di classificazione (invariante sondata dalla control-case). */
export const THRESHOLD = 3;

/** Versione del soggetto: la variante benigna la incrementa (cambio innocuo). */
export const VERSION = 1;

/** classify(n) = 'high' sse n ≥ THRESHOLD. La variante BAD introduce un off-by-one. */
export function classify(n) {
  return n >= THRESHOLD ? 'high' : 'low';
}
