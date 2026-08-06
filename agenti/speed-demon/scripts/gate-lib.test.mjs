/**
 * gate-lib.test.mjs — Le regole del gate di Speed Demon, una per una.
 *
 * Runner nativo, zero dipendenze:  node --test "scripts/**\/*.test.mjs"
 *
 * Regola della casa: ogni regola ha il caso in cui SCATTA e quello in cui NON
 * deve scattare. Il secondo e' quello che conta — una regola che scatta sempre
 * e' rumore, e il rumore si impara a scavalcare.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  argomentiOstiliACmd,
  CATEGORIE,
  comandoRicerca,
  dentroLaRadice,
  shellDiSistema,
  contaGravita,
  contrattoUscita,
  dettaglioMisura,
  dispersione,
  eDevServer,
  erroreDiPercorso,
  esitoPagina,
  stessaOrigine,
  findingsBudget,
  findingsContratto,
  findingsSeo,
  formFactorDa,
  formaEseguibile,
  indiziDevServer,
  leggiContratto,
  mediana,
  medianePerCategoria,
  metatagDaHtml,
  misuraStabile,
  motivoNessunaMisura,
  motivoScaduto,
  scaduto,
  primoEseguibile,
  statoDaFindings,
  statoMisura,
  verdettoDa,
} from "./gate-lib.mjs";

// ------------------------------------------------------------- il contratto

const CONTRATTO = `# Performance — Bottega Nord

Confermato da: ORCHESTRATORE (2026-07-30)
Form factor: desktop

## \`home\` — /

Perche' conta: e' l'unica pagina pubblica.

| categoria | soglia |
|---|---|
| performance | 90 |
| accessibility | 95 |
| seo | 90 |

## \`accesso\` — /accedi

| categoria | soglia |
|---|---|
| performance | 85 |

## Deroghe

| pagina | categoria | motivo |
|---|---|---|
| \`accesso\` | performance | il modulo carica il client Supabase, che qui non si puo' rimandare |
`;

test("legge pagine, soglie, firma e form factor", () => {
  const c = leggiContratto(CONTRATTO);
  assert.equal(c.confermatoDa, "ORCHESTRATORE (2026-07-30)");
  assert.equal(c.formFactor, "desktop");
  assert.deepEqual(c.pagine.map((p) => p.id), ["home", "accesso"]);
  assert.deepEqual(c.pagine[0].soglie, { performance: 90, accessibility: 95, seo: 90 });
  assert.deepEqual(c.errori, []);
});

test("le righe delle deroghe non diventano soglie della pagina precedente", () => {
  const c = leggiContratto(CONTRATTO);
  // Senza la chiusura della sezione su ogni `##`, la tabella delle deroghe
  // sarebbe finita dentro `accesso` — che avrebbe preso una soglia in piu'
  // presa da un'altra tabella. Difetto plausibile e silenzioso: la soglia
  // sbagliata e' comunque un numero, e nessuno la nota.
  assert.deepEqual(c.pagine[1].soglie, { performance: 85 });
  assert.equal(c.deroghe.length, 1);
  assert.equal(c.deroghe[0].pagina, "accesso");
  assert.match(c.deroghe[0].motivo, /client Supabase/);
});

test("senza `Form factor:` si assume mobile, il default di Lighthouse", () => {
  assert.equal(formFactorDa("Confermato da: UMANO (Alberto) (2026-07-30)"), "mobile");
  assert.equal(formFactorDa("Form factor: DESKTOP"), "desktop");
});

test("il segnaposto del template non e' una firma", () => {
  const c = leggiContratto("Confermato da: {{UMANO | ORCHESTRATORE}} (AAAA-MM-GG)\n\n## `home` — /\n\n| performance | 90 |");
  assert.equal(c.confermatoDa, null);
  assert.equal(statoDaFindings(findingsContratto(c)), "fail");
});

test("l'esempio compilato dentro un blocco recintato non dichiara pagine", () => {
  const conEsempio = "Confermato da: ORCHESTRATORE (2026-07-30)\n\n## `vera` — /\n\n| performance | 90 |\n\n```markdown\n## `finta` — /mai\n\n| performance | 10 |\n```\n";
  const c = leggiContratto(conEsempio);
  assert.deepEqual(c.pagine.map((p) => p.id), ["vera"]);
});

test("un id di pagina ripetuto e' un errore di contratto, non una pagina in piu'", () => {
  const c = leggiContratto("Confermato da: ORCHESTRATORE (2026-07-30)\n\n## `home` — /\n\n| performance | 90 |\n\n## `home` — /altra\n\n| performance | 90 |");
  assert.equal(c.pagine.length, 1);
  assert.equal(c.errori.length, 1);
  assert.match(c.errori[0], /id ripetuto/);
});

test("una pagina senza nessuna soglia e' un block", () => {
  const c = leggiContratto("Confermato da: ORCHESTRATORE (2026-07-30)\n\n## `home` — /\n\nSolo prosa, nessuna tabella.\n");
  const findings = findingsContratto(c);
  assert.equal(contaGravita(findings).block, 1);
  assert.match(findings[0].message, /nessuna soglia/);
});

test("un contratto completo non produce nessun rilievo", () => {
  assert.deepEqual(findingsContratto(leggiContratto(CONTRATTO)), []);
});

// -------------------------------------------------------------- statistica

test("mediana su numero dispari e pari di giri", () => {
  assert.equal(mediana([90, 70, 80]), 80);
  assert.equal(mediana([70, 80, 90, 100]), 85);
  assert.equal(mediana([]), null);
});

test("la mediana ignora il giro sfortunato, la media no", () => {
  // Tre giri: due a 92 e uno rovinato da qualcosa che girava sulla macchina.
  const giri = [92, 91, 40];
  const media = giri.reduce((a, b) => a + b, 0) / giri.length;
  assert.equal(mediana(giri), 91);
  assert.ok(media < 80, "la media crolla sotto 80 per colpa di un giro solo");
});

test("dispersione e' massimo meno minimo", () => {
  assert.equal(dispersione([90, 95, 92]), 5);
  assert.equal(dispersione([90]), 0);
});

test("meno di tre giri non e' una misura", () => {
  const m = misuraStabile([95, 96]);
  assert.equal(m.stabile, false);
  assert.match(m.motivo, /almeno 3/);
});

test("una dispersione ampia rende la misura inaffidabile, non bassa", () => {
  const m = misuraStabile([98, 60, 85]);
  assert.equal(m.stabile, false);
  assert.equal(m.mediana, 85);
  assert.match(m.motivo, /dispersione 38/);
});

test("tre giri vicini sono una misura buona", () => {
  const m = misuraStabile([94, 96, 95]);
  assert.deepEqual({ mediana: m.mediana, dispersione: m.dispersione, stabile: m.stabile },
    { mediana: 95, dispersione: 2, stabile: true });
});

test("un giro fallito si scarta, NON vale zero", () => {
  // E' la differenza fra «una pagina lenta» e «un browser che non e' partito».
  // Con il `null` scartato restano tre giri buoni e vicini: misura valida.
  const scartato = misuraStabile([95, null, 96, 95]);
  assert.deepEqual(
    { mediana: scartato.mediana, dispersione: scartato.dispersione, stabile: scartato.stabile },
    { mediana: 95, dispersione: 1, stabile: true },
  );

  // Se lo stesso giro fallito valesse 0, la dispersione salirebbe a 96 e una
  // pagina velocissima verrebbe dichiarata inaffidabile — o, peggio, la sua
  // mediana scenderebbe abbastanza da far «ottimizzare» qualcosa che va bene.
  const contatoZero = misuraStabile([95, 0, 96, 95]);
  assert.equal(contatoZero.stabile, false);
  assert.equal(contatoZero.dispersione, 96);
});

// -------------------------------------------------- il passo `misura`, puro
//
// Le cinque funzioni estratte il 2026-08-04 dal passo `misura` di `verify.mjs`
// (`complexity 19`, soglia della casa 15). Prima di quel giorno questa
// decisione non aveva NESSUN test: stava dentro un metodo che per essere
// esercitato voleva Lighthouse, Chrome e un'app accesa. Regola della casa: il
// caso che scatta e quello che non deve scattare.

const CONTRATTO_UNA_PAGINA = { pagine: [{ id: "home", percorso: "/", soglie: {} }] };

test("senza pagine dichiarate non si misura, e il motivo lo dice", () => {
  assert.match(
    motivoNessunaMisura({ contratto: { pagine: [] }, baseUrl: "http://x", strumento: "npx" }),
    /nessuna pagina dichiarata/,
  );
  assert.match(
    motivoNessunaMisura({ contratto: null, baseUrl: "http://x", strumento: "npx" }),
    /nessuna pagina dichiarata/,
  );
});

test("senza build di produzione riconosciuta non si misura", () => {
  assert.match(
    motivoNessunaMisura({ contratto: CONTRATTO_UNA_PAGINA, baseUrl: null, strumento: "npx" }),
    /build di produzione/,
  );
});

// CORREZIONE del 2026-08-06 (referto § H12): lo strumento non si cerca piu' nel
// PATH — Lighthouse vive nella skill a versione fissata, e `npx --yes` non
// scarica piu' niente a ogni giro. Il messaggio cambia perche' cambia il gesto
// che chiude il problema: non «installa lighthouse», ma «installa la skill».
test("senza Lighthouse la misura e' mancante e basta, non MANCANTE per scelta", () => {
  assert.match(
    motivoNessunaMisura({ contratto: CONTRATTO_UNA_PAGINA, baseUrl: "http://x", strumento: null }),
    /Lighthouse non installato nella skill/,
  );
});

// ------------------------ quando il limite scatta (referto § H10/H11/M15)
// Misurato il 2026-08-06 contro un server che accetta e non risponde mai:
// questo gate e' rimasto appeso 120 s e l'hanno ucciso, ZERO righe stampate,
// uscita 124. Flow Sentinel sullo stesso server tornava in 18,2 s con un ROSSO
// leggibile, e la differenza era un solo `AbortSignal.timeout`.
test("un processo ucciso dal limite si distingue da uno che ha risposto male", () => {
  // La forma vera di `spawnSync` col `timeout` scattato, misurata:
  //   status: null · signal: "SIGKILL" · error.code: "ETIMEDOUT"
  assert.equal(scaduto({ status: null, signal: "SIGKILL", error: { code: "ETIMEDOUT" } }), true);
  assert.equal(scaduto({ status: 1, stdout: "", stderr: "boom" }), false, "uno strumento che boccia ha risposto");
  assert.equal(scaduto({ status: null, error: { code: "ENOENT" } }), false, "e uno assente non e' uno lento");
  assert.equal(scaduto(null), false);
});

test("il motivo dice QUALE comando, QUANTO ha aspettato, e che vale MANCANTE", () => {
  const motivo = motivoScaduto("lighthouse http://127.0.0.1:3200/", 180_000);
  assert.match(motivo, /`lighthouse http:\/\/127\.0\.0\.1:3200\/`/);
  assert.match(motivo, /entro 180 s/);
  assert.match(motivo, /verifica MANCANTE, non un successo/);
});

test("con contratto, app e strumento la misura si fa: nessun motivo per saltarla", () => {
  assert.equal(
    motivoNessunaMisura({ contratto: CONTRATTO_UNA_PAGINA, baseUrl: "http://x", strumento: "npx" }),
    null,
  );
});

test("una categoria che nessun giro ha prodotto non entra nel risultato", () => {
  // Meglio assente che con una mediana calcolata su niente: il passo `budget`
  // legge questa mappa, e una categoria vuota li' diventerebbe uno zero.
  const giri = [
    { performance: 95, seo: null, accessibility: 90, "best-practices": 100 },
    { performance: 96, seo: null, accessibility: 91, "best-practices": 100 },
    { performance: 95, seo: null, accessibility: 90, "best-practices": 100 },
  ];
  const per = medianePerCategoria(giri);
  assert.equal("seo" in per, false);
  assert.equal(per.performance.mediana, 95);
  assert.equal(per.performance.stabile, true);
});

test("un dirottamento scarta la pagina: non e' una misura bassa, e' un'altra pagina", () => {
  const esito = esitoPagina({
    pagina: { id: "riservata", percorso: "/riservata" },
    giri: [{ performance: 100 }],
    dirottamento: "http://127.0.0.1:3200/contatti",
    giriRichiesti: 3,
    sogliaDispersione: 5,
  });
  assert.equal(esito.misura, null);
  assert.equal(esito.riga, null);
  assert.match(esito.scartata, /riservata \(\/riservata\) → http:\/\/127\.0\.0\.1:3200\/contatti/);
});

test("zero giri riusciti non e' una misura: la pagina resta non misurata", () => {
  const esito = esitoPagina({
    pagina: { id: "home", percorso: "/" },
    giri: [],
    dirottamento: null,
    giriRichiesti: 3,
    sogliaDispersione: 5,
  });
  assert.equal(esito.misura, null);
  assert.match(esito.riga, /nessun giro riuscito su 3/);
});

test("tre giri buoni danno la misura, e la riga porta mediana e dispersione", () => {
  const punteggi = (p) => ({ performance: p, accessibility: 100, "best-practices": 100, seo: 100 });
  const esito = esitoPagina({
    pagina: { id: "home", percorso: "/" },
    giri: [punteggi(94), punteggi(95), punteggi(96)],
    dirottamento: null,
    giriRichiesti: 3,
    sogliaDispersione: 5,
  });
  assert.equal(esito.scartata, null);
  assert.equal(esito.misura.performance.mediana, 95);
  assert.match(esito.riga, /home \(\/\) · 3\/3 giri:/);
  assert.match(esito.riga, /performance 95±2/);
});

test("una pagina dichiarata e non misurata NON lascia il passo verde", () => {
  assert.equal(statoMisura(2, 0), "pass");
  assert.equal(statoMisura(2, 1), "fail");
  // Zero pagine misurate non e' un fallimento del sito: e' una verifica che
  // non c'e' stata, cioe' MANCANTE — e il gate resta rosso lo stesso.
  assert.equal(statoMisura(0, 3), "skipped");
});

test("il dettaglio dichiara da dove viene la soglia di dispersione", () => {
  const dichiarata = dettaglioMisura({
    sogliaDispersione: 5, dichiarataNelContratto: true, righe: ["home: ok"], dirotate: [], misurate: 1,
  });
  assert.match(dichiarata, /dispersione massima ammessa: 5 punti \(dichiarata nel contratto\)/);
  assert.match(dichiarata, /home: ok/);

  const ripiego = dettaglioMisura({
    sogliaDispersione: 5, dichiarataNelContratto: false, righe: [], dirotate: [], misurate: 0,
  });
  assert.match(ripiego, /ripiego della casa/);
  assert.match(ripiego, /nessuna pagina misurata/);
});

test("una pagina scartata si legge nel dettaglio, col motivo", () => {
  const testo = dettaglioMisura({
    sogliaDispersione: 5,
    dichiarataNelContratto: true,
    righe: [],
    dirotate: ["riservata (/riservata) → /contatti"],
    misurate: 1,
  });
  assert.match(testo, /SCARTATA — riservata \(\/riservata\) → \/contatti: Lighthouse ha misurato un'altra pagina/);
});

// ------------------------------------------------------------------ budget

const PAGINE = [
  { id: "home", percorso: "/", soglie: { performance: 90, seo: 90 } },
];
const buona = (n) => ({ mediana: n, dispersione: 2, stabile: true, motivo: null });

test("sopra soglia: nessun rilievo", () => {
  const misure = new Map([["home", { performance: buona(95), seo: buona(100) }]]);
  assert.deepEqual(findingsBudget(PAGINE, misure, []), []);
});

test("sotto soglia senza deroga e' un block", () => {
  const misure = new Map([["home", { performance: buona(72), seo: buona(100) }]]);
  const findings = findingsBudget(PAGINE, misure, []);
  assert.equal(contaGravita(findings).block, 1);
  assert.match(findings[0].message, /72 sotto la soglia 90/);
});

test("sotto soglia CON deroga scritta e' un warn, e la deroga si legge nel messaggio", () => {
  const misure = new Map([["home", { performance: buona(72), seo: buona(100) }]]);
  const deroghe = [{ pagina: "home", categoria: "performance", motivo: "hosting condiviso fino a marzo" }];
  const findings = findingsBudget(PAGINE, misure, deroghe);
  assert.deepEqual(contaGravita(findings), { block: 0, issue: 0, warn: 1 });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "warn");
  assert.match(findings[0].message, /hosting condiviso/);
  assert.equal(statoDaFindings(findings), "pass");
});

test("la deroga di un'altra pagina non copre questa", () => {
  const misure = new Map([["home", { performance: buona(72), seo: buona(100) }]]);
  const deroghe = [{ pagina: "accesso", categoria: "performance", motivo: "altra pagina" }];
  assert.equal(findingsBudget(PAGINE, misure, deroghe)[0].severity, "block");
});

test("una pagina dichiarata e mai misurata e' un block, non un silenzio", () => {
  const findings = findingsBudget(PAGINE, new Map(), []);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].message, /mai misurata/);
});

test("una misura inaffidabile e' un block anche se la mediana supera la soglia", () => {
  // E' il punto della Legge n.3: un numero alto ma ballerino non promuove.
  const misure = new Map([["home", {
    performance: { mediana: 95, dispersione: 40, stabile: false, motivo: "dispersione 40 punti" },
    seo: buona(100),
  }]]);
  const findings = findingsBudget(PAGINE, misure, []);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].message, /inaffidabile, non bassa/);
});

// --------------------------------------------------------- dev server o build

// I due HTML che seguono sono RITAGLI VERI, presi il 2026-07-30 dallo stesso
// progetto servito nei due modi nello stesso momento: `next dev -p 3001` e
// `next start -p 3100` sopra la stessa build.
const HTML_DEV = `<html><body>
<script src="/_next/static/chunks/main-app.js?v=1785407832332"></script>
<script src="/_next/static/chunks/app-pages-internals.js"></script>
<script src="/_next/static/chunks/webpack.js?v=1785407832332"></script>
</body></html>`;

const HTML_PROD = `<html><head><title>Bottega Nord</title></head><body>
<script src="/_next/static/chunks/4bd1b696-c023c6e3521b1417.js"></script>
<script src="/_next/static/chunks/main-app-f1e4859868969239.js"></script>
<script src="/_next/static/chunks/polyfills-42372ed130431b0a.js"></script>
</body></html>`;

test("l'HTML vero di una dev server viene riconosciuto", () => {
  // Regressione del falso verde del 2026-07-30: questo HTML NON contiene
  // `react-refresh` ne' `/_next/static/development/` — i due indizi «ovvi» —
  // e con quelli soli il gate diceva `pass` su una dev server.
  assert.ok(!HTML_DEV.includes("react-refresh"));
  assert.ok(!HTML_DEV.includes("/_next/static/development/"));
  assert.equal(eDevServer(HTML_DEV), true);
  const nomi = indiziDevServer(HTML_DEV).map((i) => i.nome);
  assert.deepEqual(nomi, ["chunk con `?v=<timestamp>`", "`app-pages-internals`"]);
});

test("l'HTML vero di una build di produzione non produce indizi", () => {
  assert.deepEqual(indiziDevServer(HTML_PROD), []);
  assert.equal(eDevServer(HTML_PROD), false);
});

test("i chunk con hash nel nome NON vengono scambiati per chunk con `?v=`", () => {
  // Il caso in cui la regola scatterebbe a vuoto: un nome che contiene `v=`
  // dentro l'hash, senza essere un parametro di query.
  assert.equal(eDevServer(`<script src="/_next/static/chunks/main-app-a1v2b3.js"></script>`), false);
});

test("gli indizi storici restano validi", () => {
  assert.equal(eDevServer(`<script src="/_next/static/development/_buildManifest.js"></script>`), true);
  assert.equal(eDevServer(`<script>require("react-refresh/runtime")</script>`), true);
});

// -------------------------------------------------------------------- SEO

test("legge title, description e canonical dall'HTML servito", () => {
  const html = `<html><head>
    <title>Bottega Nord — maglieria</title>
    <meta name="description" content="Maglieria di lana"/>
    <link rel="canonical" href="https://bottreganord.it/"/>
  </head></html>`;
  assert.deepEqual(metatagDaHtml(html), {
    title: "Bottega Nord — maglieria",
    description: "Maglieria di lana",
    canonical: "https://bottreganord.it/",
    robots: null,
    // gli elenchi completi accanto al primo valore: chi CONTA e' `findingsSeo`,
    // qui si legge soltanto
    titoli: ["Bottega Nord — maglieria"],
    descrizioni: ["Maglieria di lana"],
    canonici: ["https://bottreganord.it/"],
    robotsTutti: [],
    xRobots: null,
  });
});

test("gli attributi in ordine invertito si leggono lo stesso", () => {
  const html = `<meta content="Descrizione" name="description"><link href="/x" rel="canonical">`;
  const t = metatagDaHtml(html);
  assert.equal(t.description, "Descrizione");
  assert.equal(t.canonical, "/x");
});

test("un metatag mancante e' un block per pagina e per campo", () => {
  const pagine = [{ id: "home", percorso: "/", soglie: {} }];
  const tag = new Map([["home", { title: "C'e'", description: null, canonical: null, robots: null }]]);
  const findings = findingsSeo(pagine, tag);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.severity === "block"));
});

test("un noindex su una pagina dichiarata pubblica e' un block", () => {
  const pagine = [{ id: "home", percorso: "/", soglie: {} }];
  const tag = new Map([["home", { title: "T", description: "D", canonical: "/", robots: "noindex, nofollow" }]]);
  const findings = findingsSeo(pagine, tag);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /esclusa dall'indice/);
});

test("una pagina con tutti i tag e senza noindex non produce rilievi", () => {
  const pagine = [{ id: "home", percorso: "/", soglie: {} }];
  const tag = new Map([["home", { title: "T", description: "D", canonical: "/", robots: "index, follow" }]]);
  assert.deepEqual(findingsSeo(pagine, tag), []);
});

// --------------------------------------------- eseguibili risolti su Windows

test("di `where npx` si prende la riga con l'estensione, non la prima", () => {
  // E' l'uscita vera di questa macchina, incollata. La prima riga e' lo script
  // per Git Bash: Windows non sa eseguirlo, `spawnSync` non produce stdout e la
  // diagnosi diventa «nessun giro riuscito» su una macchina dove Lighthouse
  // funziona benissimo a mano. Misurato il 2026-07-30, al primo giro del gate.
  const uscita = "C:\\Program Files\\nodejs\\npx\r\nC:\\Program Files\\nodejs\\npx.cmd\r\n";
  assert.equal(primoEseguibile(uscita), "C:\\Program Files\\nodejs\\npx.cmd");
});

test("se nessuna riga ha estensione si tiene la prima, invece di non fare niente", () => {
  assert.equal(primoEseguibile("/usr/local/bin/lighthouse\n"), "/usr/local/bin/lighthouse");
  assert.equal(primoEseguibile("   \n\n"), null);
});

test("uno shim .cmd passa da cmd.exe, e il percorso NON si virgoletta a mano", () => {
  // Contro l'istinto, ed e' per questo che c'e' un test: Node quota gia'
  // l'argomento, e aggiungendo virgolette si ottiene un doppio virgolettato
  // che `cmd` non sa aprire (provate entrambe le forme il 2026-07-30).
  const forma = formaEseguibile("npx", () => "C:\\Program Files\\nodejs\\npx.cmd", "win32", "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(forma, { file: "C:\\Windows\\System32\\cmd.exe", prefisso: ["/c", "C:\\Program Files\\nodejs\\npx.cmd"] });
});

test("un argomento con spazi e' ostile a cmd, e va riconosciuto prima di lanciarlo", () => {
  // Misurato: lo stesso comando con e senza questo argomento da status 1 e
  // status 0. L'errore parla del PROGRAMMA troncato («C:\\Program»), non
  // dell'argomento colpevole — per questo il controllo sta a monte.
  const args = ["lighthouse", "http://x/", "--chrome-flags=--headless=new --no-sandbox"];
  assert.deepEqual(argomentiOstiliACmd(args, "win32"), ["--chrome-flags=--headless=new --no-sandbox"]);
  assert.deepEqual(argomentiOstiliACmd(["--chrome-flags=--headless=new"], "win32"), []);
});

test("fuori da Windows gli spazi negli argomenti non sono un problema", () => {
  assert.deepEqual(argomentiOstiliACmd(["--flags=a b c"], "linux"), []);
});

// --------- i metacaratteri, che passavano tutti (referto § H1/L1, 2026-08-06)
// Il filtro guardava i soli spazi: rifiutava l'unico caso che a volte funziona
// e lasciava passare i quattro che eseguono codice. Misurato su uno shim `.cmd`
// vero, con `cmd.exe /c`:
//   /&ver         → lo shim riceve `/`, e `ver` ESEGUE. status 0
//   %USERNAME%    → lo shim riceve `Utente`: l'argomento arriva espanso
//   /|ver         → lo shim non parte affatto, parte `ver`. status 0
//   />rubato.txt  → status 0, e su disco compare `rubato.txt`
test("i metacaratteri di cmd sono ostili: eseguono codice, e prima passavano", () => {
  for (const arg of ["/&ver", "%USERNAME%", "/|ver", "/>rubato.txt", "a<b", "(x)", 'dice"quello', "a^b"]) {
    assert.deepEqual(argomentiOstiliACmd([arg], "win32"), [arg], `passava: ${arg}`);
  }
});

test("un a capo dentro un argomento e' una riga di comando in piu'", () => {
  assert.deepEqual(argomentiOstiliACmd(["ok\r\nver"], "win32"), ["ok\r\nver"]);
});

test("gli argomenti veri del giro di Lighthouse restano tutti leciti", () => {
  // La regola non deve scattare su cio' che il gate passa DAVVERO, o sarebbe
  // un rosso strutturale: e un rosso strutturale insegna a ignorare il rosso.
  const veri = [
    "--yes", "lighthouse", "http://127.0.0.1:3200/catalogo", "--output=json",
    "--output-path=stdout", "--quiet", "--chrome-flags=--headless=new",
    "--only-categories=performance,accessibility,best-practices,seo", "--preset=desktop",
  ];
  assert.deepEqual(argomentiOstiliACmd(veri, "win32"), []);
});

test("fuori da Windows nemmeno i metacaratteri sono un problema: non c'e' cmd", () => {
  assert.deepEqual(argomentiOstiliACmd(["/&ver", "%USERNAME%"], "linux"), []);
});

// CORREZIONE del 2026-08-06. Prima: «fuori da Windows non si passa da nessuna
// shell» asseriva `{ file: "lighthouse" }`, cioe' il NOME NUDO — che e' proprio
// cio' che `spawnSync` risolve dalla directory corrente (§ C1 del referto).
// La shell continua a non entrarci: cambia solo che si lancia il percorso.
test("fuori da Windows non si passa da nessuna shell, ma si lancia il percorso", () => {
  assert.deepEqual(formaEseguibile("lighthouse", () => "/usr/bin/lighthouse", "linux"),
    { file: "/usr/bin/lighthouse", prefisso: [] });
});

test("un eseguibile vero non passa da cmd.exe nemmeno su Windows", () => {
  assert.deepEqual(formaEseguibile("node", () => "C:\\Program Files\\nodejs\\node.exe", "win32"),
    { file: "C:\\Program Files\\nodejs\\node.exe", prefisso: [] });
});

// ------------------------- chi cerca, e dove NON cerca (§ C1, 2026-08-06)
// Il gate si lancia dalla radice del progetto MISURATO e `where` guarda li'
// prima che nel PATH: un `npx.cmd` piantato nella radice sceglieva quale
// binario produce i numeri del verdetto.

test("su Windows si cerca col percorso pieno di where.exe e col prefisso $PATH:", () => {
  assert.deepEqual(comandoRicerca("npx", "win32", { SystemRoot: "C:\\Windows" }),
    { file: "C:\\Windows\\System32\\where.exe", args: ["$PATH:npx"] });
});

test("fuori da Windows si cerca con which, che legge il PATH e non la cartella corrente", () => {
  assert.deepEqual(comandoRicerca("lighthouse", "linux", {}), { file: "which", args: ["lighthouse"] });
});

test("la shell degli shim viene da ComSpec, col percorso pieno", () => {
  assert.equal(shellDiSistema({ ComSpec: "C:\\Windows\\System32\\cmd.exe" }), "C:\\Windows\\System32\\cmd.exe");
  assert.equal(shellDiSistema({ SystemRoot: "D:\\Win" }), "D:\\Win\\System32\\cmd.exe");
});

test("un eseguibile dentro il progetto misurato si riconosce, uno fuori no", () => {
  assert.equal(dentroLaRadice("C:\\prog\\node_modules\\.bin\\lighthouse.cmd", "C:\\prog"), true);
  assert.equal(dentroLaRadice("C:\\PROG\\npx.cmd", "C:\\prog"), true);
  assert.equal(dentroLaRadice("C:\\Program Files\\nodejs\\npx.cmd", "C:\\prog"), false);
  // `C:\prog-altro` comincia per `C:\prog`: un confronto di prefissi sbaglierebbe
  assert.equal(dentroLaRadice("C:\\prog-altro\\npx.cmd", "C:\\prog"), false);
  assert.equal(dentroLaRadice("C:\\prog", "C:\\prog"), false);
  assert.equal(dentroLaRadice(null, "C:\\prog"), false);
});

test("nome non risolto: file null, e chi lancia deve dire MANCANTE (mai il nome nudo)", () => {
  assert.deepEqual(formaEseguibile("lighthouse", () => null, "win32"), { file: null, prefisso: [] });
  assert.deepEqual(formaEseguibile("lighthouse", () => null, "linux"), { file: null, prefisso: [] });
});

// ------------------------------------------------------- contratto d'uscita

test("il verdetto e' ROSSO se anche un solo passo non e' pass", () => {
  assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
  assert.equal(verdettoDa([{ status: "pass" }, { status: "pass" }]), "VERDE");
});

test("un handoff che dichiara VERDE su un gate ROSSO e' un block", () => {
  const findings = contrattoUscita("docs/handoff/15-speed-demon.md", "# Handoff\n\nGate: VERDE (0 falliti)\n", "ROSSO");
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /parla di un'altra esecuzione/);
});

test("la parola VERDE dentro un blocco citato non conta come dichiarazione", () => {
  // Un handoff che INCOLLA l'uscita di un gate verde precedente non sta
  // dichiarando il proprio verdetto. Difetto gemello di quello che Flow
  // Sentinel ha misurato il 2026-07-28 sul suo contratto d'uscita.
  const testo = "# Handoff\n\n```\nGate: VERDE (0 falliti)\n```\n\nGate: ROSSO (1 fallito)\n";
  assert.deepEqual(contrattoUscita("h.md", testo, "ROSSO"), []);
});

test("un handoff assente e' un block, non un silenzio", () => {
  assert.equal(contrattoUscita("h.md", null, "VERDE")[0].severity, "block");
});

test("le categorie che il gate misura sono le quattro di Lighthouse", () => {
  assert.deepEqual([...CATEGORIE], ["performance", "accessibility", "best-practices", "seo"]);
});

// ---- il percorso di una pagina e' un percorso (referto § H4, 2026-08-06)
// `(\S+)` accettava qualunque cosa, e `new URL(percorso, base)` di fronte a un
// URL assoluto BUTTA VIA la base. Riprodotto su un contratto firmato e senza
// nessun rilievo:
//   ## `home` — https://example.com/     → Lighthouse misura https://example.com/
//   ## `catalogo` — //evil.example.com/  → Lighthouse misura http://evil.example.com/
// e i punteggi finivano accanto al nome della pagina del cliente.

const CONTRATTO_OSTILE = `# Performance — cliente

Confermato da: UMANO (Alberto) (2026-08-06)

## \`home\` — https://example.com/

| categoria | soglia |
|---|---|
| performance | 90 |

## \`catalogo\` — //evil.example.com/

| categoria | soglia |
|---|---|
| performance | 90 |
`;

test("un URL assoluto nel contratto non diventa una pagina da misurare", () => {
  const c = leggiContratto(CONTRATTO_OSTILE);
  assert.deepEqual(c.pagine, [], "la pagina NON entra nell'elenco: restarci significherebbe misurarla");
  assert.equal(c.errori.length, 2);
  assert.match(c.errori[0], /e' un URL assoluto, non un percorso/);
  assert.match(c.errori[1], /due barre/);
  // e il contratto diventa rosso, con il rilievo «nessuna pagina» in piu'
  assert.equal(contaGravita(findingsContratto(c)).block, 3);
});

test("le tre forme del template restano leciti percorsi", () => {
  for (const p of ["/", "/catalogo", "/catalogo/acero-palmato", "/catalogo?ordina=prezzo"]) {
    assert.equal(erroreDiPercorso("x", p), null, `rifiutato: ${p}`);
  }
});

test("ogni forma che porta altrove e' un errore, e il messaggio dice quale", () => {
  assert.match(erroreDiPercorso("home", "https://example.com/"), /URL assoluto/);
  assert.match(erroreDiPercorso("home", "http://127.0.0.1:9/"), /URL assoluto/);
  assert.match(erroreDiPercorso("home", "javascript:alert(1)"), /URL assoluto/);
  assert.match(erroreDiPercorso("home", "//evil.example.com/"), /due barre/);
  assert.match(erroreDiPercorso("home", "catalogo"), /non comincia con/);
});

// La seconda porta: indipendente dalla prima, e per questo esiste.
test("stessa origine: schema, host e porta, non un prefisso di stringa", () => {
  assert.equal(stessaOrigine("http://127.0.0.1:3200", "http://127.0.0.1:3200/catalogo"), true);
  assert.equal(stessaOrigine("http://127.0.0.1:3200/", "http://127.0.0.1:3200/a/b?c=1#d"), true);
  assert.equal(stessaOrigine("http://127.0.0.1:3200", "http://127.0.0.1:3201/"), false, "altra porta");
  assert.equal(stessaOrigine("http://127.0.0.1:3200", "https://127.0.0.1:3200/"), false, "altro schema");
  assert.equal(stessaOrigine("http://127.0.0.1:3200", "http://127.0.0.1.evil.com/"), false, "host che comincia uguale");
  assert.equal(stessaOrigine("http://127.0.0.1:3200", "non-un-url"), false);
  assert.equal(stessaOrigine("", "http://x/"), false);
});

test("`..` nel percorso non porta fuori dall'origine: `new URL` li scioglie prima", () => {
  const url = new URL("/a/../../../altrove", "http://127.0.0.1:3200").toString();
  assert.equal(url, "http://127.0.0.1:3200/altrove");
  assert.equal(stessaOrigine("http://127.0.0.1:3200", url), true);
});
