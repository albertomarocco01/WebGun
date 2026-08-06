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

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { TextDecoder } from "node:util";
import { join, resolve, sep } from "node:path";
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
  archiviazioneIncertaIn,
  assetDaProvare,
  attributi,
  blocchiJsonLd,
  campiDiPagina,
  destinazioniModuli,
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
  findingsDatiStrutturati,
  findingsFavicon,
  findingsInformativa,
  findingsOpenGraph,
  findingsRobots,
  findingsSitemap,
  findingsSuperficie,
  hreflangDi,
  iconeDichiarate,
  langDi,
  leggiRobots,
  moduliDiPagina,
  openGraphDi,
  percorsiDaSitemap,
  perStampa,
  percorsoInterno,
  raggiungibiliDaCollegamenti,
  ripulisciDocumento,
  senzaScript,
  statoDaFindings,
  statoNonApplicabile,
  tagDi,
  terziDi,
} from "./servito-lib.mjs";

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
  // Le cinque voci tornate a casa con D21: erano delegate a un gate che, misura
  // alla mano, non le guardava. Vengono DOPO i passi che leggono l'HTML e PRIMA
  // del `perimetro`, che confronta il dichiarato con lo stato di questi passi.
  favicon: "favicon",
  openGraph: "open-graph",
  datiStrutturati: "dati-strutturati",
  sitemap: "sitemap-xml",
  robots: "robots-txt",
  perimetro: "perimetro",
  uscita: "contratto-uscita",
});

export const CONTRATTO_JSON = 1;
export const MAX_PAGINE = 60;
/**
 * Ogni richiesta ha un tempo massimo, e non e' pedanteria: un gate senza
 * timeout, davanti a un server che accetta la connessione e non risponde, non
 * e' ne' verde ne' rosso — e' appeso, e chi lo guarda non sa se sta lavorando.
 * E' il punto aperto n°6 dello `STATO.md` di vetrina-crafter, chiuso qui alla
 * nascita invece che dopo.
 */
export const ATTESA_MS = 15000;

/**
 * Il tetto sui byte di una singola risposta.
 *
 * `MAX_PAGINE` limitava quante pagine si camminano e niente limitava **quanto
 * grande** fosse una pagina: il tribunale l'ha chiamato «il moltiplicatore di
 * ogni altra misura», ed e' esatto — ogni costo per carattere di questo gate si
 * moltiplica per una dimensione che decide chi viene misurato. Il collaudo P2
 * aveva gia' misurato un corpo da 900 MB: 31 secondi e un `block` onesto, ma 31
 * secondi comprati con la banda di chi si difende.
 *
 * 8 MB e' molto piu' di qualunque pagina o bundle vero (il pilota sta sotto i
 * 300 KB per pagina). Un corpo piu' grande non e' un errore di rete: e' un
 * fatto misurato, e produce un rilievo, non un silenzio.
 */
export const MAX_CORPO = 8 * 1024 * 1024;

/**
 * **La scadenza complessiva, e il numero non e' tondo per caso.**
 *
 * Il timeout per richiesta funziona — misurato: un server che scrive un byte al
 * secondo e non chiude mai costa 30,8 s e produce un `block` onesto. Ma 60
 * pagine ostili sono mezz'ora **senza verdetto**, e in CI il lavoro viene ucciso
 * dal proprio timeout prima di produrne uno. Un gate ucciso e' il MANCANTE
 * peggiore che esista: un silenzio che nessuno ha scritto.
 *
 * Il default e' estrapolato da una misura, non scelto perche' suona bene. Il
 * banco «studio legale» il 2026-08-06, con i quattordici passi:
 *
 *   ritardo per risposta   0 ms    25 ms   50 ms   100 ms   200 ms
 *   giro completo          298 ms  859 ms  1419 ms 2356 ms  4334 ms
 *   richieste                                                    19
 *
 * La pendenza e' **20,2 ms per ogni ms di ritardo**, cioe' le 19 richieste sono
 * in pratica seriali: il costo di un giro e' `avvio + richieste × (locale + RTT)`.
 * Le richieste sono ~1,9 per pagina su questo banco, e su un sito Next con un
 * pezzo di codice per rotta arrivano a ~2 per pagina: al tetto documentato
 * (`MAX_PAGINE` = 60) fanno **circa 126 richieste**.
 *
 *   RTT 1 ms (locale)    126 × ~16 ms  ≈   2 s
 *   RTT 200 ms           126 × 215 ms  ≈  27 s
 *   RTT 500 ms           126 × 515 ms  ≈  65 s
 *   RTT 1 s (pessimo)    126 × 1015 ms ≈ 128 s
 *
 * **300 secondi** stanno 2,3 volte sopra il caso sano peggiore e tagliano il
 * caso patologico da mezz'ora a cinque minuti. Il pilota, per confronto, gira in
 * 356-584 ms su 6 pagine.
 *
 * Chi ha un sito piu' grande alza il numero **e lo scrive**: alzarlo e' una
 * decisione, lasciarlo scadere in silenzio no.
 */
export const SCADENZA_S = 300;

/**
 * Il momento oltre il quale il gate smette di misurare e va a stampare.
 * Vive qui e non in `ctx` perche' `preleva` deve poterlo leggere per accorciare
 * l'attesa dell'ultima richiesta: scadere non deve costare altri 15 secondi.
 */
let FINE = Infinity;
/**
 * Che la scadenza sia stata **vista** e' un fatto del giro, non di un passo: va
 * nel `--json` perche' un consumatore possa distinguere «rosso perche' il sito
 * e' rotto» da «rosso perche' il gate non ha fatto in tempo» senza leggere la
 * prosa. Misurato: senza questo flag, una richiesta accorciata dalla scadenza
 * falliva e il passo la raccontava come un intoppo di rete.
 */
let SCADUTA_VISTA = false;
const rimasto = () => Math.max(0, FINE - Date.now());
const scaduta = () => {
  const si = Date.now() >= FINE;
  if (si) SCADUTA_VISTA = true;
  return si;
};

const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

const leggiSeCe = (relativo) => {
  const pieno = join(PROGETTO, relativo);
  if (!existsSync(pieno)) return null;
  try {
    return readFileSync(pieno, "utf8");
  } catch {
    // Un percorso che esiste ma non si legge (una cartella, `EACCES`) non deve
    // far esplodere il gate: `EISDIR` su una cella scritta male del certificato
    // lo faceva uscire **1 con stdout vuoto**, che chi guarda il codice
    // d'uscita legge come «gate rosso».
    return null;
  }
};

/**
 * Come `leggiSeCe`, ma **solo dentro il progetto**.
 *
 * La colonna «dove è dichiarato» del certificato e' testo scritto da chi compila
 * il documento, e finiva dritta in `join(PROGETTO, …)`: con `../../…` si usciva
 * dalla radice. Misurato dal tribunale: una riga
 * `| sitemap | speed-demon | ../../WebGun/agenti/speed-demon/SKILL.md |`
 * superava sia «il file esiste» sia «nomina la voce», perche' quel documento la
 * nomina davvero — e con un solo file di regia scelto bene si facevano passare
 * TUTTE le voci delegate senza che il progetto contenesse una riga a riguardo.
 * Il passo che questa skill esiste per produrre si soddisfaceva col file di un
 * altro repo.
 */
const leggiDentroIlProgetto = (relativo) => {
  const pieno = resolve(PROGETTO, String(relativo ?? ""));
  const radice = resolve(PROGETTO);
  if (pieno !== radice && !pieno.startsWith(radice + sep)) return null;
  if (!existsSync(pieno) || !statSync(pieno).isFile()) return null;
  // Il confine era sulla STRINGA, e una stringa non e' un filesystem. Il
  // tribunale del 2026-08-06 l'ha aperto con una **junction NTFS** — che su
  // Windows si crea senza privilegi — dentro `docs/`: la riga
  // `| canonical | speed-demon | docs/out/canonical.md | delegato |` non
  // contiene nessun `..`, non e' assoluta, non ha niente di sospetto, e un
  // revisore umano la approva a colpo d'occhio. Il file letto stava fuori dal
  // progetto, ed era di nuovo «un file di regia scelto bene fa passare tutte le
  // voci delegate»: il difetto che questa funzione esiste per chiudere, in una
  // forma che nessuna ispezione del certificato puo' vedere.
  //
  // `realpathSync` scioglie la junction — e' lo stesso rimedio che questo file
  // usa gia' per riconoscere se stesso quando lo si invoca dalla junction della
  // regia.
  try {
    const vero = realpathSync(pieno);
    const radiceVera = realpathSync(radice);
    if (vero !== radiceVera && !vero.startsWith(radiceVera + sep)) return null;
  } catch {
    return null;
  }
  try {
    return readFileSync(pieno, "utf8");
  } catch {
    return null;
  }
};

/**
 * Una GET che non esplode: `{ stato, corpo, intestazioni, cookie }` o `null`.
 * Due tentativi, come nel gate di speed-demon e per lo stesso motivo misurato:
 * un intoppo di rete non deve trasformarsi in un rilievo sul sito.
 */
async function preleva(url, { tentativi = 2, segui = false, attesa = ATTESA_MS } = {}) {
  for (let i = 0; i < tentativi; i++) {
    // L'attesa non supera mai il tempo che resta: scaduta la scadenza, il gate
    // deve andare a stampare, non regalare altri 15 secondi a chi lo sta
    // facendo aspettare. Un solo millisecondo di margine, cosi' `AbortSignal`
    // non riceve mai uno zero.
    const quanto = Math.max(1, Math.min(attesa, rimasto()));
    try {
      const r = await fetch(url, { redirect: segui ? "follow" : "manual", signal: AbortSignal.timeout(quanto) });
      // Si legge a pezzi e si conta: `r.text()` bufferizza tutto quello che il
      // server vuole mandare, e con 900 MB il gate paga banda e memoria di chi
      // sta misurando. Un corpo oltre il tetto NON diventa un corpo troncato che
      // si analizza lo stesso — sarebbe un documento amputato, cioe' la classe
      // di falso verde piu' costosa di questa skill: si dichiara `troppoGrande`
      // e chi lo consuma lo tratta come non letto.
      let corpo = "";
      let troppoGrande = false;
      if (r.body) {
        const decodificatore = new TextDecoder();
        let byte = 0;
        for await (const pezzo of r.body) {
          byte += pezzo.byteLength ?? pezzo.length ?? 0;
          if (byte > MAX_CORPO) { troppoGrande = true; break; }
          corpo += decodificatore.decode(pezzo, { stream: true });
        }
        if (!troppoGrande) corpo += decodificatore.decode();
        else { try { await r.body.cancel(); } catch { /* gia' chiuso */ } }
      } else {
        corpo = await r.text();
        troppoGrande = corpo.length > MAX_CORPO;
      }
      // I cookie si leggono SOLO con `getSetCookie()`. La ricaduta su
      // `get("set-cookie")` sembrava prudenza ed era un buco: quel metodo
      // restituisce le intestazioni FUSE con una virgola, e una virgola dentro
      // un `Expires=Wed, 09 Jun 2027` e' indistinguibile da un separatore.
      // Misurato dal tribunale: due `Set-Cookie` veri — uno di sessione
      // dichiarato e uno di tracciamento no — diventavano una stringa sola, e
      // `nomeCookie` ne leggeva il primo nome. Il secondo cookie spariva e il
      // passo chiudeva `pass`. Non e' raggiungibile sui due motori di questa
      // casa (Node 20.12.2 e 24.18.1 ce l'hanno entrambi), ma «oggi non si
      // raggiunge» non e' una difesa: senza il metodo, i cookie NON si sanno
      // leggere, e il passo che li misura deve dirlo invece di indovinare.
      const leggibili = typeof r.headers.getSetCookie === "function";
      return {
        stato: r.status,
        corpo: troppoGrande ? "" : corpo,
        troppoGrande,
        intestazioni: r.headers,
        cookie: leggibili ? r.headers.getSetCookie() : [],
        cookieLeggibili: leggibili,
        url: r.url || url,
      };
    } catch {
      // Scaduta la scadenza non si ritenta: il secondo tentativo servirebbe a
      // distinguere un intoppo di rete da un difetto del sito, e quella
      // distinzione non si fa piu' in tempo per entrare nel verdetto.
      if (i === tentativi - 1 || scaduta()) return null;
      await new Promise((ok) => setTimeout(ok, 500));
    }
  }
  return null;
}

const unisci = (base, percorso) => new URL(percorso, base).toString();

/**
 * Il nome di un cookie da una riga `Set-Cookie`, oppure `null` se non e' un
 * cookie.
 *
 * `split("=")[0]` da solo produceva nomi inventati: `Set-Cookie: HttpOnly`
 * diventava un cookie di nome «HttpOnly», e `Set-Cookie: Path=/x; Secure` un
 * cookie di nome «Path». Il rilievo restava un bloccante — direzione sicura —
 * ma citava un oggetto che non esiste, e chi legge il verbale rischia di
 * dichiarare nel certificato una riga fantasma per far tacere il gate.
 */
const ATTRIBUTI_COOKIE = new Set(["path", "domain", "expires", "max-age", "secure", "httponly", "samesite", "partitioned", "priority"]);
const nomeCookie = (riga) => {
  const primo = String(riga).split(";")[0];
  if (!primo.includes("=")) return null;
  const nome = primo.split("=")[0].trim();
  if (!nome || ATTRIBUTI_COOKIE.has(nome.toLowerCase())) return null;
  return nome;
};

/**
 * La superficie e' utilizzabile? E se no, perche'?
 *
 * `if (!ctx.pagine)` NON basta, ed era un difetto vero: `![]` e' `false`, quindi
 * una superficie **vuota** superava la guardia e tre passi chiudevano su zero
 * pagine — `accessibilita-servita` `pass` («nessun rilievo» su niente),
 * `dati-raccolti` e `lingua-e-hreflang` `n/a` con una premessa che stampava «di
 * 0 pagine ()». Tre verdi su una misura che non c'era, e poi usati come verita'
 * nel confronto §19 del `perimetro`.
 */
const superficieUsabile = (ctx) => Array.isArray(ctx.pagine) && ctx.pagine.length > 0;
const motivoSuperficie = (ctx) =>
  ctx.pagine === null
    ? "superficie non stabilita: il passo `superficie-pubblica` non ha potuto identificare l'app, e leggere l'HTML di un'altra applicazione sarebbe il falso verde piu' costoso di tutti"
    : "superficie VUOTA: zero pagine lette. Non e' «un sito senza pagine», e' una camminata che non ha camminato — e un `pass` qui direbbe qualcosa su un sito che il gate non ha guardato";

/**
 * **La superficie e' COMPLETA?** — che e' una domanda diversa da «esiste?».
 *
 * `superficieUsabile` dice che qualche pagina e' stata letta. I passi 3-7
 * dichiarano per contratto una premessa piu' forte — «HTML di **ogni** pagina
 * letto», «ogni pagina **e ogni bundle** scaricati», «ogni pagina scoperta» — e
 * non la controllavano: le pagine non scaricate sparivano dal denominatore
 * invece di rendere il passo MANCANTE. Il tribunale l'ha misurato con una sola
 * pagina che chiude il socket, e quella pagina era l'unica col modulo:
 * `dati-raccolti` chiudeva `n/a` — «il sito non chiede niente a chi lo visita» —
 * e `accessibilita-servita` `pass`. Il gate restava rosso per il passo 2, ma i
 * singoli stati finiscono in `statiPassi`, e il confronto §19 del `perimetro`
 * accettava nel certificato firmato `basi-giuridiche: non applicabile`. Cioe' un
 * BUCO DI MISURA promosso a dichiarazione.
 *
 * Vale identico per la camminata troncata da `--max-pagine`.
 */
/**
 * Il motivo di un MANCANTE per scadenza, **col conteggio di cio' che si e'
 * guardato**. Senza il conteggio sarebbe «non ho finito», che e' vero e inutile:
 * chi legge deve poter decidere se alzare `--scadenza` o se il sito e' ostile.
 */
const motivoScadenza = (ctx, args, inizio, cosa) => {
  const secondi = Math.round((Date.now() - inizio) / 1000);
  const lette = Array.isArray(ctx.pagine) ? ctx.pagine.length : 0;
  const scoperte = lette + (ctx.nonLette?.length ?? 0) + (ctx.rimandi?.size ?? 0);
  return `SCADENZA di ${args.scadenza}s superata dopo ${secondi}s: questo passo ${cosa}.\n`
    + `Quando il tempo e' finito la camminata aveva letto ${lette} pagine su ${scoperte} scoperte`
    + `${ctx.baseUrl ? ` di ${ctx.baseUrl}` : ""}. Alza \`--scadenza\` se il sito e' grande, o guarda perche' e' lento: `
    + "un passo non eseguito e' una verifica MANCANTE, e tiene il gate rosso.";
};

const superficieCompleta = (ctx) => superficieUsabile(ctx) && !ctx.troncata && !ctx.scaduta && (ctx.nonLette ?? []).length === 0;
const motivoIncompleta = (ctx) => {
  if (!superficieUsabile(ctx)) return motivoSuperficie(ctx);
  if (ctx.scaduta) {
    return `camminata interrotta dalla SCADENZA dopo ${ctx.pagine.length} pagine: il resto del sito non e' stato guardato, e questo passo non puo' concludere niente — un passo che conclude su meta' superficie e' un passo che dice una cosa che non ha misurato`;
  }
  if (ctx.troncata) {
    return `camminata TRONCATA a ${ctx.pagine.length} pagine (--max-pagine): il resto del sito non e' stato guardato, e questo passo non puo' concludere niente sul sito — solo sul troncone`;
  }
  return `${ctx.nonLette.length} pagine scoperte e NON scaricate (${ctx.nonLette.join(", ")}): una pagina non letta non e' una pagina pulita, e questo passo dichiara di guardarle tutte`;
};

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
        // Se la scadenza e' passata, la colpa non e' della rete ed e' sbagliato
        // raccontarla cosi': un rilievo che punta all'imputato sbagliato manda a
        // cercare a vuoto, ed e' un difetto che questa casa ha gia' pagato.
        return record(this.id, this.nome, "skipped", scaduta()
          ? motivoScadenza(ctx, args, ctx.inizio, "non ha ricevuto risposta entro il tempo che restava")
          : `nessuna risposta da ${args.url}: avvia la build con \`npm run build && npm run start\` prima del gate. Si certifica cio' che si pubblica, e per certificarlo bisogna poterlo leggere`);
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
      // La RADICE puo' rimandare, ed e' normale: un middleware multilingua manda
      // `/` a `/it`, e cosi' fanno le regole www/barra-finale. Se la si trattasse
      // come tutte le altre — rimando registrato, non ci si entra — il grafo non
      // avrebbe la chiave `/`, la camminata partirebbe da un nodo che non c'e' e
      // la sorgente «collegamenti» uscirebbe VUOTA su un sito perfettamente
      // collegato: con la sitemap, un `block` con la diagnosi sbagliata; senza,
      // zero pagine e tre passi verdi sul nulla. Il rimando della sola radice si
      // segue, e la camminata parte da dove si e' arrivati.
      const radicePercorso = percorsoInterno(radice.url ?? args.url, args.url) ?? "/";
      const daVedere = [radicePercorso, ...daSitemap];
      const viste = new Map();
      const rimandi = new Map();
      const grafo = new Map();
      let troncata = false;
      const cookieVisti = [];
      let perScadenza = false;
      while (daVedere.length > 0) {
        if (viste.size >= args.maxPagine) { troncata = true; break; }
        if (scaduta()) { perScadenza = true; break; }
        const percorso = daVedere.shift();
        if (viste.has(percorso) || rimandi.has(percorso)) continue;
        const r = await preleva(unisci(args.url, percorso));
        // Un corpo oltre il tetto e' una pagina NON LETTA, non una pagina
        // vuota: analizzarne meta' sarebbe l'amputazione del documento, che e'
        // la classe di falso verde piu' costosa di questa skill.
        if (!r || r.troppoGrande) {
          viste.set(percorso, null);
          if (r?.troppoGrande) rimandi.set(percorso, `corpo oltre ${Math.round(MAX_CORPO / 1024 / 1024)} MB: non letto`);
          continue;
        }
        // Le intestazioni `Set-Cookie` sono un fatto misurato anche quando non si
        // entra nella pagina: un cookie posto SUL RIMANDO (di sessione, di
        // lingua) sparirebbe del tutto se lo si buttasse insieme alla risposta.
        for (const riga of r.cookie) cookieVisti.push({ riga, percorso });
        if (r.stato >= 300 && r.stato < 400) { rimandi.set(percorso, r.intestazioni.get("location")); continue; }
        if (r.stato >= 400) { rimandi.set(percorso, `HTTP ${r.stato}`); continue; }
        viste.set(percorso, r);
        const uscenti = collegamentiInterni(r.corpo, args.url);
        grafo.set(percorso, uscenti);
        for (const p of uscenti) if (!viste.has(p) && !rimandi.has(p)) daVedere.push(p);
      }
      // La sorgente «collegamenti» si calcola SUL GRAFO, partendo dalla radice:
      // la sitemap ha fatto da seme allo scarico, non deve fare da seme alla
      // scoperta. Vedi `raggiungibiliDaCollegamenti`.
      const daCollegamenti = raggiungibiliDaCollegamenti(grafo, radicePercorso);

      ctx.baseUrl = args.url;
      ctx.buildId = buildId;
      ctx.pagine = [...viste].filter(([, r]) => r !== null).map(([percorso, r]) => ({ percorso, ...r }));
      ctx.nonLette = [...viste].filter(([, r]) => r === null).map(([p]) => p);
      ctx.troncata = troncata;
      ctx.scaduta = perScadenza;
      ctx.rimandi = rimandi;
      ctx.cookie = cookieVisti;

      const findings = findingsSuperficie({
        daCollegamenti: daCollegamenti.filter((p) => viste.has(p)),
        daSitemap,
        // La superficie dichiarata arriva grezza dalla cella di una tabella; il
        // misurato e' passato da `percorsoInterno`. Senza normalizzare, una
        // barra finale produce DUE rilievi sulla stessa pagina — «dichiarata e
        // non raggiungibile» e «raggiungibile e non dichiarata» — cioe' un
        // bloccante nato da un dettaglio di formattazione.
        dichiarate: (ctx.certificato?.superficie ?? []).map((p) => percorsoInterno(p, args.url) ?? p),
        superficieDichiarata: ctx.certificato ? ctx.certificato.superficieDichiarata : null,
        sitemapLetta,
      });
      if (identita.stato !== "pass") {
        findings.push({ severity: "block", object: "identita' dell'app", message: identita.diagnosi });
      }
      if (troncata) {
        findings.push({ severity: "block", object: "superficie", message: `camminata interrotta a ${args.maxPagine} pagine (--max-pagine): il resto del sito NON e' stato guardato, e un certificato parziale non deve somigliare a uno completo` });
      }
      if (perScadenza) {
        findings.push({ severity: "block", object: "superficie", message: `camminata interrotta dalla SCADENZA (--scadenza ${args.scadenza}s) dopo ${viste.size} pagine, con ${daVedere.length} ancora da vedere: il resto del sito non e' stato guardato` });
      }
      if (ctx.nonLette.length > 0) {
        findings.push({ severity: "block", object: "superficie", message: `${ctx.nonLette.length} pagine non scaricate: ${ctx.nonLette.join(", ")}` });
      }
      if (ctx.pagine.length === 0) {
        findings.push({ severity: "block", object: "superficie", message: "zero pagine lette: non c'e' nessuna superficie da certificare, e tutti i passi che la consumano restano MANCANTI" });
      }
      const dettaglio = [
        `identita': ${identita.stato === "pass" ? identita.diagnosi : "NON confermata dal build id (vedi sotto)"} · ${ctx.pagine.length} pagine lette · ${rimandi.size} rimandi o errori non seguiti`,
        `radice: ${radicePercorso}${radicePercorso === "/" ? "" : " (la radice rimanda, e il rimando e' stato seguito)"}`,
        `sorgenti: collegamenti da ${radicePercorso} (${daCollegamenti.length}) · sitemap.xml ${sitemapLetta ? `(${daSitemap.length})` : "NON LETTA"}`,
        `superficie: ${ctx.pagine.map((p) => p.percorso).join(" ")}`,
        rimandi.size > 0 ? `non entrate: ${[...rimandi].map(([p, d]) => `${p} → ${perStampa(d, 120)}`).join(" · ")}` : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      // La camminata interrotta dalla SCADENZA e' una verifica NON FATTA, non un
      // difetto del sito: `skipped`, non `fail`. La differenza conta per chi
      // legge — un `fail` accusa l'imputato, un `skipped` accusa il tempo che
      // gli abbiamo dato. I rilievi trovati sulle pagine che si e' fatto in
      // tempo a leggere restano stampati: sono misure vere.
      // `--max-pagine` invece resta un `fail`, ed e' voluto: li' il tetto l'ha
      // scelto chi lancia il gate, e un troncone dichiarato completo sarebbe la
      // sua responsabilita'.
      return record(this.id, this.nome, perScadenza ? "skipped" : statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.informativa,
    nome: "informativa privacy raggiungibile",
    async esegui(ctx, args) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const conCandidati = ctx.pagine.map((p) => ({ percorso: p.percorso, candidati: candidatiInformativa(p.corpo, ctx.baseUrl) }));
      const peso = new Map();
      for (const p of conCandidati) {
        for (const c of p.candidati) peso.set(c.percorso, (peso.get(c.percorso) ?? 0) + c.peso);
      }
      // SI SCARICANO TUTTI I CANDIDATI, non solo il piu' collegato. Con un solo
      // scarico bastava un'esca — un collegamento in piu' verso una pagina che
      // contiene le sette voci — per rendere verde un sito il cui collegamento
      // VISIBILE porta a un 404: quello nessuno lo scaricava (SD-VERDE-04).
      const esiti = [];
      for (const [percorso] of [...peso].sort((a, b) => b[1] - a[1])) {
        if (scaduta()) {
          return record(this.id, this.nome, "skipped",
            motivoScadenza(ctx, args, ctx.inizio, `si e' fermato dopo ${esiti.length} candidati su ${peso.size}`));
        }
        const gia = ctx.pagine.find((p) => p.percorso === percorso);
        const r = gia ?? (await preleva(unisci(ctx.baseUrl, percorso)));
        if (!r) {
          return record(this.id, this.nome, "skipped", `le pagine rimandano a ${percorso} e non si e' riusciti a scaricarlo: la verifica non e' stata fatta, non e' fallita`);
        }
        esiti.push({ percorso, stato: r.stato, corpo: r.corpo, peso: peso.get(percorso) });
      }
      const scelto = esiti[0] ?? null;
      ctx.informativaRaggiungibile = new Set(
        conCandidati.filter((p) => p.candidati.length > 0).map((p) => p.percorso),
      );

      const findings = findingsInformativa({
        pagine: conCandidati,
        informativa: scelto ? { percorso: scelto.percorso, stato: scelto.stato } : null,
        htmlInformativa: scelto?.corpo ?? null,
        dichiarata: ctx.certificato?.informativa ?? null,
      });
      // Ogni ALTRO candidato che non risponde e' un bloccante a se': un
      // collegamento che una persona clicca e trova un 404 non e' un dettaglio,
      // ed e' proprio il caso che l'esca sfruttava.
      for (const altro of esiti.slice(1)) {
        if (altro.stato >= 400) {
          findings.push({ severity: "block", object: altro.percorso, message: `collegamento a un'informativa che risponde HTTP ${altro.stato}: chi lo segue crede di aver letto qualcosa` });
        }
      }
      if (esiti.length > 1) {
        findings.push({ severity: "issue", object: "informativa", message: `${esiti.length} collegamenti diversi sembrano portare a un'informativa (${esiti.map((e) => `${e.percorso} HTTP ${e.stato}`).join(" · ")}): quale sia quella buona lo dice una persona` });
      }
      const dettaglio = [
        scelto
          ? `informativa: ${scelto.percorso} (HTTP ${scelto.stato}) · ${esiti.length} candidati scaricati · collegata da ${ctx.informativaRaggiungibile.size} pagine su ${conCandidati.length}`
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
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      // `null` vuol dire «il passo precedente non ha potuto misurare», e non e'
      // la stessa cosa di «misurato: nessuna pagina rimanda». Con un `?? new Set()`
      // un intoppo di rete su una richiesta produceva il bloccante piu' grave di
      // questo gate — «raccoglie dati personali e non rimanda a nessuna
      // informativa» — su un sito che rimanda correttamente.
      if (ctx.informativaRaggiungibile === null) {
        return record(this.id, this.nome, "skipped",
          "il passo `informativa-privacy` non ha potuto stabilire quali pagine rimandano all'informativa: senza, «non rimanda» e «non ho guardato» sarebbero la stessa frase");
      }
      const pagineConModuli = ctx.pagine
        .map((p) => ({ percorso: p.percorso, moduli: moduliDiPagina(p.corpo), campi: campiDiPagina(p.corpo), destinazioni: destinazioniModuli(p.corpo, ctx.baseUrl) }))
        .filter((p) => p.moduli > 0 || p.campi.length > 0);
      const campiTotali = pagineConModuli.reduce((n, p) => n + p.campi.length, 0);

      if (pagineConModuli.length === 0) {
        const premessa = `zero moduli e zero campi nell'HTML servito di ${ctx.pagine.length} pagine (${ctx.pagine.map((p) => p.percorso).join(" ")})`;
        // La conclusione dice cio' che la premessa sostiene, e non una parola di
        // piu'. Prima diceva «il sito non chiede niente a chi lo visita»: e' una
        // frase sul SITO costruita su una misura fatta sulle PAGINE RAGGIUNTE, e
        // una pagina che nessuno linka e che la sitemap non dichiara non entra
        // nel giro — sta scritto in SKILL.md, ma il gate lo dimenticava proprio
        // nella riga che una persona legge. Il tribunale l'ha misurato su un
        // sito con `/contatti` non linkata: nome, email e telefono se ne andavano
        // a un terzo, e il gate stampava quella frase.
        return record(this.id, this.nome, statoNonApplicabile(premessa, ctx.pagine.length),
          `${premessa}\nNON APPLICABILE: nessuna delle ${ctx.pagine.length} pagine raggiunte chiede niente a chi lo visita. Una pagina che nessuno linka e che la sitemap non dichiara non entra in questo conto, e un modulo costruito nel browser dopo il caricamento qui non si vede — vedi SKILL.md §Cosa un gate verde NON prova.`);
      }
      const findings = findingsDatiRaccolti({
        pagineConModuli,
        basiDichiarate: ctx.certificato?.datiRaccolti ?? [],
        informativaRaggiungibile: ctx.informativaRaggiungibile,
        superficie: new Set(ctx.pagine.map((p) => p.percorso)),
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
    async esegui(ctx, args) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      // I cookie vengono dalla camminata, non dalle sole pagine entrate: un
      // `Set-Cookie` posto su un RIMANDO e' un cookie posto (vedi passo 2).
      const cookie = (ctx.cookie ?? [])
        .map((c) => ({ nome: nomeCookie(c.riga), percorso: c.percorso, riga: c.riga }))
        .filter((c) => c.nome !== null);
      const malformati = (ctx.cookie ?? []).filter((c) => nomeCookie(c.riga) === null);
      const archiviazioni = [];
      const terziMappa = new Map();
      const bundleVisti = new Map();
      const bundleFalliti = [];
      const bundleVuoti = [];
      const bundleIncerti = [];
      let bundleLetti = 0;
      let inlineLetti = 0;
      // Se il motore JS non sa leggere i `Set-Cookie`, il passo non lo sa e
      // basta: non c'e' niente da concludere su cio' che il sito archivia.
      if (ctx.pagine.some((p) => p.cookieLeggibili === false)) {
        return record(this.id, this.nome, "skipped",
          "questo motore JavaScript non espone `Headers.getSetCookie()`: i `Set-Cookie` non si possono leggere uno per uno, e leggerli fusi in una stringa sola ne farebbe sparire tutti tranne il primo.\n"
          + "Serve Node 18.14 o successivo. La verifica non e' stata fatta.");
      }

      for (const pagina of ctx.pagine) {
        for (const t of terziDi(pagina.corpo, ctx.baseUrl)) {
          if (!terziMappa.has(t.origine)) terziMappa.set(t.origine, t);
        }
        // GLI SCRIPT INLINE. Erano il buco piu' grosso di questo passo, e non era
        // dichiarato da nessuna parte: si scaricavano solo i `<script src=…>`,
        // quindi un sito che archivia da uno script scritto dentro la pagina —
        // il tema, il consenso, il carrello, uno snippet di analitica — chiudeva
        // `NON APPLICABILE` con la frase «il sito non mette niente nel browser di
        // chi passa». Il corpo era gia' in memoria: bastava guardarlo.
        for (const corpo of corpiInline(pagina.corpo)) {
          inlineLetti++;
          if (archiviazioneIncertaIn(corpo)) bundleIncerti.push(`${pagina.percorso} (script inline)`);
          for (const api of apiArchiviazioneIn(corpo)) {
            if (!archiviazioni.some((a) => a.api === api && a.percorso === pagina.percorso)) {
              archiviazioni.push({ api, percorso: pagina.percorso, bundle: "script inline" });
            }
          }
        }
        for (const src of sorgentiInterne(pagina.corpo, ctx.baseUrl)) {
          if (scaduta()) {
            return record(this.id, this.nome, "skipped",
              motivoScadenza(ctx, args, ctx.inizio, `si e' fermato dopo ${bundleLetti} script su almeno ${bundleVisti.size + 1}`));
          }
          if (!bundleVisti.has(src)) {
            const r = await preleva(unisci(ctx.baseUrl, src), { segui: true });
            if (!r || r.stato >= 400 || r.troppoGrande) { bundleFalliti.push(src); bundleVisti.set(src, null); continue; }
            // **Un corpo vuoto non e' un bundle letto.** L'invariante scritta
            // qui sotto — «un bundle non letto non e' un bundle pulito» — era
            // fatta rispettare solo sul FALLIMENTO DI RETE, non sull'integrita'
            // del contenuto: un `204`, o un `200` con zero byte (una cache che
            // tronca, un proxy, un server che fa cloaking sul fetch del gate)
            // veniva contato fra gli «script letti per intero» e il passo
            // chiudeva `n/a` con la premessa che stampa quel numero. Misurato
            // dal tribunale servendo `/app.js` con `204` e nessun corpo.
            if (r.corpo.trim() === "") { bundleVuoti.push(src); bundleVisti.set(src, null); continue; }
            bundleLetti++;
            // Un `Set-Cookie` sulla risposta di un BUNDLE e' un cookie posto a
            // chi visita esattamente come quello del documento: il browser lo
            // scarica da solo, senza che nessuno faccia niente. Si guardavano
            // solo le risposte delle pagine, e il collaudo P2 ha misurato che
            // spostare il cookie sulla sottorisorsa lo faceva sparire — «0
            // cookie» su un sito che ne poneva uno a ogni pagina.
            for (const riga of r.cookie ?? []) {
              const nome = nomeCookie(riga);
              if (nome === null) malformati.push({ riga, percorso: `${pagina.percorso} → ${src}` });
              else cookie.push({ nome, percorso: `${pagina.percorso} → ${src}`, riga });
            }
            if (archiviazioneIncertaIn(r.corpo)) bundleIncerti.push(src);
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
      if (bundleFalliti.length > 0 || bundleVuoti.length > 0) {
        const righe = [];
        if (bundleFalliti.length > 0) righe.push(`${bundleFalliti.length} script serviti non scaricati (${bundleFalliti.slice(0, 5).join(", ")}${bundleFalliti.length > 5 ? " …" : ""})`);
        if (bundleVuoti.length > 0) righe.push(`${bundleVuoti.length} script scaricati con il CORPO VUOTO (${bundleVuoti.slice(0, 5).join(", ")}${bundleVuoti.length > 5 ? " …" : ""}): un 204, o un 200 senza byte, non e' uno script che non archivia — e' uno script che non abbiamo letto`);
        return record(this.id, this.nome, "skipped",
          `${righe.join("\n")}\nUn bundle non letto non e' un bundle pulito: la verifica non e' stata fatta.`);
      }
      // Un indizio di archiviazione che non nomina l'API per intero
      // (`window["local"+"Storage"]`) non e' una misura: e' un «non lo so», e la
      // §18 non ammette la misura incerta travestita da non applicabile.
      if (bundleIncerti.length > 0 && archiviazioni.length === 0) {
        return record(this.id, this.nome, "skipped",
          `${bundleIncerti.length} script serviti contengono indizi di archiviazione senza nominare l'API per intero (${bundleIncerti.slice(0, 5).join(", ")}${bundleIncerti.length > 5 ? " …" : ""}).\n`
          + "Questo gate legge nomi, non esegue codice: qui non sa dire se il sito archivia, e dire di no sarebbe una risposta che non ha misurato.");
      }

      const terzi = [...terziMappa.values()];
      if (cookie.length === 0 && archiviazioni.length === 0 && terzi.length === 0) {
        const premessa = `zero \`Set-Cookie\`, zero API di archiviazione e zero terzi su ${ctx.pagine.length} pagine, ${bundleLetti} script esterni e ${inlineLetti} script inline letti per intero`;
        const findings = ctx.certificato?.banner
          ? [{ severity: "issue", object: "consenso", message: "banner dichiarato e nessuna archiviazione misurata" }]
          : [];
        for (const m of malformati) {
          findings.push({ severity: "issue", object: m.percorso, message: `\`Set-Cookie\` non interpretabile come cookie: ${perStampa(m.riga, 120)}` });
        }
        // La riga «NON APPLICABILE» sta nel ramo che PRODUCE un `n/a`: con un
        // banner dichiarato lo stato e' `pass`, e stampare comunque quella frase
        // faceva leggere `OK` sopra una prosa che dice il contrario.
        const stato = findings.length > 0 ? "pass" : statoNonApplicabile(premessa, ctx.pagine.length);
        const conclusione = stato === "n/a"
          ? "NON APPLICABILE: nessuna delle pagine raggiunte mette niente nel browser di chi passa, quindi non c'e' niente da dichiarare e nessun banner da mostrare."
          : "nessuna archiviazione e nessun terzo misurati sulle pagine raggiunte; restano i rilievi qui sotto.";
        return record(this.id, this.nome, stato, `${premessa}\n${conclusione}\n${dettaglioFindings(findings)}`.trim());
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
        `${cookie.length} cookie · ${archiviazioni.length} usi di API di archiviazione · ${terzi.length} origini di terzi · ${bundleLetti} script esterni e ${inlineLetti} inline letti per intero`,
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
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
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
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
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

  // ══════════════════ le cinque voci tornate a casa — decisione D21 ══════════
  // Cinque passi e non uno solo, ed e' una decisione con la sua ragione: la
  // tabella di proprieta' assegna UNA voce a UN proprietario, e il confronto
  // §19 lega la riga del certificato allo stato del passo. Un passo unico
  // «indicizzazione» darebbe a cinque voci lo stesso `id`, cioe' rifarebbe al
  // contrario il difetto che questa skill esiste per chiudere.

  {
    id: ID.favicon,
    nome: "favicon: dichiarata e servita",
    async esegui(ctx, args) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const pagine = ctx.pagine.map((p) => ({ percorso: p.percorso, icone: iconeDichiarate(p.corpo, ctx.baseUrl) }));
      const tutte = [...new Set(pagine.flatMap((p) => p.icone))];
      const risposte = new Map();
      for (const url of tutte) {
        if (scaduta()) {
          return record(this.id, this.nome, "skipped",
            `${motivoScadenza(ctx, args, ctx.inizio, `si e' fermato dopo ${risposte.size} icone su ${tutte.length}`)}`);
        }
        const r = await preleva(url, { segui: true });
        risposte.set(url, r ? r.stato : null);
      }
      let predefinita = null;
      if (pagine.every((p) => p.icone.length === 0)) {
        const r = await preleva(unisci(ctx.baseUrl, "/favicon.ico"), { segui: true });
        predefinita = r ? r.stato : null;
      }
      const findings = findingsFavicon({ pagine, risposte, predefinita });
      const dettaglio = [
        `${tutte.length} icone dichiarate su ${pagine.length} pagine, ognuna scaricata: ${tutte.map((u) => `${u.replace(ctx.baseUrl, "")} → ${risposte.get(u) ?? "nessuna risposta"}`).join(" · ") || "nessuna"}`,
        predefinita !== null ? `nessuna icona dichiarata: \`/favicon.ico\` risponde ${predefinita}` : "",
        findings.length === 0 ? "ogni icona dichiarata risponde 200" : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.openGraph,
    nome: "Open Graph: l'anteprima che il sito sceglie",
    async esegui(ctx, args) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const pagine = ctx.pagine.map((p) => {
        const og = openGraphDi(p.corpo);
        let immagine = null;
        if (og["og:image"]) {
          try {
            immagine = new URL(og["og:image"], ctx.baseUrl).toString();
          } catch { immagine = null; }
        }
        return { percorso: p.percorso, og, immagine };
      });
      const immagini = [...new Set(pagine.map((p) => p.immagine).filter(Boolean))];
      const risposte = new Map();
      for (const url of immagini) {
        if (scaduta()) {
          return record(this.id, this.nome, "skipped",
            motivoScadenza(ctx, args, ctx.inizio, `si e' fermato dopo ${risposte.size} immagini di anteprima su ${immagini.length}`));
        }
        const r = await preleva(url, { segui: true });
        risposte.set(url, r ? r.stato : null);
      }
      const findings = findingsOpenGraph({ pagine, risposte });
      const conOg = pagine.filter((p) => Object.keys(p.og).length > 0).length;
      const dettaglio = [
        `${conOg} pagine su ${pagine.length} dichiarano l'Open Graph · ${immagini.length} immagini di anteprima scaricate`,
        immagini.length > 0 ? `og:image: ${immagini.map((u) => `${u.replace(ctx.baseUrl, "")} → ${risposte.get(u) ?? "nessuna risposta"}`).join(" · ")}` : "",
        findings.length === 0 ? "ogni pagina dichiara l'anteprima, e l'immagine promessa risponde" : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.datiStrutturati,
    nome: "dati strutturati (JSON-LD)",
    async esegui(ctx) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const pagine = ctx.pagine.map((p) => ({ percorso: p.percorso, jsonld: blocchiJsonLd(p.corpo) }));
      const totale = pagine.reduce((n, p) => n + p.jsonld.length, 0);
      const findings = findingsDatiStrutturati({ pagine });
      const dettaglio = [
        `${totale} blocchi \`application/ld+json\` su ${pagine.length} pagine, ognuno interpretato come JSON`,
        totale > 0 && findings.length === 0 ? "ogni blocco e' JSON valido e dichiara un `@type`" : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.sitemap,
    nome: "sitemap.xml: la promessa fatta ai motori",
    async esegui(ctx) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const risposta = await preleva(unisci(ctx.baseUrl, "/sitemap.xml"), { segui: true });
      const percorsi = risposta && risposta.stato === 200 ? percorsiDaSitemap(risposta.corpo, ctx.baseUrl) : [];
      ctx.inSitemap = new Set(percorsi);
      const findings = findingsSitemap({
        risposta,
        percorsi,
        superficie: new Set(ctx.pagine.map((p) => p.percorso)),
        rimandi: ctx.rimandi ?? new Map(),
      });
      const dettaglio = [
        `\`/sitemap.xml\` → ${risposta ? `HTTP ${risposta.stato}` : "nessuna risposta"} · ${percorsi.length} indirizzi dichiarati, confrontati con le ${ctx.pagine.length} pagine servite`,
        findings.length === 0 ? "ogni indirizzo dichiarato nella sitemap e' servito" : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
    },
  },

  {
    id: ID.robots,
    nome: "robots.txt: cosa il sito ammette",
    async esegui(ctx) {
      if (!superficieCompleta(ctx)) return record(this.id, this.nome, "skipped", motivoIncompleta(ctx));
      const risposta = await preleva(unisci(ctx.baseUrl, "/robots.txt"), { segui: true });
      const robots = leggiRobots(risposta && risposta.stato === 200 ? risposta.corpo : "");
      const findings = findingsRobots({
        risposta,
        robots,
        superficie: new Set(ctx.pagine.map((p) => p.percorso)),
        inSitemap: ctx.inSitemap ?? new Set(),
        base: ctx.baseUrl,
      });
      const dettaglio = [
        `\`/robots.txt\` → ${risposta ? `HTTP ${risposta.stato}` : "nessuna risposta"} · ${robots.gruppi.length} gruppi di regole · ${robots.sitemap.length} righe \`Sitemap:\``,
        `confrontato con la superficie camminata (${ctx.pagine.length} pagine) e con la sitemap (${(ctx.inSitemap ?? new Set()).size} indirizzi)`,
        findings.length === 0 ? "niente di cio' che il sito pubblicizza e' vietato ai motori" : "",
        dettaglioFindings(findings),
      ].filter(Boolean).join("\n");
      return record(this.id, this.nome, statoDaFindings(findings), dettaglio);
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
        leggiFile: (percorso) => leggiDentroIlProgetto(percorso),
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
      const trovato = trovaHandoff();
      const percorso = typeof trovato === "string" ? trovato : trovato?.percorso ?? null;
      const testo = percorso ? leggiSeCe(percorso) : null;
      const findings = contrattoUscita(percorso ?? `${HANDOFF_DIR}/<n>-site-doctor.md`, testo, verdettoDa(steps));
      if (trovato && typeof trovato !== "string" && trovato.ambigui) {
        findings.push({
          severity: "block",
          object: HANDOFF_DIR,
          message: `${trovato.ambigui.length} handoff con lo stesso numero (${trovato.ambigui.join(", ")}): non c'e' un «ultimo», e chi viene dopo non sa quale ho letto`,
        });
      }
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
    // `existsSync` non distingue un file da una cartella, e `assetProvato` viene
    // dall'HTML SERVITO: con `<script src="/_next/static/chunks">` — e
    // `chunks` E' una cartella in ogni build Next — il `readFileSync` lanciava
    // `EISDIR`, il gate usciva **2** e azzerava i sette passi che non avevano
    // ancora girato, compresi quelli che non toccano la rete. Non e' un falso
    // verde: e' una negazione di misura, e si ottiene scrivendo un `src`.
    if (servito && servito.stato === 200 && existsSync(suDisco)) {
      try {
        assetIdentico = statSync(suDisco).isFile() && readFileSync(suDisco, "utf8") === servito.corpo;
      } catch {
        assetIdentico = false;
      }
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
/*
 * Due difetti in una riga sola, tutti e due misurati dal tribunale del
 * 2026-08-06, e tutti e due chiusi riusando gli scanner della lib invece di una
 * seconda regexp scritta qui:
 *
 *   1. **Backtracking catastrofico.** `[^>]*` prima, e un'alternativa
 *      `[^\s>]+` che si SOVRAPPONE a quella classe su ogni carattere: 4 KB
 *      costavano 1 s, 8 KB 8,3 s, 14 KB **44 s** — piu' che quadratico. Bastavano
 *      14 KB di `<script src="` senza `>` per far tacere il gate per sempre.
 *   2. La stessa cecita' del `>` dentro un attributo che `DENTRO_TAG` chiude
 *      altrove: `<script data-x="a>b" src="y">` non veniva letto.
 */
function sorgentiInterne(html, base) {
  const percorsi = new Set();
  for (const tag of tagDi(senzaScript(html), "script")) {
    const p = percorsoInternoConQuery(attributi(tag).src, base);
    if (p) percorsi.add(p);
  }
  return [...percorsi];
}

/**
 * I corpi degli script scritti DENTRO la pagina, senza `src`.
 *
 * Si scarta il carico RSC di Next (`self.__next_f.push(...)`): e' l'albero
 * serializzato della pagina, quindi contiene il TESTO del sito. Una pagina che
 * parla di `localStorage` in un articolo produrrebbe un bloccante su un sito che
 * non archivia niente — cioe' un rosso falso sulla stessa riga su cui abbiamo
 * appena chiuso un verde falso.
 *
 * **I corpi vengono da `ripulisciDocumento`, non da una seconda regexp.** Quella
 * di prima era una chiave universale da un carattere, misurata dal tribunale:
 *
 *     <div data-nota="<script src=/x.js>"></div>
 *     <script>localStorage.setItem('tracciato', '1');</script>
 *
 * il primo `<script` che la regexp trovava stava DENTRO un valore di attributo —
 * testo, per un browser — e il suo contenuto correva fino al `</script>` VERO,
 * inghiottendo lo script che archivia davvero; poi il `continue` su `src=`
 * buttava via tutto. Il passo chiudeva `n/a`: «il sito non mette niente nel
 * browser di chi passa», con la premessa che stampava «0 script inline letti per
 * intero». Lo scanner della lib tiene lo stato degli apici e i confini giusti li
 * conosce gia': qui non serviva un secondo parser, serviva usare il primo.
 */
function corpiInline(html) {
  return ripulisciDocumento(html).inline
    .filter(({ tag, corpo }) => !/\bsrc\s*=/i.test(tag) && !/self\.__next_f/.test(corpo) && corpo.trim())
    .map(({ corpo }) => corpo);
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

/**
 * L'ULTIMO handoff di questa skill, e «ultimo» vuol dire per NUMERO.
 *
 * `.sort()` ordina le stringhe carattere per carattere: `"1" < "9"`, quindi
 * `9-site-doctor.md` batteva `10-`, `11-`, `99-` per sempre. Il tribunale l'ha
 * riprodotto end-to-end — con un `9-` ben scritto accanto a un `10-` col
 * segnaposto e senza riga `Gate:`, il passo chiudeva **pass** citando il `9-`, e
 * il documento che il `CLAUDE.md` dice all'agente successivo di leggere non
 * veniva nemmeno aperto. In una catena con piu' di nove giri — cioe' questa —
 * ogni handoff nuovo diventava invisibile.
 *
 * Due file con lo stesso numero sono un fatto da dire, non da risolvere
 * indovinando: il consumatore a valle non saprebbe quale ha letto.
 */
function trovaHandoff() {
  const dir = join(PROGETTO, HANDOFF_DIR);
  if (!existsSync(dir)) return null;
  const nomi = readdirSync(dir).filter((n) => /-site-doctor\.md$/.test(n));
  if (nomi.length === 0) return null;
  const numerati = nomi.map((n) => ({ nome: n, numero: /^(\d+)-/.exec(n) ? Number(/^(\d+)-/.exec(n)[1]) : null }));
  const senzaNumero = numerati.filter((x) => x.numero === null);
  const conNumero = numerati.filter((x) => x.numero !== null).sort((a, b) => a.numero - b.numero);
  if (conNumero.length === 0) return `${HANDOFF_DIR}/${senzaNumero.sort((a, b) => a.nome.localeCompare(b.nome)).pop().nome}`;
  const ultimo = conNumero[conNumero.length - 1];
  const pari = conNumero.filter((x) => x.numero === ultimo.numero);
  return { percorso: `${HANDOFF_DIR}/${ultimo.nome}`, ambigui: pari.length > 1 ? pari.map((x) => x.nome) : null };
}

// ------------------------------------------------------------------- verdetto
export const STATI = Object.freeze(["pass", "fail", "skipped", "n/a"]);

/**
 * Il conteggio, e il suo invariante.
 *
 * `ignoti` esiste perche' senza di lui uno stato scritto male — `"skip"`,
 * `"Fail"`, `"n/a "` con lo spazio — non sarebbe contato ne' fra i falliti ne'
 * fra i mancanti, e il gate uscirebbe **verde**. Un refuso di un carattere
 * trasformava questo gate in un timbro: la stampa lo vedeva (`"????"`), il
 * codice d'uscita no.
 */
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  const conosciuti = passi.filter((s) => STATI.includes(s.status)).length;
  return {
    passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped"), na: per("n/a"),
    ignoti: passi.length - conosciuti,
  };
}

function verdetto(json, args = {}, extra = {}) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0 && riassunto.ignoti === 0;
  const intestazione = `GATE CONFORMITA': ${verde ? "VERDE" : "ROSSO"} ` +
    `(${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti, ${riassunto.na} non applicabili su ${riassunto.passi} passi)` +
    (riassunto.ignoti > 0 ? ` · ${riassunto.ignoti} PASSI CON UNO STATO SCONOSCIUTO` : "");

  if (json) {
    // `url`, `buildId` e `maxPagine` nel documento: senza, chi archivia il JSON
    // come prova d'idoneita' non puo' ricostruire COSA e' stato misurato.
    console.log(JSON.stringify({
      contract: CONTRATTO_JSON, ok: verde, url: args.url ?? null, buildId: extra.buildId ?? null,
      maxPagine: args.maxPagine ?? null,
      // `scadenza` e `scaduta` sono parte del contratto dal 2026-08-06: un
      // consumatore che archivia questo documento come prova d'idoneita' deve
      // poter distinguere «rosso perche' il sito e' rotto» da «rosso perche' il
      // gate non ha fatto in tempo», senza leggere la prosa dei passi.
      scadenza: args.scadenza ?? null,
      scaduta: SCADUTA_VISTA,
      summary: riassunto, steps, ...(extra.error ? { error: extra.error } : {}),
    }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`${intestazione}\n`);
  for (const s of steps) {
    const marchio = { pass: "OK  ", fail: "FAIL", skipped: "MANC", "n/a": "N.A." }[s.status] ?? "????";
    console.log(`${marchio}  ${s.name}`);
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  if (riassunto.na > 0) console.log("Un NON APPLICABILE ha la sua premessa misurata stampata qui sopra: se la premessa e' falsa, lo e' anche la risposta.");
  if (riassunto.ignoti > 0) console.log("Un passo con uno stato sconosciuto NON e' un passo superato: e' un difetto di questo gate, e tiene il verdetto rosso.");
  // Il verdetto si ristampa in fondo: chi legge la coda di un output lungo —
  // una console che scorre, un log di CI — trovava per ultima la prosa di un
  // passo, non il verdetto.
  console.log(`\n${intestazione}`);
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { url: null, json: false, maxPagine: MAX_PAGINE, scadenza: SCADENZA_S, ignoti: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i] ?? "";
    else if (a.startsWith("--url=")) args.url = a.slice(6);
    else if (a === "--max-pagine") args.maxPagine = Number(argv[++i]);
    else if (a.startsWith("--max-pagine=")) args.maxPagine = Number(a.slice(13));
    else if (a === "--scadenza") args.scadenza = Number(argv[++i]);
    else if (a.startsWith("--scadenza=")) args.scadenza = Number(a.slice(11));
    else if (a === "--json") args.json = true;
    else args.ignoti.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(PROGETTO, "docs")) && !existsSync(join(PROGETTO, "src", "app"))) {
    console.error(`Ne' docs/ ne' src/app/ in ${PROGETTO}: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.`);
    process.exit(2);
  }
  if (args.ignoti.length > 0) {
    console.error(`Argomenti non riconosciuti: ${args.ignoti.join(" ")}. Il gate non li ignora: un flag scritto male non deve poter cambiare in silenzio cosa viene misurato.`);
    process.exit(2);
  }
  // `--url --json` faceva diventare `--json` l'indirizzo, e il passo 2 accusava
  // un server spento («avvia la build…») su un argomento malformato: l'operatore
  // riavviava il server per niente. `--max-pagine` era protetto bene, `--url` —
  // il parametro che sceglie QUALE app viene certificata — no.
  if (args.url !== null && (args.url === "" || args.url.startsWith("--"))) {
    console.error(`--url ha ricevuto "${args.url}", che non e' un indirizzo. Il parametro che sceglie quale applicazione viene certificata non si indovina.`);
    process.exit(2);
  }
  let daCertificato = false;
  if (!args.url) {
    const testo = leggiSeCe(CERTIFICATO);
    const dichiarato = testo ? leggiCertificato(testo).urlDichiarato : null;
    if (dichiarato) {
      args.url = dichiarato;
      daCertificato = true;
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
  try {
    const u = new URL(args.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("schema non http/https");
  } catch (errore) {
    console.error(`--url "${args.url}" non e' un indirizzo http(s) valido: ${errore.message}`);
    process.exit(2);
  }
  if (!Number.isInteger(args.maxPagine) || args.maxPagine < 1) {
    console.error("--max-pagine deve essere un intero >= 1.");
    process.exit(2);
  }
  if (!Number.isFinite(args.scadenza) || args.scadenza < 1) {
    console.error("--scadenza deve essere un numero di secondi >= 1.");
    process.exit(2);
  }
  const ctx = { certificato: null, baseUrl: null, pagine: null, informativaRaggiungibile: null, buildId: null, daCertificato };
  const inizio = Date.now();
  ctx.inizio = inizio;
  FINE = inizio + args.scadenza * 1000;
  try {
    for (const passo of PASSI) {
      if (scaduta()) {
        // **Mai una fine senza verdetto.** Un passo che non e' partito e' una
        // verifica MANCANTE — non un `pass`, non un `n/a` — e porta con se' il
        // conteggio di cio' che il giro aveva guardato quando il tempo e'
        // finito: chi legge deve sapere quanto lontano si era arrivati.
        record(passo.id, passo.nome, "skipped", motivoScadenza(ctx, args, inizio, "non e' partito"));
        continue;
      }
      await passo.esegui(ctx, args);
    }
  } catch (errore) {
    // Un gate che va in crash NON e' ne' verde ne' rosso: e' assente, e questo e'
    // peggio di entrambi. Senza questo `catch` un `EISDIR` su un percorso scritto
    // male nel certificato usciva **1 con stdout vuoto** — cioe' «gate rosso» per
    // chi guarda il codice d'uscita, e nessun documento per chi legge `--json`.
    // Il contratto dichiarato promette `2` per l'errore di esecuzione: adesso
    // arriva, e con il riepilogo di quello che si era gia' misurato.
    for (const passo of PASSI) {
      if (!steps.some((s) => s.id === passo.id)) {
        record(passo.id, passo.nome, "skipped", `non eseguito: il gate si e' interrotto prima — ${errore.message}`);
      }
    }
    console.error(`\nERRORE DI ESECUZIONE del gate: ${errore.stack ?? errore.message}`);
    verdetto(args.json, args, { buildId: ctx.buildId, error: String(errore.message ?? errore) });
    process.exit(2);
  }
  process.exit(verdetto(args.json, args, { buildId: ctx.buildId }));
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
