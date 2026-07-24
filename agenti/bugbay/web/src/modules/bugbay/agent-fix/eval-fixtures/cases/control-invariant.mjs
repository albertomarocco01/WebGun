/**
 * SMOKE-CASE DI CONTROLLO (il perno della coppia seminata).
 * Sonda l'invariante di confine di `classify` sul soggetto. È la case che FLIPPA:
 * PASS su baseline/good, FAIL sulla variante bad → fa scattare il rosso nel meta-test.
 * Contratto della smoke-case: `node <file>` esce 0 = PASS, ≠0 = FAIL.
 */
import assert from 'node:assert/strict';
import { classify, THRESHOLD } from '../subject.mjs';

assert.equal(classify(THRESHOLD), 'high', 'confine: n === THRESHOLD deve essere high');
assert.equal(classify(THRESHOLD - 1), 'low', 'sotto soglia deve essere low');
assert.equal(classify(THRESHOLD + 10), 'high', 'ben sopra soglia deve essere high');
