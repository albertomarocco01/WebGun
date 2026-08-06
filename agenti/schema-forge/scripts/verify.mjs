#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Schema Forge (Legge n°2: il database e' il giudice).
 *
 * COSA FA: applica le migrazioni su un database pulito REALE e lancia la
 * batteria deterministica. Ogni passo finisce in uno di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica mancante.
 *
 * USO:  node verify.mjs [--db-url <url>] [--json] [--skip-reset]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: supabase CLI (con Docker attivo) e psql. sqlfluff/squawk opzionali.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { argomentiOstiliACmd, formaEseguibile, mascheraUrl, motivoOstile, motivoScaduto, risolviEseguibile, scaduto } from "./eseguibili.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// Le configurazioni dei linter viaggiano con la SKILL, non col progetto: il
// gate deve dare lo stesso esito ovunque giri, anche se il progetto non le ha
// (ancora) ricevute da `forge`. Ogni regola disattivata e' motivata nei file.
const CONFIG_DIR = join(SKILL_DIR, "resources", "config");
const PROJECT = process.cwd();
const MIGRATIONS_DIR = join(PROJECT, "supabase", "migrations");
const TYPES_PATH = join(PROJECT, "src", "lib", "database.types.ts");
const SUPABASE_CONFIG = join(PROJECT, "supabase", "config.toml");
// percorso relativo con le barre in avanti: `join` le normalizza su Windows, e
// il messaggio all'utente resta lo stesso su ogni piattaforma
const HANDOFF = "docs/handoff/07-schema-forge.md";

// ------------------------------------------------- identificatori di passo
// L'etichetta e' per gli umani e resta libera di cambiare; l'`id` e' il
// contratto con l'orchestratore e NON cambia. Finora l'unico identificatore
// era l'etichetta italiana ("contratto d'uscita (configurazioni + handoff)"):
// riscriverla avrebbe rotto in silenzio chiunque leggesse il `--json`.
export const ID = Object.freeze({
  sqlfluff: "sqlfluff",
  squawk: "squawk",
  reset: "db-reset",
  dbLint: "db-lint",
  advisors: "db-advisors",
  auditRls: "audit-rls",
  pgtap: "pgtap",
  tipi: "tipi",
  contratto: "contratto-uscita",
});

const steps = [];
// ritorna il passo registrato: i pochi passi che hanno conteggi strutturati
// (oggi solo l'audit RLS) li aggiungono sopra, senza un quinto parametro che
// tutti gli altri passerebbero vuoto
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

// --------------------------------------- eseguibili risolti a mano su Windows
// Le regole di risoluzione — e il perche' NON si cerca nella directory corrente,
// che qui e' la radice del progetto auditato — stanno in `eseguibili.mjs` con i
// loro test. Qui resta il ponte: si cerca una volta per nome, e i candidati
// RIFIUTATI perche' stavano dentro il progetto si conservano. Un passo che dice
// «strumento assente» senza dire «l'ho trovato, ma nel tuo progetto» manda a
// cercare la cosa sbagliata.
const rifiuti = new Map();

function dove(nome) {
  const { percorso, rifiutati } = risolviEseguibile(nome, PROJECT);
  if (rifiutati.length > 0) rifiuti.set(nome, rifiutati);
  return percorso;
}

export function notaRifiuto(rifiutati) {
  if (!rifiutati || rifiutati.length === 0) return "";
  return `\nRIFIUTATO perche' dentro il progetto auditato: ${rifiutati.join(", ")}. ` +
    "Un progetto non sceglie il binario che lo giudica: tieni lo strumento fuori dal progetto, o toglilo dal PATH.";
}

const rifiutoDi = (nome) => notaRifiuto(rifiuti.get(nome));

// `file === null` = nome non risolto. NON si ripiega sul nome nudo: lo
// risolverebbe la directory corrente, cioe' di nuovo il progetto auditato.
function has(cmd) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  if (file === null) return false;
  const probe = spawnSync(file, [...prefisso, "--version"], {
    encoding: "utf8", timeout: LIMITI.probe, killSignal: "SIGKILL",
  });
  return !probe.error && probe.status === 0;
}

/**
 * I LIMITI DI TEMPO, in un posto solo e con il perche' accanto.
 *
 * Misurato il 2026-08-06 (referto § H10 / § M14 / § M16): contro un socket che
 * accetta la connessione e non parla, l'audit RLS e' rimasto appeso finche' non
 * l'hanno ucciso — 100 secondi nella prova, UNA riga stampata, uscita 124.
 * Nessuna chiamata a processo di questa skill aveva un limite, e su `db reset`
 * costava doppio: `conRitentativo` ATTENDE il ritorno del primo tentativo, e su
 * un tentativo che non torna il ritentativo non «raddoppia» l'attesa — non parte.
 *
 * Un gate senza limite non e' lento: e' MUTO, e un gate muto non e' ne' verde ne'
 * rosso — e' assente, che e' il peggiore dei tre stati.
 */
export const LIMITI = Object.freeze({
  // Un `--version`: se non risponde in 15 s lo strumento non c'e' davvero.
  probe: 15_000,
  // `db reset` applica tutte le migrazioni su un database pulito e puo' durare:
  // largo apposta, e con esso `conRitentativo` puo' finalmente entrare in gioco.
  reset: 600_000,
  // Gli altri comandi della CLI e i linter: lint, advisors, gen types, sqlfluff.
  strumento: 300_000,
  // L'audit RLS e' un processo figlio con i suoi limiti dentro; questo e' il tetto.
  audit: 300_000,
});

function run(cmd, cmdArgs, opts = {}) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  if (file === null) {
    return {
      error: new Error(`${cmd} non risolto nel PATH${rifiutoDi(cmd)}`),
      status: null, stdout: "", stderr: "",
    };
  }
  // Il controllo vale SOLO quando si passa davvero da `cmd /c` (`prefisso`
  // pieno): un `.exe` riceve gli argomenti come vettore e non c'e' nessuna
  // shell a ri-analizzarli.
  if (prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(cmdArgs);
    if (ostili.length > 0) {
      return { error: new Error(motivoOstile(ostili)), status: null, stdout: "", stderr: "" };
    }
  }
  // OGNI chiamata a processo ha un limite: quello passato dal passo, o il
  // default degli strumenti. Nessuna resta senza (referto § H10).
  return spawnSync(file, [...prefisso, ...cmdArgs], {
    encoding: "utf8", cwd: PROJECT, maxBuffer: 64 * 1024 * 1024,
    timeout: LIMITI.strumento, killSignal: "SIGKILL", ...opts,
  });
}

// I file SQL di una cartella. Vale per le migrazioni e per i test pgTAP: in
// entrambi i casi la domanda non e' «la cartella esiste?» ma «quanti file ci
// sono?». Una cartella `supabase/tests/` vuota faceva uscire `supabase test db`
// con 0 (`Result: NOTESTS`, misurato il 2026-07-27) e il passo diventava verde:
// cancellare i test rendeva il gate piu' verde di tenerli.
export const soloSql = (nomi) => nomi.filter((f) => f.endsWith(".sql"));

// ------------------------------------------------- ritentativo del solo reset
// `supabase db reset` e' saltuariamente instabile su Windows (Error status 502
// mentre i container si riavviano) e il gate diventa rosso per un motivo
// ambientale. UN solo ritentativo: due tentativi distinguono l'ambiente
// traballante dallo schema rotto, tre nasconderebbero lo schema rotto.
// Nessun altro passo ritenta: se il lint fallisce, fallisce.
export function conRitentativo(esegui, attesaMs = 10_000) {
  const primo = esegui();
  if (primo.status === 0) return { res: primo, ritentato: false };
  // attesa sincrona: qui siamo nel mondo di spawnSync, non c'e' event loop
  if (attesaMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attesaMs);
  return { res: esegui(), ritentato: true };
}

// L'instabilita' dell'ambiente resta SCRITTA: un passo verde che ha avuto
// bisogno di due tentativi non e' uguale a un passo verde al primo colpo.
export function dettaglioReset(res, ritentato, migrazioni) {
  if (res.status === 0) {
    return `${migrazioni} migrazioni applicate + seed` +
      (ritentato ? " (riuscito al secondo tentativo)" : "");
  }
  return (res.stderr || res.stdout || "").trim().split("\n").slice(-25).join("\n");
}

// ------------------------------------------- dettaglio compatto degli advisors
// `supabase db advisors` risponde in JSON: stampato grezzo sono centinaia di
// righe e nel dettaglio del gate non lo leggerebbe nessuno. Qui si comprime a
// una riga per regola — nessun giudizio: il verdetto lo da' il codice d'uscita
// del CLI (`--fail-on error`), non questa funzione.
export function dettaglioAdvisors(stdout, massimoOggetti = 3) {
  const testo = stdout ?? "";
  let trovati;
  try {
    // il JSON e' incorniciato: "Connecting to local database..." davanti e, se la
    // CLI e' vecchia, l'avviso di aggiornamento dietro. Si prende dalla prima
    // quadra all'ULTIMA, non fino alla fine del testo.
    trovati = JSON.parse(testo.slice(testo.indexOf("["), testo.lastIndexOf("]") + 1));
  } catch {
    trovati = null;
  }
  // uscita non-JSON (errore di connessione, avviso della CLI): si riporta grezza
  if (!Array.isArray(trovati)) return testo.trim().split("\n").slice(0, 20).join("\n");
  if (trovati.length === 0) return "nessun rilievo";

  const gruppi = new Map();
  for (const f of trovati) {
    const chiave = `[${f.level}] ${f.name}`;
    if (!gruppi.has(chiave)) gruppi.set(chiave, { livello: f.level, quanti: 0, oggetti: new Set() });
    const g = gruppi.get(chiave);
    g.quanti += 1;
    g.oggetti.add([f.metadata?.schema, f.metadata?.name].filter(Boolean).join("."));
  }
  const peso = (livello) => ({ ERROR: 0, WARN: 1, INFO: 2 })[livello] ?? 9;
  return [...gruppi]
    .sort(([, a], [, b]) => peso(a.livello) - peso(b.livello))
    .map(([chiave, g]) => {
      const elenco = [...g.oggetti].filter(Boolean).slice(0, massimoOggetti);
      const coda = g.oggetti.size > elenco.length ? ", …" : "";
      return `${chiave} (${g.quanti}): ${elenco.join(", ")}${coda}`;
    })
    .join("\n");
}

// ------------------------------------------------- lettura del config.toml
// Tre chiavi in tutto: niente parser TOML fra le dipendenze di uno script che
// deve girare ovunque con `node` e basta. Serve anche per il `.sqlfluff`, che
// e' un INI con la stessa forma `[sezione]` + `chiave = valore`.
function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${chiave}\\s*=\\s*(.+)$`);
  const righe = (testoConfig ?? "").split(/\r?\n/);
  for (let i = 0; i < righe.length; i++) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(righe[i]);
    if (intestazione) {
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    if (!dentro) continue;
    const trovata = cerca.exec(righe[i]);
    if (!trovata) continue;
    // Un array TOML puo' stare su piu' righe, ed e' TOML valido — la CLI
    // Supabase lo legge senza fiatare (provato il 2026-07-27). Fermandosi alla
    // prima riga non si trovava nessun `[...]` e si ripiegava su `public`
    // SENZA dirlo: uno schema secondario esposto restava inaudito e il gate
    // stampava «schemi esposti: public» come se fosse la verita'.
    let valore = trovata[1];
    while (valore.includes("[") && !valore.includes("]") && i + 1 < righe.length) {
      valore += ` ${righe[++i].trim()}`;
    }
    return valore;
  }
  return null;
}

// ------------------------------------------- schemi realmente esposti al client
// L'audit RLS deve girare su cio' che PostgREST pubblica DAVVERO, non solo su
// `public`: una tabella nuda in uno schema secondario esposto e' lo stesso data
// leak. La verita' non e' un default dello script, e' `[api].schemas` del
// config.toml del progetto — l'unica riga che decide cosa esce dalla chiave
// anonima. Senza config leggibile si torna a `public` (e non a "niente").
// Ritorna `{schemi, errore}`: la chiave ASSENTE e' il default documentato di
// Supabase (`public` + `graphql_public`) e vale `public`; la chiave PRESENTE ma
// illeggibile e' un'altra cosa — e' una verifica mancante, non un successo su
// `public`. Prima le due cose erano indistinguibili e il gate stampava
// «schemi esposti: public» in entrambi i casi.
export function schemiEsposti(testoConfig) {
  const valore = valoreToml(testoConfig, "api", "schemas");
  if (valore === null) return { schemi: ["public"], errore: null };
  const lista = /\[([^\]]*)\]/.exec(valore);
  if (!lista) {
    return { schemi: [], errore: `[api].schemas presente ma non interpretabile (${valore.trim().slice(0, 80)}): l'audit non sa quali schemi guardare` };
  }
  const schemi = lista[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  if (schemi.length === 0) {
    return { schemi: [], errore: "[api].schemas e' vuoto: o l'API non espone niente (e va scritto nell'handoff), o il valore non e' stato letto" };
  }
  return { schemi, errore: null };
}

// --------------------------------------- il database del PROGETTO, non un altro
// `rls-audit.mjs` ripiega su SUPABASE_DB_URL o sulla porta 54322. Con due stack
// Supabase accesi — normale su una macchina di sviluppo — quella porta e' di un
// ALTRO progetto: il gate applicava le migrazioni qui e auditava altrove,
// riportando OK. La porta del progetto e' l'unica risposta giusta, ed e' la
// stessa che usa il CLI per `db reset`.
export function urlDbProgetto(testoConfig) {
  const valore = valoreToml(testoConfig, "db", "port");
  const porta = valore && /^(\d+)/.exec(valore.trim());
  return porta ? `postgresql://postgres:postgres@127.0.0.1:${porta[1]}/postgres` : null;
}

// ------------------------------------------ i file che sqlfluff NON ha letto
// sqlfluff salta i file oltre `large_file_skip_byte_limit` (default 20 000
// byte) ed esce comunque 0. Misurato il 2026-07-27: uno statement invalido
// dentro un file da 26 023 byte da' «All Finished!» e uscita 0, cioe' passo
// verde su SQL che nessuno ha guardato.
// L'avviso di sqlfluff esce su STDOUT, non su stderr: leggerlo sarebbe
// comunque leggere la prosa di uno strumento. Qui si misurano i byte prima di
// lanciarlo, cosi' il verdetto non dipende da come lo strumento formatta i
// suoi avvisi. Un file saltato non e' un file pulito: e' una verifica mancante.
export function limiteSqlfluff(testoConfig) {
  const valore = valoreToml(testoConfig, "sqlfluff", "large_file_skip_byte_limit");
  const numero = valore && /^(\d+)/.exec(valore.trim());
  return numero ? Number(numero[1]) : 20_000; // default di sqlfluff
}

export function fileNonLintati(dimensioni, limite) {
  if (limite <= 0) return []; // 0 = limite disattivato, sqlfluff legge tutto
  return dimensioni
    .filter(({ byte }) => byte > limite)
    .map(({ nome, byte }) => `${nome}: ${byte} byte, oltre il limite di ${limite}`);
}

// ------------------------------------------------ contratto d'uscita del progetto
// `forge` copia .sqlfluff e squawk.toml nella radice, `handoff` scrive il file di
// passaggio: due obblighi scritti che finora NIENTE verificava. Il gate restava
// verde identico se l'agente se ne dimenticava — le configurazioni le passa la
// skill, e l'handoff non lo legge nessuno strumento. Chi viene dopo, invece, ha
// solo quelli: senza, riproduce il gate con altre regole e costruisce alla cieca.

// Il verdetto dei passi GIA' eseguiti. Serve al contratto d'uscita: l'handoff
// deve dichiarare lo stesso verdetto che il gate sta chiudendo.
export function verdettoDa(passi) {
  return passi.some((s) => s.status !== "pass") ? "ROSSO" : "VERDE";
}

// Una riga sola, in una forma sola. La prosa libera si puo' sempre leggere come
// si vuole; una riga con una parola dentro no. Tollera l'elenco puntato, la
// citazione e il grassetto perche' sono i modi in cui un markdown scrive la
// stessa riga, non tre significati diversi.
// Spazi ORIZZONTALI soltanto: `\s` comprende l'a capo, e una riga `Gate:`
// lasciata vuota catturava un `VERDE` a inizio della riga seguente — cioe' un
// handoff non compilato passava per firmato. La firma sta sulla riga della firma.
const RIGA_VERDETTO = /^[ \t>*_-]*Gate[ \t*_]*:[ \t*_]*(VERDE|ROSSO)\b/im;

export function contrattoUscita(esiste, leggi, verdettoPrima) {
  const mancanti = [];
  for (const file of [".sqlfluff", "squawk.toml"]) {
    if (!esiste(file)) {
      mancanti.push(`${file} non copiato nella radice del progetto: il gate non e' riproducibile senza la skill (comando \`forge\`)`);
    }
  }
  if (!esiste(HANDOFF)) {
    mancanti.push(`${HANDOFF} assente: il passaggio a valle non e' valido (comando \`handoff\`)`);
    return { status: "fail", detail: mancanti.join("\n") };
  }
  const testo = leggi(HANDOFF);
  if (testo.includes("{{")) {
    mancanti.push(`${HANDOFF} contiene segnaposto {{...}} non compilati`);
  }
  // ESISTERE NON BASTA, e nemmeno essere compilato. Sul banco veterinario un
  // handoff fermo a due giorni prima — «1 issue, 1 warn», muto sui due passi
  // rossi e con dentro una tabella gia' droppata — chiudeva `pass`. Cioe' il
  // passo nato per far rispettare la Regola dei guardiani del CLAUDE.md
  // («nessun handoff valido senza scan pulito oppure residuo documentato») era
  // cieco proprio su quella clausola: verificava la forma del file, non che
  // dicesse la verita' sul gate che lo stava verificando.
  // Il confronto e' col verdetto dei passi 1-8: se l'handoff mente, il passo
  // fallisce; se dice il vero, passa. Non e' un rosso strutturale — si aggiorna
  // l'handoff e si rilancia, che e' esattamente il ciclo che deve esistere.
  const dichiarato = RIGA_VERDETTO.exec(testo)?.[1]?.toUpperCase() ?? null;
  if (dichiarato === null) {
    mancanti.push(`${HANDOFF} non dichiara il verdetto del gate: serve una riga \`Gate: ${verdettoPrima}\`. Chi viene dopo non deve rilanciare il gate per sapere com'era chiuso`);
  } else if (dichiarato !== verdettoPrima) {
    mancanti.push(`${HANDOFF} dichiara \`Gate: ${dichiarato}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`);
  }
  return {
    status: mancanti.length === 0 ? "pass" : "fail",
    detail: mancanti.join("\n"),
  };
}

function parseArgs(argv) {
  const args = { dbUrl: null, json: false, skipReset: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--skip-reset") args.skipReset = true;
  }
  return args;
}

// -------------------------------------------------------- i passi, uno per uno
// Un passo per funzione: `main()` era una sequenza unica di nove `if/else` con
// complessita' 56 contro la soglia 15 dei guardiani. Non era logica annidata, ma
// la soglia e' la soglia, e un gate che viola le regole che impone non e'
// credibile. Ogni funzione registra il proprio esito in `steps` e non ritorna
// niente: l'ordine delle chiamate in `main()` e' l'ordine del gate.

// 0. prerequisito: esistono migrazioni da verificare?
function migrazioniDaVerificare() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`Nessuna cartella ${MIGRATIONS_DIR}: non c'e' schema da verificare.`);
    process.exit(2);
  }
  const migrations = soloSql(readdirSync(MIGRATIONS_DIR));
  if (migrations.length === 0) {
    console.error("Nessuna migrazione trovata: non c'e' schema da verificare.");
    process.exit(2);
  }
  return migrations;
}

// 1. formato SQL — sqlfluff (opzionale)
function passoSqlfluff(migrations) {
  const etichetta = "sqlfluff (formato SQL)";
  if (!has("sqlfluff")) {
    record(ID.sqlfluff, etichetta, "skipped", `sqlfluff non installato: pipx install sqlfluff${rifiutoDi("sqlfluff")}`);
    return;
  }
  const config = join(CONFIG_DIR, ".sqlfluff");
  const saltati = fileNonLintati(
    migrations.map((f) => ({ nome: f, byte: statSync(join(MIGRATIONS_DIR, f)).size })),
    limiteSqlfluff(readFileSync(config, "utf8"))
  );
  const res = run("sqlfluff", ["lint", "--dialect", "postgres", "--config", config, MIGRATIONS_DIR]);
  const rilievi = (res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n");
  const avviso = saltati.length === 0 ? "" :
    ["sqlfluff NON ha letto questi file (li salta ed esce comunque 0):", ...saltati,
      "spezza la migrazione (un file = un motivo) oppure alza `large_file_skip_byte_limit` nel .sqlfluff, motivandolo"].join("\n");
  if (res.status !== 0) {
    record(ID.sqlfluff, etichetta, "fail", avviso ? `${rilievi}\n${avviso}` : rilievi);
  } else {
    // uscita 0 con dei file saltati NON e' un pass: e' un pass su meta' schema
    record(ID.sqlfluff, etichetta, saltati.length === 0 ? "pass" : "skipped", avviso);
  }
}

// 2. sicurezza delle migrazioni — squawk (opzionale)
function passoSquawk(migrations) {
  if (has("squawk")) {
    const res = run("squawk", [
      "-c", join(CONFIG_DIR, "squawk.toml"),
      ...migrations.map((f) => join(MIGRATIONS_DIR, f)),
    ]);
    record(ID.squawk, "squawk (operazioni pericolose)", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 30).join("\n"));
  } else {
    record(ID.squawk, "squawk (operazioni pericolose)", "skipped", `squawk non installato: pipx install squawk-cli${rifiutoDi("squawk")}`);
  }
}

// 3. IL GATE VERO: applicazione su database pulito
function passoReset(supabaseAvailable, skipReset, quanteMigrazioni) {
  const etichetta = "supabase db reset (applicazione reale)";
  if (!supabaseAvailable) {
    record(ID.reset, etichetta, "skipped",
      `Supabase CLI assente: lo schema NON e' stato applicato. Il gate non puo' essere verde.${rifiutoDi("supabase")}`);
  } else if (skipReset) {
    record(ID.reset, etichetta, "skipped", "saltato esplicitamente con --skip-reset");
  } else {
    // `timeout: LIMITI.reset` non e' un dettaglio: senza, `conRitentativo`
    // aspetta il ritorno di un primo tentativo che non torna, e il ritentativo
    // NON PARTE (referto § M16). Con il limite, il primo tentativo finisce
    // sempre — e se e' finito perche' e' scaduto, il secondo ha senso davvero.
    const { res, ritentato } = conRitentativo(
      () => run("supabase", ["db", "reset"], { timeout: LIMITI.reset }));
    if (scaduto(res)) {
      record(ID.reset, etichetta, "skipped",
        `${motivoScaduto("supabase db reset", LIMITI.reset)}${ritentato ? " (ed era il secondo tentativo)" : ""}`);
      return;
    }
    record(ID.reset, etichetta, res.status === 0 ? "pass" : "fail",
      dettaglioReset(res, ritentato, quanteMigrazioni));
  }
}

// 4. lint del database
function passoDbLint(supabaseAvailable) {
  if (supabaseAvailable) {
    const res = run("supabase", ["db", "lint", "--level", "warning"]);
    record(ID.dbLint, "supabase db lint", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n"));
  } else {
    record(ID.dbLint, "supabase db lint", "skipped", `Supabase CLI assente${rifiutoDi("supabase")}`);
  }
}

// 5. advisors: il linter di sicurezza/performance MANTENUTO da Supabase.
// La sovrapposizione e' dichiarata, non nascosta: quattro delle sei regole di
// `audit-lib.mjs` le copre anche lui (RLS assente, policy senza RLS attiva,
// `security definer` senza search_path, chiavi esterne non indicizzate). Il
// valore non e' la novita': e' che l'altra meta' — `auth_users_exposed`,
// `policy_exists_rls_disabled`, `multiple_permissive_policies`,
// `extension_in_public`, `rls_references_user_metadata` — la mantiene
// qualcun altro, e resta aggiornata senza che questa skill la rincorra.
// `--fail-on error` e non `warn`: fra i WARN ci sono impostazioni di Auth del
// progetto (scadenza degli OTP, opzioni MFA) che una migrazione non puo'
// correggere. Farle diventare rosso il gate sarebbe un rosso strutturale, e
// un rosso strutturale insegna a ignorare il rosso. I WARN restano scritti nel
// dettaglio, che si stampa anche sui passi verdi.
function passoAdvisors(supabaseAvailable) {
  if (!supabaseAvailable) {
    record(ID.advisors, "supabase db advisors", "skipped", `Supabase CLI assente${rifiutoDi("supabase")}`);
  } else if (run("supabase", ["db", "advisors", "--help"]).status !== 0) {
    // sottocomando sconosciuto: verifica MANCANTE, mai `fail`. Un gate rosso
    // perche' la CLI e' vecchia non parla dello schema (come sqlfluff/squawk).
    record(ID.advisors, "supabase db advisors", "skipped",
      "sottocomando assente: `db advisors` richiede la CLI Supabase v2.81.3+ (`supabase --version`)");
  } else {
    const res = run("supabase",
      ["db", "advisors", "--local", "--level", "warn", "--fail-on", "error"]);
    record(ID.advisors, "supabase db advisors", res.status === 0 ? "pass" : "fail",
      dettaglioAdvisors(res.stdout || res.stderr || ""));
  }
}

// 6. audit RLS (il controllo che non puo' mancare) — su TUTTI gli schemi esposti
const ETICHETTA_AUDIT = "audit RLS";

function passoAuditRls(dbUrlEsplicito) {
  const testoConfig = existsSync(SUPABASE_CONFIG) ? readFileSync(SUPABASE_CONFIG, "utf8") : null;
  const { schemi, errore } = schemiEsposti(testoConfig);
  if (errore) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped", errore);
    return;
  }
  // precedenza: --db-url esplicito > config.toml del progetto. Mai l'ambiente:
  // una SUPABASE_DB_URL rimasta da un altro progetto e' esattamente il modo in
  // cui il gate finisce per auditare il database sbagliato e dire OK.
  // Senza URL risolvibile NON si audita alla cieca: `rls-audit.mjs` ripiegherebbe
  // sulla 54322, che con due stack accesi e' il progetto di qualcun altro, e
  // sparirebbe anche la meta' «quale database» del dettaglio — cioe' proprio la
  // garanzia di DECISIONI.md §11, che svanirebbe dove serve. Verifica MANCANTE.
  const dbUrl = dbUrlEsplicito ?? urlDbProgetto(testoConfig);
  if (!dbUrl) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped",
      "database del progetto non risolvibile: manca `[db].port` in supabase/config.toml e non e' stato passato --db-url. L'audit NON e' stato eseguito: senza, ripiegherebbe sulla porta 54322, che con due stack Supabase accesi e' un altro progetto.");
    return;
  }
  // `process.execPath`, non `run("node", …)`: l'interprete che sta girando, non
  // quello che un `node.cmd` nella radice del progetto auditato vorrebbe farci
  // eseguire. Un finto `node` che stampi `{"summary":{"block":0,…}}` portava a
  // casa da solo «il controllo che non puo' mancare» (referto § C1).
  registraAudit(spawnSync(process.execPath, [
    join(SKILL_DIR, "scripts", "rls-audit.mjs"),
    "--json",
    "--schemas", schemi.join(","),
    "--db-url", dbUrl,
    // i test pgTAP entrano nell'audit: una policy di scrittura mai attaccata da
    // un test e' un'ipotesi, e il catalogo da solo non puo' saperlo
    "--tests", join(PROJECT, "supabase", "tests"),
  ], { encoding: "utf8", cwd: PROJECT, maxBuffer: 64 * 1024 * 1024,
       timeout: LIMITI.audit, killSignal: "SIGKILL" }), schemi, dbUrl);
}

// L'uscita dell'audit era data in pasto a `JSON.parse` nuda: un `rls-audit.mjs`
// morto a meta' stampa, o una CLI che ci infila un avviso davanti, faceva morire
// il GATE con un'eccezione non gestita — nessun verdetto affatto, invece di una
// verifica mancante. Un gate che crasha non e' ne' verde ne' rosso: e' assente.
export function leggiAudit(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { errore: `uscita dell'audit non interpretabile come JSON: ${String(stdout).trim().slice(0, 200)}` };
  }
  if (!parsed?.summary || !Array.isArray(parsed.findings)) {
    return { errore: "uscita dell'audit senza `summary`/`findings`: contratto non rispettato, l'audit non e' utilizzabile" };
  }
  return { parsed };
}

function registraAudit(audit, schemi, dbUrl) {
  if (scaduto(audit)) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped", motivoScaduto("l'audit RLS", LIMITI.audit));
    return;
  }
  if (audit.status === 2 || !audit.stdout) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped", (audit.stderr || "audit non eseguito").trim());
    return;
  }
  const { parsed, errore } = leggiAudit(audit.stdout);
  if (errore) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped", errore);
    return;
  }
  const { block, issue, warn } = parsed.summary;
  const residuo = parsed.findings
    .filter((f) => f.severity !== "warn")
    .map((f) => `[${f.severity}] ${f.object}: ${f.message}`)
    .join("\n") || `nessun bloccante (${issue} issue, ${warn} warn)`;
  // schemi e database si stampano sempre: un audit che ha guardato solo meta'
  // del database — o il database di un altro progetto — non deve poter passare
  // per un audit completo
  record(ID.auditRls, ETICHETTA_AUDIT, block === 0 ? "pass" : "fail",
    `schemi esposti: ${schemi.join(", ")} · ${mascheraUrl(dbUrl)}\n${residuo}`
  ).counts = { block, issue, warn };
}

// 7. test delle policy — pgTAP
// Si contano i FILE, non si guarda se la cartella esiste: `supabase test db` su
// una cartella vuota esce 0 (`Result: NOTESTS`) e il passo diventava verde.
// Cancellare i test era il modo piu' rapido di rendere il gate piu' verde.
function passoPgtap(supabaseAvailable) {
  const etichetta = "pgTAP (test delle policy)";
  const dir = join(PROJECT, "supabase", "tests");
  const quanti = existsSync(dir) ? soloSql(readdirSync(dir)).length : 0;
  if (quanti === 0) {
    // il conteggio che DECIDE resta quello del primo livello: e' l'unico di cui
    // si sa cosa faccia `supabase test db`. Quello ricorsivo serve solo a non
    // dire «nessun file .sql» a chi i file ce li ha, annidati.
    const annidati = existsSync(dir) ? soloSql(readdirSync(dir, { recursive: true })).length : 0;
    record(ID.pgtap, etichetta, "skipped",
      "nessun file .sql al primo livello di supabase/tests/: le policy sono un'ipotesi non verificata" +
      (annidati > 0 ? ` (${annidati} in sottocartelle, non contati)` : ""));
  } else if (!supabaseAvailable) {
    record(ID.pgtap, etichetta, "skipped", `Supabase CLI assente${rifiutoDi("supabase")}`);
  } else {
    const res = run("supabase", ["test", "db"]);
    record(ID.pgtap, etichetta, res.status === 0 ? "pass" : "fail",
      res.status === 0 ? `${quanti} file di test eseguiti`
        : (res.stdout || res.stderr || "").trim().split("\n").slice(-25).join("\n"));
  }
}

// 8. tipi TypeScript allineati
// Il confronto era byte a byte sul testo grezzo, quindi un BOM o dei CRLF
// bastavano a farlo fallire: su Windows e' la norma (`>` di PowerShell, git con
// `autocrlf`, mezzo editor). Un passo rosso per un fine riga NON parla dello
// schema, ed e' esattamente il rosso strutturale che insegna a ignorare il
// rosso. Si normalizza SOLO cio' che non porta significato: un tipo davvero
// diverso resta rosso, e un file in UTF-16 pure (letto come utf8 non e' testo
// che qualche `\r` possa salvare).
export function normalizzaTipi(testo) {
  return String(testo ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}

function passoTipi(supabaseAvailable) {
  if (supabaseAvailable) {
    const res = run("supabase", ["gen", "types", "typescript", "--local"]);
    if (res.status !== 0) {
      record(ID.tipi, "tipi TypeScript", "fail", (res.stderr || "").trim().split("\n").slice(0, 10).join("\n"));
    } else if (!existsSync(TYPES_PATH)) {
      record(ID.tipi, "tipi TypeScript", "fail", `${TYPES_PATH} non esiste: Fly UI costruirebbe alla cieca`);
    } else {
      const current = normalizzaTipi(readFileSync(TYPES_PATH, "utf8"));
      const fresh = normalizzaTipi(res.stdout);
      record(ID.tipi, "tipi TypeScript", current === fresh ? "pass" : "fail",
        current === fresh ? "" : "tipi disallineati dallo schema: rigenerali con `types`");
    }
  } else {
    record(ID.tipi, "tipi TypeScript", "skipped", `Supabase CLI assente${rifiutoDi("supabase")}`);
  }
}

// 9. contratto d'uscita: cosa trova davvero chi viene dopo
// E' l'ultimo passo apposta: il verdetto che l'handoff deve dichiarare e' quello
// degli otto passi che l'hanno preceduto, ed e' gia' tutto in `steps`.
function passoContratto() {
  const contratto = contrattoUscita(
    (rel) => existsSync(join(PROJECT, rel)),
    (rel) => readFileSync(join(PROJECT, rel), "utf8"),
    verdettoDa(steps)
  );
  record(ID.contratto, "contratto d'uscita (configurazioni + handoff)", contratto.status, contratto.detail);
}

// ------------------------------------------------------------------- verdetto
// Conteggi strutturati: l'orchestratore non deve contare le righe di prosa del
// dettaglio per sapere quanti passi sono rossi. `CONTRATTO_JSON` si alza quando
// cambia la FORMA (campi tolti o rinominati); aggiungere un campo non la alza.
export const CONTRATTO_JSON = 1;

export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

// Ritorna il codice d'uscita invece di chiamare `process.exit`: cosi' il verdetto
// e' la stessa cosa stampata e la stessa cosa restituita, senza due strade.
function verdetto(json) {
  const failed = steps.filter((s) => s.status === "fail");
  const skipped = steps.filter((s) => s.status === "skipped");
  const green = failed.length === 0 && skipped.length === 0;

  if (json) {
    console.log(JSON.stringify(
      { contract: CONTRATTO_JSON, ok: green, summary: riepilogo(steps), steps }, null, 2));
    return green ? 0 : 1;
  }

  console.log(`GATE SCHEMA: ${green ? "VERDE" : "ROSSO"} ` +
    `(${failed.length} falliti, ${skipped.length} verifiche mancanti su ${steps.length} passi)\n`);
  for (const s of steps) {
    const mark = { pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status];
    console.log(`${mark}  ${s.name}`);
    // il dettaglio si stampa anche sui passi verdi: e' li' che finisce
    // "riuscito al secondo tentativo", e un'instabilita' nascosta non esiste
    if (s.detail) {
      for (const line of s.detail.split("\n")) console.log(`        ${line}`);
    }
  }
  if (skipped.length > 0) {
    console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  }
  return green ? 0 : 1;
}

// L'ordine di queste chiamate E' il gate. Niente altro qui dentro.
function main() {
  const args = parseArgs(process.argv.slice(2));
  const migrations = migrazioniDaVerificare();
  const supabaseAvailable = has("supabase");

  passoSqlfluff(migrations);
  passoSquawk(migrations);
  passoReset(supabaseAvailable, args.skipReset, migrations.length);
  passoDbLint(supabaseAvailable);
  passoAdvisors(supabaseAvailable);
  passoAuditRls(args.dbUrl);
  passoPgtap(supabaseAvailable);
  passoTipi(supabaseAvailable);
  passoContratto();

  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano conRitentativo/dettaglioReset.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde. Questo gate lo ha
// fatto per davvero: misurato il 2026-08-03 su questa macchina (Node 20.12.2,
// l'unico Node di sistema) in una cartella non-progetto — uscita 0, zero righe,
// dove Node 24.18.1 stampava il messaggio e usciva 2. I prerequisiti della
// skill dicono «Node >= 20»: il confronto qui sotto li rispetta ovunque.
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e il gate usciva 0 muto (misurato il 2026-08-04,
// P.4-pre, PILOTA-PRE-2026-08-04.md §2b). `realpathSync` scioglie la junction;
// se solleva si ricade sul confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
