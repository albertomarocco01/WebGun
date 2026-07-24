/**
 * @descrizione
 * Test (node:test) del passo NEAR-DUP (fix concilio F9) di `consolidation-core`.
 * Verifica: (1) due bullet quasi-identici (parafrasi minima) che il match ESATTO
 * mancava vengono unificati, tenendo il PIÙ RECENTE; (2) testi diversi restano;
 * (3) idempotenza (i superstiti non producono altre rimozioni); (4) stesso per i
 * casi episodici. Leaf puro → type-stripping nativo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulletDedupPlan,
  episodicDedupPlan,
} from '../src/modules/bugbay/agent-fix/consolidation-core.ts';

test('near-dup bullet: parafrasi minima unificata, tiene il più recente', () => {
  const bullets = [
    { id: 'old', project: 'p', outcome: 'positive', created: '2026-01-01T00:00:00.000Z',
      insight: 'Parse invoice date in UTC instead of local to avoid the off by one day' },
    { id: 'new', project: 'p', outcome: 'positive', created: '2026-02-01T00:00:00.000Z',
      insight: 'Parse the invoice date in UTC instead of local to avoid off by one day error' },
    { id: 'other', project: 'p', outcome: 'positive', created: '2026-01-15T00:00:00.000Z',
      insight: 'Debounce the search input to prevent duplicate network requests' },
  ];
  const { deleteIds } = bulletDedupPlan(bullets, { nearDupThreshold: 0.7 });
  assert.deepEqual(deleteIds, ['old']); // il vecchio near-dup rimosso, 'other' resta
});

test('near-dup bullet: idempotente (seconda passata → nessuna rimozione)', () => {
  const bullets = [
    { id: 'new', project: 'p', outcome: 'positive', created: '2026-02-01T00:00:00.000Z',
      insight: 'Parse the invoice date in UTC instead of local to avoid off by one day error' },
    { id: 'other', project: 'p', outcome: 'positive', created: '2026-01-15T00:00:00.000Z',
      insight: 'Debounce the search input to prevent duplicate network requests' },
  ];
  assert.deepEqual(bulletDedupPlan(bullets, { nearDupThreshold: 0.7 }).deleteIds, []);
});

test('near-dup NON tocca bullet di outcome/progetto diversi', () => {
  const bullets = [
    { id: 'pos', project: 'p', outcome: 'positive', created: '2026-01-01T00:00:00.000Z',
      insight: 'Parse invoice date in UTC instead of local off by one day' },
    { id: 'neg', project: 'p', outcome: 'negative', created: '2026-02-01T00:00:00.000Z',
      insight: 'Parse invoice date in UTC instead of local off by one day' },
  ];
  // Stesso testo ma outcome diverso (positivo vs anti-esempio) → gruppi diversi, nessuna rimozione.
  assert.deepEqual(bulletDedupPlan(bullets, { nearDupThreshold: 0.7 }).deleteIds, []);
});

test('near-dup casi episodici: parafrasi minima unificata, tiene il più recente', () => {
  const rows = [
    { id: 'old', project_id: 'p', reformulated: 'timezone off by one day in invoice date parsing UTC', verdict: 'approved', outcome: 'ok', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'new', project_id: 'p', reformulated: 'timezone off by one day in the invoice date parsing UTC local', verdict: 'approved', outcome: 'ok', created_at: '2026-02-01T00:00:00.000Z' },
    { id: 'diff', project_id: 'p', reformulated: 'null pointer in session logout handler', verdict: 'approved', outcome: 'ok', created_at: '2026-01-10T00:00:00.000Z' },
  ];
  const { deleteIds } = episodicDedupPlan(rows, { nearDupThreshold: 0.7 });
  assert.deepEqual(deleteIds, ['old']);
});
