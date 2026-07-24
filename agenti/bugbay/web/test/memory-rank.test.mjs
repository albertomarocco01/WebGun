/**
 * @descrizione
 * Test (node:test) del CORE PURO del ranking memoria (`memory-rank.ts`, fix concilio
 * F3+F5). Verifica: (1) il pavimento di rilevanza scarta i match lessicali deboli;
 * (2) a pari BM25, una sorgente HUMAN batte una IMPLICIT, e un positivo batte un
 * anti-esempio negative; (3) l'utilità osservata (useful/harmful) sposta il ranking;
 * (4) determinismo (nessun accesso a orologio/DB; nowMs iniettato) e tie-break stabile.
 * Leaf puro import-free → type-stripping nativo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankMemory, RANK_DEFAULTS } from '../src/modules/bugbay/agent-fix/memory-rank.ts';

const base = (over) => ({
  caseId: 'x', bm25: -5, verdictSource: 'HUMAN', outcome: 'positive',
  createdAt: '2026-01-01T00:00:00.000Z', useful: 0, harmful: 0, ...over,
});

test('pavimento di rilevanza: scarta i candidati oltre maxBm25Gap dal migliore', () => {
  const cand = [
    base({ caseId: 'strong', bm25: -10 }),
    base({ caseId: 'weak', bm25: -10 + RANK_DEFAULTS.maxBm25Gap + 1 }), // oltre soglia
  ];
  const out = rankMemory(cand, { limit: 5, nowMs: Date.parse('2026-01-01T00:00:00.000Z') });
  assert.deepEqual(out.map((c) => c.caseId), ['strong']);
});

test('a pari BM25 la sorgente HUMAN batte IMPLICIT', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const out = rankMemory([
    base({ caseId: 'implicit', verdictSource: 'IMPLICIT' }),
    base({ caseId: 'human', verdictSource: 'HUMAN' }),
  ], { limit: 2, nowMs: now });
  assert.equal(out[0].caseId, 'human');
});

test('a pari BM25 un positivo batte un anti-esempio negative', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const out = rankMemory([
    base({ caseId: 'neg', outcome: 'negative' }),
    base({ caseId: 'pos', outcome: 'positive' }),
  ], { limit: 2, nowMs: now });
  assert.equal(out[0].caseId, 'pos');
});

test('utilità osservata: un caso utile scala sopra uno dannoso a pari BM25', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const out = rankMemory([
    base({ caseId: 'harmful', useful: 0, harmful: 5 }),
    base({ caseId: 'useful', useful: 5, harmful: 0 }),
  ], { limit: 2, nowMs: now });
  assert.equal(out[0].caseId, 'useful');
});

test('deterministico: stesso input → stesso ordine; tie-break stabile su caseId', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');
  const cand = [base({ caseId: 'b' }), base({ caseId: 'a' })];
  const a = rankMemory(cand, { limit: 2, nowMs: now });
  const b = rankMemory(cand, { limit: 2, nowMs: now });
  assert.deepEqual(a.map((c) => c.caseId), b.map((c) => c.caseId));
  // Identici su tutto → tie-break alfabetico su caseId.
  assert.deepEqual(a.map((c) => c.caseId), ['a', 'b']);
});

test('lista vuota → []', () => {
  assert.deepEqual(rankMemory([], { limit: 3, nowMs: 0 }), []);
});
