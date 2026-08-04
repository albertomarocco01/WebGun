/**
 * progetto-lib.mjs — Le regole del CONTRATTO e dell'APP SERVITA, senza I/O.
 *
 * Risponde a tre domande che nessun linter pone:
 *   «quali pagine ha firmato qualcuno, e cosa deve mostrare ciascuna?»
 *   «l'indirizzo che sto interrogando serve l'app di QUESTO progetto?»
 *   «il testo che si vede in pagina viene dal database, o dal codice?»
 *
 * Importa i primitivi da `audit-lib.mjs` invece di riscriverli: le due librerie
 * girano sempre insieme dentro lo stesso gate, quindi la dipendenza non accoppia
 * niente che fosse separato (stessa scelta di gestionale-crafter).
 */

import {
  conBarre,
  normalizzaSpazi,
  perRegExp,
  righe,
  senzaBom,
} from "./audit-lib.mjs";

// ------------------------------------------------------------------- markdown
/**
 * Le zone citate non dichiarano niente: un blocco recintato dentro un template
 * contiene un ESEMPIO compilato, un commento HTML contiene un promemoria.
 * Leggerli come dichiarazioni fa nascere pagine che nessuno ha dichiarato e
 * firme che nessuno ha messo — difetto gia' pagato da Flow Sentinel il
 * 2026-07-28, e questo contratto ha un esempio compilato in fondo al template.
 */
export const senzaZoneCitate = (testo) =>
  senzaBom(testo)
    .replace(/^[ \t]*````*[\s\S]*?^[ \t]*````*[ \t]*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");

/** `**Cosa mostra:** ...` · `> Confermato da: ...` · `Aggiornamento: ...`
 *  Fra i due punti e il valore si ammettono SOLO SPAZI ORIZZONTALI: con `\s`,
 *  che comprende l'a capo, una riga vuota cattura la prima riga non vuota che
 *  segue, e il passo esce verde su un contratto non firmato (Flow Sentinel,
 *  `STATO.md` §Tre falsi verdi). */
const rigaDi = (etichetta) =>
  new RegExp(`^[ \\t>*_-]*${etichetta}[ \\t*_]*:[ \\t*_]*(.+)$`, "im");

const valoreRiga = (testo, etichetta) => {
  const m = rigaDi(etichetta).exec(testo);
  return m ? m[1].replace(/[*_`]+$/, "").trim() : null;
};

/** Le celle di una riga di tabella markdown, senza i due bordi. */
const celle = (linea) =>
  linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const eSeparatore = (linea) => /^\|[\s:|-]+\|?\s*$/.test(linea.trim());

const senzaApici = (testo) => String(testo ?? "").replace(/`/g, "").trim();

// ---------------------------------------------------------------- la firma
/**
 * Il segnaposto del template NON e' una firma, e una firma con nome e ruolo lo
 * e'.
 *
 * Le due meta' di questa regola sono state pagate da due skill diverse:
 * Flow Sentinel ha misurato un template compilato a meta' che passava perche'
 * la riga c'era; Speed Demon ha misurato il contrario — la regola pretendeva la
 * parola letterale `UMANO` e rifiutava `Elena Barbieri (titolare)`, cioe'
 * l'unica modalita' accettata era quella senza nessun nome. A tenere fuori il
 * segnaposto basta il controllo sui segnaposti; chi sia davvero a decidere lo
 * legge un umano, ed e' l'unico che possa dirlo.
 */
const firmaVera = (firma) =>
  !/\{\{|\}\}|\bTODO\b|\bda compilare\b|\bda decidere\b|^[-—?.\s]+$/i.test(firma) &&
  /\p{L}{3}/u.test(firma);

const DATA_ISO = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * La data della firma dentro un handoff altrui.
 *
 * Si legge dal TESTO (`Confermato da: … il 2026-07-24`), non dalla data del
 * file: su un clone appena fatto tutti i file hanno la data del clone, e un
 * confronto fra date di filesystem direbbe che ogni handoff e' piu' recente di
 * ogni contratto — cioe' un rilievo su ogni progetto, che e' rumore.
 * Se la data non e' in forma ISO il confronto NON si fa: meglio non dire niente
 * che dire una cosa a caso su una data scritta a parole.
 */
export function dataConfermaDa(testo) {
  const riga = valoreRiga(senzaZoneCitate(testo ?? ""), "Confermato da");
  return riga ? (DATA_ISO.exec(riga)?.[0] ?? null) : null;
}

// ------------------------------------------------------------- le pagine
/** ``## `id-pagina` — /percorso`` — il percorso comincia con `/`, ed e' quello
 *  che distingue una sezione di pagina dalle sezioni di servizio del file
 *  (`## Ambiente`, `## Gerarchia`, `## Slot dei contenuti`). */
const INTESTAZIONE_PAGINA = /^##\s+`?([a-z0-9][a-z0-9-]*)`?\s+[—–-]\s+(\/\S*)\s*$/;

const RIGHE_OBBLIGATORIE = Object.freeze(["Cosa mostra", "Contenuti da", "Titolo da", "Aggiornamento"]);

/** `` `tabella:prodotti` · `slot:home-hero` `` — il prefisso non e' ornamento:
 *  dice al passo `contenuti-vivi` se contare righe leggibili dall'anonimo
 *  (tabella, vista) o cercare un testo in pagina (slot). */
const RE_FONTE = /`?(tabella|vista|slot)\s*:\s*([a-z0-9_][a-z0-9_.-]*)`?/gi;

export function fontiDa(valore) {
  const testo = String(valore ?? "");
  if (/^\s*nessuna\s*\.?\s*$/i.test(testo)) return [];
  return [...testo.matchAll(RE_FONTE)].map((m) => ({
    tipo: m[1].toLowerCase(),
    nome: m[2].toLowerCase(),
  }));
}

/** `statico` · `ISR 600` · `dinamico`. Il gate lo confronta con gli slot che la
 *  pagina mostra: una pagina statica che mostra un contenuto editabile prende un
 *  `issue`, perche' il cliente cambiera' il testo e non vedra' cambiare niente. */
export function aggiornamentoDa(valore) {
  const testo = String(valore ?? "").trim();
  const isr = /\bISR\s+(\d+)/i.exec(testo);
  if (isr) return { tipo: "isr", secondi: Number(isr[1]) };
  if (/\bdinamic/i.test(testo)) return { tipo: "dinamico", secondi: null };
  if (/\bstatic/i.test(testo)) return { tipo: "statico", secondi: null };
  return { tipo: null, secondi: null };
}

// -------------------------------------------------- la tabella degli slot
/**
 * Si legge DALLA SUA INTESTAZIONE, non da un numero fisso di colonne.
 *
 * E' la correzione che il collaudo avversario di Speed Demon ha dovuto fare
 * sulla tabella delle deroghe: legare la regola alla posizione delle colonne
 * significa che il giorno in cui il template ne aggiunge una, la tabella smette
 * di essere letta — in silenzio, e con la sua brava riga scritta li' sotto.
 */
function slotDaTabella(righeTabella) {
  const slot = [];
  let indici = null;
  for (const linea of righeTabella) {
    if (eSeparatore(linea)) continue;
    const c = celle(linea);
    if (!indici) {
      const dove = (parola) => c.findIndex((x) => new RegExp(parola, "i").test(x));
      const chiave = dove("^slot$|slot");
      const pagina = dove("pagina");
      if (chiave >= 0 && pagina >= 0) indici = { chiave, pagina };
      continue;
    }
    const chiave = senzaApici(c[indici.chiave]).toLowerCase();
    const pagina = senzaApici(c[indici.pagina]).toLowerCase();
    if (chiave && pagina) slot.push({ chiave, pagina });
  }
  return slot;
}

/** `Tabella dei contenuti: site_content — chiave `slot`, pubblicato `is_published`` */
export function tabellaContenutiDa(valore) {
  const testo = String(valore ?? "");
  if (!testo || /^\s*nessuna\b/i.test(testo)) return null;
  const nome = senzaApici(testo.split(/[—–-]/)[0]);
  const chiave = /chiave\s*`?([a-z0-9_]+)`?/i.exec(testo);
  const pubblicato = /pubblicat[oa]\s*`?([a-z0-9_]+)`?/i.exec(testo);
  if (!nome || !chiave || !pubblicato) return null;
  return { tabella: nome.toLowerCase(), colonnaChiave: chiave[1], colonnaPubblicato: pubblicato[1] };
}

export const SOGLIA_FRAMMENTO = 24;

/**
 * Legge il contratto `docs/vetrina.md`.
 *
 * Gli errori di forma NON vengono inghiottiti: un id ripetuto o una riga
 * obbligatoria assente sono difetti del contratto, e un contratto che il gate
 * legge a meta' e' peggio di un contratto assente.
 */
export function leggiContratto(testo) {
  const proprio = senzaZoneCitate(testo);
  const stato = { pagine: [], righeSlot: [], escluse: [], errori: [], visti: new Set(), corrente: null, sezione: null };

  for (const linea of righe(proprio)) {
    if (leggiIntestazione(linea, stato)) continue;
    if (stato.corrente) { leggiRigaPagina(linea, stato.corrente); continue; }
    if (stato.sezione === "slot" && /^\s*\|/.test(linea)) stato.righeSlot.push(linea);
    if (stato.sezione === "escluse") {
      const m = /^\s*[-*]\s+`?(\/[^`\s]*)`?/.exec(linea);
      if (m) stato.escluse.push(m[1]);
    }
  }

  return {
    ...lettureGlobali(proprio),
    pagine: stato.pagine,
    slot: slotDaTabella(stato.righeSlot),
    escluse: stato.escluse,
    errori: stato.errori,
  };
}

/** Le righe che non appartengono a nessuna pagina: firma, ambiente, soglia. */
function lettureGlobali(proprio) {
  const conferma = valoreRiga(proprio, "Confermato da");
  const soglia = valoreRiga(proprio, "Lunghezza minima del frammento distintivo");
  const nSoglia = soglia ? Number((/\d+/.exec(soglia) ?? [])[0]) : NaN;
  return {
    confermatoDa: conferma && firmaVera(conferma) ? conferma : null,
    dataConferma: conferma ? (DATA_ISO.exec(conferma)?.[0] ?? null) : null,
    urlDichiarato: valoreRiga(proprio, "URL servito"),
    tabellaContenuti: tabellaContenutiDa(valoreRiga(proprio, "Tabella dei contenuti")),
    // `null` = il contratto non l'ha dichiarata, e chi chiama usa il ripiego
    // della casa. Zero non e' ammissibile: renderebbe distintivo ogni valore.
    sogliaFrammento: Number.isInteger(nSoglia) && nSoglia > 0 ? nSoglia : null,
    // «Nessuno slot.» e' una DICHIARAZIONE, non un'omissione: e' l'unico modo
    // per distinguere «questo sito non ha testi editabili» da «nessuno ha
    // compilato la tabella». Sono due stati diversi e uno dei due e' un problema.
    nessunoSlotDichiarato: /^\s*Nessuno slot\.?\s*$/im.test(proprio),
  };
}

function leggiIntestazione(linea, stato) {
  const intestazione = INTESTAZIONE_PAGINA.exec(linea);
  if (intestazione) {
    const [, id, percorso] = intestazione;
    stato.sezione = null;
    if (stato.visti.has(id)) {
      stato.errori.push(`pagina \`${id}\`: id ripetuto — un id stabile identifica una pagina sola`);
      stato.corrente = null;
    } else {
      stato.visti.add(id);
      stato.corrente = { id, percorso, righe: {}, fonti: [], aggiornamento: { tipo: null, secondi: null }, rimandaA: null };
      stato.pagine.push(stato.corrente);
    }
    return true;
  }
  // Una qualunque altra intestazione chiude la pagina in corso: senza, le righe
  // della tabella degli slot finirebbero come righe dell'ultima pagina.
  if (/^##\s+/.test(linea)) {
    stato.corrente = null;
    stato.sezione = /slot/i.test(linea) ? "slot" : /esclus/i.test(linea) ? "escluse" : null;
    return true;
  }
  return false;
}

function leggiRigaPagina(linea, pagina) {
  for (const etichetta of RIGHE_OBBLIGATORIE) {
    const m = rigaDi(etichetta).exec(linea);
    if (!m) continue;
    const valore = m[1].replace(/[*_]+$/, "").trim();
    pagina.righe[etichetta] = valore;
    if (etichetta === "Contenuti da") pagina.fonti = fontiDa(valore);
    if (etichetta === "Aggiornamento") pagina.aggiornamento = aggiornamentoDa(valore);
    return;
  }
  const rimando = rigaDi("Rimanda a").exec(linea);
  if (rimando) pagina.rimandaA = senzaApici(rimando[1].replace(/[*_]+$/, ""));
}

// ------------------------------------------------------- findings: contratto
/**
 * @param {object} contratto  l'uscita di `leggiContratto`
 * @param {object} opzioni    `{ dataHandoffSchema }` — la data dell'ultimo
 *   handoff di schema-forge, per il rilievo sulla firma invecchiata.
 */
export function findingsContratto(contratto, opzioni = {}) {
  const findings = contratto.errori.map((e) => ({ severity: "block", object: "docs/vetrina.md", message: e }));
  const idPagine = new Set(contratto.pagine.map((p) => p.id));

  for (const pagina of contratto.pagine) {
    const mancanti = RIGHE_OBBLIGATORIE.filter((r) => !pagina.righe[r]);
    if (mancanti.length > 0) {
      findings.push({
        severity: "block",
        object: `${pagina.id} (${pagina.percorso})`,
        message: `righe obbligatorie assenti: ${mancanti.map((r) => `**${r}:**`).join(", ")}`,
        hint: "il template le elenca tutte e quattro; senza `Contenuti da:` e `Aggiornamento:` i passi 7 e 9 non sanno cosa verificare",
      });
    }
    if (pagina.righe.Aggiornamento && pagina.aggiornamento.tipo === null) {
      findings.push({
        severity: "block",
        object: `${pagina.id} (${pagina.percorso})`,
        message: `\`Aggiornamento: ${pagina.righe.Aggiornamento}\` non e' uno dei tre valori ammessi (\`statico\`, \`ISR <secondi>\`, \`dinamico\`)`,
      });
    }
  }

  findings.push(...findingsSlotDichiarati(contratto, idPagine));
  findings.push(...findingsFirmaDatata(contratto, opzioni.dataHandoffSchema));
  return findings;
}

function findingsSlotDichiarati(contratto, idPagine) {
  const findings = [];
  const inTabella = new Set(contratto.slot.map((s) => s.chiave));

  for (const s of contratto.slot) {
    if (!idPagine.has(s.pagina)) {
      findings.push({
        severity: "block",
        object: `slot \`${s.chiave}\``,
        message: `dichiarato sulla pagina \`${s.pagina}\`, che il contratto non dichiara: la verifica non saprebbe in quale pagina cercarlo`,
      });
    }
  }

  for (const pagina of contratto.pagine) {
    for (const fonte of pagina.fonti.filter((f) => f.tipo === "slot")) {
      if (!inTabella.has(fonte.nome)) {
        findings.push({
          severity: "issue",
          object: `${pagina.id} → slot \`${fonte.nome}\``,
          message: "la pagina lo dichiara fra le sue fonti ma non compare nella tabella §Slot dei contenuti: il passo `contenuti-vivi` non lo verifichera'",
          hint: "aggiungilo alla tabella, o togli la fonte dalla riga `Contenuti da:`",
        });
      }
    }
  }
  return findings;
}

/**
 * La firma e' piu' vecchia dello schema?
 *
 * E' il controllo che il §7 del `COLLAUDO-EVOLVE-2026-07-30.md` di Flow Sentinel
 * lascia aperto — «ora e' nella procedura, ma nessuno script lo fa» — risolto
 * senza git, confrontando due file dello stesso progetto.
 * FALSO POSITIVO DICHIARATO: un handoff riscritto per un refuso invecchia una
 * firma che era buona. E' un `issue`, non un `block`, proprio per questo.
 */
function findingsFirmaDatata(contratto, dataHandoffSchema) {
  if (!dataHandoffSchema || !contratto.dataConferma) return [];
  if (contratto.dataConferma >= dataHandoffSchema) return [];
  return [{
    severity: "issue",
    object: "docs/vetrina.md",
    message: `firmato il ${contratto.dataConferma}, ma l'handoff di schema-forge e' del ${dataHandoffSchema}: lo schema e' cambiato dopo che qualcuno ha firmato l'elenco delle pagine`,
    hint: "rileggi il contratto contro lo schema nuovo (comando `evolve`) e fallo riconfermare, oppure verifica che il cambiamento non lo tocchi",
  }];
}

// ------------------------------------------------------ la configurazione
const CHIAVI_OBBLIGATORIE = Object.freeze(["radicePubblica", "cucitura", "primitive", "moduliClient"]);

export function validaConfig(oggetto) {
  const errori = [];
  if (!oggetto || typeof oggetto !== "object" || Array.isArray(oggetto)) {
    return { errori: ["vetrina.config.json non e' un oggetto JSON"] };
  }
  for (const chiave of CHIAVI_OBBLIGATORIE) {
    if (oggetto[chiave] === undefined) errori.push(`manca la chiave \`${chiave}\``);
  }
  for (const chiave of ["primitive", "moduliClient", "radiciEscluse"]) {
    if (oggetto[chiave] !== undefined && !Array.isArray(oggetto[chiave])) {
      errori.push(`\`${chiave}\` deve essere un elenco`);
    }
  }
  if (Array.isArray(oggetto.primitive) && oggetto.primitive.length === 0) {
    errori.push("`primitive` e' vuoto: senza il nome delle primitive, la regola della cucitura non puo' scattare mai");
  }
  return { errori };
}

// ------------------------------------------------------------------ le rotte
/**
 * Da `src/app/(pubblico)/catalogo/[slug]/page.tsx` a `/catalogo/[slug]`.
 *
 * I gruppi di rotta `(pubblico)` non compaiono nell'URL: sono una cartella per
 * gli umani. Toglierli e' la differenza fra una rotta che si trova e una rotta
 * che il gate segnala come «non dichiarata» mentre e' dichiarata benissimo.
 */
export function rottaDaFile(percorso, radicePubblica) {
  const p = conBarre(percorso);
  const radice = conBarre(radicePubblica).replace(/\/+$/, "");
  if (!p.startsWith(`${radice}/`)) return null;
  const segmenti = p.slice(radice.length + 1).split("/");
  if (!/^page\.[jt]sx?$/.test(segmenti.pop() ?? "")) return null;
  const utili = segmenti.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return `/${utili.join("/")}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
}

export function rotteDaSorgenti(percorsi, config) {
  const escluse = (config.radiciEscluse ?? []).map((r) => conBarre(r).replace(/\/+$/, ""));
  const rotte = [];
  for (const percorso of percorsi) {
    const p = conBarre(percorso);
    if (escluse.some((e) => p === e || p.startsWith(`${e}/`))) continue;
    const rotta = rottaDaFile(p, config.radicePubblica);
    if (rotta) rotte.push({ rotta, file: p });
  }
  return rotte;
}

/**
 * Un percorso dichiarato copre una rotta dei sorgenti?
 *
 * I segmenti dinamici si confrontano come MODELLI: `[slug]` vale un segmento,
 * `[...tutto]` vale il resto. Cosi' la pagina che il contratto dichiara come
 * istanza rappresentante (`/catalogo/acero-palmato`) copre `/catalogo/[slug]`
 * invece di lasciarla scoperta — che sarebbe un `issue` su ogni rotta dinamica
 * di ogni progetto, cioe' rumore.
 */
export function combacia(rotta, dichiarato) {
  const pulisci = (s) => conBarre(s).replace(/\/+$/, "") || "/";
  const modello = pulisci(rotta)
    .split("/")
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg)) return "@@RESTO@@";
      if (/^\[.+\]$/.test(seg)) return "@@UNO@@";
      return perRegExp(seg);
    })
    .join("/")
    .replace(/@@RESTO@@/g, ".*")
    .replace(/@@UNO@@/g, "[^/]+");
  return new RegExp(`^${modello}$`).test(pulisci(dichiarato));
}

/** Un'esclusione puo' portare un `*`: `/admin/*` copre tutto quello che sta
 *  sotto. E' la forma che un umano scrive, quindi e' quella che si legge. */
export function esclusa(rotta, escluse) {
  const pulisci = (s) => conBarre(s).replace(/\/+$/, "") || "/";
  const r = pulisci(rotta);
  return escluse.some((voce) => {
    const e = pulisci(voce);
    // `/admin/*` copre `/admin` e tutto quello che ci sta sotto: chi lo scrive
    // intende la sezione, non i suoi figli soltanto.
    if (e.endsWith("/*")) {
      const base = e.slice(0, -2) || "/";
      return r === base || r.startsWith(`${base}/`);
    }
    const modello = perRegExp(e).replace(/\\\*/g, ".*");
    return new RegExp(`^${modello}$`).test(r) || r.startsWith(`${e}/`);
  });
}

/**
 * Le due direzioni del passo `pagine-vive`.
 *
 * @param {object} dati `{ pagine, risposte, rotteSorgenti, escluse }`
 *   `risposte` e' una Mappa id → `{ stato, rimandoA }` (o `null` se non ha
 *   risposto). `rotteSorgenti` viene da `rotteDaSorgenti`.
 */
export function findingsRotte(dati) {
  const { pagine, risposte, rotteSorgenti, escluse } = dati;
  const findings = [];

  for (const pagina of pagine) {
    findings.push(...findingsPaginaDichiarata(pagina, risposte.get(pagina.id)));
  }

  // Seconda direzione. Enumera l'albero delle rotte dai SORGENTI (i `page.tsx`),
  // non dall'app: una rotta che nessun `page.tsx` rappresenta — un `route.ts`,
  // una riscrittura di `next.config`, una pagina servita dal middleware — qui
  // non si vede, ed e' dichiarato nella specifica.
  for (const { rotta, file } of rotteSorgenti) {
    const dichiarata = pagine.some((p) => combacia(rotta, p.percorso));
    if (dichiarata || esclusa(rotta, escluse)) continue;
    findings.push({
      severity: "issue",
      object: rotta,
      message: `rotta pubblica servita da \`${file}\` e non dichiarata nel contratto: e' una pagina che chiunque puo' aprire e che nessuno ha firmato`,
      hint: "aggiungila al contratto e falla riconfermare, oppure mettila fra le §Pagine escluse dal contratto col perche'",
    });
  }

  return findings;
}

function findingsPaginaDichiarata(pagina, risposta) {
  const dove = `${pagina.id} (${pagina.percorso})`;
  if (!risposta) {
    return [{
      severity: "block",
      object: dove,
      message: "nessuna risposta dall'app: la pagina e' dichiarata nel contratto e non e' servita",
    }];
  }
  if (risposta.stato >= 300 && risposta.stato < 400) {
    // Una pagina che rimanda altrove NON e' quella pagina. Il precedente e'
    // misurato: Speed Demon ha attribuito `performance 100` a una pagina che
    // come documento non esisteva, perche' il browser aveva seguito il rimando.
    if (pagina.rimandaA && conBarre(risposta.rimandoA ?? "").replace(/\/+$/, "") === conBarre(pagina.rimandaA).replace(/\/+$/, "")) {
      return [];
    }
    return [{
      severity: "block",
      object: dove,
      message: `risponde ${risposta.stato} e rimanda a \`${risposta.rimandoA ?? "?"}\`: una pagina che rimanda altrove non e' quella pagina`,
      hint: "o la pagina esiste davvero, o il contratto dichiara la destinazione con la riga `Rimanda a:`",
    }];
  }
  if (risposta.stato >= 400) {
    return [{
      severity: "block",
      object: dove,
      message: `risponde ${risposta.stato}: la pagina e' dichiarata nel contratto e l'app non la serve`,
    }];
  }
  return [];
}

// --------------------------------------------------------------- app servita
/**
 * Gli indizi che distinguono una dev server da una build di produzione.
 *
 * Ripresi da Speed Demon, che li ha MISURATI il 2026-07-30 sullo stesso progetto
 * servito nei due modi nello stesso momento. Gli indizi «ovvi»
 * (`react-refresh`) da soli non bastano: dopo qualche ricompilazione la stessa
 * dev server aveva smesso di servirli. I primi due sono strutturali — in
 * produzione i chunk portano l'hash nel NOME e non hanno bisogno di un
 * parametro anti-cache.
 */
const INDIZI_DEV = Object.freeze([
  // I due indizi di TURBOPACK, aggiunti in P1 con la misura che li ha imposti.
  // Sabotaggio del 2026-08-03 sul banco: `next dev` su Next 16, e NESSUNO dei
  // sette indizi storici scattava — sono tutti dell'era Webpack, e dalla 16
  // Turbopack e' il default. Il gate diventava rosso lo stesso (per il build id
  // che non combacia), ma con la diagnosi SBAGLIATA: «sta rispondendo un'altra
  // applicazione sulla stessa porta», mentre l'applicazione era proprio questa,
  // servita in sviluppo. Un rosso giusto con una diagnosi bugiarda manda
  // qualcuno a cercare la cosa sbagliata — a Speed Demon e' costato un
  // pomeriggio.
  // Misurato sullo STESSO progetto servito nei due modi nello stesso momento:
  //   dev  /_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_…js
  //        /_next/static/chunks/node_modules_next_dist_compiled_next-devtools_…js
  //   prod /_next/static/chunks/turbopack-3l1jj1uo0j4no.js   (nomi a hash)
  // La parola `turbopack` da sola NON serve: in produzione c'e' anche li'.
  // Entrambi gli indizi sono ancorati a un percorso di chunk, cosi' una pagina
  // che PARLA di HMR o di devtools non li fa scattare.
  { segno: /\/_next\/static\/chunks\/[^"']*hmr-client/, nome: "chunk `hmr-client` di Turbopack", perche: "il canale di aggiornamento a caldo esiste solo in sviluppo" },
  { segno: /\/_next\/static\/chunks\/[^"']*next-devtools/, nome: "chunk `next-devtools`", perche: "il bundle degli strumenti di sviluppo non entra in una build di produzione" },
  { segno: /\/_next\/static\/chunks\/[^"']*\?v=/, nome: "chunk con `?v=<timestamp>`", perche: "in produzione i chunk portano l'hash nel nome e non hanno parametro anti-cache" },
  { segno: /app-pages-internals/, nome: "`app-pages-internals`", perche: "e' il bundle interno che serve solo alla dev server" },
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

/**
 * L'app che risponde a quell'indirizzo e' quella di QUESTO progetto?
 *
 * `--url` obbligatorio impedisce al gate di INDOVINARE una porta; non impedisce
 * di sbagliarla, e la differenza e' stata misurata: la porta che un contratto
 * FIRMATO dichiarava era occupata, su quella macchina, dal sito di un'altra
 * azienda. Il discriminante e' il build id di Next, che sta in `.next/BUILD_ID`
 * e nei percorsi degli asset dell'HTML servito.
 */
export const eLaMiaBuild = (html, buildId) =>
  typeof buildId === "string" && buildId.length > 0 && senzaBom(html ?? "").includes(buildId);

const ENTITA = Object.freeze({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " });

/**
 * `L'orto d'inverno` arriva in pagina come `L&#x27;orto d&#x27;inverno`, e in
 * italiano gli apostrofi sono dappertutto: senza questa decodifica il passo
 * `contenuti-vivi` sarebbe una fabbrica di rossi falsi.
 */
export function decodificaEntita(testo) {
  return senzaBom(testo)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (intero, nome) => ENTITA[nome.toLowerCase()] ?? intero);
}

/** Il testo alternativo di un'immagine, dentro il tag che lo porta. */
const ALT_NEL_TAG = /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * Il testo che un visitatore vede.
 *
 * Gli `<script>` si tolgono PRIMA di tutto: dentro c'e' il payload RSC, che
 * ripete il contenuto della pagina in forma serializzata. Cercarci dentro
 * significherebbe trovare un testo che la pagina non mostra — e per il passo 9
 * sarebbe un verde su un contenuto invisibile.
 *
 * Un tag pero' non sempre e' solo impaginazione: il TESTO ALTERNATIVO di
 * un'immagine e' contenuto servito, lo legge chi usa uno screen reader e lo
 * vede chiunque quando la foto non arriva. Toglierlo insieme al tag e' costato
 * un `block` falso, misurato sul banco `banco-prova-valscura` il 2026-08-04:
 * sullo slot `cucina-nota-polenta` il valore piu' lungo di contenuto era
 * `immagine_alt` («Il paiolo di rame sul fuoco», 27 caratteri), la pagina lo
 * serviva dentro l'attributo `alt` — e per il passo 9 non esisteva.
 * La costituzione mette l'accessibilita' sopra il minimalismo, e qui le due
 * cose coincidono: quel testo e' contenuto, quindi si legge.
 */
export function testoServito(html) {
  return normalizzaSpazi(
    decodificaEntita(
      senzaBom(html ?? "")
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, (tag) => {
          const alt = ALT_NEL_TAG.exec(tag);
          return alt ? ` ${alt[1] ?? alt[2]} ` : " ";
        }),
    ),
  );
}

// ------------------------------------------------------------- i segnaposto
const SEGNAPOSTO = Object.freeze([
  { segno: /\{\{[^}]*\}\}/, nome: "segnaposto `{{…}}`" },
  { segno: /lorem ipsum/i, nome: "«lorem ipsum»" },
  { segno: /\bTODO\b/, nome: "«TODO»" },
  { segno: /\bda compilare\b/i, nome: "«da compilare»" },
  { segno: /\bda decidere\b/i, nome: "«da decidere»" },
]);

export function findingsSegnaposto(testiPerPagina) {
  const findings = [];
  for (const [dove, testo] of testiPerPagina) {
    for (const { segno, nome } of SEGNAPOSTO) {
      const trovato = segno.exec(testo);
      if (!trovato) continue;
      findings.push({
        severity: "block",
        object: dove,
        message: `${nome} nel testo servito: «${estratto(testo, trovato.index)}»`,
        hint: "un testo che non c'e' e' una domanda al committente, non un riempitivo: il sito e' andato online con la frase del template",
      });
    }
  }
  return findings;
}

const estratto = (testo, da) => testo.slice(Math.max(0, da - 20), da + 60).trim();

// --------------------------------------------------------------- i contenuti
/**
 * I valori che una riga si porta dietro e che NON sono contenuto: la chiave
 * primaria e le date tecniche.
 *
 * MISURATO sul banco il 2026-08-03, ed e' il motivo per cui questa costante
 * esiste. Il frammento si ricava con `to_jsonb(t)`, che restituisce come TESTO
 * anche `id` (36 caratteri) e `created_at`/`updated_at` (32 ciascuna). Su uno
 * slot il cui contenuto piu' lungo sta sotto i 36 caratteri, «il piu' lungo dei
 * valori di testo» e' l'UUID della riga — e il gate cercava l'UUID nella pagina:
 *
 *   [block] slot `pie-pagina` → contatti (/contatti): il valore pubblicato nel
 *   database non compare nel testo servito della pagina che dovrebbe mostrarlo:
 *   «44444444-4444-4444-8444-000000000006…»
 *
 * La pagina era corretta e mostrava esattamente cio' che il database diceva.
 * Un rosso falso con una diagnosi bugiarda, cioe' la cosa peggiore che un gate
 * possa produrre. Alzare la soglia sopra 36 lo avrebbe nascosto trasformandolo
 * in un MANCANTE su ogni slot corto: il difetto non era la soglia, era la
 * candidatura.
 *
 * MISURATO DI NUOVO sul banco `banco-prova-valscura` il 2026-08-04, e la
 * famiglia era piu' grande di due: un URL non e' mai testo di pagina. Sullo slot
 * `cucina-nota-polenta` (titolo 22 caratteri, corpo 19, `immagine_url` 31) il
 * valore piu' lungo era il percorso della foto, che vive dentro un attributo
 * `src` e sparisce insieme ai tag:
 *
 *   [block] slot `cucina-nota-polenta` → cucina (/cucina): il valore pubblicato
 *   nel database non compare nel testo servito della pagina che dovrebbe
 *   mostrarlo: «/foto/cucina-paiolo-di-rame.png…»
 */
const VALORE_TECNICO = new RegExp(
  "^(?:" +
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" + // uuid
    "|\\d{4}-\\d{2}-\\d{2}[T ][\\d:.]+(?:[+-]\\d{2}:?\\d{2}|Z)?" + // timestamp ISO
    "|[a-z][a-z0-9+.-]*://\\S+" + // URL assoluto
    "|/\\S*" + // percorso di un asset: `/foto/paiolo.png`
    ")$",
  "i",
);

/**
 * Il frammento distintivo di uno slot: il piu' lungo dei suoi valori di testo,
 * fra quelli che sono davvero contenuto.
 *
 * Sotto la soglia la ricerca non prova niente in NESSUNA delle due direzioni —
 * «Chi siamo» si trova in pagina per caso e nei sorgenti per caso — quindi si
 * dichiara che quello slot non e' stato verificato, invece di far finta.
 * La soglia e' una CONVENZIONE, non una misura: il numero giusto si ricava su un
 * progetto vero guardando quanti slot restano fuori (§Note della specifica).
 *
 * `escludi` porta i valori che questa riga usa come IDENTIFICATORE e non come
 * contenuto — in pratica la chiave dello slot. MISURATO sul banco
 * `banco-prova-valscura` il 2026-08-04: su uno slot con la chiave lunga
 * (`prenotazione-avviso-caparra`, 27 caratteri) e il contenuto corto (titolo 10,
 * corpo 22), «il piu' lungo dei valori di testo» era la CHIAVE. E la chiave e'
 * il candidato peggiore possibile, perche' sbaglia in tutte e due le direzioni
 * per costruzione: in pagina non c'e' mai — nessuno stampa il nome dello slot —
 * e nei sorgenti c'e' sempre, perche' e' cosi' che la pagina chiede lo slot.
 * Due `block` a testa, tutti e due falsi, su una pagina corretta:
 *
 *   [block] slot `prenotazione-avviso-caparra` → prenota (/prenota): il valore
 *   pubblicato nel database non compare nel testo servito …
 *   [block] slot `prenotazione-avviso-caparra` → src/app/prenota/page.tsx: lo
 *   stesso testo sta CABLATO nei sorgenti …
 *
 * Il secondo accusava la pagina di aver cablato il contenuto mentre stava
 * facendo esattamente quello che la skill prescrive.
 */
export function frammentoDistintivo(valori, soglia = SOGLIA_FRAMMENTO, escludi = []) {
  const piuLungo = piuLungoDiContenuto(valori, escludi);
  return piuLungo && piuLungo.length >= soglia ? piuLungo : null;
}

/**
 * Il piu' lungo dei valori che sono davvero contenuto, SENZA guardare la soglia.
 *
 * Serve alla diagnosi, non al verdetto: quando uno slot resta sotto soglia, chi
 * legge il rosso deve sapere di quanto — «nessun valore lungo almeno 24» non
 * dice se il contenuto misura 23 o se la riga e' vuota, e la manopola (la riga
 * `Lunghezza minima del frammento distintivo:` del contratto) si gira solo
 * sapendo il numero. Sul banco del collaudo la differenza era fra 19 e 24, cioe'
 * fra un gate verde e quattro slot dichiarati non verificati per sempre.
 */
export function piuLungoDiContenuto(valori, escludi = []) {
  const fuori = new Set(escludi.map((v) => normalizzaSpazi(v ?? "")).filter(Boolean));
  return (
    (valori ?? [])
      .map((v) => normalizzaSpazi(v ?? ""))
      .filter((v) => v.length > 0 && !VALORE_TECNICO.test(v) && !fuori.has(v))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/**
 * Le tre regole del passo `contenuti-vivi`.
 *
 * @param {object} dati `{ contratto, valoriPerSlot, testoPerPagina, cercaNeiSorgenti, conteggiAnon, soglia }`
 *   - `valoriPerSlot`: Mappa chiave → elenco di valori di testo della riga
 *     pubblicata, con `null` sulle chiavi che nel database non hanno nessuna
 *     riga pubblicata. **`null` al posto della Mappa** significa un'altra cosa:
 *     la tabella dei contenuti non e' stata interrogata affatto;
 *   - `cercaNeiSorgenti`: funzione frammento → elenco di percorsi.
 * Ritorna `{ findings, mancanti }`: i `mancanti` sono verifiche NON fatte, e
 * tengono il passo su MANCANTE invece che su `pass`.
 */
export function findingsContenuti(dati) {
  const { contratto, valoriPerSlot, testoPerPagina, cercaNeiSorgenti, conteggiAnon, soglia } = dati;
  const findings = [];
  const mancanti = [];
  const percorsoDi = new Map(contratto.pagine.map((p) => [p.id, p]));

  // La tabella non e' stata letta: nessuno slot e' stato verificato, e dirlo
  // slot per slot come «nessuna riga pubblicata» manderebbe a cercare righe che
  // magari ci sono tutte. E' la differenza fra «ho misurato e non c'e'» e «non
  // ho misurato», ed e' la sola per cui questo passo esiste.
  if (valoriPerSlot === null || valoriPerSlot === undefined) {
    if (contratto.slot.length > 0) {
      mancanti.push(
        `tabella dei contenuti \`${contratto.tabellaContenuti?.tabella ?? "?"}\` non interrogata: ` +
        `nessuno dei ${contratto.slot.length} slot dichiarati e' stato verificato`,
      );
    }
    findings.push(...findingsFontiLeggibili(contratto, conteggiAnon, mancanti));
    return { findings, mancanti };
  }

  for (const s of contratto.slot) {
    const pagina = percorsoDi.get(s.pagina);
    if (!pagina) continue;
    const valori = valoriPerSlot.get(s.chiave);

    // DECISIONE S1, CHIUSA SUL BANCO IL 2026-08-03: `block`, non MANCANTE.
    //
    // I due casi del mandato — slot in bozza (`is_published = false`) e riga
    // assente del tutto — sono stati piantati sul banco Controtempo e danno lo
    // STESSO esito visibile: `/docenti` serve la sezione decapitata, con il
    // titolo di ripiego del codice e nessun testo sotto, e il `<title>` della
    // pagina scende da «Chi insegna · Controtempo» a «Docenti · Controtempo».
    // In tutti e due i casi il database ha RISPOSTO, e la risposta e' «per
    // questa chiave non c'e' niente di pubblicato»: e' una misura riuscita con
    // esito negativo, non una verifica che non si e' potuta fare. MANCANTE
    // avrebbe mandato chi legge a controllare `psql`, la porta e la
    // connessione — l'imputato sbagliato.
    if (valori === null || valori === undefined) {
      findings.push({
        severity: "block",
        object: `slot \`${s.chiave}\` → ${pagina.id} (${pagina.percorso})`,
        message: "il contratto lo dichiara e nel database non c'e' nessuna riga pubblicata con questa chiave: la pagina serve la sua sezione senza il testo che dovrebbe contenere",
        hint: "pubblica la riga (colonna di pubblicazione a vero), oppure togli lo slot dal contratto e fallo riconfermare. Se la chiave e' scritta in due modi fra vetrina e gestionale, il difetto e' quello",
      });
      continue;
    }

    // La chiave dello slot esce dai candidati: e' l'identificatore della riga,
    // non il suo contenuto (vedi `frammentoDistintivo`).
    const frammento = frammentoDistintivo(valori, soglia, [s.chiave]);
    if (!frammento) {
      // Il numero c'e' perche' senza numero questa riga non e' azionabile: la
      // soglia si dichiara nel contratto, e la si sposta solo sapendo di quanto.
      const piuLungo = piuLungoDiContenuto(valori, [s.chiave]);
      mancanti.push(
        `slot \`${s.chiave}\`: il valore di contenuto piu' lungo misura ${piuLungo?.length ?? 0} caratteri, ` +
        `sotto la soglia distintiva di ${soglia} — la ricerca non proverebbe niente in nessuna delle due ` +
        "direzioni, quindi quello slot NON e' stato verificato (la soglia si dichiara nel contratto, riga " +
        "`Lunghezza minima del frammento distintivo:`, e si ricava contando quanti slot restano fuori)",
      );
      continue;
    }

    findings.push(...findingsSlot({ slot: s, pagina, frammento, testoPerPagina, cercaNeiSorgenti, mancanti }));
  }

  findings.push(...findingsFontiLeggibili(contratto, conteggiAnon, mancanti));
  return { findings, mancanti };
}

function findingsSlot({ slot, pagina, frammento, testoPerPagina, cercaNeiSorgenti, mancanti }) {
  const findings = [];
  const testo = testoPerPagina.get(pagina.id);

  // La pagina non e' stata scaricata (non risponde, o rimanda altrove): la
  // meta' «la stringa e' in pagina» NON e' stata verificata, e tacere sarebbe
  // un `pass` su un controllo che non e' girato. Trovato col sabotaggio della
  // classe E il 2026-08-03: con `/contatti` a 404 il passo chiudeva «nessun
  // rilievo» avendo saltato in silenzio due slot su sei.
  if (testo === undefined) {
    mancanti.push(`slot \`${slot.chiave}\`: la pagina ${pagina.id} (${pagina.percorso}) non e' stata scaricata — non si e' potuto verificare se il testo compare in pagina`);
  }

  if (testo !== undefined && !testo.includes(frammento)) {
    findings.push({
      severity: "block",
      object: `slot \`${slot.chiave}\` → ${pagina.id} (${pagina.percorso})`,
      message: `il valore pubblicato nel database non compare nel testo servito della pagina che dovrebbe mostrarlo: «${frammento.slice(0, 60)}…»`,
      // La terza causa non e' teorica: e' stata misurata sul banco il
      // 2026-08-03. La Data Cache di Next SOPRAVVIVE a `next build`, quindi una
      // riga cambiata nel database non entra nella build nuova finche' non
      // scade la finestra di `revalidate` — e il gate vede giustamente una
      // pagina che non mostra cio' che il database dice. Senza questa riga la
      // diagnosi manderebbe a cercare un difetto nel codice della pagina, che
      // e' corretto.
      hint: "tre cause possibili: la pagina non legge quello slot; lo legge e non lo rende; oppure la build ha riusato la cache dei dati e sta servendo il contenuto di prima (`rm -rf .next/cache/fetch-cache && npm run build`)",
    });
  }

  const nei = cercaNeiSorgenti(frammento);
  if (nei.length > 0) {
    findings.push({
      severity: "block",
      object: `slot \`${slot.chiave}\` → ${nei.join(", ")}`,
      message: "lo stesso testo sta CABLATO nei sorgenti: che oggi coincida col database e' una coincidenza destinata a rompersi il primo giorno in cui il cliente cambia una parola",
      hint: "leggilo dal database e togli la stringa dal codice (DECISIONI.md §24)",
    });
  }

  if (pagina.aggiornamento.tipo === "statico") {
    findings.push({
      severity: "issue",
      object: `${pagina.id} (${pagina.percorso})`,
      message: `mostra lo slot \`${slot.chiave}\` ed e' dichiarata \`Aggiornamento: statico\`: il cliente cambiera' il testo dal gestionale e non vedra' cambiare niente finche' qualcuno non ripubblica`,
      hint: "e' una scelta legittima SE e' voluta: dichiarala nell'handoff, oppure passa a `ISR <secondi>` o `dinamico`",
    });
  }

  return findings;
}

/**
 * Le fonti dichiarate sono leggibili dall'anonimo?
 *
 * E' il modo n°1 in cui un sito pubblico sopra la RLS fallisce in silenzio: la
 * policy non lascia leggere, la pagina non da' nessun errore, e nessuno se ne
 * accorge finche' non lo dice un cliente.
 */
function findingsFontiLeggibili(contratto, conteggiAnon, mancanti) {
  const findings = [];
  const viste = new Set();

  for (const pagina of contratto.pagine) {
    for (const fonte of pagina.fonti.filter((f) => f.tipo !== "slot")) {
      if (viste.has(fonte.nome)) continue;
      viste.add(fonte.nome);
      const conteggio = conteggiAnon.get(fonte.nome);
      if (conteggio === null || conteggio === undefined) {
        mancanti.push(`fonte \`${fonte.nome}\`: non interrogata (${fonte.tipo} assente o non leggibile) — verifica non fatta`);
        continue;
      }
      if (conteggio === 0) {
        findings.push({
          severity: "block",
          object: `${fonte.tipo} \`${fonte.nome}\` → ${pagina.id}`,
          message: "zero righe leggibili impersonando il ruolo anonimo: la pagina e' viva e vuota, e nessuno se ne accorge finche' non lo dice un cliente",
          hint: "manca una policy di lettura per `anon`, o il seed: e' una richiesta a schema-forge, non una correzione qui",
        });
      }
    }
  }
  return findings;
}

// ------------------------------------------------- il database del PROGETTO
/**
 * Precedenza: `--db-url` esplicito > `config.toml` del progetto > MAI
 * l'ambiente. Una `SUPABASE_DB_URL` rimasta accesa da un altro progetto e'
 * esattamente il modo in cui il difetto nasce (DECISIONI.md §11 e §14).
 */
export function urlDbProgetto(testoConfig) {
  const valore = valoreToml(testoConfig, "db", "port");
  const porta = valore && /^(\d+)/.exec(valore.trim());
  return porta ? `postgresql://postgres:postgres@127.0.0.1:${porta[1]}/postgres` : null;
}

export function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${perRegExp(chiave)}\\s*=\\s*(.+)$`);
  let accumulato = null;

  for (const riga of righe(testoConfig)) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(riga);
    if (intestazione) {
      if (accumulato !== null) return accumulato;
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    if (accumulato !== null) {
      accumulato += ` ${riga.trim()}`;
      if (riga.includes("]")) return accumulato;
      continue;
    }
    if (!dentro) continue;
    const trovata = cerca.exec(riga);
    if (!trovata) continue;
    // Un elenco puo' stare su piu' righe: fermarsi alla prima significherebbe
    // leggere `["public",` e dichiarare uno schema solo (Schema Forge, punto 4
    // del collaudo del 2026-07-27).
    if (trovata[1].includes("[") && !trovata[1].includes("]")) { accumulato = trovata[1]; continue; }
    return trovata[1];
  }
  return accumulato;
}

/** Gli schemi esposti dall'API. Una chiave presente ma illeggibile NON ripiega
 *  su `public`: e' una verifica mancante. */
export function schemiEsposti(testoConfig) {
  const valore = valoreToml(testoConfig, "api", "schemas");
  if (valore === null) return ["public"];
  const dentro = /\[([\s\S]*?)\]/.exec(valore);
  if (!dentro) return null;
  const elenco = dentro[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean);
  return elenco.length > 0 ? elenco : null;
}

// --------------------------------------------------------- contratto d'uscita
export const verdettoDa = (passi) =>
  passi.some((s) => s.status !== "pass") ? "ROSSO" : "VERDE";

const RIGA_VERDETTO = /^[ \t>*_-]*Gate[ \t*_]*:[ \t*_]*(VERDE|ROSSO)\b/im;

/**
 * L'handoff dice il vero sul gate che lo verifica.
 *
 * Il testo si legge SENZA le zone citate: `references/sabotaggio.md` prescrive
 * di incollare nell'handoff l'uscita del gate, e un blocco recintato che
 * contiene «GATE VETRINA: ROSSO» non e' una dichiarazione — e' una prova
 * allegata. Flow Sentinel ha misurato il caso opposto il 2026-07-28: un handoff
 * che dichiarava VERDE su un gate ROSSO passava perche' piu' sopra citava il
 * rosso di un'altra esecuzione.
 */
export function contrattoUscita(percorsoHandoff, testoHandoff, verdettoPrima) {
  if (testoHandoff === null || testoHandoff === undefined) {
    return [{
      severity: "block",
      object: percorsoHandoff,
      message: "handoff assente: chi viene dopo non sa quali pagine esistono ne' cosa e' diventato pubblico (comando `handoff`)",
    }];
  }
  const proprio = senzaZoneCitate(testoHandoff);
  const findings = [];
  if (/\{\{/.test(proprio)) {
    findings.push({
      severity: "block",
      object: percorsoHandoff,
      message: "contiene segnaposto `{{…}}` non compilati: un template mezzo pieno non e' un handoff",
    });
  }
  const dichiarato = RIGA_VERDETTO.exec(proprio);
  if (!dichiarato) {
    findings.push({
      severity: "block",
      object: percorsoHandoff,
      message: `manca la riga \`Gate: ${verdettoPrima}\`: un handoff senza verdetto non si puo' confrontare con niente`,
    });
  } else if (dichiarato[1] !== verdettoPrima) {
    findings.push({
      severity: "block",
      object: percorsoHandoff,
      message: `dichiara \`Gate: ${dichiarato[1]}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`,
    });
  }
  return findings;
}
