#!/usr/bin/env node
/**
 * verify.mjs — Il gate di Site Doctor.
 *
 * COSA FA: cammina la superficie pubblica di un sito servito, misura cio' che
 * riguarda chi lo visita e non ha firmato niente (informativa, dati raccolti,
 * archiviazione nel browser, accessibilita', lingua) e verifica che tutto il
 * resto sia dichiarato con il nome del proprietario.
 *
 * QUATTRO stati, non tre:
 *   pass | fail | skipped | n/a
 *   `skipped` NON e' un successo: e' una verifica mancante, e il gate resta
 *   rosso. `n/a` e' una risposta finita — e costa una premessa misurata, che si
 *   stampa nel dettaglio. Il verde vuole `fail = 0` E `skipped = 0`.
 *
 * USO:  node verify.mjs --url <url-del-sito-servito> [--max-pagine N] [--json]
 * USCITA: 0 = gate verde · 1 = gate rosso · 2 = errore di esecuzione
 *
 * DIPENDENZE ESTERNE: nessuna. Niente `npx`, niente shim `.cmd`, niente
 * browser: solo `fetch` e lettura di file. E' una scelta con una conseguenza
 * dichiarata — a questo gate serve L'INTERPRETE, non il `PATH` (la nota di
 * macchina del 2026-08-06 sul Lighthouse di speed-demon qui non si applica).
 * Il prezzo e' che i contrasti non li misura: sono delegati a chi apre un
 * browser, ed e' scritto nel perimetro.
 *
 * `--url` NON ha un default, ed e' deliberato: un gate che indovina
 * `localhost:3000` certifica l'app di un altro progetto. E' successo davvero in
 * questa casa il 2026-07-30. Il prezzo e' gia' stato pagato.
 *
 * Le regole vivono in `servito-lib.mjs` e `conformita-lib.mjs` e hanno i loro
 * test: qui c'e' solo il guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  contrattoUscita,
  findingsCertificato,
  findingsPerimetro,
  leggiCertificato,
  verdettoDa,
} from "./conformita-lib.mjs";
import {
  apiArchiviazioneIn,
  assetDaProvare,
  attributi,
  campiDiPagina,
  candidatiInformativa,
  collegamentiInterni,
  contaGravita,
  dettaglioFindings,
  eLaMiaBuild,
  esitoIdentita,
  esitoLingua,
  findingsAccessibilitaPagina,
  findingsArchiviazione,
  findingsDatiRaccolti,
  findingsInformativa,
  findingsSuperficie,
  hreflangDi,
  langDi,
  moduliDiPagina,
  percorsiDaSitemap,
  statoDaFindings,
  statoNonApplicabile,
  terziDi,
} from "./servito-lib.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PROGETTO = process.cwd();
const CERTIFICATO = "docs/conformita.md";
const HANDOFF_DIR = "docs/handoff";

export const ID = Object.freeze({
  certificato: "certificato",
  superficie: "superficie-pubblica",
  informativa: "informativa-privacy",
  dati: "dati-raccolti",
  archiviazione: "archiviazione-client",
  a11y: "accessibilita-servita",
  lingua: "lingua-e-hreflang",
  perimetro: "perimetro",
  uscita: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;
export const MAX_PAGINE = 60;

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

/**
 * Una GET che non esplode: `{ stato, corpo, intestazioni, cookie }` o `null`.
 * Due tentativi, come nel gate di speed-demon e per lo stesso motivo misurato:
 * un intoppo di rete non deve trasformarsi in un rilievo sul sito.
 */
async function preleva(url, { tentativi = 2, segui = false } = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const r = await fetch(url, { redirect: segui ? "follow" : "manual" });
      const corpo = await r.text();
      const cookie = typeof r.headers.getSetCookie === "function"
        ? r.headers.getSetCookie()
        : (r.headers.get("set-cookie") ? [r.headers.get("set-cookie")] : []);
      return { stato: r.status, corpo, intestazioni: r.headers, cookie };
    } catch {
      if (i === tentativi - 1) return null;
      await new Promise((ok) => setTimeout(ok, 500));
    }
  }
  return null;
}

const unisci = (base, percorso) => new URL(percorso, base).toString();

/** Il nome di un cookie da una riga `Set-Cookie`. */
const nomeCookie = (riga) => String(riga).split("=")[0].trim();

// ----------------------------------------------------------------- i passi
const PASSI = [
  {
    id: ID.certificato,
    nome: "certificato di idoneita' firmato",
    async esegui(ctx) {
      const testo = leggiSeCe(CERTIFICATO);
      if (testo === null) {
        return record(this.id, this.nome, "skipped",
          `${CERTIFICATO} assente: nessun certificato di idoneita'. Launchpad non pubblica senza, e senza questo documento nessuno ha scritto chi guarda cosa (comando \`certifica\`).\n` +
          "I passi che misurano il sito girano lo stesso: un gate rosso per il solo contratto mancante avrebbe imparato a tacere sul resto.");
      }
      ctx.certificato = leggiCertificato(testo);
      const findings = findingsCertificato(ctx.certificato);
      const dettaglio = [
        `lingue dichiarate: ${ctx.certificato.lingue.join(", ") || "nessuna"} · informativa dichiarata: ${ctx.certificato.informativa ?? "nessuna"} · banner: ${ctx.certificato.banner ? "sì" : "no"}`,
        `archiviazioni dichiarate: ${ctx.certificato.archiviazioni.length} · campi con base giuridica: ${ctx.certificato.datiRaccolti.length} · voci in tabella: ${ctx.certificato.voci.righe.length}`,
        ctx.certificato.confermatoDa ? `confermato da: ${ctx.certificato.confermatoDa}` : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.superficie,
    nome: "superficie pubblica camminata (collegamenti + sitemap)",
    async esegui(ctx, args) {
      const radice = await preleva(args.url, { segui: true });
      if (!radice) {
        return record(this.id, this.nome, "skipped",
          `nessuna risposta da ${args.url}: avvia la build con \`npm run build && npm run start\` prima del gate. Si certifica cio' che si pubblica, e per certificarlo bisogna poterlo leggere`);
      }
      if (radice.stato >= 400) {
        return record(this.id, this.nome, "fail", `${args.url} risponde ${radice.stato}`);
      }
      const buildId = leggiSeCe(join(".next", "BUILD_ID"))?.trim();
      if (!buildId) {
        return record(this.id, this.nome, "skipped",
          `${args.url} risponde (HTTP ${radice.stato}), ma non si e' potuto verificare che sia l'app di QUESTO progetto: manca \`.next/BUILD_ID\`.\n` +
          "Un certificato di idoneita' emesso misurando l'applicazione di qualcun altro e' peggio di nessun certificato.");
      }
      const identita = await provaIdentita(radice.corpo, buildId, args.url);
      if (!identita.misurabile) {
        return record(this.id, this.nome, identita.stato, identita.diagnosi);
      }

      // Seconda sorgente, indipendente dai collegamenti.
      const sitemap = await preleva(unisci(args.url, "/sitemap.xml"), { segui: true });
      const sitemapLetta = Boolean(sitemap && sitemap.stato === 200 && /<urlset|<loc>/i.test(sitemap.corpo));
      const daSitemap = sitemapLetta ? percorsiDaSitemap(sitemap.corpo, args.url) : [];

      // Camminata in ampiezza dai collegamenti, partendo dalla radice e dalla
      // sitemap. Una pagina che rimanda altrove NON e' quella pagina: si
      // registra il rimando e non ci si entra (precedente di speed-demon, e la
      // ragione per cui l'area amministrativa non finisce nella superficie
      // pubblica senza che nessuno debba elencarla).
      const daVedere = ["/", ...daSitemap];
      const viste = new Map();
      const rimandi = new Map();
      const daCollegamenti = new Set();
      let troncata = false;
      while (daVedere.length > 0) {
        if (viste.size >= args.maxPagine) { troncata = true; break; }
        const percorso = daVedere.shift();
        if (viste.has(percorso) || rimandi.has(percorso)) continue;
        const r = await preleva(unisci(args.url, percorso));
        if (!r) { viste.set(percorso, null); continue; }
        if (r.stato >= 300 && r.stato < 400) { rimandi.set(percorso, r.intestazioni.get("location")); continue; }
        if (r.stato >= 400) { rimandi.set(percorso, `HTTP ${r.stato}`); continue; }
        viste.set(percorso, r);
        for (const p of collegamentiInterni(r.corpo, args.url)) {
          daCollegamenti.add(p);
          if (!viste.has(p) && !rimandi.has(p)) daVedere.push(p);
        }
      }
      daCollegamenti.add("/");

      ctx.baseUrl = args.url;
      ctx.pagine = [...viste].filter(([, r]) => r !== null).map(([percorso, r]) => ({ percorso, ...r }));
      ctx.nonLette = [...viste].filter(([, r]) => r === null).map(([p]) => p);
      ctx.rimandi = rimandi;

      const findings = findingsSuperficie({
        daCollegamenti: [...daCollegamenti].filter((p) => viste.has(p)),
        daSitemap,
        dichiarate: ctx.certificato?.superficie ?? [],
        sitemapLetta,
      });
      if (identita.stato !== "pass") {
        findings.push({ severity: "block", object: "identita' dell'app", message: identita.diagnosi });
      }
      if (troncata) {
        findings.push({ severity: "block", object: "superficie", message: `camminata interrotta a ${args.maxPagine} pagine (--max-pagine): il resto del sito NON e' stato guardato, e un certificato parziale non deve somigliare a uno completo` });
      }
      if (ctx.nonLette.length > 0) {
        findings.push({ severity: "block", object: "superficie", message: `${ctx.nonLette.length} pagine non scaricate: ${ctx.nonLette.join(", ")}` });
      }
      const dettaglio = [
        `identita': ${identita.stato === "pass" ? identita.diagnosi : "NON confermata dal build id (vedi sotto)"} · ${ctx.pagine.length} pagine lette · ${rimandi.size} rimandi o errori non seguiti`,
        `sorgenti: collegamenti (${daCollegamenti.size}) · sitemap.xml ${sitemapLetta ? `(${daSitemap.length})` : "NON LETTA"}`,
        `superficie: ${ctx.pagine.map((p) => p.percorso).join(" ")}`,
        rimandi.size > 0 ? `non entrate: ${[...rimandi].map(([p, d]) => `${p} → ${d}`).join(" · ")}` : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.informativa,
    nome: "informativa privacy raggiungibile",
    async esegui(ctx) {
      if (!ctx.pagine) return record(this.id, this.nome, "skipped", "superficie non stabilita: non c'e' niente su cui cercare un'informativa");
      const conCandidati = ctx.pagine.map((p) => ({ percorso: p.percorso, candidati: candidatiInformativa(p.corpo, ctx.baseUrl) }));
      const conteggio = new Map();
      for (const p of conCandidati) for (const c of p.candidati) conteggio.set(c.percorso, (conteggio.get(c.percorso) ?? 0) + 1);
      // Il candidato piu' collegato: se le pagine rimandano a due posti diversi,
      // vince quello che vede piu' gente, e la discrepanza esce come rilievo.
      const scelto = [...conteggio].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      let informativa = null;
      let htmlInformativa = null;
      if (scelto) {
        const gia = ctx.pagine.find((p) => p.percorso === scelto);
        const r = gia ?? (await preleva(unisci(ctx.baseUrl, scelto)));
        if (!r) {
          return record(this.id, this.nome, "skipped", `le pagine rimandano a ${scelto} e non si e' riusciti a scaricarlo: la verifica non e' stata fatta, non e' fallita`);
        }
        informativa = { percorso: scelto, stato: r.stato };
        htmlInformativa = r.corpo;
        ctx.informativaRaggiungibile = new Set(conCandidati.filter((p) => p.candidati.some((c) => c.percorso === scelto)).map((p) => p.percorso));
      } else {
        ctx.informativaRaggiungibile = new Set();
      }

      const findings = findingsInformativa({
        pagine: conCandidati,
        informativa,
        htmlInformativa,
        dichiarata: ctx.certificato?.informativa ?? null,
      });
      const dettaglio = [
        informativa
          ? `informativa: ${informativa.percorso} (HTTP ${informativa.stato}) · collegata da ${ctx.informativaRaggiungibile.size} pagine su ${conCandidati.length}`
          : `nessun collegamento a un'informativa su ${conCandidati.length} pagine`,
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.dati,
    nome: "dati raccolti dai moduli pubblici",
    async esegui(ctx) {
      if (!ctx.pagine) return record(this.id, this.nome, "skipped", "superficie non stabilita: nessun modulo da guardare");
      const pagineConModuli = ctx.pagine
        .map((p) => ({ percorso: p.percorso, moduli: moduliDiPagina(p.corpo), campi: campiDiPagina(p.corpo) }))
        .filter((p) => p.moduli > 0 || p.campi.length > 0);
      const campiTotali = pagineConModuli.reduce((n, p) => n + p.campi.length, 0);

      if (pagineConModuli.length === 0) {
        const premessa = `zero moduli e zero campi nell'HTML servito di ${ctx.pagine.length} pagine (${ctx.pagine.map((p) => p.percorso).join(" ")})`;
        return record(this.id, this.nome, statoNonApplicabile(premessa),
          `${premessa}\nNON APPLICABILE: il sito non chiede niente a chi lo visita. Un modulo costruito nel browser dopo il caricamento qui non si vede — vedi SKILL.md §Cosa un gate verde NON prova.`);
      }
      const findings = findingsDatiRaccolti({
        pagineConModuli,
        basiDichiarate: ctx.certificato?.datiRaccolti ?? [],
        informativaRaggiungibile: ctx.informativaRaggiungibile ?? new Set(),
      });
      const g = contaGravita(findings);
      const dettaglio = [
        `${pagineConModuli.length} pagine con moduli · ${campiTotali} campi letti · ${(ctx.certificato?.datiRaccolti ?? []).length} righe di base giuridica nel certificato`,
        findings.length === 0 ? "ogni campo che raccoglie un dato personale ha la sua base giuridica dichiarata" : `${g.block} bloccanti, ${g.issue} da guardare`,
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.archiviazione,
    nome: "cosa il sito archivia nel browser",
    async esegui(ctx) {
      if (!ctx.pagine) return record(this.id, this.nome, "skipped", "superficie non stabilita: non c'e' niente da leggere");
      const cookie = [];
      const archiviazioni = [];
      const terziMappa = new Map();
      const bundleVisti = new Map();
      const bundleFalliti = [];
      let bundleLetti = 0;

      for (const pagina of ctx.pagine) {
        for (const riga of pagina.cookie) cookie.push({ nome: nomeCookie(riga), percorso: pagina.percorso, riga });
        for (const t of terziDi(pagina.corpo, ctx.baseUrl)) {
          if (!terziMappa.has(t.origine)) terziMappa.set(t.origine, t);
        }
        for (const src of sorgentiInterne(pagina.corpo, ctx.baseUrl)) {
          if (!bundleVisti.has(src)) {
            const r = await preleva(unisci(ctx.baseUrl, src), { segui: true });
            if (!r || r.stato >= 400) { bundleFalliti.push(src); bundleVisti.set(src, null); continue; }
            bundleLetti++;
            bundleVisti.set(src, apiArchiviazioneIn(r.corpo));
          }
          const trovate = bundleVisti.get(src);
          if (!trovate) continue;
          for (const api of trovate) {
            if (!archiviazioni.some((a) => a.api === api && a.percorso === pagina.percorso)) {
              archiviazioni.push({ api, percorso: pagina.percorso, bundle: src });
            }
          }
        }
      }

      // Un bundle non scaricato NON e' un bundle pulito. E' il difetto n°2 del
      // collaudo avversario di vetrina-crafter, nella sua forma naturale qui:
      // se il gate ne salta uno in silenzio, «non archivia niente» e «non ho
      // guardato» diventano la stessa frase.
      if (bundleFalliti.length > 0) {
        return record(this.id, this.nome, "skipped",
          `${bundleFalliti.length} script serviti non scaricati (${bundleFalliti.slice(0, 5).join(", ")}${bundleFalliti.length > 5 ? " …" : ""}).\n` +
          "Un bundle non letto non e' un bundle pulito: la verifica non e' stata fatta.");
      }

      const terzi = [...terziMappa.values()];
      if (cookie.length === 0 && archiviazioni.length === 0 && terzi.length === 0) {
        const premessa = `zero \`Set-Cookie\`, zero API di archiviazione e zero terzi su ${ctx.pagine.length} pagine e ${bundleLetti} script serviti letti per intero`;
        const findings = ctx.certificato?.banner
          ? [{ severity: "issue", object: "consenso", message: "banner dichiarato e nessuna archiviazione misurata" }]
          : [];
        return record(this.id, this.nome, findings.length > 0 ? "pass" : statoNonApplicabile(premessa),
          `${premessa}\nNON APPLICABILE: il sito non mette niente nel browser di chi passa, quindi non c'e' niente da dichiarare e nessun banner da mostrare.\n${dettaglioFindings(findings)}`.trim());
      }

      const findings = findingsArchiviazione({
        cookie,
        archiviazioni,
        terzi,
        dichiarate: ctx.certificato?.archiviazioni ?? [],
        banner: ctx.certificato?.banner ?? false,
      });
      const g = contaGravita(findings);
      const dettaglio = [
        `${cookie.length} cookie · ${archiviazioni.length} usi di API di archiviazione · ${terzi.length} origini di terzi · ${bundleLetti} script letti per intero`,
        archiviazioni.length > 0 ? `archiviazione: ${archiviazioni.map((a) => `${a.api} in ${a.percorso}`).join(" · ")}` : "",
        terzi.length > 0 ? `terzi: ${terzi.map((t) => `${t.origine} (${t.elementi.join(",")})`).join(" · ")}` : "",
        findings.length === 0 ? "tutto quello che il sito archivia e' dichiarato nel certificato" : `${g.block} bloccanti, ${g.issue} da guardare`,
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.a11y,
    nome: "accessibilita' dell'HTML servito",
    async esegui(ctx) {
      if (!ctx.pagine) return record(this.id, this.nome, "skipped", "superficie non stabilita: nessuna pagina da leggere");
      const findings = ctx.pagine.flatMap((p) => findingsAccessibilitaPagina(p.percorso, p.corpo));
      const g = contaGravita(findings);
      const dettaglio = [
        `${ctx.pagine.length} pagine lette sull'HTML servito, carico RSC escluso dal conteggio dei tag`,
        findings.length === 0
          ? "lingua, titoli, alt, main, etichette e nomi accessibili: nessun rilievo"
          : `${g.block} bloccanti, ${g.issue} da guardare`,
        dettaglioFindings(findings),
        "i CONTRASTI non sono misurati qui: sono di speed-demon, che apre un browser (SKILL.md §Perimetro)",
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.lingua,
    nome: "lingua dichiarata e hreflang",
    async esegui(ctx) {
      if (!ctx.pagine) return record(this.id, this.nome, "skipped", "superficie non stabilita");
      if (!ctx.certificato || ctx.certificato.lingue.length === 0) {
        return record(this.id, this.nome, "skipped",
          "il certificato non dichiara nessuna lingua: senza, non c'e' niente contro cui confrontare i `lang` misurati, e un `NON APPLICABILE` qui sarebbe una risposta senza domanda");
      }
      const pagine = ctx.pagine.map((p) => ({
        percorso: p.percorso,
        lang: langDi(p.corpo),
        hreflang: hreflangDi(p.corpo, ctx.baseUrl),
      }));
      const { findings, stato, premessa } = esitoLingua({
        pagine,
        lingueDichiarate: ctx.certificato.lingue,
        percorsi: ctx.pagine.map((p) => p.percorso),
      });
      const dettaglio = [
        premessa,
        stato === "n/a" ? "NON APPLICABILE: sito monolingua misurato, gli hreflang non si applicano." : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, stato, dettaglio);
    },
  },

  {
    id: ID.perimetro,
    nome: "proprieta' delle voci di conformita'",
    async esegui(ctx) {
      if (!ctx.certificato) {
        return record(this.id, this.nome, "skipped",
          `${CERTIFICATO} assente: nessuna tabella di proprieta'. E' la tabella che questa skill esiste per produrre — senza, «lo guarda qualcun altro» resta una frase`);
      }
      const statiPassi = new Map(steps.map((s) => [s.id, s.status]));
      const findings = findingsPerimetro({
        tabella: ctx.certificato.voci,
        leggiFile: (percorso) => leggiSeCe(percorso),
        statiPassi,
      });
      const g = contaGravita(findings);
      const scoperte = findings.filter((f) => /SCOPERTA/.test(f.message)).length;
      const dettaglio = [
        `${ctx.certificato.voci.righe.length} righe in tabella contro ${statiPassi.size} passi eseguiti · ${scoperte} voci scoperte`,
        findings.length === 0 ? "ogni voce ha un proprietario solo, e le delegate citano un file che le nomina" : `${g.block} bloccanti, ${g.issue} da guardare, ${g.warn} righe fuori elenco`,
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.uscita,
    nome: "contratto d'uscita (handoff)",
    async esegui() {
      const percorso = trovaHandoff();
      const testo = percorso ? leggiSeCe(percorso) : null;
      const findings = contrattoUscita(percorso ?? `${HANDOFF_DIR}/<n>-site-doctor.md`, testo, verdettoDa(steps));
      return record(this.id, this.nome, statoDaFindings(findings), findings.length === 0 ? `${percorso}` : dettaglioFindings(findings));
    },
  },
];

/**
 * L'identita' dell'app per due vie: il `BUILD_ID` e, se non basta, un asset
 * statico servito confrontato con quello su disco. La regola sta in
 * `esitoIdentita`; qui c'e' solo il pezzo che tocca il mondo.
 */
async function provaIdentita(html, buildId, url) {
  const buildIdCombacia = eLaMiaBuild(html, buildId);
  if (buildIdCombacia) return esitoIdentita({ buildIdCombacia, buildId, url });

  const assetProvato = assetDaProvare(html, url);
  let assetIdentico = false;
  if (assetProvato) {
    const servito = await preleva(unisci(url, assetProvato), { segui: true });
    const suDisco = join(PROGETTO, ".next", assetProvato.replace(/^\/_next\//, ""));
    if (servito && servito.stato === 200 && existsSync(suDisco)) {
      assetIdentico = readFileSync(suDisco, "utf8") === servito.corpo;
    }
  }
  return esitoIdentita({ buildIdCombacia, assetProvato, assetIdentico, buildId, url });
}

/**
 * Gli script della stessa origine referenziati dall'HTML servito.
 *
 * Si legge l'HTML GREZZO, non quello ripulito: `senzaScript` porta via i tag
 * `<script>` insieme al loro corpo, ed e' esattamente quello che serve alle
 * regole sui tag della pagina — ma qui i tag `<script src=…>` sono il bersaglio.
 * Se questa funzione leggesse il documento ripulito troverebbe zero bundle e il
 * passo direbbe «nessuna archiviazione» dopo non aver letto niente.
 */
function sorgentiInterne(html, base) {
  const percorsi = new Set();
  for (const tag of html.match(/<script\b[^>]*\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi) ?? []) {
    const p = percorsoInternoConQuery(attributi(tag).src, base);
    if (p) percorsi.add(p);
  }
  return [...percorsi];
}

/** Come `percorsoInterno`, ma tiene la query: un bundle e' il suo indirizzo intero. */
function percorsoInternoConQuery(href, base) {
  if (!href) return null;
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  const radice = new URL(base);
  if (url.host !== radice.host || url.protocol !== radice.protocol) return null;
  return `${url.pathname}${url.search}`;
}

function trovaHandoff() {
  const dir = join(PROGETTO, HANDOFF_DIR);
  if (!existsSync(dir)) return null;
  const trovato = readdirSync(dir).filter((n) => /-site-doctor\.md$/.test(n)).sort().pop();
  return trovato ? `${HANDOFF_DIR}/${trovato}` : null;
}

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped"), na: per("n/a") };
}

function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE CONFORMITA': ${verde ? "VERDE" : "ROSSO"} ` +
    `(${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti, ${riassunto.na} non applicabili su ${riassunto.passi} passi)\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC", "n/a": "N.A." }[s.status] ?? "????";
    console.log(`${marchio}  ${s.name}`);
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  if (riassunto.na > 0) console.log("Un NON APPLICABILE ha la sua premessa misurata stampata qui sopra: se la premessa e' falsa, lo e' anche la risposta.");
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, json: false, maxPagine: MAX_PAGINE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--max-pagine") args.maxPagine = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(PROGETTO, "docs")) && !existsSync(join(PROGETTO, "src", "app"))) {
    console.error(`Ne' docs/ ne' src/app/ in ${PROGETTO}: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.`);
    process.exit(2);
  }
  if (!args.url) {
    const testo = leggiSeCe(CERTIFICATO);
    const dichiarato = testo ? leggiCertificato(testo).urlDichiarato : null;
    if (dichiarato) {
      args.url = dichiarato;
      console.error(`--url assente: uso l'indirizzo dichiarato in ${CERTIFICATO} → ${dichiarato}`);
    }
  }
  if (!args.url) {
    console.error(
      "Manca --url, e il certificato non dichiara nessuna riga `URL verificato:`. Il gate NON indovina un `localhost:3000`: e' cosi' che si certifica l'app di un altro progetto.\n" +
      "Avvia la build con `npm run build && npm run start -- -p <porta>` e passa quell'indirizzo, oppure scrivilo nel certificato.",
    );
    process.exit(2);
  }
  if (!Number.isInteger(args.maxPagine) || args.maxPagine < 1) {
    console.error("--max-pagine deve essere un intero >= 1.");
    process.exit(2);
  }
  const ctx = { certificato: null, baseUrl: null, pagine: null, informativaRaggiungibile: null };
  for (const passo of PASSI) await passo.esegui(ctx, args);
  process.exit(verdetto(args.json));
}

// eseguito come comando, non quando i test importano ID/PASSI/riepilogo.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde (P.0-igiene).
// E il confronto e' DOPPIO perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e i gate uscivano 0 muti (P.0-igiene-2,
// IGIENE2-JUNCTION-2026-08-04.md). `realpathSync` scioglie la junction; se
// solleva si ricade sul confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}

export { SKILL_DIR };
