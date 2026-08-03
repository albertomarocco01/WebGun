/**
 * Test del guscio del gate della regia: gli `id` dei passi, il loro ORDINE, il
 * contratto `--json` e i due modi in cui un gate puo' tacere.
 *
 * L'ordine non e' un dettaglio estetico: e' il gate. L'`id` e' l'unica cosa su
 * cui un orchestratore si aggancia, quindi rinominarlo o riordinarlo rompe a
 * valle in silenzio (DECISIONI.md §15).
 *
 * I DUE TEST SULL'EPILOGO sono la forma di P.0-igiene, e sono due apposta:
 *   - funzionale — il gate lanciato in una cartella che non e' la regia deve
 *     uscire ≠ 0 E stampare qualcosa;
 *   - statico — il sorgente non contiene `import.meta.main` vivo.
 * Il funzionale da solo non basta: su Node 24 `import.meta.main` funziona, e il
 * difetto (il gate che esce 0 muto su Node 20) resterebbe invisibile.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

import { righeDiCodice } from "./regia-lib.mjs";
import { CONTRATTO_JSON, ID, riepilogo } from "./verifica-regia.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const GATE = join(QUI, "verifica-regia.mjs");
const temporanee = [];
const cartellaUsaEGetta = (prefisso) => {
  const dir = mkdtempSync(join(tmpdir(), prefisso));
  temporanee.push(dir);
  return dir;
};
after(() => { for (const dir of temporanee) rmSync(dir, { recursive: true, force: true }); });

const lancia = (cwd, ...args) => spawnSync(process.execPath, [GATE, ...args], { cwd, encoding: "utf8" });

describe("gli id dei passi e il loro ordine", () => {
  const ATTESI = ["docx-txt", "skill-elencate", "stato-presente", "epiloghi-vivi", "segnaposto-radice"];

  it("sono cinque, questi, e in quest'ordine", () => {
    assert.deepEqual(Object.values(ID), ATTESI);
  });

  it("il contratto `--json` ha un numero di versione", () => {
    assert.equal(CONTRATTO_JSON, 1);
  });

  it("il riepilogo conta per stato, e `skipped` non e' `pass`", () => {
    const passi = [{ status: "pass" }, { status: "fail" }, { status: "skipped" }, { status: "pass" }];
    assert.deepEqual(riepilogo(passi), { passi: 4, pass: 2, fail: 1, skipped: 1 });
  });
});

describe("l'epilogo: il gate parla anche quando rifiuta", () => {
  it("funzionale — in una cartella che non e' la regia esce 2 e NON e' muto", () => {
    const fuori = cartellaUsaEGetta("regia-vuota-");
    const res = lancia(fuori);
    assert.equal(res.status, 2, "una cartella qualunque non e' la regia: il gate deve rifiutare, non giudicare");
    assert.ok((res.stdout + res.stderr).trim().length > 0, "un gate che esce senza stampare niente e' un gate che nessuno sa se ha girato");
    assert.match(res.stderr, /non e' la radice della regia/);
  });

  it("statico — il sorgente del gate non contiene `import.meta.main` vivo", () => {
    // Su Node 24 il test funzionale qui sopra passerebbe anche col difetto
    // dentro: `import.meta.main` li' funziona. Questo lo vede lo stesso.
    const colpevoli = righeDiCodice(readFileSync(GATE, "utf8")).filter((r) => r.codice.includes("import.meta.main"));
    assert.deepEqual(colpevoli, [],
      "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il gate esce 0 muto");
  });
});

describe("il contratto --json su una regia finta", () => {
  /** Una regia minima: CLAUDE.md, README.md con le due sezioni, un agente, lo
   *  script di installazione. Non c'e' il `.docx`, quindi `docx-txt` deve
   *  chiudere MANCANTE — ed e' proprio quello che si vuole vedere: una verifica
   *  che non si e' potuta fare non e' una verifica superata. */
  function regiaFinta() {
    const radice = cartellaUsaEGetta("regia-finta-");
    mkdirSync(join(radice, "agenti", "attrezzo", "scripts"), { recursive: true });
    mkdirSync(join(radice, "scripts"), { recursive: true });
    writeFileSync(join(radice, "CLAUDE.md"), "# contratto\n");
    writeFileSync(join(radice, "README.md"), [
      "## Natura degli agenti",
      "",
      "| Nome | Categoria | Stato | Proprietario | Repo di origine |",
      "|---|---|---|---|---|",
      "| attrezzo | Skill Claude Code | 🟢 | Alberto | questo repo |",
      "",
      "## Installazione delle skill",
      "",
      "Installa **attrezzo** — la sola vera.",
      "",
    ].join("\n"));
    writeFileSync(join(radice, "agenti", "attrezzo", "STATO.md"), "# stato\n");
    writeFileSync(join(radice, "agenti", "attrezzo", "scripts", "verify.mjs"), "// niente epilogo qui\n");
    writeFileSync(join(radice, "scripts", "installa-skill.ps1"), '$skill = @("attrezzo")\n');
    return radice;
  }

  it("stampa un JSON con contract, ok, summary e i cinque passi in ordine", () => {
    const res = lancia(regiaFinta(), "--json");
    const documento = JSON.parse(res.stdout);
    assert.equal(documento.contract, 1);
    assert.deepEqual(documento.steps.map((s) => s.id), Object.values(ID));
    assert.equal(documento.summary.passi, 5);
  });

  it("senza il `.docx` il passo e' `skipped`, il gate e' ROSSO e l'uscita e' 1", () => {
    const res = lancia(regiaFinta(), "--json");
    const documento = JSON.parse(res.stdout);
    const docx = documento.steps.find((s) => s.id === "docx-txt");
    assert.equal(docx.status, "skipped");
    assert.equal(documento.ok, false, "quattro `pass` e un `skipped` e' rosso");
    assert.equal(res.status, 1);
  });

  it("gli altri quattro passi chiudono verdi su una regia coerente", () => {
    const documento = JSON.parse(lancia(regiaFinta(), "--json").stdout);
    for (const passo of documento.steps.filter((s) => s.id !== "docx-txt")) {
      assert.equal(passo.status, "pass", `${passo.id} doveva passare:\n${passo.detail}`);
    }
  });

  it("una regia INCOERENTE diventa rossa, e il rilievo dice chi manca dove", () => {
    const radice = regiaFinta();
    // Lo script smette di installare l'unica skill 🟢 che il README dichiara:
    // e' il difetto del 2026-07-30, in miniatura.
    writeFileSync(join(radice, "scripts", "installa-skill.ps1"), '$skill = @()\n');
    // ...e un secondo agente di casa arriva senza `STATO.md`.
    mkdirSync(join(radice, "agenti", "smemorato"), { recursive: true });
    const documento = JSON.parse(lancia(radice, "--json").stdout);
    const skill = documento.steps.find((s) => s.id === "skill-elencate");
    const stato = documento.steps.find((s) => s.id === "stato-presente");
    assert.equal(skill.status, "skipped", "un array `$skill = @()` non e' un elenco: e' un elenco non trovato");
    assert.equal(stato.status, "fail");
    assert.equal(stato.counts.block, 1);
    assert.match(stato.detail, /smemorato/);
  });

  it("un `import.meta.main` vivo in un agente di casa accende `epiloghi-vivi`", () => {
    const radice = regiaFinta();
    writeFileSync(join(radice, "agenti", "attrezzo", "scripts", "verify.mjs"), "if (import.meta.main) main();\n");
    const documento = JSON.parse(lancia(radice, "--json").stdout);
    const epiloghi = documento.steps.find((s) => s.id === "epiloghi-vivi");
    assert.equal(epiloghi.status, "fail");
    assert.match(epiloghi.detail, /agenti\/attrezzo\/scripts\/verify\.mjs:1/);
  });

  it("il bersaglio si stampa anche sui passi verdi (DECISIONI.md §11)", () => {
    const documento = JSON.parse(lancia(regiaFinta(), "--json").stdout);
    const stato = documento.steps.find((s) => s.id === "stato-presente");
    assert.equal(stato.status, "pass");
    assert.match(stato.detail, /cartelle in agenti\//, "un verde che non dice cosa ha guardato non e' verificabile");
  });
});
