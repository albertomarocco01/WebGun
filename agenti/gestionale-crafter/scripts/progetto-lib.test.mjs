import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  HANDOFF,
  erroriAdminRoot,
  erroreDiRotta,
  chiaviDiPrimoLivello,
  contrattoUscita,
  normalizzaTipi,
  premessaTsc,
  regolaEntitaAncorate,
  senzaCommentiJson,
  senzaCommentoToml,
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

// ---- `adminRoot` non e' una stringa qualsiasi (referto § H2, 2026-08-06)
// `validaConfig` lo controllava con `!== undefined`: nemmeno un controllo di
// tipo. Da li' il valore va a finire in `cmd.exe /c` (passo `a11y`) e nella
// costruzione delle rotte cercate su disco — e lo scrive il progetto AUDITATO.
// Misurato: `src/app/admin&calc` si crea davvero su Windows, e attraverso
// `cmd /c` l'argomento si tronca con lo status che resta 0.

describe("erroriAdminRoot", () => {
  it("una radice relativa e pulita non produce nessun errore", () => {
    assert.deepEqual(erroriAdminRoot("src/app/admin"), []);
    assert.deepEqual(erroriAdminRoot("src/app/area-riservata"), [], "il trattino e' legittimo");
    assert.deepEqual(erroriAdminRoot("src\\app\\admin"), [], "le barre di Windows pure");
  });

  it("un metacarattere di shell si rifiuta, e il messaggio dice perche'", () => {
    const errori = erroriAdminRoot("src/app/admin&calc");
    assert.equal(errori.length, 1);
    assert.match(errori[0], /metacarattere di shell/);
  });

  it("lo spazio si rifiuta: attraverso `cmd /c` tronca il programma", () => {
    assert.equal(erroriAdminRoot("src/app/mia admin").length, 1);
  });

  it("un percorso assoluto porta l'audit fuori dal progetto che giudica", () => {
    assert.match(erroriAdminRoot("C:/Windows").join(""), /RELATIVO/);
    assert.match(erroriAdminRoot("/etc").join(""), /RELATIVO/);
  });

  it("un `..` risale sopra la radice: stesso guasto, altra strada", () => {
    assert.match(erroriAdminRoot("src/../../altrove").join(""), /contiene `\.\.`/);
  });

  it("non una stringa, o vuota: due errori diversi, perche' due sbagli diversi", () => {
    assert.match(erroriAdminRoot(42).join(""), /deve essere una stringa/);
    assert.match(erroriAdminRoot(null).join(""), /deve essere una stringa, non null/);
    assert.match(erroriAdminRoot(["src/app/admin"]).join(""), /deve essere una stringa/);
    assert.match(erroriAdminRoot("   ").join(""), /e' vuoto/);
  });

  it("validaConfig lo applica: la configurazione ostile non passa piu'", () => {
    const base = { adminRoot: "src/app/admin&calc", guardie: ["richiediStaff"], entita: [] };
    assert.equal(validaConfig(base).errori.length, 1);
    assert.deepEqual(validaConfig({ ...base, adminRoot: "src/app/admin" }).errori, []);
  });
});

// ── la premessa del passo `tsc` (referto § H8, 2026-08-06)
// Il gemello dell'ESLint a zero regole: `tsc --noEmit` legge il tsconfig del
// progetto — ed e' giusto, gli alias li conosce solo lui — ma con
// `strict: false` esce 0 su codice che un controllo vero boccia.
describe("premessaTsc", () => {
  it("strict dichiarato true: la misura vale", () => {
    assert.deepEqual(premessaTsc('{"compilerOptions":{"strict":true}}'), { strict: true, motivo: null });
  });

  it("strict false: verifica mancante, e il motivo lo dice", () => {
    const { strict, motivo } = premessaTsc('{"compilerOptions":{"strict":false}}');
    assert.equal(strict, false);
    assert.match(motivo, /esce 0 su codice che un controllo vero boccia/);
  });

  it("strict non dichiarato: «non lo so» non e' «va bene»", () => {
    assert.equal(premessaTsc('{"compilerOptions":{"target":"ES2022"}}').strict, false);
    assert.match(premessaTsc("{}").motivo, /non e' dichiarato/);
  });

  it("ereditato da `extends`: il gate non risale la catena, e lo dice", () => {
    const { strict, motivo } = premessaTsc('{"extends":"./base.json","compilerOptions":{}}');
    assert.equal(strict, false);
    assert.match(motivo, /arriverebbe da `extends`/);
  });

  it("i commenti di un tsconfig JSONC non lo rendono illeggibile", () => {
    const conCommenti = '{\n  // i tipi del progetto\n  "compilerOptions": { "strict": true } /* fine */\n}';
    assert.equal(premessaTsc(conCommenti).strict, true);
  });

  it("un tsconfig illeggibile e' una premessa mancante, non un successo", () => {
    const { strict, motivo } = premessaTsc("{ questo non e' json }");
    assert.equal(strict, false);
    assert.match(motivo, /non interpretabile/);
  });
});

// ── il delimitatore dentro la stringa (difetto n°50, 2026-08-06) ─────────────
// La forma vera dell'ingresso, non una inventata: il `tsconfig.json` che
// `create-next-app` scrive, copiato a mano dal pilota. Contiene `"@/*"`, e
// prima della correzione lo spogliatore a regexp lo leggeva come apertura di
// commento e correva fino al `*` + `/` dentro `"**` + `/*.ts"` di `include`:
// 72 caratteri divorati in un colpo, 102 in tutto, ed «Expected ':' … at
// position 472» su un file che `JSON.parse` legge cosi' com'e'.
const TSCONFIG_PILOTA = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
`;

describe("premessaTsc: il delimitatore dentro la stringa (n°50)", () => {
  it("il tsconfig.json che create-next-app scrive in ogni progetto Next si legge", () => {
    assert.equal(JSON.parse(TSCONFIG_PILOTA).compilerOptions.strict, true, "premessa del test: il file E' JSON valido");
    assert.deepEqual(premessaTsc(TSCONFIG_PILOTA), { strict: true, motivo: null });
  });

  it("un JSONC vero con un commento a blocco E un `/*` dentro una stringa: entrambi trattati bene", () => {
    const misto = [
      "{",
      "  /* i tipi del progetto, generati */",
      '  "compilerOptions": { "strict": true, "paths": { "@/*": ["./src/*"] } },',
      '  "include": ["**/*.ts"]',
      "}",
    ].join("\n");
    assert.equal(premessaTsc(misto).strict, true);
    assert.deepEqual(JSON.parse(senzaCommentiJson(misto)).compilerOptions.paths, { "@/*": ["./src/*"] });
  });

  it("un `//` dentro un valore di stringa non e' un commento", () => {
    // La seconda regexp era cieca allo stesso modo, con una sola guardia: `://`.
    // Basta togliere i due punti e il valore veniva troncato.
    const conNota = '{\n  "nota": "a // b",\n  "compilerOptions": { "strict": true }\n}';
    assert.equal(premessaTsc(conNota).strict, true);
    assert.equal(JSON.parse(senzaCommentiJson(conNota)).nota, "a // b");
  });

  it("una barra rovesciata prima delle virgolette non chiude la stringa", () => {
    const conFuga = '{ "nota": "finisce con una barra \\\\", "compilerOptions": { "strict": true } }';
    assert.equal(premessaTsc(conFuga).strict, true);
  });

  it("un file troncato resta una premessa MANCANTE, col messaggio di sempre", () => {
    const { strict, motivo } = premessaTsc('{\n  "compilerOptions": { "strict": true');
    assert.equal(strict, false);
    assert.match(motivo, /non interpretabile/);
  });

  it("un JSONC rotto davvero: la posizione si riferisce al testo senza commenti, e lo dice", () => {
    const { strict, motivo } = premessaTsc('{\n  // una nota\n  "compilerOptions": { "strict": true },\n}');
    assert.equal(strict, false);
    assert.match(motivo, /una volta tolti i commenti/);
  });
});

describe("senzaCommentiJson", () => {
  it("un commento a blocco non chiuso si mangia solo la coda", () => {
    assert.equal(senzaCommentiJson('{"a":1} /* e poi piu' + "' niente").trim(), '{"a":1}');
  });

  it("le righe non si spostano: un `//` lascia il suo a capo dov'era", () => {
    const testo = '{\n  // nota\n  "a": 1\n}';
    assert.equal(senzaCommentiJson(testo).split("\n").length, testo.split("\n").length);
  });
});

// ── la rotta che fa esistere qualunque rotta (referto § H9 e § M8, 2026-08-06)
// Il gate chiedeva soltanto «esiste?», con `join(progetto, adminRoot, rotta)`.
// Misurato su una radice che esiste:
//   rotta ""                       → join = <adminRoot>  esiste = true   findings = 0
//   rotta assente                  → join = <adminRoot>  esiste = true   findings = 0
//   rotta "../../../../../Windows" → join = C:\Windows   esiste = true   findings = 0
//   rotta "prodotti"               → esiste = false      findings = 1
// La stringa vuota faceva esistere QUALUNQUE rotta — la radice admin esiste
// sempre — e un `..` spostava la domanda su una cartella che col progetto non
// c'entra. In entrambi i casi il passo stampava «N tabelle nei tipi» e chiudeva
// verde.
describe("erroreDiRotta", () => {
  it("una rotta vera non produce nessun errore di forma", () => {
    assert.equal(erroreDiRotta("prodotti"), null);
    assert.equal(erroreDiRotta("ordini/righe"), null);
    assert.equal(erroreDiRotta("area-riservata"), null, "il trattino e' legittimo");
  });

  it("la rotta vuota non e' una rotta, e il messaggio non parla di cartelle", () => {
    assert.match(erroreDiRotta(""), /la vista sarebbe la radice admin stessa/);
    assert.match(erroreDiRotta("   "), /la vista sarebbe la radice admin stessa/);
  });

  it("la rotta assente si distingue dalla rotta vuota", () => {
    assert.match(erroreDiRotta(undefined), /non dichiarata/);
    assert.match(erroreDiRotta(null), /non dichiarata/);
  });

  it("`..` e percorso assoluto spostano la domanda fuori dal gestionale", () => {
    assert.match(erroreDiRotta("../../../../../Windows"), /contiene `\.\.`/);
    assert.match(erroreDiRotta("C:/Windows"), /RELATIVA/);
    assert.match(erroreDiRotta("/etc"), /RELATIVA/);
  });

  it("una rotta che non e' una stringa non e' una rotta", () => {
    assert.match(erroreDiRotta(42), /deve essere una stringa/);
  });

  it("la regola lo usa PRIMA di chiedere se la vista esiste", () => {
    // il predicato dice sempre di si', come faceva `existsSync` sulla radice
    const semprePresente = () => true;
    for (const rotta of ["", undefined, "../../../../../Windows"]) {
      const config = { adminRoot: "src/app/admin", entita: [{ tabella: "prodotti", rotta }], escluse: [] };
      const findings = regolaEntitaAncorate(["prodotti"], config, semprePresente);
      assert.equal(findings.length, 1, `passava con rotta ${JSON.stringify(rotta)}`);
      assert.equal(findings[0].severity, "block");
      assert.match(findings[0].message, /entita' dichiarata gestita, ma/);
    }
  });

  it("e una rotta vera che non esiste resta il rilievo di prima", () => {
    const config = { adminRoot: "src/app/admin", entita: [{ tabella: "prodotti", rotta: "prodotti" }], escluse: [] };
    const findings = regolaEntitaAncorate(["prodotti"], config, () => false);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /la rotta `prodotti` non esiste/);
  });
});

// ── il `#` che apre un commento TOML, e quello che non lo apre ───────────────
// Qui la chiave letta e' una sola (`[db].port`) e il `/^(\d+)/` che la
// interpreta reggeva gia' un commento in coda: lo scanner arriva perche' e' la
// stessa forma di `valoreToml` che nelle due skill sorelle produceva schemi
// fantasma (§ M13) e mezze URL (§ L7), e la prossima chiave che qualcuno
// leggera' da qui non avra' un `/^(\d+)/` a proteggerla.

describe("senzaCommentoToml", () => {
  it("taglia il commento in coda", () => {
    assert.equal(senzaCommentoToml("port = 7622 # il banco del pilota"), "port = 7622 ");
    assert.equal(senzaCommentoToml("# tutta la riga"), "");
  });

  it("ma non un `#` dentro una stringa", () => {
    assert.equal(senzaCommentoToml('url = "http://x/#/app"'), 'url = "http://x/#/app"');
    assert.equal(senzaCommentoToml("nome = 'a#b'"), "nome = 'a#b'");
    assert.equal(senzaCommentoToml('a = "una \\" virgoletta # dentro"'), 'a = "una \\" virgoletta # dentro"');
  });

  it("e la porta si legge lo stesso, col commento accanto", () => {
    assert.equal(urlDbProgetto("[db]\nport = 7622 # il banco\n"), "postgresql://postgres:postgres@127.0.0.1:7622/postgres");
  });
});

// ── le graffe dei tipi si contano sulla struttura (concilio, 2026-08-07) ─────
// `tabelleDaiTipi` passa da `dentroGraffe`, che le stringhe le salta; questa,
// che legge DENTRO il blocco, no — e una graffa spaiata dentro un tipo
// letterale faceva sparire in silenzio tutte le tabelle successive.

describe("chiaviDiPrimoLivello: le graffe dentro le stringhe", () => {
  const conNota = (valore) => `export type Database = {
  public: {
    Tables: {
      ordini: { Row: { nota: ${valore} } }
      profili: { Row: { id: string } }
    }
  }
}`;

  it("una `{` dentro un tipo letterale non fa sparire le tabelle dopo", () => {
    assert.deepEqual(tabelleDaiTipi(conNota('"{"')), ["ordini", "profili"]);
  });

  it("ne' una `}`, che ne fabbricava anche una fantasma", () => {
    assert.deepEqual(tabelleDaiTipi(conNota('"}"')), ["ordini", "profili"]);
  });

  it("e il caso dritto resta quello di sempre", () => {
    assert.deepEqual(tabelleDaiTipi(conNota("string")), ["ordini", "profili"]);
    assert.deepEqual(chiaviDiPrimoLivello("{ a: { b: 1 }, c: 2 }"), ["a", "c"]);
  });
});
