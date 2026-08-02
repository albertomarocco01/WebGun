/**
 * Test delle regole che guardano il CODICE del progetto.
 *
 * Ogni regola ha il caso in cui SCATTA e quello in cui NON DEVE scattare: una
 * regola provata solo dove deve accendersi non dice niente sul rumore che fa
 * quando e' spenta, ed e' il rumore che fa scavalcare i rossi.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  argomentiOstiliACmd,
  conBarre,
  contaGravita,
  eCommento,
  formaEseguibile,
  frammentoNeiSorgenti,
  importazioni,
  normalizzaSpazi,
  primoEseguibile,
  puntaA,
  regolaChiaviEClient,
  regolaCucitura,
  righe,
  statoDaFindings,
} from "./audit-lib.mjs";

const CONFIG = {
  radicePubblica: "src/app",
  cucitura: "src/components/ui",
  primitive: ["Bottone", "Card", "Sezione"],
  moduliClient: ["src/lib/supabase/public.ts"],
};

const file = (percorso, testo) => ({ percorso, testo });

describe("primitivi", () => {
  it("toglie il BOM e regge il CRLF", () => {
    assert.deepEqual(righe("\uFEFFa\r\nb\nc"), ["a", "b", "c"]);
  });

  it("normalizza le barre dei percorsi di Windows", () => {
    assert.equal(conBarre("src\\components\\ui\\Bottone.tsx"), "src/components/ui/Bottone.tsx");
  });

  it("conta le gravita' e ne ricava lo stato del passo", () => {
    const findings = [{ severity: "block" }, { severity: "issue" }, { severity: "issue" }];
    assert.deepEqual(contaGravita(findings), { block: 1, issue: 2, warn: 0 });
    assert.equal(statoDaFindings(findings), "fail");
  });

  it("issue e warn NON rendono rosso il passo", () => {
    assert.equal(statoDaFindings([{ severity: "issue" }, { severity: "warn" }]), "pass");
    assert.equal(statoDaFindings([]), "pass");
  });

  it("riconosce le righe di commento, e solo quelle", () => {
    assert.equal(eCommento("  // niente service_role qui"), true);
    assert.equal(eCommento(" * usa service_role"), true);
    assert.equal(eCommento("const k = process.env.SERVICE_ROLE_KEY"), false);
  });
});

describe("eseguibili su Windows", () => {
  // `where npx` elenca PER PRIMO lo script senza estensione, per Git Bash, che
  // Windows non sa eseguire: prendere [0] fa fallire lo spawn su una macchina
  // dove il comando funziona. Prezzo gia' pagato da tre skill.
  it("sceglie la riga con estensione eseguibile, non la prima", () => {
    const uscita = "C:\\Program Files\\nodejs\\npx\r\nC:\\Program Files\\nodejs\\npx.cmd\r\n";
    assert.equal(primoEseguibile(uscita), "C:\\Program Files\\nodejs\\npx.cmd");
  });

  it("ripiega sulla prima riga se nessuna ha estensione eseguibile", () => {
    assert.equal(primoEseguibile("/usr/bin/psql\n"), "/usr/bin/psql");
  });

  it("uno shim .cmd si lancia via cmd.exe /c, un .exe direttamente", () => {
    assert.deepEqual(formaEseguibile("npx", () => "C:\\n\\npx.cmd", "win32"),
      { file: "cmd.exe", prefisso: ["/c", "C:\\n\\npx.cmd"] });
    assert.deepEqual(formaEseguibile("psql", () => "C:\\pg\\psql.exe", "win32"),
      { file: "C:\\pg\\psql.exe", prefisso: [] });
  });

  it("fuori da Windows non si tocca niente", () => {
    assert.deepEqual(formaEseguibile("psql", () => "/usr/bin/psql", "linux"), { file: "psql", prefisso: [] });
  });

  it("gli argomenti con spazi non sopravvivono a cmd /c, e si riconoscono prima", () => {
    assert.deepEqual(argomentiOstiliACmd(["--url=http://x", "--flag=a b"], "win32"), ["--flag=a b"]);
    assert.deepEqual(argomentiOstiliACmd(["--flag=a b"], "linux"), []);
  });
});

describe("importazioni", () => {
  it("legge nomi predefiniti, nominati, rinominati e spazi di nomi", () => {
    const testo = `import React from "react";
import { Bottone, Card as Scheda } from "@/components/ui";
import * as tutto from "./tutto";
import type { Props } from "./tipi";`;
    const trovate = importazioni(testo);
    assert.deepEqual(trovate.map((i) => i.da), ["react", "@/components/ui", "./tutto", "./tipi"]);
    assert.deepEqual(trovate[1].nomi, ["Bottone", "Card"]);
    assert.deepEqual(trovate[0].nomi, ["React"]);
  });

  // La regressione di Flow Sentinel: il ritaglio della clausola partiva dal
  // PRIMO import del file, quindi i nomi raccolti erano quelli di tutti gli
  // import precedenti messi insieme.
  it("non si porta dietro i nomi degli import precedenti", () => {
    const testo = `import { test, expect } from "@playwright/test";\nimport { Bottone } from "./altrove";`;
    const trovate = importazioni(testo);
    assert.equal(trovate.length, 2);
    assert.deepEqual(trovate[1].nomi, ["Bottone"]);
    assert.equal(trovate[1].da, "./altrove");
  });

  it("legge una clausola su piu' righe", () => {
    const testo = `import {\n  Bottone,\n  Sezione,\n} from "@/components/ui";`;
    assert.deepEqual(importazioni(testo)[0].nomi, ["Bottone", "Sezione"]);
  });

  it("non inventa importazioni dove non ce ne sono", () => {
    assert.deepEqual(importazioni("const x = 1; // import { Bottone } from 'altrove'"), []);
  });
});

describe("puntaA", () => {
  it("riconosce alias, percorsi relativi e percorsi da radice", () => {
    for (const da of ["@/components/ui", "~/components/ui", "../../components/ui", "src/components/ui", "@/components/ui/Bottone"]) {
      assert.equal(puntaA(da, "src/components/ui"), true, da);
    }
  });

  it("non scatta su cartelle diverse", () => {
    for (const da of ["@/components/marketing", "./ui-kit", "react", "@/lib/ui-utils"]) {
      assert.equal(puntaA(da, "src/components/ui"), false, da);
    }
  });
});

describe("regola: cucitura", () => {
  it("SCATTA su una primitiva importata da fuori la cucitura", () => {
    const findings = regolaCucitura([
      file("src/app/page.tsx", `import { Bottone } from "./Bottone";`),
    ], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /fuori la cucitura/);
  });

  it("NON scatta quando la primitiva arriva dalla cucitura", () => {
    const findings = regolaCucitura([
      file("src/app/page.tsx", `import { Bottone, Card } from "@/components/ui";`),
    ], CONFIG);
    assert.deepEqual(findings, []);
  });

  it("SCATTA quando la cucitura importa dominio o il client dei dati", () => {
    const findings = regolaCucitura([
      file("src/components/ui/Card.tsx", `import { leggiProdotti } from "@/modules/catalogo";`),
      file("src/components/ui/Sezione.tsx", `import { client } from "@/lib/supabase/public";`),
    ], CONFIG);
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.severity === "block"));
  });

  it("NON scatta se la cucitura importa react o un'altra primitiva", () => {
    const findings = regolaCucitura([
      file("src/components/ui/Card.tsx", `import { type ReactNode } from "react";\nimport { Bottone } from "./Bottone";`),
    ], CONFIG);
    assert.deepEqual(findings, []);
  });

  it("segnala come `issue` un file omonimo di una primitiva fuori dalla cucitura", () => {
    const findings = regolaCucitura([file("src/app/catalogo/Bottone.tsx", "export const Bottone = () => null;")], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
  });

  it("NON segnala la primitiva che sta dove deve stare", () => {
    assert.deepEqual(regolaCucitura([file("src/components/ui/Bottone.tsx", "export const Bottone = () => null;")], CONFIG), []);
  });
});

describe("regola: chiavi e client", () => {
  it("SCATTA su una chiave di servizio raggiungibile dal sito pubblico", () => {
    const findings = regolaChiaviEClient([
      file("src/lib/dati.ts", `const k = process.env.SUPABASE_SERVICE_ROLE_KEY;`),
    ], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.equal(findings[0].object, "src/lib/dati.ts:1");
  });

  it("NON scatta su un commento che nomina service_role", () => {
    const findings = regolaChiaviEClient([
      file("src/lib/supabase/public.ts", `// mai service_role qui: scavalca ogni policy\nexport const x = 1;`),
    ], CONFIG);
    assert.deepEqual(findings, []);
  });

  it("SCATTA su un client costruito fuori dai moduli dichiarati", () => {
    const findings = regolaChiaviEClient([
      file("src/app/catalogo/page.tsx", `const db = createClient(url, chiave);`),
    ], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /fuori dai moduli dichiarati/);
  });

  it("NON scatta sul modulo client dichiarato", () => {
    const findings = regolaChiaviEClient([
      file("src/lib/supabase/public.ts", `export const db = createClient(url, chiaveAnonima);`),
    ], CONFIG);
    assert.deepEqual(findings, []);
  });

  it("SCATTA su una variabile NEXT_PUBLIC_ che promette un segreto", () => {
    const findings = regolaChiaviEClient([
      file("src/lib/x.ts", `const k = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;`),
    ], CONFIG);
    assert.ok(findings.some((f) => /NEXT_PUBLIC_/.test(f.message)));
  });

  it("NON scatta sulla chiave anonima, che pubblica deve esserlo", () => {
    const findings = regolaChiaviEClient([
      file("src/lib/supabase/public.ts", `const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;`),
    ], CONFIG);
    assert.deepEqual(findings, []);
  });
});

describe("il frammento di uno slot nei sorgenti", () => {
  const sorgenti = [
    file("src/app/page.tsx", `<h1>\n  Il vivaio delle piante rare\n</h1>`),
    file("src/app/altro.tsx", "<p>niente</p>"),
  ];

  it("TROVA il testo cablato anche se nel JSX e' andato a capo", () => {
    assert.deepEqual(frammentoNeiSorgenti("Il vivaio delle piante rare", sorgenti), ["src/app/page.tsx"]);
  });

  it("NON trova un testo che nei sorgenti non c'e'", () => {
    assert.deepEqual(frammentoNeiSorgenti("Aperti la domenica mattina", sorgenti), []);
  });

  it("un frammento vuoto non trova niente", () => {
    assert.deepEqual(frammentoNeiSorgenti("   ", sorgenti), []);
  });

  it("normalizzaSpazi compatta a capo e rientri", () => {
    assert.equal(normalizzaSpazi("  a\n\n  b\t c "), "a b c");
  });
});
