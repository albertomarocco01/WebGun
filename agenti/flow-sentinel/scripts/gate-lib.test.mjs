/**
 * gate-lib.test.mjs — Le regole del gate, una per una.
 *
 * Runner nativo, zero dipendenze:  node --test "scripts/**\/*.test.mjs"
 * (su Node 24 il percorso passato a `--test` e' un pattern glob, non una
 * cartella: le virgolette servono.)
 *
 * Regola della casa: ogni regola ha il caso in cui SCATTA e quello in cui NON
 * deve scattare. Il secondo e' quello che conta — una regola che scatta sempre
 * e' rumore, e il rumore si impara a scavalcare.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contaGravita,
  contrattoUscita,
  copertura,
  dettaglioPlaywright,
  eSpec,
  esitoBatteriaVerde,
  esitoPlaywright,
  estraiOggettoJson,
  findingsCopertura,
  findingsEffettoDb,
  formaEseguibile,
  leggiFlussi,
  primoEseguibile,
  regoleSpec,
  righeDaPsql,
  schemiEsposti,
  sqlConteggioRighe,
  sqlTabelleEsposte,
  statoDaFindings,
  tagDaSpec,
  urlAppProgetto,
  urlDbProgetto,
  usaHelperDb,
  verdettoDa,
} from "./gate-lib.mjs";

const BOM = "\uFEFF";

// ------------------------------------------------ il contratto dei flussi

const CONTRATTO = `# Flussi critici — Banco

Confermato da: UMANO (P0, 2026-07-28)

## \`accesso-staff\` — positivo

Passi: apre /login, entra.

## \`admin-negato-anon\` — ostile-lettura

## \`scrittura-negata-cliente\` — ostile-scrittura
`;

test("il contratto si legge: id, tipi e riga di conferma", () => {
  const { confermatoDa, flussi, errori } = leggiFlussi(CONTRATTO);
  assert.equal(confermatoDa, "UMANO (P0, 2026-07-28)");
  assert.deepEqual(flussi, [
    { id: "accesso-staff", tipo: "positivo" },
    { id: "admin-negato-anon", tipo: "ostile-lettura" },
    { id: "scrittura-negata-cliente", tipo: "ostile-scrittura" },
  ]);
  assert.deepEqual(errori, []);
});

test("CRLF e BOM non rompono la lettura del contratto (Windows)", () => {
  const { confermatoDa, flussi } = leggiFlussi(BOM + CONTRATTO.replace(/\n/g, "\r\n"));
  assert.equal(confermatoDa, "UMANO (P0, 2026-07-28)");
  assert.equal(flussi.length, 3);
});

test("senza riga `Confermato da:` il contratto non e' confermato", () => {
  const { confermatoDa, flussi } = leggiFlussi(CONTRATTO.replace(/^Confermato da:.*$/m, ""));
  assert.equal(confermatoDa, null);
  assert.equal(flussi.length, 3, "i flussi si leggono lo stesso: manca la firma, non l'elenco");
});

test("la conferma si riconosce anche in grassetto dentro un elenco", () => {
  assert.equal(leggiFlussi("- **Confermato da:** ORCHESTRATORE il 2026-07-28").confermatoDa,
    "ORCHESTRATORE il 2026-07-28");
});

// Buco vero, riprodotto il 2026-07-28: con `\s` nella classe dopo i due punti,
// una riga `Confermato da:` VUOTA catturava la prima riga non vuota che seguiva
// — l'intestazione del primo flusso — e il gate dichiarava confermato un
// contratto che nessuno aveva firmato. E' il falso verde peggiore, perche' sta
// sul passo che esiste apposta per impedirlo.
test("una riga `Confermato da:` vuota NON e' una firma: pesca la riga dopo", () => {
  const { confermatoDa, flussi } = leggiFlussi("# Flussi\n\nConfermato da:\n\n## `a-b` — positivo\n");
  assert.equal(confermatoDa, null);
  assert.equal(flussi.length, 1, "i flussi si leggono lo stesso: manca la firma");
});

test("una riga `Confermato da:` con soli spazi non e' una firma", () => {
  assert.equal(leggiFlussi("Confermato da:   \nUMANO\n").confermatoDa, null);
});

test("un tipo sconosciuto e' un errore, e quel flusso non entra nell'elenco", () => {
  const { flussi, errori } = leggiFlussi("## `pippo` — ostile\n");
  assert.deepEqual(flussi, []);
  assert.match(errori[0], /tipo "ostile" sconosciuto/);
});

test("un id ripetuto e' un errore: un id stabile identifica un flusso solo", () => {
  const { flussi, errori } = leggiFlussi("## `a` — positivo\n## `a` — ostile-lettura\n");
  assert.equal(flussi.length, 1);
  assert.match(errori[0], /id ripetuto/);
});

test("un documento senza intestazioni di flusso non produce errori inventati", () => {
  const { flussi, errori } = leggiFlussi("# Titolo\n\nProsa qualsiasi.\n## Sezione normale\n");
  assert.deepEqual(flussi, []);
  assert.deepEqual(errori, []);
});

// --------------------------------------------------- etichette e copertura

test("le etichette `@flusso:` si estraggono dal titolo del test", () => {
  assert.deepEqual(
    tagDaSpec("test('crea un prodotto @flusso:crea-prodotto', async () => {});"),
    ["crea-prodotto"]);
});

test("una spec senza etichetta non ne inventa una", () => {
  assert.deepEqual(tagDaSpec("test('qualcosa', async () => {});"), []);
});

test("Playwright riconosce .spec.ts e .test.ts, non un helper", () => {
  assert.equal(eSpec("login.spec.ts"), true);
  assert.equal(eSpec("db.ts"), false);
});

const FLUSSI = [
  { id: "accesso-staff", tipo: "positivo" },
  { id: "admin-negato-anon", tipo: "ostile-lettura" },
];

test("un flusso dichiarato che nessuna spec attacca e' un block", () => {
  const { findings } = findingsCopertura(FLUSSI, [{ file: "e2e/a.spec.ts", tags: ["accesso-staff"] }]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].object, /admin-negato-anon/);
});

test("tutti i flussi coperti: nessun rilievo", () => {
  const { findings } = findingsCopertura(FLUSSI, [
    { file: "e2e/a.spec.ts", tags: ["accesso-staff"] },
    { file: "e2e/b.spec.ts", tags: ["admin-negato-anon"] },
  ]);
  assert.deepEqual(findings, []);
});

test("un'etichetta senza flusso dichiarato e' un warn, non un block", () => {
  const { findings } = findingsCopertura(FLUSSI, [
    { file: "e2e/a.spec.ts", tags: ["accesso-staff"] },
    { file: "e2e/b.spec.ts", tags: ["admin-negato-anon", "checkout-sparito"] },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "warn");
  assert.match(findings[0].message, /checkout-sparito/);
});

test("due spec sullo stesso flusso lo coprono, non lo duplicano", () => {
  const { perFlusso } = copertura(FLUSSI, [
    { file: "e2e/a.spec.ts", tags: ["accesso-staff"] },
    { file: "e2e/b.spec.ts", tags: ["accesso-staff", "admin-negato-anon"] },
  ]);
  assert.deepEqual(perFlusso.get("accesso-staff"), ["e2e/a.spec.ts", "e2e/b.spec.ts"]);
});

// --------------------------------------------------- `.only` e skip muti

test("`test.only` committato e' un block", () => {
  const findings = regoleSpec("e2e/a.spec.ts", "test.only('x @flusso:a', async () => {});");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.equal(findings[0].object, "e2e/a.spec.ts:1");
});

test("anche `test.describe.only` e' un block", () => {
  const findings = regoleSpec("e2e/a.spec.ts", "test.describe.only('gruppo', () => {});");
  assert.equal(findings[0]?.severity, "block");
});

test("`.only` NOMINATO in un commento non e' un `.only`", () => {
  assert.deepEqual(regoleSpec("e2e/a.spec.ts", "// mai committare un test.only(...) qui\n"), []);
});

test("uno skip senza motivazione e' un issue", () => {
  const findings = regoleSpec("e2e/a.spec.ts", "test.skip('x', async () => {});");
  assert.equal(findings[0]?.severity, "issue");
});

test("uno skip motivato in coda alla riga non produce rilievi", () => {
  assert.deepEqual(
    regoleSpec("e2e/a.spec.ts", "test.skip('x', async () => {}); // pagamenti non ancora collegati, rientra col PSP"),
    []);
});

test("uno skip motivato nel commento sopra non produce rilievi", () => {
  assert.deepEqual(
    regoleSpec("e2e/a.spec.ts", "// il PSP di prova non risponde, riattivare a contratto firmato\ntest.skip('x', async () => {});"),
    []);
});

test("una spec pulita non produce rilievi", () => {
  assert.deepEqual(regoleSpec("e2e/a.spec.ts", "test('x @flusso:a', async () => {});"), []);
});

// ------------------------------------------------ l'helper di effetto DB

test("import nominato e chiamata: l'helper e' usato", () => {
  const u = usaHelperDb(`import { contaProdotti } from "./helpers/db";\nconst n = await contaProdotti();`);
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: true, chiama: true });
});

test("import a namespace e chiamata di metodo: l'helper e' usato", () => {
  const u = usaHelperDb(`import * as db from "../helpers/db.js";\nawait db.prodottoPerNome("x");`);
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: true, chiama: true });
});

test("importato e mai chiamato non conta: un import non asserisce niente", () => {
  const u = usaHelperDb(`import { contaProdotti } from "./helpers/db";\nawait expect(page).toHaveURL(/admin/);`);
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: true, chiama: false });
});

// Il caso vero: OGNI spec comincia con l'import di Playwright. Il ritaglio della
// clausola partiva dal primo `import` del file e inghiottiva anche quei nomi,
// quindi un `expect(...)` passava per una chiamata all'helper del database — la
// regola verificava l'import e non la chiamata, sul passo che esiste apposta per
// pretendere la chiamata.
const SPEC_REALE = (corpo) => [
  'import { test, expect } from "@playwright/test";',
  'import { contaProdotti } from "./helpers/db";',
  "",
  'test("x @flusso:a", async ({ page }) => {',
  corpo,
  "});",
].join("\n");

test("con l'import di Playwright davanti, un `expect` non passa per una chiamata all'helper", () => {
  const u = usaHelperDb(SPEC_REALE('  await expect(page.getByRole("status")).toHaveText("fatto");'));
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: true, chiama: false });
  assert.deepEqual(u.nomi, ["contaProdotti"], "solo i nomi importati DALL'helper");
});

test("con l'import di Playwright davanti, una chiamata vera all'helper si vede", () => {
  const u = usaHelperDb(SPEC_REALE("  expect(await contaProdotti()).toBe(2);"));
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: true, chiama: true });
});

test("una spec che importa solo Playwright non usa l'helper", () => {
  const u = usaHelperDb(`import { test, expect } from "@playwright/test";`);
  assert.equal(u.importa, false);
});

const SPEC_CON_DB = { file: "e2e/a.spec.ts", testo: `import { contaProdotti } from "./helpers/db";\nawait contaProdotti();` };
const SPEC_SENZA_DB = { file: "e2e/a.spec.ts", testo: `import { expect } from "@playwright/test";\nawait expect(page).toHaveText("fatto");` };
const perFlusso = (id) => new Map([[id, ["e2e/a.spec.ts"]]]);

test("un flusso positivo che non guarda il database e' un block", () => {
  const findings = findingsEffettoDb([{ id: "a", tipo: "positivo" }], [SPEC_SENZA_DB], perFlusso("a"));
  assert.equal(findings[0]?.severity, "block");
  assert.match(findings[0].message, /guarda la FORMA/);
});

test("un flusso positivo che chiama l'helper non produce rilievi", () => {
  assert.deepEqual(findingsEffettoDb([{ id: "a", tipo: "positivo" }], [SPEC_CON_DB], perFlusso("a")), []);
});

test("un ostile in SCRITTURA deve mostrare che il database non e' cambiato", () => {
  const findings = findingsEffettoDb([{ id: "a", tipo: "ostile-scrittura" }], [SPEC_SENZA_DB], perFlusso("a"));
  assert.equal(findings[0]?.severity, "block");
});

test("un ostile in LETTURA non ha stato da confrontare: nessun rilievo", () => {
  assert.deepEqual(findingsEffettoDb([{ id: "a", tipo: "ostile-lettura" }], [SPEC_SENZA_DB], perFlusso("a")), []);
});

test("un flusso senza spec non prende un secondo rilievo qui: e' gia' un block di copertura", () => {
  assert.deepEqual(findingsEffettoDb([{ id: "a", tipo: "positivo" }], [], new Map([["a", []]])), []);
});

// --------------------------------------------------- l'esito della batteria

const REPORT = {
  errors: [],
  suites: [{
    title: "login.spec.ts",
    specs: [
      { title: "entra @flusso:accesso-staff", tests: [{ status: "expected" }] },
      { title: "crea @flusso:crea-prodotto", tests: [{ status: "unexpected" }] },
      { title: "avanza @flusso:avanza-stato", tests: [{ status: "flaky" }] },
      { title: "rimandato", tests: [{ status: "skipped" }] },
    ],
    suites: [],
  }],
};

test("l'esito distingue passati, falliti, saltati e passati al secondo tentativo", () => {
  const esito = esitoPlaywright(REPORT);
  assert.equal(esito.passati, 2, "il flaky e' passato, ma resta contato a parte");
  assert.deepEqual(esito.falliti, ["login.spec.ts › crea @flusso:crea-prodotto"]);
  assert.deepEqual(esito.alSecondoTentativo, ["login.spec.ts › avanza @flusso:avanza-stato"]);
  assert.equal(esito.saltati.length, 1);
});

test("il secondo tentativo si dichiara anche quando il totale e' verde", () => {
  const verde = { errors: [], suites: [{ title: "a.spec.ts", specs: [{ title: "x", tests: [{ status: "flaky" }] }], suites: [] }] };
  const esito = esitoPlaywright(verde);
  assert.equal(esitoBatteriaVerde(esito), true);
  assert.match(dettaglioPlaywright(esito, 1), /SECONDO tentativo/);
});

test("una batteria tutta verde non parla di secondi tentativi", () => {
  const verde = { errors: [], suites: [{ title: "a.spec.ts", specs: [{ title: "x", tests: [{ status: "expected" }] }], suites: [] }] };
  assert.doesNotMatch(dettaglioPlaywright(esitoPlaywright(verde), 1), /SECONDO tentativo/);
});

test("le suite annidate (describe) entrano nel nome del test", () => {
  const annidato = { errors: [], suites: [{ title: "a.spec.ts", specs: [], suites: [{ title: "area riservata", specs: [{ title: "x", tests: [{ status: "unexpected" }] }], suites: [] }] }] };
  assert.deepEqual(esitoPlaywright(annidato).falliti, ["a.spec.ts › area riservata › x"]);
});

test("un errore del runner rende la batteria rossa anche senza test falliti", () => {
  const esito = esitoPlaywright({ errors: [{ message: "Error: no tests found" }], suites: [] });
  assert.equal(esitoBatteriaVerde(esito), false);
  assert.match(dettaglioPlaywright(esito, 0), /errore del runner/);
});

test("un report senza `suites` non e' un report: la batteria non e' verde", () => {
  assert.equal(esitoBatteriaVerde(esitoPlaywright({ nonSonoUnReport: true })), false);
});

test("il JSON si estrae anche se lo strumento ci mette del rumore attorno", () => {
  const { parsed } = estraiOggettoJson('Running 5 tests...\n{"suites":[]}\nDone.');
  assert.deepEqual(parsed, { suites: [] });
});

test("un'uscita che non contiene JSON e' un errore, non un report vuoto", () => {
  const { errore, parsed } = estraiOggettoJson("Error: browserType.launch: Executable doesn't exist");
  assert.equal(parsed, undefined);
  assert.match(errore, /non interpretabile/);
});

// -------------------------------------------------- il progetto, non i default

const CONFIG = `project_id = "banco"

[api]
port = 58321
schemas = ["public", "graphql_public"]

[db]
port = 58322

[auth]
site_url = "http://127.0.0.1:3100"
`;

test("il database e' quello del progetto, letto da [db].port", () => {
  assert.equal(urlDbProgetto(CONFIG), "postgresql://postgres:postgres@127.0.0.1:58322/postgres");
});

test("senza [db].port non si indovina la 54322 di un altro progetto", () => {
  assert.equal(urlDbProgetto("[api]\nport = 58321\n"), null);
});

test("l'URL dell'app e' quello dichiarato dal progetto in [auth].site_url", () => {
  assert.equal(urlAppProgetto(CONFIG), "http://127.0.0.1:3100");
});

test("un commento in coda e la barra finale non entrano nell'URL", () => {
  assert.equal(urlAppProgetto(`[auth]\nsite_url = "http://127.0.0.1:3100/"  # porta del banco\n`),
    "http://127.0.0.1:3100");
});

test("senza [auth].site_url il gate non inventa un localhost:3000", () => {
  assert.equal(urlAppProgetto("[db]\nport = 58322\n"), null);
});

test("un site_url che non e' un URL http non passa per un URL", () => {
  assert.equal(urlAppProgetto(`[auth]\nsite_url = "env(SITE_URL)"\n`), null);
});

test("gli schemi esposti si leggono da [api].schemas", () => {
  assert.deepEqual(schemiEsposti(CONFIG), ["public", "graphql_public"]);
});

test("senza [api].schemas vale il default documentato di Supabase", () => {
  assert.deepEqual(schemiEsposti("[db]\nport = 58322\n"), ["public"]);
});

// ------------------------------------------------------ premessa del seed

test("il conteggio delle righe virgoletta gli identificatori", () => {
  assert.equal(sqlConteggioRighe(["public.prodotti", "public.ordini"]),
    'select coalesce(sum(c), 0) from (select count(*) as c from "public"."prodotti" union all select count(*) as c from "public"."ordini") as t');
});

test("un apostrofo nel nome dello schema non esce dalla stringa SQL", () => {
  assert.match(sqlTabelleEsposte(["pub'lic"]), /'pub''lic'/);
});

test("psql su Windows lascia il \\r in coda: le righe si leggono pulite", () => {
  assert.deepEqual(righeDaPsql("public.prodotti\r\npublic.ordini\r\n\r\n"), ["public.prodotti", "public.ordini"]);
});

// ------------------------------------------------- shim .cmd su Windows

// `where npx` elenca DUE file: lo script di shell senza estensione (per Git
// Bash) e lo shim `.cmd`. Prendere la prima riga era un guasto vero, misurato
// sul banco: `spawnSync` non sa eseguire lo script di shell, e il passo
// `playwright` diceva «report JSON non interpretabile» su una macchina dove
// `npx playwright test` funziona.
test("fra le righe di `where` si sceglie quella eseguibile, non la prima", () => {
  assert.equal(
    primoEseguibile("C:\\Program Files\\nodejs\\npx\r\nC:\\Program Files\\nodejs\\npx.cmd\r\n"),
    "C:\\Program Files\\nodejs\\npx.cmd");
});

test("con un solo `.exe` si prende quello, senza cercare altro", () => {
  assert.equal(primoEseguibile("C:\\scoop\\psql.exe\n"), "C:\\scoop\\psql.exe");
});

test("se nessuna riga ha un'estensione eseguibile (Linux) si prende la prima", () => {
  assert.equal(primoEseguibile("/usr/bin/psql\n/usr/local/bin/psql\n"), "/usr/bin/psql");
});

test("uscita vuota di `where`: nessun percorso, non una stringa vuota", () => {
  assert.equal(primoEseguibile(""), null);
});

test("su Windows uno shim .cmd si lancia con cmd.exe /c, non con shell:true", () => {
  assert.deepEqual(formaEseguibile("npx", () => "C:\\Program Files\\nodejs\\npx.cmd", "win32"),
    { file: "cmd.exe", prefisso: ["/c", "C:\\Program Files\\nodejs\\npx.cmd"] });
});

test("su Windows un .exe si lancia col percorso pieno", () => {
  assert.deepEqual(formaEseguibile("psql", () => "C:\\scoop\\psql.exe", "win32"),
    { file: "C:\\scoop\\psql.exe", prefisso: [] });
});

test("fuori da Windows il nome nudo basta", () => {
  assert.deepEqual(formaEseguibile("psql", () => { throw new Error("non si cerca"); }, "linux"),
    { file: "psql", prefisso: [] });
});

// ------------------------------------------------------- gravita' e verdetto

test("un block rende rosso il passo, un issue no", () => {
  assert.equal(statoDaFindings([{ severity: "issue" }, { severity: "warn" }]), "pass");
  assert.equal(statoDaFindings([{ severity: "issue" }, { severity: "block" }]), "fail");
  assert.deepEqual(contaGravita([{ severity: "issue" }, { severity: "block" }, { severity: "block" }]),
    { block: 2, issue: 1, warn: 0 });
});

test("una verifica mancante rende ROSSO il verdetto come un fallimento", () => {
  assert.equal(verdettoDa([{ status: "pass" }, { status: "pass" }]), "VERDE");
  assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
  assert.equal(verdettoDa([{ status: "fail" }]), "ROSSO");
});

// ------------------------------------------------------- contratto d'uscita

const CONFIG_PW = "export default defineConfig({ retries: 1, forbidOnly: !!process.env.CI });";
const HANDOFF_ROSSO = "# Handoff\n\n**Gate: ROSSO** (1 falliti, 0 verifiche mancanti su 7 passi)\n";

test("dichiarare ROSSO su un gate rosso PASSA: dichiarare non e' fallire", () => {
  assert.equal(contrattoUscita("docs/handoff/12.md", HANDOFF_ROSSO, CONFIG_PW, "ROSSO").status, "pass");
});

test("dichiarare VERDE su un gate rosso fallisce, e il passo dice quale e' quello vero", () => {
  const esito = contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n", CONFIG_PW, "ROSSO");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /dichiara `Gate: VERDE` ma il gate chiude ROSSO/);
});

test("un `Gate:` lasciato a meta' non va a pescare la parola VERDE piu' sotto", () => {
  const esito = contrattoUscita("docs/handoff/12.md", "# Handoff\n\nGate:\n\nIl banco era VERDE ieri.\n", CONFIG_PW, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara il verdetto/);
});

test("un handoff che non dichiara niente non e' un handoff", () => {
  const esito = contrattoUscita("docs/handoff/12.md", "# Handoff\n\nTutto bene.\n", CONFIG_PW, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara il verdetto/);
});

test("l'handoff assente e' un fallimento, non una verifica mancante", () => {
  const esito = contrattoUscita("docs/handoff/12.md", null, CONFIG_PW, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /assente/);
});

test("i segnaposto {{...}} non compilati bocciano l'handoff", () => {
  const esito = contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n\nFlussi: {{ELENCO}}\n", CONFIG_PW, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /segnaposto/);
});

test("BOM e CRLF nell'handoff non fanno fallire un handoff corretto", () => {
  assert.equal(contrattoUscita("docs/handoff/12.md", BOM + HANDOFF_ROSSO.replace(/\n/g, "\r\n"), CONFIG_PW, "ROSSO").status, "pass");
});

test("`retries: 2` boccia: un test che passa una volta su tre resterebbe invisibile", () => {
  const esito = contrattoUscita("docs/handoff/12.md", HANDOFF_ROSSO, "export default { retries: 2 }", "ROSSO");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /retries: 2/);
});

test("`retries` non dichiarato boccia: il default cambia il significato del verde", () => {
  const esito = contrattoUscita("docs/handoff/12.md", HANDOFF_ROSSO, "export default { forbidOnly: true }", "ROSSO");
  assert.match(esito.detail, /non dichiara `retries`/);
});

test("senza playwright.config.ts la batteria non e' rilanciabile da chi viene dopo", () => {
  const esito = contrattoUscita("docs/handoff/12.md", HANDOFF_ROSSO, null, "ROSSO");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /playwright\.config\.ts assente/);
});

test("handoff coerente e configurazione in regola: passo verde", () => {
  assert.equal(contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n", CONFIG_PW, "VERDE").status, "pass");
});
