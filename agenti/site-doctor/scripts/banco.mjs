#!/usr/bin/env node
/**
 * banco.mjs — Il banco di prova di Site Doctor.
 *
 * Genera e serve un sito **conforme**, e sa piantarci dentro un difetto alla
 * volta. Serve a due cose che il pilota non puo' dare:
 *
 *   1. provare che i passi sanno essere VERDI. Un gate che sul solo sito
 *      disponibile e' rosso ovunque non ha dimostrato di saper distinguere:
 *      ha dimostrato di saper dire di no.
 *   2. il sabotaggio classe per classe — togli la difesa, il passo deve
 *      diventare rosso — su un sito che possiamo rompere. Il pilota e' di
 *      un'altra chat e resta di sola lettura (D17).
 *
 * PERCHE' E' TRACCIATO, invece di essere usa e getta come vuole `DECISIONI.md`
 * §12: la §25 traccia «il banco che un clone pulito sa rilanciare». Questo non
 * ha dipendenze, non ha database, non ha chiavi e non ha `node_modules`: e' un
 * file. Ogni affermazione di sabotaggio del verbale si rilancia con un comando.
 *
 * USO:
 *   node banco.mjs --dir <cartella> --porta 3821 [--sabota <classe>]
 *   node banco.mjs --elenco              # le classi di sabotaggio
 *
 * Scrive in `<cartella>`: `docs/`, `.next/` e il sito servito. Poi resta in
 * ascolto finche' non lo si ferma.
 */

import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD_ID = "BANCOsitedoctor001";
const TERZO = "https://cdn.esempio-terzo.test";

/** Le classi di sabotaggio: una riga ciascuna, e il passo che deve diventare rosso. */
export const CLASSI = Object.freeze({
  A: "informativa sparita (la pagina risponde 404)                    → informativa-privacy",
  B: "informativa scollegata da una pagina                            → informativa-privacy",
  C: "informativa che non nomina le voci dell'art. 13                 → informativa-privacy",
  D: "informativa consegnata con un segnaposto dentro                 → informativa-privacy",
  E: "campo che raccoglie un dato personale e non e' dichiarato       → dati-raccolti",
  F: "pagina che raccoglie dati e non rimanda all'informativa         → dati-raccolti",
  G: "archiviazione nel browser non dichiarata                        → archiviazione-client",
  H: "terzo caricato e non dichiarato                                 → archiviazione-client",
  I: "archiviazione dichiarata NON essenziale e nessun banner         → archiviazione-client",
  J: "script servito che non si scarica (bundle non letto)            → archiviazione-client (MANCANTE)",
  K: "immagine senza attributo alt                                    → accessibilita-servita",
  L: "attributo lang sparito da <html>                                → accessibilita-servita",
  M: "gerarchia dei titoli saltata (h1 → h3)                          → accessibilita-servita",
  N: "campo senza etichetta e senza aria-label                        → accessibilita-servita",
  O: "collegamento senza nome accessibile                             → accessibilita-servita",
  P: "una voce con DUE proprietari (il difetto dell'Open Graph)       → perimetro",
  Q: "una voce tolta dalla tabella di proprieta'                      → perimetro",
  R: "voce delegata a un file che non esiste                          → perimetro",
  S: "voce delegata a un file che esiste e non la nomina              → perimetro",
  T: "certificato che dichiara un esito diverso da questa esecuzione  → perimetro",
  U: "handoff che dichiara VERDE su un'esecuzione rossa               → contratto-uscita",
  V: "sito multilingua senza nessun hreflang                          → lingua-e-hreflang",
  W: "hreflang non reciproco                                          → lingua-e-hreflang",
  X: "sitemap piu' ricca dei collegamenti (camminata che non cammina) → superficie-pubblica",
  Y: "un'altra applicazione sulla stessa porta                        → superficie-pubblica",
});

const ha = (s, ...classi) => classi.includes(s);

// ------------------------------------------------------------------ il sito
const guscio = ({ percorso, lang, titolo, corpo, sab, hreflang = "" }) => `<!DOCTYPE html>
<html${ha(sab, "L") && percorso === "/" ? "" : ` lang="${lang}"`}>
<head>
<meta charset="utf-8">
<title>${titolo} · Panificio del Banco</title>
<meta name="description" content="Il banco di prova di Site Doctor.">
${hreflang}
<link rel="icon" href="/favicon.svg">
<script src="/_next/static/chunks/app.js"></script>
${ha(sab, "H") ? `<script src="${TERZO}/analitica.js"></script>` : ""}
${ha(sab, "J") ? `<script src="/_next/static/chunks/sparito.js"></script>` : ""}
</head>
<body>
<!-- ${BUILD_ID} -->
<header><nav><a href="/">Panificio del Banco</a> <a href="/contatti">Contatti</a>${ha(sab, "V", "W") ? ' <a href="/en">English</a>' : ""}</nav></header>
<main>
${corpo}
</main>
<footer>
${percorso === "/contatti" && ha(sab, "F") ? "" : '<a href="/privacy">Informativa privacy</a>'}
${ha(sab, "O") ? '<a href="/contatti"><span></span></a>' : ""}
</footer>
</body>
</html>`;

const CORPO_HOME = (sab) => `<h1>Pane cotto a legna</h1>
${ha(sab, "M") ? "<h3>Da tre generazioni</h3>" : "<h2>Da tre generazioni</h2>"}
<p>Impastiamo la sera e inforniamo all'alba.</p>
${ha(sab, "K") ? '<img src="/forno.jpg">' : '<img src="/forno.jpg" alt="Il forno a legna acceso">'}`;

const CORPO_CONTATTI = (sab) => `<h1>Scrivici</h1>
<form method="post" action="/inviato">
<label for="nome">Nome</label>
<input id="nome" name="nome" autocomplete="name" required>
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required>
${ha(sab, "E") ? '<label for="tel">Telefono</label><input id="tel" name="telefono" autocomplete="tel">' : ""}
${ha(sab, "N") ? '<input id="messaggio" name="messaggio">' : ""}
<button type="submit">Invia</button>
</form>`;

const VOCI_ART13 = `<h2>Titolare del trattamento</h2>
<p>Panificio del Banco s.r.l., via del Banco 1, con sede legale in Italia, è il titolare del trattamento dei dati personali raccolti da questo sito.</p>
<h2>Finalità e base giuridica</h2>
<p>I dati del modulo di contatto sono trattati per rispondere alla richiesta. La base giuridica è l'esecuzione di misure precontrattuali richieste dall'interessato, art. 6 paragrafo 1 lettera b del Regolamento.</p>
<h2>Destinatari</h2>
<p>I dati non sono comunicati a terzi. Il fornitore che ospita il sito agisce come responsabile del trattamento.</p>
<h2>Tempi di conservazione</h2>
<p>I messaggi sono conservati per dodici mesi dalla ricezione, poi cancellati.</p>
<h2>Diritti dell'interessato</h2>
<p>Chi scrive ha diritto di accesso, rettifica, cancellazione, limitazione e opposizione. Le richieste si mandano all'indirizzo del titolare.</p>
<h2>Reclamo</h2>
<p>È sempre possibile proporre reclamo al Garante per la protezione dei dati personali.</p>
<h2>Cookie e archiviazione</h2>
<p>Questo sito usa una sola archiviazione tecnica nel browser, descritta nel certificato di idoneità.</p>`;

const CORPO_PRIVACY = (sab) => {
  if (ha(sab, "C")) return "<h1>Informativa</h1><p>Trattiamo i dati con la massima cura e attenzione, come è giusto che sia, e non li diamo a nessuno che non debba averli per ragioni di servizio ordinario.</p>";
  if (ha(sab, "D")) return `<h1>Informativa privacy</h1><p>Titolare del trattamento: {{RAGIONE SOCIALE}}.</p>${VOCI_ART13}`;
  return `<h1>Informativa privacy</h1>${VOCI_ART13}`;
};

const HREFLANG_IT = `<link rel="alternate" hreflang="it" href="/"><link rel="alternate" hreflang="en" href="/en"><link rel="alternate" hreflang="x-default" href="/">`;
const HREFLANG_EN_ROTTO = `<link rel="alternate" hreflang="en" href="/en">`;

function sito(sab) {
  const pagine = new Map();
  const multilingua = ha(sab, "V", "W");
  pagine.set("/", guscio({
    percorso: "/", lang: "it", titolo: "Home", corpo: CORPO_HOME(sab), sab,
    hreflang: multilingua && !ha(sab, "V") ? HREFLANG_IT : "",
  }));
  pagine.set("/contatti", guscio({ percorso: "/contatti", lang: "it", titolo: "Contatti", corpo: CORPO_CONTATTI(sab), sab }));
  if (!ha(sab, "A")) {
    pagine.set("/privacy", guscio({ percorso: "/privacy", lang: "it", titolo: "Informativa privacy", corpo: CORPO_PRIVACY(sab), sab }));
  }
  if (multilingua) {
    pagine.set("/en", guscio({
      percorso: "/en", lang: "en", titolo: "Home", corpo: "<h1>Wood-fired bread</h1><p>We bake at dawn.</p>", sab,
      hreflang: ha(sab, "V") ? "" : HREFLANG_EN_ROTTO,
    }));
  }
  // Classe B: una pagina perde il collegamento all'informativa.
  if (ha(sab, "B")) pagine.set("/", pagine.get("/").replace('<a href="/privacy">Informativa privacy</a>', ""));
  // Classe X: i collegamenti spariscono, la sitemap resta ricca.
  if (ha(sab, "X")) pagine.set("/", pagine.get("/").replace(/<a [^>]*href="\/(contatti|privacy)"[^>]*>.*?<\/a>/g, ""));
  return pagine;
}

const sitemap = (pagine, base) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [...pagine.keys()].map((p) => `<url><loc>${base}${p === "/" ? "/" : p}</loc></url>`).join("\n") +
  `\n</urlset>`;

const BUNDLE = (sab) => `"use strict";
// il carrello del banco: archiviazione tecnica, dichiarata nel certificato
export function salvaCarrello(v){ localStorage.setItem("banco:carrello", JSON.stringify(v)); }
${ha(sab, "G") ? 'export function ricorda(v){ sessionStorage.setItem("banco:ultimo", v); }' : ""}
`;

// ------------------------------------------------------------- i documenti
const RIGHE_VOCI = (sab) => {
  const righe = [
    ["informativa-privacy", "site-doctor", "—", "conforme"],
    ["basi-giuridiche", "site-doctor", "—", "conforme"],
    ["cookie-archiviazione", "site-doctor", "—", "conforme"],
    ["consenso", "site-doctor", "—", "conforme"],
    ["accessibilita-pubblico", "site-doctor", "—", ha(sab, "T") ? "non conforme" : "conforme"],
    ["lingua-hreflang", "site-doctor", "—", ha(sab, "V", "W") ? "non conforme" : "non applicabile"],
    ["contrasti", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["canonical", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["sitemap", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["robots", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["noindex-private", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["open-graph", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["favicon", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["dati-strutturati", "speed-demon", "docs/handoff/13-speed-demon.md", "delegato"],
    ["accessibilita-admin", "gestionale-crafter", "docs/handoff/10-gestionale-crafter.md", "delegato"],
    ["antispam", "—", "—", "scoperto"],
  ];
  let scelte = righe;
  if (ha(sab, "P")) scelte = [...righe, ["open-graph", "site-doctor", "—", "conforme"]];
  if (ha(sab, "Q")) scelte = righe.filter(([v]) => v !== "favicon");
  if (ha(sab, "R")) scelte = righe.map((r) => (r[0] === "canonical" ? [r[0], r[1], "docs/handoff/99-inesistente.md", r[3]] : r));
  if (ha(sab, "S")) scelte = righe.map((r) => (r[0] === "open-graph" ? [r[0], r[1], "docs/handoff/10-gestionale-crafter.md", r[3]] : r));
  return scelte.map((r) => `| ${r.join(" | ")} |`).join("\n");
};

const CERTIFICATO = (sab, base) => `# Certificato di idoneità — Panificio del Banco

Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06

## Ambiente

URL verificato: ${base}
Lingue dichiarate: ${ha(sab, "V", "W") ? "it en" : "it"}
Informativa privacy: /privacy
Banner di consenso: ${ha(sab, "I") ? "no" : "no"}

## Superficie pubblica dichiarata

| percorso | cosa fa |
|---|---|
| / | vetrina |
| /contatti | modulo di contatto |
| /privacy | informativa |
${ha(sab, "V", "W") ? "| /en | vetrina in inglese |" : ""}

## Archiviazione dichiarata

| chiave | tipo | essenziale | scopo | dove |
|---|---|---|---|---|
| localStorage | archiviazione locale | ${ha(sab, "I") ? "no" : "sì"} | tiene il carrello fra una pagina e l'altra | /contatti, / |

## Dati raccolti dai moduli pubblici

| modulo | campo | base giuridica | conservazione |
|---|---|---|---|
| /contatti | nome | misure precontrattuali (art. 6.1.b) | 12 mesi |
| /contatti | email | misure precontrattuali (art. 6.1.b) | 12 mesi |

## Voci di conformità e proprietà

| voce | proprietario | dove è dichiarato | esito |
|---|---|---|---|
${RIGHE_VOCI(sab)}
`;

const HANDOFF_SPEED = `# 13 — speed-demon

Gate: VERDE

Metatag e indicizzazione: \`canonical\` unico su ogni pagina, \`sitemap.xml\` e
\`robots.txt\` generati, \`noindex\` sulle rotte private, **Open Graph** e
\`twitter:card\` su tutte le pagine pubbliche, **favicon** servita, dati
strutturati JSON-LD sull'attività. Categoria accessibilità di Lighthouse a 100
su tutte le pagine dichiarate: comprende l'audit dei **contrasti**.
`;

const HANDOFF_GESTIONALE = `# 10 — gestionale-crafter

Gate: VERDE

Rotte amministrative protette. Accessibilità dell'area amministrativa verificata
con \`eslint-plugin-jsx-a11y\` sul passo a11y del gate.
`;

const HANDOFF_SITE_DOCTOR = (verdetto) => `# 15 — site-doctor

## Cosa ho fatto
Certificato di idoneità emesso sul banco.

## Problemi noti
Nessuno.

Gate: ${verdetto}
`;

// ------------------------------------------------------------------ scrittura
function scrivi(dir, relativo, contenuto) {
  const pieno = join(dir, relativo);
  mkdirSync(dirname(pieno), { recursive: true });
  writeFileSync(pieno, contenuto, "utf8");
}

const MARCATORE = ".banco-site-doctor";

/**
 * Il banco si rifiuta di scrivere in una cartella che non ha dichiarato di
 * essere un banco.
 *
 * `--dir .` lanciato dalla radice di un progetto vero sovrascriveva senza una
 * parola `docs/conformita.md` — il certificato che launchpad legge per decidere
 * se pubblicare — e tre file di handoff, con contenuti fabbricati. Nessuna
 * conferma, nessun controllo: la contaminazione silenziosa di un artefatto che
 * altri trattano come fonte di verita'.
 *
 * La cartella e' buona se e' vuota (e allora si marca) o se porta gia' il
 * marcatore. Non rompe l'uso dichiarato — un banco nasce in una cartella
 * scratch, che alla prima esecuzione e' vuota.
 */
function preparaCartella(dir) {
  mkdirSync(dir, { recursive: true });
  const marcatore = join(dir, MARCATORE);
  if (existsSync(marcatore)) return;
  const dentro = readdirSync(dir);
  if (dentro.length > 0) {
    console.error(
      `${dir} non e' vuota e non porta il marcatore \`${MARCATORE}\`: il banco NON ci scrive.\n` +
      "Questo banco sovrascrive `docs/conformita.md` e `docs/handoff/*`: dentro un progetto vero cancellerebbe il certificato che launchpad legge per decidere se pubblicare.\n" +
      `Usa una cartella vuota, oppure crea il file \`${MARCATORE}\` se sei sicuro che sia un banco.`,
    );
    process.exit(2);
  }
  writeFileSync(marcatore, "Cartella di banco di site-doctor. Il banco sovrascrive docs/ e .next/ qui dentro.\n", "utf8");
}

function materializza(dir, sab, base, { handoffVerde = false } = {}) {
  preparaCartella(dir);
  // Classe Y: su disco c'e' un ALTRO progetto — build id diverso *e* asset
  // diverso. Le due cose insieme, perche' il solo build id diverso e' l'altro
  // caso (stesso sito, processo indietro) e il gate deve saperli distinguere.
  scrivi(dir, ".next/BUILD_ID", ha(sab, "Y") ? "UNALTRAAPPLICAZIONE9" : BUILD_ID);
  scrivi(dir, ".next/static/chunks/app.js", ha(sab, "Y") ? "// il bundle di un altro progetto\n" : BUNDLE(sab));
  scrivi(dir, "docs/conformita.md", CERTIFICATO(sab, base));
  scrivi(dir, "docs/handoff/13-speed-demon.md", HANDOFF_SPEED);
  scrivi(dir, "docs/handoff/10-gestionale-crafter.md", HANDOFF_GESTIONALE);
  scrivi(dir, "docs/handoff/15-site-doctor.md", HANDOFF_SITE_DOCTOR(handoffVerde ? "VERDE" : "ROSSO"));
}

// -------------------------------------------------------------------- server
function avvia({ porta, sab, dir }) {
  const base = `http://127.0.0.1:${porta}`;
  const pagine = sito(sab);
  // Classe U a parte, l'handoff dichiara il verdetto che il gate produrra':
  // altrimenti OGNI classe sarebbe rossa anche su `contratto-uscita`, e il
  // sabotaggio non isolerebbe piu' niente. La U inverte apposta.
  materializza(dir, sab, base, { handoffVerde: sab === "" });
  const bundle = BUNDLE(sab);

  const server = createServer((req, res) => {
    const percorso = new URL(req.url, base).pathname.replace(/\/+$/, "") || "/";
    const rispondi = (stato, tipo, corpo) => {
      res.writeHead(stato, { "content-type": tipo });
      res.end(corpo);
    };
    if (percorso === "/sitemap.xml") return rispondi(200, "application/xml", sitemap(sito(sab), base));
    if (percorso === "/_next/static/chunks/app.js") return rispondi(200, "application/javascript", bundle);
    if (percorso === "/favicon.svg") return rispondi(200, "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'/>");
    if (pagine.has(percorso)) return rispondi(200, "text/html; charset=utf-8", pagine.get(percorso));
    return rispondi(404, "text/html; charset=utf-8", "<!DOCTYPE html><html lang=\"it\"><head><title>Non trovata</title></head><body><main><h1>Non trovata</h1></main></body></html>");
  });
  server.listen(porta, "127.0.0.1");
  return { server, base };
}

function main() {
  const argv = process.argv.slice(2);
  const val = (nome, def = null) => {
    const i = argv.indexOf(nome);
    return i >= 0 ? argv[i + 1] : def;
  };
  if (argv.includes("--elenco")) {
    console.log("Classi di sabotaggio del banco di Site Doctor:\n");
    for (const [k, v] of Object.entries(CLASSI)) console.log(`  ${k}  ${v}`);
    console.log("\n  (nessuna)  il banco conforme: il gate deve chiudere VERDE");
    return;
  }
  const dir = val("--dir");
  const porta = Number(val("--porta", "3821"));
  const sab = val("--sabota", "") ?? "";
  if (!dir) {
    console.error("Manca --dir: il banco scrive `docs/` e `.next/` dentro quella cartella, e il gate va lanciato da lì.");
    process.exit(2);
  }
  if (sab && !(sab in CLASSI)) {
    console.error(`Classe di sabotaggio sconosciuta: "${sab}". Elenco con --elenco.`);
    process.exit(2);
  }
  const { base } = avvia({ porta, sab, dir });
  console.log(`banco in ascolto su ${base} — cartella ${dir}${sab ? ` — SABOTAGGIO ${sab}: ${CLASSI[sab]}` : " — conforme"}`);
}

// Guardia a doppio confronto, la forma che P.0-igiene-2 ha imposto a otto
// epiloghi: `import.meta.main` non esiste su Node 20 (script muto che esce 0),
// e il solo confronto testuale e' falso attraverso la junction
// `.claude/skills/<skill>/...` — li' `argv[1]` resta il percorso della junction
// mentre `import.meta.url` e' gia' canonico. `realpathSync` dentro un `try`,
// con ricaduta sul testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
