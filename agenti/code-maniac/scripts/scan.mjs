#!/usr/bin/env node
/**
 * Code Maniac — Motore deterministico (CLI)
 *
 * Esegue la batteria di strumenti deterministici nell'ordine economico→costoso,
 * salta con grazia i tool non installati o non configurati, e stampa un report
 * sintetico. NON stampa l'output grezzo dei tool: solo pass / issue / skip + un
 * estratto. L'LLM legge questo report, non i log integrali → token risparmiati.
 * La logica di decisione (skip / scope / comando / complessità) vive in
 * scan-lib.mjs ed è coperta da scan.test.mjs.
 *
 * Uso:
 *   node scan.mjs            scansione completa (sola lettura)
 *   node scan.mjs --fix      applica gli autofix sicuri (Prettier --write, ESLint --fix)
 *   node scan.mjs --staged   limita Prettier/ESLint/complessità ai file in stage (git)
 *   node scan.mjs --since <ref>  scopa gli step scopabili al diff <ref>...HEAD (review di branch/PR)
 *   node scan.mjs --json     output JSON (per pipeline/agenti); exit 1 se ci sono problemi
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  planStep, classify, excerpt, COMPLEXITY_EXCLUDE, guardFiles,
  parseEslintComplexity, parseLizardCsv, summarizeComplexity, recommendRouting, securitySignal,
} from './scan-lib.mjs';

const argv = process.argv.slice(2);
const args = new Set(argv);
const FIX = args.has('--fix');
const STAGED = args.has('--staged');
const JSON_OUT = args.has('--json');
/** Valore di `--since <ref>` (diff <ref>...HEAD), o null. */
const SINCE = (() => {
  const i = argv.indexOf('--since');
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
})();
const WIN = process.platform === 'win32';
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Estensioni sorgente per lo scoping della complessità (poliglotta, allineata a lizard). */
const COMPLEXITY_SRC = /\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|py|go|rb|php|cc?|cpp|hpp?|cs|java|kt|swift|rs|scala|lua)$/i;
/** Conta le righe non vuote di un output (per il meter di risparmio token). */
const countLines = (s) => (s ? s.split('\n').filter((l) => l.trim()).length : 0);

/** Esegue un comando; ritorna { code, out } senza mai lanciare. */
function run(cmd, cmdArgs, { capture = true } = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    shell: WIN, // su Windows i .cmd (npx, ecc.) servono shell
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (r.error) return { code: 127, out: '' };
  return { code: r.status ?? 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Tool locale al progetto: presente in node_modules/.bin? (check filesystem, deterministico) */
function hasLocalBin(name) {
  const base = path.join(process.cwd(), 'node_modules', '.bin', name);
  return existsSync(base) || existsSync(`${base}.cmd`) || existsSync(`${base}.ps1`);
}

/** Tool globale: presente nel PATH? (where su Windows, which altrove) */
function onPath(cmd) {
  const r = spawnSync(WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return (r.status ?? 1) === 0;
}

/** Esiste almeno uno dei file di config indicati? */
function hasConfig(files) {
  return files.some((f) => existsSync(f));
}

/** File in stage (Added/Copied/Modified/Renamed), [] se nessuno o non un repo git. */
function stagedFiles() {
  const { code, out } = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return code === 0 ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

/**
 * File cambiati in `<ref>...HEAD` (merge-base, standard per review di PR).
 * Se il ref NON risolve, abortisce con exit 2 invece di ritornare []: una lista vuota
 * da ref-invalido farebbe saltare tutti gli step scopati → un falso "0 problemi / tutto
 * pulito" su una review che non ha guardato nulla (correttezza, priorità n°1).
 */
function changedSince(ref) {
  // NB: niente `^{commit}` — su Windows (shell:true) `^` è l'escape di cmd.exe e mangia
  // l'argomento. `rev-parse --verify --quiet <ref>` basta a distinguere ref valido da invalido.
  if (run('git', ['rev-parse', '--verify', '--quiet', ref]).code !== 0) {
    console.error(`\nCode Maniac — scan: '--since ${ref}' non risolve a un commit. Interrompo (evito un falso "tutto pulito").`);
    process.exit(2);
  }
  const { code, out } = run('git', ['diff', '--name-only', '--diff-filter=ACMR', `${ref}...HEAD`]);
  return code === 0 ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

/** Path relativo alla root, slash unix, senza `./` iniziale — per allineare i path di tool e git. */
function toRel(p) {
  let s = String(p).replace(/\\/g, '/');
  const cwd = process.cwd().replace(/\\/g, '/');
  if (s.toLowerCase().startsWith(cwd.toLowerCase())) s = s.slice(cwd.length).replace(/^\//, '');
  return s.replace(/^\.\//, '');
}

/**
 * Mappa file→numero-di-commit-che-l'hanno-toccato negli ultimi 12 mesi.
 * Map vuota se il repo è shallow (clone CI) o senza storia: in quel caso gli
 * hotspot si ordinano per sola complessità (vedi topHotspots). `-M` segue i
 * rinomini; `--diff-filter=ACMR` scarta le cancellazioni.
 */
function churnMap() {
  if (run('git', ['rev-parse', '--is-shallow-repository']).out.trim() === 'true') return new Map();
  const { code, out } = run('git', ['log', '-M', '--since=12 months ago', '--name-only', '--format=', '--diff-filter=ACMR']);
  if (code !== 0) return new Map();
  const m = new Map();
  for (const line of out.split('\n')) {
    const f = toRel(line.trim());
    if (!f) continue;
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  return m;
}

/** Script npm del progetto (name→cmd); {} se package.json assente/illeggibile. */
function pkgScripts() {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).scripts || {};
  } catch { return {}; }
}
const SCRIPTS = pkgScripts();

/** Primo script di verifica convenzioni del progetto (versione report, non :strict/:fix), o null. */
function conventionsScript() {
  const names = Object.keys(SCRIPTS).filter((n) => /conven|verifica/i.test(n));
  return names.find((n) => !/:(strict|fix|ci)$/.test(n)) || names[0] || null;
}

/** Config semgrep: ruleset locale se presente (gira offline), altrimenti 'auto' (richiede rete). */
function semgrepConfig() {
  return ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', 'semgrep.yaml', '.semgrep'].find((f) => existsSync(f)) || 'auto';
}

/**
 * Esegue l'analisi di complessità: lizard se presente (poliglotta, dà CCN/NLOC/param,
 * gestisce TS), altrimenti la config ESLint complessità-only della skill, ristretta
 * a JS/JSX (evita il crash del parser su TS sotto --no-config-lookup). Ritorna
 * { tool, code, out }.
 */
function invokeComplexity(files = ['.']) {
  if (onPath('lizard')) return { tool: 'lizard', ...run('lizard', ['--csv', ...files]) };
  const cfg = path.join(SKILL_DIR, 'resources', 'eslint-complexity.config.mjs');
  // Sotto --no-config-lookup non c'è il parser TS del progetto: passa a ESLint solo
  // JS/JSX (i .ts li coprirebbe lizard). Scope esplicito vuoto → niente da analizzare.
  const jsFiles = files.length === 1 && files[0] === '.' ? ['.'] : files.filter((f) => /\.(m?js|cjs|jsx)$/i.test(f));
  if (jsFiles.length === 0) return { tool: 'eslint', code: 0, out: '[]' };
  return { tool: 'eslint', ...run('npx', ['--no-install', 'eslint', ...jsFiles, '--no-config-lookup', '--config', cfg, '-f', 'json']) };
}

/** Residuo leggibile dagli hotspot: testata coi conteggi + le funzioni peggiori. */
function formatHotspots({ counts, hotspots }) {
  const head = `${counts.block} block · ${counts.issue} issue · ${counts.warn} warn — top:`;
  const lines = hotspots.map((h) => {
    const metrics = [
      h.cognitive != null ? `cog ${h.cognitive}` : null,
      h.ccn != null ? `ccn ${h.ccn}` : null,
      h.nesting != null ? `nest ${h.nesting}` : null,
      h.nloc != null ? `nloc ${h.nloc}` : null,
      h.params != null ? `par ${h.params}` : null,
    ].filter(Boolean).join(' ');
    const churn = h.ranking === 'churn-weighted' ? `  churn ${h.churn}×` : '';
    return `${h.file}:${h.line} ${h.fn || '?'}  ${metrics} [${h.sev}]${churn}`;
  });
  return [head, ...lines].join('\n');
}

/**
 * I passi della pipeline, dal più economico al più costoso.
 * - `stagedExt`: se presente, lo step è scopabile ai soli file in stage (test sul path).
 *   Gli step senza `stagedExt` sono analisi whole-program: girano sull'intero repo
 *   anche con --staged.
 * - `configFiles`: se presente e nessuno di quei file esiste, lo step è saltato
 *   (`non configurato`) invece di sparare un falso `issue`.
 * - `scriptCmd(fix)`: se il progetto ha uno script npm equivalente (es. `next lint`),
 *   lo si preferisce per rispettarne la config — tranne in --staged sugli step scopabili.
 * - `complexity`: step speciale, gradua dal JSON/CSV del tool (non dall'exit code) e
 *   stampa gli hotspot ordinati per complessità×churn.
 */
const STEPS = [
  {
    id: 'prettier', label: 'Formattazione (Prettier)', fixer: true,
    check: () => hasLocalBin('prettier'),
    stagedExt: /\.(m?[jt]sx?|cjs|cts|mts|css|scss|less|html|json5?|jsonc|md|mdx|ya?ml|vue|svelte)$/i,
    scriptCmd: (fix) => (fix && SCRIPTS.format) ? ['run', 'format'] : null,
    invoke: (files) => run('npx', ['--no-install', 'prettier', FIX ? '--write' : '--check', ...files]),
  },
  {
    id: 'eslint', label: 'Lint (ESLint)', fixer: true,
    check: () => hasLocalBin('eslint'),
    configFiles: [
      'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts',
      '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml',
    ],
    stagedExt: /\.(m?[jt]sx?|cjs|cts|mts|vue|svelte)$/i,
    scriptCmd: (fix) => SCRIPTS.lint ? ['run', 'lint', ...(fix ? ['--', '--fix'] : [])] : null,
    invoke: (files) => run('npx', ['--no-install', 'eslint', ...files, ...(FIX ? ['--fix'] : [])]),
  },
  {
    id: 'tsc', label: 'Tipi (tsc)',
    check: () => hasLocalBin('tsc'),
    configFiles: ['tsconfig.json'],
    scriptCmd: () => SCRIPTS['type-check'] ? ['run', 'type-check'] : null,
    invoke: () => run('npx', ['--no-install', 'tsc', '--noEmit']),
  },
  {
    id: 'complessita', label: 'Complessità funzioni (cognitive/CCN/nesting)', complexity: true,
    check: () => hasLocalBin('eslint') || onPath('lizard'),
  },
  {
    id: 'convenzioni', label: 'Convenzioni di progetto (script custom)',
    check: () => conventionsScript() !== null,
    scriptCmd: () => ['run', conventionsScript()],
  },
  {
    id: 'depcruise', label: 'Architettura (dependency-cruiser)',
    check: () => hasLocalBin('depcruise'),
    configFiles: [
      '.dependency-cruiser.js', '.dependency-cruiser.cjs', '.dependency-cruiser.mjs', '.dependency-cruiser.json',
    ],
    invoke: () => run('npx', ['--no-install', 'depcruise', '--validate', '.']),
  },
  {
    id: 'knip', label: 'Codice morto (knip)',
    check: () => hasLocalBin('knip'),
    invoke: () => run('npx', ['--no-install', 'knip']),
  },
  {
    id: 'jscpd', label: 'Duplicati (jscpd)',
    check: () => hasLocalBin('jscpd'),
    // jscpd v5: il binario resta `jscpd`; rispetta `.gitignore` di default → nessun flag.
    invoke: () => run('npx', ['--no-install', 'jscpd', '.']),
  },
  {
    id: 'semgrep', label: 'Regole (semgrep)',
    check: () => onPath('semgrep'),
    invoke: () => run('semgrep', ['--error', '--quiet', '--config', semgrepConfig(), '.']),
  },
  {
    id: 'gitleaks', label: 'Segreti (gitleaks)',
    check: () => onPath('gitleaks'),
    invoke: () => run('gitleaks', ['detect', '--no-banner', '--redact']),
  },
];

// I file cambiati che guidano lo scoping e il routing: stage o diff <ref>...HEAD.
// Guard di sicurezza: i nomi coi metacaratteri di shell non entrano nello scoping.
const rawChanged = STAGED ? stagedFiles() : SINCE ? changedSince(SINCE) : null;
const { safe: staged, dropped: unsafeFiles } = rawChanged ? guardFiles(rawChanged) : { safe: null, dropped: [] };
const SCOPED = STAGED || Boolean(SINCE);
let churn = null; // calcolato pigramente: solo se serve allo step di complessità
let complexitySummary = null; // per la raccomandazione di routing a valle
let rawLines = 0; // righe di output grezzo prodotte dai tool
let shownLines = 0; // righe effettivamente mostrate all'LLM (residuo)
const results = [];
for (const step of STEPS) {
  const plan = planStep(step, {
    installed: step.check(),
    hasConfig: step.configFiles ? hasConfig(step.configFiles) : true,
    staged,
    fix: FIX,
  });
  if (plan.status === 'skip') {
    results.push({ id: step.id, label: step.label, status: 'skip', note: plan.note });
    continue;
  }

  if (step.complexity) {
    // In modalità scopata analizza SOLO i sorgenti cambiati (review più rapida e
    // pertinente: dice se le funzioni *toccate* sforano, non tutto il repo).
    let files = ['.'];
    if (SCOPED) {
      files = (staged ?? []).filter((f) => COMPLEXITY_SRC.test(f) && !COMPLEXITY_EXCLUDE.test(f));
      if (files.length === 0) {
        results.push({ id: step.id, label: step.label, status: 'skip', note: 'nessun file sorgente in scope' });
        continue;
      }
    }
    const inv = invokeComplexity(files);
    if (churn === null) churn = churnMap();
    const funcs = inv.tool === 'lizard'
      ? parseLizardCsv(inv.out, toRel)
      : parseEslintComplexity(inv.out, toRel);
    const summary = summarizeComplexity(funcs, churn);
    complexitySummary = summary;
    const exc = (summary.status === 'issue' || summary.counts.warn) ? formatHotspots(summary) : '';
    rawLines += countLines(inv.out);
    shownLines += countLines(exc);
    results.push({
      id: step.id, label: step.label, status: summary.status,
      scopeNote: `${inv.tool}${SCOPED ? `, ${files.length} file in scope` : ''}${summary.hotspots[0]?.ranking === 'complexity-only' ? ', no storia git → solo complessità' : ''}`,
      excerpt: exc,
      complexity: { counts: summary.counts, hotspots: summary.hotspots },
    });
    continue;
  }

  const { code, out } = plan.exec.kind === 'npm'
    ? run('npm', plan.exec.args)
    : step.invoke(plan.exec.files);
  const exc = code === 0 ? '' : excerpt(out);
  rawLines += countLines(out);
  shownLines += countLines(exc);
  results.push({
    id: step.id, label: step.label,
    status: classify(code),
    fixed: code === 0 && step.fixer && FIX,
    scopeNote: plan.scopeNote,
    excerpt: exc,
  });
}

// Routing deterministico (ponte complessità→tier + asse sicurezza).
const secToolFlag = results.some((r) => (r.id === 'semgrep' || r.id === 'gitleaks') && r.status === 'issue');
const security = securitySignal(staged, secToolFlag);
const routing = (complexitySummary || security.sensitive || security.toolFlag)
  ? recommendRouting(complexitySummary ?? { flagged: [], hotspots: [] }, staged, security)
  : null;

// Meter di risparmio: conta RIGHE (proxy dei token), non token — onesto nel nome del campo.
const savedPct = rawLines > 0 ? Math.round((1 - shownLines / rawLines) * 100) : 0;
const savings = { rawLines, shownLines, savedPct, unit: 'lines', note: 'proxy per i token' };

const issues = results.filter((r) => r.status === 'issue');
const skipped = results.filter((r) => r.status === 'skip');

if (JSON_OUT) {
  console.log(JSON.stringify({ fix: FIX, staged: STAGED, since: SINCE, results, routing, savings, unsafeFiles }, null, 2));
  process.exit(issues.length ? 1 : 0);
}

const icon = { pass: '[ OK ]', issue: '[WARN]', skip: '[SKIP]' };

console.log(`\nCode Maniac — scan${FIX ? ' (fix)' : ''}${STAGED ? ' (staged)' : ''}${SINCE ? ` (since ${SINCE})` : ''}\n`);
for (const r of results) {
  const tag = r.fixed
    ? ' (autofix applicato)'
    : r.status === 'skip'
      ? ` — ${r.note}`
      : r.scopeNote ? ` — ${r.scopeNote}` : '';
  console.log(`  ${icon[r.status]} ${r.label}${tag}`);
  if (r.excerpt) console.log(r.excerpt.split('\n').map((l) => `      ${l}`).join('\n'));
}

console.log(
  `\nResiduo per l'LLM: ${issues.length} passi con problemi` +
  `${skipped.length ? `, ${skipped.length} saltati (tool mancanti o non configurati)` : ''}.`,
);
if (issues.length) {
  console.log('Da risolvere a giudizio:', issues.map((r) => r.id).join(', '));
}
if (rawLines > 0) {
  console.log(
    `Risparmio: i tool hanno prodotto ${rawLines} righe di output; all'LLM ne arrivano ${shownLines}` +
    ` (≈${savedPct}% non lette — l'LLM legge il residuo, non i log grezzi).`,
  );
}
if (routing) {
  const badges = `${routing.dedicatedRefactor ? ' + refactor dedicato' : ''}${routing.securityReview ? ' + Security-auditor' : ''}${routing.mirror ? ' + Specchio' : ''}`;
  console.log(`Routing suggerito (complessità + sicurezza): ${routing.tier}${badges} — ${routing.reason}`);
}
if (unsafeFiles.length) {
  console.log(`\n[SICUREZZA] ${unsafeFiles.length} file esclusi dallo scoping: nome con metacaratteri di shell (non li passo alla shell). Rivedili a mano:`);
  for (const f of unsafeFiles) console.log(`      ${f}`);
}
process.exit(issues.length ? 1 : 0);
