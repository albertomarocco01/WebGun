/**
 * verify.test.mjs — Il gate deve PARTIRE.
 *
 * Le regole del gate hanno gia' i loro test in `gate-lib.test.mjs` e
 * `collaudo-avversario.test.mjs`, e girano senza app e senza Lighthouse: e' li'
 * che vive il giudizio. Qui si prova l'unica cosa che quei test non possono
 * provare — che il guscio arrivi a chiamarle.
 *
 *   node --test "scripts/**\/*.test.mjs"
 *
 * Il difetto (2026-08-03): `if (import.meta.main) await main();`.
 * `import.meta.main` e' arrivato in Node 24; su Node 20 vale `undefined`,
 * quindi `main()` non veniva chiamata e il gate USCIVA 0 SENZA STAMPARE UNA
 * RIGA — un verde che non aveva guardato niente, per chiunque lo lanciasse col
 * Node di sistema di questa macchina. Misurato il 2026-08-03: Node 20.12.2 →
 * uscita 0, zero righe; Node 24.18.1 → uscita 2 e il messaggio. La skill
 * dichiara «Node >= 20»: era il codice a violare il proprio contratto.
 *
 * E' esattamente la classe di difetto che questa skill e' nata per combattere —
 * `--url` senza default, `eLaMiaBuild`, `indiziDevServer` esistono tutti perche'
 * un verde non misurato vale meno di un rosso. Il gate ce l'aveva nell'ultima
 * riga del proprio guscio.
 *
 * I test sono TRE perche' proteggono tre cose diverse, e nessuno dei tre basta:
 *
 *  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
 *    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
 *    mai): lancia il gate per davvero e pretende che parli. Ma gira con
 *    `process.execPath`, cioe' col Node della suite: su Node 24 QUESTO difetto
 *    specifico non lo vedrebbe, perche' li' `import.meta.main` funziona;
 *  - lo STATICO e' l'unico che impedisce il ritorno del difetto su QUALUNQUE
 *    Node, perche' non esegue niente: vieta il token nel sorgente. E' brutale, e
 *    va bene cosi' — finche' il prerequisito dichiarato e' Node >= 20, quel
 *    token qui dentro non ha nessun uso legittimo;
 *  - il JUNCTION (2026-08-04, P.0-igiene-2) invoca il gate attraverso una
 *    junction vera. Gli altri due sono ciechi al difetto che ha reso muti tutti
 *    e cinque i gate quel giorno — il perche' e' scritto in fondo al file, sopra
 *    il test.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const VERIFY = fileURLToPath(new URL("./verify.mjs", import.meta.url));

test("il gate parla anche fuori da un progetto: mai un'uscita 0 muta", () => {
  const dir = mkdtempSync(join(tmpdir(), "speed-demon-epilogo-"));
  try {
    // Nessun `--url`: il gate si ferma prima ancora di cercare Lighthouse, e
    // qui e' un pregio — questo test non deve dipendere da Chrome installato.
    const res = spawnSync(process.execPath, [VERIFY], { cwd: dir, encoding: "utf8" });
    const uscita = `${res.stdout}${res.stderr}`.trim();
    // Qui non c'e' `docs/`: il gate esce 2 (errore di esecuzione) dicendo
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

// --------------------------------------------------------------------------
// Lo stesso epilogo, invocato DALLA JUNCTION (2026-08-04, P.0-igiene-2)
//
// I test diventano TRE, e il terzo non e' un lusso: e' l'unico che vede il
// difetto del 2026-08-04. La guardia era
// `resolve(argv[1]) === fileURLToPath(import.meta.url)` — la forma che la regola
// `epiloghi-vivi` della regia PRESCRIVEVA — e invocata da
// `.claude/skills/<skill>/scripts/verify.mjs` era falsa: `resolve` normalizza il
// percorso ma non scioglie una junction, mentre `import.meta.url` e' gia'
// canonico (Node canonicalizza i moduli che carica). Guardia falsa, `main()` mai
// chiamata, gate uscito 0 SENZA STAMPARE UNA RIGA — su tutti e cinque i gate
// che esistevano allora, misurato il 2026-08-04. Ed e' proprio il canale con
// cui una chat aperta sul repo di un progetto generato vede la skill.
//
// Perche' gli altri due non lo vedono, e non per come sono scritti:
//  - lo STATICO vieta il token `import.meta.main`, e questo difetto non contiene
//    quel token: la riga colpevole era la forma «giusta»;
//  - il FUNZIONALE lancia il gate per il suo percorso reale
//    (`new URL("./verify.mjs", import.meta.url)`), canonico per costruzione: da
//    quella parte del mondo la junction non esiste.
// Solo il canale junction vede il canale junction.

const SKILL_DIR = dirname(dirname(VERIFY));

test("il gate parla anche invocato dalla junction: e' il canale con cui lo vede un progetto", () => {
  const casa = mkdtempSync(join(tmpdir(), "speed-demon-junction-"));
  const altrove = mkdtempSync(join(tmpdir(), "speed-demon-junction-cwd-"));
  const junction = join(casa, "skill");
  try {
    try {
      // Su Windows una junction NON chiede privilegi di amministratore (un
      // symlink si'). Fuori da Windows il tipo e' ignorato e nasce un symlink:
      // va bene uguale, perche' cio' che conta e' che il percorso di invocazione
      // non sia canonico.
      symlinkSync(SKILL_DIR, junction, "junction");
    } catch (errore) {
      assert.fail(
        `junction non creata (${junction} → ${SKILL_DIR}): ${errore.message}. ` +
        "Senza junction questo test non prova niente, e cio' che non e' provato e' MANCANTE, non PASS.");
    }
    // `cwd` e' una SECONDA cartella non-progetto: cosi' il gate si ferma per
    // mancanza di progetto, e l'unica variabile in gioco e' il percorso di
    // invocazione.
    const res = spawnSync(process.execPath, [join(junction, "scripts", "verify.mjs")], { cwd: altrove, encoding: "utf8" });
    const uscita = `${res.stdout}${res.stderr}`.trim();
    assert.notEqual(res.status, 0,
      `uscita ${res.status} invocando il gate dalla junction: non ha guardato niente e sembra verde`);
    assert.notEqual(uscita, "",
      "dalla junction il gate non ha stampato una riga: e' il difetto del 2026-08-04, tornato");
  } finally {
    // `rmSync` ricorsivo rimuove la junction, NON il suo bersaglio: verificato
    // su Node 20.12.2 e 24.18.1 prima di scrivere questo test.
    rmSync(casa, { recursive: true, force: true });
    rmSync(altrove, { recursive: true, force: true });
  }
});
