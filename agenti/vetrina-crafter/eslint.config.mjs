// Configurazione ESLint degli script di Vetrina Crafter.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le soglie di code-maniac.
//
// La configurazione con cui il gate linta l'ACCESSIBILITA' delle pagine di un
// progetto generato e' un'altra: `resources/config/eslint-a11y.config.mjs`,
// perche' viaggia con la skill e deve dare lo stesso esito su ogni progetto,
// anche su uno che non l'ha mai ricevuta (DECISIONI.md §8).

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
        fetch: "readonly",
        URL: "readonly",
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
