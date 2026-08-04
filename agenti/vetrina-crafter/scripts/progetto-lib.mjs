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

/**
 * La tabella §Percorsi di scrittura aperti al pubblico, letta DALLA SUA
 * INTESTAZIONE come quella degli slot.
 *
 * Il template la prescrive con quattro colonne — Rotta, Cosa scrive, Tabella,
 * Chi l'ha autorizzato — e il gate ne legge due: la rotta (per nominarla nel
 * rilievo) e la tabella (per andarci a guardare). Una riga puo' dichiarare
 * `lettura pubblica`: e' l'eccezione firmata di un guestbook, dove essere
 * rileggibile e' il punto.
 */
function scrittureDaTabella(righeTabella) {
  const scritture = [];
  let indici = null;
  for (const linea of righeTabella) {
    if (eSeparatore(linea)) continue;
    const c = celle(linea);
    if (!indici) {
      const dove = (parola) => c.findIndex((x) => new RegExp(parola, "i").test(x));
      const rotta = dove("rotta");
      const tabella = dove("tabella");
      if (rotta >= 0 && tabella >= 0) indici = { rotta, tabella };
      continue;
    }
    const rotta = senzaApici(c[indici.rotta]);
    const tabella = senzaApici(c[indici.tabella]).toLowerCase();
    if (!rotta || !tabella) continue;
    scritture.push({
      rotta,
      tabella,
      letturaPubblica: /lettura pubblica/i.test(linea),
    });
  }
  return scritture;
}

/**
 * La tabella §Dati visibili a un anonimo, letta DALLA SUA INTESTAZIONE.
 *
 * E' la sezione per cui esiste la firma — pubblicare un dato e' irreversibile —
 * e fino al 2026-08-04 non la leggeva NESSUNO dei dieci passi, esattamente come
 * §Percorsi di scrittura prima del difetto n°5. Il template diceva «il gate non
 * la verifica riga per riga, non sa quali colonne DOVREBBERO essere pubbliche»:
 * non e' vero, gliele dichiara questa tabella, e quali siano concesse davvero lo
 * dice `information_schema.column_privileges`.
 *
 * La cella «Cosa vede» e' prosa per costruzione — dice anche il filtro e cosa
 * resta fuori — quindi le colonne si leggono SOLO nella testa della cella, come
 * corsa iniziale di identificatori fra apici. Raccoglierli ovunque nella cella
 * sarebbe un'euristica che sbaglia: sul banco del collaudo prendeva
 * `security_invoker` da «filtrate a monte dalla vista con `security_invoker`» e
 * `anon` da «nessuna policy di lettura per `anon`», cioe' due `block` falsi su
 * righe corrette. Un rosso strutturale insegna a scavalcare i rossi veri.
 *
 * Se la testa non elenca colonne, la riga NON e' confrontabile e chi chiama la
 * dichiara MANCANTE: e' il contratto a doverlo dire, non il gate a indovinarlo.
 *
 * Due dichiarazioni in testa alla cella hanno un significato proprio:
 *   `niente` / `nessuna colonna`  → l'anonimo non deve leggerne NULLA
 *   `tutte le colonne`            → la riga che il template dice di non scrivere
 *                                    mai; se qualcuno la scrive, si vede
 */
const COLONNE_IN_TESTA = /^[\s*_]*((?:`[a-z_][a-z0-9_]*`\s*(?:,|\be\b)?\s*)+)/i;
const NIENTE_IN_TESTA = /^[\s*_]*(niente|nessuna colonna|nulla)\b/i;

function lettureDaTabella(righeTabella) {
  const letture = [];
  let indici = null;
  for (const linea of righeTabella) {
    if (eSeparatore(linea)) continue;
    const c = celle(linea);
    if (!indici) {
      const dove = (parola) => c.findIndex((x) => new RegExp(parola, "i").test(x));
      const relazione = dove("tabella|vista");
      const vede = dove("vede|visitatore");
      if (relazione >= 0 && vede >= 0) indici = { relazione, vede };
      continue;
    }
    // La cella della relazione puo' portarsi dietro un'annotazione — `x` (vista)
    // — e il nome e' quello fra apici, non tutta la cella.
    const nome = /`([a-z_][a-z0-9_.]*)`/i.exec(c[indici.relazione] ?? "");
    const cella = c[indici.vede] ?? "";
    if (!nome) continue;
    const testa = COLONNE_IN_TESTA.exec(cella);
    letture.push({
      relazione: nome[1].toLowerCase(),
      colonne: testa ? [...testa[1].matchAll(/`([a-z_][a-z0-9_]*)`/gi)].map((m) => m[1].toLowerCase()) : [],
      niente: NIENTE_IN_TESTA.test(cella),
      tutte: /tutte le colonne/i.test(cella),
    });
  }
  return letture;
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
  const stato = { pagine: [], righeSlot: [], righeScritture: [], righeLetture: [], escluse: [], errori: [], visti: new Set(), corrente: null, sezione: null };

  for (const linea of righe(proprio)) {
    if (leggiIntestazione(linea, stato)) continue;
    if (stato.corrente) { leggiRigaPagina(linea, stato.corrente); continue; }
    if (stato.sezione === "slot" && /^\s*\|/.test(linea)) stato.righeSlot.push(linea);
    if (stato.sezione === "scritture" && /^\s*\|/.test(linea)) stato.righeScritture.push(linea);
    if (stato.sezione === "letture" && /^\s*\|/.test(linea)) stato.righeLetture.push(linea);
    if (stato.sezione === "escluse") {
      const m = /^\s*[-*]\s+`?(\/[^`\s]*)`?/.exec(linea);
      if (m) stato.escluse.push(m[1]);
    }
  }

  return {
    ...lettureGlobali(proprio),
    pagine: stato.pagine,
    slot: slotDaTabella(stato.righeSlot),
    scritture: scrittureDaTabella(stato.righeScritture),
    letture: lettureDaTabella(stato.righeLetture),
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
    // Stessa forma, e per la domanda piu' irreversibile delle due.
    nessunaScritturaDichiarata: /^\s*Nessuna scrittura pubblica\.?\s*$/im.test(proprio),
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
    stato.sezione = sezioneDa(linea);
    return true;
  }
  return false;
}

const sezioneDa = (linea) =>
  /slot/i.test(linea) ? "slot"
    : /esclus/i.test(linea) ? "escluse"
      : /scrittur/i.test(linea) ? "scritture"
        : /dati visibili|visibil\w* a un anonimo/i.test(linea) ? "letture"
          : null;

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
  // Stessa forma di «Nessuno slot.», e per la domanda che `SKILL.md` §Modalita'
  // dichiara irreversibile: se il contratto non dice ne' quali percorsi di
  // scrittura esistono ne' che non ce ne sono, non si distingue «non ce ne
  // sono» da «nessuno ha compilato la tabella».
  if (contratto.scritture.length === 0 && !contratto.nessunaScritturaDichiarata) {
    findings.push({
      severity: "issue",
      object: "docs/vetrina.md",
      message: "§Percorsi di scrittura aperti al pubblico non e' compilata e non dichiara `Nessuna scrittura pubblica.`: non si distingue «non ce ne sono» da «nessuno ci ha guardato»",
      hint: "e' una delle due domande che fermano la pipeline anche in automatico (SKILL.md §Modalita'): o si elencano le rotte che scrivono, o si scrive che non ce ne sono",
    });
  }

  // E la GEMELLA, sull'altra delle due domande irreversibili. Senza questa riga
  // un contratto che salta §Dati visibili a un anonimo non prende nessun
  // rilievo, e la regola 5 di `contenuti-vivi` non ha niente da confrontare:
  // saltare la sezione sarebbe il modo di far tacere il controllo piu' nuovo di
  // questo gate, cioe' esattamente il buco che `Nessuno slot.` era per la Legge
  // n°3 (vedi il collaudo P2, difetti 9 e 13).
  if (contratto.letture.length === 0) {
    findings.push({
      severity: "issue",
      object: "docs/vetrina.md",
      message: "§Dati visibili a un anonimo non e' compilata: nessuna relazione e' dichiarata, quindi nessuna puo' essere confrontata col `grant` — e cio' che un anonimo legge resta una cosa che non ha firmato nessuno",
      hint: "e' l'altra delle due domande che fermano la pipeline (SKILL.md §Modalita'): elenca le relazioni con le loro colonne, oppure scrivi `Nessun dato pubblico.` se il sito non ne legge nessuna",
    });
  }
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
 *
 * Riconosce DUE foglie, e la seconda e' il difetto n°11 del collaudo P2: un
 * `route.ts` serve una rotta pubblica quanto un `page.tsx`. Ritorna `null` per
 * tutto il resto (`layout`, `loading`, `not-found`, i componenti di pagina).
 */
const FOGLIA_ROTTA = /^(page|route)\.[jt]sx?$/;

export function rottaDaFile(percorso, radicePubblica) {
  const p = conBarre(percorso);
  const radice = conBarre(radicePubblica).replace(/\/+$/, "");
  if (!p.startsWith(`${radice}/`)) return null;
  const segmenti = p.slice(radice.length + 1).split("/");
  const foglia = FOGLIA_ROTTA.exec(segmenti.pop() ?? "");
  if (!foglia) return null;
  const utili = segmenti.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return {
    rotta: `/${utili.join("/")}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1"),
    tipo: foglia[1] === "route" ? "gestore" : "pagina",
  };
}

export function rotteDaSorgenti(percorsi, config) {
  const escluse = (config.radiciEscluse ?? []).map((r) => conBarre(r).replace(/\/+$/, ""));
  const rotte = [];
  for (const percorso of percorsi) {
    const p = conBarre(percorso);
    if (escluse.some((e) => p === e || p.startsWith(`${e}/`))) continue;
    const trovata = rottaDaFile(p, config.radicePubblica);
    if (trovata) rotte.push({ ...trovata, file: p });
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

  // Seconda direzione. Enumera l'albero delle rotte dai SORGENTI — i `page.tsx`
  // E i `route.ts`: fino al collaudo P2 i secondi non si contavano, e un
  // endpoint pubblico che rispondeva `200` con dei dati passava con dieci passi
  // verdi sopra (misurato sul banco il 2026-08-04). Restano invisibili qui, e
  // sono dichiarati nella specifica, solo cio' che nessun file rappresenta: una
  // riscrittura di `next.config`, una rotta servita dal middleware.
  for (const { rotta, file, tipo } of rotteSorgenti) {
    const dichiarata = pagine.some((p) => combacia(rotta, p.percorso));
    if (dichiarata || esclusa(rotta, escluse)) continue;
    findings.push({
      severity: "issue",
      object: rotta,
      message: tipo === "gestore"
        ? `rotta pubblica servita dal gestore \`${file}\` e non dichiarata nel contratto: non e' una pagina, e nessuno dei passi a valle puo' dire cosa risponde — ma chiunque la puo' chiamare, e nessuno l'ha firmata`
        : `rotta pubblica servita da \`${file}\` e non dichiarata nel contratto: e' una pagina che chiunque puo' aprire e che nessuno ha firmato`,
      hint: tipo === "gestore"
        ? "un `route.ts` non e' una pagina di vetrina: mettilo fra le §Pagine escluse dal contratto col perche' — e se scrive nel database, la sua riga va in §Percorsi di scrittura aperti al pubblico"
        : "aggiungila al contratto e falla riconfermare, oppure mettila fra le §Pagine escluse dal contratto col perche'",
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
  const { contratto, valoriPerSlot, testoPerPagina, cercaNeiSorgenti, conteggiAnon, soglia, letturaScritture, colonneConcesse, relazioniConcesse } = dati;
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
    findings.push(...findingsScritturePubbliche(contratto, letturaScritture, mancanti));
    findings.push(...findingsLetturePubbliche(contratto, colonneConcesse, mancanti, relazioniConcesse));
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

  findings.push(...findingsRigheNonDichiarate({ contratto, valoriPerSlot, cercaNeiSorgenti, soglia }));
  findings.push(...findingsFontiLeggibili(contratto, conteggiAnon, mancanti));
  findings.push(...findingsScritturePubbliche(contratto, letturaScritture, mancanti));
  findings.push(...findingsLetturePubbliche(contratto, colonneConcesse, mancanti, relazioniConcesse));
  return { findings, mancanti };
}

/**
 * Le righe pubblicate che NESSUNO slot dichiara, e che stanno nei sorgenti.
 *
 * MISURATO sul banco il 2026-08-04, ed e' la quinta classe cieca di
 * `sabotaggio.md`: «dichiara `Nessuno slot.` su un sito coi testi cablati» — o,
 * nella forma piu' subdola perche' non richiede di dichiarare niente, togli dal
 * contratto la riga di UN solo slot e cabla quel testo nel JSX. Sul banco:
 * 331 caratteri di `rifugio-storia` copiati dentro `il-rifugio/page.tsx`, la
 * riga sparita dalla tabella §Slot dei contenuti, e **gate VERDE 10/10**. Il
 * ciclo dei controlli girava su `contratto.slot`, quindi una riga tolta dal
 * contratto usciva dal perimetro insieme al suo difetto.
 *
 * La regola 2 (`la stringa non e' nei sorgenti`) esisteva gia': le mancava di
 * essere applicata a cio' che il contratto NON dichiara. Il database sa quali
 * righe sono pubblicate, e quelle sono un elenco che nessuno puo' accorciare
 * riscrivendo un documento.
 *
 * Cosa NON scatta: una riga pubblicata che nessuno slot dichiara e che nei
 * sorgenti non c'e'. Una tabella dei contenuti puo' servire anche pagine di un
 * altro contratto o il gestionale, e segnalarla sarebbe rumore su un fatto
 * legittimo. Quel che si segnala e' la coincidenza fra le due cose.
 */
function findingsRigheNonDichiarate({ contratto, valoriPerSlot, cercaNeiSorgenti, soglia }) {
  const dichiarate = new Set(contratto.slot.map((s) => s.chiave));
  const findings = [];
  for (const [chiave, valori] of valoriPerSlot) {
    if (dichiarate.has(chiave) || !Array.isArray(valori)) continue;
    const frammento = frammentoDistintivo(valori, soglia, [chiave]);
    if (!frammento) continue;
    const nei = cercaNeiSorgenti(frammento);
    if (nei.length === 0) continue;
    findings.push({
      severity: "block",
      object: `riga \`${chiave}\` → ${nei.join(", ")}`,
      message: "e' pubblicata nella tabella dei contenuti, nessuno slot del contratto la dichiara, e il suo testo sta CABLATO nei sorgenti: il cliente la cambia dal gestionale e la pagina non cambia",
      hint: "leggila dal database e dichiarala fra gli §Slot dei contenuti — togliere la riga dal contratto non toglie il testo dal codice, sposta solo il difetto fuori dal perimetro di chi guarda",
    });
  }
  return findings;
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
 *
 * `conteggiAnon` porta `{ stato, righe }`: `letta` con il conteggio, `negata`
 * quando il database ha risposto «permission denied», `assente` quando la
 * relazione non esiste. La chiave assente (o `null`) significa un'altra cosa —
 * non e' stata interrogata affatto — ed e' l'unica che resta MANCANTE.
 *
 * MISURATO sul banco del collaudo il 2026-08-04: prima, tutte e tre le
 * condizioni finivano nello stesso `null` e producevano la stessa riga —
 * «non interrogata (tabella assente o non leggibile) — verifica non fatta» —
 * su una tabella che esisteva benissimo e che l'anonimo NON deve poter leggere.
 * Una misura riuscita con esito negativo travestita da verifica mancante, cioe'
 * la diagnosi che manda a controllare `psql` invece della policy.
 */
function findingsFontiLeggibili(contratto, conteggiAnon, mancanti) {
  const findings = [];
  const viste = new Set();

  for (const pagina of contratto.pagine) {
    for (const fonte of pagina.fonti.filter((f) => f.tipo !== "slot")) {
      if (viste.has(fonte.nome)) continue;
      viste.add(fonte.nome);
      const esito = conteggiAnon.get(fonte.nome);
      if (esito === null || esito === undefined) {
        mancanti.push(`fonte \`${fonte.nome}\`: non interrogata — verifica non fatta`);
        continue;
      }
      const dove = `${fonte.tipo} \`${fonte.nome}\` → ${pagina.id}`;
      if (esito.stato === "assente") {
        findings.push({
          severity: "block",
          object: dove,
          message: `il contratto la dichiara come fonte della pagina e nel database non esiste nessuna relazione con questo nome`,
          hint: "o il nome nel contratto e' sbagliato, o la tabella non e' mai stata creata: nel secondo caso e' una richiesta a schema-forge",
        });
        continue;
      }
      if (esito.stato === "negata") {
        findings.push({
          severity: "block",
          object: dove,
          message: "esiste, ma impersonando il ruolo anonimo la lettura e' RIFIUTATA (permesso negato): la pagina che la dichiara non puo' funzionare con la chiave anonima",
          hint: "manca il `grant select` per `anon`, non (solo) la policy: sono due cose diverse e passano tutte e due o non passa niente. E' una richiesta a schema-forge",
        });
        continue;
      }
      if (esito.righe === 0) {
        findings.push({
          severity: "block",
          object: dove,
          message: "zero righe leggibili impersonando il ruolo anonimo: la pagina e' viva e vuota, e nessuno se ne accorge finche' non lo dice un cliente",
          hint: "manca una policy di lettura per `anon`, o il seed: e' una richiesta a schema-forge, non una correzione qui",
        });
      }
    }
  }
  return findings;
}

/**
 * Chi scrive non legge: le tabelle dei percorsi di scrittura pubblici NON
 * devono essere rileggibili da una sessione anonima.
 *
 * E' la meta' della domanda irreversibile che il contratto dichiara e che
 * nessuno dei dieci passi verificava. MISURATO sul banco del collaudo il
 * 2026-08-04, e il verde era immeritato: aperta la lettura di
 * `richieste_prenotazione` all'anonimo — due righe di SQL, `grant select` piu'
 * una policy `using (true)` — chiunque poteva rileggere nome, email, telefono e
 * messaggio di chi aveva scritto prima, e il gate chiudeva **VERDE 10/10**. A
 * monte non basta: l'audit RLS di schema-forge chiude quel caso con un `issue`
 * («legittima solo su dati realmente pubblici, e va documentata nell'handoff»),
 * cioe' rimanda proprio al documento che questo passo verifica.
 *
 * L'eccezione esiste e si dichiara: una riga della tabella che porta
 * `lettura pubblica` e' un guestbook, dove essere rileggibile e' il punto. Li'
 * il rilievo scende a `issue`, perche' resta una cosa da guardare.
 */
function findingsScritturePubbliche(contratto, letturaScritture, mancanti) {
  const findings = [];
  for (const scrittura of contratto.scritture ?? []) {
    const esito = letturaScritture?.get(scrittura.tabella);
    if (esito === null || esito === undefined) {
      mancanti.push(`percorso di scrittura \`${scrittura.rotta}\` → tabella \`${scrittura.tabella}\`: non interrogata — non si e' potuto verificare se l'anonimo la rilegge`);
      continue;
    }
    if (esito.stato === "assente") {
      findings.push({
        severity: "block",
        object: `${scrittura.rotta} → \`${scrittura.tabella}\``,
        message: "il contratto dichiara che questa rotta ci scrive, e nel database non esiste nessuna relazione con questo nome",
        hint: "o il nome nel contratto e' sbagliato, o il modulo pubblico sta scrivendo da un'altra parte",
      });
      continue;
    }
    if (esito.stato === "negata") continue; // chi scrive non legge: e' cosi' che deve andare
    findings.push({
      severity: scrittura.letturaPubblica ? "issue" : "block",
      object: `${scrittura.rotta} → \`${scrittura.tabella}\``,
      message: `una sessione anonima RILEGGE ${esito.righe} righe della tabella in cui chiunque scrive: dentro ci sono i dati di chi ha scritto prima${scrittura.letturaPubblica ? " (il contratto lo dichiara: `lettura pubblica`)" : ""}`,
      hint: "una casella in cui chiunque puo' imbucare non e' una casella che chiunque puo' aprire: servono `revoke select ... from anon` e nessuna policy di lettura per `anon`. E' una richiesta a schema-forge",
    });
  }
  return findings;
}

/**
 * Cio' che la firma dichiara pubblico e cio' che il `grant` concede davvero.
 *
 * MISURATO il 2026-08-04 sul banco del collaudo: la tabella §Dati visibili a un
 * anonimo elencava 22 colonne su tre relazioni, e `anon` ne poteva leggere 36.
 * Le quattordici in piu' — `id`, `pubblicata`, `created_at`, `updated_at`,
 * `chiave`, `in_evidenza` — nessuna pagina le seleziona e nessuno le ha firmate,
 * ma con la chiave anonima, che sta nel bundle, PostgREST le serve a chiunque:
 * `?select=*` non chiede permesso all'elenco del `select` delle nostre query.
 *
 * `sabotaggio.md` dichiarava questa classe CIECA. Non lo e': la colonna
 * concessa la dice `information_schema.column_privileges`, quella dichiarata la
 * dice il contratto, e la differenza e' una sottrazione.
 *
 * @param colonneConcesse Mappa relazione → `string[]` di colonne leggibili da
 *   `anon`, oppure `null` se la relazione non e' stata interrogata.
 */
/**
 * Prima della colonna, la RELAZIONE.
 *
 * Una tabella che `anon` legge e che §Dati visibili a un anonimo non nomina
 * affatto e' il caso piu' grande della stessa famiglia, e sfuggiva al confronto
 * per costruzione: si confrontavano solo le righe SCRITTE. MISURATO il
 * 2026-08-04 su `banco-prova-controtempo`, dove `strumenti` — concessa ad
 * `anon`, quindi leggibile da chiunque abbia la chiave che sta nel bundle — non
 * compare in nessuna riga del contratto.
 *
 * La sezione ASSENTE non si tratta qui: e' un difetto di FORMA del contratto, e
 * sta dov'e' gia' trattata l'assenza di §Percorsi di scrittura, cioe' al passo
 * `contratto-vetrina`. Qui si confronta cio' che e' scritto.
 */
function findingsRelazioniTaciute(contratto, relazioniConcesse, mancanti) {
  if ((contratto.letture ?? []).length === 0) return [];
  if (relazioniConcesse === null || relazioniConcesse === undefined) {
    mancanti.push("relazioni leggibili da `anon` non elencate: non si e' potuto verificare che §Dati visibili a un anonimo le nomini tutte");
    return [];
  }
  const dichiarate = new Set(contratto.letture.map((l) => l.relazione.split(".").pop()));
  const taciute = [...relazioniConcesse].filter((r) => !dichiarate.has(r.split(".").pop()));
  if (taciute.length === 0) return [];
  return [{
    severity: "block",
    object: "§Dati visibili a un anonimo",
    message: `\`anon\` puo' leggere ${taciute.length} relazioni che la sezione non nomina: ${taciute.join(", ")}`,
    hint: "una tabella che non compare in questa sezione e' una tabella che nessuno ha firmato: aggiungile una riga con le sue colonne e falla riconfermare, oppure chiedi a schema-forge il `revoke` se non deve essere pubblica",
  }];
}

function findingsLetturePubbliche(contratto, colonneConcesse, mancanti, relazioniConcesse) {
  const findings = [];

  // Prima della colonna, la RELAZIONE. Una tabella che `anon` legge e che la
  // sezione non nomina affatto e' il caso piu' grande della stessa famiglia, e
  // sfuggiva al confronto per costruzione: si confrontavano solo le righe
  // scritte. MISURATO il 2026-08-04 su `banco-prova-controtempo`, dove
  // `strumenti` — concessa ad `anon`, quindi leggibile da chiunque abbia la
  // chiave del bundle — non compare in nessuna riga del contratto.
  findings.push(...findingsRelazioniTaciute(contratto, relazioniConcesse, mancanti));

  for (const lettura of contratto.letture ?? []) {
    const concesse = colonneConcesse?.get(lettura.relazione);
    if (concesse === null || concesse === undefined) {
      mancanti.push(`\`${lettura.relazione}\` (§Dati visibili a un anonimo): privilegi di colonna non interrogati — non si e' potuto verificare che cio' che e' concesso sia cio' che e' firmato`);
      continue;
    }

    // La riga che il template dice di non scrivere mai. Non si trasforma in un
    // `block` sulle colonne: chi l'ha scritta ha firmato consapevolmente una
    // cosa sbagliata, e il rilievo giusto e' su quella riga, non sull'elenco.
    if (lettura.tutte) {
      findings.push({
        severity: "block",
        object: `\`${lettura.relazione}\` (§Dati visibili a un anonimo)`,
        message: `la riga dichiara «tutte le colonne» (${concesse.length} concesse a \`anon\`): il template la chiama la riga da non scrivere mai, perche' una colonna pubblicata non torna piu' privata`,
        hint: "elenca le colonne che servono davvero alle pagine e chiedi a schema-forge un `grant select (…)` di sole quelle",
      });
      continue;
    }

    if (lettura.colonne.length === 0 && !lettura.niente) {
      mancanti.push(`\`${lettura.relazione}\` (§Dati visibili a un anonimo): la riga non elenca nessuna colonna fra apici e non dichiara «niente» — non c'e' niente da confrontare col \`grant\`, e quella riga NON e' stata verificata`);
      continue;
    }

    const dichiarate = new Set(lettura.colonne);
    const inPiu = concesse.filter((c) => !dichiarate.has(c));
    const promesse = lettura.colonne.filter((c) => !concesse.includes(c));

    if (inPiu.length > 0) {
      findings.push({
        severity: "block",
        object: `\`${lettura.relazione}\` (§Dati visibili a un anonimo)`,
        message: lettura.niente
          ? `la riga dichiara che un anonimo non ne vede niente, e \`anon\` ha invece \`select\` su ${inPiu.length} colonne: ${inPiu.join(", ")}`
          : `\`anon\` puo' leggere ${inPiu.length} colonne che la firma non dichiara: ${inPiu.join(", ")}`,
        hint: "cio' che e' pubblico lo decide il `grant` piu' la policy, non l'elenco del `select` delle pagine: con la chiave anonima, che sta nel bundle, PostgREST serve `?select=` a chiunque. O le si aggiunge alla riga e le si fa rifirmare, o si chiede a schema-forge un `grant select (…)` di sole quelle che servono",
      });
    }

    if (promesse.length > 0) {
      // `block` e non `issue`, e la ragione e' misurata (banco del collaudo,
      // 2026-08-04): PostgREST rifiuta con `42501` l'INTERA query, non la sola
      // colonna. Una colonna dichiarata e non concessa non impoverisce una
      // cella — svuota la pagina, in silenzio, e il conteggio delle righe che
      // il passo fa impersonando `anon` continua a riuscire perche' `count(*)`
      // non ha bisogno di quella colonna. Nessun altro controllo lo vedrebbe.
      // Non e' un rosso strutturale: se il `grant` e' di tabella — il caso
      // normale — le concesse sono tutte, e questo ramo non puo' scattare.
      findings.push({
        severity: "block",
        object: `\`${lettura.relazione}\` (§Dati visibili a un anonimo)`,
        message: `la firma dichiara ${promesse.length} colonne che \`anon\` NON puo' leggere: ${promesse.join(", ")}`,
        hint: "PostgREST risponde `42501` all'intera query, non alla singola colonna: se una pagina le seleziona, quella pagina si serve VUOTA senza nessun errore visibile. O si chiede il `grant` mancante a schema-forge, o la riga del contratto e' vecchia e va corretta e rifirmata",
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- psql
/** Separatori di record e di campo: due caratteri di controllo, perche' un
 *  valore di testo puo' contenere a capo, tabulazioni e barre verticali. */
const RECORD_PSQL = "";
const CAMPO_PSQL = "";

/**
 * Gli argomenti con cui questo gate chiama `psql`.
 *
 * Stanno qui, in una funzione pura con il suo test, per una ragione misurata:
 * `-q` non e' cosmetica. Senza, `psql` stampa su STDOUT il TAG DEL COMANDO —
 * `SET` per `set role anon` — e quel tag finisce nel primo record insieme al
 * valore, perche' `-R` sostituisce il terminatore di RIGA e non quello di una
 * riga di stato. Il conteggio letto diventa `SET0`, `Number(…)` da' `NaN`, e
 * `NaN === 0` e' falso: la regola «zero righe leggibili impersonando il ruolo
 * anonimo» — quella che la specifica chiama il modo n°1 in cui un sito pubblico
 * sopra la RLS fallisce in silenzio — non poteva scattare.
 *
 * MISURATO sul banco `banco-prova-valscura` il 2026-08-04: tolta la policy di
 * lettura per `anon` su `camere`, il gate di P1 nomina le zero righe ZERO volte.
 */
export function argomentiPsql(dbUrl, sql) {
  return [dbUrl, "-q", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-R", RECORD_PSQL, "-F", CAMPO_PSQL, "-c", sql];
}

/** Da `stdout` di `psql` a righe di campi. I CRLF si tolgono qui, una volta
 *  sola: su Windows `psql` lascia il ritorno a capo in coda a ogni riga. */
export function righeDaPsql(stdout) {
  return senzaBom(stdout ?? "")
    .split(RECORD_PSQL)
    .map((r) => r.replace(/\r?\n/g, "").trim())
    .filter(Boolean)
    .map((r) => r.split(CAMPO_PSQL));
}

// ------------------------------------------------------------- i tipi
/**
 * La riga di diagnosi in coda agli errori di `tsc`, e a chi mandano.
 *
 * MISURATO sul banco il 2026-08-04, ed e' la seconda delle due trappole di Next
 * dichiarate nel §7 del verbale di costruzione. Cancellato un `route.ts` e
 * rilanciato il gate senza ricostruire, `tsc` falliva su un file che il progetto
 * non ha scritto:
 *
 *   .next/types/validator.ts(134,39): error TS2307: Cannot find module
 *   '../../src/app/disponibilita/route.js'
 *
 * e la riga in coda diceva «se la colonna e' cambiata a monte, il segnale e' di
 * schema-forge e si riporta»: manda a cercare una migrazione in un altro
 * pacchetto, mentre la causa e' che **i tipi di rotta generati sono uno STATO**
 * che sopravvive alla cancellazione del file, e si toglie con un comando.
 *
 * La gravita' non cambia — i tipi non compilano davvero, e un progetto cosi' non
 * si consegna — ma l'imputato si': `.next/` non e' un sorgente di questo
 * progetto, e un errore che viene solo da li' e' una cache da buttare.
 */
export function diagnosiTipi(righeErrore) {
  const daNext = righeErrore.filter((r) => /^\s*\.?[\\/]?(\.next)[\\/]/.test(conBarre(r).replace(/^\.\//, "")));
  const generati = daNext.length;
  const propri = righeErrore.length - generati;

  if (generati === 0) {
    return "Costruire su tipi vecchi e' il modo n°1 di costruire sul falso: se la colonna e' cambiata a monte, il segnale e' di schema-forge e si riporta, non si aggiusta a mano.";
  }
  const dentroNext =
    `${generati} ${generati === 1 ? "errore viene" : "errori vengono"} da \`.next/\`, che NON e' un sorgente di questo progetto: ` +
    "i tipi di rotta che Next genera sono uno STATO, e sopravvivono alla build — una rotta cancellata o rinominata resta citata li' dentro. " +
    "Si tolgono, non si aggiustano: `rm -rf .next/types .next/dev/types && npm run build`, poi rilancia il gate.";
  if (propri === 0) return dentroNext;
  return `${dentroNext}\nGli altri ${propri}: costruire su tipi vecchi e' il modo n°1 di costruire sul falso — se la colonna e' cambiata a monte, il segnale e' di schema-forge e si riporta, non si aggiusta a mano.`;
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
