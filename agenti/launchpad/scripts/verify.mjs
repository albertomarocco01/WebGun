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
import { eBinario, esitoSegreti } from "./segreti-lib.mjs";
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

const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  try {
    return existsSync(pieno) && statSync(pieno).isFile() ? readFileSync(pieno, "utf8") : null;
  } catch {
    return null;
  }
};

// git: risolutore, comandi e lettura della storia stanno in `git-lib.mjs`.
// Due copie divergono, e in questa casa e' gia' successo (DECISIONI.md §7).
const git = (args, opzioni) => gitIn(PROGETTO, args, opzioni);
const gitRighe = (args) => gitRigheIn(PROGETTO, args);
const leggiStoria = (quanti) => leggiStoriaIn(PROGETTO, quanti);

async function preleva(url, { tentativi = 2 } = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
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
      ctx.commit = git(["rev-parse", "HEAD"]).out.trim() || null;
      if (!ctx.commit) {
        return record(this.id, this.nome, "skipped", "nessun commit su HEAD: non c'e' niente da pubblicare");
      }
      const ramo = git(["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
      ctx.ramo = ramo && ramo !== "HEAD" ? ramo : null;
      const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
      ctx.upstream = upstream.ok ? upstream.out.trim() : null;
      const avanti = ctx.upstream ? Number(git(["rev-list", "--count", "@{upstream}..HEAD"]).out.trim() || 0) : 0;
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
      ctx.runbookTesto = leggiSeCe(RUNBOOK);
      ctx.runbook = ctx.runbookTesto === null ? null : leggiRunbook(ctx.runbookTesto);
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
      for (const percorso of tracciati) {
        const pieno = join(PROGETTO, percorso);
        try {
          const buf = readFileSync(pieno);
          if (eBinario(buf)) binari.push(percorso);
          else letti.push({ percorso, testo: buf.toString("utf8") });
        } catch { /* file sparito fra `ls-files` e la lettura: non si accusa nessuno */ }
      }
      // I file NUOVI e non ignorati: `git ls-files` non li elenca e il gesto
      // successivo di chiunque e' `git add -A`. Vedi la nota in `esitoSegreti`.
      const daTracciare = [];
      for (const percorso of gitRighe(["ls-files", "--others", "--exclude-standard"]) ?? []) {
        if (FUORI_DAL_PACCHETTO.test(percorso)) continue;
        try {
          const buf = readFileSync(join(PROGETTO, percorso));
          if (eBinario(buf)) binari.push(percorso);
          else daTracciare.push({ percorso, testo: buf.toString("utf8") });
        } catch { /* sparito fra l'elenco e la lettura */ }
      }
      const ignorati = [];
      for (const percorso of gitRighe(["ls-files", "--others", "--ignored", "--exclude-standard"]) ?? []) {
        if (FUORI_DAL_PACCHETTO.test(percorso)) continue;
        try {
          const buf = readFileSync(join(PROGETTO, percorso));
          if (!eBinario(buf) && buf.length < 512 * 1024) ignorati.push({ percorso, testo: buf.toString("utf8") });
        } catch { /* ignorato e illeggibile: non e' un rilievo */ }
      }
      const storia = leggiStoria(args.storia);
      const { findings, riassunto } = esitoSegreti({ letti, daTracciare, ignorati, storia, binari });
      ctx.segretiRiassunto = riassunto;
      const testa = [
        `${riassunto.letti} file tracciati letti · ${riassunto.daTracciare} nuovi non ancora tracciati · ${riassunto.binari} binari non letti · ${riassunto.ignorati} file ignorati guardati`,
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
        `${richieste.length} dipendenze installate dichiarano un \`engines.node\` · il piu' esigente e' ${max ? `\`${max.nome}\` (${max.range})` : "nessuno"}`,
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
        if (risposta === null || risposta.stato >= 500) {
          const locali = findingsImpronta({ nextConfig, buildIdDisco, commit: ctx.commit });
          return record(this.id, this.nome, "skipped",
            [`nessuna risposta utile da ${args.url}${risposta ? ` (HTTP ${risposta.stato})` : ""}: il meccanismo che verra' usato DOPO il deploy non e' stato esercitato`,
              locali.length ? dettaglioFindings(locali) : ""].filter(Boolean).join("\n"));
        }
        html = risposta.corpo;
      }

      const findings = findingsImpronta({ nextConfig, buildIdDisco, commit: ctx.commit, html, url: args.url });
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
      if (ctx.runbookTesto === undefined) ctx.runbookTesto = leggiSeCe(RUNBOOK);
      if (ctx.runbookTesto === null) {
        return record(this.id, this.nome, "skipped",
          `${RUNBOOK} non esiste: e' il documento che un umano firma prima di mandare online, e senza non c'e' niente da firmare. Lo scrive il comando \`piano\` dal template della skill`);
      }
      if (!ctx.runbook) ctx.runbook = leggiRunbook(ctx.runbookTesto);
      const findings = findingsRunbook({ runbook: ctx.runbook, ultimoCommitCodice: ctx.ultimoCodice ?? ultimoCommitCodice() });
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
  const aggiungi = (nome, dir) => {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
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
  const ctx = { commit: null, ramo: null, upstream: null, handoff: null, runbook: null, runbookTesto: undefined, ultimoCodice: null };
  for (const passo of PASSI) await passo.esegui(ctx, args);
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
