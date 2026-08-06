/**
 * Test delle regole sui DOCUMENTI: certificato, tabella di proprieta',
 * contratto d'uscita.
 *
 * Il grosso e' sul `perimetro`, che e' la regola per cui questa skill esiste:
 * ogni riga qui sotto e' una forma del difetto del 2026-08-06 — l'Open Graph
 * assegnato due volte, con la favicon a 404 per tre anelli.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  contrattoUscita,
  ESITI_AMMESSI,
  findingsCertificato,
  findingsPerimetro,
  leggiCertificato,
  tabellaSotto,
  verdettoDa,
  VOCI,
} from "./conformita-lib.mjs";

const blocchi = (f) => f.filter((x) => x.severity === "block");

const RIGHE_BUONE = VOCI.map((v) =>
  v.mio
    ? `| ${v.id} | site-doctor | — | conforme |`
    : v.id === "antispam"
      ? `| ${v.id} | — | — | scoperto |`
      : `| ${v.id} | speed-demon | docs/handoff/13.md | delegato |`,
).join("\n");

const CERT = (righe = RIGHE_BUONE, extra = {}) => `# Certificato di idoneità — Banco

Confermato da: ${extra.firma ?? "Alberto Marocco (committente) il 2026-08-06"}

## Ambiente

URL verificato: http://127.0.0.1:3821
Lingue dichiarate: ${extra.lingue ?? "it"}
Informativa privacy: /privacy
Banner di consenso: ${extra.banner ?? "no"}

## Superficie pubblica dichiarata

| percorso | cosa fa |
|---|---|
| / | vetrina |
| /privacy | informativa |

## Archiviazione dichiarata

| chiave | tipo | essenziale | scopo | dove |
|---|---|---|---|---|
| localStorage | archiviazione locale | sì | carrello | / |

## Dati raccolti dai moduli pubblici

| modulo | campo | base giuridica | conservazione |
|---|---|---|---|
| /contatti | nome | contratto (art. 6.1.b) | 12 mesi |

## Voci di conformità e proprietà

| voce | proprietario | dove è dichiarato | esito |
|---|---|---|---|
${righe}
`;

// Tutti i passi «miei» verdi: e' lo stato con cui il certificato qui sopra
// combacia. Chi lo cambia deve cambiare anche gli esiti dichiarati.
const STATI_VERDI = new Map(VOCI.filter((v) => v.mio).map((v) => [v.mio, "pass"]));
const FILE = { "docs/handoff/13.md": "canonical, sitemap, robots, noindex, Open Graph, favicon, contrasti, dati strutturati, accessibilità" };
const leggiFinto = (p) => FILE[p] ?? null;

describe("tabelle markdown", () => {
  it("distingue «sezione assente» da «tabella vuota»", () => {
    assert.deepEqual(tabellaSotto("# X", /voci/i), { sezionePresente: false, righe: [] });
    assert.deepEqual(tabellaSotto("## Voci di conformità\n\ntesto e basta", /voci di conformit/i), { sezionePresente: true, righe: [] });
  });

  it("legge le righe con le intestazioni normalizzate", () => {
    const t = tabellaSotto("## Dati raccolti\n\n| modulo | Base Giuridica |\n|---|---|\n| /c | contratto |", /dati raccolti/i);
    assert.deepEqual(t.righe, [{ modulo: "/c", "base giuridica": "contratto" }]);
  });

  it("si ferma alla sezione successiva di pari livello", () => {
    const t = tabellaSotto("## A\n\n| x |\n|---|\n| 1 |\n\n## B\n\n| y |\n|---|\n| 2 |", /^##\s*A/i);
    assert.deepEqual(t.righe, [{ x: "1" }]);
  });

  it("toglie il grassetto e il codice dalle celle", () => {
    const t = tabellaSotto("## A\n\n| voce |\n|---|\n| **`canonical`** |", /^##\s*A/i);
    assert.deepEqual(t.righe, [{ voce: "canonical" }]);
  });
});

describe("il certificato", () => {
  it("legge firma, data ISO, lingue, informativa e le tre tabelle", () => {
    const c = leggiCertificato(CERT());
    assert.equal(c.dataConferma, "2026-08-06");
    assert.deepEqual(c.lingue, ["it"]);
    assert.equal(c.informativa, "/privacy");
    assert.equal(c.banner, false);
    assert.deepEqual(c.superficie, ["/", "/privacy"]);
    assert.equal(c.archiviazioni.length, 1);
    assert.equal(c.datiRaccolti.length, 1);
    assert.equal(c.voci.righe.length, VOCI.length);
    assert.deepEqual(findingsCertificato(c), []);
  });

  it("una firma senza data ISO non e' una firma utile", () => {
    const f = findingsCertificato(leggiCertificato(CERT(RIGHE_BUONE, { firma: "Alberto Marocco il 6 agosto 2026" })));
    assert.ok(blocchi(f).some((x) => /forma ISO/.test(x.message)));
  });

  it("il segnaposto del modello al posto della firma e' un bloccante", () => {
    const f = findingsCertificato(leggiCertificato(CERT(RIGHE_BUONE, { firma: "{{NOME COGNOME}} ({{RUOLO}}) il {{DATA}}" })));
    assert.ok(blocchi(f).some((x) => /segnaposto del modello/.test(x.message)));
  });

  it("senza `Lingue dichiarate` il passo sulla lingua non avrebbe contro cosa confrontare", () => {
    const f = findingsCertificato(leggiCertificato(CERT(RIGHE_BUONE, { lingue: "" })));
    assert.ok(blocchi(f).some((x) => /Lingue dichiarate/.test(x.message)));
  });

  it("una firma per delega dichiarata e' accettata (D14)", () => {
    const c = leggiCertificato(CERT(RIGHE_BUONE, { firma: "Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06" }));
    assert.deepEqual(findingsCertificato(c), []);
  });

  it("`Banner di consenso: sì` si legge come sì", () => {
    assert.equal(leggiCertificato(CERT(RIGHE_BUONE, { banner: "sì" })).banner, true);
  });
});

describe("il perimetro — la Legge n°1, resa falsificabile", () => {
  const perimetro = (righe, stati = STATI_VERDI) =>
    findingsPerimetro({ tabella: leggiCertificato(CERT(righe)).voci, leggiFile: leggiFinto, statiPassi: stati });

  it("una tabella completa e coerente produce solo la voce scoperta", () => {
    const f = perimetro(RIGHE_BUONE);
    assert.deepEqual(blocchi(f), []);
    assert.deepEqual(f.map((x) => x.object), ["antispam"]);
    assert.match(f[0].message, /SCOPERTA/);
  });

  it("IL DIFETTO: una voce con due proprietari e' una voce di nessuno", () => {
    const f = perimetro(`${RIGHE_BUONE}\n| open-graph | site-doctor | — | conforme |`);
    const og = blocchi(f).find((x) => x.object === "open-graph");
    assert.ok(og, "due proprietari sulla stessa voce devono bloccare");
    assert.match(og.message, /2 proprietari diversi/);
    assert.match(og.message, /favicon del pilota/);
  });

  it("una voce tolta dalla tabella blocca: l'elenco vive nel codice", () => {
    // Se l'elenco stesse solo nel documento, accorciare il documento
    // toglierebbe la voce senza che nessuno decida di toglierla.
    const f = perimetro(RIGHE_BUONE.split("\n").filter((r) => !r.includes("| favicon |")).join("\n"));
    assert.ok(blocchi(f).some((x) => x.object === "favicon"));
  });

  it("delegare a un file che non esiste blocca", () => {
    const f = perimetro(RIGHE_BUONE.replace("| canonical | speed-demon | docs/handoff/13.md |", "| canonical | speed-demon | docs/handoff/99.md |"));
    assert.ok(blocchi(f).some((x) => x.object === "canonical" && /nel progetto non esiste/.test(x.message)));
  });

  it("delegare a un file che esiste e non nomina la voce blocca", () => {
    const f = findingsPerimetro({
      tabella: leggiCertificato(CERT(RIGHE_BUONE)).voci,
      leggiFile: (p) => (p === "docs/handoff/13.md" ? "un handoff che non parla di niente" : null),
      statiPassi: STATI_VERDI,
    });
    assert.ok(blocchi(f).some((x) => /esiste e non nomina mai questa voce/.test(x.message)));
  });

  it("delegare senza dire dove blocca", () => {
    const f = perimetro(RIGHE_BUONE.replace("| canonical | speed-demon | docs/handoff/13.md |", "| canonical | speed-demon | — |"));
    assert.ok(blocchi(f).some((x) => x.object === "canonical" && /senza dire dove/.test(x.message)));
  });

  it("dichiararsi proprietari di una voce che nessun passo misura blocca", () => {
    const f = perimetro(RIGHE_BUONE.replace("| canonical | speed-demon | docs/handoff/13.md | delegato |", "| canonical | site-doctor | — | conforme |"));
    assert.ok(blocchi(f).some((x) => /promessa senza l'organo/.test(x.message)));
  });

  it("§19 per voce: un esito dichiarato diverso da questa esecuzione blocca", () => {
    const stati = new Map(STATI_VERDI);
    stati.set("informativa-privacy", "fail");
    const f = perimetro(RIGHE_BUONE, stati);
    const x = blocchi(f).find((y) => y.object === "informativa-privacy");
    assert.ok(x);
    assert.match(x.message, /Il documento e' un ricordo, l'esecuzione e' la misura/);
  });

  it("un `n/a` si dichiara «non applicabile», e combacia", () => {
    const stati = new Map(STATI_VERDI);
    stati.set("lingua-e-hreflang", "n/a");
    const righe = RIGHE_BUONE.replace("| lingua-hreflang | site-doctor | — | conforme |", "| lingua-hreflang | site-doctor | — | non applicabile |");
    assert.deepEqual(blocchi(perimetro(righe, stati)), []);
  });

  it("tribunale SD-05: una cella `esito` VUOTA non disattiva il confronto §19", () => {
    const righe = RIGHE_BUONE.replace("| informativa-privacy | site-doctor | — | conforme |", "| informativa-privacy | site-doctor | — |  |");
    assert.ok(blocchi(perimetro(righe)).some((x) => x.object === "informativa-privacy" && /senza esito/.test(x.message)));
  });

  it("tribunale SD-05: un esito fuori dai quattro ammessi e' un bloccante", () => {
    const righe = RIGHE_BUONE.replace("| informativa-privacy | site-doctor | — | conforme |", "| informativa-privacy | site-doctor | — | va benissimo |");
    assert.ok(blocchi(perimetro(righe)).some((x) => /non riconosciuto/.test(x.message)));
    assert.deepEqual([...ESITI_AMMESSI], ["conforme", "non conforme", "non verificato", "non applicabile"]);
  });

  it("tribunale SD-PATH-01: una delega che esce dal progetto diventa un bloccante", () => {
    const righe = RIGHE_BUONE.replace("| canonical | speed-demon | docs/handoff/13.md |", "| canonical | speed-demon | ../../WebGun/agenti/speed-demon/SKILL.md |");
    const f = findingsPerimetro({
      tabella: leggiCertificato(CERT(righe)).voci,
      leggiFile: (percorso) => (percorso.includes("..") ? null : leggiFinto(percorso)),
      statiPassi: STATI_VERDI,
    });
    assert.ok(blocchi(f).some((x) => x.object === "canonical" && /non esiste/.test(x.message)));
  });

  it("una riga fuori elenco e' un avviso: il gate non la controlla", () => {
    const f = perimetro(`${RIGHE_BUONE}\n| qualcosa-di-nuovo | site-doctor | — | conforme |`);
    assert.ok(f.some((x) => x.severity === "warn" && x.object === "qualcosa-di-nuovo"));
  });

  it("la sezione assente e' un bloccante solo, non sedici", () => {
    const f = findingsPerimetro({ tabella: { sezionePresente: false, righe: [] }, leggiFile: leggiFinto, statiPassi: STATI_VERDI });
    assert.equal(f.length, 1);
  });

  it("l'elenco delle voci copre le sei mie e le dieci degli altri", () => {
    assert.equal(VOCI.length, 16);
    assert.equal(VOCI.filter((v) => v.mio).length, 6);
    assert.deepEqual(
      VOCI.filter((v) => v.mio).map((v) => v.mio).sort(),
      ["accessibilita-servita", "archiviazione-client", "archiviazione-client", "dati-raccolti", "informativa-privacy", "lingua-e-hreflang"],
    );
  });
});

/**
 * Il gate deve saper leggere il contratto che il suo stesso modello insegna a
 * scrivere.
 *
 * Non e' un'ipotesi: e' il difetto n°17 del collaudo avversario di speed-demon,
 * dove quattro rifiuti indebiti su quattro venivano dallo stesso ceppo — il
 * gate non sapeva leggere `docs/performance.md` scritto seguendo il template
 * della skill, e rifiutava perfino una firma umana con nome e ruolo. Qui il
 * modello viene letto dal disco, riempito come lo riempirebbe una persona, e
 * dato in pasto al parser vero.
 */
describe("il modello del certificato e il parser sono la stessa cosa", () => {
  const MODELLO = readFileSync(new URL("../resources/templates/conformita.md", import.meta.url), "utf8");

  // Come lo riempie una persona: ogni `{{…}}` sostituito col suo contenuto.
  const riempito = MODELLO
    .replace("Confermato da: {{NOME COGNOME}} ({{RUOLO}}) il {{AAAA-MM-GG}}", "Confermato da: Alberto Marocco (committente) il 2026-08-06")
    .replace(/\{\{([^}]*)\}\}/g, "$1");

  it("il modello NON riempito e' rifiutato: e' un promemoria, non un certificato", () => {
    const f = findingsCertificato(leggiCertificato(MODELLO));
    assert.ok(blocchi(f).some((x) => /segnaposto del modello/.test(x.message)));
  });

  it("il modello riempito si legge per intero", () => {
    const c = leggiCertificato(riempito);
    assert.equal(c.dataConferma, "2026-08-06");
    assert.equal(c.urlDichiarato, "http://127.0.0.1:3000");
    assert.deepEqual(c.lingue, ["it"]);
    assert.equal(c.informativa, "/privacy");
    assert.equal(c.banner, false);
    assert.deepEqual(c.superficie, ["/", "/contatti", "/privacy"]);
    assert.equal(c.archiviazioni.length, 1);
    assert.equal(c.archiviazioni[0].essenziale, "sì");
    assert.equal(c.datiRaccolti.length, 2);
    assert.equal(c.voci.righe.length, VOCI.length, "il modello elenca tutte le voci del codice");
  });

  it("il modello riempito non produce nessun rilievo sul certificato", () => {
    assert.deepEqual(findingsCertificato(leggiCertificato(riempito)), []);
  });

  it("la tabella del modello passa il perimetro, con la sola voce scoperta", () => {
    const stati = new Map(VOCI.filter((v) => v.mio).map((v) => [v.mio, v.mio === "lingua-e-hreflang" ? "n/a" : "pass"]));
    const f = findingsPerimetro({
      tabella: leggiCertificato(riempito).voci,
      leggiFile: (p) => (p.startsWith("docs/handoff/") ? "canonical sitemap robots noindex Open Graph favicon dati strutturati contrasti accessibilità" : null),
      statiPassi: stati,
    });
    assert.deepEqual(blocchi(f), [], "il modello della casa non deve produrre bloccanti sul gate della casa");
    assert.deepEqual(f.map((x) => x.object), ["antispam"]);
  });

  it("il modello dell'handoff porta una riga `Gate:` che il gate riconosce", () => {
    const handoff = readFileSync(new URL("../resources/templates/handoff-site-doctor.md", import.meta.url), "utf8");
    // Il modello e' pieno di segnaposto: si verifica la sola riga del verdetto.
    assert.deepEqual(contrattoUscita("x.md", handoff.replace("{{VERDE}}", "VERDE").replace(/\{\{[^}]*\}\}/g, "—"), "VERDE"), []);
  });
});

describe("contratto d'uscita (§19)", () => {
  it("handoff assente: bloccante", () => {
    assert.equal(blocchi(contrattoUscita("docs/handoff/x.md", null, "ROSSO")).length, 1);
  });

  it("senza riga `Gate:`: bloccante", () => {
    const f = contrattoUscita("x.md", "# handoff\n\ntutto bene", "VERDE");
    assert.ok(blocchi(f).some((x) => /nessuna riga/.test(x.message)));
  });

  it("dichiarare rosso su un'esecuzione rossa PASSA: dichiarare non e' fallire", () => {
    assert.deepEqual(contrattoUscita("x.md", "Gate: ROSSO", "ROSSO"), []);
  });

  it("dichiarare VERDE su un'esecuzione rossa: bloccante, e dice qual e' quello vero", () => {
    const f = contrattoUscita("x.md", "Gate: VERDE", "ROSSO");
    assert.match(blocchi(f)[0].message, /Quello vero e' ROSSO/);
  });

  it("dichiarare ROSSO su un'esecuzione verde: bloccante (sabotaggio U)", () => {
    assert.equal(blocchi(contrattoUscita("x.md", "Gate: ROSSO", "VERDE")).length, 1);
  });

  it("la riga si scrive in elenco, in citazione o in grassetto: sono tre modi, non tre significati", () => {
    for (const riga of ["- Gate: VERDE", "> Gate: VERDE", "**Gate**: **VERDE**", "  Gate:  VERDE  "]) {
      assert.deepEqual(contrattoUscita("x.md", `# h\n${riga}\n`, "VERDE"), [], `non riconosciuta: ${riga}`);
    }
  });

  it("un handoff coi segnaposto del modello e' un bloccante", () => {
    assert.ok(blocchi(contrattoUscita("x.md", "Gate: VERDE\n{{DA COMPILARE}}", "VERDE")).length > 0);
  });

  it("il verdetto conta i mancanti come rossi, e gli `n/a` no", () => {
    assert.equal(verdettoDa([{ status: "pass" }, { status: "n/a" }]), "VERDE");
    assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
    assert.equal(verdettoDa([{ status: "fail" }]), "ROSSO");
  });
});
