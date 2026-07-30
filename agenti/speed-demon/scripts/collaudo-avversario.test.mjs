/**
 * collaudo-avversario.test.mjs — le regressioni del collaudo del 2026-07-30.
 *
 * Ogni test qui sotto e' un difetto MISURATO su `banco-prova-immobiliare`
 * prima di essere corretto: il verbale con le esecuzioni e' in
 * `COLLAUDO-AVVERSARIO-2026-07-30.md`. Stanno in un file a parte perche' hanno
 * una provenienza comune, e chi un giorno vorra' sapere «perche' questa regola
 * esiste» trova qui la risposta invece di doverla dedurre.
 *
 * Vale la regola della casa anche qui: per ogni regola il caso in cui SCATTA e
 * quello in cui NON deve scattare. Il secondo e' quello che conta.
 *
 *   node --test "scripts/**\/*.test.mjs"
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  eLaMiaBuild,
  findingsBudget,
  findingsSeo,
  formFactorDa,
  leggiContratto,
  metatagDaHtml,
  misuraStabile,
} from "./gate-lib.mjs";

// ---------------------------------------------------------------------------
// 1. Il contratto scritto seguendo il template della skill.
//
// Il 2026-07-30 un `docs/performance.md` compilato attenendosi a
// `resources/templates/performance.md` ha chiuso il passo
// `contratto-performance` in ROSSO con cinque rilievi, e nessuno riguardava il
// sito: «4 pagine · form factor: mobile · deroghe scritte: 0» su un contratto
// che dichiarava profilo desktop e una deroga scritta.
// ---------------------------------------------------------------------------

const DAL_TEMPLATE = [
  "# Performance e SEO — Vivaio Corte Vecchia",
  "",
  "Confermato da: Elena Barbieri (titolare) (2026-07-24)",
  "",
  "## Metodo",
  "",
  "Metodo: build di produzione · 3 giri · mediana · profilo desktop",
  "URL misurato: http://127.0.0.1:3100",
  "Dispersione massima ammessa: 5 punti di categoria",
  "",
  "## `home` — /",
  "",
  "**Tipo:** pubblica",
  "",
  "| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |",
  "|---|---|---|---|---|",
  "| `performance` | >= 85 | 71 | ±4 | 93 |",
  "| `accessibility` | >= 95 | 96 | ±0 | 96 |",
  "",
  "## Deroghe",
  "",
  "| Pagina | Categoria | Soglia | Misurato | Motivo scritto | Confermata da |",
  "|---|---|---|---|---|---|",
  "| `home` | `performance` | >= 85 | 79 | La galleria apre con cinque foto a piena larghezza, richieste per iscritto nel brief. | Elena Barbieri (titolare) (2026-07-24) |",
  "",
].join("\n");

/** La forma a tre colonne di `banco-prova-negozio`, che passava gia' prima. */
const DAL_BANCO = [
  "# Performance — Bottega Nord",
  "",
  "Confermato da: ORCHESTRATORE (2026-07-30)",
  "Form factor: desktop",
  "",
  "## `home` — /",
  "",
  "| categoria | soglia |",
  "|---|---|",
  "| performance | 95 |",
  "| seo | 100 |",
  "",
  "## Deroghe",
  "",
  "| pagina | categoria | motivo |",
  "|---|---|---|",
  "| `home` | seo | La pagina di accesso non deve vendere niente. |",
  "",
].join("\n");

test("le soglie del template si leggono: apici inversi e `>=` sono ornamento", () => {
  assert.deepEqual(leggiContratto(DAL_TEMPLATE).pagine[0].soglie, {
    performance: 85,
    accessibility: 95,
  });
});

test("la deroga a sei colonne si legge, e il motivo non inghiotte le altre colonne", () => {
  const c = leggiContratto(DAL_TEMPLATE);
  assert.equal(c.deroghe.length, 1);
  assert.equal(c.deroghe[0].pagina, "home");
  assert.equal(c.deroghe[0].categoria, "performance");
  assert.match(c.deroghe[0].motivo, /^La galleria apre/);
  assert.doesNotMatch(c.deroghe[0].motivo, /\|/, "aveva inghiottito soglia, misurato e firma");
});

test("una firma umana con nome e ruolo e' una firma", () => {
  assert.equal(leggiContratto(DAL_TEMPLATE).confermatoDa, "Elena Barbieri (titolare) (2026-07-24)");
});

test("il segnaposto del template resta rifiutato", () => {
  const testo = "Confermato da: {{UMANO (nome, ruolo) | ORCHESTRATORE}} ({{AAAA-MM-GG}})\n";
  assert.equal(leggiContratto(testo).confermatoDa, null);
});

test("una firma che non nomina nessuno non e' una firma", () => {
  for (const finta of ["—", "TODO", "da compilare", "-", "?"]) {
    assert.equal(leggiContratto(`Confermato da: ${finta}\n`).confermatoDa, null, finta);
  }
});

test("`profilo desktop` nella riga Metodo vale quanto `Form factor: desktop`", () => {
  assert.equal(leggiContratto(DAL_TEMPLATE).formFactor, "desktop");
  assert.equal(formFactorDa("Metodo: build di produzione · 3 giri · profilo mobile\n"), "mobile");
});

test("`Form factor:` vince su `profilo`, perche' e' la riga piu' esplicita", () => {
  assert.equal(formFactorDa("Form factor: desktop\nMetodo: · profilo mobile\n"), "desktop");
});

test("senza nessuna delle due righe si assume mobile, il default di Lighthouse", () => {
  assert.equal(formFactorDa("Confermato da: ORCHESTRATORE\n"), "mobile");
});

test("la dispersione massima e l'URL misurato si leggono dal contratto", () => {
  const c = leggiContratto(DAL_TEMPLATE);
  assert.equal(c.dispersioneMassima, 5);
  assert.equal(c.urlDichiarato, "http://127.0.0.1:3100");
});

test("un contratto che non li dichiara li lascia nulli: chi chiama usa il ripiego", () => {
  const c = leggiContratto(DAL_BANCO);
  assert.equal(c.dispersioneMassima, null);
  assert.equal(c.urlDichiarato, null);
});

test("la forma a tre colonne del banco continua a leggersi", () => {
  const c = leggiContratto(DAL_BANCO);
  assert.deepEqual(c.pagine[0].soglie, { performance: 95, seo: 100 });
  assert.equal(c.deroghe.length, 1);
  assert.equal(c.deroghe[0].categoria, "seo");
});

test("una tabella di deroghe senza intestazione riconoscibile non produce deroghe inventate", () => {
  const testo = [
    "Confermato da: ORCHESTRATORE",
    "",
    "## Deroghe",
    "",
    "| a | b | c |",
    "|---|---|---|",
    "| `home` | performance | motivo |",
    "",
  ].join("\n");
  assert.deepEqual(leggiContratto(testo).deroghe, []);
});

test("la soglia di dispersione del contratto vince su quella della casa", () => {
  // misurato sul banco: immobili (/immobili) · performance 75±8
  assert.equal(misuraStabile([71, 75, 79], 10).stabile, true, "col vecchio 10 cablato passava");
  assert.equal(misuraStabile([71, 75, 79], 5).stabile, false, "col 5 firmato nel contratto e' MANCANTE");
  assert.match(misuraStabile([71, 75, 79], 5).motivo, /massimo ammesso 5/);
});

// ---------------------------------------------------------------------------
// 2. SEO: contare, non trovare.
//
// `references/seo.md` §309 e §313 descrivevano tutti e tre questi difetti
// prima che esistesse il gate. Il gate non ne implementava nessuno.
// ---------------------------------------------------------------------------

const testa = (dentro) => `<html><head>${dentro}</head><body></body></html>`;
const sana = (percorso, canonical = percorso) =>
  metatagDaHtml(testa(`<title>T ${percorso}</title><meta name="description" content="d">
    <link rel="canonical" href="${canonical}">`));

test("un `<title>` dentro un `<svg>` non e' il titolo del documento", () => {
  const html = `<html><head><meta name="description" content="d"><link rel="canonical" href="/agenzia"></head>
    <body><svg role="img"><title>Telefono</title><path/></svg></body></html>`;
  assert.equal(metatagDaHtml(html).title, null);
  const findings = findingsSeo([{ id: "a", percorso: "/agenzia" }], new Map([["a", metatagDaHtml(html)]]));
  assert.equal(findings.filter((f) => /manca `title`/.test(f.message)).length, 1);
});

test("il titolo vero si legge anche se nel corpo c'e' un'icona con il suo", () => {
  const html = `<html><head><title>L'agenzia — Case di Langa</title></head>
    <body><svg><title>Telefono</title></svg></body></html>`;
  assert.equal(metatagDaHtml(html).title, "L'agenzia — Case di Langa");
});

test("due `<title>` nello stesso documento sono un block", () => {
  const tag = metatagDaHtml(testa(`<title>Vero</title><meta name="description" content="d">
    <link rel="canonical" href="/x"><title>Issato da un componente</title>`));
  const findings = findingsSeo([{ id: "x", percorso: "/x" }], new Map([["x", tag]]));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /2 `title`/);
});

test("due `rel=canonical` sono un block: Google li ignora entrambi", () => {
  const tag = metatagDaHtml(testa(`<title>T</title><meta name="description" content="d">
    <link rel="canonical" href="/x"><link rel="canonical" href="/x?a=1">`));
  const bloccanti = findingsSeo([{ id: "x", percorso: "/x" }], new Map([["x", tag]]))
    .filter((f) => f.severity === "block");
  assert.equal(bloccanti.length, 1);
  assert.match(bloccanti[0].message, /ENTRAMBI/);
});

test("`robots` si legge in tutt'e due gli ordini degli attributi", () => {
  assert.equal(metatagDaHtml(`<meta name="robots" content="noindex, nofollow">`).robots, "noindex, nofollow");
  assert.equal(metatagDaHtml(`<meta content="noindex, nofollow" name="robots">`).robots, "noindex, nofollow");
});

test("un `X-Robots-Tag: noindex` e' un block quanto il metatag", () => {
  const tag = metatagDaHtml(testa(`<title>T</title><meta name="description" content="d">
    <link rel="canonical" href="/x">`), new Map([["x-robots-tag", "noindex"]]));
  const findings = findingsSeo([{ id: "x", percorso: "/x" }], new Map([["x", tag]]));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /X-Robots-Tag/);
});

test("un `X-Robots-Tag` che non esclude non produce niente", () => {
  const tag = metatagDaHtml(testa(`<title>T</title><meta name="description" content="d">
    <link rel="canonical" href="/x">`), new Map([["x-robots-tag", "index, follow"]]));
  assert.deepEqual(findingsSeo([{ id: "x", percorso: "/x" }], new Map([["x", tag]])), []);
});

// ---------------------------------------------------------------------------
// 3. SEO: il canonical che appartiene a un'altra pagina.
// ---------------------------------------------------------------------------

test("due pagine che dichiarano lo stesso canonical: una delle due esce dall'indice", () => {
  const pagine = [{ id: "home", percorso: "/" }, { id: "immobili", percorso: "/immobili" }];
  const tag = new Map([["home", sana("/", "http://x/")], ["immobili", sana("/immobili", "http://x/")]]);
  const bloccanti = findingsSeo(pagine, tag).filter((f) => f.severity === "block");
  assert.equal(bloccanti.length, 1);
  assert.match(bloccanti[0].message, /stesso `canonical`/);
});

test("un canonical che punta altrove e' un warn, non un block: puo' essere voluto", () => {
  const altrove = findingsSeo([{ id: "v", percorso: "/immobili" }], new Map([["v", sana("/immobili", "/")]]));
  assert.equal(altrove.length, 1);
  assert.equal(altrove[0].severity, "warn");
});

test("il canonical di se stessa, con o senza barra finale, non produce niente", () => {
  assert.deepEqual(findingsSeo([{ id: "h", percorso: "/" }], new Map([["h", sana("/", "http://x/")]])), []);
  assert.deepEqual(
    findingsSeo([{ id: "c", percorso: "/contatti" }], new Map([["c", sana("/contatti", "http://x/contatti/")]])),
    [],
  );
});

// ---------------------------------------------------------------------------
// 4. La pagina dichiarata che rimanda altrove.
//
// Misurato: `/riservata` dichiarata, `/contatti` letta e misurata,
// `performance 100` scritta accanto al nome sbagliato.
// ---------------------------------------------------------------------------

test("una pagina che rimanda altrove e' un block, e non si leggono i suoi tag", () => {
  const findings = findingsSeo(
    [{ id: "riservata", percorso: "/riservata" }],
    new Map(),
    new Map([["riservata", "/contatti"]]),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].message, /rimanda a `\/contatti`/);
});

test("senza rimandi la mappa vuota non cambia niente", () => {
  assert.deepEqual(findingsSeo([{ id: "h", percorso: "/" }], new Map([["h", sana("/")]]), new Map()), []);
});

// ---------------------------------------------------------------------------
// 5. Le deroghe che non coprono niente.
// ---------------------------------------------------------------------------

test("una deroga su una pagina che rispetta la soglia e' un warn, non un silenzio", () => {
  const pagine = [{ id: "immobili", percorso: "/immobili", soglie: { performance: 80 } }];
  const misure = new Map([["immobili", { performance: { mediana: 100, dispersione: 0, stabile: true } }]]);
  const deroghe = [{ pagina: "immobili", categoria: "performance", motivo: "le foto sono degli originali" }];
  const findings = findingsBudget(pagine, misure, deroghe);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "warn");
  assert.match(findings[0].message, /non copre niente/);
});

test("una deroga che nomina una pagina non dichiarata e' un warn", () => {
  const pagine = [{ id: "home", percorso: "/", soglie: { performance: 90 } }];
  const misure = new Map([["home", { performance: { mediana: 95, dispersione: 0, stabile: true } }]]);
  const deroghe = [{ pagina: "sparita", categoria: "seo", motivo: "un motivo" }];
  const findings = findingsBudget(pagine, misure, deroghe);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "warn");
  assert.match(findings[0].message, /non dichiara/);
});

test("una deroga che copre davvero una soglia mancata non produce l'avviso in piu'", () => {
  const pagine = [{ id: "immobili", percorso: "/immobili", soglie: { performance: 80 } }];
  const misure = new Map([["immobili", { performance: { mediana: 74, dispersione: 2, stabile: true } }]]);
  const deroghe = [{ pagina: "immobili", categoria: "performance", motivo: "le foto sono degli originali" }];
  const findings = findingsBudget(pagine, misure, deroghe);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "warn");
  assert.match(findings[0].message, /con deroga scritta/);
});

// ---------------------------------------------------------------------------
// 6. L'app che risponde e' quella di questo progetto?
//
// Misurato per caso il 2026-07-30, mentre si rilanciava il gate su
// banco-prova-negozio: la porta 3100 — quella che il contratto firmato di quel
// banco dichiara nel suo `Comando:` — era occupata da un altro progetto.
// ---------------------------------------------------------------------------

test("il build id del progetto nell'HTML servito e' l'app giusta", () => {
  const html = '<script src="/_next/static/XtsnTQLMj1ATFL1bAIQnj/_buildManifest.js"></script>';
  assert.equal(eLaMiaBuild(html, 'XtsnTQLMj1ATFL1bAIQnj'), true);
});

test("l'HTML di un altro progetto non porta il nostro build id", () => {
  const altrui = '<script src="/_next/static/9kQwErTyUiOpAsDfGhJkL/_buildManifest.js"></script>';
  assert.equal(eLaMiaBuild(altrui, 'XtsnTQLMj1ATFL1bAIQnj'), false);
});

test("senza build id non si dichiara niente: non e' una verifica riuscita", () => {
  const html = '<script src="/_next/static/XtsnTQLMj1ATFL1bAIQnj/_buildManifest.js"></script>';
  assert.equal(eLaMiaBuild(html, ''), false);
  assert.equal(eLaMiaBuild(html, undefined), false);
  assert.equal(eLaMiaBuild(null, 'XtsnTQLMj1ATFL1bAIQnj'), false);
});
