/**
 * Test dei gusci: gli `id` dei passi, il loro ORDINE, il verdetto a quattro
 * stati, e i tre test dell'epilogo per ognuno dei due eseguibili.
 *
 * L'ordine non e' un dettaglio estetico: e' il gate. Un passo spostato piu'
 * avanti cambia cosa il gate aveva guardato nel momento in cui ha deciso — e
 * l'`id` e' l'unica cosa su cui un orchestratore si aggancia, quindi rinominarlo
 * o riordinarlo rompe a valle in silenzio (`DECISIONI.md` §15).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CLASSI } from "./banco.mjs";
import { ATTESA_MS, CONTRATTO_JSON, ID, MAX_PAGINE, riepilogo, STATI } from "./verify.mjs";

describe("gli id dei passi e il loro ordine", () => {
  const ATTESI = [
    "certificato",
    "superficie-pubblica",
    "informativa-privacy",
    "dati-raccolti",
    "archiviazione-client",
    "accessibilita-servita",
    "lingua-e-hreflang",
    "perimetro",
    "contratto-uscita",
  ];

  it("sono nove, questi, e in quest'ordine", () => {
    assert.deepEqual(Object.values(ID), ATTESI);
  });

  it("`superficie-pubblica` viene prima di tutti i passi che leggono l'app", () => {
    // Se qualcuno lo sposta dopo, i passi che consumano la superficie
    // leggerebbero un'app di cui nessuno ha stabilito l'identita'.
    const i = ATTESI.indexOf("superficie-pubblica");
    for (const dopo of ["informativa-privacy", "dati-raccolti", "archiviazione-client", "accessibilita-servita", "lingua-e-hreflang"]) {
      assert.ok(ATTESI.indexOf(dopo) > i, `${dopo} deve venire dopo superficie-pubblica`);
    }
  });

  it("`perimetro` viene dopo i passi che misurano: confronta il dichiarato con questa esecuzione", () => {
    const i = ATTESI.indexOf("perimetro");
    for (const prima of ["informativa-privacy", "dati-raccolti", "archiviazione-client", "accessibilita-servita", "lingua-e-hreflang"]) {
      assert.ok(ATTESI.indexOf(prima) < i, `${prima} deve venire prima di perimetro`);
    }
  });

  it("`contratto-uscita` e' l'ultimo: guarda gli otto precedenti", () => {
    assert.equal(ATTESI[ATTESI.length - 1], "contratto-uscita");
  });

  it("il numero di contratto del `--json` e i limiti sono dichiarati", () => {
    assert.equal(CONTRATTO_JSON, 1);
    assert.ok(Number.isInteger(MAX_PAGINE) && MAX_PAGINE > 0);
    assert.ok(Number.isInteger(ATTESA_MS) && ATTESA_MS > 0, "senza timeout un gate puo' restare appeso invece che verde o rosso");
  });
});

describe("riepilogo e verdetto a quattro stati", () => {
  it("conta i quattro stati", () => {
    const passi = [{ status: "pass" }, { status: "pass" }, { status: "fail" }, { status: "skipped" }, { status: "n/a" }];
    assert.deepEqual(riepilogo(passi), { passi: 5, pass: 2, fail: 1, skipped: 1, na: 1, ignoti: 0 });
  });

  it("gli stati ammessi sono quattro, e sono questi", () => {
    assert.deepEqual([...STATI], ["pass", "fail", "skipped", "n/a"]);
  });

  it("falso verde: uno stato scritto male non sparisce dal conteggio", () => {
    // Senza `ignoti`, un `record(..., "skip", ...)` non sarebbe contato ne' fra
    // i falliti ne' fra i mancanti, e il gate uscirebbe VERDE: un refuso di un
    // carattere trasformava questo gate in un timbro.
    const r = riepilogo([...Array(8).fill({ status: "pass" }), { status: "skip" }]);
    assert.equal(r.ignoti, 1);
    assert.equal(r.fail === 0 && r.skipped === 0 && r.ignoti === 0, false);
  });

  it("otto `pass` e uno `skipped` NON sono un verde", () => {
    const r = riepilogo([...Array(8).fill({ status: "pass" }), { status: "skipped" }]);
    assert.equal(r.fail === 0 && r.skipped === 0, false);
  });

  it("otto `pass` e un `n/a` SONO un verde: non applicabile e' una risposta finita", () => {
    const r = riepilogo([...Array(8).fill({ status: "pass" }), { status: "n/a" }]);
    assert.equal(r.fail === 0 && r.skipped === 0, true);
  });
});

describe("il banco copre ogni passo che dichiara di provare", () => {
  it("ogni passo che misura ha almeno una classe di sabotaggio", () => {
    const testo = Object.values(CLASSI).join(" ");
    for (const id of Object.values(ID)) {
      if (id === "certificato") continue; // provato dalla sua assenza sul pilota
      assert.ok(testo.includes(id), `nessuna classe di sabotaggio punta a \`${id}\``);
    }
  });

  it("le classi hanno una lettera sola e non si ripetono", () => {
    const chiavi = Object.keys(CLASSI);
    assert.deepEqual(chiavi, [...new Set(chiavi)]);
    assert.ok(chiavi.every((k) => /^[A-Z]$/.test(k)));
  });
});

// ---------------------------------------------------------------- l'epilogo
// TRE test per guscio, perche' proteggono tre cose diverse e nessuno basta:
//  - il FUNZIONALE copre la classe «l'epilogo non parte» qualunque ne sia la
//    causa: lancia il guscio e pretende che parli. Ma gira per il percorso
//    REALE del file: cieco alla junction;
//  - lo STATICO vieta `import.meta.main` nel sorgente e non esegue niente: e'
//    l'unico che regge su QUALUNQUE Node. Cieco al difetto del 2026-08-04, che
//    quel token non lo contiene — la riga colpevole era la forma «giusta»;
//  - il JUNCTION invoca il guscio attraverso una junction vera. E' l'unico che
//    vede il difetto di P.0-igiene-2: li' `argv[1]` resta il percorso della
//    junction mentre `import.meta.url` e' gia' canonico, e il confronto secco
//    era falso (`PILOTA-PRE-2026-08-04.md` §2b).

const GUSCI = [
  { file: "verify.mjs", chi: "il gate" },
  { file: "banco.mjs", chi: "il banco" },
];

for (const { file, chi } of GUSCI) {
  describe(`l'epilogo di ${file} deve partire`, () => {
    const GUSCIO = fileURLToPath(new URL(`./${file}`, import.meta.url));
    const SKILL_DIR = dirname(dirname(GUSCIO));

    it(`${chi} parla anche fuori da un progetto: mai un'uscita 0 muta`, () => {
      const dir = mkdtempSync(join(tmpdir(), "site-doctor-epilogo-"));
      try {
        const res = spawnSync(process.execPath, [GUSCIO], { cwd: dir, encoding: "utf8" });
        const uscita = `${res.stdout}${res.stderr}`.trim();
        assert.notEqual(res.status, 0, `uscita 0 fuori da un progetto: ${chi} non ha guardato niente e sembra verde`);
        assert.notEqual(uscita, "", `${chi} non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge`);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it(`il sorgente di ${file} non contiene \`import.meta.main\``, () => {
      const righeDiCodice = readFileSync(GUSCIO, "utf8")
        .split(/\r?\n/)
        // Le righe di commento non eseguono: il commento dell'epilogo NOMINA il
        // token proprio per spiegare perche' non si usa, e deve poterlo fare.
        .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga));
      assert.deepEqual(
        righeDiCodice.filter((riga) => riga.includes("import.meta.main")),
        [],
        "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il guscio esce 0 muto",
      );
    });

    it(`${chi} parla anche invocato dalla junction: e' il canale con cui lo vede un progetto`, () => {
      const casa = mkdtempSync(join(tmpdir(), "site-doctor-junction-"));
      const altrove = mkdtempSync(join(tmpdir(), "site-doctor-junction-cwd-"));
      const junction = join(casa, "skill");
      try {
        try {
          // Su Windows una junction NON chiede privilegi di amministratore (un
          // symlink si'). Fuori da Windows nasce un symlink: va bene uguale,
          // perche' cio' che conta e' che il percorso di invocazione non sia
          // canonico.
          symlinkSync(SKILL_DIR, junction, "junction");
        } catch (errore) {
          assert.fail(
            `junction non creata (${junction} → ${SKILL_DIR}): ${errore.message}. ` +
            "Senza junction questo test non prova niente, e cio' che non e' provato e' MANCANTE, non PASS.",
          );
        }
        const res = spawnSync(process.execPath, [join(junction, "scripts", file)], { cwd: altrove, encoding: "utf8" });
        const uscita = `${res.stdout}${res.stderr}`.trim();
        assert.notEqual(res.status, 0, `uscita ${res.status} invocando ${chi} dalla junction: non ha guardato niente e sembra verde`);
        assert.notEqual(uscita, "", `dalla junction ${chi} non ha stampato una riga: e' il difetto del 2026-08-04, tornato`);
      } finally {
        // `rmSync` ricorsivo rimuove la junction, NON il suo bersaglio.
        rmSync(casa, { recursive: true, force: true });
        rmSync(altrove, { recursive: true, force: true });
      }
    });
  });
}
