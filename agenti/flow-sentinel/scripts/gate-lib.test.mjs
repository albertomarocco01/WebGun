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
  argomentiOstiliACmd,
  motivoScaduto,
  scaduto,
  contaGravita,
  motivoOstile,
  ambientePsql,
  clausoleHelperDb,
  contrattoUscita,
  credenzialiPsql,
  copertura,
  dettaglioPlaywright,
  eSpec,
  batteriaHaEseguito,
  esitoBatteriaVerde,
  esitoPlaywright,
  estraiOggettoJson,
  findingsCopertura,
  findingsEffettoDb,
  flussiPercorsi,
  rigaFlussiPercorsi,
  comandoRicerca,
  dentroLaRadice,
  shellDiSistema,
  formaEseguibile,
  leggiFlussi,
  mascheraUrl,
  primoEseguibile,
  regoleSpec,
  righeDaPsql,
  schemiEsposti,
  senzaCommentoToml,
  sqlConteggioRighe,
  sqlTabelleEsposte,
  statoDaFindings,
  tagDaSpec,
  urlAppProgetto,
  ambienteBatteria,
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

// Riprodotti il 2026-07-28 al collaudo: la riga vuota era chiusa, le sue due
// varianti no. La prima e' il template della skill compilato a meta'.
test("il segnaposto del template non e' una firma", () => {
  assert.equal(
    leggiFlussi("Confermato da: {{UMANO | ORCHESTRATORE}} ({{QUANDO}})\n\n## `a-b` — positivo\n").confermatoDa,
    null);
});

test("la sola decorazione markdown non e' una firma", () => {
  for (const riga of ["- **Confermato da:** ", "**Confermato da:**", "Confermato da: -", "Confermato da: ___"]) {
    assert.equal(leggiFlussi(`${riga}\n`).confermatoDa, null, `ha firmato: ${riga}`);
  }
});

test("una firma vera resta una firma, anche in grassetto dentro un elenco", () => {
  assert.equal(leggiFlussi("- **Confermato da:** ORCHESTRATORE (2026-07-28)\n").confermatoDa,
    "ORCHESTRATORE (2026-07-28)");
  assert.equal(leggiFlussi("Confermato da: UMANO (Alberto, committente) il 2026-07-28\n").confermatoDa,
    "UMANO (Alberto, committente) il 2026-07-28");
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

// Cio' che un documento CITA non e' cio' che dichiara. Quattro guasti dallo
// stesso buco, riprodotti al collaudo del 2026-07-28. La forma e' quella vera:
// un contratto che spiega il proprio formato con un esempio recintato.
const CONTRATTO_CON_ESEMPIO = `# Flussi critici — Palestra

Confermato da: UMANO (Alberto) il 2026-07-28

Come si scrive un flusso:

\`\`\`markdown
## \`id-del-flusso\` — positivo
\`\`\`

<!-- promemoria: ## \`da-scrivere\` — ostile-lettura -->

## \`prenota-corso\` — positivo
## \`staff-negato\` — ostile-lettura
`;

test("un esempio recintato non dichiara flussi fantasma", () => {
  const { flussi, errori } = leggiFlussi(CONTRATTO_CON_ESEMPIO);
  assert.deepEqual(flussi.map((f) => f.id), ["prenota-corso", "staff-negato"]);
  assert.deepEqual(errori, []);
});

test("un esempio recintato che riusa un id vero non e' un id ripetuto", () => {
  const { flussi, errori } = leggiFlussi(
    CONTRATTO_CON_ESEMPIO.replace("## `id-del-flusso` — positivo", "## `prenota-corso` — positivo"));
  assert.deepEqual(errori, [], "il doppione sta nell'esempio, non nell'elenco");
  assert.equal(flussi.length, 2);
});

test("una firma che esiste solo dentro un esempio non firma niente", () => {
  const soloEsempio = CONTRATTO_CON_ESEMPIO.replace("Confermato da: UMANO (Alberto) il 2026-07-28",
    "```\nConfermato da: UMANO (esempio del template)\n```");
  assert.equal(leggiFlussi(soloEsempio).confermatoDa, null);
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

// I tre casi che `references/flussi-critici.md` §Cosa fa `evolve` sull'elenco
// promette a parole. I primi due hanno gia' il loro test qui sopra; il terzo —
// la rinomina — non l'aveva, ed e' l'unico in cui le due gravita' devono
// comparire INSIEME. Collaudati sui file veri del banco il 2026-07-30, prima
// volta che `evolve` veniva eseguito da qualcuno.
test("un id rinominato solo nel contratto e' un block E un warn insieme", () => {
  // La spec porta ancora l'etichetta vecchia, il contratto dichiara la nuova.
  const rinominati = [
    { id: "accesso-staff", tipo: "positivo" },
    { id: "admin-negato-al-visitatore", tipo: "ostile-lettura" },
  ];
  const { findings } = findingsCopertura(rinominati, [
    { file: "e2e/a.spec.ts", tags: ["accesso-staff"] },
    { file: "e2e/b.spec.ts", tags: ["admin-negato-anon"] },
  ]);
  const g = contaGravita(findings);
  assert.equal(g.block, 1, "il nome nuovo non e' coperto da nessuna spec");
  assert.equal(g.warn, 1, "il nome vecchio resta appeso a una spec");
  // E' il motivo per cui una rinomina si fa in un giro solo: chiudere solo il
  // block (aggiungendo la spec) lascerebbe il warn, e chiudere solo il warn
  // (togliendo l'etichetta) lascerebbe il block.
  assert.equal(statoDaFindings(findings), "fail");
});

test("un flusso che cambia nel CORPO, con lo stesso id, il gate non lo vede", () => {
  // Non e' un difetto da correggere qui: e' un limite da tenere scritto. Il
  // gate legge le intestazioni, non i passi. Un contratto in cui i passi di un
  // flusso descrivono un percorso che la spec non fa piu' resta `pass`, e
  // l'unica difesa e' che `evolve` lo legga una persona (o un agente) e
  // confronti la prosa. Misurato il 2026-07-30 sul banco di Bottega Nord:
  // passi ed effetto atteso stravolti sotto un'intestazione invariata → verde.
  const contratto = (passi) => `Confermato da: ORCHESTRATORE (2026-07-30)

## \`modifica-cliente\` — positivo

${passi}
`;
  const prima = leggiFlussi(contratto("1. Cambia il telefono del cliente."));
  const dopo = leggiFlussi(contratto("1. Cancella il cliente e ricrealo."));
  assert.deepEqual(dopo.flussi, prima.flussi, "l'elenco letto e' identico");

  const spec = [{ file: "e2e/c.spec.ts", tags: ["modifica-cliente"] }];
  assert.deepEqual(findingsCopertura(dopo.flussi, spec).findings, []);
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

// Tre forme misurate il 2026-07-28, tutte sulla stessa cecita': il controllo
// guardava solo l'INIZIO della riga.
test("un test commentato via a blocco non e' un `.only` committato", () => {
  const spec = 'import { test } from "@playwright/test";\n\n/*\ntest.only("vecchio caso @flusso:a", async () => {});\n*/\n\ntest("x @flusso:a", async () => {});\n';
  assert.deepEqual(regoleSpec("e2e/a.spec.ts", spec), []);
});

test("`.only` nominato in un commento in coda a codice vero non e' un `.only`", () => {
  assert.deepEqual(regoleSpec("e2e/a.spec.ts", "const x = 1; // mai committare test.only(...)\n"), []);
});

test("un `.only` dopo un commento di blocco chiuso sulla stessa riga e' un block", () => {
  const findings = regoleSpec("e2e/a.spec.ts", '/* setup rapido */ test.only("x @flusso:a", async () => {});\n');
  assert.equal(findings[0]?.severity, "block", "il codice viene dopo il commento, e gira");
});

test("uno skip senza motivazione e' un issue", () => {
  const findings = regoleSpec("e2e/a.spec.ts", "test.skip('x', async () => {});");
  assert.equal(findings[0]?.severity, "issue");
});

// `test.fixme` spegne il test esattamente come `test.skip`, e al gate la spec
// resta li' col suo tag: il flusso risulta coperto. Misurato il 2026-07-28:
// nessun rilievo, `lint-spec` verde, `spec-coverage` verde.
test("`test.fixme` senza motivazione e' un issue come lo skip", () => {
  const findings = regoleSpec("e2e/a.spec.ts",
    'test.fixme("lo staff crea un corso @flusso:crea-corso", async ({ page }) => {});');
  assert.equal(findings[0]?.severity, "issue");
  assert.match(findings[0]?.message, /`\.fixme`/);
});

test("un `fixme` motivato nel commento sopra non produce rilievi", () => {
  assert.deepEqual(
    regoleSpec("e2e/a.spec.ts",
      '// rotto da handoff 10, rientra col fix di Gestionale Crafter\ntest.fixme("x @flusso:a", async () => {});'),
    []);
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

// Misurato il 2026-07-28: commentando insieme import e asserzione, `effetto-db`
// restava verde e ESLint taceva (un import commentato non e' una variabile
// inutilizzata). La stessa cancellazione senza commenti produceva il `block`:
// era il commento a portare il verde.
test("un'asserzione commentata via non guarda il database", () => {
  const spec = [
    'import { expect, test } from "@playwright/test";',
    '// import { corsoPerTitolo } from "./helpers/db";',
    'test("x @flusso:a", async ({ page }) => {',
    '  await expect(page.getByRole("status")).toHaveText("Corso creato");',
    '  // const riga = await corsoPerTitolo("Spinning");',
    "});",
  ].join("\n");
  const u = usaHelperDb(spec);
  assert.deepEqual({ importa: u.importa, chiama: u.chiama }, { importa: false, chiama: false });
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

// Un report malformato deve portare a un verdetto, mai a un'eccezione: il gate
// che esplode esce 1 senza JSON, e chi automatizza non lo distingue da un gate
// rosso. Le tre forme sono state misurate il 2026-07-28.
test("un report malformato produce un verdetto, non un'eccezione", () => {
  for (const rotto of [
    { suites: [], errors: { message: "boom" } },
    { suites: [], errors: "boom" },
    { suites: [null], errors: [] },
    { suites: [{ title: "a.spec.ts", specs: [null, { title: "x", tests: [null] }], suites: [] }], errors: [] },
  ]) {
    const esito = esitoPlaywright(rotto);
    // niente eccezione, e nessuno di questi casi puo' finire in un verde:
    // o non ha eseguito niente (MANCANTE), o il gate lo legge come rosso
    assert.equal(batteriaHaEseguito(esito) && esitoBatteriaVerde(esito), false,
      `verde su un report rotto: ${JSON.stringify(rotto)}`);
  }
});

test("un `errors` che non e' una lista non diventa quattro errori del runner", () => {
  const esito = esitoPlaywright({ suites: [], errors: "boom" });
  assert.equal(esito.errori.length, 1);
  assert.match(esito.errori[0], /non e' una lista/);
});

// La forma e' quella VERA, catturata il 2026-07-28 da `npx playwright test
// --reporter=json` sul banco `palestra` con le sei spec marcate `test.skip`:
// una suite per file, `tests[].status = "skipped"` e `results[].status` uguale.
// Un frammento inventato avrebbe provato la fixture, non la regola (§4.3 del
// verbale di costruzione).
const REPORT_TUTTI_SALTATI = {
  errors: [],
  suites: [
    { title: "accesso-socio.spec.ts", specs: [{ title: "il socio entra dalla UI vera @flusso:accesso-socio", tests: [{ status: "skipped", results: [{ status: "skipped" }] }] }], suites: [] },
    { title: "prenota-corso.spec.ts", specs: [{ title: "il socio prenota un corso @flusso:prenota-corso", tests: [{ status: "skipped", results: [{ status: "skipped" }] }] }], suites: [] },
  ],
};

test("una batteria in cui ogni test e' saltato NON ha eseguito niente", () => {
  const esito = esitoPlaywright(REPORT_TUTTI_SALTATI);
  assert.equal(esito.passati, 0);
  assert.equal(esito.falliti.length, 0);
  assert.equal(esito.saltati.length, 2);
  // il tranello: non e' fallito niente, quindi «verde» direbbe di si'
  assert.equal(esitoBatteriaVerde(esito), true, "e' proprio questo che rendeva il passo `pass`");
  assert.equal(batteriaHaEseguito(esito), false, "e questo e' cio' che lo rende MANCANTE");
});

test("una batteria che ha eseguito anche un solo test ha guardato", () => {
  const unoSolo = { errors: [], suites: [{ title: "a.spec.ts", specs: [
    { title: "x", tests: [{ status: "expected" }] },
    { title: "y", tests: [{ status: "skipped" }] },
  ], suites: [] }] };
  assert.equal(batteriaHaEseguito(esitoPlaywright(unoSolo)), true, "uno skip motivato resta legittimo");
});

test("una batteria tutta rossa ha eseguito: e' un difetto trovato, non una verifica mancante", () => {
  const rossa = { errors: [], suites: [{ title: "a.spec.ts", specs: [{ title: "x", tests: [{ status: "unexpected" }] }], suites: [] }] };
  assert.equal(batteriaHaEseguito(esitoPlaywright(rossa)), true);
});

// ------------------------- il flusso dichiarato che nessun test ha percorso
// Referto del 2026-08-06, § C2. `batteriaHaEseguito` e' un OR GLOBALE: un test
// verde qualunque soddisfaceva la premessa per TUTTI i flussi. Il collaudo P2
// aveva chiuso il 100% saltato; il 92% passava invisibile.
//
// Le spec qui sotto hanno la forma vera del reporter JSON di Playwright — una
// suite per file, `tests[].status`, `results[].status`, e l'annotazione `skip`
// con la motivazione scritta — perche' un frammento inventato proverebbe la
// fixture, non la regola (§4.3 del verbale di costruzione).

const specSaltata = (id) => ({
  title: `${id} — in attesa del seed @flusso:${id}`, ok: true, tags: [],
  tests: [{
    timeout: 30000, projectName: "chromium", expectedStatus: "skipped",
    annotations: [{ type: "skip", description: "in attesa del seed dei corsi (P.3)" }],
    results: [{ workerIndex: 0, status: "skipped", duration: 0, errors: [] }],
    status: "skipped",
  }],
  file: `${id}.spec.ts`, line: 4, column: 3,
});

const specPassata = (titolo, file) => ({
  title: titolo, ok: true, tags: [],
  tests: [{
    timeout: 30000, projectName: "chromium", expectedStatus: "passed", annotations: [],
    results: [{ workerIndex: 0, status: "passed", duration: 412, errors: [] }],
    status: "expected",
  }],
  file, line: 3, column: 3,
});

const reportDi = (specs) => ({
  config: { rootDir: "C:/banco/e2e", workers: 1 },
  suites: specs.map((s) => ({ title: s.file, file: s.file, column: 0, line: 0, specs: [s], suites: [] })),
  errors: [],
  stats: { startTime: "2026-08-06T12:00:00.000Z", duration: 1811 },
});

const FLUSSI_13 = [
  "accesso-socio", "prenota-corso", "disdici-corso", "paga-quota", "rinnova-tessera",
  "cambia-password", "aggiorna-profilo", "scarica-ricevuta", "iscrizione-gara",
  "annulla-iscrizione", "accesso-altrui", "modifica-altrui", "cancella-altrui",
].map((id) => ({ id, tipo: "positivo" }));

test("13 flussi dichiarati, 13 spec saltate e un test banale verde: ZERO flussi percorsi", () => {
  const report = reportDi([
    ...FLUSSI_13.map((f) => specSaltata(f.id)),
    specPassata("la home risponde", "fumo.spec.ts"),
  ]);
  const esito = esitoPlaywright(report);
  // il tranello riprodotto: le due funzioni storiche dicono entrambe di si'
  assert.equal(esitoBatteriaVerde(esito), true, "non e' fallito niente");
  assert.equal(batteriaHaEseguito(esito), true, "un test e' girato: l'OR globale e' soddisfatto");
  // e la misura per flusso dice la verita'
  const { percorsi, nonPercorsi } = flussiPercorsi(FLUSSI_13, esito);
  assert.deepEqual(percorsi, []);
  assert.equal(nonPercorsi.length, 13);
  assert.match(nonPercorsi[0].motivo, /sono state SALTATE/);
});

test("12 su 13: il 92% che passava invisibile e' un flusso non percorso come gli altri", () => {
  const report = reportDi([
    specPassata("il socio entra dalla UI vera @flusso:accesso-socio", "accesso-socio.spec.ts"),
    ...FLUSSI_13.slice(1).map((f) => specSaltata(f.id)),
  ]);
  const { percorsi, nonPercorsi } = flussiPercorsi(FLUSSI_13, esitoPlaywright(report));
  assert.deepEqual(percorsi, ["accesso-socio"]);
  assert.equal(nonPercorsi.length, 12);
});

test("tutti percorsi: nessun rilievo, e il conteggio si stampa lo stesso", () => {
  const report = reportDi(FLUSSI_13.map((f) => specPassata(`percorre ${f.id} @flusso:${f.id}`, `${f.id}.spec.ts`)));
  const { percorsi, nonPercorsi } = flussiPercorsi(FLUSSI_13, esitoPlaywright(report));
  assert.equal(percorsi.length, 13);
  assert.deepEqual(nonPercorsi, []);
  assert.match(rigaFlussiPercorsi(FLUSSI_13, percorsi), /^13 flussi critici su 13 percorsi davvero dal browser: /);
});

test("un flusso il cui unico test FALLISCE e' percorso: il browser lo ha giudicato", () => {
  // La distinzione che conta: un rosso e' un difetto TROVATO, non una verifica
  // mancante. Se contasse come non percorso, il passo direbbe MANCANTE su una
  // batteria che ha lavorato, e il verdetto punterebbe all'imputato sbagliato.
  const rosso = {
    ...specPassata("compra @flusso:paga-quota", "paga-quota.spec.ts"),
  };
  rosso.tests[0].status = "unexpected";
  rosso.tests[0].results = [{ workerIndex: 0, status: "failed", duration: 900, errors: [{ message: "expected 1 riga" }] }];
  const esito = esitoPlaywright(reportDi([rosso]));
  const { percorsi, nonPercorsi } = flussiPercorsi([{ id: "paga-quota", tipo: "positivo" }], esito);
  assert.deepEqual(percorsi, ["paga-quota"]);
  assert.deepEqual(nonPercorsi, []);
  assert.equal(esitoBatteriaVerde(esito), false, "e resta rosso, che e' il punto");
});

test("un test che passa al SECONDO tentativo ha comunque percorso il flusso", () => {
  const instabile = specPassata("compra @flusso:paga-quota", "paga-quota.spec.ts");
  instabile.tests[0].status = "flaky";
  const { percorsi } = flussiPercorsi([{ id: "paga-quota", tipo: "positivo" }], esitoPlaywright(reportDi([instabile])));
  assert.deepEqual(percorsi, ["paga-quota"]);
});

test("l'etichetta sta nel titolo del test, non solo nel testo del file: i due motivi si distinguono", () => {
  // Nessun test porta l'etichetta: si chiude scrivendola nel titolo, non
  // togliendo uno `.skip` che non c'e'. Due gesti diversi, due messaggi diversi.
  const report = reportDi([specPassata("prenota un corso qualsiasi", "prenota-corso.spec.ts")]);
  const { nonPercorsi } = flussiPercorsi([{ id: "prenota-corso", tipo: "positivo" }], esitoPlaywright(report));
  assert.equal(nonPercorsi.length, 1);
  assert.match(nonPercorsi[0].motivo, /nessun test ESEGUITO porta `@flusso:prenota-corso` nel titolo/);
});

test("l'etichetta nel titolo di un `describe` vale: il nome pieno del test la contiene", () => {
  const report = {
    errors: [],
    suites: [{
      title: "acquisto.spec.ts", file: "acquisto.spec.ts", specs: [],
      suites: [{
        title: "carrello @flusso:acquisto", file: "acquisto.spec.ts",
        specs: [specPassata("aggiunge e paga", "acquisto.spec.ts")], suites: [],
      }],
    }],
  };
  const { percorsi } = flussiPercorsi([{ id: "acquisto", tipo: "positivo" }], esitoPlaywright(report));
  assert.deepEqual(percorsi, ["acquisto"]);
});

test("un'etichetta eseguita che il contratto non dichiara non inventa un flusso percorso", () => {
  const report = reportDi([specPassata("gira @flusso:mai-dichiarato", "x.spec.ts")]);
  const { percorsi, nonPercorsi } = flussiPercorsi([{ id: "acquisto", tipo: "positivo" }], esitoPlaywright(report));
  assert.deepEqual(percorsi, []);
  assert.equal(nonPercorsi.length, 1);
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

// Regressione del 2026-07-30 (P3, banco Bottega Nord): il gate interrogava la
// 3000 dichiarata — occupata da un altro progetto — e la batteria percorreva la
// 3001 dove Next aveva spostato l'app. Due URL, nessun confronto, `app-viva`
// verde su un'app di uno sconosciuto.
test("l'URL che il gate ha interrogato viene imposto alla batteria", () => {
  const env = ambienteBatteria("http://127.0.0.1:3001", { PATH: "/usr/bin" });
  assert.equal(env.E2E_BASE_URL, "http://127.0.0.1:3001");
  assert.equal(env.PATH, "/usr/bin", "il resto dell'ambiente non si perde");
});

test("un E2E_BASE_URL rimasto da un altro progetto NON ha la precedenza", () => {
  const env = ambienteBatteria("http://127.0.0.1:3001", {
    E2E_BASE_URL: "http://127.0.0.1:3000",
  });
  assert.equal(env.E2E_BASE_URL, "http://127.0.0.1:3001");
});

test("senza URL risolto la variabile non viene inventata", () => {
  assert.equal(ambienteBatteria(null, { PATH: "/usr/bin" }).E2E_BASE_URL, undefined);
});

test("gli schemi esposti si leggono da [api].schemas", () => {
  assert.deepEqual(schemiEsposti(CONFIG), ["public", "graphql_public"]);
});

test("senza [api].schemas vale il default documentato di Supabase", () => {
  assert.deepEqual(schemiEsposti("[db]\nport = 58322\n"), ["public"]);
});

// W9 del collaudo di Schema Forge (2026-07-26), ereditato con la forma della
// funzione e riprodotto qui il 2026-07-28: un array TOML su piu' righe e'
// validissimo, ed e' come lo scrive chi ne elenca tre. Il ripiego silenzioso su
// `public` faceva interrogare un solo schema e stampare «schemi esposti:
// public» come se fosse la verita' del progetto.
test("gli schemi si leggono anche se l'array e' scritto su piu' righe", () => {
  const config = '[api]\nenabled = true\nport = 59321\nschemas = [\n  "public",\n  "graphql_public",\n  "catalogo",\n]\n\n[db]\nport = 59322\n';
  assert.deepEqual(schemiEsposti(config), ["public", "graphql_public", "catalogo"]);
  assert.equal(urlDbProgetto(config), "postgresql://postgres:postgres@127.0.0.1:59322/postgres",
    "la chiave dopo l'array multiriga si legge ancora");
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
  assert.deepEqual(
    formaEseguibile("npx", () => "C:\\Program Files\\nodejs\\npx.cmd", "win32", "C:\\Windows\\System32\\cmd.exe"),
    { file: "C:\\Windows\\System32\\cmd.exe", prefisso: ["/c", "C:\\Program Files\\nodejs\\npx.cmd"] });
});

test("su Windows un .exe si lancia col percorso pieno", () => {
  assert.deepEqual(formaEseguibile("psql", () => "C:\\scoop\\psql.exe", "win32"),
    { file: "C:\\scoop\\psql.exe", prefisso: [] });
});

// ------------------------------------- chi cerca, e dove NON cerca (§ C1)
// Referto del 2026-08-06: il gate si lancia dalla radice del progetto AUDITATO
// e `where` guarda li' prima che nel PATH. Le tre righe qui sotto CORREGGONO il
// test «fuori da Windows il nome nudo basta»: il nome nudo non basta piu', ed
// era proprio lui a farsi risolvere dalla cartella corrente.

test("su Windows si cerca col percorso pieno di where.exe e col prefisso $PATH:", () => {
  assert.deepEqual(comandoRicerca("psql", "win32", { SystemRoot: "C:\\Windows" }),
    { file: "C:\\Windows\\System32\\where.exe", args: ["$PATH:psql"] });
});

test("fuori da Windows si cerca con which, che legge il PATH e non la cartella corrente", () => {
  assert.deepEqual(comandoRicerca("psql", "linux", {}), { file: "which", args: ["psql"] });
});

test("la shell degli shim viene da ComSpec, col percorso pieno", () => {
  assert.equal(shellDiSistema({ ComSpec: "C:\\Windows\\System32\\cmd.exe" }), "C:\\Windows\\System32\\cmd.exe");
  assert.equal(shellDiSistema({ SystemRoot: "D:\\Win" }), "D:\\Win\\System32\\cmd.exe");
});

test("un eseguibile dentro il progetto auditato si riconosce, uno fuori no", () => {
  assert.equal(dentroLaRadice("C:\\prog\\node_modules\\.bin\\npx.cmd", "C:\\prog"), true);
  assert.equal(dentroLaRadice("C:\\scoop\\shims\\psql.exe", "C:\\prog"), false);
  // `C:\prog-altro` comincia per `C:\prog`: un confronto di prefissi sbaglierebbe
  assert.equal(dentroLaRadice("C:\\prog-altro\\psql.exe", "C:\\prog"), false);
  assert.equal(dentroLaRadice("C:\\prog", "C:\\prog"), false);
});

test("nome non risolto: file null, e chi lancia deve dire MANCANTE (mai il nome nudo)", () => {
  assert.deepEqual(formaEseguibile("psql", () => null, "win32"), { file: null, prefisso: [] });
  assert.deepEqual(formaEseguibile("psql", () => null, "linux"), { file: null, prefisso: [] });
});

test("fuori da Windows si cerca lo stesso, e si lancia il percorso trovato", () => {
  let cercato = false;
  const forma = formaEseguibile("psql", () => { cercato = true; return "/usr/bin/psql"; }, "linux");
  assert.deepEqual(forma, { file: "/usr/bin/psql", prefisso: [] });
  assert.equal(cercato, true);
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

// `references/sabotaggio.md` prescrive di incollare l'uscita del gate
// nell'handoff: quella citazione contiene una riga `Gate:` che NON e' una
// dichiarazione. Misurato il 2026-07-28: vinceva lei, e un handoff che
// dichiarava VERDE su un gate ROSSO passava — sul passo che esiste per
// impedire proprio quello.
test("la riga `Gate:` citata da un'esecuzione precedente non e' una dichiarazione", () => {
  const handoff = "# Handoff\n\nIeri il gate chiudeva cosi':\n\n```\nGate: ROSSO (2 falliti)\n```\n\n**Gate: VERDE** (0 falliti)\n";
  const esito = contrattoUscita("docs/handoff/12.md", handoff, CONFIG_PW, "ROSSO");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /dichiara `Gate: VERDE` ma il gate chiude ROSSO/);
});

test("uno snippet CI dentro un recinto non e' un segnaposto non compilato", () => {
  const handoff = "# Handoff\n\n```yaml\n  env:\n    CHIAVE: ${{ secrets.CHIAVE }}\n```\n\n**Gate: VERDE**\n";
  assert.equal(contrattoUscita("docs/handoff/12.md", handoff, CONFIG_PW, "VERDE").status, "pass");
});

test("un segnaposto nella prosa dell'handoff resta un segnaposto", () => {
  const esito = contrattoUscita("docs/handoff/12.md", "# Handoff\n\nFlussi: {{N}}\n\nGate: VERDE\n", CONFIG_PW, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /segnaposto/);
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

// Due falsi verdi misurati il 2026-07-28 sul config VERO del banco. Il secondo
// e' stato verificato eseguendo il runner: globale 1 + progetto 3 = quattro
// tentativi.
test("un commento che nomina `retries: 1` non copre un `retries: 3` vero", () => {
  const config = "export default defineConfig({\n  // retries: 1 e' la regola del gate (references/playwright.md)\n  retries: 3,\n});\n";
  const esito = contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n", config, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /retries: 3/);
});

test("`retries` alzato dentro `projects` boccia: scavalca quello globale", () => {
  const config = 'export default defineConfig({\n  retries: 1,\n  projects: [{ name: "chromium", retries: 3 }],\n});\n';
  const esito = contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n", config, "VERDE");
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /scavalca la globale/);
});

test("`retries: 1` dichiarato due volte (globale e progetto) va bene", () => {
  const config = 'export default defineConfig({\n  retries: 1,\n  projects: [{ name: "chromium", retries: 1 }],\n});\n';
  assert.equal(contrattoUscita("docs/handoff/12.md", "Gate: VERDE\n", config, "VERDE").status, "pass");
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

// ------- argomenti ostili a `cmd /c` (referto § H2/L1, 2026-08-06)
// Questo gate non aveva nessun filtro: passava a `cmd.exe /c` l'SQL intero e
// l'URL del database. Misurato su uno shim `.cmd` vero:
//   /&ver         → lo shim riceve `/`, e `ver` ESEGUE. status 0
//   %USERNAME%    → lo shim riceve `Utente`: l'argomento arriva espanso
//   /|ver         → lo shim non parte affatto, parte `ver`. status 0
//   />rubato.txt  → status 0, e su disco compare `rubato.txt`

test("i metacaratteri di cmd sono ostili: attraverso `cmd /c` eseguono codice", () => {
  for (const arg of ["/&ver", "%USERNAME%", "/|ver", "/>rubato.txt", "a<b", "(x)", 'dice"quello', "a^b"]) {
    assert.deepEqual(argomentiOstiliACmd([arg], "win32"), [arg], `passava: ${arg}`);
  }
});

test("l'SQL con gli spazi e' ostile a cmd: e' l'argomento che questo gate passa piu' spesso", () => {
  const sql = "select count(*) from information_schema.tables";
  assert.deepEqual(argomentiOstiliACmd([sql], "win32"), [sql]);
});

test("gli argomenti veri di psql senza spazi restano leciti", () => {
  assert.deepEqual(argomentiOstiliACmd(
    ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-At", "-X"], "win32"), []);
});

test("fuori da Windows non c'e' cmd, e nessun argomento e' ostile", () => {
  assert.deepEqual(argomentiOstiliACmd(["/&ver", "select 1"], "linux"), []);
});

test("il motivo nomina i caratteri colpevoli, non dice solo `errore`", () => {
  const motivo = motivoOstile(["/&ver"]);
  assert.match(motivo, /E' una shell/);
  assert.match(motivo, /& \| < > \^ \( \) " %/);
  assert.ok(motivo.includes('"/&ver"'));
});

// ---------------- quando il limite scatta (referto § H10 / § M14 / § L10)
// Questo gate era l'UNICO della casa ad avere un limite — `AbortSignal.timeout`
// sulla sonda dell'app — e si e' visto: il 2026-08-06, contro un server che
// accetta e non risponde, e' tornato in 18,2 s con un ROSSO leggibile, dove
// speed-demon restava appeso finche' non lo uccidevano (120 s, zero righe).
// Ma psql e Playwright, qui dentro, un limite non ce l'avevano.

test("un processo ucciso dal limite si distingue da uno che ha risposto male", () => {
  // La forma vera di `spawnSync` col `timeout` scattato, misurata:
  //   status: null · signal: "SIGKILL" · error.code: "ETIMEDOUT"
  assert.equal(scaduto({ status: null, signal: "SIGKILL", error: { code: "ETIMEDOUT" } }), true);
  assert.equal(scaduto({ status: 1, stdout: "", stderr: "boom" }), false, "uno strumento che boccia ha risposto");
  assert.equal(scaduto({ status: null, error: { code: "ENOENT" } }), false, "e uno assente non e' uno lento");
  assert.equal(scaduto(null), false);
});

test("il motivo dice QUALE comando, QUANTO ha aspettato, e che vale MANCANTE", () => {
  const motivo = motivoScaduto("npx playwright test", 1_800_000);
  assert.match(motivo, /`npx playwright test`/);
  assert.match(motivo, /entro 1800 s/);
  assert.match(motivo, /MANCANTE, non un successo/);
});

// ── la password non esce dal gate (referto § M2, 2026-08-06) ────────────────
// Il mascheramento in casa era `replace(/:[^:@]*@/, ":***@")`
// (`vetrina-crafter/verify.mjs:378`). Le tre forme qui sotto sono quelle su cui
// una regexp sbaglia e `new URL` no: sono la ragione per cui questa funzione
// non e' una regexp.

test("la password sparisce dalla URL di connessione", () => {
  assert.equal(
    mascheraUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    "postgresql://postgres:***@127.0.0.1:54322/postgres",
  );
});

test("una password con `:` dentro sparisce TUTTA (la regexp ne lasciava meta')", () => {
  const mascherata = mascheraUrl("postgresql://postgres:p%40ss:word@db.example.com:5432/prod?sslmode=require");
  assert.equal(mascherata, "postgresql://postgres:***@db.example.com:5432/prod?sslmode=require");
  assert.doesNotMatch(mascherata, /p%40ss/, "la regexp fermandosi al primo `:` lasciava in chiaro `p%40ss`");
});

test("una URL senza password resta intatta (la regexp la distruggeva)", () => {
  assert.equal(
    mascheraUrl("postgresql://postgres@127.0.0.1:54322/postgres"),
    "postgresql://postgres@127.0.0.1:54322/postgres",
  );
  // `:[^:@]*@` non e' ancorato all'autorita': qui mordeva dentro la query.
  assert.equal(
    mascheraUrl("postgres://127.0.0.1:5432/db?opt=a:b@c"),
    "postgres://127.0.0.1:5432/db?opt=a:b@c",
  );
});

test("cio' che non e' una URL e contiene una `@` non si stampa affatto", () => {
  assert.match(mascheraUrl("postgres:pw@host senza schema"), /nascosta/);
  assert.equal(mascheraUrl("non-una-url"), "non-una-url", "senza `@` non c'e' niente da nascondere");
  assert.equal(mascheraUrl(null), "");
  assert.equal(mascheraUrl(undefined), "");
});

test("mascherare due volte non cambia niente: il gate a valle puo' rifarlo", () => {
  const una = mascheraUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  assert.equal(mascheraUrl(una), una);
});

// ── il `#` che apre un commento TOML, e quello che non lo apre (§ L7) ────────
// `senzaVirgolette` toglieva il commento con una regexp che morde anche dentro
// una stringa, ed era mitigata a meta': la cella col `#` la toglieva, la coda
// del commento dopo la virgola no. Due difetti opposti, una causa sola.

test("un frammento nell'URL dell'app non e' un commento", () => {
  assert.equal(
    urlAppProgetto(`[auth]\nsite_url = "http://127.0.0.1:3100/#/app"\n`),
    "http://127.0.0.1:3100/#/app",
  );
});

test("un commento dentro l'array multi-riga non diventa uno schema", () => {
  assert.deepEqual(
    schemiEsposti('[api]\nschemas = [\n  "public",\n  "shop", # esposto anche qui, vedi PROGETTO.md\n]\n'),
    ["public", "shop"],
  );
});

test("ma un `#` DENTRO una stringa e' parte del nome", () => {
  assert.deepEqual(schemiEsposti('[api]\nschemas = ["public", "grafico#1"] # nota\n'), ["public", "grafico#1"]);
  assert.deepEqual(schemiEsposti("[api]\nschemas = ['a#b']\n"), ["a#b"]);
});

test("senzaCommentoToml: dove taglia e dove no", () => {
  assert.equal(senzaCommentoToml("port = 58322 # il banco"), "port = 58322 ");
  assert.equal(senzaCommentoToml('url = "http://x/#/app"'), 'url = "http://x/#/app"');
  assert.equal(senzaCommentoToml('a = "una \\" virgoletta # dentro"'), 'a = "una \\" virgoletta # dentro"');
  assert.equal(senzaCommentoToml("# tutta la riga"), "");
  assert.equal(senzaCommentoToml(null), "");
});

// ── M5 — ReDoS vero su `IMPORT_HELPER_DB` (referto § M5, 2026-08-06) ─────────
// Misurato su questa macchina, con una spec fatta di soli spazi fra `import` e
// `from`:  1 000 -> 1,6 s · 2 000 -> 15,0 s · 4 000 -> non finito in due minuti.
// E il costo si paga UNA VOLTA PER FLUSSO.

test("un ingresso ostile non fa piu' impiegare secondi al gate", () => {
  const ostile = `import ${" ".repeat(40_000)} from "./x";`;
  const inizio = process.hrtime.bigint();
  usaHelperDb(ostile);
  const ms = Number(process.hrtime.bigint() - inizio) / 1e6;
  assert.ok(ms < 500, `40 000 caratteri in ${ms.toFixed(1)} ms (prima: 2 000 caratteri in 15 000 ms)`);
});

test("la clausola si legge ancora, e solo quella dell'helper giusto", () => {
  const spec = [
    'import { test, expect } from "@playwright/test";',
    'import { contaProdotti } from "./helpers/db";',
    "",
    'test("x", async () => { await contaProdotti(); });',
  ].join("\n");
  assert.deepEqual(usaHelperDb(spec), { importa: true, chiama: true, nomi: ["contaProdotti"] });
});

test("l'import c'e' ma la chiamata no: la regola scatta ancora", () => {
  const spec = [
    'import { test, expect } from "@playwright/test";',
    'import { contaProdotti } from "./helpers/db";',
    'test("x", async () => { expect(1).toBe(1); });',
  ].join("\n");
  assert.equal(usaHelperDb(spec).chiama, false);
});

test("clausoleHelperDb non risale oltre la fine dell'istruzione precedente", () => {
  // Il `;` fra i due: senza il controllo, la clausola sarebbe tutta la riga
  // precedente e i nomi raccolti sarebbero `test` ed `expect` — cioe' il
  // difetto chiuso il 2026-07-28, che questa riscrittura non deve riaprire.
  const spec = 'import { test, expect } from "@playwright/test";\nconst x = 1;\nimport { q } from "./helpers/db";';
  assert.deepEqual(usaHelperDb(spec).nomi, ["q"]);
  assert.deepEqual(clausoleHelperDb(spec).map((c) => c.trim()), ["{ q }"]);
});

test("un `from \"…helpers/db\"` senza import davanti non produce niente", () => {
  assert.deepEqual(clausoleHelperDb('const s = 1;\nexport * from "./helpers/db";'), []);
});

// ── L11: `motivato()` leggeva `//` dentro una stringa ────────────────────────

test("un `//` dentro il titolo di uno skip non e' una motivazione", () => {
  const f = regoleSpec("e2e/x.spec.ts", 'test.skip("apre https://esempio.test//home", async () => {});');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "issue");
});

test("ma un commento vero, in coda o sopra, lo e' ancora", () => {
  assert.deepEqual(regoleSpec("e2e/x.spec.ts", 'test.skip("x", async () => {}); // rientra col carrello, ROADMAP §3'), []);
  assert.deepEqual(regoleSpec("e2e/x.spec.ts", '// rientra col carrello, ROADMAP §3\ntest.skip("x", async () => {});'), []);
});

test("un `.only` NOMINATO dentro una stringa non e' un `.only` committato", () => {
  const spec = 'test("nota", async () => { await expect(page.getByText("test.only(")).toBeVisible(); });';
  assert.deepEqual(regoleSpec("e2e/x.spec.ts", spec), []);
});

test("e un `.only` vero resta un block", () => {
  const f = regoleSpec("e2e/x.spec.ts", 'test.only("x", async () => {});');
  assert.equal(f[0].severity, "block");
});

// ── L3: la ricorsione sull'albero del report Playwright ─────────────────────
// Profondita' 20 000 -> `RangeError: Maximum call stack size exceeded`, il
// processo moriva senza JSON. Il report lo scrive Playwright, ma il gate legge
// un file che sta nel progetto AUDITATO: la profondita' non e' un dato di cui
// possa fidarsi.

test("un albero profondo 20 000 non fa morire il gate", () => {
  let radice = { title: "in fondo", specs: [{ title: "spec", tests: [{ status: "expected" }] }], suites: [] };
  for (let i = 0; i < 20_000; i++) radice = { title: `s${i}`, specs: [], suites: [radice] };
  const esito = esitoPlaywright({ suites: [radice] });
  assert.equal(esito.passati, 1);
});

// ── L2: la password fuori dalla riga di comando ─────────────────────────────

test("la password lascia la URL e passa da PGPASSWORD", () => {
  const c = credenzialiPsql("postgresql://postgres:segreta@127.0.0.1:7622/postgres");
  assert.equal(c.url, "postgresql://postgres@127.0.0.1:7622/postgres");
  assert.deepEqual(c.env, { PGPASSWORD: "segreta" });
});

test("una password percent-encoded arriva letterale nell'ambiente", () => {
  assert.deepEqual(credenzialiPsql("postgresql://u:p%40ss%3Aword@h:5432/d").env, { PGPASSWORD: "p@ss:word" });
});

test("senza password non cambia niente: nessuna variabile, URL com'era", () => {
  const c = credenzialiPsql("postgresql://postgres@127.0.0.1:7622/postgres");
  assert.equal(c.url, "postgresql://postgres@127.0.0.1:7622/postgres");
  assert.deepEqual(c.env, {});
});

test("cio' che non e' una URL si passa com'e': e' una stringa a parole chiave di libpq", () => {
  assert.deepEqual(credenzialiPsql("dbname=postgres host=127.0.0.1"),
    { url: "dbname=postgres host=127.0.0.1", env: {}, errore: null });
});

// ── le tre porte che il tribunale ha trovato ancora aperte (2026-08-07) ──────
// Sonde del concilio di /code-inquisition sul pacchetto P.7e stesso: la
// correzione di M2/L2 chiudeva l'autorita' e lasciava aperte altre due strade.

test("una password con un `%` mal codificato NON ricade sulla URL originale", () => {
  // `new URL` accetta un `%` che non introduce due cifre esadecimali e lo
  // lascia testuale; `decodeURIComponent` no. Prima il `try` avvolgeva anche
  // quella riga, e la ricaduta rimetteva la password in chiaro dentro `argv` —
  // e psql la rimandava nel proprio stderr, che tre gate stampano grezzo.
  const c = credenzialiPsql("postgresql://ruolo:Segreta%Finale@db.example.com:5432/prod");
  assert.equal(c.url, null, "non si interroga con una URL che riporta indietro la password");
  assert.deepEqual(c.env, {});
  assert.match(c.errore, /codifica percentuale non valida/);
});

test("una credenziale nel parametro di query si rifiuta, non si riscrive", () => {
  // libpq accetta `?password=`, ed e' la forma che si usa proprio per evitare
  // le fughe nell'userinfo. Riscrivere la query per toglierla vorrebbe dire
  // riserializzarla, e `searchParams` ricodifica `%20` in `+` — che per
  // l'`options` di libpq non e' uno spazio.
  for (const parametro of ["password", "sslpassword"]) {
    const c = credenzialiPsql(`postgresql://ruolo@db.example.com/prod?${parametro}=SuperSegreta123`);
    assert.equal(c.url, null, parametro);
    assert.match(c.errore, new RegExp(parametro));
  }
});

test("e nemmeno si stampa: mascheraUrl la nasconde invece di mascherarla a meta'", () => {
  assert.match(mascheraUrl("postgresql://ruolo@db.example.com/prod?password=SuperSegreta123"), /nascosta/);
  assert.doesNotMatch(mascheraUrl("postgresql://ruolo@db.example.com/prod?password=SuperSegreta123"), /SuperSegreta/);
});

test("una URL con `options` sopravvive intatta: e' il motivo per cui non si riscrive", () => {
  const c = credenzialiPsql("postgresql://u:p@h/d?options=-c%20statement_timeout%3D0&sslmode=require");
  assert.equal(c.url, "postgresql://u@h/d?options=-c%20statement_timeout%3D0&sslmode=require");
  assert.deepEqual(c.env, { PGPASSWORD: "p" });
});

test("un PGPASSWORD ereditato non autentica al posto della URL del progetto", () => {
  const prima = process.env.PGPASSWORD;
  try {
    process.env.PGPASSWORD = "ereditata-da-un-altro-progetto";
    assert.equal(ambientePsql(credenzialiPsql("postgresql://u@h/d")).PGPASSWORD, undefined,
      "la URL non dichiara password: un residuo d'ambiente non deve autenticare per conto nostro");
    assert.equal(ambientePsql(credenzialiPsql("postgresql://u:vera@h/d")).PGPASSWORD, "vera");
  } finally {
    if (prima === undefined) delete process.env.PGPASSWORD;
    else process.env.PGPASSWORD = prima;
  }
});

// ── sonda ostile: nemmeno una stringa configura qualcosa (P.7e, 2026-08-06) ──
// `senzaCommentiJs` diceva «le stringhe restano: un `//` dentro un URL non apre
// un commento, ed e' il solo caso che si incontra in un file di
// configurazione» — la stessa frase del difetto n°50, una tolleranza aggiunta
// per un caso e pagata su un altro.

test("un `retries` scritto dentro una stringa non dichiara niente", () => {
  const esito = contrattoUscita(
    "docs/handoff/09-flow-sentinel.md", "Gate: VERDE\n",
    'export default { use: { nota: "retries: 1" } };', "VERDE",
  );
  assert.equal(esito.status, "fail");
  assert.match(esito.detail, /non dichiara `retries`/);
});

test("ma un `retries: 1` vero continua a bastare, commento sopra compreso", () => {
  const cfg = "// retries: 3 sarebbe sbagliato\nexport default {\n  retries: 1,\n};";
  assert.equal(contrattoUscita("docs/handoff/09-flow-sentinel.md", "Gate: VERDE\n", cfg, "VERDE").status, "pass");
});

test("e il `retries: 3` dentro `projects` resta un fail", () => {
  const cfg = "export default {\n  retries: 1,\n  projects: [{ retries: 3 }],\n};";
  assert.match(contrattoUscita("docs/handoff/09-flow-sentinel.md", "Gate: VERDE\n", cfg, "VERDE").detail, /retries: 3/);
});

test("l'helper del database vive dentro una stringa, e li' resta leggibile", () => {
  // La stessa funzione con l'altra risposta: due domande diverse, due
  // spogliatori. Se qui le stringhe si svuotassero, il percorso del modulo
  // sparirebbe e nessuna spec risulterebbe mai importare l'helper.
  const spec = 'import { test } from "@playwright/test";\nimport { conta } from "./helpers/db";\ntest("x", async () => { await conta(); });';
  assert.deepEqual(usaHelperDb(spec), { importa: true, chiama: true, nomi: ["conta"] });
});

// ── il concilio sul pacchetto stesso (2026-08-07) ───────────────────────────

test("un backtick che CHIUDE un template non apre una stringa nuova", () => {
  // REGRESSIONE di P.7e: `delimitatore` rinasceva a ogni riga mentre `inBlocco`
  // no, quindi la riga che chiude un template multi-riga cominciava con un
  // backtick e spegneva il resto della riga. `.only` committato, zero rilievi.
  const spec = "const q = `\n  select 1\n`; test.only(\"x\", async () => {});";
  const findings = regoleSpec("a.spec.ts", spec);
  assert.equal(findings.length, 1, "prima erano zero");
  assert.equal(findings[0].severity, "block");
});

test("e un apostrofo a inizio riga nemmeno", () => {
  assert.equal(regoleSpec("a.spec.ts", "'; test.only(\"x\", async () => {});").length, 1);
});

test("LIMITE DICHIARATO: l'interno di un template multi-riga si legge come codice", () => {
  // Lo scanner delle spec analizza RIGA per riga — `inBlocco` attraversa le
  // righe, lo stato della stringa no — quindi le righe interne di un template
  // multi-riga sono «codice». Un `test.only(` scritto li' dentro produce un
  // rilievo su una riga che non gira: ROSSO falso, non verde falso, cioe' il
  // verso rumoroso. Estendere lo stato della stringa a tutto il file
  // riaprirebbe il difetto opposto, che e' quello silenzioso. Sta scritto
  // perche' e' una scelta, non una svista: il concilio l'ha misurata il
  // 2026-08-07 e resta MANCANTE con la sua ragione.
  const spec = "const q = `\n  test.only( — questo e' testo\n`;\ntest(\"x\", async () => {});";
  const findings = regoleSpec("a.spec.ts", spec);
  assert.equal(findings.length, 1, "il limite e' questo, e va visto");
  assert.equal(findings[0].object, "a.spec.ts:2");
});

test("la clausola dell'helper non risale oltre la fine dell'istruzione: la rete c'e'", () => {
  // La riga `if (FINE_ISTRUZIONE.test(clausola)) continue;` e' sopravvissuta a
  // una mutazione del concilio: senza, il gate risale all'import di
  // `@playwright/test`, raccoglie `test`/`expect` come nomi dell'helper e vede
  // un `expect(...)` qualsiasi come chiamata al database.
  const spec = [
    'import { test, expect } from "@playwright/test";',
    "const x = 1;",
    'test("x", async () => { expect(1).toBe(1); });',
    'import { q } from "./helpers/db";',
  ].join("\n");
  assert.deepEqual(clausoleHelperDb(spec).map((c) => c.trim()), ["{ q }"]);
  assert.deepEqual(usaHelperDb(spec).nomi, ["q"]);
});

test("e un flusso le cui spec non guardano il database resta un block", () => {
  const flussi = [{ id: "acquisto", tipo: "positivo" }];
  const spec = [{ file: "e2e/acquisto.spec.ts", testo: 'import { test, expect } from "@playwright/test";\ntest("x @flusso:acquisto", async () => { expect(1).toBe(1); });' }];
  const findings = findingsEffettoDb(flussi, spec, new Map([["acquisto", ["e2e/acquisto.spec.ts"]]]));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
});
