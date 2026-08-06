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
/**
 * I caratteri di controllo tolti dal testo che finisce in un messaggio.
 *
 * Nei rilievi si citano pezzi di documento **scaricato**: un `src`, un `href`,
 * un `Location`. Quel testo lo scrive chi ha fatto il sito, e finisce su un
 * terminale — e in questa casa l'uscita del gate si **incolla nei verbali**. Con
 * una sequenza ANSI dentro un attributo si puo' cancellare lo schermo e
 * riscriverci sopra `GATE CONFORMITA': VERDE`: il verdetto e il codice d'uscita
 * restano quelli veri, ma la trascrizione che una persona legge no. Il modo
 * `--json` non era toccato (`JSON.stringify` fa l'escape), quello testuale si.
 */
export const perStampa = (testo, massimo = 300) => {
  // Si filtra per PUNTO DI CODICE invece che con una classe di caratteri: una
  // regexp con dentro caratteri di controllo veri e' illeggibile nel sorgente e
  // fragile a ogni passaggio di strumento.
  const pulito = [...String(testo ?? "")]
    .map((c) => {
      const p = c.codePointAt(0);
      if (p === 9 || p === 10 || p === 13) return " ";
      return (p < 32 || (p >= 127 && p <= 159)) ? "?" : c;
    })
    .join("")
    .replace(/\s+/g, " ");
  return pulito.length > massimo ? `${pulito.slice(0, massimo)}…` : pulito;
};

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
  return ripulisciDocumento(html).pulito;
}

/**
 * Il ripulitore, a UNA SCANSIONE, e perche' non e' piu' una catena di `replace`.
 *
 * La versione a `replace` aveva una **chiave universale**, trovata dal tribunale
 * (`SD-VERDE-01`): in HTML un `<!--` dentro il VALORE DI UN ATTRIBUTO e' testo,
 * non l'apertura di un commento — ma una regexp non lo sa. Bastava
 *
 *     <div data-nota="<!--"></div>  …contenuto vero…  <div data-nota="-->"></div>
 *
 * per far sparire dal documento che il gate giudica ogni cosa che stava in
 * mezzo: immagini senza `alt`, campi che raccolgono dati personali, terzi non
 * dichiarati, collegamenti. Il browser rendeva tutto; il gate non vedeva niente
 * e firmava. Non era un passo aggirabile: erano **tutti**, con due `<div>`
 * invisibili.
 *
 * Questa scansione conosce quattro stati (testo · dentro un tag · dentro un
 * valore quotato · dentro un commento) e per questo non si fa ingannare. In piu'
 * e' **lineare**: la catena di `replace` aveva un costo quadratico misurato
 * (200 KB di `<` ripetuti → 24,6 s, ×4 a ogni raddoppio), cioe' un modo per
 * appendere il gate senza mai fargli dire ROSSO.
 *
 * Ritorna anche i **corpi degli script inline**, perche' chi li vuole non deve
 * riscansionare il documento: il passo sull'archiviazione li legge da qui.
 */
export function ripulisciDocumento(html) {
  if (typeof html !== "string") return { pulito: "", inline: [], stili: [] };
  const fuori = [];
  const inline = [];
  const stili = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const c = html[i];
    if (c !== "<") { fuori.push(c); i += 1; continue; }

    // Commento: `<!--` … `-->`, piu' le due forme brusche legali `<!-->` e
    // `<!--->` che lo standard chiude subito (e che una regexp golosa userebbe
    // per divorare il resto della pagina).
    if (html.startsWith("<!--", i)) {
      if (html.startsWith("<!-->", i)) { fuori.push(" "); i += 5; continue; }
      if (html.startsWith("<!--->", i)) { fuori.push(" "); i += 6; continue; }
      const fine = html.indexOf("-->", i + 4);
      fuori.push(" ");
      i = fine < 0 ? n : fine + 3;
      continue;
    }

    // Tag: si copia per intero, tenendo conto dei valori quotati — che sono il
    // punto: li' dentro `<`, `>` e `<!--` sono testo.
    const tag = leggiTag(html, i);
    if (!tag) { fuori.push(c); i += 1; continue; }
    const nome = (/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag.testo)?.[1] ?? "").toLowerCase();
    fuori.push(tag.testo);
    i = tag.fine;

    // Il CORPO di `<script>` e `<style>` non entra nel documento ripulito: su
    // Next il carico RSC porta l'albero serializzato della pagina, e contarlo
    // vorrebbe dire leggere due volte lo stesso documento.
    if ((nome === "script" || nome === "style") && !/\/>$/.test(tag.testo)) {
      const chiusura = new RegExp(`</\\s*${nome}\\s*>`, "i");
      const resto = html.slice(i);
      const m = chiusura.exec(resto);
      const corpo = m ? resto.slice(0, m.index) : resto;
      if (nome === "script") { if (corpo.trim()) inline.push({ tag: tag.testo, corpo }); }
      else if (corpo.trim()) stili.push({ tag: tag.testo, corpo });
      fuori.push(m ? m[0] : `</${nome}>`);
      i = m ? i + m.index + m[0].length : n;
    }
  }
  return { pulito: fuori.join(""), inline, stili };
}

/** Un tag dalla posizione `i`: `{ testo, fine }`, oppure `null` se non lo e'. */
function leggiTag(html, i) {
  if (!/^<\/?[a-zA-Z!?]/.test(html.slice(i, i + 3))) return null;
  let j = i + 1;
  let apice = null;
  while (j < html.length) {
    const c = html[j];
    if (apice) {
      if (c === apice) apice = null;
    } else if (c === '"' || c === "'") {
      apice = c;
    } else if (c === ">") {
      return { testo: html.slice(i, j + 1), fine: j + 1 };
    }
    j += 1;
  }
  return null; // tag non chiuso: si tratta il `<` come testo
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
export function findingsSuperficie({ daCollegamenti, daSitemap, dichiarate, sitemapLetta, superficieDichiarata }) {
  const findings = [];
  const collegate = new Set(daCollegamenti);
  const inSitemap = new Set(daSitemap);

  if (!sitemapLetta) {
    // `issue` se i collegamenti hanno camminato; `block` se non hanno camminato,
    // perche' allora NON C'E' NESSUNA sorgente. Il sabotaggio di classe X
    // provava «home senza collegamenti + sitemap intera»; «home senza
    // collegamenti + sitemap assente» restava verde, cioe' il primo testimone
    // poteva mentire da solo purche' il secondo sparisse.
    findings.push({
      severity: collegate.size <= 1 ? "block" : "issue",
      object: "sitemap.xml",
      message: collegate.size <= 1
        ? `nessuna sitemap leggibile E la camminata dai collegamenti ha trovato ${collegate.size} pagina: non c'e' NESSUNA sorgente indipendente, e la superficie non e' stata stabilita`
        : "nessuna sitemap leggibile: la superficie ha una sola sorgente (i collegamenti). Una scansione che non trova niente e una che ha trovato tutto qui si assomigliano",
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

  // Una superficie dichiarata VUOTA disattivava in silenzio tutto il confronto
  // dichiarato/raggiungibile: chi dichiarava tre pagine rischiava rilievi, chi
  // non dichiarava niente era verde. E' la stessa classe che l'elenco `VOCI`
  // chiude per le voci — un elenco che si accorcia riscrivendo un documento —
  // riaperta per la superficie.
  if (superficieDichiarata && (!superficieDichiarata.sezionePresente || superficieDichiarata.righe.length === 0)) {
    findings.push({
      severity: "block",
      object: "docs/conformita.md",
      message: superficieDichiarata.sezionePresente
        ? "la sezione «Superficie pubblica dichiarata» c'e' ed e' vuota: senza righe, il confronto fra il dichiarato e il raggiungibile non si fa, e nessuno se ne accorge"
        : "nessuna sezione «Superficie pubblica dichiarata»: il confronto fra il dichiarato e il raggiungibile non si fa",
    });
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
const RE_INFORMATIVA_TESTO = /(privacy|informativ|cookie|trattamento dei dati|protezione dei dati|note legali)/i;
/**
 * Sul PERCORSO si pretende un segmento intero, non una sottostringa.
 *
 * `/prodotti/cookie-al-cioccolato` contiene «cookie», e su un sito di
 * pasticceria — cliente perfettamente plausibile per questa pipeline — quel
 * collegamento sta nella navigazione di ogni pagina, esattamente come «Privacy»
 * nel piè di pagina. Il tribunale l'ha misurato: veniva eletto informativa, e il
 * passo chiudeva ROSSO su una pagina di prodotto mentre il sito aveva
 * un'informativa perfetta (SD-ROSSO-02).
 */
const RE_INFORMATIVA_PERCORSO = /(^|\/)(privacy|privacy-policy|cookie|cookie-policy|informativa|informativa-privacy|note-legali|legal)(\/|$)/i;

/**
 * I candidati a «pagina dell'informativa», ricavati dai COLLEGAMENTI.
 *
 * Non da un elenco di percorsi indovinati (`/privacy`, `/cookie-policy`…): un
 * elenco di tentativi trova una pagina che nessuno raggiunge e manca
 * un'informativa che sta a `/note-legali/clienti`. Quello che conta per chi
 * visita e' il collegamento che la pagina gli mette davanti, ed e' quello che
 * si misura.
 */
const VUOTI = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** L'HTML dichiara nascosto questo tag di apertura? */
export function tagNascosto(tag) {
  const attr = attributi(tag);
  if ("hidden" in attr || (attr["aria-hidden"] ?? "").toLowerCase() === "true") return true;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr.style ?? "");
}

/** Dove si chiude l'elemento `nome` aperto appena prima di `da`, contando l'annidamento. */
function fineElemento(html, nome, da) {
  const re = new RegExp(`<(\\/?)${perRegexp(nome)}\\b[^>]*>`, "gi");
  re.lastIndex = da;
  let profondita = 1;
  let m;
  while ((m = re.exec(html)) !== null) {
    profondita += m[1] ? -1 : 1;
    if (profondita === 0) return re.lastIndex;
  }
  return html.length;
}

/**
 * Gli intervalli del documento che l'HTML stesso dichiara nascosti, **contenitori
 * compresi**.
 *
 * Il controllo c'era e guardava un livello solo: gli attributi dell'`<a>`. Ma
 * un collegamento nel piè di pagina non lo si nasconde sull'ancora, lo si
 * nasconde sul suo contenitore — ed e' la forma che ha ceduto al collaudo P2:
 * `<li style="display:none"><a href="/privacy">Informativa privacy</a></li>` su
 * dieci pagine su dieci, e il passo `informativa-privacy` chiudeva
 * **«collegata da 10 pagine su 10»** su un sito in cui l'informativa non la
 * raggiungeva nessuno. E' peggio del collegamento a un 404, perche' li' almeno
 * chi lo segue se ne accorge.
 *
 * Il limite resta quello dichiarato: si vede solo cio' che l'**HTML** dichiara
 * nascosto. Una classe CSS che nasconde da un foglio di stile esterno questo
 * gate non la risolve, e sta scritto nel perimetro.
 */
export function regioniNascoste(htmlPulito) {
  const regioni = [];
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(htmlPulito)) !== null) {
    if (!tagNascosto(m[0])) continue;
    const nome = m[1].toLowerCase();
    const fine = m[0].endsWith("/>") || VUOTI.has(nome) ? re.lastIndex : fineElemento(htmlPulito, nome, re.lastIndex);
    regioni.push([m.index, fine]);
  }
  return regioni;
}

const dentroRegioni = (regioni, i) => regioni.some(([a, b]) => i >= a && i < b);

export function candidatiInformativa(html, base) {
  const pulito = senzaScript(html);
  const nascoste = regioniNascoste(pulito);
  const trovati = new Map();
  const re = /<(a)\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(pulito)) !== null) {
    const tag = `<a${m[2]}>`;
    const dentro = m[3];
    const attr = attributi(tag);
    const percorso = percorsoInterno(attr.href, base);
    if (!percorso) continue;
    // Un collegamento NASCOSTO non e' un collegamento che chi visita puo'
    // seguire: `<a hidden>privacy</a>` valeva quanto quello nel piè di pagina, e
    // bastava a piazzare un'esca (SD-VERDE-04). Si guarda l'ancora **e i suoi
    // contenitori**: nascondere il `<li>` intorno era il modo naturale di farlo,
    // e passava (collaudo P2).
    if (tagNascosto(tag) || dentroRegioni(nascoste, m.index)) continue;
    const testo = `${testoVisibile(dentro)} ${attr["aria-label"] ?? ""} ${attr.title ?? ""}`.trim();
    const daTesto = RE_INFORMATIVA_TESTO.test(testo);
    if (daTesto || RE_INFORMATIVA_PERCORSO.test(percorso)) {
      // Il testo del collegamento pesa piu' del percorso: e' quello che una
      // persona legge prima di cliccare.
      const peso = daTesto ? 2 : 1;
      if (!trovati.has(percorso) || trovati.get(percorso).peso < peso) trovati.set(percorso, { testo, peso });
    }
  }
  return [...trovati].map(([percorso, { testo, peso }]) => ({ percorso, testo, peso }));
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
const TIPI_NON_DATO = new Set(["submit", "button", "reset", "image"]);

/**
 * I campi di SERVIZIO, riconosciuti per NOME e non per tipo.
 *
 * La prima versione scartava tutti gli `hidden`, con la motivazione — vera —
 * che su App Router ogni `<form>` con Server Action ne porta quattro. Ma la
 * motivazione era «i campi nascosti non raccolgono niente», che e'
 * un'assunzione, e chi scrive il modulo la controlla: il tribunale ha misurato
 * che `<input type="hidden" name="email" autocomplete="email">` spariva prima
 * di arrivare alla classificazione, e con lui spariva anche il bloccante
 * sull'informativa al punto di raccolta.
 */
const NOMI_DI_SERVIZIO = /^(\$ACTION|_next|__|csrf|xsrf|authenticity_token|utf8|_method)/i;

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
    if (NOMI_DI_SERVIZIO.test(a.name ?? "")) return;
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
    // Un'etichetta VUOTA non etichetta niente: `<label for="e"></label>` faceva
    // passare il campo con `etichette.has("e")` vero e un nome accessibile
    // inesistente (tribunale, SD-VERDE-06).
    const testo = testoVisibile(dentro);
    if (a.for && testo) mappa.set(a.for, testo);
  }
  return mappa;
}

/**
 * I campi ETICHETTATI DALL'AVVOLGIMENTO: `<label>Email <input …></label>`.
 *
 * E' una forma valida e accessibile, molto usata, e la prima versione la
 * bocciava — `campo "email" senza etichetta e senza aria-label` su markup
 * corretto. Un rosso su un sito conforme e' la via piu' rapida perche' il gate
 * venga scavalcato per abitudine (§8).
 */
export function campiAvvolti(html) {
  const nomi = new Set();
  for (const { dentro } of elementiDi(senzaScript(html), "label")) {
    if (!testoVisibile(dentro)) continue;
    for (const nome of ["input", "textarea", "select"]) {
      for (const tag of tagDi(dentro, nome)) {
        const a = attributi(tag);
        if (a.id) nomi.add(`#${a.id}`);
        if (a.name) nomi.add(`@${a.name}`);
      }
    }
  }
  return nomi;
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
  const { pulito, stili } = ripulisciDocumento(html);
  const mia = new URL(base).host;
  const origini = new Map();
  const aggiungi = (valore, elemento) => {
    if (!valore || /^(data:|javascript:|#|blob:|about:)/i.test(valore.trim())) return;
    let url;
    try {
      url = new URL(valore.trim(), base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol) || url.host === mia) return;
    if (!origini.has(url.origin)) origini.set(url.origin, new Set());
    origini.get(url.origin).add(elemento);
  };
  const guarda = (tag, attributo, elemento) => aggiungi(attributi(tag)[attributo], elemento);
  // L'elenco degli elementi e' lungo perche' un terzo entra da dove capita, e il
  // tribunale ne ha nominati quattro che mancavano: un font caricato con
  // `@import` dentro `<style>`, un video, una `<source>`, un `<object>`. Ognuno
  // di questi fa partire una richiesta al dominio di qualcun altro, che e'
  // esattamente cio' che questo passo esiste per censire.
  for (const [nome, attributo] of [["script", "src"], ["iframe", "src"], ["link", "href"], ["img", "src"],
    ["video", "src"], ["audio", "src"], ["source", "src"], ["embed", "src"], ["track", "src"], ["object", "data"]]) {
    for (const t of tagDi(pulito, nome)) guarda(t, attributo, nome);
  }
  for (const t of [...tagDi(pulito, "img"), ...tagDi(pulito, "source")]) {
    for (const pezzo of (attributi(t).srcset ?? "").split(",")) aggiungi(pezzo.trim().split(/\s+/)[0], "srcset");
  }
  for (const { corpo } of stili) {
    for (const m of corpo.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) aggiungi(m[1], "css");
  }
  return [...origini].map(([origine, elementi]) => ({ origine, elementi: [...elementi].sort() }));
}

const RE_ESSENZIALE = /^(s[iì]|essenziale|tecnico|necessario)$/i;

/**
 * Come una riga dichiarata combacia con un'archiviazione misurata.
 *
 * **Cookie** e **terzi** hanno un nome misurato (`sl_sessione`,
 * `https://www.google.com`): la riga li dichiara nella colonna `chiave`.
 *
 * Le **API di archiviazione** no: quello che si misura in un bundle e' il nome
 * dell'API (`localStorage`), non la chiave che ci viene scritta. Il modello
 * `resources/templates/conformita.md` prescrive una riga **per chiave
 * archiviata** — `| studio:analitica | localStorage | no | … |` — cioe' mette
 * l'API nella colonna `tipo`; il banco e la batteria invece la mettevano in
 * `chiave` (`| localStorage | archiviazione locale | … |`).
 *
 * Misurato al collaudo P2: un certificato scritto **esattamente dal modello**
 * riceveva un `block` per ogni archiviazione, su tutte le pagine — 32 bloccanti
 * su un documento corretto. Il banco e i test non lo vedevano perche' erano
 * stati scritti sulla forma dell'implementazione invece che su quella del
 * modello: 25 classi di sabotaggio e 144 test verdi su una forma che nessuna
 * esecuzione di `certifica` avrebbe mai prodotto.
 *
 * Quindi una riga nomina un'API se la scrive in `chiave` **o** in `tipo`. Non e'
 * un allentamento: la riga deve comunque esserci e nominare quell'API. Ed e'
 * piu' severo su una cosa, perche' adesso le righe che la nominano possono
 * essere piu' d'una: **se anche una sola e' non essenziale, l'archiviazione e'
 * non essenziale** — un `localStorage` usato per la lingua *e* per un contatore
 * di visite vuole il banner, e la riga prudente e' quella che lo chiede.
 */
function indiceDichiarate(dichiarate) {
  const righe = (dichiarate ?? []).map((r) => ({
    chiave: String(r.chiave ?? "").trim(),
    tipo: String(r.tipo ?? "").trim(),
    essenziale: String(r.essenziale ?? "").trim(),
  }));
  const perNome = new Map();
  const perApi = new Map();
  for (const r of righe) {
    if (r.chiave && !perNome.has(r.chiave)) perNome.set(r.chiave, r);
    for (const nome of [r.chiave, r.tipo]) {
      if (!nome) continue;
      if (!perApi.has(nome)) perApi.set(nome, []);
      perApi.get(nome).push(r);
    }
  }
  return { perNome, perApi };
}

export function findingsArchiviazione({ cookie, archiviazioni, terzi, dichiarate, banner }) {
  const findings = [];
  const { perNome: perChiave, perApi } = indiceDichiarate(dichiarate);
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
    const righeSue = perApi.get(a.api) ?? [];
    if (righeSue.length === 0) {
      findings.push({
        severity: "block",
        object: `${a.api} (${a.percorso})`,
        message: `il codice servito da questa pagina archivia nel browser con ${a.api}, e nessuna riga del certificato lo nomina (ne' in \`chiave\` ne' in \`tipo\`). L'archiviazione sul terminale di chi visita non e' solo il cookie: la regola guarda cosa si scrive, non come si chiama`,
      });
      continue;
    }
    // Basta una riga non essenziale perche' l'archiviazione lo sia: la stessa
    // API puo' servire a due cose, e il consenso lo decide la piu' invadente.
    if (righeSue.some((r) => !RE_ESSENZIALE.test(r.essenziale))) nonEssenzialiTrovate.push(`${a.api} (${a.percorso})`);
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
export function nomeAccessibile(tag, dentro, documento = "") {
  const a = attributi(tag);
  const daContenuto = testoVisibile(dentro ?? "");
  if (daContenuto) return daContenuto;
  if (a["aria-label"]?.trim()) return a["aria-label"].trim();
  // `aria-labelledby` si RISOLVE. Prima si accettava come nome il puntatore
  // stesso: `<a aria-labelledby="id-che-non-esiste"></a>` passava, e per una
  // tecnologia assistiva il nome restava vuoto. L'id sta nello stesso documento
  // che abbiamo in mano — non serve un browser per cercarlo (SD-VERDE-06).
  const puntatore = a["aria-labelledby"]?.trim();
  if (puntatore) {
    const testi = puntatore.split(/\s+/).map((id) => testoDellId(documento, id)).filter(Boolean);
    if (testi.length > 0) return testi.join(" ");
  }
  if (a.title?.trim()) return a.title.trim();
  for (const img of tagDi(dentro ?? "", "img")) {
    const alt = attributi(img).alt;
    if (alt?.trim()) return alt.trim();
  }
  // Un'icona SVG con `aria-label` o `<title>` E' un nome accessibile: e' il
  // pattern standard dei collegamenti social in un pie' di pagina, e prima
  // produceva un bloccante su markup corretto (SD-ROSSO-01).
  for (const svg of tagDi(dentro ?? "", "svg")) {
    const etichetta = attributi(svg)["aria-label"];
    if (etichetta?.trim()) return etichetta.trim();
  }
  for (const { dentro: titolo } of elementiDi(dentro ?? "", "title")) {
    if (testoVisibile(titolo)) return testoVisibile(titolo);
  }
  for (const qualsiasi of (dentro ?? "").match(/<[a-zA-Z][^>]*\baria-label\s*=\s*("[^"]*"|'[^']*')/gi) ?? []) {
    const etichetta = attributi(`${qualsiasi}>`)["aria-label"];
    if (etichetta?.trim()) return etichetta.trim();
  }
  return "";
}

/** Il testo visibile dell'elemento con quell'`id`, oppure `""` se non esiste. */
export function testoDellId(documento, id) {
  if (!documento || !id) return "";
  const re = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bid\\s*=\\s*["']${perRegexp(id)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
  const m = re.exec(documento);
  return m ? testoVisibile(m[2]) : "";
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
    if (!("alt" in a)) dove(`<img src="${perStampa(a.src ?? "?", 120)}"> senza attributo alt`);
    else if (a.alt.trim() === "") dove(`<img src="${perStampa(a.src ?? "?", 120)}"> con alt vuoto: legittimo solo se l'immagine e' decorativa, e questo lo dice una persona`, "issue");
  }
  for (const { tag, dentro } of elementiDi(pulito, "a")) {
    if (!nomeAccessibile(tag, dentro, pulito)) dove(`collegamento senza nome accessibile: href="${perStampa(attributi(tag).href ?? "?", 120)}"`);
  }
  for (const { tag, dentro } of elementiDi(pulito, "button")) {
    if (!nomeAccessibile(tag, dentro, pulito)) dove("bottone senza nome accessibile");
  }
  const etichette = etichettePerId(html);
  const avvolti = campiAvvolti(html);
  for (const campo of campiDiPagina(html)) {
    // Un campo nascosto non si mostra a nessuno: non gli serve un'etichetta.
    // Entra comunque nel censimento dei DATI (`dati-raccolti`), che e' un'altra
    // domanda — la distinzione e' la correzione di SD-VERDE-05.
    if (campo.tipo === "hidden") continue;
    const haEtichetta = (campo.id && etichette.has(campo.id))
      || campo.ariaLabel.trim().length > 0
      || (campo.id && avvolti.has(`#${campo.id}`))
      || (campo.nome && avvolti.has(`@${campo.nome}`));
    if (!haEtichetta) dove(`campo "${perStampa(campo.nome || campo.id || campo.tipo, 80)}" senza etichetta e senza aria-label`);
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
