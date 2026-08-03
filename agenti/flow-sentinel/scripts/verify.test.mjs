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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// -------------------------------------------------- l'epilogo che non parte
//
// Il difetto (2026-08-03): `if (import.meta.main) await main();`.
// `import.meta.main` e' arrivato in Node 24; su Node 20 vale `undefined`,
// quindi `main()` non veniva chiamata e il gate USCIVA 0 SENZA STAMPARE UNA
// RIGA — un verde che non aveva guardato niente, per chiunque lo lanciasse col
// Node di sistema di questa macchina. Misurato il 2026-08-03: Node 20.12.2 →
// uscita 0, zero righe; Node 24.18.1 → uscita 2 e il messaggio. La skill
// dichiara «Node >= 20»: era il codice a violare il proprio contratto. Questo
// gate lo pagava due volte: `speed-demon` lo lancia come sottoprocesso con il
// `node` del PATH per il suo passo `rete-verde`, e da un gate muto ricavava «non
// ha prodotto JSON leggibile», cioe' una verifica MANCANTE per colpa d'altri.
//
// I test sono DUE perche' proteggono due cose diverse, e nessuno dei due basta:
//
//  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
//    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
//    mai): lancia il gate per davvero e pretende che parli. Ma gira con
//    `process.execPath`, cioe' col Node della suite: su Node 24 QUESTO difetto
//    specifico non lo vedrebbe, perche' li' `import.meta.main` funziona. Il test
//    qui sopra ne e' il parente stretto — nato per un'altra domanda («premessa
//    assente non e' un pass») e legato al testo di UN messaggio; questo asserisce
//    l'invariante nuda, e resta valido anche se quel messaggio cambia;
//  - lo STATICO e' l'unico che impedisce il ritorno del difetto su QUALUNQUE
//    Node, perche' non esegue niente: vieta il token nel sorgente. E' brutale, e
//    va bene cosi' — finche' il prerequisito dichiarato e' Node >= 20, quel
//    token qui dentro non ha nessun uso legittimo.

test("il gate parla anche fuori da un progetto: mai un'uscita 0 muta", () => {
  const dir = progettoTemporaneo(() => {});
  try {
    const res = lancia(dir);
    const uscita = `${res.stdout}${res.stderr}`.trim();
    // Si asserisce «diverso da 0», non «uguale a 2»: il difetto da fermare e' il
    // silenzio che si travestiva da verde, non il valore del codice d'errore.
    assert.notEqual(res.status, 0,
      `uscita 0 fuori da un progetto: il gate non ha guardato niente e sembra verde (uscita ${res.status})`);
    assert.notEqual(uscita, "",
      "il gate non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("il sorgente del gate non contiene `import.meta.main`", () => {
  const righeDiCodice = readFileSync(VERIFY, "utf8")
    .split(/\r?\n/)
    // Le righe di commento non eseguono: il commento dell'epilogo NOMINA il
    // token proprio per spiegare perche' non si usa, e deve poterlo fare.
    .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga));
  const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));
  assert.deepEqual(colpevoli, [],
    "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il gate esce 0 muto");
});
