/**
 * conformita-lib.mjs — Le regole di Site Doctor sui DOCUMENTI.
 *
 * Il certificato (`docs/conformita.md`), la tabella di proprieta' delle voci e
 * il contratto d'uscita. Funzioni pure: entra testo, esce struttura o findings.
 * L'accesso al filesystem entra come funzione iniettata (`leggiFile`), cosi'
 * la regola piu' delicata di questa skill — «il file citato esiste e nomina la
 * voce» — resta testabile senza costruire un progetto.
 */


import { perRegexp } from "./servito-lib.mjs";

/**
 * L'ELENCO DELLE VOCI DI CONFORMITA', e perche' vive qui e non in un documento.
 *
 * Un elenco scritto solo in un file di testo lo si accorcia riscrivendo il
 * file: la voce non viene decisa via, sparisce. E' il difetto n°13 del collaudo
 * avversario di vetrina-crafter, in un'altra forma — «il gate leggeva i
 * documenti che qualcuno poteva riscrivere». Qui l'elenco e' codice: il
 * certificato puo' dichiarare l'esito di ogni voce, non quali voci esistono.
 *
 * `mio` = l'id del passo di QUESTO gate che misura la voce; `null` = la voce e'
 * di qualcun altro (o di nessuno), e allora il certificato deve dire chi, e
 * dove l'ha scritto. `re` = come si riconosce la voce nel documento citato.
 */
export const VOCI = Object.freeze([
  { id: "informativa-privacy", nome: "informativa privacy", mio: "informativa-privacy", re: /informativ|privacy/i },
  { id: "basi-giuridiche", nome: "basi giuridiche dei dati raccolti dai moduli pubblici", mio: "dati-raccolti", re: /base giuridica|basi giuridiche|dati raccolti|art\.?\s*6/i },
  { id: "cookie-archiviazione", nome: "cookie e archiviazione nel browser", mio: "archiviazione-client", re: /cookie|localstorage|sessionstorage|archiviazione/i },
  { id: "consenso", nome: "banner di consenso", mio: "archiviazione-client", re: /consenso|banner/i },
  { id: "accessibilita-pubblico", nome: "accessibilita del sito pubblico", mio: "accessibilita-servita", re: /accessibilit|a11y/i },
  { id: "lingua-hreflang", nome: "lingua dichiarata e hreflang", mio: "lingua-e-hreflang", re: /hreflang|lingua|multilingua/i },
  { id: "contrasti", nome: "contrasti di colore", mio: null, re: /contrast/i },
  { id: "canonical", nome: "canonical", mio: null, re: /canonical/i },
  { id: "sitemap", nome: "sitemap.xml", mio: null, re: /sitemap/i },
  { id: "robots", nome: "robots.txt", mio: null, re: /robots/i },
  { id: "noindex-private", nome: "noindex sulle pagine private", mio: null, re: /noindex/i },
  { id: "open-graph", nome: "Open Graph", mio: null, re: /open ?graph|og:(title|image|url)|anteprim/i },
  { id: "favicon", nome: "favicon", mio: null, re: /favicon|icona del sito|rel="icon"|icon\.svg/i },
  { id: "dati-strutturati", nome: "dati strutturati", mio: null, re: /dati strutturati|json-?ld|schema\.org/i },
  { id: "accessibilita-admin", nome: "accessibilita dell'area amministrativa", mio: null, re: /accessibilit|a11y/i },
  { id: "antispam", nome: "antispam e limiti di frequenza sui moduli pubblici", mio: null, re: /antispam|spam|rate.?limit|limiti di frequenza|abusi/i },
]);

const RE_SEGNAPOSTO = /\{\{[^}]*\}\}|<da compilare>|lorem ipsum/i;

/**
 * Il testo senza i commenti HTML.
 *
 * I modelli di questa casa portano le istruzioni dentro `<!-- … -->`, e quelle
 * istruzioni contengono ESEMPI coi segnaposto (`Confermato da: … {{NOME}}`).
 * Cercare i segnaposto nel testo grezzo vuol dire segnalare ogni certificato
 * compilato che abbia avuto la cura di tenersi le istruzioni: un rilievo che
 * scatta sempre e' un rilievo che tutti imparano a ignorare, ed e' la §8 di
 * DECISIONI.md. Il commento e' guida, non contenuto.
 */
const senzaCommenti = (testo) => String(testo ?? "").replace(/<!--[\s\S]*?-->/g, " ");
const SCOPERTO = /^(—|-{1,2}|scoperto|nessuno|—\s*\(scoperto\))$/i;
export const ESITI_AMMESSI = Object.freeze(["conforme", "non conforme", "non verificato", "non applicabile"]);

const ripulisci = (s) =>
  String(s ?? "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizza = (s) => ripulisci(s).toLowerCase().replace(/[àá]/g, "a").replace(/[èé]/g, "e").replace(/[ìí]/g, "i").replace(/[òó]/g, "o").replace(/[ùú]/g, "u");

// ------------------------------------------------------------ tabelle markdown
/**
 * La prima tabella markdown sotto un'intestazione.
 *
 * Torna `[]` quando la sezione non c'e' e `[]` quando la tabella e' vuota: chi
 * chiama distingue i due casi guardando `sezionePresente`. E' la differenza fra
 * «dichiarato niente» e «non dichiarato», e confonderle sarebbe un pass su una
 * sezione mai scritta.
 */
export function tabellaSotto(testo, reIntestazione) {
  if (typeof testo !== "string") return { sezionePresente: false, righe: [] };
  const righe = testo.split(/\r?\n/);
  let i = righe.findIndex((r) => /^#{1,6}\s/.test(r) && reIntestazione.test(r));
  if (i < 0) return { sezionePresente: false, righe: [] };
  const livello = (righe[i].match(/^#+/) ?? ["#"])[0].length;
  const corpo = [];
  for (i += 1; i < righe.length; i++) {
    const r = righe[i];
    if (/^#{1,6}\s/.test(r) && (r.match(/^#+/) ?? ["#"])[0].length <= livello) break;
    corpo.push(r);
  }
  const dentro = corpo.filter((r) => /^\s*\|/.test(r));
  if (dentro.length < 2) return { sezionePresente: true, righe: [] };
  const celle = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(ripulisci);
  const intestazioni = celle(dentro[0]).map((c) => normalizza(c));
  const dati = [];
  for (const r of dentro.slice(1)) {
    if (/^\s*\|[\s:|-]*\|?\s*$/.test(r)) continue;
    const valori = celle(r);
    if (valori.every((v) => v === "")) continue;
    const oggetto = {};
    intestazioni.forEach((h, k) => {
      oggetto[h] = valori[k] ?? "";
    });
    dati.push(oggetto);
  }
  return { sezionePresente: true, righe: dati };
}

/**
 * Il valore di una riga `Etichetta: valore`, oppure `null`.
 *
 * Gli spazi attorno ai due punti sono `[^\S\n]` e NON `\s`, ed e' il modo in cui
 * questa funzione ha sbagliato prima di avere un test: `\s` comprende il ritorno
 * a capo, quindi su una riga con l'etichetta e il valore VUOTO la ricerca
 * scavalcava la riga e prendeva la successiva. Misurato: un certificato con
 * `Lingue dichiarate:` e niente accanto dichiarava come lingue le parole della
 * riga sotto — cioe' il gate leggeva un valore che nessuno aveva scritto, e il
 * rilievo «nessuna lingua dichiarata» non poteva piu' scattare.
 */
const rigaEtichettata = (testo, etichetta) => {
  const s = "[^\\S\\n]*";
  // `perRegexp` sull'etichetta: vedi la nota accanto alla funzione in
  // `servito-lib.mjs`. Semgrep continuera' a segnalare questa riga — la sua
  // regola e' sintattica, guarda che l'argomento non sia un letterale e non puo'
  // vedere che il valore e' gia' passato per l'escape. Il rilievo resta scritto
  // nel verbale con questa spiegazione, invece di essere silenziato.
  const re = new RegExp(`^${s}[-*>]*${s}\\**${perRegexp(etichetta)}\\**${s}:${s}(.+)$`, "im");
  const m = re.exec(String(testo ?? ""));
  const valore = m ? ripulisci(m[1]) : null;
  return valore === "" ? null : valore;
};

// -------------------------------------------------------------- il certificato
export function leggiCertificato(testo) {
  const confermatoDa = rigaEtichettata(testo, "Confermato da");
  const lingueGrezze = rigaEtichettata(testo, "Lingue dichiarate");
  const banner = rigaEtichettata(testo, "Banner di consenso");
  const superficie = tabellaSotto(testo, /superficie pubblica/i);
  return {
    confermatoDa,
    dataConferma: confermatoDa ? (/(\d{4}-\d{2}-\d{2})/.exec(confermatoDa)?.[1] ?? null) : null,
    urlDichiarato: rigaEtichettata(testo, "URL verificato"),
    informativa: rigaEtichettata(testo, "Informativa privacy"),
    lingue: lingueGrezze ? lingueGrezze.split(/[,;\s]+/).map((l) => l.toLowerCase()).filter(Boolean) : [],
    // Niente `\b` dopo `s[iì]`: in JS senza il flag `u` la parola-confine e'
    // definita su [A-Za-z0-9_], quindi dopo la `ì` di «sì» un confine NON c'e'
    // — e `Banner di consenso: sì` si leggeva come «no».
    banner: banner !== null && /^(s[iì]|yes|presente)/i.test(banner),
    superficie: superficie.righe.map((r) => r.percorso ?? r.pagina ?? "").filter(Boolean),
    superficieDichiarata: superficie,
    archiviazioni: tabellaSotto(testo, /archiviazione dichiarata/i).righe,
    datiRaccolti: tabellaSotto(testo, /dati raccolti/i).righe,
    voci: tabellaSotto(testo, /voci di conformit/i),
    haSegnaposto: RE_SEGNAPOSTO.test(senzaCommenti(testo)),
  };
}

export function findingsCertificato(cert) {
  const findings = [];
  const manca = (m) => findings.push({ severity: "block", object: "docs/conformita.md", message: m });
  if (!cert.confermatoDa) manca("nessuna riga `Confermato da:`: un certificato di idoneita' senza firma e' un promemoria");
  else if (RE_SEGNAPOSTO.test(cert.confermatoDa)) manca(`la riga \`Confermato da:\` e' ancora il segnaposto del modello: "${cert.confermatoDa}"`);
  else if (!cert.dataConferma) manca(`la firma "${cert.confermatoDa}" non porta una data in forma ISO (AAAA-MM-GG): senza data non si sa se e' di prima o di dopo l'ultima build`);
  if (cert.lingue.length === 0) manca("nessuna riga `Lingue dichiarate:`: senza, il passo sulla lingua non ha niente contro cui confrontare quello che misura");
  if (cert.haSegnaposto) findings.push({ severity: "issue", object: "docs/conformita.md", message: "il certificato contiene ancora segnaposto `{{…}}` fuori dalla riga della firma" });
  if (!cert.voci.sezionePresente) manca("nessuna sezione «Voci di conformita' e proprieta'»: e' la tabella che questa skill esiste per produrre");
  return findings;
}

// --------------------------------------------------------------- il perimetro
/**
 * La regola della Legge n°1, resa falsificabile.
 *
 * Il difetto che chiude: `PILOTA-2026-08-06.md` §4 — l'Open Graph assegnato a
 * speed-demon **e** a site-doctor nello stesso handoff, con site-doctor che non
 * esisteva; favicon `404` per tre anelli. Qui:
 *
 *   - voce assente dalla tabella           → block (l'elenco e' nel codice)
 *   - due proprietari diversi              → block (E' IL DIFETTO)
 *   - proprietario `site-doctor` su una
 *     voce che nessun passo misura         → block (promessa senza organo)
 *   - proprietario `site-doctor` con un
 *     esito diverso da questa esecuzione   → block (§19, per voce)
 *   - delegata a un file che non esiste    → block
 *   - delegata a un file che non la nomina → block
 *   - scoperta                             → issue, visibile a ogni giro
 *
 * Quello che NON prova, e sta scritto in SKILL.md: che il file citato dica
 * «fatto» invece di «da fare». Leggere quello vorrebbe dire capire un testo, e
 * un controllo su prosa libera e' un controllo che non c'e' (§19).
 */
export function findingsPerimetro({ tabella, leggiFile, statiPassi }) {
  const findings = [];
  if (!tabella.sezionePresente) {
    return [{ severity: "block", object: "docs/conformita.md", message: "sezione «Voci di conformita' e proprieta'» assente" }];
  }
  const righe = tabella.righe.map((r) => ({
    voce: normalizza(r.voce ?? r.id ?? ""),
    proprietario: ripulisci(r.proprietario ?? ""),
    dove: ripulisci(r["dove e dichiarato"] ?? r.dove ?? ""),
    esito: normalizza(r.esito ?? ""),
  }));

  for (const voce of VOCI) {
    const sue = righe.filter((r) => r.voce === voce.id || r.voce === normalizza(voce.nome));
    if (sue.length === 0) {
      findings.push({
        severity: "block",
        object: voce.id,
        message: `voce assente dalla tabella di proprieta'. Ogni voce dell'elenco va assegnata: a me, a un vicino con il file che lo dichiara, oppure a nessuno scrivendo \`scoperto\``,
      });
      continue;
    }
    const proprietari = [...new Set(sue.map((r) => r.proprietario.toLowerCase()))];
    if (proprietari.length > 1) {
      findings.push({
        severity: "block",
        object: voce.id,
        message: `assegnata a ${proprietari.length} proprietari diversi (${proprietari.join(", ")}). E' il difetto del 2026-08-06: una voce con due proprietari e' una voce di nessuno, e la favicon del pilota e' stata un 404 per tre anelli`,
      });
      continue;
    }
    if (sue.length > 1) {
      findings.push({ severity: "issue", object: voce.id, message: `${sue.length} righe per la stessa voce e lo stesso proprietario` });
    }
    const riga = sue[0];
    const proprietario = riga.proprietario;

    if (SCOPERTO.test(proprietario) || proprietario === "") {
      findings.push({
        severity: "issue",
        object: voce.id,
        message: "SCOPERTA: nessuno la guarda. Resta scoperta e visibile — dichiararla e' l'unica cosa che la distingue da una dimenticata",
      });
      continue;
    }

    if (proprietario.toLowerCase() === "site-doctor") {
      if (!voce.mio) {
        findings.push({
          severity: "block",
          object: voce.id,
          message: "dichiarata mia, e nessun passo di questo gate la misura: una promessa senza l'organo per mantenerla",
        });
        continue;
      }
      const statoVero = statiPassi.get(voce.mio);
      const dichiarato = riga.esito;
      // Una cella `esito` VUOTA disattivava il confronto §19: la voce passava
      // avendo confrontato niente. Chiudere il falso verde n°12 lasciando aperta
      // la porta «non dichiarare» sarebbe stato chiuderlo a meta'.
      if (!dichiarato) {
        findings.push({
          severity: "block",
          object: voce.id,
          message: "dichiarata mia e senza esito: il certificato deve riportare l'esito di QUESTA esecuzione (conforme · non conforme · non verificato · non applicabile), altrimenti non c'e' niente da confrontare",
        });
        continue;
      }
      if (!ESITI_AMMESSI.includes(dichiarato)) {
        findings.push({
          severity: "block",
          object: voce.id,
          message: `esito «${dichiarato}» non riconosciuto: gli esiti ammessi sono ${ESITI_AMMESSI.join(" · ")}`,
        });
        continue;
      }
      const atteso = { pass: "conforme", fail: "non conforme", skipped: "non verificato", "n/a": "non applicabile" }[statoVero];
      if (statoVero && dichiarato && dichiarato !== atteso) {
        findings.push({
          severity: "block",
          object: voce.id,
          message: `il certificato dichiara «${dichiarato}» e il passo \`${voce.mio}\` di QUESTA esecuzione dice «${atteso}». Il documento e' un ricordo, l'esecuzione e' la misura`,
        });
      }
      continue;
    }

    if (!riga.dove || SCOPERTO.test(riga.dove)) {
      findings.push({
        severity: "block",
        object: voce.id,
        message: `delegata a ${proprietario} senza dire dove l'ha dichiarato. «Lo guarda un altro» non e' verificabile finche' non si dice in quale file`,
      });
      continue;
    }
    const testo = leggiFile(riga.dove);
    if (testo === null) {
      findings.push({
        severity: "block",
        object: voce.id,
        message: `delegata a ${proprietario} citando \`${riga.dove}\`, che nel progetto non esiste. Un rimando a un documento che non c'e' e' il difetto dell'Open Graph con una riga di prosa in piu'`,
      });
      continue;
    }
    if (!voce.re.test(testo)) {
      findings.push({
        severity: "block",
        object: voce.id,
        message: `delegata a ${proprietario} citando \`${riga.dove}\`, che esiste e non nomina mai questa voce`,
      });
    }
  }

  const conosciute = new Set(VOCI.flatMap((v) => [v.id, normalizza(v.nome)]));
  for (const r of righe) {
    if (r.voce && !conosciute.has(r.voce)) {
      findings.push({ severity: "warn", object: r.voce, message: "riga in tabella che non corrisponde a nessuna voce dell'elenco: il gate non la controlla" });
    }
  }
  return findings;
}

// ---------------------------------------------------------- contratto d'uscita
export const verdettoDa = (passi) =>
  passi.some((p) => p.status === "fail" || p.status === "skipped") ? "ROSSO" : "VERDE";

const RE_RIGA_GATE = /^\s*[-*>\s]*\**gate\**\s*:\s*\**\s*(VERDE|ROSSO)\b/im;

/**
 * §19 di DECISIONI.md: l'handoff dichiara il verdetto, e il gate lo confronta
 * con il proprio. Non e' un rosso strutturale — se il gate e' rosso e
 * l'handoff dichiara rosso, il passo passa: dichiarare non e' fallire.
 */
export function contrattoUscita(percorso, testo, verdetto) {
  if (testo === null || testo === undefined) {
    return [{ severity: "block", object: percorso, message: "handoff assente: chi viene dopo non ha niente da leggere, e launchpad non pubblica senza" }];
  }
  const findings = [];
  if (RE_SEGNAPOSTO.test(senzaCommenti(testo))) findings.push({ severity: "block", object: percorso, message: "l'handoff contiene ancora segnaposto del modello" });
  const m = RE_RIGA_GATE.exec(testo);
  if (!m) {
    findings.push({ severity: "block", object: percorso, message: "nessuna riga `Gate: VERDE` o `Gate: ROSSO`: e' la riga che un consumatore a valle legge per decidere se fidarsi" });
    return findings;
  }
  if (m[1].toUpperCase() !== verdetto) {
    findings.push({
      severity: "block",
      object: percorso,
      message: `l'handoff dichiara \`Gate: ${m[1].toUpperCase()}\` e questa esecuzione e' ${verdetto}. Quello vero e' ${verdetto}: aggiorna l'handoff e rilancia`,
    });
  }
  return findings;
}
