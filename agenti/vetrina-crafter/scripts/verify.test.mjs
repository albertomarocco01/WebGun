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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

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
