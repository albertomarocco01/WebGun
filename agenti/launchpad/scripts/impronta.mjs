#!/usr/bin/env node
/**
 * impronta.mjs — L'impronta dell'artefatto, derivata dal commit.
 *
 * IL PROBLEMA. Speed Demon risponde alla domanda «sto guardando davvero l'app
 * di questo progetto?» confrontando il `BUILD_ID` dell'HTML servito con quello
 * di `.next/BUILD_ID`. Funziona perche' quella build l'ha fatta lui, su quella
 * macchina. In produzione no: Vercel e Cloudflare RICOSTRUISCONO dal sorgente,
 * e il `BUILD_ID` che ne esce e' un altro, generato a caso. Copiare quel
 * confronto avrebbe prodotto un rifiuto indebito su ogni deploy corretto.
 *
 * LA RISPOSTA. L'impronta si DERIVA dal commit invece di registrarla:
 * `generateBuildId` risolve il commit da quattro fonti e solleva se non lo
 * trova. Chiunque ricostruisca lo stesso commit ottiene la stessa impronta —
 * sulla nostra macchina come sulla loro — e la verifica dopo il deploy diventa
 * una domanda a cui si risponde da fuori, con una GET.
 *
 * USO:  node impronta.mjs [--progetto <dir>] [--url <url>] [--commit <sha>]
 *                         [--scrivi] [--json]
 *   senza argomenti  → stampa l'impronta attesa e lo stato di next.config
 *   --url            → interroga quell'indirizzo e confronta (e' `verifica-pubblicato`)
 *   --commit         → il commit APPROVATO, quando non e' HEAD (dopo il deploy
 *                      si verifica contro cio' che il runbook ha fatto firmare)
 *   --scrivi         → scrive `generateBuildId` in next.config: l'UNICA riga di
 *                      codice altrui che questo agente tocca, e la tocca solo
 *                      se glielo si chiede
 * USCITA: 0 = impronta coerente · 1 = non coerente · 2 = errore
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildIdDaHtml, findingsImpronta, dettaglioFindings, improntaAttesa, improntaCombacia } from "./gate-lib.mjs";
import { git } from "./git-lib.mjs";

const CONFIG = ["next.config.ts", "next.config.mjs", "next.config.js"];

/**
 * Il frammento da mettere in `next.config`.
 *
 * L'ordine delle fonti non e' arbitrario: `WEBGUN_COMMIT` ha la precedenza
 * perche' e' l'unica che una persona puo' impostare a mano quando serve
 * ricostruire un artefatto vecchio; poi le due variabili che i provider
 * impostano da soli su una build connessa a git; poi git, per le build locali.
 *
 * E SOLLEVA. Un ripiego silenzioso — per esempio uno SHA scritto come
 * letterale — e' peggio di un'impronta casuale: al commit successivo quel
 * letterale e' ancora li' e la build dichiarerebbe con sicurezza il commit
 * SBAGLIATO. L'impronta casuale ammette di non sapere; questa afferma il falso.
 */
export const FRAMMENTO = `// Impronta dell'artefatto (launchpad). Il BUILD_ID e' una FUNZIONE del commit:
// chiunque ricostruisca lo stesso commit ottiene la stessa impronta, qui come
// sulla macchina del provider. E' la sola prova d'identita' che sopravvive al
// fatto che non siamo noi a costruire. Se il commit non e' risolvibile la build
// FALLISCE: un artefatto che non sa dire chi e' non deve nascere.
const improntaDalCommit = () => {
  const daAmbiente =
    process.env.WEBGUN_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA;
  const sha =
    daAmbiente ||
    (() => {
      try {
        return require("node:child_process")
          .execSync("git rev-parse HEAD", { encoding: "utf8" })
          .trim();
      } catch {
        return "";
      }
    })();
  if (!sha) {
    throw new Error(
      "impronta: commit non risolvibile (WEBGUN_COMMIT, VERCEL_GIT_COMMIT_SHA, CF_PAGES_COMMIT_SHA, git). " +
        "Senza, cio' che va online non e' dimostrabile: la build si ferma qui.",
    );
  }
  return sha.toLowerCase().slice(0, 12);
};`;

// git sta in `git-lib.mjs`: qui serve una domanda sola.
function commitDi(dir) {
  const { ok, out } = git(dir, ["rev-parse", "HEAD"]);
  return ok ? out.trim() || null : null;
}

const trovaConfig = (dir) => CONFIG.map((n) => join(dir, n)).find((p) => existsSync(p)) ?? null;

/** Inserisce il frammento e la riga `generateBuildId` senza toccare il resto. */
export function conFrammento(testo) {
  if (/generateBuildId/.test(testo)) return { testo, cambiato: false, motivo: "`generateBuildId` c'e' gia'" };
  const m = testo.match(/^(const|let)\s+(\w+)\s*(:[^=]+)?=\s*\{/m);
  if (!m) return { testo, cambiato: false, motivo: "non riconosco la forma di questo next.config: il frammento va inserito a mano" };
  const inizio = testo.indexOf(m[0]);
  const dopoGraffa = inizio + m[0].length;
  const nuovo =
    `${testo.slice(0, inizio)}${FRAMMENTO}\n\n${testo.slice(inizio, dopoGraffa)}\n` +
    `  generateBuildId: improntaDalCommit,\n${testo.slice(dopoGraffa)}`;
  return { testo: nuovo, cambiato: true, motivo: "frammento inserito prima dell'oggetto di configurazione" };
}

async function preleva(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      return { stato: r.status, corpo: await r.text() };
    } catch {
      if (i === 1) return null;
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  return null;
}

function parseArgs(argv) {
  const args = { progetto: process.cwd(), url: null, commit: null, scrivi: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--progetto") args.progetto = resolve(argv[++i]);
    else if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--commit") args.commit = argv[++i];
    else if (argv[i] === "--scrivi") args.scrivi = true;
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

/**
 * Scrive `generateBuildId` in `next.config`: l'UNICA riga di codice altrui che
 * questo agente tocca, e la tocca solo se glielo si chiede con `--scrivi`.
 */
function scriviFrammento(percorsoConfig, progetto) {
  if (!percorsoConfig) {
    console.error(`Nessun next.config in ${progetto}: non c'e' dove scrivere il frammento.`);
    process.exit(2);
  }
  const testo = readFileSync(percorsoConfig, "utf8");
  const esito = conFrammento(testo);
  if (esito.cambiato) {
    writeFileSync(percorsoConfig, esito.testo);
    console.log(`scritto in ${percorsoConfig}: ${esito.motivo}`);
    console.log("Ricostruisci (`npm run build`) perche' l'impronta entri nell'artefatto.");
    return;
  }
  console.log(`non scritto: ${esito.motivo}`);
  if (!/generateBuildId/.test(testo)) {
    console.log(`\nDa inserire a mano:\n\n${FRAMMENTO}\n\n  generateBuildId: improntaDalCommit,`);
  }
}

/** Il riepilogo leggibile. Stampa SEMPRE cosa ha guardato, anche sul verde. */
function stampa({ coerente, commit, atteso, percorsoConfig, nextConfig, buildIdDisco, url, servito, findings }) {
  console.log(`IMPRONTA: ${coerente ? "coerente" : "NON coerente"}`);
  console.log(`  commit            ${commit}`);
  console.log(`  impronta attesa   ${atteso}`);
  console.log(`  next.config       ${percorsoConfig ?? "assente"}${nextConfig && /generateBuildId/.test(nextConfig) ? " · generateBuildId dichiarato" : " · generateBuildId ASSENTE"}`);
  console.log(`  .next/BUILD_ID    ${buildIdDisco ?? "assente"}`);
  if (url) {
    console.log(`  servito da ${url}   ${servito.join(" · ") || "(nessun build id riconoscibile)"}`);
    console.log(`  combacia          ${servito.some((s) => improntaCombacia(s, atteso)) ? "SI" : "NO"}`);
  }
  if (findings.length > 0) console.log(`\n${dettaglioFindings(findings)}`);
  if (!url) {
    console.log("\nSenza `--url` questo comando non ha verificato niente di pubblicato: ha guardato il disco.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const percorsoConfig = trovaConfig(args.progetto);
  const commit = args.commit ?? commitDi(args.progetto);
  if (!commit) {
    console.error("Nessun commit: passa `--commit <sha>` oppure lancia da un repository git. L'impronta E' il commit; senza commit non c'e' impronta.");
    process.exit(2);
  }
  const atteso = improntaAttesa(commit);

  if (args.scrivi) scriviFrammento(percorsoConfig, args.progetto);

  const nextConfig = percorsoConfig ? readFileSync(percorsoConfig, "utf8") : null;
  const buildIdDisco = existsSync(join(args.progetto, ".next", "BUILD_ID"))
    ? readFileSync(join(args.progetto, ".next", "BUILD_ID"), "utf8").trim()
    : null;

  let html = null;
  let servito = [];
  if (args.url) {
    const risposta = await preleva(args.url);
    if (risposta === null) {
      console.error(`Nessuna risposta da ${args.url}.`);
      process.exit(2);
    }
    html = risposta.corpo;
    servito = buildIdDaHtml(html);
  }

  const findings = findingsImpronta({ nextConfig, buildIdDisco, commit, html, url: args.url });
  const coerente = !findings.some((f) => f.severity === "block");

  if (args.json) {
    console.log(JSON.stringify({ contract: 1, ok: coerente, commit, atteso, buildIdDisco, servito, findings }, null, 2));
    process.exit(coerente ? 0 : 1);
  }

  stampa({ coerente, commit, atteso, percorsoConfig, nextConfig, buildIdDisco, url: args.url, servito, findings });
  process.exit(coerente ? 0 : 1);
}

// Epilogo a doppio confronto — vedi la nota estesa in `verify.mjs`.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}
