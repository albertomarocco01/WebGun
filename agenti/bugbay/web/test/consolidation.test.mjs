/**
 * @descrizione
 * Test (node:test) del CORE PURO del consolidamento memoria (Track C). Verifica:
 * (1) `decideTrigger` — prima volta scatta solo oltre soglia; poi soglia
 * differenziale di nuovi verdetti o periodico (ma solo con ≥1 nuovo verdetto:
 * niente churn a vuoto); (2) `bulletDedupPlan` — dedup per contenuto tenendo il PIÙ
 * RECENTE + cap per progetto, e idempotenza (i superstiti non producono altre
 * rimozioni); (3) `episodicDedupPlan` — stessa logica sui casi episodici.
 *
 * NOTA (come routing/ledger/retrieval test): le API IO (`consolidate`/
 * `maybeConsolidate`) sono DB-backed (node:sqlite) + fs, fuori dal runner nativo;
 * il loro cablaggio tipato è garantito da `tsc --noEmit`. Qui si esercitano SOLO le
 * funzioni pure esportate. File `.mjs`: type-stripping nativo, fuori dal glob TS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideTrigger,
  bulletDedupPlan,
  episodicDedupPlan,
} from '../src/modules/bugbay/agent-fix/consolidation-core.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ── 1. decideTrigger ─────────────────────────────────────────────────────────

test('decideTrigger: prima volta scatta solo oltre soglia', () => {
  assert.deepEqual(decideTrigger(null, 10, 0, { verdictThreshold: 25 }), { run: false, reason: 'none' });
  assert.deepEqual(decideTrigger(null, 25, 0, { verdictThreshold: 25 }), { run: true, reason: 'initial' });
  assert.deepEqual(decideTrigger(null, 40, 0, { verdictThreshold: 25 }), { run: true, reason: 'initial' });
});

test('decideTrigger: soglia differenziale di nuovi verdetti', () => {
  const state = { verdictsAt: 100, ranAtMs: 1_000 };
  const opts = { verdictThreshold: 25, periodicMs: DAY };
  // 124-100 = 24 < 25 → non scatta (e periodico non scaduto).
  assert.deepEqual(decideTrigger(state, 124, 1_000 + HOUR, opts), { run: false, reason: 'none' });
  // 125-100 = 25 ≥ 25 → scatta per conteggio.
  assert.deepEqual(decideTrigger(state, 125, 1_000 + HOUR, opts), { run: true, reason: 'verdict-count' });
});

test('decideTrigger: periodico scatta solo con ≥1 nuovo verdetto (niente churn a vuoto)', () => {
  const state = { verdictsAt: 100, ranAtMs: 1_000 };
  const opts = { verdictThreshold: 25, periodicMs: DAY };
  // Periodo scaduto ma ZERO nuovi verdetti → no-op (idempotenza).
  assert.deepEqual(decideTrigger(state, 100, 1_000 + 2 * DAY, opts), { run: false, reason: 'none' });
  // Periodo scaduto + 1 nuovo verdetto (sotto la soglia differenziale) → periodico.
  assert.deepEqual(decideTrigger(state, 101, 1_000 + 2 * DAY, opts), { run: true, reason: 'periodic' });
});

// ── 2. bulletDedupPlan ───────────────────────────────────────────────────────

function bullet(id, project, outcome, insight, created) {
  return {
    id, project, outcome, insight, created,
    report: null, run: null, verdict: 'approved', source: 'HUMAN', files: [], tags: [],
  };
}

test('bulletDedupPlan: dedup per contenuto tiene il PIÙ RECENTE', () => {
  const bullets = [
    bullet('a', 'proj', 'positive', 'Fix the date in UTC', '2026-01-01T00:00:00Z'),
    bullet('b', 'proj', 'positive', 'fix the date in UTC  ', '2026-02-01T00:00:00Z'), // dup (norm) più recente
    bullet('c', 'proj', 'positive', 'Something else entirely', '2026-01-15T00:00:00Z'),
  ];
  const { deleteIds } = bulletDedupPlan(bullets);
  assert.deepEqual(deleteIds, ['a']); // 'b' è più recente → resta; 'a' potato; 'c' unico
});

test('bulletDedupPlan: outcome/progetto diversi NON sono duplicati', () => {
  const bullets = [
    bullet('a', 'proj', 'positive', 'same text', '2026-01-01T00:00:00Z'),
    bullet('b', 'proj', 'negative', 'same text', '2026-01-02T00:00:00Z'),
    bullet('c', 'other', 'positive', 'same text', '2026-01-03T00:00:00Z'),
  ];
  assert.deepEqual(bulletDedupPlan(bullets).deleteIds, []);
});

test('bulletDedupPlan: cap per progetto pota i più vecchi in eccesso', () => {
  const bullets = [
    bullet('a', 'proj', 'positive', 'one', '2026-01-01T00:00:00Z'),
    bullet('b', 'proj', 'positive', 'two', '2026-01-02T00:00:00Z'),
    bullet('c', 'proj', 'positive', 'three', '2026-01-03T00:00:00Z'),
  ];
  const { deleteIds } = bulletDedupPlan(bullets, { maxBulletsPerProject: 2 });
  assert.deepEqual(deleteIds, ['a']); // tiene i 2 più recenti (c,b); pota il più vecchio
});

test('bulletDedupPlan: idempotente — i superstiti non producono altre rimozioni', () => {
  const bullets = [
    bullet('a', 'proj', 'positive', 'dup', '2026-01-01T00:00:00Z'),
    bullet('b', 'proj', 'positive', 'dup', '2026-02-01T00:00:00Z'),
    bullet('c', 'proj', 'positive', 'unique', '2026-01-15T00:00:00Z'),
  ];
  const first = bulletDedupPlan(bullets).deleteIds;
  const survivors = bullets.filter((b) => !first.includes(b.id));
  assert.deepEqual(bulletDedupPlan(survivors).deleteIds, []); // seconda passata: no-op
});

// ── 3. episodicDedupPlan ─────────────────────────────────────────────────────

function ecase(id, project_id, verdict, outcome, reformulated, created_at) {
  return { id, project_id, verdict, outcome, reformulated, created_at };
}

test('episodicDedupPlan: dedup per contenuto tiene il PIÙ RECENTE', () => {
  const rows = [
    ecase('a', 'p', 'merged', 'ok', 'null pointer in auth refresh', '2026-01-01T00:00:00Z'),
    ecase('b', 'p', 'merged', 'ok', 'null pointer in auth refresh', '2026-03-01T00:00:00Z'),
    ecase('c', 'p', 'merged', 'ok', 'unrelated navbar flex issue', '2026-02-01T00:00:00Z'),
  ];
  assert.deepEqual(episodicDedupPlan(rows).deleteIds, ['a']);
});

test('episodicDedupPlan: verdict diverso NON è duplicato; cap per progetto', () => {
  const rows = [
    ecase('a', 'p', 'merged', 'ok', 'same', '2026-01-01T00:00:00Z'),
    ecase('b', 'p', 'discarded', 'ok', 'same', '2026-01-02T00:00:00Z'),
  ];
  assert.deepEqual(episodicDedupPlan(rows).deleteIds, []); // verdict distinto → tenuti entrambi

  const many = [
    ecase('x', 'p', 'merged', 'ok', 'a', '2026-01-01T00:00:00Z'),
    ecase('y', 'p', 'merged', 'ok', 'b', '2026-01-02T00:00:00Z'),
    ecase('z', 'p', 'merged', 'ok', 'c', '2026-01-03T00:00:00Z'),
  ];
  assert.deepEqual(episodicDedupPlan(many, { maxCasesPerProject: 2 }).deleteIds, ['x']);
});

test('episodicDedupPlan: project_id null NON collide con progetti nominati', () => {
  const rows = [
    ecase('a', null, 'merged', 'ok', 'same text', '2026-01-01T00:00:00Z'),
    ecase('b', 'p', 'merged', 'ok', 'same text', '2026-01-02T00:00:00Z'),
  ];
  assert.deepEqual(episodicDedupPlan(rows).deleteIds, []);
});
