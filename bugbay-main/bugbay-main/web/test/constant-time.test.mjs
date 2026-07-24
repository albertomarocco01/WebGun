/**
 * @descrizione
 * Test di correttezza del confronto a tempo costante del token (la proprietà di
 * timing non è unit-testabile; qui si verifica solo che uguale⇒true, diverso⇒false:
 * un compare rotto = bypass d'autenticazione).
 * File `.mjs`: import TS via type-stripping nativo (Node ≥ 22.13).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqual } from '../src/modules/bugbay/agent-fix/constant-time.ts';

test('uguali → true', () => {
  assert.equal(timingSafeEqual('abc123XYZ', 'abc123XYZ'), true);
  assert.equal(timingSafeEqual('', ''), true);
});

test('diversi → false (primo/ultimo char, lunghezza)', () => {
  assert.equal(timingSafeEqual('abc123', 'abc124'), false); // ultimo char
  assert.equal(timingSafeEqual('abc123', 'Xbc123'), false); // primo char
  assert.equal(timingSafeEqual('abc', 'abcd'), false);       // lunghezza diversa
  assert.equal(timingSafeEqual('token', ''), false);
});
