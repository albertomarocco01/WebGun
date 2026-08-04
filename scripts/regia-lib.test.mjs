/**
 * Test delle regole del gate della regia.
 *
 * Ogni regola ha il caso in cui SCATTA e quello in cui NON DEVE scattare: una
 * regola provata solo dove deve accendersi non dice niente sul rumore che fa
 * quando e' spenta, ed e' il rumore che fa scavalcare i rossi.
 *
 * Diverse fixture qui sotto sono RIGHE VERE di questo repo, copiate: sono i casi
 * in cui una regola scritta un po' piu' larga avrebbe acceso un rosso su un
 * documento corretto. Il piu' istruttivo e' `DECISIONI.md` §19, che *nomina* i
 * segnaposto `{{…}}` invece di averne uno.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contaGravita,
  findingsDocx,
  findingsEpiloghi,
  findingsSegnaposto,
  findingsSkillElencate,
  findingsStato,
  righe,
  righeDiCodice,
  senzaCodice,
  sezione,
  skillDaPs1,
  skillDaReadme,
  statoDaFindings,
  tabellaAgenti,
} from "./regia-lib.mjs";

const file = (percorso, testo) => ({ percorso, testo });
const oggetti = (findings) => findings.map((f) => f.object);

describe("primitivi", () => {
  it("toglie il BOM e regge il CRLF", () => {
    assert.deepEqual(righe("\uFEFFa\r\nb\nc"), ["a", "b", "c"]);
  });

  it("un `block` fa rosso, un `issue` da solo no", () => {
    assert.equal(statoDaFindings([{ severity: "issue" }]), "pass");
    assert.equal(statoDaFindings([{ severity: "issue" }, { severity: "block" }]), "fail");
    assert.deepEqual(contaGravita([{ severity: "block" }, { severity: "issue" }]), { block: 1, issue: 1, warn: 0 });
  });
});

describe("sezione", () => {
  const documento = [
    "# Titolo",
    "riga fuori",
    "## Prima",
    "contenuto uno",
    "### Sotto",
    "contenuto due",
    "## Seconda",
    "contenuto tre",
  ].join("\n");

  it("prende le righe della sezione, sottosezioni comprese, e si ferma alla prossima `##`", () => {
    assert.deepEqual(sezione(documento, "Prima"), ["contenuto uno", "### Sotto", "contenuto due"]);
  });

  it("non trova quello che non c'e', e `null` non e' una sezione vuota", () => {
    assert.equal(sezione(documento, "Terza"), null);
  });

  it("il titolo si confronta normalizzato: maiuscole e spazi doppi non fanno perdere la sezione", () => {
    assert.deepEqual(sezione("## NATURA  degli Agenti\nriga", "natura degli agenti"), ["riga"]);
  });
});

// ------------------------------------------------------------ epiloghi-vivi
describe("epiloghi-vivi", () => {
  it("SCATTA sulla guardia viva, con riga e file", () => {
    const findings = findingsEpiloghi([file("agenti/x/scripts/verify.mjs", [
      "async function main() {}",
      "if (import.meta.main) await main();",
    ].join("\n"))]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.equal(findings[0].object, "agenti/x/scripts/verify.mjs:2");
  });

  it("NON scatta sul commento che spiega perche' non si usa — e' l'epilogo vero di tutte e cinque le skill", () => {
    // Dal 2026-08-04 (P.0-igiene-2) l'epilogo vero e' a doppio confronto: il
    // solo `resolve` non scioglie una junction, e i cinque gate invocati da
    // `.claude/skills/...` uscivano 0 muti. La regola non guarda la FORMA della
    // guardia — vieta un token — e quindi non scatta ne' prima ne' dopo: qui si
    // verifica che continui a non scattare sulla riga vera di oggi.
    const findings = findingsEpiloghi([file("agenti/schema-forge/scripts/verify.mjs", [
      "// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale",
      "// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente.",
      "if (process.argv[1]) {",
      "  const questoModulo = fileURLToPath(import.meta.url);",
      "  const invocato = resolve(process.argv[1]);",
      "  let invocatoReale = invocato;",
      "  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }",
      "  if (invocato === questoModulo || invocatoReale === questoModulo) await main();",
      "}",
    ].join("\n"))]);
    assert.deepEqual(findings, []);
  });

  it("NON scatta sulla stringa dentro il test che verifica che la guardia non ci sia", () => {
    // Riga vera di `agenti/*/scripts/verify.test.mjs`, dai test di P.0-igiene.
    const findings = findingsEpiloghi([file("agenti/speed-demon/scripts/verify.test.mjs",
      'const colpevoli = righeDiCodice.filter((riga) => riga.includes("import.meta.main"));')]);
    assert.deepEqual(findings, []);
  });

  it("NON scatta dentro un commento di blocco su piu' righe, e riprende a guardare dopo", () => {
    const findings = findingsEpiloghi([file("x.mjs", [
      "/**",
      " * Il difetto: `if (import.meta.main) main();`",
      " */",
      "if (import.meta.main) main();",
    ].join("\n"))]);
    assert.deepEqual(oggetti(findings), ["x.mjs:4"]);
  });

  it("NON scatta dentro un template literal su piu' righe: i backtick attraversano le righe", () => {
    const findings = findingsEpiloghi([file("x.mjs", [
      "const messaggio = `prima riga",
      "  if (import.meta.main) main();",
      "`;",
    ].join("\n"))]);
    assert.deepEqual(findings, []);
  });
});

describe("righeDiCodice", () => {
  it("toglie il commento di coda ma tiene il codice che lo precede", () => {
    assert.equal(righeDiCodice("const a = 1; // import.meta.main")[0].codice.trim(), "const a = 1;");
  });

  it("una virgoletta spaiata NON si porta dietro la riga dopo", () => {
    const fuori = righeDiCodice(["const a = \"apre e non chiude", "if (import.meta.main) main();"].join("\n"));
    assert.ok(fuori[1].codice.includes("import.meta.main"));
  });
});

// -------------------------------------------------------- segnaposto-radice
describe("segnaposto-radice", () => {
  it("SCATTA su un segnaposto di template rimasto in prosa", () => {
    const findings = findingsSegnaposto([file("PROGETTO.md", "Il committente e' {{nome_cliente}} e firma il contratto.")]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].object, "PROGETTO.md:1");
    assert.match(findings[0].message, /\{\{nome_cliente\}\}/);
  });

  it("NON scatta su `{{…}}`, che NOMINA la classe dei segnaposto — riga vera di DECISIONI.md §19", () => {
    const findings = findingsSegnaposto([file("DECISIONI.md",
      "Il passo `contratto-uscita` verificava che il file esistesse e non avesse segnaposto `{{…}}`. Nient'altro.")]);
    assert.deepEqual(findings, []);
  });

  it("NON scatta dentro un blocco di codice: e' li' che un documento cita un template", () => {
    const findings = findingsSegnaposto([file("README.md", ["prosa", "```md", "Confermato da: {{nome_e_ruolo}}", "```", "altra prosa"].join("\n"))]);
    assert.deepEqual(findings, []);
  });

  it("NON scatta su una parentesi graffa singola o su `{{}}` vuoto", () => {
    assert.deepEqual(findingsSegnaposto([file("x.md", "const a = { b: 1 } e poi {{}} e {{ }}")]), []);
  });

  it("senzaCodice svuota il blocco recintato ma non perde la numerazione delle righe", () => {
    assert.deepEqual(senzaCodice(["a", "```", "b", "```", "c"].join("\n")), ["a", "", "", "", "c"]);
  });
});

// ---------------------------------------------------- lettura degli elenchi
describe("lettura degli elenchi dichiarati", () => {
  const README = [
    "## Natura degli agenti",
    "",
    "| Nome | Categoria | Stato | Proprietario | Repo di origine |",
    "|---|---|---|---|---|",
    "| code-maniac | Skill Claude Code | 🟢 | finzidev | https://github.com/finzidev/code-maniac |",
    "| schema-forge | Skill Claude Code | 🟢\\* | Alberto | questo repo |",
    "| site-doctor | Skill Claude Code | 🔵 | — | questo repo |",
    "",
    "## Installazione delle skill",
    "",
    "Installa **schema-forge**, **gestionale-crafter** e **code-inquisition** — le sole vere.",
    "",
    "**Chi ha gia' installato prima del 2026-07-30 rilanci lo script:** eccetera.",
  ].join("\n");

  it("legge la tabella §Natura: stato 🟢 anche con la nota a pie' di pagina, e chi e' di casa", () => {
    const tabella = tabellaAgenti(README);
    assert.equal(tabella.size, 3);
    assert.equal(tabella.get("schema-forge").verde, true);
    assert.equal(tabella.get("schema-forge").diCasa, true);
    assert.equal(tabella.get("code-maniac").diCasa, false);
    assert.equal(tabella.get("site-doctor").verde, false);
  });

  it("senza tabella risponde `null`, e `null` non e' una tabella vuota", () => {
    assert.equal(tabellaAgenti("# Documento senza tabella"), null);
  });

  it("legge l'array `$skill` del .ps1", () => {
    assert.deepEqual(skillDaPs1('$skill = @("uno", "due", "tre")'), ["uno", "due", "tre"]);
    assert.deepEqual(skillDaPs1("# nessun array qui\nWrite-Host 'ciao'"), null);
  });

  it("legge la frase «Installa **…**» e NON i grassetti degli altri paragrafi della sezione", () => {
    assert.deepEqual(skillDaReadme(README), ["schema-forge", "gestionale-crafter", "code-inquisition"]);
  });

  it("senza la frase risponde `null`", () => {
    assert.equal(skillDaReadme("## Installazione delle skill\n\nSi installano con lo script."), null);
  });
});

// ------------------------------------------------------------ skill-elencate
describe("skill-elencate", () => {
  const tabella = new Map([
    ["schema-forge", { nome: "schema-forge", stato: "🟢", origine: "questo repo", verde: true, diCasa: true }],
    ["site-doctor", { nome: "site-doctor", stato: "🔵", origine: "questo repo", verde: false, diCasa: true }],
    ["code-inquisition", { nome: "code-inquisition", stato: "🟢", origine: "esterno", verde: true, diCasa: false }],
  ]);
  const cartelle = [
    { nome: "schema-forge", haVerify: true, haStato: true, haSkill: true },
    { nome: "site-doctor", haVerify: false, haStato: true, haSkill: true },
    { nome: "code-inquisition", haVerify: false, haStato: false, haSkill: true },
  ];

  it("NON scatta quando i due elenchi combaciano e ogni 🟢 di casa e' in tutti e due", () => {
    const { findings } = findingsSkillElencate({
      cartelle, tabella,
      ps1: ["schema-forge", "code-inquisition"],
      readme: ["schema-forge", "code-inquisition"],
    });
    assert.deepEqual(findings, []);
  });

  it("SCATTA quando il README elenca una skill che lo script non installa — il difetto di speed-demon, 2026-07-30", () => {
    const { findings } = findingsSkillElencate({
      cartelle, tabella,
      ps1: ["code-inquisition"],
      readme: ["schema-forge", "code-inquisition"],
    });
    // Due rilievi: il disallineamento fra i due elenchi, e la skill 🟢 di casa
    // che nessuno puo' installare.
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.severity === "block"));
    assert.deepEqual(oggetti(findings).sort(), ["README.md §Installazione → schema-forge", "agenti/schema-forge"]);
  });

  it("SCATTA quando lo script nomina una cartella che non esiste", () => {
    const { findings } = findingsSkillElencate({
      cartelle, tabella,
      ps1: ["schema-forge", "code-inquisition", "fantasma"],
      readme: ["schema-forge", "code-inquisition", "fantasma"],
    });
    assert.deepEqual(oggetti(findings), ["scripts/installa-skill.ps1 → fantasma"]);
    assert.match(findings[0].message, /SALTATA/);
  });

  it("NON pretende in elenco una skill con `verify.mjs` che la tabella non dichiara 🟢, e la NOMINA fra le esenti", () => {
    // E' il caso di `vetrina-crafter` al 2026-08-03: gate scritto, P.2 non
    // chiusa. La regola di casa dice che entra in elenco a gate verde, e un
    // rosso strutturale insegna a scavalcare i rossi veri.
    const conVetrina = [...cartelle, { nome: "vetrina-crafter", haVerify: true, haStato: true, haSkill: true }];
    const { findings, esenti } = findingsSkillElencate({
      cartelle: conVetrina, tabella,
      ps1: ["schema-forge", "code-inquisition"],
      readme: ["schema-forge", "code-inquisition"],
    });
    assert.deepEqual(findings, []);
    assert.deepEqual(esenti.map((e) => e.nome), ["vetrina-crafter"]);
    assert.match(esenti[0].perche, /non la dichiara affatto/);
  });

  it("il giorno che la tabella la dichiara 🟢, i due elenchi diventano obbligatori", () => {
    const conVetrina = [...cartelle, { nome: "vetrina-crafter", haVerify: true, haStato: true, haSkill: true }];
    const tabellaVerde = new Map(tabella).set("vetrina-crafter",
      { nome: "vetrina-crafter", stato: "🟢", origine: "questo repo", verde: true, diCasa: true });
    const { findings, esenti } = findingsSkillElencate({
      cartelle: conVetrina, tabella: tabellaVerde,
      ps1: ["schema-forge", "code-inquisition"],
      readme: ["schema-forge", "code-inquisition"],
    });
    assert.equal(findings.length, 2);
    assert.deepEqual(esenti, []);
  });
});

// ----------------------------------------------------------- stato-presente
describe("stato-presente", () => {
  const tabella = new Map([
    ["code-maniac", { nome: "code-maniac", origine: "https://github.com/finzidev/code-maniac", verde: true, diCasa: false }],
    ["schema-forge", { nome: "schema-forge", origine: "questo repo", verde: true, diCasa: true }],
  ]);

  it("SCATTA su un agente di casa senza STATO.md", () => {
    const { findings, saltate } = findingsStato({
      cartelle: [{ nome: "schema-forge", haStato: false }],
      tabella,
    });
    assert.deepEqual(oggetti(findings), ["agenti/schema-forge"]);
    assert.deepEqual(saltate, []);
  });

  it("NON scatta sullo snapshot esterno, e lo DICE invece di farlo sparire", () => {
    const { findings, saltate } = findingsStato({
      cartelle: [{ nome: "code-maniac", haStato: false }, { nome: "schema-forge", haStato: true }],
      tabella,
    });
    assert.deepEqual(findings, []);
    assert.deepEqual(saltate.map((s) => s.nome), ["code-maniac"]);
  });

  it("una cartella che la tabella non nomina conta come di casa: il verso prudente e' chiedere lo STATO.md", () => {
    const { findings } = findingsStato({ cartelle: [{ nome: "agente-nuovo", haStato: false }], tabella });
    assert.deepEqual(oggetti(findings), ["agenti/agente-nuovo"]);
  });
});

// ---------------------------------------------------------------- docx-txt
describe("docx-txt", () => {
  it("NON scatta quando la riestrazione e il tracciato sono identici", () => {
    const testo = "riga uno\nriga due\n";
    const { findings, diverse } = findingsDocx({ attesa: testo, trovata: testo });
    assert.deepEqual(findings, []);
    assert.equal(diverse, 0);
  });

  it("SCATTA e dice QUALI righe: il caso di §26, dove il .txt diceva «[Da creare]» e il .docx «[Ce l'ho]»", () => {
    const { findings, diverse, prime } = findingsDocx({
      attesa: "Gestionale Crafter [Ce l'ho]\nFlow Sentinel [Ce l'ho]\n",
      trovata: "Gestionale Crafter [Da creare]\nFlow Sentinel [Ce l'ho]\n",
    });
    assert.equal(diverse, 1);
    assert.equal(findings[0].severity, "block");
    assert.equal(findings[0].object, "webgun_content.txt");
    assert.deepEqual(prime, [{ numero: 1, attesa: "Gestionale Crafter [Ce l'ho]", trovata: "Gestionale Crafter [Da creare]" }]);
  });

  it("conta anche le righe che il tracciato non ha affatto", () => {
    const { diverse, prime } = findingsDocx({ attesa: "a\nb\nc\n", trovata: "a\n" });
    assert.equal(diverse, 2);
    assert.equal(prime[0].trovata, "<fine file>");
  });

  it("il CRLF non e' una differenza: si normalizza all'ingresso", () => {
    const { findings } = findingsDocx({ attesa: "a\nb\n", trovata: "a\r\nb\r\n" });
    assert.deepEqual(findings, []);
  });

  it("si ferma alle prime cinque righe diverse, ma le conta tutte", () => {
    const { diverse, prime } = findingsDocx({
      attesa: Array.from({ length: 20 }, (_, i) => `a${i}`).join("\n"),
      trovata: Array.from({ length: 20 }, (_, i) => `b${i}`).join("\n"),
    });
    assert.equal(diverse, 20);
    assert.equal(prime.length, 5);
  });
});
