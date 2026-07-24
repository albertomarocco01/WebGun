/**
 * SMOKE-CASE ancora: invariante indipendente dal soggetto, sempre PASS.
 * È l'ancora stabile del set: non flippa MAI, così il meta-test verifica che il
 * conteggio appaiato non produca falsi flip sulle case immutate.
 */
import assert from 'node:assert/strict';

assert.equal(1 + 1, 2);
assert.equal(typeof globalThis.process.version, 'string');
