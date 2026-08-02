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
    assert.equal(rottaDaFile("src/app/page.tsx", "src/app"), "/");
    assert.equal(rottaDaFile("src/app/(pubblico)/catalogo/page.tsx", "src/app"), "/catalogo");
    assert.equal(rottaDaFile("src/app/catalogo/[slug]/page.tsx", "src/app"), "/catalogo/[slug]");
  });

  it("un file che non e' una pagina non e' una rotta", () => {
    assert.equal(rottaDaFile("src/app/layout.tsx", "src/app"), null);
    assert.equal(rottaDaFile("src/app/api/x/route.ts", "src/app"), null);
    assert.equal(rottaDaFile("src/components/ui/Bottone.tsx", "src/app"), null);
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

  it("falso verde n°5: una dev server si riconosce dagli indizi strutturali", () => {
    const indizi = indiziDevServer(DEV);
    assert.ok(indizi.length >= 2);
    assert.deepEqual(indiziDevServer(PROD), []);
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
    conteggiAnon: new Map([["piante", 48]]),
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
    const { findings } = findingsContenuti({ ...base, conteggiAnon: new Map([["piante", 0]]) });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /zero righe leggibili impersonando il ruolo anonimo/);
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

  it("DECISIONE SOSPESA: slot senza riga pubblicata resta MANCANTE, non block", () => {
    // Questo test fissa il comportamento ATTUALE (quello della P0 firmata), non
    // quello desiderato: la scelta fra MANCANTE e `block` si decide sul banco,
    // provando i due casi, e al 2026-08-02 il banco non esiste.
    const { findings, mancanti } = findingsContenuti({ ...base, valoriPerSlot: new Map([["home-hero", null]]) });
    assert.deepEqual(findings, []);
    assert.match(mancanti[0], /DECISIONE SOSPESA/);
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
