/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Scanner segreti — modulo FOGLIA (nessun import relativo): riusabile e testabile
 * dal runner nativo `node --test`. Blocca chiavi/credenziali nel contenuto che ACE
 * committa in git (knowledge.ts): un segreto lì finirebbe nella history PERMANENTE
 * del repo. Pattern dei formati-chiave reali (incl. Gemini/DeepSeek, i due già
 * committati una volta su questo progetto) + assegnazioni credenziali. Falso
 * positivo = bullet saltato (best-effort: perdere un bullet non è critico, un
 * segreto in git sì).
 *
 * @indice
 * - containsSecret → true se il testo contiene un segreto plausibile
 */

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/,                   // Anthropic
  /\bsk-[A-Za-z0-9]{20,}\b/,                      // OpenAI / DeepSeek
  /\bAKIA[0-9A-Z]{16}\b/,                         // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}/,                      // Google / Gemini
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,              // GitHub token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,            // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,          // chiave privata PEM
  /[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/i, // credenziali in URL user:pass@host
  /(?:api[_-]?key|secret|token|password|passwd|bearer)["'\s]*[:=]["'\s]*[A-Za-z0-9_-]{20,}/i, // assegnazione
];

/** true se `text` contiene un segreto plausibile (chiave/credenziale). */
export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}
