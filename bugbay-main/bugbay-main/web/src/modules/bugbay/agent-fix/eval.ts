/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * GATE DI EVAL shadow-first (v0.9, Track G) — la rete di sicurezza che decide se un
 * fix candidato può essere promosso. Meccanismo: CONTEGGIO-FLIP APPAIATO su un set
 * curato di ≤10 smoke-case L2 eseguite in un WORKTREE DI EVAL ISOLATO (mai nel
 * working tree dell'utente). Ogni case gira DUE volte — contro l'albero KNOWN-GOOD
 * (baseline) e contro il candidato — e si contano i FLIP:
 *   • pass→fail = REGRESSIONE  → il gate diventa ROSSO
 *   • fail→pass = fix          → informativo, non arrossa il gate
 *   • pass→pass / fail→fail    → stabile
 * A n<12 NON si usa bootstrap-CI (rumoroso): un solo flip pass→fail è sufficiente a
 * bloccare. ROSSO ⇒ `alert` (canale 'eval') + un piano di ROLLBACK a UN CLICK che
 * ripristina lo SHA known-good. INVARIANTE DI SICUREZZA: **nessun auto-rollback**
 * (vettore di persistenza per un attaccante) — il ripristino è SEMPRE a innesco umano.
 *
 * META-TEST OBBLIGATORIO (web/test/eval.test.mjs): una coppia di controllo seminata
 * — un diff BAD che DEVE far diventare il gate ROSSO + un diff GOOD che DEVE restarlo
 * VERDE — esercita il cuore deterministico qui sotto, così un gate sempre-verde è
 * IMPOSSIBILE.
 *
 * SPLIT (come consolidation/ledger): il CUORE è DB-free — solo fs/path/child_process
 * — così il meta-test lo importa senza tirare dentro node:sqlite. Le funzioni che
 * scrivono/leggono la spina (`raiseEvalAlert`/`listEvalFindings`) fanno `import`
 * DINAMICO di ./hub: mai caricato dal runner nativo. Legge scores/runs SOLO in
 * lettura; l'unica scrittura sulla spina è la riga `alerts` (canale 'eval').
 *
 * @indice (cuore DB-free — testato dal meta-test)
 * - classifyGate         → conteggio-flip appaiato baseline↔candidato → GateVerdict
 * - runSmokeCase/Set     → esegue una smoke-case (.mjs) via `node`, exit 0 = PASS
 * - listCaseFiles        → elenca le smoke-case curate in <fixtures>/cases
 * - materializeSubjectRoot → prepara una root isolata (subject.mjs + cases/)
 * - evaluateGate         → runSmokeSet(baseline) vs runSmokeSet(candidato) → verdetto
 * - evaluateSubjectPair  → materializza la coppia in dir temporanee isolate e valuta
 * - buildRollbackPlan    → piano di ripristino allo SHA known-good (DATI, non azione)
 *
 * @indice (orchestrazione / IO — verificata da tsc)
 * - createEvalWorktree/removeEvalWorktree → worktree git di eval isolato (spawnSync)
 * - runEvalGate          → gate completo: worktree isolato + verdetto + alert su ROSSO
 * - rollbackToKnownGood  → ripristino a UN CLICK (umano) allo SHA known-good — guardato
 * - raiseEvalAlert       → INSERT alert canale 'eval' (import dinamico hub)
 * - listEvalFindings     → SELECT read-only degli alert 'eval' (superficie osservabilità)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Solo tipi: erasi a runtime → il meta-test NON carica node:sqlite importando questo file.
import type { AlertRow } from './hub';

// ── Vocabolario del verdetto ─────────────────────────────────────────────────

/** Colore del gate: ROSSO se e solo se esiste ≥1 regressione (flip pass→fail). */
export type GateColor = 'green' | 'red';

/** Esito di UNA smoke-case: `node <file>` esce 0 ⇒ passed; ≠0 / timeout ⇒ fallita. */
export interface CaseResult {
  /** Basename della case in <fixtures>/cases (es. 'control-invariant.mjs'). */
  name: string;
  /** true sse `node` è uscito con codice 0. */
  passed: boolean;
  /** Exit code (null su timeout/kill). */
  code: number | null;
  /** Segnale che ha ucciso il processo (es. 'SIGTERM' su timeout), o null. */
  signal: string | null;
}

/** Verdetto del gate: colore + i flip appaiati + il materiale grezzo per il detail. */
export interface GateVerdict {
  color: GateColor;
  /** Case passate su baseline e FALLITE sul candidato (regressioni ⇒ ROSSO). */
  regressions: string[];
  /** Case fallite su baseline e PASSATE sul candidato (fix ⇒ informativo). */
  fixes: string[];
  /** Numero di case il cui esito NON cambia (pass→pass o fail→fail). */
  stable: number;
  /** Case totali appaiate. */
  total: number;
  baseline: CaseResult[];
  candidate: CaseResult[];
}

/**
 * Piano di ROLLBACK: DATI, non azione. Descrive il comando git che ripristina lo
 * SHA known-good. `runEvalGate` lo COSTRUISCE su ROSSO ma NON lo esegue mai —
 * l'esecuzione è `rollbackToKnownGood`, a innesco UMANO (un click nella console).
 */
export interface RollbackPlan {
  repoRoot: string;
  knownGoodSha: string;
  /** argv git da eseguire (senza il binario) per ripristinare l'albero known-good. */
  command: string[];
  reason: string;
}

/** Timeout di default per singola smoke-case (una L2 smoke deve essere veloce). */
const DEFAULT_CASE_TIMEOUT_MS = 15_000;

// ═════════════════════════════════════════════════════════════════════════════
// CUORE DB-FREE — conteggio-flip appaiato + esecuzione delle smoke-case.
//   Nessun import di hub/git/DB qui: è il pezzo che il meta-test esercita
//   direttamente per dimostrare che un gate sempre-verde è impossibile.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * CONTEGGIO-FLIP APPAIATO. Appaia baseline e candidato PER NOME e classifica ogni
 * case. Il gate è ROSSO se e solo se almeno una case è REGREDITA (passava sul
 * known-good, fallisce sul candidato). I fix (fail→pass) non arrossano mai il gate;
 * le case stabili sono neutre. Deterministico e puro: nessun IO.
 */
export function classifyGate(baseline: CaseResult[], candidate: CaseResult[]): GateVerdict {
  const basePassed = new Map<string, boolean>();
  for (const b of baseline) basePassed.set(b.name, b.passed);

  const regressions: string[] = [];
  const fixes: string[] = [];
  let stable = 0;

  for (const c of candidate) {
    const before = basePassed.get(c.name);
    if (before === undefined) continue; // case senza gemello baseline: non appaiabile
    if (before && !c.passed) regressions.push(c.name);
    else if (!before && c.passed) fixes.push(c.name);
    else stable += 1;
  }

  return {
    color: regressions.length > 0 ? 'red' : 'green',
    regressions,
    fixes,
    stable,
    total: candidate.length,
    baseline,
    candidate,
  };
}

/**
 * Esegue UNA smoke-case: `node <root>/cases/<name>`. Contratto della case (vedi
 * eval-fixtures): exit 0 = PASS, ≠0 = FAIL. Timeout ⇒ FAIL (una case che si impianta
 * è una regressione, non un pass). Nessun throw: un errore di spawn = case fallita.
 */
export function runSmokeCase(root: string, name: string, timeoutMs: number = DEFAULT_CASE_TIMEOUT_MS): CaseResult {
  const caseFile = path.join(root, 'cases', name);
  const res = spawnSync(process.execPath, [caseFile], {
    cwd: root,
    encoding: 'utf-8',
    timeout: timeoutMs,
  });
  // status === 0 e nessun segnale ⇒ PASS. Qualsiasi altra cosa (codice ≠0, SIGTERM
  // da timeout, errore di spawn con status null) ⇒ FAIL: mai contare un pass sull'ignoto.
  const passed = res.status === 0 && !res.signal && !res.error;
  return {
    name,
    passed,
    code: res.status,
    signal: res.signal ?? null,
  };
}

/** Esegue l'INTERO set curato contro una root, nell'ordine dato (deterministico). */
export function runSmokeSet(root: string, caseNames: string[], timeoutMs?: number): CaseResult[] {
  return caseNames.map((name) => runSmokeCase(root, name, timeoutMs));
}

/** Basename (ordinati) delle smoke-case `.mjs` in <fixturesDir>/cases (cap ≤10 L2). */
export function listCaseFiles(fixturesDir: string): string[] {
  const dir = path.join(fixturesDir, 'cases');
  let ents: string[];
  try {
    ents = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return ents.filter((f) => f.endsWith('.mjs')).sort();
}

/**
 * Prepara una ROOT isolata dove le smoke-case sondano un dato subject: copia il
 * `subjectFile` in <root>/subject.mjs (le case importano `../subject.mjs`) e le
 * case curate in <root>/cases. La root è auto-contenuta ed eseguibile con `node`
 * senza node_modules né type-stripping (le case sono ESM `.mjs` puri).
 */
export function materializeSubjectRoot(
  root: string,
  subjectFile: string,
  fixturesDir: string,
  caseNames: string[],
): void {
  fs.mkdirSync(path.join(root, 'cases'), { recursive: true });
  fs.copyFileSync(subjectFile, path.join(root, 'subject.mjs'));
  for (const name of caseNames) {
    fs.copyFileSync(path.join(fixturesDir, 'cases', name), path.join(root, 'cases', name));
  }
}

/** Esegue il set su baseline e candidato (già materializzati) e appaia i flip. */
export function evaluateGate(opts: {
  baselineRoot: string;
  candidateRoot: string;
  caseNames: string[];
  timeoutMs?: number;
}): GateVerdict {
  const baseline = runSmokeSet(opts.baselineRoot, opts.caseNames, opts.timeoutMs);
  const candidate = runSmokeSet(opts.candidateRoot, opts.caseNames, opts.timeoutMs);
  return classifyGate(baseline, candidate);
}

/**
 * Valuta una coppia baseline/candidato materializzandola in DIR TEMPORANEE ISOLATE
 * (mkdtemp), esegue il set e ritorna il verdetto. È l'entry deterministico che il
 * meta-test guida con la coppia di controllo seminata. Pulisce sempre le temp dir.
 */
export function evaluateSubjectPair(opts: {
  fixturesDir: string;
  baselineSubject: string;
  candidateSubject: string;
  caseNames?: string[];
  timeoutMs?: number;
  workDir?: string;
}): GateVerdict {
  const fixturesDir = opts.fixturesDir;
  const caseNames = opts.caseNames ?? listCaseFiles(fixturesDir);
  const base = fs.mkdtempSync(path.join(opts.workDir ?? os.tmpdir(), 'bugbay-eval-'));
  try {
    const baselineRoot = path.join(base, 'baseline');
    const candidateRoot = path.join(base, 'candidate');
    materializeSubjectRoot(baselineRoot, opts.baselineSubject, fixturesDir, caseNames);
    materializeSubjectRoot(candidateRoot, opts.candidateSubject, fixturesDir, caseNames);
    return evaluateGate({ baselineRoot, candidateRoot, caseNames, timeoutMs: opts.timeoutMs });
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch {
      /* pulizia best-effort */
    }
  }
}

/**
 * Piano di ripristino allo SHA known-good. È SOLO dati: descrive `git reset --hard
 * <sha>` senza eseguirlo. Costruito su ROSSO da `runEvalGate`; eseguito SOLO da
 * `rollbackToKnownGood` a innesco umano (NO auto-rollback).
 */
export function buildRollbackPlan(repoRoot: string, knownGoodSha: string, reason: string): RollbackPlan {
  return {
    repoRoot: path.resolve(repoRoot),
    knownGoodSha,
    command: ['reset', '--hard', knownGoodSha],
    reason,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ORCHESTRAZIONE / IO — worktree git isolato, alert sulla spina, rollback umano.
//   Verificata da tsc. Gli accessi alla spina passano da `import` DINAMICO di
//   ./hub, così il meta-test può importare questo modulo senza caricare node:sqlite.
// ═════════════════════════════════════════════════════════════════════════════

function runGit(args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 30_000 });
  return { ok: r.status === 0, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

/** Radice dei worktree di eval (gitignored, come `.bugbay/worktrees`). */
function evalWorktreesDir(repoRoot: string): string {
  return path.join(repoRoot, '.bugbay', 'eval-worktrees');
}

/**
 * Crea un WORKTREE DI EVAL ISOLATO agganciato a `ref` (di norma lo SHA known-good),
 * DETACHED così non tocca alcun ramo dell'utente. È l'"isolated eval worktree"
 * dell'invariante: le smoke-case vi girano fuori dal working tree dell'utente.
 * Ritorna la dir o null se git fallisce (repo assente/ref invalido) — il chiamante
 * degrada a una dir isolata semplice.
 */
export function createEvalWorktree(repoRoot: string, ref: string, slot: string): string | null {
  const root = path.resolve(repoRoot);
  const wtDir = path.join(evalWorktreesDir(root), slot);
  try {
    fs.mkdirSync(evalWorktreesDir(root), { recursive: true });
    removeEvalWorktree(root, slot); // eventuale worktree stantìo con lo stesso slot
    const add = runGit(['worktree', 'add', '--detach', '--force', wtDir, ref], root);
    return add.ok ? wtDir : null;
  } catch {
    return null;
  }
}

/** Smonta e rimuove il worktree di eval (best-effort). Nessun ramo da conservare. */
export function removeEvalWorktree(repoRoot: string, slot: string): void {
  const root = path.resolve(repoRoot);
  const wtDir = path.join(evalWorktreesDir(root), slot);
  if (!fs.existsSync(wtDir)) return;
  runGit(['worktree', 'remove', '--force', wtDir], root);
  runGit(['worktree', 'prune'], root);
}

/**
 * Risolve la dir delle fixtures di eval accanto a questo modulo. Override via
 * `BUGBAY_EVAL_FIXTURES_DIR` (test/sandbox). Fallback finale relativo al cwd.
 */
export function defaultFixturesDir(): string {
  const override = process.env.BUGBAY_EVAL_FIXTURES_DIR;
  if (override) return path.resolve(override);
  try {
    return path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'eval-fixtures');
  } catch {
    return path.resolve(process.cwd(), 'src/modules/bugbay/agent-fix/eval-fixtures');
  }
}

export interface RunEvalGateOptions {
  /** Repo su cui aprire il worktree isolato e a cui punta il rollback. */
  repoRoot: string;
  /** SHA known-good da ripristinare in caso di regressione (mai in automatico). */
  knownGoodSha: string;
  /** Artefatto sotto esame (il subject che il candidato produce). */
  candidateSubject: string;
  /** Subject di riferimento; default = <fixtures>/subject.mjs (baseline known-good). */
  baselineSubject?: string;
  /** Ref git del candidato, solo per il record nell'alert (facoltativo). */
  candidateRef?: string;
  fixturesDir?: string;
  caseNames?: string[];
  timeoutMs?: number;
}

export interface RunEvalGateResult {
  verdict: GateVerdict;
  /** Piano di rollback: presente SOLO su ROSSO (dati; l'esecuzione è umana). */
  rollback: RollbackPlan | null;
  /** Id dell'alert 'eval' emesso su ROSSO, o null. */
  alertId: string | null;
  /** true se le smoke-case sono girate in un worktree git isolato (vs dir di fallback). */
  isolatedWorktree: boolean;
}

/**
 * GATE COMPLETO shadow-first. Materializza il set curato in un WORKTREE DI EVAL
 * ISOLATO agganciato allo SHA known-good, esegue il conteggio-flip appaiato
 * baseline↔candidato e, su REGRESSIONE, alza un `alert` (canale 'eval') e COSTRUISCE
 * un piano di rollback. **NON esegue mai il rollback** (no auto-rollback): il piano
 * torna al chiamante per il click umano. Best-effort sulla pulizia del worktree.
 *
 * WIRING (deliberato): NON è cablato nel path di fix per-run. Richiede
 * `candidateSubject`+`baselineSubject` — smoke-case `.mjs` CURATE, non i test del
 * repo reale: è l'harness di eval golden/benchmark (validazione contro repo reali,
 * ancora PENDING), invocato via test/`BUGBAY_EVAL_FIXTURES_DIR`, non dal daemon. La
 * difesa da regressione del fix autonomo vive già in `runner.finalizeAutonomous`
 * (tsc/eslint + judge-panel + gate+ opzionali). Cablare qui girerebbe le fixture,
 * non il fix → inutile finché non esiste una suite curata mappata sul repo.
 */
export async function runEvalGate(opts: RunEvalGateOptions): Promise<RunEvalGateResult> {
  const repoRoot = path.resolve(opts.repoRoot);
  const fixturesDir = opts.fixturesDir ?? defaultFixturesDir();
  const caseNames = opts.caseNames ?? listCaseFiles(fixturesDir);
  const baselineSubject = opts.baselineSubject ?? path.join(fixturesDir, 'subject.mjs');
  const slot = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Worktree git DETACHED sullo SHA known-good = isolamento reale dal working tree.
  // Se non è un repo git (o il ref non risolve) si degrada a una dir isolata.
  const wtDir = createEvalWorktree(repoRoot, opts.knownGoodSha, slot);
  const isolatedWorktree = wtDir !== null;
  const workBase = wtDir ?? path.join(evalWorktreesDir(repoRoot), slot);
  if (!isolatedWorktree) fs.mkdirSync(workBase, { recursive: true });

  try {
    const baselineRoot = path.join(workBase, 'baseline');
    const candidateRoot = path.join(workBase, 'candidate');
    materializeSubjectRoot(baselineRoot, baselineSubject, fixturesDir, caseNames);
    materializeSubjectRoot(candidateRoot, opts.candidateSubject, fixturesDir, caseNames);
    const verdict = evaluateGate({ baselineRoot, candidateRoot, caseNames, timeoutMs: opts.timeoutMs });

    if (verdict.color === 'green') {
      return { verdict, rollback: null, alertId: null, isolatedWorktree };
    }

    // ROSSO: alert + piano di rollback (NON eseguito). L'alert è l'unica scrittura
    // sulla spina; scores/runs restano in sola lettura.
    const rollback = buildRollbackPlan(
      repoRoot,
      opts.knownGoodSha,
      `regressione nel gate di eval: ${verdict.regressions.join(', ')}`,
    );
    const alertId = await raiseEvalAlert(verdict, {
      knownGoodSha: opts.knownGoodSha,
      candidateRef: opts.candidateRef ?? null,
      rollback,
    });
    return { verdict, rollback, alertId, isolatedWorktree };
  } finally {
    if (isolatedWorktree) removeEvalWorktree(repoRoot, slot);
    else {
      try {
        fs.rmSync(workBase, { recursive: true, force: true });
      } catch {
        /* pulizia best-effort */
      }
    }
  }
}

/**
 * ROLLBACK a UN CLICK (innesco UMANO). Verifica che lo SHA esista come commit, poi
 * esegue il comando del piano (`git reset --hard <sha>`) nel repo. **Mai chiamato da
 * `runEvalGate`**: è l'azione che la console invoca quando l'operatore clicca
 * "Ripristina". Ritorna l'esito; non lancia.
 */
export function rollbackToKnownGood(plan: RollbackPlan): { ok: boolean; out: string } {
  const repoRoot = path.resolve(plan.repoRoot);
  // Guardia: lo SHA deve risolvere a un commit (mai un reset su un ref inventato).
  const exists = runGit(['cat-file', '-e', `${plan.knownGoodSha}^{commit}`], repoRoot);
  if (!exists.ok) {
    return { ok: false, out: `SHA known-good non risolvibile: ${plan.knownGoodSha}` };
  }
  return runGit(plan.command, repoRoot);
}

// ── Spina: alert 'eval' (scrittura) + listing read-only (osservabilità) ──────
// Import DINAMICO di ./hub: il meta-test non carica mai node:sqlite da qui.

/**
 * Alza un alert canale 'eval' (severity 'error') su regressione. Detail = JSON con
 * SHA known-good, ref candidato, regressioni e piano di rollback: è la superficie da
 * cui la console offre il ripristino a un click. Mirror di `ledger.raiseAlert`
 * (INSERT diretto su `alerts`, run_id NULL — l'eval non è legato a una singola run).
 */
export async function raiseEvalAlert(
  verdict: GateVerdict,
  ctx: { knownGoodSha: string; candidateRef: string | null; rollback: RollbackPlan },
): Promise<string> {
  const { openHubDb } = await import('./hub');
  const db = openHubDb();
  const id = `alert-eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const detail = JSON.stringify({
    regressions: verdict.regressions,
    fixes: verdict.fixes,
    stable: verdict.stable,
    total: verdict.total,
    knownGoodSha: ctx.knownGoodSha,
    candidateRef: ctx.candidateRef,
    rollback: ctx.rollback,
  });
  const message = `Gate di eval ROSSO: ${verdict.regressions.length} regressione/i (${verdict.regressions.join(', ')}). Ripristino allo SHA known-good disponibile a un click (nessun rollback automatico).`;
  db
    .prepare('INSERT INTO alerts (id, channel, severity, run_id, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, 'eval', 'error', null, message, detail, new Date().toISOString());
  return id;
}

/**
 * Alert 'eval' recenti (read-only), il più recente prima. Superficie di osservabilità
 * del gate senza toccare la vista SYSTEM (SezioneSystem è di Track Ra): la console
 * può interrogarli dietro una route privilegiata. Zero scritture.
 */
export async function listEvalFindings(limit = 50): Promise<AlertRow[]> {
  const { openHubDb } = await import('./hub');
  const db = openHubDb();
  const rows = db
    .prepare(
      `SELECT id, channel, severity, run_id, message, detail, created_at, ack_at
         FROM alerts WHERE channel = 'eval' ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit);
  return rows as AlertRow[];
}
