import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CONTRATTO_JSON, ID, STORIA_DEFAULT } from "./verify.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (n) => readFileSync(join(QUI, n), "utf8");

/**
 * Gli `id` sono il contratto con l'orchestratore (DECISIONI.md §15).
 *
 * Senza questo test, riscrivere un'etichetta italiana per renderla piu' chiara
 * agli umani romperebbe in silenzio chi legge il `--json`: il costo di
 * migliorare la comunicazione sarebbe un guasto invisibile a valle.
 */
test("gli id dei nove passi e il loro ORDINE sono bloccati", () => {
  assert.deepEqual(Object.values(ID), [
    "radice-pulita",
    "catena-gate",
    "debito-bloccante",
    "segreti",
    "ambiente",
    "runtime-riproducibile",
    "impronta-artefatto",
    "runbook-firmato",
    "contratto-uscita",
  ]);
});

test("la versione del contratto `--json` e il default della storia sono dichiarati", () => {
  assert.equal(CONTRATTO_JSON, 1);
  assert.equal(STORIA_DEFAULT, 200);
});

/**
 * L'epilogo a doppio confronto, verificato sul SORGENTE.
 *
 * Non e' pedanteria: `import.meta.main` e' arrivato in Node 24 e su Node 20
 * vale `undefined` — il corpo non gira, il processo esce 0 e chi legge il
 * codice d'uscita crede di aver visto un verde. E il solo confronto testuale e'
 * FALSO quando lo script e' invocato dalla junction `.claude/skills/…`, dove
 * `argv[1]` resta il percorso della junction mentre `import.meta.url` e' gia'
 * canonico: stesso identico sintomo, uscita 0 muta. Non e' un'ipotesi: il
 * 2026-08-04 otto script di questa casa lo facevano davvero.
 */
for (const nome of ["verify.mjs", "segreti.mjs", "impronta.mjs"]) {
  test(`${nome}: epilogo a doppio confronto, e nessun \`import.meta.main\``, () => {
    const testo = sorgente(nome);
    const codice = testo
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((r) => !/^\s*\/\//.test(r))
      .join("\n");
    assert.ok(!/import\.meta\.main/.test(codice), "`import.meta.main` esce 0 muto su Node 20");
    assert.ok(/resolve\(process\.argv\[1\]\)/.test(codice), "serve il confronto su `argv[1]` risolto");
    assert.ok(/realpathSync\(/.test(codice), "serve il secondo confronto, che scioglie la junction");
    assert.ok(/try\s*\{\s*invocatoReale\s*=\s*realpathSync/.test(codice),
      "`realpathSync` va in un `try`: un errore che ammutolisce e' lo stesso guasto di prima");
  });
}

test("nessuno script indovina un indirizzo: `--url` non ha un default cablato", () => {
  for (const nome of ["verify.mjs", "impronta.mjs"]) {
    const codice = sorgente(nome).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((r) => !/^\s*\/\//.test(r)).join("\n");
    assert.ok(!/url:\s*["']http/.test(codice), `${nome}: un gate che indovina localhost:3000 misura l'app di un altro progetto`);
  }
});
