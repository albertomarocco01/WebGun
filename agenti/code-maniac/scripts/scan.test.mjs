/**
 * @descrizione  Test della logica pura del motore deterministico (scan-lib.mjs).
 *               Copre i bug storici: skip dei tool mancanti/non configurati, scoping
 *               --staged, e la precedenza staged > script npm (FIX#1). Nessuna dipendenza:
 *               solo node:test integrato. Lancia con:  node --test scripts/scan.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planStep, classify, filterStaged, excerpt, guardFiles,
  COMPLEXITY_EXCLUDE, gradeFunction, parseEslintComplexity, parseLizardCsv,
  topHotspots, summarizeComplexity, recommendRouting, securitySignal,
} from './scan-lib.mjs';

// Step finti, modellati su quelli reali di scan.mjs.
const prettier = {
  id: 'prettier', fixer: true,
  stagedExt: /\.(m?[jt]sx?|css|md)$/i,
  scriptCmd: (fix) => (fix && true) ? ['run', 'format'] : null, // come se SCRIPTS.format esistesse
};
const eslint = {
  id: 'eslint', fixer: true,
  configFiles: ['eslint.config.js'],
  stagedExt: /\.(m?[jt]sx?)$/i,
  scriptCmd: (fix) => ['run', 'lint', ...(fix ? ['--', '--fix'] : [])],
};
const tsc = { id: 'tsc', configFiles: ['tsconfig.json'], scriptCmd: () => ['run', 'type-check'] };
const knip = { id: 'knip' }; // whole-program, niente script, niente config

const ctx = (over) => ({ installed: true, hasConfig: true, staged: null, fix: false, ...over });

test('tool non installato → skip "non installato"', () => {
  assert.deepEqual(
    planStep(prettier, ctx({ installed: false })),
    { status: 'skip', note: 'non installato' },
  );
});

test('config mancante → skip "non configurato" (no falso issue)', () => {
  const p = planStep(eslint, ctx({ hasConfig: false }));
  assert.equal(p.status, 'skip');
  assert.equal(p.note, 'non configurato');
});

test('step senza configFiles non richiede config', () => {
  const p = planStep(knip, ctx({ hasConfig: false }));
  assert.equal(p.status, 'run'); // knip non ha configFiles → la flag hasConfig è irrilevante
});

test('non-staged con script npm → preferisce npm run', () => {
  const p = planStep(prettier, ctx({ fix: true }));
  assert.equal(p.exec.kind, 'npm');
  assert.deepEqual(p.exec.args, ['run', 'format']);
});

test('eslint --fix → npm run lint -- --fix', () => {
  const p = planStep(eslint, ctx({ fix: true }));
  assert.deepEqual(p.exec.args, ['run', 'lint', '--', '--fix']);
});

test('FIX#1: --staged su step scopabile usa l\'invoke diretto, NON lo script npm', () => {
  const staged = ['src/a.ts', 'docs/b.md', 'img/c.png'];
  const p = planStep(prettier, ctx({ staged, fix: true })); // fix=true ⇒ lo script esisterebbe
  assert.equal(p.exec.kind, 'tool', 'in --staged deve vincere lo scoping, non lo script');
  assert.deepEqual(p.exec.files, ['src/a.ts', 'docs/b.md'], '.png escluso dal filtro');
  assert.match(p.scopeNote, /2 file in scope/);
});

test('--staged senza file pertinenti → skip "nessun file in scope"', () => {
  const p = planStep(prettier, ctx({ staged: ['img/c.png'] }));
  assert.deepEqual(p, { status: 'skip', note: 'nessun file in scope' });
});

test('--staged su step whole-program con script → npm run, intero repo', () => {
  const p = planStep(tsc, ctx({ staged: ['src/a.ts'] }));
  assert.equal(p.exec.kind, 'npm');
  assert.match(p.scopeNote, /intero repo/);
});

test('--staged su whole-program senza script → invoke su "."', () => {
  const p = planStep(knip, ctx({ staged: ['src/a.ts'] }));
  assert.equal(p.exec.kind, 'tool');
  assert.deepEqual(p.exec.files, ['.']);
  assert.match(p.scopeNote, /whole-program/);
});

test('classify: 0 = pass, ≠0 = issue', () => {
  assert.equal(classify(0), 'pass');
  assert.equal(classify(1), 'issue');
  assert.equal(classify(127), 'issue');
});

test('filterStaged tiene solo i match dell\'estensione', () => {
  assert.deepEqual(filterStaged(['a.ts', 'b.png', 'c.tsx'], /\.(ts|tsx)$/), ['a.ts', 'c.tsx']);
});

test('guardFiles: scarta i nomi coi metacaratteri di shell, tiene i legittimi', () => {
  const { safe, dropped } = guardFiles([
    'src/login.ts',            // ok
    'a&calc.js',               // & → exec
    'b|whoami.ts',             // pipe
    'c`id`.js',                // backtick
    'd$(rm).ts',               // $(...)
    'file con spazi.js',       // spazio: correttezza, NON sicurezza → resta
  ]);
  assert.deepEqual(safe, ['src/login.ts', 'file con spazi.js']);
  assert.deepEqual(dropped, ['a&calc.js', 'b|whoami.ts', 'c`id`.js', 'd$(rm).ts']);
});

test('excerpt: prime n righe non vuote, trimmate', () => {
  assert.equal(excerpt('uno\n\n  due  \ntre\nquattro', 2), 'uno\n  due');
});

// ── Complessità ───────────────────────────────────────────────────────────────

test('COMPLEXITY_EXCLUDE: esenta test/generati/declaration/vendored, non il sorgente', () => {
  for (const f of ['a.test.ts', 'a.spec.tsx', 'src/x.generated.ts', 'types/x.d.ts',
    '__tests__/y.js', 'dist/b.js', 'node_modules/p/i.js', 'coverage/r.js']) {
    assert.equal(COMPLEXITY_EXCLUDE.test(f), true, `${f} deve essere escluso`);
  }
  for (const f of ['src/login.ts', 'lib/calc.js', 'components/Hero.tsx']) {
    assert.equal(COMPLEXITY_EXCLUDE.test(f), false, `${f} NON deve essere escluso`);
  }
});

test('gradeFunction: cognitive è la sola metrica che porta a block (>25)', () => {
  assert.equal(gradeFunction({ cognitive: 30 }), 'block');
  assert.equal(gradeFunction({ cognitive: 18 }), 'issue');
  assert.equal(gradeFunction({ cognitive: 12 }), 'warn');
  assert.equal(gradeFunction({ cognitive: 5 }), 'pass');
  // uno switch piatto: CCN alto ma niente cognitive → al massimo issue, MAI block
  assert.equal(gradeFunction({ ccn: 40, nesting: 1 }), 'issue');
  assert.equal(gradeFunction({ ccn: 9 }), 'warn');
  assert.equal(gradeFunction({ nloc: 70 }), 'issue');
  assert.equal(gradeFunction({ params: 6 }), 'issue');
  assert.equal(gradeFunction({}), 'pass');
});

test('parseEslintComplexity: estrae i valori dai messaggi e raggruppa per funzione', () => {
  const json = JSON.stringify([{
    filePath: '/repo/src/x.js',
    messages: [
      { ruleId: 'sonarjs/cognitive-complexity', line: 3, message: 'Refactor this function to reduce its Cognitive Complexity from 30 to the 10 allowed.' },
      { ruleId: 'complexity', line: 3, message: "Function 'f' has a complexity of 12. Maximum allowed is 8." },
      { ruleId: 'no-unused-vars', line: 9, message: 'irrilevante' },
    ],
  }]);
  const funcs = parseEslintComplexity(json, (p) => p.replace(/^\/repo\//, ''));
  assert.equal(funcs.length, 1);
  assert.deepEqual(funcs[0], { file: 'src/x.js', line: 3, fn: '', cognitive: 30, ccn: 12 });
});

test('parseLizardCsv: parsa CCN/NLOC/param/riga, ignora le righe non-dato', () => {
  const csv = [
    '5,3,40,2,8,"foo@10-18@./src/a.js","./src/a.js","foo","foo(a, b)",10,18',
    '70,12,300,6,80,"big@5-90@./src/b.js","./src/b.js","big","big()",5,90',
    'intestazione,non,valida',
  ].join('\n');
  const funcs = parseLizardCsv(csv);
  assert.equal(funcs.length, 2);
  assert.deepEqual(funcs[0], { file: 'src/a.js', line: 10, fn: 'foo', ccn: 3, nloc: 5, params: 2 });
  assert.equal(funcs[1].ccn, 12);
  assert.equal(gradeFunction(funcs[1]), 'issue'); // ccn12/nloc70/par6 → issue (no cognitive → no block)
});

test('topHotspots: con churn ordina per complessità×churn; senza storia marca complexity-only', () => {
  const flagged = [
    { file: 'a.js', cognitive: 30, sev: 'block' },
    { file: 'b.js', cognitive: 12, sev: 'warn' },
  ];
  const withChurn = topHotspots(flagged, new Map([['a.js', 2], ['b.js', 10]]), 5);
  assert.equal(withChurn[0].file, 'b.js'); // 12×10=120 > 30×2=60
  assert.equal(withChurn[0].ranking, 'churn-weighted');

  const noChurn = topHotspots(flagged, new Map(), 5);
  assert.equal(noChurn[0].file, 'a.js'); // sola complessità: 30 > 12
  assert.equal(noChurn[0].ranking, 'complexity-only');
});

test('summarizeComplexity: conta per grado, esclude i test, status issue se block/issue', () => {
  const s = summarizeComplexity([
    { file: 'src/a.js', line: 1, cognitive: 30 },     // block
    { file: 'src/b.js', line: 1, ccn: 12 },           // issue
    { file: 'src/c.js', line: 1, cognitive: 12 },     // warn
    { file: 'a.test.ts', line: 1, cognitive: 99 },    // escluso
    { file: 'src/d.js', line: 1, cognitive: 2 },      // pass → fuori
  ]);
  assert.deepEqual(s.counts, { warn: 1, issue: 1, block: 1 });
  assert.equal(s.flagged.length, 3);
  assert.equal(s.status, 'issue');
});

test('summarizeComplexity: solo warn → status pass (non fa fallire)', () => {
  const s = summarizeComplexity([{ file: 'src/a.js', line: 1, cognitive: 12 }]);
  assert.equal(s.status, 'pass');
  assert.equal(s.counts.warn, 1);
});

// ── Routing (ponte complessità→tier deterministico) ────────────────────────────

test('recommendRouting: block → Opus + refactor dedicato', () => {
  const s = summarizeComplexity([{ file: 'src/a.js', line: 7, cognitive: 30 }]);
  const r = recommendRouting(s);
  assert.equal(r.tier, 'opus');
  assert.equal(r.dedicatedRefactor, true);
  assert.match(r.reason, /block.*src\/a\.js:7/);
});

test('recommendRouting: issue → Opus per l\'edit, senza refactor dedicato', () => {
  const s = summarizeComplexity([{ file: 'src/b.js', line: 3, ccn: 12 }]);
  const r = recommendRouting(s);
  assert.equal(r.tier, 'opus');
  assert.equal(r.dedicatedRefactor, false);
  assert.equal(r.mirror, false);
});

test('recommendRouting: solo pass/warn → Sonnet', () => {
  const s = summarizeComplexity([{ file: 'src/c.js', line: 1, cognitive: 12 }]); // warn
  assert.equal(recommendRouting(s).tier, 'sonnet');
});

test('recommendRouting: changed restringe la valutazione ai file del task', () => {
  const s = summarizeComplexity([
    { file: 'src/touched.js', line: 1, cognitive: 12 }, // warn nel task
    { file: 'src/other.js', line: 1, cognitive: 30 },   // block FUORI dal task
  ]);
  // il block è fuori dai file toccati → non deve forzare Opus
  assert.equal(recommendRouting(s, ['src/touched.js']).tier, 'sonnet');
  // repo-wide (nessun changed) → il block conta → Opus
  assert.equal(recommendRouting(s).tier, 'opus');
});

test('recommendRouting: issue che è top hotspot churn-weighted → mirror (Specchio+Opus)', () => {
  const s = summarizeComplexity(
    [{ file: 'src/hot.js', line: 5, ccn: 12 }],
    new Map([['src/hot.js', 20]]),
  );
  const r = recommendRouting(s, ['src/hot.js']);
  assert.equal(r.tier, 'opus');
  assert.equal(r.mirror, true);
  assert.match(r.reason, /Specchio/);
});

// ── Asse sicurezza del routing ─────────────────────────────────────────────────

test('securitySignal: path sensibile e/o toolFlag', () => {
  assert.deepEqual(securitySignal(['src/auth/login.ts', 'src/ui/Button.tsx']),
    { sensitive: true, files: ['src/auth/login.ts'], toolFlag: false });
  assert.equal(securitySignal(['src/ui/Button.tsx']).sensitive, false);
  assert.equal(securitySignal(['src/ui/Button.tsx'], true).toolFlag, true);
  assert.equal(securitySignal(null).sensitive, false); // full scan: nessun file noto
});

test('recommendRouting: sicurezza ALZA a Opus+Security anche su complessità nella norma', () => {
  const s = summarizeComplexity([{ file: 'src/auth.ts', line: 1, cognitive: 2 }]); // pass → base sonnet
  const r = recommendRouting(s, ['src/auth.ts'], securitySignal(['src/auth.ts']));
  assert.equal(r.tier, 'opus');
  assert.equal(r.securityReview, true);
  assert.equal(r.mirror, true);
  assert.match(r.reason, /sicurezza/);
});

test('recommendRouting: toolFlag (semgrep/gitleaks) forza Opus anche senza path sensibile', () => {
  const s = summarizeComplexity([{ file: 'src/x.ts', line: 1, cognitive: 2 }]);
  const r = recommendRouting(s, ['src/x.ts'], securitySignal(['src/x.ts'], true));
  assert.equal(r.tier, 'opus');
  assert.equal(r.securityReview, true);
});

test('recommendRouting: sicurezza NON abbassa un block già a refactor dedicato', () => {
  const s = summarizeComplexity([{ file: 'src/auth.ts', line: 3, cognitive: 30 }]); // block
  const r = recommendRouting(s, ['src/auth.ts'], securitySignal(['src/auth.ts']));
  assert.equal(r.tier, 'opus');
  assert.equal(r.dedicatedRefactor, true); // il block resta
  assert.equal(r.securityReview, true);    // + review di sicurezza
});

test('recommendRouting: nessun segnale sicurezza → securityReview false', () => {
  const s = summarizeComplexity([{ file: 'src/x.ts', line: 1, cognitive: 2 }]);
  assert.equal(recommendRouting(s, ['src/x.ts'], securitySignal(['src/x.ts'])).securityReview, false);
});
