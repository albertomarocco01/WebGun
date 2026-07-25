/**
 * erd-lib.test.mjs — Test della costruzione del diagramma ER.
 *
 * Runner nativo, zero dipendenze:  node --test scripts/
 *
 * Il cast booleano sbagliato (bug n°2 del collaudo) aveva spento in un colpo
 * solo i marcatori PK/FK, l'annotazione "obbligatorio" e tutte le cardinalita'
 * obbligatorie: il diagramma restava plausibile e sbagliato. Qui si verifica
 * ognuna delle quattro cose separatamente.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { costruisciErd } from "./erd-lib.mjs";

// [tabella, colonna, tipo, notNull, isPk, isFk]
const COLONNE = [
  ["orders", "id", "uuid", "true", "true", "false"],
  ["orders", "user_id", "uuid", "true", "false", "true"],
  ["orders", "note", "text", "false", "false", "false"],
];

test("marca la chiave primaria con PK", () => {
  const erd = costruisciErd({ colonne: COLONNE, relazioni: [] });
  assert.match(erd, /^ {8}uuid id PK "obbligatorio"$/m);
});

test("marca la chiave esterna con FK", () => {
  const erd = costruisciErd({ colonne: COLONNE, relazioni: [] });
  assert.match(erd, /^ {8}uuid user_id FK "obbligatorio"$/m);
});

test('annota "obbligatorio" solo sulle colonne not null', () => {
  const erd = costruisciErd({ colonne: COLONNE, relazioni: [] });
  assert.match(erd, /^ {8}text note$/m); // nullable: nessuna annotazione
  assert.equal(erd.match(/"obbligatorio"/g).length, 2);
});

test("apre e chiude il blocco di ogni entita'", () => {
  const erd = costruisciErd({
    colonne: [...COLONNE, ["products", "id", "uuid", "true", "true", "false"]],
    relazioni: [],
  });
  assert.equal(erd.split("\n")[0], "erDiagram");
  assert.equal((erd.match(/^ {4}\w+ \{$/gm) ?? []).length, 2);
  assert.equal((erd.match(/^ {4}\}$/gm) ?? []).length, 2);
});

test("normalizza i tipi che Mermaid non accetta", () => {
  const erd = costruisciErd({
    colonne: [["order_items", "tax_rate", "numeric(5,4)", "true", "false", "false"]],
    relazioni: [],
  });
  assert.match(erd, /numeric_5_4_ tax_rate/);
});

// ─── cardinalita' ────────────────────────────────────────────────────────────
// [origine, destinazione, nomeVincolo, obbligatoria]

test("FK obbligatoria → ||--o{ (il figlio ha sempre un padre)", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["orders", "users", "orders_user_id_fkey", "true"]],
  });
  assert.equal(erd, 'erDiagram\n    users ||--o{ orders : "orders_user_id_fkey"');
});

test("FK facoltativa → |o--o{", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["products", "categories", "products_category_id_fkey", "false"]],
  });
  assert.match(erd, /^ {4}categories \|o--o\{ products : "products_category_id_fkey"$/m);
});

// ─── REGRESSIONE — cast booleano (bug n°2 del collaudo) ──────────────────────

test("regressione cast booleano: la resa 't'/'f' vale quanto 'true'/'false'", () => {
  const conT = costruisciErd({
    colonne: [["orders", "id", "uuid", "t", "t", "f"]],
    relazioni: [["orders", "users", "fk", "t"]],
  });
  const conTrue = costruisciErd({
    colonne: [["orders", "id", "uuid", "true", "true", "false"]],
    relazioni: [["orders", "users", "fk", "true"]],
  });
  assert.equal(conT, conTrue);
  assert.match(conT, /uuid id PK "obbligatorio"/);
  assert.match(conT, /users \|\|--o\{ orders/);
});

// ─── REGRESSIONE — CRLF di psql su Windows (bug n°1 del collaudo) ────────────

// ─── cardinalita' 1:1 ────────────────────────────────────────────────────────
// Una FK il cui insieme di colonne e' anche unico (o chiave primaria) non puo'
// ripetersi: e' un 1:1, non un 1:N. La riga porta il campo in coda:
// [origine, destinazione, nomeVincolo, obbligatoria, schemaDestinazione, esclusiva]

test("FK anche unica → cardinalita' ||--|| (1:1)", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["dettagli", "prodotti", "dettagli_id_fkey", "true", "public", "true"]],
  });
  assert.match(erd, /^ {4}prodotti \|\|--\|\| dettagli : "dettagli_id_fkey"$/m);
});

test("FK non unica resta 1:N anche se obbligatoria", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["order_items", "orders", "order_items_order_id_fkey", "true", "public", "false"]],
  });
  assert.match(erd, /^ {4}orders \|\|--o\{ order_items : "order_items_order_id_fkey"$/m);
});

// ─── entita' di uno schema non richiesto ─────────────────────────────────────
// Senza qualificazione, `auth.users` e un'ipotetica `public.users` diventano la
// stessa entita' nel diagramma.

test("entita' di uno schema non richiesto → nome qualificato", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["orders", "users", "orders_user_id_fkey", "true", "auth", "false"]],
    schemi: ["public"],
  });
  assert.match(erd, /^ {4}auth_users \|\|--o\{ orders : "orders_user_id_fkey"$/m);
});

test("il caso reale: profiles e' 1:1 verso auth_users", () => {
  const erd = costruisciErd({
    colonne: [],
    relazioni: [["profiles", "users", "profiles_id_fkey", "true", "auth", "true"]],
    schemi: ["public"],
  });
  assert.equal(erd, 'erDiagram\n    auth_users ||--|| profiles : "profiles_id_fkey"');
});

test("regressione CRLF: il \\r non entra nel diagramma", () => {
  const erd = costruisciErd({
    colonne: [["orders", "id", "uuid", "true\r", "true", "false"]],
    relazioni: [["orders", "users", "orders_user_id_fkey\r", "true"]],
  });
  assert.ok(!erd.includes("\r"), "il diagramma non deve contenere ritorni a capo di psql");
  assert.match(erd, /uuid id PK "obbligatorio"/);
});
