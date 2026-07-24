/**
 * VARIANTE BENIGNA del soggetto di controllo (metà GREEN della coppia seminata).
 * Cambia solo dettagli innocui (VERSION + un export additivo): le invarianti
 * sondate reggono ⇒ NESSUN flip ⇒ il gate DEVE restare VERDE.
 * Se questa variante facesse mai diventare il gate rosso, sarebbe un FALSO ALLARME
 * e il meta-test fallirebbe: è la guardia contro un gate ipersensibile.
 */
export const THRESHOLD = 3;
export const VERSION = 2; // bump innocuo
export const NOTE = 'benign additive change'; // export additivo, nessuna invariante toccata
export function classify(n) {
  return n >= THRESHOLD ? 'high' : 'low';
}
