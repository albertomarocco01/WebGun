/**
 * gate-lib.mjs — Le regole del gate di Flow Sentinel, pure e testabili.
 *
 * Perche' separate da `verify.mjs`: le regole di Schema Forge sono vissute per
 * mesi dentro il guscio di I/O, non si potevano eseguire senza un database, e
 * due bug (il `\r` di psql su Windows, il cast booleano) sono rimasti vivi dal
 * primo giorno perche' nessun test poteva vederli. Qui dentro non c'e' un
 * accesso al disco, una rete, un processo figlio: solo stringhe che entrano e
 * verdetti che escono. `verify.mjs` resta un guscio di passi.
 *
 * Ogni funzione esportata ha un test che la fa scattare E uno in cui non deve
 * scattare (`scripts/gate-lib.test.mjs`).
 *
 * Forma dei rilievi: `{ severity, object, message }` — le stesse chiavi inglesi
 * di `rls-audit.mjs` di Schema Forge (DECISIONI.md §15: il formato di scambio
 * resta com'e' nato, le etichette per gli umani restano italiane).
 *
 * Zero import, anche dopo l'arrivo delle regole su QUALE eseguibile si lancia
 * (§ C1 del referto 2026-08-06): il confronto fra percorsi si fa a segmenti,
 * non con `node:path`, cosi' la regola vale uguale su ogni piattaforma e il suo
 * test pure. Il `spawnSync` resta fuori di qui.
 */

// ---------------------------------------------------------------- fondamenta

// Windows lascia due tracce in ogni file di testo che questo gate legge: il
// CRLF e, se il file e' passato da PowerShell, il BOM. Nessuna delle due porta
// significato, ed entrambe hanno gia' fatto nascere rosso un passo verde
// (Schema Forge, confronto dei tipi byte a byte). Si tolgono qui, una volta.
const righe = (testo) =>
  senzaBom(testo).split(/\r?\n/);

const senzaBom = (testo) => String(testo ?? "").replace(/^\uFEFF/, "");

/**
 * Cio' che un documento CITA non e' cio' che dichiara.
 *
 * I due documenti che questo gate legge \u2014 il contratto dei flussi e l'handoff \u2014
 * sono markdown scritto da umani, e un markdown scritto da umani contiene
 * esempi: un recinto di codice che mostra il formato, un commento HTML col
 * promemoria del template, l'uscita dell'esecuzione di ieri incollata.
 * Riprodotto il 2026-07-28 al collaudo, quattro guasti dallo stesso buco:
 *
 * - un handoff che dichiara `Gate: VERDE` su un gate ROSSO **passava**, perche'
 *   piu' sopra citava in un recinto il `Gate: ROSSO` dell'esecuzione
 *   precedente e vince la prima occorrenza. E' il caso peggiore: incollare
 *   l'uscita del gate nell'handoff e' esattamente cio' che prescrive
 *   `references/sabotaggio.md`;
 * - una firma che esiste **solo** dentro un esempio recintato valeva come
 *   firma, e il gate stampava l'esempio al posto del firmatario;
 * - un esempio di intestazione dentro un recinto diventava un flusso fantasma
 *   (`block` di copertura su un id che nessuno ha dichiarato), e se l'esempio
 *   riusava un id vero il passo accusava \u00ABid ripetuto\u00BB un documento con un id
 *   solo. La reference della casa, letta come contratto, produce quell'errore;
 * - uno snippet CI legittimo (`${{ secrets.X }}` di GitHub Actions) faceva
 *   fallire il controllo dei segnaposto `{{...}}` dell'handoff.
 *
 * Le righe citate diventano vuote invece di sparire: la numerazione resta
 * quella del file, cosi' un messaggio che citi una riga cita quella giusta.
 * Un recinto mai chiuso spegne tutto cio' che segue \u2014 il guasto va nella
 * direzione sicura (nessun flusso letto = premessa mancante = MANCANTE), non
 * in quella di un verde.
 */
function senzaZoneCitate(testo) {
  let inRecinto = false;
  let inCommento = false;
  return righe(testo)
    .map((linea) => {
      if (!inCommento && /^\s{0,3}(```|~~~)/.test(linea)) {
        inRecinto = !inRecinto;
        return "";
      }
      if (inRecinto) return "";
      let resto = linea;
      if (inCommento) {
        const fine = resto.indexOf("-->");
        if (fine === -1) return "";
        inCommento = false;
        resto = resto.slice(fine + 3);
      }
      for (;;) {
        const apre = resto.indexOf("<!--");
        if (apre === -1) return resto;
        const chiude = resto.indexOf("-->", apre + 4);
        if (chiude === -1) {
          inCommento = true;
          return resto.slice(0, apre);
        }
        resto = resto.slice(0, apre) + resto.slice(chiude + 3);
      }
    })
    .join("\n");
}

/** I tre tipi di flusso. L'ordine e' quello di `references/flussi-critici.md`. */
const TIPI_FLUSSO = Object.freeze(["positivo", "ostile-lettura", "ostile-scrittura"]);

/**
 * I tipi che DEVONO asserire l'effetto sul database.
 * `ostile-lettura` non c'e' apposta: un attacco in lettura non cambia niente,
 * quindi non c'e' stato da confrontare — il rifiuto della rotta e' l'asserzione.
 */
const TIPI_CON_EFFETTO_DB = Object.freeze(["positivo", "ostile-scrittura"]);

/** Un rilievo per riga, nella forma in cui lo legge un umano nel dettaglio. */
export const dettaglioFindings = (findings) =>
  findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}`).join("\n");

/** Conteggi per gravita': finiscono in `counts` del contratto `--json`. */
export function contaGravita(findings) {
  const per = (g) => findings.filter((f) => f.severity === g).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

/** Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano. */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

// -------------------------------------------------- il contratto dei flussi
// `docs/flussi-critici.md` non e' un augurio: e' l'elenco confermato. Il
// formato e' in `resources/templates/flussi-critici.md`.
//
//     ## `crea-prodotto` — positivo
//
// L'id sta fra apici inversi (facoltativi) e il tipo dopo un trattino. Si
// accettano trattino, mezza lineetta e lineetta lunga: sono tre modi di
// scrivere lo stesso separatore in markdown, non tre significati.
const INTESTAZIONE_FLUSSO = /^##\s+`?([a-z0-9][a-z0-9-]*)`?\s*[—–-]\s*([a-z-]+)\s*$/;

// Tollera elenco puntato, citazione e grassetto — come la riga `Gate:`: sono
// tre modi di scrivere la stessa riga in markdown, non tre significati.
// Gli spazi ammessi sono SOLO orizzontali. Con `\s` la classe includeva l'a
// capo, e una riga `Confermato da:` VUOTA catturava la prima riga non vuota
// che seguiva — cioe' l'intestazione del primo flusso: il gate dichiarava
// confermato un contratto che nessuno aveva firmato. Riprodotto il 2026-07-28
// e chiuso ammettendo i soli spazi orizzontali, con due test che lo bloccano.
const RIGA_CONFERMA = /^[ \t>*_-]*Confermato da[ \t*_]*:[ \t*_]*(\S.*?)[ \t*_]*$/im;

/**
 * Una firma deve firmare. Due forme catturate il 2026-07-28 al collaudo, e
 * nessuna delle due e' esotica:
 *
 * - il **segnaposto del template**: `Confermato da: {{UMANO | ORCHESTRATORE}}
 *   ({{QUANDO}})`, cioe' `resources/templates/flussi-critici.md` compilato a
 *   meta'. E' la forma tipica del template non finito — la stessa ragione per
 *   cui `contrattoUscita` boccia i `{{...}}` nell'handoff — e usciva `pass`,
 *   col segnaposto stampato al posto del firmatario;
 * - la **sola decorazione markdown**: `- **Confermato da:** ` senza nome
 *   catturava `*` (la classe di coda cede un asterisco al gruppo), e cosi'
 *   `Confermato da: -` e `Confermato da: ___`. La riga vuota era gia' chiusa,
 *   la sua variante in grassetto — la piu' scritta delle tre — no.
 *
 * Il criterio e' il piu' stretto che non tolga niente a una firma vera: almeno
 * un carattere alfanumerico, e nessun segnaposto rimasto.
 */
const firmaVera = (firma) => /[\p{L}\p{N}]/u.test(firma) && !firma.includes("{{");

export function leggiFlussi(testo) {
  const flussi = [];
  const errori = [];
  const visti = new Set();
  // solo cio' che il documento dichiara di suo: gli esempi recintati e i
  // promemoria nei commenti HTML non firmano e non dichiarano flussi
  const proprio = senzaZoneCitate(testo);
  for (const linea of righe(proprio)) {
    const trovata = INTESTAZIONE_FLUSSO.exec(linea);
    if (!trovata) continue;
    const [, id, tipo] = trovata;
    if (!TIPI_FLUSSO.includes(tipo)) {
      errori.push(`flusso \`${id}\`: tipo "${tipo}" sconosciuto (attesi: ${TIPI_FLUSSO.join(", ")})`);
    } else if (visti.has(id)) {
      errori.push(`flusso \`${id}\`: id ripetuto — un id stabile identifica un flusso solo`);
    } else {
      visti.add(id);
      flussi.push({ id, tipo });
    }
  }
  const conferma = RIGA_CONFERMA.exec(proprio);
  const firma = conferma ? conferma[1].trim() : null;
  return { confermatoDa: firma && firmaVera(firma) ? firma : null, flussi, errori };
}

// ------------------------------------------------------- spec e loro etichette
// Il legame fra un flusso dichiarato e la spec che lo attacca e' un'etichetta
// nel titolo del test, non il nome del file: due spec possono attaccare lo
// stesso flusso, e un file rinominato non deve rompere il contratto.
const TAG_FLUSSO = /@flusso:([a-z0-9][a-z0-9-]*)/g;

export const tagDaSpec = (testo) =>
  [...senzaBom(testo).matchAll(TAG_FLUSSO)].map((m) => m[1]);

/** I file che Playwright considera spec (stesso `testMatch` di default). */
export const eSpec = (nome) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(nome);

/**
 * Copertura: quali flussi dichiarati nessuna spec attacca, e quali etichette
 * non corrispondono a nessun flusso dichiarato.
 * `spec` = `[{ file, tags }]`.
 */
export function copertura(flussi, spec) {
  const dichiarati = new Set(flussi.map((f) => f.id));
  const perFlusso = new Map(flussi.map((f) => [f.id, []]));
  const orfani = [];
  for (const { file, tags } of spec) {
    for (const tag of tags) {
      if (dichiarati.has(tag)) perFlusso.get(tag).push(file);
      else orfani.push({ tag, file });
    }
  }
  const scoperti = flussi.filter((f) => perFlusso.get(f.id).length === 0).map((f) => f.id);
  return { perFlusso, scoperti, orfani };
}

export function findingsCopertura(flussi, spec) {
  const { perFlusso, scoperti, orfani } = copertura(flussi, spec);
  const findings = [
    // Un flusso dichiarato senza spec e' un `block`: se e' critico, o qualcosa
    // lo attacca o il gate e' rosso. Una batteria che copre quattro flussi su
    // cinque e' una rete con un buco, e il buco e' dove nessuno guarda.
    ...scoperti.map((id) => ({
      severity: "block",
      object: `flusso ${id}`,
      message: "dichiarato critico e nessuna spec lo attacca: aggiungi una spec con `@flusso:" + id + "` nel titolo, oppure toglilo dal contratto (e falla riconfermare)",
    })),
    // Un'etichetta orfana e' un `warn`: la spec c'e' ed e' un lavoro fatto, ma
    // punta a un flusso che il contratto non nomina. O il flusso e' sparito
    // dall'elenco senza che nessuno lo dicesse, o l'etichetta ha un refuso.
    ...orfani.map(({ tag, file }) => ({
      severity: "warn",
      object: file,
      message: `etichetta \`@flusso:${tag}\` senza flusso dichiarato in docs/flussi-critici.md: refuso nell'etichetta, o flusso rimosso dal contratto senza dirlo`,
    })),
  ];
  return { findings, perFlusso };
}

// ----------------------------------------------- `.only` e skip non motivati
// `.only` committato spegne il resto della batteria in silenzio: e' il modo
// piu' economico che esiste per produrre un falso verde, e la riga che lo fa
// sembra un test come gli altri. Uno `skip` senza motivo scritto accanto e'
// meno grave ma nasce allo stesso modo: qualcuno lo ha messo «per un attimo».
const SOLO = /\b(test|describe|it)(?:\.[a-z]+)*\.only\s*\(/;
// `.fixme` sta accanto a `.skip` perche' fa la stessa cosa — il test non gira —
// e nasce dalla stessa mano: «e' rotto, lo aggiusto dopo». Mancava, e non era
// un limite dichiarato da nessuna parte: misurato il 2026-07-28, una spec
// aperta con `test.fixme(` non produceva nessun rilievo, `lint-spec` restava
// verde e `spec-coverage` dichiarava COPERTO un flusso critico che nessun test
// percorreva. Il tag `@flusso:` sta nel titolo: al gate la spec c'e' e attacca.
const SALTA = /\b(test|describe|it)(?:\.[a-z]+)*\.(skip|fixme)\s*\(/;

/**
 * Le stesse righe, senza cio' che e' commentato — e senza perdere il conto:
 * una riga resta una riga, cosi' il numero nel rilievo e' quello del file.
 *
 * Serviva perche' il controllo saltava le righe che COMINCIANO per `//`, `*` o
 * `/*`, e questo lascia fuori due forme misurate il 2026-07-28:
 * - un test commentato via a blocco (fra `/*` e la sua chiusura) le cui righe interne non
 *   cominciano per `*`: il `.only` dentro produceva un `block`, cioe' il gate
 *   bloccava la consegna per una riga che non gira (rosso sbagliato);
 * - `const x = 1; // mai committare test.only(...)`, dove il commento sta in
 *   coda a codice vero: la riga non comincia per `//`, quindi il `.only`
 *   nominato nel commento diventava un `block`;
 * - e all'opposto una riga che apre e chiude il commento e poi chiama
 *   `test.only(...)`: comincia
 *   per `/*` ma il codice vero viene dopo: veniva saltata, cioe' un `.only`
 *   committato passava.
 *
 * Le stringhe restano: un `.only` scritto dentro un titolo di test continua a
 * produrre un rilievo, ed e' un limite dichiarato.
 */
//
// E SA SE E' DENTRO UNA STRINGA (referto § L11). La forma a `indexOf` non lo
// sapeva, e `motivato()` chiedeva soltanto `linea.includes("//")`: un
// `test.skip("apre https://esempio.test//home", …)` risultava MOTIVATO, con
// zero rilievi su uno skip che non spiega niente. Misurato il 2026-08-06.
//
// Ritorna per ogni riga `{ codice, commento }`:
//   `codice`   = la riga senza i commenti e col CONTENUTO delle stringhe
//                svuotato — cosi' nemmeno un `.only` NOMINATO dentro una
//                stringa vale come un `.only` chiamato;
//   `commento` = `true` se su quella riga c'era un commento VERO.
/**
 * Un passo DENTRO una stringa. Il delimitatore torna sempre — chiuso o no — e
 * il pezzo da tenere dipende dalla domanda che si sta facendo: `svuotaStringhe`
 * decide se il contenuto e' struttura o rumore.
 */
function dentroStringa(linea, i, delimitatore, svuotaStringhe) {
  const c = linea[i];
  if (c === "\\") {
    return { pezzo: svuotaStringhe ? "" : c + (linea[i + 1] ?? ""), prossimo: i + 2, delimitatore };
  }
  if (c === delimitatore) return { pezzo: c, prossimo: i + 1, delimitatore: null };
  return { pezzo: svuotaStringhe ? "" : c, prossimo: i + 1, delimitatore };
}

/**
 * Dove si chiude, SU QUESTA RIGA, la stringa aperta in `apertura` — o `-1`.
 * Un delimitatore che non si chiude non e' un delimitatore: e' un apostrofo
 * dentro del testo, o il backtick che chiude un template aperto piu' su.
 */
function chiudeLaStringa(linea, apertura, delimitatore) {
  for (let i = apertura + 1; i < linea.length; i++) {
    if (linea[i] === "\\") { i += 1; continue; }
    if (linea[i] === delimitatore) return i;
  }
  return -1;
}

function codiceSenzaCommenti(linee, svuotaStringhe = true) {
  // `inBlocco` attraversa le righe: un commento a blocco aperto qui si chiude
  // due righe piu' giu'. Per questo lo stato sta fuori dalla funzione di riga.
  let inBlocco = false;
  const analizzaRiga = (linea) => {
    let codice = "";
    let commento = false;
    let delimitatore = null;
    let i = 0;

    while (i < linea.length) {
      const c = linea[i];

      if (inBlocco) {
        const fine = linea.indexOf("*/", i);
        commento = true;
        if (fine === -1) break;
        inBlocco = false;
        i = fine + 2;
        continue;
      }

      if (delimitatore !== null) {
        const passo = dentroStringa(linea, i, delimitatore, svuotaStringhe);
        codice += passo.pezzo;
        delimitatore = passo.delimitatore;
        i = passo.prossimo;
        continue;
      }

      // UN APICE NON E' UNA STRINGA SE NON SI CHIUDE (concilio, 2026-08-07).
      // Era una REGRESSIONE di questo pacchetto: prima le stringhe non si
      // guardavano affatto. Misurato su una riga che CHIUDE un template
      // multi-riga — quindi comincia col backtick:
      //
      //   `; test.only("x", async () => {});
      //
      //   PRIMA  il backtick apriva una stringa nuova e spegneva il resto
      //          della riga: `.only` committato, ZERO rilievi
      //   DOPO   1 block
      //
      // La riga resta l'unita' di analisi (`inBlocco` la attraversa, questo
      // no): quindi qui la domanda e' se la stringa si chiude SU QUESTA RIGA.
      if (c === '"' || c === "'" || c === "`") {
        if (chiudeLaStringa(linea, i, c) === -1) {
          codice += c;
          i += 1;
          continue;
        }
        delimitatore = c;
        codice += c;
        i += 1;
        continue;
      }
      if (c === "/" && linea[i + 1] === "/") {
        commento = true;
        break;
      }
      if (c === "/" && linea[i + 1] === "*") {
        commento = true;
        inBlocco = true;
        i += 2;
        continue;
      }

      codice += c;
      i += 1;
    }

    return { codice, commento };
  };

  return linee.map(analizzaRiga);
}

export function regoleSpec(file, testo) {
  const linee = righe(testo);
  // il codice, per cercare `.only` e gli skip; le righe intere, per capire se
  // uno skip ha la motivazione scritta accanto (che e' un commento, appunto)
  const analizzate = codiceSenzaCommenti(linee);
  const findings = [];
  for (let i = 0; i < analizzate.length; i++) {
    const linea = analizzate[i].codice;
    if (SOLO.test(linea)) {
      findings.push({
        severity: "block",
        object: `${file}:${i + 1}`,
        message: "`.only` committato: il resto della batteria non gira, e il verde che ne esce non ha guardato niente",
      });
    }
    const salta = SALTA.exec(linea);
    if (salta && !motivato(analizzate, i)) {
      findings.push({
        severity: "issue",
        object: `${file}:${i + 1}`,
        message: `\`.${salta[2]}\` senza motivazione scritta accanto: scrivi in un commento perche' e' saltato e quando rientra, o toglilo`,
      });
    }
  }
  return findings;
}

// La motivazione sta sulla stessa riga (commento in coda) o sulla riga sopra:
// sono i due posti dove un umano la scrive davvero.
//
// CORRETTA il 2026-08-06 (referto § L11). Chiedeva `linea.includes("//")`, e un
// `//` dentro una stringa non e' un commento: un
// `test.skip("apre https://esempio.test//home", …)` risultava motivato e non
// produceva nessun rilievo. Ora la domanda la risponde lo scanner, che sa dove
// si trova.
function motivato(analizzate, indice) {
  if (analizzate[indice].commento) return true;
  for (let i = indice - 1; i >= 0; i--) {
    if (analizzate[i].codice.trim() === "" && !analizzate[i].commento) continue;
    // Una riga fatta SOLO di commento e' la motivazione scritta sopra; una riga
    // di codice con un commento in coda e' un'altra istruzione, non una
    // motivazione per questo skip.
    return analizzate[i].commento && analizzate[i].codice.trim() === "";
  }
  return false;
}

// ------------------------------------------------- l'asserzione di effetto DB
// La terza legge: un test che guarda solo la pagina passa anche con un backend
// finto. Questa regola verifica che la spec IMPORTI e CHIAMI l'helper di
// verifica DB — cioe' la FORMA, non la semantica: non sa se l'asserzione e'
// quella giusta, sa che ce n'e' una che ha guardato il database. La stessa
// onesta' che Schema Forge scrive sul suo audit RLS («guarda la forma delle
// policy, la semantica la dimostrano i test»).
// La clausola non puo' contenere `;` ne' virgolette: e' quello che le impedisce
// di scavalcare all'indietro gli import precedenti.
// Con `[\s\S]*?` lo faceva, e il ritaglio partiva dal PRIMO `import` del file:
// in una spec che comincia — come tutte — con `import { test, expect } from
// "@playwright/test";`, i nomi raccolti diventavano `test`, `expect`, `import`,
// `contaProdotti`, e un `expect(...)` qualsiasi passava per una chiamata
// all'helper del database. Cioe' la regola verificava l'import e NON la
// chiamata, proprio sul passo che esiste per pretendere la chiamata.
// Riprodotto e chiuso il 2026-07-28, con i due test che lo bloccano.
//
// RISCRITTA il 2026-08-06 (referto § M5). La forma precedente
// (`([^;"']*?)\s+from`) aveva due quantificatori che si contendono lo stesso
// spazio bianco, ed e' un ReDoS vero. Misurato su questa macchina, con una
// spec fatta di soli spazi fra `import` e `from`:
//
//   1 000 caratteri →     1,6 s
//   2 000 caratteri →    15,0 s
//   4 000 caratteri →  non finito in due minuti
//
// e il costo si paga UNA VOLTA PER FLUSSO (`findingsEffettoDb` chiama questa
// per ogni spec di ogni flusso). Il limite arrivato con § H10 lo trasforma in
// un gate che si ferma con un messaggio invece che in uno muto, e va bene —
// ma un gate che impiega venti secondi per flusso su un ingresso ostile e' un
// gate che qualcuno lancera' con un timeout piu' corto.
//
// La correzione non e' un quantificatore piu' stretto: e' togliere
// l'ambiguita'. Si cerca PRIMA il `from "…helpers/db…"`, che ha un solo
// quantificatore e nessuna alternanza annidata, e POI si risale all'`import`
// piu' vicino. Nessun punto del testo puo' essere consumato in due modi.
const DA_HELPER_DB = /\bfrom\s*["'][^"'\n]*helpers\/db(?:\.[cm]?[jt]s)?["']/g;
const PAROLA_IMPORT = /\bimport\b/g;
// Fra `import` e `from` non ci puo' stare la fine di un'altra istruzione: se
// c'e', quell'`import` non e' l'inizio di QUESTO import.
const FINE_ISTRUZIONE = /[;"'`]/;

/** L'indice dell'ultimo `import` come PAROLA in `prefisso`, o `-1`. */
function ultimaParolaImport(prefisso) {
  for (let i = prefisso.lastIndexOf("import"); i !== -1; i = prefisso.lastIndexOf("import", i - 1)) {
    const prima = i === 0 ? "" : prefisso[i - 1];
    const dopo = prefisso[i + 6] ?? "";
    if (!/[\w$]/.test(prima) && !/[\w$]/.test(dopo)) return i;
    if (i === 0) break;
  }
  return -1;
}

/** Le clausole `import <clausola> from "…helpers/db…"`, cercate al contrario. */
export function clausoleHelperDb(testo) {
  const clausole = [];
  for (const trovato of testo.matchAll(DA_HELPER_DB)) {
    // All'INDIETRO, non rifacendo `matchAll` su tutto il prefisso a ogni
    // occorrenza: quello era quadratico (concilio, 2026-08-07 — ×4 sul codice
    // di prima su 3 200 import). Il ReDoS di § M5 resta chiuso: 20 000 spazi
    // fra `import` e `from` costano 0,1 ms.
    const prima = testo.slice(0, trovato.index);
    const inizio = ultimaParolaImport(prima);
    if (inizio === -1) continue;
    const clausola = prima.slice(inizio + "import".length);
    if (FINE_ISTRUZIONE.test(clausola)) continue;
    clausole.push(clausola.replace(/^\s*type\b/, ""));
  }
  return clausole;
}

export function usaHelperDb(testo) {
  // Un'asserzione commentata via non guarda niente, e nemmeno il suo import.
  // Misurato il 2026-07-28: commentando insieme `// import { corsoPerTitolo }
  // from "./helpers/db";` e `// const riga = await corsoPerTitolo(...)`, il
  // passo `effetto-db` restava verde («tutti importano e chiamano») e ESLint
  // taceva — un import commentato non e' una variabile inutilizzata. La stessa
  // cancellazione senza commenti produce il `block`: era il commento a portare
  // il verde, cioe' il modo piu' comodo che esista per spegnere l'unica
  // asserzione che guarda il database.
  const pulito = senzaCommentiJs(senzaBom(testo));
  const nomi = [];
  for (const clausola of clausoleHelperDb(pulito)) {
    for (const pezzo of clausola.replace(/[{}]/g, ",").split(",")) {
      // `import * as db`, `import db`, `{ a, b as c }`: interessa il nome con
      // cui la spec lo chiama, cioe' l'ultimo identificatore della clausola
      const nome = pezzo.trim().split(/\s+/).pop();
      if (nome && /^[A-Za-z_$][\w$]*$/.test(nome) && nome !== "as" && nome !== "type") nomi.push(nome);
    }
  }
  const chiamati = nomi.filter((nome) =>
    new RegExp(`\\b${nome}\\s*(?:\\(|\\.[A-Za-z_$][\\w$]*\\s*\\()`).test(pulito));
  return { importa: nomi.length > 0, chiama: chiamati.length > 0, nomi };
}

export function findingsEffettoDb(flussi, spec, perFlusso) {
  const testoPerFile = new Map(spec.map((s) => [s.file, s.testo]));
  const findings = [];
  for (const flusso of flussi) {
    if (!TIPI_CON_EFFETTO_DB.includes(flusso.tipo)) continue;
    const file = perFlusso.get(flusso.id) ?? [];
    // nessuna spec: se ne occupa `spec-coverage` col suo `block`, qui
    // aggiungere un secondo rilievo sullo stesso buco e' solo rumore
    if (file.length === 0) continue;
    if (file.some((f) => { const u = usaHelperDb(testoPerFile.get(f) ?? ""); return u.importa && u.chiama; })) continue;
    findings.push({
      severity: "block",
      object: `flusso ${flusso.id}`,
      message: `nessuna delle spec che lo attaccano (${file.join(", ")}) importa e chiama \`e2e/helpers/db\`: ` +
        (flusso.tipo === "positivo"
          ? "un flusso positivo che asserisce solo la pagina passa anche con un backend che non ha scritto niente"
          : "un flusso ostile in scrittura deve asserire il rifiuto E che il database non e' cambiato") +
        ". Il controllo guarda la FORMA (import + chiamata), non se l'asserzione e' quella giusta",
    });
  }
  return findings;
}

// ------------------------------------------------- esito reale della batteria
// Il browser e' il giudice: qui si legge cosa e' successo davvero, dal report
// JSON di Playwright. `flaky` nel vocabolario di Playwright significa «passato
// a un tentativo successivo»: con `retries = 1` e' esattamente il secondo.
export function estraiOggettoJson(testo) {
  const grezzo = String(testo ?? "");
  const inizio = grezzo.indexOf("{");
  const fine = grezzo.lastIndexOf("}");
  if (inizio === -1 || fine <= inizio) {
    return { errore: `uscita non interpretabile come JSON: ${grezzo.trim().slice(0, 200)}` };
  }
  try {
    return { parsed: JSON.parse(grezzo.slice(inizio, fine + 1)) };
  } catch {
    return { errore: `uscita non interpretabile come JSON: ${grezzo.trim().slice(0, 200)}` };
  }
}

export function esitoPlaywright(report) {
  // `eseguiti` sono i NOMI dei test che il browser ha davvero percorso — passati,
  // instabili e falliti. I conteggi da soli non bastano piu': serve sapere QUALE
  // flusso e' stato percorso, e il nome e' l'unico posto dove l'esecuzione e
  // l'identita' del flusso stanno insieme (vedi `flussiPercorsi`).
  const esito = { passati: 0, falliti: [], alSecondoTentativo: [], saltati: [], eseguiti: [], errori: [] };
  if (!report || !Array.isArray(report.suites)) {
    return { ...esito, errori: ["report senza `suites`: contratto del reporter JSON non rispettato"] };
  }
  // `errors` che non e' una lista: si scandiva lo stesso, e una stringa veniva
  // iterata carattere per carattere (quattro «errori del runner» inventati da
  // un `errors: "boom"`), un oggetto faceva esplodere il gate con un TypeError
  // non gestito — uscita 1 senza JSON, cioe' un gate rosso indistinguibile da
  // un gate che non ha risposto. Misurato il 2026-07-28.
  if (report.errors !== undefined && !Array.isArray(report.errors)) {
    return { ...esito, errori: ["report con `errors` che non e' una lista: contratto del reporter JSON non rispettato"] };
  }
  for (const messaggio of report.errors ?? []) {
    esito.errori.push(String(messaggio?.message ?? messaggio).trim().split("\n")[0]);
  }
  visita(report.suites, [], esito);
  return esito;
}

function visita(suites, antenati, esito) {
  // Una voce nulla nell'albero faceva esplodere il gate con un TypeError non
  // gestito: nessun JSON in uscita, e chi automatizza non distingue un gate
  // rosso da un gate che non ha risposto. Un report malformato deve portare a
  // MANCANTE, mai a un'eccezione.
  //
  // ITERATIVA dal 2026-08-06 (referto § L3). Era ricorsiva, e un albero
  // profondo 20 000 la faceva morire di `RangeError: Maximum call stack size
  // exceeded` — di nuovo un processo che muore senza JSON, cioe' lo stesso
  // guasto della voce nulla da un'altra porta. Il report lo scrive Playwright,
  // ma il gate legge un file che sta nel progetto AUDITATO: la profondita' non
  // e' un dato di cui questo gate possa fidarsi.
  // Il percorso viaggia come STRINGA gia' unita, non come array ricopiato a ogni
  // nodo: ricopiarlo costa O(profondita) a nodo, cioe' quadratico sull'albero —
  // misurato dal concilio il 2026-08-07, profondita' 40 000 in 14,5 secondi. La
  // versione ricorsiva pagava lo stesso costo ma moriva prima (`RangeError`);
  // toglierle la morte senza toglierle il costo lascia il gate MUTO, che e' lo
  // stato che § L3 voleva evitare.
  //
  // I figli si impilano AL CONTRARIO: una pila e' LIFO, e senza questo l'ordine
  // dei test stampati non sarebbe ne' quello dei file ne' quello d'esecuzione.
  // I conteggi non cambiavano, ma la lista che un umano legge per triare si'.
  const unisci = (padre, titolo) => (padre ? (titolo ? `${padre} › ${titolo}` : padre) : (titolo ?? ""));
  const radice = [...(antenati ?? [])].filter(Boolean).join(" › ");
  // La pila porta UN NODO per elemento, non la lista dei fratelli: cosi' l'ordine
  // di visita e' quello in profondita' della versione ricorsiva, cioe' quello in
  // cui i test si leggono. Con la lista dei fratelli si registravano prima tutte
  // le spec di un livello e poi si scendeva, e la lista dei falliti usciva in
  // un ordine che non era ne' quello dei file ne' quello d'esecuzione.
  const pila = [];
  const impila = (elenco, percorso) => {
    const nodi = elenco ?? [];
    for (let k = nodi.length - 1; k >= 0; k--) pila.push([nodi[k], percorso]);
  };
  impila(suites, radice);

  while (pila.length > 0) {
    const [suite, percorsoPadre] = pila.pop();
    if (!suite || typeof suite !== "object") continue;
    const percorso = unisci(percorsoPadre, suite.title);
    for (const spec of suite.specs ?? []) {
      if (!spec || typeof spec !== "object") continue;
      for (const t of spec.tests ?? []) registra(unisci(percorso, spec.title), t?.status, esito);
    }
    impila(suite.suites, percorso);
  }
}

function registra(nome, stato, esito) {
  if (stato === "expected") esito.passati += 1;
  else if (stato === "flaky") { esito.passati += 1; esito.alSecondoTentativo.push(nome); }
  else if (stato === "skipped") esito.saltati.push(nome);
  else esito.falliti.push(nome);
  // Anche un test FALLITO e' un test percorso: il browser lo ha giudicato, e il
  // suo rosso e' un difetto trovato — non una verifica mancante.
  if (stato !== "skipped") esito.eseguiti.push(nome);
}

/**
 * Il secondo tentativo si dichiara ANCHE sul verde: un test che passa una
 * volta su due non e' uguale a un test che passa. Se questa riga si stampasse
 * solo sul rosso, non la leggerebbe nessuno — che e' il modo in cui un flaky
 * diventa normale.
 */
export function dettaglioPlaywright(esito, quanteSpec) {
  const parti = [`${quanteSpec} file di spec · ${esito.passati} passati, ${esito.falliti.length} falliti, ${esito.saltati.length} saltati`];
  if (esito.falliti.length > 0) parti.push("falliti:", ...esito.falliti.map((n) => `  - ${n}`));
  if (esito.alSecondoTentativo.length > 0) {
    parti.push("passati al SECONDO tentativo (retries = 1) — instabili, non verdi:",
      ...esito.alSecondoTentativo.map((n) => `  - ${n}`));
  }
  if (esito.saltati.length > 0) parti.push("saltati:", ...esito.saltati.map((n) => `  - ${n}`));
  parti.push(...esito.errori.map((e) => `errore del runner: ${e}`));
  return parti.join("\n");
}

/** Rosso se qualcosa e' fallito o se il runner stesso ha avuto un errore. */
export const esitoBatteriaVerde = (esito) =>
  esito.falliti.length === 0 && esito.errori.length === 0;

/**
 * La batteria ha ESEGUITO qualcosa, o si e' limitata a esistere?
 *
 * Con ogni test saltato, Playwright esce 0 e stampa un report validissimo:
 * `0 passati, 0 falliti, N saltati`. `esitoBatteriaVerde` lo legge come verde —
 * non e' fallito niente — e il gate chiude VERDE 7 su 7 senza che nessun flusso
 * critico sia stato percorso. Misurato il 2026-07-28 sul banco `palestra`:
 * sei spec marcate `test.skip` con la motivazione accanto (quindi `lint-spec`
 * pulito, nessun `issue`) davano `ok: true` e «6 file di spec · 0 passati,
 * 0 falliti, 6 saltati».
 *
 * E' la stessa forma dei cinque falsi verdi gia' chiusi — «uno strumento che
 * non ha letto niente esce 0» (DECISIONI.md §18) — nell'unico punto in cui era
 * rimasta aperta: le spec si contavano come FILE, mai come test eseguiti.
 * Il passo che ne esce e' `skipped` e non `fail`: nessuno ha guardato, quindi
 * e' una verifica mancante, non un difetto trovato.
 */
export const batteriaHaEseguito = (esito) =>
  esito.passati > 0 || esito.falliti.length > 0;

// -------------------------------------- QUALE flusso ha percorso il browser
/**
 * `batteriaHaEseguito` e' un OR GLOBALE, ed e' il buco che il collaudo P2 aveva
 * chiuso solo al 100%. Misurato il 2026-08-06 (referto § C2, `executed-confirmed`)
 * su un report JSON nella forma vera del reporter di Playwright: 13 flussi
 * dichiarati, 13 spec con `test.skip` MOTIVATO — quindi `lint-spec` pulito,
 * nessun `issue` — piu' un test banale che passa. Uscita:
 *
 *     14 file di spec · 1 passati, 0 falliti, 13 saltati
 *     esitoBatteriaVerde: true · batteriaHaEseguito: true  →  passo `pass`
 *     flussi critici davvero percorsi dal browser: 0 su 13
 *
 * Sette passi verdi, `ok: true`, e speed-demon a valle legge SOLO `esito.ok`:
 * il falso verde si propagava muto. Un test verde qualsiasi soddisfaceva la
 * premessa «il browser e' il giudice» per tutti e tredici i flussi.
 *
 * La domanda giusta non e' «quanti test sono girati» ma «QUALE flusso ha
 * percorso il browser». La soglia non c'entra: dodici su tredici e' lo stesso
 * difetto di tredici su tredici, un flusso critico piu' tardi.
 *
 * L'etichetta si legge dal TITOLO PIENO del test eseguito, e non dal testo del
 * file: il testo del file dichiara la copertura (`spec-coverage`), il titolo di
 * un test che gira dichiara l'esecuzione. Sono due misure diverse, ed e' proprio
 * la loro confusione ad aver tenuto aperto il difetto. E' anche cio' che il
 * rilievo di copertura chiede: «aggiungi una spec con `@flusso:<id>` NEL TITOLO».
 */
const TAG_NEL_TITOLO = /@flusso:([a-z0-9][a-z0-9-]*)/g;

const tagDiTitolo = (nome) =>
  [...String(nome ?? "").matchAll(TAG_NEL_TITOLO)].map((m) => m[1]);

export function flussiPercorsi(flussi, esito) {
  const dichiarati = new Set(flussi.map((f) => f.id));
  const percorsi = new Set();
  const saltatiPer = new Map();
  for (const nome of esito.eseguiti ?? []) {
    for (const tag of tagDiTitolo(nome)) if (dichiarati.has(tag)) percorsi.add(tag);
  }
  for (const nome of esito.saltati ?? []) {
    for (const tag of tagDiTitolo(nome)) {
      if (!dichiarati.has(tag)) continue;
      if (!saltatiPer.has(tag)) saltatiPer.set(tag, []);
      saltatiPer.get(tag).push(nome);
    }
  }
  // I due motivi si distinguono, perche' portano a due gesti diversi: uno si
  // chiude togliendo lo `.skip`, l'altro scrivendo l'etichetta nel titolo.
  const nonPercorsi = flussi
    .filter((f) => !percorsi.has(f.id))
    .map((f) => ({
      id: f.id,
      motivo: saltatiPer.has(f.id)
        ? `flusso ${f.id}: le sue spec ci sono e sono state SALTATE (${saltatiPer.get(f.id).join(", ")}). Uno skip motivato resta uno skip: su questo flusso il browser non ha giudicato niente`
        : `flusso ${f.id}: nessun test ESEGUITO porta \`@flusso:${f.id}\` nel titolo. La copertura la dichiara il testo del file, l'esecuzione la dichiara il titolo di un test che gira`,
    }));
  return { percorsi: [...percorsi], nonPercorsi };
}

/**
 * Il numero che distingue la copertura dal silenzio, e che si stampa SEMPRE —
 * anche sul verde. «13 file di spec» si legge come copertura avvenuta; «0 flussi
 * critici su 13 percorsi davvero dal browser» no.
 */
export const rigaFlussiPercorsi = (flussi, percorsi) =>
  `${percorsi.length} flussi critici su ${flussi.length} percorsi davvero dal browser` +
  (percorsi.length > 0 ? `: ${[...percorsi].sort().join(", ")}` : "");

// ------------------------------------------ eseguibili risolti su Windows
/**
 * `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd` —
 * quello che si ottiene installando npx, eslint o la CLI Supabase da npm —
 * risulta ENOENT sul nome e EINVAL col percorso pieno (mitigazione della
 * CVE-2024-27980). Il guasto va nella direzione sicura (`skipped`), la
 * diagnosi no: dice «strumento assente» dove lo strumento c'e' e funziona.
 *
 * NON si usa `shell: true`: li' gli argomenti vengono concatenati invece che
 * passati come vettore, e questo gate passa percorsi con spazi e SQL intero.
 */
const ESTENSIONE_ESEGUIBILE = /\.(exe|cmd|bat|com)$/i;

/**
 * Quale riga di `where` e' davvero lanciabile.
 *
 * npm installa DUE file per ogni comando: uno script di shell senza estensione
 * (per Git Bash) e uno shim `.cmd` (per Windows). `where npx` li elenca in
 * quest'ordine, e la prima riga — quella senza estensione — Windows non sa
 * eseguirla: `spawnSync` fallisce senza stdout. Misurato il 2026-07-28 sul
 * banco: il passo `playwright` risultava «report JSON non interpretabile» su
 * una macchina dove `npx playwright test` funziona benissimo.
 * Il guasto andava nella direzione sicura (MANCANTE, mai un falso verde), la
 * diagnosi no: incolpava Playwright di un problema di PATHEXT.
 */
export function primoEseguibile(uscitaWhere) {
  const trovate = righe(uscitaWhere).map((r) => r.trim()).filter(Boolean);
  return trovate.find((r) => ESTENSIONE_ESEGUIBILE.test(r)) ?? trovate[0] ?? null;
}

/**
 * CHI CERCA, e dove NON cerca. Referto del 2026-08-06, § C1 (`executed-confirmed`).
 *
 * Il gate si lancia dalla radice del progetto AUDITATO — lo prescrive il
 * `CLAUDE.md` — e `where` cerca nella directory corrente PRIMA che nel PATH: un
 * `psql.cmd` o un `npx.cmd` piantato nella radice sceglieva quale binario
 * esegue il gate che giudica quel progetto. Misurato dal finto progetto:
 * `where supabase` elencava per primo lo shim piantato, `where "$PATH:supabase"`
 * no. E `spawnSync` col nome nudo fa lo stesso di suo (misurato copiando
 * `hostname.exe` in `psql.exe`), per questo anche `where.exe` e `cmd.exe`
 * vogliono il percorso pieno: chi cerca e chi lancia sarebbero i primi due
 * binari sostituibili, e non li guarda nessuno.
 *
 * Il `spawnSync` resta di la', in `verify.mjs`: qui c'e' solo la decisione.
 */
export function comandoRicerca(nome, piattaforma = process.platform, env = process.env) {
  // Su POSIX `which` legge il PATH e basta; alla directory corrente dentro il
  // PATH (`.`) risponde `dentroLaRadice`.
  if (piattaforma !== "win32") return { file: "which", args: [nome] };
  const sistema = env.SystemRoot || env.windir || "C:\\Windows";
  return { file: `${sistema}\\System32\\where.exe`, args: [`$PATH:${nome}`] };
}

/** La shell che lancia gli shim `.cmd`, col percorso pieno e mai come nome nudo. */
export const shellDiSistema = (env = process.env) =>
  env.ComSpec || `${env.SystemRoot || env.windir || "C:\\Windows"}\\System32\\cmd.exe`;

/**
 * Un candidato cade dentro il progetto auditato? Il PATH puo' contenerlo
 * davvero — `node_modules/.bin` ce lo mette npm — e allora il prefisso `$PATH:`
 * non basta piu'. Il confronto NON e' per prefisso di stringa: `C:\prog-altro`
 * comincia per `C:\prog` e non e' dentro. Si normalizzano le barre e si
 * confrontano i SEGMENTI.
 */
export function dentroLaRadice(percorso, radice) {
  if (!percorso || !radice) return false;
  const segmenti = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").split("/");
  const r = segmenti(radice);
  const c = segmenti(percorso);
  if (c.length <= r.length) return false;
  // Windows non distingue maiuscole e minuscole nei percorsi: `C:\PROG` e
  // `C:\prog` sono lo stesso posto.
  return r.every((pezzo, i) => pezzo.toLowerCase() === c[i].toLowerCase());
}

/**
 * Gli argomenti che non sopravvivono a `cmd /c` — e quelli che ne APPROFITTANO.
 *
 * Il commento della casa «NON si abilita `shell: true`», qui sopra, diceva il
 * vero e non bastava: `cmd.exe /c` **E' una shell**, e ri-analizza
 * `& | < > ^ ( ) " %` prima che gli argomenti diventino argomenti. Questo gate
 * non aveva nessun filtro (referto § H2/L1). Misurato il 2026-08-06 su uno shim
 * `.cmd` qualsiasi:
 *
 *   shim.cmd /&ver         → SHIM ricevuto: /  + «Microsoft Windows […]»: `ver`
 *                             ESEGUITO, e status 0
 *   shim.cmd %USERNAME%    → SHIM ricevuto: Utente (l'argomento arriva espanso)
 *   shim.cmd /|ver         → lo shim non parte affatto, parte `ver`, status 0
 *   shim.cmd />rubato.txt  → status 0, e su disco compare `rubato.txt`
 *
 * Gli spazi restano rifiutati, ed e' la regola misurata da speed-demon il
 * 2026-07-30: quando anche il percorso dello shim contiene uno spazio — e
 * `C:\Program Files\nodejs\npx.cmd` ce l'ha — un argomento con spazi fa
 * collassare il virgolettato del PROGRAMMA, e l'errore accusa `C:\Program`.
 *
 * Non si virgoletta meglio: dentro `"…"` cmd neutralizza `&|<>()` ma NON `%`, e
 * Node virgoletta da solo soltanto cio' che contiene spazi. Si rifiuta e si dice
 * perche': uno strumento che riceve un altro argomento risponde comunque, e
 * risponde di un'altra cosa.
 */
// I caratteri di CONTROLLO sono proprio cio' che si cerca: un a capo dentro
// un argomento e' una riga di comando in piu' per `cmd`. `no-control-regex`
// esiste per chi ce li mette per sbaglio (DECISIONI.md §8: ogni esenzione ha
// il motivo sulla riga sopra).
// eslint-disable-next-line no-control-regex
const OSTILI_A_CMD = /[\s&|<>^()"%]|[\u0000-\u001f]/;

export function argomentiOstiliACmd(args, piattaforma = process.platform) {
  if (piattaforma !== "win32") return [];
  return (args ?? []).filter((a) => OSTILI_A_CMD.test(String(a)));
}

/** Il messaggio, uguale nelle quattro skill: dice il carattere colpevole. */
export const motivoOstile = (ostili) =>
  "argomenti non passabili da `cmd.exe /c`, che E' una shell e li ri-analizza " +
  "(spazi, oppure uno fra & | < > ^ ( ) \" % o un carattere di controllo): " +
  `${ostili.map((a) => JSON.stringify(String(a))).join(", ")}`;

/**
 * `file: null` quando il nome non si risolve: il nome nudo NON si lancia,
 * perche' lo risolverebbe la directory corrente. Strumento assente = verifica
 * MANCANTE, che e' la regola della casa, mai un `pass`.
 * Si cerca anche fuori da Windows, per la stessa ragione.
 */
export function formaEseguibile(
  nome,
  cercaPercorso,
  piattaforma = process.platform,
  comSpec = shellDiSistema(),
) {
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: null, prefisso: [] };
  return piattaforma === "win32" && /\.(cmd|bat)$/i.test(trovato)
    ? { file: comSpec, prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

// ----------------------------------------------- lettura del `config.toml`
// Tre chiavi in tutto: nessun parser TOML fra le dipendenze di uno script che
// deve girare ovunque con `node` e basta.
/**
 * Il `#` che apre un commento TOML, e quello che non lo apre.
 *
 * Referto § L7: qui il commento lo toglieva `senzaVirgolette`, con
 * `replace(/\s*#.*$/, "")` — che morde anche dentro una stringa. Misurato il
 * 2026-08-06:
 *
 *   site_url = "http://127.0.0.1:3000/#/app"
 *     PRIMA  urlAppProgetto → "http://127.0.0.1:3000/"   mezza URL
 *     DOPO   "http://127.0.0.1:3000/#/app"
 *
 * ed era mitigato a meta': toglieva la cella col `#` ma non la coda del
 * commento dopo la virgola, cioe' il § M13 della skill sorella restava aperto
 * anche qui. Un `#` dentro `[api].schemas` produceva schemi fantasma.
 *
 * Due difetti opposti, una causa sola: uno scanner che non sa se il carattere
 * che sta guardando e' dentro una stringa.
 *
 * TOML ha due stringhe su una riga: `"…"` con le fughe e `'…'` letterale, dove
 * il `\` non fugge niente. LIMITE DICHIARATO: le stringhe multi-riga (`"""`,
 * `'''`) non sono gestite — il `config.toml` di Supabase non ne usa per le tre
 * chiavi che questo gate legge.
 */
export function senzaCommentoToml(riga) {
  const testo = String(riga ?? "");
  let delimitatore = null;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (delimitatore === '"' && c === "\\") { i += 1; continue; }
    if (delimitatore !== null) {
      if (c === delimitatore) delimitatore = null;
      continue;
    }
    if (c === '"' || c === "'") { delimitatore = c; continue; }
    if (c === "#") return testo.slice(0, i);
  }
  return testo;
}

function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${chiave}\\s*=\\s*(.+)$`);
  // Il commento si toglie PRIMA di ogni confronto, riga per riga: vale sia per
  // la riga della chiave sia per quelle su cui prosegue l'array multi-riga.
  const linee = righe(testoConfig).map(senzaCommentoToml);
  for (let i = 0; i < linee.length; i++) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(linee[i]);
    if (intestazione) {
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    const trovata = dentro && cerca.exec(linee[i]);
    if (!trovata) continue;
    // Un array TOML puo' stare su piu' righe, ed e' come lo scrive chi ne
    // elenca tre. Guardando solo il resto della riga, `schemas = [` valeva `[`
    // e `schemiEsposti` ripiegava su `["public"]` IN SILENZIO: il gate
    // interrogava un solo schema e stampava «schemi esposti: public» come se
    // fosse la verita' del progetto. E' il difetto W9 del collaudo di Schema
    // Forge (2026-07-26), ereditato con la forma della funzione e riprodotto
    // qui il 2026-07-28. Un audit parziale non deve poter assomigliare a un
    // audit completo (DECISIONI.md §11).
    let valore = trovata[1];
    if (valore.includes("[") && !valore.includes("]")) {
      for (let j = i + 1; j < linee.length && !valore.includes("]"); j++) {
        valore += ` ${linee[j].trim()}`;
      }
    }
    return valore;
  }
  return null;
}

// Niente `#` qui dentro: il commento se ne e' gia' andato in `valoreToml`, che
// sa distinguerlo da un `#` dentro una stringa. Toglierlo anche qui sarebbe
// toglierlo di nuovo, e questa volta senza sapere dove ci si trova (§ L7).
const senzaVirgolette = (valore) => valore.trim().replace(/^["']|["']$/g, "");

/**
 * Il database del PROGETTO, non uno di default.
 * Su questa macchina la 54322 e' il database di un altro progetto: un gate che
 * ci ripiega sopra risponde OK dopo aver guardato altrove (DECISIONI.md §11).
 */
export function urlDbProgetto(testoConfig) {
  const valore = valoreToml(testoConfig, "db", "port");
  const porta = valore && /^(\d+)/.exec(valore.trim());
  return porta ? `postgresql://postgres:postgres@127.0.0.1:${porta[1]}/postgres` : null;
}

/**
 * L'URL dell'app e' quello che il PROGETTO dichiara (`[auth].site_url`), non
 * un `localhost:3000` scritto nel gate ne' una variabile d'ambiente rimasta da
 * un altro progetto: e' esattamente cosi' che si finisce per testare un'altra
 * app e chiamarla verde.
 */
export function urlAppProgetto(testoConfig) {
  const valore = valoreToml(testoConfig, "auth", "site_url");
  if (!valore) return null;
  const url = senzaVirgolette(valore);
  return /^https?:\/\//.test(url) ? url.replace(/\/+$/, "") : null;
}

/**
 * L'ambiente con cui si lancia la batteria: l'URL che il passo `app-viva` ha
 * appena interrogato viene IMPOSTO a Playwright come `E2E_BASE_URL`.
 *
 * Perche' imporlo invece di limitarsi a confrontarlo. Il gate risolve un URL
 * (flag `--url`, altrimenti `[auth].site_url`) e la batteria ne risolveva un
 * altro per conto suo: due verita' che nessuno metteva a confronto. Misurato il
 * 2026-07-30 sul banco di Bottega Nord: la 3000 dichiarata era occupata da un
 * ALTRO progetto, Next aveva spostato l'app sulla 3001, e `app-viva` e' uscito
 * `pass` interrogando l'app di uno sconosciuto — accoppiata al database giusto,
 * cosi' il verde sembrava coerente.
 *
 * Imporlo chiude la classe invece di segnalarla: la batteria non puo' piu'
 * percorrere un'app diversa da quella di cui il gate ha misurato la premessa.
 * Se quell'app e' di un altro progetto, ora e' la batteria a diventare rossa —
 * un rosso rumoroso al posto di un verde silenzioso.
 *
 * Resta scoperto (dichiarato, non risolto): un gate lanciato quando la batteria
 * non esiste ancora puo' ancora vedere `app-viva` verde su un'app estranea. Li'
 * la difesa e' l'URL stampato sempre, anche sul verde.
 */
export function ambienteBatteria(urlApp, env = {}) {
  return urlApp ? { ...env, E2E_BASE_URL: urlApp } : { ...env };
}

export function schemiEsposti(testoConfig) {
  const valore = valoreToml(testoConfig, "api", "schemas");
  if (valore === null) return ["public"];
  const lista = /\[([^\]]*)\]/.exec(valore);
  if (!lista) return ["public"];
  const schemi = lista[1].split(",").map((s) => senzaVirgolette(s)).filter(Boolean);
  return schemi.length > 0 ? schemi : ["public"];
}

// ------------------------------------------------- premessa: il seed c'e' o no
// Una batteria che gira su un database vuoto fallisce per mancanza di dati e i
// suoi rossi sembrano difetti dell'app. Prima di leggere l'esito si misura che
// qualcosa ci sia: le tabelle applicate e le righe dentro.
export const sqlTabelleEsposte = (schemi) =>
  "select table_schema || '.' || table_name from information_schema.tables " +
  `where table_type = 'BASE TABLE' and table_schema in (${schemi.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")}) ` +
  "order by 1";

const virgolettato = (parte) => `"${parte.replace(/"/g, '""')}"`;

export function sqlConteggioRighe(tabelle) {
  const pezzi = tabelle.map((t) => {
    const [schema, ...resto] = t.split(".");
    return `select count(*) as c from ${virgolettato(schema)}.${virgolettato(resto.join("."))}`;
  });
  return `select coalesce(sum(c), 0) from (${pezzi.join(" union all ")}) as t`;
}

/**
 * psql su Windows lascia il `\r` in coda a ogni riga: un confronto ingenuo
 * fallisce sempre, ed e' gia' costato una regola morta a Schema Forge.
 */
export const righeDaPsql = (stdout) =>
  righe(stdout).map((r) => r.trim()).filter(Boolean);

// ------------------------------------------------- quando il limite scatta
/**
 * `spawnSync` col `timeout` uccide il figlio e mette `error.code = "ETIMEDOUT"`
 * (misurato: `status: null`, `signal: "SIGKILL"`). Un processo ucciso NON e' un
 * processo che ha risposto male: distinguerli e' la differenza fra «lo strumento
 * dice che c'e' un problema» e «lo strumento non ha detto niente».
 *
 * Questo gate era l'UNICO della casa ad avere un limite (`AbortSignal.timeout`
 * sulla sonda dell'app), e si vedeva: contro un server che accetta e non
 * risponde tornava in 18,2 s con un ROSSO leggibile, dove speed-demon restava
 * appeso finche' non lo uccidevano (referto § H10, misurato il 2026-08-06).
 * Ma psql e Playwright, qui dentro, un limite non ce l'avevano (§ M14, § L10).
 */
export const scaduto = (res) => res?.error?.code === "ETIMEDOUT";

/** QUALE comando, QUANTO ha aspettato, e che cosa vale: MANCANTE, mai successo. */
export const motivoScaduto = (comando, ms) =>
  `\`${comando}\` non ha risposto entro ${Math.round(ms / 1000)} s ed e' stato interrotto. ` +
  "La verifica NON e' stata eseguita: MANCANTE, non un successo. " +
  "Un servizio che accetta la connessione e non risponde e' il guasto tipico — la porta e' aperta, il processo e' vivo, la risposta non arriva.";

// --------------------------------------------------------- contratto d'uscita
// Il verdetto dei passi GIA' eseguiti: l'handoff deve dichiarare lo stesso che
// il gate sta chiudendo.
export const verdettoDa = (passi) =>
  passi.some((s) => s.status !== "pass") ? "ROSSO" : "VERDE";

// Una riga sola, in una forma sola: un controllo su prosa libera e' un
// controllo che non c'e' (DECISIONI.md §19).
// Stessa cautela della riga `Confermato da:`: solo spazi orizzontali, o un
// `Gate:` lasciato a meta' andrebbe a pescare la parola VERDE tre righe piu'
// sotto, in una frase che parla d'altro.
const RIGA_VERDETTO = /^[ \t>*_-]*Gate[ \t*_]*:[ \t*_]*(VERDE|ROSSO)\b/im;

/** `retries: 1` — ne' 0 (rosso strutturale) ne' 2 (un flaky su tre invisibile). */
const RIGA_RETRIES = /(^|[^\w.])retries\s*:\s*(\d+)/gm;

/**
 * Un commento non configura niente.
 *
 * La lettura prendeva la PRIMA occorrenza nel file, commenti compresi: un
 * `// retries: 1 e' la regola del gate` scritto sopra un `retries: 3` vero
 * faceva uscire il passo `pass`. Misurato il 2026-07-28 sul `playwright.config.ts`
 * del banco — e la forma non e' cercata: la configurazione che questa casa
 * prescrive ha, sopra quella riga, quattro righe di commento che spiegano
 * perche' il numero e' 1.
 *
 * E NEMMENO UNA STRINGA CONFIGURA QUALCOSA (2026-08-06, sonda ostile). La forma
 * a due `replace` diceva «le stringhe restano: un `//` dentro un URL non apre un
 * commento, ed e' il solo caso che si incontra in un file di configurazione» —
 * cioe' la stessa frase del difetto n°50, una tolleranza aggiunta per un caso e
 * pagata su un altro. Misurato:
 *
 *   export default { use: { nota: "retries: 1" } };
 *     PRIMA  il gate legge `retries: 1` e chiude `pass`, su una configurazione
 *            che `retries` NON lo dichiara affatto
 *     DOPO   fail: «non dichiara `retries`»
 *
 * Ora passa dallo stesso scanner delle spec: i commenti se ne vanno sapendo
 * dove si trovano, e il CONTENUTO delle stringhe si svuota — perche' qui la
 * domanda e' «questa configurazione dichiara?», e cio' che sta dentro una
 * stringa non dichiara niente.
 */
// Due domande diverse, due funzioni. Qui il CONTENUTO delle stringhe RESTA:
// `usaHelperDb` cerca il percorso di un modulo, e un percorso dentro una
// stringa ci vive per definizione.
const senzaCommentiJs = (testo) =>
  codiceSenzaCommenti(righe(testo), false).map((l) => l.codice).join("\n");

// E qui no: la domanda e' «questa configurazione DICHIARA `retries`?», e cio'
// che sta dentro una stringa non dichiara niente.
const soloStruttura = (testo) =>
  codiceSenzaCommenti(righe(testo), true).map((l) => l.codice).join("\n");

export function contrattoUscita(percorsoHandoff, testoHandoff, testoConfigPlaywright, verdettoPrima) {
  const mancanti = [];
  if (testoConfigPlaywright === null) {
    mancanti.push("playwright.config.ts assente: senza, chi viene dopo non rilancia la batteria con le stesse regole (comando `forge`)");
  } else {
    // OGNI dichiarazione, non la prima: `projects: [{ retries: 3 }]` scavalca
    // il `retries: 1` globale, ed e' la forma che la documentazione di
    // Playwright suggerisce per alzare i tentativi di un progetto solo.
    // Misurato il 2026-07-28: con globale 1 e progetto 3, il runner esegue
    // quattro tentativi. Il gate leggeva il primo numero e diceva `pass`.
    const valori = [...soloStruttura(testoConfigPlaywright).matchAll(RIGA_RETRIES)]
      .map((t) => t[2]);
    const diversi = [...new Set(valori.filter((v) => v !== "1"))];
    if (valori.length === 0) mancanti.push("playwright.config.ts non dichiara `retries`: il default cambia il significato di ogni verde, e non si legge da nessuna parte");
    else if (diversi.length > 0) mancanti.push(`playwright.config.ts dichiara \`retries: ${diversi.join("` e `")}\`: la regola e' 1 — con 0 un ambiente instabile e' rosso strutturale, con 2 un test che passa una volta su tre e' invisibile. Vale ogni dichiarazione: quella dentro \`projects\` scavalca la globale`);
  }
  if (testoHandoff === null) {
    mancanti.push(`${percorsoHandoff} assente: il passaggio a valle non e' valido (comando \`handoff\`)`);
    return { status: "fail", detail: mancanti.join("\n") };
  }
  // stessa regola del contratto dei flussi: valgono le righe che l'handoff
  // scrive di suo, non quelle che cita. L'uscita del gate incollata in un
  // recinto e' cio' che `references/sabotaggio.md` prescrive di fare, e la sua
  // riga `Gate:` non e' una dichiarazione: e' un ricordo.
  const proprio = senzaZoneCitate(testoHandoff);
  if (proprio.includes("{{")) {
    mancanti.push(`${percorsoHandoff} contiene segnaposto {{...}} non compilati`);
  }
  // Esistere non basta, e nemmeno essere compilato: l'handoff deve dire la
  // verita' sul gate che lo sta verificando. Dichiarare ROSSO su un gate rosso
  // PASSA — dichiarare non e' fallire.
  const dichiarato = RIGA_VERDETTO.exec(proprio)?.[1]?.toUpperCase() ?? null;
  if (dichiarato === null) {
    mancanti.push(`${percorsoHandoff} non dichiara il verdetto: serve una riga \`Gate: ${verdettoPrima}\`. Chi viene dopo non deve rilanciare la batteria per sapere com'era chiusa`);
  } else if (dichiarato !== verdettoPrima) {
    mancanti.push(`${percorsoHandoff} dichiara \`Gate: ${dichiarato}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`);
  }
  return { status: mancanti.length === 0 ? "pass" : "fail", detail: mancanti.join("\n") };
}

/**
 * LA PASSWORD NON ESCE DAL GATE.
 *
 * Referto § M2: la URL di connessione col suo `--db-url` finisce in stdout e
 * nel `--json` di tre gate su quattro, e da li' negli handoff COMMITTATI. Il
 * 2026-08-06 il gate di launchpad ha bloccato la pubblicazione del pilota anche
 * per questo: `docs/handoff/08-vetrina-crafter.md @ fff715b` contiene una
 * `postgresql://…:…@…` scritta lo stesso giorno. E' MEDIUM finche' la password
 * e' `postgres:postgres` su loopback; torna HIGH il primo giorno in cui un
 * `--db-url` punta a un database che non e' locale — cosa che i gate accettano
 * senza obiezioni.
 *
 * PERCHE' `new URL` E NON UNA REGEXP. Il mascheramento esisteva gia' in casa,
 * a `vetrina-crafter/verify.mjs:378`, ed e' `replace(/:[^:@]*@/, ":***@")`.
 * Misurato il 2026-08-06, la regexp sbaglia in tre modi su cinque forme:
 *
 *   postgresql://postgres:p%40ss:word@db.example.com/prod
 *     regexp → postgresql://postgres:p%40ss:***@…   META' PASSWORD IN CHIARO
 *   postgresql://postgres@127.0.0.1:54322/postgres      (nessuna password)
 *     regexp → postgresql:***@127.0.0.1:54322/postgres  URL DISTRUTTA
 *   postgres://127.0.0.1:5432/db?opt=a:b@c              (nessuna password)
 *     regexp → postgres://127.0.0.1:5432/db?opt=a:***@c QUERY MANGIATA
 *
 * E' lo stesso guasto del difetto n°50 e degli altri tre di questa classe: uno
 * scanner scritto a mano che non sa dentro quale parte della struttura si trova.
 * `new URL` la struttura la conosce: `password` e' un campo, non un pezzo di
 * testo fra due caratteri. E' nel runtime, non e' una dipendenza.
 *
 * Se la URL non si interpreta affatto NON si stampa il testo originale: un
 * testo che contiene una `@` puo' contenere una credenziale, e un mascheratore
 * che in caso di dubbio stampa tutto non e' un mascheratore.
 */
// I parametri di query con cui libpq accetta una credenziale. `password` e'
// quello documentato; `sslpassword` e' la passphrase della chiave del client.
const PARAMETRI_SEGRETI = Object.freeze(["password", "sslpassword"]);

/** Il nome del parametro di query che porta una credenziale, o `null`. */
function credenzialeInQuery(analizzata) {
  return PARAMETRI_SEGRETI.find((p) => (analizzata.searchParams.get(p) ?? "") !== "") ?? null;
}

export function mascheraUrl(url) {
  const testo = String(url ?? "");
  if (testo === "") return testo;
  const nascosta = "<url non interpretabile: nascosta perche' poteva contenere una password>";
  try {
    const analizzata = new URL(testo);
    // La password non sta solo nell'autorita': libpq la accetta anche come
    // parametro di query, ed e' una forma che si usa proprio per evitare le
    // fughe dei caratteri speciali nell'userinfo. Li' non si maschera, SI
    // NASCONDE: riscrivere una query vorrebbe dire riserializzarla, e
    // `searchParams` ricodifica `%20` in `+` — che per l'`options` di libpq non
    // e' uno spazio. Si legge col parser e si rifiuta, non si riscrive.
    if (credenzialeInQuery(analizzata)) return nascosta;
    if (analizzata.password !== "") {
      analizzata.password = "***";
      return analizzata.href;
    }
    // `new URL` non solleva su cio' che ha una forma di schema: `postgres:pw@host`
    // si analizza come schema + percorso opaco, con `password` VUOTA — e senza
    // questa riga il testo uscirebbe intero. Misurato mentre si scriveva il test
    // che doveva vederlo nascosto. Se il parser non ha riconosciuto nessun host,
    // non ha riconosciuto nemmeno l'autorita': una `@` li' dentro non si stampa.
    if (analizzata.host === "" && testo.includes("@")) return nascosta;
    return testo;
  } catch {
    return testo.includes("@") ? nascosta : testo;
  }
}

/**
 * LA PASSWORD FUORI DALLA RIGA DI COMANDO.
 *
 * Referto § L2: il `--db-url` viaggia come argomento di processo, e la tabella
 * dei processi la legge chiunque sia sulla macchina. E' lo stesso segreto di
 * § M2 — transitorio in `argv` invece che permanente in un file committato —
 * ed e' declassato per questo, non perche' sia un altro segreto.
 *
 * `libpq` legge `PGPASSWORD` dall'ambiente: la URL passa a `psql` SENZA la
 * password, e la password passa da una variabile che non compare in nessuna
 * riga di comando. Non e' un mascheramento — e' un altro canale.
 *
 * Se la URL non porta password (autenticazione `trust`, `.pgpass`, socket) non
 * cambia niente: nessuna variabile e la URL com'era.
 */
export function credenzialiPsql(dbUrl) {
  const testo = String(dbUrl ?? "");
  let analizzata;
  try {
    analizzata = new URL(testo);
  } catch {
    // Non e' una URL: e' una stringa di connessione a parole chiave
    // (`host=… dbname=…`), che libpq accetta e che non ha un'autorita' da
    // spogliare. Passa com'e'.
    return { url: testo, env: {}, errore: null };
  }

  // Una credenziale FUORI dall'autorita' non si sposta e non si maschera: si
  // rifiuta. Riscrivere la query per toglierla vorrebbe dire riserializzarla, e
  // `searchParams` ricodifica `%20` in `+` — che per l'`options` di libpq non e'
  // uno spazio, quindi il gate interrogherebbe il database con un'altra
  // configurazione. Meglio nessuna misura di una misura su un'altra cosa.
  const inQuery = credenzialeInQuery(analizzata);
  if (inQuery) {
    return { url: null, env: {}, errore: `la URL del database porta la credenziale nel parametro di query \`${inQuery}\`: cosi' resta nella riga di comando e nei documenti, e questo gate non la riscrive perche' riserializzare la query cambierebbe l'\`options\` di libpq. Scrivila nell'autorita' (\`postgresql://utente:password@host/db\`) o passala da \`PGPASSWORD\`. Verifica MANCANTE.` };
  }

  if (analizzata.password === "") return { url: testo, env: {}, errore: null };

  // `decodeURIComponent`: nella URL la password e' percent-encoded, in
  // `PGPASSWORD` deve arrivare letterale. E puo' SOLLEVARE: `new URL` accetta
  // un `%` che non introduce due cifre esadecimali e lo lascia testuale,
  // `decodeURIComponent` no. Prima del 2026-08-07 il `try` avvolgeva anche
  // questa riga e la ricaduta restituiva la URL ORIGINALE — password in chiaro,
  // di nuovo in `argv`, e psql la rimandava indietro nel proprio stderr
  // («invalid percent-encoded token: …»), che tre gate stampano grezzo. Il
  // rimedio non e' ricadere: e' non misurare.
  let password;
  try {
    password = decodeURIComponent(analizzata.password);
  } catch {
    return { url: null, env: {}, errore: "la password nella URL del database ha una codifica percentuale non valida: `psql` la rifiuta e la rimanda nel proprio messaggio d'errore. Correggi la URL (`%` va scritto `%25`). Verifica MANCANTE." };
  }

  analizzata.password = "";
  return { url: analizzata.href, env: { PGPASSWORD: password }, errore: null };
}

/**
 * L'AMBIENTE CON CUI SI CHIAMA `psql`, costruito e non ereditato a meta'.
 *
 * Se la URL non porta password, `credenziali.env` e' vuoto — e un `PGPASSWORD`
 * rimasto nell'ambiente di chi ha lanciato il gate autenticherebbe al posto
 * nostro, in silenzio, con una credenziale che la URL del progetto non dichiara.
 * E' la stessa classe di `SUPABASE_DB_URL` rimasta da un altro progetto, che
 * questa casa rifiuta esplicitamente (DECISIONI.md §11): la premessa «questo e'
 * il database di QUESTO progetto» non si lascia decidere all'ambiente.
 */
export function ambientePsql(credenziali, aggiunte = {}) {
  const env = { ...process.env, ...aggiunte };
  delete env.PGPASSWORD;
  return { ...env, ...credenziali.env };
}
