/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Fasi di esecuzione in background di una run agentica: interpretazione
 * (scope deterministico + Interprete, anche batch in UNA chiamata), fix
 * (codemod a 0 token o Fixer del provider, con snapshot preDirty e diff-guard),
 * gate tsc relativo e Giudice sui criteri con repair mirato (max 2).
 *
 * @indice
 * - executeFromInterpret → scope + Interprete (tipo task/complessità/categoria) → [chiarimento] → fix
 * - doFix                → [BRT fail-to-pass] + Fixer (profilo per tipo task) + diff-guard + gate tsc + repro-gate + Giudice → review
 * - judgePanel           → panel multi-lente + confidence gate (commit autonomo F3)
 */

import type { FileChange, RunReport, RunVerdict } from './types';
import { getRun, updateRun, log, trace } from './store';
import { resolveScope } from './scoping';
import { tryCodemod } from './codemod';
import { buildInterpretPrompt, buildInterpretBatchPrompt, buildFixPrompt, buildPlanPrompt, buildResumePrompt, buildJudgePrompt, buildReproTestPrompt, tipoTaskFrom, retrievalEnabled, renderMemorySection } from './prompts';
import { retrieve } from './retrieval';
import { runHeadless, isAborted } from './claude';
import { chooseModel, isHeavyFix, MODEL_SONNET } from './routing';
import { targetRoot } from './target-root';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tscBaseline, tscGateRelative, eslintBaseline, eslintGateRelative, runTscBuildInfo, runScriptGate, type GateResult } from './exec';
import { geminiFix, callGemini } from './gemini';
import { deepseekFix, callDeepseek } from './deepseek';
import { callAnthropic } from './anthropic';
import * as git from './git';
import {
  lockedFiles, type RawReport,
  fetchReport, resolveKeys, runReports, setReportsStatus, fileToArea, extractJson,
} from './run-context';

/** Scope + Interprete (singolo o batch); se chiaro procede al fix, altrimenti chiede. */
export async function executeFromInterpret(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) return;

  const reports = runReports(run);
  const raws: { rep: RunReport; raw: RawReport }[] = [];
  for (const rep of reports) {
    const raw = await fetchReport(rep.reportId);
    if (raw) raws.push({ rep, raw });
  }
  if (!raws.length) { updateRun(runId, { phase: 'error', error: 'Segnalazione non trovata.' }); return; }

  // Il chiarimento dell'utente (se presente) si applica alle descrizioni.
  const withClarify = (notes: string) =>
    run.chiarimento ? `${notes}\n\nChiarimento dell'utente: ${run.chiarimento}` : notes;

  // Scope: unione dei file di tutte le segnalazioni (cap dinamico per i batch).
  const cap = Math.min(12, 6 + (raws.length - 1) * 3);
  const scoped: string[] = [];
  let daUrlTot = 0, daGrafoTot = 0;
  for (const { raw } of raws) {
    const s = resolveScope({ url: raw.url, notes: withClarify(raw.notes), subArea: raw.subArea });
    daUrlTot += s.daUrl.length; daGrafoTot += s.daGrafo.length;
    for (const f of s.files) {
      if (!scoped.includes(f)) scoped.push(f);
      if (scoped.length >= cap) break;
    }
    if (scoped.length >= cap) break;
  }
  if (isAborted(runId)) return;
  updateRun(runId, { scopedFiles: scoped });
  trace(runId, '🔍', 'scope', `${scoped.length} file (${daUrlTot} da URL, ${daGrafoTot} da grafo)${raws.length > 1 ? ` · batch di ${raws.length} segnalazioni` : ''}`);

  // Interprete: UNA chiamata anche per i batch.
  const keys = resolveKeys();
  const provider = run.provider || keys.provider;
  const isBatch = raws.length > 1;
  // Fast-path REST per claude-headless: con una chiave Anthropic/Gemini
  // l'interpretazione scende da ~10-60s (boot CLI) a ~2-5s. Il canale REST non
  // ha shell → niente graphify hint nel prompt.
  const restChannel = provider === 'claude-headless' ? (keys.anthropic ? 'anthropic' : keys.gemini ? 'gemini-fast' : '') : '';
  const graphifyHint = provider === 'claude-headless' && !restChannel;
  const reportLite = (raw: RawReport) => ({
    notes: withClarify(raw.notes), area: raw.area, subArea: raw.subArea,
    url: raw.url, categoria: raw.category, priorita: raw.priority,
  });
  const prompt = isBatch
    ? buildInterpretBatchPrompt(raws.map(({ rep, raw }) => ({ reportId: rep.reportId, report: reportLite(raw) })), scoped, { graphifyHint })
    : buildInterpretPrompt(reportLite(raws[0].raw), scoped, { graphifyHint });

  let parsed: any = null;
  const sysJson = 'You are the QA interpreter. Return ONLY a valid JSON object following the requested schema.';
  const t0 = Date.now();
  if (provider === 'gemini') {
    if (!keys.gemini) { updateRun(runId, { phase: 'error', error: 'Chiave API Gemini mancante (impostazioni o GEMINI_API_KEY).' }); return; }
    trace(runId, '🧠', 'interprete', 'analisi segnalazione…', { model: 'gemini' });
    try { parsed = JSON.parse(await callGemini(keys.gemini, prompt, sysJson, true, runId)); } catch (e) {
      updateRun(runId, { phase: 'error', error: e instanceof Error ? e.message : 'Interprete Gemini fallito.' }); return;
    }
  } else if (provider === 'deepseek') {
    if (!keys.deepseek) { updateRun(runId, { phase: 'error', error: 'Chiave API DeepSeek mancante (impostazioni o DEEPSEEK_API_KEY).' }); return; }
    trace(runId, '🧠', 'interprete', 'analisi segnalazione…', { model: 'deepseek' });
    try { parsed = JSON.parse(await callDeepseek(keys.deepseek, prompt, sysJson, true, runId)); } catch (e) {
      updateRun(runId, { phase: 'error', error: e instanceof Error ? e.message : 'Interprete DeepSeek fallito.' }); return;
    }
  } else if (restChannel) {
    trace(runId, '🧠', 'interprete', 'analisi segnalazione (fast-path REST)…', { model: restChannel === 'anthropic' ? 'haiku-rest' : 'gemini-rest' });
    try {
      const raw = restChannel === 'anthropic'
        ? await callAnthropic(keys.anthropic!, prompt, sysJson, runId)
        : await callGemini(keys.gemini!, prompt, sysJson, true, runId);
      parsed = extractJson(raw);
    } catch { parsed = null; }
    if (!parsed) {
      // REST fallito/illeggibile → fallback CLI (ha anche la shell per graphify).
      const interpModel = chooseModel({ phase: 'interprete' });
      trace(runId, '🧠', 'interprete', 'fast-path REST fallito → fallback CLI', { model: interpModel });
      const interp = await runHeadless({ prompt, model: interpModel, runId });
      if (isAborted(runId)) return;
      parsed = interp.ok ? extractJson(interp.text) : null;
      if (!parsed && !interp.ok) { updateRun(runId, { phase: 'error', error: interp.error ?? 'Interprete fallito.' }); return; }
    }
  } else {
    const interpModel = chooseModel({ phase: 'interprete' });
    trace(runId, '🧠', 'interprete', 'analisi segnalazione…', { model: interpModel });
    const interp = await runHeadless({ prompt, model: interpModel, runId });
    if (isAborted(runId)) return;
    parsed = interp.ok ? extractJson(interp.text) : null;
    if (!parsed && !interp.ok) { updateRun(runId, { phase: 'error', error: interp.error ?? 'Interprete fallito.' }); return; }
  }
  trace(runId, '🧠', 'interprete', 'analisi completata', { ms: Date.now() - t0 });

  // Normalizza l'esito (per i batch: un elemento per reportId).
  const perReport: Map<string, any> = new Map();
  if (isBatch) {
    const arr = Array.isArray(parsed?.reports) ? parsed.reports : [];
    for (const item of arr) if (item?.reportId) perReport.set(String(item.reportId), item);
  } else if (parsed) {
    perReport.set(raws[0].rep.reportId, parsed);
  }

  const updatedReports: RunReport[] = [];
  const domande: string[] = [];
  const problemi: string[] = [];
  const criteriTot: string[] = [];
  const filesInterp: string[] = [];
  for (const { rep, raw } of raws) {
    const p = perReport.get(rep.reportId);
    const problema = (p?.problema as string) || raw.notes;
    const criteri = Array.isArray(p?.criteri) ? (p.criteri as string[]) : [];
    const chiaro = p?.chiaro !== false;
    const domanda = !chiaro && p?.domanda ? String(p.domanda) : undefined;
    updatedReports.push({ ...rep, problema, criteri, domanda });
    problemi.push(problema);
    for (const c of criteri) if (!criteriTot.includes(c)) criteriTot.push(c);
    if (domanda) domande.push(isBatch ? `[${rep.titolo.slice(0, 60)}] ${domanda}` : domanda);
    if (Array.isArray(p?.files)) for (const f of p.files as string[]) if (!filesInterp.includes(f)) filesInterp.push(f);
  }

  const problema = isBatch ? problemi.map((p, i) => `${i + 1}) ${p}`).join('\n') : problemi[0];
  const files = filesInterp.length ? filesInterp : scoped;

  // Routing multi-modello: complessità (banale→media→alta) e categoria tecnica
  // (ui/database/...) stimate dall'Interprete. Per i batch vince la complessità
  // MASSIMA e la prima categoria specifica.
  const rank = { banale: 0, media: 1, alta: 2 } as const;
  let complessita: 'banale' | 'media' | 'alta' = 'media';
  let categoriaTecnica = 'other';
  const parsedItems = [...perReport.values()];
  const complexities = parsedItems.map((p) => String(p?.complessita ?? '')).filter((c): c is keyof typeof rank => c in rank);
  if (complexities.length) complessita = complexities.reduce((a, b) => (rank[b] > rank[a] ? b : a));
  const cat = parsedItems.map((p) => String(p?.categoria_tecnica ?? '')).find((c) => c && c !== 'other');
  if (cat) categoriaTecnica = cat;
  // Tipo task dalla categoria della segnalazione (profilo agente): nei batch
  // misti vince il profilo più cauto (bug > feature > miglioria).
  const tipoRank = { miglioria: 0, feature: 1, bug: 2 } as const;
  const tipoTask = raws
    .map(({ raw }) => tipoTaskFrom(raw.category))
    .reduce((a, b) => (tipoRank[b] > tipoRank[a] ? b : a));
  updateRun(runId, { problema, criteri: criteriTot, scopedFiles: files, complessita, categoriaTecnica, tipoTask, reports: run.reports ? updatedReports : undefined });
  trace(runId, '🧠', 'interprete', `task ${tipoTask} · complessità ${complessita} · categoria ${categoriaTecnica} · ${criteriTot.length} criteri`);

  if (domande.length) {
    trace(runId, '⏸', 'interprete', `segnalazion${domande.length > 1 ? 'i vaghe' : 'e vaga'} → chiedo chiarimento`);
    updateRun(runId, { phase: 'needs_clarification', domanda: domande.join('\n'), finishedAt: new Date().toISOString() });
    void setReportsStatus(run, 'In Chiarimento');
    return;
  }
  const reportNotes = raws.map(({ raw }) => withClarify(raw.notes)).join('\n---\n');
  // Memoria episodica (Track R): recupero FTS5 BM25 dei casi passati simili,
  // iniettato nel prompt del Fixer. La query è `reportNotes`: l'ingest tenta di
  // ri-formularle in inglese (`autoReformulateReport`) ma è BEST-EFFORT — su
  // fallback resta l'italiano, quindi la query NON è garantita inglese. Degrada la
  // recall contro l'indice inglese (recupero parziale via i token di error-string,
  // language-agnostic), MAI corruzione: `ftsMatch` tokenizza e non lancia. GATED:
  // OFF di default finché il gate misurato non prova delta>=0 (vedi
  // test/retrieval.test.mjs). Best-effort: mai bloccare il fix.
  let memory: string | undefined;
  if (retrievalEnabled()) {
    try {
      const r = await retrieve(reportNotes, {
        runId,
        reportId: raws[0]?.rep.reportId ?? null,
        projectId: run.projectId ?? null,
        limit: 3,
      });
      memory = renderMemorySection(r.cases, r.archetypes);
    } catch { /* recupero best-effort: mai rompere il fix */ }
  }
  await doFix(runId, buildFixPrompt({ problema, criteri: criteriTot, files, reportNotes, categoriaTecnica, tipoTask, memory }));
}

/** Fase Fixer + gate tsc relativo → review. (background) */
export async function doFix(runId: string, prompt: string, resumeSessionId?: string): Promise<void> {
  const run = getRun(runId);
  if (!run || isAborted(runId)) return;

  const files = run.scopedFiles;

  // Conflitto file → torna in coda finché i file si liberano. STESSO lock del
  // dispatcher (run in esecuzione + review non committate): l'allineamento evita il
  // busy-loop queued↔fixing. Di norma il dispatcher non avvia nemmeno una run in
  // conflitto — questo resta come rete di sicurezza.
  const locked = lockedFiles(runId);
  const conflict = files.filter((f) => locked.has(f));
  if (conflict.length) {
    log(runId, `File occupati da un'altra run (${conflict.join(', ')}) → resto in coda.`);
    updateRun(runId, { phase: 'queued' });
    return;
  }

  const curBranch = git.currentBranch();
  updateRun(runId, { phase: 'fixing', branch: curBranch, fixPrompt: prompt });

  // Snapshot dei file GIÀ sporchi prima del fix: diff-guard e ripristini non
  // devono mai toccare il lavoro non committato dell'utente.
  const dirtyBefore = new Set(git.changedFiles());
  const dirtyScoped = files.filter((f) => dirtyBefore.has(f));
  if (dirtyScoped.length) log(runId, `Attenzione: ${dirtyScoped.length} file in scope hanno già modifiche non committate (${dirtyScoped.join(', ')}).`);
  updateRun(runId, { preDirty: [...dirtyBefore] });

  // Baseline PRE-fix (tsc + ESLint) IN PARALLELO: il gate è relativo, bloccano
  // solo i problemi NUOVI. ESLint gira sui soli file in scope e si astiene se
  // il target non lo ha.
  trace(runId, '📏', 'baseline', 'tsc + ESLint pre-fix (in parallelo)…');
  // Cache tsbuildinfo dedicata a QUESTA run: isola il gate dalle run parallele
  // (nessun clobber della cache incrementale) e resta caldo tra baseline/gate/repair.
  const tscBuildInfo = runTscBuildInfo(runId);
  const [baseline, lintBaseline] = await Promise.all([tscBaseline(tscBuildInfo), eslintBaseline(files)]);
  if (baseline.size) log(runId, `Baseline: ${baseline.size} errori tsc pre-esistenti nel branch (non bloccanti).`);
  if (lintBaseline.size) log(runId, `Baseline: ${lintBaseline.size} lint error pre-esistenti sui file in scope (non bloccanti).`);
  // Gate composto: tsc (tipi) + ESLint (lint), entrambi relativi alla baseline.
  const gate = async (): Promise<GateResult> => {
    const tsc = await tscGateRelative(baseline, tscBuildInfo);
    const lint = await eslintGateRelative(lintBaseline, files);
    if (tsc.ok && lint.ok) return tsc;
    return {
      ok: false,
      output: [tsc.output, lint.output].filter(Boolean).join('\n'),
      newErrors: [...(tsc.newErrors ?? []), ...(lint.newErrors ?? [])],
    };
  };
  if (isAborted(runId)) return;

  let res: { ok: boolean; text: string; error?: string; sessionId?: string };
  const keys = resolveKeys();
  const provider = run.provider || keys.provider;
  const report = await fetchReport(run.reportId);
  const reportNotes = report?.notes || run.reportTitolo;
  updateRun(runId, { attempts: (run.attempts ?? 0) + 1 });

  // CODEMOD deterministico (0 token): i pattern meccanici saltano l'LLM.
  const cm = tryCodemod(`${run.problema ?? ''}\n${reportNotes}`, files);

  // BRT — Bug Reproduction Test (fail-to-pass, best practice APR): PRIMA di
  // toccare il fix, un agente scrive un test che codifica il comportamento
  // ATTESO e quindi FALLISCE sul codice buggato. Diventa il ground truth
  // empirico del fix e resta nel repo come regressione al commit. Solo bug
  // logic/database non banali, run singola, provider claude e vitest presente.
  let reproPath: string | undefined;
  if (!cm && (!provider || provider === 'claude-headless')
    && process.env.BUGBAY_REPRO_TEST !== '0'
    && (run.tipoTask ?? 'bug') === 'bug'
    && ['logic', 'database'].includes(run.categoriaTecnica ?? '')
    && run.complessita !== 'banale'
    && (run.reports?.length ?? 1) <= 1
    && files.length > 0 && hasVitest()) {
    const dir = path.posix.dirname(files[0].replace(/\\/g, '/'));
    // Estensione coerente col repo: .ts solo se c'è un tsconfig (un test TS in
    // un repo JS fallirebbe per transform → falso "bug riprodotto").
    const ext = fs.existsSync(path.join(targetRoot(), 'tsconfig.json')) ? 'ts' : 'js';
    const tp = `${dir === '.' ? '' : `${dir}/`}bugbay-repro-${runId.slice(0, 8)}.test.${ext}`;
    const reproModel = chooseModel({ phase: 'repro' });
    trace(runId, '🧫', 'repro', `genero il test di riproduzione fail-to-pass: ${tp}`, { model: reproModel });
    updateRun(runId, { live: '🧫 Genero il test di riproduzione…' });
    const tRepro = Date.now();
    const gen = await runHeadless({
      prompt: buildReproTestPrompt({ problema: run.problema || '', criteri: run.criteri, reportNotes, files, testPath: tp }),
      model: reproModel, allowEdits: true, runId, timeoutMs: 5 * 60_000,
    });
    if (isAborted(runId)) return;
    const abs = path.join(targetRoot(), tp);
    if (gen.ok && fs.existsSync(abs)) {
      // Validazione del riproduttore (stile AssertFlip): DEVE fallire sul codice
      // attuale. Se passa non riproduce il bug → scartato, si prosegue col solo
      // Giudice (fallback alla Agentless: mai fidarsi di un riproduttore invalido).
      const outcome = await runCheckCommand(`npx vitest run ${tp}`);
      if (outcome === 'fail') {
        reproPath = tp;
        files.push(tp); // in scope: il diff-guard non lo reverte e all'accept viene committato come regressione
        prompt = `${prompt}\n\nA FAILING reproduction test exists at ${tp}: it encodes the EXPECTED behavior and currently fails because of the bug. Your fix MUST make it pass (verify with \`npx vitest run ${tp}\`). NEVER modify or delete that test file.`;
        updateRun(runId, { scopedFiles: files, fixPrompt: prompt, reproTest: { path: tp, status: 'confirmed' } });
        trace(runId, '🧫', 'repro', 'il test FALLISCE sul codice attuale → bug riprodotto, ground truth del fix', { ms: Date.now() - tRepro });
      } else {
        try { fs.unlinkSync(abs); } catch { /* già assente */ }
        updateRun(runId, { reproTest: { path: tp, status: 'invalid' } });
        trace(runId, '🧫', 'repro', 'il test PASSA già (non riproduce il bug) → scartato, si prosegue col solo Giudice', { ms: Date.now() - tRepro });
      }
    } else {
      trace(runId, '🧫', 'repro', 'generazione del riproduttore fallita → si prosegue senza BRT');
    }
  }

  if (cm) {
    trace(runId, '🔧', 'fixer', `codemod deterministico (0 token) su ${cm.modifiedFiles.length} file — Fixer LLM saltato`);
    updateRun(runId, { codemod: true });
    res = { ok: true, text: cm.riassunto };
  } else if (provider === 'gemini' && keys.gemini) {
    trace(runId, '🔧', 'fixer', `branch ${curBranch} · ${files.length} file`, { model: 'gemini' });
    res = await geminiFix(keys.gemini, { problema: run.problema || '', criteri: run.criteri, files, reportNotes, runId, gate });
  } else if (provider === 'deepseek' && keys.deepseek) {
    trace(runId, '🔧', 'fixer', `branch ${curBranch} · ${files.length} file`, { model: 'deepseek' });
    res = await deepseekFix(keys.deepseek, { problema: run.problema || '', criteri: run.criteri, files, reportNotes, runId, gate });
  } else {
    // ROUTING MULTI-MODELLO (claude-headless): Sonnet è il default (2-3× più
    // rapido e molto più economico); Opus solo dove il ragionamento pesa —
    // complessità alta, priorità Critica/Urgente, o dopo un'escalation.
    const fixSignals = { complessita: run.complessita, priority: report?.priority, escalated: run.escalated };
    const heavy = isHeavyFix(fixSignals);
    const fixModel = chooseModel({ phase: 'fix', ...fixSignals });
    updateRun(runId, { fixModel });

    // PLAN-THEN-EXECUTE sui casi complessi: il ragionamento profondo lo fa Opus
    // in SOLA LETTURA (piano breve), gli edit li esegue Sonnet seguendo il piano.
    // Token Opus ~⅓ a parità di qualità di ragionamento. Solo al primo giro
    // (non su resume/repair, dove la sessione ha già il contesto). Le FEATURE
    // non banali pianificano SEMPRE: codice nuovo senza piano diverge dalle
    // convenzioni del repo molto più di un fix puntuale.
    let fixPrompt = prompt;
    const planNeeded = heavy || (run.tipoTask === 'feature' && run.complessita !== 'banale');
    if (planNeeded && !resumeSessionId && !run.escalated) {
      const planModel = chooseModel({ phase: 'piano' });
      trace(runId, '🗺', 'piano', 'caso complesso → Planner in sola lettura…', { model: planModel });
      const tPlan = Date.now();
      const plan = await runHeadless({
        prompt: buildPlanPrompt({ problema: run.problema || '', criteri: run.criteri, files, reportNotes }),
        model: planModel, runId, timeoutMs: 5 * 60_000,
      });
      if (isAborted(runId)) return;
      if (plan.ok && plan.text.trim()) {
        trace(runId, '🗺', 'piano', plan.text.split('\n')[0].slice(0, 120), { ms: Date.now() - tPlan, model: planModel });
        fixPrompt = `${prompt}\n\nImplementation plan (already reasoned by a senior architect — follow it, deviate only if the code contradicts it, and say so in the summary):\n${plan.text.trim()}`;
        // Col piano in mano l'esecuzione va al modello rapido.
        updateRun(runId, { fixModel: MODEL_SONNET, fixPrompt });
      } else {
        trace(runId, '🗺', 'piano', 'Planner non disponibile → fix diretto col modello forte');
      }
    }
    const effModel = getRun(runId)?.fixModel ?? fixModel;
    trace(runId, '🔧', 'fixer', `branch ${curBranch} · ${files.length} file`, { model: effModel });
    const tFix = Date.now();
    res = await runHeadless({ prompt: fixPrompt, model: effModel, allowEdits: true, resumeSessionId, runId, timeoutMs: 15 * 60_000 });
    if (res.ok) trace(runId, '🔧', 'fixer', 'edit completati', { ms: Date.now() - tFix, model: effModel });
  }

  if (isAborted(runId)) return; // l'abort ha già gestito il cleanup

  // File toccati DALLA run: sporchi ora, non sporchi prima.
  const touchedByRun = git.changedFiles().filter((f) => !dirtyBefore.has(f));

  if (!res.ok) {
    if (touchedByRun.length) {
      git.restoreFiles(touchedByRun);
      log(runId, `Errore del Fixer: ripristinati ${touchedByRun.length} file parzialmente modificati.`);
    }
    updateRun(runId, { phase: 'error', error: res.error ?? 'Fixer fallito.', finishedAt: new Date().toISOString() });
    return;
  }

  updateRun(runId, { phase: 'verifying', sessionId: res.sessionId ?? run.sessionId, riassunto: res.text });

  // Diff-guard: le modifiche della run FUORI scope vengono revertite. Eccezione
  // per migliorie/feature: i file NUOVI (untracked) sono ammessi — un componente
  // o una route nuova non possono danneggiare codice esistente. Entrano in scope
  // così finiscono nel diff della review e nel commit all'accettazione.
  let outOfScope = touchedByRun.filter((f) => !files.includes(f));
  if (outOfScope.length && (run.tipoTask === 'miglioria' || run.tipoTask === 'feature')) {
    const untracked = new Set(git.untrackedFiles());
    const newAllowed = outOfScope.filter((f) => untracked.has(f));
    if (newAllowed.length) {
      files.push(...newAllowed);
      updateRun(runId, { scopedFiles: files });
      trace(runId, '🛡', 'guard', `${newAllowed.length} file NUOVI ammessi (${run.tipoTask}): ${newAllowed.join(', ')}`);
      outOfScope = outOfScope.filter((f) => !untracked.has(f));
    }
  }
  if (outOfScope.length) {
    git.restoreFiles(outOfScope);
    trace(runId, '🛡', 'guard', `revert di ${outOfScope.length} file fuori scope: ${outOfScope.join(', ')}`);
  }

  trace(runId, '🧪', 'gate', 'tsc + ESLint (relativo alla baseline)…');
  updateRun(runId, { live: '⏳ Gate: tsc + ESLint…' });
  const tGate = Date.now();
  let tsc = await gate();
  trace(runId, tsc.ok ? '✅' : '❌', 'gate', tsc.ok ? 'nessun nuovo errore tsc/lint' : `${tsc.newErrors?.length ?? '?'} nuovi errori`, { ms: Date.now() - tGate });

  const currentChanged = () => git.changedFiles().filter((f) => files.includes(f) && !dirtyBefore.has(f));

  // GIUDICE (LLM-as-judge) + repair mirato (max 2): valuta i criteri sul diff,
  // con un modello mini e separato dal Fixer (niente agreement bias). Se c'è un
  // test di riproduzione confermato, l'EVIDENZA passa prima dell'opinione: test
  // rosso → repair diretto senza nemmeno interpellare il Giudice.
  let verdict: RunVerdict | undefined;
  const criteri = run.criteri ?? [];
  if (tsc.ok && (criteri.length || reproPath) && !cm) {
    let repairs = 0;
    for (;;) {
      if (isAborted(runId)) return;

      // REPRO-GATE (fail-to-pass): il test che riproduceva il bug deve passare ORA.
      let gapEmpirico: string | undefined;
      if (reproPath) {
        trace(runId, '🧫', 'repro-gate', `npx vitest run ${reproPath}`);
        const rp = await runCheckCommand(`npx vitest run ${reproPath}`);
        updateRun(runId, { reproTest: { path: reproPath, status: rp } });
        trace(runId, rp === 'pass' ? '✅' : '❌', 'repro-gate', rp === 'pass' ? 'il test di riproduzione PASSA: bug risolto empiricamente' : 'il test di riproduzione fallisce ancora');
        if (rp === 'fail') gapEmpirico = `The reproduction test ${reproPath} STILL FAILS: the bug is NOT fixed. Run \`npx vitest run ${reproPath}\`, read the failure output, and fix the CODE (never the test).`;
      }

      if (!gapEmpirico) {
        if (!criteri.length) break; // niente criteri e repro verde → review
        trace(runId, '⚖️', 'giudice', 'verifica dei criteri di accettazione sul diff…');
        updateRun(runId, { live: '⚖️ Giudice: verifica dei criteri…' });
        verdict = await judgeVerdict(provider, keys, runId, { problema: run.problema || '', criteri, diff: git.diffFiles(currentChanged()) });
        if (!verdict) { trace(runId, '⚖️', 'giudice', 'non disponibile (output non valido) → review umana'); break; }
        if (verdict.soddisfatto) { trace(runId, '✅', 'giudice', `criteri soddisfatti (${verdict.criteri.length}/${verdict.criteri.length})`); break; }
      }
      if (repairs >= 2) { trace(runId, '❌', 'giudice', `${gapEmpirico ? 'repro-test' : 'criteri'} NON soddisfatt${gapEmpirico ? 'o' : 'i'} dopo 2 repair → revisione umana`); break; }

      repairs++;
      updateRun(runId, { phase: 'fixing', attempts: (getRun(runId)?.attempts ?? 1) + 1 });
      const gap = gapEmpirico || verdict?.gap || verdict?.criteri.filter((c) => !c.ok).map((c) => c.criterio).join('; ') || '';
      const gapProblem = `The previous fix is INSUFFICIENT. Close ONLY this gap (the other changes are already applied):\n${gap}`;

      let rep: { ok: boolean; text: string; error?: string; sessionId?: string };
      if (provider === 'gemini' && keys.gemini) {
        trace(runId, '♻️', 'repair', `repair mirato #${repairs}`, { model: 'gemini' });
        rep = await geminiFix(keys.gemini, { problema: gapProblem, criteri: verdict?.criteri.filter((c) => !c.ok).map((c) => c.criterio) ?? [], files, reportNotes, runId, gate });
      } else if (provider === 'deepseek' && keys.deepseek) {
        trace(runId, '♻️', 'repair', `repair mirato #${repairs}`, { model: 'deepseek' });
        rep = await deepseekFix(keys.deepseek, { problema: gapProblem, criteri: verdict?.criteri.filter((c) => !c.ok).map((c) => c.criterio) ?? [], files, reportNotes, runId, gate });
      } else {
        // ESCALATION LADDER: se il fix era del modello rapido, il repair passa a
        // Opus (mai ripetere due volte lo stesso modello sullo stesso gap).
        const escalModel = chooseModel({ phase: 'escalation' });
        const wasFast = (getRun(runId)?.fixModel ?? escalModel) !== escalModel;
        if (wasFast) {
          updateRun(runId, { escalated: true, fixModel: escalModel });
          trace(runId, '⬆️', 'escalation', `fix del modello rapido insufficiente → repair con ${escalModel}`);
        } else {
          trace(runId, '♻️', 'repair', `repair mirato #${repairs}`, { model: escalModel });
        }
        rep = await runHeadless({ prompt: buildResumePrompt(gap), model: escalModel, allowEdits: true, resumeSessionId: getRun(runId)?.sessionId, runId, timeoutMs: 15 * 60_000 });
      }
      if (isAborted(runId)) return;
      if (!rep.ok) { trace(runId, '❌', 'repair', `repair fallito: ${rep.error ?? ''} → review umana col verdetto negativo`); break; }
      res = { ...res, text: `${res.text}\n\n[Repair #${repairs}] ${rep.text}` };
      updateRun(runId, { phase: 'verifying', riassunto: res.text, sessionId: rep.sessionId ?? getRun(runId)?.sessionId });
      tsc = await gate();
      if (!tsc.ok) { trace(runId, '❌', 'gate', 'il repair ha introdotto errori tsc → review umana'); break; }
    }
  }

  // GATE COMPORTAMENTALE (auto): se il repo ha uno script `test`, eseguilo dopo
  // il verde statico. Non ripara e non blocca (la review umana decide), ma un
  // fail è visibile in timeline e nel run. Le run autonome hanno il loro Gate+
  // opt-in in finalizeAutonomous → qui si salta per non pagarlo due volte.
  if (tsc.ok && !cm && !run.autonomous && process.env.BUGBAY_TEST_GATE !== '0') {
    let hasTestScript = false;
    try { hasTestScript = Boolean(JSON.parse(fs.readFileSync(path.join(targetRoot(), 'package.json'), 'utf-8')).scripts?.test); } catch { /* niente package.json → skip */ }
    if (hasTestScript) {
      trace(runId, '🧪', 'test', 'gate comportamentale: npm test…');
      updateRun(runId, { live: '🧪 Gate comportamentale: npm test…' });
      const tTest = Date.now();
      const testGate = await runScriptGate('test');
      updateRun(runId, { testGate: testGate === 'pass' ? 'pass' : testGate === 'fail' ? 'fail' : 'skipped' });
      trace(runId, testGate === 'fail' ? '❌' : '✅', 'test', `npm test: ${testGate}`, { ms: Date.now() - tTest });
    } else {
      updateRun(runId, { testGate: 'skipped' });
    }
  }

  const changed = currentChanged();
  const modifiche: FileChange[] = changed.map((p) => ({ path: p, area: fileToArea(p) }));
  const diff = git.diffFiles(changed);

  trace(runId, tsc.ok ? '✅' : '❌', 'review', tsc.ok ? 'pronto per la review umana' : `${tsc.newErrors?.length ?? '?'} nuovi problemi tsc/lint — review col gate rosso`);
  updateRun(runId, {
    phase: 'review', riassunto: res.text, modifiche, diff, verdict,
    tscOk: tsc.ok,
    tscOutput: tsc.ok ? '' : (tsc.newErrors?.length ? tsc.newErrors.join('\n').slice(0, 3000) : tsc.output.slice(-3000)),
    live: undefined,
    finishedAt: new Date().toISOString(),
  });
}

type JudgeKeys = { gemini?: string; deepseek?: string; anthropic?: string };

/**
 * Canale grezzo del Giudice (task di SOLO testo): fast-path REST quando c'è una
 * chiave (Anthropic Haiku / Gemini Flash, ~1-3s, niente boot CLI), fallback alla
 * CLI claude in text-mode. Ritorna il testo grezzo o null. Condiviso da giudice
 * singolo e panel multi-lente.
 */
async function askJudge(provider: string, keys: JudgeKeys, runId: string, prompt: string, sys: string): Promise<string | null> {
  if (provider === 'gemini' && keys.gemini) return callGemini(keys.gemini, prompt, sys, true, runId);
  if (provider === 'deepseek' && keys.deepseek) return callDeepseek(keys.deepseek, prompt, sys, true, runId);
  if (keys.anthropic) return callAnthropic(keys.anthropic, prompt, sys, runId);
  if (keys.gemini) return callGemini(keys.gemini, prompt, sys, true, runId);
  const r = await runHeadless({ prompt, model: chooseModel({ phase: 'giudice' }), runId, timeoutMs: 120_000, textMode: { systemPrompt: sys } });
  return r.ok ? r.text : null;
}

const JUDGE_SYS = 'You are a strict, independent code review judge. You did NOT write this change. Return ONLY a valid JSON object following the requested schema. When in doubt, mark soddisfatto=false.';

/** Interroga il Giudice (modello mini) e normalizza il verdetto. */
async function judgeVerdict(
  provider: string,
  keys: JudgeKeys,
  runId: string,
  opts: { problema: string; criteri: string[]; diff: string },
): Promise<RunVerdict | undefined> {
  try {
    const raw = await askJudge(provider, keys, runId, buildJudgePrompt(opts), JUDGE_SYS);
    const parsed = raw ? extractJson(raw) : null;
    if (!parsed) return undefined;
    return {
      soddisfatto: (parsed as any).soddisfatto !== false,
      gap: typeof (parsed as any).gap === 'string' && (parsed as any).gap ? (parsed as any).gap : undefined,
      criteri: Array.isArray((parsed as any).criteri)
        ? ((parsed as any).criteri as any[]).map((c) => ({ criterio: String(c?.criterio ?? ''), ok: c?.ok !== false }))
        : [],
    };
  } catch {
    return undefined;
  }
}

/* ── Panel multi-lente + confidence gate (F3, per il commit AUTONOMO) ───────
 * Il giudice singolo di doFix pilota il repair; per DECIDERE se fidarsi di un fix
 * committato in autonomia serve di più: N giudici INDIPENDENTI (chiamate separate,
 * niente agreement-bias intra-contesto), ciascuno con una lente diversa. La
 * confidence è 'alta' SOLO se ci sono criteri E ogni lente è disponibile E tutte
 * soddisfatte; altrimenti 'bassa' → il chiamante mette in PARK "da controllare".
 * Fail-safe: un giudice non disponibile (nessuna chiave, output non valido) NON
 * può dare confidence → conta come non-soddisfatto e forza 'bassa'.
 */
const JUDGE_LENSES: { key: string; focus: string }[] = [
  { key: 'criteri', focus: 'LENS = ACCEPTANCE CRITERIA. Judge ONLY whether the diff literally satisfies each acceptance criterion. If the diff does not touch a criterion\'s area, that criterion is NOT satisfied.' },
  { key: 'regressioni', focus: 'LENS = REGRESSIONS. Judge whether the diff could BREAK existing behavior or add a side effect beyond the stated goal. Any plausible regression → soddisfatto=false.' },
  { key: 'correttezza', focus: 'LENS = CORRECTNESS. Judge whether the implementation is actually CORRECT, not merely plausible: wrong condition, off-by-one, missing case, wrong API usage → soddisfatto=false. Default to false if not confident it is correct.' },
];

export interface PanelVerdict {
  confidence: 'alta' | 'bassa';
  lenses: { lens: string; ok: boolean; available: boolean; gap?: string }[];
  /** Sintesi in italiano per la nota di review / notifica. */
  motivo: string;
}

/**
 * Canali giudice DISPONIBILI in ordine di preferenza: per il panel ogni lente
 * usa un canale DIVERSO (rotazione) — modelli diversi decorrelano gli errori
 * di giudizio, che è il punto di avere N giudici.
 */
function judgeChannels(keys: JudgeKeys): ((prompt: string, sys: string, runId: string) => Promise<string | null>)[] {
  const chans: ((prompt: string, sys: string, runId: string) => Promise<string | null>)[] = [];
  if (keys.anthropic) chans.push((p, s, r) => callAnthropic(keys.anthropic!, p, s, r));
  if (keys.gemini) chans.push((p, s, r) => callGemini(keys.gemini!, p, s, true, r));
  if (keys.deepseek) chans.push((p, s, r) => callDeepseek(keys.deepseek!, p, s, true, r));
  chans.push(async (p, s, r) => {
    const res = await runHeadless({ prompt: p, model: chooseModel({ phase: 'giudice' }), runId: r, timeoutMs: 120_000, textMode: { systemPrompt: s } });
    return res.ok ? res.text : null;
  });
  return chans;
}

/**
 * REPRO-CHECK: la lente correttezza può proporre UN comando di verifica
 * empirica. Eseguito SOLO se combacia con la whitelist (tsc/vitest, charset
 * ristretto: niente ; | & $ ` — un giudice non può iniettare comandi).
 */
const CHECK_COMMAND_RE = /^npx (tsc --noEmit|vitest run [A-Za-z0-9_@ ./\\-]+)$/;

/** Il target ha vitest? Precondizione del BRT (il riproduttore gira con vitest). */
function hasVitest(): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(targetRoot(), 'package.json'), 'utf-8'));
    return Boolean(pkg.devDependencies?.vitest || pkg.dependencies?.vitest);
  } catch { return false; }
}

function runCheckCommand(cmd: string): Promise<'pass' | 'fail'> {
  const [bin, ...args] = cmd.split(/\s+/);
  return new Promise((resolve) => {
    // shell:true per gli shim .cmd di Windows; l'input è whitelistato sopra.
    const child = spawn(bin, args, { cwd: targetRoot(), shell: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve('fail'); }, 180_000);
    child.on('error', () => { clearTimeout(timer); resolve('fail'); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 ? 'pass' : 'fail'); });
  });
}

export async function judgePanel(
  runId: string,
  provider: string,
  keys: JudgeKeys,
  opts: { problema: string; criteri: string[]; diff: string },
): Promise<PanelVerdict> {
  // Provider esplicito non-claude → si rispetta (canale unico); altrimenti
  // rotazione sui canali disponibili: lente i → canale i-esimo.
  const chans = judgeChannels(keys);
  const askVia = (i: number, prompt: string): Promise<string | null> => {
    if (provider === 'gemini' || provider === 'deepseek') return askJudge(provider, keys, runId, prompt, JUDGE_SYS);
    return chans[i % chans.length](prompt, JUDGE_SYS, runId);
  };

  const lenses = await Promise.all(JUDGE_LENSES.map(async (lens, i) => {
    let parsed: any = null;
    try {
      const extra = lens.key === 'correttezza'
        ? '\nIn the JSON you may ALSO include "checkCommand": ONE empirical verification command, ONLY of the form "npx tsc --noEmit" or "npx vitest run <path>" (nothing else, no flags beyond these). Omit it if no meaningful check exists.'
        : '';
      const raw = await askVia(i, `${lens.focus}${extra}\n\n${buildJudgePrompt(opts)}`);
      parsed = raw ? extractJson(raw) : null;
    } catch { parsed = null; }
    if (!parsed) return { lens: lens.key, ok: false, available: false };
    let ok = parsed.soddisfatto !== false;
    let gap = typeof parsed.gap === 'string' && parsed.gap ? parsed.gap : undefined;
    // Repro-check empirico (whitelist rigida): un comando verde conferma, uno
    // rosso ribalta il giudizio della lente — l'evidenza batte l'opinione.
    const cmd = typeof parsed.checkCommand === 'string' ? parsed.checkCommand.trim() : '';
    if (lens.key === 'correttezza' && ok && cmd && CHECK_COMMAND_RE.test(cmd)) {
      trace(runId, '🧪', 'repro-check', cmd);
      const outcome = await runCheckCommand(cmd);
      trace(runId, outcome === 'pass' ? '✅' : '❌', 'repro-check', `${cmd}: ${outcome}`);
      if (outcome === 'fail') { ok = false; gap = `Verifica empirica fallita: ${cmd}`; }
    }
    return { lens: lens.key, ok, available: true, gap };
  }));

  const hasCriteri = opts.criteri.length > 0;
  const allAvailable = lenses.every((l) => l.available);
  const allOk = lenses.every((l) => l.ok);
  const confidence: 'alta' | 'bassa' = hasCriteri && allAvailable && allOk ? 'alta' : 'bassa';

  const failing = lenses.filter((l) => l.available && !l.ok);
  const unavailable = lenses.filter((l) => !l.available).map((l) => l.lens);
  const motivo = confidence === 'alta'
    ? 'Panel: tutte le lenti soddisfatte (criteri, regressioni, correttezza).'
    : [
        !hasCriteri ? 'Nessun criterio verificabile automaticamente.' : '',
        failing.length ? `Lenti non soddisfatte: ${failing.map((f) => `${f.lens}${f.gap ? ` (${f.gap})` : ''}`).join('; ')}.` : '',
        unavailable.length ? `Giudice non disponibile per: ${unavailable.join(', ')}.` : '',
      ].filter(Boolean).join(' ');

  return { confidence, lenses, motivo };
}
