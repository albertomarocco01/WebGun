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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
// `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd`
// (quello che si ottiene installando la CLI Supabase da npm) risulta ENOENT, e
// col percorso pieno risulta EINVAL — Node rifiuta di eseguire .cmd/.bat senza
// shell dalla mitigazione della CVE-2024-27980. Risultato misurato il
// 2026-07-27: quattro passi `skipped` con scritto «Supabase CLI assente» su una
// macchina dove la CLI c'e' e funziona. Il guasto va nella direzione sicura, la
// diagnosi no.
// NON si abilita `shell: true`: li' gli argomenti vengono concatenati invece
// che passati come vettore, e questo gate passa percorsi con spazi. Si passa da
// `cmd.exe /c <percorso pieno>`, che riceve gli argomenti uno per uno — provato
// con un percorso contenente uno spazio.
export function formaEseguibile(nome, cercaPercorso, piattaforma = process.platform) {
  if (piattaforma !== "win32") return { file: nome, prefisso: [] };
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: nome, prefisso: [] };
  return /\.(cmd|bat)$/i.test(trovato)
    ? { file: "cmd.exe", prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

// `where` elenca in ordine di PATH e poi di PATHEXT: la prima riga e' cio' che
// verrebbe eseguito davvero.
function dove(nome) {
  const res = spawnSync("where", [nome], { encoding: "utf8" });
  if (res.error || res.status !== 0) return null;
  return (res.stdout ?? "").split(/\r?\n/).map((r) => r.trim()).find(Boolean) ?? null;
}

function has(cmd) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  const probe = spawnSync(file, [...prefisso, "--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

function run(cmd, cmdArgs, opts = {}) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  return spawnSync(file, [...prefisso, ...cmdArgs], { encoding: "utf8", cwd: PROJECT, ...opts });
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
export function contrattoUscita(esiste, leggi) {
  const mancanti = [];
  for (const file of [".sqlfluff", "squawk.toml"]) {
    if (!esiste(file)) {
      mancanti.push(`${file} non copiato nella radice del progetto: il gate non e' riproducibile senza la skill (comando \`forge\`)`);
    }
  }
  if (!esiste(HANDOFF)) {
    mancanti.push(`${HANDOFF} assente: il passaggio a valle non e' valido (comando \`handoff\`)`);
  } else if (leggi(HANDOFF).includes("{{")) {
    mancanti.push(`${HANDOFF} contiene segnaposto {{...}} non compilati`);
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
    record(ID.sqlfluff, etichetta, "skipped", "sqlfluff non installato: pipx install sqlfluff");
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
    record(ID.squawk, "squawk (operazioni pericolose)", "skipped", "squawk non installato: pipx install squawk-cli");
  }
}

// 3. IL GATE VERO: applicazione su database pulito
function passoReset(supabaseAvailable, skipReset, quanteMigrazioni) {
  const etichetta = "supabase db reset (applicazione reale)";
  if (!supabaseAvailable) {
    record(ID.reset, etichetta, "skipped",
      "Supabase CLI assente: lo schema NON e' stato applicato. Il gate non puo' essere verde.");
  } else if (skipReset) {
    record(ID.reset, etichetta, "skipped", "saltato esplicitamente con --skip-reset");
  } else {
    const { res, ritentato } = conRitentativo(() => run("supabase", ["db", "reset"]));
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
    record(ID.dbLint, "supabase db lint", "skipped", "Supabase CLI assente");
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
    record(ID.advisors, "supabase db advisors", "skipped", "Supabase CLI assente");
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
  registraAudit(run("node", [
    join(SKILL_DIR, "scripts", "rls-audit.mjs"),
    "--json",
    "--schemas", schemi.join(","),
    "--db-url", dbUrl,
    // i test pgTAP entrano nell'audit: una policy di scrittura mai attaccata da
    // un test e' un'ipotesi, e il catalogo da solo non puo' saperlo
    "--tests", join(PROJECT, "supabase", "tests"),
  ]), schemi, dbUrl);
}

function registraAudit(audit, schemi, dbUrl) {
  if (audit.status === 2 || !audit.stdout) {
    record(ID.auditRls, ETICHETTA_AUDIT, "skipped", (audit.stderr || "audit non eseguito").trim());
    return;
  }
  const parsed = JSON.parse(audit.stdout);
  const { block, issue, warn } = parsed.summary;
  const residuo = parsed.findings
    .filter((f) => f.severity !== "warn")
    .map((f) => `[${f.severity}] ${f.object}: ${f.message}`)
    .join("\n") || `nessun bloccante (${issue} issue, ${warn} warn)`;
  // schemi e database si stampano sempre: un audit che ha guardato solo meta'
  // del database — o il database di un altro progetto — non deve poter passare
  // per un audit completo
  record(ID.auditRls, ETICHETTA_AUDIT, block === 0 ? "pass" : "fail",
    `schemi esposti: ${schemi.join(", ")} · ${dbUrl}\n${residuo}`
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
    record(ID.pgtap, etichetta, "skipped",
      "nessun file .sql in supabase/tests/: le policy sono un'ipotesi non verificata");
  } else if (!supabaseAvailable) {
    record(ID.pgtap, etichetta, "skipped", "Supabase CLI assente");
  } else {
    const res = run("supabase", ["test", "db"]);
    record(ID.pgtap, etichetta, res.status === 0 ? "pass" : "fail",
      res.status === 0 ? `${quanti} file di test eseguiti`
        : (res.stdout || res.stderr || "").trim().split("\n").slice(-25).join("\n"));
  }
}

// 8. tipi TypeScript allineati
function passoTipi(supabaseAvailable) {
  if (supabaseAvailable) {
    const res = run("supabase", ["gen", "types", "typescript", "--local"]);
    if (res.status !== 0) {
      record(ID.tipi, "tipi TypeScript", "fail", (res.stderr || "").trim().split("\n").slice(0, 10).join("\n"));
    } else if (!existsSync(TYPES_PATH)) {
      record(ID.tipi, "tipi TypeScript", "fail", `${TYPES_PATH} non esiste: Fly UI costruirebbe alla cieca`);
    } else {
      const current = readFileSync(TYPES_PATH, "utf8").trim();
      const fresh = res.stdout.trim();
      record(ID.tipi, "tipi TypeScript", current === fresh ? "pass" : "fail",
        current === fresh ? "" : "tipi disallineati dallo schema: rigenerali con `types`");
    }
  } else {
    record(ID.tipi, "tipi TypeScript", "skipped", "Supabase CLI assente");
  }
}

// 9. contratto d'uscita: cosa trova davvero chi viene dopo
function passoContratto() {
  const contratto = contrattoUscita(
    (rel) => existsSync(join(PROJECT, rel)),
    (rel) => readFileSync(join(PROJECT, rel), "utf8")
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

// eseguito come comando, non quando i test importano conRitentativo/dettaglioReset
if (import.meta.main) main();
