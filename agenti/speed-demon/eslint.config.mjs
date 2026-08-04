// Configurazione ESLint degli script di Speed Demon.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le stesse soglie delle altre skill.
//
// Arriva il 2026-08-04, ultima delle cinque: fino a ieri questa skill non aveva
// ne' `package.json` ne' configurazione, quindi ESLint non era mai girato sui
// suoi script — e un guardiano che non gira e' un guardiano che passa (P.8,
// il `no-undef` di schema-forge vivo un giorno intero).

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      // `URL` e `fetch` sono globali di Node: il gate legge l'HTML servito e
      // risolve i percorsi del contratto.
      globals: {
        console: "readonly",
        process: "readonly",
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
