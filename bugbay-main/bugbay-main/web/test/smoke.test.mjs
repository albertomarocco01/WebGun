/**
 * @descrizione
 * Smoke test ZERO-DEP (node:test) — prova solo che l'harness gira ("npm test"
 * in web/). I gate reali della spina (append-only events, transizione+evento
 * same-txn, Last-Event-ID monotono, hard-fail su Node < 22.13) arrivano in W1.
 * File `.mjs`: fuori dal glob dei sorgenti TypeScript di tsconfig, non typecheckato.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('harness dei test funziona', () => {
  assert.equal(1 + 1, 2);
});

test('node:sqlite disponibile su questa versione di Node (>=22.13)', () => {
  const [maj, min] = process.versions.node.split('.').map(Number);
  assert.ok(maj > 22 || (maj === 22 && min >= 13), `Node ${process.versions.node} < 22.13`);
});
