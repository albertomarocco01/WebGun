#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Flow Sentinel (Legge n°2: il browser e' il giudice).
 *
 * COSA FA: misura le premesse (contratto dei flussi, spec contate, app viva,
 * database del progetto raggiungibile e seedato) PRIMA di leggere l'esito
 * della batteria Playwright. Ogni passo finisce in uno di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica
 *   mancante, e il gate resta rosso.
 *
 * USO:  node verify.mjs [--url <url>] [--db-url <url>] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: la batteria del progetto (@playwright/test), psql, ESLint (nella
 *             cartella della skill). Ognuna assente vale MANCANTE, mai PASS.
 *
 * Le regole vivono in `gate-lib.mjs` e hanno i loro test: qui dentro c'e' solo
 * il guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  argomentiOstiliACmd,
  batteriaHaEseguito,
  comandoRicerca,
  motivoScaduto,
  scaduto,
  motivoOstile,
  contaGravita,
  contrattoUscita,
  dentroLaRadice,
  dettaglioFindings,
  dettaglioPlaywright,
  eSpec,
  esitoBatteriaVerde,
  esitoPlaywright,
  estraiOggettoJson,
  findingsCopertura,
  findingsEffettoDb,
  flussiPercorsi,
  ambientePsql,
  credenzialiPsql,
  formaEseguibile,
  mascheraUrl,
  rigaFlussiPercorsi,
  leggiFlussi,
  primoEseguibile,
  regoleSpec,
  righeDaPsql,
  schemiEsposti,
  sqlConteggioRighe,
  sqlTabelleEsposte,
  statoDaFindings,
  tagDaSpec,
  urlAppProgetto,
  ambienteBatteria,
  urlDbProgetto,
  verdettoDa,
} from "./gate-lib.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
// La configurazione di ESLint viaggia con la SKILL, non col progetto: il gate
// deve dare lo stesso esito ovunque giri, anche su un progetto che non l'ha
// (ancora) ricevuta da `forge`. Precedente: DECISIONI.md §8.
const CONFIG_SPEC = join(SKILL_DIR, "resources", "config", "eslint-spec.config.mjs");
const ESLINT_BIN = join(SKILL_DIR, "node_modules", "eslint", "bin", "eslint.js");
const PROGETTO = process.cwd();
const DIR_SPEC = join(PROGETTO, "e2e");
// percorsi relativi con le barre in avanti: `join` le normalizza su Windows e
// il messaggio all'utente resta lo stesso su ogni piattaforma
const FLUSSI_CRITICI = "docs/flussi-critici.md";
const HANDOFF = "docs/handoff/12-flow-sentinel.md";
const CONFIG_PLAYWRIGHT = "playwright.config.ts";

/**
 * I LIMITI DI TEMPO, in un posto solo e con il perche' accanto.
 *
 * Questo gate era l'unico della casa ad averne uno — l'`AbortSignal.timeout`
 * sulla sonda dell'app — ed e' quello che il 2026-08-06 lo ha fatto tornare in
 * 18,2 s con un ROSSO leggibile dove speed-demon restava appeso (referto § H10).
 * Le altre due chiamate a processo, psql e Playwright, non ne avevano.
 */
const LIMITI = Object.freeze({
  // La sonda dell'app: quella che gia' c'era, e che ha fatto la differenza.
  app: 15_000,
  probe: 15_000,
  // psql: una query di premessa non dura minuti, e un database che non risponde
  // non e' lento — e' assente (referto § M14).
  strumento: 60_000,
  connessione: 10_000,
  // La batteria vera puo' durare: largo apposta, e serve solo a impedire
  // l'attesa infinita. Il template della skill non dichiarava nessun limite
  // (§ L10), quindi il gate non poteva fare affidamento su quello di Playwright.
  playwright: 1_800_000,
});

// ------------------------------------------------- identificatori di passo
// L'etichetta e' per gli umani e resta libera di cambiare; l'`id` e' il
// contratto con l'orchestratore e NON cambia (DECISIONI.md §15).
export const ID = Object.freeze({
  flussi: "flussi-critici",
  copertura: "spec-coverage",
  lint: "lint-spec",
  effettoDb: "effetto-db",
  appViva: "app-viva",
  playwright: "playwright",
  contratto: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;

const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  return existsSync(pieno) ? readFileSync(pieno, "utf8") : null;
};

// --------------------------------------- eseguibili risolti a mano su Windows
// Le regole — comando di ricerca col percorso pieno, prefisso `$PATH:`, rifiuto
// dei candidati dentro il progetto auditato, nome nudo mai lanciato — stanno in
// `gate-lib.mjs` con i loro test (§ C1 del referto 2026-08-06). Qui resta il
// ponte, e la memoria di cio' che e' stato RIFIUTATO: un passo che dice
// «strumento assente» senza dire «l'ho trovato, ma nel tuo progetto» manda a
// cercare la cosa sbagliata.
const rifiuti = new Map();

function dove(nome) {
  const { file, args } = comandoRicerca(nome);
  const res = spawnSync(file, args, { encoding: "utf8", timeout: 10_000, windowsHide: true });
  if (res.error || res.status !== 0) return null;
  const candidati = String(res.stdout ?? "").split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const rifiutati = candidati.filter((c) => dentroLaRadice(c, PROGETTO));
  if (rifiutati.length > 0) rifiuti.set(nome, rifiutati);
  return primoEseguibile(candidati.filter((c) => !dentroLaRadice(c, PROGETTO)).join("\n"));
}

export function notaRifiuto(rifiutati) {
  if (!rifiutati || rifiutati.length === 0) return "";
  return ` — RIFIUTATO perche' dentro il progetto auditato: ${rifiutati.join(", ")}. ` +
    "Un progetto non sceglie il binario che lo giudica: tienilo fuori dal progetto, o toglilo dal PATH.";
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

function run(cmd, cmdArgs, opts = {}) {
  const { file, prefisso } = formaEseguibile(cmd, dove);
  if (file === null) {
    return { error: new Error(`${cmd} non risolto nel PATH${rifiutoDi(cmd)}`), status: null, stdout: "", stderr: "" };
  }
  // Solo quando si passa davvero da `cmd /c`: un `.exe` — e `psql` lo e' —
  // riceve gli argomenti come vettore, e nessuna shell li ri-analizza. Qui
  // passano l'SQL intero e l'URL del database: attraverso una shell sarebbero
  // gia' due argomenti diversi da quelli scritti (referto § H1/H2/L1).
  if (prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(cmdArgs);
    if (ostili.length > 0) {
      return { error: new Error(motivoOstile(ostili)), status: null, stdout: "", stderr: "" };
    }
  }
  // OGNI chiamata a processo ha un limite (referto § H10/§ M14): il default
  // vale per psql, e i passi che durano di piu' lo alzano dichiarandolo.
  return spawnSync(file, [...prefisso, ...cmdArgs], {
    encoding: "utf8", cwd: PROGETTO, maxBuffer: 64 * 1024 * 1024,
    timeout: LIMITI.strumento, killSignal: "SIGKILL",
    env: { ...process.env, PGCONNECT_TIMEOUT: String(Math.round(LIMITI.connessione / 1000)) },
    ...opts,
  });
}

// -------------------------------------------------------------- il contesto
// Si legge una volta sola, prima dei passi: i file delle spec servono a tre
// passi diversi e rileggerli tre volte darebbe tre verita' diverse se qualcuno
// scrivesse nel frattempo.
function raccogliContesto() {
  const spec = elencaSpec().map((file) => {
    const testo = readFileSync(join(DIR_SPEC, file), "utf8");
    return { file: `e2e/${file.replace(/\\/g, "/")}`, testo, tags: tagDaSpec(testo) };
  });
  return {
    config: leggiSeCe("supabase/config.toml"),
    spec,
    flussi: null,      // lo riempie il passo 1
    perFlusso: null,   // lo riempie il passo 2
    appViva: false,    // lo alza il passo 5
    urlApp: null,
    dbUrl: null,
    schemi: [],
  };
}

function elencaSpec() {
  if (!existsSync(DIR_SPEC)) return [];
  return readdirSync(DIR_SPEC, { recursive: true }).filter((f) => eSpec(String(f)));
}

// ------------------------------------------------------------- i sette passi

// 1. il contratto: `docs/flussi-critici.md` esiste, e' confermato, e ogni
// flusso ha id stabile e tipo. Una batteria perfetta sui flussi sbagliati e'
// comunque da buttare, e un elenco che nessuno ha confermato non e' un elenco:
// e' l'opinione dell'agente su cosa fosse critico.
function passoFlussi(ctx) {
  const etichetta = "contratto dei flussi critici";
  const testo = leggiSeCe(FLUSSI_CRITICI);
  if (testo === null) {
    record(ID.flussi, etichetta, "skipped",
      `${FLUSSI_CRITICI} assente: non c'e' contratto da coprire (comando \`map\`, con lo Specchio dei flussi)`);
    return;
  }
  const { confermatoDa, flussi, errori } = leggiFlussi(testo);
  if (confermatoDa === null) {
    record(ID.flussi, etichetta, "skipped",
      `${FLUSSI_CRITICI} senza riga \`Confermato da:\`: un elenco non confermato non e' un contratto — chi ha deciso che questi sono i flussi critici?`);
    return;
  }
  if (flussi.length === 0) {
    record(ID.flussi, etichetta, "skipped",
      `${FLUSSI_CRITICI} non dichiara nessun flusso: formato atteso \`## \\\`<id>\\\` — <tipo>\` (vedi resources/templates/flussi-critici.md)`);
    return;
  }
  ctx.flussi = flussi;
  const perTipo = flussi.reduce((acc, f) => ({ ...acc, [f.tipo]: (acc[f.tipo] ?? 0) + 1 }), {});
  const riassunto = Object.entries(perTipo).map(([t, n]) => `${n} ${t}`).join(" · ");
  record(ID.flussi, etichetta, errori.length === 0 ? "pass" : "fail",
    [`${flussi.length} flussi (${riassunto}) — confermati da: ${confermatoDa}`, ...errori].join("\n"));
}

// 2. copertura: ogni flusso dichiarato ha almeno una spec che lo attacca.
function passoCopertura(ctx) {
  const etichetta = "copertura dei flussi (una spec per flusso)";
  if (ctx.flussi === null) {
    record(ID.copertura, etichetta, "skipped", "contratto dei flussi non leggibile: non c'e' niente di cui misurare la copertura");
    return;
  }
  // la premessa si conta PRIMA: zero spec non e' «tutto coperto», e' «non e'
  // stato guardato niente». Playwright su zero test esce 0.
  if (ctx.spec.length === 0) {
    record(ID.copertura, etichetta, "skipped", "nessun file di spec in e2e/: la copertura sarebbe 0 su 0, cioe' nessuna misura");
    return;
  }
  const { findings, perFlusso } = findingsCopertura(ctx.flussi, ctx.spec);
  ctx.perFlusso = perFlusso;
  record(ID.copertura, etichetta, statoDaFindings(findings),
    [`${ctx.flussi.length} flussi · ${ctx.spec.length} file di spec`,
      dettaglioFindings(findings) || "ogni flusso dichiarato ha almeno una spec che lo attacca"].join("\n")
  ).counts = contaGravita(findings);
}

// 3. lint delle spec: `.only` committato (`block`) e skip non motivati
// (`issue`), piu' ESLint con la configurazione della skill.
function passoLint(ctx) {
  const etichetta = "lint delle spec";
  if (ctx.spec.length === 0) {
    record(ID.lint, etichetta, "skipped", "nessun file di spec in e2e/: non c'e' niente da lintare");
    return;
  }
  const findings = ctx.spec.flatMap((s) => regoleSpec(s.file, s.testo));
  const eslint = esitoEslint();
  const dettaglio = [dettaglioFindings(findings), eslint.dettaglio].filter(Boolean).join("\n");
  // un `block` trovato pesa piu' di uno strumento assente: si e' guardato, e si
  // e' trovato. Se invece non c'e' niente di bloccante ma ESLint manca, allora
  // meta' del passo NON e' stata eseguita — MANCANTE, mai `pass`.
  const stato = statoDaFindings(findings) === "fail" || eslint.stato === "fail"
    ? "fail"
    : (eslint.stato === "skipped" ? "skipped" : "pass");
  record(ID.lint, etichetta, stato, dettaglio || "nessun `.only`, nessuno skip non motivato, ESLint pulito")
    .counts = contaGravita(findings);
}

function esitoEslint() {
  if (!existsSync(ESLINT_BIN)) {
    return { stato: "skipped", dettaglio: `ESLint non installato nella skill (${ESLINT_BIN}): lancia \`npm install\` in agenti/flow-sentinel. Le spec NON sono state lintate` };
  }
  // `process.execPath`, non `run("node", …)`: l'interprete che sta girando, non
  // quello che un `node.cmd` piantato nella radice del progetto auditato
  // vorrebbe far eseguire — deciderebbe da solo l'esito del lint (§ C1).
  const res = spawnSync(process.execPath, [ESLINT_BIN, "--no-config-lookup", "--config", CONFIG_SPEC, "e2e"], {
    encoding: "utf8", cwd: PROGETTO, maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status === 0) return { stato: "pass", dettaglio: "" };
  return {
    stato: "fail",
    dettaglio: (res.stdout || res.stderr || "").trim().split("\n").slice(0, 25).join("\n"),
  };
}

// 4. effetto sul database: la terza legge in forma verificabile.
function passoEffettoDb(ctx) {
  const etichetta = "asserzione di effetto sul database";
  if (ctx.perFlusso === null) {
    record(ID.effettoDb, etichetta, "skipped", "copertura non misurata: non si sa quale spec attacchi quale flusso");
    return;
  }
  const findings = findingsEffettoDb(ctx.flussi, ctx.spec, ctx.perFlusso);
  const conEffetto = ctx.flussi.filter((f) => f.tipo !== "ostile-lettura").length;
  record(ID.effettoDb, etichetta, statoDaFindings(findings),
    [`${conEffetto} flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)`,
      dettaglioFindings(findings) || "tutti importano e chiamano `e2e/helpers/db`"].join("\n")
  ).counts = contaGravita(findings);
}

// 5. LA PREMESSA: app viva e database del progetto raggiungibile e seedato.
// Senza, l'esito della batteria non e' un esito — e' il rumore di un'app che
// non c'era. Si misura prima di lanciare Playwright, non dopo.
async function passoAppViva(ctx, args) {
  const etichetta = "app viva e database del progetto";
  const errore = risolviAmbiente(ctx, args);
  if (errore) {
    record(ID.appViva, etichetta, "skipped", errore);
    return;
  }
  const app = await interrogaApp(ctx.urlApp);
  if (app.errore) {
    record(ID.appViva, etichetta, "skipped", app.errore);
    return;
  }
  const db = misuraDatabase(ctx);
  if (db.errore) {
    record(ID.appViva, etichetta, "skipped", `app: ${ctx.urlApp} (HTTP ${app.stato})\n${db.errore}`);
    return;
  }
  ctx.appViva = true;
  // URL, database e schemi si stampano SEMPRE, anche sul verde: un gate che
  // ha guardato un'altra app o un altro database non deve poter assomigliare a
  // un gate che ha guardato la tua (DECISIONI.md §11).
  record(ID.appViva, etichetta, "pass",
    `app: ${ctx.urlApp} (HTTP ${app.stato}) · database: ${mascheraUrl(ctx.dbUrl)}\n` +
    `schemi esposti: ${ctx.schemi.join(", ")} · ${db.tabelle} tabelle, ${db.righe} righe di seed`);
}

// Precedenza: flag esplicito > `supabase/config.toml` del progetto > MAI
// l'ambiente. Una variabile rimasta da un altro progetto e' esattamente il modo
// in cui un gate finisce per verificare l'app di qualcun altro e dire verde.
function risolviAmbiente(ctx, args) {
  if (ctx.config === null && !(args.url && args.dbUrl)) {
    return "supabase/config.toml assente: l'URL dell'app e il database non sono risolvibili dal progetto. Passa --url e --db-url espliciti, oppure lancia il gate dalla radice del progetto";
  }
  ctx.urlApp = args.url ?? urlAppProgetto(ctx.config);
  ctx.dbUrl = args.dbUrl ?? urlDbProgetto(ctx.config);
  ctx.schemi = schemiEsposti(ctx.config);
  if (!ctx.urlApp) {
    return "URL dell'app non dichiarato: manca `[auth].site_url` in supabase/config.toml e non e' stato passato --url. Il gate non indovina un `localhost:3000`: e' cosi' che si testa l'app di un altro progetto";
  }
  if (!ctx.dbUrl) {
    return "database del progetto non risolvibile: manca `[db].port` in supabase/config.toml e non e' stato passato --db-url. La porta 54322 di default, con piu' stack Supabase accesi, e' il database di qualcun altro";
  }
  return null;
}

async function interrogaApp(url) {
  try {
    const risposta = await fetch(url, { signal: AbortSignal.timeout(LIMITI.app), redirect: "manual" });
    if (risposta.status >= 500) {
      return { errore: `l'app risponde ${risposta.status} su ${url}: e' accesa ma rotta, la batteria misurerebbe l'errore invece del flusso` };
    }
    return { stato: risposta.status };
  } catch (errore) {
    return { errore: `l'app non risponde su ${url} (${errore.message}): senza app viva non esiste esito, e un verde qui sarebbe un verde su niente` };
  }
}

// Il seed non e' un dettaglio: una batteria su un database vuoto fallisce per
// mancanza di dati, e i suoi rossi somigliano a difetti dell'app.
function misuraDatabase(ctx) {
  if (!has("psql")) {
    return { errore: `psql non disponibile nel PATH: il database del progetto NON e' stato interrogato (su Windows sta in %USERPROFILE%\\scoop\\apps\\postgresql\\current\\bin)${rifiutoDi("psql")}` };
  }
  const tabelle = interrogaDb(ctx.dbUrl, sqlTabelleEsposte(ctx.schemi));
  if (tabelle.errore) return { errore: `database non raggiungibile su ${mascheraUrl(ctx.dbUrl)}: ${tabelle.errore}` };
  if (tabelle.righe.length === 0) {
    return { errore: `nessuna tabella negli schemi esposti (${ctx.schemi.join(", ")}) su ${mascheraUrl(ctx.dbUrl)}: le migrazioni non sono applicate, la batteria girerebbe sul vuoto` };
  }
  const conteggio = interrogaDb(ctx.dbUrl, sqlConteggioRighe(tabelle.righe));
  if (conteggio.errore) return { errore: `conteggio delle righe fallito su ${mascheraUrl(ctx.dbUrl)}: ${conteggio.errore}` };
  const righe = Number(conteggio.righe[0] ?? 0);
  if (righe === 0) {
    return { errore: `database senza dati su ${mascheraUrl(ctx.dbUrl)} (${tabelle.righe.length} tabelle, 0 righe): il seed non e' stato applicato, e i fallimenti della batteria sembrerebbero difetti dell'app` };
  }
  return { tabelle: tabelle.righe.length, righe };
}

function interrogaDb(dbUrl, sql) {
  // `-X`: un `~/.psqlrc` cambia la forma dell'uscita, e un'uscita vuota qui si
  // legge come «zero tabelle» invece che come «non ho letto» (referto § M1).
  // La password esce dalla riga di comando e passa da `PGPASSWORD` (§ L2): la
  // tabella dei processi la legge chiunque sia sulla macchina.
  const credenziali = credenzialiPsql(dbUrl);
  // La URL non e' utilizzabile senza che la credenziale esca da una porta che
  // questo gate non controlla: nessuna interrogazione, e il motivo scritto.
  if (credenziali.errore) return { errore: credenziali.errore };
  const res = run("psql", [credenziali.url, "-X", "-At", "-c", sql], {
    env: ambientePsql(credenziali, { PGCONNECT_TIMEOUT: String(Math.round(LIMITI.connessione / 1000)) }),
  });
  if (scaduto(res)) return { errore: motivoScaduto("psql", LIMITI.strumento) };
  if (res.error) return { errore: res.error.message };
  if (res.status !== 0) return { errore: (res.stderr || res.stdout || "").trim().split("\n").slice(0, 5).join(" ") };
  return { righe: righeDaPsql(res.stdout) };
}

// 6. la batteria vera. Le spec si CONTANO prima: `playwright test` su zero
// file esce 0, e zero test che passano non e' un verde.
function passoPlaywright(ctx) {
  const etichetta = "batteria Playwright (il browser giudica)";
  if (ctx.spec.length === 0) {
    record(ID.playwright, etichetta, "skipped", "nessun file di spec in e2e/: `playwright test` su zero file esce 0, e zero test passati non e' un verde");
    return;
  }
  if (!ctx.appViva) {
    record(ID.playwright, etichetta, "skipped", "premessa mancante (passo `app-viva`): la batteria non e' stata lanciata, perche' il suo esito non sarebbe un esito");
    return;
  }
  if (!existsSync(join(PROGETTO, "node_modules", "@playwright", "test"))) {
    record(ID.playwright, etichetta, "skipped", "@playwright/test non installato nel progetto: la batteria NON e' stata eseguita (`npm install`)");
    return;
  }
  // La batteria percorre l'app di cui `app-viva` ha misurato la premessa, non
  // una che risolve per conto suo: l'URL si impone (vedi `ambienteBatteria`).
  const res = run("npx", ["playwright", "test", "--reporter=json"], {
    env: ambienteBatteria(ctx.urlApp, process.env),
    timeout: LIMITI.playwright,
  });
  if (scaduto(res)) {
    record(ID.playwright, etichetta, "skipped", motivoScaduto("npx playwright test", LIMITI.playwright));
    return;
  }
  // il guasto va nella direzione sicura (MANCANTE), ma la diagnosi deve dire
  // COSA e' andato storto: «report non interpretabile» su un errore di
  // esecuzione incolpa Playwright di un problema che sta altrove
  if (res.error) {
    record(ID.playwright, etichetta, "skipped", `la batteria non e' stata lanciata: ${res.error.message}`);
    return;
  }
  const { parsed, errore } = estraiOggettoJson(res.stdout || res.stderr || "");
  if (errore) {
    record(ID.playwright, etichetta, "skipped", `report JSON di Playwright non interpretabile: ${errore}`);
    return;
  }
  const esito = esitoPlaywright(parsed);
  const dettaglio = dettaglioPlaywright(esito, ctx.spec.length);
  // La batteria e' partita, ma ha eseguito qualcosa? Con ogni test saltato il
  // report e' valido, l'uscita e' 0 e non e' fallito niente: senza questa riga
  // il passo sarebbe `pass` su zero flussi percorsi. Le spec contate PRIMA sono
  // file, non esecuzioni — e' l'ultimo posto in cui «esce 0 senza aver letto»
  // era rimasto aperto (DECISIONI.md §18).
  if (!batteriaHaEseguito(esito) && esito.errori.length === 0) {
    record(ID.playwright, etichetta, "skipped",
      `${dettaglio}\nnessun test eseguito: la batteria e' partita e non ha percorso nessun flusso (tutti saltati). Zero test passati non e' un verde: e' una verifica mancante`);
    return;
  }
  registraEsitoPerFlusso(ctx, esito, dettaglio);
}

/**
 * L'esito si legge PER FLUSSO, non in blocco (referto § C2, 2026-08-06).
 * Un test verde qualsiasi soddisfaceva la premessa «il browser e' il giudice»
 * per tutti i flussi dichiarati: 12 spec saltate su 13 passavano invisibili, e
 * speed-demon a valle legge solo `ok`.
 * L'ordine dei tre esiti e' quello di `passoLint`: un difetto TROVATO pesa piu'
 * di una verifica mancante, e una verifica mancante non e' mai un `pass`.
 */
function registraEsitoPerFlusso(ctx, esito, dettaglio) {
  const etichetta = "batteria Playwright (il browser giudica)";
  if (ctx.flussi === null) {
    record(ID.playwright, etichetta, "skipped",
      `${dettaglio}\ncontratto dei flussi non leggibile: non si sa quali flussi dovevano essere percorsi, quindi non si sa cosa questa batteria abbia provato`);
    return;
  }
  const { percorsi, nonPercorsi } = flussiPercorsi(ctx.flussi, esito);
  // il conteggio si stampa SEMPRE, anche sul verde: «14 file di spec» si legge
  // come copertura avvenuta, «0 flussi critici su 13 percorsi» no
  const righe = [dettaglio, rigaFlussiPercorsi(ctx.flussi, percorsi)];
  if (nonPercorsi.length > 0) righe.push(...nonPercorsi.map((n) => `  - ${n.motivo}`));

  if (!esitoBatteriaVerde(esito)) {
    record(ID.playwright, etichetta, "fail", righe.join("\n"));
    return;
  }
  if (nonPercorsi.length > 0) {
    righe.push(`${nonPercorsi.length} flussi critici dichiarati non sono stati percorsi da nessun test eseguito: e' una verifica MANCANTE, non un verde. Il gate resta rosso`);
    record(ID.playwright, etichetta, "skipped", righe.join("\n"));
    return;
  }
  record(ID.playwright, etichetta, "pass", righe.join("\n"));
}

// 7. contratto d'uscita: cosa trova davvero chi viene dopo, e se l'handoff
// dice la verita' sul gate che lo sta verificando (DECISIONI.md §19).
function passoContratto() {
  const esito = contrattoUscita(HANDOFF, leggiSeCe(HANDOFF), leggiSeCe(CONFIG_PLAYWRIGHT), verdettoDa(steps));
  record(ID.contratto, "contratto d'uscita (handoff + configurazione)", esito.status, esito.detail);
}

// L'ordine di questa lista E' il gate: un test lo blocca insieme agli id.
export const PASSI = Object.freeze([
  { id: ID.flussi, esegui: (ctx) => passoFlussi(ctx) },
  { id: ID.copertura, esegui: (ctx) => passoCopertura(ctx) },
  { id: ID.lint, esegui: (ctx) => passoLint(ctx) },
  { id: ID.effettoDb, esegui: (ctx) => passoEffettoDb(ctx) },
  { id: ID.appViva, esegui: (ctx, args) => passoAppViva(ctx, args) },
  { id: ID.playwright, esegui: (ctx) => passoPlaywright(ctx) },
  { id: ID.contratto, esegui: () => passoContratto() },
]);

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE FLUSSI: ${verde ? "VERDE" : "ROSSO"} ` +
    `(${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti su ${riassunto.passi} passi)\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status];
    console.log(`${marchio}  ${s.name}`);
    // il dettaglio si stampa anche sui passi verdi: e' li' che finisce
    // «passati al secondo tentativo», e un'instabilita' nascosta non esiste
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) {
    console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  }
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, dbUrl: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Uscita 2 = errore di esecuzione, non verdetto: qui non c'e' un progetto
  // Web Gun, e un gate che desse ROSSO direbbe una cosa su un progetto che non
  // ha guardato.
  if (!existsSync(join(PROGETTO, "docs")) && !existsSync(DIR_SPEC)) {
    console.error(`Ne' docs/ ne' e2e/ in ${PROGETTO}: non c'e' batteria da verificare (lancia il gate dalla radice del progetto).`);
    process.exit(2);
  }
  const ctx = raccogliContesto();
  for (const passo of PASSI) await passo.esegui(ctx, args);
  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano ID/PASSI/riepilogo.
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
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}
