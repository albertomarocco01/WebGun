// Configurazione ESLint degli script di Gestionale Crafter.
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
      // `URL` e' un globale di Node dalla 10: mancava dall'elenco, e `no-undef`
      // lo segnalava come errore nei due test dell'epilogo (`verify.test.mjs`,
      // `admin-audit.test.mjs`). Il rilievo era vivo dal 2026-08-03 e
      // invisibile, perche' su questa macchina i `node_modules` della skill non
      // erano installati e ESLint non girava affatto — stesso difetto e stessa
      // correzione di schema-forge (P.8).
      // `Buffer` arriva il 2026-08-06 con la regola 3 riscritta (referto § H3):
      // per sapere se una chiave incollata nel codice dichiara `service_role`
      // se ne decodifica il payload, e la decodifica base64url di Node e'
      // quella. E' un globale come gli altri due, non una dipendenza.
      globals: { console: "readonly", process: "readonly", URL: "readonly", Buffer: "readonly" },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
