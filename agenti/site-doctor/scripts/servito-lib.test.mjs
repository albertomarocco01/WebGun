/**
 * Test delle regole sull'APP SERVITA.
 *
 * I test che cominciano con «falso verde» sono i modi in cui questo passo
 * potrebbe dire di sì senza aver guardato: nascono dallo STOP di metà pacchetto
 * (SKILL.md §Gate) o dal sabotaggio, e ognuno cita quale dei due.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  apiArchiviazioneIn,
  archiviazioneIncertaIn,
  assetDaProvare,
  attributi,
  campiAvvolti,
  campiDiPagina,
  candidatiInformativa,
  classificaCampo,
  collegamentiInterni,
  contaGravita,
  eLaMiaBuild,
  elementiDi,
  esitoIdentita,
  esitoLingua,
  etichettePerId,
  findingsAccessibilitaPagina,
  findingsArchiviazione,
  destinazioniModuli,
  findingsDatiRaccolti,
  findingsInformativa,
  findingsSuperficie,
  hreflangDi,
  langDi,
  livelliTitoli,
  lingueDaRotte,
  moduliDiPagina,
  nomeAccessibile,
  percorsiDaSitemap,
  percorsoInterno,
  perStampa,
  raggiungibiliDaCollegamenti,
  regioniNascoste,
  ripulisciDocumento,
  senzaScript,
  statoDaFindings,
  statoNonApplicabile,
  tagDi,
  terziDi,
  testoDellId,
  testoVisibile,
  VOCI_INFORMATIVA,
} from "./servito-lib.mjs";

const BASE = "http://127.0.0.1:3821";
const blocchi = (f) => f.filter((x) => x.severity === "block");

// --------------------------------------------------------------- primitivi
describe("pulizia del documento", () => {
  it("toglie il CORPO degli script e tiene il tag di apertura", () => {
    const pulito = senzaScript('<script src="/a.js">alert(1)</script><p>ciao</p>');
    assert.match(pulito, /<script src="\/a\.js"><\/script>/);
    assert.doesNotMatch(pulito, /alert/);
  });

  it("falso verde (STOP §6): il carico RSC non deve contare come DOM", () => {
    // Su Next in App Router l'albero serializzato viaggia dentro uno `<script>`
    // e contiene `["$","h1",...]`. Misurato sul pilota il 2026-08-06.
    const html = '<h1>Vera</h1><script>self.__next_f.push([1,"[\\"$\\",\\"h1\\",null,{}]"])</script>';
    assert.deepEqual(livelliTitoli(html), [1]);
  });

  it("falso verde: un <img> dentro il carico RSC non e' un <img> senza alt", () => {
    const html = '<script>["$","img",null,{"src":"/a.png"}]</script><main><h1>x</h1></main>';
    const findings = findingsAccessibilitaPagina("/x", `<html lang="it"><head><title>t</title></head><body>${html}</body></html>`);
    assert.deepEqual(findings.filter((f) => /img/.test(f.message)), []);
  });

  it("toglie i commenti, ma non li fa sparire dal grezzo", () => {
    assert.doesNotMatch(senzaScript("<!-- BUILD123 --><p>x</p>"), /BUILD123/);
    assert.ok(eLaMiaBuild("<!-- BUILD123 --><p>x</p>", "BUILD123"));
  });

  it("il testo visibile scioglie le entita' che React produce", () => {
    assert.equal(testoVisibile("<p>Forno d&#x27;Oro</p>"), "Forno d'Oro");
  });
});

describe("attributi", () => {
  it("il nome dell'attributo si legge in minuscolo", () => {
    // React serializza `autoComplete` cosi' com'e': un confronto sensibile alle
    // maiuscole avrebbe mancato il segnale piu' forte per riconoscere un dato
    // personale, e `dati-raccolti` sarebbe uscito verde sul modulo del pilota.
    assert.equal(attributi('<input autoComplete="tel" minLength="6">').autocomplete, "tel");
  });

  it("un attributo booleano esiste con valore vuoto", () => {
    assert.equal("required" in attributi("<input required>"), true);
  });

  it("regge apici singoli, doppi e valori nudi", () => {
    const a = attributi("<a href='/x' title=\"y\" rel=nofollow>");
    assert.deepEqual([a.href, a.title, a.rel], ["/x", "y", "nofollow"]);
  });

  it("`tagDi` non confonde <a> con <abbr>", () => {
    assert.equal(tagDi("<abbr>x</abbr><a href='/'>y</a>", "a").length, 1);
  });

  it("`elementiDi` porta il contenuto insieme al tag", () => {
    assert.deepEqual(elementiDi("<a href='/x'>ciao</a>", "a"), [{ tag: "<a href='/x'>", dentro: "ciao" }]);
  });
});

// -------------------------------------------------------------- superficie
describe("percorsi e superficie", () => {
  it("scarta le origini diverse, i frammenti e gli schemi non navigabili", () => {
    assert.equal(percorsoInterno("https://altro.example/x", BASE), null);
    assert.equal(percorsoInterno("#sezione", BASE), null);
    assert.equal(percorsoInterno("mailto:a@b.c", BASE), null);
    assert.equal(percorsoInterno("tel:+39015", BASE), null);
  });

  it("la barra finale non fa una pagina diversa", () => {
    assert.equal(percorsoInterno("/menu/", BASE), "/menu");
    assert.equal(percorsoInterno("/", BASE), "/");
  });

  it("la query non fa una pagina diversa ai fini della conformita'", () => {
    assert.equal(percorsoInterno("/menu?p=2", BASE), "/menu");
  });

  it("legge i collegamenti interni di una pagina", () => {
    const html = '<a href="/menu">M</a><a href="https://x.test/">X</a><a href="/menu">M</a>';
    assert.deepEqual(collegamentiInterni(html, BASE), ["/menu"]);
  });

  it("legge i percorsi di una sitemap", () => {
    const xml = `<urlset><url><loc>${BASE}/</loc></url><url><loc>${BASE}/menu</loc></url></urlset>`;
    assert.deepEqual(percorsiDaSitemap(xml, BASE), ["/", "/menu"]);
  });

  it("falso verde (sabotaggio X): la raggiungibilita' si calcola dal grafo, partendo da /", () => {
    // La sitemap fa da seme allo SCARICO, non alla scoperta: se alimentasse
    // anche i «collegamenti», le due sorgenti sarebbero una sola.
    const grafo = new Map([["/", []], ["/contatti", ["/", "/privacy"]], ["/privacy", ["/"]]]);
    assert.deepEqual(raggiungibiliDaCollegamenti(grafo, "/"), ["/"]);
  });

  it("una home senza collegamenti e una sitemap ricca sono un bloccante", () => {
    const f = findingsSuperficie({ daCollegamenti: ["/"], daSitemap: ["/", "/a", "/b"], dichiarate: [], sitemapLetta: true });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /la camminata non ha camminato/);
  });

  it("senza sitemap ma con la camminata viva: la sorgente e' una sola, e si dice", () => {
    const f = findingsSuperficie({ daCollegamenti: ["/", "/a", "/b"], daSitemap: [], dichiarate: [], sitemapLetta: false });
    assert.equal(f[0].severity, "issue");
    assert.match(f[0].message, /una sola sorgente/);
  });

  it("falso verde (tribunale): senza sitemap E senza camminata non c'e' NESSUNA sorgente", () => {
    // Il sabotaggio provava «home senza collegamenti + sitemap intera»; «home
    // senza collegamenti + sitemap ASSENTE» restava verde, cioe' il primo
    // testimone poteva mentire da solo purche' il secondo sparisse.
    const f = findingsSuperficie({ daCollegamenti: ["/"], daSitemap: [], dichiarate: [], sitemapLetta: false });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /NESSUNA sorgente indipendente/);
  });

  it("una pagina dichiarata e non raggiungibile e' un bloccante", () => {
    const f = findingsSuperficie({ daCollegamenti: ["/"], daSitemap: ["/"], dichiarate: ["/", "/sparita"], sitemapLetta: true });
    assert.deepEqual(blocchi(f).map((x) => x.object), ["/sparita"]);
  });

  it("una pagina raggiungibile e non dichiarata e' un rilievo, non un bloccante", () => {
    const f = findingsSuperficie({ daCollegamenti: ["/", "/nuova"], daSitemap: ["/"], dichiarate: ["/"], sitemapLetta: true });
    assert.deepEqual(f.filter((x) => x.object === "/nuova").map((x) => x.severity), ["issue"]);
  });
});

describe("identita' dell'app, per due vie", () => {
  it("build id che combacia: si misura", () => {
    const e = esitoIdentita({ buildIdCombacia: true, buildId: "B1", url: BASE });
    assert.deepEqual([e.stato, e.misurabile], ["pass", true]);
  });

  it("build id diverso ma asset identico: e' questo sito, un processo indietro", () => {
    // Misurato sul pilota il 2026-08-06 mentre un'altra chat ricostruiva.
    const e = esitoIdentita({ buildIdCombacia: false, assetProvato: "/_next/static/a.css", assetIdentico: true, buildId: "B2", url: BASE });
    assert.equal(e.stato, "fail");
    assert.equal(e.misurabile, true, "il sito e' questo: le misure si fanno, il certificato no");
    assert.match(e.diagnosi, /non un'altra applicazione/);
  });

  it("build id diverso e asset diverso: e' un'altra applicazione, e non si misura", () => {
    const e = esitoIdentita({ buildIdCombacia: false, assetProvato: "/_next/static/a.css", assetIdentico: false, buildId: "B2", url: BASE });
    assert.deepEqual([e.stato, e.misurabile], ["fail", false]);
    assert.match(e.diagnosi, /un'altra applicazione/);
  });

  it("trova un asset da confrontare fra src e href", () => {
    assert.equal(assetDaProvare('<link href="/_next/static/chunks/a.css?v=1">', BASE), "/_next/static/chunks/a.css");
  });
});

// ------------------------------------------------------------- informativa
describe("informativa privacy", () => {
  const pagina = (extra = "") => `<a href="/menu">Menu</a>${extra}`;

  it("i candidati si trovano dal TESTO del collegamento, non da un percorso indovinato", () => {
    const c = candidatiInformativa(pagina('<a href="/note-legali/clienti">Informativa privacy</a>'), BASE);
    assert.deepEqual(c.map((x) => x.percorso), ["/note-legali/clienti"]);
  });

  it("li trova anche dal percorso, quando il testo non aiuta", () => {
    const c = candidatiInformativa(pagina('<a href="/privacy">Leggi</a>'), BASE);
    assert.deepEqual(c.map((x) => x.percorso), ["/privacy"]);
  });

  // Collaudo P2: la prova di invisibilita' guardava un livello solo — gli
  // attributi dell'`<a>`. Nel piè di pagina il collegamento lo si nasconde sul
  // CONTENITORE, e quella forma passava: «collegata da 10 pagine su 10» su un
  // sito dove l'informativa non la raggiungeva nessuno.
  it("un collegamento nascosto DAL CONTENITORE non e' un collegamento", () => {
    for (const involucro of [
      '<li style="display:none"><a href="/privacy">Informativa privacy</a></li>',
      '<div hidden><a href="/privacy">Informativa privacy</a></div>',
      '<ul aria-hidden="true"><li><a href="/privacy">Informativa privacy</a></li></ul>',
      '<div style="visibility: hidden"><span><a href="/privacy">Informativa privacy</a></span></div>',
    ]) {
      assert.deepEqual(candidatiInformativa(pagina(involucro), BASE), [], involucro);
    }
  });

  it("un contenitore nascosto NON zittisce quello che viene dopo di lui", () => {
    const html = pagina('<div hidden><a href="/vecchia">Informativa privacy</a></div><footer><a href="/privacy">Informativa privacy</a></footer>');
    assert.deepEqual(candidatiInformativa(html, BASE).map((x) => x.percorso), ["/privacy"]);
  });

  it("nessun collegamento su nessuna pagina e' un bloccante", () => {
    const f = findingsInformativa({ pagine: [{ percorso: "/", candidati: [] }], informativa: null, htmlInformativa: null, dichiarata: null });
    assert.equal(blocchi(f).length, 1);
  });

  it("un collegamento che porta a un 404 e' un bloccante", () => {
    const f = findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }],
      informativa: { percorso: "/privacy", stato: 404 },
      htmlInformativa: null, dichiarata: null,
    });
    assert.match(blocchi(f).at(-1).message, /il collegamento c'e' e l'informativa no/);
  });

  it("raggiungibile solo da alcune pagine NON e' raggiungibile", () => {
    const f = findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }, { percorso: "/menu", candidati: [] }],
      informativa: { percorso: "/privacy", stato: 200 },
      htmlInformativa: `<p>${"x".repeat(500)}</p>`, dichiarata: null,
    });
    assert.ok(blocchi(f).some((x) => /manca su \/menu/.test(x.message)));
  });

  it("falso verde (STOP §2): un'informativa con un segnaposto dentro non passa", () => {
    const testo = VOCI_INFORMATIVA.map((v) => v.nome).join(". base giuridica art. 6. ") + " reclamo al Garante. destinatari. " + "y".repeat(400);
    const f = findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }],
      informativa: { percorso: "/privacy", stato: 200 },
      htmlInformativa: `<p>Titolare del trattamento: {{RAGIONE SOCIALE}}. ${testo}</p>`, dichiarata: null,
    });
    assert.ok(blocchi(f).some((x) => /segnaposto o un riempitivo/.test(x.message)));
  });

  it("un'informativa che non nomina le voci dell'art. 13 non passa, e dice quali mancano", () => {
    const f = findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }],
      informativa: { percorso: "/privacy", stato: 200 },
      htmlInformativa: `<p>${"parole ordinarie ".repeat(40)}</p>`, dichiarata: null,
    });
    assert.ok(blocchi(f).some((x) => /voci obbligatorie dell'art\. 13/.test(x.message)));
  });

  it("un titolo non e' un'informativa", () => {
    const f = findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }],
      informativa: { percorso: "/privacy", stato: 200 },
      htmlInformativa: "<h1>Privacy</h1>", dichiarata: null,
    });
    assert.ok(blocchi(f).some((x) => /e' un titolo/.test(x.message)));
  });
});

// ------------------------------------------------------------ dati raccolti
describe("moduli e dati personali", () => {
  it("i campi di servizio delle Server Action non sono campi raccolti", () => {
    // Su App Router ogni form ne porta quattro: contarli avrebbe prodotto
    // quattro rilievi per modulo su ogni sito di questa casa.
    const html = '<form><input type="hidden" name="$ACTION_REF_1"><input name="nome" autocomplete="name"></form>';
    assert.deepEqual(campiDiPagina(html).map((c) => c.nome), ["nome"]);
    assert.equal(moduliDiPagina(html), 1);
  });

  it("conta textarea e select insieme agli input", () => {
    assert.equal(campiDiPagina("<textarea name='note'></textarea><select name='x'></select>").length, 2);
  });

  it("la prova FORTE e' `autocomplete`, e vale un bloccante (§17)", () => {
    assert.deepEqual(classificaCampo({ tipo: "text", nome: "campo1", autocomplete: "tel" }), { personale: true, prova: "forte", motivo: 'autocomplete="tel"' });
  });

  it("la prova forte e' anche `type`", () => {
    assert.equal(classificaCampo({ tipo: "email", nome: "x", autocomplete: "" }).prova, "forte");
  });

  it("il nome del campo e' prova DEBOLE: `nome` puo' essere il nome di una pizza", () => {
    assert.equal(classificaCampo({ tipo: "text", nome: "nome", autocomplete: "" }).prova, "debole");
  });

  it("un campo qualsiasi non e' un dato personale", () => {
    assert.equal(classificaCampo({ tipo: "text", nome: "codice_ritiro", autocomplete: "" }).personale, false);
  });

  // Collaudo P2: il confronto era col nome INTERO e con quindici parole
  // italiane. Un modulo che chiedeva residenza, data di nascita e il
  // caricamento di un documento d'identita' — nessuno con `autocomplete` —
  // produceva UN solo rilievo su quattro campi.
  it("il nome si spezza in parole: `user_email` e `datiCliente.telefono` sono le forme vere", () => {
    for (const nome of ["user_email", "contact-phone", "datiCliente.telefono", "billing[address]", "customerFullName", "campo_codice_fiscale"]) {
      assert.equal(classificaCampo({ tipo: "text", nome, autocomplete: "" }).personale, true, nome);
    }
  });

  it("il vocabolario non e' solo italiano: un sito bilingue ha anche il modulo inglese", () => {
    for (const nome of ["name", "surname", "phone", "address", "city", "zip", "birthday", "passport"]) {
      assert.equal(classificaCampo({ tipo: "text", nome, autocomplete: "" }).prova, "debole", nome);
    }
  });

  it("un caricamento su un modulo pubblico e' prova debole: la gente ci mette la carta d'identita'", () => {
    const c = classificaCampo({ tipo: "file", nome: "allegato", autocomplete: "" });
    assert.equal(c.personale, true);
    assert.equal(c.prova, "debole", "cosa ci sia dentro il file non sta nel documento (§17)");
  });

  it("le parole vicine non bastano: `invia`, `previa`, `nominale` non contengono `via` ne' `nome`", () => {
    for (const nome of ["invia", "previa", "nominale", "codice_ritiro", "quantita", "messaggio", "q"]) {
      assert.equal(classificaCampo({ tipo: "text", nome, autocomplete: "" }).personale, false, nome);
    }
  });

  it("prova forte non dichiarata = bloccante, prova debole = rilievo", () => {
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/c", moduli: 1, campi: [
        { tipo: "text", nome: "a", autocomplete: "tel", id: "" },
        { tipo: "text", nome: "cognome", autocomplete: "", id: "" },
      ] }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/c"]),
    });
    assert.equal(f.filter((x) => x.severity === "block").length, 1);
    assert.equal(f.filter((x) => x.severity === "issue").length, 1);
  });

  it("la base giuridica si legge dalla colonna «base giuridica» della tabella", () => {
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/c", moduli: 1, campi: [{ tipo: "text", nome: "tel", autocomplete: "tel", id: "" }] }],
      basiDichiarate: [{ modulo: "/c", campo: "tel", "base giuridica": "contratto (art. 6.1.b)" }],
      informativaRaggiungibile: new Set(["/c"]),
    });
    assert.deepEqual(f, []);
  });

  it("una base giuridica vuota non e' una base giuridica", () => {
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/c", moduli: 1, campi: [{ tipo: "text", nome: "tel", autocomplete: "tel", id: "" }] }],
      basiDichiarate: [{ modulo: "/c", campo: "tel", "base giuridica": "" }],
      informativaRaggiungibile: new Set(["/c"]),
    });
    assert.equal(blocchi(f).length, 1);
  });

  it("raccogliere senza rimandare all'informativa e' un bloccante a se'", () => {
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/c", moduli: 1, campi: [{ tipo: "text", nome: "tel", autocomplete: "tel", id: "" }] }],
      basiDichiarate: [{ modulo: "/c", campo: "tel", "base giuridica": "contratto" }],
      informativaRaggiungibile: new Set(),
    });
    assert.ok(blocchi(f).some((x) => /AL MOMENTO della raccolta/.test(x.message)));
  });
});

// ------------------------------------------------------- archiviazione client
describe("archiviazione e terzi", () => {
  it("riconosce le quattro API di archiviazione nel testo di un bundle", () => {
    assert.deepEqual(apiArchiviazioneIn("x.localStorage.setItem(); document.cookie='a'"), ["localStorage", "document.cookie"]);
  });

  it("falso verde (sabotaggio H): i terzi si cercano coi tag di script INTATTI", () => {
    // La prima versione ripuliva l'HTML cancellando i tag `<script>`, e questa
    // funzione girava su un documento da cui i terzi li avevamo tolti noi.
    const html = '<script src="https://cdn.terzo.test/a.js"></script><p>x</p>';
    assert.deepEqual(terziDi(html, BASE), [{ origine: "https://cdn.terzo.test", elementi: ["script"] }]);
  });

  it("gli asset della stessa origine non sono terzi", () => {
    assert.deepEqual(terziDi('<script src="/_next/a.js"></script><img src="/x.png">', BASE), []);
  });

  it("vede i terzi anche in iframe, link e img", () => {
    const t = terziDi('<iframe src="https://mappe.test/m"></iframe><link href="https://font.test/f.css">', BASE);
    assert.deepEqual(t.map((x) => x.origine).sort(), ["https://font.test", "https://mappe.test"]);
  });

  it("un cookie non dichiarato e' un bloccante", () => {
    const f = findingsArchiviazione({ cookie: [{ nome: "sid", percorso: "/" }], archiviazioni: [], terzi: [], dichiarate: [], banner: false });
    assert.equal(blocchi(f).length, 1);
  });

  it("un'archiviazione dichiarata ed essenziale non produce niente", () => {
    const f = findingsArchiviazione({
      cookie: [], archiviazioni: [{ api: "localStorage", percorso: "/c" }], terzi: [],
      dichiarate: [{ chiave: "localStorage", essenziale: "sì" }], banner: false,
    });
    assert.deepEqual(f, []);
  });

  // Collaudo P2: il passo guardava i CAMPI e mai l'`action`. Un modulo con
  // nome, email e telefono che posta a un endpoint di terzi usciva verde su
  // tutti e nove i passi — e nemmeno il censimento dei terzi lo vedeva.
  it("un modulo che consegna dati personali a un'altra origine e' un BLOCCANTE", () => {
    const html = `<form action="https://moduli.esempio.com/raccogli">
      <input name="nome" autocomplete="name"><input name="email" type="email"></form>`;
    const destinazioni = destinazioniModuli(html, BASE);
    assert.equal(destinazioni.length, 1);
    assert.equal(destinazioni[0].altraOrigine, true);
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/contatti", campi: [], destinazioni }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/contatti"]),
    });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /ALTRA ORIGINE/);
    assert.match(blocchi(f)[0].message, /destinatario ai sensi dell'art\. 13/);
  });

  it("un modulo che consegna dati personali IN CHIARO e' un BLOCCANTE", () => {
    const destinazioni = destinazioniModuli('<form action="http://moduli.esempio.com/x"><input name="t" autocomplete="tel"></form>', BASE);
    assert.equal(destinazioni[0].inChiaro, true);
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/", campi: [], destinazioni }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/"]),
    });
    assert.ok(blocchi(f).some((x) => /IN CHIARO/.test(x.message)));
  });

  // Collaudo P2: la camminata segue gli `<a href>`, non i bottoni. Il limite e'
  // dichiarato, ma il gate lo applicava in silenzio — restringeva l'insieme che
  // poi dichiarava conforme, invece di dire cosa aveva lasciato fuori.
  it("una pagina che riceve il modulo e che la camminata non ha raggiunto si dice", () => {
    const destinazioni = destinazioniModuli('<form action="/richiamo" method="post"><input name="telefono" autocomplete="tel"></form>', BASE);
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/", campi: [], destinazioni }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/"]), superficie: new Set(["/", "/contatti"]),
    });
    assert.deepEqual(blocchi(f), []);
    assert.match(f[0].message, /la camminata NON ha raggiunto/);
    // E se la pagina di destinazione E' nella superficie, non si dice niente.
    const dentro = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/", campi: [], destinazioni }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/"]), superficie: new Set(["/", "/richiamo"]),
    });
    assert.deepEqual(dentro, []);
  });

  it("un modulo della stessa origine, o senza campi personali, non produce niente", () => {
    const sueDestinazioni = destinazioniModuli('<form action="/contatti"><input name="nome" autocomplete="name"></form>', BASE);
    assert.equal(sueDestinazioni[0].altraOrigine, false);
    assert.equal(sueDestinazioni[0].inChiaro, false, "un banco su 127.0.0.1 non e' «in chiaro»: e' locale");
    const senzaPersonali = destinazioniModuli('<form action="https://cerca.esempio.com"><input name="q"></form>', BASE);
    const f = findingsDatiRaccolti({
      pagineConModuli: [{ percorso: "/", campi: [], destinazioni: [...sueDestinazioni, ...senzaPersonali] }],
      basiDichiarate: [], informativaRaggiungibile: new Set(["/"]),
    });
    assert.deepEqual(f, []);
  });

  // Collaudo P2: i cookie si raccoglievano dalle sole risposte delle PAGINE.
  // Spostare il Set-Cookie sul bundle — che il browser scarica da solo, e che
  // questo gate scarica gia' — lo faceva sparire: «0 cookie» su un sito che ne
  // poneva uno a ogni pagina.
  it("un cookie posto da una SOTTORISORSA e' un cookie posto", () => {
    const f = findingsArchiviazione({
      cookie: [{ nome: "traccia_bundle", percorso: "/ → /_next/static/chunks/main.js" }],
      archiviazioni: [], terzi: [], dichiarate: [], banner: false,
    });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].object, /main\.js/);
  });

  it("un terzo non dichiarato e' un BLOCCANTE, e il messaggio dice perche'", () => {
    const f = findingsArchiviazione({ cookie: [], archiviazioni: [], terzi: [{ origine: "https://cdn.test", elementi: ["script"] }], dichiarate: [], banner: false });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /NON lo puo' misurare/);
  });

  // Collaudo P2. Il modello del certificato prescrive UNA RIGA PER CHIAVE
  // ARCHIVIATA, con l'API nella colonna `tipo`; il banco e questa batteria
  // mettevano l'API in `chiave`. Un certificato scritto esattamente dal modello
  // riceveva un `block` per ogni archiviazione su ogni pagina: rosso su un
  // documento corretto, e nessun test lo vedeva perche' erano tutti scritti
  // sulla forma dell'implementazione.
  it("riconosce l'archiviazione dichiarata nella forma DEL MODELLO (API in `tipo`)", () => {
    const f = findingsArchiviazione({
      cookie: [], archiviazioni: [{ api: "localStorage", percorso: "/c" }], terzi: [],
      dichiarate: [{ chiave: "studio:lingua", tipo: "localStorage", essenziale: "sì" }], banner: false,
    });
    assert.deepEqual(f, []);
  });

  it("la stessa API dichiarata due volte: basta una riga non essenziale a volere il banner", () => {
    const comune = {
      cookie: [], archiviazioni: [{ api: "localStorage", percorso: "/" }], terzi: [],
      dichiarate: [
        { chiave: "studio:lingua", tipo: "localStorage", essenziale: "sì" },
        { chiave: "studio:analitica", tipo: "localStorage", essenziale: "no" },
      ],
    };
    assert.ok(blocchi(findingsArchiviazione({ ...comune, banner: false })).some((x) => x.object === "consenso"));
    assert.deepEqual(findingsArchiviazione({ ...comune, banner: true }), []);
  });

  it("una riga che non nomina l'API ne' in `chiave` ne' in `tipo` resta un bloccante", () => {
    const f = findingsArchiviazione({
      cookie: [], archiviazioni: [{ api: "indexedDB", percorso: "/" }], terzi: [],
      dichiarate: [{ chiave: "studio:lingua", tipo: "localStorage", essenziale: "sì" }], banner: false,
    });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /nessuna riga del certificato lo nomina/);
  });

  it("non essenziale senza banner e' un bloccante", () => {
    const f = findingsArchiviazione({
      cookie: [{ nome: "_ga", percorso: "/" }], archiviazioni: [], terzi: [],
      dichiarate: [{ chiave: "_ga", essenziale: "no" }], banner: false,
    });
    assert.ok(blocchi(f).some((x) => x.object === "consenso"));
  });

  it("un banner senza niente da proteggere e' un rilievo, non un verde muto", () => {
    const f = findingsArchiviazione({ cookie: [], archiviazioni: [], terzi: [], dichiarate: [], banner: true });
    assert.equal(f[0].severity, "issue");
    assert.match(f[0].message, /insegna a cliccare/);
  });
});

// ------------------------------------------------------------ accessibilita'
describe("accessibilita' dell'HTML servito", () => {
  const pagina = (dentro, attrHtml = ' lang="it"') =>
    `<html${attrHtml}><head><title>Titolo</title></head><body><main>${dentro}</main></body></html>`;

  it("una pagina ben formata non produce rilievi", () => {
    assert.deepEqual(findingsAccessibilitaPagina("/", pagina("<h1>A</h1><h2>B</h2>")), []);
  });

  it("manca `lang`: bloccante", () => {
    assert.ok(blocchi(findingsAccessibilitaPagina("/", pagina("<h1>A</h1>", ""))).some((x) => /lang/.test(x.message)));
  });

  it("manca `<title>`: bloccante", () => {
    assert.ok(blocchi(findingsAccessibilitaPagina("/", '<html lang="it"><head></head><body><main><h1>A</h1></main></body></html>')).length > 0);
  });

  it("nessun h1: bloccante", () => {
    assert.ok(blocchi(findingsAccessibilitaPagina("/", pagina("<h2>B</h2>"))).some((x) => /nessun <h1>/.test(x.message)));
  });

  it("sabotaggio M: gerarchia saltata h1 → h3 e' un BLOCCANTE, non un rilievo", () => {
    // Con `issue` il passo restava verde su una gerarchia rotta, cioe' era
    // verde proprio sul difetto che dichiara di provare.
    const f = findingsAccessibilitaPagina("/", pagina("<h1>A</h1><h3>C</h3>"));
    assert.ok(blocchi(f).some((x) => /gerarchia dei titoli saltata/.test(x.message)));
  });

  it("immagine senza alt: bloccante — con alt vuoto: rilievo, perche' decorativa lo dice una persona", () => {
    const senza = findingsAccessibilitaPagina("/", pagina('<h1>A</h1><img src="/a.png">'));
    const vuoto = findingsAccessibilitaPagina("/", pagina('<h1>A</h1><img src="/a.png" alt="">'));
    assert.equal(blocchi(senza).length, 1);
    assert.equal(blocchi(vuoto).length, 0);
    assert.equal(vuoto.filter((x) => x.severity === "issue").length, 1);
  });

  it("collegamento e bottone senza nome accessibile: bloccanti", () => {
    const f = findingsAccessibilitaPagina("/", pagina('<h1>A</h1><a href="/x"><span></span></a><button></button>'));
    assert.equal(blocchi(f).length, 2);
  });

  it("`aria-label` e l'`alt` di un'immagine dentro contano come nome accessibile", () => {
    assert.equal(nomeAccessibile('<a aria-label="Vai">', "<span></span>"), "Vai");
    assert.equal(nomeAccessibile("<a>", '<img alt="Casa">'), "Casa");
  });

  it("campo senza etichetta e senza aria-label: bloccante", () => {
    const f = findingsAccessibilitaPagina("/", pagina('<h1>A</h1><form><input name="x"></form>'));
    assert.ok(blocchi(f).some((x) => /senza etichetta/.test(x.message)));
  });

  it("un `<label for>` che combacia basta", () => {
    const f = findingsAccessibilitaPagina("/", pagina('<h1>A</h1><form><label for="x">X</label><input id="x" name="x"></form>'));
    assert.deepEqual(f, []);
    assert.equal(etichettePerId('<label for="x">X</label>').get("x"), "X");
  });

  it("manca <main>: rilievo, non bloccante", () => {
    const f = findingsAccessibilitaPagina("/", '<html lang="it"><head><title>T</title></head><body><h1>A</h1></body></html>');
    assert.deepEqual(f.map((x) => x.severity), ["issue"]);
  });
});

// ------------------------------------------------------------------ lingua
describe("lingua e hreflang", () => {
  const p = (percorso, lang, hreflang = []) => ({ percorso, lang, hreflang });

  it("legge lang e hreflang dall'HTML", () => {
    assert.equal(langDi('<html lang="it-IT">'), "it-IT");
    // `interno` distingue un rimando che questa camminata puo' giudicare da uno
    // che punta fuori dall'origine misurata: senza, il giro sulla reciprocita'
    // taceva su entrambi allo stesso modo (collaudo P2).
    assert.deepEqual(hreflangDi('<link rel="alternate" hreflang="en" href="/en">', BASE), [{ hreflang: "en", percorso: "/en", interno: true }]);
    assert.deepEqual(hreflangDi('<link rel="alternate" hreflang="en" href="https://altro.example/en">', BASE), [
      { hreflang: "en", percorso: "https://altro.example/en", interno: false },
    ]);
  });

  it("riconosce le rotte per lingua e non si fa ingannare da /privacy", () => {
    assert.deepEqual(lingueDaRotte(["/", "/en/menu", "/privacy", "/contatti"]), ["en"]);
  });

  it("monolingua: NON APPLICABILE, con la premessa stampata", () => {
    const e = esitoLingua({ pagine: [p("/", "it"), p("/menu", "it")], lingueDichiarate: ["it"], percorsi: ["/", "/menu"] });
    assert.equal(e.stato, "n/a");
    assert.match(e.premessa, /lingue misurate .* it/);
    assert.match(e.premessa, /rotte per lingua trovate nella superficie: nessuna/);
  });

  it("falso verde (STOP §7): la premessa di n/a NON puo' essere «zero hreflang»", () => {
    // Un sito multilingua a cui MANCANO gli hreflang — cioe' la non conformita'
    // da trovare — uscirebbe «non applicabile». La premessa e' un'altra misura:
    // l'insieme dei `lang` sulle pagine servite, che non dipende dagli hreflang.
    const e = esitoLingua({ pagine: [p("/", "it"), p("/en", "en")], lingueDichiarate: ["it", "en"], percorsi: ["/", "/en"] });
    assert.equal(e.stato, "fail");
    assert.equal(blocchi(e.findings).length, 2, "una per pagina: sito multilingua senza hreflang");
  });

  it("hreflang non reciproco: bloccante", () => {
    const e = esitoLingua({
      pagine: [
        p("/", "it", [{ hreflang: "it", percorso: "/" }, { hreflang: "en", percorso: "/en" }, { hreflang: "x-default", percorso: "/" }]),
        // `/en` rimanda solo a se' stessa e alla home come x-default: NON e'
        // un rimando reciproco verso `/`.
        p("/en", "en", [{ hreflang: "en", percorso: "/en" }, { hreflang: "x-default", percorso: "/" }]),
      ],
      lingueDichiarate: ["it", "en"], percorsi: ["/", "/en"],
    });
    assert.ok(blocchi(e.findings).some((x) => /non rimanda indietro/.test(x.message)));
  });

  // Collaudo P2, sul primo banco multilingua VERO che questa skill abbia mai
  // misurato: nel giro sulla reciprocita' c'era un `continue` muto per i
  // rimandi che la camminata non riconosceva. Un `x-default` verso il vuoto —
  // cioe' una dichiarazione falsa — usciva VERDE.
  it("un hreflang interno verso una pagina fuori dalla superficie e' un bloccante", () => {
    const hreflang = hreflangDi(
      `<link rel="alternate" hreflang="it" href="${BASE}/">
       <link rel="alternate" hreflang="en" href="${BASE}/en">
       <link rel="alternate" hreflang="x-default" href="${BASE}/non-esiste">`,
      BASE,
    );
    assert.deepEqual(hreflang.map((h) => h.interno), [true, true, true]);
    const e = esitoLingua({
      pagine: [p("/", "it", hreflang), p("/en", "en", hreflang)],
      lingueDichiarate: ["it", "en"], percorsi: ["/", "/en"],
    });
    assert.ok(blocchi(e.findings).some((x) => /non e' nella superficie camminata/.test(x.message)));
  });

  it("un hreflang verso un'ALTRA origine non si giudica da qui, e lo si dice", () => {
    const hreflang = hreflangDi(
      '<link rel="alternate" hreflang="it" href="https://studio.example/"><link rel="alternate" hreflang="en" href="https://studio.example/en">',
      BASE,
    );
    assert.deepEqual(hreflang.map((h) => h.interno), [false, false]);
    const e = esitoLingua({ pagine: [p("/", "it", hreflang), p("/en", "en", hreflang)], lingueDichiarate: ["it", "en"], percorsi: ["/", "/en"] });
    assert.deepEqual(blocchi(e.findings), [], "fuori origine: non si accusa");
    assert.ok(e.findings.some((x) => /reciprocita' NON e' stata verificata/.test(x.message)));
  });

  it("una pagina che dichiara una lingua fuori dal certificato e' un bloccante", () => {
    const e = esitoLingua({ pagine: [p("/", "it"), p("/x", "de")], lingueDichiarate: ["it"], percorsi: ["/", "/x"] });
    assert.ok(blocchi(e.findings).some((x) => x.object === "/x"));
  });

  it("hreflang su un sito monolingua: rilievo, e resta non applicabile", () => {
    const e = esitoLingua({ pagine: [p("/", "it", [{ hreflang: "it", percorso: "/" }])], lingueDichiarate: ["it"], percorsi: ["/"] });
    assert.equal(e.stato, "n/a");
    assert.equal(e.findings[0].severity, "issue");
  });
});

// ------------------------------------------------- i reperti del tribunale
describe("i reperti del tribunale, uno per uno", () => {
  it("SD-VERDE-01: `<!--` dentro un valore di attributo NON apre un commento", () => {
    // Era la chiave universale: due `<div>` invisibili facevano sparire dal
    // documento che il gate giudica tutto quello che stava in mezzo.
    const trappola = '<div data-nota="<!--"></div><img src="/h.jpg"><script src="https://gtm.test/j"></script><div data-nota="-->"></div>';
    assert.equal(tagDi(senzaScript(trappola), "img").length, 1);
    assert.deepEqual(terziDi(trappola, BASE), [{ origine: "https://gtm.test", elementi: ["script"] }]);
  });

  it("SD-VERDE-01: le forme brusche `<!-->` e `<!--->` chiudono subito, non divorano la pagina", () => {
    for (const brusco of ["<!-->", "<!--->"]) {
      const html = `${brusco}<main><h1>t</h1><input type="email" name="e"></main>`;
      assert.equal(campiDiPagina(html).length, 1, `divorato da ${brusco}`);
    }
  });

  it("SD-REDOS-01: il ripulitore e' lineare, non quadratico", () => {
    // La catena di `replace` costava 24,6 s su 200 KB di `<` ripetuti, ×4 a ogni
    // raddoppio: un modo per appendere il gate senza fargli dire ROSSO.
    const inizio = Date.now();
    senzaScript("<".repeat(200000));
    assert.ok(Date.now() - inizio < 2000, "200 KB di `<` devono costare millisecondi, non secondi");
  });

  // Collaudo P2: SD-REDOS-01 era chiuso per i `<` ripetuti e RIAPERTO da una
  // forma che il tribunale non aveva provato — un `<` che apre un tag che
  // nessun `>` chiude. Ogni `<` rileggeva la coda: 24 KB 153 ms · 49 KB 532 ms
  // · 98 KB 1,8 s · 195 KB 7,3 s, il raddoppio che quadruplica.
  it("SD-REDOS-01 (P2): un tag che nessun `>` chiude non fa rileggere la coda", () => {
    for (const [etichetta, testo] of [
      ["virgoletta aperta, nessun >", '<div a="'.repeat(50 * 1024)],
      ["virgoletta aperta, con >", '<div a=">'.repeat(25 * 1024)],
      ["commento mai chiuso", "<!--x".repeat(40 * 1024)],
    ]) {
      const inizio = Date.now();
      ripulisciDocumento(testo);
      assert.ok(Date.now() - inizio < 2000, `${etichetta}: millisecondi, non secondi`);
    }
  });

  it("`regioniNascoste` e' lineare: una scansione sola, non una per contenitore", () => {
    // Scritta quadratica in questo stesso collaudo e misurata subito:
    // 20 000 `<div hidden>` costavano 13 secondi.
    const inizio = Date.now();
    regioniNascoste("<div hidden>".repeat(20 * 1024));
    assert.ok(Date.now() - inizio < 2000, "20k contenitori nascosti: millisecondi, non secondi");
  });

  // LA CHIAVE UNIVERSALE NUOVA (collaudo P2), piu' economica di quella del
  // tribunale: un tag invece di due `<div>`. `</script>` veniva riconosciuto
  // col nome `script` e trattato come un'APERTURA, e il ripulitore si mangiava
  // tutto fino alla fine del documento. Sul banco: `dati-raccolti` chiudeva
  // NON APPLICABILE — «zero moduli e zero campi» — su un sito che raccoglie
  // nome, email, telefono e PEC.
  it("falso n/a: una CHIUSURA ORFANA non apre niente e non amputa il documento", () => {
    for (const testa of ["</script>", "</style>", "<script>/* </script> */</script>", '<script>var s="</script>";</script>']) {
      const doc = `<html lang="it"><head><title>t</title></head><body><main><h1>x</h1>${testa}<input name="telefono" autocomplete="tel"><img src="/a.png"></main></body></html>`;
      assert.equal(campiDiPagina(doc).length, 1, `campi dopo ${testa}`);
      assert.match(ripulisciDocumento(doc).pulito, /<img/, `img dopo ${testa}`);
      assert.equal(terziDi(`${doc}<script src="https://terzo.example/a.js"></script>`, BASE).length, 1, `terzi dopo ${testa}`);
    }
  });

  // Collaudo P2: rosso su markup corretto. Il contenuto di una `<textarea>` e'
  // TESTO, non markup — un'area che mostra un esempio, o un campo di CMS in cui
  // qualcuno ha incollato una pagina, faceva contare al gate elementi che il
  // browser non rende.
  it("il contenuto di una <textarea> e' testo: non produce elementi ne' campi in piu'", () => {
    const doc = '<html lang="it"><head><title>t</title></head><body><main><h1>x</h1>'
      + '<label for="e">Esempio</label><textarea id="e"><img src="/x.png"><input name="telefono" autocomplete="tel"></textarea>'
      + "</main></body></html>";
    assert.equal(campiDiPagina(doc).length, 1, "la textarea, e nient'altro");
    assert.deepEqual(findingsAccessibilitaPagina("/x", doc), [], "nessuna immagine senza alt: quell'immagine non esiste");
  });

  it("`ripulisciDocumento` restituisce i corpi inline e gli stili, senza rileggere il documento", () => {
    const r = ripulisciDocumento('<script>localStorage.x=1</script><style>@import url("https://f.test/a.css");</style><p>x</p>');
    assert.equal(r.inline.length, 1);
    assert.match(r.inline[0].corpo, /localStorage/);
    assert.equal(r.stili.length, 1);
  });

  it("SD-VERDE-03: un terzo entra anche da `@import` in uno stile, da un video e da un srcset", () => {
    const html = '<style>@import url("https://font.test/a.css");</style><video src="https://v.test/x.mp4"></video><img srcset="https://i.test/a.png 1x">';
    assert.deepEqual(terziDi(html, BASE).map((t) => t.origine).sort(), ["https://font.test", "https://i.test", "https://v.test"]);
  });

  it("SD-VERDE-05: un campo nascosto con `autocomplete` personale NON sparisce dal censimento", () => {
    const campi = campiDiPagina('<form><input type="hidden" name="email" autocomplete="email"><input type="hidden" name="$ACTION_KEY" value="x"></form>');
    assert.deepEqual(campi.map((c) => c.nome), ["email"], "i campi di servizio si scartano per NOME, non per tipo");
    assert.equal(classificaCampo(campi[0]).prova, "forte");
  });

  it("SD-VERDE-05: ma un campo nascosto non ha bisogno di un'etichetta", () => {
    const f = findingsAccessibilitaPagina("/x", '<html lang="it"><head><title>t</title></head><body><main><h1>a</h1><form><input type="hidden" name="tok"></form></main></body></html>');
    assert.deepEqual(f, []);
  });

  it("SD-VERDE-06: `aria-labelledby` verso un id inesistente NON e' un nome accessibile", () => {
    const doc = '<a href="/" aria-labelledby="manca"></a>';
    assert.equal(nomeAccessibile('<a href="/" aria-labelledby="manca">', "", doc), "");
    const doc2 = '<h2 id="c">Vai alla home</h2><a href="/" aria-labelledby="c"></a>';
    assert.equal(nomeAccessibile('<a href="/" aria-labelledby="c">', "", doc2), "Vai alla home");
    assert.equal(testoDellId(doc2, "c"), "Vai alla home");
  });

  it("SD-VERDE-06: una `<label for>` VUOTA non etichetta niente", () => {
    assert.equal(etichettePerId('<label for="e"></label>').has("e"), false);
  });

  it("SD-ROSSO-01: una `<label>` che AVVOLGE il campo lo etichetta", () => {
    const html = '<html lang="it"><head><title>t</title></head><body><main><h1>a</h1><form><label>Email <input type="email" name="email"></label></form></main></body></html>';
    assert.deepEqual(findingsAccessibilitaPagina("/x", html), []);
    assert.ok(campiAvvolti(html).has("@email"));
  });

  it("SD-ROSSO-01: un'icona SVG con `aria-label` E' un nome accessibile", () => {
    const html = '<html lang="it"><head><title>t</title></head><body><main><h1>a</h1><a href="/f"><svg role="img" aria-label="Facebook"></svg></a></main></body></html>';
    assert.deepEqual(findingsAccessibilitaPagina("/x", html), []);
  });

  it("SD-ROSSO-02: `/prodotti/cookie-al-cioccolato` non e' un'informativa", () => {
    // Su un sito di pasticceria quel collegamento sta in ogni pagina, esattamente
    // come «Privacy» nel piè di pagina: veniva eletto informativa e il passo
    // usciva ROSSO su una pagina di prodotto.
    assert.deepEqual(candidatiInformativa('<a href="/prodotti/cookie-al-cioccolato">Biscotti</a>', BASE), []);
    assert.equal(candidatiInformativa('<a href="/cookie-policy">Leggi</a>', BASE).length, 1);
  });

  it("SD-VERDE-04: un collegamento NASCOSTO non e' un candidato", () => {
    assert.deepEqual(candidatiInformativa('<a href="/esca" hidden>privacy</a>', BASE), []);
    assert.deepEqual(candidatiInformativa('<a href="/esca" style="display:none">privacy</a>', BASE), []);
  });

  it("SD-VERDE-04: il testo del collegamento pesa piu' del percorso", () => {
    const c = candidatiInformativa('<a href="/privacy">Informativa privacy</a><a href="/legal">x</a>', BASE);
    assert.equal(c.find((x) => x.percorso === "/privacy").peso, 2);
    assert.equal(c.find((x) => x.percorso === "/legal").peso, 1);
  });

  it("SD-NET-01: i caratteri di controllo del testo scaricato non arrivano al terminale", () => {
    // L'uscita del gate si incolla nei verbali: una sequenza ANSI dentro un
    // attributo poteva riscrivere «GATE CONFORMITA': VERDE» sopra l'output vero.
    const ostile = `/a${String.fromCharCode(27)}[2J${String.fromCharCode(7)}b`;
    const stampato = perStampa(ostile);
    const controlli = [...stampato].filter((c) => {
      const punto = c.codePointAt(0);
      return punto < 32 || (punto >= 127 && punto <= 159);
    });
    assert.deepEqual(controlli, [], "un carattere di controllo non deve arrivare al terminale");
    assert.equal(perStampa("x".repeat(400), 50).length, 51, "e si tronca");
  });

  it("SD-06: una superficie dichiarata VUOTA non disattiva il confronto in silenzio", () => {
    const f = findingsSuperficie({
      daCollegamenti: ["/", "/a"], daSitemap: ["/", "/a"], dichiarate: [], sitemapLetta: true,
      superficieDichiarata: { sezionePresente: true, righe: [] },
    });
    assert.equal(blocchi(f).length, 1);
    assert.match(blocchi(f)[0].message, /c'e' ed e' vuota/);
  });
});

// ------------------------------------------------------------- i quattro stati
describe("i quattro stati", () => {
  it("`n/a` costa una premessa: senza, si torna a MANCANTE", () => {
    assert.equal(statoNonApplicabile("zero moduli su 5 pagine"), "n/a");
    assert.equal(statoNonApplicabile(""), "skipped");
    assert.equal(statoNonApplicabile(null), "skipped");
    assert.equal(statoNonApplicabile("   "), "skipped");
  });

  it("un `block` fa fallire, un `issue` no", () => {
    assert.equal(statoDaFindings([{ severity: "issue" }]), "pass");
    assert.equal(statoDaFindings([{ severity: "issue" }, { severity: "block" }]), "fail");
    assert.deepEqual(contaGravita([{ severity: "block" }, { severity: "warn" }]), { block: 1, issue: 0, warn: 1 });
  });
});

// ═══════════════════════════════════════ il tribunale del 2026-08-06 (P.6-P3)
/**
 * Un test per rilievo, nella forma d'ingresso vera: HTML che un server puo'
 * servire davvero, non una struttura costruita a mano.
 */
describe("tribunale P.6-P3 — lo scanner che non guardava dove si trovava", () => {
  describe("SD-TRIB-01: un `>` dentro un valore di attributo quotato", () => {
    it("falso verde: il terzo resta censito", () => {
      const t = terziDi('<script data-cfg="a>b" src="https://analitica.esempio.com/t.js"></script>', "http://sito.test/");
      assert.deepEqual(t.map((x) => x.origine), ["https://analitica.esempio.com"]);
    });

    it('falso verde: il campo resta un type="email", non un testo senza nome', () => {
      const c = campiDiPagina('<input data-cfg="a>b" type="email" name="email" autocomplete="email" required>')[0];
      assert.equal(c.tipo, "email");
      assert.equal(c.nome, "email");
      assert.equal(classificaCampo(c).personale, true);
    });

    it("falso verde: l'action verso un'altra origine resta leggibile", () => {
      const d = destinazioniModuli('<form data-x="a>b" action="http://raccolta.terzo.example/x"><input type="email" name="email"></form>', "http://sito.test/");
      assert.equal(d.length, 1);
      assert.equal(d[0].altraOrigine, true);
    });

    it("falso verde: il contenitore nascosto resta nascosto", () => {
      assert.equal(regioniNascoste('<li title="a>b" style="display:none"><a href="/privacy">Informativa privacy</a></li>').length, 1);
    });

    it("falso verde: la pagina non sparisce dalla camminata", () => {
      assert.deepEqual(
        collegamentiInterni('<a data-x="a>b" href="/contatti">c</a><a href="/chi-siamo">b</a>', "http://sito.test/").sort(),
        ["/chi-siamo", "/contatti"],
      );
    });

    it('falso rosso: alt="prima > dopo" e\' un alt, e un img con > nell\'attributo prima ce l\'ha', () => {
      const pagina = (img) => `<html lang="it"><head><title>t</title></head><body><main><h1>x</h1>${img}</main></body></html>`;
      assert.deepEqual(findingsAccessibilitaPagina("/", pagina('<img src="/a.png" alt="prima > dopo">')), []);
      assert.deepEqual(findingsAccessibilitaPagina("/", pagina('<img data-cfg="a>b" alt="descrizione">')), []);
    });

    it("lingua e hreflang restano leggibili", () => {
      assert.equal(langDi('<html data-cfg="a>b" lang="it">'), "it");
      assert.equal(hreflangDi('<link rel="alternate" data-x="a>b" hreflang="en" href="/en">', "http://sito.test/").length, 1);
    });
  });

  it("SD-TRIB-02: un tag di chiusura con attributi chiude lo script, e il modulo dopo si conta", () => {
    const doc = '<html lang="it"><head><title>t</title></head><body><main><h1>Contatti</h1>'
      + '<script>var a=1;</script foo="bar">'
      + '<form action="https://raccolta.esempio.com/x"><input type="email" name="email" autocomplete="email"><input type="tel" name="telefono" autocomplete="tel"></form>'
      + "</main></body></html>";
    assert.equal(campiDiPagina(doc).length, 2);
    assert.equal(moduliDiPagina(doc), 1);
    assert.equal(destinazioniModuli(doc, "http://sito.test/")[0].altraOrigine, true);
  });

  describe("SD-TRIB-03: template non e' reso mai, noscript si'", () => {
    it("falso verde: un collegamento dentro un template non e' un candidato", () => {
      assert.deepEqual(candidatiInformativa('<html lang="it"><body><main><h1>H</h1><template><a href="/privacy">Informativa privacy</a></template></main></body></html>', "http://sito.test/"), []);
    });

    it("noscript resta visibile: e' esattamente il visitatore che questo gate simula", () => {
      assert.equal(candidatiInformativa('<html lang="it"><body><main><noscript><a href="/privacy">Informativa privacy</a></noscript></main></body></html>', "http://sito.test/").length, 1);
    });
  });

  describe("SD-TRIB-04: la barra prima del > non autochiude un elemento non-void", () => {
    it("falso verde: uno script con la barra resta aperto e il collegamento e' codice", () => {
      assert.deepEqual(candidatiInformativa('<main><script src="/a.js"/><a href="/privacy">Informativa privacy</a></script></main>', "http://sito.test/"), []);
    });

    it("falso verde: un div hidden con la barra nasconde il resto della pagina", () => {
      assert.deepEqual(candidatiInformativa('<main><div hidden/><a href="/privacy">Informativa privacy</a></main>', "http://sito.test/"), []);
    });

    it("un elemento davvero vuoto autochiude ancora", () => {
      assert.equal(regioniNascoste('<img hidden/><a href="/privacy">x</a>').length, 1);
    });
  });

  describe("SD-TRIB-06: un'informativa invisibile non e' un'informativa", () => {
    const voci = "Titolare del trattamento, finalità del trattamento, base giuridica art. 6, tempi di conservazione, diritti dell'interessato, reclamo al Garante, destinatari. ";
    const nascosta = `<div style="display:none">${voci}${"testo ".repeat(120)}</div>`;
    const misura = (html) => findingsInformativa({
      pagine: [{ percorso: "/", candidati: [{ percorso: "/privacy" }] }],
      informativa: { percorso: "/privacy", stato: 200 },
      htmlInformativa: html,
      dichiarata: "/privacy",
    });

    it("falso verde: 800 caratteri e sette voci dentro un display:none", () => {
      assert.match(misura(nascosta).filter((x) => x.severity === "block").map((x) => x.message).join(" "), /testo servito di 0 caratteri/);
    });

    it("lo stesso testo visibile passa: la regola guarda il nascosto, non il testo", () => {
      assert.deepEqual(misura(nascosta.replace(' style="display:none"', "")).filter((x) => x.severity === "block"), []);
    });

    it("un nome accessibile nascosto non e' un nome accessibile", () => {
      assert.equal(nomeAccessibile('<a href="/x">', '<span style="display:none">Leggi tutto</span>'), "");
    });
  });

  describe("SD-TRIB-11: il title si cerca nella testa del documento ripulito", () => {
    const senzaTitolo = (corpo) => `<html lang="it"><head></head><body><main><h1>x</h1>${corpo}</main></body></html>`;
    const manca = (html) => findingsAccessibilitaPagina("/", html).some((f) => /nessun <title>/.test(f.message));

    it("falso verde: un title dentro un svg non e' il titolo del documento", () => {
      assert.equal(manca(senzaTitolo("<svg><title>icona</title></svg>")), true);
    });

    it("falso verde: un title dentro un commento o un attributo non conta", () => {
      assert.equal(manca('<html lang="it"><head><!-- <title>vecchio</title> --></head><body><main><h1>x</h1></main></body></html>'), true);
      assert.equal(manca(senzaTitolo('<div data-tpl="<title>ciao</title>"></div>')), true);
    });

    it("il titolo vero resta un titolo", () => {
      assert.equal(manca('<html lang="it"><head><title>Studio</title></head><body><main><h1>x</h1></main></body></html>'), false);
    });
  });

  describe("SD-TRIB-12: data-id non e' id", () => {
    it("falso verde: un aria-labelledby che punta al vuoto resta vuoto", () => {
      assert.equal(nomeAccessibile('<a href="/x" aria-labelledby="eti">', "", '<span data-id="eti">Vai</span>'), "");
    });

    it("un id vero risolve ancora, anche senza apici", () => {
      assert.equal(nomeAccessibile('<a href="/x" aria-labelledby="eti">', "", '<span id="eti">Vai</span>'), "Vai");
      assert.equal(nomeAccessibile('<a href="/x" aria-labelledby="eti">', "", "<span id=eti>Vai</span>"), "Vai");
    });
  });

  describe("SD-TRIB-15: la chiusura implicita di li", () => {
    it("falso rosso: il fratello di un li nascosto e' visibile", () => {
      const html = '<ul><li style="display:none"><a href="/x">n</a><li><a href="/privacy">Informativa privacy</a></li></ul>';
      assert.equal(candidatiInformativa(html, "http://sito.test/").length, 1);
    });

    it("un li nascosto e chiuso nasconde ancora il suo contenuto", () => {
      assert.deepEqual(candidatiInformativa('<ul><li style="display:none"><a href="/privacy">Informativa privacy</a></li></ul>', "http://sito.test/"), []);
    });
  });

  it("SD-TRIB-REDOS: gli scanner nuovi restano lineari su 200 KB", () => {
    const doc = '<p x="y">testo</p>'.repeat(11000);
    const cronometra = (f) => { const t = Date.now(); f(); return Date.now() - t; };
    assert.ok(doc.length > 190000);
    assert.ok(cronometra(() => ripulisciDocumento(doc)) < 3000);
    assert.ok(cronometra(() => regioniNascoste(doc)) < 3000);
    assert.ok(cronometra(() => testoVisibile(doc, { soloVisibile: true })) < 3000);
    // un apice mai chiuso: la forma che fa esplodere una regexp ambigua
    assert.ok(cronometra(() => regioniNascoste(`<a href="${"x".repeat(200000)}`)) < 3000);
  });
});

describe("tribunale P.6-P3 — i moduli, i campi, i terzi", () => {
  const BASE2 = "http://sito.test/";

  describe("SD-TRIB-05: un modulo esiste anche senza il tag di chiusura", () => {
    it("falso verde: senza </form> i due bloccanti non scattavano piu'", () => {
      const d = destinazioniModuli('<main><form action="https://raccolta.esempio.com/x" method="post"><input type="email" name="email" autocomplete="email"><input type="tel" name="telefono" autocomplete="tel"></main>', BASE2);
      assert.equal(d.length, 1);
      assert.equal(d[0].altraOrigine, true);
      assert.equal(d[0].campi.length, 2);
    });

    it('falso verde: un campo legato con form="id" vive fuori dal tag ed e\' del modulo', () => {
      const d = destinazioniModuli('<form id="f" action="http://raccolta.terzo.example/x"></form><input form="f" type="email" name="email" autocomplete="email">', BASE2);
      assert.equal(d.length, 1);
      assert.equal(d[0].campi.length, 1);
      assert.equal(classificaCampo(d[0].campi[0]).personale, true);
    });

    it("due moduli restano due, e il secondo non si porta via i campi del primo", () => {
      const d = destinazioniModuli('<form action="/a"><input name="uno" type="email"></form><form action="/b"><input name="due" type="tel"></form>', BASE2);
      assert.deepEqual(d.map((x) => x.campi.length), [1, 1]);
    });
  });

  describe("SD-TRIB-07: i riferimenti di carattere in un valore di attributo si sciolgono", () => {
    it("falso verde: type e autocomplete scritti con le entita'", () => {
      const c = campiDiPagina('<input type="e&#109;ail" name="a"><input autocomplete="&#101;mail" name="b">');
      assert.equal(c[0].tipo, "email");
      assert.equal(classificaCampo(c[0]).prova, "forte");
      assert.equal(classificaCampo(c[1]).prova, "forte");
    });

    it("un valore senza entita' resta identico", () => {
      assert.equal(attributi('<a href="/a?x=1&y=2">').href, "/a?x=1&y=2");
    });
  });

  describe("SD-TRIB-08: autocomplete e' una LISTA di token, non una stringa", () => {
    const personale = (a) => classificaCampo(campiDiPagina(`<input type="text" name="campo1" autocomplete="${a}">`)[0]).personale;

    it("falso verde: i token della grammatica dell'autofill spegnevano la prova forte", () => {
      assert.equal(personale("shipping email"), true);
      assert.equal(personale("section-blu billing street-address"), true);
      assert.equal(personale("email "), true);
      assert.equal(personale(" email"), true);
    });

    it("off e un valore inventato restano fuori", () => {
      assert.equal(personale("off"), false);
      assert.equal(personale("colore-preferito"), false);
    });
  });

  describe("SD-TRIB-09: un terzo entra anche dall'attributo style e da poster", () => {
    it("falso verde: background-image in linea non era censito", () => {
      assert.deepEqual(terziDi('<main><div style="background-image:url(https://cdn.terzo.example/s.jpg)">x</div></main>', BASE2).map((t) => t.origine), ["https://cdn.terzo.example"]);
    });

    it("falso verde: il poster di un video", () => {
      assert.deepEqual(terziDi('<video poster="https://cdn.terzo.example/p.jpg"></video>', BASE2).map((t) => t.origine), ["https://cdn.terzo.example"]);
    });

    it("un url() della stessa origine non e' un terzo", () => {
      assert.deepEqual(terziDi('<div style="background-image:url(/sfondo.jpg)">x</div>', BASE2), []);
    });
  });

  describe("SD-TRIB-10: i nomi di servizio sono nomi INTERI", () => {
    it("falso verde: __email spariva prima della classificazione", () => {
      assert.equal(campiDiPagina('<input type="text" name="__email" autocomplete="email">').length, 1);
      assert.equal(campiDiPagina('<input type="text" name="csrf_telefono" autocomplete="tel">').length, 1);
    });

    it("i campi di servizio veri restano fuori", () => {
      assert.deepEqual(campiDiPagina('<input type="hidden" name="csrf" value="x"><input type="hidden" name="$ACTION_REF_1" value="y">'), []);
    });
  });

  describe("SD-TRIB-13: il <base href> decide cosa significa un collegamento relativo", () => {
    it("falso rosso e superficie sbagliata: senza <base> si scaricava la pagina che non esiste", () => {
      assert.deepEqual(collegamentiInterni('<head><base href="/it/"></head><body><a href="contatti">c</a></body>', BASE2), ["/it/contatti"]);
    });

    it("un <base> verso un'altra origine non rende interno niente", () => {
      assert.deepEqual(collegamentiInterni('<head><base href="https://cdn.altro.example/"></head><body><a href="contatti">c</a><a href="privacy">p</a></body>', BASE2), []);
    });

    it("senza <base> non cambia niente", () => {
      assert.deepEqual(collegamentiInterni('<a href="/contatti">c</a>', BASE2), ["/contatti"]);
    });
  });

  describe("SD-TRIB-14: un indizio di archiviazione non e' un'assenza di archiviazione", () => {
    it("falso verde: l'accesso per indice non nomina l'API", () => {
      assert.deepEqual(apiArchiviazioneIn('var k="local"+"Storage";window[k].setItem("a",1);'), []);
      assert.equal(archiviazioneIncertaIn('var k="local"+"Storage";window[k].setItem("a",1);'), true);
    });

    it("il nome pieno resta una misura, non un indizio", () => {
      assert.equal(archiviazioneIncertaIn('localStorage.setItem("a",1)'), false);
      assert.deepEqual(apiArchiviazioneIn('localStorage.setItem("a",1)'), ["localStorage"]);
    });

    it("un bundle che non archivia non produce indizi", () => {
      assert.equal(archiviazioneIncertaIn("export function somma(a,b){return a+b}"), false);
    });
  });

  describe("SD-TRIB-16: la seconda via dell'identita' e l'impronta corta", () => {
    it("un asset con gli apici singoli si trova", () => {
      assert.equal(assetDaProvare("<script src='/_next/static/chunks/a.js'></script>", BASE2), "/_next/static/chunks/a.js");
    });

    it("un percorso _next dentro il carico RSC non e' un asset referenziato", () => {
      assert.equal(assetDaProvare('<script>self.__next_f.push([1,"/_next/static/chunks/finto.js"])</script><p>x</p>', BASE2), null);
    });

    it("falso verde: un BUILD_ID di un carattere non e' un'impronta", () => {
      assert.equal(eLaMiaBuild("<html><title>Sito di un altro progetto</title></html>", "a"), false);
      assert.equal(eLaMiaBuild("<html>versione 1.0</html>", "1"), false);
      assert.equal(eLaMiaBuild("<html>aaaaaaaaaa</html>", "aaaaaaaa"), false);
    });

    it("un BUILD_ID vero resta un'impronta", () => {
      assert.equal(eLaMiaBuild("<html>x SLbertaniCollaudo1 y</html>", "SLbertaniCollaudo1"), true);
    });
  });
});
