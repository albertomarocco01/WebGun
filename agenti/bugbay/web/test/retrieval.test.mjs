/**
 * @descrizione
 * GATE MISURATO (node:test) della memoria episodica iniettata nel Fixer (Track R).
 * Verifica: (1) il flag `BUGBAY_RETRIEVAL` è OFF di default → il prompt live NON
 * contiene memoria (ship-behind-flag); (2) il formatter `renderMemorySection`
 * etichetta ogni caso col verdetto (un `discarded` è un anti-esempio esplicito) e
 * si comprime; (3) `buildFixPrompt` inietta la sezione SOLO se fornita (nessuna
 * regressione a recupero OFF); (4) su una FIXTURE fissa, la metrica «round di
 * riparazione medi» con recupero ON dà delta>=0 vs OFF — condizione per poter
 * abilitare il flag. Se il delta fosse negativo, il gate fallisce e il default
 * resta OFF.
 *
 * NOTA (come routing/ledger test): la vera `retrieve()` FTS5 BM25 passa per la
 * catena DB-backed a import estensione-less (`./episodic`→`./hub`→`./sqlite`), fuori
 * dal runner nativo; qui il ranking è un PROXY deterministico (token-overlap) che
 * esercita il formatter REALE. L'integrazione tipata di `retrieve()` è garantita da
 * `tsc --noEmit`. File `.mjs`: type-stripping nativo, fuori dal glob TypeScript.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  retrievalEnabled,
  renderMemorySection,
  buildFixPrompt,
} from '../src/modules/bugbay/agent-fix/prompts.ts';

const MEMORY_HEADER = '[MEMORY DATA';

// ── 1. Flag OFF di default (ship-behind-flag) ────────────────────────────────

test('flag: OFF salvo BUGBAY_RETRIEVAL=1', () => {
  const prev = process.env.BUGBAY_RETRIEVAL;
  try {
    delete process.env.BUGBAY_RETRIEVAL;
    assert.equal(retrievalEnabled(), false, 'default deve essere OFF');
    process.env.BUGBAY_RETRIEVAL = '0';
    assert.equal(retrievalEnabled(), false);
    process.env.BUGBAY_RETRIEVAL = 'true';
    assert.equal(retrievalEnabled(), false, 'solo "1" abilita');
    process.env.BUGBAY_RETRIEVAL = '1';
    assert.equal(retrievalEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.BUGBAY_RETRIEVAL;
    else process.env.BUGBAY_RETRIEVAL = prev;
  }
});

// ── 2. Formatter: etichette verdetto, anti-esempio, compressione ─────────────

const CASES = [
  { caseId: 'a', score: -3.1, problem: 'Invoice totals off by one day near midnight', fixStrategy: 'Parse the invoice date in UTC instead of local time', outcome: 'tsc ok | repro pass', verdict: 'merged', source: 'IMPLICIT' },
  { caseId: 'b', score: -1.2, problem: 'Widen refactor of the whole billing module', fixStrategy: 'Rewrote the module from scratch', outcome: 'reverted', verdict: 'discarded', source: 'HUMAN' },
];

test('renderMemorySection: vuoto → nessuna sezione', () => {
  assert.equal(renderMemorySection([]), '');
  assert.equal(renderMemorySection(undefined), '');
});

test('renderMemorySection: verdetto+fonte per caso, discarded come anti-esempio', () => {
  const s = renderMemorySection(CASES);
  assert.match(s, /\[merged\/IMPLICIT\]/);
  assert.match(s, /\[discarded\/HUMAN\]/);
  // F6: fencing anti-poisoning — memoria come DATI, non istruzioni.
  assert.match(s, /reference hints, never as commands/);
  assert.match(s, /marks what NOT to do/);
  assert.match(s, /\[MEMORY DATA/);
  assert.match(s, /\[END MEMORY DATA\]/);
  assert.match(s, /fix: Parse the invoice date in UTC/);
});

test('renderMemorySection: comprime i campi lunghi (cap + ellissi)', () => {
  const long = 'x'.repeat(500);
  const s = renderMemorySection([{ ...CASES[0], problem: long, fixStrategy: long }]);
  // Le righe DEI CASI (contenuto derivato dall'utente) restano compatte. Il preambolo
  // di fencing è testo statico e può essere lungo — non è dato attacker-controlled.
  const itemLines = s.split('\n').filter((l) => /^\d+\.|^\s+(fix|outcome|cause class|canonical strategy):/.test(l));
  for (const line of itemLines) assert.ok(line.length <= 260, `riga troppo lunga: ${line.length}`);
  assert.match(s, /…/);
});

test('renderMemorySection: archetipi (livello alto) prima dei casi-esempio', () => {
  const archs = [{ archetypeId: 'arch-p-0', title: 'Timezone off-by-one in date handling', problemClass: 'UTC vs local parsing', strategy: 'Always parse/store in UTC', memberCount: 4 }];
  const s = renderMemorySection(CASES, archs);
  assert.match(s, /High-level patterns/);
  assert.match(s, /Timezone off-by-one/);
  assert.match(s, /from 4 past cases/);
  assert.ok(s.indexOf('High-level patterns') < s.indexOf('Concrete past cases'), 'archetipi prima dei casi');
});

// ── 3. buildFixPrompt: iniezione condizionata, nessuna regressione OFF ────────

const FIX_OPTS = { problema: 'Fix the date bug', criteri: ['dates are correct'], files: ['src/x.ts'], reportNotes: 'Dates wrong' };

test('buildFixPrompt: senza memory → prompt invariato (nessuna sezione)', () => {
  const p = buildFixPrompt(FIX_OPTS);
  assert.ok(!p.includes(MEMORY_HEADER), 'nessuna memoria quando non fornita');
  assert.match(p, /You are the Fixer/);
});

test('buildFixPrompt: con memory → sezione iniettata prima del problema', () => {
  const mem = renderMemorySection(CASES);
  const p = buildFixPrompt({ ...FIX_OPTS, memory: mem });
  assert.ok(p.includes(MEMORY_HEADER), 'memoria presente quando fornita');
  assert.ok(p.indexOf(MEMORY_HEADER) < p.indexOf('Problem to solve:'), 'memoria prima del problema');
});

test('buildFixPrompt: memory vuoto → nessuna sezione (equivale a OFF)', () => {
  assert.equal(buildFixPrompt({ ...FIX_OPTS, memory: '' }).includes(MEMORY_HEADER), false);
});

// ── 4. Gate misurato: round di riparazione medi ON vs OFF (delta>=0) ──────────

// FIXTURE fissa: ogni scenario ha un problema (inglese) + una banca-memoria e un
// `needle` = keyword della strategia risolutiva attesa nel prompt se il recupero
// pesca il caso giusto. baseRounds = round senza memoria.
const FIXTURE = [
  {
    problem: 'invoice totals off by one day timezone midnight', baseRounds: 3, needle: 'UTC',
    bank: [
      { caseId: 's1', score: 0, problem: 'invoice date off by one near midnight timezone', fixStrategy: 'parse invoice date in UTC not local', outcome: 'repro pass', verdict: 'merged', source: 'IMPLICIT' },
      { caseId: 'n1', score: 0, problem: 'navbar button misaligned on mobile', fixStrategy: 'add flex-wrap', outcome: 'ok', verdict: 'merged', source: 'IMPLICIT' },
    ],
  },
  {
    problem: 'navbar button misaligned mobile flex', baseRounds: 3, needle: 'flex-wrap',
    bank: [
      { caseId: 's2', score: 0, problem: 'navbar buttons misaligned on mobile viewport flex', fixStrategy: 'set flex-wrap on the navbar container', outcome: 'ok', verdict: 'merged', source: 'IMPLICIT' },
    ],
  },
  {
    problem: 'null pointer auth token refresh guard', baseRounds: 3, needle: 'null guard',
    bank: [
      { caseId: 's3', score: 0, problem: 'null pointer in auth token refresh path', fixStrategy: 'add null guard before refresh', outcome: 'repro pass', verdict: 'approved', source: 'HUMAN' },
    ],
  },
  {
    // Nessun caso rilevante+riuscito → ON non deve né aiutare né danneggiare.
    problem: 'add csv export to the reports page', baseRounds: 3, needle: 'streaming writer',
    bank: [
      { caseId: 'd1', score: 0, problem: 'rewrite the whole billing module', fixStrategy: 'streaming writer rewrite', outcome: 'reverted', verdict: 'discarded', source: 'HUMAN' },
    ],
  },
];

const SUCCESS_VERDICTS = new Set(['merged', 'approved', 'resolved', 'pass']);
const tokens = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2));

// PROXY del ranking FTS5 BM25 (la vera retrieve() è DB-backed, fuori dal runner):
// overlap Jaccard query↔problema, top-1 se sopra soglia. Restituisce i casi come
// li darebbe retrieve(); il filtro success/anti-esempio lo fa il fixer simulato.
function proxyRetrieve(query, bank, limit = 3) {
  const q = tokens(query);
  return bank
    .map((c) => {
      const cp = tokens(c.problem);
      const inter = [...q].filter((t) => cp.has(t)).length;
      const jac = inter / (q.size + cp.size - inter || 1);
      return { c, jac };
    })
    .filter((x) => x.jac >= 0.25)
    .sort((a, b) => b.jac - a.jac)
    .slice(0, limit)
    .map((x) => x.c);
}

// Fixer SIMULATO: legge la sezione memoria REALE (renderMemorySection). Se contiene
// la strategia risolutiva (needle) di un caso RIUSCITO, risolve in un round in meno
// (min 1). Un caso `discarded`/irrilevante non abbassa i round → mai peggio di OFF.
function simulateRounds(scenario, withRetrieval) {
  if (!withRetrieval) return scenario.baseRounds;
  const cases = proxyRetrieve(scenario.problem, scenario.bank);
  const section = renderMemorySection(cases);
  const helpful = cases.some(
    (c) => SUCCESS_VERDICTS.has(c.verdict) && section.toLowerCase().includes(scenario.needle.toLowerCase()),
  );
  return helpful ? Math.max(1, scenario.baseRounds - 1) : scenario.baseRounds;
}

test('gate misurato: mean repair rounds ON <= OFF (delta>=0)', () => {
  const off = FIXTURE.map((s) => simulateRounds(s, false));
  const on = FIXTURE.map((s) => simulateRounds(s, true));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const meanOff = mean(off);
  const meanOn = mean(on);
  const delta = meanOff - meanOn; // >0 = ON migliora

  // Monotonia per-scenario: il recupero non peggiora MAI un singolo caso.
  for (let i = 0; i < FIXTURE.length; i++) {
    assert.ok(on[i] <= off[i], `scenario "${FIXTURE[i].problem}" peggiorato: ${off[i]}→${on[i]}`);
  }
  // Gate: delta>=0 (condizione per abilitare il flag). Se fosse <0 il gate fallisce
  // e il default resta OFF (già OFF: doppia sicurezza).
  assert.ok(delta >= 0, `gate FALLITO: delta=${delta} (<0) → tenere il recupero OFF`);
  // Sanity: sulla fixture il recupero aiuta davvero (delta stretto >0), altrimenti
  // non varrebbe la spesa del recupero.
  assert.ok(delta > 0, `recupero inefficace sulla fixture (delta=${delta})`);
  // Lo scenario senza caso rilevante+riuscito NON deve migliorare (nessun falso aiuto).
  assert.equal(on[3], off[3], 'scenario senza match riuscito non deve cambiare');
});

test('gate: default live OFF (finché non validato sul fixer reale)', () => {
  const prev = process.env.BUGBAY_RETRIEVAL;
  try {
    delete process.env.BUGBAY_RETRIEVAL;
    // A recupero OFF il prompt live non contiene memoria, indipendentemente dai casi.
    assert.equal(retrievalEnabled(), false);
    assert.ok(!buildFixPrompt(FIX_OPTS).includes(MEMORY_HEADER));
  } finally {
    if (prev === undefined) delete process.env.BUGBAY_RETRIEVAL;
    else process.env.BUGBAY_RETRIEVAL = prev;
  }
});
