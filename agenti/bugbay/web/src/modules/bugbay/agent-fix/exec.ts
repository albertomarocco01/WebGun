/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Esecuzione cross-platform dei processi esterni del fix agentico (Windows
 * incluso, dove `spawnSync('npx', …)` fallisce con ENOENT perché npx è un .cmd).
 * Il gate tsc è invocato via Node direttamente sul binario di typescript; il
 * gate "relativo" confronta gli errori prima/dopo il fix, così un branch già
 * sporco non blocca i fix che non peggiorano. Espone anche la risoluzione del
 * binario della CLI claude e una diagnostica d'ambiente.
 *
 * @indice
 * - tscGate / tscBaseline / tscGateRelative → gate tsc (assoluto e relativo)
 * - eslintBaseline / eslintGateRelative     → gate ESLint relativo (file in scope)
 * - resolveClaudeBin                        → comando per lanciare la CLI claude
 * - environmentDiagnostics                  → check ambiente (tsc, claude, git)
 */

import { targetRoot } from './target-root';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Radice + path derivati come GETTER (non cache): una run autonoma gira in un
// worktree isolato via withRunRoot → targetRoot() lì ritorna la cartella del
// worktree, e tsc/eslint (col node_modules junctionato) risolvono lì. Per una run
// normale è il target root di sempre (nessun override). Value-preserving.
const ROOT = (): string => targetRoot();
const tscJs = (): string => path.join(ROOT(), 'node_modules', 'typescript', 'bin', 'tsc');
const eslintJs = (): string => path.join(ROOT(), 'node_modules', 'eslint', 'bin', 'eslint.js');
// Cache incrementale dedicata al fix agentico: il primo gate paga il costo
// pieno (~40-60s su questo progetto), i successivi scendono a pochi secondi.
// Default CONDIVISO usato solo dai gate NON legati a una run (diagnostica,
// gate assoluto): le run usano una cache per-run (vedi runTscBuildInfo).
const tscBuildinfoDefault = (): string => path.join(ROOT(), 'node_modules', '.cache', 'agent-fix-tsc.tsbuildinfo');
// Cache tsbuildinfo PER-RUN: due gate di run parallele (maxParallelRuns>1) che
// scrivono lo stesso file si corrompono la cache incrementale a vicenda — su
// Windows la scrittura concorrente dà EBUSY/EPERM e il gate fallisce a vuoto.
// Una cache per runId isola le run tra loro e resta calda tra le iterazioni di
// repair della STESSA run (stessa chiave).
const tscBuildinfoDir = (): string => path.join(ROOT(), 'node_modules', '.cache', 'agent-fix');
const safeRunId = (runId: string): string => runId.replace(/[^a-zA-Z0-9_-]/g, '_');

/** Percorso del tsbuildinfo dedicato a una run (dir creata on-demand). */
export function runTscBuildInfo(runId: string): string {
  fs.mkdirSync(tscBuildinfoDir(), { recursive: true });
  return path.join(tscBuildinfoDir(), `${safeRunId(runId)}.tsbuildinfo`);
}

/** Rimuove il tsbuildinfo di una run eliminata (tiene limitata la crescita). */
export function cleanupTscBuildInfo(runId: string): void {
  try { fs.rmSync(path.join(tscBuildinfoDir(), `${safeRunId(runId)}.tsbuildinfo`), { force: true }); } catch { /* no-op */ }
}

/**
 * All'avvio elimina i tsbuildinfo il cui runId non è più fra le run da tenere
 * (le run terminali non ne hanno più bisogno). Senza, un file per-run resterebbe
 * per ogni fix eseguito — cleanupTscBuildInfo scatta solo sulla delete manuale.
 */
export function pruneOrphanBuildInfo(keepRunIds: string[]): void {
  try {
    const keep = new Set(keepRunIds.map(safeRunId));
    for (const f of fs.readdirSync(tscBuildinfoDir())) {
      const m = f.match(/^(.+)\.tsbuildinfo$/);
      if (m && !keep.has(m[1])) {
        try { fs.rmSync(path.join(tscBuildinfoDir(), f), { force: true }); } catch { /* no-op */ }
      }
    }
  } catch { /* dir assente = niente da prunare */ }
}

export interface GateResult {
  ok: boolean;
  output: string;
  /** Errori introdotti rispetto alla baseline (solo gate relativo). */
  newErrors?: string[];
}

/** Esegue tsc in modo asincrono: non blocca l'event loop del dev server. */
function runTsc(buildInfoFile: string = tscBuildinfoDefault()): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(process.execPath, [tscJs(), '--noEmit', '--incremental', '--tsBuildInfoFile', buildInfoFile], { cwd: ROOT() });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ status: null, output: 'Timeout del gate tsc (240s).' });
    }, 240_000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: null, output: `Impossibile eseguire tsc: ${err.message}` });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, output: out.trim() });
    });
  });
}

/**
 * Normalizza le righe di errore tsc in chiavi confrontabili tra run:
 * "file(12,34): error TS2304: msg" → "file: TS2304: msg" (riga/colonna scartate,
 * così gli spostamenti di riga causati dal fix non risultano errori "nuovi").
 */
function errorKeys(output: string): Set<string> {
  const keys = new Set<string>();
  for (const line of output.split('\n')) {
    const m = line.match(/^(.+?)\(\d+,\d+\):\s*error\s+(TS\d+):\s*(.*)$/);
    if (m) keys.add(`${m[1]}: ${m[2]}: ${m[3].trim()}`);
  }
  return keys;
}

/** Gate assoluto: tsc deve essere completamente verde. */
export async function tscGate(): Promise<GateResult> {
  const { status, output } = await runTsc();
  return { ok: status === 0, output };
}

/** Fotografa gli errori correnti (da chiamare PRIMA del fix). */
export async function tscBaseline(buildInfoFile?: string): Promise<Set<string>> {
  return errorKeys((await runTsc(buildInfoFile)).output);
}

/**
 * Gate relativo: passa se il fix non introduce errori NUOVI rispetto alla
 * baseline (gli errori pre-esistenti del branch non bloccano la run).
 */
export async function tscGateRelative(baseline: Set<string>, buildInfoFile?: string): Promise<GateResult> {
  const { status, output } = await runTsc(buildInfoFile);
  if (status === 0) return { ok: true, output };
  if (status === null) return { ok: false, output, newErrors: [output] };
  const current = errorKeys(output);
  const newErrors = [...current].filter((k) => !baseline.has(k));
  return { ok: newErrors.length === 0, output, newErrors };
}

/* ── Gate ESLint (relativo, sui soli file in scope) ─────────────────
 * Il gate tsc prende i tipi; ESLint prende il resto (import morti, no-explicit-any,
 * regole react-hooks…). Gira SOLO sui file in scope (veloce) e solo se il target ha
 * eslint installato + una config — altrimenti si astiene (skip silenzioso), così il
 * gate resta project-agnostic. Come per tsc il confronto è RELATIVO alla baseline:
 * bloccano solo i problemi NUOVI introdotti dal fix.
 */

interface LintMsg { file: string; rule: string; msg: string }

/**
 * Tipo di config ESLint del target: `flat` (eslint.config.*, default di ESLint 9)
 * o `legacy` (.eslintrc*). Distinguerli è necessario: con la SOLA config legacy,
 * ESLint 9 va forzato con `ESLINT_USE_FLAT_CONFIG=false`, altrimenti ignora
 * `.eslintrc` e va in errore (→ gate silenziosamente inattivo).
 */
function eslintConfigKind(): 'flat' | 'legacy' | null {
  if (!fs.existsSync(eslintJs())) return null;
  const flat = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'];
  if (flat.some((f) => fs.existsSync(path.join(ROOT(), f)))) return 'flat';
  const legacy = ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc'];
  if (legacy.some((f) => fs.existsSync(path.join(ROOT(), f)))) return 'legacy';
  try { if (JSON.parse(fs.readFileSync(path.join(ROOT(), 'package.json'), 'utf-8')).eslintConfig) return 'legacy'; } catch { /* no pkg */ }
  return null;
}

/**
 * Lancia eslint (JSON) sui file dati; ritorna i messaggi (error e warning). Si
 * contano anche i WARNING perché su Next molte regole utili (no-unused-vars,
 * no-explicit-any, react-hooks) sono warning: contando solo gli error il gate
 * non bloccherebbe quasi nulla. Il confronto è comunque RELATIVO alla baseline.
 */
function runEslint(files: string[]): Promise<{ ran: boolean; messages: LintMsg[] }> {
  const targets = files.filter((f) => /\.(tsx?|jsx?)$/.test(f) && fs.existsSync(path.join(ROOT(), f)));
  const kind = eslintConfigKind();
  if (!targets.length || !kind) return Promise.resolve({ ran: false, messages: [] });
  // ESLint 9 ignora .eslintrc se non gli si dice esplicitamente di usare il legacy.
  const env = kind === 'legacy' ? { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' } : process.env;
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(process.execPath, [eslintJs(), '--format', 'json', '--no-color', ...targets], { cwd: ROOT(), env });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ ran: false, messages: [] }); }, 90_000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve({ ran: false, messages: [] }); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const arr = JSON.parse(out) as Array<{ filePath: string; messages: Array<{ ruleId: string | null; severity: number; message: string }> }>;
        const messages: LintMsg[] = [];
        for (const f of arr) {
          const rel = path.relative(ROOT(), f.filePath).replace(/\\/g, '/');
          for (const m of f.messages) if (m.severity >= 1) messages.push({ file: rel, rule: m.ruleId ?? '', msg: m.message });
        }
        resolve({ ran: true, messages });
      } catch { resolve({ ran: false, messages: [] }); }
    });
  });
}

/** Chiavi confrontabili tra run (riga/colonna scartate, come per tsc). */
function lintKeys(messages: LintMsg[]): Set<string> {
  return new Set(messages.map((m) => `${m.file}: ${m.rule}: ${m.msg}`));
}

/** Fotografa i lint error correnti sui file in scope (PRIMA del fix). */
export async function eslintBaseline(files: string[]): Promise<Set<string>> {
  return lintKeys((await runEslint(files)).messages);
}

/** Gate ESLint relativo: passa se il fix non introduce lint error NUOVI (o se eslint non è disponibile). */
export async function eslintGateRelative(baseline: Set<string>, files: string[]): Promise<GateResult> {
  const r = await runEslint(files);
  if (!r.ran) return { ok: true, output: '' };
  const newErrors = [...lintKeys(r.messages)].filter((k) => !baseline.has(k));
  return {
    ok: newErrors.length === 0,
    output: r.messages.map((m) => `${m.file}: [${m.rule}] ${m.msg}`).join('\n'),
    newErrors,
  };
}

/* ── Gate+ opzionale: npm script (test/build) ───────────────────────
 * Gate PESANTI usati SOLO dal loop autonomo (F3), dietro flag di config (default
 * OFF): un fix committato in autonomia senza umano merita una prova più forte di
 * tsc+eslint. Gira lo script npm del target (nel worktree isolato via ROOT()), in
 * modo ASSOLUTO (non relativo alla baseline): a differenza di tsc/eslint qui non
 * pesiamo un output per-riga, quindi un test/build già rosso conta come 'fail' —
 * per questo è opt-in. Si astiene ('skipped') se lo script non esiste, così resta
 * project-agnostic. Nota: `next build` nel worktree ha una .next propria → nessuna
 * collisione con la .next del dev server.
 */
export type ScriptGate = 'skipped' | 'pass' | 'fail';

export function runScriptGate(name: string): Promise<ScriptGate> {
  let scripts: Record<string, string> = {};
  try { scripts = JSON.parse(fs.readFileSync(path.join(ROOT(), 'package.json'), 'utf-8')).scripts ?? {}; }
  catch { return Promise.resolve('skipped'); }
  if (!scripts[name]) return Promise.resolve('skipped');
  // build può durare minuti; test meno. Timeout generosi ma finiti.
  const timeoutMs = name === 'build' ? 600_000 : 300_000;
  return new Promise((resolve) => {
    // shell:true perché su Windows `npm` è npm.cmd (spawn diretto → ENOENT); `name`
    // è un literal fisso ('test'/'build'), mai input utente → niente injection.
    // stdio ignorato: ci serve solo l'exit code (il branch resta per l'ispezione umana).
    const child = spawn('npm', ['run', name], { cwd: ROOT(), shell: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve('fail'); }, timeoutMs);
    child.on('error', () => { clearTimeout(timer); resolve('skipped'); }); // npm assente → non bloccare
    child.on('close', (status) => { clearTimeout(timer); resolve(status === 0 ? 'pass' : 'fail'); });
  });
}

/* ── Risoluzione CLI claude ─────────────────────────────────────── */

export interface ResolvedBin {
  /** Eseguibile da passare a spawn. */
  cmd: string;
  /** Argomenti da anteporre (es. percorso del cli.js quando cmd è node). */
  prefixArgs: string[];
}

/**
 * Dal percorso di uno shim npm .cmd ricava il binario reale della CLI claude.
 * Le versioni recenti del pacchetto shippano un eseguibile nativo
 * (bin/claude.exe), quelle più vecchie un cli.js da lanciare con Node:
 * vanno supportati entrambi i layout.
 */
function claudeFromShim(shimPath: string): ResolvedBin | null {
  const pkgDir = path.join(path.dirname(shimPath), 'node_modules', '@anthropic-ai', 'claude-code');
  const exe = path.join(pkgDir, 'bin', 'claude.exe');
  if (fs.existsSync(exe)) return { cmd: exe, prefixArgs: [] };
  const js = path.join(pkgDir, 'cli.js');
  if (fs.existsSync(js)) return { cmd: process.execPath, prefixArgs: [js] };
  return null;
}

let cachedClaude: ResolvedBin | null | undefined;

/**
 * Risolve come lanciare la CLI claude in modo cross-platform.
 * Ordine: env CLAUDE_BIN → PATH (`where`/`which`) → percorsi noti.
 * Gli shim .cmd di npm non sono spawnabili senza shell (EINVAL/ENOENT):
 * vengono risolti nel cli.js sottostante ed eseguiti con Node.
 */
export function resolveClaudeBin(): ResolvedBin | null {
  if (cachedClaude !== undefined) return cachedClaude;
  cachedClaude = resolveClaudeBinUncached();
  return cachedClaude;
}

function resolveClaudeBinUncached(): ResolvedBin | null {
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv) {
    if (/\.(c|m)?js$/i.test(fromEnv)) return { cmd: process.execPath, prefixArgs: [fromEnv] };
    if (/\.cmd$/i.test(fromEnv)) {
      const resolved = claudeFromShim(fromEnv);
      if (resolved) return resolved;
    }
    return { cmd: fromEnv, prefixArgs: [] };
  }

  if (process.platform !== 'win32') {
    return { cmd: 'claude', prefixArgs: [] };
  }

  // Windows: cerca sul PATH e nei percorsi di installazione noti
  const where = spawnSync('where.exe', ['claude'], { encoding: 'utf-8', timeout: 10_000 });
  const fromPath = where.status === 0 ? (where.stdout ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const home = process.env.USERPROFILE ?? '';
  const candidates = [
    ...fromPath,
    path.join(home, '.local', 'bin', 'claude.exe'),
    path.join(process.env.APPDATA ?? '', 'npm', 'claude.cmd'),
  ].filter((p) => p && fs.existsSync(p));

  for (const candidate of candidates) {
    if (/\.exe$/i.test(candidate)) return { cmd: candidate, prefixArgs: [] };
    if (/\.cmd$/i.test(candidate)) {
      const resolved = claudeFromShim(candidate);
      if (resolved) return resolved;
    }
  }
  return null;
}

/* ── Diagnostica d'ambiente ─────────────────────────────────────── */

export interface EnvDiagnostics {
  tscExecutable: boolean;
  tscGreen: boolean;
  tscErrorCount: number;
  claudeFound: boolean;
  claudeCmd: string | null;
  gitOk: boolean;
}

/** Check d'ambiente per il tab Agenti: rende visibili i problemi tipo P01/P02. */
export async function environmentDiagnostics(): Promise<EnvDiagnostics> {
  const tsc = await runTsc();
  const claude = resolveClaudeBin();
  const git = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT(), encoding: 'utf-8', timeout: 10_000 });
  return {
    tscExecutable: tsc.status !== null,
    tscGreen: tsc.status === 0,
    tscErrorCount: errorKeys(tsc.output).size,
    claudeFound: claude !== null,
    claudeCmd: claude ? [claude.cmd, ...claude.prefixArgs].join(' ') : null,
    gitOk: git.status === 0,
  };
}
