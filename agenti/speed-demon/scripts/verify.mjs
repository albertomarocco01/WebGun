#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Speed Demon.
 *
 * COSA FA: misura le premesse (contratto firmato, rete E2E verde, build di
 * produzione e non dev server) PRIMA di leggere i numeri di Lighthouse. Ogni
 * passo finisce in uno di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica
 *   mancante, e il gate resta rosso.
 *
 * USO:  node verify.mjs --url <url-della-build> [--giri N] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: lighthouse e Chrome, la skill flow-sentinel per il passo
 *             `rete-verde`. Ognuna assente vale MANCANTE, mai PASS.
 *
 * `--url` NON ha un default, ed e' deliberato: un gate che indovina
 * `localhost:3000` misura l'app di un altro progetto e stampa `pass`. E'
 * successo davvero a Flow Sentinel il 2026-07-30, su questa stessa macchina,
 * con la 3000 occupata da un portfolio. Il prezzo e' gia' stato pagato.
 *
 * Le regole vivono in `gate-lib.mjs` e hanno i loro test: qui c'e' solo il
 * guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  argomentiOstiliACmd,
  CATEGORIE,
  contaGravita,
  contrattoUscita,
  dettaglioFindings,
  dettaglioMisura,
  DISPERSIONE_MASSIMA,
  eLaMiaBuild,
  esitoPagina,
  findingsBudget,
  findingsContratto,
  findingsSeo,
  formaEseguibile,
  indiziDevServer,
  leggiContratto,
  metatagDaHtml,
  motivoNessunaMisura,
  primoEseguibile,
  statoDaFindings,
  statoMisura,
  verdettoDa,
} from "./gate-lib.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const AGENTI_DIR = dirname(SKILL_DIR);
const GATE_FLUSSI = join(AGENTI_DIR, "flow-sentinel", "scripts", "verify.mjs");
const PROGETTO = process.cwd();
const CONTRATTO = "docs/performance.md";
const HANDOFF_GLOB = "docs/handoff";

export const ID = Object.freeze({
  contratto: "contratto-performance",
  rete: "rete-verde",
  build: "build-produzione",
  misura: "misura",
  budget: "budget",
  seo: "seo-meta",
  uscita: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;
export const GIRI_DEFAULT = 3;

const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  return existsSync(pieno) ? readFileSync(pieno, "utf8") : null;
};

// --------------------------------------- eseguibili risolti a mano su Windows
// `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd`
// (npx, lighthouse installati da npm) risulta ENOENT sul nome. NON si abilita
// `shell: true`: li' gli argomenti vengono concatenati invece che passati come
// vettore, e questo gate passa URL con `&`. Prezzo gia' pagato da Schema Forge
// e da Flow Sentinel, non si ripaga.
function dove(nome) {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [nome], {
    encoding: "utf8",
  });
  if (res.error || res.status !== 0) return null;
  // `primoEseguibile`, non `[0]`: la prima riga di `where npx` e' lo script
  // senza estensione, e Windows non sa eseguirlo. Difetto misurato il
  // 2026-07-30 al primo giro di questo gate — vedi il commento in gate-lib.
  return primoEseguibile(res.stdout);
}

function esegui(cmd, args, opzioni = {}) {
  const { file, prefisso } = formaEseguibile(cmd, dove);

  // Il controllo vale SOLO quando si passa davvero da `cmd /c`: `node` si
  // risolve in un `.exe` e riceve gli argomenti come vettore, quindi il
  // percorso di questa skill — che vive sotto «Web Gun», con lo spazio — non e'
  // un problema li'. Lo diventa solo attraverso lo shim.
  if (prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(args);
    if (ostili.length > 0) {
      return {
        error: new Error(
          `argomenti con spazi non passabili da cmd.exe: ${ostili.map((a) => JSON.stringify(a)).join(", ")}`,
        ),
        status: null,
        stdout: "",
        stderr: "",
      };
    }
  }

  return spawnSync(file, [...prefisso, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...opzioni,
  });
}

/**
 * Una GET che non esplode: ritorna `{ stato, corpo }` oppure `null`.
 *
 * Due tentativi, e non e' pigrizia difensiva: subito dopo sei giri di
 * Lighthouse il server e' ancora occupato a chiudere connessioni, e una GET
 * puo' cadere una volta sola. Misurato il 2026-07-30: il passo `seo-meta`
 * diceva «HTML non letto» per la home su un server che rispondeva 200 a ogni
 * `curl` lanciato un secondo dopo. Un tentativo solo trasformava un intoppo di
 * rete in un rilievo sui metatag, cioe' un rosso che punta all'imputato
 * sbagliato.
 */
async function preleva(url, { tentativi = 2, segui = false } = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const risposta = await fetch(url, { redirect: segui ? "follow" : "manual" });
      return {
        stato: risposta.status,
        corpo: await risposta.text(),
        intestazioni: risposta.headers,
        // `Location` c'e' solo sui 3xx: e' cio' che distingue «questa pagina»
        // da «un'altra pagina con lo stesso indirizzo dichiarato».
        rimandoA: risposta.status >= 300 && risposta.status < 400 ? risposta.headers.get("location") : null,
      };
    } catch {
      if (i === tentativi - 1) return null;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

const unisci = (base, percorso) => new URL(percorso, base).toString();

// ----------------------------------------------------------------- i passi
const PASSI = [
  {
    id: ID.contratto,
    nome: "contratto delle pagine e delle soglie",
    async esegui(ctx) {
      const testo = leggiSeCe(CONTRATTO);
      if (testo === null) {
        return record(this.id, this.nome, "skipped",
          `${CONTRATTO} assente: senza contratto non si sa quali pagine contano, e ottimizzare senza saperlo significa ottimizzare la home lasciando lenta la pagina che vende (comando \`measure\`)`);
      }
      ctx.contratto = leggiContratto(testo);
      const findings = findingsContratto(ctx.contratto);
      const dettaglio = [
        `${ctx.contratto.pagine.length} pagine · form factor: ${ctx.contratto.formFactor} · deroghe scritte: ${ctx.contratto.deroghe.length}`,
        ctx.contratto.confermatoDa ? `confermato da: ${ctx.contratto.confermatoDa}` : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.rete,
    nome: "rete E2E di Flow Sentinel",
    async esegui(ctx, args) {
      // Legge n°2: non si corre senza rete. E la rete si RILANCIA, non si
      // ricorda: un handoff che dice «verde» e' il ricordo di un'altra
      // esecuzione, e questo agente modifica codice gia' collaudato da altri.
      if (!existsSync(join(PROGETTO, "docs", "flussi-critici.md"))) {
        return record(this.id, this.nome, "skipped",
          "il progetto non ha `docs/flussi-critici.md`: nessuna batteria E2E da rilanciare. Speed Demon modifica codice gia' collaudato da altri, e senza rete ogni ottimizzazione e' una scommessa");
      }
      if (!existsSync(GATE_FLUSSI)) {
        return record(this.id, this.nome, "skipped",
          `gate di Flow Sentinel non raggiungibile in ${GATE_FLUSSI}`);
      }
      const res = esegui("node", [GATE_FLUSSI, "--json", ...(args.url ? ["--url", args.url] : [])]);
      if (res.error) {
        return record(this.id, this.nome, "skipped", `gate di Flow Sentinel non eseguibile: ${res.error.message}`);
      }
      let esito = null;
      try {
        esito = JSON.parse(res.stdout.slice(res.stdout.indexOf("{")));
      } catch {
        return record(this.id, this.nome, "skipped",
          "il gate di Flow Sentinel non ha prodotto JSON leggibile: non si sa se la rete e' tesa");
      }
      const riassunto = esito.summary ?? {};
      return record(this.id, this.nome, esito.ok ? "pass" : "fail",
        `gate flussi: ${esito.ok ? "VERDE" : "ROSSO"} (${riassunto.fail ?? "?"} falliti, ${riassunto.skipped ?? "?"} mancanti su ${riassunto.passi ?? "?"} passi)`);
    },
  },

  {
    id: ID.build,
    nome: "build di produzione (non dev server)",
    async esegui(ctx, args) {
      // Qui il rimando si segue: la domanda del passo e' «cosa sta servendo
      // questo indirizzo», e la risposta la da' il documento che arriva. E'
      // sulle PAGINE dichiarate che seguire un rimando falsifica la misura.
      const risposta = await preleva(args.url, { segui: true });
      if (!risposta) {
        return record(this.id, this.nome, "skipped",
          `nessuna risposta da ${args.url}: avvia la build con \`npm run build && npm run start\` prima del gate`);
      }
      if (risposta.stato >= 500) {
        return record(this.id, this.nome, "fail", `${args.url} risponde ${risposta.stato}`);
      }
      const indizi = indiziDevServer(risposta.corpo);
      if (indizi.length > 0) {
        return record(this.id, this.nome, "fail",
          `${args.url} (HTTP ${risposta.stato}) e' una DEV SERVER, non una build di produzione\n` +
          indizi.map((i) => `  indizio: ${i.nome} — ${i.perche}`).join("\n") +
          "\nI numeri di `next dev` non sono numeri: niente minificazione, compilazione a richiesta, cache fredda diversa a ogni giro.");
      }
      // E' l'app di QUESTO progetto, o solo un'app? Vedi `eLaMiaBuild`.
      const buildId = leggiSeCe(join(".next", "BUILD_ID"))?.trim();
      if (!buildId) {
        return record(this.id, this.nome, "skipped",
          `${args.url} (HTTP ${risposta.stato}) non e' una dev server, ma non si e' potuto verificare che sia l'app di QUESTO progetto: manca \`.next/BUILD_ID\`.\n` +
          "Costruisci con `npm run build` dalla radice del progetto prima del gate. Il 2026-07-30, su questa macchina, la porta che un contratto firmato dichiarava serviva il sito di un'altra azienda.");
      }
      if (!eLaMiaBuild(risposta.corpo, buildId)) {
        return record(this.id, this.nome, "fail",
          `${args.url} (HTTP ${risposta.stato}) risponde, ma NON e' l'app di questo progetto.\n` +
          `  build id di ${PROGETTO}: ${buildId}\n` +
          "  non compare da nessuna parte nell'HTML servito da quell'indirizzo.\n" +
          "Sta rispondendo un'altra applicazione sulla stessa porta. Misurarla darebbe numeri plausibili di un sito che non e' questo.");
      }
      ctx.baseUrl = args.url;
      // Il build id si stampa SEMPRE, anche sul verde: un gate che ha guardato
      // un'altra app non deve poter assomigliare a un gate che ha guardato la
      // tua (DECISIONI.md §11, precedente di Flow Sentinel su `app-viva`).
      return record(this.id, this.nome, "pass",
        `${args.url} (HTTP ${risposta.stato}) · build id ${buildId} · nessuno degli indizi di dev server nell'HTML servito`);
    },
  },

  {
    id: ID.misura,
    nome: "misura Lighthouse (mediana di N giri)",
    async esegui(ctx, args) {
      const motivo = motivoNessunaMisura({
        contratto: ctx.contratto,
        baseUrl: ctx.baseUrl,
        strumento: dove("lighthouse") || dove("npx"),
      });
      if (motivo) return record(this.id, this.nome, "skipped", motivo);

      ctx.misure = new Map();
      // La soglia di dispersione la dichiara il CONTRATTO; il numero cablato e'
      // solo il ripiego quando non l'ha dichiarata (misurazione.md §78).
      const sogliaDispersione = ctx.contratto.dispersioneMassima ?? DISPERSIONE_MASSIMA;
      const righe = [];
      const dirotate = [];
      let nonMisurate = 0;
      for (const pagina of ctx.contratto.pagine) {
        const { giri, dirottamento } = giriDiUnaPagina(
          unisci(ctx.baseUrl, pagina.percorso), ctx.contratto.formFactor, args.giri);
        const esito = esitoPagina({ pagina, giri, dirottamento, giriRichiesti: args.giri, sogliaDispersione });
        if (esito.misura) ctx.misure.set(pagina.id, esito.misura);
        else nonMisurate++;
        if (esito.riga) righe.push(esito.riga);
        if (esito.scartata) dirotate.push(esito.scartata);
      }
      return record(this.id, this.nome, statoMisura(ctx.misure.size, nonMisurate),
        dettaglioMisura({
          sogliaDispersione,
          dichiarataNelContratto: Boolean(ctx.contratto.dispersioneMassima),
          righe,
          dirotate,
          misurate: ctx.misure.size,
        }));
    },
  },

  {
    id: ID.budget,
    nome: "soglie dichiarate",
    async esegui(ctx) {
      if (!ctx.contratto || !ctx.misure) {
        return record(this.id, this.nome, "skipped", "senza misura non ci sono soglie da confrontare");
      }
      // Senza nemmeno una soglia letta questo passo non ha niente da fare, e
      // dirlo e' obbligatorio: prima chiudeva `pass` con «ogni pagina
      // dichiarata rispetta la sua soglia» dopo averne lette ZERO. Misurato il
      // 2026-07-30 su un contratto scritto seguendo il template, che il gate
      // non sapeva leggere: quattro `block` sul passo del contratto e, due
      // righe sotto, un verde che diceva il contrario.
      const soglieLette = ctx.contratto.pagine.reduce((n, p) => n + Object.keys(p.soglie).length, 0);
      if (soglieLette === 0) {
        return record(this.id, this.nome, "skipped",
          "nessuna soglia letta dal contratto: non c'e' niente da confrontare, e un verde qui direbbe il contrario di cio' che e' successo");
      }
      const findings = findingsBudget(ctx.contratto.pagine, ctx.misure, ctx.contratto.deroghe);
      const g = contaGravita(findings);
      return record(this.id, this.nome, statoDaFindings(findings),
        findings.length === 0
          ? `${soglieLette} soglie confrontate: ogni pagina dichiarata rispetta la sua`
          : `${g.block} bloccanti, ${g.warn} derogate\n${dettaglioFindings(findings)}`);
    },
  },

  {
    id: ID.seo,
    nome: "metatag nell'HTML servito",
    async esegui(ctx) {
      if (!ctx.contratto || !ctx.baseUrl) {
        return record(this.id, this.nome, "skipped", "senza contratto o senza app non c'e' HTML da leggere");
      }
      const perPagina = new Map();
      const redirezioni = new Map();
      const nonLette = [];
      for (const pagina of ctx.contratto.pagine) {
        // `segui: false`, che e' il default: seguire un 307 verso `/accedi`
        // significherebbe leggere i metatag della pagina di accesso credendo
        // di leggere quelli di `/admin` (seo.md §296).
        const risposta = await preleva(unisci(ctx.baseUrl, pagina.percorso));
        if (risposta && risposta.rimandoA) redirezioni.set(pagina.id, risposta.rimandoA);
        else if (risposta && risposta.stato < 400) perPagina.set(pagina.id, metatagDaHtml(risposta.corpo, risposta.intestazioni));
        else nonLette.push(`${pagina.id} (${pagina.percorso})${risposta ? ` HTTP ${risposta.stato}` : " nessuna risposta"}`);
      }

      // Una pagina che non si e' riusciti a leggere NON e' una pagina senza
      // metatag: e' una verifica che non e' stata fatta. Chiamarla `block`
      // manderebbe qualcuno a cercare un tag che c'e'. MANCANTE tiene comunque
      // il gate rosso — non e' un modo per far passare qualcosa.
      if (nonLette.length > 0) {
        return record(this.id, this.nome, "skipped",
          `HTML non letto per: ${nonLette.join(" · ")}\nnon si sa se i metatag ci sono: la verifica non e' stata fatta, non e' fallita`);
      }

      const findings = findingsSeo(ctx.contratto.pagine, perPagina, redirezioni);
      return record(this.id, this.nome, statoDaFindings(findings),
        findings.length === 0
          ? `title unico, description e canonical proprio su ${perPagina.size} pagine · nessun noindex nel corpo ne' nelle intestazioni`
          : dettaglioFindings(findings));
    },
  },

  {
    id: ID.uscita,
    nome: "contratto d'uscita (handoff)",
    async esegui() {
      const percorso = trovaHandoff();
      const testo = percorso ? leggiSeCe(percorso) : null;
      const findings = contrattoUscita(
        percorso ?? `${HANDOFF_GLOB}/<n>-speed-demon.md`,
        testo,
        verdettoDa(steps),
      );
      return record(this.id, this.nome, statoDaFindings(findings),
        findings.length === 0 ? `${percorso}` : dettaglioFindings(findings));
    },
  },
];

/**
 * L'handoff porta un numero che dipende da quanti agenti sono passati prima:
 * si cerca per suffisso, non per nome esatto. Un gate che pretendesse
 * `12-speed-demon.md` sarebbe rosso su ogni progetto con un agente in piu'.
 */
function trovaHandoff() {
  const dir = join(PROGETTO, HANDOFF_GLOB);
  if (!existsSync(dir)) return null;
  const trovato = readdirSync(dir).filter((n) => /-speed-demon\.md$/.test(n)).sort().pop();
  return trovato ? `${HANDOFF_GLOB}/${trovato}` : null;
}

/**
 * Un giro di Lighthouse. Ritorna i punteggi 0-100 per categoria, o `null` se il
 * giro non e' riuscito: un giro fallito NON vale zero — zero e' una misura, il
 * fallimento e' l'assenza di misura, e confonderli abbassa la mediana di una
 * pagina che magari e' velocissima.
 */
function giroLighthouse(url, formFactor) {
  const args = [
    "--yes",
    "lighthouse",
    url,
    "--output=json",
    "--output-path=stdout",
    "--quiet",
    // UN solo flag, senza spazi: `--chrome-flags` con piu' opzioni separate da
    // spazio non sopravvive a `cmd /c` (vedi `argomentiOstiliACmd`). Se un
    // progetto avesse bisogno di `--no-sandbox`, la strada e' `CHROME_PATH` piu'
    // un lanciatore, non un argomento piu' lungo.
    "--chrome-flags=--headless=new",
    `--only-categories=${CATEGORIE.join(",")}`,
  ];
  if (formFactor === "desktop") args.push("--preset=desktop");
  const res = esegui("npx", args);
  if (res.error || !res.stdout) return null;
  const inizio = res.stdout.indexOf("{");
  if (inizio < 0) return null;
  try {
    const report = JSON.parse(res.stdout.slice(inizio));
    const punteggi = {};
    for (const categoria of CATEGORIE) {
      const score = report.categories?.[categoria]?.score;
      punteggi[categoria] = typeof score === "number" ? Math.round(score * 100) : null;
    }
    // `references/misurazione.md` §256 prescriveva gia' questo confronto: «in
    // ogni JSON si confrontano `requestedUrl` e `finalDisplayedUrl`; se
    // differiscono, la misura riguarda un'altra pagina». Il gate leggeva solo
    // `categories` e buttava via le due righe che glielo dicevano. Misurato il
    // 2026-07-30 sul banco `banco-prova-immobiliare`:
    //   requestedUrl      http://127.0.0.1:3200/riservata
    //   finalDisplayedUrl http://127.0.0.1:3200/contatti
    //   performance 100 · seo 100      → scritti accanto a `riservata`
    return {
      punteggi,
      urlRichiesto: report.requestedUrl ?? null,
      urlFinale: report.finalDisplayedUrl ?? report.mainDocumentUrl ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * I giri di UNA pagina: `{ giri, dirottamento }`. Impura — e' l'unica parte del
 * passo `misura` che tocca il mondo, e per questo resta qui invece che in
 * `gate-lib.mjs`.
 *
 * Si ferma al PRIMO dirottamento: gli altri giri misurerebbero comunque una
 * pagina che nessuno ha dichiarato, e li si butterebbe uguale.
 */
function giriDiUnaPagina(url, formFactor, quanti) {
  const giri = [];
  for (let i = 0; i < quanti; i++) {
    const esito = giroLighthouse(url, formFactor);
    if (!esito) continue;
    if (!stessaPagina(esito.urlRichiesto, esito.urlFinale)) return { giri, dirottamento: esito.urlFinale };
    giri.push(esito.punteggi);
  }
  return { giri, dirottamento: null };
}

/** Due URL sono la stessa pagina se differiscono solo per la barra finale. */
const stessaPagina = (a, b) => {
  if (!a || !b) return true;
  const pulisci = (u) => u.replace(/\/+$/, "");
  return pulisci(a) === pulisci(b);
};

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE PERFORMANCE: ${verde ? "VERDE" : "ROSSO"} ` +
    `(${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti su ${riassunto.passi} passi)\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status];
    console.log(`${marchio}  ${s.name}`);
    // il dettaglio si stampa anche sui passi verdi: e' li' che finisce la
    // dispersione della misura, e un'instabilita' nascosta non esiste
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) {
    console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  }
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, giri: GIRI_DEFAULT, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--giri") args.giri = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(PROGETTO, "docs"))) {
    console.error(`Nessuna cartella docs/ in ${PROGETTO}: lancia il gate dalla radice del progetto.`);
    process.exit(2);
  }
  // Precedenza promessa dal template e finalmente rispettata: flag esplicito >
  // riga `URL misurato:` del contratto > niente. L'ambiente non entra mai, e
  // nessun indirizzo e' cablato qui dentro: quello che si legge l'ha scritto e
  // firmato un umano in `docs/performance.md`.
  if (!args.url) {
    const testo = leggiSeCe(CONTRATTO);
    const dichiarato = testo ? leggiContratto(testo).urlDichiarato : null;
    if (dichiarato) {
      args.url = dichiarato;
      console.error(`--url assente: uso l'indirizzo dichiarato in ${CONTRATTO} → ${dichiarato}`);
    }
  }
  if (!args.url) {
    console.error(
      "Manca --url, e il contratto non dichiara nessuna riga `URL misurato:`. Il gate NON indovina un `localhost:3000`: e' cosi' che si misura l'app di un altro progetto e si stampa `pass`.\n" +
      "Avvia la build con `npm run build && npm run start -- -p <porta>` e passa quell'indirizzo, oppure scrivilo nel contratto.",
    );
    process.exit(2);
  }
  if (!Number.isInteger(args.giri) || args.giri < 3) {
    console.error("--giri deve essere un intero >= 3: sotto i tre giri non esiste una mediana, e un numero solo non e' una misura (Legge n°3).");
    process.exit(2);
  }
  const ctx = { contratto: null, baseUrl: null, misure: null };
  for (const passo of PASSI) await passo.esegui(ctx, args);
  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano ID/PASSI/riepilogo.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde. Questo gate lo ha
// fatto per davvero: misurato il 2026-08-03 su questa macchina (Node 20.12.2,
// l'unico Node di sistema) in una cartella non-progetto — uscita 0, zero righe,
// dove Node 24.18.1 stampava il messaggio e usciva 2. I prerequisiti della
// skill dicono «Node >= 20»: il confronto qui sotto li rispetta ovunque.
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e il gate usciva 0 muto (misurato il 2026-08-04,
// P.4-pre, PILOTA-PRE-2026-08-04.md §2b). `realpathSync` scioglie la junction;
// se solleva si ricade sul confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}
