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
//
// \`execSync\` si importa in cima invece di chiamare \`require\` qui dentro: in un
// \`next.config.mjs\` \`require\` NON ESISTE — e' ESM nativo qualunque cosa dica
// \`type\` in package.json — e la build del cliente moriva con
// «impronta: commit non risolvibile», mandando chi debugga a controllare git.
// Misurato dal tribunale del 2026-08-06 su una build Next.js 16.3.0 vera.
import { execSync } from "node:child_process";

const improntaDalCommit = () => {
  const daAmbiente =
    process.env.WEBGUN_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA;
  let sha = daAmbiente || "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch (e) {
      // Il motivo vero non si inghiotte: chi legge deve sapere se e' git che
      // manca o il repository che non c'e'.
      //
      // \`e instanceof Error\` e NON \`e.message\`: sotto \`strict\` — che e' lo
      // stack standard di questa casa e il default di \`create-next-app\` — il
      // binding di \`catch\` ha tipo \`unknown\`, e leggerne una proprieta' NON
      // COMPILA. Misurato dal collaudo del 2026-08-06 su Next 15.5.22:
      // \`next build\` moriva con «Type error: Property 'message' does not exist
      // on type '{}'» su next.config.ts:29. Stessa classe del rilievo IO-1 — il
      // rimedio che questa skill prescrive rompe la build di chi lo applica —
      // spostata dal \`.mjs\` (che non e' tipizzato) al \`.ts\`, che e' la forma
      // che lo SKILL.md nomina e quella che il 99% dei progetti Web Gun ha.
      const motivo = e instanceof Error ? e.message : String(e);
      throw new Error(
        "impronta: \`git rev-parse HEAD\` non eseguibile (" + motivo + "). " +
          "Imposta WEBGUN_COMMIT, oppure costruisci da un repository git.",
      );
    }
  }
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

/** Il frammento nella forma giusta per il modulo di destinazione. */
const frammentoPer = (esm) =>
  esm
    ? FRAMMENTO
    : FRAMMENTO
        .replace('import { execSync } from "node:child_process";\n', "")
        .replace("sha = execSync(", 'sha = require("node:child_process").execSync(');

/** Le zone di commento, per non scrivere dentro un commento (rilievo IO-4). */
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

/**
 * Inserisce `generateBuildId` NELL'OGGETTO CHE VIENE ESPORTATO.
 *
 * Rilievo IO-4 del tribunale del 2026-08-06: prima si cercava la **prima**
 * dichiarazione `const … = {` del file, senza verificare che fosse quella
 * esportata e senza escludere i commenti. Misurato su forme comuni: con un
 * `const securityHeaders = {…}` prima del vero `nextConfig`, la proprieta'
 * finiva dentro `securityHeaders`; con un commento a blocco che conteneva una
 * dichiarazione simile, l'intero frammento finiva **dentro il commento**,
 * inerte. In entrambi i casi il comando stampava «scritto» e il riepilogo
 * diceva «generateBuildId dichiarato», perche' l'idempotenza si fidava dello
 * stesso regex ingenuo. Un `npm run build` produceva un'impronta casuale, e a
 * scoprirlo era solo un confronto dopo la build.
 */
export function conFrammento(testo, { esm = false } = {}) {
  if (/generateBuildId/.test(senzaCommenti(testo))) {
    return { testo, cambiato: false, motivo: "`generateBuildId` c'e' gia'" };
  }
  const pulito = senzaCommenti(testo);
  const frammento = frammentoPer(esm);

  // 1) `export default { … }` / `module.exports = { … }`: si scrive li' dentro.
  const diretto = pulito.match(/(?:export\s+default|module\.exports\s*=)\s*\{/);
  if (diretto) {
    const dopoGraffa = diretto.index + diretto[0].length;
    return {
      testo: `${frammento}\n\n${testo.slice(0, dopoGraffa)}\n  generateBuildId: improntaDalCommit,\n${testo.slice(dopoGraffa)}`,
      cambiato: true,
      motivo: "inserito nell'oggetto esportato direttamente",
    };
  }

  // 2) `export default nomeVar` / `module.exports = nomeVar`: si risale alla
  //    dichiarazione DI QUELLA variabile, non alla prima del file.
  const perNome = pulito.match(/(?:export\s+default|module\.exports\s*=)\s*([A-Za-z_$][\w$]*)\s*;?/);
  if (!perNome) {
    return { testo, cambiato: false, motivo: "non riconosco cosa esporta questo next.config: il frammento va inserito a mano" };
  }
  const nome = perNome[1];
  const dichiarazione = new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${nome}\\s*(?::[^=]+)?=\\s*\\{`);
  const d = pulito.match(dichiarazione);
  if (!d) {
    return { testo, cambiato: false, motivo: `\`${nome}\` e' esportato ma non e' un oggetto letterale: il frammento va inserito a mano` };
  }
  const inizio = d.index + d[0].length - d[0].trimStart().length;
  const dopoGraffa = d.index + d[0].length;
  return {
    testo: `${testo.slice(0, inizio)}${frammento}\n\n${testo.slice(inizio, dopoGraffa)}\n  generateBuildId: improntaDalCommit,\n${testo.slice(dopoGraffa)}`,
    cambiato: true,
    motivo: `inserito nell'oggetto \`${nome}\`, che e' quello esportato`,
  };
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
  // `.mjs` e' ESM sempre; `.ts` lo transpila Next; `.js` dipende da `type`.
  let tipo = null;
  try { tipo = JSON.parse(readFileSync(join(progetto, "package.json"), "utf8")).type ?? null; } catch { /* nessun package.json */ }
  const esm = /\.(mts|mjs)$/.test(percorsoConfig) || /\.ts$/.test(percorsoConfig) || tipo === "module";
  const esito = conFrammento(testo, { esm });
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
