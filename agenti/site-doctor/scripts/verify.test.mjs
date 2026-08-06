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
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
    "favicon",
    "open-graph",
    "dati-strutturati",
    "sitemap-xml",
    "robots-txt",
    "perimetro",
    "contratto-uscita",
  ];

  it("sono quattordici, questi, e in quest'ordine", () => {
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
      // I cinque passi di D21 nascono il 2026-08-06 e il loro banco e' quello
      // del collaudo (`banco-prova-collaudo-sd`, dieci classi FAV/OG/LD/SMP/ROB):
      // il banco del costruttore, che questo test legge, e' precedente.
      if (["favicon", "open-graph", "dati-strutturati", "sitemap-xml", "robots-txt"].includes(id)) continue;
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

// ═══════════════════════ il tribunale del 2026-08-06 — il guscio del gate
/**
 * Questi difetti vivono nel guscio di I/O, e si provano solo eseguendo il gate.
 * Ogni test costruisce un progetto finto in una cartella temporanea, lo serve
 * davvero, e legge il `--json`: nessuna asserzione su una funzione pura.
 */
// ═══════════════════════ il tribunale del 2026-08-06 — il guscio del gate
/**
 * Questi difetti vivono nel guscio di I/O e si provano solo eseguendo il gate:
 * ogni test costruisce un progetto finto in una cartella temporanea, lo serve
 * davvero, e legge il `--json`.
 *
 * **Il banco vive in un processo suo, e non e' un dettaglio**: `spawnSync`
 * blocca il ciclo di eventi, quindi un server HTTP acceso in questo stesso
 * processo non risponderebbe mai al gate. E' scritto in
 * `references/verifica-deterministica.md` §Trappole di piattaforma — e ci sono
 * cascato dentro scrivendo questi test, che e' il motivo per cui la nota adesso
 * sta anche qui.
 */
describe("tribunale P.6-P3 — il guscio, provato eseguendolo", () => {
  const GATE = fileURLToPath(new URL("./verify.mjs", import.meta.url));
  const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Accende un banco in un PROCESSO SUO e aspetta che risponda davvero. */
  const accendi = async (dir, sorgente, porta) => {
    const file = join(dir, "banco-di-prova.cjs");
    writeFileSync(file, sorgente.replace("__PORTA__", String(porta)), "utf8");
    const proc = spawn(process.execPath, [file], { stdio: "ignore" });
    for (let i = 0; i < 80; i += 1) {
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/__vivo`, { signal: AbortSignal.timeout(400) });
        if (r.status) return { proc, url: `http://127.0.0.1:${porta}` };
      } catch { /* non ancora */ }
      await attendi(150);
    }
    proc.kill();
    throw new Error(`il banco su ${porta} non ha risposto`);
  };

  const conProgetto = async (file, sorgente, porta, prova) => {
    const dir = mkdtempSync(join(tmpdir(), "sd-trib-"));
    let banco = null;
    try {
      for (const [rel, contenuto] of Object.entries(file)) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), contenuto, "utf8");
      }
      banco = await accendi(dir, sorgente, porta);
      const r = spawnSync(process.execPath, [GATE, "--url", banco.url, "--json"], { cwd: dir, encoding: "utf8", timeout: 120000 });
      let doc;
      try {
        doc = JSON.parse(r.stdout);
      } catch {
        throw new Error(`il gate non ha prodotto JSON (uscita ${r.status}): ${(r.stdout || r.stderr || "").slice(0, 300)}`);
      }
      return await prova(doc, dir);
    } finally {
      banco?.proc.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  };

  const stato = (doc, id) => doc.steps.find((s) => s.id === id)?.status;
  const dettaglio = (doc, id) => doc.steps.find((s) => s.id === id)?.detail ?? "";
  const PROGETTO_FINTO = { ".next/BUILD_ID": "BANCOTRIBUNALE01", "docs/PROGETTO.md": "progetto finto" };

  it("SD-TRIB-G1: uno `<script src>` finto dentro un attributo non spegne il censimento dell'archiviazione", async () => {
    // La chiave universale del perito: il primo `<script` che una regexp
    // ingenua trova sta DENTRO un valore di attributo — testo, per un browser —
    // e il suo «contenuto» corre fino al `</script>` VERO, inghiottendo lo
    // script che archivia davvero. Il passo chiudeva `n/a`: «il sito non mette
    // niente nel browser di chi passa», con «0 script inline letti per intero».
    const banco = `const {createServer}=require("http");
const p='<!DOCTYPE html><html lang="it"><head><title>T</title></head><body><main><h1>T</h1>'
 + '<div data-nota="<script src=/vuoto.js>"></div>'
 + '<script>localStorage.setItem("sd_tracciato","1");</script>'
 + '<p>build BANCOTRIBUNALE01</p></main></body></html>';
createServer((q,s)=>{ if(q.url==="/vuoto.js"){s.writeHead(200,{"content-type":"application/javascript"});return s.end("export const a=1;");}
 s.writeHead(200,{"content-type":"text/html; charset=utf-8"}); s.end(p); }).listen(__PORTA__,"127.0.0.1");`;
    await conProgetto(PROGETTO_FINTO, banco, 3911, (doc) => {
      assert.notEqual(stato(doc, "archiviazione-client"), "n/a", "n/a su un sito che scrive in localStorage");
      assert.match(dettaglio(doc, "archiviazione-client"), /localStorage/);
    });
  });

  it("SD-TRIB-G2: un bundle servito con il corpo VUOTO non e' un bundle letto", async () => {
    const banco = `const {createServer}=require("http");
createServer((q,s)=>{ if(q.url==="/app.js"){s.writeHead(204);return s.end();}
 s.writeHead(200,{"content-type":"text/html; charset=utf-8"});
 s.end('<!DOCTYPE html><html lang="it"><head><title>T</title></head><body><main><h1>T</h1><p>BANCOTRIBUNALE01</p><script src="/app.js"></script></main></body></html>'); }).listen(__PORTA__,"127.0.0.1");`;
    await conProgetto(PROGETTO_FINTO, banco, 3912, (doc) => {
      assert.equal(stato(doc, "archiviazione-client"), "skipped");
      assert.match(dettaglio(doc, "archiviazione-client"), /CORPO VUOTO/);
    });
  });

  it("SD-TRIB-G3: l'ultimo handoff e' il piu' ALTO di numero, non il primo in ordine alfabetico", async () => {
    const banco = `const {createServer}=require("http");
createServer((q,s)=>{ s.writeHead(200,{"content-type":"text/html; charset=utf-8"});
 s.end('<!DOCTYPE html><html lang="it"><head><title>T</title></head><body><main><h1>T</h1><p>BANCOTRIBUNALE01</p></main></body></html>'); }).listen(__PORTA__,"127.0.0.1");`;
    await conProgetto({
      ...PROGETTO_FINTO,
      "docs/handoff/9-site-doctor.md": "# 9\n\nGate: ROSSO\n",
      "docs/handoff/10-site-doctor.md": "# 10 — il vero ultimo\n\nnessuna riga di verdetto qui dentro\n",
    }, banco, 3913, (doc) => {
      // Il `10-` non dichiara niente: il passo deve fallire citando LUI, non
      // passare citando il `9-` che nessuno legge piu'.
      assert.equal(stato(doc, "contratto-uscita"), "fail");
      assert.match(dettaglio(doc, "contratto-uscita"), /10-site-doctor\.md/);
    });
  });

  it("SD-TRIB-G4: una pagina scoperta e non scaricata rende MANCANTI i passi che dichiarano di guardarle tutte", async () => {
    const banco = `const {createServer}=require("http");
createServer((q,s)=>{ if(q.url==="/contatti"){return s.destroy();}
 s.writeHead(200,{"content-type":"text/html; charset=utf-8"});
 s.end('<!DOCTYPE html><html lang="it"><head><title>T</title></head><body><main><h1>T</h1><p>BANCOTRIBUNALE01</p><a href="/contatti">Contatti</a></main></body></html>'); }).listen(__PORTA__,"127.0.0.1");`;
    await conProgetto(PROGETTO_FINTO, banco, 3914, (doc) => {
      assert.match(dettaglio(doc, "superficie-pubblica"), /\/contatti/);
      for (const id of ["dati-raccolti", "archiviazione-client", "accessibilita-servita"]) {
        assert.equal(stato(doc, id), "skipped", `${id} ha concluso su una superficie amputata`);
      }
    });
  });

  it("SD-TRIB-G5: un asset che su disco e' una CARTELLA non manda in crash il gate", async () => {
    const banco = `const {createServer}=require("http");
createServer((q,s)=>{ if(q.url.startsWith("/_next/")){s.writeHead(200,{"content-type":"application/javascript"});return s.end("// servito");}
 s.writeHead(200,{"content-type":"text/html; charset=utf-8"});
 s.end('<!DOCTYPE html><html lang="it"><head><title>T</title></head><body><main><h1>T</h1><script src="/_next/static/chunks"></script></main></body></html>'); }).listen(__PORTA__,"127.0.0.1");`;
    await conProgetto({
      ".next/BUILD_ID": "NONCOMBACIA0001",
      "docs/PROGETTO.md": "progetto finto",
      ".next/static/chunks/dentro.js": "// una cartella, non un file",
    }, banco, 3915, (doc) => {
      // il verdetto e' rosso e MOTIVATO, non un'uscita 2 con nove passi azzerati
      assert.equal(doc.ok, false);
      assert.equal(doc.error, undefined);
      assert.equal(doc.summary.passi, 14);
    });
  });
});
