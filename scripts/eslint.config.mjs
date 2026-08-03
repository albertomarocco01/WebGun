// Configurazione ESLint degli script della REGIA.
// Gli script della regia passano sotto i guardiani come quelli delle skill
// (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo correttezza
// e complessita', le stesse soglie di casa (schema-forge, gestionale-crafter,
// flow-sentinel, speed-demon, vetrina-crafter).
//
// Sta dentro `scripts/` e non in radice apposta: la radice della regia non e'
// un progetto npm, e un `package.json` li' direbbe a chi arriva che questo repo
// si costruisce e si pubblica. Non si costruisce niente: si fanno girare i
// guardiani su cinque file.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
