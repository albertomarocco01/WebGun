// Configurazione ESLint degli script di Flow Sentinel.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le soglie di code-maniac.
//
// La configurazione con cui il gate linta le SPEC di un progetto e' un'altra:
// `resources/config/eslint-spec.config.mjs`, perche' viaggia con la skill e
// finisce anche nel progetto generato.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", fetch: "readonly", AbortSignal: "readonly" },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
