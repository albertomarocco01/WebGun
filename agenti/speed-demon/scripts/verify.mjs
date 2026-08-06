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
  CATEGORIE,
  contaGravita,
  contrattoUscita,
  dettaglioContrasto,
  esitoContrasto,
  findingsContrasto,
  letturaContrasto,
  statoContrasto,
  dettaglioFindings,
  dettaglioMisura,
  DISPERSIONE_MASSIMA,
  eLaMiaBuild,
  esitoPagina,
  stessaOrigine,
  findingsBudget,
  findingsContratto,
  findingsSeo,
  indiziDevServer,
  leggiContratto,
  metatagDaHtml,
  motivoNessunaMisura,
  motivoScaduto,
  scaduto,
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
// Lighthouse VIVE NELLA SKILL, a una versione fissata dal package-lock.
// Fino al 2026-08-06 il passo `misura` lanciava `npx --yes lighthouse`: scarica
// ed esegue un pacchetto non fissato, a ogni giro, dalla radice del progetto
// misurato (che ha la precedenza col suo `node_modules/.bin`). Tre cose in una
// riga — una dipendenza che cambia sotto i piedi, una rete necessaria per
// misurare, e un binario scelto dall'imputato (referto § H12 e § C1).
const LIGHTHOUSE_BIN = join(SKILL_DIR, "node_modules", "lighthouse", "cli", "index.js");

/**
 * I LIMITI DI TEMPO, in un posto solo e con il perche' accanto.
 *
 * Misurato il 2026-08-06 (referto § H10/H11/M15): questo gate, contro un server
 * che accetta la connessione e non risponde mai, e' rimasto appeso finche' non
 * l'hanno ucciso — 120 secondi nella prova, ZERO righe stampate, uscita 124.
 * Flow Sentinel sullo stesso server tornava in 18,2 s con un ROSSO leggibile, e
 * la differenza era un solo `AbortSignal.timeout`.
 *
 * Un gate senza limite non e' lento: e' MUTO, e un gate muto non e' ne' verde
 * ne' rosso — e' assente, che e' il peggiore dei tre stati. Quando un limite
 * scatta si stampa QUALE comando, QUANTO ha aspettato, e il passo vale MANCANTE.
 */
export const LIMITI = Object.freeze({
  // Una GET su una pagina: se non risponde in 20 s non e' lenta, e' ferma.
  pagina: 20_000,
  // Un giro di Lighthouse su una pagina pesante puo' durare: il limite e' largo
  // apposta, e serve solo a impedire l'attesa infinita.
  lighthouse: 180_000,
  // Il gate dei flussi annidato ha i PROPRI limiti su ogni passo; questo e' il
  // tetto complessivo, e non deve tagliare una batteria vera.
  gateFlussi: 1_800_000,
});

export const ID = Object.freeze({
  contratto: "contratto-performance",
  rete: "rete-verde",
  build: "build-produzione",
  misura: "misura",
  budget: "budget",
  contrasto: "contrasto",
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

// I limiti scattati durante il passo `misura`: si raccolgono qui perche' i giri
// di Lighthouse sono N per pagina, e il dettaglio deve dire QUALE si e' fermato.
const scadenze = [];

// ------------------------------- questo gate non lancia piu' nessun nome
// Con Lighthouse dentro la skill (§ H12) e il gate dei flussi lanciato con
// `process.execPath` (§ C1), qui non resta un solo binario cercato per nome: si
// eseguono due percorsi pieni, e basta. La macchina che serviva a difendersi —
// ricerca col prefisso `$PATH:`, rifiuto dei candidati dentro il progetto,
// filtro degli argomenti ostili a `cmd /c` — resta in `gate-lib.mjs` con i suoi
// test, perche' e' il vocabolario della casa e perche' la lezione non va persa:
// ma qui la classe di guasto non esiste piu' per costruzione, non per cura.
// E' la stessa conclusione che launchpad ha scritto per il proprio gate il
// 2026-08-06 (commit 5636373), e vale la pena che sia scritta anche qui.

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
      // IL LIMITE. Senza, questo `fetch` e' il punto in cui il gate spariva:
      // contro un server che accetta e non risponde restava appeso per sempre,
      // zero righe stampate (referto § H11, misurato il 2026-08-06 — 120 s e
      // poi ucciso). Il retry a due tentativi non protegge da questo: protegge
      // dal `fetch` che SOLLEVA, non da quello che non torna.
      const risposta = await fetch(url, {
        redirect: segui ? "follow" : "manual",
        signal: AbortSignal.timeout(LIMITI.pagina),
      });
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
      // `process.execPath`, non `esegui("node", …)`: l'interprete che sta
      // girando, non quello che un `node.cmd` nella radice del progetto
      // misurato vorrebbe far eseguire. Il gate figlio decide da solo il passo
      // `rete-verde`, ed e' l'unica premessa che questo gate non rimisura
      // (referto § C1).
      // Il tetto complessivo sul gate annidato (referto § M15): il figlio ha i
      // propri limiti su ogni passo, ma senza questo un suo passo senza limite
      // faceva due processi `node` fermi e nessuna riga — doppio silenzio.
      const res = spawnSync(process.execPath,
        [GATE_FLUSSI, "--json", ...(args.url ? ["--url", args.url] : [])],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: LIMITI.gateFlussi, killSignal: "SIGKILL" });
      if (scaduto(res)) {
        return record(this.id, this.nome, "skipped", motivoScaduto("il gate di Flow Sentinel", LIMITI.gateFlussi));
      }
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
        strumento: existsSync(LIGHTHOUSE_BIN) ? LIGHTHOUSE_BIN : null,
      });
      if (motivo) return record(this.id, this.nome, "skipped", motivo);

      ctx.misure = new Map();
      ctx.contrasti = new Map();
      // La soglia di dispersione la dichiara il CONTRATTO; il numero cablato e'
      // solo il ripiego quando non l'ha dichiarata (misurazione.md §78).
      const sogliaDispersione = ctx.contratto.dispersioneMassima ?? DISPERSIONE_MASSIMA;
      const righe = [];
      const dirotate = [];
      let nonMisurate = 0;
      for (const pagina of ctx.contratto.pagine) {
        const indirizzo = unisci(ctx.baseUrl, pagina.percorso);
        // SECONDA PORTA, indipendente dalla regola del contratto (referto § H4):
        // un percorso che sfuggisse a `erroreDiPercorso` non deve comunque poter
        // portare Lighthouse su un altro sito. `new URL(percorso, base)` butta
        // via la base davanti a un URL assoluto, e i punteggi finirebbero nel
        // verbale accanto al nome della pagina del cliente.
        if (!stessaOrigine(ctx.baseUrl, indirizzo)) {
          nonMisurate++;
          dirotate.push(`${pagina.id}: \`${pagina.percorso}\` porta a ${indirizzo}, che non e' ${new URL(ctx.baseUrl).origin}. NON misurato: il gate misura questo sito, non un altro`);
          continue;
        }
        const { giri, contrasti, dirottamento } = giriDiUnaPagina(
          indirizzo, ctx.contratto.formFactor, args.giri);
        const esito = esitoPagina({ pagina, giri, dirottamento, giriRichiesti: args.giri, sogliaDispersione });
        // Il contrasto si registra anche quando la misura non c'e': sono due
        // domande diverse, e una pagina dirottata non ha ne' l'una ne' l'altra.
        if (!dirottamento && contrasti.length > 0) ctx.contrasti.set(pagina.id, esitoContrasto(contrasti));
        if (esito.misura) ctx.misure.set(pagina.id, esito.misura);
        else nonMisurate++;
        if (esito.riga) righe.push(esito.riga);
        if (esito.scartata) dirotate.push(esito.scartata);
      }
      // I limiti scattati si stampano nel dettaglio: un giro ucciso dal tempo
      // NON e' un giro andato male, e chi legge deve poterlo distinguere.
      const dettaglio = dettaglioMisura({
        sogliaDispersione,
        dichiarataNelContratto: Boolean(ctx.contratto.dispersioneMassima),
        righe,
        dirotate,
        misurate: ctx.misure.size,
      });
      return record(this.id, this.nome, statoMisura(ctx.misure.size, nonMisurate),
        scadenze.length === 0 ? dettaglio : `${dettaglio}\n${scadenze.map((s) => `  - ${s}`).join("\n")}`);
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
    id: ID.contrasto,
    nome: "contrasto del testo (audit color-contrast)",
    async esegui(ctx) {
      // CANTIERE.md § D21: delle nove voci che site-doctor delega, `contrasti`
      // e' di questo agente perche' e' l'unico gate della casa che apre un
      // browser. Fino al 2026-08-06 la parola `contrast` non compariva in
      // nessun file di questa skill: la delega esisteva e non la onorava
      // nessuno.
      //
      // NON e' il punteggio della categoria `accessibility`: quello pesa
      // `color-contrast` insieme ad altri venti audit, e un sito con contrasto
      // insufficiente perde qualche punto su cento e supera qualunque soglia.
      if (!ctx.contrasti || ctx.contrasti.size === 0) {
        return record(this.id, this.nome, "skipped",
          "nessuna pagina misurata: senza un giro di Lighthouse non esiste l'audit `color-contrast`, e un verde qui direbbe che il contrasto e' stato guardato");
      }
      const findings = findingsContrasto(ctx.contratto.pagine, ctx.contrasti);
      const passo = record(this.id, this.nome, statoContrasto(findings),
        dettaglioContrasto(ctx.contratto.pagine, ctx.contrasti, findings));
      passo.counts = contaGravita(findings);
      return passo;
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
  // Il numero si confronta come NUMERO (referto § L15). Il `sort()` lessicografico
  // ordina giusto finche' la convenzione del CLAUDE.md e' rispettata
  // (`<numero>-<nome>.md` a due cifre) e sbaglia al primo `9-speed-demon.md`:
  // `["9-…","13-…"].sort().pop()` da' il 9. Latente, non aperto — e chiuderlo
  // costa una riga. A parita' di numero vince l'ordine alfabetico, che e'
  // stabile.
  const candidati = readdirSync(dir).filter((n) => /-speed-demon\.md$/.test(n));
  const numero = (nome) => Number(/^(\d+)/.exec(nome)?.[1] ?? -1);
  const trovato = candidati.sort((a, b) => numero(a) - numero(b) || a.localeCompare(b)).pop();
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
    LIGHTHOUSE_BIN,
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
  // `process.execPath` e il Lighthouse della SKILL: niente `npx --yes`, che
  // scaricava un pacchetto non fissato a ogni giro e lo cercava prima nel
  // `node_modules/.bin` del progetto misurato (referto § H12).
  const res = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: LIMITI.lighthouse,
    killSignal: "SIGKILL",
  });
  if (scaduto(res)) {
    scadenze.push(motivoScaduto(`lighthouse ${url}`, LIMITI.lighthouse));
    return null;
  }
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
      // L'AUDIT, non la categoria (CANTIERE.md § D21). Il punteggio di
      // `accessibility` pesa `color-contrast` insieme ad altri venti: un sito
      // con contrasto insufficiente perde qualche punto su cento e supera
      // qualunque soglia ragionevole. Qui si legge il verdetto dell'audit.
      contrasto: letturaContrasto(report.audits?.["color-contrast"]),
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
  const contrasti = [];
  for (let i = 0; i < quanti; i++) {
    const esito = giroLighthouse(url, formFactor);
    if (!esito) continue;
    if (!stessaPagina(esito.urlRichiesto, esito.urlFinale)) return { giri, contrasti, dirottamento: esito.urlFinale };
    giri.push(esito.punteggi);
    contrasti.push(esito.contrasto);
  }
  return { giri, contrasti, dirottamento: null };
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
  const ctx = { contratto: null, baseUrl: null, misure: null, contrasti: null };
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
