import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  HANDOFF,
  chiaviDiPrimoLivello,
  contrattoUscita,
  normalizzaTipi,
  regolaEntitaAncorate,
  tabelleDaiTipi,
  urlDbProgetto,
  validaConfig,
  valoreToml,
  verdettoDa,
} from "./progetto-lib.mjs";

// La forma vera di `supabase gen types typescript`, ridotta ma non inventata:
// due schemi, `Tables` con dentro `Row`/`Insert`/`Update`, e lo schema vuoto
// scritto come `[_ in never]: never`.
const TIPI = `
export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      orders: {
        Row: { id: string; status: string }
        Insert: { id?: string }
        Update: { id?: string }
      }
      staff: {
        Row: { id: string; ruolo: string }
      }
    }
    Views: {
      [_ in never]: never
    }
  }
}
`;

describe("tabelleDaiTipi", () => {
  it("legge le tabelle dello schema public", () => {
    assert.deepEqual(tabelleDaiTipi(TIPI), ["orders", "staff"]);
  });

  it("non prende le tabelle di un altro schema", () => {
    assert.equal(tabelleDaiTipi(TIPI, "graphql_public").length, 0);
  });

  it("uno schema che non esiste non produce tabelle inventate", () => {
    assert.deepEqual(tabelleDaiTipi(TIPI, "shop"), []);
  });

  it("un file vuoto non produce tabelle", () => {
    assert.deepEqual(tabelleDaiTipi(""), []);
  });
});

describe("chiaviDiPrimoLivello", () => {
  it("ignora le chiavi annidate", () => {
    assert.deepEqual(chiaviDiPrimoLivello("{ a: { b: 1 }, c: 2 }"), ["a", "c"]);
  });
});

describe("validaConfig", () => {
  const buona = { adminRoot: "src/app/admin", guardie: ["richiediStaff"], entita: [] };

  it("una configurazione completa non ha errori", () => {
    assert.deepEqual(validaConfig(buona).errori, []);
  });

  it("segnala le chiavi mancanti", () => {
    assert.equal(validaConfig({ adminRoot: "x" }).errori.length, 2);
  });

  it("`guardie` vuoto e' un errore, non un dettaglio", () => {
    const { errori } = validaConfig({ ...buona, guardie: [] });
    assert.equal(errori.length, 1);
    assert.match(errori[0], /non puo' scattare mai/);
  });

  it("un file che non e' un oggetto non passa", () => {
    assert.equal(validaConfig(null).errori.length, 1);
  });
});

describe("regolaEntitaAncorate", () => {
  const config = {
    adminRoot: "src/app/admin",
    entita: [{ tabella: "orders", rotta: "ordini" }],
    escluse: [
      { tabella: "order_items", motivo: "si gestiscono dentro la scheda dell'ordine, dove il totale ha senso" },
    ],
  };
  const rottaEsiste = () => true;

  it("passa quando ogni tabella ha una vista o una motivazione", () => {
    assert.deepEqual(regolaEntitaAncorate(["orders", "order_items"], config, rottaEsiste), []);
  });

  it("blocca la tabella che nessuno ha nominato", () => {
    const findings = regolaEntitaAncorate(["orders", "order_items", "staff"], config, rottaEsiste);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].object, "staff");
    assert.equal(findings[0].severity, "block");
  });

  it("blocca un'esclusione senza motivazione leggibile", () => {
    const magra = { ...config, escluse: [{ tabella: "order_items", motivo: "no" }] };
    const findings = regolaEntitaAncorate(["orders", "order_items"], magra, rottaEsiste);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /motivazione leggibile/);
  });

  it("blocca l'entita' dichiarata la cui rotta non esiste", () => {
    const findings = regolaEntitaAncorate(["orders", "order_items"], config, () => false);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /la rotta `ordini` non esiste/);
  });

  it("blocca l'entita' dichiarata che nello schema non c'e'", () => {
    const findings = regolaEntitaAncorate(["order_items"], config, rottaEsiste);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /nello schema non esiste/);
  });
});

describe("verdettoDa", () => {
  it("basta un passo non `pass` per il rosso", () => {
    assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
    assert.equal(verdettoDa([{ status: "pass" }, { status: "fail" }]), "ROSSO");
    assert.equal(verdettoDa([{ status: "pass" }]), "VERDE");
  });
});

describe("contrattoUscita", () => {
  const esiste = () => true;
  const con = (testo) => contrattoUscita(esiste, () => testo, "ROSSO");

  it("fallisce se l'handoff non c'e'", () => {
    const esito = contrattoUscita(() => false, () => "", "VERDE");
    assert.equal(esito.status, "fail");
    assert.match(esito.detail, new RegExp(HANDOFF.replace(/[/.]/g, "\\$&")));
  });

  it("dichiarare ROSSO su un gate rosso PASSA: la regola vieta di mentire, non di consegnare un rosso", () => {
    assert.equal(con("## Residui\n\nGate: ROSSO (1 fallito)").status, "pass");
  });

  it("fallisce se l'handoff dichiara un verdetto diverso", () => {
    const esito = con("Gate: VERDE");
    assert.equal(esito.status, "fail");
    assert.match(esito.detail, /parla di un'altra esecuzione/);
  });

  it("fallisce se il verdetto non c'e' affatto", () => {
    const esito = con("Tutto bene, nessun problema rilevante.");
    assert.equal(esito.status, "fail");
    assert.match(esito.detail, /non dichiara il verdetto/);
  });

  it("riconosce la riga dentro un elenco, una citazione o del grassetto", () => {
    for (const forma of ["- Gate: ROSSO", "> Gate: ROSSO", "**Gate: ROSSO**", "*Gate*: ROSSO"]) {
      assert.equal(con(forma).status, "pass", forma);
    }
  });

  it("la parola VERDE nella prosa NON e' una dichiarazione", () => {
    const esito = con("Il gate era VERDE ieri, oggi non l'ho rilanciato.");
    assert.equal(esito.status, "fail", "un controllo su prosa libera e' un controllo che non c'e'");
  });

  it("segnala i segnaposto non compilati", () => {
    const esito = con("Gate: ROSSO\n\nEntita': {{ELENCO}}");
    assert.equal(esito.status, "fail");
    assert.match(esito.detail, /segnaposto/);
  });
});

describe("normalizzaTipi", () => {
  it("BOM e CRLF non fanno differenza", () => {
    assert.equal(normalizzaTipi("﻿type A = 1\r\n"), normalizzaTipi("type A = 1\n"));
  });

  it("un tipo davvero diverso resta diverso", () => {
    assert.notEqual(normalizzaTipi("type A = 1"), normalizzaTipi("type A = 2"));
  });
});

describe("valoreToml / urlDbProgetto", () => {
  const config = `
[api]
port = 57421
schemas = ["public"]

[db]
port = 57422
shadow_port = 57420
`;

  it("legge la chiave della sezione giusta", () => {
    assert.equal(valoreToml(config, "db", "port").trim(), "57422");
    assert.equal(valoreToml(config, "api", "port").trim(), "57421");
  });

  it("costruisce l'URL del database del PROGETTO", () => {
    assert.equal(urlDbProgetto(config), "postgresql://postgres:postgres@127.0.0.1:57422/postgres");
  });

  it("senza `[db].port` non inventa la 54322", () => {
    assert.equal(urlDbProgetto("[api]\nport = 1\n"), null);
  });
});
