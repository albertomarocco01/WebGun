/**
 * progetto-lib.mjs — Le regole del CONTRATTO del progetto, senza I/O.
 *
 * Qui sta cio' che risponde a due domande che nessun linter pone:
 *   «di quali tabelle il cliente puo' davvero occuparsi?» (§entita ancorate)
 *   «l'handoff dice la verita' sul gate che lo sta verificando?» (§contratto)
 *
 * Importa `dentroGraffe` da `audit-lib.mjs` invece di riscriverlo: e' una
 * decisione, non una svista. Schema Forge tiene le sue due librerie
 * indipendenti e paga otto righe di duplicazione; qui le due librerie fanno
 * parte dello stesso audit e girano sempre insieme, quindi la dipendenza non
 * accoppia niente che fosse separato.
 */

import { conBarre, dentroGraffe, perRegExp, stringheOscurate } from "./audit-lib.mjs";

// ─── le tabelle vere: quelle dei tipi generati ───────────────────────────────
// L'elenco delle entita' non lo dichiara l'agente: verrebbe da se' stesso, e un
// gate che verifica cio' che l'agente ha deciso non verifica niente. La fonte e'
// `src/lib/database.types.ts`, che lo rigenera `supabase gen types` DALLO
// SCHEMA REALE — cioe' da schema-forge, a monte.
export function tabelleDaiTipi(testo, schema = "public") {
  const codice = String(testo ?? "");
  const inizioSchema = new RegExp(`(^|\\s)${perRegExp(schema)}\\s*:\\s*\\{`, "m").exec(codice);
  if (!inizioSchema) return [];

  const apertura = codice.indexOf("{", inizioSchema.index);
  const blocco = dentroGraffe(codice, apertura);

  const inizioTabelle = /\bTables\s*:\s*\{/.exec(blocco);
  if (!inizioTabelle) return [];

  const bloccoTabelle = dentroGraffe(blocco, blocco.indexOf("{", inizioTabelle.index));
  return chiaviDiPrimoLivello(bloccoTabelle);
}

/** Le chiavi al primo livello di un blocco `{ ... }`. `[_ in never]: never` —
 *  la forma che Supabase genera per uno schema vuoto — non e' una tabella. */
export function chiaviDiPrimoLivello(blocco) {
  // Le graffe si contano sulla STRUTTURA (concilio, 2026-08-07). `tabelleDaiTipi`
  // arriva qui passando da `dentroGraffe`, che le stringhe le sa saltare; questa,
  // che legge DENTRO il blocco, no — e un tipo letterale con una graffa spaiata
  // (l'etichetta di un enum, che la scrive il progetto auditato) faceva sparire
  // in silenzio tutte le tabelle successive dall'ancoraggio. Il nome si legge dal
  // testo vero alla stessa posizione: e' per questo che la maschera conserva la
  // lunghezza.
  const struttura = stringheOscurate(blocco);
  const chiavi = [];
  let livello = 0;
  const re = /[{}]|(^|[,{\s])["']?([A-Za-z_][\w]*)["']?\s*:/g;
  let m;
  while ((m = re.exec(struttura)) !== null) {
    if (m[0] === "{") livello += 1;
    else if (m[0] === "}") livello -= 1;
    else if (livello === 1 && m[2] && m[2] !== "never") chiavi.push(m[2]);
  }
  return [...new Set(chiavi)];
}

// ─── la configurazione del progetto ──────────────────────────────────────────
// E' il `supabase/config.toml` di questo agente: senza, il gate non sa nemmeno
// dove sia il gestionale. Un default silenzioso (`src/app/admin`) farebbe
// passare per «audit completo» un audit su una cartella inesistente.
const CHIAVI_OBBLIGATORIE = ["adminRoot", "guardie", "entita"];

/**
 * `adminRoot` non e' una stringa qualsiasi: e' un percorso che questo gate
 * concatena e passa a `cmd.exe /c` (il passo `a11y` lo da' a ESLint) e con cui
 * costruisce le rotte da cercare su disco. Lo scrive il PROGETTO AUDITATO.
 *
 * Fino al 2026-08-06 `validaConfig` lo controllava con `!== undefined`: nemmeno
 * un controllo di tipo (referto § H2). Misurato lo stesso giorno: `src/app/admin&calc`
 * si crea davvero su Windows, e attraverso `cmd /c` l'argomento si troncava —
 * con lo status che restava 0, cioe' ESLint girava su un'altra cartella e il
 * passo diventava verde.
 *
 * Le quattro condizioni sono le sole che rendono `adminRoot` cio' che il resto
 * del gate presume: una stringa, non vuota, RELATIVA alla radice del progetto e
 * senza risalite. Non e' una restrizione nuova: e' quella che il codice dava
 * gia' per scontata senza dirlo.
 */
// I caratteri di CONTROLLO sono proprio cio' che si cerca: un a capo dentro
// un argomento e' una riga di comando in piu' per `cmd`. `no-control-regex`
// esiste per chi ce li mette per sbaglio (DECISIONI.md §8: ogni esenzione ha
// il motivo sulla riga sopra).
// eslint-disable-next-line no-control-regex
const OSTILE_IN_PERCORSO = /[\s&|<>^()"%*?]|[\u0000-\u001f]/;

export function erroriAdminRoot(valore) {
  if (typeof valore !== "string") return [`\`adminRoot\` deve essere una stringa, non ${valore === null ? "null" : typeof valore}`];
  const pulito = valore.trim();
  if (pulito === "") return ["`adminRoot` e' vuoto: la radice del gestionale sarebbe la radice del progetto, e ogni rotta esisterebbe"];
  const errori = [];
  if (/^([a-zA-Z]:)?[\\/]/.test(pulito)) {
    errori.push("`adminRoot` deve essere RELATIVO alla radice del progetto: un percorso assoluto porta l'audit fuori dal progetto che sta giudicando");
  }
  if (pulito.split(/[\\/]/).includes("..")) {
    errori.push("`adminRoot` contiene `..`: risalire sopra la radice porta l'audit fuori dal progetto che sta giudicando");
  }
  if (OSTILE_IN_PERCORSO.test(pulito)) {
    errori.push("`adminRoot` contiene un metacarattere di shell (& | < > ^ ( ) \" % * ?): questo percorso viene passato a `cmd.exe /c`, che lo ri-analizza — l'argomento arriverebbe troncato e lo strumento risponderebbe 0 su un'altra cartella");
  }
  return errori;
}

export function validaConfig(oggetto) {
  const errori = [];
  if (!oggetto || typeof oggetto !== "object") {
    return { errori: ["gestionale.config.json non e' un oggetto JSON"] };
  }
  for (const chiave of CHIAVI_OBBLIGATORIE) {
    if (oggetto[chiave] === undefined) errori.push(`manca la chiave \`${chiave}\``);
  }
  if (oggetto.adminRoot !== undefined) errori.push(...erroriAdminRoot(oggetto.adminRoot));
  if (Array.isArray(oggetto.guardie) && oggetto.guardie.length === 0) {
    errori.push("`guardie` e' vuoto: senza il nome delle funzioni di guardia, la regola sulle rotte non puo' scattare mai");
  }
  if (oggetto.entita !== undefined && !Array.isArray(oggetto.entita)) {
    errori.push("`entita` deve essere un elenco");
  }
  return { errori };
}

// ─── la premessa del passo `tsc` ─────────────────────────────────────────────
// `tsc --noEmit` legge il `tsconfig.json` del PROGETTO, ed e' giusto cosi': i
// percorsi, gli alias e i tipi di quel progetto li conosce solo lui. Ma con
// `strict: false` TypeScript non riporta la meta' degli errori che riporterebbe
// altrimenti, ed esce 0 su codice che un controllo vero boccia — la stessa forma
// dell'ESLint a zero regole del passo `a11y` (referto § H8).
//
// La correzione non e' imporre un `tsconfig` della skill (romperebbe gli alias
// del progetto): e' CONTARE LA PREMESSA. Con quale configurazione si e'
// misurato, e quel controllo era acceso? Se non lo era, il passo e' una verifica
// mancante, non un successo.
//
// `strict` deve essere dichiarato ESPLICITAMENTE `true`: ereditato da un
// `extends` questo controllo non lo vede, e «non lo so» non e' «va bene».
/**
 * Toglie i commenti da un JSONC SAPENDO DOV'E'.
 *
 * Fino al 2026-08-06 questo lavoro lo facevano due `replace` con una regexp —
 * una per il commento a blocco, una per quello di riga, guardata solo dal
 * `://` — e una regexp non sa se si trova dentro una stringa. La prova che
 * questo file non puo' nemmeno citarle per intero vale quanto la misura: la
 * chiusura di commento dentro un'altra regexp chiuderebbe QUESTO commento,
 * che e' lo stesso guasto un piano piu' su.
 *
 * Misurato sul `tsconfig.json` del pilota — 655 byte
 * di JSON valido, che `JSON.parse` legge senza un fiato:
 *
 *   primo `/*` a offset 466, dentro `"@/*": ["./src/*"]`
 *   prima chiusura di commento a offset 536, dentro il `"**` + `/*.ts"` di `include`
 *   → 72 caratteri di JSON valido divorati in un colpo, 102 in tutto
 *   → «tsconfig.json non interpretabile (Expected ':' … at position 472)»
 *
 * `"@/*"` e' l'alias che `create-next-app` scrive in OGNI progetto Next: lo
 * spogliatore rompeva il caso che capita sempre per tollerare quello che, come
 * diceva il commento qui sopra, «`create-next-app` non mette».
 *
 * Lo scanner tiene due stati — dentro una stringa, dietro un `\` — che sono
 * esattamente cio' che alla regexp mancava. Il `\n` di un `//` non si consuma:
 * togliere una riga sposterebbe le righe di tutti gli errori successivi.
 */
export function senzaCommentiJson(testo) {
  const sorgente = String(testo ?? "");
  let fuori = "";
  let inStringa = false;
  let i = 0;

  while (i < sorgente.length) {
    const c = sorgente[i];

    if (inStringa) {
      if (c === "\\") {
        fuori += c + (sorgente[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (c === '"') inStringa = false;
      fuori += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inStringa = true;
      fuori += c;
      i += 1;
      continue;
    }
    if (c === "/" && sorgente[i + 1] === "*") {
      const fine = sorgente.indexOf("*/", i + 2);
      fuori += " ";
      i = fine === -1 ? sorgente.length : fine + 2;
      continue;
    }
    if (c === "/" && sorgente[i + 1] === "/") {
      const fine = sorgente.indexOf("\n", i + 2);
      fuori += " ";
      i = fine === -1 ? sorgente.length : fine;
      continue;
    }

    fuori += c;
    i += 1;
  }

  return fuori;
}

export function premessaTsc(testoTsconfig) {
  const testo = String(testoTsconfig ?? "");
  let config;
  try {
    // PRIMA IL FILE COM'E'. Un `tsconfig.json` valido — la grandissima
    // maggioranza — non ha bisogno di nessuno spogliatore, e farlo passare da
    // uno e' l'unico modo di romperlo.
    config = JSON.parse(testo);
  } catch (erroreGrezzo) {
    // SOLO ALLORA la tolleranza JSONC: i `tsconfig.json` ammettono commenti, e
    // `create-next-app` non ne mette ma altri strumenti si'. Le virgole finali
    // no: se il file non si legge nemmeno cosi', e' una premessa mancante come
    // le altre.
    const spogliato = senzaCommentiJson(testo);
    try {
      config = JSON.parse(spogliato);
    } catch (erroreSpogliato) {
      // Quale dei due errori si stampa non e' indifferente: la posizione deve
      // riferirsi a un testo che chi legge puo' aprire. Se non c'erano commenti
      // i due testi sono lo stesso e vale il grezzo; se c'erano, la posizione
      // del grezzo indica il commento — che in JSONC e' lecito — e mentirebbe.
      const errore = spogliato === testo ? erroreGrezzo : erroreSpogliato;
      const dove = spogliato === testo ? "" : ", una volta tolti i commenti";
      return { strict: false, motivo: `tsconfig.json non interpretabile (${errore.message}${dove}): non si sa con quali controlli \`tsc\` abbia misurato` };
    }
  }
  const opzioni = config?.compilerOptions ?? {};
  if (opzioni.strict === true) return { strict: true, motivo: null };
  if (opzioni.strict === undefined) {
    return {
      strict: false,
      motivo: config?.extends
        ? "`compilerOptions.strict` non e' dichiarato in questo tsconfig.json (arriverebbe da `extends`): il gate non risale la catena, e «non lo so» non e' «va bene». Dichiaralo qui"
        : "`compilerOptions.strict` non e' dichiarato: senza, TypeScript non riporta meta' degli errori e `tsc --noEmit` esce 0 su codice che un controllo vero boccia",
    };
  }
  return { strict: false, motivo: "`compilerOptions.strict` e' `false`: `tsc --noEmit` esce 0 su codice che un controllo vero boccia, e un passo verde qui direbbe il contrario di cio' che e' successo" };
}

// ─── l'ancoraggio: nessuna tabella sparisce in silenzio ──────────────────────
// La differenza fra le tabelle dello schema e le entita' gestite non si chiude
// «perche' l'agente ha deciso cosi'»: o c'e' una vista, o c'e' una motivazione
// scritta. Il terzo caso — la tabella dimenticata — e' quello che il cliente
// scopre in produzione, quando gli serve.
const MOTIVO_MINIMO = 20;

/**
 * Una rotta e' un pezzo di percorso sotto la radice admin, e non altro.
 *
 * Il gate chiedeva soltanto «esiste?», con `join(progetto, adminRoot, rotta)`.
 * Misurato il 2026-08-06 (referto § H9 e § M8), su una radice che esiste:
 *
 *   rotta ""                       → join = <adminRoot>     esiste = true   findings = 0
 *   rotta assente                  → join = <adminRoot>     esiste = true   findings = 0
 *   rotta "../../../../../Windows" → join = C:\Windows      esiste = true   findings = 0
 *   rotta "prodotti"               → join = …\prodotti      esiste = false  findings = 1
 *
 * Cioe': la stringa vuota faceva esistere QUALUNQUE rotta — la radice admin
 * esiste sempre — e un `..` bastava a spostare la domanda su una cartella che
 * col progetto non c'entra niente. In entrambi i casi il passo stampava
 * «N tabelle nei tipi» e chiudeva verde.
 *
 * Il messaggio conta quanto il verdetto: «la rotta `` non esiste» manderebbe a
 * cercare una cartella, quando il difetto e' che quella non e' una rotta.
 */
export function erroreDiRotta(rotta) {
  if (rotta === undefined || rotta === null) {
    return "`rotta` non dichiarata: senza, il gate cercherebbe la radice admin — che esiste sempre — e ogni entita' risulterebbe gestita";
  }
  if (typeof rotta !== "string") return `\`rotta\` deve essere una stringa, non ${typeof rotta}`;
  const pulita = rotta.trim();
  if (pulita === "") {
    return "`rotta` vuota: la vista sarebbe la radice admin stessa, che esiste sempre — e ogni entita' risulterebbe gestita senza che nessuno abbia guardato";
  }
  if (/^([a-zA-Z]:)?[\\/]/.test(pulita)) {
    return "`rotta` deve essere RELATIVA alla radice admin: un percorso assoluto sposta la domanda fuori dal progetto";
  }
  if (pulita.split(/[\\/]/).includes("..")) {
    return "`rotta` contiene `..`: risalendo sopra la radice admin la domanda «la vista esiste?» finisce su una cartella che col gestionale non c'entra (misurato: `../../../../../Windows` esiste, e cancellava il rilievo)";
  }
  return null;
}

export function regolaEntitaAncorate(tabelle, config, esisteRotta) {
  const findings = [];
  const gestite = new Map((config.entita ?? []).map((e) => [e.tabella, e]));
  const escluse = new Map((config.escluse ?? []).map((e) => [e.tabella, e]));

  for (const tabella of tabelle) {
    const gestita = gestite.get(tabella);
    if (gestita) {
      // PRIMA la forma, poi l'esistenza: chiedere «esiste?» a una rotta che non
      // e' una rotta ha gia' dato tre risposte sbagliate su quattro.
      const errata = erroreDiRotta(gestita.rotta);
      if (errata) {
        findings.push({
          severity: "block",
          object: tabella,
          message: `entita' dichiarata gestita, ma ${errata}`,
          hint: "scrivi la rotta come pezzo di percorso sotto la radice admin, per esempio `prodotti` o `ordini/righe`",
        });
      } else if (!esisteRotta(gestita.rotta)) {
        findings.push({
          severity: "block",
          object: tabella,
          message: `entita' dichiarata gestita ma la rotta \`${gestita.rotta}\` non esiste sotto ${conBarre(config.adminRoot)}`,
          hint: "genera la vista, oppure spostala fra le `escluse` con la motivazione",
        });
      }
      continue;
    }

    const esclusa = escluse.get(tabella);
    if (!esclusa) {
      findings.push({
        severity: "block",
        object: tabella,
        message: "tabella dello schema senza vista di gestione e senza motivazione: il cliente non ha modo di occuparsene, e nessuno ha deciso che vada bene cosi'",
        hint: "o una vista CRUD, o una riga in `escluse` con il motivo scritto — la terza strada e' la tabella che si scopre mancante in produzione",
      });
      continue;
    }

    if (String(esclusa.motivo ?? "").trim().length < MOTIVO_MINIMO) {
      findings.push({
        severity: "block",
        object: tabella,
        message: "tabella esclusa senza una motivazione leggibile: un'esclusione senza motivo e' una dimenticanza con l'aria di una decisione",
        hint: `scrivi perche' il cliente non deve gestirla (almeno ${MOTIVO_MINIMO} caratteri)`,
      });
    }
  }

  for (const [tabella] of gestite) {
    if (!tabelle.includes(tabella)) {
      findings.push({
        severity: "block",
        object: tabella,
        message: "entita' dichiarata che nello schema non esiste: i tipi generati non la conoscono",
        hint: "rigenera i tipi (`supabase gen types`) o correggi il nome. Se la tabella serve, la scrive schema-forge, non questo agente",
      });
    }
  }

  return findings;
}

// ─── il contratto d'uscita ───────────────────────────────────────────────────
// Stessa forma di Schema Forge, e per lo stesso motivo: un passo che controlla
// che un file ESISTA non fa rispettare la clausola del CLAUDE.md per cui e'
// nato. Il verdetto dichiarato si confronta con quello misurato.
export const HANDOFF = "docs/handoff/10-gestionale-crafter.md";

const RIGA_VERDETTO = /^[\s>*_-]*Gate[\s*_]*:[\s*_]*(VERDE|ROSSO)\b/im;

export function verdettoDa(passi) {
  return passi.some((s) => s.status !== "pass") ? "ROSSO" : "VERDE";
}

export function contrattoUscita(esiste, leggi, verdettoPrima) {
  if (!esiste(HANDOFF)) {
    return {
      status: "fail",
      detail: `${HANDOFF} assente: il passaggio a valle non e' valido (comando \`handoff\`)`,
    };
  }

  const testo = leggi(HANDOFF);
  const mancanti = [];

  if (testo.includes("{{")) {
    mancanti.push(`${HANDOFF} contiene segnaposto {{...}} non compilati`);
  }

  const dichiarato = RIGA_VERDETTO.exec(testo)?.[1]?.toUpperCase() ?? null;
  if (dichiarato === null) {
    mancanti.push(
      `${HANDOFF} non dichiara il verdetto del gate: serve una riga \`Gate: ${verdettoPrima}\`. Chi viene dopo non deve rilanciare il gate per sapere com'era chiuso`,
    );
  } else if (dichiarato !== verdettoPrima) {
    mancanti.push(
      `${HANDOFF} dichiara \`Gate: ${dichiarato}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`,
    );
  }

  return {
    status: mancanti.length === 0 ? "pass" : "fail",
    detail: mancanti.join("\n"),
  };
}

// ─── il database del PROGETTO, non un altro ──────────────────────────────────
// Stessa regola di Schema Forge, e per lo stesso incidente: la porta 54322 e'
// il default, e su una macchina con due stack Supabase accesi e' il database di
// un altro cliente. Precedenza: `--db-url` esplicito > `config.toml` > MAI
// l'ambiente. Senza porta risolvibile non si audita alla cieca.
export function urlDbProgetto(testoConfig) {
  const valore = valoreToml(testoConfig, "db", "port");
  const porta = valore && /^(\d+)/.exec(valore.trim());
  return porta ? `postgresql://postgres:postgres@127.0.0.1:${porta[1]}/postgres` : null;
}

/**
 * Il `#` che apre un commento TOML, e quello che non lo apre.
 *
 * Qui la chiave letta e' una sola, `[db].port`, e il `/^(\d+)/` che la
 * interpreta reggeva gia' un `port = 54322 # il db locale`. La funzione arriva
 * lo stesso, e per una ragione dichiarata: e' la stessa forma di `valoreToml`
 * che nelle due skill sorelle produceva schemi fantasma (referto § M13) e mezze
 * URL (§ L7), e la prossima chiave che qualcuno leggera' da qui non avra' un
 * `/^(\d+)/` a proteggerla. Uno scanner immune per fortuna torna difettoso al
 * primo riuso.
 *
 * LIMITE DICHIARATO: le stringhe multi-riga (`"""`, `'''`) non sono gestite.
 */
export function senzaCommentoToml(riga) {
  const testo = String(riga ?? "");
  let delimitatore = null;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (delimitatore === '"' && c === "\\") { i += 1; continue; }
    if (delimitatore !== null) {
      if (c === delimitatore) delimitatore = null;
      continue;
    }
    if (c === '"' || c === "'") { delimitatore = c; continue; }
    if (c === "#") return testo.slice(0, i);
  }
  return testo;
}

export function valoreToml(testoConfig, sezione, chiave) {
  let dentro = false;
  const cerca = new RegExp(`^\\s*${perRegExp(chiave)}\\s*=\\s*(.+)$`);

  for (const riga of String(testoConfig ?? "").split(/\r?\n/).map(senzaCommentoToml)) {
    const intestazione = /^\s*\[([^\]]+)\]/.exec(riga);
    if (intestazione) {
      dentro = intestazione[1].trim() === sezione;
      continue;
    }
    if (!dentro) continue;
    const trovata = cerca.exec(riga);
    if (trovata) return trovata[1];
  }

  return null;
}

// ─── confronto dei tipi ──────────────────────────────────────────────────────
// Si normalizza SOLO cio' che non porta significato (BOM, fine riga): su
// Windows un CRLF fa nascere rosso un passo che non parla dello schema, e un
// rosso strutturale insegna a ignorare il rosso.
export function normalizzaTipi(testo) {
  return String(testo ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}
