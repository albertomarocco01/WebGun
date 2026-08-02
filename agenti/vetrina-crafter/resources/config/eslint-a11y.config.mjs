// Configurazione con cui il passo `a11y-statica` linta le pagine pubbliche e la
// cucitura di un PROGETTO GENERATO.
//
// Viaggia con la SKILL, non col progetto, e si invoca con `--no-config-lookup`:
// il gate deve dare lo stesso esito ovunque giri, anche su un progetto che
// questa configurazione non l'ha mai ricevuta. E' il precedente del `.sqlfluff`
// di schema-forge e dell'`eslint-spec.config.mjs` di flow-sentinel
// (DECISIONI.md §8 — i linter si configurano, il gate non si declassa).
//
// Niente regole di stile e niente regole di correttezza generica: qui si guarda
// SOLO l'accessibilita', perche' e' l'unica cosa che questo passo dichiara di
// guardare. Il resto del codice lo giudicano `tsc` e i guardiani del progetto.
//
// Cosa questa configurazione NON vede, ed e' scritto anche nella SKILL:
// contrasti, ordine di tabulazione, senso di un messaggio d'errore, uso reale
// con uno screen reader. Sono di site-doctor e degli umani.

import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default [
  {
    // I file di una vetrina Next.js: pagine, layout e componenti. I `.ts`/`.js`
    // senza JSX non hanno markup da giudicare e restano fuori.
    files: ["**/*.jsx", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // NIENTE `project`: il controllo sui tipi lo fa il passo `tipi` con
        // `tsc --noEmit`, che gira nel progetto e con il suo tsconfig. Chiederlo
        // qui vorrebbe dire risolvere il tsconfig di un progetto qualsiasi da
        // dentro la cartella della skill, e fallire su ogni progetto che lo
        // tiene in un posto non standard.
      },
    },
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
];
