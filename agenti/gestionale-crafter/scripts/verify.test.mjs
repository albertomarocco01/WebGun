import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTRATTO_JSON,
  ID,
  dettaglioEsecuzione,
  formaEseguibile,
  leggiAudit,
  riepilogo,
  scegliEseguibile,
} from "./verify.mjs";

// Gli `id` sono il CONTRATTO con l'orchestratore: l'etichetta italiana e' per
// gli umani e puo' cambiare, l'id no. Senza questo test, riscrivere un'etichetta
// per renderla piu' chiara romperebbe in silenzio chi legge il `--json`.
describe("contratto degli id", () => {
  it("gli id sono questi e in quest'ordine", () => {
    assert.deepEqual(Object.values(ID), [
      "config",
      "entities",
      "admin-audit",
      "types-fresh",
      "tsc",
      "a11y",
      "handoff",
    ]);
  });

  it("il numero di contratto e' dichiarato", () => {
    assert.equal(typeof CONTRATTO_JSON, "number");
  });

  it("gli id non si possono riscrivere per sbaglio", () => {
    assert.throws(() => {
      ID.config = "altro";
    }, TypeError);
  });
});

describe("riepilogo", () => {
  it("conta i passi per stato", () => {
    assert.deepEqual(
      riepilogo([{ status: "pass" }, { status: "fail" }, { status: "skipped" }, { status: "pass" }]),
      { passi: 4, pass: 2, fail: 1, skipped: 1 },
    );
  });
});

describe("leggiAudit", () => {
  const buono = JSON.stringify({ summary: { block: 0 }, findings: [], misure: { rotte: 1 } });

  it("legge un documento conforme", () => {
    assert.equal(leggiAudit(buono).doc.misure.rotte, 1);
  });

  it("un'uscita non-JSON non fa crashare il gate", () => {
    const { errore } = leggiAudit("Error: psql non trovato");
    assert.match(errore, /non interpretabile come JSON/);
  });

  it("un JSON senza `misure` non e' utilizzabile", () => {
    const { errore } = leggiAudit(JSON.stringify({ summary: {}, findings: [] }));
    assert.match(errore, /contratto non rispettato/);
  });

  it("un JSON con `findings` che non e' un elenco non passa", () => {
    const { errore } = leggiAudit(JSON.stringify({ summary: {}, findings: "niente", misure: {} }));
    assert.ok(errore);
  });
});

// Il guasto misurato il 2026-07-28: `where npx` risponde PRIMA con lo script sh
// senza estensione, che `spawnSync` senza shell non esegue. Prendendo la prima
// riga, i passi `tsc` e `a11y` fallivano col dettaglio vuoto su una macchina
// dove entrambi funzionano.
describe("scegliEseguibile", () => {
  it("preferisce .exe", () => {
    assert.equal(scegliEseguibile(["C:/x/tool", "C:/x/tool.exe"]), "C:/x/tool.exe");
  });

  it("in mancanza di .exe prende lo shim .cmd, non lo script senza estensione", () => {
    assert.equal(scegliEseguibile(["C:/nodejs/npx", "C:/nodejs/npx.cmd"]), "C:/nodejs/npx.cmd");
  });

  it("se c'e' solo un candidato, quello e'", () => {
    assert.equal(scegliEseguibile(["/usr/bin/npx"]), "/usr/bin/npx");
  });

  it("nessun candidato: null, non una stringa vuota", () => {
    assert.equal(scegliEseguibile(["", "  "]), null);
  });
});

describe("formaEseguibile", () => {
  it("fuori da Windows non tocca niente", () => {
    assert.deepEqual(formaEseguibile("npx", () => "C:/x/npx.cmd", "linux"), {
      file: "npx",
      prefisso: [],
    });
  });

  it("su Windows uno shim .cmd si lancia con cmd.exe /c", () => {
    assert.deepEqual(formaEseguibile("npx", () => "C:/x/npx.cmd", "win32"), {
      file: "cmd.exe",
      prefisso: ["/c", "C:/x/npx.cmd"],
    });
  });

  it("un .exe si lancia direttamente", () => {
    assert.deepEqual(formaEseguibile("psql", () => "C:/x/psql.exe", "win32"), {
      file: "C:/x/psql.exe",
      prefisso: [],
    });
  });

  it("se `where` non trova niente si prova col nome nudo", () => {
    assert.deepEqual(formaEseguibile("tool", () => null, "win32"), { file: "tool", prefisso: [] });
  });
});

// Un `fail` col dettaglio vuoto non dice da dove ricominciare: e' il modo in cui
// un gate diventa rumore.
describe("dettaglioEsecuzione", () => {
  it("riporta l'errore quando il processo non e' partito", () => {
    const testo = dettaglioEsecuzione({ error: new Error("spawn EINVAL") });
    assert.match(testo, /non e' partito.*EINVAL/);
  });

  it("preferisce stdout a stderr", () => {
    assert.equal(dettaglioEsecuzione({ stdout: "uno", stderr: "due" }), "uno");
  });

  it("non restituisce mai una stringa vuota", () => {
    assert.equal(dettaglioEsecuzione({ stdout: "", stderr: "" }), "nessuna uscita dallo strumento");
  });

  it("tronca le uscite lunghe", () => {
    const lunga = Array.from({ length: 50 }, (_, i) => `riga ${i}`).join("\n");
    assert.equal(dettaglioEsecuzione({ stdout: lunga }, 3).split("\n").length, 3);
  });
});

// Il difetto: `if (import.meta.main) main();`. `import.meta.main` e' arrivato in
// Node 24; su Node 20 vale `undefined`, quindi `main()` non veniva chiamata e il
// gate USCIVA 0 SENZA STAMPARE UNA RIGA — un verde che non aveva guardato
// niente, per chiunque lo lanciasse col Node di sistema di questa macchina.
// Misurato il 2026-08-03: Node 20.12.2 → uscita 0, zero righe; Node 24.18.1 →
// uscita 2 e il messaggio. La skill dichiara «Node >= 20»: era il codice a
// violare il proprio contratto.
//
// I test sono DUE perche' proteggono due cose diverse, e nessuno dei due basta:
//
//  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
//    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
//    mai): lancia il gate per davvero e pretende che parli. Ma gira con
//    `process.execPath`, cioe' col Node della suite: su Node 24 QUESTO difetto
//    specifico non lo vedrebbe, perche' li' `import.meta.main` funziona;
//  - lo STATICO e' l'unico che impedisce il ritorno del difetto su QUALUNQUE
//    Node, perche' non esegue niente: vieta il token nel sorgente. E' brutale, e
//    va bene cosi' — finche' il prerequisito dichiarato e' Node >= 20, quel
//    token qui dentro non ha nessun uso legittimo.
describe("l'epilogo che non parte (2026-08-03)", () => {
  const VERIFY = fileURLToPath(new URL("./verify.mjs", import.meta.url));

  it("il gate parla anche fuori da un progetto: mai un'uscita 0 muta", () => {
    const dir = mkdtempSync(join(tmpdir(), "gestionale-crafter-epilogo-"));
    try {
      const res = spawnSync(process.execPath, [VERIFY], { cwd: dir, encoding: "utf8" });
      const uscita = `${res.stdout}${res.stderr}`.trim();
      // Qui non c'e' `src/`: il gate esce 2 (errore di esecuzione) dicendo
      // perche'. Si asserisce «diverso da 0», non «uguale a 2»: il difetto da
      // fermare e' il silenzio che si travestiva da verde.
      assert.notEqual(res.status, 0,
        `uscita 0 fuori da un progetto: il gate non ha guardato niente e sembra verde (uscita ${res.status})`);
      assert.notEqual(uscita, "",
        "il gate non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("il sorgente del gate non contiene `import.meta.main`", () => {
    const righeDiCodice = readFileSync(VERIFY, "utf8")
      .split(/\r?\n/)
      // Le righe di commento non eseguono: il commento dell'epilogo NOMINA il
      // token proprio per spiegare perche' non si usa, e deve poterlo fare.
      .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga));
    const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));
    assert.deepEqual(colpevoli, [],
      "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il gate esce 0 muto");
  });
});
