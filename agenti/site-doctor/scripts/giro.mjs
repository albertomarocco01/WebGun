#!/usr/bin/env node
// Il giro del collaudo: per ogni classe accende il banco sabotato su 3882,
// lancia il gate dalla radice del progetto sabotato, e stampa QUALE passo e'
// caduto e con che stato. Un rosso sul passo sbagliato vale un verde.
//
//   node giro.mjs [CLASSE ...]        # tutte, o solo quelle indicate
//
// Vive accanto al gate che processa (D25, 2026-08-07): i sorgenti del banco
// sono tracciati, cio' che generano no. Le cartelle di lavoro nascono sotto
// `banco-prova-collaudo-sd/`, che la regola `banco-prova*/` di `.gitignore`
// copre gia' senza bisogno di una riga nuova.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CLASSI } from "./banco-sl.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const BANCO = join(QUI, "banco-sl.mjs");
const DIR = join(QUI, "banco-prova-collaudo-sd", "sabotato");
const PORTA = 3882;
const GATE = join(QUI, "verify.mjs");

/**
 * `--sabota` NON rigenera (`banco-sl.mjs` §epilogo: `if (!a.sabota) genera(...)`),
 * perche' il sabotaggio deve poter cambiare senza rifare l'albero. Fino al
 * 2026-08-07 questo giro presupponeva quindi che qualcuno avesse generato la
 * cartella A MANO su QUESTO disco: da un clone pulito le 42 classi uscivano
 * tutte `PREMESSA-MANCANTE (morto)` — il banco rispondeva 404 su ogni percorso
 * con l'intestazione giusta, e `r.ok` era falso per sempre.
 *
 * E' lo stesso buco di riproducibilita' che D25 ha chiuso dentro `banco-sl.mjs`
 * (il certificato e l'handoff nati da codice invece che scritti a mano),
 * sopravvissuto un piano piu' su: la correzione era stata fatta al banco e non
 * a chi lo lancia.
 */
function generaSeManca() {
  if (existsSync(join(DIR, "docs", "conformita.md"))) return;
  process.stdout.write(`(genero il banco in ${DIR} — la prima volta, o dopo una pulizia)\n`);
  const r = spawnSync(process.execPath, [BANCO, "--dir", DIR, "--porta", String(PORTA)], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    process.stderr.write(`generazione fallita (uscita ${r.status}): ${r.stderr || r.stdout}\n`);
    process.exit(2);
  }
  process.stdout.write(`${(r.stdout || "").trim()}\n`);
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Non basta che la porta risponda: deve rispondere IL BANCO CHE HO ACCESO IO.
 * Al primo giro un server rimasto vivo da prima teneva la 3882, i banchi
 * sabotati non si legavano in silenzio, e 31 classi su 31 uscivano VERDE — su
 * un sito conforme. E' la stessa lezione del `BUILD_ID` che questa casa ha gia'
 * pagato tre volte: si misura la premessa prima dell'esito.
 */
async function vivo(porta, classe, tentativi = 60) {
  let vistoAltro = false;
  for (let i = 0; i < tentativi; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(500) });
      // L'intestazione, non `r.ok`: e' la FIRMA del banco e viaggia su OGNI
      // risposta. Alcuni sabotaggi rispondono legittimamente 404 sulla radice
      // (SUP2, SMP1, ROB1...), e con `if (r.ok)` restavano «morti» per sempre
      // — cioe' il giro perdeva le classi proprio dove il gate doveva parlare.
      const firma = r.headers.get("x-banco-sabotaggio");
      if (firma === classe) return "ok";
      // Risponde qualcun altro: quasi sempre il banco della classe precedente
      // che non ha ancora mollato la porta. Si continua ad aspettare, non si
      // conclude subito — su Windows il socket resta legato per qualche istante
      // dopo il `kill`.
      if (firma !== null) vistoAltro = true;
    } catch {
      /* non ancora */
    }
    await attendi(250);
  }
  return vistoAltro ? "banco-sbagliato" : "morto";
}

/**
 * Dopo il `kill`, la porta non e' libera subito: su Windows il socket resta
 * legato per qualche istante e il banco successivo non si lega IN SILENZIO.
 * Si aspetta che la porta smetta di rispondere, invece di sperarci con
 * un'attesa fissa — e` la stessa disciplina di `vivo`, all'incontrario.
 */
async function spento(porta, tentativi = 40) {
  for (let i = 0; i < tentativi; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${porta}/`, { signal: AbortSignal.timeout(300) });
    } catch {
      return true;
    }
    await attendi(250);
  }
  return false;
}

function lancia(classe) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [GATE, "--url", `http://127.0.0.1:${PORTA}`, "--json"], {
    cwd: DIR,
    encoding: "utf8",
    timeout: 180000,
  });
  const ms = Date.now() - t0;
  if (r.error && r.error.code === "ETIMEDOUT") return { classe, verdetto: "APPESO", ms, passi: [], uscita: null };
  let doc = null;
  try {
    doc = JSON.parse(r.stdout);
  } catch {
    return { classe, verdetto: "USCITA-NON-JSON", ms, uscita: r.status, grezzo: (r.stdout || r.stderr || "").slice(0, 400), passi: [] };
  }
  return {
    classe,
    verdetto: doc.ok ? "VERDE" : "ROSSO",
    uscita: r.status,
    ms,
    passi: doc.steps.filter((s) => s.status !== "pass").map((s) => `${s.id}:${s.status}`),
  };
}

generaSeManca();

// Se la porta e' gia' occupata PRIMA di cominciare, ogni riga di questo giro
// parlerebbe del banco di qualcun altro. E' successo davvero il 2026-08-07: un
// banco lasciato acceso da una diagnosi teneva la 3882, e il giro ha stampato
// una riga VERDE per la sua classe e «banco-sbagliato» per tutte le altre.
// Meglio non partire che stampare quarantadue righe che non dicono niente.
{
  let occupata = null;
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/`, { signal: AbortSignal.timeout(700) });
    occupata = r.headers.get("x-banco-sabotaggio") ?? "un server che non e' un banco";
  } catch {
    /* libera: e' quello che vogliamo */
  }
  if (occupata !== null) {
    process.stderr.write(
      `la porta ${PORTA} e' gia' occupata (${occupata}): spegni quel processo, altrimenti ogni riga di questo giro parla del banco sbagliato.\n`,
    );
    process.exit(2);
  }
}

const chieste = process.argv.slice(2);
const elenco = chieste.length ? chieste : Object.keys(CLASSI).filter((c) => c !== "DAT2" && c !== "DAT4" && c !== "INF2" && c !== "INF3" && c !== "SUP4" && c !== "ARC2" && c !== "ARC4");

for (const classe of elenco) {
  const server = spawn(process.execPath, [join(QUI, "banco-sl.mjs"), "--dir", DIR, "--porta", String(PORTA), "--servi", "--sabota", classe], {
    stdio: "ignore",
  });
  const su = await vivo(PORTA, classe);
  if (su !== "ok") {
    process.stdout.write(`${classe.padEnd(6)} PREMESSA-MANCANTE (${su}): nessun verdetto\n`);
    server.kill();
    await spento(PORTA);
    continue;
  }
  const e = lancia(classe);
  const durata = e.ms > 20000 ? ` (${Math.round(e.ms / 1000)}s)` : "";
  process.stdout.write(
    `${classe.padEnd(6)} ${e.verdetto.padEnd(15)}${durata} ${e.passi.join(" ") || "—"}${e.grezzo ? ` | ${e.grezzo.replace(/\s+/g, " ")}` : ""}\n`,
  );
  server.kill();
  if (!(await spento(PORTA))) {
    process.stdout.write(`  (la porta ${PORTA} non si e' liberata: le classi dopo questa non sono attendibili)\n`);
  }
}
