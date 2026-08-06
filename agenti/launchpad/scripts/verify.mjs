#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Launchpad: il permesso di pubblicare.
 *
 * COSA FA: misura le premesse (siamo su un commit? la catena e' chiusa? cosa
 * dichiara il registro del debito?) PRIMA di leggere gli esiti. Ogni passo
 * finisce in uno di tre stati:
 *   pass | fail | skipped  →  `skipped` NON e' un successo, e' una verifica
 *   mancante, e il gate resta rosso.
 *
 * USO:  node verify.mjs [--url <url-della-build-servita>] [--storia N] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 * DIPENDENZE: `git` (assente = MANCANTE, mai PASS). Nessun'altra: questo gate
 *             gira a deploy spento, senza account, senza dominio e senza spesa.
 *
 * QUELLO CHE QUESTO GATE NON FA, ed e' deliberato: non pubblica, non crea
 * account, non tocca DNS, non spende. Arriva fino al passo prima
 * (`DECISIONI.md` §6), e l'ultimo passo lo firma una persona.
 *
 * Le regole vivono in `gate-lib.mjs` e `segreti-lib.mjs` e hanno i loro test:
 * qui c'e' solo il guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTRATTI,
  contaGravita,
  contrattoUscita,
  dettaglioFindings,
  findingsAmbiente,
  findingsCatena,
  findingsDebito,
  findingsImpronta,
  findingsRadice,
  findingsRunbook,
  findingsRuntime,
  improntaAttesa,
  leggiDebito,
  leggiRunbook,
  minimoNode,
  numeriCitati,
  riepilogo,
  statoDaFindings,
  VARIABILI_IMPRONTA,
  variabiliLette,
  verdettoDa,
} from "./gate-lib.mjs";
import { decodifica, esitoSegreti } from "./segreti-lib.mjs";
import { FUORI_DAL_PACCHETTO, git as gitIn, gitRighe as gitRigheIn, leggiStoria as leggiStoriaIn, trovaGit } from "./git-lib.mjs";

const PROGETTO = process.cwd();
const RUNBOOK = "docs/deploy.md";
const DEBITO = "docs/DEBITO-TECNICO.md";
const HANDOFF_DIR = "docs/handoff";
/** Le radici che finiscono nel pacchetto, quando il runbook non le dichiara. */
const RADICI_PREDEFINITE = ["src", "next.config.ts", "next.config.mjs", "next.config.js"];

export const ID = Object.freeze({
  radice: "radice-pulita",
  catena: "catena-gate",
  debito: "debito-bloccante",
  segreti: "segreti",
  ambiente: "ambiente",
  runtime: "runtime-riproducibile",
  impronta: "impronta-artefatto",
  runbook: "runbook-firmato",
  uscita: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;
export const STORIA_DEFAULT = 200;

const steps = [];
const record = (id, name, status, detail = "", counts = null) => {
  const passo = { id, name, status, detail };
  if (counts) passo.counts = counts;
  steps.push(passo);
  return passo;
};

const conFindings = (id, nome, findings, testa = "") => {
  const g = contaGravita(findings);
  const dettaglio = [testa, findings.length === 0 ? "nessun rilievo" : dettaglioFindings(findings)]
    .filter(Boolean).join("\n");
  return record(id, nome, statoDaFindings(findings), dettaglio, g);
};

/**
 * Legge un file, e distingue «non c'e'» da «non si e' potuto leggere».
 *
 * Rilievo IO-7 del tribunale: il `catch {}` vuoto rendeva un file BLOCCATO
 * (antivirus, IDE, sincronizzazione cloud) indistinguibile da un file assente,
 * e il gate stampava «`docs/DEBITO-TECNICO.md` assente» su un file che
 * esisteva. Un'affermazione falsa sull'esistenza di un documento, non una
 * verifica mancata. Misurato con un lock Windows vero (`EBUSY`).
 */
const illeggibili = [];
const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  try {
    if (!existsSync(pieno) || !statSync(pieno).isFile()) return null;
    return readFileSync(pieno, "utf8");
  } catch (e) {
    if (e?.code !== "ENOENT") illeggibili.push(`${relativo} (${e?.code ?? "errore"})`);
    return null;
  }
};

// git: risolutore, comandi e lettura della storia stanno in `git-lib.mjs`.
// Due copie divergono, e in questa casa e' gia' successo (DECISIONI.md §7).
const git = (args, opzioni) => gitIn(PROGETTO, args, opzioni);
const gitRighe = (args) => gitRigheIn(PROGETTO, args);
const leggiStoria = (quanti) => leggiStoriaIn(PROGETTO, quanti);

/**
 * Una GET che non esplode e **che finisce**.
 *
 * Rilievo IO-3: senza `signal`, un indirizzo che accetta la connessione e non
 * risponde mai blocca l'intero gate in silenzio totale — misurato, ancora vivo
 * dopo 33 secondi e zero righe stampate, perche' il verdetto si stampa solo
 * alla fine. Chi guarda non sa nemmeno QUALE passo si e' impuntato.
 */
async function preleva(url, { tentativi = 2, attesaMs = 15_000 } = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(attesaMs) });
      return { stato: r.status, corpo: await r.text() };
    } catch {
      if (i === tentativi - 1) return null;
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  return null;
}

/** L'ultima data di commit che tocca il codice: la scadenza di ogni certificato. */
function ultimoCommitCodice() {
  const { ok, out } = git(["log", "-1", "--format=%cI", "--", "src", "supabase", "package.json", "next.config.ts"]);
  return ok ? out.trim() || null : null;
}

/**
 * Fra il commit approvato dal runbook e HEAD e' cambiato solo documentazione?
 *
 * `null` se non si e' potuto stabilire (sha sconosciuto, git muto): il gate
 * non indovina, e la regola pura tratta `null` come «non lo so» → block.
 */
function soloDocumentiDaAllora(approvato, commit) {
  if (!approvato || !commit || !/^[0-9a-f]{7,40}$/i.test(String(approvato).trim())) return null;
  const sha = String(approvato).trim();
  const antenato = git(["merge-base", "--is-ancestor", sha, commit]);
  if (!antenato.ok) return false;
  const diff = git(["diff", "--name-only", `${sha}..${commit}`]);
  if (!diff.ok) return null;
  const cambiati = diff.out.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  return cambiati.every((p) => p.startsWith("docs/"));
}

function handoffTrovati() {
  const dir = join(PROGETTO, HANDOFF_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /\.md$/i.test(n))
    .sort()
    .map((nome) => {
      const percorso = `${HANDOFF_DIR}/${nome}`;
      const { ok, out } = git(["log", "-1", "--format=%cI", "--", percorso]);
      return {
        percorso,
        agente: nome.replace(/^\d+-/, "").replace(/\.md$/i, ""),
        testo: leggiSeCe(percorso) ?? "",
        data: ok && out.trim() ? out.trim() : null,
      };
    });
}

// ----------------------------------------------------------------- i passi
const PASSI = [
  {
    id: ID.radice,
    nome: "si pubblica un commit, non un working tree",
    async esegui(ctx) {
      if (!trovaGit()) {
        return record(this.id, this.nome, "skipped",
          "`git` non e' raggiungibile: senza non si sa cosa il provider riceverebbe. Uno strumento assente vale MANCANTE, mai PASS");
      }
      const dentro = git(["rev-parse", "--is-inside-work-tree"]);
      if (!dentro.ok) {
        return record(this.id, this.nome, "skipped",
          `${PROGETTO} non e' un repository git: un deploy connesso a git non ha niente da cui costruire`);
      }
      // La radice del repository DEVE essere il progetto: `git -C <dir>` risale
      // all'albero che contiene la cartella, e su questa macchina la home
      // dell'utente **e'** un repository. Rilievo VER-10, misurato: il gate
      // stampava «commit HEAD» e accusava il progetto di 97 file sporchi che
      // erano della home.
      const cima = git(["rev-parse", "--show-toplevel"]);
      const cimaReale = cima.ok ? realpathSync(cima.out.trim()) : null;
      if (!cimaReale || cimaReale.toLowerCase() !== realpathSync(PROGETTO).toLowerCase()) {
        return record(this.id, this.nome, "skipped",
          `${PROGETTO} non ha un repository git proprio: la radice piu' vicina e' ${cimaReale ?? "(nessuna)"}.\n` +
          "Il gate misurerebbe i commit e i file di un altro albero, e li stamperebbe come se fossero di questo progetto");
      }
      // `ok` PRIMA di `out`: su un HEAD non nato `git rev-parse HEAD` stampa la
      // stringa `HEAD` su stdout, e la guardia sul valore vuoto non scattava.
      const rispostaHead = git(["rev-parse", "HEAD"]);
      ctx.commit = rispostaHead.ok && /^[0-9a-f]{40}$/i.test(rispostaHead.out.trim())
        ? rispostaHead.out.trim()
        : null;
      if (!ctx.commit) {
        return record(this.id, this.nome, "skipped", "nessun commit su HEAD: non c'e' niente da pubblicare");
      }
      const ramo = git(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
      ctx.ramo = ramo && ramo !== "HEAD" ? ramo : null;
      const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
      ctx.upstream = upstream.ok ? upstream.out.trim() : null;
      // Anche qui `ok` prima di `out`: un fallimento di `rev-list` valeva
      // `avanti = 0` e disarmava in silenzio il `block` sul commit non spinto.
      let avanti = 0;
      if (ctx.upstream) {
        const conteggio = git(["rev-list", "--count", "@{upstream}..HEAD"]);
        if (!conteggio.ok) {
          return record(this.id, this.nome, "skipped",
            `commit ${ctx.commit.slice(0, 12)} · ramo ${ctx.ramo ?? "(distaccato)"} · remoto ${ctx.upstream}\n` +
            "non si e' potuto contare lo scarto col remoto: senza, non si sa se il provider costruirebbe un commit piu' vecchio di questo");
        }
        avanti = Number(conteggio.out.trim() || 0);
      }
      const sporco = (gitRighe(["status", "--porcelain"]) ?? []).map((r) => r.slice(3));
      const findings = findingsRadice({ sporco, ramo: ctx.ramo, upstream: ctx.upstream, avanti });
      // Il commit si stampa SEMPRE, anche sul verde: un gate che ha guardato un
      // altro commit non deve poter assomigliare a un gate che ha guardato il
      // tuo (DECISIONI.md §11).
      const testa = `commit ${ctx.commit.slice(0, 12)} · ramo ${ctx.ramo ?? "(distaccato)"} · remoto ${ctx.upstream ?? "(nessuno)"}${avanti > 0 ? ` · avanti di ${avanti}` : ""}`;
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.catena,
    nome: "verdetti dichiarati dagli agenti a monte",
    async esegui(ctx) {
      const handoff = handoffTrovati();
      if (handoff.length === 0) {
        return record(this.id, this.nome, "skipped",
          `nessun handoff in ${HANDOFF_DIR}/: non si sa chi ha lavorato ne' cosa ha dichiarato. Pubblicare prima che la catena sia chiusa significa pubblicare un lavoro che nessuno ha dichiarato finito`);
      }
      ctx.handoff = handoff;
      ctx.ultimoCodice = ultimoCommitCodice();
      const proveTrovate = CONTRATTI
        .filter(({ prova }) => {
          const pieno = join(PROGETTO, prova);
          if (!existsSync(pieno)) return false;
          try {
            return statSync(pieno).isDirectory() ? readdirSync(pieno).length > 0 : true;
          } catch { return false; }
        })
        .map(({ prova }) => prova);
      const findings = findingsCatena({ handoff, proveTrovate, ultimoCommitCodice: ctx.ultimoCodice });
      const testa = [
        `${handoff.length} handoff letti: ${handoff.map((h) => h.agente).join(" · ")}`,
        `contratti trovati sul disco (prova che l'agente doveva passare): ${proveTrovate.join(" · ") || "nessuno"}`,
        `ultimo commit che tocca il codice: ${ctx.ultimoCodice?.slice(0, 10) ?? "(sconosciuto)"}`,
        "questo passo LEGGE una dichiarazione e ne misura la freschezza: non rilancia i gate a monte (references/verifica-deterministica.md §6)",
      ].join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.debito,
    nome: "bloccanti dichiarati nel registro del debito",
    async esegui(ctx) {
      const testo = leggiSeCe(DEBITO);
      if (testo === null) {
        return record(this.id, this.nome, "skipped",
          `${DEBITO} assente: e' l'unico posto in cui gli agenti a monte scrivono, numerato, cosa impedisce di pubblicare. Senza, non si sa cosa blocca`);
      }
      const voci = leggiDebito(testo);
      if (voci.length === 0) {
        return record(this.id, this.nome, "skipped",
          `${DEBITO} non contiene nessuna riga di tabella leggibile (\`| n | agente | … |\`): il registro c'e' ma non e' stato letto, e uno strumento che non ha letto il suo input non produce un pass (DECISIONI.md §18)`);
      }
      const citati = numeriCitati((ctx.handoff ?? []).map((h) => h.testo));
      const findings = findingsDebito({
        voci,
        citati,
        risposte: ctx.runbook?.risposte ?? new Map(),
        runbookEsiste: ctx.runbook !== null,
      });
      const bloccanti = voci.filter((v) => v.bloccaDeploy && !v.chiusa);
      const testa = [
        `${voci.length} voci lette · ${bloccanti.length} dichiarano di bloccare il deploy: ${bloccanti.map((v) => `n°${v.numero}`).join(" · ") || "nessuna"}`,
        `${voci.filter((v) => v.chiusa).length} voci gia' chiuse a monte · ${citati.size} numeri citati dagli handoff`,
        "questo passo LEGGE: l'elenco l'hanno scritto altri. `segreti` e `runtime-riproducibile` rimisurano da soli due di queste voci",
      ].join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.segreti,
    nome: "nessun segreto nel pacchetto che parte",
    async esegui(ctx, args) {
      const tracciati = gitRighe(["ls-files"]);
      if (tracciati === null || tracciati.length === 0) {
        return record(this.id, this.nome, "skipped",
          "`git ls-files` non elenca niente: zero file letti non e' «nessun segreto», e' una verifica non fatta (DECISIONI.md §18)");
      }
      const letti = [];
      const binari = [];
      const nonLetti = [];
      // Un elenco, una funzione: la lettura dichiara sempre PERCHE' non ha
      // letto (rilievi SEG-4 e IO-5). Prima un file oltre la soglia cadeva nel
      // vuoto — ne' fra i letti ne' fra i binari — e i binari ignorati
      // sparivano del tutto, perche' il loro array era un `[]` creato sul
      // posto e mai guardato.
      const leggiElenco = (elenco, dentro, { maxByte = Infinity, salta = false } = {}) => {
        for (const percorso of elenco ?? []) {
          if (salta && FUORI_DAL_PACCHETTO.test(percorso)) continue;
          try {
            const buf = readFileSync(join(PROGETTO, percorso));
            if (buf.length > maxByte) {
              nonLetti.push({ percorso, motivo: `${Math.round(buf.length / 1024)} KB, oltre la soglia di ${Math.round(maxByte / 1024)} KB` });
              continue;
            }
            const { testo, codifica } = decodifica(buf);
            if (testo === null) binari.push(percorso);
            else dentro.push({ percorso, testo, codifica });
          } catch (e) {
            if (e?.code !== "ENOENT") nonLetti.push({ percorso, motivo: e?.code ?? "errore di lettura" });
          }
        }
      };
      leggiElenco(tracciati, letti);
      // I file NUOVI e non ignorati: `git ls-files` non li elenca e il gesto
      // successivo di chiunque e' `git add -A`. Vedi la nota in `esitoSegreti`.
      const daTracciare = [];
      leggiElenco(gitRighe(["ls-files", "--others", "--exclude-standard"]), daTracciare, { salta: true });
      const ignorati = [];
      leggiElenco(gitRighe(["ls-files", "--others", "--ignored", "--exclude-standard"]), ignorati, { salta: true, maxByte: 512 * 1024 });
      // `--storia 0` non e' un pass: e' la storia non guardata (rilievo VER-2).
      // Misurato: con una chiave Stripe committata e tolta, `--storia 200`
      // usciva rosso e `--storia 0` usciva `ok=true`. Il passo lo DICHIARAVA in
      // prosa dentro un `pass`, che e' esattamente la forma che la §18 vieta.
      if (args.storia === 0) {
        return record(this.id, this.nome, "skipped",
          `${letti.length} file tracciati letti, ma \`--storia 0\`: la storia git non e' stata guardata.\n` +
          "Un segreto tolto da HEAD e' ancora consegnato a chi ha clonato, e un deploy connesso a git da' al provider la STORIA");
      }
      const storia = leggiStoria(args.storia);
      const percorsi = [...tracciati, ...(gitRighe(["ls-files", "--others", "--exclude-standard"]) ?? []).filter((p) => !FUORI_DAL_PACCHETTO.test(p))];
      const { findings, riassunto } = esitoSegreti({ letti, daTracciare, ignorati, storia, binari, percorsi, nonLetti });
      ctx.segretiRiassunto = riassunto;
      const testa = [
        `${riassunto.letti} file tracciati letti · ${riassunto.daTracciare} nuovi non ancora tracciati · ${riassunto.binari} binari · ${riassunto.ignorati} ignorati guardati · ${riassunto.nonLetti} NON letti`,
        `regole sul nome applicate a ${percorsi.length} percorsi, prima e indipendentemente dalla lettura` +
          (letti.some((f) => f.codifica !== "utf-8") ? ` · codifiche diverse da utf-8: ${[...new Set(letti.filter((f) => f.codifica !== "utf-8").map((f) => f.codifica))].join(" · ")}` : ""),
        `storia: ${storia.length} pezzi (file x commit) letti dagli ultimi ${args.storia} commit — un segreto tolto da HEAD e' ancora consegnato a chi ha clonato`,
        `${riassunto.famiglie} famiglie di segreto cercate · quello che si trova NON si stampa: solo famiglia, file, riga e i primi quattro caratteri`,
      ].join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.ambiente,
    nome: "variabili d'ambiente dichiarate e non committate",
    async esegui(ctx) {
      if (!ctx.runbook) {
        return record(this.id, this.nome, "skipped",
          `${RUNBOOK} assente: senza il runbook non si sa quali radici finiscono nel pacchetto, e contare le variabili di un file di test come variabili di produzione produce un rosso sull'imputato sbagliato`);
      }
      const radici = ctx.runbook.radiciSpedite.length > 0 ? ctx.runbook.radiciSpedite : RADICI_PREDEFINITE;
      // Tracciati E nuovi: un sorgente appena scritto legge le sue variabili
      // esattamente come uno vecchio, e aspettare che sia committato per
      // accorgersene significa accorgersene un commit troppo tardi.
      const tracciati = [
        ...(gitRighe(["ls-files"]) ?? []),
        ...(gitRighe(["ls-files", "--others", "--exclude-standard"]) ?? []).filter((p) => !FUORI_DAL_PACCHETTO.test(p)),
      ];
      const spediti = tracciati.filter((p) =>
        /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(p) &&
        radici.some((r) => p === r.replace(/\/$/, "") || p.startsWith(r.replace(/\/$/, "") + "/")));
      // La radice sorgente vera del progetto DEVE essere fra quelle dichiarate
      // (rilievo VER-6): restringendo `Radici spedite:` a `next.config.ts` il
      // passo confrontava ZERO coppie e usciva `pass` — misurato, con due
      // variabili di produzione non dichiarate, una chiamata
      // `SEGRETO_WEBHOOK_URL`. Il runbook lo scrive chi vuole pubblicare.
      const radiceVera = ["src", "app", "pages"].find((r) => existsSync(join(PROGETTO, r)));
      if (radiceVera && !radici.some((r) => r.replace(/\/$/, "") === radiceVera)) {
        return record(this.id, this.nome, "fail",
          `il runbook dichiara \`Radici spedite: ${radici.join(", ")}\` e sul disco esiste \`${radiceVera}/\`, che non e' in elenco.\n` +
          "Restringere le radici restringe cio' che il gate confronta: e' il modo piu' economico di far passare una variabile non dichiarata",
          { block: 1, issue: 0, warn: 0 });
      }
      if (spediti.length === 0) {
        return record(this.id, this.nome, "skipped",
          `nessun sorgente sotto le radici dichiarate (${radici.join(" · ")}): il runbook dichiara radici che non contengono codice, e un elenco vuoto di variabili non e' un elenco verificato`);
      }
      const lette = new Map();
      const destrutturano = [];
      for (const percorso of spediti) {
        const testo = leggiSeCe(percorso);
        if (testo === null) continue;
        const { nomi, destruttura } = variabiliLette(testo);
        for (const n of nomi) if (!lette.has(n)) lette.set(n, percorso);
        if (destruttura) destrutturano.push(percorso);
      }
      const findings = findingsAmbiente({ lette, destrutturano, runbook: ctx.runbook });
      const escluse = VARIABILI_IMPRONTA.filter((n) => lette.has(n));
      // Zero coppie confrontate non e' «tutto a posto»: e' un confronto non
      // fatto (rilievo VER-6, seconda meta').
      if (lette.size - escluse.length === 0 && ctx.runbook.variabili.length === 0) {
        return record(this.id, this.nome, "skipped",
          `radici spedite: ${radici.join(" · ")} · ${spediti.length} sorgenti letti\n` +
          "nessuna variabile letta dal codice e nessuna dichiarata nel runbook: non e' stato confrontato niente.\n" +
          "Se il progetto davvero non ne legge, il runbook lo dichiari per iscritto: una dichiarazione e' meglio del silenzio");
      }
      const testa = [
        `radici spedite: ${radici.join(" · ")} · ${spediti.length} sorgenti letti`,
        `${lette.size} variabili lette dal codice · ${ctx.runbook.variabili.length} dichiarate nel runbook`,
        escluse.length > 0
          ? `${escluse.length} escluse perche' sono le fonti del commit dell'impronta, non configurazione dell'app: ${escluse.join(" · ")}`
          : "",
      ].filter(Boolean).join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.runtime,
    nome: "la build si rifa' uguale su un'altra macchina",
    async esegui(ctx) {
      const pkgTesto = leggiSeCe("package.json");
      if (pkgTesto === null) {
        return record(this.id, this.nome, "skipped", "nessun `package.json`: non e' un progetto Node");
      }
      let pkg = null;
      try { pkg = JSON.parse(pkgTesto); } catch {
        return record(this.id, this.nome, "skipped", "`package.json` non e' JSON leggibile");
      }
      const richieste = engineDelleDipendenze();
      if (richieste === null) {
        return record(this.id, this.nome, "skipped",
          "`node_modules/` assente o vuota: senza albero installato non si sa cosa pretendono le dipendenze, e dichiarare «runtime coerente» avendo letto zero `engines` e' la forma esatta del falso verde che la §18 vieta");
      }
      const tracciati = new Set(gitRighe(["ls-files"]) ?? []);
      const lockfile = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]
        .filter((n) => existsSync(join(PROGETTO, n)))
        .map((nome) => ({ nome, tracciato: tracciati.has(nome) }));
      const findings = findingsRuntime({
        engines: pkg.engines?.node ?? null,
        richieste,
        lockfile,
        runbook: ctx.runbook,
      });
      const max = richieste.reduce((a, r) => (r.minimo !== null && (a === null || r.minimo > a.minimo) ? r : a), null);
      const testa = [
        `${richieste.letti ?? "?"} package.json di dipendenze LETTI · ${richieste.length} dichiarano un \`engines.node\` · il piu' esigente e' ${max ? `\`${max.nome}\` (${max.range})` : "nessuno"}`,
        `il progetto dichiara: ${pkg.engines?.node ? `\`${pkg.engines.node}\`` : "NIENTE"} · packageManager: ${pkg.packageManager ?? "non dichiarato"}`,
        `lockfile: ${lockfile.map((l) => `${l.nome}${l.tracciato ? "" : " (NON tracciato)"}`).join(" · ") || "nessuno"}`,
        ctx.runbook ? `runtime dichiarato sul provider: ${ctx.runbook.runtimeProvider ?? "NON dichiarato"}` : "",
      ].filter(Boolean).join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.impronta,
    nome: "l'impronta dell'artefatto e' derivata dal commit",
    async esegui(ctx, args) {
      const nextConfig = ["next.config.ts", "next.config.mjs", "next.config.js"]
        .map((n) => leggiSeCe(n)).find((t) => t !== null) ?? null;
      const buildIdDisco = leggiSeCe(join(".next", "BUILD_ID"))?.trim() ?? null;
      const atteso = improntaAttesa(ctx.commit);

      let html = null;
      if (args.url) {
        const risposta = await preleva(args.url);
        // `>= 400` e non `>= 500` (rilievo VER-7): un 404 non e' una risposta
        // utile, e accettarlo faceva dichiarare esercitato un meccanismo che
        // aveva solo trovato una stringa in una pagina d'errore.
        if (risposta === null || risposta.stato >= 400) {
          const locali = findingsImpronta({ nextConfig, buildIdDisco, commit: ctx.commit, commitApprovato: ctx.runbook?.commitApprovato ?? null, soloDocumentiDaAllora: soloDocumentiDaAllora(ctx.runbook?.commitApprovato, ctx.commit) });
          return record(this.id, this.nome, "skipped",
            [`nessuna risposta utile da ${args.url}${risposta ? ` (HTTP ${risposta.stato})` : ""}: il meccanismo che verra' usato DOPO il deploy non e' stato esercitato`,
              locali.length ? dettaglioFindings(locali) : ""].filter(Boolean).join("\n"));
        }
        html = risposta.corpo;
      }

      const findings = findingsImpronta({ nextConfig, buildIdDisco, commit: ctx.commit, html, url: args.url, commitApprovato: ctx.runbook?.commitApprovato ?? null, soloDocumentiDaAllora: soloDocumentiDaAllora(ctx.runbook?.commitApprovato, ctx.commit) });
      const testa = [
        `impronta attesa dal commit di HEAD: \`${atteso}\` · \`.next/BUILD_ID\`: \`${buildIdDisco ?? "(assente)"}\``,
        args.url
          ? `verificata su ${args.url} — prova il MECCANISMO, non la pubblicazione: dopo il deploy si rilancia con \`--url\` sul dominio vero`
          : "",
      ].filter(Boolean).join("\n");

      if (!args.url) {
        return record(this.id, this.nome, "skipped",
          [testa,
            findings.length ? dettaglioFindings(findings) : "",
            "`--url` non passato: la verifica d'identita' che si usera' DOPO il deploy non e' stata esercitata. Approvare una pubblicazione la cui prova d'identita' non si e' mai vista funzionare e' la definizione di firma in bianco.",
            "Il gate NON indovina un `localhost:3000`: e' cosi' che si misura l'app di un altro progetto e si stampa `pass`.",
          ].filter(Boolean).join("\n"));
      }
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.runbook,
    nome: "runbook firmato da un umano, sul contenuto",
    async esegui(ctx) {
      if (ctx.runbookTesto === null) {
        return record(this.id, this.nome, "skipped",
          `${RUNBOOK} non esiste: e' il documento che un umano firma prima di mandare online, e senza non c'e' niente da firmare. Lo scrive il comando \`piano\` dal template della skill`);
      }
      if (!ctx.runbook) ctx.runbook = leggiRunbook(ctx.runbookTesto);
      const findings = findingsRunbook({ runbook: ctx.runbook, ultimoCommitCodice: ctx.ultimoCodice ?? ultimoCommitCodice(), adesso: ctx.adesso });
      const testa = [
        `provider: ${ctx.runbook.provider ?? "NON dichiarato"} · dominio: ${ctx.runbook.dominio ?? "NON dichiarato"} · modo: ${ctx.runbook.modoDeploy ?? "NON dichiarato"}`,
        `firma: ${ctx.runbook.confermatoDa ?? "assente"}`,
        `sezioni presenti: ${[...ctx.runbook.sezioni].join(" · ") || "nessuna"}`,
      ].join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.uscita,
    nome: "contratto d'uscita (handoff)",
    async esegui() {
      const dir = join(PROGETTO, HANDOFF_DIR);
      const trovato = existsSync(dir)
        ? readdirSync(dir).filter((n) => /-launchpad\.md$/i.test(n)).sort().pop()
        : null;
      const percorso = trovato ? `${HANDOFF_DIR}/${trovato}` : `${HANDOFF_DIR}/<n>-launchpad.md`;
      const findings = contrattoUscita(percorso, trovato ? leggiSeCe(percorso) : null, verdettoDa(steps));
      return conFindings(this.id, this.nome, findings, percorso);
    },
  },
];

/** `engines.node` di ogni dipendenza installata. `null` se l'albero non c'e'. */
function engineDelleDipendenze() {
  const radice = join(PROGETTO, "node_modules");
  if (!existsSync(radice)) return null;
  const pacchetti = [];
  // Si conta quanti `package.json` sono stati APERTI, non quanti dichiarano
  // `engines` — rilievo VER-1 del tribunale, il piu' grave sul gate.
  // `engineDelleDipendenze` ritornava `null` solo con `node_modules/` del tutto
  // vuota, ma npm ci lascia sempre `.bin/` e `.package-lock.json`: con l'albero
  // svuotato la funzione ritornava `[]`, il passo proseguiva e stampava `pass`
  // avendo letto ZERO `engines`. Misurato: gate `ok=true` 9/9 con il progetto a
  // `>=18` e le dipendenze che pretendevano `>=22`. E' il debito n°32 del
  // pilota, cioe' una delle due voci che questo gate dichiara di RIMISURARE.
  let apertiConSuccesso = 0;
  const aggiungi = (nome, dir) => {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      apertiConSuccesso++;
      const range = pkg.engines?.node;
      if (range) pacchetti.push({ nome, range, minimo: minimoNode(range) });
    } catch { /* pacchetto senza package.json leggibile: non e' un rilievo */ }
  };
  let voci;
  try { voci = readdirSync(radice, { withFileTypes: true }); } catch { return null; }
  if (voci.length === 0) return null;
  for (const v of voci) {
    if (!v.isDirectory() || v.name.startsWith(".")) continue;
    if (v.name.startsWith("@")) {
      try {
        for (const s of readdirSync(join(radice, v.name), { withFileTypes: true })) {
          if (s.isDirectory()) aggiungi(`${v.name}/${s.name}`, join(radice, v.name, s.name));
        }
      } catch { /* scope illeggibile */ }
    } else {
      aggiungi(v.name, join(radice, v.name));
    }
  }
  // Zero `package.json` LETTI = albero non installato: MANCANTE, non un elenco
  // vuoto. Diverso da «N letti, nessuno dichiara `engines`», che e' un pass
  // legittimo.
  if (apertiConSuccesso === 0) return null;
  pacchetti.letti = apertiConSuccesso;
  return pacchetti;
}

// ------------------------------------------------------------------- verdetto
function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE LAUNCHPAD: ${verde ? "VERDE" : "ROSSO"} ` +
    `(${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti su ${riassunto.passi} passi)`);
  console.log(`progetto: ${PROGETTO}\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status];
    console.log(`${marchio}  ${s.name}`);
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) {
    console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  }
  console.log(verde
    ? "\nIl gate e' verde. NON e' il permesso di pubblicare: e' la condizione necessaria.\nIl permesso lo firma una persona che ha letto docs/deploy.md (DECISIONI.md §6)."
    : "\nNon si pubblica. Ogni motivo dice di chi e': quasi nessuno e' di launchpad.");
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, storia: STORIA_DEFAULT, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--storia") args.storia = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(PROGETTO, "docs"))) {
    console.error(`Nessuna cartella docs/ in ${PROGETTO}: lancia il gate dalla radice del progetto generato.`);
    process.exit(2);
  }
  if (!Number.isInteger(args.storia) || args.storia < 0) {
    console.error("--storia vuole un intero >= 0 (0 = non guardare la storia, e il gate lo dichiara).");
    process.exit(2);
  }
  // Il runbook si legge UNA VOLTA SOLA, prima del ciclo — rilievo VER-11.
  // Prima lo popolava il passo 3, che pero' esce presto quando il registro del
  // debito manca: e allora il passo 6 riceveva `runbook: null` e **saltava in
  // silenzio** l'intero controllo «Runtime del provider», stampando `pass`.
  // Il verdetto di un passo peggiorava su un progetto peggiore.
  const runbookTesto = leggiSeCe(RUNBOOK);
  const ctx = {
    commit: null, ramo: null, upstream: null, handoff: null, ultimoCodice: null,
    runbookTesto,
    runbook: runbookTesto === null ? null : leggiRunbook(runbookTesto),
    adesso: new Date().toISOString(),
  };
  for (const passo of PASSI) {
    try {
      await passo.esegui(ctx, args);
    } catch (e) {
      // Un'eccezione non deve poter ammutolire il gate: diventa un passo
      // MANCANTE col motivo (rilievo VER-15). Prima usciva una traccia di
      // stack e nessuna riga `GATE LAUNCHPAD:`.
      record(passo.id, passo.nome, "skipped",
        `il passo ha sollevato: ${e?.message ?? e}\nnon e' un esito, e' una verifica interrotta`);
    }
  }
  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano ID/PASSI.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde.
// E il confronto e' DOPPIO perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/launchpad/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco e' falso e lo script esce 0 muto (misurato il 2026-08-04 su
// otto script di questa casa, IGIENE2-JUNCTION-2026-08-04.md). `realpathSync`
// scioglie la junction; se solleva si ricade sul confronto testuale: mai un
// errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}
