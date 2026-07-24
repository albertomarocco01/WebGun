/**
 * @descrizione
 * Test di CARATTERIZZAZIONE (node:test) degli algoritmi VENDORIZZATI su cui poggia
 * il ledger duale Track L: block 5h di ccusage + pricing subset. Fissa il loro
 * comportamento hash-pinnato così una futura ri-vendorizzazione non può cambiare in
 * silenzio le decisioni del breaker di budget (`budgetGate` legge questi output).
 * Coperti i due file import-free `vendor/*`; la parte DB-backed di `ledger.ts`
 * (openHubDb/node:sqlite) resta fuori dal runner nativo (grafo con import estensione-less,
 * come da convenzione di `routing.test.mjs`), garantita da `tsc --noEmit`.
 * File `.mjs`: type-stripping nativo (Node ≥ 22.13), fuori dal glob TypeScript.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  identifySessionBlocks,
  SESSION_DURATION_MS,
  VENDOR_PIN as BLOCKS_PIN,
} from '../src/modules/bugbay/agent-fix/vendor/ccusage-blocks.ts';
import { costFromTokens, VENDOR_PIN as PRICING_PIN } from '../src/modules/bugbay/agent-fix/vendor/pricing.ts';

const HOUR = 60 * 60 * 1000;

// ── block 5h vendorizzato ────────────────────────────────────────────────────

test('block 5h: split per DURATA (>5h dall\'inizio del blocco)', () => {
  const t0 = Date.UTC(2026, 0, 1, 10, 30, 0); // ancora attesa: 10:00 (floor all\'ora UTC)
  const e = (h) => ({ timestampMs: t0 + h * HOUR, inputTokens: 1, outputTokens: 2, costUsd: 1 });
  // 0h,1h,4h nello stesso blocco; 6h supera i 5h dall'inizio → nuovo blocco.
  const res = identifySessionBlocks([e(0), e(1), e(4), e(6)]);
  assert.equal(res.length, 2);
  assert.equal(res[0].entries, 3);
  assert.equal(res[0].startMs, Date.UTC(2026, 0, 1, 10, 0, 0)); // floor all'ora piena
  assert.equal(res[0].endMs, res[0].startMs + SESSION_DURATION_MS);
  assert.equal(res[0].inputTokens, 3);
  assert.equal(res[0].outputTokens, 6);
  assert.equal(res[1].entries, 1);
});

test('block 5h: split per GAP (>5h di inattività) anche entro la durata', () => {
  const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
  const e = (h) => ({ timestampMs: t0 + h * HOUR, inputTokens: 1, outputTokens: 1, costUsd: 1 });
  const res = identifySessionBlocks([e(0), e(0.5), e(7)]); // gap di 6.5h prima dell'ultimo
  assert.equal(res.length, 2);
  assert.equal(res[1].entries, 1);
});

test('block 5h: input vuoto → nessun blocco; ordina per timestamp', () => {
  assert.deepEqual(identifySessionBlocks([]), []);
  const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
  const out = identifySessionBlocks([
    { timestampMs: t0 + 2 * HOUR, inputTokens: 1, outputTokens: 0, costUsd: 1 },
    { timestampMs: t0, inputTokens: 1, outputTokens: 0, costUsd: 1 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].startMs, t0); // il primo (dopo sort) ancora il blocco
});

// ── pricing subset vendorizzato ──────────────────────────────────────────────

test('pricing: opus 1M+1M = 90 USD (15 in + 75 out); cache pesata', () => {
  assert.equal(Math.round(costFromTokens('claude-opus-4-20250514', { input_tokens: 1_000_000, output_tokens: 1_000_000 })), 90);
  // cache read = 0.1×input (opus 1.5/1M): 1M read → 1.5 USD.
  assert.equal(Math.round(costFromTokens('claude-opus-4', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000 }) * 10) / 10, 1.5);
});

test('pricing: sonnet/haiku per prefisso; modello ignoto → tariffa conservativa Opus (fail-closed)', () => {
  assert.equal(Math.round(costFromTokens('claude-sonnet-4-20250514', { input_tokens: 1_000_000, output_tokens: 1_000_000 })), 18); // 3 + 15
  assert.equal(Math.round(costFromTokens('claude-3-5-haiku-20241022', { input_tokens: 1_000_000, output_tokens: 0 }) * 100) / 100, 0.8);
  // Modello NON a listino: fallback Opus (input 15) — mai 0 (che sarebbe fail-open sul budget).
  assert.equal(costFromTokens('gpt-4o', { input_tokens: 1_000_000, output_tokens: 0 }), 15);
  assert.equal(costFromTokens(undefined, { input_tokens: 1_000_000, output_tokens: 0 }), 15);
});

test('vendor pin dichiarati (bump manuale al re-vendoring)', () => {
  assert.equal(BLOCKS_PIN, 'ccusage-blocks-v1');
  assert.equal(PRICING_PIN, 'pricing-2026-01');
});
