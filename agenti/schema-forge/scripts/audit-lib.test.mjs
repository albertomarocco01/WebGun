/**
 * audit-lib.test.mjs — Test delle regole dell'audit RLS.
 *
 * Runner nativo, zero dipendenze:  node --test scripts/
 *
 * Ogni regola ha due test: uno in cui SCATTA (con la gravita' attesa) e uno in
 * cui NON DEVE scattare. Un audit che segnala tutto e' rumore quanto un audit
 * che non segnala niente.
 *
 * Gli ultimi due blocchi sono i due bug trovati a mano durante il collaudo del
 * 2026-07-24: restano qui per sempre, perche' erano vivi dal primo giorno e
 * nessuno lo segnalava.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditAll,
  regolaChiaviEsterne,
  regolaColonneDiPolicy,
  regolaFunzioni,
  regolaPolicy,
  regolaTabelle,
  regolaViste,
} from "./audit-lib.mjs";

const gravita = (findings) => findings.map((f) => f.severity);

// ─── regola 1 — tabella esposta senza RLS ────────────────────────────────────

test("regola 1: tabella senza RLS → block", () => {
  const findings = regolaTabelle([["public", "nuda", "false", "0"]]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.nuda");
  assert.match(findings[0].hint, /enable row level security/);
});

test("regola 1: tabella con RLS e policy → nessun finding", () => {
  assert.deepEqual(regolaTabelle([["public", "orders", "true", "2"]]), []);
});

// ─── regola 1b — RLS attiva ma zero policy ───────────────────────────────────

test("regola 1b: RLS attiva senza policy → issue", () => {
  const findings = regolaTabelle([["public", "rls_senza_policy", "true", "0"]]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].message, /nessuna policy/);
});

test("regola 1b: una policy basta a non far scattare la regola", () => {
  assert.deepEqual(regolaTabelle([["public", "rls_senza_policy", "true", "1"]]), []);
});

// ─── regola 2 — permissivita' e costo delle policy ───────────────────────────

test("regola 2: with check (true) in scrittura → block", () => {
  const findings = regolaPolicy([
    ["public", "scrittura_aperta", "apri a tutti", "INSERT", "{authenticated}", "", "true"],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /with check \(true\)/);
});

test("regola 2: policy owner-based scritta bene → nessun finding", () => {
  const findings = regolaPolicy([
    ["public", "orders", "crea i propri", "INSERT", "{authenticated}", "", "((select auth.uid()) = user_id)"],
  ]);
  assert.deepEqual(findings, []);
});

test("regola 2: using (true) → issue", () => {
  const findings = regolaPolicy([
    ["public", "products", "tutti leggono", "SELECT", "{anon}", "true", ""],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
});

test("regola 2: auth.uid() non avvolto in (select ...) → warn", () => {
  const findings = regolaPolicy([
    ["public", "orders", "legge i propri", "SELECT", "{authenticated}", "(auth.uid() = user_id)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.match(findings[0].message, /auth\.uid\(\)/);
});

test("regola 2: join dentro la policy → warn", () => {
  const findings = regolaPolicy([
    ["public", "invoices", "membri", "SELECT", "{authenticated}",
      "(exists (select 1 from memberships m join orgs o on o.id = m.org_id))", ""],
  ]);
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.match(findings[0].message, /join/);
});

test("regola 2: policy senza ruolo esplicito → warn", () => {
  const findings = regolaPolicy([
    ["public", "orders", "senza ruolo", "SELECT", "{public}", "((select auth.uid()) = user_id)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.match(findings[0].message, /ruolo esplicito/);
});

// ─── regola 3 — viste che scavalcano la RLS ──────────────────────────────────

test("regola 3: vista senza security_invoker → block", () => {
  const findings = regolaViste([["public", "vista_scoperta", "v", ""]]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].hint, /security_invoker = on/);
});

test("regola 3: vista con security_invoker = on → nessun finding", () => {
  assert.deepEqual(regolaViste([["public", "catalogo_pubblico", "v", "security_invoker=on"]]), []);
});

test("regola 3: vista materializzata in schema esposto → issue", () => {
  const findings = regolaViste([["public", "riepilogo", "m", ""]]);
  assert.deepEqual(gravita(findings), ["issue"]);
});

// ─── regola 4 — security definer senza search_path ───────────────────────────

test("regola 4: security definer senza search_path → block", () => {
  const findings = regolaFunzioni([["public", "funzione_scoperta", ""]]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.funzione_scoperta()");
});

test("regola 4: security definer con search_path fisso → nessun finding", () => {
  assert.deepEqual(regolaFunzioni([["public", "ordine_del_chiamante", "search_path="]]), []);
});

// ─── regola 5 — chiavi esterne senza indice ──────────────────────────────────
// La query filtra gia' le FK indicizzate: ogni riga che arriva qui e' un difetto.

test("regola 5: chiave esterna senza indice → issue", () => {
  const findings = regolaChiaviEsterne([["public", "figli", "padre_id"]]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.equal(findings[0].object, "figli.padre_id");
  assert.match(findings[0].hint, /create index on figli \(padre_id\);/);
});

test("regola 5: nessuna FK scoperta → nessun finding", () => {
  assert.deepEqual(regolaChiaviEsterne([]), []);
});

// ─── regola 6 — colonne usate nelle policy senza indice ──────────────────────

const catalogoDocumenti = (indicizzate, colonne) => ({
  policy: [
    ["public", "documenti", "proprietario legge", "SELECT", "{authenticated}",
      "((select auth.uid()) = owner_id)", ""],
  ],
  colonne: colonne ?? [
    ["public", "documenti", "id"],
    ["public", "documenti", "owner_id"],
    ["public", "documenti", "titolo"],
  ],
  indicizzate,
});

test("regola 6: colonna di policy non indicizzata → warn", () => {
  const findings = regolaColonneDiPolicy(catalogoDocumenti([]));
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.equal(findings[0].object, "public.documenti.owner_id");
});

test("regola 6: colonna di policy indicizzata → nessun finding", () => {
  const findings = regolaColonneDiPolicy(catalogoDocumenti([["public.documenti.owner_id"]]));
  assert.deepEqual(findings, []);
});

// ─── composizione ────────────────────────────────────────────────────────────

test("auditAll compone le sei regole nell'ordine del report", () => {
  const findings = auditAll({
    tabelle: [["public", "nuda", "false", "0"]],
    policy: [["public", "documenti", "p", "SELECT", "{authenticated}", "((select auth.uid()) = owner_id)", ""]],
    viste: [["public", "vista_scoperta", "v", ""]],
    funzioni: [["public", "funzione_scoperta", ""]],
    chiaviEsterne: [["public", "figli", "padre_id"]],
    colonne: [["public", "documenti", "owner_id"]],
    indicizzate: [],
  });
  assert.deepEqual(
    findings.map((f) => f.object),
    ["public.nuda", "public.vista_scoperta", "public.funzione_scoperta()",
      "figli.padre_id", "public.documenti.owner_id"]
  );
});

// ─── REGRESSIONE — bug n°2 del collaudo: cast booleano ───────────────────────
// `boolean::text` in Postgres rende 'true'/'false'; senza cast psql rende 't'/'f'.
// Confrontare solo con "t" faceva segnalare OGNI tabella come priva di RLS.

test("regressione cast booleano: 'true' e 't' valgono entrambi RLS attiva", () => {
  for (const resa of ["true", "t"]) {
    assert.deepEqual(
      regolaTabelle([["public", "orders", resa, "2"]]), [],
      `la resa booleana ${resa} deve valere RLS attiva`
    );
  }
});

test("regressione cast booleano: 'false' e 'f' valgono entrambi RLS spenta", () => {
  for (const resa of ["false", "f"]) {
    assert.deepEqual(
      gravita(regolaTabelle([["public", "nuda", resa, "0"]])), ["block"],
      `la resa booleana ${resa} deve valere RLS spenta`
    );
  }
});

// ─── REGRESSIONE — bug n°1 del collaudo: CRLF di psql su Windows ─────────────
// L'ultimo campo di ogni riga arrivava con un \r in coda: "owner_id\r" non
// corrispondeva mai al nome della colonna dentro l'espressione della policy,
// e la regola 6 non scattava MAI.

test("regressione CRLF: un nome di colonna con \\r in coda scatta comunque", () => {
  const findings = regolaColonneDiPolicy(catalogoDocumenti([], [
    ["public", "documenti", "id"],
    ["public", "documenti", "owner_id\r"],
  ]));
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.equal(findings[0].object, "public.documenti.owner_id"); // niente \r nel report
});

test("regressione CRLF: il \\r non deve nemmeno far mancare l'indice esistente", () => {
  const findings = regolaColonneDiPolicy(catalogoDocumenti([["public.documenti.owner_id\r"]], [
    ["public", "documenti", "owner_id"],
  ]));
  assert.deepEqual(findings, []);
});

test("regressione CRLF: il \\r nella resa booleana non spegne la regola 1", () => {
  assert.deepEqual(regolaTabelle([["public", "orders", "true\r", "2"]]), []);
});
