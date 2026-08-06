import assert from "node:assert/strict";
import test from "node:test";

/**
 * LE ESCHE SI ASSEMBLANO, non si scrivono intere.
 *
 * Questo file deve contenere stringhe che ASSOMIGLIANO a segreti: e' la sola
 * forma in cui si prova che le famiglie le riconoscono. Scritte per intero pero'
 * fanno scattare gli scanner della casa — misurato dal collaudo del 2026-08-06:
 * `gitleaks` 2 rilievi e `semgrep` 1, tutti e tre su questo file. Un rosso che
 * si impara a ignorare non e' piu' un controllo, ed e' la regola che questa
 * skill predica: non si puo' predicarla e violarla nel proprio repository.
 *
 * Le famiglie vedono la stringa assemblata a runtime, cioe' esattamente la
 * stessa che vedrebbero in un file vero.
 */
const ESCA = {
  stripe: ["sk", "live", "51QdeadbeefCAFEBABE0123456789"].join("_"),
  password: ["Tr0ub4dor3", "Ponteverde"].join("-"),
};

import {
  decodifica,
  eBinario,
  eccezioniDichiarate,
  eFileAmbienteTracciato,
  eFileEsempio,
  entropia,
  ePubblicaPerCostruzione,
  eSegnaposto,
  eServiceRole,
  esitoSegreti,
  FAMIGLIE,
  findingsEsempio,
  findingsFile,
  maschera,
  ePortatoreDiChiave,
  nomeSospetto,
  payloadJwt,
  statoDaFindings,
} from "./segreti-lib.mjs";

/**
 * Due chiavi Supabase vere per forma: STESSA struttura, significati opposti.
 * Sono il caso di prova centrale di questa libreria — una regola che le
 * trattasse uguale sarebbe inutile in un verso e dannosa nell'altro.
 */
const jwt = (payload) =>
  `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.` +
  `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.` +
  "firmafintamalungaabbastanza1234567890";
const SERVICE = jwt({ iss: "supabase", role: "service_role", exp: 2000000000 });
const ANON = jwt({ iss: "supabase", role: "anon", exp: 2000000000 });

// ------------------------------------------------------------------ maschera
test("maschera non consegna mai piu' di quattro caratteri del segreto", () => {
  const segreto = ESCA.stripe;
  const m = maschera(segreto);
  assert.ok(m.startsWith("sk_l"), m);
  assert.ok(!m.includes("CAFEBABE"), "la maschera non deve contenere il corpo del segreto");
  assert.ok(!m.includes(segreto.slice(-6)), "nemmeno la coda: su una password e' meta' della password");
  assert.match(m, /\[37 caratteri\]/);
});

test("maschera di un valore cortissimo non lo mostra affatto", () => {
  assert.equal(maschera("abc"), "*** [3 caratteri]");
  assert.equal(maschera("admin1"), "****** [6 caratteri]", "sotto gli otto caratteri non si mostra niente");
  assert.equal(maschera(""), "(vuoto)");
});

// ----------------------------------------------------------------------- JWT
test("payloadJwt decodifica il payload, e nega cio' che non e' un JWT", () => {
  assert.equal(payloadJwt(SERVICE).role, "service_role");
  assert.equal(payloadJwt("non.un.jwt"), null);
  assert.equal(payloadJwt("una-stringa-sola"), null);
  assert.equal(payloadJwt(null), null);
});

test("la chiave anonima NON e' un segreto: e' il falso positivo da non fare mai", () => {
  assert.equal(eServiceRole(SERVICE), true);
  assert.equal(eServiceRole(ANON), false);
  const rilievi = findingsFile("src/lib/supabase/public.ts", `const chiave = "${ANON}";`);
  assert.deepEqual(rilievi, [], "segnalare la chiave anonima insegna a ignorare il rosso");
});

// ---------------------------------------------------------------- segnaposto
test("eSegnaposto riconosce le forme che i template usano davvero", () => {
  for (const v of ["", "<chiave>", "{{CHIAVE}}", "${CHIAVE}", "xxx", "...", "changeme", "your-key-here", "la-tua-chiave"]) {
    assert.equal(eSegnaposto(v), true, v);
  }
});

test("eSegnaposto tollera la barra di continuazione della shell — difetto misurato sul pilota", () => {
  // Sul pilota, il 2026-08-06, queste due righe producevano due `block` su una
  // documentazione corretta: la barra finiva dentro il valore.
  assert.equal(eSegnaposto("<la chiave di servizio> \\"), true);
  assert.equal(eSegnaposto("<chiave> \\"), true);
});

test("eSegnaposto non assolve un valore vero", () => {
  assert.equal(eSegnaposto(SERVICE), false);
  assert.equal(eSegnaposto("Tr0ub4dor&3"), false);
  assert.equal(eSegnaposto("<vedi 1Password>Tr0ub4dor3"), false, "SEG-8: le forme a parentesi sono ANCORATE, non prefissi");
});

// ---------------------------------------------------------- famiglia 1 e 2
test("service_role: JWT, formato nuovo `sb_secret_`, e nome di servizio valorizzato", () => {
  const f1 = findingsFile("deploy/note.md", `chiave: ${SERVICE}`);
  assert.equal(f1.length, 1);
  assert.equal(f1[0].severity, "block");
  assert.equal(f1[0].famiglia, "service-role");

  const f2 = findingsFile("wrangler.toml", 'SUPABASE = "sb_secret_abcdef0123456789ABCDEF"');
  assert.equal(f2.filter((f) => f.famiglia === "service-role").length, 1);

  const f3 = findingsFile(".env.produzione", "SUPABASE_SERVICE_ROLE_KEY=Tr0ub4dor3Tr0ub4dor3");
  assert.ok(f3.some((f) => f.famiglia === "nome-di-servizio-valorizzato"));
});

test("una LETTURA di variabile non e' un valore: `process.env` non si segnala", () => {
  const f = findingsFile("src/lib/admin.ts", "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;");
  assert.deepEqual(f, [], "e' esattamente cio' che si vuole che il codice faccia");
});

// -------------------------------------------------------------- famiglia 3
test("credenziale SQL: solo nei `.sql`, e trova la forma del pilota", () => {
  const riga = "  'titolare@fornodoro.it', crypt('password123', gen_salt('bf')), now(),";
  const nelSql = findingsFile("supabase/seed.sql", riga);
  assert.equal(nelSql.length, 1);
  assert.equal(nelSql[0].famiglia, "credenziale-sql");
  assert.ok(nelSql[0].message.includes("pas… [11 caratteri]"), nelSql[0].message);

  const altrove = findingsFile("docs/note.md", riga);
  assert.equal(altrove.length, 0, "`soloIn` deve restringere alla famiglia dei file giusti");
});

test("credenziale SQL: `create role … password` e `encrypted_password =`", () => {
  assert.equal(findingsFile("supabase/migrations/1.sql", "create role api password 'segretissima';").length, 1);
  assert.equal(findingsFile("supabase/migrations/1.sql", "update auth.users set encrypted_password = 'abc123';").length, 1);
});

// -------------------------------------------------------------- famiglia 4
test("token di provider: le forme note, e nessun falso positivo su una parola qualunque", () => {
  const casi = [
    "VERCEL_TOKEN=vercel_aaaaaaaaaaaaaaaaaaaaaaaa",
    "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "STRIPE=sk_live_aaaaaaaaaaaaaaaaaaaaaa",
    "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    "SLACK=xoxb-1234567890-abcdef",
    "-----BEGIN RSA PRIVATE KEY-----",
  ];
  for (const c of casi) {
    assert.ok(findingsFile("config.txt", c).some((f) => f.famiglia === "token-provider"), c);
  }
  assert.equal(findingsFile("README.md", "Il deploy su Vercel si fa da git.").length, 0);
});

// -------------------------------------------------------------- famiglia 5
test("URL con credenziali: l'esenzione locale e' STRETTA", () => {
  // Cio' che il CLI di Supabase stampa a ogni `supabase start`, e che sta in
  // ogni documento di questa casa: esente, o il passo diventa rumore.
  assert.equal(findingsFile("docs/PROGETTO.md", "postgresql://postgres:postgres@127.0.0.1:7622/postgres").length, 0);
  assert.equal(findingsFile("docs/PROGETTO.md", "postgres://postgres:postgres@localhost:54322/postgres").length, 0);
  // Tutto il resto no.
  assert.equal(findingsFile("docs/deploy.md", "postgres://postgres:Tr0ub4dor@db.example.com:5432/app").length, 1);
  assert.equal(findingsFile("docs/deploy.md", "postgres://api:parolamia@127.0.0.1:5432/app").length, 1);
});

// -------------------------------------------------------------- famiglia 6
test("entropia: solo su nomi sospetti, mai su una `NEXT_PUBLIC_*`", () => {
  const opaca = "aG9sYWNvbW9lc3RhczEyMzQ1Njc4OTBhYmNkZWY";
  assert.ok(entropia(opaca) > 4);
  assert.ok(findingsFile("config.json", `"API_SECRET": "${opaca}"`).some((f) => f.famiglia === "entropia-alta"));
  assert.equal(findingsFile("config.json", `"NEXT_PUBLIC_CHIAVE": "${opaca}"`).length, 0);
  assert.equal(findingsFile("config.json", `"descrizione": "${opaca}"`).length, 0);
  // Un hash di lockfile non ha un nome sospetto: non deve produrre niente.
  assert.equal(findingsFile("package-lock.json", `"integrity": "sha512-${opaca}"`).length, 0);
});

test("entropia bassa non e' una chiave", () => {
  assert.ok(entropia("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") < 4);
  assert.equal(findingsFile("c.json", '"API_SECRET": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"').length, 0);
});

// ------------------------------------------------------------- nomi di file
test("un `.env` tracciato e' un segreto consegnato; un `.env.example` no", () => {
  assert.equal(eFileAmbienteTracciato(".env.local"), true);
  assert.equal(eFileAmbienteTracciato(".env"), true);
  assert.equal(eFileAmbienteTracciato("app/.env.production"), true);
  assert.equal(eFileAmbienteTracciato(".env.example"), false);
  assert.equal(eFileEsempio(".env.sample"), true);
  assert.equal(eFileEsempio(".env.local"), false);
});

test("un file di esempio porta i nomi, non i valori", () => {
  const f = findingsEsempio(".env.example", [
    "# commento",
    "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:7621",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "SUPABASE_SECRET_KEY=Tr0ub4dor3Tr0ub4dor3",
    "TITOLARE_EMAIL=rosa@fornodoro.it",
  ].join("\n"));
  assert.equal(f.length, 1, "solo la riga con nome sospetto E valore vero");
  assert.ok(f[0].object.endsWith(":4"));
  assert.ok(f[0].message.includes("SUPABASE_SECRET_KEY"));
});

test("nomeSospetto e ePubblicaPerCostruzione", () => {
  assert.equal(nomeSospetto("SUPABASE_SECRET_KEY"), true);
  assert.equal(nomeSospetto("STRIPE_TOKEN"), true);
  assert.equal(nomeSospetto("DB_PASSWORD"), true);
  assert.equal(nomeSospetto("TITOLARE_EMAIL"), false);
  assert.equal(ePubblicaPerCostruzione("NEXT_PUBLIC_SITO_URL"), true);
  assert.equal(ePubblicaPerCostruzione("SITO_URL"), false);
});

// -------------------------------------------------------------------- binari
test("eBinario riconosce il byte NUL e lascia stare il testo", () => {
  assert.equal(eBinario(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])), true);
  assert.equal(eBinario(Buffer.from("una riga di testo\ncon accenti: perché\n", "utf8")), false);
});

// ------------------------------------------------------------------- il motore
test("esitoSegreti: zero file letti si DICHIARA, non si traduce in «nessun segreto»", () => {
  const { findings, riassunto } = esitoSegreti({});
  assert.deepEqual(findings, []);
  assert.equal(riassunto.letti, 0, "chi chiama deve poter vedere che non e' stato letto niente");
});

test("esitoSegreti: un `.env` tracciato e' un block a prescindere dal contenuto", () => {
  const { findings } = esitoSegreti({ letti: [{ percorso: ".env.local", testo: "VUOTO=1" }] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].message, /TRACCIATO/);
});

test("esitoSegreti: un file NUOVO e non ignorato si guarda come un tracciato", () => {
  // Difetto misurato sul banco il 2026-08-06: quattro sabotaggi su sette hanno
  // scavalcato il passo semplicemente scrivendo un file nuovo. `git ls-files`
  // non lo elenca, `--others --ignored` nemmeno, e il passo dichiarava «140
  // file letti · nessun rilievo» sopra una chiave `service_role` sul disco.
  const { findings, riassunto } = esitoSegreti({
    letti: [{ percorso: "README.md", testo: "niente" }],
    daTracciare: [{ percorso: "src/lib/admin.ts", testo: `const k = "${SERVICE}";` }],
  });
  assert.equal(riassunto.daTracciare, 1);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block", "il gesto successivo di chiunque e' `git add -A`");
  assert.match(findings[0].object, /admin\.ts/);
});

test("esitoSegreti: i file ignorati danno UNA riga per file, non una per rilievo", () => {
  // Misurato sul pilota: per riga uscivano 40 issue, 34 delle quali erano lo
  // stesso file di segreti dello stack locale ripetuto.
  const testo = [`A=${SERVICE}`, `B=${SERVICE}`, `C=${SERVICE}`].join("\n");
  const { findings } = esitoSegreti({ ignorati: [{ percorso: ".env.e2e.local", testo }] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "issue", "un file ignorato non parte con un deploy da git");
  assert.match(findings[0].message, /3 rilievi/);
});

test("esitoSegreti: nella storia il rimedio e' un altro, e il messaggio lo dice", () => {
  const { findings } = esitoSegreti({ storia: [{ percorso: "storia abc123 (2026-08-01)", testo: `K=${SERVICE}` }] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "block");
  assert.match(findings[0].hint, /ruotare la credenziale/);
});

test("esitoSegreti: un binario con nome sospetto si dichiara non letto", () => {
  const { findings } = esitoSegreti({ letti: [{ percorso: "a.md", testo: "ciao" }], binari: ["chiavi/private.key", "public/logo.png"] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].famiglia, "binario-sospetto");
  assert.match(findings[0].object, /private\.key/);
});

test("le famiglie sono sei e hanno id stabili", () => {
  assert.deepEqual(FAMIGLIE.map((f) => f.id), [
    "service-role",
    "nome-di-servizio-valorizzato",
    "credenziale-sql",
    "token-provider",
    "url-con-credenziali",
    "entropia-alta",
  ]);
});

// ------------------------------------------------- l'eccezione dichiarata (§10)
const SEED_DEROGATO = [
  "-- Forno d'Oro — seed 90: SOLO SVILUPPO. NON APPLICARE IN PRODUZIONE.",
  "-- launchpad-consentito: credenziale-sql — solo sviluppo, il percorso di produzione non legge questo file (debito n°27)",
  "insert into auth.users (email, encrypted_password) values ('a@b.it', crypt('password123', gen_salt('bf')));",
].join("\n");

test("eccezioniDichiarate legge famiglia e motivo, e rifiuta un motivo troppo corto", () => {
  const e = eccezioniDichiarate(SEED_DEROGATO);
  assert.equal(e.size, 1);
  assert.match(e.get("credenziale-sql"), /solo sviluppo/);
  assert.equal(eccezioniDichiarate("-- launchpad-consentito: credenziale-sql — ok").size, 0,
    "un'eccezione senza motivo non e' un'eccezione: e' un interruttore");
});

test("l'eccezione DECLASSA a issue, non cancella: resta stampata e resta contata", () => {
  // Il pilota, il 2026-08-06, ha dimostrato che senza questo il gate ha un rosso
  // STRUTTURALE su un progetto corretto — e un rosso strutturale e' la cosa che
  // la §19 dice di non fare.
  const f = findingsFile("supabase/seed/90-solo-sviluppo.sql", SEED_DEROGATO);
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "issue");
  assert.match(f[0].message, /ECCEZIONE DICHIARATA: solo sviluppo/);
  assert.equal(statoDaFindings(f), "pass", "declassata: il passo non e' piu' rosso per questa");
});

test("l'eccezione vale per UNA famiglia e per QUEL file", () => {
  const conAltro = `${SEED_DEROGATO}\n-- e anche: ${SERVICE}`;
  const f = findingsFile("supabase/seed/90.sql", conAltro);
  assert.equal(f.filter((x) => x.severity === "block").length, 1, "la service_role resta bloccante");
  assert.equal(f.find((x) => x.severity === "block").famiglia, "service-role");
});

test("un'eccezione su una famiglia NON derogabile e' essa stessa un `block`", () => {
  const f = findingsFile("src/lib/admin.ts",
    `// launchpad-consentito: service-role — ci serve davvero, giuro\nconst k = "${SERVICE}";`);
  assert.ok(f.some((x) => x.famiglia === "eccezione-non-derogabile" && x.severity === "block"));
  assert.ok(f.some((x) => x.famiglia === "service-role" && x.severity === "block"),
    "e la chiave resta bloccante: un'eccezione non derogabile non declassa niente");
});

test("le famiglie che consegnano l'accesso a un sistema vero non sono derogabili", () => {
  const derogabili = FAMIGLIE.filter((f) => f.derogabile).map((f) => f.id);
  assert.deepEqual(derogabili, ["credenziale-sql", "url-con-credenziali", "entropia-alta"]);
});

test("un'eccezione scaduta o con un refuso si segnala: sembra proteggere e non protegge", () => {
  const scaduta = findingsFile("supabase/seed/pulito.sql",
    "-- launchpad-consentito: credenziale-sql — motivo lungo abbastanza\nselect 1;");
  assert.ok(scaduta.some((x) => x.famiglia === "eccezione-inutile" && x.severity === "warn"));
  const refuso = findingsFile("a.sql", "-- launchpad-consentito: credenziale-sqll — motivo lungo abbastanza\nselect 1;");
  assert.ok(refuso.some((x) => x.famiglia === "eccezione-sconosciuta"));
});

test("nella STORIA un'eccezione non vale: e' scritta da chi aveva sbagliato", () => {
  const f = findingsFile("supabase/seed/90.sql", SEED_DEROGATO, { dove: "storia", etichetta: "supabase/seed/90.sql @ abc123", righeVere: false });
  assert.equal(f.filter((x) => x.severity === "block").length, 1);
});

// ============================================================================
// Regressioni del tribunale del 2026-08-06.
// ============================================================================

test("SEG-1 · IO-6 · un file UTF-16 si DECODIFICA, non si butta fra i binari", () => {
  // Due periti, mandati diversi, riproduzioni diverse, stessa causa. E' la
  // conferma piu' forte che questo protocollo sappia produrre.
  // UTF-16LE e' il default di `Out-File` e di «Salva con nome → Unicode» su
  // Windows: un `.env.production` scritto cosi' aveva un NUL dopo ogni
  // carattere, finiva fra i binari, e la regola «un `.env` tracciato e' un
  // block a prescindere dal contenuto» non lo vedeva mai. Gate VERDE su una
  // chiave `service_role` committata.
  const conBom = (s, cod) => Buffer.concat([
    Buffer.from(cod === "utf16le" ? [0xff, 0xfe] : [0xfe, 0xff]),
    cod === "utf16le" ? Buffer.from(s, "utf16le") : (() => { const b = Buffer.from(s, "utf16le"); b.swap16(); return b; })(),
  ]);
  const testo = `SUPABASE_SERVICE_ROLE_KEY=${SERVICE}`;
  for (const cod of ["utf16le", "utf16be"]) {
    const d = decodifica(conBom(testo, cod));
    assert.equal(d.testo, testo, cod);
    assert.equal(eBinario(conBom(testo, cod)), false, cod);
  }
  // Un vero binario resta binario.
  assert.equal(eBinario(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])), true);
});

test("SEG-1 · le regole sul NOME girano sui PERCORSI, non sui file letti", () => {
  const { findings } = esitoSegreti({ percorsi: [".env.production"], letti: [], binari: [".env.production"] });
  assert.ok(findings.some((f) => f.famiglia === "file-ambiente-tracciato" && f.severity === "block"),
    "una regola sul nome non ha ragione di dipendere dall'esito di readFileSync");
});

test("SEG-3 · `NEXT_PUBLIC_` assolve il CONTENUTO, non il prefisso", () => {
  const opaca = "re_8kQ2vTx4aBcDeFgHiJkLmNoPqRsTuVwXyZ";
  // La chiave anonima resta muta: e' il falso positivo da non fare mai.
  assert.deepEqual(findingsFile(".env.example", `NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}`), []);
  assert.deepEqual(findingsFile(".env.example", "NEXT_PUBLIC_SITO_URL=https://fornodoro.it"), []);
  // Una chiave di un servizio qualunque sotto quel nome no.
  assert.equal(findingsFile("c.env", `NEXT_PUBLIC_RESEND_API_KEY=${opaca}`).length, 1);
  assert.equal(findingsEsempio(".env.example", `NEXT_PUBLIC_RESEND_API_KEY=${opaca}`).length, 1);
});

test("SEG-3 · un prefisso non disarma la famiglia dei nomi di servizio", () => {
  for (const nome of ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "PROD_SERVICE_ROLE_KEY"]) {
    assert.ok(findingsFile("c.env", `${nome}=Tr0ub4dor3Tr0ub4dor3`).some((f) => f.famiglia === "nome-di-servizio-valorizzato"), nome);
  }
});

test("SEG-5 · un'eccezione CITATA dentro un fence non e' una firma", () => {
  const doc = "Si scrive cosi':\n\n```sql\n-- launchpad-consentito: credenziale-sql — motivo lungo abbastanza\n```\n";
  assert.equal(eccezioniDichiarate(doc).size, 0, "e' il falso positivo che references/segreti.md si faceva da solo");
  assert.equal(eccezioniDichiarate("-- launchpad-consentito: credenziale-sql — motivo lungo abbastanza").size, 1);
});

test("SEG-6 · la famiglia a entropia guarda TUTTE le coppie della riga", () => {
  const benigno = "a".repeat(56);
  const segreto = "R3sZ8kQwPmXv2NtLb7YcJd4FgHa1UeIo9Sr";
  assert.equal(findingsFile("c.json", `{"API_SECRET":"${segreto}"}`).length, 1);
  assert.equal(findingsFile("c.json", `{"buildId":"${benigno}","API_SECRET":"${segreto}"}`).length, 1,
    "un valore benigno anteposto accecava la famiglia per tutto il resto della riga");
});

test("SEG-4 · un file non letto si DICHIARA", () => {
  const { findings, riassunto } = esitoSegreti({
    letti: [{ percorso: "a.md", testo: "ciao" }],
    nonLetti: [{ percorso: "dump.sql", motivo: "630 KB, oltre la soglia di 512 KB" }],
  });
  assert.equal(riassunto.nonLetti, 1);
  assert.ok(findings.some((f) => f.famiglia === "non-letto"));
});

test("SEG-9 · `*.key` e `*.pem` sono portatori di chiave; `.crt` no", () => {
  assert.equal(ePortatoreDiChiave("certs/server.key"), true);
  assert.equal(ePortatoreDiChiave("app.pem"), true);
  assert.equal(ePortatoreDiChiave("certs/server.crt"), false, "un certificato e' materiale pubblico");
});

test("un valore ELISO non e' un segreto: `NOME=… comando` e' prosa", () => {
  // Falso positivo misurato sul pilota il 2026-08-06, introdotto dalla
  // correzione SEG-3b e trovato rilanciando il gate: la documentazione che
  // insegna a non committare la chiave veniva accusata di committarla.
  assert.equal(eSegnaposto("… node scripts/crea-titolare.mjs"), true);
  assert.equal(eSegnaposto("..."), true);
  assert.deepEqual(
    findingsFile("docs/PRODUZIONE.md", "> mostrava `SUPABASE_SERVICE_ROLE_KEY=… node scripts/crea-titolare.mjs`, e"),
    [],
  );
  // E un valore vero resta un valore vero.
  assert.equal(findingsFile("c.env", "SUPABASE_SERVICE_ROLE_KEY=Tr0ub4dor3Tr0ub4dor3").length, 1);
});

// ============ collaudo 2026-08-06: cosa restava invisibile al controllo
const SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase" })).toString("base64url") +
  ".Kx8pQ2vN4mZ7bR1tY6wE3sD9fG0hJ5kL";

/**
 * UTF-16 SENZA BOM: il fratello che la correzione SEG-1/IO-6 non copriva.
 * Misurato sull'arena del collaudo: `src/lib/admin.ts` in UTF-16LE senza BOM,
 * chiave `service_role` dentro, tracciato → passo `segreti` **pass**, 0 rilievi.
 */
test("un file UTF-16LE SENZA BOM si legge come testo, e la chiave si vede", () => {
  const buf = Buffer.from(`export const ADMIN = "${SERVICE_ROLE}";\n`, "utf16le");
  const { testo, codifica } = decodifica(buf);
  assert.equal(codifica, "utf-16le (senza BOM)");
  assert.ok(testo.includes(SERVICE_ROLE));
  const f = findingsFile("src/lib/admin.ts", testo);
  assert.equal(f.filter((x) => x.severity === "block").length, 1);
});

test("un file UTF-16BE SENZA BOM si legge come testo", () => {
  const le = Buffer.from(`const K = "${SERVICE_ROLE}";\n`, "utf16le");
  const be = Buffer.from(le);
  be.swap16();
  const { testo, codifica } = decodifica(be);
  assert.equal(codifica, "utf-16be (senza BOM)");
  assert.ok(testo.includes(SERVICE_ROLE));
});

test("un binario vero resta binario: il riconoscimento non indovina", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400)]);
  assert.equal(decodifica(png).testo, null, "un falso positivo qui riempirebbe il passo di rumore su ogni immagine");
  assert.equal(eBinario(png), true);
});

/**
 * Un byte NUL in un sorgente: il modo piu' economico di nascondere il resto del
 * file. Misurato: `pass` con zero rilievi sopra una chiave `service_role`.
 */
test("un file con estensione di testo e contenuto binario BLOCCA: non e' stato letto", () => {
  const { findings } = esitoSegreti({
    letti: [{ percorso: "src/app/page.tsx", testo: "export default function P() { return null; }" }],
    binari: ["src/lib/admin.ts"],
    percorsi: ["src/app/page.tsx", "src/lib/admin.ts"],
  });
  const block = findings.filter((f) => f.severity === "block");
  assert.equal(block.length, 1);
  assert.match(block[0].message, /estensione di testo e contenuto binario/);
});

test("un binario con estensione da binario non produce niente: nessun rumore sulle immagini", () => {
  const { findings } = esitoSegreti({
    letti: [{ percorso: "src/app/page.tsx", testo: "// niente" }],
    binari: ["public/logo.png", "public/foto/interno.jpg"],
    percorsi: ["src/app/page.tsx", "public/logo.png", "public/foto/interno.jpg"],
  });
  assert.equal(findings.length, 0);
});

/**
 * Il `.env` che c'e' stato. `references/segreti.md` §2 prometteva «le stesse
 * famiglie cercate sulla storia», e le due regole sul NOME non ci arrivavano:
 * misurato, un `.env.production` con `SMTP_PASSWORD=…` committato e poi tolto
 * usciva `pass` con zero rilievi. Chi ha clonato ce l'ha.
 */
test("un `.env` committato in passato blocca, anche se oggi e' gitignorato", () => {
  const { findings } = esitoSegreti({
    letti: [{ percorso: "src/app/page.tsx", testo: "// niente" }],
    percorsi: ["src/app/page.tsx"],
    storia: [{ percorso: ".env.production", etichetta: ".env.production @ 9be1c07 (2026-08-06)", testo: `SMTP_PASSWORD=${ESCA.password}` }],
  });
  const block = findings.filter((f) => f.severity === "block");
  assert.equal(block.length, 1);
  assert.match(block[0].message, /COMMITTATO in passato/);
  assert.match(block[0].hint, /RUOTARE/);
});

test("un `.env.example` nella storia non e' un file di ambiente: nessun rilievo", () => {
  const { findings } = esitoSegreti({
    letti: [{ percorso: "src/app/page.tsx", testo: "// niente" }],
    percorsi: ["src/app/page.tsx"],
    storia: [{ percorso: ".env.example", etichetta: ".env.example @ abc", testo: "NEXT_PUBLIC_SITO_URL=" }],
  });
  assert.equal(findings.length, 0);
});

/**
 * Il messaggio di commit. `leggiStoria` guarda i diff: un segreto incollato nel
 * messaggio viaggia col repository esattamente come un file, e non lo guardava
 * nessuno. Misurato: `pass` con zero rilievi.
 */
test("una chiave dentro un messaggio di commit blocca", () => {
  const { findings } = esitoSegreti({
    letti: [{ percorso: "src/app/page.tsx", testo: "// niente" }],
    percorsi: ["src/app/page.tsx"],
    storia: [{ percorso: "(messaggio di commit)", etichetta: "messaggio del commit f8274d640504", testo: `chiave ruotata, la vecchia era ${SERVICE_ROLE}` }],
  });
  const block = findings.filter((f) => f.severity === "block");
  assert.equal(block.length, 1);
  assert.match(block[0].object, /messaggio del commit/);
  assert.match(block[0].hint, /ruotare la credenziale/i);
});

test("la famiglia dei soli `.sql` non scatta su un messaggio di commit", () => {
  const f = findingsFile("(messaggio di commit)", "ho tolto il crypt('password123') dal seed", { dove: "storia" });
  assert.equal(f.length, 0, "`soloIn` deve continuare a valere: un messaggio non e' un file `.sql`");
});
