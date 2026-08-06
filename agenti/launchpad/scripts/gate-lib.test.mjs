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
  percorsiSporchi,
  leggiRuntimeProvider,
  piuVecchioDi,
  VARIABILI_IMPRONTA,
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
  const f = findingsCatena({ handoff: [{ percorso: "docs/handoff/07-schema-forge.md", agente: "schema-forge", testo: "tutto a posto", data: "2026-08-06T10:00:00Z" }] });
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
    handoff: [{ percorso: "docs/handoff/07-schema-forge.md", agente: "schema-forge", testo: "Gate: VERDE", data: "2026-08-06T10:00:00Z" }],
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
  const voci = leggiDebito(TABELLA.replace("| 27 | flow-sentinel | medio |", "| 27 | flow-sentinel | **CHIUSO 2026-08-07 (schema-forge)** |"));
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
  const f = findingsRunbook({ runbook: leggiRunbook(RUNBOOK), ultimoCommitCodice: "2026-08-06T09:00:00Z", adesso: "2026-08-07T00:00:00Z" });
  assert.deepEqual(blocchi(f), []);
});

test("una firma piu' vecchia del codice blocca: ha firmato un altro contenuto", () => {
  const f = findingsRunbook({ runbook: leggiRunbook(RUNBOOK), ultimoCommitCodice: "2026-08-08T09:00:00Z", adesso: "2026-08-09T00:00:00Z" });
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

test("le fonti del commit dell'impronta non si pretendono nel runbook", () => {
  // Difetto misurato sul banco il 2026-08-06: il frammento che il comando
  // `impronta` scrive in `next.config.ts` legge tre variabili, e il passo
  // `ambiente` produceva tre `block` — cioe' il gate diventava rosso per il
  // codice che la sua stessa skill aveva appena messo li'. Un gate che boccia
  // il rimedio che prescrive e' un gate che insegna a non applicarlo.
  assert.deepEqual(VARIABILI_IMPRONTA, ["WEBGUN_COMMIT", "VERCEL_GIT_COMMIT_SHA", "CF_PAGES_COMMIT_SHA"]);
  const lette = new Map(VARIABILI_IMPRONTA.map((n) => [n, "next.config.ts"]));
  lette.set("NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts");
  const f = findingsAmbiente({ lette, runbook: leggiRunbook(RUNBOOK) });
  assert.deepEqual(blocchi(f), []);
});

test("il corpo di `generateBuildId` si cerca in TUTTO il file, non dopo la chiave", () => {
  // La forma che il frammento della skill produce e' `generateBuildId:
  // improntaDalCommit`, con la funzione definita PRIMA. Una finestra di 600
  // caratteri dopo la chiave non vede mai il corpo, e il gate accusava di «non
  // sollevare» un frammento che solleva. Misurato sul banco il 2026-08-06.
  const config = [
    "const improntaDalCommit = () => {",
    "  const sha = process.env.WEBGUN_COMMIT || leggiDaGit();",
    "  if (!sha) { throw new Error('impronta: commit non risolvibile'); }",
    "  return sha.slice(0, 12);",
    "};",
    "const nextConfig = { generateBuildId: improntaDalCommit };",
  ].join("\n");
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee" });
  assert.deepEqual(f, [], "ne' block ne' issue: questo frammento e' quello giusto");
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

// ============================================================================
// Regressioni del tribunale del 2026-08-06 (`/code-inquisition`, council di 3).
// Un difetto senza test di regressione torna: ognuno di questi riproduce il
// caso che il perito ha misurato PRIMA della correzione.
// ============================================================================

test("VER-3 · il registro si legge nelle forme che la casa scrive, e conta cosa NON ha letto", () => {
  const forme = [
    "| 27 | flow-sentinel | medio | cosa | perche | **Blocca il deploy** |",
    "| n°27 | flow-sentinel | medio | cosa | perche | **Blocca il deploy** |",
    "| **27** | flow-sentinel | medio | cosa | perche | **Blocca il deploy** |",
    "| 27. | flow-sentinel | medio | cosa | perche | **Blocca il deploy** |",
  ];
  for (const riga of forme) {
    const voci = leggiDebito(riga);
    assert.equal(voci.length, 1, riga);
    assert.equal(voci[0].numero, 27, riga);
    assert.equal(voci[0].bloccaDeploy, true, riga);
  }
  // Una riga di tabella che il parser NON sa leggere si conta e si dichiara:
  // «nessun bloccante» e «non ho saputo leggere» non devono assomigliarsi.
  const conRottura = leggiDebito("| # | Agente | Cosa |\n|---|---|---|\n| ventisette | x | y |");
  assert.equal(conRottura.length, 0);
  assert.equal(conRottura.nonLette, 1);
  const f = findingsDebito({ voci: conRottura, runbookEsiste: true });
  assert.equal(blocchi(f).length, 1);
  assert.match(blocchi(f)[0].message, /non lette/);
});

test("VER-4 · «NON CHIUSA» non vale chiusa: il gettone ha forma fissa", () => {
  const riga = (gravita) => `| 27 | flow-sentinel | ${gravita} | cosa | perche | **Blocca il deploy** |`;
  assert.equal(leggiDebito(riga("medio")).at(0).chiusa, false);
  assert.equal(leggiDebito(riga("NON CHIUSA")).at(0).chiusa, false, "misurato sul pilota: valeva chiusa");
  assert.equal(leggiDebito(riga("alto - non ancora chiuso")).at(0).chiusa, false);
  assert.equal(leggiDebito(riga("**basso** (era medio: meta' di database CHIUSA il 2026-08-06)")).at(0).chiusa, false,
    "e' la voce n15 del pilota vero, che il gate classificava chiusa");
  assert.equal(leggiDebito(riga("**CHIUSO 2026-08-06 (schema-forge, P.4g)**")).at(0).chiusa, true);
});

test("VER-5 · una firma post-datata non disattiva la freschezza per sempre", () => {
  const r = leggiRunbook(RUNBOOK.replace("— 2026-08-06", "— 2030-01-01"));
  const f = findingsRunbook({ runbook: r, ultimoCommitCodice: "2026-09-01T00:00:00Z", adesso: "2026-08-06T12:00:00Z" });
  assert.ok(blocchi(f).some((x) => /nel futuro/.test(x.message)));
});

test("VER-5 · l'ULTIMA data della riga e' la firma, non la prima", () => {
  assert.equal(esitoFirma("Alberto Marocco (committente, contratto 2030-01-01) — 2026-08-06").data, "2026-08-06");
});

test("VER-7 · l'impronta non si accontenta di una pagina che NOMINA il commit", () => {
  const config = "const c = { generateBuildId: () => { throw new Error('x'); } };";
  const log = "Deploy log del progetto\nCommit: dd7cf7bbdb93ee81864a7553579e6a2095a57060\nnessuna applicazione qui dietro.";
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee", html: log, url: "http://x" });
  assert.ok(blocchi(f).some((x) => /non porta l'impronta attesa/.test(x.message)),
    "un log di deploy non e' l'app: il passo deve trovare un BUILD ID, non una stringa");
});

test("VER-8 · il commit approvato dal runbook si CONFRONTA con HEAD", () => {
  const config = "const c = { generateBuildId: () => { throw new Error('x'); } };";
  const comune = { nextConfig: config, buildIdDisco: "dd7cf7bbdb93", commit: "dd7cf7bbdb93ee81" };
  assert.deepEqual(blocchi(findingsImpronta({ ...comune, commitApprovato: "dd7cf7bbdb93ee81" })), []);
  const diverso = findingsImpronta({ ...comune, commitApprovato: "0000000000000000" });
  assert.ok(blocchi(diverso).some((x) => /il runbook approva/.test(x.message)));
  const prosa = findingsImpronta({ ...comune, commitApprovato: "si rilegge a ogni pubblicazione" });
  assert.ok(blocchi(prosa).some((x) => /non e' un identificativo di commit/.test(x.message)));
});

test("VER-9 · un handoff non tracciato da git non ha freschezza, e si dichiara", () => {
  const f = findingsCatena({
    handoff: [{ percorso: "docs/handoff/12-flow-sentinel.md", agente: "flow-sentinel", testo: "Gate: VERDE", data: null }],
    ultimoCommitCodice: "2026-12-31T00:00:00Z",
  });
  assert.equal(blocchi(f).length, 1);
  assert.match(blocchi(f)[0].message, /non tracciato da git/);
});

test("VER-12 · le forme in cui una persona scrive davvero la versione del provider", () => {
  for (const [riga, atteso] of [
    ["Node 24", 24], ["Node 24.9.0", 24], ["Node 24.x", 24], ["Node.js 24", 24],
    ["Node 24 LTS", 24], ["22.x", 22], ["Node 24 (pannello Vercel)", 24],
  ]) {
    assert.equal(leggiRuntimeProvider(riga), atteso, riga);
  }
  // Rifiuta solo cio' che non si puo' leggere senza indovinare.
  assert.equal(leggiRuntimeProvider("Node 24 minimo, consigliato 22"), null);
  assert.equal(leggiRuntimeProvider("l'ultima disponibile"), null);
  assert.equal(leggiRuntimeProvider(""), null);
});

test("VER-16 · l'handoff di launchpad non si autoaccusa nel passo della catena", () => {
  const f = findingsCatena({
    handoff: [
      { percorso: "docs/handoff/12-flow-sentinel.md", agente: "flow-sentinel", testo: "Gate: VERDE", data: "2026-08-06T10:00:00Z" },
      { percorso: "docs/handoff/14-launchpad.md", agente: "launchpad", testo: "**Gate: ROSSO** (4 falliti)", data: "2026-08-06T10:00:00Z" },
    ],
  });
  assert.deepEqual(f, [], "a giudicarlo e' il passo 9, che conosce il verdetto misurato");
});

// =============== collaudo 2026-08-06: il registro letto per intero
/**
 * Un registro nella forma che questa casa scrive davvero: la testata del
 * pilota (`| # | Agente | Gravità | Cosa | Perché resta | Rientro previsto |`),
 * una voce che blocca, una che dichiara di NON bloccare, una chiusa nella
 * colonna giusta e una chiusa nella colonna sbagliata.
 */
const REGISTRO_VERO = `# Debito tecnico

| # | Agente | Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|---|---|
| 1 | flow-sentinel | **alto** | Nessun tetto ai tentativi su \`/prenota\`: **blocca il deploy** finche' non e' mitigata | la difesa sta nel gateway del provider | cyber-shield |
| 2 | vetrina-crafter | basso | Le immagini sono segnaposto. **Non blocca il deploy**, e' un contenuto | mancano le foto vere | quando arrivano |
| 3 | schema-forge | CHIUSO 2026-08-06 | \`engines.node\` non dichiarato | — | — |
| 4 | schema-forge | basso | Il seed non porta account | — | CHIUSO 2026-08-06 dal proprietario |
`;

test("«Non blocca il deploy» non e' una dichiarazione di bloccare il deploy", () => {
  const voci = leggiDebito(REGISTRO_VERO);
  const bloccanti = voci.filter((v) => v.bloccaDeploy && !v.chiusa).map((v) => v.numero);
  assert.deepEqual(bloccanti, [1],
    "la n°2 dichiara in lettere di NON bloccare: contarla costringe il runbook a rispondere a una voce che non chiede niente, e insegna a scavalcare il passo");
});

test("la negazione deve governare il verbo, non stare da qualche parte nella riga", () => {
  const registro = `| # | A | G | C |\n|---|---|---|---|\n| 7 | x | alto | la voce non e' chiusa **e** blocca il deploy |\n`;
  assert.equal(leggiDebito(registro)[0].bloccaDeploy, true,
    "un `non` lontano dal verbo non deve disarmare la dichiarazione");
});

test("una chiusura scritta in un'altra colonna non viene letta, e il gate lo DICHIARA", () => {
  const voci = leggiDebito(REGISTRO_VERO);
  assert.equal(voci.find((v) => v.numero === 3).chiusa, true, "terza colonna: e' li' che si legge");
  assert.equal(voci.find((v) => v.numero === 4).chiusa, false);
  assert.equal(voci.find((v) => v.numero === 4).chiusaAltrove, true);
  const f = findingsDebito({ voci, runbookEsiste: true, risposte: new Map([[1, "mitigata: tetto per IP sul gateway"]]) });
  const issue = f.filter((x) => x.severity === "issue");
  assert.equal(issue.length, 1);
  assert.match(issue[0].message, /colonna che questo passo non legge/);
  assert.equal(f.filter((x) => x.severity === "block").length, 0,
    "il registro e' corretto: nessun bloccante senza risposta");
});

test("HEAD INDIETRO rispetto al remoto blocca: il provider costruirebbe un commit mai misurato", () => {
  const f = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", indietro: 2 });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /remoto e' avanti di 2 commit/);
});

test("i due versi si distinguono, e nessuno dei due copre l'altro", () => {
  const avanti = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", avanti: 3 });
  const indietro = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", indietro: 3 });
  assert.match(avanti[0].message, /HEAD e' avanti/);
  assert.match(indietro[0].message, /remoto e' avanti/);
  assert.equal(findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main" }).length, 0,
    "allineato e pulito: nessun rilievo, o il gate diventa rumore");
});

/**
 * `git status` puo' mentire, e allora l'albero pulito non prova piu' niente.
 * Misurato sull'arena del collaudo: sorgente committato che legge
 * `process.env.CHIAVE_MAI_DICHIARATA`, versione pulita sul disco,
 * `--assume-unchanged` sopra → `ambiente` pass, zero rilievi.
 */
test("un file che git non guarda piu' blocca: disco e commit possono divergere in silenzio", () => {
  const f = findingsRadice({ sporco: [], ramo: "main", upstream: "origin/main", bugiardi: ["src/lib/seo.ts"] });
  assert.equal(blocchi(f).length, 1);
  assert.match(f[0].message, /assume-unchanged|skip-worktree/);
  assert.match(f[0].message, /1 file/);
});

// ====== collaudo 2026-08-06: il verdetto letto dove non era dichiarato
const HANDOFF_CON_FENCE_TILDE = `# Handoff 07 — Schema Forge

La forma richiesta dalla §19 e' questa:

~~~
Gate: VERDE
~~~

Il verdetto di QUESTO progetto non e' ancora stato scritto.
`;

test("un verdetto dentro un fence a TILDE non e' una dichiarazione", () => {
  assert.equal(verdettoHandoff(HANDOFF_CON_FENCE_TILDE), null,
    "tre tilde bastavano a far leggere come certificato un esempio: e a far leggere VERDE un handoff che dichiarava ROSSO");
});

test("un handoff che dichiara ROSSO resta ROSSO anche con un VERDE citato sopra", () => {
  const testo = `# Handoff 12\n\nEsempio:\n\n~~~\nGate: VERDE\n~~~\n\n**Gate: ROSSO** (1 fallito)\n`;
  assert.equal(verdettoHandoff(testo), "ROSSO", "e' la Legge n°1: non si pubblica su gate rosso");
});

test("un verdetto in un blocco indentato di quattro spazi non e' una dichiarazione", () => {
  assert.equal(verdettoHandoff("# Handoff\n\nEsempio:\n\n    Gate: VERDE\n\nfine.\n"), null);
  assert.equal(verdettoHandoff("# Handoff\n\n  Gate: VERDE\n"), "VERDE", "due spazi sono rientro, non codice");
});

test("due verdetti diversi nello stesso certificato bloccano: non si indovina quale vale", () => {
  const h = [{ percorso: "docs/handoff/08-vetrina-crafter.md", agente: "vetrina-crafter", data: "2026-08-06T10:00:00Z",
    testo: "> Gate: VERDE (copiato da un altro progetto)\n\n**Gate: ROSSO** (1 fallito)\n" }];
  const f = findingsCatena({ handoff: h, ultimoCommitCodice: "2026-08-05T10:00:00Z" });
  assert.ok(f.some((x) => x.severity === "block" && /2 verdetti diversi/.test(x.message)));
});

test("un handoff datato nel FUTURO blocca: un certificato che non scade mai non e' un certificato", () => {
  const h = [{ percorso: "docs/handoff/07-schema-forge.md", agente: "schema-forge", data: "2030-01-01T00:00:00Z",
    testo: "**Gate: VERDE**\n" }];
  const f = findingsCatena({ handoff: h, ultimoCommitCodice: "2026-08-05T10:00:00Z", adesso: "2026-08-06T12:00:00Z" });
  assert.ok(f.some((x) => x.severity === "block" && /nel futuro/.test(x.message)),
    "e' la stessa regola che il tribunale aveva gia' imposto alla firma del runbook (VER-5)");
  assert.equal(findingsCatena({ handoff: h, ultimoCommitCodice: "2026-08-05T10:00:00Z" }).length, 0,
    "senza `adesso` la libreria resta pura e non accusa nessuno");
});

// ====== collaudo 2026-08-06: la risposta al bloccante, la firma, la sezione vuota
test("una tabella numerica fuori da §Prescrizioni non risponde a nessun bloccante", () => {
  const conEstranea = RUNBOOK.replace(
    "| 27 | password nel seed | il seed di produzione non porta account |",
    "| 99 | voce inesistente | chiusa a monte |",
  ) + "\n\n## Costi\n\n| # | Passo | Nota |\n|---|---|---|\n| 27 | apertura del progetto | si fa una volta sola, dal pannello |\n";
  const r = leggiRunbook(conEstranea);
  assert.equal(r.risposte.has(27), false,
    "una riga di procedura che comincia per un numero non e' una risposta a un debito");
  const voci = leggiDebito("| # | A | G | C |\n|---|---|---|---|\n| 27 | schema-forge | alto | password nel seed: **blocca il deploy** |\n");
  const f = findingsDebito({ voci, runbookEsiste: true, risposte: r.risposte });
  assert.equal(f.filter((x) => x.severity === "block").length, 1);
});

test("«non si pubblica finche'» e' una dichiarazione di bloccare il deploy", () => {
  const voci = leggiDebito("| # | A | G | C |\n|---|---|---|---|\n| 1 | flow-sentinel | alto | nessun tetto ai tentativi, e **non si pubblica** finche' non e' mitigato |\n");
  assert.equal(voci[0].bloccaDeploy, true);
});

test("la firma dell'orchestratore e' rifiutata: in pipeline la colonna «chi conferma» e' vuota", () => {
  assert.equal(esitoFirma("Orchestratore (pipeline Web Gun) — 2026-08-06").valida, false);
  assert.equal(esitoFirma("Prompt Smith — 2026-08-06").valida, false);
  assert.equal(esitoFirma("Alberto Marocco (committente) — 2026-08-06").valida, true);
});

test("la firma PER DELEGA e' accettata e DICHIARATA: e' una tensione, non una decisione del gate", () => {
  const delegato = RUNBOOK.replace("Confermato da: Alberto Marocco (committente) — 2026-08-06",
    "Confermato da: Direzione lavori (per delega del committente Alberto Marocco) — 2026-08-06");
  const f = findingsRunbook({ runbook: leggiRunbook(delegato), ultimoCommitCodice: "2026-08-06T09:00:00Z", adesso: "2026-08-07T00:00:00Z" });
  assert.equal(f.filter((x) => x.severity === "block").length, 0, "il gate non cambia il contratto dello SKILL.md da solo");
  assert.equal(f.filter((x) => x.severity === "warn" && /PER DELEGA/.test(x.message)).length, 1,
    "ma la nomina nel punto in cui conta: la §6 vieta di delegare cio' che non si annulla");
});

test("una sezione obbligatoria presente come titolo e vuota e' un `issue`", () => {
  const svuotato = RUNBOOK.replace("Il menu e le pagine informative.", "");
  const f = findingsRunbook({ runbook: leggiRunbook(svuotato), ultimoCommitCodice: "2026-08-06T09:00:00Z", adesso: "2026-08-07T00:00:00Z" });
  assert.equal(f.filter((x) => x.severity === "block").length, 0, "il titolo c'e': non e' una sezione mancante");
  assert.ok(f.some((x) => x.severity === "issue" && /vuota di contenuto/.test(x.message)),
    "chi firma trova la domanda e non la risposta");
});

// ====== collaudo 2026-08-06: l'indirizzo in chiaro e il gestore contraddetto
test("un indirizzo `http://` come valore di produzione blocca — la riga che la specifica prometteva", () => {
  const runbook = leggiRunbook(RUNBOOK.replace(
    "| NEXT_PUBLIC_SITO_URL | prima della build | https://fornodoro.it |",
    "| NEXT_PUBLIC_SITO_URL | prima della build | http://staging.fornodoro.it |",
  ));
  const f = findingsAmbiente({ lette: new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"]]), runbook });
  const block = f.filter((x) => x.severity === "block");
  assert.equal(block.length, 1);
  assert.match(block[0].message, /non e' `https:\/\/`/);
});

test("un indirizzo `https://` non produce niente: il caso normale resta muto", () => {
  const f = findingsAmbiente({ lette: new Map([["NEXT_PUBLIC_SITO_URL", "src/lib/seo.ts"]]), runbook: leggiRunbook(RUNBOOK) });
  assert.equal(f.filter((x) => x.severity === "block").length, 0);
});

test("`packageManager` che contraddice il lockfile blocca: il provider sceglie da li'", () => {
  const richieste = [{ nome: "next", range: ">=20", minimo: 20 }];
  const lockfile = [{ nome: "package-lock.json", tracciato: true }];
  const runbook = leggiRunbook("Runtime del provider: Node 24");
  const f = findingsRuntime({ engines: ">=22", richieste, lockfile, runbook, packageManager: "pnpm@9.12.0" });
  const block = f.filter((x) => x.severity === "block");
  assert.equal(block.length, 1);
  assert.match(block[0].message, /pnpm-lock\.yaml/);
  assert.equal(
    findingsRuntime({ engines: ">=22", richieste, lockfile, runbook, packageManager: "npm@10.5.0" }).filter((x) => x.severity === "block").length,
    0, "il gestore coerente col lockfile non produce niente");
});

test("i percorsi di `git status --porcelain` si leggono interi, anche dopo il trim", () => {
  // Le righe arrivano gia' ripulite da `gitRighe`: e' li' che nasceva il difetto.
  assert.deepEqual(percorsiSporchi(["M src/lib/seo.ts", "?? src/lib/nuovo.ts", "A  supabase/seed/00.sql"]),
    ["src/lib/seo.ts", "src/lib/nuovo.ts", "supabase/seed/00.sql"]);
});

test("una rinomina si dichiara col nome NUOVO: e' quello che il commit porterebbe", () => {
  assert.deepEqual(percorsiSporchi(["R  src/lib/seo.ts -> src/lib/seo-nuovo.ts"]), ["src/lib/seo-nuovo.ts"]);
});

test("uno sha citato in un COMMENTO non e' un'impronta scritta a mano", () => {
  const config = `// Misurato: BUILD_ID = \`9c2914484e28\`, il commit vero era \`2d1355e3d697\`.
const improntaDalCommit = () => {
  const sha = process.env.WEBGUN_COMMIT;
  if (!sha) { throw new Error("impronta: commit non risolvibile"); }
  return sha.slice(0, 12);
};
export default { generateBuildId: improntaDalCommit };
`;
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "abcdef1234567", commit: "abcdef1234567890" });
  assert.equal(f.filter((x) => /letterale/.test(x.message)).length, 0,
    "il commento che SPIEGA il difetto non deve far bocciare il rimedio: e' la classe SEG-5, sul codice");
});

test("ma uno sha usato come VALORE resta un `block`", () => {
  const config = `const improntaDalCommit = () => process.env.WEBGUN_COMMIT ?? "2d1355e3d697";
export default { generateBuildId: improntaDalCommit };
`;
  const f = findingsImpronta({ nextConfig: config, buildIdDisco: "2d1355e3d697", commit: "2d1355e3d697aa" });
  assert.equal(f.filter((x) => x.severity === "block" && /letterale/.test(x.message)).length, 1);
});
