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
    // `doppie` = quante intestazioni combaciano (tribunale P.6-P4): zero se la
    // sezione non c'e', una se c'e' una volta sola.
    assert.deepEqual(tabellaSotto("# X", /voci/i), { sezionePresente: false, righe: [], doppie: 0 });
    assert.deepEqual(tabellaSotto("## Voci di conformità\n\ntesto e basta", /voci di conformit/i), { sezionePresente: true, righe: [], doppie: 1 });
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

  // Collaudo P2. Il `_` veniva tolto insieme a `*` e `` ` ``, e nei nomi che
  // questo documento esiste per dichiarare il `_` e' un carattere, non un
  // marcatore: `sl_sessione` diventava `slsessione` e non combaciava piu' col
  // cookie misurato. Rosso su un certificato corretto, nelle due meta' del gate.
  it("tiene l'underscore dentro un nome: e' un carattere, non un'enfasi", () => {
    const t = tabellaSotto(
      "## A\n\n| chiave | campo |\n|---|---|\n| sl_sessione | pec_studio |\n| _ga | codice_fiscale |\n| __Host-sess | data_di_nascita |",
      /^##\s*A/i,
    );
    assert.deepEqual(t.righe, [
      { chiave: "sl_sessione", campo: "pec_studio" },
      { chiave: "_ga", campo: "codice_fiscale" },
      { chiave: "__Host-sess", campo: "data_di_nascita" },
    ]);
  });

  it("toglie ancora l'enfasi vera, con l'underscore fuori parola", () => {
    const t = tabellaSotto(
      "## A\n\n| voce | nota |\n|---|---|\n| _canonical_ | __obbligatorio__ |\n| *favicon* | **alto** |",
      /^##\s*A/i,
    );
    assert.deepEqual(t.righe, [
      { voce: "canonical", nota: "obbligatorio" },
      { voce: "favicon", nota: "alto" },
    ]);
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

  // Collaudo P2: le voci scoperte NON sono una. Sette deleghe su nove sono
  // state misurate vuote leggendo il gate del vicino invece della sua prosa —
  // fra queste la favicon, che e' la voce da cui questa skill e' nata.
  // D21, 2026-08-06: cinque delle otto sono tornate a casa. Non perche' il
  // vicino abbia aggiunto il passo, ma perche' la proprieta' segue la misura —
  // e ognuna ha ora un passo suo, confrontato dal §19.
  // P.6-P5, 2026-08-07: `contrasti` e' uscita NEL MODO PRESCRITTO — il vicino
  // ha aggiunto il passo `contrasto` (legge `report.audits["color-contrast"]`)
  // e il grep rilanciato lo misura: 4 file. Restano due.
  const SCOPERTE_ATTESE = ["accessibilita-admin", "antispam"];

  it("una tabella completa e coerente produce SOLO le voci scoperte, e sono due", () => {
    const f = perimetro(RIGHE_BUONE);
    assert.deepEqual(blocchi(f), []);
    assert.deepEqual(f.map((x) => x.object).sort(), [...SCOPERTE_ATTESE].sort());
    assert.match(f.find((x) => x.object === "antispam").message, /SCOPERTA/);
  });

  // I due versi della regola con cui una riga entra ed esce da SCOPERTE:
  // il verso che RESTA (delega dichiarata ma il gate del vicino misura solo i
  // sorgenti: issue con la misura e il commit) e il verso che SI TOGLIE (il
  // gate del vicino ha il passo, misurato col grep: nessun issue).
  it("verso ↑: una delega che il gate del vicino non guarda come servito e' un rilievo, e nomina la misura E il commit", () => {
    const f = perimetro(RIGHE_BUONE);
    const adm = f.find((x) => x.object === "accessibilita-admin");
    assert.equal(adm.severity, "issue");
    assert.match(adm.message, /il suo GATE non la guarda/);
    assert.match(adm.message, /SORGENTI/);
    // D18 §3: una misura che dipende dal vicino porta il commit della regia a
    // cui si riferisce, o non e' ripetibile.
    assert.match(adm.message, /sulla regia a `[0-9a-f]{7}`/);
    assert.match(adm.message, /nominare non e' misurare/);
  });

  it("verso ↓: una voce delegata a un vicino il cui GATE la guarda non produce l'issue", () => {
    const f = perimetro(RIGHE_BUONE);
    assert.equal(f.find((x) => x.object === "contrasti"), undefined,
      "dal 2026-08-07 il gate di speed-demon ha il passo `contrasto` (grep rilanciato: 4 file): la voce non e' piu' scoperta");
  });

  it("le tre deleghe che REGGONO non producono nessun rilievo", () => {
    const f = perimetro(RIGHE_BUONE);
    for (const id of ["canonical", "noindex-private", "contrasti"]) {
      assert.equal(f.find((x) => x.object === id), undefined, `${id} e' misurata davvero dal gate di speed-demon: non deve comparire`);
    }
  });

  it("IL DIFETTO: una voce con due proprietari e' una voce di nessuno", () => {
    // La forma esatta del 2026-08-06: l'Open Graph assegnato a speed-demon E a
    // site-doctor nello stesso documento. Dopo D21 la voce e' mia, quindi la
    // riga di troppo e' quella che la ridelega al vicino — la contesa e' la
    // stessa, girata di 180 gradi.
    const f = perimetro(`${RIGHE_BUONE}\n| open-graph | speed-demon | docs/handoff/13.md | delegato |`);
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

  it("l'elenco delle voci copre le undici mie e le cinque degli altri", () => {
    assert.equal(VOCI.length, 16);
    assert.equal(VOCI.filter((v) => v.mio).length, 11);
    assert.deepEqual(
      VOCI.filter((v) => v.mio).map((v) => v.mio).sort(),
      ["accessibilita-servita", "archiviazione-client", "archiviazione-client", "dati-raccolti", "dati-strutturati",
        "favicon", "informativa-privacy", "lingua-e-hreflang", "open-graph", "robots-txt", "sitemap-xml"],
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
      // Dopo D21 il modello delega `contrasti` a `docs/performance.md` (che ne
      // dichiara la soglia) e non piu' all'handoff: sono due file diversi, e
      // devono esistere tutti e due.
      leggiFile: (p) => (p.startsWith("docs/handoff/") || p === "docs/performance.md"
        ? "canonical sitemap robots noindex Open Graph favicon dati strutturati contrasti accessibilità"
        : null),
      statiPassi: stati,
    });
    assert.deepEqual(blocchi(f), [], "il modello della casa non deve produrre bloccanti sul gate della casa");
    assert.deepEqual(
      f.map((x) => x.object).sort(),
      VOCI.filter((v) => v.id === "antispam" || v.scoperta).map((v) => v.id).sort(),
      "il modello deve produrre esattamente le voci che una misura ha dichiarato scoperte, e nient'altro",
    );
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

// ═══════════════════════════════════════ il tribunale del 2026-08-06 (P.6-P3)
describe("tribunale P.6-P3 — i documenti che scrive l'imputato", () => {
  const certificato = (firma) =>
    `Confermato da: ${firma}\nLingue dichiarate: it\n\n## Voci di conformita' e proprieta'\n\n| voce | proprietario | dove e' dichiarato | esito |\n|---|---|---|---|\n| antispam | — | — | scoperto |\n`;
  const blocchiDi = (f) => f.filter((x) => x.severity === "block");

  describe("SD-TRIB-D2: un'intestazione che il gate non sa leggere non e' una tabella vuota", () => {
    it("falso verde: con `responsabile` al posto di `proprietario` tutto diventava SCOPERTA e il passo passava", () => {
      const tabella = { sezionePresente: true, righe: [{ voce: "open-graph", responsabile: "speed-demon", esito: "delegato" }] };
      const f = findingsPerimetro({ tabella, leggiFile: () => null, statiPassi: new Map() });
      assert.equal(blocchiDi(f).length, 1);
      assert.match(f[0].message, /intestazione della tabella/);
    });

    it("l'intestazione giusta continua a funzionare", () => {
      const tabella = { sezionePresente: true, righe: [{ voce: "antispam", proprietario: "—", "dove e dichiarato": "—", esito: "scoperto" }] };
      const f = findingsPerimetro({ tabella, leggiFile: () => null, statiPassi: new Map() });
      assert.equal(f.some((x) => x.object === "antispam" && x.severity === "issue"), true);
    });
  });

  describe("SD-TRIB-D4: una data non e' una firma", () => {
    it("falso verde: un trattino, o la sola data", () => {
      assert.ok(blocchiDi(findingsCertificato(leggiCertificato(certificato("— il 2026-08-06")))).length > 0);
      assert.ok(blocchiDi(findingsCertificato(leggiCertificato(certificato("2026-08-06")))).length > 0);
    });

    it("falso verde: una delega che non nomina nessuno (D14)", () => {
      assert.ok(blocchiDi(findingsCertificato(leggiCertificato(certificato("Direzione lavori (per delega del committente ) il 2026-08-06")))).length > 0);
      assert.ok(blocchiDi(findingsCertificato(leggiCertificato(certificato("per delega il 2026-08-06")))).length > 0);
    });

    it("una firma vera e una delega dichiarata per esteso passano", () => {
      assert.deepEqual(blocchiDi(findingsCertificato(leggiCertificato(certificato("Alberto Marocco il 2026-08-06")))), []);
      assert.deepEqual(blocchiDi(findingsCertificato(leggiCertificato(certificato("Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06")))), []);
    });
  });

  describe("SD-TRIB-D5: un esempio dentro un blocco recintato non e' una dichiarazione", () => {
    it("falso verde: l'handoff ricopia il fac-simile del modello e non scrive niente di suo", () => {
      const h = "# Handoff\n\nIstruzioni dal modello, non ancora sostituite:\n\n```\nGate: ROSSO\n```\n\nTODO: scrivere cosa e' successo davvero.\n";
      const f = contrattoUscita("x.md", h, "ROSSO");
      assert.equal(f.length, 1);
      assert.match(f[0].message, /blocco di codice/);
    });

    it("il blockquote resta uno dei tre modi di scrivere la riga, non un terzo significato", () => {
      assert.deepEqual(contrattoUscita("x.md", "# h\n> Gate: VERDE\n", "VERDE"), []);
    });
  });

  describe("SD-TRIB-D6: una seconda tabella nella stessa sezione non si fonde con la prima", () => {
    it("falso rosso e attribuzione sbagliata: l'intestazione della seconda diventava una riga di dati", () => {
      const due = "## Voci di conformita'\n\n| voce | proprietario |\n|---|---|\n| a | b |\n\ntesto in mezzo\n\n| nota | draft |\n|---|---|\n| c | d |\n";
      assert.deepEqual(tabellaSotto(due, /voci di conformit/i).righe, [{ voce: "a", proprietario: "b" }]);
    });

    it("una pipe con l'escape e' una pipe, non un separatore", () => {
      assert.deepEqual(tabellaSotto("## X\n\n| a | b |\n|---|---|\n| uno \\| due | tre |\n", /X/).righe[0], { a: "uno | due", b: "tre" });
    });
  });

  it("SD-TRIB-D7: uno stato sconosciuto e' ROSSO anche per `verdettoDa`", () => {
    assert.equal(verdettoDa([{ status: "pass" }, { status: "skip" }]), "ROSSO");
    assert.equal(verdettoDa([{ status: "pass" }, { status: "n/a" }]), "VERDE");
    assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
  });
});

// ---------------------------------------------------------------------------
// Tribunale P.6-P4 — il primo rilievo del perito del certificato.
// `fc5c0f6` aveva chiuso «come leggo le COLONNE della tabella che ho trovato».
// Restava aperto «QUALE intestazione trovo», ed e' la stessa classe.
describe("tribunale P.6-P4 — due sezioni con lo stesso nome, e il blocco recintato", () => {
  const TESTA = ["# Certificato di idoneita'", "", "Confermato da: Alberto Marocco il 2026-08-07", "", "Lingue dichiarate: it", ""];
  const TAB = (proprietario, esito) => [
    "| voce | proprietario | dove e dichiarato | esito |",
    "|---|---|---|---|",
    `| antispam | ${proprietario} | ${esito === "scoperto" ? "—" : "CHANGELOG.md"} | ${esito} |`,
    "",
  ];
  const doc = (...parti) => [...TESTA, ...parti].join("\n");

  it("due sezioni «Voci di conformita'» non si scelgono in silenzio: si dichiarano", () => {
    const testo = doc(
      "## Voci di conformita' e proprieta'", "", ...TAB("vetrina-crafter", "conforme"),
      "## Voci di conformita' e proprieta'", "", ...TAB("scoperto", "scoperto"),
    );
    const t = tabellaSotto(testo, /voci di conformit/i);
    assert.equal(t.doppie, 2, "la funzione deve sapere quante intestazioni combaciano");

    const blocchi = findingsCertificato(leggiCertificato(testo)).filter((f) => f.severity === "block");
    assert.equal(blocchi.length, 1, "una sola ragione, e chiara");
    assert.match(blocchi[0].message, /2 sezioni «Voci di conformita' e proprieta'»/);
    // La ragione per cui e' `block` e non `issue`: su una voce DELEGATA nessun
    // confronto con l'esecuzione esiste, quindi la tabella sbagliata E' il
    // verdetto e nessuno se ne accorgerebbe.
    assert.match(blocchi[0].message, /delegata|delegat/i);
  });

  it("una tabella dentro un blocco recintato e' un esempio, non una dichiarazione", () => {
    const testo = doc(
      "Esempio di come si compila questa sezione:", "",
      "```markdown",
      "## Voci di conformita' e proprieta'", "",
      ...TAB("un-vicino-inventato", "conforme"),
      "```", "",
      "## Voci di conformita' e proprieta'", "", ...TAB("scoperto", "scoperto"),
    );
    const t = tabellaSotto(testo, /voci di conformit/i);
    // Prima leggeva SEDICI righe dal blocco recintato e non arrivava mai alla
    // sezione vera sotto, che dichiarava onestamente «scoperto».
    assert.equal(t.righe.length, 1);
    assert.equal(t.righe[0].proprietario, "scoperto");
    assert.equal(t.doppie, 1, "l'intestazione dentro il blocco non conta come sezione");
    assert.deepEqual(findingsCertificato(leggiCertificato(testo)).filter((f) => f.severity === "block"), []);
  });

  it("un certificato con UNA sola sezione non guadagna rilievi nuovi", () => {
    const testo = doc("## Voci di conformita' e proprieta'", "", ...TAB("scoperto", "scoperto"));
    const t = tabellaSotto(testo, /voci di conformit/i);
    assert.equal(t.doppie, 1);
    assert.deepEqual(findingsCertificato(leggiCertificato(testo)).filter((f) => f.severity === "block"), []);
  });

  it("la regola vale per tutte e quattro le sezioni a tabella, non solo per le voci", () => {
    const testo = doc(
      "## Dati raccolti", "", "| campo | base giuridica |", "|---|---|", "| email | consenso |", "",
      "## Dati raccolti", "", "| campo | base giuridica |", "|---|---|", "| email | contratto |", "",
      "## Voci di conformita' e proprieta'", "", ...TAB("scoperto", "scoperto"),
    );
    const blocchi = findingsCertificato(leggiCertificato(testo)).filter((f) => f.severity === "block");
    assert.equal(blocchi.length, 1);
    assert.match(blocchi[0].message, /2 sezioni «Dati raccolti»/);
  });
});
