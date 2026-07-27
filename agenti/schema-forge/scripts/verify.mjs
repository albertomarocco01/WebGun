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
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const steps = [];
const record = (name, status, detail = "") => steps.push({ name, status, detail });

function has(cmd) {
  const probe = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, { encoding: "utf8", cwd: PROJECT, ...opts });
}

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
// Due chiavi in tutto: niente parser TOML fra le dipendenze di uno script che
// deve girare ovunque con `node` e basta.
function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${chiave}\\s*=\\s*(.+)$`);
  for (const riga of (testoConfig ?? "").split(/\r?\n/)) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(riga);
    if (intestazione) {
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    if (!dentro) continue;
    const trovata = cerca.exec(riga);
    if (trovata) return trovata[1];
  }
  return null;
}

// ------------------------------------------- schemi realmente esposti al client
// L'audit RLS deve girare su cio' che PostgREST pubblica DAVVERO, non solo su
// `public`: una tabella nuda in uno schema secondario esposto e' lo stesso data
// leak. La verita' non e' un default dello script, e' `[api].schemas` del
// config.toml del progetto — l'unica riga che decide cosa esce dalla chiave
// anonima. Senza config leggibile si torna a `public` (e non a "niente").
export function schemiEsposti(testoConfig) {
  const valore = valoreToml(testoConfig, "api", "schemas");
  const lista = valore && /\[([^\]]*)\]/.exec(valore);
  if (!lista) return ["public"];
  const schemi = lista[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return schemi.length > 0 ? schemi : ["public"];
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
  const migrations = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  if (migrations.length === 0) {
    console.error("Nessuna migrazione trovata: non c'e' schema da verificare.");
    process.exit(2);
  }
  return migrations;
}

// 1. formato SQL — sqlfluff (opzionale)
function passoSqlfluff() {
  if (has("sqlfluff")) {
    const res = run("sqlfluff",
      ["lint", "--dialect", "postgres", "--config", join(CONFIG_DIR, ".sqlfluff"), MIGRATIONS_DIR]);
    record("sqlfluff (formato SQL)", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n"));
  } else {
    record("sqlfluff (formato SQL)", "skipped", "sqlfluff non installato: pipx install sqlfluff");
  }
}

// 2. sicurezza delle migrazioni — squawk (opzionale)
function passoSquawk(migrations) {
  if (has("squawk")) {
    const res = run("squawk", [
      "-c", join(CONFIG_DIR, "squawk.toml"),
      ...migrations.map((f) => join(MIGRATIONS_DIR, f)),
    ]);
    record("squawk (operazioni pericolose)", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 30).join("\n"));
  } else {
    record("squawk (operazioni pericolose)", "skipped", "squawk non installato: pipx install squawk-cli");
  }
}

// 3. IL GATE VERO: applicazione su database pulito
function passoReset(supabaseAvailable, skipReset, quanteMigrazioni) {
  if (!supabaseAvailable) {
    record("supabase db reset (applicazione reale)", "skipped",
      "Supabase CLI assente: lo schema NON e' stato applicato. Il gate non puo' essere verde.");
  } else if (skipReset) {
    record("supabase db reset (applicazione reale)", "skipped", "saltato esplicitamente con --skip-reset");
  } else {
    const { res, ritentato } = conRitentativo(() => run("supabase", ["db", "reset"]));
    record("supabase db reset (applicazione reale)", res.status === 0 ? "pass" : "fail",
      dettaglioReset(res, ritentato, quanteMigrazioni));
  }
}

// 4. lint del database
function passoDbLint(supabaseAvailable) {
  if (supabaseAvailable) {
    const res = run("supabase", ["db", "lint", "--level", "warning"]);
    record("supabase db lint", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n"));
  } else {
    record("supabase db lint", "skipped", "Supabase CLI assente");
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
    record("supabase db advisors", "skipped", "Supabase CLI assente");
  } else if (run("supabase", ["db", "advisors", "--help"]).status !== 0) {
    // sottocomando sconosciuto: verifica MANCANTE, mai `fail`. Un gate rosso
    // perche' la CLI e' vecchia non parla dello schema (come sqlfluff/squawk).
    record("supabase db advisors", "skipped",
      "sottocomando assente: `db advisors` richiede la CLI Supabase v2.81.3+ (`supabase --version`)");
  } else {
    const res = run("supabase",
      ["db", "advisors", "--local", "--level", "warn", "--fail-on", "error"]);
    record("supabase db advisors", res.status === 0 ? "pass" : "fail",
      dettaglioAdvisors(res.stdout || res.stderr || ""));
  }
}

// 6. audit RLS (il controllo che non puo' mancare) — su TUTTI gli schemi esposti
function passoAuditRls(dbUrlEsplicito) {
  const testoConfig = existsSync(SUPABASE_CONFIG) ? readFileSync(SUPABASE_CONFIG, "utf8") : null;
  const schemi = schemiEsposti(testoConfig);
  const auditArgs = [join(SKILL_DIR, "scripts", "rls-audit.mjs"), "--json", "--schemas", schemi.join(",")];
  // precedenza: --db-url esplicito > config.toml del progetto. Mai l'ambiente:
  // una SUPABASE_DB_URL rimasta da un altro progetto e' esattamente il modo in
  // cui il gate finisce per auditare il database sbagliato e dire OK.
  const dbUrl = dbUrlEsplicito ?? urlDbProgetto(testoConfig);
  if (dbUrl) auditArgs.push("--db-url", dbUrl);
  const audit = run("node", auditArgs);
  if (audit.status === 2 || !audit.stdout) {
    record("audit RLS", "skipped", (audit.stderr || "audit non eseguito").trim());
  } else {
    const parsed = JSON.parse(audit.stdout);
    const { block, issue, warn } = parsed.summary;
    const residuo = parsed.findings
      .filter((f) => f.severity !== "warn")
      .map((f) => `[${f.severity}] ${f.object}: ${f.message}`)
      .join("\n") || `nessun bloccante (${issue} issue, ${warn} warn)`;
    // schemi e database si stampano sempre: un audit che ha guardato solo meta'
    // del database — o il database di un altro progetto — non deve poter passare
    // per un audit completo
    record("audit RLS", block === 0 ? "pass" : "fail",
      `schemi esposti: ${schemi.join(", ")}${dbUrl ? ` · ${dbUrl}` : ""}\n${residuo}`);
  }
}

// 7. test delle policy — pgTAP
function passoPgtap(supabaseAvailable) {
  if (supabaseAvailable && existsSync(join(PROJECT, "supabase", "tests"))) {
    const res = run("supabase", ["test", "db"]);
    record("pgTAP (test delle policy)", res.status === 0 ? "pass" : "fail",
      res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(-25).join("\n"));
  } else {
    record("pgTAP (test delle policy)", "skipped",
      "nessun test in supabase/tests/: le policy sono un'ipotesi non verificata");
  }
}

// 8. tipi TypeScript allineati
function passoTipi(supabaseAvailable) {
  if (supabaseAvailable) {
    const res = run("supabase", ["gen", "types", "typescript", "--local"]);
    if (res.status !== 0) {
      record("tipi TypeScript", "fail", (res.stderr || "").trim().split("\n").slice(0, 10).join("\n"));
    } else if (!existsSync(TYPES_PATH)) {
      record("tipi TypeScript", "fail", `${TYPES_PATH} non esiste: Fly UI costruirebbe alla cieca`);
    } else {
      const current = readFileSync(TYPES_PATH, "utf8").trim();
      const fresh = res.stdout.trim();
      record("tipi TypeScript", current === fresh ? "pass" : "fail",
        current === fresh ? "" : "tipi disallineati dallo schema: rigenerali con `types`");
    }
  } else {
    record("tipi TypeScript", "skipped", "Supabase CLI assente");
  }
}

// 9. contratto d'uscita: cosa trova davvero chi viene dopo
function passoContratto() {
  const contratto = contrattoUscita(
    (rel) => existsSync(join(PROJECT, rel)),
    (rel) => readFileSync(join(PROJECT, rel), "utf8")
  );
  record("contratto d'uscita (configurazioni + handoff)", contratto.status, contratto.detail);
}

// ------------------------------------------------------------------- verdetto
// Ritorna il codice d'uscita invece di chiamare `process.exit`: cosi' il verdetto
// e' la stessa cosa stampata e la stessa cosa restituita, senza due strade.
function verdetto(json) {
  const failed = steps.filter((s) => s.status === "fail");
  const skipped = steps.filter((s) => s.status === "skipped");
  const green = failed.length === 0 && skipped.length === 0;

  if (json) {
    console.log(JSON.stringify({ ok: green, steps }, null, 2));
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

  passoSqlfluff();
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
