#!/usr/bin/env node
// Banco del collaudo avversario di site-doctor (P.6-P2).
//
// Dominio: STUDIO LEGALE bilingue (it/en) — diverso dal pilota (pizzeria) e dal
// banco del costruttore. Scritto leggendo SOLO `SKILL.md` + `references/` +
// `resources/templates/`, senza aprire `scripts/`: e' la fase 1 del mandato,
// «il primo attacco e' seguire il manuale».
//
// Cosa esercita che il pilota non puo':
//   - due lingue vere con hreflang reciproci e x-default;
//   - tre origini di terzi vere (mappa incorporata, due host dei font);
//   - sei archiviazioni di cinque tipi diversi, fra cui un `Set-Cookie` vero
//     sulla risposta del documento e un `document.cookie` scritto da uno script
//     inline.
//
//   node banco-sl.mjs --dir <cartella> --porta 3881            # genera
//   node banco-sl.mjs --dir <cartella> --porta 3881 --servi    # genera e serve
//   node banco-sl.mjs --dir <cartella> --porta 3881 --servi --sabota <ID>
//   node banco-sl.mjs --elenco
//
// `genera` comincia con un `rmSync` sulla cartella: `--dir` va a una cartella di
// lavoro, mai a un progetto vero. Il certificato e l'handoff che il gate legge
// NASCONO da qui (`docCertificato`, `docHandoffSiteDoctor`) — fino al 2026-08-06
// erano scritti a mano dentro la cartella generata, e questo comando li
// cancellava senza rigenerarli: il banco conforme usciva ROSSO 3+3 su un clone
// pulito, e il «VERDE 14/14» del verbale era una fotografia di un disco.
//
// Il giro completo, dalla cartella di questo file (D25, 2026-08-07):
//
//   node banco-sl.mjs --dir banco-prova-collaudo-sd/studio-legale --porta 3881 --servi
//   cd banco-prova-collaudo-sd/studio-legale && node ../../verify.mjs --url http://127.0.0.1:3881
//   node giro.mjs                 # le 42 classi di sabotaggio, una per riga
//   node uno.mjs <CLASSE>         # una sola classe, uscita umana del gate
//
// Zero dipendenze, zero database, zero chiavi: `DECISIONI.md` §25.

import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const BUILD_ID = "SLbertaniCollaudo1";

// ────────────────────────────────────────────────────────────── argomenti ────

function argomenti(argv) {
  const out = { dir: null, porta: 3881, servi: false, sabota: null, elenco: false, conInformativa: true, ritardo: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[++i];
    else if (a === "--porta") out.porta = Number(argv[++i]);
    else if (a === "--servi") out.servi = true;
    else if (a === "--sabota") out.sabota = argv[++i];
    else if (a === "--elenco") out.elenco = true;
    else if (a === "--senza-informativa") out.conInformativa = false;
    else if (a === "--ritardo") out.ritardo = Number(argv[++i]);
    else throw new Error(`argomento sconosciuto: ${a}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────── le varianti ────

export const CLASSI = {
  // ─── falsi verdi della superficie ───
  SUP1: "pagina raggiungibile solo da <form action> (non da <a>)",
  SUP2: "sitemap che dichiara una pagina che risponde 404",
  SUP3: "pagina raggiungibile solo dopo una catena di due rimandi",
  SUP4: "pagina distinta solo dalla query string",
  // P.6-P5, dal rilievo piu' grave di P.6-P4 (P7-R2): prima di quel mandato
  // questa classe usciva VERDE con uscita 0 — l'iframe era invisibile alla
  // camminata e i suoi campi non esistevano per nessun passo.
  SUP5: "pagina che raccoglie IBAN e codice fiscale, raggiungibile solo da <iframe src>",
  // ─── falsi verdi dell'informativa ───
  INF1: "collegamento all'informativa presente ma display:none",
  INF2: "collegamento all'informativa verso un 404",
  INF3: "informativa che e' un rimando a un terzo (boilerplate esterno)",
  INF4: "collegamento all'informativa che e' un mailto:",
  INF5: "informativa che e' solo un titolo, senza contenuto",
  // ─── falsi verdi dei dati raccolti ───
  DAT1: "campi personali senza autocomplete (tel, indirizzo, documento)",
  DAT2: "modulo costruito interamente in JavaScript",
  DAT3: "modulo che invia a un endpoint di terzi",
  DAT4: "nessun modulo in HTML ma raccolta via mailto (falso n/a)",
  // ─── falsi verdi dell'archiviazione ───
  ARC1: "archiviazione scritta solo dentro un gestore di click",
  ARC2: "cookie posto da uno script di terzi (non misurabile)",
  ARC3: "Set-Cookie su una sottorisorsa invece che sul documento",
  ARC4: "nessuna archiviazione dichiarata ma cinque tipi presenti",
  // ─── falsi verdi dell'accessibilita' ───
  A11Y1: "alt vuoto su un'immagine di contenuto",
  A11Y2: "label for che punta a un id inesistente",
  A11Y3: "aria-label fatto di soli spazi",
  A11Y4: "salto di titoli da h1 a h4",
  A11Y5: "lang dell'html in disaccordo col testo",
  A11Y6: "due <main> nella stessa pagina",
  // ─── falsi verdi di lingua e hreflang ───
  HRE1: "hreflang non reciproco (it→en senza en→it)",
  HRE2: "x-default che punta a una pagina inesistente",
  HRE3: "due lingue che dichiarano la stessa URL",
  HRE4: "hreflang solo nell'intestazione HTTP Link, non nel markup",
  HRE5: "sito bilingue con zero hreflang (deve essere ROSSO, mai n/a)",
  // ─── parsing HTML ostile ───
  HTM1: "<script> che contiene </div> dentro una stringa",
  HTM2: "sezione avvolta in <![CDATA[ ... ]]>",
  HTM3: "<textarea> che contiene markup con img senza alt",
  HTM4: "attributo con virgoletta non chiusa",
  HTM5: "<!DOCTYPE con sottoinsieme interno fra parentesi quadre",
  HTM6: "<svg> con contenuto estraneo (foreignObject)",
  HTM7: "pagina servita come application/xhtml+xml",
  HTM8: "commento che nomina </script> dentro il corpo di uno script",
  HTM9: "chiusura </script> orfana: una sola, e il documento finisce li'",
  // ─── rete ───
  NET1: "server lento: un byte al secondo, non chiude mai",
  NET2: "corpo enorme (nessun tetto sui byte scaricati)",
  // ─── le cinque voci tornate a casa con D21 ───
  // Due forme per voce, e sono le due che il mandato distingue: il DICHIARATO
  // CHE MENTE (il markup promette e il server non consegna) e l'ASSENZA. La
  // prima e' un bloccante perche' chi legge il markup sbaglia per causa del
  // sito; la seconda e' un rilievo, perche' e' una scelta che si puo' firmare.
  FAV1: "<link rel=icon> presente e la favicon risponde 404 (il difetto del pilota)",
  FAV2: "nessun <link rel=icon> e nessun /favicon.ico: il browser chiede e prende 404",
  OG1: "nessun tag Open Graph su nessuna pagina",
  OG2: "og:image che punta a una risorsa che risponde 404",
  LD1: "nessun blocco application/ld+json su nessuna pagina",
  LD2: "application/ld+json presente e NON e' JSON valido",
  SMP1: "/sitemap.xml risponde 404",
  SMP2: "/sitemap.xml risponde 200 con HTML dentro",
  ROB1: "/robots.txt risponde 404",
  ROB2: "robots.txt con Disallow: / su un sito che la sitemap pubblicizza",
};

// ───────────────────────────────────────────────────────── testi comuni ────

const NOME = "Studio Legale Bertani & Associati";

function base(porta) {
  return `http://127.0.0.1:${porta}`;
}

const NAV_IT = [
  ["/", "Studio"],
  ["/chi-siamo", "Chi siamo"],
  ["/aree-di-attivita", "Aree di attività"],
  ["/contatti", "Contatti"],
];

const NAV_EN = [
  ["/en", "Firm"],
  ["/en/about-us", "About us"],
  ["/en/practice-areas", "Practice areas"],
  ["/en/contact", "Contact"],
];

// Il carico RSC di Next: HTML dentro <script>, con un h1 che NON deve essere
// contato. Il pilota ce l'ha, e un banco senza sarebbe piu' facile del vero.
const CARICO_RSC = `<script>self.__next_f=self.__next_f||[];self.__next_f.push([1,"[\\"$\\",\\"h1\\",null,{\\"className\\":\\"sr-only\\",\\"children\\":\\"${NOME}\\"}]"]);self.__next_f.push([1,"[\\"$\\",\\"img\\",null,{\\"src\\":\\"/logo.svg\\"}]"]);</script>`;

// Lo script inline che scrive un cookie con document.cookie: e' una delle
// cinque forme di archiviazione, e la sola che vive dentro la pagina.
const INLINE_CONSENSO = `<script>
  (function () {
    var scelta = document.cookie.indexOf("studio_consenso=") >= 0;
    if (!scelta) { return; }
    document.cookie = "studio_consenso=1; path=/; max-age=15552000; samesite=lax";
  })();
</script>`;

function terziDelContatto() {
  return `      <h2>Dove siamo</h2>
      <iframe title="Mappa della sede di Verona" src="https://www.google.com/maps/embed?pb=studio-bertani-verona" width="600" height="360" loading="lazy"></iframe>`;
}

/**
 * Il JSON-LD sta sulla home e su nessun'altra pagina, come dichiara l'handoff di
 * speed-demon: e' la forma vera, non quella comoda. Un passo che pretendesse i
 * dati strutturati su OGNI pagina sarebbe rosso su ogni sito del mondo.
 */
function datiStrutturati(porta) {
  const b = base(porta);
  return `  <script type="application/ld+json">
{"@context":"https://schema.org","@type":"LegalService","name":"${NOME}","url":"${b}/","image":"${b}/logo.svg","address":{"@type":"PostalAddress","streetAddress":"Via Cappello 12","postalCode":"37121","addressLocality":"Verona","addressCountry":"IT"},"areaServed":"IT","availableLanguage":["it","en"]}
  </script>`;
}

function testa({ lang, titolo, percorso, porta, alternate = true, extra = "" }) {
  const b = base(porta);
  const hreflang = alternate
    ? ALTERNATE.map(([codice, p]) => `  <link rel="alternate" hreflang="${codice}" href="${b}${p === "/" ? "/" : p}" />`).join("\n") +
      `\n  <link rel="alternate" hreflang="x-default" href="${b}/" />`
    : "";
  const home = percorso === "/" || percorso === "/en";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titolo}</title>
  <link rel="icon" href="/favicon.svg" />
  <link rel="canonical" href="${b}${percorso}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${NOME}" />
  <meta property="og:title" content="${titolo}" />
  <meta property="og:description" content="${lang === "it" ? "Studio legale di Verona: diritto d'impresa, lavoro e famiglia." : "Law firm in Verona: corporate, employment and family law."}" />
  <meta property="og:url" content="${b}${percorso}" />
  <meta property="og:image" content="${b}/logo.svg" />
  <meta property="og:locale" content="${lang === "it" ? "it_IT" : "en_GB"}" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap" />
  <link rel="stylesheet" href="/_next/static/css/stile.css" />
${hreflang}${home ? `\n${datiStrutturati(porta)}` : ""}${extra}
</head>`;
}

// La coppia di pagine equivalenti nelle due lingue, per gli hreflang.
let ALTERNATE = [];

function intestazione(lang, percorso) {
  const nav = lang === "it" ? NAV_IT : NAV_EN;
  const altro = lang === "it" ? GEMELLO_EN[percorso] : GEMELLO_IT[percorso];
  const etichettaAltro = lang === "it" ? "English" : "Italiano";
  const codiceAltro = lang === "it" ? "en" : "it";
  return `  <header>
    <a href="${lang === "it" ? "/" : "/en"}"><img src="/logo.svg" alt="${NOME}" width="220" height="40" /></a>
    <nav aria-label="${lang === "it" ? "Navigazione principale" : "Main navigation"}">
      <ul>
${nav.map(([p, t]) => `        <li><a href="${p}"${p === percorso ? ' aria-current="page"' : ""}>${t}</a></li>`).join("\n")}
        <li><a href="${altro}" hreflang="${codiceAltro}" lang="${codiceAltro}">${etichettaAltro}</a></li>
      </ul>
    </nav>
  </header>`;
}

function pieDiPagina(lang, conInformativa) {
  const privacy = lang === "it" ? "/privacy" : "/en/privacy";
  const testo = lang === "it" ? "Informativa privacy" : "Privacy notice";
  const riga = conInformativa ? `      <li><a href="${privacy}">${testo}</a></li>\n` : "";
  return `  <footer>
    <h2>${lang === "it" ? "Contatti e documenti" : "Contact and documents"}</h2>
    <ul>
${riga}      <li><a href="${lang === "it" ? "/contatti" : "/en/contact"}">${lang === "it" ? "Scrivici" : "Write to us"}</a></li>
    </ul>
    <p>${NOME} — Via Cappello 12, 37121 Verona — P. IVA 03918470231</p>
  </footer>`;
}

function bannerConsenso(lang) {
  const t =
    lang === "it"
      ? {
          h: "Prima di continuare",
          p: "Usiamo un contatore di visite interno e una mappa incorporata. Nessuno dei due è necessario a far funzionare il sito: si attivano solo se lo consenti.",
          si: "Accetto",
          no: "Solo il necessario",
        }
      : {
          h: "Before you continue",
          p: "We use an internal visit counter and an embedded map. Neither is required for the site to work: they are enabled only with your consent.",
          si: "Accept",
          no: "Only what is required",
        };
  return `  <div id="consenso" role="dialog" aria-labelledby="consenso-titolo">
    <h2 id="consenso-titolo">${t.h}</h2>
    <p>${t.p}</p>
    <button type="button" id="consenso-si">${t.si}</button>
    <button type="button" id="consenso-no">${t.no}</button>
  </div>`;
}

function pagina({ lang, percorso, titolo, porta, corpo, conInformativa, extraTesta = "", scriptExtra = "" }) {
  return `${testa({ lang, titolo, percorso, porta, extra: extraTesta })}
<body>
${intestazione(lang, percorso)}
  <main>
${corpo}
  </main>
${pieDiPagina(lang, conInformativa)}
${bannerConsenso(lang)}
${INLINE_CONSENSO}
${CARICO_RSC}
  <script src="/_next/static/chunks/main-app.js"></script>
  <script src="/_next/static/${BUILD_ID}/_buildManifest.js"></script>
${scriptExtra}
</body>
</html>
`;
}

// ──────────────────────────────────────────────────────── le dieci pagine ────

function moduloContatti(lang) {
  const t =
    lang === "it"
      ? {
          h: "Richiedi un primo colloquio",
          nome: "Nome e cognome",
          email: "Indirizzo email",
          tel: "Telefono",
          msg: "Di cosa ha bisogno",
          info: 'I dati che lascia qui servono a risponderle. Prima di scrivere legga l\'',
          link: "informativa privacy",
          privacy: "/privacy",
          invio: "Invia la richiesta",
        }
      : {
          h: "Request a first consultation",
          nome: "Full name",
          email: "Email address",
          tel: "Phone",
          msg: "What do you need",
          info: "The data you leave here is used to answer you. Before writing, please read the ",
          link: "privacy notice",
          privacy: "/en/privacy",
          invio: "Send the request",
        };
  return `      <h2>${t.h}</h2>
      <form action="${lang === "it" ? "/contatti" : "/en/contact"}" method="post">
        <p>
          <label for="nome">${t.nome}</label>
          <input id="nome" name="nome" type="text" autocomplete="name" required />
        </p>
        <p>
          <label for="email">${t.email}</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </p>
        <p>
          <label for="telefono">${t.tel}</label>
          <input id="telefono" name="telefono" type="tel" autocomplete="tel" />
        </p>
        <p>
          <label for="pec">${lang === "it" ? "Indirizzo PEC (facoltativo)" : "Certified email (optional)"}</label>
          <input id="pec" name="pec_studio" type="email" autocomplete="email" />
        </p>
        <p>
          <label for="messaggio">${t.msg}</label>
          <textarea id="messaggio" name="messaggio" rows="6"></textarea>
        </p>
        <p>${t.info}<a href="${t.privacy}">${t.link}</a>.</p>
        <button type="submit">${t.invio}</button>
      </form>`;
}

const GEMELLO_EN = {
  "/": "/en",
  "/chi-siamo": "/en/about-us",
  "/aree-di-attivita": "/en/practice-areas",
  "/contatti": "/en/contact",
  "/privacy": "/en/privacy",
};
const GEMELLO_IT = Object.fromEntries(Object.entries(GEMELLO_EN).map(([a, b]) => [b, a]));

// `porta` non serve piu' qui: i corpi italiani non la nominano (i terzi hanno
// host propri, e gli hreflang sono percorsi). Il parametro era rimasto dopo una
// riscrittura, e nessun guardiano l'aveva visto perche' questo file e' entrato
// sotto ESLint solo con D25.
function corpiIt() {
  return {
    "/": {
      titolo: `${NOME} — diritto d'impresa a Verona`,
      corpo: `      <h1>${NOME}</h1>
      <p>Assistiamo imprese e famiglie in materia societaria, del lavoro e di
      famiglia. Lo studio è a Verona dal 1998 e segue clienti italiani e
      stranieri.</p>
      <h2>Come lavoriamo</h2>
      <p>Il primo colloquio serve a capire se possiamo essere utili. Se la
      materia non è nostra lo diciamo subito e indichiamo un collega.</p>
      <h3>Tempi di risposta</h3>
      <p>Rispondiamo alle richieste scritte entro due giorni lavorativi.</p>`,
    },
    "/chi-siamo": {
      titolo: `Chi siamo — ${NOME}`,
      corpo: `      <h1>Chi siamo</h1>
      <p>Quattro avvocati e due praticanti. Ogni pratica ha un titolare che la
      segue dall'inizio alla fine.</p>
      <h2>I professionisti</h2>
      <h3>Avv. Chiara Bertani</h3>
      <p>Diritto societario e contrattualistica d'impresa. Iscritta all'Ordine
      di Verona dal 2001.</p>
      <h3>Avv. Marco Dallagà</h3>
      <p>Diritto del lavoro, lato datore di lavoro e lato lavoratore.</p>`,
    },
    "/aree-di-attivita": {
      titolo: `Aree di attività — ${NOME}`,
      corpo: `      <h1>Aree di attività</h1>
      <h2>Diritto societario</h2>
      <p>Costituzione, patti parasociali, cessioni di quote, operazioni
      straordinarie.</p>
      <h2>Diritto del lavoro</h2>
      <p>Contratti, licenziamenti, contenzioso davanti al giudice del lavoro.</p>
      <h2>Diritto di famiglia</h2>
      <p>Separazioni, divorzi, accordi di mantenimento, successioni.</p>`,
    },
    "/contatti": {
      titolo: `Contatti — ${NOME}`,
      corpo: `      <h1>Contatti</h1>
      <p>Via Cappello 12, 37121 Verona. Riceviamo su appuntamento dal lunedì al
      venerdì.</p>
${moduloContatti("it")}
${terziDelContatto()}`,
    },
    "/privacy": { titolo: `Informativa privacy — ${NOME}`, corpo: INFORMATIVA_IT },
  };
}

// L'informativa generata da `certifica` dal modello
// `resources/templates/informativa-bozza.md`, coi segnaposto gia' sostituiti
// dal titolare del trattamento: la bozza servita coi `{{…}}` il gate la rifiuta,
// ed e' voluto.
const INFORMATIVA_IT = `      <h1>Informativa sul trattamento dei dati personali</h1>
      <p>Questa pagina spiega quali dati personali questo sito raccoglie, perché
      li raccoglie, per quanto tempo li conserva e quali diritti ha chi li
      lascia. È scritta ai sensi dell'art. 13 del Regolamento (UE) 2016/679.</p>

      <h2>1. Titolare del trattamento</h2>
      <p>Il titolare del trattamento dei dati raccolti da questo sito è Bertani
      &amp; Associati Studio Legale Associato, con sede in Via Cappello 12,
      37121 Verona, P. IVA 03918470231. Per ogni questione riguardante i propri
      dati si può scrivere a privacy@studiobertani.it. Il responsabile della
      protezione dei dati non è stato nominato: lo studio non rientra nei casi
      dell'art. 37 del Regolamento.</p>

      <h2>2. Finalità del trattamento</h2>
      <p>I dati vengono trattati per queste finalità, e per nessun'altra:
      rispondere alle richieste inviate con il modulo di contatto; valutare se
      lo studio possa assumere l'incarico; gestire il rapporto professionale con
      chi diventa cliente e i relativi obblighi di legge, fiscali e
      antiriciclaggio.</p>

      <h2>3. Base giuridica</h2>
      <p>La base giuridica del trattamento dei dati del modulo di contatto sono
      le misure precontrattuali richieste dall'interessato (art. 6.1.b del
      Regolamento). Per i dati del rapporto professionale il fondamento
      giuridico è l'esecuzione del contratto e, per gli obblighi antiriciclaggio
      e fiscali, l'adempimento di un obbligo legale (art. 6.1.c).</p>

      <h2>4. Destinatari dei dati</h2>
      <p>I destinatari dei dati, che agiscono come responsabili del trattamento
      per conto del titolare, sono: il fornitore dell'ospitalità del sito
      (Vercel Inc., Stati Uniti, con clausole contrattuali tipo), il fornitore
      della posta elettronica (Aruba S.p.A., Italia) e il consulente del lavoro
      dello studio. Nessuna comunicazione a terzi avviene per finalità diverse
      da quelle qui elencate, e nessun dato viene diffuso o venduto.</p>

      <h2>5. Tempi di conservazione</h2>
      <p>I dati del modulo di contatto sono conservati dodici mesi dall'ultimo
      messaggio, poi cancellati. I dati dei clienti sono conservati dieci anni
      dalla chiusura della pratica, che è il termine di conservazione delle
      scritture contabili e della documentazione antiriciclaggio. Scaduto il
      termine i dati sono cancellati o resi anonimi.</p>

      <h2>6. Diritti dell'interessato</h2>
      <p>Chi lascia i propri dati ha in ogni momento i diritti dell'interessato
      previsti dagli artt. 15-22 del Regolamento: il diritto di accesso ai propri
      dati, la rettifica di quelli inesatti, la cancellazione, la limitazione del
      trattamento, la portabilità e il diritto di opporsi al trattamento. Per
      esercitarli basta scrivere a privacy@studiobertani.it; la risposta arriva
      entro un mese dalla richiesta.</p>

      <h2>7. Reclamo all'autorità di controllo</h2>
      <p>Chi ritiene che il trattamento dei propri dati violi il Regolamento può
      proporre reclamo al Garante per la protezione dei dati personali, che è
      l'autorità di controllo italiana, oppure agire davanti all'autorità
      giudiziaria ordinaria.</p>

      <h2>8. Cosa questo sito mette nel browser</h2>
      <p>Il sito pone un cookie di sessione necessario alla protezione dei
      moduli, conserva la preferenza di lingua e la bozza del messaggio di
      contatto nel browser, e tiene una copia locale della modulistica
      scaricabile. Tutte queste sono necessarie al servizio richiesto. Il
      contatore di visite interno e la mappa della sede non sono necessari e si
      attivano solo dopo il consenso, che viene chiesto prima e registrato in un
      cookie.</p>

      <p>Ultimo aggiornamento: 2026-08-06.</p>`;

function corpiEn() {
  return {
    "/en": {
      titolo: `${NOME} — business law in Verona`,
      corpo: `      <h1>${NOME}</h1>
      <p>We assist companies and families in corporate, employment and family
      matters. The firm has been in Verona since 1998 and works with Italian and
      foreign clients.</p>
      <h2>How we work</h2>
      <p>The first consultation is there to find out whether we can be useful.
      If the matter is not ours we say so at once and point to a colleague.</p>
      <h3>Response times</h3>
      <p>We answer written requests within two working days.</p>`,
    },
    "/en/about-us": {
      titolo: `About us — ${NOME}`,
      corpo: `      <h1>About us</h1>
      <p>Four lawyers and two trainees. Every file has one partner who follows
      it from beginning to end.</p>
      <h2>The professionals</h2>
      <h3>Chiara Bertani</h3>
      <p>Corporate law and commercial contracts. Member of the Verona Bar since
      2001.</p>
      <h3>Marco Dallagà</h3>
      <p>Employment law, on the employer and on the employee side.</p>`,
    },
    "/en/practice-areas": {
      titolo: `Practice areas — ${NOME}`,
      corpo: `      <h1>Practice areas</h1>
      <h2>Corporate law</h2>
      <p>Incorporation, shareholders' agreements, share transfers, mergers and
      acquisitions.</p>
      <h2>Employment law</h2>
      <p>Contracts, dismissals, litigation before the employment judge.</p>
      <h2>Family law</h2>
      <p>Separation, divorce, maintenance agreements, inheritance.</p>`,
    },
    "/en/contact": {
      titolo: `Contact — ${NOME}`,
      corpo: `      <h1>Contact</h1>
      <p>Via Cappello 12, 37121 Verona. We receive by appointment from Monday to
      Friday.</p>
${moduloContatti("en")}
${terziDelContatto()}`,
    },
    "/en/privacy": { titolo: `Privacy notice — ${NOME}`, corpo: INFORMATIVA_EN },
  };
}

const INFORMATIVA_EN = `      <h1>Privacy notice</h1>
      <p>This page explains which personal data this website collects, why it
      collects them, how long it keeps them and which rights belong to the people
      who leave them. It is written under art. 13 of Regulation (EU) 2016/679.</p>

      <h2>1. Data controller</h2>
      <p>The data controller for the data collected by this website is Bertani
      &amp; Associati Studio Legale Associato, Via Cappello 12, 37121 Verona,
      Italy, VAT 03918470231. For any question about your data you may write to
      privacy@studiobertani.it. No data protection officer has been appointed:
      the firm does not fall within the cases of art. 37 of the Regulation.</p>

      <h2>2. Purposes of the processing</h2>
      <p>Data are processed for these purposes and for no other: answering the
      requests sent through the contact form; assessing whether the firm may
      take the matter on; managing the professional relationship with those who
      become clients, together with the related legal, tax and anti-money
      laundering obligations.</p>

      <h2>3. Legal basis</h2>
      <p>The legal basis for processing the contact form data is the
      pre-contractual measures requested by the data subject (art. 6.1.b of the
      Regulation). For the data of the professional relationship the legal
      ground is the performance of the contract and, for the anti-money
      laundering and tax obligations, compliance with a legal obligation
      (art. 6.1.c).</p>

      <h2>4. Recipients of the data</h2>
      <p>The recipients of the data, acting as processors on behalf of the
      controller, are: the website hosting provider (Vercel Inc., United States,
      under standard contractual clauses), the email provider (Aruba S.p.A.,
      Italy) and the firm's payroll consultant. No communication to third
      parties takes place for purposes other than those listed here, and no data
      are disseminated or sold.</p>

      <h2>5. Retention periods</h2>
      <p>Contact form data are kept for twelve months from the last message and
      then deleted. Client data are kept for ten years from the closing of the
      matter, which is the retention period for accounting records and
      anti-money laundering documentation. Once the term has expired the data
      are deleted or anonymised.</p>

      <h2>6. Rights of the data subject</h2>
      <p>Anyone who leaves their data has at any time the rights of the data
      subject under artt. 15-22 of the Regulation: the right of access to their
      data, rectification of inaccurate data, erasure, restriction of
      processing, portability and the right to object to the processing. To
      exercise them it is enough to write to privacy@studiobertani.it; the
      answer arrives within one month of the request.</p>

      <h2>7. Complaint to the supervisory authority</h2>
      <p>Anyone who believes that the processing of their data infringes the
      Regulation may lodge a complaint with the Garante per la protezione dei
      dati personali, the Italian supervisory authority, or bring proceedings
      before the ordinary courts.</p>

      <h2>8. What this website stores in your browser</h2>
      <p>The website sets a session cookie needed to protect the forms, keeps
      the language preference and the draft of the contact message in the
      browser, and holds a local copy of the downloadable forms. All of these
      are necessary for the service requested. The internal visit counter and
      the map of the office are not necessary and are enabled only after
      consent, which is asked beforehand and recorded in a cookie.</p>

      <p>Last updated: 2026-08-06.</p>`;

// ───────────────────────────────────────────────────────────── i bundle ────

const BUNDLE_MAIN = `// main-app.js — bundle servito da ogni pagina.
"use strict";
(function () {
  // preferenza di lingua: essenziale, serve a non rimandare ogni volta
  var lingua = document.documentElement.lang || "it";
  try { window.localStorage.setItem("studio:lingua", lingua); } catch (e) {}

  // cache dei documenti pubblici scaricabili: essenziale al servizio richiesto
  if (window.indexedDB) {
    var richiesta = window.indexedDB.open("studio-documenti", 1);
    richiesta.onupgradeneeded = function (ev) {
      ev.target.result.createObjectStore("modulistica", { keyPath: "id" });
    };
  }

  // contatore di visite interno: NON essenziale, vuole il consenso
  function contatore() {
    var n = Number(window.localStorage.getItem("studio:analitica") || "0");
    window.localStorage.setItem("studio:analitica", String(n + 1));
  }
  if (document.cookie.indexOf("studio_consenso=1") >= 0) { contatore(); }

  var si = document.getElementById("consenso-si");
  if (si) {
    si.addEventListener("click", function () {
      document.cookie = "studio_consenso=1; path=/; max-age=15552000; samesite=lax";
      contatore();
    });
  }
})();
`;

const BUNDLE_CONTATTI = `// contatti.js — bozza del modulo, solo sulle pagine di contatto.
"use strict";
(function () {
  var modulo = document.querySelector("form");
  if (!modulo) { return; }
  var chiave = "studio:bozza-contatto";
  try {
    var bozza = window.sessionStorage.getItem(chiave);
    if (bozza) { modulo.querySelector("textarea").value = JSON.parse(bozza).messaggio || ""; }
  } catch (e) {}
  modulo.addEventListener("input", function () {
    window.sessionStorage.setItem(chiave, JSON.stringify({ messaggio: modulo.querySelector("textarea").value }));
  });
})();
`;

const BUNDLE_MANIFEST = `self.__BUILD_MANIFEST={"__rewrites":{},"sortedPages":["/","/chi-siamo","/aree-di-attivita","/contatti","/en","/en/about-us","/en/practice-areas","/en/contact"]};self.__BUILD_MANIFEST_CB&&self.__BUILD_MANIFEST_CB();
`;

const STILE = `:root { --inchiostro: #1b1b1b; --carta: #fbfaf7; }
body { background: var(--carta); color: var(--inchiostro); font-family: Lora, Georgia, serif; }
#consenso { border: 1px solid var(--inchiostro); padding: 1rem; }
header nav ul { list-style: none; display: flex; gap: 1rem; }
main { max-width: 68ch; margin: 0 auto; }
.sfondo { background-image: url("/_next/static/media/aula.jpg"); }
`;

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 40" role="img" aria-label="${NOME}">
  <title>${NOME}</title>
  <rect width="220" height="40" fill="#1b1b1b" />
  <text x="10" y="26" fill="#fbfaf7" font-size="14" font-family="serif">Bertani &amp; Associati</text>
</svg>
`;

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1b1b1b"/><text x="6" y="23" fill="#fbfaf7" font-size="18" font-family="serif">B</text></svg>
`;

// ───────────────────────────────────────────────────── i documenti del progetto ────

function docHandoffSpeedDemon() {
  return `# 13 — speed-demon

## 1. Cosa ho fatto

Misurata la build di produzione con Lighthouse su cinque giri, e scritti i
metadati che l'indicizzazione pretende.

- **canonical** su ogni pagina pubblica, assoluto, con la barra finale normalizzata.
- **sitemap.xml** generata da \`app/sitemap.ts\`: dieci indirizzi, uno per pagina
  e per lingua.
- **robots.txt** con \`Allow: /\` e il rimando alla sitemap.
- **noindex** sulle rotte private (\`/area-clienti/*\`): non compaiono nella
  sitemap e portano \`<meta name="robots" content="noindex">\`.
- **Open Graph** completo su tutte le pagine (\`og:title\`, \`og:description\`,
  \`og:image\`, \`og:locale\` e \`og:locale:alternate\`).
- **favicon** servita da \`/favicon.svg\`, verificata \`200\` su ogni pagina.
- **dati strutturati** JSON-LD di tipo \`LegalService\` sulla home.
- **contrasti** di colore: categoria \`accessibility\` di Lighthouse, soglia
  dichiarata in \`docs/performance.md\`.

## 2. Verdetto

Gate: VERDE
`;
}

function docHandoffGestionale() {
  return `# 10 — gestionale-crafter

## 1. Cosa ho fatto

Costruito il pannello di amministrazione dello studio: pratiche, clienti,
scadenzario, e i testi delle sezioni del sito pubblico.

## 2. Accessibilità dell'area amministrativa

Il passo a11y del mio gate gira sulle rotte protette (\`/admin/*\`): etichette
dei campi, nomi accessibili dei bottoni, gerarchia dei titoli. È
l'**accessibilità delle rotte amministrative**, e risponde a me: il sito
pubblico non è mio.

## 3. Verdetto

Gate: VERDE
`;
}

function docPerformance() {
  return `# Contratto di performance — ${NOME}

Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06

## 1. Le pagine misurate

| # | percorso | perché |
|---|---|---|
| S1 | / | la porta d'ingresso |
| S2 | /contatti | la pagina che converte |
| S3 | /aree-di-attivita | la più pesante |

## 2. Le soglie

| categoria | soglia |
|---|---|
| performance | ≥ 85 |
| accessibility | ≥ 95 — comprende l'audit \`color-contrast\` |
| best-practices | ≥ 90 |
| seo | 100 |

I **contrasti** di colore sono dentro la categoria \`accessibility\` e la soglia
qui sopra è il loro contratto.
`;
}

function docProgetto() {
  return `# ${NOME} — progetto

Sito vetrina bilingue di uno studio legale di Verona. Due lingue servite
(\`it\`, \`en\`), un modulo di contatto pubblico, nessun'area riservata pubblica.

## Stack

Next.js (App Router) + TypeScript + Tailwind + Supabase, lo standard del
\`CLAUDE.md\`. Nessuna deroga.

## Lingue

\`it\` è la lingua principale, \`en\` la seconda. Le rotte inglesi vivono sotto
\`/en\`. Ogni pagina dichiara gli \`hreflang\` reciproci e l'\`x-default\`.
`;
}

function docVetrina() {
  return `# Contratto della vetrina — ${NOME}

Confermato da: Alberto Marocco (committente) il 2026-08-06

| # | pagina | cosa mostra |
|---|---|---|
| 1 | / | presentazione dello studio |
| 2 | /chi-siamo | i professionisti |
| 3 | /aree-di-attivita | le materie |
| 4 | /contatti | il modulo di contatto |
| 5 | /en, /en/about-us, /en/practice-areas, /en/contact | le stesse in inglese |

Nessun *lorem ipsum* e nessun segnaposto resta servito: il passo
\`segnaposto-serviti\` del gate di vetrina-crafter lo verifica su ogni pagina
dichiarata, e i testi delle sezioni arrivano dalla tabella dei contenuti
(\`contenuti-vivi\`).
`;
}

function docFlussi() {
  return `# Flussi critici — ${NOME}

Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06

| id | flusso | tipo |
|---|---|---|
| F1 | invio del modulo di contatto | positivo |
| F2 | accesso all'area amministrativa senza sessione | ostile-lettura |
`;
}

function docGestionale() {
  return `# Modello di amministrazione — ${NOME}

Confermato da: Alberto Marocco (committente) il 2026-08-06

Ruoli: \`titolare\`, \`praticante\`. Le rotte \`/admin/*\` sono protette dalla
guardia del layout e dai route handler.
`;
}

function docDebito() {
  return `# Debito tecnico — ${NOME}

| # | voce | gravità | proprietario |
|---|---|---|---|
| 1 | antispam e limiti di frequenza sul modulo di contatto: **scoperti** — sarebbero di cyber-shield, che non esiste | alta | — |
`;
}

/**
 * Il certificato di idoneita' — e il motivo per cui lo scrive il banco.
 *
 * Fino al 2026-08-06 questo documento e l'handoff di site-doctor erano scritti
 * A MANO dentro la cartella generata, e `genera` comincia con un `rmSync`. Il
 * comando documentato in testa a questo file — `--dir <cartella> --servi` —
 * cancellava percio' le due sole prove che il banco potesse uscire VERDE 9/9,
 * e nessuno se ne accorgeva perche' il giro del sabotaggio passa `--sabota`, che
 * NON rigenera. Un clone pulito che eseguiva il comando scritto nel banco
 * otteneva ROSSO 3+3, e l'affermazione «VERDE 9/9» del verbale non era
 * rilanciabile: era una fotografia di un disco.
 *
 * Ora i documenti sono codice come tutto il resto (`DECISIONI.md` §25): il
 * banco e' un file, e cio' che il gate legge nasce da quel file.
 */
function docCertificato(porta) {
  return `# Certificato di idoneità — ${NOME}

Questo documento dice, **voce per voce**, cosa è stato guardato prima di
pubblicare, con che esito, e **chi risponde di ogni voce**. Non è un riassunto
del gate: è il documento che **launchpad legge per decidere se pubblicare**, e
senza il quale non pubblica.

> **Nessuna riga di questo documento è consulenza legale.** Site Doctor misura
> che l'informativa esista, sia raggiungibile e nomini le voci che l'art. 13 del
> Regolamento pretende; non sa se le basi giuridiche dichiarate siano quelle
> giuste né se i tempi di conservazione siano leciti. Quello lo firma chi
> risponde davanti al Garante.

Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06

## Ambiente

URL verificato: ${base(porta)}
Lingue dichiarate: it en
Informativa privacy: /privacy
Banner di consenso: sì

## Superficie pubblica dichiarata

| percorso | cosa fa |
|---|---|
| / | la home italiana |
| /chi-siamo | i professionisti |
| /aree-di-attivita | le materie trattate |
| /contatti | il modulo di contatto e la mappa della sede |
| /privacy | l'informativa italiana |
| /en | la home inglese |
| /en/about-us | i professionisti, in inglese |
| /en/practice-areas | le materie, in inglese |
| /en/contact | il modulo di contatto inglese |
| /en/privacy | l'informativa inglese |

## Archiviazione dichiarata

| chiave | tipo | essenziale | scopo | dove |
|---|---|---|---|---|
| sl_sessione | cookie | sì | sessione anonima e protezione CSRF del modulo di contatto | ogni pagina |
| studio_consenso | document.cookie | sì | registra la scelta sul consenso, ed è la scelta stessa | ogni pagina |
| studio:lingua | localStorage | sì | preferenza di lingua, per non rimandare a ogni visita | ogni pagina |
| studio:analitica | localStorage | no | contatore di visite interno: si attiva solo dopo il consenso | ogni pagina |
| studio:bozza-contatto | sessionStorage | sì | tiene la bozza del messaggio se la pagina si ricarica | /contatti · /en/contact |
| studio-documenti | indexedDB | sì | copia locale della modulistica scaricabile | ogni pagina |
| https://fonts.googleapis.com | terzo | no | foglio di stile del carattere tipografico | ogni pagina |
| https://fonts.gstatic.com | terzo | no | file del carattere tipografico | ogni pagina |
| https://www.google.com | terzo | no | mappa incorporata della sede | /contatti · /en/contact |

## Dati raccolti dai moduli pubblici

| modulo | campo | base giuridica | conservazione |
|---|---|---|---|
| /contatti | nome | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /contatti | email | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /contatti | pec_studio | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /contatti | telefono | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /en/contact | nome | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /en/contact | email | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /en/contact | pec_studio | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |
| /en/contact | telefono | misure precontrattuali richieste dall'interessato (art. 6.1.b) | 12 mesi |

## Voci di conformità e proprietà

| voce | proprietario | dove è dichiarato | esito |
|---|---|---|---|
| informativa-privacy | site-doctor | — | conforme |
| basi-giuridiche | site-doctor | — | conforme |
| cookie-archiviazione | site-doctor | — | conforme |
| consenso | site-doctor | — | conforme |
| accessibilita-pubblico | site-doctor | — | conforme |
| lingua-hreflang | site-doctor | — | conforme |
| favicon | site-doctor | — | conforme |
| open-graph | site-doctor | — | conforme |
| dati-strutturati | site-doctor | — | conforme |
| sitemap | site-doctor | — | conforme |
| robots | site-doctor | — | conforme |
| contrasti | speed-demon | docs/performance.md | delegato |
| canonical | speed-demon | docs/handoff/13-speed-demon.md | delegato |
| noindex-private | speed-demon | docs/handoff/13-speed-demon.md | delegato |
| accessibilita-admin | gestionale-crafter | docs/handoff/10-gestionale-crafter.md | delegato |
| antispam | — | — | scoperto |

## Deroghe

| voce | cosa resta | perché si pubblica lo stesso | chi lo ha deciso | rientro previsto |
|---|---|---|---|---|
| antispam | il modulo di contatto non ha né antispam né limiti di frequenza | è una vetrina di uno studio legale, non un percorso di pagamento: il danno di un abuso è la casella di posta piena, non un dato di terzi | Direzione lavori (per delega) | alla nascita di cyber-shield |

## Cosa questo certificato NON dice

- Che il sito sia **conforme al GDPR**: dice che l'informativa esiste, è
  raggiungibile, nomina le voci obbligatorie, e che ogni campo raccolto ha una
  base giuridica **scritta**. Non che sia quella giusta.
- Che il sito sia **accessibile**: dice quello che si vede nell'HTML servito. I
  contrasti li misura speed-demon con un browser; ordine di tabulazione, focus
  visibile, screen reader e messaggi d'errore non li misura nessuno dei due.
- Che la **superficie scoperta** sia tutta la superficie: si cammina dai
  collegamenti e dalla \`sitemap.xml\`. Una pagina che nessuno linka non entra.
- Che i **cookie misurati** siano tutti i cookie: si legge quello che il sito
  pone a un visitatore anonimo che non fa nulla.
- Che resti vero **domani**: è una fotografia di questa build a questa data. Si
  rilancia, o non vale.
`;
}

function docHandoffSiteDoctor() {
  return `# 15 — site-doctor

Passaggio di consegne verso **launchpad** (e verso cyber-shield, quando
esisterà). Contratto del \`CLAUDE.md\`: cosa ho fatto, cosa ho deciso, cosa mi
aspetto dal successivo, cosa lascio aperto.

## 1. Cosa ho fatto

- Camminata la superficie pubblica: **10 pagine**, da due sorgenti
  (collegamenti da \`/\` e \`sitemap.xml\`), su due lingue.
- Misurato: informativa privacy, campi dei moduli pubblici, cookie e
  archiviazione nel browser, origini di terzi, accessibilità dell'HTML servito,
  lingua e hreflang.
- Emesso \`docs/conformita.md\` — il **certificato di idoneità**, firmato per
  delega dichiarata (D14).
- Generate **due** pagine di informativa in bozza dal modello
  \`resources/templates/informativa-bozza.md\` — una per lingua, \`/privacy\` e
  \`/en/privacy\` — e il collegamento nel piè di pagina di ogni pagina della
  lingua corrispondente. I segnaposto sono stati sostituiti dal titolare del
  trattamento prima della firma: il gate rifiuta i segnaposto serviti, ed è il
  motivo per cui la bozza non è potuta diventare il documento definitivo per
  dimenticanza.

## 2. Decisioni prese, con la motivazione

| # | Decisione | Perché | Se è sbagliata |
|---|---|---|---|
| 1 | **Un'informativa per lingua**, non una sola in italiano linkata anche dalle pagine inglesi | il passo \`informativa-privacy\` pretende che **ogni** pagina pubblica ne raggiunga una, e un'informativa italiana su una pagina inglese è raggiungibile ma non leggibile da chi la legge | chi visita in inglese legge un documento nella lingua sbagliata: si torna a una sola informativa e si accetta il rilievo |
| 2 | Il contatore di visite interno è dichiarato **non essenziale**, quindi il sito ha un banner | è un'analitica, e le analitiche non servono a fornire il servizio richiesto (\`references/gdpr-e-cookie.md\` §5) | se fosse essenziale il banner sarebbe un danno, e il gate lo direbbe con un \`issue\` |
| 3 | Le tre origini di terzi (due dei font, una della mappa) sono dichiarate **non essenziali** | un font di un CDN e una mappa incorporata sono terzi come tutti gli altri, e cosa fanno nel browser questo gate non lo può misurare | nessuna: dichiararle costa una riga e non dichiararle è un bloccante |
| 4 | \`antispam\` resta **scoperto** con una deroga motivata, non delegato | cyber-shield non esiste, e delegare a una skill che non c'è è il difetto dell'Open Graph rifatto | il modulo resta senza difese: la deroga dichiara il rientro alla nascita di cyber-shield |

## 3. Il perimetro: chi guarda cosa

La tabella completa sta in \`docs/conformita.md\` §Voci di conformità e proprietà.
Qui il riassunto che serve a chi viene dopo:

- **Mie e misurate:** informativa privacy, basi giuridiche, cookie e
  archiviazione, consenso, accessibilità del sito pubblico, lingua e hreflang.
- **Mie e misurate, dal 2026-08-06 (D21):** favicon, Open Graph, dati
  strutturati, \`sitemap.xml\`, \`robots.txt\`. Erano delegate a speed-demon, e una
  misura ha trovato che il suo gate non le guarda: la proprieta' segue la
  misura, non l'argomento.
- **Delegate, con il file che le dichiara:** canonical e noindex → speed-demon
  (\`docs/handoff/13-speed-demon.md\`), e il suo passo \`seo-meta\` le legge
  davvero sull'HTML servito; contrasti → speed-demon (\`docs/performance.md\`,
  che ne dichiara la soglia) — delega ancora VUOTA e segnalata a ogni giro;
  accessibilità dell'area amministrativa → gestionale-crafter
  (\`docs/handoff/10-gestionale-crafter.md\`), dichiarata «sui sorgenti».
- **SCOPERTE — nessuno le guarda:** antispam e limiti di frequenza sul modulo di
  contatto: sarebbero di cyber-shield, che non esiste.

Una voce scoperta non è un residuo minore: è una cosa che nessuno ha guardato e
che qualcuno leggendo questo documento potrebbe credere guardata. È scritta qui
per quello.

## 4. Cosa il sito mette nel browser di chi passa

| chiave | tipo | essenziale | dove è stata misurata |
|---|---|---|---|
| sl_sessione | cookie | sì | \`Set-Cookie\` sulla risposta di tutte e 10 le pagine |
| studio_consenso | document.cookie | sì | script inline di ogni pagina |
| studio:lingua | localStorage | sì | \`/_next/static/chunks/main-app.js\` |
| studio:analitica | localStorage | no | \`/_next/static/chunks/main-app.js\` |
| studio:bozza-contatto | sessionStorage | sì | \`/_next/static/chunks/contatti.js\` |
| studio-documenti | indexedDB | sì | \`/_next/static/chunks/main-app.js\` |

Origini di terzi: \`https://fonts.googleapis.com\`, \`https://fonts.gstatic.com\`,
\`https://www.google.com\`. Un terzo non dichiarato è un bloccante, perché quello
che fa nel browser questo gate non lo può misurare.

## 5. Cosa si aspetta chi viene dopo

**Launchpad** — non pubblicare senza \`docs/conformita.md\` firmato e con la riga
\`Gate: VERDE\`. Il certificato è il tuo ingresso.

**Cyber-shield** (quando esisterà) — i percorsi di scrittura pubblici misurati
sono: \`/contatti\` e \`/en/contact\`. Antispam e limiti di frequenza sono
dichiarati **scoperti**.

**Vetrina-crafter / gestionale-crafter** — le richieste aperte sono al §6: sono
richieste, non correzioni fatte di nascosto nel vostro codice.

## 6. Richieste ai vicini

| a chi | cosa | perché |
|---|---|---|
| vetrina-crafter | due pagine sembrano un'informativa (\`/privacy\` e \`/en/privacy\`) e il gate non può decidere quale sia quella «buona»: è corretto così su un sito bilingue, ma se un giorno una delle due sparisse il rilievo resterebbe identico | è un \`issue\`, non un bloccante: lo segnalo perché chi legge sappia che il gate ha visto due candidati e ne ha scelto uno |

## 7. Problemi noti e residui

| # | Cosa | Gravità | Dove è scritto |
|---|---|---|---|
| 1 | antispam e limiti di frequenza sul modulo di contatto: nessuno li guarda | alta | \`docs/DEBITO-TECNICO.md\` n°1, e §Deroghe del certificato |
| 2 | il contatore di visite si attiva dopo il consenso, ma **che lo faccia davvero** questo gate non lo misura: legge un anonimo che non fa nulla | media | qui, e \`SKILL.md\` §Cosa un gate verde NON prova |

## 8. Guardiani

- \`code-maniac scan\`: non eseguito su questo banco — è un sito statico di
  collaudo, non un progetto Next: **MANCANTE**, non pulito.
- \`/code-inquisition --focus security,reliability\`: non eseguito su questo banco
  — **MANCANTE**.
- I gate dei vicini sulla stessa build: non applicabile, il banco non ha i loro
  progetti. Su un progetto vero questa riga va compilata, e un certificato di
  idoneità firmato sopra un gate rosso a monte è una firma su un'altra cosa.

## 9. Verdetto del gate

Il gate di site-doctor su questa esecuzione: **9 passi**, 0 falliti,
0 verifiche mancanti, 0 non applicabili.

Gate: VERDE
`;
}

// ─────────────────────────────────────────────────────────── generazione ────

function scrivi(dir, rel, contenuto) {
  const percorso = join(dir, rel);
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, contenuto, "utf8");
}

export function genera({ dir, porta, conInformativa }) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  ALTERNATE = [
    ["it", "/"],
    ["en", "/en"],
  ];

  const it = corpiIt();
  const en = corpiEn();

  const pagine = {};
  for (const [percorso, p] of Object.entries(it)) {
    ALTERNATE = [
      ["it", percorso],
      ["en", GEMELLO_EN[percorso]],
    ];
    pagine[percorso] = pagina({
      lang: "it",
      percorso,
      titolo: p.titolo,
      porta,
      corpo: p.corpo,
      conInformativa,
      scriptExtra:
        percorso === "/contatti" ? '  <script src="/_next/static/chunks/contatti.js"></script>' : "",
    });
  }
  for (const [percorso, p] of Object.entries(en)) {
    ALTERNATE = [
      ["it", GEMELLO_IT[percorso]],
      ["en", percorso],
    ];
    pagine[percorso] = pagina({
      lang: "en",
      percorso,
      titolo: p.titolo,
      porta,
      corpo: p.corpo,
      conInformativa,
      scriptExtra:
        percorso === "/en/contact" ? '  <script src="/_next/static/chunks/contatti.js"></script>' : "",
    });
  }

  for (const [percorso, html] of Object.entries(pagine)) {
    scrivi(dir, join("sito", nomeFile(percorso)), html);
  }

  // sitemap: dichiara solo le pagine che esistono davvero
  const elenco = Object.keys(pagine).concat(conInformativa ? ["/privacy", "/en/privacy"] : []);
  scrivi(
    dir,
    "sito/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${elenco.map((p) => `  <url><loc>${base(porta)}${p}</loc></url>`).join("\n")}
</urlset>
`
  );
  scrivi(dir, "sito/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base(porta)}/sitemap.xml\n`);
  scrivi(dir, "sito/logo.svg", LOGO);
  scrivi(dir, "sito/favicon.svg", FAVICON);

  // .next: BUILD_ID e gli asset serviti byte per byte dalla stessa fonte
  scrivi(dir, ".next/BUILD_ID", BUILD_ID);
  scrivi(dir, ".next/static/chunks/main-app.js", BUNDLE_MAIN);
  scrivi(dir, ".next/static/chunks/contatti.js", BUNDLE_CONTATTI);
  scrivi(dir, `.next/static/${BUILD_ID}/_buildManifest.js`, BUNDLE_MANIFEST);
  scrivi(dir, ".next/static/css/stile.css", STILE);

  // i documenti che il perimetro legge
  scrivi(dir, "docs/PROGETTO.md", docProgetto());
  scrivi(dir, "docs/vetrina.md", docVetrina());
  scrivi(dir, "docs/gestionale.md", docGestionale());
  scrivi(dir, "docs/flussi-critici.md", docFlussi());
  scrivi(dir, "docs/performance.md", docPerformance());
  scrivi(dir, "docs/DEBITO-TECNICO.md", docDebito());
  scrivi(dir, "docs/handoff/13-speed-demon.md", docHandoffSpeedDemon());
  scrivi(dir, "docs/handoff/10-gestionale-crafter.md", docHandoffGestionale());
  // I due documenti che il gate esige e che fino a oggi vivevano solo sul
  // disco di chi aveva collaudato. Senza, `--servi` li cancellava e il banco
  // conforme usciva ROSSO 3+3 su un clone pulito.
  scrivi(dir, "docs/conformita.md", docCertificato(porta));
  scrivi(dir, "docs/handoff/15-site-doctor.md", docHandoffSiteDoctor());
  scrivi(dir, "package.json", JSON.stringify({ name: "studio-legale-bertani", private: true }, null, 2) + "\n");

  return { pagine: Object.keys(pagine), buildId: BUILD_ID };
}

function nomeFile(percorso) {
  if (percorso === "/") return "index.html";
  return `${percorso.slice(1).replace(/\//g, "__")}.html`;
}

// ────────────────────────────────────────────────────────────── il server ────

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function estensione(p) {
  const i = p.lastIndexOf(".");
  return i < 0 ? "" : p.slice(i);
}

/**
 * `--ritardo <ms>` e `/__banco/conteggio` esistono per una misura sola: il
 * DEFAULT di `--scadenza`. Un numero tondo scelto a tavolino sarebbe la premessa
 * non contata che questa casa si ritrova addosso ogni volta; qui la pendenza si
 * misura — quante richieste fa un giro, e quanto costa ognuna quando la rete
 * non e' il disco locale. Il contatore NON conta se stesso, e il percorso non e'
 * linkato da nessuna pagina: non puo' entrare nella camminata e falsarla.
 */
export function servi({ dir, porta, sabota, ritardo = 0 }) {
  const trasforma = sabota ? SABOTAGGI[sabota] : null;
  if (sabota && !trasforma) throw new Error(`classe di sabotaggio sconosciuta: ${sabota}`);

  let richieste = 0;
  const server = createServer((req, res) => {
    if (req.url === "/__banco/conteggio") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ richieste }));
    }
    richieste += 1;
    if (ritardo > 0) {
      const originale = res.writeHead.bind(res);
      const scrivi = res.end.bind(res);
      let attesa = null;
      res.writeHead = (...a) => { attesa = a; return res; };
      res.end = (...a) => { setTimeout(() => { if (attesa) originale(...attesa); scrivi(...a); }, ritardo); return res; };
    }
    return gestisci(req, res);
  });

  function gestisci(req, res) {
    // Il marchio della premessa: chi misura deve poter provare CHE BANCO ha
    // risposto. Al primo giro un server rimasto acceso da prima teneva la
    // porta, i banchi sabotati non si legavano, e trentuno classi su
    // trentuno uscivano VERDE su un sito conforme.
    res.setHeader("x-banco-sabotaggio", sabota ?? "nessuno");
    const u = new URL(req.url, base(porta));
    let percorso = u.pathname;
    if (percorso.length > 1 && percorso.endsWith("/")) percorso = percorso.slice(0, -1);

    const ctx = { dir, porta, percorso, req, res, url: u };
    if (trasforma && trasforma.rotta && trasforma.rotta(ctx)) return;

    // asset di .next
    if (percorso.startsWith("/_next/static/")) {
      const f = join(dir, ".next", percorso.slice("/_next/".length));
      return consegna(res, f, ctx, trasforma);
    }
    if (percorso === "/sitemap.xml" || percorso === "/robots.txt" || percorso === "/logo.svg" || percorso === "/favicon.svg") {
      return consegna(res, join(dir, "sito", percorso.slice(1)), ctx, trasforma);
    }

    const f = join(dir, "sito", nomeFile(percorso));
    if (!existsSync(f)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      return res.end("<!DOCTYPE html><html lang=\"it\"><head><title>Non trovata</title></head><body><main><h1>Pagina non trovata</h1></main></body></html>");
    }
    return consegna(res, f, ctx, trasforma);
  }

  server.listen(porta, "127.0.0.1", () => {
    process.stdout.write(`banco studio legale su ${base(porta)}${sabota ? ` — sabotaggio ${sabota}` : ""}\n`);
  });
  return server;
}

function consegna(res, file, ctx, trasforma) {
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("non trovato");
  }
  let corpo = readFileSync(file);
  const ext = estensione(file);
  const intestazioni = { "content-type": TIPI[ext] || "application/octet-stream" };

  // Il Set-Cookie vero: sul DOCUMENTO, come lo pone una sessione server-side.
  if (ext === ".html") {
    intestazioni["set-cookie"] = [
      "sl_sessione=e3b0c44298fc1c14; Path=/; HttpOnly; SameSite=Lax",
    ];
  }

  if (trasforma && trasforma.corpo) {
    const cambiato = trasforma.corpo({ ...ctx, file, ext, corpo: corpo.toString("utf8"), intestazioni });
    if (typeof cambiato === "string") corpo = Buffer.from(cambiato, "utf8");
  }

  res.writeHead(200, intestazioni);
  res.end(corpo);
}

// I sabotaggi si registrano qui: ognuno tocca UNA cosa sola.
// `rotta(ctx)` intercetta prima di leggere il file (torna true se ha risposto).
// `corpo(ctx)` riscrive il corpo servito.

const soloHtml = (f) => ({ corpo: (ctx) => (ctx.ext === ".html" ? f(ctx) : undefined) });

/** Inserisce del markup dentro il <main> della pagina indicata. */
function dentroMain(corpo, aggiunta) {
  return corpo.replace("  <main>\n", `  <main>\n${aggiunta}\n`);
}

export const SABOTAGGI = {
  // ─────────────────────────────────── parsing HTML ostile (fase 4) ────
  // Il tribunale aveva trovato la chiave universale: `<!--` dentro un
  // attributo. Il costruttore ha elencato le forme che NON aveva provato.
  // Eccole, una per classe, ognuna nasconde la STESSA cosa: un'immagine
  // senza `alt` e un campo che raccoglie un dato personale.
  HTM1: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <script>var chiusura = "</div>"; var altro = "<img src=x>";</script>
      <img src="/logo.svg">
      <form action="/x"><label for="h1">Telefono</label><input id="h1" name="telefono" autocomplete="tel"></form>`),
  ),
  HTM2: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <![CDATA[
      <img src="/logo.svg">
      ]]>
      <img src="/favicon.svg">`),
  ),
  HTM3: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <label for="esempio">Esempio di markup</label>
      <textarea id="esempio" rows="3">&lt;img src="/logo.svg"&gt;</textarea>
      <textarea id="crudo" rows="3"><img src="/logo.svg"><input name="telefono" autocomplete="tel"></textarea>
      <label for="crudo">Markup crudo</label>`),
  ),
  HTM4: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <div data-nota="apertura mai chiusa>
      <img src="/logo.svg">
      <form action="/x"><label for="t4">Telefono</label><input id="t4" name="telefono" autocomplete="tel"></form>
      </div>`),
  ),
  HTM5: soloHtml(({ percorso, corpo }) => {
    if (percorso !== "/") return corpo;
    const conSottoinsieme = corpo.replace(
      "<!DOCTYPE html>",
      `<!DOCTYPE html [\n  <!ENTITY nota "<img src='/logo.svg'>">\n  <!-- questo commento sta DENTRO il sottoinsieme interno -->\n]>`,
    );
    return dentroMain(conSottoinsieme, `      <img src="/logo.svg">`);
  }),
  HTM6: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <svg width="100" height="100" role="img" aria-label="diagramma">
        <foreignObject width="100" height="100">
          <img src="/logo.svg">
          <input name="telefono" autocomplete="tel">
        </foreignObject>
      </svg>`),
  ),
  HTM7: {
    corpo: ({ ext, percorso, corpo, intestazioni }) => {
      if (ext !== ".html" || percorso !== "/") return undefined;
      intestazioni["content-type"] = "application/xhtml+xml; charset=utf-8";
      return dentroMain(corpo, `      <img src="/logo.svg"/>`);
    },
  },
  // La chiave universale nuova: UNA chiusura orfana, e il gate perde il resto
  // del documento. Piantata sulle due pagine che hanno i moduli: il passo
  // `dati-raccolti` deve uscire NON APPLICABILE — «zero moduli e zero campi» —
  // su un sito che raccoglie nome, email e telefono.
  HTM9: soloHtml(({ percorso, corpo }) =>
    percorso !== "/contatti" && percorso !== "/en/contact" ? corpo : dentroMain(corpo, "      </script>"),
  ),
  HTM8: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <script>
        /* qui sotto c'e' scritto </script> dentro un commento */
        window.__x = 1;
      </script>
      <img src="/logo.svg">`),
  ),

  // ───────────────────────────────────────── lingua e hreflang ────
  HRE1: soloHtml(({ percorso, corpo }) =>
    // it→en resta, en→it sparisce: reciprocita' rotta
    percorso.startsWith("/en") ? corpo.replace(/\n\s*<link rel="alternate" hreflang="it"[^>]*>/g, "") : corpo,
  ),
  HRE2: soloHtml(({ corpo }) => corpo.replace(/hreflang="x-default" href="[^"]*"/g, 'hreflang="x-default" href="http://127.0.0.1:3882/non-esiste"')),
  HRE3: soloHtml(({ corpo }) => corpo.replace(/(<link rel="alternate" hreflang="en" href=")[^"]*(")/g, "$1http://127.0.0.1:3882/$2")),
  HRE4: {
    corpo: ({ ext, corpo, intestazioni, percorso }) => {
      if (ext !== ".html") return undefined;
      intestazioni.link = `<http://127.0.0.1:3882/>; rel="alternate"; hreflang="it", <http://127.0.0.1:3882/en>; rel="alternate"; hreflang="en"`;
      return corpo.replace(/\n\s*<link rel="alternate"[^>]*>/g, "") + `<!-- ${percorso} -->`;
    },
  },
  HRE5: soloHtml(({ corpo }) => corpo.replace(/\n\s*<link rel="alternate"[^>]*>/g, "")),

  // ──────────────────────────────────────────── accessibilita' ────
  A11Y1: soloHtml(({ percorso, corpo }) => (percorso !== "/" ? corpo : dentroMain(corpo, `      <img src="/logo.svg" alt="">`))),
  A11Y2: soloHtml(({ percorso, corpo }) =>
    percorso !== "/contatti" ? corpo : corpo.replace('<label for="messaggio">', '<label for="questo-id-non-esiste">'),
  ),
  A11Y3: soloHtml(({ percorso, corpo }) => (percorso !== "/" ? corpo : dentroMain(corpo, `      <a href="/chi-siamo" aria-label="   "><span></span></a>`))),
  A11Y4: soloHtml(({ percorso, corpo }) => (percorso !== "/" ? corpo : corpo.replace("<h2>Come lavoriamo</h2>", "<h4>Come lavoriamo</h4>").replace("<h3>Tempi di risposta</h3>", "<h5>Tempi di risposta</h5>"))),
  A11Y5: soloHtml(({ percorso, corpo }) => (percorso !== "/" ? corpo : corpo.replace('<html lang="it">', '<html lang="de">'))),
  A11Y6: soloHtml(({ percorso, corpo }) => (percorso !== "/" ? corpo : corpo.replace("</main>", "</main>\n  <main><h2>Secondo main</h2></main>"))),

  // ──────────────────────────────────── dati raccolti / moduli ────
  DAT1: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <h2>Richiesta rapida</h2>
      <form action="/richiesta" method="post">
        <label for="d1">Il tuo numero di telefono</label>
        <input id="d1" name="tel" type="text">
        <label for="d2">Indirizzo di residenza</label>
        <textarea id="d2" name="residenza"></textarea>
        <label for="d3">Carica un documento d'identita'</label>
        <input id="d3" name="documento" type="file">
        <label for="d4">Data di nascita</label>
        <input id="d4" name="nascita" type="date">
        <button type="submit">Invia</button>
      </form>`),
  ),
  DAT3: soloHtml(({ percorso, corpo }) =>
    percorso !== "/contatti" ? corpo : corpo.replace('action="/contatti"', 'action="https://moduli.esempio.com/raccogli"'),
  ),

  // ───────────────────────────────────────────── archiviazione ────
  ARC3: {
    corpo: ({ ext, intestazioni }) => {
      // Set-Cookie NON sul documento ma su una sottorisorsa (il bundle).
      if (ext === ".html") delete intestazioni["set-cookie"];
      if (ext === ".js") intestazioni["set-cookie"] = ["traccia_bundle=1; Path=/; SameSite=Lax"];
      return undefined;
    },
  },
  ARC1: {
    corpo: ({ file, corpo }) =>
      file.endsWith("main-app.js")
        ? corpo.replace('window.localStorage.setItem("studio:lingua", lingua)', 'window["local" + "Storage"].setItem("studio:lingua", lingua)')
        : undefined,
  },

  // ───────────────────────────────────────────────── superficie ────
  SUP1: soloHtml(({ percorso, corpo }) =>
    percorso !== "/" ? corpo : dentroMain(corpo, `      <h2>Richiamo immediato</h2>
      <form action="/richiamo" method="post">
        <label for="s1">Il suo telefono</label>
        <input id="s1" name="telefono" autocomplete="tel">
        <button type="submit">Richiamatemi</button>
      </form>`),
  ),
  SUP2: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/chi-siamo") return false;
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html lang=\"it\"><head><title>404</title></head><body><main><h1>Non trovata</h1></main></body></html>");
      return true;
    },
  },
  /**
   * Il sito del perito della superficie (P7-R2): una pagina che raccoglie IBAN
   * e codice fiscale, raggiungibile SOLO via `<iframe src>`, senza rimando
   * all'informativa e non dichiarata nel certificato. Prima di P.6-P5 il gate
   * usciva VERDE con uscita 0: la camminata leggeva solo gli `<a href>`.
   * Atteso ora: `dati-raccolti` FAIL (raccoglie e non rimanda a nessuna
   * informativa, campi non dichiarati), piu' perimetro e contratto-uscita.
   */
  SUP5: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/patrimonio") return false;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html lang="it"><head><title>Situazione patrimoniale</title></head><body><main>
      <h1>Situazione patrimoniale</h1>
      <form action="/patrimonio" method="post">
        <label for="p1">IBAN</label><input id="p1" name="iban" type="text">
        <label for="p2">Codice fiscale</label><input id="p2" name="codice_fiscale" type="text">
        <button type="submit">Invia</button>
      </form>
      </main></body></html>`);
      return true;
    },
    corpo: ({ ext, percorso, corpo }) =>
      ext !== ".html" || percorso !== "/contatti"
        ? undefined
        : dentroMain(corpo, `      <h2>Situazione patrimoniale</h2>
      <iframe title="Situazione patrimoniale" src="/patrimonio" width="600" height="400"></iframe>`),
  },
  SUP3: {
    rotta: ({ percorso, res, porta }) => {
      if (percorso === "/vecchia-campagna") { res.writeHead(302, { location: "/campagna" }); res.end(); return true; }
      if (percorso === "/campagna") { res.writeHead(302, { location: `http://127.0.0.1:${porta}/chi-siamo` }); res.end(); return true; }
      return false;
    },
    corpo: ({ ext, percorso, corpo }) =>
      ext !== ".html" || percorso !== "/" ? undefined : dentroMain(corpo, `      <p><a href="/vecchia-campagna">La campagna 2025</a></p>`),
  },

  // ──────────────────────────────────────────────── informativa ────
  INF1: soloHtml(({ corpo }) => corpo.replace(/<li><a href="(\/(?:en\/)?privacy)">/g, '<li style="display:none"><a href="$1">')),
  INF4: soloHtml(({ corpo }) => corpo.replace(/<a href="(\/(?:en\/)?privacy)">/g, '<a href="mailto:privacy@studiobertani.it">')),
  INF5: {
    corpo: ({ ext, percorso, corpo }) =>
      ext !== ".html" || percorso !== "/privacy"
        ? undefined
        : corpo.replace(/ {2}<main>[\s\S]*? {2}<\/main>/, "  <main>\n      <h1>Informativa sul trattamento dei dati personali</h1>\n      <p>In aggiornamento.</p>\n  </main>"),
  },

  // ───────────────────────────────────────────────────────── rete ────
  NET1: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/lento") return false;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.write("<!DOCTYPE html><html lang=\"it\"><head><title>");
      // un byte al secondo, e non chiude mai
      const t = setInterval(() => { try { res.write("."); } catch { clearInterval(t); } }, 1000);
      res.on("close", () => clearInterval(t));
      return true;
    },
    corpo: ({ ext, percorso, corpo }) =>
      ext !== ".html" || percorso !== "/" ? undefined : dentroMain(corpo, `      <p><a href="/lento">Pagina lenta</a></p>`),
  },
  NET2: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/enorme") return false;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.write("<!DOCTYPE html><html lang=\"it\"><head><title>Enorme</title></head><body><main><h1>Enorme</h1><p>");
      const pezzo = "a".repeat(1024 * 1024);
      let n = 0;
      const scrivi = () => {
        while (n < 900) {
          n += 1;
          if (!res.write(pezzo)) { res.once("drain", scrivi); return; }
        }
        res.end("</p></main></body></html>");
      };
      scrivi();
      return true;
    },
    corpo: ({ ext, percorso, corpo }) =>
      ext !== ".html" || percorso !== "/" ? undefined : dentroMain(corpo, `      <p><a href="/enorme">Allegati</a></p>`),
  },

  // ───────────────────── le cinque voci tornate a casa (D21) ────
  // Due forme per voce. La prima e' sempre IL DICHIARATO CHE MENTE: il markup
  // servito promette una risorsa e il server ne consegna un'altra, o nessuna.
  // La seconda e' l'ASSENZA. Un gate che confondesse le due sarebbe un gate che
  // legge un elenco invece della superficie.

  /** Il difetto del pilota, in due righe: il `<link>` c'e', la risorsa no. */
  FAV1: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/favicon.svg") return false;
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("non trovata");
      return true;
    },
  },
  FAV2: soloHtml(({ corpo }) => corpo.replace(/ *<link rel="icon"[^>]*>\n/g, "")),

  OG1: soloHtml(({ corpo }) => corpo.replace(/ *<meta property="og:[^>]*>\n/g, "")),
  OG2: soloHtml(({ corpo }) =>
    corpo.replace(/(<meta property="og:image" content=")[^"]*(")/, "$1/anteprima-che-non-esiste.png$2"),
  ),

  LD1: soloHtml(({ corpo }) => corpo.replace(/ *<script type="application\/ld\+json">[\s\S]*?<\/script>\n/g, "")),
  LD2: soloHtml(({ corpo }) =>
    corpo.replace(
      /(<script type="application\/ld\+json">\n)[\s\S]*?(\n *<\/script>)/,
      `$1{"@context":"https://schema.org","@type":"LegalService","name":"Studio Legale Bertani & Associati",}$2`,
    ),
  ),

  SMP1: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/sitemap.xml") return false;
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("non trovata");
      return true;
    },
  },
  /** 200, ma dentro c'e' la pagina di errore del framework: XML promesso, HTML servito. */
  SMP2: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/sitemap.xml") return false;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html lang=\"it\"><head><title>Sitemap</title></head><body><main><h1>Sitemap</h1><p>Non ancora generata.</p></main></body></html>");
      return true;
    },
  },

  ROB1: {
    rotta: ({ percorso, res }) => {
      if (percorso !== "/robots.txt") return false;
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("non trovato");
      return true;
    },
  },
  /**
   * Il `robots.txt` che vieta cio' che la `sitemap.xml` pubblicizza: due file
   * scritti dallo stesso agente, che fino a oggi nessun gate della casa
   * confrontava (collaudo P2 §5, «l'inverso: cosa nessun gate misura»). Con D21
   * sono tutti e due miei, e il confronto e' finalmente di qualcuno.
   */
  ROB2: {
    rotta: ({ percorso, res, porta }) => {
      if (percorso !== "/robots.txt") return false;
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(`User-agent: *\nDisallow: /\nSitemap: ${base(porta)}/sitemap.xml\n`);
      return true;
    },
  },
};

// ─────────────────────────────────────────────────────────────── epilogo ────

const questoFile = new URL(import.meta.url).pathname;
const invocato = process.argv[1] ? new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).pathname : "";
const eseguitoDirettamente = (() => {
  try {
    const a = decodeURIComponent(questoFile).replace(/^\/([A-Za-z]:)/, "$1");
    const b = decodeURIComponent(invocato).replace(/^\/([A-Za-z]:)/, "$1");
    return a.toLowerCase() === b.toLowerCase();
  } catch {
    return false;
  }
})();

if (eseguitoDirettamente) {
  const a = argomenti(process.argv.slice(2));
  if (a.elenco) {
    for (const [k, v] of Object.entries(CLASSI)) process.stdout.write(`${k}\t${v}\n`);
  } else {
    if (!a.dir) throw new Error("serve --dir");
    if (!a.sabota) {
      const esito = genera({ dir: a.dir, porta: a.porta, conInformativa: a.conInformativa });
      process.stdout.write(`generato: ${esito.pagine.length} pagine · build ${esito.buildId}\n`);
    }
    if (a.servi) servi({ dir: a.dir, porta: a.porta, sabota: a.sabota, ritardo: a.ritardo });
  }
}
