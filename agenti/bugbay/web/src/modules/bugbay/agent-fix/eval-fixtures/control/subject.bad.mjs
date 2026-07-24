/**
 * VARIANTE DIFETTOSA del soggetto di controllo (metà RED della coppia seminata).
 * Introduce una REGRESSIONE reale: `classify(THRESHOLD)` ora ritorna 'low' invece
 * di 'high' (off-by-one `>` al posto di `>=`). La smoke-case `control-invariant`
 * passa alla baseline e FALLISCE qui ⇒ un flip pass→fail ⇒ il gate DEVE diventare
 * ROSSO. È la garanzia che un gate sempre-verde è impossibile.
 */
export const THRESHOLD = 3;
export const VERSION = 1;
export function classify(n) {
  return n > THRESHOLD ? 'high' : 'low'; // BUG seminato: perde il confine THRESHOLD
}
