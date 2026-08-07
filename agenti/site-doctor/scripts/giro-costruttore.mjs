#!/usr/bin/env node
// Audit delle affermazioni: rilancia le 25 classi di sabotaggio DEL COSTRUTTORE
// contro il gate corretto dal collaudo, e confronta con le uscite incollate in
// `COSTRUZIONE-2026-08-06.md` §6.2.
//
// La premessa si misura come nel mio giro: il banco che risponde dev'essere
// quello che ho acceso io.
//
//   node giro-costruttore.mjs
//
// Vive accanto ai due file che processa (D25, 2026-08-07). La cartella di
// lavoro nasce sotto `banco-prova-collaudo-sd/`, coperta dalla regola
// `banco-prova*/` di `.gitignore`.

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const BANCO = join(QUI, "banco.mjs");
const GATE = join(QUI, "verify.mjs");
const DIR = join(QUI, "banco-prova-collaudo-sd", "banco-costruttore");
const PORTA = 3882;

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const CLASSI = ["", ...("ABCDEFGHIJKLMNOPQRSTUVWXY".split(""))];

for (const classe of CLASSI) {
  const args = [BANCO, "--dir", DIR, "--porta", String(PORTA)];
  if (classe) args.push("--sabota", classe);
  const server = spawn(process.execPath, args, { stdio: "ignore" });
  let su = false;
  for (let i = 0; i < 60 && !su; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/`, { signal: AbortSignal.timeout(500) });
      su = r.ok || r.status === 404;
    } catch {
      /* non ancora */
    }
    if (!su) await attendi(250);
  }
  if (!su) {
    process.stdout.write(`${(classe || "(conforme)").padEnd(12)} PREMESSA-MANCANTE: nessun verdetto\n`);
    server.kill();
    await attendi(300);
    continue;
  }
  const r = spawnSync(process.execPath, [GATE, "--url", `http://127.0.0.1:${PORTA}`, "--json"], {
    cwd: DIR, encoding: "utf8", timeout: 120000,
  });
  let doc = null;
  try {
    doc = JSON.parse(r.stdout);
  } catch {
    process.stdout.write(`${(classe || "(conforme)").padEnd(12)} USCITA-NON-JSON uscita=${r.status}\n`);
    server.kill();
    await attendi(300);
    continue;
  }
  const s = doc.summary;
  const rotti = doc.steps.filter((x) => x.status !== "pass" && x.status !== "n/a").map((x) => `${x.id}:${x.status}`);
  process.stdout.write(
    `${(classe || "(conforme)").padEnd(12)} ${(doc.ok ? "VERDE" : "ROSSO").padEnd(6)} uscita=${r.status} pass=${s.pass} fail=${s.fail} manc=${s.skipped} na=${s.na}  ${rotti.join(" ")}\n`,
  );
  server.kill();
  await attendi(350);
}
