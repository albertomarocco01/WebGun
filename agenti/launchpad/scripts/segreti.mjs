#!/usr/bin/env node
/**
 * segreti.mjs — Il controllo dei segreti, da solo.
 *
 * COSA FA: legge OGNI file tracciato da git, i file ignorati che un deploy da
 * CLI caricherebbe comunque, e le righe aggiunte dagli ultimi N commit; cerca
 * le famiglie di `segreti-lib.mjs`; stampa cosa ha letto PRIMA di dire cosa ha
 * trovato.
 *
 * USO:  node segreti.mjs [--progetto <dir>] [--storia N] [--json]
 * USCITA: 0 = nessun bloccante · 1 = almeno un bloccante · 2 = errore
 *
 * PERCHE' ESISTE SEPARATO DAL GATE: e' il controllo che conviene lanciare per
 * primo e da solo, perche' e' il solo che non si puo' rimediare dopo. Un
 * segreto trovato qui costa un commit; trovato dopo il deploy costa una
 * rotazione di chiavi e una riscrittura della storia — e chi ha gia' clonato
 * ce l'ha comunque.
 *
 * QUELLO CHE TROVA NON LO STAMPA: famiglia, file, riga e i primi quattro
 * caratteri. Un controllo che ricopia il segreto nel proprio log lo ha
 * pubblicato una seconda volta.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contaGravita, dettaglioFindings, eBinario, esitoSegreti } from "./segreti-lib.mjs";

export const FUORI_DAL_PACCHETTO =
  /(^|[/\\])(node_modules|\.next|\.git|\.claude|\.turbo|\.vercel|\.wrangler|out|dist|coverage|test-results|playwright-report|\.perf)([/\\]|$)|(^|[/\\])supabase[/\\]\.(temp|branches)([/\\]|$)|(^|[/\\])e2e[/\\]\.auth([/\\]|$)/;

export const STORIA_DEFAULT = 200;
const MARCATORE = "\u0001";

let GIT = null;
function trovaGit() {
  if (GIT !== null) return GIT;
  const res = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" });
  if (res.error || res.status !== 0) return (GIT = false);
  const righe = res.stdout.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const scelta = process.platform === "win32" ? righe.find((r) => /\.(exe|cmd|bat)$/i.test(r)) : righe[0];
  return (GIT = scelta || false);
}

function git(dir, args) {
  const exe = trovaGit();
  if (!exe) return { ok: false, out: "" };
  const res = spawnSync(exe, ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.error || res.status !== 0) return { ok: false, out: res.stdout ?? "" };
  return { ok: true, out: res.stdout ?? "" };
}

const gitRighe = (dir, args) => {
  const { ok, out } = git(dir, args);
  return ok ? out.split(/\r?\n/).map((r) => r.trim()).filter(Boolean) : null;
};

/**
 * Le righe AGGIUNTE dagli ultimi N commit, raggruppate per commit.
 *
 * Solo le aggiunte: una riga rimossa e' gia' contata dal commit che l'aveva
 * introdotta, e contarla due volte raddoppierebbe ogni rilievo storico.
 */
export function leggiStoria(dir, quanti) {
  if (quanti <= 0) return [];
  const { ok, out } = git(dir, [
    "log", "--all", `-n${quanti}`, "-p", "--unified=0", "--no-color", "--format=%x01%H %cI", "--", ".",
  ]);
  if (!ok || !out) return [];
  // Raggruppate per FILE dentro il commit, non per commit.
  //
  // La prima stesura appiattiva tutte le righe aggiunte di un commit in un
  // blocco solo, etichettato col solo sha — e quella scelta rendeva CIECA la
  // famiglia `credenziale-sql`, che si applica ai soli `.sql`: nessuna
  // etichetta finiva per `.sql`, quindi una password committata in un seed e
  // tolta il giorno dopo non veniva vista da nessuno. Trovato da un test il
  // 2026-08-06.
  const pezzi = [];
  let sha = null;
  let data = null;
  let file = null;
  let righeAggiunte = [];
  const chiudi = () => {
    if (file && righeAggiunte.length > 0) {
      pezzi.push({ percorso: file, etichetta: `${file} @ ${sha} (${(data ?? "").slice(0, 10)})`, testo: righeAggiunte.join("\n") });
    }
    righeAggiunte = [];
  };
  for (const riga of out.split(/\r?\n/)) {
    if (riga.startsWith(MARCATORE)) {
      chiudi();
      file = null;
      [sha, data] = riga.slice(1).split(" ");
      sha = (sha ?? "").slice(0, 12);
      continue;
    }
    if (riga.startsWith("+++ ")) {
      chiudi();
      const p = riga.slice(4).trim();
      file = p === "/dev/null" ? null : p.replace(/^b\//, "");
      continue;
    }
    if (riga.startsWith("--- ") || riga.startsWith("+++")) continue;
    if (riga.startsWith("+") && file) righeAggiunte.push(riga.slice(1));
  }
  chiudi();
  return pezzi;
}
export function raccogli(dir, storiaN) {
  const tracciati = gitRighe(dir, ["ls-files"]);
  if (tracciati === null) return null;
  const letti = [];
  const binari = [];
  for (const percorso of tracciati) {
    try {
      const buf = readFileSync(join(dir, percorso));
      if (eBinario(buf)) binari.push(percorso);
      else letti.push({ percorso, testo: buf.toString("utf8") });
    } catch { /* sparito fra `ls-files` e la lettura: non si accusa nessuno */ }
  }
  // I file NUOVI e non ignorati: `git ls-files` non li elenca, e il gesto
  // successivo di chiunque e' `git add -A`. Vedi la nota in `esitoSegreti`.
  const daTracciare = [];
  for (const percorso of gitRighe(dir, ["ls-files", "--others", "--exclude-standard"]) ?? []) {
    if (FUORI_DAL_PACCHETTO.test(percorso)) continue;
    try {
      const buf = readFileSync(join(dir, percorso));
      if (eBinario(buf)) binari.push(percorso);
      else daTracciare.push({ percorso, testo: buf.toString("utf8") });
    } catch { /* sparito fra l'elenco e la lettura */ }
  }
  const ignorati = [];
  for (const percorso of gitRighe(dir, ["ls-files", "--others", "--ignored", "--exclude-standard"]) ?? []) {
    if (FUORI_DAL_PACCHETTO.test(percorso)) continue;
    try {
      const buf = readFileSync(join(dir, percorso));
      if (!eBinario(buf) && buf.length < 512 * 1024) ignorati.push({ percorso, testo: buf.toString("utf8") });
    } catch { /* ignorato e illeggibile: non e' un rilievo */ }
  }
  return { letti, daTracciare, ignorati, binari, storia: leggiStoria(dir, storiaN) };
}

function parseArgs(argv) {
  const args = { progetto: process.cwd(), storia: STORIA_DEFAULT, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--progetto") args.progetto = resolve(argv[++i]);
    else if (argv[i] === "--storia") args.storia = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.progetto)) {
    console.error(`${args.progetto} non esiste.`);
    process.exit(2);
  }
  if (!trovaGit()) {
    console.error("`git` non e' raggiungibile: senza non si sa quali file partirebbero col deploy. Uno strumento assente non produce un verde.");
    process.exit(2);
  }
  if (!Number.isInteger(args.storia) || args.storia < 0) {
    console.error("--storia vuole un intero >= 0 (0 = non guardare la storia, e il risultato lo dichiara).");
    process.exit(2);
  }
  const raccolto = raccogli(args.progetto, args.storia);
  if (raccolto === null) {
    console.error(`${args.progetto} non e' un repository git: il controllo guarda cio' che git consegnerebbe, e qui non c'e' git.`);
    process.exit(2);
  }
  const { findings, riassunto } = esitoSegreti(raccolto);
  const g = contaGravita(findings);

  if (args.json) {
    console.log(JSON.stringify({ contract: 1, ok: g.block === 0, summary: { ...riassunto, ...g }, findings }, null, 2));
    process.exit(g.block === 0 ? 0 : 1);
  }

  // La premessa PRIMA dell'esito (DECISIONI.md §18): un controllo su zero file
  // non deve poter somigliare a un controllo pulito.
  console.log(`SEGRETI: ${g.block === 0 ? "nessun bloccante" : `${g.block} BLOCCANTI`} (${g.issue} da guardare)`);
  console.log(`progetto: ${args.progetto}`);
  console.log(`  ${riassunto.letti} file tracciati letti · ${riassunto.daTracciare} nuovi non ancora tracciati · ${riassunto.binari} binari non letti`);
  console.log(`  ${riassunto.ignorati} file ignorati guardati (partono solo con un deploy da CLI)`);
  console.log(`  ${riassunto.storia} commit attraversati nella storia · ${riassunto.famiglie} famiglie cercate`);
  if (riassunto.letti === 0) {
    console.log("\nZERO file letti non e' «nessun segreto»: e' una verifica non fatta.");
    process.exit(2);
  }
  console.log("");
  if (findings.length === 0) {
    console.log("Nessun rilievo. Non vuol dire «nessun segreto»: vuol dire nessuno delle famiglie note, nei file letti.");
  } else {
    console.log(dettaglioFindings(findings));
    const conHint = findings.filter((f) => f.hint);
    if (conHint.length > 0) {
      console.log("\nPerche' contano:");
      for (const f of conHint) console.log(`  ${f.object} — ${f.hint}`);
    }
  }
  process.exit(g.block === 0 ? 0 : 1);
}

// Epilogo a doppio confronto: `import.meta.main` e' di Node 24 e su Node 20
// vale `undefined` (script muto, uscita 0 = falso verde); e dalla junction
// `.claude/skills/launchpad/...` il confronto testuale da solo e' FALSO, perche'
// `argv[1]` resta il percorso della junction mentre `import.meta.url` e' gia'
// canonico. `realpathSync` scioglie la junction; se solleva vale il testuale.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
