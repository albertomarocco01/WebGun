import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

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
