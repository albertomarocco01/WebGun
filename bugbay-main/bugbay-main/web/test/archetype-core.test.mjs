/**
 * @descrizione
 * Test (node:test) del CORE PURO del clustering archetipi (`archetype-core.ts`, fix
 * concilio F4). Verifica: (1) casi che condividono token significativi si clusterizzano;
 * (2) i token generici (stoplist: "fix"/"error"/"bug") NON provocano cluster spurii;
 * (3) rispetto della dimensione minima del cluster; (4) determinismo (ordine stabile).
 * Leaf puro import-free → type-stripping nativo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterCases,
  tokenizeReformulated,
  jaccard,
} from '../src/modules/bugbay/agent-fix/archetype-core.ts';

test('tokenize: droppa stopword generiche e token corti', () => {
  const t = tokenizeReformulated('Fix the timezone bug in invoice date parsing UTC');
  assert.ok(!t.has('fix'));
  assert.ok(!t.has('the'));
  assert.ok(!t.has('bug'));
  assert.ok(t.has('timezone'));
  assert.ok(t.has('invoice'));
  assert.ok(t.has('parsing'));
});

test('jaccard: identici=1, disgiunti=0', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
  assert.equal(jaccard(new Set(['a']), new Set(['b'])), 0);
  assert.equal(jaccard(new Set(), new Set(['a'])), 0);
});

test('clusterizza 3 casi sulla stessa problematica (timezone/date)', () => {
  const cases = [
    { id: 'c1', reformulated: 'timezone off by one day invoice date parsing UTC local midnight' },
    { id: 'c2', reformulated: 'invoice date parsing timezone UTC wrong at midnight off by one' },
    { id: 'c3', reformulated: 'date parsing timezone UTC midnight rollover invoice off by one day' },
    { id: 'c4', reformulated: 'null pointer dereference in user session handler logout' },
  ];
  const clusters = clusterCases(cases, { minClusterSize: 3, jaccardThreshold: 0.4 });
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0], ['c1', 'c2', 'c3']); // ordinati per id, il null-ptr escluso
});

test('token generici condivisi NON creano cluster spurio', () => {
  // Ogni caso parla di cose diverse; condividono solo parole stoppate.
  const cases = [
    { id: 'a', reformulated: 'fix the error bug in login' },
    { id: 'b', reformulated: 'fix the error bug in payment' },
    { id: 'c', reformulated: 'fix the error bug in export' },
  ];
  const clusters = clusterCases(cases, { minClusterSize: 3, jaccardThreshold: 0.4 });
  assert.equal(clusters.length, 0); // login/payment/export non condividono token significativi
});

test('rispetta minClusterSize: 2 casi simili non bastano se minSize=3', () => {
  const cases = [
    { id: 'a', reformulated: 'timezone date parsing utc invoice midnight' },
    { id: 'b', reformulated: 'timezone date parsing utc invoice midnight rollover' },
  ];
  assert.equal(clusterCases(cases, { minClusterSize: 3 }).length, 0);
});

test('deterministico: stesso input → stesso output', () => {
  const cases = [
    { id: 'c3', reformulated: 'alpha beta gamma delta epsilon' },
    { id: 'c1', reformulated: 'alpha beta gamma delta epsilon' },
    { id: 'c2', reformulated: 'alpha beta gamma delta epsilon' },
  ];
  const a = clusterCases(cases, { minClusterSize: 3, jaccardThreshold: 0.4 });
  const b = clusterCases(cases, { minClusterSize: 3, jaccardThreshold: 0.4 });
  assert.deepEqual(a, b);
  assert.deepEqual(a[0], ['c1', 'c2', 'c3']);
});
