/**
 * @descrizione
 * Test dell'INVARIANTE SHADOW-FIRST del bandit v0.9 (node:test). Prova, per OGNI
 * contesto di routing, che SOTTO SOGLIA l'output live coincide con la scelta
 * DETERMINISTICA — cioè lo shadow bandit osserva ma non guida finché le soglie A33
 * scritte (config_versions scope='threshold') non sono superate.
 *
 * Segue la convenzione del repo (cfr. routing/consolidation/retrieval.test): il
 * runner nativo importa solo moduli FOGLIA / a catena type-only. Qui:
 *   • `routing.ts`   → foglia (l'hook shadow è iniettato, lo shell DB-backed è
 *                      caricato via dynamic import pigro che nel runner nativo NON
 *                      si risolve ⇒ hook assente ⇒ chooseModel deterministico).
 *   • `bandit-core.ts` → nucleo PURO (sampling, bracci, gate): unica dipendenza
 *                      runtime è `routing` (foglia). Lo shell `bandit.ts` (hub/ledger)
 *                      resta fuori dal runner, garantito da `tsc --noEmit`.
 *
 * Copertura:
 *  1. Boundary: con BUGBAY_BANDIT=1, chooseModel == deterministicModel ∀ contesto.
 *  2. Core: `decideShadow` garantisce liveModel==deterministic sotto soglia ∀ ctx,
 *     anche con posteriori sbilanciati (la garanzia è nel nucleo, non nell'assenza
 *     dell'hook).
 *  3. Gate `isContextLive`/`parseThreshold`: conservativo.
 *  4. META del gate: sopra soglia (config + obs + posteriori pilotati) il live PUÒ
 *     divergere — un gate sempre-deterministico è impossibile.
 *  5. Thompson puro: sampleBeta/chooseArm deterministici con RNG seminato.
 *
 * File `.mjs`: type-stripping nativo (Node ≥ 22.13), fuori dal glob TypeScript.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Shadow ATTIVO: verifichiamo che chooseModel resti comunque deterministico.
process.env.BUGBAY_BANDIT = '1';

import {
  chooseModel,
  deterministicModel,
  isHeavyFix,
  MODEL_HAIKU,
  MODEL_SONNET,
  MODEL_OPUS,
} from '../src/modules/bugbay/agent-fix/routing.ts';

import {
  sampleBeta,
  chooseArm,
  banditContextKey,
  armsForContext,
  parseThreshold,
  isContextLive,
  decideShadow,
} from '../src/modules/bugbay/agent-fix/bandit-core.ts';

// ── Matrice completa dei contesti (stessa enumerazione di routing.test) ──────

const FIXED = [
  { phase: 'interprete' },
  { phase: 'giudice' },
  { phase: 'repro' },
  { phase: 'piano' },
  { phase: 'escalation' },
];
const COMPLESSITA = ['banale', 'media', 'alta', undefined];
const PRIORITY = ['Bassa', 'Media', 'Alta', 'Critica', 'Urgente', undefined];
const ESCALATED = [true, false, undefined];
const TIPO_TASK = ['bug', 'feature', 'miglioria', undefined];

function allContexts() {
  const out = [...FIXED];
  for (const complessita of COMPLESSITA)
    for (const priority of PRIORITY)
      for (const escalated of ESCALATED)
        for (const tipoTask of TIPO_TASK)
          out.push({ phase: 'fix', complessita, priority, escalated, tipoTask });
  return out;
}

// Posteriori "estremi" per stressare l'invariante: OPUS dominante su SONNET/HAIKU.
function skewedPosteriors(arms) {
  return arms.map((model, i) => ({
    model,
    alpha: i === arms.length - 1 ? 99 : 1,
    beta: i === arms.length - 1 ? 1 : 99,
    observations: 10_000,
  }));
}

// ── 1. Boundary: sotto soglia chooseModel == deterministicModel ∀ contesto ───

test('boundary: chooseModel == deterministicModel ∀ contesto (shadow attivo, sotto soglia)', () => {
  const ctxs = allContexts();
  assert.ok(ctxs.length >= 293, `attesi ≥293 contesti, visti ${ctxs.length}`);
  for (const ctx of ctxs) {
    const live = chooseModel(ctx);
    const det = deterministicModel(ctx);
    assert.equal(live, det, `divergenza per ${JSON.stringify(ctx)}: live=${live} det=${det}`);
  }
});

test('golden invariato: fasi fisse deterministiche con shadow attivo', () => {
  assert.equal(chooseModel({ phase: 'interprete' }), MODEL_HAIKU);
  assert.equal(chooseModel({ phase: 'giudice' }), MODEL_HAIKU);
  assert.equal(chooseModel({ phase: 'repro' }), MODEL_SONNET);
  assert.equal(chooseModel({ phase: 'piano' }), MODEL_OPUS);
  assert.equal(chooseModel({ phase: 'escalation' }), MODEL_OPUS);
  assert.equal(chooseModel({ phase: 'fix', complessita: 'alta' }), MODEL_OPUS);
  assert.equal(chooseModel({ phase: 'fix', complessita: 'media' }), MODEL_SONNET);
});

// ── 2. Core: la garanzia sotto-soglia è nel nucleo, non nell'assenza dell'hook ─

test('decideShadow: sotto soglia liveModel==deterministic ∀ ctx, anche con posteriori estremi', () => {
  const rng = makeRng(4242);
  for (const ctx of allContexts()) {
    const det = deterministicModel(ctx);
    const arms = armsForContext(ctx);
    const post = skewedPosteriors(arms); // spinge lo shadow verso l'ULTIMO braccio
    // (a) nessuna threshold-config
    let d = decideShadow(ctx, det, post, null, rng);
    assert.equal(d.liveModel, det, `config null: ${JSON.stringify(ctx)}`);
    assert.equal(d.diverged, false);
    // (b) config presente ma contesto NON whitelisted
    d = decideShadow(ctx, det, post, parseThreshold('{"liveContexts":["__none__"],"minObservations":1}'), rng);
    assert.equal(d.liveModel, det, `non whitelisted: ${JSON.stringify(ctx)}`);
    // (c) whitelisted ma osservazioni sotto il minimo (min oltre gli obs disponibili)
    const key = banditContextKey(ctx);
    d = decideShadow(ctx, det, post, parseThreshold(`{"liveContexts":["${key}"],"minObservations":1e12}`), rng);
    assert.equal(d.liveModel, det, `obs<min: ${JSON.stringify(ctx)}`);
  }
});

// ── 3. Gate delle soglie: conservativo ───────────────────────────────────────

test('isContextLive / parseThreshold: conservativo (assente / non-whitelisted / obs<min ⇒ false)', () => {
  assert.equal(parseThreshold(undefined), null);
  assert.equal(parseThreshold('non-json'), null);
  assert.equal(parseThreshold('42'), null); // non-object
  assert.equal(isContextLive('fix:light', null, 10_000), false, 'config assente ⇒ mai live');
  assert.equal(isContextLive('fix:light', parseThreshold('{}'), 10_000), false, 'senza liveContexts ⇒ false');
  assert.equal(
    isContextLive('fix:light', parseThreshold('{"liveContexts":["repro"],"minObservations":5}'), 10_000),
    false,
    'contesto non whitelisted ⇒ false',
  );
  assert.equal(
    isContextLive('fix:light', parseThreshold('{"liveContexts":["fix:light"]}'), 10_000),
    false,
    'minObservations assente ⇒ mai live',
  );
  assert.equal(
    isContextLive('fix:light', parseThreshold('{"liveContexts":["fix:light"],"minObservations":5}'), 3),
    false,
    'osservazioni sotto il minimo ⇒ false',
  );
  assert.equal(
    isContextLive('fix:light', parseThreshold('{"liveContexts":["fix:light"],"minObservations":5}'), 5),
    true,
    'whitelist + obs ≥ min ⇒ true',
  );
});

// ── 4. META del gate: sopra soglia il live PUÒ divergere ─────────────────────

test('META: sopra soglia (config + obs + posteriori pilotati) decideShadow diverge — gate non è un no-op', () => {
  const ctx = { phase: 'fix', complessita: 'media' }; // deterministico = SONNET
  const det = deterministicModel(ctx);
  const key = banditContextKey(ctx); // 'fix:light'
  const arms = armsForContext(ctx); // [SONNET, OPUS]
  assert.equal(det, MODEL_SONNET);

  // Posteriori: OPUS ~1.0, SONNET ~0.0 ⇒ Thompson sceglie OPUS quasi sempre.
  const post = [
    { model: MODEL_SONNET, alpha: 1, beta: 200, observations: 201 },
    { model: MODEL_OPUS, alpha: 200, beta: 1, observations: 201 },
  ];
  const cfg = parseThreshold(`{"liveContexts":["${key}"],"minObservations":4}`);

  const rng = makeRng(31337);
  let diverged = false;
  let sawLive = false;
  for (let i = 0; i < 50; i++) {
    const d = decideShadow(ctx, det, post, cfg, rng);
    if (d.live) sawLive = true;
    if (d.diverged) {
      diverged = true;
      assert.equal(d.liveModel, MODEL_OPUS, 'la divergenza deve andare verso il braccio OPUS');
      assert.equal(d.live, true, 'diverged ⇒ live=true (mai sotto soglia)');
    }
  }
  assert.equal(sawLive, true, 'sopra soglia: decisioni con live=true');
  assert.equal(diverged, true, 'sopra soglia con posteriori sbilanciati, il live deve poter divergere');
});

// ── 5. Thompson sampling puro (RNG seminato → deterministico) ────────────────

test('sampleBeta: supporto in [0,1] e ripetibile con stesso seed', () => {
  const seeded = makeRng(12345);
  for (let i = 0; i < 100; i++) {
    const t = sampleBeta(2, 5, seeded);
    assert.ok(t >= 0 && t <= 1, `θ fuori [0,1]: ${t}`);
  }
  const a = collect(() => sampleBeta(3, 2, makeRng(7)), 20);
  const b = collect(() => sampleBeta(3, 2, makeRng(7)), 20);
  assert.deepEqual(a, b, 'stesso seed ⇒ stessa sequenza (puro/deterministico)');
});

test('chooseArm: braccio con posteriore nettamente più alto vince quasi sempre', () => {
  const arms = [
    { model: MODEL_SONNET, alpha: 1, beta: 50, observations: 51 },
    { model: MODEL_OPUS, alpha: 50, beta: 1, observations: 51 },
  ];
  const rng = makeRng(999);
  let opus = 0;
  for (let i = 0; i < 200; i++) if (chooseArm(arms, rng) === MODEL_OPUS) opus++;
  assert.ok(opus > 180, `OPUS dominante atteso >180/200, visto ${opus}`);
});

test('PARITÀ core↔routing: la scelta deterministica è sempre un braccio; heavy/light segue isHeavyFix', () => {
  for (const ctx of allContexts()) {
    const det = deterministicModel(ctx);
    const arms = armsForContext(ctx);
    // Vincola le costanti-modello ripetute in bandit-core a quelle reali di routing:
    // se un id derivasse, deterministicModel non sarebbe più tra i bracci.
    assert.ok(arms.includes(det), `deterministico ${det} non tra i bracci ${arms} per ${JSON.stringify(ctx)}`);
    // Vincola il predicato heavy ripetuto in bandit-core a routing.isHeavyFix.
    if (ctx.phase === 'fix') {
      const wantKey = isHeavyFix(ctx) ? 'fix:heavy' : 'fix:light';
      assert.equal(banditContextKey(ctx), wantKey, `chiave heavy/light per ${JSON.stringify(ctx)}`);
    } else {
      assert.equal(banditContextKey(ctx), ctx.phase);
    }
  }
  assert.equal(banditContextKey({ phase: 'fix', complessita: 'alta' }), 'fix:heavy');
  assert.equal(banditContextKey({ phase: 'fix', complessita: 'media' }), 'fix:light');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** PRNG mulberry32: deterministico e seminabile, per test ripetibili. */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collect(fn, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(fn());
  return out;
}
