/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * WATCH DEI SEGNALI IMPLICITI (v0.8) — TRACK S. Rileva gli eventi impliciti che
 * NON passano da un'azione umana esplicita e li traduce in `scores` via
 * `recordImplicitSignal` (signals.ts). Due sorgenti:
 *  1) GIT — un branch auto `bugbay/auto/<reportId>` MERGIATO nel branch corrente
 *     (tip diventato antenato di HEAD) = approvazione IMPLICITA ⇒ segnale 'merge'.
 *  2) BRT — una REGRESSIONE (repro di un bug già fixato che ri-fallisce): seam
 *     `recordRegressionSignal`, chiamato dal harness dei test ⇒ segnale negativo.
 *
 * SEAM, NON un nuovo loop dello scheduler: la scansione è una funzione PURA-di-
 * effetto (`scanAutoBranchMerges`) invocabile da chiunque possieda un tick — così
 * NON si collide coi loop v0.7 (dispatcher/watchdog/StuckDetector). In più, un
 * driver a intervallo OPT-IN e idempotente (`startSignalWatch`) per chi volesse un
 * watcher autonomo: registrato su `global` (hot-reload safe), `unref()` così non
 * tiene vivo il processo, mai doppio. Se nessuno lo avvia, è codice inerte.
 *
 * IDEMPOTENZA: la scansione ri-gira a ogni tick; il de-dup NON usa uno stato
 * proprio ma interroga `scores` — se esiste già un IMPLICIT/'merge' per quella run
 * non si riscrive. La spina è l'unica autorità: nessun file di stato collaterale.
 *
 * @indice
 * - scanAutoBranchMerges  → scansione git: firma i merge nuovi, ritorna il conteggio
 * - recordRegressionSignal → seam BRT: una regressione ⇒ segnale negativo (discard)
 * - startSignalWatch / stopSignalWatch → driver a intervallo OPT-IN (idempotente)
 */

import { spawnSync } from 'child_process';
import { targetRoot } from './target-root';
import { getAllRuns } from './store';
import { openHubDb } from './hub';
import { recordImplicitSignal, type SignalContext } from './signals';

/** Prefisso dei rami isolati dei fix autonomi (deve combaciare con `worktree.autoBranch`). */
const AUTO_BRANCH_PREFIX = 'bugbay/auto/';

/** Esegue un comando git nel repo instradato; mai lancia (status !== 0 ⇒ ok false). */
function git(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd: targetRoot(), encoding: 'utf-8', timeout: 20_000 });
  return { ok: r.status === 0, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

/** Rami locali sotto `bugbay/auto/` (nome breve), o [] se git non è disponibile. */
function listAutoBranches(): string[] {
  const res = git(['for-each-ref', '--format=%(refname:short)', `refs/heads/${AUTO_BRANCH_PREFIX}`]);
  if (!res.ok) return [];
  return res.out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * true se il tip di `branch` è un ANTENATO di HEAD, cioè è stato mergiato nel
 * branch corrente. `merge-base --is-ancestor` esce 0 se antenato, 1 se no, altro
 * su errore: contiamo mergiato SOLO su exit 0.
 */
function isMergedIntoHead(branch: string): boolean {
  return git(['merge-base', '--is-ancestor', branch, 'HEAD']).ok;
}

/**
 * Ultima run che ha COMMITTATO su `branch` (il commit su un ramo auto è la run che
 * lo ha prodotto). `getAllRuns` è già ordinato per createdAt DESC: la prima che
 * combacia è la più recente. Richiede `committed` così un ramo senza fix (nessun
 * commit oltre la base ⇒ già antenato di HEAD) non genera un falso 'merge'.
 */
function committedRunForAutoBranch(branch: string): { runId: string; reportId: string } | undefined {
  for (const r of getAllRuns()) {
    if (r.committed && r.autoBranch === branch) {
      return { runId: r.runId, reportId: r.reportId };
    }
  }
  return undefined;
}

/**
 * De-dup basato sulla spina (nessuno stato collaterale): esiste già uno score
 * IMPLICIT con quel `verdict` per la run? Se sì, il segnale è già stato emesso e
 * la scansione lo salta al tick successivo. Read-only, mai lancia.
 */
function alreadySignaled(runId: string, verdict: string): boolean {
  try {
    const row = openHubDb()
      .prepare('SELECT 1 AS x FROM scores WHERE run_id = ? AND source = ? AND verdict = ? LIMIT 1')
      .get(runId, 'IMPLICIT', verdict);
    return row !== undefined && row !== null;
  } catch {
    return false;
  }
}

/**
 * Scansiona i rami `bugbay/auto/*`: per ognuno mergiato in HEAD e con una run
 * committata non ancora segnalata, scrive un segnale 'merge' (approvazione
 * IMPLICITA). Idempotente per il de-dup su `scores`. Ritorna quanti segnali NUOVI
 * ha emesso. Best-effort: qualunque errore (git assente, storage giù) ⇒ 0, mai
 * propaga (è pensata per girare dentro un tick che non deve mai rompersi).
 */
export function scanAutoBranchMerges(): number {
  let fired = 0;
  try {
    for (const branch of listAutoBranches()) {
      if (!isMergedIntoHead(branch)) continue;
      const run = committedRunForAutoBranch(branch);
      if (!run) continue;
      if (alreadySignaled(run.runId, 'merge')) continue;
      recordImplicitSignal(run.runId, 'merge', { reportId: run.reportId, branch });
      fired += 1;
    }
  } catch {
    /* scansione best-effort: mai propagare in un tick condiviso */
  }
  return fired;
}

/**
 * Seam per il harness BRT: una REGRESSIONE (repro di un bug già fixato che
 * ri-fallisce) è un segnale NEGATIVO sulla run che aveva prodotto quel fix. Entro
 * il contratto congelato (ImplicitSignal = merge|resolved|discard) una regressione
 * è un `discard` con `detail` dedicato ("regression: …"), così i consumatori la
 * distinguono da un discard umano leggendo il dettaglio. La decisione se sia una
 * regressione resta del BRT: qui si scrive soltanto.
 */
export function recordRegressionSignal(runId: string, ctx?: SignalContext): void {
  // De-dup sulla spina (come `scanAutoBranchMerges`): un harness/poller BRT può
  // ri-chiamare questa per la STESSA regressione (retry CI) prima che la run cambi
  // stato. Senza guardia ogni chiamata scriverebbe un nuovo score IMPLICIT/'discard'
  // → `creditRun` sommerebbe `harmful` N volte per un solo evento, corrompendo il
  // ranking (utilità osservata). Un solo segnale di regressione per run.
  if (!runId || alreadySignaled(runId, 'discard')) return;
  const note = ctx?.detail ? `regression: ${ctx.detail}` : 'regression: BRT re-failed';
  recordImplicitSignal(runId, 'discard', { ...ctx, detail: note });
}

// ── Driver a intervallo OPT-IN (idempotente, hot-reload safe) ────────────────
// Registrato su `global`, non su una `let` di modulo: gli hot-reload del dev
// server ri-valutano il modulo e una `let` perderebbe il riferimento al timer,
// accumulando intervalli. Con la chiave globale c'è un solo watcher per processo.
const gs = global as unknown as { __bugbay_signal_watch__?: ReturnType<typeof setInterval> };

/** Intervallo del watcher in ms (override `BUGBAY_SIGNAL_WATCH_MS`, default 120s). */
function watchIntervalMs(): number {
  const s = Number(process.env.BUGBAY_SIGNAL_WATCH_MS);
  return Number.isFinite(s) && s > 0 ? s : 120_000;
}

/**
 * Avvia (una volta) un watcher autonomo che scansiona i merge a intervallo. OPT-IN
 * e idempotente: una seconda chiamata è un no-op finché non si ferma. `unref()`
 * così il timer non tiene vivo il processo. NON è un loop dello scheduler v0.7:
 * è un seam a sé, avviabile dal boot del daemon senza toccare gli altri loop.
 */
export function startSignalWatch(intervalMs: number = watchIntervalMs()): void {
  if (gs.__bugbay_signal_watch__) return;
  const timer = setInterval(() => {
    scanAutoBranchMerges();
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  gs.__bugbay_signal_watch__ = timer;
}

/** Ferma il watcher autonomo, se attivo (idempotente). */
export function stopSignalWatch(): void {
  if (!gs.__bugbay_signal_watch__) return;
  clearInterval(gs.__bugbay_signal_watch__);
  gs.__bugbay_signal_watch__ = undefined;
}
