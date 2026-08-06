import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  auditAdmin,
  catalogoDaRighe,
  chiamaUnaDi,
  stringheOscurate,
  dentroGraffe,
  chiaviOggetto,
  conBarre,
  esportazioniNonLette,
  senzaStringhe,
  corpoFunzione,
  eColonnaDiPrivilegio,
  funzioniEsportate,
  perRegExp,
  tabellaPrimaDi,
  privilegiDaAcl,
  puoScrivere,
  regolaAzioniServer,
  regolaFabbricaClient,
  regolaGuardieRotte,
  ambientiDiProvenienzaIgnota,
  ambientiLetti,
  jwtDiServiceRole,
  regolaMiddleware,
  regolaScritture,
  regolaServiceRole,
  scrittureNelCodice,
  senzaCommenti,
} from "./audit-lib.mjs";

const CONFIG = {
  adminRoot: "src/app/admin",
  guardie: ["richiediStaff", "richiediRuolo"],
  moduliClientSupabase: ["src/lib/supabase/server.ts"],
  entita: [],
};

const f = (percorso, testo) => ({ percorso, testo });

// ─────────────────────────────────────────────── regola 1: guardie sulle rotte
describe("regolaGuardieRotte", () => {
  it("blocca una rotta admin che nessuno protegge", () => {
    const { findings, rotte } = regolaGuardieRotte(
      [f("src/app/admin/ordini/page.tsx", "export default function P() { return null; }")],
      CONFIG,
    );
    assert.equal(rotte, 1);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
  });

  it("non scatta se la guardia sta nel layout della sezione", () => {
    const { findings } = regolaGuardieRotte(
      [
        f("src/app/admin/layout.tsx", "export default async function L(){ await richiediStaff(); }"),
        f("src/app/admin/ordini/page.tsx", "export default function P() { return null; }"),
      ],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });

  it("non scatta se la guardia sta nella pagina stessa", () => {
    const { findings } = regolaGuardieRotte(
      [f("src/app/admin/ordini/page.tsx", "export default async function P(){ await richiediRuolo('titolare'); }")],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });

  it("un layout FUORI dalla catena non protegge", () => {
    const { findings } = regolaGuardieRotte(
      [
        f("src/app/admin/contenuti/layout.tsx", "export default async function L(){ await richiediStaff(); }"),
        f("src/app/admin/ordini/page.tsx", "export default function P(){ return null; }"),
      ],
      CONFIG,
    );
    assert.equal(findings.length, 1);
  });

  it("una guardia CITATA IN UN COMMENTO non protegge", () => {
    const { findings } = regolaGuardieRotte(
      [f("src/app/admin/ordini/page.tsx", "// TODO: qui manca richiediStaff()\nexport default function P(){}")],
      CONFIG,
    );
    assert.equal(findings.length, 1, "un commento non e' una chiamata");
  });

  // MISURATO sul banco il 2026-07-28 con `next dev` acceso: `GET /admin`
  // risponde 307 verso /accedi, `GET /admin/stato` (route handler sotto lo
  // stesso layout) risponde 200. I layout non girano per i route handler.
  it("un route handler NON eredita la guardia dal layout", () => {
    const { findings } = regolaGuardieRotte(
      [
        f("src/app/admin/layout.tsx", "export default async function L(){ await richiediStaff(); }"),
        f("src/app/admin/stato/route.ts", "export async function GET(){ return Response.json({}); }"),
      ],
      CONFIG,
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /NON esegue i layout/);
  });

  it("un route handler che si protegge da solo va bene", () => {
    const { findings } = regolaGuardieRotte(
      [f("src/app/admin/stato/route.ts", "export async function GET(){ await richiediStaff(); }")],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });

  it("una PAGINA sotto lo stesso layout resta protetta (nessun falso positivo)", () => {
    const { findings } = regolaGuardieRotte(
      [
        f("src/app/admin/layout.tsx", "export default async function L(){ await richiediStaff(); }"),
        f("src/app/admin/magazzino/page.tsx", "export default async function P(){ return null; }"),
        f("src/app/admin/stato/route.ts", "export async function GET(){ return Response.json({}); }"),
      ],
      CONFIG,
    );
    assert.equal(findings.length, 1, "solo l'handler, non la pagina");
    assert.match(findings[0].object, /route\.ts$/);
  });

  it("le rotte fuori dalla radice admin non la riguardano", () => {
    const { findings, rotte } = regolaGuardieRotte(
      [f("src/app/accedi/page.tsx", "export default function P(){}")],
      CONFIG,
    );
    assert.equal(rotte, 0);
    assert.deepEqual(findings, []);
  });

  it("una rotta puo' essere dichiarata scoperta di proposito", () => {
    const { findings } = regolaGuardieRotte(
      [f("src/app/admin/stato/route.ts", "export function GET(){}")],
      { ...CONFIG, rotteScoperte: ["src/app/admin/stato/route.ts"] },
    );
    assert.deepEqual(findings, []);
  });

  it("i percorsi con le barre rovesce di Windows contano come gli altri", () => {
    const { findings } = regolaGuardieRotte(
      [
        f("src\\app\\admin\\layout.tsx", "export default async function L(){ await richiediStaff(); }"),
        f("src\\app\\admin\\ordini\\page.tsx", "export default function P(){}"),
      ],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });
});

// ────────────────────────────────────────── regola 2: le azioni server
describe("regolaAzioniServer", () => {
  const azione = (corpo) => `"use server";\nexport async function salva(dati){ ${corpo} }`;

  it("blocca un'azione server senza guardia", () => {
    const { findings, azioni } = regolaAzioniServer([f("src/modules/x/azioni.ts", azione("await scrivi();"))], CONFIG);
    assert.equal(azioni, 1);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].object, /salva$/);
  });

  it("non scatta se l'azione chiama la guardia", () => {
    const { findings } = regolaAzioniServer(
      [f("src/modules/x/azioni.ts", azione("await richiediStaff(); await scrivi();"))],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });

  it("la guardia in un'ALTRA funzione dello stesso file non assolve", () => {
    const testo = `"use server";
      export async function protetta(){ await richiediStaff(); }
      export async function scoperta(dati){ await scrivi(dati); }`;
    const { findings } = regolaAzioniServer([f("src/modules/x/azioni.ts", testo)], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].object, /scoperta$/);
  });

  it("accesso e uscita si dichiarano pubbliche", () => {
    const { findings } = regolaAzioniServer(
      [f("src/modules/admin/accesso.ts", azione("await signIn();"))],
      { ...CONFIG, azioniPubbliche: ["src/modules/admin/accesso.ts"] },
    );
    assert.deepEqual(findings, []);
  });

  it("un file senza `use server` non e' un'azione", () => {
    const { findings, azioni } = regolaAzioniServer(
      [f("src/modules/x/query.ts", "export async function leggi(){ return 1; }")],
      CONFIG,
    );
    assert.equal(azioni, 0);
    assert.deepEqual(findings, []);
  });

  // ── l'azione scritta come arrow (referto § H6, misurato il 2026-08-06)
  //   export const salvaOrdine = async (dati) => { … }
  //     → funzioniEsportate = [], findings = 0, e il gate stampava «azioni server: 1»
  //   export async function salvaOrdine(dati) { … }
  //     → 1 block
  // La stessa azione, scritta nell'altro dei due modi che tutti scrivono.
  const useServer = (corpo) => `"use server";\n${corpo}\n`;

  it("un'azione scritta come arrow function e' un'azione", () => {
    const testo = useServer("export const salvaOrdine = async (dati) => { await scrivi(dati); };");
    const { findings, azioni } = regolaAzioniServer([f("src/modules/ordini/azioni.ts", testo)], CONFIG);
    assert.equal(azioni, 1, "e il numero conta le azioni riconosciute, non i file");
    assert.equal(findings.length, 1);
    assert.match(findings[0].object, /salvaOrdine$/);
  });

  it("un'arrow che chiama la guardia non e' un rilievo", () => {
    const testo = useServer("export const salvaOrdine = async (dati) => { await richiediStaff(); await scrivi(dati); };");
    assert.deepEqual(regolaAzioniServer([f("src/modules/x/azioni.ts", testo)], CONFIG).findings, []);
  });

  it("anche la freccia concisa, senza graffe, ha un corpo da guardare", () => {
    const scoperta = useServer("export const salva = async (d) => scrivi(d);");
    const protetta = useServer("export const salva = async (d) => richiediStaff().then(() => scrivi(d));");
    assert.equal(regolaAzioniServer([f("src/modules/x/a.ts", scoperta)], CONFIG).findings.length, 1);
    assert.deepEqual(regolaAzioniServer([f("src/modules/x/a.ts", protetta)], CONFIG).findings, []);
  });

  it("`export { salva }` fa uscire un'azione quanto `export const`", () => {
    const testo = useServer("async function salva(d){ await scrivi(d); }\nexport { salva };");
    const { findings, azioni } = regolaAzioniServer([f("src/modules/x/a.ts", testo)], CONFIG);
    assert.equal(azioni, 1);
    assert.equal(findings.length, 1);
  });

  // ── la premessa che nessuno contava: «azioni server: 1» su zero azioni lette
  it("`export default` esce col nome `default`, e si guarda come le altre", () => {
    const testo = useServer("export default async function salva(d) { await scrivi(d); }");
    const { azioni, fileAzioni, nonLette } = regolaAzioniServer([f("src/modules/x/a.ts", testo)], CONFIG);
    assert.equal(fileAzioni, 1);
    assert.ok(azioni >= 1);
    assert.deepEqual(nonLette, [], "questa forma il gate la legge");
  });

  it("un `export type` non e' una cosa che esce a runtime, e non gonfia il conto", () => {
    const testo = useServer("export type Dati = { id: number };\nexport const a = async () => { await richiediStaff(); };");
    assert.deepEqual(regolaAzioniServer([f("src/modules/x/b.ts", testo)], CONFIG).nonLette, []);
  });

  it("un file `use server` di cui non si legge nessun nome e' MANCANTE, non pulito", () => {
    const testo = useServer('export * from "./altre-azioni";');
    const { nonLette, azioni, fileAzioni } = regolaAzioniServer([f("src/modules/x/c.ts", testo)], CONFIG);
    assert.equal(azioni, 0);
    assert.equal(fileAzioni, 1, "e prima il dettaglio stampava proprio questo numero, che si legge come copertura");
    assert.equal(nonLette.length, 1);
    assert.match(nonLette[0], /nessun nome esportato riconosciuto/);
  });

  it("le esportazioni non lette si contano, e i tipi non entrano nel conto", () => {
    assert.equal(esportazioniNonLette("export const a = 1;", ["a"]), 0);
    assert.equal(esportazioniNonLette("export type T = 1;\nexport const a = 1;", ["a"]), 0);
    assert.equal(esportazioniNonLette('export * from "./x";', []), 1);
  });
});

// ── il nome di una guardia dentro una STRINGA (referto § H7, 2026-08-06)
// La frase che innescava il difetto e' esattamente quella che si scrive
// prendendo nota del buco: il codice che ammette di non essere protetto
// convinceva il gate di esserlo.
//   throw new Error("richiediStaff() non e ancora agganciata")  → 0 findings
//   la stessa riga senza quella stringa                         → 1 block
describe("una menzione dentro una stringa non e' una chiamata", () => {
  it("la rotta che DICHIARA di non essere protetta resta scoperta", () => {
    const testo = 'export default function Pagina() {\n  throw new Error("richiediStaff() non e ancora agganciata");\n}\n';
    const { findings, rotte } = regolaGuardieRotte([f("src/app/admin/ordini/page.tsx", testo)], CONFIG);
    assert.equal(rotte, 1);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
  });

  it("vale per tutti e tre i modi di scrivere una stringa", () => {
    for (const riga of ['"richiediStaff()"', "'richiediStaff()'", "`richiediStaff()`"]) {
      const testo = `export default function P() { console.log(${riga}); }`;
      assert.equal(regolaGuardieRotte([f("src/app/admin/x/page.tsx", testo)], CONFIG).findings.length, 1,
        `passava con ${riga}`);
    }
  });

  it("la chiamata vera continua a proteggere, stringhe o no", () => {
    const testo = 'export default async function P() {\n  await richiediStaff();\n  return null;\n}\n';
    assert.deepEqual(regolaGuardieRotte([f("src/app/admin/x/page.tsx", testo)], CONFIG).findings, []);
  });

  it("senzaStringhe spegne il contenuto e lascia il codice attorno", () => {
    assert.equal(senzaStringhe('const a = "x"; b();'), 'const a = ""; b();');
    assert.equal(senzaStringhe("const a = 'x\\'y'; b();"), "const a = ''; b();");
    assert.equal(senzaStringhe("const a = `x${c()}`; b();"), "const a = ``; b();");
  });
});

// ─────────────────────────────────────── regola 3: service_role
describe("regolaServiceRole", () => {
  it("blocca la chiave che scavalca le policy", () => {
    const { findings } = regolaServiceRole([
      f("src/lib/admin.ts", "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;"),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
  });

  it("riconosce anche la forma con il trattino", () => {
    const { findings } = regolaServiceRole([f("src/lib/a.ts", 'const r = "service-role";')]);
    assert.equal(findings.length, 1);
  });

  it("non scatta sulla chiave pubblicabile", () => {
    const { findings } = regolaServiceRole([
      f("src/lib/supabase/client.ts", "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    ]);
    assert.deepEqual(findings, []);
  });

  it("una menzione nei commenti non e' un uso", () => {
    const { findings } = regolaServiceRole([
      f("src/lib/supabase/server.ts", "// qui NON entra mai la chiave service_role\nexport const x = 1;"),
    ]);
    assert.deepEqual(findings, [], "altrimenti il commento che spiega la regola la fa scattare");
  });

  // ── la regola guardava un NOME (referto § H3, misurato il 2026-08-06)
  // Riprodotto: dentro un modulo DICHIARATO in `moduliClientSupabase`,
  //   const key = process.env.SB_ADMIN_KEY;
  //   export const admin = createClient(process.env.SUPABASE_URL, key);
  // dava regola 3 = 0 e regola 4 = 0, cioe' zero block. La stessa riga con
  // SUPABASE_SERVICE_ROLE_KEY dava 1 block. Il gate riconosceva la parola, non
  // la cosa.
  const AGGIRATO = 'import { createClient } from "@supabase/supabase-js";\n'
    + "const key = process.env.SB_ADMIN_KEY;\n"
    + "export const admin = createClient(process.env.SUPABASE_URL, key);\n";

  it("una chiave con un altro nome, dentro un modulo client, non passa piu'", () => {
    const { findings } = regolaServiceRole([f("src/lib/supabase/server.ts", AGGIRATO)], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /SB_ADMIN_KEY/);
    assert.match(findings[0].message, /non sa che chiave sia/);
  });

  it("l'indirizzo non e' una credenziale: `SUPABASE_URL` da solo non e' un rilievo", () => {
    const soloUrl = "export const c = createClient(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);";
    assert.deepEqual(regolaServiceRole([f("src/lib/supabase/server.ts", soloUrl)], CONFIG).findings, []);
  });

  it("la chiave anonima nel formato nuovo resta lecita", () => {
    const nuovo = "export const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);";
    assert.deepEqual(regolaServiceRole([f("src/lib/supabase/server.ts", nuovo)], CONFIG).findings, []);
  });

  it("fuori dai moduli client un altro segreto e' affar suo, e non e' rumore", () => {
    const altrove = "const s = process.env.STRIPE_SECRET_KEY;\nexport const paga = () => s;\n";
    assert.deepEqual(regolaServiceRole([f("src/lib/pagamenti.ts", altrove)], CONFIG).findings, [],
      "accusare ogni segreto del progetto renderebbe la regola rumore, e il rumore si scavalca");
  });

  it("ma un client costruito altrove porta con se' il controllo di provenienza", () => {
    const clientAltrove = "export const c = createClient(process.env.SUPABASE_URL, process.env.CHIAVE_MIA);";
    const { findings } = regolaServiceRole([f("src/app/admin/x/page.tsx", clientAltrove)], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /CHIAVE_MIA/);
  });

  // ── il VALORE, non il nome: una chiave incollata nel codice
  // Il payload del JWT dichiara `role`. Il token qui sotto e' costruito per il
  // test e la firma non e' vera: non e' una credenziale, e' la sua forma.
  const jwtConRuolo = (ruolo) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", role: ruolo, exp: 2000000000 })}.finta_firma_abcdefgh`;
  };

  it("una chiave INCOLLATA nel codice si riconosce dal payload, non dal nome", () => {
    const incollata = `const k = "${jwtConRuolo("service_role")}";\nexport const c = createClient(u, k);`;
    const { findings } = regolaServiceRole([f("src/lib/x.ts", incollata)], CONFIG);
    assert.ok(findings.some((x) => /payload dichiara `role: service_role`/.test(x.message)));
  });

  it("la chiave anonima incollata non e' quella che scavalca le policy", () => {
    const anonima = `const k = "${jwtConRuolo("anon")}";\nexport const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, k);`;
    const { findings } = regolaServiceRole([f("src/lib/x.ts", anonima)], CONFIG);
    assert.deepEqual(findings, [], "e' pubblicabile per costruzione: accusarla e' un rosso falso");
  });

  it("il formato nuovo: `sb_secret_` non e' pubblicabile e non ha bisogno di un nome", () => {
    const { findings } = regolaServiceRole([f("src/lib/x.ts", 'const k = "sb_secret_9aB7cD4eF";')], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /sb_secret_/);
  });

  it("`sb_publishable_` e' l'altra meta' del formato nuovo, ed e' lecita", () => {
    assert.deepEqual(regolaServiceRole([f("src/lib/x.ts", 'const k = "sb_publishable_9aB7cD4eF";')], CONFIG).findings, []);
  });

  it("un token illeggibile non e' un rilievo inventato", () => {
    assert.equal(jwtDiServiceRole("eyJnon.e.unjwt"), false);
    assert.equal(jwtDiServiceRole(null), false);
    assert.equal(jwtDiServiceRole("una stringa qualsiasi"), false);
  });

  it("gli ambienti letti si raccolgono in tutte e due le forme, senza doppioni", () => {
    const codice = 'process.env.UNO; process.env["DUE"]; process.env.UNO;';
    assert.deepEqual(ambientiLetti(codice).sort(), ["DUE", "UNO"]);
  });

  it("la provenienza ignota e' tutto cio' che non e' pubblicabile ne' un indirizzo", () => {
    const codice = "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; process.env.SUPABASE_URL; "
      + "process.env.DATABASE_URI; process.env.SB_ADMIN_KEY; process.env.CHIAVE;";
    assert.deepEqual(ambientiDiProvenienzaIgnota(codice).sort(), ["CHIAVE", "SB_ADMIN_KEY"]);
  });
});

// ─────────────────────────────────────── regola 4: fabbrica dei client
describe("regolaFabbricaClient", () => {
  it("segnala un client costruito fuori dai moduli dichiarati", () => {
    const { findings } = regolaFabbricaClient(
      [f("src/app/admin/ordini/page.tsx", "const s = createServerClient(url, key, {});")],
      CONFIG,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
  });

  it("non segnala il modulo dichiarato", () => {
    const { findings } = regolaFabbricaClient(
      [f("src/lib/supabase/server.ts", "return createServerClient(url, key, {});")],
      CONFIG,
    );
    assert.deepEqual(findings, []);
  });
});

// ─────────────────────────────────────── regola 5: il middleware
describe("regolaMiddleware", () => {
  it("segnala un middleware che decide chi entra", () => {
    const { findings } = regolaMiddleware([
      f("src/middleware.ts", "const { data } = await supabase.auth.getUser(); if (!data.user) return NextResponse.redirect(u);"),
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
  });

  it("non segnala un middleware che rinfresca soltanto la sessione", () => {
    const { findings } = regolaMiddleware([
      f("src/middleware.ts", "await supabase.auth.getUser(); return NextResponse.next({ request });"),
    ]);
    assert.deepEqual(findings, []);
  });
});

// ─────────────────────────────────────── lettura delle scritture
describe("scrittureNelCodice", () => {
  it("legge tabella, operazione e colonne", () => {
    const trovate = scrittureNelCodice(
      `await supabase.from("products").update({ name: n, is_published: p }).eq("id", i);`,
    );
    assert.deepEqual(trovate, [
      { tabella: "products", operazione: "update", colonne: ["name", "is_published"] },
    ]);
  });

  it("distingue due catene nello stesso file", () => {
    const trovate = scrittureNelCodice(`
      await supabase.from("orders").update({ status: s });
      await supabase.from("staff").insert({ full_name: f });
    `);
    assert.deepEqual(trovate.map((t) => t.tabella), ["orders", "staff"]);
    assert.deepEqual(trovate.map((t) => t.operazione), ["update", "insert"]);
  });

  it("non conta le chiavi annidate come colonne", () => {
    const trovate = scrittureNelCodice(
      `supabase.from("t").insert({ a: 1, meta: { b: 2 } })`,
    );
    assert.deepEqual(trovate[0].colonne, ["a", "meta"]);
  });

  it("`upsert` conta come insert", () => {
    const trovate = scrittureNelCodice(`supabase.from("t").upsert({ a: 1 })`);
    assert.equal(trovate[0].operazione, "insert");
  });

  it("una scrittura senza `.from` non si attribuisce a caso", () => {
    assert.deepEqual(scrittureNelCodice(`qualcosa.update({ a: 1 })`), []);
  });

  it("le scritture nei commenti non contano", () => {
    assert.deepEqual(scrittureNelCodice(`// supabase.from("t").update({ ruolo: x })`), []);
  });
});

describe("chiaviOggetto", () => {
  it("prende le chiavi di primo livello, anche quotate", () => {
    assert.deepEqual(chiaviOggetto(`{ a: 1, "b": 2, 'c': 3 }`), ["a", "b", "c"]);
  });
});

// ─────────────────────────────────────── permessi dal catalogo
describe("privilegiDaAcl", () => {
  it("legge i privilegi del ruolo richiesto", () => {
    const p = privilegiDaAcl("{postgres=arwdDxtm/postgres,authenticated=arw/postgres}", "authenticated");
    assert.equal(p.has("w"), true);
    assert.equal(p.has("d"), false);
  });

  it("un ruolo assente non ha privilegi", () => {
    assert.equal(privilegiDaAcl("{postgres=arwdDxtm/postgres}", "authenticated").size, 0);
  });

  it("un acl vuoto non e' un permesso", () => {
    assert.equal(privilegiDaAcl("", "authenticated").size, 0);
  });
});

describe("catalogoDaRighe", () => {
  // La forma misurata su Postgres 18 il 2026-07-28: i default privileges di
  // Supabase danno `arwdDxtm` sull'INTERA tabella, e il grant per colonna
  // (`attacl`) e' ADDITIVO — quindi senza `revoke` non restringe niente.
  it("il permesso di tabella intera vince sul grant per colonna", () => {
    const cat = catalogoDaRighe(
      [["staff", "{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres}"]],
      [["staff", "full_name", "{authenticated=w/postgres}"]],
    );
    assert.equal(puoScrivere(cat, "staff", "ruolo", "update"), true);
  });

  it("dopo il revoke, solo le colonne concesse sono scrivibili", () => {
    const cat = catalogoDaRighe(
      [["staff", "{postgres=arwdDxtm/postgres,authenticated=ar/postgres}"]],
      [
        ["staff", "full_name", "{authenticated=w/postgres}"],
        ["staff", "phone", "{authenticated=w/postgres}"],
      ],
    );
    assert.equal(puoScrivere(cat, "staff", "full_name", "update"), true);
    assert.equal(puoScrivere(cat, "staff", "ruolo", "update"), false);
  });

  it("una tabella che il catalogo non conosce vale `null`, non `false`", () => {
    const cat = catalogoDaRighe([], []);
    assert.equal(puoScrivere(cat, "ignota", "x", "update"), null);
  });
});

// ─────────────────────────────────────── regole 6 e 7: le scritture
describe("regolaScritture", () => {
  const catalogoStretto = catalogoDaRighe(
    [["staff", "{authenticated=ar/postgres}"]],
    [["staff", "full_name", "{authenticated=w/postgres}"]],
  );
  const catalogoLargo = catalogoDaRighe([["staff", "{authenticated=arwd/postgres}"]], []);

  it("blocca la scrittura di una colonna senza permesso", () => {
    const { findings } = regolaScritture(
      [f("src/modules/personale/azioni.ts", `supabase.from("staff").update({ phone: p })`)],
      catalogoStretto,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /permission denied/);
  });

  it("non segnala una colonna concessa per colonna", () => {
    const { findings } = regolaScritture(
      [f("src/modules/personale/azioni.ts", `supabase.from("staff").update({ full_name: n })`)],
      catalogoStretto,
    );
    assert.deepEqual(findings, []);
  });

  it("blocca l'auto-promozione quando il database la concede", () => {
    const { findings } = regolaScritture(
      [f("src/modules/personale/azioni.ts", `supabase.from("staff").update({ ruolo: r })`)],
      catalogoLargo,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "block");
    assert.match(findings[0].message, /auto-promozione/);
  });

  it("senza catalogo la colonna di privilegio e' un `issue`, non un `block`", () => {
    const { findings } = regolaScritture(
      [f("src/modules/personale/azioni.ts", `supabase.from("staff").update({ ruolo: r })`)],
      null,
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "issue");
  });

  it("senza catalogo una colonna qualunque non produce niente", () => {
    const { findings } = regolaScritture(
      [f("src/modules/x/azioni.ts", `supabase.from("staff").update({ phone: p })`)],
      null,
    );
    assert.deepEqual(findings, []);
  });
});

describe("eColonnaDiPrivilegio", () => {
  it("riconosce i nomi noti, in italiano e in inglese", () => {
    for (const nome of ["ruolo", "role", "is_admin", "job_title", "permessi"]) {
      assert.equal(eColonnaDiPrivilegio(nome), true, nome);
    }
  });

  it("non scatta su un nome qualunque", () => {
    assert.equal(eColonnaDiPrivilegio("full_name"), false);
    assert.equal(eColonnaDiPrivilegio("livello"), false, "euristica sul nome: dichiarata, non onnisciente");
  });
});

// ─────────────────────────────────────── utilita' di testo
describe("senzaCommenti", () => {
  it("toglie i commenti di riga e di blocco", () => {
    assert.equal(senzaCommenti("a; // x\nb; /* y */ c;").includes("x"), false);
  });

  it("non rompe un URL con le due barre", () => {
    assert.equal(senzaCommenti('const u = "http://x/y";').includes("http://x/y"), true);
  });

  // ── il delimitatore dentro la stringa (difetto n°51, 2026-08-06) ──────────
  // Stessa classe del n°50 e degli altri tre di questa famiglia: uno scanner
  // scritto a mano che non sa dentro quale parte della struttura si trova.
  // Qui il verso e' quello peggiore: un VERDE falso sulla regola 3.
  const MODULO_OSTILE = [
    'const doc = "vedi https://esempio.test/*";',
    "export const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);",
    'const fine = "*/";',
  ].join("\n");

  it("un `/*` dentro una stringa non apre un commento, e non mangia la riga dopo", () => {
    const nudo = senzaCommenti(MODULO_OSTILE);
    assert.ok(nudo.includes("SUPABASE_SERVICE_ROLE_KEY"), "la riga della chiave spariva del tutto");
    assert.equal(nudo, MODULO_OSTILE, "qui non c'e' nessun commento da togliere");
  });

  it("e la regola 3 vede la chiave come se le due stringhe non ci fossero", () => {
    const config = { moduliClientSupabase: ["src/lib/supabase-admin.ts"] };
    const conStringhe = regolaServiceRole([{ percorso: "src/lib/supabase-admin.ts", testo: MODULO_OSTILE }], config);
    const senza = regolaServiceRole(
      [{ percorso: "src/lib/supabase-admin.ts", testo: MODULO_OSTILE.split("\n")[1] }], config,
    );
    assert.equal(conStringhe.findings.length, senza.findings.length);
    assert.ok(conStringhe.findings.length > 0, "prima erano zero: block = 0 su una service_role nel codice");
  });

  it("un `//` dentro una stringa non spegne il resto della riga", () => {
    const testo = 'const nota = "a // b"; richiediStaff();';
    assert.ok(senzaCommenti(testo).includes("richiediStaff()"));
    assert.equal(chiamaUnaDi(testo, ["richiediStaff"]), true);
  });

  it("le stringhe restano INTATTE: la regola 3 cerca anche le chiavi incollate", () => {
    assert.equal(senzaCommenti('const k = "sb_secret_abcd1234";'), 'const k = "sb_secret_abcd1234";');
  });

  it("un letterale di espressione regolare con `\\/` non apre un commento", () => {
    const testo = String.raw`const re = /https:\/\//; richiediStaff();`;
    assert.equal(senzaCommenti(testo), testo);
  });

  it("gli a capo di un commento a blocco si tengono: le righe non si spostano", () => {
    const testo = "a;\n/* uno\n   due */\nb;";
    assert.equal(senzaCommenti(testo).split("\n").length, testo.split("\n").length);
  });

  it("H7 regge ancora: un nome di guardia dentro una stringa non e' una chiamata", () => {
    assert.equal(chiamaUnaDi('throw new Error("richiediStaff() non e agganciata")', ["richiediStaff"]), false);
  });
});

describe("funzioniEsportate / corpoFunzione", () => {
  const testo = `export async function a(){ uno(); }\nexport function b(){ due(); }`;

  it("elenca le funzioni esportate", () => {
    assert.deepEqual(funzioniEsportate(testo), ["a", "b"]);
  });

  it("il corpo di una non contiene quello dell'altra", () => {
    assert.equal(corpoFunzione(testo, "a").includes("due"), false);
    assert.equal(corpoFunzione(testo, "b").includes("uno"), false);
  });

  it("le graffe annidate non troncano il corpo", () => {
    const t = `export function a(){ if (x) { dentro(); } fine(); }`;
    assert.equal(corpoFunzione(t, "a").includes("fine"), true);
  });
});

describe("conBarre", () => {
  it("normalizza i percorsi di Windows", () => {
    assert.equal(conBarre("src\\app\\admin"), "src/app/admin");
  });
});

describe("chiamaUnaDi", () => {
  it("una chiamata conta, una menzione no", () => {
    assert.equal(chiamaUnaDi("await richiediStaff();", ["richiediStaff"]), true);
    assert.equal(chiamaUnaDi("const x = richiediStaff;", ["richiediStaff"]), false);
  });

  // Misurato, non supposto: credevo che `richiediStaffFinto()` passasse per una
  // chiamata a `richiediStaff` (confine solo a sinistra). Non e' cosi' — fra il
  // nome e la parentesi la regola ammette solo spazi, quindi il confine c'e' da
  // entrambe le parti. Il test resta a fissare il comportamento vero.
  it("un nome che ne CONTIENE un altro non conta come chiamata", () => {
    assert.equal(chiamaUnaDi("richiediStaffFinto()", ["richiediStaff"]), false);
    assert.equal(chiamaUnaDi("finge_richiediStaff()", ["richiediStaff"]), false);
    assert.equal(chiamaUnaDi("await richiediStaff ()", ["richiediStaff"]), true, "lo spazio prima della parentesi resta una chiamata");
  });

  it("nessuna guardia dichiarata: niente e' protetto", () => {
    assert.equal(chiamaUnaDi("richiediStaff()", []), false);
  });
});

describe("perRegExp", () => {
  it("un metacarattere resta un carattere", () => {
    assert.equal(new RegExp(perRegExp("a.b")).test("axb"), false);
    assert.equal(new RegExp(perRegExp("a.b")).test("a.b"), true);
  });
});

describe("tabellaPrimaDi", () => {
  it("prende la `from` piu' vicina, non la prima del file", () => {
    const codice = `s.from("uno").select(); s.from("due").update(`;
    assert.equal(tabellaPrimaDi(codice, codice.length - 8), "due");
  });

  it("senza `.from` non attribuisce niente", () => {
    assert.equal(tabellaPrimaDi("update({a:1})", 0), null);
    assert.equal(tabellaPrimaDi('from("uno").update(', 12), null, "`from` senza punto non e' la catena di supabase");
  });
});

// ─────────────────────────────────────── l'audit intero
describe("auditAdmin", () => {
  it("riporta le misure della premessa, non solo l'esito", () => {
    const esito = auditAdmin({
      files: [f("src/app/admin/page.tsx", "export default async function P(){ await richiediStaff(); }")],
      config: CONFIG,
      catalogo: null,
    });
    assert.equal(esito.misure.rotte, 1);
    assert.equal(esito.misure.file, 1);
    assert.equal(esito.misure.catalogo, "assente");
    assert.deepEqual(esito.summary, { block: 0, issue: 0, warn: 0 });
  });

  it("somma i findings di tutte le regole", () => {
    const esito = auditAdmin({
      files: [
        f("src/app/admin/page.tsx", "export default function P(){}"),
        f("src/lib/x.ts", "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;"),
      ],
      config: CONFIG,
      catalogo: null,
    });
    assert.equal(esito.summary.block, 2);
  });
});

// ── L4: il catalogo dei permessi non e' un oggetto nudo ──────────────────────
// Le chiavi sono i nomi delle TABELLE DEL CLIENTE, e su un oggetto nudo
// `tabelle["constructor"]` risponde con una funzione ereditata da
// `Object.prototype`: la tabella «esiste», nessun permesso, `block`. Un rosso
// falso su una tabella che nessuno ha guardato.

describe("puoScrivere con nomi che vengono dal cliente", () => {
  const catalogo = catalogoDaRighe(
    [["prodotti", "authenticated=arwd/postgres"]],
    [["prodotti", "prezzo", "authenticated=w/postgres"]],
  );

  it("una tabella vera risponde come prima", () => {
    assert.equal(puoScrivere(catalogo, "prodotti", "prezzo", "update"), true);
  });

  it("una tabella che il catalogo non conosce resta `null`, non `false`", () => {
    assert.equal(puoScrivere(catalogo, "ordini", "totale", "update"), null);
  });

  it("`constructor`, `__proto__` e `toString` non sono tabelle", () => {
    for (const nome of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      assert.equal(puoScrivere(catalogo, nome, "x", "update"), null, nome);
    }
  });
});

// ── il delimitatore dentro la stringa, ultima presa (difetto n°52) ───────────
// Quattro scanner della stessa skill contavano graffe e cercavano `.from(`
// dentro le stringhe del progetto auditato. Trovati con una batteria di sonde
// ostili sull'intero inventario degli scanner scritti a mano, il 2026-08-06.

describe("n°52: graffe e chiamate dentro le stringhe", () => {
  it("dentroGraffe non si ferma a una `{` scritta in una stringa", () => {
    assert.equal(dentroGraffe('x = { a: "{" }; y', 4), '{ a: "{" }');
  });

  it("il corpo di una funzione non si taglia a una `}` scritta in una stringa", () => {
    const testo = 'export async function salva(){ const s = "}"; await scrivi(); }\nexport function altra(){ boom(); }';
    assert.ok(corpoFunzione(testo, "salva").includes("scrivi()"));
    assert.ok(!corpoFunzione(testo, "salva").includes("boom()"));
  });

  it("e non SCONFINA nella funzione seguente per una `{` in una stringa", () => {
    // Il verso peggiore: il corpo prendeva in prestito la guardia della
    // funzione dopo, e l'azione scoperta risultava protetta.
    const testo = `"use server";
export async function salvaOrdine(dati){ const nota = "apri con {"; await scrivi(dati); }
export async function altra(){ await richiediStaff(); }`;
    const { findings } = regolaAzioniServer(
      [f("src/modules/ordini/azioni.ts", testo)],
      { ...CONFIG, guardie: ["richiediStaff"] },
    );
    assert.equal(findings.length, 1, "prima erano zero: la guardia era di un'altra funzione");
    assert.match(findings[0].object, /salvaOrdine$/);
  });

  it("una colonna dopo una `}` in una stringa non sparisce dal payload", () => {
    assert.deepEqual(chiaviOggetto('{ nome: "x", nota: "}", ruolo: "admin" }'), ["nome", "nota", "ruolo"]);
  });

  it("e la colonna che il database non concede resta un block", () => {
    const catalogo = catalogoDaRighe(
      [["profili", "authenticated=arwd/postgres"]],
      [["profili", "nome", "authenticated=w/postgres"]],
    );
    const modulo = 'await supabase.from("profili").update({ nome: "x", nota: "}", ruolo: "admin" });';
    const { findings } = regolaScritture([f("src/modules/x.ts", modulo)], catalogo);
    assert.ok(findings.some((x) => x.object.includes("ruolo")), "prima `ruolo` non veniva nemmeno letta");
  });

  it("un `.insert(` NOMINATO dentro una stringa non e' una scrittura", () => {
    assert.deepEqual(scrittureNelCodice('const msg = "usa .insert( per scrivere";'), []);
  });

  it("un `.from(\"finta\")` dentro una stringa non attribuisce la scrittura", () => {
    assert.equal(tabellaPrimaDi('const s = "supabase.from(\'finta\')"; poi();', 45), null);
  });

  it("una chiave virgolettata resta una chiave", () => {
    assert.deepEqual(chiaviOggetto('{ "nome": 1, \'cognome\': 2 }'), ["nome", "cognome"]);
  });

  it("stringheOscurate conserva la lunghezza, sempre", () => {
    for (const testo of ['a "bc" d', "a 'b\\' c", "`t${x}`", 'rotta "non chiusa', "a \\\\"]) {
      assert.equal(stringheOscurate(testo).length, testo.length, JSON.stringify(testo));
    }
  });
});

// ── il concilio sul pacchetto stesso (2026-08-07) ───────────────────────────
// Quattro rilievi, e i primi due erano REGRESSIONI di P.7e: le due `replace`
// di prima davano la risposta giusta su questi ingressi.

describe("un apice che non si chiude e' testo, non un delimitatore", () => {
  const RIGA = "  return <p>Elenco degli ordini dell'utente</p>; // TODO: qui manca richiediStaff()";

  it("l'apostrofo di un testo JSX non protegge una rotta scoperta", () => {
    const pagina = `export default function P() {\n${RIGA}\n}`;
    const { findings } = regolaGuardieRotte(
      [f("src/app/admin/ordini/page.tsx", pagina)],
      { ...CONFIG, guardie: ["richiediStaff"] },
    );
    assert.equal(findings.length, 1, "prima erano zero: il commento sopravviveva e la guardia sembrava chiamata");
    assert.equal(findings[0].severity, "block");
  });

  it("e la stessa riga senza l'apostrofo da' lo stesso esito", () => {
    const pagina = `export default function P() {\n${RIGA.replace("dell'utente", "degli utenti")}\n}`;
    assert.equal(regolaGuardieRotte([f("src/app/admin/ordini/page.tsx", pagina)], { ...CONFIG, guardie: ["richiediStaff"] }).findings.length, 1);
  });

  it("un backtick spaiato non spegne lo spogliatore fino a fine file", () => {
    const testo = "const s = `aperto;\n" + Array.from({ length: 5 }, (_, i) => `// commento ${i}`).join("\n");
    assert.equal((senzaCommenti(testo).match(/\/\/ commento/g) ?? []).length, 0);
  });

  it("ma una stringa vera resta una stringa, e un template vero pure", () => {
    assert.equal(senzaCommenti('const a = "x // y"; b();'), 'const a = "x // y"; b();');
    assert.equal(senzaCommenti("const a = `riga1\nriga2 // non commento`; b();"), "const a = `riga1\nriga2 // non commento`; b();");
  });

  it("la maschera conserva la lunghezza anche sugli apici che non chiudono", () => {
    for (const s of ["a 'b' c", "dell'utente</p>; // x", "`t\nu`", "a \\", "const s = `aperto"]) {
      assert.equal(stringheOscurate(s).length, s.length, JSON.stringify(s));
    }
  });
});

describe("la proprieta' abbreviata e' una colonna", () => {
  it("`{ ruolo }` non e' un payload vuoto", () => {
    assert.deepEqual(chiaviOggetto("{ ruolo }"), ["ruolo"]);
    assert.deepEqual(chiaviOggetto("{ ruolo, nome: x }"), ["ruolo", "nome"]);
    assert.deepEqual(chiaviOggetto("{ nome: x, ruolo }"), ["nome", "ruolo"]);
    assert.deepEqual(chiaviOggetto("{ a, b, c }"), ["a", "b", "c"]);
  });

  it("uno spread non e' una chiave", () => {
    assert.deepEqual(chiaviOggetto("{ ...base, ruolo }"), ["ruolo"]);
  });

  it("e la colonna di privilegio scritta in forma abbreviata si vede", () => {
    const catalogo = catalogoDaRighe([["profili", "authenticated=arwd/postgres"]], []);
    const { findings } = regolaScritture([f("src/modules/x.ts", 'await sb.from("profili").update({ ruolo });')], catalogo);
    assert.ok(findings.some((x) => x.object.includes("ruolo")), "prima il payload risultava vuoto");
  });
});

describe("il corpo di una funzione non e' il suo parametro destrutturato", () => {
  it("un'azione server protetta con un parametro destrutturato non e' un block", () => {
    const testo = '"use server";\nexport async function salvaOrdine({ id }: { id: string }) { await richiediStaff(); await scrivi(id); }';
    const { findings } = regolaAzioniServer([f("src/modules/x/azioni.ts", testo)], { ...CONFIG, guardie: ["richiediStaff"] });
    assert.deepEqual(findings, [], "prima il corpo letto era `{ id }` e l'azione protetta usciva block");
  });

  it("ma la stessa azione SENZA guardia resta un block", () => {
    const testo = '"use server";\nexport async function salvaOrdine({ id }: { id: string }) { await scrivi(id); }';
    assert.equal(regolaAzioniServer([f("src/modules/x/azioni.ts", testo)], { ...CONFIG, guardie: ["richiediStaff"] }).findings.length, 1);
  });
});
