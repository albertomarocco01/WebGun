#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Gestionale Crafter.
 *
 * COSA FA: misura, sul progetto generato, che il gestionale sia protetto e
 * consegnabile. Ogni passo finisce in uno di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica
 *   mancante, e il gate resta rosso.
 *
 * REGOLA DELLA CASA: nessun `pass` si deduce da un codice d'uscita. Ogni passo
 * misura prima la propria premessa (il file c'e'? quante rotte ha guardato? il
 * catalogo l'ha letto?), perche' uno strumento che non ha letto niente esce 0.
 *
 * USO:  node verify.mjs [--progetto <dir>] [--db-url <url>] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: il progetto generato (gestionale.config.json, tipi, node_modules),
 *             supabase CLI per i tipi, psql per i permessi.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  contrattoUscita,
  normalizzaTipi,
  regolaEntitaAncorate,
  tabelleDaiTipi,
  validaConfig,
  verdettoDa,
} from "./progetto-lib.mjs";
import { conBarre } from "./audit-lib.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

// ------------------------------------------------- identificatori di passo
// L'etichetta e' per gli umani e resta libera di cambiare; l'`id` e' il
// contratto con l'orchestratore e NON cambia. Un test lo blocca.
export const ID = Object.freeze({
  config: "config",
  entita: "entities",
  audit: "admin-audit",
  tipi: "types-fresh",
  tsc: "tsc",
  a11y: "a11y",
  contratto: "handoff",
});

export const CONTRATTO_JSON = 1;

// --------------------------------------- eseguibili risolti a mano su Windows
// `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd`
// (npx, supabase da npm) risulta ENOENT sul nome e EINVAL sul percorso pieno —
// Node rifiuta di eseguire .cmd/.bat senza shell dalla mitigazione della
// CVE-2024-27980. Senza questa funzione il gate direbbe «strumento assente» su
// una macchina dove lo strumento c'e' e funziona.
// NON si usa `shell: true`: li' gli argomenti vengono concatenati invece che
// passati come vettore, e questo gate passa percorsi con spazi.
export function formaEseguibile(nome, cercaPercorso, piattaforma = process.platform) {
  if (piattaforma !== "win32") return { file: nome, prefisso: [] };
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: nome, prefisso: [] };
  return /\.(cmd|bat)$/i.test(trovato)
    ? { file: "cmd.exe", prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

/**
 * `where` elenca TUTTI i candidati, e il primo non e' quello giusto: per `npx`
 * risponde prima `C:\...\nodejs\npx` — lo script sh senza estensione, che
 * `spawnSync` senza shell non sa eseguire — e poi `npx.cmd`, che invece si
 * esegue via `cmd.exe /c`. Misurato il 2026-07-28: prendendo la prima riga, i
 * passi `tsc` e `a11y` fallivano con il DETTAGLIO VUOTO su una macchina dove
 * entrambi gli strumenti funzionano.
 * Si sceglie il primo candidato ESEGUIBILE (.exe, poi .cmd/.bat).
 */
export function scegliEseguibile(righe) {
  const candidati = (righe ?? []).map((r) => r.trim()).filter(Boolean);
  return (
    candidati.find((c) => /\.exe$/i.test(c)) ??
    candidati.find((c) => /\.(cmd|bat)$/i.test(c)) ??
    candidati[0] ??
    null
  );
}

function dove(nome) {
  const res = spawnSync("where", [nome], { encoding: "utf8" });
  if (res.error || res.status !== 0) return null;
  return scegliEseguibile((res.stdout ?? "").split(/\r?\n/));
}

function has(cmd) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  const probe = spawnSync(file, [...prefisso, "--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

// ---------------------------------------------------------------- stato
const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

function argomenti(argv) {
  const args = { progetto: process.cwd(), dbUrl: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--progetto") args.progetto = argv[++i];
    else if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

const dentroProgetto = (progetto, ...pezzi) => join(progetto, ...pezzi);

/**
 * Il dettaglio di un comando andato male. Se il processo non e' nemmeno
 * partito, stdout e stderr sono vuoti: senza questa riga il gate stampa un
 * `FAIL` muto, che e' peggio di un errore — non si sa da dove ricominciare.
 */
export function dettaglioEsecuzione(res, righe = 20) {
  if (res?.error) return `il comando non e' partito: ${res.error.message}`;
  const testo = (res?.stdout || res?.stderr || "").trim();
  return testo === "" ? "nessuna uscita dallo strumento" : testo.split("\n").slice(0, righe).join("\n");
}

function esegui(progetto, cmd, argomentiCmd) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  return spawnSync(file, [...prefisso, ...argomentiCmd], {
    encoding: "utf8",
    cwd: progetto,
  });
}

// ---------------------------------------------------- 1. dove sta il gestionale
// Il bersaglio dell'audit non e' un default dello script: e' scritto nel
// progetto. Un default silenzioso (`src/app/admin`) farebbe passare per audit
// completo un audit su una cartella che non esiste.
function passoConfig(progetto) {
  const etichetta = "configurazione del gestionale";
  const percorso = dentroProgetto(progetto, "gestionale.config.json");

  if (!existsSync(percorso)) {
    record(ID.config, etichetta, "skipped",
      "gestionale.config.json assente: il gate non sa dove sia il gestionale ne' quali entita' debba coprire (comando `scaffold`)");
    return null;
  }

  let config;
  try {
    config = JSON.parse(readFileSync(percorso, "utf8"));
  } catch (errore) {
    record(ID.config, etichetta, "fail", `gestionale.config.json illeggibile: ${errore.message}`);
    return null;
  }

  const { errori } = validaConfig(config);
  if (errori.length > 0) {
    record(ID.config, etichetta, "fail", errori.map((e) => `- ${e}`).join("\n"));
    return null;
  }

  record(ID.config, etichetta, "pass",
    `radice admin: ${conBarre(config.adminRoot)} · entita' dichiarate: ${(config.entita ?? []).length} · escluse: ${(config.escluse ?? []).length}`);
  return config;
}

// ------------------------------------- 2. nessuna tabella sparisce in silenzio
function passoEntita(progetto, config) {
  const etichetta = "entita' ancorate allo schema";
  if (!config) {
    record(ID.entita, etichetta, "skipped", "senza configurazione non c'e' elenco da confrontare");
    return;
  }

  const percorsoTipi = dentroProgetto(progetto, "src", "lib", "database.types.ts");
  if (!existsSync(percorsoTipi)) {
    record(ID.entita, etichetta, "skipped",
      "src/lib/database.types.ts assente: l'elenco delle tabelle verrebbe dall'agente stesso, e un gate che verifica cio' che l'agente ha deciso non verifica niente");
    return;
  }

  const tabelle = tabelleDaiTipi(readFileSync(percorsoTipi, "utf8"));
  if (tabelle.length === 0) {
    record(ID.entita, etichetta, "skipped",
      "nessuna tabella letta dai tipi generati: o lo schema e' vuoto, o il file non e' quello che `supabase gen types` produce");
    return;
  }

  const findings = regolaEntitaAncorate(tabelle, config, (rotta) =>
    existsSync(dentroProgetto(progetto, config.adminRoot, String(rotta ?? ""))),
  );

  const dettaglio = [`${tabelle.length} tabelle nei tipi: ${tabelle.join(", ")}`]
    .concat(findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}`))
    .join("\n");

  record(ID.entita, etichetta, findings.length === 0 ? "pass" : "fail", dettaglio);
}

// ------------------------------------------------- 3. l'audit di accesso e dati
function passoAudit(progetto, dbUrl) {
  const etichetta = "audit del gestionale (guardie, RLS, permessi)";
  const argomentiAudit = [
    join(SKILL_DIR, "scripts", "admin-audit.mjs"),
    "--json",
    "--progetto", progetto,
  ];
  if (dbUrl) argomentiAudit.push("--db-url", dbUrl);

  const res = spawnSync(process.execPath, argomentiAudit, { encoding: "utf8" });

  if (res.status === 2 || !res.stdout) {
    record(ID.audit, etichetta, "skipped", (res.stderr || "audit non eseguito").trim());
    return;
  }

  const { doc, errore } = leggiAudit(res.stdout);
  if (errore) {
    record(ID.audit, etichetta, "skipped", errore);
    return;
  }

  registraAudit(etichetta, doc);
}

/** L'uscita dell'audit non si da' in pasto a `JSON.parse` nuda: un audit morto
 *  a meta' stampa farebbe CRASHARE il gate, e un gate che crasha non e' ne'
 *  verde ne' rosso — e' assente, che e' il peggiore dei tre stati. */
export function leggiAudit(stdout) {
  let doc;
  try {
    doc = JSON.parse(stdout);
  } catch {
    return { errore: `uscita dell'audit non interpretabile come JSON: ${String(stdout).trim().slice(0, 200)}` };
  }
  if (!doc?.summary || !Array.isArray(doc.findings) || !doc.misure) {
    return { errore: "uscita dell'audit senza `summary`/`findings`/`misure`: contratto non rispettato, l'audit non e' utilizzabile" };
  }
  return { doc };
}

function registraAudit(etichetta, doc) {
  const { block, issue, warn } = doc.summary;
  const misure = doc.misure;

  // PREMESSA PRIMA DELL'ESITO. Un audit che non ha trovato nessuna rotta non ha
  // trovato nessun problema per il motivo sbagliato: `adminRoot` puo' puntare a
  // una cartella che non esiste, e il verdetto sarebbe «pulito».
  if (misure.rotte === 0) {
    record(ID.audit, etichetta, "skipped",
      `nessuna rotta admin trovata sotto la radice dichiarata (${misure.file} file letti): l'audit non ha guardato niente`);
    return;
  }

  if (!doc.catalogo?.letto) {
    record(ID.audit, etichetta, "skipped",
      `permessi non letti — ${doc.catalogo?.motivo ?? "motivo non riportato"}. Le regole sulle colonne scrivibili non sono state eseguite`);
    return;
  }

  const residuo =
    doc.findings
      .filter((f) => f.severity !== "warn")
      .map((f) => `[${f.severity}] ${f.object}: ${f.message}`)
      .join("\n") || `nessun bloccante (${issue} issue, ${warn} warn)`;

  record(ID.audit, etichetta, block === 0 ? "pass" : "fail",
    `rotte: ${misure.rotte} · azioni server: ${misure.azioni} · scritture: ${misure.scritture} · ${doc.dbUrl}\n${residuo}`,
  ).counts = { block, issue, warn };
}

// ------------------------------------------------ 4. i tipi sono quelli veri
// Sovrapposizione DICHIARATA con il passo `tipi` di Schema Forge: la stessa
// verifica sta in due gate perche' risponde a due domande diverse. Li' e'
// «ho consegnato i tipi giusti», qui e' «sto costruendo su tipi veri», e chi
// lancia questo gate spesso non rilancia quello.
function passoTipi(progetto, supabaseCliPresente) {
  const etichetta = "tipi allineati allo schema";
  const percorso = dentroProgetto(progetto, "src", "lib", "database.types.ts");

  if (!existsSync(percorso)) {
    record(ID.tipi, etichetta, "fail",
      "src/lib/database.types.ts assente: il gestionale costruirebbe alla cieca");
    return;
  }
  if (!supabaseCliPresente) {
    record(ID.tipi, etichetta, "skipped", "Supabase CLI assente: allineamento non verificato");
    return;
  }

  const res = esegui(progetto, "supabase", ["gen", "types", "typescript", "--local"]);
  if (res.status !== 0) {
    record(ID.tipi, etichetta, "skipped",
      `\`supabase gen types\` non ha risposto: ${(res.stderr || "").trim().split("\n").slice(0, 5).join(" ")}`);
    return;
  }

  const attuali = normalizzaTipi(readFileSync(percorso, "utf8"));
  const freschi = normalizzaTipi(res.stdout);
  record(ID.tipi, etichetta, attuali === freschi ? "pass" : "fail",
    attuali === freschi
      ? ""
      : "tipi disallineati dallo schema. NON si corregge a mano il codice: si rigenerano (`supabase gen types`), e se il disallineamento e' vero e' un segnale a monte, per schema-forge");
}

// ------------------------------------------------------------- 5. i tipi tengono
function passoTsc(progetto) {
  const etichetta = "tipi del progetto (tsc)";
  const tsconfig = dentroProgetto(progetto, "tsconfig.json");
  const compilatore = dentroProgetto(progetto, "node_modules", "typescript", "package.json");

  if (!existsSync(tsconfig) || !existsSync(compilatore)) {
    record(ID.tsc, etichetta, "skipped",
      "tsconfig.json o typescript assenti nel progetto: i tipi non sono stati controllati (`npm install`)");
    return;
  }

  const res = esegui(progetto, "npx", ["--no-install", "tsc", "--noEmit"]);
  record(ID.tsc, etichetta, res.status === 0 ? "pass" : "fail",
    res.status === 0 ? "" : (res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n"));
}

// ------------------------------------------------------- 6. accessibilita'
// Regola 5 della costituzione: mai sacrificata al minimalismo. Un gestionale
// che si usa otto ore al giorno con la tastiera e' il caso in cui questo si
// vede di piu'.
function passoA11y(progetto, config) {
  const etichetta = "accessibilita' (eslint jsx-a11y)";
  const configEslint = ["eslint.config.mjs", "eslint.config.js", "eslint.config.ts"]
    .map((f) => dentroProgetto(progetto, f))
    .find((f) => existsSync(f));
  const plugin = dentroProgetto(progetto, "node_modules", "eslint-plugin-jsx-a11y", "package.json");

  if (!configEslint || !existsSync(plugin)) {
    record(ID.a11y, etichetta, "skipped",
      "eslint o eslint-plugin-jsx-a11y assenti nel progetto: l'accessibilita' delle viste NON e' stata verificata");
    return;
  }

  const bersagli = [config?.adminRoot, "src/components"].filter(
    (b) => b && existsSync(dentroProgetto(progetto, b)),
  );
  if (bersagli.length === 0) {
    record(ID.a11y, etichetta, "skipped", "nessuna cartella da controllare: ne' la radice admin ne' src/components esistono");
    return;
  }

  const res = esegui(progetto, "npx", ["--no-install", "eslint", ...bersagli]);
  record(ID.a11y, etichetta, res.status === 0 ? "pass" : "fail",
    `controllate: ${bersagli.map(conBarre).join(", ")}` +
      (res.status === 0 ? "" : `\n${(res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n")}`));
}

// --------------------------------------------------------- 7. contratto d'uscita
// Ultimo apposta: il verdetto che l'handoff deve dichiarare e' quello dei passi
// che l'hanno preceduto, ed e' gia' tutto in `steps`.
function passoContratto(progetto) {
  const esito = contrattoUscita(
    (rel) => existsSync(dentroProgetto(progetto, rel)),
    (rel) => readFileSync(dentroProgetto(progetto, rel), "utf8"),
    verdettoDa(steps),
  );
  record(ID.contratto, "contratto d'uscita (handoff)", esito.status, esito.detail);
}

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

function verdetto(json) {
  const falliti = steps.filter((s) => s.status === "fail");
  const mancanti = steps.filter((s) => s.status === "skipped");
  const verde = falliti.length === 0 && mancanti.length === 0;

  if (json) {
    console.log(JSON.stringify(
      { contract: CONTRATTO_JSON, ok: verde, summary: riepilogo(steps), steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE GESTIONALE: ${verde ? "VERDE" : "ROSSO"} ` +
    `(${falliti.length} falliti, ${mancanti.length} verifiche mancanti su ${steps.length} passi)\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status];
    console.log(`${marchio}  ${s.name}`);
    // il dettaglio si stampa anche sui passi verdi: e' li' che si legge COSA e'
    // stato guardato, e un audit parziale non deve somigliare a uno completo
    if (s.detail) {
      for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
    }
  }
  if (mancanti.length > 0) {
    console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  }
  return verde ? 0 : 1;
}

// L'ordine di queste chiamate E' il gate. Niente altro qui dentro.
function main() {
  const args = argomenti(process.argv.slice(2));

  if (!existsSync(dentroProgetto(args.progetto, "src"))) {
    console.error(`Nessuna cartella src/ in ${args.progetto}: non c'e' gestionale da verificare.`);
    process.exit(2);
  }

  const supabaseCliPresente = has("supabase");
  const config = passoConfig(args.progetto);

  passoEntita(args.progetto, config);
  passoAudit(args.progetto, args.dbUrl);
  passoTipi(args.progetto, supabaseCliPresente);
  passoTsc(args.progetto);
  passoA11y(args.progetto, config);
  passoContratto(args.progetto);

  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano i passi.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde. Questo gate lo ha
// fatto per davvero: misurato il 2026-08-03 su questa macchina (Node 20.12.2,
// l'unico Node di sistema) in una cartella non-progetto — uscita 0, zero righe,
// dove Node 24.18.1 stampava il messaggio e usciva 2. I prerequisiti della
// skill dicono «Node >= 20»: il confronto qui sotto li rispetta ovunque.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
