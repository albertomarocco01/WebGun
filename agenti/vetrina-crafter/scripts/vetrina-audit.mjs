#!/usr/bin/env node
/**
 * vetrina-audit.mjs — I controlli STATICI, da soli, senza app accesa.
 *
 * Sono i passi 3, 4 e 5 del gate: `cucitura-ui`, `chiavi-e-client`,
 * `a11y-statica`. Girano sui soli sorgenti, quindi si possono lanciare mentre si
 * costruisce, molto prima di avere una build da servire — sono i controlli che
 * si sistemano in cinque minuti e conviene vedere prima del giro completo.
 *
 * USO:  node vetrina-audit.mjs [--progetto <dir>] [--json]
 * USCITA: 0 = nessun bloccante · 1 = bloccanti trovati · 2 = errore di esecuzione
 *
 * QUESTO E' UN GUSCIO: legge file, lancia ESLint, stampa. Le regole stanno in
 * `audit-lib.mjs` e hanno i loro test.
 *
 * Stampa SEMPRE quanti file ha letto e quali cartelle ha guardato, anche quando
 * non ha niente da segnalare (DECISIONI.md §11). Il precedente e' misurato: il
 * walker di gestionale-crafter escludeva ogni cartella chiamata `supabase` e
 * saltava quindi `src/lib/supabase/`, cioe' proprio dove nascono i client — un
 * `service_role` piantato li' e' passato inosservato al primo giro, e l'audit
 * diceva «nessun bloccante».
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  conBarre,
  contaGravita,
  dettaglioFindings,
  regolaChiaviEClient,
  regolaCucitura,
  statoDaFindings,
} from "./audit-lib.mjs";
import { validaConfig } from "./progetto-lib.mjs";

export const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ESLINT = join(SKILL_DIR, "node_modules", "eslint", "bin", "eslint.js");
const CONFIG_A11Y = join(SKILL_DIR, "resources", "config", "eslint-a11y.config.mjs");
export const CONFIG_PROGETTO = "vetrina.config.json";

const IGNORATE = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage", ".turbo"]);
const SORGENTI = /\.(m?[jt]sx?|cjs)$/i;

export const ID_AUDIT = Object.freeze({
  cucitura: "cucitura-ui",
  chiavi: "chiavi-e-client",
  a11y: "a11y-statica",
});

// ---------------------------------------------------------------- lettura
function elencaFile(radice, dentro) {
  const trovati = [];
  const partenza = join(radice, dentro);
  if (!existsSync(partenza)) return trovati;

  const cammina = (cartella) => {
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
      if (IGNORATE.has(voce.name)) continue;
      const pieno = join(cartella, voce.name);
      if (voce.isDirectory()) cammina(pieno);
      else if (SORGENTI.test(voce.name)) trovati.push(conBarre(relative(radice, pieno)));
    }
  };
  cammina(partenza);
  return trovati;
}

export function raccogliSorgenti(progetto, sottocartella = "src") {
  return elencaFile(progetto, sottocartella).map((percorso) => ({
    percorso,
    testo: readFileSync(join(progetto, percorso), "utf8"),
  }));
}

// ----------------------------------------------------------------- a11y
/**
 * ESLint gira con `cwd` SUL PROGETTO e percorsi RELATIVI.
 *
 * Misurato il 2026-08-02, ed e' l'unica forma che funziona: con percorsi
 * assoluti ESLint 9 risponde «all of the files matching the glob pattern are
 * ignored … the file is located outside of the base path», perche' il base path
 * e' la cartella della configurazione — che qui sta dentro la skill, non dentro
 * il progetto. Il guasto andrebbe nella direzione sicura (uscita 2, quindi
 * MANCANTE), ma la diagnosi direbbe «nessun file da lintare» su un progetto
 * pieno di pagine.
 *
 * Si invoca `node <percorso>/eslint.js` e non lo shim `eslint.cmd`: cosi' l'unico
 * eseguibile in gioco e' quello che sta gia' girando, e la trappola degli shim
 * `.cmd` su Windows non si presenta affatto.
 */
function eseguiEslint(progetto, cartelle) {
  const res = spawnSync(process.execPath, [
    ESLINT,
    "--no-config-lookup",
    "--config", CONFIG_A11Y,
    "--format", "json",
    ...cartelle,
  ], { cwd: progetto, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  if (res.error) return { errore: res.error.message, esiti: null };
  const inizio = res.stdout.indexOf("[");
  if (inizio < 0) {
    return { errore: (res.stderr || "").split("\n").filter(Boolean)[0] ?? "nessun JSON in uscita", esiti: null };
  }
  try {
    return { errore: null, esiti: JSON.parse(res.stdout.slice(inizio)) };
  } catch {
    return { errore: "uscita di ESLint non interpretabile come JSON", esiti: null };
  }
}

function findingsA11y(esiti, progetto) {
  const findings = [];
  for (const file of esiti) {
    for (const m of file.messages) {
      findings.push({
        severity: m.severity === 2 ? "block" : "issue",
        object: `${conBarre(relative(progetto, file.filePath))}:${m.line ?? "?"}`,
        message: `${m.ruleId ?? "errore di analisi"}: ${m.message}`,
      });
    }
  }
  return findings;
}

// ------------------------------------------------------------- i tre passi
/**
 * @param {object} dati `{ progetto }`
 * @returns `{ letti, config, errori, passi }` — `passi` ha la stessa forma dei
 *   passi del gate, cosi' `verify.mjs` li innesta senza tradurre niente.
 */
export function auditStatico({ progetto }) {
  const percorsoConfig = join(progetto, CONFIG_PROGETTO);
  if (!existsSync(percorsoConfig)) {
    return mancanti(`${CONFIG_PROGETTO} assente: il gate non sa dove sia la radice pubblica, ne' quali siano le primitive della cucitura (comando \`scaffold\`)`);
  }

  let config = null;
  try {
    config = JSON.parse(readFileSync(percorsoConfig, "utf8"));
  } catch (errore) {
    return mancanti(`${CONFIG_PROGETTO} illeggibile: ${errore.message}`);
  }

  const { errori } = validaConfig(config);
  if (errori.length > 0) return mancanti(`${CONFIG_PROGETTO} incompleto:\n- ${errori.join("\n- ")}`, config);

  const file = raccogliSorgenti(progetto);
  const sottoRadice = file.filter((f) => f.percorso.startsWith(`${conBarre(config.radicePubblica)}/`));
  const inCucitura = file.filter((f) => f.percorso.startsWith(`${conBarre(config.cucitura)}/`));
  const letti = {
    file: file.length,
    radicePubblica: sottoRadice.length,
    cucitura: inCucitura.length,
    cartelle: [config.radicePubblica, config.cucitura],
  };
  const intestazione = `${letti.file} file letti sotto src/ · ${letti.radicePubblica} sotto ${conBarre(config.radicePubblica)} · ${letti.cucitura} nella cucitura ${conBarre(config.cucitura)}`;

  return {
    letti,
    config,
    errori: [],
    passi: [
      passoCucitura({ file, inCucitura, config, intestazione }),
      passoChiavi({ file, sottoRadice, config, intestazione }),
      passoA11y({ progetto, config, sottoRadice, inCucitura }),
    ],
  };
}

function passoCucitura({ file, inCucitura, config, intestazione }) {
  if (inCucitura.length === 0) {
    return passo(ID_AUDIT.cucitura, "cucitura dei componenti", "skipped",
      `${intestazione}\nla cucitura \`${conBarre(config.cucitura)}\` non esiste o non contiene nessun componente: non c'e' cucitura da verificare, e zero regole applicate non sono zero problemi`);
  }
  const findings = regolaCucitura(file, config);
  return conFindings(
    passo(ID_AUDIT.cucitura, "cucitura dei componenti", statoDaFindings(findings),
      dettaglio(intestazione, `primitive dichiarate: ${(config.primitive ?? []).join(", ")}`, findings)),
    findings);
}

function passoChiavi({ file, sottoRadice, config, intestazione }) {
  if (sottoRadice.length === 0) {
    return passo(ID_AUDIT.chiavi, "chiavi e client dei dati", "skipped",
      `${intestazione}\nnessun file sotto la radice pubblica \`${conBarre(config.radicePubblica)}\`: zero file letti non e' un \`pass\``);
  }
  const findings = regolaChiaviEClient(file, config);
  return conFindings(
    passo(ID_AUDIT.chiavi, "chiavi e client dei dati", statoDaFindings(findings),
      dettaglio(intestazione, `moduli client ammessi: ${(config.moduliClient ?? []).map(conBarre).join(", ") || "(nessuno)"}`, findings)),
    findings);
}

function passoA11y({ progetto, config, sottoRadice, inCucitura }) {
  const nome = "accessibilita' statica (jsx-a11y)";
  if (!existsSync(ESLINT)) {
    return passo(ID_AUDIT.a11y, nome, "skipped",
      `ESLint non installato nella cartella della skill: \`cd ${conBarre(SKILL_DIR)} && npm install\`. La configurazione viaggia con la skill perche' il gate deve dare lo stesso esito ovunque giri (DECISIONI.md §8)`);
  }
  const conJsx = [...sottoRadice, ...inCucitura].filter((f) => /\.[jt]sx$/i.test(f.percorso));
  if (conJsx.length === 0) {
    return passo(ID_AUDIT.a11y, nome, "skipped",
      "nessun file `.jsx`/`.tsx` sotto la radice pubblica o nella cucitura: non c'e' markup da giudicare");
  }
  const cartelle = [...new Set([config.radicePubblica, config.cucitura].map(conBarre))].filter((c) => existsSync(join(progetto, c)));
  const { errore, esiti } = eseguiEslint(progetto, cartelle);
  if (errore) return passo(ID_AUDIT.a11y, nome, "skipped", `ESLint non ha prodotto un esito leggibile: ${errore}`);

  const findings = findingsA11y(esiti, progetto);
  return conFindings(
    passo(ID_AUDIT.a11y, nome, statoDaFindings(findings),
      dettaglio(`${conJsx.length} file con markup lintati in ${cartelle.join(", ")}`, "", findings)),
    findings);
}

const passo = (id, name, status, detail) => ({ id, name, status, detail });

/** `counts` solo sui passi che hanno davvero guardato: un passo fermo su una
 *  premessa mancante non ha niente da contare, e una chiave a zero direbbe il
 *  contrario. */
function conFindings(base, findings) {
  if (base.status !== "skipped") base.counts = contaGravita(findings);
  base.findings = findings;
  return base;
}

const dettaglio = (...pezzi) => {
  const findings = pezzi.filter((p) => Array.isArray(p)).flat();
  const righeTesto = pezzi.filter((p) => typeof p === "string" && p.length > 0);
  const coda = findings.length > 0 ? dettaglioFindings(findings) : "nessun rilievo";
  return [...righeTesto, coda].join("\n");
};

function mancanti(motivo, config = null) {
  return {
    letti: null,
    config,
    errori: [motivo],
    passi: Object.values(ID_AUDIT).map((id) => passo(id, nomePasso(id), "skipped", motivo)),
  };
}

const nomePasso = (id) => ({
  [ID_AUDIT.cucitura]: "cucitura dei componenti",
  [ID_AUDIT.chiavi]: "chiavi e client dei dati",
  [ID_AUDIT.a11y]: "accessibilita' statica (jsx-a11y)",
}[id]);

// ------------------------------------------------------------------- main
function parseArgs(argv) {
  const args = { progetto: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--progetto") args.progetto = resolve(argv[++i] ?? "");
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.progetto) || !statSync(args.progetto).isDirectory()) {
    console.error(`Cartella inesistente: ${args.progetto}`);
    process.exit(2);
  }
  const esito = auditStatico({ progetto: args.progetto });

  if (args.json) {
    console.log(JSON.stringify({ contract: 1, progetto: conBarre(args.progetto), ...esito }, null, 2));
  } else {
    console.log(`AUDIT STATICO — ${conBarre(args.progetto)}\n`);
    for (const p of esito.passi) {
      console.log(`${{ pass: "OK  ", fail: "FAIL", skipped: "MANC" }[p.status]}  ${p.name}`);
      if (p.detail) for (const riga of p.detail.split("\n")) console.log(`        ${riga}`);
    }
  }
  // Uscita 0 SOLO se tutti e tre hanno guardato e non hanno trovato niente.
  // Trovato eseguendolo il 2026-08-02: con tre `skipped` il processo usciva 0,
  // cioe' «nessun bloccante» su un audit che non aveva letto un file. E' la
  // forma esatta del difetto che questa casa combatte da tre skill — uno
  // strumento che non ha letto niente esce 0 (DECISIONI.md §18) — e ce l'aveva
  // dentro il suo stesso guscio.
  const tuttoGuardato = esito.passi.every((p) => p.status === "pass");
  process.exit(tuttoGuardato ? 0 : 1);
}

// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 e chi legge il codice
// d'uscita crede di aver visto un verde. Misurato il 2026-08-02 su questa
// macchina (Node 20.12.2) sui gate delle altre tre skill, che escono 0 senza
// stampare niente. Questo confronto funziona ovunque.
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e questo guscio usciva 0 muto (misurato il
// 2026-08-04 sui cinque gate di questa casa, e su questo stesso file
// nell'istruttoria di P.0-igiene-2). `realpathSync` scioglie
// la junction; se solleva si ricade sul confronto testuale: mai un errore che
// ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
