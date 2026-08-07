// Configurazione ESLint degli script di Site Doctor.
// Gli script degli agenti passano sotto i guardiani come qualsiasi altro
// codice (CLAUDE.md, Regola dei guardiani). Nessuna regola di stile: solo
// correttezza e complessita', le stesse soglie delle altre skill.

import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    // Cio' che il banco GENERA non e' codice di questa skill: e' l'uscita di un
    // finto `next build` (bundle, `_buildManifest.js`, chunk con `self` e
    // `window`), scritta apposta per essere servita a un browser. Farla passare
    // sotto le regole di Node produce errori veri su codice che nessuno di noi
    // ha scritto — e un guardiano che urla su output generato e' un guardiano
    // che si impara a ignorare (`DECISIONI.md` §8). I SORGENTI del banco
    // (`banco-sl.mjs`, `giro.mjs`, …) restano dentro: quelli sono nostri.
    ignores: ["scripts/banco-prova*/**"],
  },
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
        // Il banco del collaudo serve byte veri su HTTP e ha un modo di
        // rispondere «un byte al secondo» (classe NET1): gli servono `Buffer` e
        // i due timer periodici. Sono globali di Node quanto gli altri qui
        // sopra — mancavano perche' fino a D25 quel file era gitignorato e
        // nessun guardiano l'aveva mai letto.
        Buffer: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
    },
  },
];
