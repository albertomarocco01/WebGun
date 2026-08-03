// Configurazione ESLint degli script di Schema Forge.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le soglie di code-maniac.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      // `URL` e' un globale di Node dalla 10: mancava dall'elenco, e
      // `no-undef` lo segnalava come errore in `verify.test.mjs`. Il rilievo
      // era vivo dal 2026-08-03 e invisibile, perche' su questa macchina i
      // `node_modules` della skill non erano installati e ESLint non girava.
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
