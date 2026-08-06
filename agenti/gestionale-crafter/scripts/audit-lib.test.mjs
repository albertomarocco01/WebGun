import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  auditAdmin,
  catalogoDaRighe,
  chiamaUnaDi,
  chiaviOggetto,
  conBarre,
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
