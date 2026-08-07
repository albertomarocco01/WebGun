#!/usr/bin/env node
// Una classe sola, e l'uscita UMANA del gate — non il `--json` di `giro.mjs`.
// Serve quando `giro.mjs` dice «ROSSO su questo passo» e si vuole leggere cosa
// stampa il gate a chi lo lancia davvero.
//
//   node uno.mjs <CLASSE>            # es. node uno.mjs SUP1
//
// Vive accanto al gate che processa (D25, 2026-08-07). La cartella di lavoro
// nasce sotto `banco-prova-collaudo-sd/`, coperta dalla regola `banco-prova*/`
// di `.gitignore`.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const BANCO = join(QUI, "banco-sl.mjs");
const DIR = join(QUI, "banco-prova-collaudo-sd", "sabotato");
const PORTA = 3882;
const classe = process.argv[2];

if (!classe) {
  process.stderr.write("uso: node uno.mjs <CLASSE>   (l'elenco: node banco-sl.mjs --elenco)\n");
  process.exit(2);
}

// `--sabota` non rigenera: senza questa riga, da un clone pulito il banco
// risponde 404 su tutto (vedi `giro.mjs` §generaSeManca).
if (!existsSync(join(DIR, "docs", "conformita.md"))) {
  const g = spawnSync(process.execPath, [BANCO, "--dir", DIR, "--porta", String(PORTA)], { encoding: "utf8" });
  if (g.status !== 0) {
    process.stderr.write(`generazione fallita (uscita ${g.status}): ${g.stderr || g.stdout}\n`);
    process.exit(2);
  }
}

const s = spawn(
  process.execPath,
  [join(QUI, "banco-sl.mjs"), "--dir", DIR, "--porta", String(PORTA), "--servi", "--sabota", classe],
  { stdio: "ignore" },
);

// La premessa si misura prima dell'esito: dev'essere IL banco che ho acceso io,
// non un server rimasto vivo da prima sulla stessa porta (`giro.mjs` §vivo).
let su = false;
for (let i = 0; i < 60 && !su; i += 1) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA}/`, { signal: AbortSignal.timeout(500) });
    su = r.ok && r.headers.get("x-banco-sabotaggio") === classe;
  } catch {
    /* non ancora */
  }
  if (!su) await new Promise((r) => setTimeout(r, 250));
}

if (!su) {
  process.stderr.write(`PREMESSA-MANCANTE: il banco ${classe} non risponde sulla ${PORTA}: nessun verdetto\n`);
  s.kill();
  process.exit(2);
}

const r = spawnSync(process.execPath, [join(QUI, "verify.mjs"), "--url", `http://127.0.0.1:${PORTA}`], {
  cwd: DIR,
  encoding: "utf8",
  timeout: 180000,
});
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
s.kill();
process.exit(r.status ?? 1);
