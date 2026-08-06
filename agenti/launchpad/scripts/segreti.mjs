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

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contaGravita, decodifica, dettaglioFindings, esitoSegreti } from "./segreti-lib.mjs";
import { FUORI_DAL_PACCHETTO, gitRighe, leggiMessaggi, leggiStoria, trovaGit } from "./git-lib.mjs";

export const STORIA_DEFAULT = 200;

/**
 * LA RACCOLTA, in un posto solo — e non e' un gusto estetico.
 *
 * Fino al collaudo del 2026-08-06 questa lettura era scritta due volte: qui e
 * dentro `verify.mjs`. Le due copie sono divergute esattamente come la §7 di
 * `DECISIONI.md` prevede, e la copia rimasta indietro era quella di QUESTO
 * file — cioe' del comando che lo `SKILL.md` prescrive di lanciare **per
 * primo**, «perche' e' il solo che non si puo' rimediare dopo».
 *
 * Misurato, stesso repository e stesso commit, con una chiave `service_role`
 * dentro `src/lib/admin.ts` salvato in UTF-16:
 *
 *     verify.mjs  → passo `segreti` FAIL, 1 block
 *     segreti.mjs → «nessun bloccante», uscita 0
 *
 * `verify.mjs` decodificava con `decodifica()` (correzione SEG-1/IO-6 del
 * tribunale); qui si usava ancora `eBinario()` + `toString("utf8")`, e la
 * correzione non era mai arrivata. Ora la funzione e' una sola e la importano
 * tutti e due.
 */
export function leggiElenco(dir, elenco, { salta = false, maxByte = Infinity } = {}) {
  const letti = [];
  const binari = [];
  const nonLetti = [];
  for (const percorso of elenco ?? []) {
    if (salta && FUORI_DAL_PACCHETTO.test(percorso)) continue;
    try {
      const buf = readFileSync(join(dir, percorso));
      if (buf.length > maxByte) {
        nonLetti.push({ percorso, motivo: `${Math.round(buf.length / 1024)} KB, oltre la soglia di ${Math.round(maxByte / 1024)} KB` });
        continue;
      }
      const { testo, codifica } = decodifica(buf);
      if (testo === null) binari.push(percorso);
      else letti.push({ percorso, testo, codifica });
    } catch (e) {
      if (e?.code !== "ENOENT") nonLetti.push({ percorso, motivo: e?.code ?? "errore di lettura" });
    }
  }
  return { letti, binari, nonLetti };
}

export function raccogli(dir, storiaN) {
  const tracciati = gitRighe(dir, ["ls-files"]);
  if (tracciati === null) return null;
  const a = leggiElenco(dir, tracciati);
  // I file NUOVI e non ignorati: `git ls-files` non li elenca, e il gesto
  // successivo di chiunque e' `git add -A`. Vedi la nota in `esitoSegreti`.
  const nuovi = gitRighe(dir, ["ls-files", "--others", "--exclude-standard"]) ?? [];
  const b = leggiElenco(dir, nuovi, { salta: true });
  // Gli ignorati non partono con un deploy da git: si guardano lo stesso,
  // perche' un deploy da CLI carica la cartella di lavoro.
  const c = leggiElenco(dir, gitRighe(dir, ["ls-files", "--others", "--ignored", "--exclude-standard"]), { salta: true, maxByte: 512 * 1024 });
  return {
    tracciati,
    letti: a.letti,
    daTracciare: b.letti,
    ignorati: c.letti,
    binari: [...a.binari, ...b.binari],
    nonLetti: [...a.nonLetti, ...b.nonLetti, ...c.nonLetti],
    // Le regole sul NOME girano sui PERCORSI, prima e indipendentemente dalla
    // lettura (rilievo SEG-1): un file illeggibile non e' un file assolto.
    percorsi: [...tracciati, ...nuovi.filter((p) => !FUORI_DAL_PACCHETTO.test(p))],
    // La storia sono i diff **e** i messaggi: un segreto incollato in un
    // messaggio di commit viaggia col repository come un file.
    storia: [...leggiStoria(dir, storiaN), ...leggiMessaggi(dir, storiaN)],
  };
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
  console.log(`  ${riassunto.storia} pezzi di storia (file x commit, piu' i messaggi di commit e di tag) letti · ${riassunto.famiglie} famiglie cercate`);
  console.log(`  ${riassunto.nonLetti} file NON letti · regole sul nome applicate a ${raccolto.percorsi.length} percorsi, prima e indipendentemente dalla lettura`);
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
