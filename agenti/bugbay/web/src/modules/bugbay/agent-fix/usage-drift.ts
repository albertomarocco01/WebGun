/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Predicato di DRIFT del formato usage — modulo FOGLIA (nessun import), testabile
 * dal runner nativo `node --test`. Il breaker del budget deve FAIL-CLOSED quando il
 * formato JSONL di ccusage/Claude cambia forma: se restasse "budget OK" su dati che
 * non capiamo, la spesa autonoma diventerebbe illimitata. Segnala drift quando NON è
 * stato estratto alcun usage MA i file contenevano dati che DOVREBBERO contenerne.
 *
 * Il vecchio criterio (solo `assistantLike>=3 && usageExtracted===0`) falliva OPEN
 * sui casi che diceva di coprire: discriminante `type` rinominato o wrapper
 * `message` rimosso → `assistantLike=0` → drift=false → entries vuote → budget OK.
 * Qui aggiungiamo due segnali indipendenti dallo schema `assistant`.
 *
 * @indice
 * - UsageScanCounts → contatori raccolti durante lo scan dei JSONL
 * - isUsageDrift     → true se lo scan non ha usage ma i file suggeriscono che dovrebbe
 */

export interface UsageScanCounts {
  /** Entry di usage effettivamente estratti. */
  usageExtracted: number;
  /** Righe `type==='assistant'` con un `message` oggetto (schema noto). */
  assistantLike: number;
  /** Righe "transcript-like": hanno un campo `type`/`message`/`usage` (schema-agnostico). */
  recognizable: number;
  /** Righe che parsano almeno come JSON-oggetto. */
  parsedLines: number;
  /** Almeno un file JSONL non-vuoto è stato letto. */
  sawContent: boolean;
}

/**
 * true = formato non riconosciuto ⇒ budget UNKNOWN ⇒ breaker CHIUSO. Nessun usage
 * estratto E: (a) schema assistant visto ma usage sparito, oppure (b) molte righe
 * transcript-like senza alcun usage (schema cambiato), oppure (c) file non-vuoti
 * ma nessun JSON valido (corruzione/rewrite). "Nessun file / tutto vuoto" NON è
 * drift (installazione fresca senza run = zero spesa legittima).
 */
export function isUsageDrift(c: UsageScanCounts): boolean {
  if (c.usageExtracted > 0) return false;
  return (
    c.assistantLike >= 3 ||
    c.recognizable >= 5 ||
    (c.sawContent && c.parsedLines === 0)
  );
}
