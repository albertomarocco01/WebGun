/**
 * verify.test.mjs — Il guscio del gate: gli id, il loro ordine, il contratto
 * `--json` e i tre stati.
 *
 * Perche' un test sugli id: sono l'unica cosa a cui l'orchestratore si aggancia
 * (DECISIONI.md §15). Rinominare un'etichetta italiana per renderla piu' chiara
 * deve restare gratis; cambiare un `id` no. E l'ORDINE conta quanto gli id: il
 * gate misura le premesse prima degli esiti, e un passo spostato piu' avanti
 * cambia cosa il gate ha guardato quando decide.
 *
 * Le due prove d'integrazione lanciano `verify.mjs` per davvero su una cartella
 * temporanea: e' l'unico modo di verificare che «premessa assente» produca
 * MANCANTE e non un `pass`, perche' quella decisione vive nel guscio.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CONTRATTO_JSON, ID, PASSI, riepilogo } from "./verify.mjs";

const VERIFY = fileURLToPath(new URL("./verify.mjs", import.meta.url));

// I sette id, in quest'ordine. Se questa lista cambia, cambia il contratto:
// va alzato `CONTRATTO_JSON` e avvisato chi legge il `--json`.
const ORDINE_ATTESO = [
  "flussi-critici",
  "spec-coverage",
  "lint-spec",
  "effetto-db",
  "app-viva",
  "playwright",
  "contratto-uscita",
];

test("i sette id sono quelli del contratto, in quest'ordine", () => {
  assert.deepEqual(PASSI.map((p) => p.id), ORDINE_ATTESO);
});

test("la tabella ID non ha valori a sorpresa", () => {
  assert.deepEqual(Object.values(ID).sort(), [...ORDINE_ATTESO].sort());
});

test("il riepilogo conta per stato, non per prosa", () => {
  assert.deepEqual(
    riepilogo([{ status: "pass" }, { status: "fail" }, { status: "skipped" }, { status: "pass" }]),
    { passi: 4, pass: 2, fail: 1, skipped: 1 });
});

// ------------------------------------------------------------- integrazione

function progettoTemporaneo(prepara) {
  const dir = mkdtempSync(join(tmpdir(), "flow-sentinel-"));
  prepara(dir);
  return dir;
}

const lancia = (dir, ...args) =>
  spawnSync(process.execPath, [VERIFY, ...args], { cwd: dir, encoding: "utf8" });

test("progetto senza contratto e senza spec: sette passi, tutti MANCANTI tranne l'ultimo, gate rosso", () => {
  const dir = progettoTemporaneo((d) => mkdirSync(join(d, "docs"), { recursive: true }));
  try {
    const res = lancia(dir, "--json");
    assert.equal(res.status, 1, "gate rosso");
    const doc = JSON.parse(res.stdout);
    assert.equal(doc.contract, CONTRATTO_JSON);
    assert.equal(doc.ok, false);
    assert.deepEqual(doc.steps.map((s) => s.id), ORDINE_ATTESO, "id e ordine anche nell'uscita vera");
    // nessuna premessa c'e': sei verifiche mancanti, mai un `pass`
    assert.deepEqual(doc.steps.map((s) => s.status),
      ["skipped", "skipped", "skipped", "skipped", "skipped", "skipped", "fail"]);
    assert.deepEqual(doc.summary, { passi: 7, pass: 0, fail: 1, skipped: 6 });
    assert.match(doc.steps[0].detail, /assente/);
    assert.match(doc.steps[5].detail, /nessun file di spec/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un contratto senza riga `Confermato da:` e' MANCANTE, non un passo superato", () => {
  const dir = progettoTemporaneo((d) => {
    mkdirSync(join(d, "docs"), { recursive: true });
    writeFileSync(join(d, "docs", "flussi-critici.md"), "# Flussi\n\n## `accesso-staff` — positivo\n");
  });
  try {
    const doc = JSON.parse(lancia(dir, "--json").stdout);
    assert.equal(doc.steps[0].status, "skipped");
    assert.match(doc.steps[0].detail, /Confermato da/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fuori da un progetto l'uscita e' 2 (errore di esecuzione), e non c'e' JSON", () => {
  const dir = progettoTemporaneo(() => {});
  try {
    const res = lancia(dir, "--json");
    assert.equal(res.status, 2);
    assert.equal(res.stdout.trim(), "");
    assert.match(res.stderr, /non c'e' batteria da verificare/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
