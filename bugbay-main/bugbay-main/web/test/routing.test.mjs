/**
 * @descrizione
 * Test di CARATTERIZZAZIONE (node:test) per routing.chooseModel: fissa il
 * comportamento attuale — deterministico e behaviour-preserving — così il
 * futuro bandit (v0.9) non potrà cambiare in silenzio il modello scelto per
 * fase. Enumera le fasi fisse (interprete/repro/piano/escalation/giudice) e la
 * matrice del fix su complessità × priority × escalated × tipoTask.
 * File `.mjs` importato con type-stripping nativo (Node ≥ 22.13): fuori dal
 * glob TypeScript di tsconfig, non typecheckato.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseModel,
  isHeavyFix,
  MODEL_HAIKU,
  MODEL_SONNET,
  MODEL_OPUS,
} from '../src/modules/bugbay/agent-fix/routing.ts';

test('fasi fisse → modello atteso (golden)', () => {
  assert.equal(chooseModel({ phase: 'interprete' }), MODEL_HAIKU);
  assert.equal(chooseModel({ phase: 'giudice' }), MODEL_HAIKU);
  assert.equal(chooseModel({ phase: 'repro' }), MODEL_SONNET);
  assert.equal(chooseModel({ phase: 'piano' }), MODEL_OPUS);
  assert.equal(chooseModel({ phase: 'escalation' }), MODEL_OPUS);
});

// Matrice del fix: heavy (→ Opus) sse complessità alta OPPURE priorità
// Critica/Urgente OPPURE escalation. Nota: priorità 'Alta' NON è heavy (solo
// la complessità 'alta' lo è). tipoTask NON influenza il modello.
const COMPLESSITA = ['banale', 'media', 'alta', undefined];
const PRIORITY = ['Bassa', 'Media', 'Alta', 'Critica', 'Urgente', undefined];
const ESCALATED = [true, false, undefined];
const TIPO_TASK = ['bug', 'feature', 'miglioria', undefined];

const expectedHeavy = (complessita, priority, escalated) =>
  complessita === 'alta'
  || ['Critica', 'Urgente'].includes(priority ?? '')
  || escalated === true;

test('fix: complessità × priority × escalated × tipoTask → modello atteso', () => {
  let combos = 0;
  for (const complessita of COMPLESSITA) {
    for (const priority of PRIORITY) {
      for (const escalated of ESCALATED) {
        const heavy = expectedHeavy(complessita, priority, escalated);
        const want = heavy ? MODEL_OPUS : MODEL_SONNET;
        // isHeavyFix combacia con l'atteso, indipendente da tipoTask.
        assert.equal(
          isHeavyFix({ complessita, priority, escalated }),
          heavy,
          `isHeavyFix(${complessita}/${priority}/${escalated})`,
        );
        for (const tipoTask of TIPO_TASK) {
          const got = chooseModel({ phase: 'fix', complessita, priority, escalated, tipoTask });
          assert.equal(
            got,
            want,
            `fix ${complessita}/${priority}/escalated=${escalated}/${tipoTask} → ${got} (atteso ${want})`,
          );
          combos++;
        }
      }
    }
  }
  // 4 × 6 × 3 × 4 = 288 combinazioni coperte.
  assert.equal(combos, COMPLESSITA.length * PRIORITY.length * ESCALATED.length * TIPO_TASK.length);
});

test('tipoTask NON cambia il modello del fix (invarianza)', () => {
  const base = { phase: 'fix', complessita: 'media', priority: 'Media', escalated: false };
  const models = TIPO_TASK.map((tipoTask) => chooseModel({ ...base, tipoTask }));
  assert.equal(new Set(models).size, 1, `tipoTask ha alterato il modello: ${models.join(', ')}`);
});
