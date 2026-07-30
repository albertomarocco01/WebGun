/**
 * gate-lib.mjs — Le regole del gate di Speed Demon, pure e testabili.
 *
 * Qui non si apre nessun file, non si lancia nessun browser e non si tocca la
 * rete: sono funzioni da testo a verdetto. Il guscio di I/O sta in
 * `verify.mjs`, e la separazione non e' estetica — le regole di Flow Sentinel
 * sono rimaste per settimane dentro il guscio, non si potevano eseguire senza
 * un'app viva, e i loro difetti sono usciti solo quando qualcuno ha provato a
 * romperle a mano.
 */

// ------------------------------------------------------------------- comuni
const senzaBom = (testo) => testo.replace(/^﻿/, "");
const righe = (testo) => senzaBom(testo).split(/\r?\n/);

/**
 * Le zone citate non dichiarano niente: un blocco di codice recintato dentro un
 * template contiene un ESEMPIO compilato, e un commento HTML contiene un
 * promemoria. Leggerli come dichiarazioni fa nascere pagine che nessuno ha
 * dichiarato e firme che nessuno ha messo — difetto gia' pagato da Flow
 * Sentinel il 2026-07-28 sul suo contratto dei flussi.
 */
const senzaZoneCitate = (testo) =>
  senzaBom(testo)
    .replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");

export const dettaglioFindings = (findings) =>
  findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}`).join("\n");

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

/** Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano. */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

// ------------------------------------------------------ contratto delle pagine
// Stessa famiglia sintattica del contratto dei flussi di Flow Sentinel: una
// riga sola, in una forma sola. Un controllo su prosa libera e' un controllo che
// non c'e' (DECISIONI.md §19).
const RIGA_CONFERMA = /^[ \t>*_-]*Confermato da[ \t*_]*:[ \t*_]*(.+)$/im;

/**
 * Il segnaposto del template NON e' una firma.
 *
 * Flow Sentinel ha misurato il caso il 2026-07-28: un template compilato a
 * meta' passava il gate perche' la riga c'era. Una firma che nomina entrambe le
 * possibilita' (`{{UMANO | ORCHESTRATORE}}`) non ha scelto niente.
 */
const firmaVera = (firma) =>
  !/\{\{|\}\}|\bTODO\b|\bda compilare\b/i.test(firma) &&
  /\b(UMANO|ORCHESTRATORE)\b/.test(firma);

/** `## `<id>` — <percorso>` : l'intestazione di una pagina misurata. */
const INTESTAZIONE_PAGINA =
  /^##\s+`([a-z0-9][a-z0-9-]*)`\s+[—-]\s+(\S+)\s*$/;

/** `| performance | 90 |` dentro la sezione della pagina. */
const RIGA_SOGLIA =
  /^\|\s*(performance|accessibility|best-practices|seo)\s*\|\s*(\d{1,3})\s*\|/i;

/** `| <id-pagina> | <categoria> | <motivo> |` nella tabella delle deroghe. */
const RIGA_DEROGA =
  /^\|\s*`?([a-z0-9][a-z0-9-]*)`?\s*\|\s*(performance|accessibility|best-practices|seo)\s*\|\s*(.+?)\s*\|\s*$/i;

export const CATEGORIE = Object.freeze([
  "performance",
  "accessibility",
  "best-practices",
  "seo",
]);

/**
 * Legge il contratto `docs/performance.md`.
 *
 * Ritorna le pagine dichiarate con le loro soglie, le deroghe scritte e la
 * firma. Gli errori di forma NON vengono inghiottiti: un id ripetuto o una
 * categoria sconosciuta sono difetti del contratto, e un contratto che il gate
 * legge a meta' e' peggio di un contratto assente.
 */
export function leggiContratto(testo) {
  const pagine = [];
  const deroghe = [];
  const errori = [];
  const visti = new Set();
  const proprio = senzaZoneCitate(testo);

  let corrente = null;
  let inDeroghe = false;

  for (const linea of righe(proprio)) {
    const intestazione = INTESTAZIONE_PAGINA.exec(linea);
    if (intestazione) {
      const [, id, percorso] = intestazione;
      inDeroghe = false;
      if (visti.has(id)) {
        errori.push(`pagina \`${id}\`: id ripetuto — un id stabile identifica una pagina sola`);
        corrente = null;
      } else {
        visti.add(id);
        corrente = { id, percorso, soglie: {} };
        pagine.push(corrente);
      }
      continue;
    }

    // Un `## Deroghe` (o qualunque altra intestazione) chiude la pagina in
    // corso: senza questo, le righe della tabella delle deroghe finirebbero
    // come soglie dell'ultima pagina dichiarata.
    if (/^##\s+/.test(linea)) {
      corrente = null;
      inDeroghe = /deroghe/i.test(linea);
      continue;
    }

    if (corrente) {
      const soglia = RIGA_SOGLIA.exec(linea);
      if (soglia) {
        const categoria = soglia[1].toLowerCase();
        const valore = Number(soglia[2]);
        if (valore > 100) {
          errori.push(`pagina \`${corrente.id}\`, ${categoria}: soglia ${valore} — Lighthouse arriva a 100`);
        } else {
          corrente.soglie[categoria] = valore;
        }
      }
      continue;
    }

    if (inDeroghe) {
      const deroga = RIGA_DEROGA.exec(linea);
      // La riga di separazione `|---|---|` non e' una deroga, e il motivo non
      // puo' essere vuoto: una deroga senza motivo scritto e' una soglia tolta.
      if (deroga && !/^-+$/.test(deroga[3]) && deroga[3].replace(/-/g, "").trim().length > 0) {
        deroghe.push({
          pagina: deroga[1],
          categoria: deroga[2].toLowerCase(),
          motivo: deroga[3].trim(),
        });
      }
    }
  }

  const conferma = RIGA_CONFERMA.exec(proprio);
  const firma = conferma ? conferma[1].trim() : null;
  return {
    confermatoDa: firma && firmaVera(firma) ? firma : null,
    formFactor: formFactorDa(proprio),
    pagine,
    deroghe,
    errori,
  };
}

/**
 * Mobile e desktop sono due misure diverse, non due viste della stessa: cambiano
 * CPU simulata, rete simulata e dimensione della finestra, e sullo stesso codice
 * il punteggio puo' spostarsi di parecchio. Quale delle due valga lo dice il
 * CONTRATTO, non chi lancia il comando: altrimenti le soglie si confrontano con
 * numeri presi in un altro modo, ed e' il tipo di disallineamento che nessuno
 * nota perche' entrambi i numeri sembrano plausibili.
 *
 * Senza la riga si assume `mobile`, che e' il default di Lighthouse, e il gate
 * lo scrive nel dettaglio invece di tacerlo.
 */
const RIGA_FORM_FACTOR = /^[ \t>*_-]*Form factor[ \t*_]*:[ \t*_]*(mobile|desktop)\b/im;

export function formFactorDa(testo) {
  const trovata = RIGA_FORM_FACTOR.exec(senzaZoneCitate(testo));
  return trovata ? trovata[1].toLowerCase() : "mobile";
}

/** Una pagina senza nessuna soglia non e' misurabile: e' un desiderio. */
export function findingsContratto({ confermatoDa, pagine, errori }) {
  const findings = [
    ...errori.map((message) => ({ severity: "block", object: "docs/performance.md", message })),
  ];
  if (!confermatoDa) {
    findings.push({
      severity: "block",
      object: "docs/performance.md",
      message:
        "manca la riga `Confermato da:` (o e' rimasto il segnaposto del template): senza, l'elenco delle pagine che contano e' l'opinione dell'agente — e si ottimizza la home lasciando lenta la pagina che vende",
    });
  }
  if (pagine.length === 0) {
    findings.push({
      severity: "block",
      object: "docs/performance.md",
      message: "nessuna pagina dichiarata: non c'e' niente da misurare",
    });
  }
  for (const p of pagine) {
    if (Object.keys(p.soglie).length === 0) {
      findings.push({
        severity: "block",
        object: `pagina ${p.id}`,
        message: `nessuna soglia dichiarata per \`${p.percorso}\`: una pagina senza soglia non si puo' promuovere ne' bocciare`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- statistica
/**
 * Mediana e non media, e non e' pignoleria: la media la sposta un giro
 * sfortunato — un antivirus che si sveglia durante il terzo giro abbassa il
 * risultato di tutti e tre. La mediana ignora l'estremo.
 */
export function mediana(numeri) {
  if (numeri.length === 0) return null;
  const ordinati = [...numeri].sort((a, b) => a - b);
  const meta = Math.floor(ordinati.length / 2);
  return ordinati.length % 2
    ? ordinati[meta]
    : (ordinati[meta - 1] + ordinati[meta]) / 2;
}

/** Massimo meno minimo: quanto la macchina ha ballato mentre misurava. */
export function dispersione(numeri) {
  if (numeri.length === 0) return null;
  return Math.max(...numeri) - Math.min(...numeri);
}

export const DISPERSIONE_MASSIMA = 10;

/**
 * Legge n°3: un numero solo non e' una misura.
 *
 * Con meno di tre giri non c'e' mediana che tenga, e con una dispersione ampia
 * il numero non e' «basso»: e' **inaffidabile**. La differenza conta, perche' un
 * numero basso fa correggere il sito e un numero inaffidabile fa rimisurare —
 * e correggere il sito guardando il rumore e' come inseguire il proprio riflesso.
 */
export function misuraStabile(punteggi, sogliaDispersione = DISPERSIONE_MASSIMA) {
  const validi = punteggi.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (validi.length < 3) {
    return {
      mediana: mediana(validi),
      dispersione: dispersione(validi),
      stabile: false,
      motivo: `${validi.length} giri validi su ${punteggi.length}: ne servono almeno 3 perche' esista una mediana`,
    };
  }
  const spread = dispersione(validi);
  if (spread > sogliaDispersione) {
    return {
      mediana: mediana(validi),
      dispersione: spread,
      stabile: false,
      motivo: `dispersione ${spread} punti su ${validi.length} giri (massimo ammesso ${sogliaDispersione}): la macchina ha ballato piu' del guadagno di mezza ottimizzazione, la misura va rifatta`,
    };
  }
  return { mediana: mediana(validi), dispersione: spread, stabile: true, motivo: null };
}

// ------------------------------------------------------------------- budget
/**
 * Confronta le soglie dichiarate con la mediana misurata.
 *
 * `misure` = `Map<idPagina, { categoria: { mediana, dispersione, stabile } }>`.
 * Una soglia non raggiunta e' un `block`, **a meno che** il contratto porti la
 * sua deroga scritta: allora e' un `warn`, perche' resta una cosa da sapere ma
 * qualcuno se l'e' presa la responsabilita' per iscritto.
 */
export function findingsBudget(pagine, misure, deroghe) {
  const derogata = (pagina, categoria) =>
    deroghe.find((d) => d.pagina === pagina && d.categoria === categoria);
  const findings = [];

  for (const pagina of pagine) {
    const misurate = misure.get(pagina.id);
    if (!misurate) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `dichiarata nel contratto e mai misurata: una pagina che il gate non guarda e' una pagina che nessuno guarda`,
      });
      continue;
    }
    for (const [categoria, soglia] of Object.entries(pagina.soglie)) {
      const m = misurate[categoria];
      if (!m) {
        findings.push({
          severity: "block",
          object: `pagina ${pagina.id}`,
          message: `soglia dichiarata per \`${categoria}\` e nessuna misura: Lighthouse non ha prodotto quella categoria`,
        });
        continue;
      }
      if (!m.stabile) {
        findings.push({
          severity: "block",
          object: `pagina ${pagina.id} · ${categoria}`,
          message: `misura inaffidabile, non bassa: ${m.motivo}`,
        });
        continue;
      }
      if (m.mediana < soglia) {
        const d = derogata(pagina.id, categoria);
        findings.push({
          severity: d ? "warn" : "block",
          object: `pagina ${pagina.id} · ${categoria}`,
          message: d
            ? `${m.mediana} sotto la soglia ${soglia}, con deroga scritta: «${d.motivo}»`
            : `${m.mediana} sotto la soglia ${soglia} e nessuna deroga scritta nel contratto: o si ottimizza, o si scrive perche' non si puo'`,
        });
      }
    }
  }
  return findings;
}

// ------------------------------------------------------- dev server vs build
/**
 * Legge n°1: i numeri di `next dev` non sono numeri.
 *
 * Il riconoscimento e' un'EURISTICA su indizi dell'HTML servito, ed e' giusto
 * saperlo: nessun header dichiara «sono una dev server». Gli indizi scelti
 * sono quelli che la build di produzione non puo' produrre — sono stati
 * misurati il 2026-07-30 sullo stesso progetto servito nei due modi.
 *
 * Se un indizio compare, il passo e' rosso: preferire il falso allarme al falso
 * verde e' la regola della casa, e qui il falso verde vale 50 punti di
 * Lighthouse regalati.
 */
/**
 * I primi cinque indizi erano quelli «ovvi», e il 2026-07-30 il sabotaggio del
 * gate — puntarlo di proposito sulla dev server — ha mostrato che **non
 * bastano**: la stessa dev server che un'ora prima serviva
 * `_next/static/development/` e `react-refresh` nel suo HTML, dopo qualche
 * ricompilazione non li serviva piu', e il passo chiudeva `pass` su una dev
 * server. Falso verde da manuale, trovato solo perche' il gate e' stato puntato
 * dove non doveva.
 *
 * I due che seguono sono **strutturali**, non incidentali, e sono stati misurati
 * sullo STESSO progetto servito nei due modi nello stesso momento:
 *
 *   dev  (`next dev -p 3001`):  /_next/static/chunks/main-app.js?v=1785407832332
 *                               /_next/static/chunks/app-pages-internals.js
 *   prod (`next start -p 3100`): /_next/static/chunks/main-app-f1e4859868969239.js
 *                               (nessun `?v=`, nessun `app-pages-internals`)
 *
 * In produzione i chunk portano l'hash del contenuto nel NOME e non hanno
 * bisogno di un parametro anti-cache; in sviluppo il nome e' stabile e la cache
 * si rompe con `?v=<timestamp>`. E' una differenza che non puo' sparire senza
 * che sparisca il modo in cui Next serve lo sviluppo.
 */
const INDIZI_DEV = Object.freeze([
  {
    segno: /\/_next\/static\/chunks\/[^"']*\?v=/,
    nome: "chunk con `?v=<timestamp>`",
    perche: "in produzione i chunk portano l'hash nel nome e non hanno parametro anti-cache",
  },
  {
    segno: /app-pages-internals/,
    nome: "`app-pages-internals`",
    perche: "e' il bundle interno che serve solo alla dev server",
  },
  { segno: /\/_next\/static\/development\//, nome: "`/_next/static/development/`", perche: "in produzione la cartella e' l'id di build, non `development`" },
  { segno: /react-refresh/, nome: "`react-refresh`", perche: "l'aggiornamento a caldo non entra in una build di produzione" },
  { segno: /__next_hmr/, nome: "`__next_hmr`", perche: "il canale HMR esiste solo in sviluppo" },
  { segno: /webpack-hmr/, nome: "`webpack-hmr`", perche: "come sopra, altro nome dello stesso canale" },
  { segno: /__nextDevClientId/, nome: "`__nextDevClientId`", perche: "identificatore del client di sviluppo" },
]);

export function indiziDevServer(html) {
  const testo = senzaBom(html ?? "");
  return INDIZI_DEV.filter(({ segno }) => segno.test(testo));
}

export const eDevServer = (html) => indiziDevServer(html).length > 0;

// -------------------------------------------------------------------- SEO
/**
 * I metatag si leggono nell'HTML **servito**, non nel sorgente e non nel DOM.
 *
 * Un tag scritto dal client arriva dopo il crawler; un tag presente nel
 * sorgente puo' non arrivare mai nell'HTML se la pagina e' resa in un modo
 * diverso da quello che si crede. Qui si guarda cio' che esce dal server, che
 * e' esattamente cio' che vede chi indicizza.
 */
export function metatagDaHtml(html) {
  const testo = senzaBom(html ?? "");
  const titolo = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(testo);
  const descrizione =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(testo) ??
    /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(testo);
  const canonical =
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i.exec(testo) ??
    /<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i.exec(testo);
  const robots =
    /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i.exec(testo);

  const pulisci = (m) => (m ? m[1].trim() : null);
  return {
    title: pulisci(titolo) || null,
    description: pulisci(descrizione) || null,
    canonical: pulisci(canonical) || null,
    robots: pulisci(robots) || null,
  };
}

/**
 * `pagine` sono quelle **pubbliche** dichiarate nel contratto: una pagina dietro
 * autenticazione non ha bisogno di essere indicizzabile, e anzi non deve.
 */
export function findingsSeo(pagine, metatagPerPagina) {
  const findings = [];
  for (const pagina of pagine) {
    const tag = metatagPerPagina.get(pagina.id);
    if (!tag) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `HTML non letto per \`${pagina.percorso}\`: i metatag non sono stati verificati`,
      });
      continue;
    }
    for (const campo of ["title", "description", "canonical"]) {
      if (!tag[campo]) {
        findings.push({
          severity: "block",
          object: `pagina ${pagina.id}`,
          message: `manca \`${campo}\` nell'HTML servito di \`${pagina.percorso}\``,
        });
      }
    }
    // Il difetto SEO piu' comune di un sito con backoffice non e' un tag che
    // manca: e' un `noindex` messo per sbaglio su una pagina che deve vendere.
    if (tag.robots && /noindex/i.test(tag.robots)) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `\`robots: ${tag.robots}\` su una pagina dichiarata pubblica: e' esclusa dall'indice, e nessun punteggio SEO lo dice`,
      });
    }
  }
  return findings;
}

// ------------------------------------------ eseguibili risolti su Windows
/**
 * Portate da `flow-sentinel/scripts/gate-lib.mjs`, dove erano gia' costate un
 * collaudo. Il commento che avevo scritto in `verify.mjs` diceva «prezzo gia'
 * pagato, non si ripaga» — e poi l'avevo ripagato lo stesso, il 2026-07-30,
 * risolvendo `npx` a mano e prendendo la prima riga di `where`:
 *
 *     npx risolto in: C:\\Program Files\\nodejs\\npx
 *     "C:\\Program" non e' riconosciuto come comando interno o esterno
 *
 * npm installa DUE file per ogni comando — uno script di shell **senza
 * estensione**, per Git Bash, e uno shim `.cmd` per Windows — e `where` li
 * elenca in quest'ordine: la prima riga Windows non sa eseguirla, e il messaggio
 * d'errore parla del percorso spezzato invece che dell'estensione mancante.
 *
 * Il guasto andava nella direzione sicura (`misura` MANCANTE, mai un falso
 * verde) ma la diagnosi no: diceva «nessun giro riuscito» su una macchina dove
 * Lighthouse gira benissimo a mano.
 *
 * NOTA misurata, contro l'istinto: le virgolette attorno al percorso **non** si
 * mettono a mano. Provate entrambe le forme il 2026-07-30 sullo stesso shim in
 * `C:\\Program Files\\nodejs\\`:
 *   `cmd /c C:\\Program Files\\nodejs\\npx.cmd --version`    → status 0, «11.9.0»
 *   `cmd /c "C:\\Program Files\\nodejs\\npx.cmd" --version`  → status 1
 * Node quota gia' l'argomento; aggiungendone altre si ottiene un doppio
 * virgolettato che `cmd` non sa aprire. La forma giusta e' quella che sembra
 * sbagliata.
 *
 * NON si usa `shell: true`: li' gli argomenti vengono concatenati invece che
 * passati come vettore, e questo gate passa URL e `--chrome-flags` con spazi
 * dentro.
 */
const ESTENSIONE_ESEGUIBILE = /\.(exe|cmd|bat|com)$/i;

export function primoEseguibile(uscitaWhere) {
  const trovate = righe(uscitaWhere).map((r) => r.trim()).filter(Boolean);
  return trovate.find((r) => ESTENSIONE_ESEGUIBILE.test(r)) ?? trovate[0] ?? null;
}

export function formaEseguibile(nome, cercaPercorso, piattaforma = process.platform) {
  if (piattaforma !== "win32") return { file: nome, prefisso: [] };
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: nome, prefisso: [] };
  return /\.(cmd|bat)$/i.test(trovato)
    ? { file: "cmd.exe", prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

/**
 * Gli argomenti che NON sopravvivono a `cmd /c`.
 *
 * Misurato il 2026-07-30, con lo stesso comando e un argomento solo di
 * differenza:
 *
 *   ...npx.cmd lighthouse <url> --preset=desktop
 *     → status 0, 181688 byte di JSON
 *   ...npx.cmd lighthouse <url> --preset=desktop \
 *              "--chrome-flags=--headless=new --no-sandbox --disable-gpu"
 *     → status 1, «"C:\\Program" non e' riconosciuto come comando»
 *
 * `cmd` ri-analizza la riga che Node ha composto, e un argomento che contiene
 * spazi fa collassare il virgolettato del PROGRAMMA — che sta all'inizio, tre
 * argomenti prima, e finisce troncato al primo spazio del suo percorso. Il
 * messaggio d'errore parla quindi di `C:\\Program`, cioe' di tutt'altro
 * argomento: e' il motivo per cui la diagnosi ha richiesto due giri.
 *
 * La difesa non e' virgolettare meglio — e' non passare argomenti con spazi. Un
 * gate che li passasse in silenzio riporterebbe «strumento assente» dove lo
 * strumento c'e', cioe' MANCANTE invece di un errore vero: direzione sicura,
 * diagnosi bugiarda.
 */
export function argomentiOstiliACmd(args, piattaforma = process.platform) {
  if (piattaforma !== "win32") return [];
  return args.filter((a) => typeof a === "string" && /\s/.test(a));
}

// --------------------------------------------------------- contratto d'uscita
export const verdettoDa = (passi) =>
  passi.some((s) => s.status !== "pass") ? "ROSSO" : "VERDE";

const RIGA_VERDETTO = /^[ \t>*_-]*Gate[ \t*_]*:[ \t*_]*(VERDE|ROSSO)\b/im;

export function contrattoUscita(percorsoHandoff, testoHandoff, verdettoPrima) {
  if (testoHandoff === null) {
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message:
          "handoff assente: chi viene dopo non sa cosa e' stato ottimizzato ne' a che prezzo (comando `handoff`)",
      },
    ];
  }
  const dichiarato = RIGA_VERDETTO.exec(senzaZoneCitate(testoHandoff));
  if (!dichiarato) {
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message: "manca la riga `Gate: VERDE` o `Gate: ROSSO`: un handoff senza verdetto non si puo' confrontare con niente",
      },
    ];
  }
  if (dichiarato[1] !== verdettoPrima) {
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message: `dichiara \`Gate: ${dichiarato[1]}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`,
      },
    ];
  }
  return [];
}
