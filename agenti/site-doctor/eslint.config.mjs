// Configurazione ESLint degli script di Site Doctor.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le stesse soglie delle altre skill.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        // `fetch` e `URL` sono globali di Node: il gate legge l'HTML servito e
        // risolve i percorsi. `AbortSignal` serve al timeout di ogni richiesta:
        // un gate senza timeout non e' ne' verde ne' rosso, e' appeso.
        fetch: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
