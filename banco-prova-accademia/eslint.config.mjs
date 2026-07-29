// ESLint del progetto generato: correttezza, tipi e ACCESSIBILITA'.
// La regola 5 della costituzione (accessibilita') non e' derogabile al
// minimalismo, quindi jsx-a11y non e' un vezzo: e' il passo `a11y` del gate.

import js from "@eslint/js";
import a11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", "node_modules/**", "src/lib/database.types.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "jsx-a11y": a11y },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { process: "readonly", FormData: "readonly" },
    },
    rules: {
      ...a11y.configs.recommended.rules,
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
    },
  },
];
