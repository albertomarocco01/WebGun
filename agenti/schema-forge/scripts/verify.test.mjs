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
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTRATTO_JSON,
  ID,
  conRitentativo,
  contrattoUscita,
  dettaglioAdvisors,
  dettaglioReset,
  fileNonLintati,
  leggiAudit,
  limiteSqlfluff,
  normalizzaTipi,
  notaRifiuto,
  riepilogo,
  schemiEsposti,
  senzaCommentoToml,
  soloSql,
  urlDbProgetto,
  verdettoDa,
} from "./verify.mjs";
import { rigaPremesse } from "./audit-lib.mjs";

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

// -------------------------------------------------------- dettaglio advisors
// `supabase db advisors` risponde con un JSON da centinaia di righe (e la CLI
// ci mette davanti "Connecting to local database..." e l'avviso di versione).
// Nel dettaglio del gate serve una riga per regola, o non lo legge nessuno.

const USCITA_ADVISORS = `Connecting to local database...
[
  { "name": "auth_rls_initplan", "level": "WARN",
    "metadata": { "name": "t", "schema": "public" } },
  { "name": "auth_rls_initplan", "level": "WARN",
    "metadata": { "name": "t", "schema": "public" } },
  { "name": "rls_references_user_metadata", "level": "ERROR",
    "metadata": { "name": "ordini", "schema": "public" } }
]
A new version of Supabase CLI is available: v2.109.1`;

test("gli advisors si comprimono a una riga per regola, gli ERROR per primi", () => {
  assert.equal(
    dettaglioAdvisors(USCITA_ADVISORS),
    "[ERROR] rls_references_user_metadata (1): public.ordini\n" +
    "[WARN] auth_rls_initplan (2): public.t"
  );
});

test("nessun rilievo: lo dice, non stampa `[]`", () => {
  assert.equal(dettaglioAdvisors("Connecting to local database...\n[]\n"), "nessun rilievo");
});

test("uscita non-JSON (connessione rifiutata): si riporta grezza, non si perde", () => {
  const grezza = dettaglioAdvisors("failed to connect to postgres: connection refused");
  assert.match(grezza, /connection refused/);
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
  assert.deepEqual(schemiEsposti(CONFIG_REALE).schemi, ["public", "graphql_public"]);
});

test("uno schema secondario aggiunto a mano finisce nell'audit", () => {
  assert.deepEqual(
    schemiEsposti('[api]\nschemas = ["public", "privato"]\n').schemi,
    ["public", "privato"]
  );
});

// Fino al 2026-08-06 questo test asseriva l'opposto: «senza config leggibile si
// audita almeno public, mai niente». E' il § M12 del referto — il file ASSENTE
// non e' la chiave assente. La chiave assente ha un default che Supabase
// documenta; il file assente vuol dire che il gate non sa cosa PostgREST
// pubblichi, e stampare «schemi esposti: public» e' un audit parziale
// travestito da audit completo. Il progetto di uno schema-forge quel file ce
// l'ha sempre: e' la radice del progetto Supabase.
test("config.toml assente: l'audit non sa quali schemi guardare, e lo dice", () => {
  assert.deepEqual(schemiEsposti(null).schemi, []);
  assert.match(schemiEsposti(null).errore, /config\.toml assente o vuoto/);
  assert.match(schemiEsposti("").errore, /config\.toml assente o vuoto/);
  assert.match(schemiEsposti("   \n  ").errore, /config\.toml assente o vuoto/);
});

test("il file c'e' ma la chiave no: e' il default documentato di Supabase", () => {
  assert.deepEqual(schemiEsposti("[db]\nport = 54322\n"), { schemi: ["public"], errore: null });
});

test("una chiave `schemas` fuori da [api] non conta", () => {
  // `[storage] schemas` non esiste oggi, ma un config.toml futuro non deve
  // poter allargare l'audit di nascosto: conta solo cio' che espone l'API.
  assert.deepEqual(schemiEsposti('[db]\nschemas = ["interno"]\n').schemi, ["public"]);
});

test("la riga di commento che documenta `schemas` non viene letta come valore", () => {
  assert.deepEqual(
    schemiEsposti('[api]\n# schemas = ["sbagliato"]\nschemas = ["public"]\n').schemi,
    ["public"]
  );
});

// L'array TOML su piu' righe e' TOML valido e la CLI Supabase lo legge senza
// fiatare (provato il 2026-07-27 con `supabase status --workdir`). Il parser si
// fermava alla prima riga, non trovava `[...]` e ripiegava su `public` SENZA
// dirlo: uno schema secondario esposto restava inaudito e il gate stampava
// «schemi esposti: public» come se fosse la verita'.
test("`schemas` su piu' righe: si leggono tutti, non si ripiega su public", () => {
  assert.deepEqual(
    schemiEsposti('[api]\nschemas = [\n  "public",\n  "graphql_public",\n  "clinico"\n]\n').schemi,
    ["public", "graphql_public", "clinico"]
  );
});

test("`schemas` su piu' righe non si mangia la sezione successiva", () => {
  const config = '[api]\nschemas = [\n  "public"\n]\nport = 54321\n\n[db]\nport = 54322\n';
  assert.deepEqual(schemiEsposti(config).schemi, ["public"]);
  assert.equal(urlDbProgetto(config), "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
});

test("`schemas` presente ma illeggibile: e' una verifica mancante, non un successo su public", () => {
  const esito = schemiEsposti('[api]\nschemas = "public"\n');
  assert.deepEqual(esito.schemi, []);
  assert.match(esito.errore, /non interpretabile/);
});

test("`schemas` vuoto: nessuno schema, e lo dice", () => {
  const esito = schemiEsposti("[api]\nschemas = []\n");
  assert.deepEqual(esito.schemi, []);
  assert.match(esito.errore, /vuoto/);
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
const HANDOFF_VERDE = "# Handoff\n\nGate: VERDE (0 falliti su 9 passi)\n";

test("contratto completo: passa", () => {
  const esito = contrattoUscita(seEsistono(...TUTTI), () => HANDOFF_VERDE, "VERDE");
  assert.equal(esito.status, "pass");
  assert.equal(esito.detail, "");
});

test("configurazioni non copiate da forge: fallisce e le nomina entrambe", () => {
  const esito = contrattoUscita(seEsistono(HANDOFF), () => HANDOFF_VERDE, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /\.sqlfluff/);
  assert.match(esito.detail, /squawk\.toml/);
});

test("handoff assente: fallisce", () => {
  const esito = contrattoUscita(seEsistono(".sqlfluff", "squawk.toml"), () => "", "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /07-schema-forge\.md/);
});

test("handoff col template non compilato: fallisce (esistere non basta)", () => {
  const esito = contrattoUscita(seEsistono(...TUTTI), () => "# Handoff\n\n{{entita}}\n\nGate: VERDE\n", "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /segnaposto/);
});

// --------------------- l'handoff deve dichiarare il verdetto, e dire il vero
// Il buco che questo blocco chiude: sul banco veterinario l'handoff dichiarava
// «1 issue, 1 warn» — fermo a due giorni prima, muto sui due passi rossi — e il
// contratto d'uscita lo promuoveva `pass`. Cioe' il passo che esiste per far
// rispettare la Regola dei guardiani era cieco proprio su quella clausola.

test("handoff che tace il verdetto: fallisce, e dice quale riga serve", () => {
  const esito = contrattoUscita(
    seEsistono(...TUTTI),
    () => "# Handoff\n\n## Problemi noti\n\n1 issue e 1 warn, nessun bloccante.\n",
    "ROSSO"
  );
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara il verdetto/);
  assert.match(esito.detail, /Gate: ROSSO/);
});

test("riga `Gate:` vuota con VERDE a inizio riga seguente: non e' una firma", () => {
  // La forma misurata del buco: `\s` nel regex comprendeva l'a capo, quindi una
  // riga di template lasciata a meta' pescava il verdetto dalla riga dopo.
  const esito = contrattoUscita(
    seEsistono(...TUTTI),
    () => "# Handoff\n\nGate:\nVERDE era l'esito che speravamo.\n",
    "VERDE"
  );
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara il verdetto/);
});

test("handoff che dichiara VERDE su un gate ROSSO: fallisce (e' il caso del banco)", () => {
  const esito = contrattoUscita(
    seEsistono(...TUTTI),
    () => "# Handoff\n\nGate: VERDE, 9 passi su 9.\n",
    "ROSSO"
  );
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /un'altra esecuzione/);
});

test("handoff che dichiara il rosso su un gate rosso: passa — dichiarare non e' fallire", () => {
  const esito = contrattoUscita(
    seEsistono(...TUTTI),
    () => "- **Gate: ROSSO** (2 falliti, 0 verifiche mancanti su 9 passi)\n",
    "ROSSO"
  );
  assert.equal(esito.status, "pass");
});

test("la riga si riconosce dentro un elenco, una citazione o del grassetto", () => {
  for (const riga of ["Gate: VERDE", "- Gate: VERDE", "> Gate: VERDE", "**Gate:** VERDE", "  * **Gate**: verde"]) {
    assert.equal(
      contrattoUscita(seEsistono(...TUTTI), () => `# Handoff\n\n${riga}\n`, "VERDE").status,
      "pass",
      riga
    );
  }
});

test("`VERDE` scritto nella prosa non conta: serve la riga", () => {
  const esito = contrattoUscita(
    seEsistono(...TUTTI),
    () => "Il gate era VERDE quando l'ho lanciato ieri.\n",
    "VERDE"
  );
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara il verdetto/);
});

test("il verdetto atteso viene dai passi gia' eseguiti, non da un'opinione", () => {
  assert.equal(verdettoDa([{ status: "pass" }, { status: "pass" }]), "VERDE");
  assert.equal(verdettoDa([{ status: "pass" }, { status: "fail" }]), "ROSSO");
  // `skipped` = verifica mancante = gate rosso: vale anche qui
  assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
  assert.equal(verdettoDa([]), "VERDE");
});

// ------------------------------------- l'audit che non risponde in JSON
// `JSON.parse(audit.stdout)` era nudo: un guscio morto a meta' stampa faceva
// morire il GATE con un'eccezione. Un gate che crasha non e' ne' verde ne'
// rosso: e' assente, ed e' il peggiore dei tre.

test("uscita non-JSON dell'audit: verifica mancante, non un'eccezione", () => {
  const { parsed, errore } = leggiAudit("psql: error: connection refused");
  assert.equal(parsed, undefined);
  assert.match(errore, /non interpretabile come JSON/);
});

test("JSON valido ma senza il contratto dell'audit: verifica mancante", () => {
  assert.match(leggiAudit('{"altro": 1}').errore, /summary/);
  assert.match(leggiAudit('{"summary": {}}').errore, /findings/);
});

test("uscita regolare: si legge e basta", () => {
  const { parsed, errore } = leggiAudit('{"summary":{"block":1,"issue":0,"warn":2},"findings":[],"premesse":{"tabelle":18}}');
  assert.equal(errore, undefined);
  assert.equal(parsed.summary.block, 1);
});

// ── la premessa non contata (referto § M12, 2026-08-06) ──────────────────────
test("un audit senza `premesse` non rispetta il contratto, e non si usa", () => {
  const { parsed, errore } = leggiAudit('{"summary":{"block":0,"issue":0,"warn":0},"findings":[]}');
  assert.equal(parsed, undefined);
  assert.match(errore, /premesse\.tabelle/);
});

// ---------------------------------------------- tipi: cosa NON e' una differenza
// Il confronto era byte a byte sul testo grezzo: un BOM o dei CRLF bastavano a
// far nascere rosso il passo 8 su Windows. Un rosso strutturale insegna a
// ignorare il rosso; un tipo davvero diverso deve restare rosso.

test("BOM e CRLF non sono un disallineamento dei tipi", () => {
  const generato = "export type Db = {\n  id: string\n}\n";
  assert.equal(normalizzaTipi("﻿" + generato.replace(/\n/g, "\r\n")), normalizzaTipi(generato));
});

test("una colonna in piu' resta un disallineamento", () => {
  assert.notEqual(
    normalizzaTipi("export type Db = {\r\n  id: string\r\n}\r\n"),
    normalizzaTipi("export type Db = {\n  id: string\n  nome: string\n}\n")
  );
});

// ------------------------------------------- i file che sqlfluff non ha letto
// Misurato il 2026-07-27: `sqlfluff lint` su un file da 26 023 byte con dentro
// uno statement invalido stampa «All Finished!» ed esce 0. L'avviso esce su
// STDOUT (non su stderr, come si era scritto): il passo risultava verde su SQL
// che nessuno aveva guardato.

test("un file oltre il limite non e' un file pulito: viene nominato", () => {
  assert.deepEqual(
    fileNonLintati([{ nome: "grande.sql", byte: 26_023 }, { nome: "piccolo.sql", byte: 900 }], 20_000),
    ["grande.sql: 26023 byte, oltre il limite di 20000"]
  );
});

test("file tutti sotto il limite: nessun avviso (il passo puo' essere verde)", () => {
  assert.deepEqual(fileNonLintati([{ nome: "a.sql", byte: 19_860 }], 20_000), []);
});

test("limite disattivato (0): sqlfluff legge tutto, niente da segnalare", () => {
  assert.deepEqual(fileNonLintati([{ nome: "grande.sql", byte: 999_999 }], 0), []);
});

test("il limite si legge dal .sqlfluff, e senza la chiave vale il default di sqlfluff", () => {
  assert.equal(limiteSqlfluff("[sqlfluff]\ndialect = postgres\n"), 20_000);
  assert.equal(limiteSqlfluff("[sqlfluff]\nlarge_file_skip_byte_limit = 0\n"), 0);
  assert.equal(limiteSqlfluff("[sqlfluff]\nlarge_file_skip_byte_limit = 50000\n"), 50_000);
});

// ------------------------------------------------------ conteggio dei file SQL
// `supabase test db` su `supabase/tests/` VUOTA esce 0 (`Result: NOTESTS`,
// misurato il 2026-07-27) e il passo diventava `pass`: cancellare i test era il
// modo piu' rapido di rendere il gate piu' verde. Si contano i file.

test("una cartella con soli file non-SQL vale zero test", () => {
  assert.deepEqual(soloSql(["README.md", ".gitkeep"]), []);
});

test("i file .sql si contano tutti", () => {
  assert.deepEqual(soloSql(["a.sql", "note.md", "b.test.sql"]), ["a.sql", "b.test.sql"]);
});

// --------------------------------- lo strumento trovato dentro il progetto
// Un passo che dice «strumento assente» dopo aver RIFIUTATO un candidato
// piantato nel progetto auditato manda a cercare la cosa sbagliata: il motivo
// vero — e il percorso — devono stare nel dettaglio (referto § C1).
// Le regole di risoluzione stanno in `eseguibili.test.mjs`.

test("il candidato rifiutato finisce nel dettaglio, col suo percorso", () => {
  const nota = notaRifiuto(["C:\\prog\\supabase.cmd"]);
  assert.match(nota, /RIFIUTATO perche' dentro il progetto auditato/);
  assert.ok(nota.includes("C:\\prog\\supabase.cmd"));
});

test("nessun rifiuto: nessuna riga in piu' nel dettaglio", () => {
  assert.equal(notaRifiuto([]), "");
  assert.equal(notaRifiuto(undefined), "");
});

// ------------------------------------------------------- contratto --json
// L'etichetta italiana era l'unico identificatore di passo: riscriverla avrebbe
// rotto in silenzio l'orchestratore. Questo test blocca gli `id` e il loro
// ordine — se qualcuno ne rinomina uno, lo scopre qui e non a valle.

test("gli id dei passi e il loro ordine sono il contratto: non cambiano da soli", () => {
  assert.deepEqual(Object.values(ID), [
    "sqlfluff", "squawk", "db-reset", "db-lint", "db-advisors",
    "audit-rls", "pgtap", "tipi", "contratto-uscita",
  ]);
  assert.equal(CONTRATTO_JSON, 1);
});

test("il riepilogo conta i passi per stato, senza leggere la prosa del dettaglio", () => {
  assert.deepEqual(
    riepilogo([{ status: "pass" }, { status: "pass" }, { status: "fail" }, { status: "skipped" }]),
    { passi: 4, pass: 2, fail: 1, skipped: 1 }
  );
});

// --------------------------------------------------------------------------
// L'epilogo che non parte (2026-08-03)
//
// Il difetto: `if (import.meta.main) main();`. `import.meta.main` e' arrivato in
// Node 24; su Node 20 vale `undefined`, quindi `main()` non veniva chiamata e il
// gate USCIVA 0 SENZA STAMPARE UNA RIGA — un verde che non aveva guardato
// niente, per chiunque lo lanciasse col Node di sistema di questa macchina.
// Misurato il 2026-08-03: Node 20.12.2 → uscita 0, zero righe; Node 24.18.1 →
// uscita 2 e il messaggio. La skill dichiara «Node >= 20»: era il codice a
// violare il proprio contratto.
//
// I test sono TRE perche' proteggono tre cose diverse, e nessuno dei tre basta:
//
//  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
//    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
//    mai): lancia il gate per davvero e pretende che parli. Ma gira con
//    `process.execPath`, cioe' col Node della suite: su Node 24 QUESTO difetto
//    specifico non lo vedrebbe, perche' li' `import.meta.main` funziona;
//  - lo STATICO e' l'unico che impedisce il ritorno del difetto su QUALUNQUE
//    Node, perche' non esegue niente: vieta il token nel sorgente. E' brutale, e
//    va bene cosi' — finche' il prerequisito dichiarato e' Node >= 20, quel
//    token qui dentro non ha nessun uso legittimo;
//  - il JUNCTION (2026-08-04, P.0-igiene-2) invoca il gate attraverso una
//    junction vera: il difetto di quel giorno lo vede solo lui, e il perche' e'
//    scritto sopra il test, in fondo al file.

const VERIFY = fileURLToPath(new URL("./verify.mjs", import.meta.url));

test("il gate parla anche fuori da un progetto: mai un'uscita 0 muta", () => {
  const dir = mkdtempSync(join(tmpdir(), "schema-forge-epilogo-"));
  try {
    const res = spawnSync(process.execPath, [VERIFY], { cwd: dir, encoding: "utf8" });
    const uscita = `${res.stdout}${res.stderr}`.trim();
    // Qui non c'e' `supabase/migrations`: il gate esce 2 (errore di esecuzione)
    // dicendo perche'. Si asserisce «diverso da 0», non «uguale a 2»: il difetto
    // da fermare e' il silenzio che si travestiva da verde.
    assert.notEqual(res.status, 0,
      `uscita 0 fuori da un progetto: il gate non ha guardato niente e sembra verde (uscita ${res.status})`);
    assert.notEqual(uscita, "",
      "il gate non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("il sorgente del gate non contiene `import.meta.main`", () => {
  const righeDiCodice = readFileSync(VERIFY, "utf8")
    .split(/\r?\n/)
    // Le righe di commento non eseguono: il commento dell'epilogo NOMINA il
    // token proprio per spiegare perche' non si usa, e deve poterlo fare.
    .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga));
  const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));
  assert.deepEqual(colpevoli, [],
    "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il gate esce 0 muto");
});

// --------------------------------------------------------------------------
// Lo stesso epilogo, invocato DALLA JUNCTION (2026-08-04, P.0-igiene-2)
//
// Il difetto: la guardia era `resolve(argv[1]) === fileURLToPath(import.meta.url)`
// — la forma che la regola `epiloghi-vivi` della regia PRESCRIVEVA — e invocata
// da `.claude/skills/<skill>/scripts/verify.mjs` era falsa. `resolve` normalizza
// il percorso ma non scioglie una junction, mentre `import.meta.url` e' gia'
// canonico (Node canonicalizza i moduli che carica). Guardia falsa, `main()` mai
// chiamata, gate uscito 0 SENZA STAMPARE UNA RIGA — tutti e cinque i gate della
// casa (`PILOTA-PRE-2026-08-04.md` §2b). Ed e' proprio il canale con cui una chat
// aperta sul repo di un progetto generato vede la skill.
//
// Perche' gli altri due non lo vedono, e non per come sono scritti:
//  - lo STATICO vieta il token `import.meta.main`, e questo difetto non contiene
//    quel token: la riga colpevole era la forma «giusta»;
//  - il FUNZIONALE lancia il gate per il suo percorso reale
//    (`new URL("./verify.mjs", import.meta.url)`), canonico per costruzione: da
//    quella parte del mondo la junction non esiste.
// Solo il canale junction vede il canale junction.

const SKILL_DIR = dirname(dirname(VERIFY));

test("il gate parla anche invocato dalla junction: e' il canale con cui lo vede un progetto", () => {
  const casa = mkdtempSync(join(tmpdir(), "schema-forge-junction-"));
  const altrove = mkdtempSync(join(tmpdir(), "schema-forge-junction-cwd-"));
  const junction = join(casa, "skill");
  try {
    try {
      // Su Windows una junction NON chiede privilegi di amministratore (un
      // symlink si'). Fuori da Windows il tipo e' ignorato e nasce un symlink:
      // va bene uguale, perche' cio' che conta e' che il percorso di invocazione
      // non sia canonico.
      symlinkSync(SKILL_DIR, junction, "junction");
    } catch (errore) {
      assert.fail(
        `junction non creata (${junction} → ${SKILL_DIR}): ${errore.message}. ` +
        "Senza junction questo test non prova niente, e cio' che non e' provato e' MANCANTE, non PASS.");
    }
    // `cwd` e' una SECONDA cartella non-progetto: cosi' il gate si ferma per
    // mancanza di progetto, e l'unica variabile in gioco e' il percorso di
    // invocazione.
    const res = spawnSync(process.execPath, [join(junction, "scripts", "verify.mjs")], { cwd: altrove, encoding: "utf8" });
    const uscita = `${res.stdout}${res.stderr}`.trim();
    assert.notEqual(res.status, 0,
      `uscita ${res.status} invocando il gate dalla junction: non ha guardato niente e sembra verde`);
    assert.notEqual(uscita, "",
      "dalla junction il gate non ha stampato una riga: e' il difetto del 2026-08-04, tornato");
  } finally {
    // `rmSync` ricorsivo rimuove la junction, NON il suo bersaglio: verificato
    // su Node 20.12.2 e 24.18.1 prima di scrivere questo test.
    rmSync(casa, { recursive: true, force: true });
    rmSync(altrove, { recursive: true, force: true });
  }
});

// ── il `#` che apre un commento TOML, e quello che non lo apre (§ M13) ───────
// Misurato il 2026-08-06: un commento dentro l'array multi-riga produceva
// schemi fantasma, l'audit usciva 2 e il passo diventava `skipped` accusando un
// `config.toml` che non e' rotto. Rosso falso, che insegna a ignorare il rosso.

const CONFIG_COL_COMMENTO = `[api]
schemas = [
  "public",
  "shop", # esposto anche qui, vedi PROGETTO.md
]
`;

test("un commento dentro l'array multi-riga non diventa uno schema", () => {
  assert.deepEqual(schemiEsposti(CONFIG_COL_COMMENTO).schemi, ["public", "shop"]);
});

test("ma un `#` DENTRO una stringa e' parte del nome, non un commento", () => {
  assert.deepEqual(
    schemiEsposti('[api]\nschemas = ["public", "grafico#1"] # una nota\n').schemi,
    ["public", "grafico#1"],
  );
  assert.deepEqual(schemiEsposti("[api]\nschemas = ['a#b']\n").schemi, ["a#b"]);
});

test("senzaCommentoToml: dove taglia e dove no", () => {
  assert.equal(senzaCommentoToml('port = 54322 # il banco'), "port = 54322 ");
  assert.equal(senzaCommentoToml('url = "http://x/#/app"'), 'url = "http://x/#/app"');
  assert.equal(senzaCommentoToml('url = "http://x/#/app" # nota'), 'url = "http://x/#/app" ');
  assert.equal(senzaCommentoToml('a = "una \\" virgoletta # dentro"'), 'a = "una \\" virgoletta # dentro"');
  assert.equal(senzaCommentoToml("# tutta la riga"), "");
  assert.equal(senzaCommentoToml(null), "");
});

// ── la premessa dell'audit: quanti oggetti sono stati guardati (§ M12) ───────

test("rigaPremesse dice cosa e' stato guardato, test pgTAP compresi", () => {
  const riga = rigaPremesse({ tabelle: 18, policy: 42, viste: 3, funzioniSecurityDefiner: 2, colonne: 130, testiPgtap: 5 });
  assert.match(riga, /18 tabelle/);
  assert.match(riga, /42 policy/);
  assert.match(riga, /5 file di test pgTAP/);
});

test("test pgTAP NON letti si distingue da zero test pgTAP", () => {
  assert.match(rigaPremesse({ tabelle: 1, policy: 0, viste: 0, funzioniSecurityDefiner: 0, colonne: 1, testiPgtap: null }), /NON letti/);
  assert.match(rigaPremesse({ tabelle: 1, policy: 0, viste: 0, funzioniSecurityDefiner: 0, colonne: 1, testiPgtap: 0 }), /0 file di test pgTAP/);
});

// ── sonde ostili sugli scanner scritti a mano (audit di P.7e, 2026-08-06) ────

test("una quadra nella prosa della CLI non nasconde il JSON degli advisors", () => {
  // Misurato: `Connecting to local database [locale]...` bastava a far uscire
  // il dettaglio grezzo, e con lui spariva «nessun rilievo».
  assert.equal(dettaglioAdvisors("Connecting to local database [locale]...\n[]\n"), "nessun rilievo");
  assert.equal(
    dettaglioAdvisors('Avvio [container: db]\n[{"name":"rls_disabled","level":"ERROR","metadata":{"name":"t","schema":"public"}}]\nfine [ok]'),
    "[ERROR] rls_disabled (1): public.t",
  );
});

test("un'uscita davvero senza JSON resta grezza, come prima", () => {
  assert.match(dettaglioAdvisors("failed to connect [127.0.0.1]: connection refused"), /connection refused/);
});

// ── la seconda porta sulla premessa (concilio P.7e, 2026-08-07) ─────────────
// `rls-audit.mjs` esce gia' 2 su zero tabelle — ma quel controllo sta nel
// PRODUTTORE, e `leggiAudit` e' il CONSUMATORE. Se i due file divergessero, un
// documento con `premesse.tabelle: 0` tornerebbe a valere `pass`: il § M12
// risorto dall'altra parte del contratto.

test("un audit che dichiara ZERO tabelle non si usa, nemmeno se il JSON e' ben formato", () => {
  const { parsed, errore } = leggiAudit(JSON.stringify({
    ok: true,
    schemas: ["public"],
    premesse: { tabelle: 0, policy: 0, viste: 0, funzioniSecurityDefiner: 0, colonne: 0, testiPgtap: null },
    findings: [],
    summary: { block: 0, issue: 0, warn: 0 },
  }));
  assert.equal(parsed, undefined);
  assert.match(errore, /ZERO tabelle/);
});

test("ma una tabella sola basta a farlo passare", () => {
  const { parsed, errore } = leggiAudit(JSON.stringify({
    ok: true,
    schemas: ["public"],
    premesse: { tabelle: 1, policy: 2, viste: 0, funzioniSecurityDefiner: 0, colonne: 5, testiPgtap: 3 },
    findings: [],
    summary: { block: 0, issue: 0, warn: 0 },
  }));
  assert.equal(errore, undefined);
  assert.equal(parsed.premesse.tabelle, 1);
});

// ── il salto delle stringhe in `chiusuraQuadra` (concilio, 2026-08-07) ──────
// Il ramo era raggiungibile e non lo provava nessuno: la mutazione che toglie
// `inStringa` sopravviveva alla batteria.

test("una `]` spaiata dentro il messaggio di un advisor non chiude l'array", () => {
  const uscita = 'Connecting...\n[{"name":"rls_disabled","level":"ERROR","metadata":{"name":"t","schema":"public"},"detail":"la policy usa ] qui"}]\n';
  assert.equal(dettaglioAdvisors(uscita), "[ERROR] rls_disabled (1): public.t");
});
