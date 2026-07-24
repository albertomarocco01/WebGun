/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Orchestrazione del fix agentico: coda PERSISTENTE (le run `queued` vivono
 * nello store su disco e sopravvivono a hot-reload e riavvii) con pool a
 * concorrenza configurabile (maxParallelRuns) e API pubblica del workflow
 * (start singolo/batch, chiarimento, rifiuto, approve con commit, scarto,
 * abort/pausa/ripresa, riformulazioni). Le fasi di esecuzione vivono in
 * esecuzione.ts; gli helper condivisi in run-context.ts.
 *
 * @indice
 * - dispatchQueue            → pool parallelo sulla coda persistente
 * - startRun / startBatch    → creazione run (singola / multi-report)
 * - continueAfterClarify / rejectAndRelaunch / approve / discard / abortRun / pauseRun / resumeRun
 * - reformulateReport / reformulateChecklistItem
 * - autoIngestReport         → ingest automatico: riformulazione verificata + flag duplicati
 */

import crypto from 'crypto';
import { Cron } from 'croner';
import type { AgentRun, RunReport } from './types';
import { setRun, getRun, updateRun, log, getSettings, saveSettings, getAllRuns, hasActiveRunFor } from './store';
import { resolveScope, resolveScopeLight } from './scoping';
import { buildFixPrompt, buildResumePrompt, buildReformulatePrompt, REFORMULATE_SYSTEM } from './prompts';
import { runHeadless, killRun, markAborted, isAborted, clearAborted, MODEL_HAIKU } from './claude';
import { geminiReformulate, callGemini } from './gemini';
import { deepseekReformulate, callDeepseek } from './deepseek';
import { callAnthropic } from './anthropic';
import * as git from './git';
import { executeFromInterpret, doFix, judgePanel } from './esecuzione';
import { withRunRoot } from './target-root';
import { addScore } from './hub';
import { createWorktree, removeWorktree, autoBranch } from './worktree';
import { resolveRunRoot } from './registry';
import { autonomyEnabled, autonomyPollMs, autonomyGate } from './autonomy';
import { budgetGate, parkRun, listResumableSessions, clearPark } from './ledger';
import { detectStuckRuns } from './stuck-detector';
import { runScriptGate, type ScriptGate } from './exec';
import { notifyAutonomous, type AutoOutcome } from './notify';
import { projectId } from '@/modules/bugbay/lib/project';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { RUNNING_PHASES, lockedFiles, fetchReport, type RawReport, resolveKeys, runReports, setReportsStatus, setReportsStatusByIds, reopenReports, runTouchedFiles } from './run-context';

/* ── Coda persistente + pool parallelo ──────────────────────────── */

/**
 * Dispatcher: scansiona lo store per le run `queued` e ne avvia fino a
 * maxParallelRuns in parallelo, saltando quelle i cui file collidono con le
 * run in corso. Essendo la coda derivata dallo store (su disco), sopravvive
 * a hot-reload e riavvii: basta chiamare dispatchQueue() per riprendere.
 */
export function dispatchQueue(): void {
  startWatchLoop(); // avvia il poller autonomo al primo dispatch (no-op se flag OFF)
  // Gate di budget del canale 'fixer' (v0.7): a canale in pausa non si dispaccia —
  // le run restano 'queued' e verranno riprese al ritorno del budget (prossimo tick
  // del WATCH o prossima azione utente). Il poller sopra parte comunque.
  if (!budgetGate('fixer').ok) return;
  const settings = getSettings();
  const maxParallel = Math.max(1, settings.maxParallelRuns ?? 2);

  // Un solo passaggio per chiamata; ogni run avviata viene marcata
  // sincronicamente così le iterazioni successive vedono lo slot occupato.
  for (;;) {
    const all = getAllRuns();
    const running = all.filter((r) => RUNNING_PHASES.includes(r.phase));
    if (running.length >= maxParallel) return;

    // Stesso lock di doFix (run in esecuzione + review non committate): così una
    // run in conflitto NON viene proprio avviata → niente rimbalzo queued↔fixing.
    const locked = lockedFiles();
    const queued = all
      .filter((r) => r.phase === 'queued' && !isAborted(r.runId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const next = queued.find((q) => !q.scopedFiles.some((f) => locked.has(f)));
    if (!next) return;

    // Marca subito la fase (occupazione slot) e avvia in background.
    updateRun(next.runId, {
      phase: next.rejectFeedback || next.problema ? 'fixing' : 'interpreting',
      startedAt: next.startedAt ?? new Date().toISOString(),
    });
    // Le run AUTONOME girano in un worktree isolato (mai il working tree): dopo un
    // riavvio una run autonoma ri-accodata va ripresa con runAutonomous, non runOne.
    if (next.autonomous) void runAutonomous(next.runId);
    else void runOne(next.runId);
  }
}

async function runOne(runId: string): Promise<void> {
  const r = getRun(runId);
  if (!r || isAborted(runId)) { dispatchQueue(); return; }
  // Routing multi-repo (hub): esegui il fix nel repo della segnalazione. Se non
  // instradabile RIFIUTA — mai un fallback silenzioso sul repo del daemon.
  const rr = resolveRunRoot(r.projectId);
  if (!rr.ok) {
    updateRun(runId, { phase: 'error', error: `Impossibile instradare il fix: ${rr.reason}.` });
    dispatchQueue();
    return;
  }
  void setReportsStatus(r, 'In Lavorazione');
  try {
    // withRunRoot confina git/scoping/tsc/edit al repo instradato per tutta la
    // catena async. Fuori dall'hub rr.root === targetRoot() → no-op (invariato).
    await withRunRoot(rr.root, async () => {
      if (r.rejectFeedback) {
        const motivo = r.rejectFeedback;
        updateRun(runId, { rejectFeedback: undefined, phase: 'fixing' });
        await doFix(runId, buildResumePrompt(motivo), r.sessionId);
      } else if (!r.problema) {
        updateRun(runId, { phase: 'interpreting' });
        await executeFromInterpret(runId);
      } else {
        updateRun(runId, { phase: 'fixing' });
        const report = await fetchReport(r.reportId);
        const prompt = r.fixPrompt || buildFixPrompt({
          problema: r.problema || '',
          criteri: r.criteri,
          files: r.scopedFiles,
          reportNotes: report?.notes || r.reportTitolo,
          categoriaTecnica: r.categoriaTecnica,
        });
        updateRun(runId, { fixPrompt: prompt });
        await doFix(runId, prompt);
      }
    });
  } catch (e) {
    updateRun(runId, { phase: 'error', error: e instanceof Error ? e.message : 'Errore interno.' });
  } finally {
    dispatchQueue();
  }
}

/* ── Loop AUTONOMO (F3): esecuzione isolata in worktree ─────────────────── */

/**
 * Esegue una run AUTONOMA in un git worktree isolato su `bugbay/auto/<reportId>`:
 * interpret + fix + gate girano confinati lì (withRunRoot), MAI nel working tree
 * dell'utente. Se il gate è verde, il fix viene COMMITTATO sul branch isolato (il
 * deliverable che l'utente mergerà); altrimenti resta in review per un umano. Il
 * worktree viene sempre smontato a fine run. La store resta condivisa (bugbayDataDir
 * ignora l'override ALS), quindi UI e polling vedono la run normalmente.
 */
export async function runAutonomous(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run || isAborted(runId)) { dispatchQueue(); return; }
  const branch = autoBranch(run.reportId);
  // Routing multi-repo (hub): il worktree isolato va creato NEL repo della
  // segnalazione. Non instradabile → RIFIUTO (mai il repo del daemon).
  const rr = resolveRunRoot(run.projectId);
  if (!rr.ok) {
    updateRun(runId, { phase: 'error', error: `Impossibile instradare il fix autonomo: ${rr.reason}.`, finishedAt: new Date().toISOString() });
    void setReportsStatus(run, 'In Verifica', { resolution_notes: `[AI][auto] ❌ Routing repo fallito: ${rr.reason}.`.slice(0, 1500) });
    void notifyAutonomous(run, 'worktree-fail', branch);
    dispatchQueue();
    return;
  }
  const repoRoot = rr.root;
  // PRIMA di creare il worktree: sposta il report da 'Aperto'. Se createWorktree
  // fallisce, il report NON deve restare 'Aperto', altrimenti il WATCH (che seleziona
  // per status='Aperto') lo ri-prenderebbe a ogni tick all'infinito.
  void setReportsStatus(run, 'In Lavorazione');
  const appRoot = createWorktree(runId, run.reportId, repoRoot);
  if (!appRoot) {
    updateRun(runId, { phase: 'error', error: 'Impossibile creare il worktree isolato.', finishedAt: new Date().toISOString() });
    void notifyAutonomous(run, 'worktree-fail', branch);
    dispatchQueue();
    return;
  }
  log(runId, `Run autonoma: esecuzione isolata nel worktree su ${branch}.`);
  let outcome: AutoOutcome = 'error';
  try {
    outcome = await withRunRoot(appRoot, async () => {
      if (!run.problema) {
        await executeFromInterpret(runId);
      } else {
        const report = await fetchReport(run.reportId);
        const prompt = run.fixPrompt || buildFixPrompt({
          problema: run.problema || '',
          criteri: run.criteri,
          files: run.scopedFiles,
          reportNotes: report?.notes || run.reportTitolo,
          categoriaTecnica: run.categoriaTecnica,
        });
        await doFix(runId, prompt);
      }
      // Confidence gate: panel multi-lente + commit isolato + PARK degli ambigui.
      return await finalizeAutonomous(runId, branch);
    });
  } catch (e) {
    updateRun(runId, { phase: 'error', error: e instanceof Error ? e.message : 'Errore run autonoma.', finishedAt: new Date().toISOString() });
    outcome = 'error';
  } finally {
    removeWorktree(runId, repoRoot); // il RAMO resta (deliverable); il worktree no
    dispatchQueue();
  }
  if (!isAborted(runId)) void notifyAutonomous(getRun(runId) ?? run, outcome, branch);
}

/**
 * Confidence gate del commit autonomo. Gira DENTRO withRunRoot (git e gate+ operano
 * sul worktree isolato). tsc/eslint rossi (o nessuna modifica) → niente commit: fix
 * rotto, report 'In Verifica' "da controllare a mano". Verdi → gate+ opzionali
 * (test/build) + panel multi-lente; il fix è SEMPRE committato sul branch isolato
 * (mai il working tree: sicuro, reversibile, mai auto-mergiato), e la confidence
 * decide solo il FLAG della nota (✅ pronto vs ⚠️ da controllare) per l'umano che mergia.
 */
async function finalizeAutonomous(runId: string, branch: string): Promise<AutoOutcome> {
  const done = getRun(runId);
  if (!done) return 'error';
  if (done.phase === 'needs_clarification') return 'clarify';
  if (done.phase !== 'review') return 'error';

  const ids = runReports(done).map((r) => r.reportId);
  const files = done.modifiche.map((m) => m.path);

  // Gate tsc/eslint (valutato in doFix) rosso, o nessuna modifica → niente commit.
  if (!done.tscOk || !files.length) {
    await setReportsStatusByIds(ids, 'In Verifica', {
      resolution_notes: `[AI][auto] ❌ Gate tsc/eslint non superato su ${branch} — auto-fix scartato, richiede intervento manuale.`.slice(0, 1500),
    });
    log(runId, 'Gate tsc/eslint rosso → nessun commit autonomo (da controllare a mano).');
    return 'gate-fail';
  }

  // Gate+ opzionali (opt-in) nel worktree isolato: test e/o build assoluti.
  const gate = autonomyGate();
  let testGate: ScriptGate = 'skipped', buildGate: ScriptGate = 'skipped';
  if (gate.test) { updateRun(runId, { live: '⏳ Gate+: npm test…' }); testGate = await runScriptGate('test'); log(runId, `Gate+ test: ${testGate}`); }
  if (gate.build) { updateRun(runId, { live: '⏳ Gate+: npm run build…' }); buildGate = await runScriptGate('build'); log(runId, `Gate+ build: ${buildGate}`); }
  updateRun(runId, { live: undefined });

  // Panel multi-lente (giudici indipendenti) → confidence.
  const keys = resolveKeys();
  const provider = done.provider || keys.provider;
  log(runId, 'Panel Giudici (multi-lente) sul diff finale…');
  const panel = await judgePanel(runId, provider, keys, {
    problema: done.problema || '',
    criteri: done.criteri ?? [],
    diff: done.diff || git.diffFiles(files),
  });
  const heavyFail = testGate === 'fail' || buildGate === 'fail';
  const confidence: 'alta' | 'bassa' = !heavyFail && panel.confidence === 'alta' ? 'alta' : 'bassa';
  // Verdetto JUDGE sulla spina (F1): alimenta memoria + credit-assignment dei casi iniettati.
  emitVerdict(done, 'JUDGE', confidence === 'alta' ? 'pass' : 'fail', 0.5);

  // Commit SEMPRE sul branch isolato (mai il working tree): preserva il lavoro,
  // resta reversibile, e non viene mai auto-mergiato → nessun rischio.
  let committed = done.committed === true;
  if (!committed) {
    const titolo = (done.problema ?? done.reportTitolo).split('\n')[0].slice(0, 60);
    const tag = confidence === 'alta' ? '' : ' [da-controllare]';
    const commit = git.commitFiles(files, `fix(auto): ${titolo}${tag} [ai-run:${runId}]`);
    if (commit.ok) { committed = true; updateRun(runId, { committed: true, autoBranch: branch }); }
    else log(runId, `Commit autonomo fallito: ${commit.out.slice(0, 200)}`);
  }

  const gatePlus = [gate.test ? `test:${testGate}` : '', gate.build ? `build:${buildGate}` : ''].filter(Boolean).join(' ');
  const flag = confidence === 'alta' ? '✅ Auto-fix pronto' : '⚠️ DA CONTROLLARE';
  const note = `[AI][auto] ${flag} su ${branch}. ${panel.motivo}${gatePlus ? ` Gate+: ${gatePlus}.` : ''} ${committed ? `${files.length} file committati.` : 'Commit non riuscito.'}`.slice(0, 1500);
  await setReportsStatusByIds(ids, 'In Verifica', { resolution_notes: note });
  log(runId, `Esito autonomo: ${confidence === 'alta' ? 'confidence ALTA — pronto da mergere' : 'DA CONTROLLARE — verifica manuale'} su ${branch} (${files.length} file).`);

  if (!committed) return 'gate-fail';
  return confidence === 'alta' ? 'committed-alta' : 'committed-bassa';
}

/* ── WATCH: prende in carico da solo le segnalazioni aperte (flag OFF di default) ── */

// Job croner + lease su GLOBAL (non una let di modulo): l'hot-reload di Next ri-valuta
// il modulo e una let lascerebbe il vecchio job a girare (poller duplicati). Su global
// c'è UN SOLO job croner per processo. Croner `protect:true` serializza i tick (nessuna
// sovrapposizione, rimpiazza il vecchio flag `ticking`). Il lease per-reportId chiude
// la finestra tra la selezione del report e la marcatura RUNNING: ogni report viene
// dispacciato ESATTAMENTE UNA VOLTA (due run sullo stesso reportId raddoppierebbero la
// spesa e collidere sul branch bugbay/auto/<reportId>).
const gw = global as unknown as {
  __bugbay_watch_cron__?: Cron;
  __bugbay_watch_last__?: number;
  __bugbay_watch_leases__?: Set<string>;
};

/** Set di lease dei reportId attualmente in dispatch (uno per processo). */
function watchLeases(): Set<string> {
  return (gw.__bugbay_watch_leases__ ??= new Set<string>());
}

/** Battito del poller WATCH per l'endpoint health (running + ultimo tick). */
export function watchHeartbeat(): { running: boolean; lastTickAt: string | null } {
  return {
    running: Boolean(gw.__bugbay_watch_cron__),
    lastTickAt: gw.__bugbay_watch_last__ ? new Date(gw.__bugbay_watch_last__).toISOString() : null,
  };
}

/**
 * Avvia il poller WATCH una sola volta per processo, SOLO se l'autonomia è attiva
 * (flag esplicito in bugbay.config.json). Croner con pattern al secondo + `interval`
 * = poll ogni autonomyPollMs; `protect` impedisce tick sovrapposti (un tick lento non
 * ne fa partire un secondo). A ogni tick: StuckDetector, poi gate di budget 'fixer',
 * poi presa in carico delle segnalazioni 'Aperto' senza run attiva (rispettando
 * maxParallelRuns). Con autonomia OFF (default) non parte mai.
 */
export function startWatchLoop(): void {
  if (gw.__bugbay_watch_cron__ || !autonomyEnabled()) return;
  const pollSeconds = Math.max(1, Math.round(autonomyPollMs() / 1000));
  gw.__bugbay_watch_cron__ = new Cron(
    '* * * * * *',
    { interval: pollSeconds, protect: true, catch: true, name: 'bugbay-watch' },
    watchTick,
  );
}

/** Backoff: quanto un report resta escluso dal WATCH dopo un fix autonomo fallito. */
const AUTO_FAIL_COOLDOWN_MS = 10 * 60_000;

async function watchTick(): Promise<void> {
  gw.__bugbay_watch_last__ = Date.now(); // heartbeat per l'endpoint health
  const leases = watchLeases();

  // StuckDetector PRIMA del gate di budget: una run bloccata (stallo o loop di
  // repair) va parcheggiata anche a budget 'fixer' esaurito.
  try { detectStuckRuns(); } catch (e) { console.error('[bugbay] stuck-detector:', e); }

  // Gate di budget del canale 'fixer' (v0.7). A canale in pausa: (1) FERMA le run
  // autonome già in volo — il gate da solo bloccava solo il nuovo dispatch, lasciando
  // le run attive sforare il cap oltre il breaker; (2) le parcheggia col reset
  // (`pausedUntil`, prima calcolato e scartato) per il resume post-reset. pauseRun
  // uccide il figlio e annulla gli edit (worktree isolato) → nessun overshoot.
  const gate = budgetGate('fixer');
  if (!gate.ok) {
    const resumeAt = gate.pausedUntil ?? new Date().toISOString();
    for (const r of getAllRuns()) {
      if (r.autonomous && RUNNING_PHASES.includes(r.phase)) {
        try { pauseRun(r.runId); parkRun('fixer', r.runId, resumeAt); }
        catch (e) { console.error('[bugbay] park-on-trip:', e); }
      }
    }
    return;
  }

  // Budget ok: riprendi le run parcheggiate il cui reset è passato (`resumeAt ≤ now`).
  // Consuma il park e ri-mette in coda (dispatchQueue le riprende). NB: re-dispatch da
  // capo (non `--resume` a zero re-spend: ottimizzazione futura via session_id).
  for (const s of listResumableSessions()) {
    try { clearPark(s.sessionId); void resumeRun(s.sessionId); }
    catch (e) { console.error('[bugbay] resume-parked:', e); }
  }

  const settings = getSettings();
  const maxParallel = Math.max(1, settings.maxParallelRuns ?? 2);
  const all = getAllRuns();
  let slots = maxParallel - all.filter((r) => RUNNING_PHASES.includes(r.phase)).length;
  if (slots <= 0) return;

  const supabase = createAdminClient() as any;
  const pid = projectId();
  let q = supabase.from('debug_reports').select('id').eq('status', 'Aperto').order('created_at', { ascending: true });
  if (pid) q = q.eq('project_id', pid);
  const { data } = await q;
  for (const row of (data ?? []) as { id: string }[]) {
    if (slots <= 0) break;
    // Exactly-once: salta se già in lavorazione (store) O già in dispatch (lease).
    if (hasActiveRunFor(row.id) || leases.has(row.id)) continue;
    // Backoff: non ri-prendere un report con un fix autonomo fallito di recente
    // (evita churn/loop se il worktree o il fix falliscono di continuo).
    const recentFail = all.some((r) =>
      r.autonomous && r.reportId === row.id && r.phase === 'error' &&
      r.finishedAt && Date.now() - new Date(r.finishedAt).getTime() < AUTO_FAIL_COOLDOWN_MS,
    );
    if (recentFail) continue;
    const raw = await fetchReport(row.id);
    if (!raw) continue;
    const run = buildQueuedRun(row.id, raw);
    run.autonomous = true;
    // Marca SUBITO una fase RUNNING (non 'queued'): un dispatchQueue concorrente
    // prende solo le 'queued', quindi non ri-dispaccia questa run → niente doppia
    // esecuzione sullo stesso worktree.
    run.phase = 'interpreting';
    run.startedAt = new Date().toISOString();
    setRun(run);
    // Claim del lease: rilasciato quando la run autonoma termina (fase terminale;
    // fino ad allora hasActiveRunFor la copre comunque).
    leases.add(row.id);
    log(run.runId, 'Presa in carico autonoma (WATCH).');
    void runAutonomous(run.runId).finally(() => leases.delete(row.id));
    slots--;
  }
}

/* ── Riformulazione AI (riscrive la descrizione, non tocca codice) ── */

/**
 * Esegue un task di SOLO testo col canale più veloce disponibile quando il
 * provider è claude-headless: Anthropic REST (Haiku, ~1-3s) → Gemini REST
 * (Flash, ~1-3s) → CLI claude in text-mode (~10-13s, pavimento del boot exe).
 * Le run di fix NON passano di qui: l'editing richiede la CLI.
 */
async function fastText(
  keys: { anthropic?: string; gemini?: string },
  prompt: string,
  system: string = REFORMULATE_SYSTEM,
): Promise<string> {
  if (keys.anthropic) return callAnthropic(keys.anthropic, prompt, system);
  if (keys.gemini) return callGemini(keys.gemini, prompt, system);
  const res = await runHeadless({
    prompt,
    model: MODEL_HAIKU,
    timeoutMs: 90_000,
    textMode: { systemPrompt: system },
  });
  if (!res.ok) throw new Error(res.error ?? 'Riformulazione claude fallita.');
  return res.text;
}

export async function reformulateReport(
  reportId: string,
  provider?: string,
  geminiApiKey?: string,
  deepseekApiKey?: string,
): Promise<{ reportId: string; originale: string; proposta: string }> {
  const report = await fetchReport(reportId);
  if (!report) throw new Error('Segnalazione non trovata.');
  // Scope leggero: per riscrivere un testo bastano i file da URL (graphify
  // costerebbe secondi di spawn python senza beneficio).
  const scope = resolveScopeLight({ url: report.url });
  const keys = resolveKeys();
  const prov = provider || keys.provider;

  let proposta = report.notes;
  if (prov === 'gemini') {
    const apiKey = geminiApiKey || keys.gemini;
    if (!apiKey) throw new Error('Chiave API Gemini mancante nelle impostazioni.');
    proposta = await geminiReformulate(apiKey, report, scope.files);
  } else if (prov === 'deepseek') {
    const apiKey = deepseekApiKey || keys.deepseek;
    if (!apiKey) throw new Error('Chiave API DeepSeek mancante nelle impostazioni.');
    proposta = await deepseekReformulate(apiKey, report, scope.files);
  } else {
    const prompt = buildReformulatePrompt(
      { notes: report.notes, area: report.area, subArea: report.subArea, url: report.url },
      scope.files,
    );
    proposta = (await fastText(keys, prompt)).trim() || report.notes;
  }
  return { reportId, originale: report.notes, proposta };
}

/* ── Riformulazione AUTOMATICA all'ingest (default del workflow) ──
 * 1 agente riformula la segnalazione grezza; 2 verificatori INDIPENDENTI la
 * giudicano su due lenti diverse (fedeltà all'intento / problem posing corretto).
 * Se un verificatore boccia: UNA ripassata col feedback, poi ri-verifica.
 * Se ancora bocciata si tiene l'originale (mai peggiorare i dati). */

const VERIFY_SYSTEM =
  'You are a strict, skeptical QA reviewer of rewritten bug reports. Reply ONLY with a single JSON object: {"ok": true|false, "reason": "<short reason when not ok>"} — no markdown, no prose.';

const VERIFY_LENSES: Record<string, string> = {
  fidelity:
    'FIDELITY: does the rewrite preserve the original intent EXACTLY — no invented requirements, no dropped constraints, no changed meaning? UI labels, routes and quoted strings must survive verbatim.',
  posing:
    'PROBLEM POSING: is the problem correctly and actionably posed for an AI fixing agent — expected vs observed behavior explicit (when inferable), concrete, unambiguous, nothing important from the original left out?',
};

function buildVerifyPrompt(lens: string, originale: string, proposta: string): string {
  return `${VERIFY_LENSES[lens]}

Original report (verbatim, may be Italian):
${originale}

Rewritten report:
${proposta}

Judge ONLY on the lens above. Return the JSON verdict.`;
}

/** Parse tollerante del verdetto ({"ok":bool,...}); illeggibile → bocciato. */
function parseVerdict(raw: string): { ok: boolean; reason: string } {
  const m = raw.match(/"ok"\s*:\s*(true|false)/);
  const r = raw.match(/"reason"\s*:\s*"([^"]*)"/);
  return { ok: m?.[1] === 'true', reason: r?.[1] ?? (m ? '' : 'verdetto illeggibile') };
}

/**
 * Riformula automaticamente una segnalazione appena ingerita e la applica SOLO
 * se entrambi i verificatori approvano. Non lancia mai (fire-and-forget): ogni
 * errore lascia la segnalazione com'è. L'originale è conservato in notes_original.
 */
export async function autoReformulateReport(reportId: string): Promise<void> {
  try {
    const report = await fetchReport(reportId);
    // Solo segnalazioni aperte e con abbastanza testo da valere una riscrittura.
    if (!report || report.status !== 'Aperto' || (report.notes ?? '').trim().length < 12) return;
    const keys = resolveKeys();
    const scope = resolveScopeLight({ url: report.url });
    const originale = report.notes;

    let proposta = (
      await fastText(keys, buildReformulatePrompt(
        { notes: originale, area: report.area, subArea: report.subArea, url: report.url },
        scope.files,
      ))
    ).trim();

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!proposta || proposta === originale) return;
      const verdicts = await Promise.all(
        Object.keys(VERIFY_LENSES).map(async (lens) =>
          parseVerdict(await fastText(keys, buildVerifyPrompt(lens, originale, proposta), VERIFY_SYSTEM)),
        ),
      );
      if (verdicts.every((v) => v.ok)) {
        await applyReformulation(reportId, originale, proposta);
        return;
      }
      if (attempt === 0) {
        const feedback = verdicts.filter((v) => !v.ok).map((v) => `- ${v.reason}`).join('\n');
        proposta = (
          await fastText(
            keys,
            `${buildReformulatePrompt({ notes: originale, area: report.area, subArea: report.subArea, url: report.url }, scope.files)}

A previous rewrite was rejected by reviewers for these reasons — fix them:
${feedback}`,
          )
        ).trim();
      }
    }
    // Verifica fallita due volte: si tiene l'originale, il bottone manuale resta.
  } catch (e) {
    console.error('[auto-reformulate] fallita (segnalazione lasciata originale):', e);
  }
}

/** Applica la riscrittura conservando l'originale (colonna o, se manca, in coda). */
async function applyReformulation(reportId: string, originale: string, proposta: string): Promise<void> {
  const supabase = createAdminClient() as any;
  // Guardia anti-razza: aggiorna solo se le note sono ancora quelle ingerite.
  let { error } = await supabase.from('debug_reports')
    .update({ notes: proposta, notes_original: originale })
    .eq('id', reportId).eq('notes', originale);
  if (error) {
    // Schema Supabase non aggiornato (manca notes_original): conserva in coda.
    ({ error } = await supabase.from('debug_reports')
      .update({ notes: `${proposta}\n\n---\nOriginale del segnalatore:\n${originale}` })
      .eq('id', reportId).eq('notes', originale));
  }
  if (error) throw new Error(error.message);
}

/* ── Dedup all'ingest: flag "possibile duplicato" (mai blocco automatico) ── */

const DEDUP_SYSTEM =
  'You are a strict bug-tracker deduplication judge. Reply ONLY with a single JSON object: {"duplicate_of": "<id of the duplicated open report, or empty string if none>"} — no markdown, no prose.';

/**
 * Confronta la segnalazione con le APERTE dello stesso progetto: se una descrive
 * lo STESSO problema, antepone "[Possibile duplicato di #...]" alle note. Solo
 * flag informativo, mai blocco: decide l'operatore in lavagna. Gira DOPO la
 * riformulazione (nessuna interferenza con la guardia anti-razza di quest'ultima).
 */
async function flagDuplicate(reportId: string): Promise<void> {
  const report = await fetchReport(reportId);
  if (!report || report.status !== 'Aperto') return;
  const supabase = createAdminClient() as any;
  const { data } = await supabase.from('debug_reports').select('*').order('created_at', { ascending: false });
  const candidates = ((data ?? []) as any[])
    .filter((r) => r.id !== reportId && r.status === 'Aperto' && (r.project_id ?? null) === (report.projectId ?? null))
    .slice(0, 30);
  if (!candidates.length) return;

  const keys = resolveKeys();
  const list = candidates
    .map((r) => `- id ${r.id}: ${String(r.notes ?? '').replace(/\s+/g, ' ').slice(0, 300)}`)
    .join('\n');
  const raw = await fastText(
    keys,
    `NEW report:\n${report.notes}\n\nOPEN reports of the same project:\n${list}\n\nIs the NEW report about the SAME problem/request as one of the open ones (same defect or same ask — not merely the same page or area)? Return the JSON verdict; when unsure, "duplicate_of" MUST be an empty string.`,
    DEDUP_SYSTEM,
  );
  const dupId = raw.match(/"duplicate_of"\s*:\s*"([^"]*)"/)?.[1]?.trim() ?? '';
  if (!dupId || !candidates.some((r) => r.id === dupId)) return;

  // Rilegge le note correnti (la riformulazione può averle riscritte nel frattempo).
  const attuali = (await fetchReport(reportId))?.notes ?? report.notes;
  if (attuali.startsWith('[Possibile duplicato')) return;
  await supabase.from('debug_reports')
    .update({ notes: `[Possibile duplicato di #${dupId.slice(0, 8)}]\n\n${attuali}` })
    .eq('id', reportId).eq('notes', attuali);
}

/**
 * Ingest automatico completo (fire-and-forget dall'API di intake):
 * riformulazione verificata, poi flag duplicati sulle note finali.
 */
export async function autoIngestReport(reportId: string): Promise<void> {
  await autoReformulateReport(reportId); // non lancia mai
  try { await flagDuplicate(reportId); } catch (e) {
    console.error('[dedup] fallita (nessun flag):', e);
  }
}

export async function reformulateChecklistItem(
  notes: string,
  itemLabel: string,
  itemDesc: string,
  itemPath: string,
  provider?: string,
  geminiApiKey?: string,
  deepseekApiKey?: string,
): Promise<{ originale: string; proposta: string }> {
  const keys = resolveKeys();
  const prov = provider || keys.provider; // fallback alle impostazioni (il widget non passa il provider)

  const prompt = `Rewrite the reviewer's note below into a clear, rich, precise and technical bug/improvement report, integrating the context of the QA checklist item. Write in technical ENGLISH (the rewritten note becomes the prompt for an AI fixing agent), even if the original is in Italian; keep UI labels, route paths and quoted strings exactly as they appear.

QA checklist item context:
- Item title: ${itemLabel}
- Check description: ${itemDesc}
- Files/routes involved: ${itemPath}

Original reviewer note:
${notes || '(no note provided — describe the changes or anomalous behaviors based on the description above)'}

Make the note detailed enough to perfectly guide the developer (or the AI agent) to the fix: describe what to change and what to test.
Return ONLY the improved note, nothing else.`;

  let proposta = notes;
  if (prov === 'gemini') {
    const apiKey = geminiApiKey || keys.gemini;
    if (!apiKey) throw new Error('Chiave API Gemini mancante nelle impostazioni.');
    proposta = await callGemini(apiKey, prompt, REFORMULATE_SYSTEM);
  } else if (prov === 'deepseek') {
    const apiKey = deepseekApiKey || keys.deepseek;
    if (!apiKey) throw new Error('Chiave API DeepSeek mancante nelle impostazioni.');
    proposta = await callDeepseek(apiKey, prompt, REFORMULATE_SYSTEM);
  } else {
    proposta = (await fastText(keys, prompt)).trim() || notes;
  }
  return { originale: notes, proposta };
}

/* ── API pubblica (ritorna subito, il lavoro prosegue in background) ── */

/** Se il client passa chiavi API, le salva nelle impostazioni (mai nella run). */
function absorbKeys(provider?: string, geminiApiKey?: string, deepseekApiKey?: string): void {
  if (!provider && !geminiApiKey && !deepseekApiKey) return;
  const s = getSettings();
  saveSettings({
    ...s,
    provider: (provider as typeof s.provider) || s.provider,
    geminiApiKey: geminiApiKey || s.geminiApiKey,
    deepseekApiKey: deepseekApiKey || s.deepseekApiKey,
  });
}

/** Oggetto run in coda per una singola segnalazione (forma condivisa start/batch). */
function buildQueuedRun(reportId: string, raw: RawReport, provider?: string): AgentRun {
  return {
    runId: crypto.randomUUID().slice(0, 8), reportId, projectId: raw.projectId ?? null,
    reportTitolo: raw.notes.slice(0, 80), reportUrl: raw.url,
    branch: git.currentBranch(), phase: 'queued', scopedFiles: [], modifiche: [],
    log: [], createdAt: new Date().toISOString(), provider,
  };
}

/**
 * Raggruppa i reportId per overlap del file-pagina dell'URL (segnale cheap, niente
 * graphify): report sulla STESSA pagina → stesso gruppo (un solo working-tree, niente
 * race sullo snapshot dirtyBefore); report su pagine DISTINTE → gruppi separati (run
 * parallele, ognuna con criteri e Giudice propri). I report senza file-URL non sono
 * provabili indipendenti → confluiscono in un unico gruppo conservativo (come oggi).
 * ponytail: clusterizza solo sul segnale URL (sincrono); l'overlap scoperto solo da
 * graphify resta serializzato a runtime dal conflict-check del dispatcher.
 */
function clusterByUrlOverlap(items: { reportId: string; urlFiles: string[] }[]): string[][] {
  const parent = new Map<string, string>();
  items.forEach((it) => parent.set(it.reportId, it.reportId));
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };

  const fileOwner = new Map<string, string>();
  const unknown: string[] = [];
  for (const it of items) {
    if (it.urlFiles.length === 0) { unknown.push(it.reportId); continue; }
    for (const f of it.urlFiles) {
      const owner = fileOwner.get(f);
      if (owner) union(it.reportId, owner);
      else fileOwner.set(f, it.reportId);
    }
  }
  for (let i = 1; i < unknown.length; i++) union(unknown[0], unknown[i]);

  const groups = new Map<string, string[]>();
  for (const it of items) {
    const root = find(it.reportId);
    const arr = groups.get(root) ?? [];
    if (!groups.has(root)) groups.set(root, arr);
    arr.push(it.reportId);
  }
  return [...groups.values()];
}

export async function startRun(
  reportId: string,
  provider?: string,
  geminiApiKey?: string,
  deepseekApiKey?: string,
): Promise<AgentRun> {
  const report = await fetchReport(reportId);
  if (!report) throw new Error('Segnalazione non trovata.');
  absorbKeys(provider, geminiApiKey, deepseekApiKey);

  const run = buildQueuedRun(reportId, report, provider);
  setRun(run);
  dispatchQueue();
  return getRun(run.runId)!;
}

/**
 * Avvia il lavoro su PIÙ segnalazioni. Invece di fonderle tutte in una run (scope
 * unione, criteri fusi, un solo Giudice — bug scorrelati che si contaminano), le
 * partiziona per overlap di pagina: pagine distinte → run separate e parallele
 * (precisione per-report); stessa pagina → una run condivisa (un solo working-tree).
 * Ritorna la prima run creata; il poller `active=1` (indicizzato per reportId)
 * reidrata tutte le altre.
 */
export async function startBatch(
  reportIds: string[],
  provider?: string,
  geminiApiKey?: string,
  deepseekApiKey?: string,
): Promise<AgentRun> {
  const raws = new Map<string, RawReport>();
  for (const id of reportIds) {
    const raw = await fetchReport(id);
    if (raw) raws.set(id, raw);
  }
  if (!raws.size) throw new Error('Nessuna segnalazione valida selezionata.');
  if (raws.size === 1) {
    const [only] = raws.keys();
    return startRun(only, provider, geminiApiKey, deepseekApiKey);
  }
  absorbKeys(provider, geminiApiKey, deepseekApiKey);

  // Partiziona per progetto PRIMA di clusterizzare: una run (anche batch) pinna UN
  // solo repo (hub multi-repo), quindi non deve MAI mescolare segnalazioni di
  // progetti diversi in un unico working-tree. Dentro ogni progetto si clusterizza
  // per overlap di pagina come prima. Chiave '' = legacy senza project_id.
  const byProject = new Map<string, string[]>();
  for (const [id, raw] of raws) {
    const key = raw.projectId ?? '';
    const arr = byProject.get(key);
    if (arr) arr.push(id); else byProject.set(key, [id]);
  }

  let first: AgentRun | undefined;
  for (const ids of byProject.values()) {
    const items = ids.map((reportId) => ({
      reportId,
      urlFiles: resolveScopeLight({ url: raws.get(reportId)!.url }).daUrl,
    }));
    const clusters = clusterByUrlOverlap(items);
    for (const group of clusters) {
      let run: AgentRun;
      if (group.length === 1) {
        run = buildQueuedRun(group[0], raws.get(group[0])!, provider);
      } else {
        const reports: RunReport[] = group.map((id) => {
          const raw = raws.get(id)!;
          return { reportId: id, titolo: raw.notes.slice(0, 80), url: raw.url };
        });
        run = {
          runId: crypto.randomUUID().slice(0, 8),
          reportId: group[0],
          projectId: raws.get(group[0])!.projectId ?? null,
          reportTitolo: `[Batch ×${reports.length}] ${reports[0].titolo}`.slice(0, 80),
          reportUrl: reports[0].url,
          reports,
          branch: git.currentBranch(), phase: 'queued', scopedFiles: [], modifiche: [],
          log: [`[${new Date().toLocaleTimeString('it-IT')}] Run batch su ${reports.length} segnalazioni (stessa pagina).`],
          createdAt: new Date().toISOString(),
          provider,
        };
      }
      setRun(run);
      first ??= getRun(run.runId)!;
    }
  }
  dispatchQueue();
  return first!;
}

export async function continueAfterClarify(runId: string, risposta: string): Promise<AgentRun> {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  // Il chiarimento forza una NUOVA interpretazione (criteri e scope aggiornati).
  const chiarimento = run.chiarimento ? `${run.chiarimento}\n${risposta}` : risposta;
  log(runId, `Chiarimento ricevuto → reinterpretazione.`);
  updateRun(runId, { chiarimento, domanda: undefined, problema: undefined, criteri: undefined, phase: 'queued' });
  dispatchQueue();
  return getRun(runId)!;
}

export function rejectAndRelaunch(runId: string, motivo: string): AgentRun {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  log(runId, `Rifiutato: "${motivo}" → in coda per rilancio.`);
  updateRun(runId, { phase: 'queued', rejectFeedback: motivo });
  dispatchQueue();
  return getRun(runId)!;
}

/**
 * Confina un'operazione git di LIFECYCLE (commit dell'approve, restore di
 * discard/abort/pause) nel repo DELLA RUN (hub multi-repo): senza questo
 * wrapper girerebbe nel repo del daemon — commit che fallisce per pathspec
 * o, peggio, restore di un path omonimo nel repo sbagliato.
 */
function inRunRepo<T>(run: AgentRun, fn: () => T): T {
  const rr = resolveRunRoot(run.projectId);
  if (!rr.ok) throw new Error(`Impossibile instradare l'operazione git: ${rr.reason}.`);
  return withRunRoot(rr.root, fn);
}

/**
 * Accetta un SOTTOINSIEME delle segnalazioni della run (o tutte). Il diff è
 * condiviso: i file si committano UNA volta sola (al primo accept); gli accept
 * successivi marcano solo come risolte le segnalazioni indicate. L'accettazione
 * è DEFINITIVA → 'Risolto' (niente passaggio intermedio "In Verifica"). La run
 * si chiude (phase 'approved') quando TUTTE le sue segnalazioni sono accettate.
 */
/**
 * Emette un verdetto sulla spina (fix concilio F1): prima approve/discard/giudice
 * NON scrivevano MAI su `scores`, quindi `onVerdict` non scattava e la memoria
 * (episodica + credit-assignment) restava vuota. `addScore` innesca la distillazione.
 * Best-effort: un verdetto sulla spina non deve mai rompere approve/discard.
 */
function emitVerdict(run: AgentRun, source: 'HUMAN' | 'JUDGE', verdict: string, weight: number): void {
  try {
    addScore({ id: crypto.randomUUID(), run_id: run.runId, report_id: run.reportId ?? null, source, verdict, weight });
  } catch (e) {
    // Best-effort ma OSSERVABILE (come gli altri call-site del tick): se il verdetto
    // si perde per un motivo reale (disco/schema), deve restare una traccia.
    console.error('[bugbay] emitVerdict:', e);
  }
}

export async function approveReports(runId: string, reportIds: string[]): Promise<AgentRun> {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');

  // Commit unico dei file della run (al primo accept): l'approve non resta
  // volatile nel working tree (un discard successivo non può più cancellarlo).
  if (!run.committed) {
    const toCommit = run.modifiche.map((m) => m.path);
    if (toCommit.length) {
      const titolo = (run.problema ?? run.reportTitolo).split('\n')[0].slice(0, 60);
      const commit = inRunRepo(run, () => git.commitFiles(toCommit, `fix(debug): ${titolo} [ai-run:${run.runId}]`));
      log(runId, commit.ok ? `Commit creato per ${toCommit.length} file.` : `Commit non riuscito: ${commit.out.slice(0, 200)}`);
    }
    updateRun(runId, { committed: true });
  }

  // Accettazione definitiva → 'Risolto' per le sole segnalazioni indicate.
  await setReportsStatusByIds(reportIds, 'Risolto', {
    resolution_notes: `[AI] ${run.riassunto ?? 'Risolto dall\'agente.'}`.slice(0, 1500),
    resolved_at: new Date().toISOString(),
  });

  // Marca le segnalazioni accettate; la run si chiude solo quando lo sono TUTTE.
  if (run.reports?.length) {
    const updated = run.reports.map((r) => (reportIds.includes(r.reportId) ? { ...r, accepted: true } : r));
    const allAccepted = updated.every((r) => r.accepted);
    log(runId, `Accettate ${reportIds.length} segnalazioni → Risolto${allAccepted ? ' (run completata)' : ''}.`);
    const out = updateRun(runId, { reports: updated, ...(allAccepted ? { phase: 'approved' } : {}) })!;
    // Verdetto HUMAN solo alla chiusura completa E solo se la run NON era già approvata
    // (idempotenza: una ri-chiamata di approve — retry di rete/doppio click — non deve
    // raddoppiare lo score). `run.phase` è il valore PRE-update (run catturata a inizio funzione).
    if (allAccepted && run.phase !== 'approved') emitVerdict(run, 'HUMAN', 'approved', 1.0);
    dispatchQueue();
    return out;
  }

  log(runId, 'Accettata e chiusa (Risolto).');
  const out = updateRun(runId, { phase: 'approved' })!;
  if (run.phase !== 'approved') emitVerdict(run, 'HUMAN', 'approved', 1.0);
  dispatchQueue();
  return out;
}

/** Accetta TUTTE le segnalazioni della run (commit + Risolto + chiusura). */
export async function approve(runId: string): Promise<AgentRun> {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  const ids = run.reports?.length ? run.reports.map((r) => r.reportId) : [run.reportId];
  return approveReports(runId, ids);
}

export function discard(runId: string): AgentRun {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  inRunRepo(run, () => git.restoreFiles(runTouchedFiles(run)));
  log(runId, 'Scartato → modifiche annullate.');
  const out = updateRun(runId, { phase: 'discarded' })!;
  // Idempotenza: un discard ripetuto su una run già scartata non deve raddoppiare lo score.
  if (run.phase !== 'discarded') emitVerdict(run, 'HUMAN', 'discarded', 1.0);
  void reopenReports(run);
  dispatchQueue();
  return out;
}

export function abortRun(runId: string): AgentRun {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  markAborted(runId);
  killRun(runId);
  inRunRepo(run, () => git.restoreFiles(runTouchedFiles(run)));
  log(runId, 'Interrotto dall\'utente.');
  const out = updateRun(runId, { phase: 'aborted' })!;
  void reopenReports(run);
  dispatchQueue();
  return out;
}

export function pauseRun(runId: string): AgentRun {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  markAborted(runId);
  killRun(runId);
  inRunRepo(run, () => git.restoreFiles(runTouchedFiles(run)));
  log(runId, 'Interrotta (riprendibile): processi fermati e modifiche della run annullate.');
  const out = updateRun(runId, { phase: 'paused' })!;
  dispatchQueue();
  return out;
}

export async function resumeRun(runId: string): Promise<AgentRun> {
  const run = getRun(runId);
  if (!run) throw new Error('Run non trovata.');
  clearAborted(runId);
  log(runId, 'Ripresa esecuzione in corso…');
  // Il rilancio manuale usa il provider CORRENTE delle impostazioni: se l'utente
  // ha cambiato provider proprio perché il precedente falliva, va rispettato.
  updateRun(runId, { phase: 'queued', error: undefined, provider: getSettings().provider });
  dispatchQueue();
  return getRun(runId)!;
}
