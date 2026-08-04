/**
 * Test del guscio: gli `id` dei passi, il loro ORDINE, e le premesse dell'audit
 * statico.
 *
 * L'ordine non e' un dettaglio estetico: e' il gate. Un passo spostato piu'
 * avanti cambia cosa il gate aveva guardato nel momento in cui ha deciso — e
 * l'`id` e' l'unica cosa su cui un orchestratore si aggancia, quindi rinominarlo
 * o riordinarlo rompe a valle in silenzio (DECISIONI.md §15).
 *
 * NOTA SU COSA QUESTI TEST NON PROVANO: le fixture qui sotto sono cartelle
 * temporanee con due file dentro, non un progetto Next.js. Nessun passo che
 * interroga un'app servita o un database e' stato eseguito: quelli si provano
 * sul banco, e al 2026-08-02 il banco non esiste.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { auditStatico, ID_AUDIT } from "./vetrina-audit.mjs";
import { CONTRATTO_JSON, ID, riepilogo } from "./verify.mjs";

describe("gli id dei passi e il loro ordine", () => {
  const ATTESI = [
    "contratto-vetrina",
    "tipi",
    "cucitura-ui",
    "chiavi-e-client",
    "a11y-statica",
    "app-identita",
    "pagine-vive",
    "segnaposto-serviti",
    "contenuti-vivi",
    "contratto-uscita",
  ];

  it("sono dieci, questi, e in quest'ordine", () => {
    assert.deepEqual(Object.values(ID), ATTESI);
  });

  it("i primi cinque non hanno bisogno dell'app accesa, gli altri si'", () => {
    // Se qualcuno sposta `app-identita` prima dei passi statici, il gate
    // smette di poter dire qualcosa quando l'app e' spenta.
    assert.equal(ATTESI.indexOf("app-identita"), 5);
    assert.ok(ATTESI.indexOf("pagine-vive") > ATTESI.indexOf("app-identita"));
    assert.ok(ATTESI.indexOf("segnaposto-serviti") > ATTESI.indexOf("pagine-vive"));
    assert.ok(ATTESI.indexOf("contenuti-vivi") > ATTESI.indexOf("pagine-vive"));
  });

  it("`contratto-uscita` e' l'ultimo: guarda i nove precedenti", () => {
    assert.equal(ATTESI[ATTESI.length - 1], "contratto-uscita");
  });

  it("i tre passi statici hanno gli stessi id dell'audit che li produce", () => {
    assert.deepEqual(Object.values(ID_AUDIT), ["cucitura-ui", "chiavi-e-client", "a11y-statica"]);
  });

  it("il numero di contratto del `--json` e' dichiarato", () => {
    assert.equal(CONTRATTO_JSON, 1);
  });
});

describe("riepilogo e verdetto", () => {
  it("conta i tre stati", () => {
    const passi = [{ status: "pass" }, { status: "pass" }, { status: "fail" }, { status: "skipped" }];
    assert.deepEqual(riepilogo(passi), { passi: 4, pass: 2, fail: 1, skipped: 1 });
  });

  it("nove `pass` e uno `skipped` NON sono un verde", () => {
    const passi = [...Array(9).fill({ status: "pass" }), { status: "skipped" }];
    const r = riepilogo(passi);
    assert.equal(r.fail === 0 && r.skipped === 0, false);
  });
});

describe("premesse dell'audit statico", () => {
  const temporanee = [];
  const banco = (contenuto) => {
    const dir = mkdtempSync(join(tmpdir(), "vetrina-test-"));
    temporanee.push(dir);
    for (const [percorso, testo] of Object.entries(contenuto)) {
      const pieno = join(dir, percorso);
      mkdirSync(join(pieno, ".."), { recursive: true });
      writeFileSync(pieno, testo, "utf8");
    }
    return dir;
  };

  after(() => {
    for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });
  });

  const CONFIG = JSON.stringify({
    radicePubblica: "src/app",
    cucitura: "src/components/ui",
    primitive: ["Bottone"],
    moduliClient: ["src/lib/supabase/public.ts"],
  });

  it("falso verde n°6: senza vetrina.config.json i tre passi sono MANCANTI, non verdi", () => {
    const esito = auditStatico({ progetto: banco({ "src/app/page.tsx": "export default () => null;" }) });
    assert.equal(esito.passi.length, 3);
    assert.ok(esito.passi.every((p) => p.status === "skipped"));
    assert.match(esito.passi[0].detail, /vetrina\.config\.json assente/);
  });

  it("una configurazione illeggibile non produce un audit «pulito»", () => {
    const esito = auditStatico({ progetto: banco({ "vetrina.config.json": "{ non json" }) });
    assert.ok(esito.passi.every((p) => p.status === "skipped"));
    assert.match(esito.errori[0], /illeggibile/);
  });

  it("una configurazione incompleta si rifiuta, e dice quale chiave manca", () => {
    const esito = auditStatico({ progetto: banco({ "vetrina.config.json": JSON.stringify({ radicePubblica: "src/app" }) }) });
    assert.match(esito.errori[0], /manca la chiave `cucitura`/);
  });

  it("falso verde n°7: cucitura vuota = MANCANTE, perche' nessuna regola potrebbe scattare", () => {
    const dir = banco({ "vetrina.config.json": CONFIG, "src/app/page.tsx": "export default () => null;" });
    const esito = auditStatico({ progetto: dir });
    const cucitura = esito.passi.find((p) => p.id === ID_AUDIT.cucitura);
    assert.equal(cucitura.status, "skipped");
    assert.match(cucitura.detail, /non esiste o non contiene nessun componente/);
  });

  it("falso verde n°6bis: zero file sotto la radice pubblica non e' un `pass`", () => {
    const dir = banco({ "vetrina.config.json": CONFIG, "src/components/ui/Bottone.tsx": "export const Bottone = () => null;" });
    const chiavi = auditStatico({ progetto: dir }).passi.find((p) => p.id === ID_AUDIT.chiavi);
    assert.equal(chiavi.status, "skipped");
    assert.match(chiavi.detail, /zero file letti non e' un `pass`/);
  });

  it("con sorgenti veri le regole girano, e il conteggio dei file si stampa sempre", () => {
    const dir = banco({
      "vetrina.config.json": CONFIG,
      "src/components/ui/Bottone.tsx": "export const Bottone = () => <button type=\"button\" />;",
      "src/app/page.tsx": "import { Bottone } from \"./Bottone\";\nexport default () => <Bottone />;",
    });
    const esito = auditStatico({ progetto: dir });
    const cucitura = esito.passi.find((p) => p.id === ID_AUDIT.cucitura);
    assert.equal(cucitura.status, "fail");
    assert.match(cucitura.detail, /file letti sotto src\//);
    assert.equal(cucitura.counts.block, 1);
  });

  it("il bersaglio si stampa anche quando non c'e' niente da segnalare", () => {
    const dir = banco({
      "vetrina.config.json": CONFIG,
      "src/components/ui/Bottone.tsx": "export const Bottone = () => null;",
      "src/app/page.tsx": "import { Bottone } from \"@/components/ui\";\nexport default () => <Bottone />;",
    });
    const chiavi = auditStatico({ progetto: dir }).passi.find((p) => p.id === ID_AUDIT.chiavi);
    assert.equal(chiavi.status, "pass");
    assert.match(chiavi.detail, /moduli client ammessi/);
  });
});

// ---------------------------------------------------------------------------
// Gli epiloghi dei due gusci eseguibili (2026-08-04, P.0-igiene-2)
//
// Perche' arrivano solo oggi: a P.0-igiene (2026-08-03) questa skill non aveva
// niente da correggere — il suo epilogo era gia' `resolve(argv[1]) === ...`, ed
// era anzi la forma che l'`hint` della regola `epiloghi-vivi` citava come
// modello. Il 2026-08-04 quella forma si e' rivelata falsa attraverso una
// junction, e il modello e' diventato il difetto: i due gusci di qui uscivano 0
// muti come gli altri. Con la correzione arrivano anche i test che mancavano.
//
// I test sono TRE per guscio perche' proteggono tre cose diverse, e nessuno dei
// tre basta:
//
//  - il FUNZIONALE copre tutta la classe «l'epilogo non parte», qualunque ne sia
//    la causa (guardia sbagliata, `main()` cancellata, condizione che non scatta
//    mai): lancia il guscio per davvero e pretende che parli. Ma gira con
//    `process.execPath`, e per il percorso REALE del file: cieco alla junction;
//  - lo STATICO vieta `import.meta.main` nel sorgente, e non esegue niente:
//    e' l'unico che regge su QUALUNQUE Node. Cieco al difetto del 2026-08-04,
//    che quel token non lo contiene — la riga colpevole era la forma «giusta»;
//  - il JUNCTION invoca il guscio attraverso una junction vera. E' l'unico che
//    vede il canale con cui una chat aperta sul repo di un progetto generato
//    vede la skill (`.claude/skills/<skill>/scripts/...`): li' `argv[1]` resta il
//    percorso della junction mentre `import.meta.url` e' gia' canonico, e il
//    confronto secco era falso (`PILOTA-PRE-2026-08-04.md` §2b).
//
// Perche' i test di `vetrina-audit.mjs` stanno in QUESTO file e non in un
// `vetrina-audit.test.mjs`: lo `npm test` di questa skill elenca i file di test
// per esteso (`package.json`) perche' il glob non gira su Node 20, e
// `package.json` e' fuori dal perimetro del mandato P.0-igiene-2. Un file di
// test nuovo che `npm test` non lancia sarebbe una verifica MANCANTE travestita
// da PASS: esattamente cio' che questa casa non ammette. La casa giusta di
// questi due test resta un `vetrina-audit.test.mjs` — la decide il direttore,
// insieme alla riga di `package.json` e a quella di `SKILL.md` che dice «i tre
// file».

const GUSCI = [
  { file: "verify.mjs", chi: "il gate" },
  { file: "vetrina-audit.mjs", chi: "l'audit statico" },
];

for (const { file, chi } of GUSCI) {
  describe(`l'epilogo di ${file} deve partire`, () => {
    const GUSCIO = fileURLToPath(new URL(`./${file}`, import.meta.url));
    const SKILL_DIR = dirname(dirname(GUSCIO));

    it(`${chi} parla anche fuori da un progetto: mai un'uscita 0 muta`, () => {
      const dir = mkdtempSync(join(tmpdir(), "vetrina-crafter-epilogo-"));
      try {
        const res = spawnSync(process.execPath, [GUSCIO], { cwd: dir, encoding: "utf8" });
        const uscita = `${res.stdout}${res.stderr}`.trim();
        // Si asserisce «diverso da 0», non «uguale a 2»: i due gusci hanno
        // contratti d'uscita diversi (il gate rifiuta con 2, l'audit statico
        // esce 1 quando non ha guardato tutto), e il difetto da fermare e' il
        // silenzio che si traveste da verde, non il valore del codice.
        assert.notEqual(res.status, 0,
          `uscita 0 fuori da un progetto: ${chi} non ha guardato niente e sembra verde`);
        assert.notEqual(uscita, "",
          `${chi} non ha stampato una riga: se l'epilogo non parte, nessuno se ne accorge`);
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
      const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));
      assert.deepEqual(colpevoli, [],
        "`import.meta.main` non esiste prima di Node 24: su Node 20 la guardia e' `undefined` e il guscio esce 0 muto");
    });

    it(`${chi} parla anche invocato dalla junction: e' il canale con cui lo vede un progetto`, () => {
      const casa = mkdtempSync(join(tmpdir(), "vetrina-crafter-junction-"));
      const altrove = mkdtempSync(join(tmpdir(), "vetrina-crafter-junction-cwd-"));
      const junction = join(casa, "skill");
      try {
        try {
          // Su Windows una junction NON chiede privilegi di amministratore (un
          // symlink si'). Fuori da Windows il tipo e' ignorato e nasce un
          // symlink: va bene uguale, perche' cio' che conta e' che il percorso
          // di invocazione non sia canonico.
          symlinkSync(SKILL_DIR, junction, "junction");
        } catch (errore) {
          assert.fail(
            `junction non creata (${junction} → ${SKILL_DIR}): ${errore.message}. ` +
            "Senza junction questo test non prova niente, e cio' che non e' provato e' MANCANTE, non PASS.");
        }
        // `cwd` e' una SECONDA cartella non-progetto: cosi' il guscio si ferma
        // per mancanza di progetto, e l'unica variabile in gioco e' il percorso
        // di invocazione.
        const res = spawnSync(process.execPath, [join(junction, "scripts", file)], { cwd: altrove, encoding: "utf8" });
        const uscita = `${res.stdout}${res.stderr}`.trim();
        assert.notEqual(res.status, 0,
          `uscita ${res.status} invocando ${chi} dalla junction: non ha guardato niente e sembra verde`);
        assert.notEqual(uscita, "",
          `dalla junction ${chi} non ha stampato una riga: e' il difetto del 2026-08-04, tornato`);
      } finally {
        // `rmSync` ricorsivo rimuove la junction, NON il suo bersaglio:
        // verificato su Node 20.12.2 e 24.18.1 prima di scrivere questo test.
        rmSync(casa, { recursive: true, force: true });
        rmSync(altrove, { recursive: true, force: true });
      }
    });
  });
}
