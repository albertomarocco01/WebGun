// Configurazione ESLint degli script di Launchpad.
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
      // Globali di Node usate dai gusci: `fetch` per l'HTML servito,
      // `Buffer` per decodificare il payload di un JWT (e' l'unico modo di
      // distinguere la chiave `service_role` da quella anonima, che hanno la
      // stessa forma), `URL` per i percorsi.
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        Buffer: "readonly",
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
