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
import { describe, it, test } from "node:test";

import {
  auditAll,
  motivoAritaSbagliata,
  motivoPremessaVuota,
  premesseDaCatalogo,
  recordDiAritaSbagliata,
  righeDaPsql,
  regolaChiaviEsterne,
  regolaColonnaDiPrivilegio,
  regolaColonneDiPolicy,
  regolaFunzioni,
  regolaGrant,
  regolaLetturaPerScrittura,
  regolaPolicy,
  regolaStatoIniziale,
  regolaTabelle,
  regolaTestNegativi,
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

// ─── regola 2: `with check` OMESSO su una scrittura ──────────────────────────
// Verificato su Postgres reale il 2026-07-27, perche' la versione ingenua di
// questa regola e' SBAGLIATA: quando `with check` manca su `update`/`all`,
// Postgres usa `using` anche come controllo sulla riga nuova. Segnalare la sola
// assenza di `with check` significherebbe segnalare il codice corretto.

test("using (true) su update senza with check → block (il controllo effettivo e' true)", () => {
  const findings = regolaPolicy([
    ["public", "orders", "aggiorna tutto", "UPDATE", "{authenticated}", "true", ""],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /anche come controllo sulla riga nuova/);
  assert.match(findings[0].hint, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
});

test("using (true) su update senza with check non produce ANCHE l'issue: un difetto, un finding", () => {
  const findings = regolaPolicy([
    ["public", "orders", "aggiorna tutto", "ALL", "{authenticated}", "true", ""],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
});

test("update con ownership in using e senza with check → nessun finding (Postgres eredita il controllo)", () => {
  // `for update using ((select auth.uid()) = user_id)` senza `with check`:
  // provato sul database, il dirottamento della riga viene RIFIUTATO.
  const findings = regolaPolicy([
    ["public", "orders", "aggiorna i propri", "UPDATE", "{authenticated}",
      "((select auth.uid()) = user_id)", ""],
  ]);
  assert.deepEqual(findings, []);
});

test("insert senza with check → issue: nessun inserimento passera' mai", () => {
  // Su `insert` non c'e' `using` da cui ereditare: Postgres NEGA («new row
  // violates row-level security policy»). Non e' un buco, e' un guasto muto.
  const findings = regolaPolicy([
    ["public", "orders", "crea", "INSERT", "{authenticated}", "", ""],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].message, /nessun inserimento/);
});

// ─── regola 2: `user_metadata` in una policy ─────────────────────────────────

test("user_metadata in una policy → block", () => {
  const findings = regolaPolicy([
    ["public", "orders", "admin", "SELECT", "{authenticated}",
      "(((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = 'admin'::text)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /auto-promozione/);
  assert.match(findings[0].hint, /app_metadata/);
});

test("raw_user_meta_data nel with_check → block anche li'", () => {
  const findings = regolaPolicy([
    ["public", "orders", "admin scrive", "INSERT", "{authenticated}", "",
      "((select raw_user_meta_data ->> 'role' from auth.users where id = (select auth.uid())) = 'admin')"],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
});

test("app_metadata in una policy → nessun finding: quella la scrive solo il server", () => {
  const findings = regolaPolicy([
    ["public", "orders", "admin", "SELECT", "{authenticated}",
      "(((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)", ""],
  ]);
  assert.deepEqual(findings, []);
});

// ─── regola 2: `auth.role()` in una policy ───────────────────────────────────

test("auth.role() in una policy → block", () => {
  const findings = regolaPolicy([
    ["public", "orders", "solo autenticati", "DELETE", "{authenticated}",
      "(auth.role() = 'authenticated'::text)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /anonimi/);
  assert.match(findings[0].hint, /to authenticated/);
});

test("auth.roles del dominio non e' auth.role(): nessun falso positivo", () => {
  // Una colonna o una funzione che si chiama `roles` non deve far scattare
  // la regola: si cerca la chiamata `auth.role()`, non la parola.
  const findings = regolaPolicy([
    ["public", "orders", "per ruolo", "SELECT", "{authenticated}",
      "(public.auth_roles((select auth.uid())) @> array['staff'])", ""],
  ]);
  assert.deepEqual(findings, []);
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

// `block` dal 2026-07-27: provato su Postgres reale, `alter materialized view
// ... set (security_invoker = on)` risponde «unrecognized parameter
// "security_invoker"». Una MV e' quindi strettamente peggiore di una vista
// nuda, che era gia' `block`, e passava il gate.
test("regola 3: vista materializzata in schema esposto → block", () => {
  const findings = regolaViste([["public", "riepilogo", "m", ""]]);
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /security_invoker/);
});

test("regola 3: una MV fuori dagli schemi esposti non arriva qui (la query non la porta)", () => {
  assert.deepEqual(regolaViste([]), []);
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

// ─── regola 4b — security definer eseguibile da PUBLIC ───────────────────────
// Le rese di `proacl::text` sono quelle lette su Postgres reale il 2026-07-27,
// non forme immaginate: privilegi di default → NULL (quindi '' col coalesce);
// dopo il revoke → {postgres=X/postgres}; col grant a public → il grantee vuoto.

test("regola 4b: privilegi di default (proacl vuoto) → issue, la esegue anche anon", () => {
  const findings = regolaFunzioni([["public", "rpc_aperta", "search_path=", ""]]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].message, /PUBLIC/);
  assert.match(findings[0].hint, /revoke execute on function public\.rpc_aperta from public;/);
});

test("regola 4b: grantee vuoto nell'ACL = PUBLIC → issue", () => {
  const findings = regolaFunzioni([
    ["public", "rpc_aperta", "search_path=", "{postgres=X/postgres,=X/postgres}"],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
});

test("regola 4b: execute revocato a public → nessun finding", () => {
  assert.deepEqual(
    regolaFunzioni([["public", "rpc_chiusa", "search_path=", "{postgres=X/postgres}"]]), []
  );
});

test("regola 4b: revocato a public e concesso a authenticated → nessun finding", () => {
  assert.deepEqual(
    regolaFunzioni([
      ["public", "rpc_chiusa", "search_path=", "{postgres=X/postgres,authenticated=X/postgres}"],
    ]), []
  );
});

test("regola 4b: senza il campo ACL non si inventa un verdetto", () => {
  // La riga a tre campi e' quella delle query vecchie: l'assenza del campo non
  // e' un ACL vuoto. Stesso criterio di `force` nella regola 1.
  assert.deepEqual(regolaFunzioni([["public", "rpc", "search_path="]]), []);
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

// ─── regola 2f — scrittura senza lettura per gli stessi ruoli ────────────────
// In Postgres un `update` deve prima selezionare la riga: senza policy di
// `select` per gli stessi ruoli l'operazione torna 0 righe e NON da' errore.

test("update senza alcuna policy di select → issue", () => {
  const findings = regolaLetturaPerScrittura([
    ["public", "orders", "aggiorna i propri", "UPDATE", "authenticated",
      "((select auth.uid()) = user_id)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].message, /0 righe SENZA errore/);
  assert.match(findings[0].hint, /for select to authenticated/);
});

test("update con la sua policy di select per lo stesso ruolo → nessun finding", () => {
  assert.deepEqual(regolaLetturaPerScrittura([
    ["public", "orders", "legge i propri", "SELECT", "authenticated", "((select auth.uid()) = user_id)", ""],
    ["public", "orders", "aggiorna i propri", "UPDATE", "authenticated", "((select auth.uid()) = user_id)", ""],
  ]), []);
});

test("ruoli disgiunti: update per authenticated e select per anon → issue comunque", () => {
  // Il caso che rende la regola non banale: la policy di select ESISTE, ma non
  // per il ruolo che scrive. Chi aggiorna continua a non vedere la riga.
  const findings = regolaLetturaPerScrittura([
    ["public", "orders", "anon legge", "SELECT", "anon", "(is_public)", ""],
    ["public", "orders", "aggiorna i propri", "UPDATE", "authenticated", "((select auth.uid()) = user_id)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].object, /aggiorna i propri/);
});

test("una policy `all` copre la lettura della scrittura", () => {
  assert.deepEqual(regolaLetturaPerScrittura([
    ["public", "orders", "tutto ai propri", "ALL", "authenticated", "((select auth.uid()) = user_id)", ""],
    ["public", "orders", "cancella i propri", "DELETE", "authenticated", "((select auth.uid()) = user_id)", ""],
  ]), []);
});

test("una select senza ruolo esplicito (`public`) copre qualunque ruolo che scrive", () => {
  assert.deepEqual(regolaLetturaPerScrittura([
    ["public", "orders", "legge", "SELECT", "public", "true", ""],
    ["public", "orders", "cancella i propri", "DELETE", "authenticated", "((select auth.uid()) = user_id)", ""],
  ]), []);
});

test("la select di un'ALTRA tabella non copre questa", () => {
  const findings = regolaLetturaPerScrittura([
    ["public", "altro", "legge", "SELECT", "authenticated", "true", ""],
    ["public", "orders", "aggiorna", "UPDATE", "authenticated", "((select auth.uid()) = user_id)", ""],
  ]);
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].object, /public\.orders/);
});

// ─── regola 7 — la policy promette, il privilegio non concede ────────────────
// `privilegi` arriva da `has_any_column_privilege` (rls-audit.mjs, query 7): una
// riga [schema, tabella, ruolo, privilegio] ESISTE solo se il ruolo quel
// privilegio ce l'ha davvero, a livello di tabella o di colonna. Verificato su
// Postgres 17.6 reale il 2026-08-03 sul banco veterinario.

const TABELLA_CON_POLICY = [["public", "orders", "true", "3", "true"]];
const POLICY_LETTURA_ANON = [
  ["public", "orders", "chiunque legge", "SELECT", "anon,authenticated", "true", ""],
];

test("regola 7: policy di select per anon ma anon non ha select → block", () => {
  const findings = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: POLICY_LETTURA_ANON,
    privilegi: [["public", "orders", "authenticated", "SELECT"]], // anon: niente
  });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.orders → anon");
  assert.match(findings[0].message, /NESSUN privilegio CRUD/);
  assert.match(findings[0].hint, /grant select on public\.orders to anon;/);
});

test("regola 7: i grant giusti per tutti i ruoli promessi → nessun finding", () => {
  assert.deepEqual(regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: POLICY_LETTURA_ANON,
    privilegi: [
      ["public", "orders", "anon", "SELECT"],
      ["public", "orders", "authenticated", "SELECT"],
    ],
  }), []);
});

// Il caso che ha fatto nascere questa riscrittura: l'immagine Supabase nuova
// concede `Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN — zero CRUD). La
// tabella compariva lo stesso in `role_table_grants`, e la regola vecchia la
// PROMUOVEVA. Qui `privilegi` non ha nessuna riga per quella tabella, perche'
// nessuno dei quattro privilegi CRUD e' posseduto: e' il difetto, non l'assenza
// della query.
test("regola 7: il caso `Dxtm` — solo TRUNCATE/REFERENCES/TRIGGER → block su entrambi i ruoli", () => {
  const findings = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: POLICY_LETTURA_ANON,
    privilegi: [],
  });
  assert.deepEqual(gravita(findings), ["block", "block"]);
  assert.deepEqual(findings.map((f) => f.object),
    ["public.orders → anon", "public.orders → authenticated"]);
});

test("regola 7: promessa parziale — c'e' il select, manca l'update → block con l'elenco", () => {
  const findings = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: [
      ["public", "orders", "legge i propri", "SELECT", "authenticated", "true", ""],
      ["public", "orders", "aggiorna i propri", "UPDATE", "authenticated", "true", "true"],
    ],
    privilegi: [["public", "orders", "authenticated", "SELECT"]],
  });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /manca `update`/);
  assert.doesNotMatch(findings[0].message, /select/);
});

// Il falso positivo peggiore da evitare: `grant update (colonna)` e' la difesa
// che questa skill PRESCRIVE contro l'auto-promozione, e non compare in
// `relacl` (../../DECISIONI.md §22). Con `has_table_privilege` al posto di
// `has_any_column_privilege` la forma corretta risulterebbe un difetto.
test("regola 7: un `grant update (colonna)` soddisfa la promessa di update → nessun finding", () => {
  assert.deepEqual(regolaGrant({
    tabelle: [["public", "staff", "true", "2", "true"]],
    policy: [
      ["public", "staff", "legge", "SELECT", "authenticated", "true", ""],
      ["public", "staff", "corregge i recapiti", "UPDATE", "authenticated", "true", "true"],
    ],
    privilegi: [
      ["public", "staff", "authenticated", "SELECT"],
      ["public", "staff", "authenticated", "UPDATE"], // solo su (full_name, phone)
    ],
  }), []);
});

test("regola 7: una policy `for all` promette tutti e quattro i privilegi", () => {
  const findings = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: [["public", "orders", "lo staff fa tutto", "ALL", "authenticated", "true", "true"]],
    privilegi: [
      ["public", "orders", "authenticated", "SELECT"],
      ["public", "orders", "authenticated", "INSERT"],
    ],
  });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.match(findings[0].message, /manca `update, delete`/);
});

test("regola 7: una policy senza `to` (ruolo `public`) promette a entrambi i ruoli", () => {
  const findings = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: [["public", "orders", "senza to", "SELECT", "{public}", "true", ""]],
    privilegi: [["public", "orders", "anon", "SELECT"]],
  });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.orders → authenticated");
});

test("regola 7: una tabella che ha gia' il suo finding non ne prende un secondo", () => {
  // RLS spenta o zero policy: la regola 1 ha gia' parlato, qui si tace.
  assert.deepEqual(regolaGrant({
    tabelle: [["public", "nuda", "false", "0"], ["public", "senza_policy", "true", "0"]],
    policy: POLICY_LETTURA_ANON,
    privilegi: [],
  }), []);
});

// `service_role` non compare mai in una policy (ha `bypassrls`): questa regola
// non lo giudica, e non deve inventarsi che gli manchi qualcosa.
test("regola 7: una policy per il solo `service_role` non promette niente ai ruoli del client", () => {
  assert.deepEqual(regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: [["public", "orders", "servizio", "SELECT", "service_role", "true", ""]],
    privilegi: [],
  }), []);
});

// L'elenco dei mancanti e' in ordine canonico CRUD, non nell'ordine in cui il
// catalogo ha restituito le policy: due esecuzioni sullo stesso database devono
// produrre lo stesso messaggio, o il gate non si confronta con se' stesso.
test("regola 7: l'elenco dei privilegi mancanti non dipende dall'ordine delle policy", () => {
  const alRovescio = regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: [
      ["public", "orders", "d", "DELETE", "authenticated", "true", ""],
      ["public", "orders", "u", "UPDATE", "authenticated", "true", "true"],
      ["public", "orders", "i", "INSERT", "authenticated", "", "true"],
      ["public", "orders", "s", "SELECT", "authenticated", "true", ""],
    ],
    privilegi: [["public", "orders", "authenticated", "SELECT"]],
  });
  // ordine di inserimento: delete, update, insert — ordine canonico: il contrario
  assert.match(alRovescio[0].message, /manca `insert, update, delete`/);
});

test("regola 7: senza la query dei privilegi non si inventa un verdetto", () => {
  assert.deepEqual(regolaGrant({
    tabelle: TABELLA_CON_POLICY,
    policy: POLICY_LETTURA_ANON,
  }), []);
});

// ─── composizione ────────────────────────────────────────────────────────────

test("auditAll compone le regole nell'ordine del report", () => {
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

// ─── force row level security (references/rls-supabase.md) ───────────────────
// `enable` non vale per il proprietario della tabella ne' per chi ha BYPASSRLS:
// senza `force`, una funzione che gira come proprietario legge tutto.
// La riga porta il campo in coda: [schema, tabella, rls, numeroPolicy, force].

test("force RLS assente su una tabella con RLS attiva → warn", () => {
  const findings = regolaTabelle([["public", "orders", "true", "2", "false"]]);
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.equal(findings[0].object, "public.orders");
  assert.match(findings[0].hint, /force row level security/);
});

test("force RLS attiva → nessun finding", () => {
  assert.deepEqual(regolaTabelle([["public", "orders", "true", "2", "true"]]), []);
});

test("force RLS non si giudica su una tabella che gia' e' un block", () => {
  // Una tabella senza RLS ha gia' il suo block: aggiungere il warn e' rumore.
  const findings = regolaTabelle([["public", "nuda", "false", "0", "false"]]);
  assert.deepEqual(gravita(findings), ["block"]);
});

// ─── regola 6, esenzione dei booleani ────────────────────────────────────────
// Su un booleano a bassa cardinalita' l'indice pieno e' quasi inutile, e
// references/modellazione.md dice di non indicizzare "per sicurezza".
// La riga delle colonne porta il tipo in coda: [schema, tabella, colonna, tipo].

test("regola 6: colonna booleana di policy non indicizzata → nessun finding", () => {
  const findings = regolaColonneDiPolicy({
    policy: [["public", "products", "catalogo pubblico", "SELECT", "{anon}", "(is_published)", ""]],
    colonne: [
      ["public", "products", "id", "uuid"],
      ["public", "products", "is_published", "boolean"],
    ],
    indicizzate: [],
  });
  assert.deepEqual(findings, []);
});

test("regola 6: sulle colonne non booleane il suggerimento propone anche l'indice parziale", () => {
  const findings = regolaColonneDiPolicy({
    policy: [["public", "documenti", "p", "SELECT", "{authenticated}", "((select auth.uid()) = owner_id)", ""]],
    colonne: [["public", "documenti", "owner_id", "uuid"]],
    indicizzate: [],
  });
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.match(findings[0].hint, /create index on public\.documenti \(owner_id\);/);
  assert.match(findings[0].hint, /where/); // l'indice parziale, dove ha senso
});

// ─── regola 8 — auto-promozione via colonna ──────────────────────────────────
// Il Critical n°1 del collaudo del 2026-07-26, riprodotto sul banco con comandi
// reali il 2026-07-27: un veterinario di Biella vede 2 visite e 0 note interne;
// dopo `update public.staff set job_title = 'direttore'` sulla PROPRIA riga ne
// vede 6 e 1. La policy era corretta — la RLS filtra le righe, non le colonne.

const POLICY_SCRITTURA_PROPRIA = [
  ["public", "profili", "propria", "UPDATE", "{authenticated}",
    "(id = (select auth.uid()))", "(id = (select auth.uid()))"],
];
const COLONNE_PROFILI = [
  ["public", "profili", "id", "uuid"],
  ["public", "profili", "job_title", "text"],
];

test("regola 8: colonna di privilegio usata da una policy e scrivibile → block", () => {
  const findings = regolaColonnaDiPrivilegio({
    policy: [...POLICY_SCRITTURA_PROPRIA,
      ["public", "fatture", "solo direzione", "SELECT", "{authenticated}",
        "(EXISTS ( SELECT 1 FROM profili p WHERE (p.job_title = 'direttore')))", ""]],
    colonne: COLONNE_PROFILI,
    grantsScrittura: [["public", "profili"]],
    trigger: [],
    funzioni: [],
  });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.profili.job_title");
  assert.match(findings[0].hint, /grant update \(/);
});

test("regola 8: la decisione dentro una funzione chiamata dalla policy vale come dentro la policy", () => {
  // sul banco `job_title` non compare in NESSUNA policy: sta nel corpo di
  // `puo_vedere_clinica()`, che le policy chiamano. Guardare solo il testo
  // delle policy avrebbe declassato il Critical a `issue`.
  const findings = regolaColonnaDiPrivilegio({
    policy: [...POLICY_SCRITTURA_PROPRIA,
      ["public", "fatture", "sede", "SELECT", "{authenticated}", "puo_vedere_clinica(clinic_id)", ""]],
    colonne: COLONNE_PROFILI,
    grantsScrittura: [["public", "profili"]],
    trigger: [],
    funzioni: [["public", "puo_vedere_clinica", "search_path=", "{postgres=X/postgres}",
      "select exists (select 1 from public.staff s where s.job_title = 'direttore')"]],
  });
  assert.deepEqual(gravita(findings), ["block"]);
});

test("regola 8: `grant update` per COLONNA difende → nessun finding", () => {
  // Provato su Postgres reale: con `grant update (nome) on t to authenticated`
  // l'update di `job_title` risponde «permission denied for table», e la
  // tabella NON compare in `role_table_grants` — e' quello il segnale.
  assert.deepEqual(regolaColonnaDiPrivilegio({
    policy: POLICY_SCRITTURA_PROPRIA,
    colonne: COLONNE_PROFILI,
    grantsScrittura: [], // nessun grant sull'intera tabella
    trigger: [],
    funzioni: [],
  }), []);
});

test("regola 8: un trigger su update che nomina la colonna difende → nessun finding", () => {
  assert.deepEqual(regolaColonnaDiPrivilegio({
    policy: POLICY_SCRITTURA_PROPRIA,
    colonne: COLONNE_PROFILI,
    grantsScrittura: [["public", "profili"]],
    trigger: [["public", "profili", "blocca_promozione", "false", "true",
      "begin if new.job_title <> old.job_title then raise exception 'no'; end if; return new; end"]],
    funzioni: [],
  }), []);
});

test("regola 8: nome di privilegio che nessuna policy usa → issue, e l'euristica e' dichiarata", () => {
  const findings = regolaColonnaDiPrivilegio({
    policy: POLICY_SCRITTURA_PROPRIA,
    colonne: COLONNE_PROFILI,
    grantsScrittura: [["public", "profili"]],
    trigger: [],
    funzioni: [],
  });
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.match(findings[0].message, /euristica sul nome/);
});

test("regola 8: una colonna qualunque non e' una colonna di privilegio", () => {
  assert.deepEqual(regolaColonnaDiPrivilegio({
    policy: POLICY_SCRITTURA_PROPRIA,
    colonne: [["public", "profili", "note", "text"], ["public", "profili", "telefono", "text"]],
    grantsScrittura: [["public", "profili"]],
    trigger: [],
    funzioni: [],
  }), []);
});

test("regola 8: senza la query dei grant non si inventa nessun verdetto", () => {
  assert.deepEqual(regolaColonnaDiPrivilegio({
    policy: POLICY_SCRITTURA_PROPRIA, colonne: COLONNE_PROFILI,
    grantsScrittura: undefined, trigger: [], funzioni: [],
  }), []);
});

// ─── regola 9 — macchina a stati vincolata solo in `update` ──────────────────
// Provato: col trigger di transizione attivo, `insert into ordini (id, stato)
// values (1, 'pagato')` passa senza un fiato. Il trigger non scatta su insert.

const POLICY_INSERIMENTO = [
  ["public", "ordini", "crea", "INSERT", "{authenticated}", "", "(cliente_id = (select auth.uid()))"],
];
const TRIGGER_TRANSIZIONE = ["public", "ordini", "transizione", "false", "true",
  "begin if old.stato = 'pagato' and new.stato <> 'pagato' then raise exception 'non si riapre'; end if; return new; end"];

test("regola 9: trigger di transizione solo su update, nessun check → issue", () => {
  const findings = regolaStatoIniziale({
    policy: POLICY_INSERIMENTO, trigger: [TRIGGER_TRANSIZIONE], vincoli: [],
  });
  assert.deepEqual(gravita(findings), ["issue"]);
  assert.equal(findings[0].object, "public.ordini.stato");
  assert.match(findings[0].hint, /check \(stato =/);
});

test("regola 9: un `check` sullo stato iniziale difende → nessun finding", () => {
  assert.deepEqual(regolaStatoIniziale({
    policy: POLICY_INSERIMENTO,
    trigger: [TRIGGER_TRANSIZIONE],
    vincoli: [["public", "ordini", "ordini_nasce_bozza", "CHECK ((stato = 'bozza'::stato_ordine))"]],
  }), []);
});

test("regola 9: un `check` che enumera il DOMINIO non e' un vincolo sullo stato iniziale", () => {
  // il caso vero del banco veterinario: `check (status = any (array[<tutti e
  // cinque gli stati>]))` permette di nascere gia' `fatturata`. Trattarlo come
  // difesa rendeva la regola muta proprio sul difetto che doveva trovare.
  const findings = regolaStatoIniziale({
    policy: POLICY_INSERIMENTO,
    trigger: [TRIGGER_TRANSIZIONE],
    vincoli: [["public", "ordini", "ordini_stato_check",
      "CHECK ((stato = ANY (ARRAY['bozza'::text, 'emesso'::text, 'pagato'::text])))"]],
  });
  assert.deepEqual(gravita(findings), ["issue"]);
});

test("regola 9: lo stesso trigger anche su insert difende → nessun finding", () => {
  assert.deepEqual(regolaStatoIniziale({
    policy: POLICY_INSERIMENTO,
    trigger: [["public", "ordini", "transizione", "true", "true", TRIGGER_TRANSIZIONE[5]]],
    vincoli: [],
  }), []);
});

test("regola 9: un trigger `updated_at` non e' una macchina a stati", () => {
  // sul banco veterinario ce ne sono diciotto: senza il filtro sul `raise`
  // questa regola sarebbe stata diciotto findings di puro rumore.
  assert.deepEqual(regolaStatoIniziale({
    policy: POLICY_INSERIMENTO,
    trigger: [["public", "ordini", "ordini_updated_at", "false", "true",
      "begin new.updated_at := now(); return new; end"]],
    vincoli: [],
  }), []);
});

test("regola 9: un trigger di archiviazione che non rifiuta niente non e' una transizione", () => {
  // il trigger delle cartelle cliniche del banco: confronta `old.` e `new.` su
  // due colonne e scrive una revisione. Nessun `raise`, nessun finding.
  assert.deepEqual(regolaStatoIniziale({
    policy: POLICY_INSERIMENTO,
    trigger: [["public", "ordini", "archivia", "false", "true",
      "begin if new.testo is distinct from old.testo then insert into revisioni values (old.id, old.testo); end if; return new; end"]],
    vincoli: [],
  }), []);
});

test("regola 9: nessuna policy di inserimento → la macchina non e' aggirabile dal client", () => {
  assert.deepEqual(regolaStatoIniziale({
    policy: [["public", "ordini", "legge", "SELECT", "{authenticated}", "true", ""]],
    trigger: [TRIGGER_TRANSIZIONE], vincoli: [],
  }), []);
});

// ─── regola 10 — policy di scrittura mai attaccate da un test ────────────────
// Il blocco n°1: sullo schema che il gate dichiarava VERDE, il tribunale ha
// riprodotto 16 difetti su 17. Nessuno strumento guarda la semantica di una
// policy; l'unica prova che una policy funziona e' averla attaccata.

const POLICY_DI_SCRITTURA = [
  ["public", "ordini", "crea", "INSERT", "{authenticated}", "", "(cliente_id = (select auth.uid()))"],
  ["public", "ordini", "legge", "SELECT", "{authenticated}", "(cliente_id = (select auth.uid()))", ""],
];

test("regola 10: tabella scrivibile senza nessun test che la attacca → block", () => {
  const findings = regolaTestNegativi({ policy: POLICY_DI_SCRITTURA, testiPgtap: [] });
  assert.deepEqual(gravita(findings), ["block"]);
  assert.equal(findings[0].object, "public.ordini");
  assert.match(findings[0].message, /ipotesi non verificata/);
});

test("regola 10: un test che impersona e tenta la scrittura basta → nessun finding", () => {
  assert.deepEqual(regolaTestNegativi({
    policy: POLICY_DI_SCRITTURA,
    testiPgtap: [{
      nome: "rls.test.sql",
      testo: "set local role authenticated;\nset local request.jwt.claims = '{\"sub\":\"x\"}';\n" +
        "insert into public.ordini (id) values (1);\nselect is((select count(*) from public.ordini)::bigint, 0::bigint, 'rifiutato');",
    }],
  }), []);
});

test("regola 10: un'asserzione che NON usa throws_ok vale lo stesso", () => {
  // il test negativo gia' scritto sul banco asserisce che la visita e' RIMASTA
  // `prenotata` (conteggio 1, non 0). Pretendere `throws_ok` o «righe = 0»
  // avrebbe segnalato come mancante un test negativo corretto.
  assert.deepEqual(regolaTestNegativi({
    policy: [["public", "visits", "modifica", "UPDATE", "{authenticated}", "true", "true"]],
    testiPgtap: [{
      nome: "rls.test.sql",
      testo: "set local role authenticated;\nupdate public.visits set status = 'confermata' where id = 'x';\n" +
        "select is((select count(*) from public.visits where status = 'prenotata')::bigint, 1::bigint, 'non si conferma da solo');",
    }],
  }), []);
});

test("regola 10: un test che legge soltanto non e' un attacco", () => {
  const findings = regolaTestNegativi({
    policy: POLICY_DI_SCRITTURA,
    testiPgtap: [{ nome: "letture.test.sql",
      testo: "set local role authenticated;\nselect is((select count(*) from public.ordini)::bigint, 2::bigint, 'vede i suoi');" }],
  });
  assert.deepEqual(gravita(findings), ["block"]);
});

test("regola 10: una scrittura SENZA impersonare un ruolo non conta", () => {
  // eseguita da `postgres` non prova niente sulle policy: `postgres` le scavalca
  const findings = regolaTestNegativi({
    policy: POLICY_DI_SCRITTURA,
    testiPgtap: [{ nome: "seed.test.sql", testo: "insert into public.ordini (id) values (1);" }],
  });
  assert.deepEqual(gravita(findings), ["block"]);
});

test("regola 10: `ordini_ok` non copre `ordini` (il confine di parola conta)", () => {
  const findings = regolaTestNegativi({
    policy: POLICY_DI_SCRITTURA,
    testiPgtap: [{ nome: "t.sql",
      testo: "set local role authenticated;\ninsert into public.ordini_ok (id) values (1);" }],
  });
  assert.deepEqual(gravita(findings), ["block"]);
});

test("regola 10: una tabella di sola lettura non deve nessun test di scrittura", () => {
  assert.deepEqual(regolaTestNegativi({
    policy: [["public", "listino", "legge", "SELECT", "{anon}", "true", ""]],
    testiPgtap: [],
  }), []);
});

test("regola 10: senza `--tests` la regola tace, non assolve", () => {
  // nessun verdetto inventato: se i test non sono stati letti, la regola non
  // sa niente — stesso criterio di `grants` e di `force row level security`.
  assert.deepEqual(regolaTestNegativi({ policy: POLICY_DI_SCRITTURA, testiPgtap: null }), []);
});

// ─── parsing dell'uscita di psql — bug del 2026-07-26 ────────────────────────
// Regressione permanente: dividere per riga anziche' per record spezzava ogni
// policy con una sottoquery (`pg_policies.qual` deparsato su piu' righe), i
// campi diventavano `undefined` e l'audit CRASHAVA. Il gate lo registrava come
// verifica mancante: la sicurezza non veniva controllata proprio sugli schemi
// veri, che sono quelli con le policy complesse.

const US = "";
const RS = "";

test("un'espressione di policy su piu' righe resta UN solo record", () => {
  const stdout =
    `public${US}rimborsi${US}(EXISTS ( SELECT 1
   FROM pagamenti p
  WHERE (p.id = r.id)))${RS}` +
    `public${US}ordini${US}(uid() = owner_id)
`;
  const righe = righeDaPsql(stdout, US, RS);
  assert.equal(righe.length, 2);
  assert.equal(righe[0].length, 3);
  assert.match(righe[0][2], /FROM pagamenti p/);
  assert.equal(righe[1][2], "(uid() = owner_id)");
});

test("nessun campo undefined: e' cosi' che l'audit andava in crash", () => {
  const righe = righeDaPsql(`a${US}b${US}c
`, US, RS);
  assert.ok(righe[0].every((campo) => typeof campo === "string"));
});

test("CRLF di Windows in coda all'ultimo record non produce una riga vuota", () => {
  const righe = righeDaPsql(`a${US}b${RS}c${US}d
`, US, RS);
  assert.deepEqual(righe, [["a", "b"], ["c", "d"]]);
});

test("uscita vuota: zero righe, non un crash", () => {
  assert.deepEqual(righeDaPsql("", US, RS), []);
  assert.deepEqual(righeDaPsql(null, US, RS), []);
});

// ─── nomi del catalogo dentro una RegExp (semgrep, 2026-08-06) ───────────────
// `detect-non-literal-regexp` sulla regola 6: il nome della colonna arriva dal
// catalogo e finisce grezzo in `new RegExp`. Un identificatore citato puo'
// contenere qualunque carattere, e i due danni sono di specie diversa — uno
// uccide l'audit, l'altro lo fa mentire. Nessuno dei due era coperto.

test("regola 6: un nome di colonna che sarebbe una regex non valida non uccide l'audit", () => {
  const catalogo = {
    policy: [
      ["public", "documenti", "proprietario legge", "SELECT", "{authenticated}",
        '((select auth.uid()) = "piano(a")', ""],
    ],
    colonne: [
      ["public", "documenti", "id", "uuid"],
      ["public", "documenti", "piano(a", "text"],
    ],
    indicizzate: [],
  };
  // prima della correzione: SyntaxError da `new RegExp("\\bpiano(a\\b")`, e
  // `rls-audit.mjs` non cattura niente — il passo «audit RLS» moriva col trace
  const findings = regolaColonneDiPolicy(catalogo);
  assert.deepEqual(gravita(findings), ["warn"]);
  assert.equal(findings[0].object, "public.documenti.piano(a");
});

test("regola 6: i metacaratteri di un nome non fanno matchare una colonna che non c'e'", () => {
  const catalogo = {
    policy: [
      ["public", "documenti", "proprietario legge", "SELECT", "{authenticated}",
        "((select auth.uid()) = aaab)", ""],
    ],
    colonne: [
      ["public", "documenti", "id", "uuid"],
      ["public", "documenti", "a+b", "text"],
    ],
    indicizzate: [],
  };
  // prima della correzione: `\ba+b\b` matcha `aaab` → un warn su una colonna
  // che la policy non nomina affatto
  assert.deepEqual(regolaColonneDiPolicy(catalogo), []);
});

// ─── l'arita' dei record (referto § H5 e § M17, 2026-08-06) ──────────────────
// I due separatori sono byte di controllo, scelti perche' «non compaiono mai nei
// nomi degli oggetti»: vero per i NOMI, falso per il TESTO LIBERO. L'espressione
// di una policy, il corpo di una funzione e la definizione di un vincolo
// contengono qualunque byte. E' l'unico difetto che due concili del referto
// hanno trovato per due strade opposte.
//
// Riprodotto il 2026-08-06 sulle funzioni pure, con il record vero di
// `pg_policies` (7 campi: schema, tabella, nome, cmd, ruoli, qual, with_check):
//   sano                      → 2 findings, fra cui il `block` «with check (true)»
//   con un \x1f dentro `qual` → 1 finding e ZERO block: `with_check` slitta in
//                               nona posizione e nessuno la legge piu'
// e sul record di `pg_proc` (5 campi):
//   \x1f in `prosrc` → 6 campi invece di 5, corpo troncato
//   \x1e in `prosrc` → un record spezzato in due

describe("arita' dei record del catalogo", () => {
  const SEP = "\x1f";
  const REC = "\x1e";
  const record = (campi) => campi.join(SEP) + REC;

  it("un record sano non produce nessun rilievo di arita'", () => {
    const righe = righeDaPsql(record(["public", "ordini", "tutti", "ALL", "authenticated", "true", "true"]), SEP, REC);
    assert.deepEqual(recordDiAritaSbagliata(righe, 7), []);
  });

  it("un separatore dentro `qual` sposta le colonne, e ora si vede", () => {
    const ostile = record(["public", "ordini", "tutti", "ALL", "authenticated", `true${SEP}spostato`, "true"]);
    const righe = righeDaPsql(ostile, SEP, REC);
    assert.equal(righe[0].length, 8, "il record ha un campo in piu' del dovuto");
    // e la prova di cosa costava: senza il controllo, il `block` sparisce
    assert.equal(regolaPolicy(righe).filter((f) => f.severity === "block").length, 0,
      "e' esattamente cio' che rendeva invisibile un `with check (true)`");
    const rotti = recordDiAritaSbagliata(righe, 7);
    assert.equal(rotti.length, 1);
    assert.deepEqual(rotti[0], { indice: 0, quanti: 8 });
  });

  it("un separatore di RECORD dentro il corpo di una funzione spezza in due", () => {
    const fn = record(["public", "puo_vedere", "search_path=public,pg_temp", "", `select true${REC}altra riga`]);
    const righe = righeDaPsql(fn, SEP, REC);
    assert.equal(righe.length, 2, "un record solo e' diventato due");
    assert.equal(recordDiAritaSbagliata(righe, 5).length, 1, "e il secondo pezzo non ha 5 campi");
  });

  it("un separatore di CAMPO dentro il corpo di una funzione lo tronca", () => {
    const fn = record(["public", "puo_vedere", "search_path=public,pg_temp", "", `select true${SEP}coda`]);
    const righe = righeDaPsql(fn, SEP, REC);
    assert.equal(righe[0].length, 6);
    assert.equal(recordDiAritaSbagliata(righe, 5).length, 1);
  });

  it("un record con MENO campi e' rotto quanto uno con piu' campi", () => {
    const righe = righeDaPsql(record(["public", "ordini", "true"]), SEP, REC);
    assert.deepEqual(recordDiAritaSbagliata(righe, 5), [{ indice: 0, quanti: 3 }]);
  });

  it("nessun record: niente da rifiutare (una query puo' non trovare niente)", () => {
    assert.deepEqual(recordDiAritaSbagliata([], 7), []);
    assert.deepEqual(recordDiAritaSbagliata(righeDaPsql("", SEP, REC), 7), []);
  });

  it("il motivo dice quale query, quanti campi e cosa fare", () => {
    const motivo = motivoAritaSbagliata("policy", 7, [{ indice: 0, quanti: 8 }]);
    assert.match(motivo, /la query `policy`/);
    assert.match(motivo, /record 1: 8 campi invece di 7/);
    assert.match(motivo, /Verifica MANCANTE/);
  });

  it("con molti record rotti il motivo ne nomina tre e conta gli altri", () => {
    const rotti = [0, 1, 2, 3, 4].map((indice) => ({ indice, quanti: 8 }));
    assert.match(motivoAritaSbagliata("policy", 7, rotti), /e altri 2/);
  });
});

// ── la premessa non contata (referto § M12, 2026-08-06) ──────────────────────
// Il documento dell'audit aveva `ok`, `dbUrl`, `schemas`, `findings`, `summary`
// e ZERO campi di premessa: un audit che ha guardato zero tabelle produce zero
// findings e usciva `pass`, indistinguibile da uno schema pulito. E' il gemello
// esatto di «azioni server: 1» (§ H6), sul passo che la skill chiama «il
// controllo che non puo' mancare».

const CATALOGO_VUOTO = {
  tabelle: [], policy: [], viste: [], funzioni: [], colonne: [],
  chiaviEsterne: [], indicizzate: [], privilegi: [], grantsScrittura: [],
  trigger: [], vincoli: [], testiPgtap: null,
};

test("un catalogo vuoto produce zero findings — ed e' esattamente il difetto", () => {
  assert.deepEqual(auditAll(CATALOGO_VUOTO), []);
  assert.equal(premesseDaCatalogo(CATALOGO_VUOTO).tabelle, 0);
  assert.match(
    motivoPremessaVuota(premesseDaCatalogo(CATALOGO_VUOTO), ["public"]),
    /ZERO tabelle/,
  );
});

test("una tabella guardata basta a far tacere la premessa", () => {
  const catalogo = { ...CATALOGO_VUOTO, tabelle: [["public", "t", "true", "1", "false"]] };
  assert.equal(motivoPremessaVuota(premesseDaCatalogo(catalogo), ["public"]), null);
});

test("le premesse contano gli oggetti, non i findings", () => {
  const premesse = premesseDaCatalogo({
    ...CATALOGO_VUOTO,
    tabelle: [["public", "t", "true", "1", "false"]],
    policy: [["public", "t", "p", "SELECT", "authenticated", "true", ""]],
    viste: [["public", "v", "v", ""]],
    funzioni: [["public", "f", "", "", ""]],
    colonne: [["public", "t", "id", "uuid"]],
    testiPgtap: [{ nome: "a.sql", testo: "" }],
  });
  assert.deepEqual(premesse, {
    tabelle: 1, policy: 1, viste: 1, funzioniSecurityDefiner: 1,
    colonne: 1, chiaviEsterneSenzaIndice: 0, testiPgtap: 1,
  });
});
