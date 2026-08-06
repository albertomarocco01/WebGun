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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  contrattoUscita,
  normalizzaTipi,
  premessaTsc,
  regolaEntitaAncorate,
  tabelleDaiTipi,
  validaConfig,
  verdettoDa,
} from "./progetto-lib.mjs";
import { conBarre } from "./audit-lib.mjs";
import { argomentiOstiliACmd, dentroLaRadice, formaEseguibile, mascheraUrl, motivoOstile, motivoScaduto, risolviEseguibile, scaduto } from "./eseguibili.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// Le regole con cui si MISURA viaggiano con la skill, non col progetto: il gate
// deve dare lo stesso esito ovunque giri, e soprattutto non deve chiedere il
// permesso al progetto che sta giudicando (DECISIONI.md §8, referto § H8).
const CONFIG_A11Y = join(SKILL_DIR, "resources", "config", "eslint-a11y.config.mjs");
const ESLINT_BIN = join(SKILL_DIR, "node_modules", "eslint", "bin", "eslint.js");

/**
 * I LIMITI DI TEMPO, in un posto solo e con il perche' accanto.
 *
 * Misurato il 2026-08-06 (referto § H10 / § M14): nessuna chiamata a processo di
 * questa skill aveva un limite, e contro un socket che accetta la connessione e
 * non parla un audit resta appeso finche' qualcuno non lo uccide — nella prova
 * fatta sulla skill sorella, 100 secondi e UNA riga stampata.
 * Un gate senza limite non e' lento: e' MUTO, e un gate muto non e' ne' verde ne'
 * rosso — e' assente, che e' il peggiore dei tre stati.
 */
const LIMITI = Object.freeze({
  probe: 15_000,
  // psql per il catalogo dei permessi, e la connessione prima di lui.
  strumento: 300_000,
  connessione: 10_000,
  // L'audit del gestionale e' un processo figlio con i suoi limiti dentro.
  audit: 300_000,
});

// La radice del progetto AUDITATO: e' li' che nessun eseguibile va cercato, e
// `--progetto` puo' spostarla. Vale `process.cwd()` finche' `main()` non legge
// gli argomenti — che e' anche il default di `--progetto`.
let RADICE_RICERCA = process.cwd();

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
// Le regole di risoluzione — e il perche' NON si cerca nella directory corrente,
// che qui e' la radice del progetto auditato — stanno in `eseguibili.mjs` con i
// loro test. Qui resta il ponte: si cerca una volta per nome, e i candidati
// RIFIUTATI perche' stavano dentro il progetto si conservano. Un passo che dice
// «strumento assente» senza dire «l'ho trovato, ma nel tuo progetto» manda a
// cercare la cosa sbagliata (referto § C1, 2026-08-06).
const rifiuti = new Map();

function dove(nome) {
  const { percorso, rifiutati } = risolviEseguibile(nome, RADICE_RICERCA);
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
 * La vista di una rotta esiste — e sta DENTRO la radice admin.
 *
 * `dentroProgetto` si chiama cosi' ma non contiene niente: e' `join`, e
 * `join(prog, "src/app/admin", "../../../../../Windows")` da' `C:\Windows`, che
 * esiste (referto § M8, misurato il 2026-08-06). La forma della rotta la
 * controlla gia' `erroreDiRotta`; questa riga e' la seconda porta, quella che
 * vale anche se la prima cambiasse: si risolve, e si guarda dove si e' finiti.
 */
function rottaEsistente(progetto, adminRoot, rotta) {
  const base = resolve(dentroProgetto(progetto, adminRoot));
  const pieno = resolve(base, String(rotta ?? ""));
  if (!dentroLaRadice(pieno, base)) return false;
  return existsSync(pieno);
}

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
  if (file === null) {
    return { error: new Error(`${cmd} non risolto nel PATH${rifiutoDi(cmd)}`), status: null, stdout: "", stderr: "" };
  }
  // Solo quando si passa davvero da `cmd /c`: un `.exe` riceve gli argomenti
  // come vettore, e nessuna shell li ri-analizza. Qui ci passa `adminRoot`, che
  // lo scrive il progetto auditato (referto § H2): `src/app/admin&calc` si crea
  // davvero su Windows, e attraverso `cmd /c` l'argomento si troncava con lo
  // status che restava 0 — cioe' ESLint girava su un'altra cartella e il passo
  // `a11y` diventava verde.
  if (prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(argomentiCmd);
    if (ostili.length > 0) {
      return { error: new Error(motivoOstile(ostili)), status: null, stdout: "", stderr: "" };
    }
  }
  // OGNI chiamata a processo ha un limite (referto § H10).
  return spawnSync(file, [...prefisso, ...argomentiCmd], {
    encoding: "utf8",
    cwd: progetto,
    maxBuffer: 64 * 1024 * 1024,
    timeout: LIMITI.strumento,
    killSignal: "SIGKILL",
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
    rottaEsistente(progetto, config.adminRoot, rotta),
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

  const res = spawnSync(process.execPath, argomentiAudit, {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    timeout: LIMITI.audit, killSignal: "SIGKILL",
  });

  if (scaduto(res)) {
    record(ID.audit, etichetta, "skipped", motivoScaduto("l'audit del gestionale", LIMITI.audit));
    return;
  }
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

  // Un file `"use server"` di cui l'audit non ha letto nessun nome esportato non
  // e' un file pulito: e' un file che nessuno ha guardato, e prima il dettaglio
  // lo contava come «azioni server: 1» (referto § H6). Terza premessa, stessa
  // forma delle due qui sopra.
  const nonLette = misure.azioniNonLette ?? [];
  if (nonLette.length > 0) {
    record(ID.audit, etichetta, "skipped",
      `azioni server non lette in ${nonLette.length} file: le regole sulle guardie NON sono state eseguite su di loro\n${nonLette.map((r) => `  - ${r}`).join("\n")}`);
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
    `rotte: ${misure.rotte} · azioni server: ${misure.azioni} riconosciute in ${misure.fileAzioni ?? "?"} file · scritture: ${misure.scritture} · ${mascheraUrl(doc.dbUrl)}\n${residuo}`,
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
    record(ID.tipi, etichetta, "skipped", `Supabase CLI assente: allineamento non verificato${rifiutoDi("supabase")}`);
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

  // LA PREMESSA PRIMA DELL'ESITO: `tsc` legge il tsconfig del progetto — ed e'
  // giusto, gli alias li conosce solo lui — ma con `strict: false` esce 0 su
  // codice che un controllo vero boccia. Stessa forma dell'ESLint a zero regole
  // del passo `a11y` (referto § H8).
  const { strict, motivo } = premessaTsc(readFileSync(tsconfig, "utf8"));
  if (!strict) {
    record(ID.tsc, etichetta, "skipped",
      `${motivo}\nI tipi NON sono stati controllati sul serio: verifica mancante, non un successo.`);
    return;
  }

  const res = esegui(progetto, "npx", ["--no-install", "tsc", "--noEmit"]);
  // si stampa SEMPRE con cosa si e' misurato, anche sul verde
  const premessa = `tsconfig.json del progetto · compilerOptions.strict: true`;
  record(ID.tsc, etichetta, res.status === 0 ? "pass" : "fail",
    res.status === 0 ? premessa
      : `${premessa}\n${(res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n")}`);
}

// ------------------------------------------------------- 6. accessibilita'
// Regola 5 della costituzione: mai sacrificata al minimalismo. Un gestionale
// che si usa otto ore al giorno con la tastiera e' il caso in cui questo si
// vede di piu'.
function passoA11y(progetto, config) {
  const etichetta = "accessibilita' (eslint jsx-a11y)";
  // ESLint e la sua configurazione viaggiano con la SKILL, non col progetto.
  // Fino al 2026-08-06 il passo lanciava `npx eslint` DENTRO il progetto, cioe'
  // con le regole che il progetto auditato si e' scritto: una configurazione a
  // zero regole attive fa uscire ESLint 0 su un `<img>` senz'`alt`, e il passo
  // chiudeva `pass` (referto § H8, misurato). Le due skill sorelle facevano gia'
  // il contrario — e' la forma di `flow-sentinel`, ripresa qui senza inventarne
  // una nuova.
  if (!existsSync(ESLINT_BIN)) {
    record(ID.a11y, etichetta, "skipped",
      `ESLint non installato nella skill (${ESLINT_BIN}): lancia \`npm install\` in agenti/gestionale-crafter. L'accessibilita' delle viste NON e' stata verificata`);
    return;
  }

  const bersagli = [config?.adminRoot, "src/components"].filter(
    (b) => b && existsSync(dentroProgetto(progetto, b)),
  );
  if (bersagli.length === 0) {
    record(ID.a11y, etichetta, "skipped", "nessuna cartella da controllare: ne' la radice admin ne' src/components esistono");
    return;
  }

  // `process.execPath`, non `npx`: l'interprete che sta girando (§ C1).
  const res = spawnSync(process.execPath,
    [ESLINT_BIN, "--no-config-lookup", "--config", CONFIG_A11Y, ...bersagli],
    { encoding: "utf8", cwd: progetto, maxBuffer: 64 * 1024 * 1024,
      timeout: LIMITI.strumento, killSignal: "SIGKILL" });
  if (scaduto(res)) {
    record(ID.a11y, etichetta, "skipped", motivoScaduto("ESLint jsx-a11y", LIMITI.strumento));
    return;
  }
  if (res.error) {
    record(ID.a11y, etichetta, "skipped", `ESLint non eseguibile: ${res.error.message}`);
    return;
  }
  // La configurazione si stampa SEMPRE, anche sul verde: un `pass` non deve
  // poter nascondere CON QUALI regole e' stato ottenuto.
  const premessa = `controllate: ${bersagli.map(conBarre).join(", ")} · regole: ${conBarre(CONFIG_A11Y)} (della skill, non del progetto)`;
  const coda = `\n${(res.stdout || res.stderr || "").trim().split("\n").slice(0, 20).join("\n")}`;
  if (res.status === 0) {
    record(ID.a11y, etichetta, "pass", premessa);
    return;
  }
  // 1 = ESLint ha misurato e ha trovato. 2 = ESLint NON ha misurato: config
  // illeggibile, oppure nessun file lintabile sotto i bersagli. Misurato il
  // 2026-08-06 su cartelle che esistono e contengono solo file che la
  // configurazione non copre: uscita 2, «all of the files matching the glob
  // pattern are ignored». Farlo valere `fail` e' un rosso strutturale, e un
  // rosso strutturale insegna a ignorare il rosso; farlo valere `pass` sarebbe
  // peggio. E' una verifica MANCANTE, come ogni strumento che non ha misurato.
  record(ID.a11y, etichetta, res.status === 1 ? "fail" : "skipped",
    res.status === 1
      ? premessa + coda
      : `${premessa}\nESLint non ha misurato niente (uscita ${res.status}): o la configurazione non e' leggibile, o sotto quelle cartelle non c'e' nessun file che la configurazione copre. L'accessibilita' delle viste NON e' stata verificata.${coda}`);
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
  // Prima di qualunque `has`/`esegui`: da qui in poi nessun eseguibile si cerca
  // dentro il progetto che si sta giudicando.
  RADICE_RICERCA = resolve(args.progetto);

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
