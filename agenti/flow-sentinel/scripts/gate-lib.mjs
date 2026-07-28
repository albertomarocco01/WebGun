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
export const righe = (testo) =>
  senzaBom(testo).split(/\r?\n/);

export const senzaBom = (testo) => String(testo ?? "").replace(/^\uFEFF/, "");

/** I tre tipi di flusso. L'ordine e' quello di `references/flussi-critici.md`. */
export const TIPI_FLUSSO = Object.freeze(["positivo", "ostile-lettura", "ostile-scrittura"]);

/**
 * I tipi che DEVONO asserire l'effetto sul database.
 * `ostile-lettura` non c'e' apposta: un attacco in lettura non cambia niente,
 * quindi non c'e' stato da confrontare — il rifiuto della rotta e' l'asserzione.
 */
export const TIPI_CON_EFFETTO_DB = Object.freeze(["positivo", "ostile-scrittura"]);

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

// Tollera elenco puntato, citazione e grassetto — come la riga `Gate:`.
const RIGA_CONFERMA = /^[\s>*_-]*Confermato da[\s*_]*:[\s*_]*(.+?)[\s*_]*$/im;

export function leggiFlussi(testo) {
  const flussi = [];
  const errori = [];
  const visti = new Set();
  for (const linea of righe(testo)) {
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
  const conferma = RIGA_CONFERMA.exec(senzaBom(testo));
  return { confermatoDa: conferma ? conferma[1].trim() : null, flussi, errori };
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
const SALTA = /\b(test|describe|it)(?:\.[a-z]+)*\.skip\s*\(/;
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
    if (SALTA.test(linea) && !motivato(linee, i)) {
      findings.push({
        severity: "issue",
        object: `${file}:${i + 1}`,
        message: "`.skip` senza motivazione scritta accanto: scrivi in un commento perche' e' saltato e quando rientra, o toglilo",
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
const IMPORT_HELPER_DB = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["'][^"']*helpers\/db(?:\.[cm]?[jt]s)?["']/g;

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
  for (const messaggio of report.errors ?? []) {
    esito.errori.push(String(messaggio?.message ?? messaggio).trim().split("\n")[0]);
  }
  visita(report.suites, [], esito);
  return esito;
}

function visita(suites, antenati, esito) {
  for (const suite of suites ?? []) {
    const percorso = [...antenati, suite.title].filter(Boolean);
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) registra([...percorso, spec.title].join(" › "), t.status, esito);
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
export function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${chiave}\\s*=\\s*(.+)$`);
  const linee = righe(testoConfig);
  for (const linea of linee) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(linea);
    if (intestazione) {
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    const trovata = dentro && cerca.exec(linea);
    if (trovata) return trovata[1];
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
const RIGA_VERDETTO = /^[\s>*_-]*Gate[\s*_]*:[\s*_]*(VERDE|ROSSO)\b/im;

/** `retries: 1` — ne' 0 (rosso strutturale) ne' 2 (un flaky su tre invisibile). */
const RIGA_RETRIES = /(^|[^\w.])retries\s*:\s*(\d+)/m;

export function contrattoUscita(percorsoHandoff, testoHandoff, testoConfigPlaywright, verdettoPrima) {
  const mancanti = [];
  if (testoConfigPlaywright === null) {
    mancanti.push("playwright.config.ts assente: senza, chi viene dopo non rilancia la batteria con le stesse regole (comando `forge`)");
  } else {
    const retries = RIGA_RETRIES.exec(senzaBom(testoConfigPlaywright));
    if (!retries) mancanti.push("playwright.config.ts non dichiara `retries`: il default cambia il significato di ogni verde, e non si legge da nessuna parte");
    else if (retries[2] !== "1") mancanti.push(`playwright.config.ts dichiara \`retries: ${retries[2]}\`: la regola e' 1 — con 0 un ambiente instabile e' rosso strutturale, con 2 un test che passa una volta su tre e' invisibile`);
  }
  if (testoHandoff === null) {
    mancanti.push(`${percorsoHandoff} assente: il passaggio a valle non e' valido (comando \`handoff\`)`);
    return { status: "fail", detail: mancanti.join("\n") };
  }
  if (testoHandoff.includes("{{")) {
    mancanti.push(`${percorsoHandoff} contiene segnaposto {{...}} non compilati`);
  }
  // Esistere non basta, e nemmeno essere compilato: l'handoff deve dire la
  // verita' sul gate che lo sta verificando. Dichiarare ROSSO su un gate rosso
  // PASSA — dichiarare non e' fallire.
  const dichiarato = RIGA_VERDETTO.exec(senzaBom(testoHandoff))?.[1]?.toUpperCase() ?? null;
  if (dichiarato === null) {
    mancanti.push(`${percorsoHandoff} non dichiara il verdetto: serve una riga \`Gate: ${verdettoPrima}\`. Chi viene dopo non deve rilanciare la batteria per sapere com'era chiusa`);
  } else if (dichiarato !== verdettoPrima) {
    mancanti.push(`${percorsoHandoff} dichiara \`Gate: ${dichiarato}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`);
  }
  return { status: mancanti.length === 0 ? "pass" : "fail", detail: mancanti.join("\n") };
}
