import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIdDaHtml,
  CONTRATTI,
  contrattoUscita,
  esitoFirma,
  findingsAmbiente,
  findingsCatena,
  findingsDebito,
  findingsImpronta,
  findingsRadice,
  findingsRunbook,
  findingsRuntime,
  improntaAttesa,
  improntaCombacia,
  leggiDebito,
  leggiRunbook,
  minimoNode,
  numeriCitati,
  piuVecchioDi,
  verdettoDa,
  verdettoHandoff,
} from "./gate-lib.mjs";

const blocchi = (f) => f.filter((x) => x.severity === "block");

// ==================================================== 1. radice-pulita
test("un working tree sporco blocca: il provider riceve il commit, non il disco", () => {
  const f = findingsRadice({ sporco: ["src/app/page.tsx", "package.json"], ramo: "main", upstream: "origin/main" });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /2 file non committati/);
});

test("HEAD avanti rispetto al remoto blocca — il verde falso della sosta di meta' pacchetto", () => {
  const f = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", avanti: 3 });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /avanti di 3 commit/);
});

test("albero pulito e allineato: nessun bloccante", () => {
  const f = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", avanti: 0 });
  assert.deepEqual(blocchi(f), []);
});

test("nessun upstream e' un `issue`, non un `block`: si puo' pubblicare da CLI", () => {
  const f = findingsRadice({ sporco: [], ramo: "main", upstream: null });
  assert.deepEqual(blocchi(f), []);
  assert.equal(f[0].severity, "issue");
});

// ====================================================== 2. catena-gate
test("verdettoHandoff legge la riga di forma fissa in tutte le decorazioni markdown", () => {
  assert.equal(verdettoHandoff("**Gate: VERDE** (0 falliti)"), "VERDE");
  assert.equal(verdettoHandoff("- Gate: ROSSO"), "ROSSO");
  assert.equal(verdettoHandoff("> Gate : VERDE"), "VERDE");
  assert.equal(verdettoHandoff("il gate era verde, credo"), null);
});

test("verdettoHandoff ignora un blocco di codice: li' dentro c'e' un ESEMPIO", () => {
  const testo = "# Handoff\n\n```\nGate: VERDE\n```\n\nnessuna riga vera.";
  assert.equal(verdettoHandoff(testo), null);
});

test("un `Gate: ROSSO` a monte blocca la pubblicazione — la Legge n°1", () => {
  const f = findingsCatena({ handoff: [{ percorso: "docs/handoff/12-flow-sentinel.md", agente: "flow-sentinel", testo: "Gate: ROSSO", data: "2026-08-06T10:00:00Z" }] });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /ROSSO/);
});

test("un handoff senza riga `Gate:` blocca: e' prosa, non un certificato", () => {
  const f = findingsCatena({ handoff: [{ percorso: "docs/handoff/07-schema-forge.md", agente: "schema-forge", testo: "tutto a posto", data: null }] });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /nessuna riga/);
});

test("un handoff piu' vecchio del codice blocca: certificava un altro artefatto", () => {
  const f = findingsCatena({
    handoff: [{ percorso: "docs/handoff/08-vetrina-crafter.md", agente: "vetrina-crafter", testo: "Gate: VERDE", data: "2026-08-05T09:00:00Z" }],
    ultimoCommitCodice: "2026-08-06T18:00:00Z",
  });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /piu' vecchio del codice/);
});

test("un handoff piu' RECENTE del codice non e' un rilievo", () => {
  const f = findingsCatena({
    handoff: [{ percorso: "docs/handoff/08-vetrina-crafter.md", agente: "vetrina-crafter", testo: "Gate: VERDE", data: "2026-08-06T18:00:00Z" }],
    ultimoCommitCodice: "2026-08-05T09:00:00Z",
  });
  assert.deepEqual(f, []);
});

test("contratto sul disco senza handoff: il silenzio non e' verde", () => {
  const f = findingsCatena({
    handoff: [{ percorso: "docs/handoff/07-schema-forge.md", agente: "schema-forge", testo: "Gate: VERDE", data: null }],
    proveTrovate: ["supabase/migrations/", "docs/flussi-critici.md"],
  });
  assert.equal(blocchi(f).length, 1);
  assert.equal(f[0].object, "flow-sentinel");
  assert.match(f[0].message, /contratto esiste/);
});

test("le prove di appartenenza alla catena sono cinque e stabili", () => {
  assert.deepEqual(CONTRATTI.map((c) => c.agente), [
    "schema-forge", "vetrina-crafter", "gestionale-crafter", "flow-sentinel", "speed-demon",
  ]);
});

// ================================================= 3. debito-bloccante
const TABELLA = [
  "| # | Agente | Gravità | Cosa | Perché resta | Rientro previsto |",
  "|---|---|---|---|---|---|",
  "| 4 | schema-forge | **alto** | Nessuna limitazione di frequenza | non e' materia di schema | **Prescrizione, non rattoppo**: e il deploy (P.5) non può partire senza |",
  "| 11 | vetrina-crafter | **CHIUSO 2026-08-06 (schema-forge)** | un cast | — | — |",
  "| 27 | flow-sentinel | medio | Il seed porta due account con password nota | in locale e' la loro funzione | **Blocca il deploy (P.5)**: il seed di produzione non porta account |",
  "| 32 | speed-demon | **alto** | Su Node < 22 non si costruisce | preesistente | **Blocca il deploy (P.5)** insieme a n°4 |",
  "| 33 | speed-demon | basso | una cosa qualunque | — | quando capita |",
].join("\n");

test("leggiDebito riconosce numero, chiusura e dichiarazione di bloccare il deploy", () => {
  const voci = leggiDebito(TABELLA);
  assert.equal(voci.length, 5);
  assert.deepEqual(voci.filter((v) => v.bloccaDeploy && !v.chiusa).map((v) => v.numero), [4, 27, 32]);
  assert.equal(voci.find((v) => v.numero === 11).chiusa, true);
  assert.equal(voci.find((v) => v.numero === 33).bloccaDeploy, false);
});

test("il PUNTO dentro `P.5` non deve rompere il riconoscimento — difetto misurato sul pilota", () => {
  // La prima stesura usava `[^.]{0,40}` e leggeva TRE bloccanti su quattro:
  // taceva sul n°4, che e' esattamente cio' che il criterio di P.5 esiste per
  // scoprire.
  const voci = leggiDebito("| 4 | x | alto | y | z | e il deploy (P.5) non può partire senza |");
  assert.equal(voci[0].bloccaDeploy, true);
});

test("un bloccante che il runbook non nomina e' un `block`", () => {
  const f = findingsDebito({ voci: leggiDebito(TABELLA), runbookEsiste: true, risposte: new Map() });
  assert.equal(blocchi(f).length, 3);
  assert.deepEqual(blocchi(f).map((x) => x.object.match(/n°(\d+)/)[1]), ["4", "27", "32"]);
});

test("nominare non e' rispondere: una risposta vuota o segnaposto resta `block`", () => {
  const risposte = new Map([[4, "{{RISPOSTA}}"], [27, "ok"], [32, "chiuso da P.4g il 2026-08-06, `engines` dichiarato"]]);
  const f = findingsDebito({ voci: leggiDebito(TABELLA), runbookEsiste: true, risposte });
  const numeri = blocchi(f).map((x) => x.object.match(/n°(\d+)/)[1]);
  assert.deepEqual(numeri.sort(), ["27", "4"]);
});

test("una voce gia' chiusa a monte non blocca piu' niente", () => {
  const voci = leggiDebito(TABELLA.replace("| 27 | flow-sentinel | medio |", "| 27 | flow-sentinel | **CHIUSO 2026-08-07** |"));
  const f = findingsDebito({ voci, runbookEsiste: true, risposte: new Map([[4, "mitigato con un tetto su Kong"], [32, "Node 24 sul pannello"]]) });
  assert.deepEqual(blocchi(f), []);
});

test("un riferimento orfano si segnala: e' l'unico segno di una riga cancellata", () => {
  const citati = numeriCitati(["Vedi debito n°99 per il resto.", "residuo n° 27 chiuso"]);
  assert.deepEqual([...citati].sort((a, b) => a - b), [27, 99]);
  const f = findingsDebito({ voci: leggiDebito(TABELLA), citati, runbookEsiste: false });
  const orfani = f.filter((x) => x.severity === "issue");
  assert.equal(orfani.length, 1);
  assert.match(orfani[0].object, /99/);
});

// ==================================================== 6. runtime
test("minimoNode: le forme che si incontrano davvero", () => {
  assert.equal(minimoNode(">=22.0.0"), 22);
  assert.equal(minimoNode(">= 20"), 20);
  assert.equal(minimoNode("^18.17.0"), 18);
  assert.equal(minimoNode("24"), 24);
  assert.equal(minimoNode(""), null);
  assert.equal(minimoNode(null), null);
});

test("minimoNode: `||` e' un'UNIONE, e il minimo e' il piu' PICCOLO — difetto misurato sul pilota", () => {
  // `dependency-cruiser` dichiara questo, cioe' «da 20.12 in su». La prima
  // stesura ne ricavava 24 e bocciava un progetto corretto che dichiarava >=22.
  assert.equal(minimoNode("^20.12||^22||>=24"), 20);
  assert.equal(minimoNode(">=18 || >=22"), 18);
});

test("minimoNode: un'alternativa illeggibile rende illeggibile TUTTA l'unione", () => {
  assert.equal(minimoNode("^20 || qualcosa-di-strano"), null, "indovinare alzerebbe il minimo di un'unione non capita");
});

test("nessun `engines` dichiarato e' un block, e nomina la dipendenza piu' esigente", () => {
  const f = findingsRuntime({
    engines: null,
    richieste: [{ nome: "@supabase/realtime-js", range: ">=22.0.0", minimo: 22 }],
    lockfile: [{ nome: "package-lock.json", tracciato: true }],
  });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].hint, /@supabase\/realtime-js/);
});

test("`engines` piu' basso di quello che una dipendenza pretende e' un block", () => {
  const f = findingsRuntime({
    engines: ">=20",
    richieste: [{ nome: "@supabase/realtime-js", range: ">=22.0.0", minimo: 22 }],
    lockfile: [{ nome: "package-lock.json", tracciato: true }],
  });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /minimo 20.*minimo 22/s);
});

test("un lockfile che c'e' ma non e' tracciato non parte: identico a non averlo", () => {
  const f = findingsRuntime({ engines: ">=22", richieste: [], lockfile: [{ nome: "package-lock.json", tracciato: false }] });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /non tracciato/);
});

test("il runbook deve dichiarare il runtime del provider, e il gate lo CONFRONTA", () => {
  const richieste = [{ nome: "@supabase/realtime-js", range: ">=22.0.0", minimo: 22 }];
  const lockfile = [{ nome: "package-lock.json", tracciato: true }];
  const senza = findingsRuntime({ engines: ">=22", richieste, lockfile, runbook: leggiRunbook("Provider: Vercel") });
  assert.equal(blocchi(senza).length, 1);
  const basso = findingsRuntime({ engines: ">=22", richieste, lockfile, runbook: leggiRunbook("Runtime del provider: Node 20") });
  assert.match(blocchi(basso)[0].message, /Node 20.*almeno 22/);
  const giusto = findingsRuntime({ engines: ">=22", richieste, lockfile, runbook: leggiRunbook("Runtime del provider: Node 24") });
  assert.deepEqual(blocchi(giusto), []);
});

// ==================================================== il runbook
const RUNBOOK = [
  "# Runbook di deploy",
  "",
  "Provider: Vercel",
  "Dominio: https://fornodoro.it",
  "Runtime del provider: Node 24",
  "Modo di deploy: git",
  "Radici spedite: src/, next.config.ts",
  "Commit approvato: abcdef1234567890",
  "",
  "## Variabili d'ambiente di produzione",
  "| Nome | Impostata | Note |",
  "|---|---|---|",
  "| NEXT_PUBLIC_SITO_URL | prima della build | https://fornodoro.it |",
  "| NEXT_PUBLIC_SUPABASE_URL | prima della build | il progetto di produzione |",
  "",
  "## Cosa diventa pubblico",
  "Il menu e le pagine informative.",
  "",
  "## Rollback",
  "Versione precedente: deployment `dpl_abc`",
  "",
  "## Prescrizioni lasciate dagli altri agenti",
  "| # | Cosa | Risposta |",
  "|---|---|---|",
  "| 27 | password nel seed | il seed di produzione non porta account |",
  "",
  "Confermato da: Alberto Marocco (committente) — 2026-08-06",
].join("\n");

test("leggiRunbook estrae i campi, le variabili e le prescrizioni", () => {
  const r = leggiRunbook(RUNBOOK);
  assert.equal(r.provider, "Vercel");
  assert.equal(r.dominio, "https://fornodoro.it");
  assert.equal(r.modoDeploy, "git");
  assert.deepEqual(r.radiciSpedite, ["src/", "next.config.ts"]);
  assert.equal(r.versionePrecedente, "deployment `dpl_abc`");
  assert.equal(r.variabili.length, 2);
  assert.equal(r.variabili[0].nome, "NEXT_PUBLIC_SITO_URL");
  assert.equal(r.risposte.get(27), "il seed di produzione non porta account");
  assert.deepEqual([...r.sezioni].sort(), ["prescrizioni", "pubblico", "rollback", "variabili"]);
});

test("esitoFirma rifiuta il segnaposto, l'agente e la firma senza data", () => {
  assert.equal(esitoFirma(null).valida, false);
  assert.equal(esitoFirma("{{NOME}} ({{RUOLO}})").valida, false);
  assert.equal(esitoFirma("Launchpad (agente) — 2026-08-06").valida, false);
  assert.equal(esitoFirma("Alberto Marocco (committente)").valida, false, "senza data non si confronta con niente");
  const buona = esitoFirma("Alberto Marocco (committente) — 2026-08-06");
  assert.equal(buona.valida, true);
  assert.equal(buona.data, "2026-08-06");
});

test("un runbook completo e firmato dopo l'ultimo commit non ha bloccanti", () => {
  const f = findingsRunbook({ runbook: leggiRunbook(RUNBOOK), ultimoCommitCodice: "2026-08-06T09:00:00Z" });
  assert.deepEqual(blocchi(f), []);
});

test("una firma piu' vecchia del codice blocca: ha firmato un altro contenuto", () => {
  const f = findingsRunbook({ runbook: leggiRunbook(RUNBOOK), ultimoCommitCodice: "2026-08-08T09:00:00Z" });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /firma del 2026-08-06/);
});

test("le sezioni obbligatorie mancanti, i segnaposto e un dominio non https sono block", () => {
  const rotto = RUNBOOK
    .replace("## Cosa diventa pubblico", "## Note")
    .replace("Dominio: https://fornodoro.it", "Dominio: fornodoro.it")
    .replace("Versione precedente: deployment `dpl_abc`", "Versione precedente: {{DA RIEMPIRE}}");
  const f = findingsRunbook({ runbook: leggiRunbook(rotto), ultimoCommitCodice: null });
  const messaggi = blocchi(f).map((x) => x.object);
  assert.ok(messaggi.includes("§Cosa diventa pubblico"));
  assert.ok(messaggi.includes("Dominio"));
  assert.ok(messaggi.some((m) => m.includes("deploy.md")), "i segnaposto residui");
});

// ==================================================== 5. ambiente
test("una variabile letta dal codice e non dichiarata blocca", () => {
  const lette = new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"], ["STRIPE_SECRET_KEY", "src/lib/pagamenti.ts"]]);
  const f = findingsAmbiente({ lette, runbook: leggiRunbook(RUNBOOK) });
  assert.equal(blocchi(f).length, 1);
  assert.equal(blocchi(f)[0].object, "STRIPE_SECRET_KEY");
});

test("una `NEXT_PUBLIC_*` impostata solo a runtime blocca: il bundle e' gia' scritto", () => {
  const r = leggiRunbook(RUNBOOK.replace("| NEXT_PUBLIC_SITO_URL | prima della build |", "| NEXT_PUBLIC_SITO_URL | a runtime |"));
  const f = findingsAmbiente({ lette: new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"]]), runbook: r });
  assert.equal(blocchi(f).length, 1);
  assert.match(blocchi(f)[0].hint, /sitemap/);
});

test("un indirizzo locale come valore di produzione blocca", () => {
  const r = leggiRunbook(RUNBOOK.replace("| https://fornodoro.it |", "| http://127.0.0.1:3621 |"));
  const f = findingsAmbiente({ lette: new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"]]), runbook: r });
  assert.ok(blocchi(f).some((x) => /indirizzo locale/.test(x.message)));
});

test("una variabile di servizio col VALORE nel runbook blocca: il runbook e' committato", () => {
  const r = leggiRunbook(RUNBOOK.replace(
    "| NEXT_PUBLIC_SUPABASE_URL | prima della build | il progetto di produzione |",
    "| SUPABASE_SECRET_KEY | a runtime | sb_secret_abcdef0123456789 |",
  ));
  const f = findingsAmbiente({ lette: new Map([["SUPABASE_SECRET_KEY", "src/lib/admin.ts"]]), runbook: r });
  assert.ok(blocchi(f).some((x) => /VALORE/.test(x.message)));
});

test("una variabile dichiarata e mai letta e' un `issue`: quasi sempre un nome cambiato", () => {
  const f = findingsAmbiente({ lette: new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"]]), runbook: leggiRunbook(RUNBOOK) });
  const issue = f.filter((x) => x.severity === "issue");
  assert.equal(issue.length, 1);
  assert.equal(issue[0].object, "NEXT_PUBLIC_SUPABASE_URL");
});

// ==================================================== 7. impronta
test("buildIdDaHtml legge le tre forme, compresa quella misurata sul pilota", () => {
  // Next 16 + Turbopack: il build id sta nel payload RSC, con le virgolette
  // sfuggite. E' l'UNICA forma presente sull'HTML del pilota il 2026-08-06.
  assert.deepEqual(buildIdDaHtml('...\\"d\\":\\"$undefined\\",\\"b\\":\\"mRBe6eqMjjl0W5m2tfJ24\\"}...'), ["mRBe6eqMjjl0W5m2tfJ24"]);
  assert.deepEqual(buildIdDaHtml('{"buildId":"abcdef123456"}'), ["abcdef123456"]);
  assert.deepEqual(buildIdDaHtml('<script src="/_next/static/abcdef123456/_buildManifest.js">'), ["abcdef123456"]);
  assert.deepEqual(buildIdDaHtml("<html></html>"), []);
});

test("improntaCombacia confronta per prefisso, e rifiuta le stringhe troppo corte", () => {
  assert.equal(improntaAttesa("DD7CF7BBDB93EE81864A7553"), "dd7cf7bbdb93");
  assert.equal(improntaCombacia("dd7cf7bbdb93", "dd7cf7bbdb93ee81864a7553"), true);
  assert.equal(improntaCombacia("dd7cf7bbdb93", "aa7cf7bbdb93"), false);
  assert.equal(improntaCombacia("abc", "abc"), false, "sotto i sette caratteri due commit collidono davvero");
});

test("`generateBuildId` assente blocca: l'impronta casuale non si puo' dimostrare dopo", () => {
  const f = findingsImpronta({ nextConfig: "export default {};", buildIdDisco: "casuale123", commit: "dd7cf7bbdb93ee" });
  assert.ok(blocchi(f).some((x) => /non dichiarato/.test(x.message)));
});

test("uno SHA LETTERALE in `generateBuildId` blocca — il difetto che avrei spedito", () => {
  const config = 'const c = { generateBuildId: () => process.env.WEBGUN_COMMIT ?? "dd7cf7bbdb93" };';
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee" });
  assert.ok(blocchi(f).some((x) => /letterale/.test(x.message)),
    "al commit successivo quel letterale dichiarerebbe con sicurezza il commit sbagliato");
});

test("`generateBuildId` che non solleva e' un `issue`: un artefatto muto non deve nascere", () => {
  const config = "const c = { generateBuildId: () => process.env.WEBGUN_COMMIT ?? runGit() };";
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee" });
  assert.ok(f.some((x) => x.severity === "issue" && /solleva/.test(x.message)));
  assert.deepEqual(blocchi(f), []);
});

test("l'app servita che non porta l'impronta attesa blocca", () => {
  const config = "const c = { generateBuildId: () => { throw new Error('x'); } };";
  const f = findingsImpronta({
    nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee",
    html: '\\"b\\":\\"unaltrabuild1\\"', url: "http://127.0.0.1:3621",
  });
  assert.ok(blocchi(f).some((x) => /non porta l'impronta attesa/.test(x.message)));
});

test("impronta coerente su tutta la catena: nessun bloccante", () => {
  const config = "const c = { generateBuildId: () => { const s = risolvi(); if (!s) throw new Error('x'); return s; } };";
  const f = findingsImpronta({
    nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee81",
    html: '\\"b\\":\\"dd7cf7bbdb93\\"', url: "http://127.0.0.1:3621",
  });
  assert.deepEqual(blocchi(f), []);
});

// ==================================================== 9. contratto-uscita
test("contratto d'uscita: assente, divergente, coerente", () => {
  assert.equal(blocchi(contrattoUscita("docs/handoff/14-launchpad.md", null, "ROSSO")).length, 1);
  assert.equal(blocchi(contrattoUscita("x.md", "**Gate: VERDE**", "ROSSO")).length, 1);
  assert.deepEqual(blocchi(contrattoUscita("x.md", "**Gate: ROSSO** (3 falliti)", "ROSSO")), [],
    "dichiarare non e' fallire: un handoff che dichiara rosso PASSA questo passo");
  assert.deepEqual(blocchi(contrattoUscita("x.md", "**Gate: VERDE**", "VERDE")), []);
});

test("un handoff col segnaposto del template dentro blocca", () => {
  assert.equal(blocchi(contrattoUscita("x.md", "Gate: VERDE\n\nDominio: {{DOMINIO}}", "VERDE")).length, 1);
});

// ==================================================== comuni
test("verdettoDa: un solo passo mancante rende il verdetto ROSSO", () => {
  assert.equal(verdettoDa([{ status: "pass" }, { status: "pass" }]), "VERDE");
  assert.equal(verdettoDa([{ status: "pass" }, { status: "skipped" }]), "ROSSO");
  assert.equal(verdettoDa([{ status: "fail" }]), "ROSSO");
});

test("piuVecchioDi non accusa nessuno quando una data manca", () => {
  assert.equal(piuVecchioDi(null, "2026-08-06T00:00:00Z"), false);
  assert.equal(piuVecchioDi("2026-08-06T00:00:00Z", null), false);
  assert.equal(piuVecchioDi("non-una-data", "2026-08-06T00:00:00Z"), false);
  assert.equal(piuVecchioDi("2026-08-05T00:00:00Z", "2026-08-06T00:00:00Z"), true);
});
