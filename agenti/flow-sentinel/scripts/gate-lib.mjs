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
const COMMENTO = /^\s*(\/\/|\*|\/\*)/;

export function regoleSpec(file, testo) {
  const linee = righe(testo);
  const findings = [];
  for (let i = 0; i < linee.length; i++) {
    const linea = linee[i];
    // una riga di commento che NOMINA `.only` non e' un `.only`: le reference
    // e i commenti di questa casa ne parlano, e il gate non deve bocciarle
    if (COMMENTO.test(linea)) continue;
    if (SOLO.test(linea)) {
      findings.push({
        severity: "block",
        object: `${file}:${i + 1}`,
        message: "`.only` committato: il resto della batteria non gira, e il verde che ne esce non ha guardato niente",
      });
    }
    const salta = SALTA.exec(linea);
    if (salta && !motivato(linee, i)) {
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
function motivato(linee, indice) {
  if (linee[indice].includes("//")) return true;
  for (let i = indice - 1; i >= 0; i--) {
    const precedente = linee[i].trim();
    if (precedente === "") continue;
    return COMMENTO.test(precedente);
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
const IMPORT_HELPER_DB = /import\s+(?:type\s+)?([^;"']*?)\s+from\s+["'][^"']*helpers\/db(?:\.[cm]?[jt]s)?["']/g;

export function usaHelperDb(testo) {
  const pulito = senzaBom(testo);
  const nomi = [];
  for (const [, clausola] of pulito.matchAll(IMPORT_HELPER_DB)) {
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
  const esito = { passati: 0, falliti: [], alSecondoTentativo: [], saltati: [], errori: [] };
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
  for (const suite of suites ?? []) {
    if (!suite || typeof suite !== "object") continue;
    const percorso = [...antenati, suite.title].filter(Boolean);
    for (const spec of suite.specs ?? []) {
      if (!spec || typeof spec !== "object") continue;
      for (const t of spec.tests ?? []) registra([...percorso, spec.title].join(" › "), t?.status, esito);
    }
    visita(suite.suites, percorso, esito);
  }
}

function registra(nome, stato, esito) {
  if (stato === "expected") esito.passati += 1;
  else if (stato === "flaky") { esito.passati += 1; esito.alSecondoTentativo.push(nome); }
  else if (stato === "skipped") esito.saltati.push(nome);
  else esito.falliti.push(nome);
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

export function formaEseguibile(nome, cercaPercorso, piattaforma = process.platform) {
  if (piattaforma !== "win32") return { file: nome, prefisso: [] };
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: nome, prefisso: [] };
  return /\.(cmd|bat)$/i.test(trovato)
    ? { file: "cmd.exe", prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

// ----------------------------------------------- lettura del `config.toml`
// Tre chiavi in tutto: nessun parser TOML fra le dipendenze di uno script che
// deve girare ovunque con `node` e basta.
function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${chiave}\\s*=\\s*(.+)$`);
  const linee = righe(testoConfig);
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

const senzaVirgolette = (valore) => valore.trim().replace(/\s*#.*$/, "").replace(/^["']|["']$/g, "");

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
 * Le stringhe restano: `//` dentro un URL non apre un commento, ed e' il solo
 * caso che si incontra in un file di configurazione.
 */
const senzaCommentiJs = (testo) =>
  testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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
    const valori = [...senzaCommentiJs(senzaBom(testoConfigPlaywright)).matchAll(RIGA_RETRIES)]
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
