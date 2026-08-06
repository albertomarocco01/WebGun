/**
 * servito-lib.mjs — Le regole di Site Doctor sull'APP SERVITA.
 *
 * Funzioni pure: entrano stringhe (HTML, XML, testo di un bundle) ed esce
 * struttura o findings. Nessun I/O, nessuna rete, nessun file: il guscio
 * `verify.mjs` scarica, queste funzioni giudicano. Il motivo e' quello di
 * schema-forge, gestionale-crafter e vetrina-crafter — una regola che si puo'
 * eseguire solo con un sito costruito e servito davanti e' una regola che puo'
 * restare spenta per mesi senza che nessuno lo sappia.
 *
 * GRAVITA': `block` fa fallire il passo, `issue` e `warn` si stampano.
 */

// --------------------------------------------------------------- findings
export const dettaglioFindings = (findings) =>
  findings.map((f) => `  [${f.severity}] ${f.object}: ${f.message}`).join("\n");

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

/** Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano. */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

/**
 * La QUARTA risposta, e il suo prezzo.
 *
 * `NON APPLICABILE` non e' un'uscita di comodo: la premessa arriva qui come
 * argomento, e senza premessa si torna a MANCANTE — che tiene il gate rosso.
 * Un sito monolingua non ha hreflang e dirlo `pass` sarebbe una bugia comoda;
 * ma «non ho trovato niente» senza aver detto DOVE ho guardato e' esattamente
 * il falso verde che la §18 di DECISIONI.md vieta.
 */
export function statoNonApplicabile(premessa) {
  return premessa && String(premessa).trim().length > 0 ? "n/a" : "skipped";
}

// ------------------------------------------------------ pulizia del documento
/**
 * L'HTML senza il CORPO di `<script>` e `<style>` e senza commenti — ma con i
 * tag di apertura intatti.
 *
 * Togliere il corpo NON e' un dettaglio di igiene: su Next in App Router il
 * carico RSC viaggia dentro `<script>self.__next_f.push(...)` e contiene
 * l'albero serializzato — `["$","h1",null,{...}]`, `["$","img",null,{...}]`.
 * Misurato sul pilota il 2026-08-06: la pagina `not-found` mostra UN `h1` e nel
 * carico ce n'e' un secondo. Contare i tag senza ripulire vuol dire leggere due
 * volte lo stesso documento — una nel DOM e una nella sua fotocopia.
 *
 * Tenere il tag di apertura invece e' la correzione di un difetto misurato col
 * sabotaggio, classe H: la prima versione cancellava `<script …>` per intero, e
 * `terziDi` — che cerca proprio gli `src` di terzi — girava su un documento in
 * cui gli script non c'erano piu'. Il passo chiudeva «zero terzi» dopo aver
 * guardato un documento da cui i terzi erano stati tolti da noi.
 */
export function senzaScript(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, "<script$1></script>")
    .replace(/<style\b([^>]*)>[\s\S]*?<\/style>/gi, "<style$1></style>")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

/**
 * Le pagine raggiungibili da `/` seguendo SOLO i collegamenti, sul grafo gia'
 * scaricato. Non fa richieste: cammina quello che il gate ha gia' letto.
 *
 * Esiste perche' la prima versione confondeva due insiemi: la camminata partiva
 * anche dalle pagine della sitemap, quindi i collegamenti TROVATI SU QUELLE
 * pagine rientravano fra «i collegamenti». Con la sitemap come seme, la
 * sorgente «collegamenti» non era piu' indipendente — e il sabotaggio di classe
 * X (home senza collegamenti, sitemap intera) usciva verde sul passo che esiste
 * apposta per vederlo. Le due sorgenti servono a controllarsi a vicenda: se una
 * alimenta l'altra, ce n'e' una sola.
 */
export function raggiungibiliDaCollegamenti(grafo, partenza = "/") {
  const viste = new Set();
  const coda = [partenza];
  while (coda.length > 0) {
    const p = coda.shift();
    if (viste.has(p) || !grafo.has(p)) continue;
    viste.add(p);
    for (const q of grafo.get(p)) if (!viste.has(q)) coda.push(q);
  }
  return [...viste].sort();
}

/** Solo il testo visibile: tag via, entita' principali sciolte, spazi compressi. */
export function testoVisibile(html) {
  return senzaScript(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RE_ATTRIBUTO = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/**
 * Gli attributi di un tag, con il NOME IN MINUSCOLO.
 *
 * La minuscola non e' cosmesi. React serializza `autoComplete` cosi' com'e':
 * nell'HTML servito dal pilota si legge `autoComplete="tel"`, non
 * `autocomplete="tel"`. Un confronto sensibile alle maiuscole avrebbe mancato
 * il segnale piu' forte che esista per riconoscere un campo di dato personale,
 * e il passo `dati-raccolti` sarebbe uscito verde su un modulo che raccoglie
 * nome e telefono. In HTML i nomi degli attributi non distinguono le maiuscole:
 * qui si fa la stessa cosa.
 */
export function attributi(tag) {
  const dentro = tag.replace(/^<[a-zA-Z0-9-]+/, "").replace(/\/?>$/, "");
  const mappa = {};
  let m;
  RE_ATTRIBUTO.lastIndex = 0;
  while ((m = RE_ATTRIBUTO.exec(dentro)) !== null) {
    const nome = m[1].toLowerCase();
    if (nome in mappa) continue;
    mappa[nome] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return mappa;
}

/**
 * I metacaratteri di un frammento che finisce dentro una `RegExp`.
 *
 * Oggi `nome` ed `etichetta` sono sempre stringhe letterali scritte qui dentro
 * (`"a"`, `"img"`, `"Confermato da"`), quindi il rilievo di semgrep
 * `detect-non-literal-regexp` non e' sfruttabile. Ma sono funzioni **esportate**,
 * e la distanza fra «oggi nessuno ci passa niente da fuori» e «qualcuno ci passa
 * un pezzo di HTML servito» e' una riga di codice scritta fra sei mesi. Chiuderlo
 * adesso costa una funzione di quattro caratteri; discuterne no.
 */
export const perRegexp = (frammento) => String(frammento).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Tutti i tag di apertura di un nome, sul documento gia' ripulito. */
export function tagDi(htmlPulito, nome) {
  const re = new RegExp(`<${perRegexp(nome)}\\b[^>]*>`, "gi");
  return htmlPulito.match(re) ?? [];
}

/** Elementi con il loro contenuto: `[{ tag, dentro }]`. Non per tag annidabili. */
export function elementiDi(htmlPulito, nome) {
  const re = new RegExp(`<(${perRegexp(nome)})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, "gi");
  const trovati = [];
  let m;
  while ((m = re.exec(htmlPulito)) !== null) trovati.push({ tag: `<${m[1]}${m[2]}>`, dentro: m[3] });
  return trovati;
}

// ------------------------------------------------------------------ superficie
/** Il percorso normalizzato di un URL, oppure `null` se non e' della stessa origine. */
export function percorsoInterno(href, base) {
  if (!href || typeof href !== "string") return null;
  const pulito = href.trim();
  if (pulito === "" || pulito.startsWith("#")) return null;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(pulito)) return null;
  let url;
  try {
    url = new URL(pulito, base);
  } catch {
    return null;
  }
  const radice = new URL(base);
  if (url.host !== radice.host || url.protocol !== radice.protocol) return null;
  const percorso = url.pathname.replace(/\/+$/, "") || "/";
  // Query e frammento non fanno una pagina diversa ai fini della conformita':
  // l'informativa, i cookie e la lingua sono gli stessi.
  return percorso;
}

/** I percorsi interni raggiungibili dai collegamenti di una pagina. */
export function collegamentiInterni(html, base) {
  const pulito = senzaScript(html);
  const percorsi = new Set();
  for (const tag of tagDi(pulito, "a")) {
    const p = percorsoInterno(attributi(tag).href, base);
    if (p) percorsi.add(p);
  }
  return [...percorsi].sort();
}

/** I percorsi dichiarati da una `sitemap.xml`. Seconda sorgente, indipendente. */
export function percorsiDaSitemap(xml, base) {
  if (typeof xml !== "string") return [];
  const percorsi = new Set();
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const p = percorsoInterno(m[1], base);
    if (p) percorsi.add(p);
  }
  return [...percorsi].sort();
}

/**
 * Il `BUILD_ID` di questo progetto compare nell'HTML servito?
 *
 * Stessa domanda che si fa speed-demon, e per lo stesso incidente: il
 * 2026-07-30, su questa macchina, la porta che un contratto firmato dichiarava
 * serviva il sito di un'altra azienda. Un certificato di idoneita' emesso
 * misurando l'applicazione di qualcun altro e' peggio di nessun certificato.
 */
export const eLaMiaBuild = (html, buildId) =>
  typeof html === "string" && typeof buildId === "string" && buildId.length > 0 && html.includes(buildId);

/** Il primo asset statico della stessa origine referenziato dall'HTML servito. */
export function assetDaProvare(html, base) {
  const re = /(?:src|href)\s*=\s*"([^"]*\/_next\/static\/[^"?]+)/gi;
  let m;
  while ((m = re.exec(html ?? "")) !== null) {
    const p = percorsoInterno(m[1], base);
    if (p) return p;
  }
  return null;
}

/**
 * L'identita' dell'app, provata per DUE vie — e le tre diagnosi che ne escono.
 *
 * Il `BUILD_ID` da solo risponde «si'» oppure «no», e il «no» copre due fatti
 * molto diversi che meritano due frasi diverse. Misurato sul pilota il
 * 2026-08-06, mentre un'altra chat lavorava sullo stesso progetto: `next start`
 * era partito prima dell'ultima build, quindi teneva in memoria il build id
 * vecchio, mentre `.next/BUILD_ID` su disco era gia' quello nuovo. Il sito era
 * vivo, intero e funzionante — e il gate diceva «sta rispondendo un'altra
 * applicazione sulla stessa porta», additando l'imputato sbagliato. E' la
 * stessa classe del difetto n°1 del collaudo avversario di vetrina-crafter.
 *
 * La seconda via non dipende dal build id: si prende un asset statico che
 * l'HTML servito referenzia, lo si scarica e lo si confronta con il file
 * corrispondente sotto `.next/` di QUESTO progetto. Se combacia, chi risponde
 * sta servendo da questa cartella: e' questo progetto, punto. Se non combacia,
 * e' un'altra applicazione, e allora la frase dura e' quella giusta.
 *
 *   build id uguale                      → `pass`     misura pure
 *   build id diverso, asset identico     → `fail`     misura pure: e' questo
 *                                                     sito, un processo indietro
 *   build id diverso, asset diverso      → `fail`     NON misurare: e' un'altra app
 */
export function esitoIdentita({ buildIdCombacia, assetProvato, assetIdentico, buildId, url }) {
  if (buildIdCombacia) {
    return { stato: "pass", misurabile: true, diagnosi: `build id ${buildId} trovato nell'HTML servito` };
  }
  if (assetProvato && assetIdentico) {
    return {
      stato: "fail",
      misurabile: true,
      diagnosi:
        `il build id su disco (${buildId}) NON compare nell'HTML servito, ma l'asset \`${assetProvato}\` scaricato da ${url} e' identico byte per byte a quello sotto \`.next/\` di questo progetto.\n` +
        "  Diagnosi: e' QUESTO sito, servito da un processo partito PRIMA dell'ultima build — non un'altra applicazione. Riavvia `npm run start`.\n" +
        "  Le misure di conformita' si fanno lo stesso (il sito e' questo), ma il certificato NON e' emettibile: certificherebbe una build che non e' quella su disco.",
    };
  }
  return {
    stato: "fail",
    misurabile: false,
    diagnosi:
      `${url} risponde, ma NON e' l'app di questo progetto.\n  build id di questo progetto: ${buildId} — non compare nell'HTML servito\n` +
      (assetProvato
        ? `  e l'asset \`${assetProvato}\` servito da quell'indirizzo e' DIVERSO da quello su disco`
        : "  e nell'HTML servito non c'e' nessun asset statico da confrontare") +
      "\n  Sta rispondendo un'altra applicazione sulla stessa porta: certificarla vorrebbe dire firmare l'idoneita' del sito di qualcun altro.",
  };
}

/**
 * Due sorgenti indipendenti, e cosa succede quando divergono.
 *
 * La scoperta da collegamenti puo' fallire in silenzio: una home senza `<a>`,
 * un parser che sbaglia. Se l'unica sorgente fosse quella, «ho camminato il
 * sito e ho trovato una pagina» e «ho camminato il sito e le ho trovate tutte»
 * avrebbero lo stesso aspetto. La `sitemap.xml` non e' una verifica del sito:
 * e' un secondo testimone, e serve solo a impedire che il primo menta da solo.
 */
export function findingsSuperficie({ daCollegamenti, daSitemap, dichiarate, sitemapLetta }) {
  const findings = [];
  const collegate = new Set(daCollegamenti);
  const inSitemap = new Set(daSitemap);

  if (!sitemapLetta) {
    findings.push({
      severity: "issue",
      object: "sitemap.xml",
      message:
        "nessuna sitemap leggibile: la superficie ha una sola sorgente (i collegamenti). Una scansione che non trova niente e una che ha trovato tutto qui si assomigliano",
    });
  } else {
    for (const p of inSitemap) {
      if (!collegate.has(p)) {
        findings.push({
          severity: "issue",
          object: p,
          message: "dichiarata nella sitemap ma non raggiungibile seguendo i collegamenti del sito",
        });
      }
    }
    if (collegate.size <= 1 && inSitemap.size > 1) {
      findings.push({
        severity: "block",
        object: "superficie",
        message: `dai collegamenti e' emersa ${collegate.size} pagina, dalla sitemap ${inSitemap.size}: la camminata non ha camminato, e ogni passo a valle guarderebbe un sito che non e' questo`,
      });
    }
  }

  if (Array.isArray(dichiarate) && dichiarate.length > 0) {
    const dette = new Set(dichiarate);
    for (const p of [...collegate, ...inSitemap]) {
      if (!dette.has(p)) {
        findings.push({
          severity: "issue",
          object: p,
          message: "raggiungibile e non dichiarata nel certificato: e' una pagina in cui qualcuno puo' lasciare i propri dati senza che nessuno l'abbia guardata",
        });
      }
    }
    for (const p of dette) {
      if (!collegate.has(p) && !inSitemap.has(p)) {
        findings.push({ severity: "block", object: p, message: "dichiarata nel certificato e non raggiungibile" });
      }
    }
  }
  return findings;
}

// -------------------------------------------------------------- informativa
/** Un collegamento sembra puntare a un'informativa? Si guarda testo E indirizzo. */
const RE_INFORMATIVA = /(privacy|informativ|cookie|trattamento dei dati|protezione dei dati)/i;

/**
 * I candidati a «pagina dell'informativa», ricavati dai COLLEGAMENTI.
 *
 * Non da un elenco di percorsi indovinati (`/privacy`, `/cookie-policy`…): un
 * elenco di tentativi trova una pagina che nessuno raggiunge e manca
 * un'informativa che sta a `/note-legali/clienti`. Quello che conta per chi
 * visita e' il collegamento che la pagina gli mette davanti, ed e' quello che
 * si misura.
 */
export function candidatiInformativa(html, base) {
  const pulito = senzaScript(html);
  const trovati = new Map();
  for (const { tag, dentro } of elementiDi(pulito, "a")) {
    const attr = attributi(tag);
    const percorso = percorsoInterno(attr.href, base);
    if (!percorso) continue;
    const testo = `${testoVisibile(dentro)} ${attr["aria-label"] ?? ""} ${attr.title ?? ""}`.trim();
    if (RE_INFORMATIVA.test(testo) || RE_INFORMATIVA.test(percorso)) {
      if (!trovati.has(percorso)) trovati.set(percorso, testo);
    }
  }
  return [...trovati].map(([percorso, testo]) => ({ percorso, testo }));
}

/** Le voci che l'art. 13 pretende, e come si riconoscono in un testo italiano. */
export const VOCI_INFORMATIVA = Object.freeze([
  { id: "titolare", re: /titolare del trattamento|titolare dei dati/i, nome: "titolare del trattamento" },
  { id: "finalita", re: /finalit[aà]|per quali scopi|scopo del trattamento/i, nome: "finalità del trattamento" },
  { id: "base-giuridica", re: /base giuridica|fondamento giuridico|art\.?\s*6/i, nome: "base giuridica" },
  { id: "conservazione", re: /conservazione|per quanto tempo|periodo di conservazione/i, nome: "tempi di conservazione" },
  { id: "diritti", re: /diritti dell'interessato|diritto di accesso|cancellazione|rettifica/i, nome: "diritti dell'interessato" },
  { id: "reclamo", re: /reclamo|garante|autorit[aà] di controllo/i, nome: "diritto di reclamo al Garante" },
  { id: "destinatari", re: /destinatari|comunicazione a terzi|responsabil[ei] del trattamento/i, nome: "destinatari dei dati" },
]);

/** Segnaposto e riempitivi che non devono uscire in produzione. */
const RE_SEGNAPOSTO = /\{\{[^}]*\}\}|lorem ipsum|<da compilare>|\bTODO\b|xxxxx/i;

export function findingsInformativa({ pagine, informativa, htmlInformativa, dichiarata }) {
  const findings = [];
  const senza = pagine.filter((p) => p.candidati.length === 0);

  if (!informativa) {
    findings.push({
      severity: "block",
      object: "informativa privacy",
      message: `nessun collegamento a un'informativa su ${pagine.length} pagine pubbliche. Il sito raccoglie o puo' raccogliere dati, e chi visita non ha un posto dove leggere chi li tratta e perche'`,
    });
    return findings;
  }

  if (senza.length > 0) {
    findings.push({
      severity: "block",
      object: informativa.percorso,
      message: `raggiungibile da ${pagine.length - senza.length} pagine su ${pagine.length}: manca su ${senza.map((p) => p.percorso).join(", ")}. Un'informativa che si trova solo da alcune pagine non e' raggiungibile`,
    });
  }

  if (informativa.stato !== 200) {
    findings.push({
      severity: "block",
      object: informativa.percorso,
      message: `le pagine rimandano qui, e l'indirizzo risponde HTTP ${informativa.stato}: il collegamento c'e' e l'informativa no`,
    });
    return findings;
  }

  if (dichiarata && dichiarata !== informativa.percorso) {
    findings.push({
      severity: "issue",
      object: informativa.percorso,
      message: `il certificato dichiara l'informativa in ${dichiarata}, le pagine rimandano qui`,
    });
  }

  const testo = testoVisibile(htmlInformativa ?? "");
  if (RE_SEGNAPOSTO.test(testo)) {
    findings.push({
      severity: "block",
      object: informativa.percorso,
      message: "l'informativa servita contiene ancora un segnaposto o un riempitivo: e' il documento che dice chi risponde dei dati, e sta andando online mezzo vuoto",
    });
  }
  if (testo.length < 400) {
    findings.push({
      severity: "block",
      object: informativa.percorso,
      message: `testo servito di ${testo.length} caratteri: non e' un'informativa, e' un titolo`,
    });
  }

  const mancanti = VOCI_INFORMATIVA.filter((v) => !v.re.test(testo));
  if (mancanti.length > 0) {
    findings.push({
      severity: "block",
      object: informativa.percorso,
      message: `non nomina ${mancanti.length} voci obbligatorie dell'art. 13: ${mancanti.map((v) => v.nome).join(", ")}`,
    });
  }
  return findings;
}

// ------------------------------------------------------------- moduli e dati
const TIPI_NON_DATO = new Set(["hidden", "submit", "button", "reset", "image", "checkbox", "radio"]);

/**
 * I campi dei moduli di una pagina, dall'HTML servito.
 *
 * I campi `hidden` restano fuori per una ragione misurata e non per pigrizia:
 * su App Router ogni `<form>` con Server Action ne porta quattro di servizio
 * (`$ACTION_REF_1`, `$ACTION_KEY`…) che non raccolgono niente da nessuno.
 * Contarli avrebbe prodotto quattro rilievi per modulo su ogni sito di questa
 * casa, cioe' un rosso che si impara a scavalcare.
 */
export function campiDiPagina(html) {
  const pulito = senzaScript(html);
  const campi = [];
  const raccogli = (tag, elemento) => {
    const a = attributi(tag);
    const tipo = (a.type ?? (elemento === "input" ? "text" : elemento)).toLowerCase();
    if (elemento === "input" && TIPI_NON_DATO.has(tipo)) return;
    campi.push({
      elemento,
      tipo,
      nome: a.name ?? a.id ?? "",
      id: a.id ?? "",
      autocomplete: (a.autocomplete ?? "").toLowerCase(),
      ariaLabel: a["aria-label"] ?? "",
      obbligatorio: "required" in a,
    });
  };
  for (const tag of tagDi(pulito, "input")) raccogli(tag, "input");
  for (const tag of tagDi(pulito, "textarea")) raccogli(tag, "textarea");
  for (const tag of tagDi(pulito, "select")) raccogli(tag, "select");
  return campi;
}

export const moduliDiPagina = (html) => tagDi(senzaScript(html), "form").length;

/** Le etichette `<label for=…>` presenti nella pagina. */
export function etichettePerId(html) {
  const mappa = new Map();
  for (const { tag, dentro } of elementiDi(senzaScript(html), "label")) {
    const a = attributi(tag);
    if (a.for) mappa.set(a.for, testoVisibile(dentro));
  }
  return mappa;
}

/**
 * Un campo raccoglie un dato personale? Con la forza della prova.
 *
 * Il criterio e' quello della §17 di DECISIONI.md: un'euristica non produce un
 * `block`, tranne dove la prova sta in un catalogo. Qui il catalogo e' l'HTML
 * stesso — `type="email"`, `type="tel"` e soprattutto `autocomplete`, che e' un
 * valore di un elenco chiuso e lo scrive chi ha costruito il modulo. Il nome
 * del campo invece e' una convenzione: `nome` puo' essere il nome di una
 * persona o il nome di una pizza, e bloccare sul nome vorrebbe dire un rosso
 * su moduli corretti.
 */
const AUTOCOMPLETE_PERSONALI = new Set([
  "name", "given-name", "family-name", "additional-name", "nickname", "honorific-prefix", "honorific-suffix",
  "email", "username", "tel", "tel-national", "tel-local", "tel-country-code",
  "street-address", "address-line1", "address-line2", "address-level1", "address-level2", "postal-code", "country", "country-name",
  "bday", "bday-day", "bday-month", "bday-year", "sex", "organization", "organization-title",
  "cc-name", "cc-number", "cc-exp", "cc-csc",
]);
const RE_NOME_PERSONALE = /^(nome|cognome|name|surname|email|e-?mail|mail|tel|telefono|phone|cellulare|indirizzo|address|via|citta|city|cap|codice.?fiscale|piva|p.?iva|data.?nascita|azienda|ragione.?sociale)$/i;

export function classificaCampo(campo) {
  if (AUTOCOMPLETE_PERSONALI.has(campo.autocomplete)) {
    return { personale: true, prova: "forte", motivo: `autocomplete="${campo.autocomplete}"` };
  }
  if (campo.tipo === "email" || campo.tipo === "tel") {
    return { personale: true, prova: "forte", motivo: `type="${campo.tipo}"` };
  }
  if (RE_NOME_PERSONALE.test(campo.nome)) {
    return { personale: true, prova: "debole", motivo: `il nome del campo e' "${campo.nome}"` };
  }
  return { personale: false, prova: "nessuna", motivo: "" };
}

export function findingsDatiRaccolti({ pagineConModuli, basiDichiarate, informativaRaggiungibile }) {
  const findings = [];
  const dichiarati = new Map(
    (basiDichiarate ?? []).map((r) => [`${(r.modulo ?? "").trim()}|${(r.campo ?? "").trim().toLowerCase()}`, r]),
  );

  for (const pagina of pagineConModuli) {
    for (const campo of pagina.campi) {
      const c = classificaCampo(campo);
      if (!c.personale) continue;
      const chiave = `${pagina.percorso}|${(campo.nome || campo.id).toLowerCase()}`;
      const riga = dichiarati.get(chiave);
      if (!riga) {
        findings.push({
          severity: c.prova === "forte" ? "block" : "issue",
          object: `${pagina.percorso} → campo "${campo.nome || campo.id}"`,
          message:
            c.prova === "forte"
              ? `raccoglie un dato personale (${c.motivo}) e nessuna riga del certificato ne dichiara la base giuridica`
              : `potrebbe raccogliere un dato personale (${c.motivo}), e non e' dichiarato: prova debole, va guardato da una persona`,
        });
        continue;
      }
      const base = riga["base giuridica"] ?? riga.base ?? "";
      if (!String(base).trim() || /\{\{|^-+$/.test(String(base).trim())) {
        findings.push({
          severity: "block",
          object: `${pagina.percorso} → campo "${campo.nome || campo.id}"`,
          message: "dichiarato nel certificato con la base giuridica vuota",
        });
      }
    }
    if (pagina.campi.some((c) => classificaCampo(c).personale) && !informativaRaggiungibile.has(pagina.percorso)) {
      findings.push({
        severity: "block",
        object: pagina.percorso,
        message: "raccoglie dati personali e non rimanda a nessuna informativa: l'art. 13 chiede l'informazione AL MOMENTO della raccolta, non da qualche altra parte del sito",
      });
    }
  }
  return findings;
}

// ------------------------------------------------------- archiviazione e terzi
const API_ARCHIVIAZIONE = Object.freeze(["localStorage", "sessionStorage", "document.cookie", "indexedDB"]);

/** Quali API di archiviazione compaiono nel testo di un bundle servito. */
export function apiArchiviazioneIn(testo) {
  if (typeof testo !== "string") return [];
  return API_ARCHIVIAZIONE.filter((api) => testo.includes(api));
}

/** Le origini di terzi referenziate da una pagina: script, iframe, link, img. */
export function terziDi(html, base) {
  const pulito = senzaScript(html);
  const mia = new URL(base).host;
  const origini = new Map();
  const guarda = (tag, attributo, elemento) => {
    const valore = attributi(tag)[attributo];
    if (!valore || /^(data:|javascript:|#)/i.test(valore.trim())) return;
    let url;
    try {
      url = new URL(valore, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol) || url.host === mia) return;
    if (!origini.has(url.origin)) origini.set(url.origin, new Set());
    origini.get(url.origin).add(elemento);
  };
  for (const t of tagDi(pulito, "script")) guarda(t, "src", "script");
  for (const t of tagDi(pulito, "iframe")) guarda(t, "src", "iframe");
  for (const t of tagDi(pulito, "link")) guarda(t, "href", "link");
  for (const t of tagDi(pulito, "img")) guarda(t, "src", "img");
  return [...origini].map(([origine, elementi]) => ({ origine, elementi: [...elementi].sort() }));
}

const RE_ESSENZIALE = /^(s[iì]|essenziale|tecnico|necessario)$/i;

export function findingsArchiviazione({ cookie, archiviazioni, terzi, dichiarate, banner }) {
  const findings = [];
  const perChiave = new Map((dichiarate ?? []).map((r) => [String(r.chiave ?? "").trim(), r]));
  const nonEssenzialiTrovate = [];

  for (const c of cookie) {
    const riga = perChiave.get(c.nome);
    if (!riga) {
      findings.push({
        severity: "block",
        object: `cookie "${c.nome}" (${c.percorso})`,
        message: "posto dal sito e non dichiarato nel certificato: quello che si mette nel browser di chi passa si scrive, sempre",
      });
      continue;
    }
    if (!RE_ESSENZIALE.test(String(riga.essenziale ?? "").trim())) nonEssenzialiTrovate.push(`cookie "${c.nome}"`);
  }

  for (const a of archiviazioni) {
    const riga = perChiave.get(a.api);
    if (!riga) {
      findings.push({
        severity: "block",
        object: `${a.api} (${a.percorso})`,
        message: `il codice servito da questa pagina archivia nel browser con ${a.api}, e il certificato non lo dichiara. L'archiviazione sul terminale di chi visita non e' solo il cookie: la regola guarda cosa si scrive, non come si chiama`,
      });
      continue;
    }
    if (!RE_ESSENZIALE.test(String(riga.essenziale ?? "").trim())) nonEssenzialiTrovate.push(`${a.api} (${a.percorso})`);
  }

  for (const t of terzi) {
    const riga = perChiave.get(t.origine);
    if (!riga) {
      findings.push({
        severity: "block",
        object: t.origine,
        message: `terzo non dichiarato, caricato come ${t.elementi.join(", ")}. Cosa un terzo scrive nel browser questo gate NON lo puo' misurare: e' per questo che non dichiararlo e' un bloccante e non un rilievo`,
      });
      continue;
    }
    if (!RE_ESSENZIALE.test(String(riga.essenziale ?? "").trim())) nonEssenzialiTrovate.push(`terzo ${t.origine}`);
  }

  if (nonEssenzialiTrovate.length > 0 && !banner) {
    findings.push({
      severity: "block",
      object: "consenso",
      message: `${nonEssenzialiTrovate.length} archiviazioni dichiarate NON essenziali (${nonEssenzialiTrovate.join(", ")}) e nessun banner di consenso dichiarato: si stanno ponendo prima di chiedere`,
    });
  }
  if (nonEssenzialiTrovate.length === 0 && banner) {
    findings.push({
      severity: "issue",
      object: "consenso",
      message: "banner dichiarato e nessuna archiviazione non essenziale misurata: un banner che non protegge niente insegna a cliccare «accetto» senza leggere",
    });
  }
  return findings;
}

// ---------------------------------------------------------- accessibilita'
/** Il nome accessibile di un elemento: contenuto, `aria-label`, `title`, `alt` interno. */
export function nomeAccessibile(tag, dentro) {
  const a = attributi(tag);
  const daContenuto = testoVisibile(dentro ?? "");
  if (daContenuto) return daContenuto;
  if (a["aria-label"]?.trim()) return a["aria-label"].trim();
  if (a["aria-labelledby"]?.trim()) return `(aria-labelledby ${a["aria-labelledby"]})`;
  if (a.title?.trim()) return a.title.trim();
  for (const img of tagDi(dentro ?? "", "img")) {
    const alt = attributi(img).alt;
    if (alt?.trim()) return alt.trim();
  }
  return "";
}

/** I livelli dei titoli, in ordine di documento. */
export function livelliTitoli(html) {
  const pulito = senzaScript(html);
  const re = /<h([1-6])\b[^>]*>/gi;
  const livelli = [];
  let m;
  while ((m = re.exec(pulito)) !== null) livelli.push(Number(m[1]));
  return livelli;
}

/** Le regole del documento: titolo, lingua, punto di salto. */
function regoleDocumento(html, pulito, dove) {
  const titolo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!titolo || testoVisibile(titolo[1]).length === 0) dove("nessun <title>, o vuoto: e' la prima cosa che uno screen reader annuncia");

  const html5 = /<html\b[^>]*>/i.exec(pulito);
  const lang = html5 ? attributi(html5[0]).lang : undefined;
  if (!lang || !lang.trim()) dove("nessun attributo `lang` su <html>: la sintesi vocale non sa in che lingua leggere");

  if (tagDi(pulito, "main").length === 0) dove("nessun elemento <main>: chi naviga con la tastiera non ha un punto di salto al contenuto", "issue");
}

/**
 * Le regole della gerarchia dei titoli.
 *
 * Il salto di livello e' `block` e non `issue`, e il sabotaggio di classe M e' il
 * motivo: con `issue` il passo restava VERDE su una pagina con la gerarchia
 * rotta, cioe' era verde proprio sul difetto che dichiara di provare. La prova
 * qui e' interamente nel documento — h1 seguito da h3 — senza una riga di
 * euristica: e' il criterio della §17 di DECISIONI.md, e cade dalla parte del
 * bloccante. Piu' di un `h1` resta `issue`: in HTML5 le sezioni lo ammettono.
 */
function regoleTitoli(html, dove) {
  const livelli = livelliTitoli(html);
  const h1 = livelli.filter((l) => l === 1).length;
  if (h1 === 0) dove("nessun <h1>: la pagina non dichiara di cosa parla");
  else if (h1 > 1) dove(`${h1} elementi <h1>: la gerarchia dei titoli non ha una cima sola`, "issue");

  for (let i = 1; i < livelli.length; i++) {
    if (livelli[i] > livelli[i - 1] + 1) {
      dove(`gerarchia dei titoli saltata: h${livelli[i - 1]} seguito da h${livelli[i]}. Chi naviga per intestazioni si trova un livello che non esiste`);
      break;
    }
  }
  if (livelli.length > 0 && livelli[0] !== 1) dove(`il primo titolo della pagina e' un h${livelli[0]}, non un h1`, "issue");
}

/**
 * Le regole degli elementi che devono avere un nome: immagini, collegamenti,
 * bottoni, campi.
 *
 * `alt` assente e' un `block`; `alt=""` e' un `issue`, perche' su un'immagine
 * davvero decorativa e' la forma corretta e bloccarla vorrebbe dire un rosso su
 * pagine giuste. Che l'immagine sia decorativa lo dice una persona, non questo
 * codice: e' il confine fra una regola e un giudizio.
 */
function regoleNomi(html, pulito, dove) {
  for (const tag of tagDi(pulito, "img")) {
    const a = attributi(tag);
    if (!("alt" in a)) dove(`<img src="${a.src ?? "?"}"> senza attributo alt`);
    else if (a.alt.trim() === "") dove(`<img src="${a.src ?? "?"}"> con alt vuoto: legittimo solo se l'immagine e' decorativa, e questo lo dice una persona`, "issue");
  }
  for (const { tag, dentro } of elementiDi(pulito, "a")) {
    if (!nomeAccessibile(tag, dentro)) dove(`collegamento senza nome accessibile: href="${attributi(tag).href ?? "?"}"`);
  }
  for (const { tag, dentro } of elementiDi(pulito, "button")) {
    if (!nomeAccessibile(tag, dentro)) dove("bottone senza nome accessibile");
  }
  const etichette = etichettePerId(html);
  for (const campo of campiDiPagina(html)) {
    const haEtichetta = (campo.id && etichette.has(campo.id)) || campo.ariaLabel.trim().length > 0;
    if (!haEtichetta) dove(`campo "${campo.nome || campo.id || campo.tipo}" senza etichetta e senza aria-label`);
  }
}

export function findingsAccessibilitaPagina(percorso, html) {
  const findings = [];
  const pulito = senzaScript(html);
  const dove = (m, severity = "block") => findings.push({ severity, object: percorso, message: m });
  regoleDocumento(html, pulito, dove);
  regoleTitoli(html, dove);
  regoleNomi(html, pulito, dove);
  return findings;
}

// ------------------------------------------------------------------- lingua
/** Indizi di rotte per lingua nella superficie: `/en`, `/it/…`, `/fr-be/…`. */
const RE_ROTTA_LINGUA = /^\/([a-z]{2})(?:-[a-z]{2})?(?:\/|$)/i;

export function lingueDaRotte(percorsi) {
  const lingue = new Set();
  for (const p of percorsi) {
    const m = RE_ROTTA_LINGUA.exec(p);
    if (m) lingue.add(m[1].toLowerCase());
  }
  return [...lingue].sort();
}

/**
 * Lo stato del passo `lingua-e-hreflang`, e la trappola che c'era dentro.
 *
 * La premessa di `NON APPLICABILE` NON puo' essere «non ho trovato hreflang»:
 * sarebbe circolare, e un sito multilingua a cui MANCANO gli hreflang — cioe'
 * esattamente la non conformita' da trovare — uscirebbe «non applicabile».
 * La premessa e' un'altra misura, indipendente dagli hreflang: l'insieme dei
 * `lang` dichiarati sulle pagine servite, piu' gli indizi di rotte per lingua.
 * Trovato in fase di progettazione, prima che diventasse codice.
 */
export function esitoLingua({ pagine, lingueDichiarate, percorsi }) {
  const findings = [];
  const langMisurati = new Set(pagine.map((p) => (p.lang ?? "").trim().toLowerCase().split("-")[0]).filter(Boolean));
  const daRotte = lingueDaRotte(percorsi);
  const conHreflang = pagine.filter((p) => p.hreflang.length > 0);

  for (const p of pagine) {
    if (!p.lang) {
      findings.push({ severity: "block", object: p.percorso, message: "nessun `lang` su <html>" });
    } else if (lingueDichiarate.length > 0 && !lingueDichiarate.includes(p.lang.toLowerCase().split("-")[0])) {
      findings.push({
        severity: "block",
        object: p.percorso,
        message: `dichiara lang="${p.lang}", che non e' fra le lingue del certificato (${lingueDichiarate.join(", ")})`,
      });
    }
  }

  const multilingua = langMisurati.size > 1 || daRotte.length > 1 || lingueDichiarate.length > 1;
  const premessa =
    `lingue misurate sull'HTML servito di ${pagine.length} pagine: ${[...langMisurati].join(", ") || "nessuna"}` +
    ` · rotte per lingua trovate nella superficie: ${daRotte.length > 0 ? daRotte.join(", ") : "nessuna"}` +
    ` · lingue dichiarate nel certificato: ${lingueDichiarate.join(", ") || "nessuna"}`;

  if (!multilingua) {
    // Sito monolingua: gli hreflang non si applicano. Ma se qualcuno ne ha
    // messi lo stesso, e' un fatto e va detto — non e' un errore, e' una
    // discrepanza fra cio' che il sito fa e cio' che dichiara di essere.
    if (conHreflang.length > 0) {
      findings.push({
        severity: "issue",
        object: "hreflang",
        message: `${conHreflang.length} pagine dichiarano hreflang su un sito che risulta monolingua`,
      });
    }
    return { findings, stato: findings.some((f) => f.severity === "block") ? "fail" : statoNonApplicabile(premessa), premessa };
  }

  // Multilingua: gli hreflang si pretendono, e si pretendono reciproci.
  const perPagina = new Map(pagine.map((p) => [p.percorso, p]));
  for (const p of pagine) {
    if (p.hreflang.length === 0) {
      findings.push({ severity: "block", object: p.percorso, message: "sito multilingua e nessun `hreflang` su questa pagina" });
      continue;
    }
    if (!p.hreflang.some((h) => h.hreflang.toLowerCase() === "x-default")) {
      findings.push({ severity: "issue", object: p.percorso, message: "nessun `hreflang=\"x-default\"`" });
    }
    for (const h of p.hreflang) {
      if (h.hreflang.toLowerCase() === "x-default") continue;
      const altra = perPagina.get(h.percorso);
      if (!altra) continue;
      // `x-default` NON conta come rimando reciproco: dichiara la versione di
      // ripiego, non «questa pagina e' l'alternativa di quella». Contarlo
      // avrebbe fatto passare per reciproca ogni coppia in cui la seconda
      // pagina si limita a puntare alla home.
      if (!altra.hreflang.some((r) => r.percorso === p.percorso && r.hreflang.toLowerCase() !== "x-default")) {
        findings.push({
          severity: "block",
          object: p.percorso,
          message: `dichiara ${h.percorso} come versione "${h.hreflang}", e quella pagina non rimanda indietro: un hreflang non reciproco viene ignorato`,
        });
      }
    }
  }
  return { findings, stato: statoDaFindings(findings), premessa };
}

/** Gli `hreflang` di una pagina, con il percorso gia' normalizzato. */
export function hreflangDi(html, base) {
  const trovati = [];
  for (const tag of tagDi(senzaScript(html), "link")) {
    const a = attributi(tag);
    if ((a.rel ?? "").toLowerCase() !== "alternate" || !a.hreflang) continue;
    trovati.push({ hreflang: a.hreflang, percorso: percorsoInterno(a.href, base) ?? a.href });
  }
  return trovati;
}

/** Il `lang` di <html>, oppure `null`. */
export function langDi(html) {
  const tag = /<html\b[^>]*>/i.exec(senzaScript(html));
  const lang = tag ? attributi(tag[0]).lang : "";
  return lang && lang.trim() ? lang.trim() : null;
}
