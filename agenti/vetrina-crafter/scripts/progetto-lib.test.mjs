/**
 * Test delle regole del CONTRATTO e dell'APP SERVITA.
 *
 * Dieci di questi test hanno un nome che comincia con «falso verde»: sono i
 * dieci modi in cui `references/verifica-deterministica.md` prevede che questo
 * gate potrebbe essere verde senza aver guardato. Scriverli come test e' l'unico
 * modo per cui quella sezione non resti prosa — e la prosa che sa cose che il
 * codice non sa e' il difetto che il collaudo avversario di Speed Demon ha
 * trovato SEI volte.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggiornamentoDa,
  argomentiPsql,
  combacia,
  contrattoUscita,
  dataConfermaDa,
  decodificaEntita,
  eLaMiaBuild,
  esclusa,
  findingsContenuti,
  findingsContratto,
  findingsRotte,
  findingsSegnaposto,
  fontiDa,
  frammentoDistintivo,
  indiziDevServer,
  leggiContratto,
  piuLungoDiContenuto,
  righeDaPsql,
  rottaDaFile,
  rotteDaSorgenti,
  schemiEsposti,
  senzaZoneCitate,
  SOGLIA_FRAMMENTO,
  tabellaContenutiDa,
  testoServito,
  urlDbProgetto,
  validaConfig,
  valoreToml,
  verdettoDa,
} from "./progetto-lib.mjs";

const CONTRATTO = `# Vetrina — Vivaio Corte Vecchia

Confermato da: Elena Barbieri (titolare) (2026-07-24)

## Ambiente

URL servito: http://127.0.0.1:3100
Comando: npm run build && npm run start -- -p 3100
Tabella dei contenuti: site_content — chiave \`slot\`, pubblicato \`is_published\`
Lunghezza minima del frammento distintivo: 24 caratteri

## Gerarchia

Quattro voci in navigazione.

## \`home\` — /

**Cosa mostra:** l'apertura e le sei piante in evidenza
**Contenuti da:** \`slot:home-hero\` · \`tabella:piante\`
**Titolo da:** slot \`home-hero\`, campo title
**Aggiornamento:** ISR 600

## \`catalogo\` — /catalogo

**Cosa mostra:** tutte le piante pubblicate
**Contenuti da:** \`tabella:piante\`
**Titolo da:** colonna \`piante.nome\`
**Aggiornamento:** statico

## Percorsi di scrittura aperti al pubblico

Nessuna scrittura pubblica.

## Slot dei contenuti

| Slot | Pagina | Cosa contiene | Chi lo modifica |
|---|---|---|---|
| \`home-hero\` | \`home\` | titolo e sottotitolo | titolare |

## Pagine escluse dal contratto

- \`/admin/*\` — e' del gestionale, non della vetrina
`;

describe("lettura del contratto", () => {
  const c = leggiContratto(CONTRATTO);

  it("legge pagine, percorsi, fonti e aggiornamento", () => {
    assert.deepEqual(c.pagine.map((p) => [p.id, p.percorso]), [["home", "/"], ["catalogo", "/catalogo"]]);
    assert.deepEqual(c.pagine[0].fonti, [{ tipo: "slot", nome: "home-hero" }, { tipo: "tabella", nome: "piante" }]);
    assert.deepEqual(c.pagine[0].aggiornamento, { tipo: "isr", secondi: 600 });
    assert.deepEqual(c.pagine[1].aggiornamento, { tipo: "statico", secondi: null });
  });

  it("legge firma, data, URL, tabella dei contenuti, soglia ed escluse", () => {
    assert.equal(c.confermatoDa, "Elena Barbieri (titolare) (2026-07-24)");
    assert.equal(c.dataConferma, "2026-07-24");
    assert.equal(c.urlDichiarato, "http://127.0.0.1:3100");
    assert.deepEqual(c.tabellaContenuti, { tabella: "site_content", colonnaChiave: "slot", colonnaPubblicato: "is_published" });
    assert.equal(c.sogliaFrammento, 24);
    assert.deepEqual(c.escluse, ["/admin/*"]);
  });

  it("legge la tabella degli slot dalla sua intestazione", () => {
    assert.deepEqual(c.slot, [{ chiave: "home-hero", pagina: "home" }]);
  });

  it("una sezione di servizio chiude la pagina in corso", () => {
    // Senza, le righe della tabella degli slot diventerebbero righe di `catalogo`.
    assert.equal(c.pagine[1].righe["Cosa mostra"], "tutte le piante pubblicate");
    assert.equal(Object.keys(c.pagine[1].righe).length, 4);
  });

  it("falso verde n°1: il segnaposto del template NON e' una firma", () => {
    const senzaFirma = leggiContratto(CONTRATTO.replace("Elena Barbieri (titolare) (2026-07-24)", "{{UMANO | ORCHESTRATORE}} ({{AAAA-MM-GG}})"));
    assert.equal(senzaFirma.confermatoDa, null);
  });

  it("una firma con nome e ruolo DEVE passare (rifiuto indebito di Speed Demon)", () => {
    assert.equal(leggiContratto(CONTRATTO.replace("Elena Barbieri (titolare)", "Mario Rossi (responsabile marketing)")).confermatoDa !== null, true);
  });

  it("falso verde: una riga `Confermato da:` VUOTA non cattura la riga dopo", () => {
    // Con `\\s` fra i due punti e la firma — che comprende l'a capo — la riga
    // vuota catturava l'intestazione della prima pagina, e il gate usciva verde
    // su un contratto che nessuno aveva firmato (Flow Sentinel, 2026-07-28).
    const vuota = leggiContratto(CONTRATTO.replace("Confermato da: Elena Barbieri (titolare) (2026-07-24)", "Confermato da:"));
    assert.equal(vuota.confermatoDa, null);
  });

  it("falso verde n°2: un contratto senza pagine non ne dichiara nessuna", () => {
    const solo = leggiContratto("# Vetrina\n\nConfermato da: Tizio (ruolo) (2026-08-01)\n\n## Ambiente\n\nURL servito: http://x\n");
    assert.equal(solo.pagine.length, 0);
  });

  it("l'esempio compilato dentro un blocco recintato NON dichiara pagine", () => {
    const conEsempio = `${CONTRATTO}\n## Esempio compilato\n\n\`\`\`\`markdown\n## \`inventata\` — /inventata\n\n**Cosa mostra:** niente\n\`\`\`\`\n`;
    assert.equal(leggiContratto(conEsempio).pagine.length, 2);
  });

  it("un id ripetuto e' un errore del contratto, non una pagina in piu'", () => {
    const doppio = `${CONTRATTO}\n## \`home\` — /doppia\n\n**Cosa mostra:** x\n`;
    const letto = leggiContratto(doppio);
    assert.equal(letto.pagine.length, 2);
    assert.match(letto.errori[0], /id ripetuto/);
  });

  it("«Nessuno slot.» e' una dichiarazione, e si distingue da una tabella vuota", () => {
    assert.equal(leggiContratto(CONTRATTO).nessunoSlotDichiarato, false);
    assert.equal(leggiContratto("Nessuno slot.").nessunoSlotDichiarato, true);
  });
});

describe("pezzi del contratto", () => {
  it("fontiDa legge i gettoni col prefisso, e `nessuna`", () => {
    assert.deepEqual(fontiDa("`tabella:piante` · `vista:v_offerte`, slot:promo"), [
      { tipo: "tabella", nome: "piante" }, { tipo: "vista", nome: "v_offerte" }, { tipo: "slot", nome: "promo" },
    ]);
    assert.deepEqual(fontiDa("nessuna"), []);
  });

  it("aggiornamentoDa riconosce i tre valori ammessi e rifiuta il resto", () => {
    assert.deepEqual(aggiornamentoDa("ISR 300"), { tipo: "isr", secondi: 300 });
    assert.deepEqual(aggiornamentoDa("dinamico"), { tipo: "dinamico", secondi: null });
    assert.deepEqual(aggiornamentoDa("statico"), { tipo: "statico", secondi: null });
    assert.deepEqual(aggiornamentoDa("quando capita"), { tipo: null, secondi: null });
  });

  it("tabellaContenutiDa vuole nome, chiave e colonna di pubblicazione", () => {
    assert.equal(tabellaContenutiDa("nessuna"), null);
    assert.equal(tabellaContenutiDa("site_content"), null);
    assert.deepEqual(tabellaContenutiDa("site_content — chiave `slot`, pubblicato `is_published`"),
      { tabella: "site_content", colonnaChiave: "slot", colonnaPubblicato: "is_published" });
  });

  it("senzaZoneCitate toglie blocchi recintati e commenti HTML", () => {
    const testo = "a\n```\nb\n```\nc\n<!-- d -->\ne";
    assert.equal(senzaZoneCitate(testo).replace(/\n+/g, "|"), "a|c|e");
  });

  it("dataConfermaDa legge la data DAL TESTO, non dal filesystem", () => {
    assert.equal(dataConfermaDa("Confermato da: ORCHESTRATORE il 2026-07-20."), "2026-07-20");
    assert.equal(dataConfermaDa("Confermato da: il titolare, a voce"), null);
  });
});

describe("findings del contratto", () => {
  it("SCATTA sulle righe obbligatorie assenti", () => {
    const c = leggiContratto("Confermato da: Tizio (ruolo)\n\n## `home` — /\n\n**Cosa mostra:** x\n");
    const findings = findingsContratto(c);
    assert.equal(findings.filter((f) => /righe obbligatorie/.test(f.message)).length, 1);
  });

  it("NON scatta su un contratto completo", () => {
    assert.deepEqual(findingsContratto(leggiContratto(CONTRATTO)), []);
  });

  it("SCATTA su un `Aggiornamento:` che non e' uno dei tre valori", () => {
    const c = leggiContratto(CONTRATTO.replace("**Aggiornamento:** ISR 600", "**Aggiornamento:** quando capita"));
    assert.ok(findingsContratto(c).some((f) => /non e' uno dei tre valori/.test(f.message)));
  });

  it("SCATTA su uno slot che punta a una pagina non dichiarata", () => {
    const c = leggiContratto(CONTRATTO.replace("| `home-hero` | `home` |", "| `home-hero` | `inventata` |"));
    assert.ok(findingsContratto(c).some((f) => f.severity === "block" && /che il contratto non dichiara/.test(f.message)));
  });

  it("segnala come `issue` uno slot dichiarato in pagina e assente dalla tabella", () => {
    const c = leggiContratto(CONTRATTO.replace("| `home-hero` | `home` | titolo e sottotitolo | titolare |", ""));
    const findings = findingsContratto(c);
    assert.ok(findings.some((f) => f.severity === "issue" && /non compare nella tabella/.test(f.message)));
  });

  it("SCATTA (issue) se la firma e' piu' vecchia dell'handoff di schema-forge", () => {
    const findings = findingsContratto(leggiContratto(CONTRATTO), { dataHandoffSchema: "2026-07-30" });
    assert.equal(findings.filter((f) => /lo schema e' cambiato dopo/.test(f.message)).length, 1);
  });

  it("NON scatta se la firma e' successiva, o se una delle due date manca", () => {
    assert.deepEqual(findingsContratto(leggiContratto(CONTRATTO), { dataHandoffSchema: "2026-07-01" }), []);
    assert.deepEqual(findingsContratto(leggiContratto(CONTRATTO), { dataHandoffSchema: null }), []);
  });
});

describe("configurazione del progetto", () => {
  const buona = { radicePubblica: "src/app", cucitura: "src/components/ui", primitive: ["Bottone"], moduliClient: ["src/lib/supabase/public.ts"] };

  it("accetta una configurazione completa", () => {
    assert.deepEqual(validaConfig(buona).errori, []);
  });

  it("falso verde n°7: primitive vuote = nessuna regola puo' scattare", () => {
    assert.match(validaConfig({ ...buona, primitive: [] }).errori[0], /non puo' scattare mai/);
  });

  it("rifiuta chiavi assenti e tipi sbagliati", () => {
    assert.equal(validaConfig({}).errori.length, 4);
    assert.ok(validaConfig({ ...buona, moduliClient: "uno" }).errori.some((e) => /elenco/.test(e)));
    assert.match(validaConfig(null).errori[0], /oggetto JSON/);
  });
});

describe("rotte", () => {
  it("da file a rotta, togliendo i gruppi di rotta", () => {
    assert.deepEqual(rottaDaFile("src/app/page.tsx", "src/app"), { rotta: "/", tipo: "pagina" });
    assert.deepEqual(rottaDaFile("src/app/(pubblico)/catalogo/page.tsx", "src/app"), { rotta: "/catalogo", tipo: "pagina" });
    assert.deepEqual(rottaDaFile("src/app/catalogo/[slug]/page.tsx", "src/app"), { rotta: "/catalogo/[slug]", tipo: "pagina" });
  });

  // Difetto n°11 del collaudo 2026-08-04. Il test di P1 pretendeva `null` su un
  // `route.ts`, cioe' CODIFICAVA la cecita' dichiarata in `sabotaggio.md`: sul
  // banco un endpoint che rispondeva `200` con dei dati, e che nessuno aveva
  // firmato, passava con dieci passi verdi sopra.
  it("un `route.ts` E' una rotta pubblica, e si distingue da una pagina", () => {
    assert.deepEqual(rottaDaFile("src/app/api/x/route.ts", "src/app"), { rotta: "/api/x", tipo: "gestore" });
    assert.deepEqual(rottaDaFile("src/app/disponibilita/route.ts", "src/app"), { rotta: "/disponibilita", tipo: "gestore" });
  });

  it("un file che non serve nessuna rotta resta fuori", () => {
    for (const f of ["src/app/layout.tsx", "src/app/not-found.tsx", "src/app/loading.tsx",
      "src/app/prenota/ModuloPrenotazione.tsx", "src/components/ui/Bottone.tsx"]) {
      assert.equal(rottaDaFile(f, "src/app"), null, f);
    }
  });

  it("le radici escluse non entrano nell'elenco", () => {
    const rotte = rotteDaSorgenti(
      ["src/app/page.tsx", "src/app/admin/page.tsx", "src/app/catalogo/page.tsx"],
      { radicePubblica: "src/app", radiciEscluse: ["src/app/admin"] },
    );
    assert.deepEqual(rotte.map((r) => r.rotta), ["/", "/catalogo"]);
  });

  it("un segmento dinamico si confronta come modello, non come testo", () => {
    assert.equal(combacia("/catalogo/[slug]", "/catalogo/acero-palmato"), true);
    assert.equal(combacia("/catalogo/[slug]", "/catalogo/a/b"), false);
    assert.equal(combacia("/blog/[...tutto]", "/blog/2026/estate"), true);
    assert.equal(combacia("/catalogo", "/catalogo/"), true);
    assert.equal(combacia("/catalogo", "/contatti"), false);
  });

  it("`/admin/*` esclude la sezione e i suoi figli", () => {
    assert.equal(esclusa("/admin", ["/admin/*"]), true);
    assert.equal(esclusa("/admin/ordini", ["/admin/*"]), true);
    assert.equal(esclusa("/catalogo", ["/admin/*"]), false);
  });
});

describe("passo pagine-vive, due direzioni", () => {
  const pagine = [
    { id: "home", percorso: "/", rimandaA: null },
    { id: "catalogo", percorso: "/catalogo", rimandaA: null },
  ];
  const rotteSorgenti = [{ rotta: "/", file: "src/app/page.tsx" }, { rotta: "/catalogo", file: "src/app/catalogo/page.tsx" }];
  const tutteVive = new Map([["home", { stato: 200 }], ["catalogo", { stato: 200 }]]);

  it("NON scatta quando tutto risponde ed e' tutto dichiarato", () => {
    assert.deepEqual(findingsRotte({ pagine, risposte: tutteVive, rotteSorgenti, escluse: [] }), []);
  });

  it("SCATTA su una pagina dichiarata che risponde 404", () => {
    const risposte = new Map([["home", { stato: 200 }], ["catalogo", { stato: 404 }]]);
    const findings = findingsRotte({ pagine, risposte, rotteSorgenti, escluse: [] });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
  });

  it("SCATTA su una pagina che rimanda altrove senza dichiararlo", () => {
    const risposte = new Map([["home", { stato: 307, rimandoA: "/contatti" }], ["catalogo", { stato: 200 }]]);
    const findings = findingsRotte({ pagine, risposte, rotteSorgenti, escluse: [] });
    assert.match(findings[0].message, /non e' quella pagina/);
  });

  it("NON scatta se il rimando e' dichiarato con `Rimanda a:`", () => {
    const conRimando = [{ id: "home", percorso: "/", rimandaA: "/contatti" }, pagine[1]];
    const risposte = new Map([["home", { stato: 307, rimandoA: "/contatti" }], ["catalogo", { stato: 200 }]]);
    assert.deepEqual(findingsRotte({ pagine: conRimando, risposte, rotteSorgenti, escluse: [] }), []);
  });

  it("SCATTA (issue) su una rotta pubblica servita e non dichiarata", () => {
    const conExtra = [...rotteSorgenti, { rotta: "/promozioni", file: "src/app/promozioni/page.tsx" }];
    const findings = findingsRotte({ pagine, risposte: tutteVive, rotteSorgenti: conExtra, escluse: [] });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
    assert.equal(findings[0].object, "/promozioni");
  });

  it("SCATTA (issue) su un `route.ts` pubblico che nessuno ha dichiarato", () => {
    // MISURATO sul banco il 2026-08-04: `/disponibilita` rispondeva 200 con dei
    // dati, e il gate chiudeva VERDE 10/10 contando «9 rotte pubbliche».
    const conGestore = [...rotteSorgenti, { rotta: "/disponibilita", file: "src/app/disponibilita/route.ts", tipo: "gestore" }];
    const findings = findingsRotte({ pagine, risposte: tutteVive, rotteSorgenti: conGestore, escluse: [] });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
    assert.equal(findings[0].object, "/disponibilita");
    assert.match(findings[0].message, /servita dal gestore/);
    assert.match(findings[0].hint, /§Percorsi di scrittura aperti al pubblico/);
  });

  it("e NON scatta sul gestore messo fra le escluse col perche'", () => {
    const conGestore = [...rotteSorgenti, { rotta: "/disponibilita", file: "src/app/disponibilita/route.ts", tipo: "gestore" }];
    assert.deepEqual(
      findingsRotte({ pagine, risposte: tutteVive, rotteSorgenti: conGestore, escluse: ["/disponibilita"] }),
      [],
    );
  });

  it("NON scatta se quella rotta e' fra le escluse del contratto", () => {
    const conExtra = [...rotteSorgenti, { rotta: "/promozioni", file: "src/app/promozioni/page.tsx" }];
    assert.deepEqual(findingsRotte({ pagine, risposte: tutteVive, rotteSorgenti: conExtra, escluse: ["/promozioni"] }), []);
  });

  it("una rotta dinamica coperta dall'istanza rappresentante non e' un rilievo", () => {
    const conDinamica = [...rotteSorgenti, { rotta: "/catalogo/[slug]", file: "src/app/catalogo/[slug]/page.tsx" }];
    const conScheda = [...pagine, { id: "scheda", percorso: "/catalogo/acero-palmato", rimandaA: null }];
    const risposte = new Map([...tutteVive, ["scheda", { stato: 200 }]]);
    assert.deepEqual(findingsRotte({ pagine: conScheda, risposte, rotteSorgenti: conDinamica, escluse: [] }), []);
  });

  it("una pagina dichiarata che non risponde affatto e' un bloccante", () => {
    const risposte = new Map([["home", null], ["catalogo", { stato: 200 }]]);
    assert.match(findingsRotte({ pagine, risposte, rotteSorgenti, escluse: [] })[0].message, /nessuna risposta/);
  });
});

describe("app servita", () => {
  const PROD = `<html><head><script src="/_next/static/chunks/main-app-f1e4859868969239.js"></script></head><body>ciao</body></html>`;
  const DEV = `<html><head><script src="/_next/static/chunks/main-app.js?v=1785407832332"></script><script src="/_next/static/chunks/app-pages-internals.js"></script></head><body>ciao</body></html>`;

  // Le due forme sono RITAGLI VERI, presi dal banco il 2026-08-03 sullo stesso
  // progetto servito nei due modi (Next 16, Turbopack di default).
  const DEV_TURBO = `<html><head><script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_1xx01vv._.js"></script><script src="/_next/static/chunks/node_modules_next_dist_compiled_next-devtools_index_090k2jm.js"></script></head><body>ciao</body></html>`;
  const PROD_TURBO = `<html><head><script src="/_next/static/chunks/turbopack-3l1jj1uo0j4no.js"></script><script src="/_next/static/chunks/0cz1d0mv5g_q7.js"></script></head><body>ciao</body></html>`;

  it("falso verde n°5: una dev server si riconosce dagli indizi strutturali", () => {
    const indizi = indiziDevServer(DEV);
    assert.ok(indizi.length >= 2);
    assert.deepEqual(indiziDevServer(PROD), []);
  });

  it("falso verde n°5 su TURBOPACK: i sette indizi dell'era Webpack non bastavano", () => {
    // Misurato col sabotaggio: su `next dev` di Next 16 nessuno dei sette
    // indizi storici scattava, e il gate accusava «un'altra applicazione sulla
    // stessa porta» mentre l'applicazione era proprio questa.
    assert.ok(indiziDevServer(DEV_TURBO).length >= 2);
  });

  it("e su una build di produzione di Turbopack NON scattano", () => {
    // La parola `turbopack` da sola non e' un indizio: in produzione c'e'
    // anche li', dentro `turbopack-<hash>.js`.
    assert.deepEqual(indiziDevServer(PROD_TURBO), []);
  });

  it("una pagina che PARLA di hmr o di devtools non e' una dev server", () => {
    // Gli indizi sono ancorati a un percorso di chunk apposta: un sito che
    // documenta Next non deve far fallire il proprio gate.
    const pagina = `<html><body><h1>Come funziona hmr-client</h1><p>Il pacchetto next-devtools serve in sviluppo.</p></body></html>`;
    assert.deepEqual(indiziDevServer(pagina), []);
  });

  it("falso verde n°3: il BUILD_ID di un altro progetto non e' il mio", () => {
    assert.equal(eLaMiaBuild(PROD, "f1e4859868969239"), true);
    assert.equal(eLaMiaBuild(PROD, "altro-build-id"), false);
    assert.equal(eLaMiaBuild(PROD, ""), false);
    assert.equal(eLaMiaBuild(PROD, null), false);
  });

  it("decodifica le entita' HTML, apostrofi italiani compresi", () => {
    assert.equal(decodificaEntita("L&#x27;orto d&#39;inverno &amp; il vivaio"), "L'orto d'inverno & il vivaio");
  });

  it("il testo servito NON contiene il payload RSC degli script", () => {
    const html = `<body><h1>Vivaio</h1><script>self.__next_f.push([1,"testo che non si vede"])</script></body>`;
    const testo = testoServito(html);
    assert.equal(testo.includes("Vivaio"), true);
    assert.equal(testo.includes("testo che non si vede"), false);
  });

  it("il testo servito compatta gli spazi e toglie i tag", () => {
    assert.equal(testoServito("<p>  a\n  <b>b</b>\n</p>"), "a b");
  });

  it("collaudo P2: il testo alternativo di un'immagine E' testo servito", () => {
    // MISURATO sul banco `banco-prova-valscura` il 2026-08-04: il valore piu'
    // lungo di contenuto dello slot `cucina-nota-polenta` era `immagine_alt`,
    // la pagina lo serviva dentro l'attributo `alt`, e il passo 9 lo dichiarava
    // assente — `block` su una pagina corretta. Quel testo lo legge chi usa uno
    // screen reader e lo vede chiunque quando la foto non arriva: e' contenuto.
    const html = `<figure><img src="/foto/paiolo.png" alt="Il paiolo di rame sul fuoco"/><figcaption>La polenta</figcaption></figure>`;
    const testo = testoServito(html);
    assert.equal(testo.includes("Il paiolo di rame sul fuoco"), true);
    assert.equal(testo.includes("La polenta"), true);
    // Il percorso della foto resta fuori: non e' testo, e' un indirizzo.
    assert.equal(testo.includes("/foto/paiolo.png"), false);
  });

  it("collaudo P2: un attributo che FINISCE per `alt` non e' un testo alternativo", () => {
    // `data-alt` e `salt` non sono `alt`: senza l'ancora sullo spazio, il tag
    // porterebbe in pagina una stringa che nessuno legge.
    const testo = testoServito(`<div data-alt="mai letto"><span>visibile</span></div>`);
    assert.equal(testo.includes("mai letto"), false);
    assert.equal(testo.includes("visibile"), true);
  });

  it("collaudo P2: un tag con `alt` non incolla le parole vicine", () => {
    assert.equal(testoServito(`<p>prima<img alt="in mezzo">dopo</p>`), "prima in mezzo dopo");
  });
});

describe("segnaposto nel testo servito", () => {
  it("SCATTA su segnaposto, lorem ipsum e formule del template", () => {
    const testi = new Map([
      ["home (/)", "benvenuti {{NOME_AZIENDA}} da noi"],
      ["chi (/chi-siamo)", "Lorem ipsum dolor sit amet"],
      ["contatti (/contatti)", "TODO scrivere gli orari"],
    ]);
    const findings = findingsSegnaposto(testi);
    assert.equal(findings.length, 3);
    assert.ok(findings.every((f) => f.severity === "block"));
  });

  it("NON scatta su una pagina finita", () => {
    assert.deepEqual(findingsSegnaposto(new Map([["home (/)", "Il vivaio e' aperto dal martedi' al sabato"]])), []);
  });
});

describe("contenuti dal database", () => {
  const contratto = leggiContratto(CONTRATTO);
  const FRAMMENTO = "Il vivaio delle piante rare della Corte Vecchia";
  const base = {
    contratto,
    valoriPerSlot: new Map([["home-hero", [FRAMMENTO, "corto"]]]),
    testoPerPagina: new Map([["home", `Benvenuti — ${FRAMMENTO} — dal 1987`], ["catalogo", "48 piante"]]),
    cercaNeiSorgenti: () => [],
    conteggiAnon: new Map([["piante", { stato: "letta", righe: 48 }]]),
    soglia: SOGLIA_FRAMMENTO,
  };

  it("NON scatta quando il testo e' nel database, in pagina e non nei sorgenti", () => {
    const { findings, mancanti } = findingsContenuti(base);
    // `catalogo` e' `statico` e non mostra slot: nessun rilievo di freschezza.
    assert.deepEqual(findings, []);
    assert.deepEqual(mancanti, []);
  });

  it("SCATTA se il valore pubblicato non compare nella pagina che lo dichiara", () => {
    const { findings } = findingsContenuti({ ...base, testoPerPagina: new Map([["home", "tutt'altro testo"]]) });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /non compare nel testo servito/);
  });

  it("SCATTA se lo stesso testo sta CABLATO nei sorgenti", () => {
    const { findings } = findingsContenuti({ ...base, cercaNeiSorgenti: () => ["src/app/page.tsx"] });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /CABLATO nei sorgenti/);
  });

  it("SCATTA (block) su una fonte con zero righe leggibili dall'anonimo", () => {
    const { findings } = findingsContenuti({ ...base, conteggiAnon: new Map([["piante", { stato: "letta", righe: 0 }]]) });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /zero righe leggibili impersonando il ruolo anonimo/);
  });

  it("collaudo P2: una fonte che ESISTE e che l'anonimo non puo' leggere e' un `block`, non un MANCANTE", () => {
    // MISURATO sul banco il 2026-08-04. Prima, «non esiste», «esiste e il
    // permesso e' negato» e «non sono riuscito a interrogare» collassavano nello
    // stesso `null` e producevano la stessa riga: «non interrogata (tabella
    // assente o non leggibile) — verifica non fatta». Su una tabella che esiste
    // benissimo e' una misura riuscita con esito negativo travestita da verifica
    // mancante, e manda a controllare `psql` invece della policy.
    const { findings, mancanti } = findingsContenuti({
      ...base,
      conteggiAnon: new Map([["piante", { stato: "negata", righe: null }]]),
    });
    assert.deepEqual(mancanti, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /lettura e' RIFIUTATA/);
    assert.match(findings[0].hint, /grant select/);
  });

  it("collaudo P2: una fonte dichiarata che nel database non esiste e' un `block`", () => {
    const { findings, mancanti } = findingsContenuti({
      ...base,
      conteggiAnon: new Map([["piante", { stato: "assente", righe: null }]]),
    });
    assert.deepEqual(mancanti, []);
    assert.match(findings[0].message, /non esiste nessuna relazione con questo nome/);
  });

  it("una fonte non interrogata e' una verifica MANCANTE, non un verde", () => {
    const { mancanti } = findingsContenuti({ ...base, conteggiAnon: new Map() });
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /non interrogata/);
  });

  it("falso verde n°9: un valore sotto la soglia distintiva NON e' verificato", () => {
    const { mancanti, findings } = findingsContenuti({ ...base, valoriPerSlot: new Map([["home-hero", ["Chi siamo"]]]) });
    assert.deepEqual(findings, []);
    assert.match(mancanti[0], /sotto la soglia distintiva/);
  });

  it("collaudo P2: la diagnosi dello slot corto porta il NUMERO, cioe' la manopola", () => {
    // Su `banco-prova-valscura` quattro slot su tredici stavano sotto il ripiego
    // di 24 caratteri, e la riga di prima («nessun valore lungo almeno 24») non
    // diceva se il contenuto misurasse 23 o se la riga fosse vuota. La soglia si
    // dichiara nel contratto: senza il numero, quella riga non e' azionabile.
    // Misurato: a 24 quattro slot non verificati, a 19 tutti e tredici verdi.
    const { mancanti } = findingsContenuti({
      ...base,
      valoriPerSlot: new Map([["home-hero", ["Marta e Ivan, dal 2019."]]]),
    });
    assert.match(mancanti[0], /misura 23 caratteri/);
    assert.match(mancanti[0], /soglia distintiva di 24/);
    assert.match(mancanti[0], /Lunghezza minima del frammento distintivo/);
  });

  it("piuLungoDiContenuto ignora la soglia, i valori tecnici e la chiave", () => {
    const riga = ["home-hero", "44444444-4444-4444-8444-000000000006", "corto", "un po' piu' lungo"];
    assert.equal(piuLungoDiContenuto(riga, ["home-hero"]), "un po' piu' lungo");
    assert.equal(piuLungoDiContenuto([], []), null);
  });

  it("S1: slot dichiarato senza riga pubblicata e' un `block` (deciso sul banco il 2026-08-03)", () => {
    // I due casi del mandato — riga in bozza e riga assente — danno lo stesso
    // esito visibile sul banco: la pagina serve la sezione decapitata. In tutti
    // e due il database HA RISPOSTO, quindi e' una misura riuscita con esito
    // negativo, non una verifica che non si e' potuta fare.
    const { findings, mancanti } = findingsContenuti({ ...base, valoriPerSlot: new Map([["home-hero", null]]) });
    assert.deepEqual(mancanti, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /nessuna riga pubblicata con questa chiave/);
  });

  it("S1, l'altra meta': la tabella NON interrogata resta MANCANTE, e non N block", () => {
    // Senza questa distinzione un `psql` che fallisce produrrebbe un `block` per
    // ogni slot dichiarato, cioe' N diagnosi che mandano a cercare righe che
    // magari ci sono tutte.
    const { findings, mancanti } = findingsContenuti({ ...base, valoriPerSlot: null });
    assert.deepEqual(findings, []);
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /non interrogata/);
    assert.match(mancanti[0], /nessuno dei \d+ slot dichiarati/);
  });

  it("falso verde trovato col sabotaggio: pagina non scaricata = slot NON verificato", () => {
    // Classe E del sabotaggio, 2026-08-03: con la pagina dichiarata a 404 il
    // passo chiudeva «nessun rilievo» avendo saltato in silenzio i suoi slot.
    // La meta' «la stringa e' in pagina» non era stata verificata affatto.
    const { findings, mancanti } = findingsContenuti({ ...base, testoPerPagina: new Map() });
    assert.deepEqual(findings, []);
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /non e' stata scaricata/);
  });

  it("e NON dice niente quando la pagina e' stata scaricata davvero", () => {
    const { mancanti } = findingsContenuti(base);
    assert.deepEqual(mancanti, []);
  });

  it("segnala (issue) una pagina statica che mostra un contenuto editabile", () => {
    const statica = leggiContratto(CONTRATTO.replace("**Aggiornamento:** ISR 600", "**Aggiornamento:** statico"));
    const { findings } = findingsContenuti({ ...base, contratto: statica });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
    assert.match(findings[0].message, /non vedra' cambiare niente/);
  });

  it("frammentoDistintivo prende il piu' lungo sopra soglia, e null se nessuno lo e'", () => {
    assert.equal(frammentoDistintivo(["corto", "questo e' abbastanza lungo da essere distintivo"]), "questo e' abbastanza lungo da essere distintivo");
    assert.equal(frammentoDistintivo(["corto", "anche corto"]), null);
    assert.equal(frammentoDistintivo([]), null);
  });

  it("S2: la chiave primaria e le date NON sono candidati al frammento distintivo", () => {
    // MISURATO sul banco il 2026-08-03: `to_jsonb(t)` restituisce come testo
    // anche `id` (36 caratteri) e i due timestamp (32), che su uno slot corto
    // vincevano il confronto «il piu' lungo». Il gate cercava l'UUID della riga
    // nella pagina e produceva un `block` con una diagnosi bugiarda su una
    // pagina corretta.
    const riga = [
      "44444444-4444-4444-8444-000000000006", // id
      "2026-08-03T16:01:00.506112+00:00", // created_at
      "2026-08-03T16:01:00.506112+00:00", // updated_at
      "pie-pagina",
      "Bologna, telefono 051 000 111", // il contenuto vero: 29 caratteri
    ];
    assert.equal(frammentoDistintivo(riga), "Bologna, telefono 051 000 111");
  });

  it("S2, il caso in cui NON deve scattare: un testo che somiglia a una data non e' tecnico", () => {
    // La regola scarta per FORMA, e la forma deve essere quella intera: un
    // contenuto che contiene una data non e' una data.
    const testo = "Chiusura estiva dal 2026-08-01 al 2026-08-31, riapriamo lunedi'";
    assert.equal(frammentoDistintivo([testo, "44444444-4444-4444-8444-000000000006"]), testo);
  });

  it("collaudo P2: la CHIAVE dello slot non e' un candidato al frammento distintivo", () => {
    // MISURATO sul banco `banco-prova-valscura` il 2026-08-04. `to_jsonb(t)`
    // porta anche la colonna-chiave, e su uno slot con la chiave lunga e il
    // contenuto corto vinceva lei. E' il candidato peggiore possibile: sbaglia
    // in tutte e due le direzioni per costruzione — in pagina non c'e' mai,
    // nei sorgenti c'e' sempre.
    const riga = ["prenotazione-avviso-caparra", "La caparra", "Trenta euro a persona."];
    assert.equal(frammentoDistintivo(riga, 24, ["prenotazione-avviso-caparra"]), null);
    // Senza l'esclusione sarebbe la chiave, cioe' il difetto:
    assert.equal(frammentoDistintivo(riga, 24), "prenotazione-avviso-caparra");
  });

  it("collaudo P2: due `block` falsi in meno quando la chiave e' il valore piu' lungo", () => {
    // L'uscita di prima, sul banco, su una pagina che mostrava il suo slot
    // perfettamente: «non compare nel testo servito» + «sta CABLATO nei
    // sorgenti». Il secondo accusava la pagina di aver cablato il contenuto
    // mentre chiedeva lo slot per chiave, che e' quello che la skill prescrive.
    const CHIAVE_LUNGA = "prenotazione-avviso-caparra";
    const esito = findingsContenuti({
      ...base,
      contratto: leggiContratto(CONTRATTO.replaceAll("home-hero", CHIAVE_LUNGA)),
      valoriPerSlot: new Map([[CHIAVE_LUNGA, [CHIAVE_LUNGA, "La caparra", "corto"]]]),
      // I sorgenti contengono la chiave: e' cosi' che la pagina chiede lo slot.
      cercaNeiSorgenti: (frammento) => (frammento === CHIAVE_LUNGA ? ["src/app/page.tsx"] : []),
    });
    assert.deepEqual(esito.findings, []);
    assert.match(esito.mancanti[0], /sotto la soglia distintiva/);
  });

  it("collaudo P2: un URL e un percorso di asset non sono testo di pagina", () => {
    // Stessa famiglia dell'UUID: vivono dentro un attributo `src`, e spariscono
    // insieme ai tag. Misurato su `cucina-nota-polenta` il 2026-08-04.
    const riga = ["/foto/cucina-paiolo-di-rame.png", "https://esempio.example/foto/paiolo.png", "corto"];
    assert.equal(frammentoDistintivo(riga), null);
  });

  it("collaudo P2, il caso in cui NON deve scattare: un testo che contiene una barra non e' un percorso", () => {
    const testo = "Aperti tutti i giorni, mezza pensione 65/75 euro a persona";
    assert.equal(frammentoDistintivo([testo, "/foto/paiolo.png"]), testo);
  });

  it("S2: se l'unico valore lungo e' tecnico, lo slot risulta NON verificato", () => {
    // Togliere i candidati tecnici non li promuove a MANCANTE per magia: senza
    // contenuto sopra soglia lo slot resta dichiarato non verificato, che e' la
    // risposta onesta.
    const { findings, mancanti } = findingsContenuti({
      ...base,
      valoriPerSlot: new Map([["home-hero", ["44444444-4444-4444-8444-000000000006", "corto"]]]),
    });
    assert.deepEqual(findings, []);
    assert.match(mancanti[0], /sotto la soglia distintiva/);
  });
});

describe("dati visibili a un anonimo: il firmato contro il concesso", () => {
  // Il difetto n°9 del collaudo 2026-08-04, gemello del n°5 sul lato lettura:
  // §Dati visibili a un anonimo e' la sezione per cui esiste la firma, e non la
  // leggeva NESSUNO dei dieci passi. Sul banco `banco-prova-valscura` un
  // contratto scritto con cura dichiarava 22 colonne su tre relazioni, e `anon`
  // ne poteva leggere 36: le quattordici in piu' — `id`, `pubblicata`,
  // `created_at`, `updated_at`, `chiave`, `in_evidenza` — nessuna pagina le
  // seleziona, ma PostgREST le serve a chiunque abbia la chiave anonima, che sta
  // nel bundle. `sabotaggio.md` dichiarava la classe CIECA: non lo era.
  const conLetture = (righe) => leggiContratto(CONTRATTO.replace(
    "## Percorsi di scrittura aperti al pubblico",
    ["## Dati visibili a un anonimo", "",
      "| Tabella o vista | Cosa vede un visitatore senza account | Chi l'ha autorizzato |",
      "|---|---|---|",
      ...righe, "",
      "## Percorsi di scrittura aperti al pubblico"].join("\n"),
  ));

  const RIGA_PIANTE = "| `piante` | `slug`, `nome` delle piante con `pubblicata = true` | Elena Barbieri (titolare) (2026-07-24) |";
  const base = (contratto) => ({
    contratto,
    valoriPerSlot: new Map([["home-hero", ["Il vivaio delle piante rare della Corte Vecchia"]]]),
    testoPerPagina: new Map([["home", "Il vivaio delle piante rare della Corte Vecchia"], ["catalogo", "48 piante"]]),
    cercaNeiSorgenti: () => [],
    conteggiAnon: new Map([["piante", { stato: "letta", righe: 48 }]]),
    soglia: SOGLIA_FRAMMENTO,
  });

  it("legge la tabella dalla sua intestazione, e le colonne dalla TESTA della cella", () => {
    const c = conLetture([RIGA_PIANTE]);
    assert.deepEqual(c.letture, [
      { relazione: "piante", colonne: ["slug", "nome"], niente: false, tutte: false },
    ]);
  });

  it("NON raccoglie gli apici sparsi nella prosa della cella", () => {
    // Il falso positivo misurato mentre si scriveva la regola: `pubblicata` sta
    // dentro `pubblicata = true` (e non e' un identificatore da solo), e
    // `security_invoker` sta in coda a una frase. Nessuno dei due e' una colonna
    // dichiarata, e prenderli produceva due `block` su righe corrette.
    const c = conLetture([
      "| `v_gite` | `slug`, `titolo` delle sole gite in evidenza, filtrate a monte dalla vista con `security_invoker` | Elena Barbieri (titolare) (2026-07-24) |",
    ]);
    assert.deepEqual(c.letture[0].colonne, ["slug", "titolo"]);
  });

  it("una cella che NON comincia con le colonne non e' confrontabile: MANCANTE, non verde", () => {
    const c = conLetture([
      "| `v_gite` | le stesse colonne di sopra, filtrate dalla vista | Elena Barbieri (titolare) (2026-07-24) |",
    ]);
    const { findings, mancanti } = findingsContenuti({
      ...base(c), colonneConcesse: new Map([["v_gite", ["slug", "titolo"]]]),
    });
    assert.deepEqual(findings, []);
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /non elenca nessuna colonna fra apici/);
  });

  it("SCATTA (block) sulle colonne che `anon` legge e che la firma non dichiara", () => {
    const { findings } = findingsContenuti({
      ...base(conLetture([RIGA_PIANTE])),
      colonneConcesse: new Map([["piante", ["slug", "nome", "id", "costo_acquisto", "created_at"]]]),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /puo' leggere 3 colonne che la firma non dichiara: id, costo_acquisto, created_at/);
    assert.match(findings[0].hint, /PostgREST serve `\?select=` a chiunque/);
  });

  it("NON scatta quando il firmato e il concesso coincidono", () => {
    const { findings, mancanti } = findingsContenuti({
      ...base(conLetture([RIGA_PIANTE])),
      colonneConcesse: new Map([["piante", ["slug", "nome"]]]),
    });
    assert.deepEqual(findings, []);
    assert.deepEqual(mancanti, []);
  });

  it("`niente` e' una dichiarazione: passa a zero colonne, e diventa `block` se ce n'e' una", () => {
    const buca = "| `messaggi` | **niente.** Ci si scrive e non ci si legge: nessun `grant select` per `anon` | Elena Barbieri (titolare) (2026-07-24) |";
    const pulito = findingsContenuti({
      ...base(conLetture([buca])), colonneConcesse: new Map([["messaggi", []]]),
    });
    assert.deepEqual(pulito.findings, []);
    assert.deepEqual(pulito.mancanti, []);

    const aperto = findingsContenuti({
      ...base(conLetture([buca])), colonneConcesse: new Map([["messaggi", ["email", "telefono"]]]),
    });
    assert.equal(aperto.findings[0].severity, "block");
    assert.match(aperto.findings[0].message, /non ne vede niente, e `anon` ha invece `select` su 2 colonne/);
  });

  it("una colonna dichiarata e NON concessa e' un `block`: PostgREST rifiuta tutta la query", () => {
    const { findings } = findingsContenuti({
      ...base(conLetture([RIGA_PIANTE])),
      colonneConcesse: new Map([["piante", ["slug"]]]),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /dichiara 1 colonne che `anon` NON puo' leggere: nome/);
    assert.match(findings[0].hint, /si serve VUOTA/);
  });

  it("«tutte le colonne» e' la riga che il template vieta, e si vede", () => {
    const { findings } = findingsContenuti({
      ...base(conLetture(["| `piante` | tutte le colonne della tabella | Elena Barbieri (titolare) (2026-07-24) |"])),
      colonneConcesse: new Map([["piante", ["slug", "nome", "costo_acquisto"]]]),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /«tutte le colonne» \(3 concesse a `anon`\)/);
  });

  it("una relazione non interrogata e' una verifica MANCANTE, non un verde", () => {
    const { findings, mancanti } = findingsContenuti({
      ...base(conLetture([RIGA_PIANTE])), colonneConcesse: new Map(),
    });
    assert.deepEqual(findings, []);
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /privilegi di colonna non interrogati/);
  });
});

describe("percorsi di scrittura aperti al pubblico", () => {
  // Il difetto che ha fatto nascere questa suite, misurato sul banco
  // `banco-prova-valscura` il 2026-08-04: aperta la lettura della tabella del
  // modulo di prenotazione all'anonimo (due righe di SQL), chiunque poteva
  // rileggere nome, email, telefono e messaggio di chi aveva scritto prima — e
  // il gate chiudeva VERDE 10/10. Nessuno dei dieci passi guardava la sola
  // domanda che `SKILL.md` dichiara irreversibile.
  const CON_SCRITTURA = CONTRATTO.replace(
    "Nessuna scrittura pubblica.",
    ["| Rotta | Cosa scrive | Tabella | Chi l'ha autorizzato |",
      "|---|---|---|---|",
      "| `/contatti` | un messaggio del modulo | `messaggi` | Elena Barbieri (titolare) (2026-07-24) |"].join("\n"),
  );
  const contratto = leggiContratto(CON_SCRITTURA);
  const base = {
    contratto,
    valoriPerSlot: new Map([["home-hero", ["Il vivaio delle piante rare della Corte Vecchia"]]]),
    testoPerPagina: new Map([["home", "Il vivaio delle piante rare della Corte Vecchia"], ["catalogo", "48 piante"]]),
    cercaNeiSorgenti: () => [],
    conteggiAnon: new Map([["piante", { stato: "letta", righe: 48 }]]),
    soglia: SOGLIA_FRAMMENTO,
  };

  it("legge la tabella dalla sua intestazione, non da una posizione fissa", () => {
    assert.deepEqual(contratto.scritture, [
      { rotta: "/contatti", tabella: "messaggi", letturaPubblica: false },
    ]);
    assert.equal(contratto.nessunaScritturaDichiarata, false);
  });

  it("`Nessuna scrittura pubblica.` e' una dichiarazione, e si distingue da una tabella vuota", () => {
    assert.equal(leggiContratto(CONTRATTO).nessunaScritturaDichiarata, true);
    assert.equal(leggiContratto(CONTRATTO.replace("Nessuna scrittura pubblica.", "")).nessunaScritturaDichiarata, false);
  });

  it("un contratto che non dichiara ne' le scritture ne' la loro assenza prende un `issue`", () => {
    const muto = leggiContratto(CONTRATTO.replace("Nessuna scrittura pubblica.", ""));
    const findings = findingsContratto(muto, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
    assert.match(findings[0].message, /Percorsi di scrittura/);
  });

  it("CHI SCRIVE NON LEGGE: se l'anonimo rilegge la tabella e' un `block`", () => {
    const { findings } = findingsContenuti({
      ...base,
      letturaScritture: new Map([["messaggi", { stato: "letta", righe: 312 }]]),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /RILEGGE 312 righe/);
  });

  it("e NON scatta quando la lettura e' rifiutata, che e' come deve andare", () => {
    const { findings, mancanti } = findingsContenuti({
      ...base,
      letturaScritture: new Map([["messaggi", { stato: "negata", righe: null }]]),
    });
    assert.deepEqual(findings, []);
    assert.deepEqual(mancanti, []);
  });

  it("un guestbook lo si dichiara, e allora scende a `issue`", () => {
    const guestbook = leggiContratto(
      CON_SCRITTURA.replace("un messaggio del modulo", "un messaggio del modulo, a lettura pubblica"),
    );
    const { findings } = findingsContenuti({
      ...base,
      contratto: guestbook,
      letturaScritture: new Map([["messaggi", { stato: "letta", righe: 312 }]]),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
  });

  it("la tabella dichiarata che nel database non esiste e' un `block`", () => {
    const { findings } = findingsContenuti({
      ...base,
      letturaScritture: new Map([["messaggi", { stato: "assente", righe: null }]]),
    });
    assert.match(findings[0].message, /non esiste nessuna relazione/);
  });

  it("e se non e' stata interrogata resta una verifica MANCANTE", () => {
    const { findings, mancanti } = findingsContenuti({ ...base, letturaScritture: new Map() });
    assert.deepEqual(findings, []);
    assert.equal(mancanti.length, 1);
    assert.match(mancanti[0], /non si e' potuto verificare se l'anonimo la rilegge/);
  });
});

describe("la chiamata a psql", () => {
  it("porta SEMPRE `-q`, e non e' cosmetica", () => {
    // MISURATO sul banco `banco-prova-valscura` il 2026-08-04. Senza `-q`,
    // `psql` stampa su stdout il tag del comando (`SET` per `set role anon`) e
    // quel tag finisce nel primo record INSIEME al valore, perche' `-R`
    // sostituisce il terminatore di riga e non quello di una riga di stato: il
    // conteggio diventa `SET0`, `Number(...)` da' `NaN`, e `NaN === 0` e' falso.
    // La regola «zero righe leggibili impersonando il ruolo anonimo» — il modo
    // n°1 in cui un sito pubblico sopra la RLS fallisce in silenzio — non
    // poteva scattare: il gate di P1 la nominava ZERO volte su una tabella
    // senza policy di lettura per `anon`.
    const args = argomentiPsql("postgresql://x", "select 1");
    assert.equal(args.includes("-q"), true);
    assert.equal(args.includes("-A"), true);
    assert.equal(args.includes("-t"), true);
    assert.equal(args[args.length - 1], "select 1");
  });

  it("righeDaPsql legge record e campi, e toglie i CRLF di Windows", () => {
    const RS = "\u001e";
    const FS = "\u001f";
    assert.deepEqual(righeDaPsql(`a${FS}b\r\n${RS}c${FS}d\r\n${RS}`), [["a", "b"], ["c", "d"]]);
    assert.deepEqual(righeDaPsql(`0\r\n${RS}`), [["0"]]);
    assert.deepEqual(righeDaPsql(""), []);
  });

  it("e il conteggio letto e' un NUMERO, non una stringa col tag davanti", () => {
    const RS = "\u001e";
    const righe = righeDaPsql(`0\r\n${RS}`);
    assert.equal(Number(righe[righe.length - 1][0]), 0);
    // Il difetto di P1, in una riga: se il tag fosse ancora li', questo sarebbe NaN.
    assert.equal(Number.isNaN(Number(righe[righe.length - 1][0])), false);
  });
});

describe("il database del progetto", () => {
  const CONFIG_TOML = `[api]\nport = 54321\nschemas = [\n  "public",\n  "negozio"\n]\n\n[db]\nport = 54322\nmajor_version = 17\n`;

  it("la porta viene dal config.toml del progetto, mai dall'ambiente", () => {
    assert.equal(urlDbProgetto(CONFIG_TOML), "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
    assert.equal(urlDbProgetto("[api]\nport = 1\n"), null);
  });

  it("falso verde: un elenco di schemi su piu' righe si legge TUTTO", () => {
    assert.deepEqual(schemiEsposti(CONFIG_TOML), ["public", "negozio"]);
  });

  it("una chiave `schemas` presente ma illeggibile NON ripiega su public", () => {
    assert.equal(schemiEsposti(`[api]\nschemas = quello che capita\n`), null);
  });

  it("senza `[api]` si assume `public`, che e' il default di Supabase", () => {
    assert.deepEqual(schemiEsposti("[db]\nport = 54322\n"), ["public"]);
  });

  it("valoreToml legge solo dentro la sezione giusta", () => {
    assert.equal(valoreToml(CONFIG_TOML, "db", "port").trim(), "54322");
    assert.equal(valoreToml(CONFIG_TOML, "db", "inesistente"), null);
  });
});

describe("contratto d'uscita", () => {
  it("il verdetto e' ROSSO se anche un solo passo non e' `pass`", () => {
    assert.equal(verdettoDa([{ status: "pass" }, { status: "pass" }]), "VERDE");
    assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
    assert.equal(verdettoDa([{ status: "fail" }]), "ROSSO");
  });

  it("handoff assente = bloccante", () => {
    assert.match(contrattoUscita("docs/handoff/08-vetrina-crafter.md", null, "VERDE")[0].message, /assente/);
  });

  it("dichiarare ROSSO su un gate rosso PASSA: dichiarare non e' fallire", () => {
    assert.deepEqual(contrattoUscita("h.md", "## Residui\n\n**Gate: ROSSO** (1 falliti)\n", "ROSSO"), []);
  });

  it("SCATTA se l'handoff dichiara un verdetto diverso da quello misurato", () => {
    assert.match(contrattoUscita("h.md", "Gate: VERDE\n", "ROSSO")[0].message, /parla di un'altra esecuzione/);
  });

  it("SCATTA sui segnaposto non compilati", () => {
    assert.ok(contrattoUscita("h.md", "Gate: VERDE\n\nPagine: {{ELENCO}}\n", "VERDE").some((f) => /segnaposto/.test(f.message)));
  });

  it("falso verde: un `Gate:` dentro un blocco recintato NON e' una dichiarazione", () => {
    // `sabotaggio.md` prescrive di incollare l'uscita del gate nell'handoff: e'
    // una prova allegata, non un verdetto. Flow Sentinel ha misurato il caso
    // opposto il 2026-07-28.
    const handoff = "```\nGATE VETRINA: VERDE\nGate: VERDE\n```\n\n**Gate: ROSSO** (1 falliti)\n";
    assert.deepEqual(contrattoUscita("h.md", handoff, "ROSSO"), []);
  });

  it("SCATTA se manca del tutto la riga del verdetto", () => {
    assert.match(contrattoUscita("h.md", "## Residui\n\nqualche prosa\n", "VERDE")[0].message, /manca la riga/);
  });
});
