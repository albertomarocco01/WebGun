/**
 * verify.test.mjs — Test delle regole del gate.
 *
 * Runner nativo, zero dipendenze:  node --test "scripts/**\/*.test.mjs"
 *
 * 1. Ritentativo su `supabase db reset`: e' saltuariamente instabile (Error
 *    status 502 durante il riavvio dei container) e il gate diventa rosso per un
 *    motivo ambientale. Un solo ritentativo, e l'instabilita' resta SCRITTA nel
 *    dettaglio: un gate che nasconde l'ambiente traballante non e' piu' un gate.
 * 2. Schemi esposti: l'audit deve guardare tutto cio' che PostgREST pubblica.
 *    Il gate ha auditato solo `public` per mesi senza che nulla lo dicesse.
 * 3. Contratto d'uscita: configurazioni copiate e handoff scritto. Erano due
 *    obblighi che nessuno strumento verificava.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { conRitentativo, contrattoUscita, dettaglioReset, schemiEsposti, urlDbProgetto } from "./verify.mjs";

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

// ------------------------------------------------------------ schemi esposti

const CONFIG_REALE = `
[api]
enabled = true
port = 54321
# Schemas to expose in your API. \`public\` and \`graphql_public\` are included by default.
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]

[api.tls]
enabled = false

[db]
port = 54322
`;

test("legge gli schemi esposti da [api].schemas", () => {
  assert.deepEqual(schemiEsposti(CONFIG_REALE), ["public", "graphql_public"]);
});

test("uno schema secondario aggiunto a mano finisce nell'audit", () => {
  assert.deepEqual(
    schemiEsposti('[api]\nschemas = ["public", "privato"]\n'),
    ["public", "privato"]
  );
});

test("senza config leggibile si audita almeno public, mai niente", () => {
  assert.deepEqual(schemiEsposti(null), ["public"]);
  assert.deepEqual(schemiEsposti(""), ["public"]);
});

test("una chiave `schemas` fuori da [api] non conta", () => {
  // `[storage] schemas` non esiste oggi, ma un config.toml futuro non deve
  // poter allargare l'audit di nascosto: conta solo cio' che espone l'API.
  assert.deepEqual(schemiEsposti('[db]\nschemas = ["interno"]\n'), ["public"]);
});

test("la riga di commento che documenta `schemas` non viene letta come valore", () => {
  assert.deepEqual(
    schemiEsposti('[api]\n# schemas = ["sbagliato"]\nschemas = ["public"]\n'),
    ["public"]
  );
});

// ------------------------------------------------------- database del progetto

test("il database auditato e' quello del progetto, non la porta di default", () => {
  assert.equal(
    urlDbProgetto(CONFIG_REALE),
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  );
});

test("porta non standard: due stack accesi non si scambiano il database", () => {
  // il caso reale del 2026-07-26: banco su 56322, un altro progetto su 54322.
  assert.equal(
    urlDbProgetto("[db]\nport = 56322\n"),
    "postgresql://postgres:postgres@127.0.0.1:56322/postgres"
  );
});

test("senza [db].port non si inventa un database", () => {
  assert.equal(urlDbProgetto(null), null);
  assert.equal(urlDbProgetto("[api]\nport = 54321\n"), null);
});

test("il commento in coda alla porta non entra nell'URL", () => {
  assert.equal(
    urlDbProgetto("[db]\nport = 54322 # porta locale\n"),
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  );
});

// --------------------------------------------------------- contratto d'uscita

const seEsistono = (...presenti) => (rel) => presenti.includes(rel);
const HANDOFF = "docs/handoff/07-schema-forge.md";
const TUTTI = [".sqlfluff", "squawk.toml", HANDOFF];

test("contratto completo: passa", () => {
  const esito = contrattoUscita(seEsistono(...TUTTI), () => "handoff scritto per intero");
  assert.equal(esito.status, "pass");
  assert.equal(esito.detail, "");
});

test("configurazioni non copiate da forge: fallisce e le nomina entrambe", () => {
  const esito = contrattoUscita(seEsistono(HANDOFF), () => "ok");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /\.sqlfluff/);
  assert.match(esito.detail, /squawk\.toml/);
});

test("handoff assente: fallisce", () => {
  const esito = contrattoUscita(seEsistono(".sqlfluff", "squawk.toml"), () => "");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /07-schema-forge\.md/);
});

test("handoff col template non compilato: fallisce (esistere non basta)", () => {
  const esito = contrattoUscita(seEsistono(...TUTTI), () => "# Handoff\n\n{{entita}}\n");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /segnaposto/);
});
