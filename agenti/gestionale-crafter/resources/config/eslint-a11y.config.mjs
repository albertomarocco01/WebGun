// Configurazione ESLint con cui il gate misura l'accessibilita' delle viste.
//
// PERCHE' VIVE NELLA SKILL E NON NEL PROGETTO. Fino al 2026-08-06 il passo
// `a11y` lanciava `npx eslint <cartelle>` dentro il progetto, cioe' con la
// configurazione che il progetto AUDITATO si e' scritto. Misurato quel giorno
// (referto § H8): una `eslint.config.mjs` che guarda i file e non ha nessuna
// regola attiva fa uscire ESLint 0 su un `<img src="/logo.png" />` senza `alt`,
// e il passo chiudeva
//
//     OK    accessibilita' (eslint jsx-a11y)
//             controllate: src/app/admin, src/components
//
// cioe' il gate dichiarava accessibile una vista che non lo era, perche' aveva
// chiesto il permesso all'imputato. Le due skill sorelle facevano gia' il
// contrario — `flow-sentinel` linta le spec con
// `--no-config-lookup --config <skill>/resources/config/eslint-spec.config.mjs`,
// `schema-forge` passa il proprio `.sqlfluff` — ed e' la stessa regola:
// DECISIONI.md §8, i linter si configurano, il gate non si declassa.
//
// Il progetto resta libero di avere la sua configurazione, e serve all'editor di
// chi ci lavora. Questa decide il VERDETTO, e viaggia con la skill.
//
// Ogni regola disattivata o aggiunta ha la sua motivazione sulla riga sopra.

import jsxA11y from "eslint-plugin-jsx-a11y";
import parser from "@typescript-eslint/parser";

export default [
  {
    // Le viste del gestionale sono `.tsx`; i `.ts` entrano perche' un componente
    // puo' costruire markup senza JSX nel nome del file.
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser,
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      // La raccomandazione ufficiale del plugin, presa per intero e poi
      // corretta dove la costituzione della casa e' piu' severa. Prenderla
      // «a mano», regola per regola, significherebbe che un aggiornamento del
      // plugin non arriva mai fin qui.
      ...jsxA11y.flatConfigs.recommended.rules,

      // Regola 5 della costituzione: l'accessibilita' non si sacrifica al
      // minimalismo. Un gestionale si usa otto ore al giorno con la tastiera, e
      // queste quattro sono le vie con cui una vista diventa inservibile
      // proprio li'. Nella raccomandazione ufficiale sono `warn` o assenti: qui
      // valgono `error`, perche' un `warn` non fa uscire ESLint diverso da 0 e
      // un passo che non puo' diventare rosso non e' un passo.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/control-has-associated-label": "error",
    },
  },
];
