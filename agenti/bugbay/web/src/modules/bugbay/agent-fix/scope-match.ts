/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Matcher del perimetro di scrittura dell'agente, condiviso tra i provider REST
 * (provider-rest.ts) e — logicamente — l'hook PreToolUse della CLI claude. NB:
 * scope-guard.ts incorpora una COPIA equivalente di globToRegex/isPathAllowed
 * dentro lo script CJS dell'hook (che gira come processo separato senza bundler,
 * quindi non può importare da qui): le due copie vanno tenute allineate.
 *
 * @indice
 * - globToRegex   glob (src slash star-star, ecc) in RegExp su path slash-forward
 * - isPathAllowed true se rel è dentro writeScope e non è sensibile
 * - guardsFromEnv writeScope/sensitiveFiles da env (con default)
 */

/** Converte un glob (subset: doppio-star, star, letterali) in RegExp su path slash-forward. */
export function globToRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; }
      else re += '[^/]*';
    } else if ('.+^$(){}|[]\\'.includes(ch)) { re += '\\' + ch; }
    else re += ch;
  }
  return new RegExp('^' + re + '$');
}

/** rel (repo-relative, slash-forward) consentito: dentro writeScope e non sensibile. */
export function isPathAllowed(rel: string, writeScope: string[], sensitiveFiles: string[]): boolean {
  if (sensitiveFiles.some((g) => globToRegex(g).test(rel))) return false;
  return writeScope.some((g) => globToRegex(g).test(rel));
}

const DEFAULT_WRITE_SCOPE = ['src/**'];
// Sensibili di default = mai scrivibili dal Fixer, a PRESCINDERE da writeScope
// (isPathAllowed testa i sensibili PRIMA dello scope). Oltre ai segreti/config,
// includiamo i path che eseguono codice al commit/install/CI: un Edit lì diventa
// RCE quando il daemon committa o l'utente installa. Difesa-in-profondità che
// regge anche con writeScope allargato o fuori dall'happy-path della CLI.
const DEFAULT_SENSITIVE = [
  '**/auth/**', '**/middleware.*', '**/.env*', '**/*.config.*',
  '.git/**', '**/package.json', '**/package-lock.json', '**/.npmrc',
  '.github/**', '**/Dockerfile*', '**/*.sh',
];

/** Legge il perimetro dalle env impostate da bugbay dev (con default sicuri). */
export function guardsFromEnv(): { writeScope: string[]; sensitiveFiles: string[] } {
  const parse = (s: string | undefined, dflt: string[]) => {
    try { const a = JSON.parse(s || ''); return Array.isArray(a) && a.length ? a : dflt; } catch { return dflt; }
  };
  return {
    writeScope: parse(process.env.BUGBAY_WRITE_SCOPE, DEFAULT_WRITE_SCOPE),
    sensitiveFiles: parse(process.env.BUGBAY_SENSITIVE_FILES, DEFAULT_SENSITIVE),
  };
}
