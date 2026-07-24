/**
 * @descrizione  Config ESLint complessità-only che la skill PORTA con sé. Invocata da
 *               `scan` con `--no-config-lookup` → gira anche su progetti senza ESLint
 *               configurato, e non collide con lo step di lint del progetto.
 *               Ristretta a JS/JSX di proposito: sotto `--no-config-lookup` non c'è il
 *               parser TS del progetto, quindi i .ts/.tsx/.vue li analizza `lizard`
 *               (vedi scan.mjs). Le soglie sono al livello "warn": `scan` legge i valori
 *               dal JSON e gradua warn/issue/block da sé (scan-lib.gradeFunction).
 *               La cognitive complexity (sonarjs) è opzionale: se il plugin non è
 *               installato, restano le regole built-in (niente block, ma il flagging c'è).
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

let sonar = null;
try {
  // Risolvi il plugin dal PROGETTO (cwd), NON dalla dir della skill: `setup --tools`
  // lo installa in <progetto>/node_modules, mentre questo file vive in
  // ~/.claude/skills/… → un bare `import 'eslint-plugin-sonarjs'` si risolverebbe
  // dalla skill (dove non c'è) e perderebbe SEMPRE il tier `block`.
  const req = createRequire(path.join(process.cwd(), 'package.json'));
  sonar = (await import(pathToFileURL(req.resolve('eslint-plugin-sonarjs')).href)).default;
} catch {
  // eslint-plugin-sonarjs non installato nel progetto: solo regole built-in.
  // ponytail: degradazione voluta — senza cognitive non scatta il tier `block`.
}

const config = {
  files: ['**/*.{js,mjs,cjs,jsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: {
    complexity: ['warn', 8],
    'max-depth': ['warn', 3],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-params': ['warn', 4],
    'max-nested-callbacks': ['warn', 3],
  },
};

if (sonar) {
  config.plugins = { sonarjs: sonar };
  config.rules['sonarjs/cognitive-complexity'] = ['warn', 10];
}

export default [config];
