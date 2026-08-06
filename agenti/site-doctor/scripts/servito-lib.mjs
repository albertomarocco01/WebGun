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

/**
 * Il dettaglio di un passo, **sanificato in un punto solo**.
 *
 * `perStampa` c'era e si applicava a mano nelle regole di accessibilita': tutte
 * le altre interpolavano testo del documento servito cosi' com'era. Il tribunale
 * l'ha misurato con un `name` che contiene una sequenza ANSI — lo stdout del
 * gate cancellava lo schermo e ci riscriveva sopra `GATE CONFORMITA': VERDE`.
 * Il codice d'uscita restava vero, il verdetto stampato no, e in questa casa i
 * verbali sono la prova archiviata. Ricordarsi `perStampa` a ogni sito di
 * costruzione del messaggio e' una regola che si dimentica; qui non si puo'.
 */
export const dettaglioFindings = (findings) =>
  findings.map((f) => `  [${perStampa(f.severity, 20)}] ${perStampa(f.object, 160)}: ${perStampa(f.message, 700)}`).join("\n");

/** Le sole gravita' che questo gate sa leggere. Tutto il resto e' un refuso. */
const GRAVITA = Object.freeze(["block", "issue", "warn"]);

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return {
    block: per("block"),
    issue: per("issue"),
    warn: per("warn"),
    ignote: findings.filter((f) => !GRAVITA.includes(f.severity)).length,
  };
}

/**
 * Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano.
 *
 * **Una gravita' che il gate non sa leggere vale un `block`**, ed e' la stessa
 * simmetria che `riepilogo` applica agli stati con `ignoti`: prima un refuso di
 * un carattere — `"Block"`, `"block "` — rendeva il rilievo invisibile al
 * conteggio e innocuo al verdetto, cioe' trasformava questo gate in un timbro su
 * otto passi su nove. Non e' raggiungibile oggi, e la correzione e' esattamente
 * cio' che lo rende falsificabile domani.
 */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block" || !GRAVITA.includes(f.severity)) ? "fail" : "pass";

/**
 * La QUARTA risposta, e il suo prezzo.
 *
 * `NON APPLICABILE` non e' un'uscita di comodo: la premessa arriva qui come
 * argomento, e senza premessa si torna a MANCANTE — che tiene il gate rosso.
 * Un sito monolingua non ha hreflang e dirlo `pass` sarebbe una bugia comoda;
 * ma «non ho trovato niente» senza aver detto DOVE ho guardato e' esattamente
 * il falso verde che la §18 di DECISIONI.md vieta.
 */
export function statoNonApplicabile(premessa, quante = null) {
  // Il vincolo era sulla STRINGA, non sulla misura, e il tribunale ha mostrato
  // cosa vuol dire: una premessa costruita da un template e' sempre non vuota,
  // quindi «di 0 pagine: nessuna» superava la guardia. Chi possiede il contratto
  // dei quattro stati deve poter pretendere anche il CONTEGGIO: zero pagine
  // lette non e' «non applicabile», e' «non misurato».
  if (quante !== null && !(Number(quante) > 0)) return "skipped";
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
  // Un tag ha bisogno di un `>`. Dopo l'ultimo `>` del documento nessun `<`
  // puo' aprire un tag, e provarci significa rileggere tutta la coda a ogni
  // `<`: **quadratico**. Misurato al collaudo P2 su `<div a="` ripetuto —
  // 24 KB 153 ms · 49 KB 532 ms · 98 KB 1,8 s · 195 KB **7,3 s**, cioe' il
  // raddoppio che quadruplica. E' `SD-REDOS-01` riaperto in una forma che il
  // tribunale non aveva provato: un gate che si appende non dice mai ROSSO, e
  // appenderlo non chiede nessun privilegio — basta scrivere il sito.
  const ultimoMaggiore = html.lastIndexOf(">");
  while (i < n) {
    const c = html[i];
    if (c !== "<") { fuori.push(c); i += 1; continue; }
    if (i > ultimoMaggiore) { fuori.push(c); i += 1; continue; }

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
    if (!tag) {
      // **Come fa il tokenizer vero.** Un `<` seguito da una lettera apre un
      // tag, e da li' il parser dell'HTML non torna piu' indietro: se il tag non
      // si chiude mai, quello che resta del documento e' un tag incompleto e non
      // viene emesso. Prima qui si ricominciava dal carattere successivo, e
      // ricominciare e' esattamente cio' che costava: con un apice solitario in
      // mezzo e un `>` in fondo, ogni `<` rileggeva la coda — 128 KB in 16,7 s,
      // terza quadratica di questa funzione (`SD-REDOS-01` due volte prima).
      //
      // Un `<` che NON apre un tag (`5 < 7`) non arriva qui: `leggiTag` lo
      // scarta sul prefisso, prima di scandire, e resta testo come deve.
      if (/^<\/?[a-zA-Z!?]/.test(html.slice(i, i + 3))) { i = n; continue; }
      fuori.push(c);
      i += 1;
      continue;
    }
    const nome = (/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag.testo)?.[1] ?? "").toLowerCase();
    // LA CHIAVE UNIVERSALE NUOVA, misurata al collaudo P2. Quel `\/?` accetta
    // anche la barra, quindi `</script>` veniva riconosciuto col nome `script`
    // e trattato come un'APERTURA: il ripulitore si mangiava tutto da li' alla
    // prossima chiusura — o **alla fine del documento**, se non ce n'erano
    // altre. Una sola chiusura orfana, e il documento che il gate giudica
    // finisce li'.
    //
    // Misurato sul banco: `</script>` piantato dentro il `<main>` delle due
    // pagine di contatto, e il passo `dati-raccolti` chiude
    // **NON APPLICABILE — «zero moduli e zero campi nell'HTML servito di 10
    // pagine»** su un sito che raccoglie nome, email, telefono e PEC. E' il
    // punto aperto n°12 del costruttore avverato: la premessa di un `n/a`
    // misurata su un documento amputato e' falsa e sembra misurata. Sparisce
    // anche un terzo (la mappa incorporata), che e' un `block` in meno.
    //
    // E' piu' economica di quella del tribunale: un tag invece di due `<div>`,
    // e non serve nemmeno volerlo — un `</script>` dentro una stringa o un
    // commento JavaScript e' il classico infortunio che i bundler prevengono
    // scrivendo `<\/script>`.
    const eChiusura = /^<\s*\//.test(tag.testo);
    fuori.push(tag.testo);
    i = tag.fine;
    if (eChiusura) continue;

    // Il CORPO di `<script>` e `<style>` non entra nel documento ripulito: su
    // Next il carico RSC porta l'albero serializzato della pagina, e contarlo
    // vorrebbe dire leggere due volte lo stesso documento.
    // `<textarea>` sta qui insieme a `<script>` e `<style>` per una ragione
    // diversa e misurata: il suo contenuto e' TESTO, non markup. Un'area di
    // testo che mostra un esempio di markup — o un campo di un CMS in cui
    // qualcuno ha incollato una pagina — faceva contare al gate elementi che
    // il browser non rende: al collaudo P2 un `<img>` dentro una `<textarea>`
    // produceva «immagine senza alt», cioe' un ROSSO su una pagina corretta,
    // e i campi si contavano due volte.
    //
    // `<title>` NON entra in questo elenco, ed e' deliberato: il suo corpo
    // serve a `nomeAccessibile` per le icone SVG (`<svg><title>…</title>`, il
    // rimedio SD-ROSSO-01 del tribunale). Il doppio conteggio di un `<img>`
    // dentro un `<title>` resta, ed e' scritto fra i residui.
    // `<template>` sta qui per la ragione di `<textarea>` portata all'estremo:
    // il suo contenuto finisce in un frammento separato e **non e' reso mai**,
    // in nessuna condizione. Il tribunale l'ha misurato: un `<template>` nel
    // layout — markup ordinario in un Next con isole client — faceva chiudere
    // `informativa-privacy` «collegata da N pagine su N» mentre il collegamento
    // non era cliccabile da nessuno. E' la stessa classe del contenitore
    // `display:none` chiuso al collaudo P2, ma con un elemento che
    // `regioniNascoste` non puo' vedere per costruzione: non c'e' nessun
    // attributo da leggere.
    //
    // `<noscript>` NON entra in questo elenco, ed e' una decisione con la sua
    // ragione: il suo contenuto **viene reso** a chi non esegue JavaScript, che
    // e' esattamente il visitatore che questo gate simula — legge l'HTML
    // servito e non esegue niente. Toglierlo renderebbe invisibile al gate un
    // collegamento che per quel visitatore esiste davvero.
    const senzaCorpo = nome === "script" || nome === "style" || nome === "textarea" || nome === "template";
    // La barra prima del `>` NON autochiude un elemento non-void in HTML: e' un
    // errore di sintassi che il parser IGNORA. `<script src="/a.js"/>` resta
    // APERTO, e tutto cio' che segue e' testo di script fino al `</script>`.
    // Prima qui c'era `!/\/>$/`, e bastava una barra per far rientrare nel
    // documento ripulito un pezzo che il browser non rende.
    if (senzaCorpo) {
      // Un tag di CHIUSURA con attributi (`</script foo="bar">`) e' un parse
      // error nello standard, ma **viene emesso lo stesso come chiusura**: nel
      // browser quello script finisce li'. La regexp di prima ammetteva solo
      // spazi fra il nome e il `>`, quindi il corpo continuava fino alla
      // chiusura successiva o alla fine del documento — cioe' l'amputazione del
      // difetto n°12 del collaudo P2, rifatta con un tag di chiusura invece che
      // con uno orfano. Tolto anche lo `\s*` iniziale: `</ script>` per il
      // browser NON e' un tag, e non deve esserlo nemmeno qui.
      const chiusura = new RegExp(`</${nome}(?=[\\s/>])${DENTRO_TAG}>`, "i");
      const resto = html.slice(i);
      const m = chiusura.exec(resto);
      const corpo = m ? resto.slice(0, m.index) : resto;
      if (nome === "script") { if (corpo.trim()) inline.push({ tag: tag.testo, corpo }); }
      else if (nome === "style" && corpo.trim()) stili.push({ tag: tag.testo, corpo });
      fuori.push(m ? m[0] : `</${nome}>`);
      i = m ? i + m.index + m[0].length : n;
    }
  }
  return { pulito: fuori.join(""), inline, stili };
}

/**
 * Quanto lontano si spinge la lettura di UN tag prima di rinunciare.
 *
 * Terza quadratica trovata su questa funzione, e la piu' sottile delle tre: un
 * apice solitario in mezzo al documento **piu'** un `>` in fondo. Il `>` finale
 * disattiva la scorciatoia `ultimoMaggiore` (dopo l'ultimo `>` nessun `<` puo'
 * aprire un tag), e l'apice dispari fa ignorare a ogni tentativo tutti i `>`
 * successivi: ogni `<` rilegge la coda intera. Misurato dal tribunale — 16 KB
 * 270 ms · 32 KB 1,1 s · 64 KB 4,3 s · 128 KB **16,7 s**, il raddoppio che
 * quadruplica.
 *
 * Il limite rende il fallimento O(limite) invece che O(coda). 32 KB e' molto
 * piu' di qualunque tag vero; il prezzo dichiarato e' che un tag con dentro un
 * `data:` piu' lungo di cosi' viene letto come testo — e un `data:` non e'
 * comunque un terzo, perche' `terziDi` lo scarta per costruzione.
 */
const TAG_PIU_LUNGO = 32768;

/** Un tag dalla posizione `i`: `{ testo, fine }`, oppure `null` se non lo e'. */
function leggiTag(html, i) {
  if (!/^<\/?[a-zA-Z!?]/.test(html.slice(i, i + 3))) return null;
  let j = i + 1;
  let apice = null;
  const limite = Math.min(html.length, i + TAG_PIU_LUNGO);
  while (j < limite) {
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
  return null; // tag non chiuso (o piu' lungo del limite): il `<` e' testo
}

/**
 * **Una scansione sola per tutti i tag di apertura**, invece di una regexp per
 * ogni nome cercato.
 *
 * `tagDi` costruiva `<nome\b(?:…)*>` e la faceva girare su tutto il documento.
 * Su markup con tag mai chiusi — un template rotto, un esempio di codice
 * incollato, o un sito che vuole far tacere il gate — ogni posizione combaciava
 * col nome e poi scandiva fino in fondo: **quadratica**, misurata dal tribunale
 * a 24 KB 237 ms · 48 KB 735 ms · 96 KB 3,4 s · 192 KB 13,5 s · 384 KB **49 s**.
 *
 * E c'e' una lezione che vale oltre questa funzione: `DENTRO_TAG`, introdotto in
 * questo stesso pacchetto per chiudere una chiave universale, ha reso questa
 * quadratica **2,6 volte piu' lenta** — tre alternative costano piu' di una
 * classe negata a ogni carattere. Una correzione di correttezza puo' peggiorare
 * un costo, e se nessuno rimisura non lo sa nessuno. Qui la scansione e' unica,
 * lineare, e passa da `leggiTag`, che ora ha un limite suo.
 */
function tagApertiIn(htmlPulito) {
  const testo = String(htmlPulito ?? "");
  const trovati = [];
  const ultimoMaggiore = testo.lastIndexOf(">");
  let i = 0;
  while (i < testo.length) {
    const j = testo.indexOf("<", i);
    if (j < 0 || j > ultimoMaggiore) break;
    const tag = leggiTag(testo, j);
    // Stessa regola del ripulitore: un tag che non si chiude mai chiude il
    // documento. Ricominciare dal carattere dopo e' la quadratica.
    if (!tag) {
      if (/^<\/?[a-zA-Z!?]/.test(testo.slice(j, j + 3))) break;
      i = j + 1;
      continue;
    }
    i = tag.fine;
    const m = /^<([a-zA-Z][\w:-]*)/.exec(tag.testo);
    if (m) trovati.push({ nome: m[1].toLowerCase(), testo: tag.testo, da: j, dopo: tag.fine });
  }
  return trovati;
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

/** Intervalli fusi e ordinati: `regioniNascoste` puo' restituirne di sovrapposti. */
function fondiIntervalli(intervalli) {
  const ordinati = [...intervalli].sort((a, b) => a[0] - b[0]);
  const fusi = [];
  for (const [a, b] of ordinati) {
    const ultimo = fusi[fusi.length - 1];
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b);
    else fusi.push([a, b]);
  }
  return fusi;
}

/**
 * Solo il testo visibile: tag via, entita' principali sciolte, spazi compressi.
 *
 * `soloVisibile` toglie prima le **regioni che l'HTML dichiara nascoste**, e non
 * e' un'opzione di comodo: senza, «visibile» significava soltanto «non e' un
 * tag». Il tribunale l'ha misurato sull'informativa — una pagina il cui unico
 * contenuto sta dentro un `<div style="display:none">` presenta al gate 516
 * caratteri e le sette voci dell'art. 13, e a chi la apre una pagina bianca.
 * E' la stessa asimmetria che questa skill combatte sul COLLEGAMENTO
 * all'informativa, lasciata aperta sul suo CONTENUTO.
 *
 * Resta spento dove il nascosto conta lo stesso (il testo di un accordion in una
 * pagina qualunque): l'informativa e il nome accessibile lo accendono.
 */
export function testoVisibile(html, { soloVisibile = false } = {}) {
  let base = senzaScript(html);
  if (soloVisibile) {
    const regioni = fondiIntervalli(regioniNascoste(base));
    if (regioni.length > 0) {
      const pezzi = [];
      let cursore = 0;
      for (const [a, b] of regioni) {
        pezzi.push(base.slice(cursore, a));
        cursore = b;
      }
      pezzi.push(base.slice(cursore));
      base = pezzi.join(" ");
    }
  }
  return base
    .replace(new RegExp(`<${DENTRO_TAG}>`, "g"), " ")
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
    mappa[nome] = sciogliEntita(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return mappa;
}

/**
 * I riferimenti di carattere dentro un valore di attributo.
 *
 * Nel tokenizer HTML lo stato «attribute value» **decodifica** i riferimenti:
 * `type="e&#109;ail"` E' un campo email, per il browser e per chi lo compila. Qui
 * non lo era, e il tribunale ci ha spento tutte e due le prove forti della §17
 * — `type` e `autocomplete` — con una sostituzione che non cambia una virgola di
 * cio' che il sito fa. Un modulo con `type="&#101;mail"` e `autocomplete="t&#101;l"`
 * usciva da `dati-raccolti` senza un solo bloccante.
 *
 * Vale anche per `href` (il percorso dell'informativa), `alt`, `lang`, `srcset`.
 */
function sciogliEntita(valore) {
  if (!valore.includes("&")) return valore;
  const nominate = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return valore
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d{1,7});?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (tutto, n) => nominate[n.toLowerCase()] ?? tutto);
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

/**
 * Cosa puo' stare DENTRO un tag di apertura, fra il nome e il `>`.
 *
 * `[^>]*` era la forma usata in undici punti di questo file, e il tribunale del
 * 2026-08-06 l'ha aperta con **un carattere**: un `>` dentro un valore di
 * attributo quotato. Non e' un artificio — in HTML il `>` in un valore non va
 * scritto con un'entita', e i moduli veri lo scrivono per sbaglio
 * (`alt="prima > dopo"`, `data-cfg='{"a":"b>c"}'`). Il ripulitore lo capiva gia'
 * (`leggiTag` tiene lo stato degli apici); **nessuno l'aveva detto ai lettori a
 * valle**, e ognuno di loro si fermava al primo `>`.
 *
 * Costo misurato di un solo `>` messo bene: `terziDi` non censiva piu' il terzo,
 * `campiDiPagina` leggeva un `type="email"` come `text` senza nome,
 * `destinazioniModuli` non vedeva l'`action` verso un'altra origine,
 * `regioniNascoste` non vedeva il contenitore nascosto, `collegamentiInterni`
 * perdeva una pagina dalla camminata. Quattro passi con un carattere: e' la
 * chiave universale piu' economica trovata finora in questa casa, ed e' la
 * QUARTA istanza in tre giorni della stessa lezione — uno scanner scritto a mano
 * che non guarda dove si trova.
 *
 * Le tre alternative sono **disgiunte sul primo carattere** (`[^>"']` esclude
 * gli apici), quindi la regexp non puo' backtrackare in modo esponenziale: e'
 * una scelta, non un caso, e ha il suo test di tempo.
 */
const DENTRO_TAG = `(?:[^>"']|"[^"]*"|'[^']*')*`;

/** Tutti i tag di apertura di un nome, sul documento gia' ripulito. */
export function tagDi(htmlPulito, nome) {
  const cercato = String(nome).toLowerCase();
  return tagApertiIn(htmlPulito).filter((t) => t.nome === cercato).map((t) => t.testo);
}

/**
 * Elementi con il loro contenuto: `[{ tag, dentro }]`. Non per tag annidabili.
 *
 * Anche qui una scansione sola con due puntatori, e non una regexp con
 * `[\s\S]*?`: su contenitori mai chiusi — `<label>` ripetuto, `<a href>` senza
 * `</a>` — la ricerca falliva e ripartiva da ogni apertura. Misurata: 28 KB
 * 28 ms · 112 KB 461 ms · 448 KB **10,9 s**, e il vero sito di raccolta e'
 * `findingsAccessibilitaPagina`, che gira su ogni pagina scaricata.
 */
export function elementiDi(htmlPulito, nome) {
  const cercato = String(nome).toLowerCase();
  const testo = String(htmlPulito ?? "");
  const aperti = [];
  const chiusi = [];
  for (const t of tagApertiIn(testo)) if (t.nome === cercato) aperti.push(t);
  const reChiusura = new RegExp(`</${perRegexp(cercato)}[ \\t\\n\\r]*>`, "gi");
  let m;
  while ((m = reChiusura.exec(testo)) !== null) chiusi.push({ da: m.index, dopo: reChiusura.lastIndex });
  const trovati = [];
  let k = 0;
  for (const a of aperti) {
    while (k < chiusi.length && chiusi[k].da < a.dopo) k += 1;
    if (k >= chiusi.length) break;
    trovati.push({ tag: a.testo, dentro: testo.slice(a.dopo, chiusi[k].da), da: a.da });
    k += 1;
  }
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

/**
 * I percorsi interni raggiungibili dai collegamenti di una pagina.
 *
 * Il `<base href>` si legge, e non e' pedanteria: la superficie e' la premessa di
 * tutti i passi a valle. Con `<base href="/it/">` e un `<a href="contatti">`, la
 * camminata scaricava `/contatti` — che risponde 404 e finisce fra i rimandi —
 * mentre `/it/contatti`, la pagina col modulo, non entrava mai in `ctx.pagine`:
 * nessun passo la guardava e nessun rilievo diceva che era successo. Il rosso
 * arrivava con la diagnosi sbagliata, che e' il modo in cui un gate si fa
 * ignorare.
 */
export function collegamentiInterni(html, base) {
  const pulito = senzaScript(html);
  const percorsi = new Set();
  const dichiarata = attributi(tagDi(pulito, "base")[0] ?? "<base>").href;
  let radice = base;
  if (dichiarata) {
    try {
      radice = new URL(dichiarata, base).toString();
    } catch {
      radice = base;
    }
  }
  for (const tag of tagDi(pulito, "a")) {
    const href = (attributi(tag).href ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    let assoluto;
    try {
      // Si RISOLVE contro il `<base>`, ma si CONFRONTA con l'origine vera del
      // sito: un `<base>` che punta a un CDN non rende interno quel CDN.
      assoluto = new URL(href, radice).toString();
    } catch {
      continue;
    }
    const p = percorsoInterno(assoluto, base);
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
 *
 * **Un'impronta corta non e' un'impronta.** L'unica guardia era `length > 0`, e
 * con un `BUILD_ID` di un carattere la domanda diventava «questo HTML contiene
 * la lettera `a`?» — vera su qualunque documento, compreso quello di un'altra
 * applicazione. Un `next build` di serie emette 21 caratteri casuali, quindi la
 * soglia non tocca nessun progetto vero; tocca i `.next` seminati a mano, i file
 * troncati e le build personalizzate — dove oggi si prendeva un `pass` e da qui
 * in avanti si prende un `skipped`, che e' l'esito onesto.
 */
const LUNGHEZZA_MINIMA_BUILD_ID = 8;

export const eLaMiaBuild = (html, buildId) =>
  typeof html === "string" && typeof buildId === "string"
  && buildId.trim().length >= LUNGHEZZA_MINIMA_BUILD_ID && !/^(.)\1*$/.test(buildId.trim())
  && html.includes(buildId);

/** Il primo asset statico della stessa origine referenziato dall'HTML servito. */
export function assetDaProvare(html, base) {
  // Anche gli apici singoli, e sul documento RIPULITO: un minificatore o un
  // proxy che riscrive con `'` faceva sparire la seconda via dell'identita', e
  // il gate stampava «sta rispondendo un'altra applicazione» — additando
  // l'imputato sbagliato, che e' proprio la diagnosi che questa via esiste per
  // evitare. Sul ripulito, perche' un percorso `_next/static` dentro il carico
  // RSC o dentro un commento non e' un asset referenziato dalla pagina.
  const re = /(?:src|href)\s*=\s*(?:"([^"]*\/_next\/static\/[^"?]+)|'([^']*\/_next\/static\/[^'?]+))/gi;
  const testo = senzaScript(html ?? "");
  let m;
  while ((m = re.exec(testo)) !== null) {
    const p = percorsoInterno(m[1] ?? m[2], base);
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
  } else if (inSitemap.size === 0) {
    // Una `sitemap.xml` che risponde 200 e non dichiara NIENTE non e' un secondo
    // testimone: e' un testimone muto, e prima veniva riportata meglio di una
    // assente — «sorgenti: sitemap.xml (0)», nessun rilievo — mentre una sitemap
    // mancante almeno un `issue` lo produceva. Servirla vuota conveniva.
    findings.push({
      severity: collegate.size <= 1 ? "block" : "issue",
      object: "sitemap.xml",
      message: collegate.size <= 1
        ? `la sitemap risponde e non dichiara nessun indirizzo, E la camminata dai collegamenti ha trovato ${collegate.size} pagina: non c'e' NESSUNA sorgente indipendente`
        : "la sitemap risponde e non dichiara nessun indirizzo: e' una sitemap rotta, non una sitemap assente, e come secondo testimone non ha detto niente",
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

/** Chi chiude chi, senza che nessuno scriva il tag di chiusura. */
const IMPLICITE = Object.freeze({
  li: new Set(["li"]),
  p: new Set(["p"]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
  td: new Set(["td", "th"]),
  th: new Set(["td", "th"]),
  tr: new Set(["tr"]),
  option: new Set(["option"]),
});

/** L'HTML dichiara nascosto questo tag di apertura? */
function tagNascosto(tag) {
  const attr = attributi(tag);
  if ("hidden" in attr || (attr["aria-hidden"] ?? "").toLowerCase() === "true") return true;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr.style ?? "");
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
  // UNA scansione sola, con una pila e un contatore di profondita' nascosta.
  // La prima stesura, scritta in questo stesso collaudo, cercava la chiusura di
  // ogni contenitore nascosto ripartendo da capo: **quadratica**, e misurata
  // subito — 20 000 `<div hidden>` costavano 13 SECONDI. E' lo stesso difetto
  // che il tribunale aveva chiuso sul ripulitore (`SD-REDOS-01`), rifatto da chi
  // quel verbale l'aveva appena letto: un gate che si puo' appendere non dice
  // mai ROSSO, e appenderlo non richiede nessun privilegio.
  const regioni = [];
  const pila = [];
  // Un indice nome → posizioni nella pila: senza, una chiusura che non combacia
  // con niente ripercorreva **tutta** la profondita' aperta, e poi la lasciava
  // intatta perche' il ramo `i < 0` fa `continue`. Con molte aperture di nomi
  // diversi e altrettante chiusure che non combaciano, ogni chiusura pagava
  // l'intera pila: quadratica misurata a 25 KB 45 ms → 437 KB 5,6 s.
  const dove = new Map();
  let profondita = 0;
  let inizio = null;
  const testo = String(htmlPulito ?? "");
  const re = new RegExp(`<(/?)([a-zA-Z][\\w:-]*)\\b(${DENTRO_TAG})>`, "g");
  let m;
  while ((m = re.exec(testo)) !== null) {
    const nome = m[2].toLowerCase();
    if (m[1]) {
      const posizioni = dove.get(nome);
      if (!posizioni || posizioni.length === 0) continue;
      const i = posizioni[posizioni.length - 1];
      for (let k = pila.length - 1; k >= i; k -= 1) {
        if (pila[k].nascosto) profondita -= 1;
        const suoi = dove.get(pila[k].nome);
        if (suoi && suoi[suoi.length - 1] === k) suoi.pop();
      }
      pila.length = i;
      if (profondita === 0 && inizio !== null) {
        regioni.push([inizio, re.lastIndex]);
        inizio = null;
      }
      continue;
    }
    const nascosto = tagNascosto(m[0]);
    // La barra NON autochiude: `<div hidden/>` **sembra** una chiusura e invece
    // resta aperto, cioe' nasconde tutto il resto della pagina. Prima bastava
    // scriverla per far contare come visibile un pie' di pagina che nessuno
    // vede. Autochiudono solo gli elementi che l'HTML dichiara vuoti.
    if (VUOTI.has(nome)) {
      if (nascosto) regioni.push([m.index, re.lastIndex]);
      continue;
    }
    // Chiusura IMPLICITA. Un `<li>` chiude il `<li>` precedente, e il browser fa
    // cosi' senza discutere. La pila non lo sapeva, quindi un `<li
    // style="display:none">` senza `</li>` nascondeva anche il fratello
    // successivo: il passo `informativa-privacy` chiudeva «nessun collegamento
    // a un'informativa» su un pie' di pagina scritto in una forma legale e
    // diffusa. E' un ROSSO SU UN SITO CONFORME, cioe' la via piu' rapida
    // perche' un gate venga scavalcato per abitudine (`DECISIONI.md` §8).
    const chiudeIFratelli = IMPLICITE[nome];
    if (chiudeIFratelli) {
      const cima = pila[pila.length - 1];
      if (cima && chiudeIFratelli.has(cima.nome)) {
        if (cima.nascosto) profondita -= 1;
        const suoi = dove.get(cima.nome);
        if (suoi && suoi[suoi.length - 1] === pila.length - 1) suoi.pop();
        pila.pop();
        if (profondita === 0 && inizio !== null) {
          regioni.push([inizio, m.index]);
          inizio = null;
        }
      }
    }
    if (nascosto && profondita === 0) inizio = m.index;
    if (nascosto) profondita += 1;
    if (!dove.has(nome)) dove.set(nome, []);
    dove.get(nome).push(pila.length);
    pila.push({ nome, nascosto });
  }
  // Contenitori nascosti mai chiusi: nascondono fino alla fine del documento.
  if (profondita > 0 && inizio !== null) regioni.push([inizio, testo.length]);
  // Fuse e ordinate: un elemento vuoto nascosto DENTRO un contenitore nascosto
  // si registra prima del contenitore che lo contiene, quindi l'elenco grezzo
  // non e' ordinato — e la ricerca binaria di `dentroRegioni` lo pretende.
  return fondiIntervalli(regioni);
}

/**
 * Il carattere `i` sta dentro una regione nascosta?
 *
 * Ricerca binaria, non `some`: le regioni arrivano in ordine di documento e chi
 * chiama scorre i collegamenti in ordine crescente, quindi il confronto lineare
 * costava O(collegamenti × regioni) — misurato dal tribunale, 1,7 MB di pagina
 * con molte regioni e molti collegamenti costavano 6,4 s.
 */
const dentroRegioni = (regioni, i) => {
  let a = 0;
  let b = regioni.length - 1;
  while (a <= b) {
    const m = (a + b) >> 1;
    if (i < regioni[m][0]) b = m - 1;
    else if (i >= regioni[m][1]) a = m + 1;
    else return true;
  }
  return false;
};

export function candidatiInformativa(html, base) {
  const pulito = senzaScript(html);
  const nascoste = regioniNascoste(pulito);
  const trovati = new Map();
  // `elementiDi` invece della regexp con `[\s\S]*?`: stessa quadratica di
  // `<label>` mai chiusa, su un elemento che una pagina puo' avere a centinaia.
  for (const { tag, dentro, da } of elementiDi(pulito, "a")) {
    const attr = attributi(tag);
    const percorso = percorsoInterno(attr.href, base);
    if (!percorso) continue;
    // Un collegamento NASCOSTO non e' un collegamento che chi visita puo'
    // seguire: `<a hidden>privacy</a>` valeva quanto quello nel piè di pagina, e
    // bastava a piazzare un'esca (SD-VERDE-04). Si guarda l'ancora **e i suoi
    // contenitori**: nascondere il `<li>` intorno era il modo naturale di farlo,
    // e passava (collaudo P2).
    if (tagNascosto(tag) || dentroRegioni(nascoste, da)) continue;
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

  // `soloVisibile`: il documento che dice chi risponde dei dati non puo' essere
  // bianco per chi lo apre e completo per il gate. Misurato dal tribunale: 516
  // caratteri e sette voci dell'art. 13 dentro un `<div style="display:none">`
  // superavano tutti i bloccanti di questo passo.
  const testo = testoVisibile(htmlInformativa ?? "", { soloVisibile: true });
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
 *
 * Il tribunale del 2026-08-06 ha trovato la stessa assunzione sopravvissuta nel
 * filtro per NOME: il prefisso non era ancorato, quindi `name="__email"` e
 * `name="csrf_telefono"` sparivano PRIMA della classificazione, e con loro sia
 * il bloccante di `dati-raccolti` sia il controllo dell'etichetta. Ora sono nomi
 * INTERI (solo `$ACTION`/`_next` restano prefissi, perche' li' il framework
 * concatena davvero), e un campo che dichiara di raccogliere — un `autocomplete`
 * dell'elenco personale, un `type` email/tel — non si scarta comunque: se il
 * modulo stesso dice che raccoglie, non e' un campo di servizio.
 */
const NOMI_DI_SERVIZIO = /^(\$ACTION[\w-]*|_next\w*|_?csrf|xsrf|authenticity_token|utf8|_method)$/i;

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
    // La grammatica dell'autofill ammette i token opzionali `section-*`,
    // `shipping`/`billing` e `home`/`work`/`mobile` PRIMA del nome del campo:
    // `autocomplete="billing postal-code"` e' markup a regola d'arte, e il
    // confronto sulla stringa intera lo mancava. Anche uno spazio in coda
    // bastava a spegnere la prova che questo file chiama forte.
    const auto = (a.autocomplete ?? "").toLowerCase().trim().replace(/\s+/g, " ");
    const ultimoToken = auto.split(" ").at(-1) ?? "";
    if (elemento === "input" && TIPI_NON_DATO.has(tipo)) return;
    // Un campo che DICHIARA di raccogliere non e' un campo di servizio, anche se
    // il suo nome somiglia a uno.
    const dichiaraDiRaccogliere = AUTOCOMPLETE_PERSONALI.has(ultimoToken) || tipo === "email" || tipo === "tel";
    if (!dichiaraDiRaccogliere && NOMI_DI_SERVIZIO.test(a.name ?? "")) return;
    campi.push({
      elemento,
      tipo,
      nome: a.name ?? a.id ?? "",
      id: a.id ?? "",
      form: a.form ?? "",
      autocomplete: ultimoToken,
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

/**
 * **Dove va a finire quello che il modulo raccoglie.**
 *
 * Il passo `dati-raccolti` provava che ogni campo personale avesse una base
 * giuridica scritta e che il punto di raccolta rimandasse all'informativa. Non
 * guardava l'`action`, e il collaudo P2 ha misurato cosa costa: un modulo
 * pubblico con `autocomplete="name"`, `type="email"` e `autocomplete="tel"` e
 * `action="https://moduli.esempio.com/raccogli"` usciva **VERDE su tutti e nove
 * i passi**. Nome, email e telefono di chi visita se ne andavano a un terzo che
 * il certificato non nominava, e nemmeno il censimento dei terzi lo vedeva —
 * l'`action` di un `<form>` non era nell'elenco degli elementi.
 *
 * E' il caso piu' grave possibile per questa skill: la regola sui terzi dice
 * che non dichiararli e' un **bloccante** «proprio perche' cosa fanno nel
 * browser questo gate non lo puo' misurare», e un terzo che riceve il modulo
 * non deve nemmeno fare niente nel browser — i dati glieli consegna il sito.
 *
 * Due bloccanti, e per tutti e due la prova sta **interamente nel documento**
 * (`DECISIONI.md` §17):
 *   - l'`action` porta a un'**altra origine**: e' un destinatario ai sensi
 *     dell'art. 13, e va dichiarato;
 *   - l'`action` viaggia in **chiaro** (`http:`): i dati attraversano la rete
 *     leggibili da chiunque. L'ambiente locale e' escluso, perche' i banchi di
 *     questa casa vivono su `127.0.0.1`.
 */
export function destinazioniModuli(html, base) {
  const pulito = senzaScript(html);
  const mia = new URL(base);
  const fuori = [];
  for (const { tag, dentro } of moduliConContenuto(pulito)) {
    const attr = attributi(tag);
    const azione = (attr.action ?? "").trim();
    if (!azione) continue;
    let url;
    try {
      url = new URL(azione, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    const locale = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(url.hostname);
    fuori.push({
      azione,
      origine: url.origin,
      altraOrigine: url.host !== mia.host,
      destinazione: percorsoInterno(azione, base),
      inChiaro: url.protocol === "http:" && !locale,
      campi: [...campiDiPagina(dentro), ...campiLegatiPerId(pulito, attr.id)],
    });
  }
  return fuori;
}

/**
 * I `<form>` con il loro contenuto, **anche quando il tag di chiusura non c'e'**.
 *
 * `elementiDi` pretende il `</form>`, e il browser no: un modulo senza chiusura
 * invia lo stesso. Il tribunale l'ha misurato — togliendo un tag di chiusura,
 * `destinazioniModuli` tornava `[]` mentre i campi c'erano tutti, e i due
 * bloccanti introdotti dal collaudo P2 («li invia a un'ALTRA ORIGINE», «li invia
 * IN CHIARO») non scattavano piu'. Un modulo non chiuso arriva fino al prossimo
 * `<form` o alla fine del documento, che e' esattamente cio' che fa il parser.
 */
function moduliConContenuto(pulito) {
  const apre = new RegExp(`<form\\b${DENTRO_TAG}>`, "gi");
  const trovati = [];
  const aperture = [];
  let m;
  while ((m = apre.exec(pulito)) !== null) aperture.push({ tag: m[0], da: m.index, dopo: apre.lastIndex });
  for (let i = 0; i < aperture.length; i += 1) {
    const limite = i + 1 < aperture.length ? aperture[i + 1].da : pulito.length;
    const resto = pulito.slice(aperture[i].dopo, limite);
    const chiude = /<\/form\s*>/i.exec(resto);
    trovati.push({ tag: aperture[i].tag, dentro: chiude ? resto.slice(0, chiude.index) : resto });
  }
  return trovati;
}

/**
 * I campi legati a un modulo con `form="<id>"`, che vivono FUORI dal suo tag.
 *
 * E' HTML5 ordinario nei layout a griglia, e senza questo il modulo risultava
 * senza campi personali — quindi `findingsDatiRaccolti` faceva `continue` prima
 * di guardare dove finivano i dati.
 */
function campiLegatiPerId(pulito, id) {
  if (!id) return [];
  return campiDiPagina(pulito).filter((c) => c.form === id);
}

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
/**
 * La prova DEBOLE: il nome del campo. Un elenco, non una regexp ancorata.
 *
 * La prima stesura confrontava il nome INTERO con quindici parole italiane
 * (`/^(nome|cognome|…)$/`). Il collaudo P2 ha misurato quanto lascia passare,
 * con un modulo pubblico che chiedeva l'indirizzo di residenza, la data di
 * nascita e **il caricamento di un documento d'identita'**: `0 bloccanti,
 * 1 da guardare` — l'unico rilievo era su `tel`, e i tre campi veri passavano.
 *
 * Due cose non funzionavano, e nessuna delle due era l'idea:
 *   - **l'ancoraggio**: `user_email`, `contact-phone`, `datiCliente.telefono`
 *     e `billing[address]` sono le forme che i moduli veri usano, e nessuna e'
 *     uguale alla parola sola. Ora il nome si spezza in **parole** (separatori
 *     e camelCase) e basta che una sia dell'elenco;
 *   - **il vocabolario era italiano**, su una skill che esiste anche per
 *     misurare i siti multilingua. Il modulo inglese di un sito bilingue —
 *     `name`, `phone`, `address` — non lo vedeva nessuno.
 *
 * Resta prova **debole**, cioe' `issue` e non `block` (`DECISIONI.md` §17): un
 * campo che si chiama `nome` puo' essere il nome di una persona o il nome di
 * una pizza, e l'ancoraggio piu' largo rende quel caso piu' probabile, non meno.
 */
const PAROLE_PERSONALI = new Set([
  // italiano
  "nome", "cognome", "nominativo", "telefono", "tel", "cellulare", "cell", "fax", "pec",
  "indirizzo", "via", "citta", "comune", "provincia", "cap", "residenza", "domicilio",
  "nascita", "sesso", "genere", "azienda", "societa", "sociale", "fiscale", "iva", "iban",
  "documento", "passaporto", "patente", "identita", "recapito", "utente",
  // inglese
  "name", "surname", "lastname", "firstname", "fullname", "username", "email", "mail",
  "phone", "mobile", "telephone", "address", "street", "city", "town", "zip", "zipcode",
  "postcode", "postal", "country", "birth", "birthday", "dob", "gender", "sex",
  "company", "organization", "vat", "ssn", "passport",
]);

const FRASI_PERSONALI = [/codice fiscale/, /partita iva/, /data (di )?nascita/, /luogo (di )?nascita/, /date of birth/, /ragione sociale/, /carta (d )?identita/];

/** Le parole di un nome di campo: separatori e camelCase, senza accenti. */
function paroleDelNome(nome) {
  return String(nome ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[àá]/g, "a").replace(/[èé]/g, "e").replace(/[ìí]/g, "i").replace(/[òó]/g, "o").replace(/[ùú]/g, "u")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function classificaCampo(campo) {
  if (AUTOCOMPLETE_PERSONALI.has(campo.autocomplete)) {
    return { personale: true, prova: "forte", motivo: `autocomplete="${campo.autocomplete}"` };
  }
  if (campo.tipo === "email" || campo.tipo === "tel") {
    return { personale: true, prova: "forte", motivo: `type="${campo.tipo}"` };
  }
  const parole = paroleDelNome(campo.nome);
  const frase = parole.join(" ");
  const trovata = parole.find((p) => PAROLE_PERSONALI.has(p)) ?? FRASI_PERSONALI.find((f) => f.test(frase))?.source;
  if (trovata) {
    return { personale: true, prova: "debole", motivo: `il nome del campo e' "${campo.nome}"` };
  }
  // Un caricamento su un modulo PUBBLICO porta quello che gli si da', e quello
  // che la gente carica su un modulo di contatto e' una carta d'identita', un
  // curriculum, una cartella clinica. Prova debole perche' il file potrebbe
  // essere qualunque cosa: la sua natura non sta nel documento (§17).
  if (campo.tipo === "file") {
    return { personale: true, prova: "debole", motivo: 'e\' un caricamento di file (type="file") su un modulo pubblico' };
  }
  return { personale: false, prova: "nessuna", motivo: "" };
}

/** Dove va a finire il modulo: altra origine, chiaro, pagina non camminata. */
function findingsDestinazioni(pagina, superficie) {
  const findings = [];
  for (const m of pagina.destinazioni ?? []) {
    const personali = m.campi.filter((c) => classificaCampo(c).personale);
    if (personali.length === 0) continue;
    if (m.altraOrigine) {
      findings.push({
        severity: "block",
        object: `${pagina.percorso} → modulo verso ${m.origine}`,
        message: `raccoglie ${personali.length} dati personali e li invia a un'ALTRA ORIGINE (${m.origine}): e' un destinatario ai sensi dell'art. 13 e va dichiarato. Un terzo che riceve il modulo non deve nemmeno fare niente nel browser — i dati glieli consegna il sito`,
      });
    }
    if (m.inChiaro) {
      findings.push({
        severity: "block",
        object: `${pagina.percorso} → modulo verso ${m.origine}`,
        message: `raccoglie ${personali.length} dati personali e li invia IN CHIARO (${m.azione}): attraversano la rete leggibili da chiunque stia in mezzo`,
      });
    }
    // La camminata segue gli `<a href>`. Una pagina raggiungibile SOLO dal
    // bottone di un modulo resta fuori dalla superficie — ed e' un limite
    // dichiarato, ma il gate lo applicava in silenzio: restringeva l'insieme
    // che poi dichiarava conforme. Adesso lo dice. `issue` perche' la pagina
    // di destinazione di un POST spesso non e' navigabile da sola.
    if (!m.altraOrigine && superficie && !superficie.has(m.destinazione)) {
      findings.push({
        severity: "issue",
        object: `${pagina.percorso} → ${m.destinazione}`,
        message: "il modulo consegna dati personali a una pagina che la camminata NON ha raggiunto (i collegamenti si seguono, i bottoni no): quella pagina riceve dati e non e' stata certificata",
      });
    }
  }
  return findings;
}

export function findingsDatiRaccolti({ pagineConModuli, basiDichiarate, informativaRaggiungibile, superficie = null }) {
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
    findings.push(...findingsDestinazioni(pagina, superficie));
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

/**
 * Gli indizi di archiviazione che NON nominano l'API per intero.
 *
 * `window["local"+"Storage"]`, `document["coo"+"kie"]`, un `setItem` su un
 * riferimento tenuto in una variabile: sono forme che alcuni offuscatori e certi
 * widget di terze parti («analitiche senza cookie») usano di mestiere. Il
 * confronto per sottostringa non le vede, e con zero cookie e zero terzi il
 * passo chiudeva `n/a` — «il sito non mette niente nel browser di chi passa» —
 * mentre lo script scriveva.
 *
 * Un indizio NON e' una misura, e infatti non produce un elenco di API: produce
 * `incerto`, e il passo che lo riceve va **MANCANTE**, non `n/a`. La §18 vieta
 * il falso verde; non ammette la misura incerta travestita da non applicabile.
 */
const INDIZI_ARCHIVIAZIONE = /\.setItem\s*\(|\bsetItem\b|["']local["']\s*\+|["']session["']\s*\+|\+\s*["']Storage["']|\[\s*["']coo["']|["']kie["']\s*\]|\bopenDatabase\b/;

/**
 * Quali API di archiviazione compaiono nel testo di un bundle servito.
 *
 * `{ api, incerto }`: `api` sono i nomi pieni trovati, `incerto` dice che c'e'
 * un indizio senza nome pieno — cioe' che questo scanner NON sa rispondere.
 */
export function apiArchiviazioneIn(testo) {
  if (typeof testo !== "string") return [];
  return API_ARCHIVIAZIONE.filter((api) => testo.includes(api));
}

/** Un indizio di archiviazione senza il nome pieno dell'API: «non lo so», non «no». */
export function archiviazioneIncertaIn(testo) {
  if (typeof testo !== "string") return false;
  if (apiArchiviazioneIn(testo).length > 0) return false;
  return INDIZI_ARCHIVIAZIONE.test(testo);
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
    ["video", "src"], ["audio", "src"], ["source", "src"], ["embed", "src"], ["track", "src"], ["object", "data"],
    // Il tribunale ne ha nominato un quinto dopo i quattro del primo giro:
    // `poster` fa la stessa richiesta al dominio di qualcun altro.
    ["video", "poster"]]) {
    for (const t of tagDi(pulito, nome)) guarda(t, attributo, nome);
  }
  // L'attributo `style` in linea: `<div style="background-image:url(https://…)">`
  // scarica dal dominio di un terzo esattamente come un `<style>` — indirizzo IP
  // e User-Agent di chi visita compresi, che e' cio' che rende un terzo un
  // destinatario. Guardavamo l'ELEMENTO `<style>` e non l'ATTRIBUTO.
  for (const t of pulito.match(new RegExp(`<[a-zA-Z][a-zA-Z0-9-]*\\b${DENTRO_TAG}>`, "g")) ?? []) {
    const stile = attributi(t).style;
    if (!stile || !stile.includes("url(")) continue;
    for (const m of stile.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) aggiungi(m[1], "style");
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
  // `soloVisibile`: uno `<span style="display:none">Leggi tutto</span>` dentro
  // un collegamento non e' il nome di quel collegamento per nessuna tecnologia
  // assistiva, e prima lo era per questo gate.
  const daContenuto = testoVisibile(dentro ?? "", { soloVisibile: true });
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
  for (const qualsiasi of (dentro ?? "").match(new RegExp(`<[a-zA-Z]${DENTRO_TAG}>`, "gi"))?.filter((t) => /\baria-label\s*=/i.test(t)) ?? []) {
    const etichetta = attributi(qualsiasi)["aria-label"];
    if (etichetta?.trim()) return etichetta.trim();
  }
  return "";
}

/**
 * Quanto puo' essere lungo un `id` prima che smettere di cercarlo sia l'unica
 * cosa sensata.
 *
 * Il tribunale l'ha misurato ed e' il rilievo piu' brutto della tornata perche'
 * non e' un rallentamento: e' un **crash deterministico**. `id` finiva dentro la
 * sorgente di una `RegExp`, e oltre i ~30 KB V8 rifiuta il pattern con un
 * `SyntaxError` — non catturato qui, catturato da `main`, che esce **2** e
 * azzera tutti e nove i passi. Basta UN `aria-labelledby` lungo in una pagina
 * qualunque, e la citazione del `verify.mjs` e' la sua stessa: «un gate che va in
 * crash non e' ne' verde ne' rosso: e' assente, ed e' peggio di entrambi».
 *
 * Non e' un difetto di escape — `perRegexp` fa il suo lavoro e una stringa di
 * 40 000 `x` senza un metacarattere lo riproduce lo stesso. E' lunghezza.
 */
const ID_PIU_LUNGO = 2048;

/** Il testo visibile dell'elemento con quell'`id`, oppure `""` se non esiste. */
export function testoDellId(documento, id) {
  if (!documento || !id) return "";
  if (String(id).length > ID_PIU_LUNGO) return "";
  // `(?:^|[\s"'])id\s*=` e non `\bid\s*=`: in `data-id="eti"` il carattere prima
  // di `id` e' un trattino, che per `\b` e' un confine di parola — quindi un
  // `aria-labelledby` che punta al vuoto tornava a risolversi su un qualunque
  // `data-id` con quel valore, e nei framework a componenti i `data-*` con id
  // sintetici sono la norma. E' SD-VERDE-06 riaperto in forma piu' stretta.
  // Il valore si accetta anche SENZA apici: pretenderli era un falso rosso.
  const re = new RegExp(
    `<([a-zA-Z][a-zA-Z0-9-]*)\\b(?:[^>"']|"[^"]*"|'[^']*')*?[\\s]id\\s*=\\s*(?:"${perRegexp(id)}"|'${perRegexp(id)}'|${perRegexp(id)}(?=[\\s>]))${DENTRO_TAG}>([\\s\\S]*?)<\\/\\1>`,
    "i",
  );
  const m = re.exec(documento);
  return m ? testoVisibile(m[2], { soloVisibile: true }) : "";
}

/** I livelli dei titoli, in ordine di documento. */
export function livelliTitoli(html) {
  const pulito = senzaScript(html);
  const re = new RegExp(`<h([1-6])\\b${DENTRO_TAG}>`, "gi");
  const livelli = [];
  let m;
  while ((m = re.exec(pulito)) !== null) livelli.push(Number(m[1]));
  return livelli;
}

/** Le regole del documento: titolo, lingua, punto di salto. */
function regoleDocumento(html, pulito, dove) {
  // Il titolo si cerca nel documento RIPULITO e **prima del `<body>`**, e sono
  // due correzioni distinte dello stesso rilievo del tribunale. Sul grezzo
  // passavano un `<title>` dentro un commento e uno dentro un valore di
  // attributo (la chiave universale, su l'unica riga del passo che non
  // guardava il ripulito); e un `<svg><title>icona</title></svg>` nel corpo —
  // markup che questa casa RACCOMANDA, perche' e' il rimedio SD-ROSSO-01 —
  // chiudeva il bloccante sulla prima cosa che uno screen reader annuncia.
  const testa = pulito.split(new RegExp(`<body\\b${DENTRO_TAG}>`, "i"))[0];
  const titolo = new RegExp(`<title${DENTRO_TAG}>([\\s\\S]*?)</title>`, "i").exec(testa);
  if (!titolo || testoVisibile(titolo[1]).length === 0) dove("nessun <title>, o vuoto: e' la prima cosa che uno screen reader annuncia");

  const html5 = new RegExp(`<html\\b${DENTRO_TAG}>`, "i").exec(pulito);
  const lang = html5 ? attributi(html5[0]).lang : undefined;
  if (!lang || !lang.trim()) dove("nessun attributo `lang` su <html>: la sintesi vocale non sa in che lingua leggere");

  const main = tagDi(pulito, "main").length;
  if (main === 0) dove("nessun elemento <main>: chi naviga con la tastiera non ha un punto di salto al contenuto", "issue");
  // Collaudo P2: si guardava solo l'assenza. Due `<main>` sono HTML non valido
  // e il punto di salto smette di essere un punto: chi naviga per landmark ne
  // trova due e non sa quale sia il contenuto. `issue` come l'assenza, per la
  // stessa ragione — un documento puo' restare usabile con altri landmark.
  else if (main > 1) dove(`${main} elementi <main> nella stessa pagina: il punto di salto al contenuto non e' piu' uno`, "issue");
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
    // `pagine.length` come conteggio, e non solo la premessa: la funzione che
    // possiede il contratto dei quattro stati deve difenderlo da sola. Prima il
    // «di 0 pagine» era irraggiungibile solo perche' il chiamante anteponeva
    // `superficieUsabile` — cioe' il falso verde era chiuso in un punto e aperto
    // nella regola, e il prossimo consumatore lo avrebbe riaperto senza toccare
    // una riga di qui.
    return { findings, stato: statoDaFindings(findings) === "fail" ? "fail" : statoNonApplicabile(premessa, pagine.length), premessa };
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
    // Un hreflang che punta FUORI dall'origine misurata non si puo' giudicare
    // da qui, e tacere sarebbe un falso verde silenzioso: si dice.
    if (p.hreflang.every((h) => !h.interno)) {
      findings.push({
        severity: "issue",
        object: p.percorso,
        message: "tutti gli `hreflang` di questa pagina puntano fuori dall'origine misurata: la reciprocita' NON e' stata verificata su nessuno di essi",
      });
    }
    for (const h of p.hreflang) {
      // Collaudo P2: qui c'era un `continue` muto. Un `hreflang` — `x-default`
      // compreso — verso una pagina che la camminata non ha raggiunto usciva
      // VERDE, cioe' il passo taceva proprio sulla dichiarazione falsa.
      if (h.interno && !perPagina.has(h.percorso)) {
        findings.push({
          severity: "block",
          object: p.percorso,
          message: `dichiara \`${h.percorso}\` come versione "${h.hreflang}", e quella pagina non e' nella superficie camminata: o non risponde, o non la linka nessuno. Un rimando alternativo verso il vuoto i motori lo ignorano insieme a tutto il gruppo`,
        });
        continue;
      }
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
    const interno = percorsoInterno(a.href, base);
    trovati.push({ hreflang: a.hreflang, percorso: interno ?? a.href, interno: interno !== null });
  }
  return trovati;
}

/** Il `lang` di <html>, oppure `null`. */
export function langDi(html) {
  const tag = new RegExp(`<html\\b${DENTRO_TAG}>`, "i").exec(senzaScript(html));
  const lang = tag ? attributi(tag[0]).lang : "";
  return lang && lang.trim() ? lang.trim() : null;
}

// ═══════════════════════════ le cinque voci tornate a casa — decisione D21
/**
 * **Perché queste cinque voci sono qui dal 2026-08-06.**
 *
 * Erano delegate a speed-demon, e il collaudo P2 ha misurato che il suo gate non
 * le guarda: zero occorrenze di `favicon`, di `og:`, di `application/ld` nei suoi
 * script; `sitemap` e `robots.txt` scritti e mai riletti. La delega non era
 * sbagliata per argomento — era **vuota**, e una voce delegata a un gate che non
 * la misura e' la favicon a 404 del pilota spostata di un piano.
 *
 * La direzione ha deciso che la proprieta' segue la MISURA, non l'argomento:
 * queste cinque si leggono nell'HTML che questa skill sta gia' scaricando, o
 * costano una richiesta HTTP a chi cammina gia' ogni pagina. I `contrasti`
 * restano di speed-demon, perche' vogliono un browser e questo gate non ne apre
 * nessuno.
 *
 * **Il criterio comune delle cinque regole**, e vale la pena scriverlo una volta
 * sola: *il dichiarato che non risponde e' un bloccante, l'assenza e' un
 * rilievo.* Una pagina che scrive `<link rel="icon" href="/favicon.svg">` e
 * serve un 404 ha **mentito nel markup servito**, e chi legge quel markup — un
 * browser, un motore, il prossimo agente — sbaglia per causa sua. Un'assenza
 * invece e' una scelta, e una scelta si firma in una deroga.
 */

/** Gli `href` delle icone dichiarate da una pagina, senza duplicati. */
export function iconeDichiarate(html, base) {
  const pulito = senzaScript(html);
  const trovate = new Set();
  for (const tag of tagDi(pulito, "link")) {
    const a = attributi(tag);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    if (!rel.some((r) => r === "icon" || r === "shortcut" || r === "apple-touch-icon" || r === "mask-icon")) continue;
    const href = (a.href ?? "").trim();
    if (!href || /^data:/i.test(href)) continue;
    try {
      trovate.add(new URL(href, base).toString());
    } catch { /* href illeggibile: non e' un'icona dichiarata */ }
  }
  return [...trovate];
}

/**
 * La favicon: **la voce da cui questa skill e' nata**.
 *
 * Sul pilota e' stata un `404` su ogni pagina per tre anelli, perche' due
 * documenti dicevano che se ne occupava qualcun altro. `risposte` e' una mappa
 * `url → stato HTTP` (o `null` se non si e' potuto scaricare).
 */
export function findingsFavicon({ pagine, risposte, predefinita }) {
  const findings = [];
  const senza = [];
  for (const p of pagine) {
    const icone = p.icone ?? [];
    if (icone.length === 0) { senza.push(p.percorso); continue; }
    for (const url of icone) {
      const stato = risposte.get(url);
      if (stato === null || stato === undefined) {
        findings.push({ severity: "block", object: p.percorso, message: `dichiara l'icona \`${url}\` e quell'indirizzo non risponde: il markup promette una cosa che il server non consegna` });
      } else if (stato !== 200) {
        findings.push({ severity: "block", object: p.percorso, message: `dichiara l'icona \`${url}\` e quell'indirizzo risponde HTTP ${stato}. E' il difetto del pilota: la favicon e' stata un 404 su ogni pagina per tre anelli, e questa skill nasce da li'` });
      }
    }
  }
  if (senza.length === pagine.length && pagine.length > 0) {
    // Nessuna pagina dichiara un'icona: il browser chiede `/favicon.ico` da solo.
    if (predefinita !== 200) {
      findings.push({
        severity: "block",
        object: "favicon",
        message: `nessuna delle ${pagine.length} pagine dichiara un'icona, e \`/favicon.ico\` risponde ${predefinita === null ? "niente" : `HTTP ${predefinita}`}: ogni browser che apre questo sito fa una richiesta e prende un errore, su ogni pagina`,
      });
    }
  } else if (senza.length > 0) {
    findings.push({ severity: "issue", object: "favicon", message: `${senza.length} pagine su ${pagine.length} non dichiarano un'icona (${senza.slice(0, 5).join(", ")}${senza.length > 5 ? " …" : ""})` });
  }
  return findings;
}

/** I metatag Open Graph di una pagina: `{ proprieta: valore }`. */
export function openGraphDi(html) {
  const mappa = {};
  for (const tag of tagDi(senzaScript(html), "meta")) {
    const a = attributi(tag);
    const nome = (a.property ?? a.name ?? "").toLowerCase();
    if (!nome.startsWith("og:")) continue;
    if (!(nome in mappa)) mappa[nome] = (a.content ?? "").trim();
  }
  return mappa;
}

/** Le voci che un'anteprima social deve avere per essere un'anteprima. */
const OG_OBBLIGATORIE = Object.freeze(["og:title", "og:type", "og:url", "og:image"]);

export function findingsOpenGraph({ pagine, risposte }) {
  const findings = [];
  const senza = pagine.filter((p) => Object.keys(p.og ?? {}).length === 0);
  if (senza.length === pagine.length && pagine.length > 0) {
    return [{ severity: "issue", object: "open-graph", message: `nessuna delle ${pagine.length} pagine dichiara un solo tag Open Graph: chi condivide un indirizzo di questo sito ottiene un'anteprima che il sito non ha scelto` }];
  }
  if (senza.length > 0) {
    findings.push({ severity: "issue", object: "open-graph", message: `${senza.length} pagine su ${pagine.length} non dichiarano nessun tag Open Graph (${senza.slice(0, 5).map((p) => p.percorso).join(", ")}${senza.length > 5 ? " …" : ""})` });
  }
  for (const p of pagine) {
    const og = p.og ?? {};
    if (Object.keys(og).length === 0) continue;
    const mancanti = OG_OBBLIGATORIE.filter((k) => !og[k]);
    if (mancanti.length > 0) {
      findings.push({ severity: "issue", object: p.percorso, message: `dichiara l'Open Graph e gli mancano ${mancanti.join(", ")}: un'anteprima a meta' e' quella che decide il motore, non il sito` });
    }
    const immagine = p.immagine;
    if (!immagine) continue;
    const stato = risposte.get(immagine);
    if (stato === null || stato === undefined) {
      findings.push({ severity: "block", object: p.percorso, message: `\`og:image\` punta a \`${immagine}\` e quell'indirizzo non risponde` });
    } else if (stato !== 200) {
      findings.push({ severity: "block", object: p.percorso, message: `\`og:image\` punta a \`${immagine}\` e quell'indirizzo risponde HTTP ${stato}: l'anteprima promessa non esiste` });
    }
  }
  return findings;
}

/** I corpi dei blocchi `application/ld+json` di una pagina. */
export function blocchiJsonLd(html) {
  return ripulisciDocumento(html).inline
    .filter(({ tag }) => /type\s*=\s*["']?application\/ld\+json/i.test(tag))
    .map(({ corpo }) => corpo);
}

export function findingsDatiStrutturati({ pagine }) {
  const findings = [];
  let conBlocchi = 0;
  for (const p of pagine) {
    const blocchi = p.jsonld ?? [];
    if (blocchi.length === 0) continue;
    conBlocchi += 1;
    for (const corpo of blocchi) {
      let dati;
      try {
        dati = JSON.parse(corpo);
      } catch (e) {
        findings.push({ severity: "block", object: p.percorso, message: `un blocco \`application/ld+json\` NON e' JSON valido (${perStampa(e.message, 100)}): un motore lo scarta per intero, e il sito crede di avere dati strutturati` });
        continue;
      }
      const elenco = Array.isArray(dati) ? dati : [dati];
      for (const d of elenco) {
        if (!d || typeof d !== "object") {
          findings.push({ severity: "block", object: p.percorso, message: "un blocco `application/ld+json` contiene JSON valido che non e' un oggetto: non dichiara niente" });
        } else if (!d["@type"]) {
          findings.push({ severity: "issue", object: p.percorso, message: "un blocco `application/ld+json` non dichiara `@type`: senza, non dice di che cosa parla" });
        }
      }
    }
  }
  if (conBlocchi === 0 && pagine.length > 0) {
    findings.push({ severity: "issue", object: "dati-strutturati", message: `nessuna delle ${pagine.length} pagine dichiara dati strutturati (\`application/ld+json\`)` });
  }
  return findings;
}

const RE_SITEMAP_XML = /<\s*(urlset|sitemapindex)\b/i;

/**
 * La `sitemap.xml`, misurata invece che scritta e dimenticata.
 *
 * Il passo `superficie-pubblica` la usa come **seconda sorgente** e non la
 * verifica: sono due domande diverse, ed e' il motivo per cui questa voce
 * esiste come passo suo.
 */
export function findingsSitemap({ risposta, percorsi, superficie, rimandi }) {
  if (!risposta) {
    return [{ severity: "issue", object: "sitemap.xml", message: "`/sitemap.xml` non risponde: i motori non hanno l'elenco che il sito dichiara di pubblicare, e la camminata di questo gate perde la sua seconda sorgente" }];
  }
  if (risposta.stato !== 200) {
    return [{ severity: "issue", object: "sitemap.xml", message: `\`/sitemap.xml\` risponde HTTP ${risposta.stato}` }];
  }
  const findings = [];
  if (!RE_SITEMAP_XML.test(risposta.corpo)) {
    findings.push({
      severity: "block",
      object: "sitemap.xml",
      message: `\`/sitemap.xml\` risponde 200 e il corpo non e' una sitemap (nessun \`<urlset>\` ne' \`<sitemapindex>\`; primi byte: ${perStampa(risposta.corpo.slice(0, 80), 80)}). Un 200 che serve un'altra cosa e' peggio di un 404: chi lo interroga crede di avere una risposta`,
    });
    return findings;
  }
  if (percorsi.length === 0) {
    findings.push({ severity: "issue", object: "sitemap.xml", message: "`/sitemap.xml` e' una sitemap e non dichiara nessun indirizzo: e' rotta, non assente" });
    return findings;
  }
  for (const p of percorsi) {
    if (superficie.has(p)) continue;
    const perche = rimandi.get(p);
    findings.push({
      severity: "block",
      object: p,
      message: `dichiarato nella sitemap e non servito${perche ? ` (${perStampa(perche, 80)})` : ""}: la sitemap e' la promessa che il sito fa ai motori, e questa non la mantiene`,
    });
  }
  return findings;
}

/**
 * `robots.txt`, e **il confronto che nessun gate della casa faceva**.
 *
 * Il collaudo P2 l'aveva elencato fra le cose scoperte: «un `robots.txt` che
 * vieta la pagina che la `sitemap.xml` pubblicizza — due file che scrive lo
 * stesso agente e che nessuno confronta». Con D21 sono tutti e due di questa
 * skill, e il confronto e' finalmente di qualcuno.
 */
export function leggiRobots(testo) {
  const gruppi = [];
  let corrente = null;
  const sitemap = [];
  for (const riga of String(testo ?? "").split(/\r?\n/)) {
    const pulita = riga.replace(/#.*$/, "").trim();
    if (!pulita) continue;
    const i = pulita.indexOf(":");
    if (i < 0) continue;
    const campo = pulita.slice(0, i).trim().toLowerCase();
    const valore = pulita.slice(i + 1).trim();
    if (campo === "user-agent") {
      if (!corrente || corrente.regole.length > 0) {
        corrente = { agenti: [], regole: [] };
        gruppi.push(corrente);
      }
      corrente.agenti.push(valore.toLowerCase());
    } else if (campo === "disallow" || campo === "allow") {
      if (!corrente) { corrente = { agenti: ["*"], regole: [] }; gruppi.push(corrente); }
      corrente.regole.push({ tipo: campo, percorso: valore });
    } else if (campo === "sitemap") {
      sitemap.push(valore);
    }
  }
  return { gruppi, sitemap };
}

/** Le regole che valgono per tutti (`User-agent: *`). */
const regolePerTutti = (robots) => robots.gruppi.filter((g) => g.agenti.includes("*")).flatMap((g) => g.regole);

/** Un percorso e' vietato a tutti? Vince la regola PIU' LUNGA, come da standard. */
export function vietatoAiMotori(robots, percorso) {
  let vincente = null;
  for (const r of regolePerTutti(robots)) {
    if (r.tipo === "disallow" && r.percorso === "") continue; // `Disallow:` vuoto NON vieta niente
    if (!percorso.startsWith(r.percorso.replace(/\*$/, ""))) continue;
    if (!vincente || r.percorso.length > vincente.percorso.length) vincente = r;
  }
  return vincente ? vincente.tipo === "disallow" : false;
}

export function findingsRobots({ risposta, robots, superficie, inSitemap, base }) {
  if (!risposta) {
    return [{ severity: "issue", object: "robots.txt", message: "`/robots.txt` non risponde: ogni motore che passa fa una richiesta e prende un errore, e nessuno ha scritto cosa il sito ammette" }];
  }
  if (risposta.stato !== 200) {
    return [{ severity: "issue", object: "robots.txt", message: `\`/robots.txt\` risponde HTTP ${risposta.stato}` }];
  }
  const findings = [];
  const vietate = [...superficie].filter((p) => vietatoAiMotori(robots, p)).sort();
  const vietateEPubblicizzate = vietate.filter((p) => inSitemap.has(p));
  if (vietateEPubblicizzate.length > 0) {
    findings.push({
      severity: "block",
      object: "robots.txt",
      message: `vieta ${vietateEPubblicizzate.length} indirizzi che la \`sitemap.xml\` pubblicizza (${vietateEPubblicizzate.slice(0, 5).join(", ")}${vietateEPubblicizzate.length > 5 ? " …" : ""}). Sono due file dello stesso sito che dicono il contrario, e uno dei due e' sbagliato: finche' non si decide quale, il sito chiede di essere indicizzato e lo vieta`,
    });
  }
  const soloVietate = vietate.filter((p) => !inSitemap.has(p));
  if (soloVietate.length > 0) {
    findings.push({ severity: "issue", object: "robots.txt", message: `vieta ${soloVietate.length} pagine pubbliche raggiungibili camminando (${soloVietate.slice(0, 5).join(", ")}${soloVietate.length > 5 ? " …" : ""}): se e' voluto va scritto nel certificato, perche' quelle pagine non compariranno in nessuna ricerca` });
  }
  if (robots.sitemap.length === 0) {
    findings.push({ severity: "issue", object: "robots.txt", message: "non contiene nessuna riga `Sitemap:`: e' il modo in cui un motore trova l'elenco senza doverlo indovinare" });
  } else {
    for (const s of robots.sitemap) {
      let url = null;
      try {
        url = new URL(s, base);
      } catch { /* riga illeggibile */ }
      if (!url) {
        findings.push({ severity: "issue", object: "robots.txt", message: `la riga \`Sitemap: ${perStampa(s, 80)}\` non e' un indirizzo leggibile` });
      } else if (url.host !== new URL(base).host) {
        findings.push({ severity: "issue", object: "robots.txt", message: `la riga \`Sitemap:\` rimanda a un'altra origine (${url.origin}): un motore la ignora` });
      }
    }
  }
  return findings;
}
