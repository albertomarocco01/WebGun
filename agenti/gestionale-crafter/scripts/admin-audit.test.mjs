/**
 * admin-audit.test.mjs — Il guscio dell'audit deve PARTIRE.
 *
 * Le regole dell'audit hanno gia' i loro test in `audit-lib.test.mjs`, e girano
 * senza progetto e senza database: e' li' che vive il giudizio. Qui si prova
 * l'unica cosa che quei test non possono provare — che il guscio arrivi a
 * chiamarle.
 *
 *   node --test "scripts/**\/*.test.mjs"
 *
 * Il difetto (2026-08-03): `if (import.meta.main) main();`. `import.meta.main`
 * e' arrivato in Node 24; su Node 20 vale `undefined`, quindi `main()` non
 * veniva chiamata e l'audit USCIVA 0 SENZA STAMPARE UNA RIGA. Qui e' peggio che
 * in un gate: `0` e' proprio il codice di «nessun bloccante», quindi il silenzio
 * si travestiva da esito buono per chiunque lo lanciasse col Node di sistema di
 * questa macchina. Misurato il 2026-08-03: Node 20.12.2 → uscita 0, zero righe;
 * Node 24.18.1 → uscita 2 e il messaggio. La skill dichiara «Node >= 20»: era il
 * codice a violare il proprio contratto.
 *
 * I test sono TRE perche' proteggono tre cose diverse, e nessuno dei tre basta:
 *
 *  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
 *    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
 *    mai): lancia l'audit per davvero e pretende che parli. Ma gira con
 *    `process.execPath`, cioe' col Node della suite: su Node 24 QUESTO difetto
 *    specifico non lo vedrebbe, perche' li' `import.meta.main` funziona;
 *  - lo STATICO e' l'unico che impedisce il ritorno del difetto su QUALUNQUE
 *    Node, perche' non esegue niente: vieta il token nel sorgente. E' brutale, e
 *    va bene cosi' — finche' il prerequisito dichiarato e' Node >= 20, quel
 *    token qui dentro non ha nessun uso legittimo;
 *  - il JUNCTION (2026-08-04, P.0-igiene-2) invoca il guscio attraverso una
 *    junction vera. Il difetto di quel giorno: la guardia era
 *    `resolve(argv[1]) === fileURLToPath(import.meta.url)` — la forma che la
 *    regola `epiloghi-vivi` della regia PRESCRIVEVA — e invocata da
 *    `.claude/skills/<skill>/scripts/...` era falsa, perche' `resolve`
 *    normalizza ma non scioglie una junction mentre `import.meta.url` e' gia'
 *    canonico. Tutti e cinque i gate della casa uscivano 0 muti su quel canale
 *    (`PILOTA-PRE-2026-08-04.md` §2b), e questo guscio con loro — cioe' di nuovo
 *    «nessun bloccante» senza aver letto un file. Gli altri due sono ciechi: lo
 *    statico vieta un token che qui non compare, il funzionale usa il percorso
 *    reale, canonico per costruzione. Solo il canale junction vede il canale
 *    junction.
 */

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const AUDIT = fileURLToPath(new URL("./admin-audit.mjs", import.meta.url));
const SKILL_DIR = dirname(dirname(AUDIT));

describe("l'epilogo che non parte (2026-08-03, e dalla junction 2026-08-04)", () => {
  it("l'audit parla anche fuori da un progetto: mai un'uscita 0 muta", () => {
    const dir = mkdtempSync(join(tmpdir(), "gestionale-crafter-audit-epilogo-"));
    try {
      const res = spawnSync(process.execPath, [AUDIT], { cwd: dir, encoding: "utf8" });
      const uscita = `${res.stdout}${res.stderr}`.trim();
      // Qui non c'e' `gestionale.config.json`: l'audit esce 2 (errore di
      // esecuzione) dicendo perche'. Si asserisce «diverso da 0», non «uguale a
      // 2», perche' il difetto da fermare e' il silenzio — e su questo script il
      // silenzio usciva 0, che qui significa «nessun bloccante».
      assert.notEqual(res.status, 0,
        `uscita 0 fuori da un progetto: l'audit non ha letto un file e dichiara «nessun bloccante» (uscita ${res.status})`);
      assert.notEqual(uscita, "",
        "l'audit non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("il sorgente dell'audit non contiene `import.meta.main`", () => {
    const righeDiCodice = readFileSync(AUDIT, "utf8")
      .split(/\r?\n/)
      // Le righe di commento non eseguono: il commento dell'epilogo NOMINA il
      // token proprio per spiegare perche' non si usa, e deve poterlo fare.
      .filter((riga) => !/^\s*(\/\/|\*|\/\*)/.test(riga));
    const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));
    assert.deepEqual(colpevoli, [],
      "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e l'audit esce 0 muto");
  });

  it("l'audit parla anche invocato dalla junction: e' il canale con cui lo vede un progetto", () => {
    const casa = mkdtempSync(join(tmpdir(), "gestionale-crafter-audit-junction-"));
    const altrove = mkdtempSync(join(tmpdir(), "gestionale-crafter-audit-junction-cwd-"));
    const junction = join(casa, "skill");
    try {
      try {
        // Su Windows una junction NON chiede privilegi di amministratore (un
        // symlink si'). Fuori da Windows il tipo e' ignorato e nasce un symlink:
        // va bene uguale, perche' cio' che conta e' che il percorso di
        // invocazione non sia canonico.
        symlinkSync(SKILL_DIR, junction, "junction");
      } catch (errore) {
        assert.fail(
          `junction non creata (${junction} → ${SKILL_DIR}): ${errore.message}. ` +
          "Senza junction questo test non prova niente, e cio' che non e' provato e' MANCANTE, non PASS.");
      }
      // `cwd` e' una SECONDA cartella non-progetto: cosi' l'audit si ferma per
      // mancanza di progetto, e l'unica variabile in gioco e' il percorso di
      // invocazione.
      const res = spawnSync(process.execPath, [join(junction, "scripts", "admin-audit.mjs")], { cwd: altrove, encoding: "utf8" });
      const uscita = `${res.stdout}${res.stderr}`.trim();
      assert.notEqual(res.status, 0,
        `uscita ${res.status} invocando l'audit dalla junction: non ha letto un file e dichiara «nessun bloccante»`);
      assert.notEqual(uscita, "",
        "dalla junction l'audit non ha stampato una riga: e' il difetto del 2026-08-04, tornato");
    } finally {
      // `rmSync` ricorsivo rimuove la junction, NON il suo bersaglio: verificato
      // su Node 20.12.2 e 24.18.1 prima di scrivere questo test.
      rmSync(casa, { recursive: true, force: true });
      rmSync(altrove, { recursive: true, force: true });
    }
  });
});
