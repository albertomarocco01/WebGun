/**
 * verify.test.mjs — Test del ritentativo su `supabase db reset`.
 *
 * Runner nativo, zero dipendenze:  node --test scripts/
 *
 * `supabase db reset` e' saltuariamente instabile (Error status 502 durante il
 * riavvio dei container) e il gate diventa rosso per un motivo ambientale. Un
 * solo ritentativo, e l'instabilita' resta SCRITTA nel dettaglio: un gate che
 * nasconde l'ambiente traballante non e' piu' un gate.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { conRitentativo, dettaglioReset } from "./verify.mjs";

// Finto comando: restituisce gli esiti in coda, uno per chiamata.
function finto(...esiti) {
  const chiamate = [];
  const esegui = () => {
    chiamate.push(1);
    return esiti[chiamate.length - 1] ?? { status: 1, stderr: "esiti finiti" };
  };
  esegui.chiamate = () => chiamate.length;
  return esegui;
}

test("al primo colpo: nessun ritentativo", () => {
  const esegui = finto({ status: 0 });
  const { res, ritentato } = conRitentativo(esegui, 0);
  assert.equal(res.status, 0);
  assert.equal(ritentato, false);
  assert.equal(esegui.chiamate(), 1);
});

test("fallisce e poi riesce: ritentato una sola volta", () => {
  const esegui = finto({ status: 1, stderr: "Error status 502" }, { status: 0 });
  const { res, ritentato } = conRitentativo(esegui, 0);
  assert.equal(res.status, 0);
  assert.equal(ritentato, true);
  assert.equal(esegui.chiamate(), 2);
});

test("fallisce due volte: nessun terzo tentativo", () => {
  const esegui = finto({ status: 1, stderr: "Error status 502" }, { status: 1, stderr: "Error status 502" });
  const { res } = conRitentativo(esegui, 0);
  assert.equal(res.status, 1);
  assert.equal(esegui.chiamate(), 2);
});

test("il dettaglio dice esplicitamente che e' riuscito al secondo tentativo", () => {
  assert.equal(
    dettaglioReset({ status: 0 }, true, 3),
    "3 migrazioni applicate + seed (riuscito al secondo tentativo)"
  );
});

test("al primo colpo il dettaglio non parla di tentativi", () => {
  assert.equal(dettaglioReset({ status: 0 }, false, 3), "3 migrazioni applicate + seed");
});

test("se fallisce, il dettaglio riporta l'errore vero", () => {
  assert.match(dettaglioReset({ status: 1, stderr: "Error status 502" }, true, 3), /502/);
});
