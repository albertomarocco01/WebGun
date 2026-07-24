/**
 * @descrizione
 * META-TEST del GATE DI EVAL (Track G) — la garanzia, richiesta dall'invariante
 * shadow-first, che un gate SEMPRE-VERDE sia impossibile. Guida il CUORE
 * deterministico e DB-free di `eval.ts` (conteggio-flip appaiato + esecuzione reale
 * delle smoke-case via `node`) con la COPPIA DI CONTROLLO SEMINATA presente in
 * `eval-fixtures/control/`:
 *   • subject.bad.mjs  (off-by-one su `classify`) → la case `control-invariant`
 *     FLIPPA pass→fail  ⇒ il gate DEVE diventare ROSSO.
 *   • subject.good.mjs (cambio additivo innocuo) → nessun flip ⇒ il gate DEVE
 *     restare VERDE.
 * Se un giorno il gate diventasse insensibile (sempre verde), il caso BAD qui sotto
 * fallirebbe: è la meta-guardia.
 *
 * NOTA (come routing/ledger/consolidation/retrieval test): le API DB-backed di
 * eval.ts (`runEvalGate`/`raiseEvalAlert`/`listEvalFindings`, node:sqlite + git)
 * sono fuori dal runner nativo; il loro cablaggio tipato è garantito da
 * `tsc --noEmit`. Qui si esercita SOLO il cuore puro/spawn esportato — che è
 * ESATTAMENTE il codice che decide il colore del gate. `.mjs`: type-stripping
 * nativo del `.ts` importato, fuori dal glob TS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyGate,
  evaluateSubjectPair,
  listCaseFiles,
} from '../src/modules/bugbay/agent-fix/eval.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, '..', 'src', 'modules', 'bugbay', 'agent-fix', 'eval-fixtures');
const BASELINE = path.join(FIXTURES, 'subject.mjs');
const BAD = path.join(FIXTURES, 'control', 'subject.bad.mjs');
const GOOD = path.join(FIXTURES, 'control', 'subject.good.mjs');
const CONTROL_CASE = 'control-invariant.mjs';

// ── 0. Le fixtures esistono e il set curato è ≤10 (invariante del gate) ───────

test('fixtures: set curato non vuoto e ≤10 smoke-case', () => {
  const cases = listCaseFiles(FIXTURES);
  assert.ok(cases.length > 0, 'devono esistere smoke-case curate');
  assert.ok(cases.length <= 10, 'il set L2 curato è capato a ≤10 case');
  assert.ok(cases.includes(CONTROL_CASE), 'la case di controllo che flippa deve esserci');
});

// ── 1. META-GUARDIA ROSSA: il diff BAD seminato DEVE arrossare il gate ────────

test('META: il diff BAD (regressione seminata) rende il gate ROSSO', () => {
  const verdict = evaluateSubjectPair({
    fixturesDir: FIXTURES,
    baselineSubject: BASELINE,
    candidateSubject: BAD,
  });
  assert.equal(verdict.color, 'red', 'una regressione reale DEVE dare ROSSO');
  assert.ok(
    verdict.regressions.includes(CONTROL_CASE),
    'la case di confine deve comparire tra le regressioni (flip pass→fail)',
  );
  assert.equal(verdict.fixes.length, 0, 'il diff BAD non introduce fix');
});

// ── 2. META-GUARDIA VERDE: il diff GOOD seminato DEVE restare verde ───────────

test('META: il diff GOOD (cambio benigno) lascia il gate VERDE', () => {
  const verdict = evaluateSubjectPair({
    fixturesDir: FIXTURES,
    baselineSubject: BASELINE,
    candidateSubject: GOOD,
  });
  assert.equal(verdict.color, 'green', 'un cambio benigno NON deve arrossare (niente falsi allarmi)');
  assert.equal(verdict.regressions.length, 0, 'nessuna regressione attesa sul diff GOOD');
});

// ── 3. Baseline↔baseline: identità ⇒ verde, zero flip (sanità del set) ────────

test('baseline contro se stessa: verde, nessun flip, tutte stabili', () => {
  const verdict = evaluateSubjectPair({
    fixturesDir: FIXTURES,
    baselineSubject: BASELINE,
    candidateSubject: BASELINE,
  });
  assert.equal(verdict.color, 'green');
  assert.equal(verdict.regressions.length, 0);
  assert.equal(verdict.fixes.length, 0);
  assert.equal(verdict.stable, verdict.total, 'ogni case è stabile su un candidato identico');
});

// ── 4. classifyGate puro: la logica di flip appaiata è corretta ───────────────

test('classifyGate: solo pass→fail arrossa; fail→pass è un fix; il resto è stabile', () => {
  const baseline = [
    { name: 'a.mjs', passed: true, code: 0, signal: null },
    { name: 'b.mjs', passed: false, code: 1, signal: null },
    { name: 'c.mjs', passed: true, code: 0, signal: null },
    { name: 'd.mjs', passed: false, code: 1, signal: null },
  ];
  const candidate = [
    { name: 'a.mjs', passed: false, code: 1, signal: null }, // regressione
    { name: 'b.mjs', passed: true, code: 0, signal: null }, // fix
    { name: 'c.mjs', passed: true, code: 0, signal: null }, // stabile pass
    { name: 'd.mjs', passed: false, code: 1, signal: null }, // stabile fail
  ];
  const v = classifyGate(baseline, candidate);
  assert.equal(v.color, 'red');
  assert.deepEqual(v.regressions, ['a.mjs']);
  assert.deepEqual(v.fixes, ['b.mjs']);
  assert.equal(v.stable, 2);
  assert.equal(v.total, 4);
});

test('classifyGate: solo fix (nessun pass→fail) resta VERDE', () => {
  const baseline = [{ name: 'x.mjs', passed: false, code: 1, signal: null }];
  const candidate = [{ name: 'x.mjs', passed: true, code: 0, signal: null }];
  const v = classifyGate(baseline, candidate);
  assert.equal(v.color, 'green');
  assert.deepEqual(v.fixes, ['x.mjs']);
  assert.equal(v.regressions.length, 0);
});

test('classifyGate: una case candidata senza gemello baseline non genera flip', () => {
  const baseline = [{ name: 'x.mjs', passed: true, code: 0, signal: null }];
  const candidate = [
    { name: 'x.mjs', passed: true, code: 0, signal: null },
    { name: 'nuova.mjs', passed: false, code: 1, signal: null }, // non appaiabile
  ];
  const v = classifyGate(baseline, candidate);
  assert.equal(v.color, 'green', 'una case nuova non-appaiata non è una regressione');
  assert.equal(v.total, 2);
});
