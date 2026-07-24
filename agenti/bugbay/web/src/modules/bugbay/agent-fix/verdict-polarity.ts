/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * POLARITÀ DEL VERDETTO (leaf puro, zero import) — mappa un verdetto grezzo a
 * positivo / negativo / null. Estratto come leaf (come `secret-scan`/`constant-time`)
 * così è importabile sia dai moduli DB (ace, distiller credit, retrieval) sia dal
 * runner nativo `node:test`. Prima la mappa viveva SOLO dentro ace.ts (non riusabile):
 * il ranking (F3) e il credit-assignment (F5) hanno bisogno della stessa nozione di
 * "fix riuscito vs da evitare", quindi vive qui, unica fonte di verità.
 *
 * @indice
 * - verdictPolarity → 'positive' | 'negative' | null (intermedio/ignoto = null)
 */

// Verdetti a polarità nota. Normalizzati lowercase; l'input può essere inglese o
// italiano (es. 'Risolto' implicito). Coincide col vocabolario di scores/signals.
const POSITIVE: ReadonlySet<string> = new Set([
  'approved', 'approve', 'merged', 'merge', 'resolved', 'risolto', 'pass', 'passed', 'accepted', 'fixed',
]);
const NEGATIVE: ReadonlySet<string> = new Set([
  'discarded', 'discard', 'rejected', 'reject', 'fail', 'failed', 'invalid', 'regression',
]);

/** Polarità del verdetto, o null se intermedio/ignoto (→ nessun segnale). */
export function verdictPolarity(verdict: string): 'positive' | 'negative' | null {
  const v = verdict.trim().toLowerCase();
  if (POSITIVE.has(v)) return 'positive';
  if (NEGATIVE.has(v)) return 'negative';
  return null;
}
