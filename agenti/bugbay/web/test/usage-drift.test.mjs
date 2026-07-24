/**
 * @descrizione
 * Test del predicato di drift del formato usage (fail-closed del breaker budget).
 * INVARIANTE: quando il formato non è riconosciuto, il budget va UNKNOWN (breaker
 * chiuso), MAI "budget OK". Copre i buchi fail-open del vecchio criterio
 * assistant-only: `type` rinominato, `message` rimosso, corruzione totale.
 * File `.mjs`: import TS via type-stripping nativo (Node ≥ 22.13).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUsageDrift } from '../src/modules/bugbay/agent-fix/usage-drift.ts';

test('nessun file / tutto vuoto → NON drift (installazione fresca, spesa zero legittima)', () => {
  assert.equal(isUsageDrift({ usageExtracted: 0, assistantLike: 0, recognizable: 0, parsedLines: 0, sawContent: false }), false);
});

test('usage estratto → mai drift', () => {
  assert.equal(isUsageDrift({ usageExtracted: 5, assistantLike: 0, recognizable: 0, parsedLines: 100, sawContent: true }), false);
});

test('discriminante `type` rinominato: righe transcript-like, zero usage → drift', () => {
  assert.equal(isUsageDrift({ usageExtracted: 0, assistantLike: 0, recognizable: 8, parsedLines: 8, sawContent: true }), true);
});

test('schema assistant noto ma usage sparito → drift', () => {
  assert.equal(isUsageDrift({ usageExtracted: 0, assistantLike: 3, recognizable: 3, parsedLines: 3, sawContent: true }), true);
});

test('file non-vuoti ma nessun JSON valido → drift (corruzione/rewrite)', () => {
  assert.equal(isUsageDrift({ usageExtracted: 0, assistantLike: 0, recognizable: 0, parsedLines: 0, sawContent: true }), true);
});

test('poche righe sotto soglia senza usage → NON drift (sessione minima legittima)', () => {
  assert.equal(isUsageDrift({ usageExtracted: 0, assistantLike: 0, recognizable: 4, parsedLines: 4, sawContent: true }), false);
});
