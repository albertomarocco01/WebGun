// Configurazione ESLint con cui il gate linta le spec End-to-End.
//
// Perche' vive nella SKILL e non nel progetto: il gate deve dare lo stesso
// esito ovunque giri, anche su un progetto che questa configurazione non l'ha
// (ancora) ricevuta. `forge` la copia nella radice del progetto generato — la'
// serve all'editor di chi ci lavora. Precedente: `.sqlfluff` di Schema Forge,
// DECISIONI.md §8: i linter si configurano, il gate non si declassa.
//
// Ogni regola disattivata o aggiunta ha la sua motivazione sulla riga sopra.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      // I globali del runtime (process, console, fetch) li conosce TypeScript
      // con i suoi `@types/node`: `no-undef` su un file `.ts` produce solo falsi
      // positivi, ed e' disattivata anche nella raccomandazione ufficiale.
      "no-undef": "off",

      // Le attese fisse sono la fabbrica dei flaky: `waitForTimeout(500)` passa
      // sulla macchina veloce e fallisce in CI, poi qualcuno alza a 2000 e la
      // batteria diventa lenta invece che affidabile. Si aspetta una CONDIZIONE
      // — un locator visibile, una risposta di rete, una riga nel database.
      // Nessun altro controllo del gate la vede: `verify.mjs` legge l'esito, non
      // il modo in cui il test ci e' arrivato.
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name='waitForTimeout']",
        message: "Attesa fissa vietata: aspetta una condizione (locator, risposta di rete, riga nel database), non un numero di millisecondi.",
      }],

      // Una variabile inutilizzata in una spec e' quasi sempre un'asserzione
      // scritta a meta': il valore c'e', il controllo su quel valore no.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
