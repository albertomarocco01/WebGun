/**
 * SMOKE-CASE di forma: il soggetto espone il contratto atteso (classify fn +
 * THRESHOLD numerico). Passa su baseline e su ENTRAMBE le varianti di controllo
 * (good e bad rompono la LOGICA, non la FORMA): resta stabile, non è un flip.
 * Serve a dimostrare che il conteggio-flip appaiato lascia intatte le case stabili.
 */
import assert from 'node:assert/strict';
import * as subject from '../subject.mjs';

assert.equal(typeof subject.classify, 'function', 'classify deve essere una funzione');
assert.equal(typeof subject.THRESHOLD, 'number', 'THRESHOLD deve essere un numero');
