/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * DISTILLER EPISODICO (v0.8, TRACK E) — trasforma OGNI verdetto in un "caso"
 * ExpeRepair (problema/contesto/repro/strategia/esito + verdetto + traiettoria) e
 * lo scrive nello store episodico (`./episodic`). È un distiller registrato sul
 * hook `onVerdict` via il barile `./distill-register` (import a solo effetto): lo
 * steward NON tocca il call-site (hub.addScore) né distill.ts.
 *
 * INVARIANTI (load-bearing, dal design memo):
 *  - GUARDIA CONTAMINAZIONE: il campo indicizzato `reformulated` DEVE essere
 *    INGLESE. `run.problema`/`riassunto` sono ITALIANI (mostrati al revisore) →
 *    vanno RI-FORMULATI in inglese PRIMA di scriverli nel campo cercabile. Se la
 *    ri-formulazione non produce testo inglese usabile, si ripiega sulle stringhe
 *    d'errore (già inglesi, dal compilatore) e, in ultima istanza, NON si scrive
 *    il caso — mai indicizzare italiano grezzo.
 *  - FIRE-AND-FORGET: `onVerdict` dispaccia in `setImmediate` e inghiotte ogni
 *    errore; qui si aggiunge comunque un try/catch difensivo. La distillazione non
 *    deve MAI rompere la scrittura del verdetto sulla spina.
 *  - ADDITIVO: legge le righe già congelate (via `getRunRow`) e scrive SOLO nelle
 *    tabelle episodiche (`writeEpisodicCase`). Nessuna delle 10 tabelle cambia.
 *  - Ri-formulazione: stessa scala di fallback del giudice (`askJudge`): Anthropic
 *    Haiku REST → Gemini/DeepSeek Flash → CLI claude headless in text-mode.
 *
 * @indice
 * - episodicDistiller     → Distiller registrato: costruisce e scrive il caso
 * - reformulateToEnglish  → ri-formula il problema (IT→EN) per il campo cercabile
 * - extractErrorStrings   → estrae segnature d'errore INGLESI (tsc/repro) da indicizzare
 */

import type { AgentRun } from './types';
import { getRunRow } from './hub';
import { writeEpisodicCase } from './episodic';
import { registerDistiller, type VerdictContext } from './distill';
import { resolveKeys } from './run-context';
import { callAnthropic } from './anthropic';
import { callGemini } from './gemini';
import { callDeepseek } from './deepseek';
import { runHeadless } from './claude';
import { chooseModel } from './routing';

/** Tronca `s` a `n` caratteri (con ellissi) per tenere i campi del caso compatti. */
function cap(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Primo argomento non vuoto (dopo trim), o undefined. */
function firstNonEmpty(...vals: (string | null | undefined)[]): string | undefined {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return undefined;
}

// System prompt della ri-formulazione: produce SOLO inglese tecnico (statement +
// keyword) adatto a un indice BM25. Modellato su REFORMULATE_SYSTEM/JUDGE_SYS.
const REFORM_SYS =
  'You distill software bug-fix cases into concise technical English for a BM25 search index. ' +
  'Translate any non-English input (e.g. Italian) to English. Output ONLY plain English: a 1-3 ' +
  'sentence problem statement followed by key technical keywords (symbols, APIs, routes, error ' +
  'types). No markdown, no preamble, no translation notes. Keep code identifiers, route paths and ' +
  'quoted UI strings verbatim.';

/**
 * Ri-formula il problema (potenzialmente ITALIANO) in inglese tecnico per il campo
 * cercabile `reformulated`. Stessa scala di fallback del giudice: fast-path REST
 * quando c'è una chiave (Anthropic Haiku / Gemini / DeepSeek), altrimenti CLI
 * claude headless in text-mode. Best-effort: ritorna null su errore/vuoto (il
 * chiamante ripiega sulle stringhe d'errore o salta il caso). MAI throw.
 */
async function reformulateToEnglish(
  problem: string,
  run: AgentRun,
  errorStrings: string,
  runId: string,
): Promise<string | null> {
  const criteri = (run.criteri ?? []).slice(0, 8);
  const summary = firstNonEmpty(run.riassunto);
  const prompt =
    `Distill the following bug-fix case into a concise English problem statement + keywords for search.\n\n` +
    `Title: ${cap(run.reportTitolo ?? '', 200)}\n` +
    `Problem (may be Italian):\n${cap(problem, 1200)}\n` +
    (criteri.length
      ? `\nAcceptance criteria:\n${criteri.map((c, i) => `${i + 1}. ${cap(c, 200)}`).join('\n')}\n`
      : '') +
    (summary ? `\nWhat the fix did (may be Italian):\n${cap(summary, 800)}\n` : '') +
    (errorStrings ? `\nObserved errors:\n${cap(errorStrings, 800)}\n` : '') +
    `\nReturn only the English distillation.`;

  try {
    const keys = resolveKeys();
    let text: string | null = null;
    if (keys.anthropic) {
      text = await callAnthropic(keys.anthropic, prompt, REFORM_SYS, runId);
    } else if (keys.provider === 'gemini' && keys.gemini) {
      text = await callGemini(keys.gemini, prompt, REFORM_SYS, false, runId);
    } else if (keys.provider === 'deepseek' && keys.deepseek) {
      text = await callDeepseek(keys.deepseek, prompt, REFORM_SYS, false, runId);
    } else if (keys.gemini) {
      text = await callGemini(keys.gemini, prompt, REFORM_SYS, false, runId);
    } else if (keys.deepseek) {
      text = await callDeepseek(keys.deepseek, prompt, REFORM_SYS, false, runId);
    } else {
      const r = await runHeadless({
        prompt,
        model: chooseModel({ phase: 'giudice' }),
        runId,
        timeoutMs: 120_000,
        textMode: { systemPrompt: REFORM_SYS },
      });
      text = r.ok ? r.text : null;
    }
    return text && text.trim() ? cap(text, 4000) : null;
  } catch {
    return null;
  }
}

// Righe che sembrano errori del compilatore/test: INGLESI e sicure da indicizzare
// (guardia contaminazione). Evita di riversare `run.error` grezzo, che a volte è
// un messaggio applicativo ITALIANO.
const ERROR_LINE_RE =
  /error TS\d+|error:|\bError:|Cannot find|is not assignable|does not exist|is not defined|Unexpected|SyntaxError|TypeError|ReferenceError|\bFAIL\b|Expected .+ (?:to|received)/i;

/**
 * Estrae segnature d'errore INGLESI dagli artefatti della run (`tscOutput` + esito
 * del repro-test). Solo testo affidabilmente inglese finisce nell'indice FTS.
 */
function extractErrorStrings(run: AgentRun): string {
  const parts: string[] = [];
  const tsc = run.tscOutput ?? '';
  for (const line of tsc.split(/\r?\n/)) {
    const l = line.trim();
    if (l && ERROR_LINE_RE.test(l)) parts.push(l);
    if (parts.length >= 20) break;
  }
  if (run.reproTest && run.reproTest.status === 'fail') {
    parts.push(`repro-test failing: ${run.reproTest.path}`);
  }
  return cap(parts.join('\n'), 2000);
}

/** Contesto del caso (progetto/area/tipo/file): NON indicizzato, solo per lettura. */
function buildContext(run: AgentRun, projectId: string | null): string {
  const files = (run.modifiche ?? []).map((m) => m.path).slice(0, 20);
  return [
    `project: ${projectId ?? '-'}`,
    `title: ${cap(run.reportTitolo ?? '-', 200)}`,
    run.tipoTask ? `task: ${run.tipoTask}` : '',
    run.categoriaTecnica ? `tech: ${run.categoriaTecnica}` : '',
    run.complessita ? `complexity: ${run.complessita}` : '',
    files.length ? `files: ${files.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

/** Riproduzione: esito del repro-test (BRT) + criteri di accettazione, se presenti. */
function buildRepro(run: AgentRun): string | null {
  const bits: string[] = [];
  if (run.reproTest) bits.push(`repro-test: ${run.reproTest.status} (${run.reproTest.path})`);
  const criteri = (run.criteri ?? []).slice(0, 8);
  if (criteri.length) bits.push(`criteria:\n${criteri.map((c, i) => `${i + 1}. ${cap(c, 200)}`).join('\n')}`);
  return bits.length ? bits.join('\n') : null;
}

/** Strategia del fix: riassunto del Fixer + modello/tentativi/escalation. */
function buildFixStrategy(run: AgentRun): string | null {
  const bits: string[] = [];
  const summary = firstNonEmpty(run.riassunto);
  if (summary) bits.push(cap(summary, 1500));
  const meta = [
    run.fixModel ? `model: ${run.fixModel}` : '',
    run.attempts != null ? `attempts: ${run.attempts}` : '',
    run.escalated ? 'escalated' : '',
    run.codemod ? 'codemod (0-token)' : '',
    run.autonomous ? 'autonomous' : '',
  ].filter(Boolean);
  if (meta.length) bits.push(meta.join(' · '));
  return bits.length ? bits.join('\n') : null;
}

/** Esito osservato: gate tsc/test/repro + verdetto e la sua fonte. */
function buildOutcome(run: AgentRun, verdict: VerdictContext): string {
  return [
    run.tscOk != null ? `tsc: ${run.tscOk ? 'ok' : 'fail'}` : '',
    run.testGate ? `test-gate: ${run.testGate}` : '',
    run.reproTest ? `repro: ${run.reproTest.status}` : '',
    run.verdict ? `judge: ${run.verdict.soddisfatto ? 'satisfied' : 'not-satisfied'}` : '',
    `verdict: ${verdict.verdict} (${verdict.source})`,
  ]
    .filter(Boolean)
    .join(' | ');
}

/** Traiettoria compatta (passi simbolici + metadati), serializzata a JSON dallo store. */
function buildTrajectory(run: AgentRun): unknown {
  return {
    attempts: run.attempts ?? null,
    escalated: run.escalated ?? false,
    fixModel: run.fixModel ?? null,
    tscOk: run.tscOk ?? null,
    testGate: run.testGate ?? null,
    reproTest: run.reproTest ?? null,
    autonomous: run.autonomous ?? false,
    judge: run.verdict ? { soddisfatto: run.verdict.soddisfatto, gap: run.verdict.gap ?? null } : null,
    steps: (run.timeline ?? []).slice(-40).map((e) => ({
      sym: e.sym,
      stage: e.stage,
      msg: cap(e.msg, 160),
      ...(e.model ? { model: e.model } : {}),
    })),
  };
}

/**
 * Distiller episodico. Su OGNI verdetto: idrata la run dalla spina, la distilla in
 * un caso ExpeRepair e lo scrive nello store episodico. FILTRA: solo run che hanno
 * prodotto un artefatto di fix (diff/riassunto/file modificati) — un verdetto su
 * una run senza fix (es. chiarimento) non ha nulla da imparare. GUARDIA
 * CONTAMINAZIONE: scrive `reformulated` solo se inglese (ri-formulato o segnature
 * d'errore); altrimenti salta il caso. Best-effort: NON lancia mai.
 */
async function episodicDistiller(runId: string, verdict: VerdictContext): Promise<void> {
  const row = getRunRow(runId);
  if (!row) return;

  let run: AgentRun;
  try {
    run = JSON.parse(row.data) as AgentRun;
  } catch {
    return;
  }

  // Filtro: serve un artefatto di fix da cui imparare.
  const hasFixArtifact = !!(
    (run.diff && run.diff.trim()) ||
    firstNonEmpty(run.riassunto) ||
    (run.modifiche && run.modifiche.length)
  );
  if (!hasFixArtifact) return;

  const problem = firstNonEmpty(run.problema, run.reportTitolo);
  if (!problem) return;

  const projectId = run.projectId ?? row.project_id ?? null;
  const errorStrings = extractErrorStrings(run);

  // Guardia contaminazione: campo cercabile in INGLESE. Ri-formula il problema
  // (IT→EN); se non disponibile, ripiega sulle stringhe d'errore (già inglesi).
  const english = await reformulateToEnglish(problem, run, errorStrings, runId);
  const reformulated = firstNonEmpty(english ?? undefined, errorStrings || undefined);
  if (!reformulated) return; // niente inglese usabile → non indicizzare italiano grezzo

  writeEpisodicCase({
    // Id deterministico per-run: un run che riceve più score (JUDGE poi HUMAN…) NON
    // deve generare casi duplicati — writeEpisodicCase è idempotente latest-wins su id.
    id: `ep-${runId}`,
    runId,
    reportId: verdict.reportId ?? run.reportId ?? null,
    projectId,
    problem: cap(problem, 4000),
    context: buildContext(run, projectId),
    repro: buildRepro(run),
    fixStrategy: buildFixStrategy(run),
    outcome: buildOutcome(run, verdict),
    verdict: verdict.verdict,
    verdictSource: verdict.source,
    trajectory: buildTrajectory(run),
    reformulated,
    errorStrings: errorStrings || null,
  });
}

// Registrazione idempotente (Map su global, chiave-nome): hot-reload safe. Il
// barile `./distill-register` importa questo modulo a solo effetto.
registerDistiller('episodic', episodicDistiller);
