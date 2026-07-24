/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Confronto stringhe a tempo COSTANTE — modulo FOGLIA (nessun import), Edge-safe
 * (niente node:crypto: il middleware Next può girare in Edge runtime). Il confronto
 * `===` sul token del daemon corto-circuita al primo carattere diverso → è un
 * oracolo di timing che, su un host multi-utente, aiuta a recuperare il token byte
 * per byte. Qui il tempo dipende solo dalla lunghezza, non dal contenuto.
 *
 * @indice
 * - timingSafeEqual → true se a===b, in tempo indipendente dal contenuto
 */

/** true se `a` e `b` sono uguali, confronto a tempo costante sul contenuto. */
export function timingSafeEqual(a: string, b: string): boolean {
  // La lunghezza è comunque osservabile; per il resto niente short-circuit.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
