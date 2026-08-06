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
// Il BOM si scrive `\uFEFF` e non come carattere: era letterale nella regex,
// invisibile a chi legge e segnalato da `no-irregular-whitespace`. Stesso
// comportamento, intenzione dichiarata.
const senzaBom = (testo) => testo.replace(/^\uFEFF/, "");
const righe = (testo) => senzaBom(testo).split(/\r?\n/);

/**
 * Le zone citate non dichiarano niente: un blocco di codice recintato dentro un
 * template contiene un ESEMPIO compilato, e un commento HTML contiene un
 * promemoria. Leggerli come dichiarazioni fa nascere pagine che nessuno ha
 * dichiarato e firme che nessuno ha messo — difetto gia' pagato da Flow
 * Sentinel il 2026-07-28 sul suo contratto dei flussi.
 */
// CORRETTA il 2026-08-06 (referto § M4). La forma a due `replace` conosceva un
// recinto solo — quello a spina di pesce — e markdown ne ha due. Misurato lo
// stesso giorno, sullo stesso esempio scritto nei due modi:
//
//   recinto ``` :  pagine = []                            (l'esempio non conta)
//   recinto ~~~ :  pagine = ["esempio"]                   (l'esempio DICHIARA)
//
// cioe' un esempio recintato entrava nel contratto, e con lui la sua firma
// d'esempio. E' il difetto che Flow Sentinel ha misurato e chiuso il
// 2026-07-28: qui arriva la SUA funzione, non una nuova — con lo stato di riga,
// che regge anche il commento HTML aperto su una riga e chiuso su un'altra, e
// che lascia il numero delle righe dov'era.
function senzaZoneCitate(testo) {
  let inRecinto = false;
  let inCommento = false;
  return righe(senzaBom(testo))
    .map((linea) => {
      if (!inCommento && /^\s{0,3}(```|~~~)/.test(linea)) {
        inRecinto = !inRecinto;
        return "";
      }
      if (inRecinto) return "";
      let resto = linea;
      if (inCommento) {
        const fine = resto.indexOf("-->");
        if (fine === -1) return "";
        inCommento = false;
        resto = resto.slice(fine + 3);
      }
      for (;;) {
        const apre = resto.indexOf("<!--");
        if (apre === -1) return resto;
        const chiude = resto.indexOf("-->", apre + 4);
        if (chiude === -1) {
          inCommento = true;
          return resto.slice(0, apre);
        }
        resto = resto.slice(0, apre) + resto.slice(chiude + 3);
      }
    })
    .join("\n");
}

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
 *
 * CORRETTO il 2026-07-30, collaudo avversario. La regola pretendeva anche la
 * parola letterale `UMANO` o `ORCHESTRATORE`, e cosi' RIFIUTAVA la firma che il
 * template stesso insegna a scrivere:
 *
 *   Confermato da: Elena Barbieri (titolare) (2026-07-24)   → rifiutata
 *   Confermato da: ORCHESTRATORE (2026-07-30)               → accettata
 *
 * Il template chiede nome e ruolo «perche' fra sei mesi *confermato dal
 * cliente* non identifica nessuno», quindi l'unica modalita' che il gate
 * accettava era quella senza nessun nome: la modalita' **interattiva** della
 * SKILL — quella con un umano che dice si' — non poteva passare il suo stesso
 * gate. A tenere fuori il segnaposto basta il controllo sui segnaposti; il
 * resto va letto da chi legge, che e' l'unico a poter dire se «Elena Barbieri
 * (titolare)» sia davvero chi decide.
 */
const firmaVera = (firma) =>
  !/\{\{|\}\}|\bTODO\b|\bda compilare\b|\bda decidere\b|^[-—?.\s]+$/i.test(firma) &&
  /\p{L}{3}/u.test(firma);

/** `## `<id>` — <percorso>` : l'intestazione di una pagina misurata. */
const INTESTAZIONE_PAGINA =
  /^##\s+`([a-z0-9][a-z0-9-]*)`\s+[—-]\s+(\S+)\s*$/;

/**
 * Il percorso di una pagina e' un PERCORSO, non un indirizzo.
 *
 * `(\S+)` accettava qualunque cosa, e il gate poi la dava a `new URL(percorso,
 * base)`, che di fronte a un URL assoluto BUTTA VIA la base. Misurato il
 * 2026-08-06 (referto § H4), su un contratto firmato e senza nessun rilievo:
 *
 *   ## `home` — https://example.com/     baseUrl http://127.0.0.1:3200
 *      → Lighthouse misura  https://example.com/
 *   ## `catalogo` — //evil.example.com/  baseUrl http://127.0.0.1:3200
 *      → Lighthouse misura  http://evil.example.com/
 *
 * e i punteggi finivano nel verbale accanto al nome della pagina del cliente.
 * `stessaPagina`, l'unico controllo esistente, confronta il richiesto col
 * finale: due volte lo stesso indirizzo sbagliato, quindi taceva.
 *
 * E' la stessa famiglia di § C1 — il progetto auditato che sceglie cosa il gate
 * misura — arrivata da una riga di markdown invece che da un binario.
 *
 * La forma ammessa e' quella che il template scrive da sempre (`{{/percorso}}`,
 * e i tre esempi sono `/`, `/catalogo`, `/catalogo/acero-palmato`): una barra
 * iniziale, e non due. Non e' una restrizione nuova: e' quella dichiarata.
 */
export function erroreDiPercorso(id, percorso) {
  const p = String(percorso ?? "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) {
    return `pagina \`${id}\`: \`${p}\` e' un URL assoluto, non un percorso. Il gate misurerebbe QUEL sito e stamperebbe i suoi punteggi accanto al nome di questa pagina. Scrivi il percorso, per esempio \`/catalogo\``;
  }
  if (p.startsWith("//")) {
    return `pagina \`${id}\`: \`${p}\` comincia con due barre, che in un URL significa «un altro host» (\`//esempio.com/\` diventa \`http://esempio.com/\`). Una barra sola`;
  }
  if (!p.startsWith("/")) {
    return `pagina \`${id}\`: \`${p}\` non comincia con \`/\`. Il percorso si scrive dalla radice del sito, come nel template (\`/\`, \`/catalogo\`, \`/catalogo/acero-palmato\`)`;
  }
  return null;
}

/**
 * Due indirizzi sono sullo stesso sito? La seconda porta, indipendente dalla
 * prima: anche se una forma di percorso sfuggisse alla regola del contratto, il
 * passo `misura` non deve poter misurare un altro host. Un confronto di ORIGINE
 * (schema + host + porta), non di prefisso: `http://x.it.evil.com/` comincia
 * per niente di utile, e `new URL` scioglie i `..` prima del confronto.
 */
export function stessaOrigine(base, indirizzo) {
  try {
    return new URL(indirizzo).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/**
 * `| performance | 90 |` dentro la sezione della pagina.
 *
 * CORRETTO il 2026-07-30. Prima pretendeva la categoria nuda e il valore nudo,
 * e il template scrive tutt'e due diversamente:
 *
 *   template:  | `performance` | >= 85 | 71 | ±4 | 93 |   → nessuna soglia letta
 *   banco:     | performance   | 95 |                     → letta
 *
 * Un contratto scritto seguendo il template usciva con zero soglie su ogni
 * pagina, cioe' quattro `block` che parlavano del sito quando il difetto era
 * nella punteggiatura. Gli apici inversi e il `>=` sono ORNAMENTO: il numero e'
 * lo stesso, e le colonne che seguono (baseline, dispersione, misura finale)
 * non riguardano questa regola.
 */
const RIGA_SOGLIA =
  /^\|\s*`?(performance|accessibility|best-practices|seo)`?\s*\|\s*(?:>=|≥|>)?\s*(\d{1,3})\s*(?:\/\s*100)?\s*\|/i;

export const CATEGORIE = Object.freeze([
  "performance",
  "accessibility",
  "best-practices",
  "seo",
]);

/** Le celle di una riga di tabella markdown, senza i due bordi. */
const celle = (linea) =>
  linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const eSeparatore = (linea) => /^\|[\s:|-]+\|?\s*$/.test(linea.trim());

// L'intestazione che apre la tabella delle deroghe, e nessun'altra. Si
// tollerano la decorazione markdown e il due punti finale, non le parole in
// piu': «Deroghe RESPINTE» e «Storico delle deroghe scadute» sono sezioni che
// parlano di deroghe che NON valgono.
const TITOLO_DEROGHE = /^#{1,6}[ \t*_]*Deroghe[ \t*_:]*$/i;

/**
 * La tabella delle deroghe si legge DALLA SUA INTESTAZIONE, non da una forma
 * fissa.
 *
 * CORRETTO il 2026-07-30. La regola precedente pretendeva esattamente tre
 * colonne e prendeva come motivo «tutto fino all'ultima barra». Su un banco
 * andava bene; sulla tabella a sei colonne del template — quella con soglia,
 * misurato e firma — succedevano due cose insieme:
 *
 *   | `immobili` | `performance` | >= 80 | 74 | motivo | firma |  → nessuna deroga letta
 *   | `immobili` | performance   | >= 80 | 74 | motivo | firma |  → motivo = ">= 80 | 74 | motivo | firma"
 *
 * cioe' o la deroga spariva (e la pagina tornava `block` con la sua
 * giustificazione scritta due righe piu' sotto), o veniva letta con un motivo
 * che conteneva tre colonne altrui. Leggere l'intestazione costa venti righe e
 * smette di legare il gate a un numero di colonne.
 */
/**
 * Una deroga senza firma non e' una deroga (referto § M10).
 *
 * Il template ha sei colonne e la sesta e' `Confermata da`, perche' una deroga
 * e' l'unica cosa in questo contratto che AUTORIZZA a consegnare sotto la
 * soglia: e' una decisione, e una decisione ha un nome. Fino al 2026-08-06 il
 * gate leggeva la riga con quella cella VUOTA — misurato — e ne ricavava un
 * `warn` al posto di un `block`. Cioe' bastava aggiungere una riga a una
 * tabella per togliere una soglia.
 *
 * Il criterio e' lo stesso di `firmaVera` sulla riga `Confermato da:`: almeno
 * un carattere alfanumerico, e nessun segnaposto `{{…}}` rimasto.
 */
const cellaFirmata = (valore) => /[\p{L}\p{N}]/u.test(valore) && !valore.includes("{{");

/**
 * Le colonne, lette dall'intestazione. `null` se questa riga non e'
 * l'intestazione della tabella delle deroghe: si aspetta la prossima invece di
 * indovinare le posizioni, perche' indovinare qui significa attribuire una
 * deroga a una pagina che non l'ha chiesta.
 */
function indiciDeroghe(celleIntestazione) {
  const dove = (parola) => celleIntestazione.findIndex((x) => new RegExp(parola, "i").test(x));
  const pagina = dove("pagina");
  const categoria = dove("categoria");
  const motivo = dove("motivo");
  if (pagina < 0 || categoria < 0 || motivo < 0) return null;
  return { pagina, categoria, motivo, firma: dove("confermat") };
}

/** Una riga della tabella: `{ deroga }`, `{ errore }`, o nessuna delle due. */
function derogaDaRiga(c, indici) {
  const pagina = (c[indici.pagina] ?? "").replace(/`/g, "").trim();
  const categoria = (c[indici.categoria] ?? "").replace(/`/g, "").trim().toLowerCase();
  const motivo = (c[indici.motivo] ?? "").trim();
  // Una deroga senza motivo scritto e' una soglia tolta, non una deroga.
  if (!pagina || !CATEGORIE.includes(categoria) || motivo.replace(/[-—\s]/g, "").length === 0) return {};
  const firma = indici.firma >= 0 ? (c[indici.firma] ?? "").trim() : "";
  if (!cellaFirmata(firma)) {
    // NON si scarta in silenzio: una riga che sembra una deroga e non lo e' e'
    // esattamente cio' che qualcuno rileggera' fra sei mesi come valida.
    return { errore: `deroga \`${pagina}\` · \`${categoria}\`: la colonna \`Confermata da\` e' vuota o porta ancora un segnaposto. Una deroga autorizza a consegnare sotto la soglia: senza un nome non l'ha autorizzata nessuno, e non vale` };
  }
  return { deroga: { pagina, categoria, motivo, firma } };
}

function derogheDaTabella(righeTabella) {
  const deroghe = [];
  const errori = [];
  let indici = null;
  for (const linea of righeTabella) {
    if (eSeparatore(linea)) continue;
    const c = celle(linea);
    if (!indici) {
      indici = indiciDeroghe(c);
      if (indici && indici.firma < 0) {
        errori.push("la tabella delle deroghe non ha la colonna `Confermata da`: una deroga autorizza a consegnare sotto la soglia, e senza un nome non e' una decisione di nessuno");
      }
      continue;
    }
    const { deroga, errore } = derogaDaRiga(c, indici);
    if (errore) errori.push(errore);
    if (deroga) deroghe.push(deroga);
  }
  return { deroghe, errori };
}

/**
 * Scrive una soglia dentro la pagina in corso. Ritorna l'errore da segnalare,
 * o `null` se la riga non era una soglia o era una soglia buona.
 *
 * ESTRATTA il 2026-08-04 da `leggiContratto` (`complexity 16`, soglia 15):
 * muta `corrente.soglie` come faceva prima, ma ora e' una decisione sola che
 * si legge in dieci righe.
 */
function applicaRigaSoglia(corrente, linea) {
  const soglia = RIGA_SOGLIA.exec(linea);
  if (!soglia) return null;
  const categoria = soglia[1].toLowerCase();
  const valore = Number(soglia[2]);
  if (valore > 100) {
    return `pagina \`${corrente.id}\`, ${categoria}: soglia ${valore} — Lighthouse arriva a 100`;
  }
  corrente.soglie[categoria] = valore;
  // LA BASELINE, che stava nella stessa riga e nessuno leggeva (referto § M10).
  // Terza colonna della tabella del template: `| categoria | soglia | baseline
  // | dispersione | misura finale |`. Serve a distinguere «non ci si arriva» —
  // che una deroga puo' ammettere — da «si e' PEGGIORATO», che nessuna deroga
  // puo' legittimare per l'accessibilita'. Il gate non la leggeva affatto,
  // quindi i due casi erano lo stesso caso.
  const terza = celle(linea)[2] ?? "";
  const numero = /^\s*(\d{1,3})\s*$/.exec(terza.replace(/`/g, ""));
  if (numero && Number(numero[1]) <= 100) corrente.baseline[categoria] = Number(numero[1]);
  return null;
}

/**
 * Legge il contratto `docs/performance.md`.
 *
 * Ritorna le pagine dichiarate con le loro soglie, le deroghe scritte e la
 * firma. Gli errori di forma NON vengono inghiottiti: un id ripetuto o una
 * categoria sconosciuta sono difetti del contratto, e un contratto che il gate
 * legge a meta' e' peggio di un contratto assente.
 */
/**
 * L'intestazione di una pagina: o apre una sezione da misurare, o scrive un
 * errore e non apre niente. Ritorna la pagina in corso (o `null`).
 *
 * ESTRATTA il 2026-08-06 con l'arrivo del controllo sul percorso (§ H4):
 * `leggiContratto` era salita a `complexity 16` contro la soglia 15 della casa,
 * ed e' la seconda volta che questa funzione supera la soglia crescendo di un
 * ramo (la prima fu `applicaRigaSoglia`, il 2026-08-04). Un gate che viola le
 * regole che impone non e' credibile.
 */
function apriPagina(intestazione, visti, pagine, errori) {
  const [, id, percorso] = intestazione;
  if (visti.has(id)) {
    errori.push(`pagina \`${id}\`: id ripetuto — un id stabile identifica una pagina sola`);
    return null;
  }
  visti.add(id);
  const errato = erroreDiPercorso(id, percorso);
  if (errato) {
    // La pagina NON entra nell'elenco, come il flusso di tipo sconosciuto in
    // Flow Sentinel: un `block` che la lasciasse nell'elenco la farebbe misurare
    // lo stesso, e misurarla e' proprio la cosa da non fare (referto § H4).
    errori.push(errato);
    return null;
  }
  const pagina = { id, percorso, soglie: {}, baseline: {} };
  pagine.push(pagina);
  return pagina;
}

export function leggiContratto(testo) {
  const pagine = [];
  const righeDeroghe = [];
  const errori = [];
  const visti = new Set();
  const proprio = senzaZoneCitate(testo);

  let corrente = null;
  let inDeroghe = false;

  for (const linea of righe(proprio)) {
    const intestazione = INTESTAZIONE_PAGINA.exec(linea);
    if (intestazione) {
      inDeroghe = false;
      corrente = apriPagina(intestazione, visti, pagine, errori);
      continue;
    }

    // QUALUNQUE intestazione chiude la pagina in corso E la sezione delle
    // deroghe: senza, le righe della tabella finirebbero come soglie
    // dell'ultima pagina dichiarata.
    //
    // CORRETTA il 2026-08-06 (referto § M9), due difetti in una riga. Il primo:
    // `^##\s+` non riconosce un `### Archivio`, quindi un sottotitolo NON
    // chiudeva la sezione e la tabella sotto di esso valeva come deroghe vive.
    // Il secondo: `/deroghe/i` e' qualunque intestazione che contenga la
    // parola. Misurate quattro forme su quattro il 2026-08-06, tutte con una
    // deroga letta come viva:
    //
    //   ## Deroghe                        1     (giusto)
    //   ## Deroghe RESPINTE               1     (una deroga NEGATA)
    //   ## Storico delle deroghe scadute  1     (una deroga MORTA)
    //   ## Deroghe + ### Archivio         1     (un archivio)
    //
    // Ora il titolo deve essere `Deroghe` e non altro: una sezione che parla
    // d'altro non autorizza niente.
    if (/^#{1,6}\s+/.test(linea)) {
      corrente = null;
      inDeroghe = TITOLO_DEROGHE.test(linea);
      continue;
    }

    if (corrente) {
      const errore = applicaRigaSoglia(corrente, linea);
      if (errore) errori.push(errore);
      continue;
    }

    if (inDeroghe && /^\s*\|/.test(linea)) righeDeroghe.push(linea);
  }

  const { deroghe, errori: erroriDeroghe } = derogheDaTabella(righeDeroghe);
  errori.push(...erroriDeroghe);
  const conferma = RIGA_CONFERMA.exec(proprio);
  const firma = conferma ? conferma[1].trim() : null;
  const dispersione = RIGA_DISPERSIONE.exec(proprio);
  const url = RIGA_URL_MISURATO.exec(proprio);
  return {
    confermatoDa: firma && firmaVera(firma) ? firma : null,
    formFactor: formFactorDa(proprio),
    // `null` = il contratto non l'ha dichiarata, e chi chiama usa il default
    // della casa. Zero non e' un valore ammissibile e va trattato come assente:
    // una dispersione massima di zero renderebbe MANCANTE ogni misura.
    dispersioneMassima: dispersione && Number(dispersione[1]) > 0 ? Number(dispersione[1]) : null,
    urlDichiarato: url ? url[1] : null,
    pagine,
    deroghe,
    errori,
  };
}

/**
 * `Dispersione massima ammessa: 5 punti di categoria`.
 *
 * AGGIUNTA il 2026-07-30. `references/misurazione.md` §78 dice: «se la
 * dispersione supera **la soglia dichiarata nel contratto**, la misura non e'
 * bassa: e' MANCANTE», e §118 e §216 fissano la convenzione della casa a
 * **5 punti**. Il gate ne aveva uno **cablato a 10** e non leggeva la riga:
 * quindi un contratto firmato che dichiarava 5 vedeva accettata una misura che
 * ballava di 8, e nessuno dei due numeri era sbagliato per iscritto.
 *
 * Misurato sul banco `banco-prova-immobiliare` il 2026-07-30:
 *   immobili (/immobili) · performance 74±6  → contratto: MANCANTE · gate: pass
 */
const RIGA_DISPERSIONE =
  /^[ \t>*_-]*Dispersione massima ammessa[ \t*_]*:[ \t*_]*(\d{1,3})\b/im;

/**
 * `URL misurato: http://127.0.0.1:3200`.
 *
 * AGGIUNTA il 2026-07-30. Il template lo prometteva gia' — «Precedenza: flag
 * esplicito > questa riga > MAI l'ambiente e MAI un `localhost:3000` scritto
 * dentro il gate» — e il gate non l'ha mai letta: senza `--url` usciva con
 * codice 2 anche quando l'indirizzo stava scritto e firmato nel contratto.
 *
 * La precedenza resta quella promessa, e il divieto che l'ha generata resta
 * intatto: qui non si indovina niente, si legge un valore che un umano ha
 * firmato in un file del progetto.
 */
const RIGA_URL_MISURATO =
  /^[ \t>*_-]*URL misurato[ \t*_]*:[ \t*_]*[`<]?(https?:\/\/[^\s`<>]+)/im;

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

/**
 * La stessa dichiarazione, nella forma che usa il template: una riga `Metodo:`
 * che finisce con «profilo desktop».
 *
 * AGGIUNTA il 2026-07-30. Il template non contiene la riga `Form factor:` —
 * scrive `Metodo: build di produzione · 3 giri · mediana · profilo desktop` —
 * quindi ogni contratto scritto seguendolo cadeva sul ripiego `mobile` mentre
 * dichiarava desktop. Sono due macchine diverse: le soglie decise guardando un
 * profilo venivano confrontate con i numeri dell'altro, e il gate stampava
 * `form factor: mobile` senza che nessuno avesse motivo di rileggerlo.
 */
const RIGA_PROFILO = /^[ \t>*_-]*Metodo[ \t*_]*:.*\bprofilo\s+(mobile|desktop)\b/im;

export function formFactorDa(testo) {
  const proprio = senzaZoneCitate(testo);
  const trovata = RIGA_FORM_FACTOR.exec(proprio) ?? RIGA_PROFILO.exec(proprio);
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

/**
 * Il ripiego, quando il contratto non dichiara la sua.
 *
 * Era **10**, e non corrispondeva a niente di scritto: `references/misurazione.md`
 * §118 e §216 fissano la convenzione della casa a **5 punti**, e la riga
 * `Dispersione massima ammessa:` del template propone 5. Portato a 5 il
 * 2026-07-30: un gate che ammette il doppio dell'oscillazione che la sua stessa
 * documentazione dichiara accettabile promuove a risultato un rumore che i suoi
 * documenti chiamano rumore.
 *
 * Resta una convenzione, non una misura: il numero vero si tara per progetto
 * (misurazione.md §118) e si scrive nel contratto, che ora viene letto.
 */
export const DISPERSIONE_MASSIMA = 5;

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

// -------------------------------------------------------- il passo `misura`
/*
 * Le cinque funzioni che seguono sono state ESTRATTE il 2026-08-04 dal passo
 * `misura` di `verify.mjs`, che ESLint segnalava a `complexity 19` (soglia
 * della casa: 15). Stessa mossa che schema-forge ha fatto con la sua regola
 * d'audit in P.8: la decisione diventa pura e testabile, nel guscio di I/O
 * resta solo il giro di Lighthouse, che e' l'unica cosa che tocca il mondo.
 * Il rilievo era vivo dal 2026-07-30 e nessuno l'aveva mai visto, perche' in
 * questa skill ESLint non era mai stato configurato.
 */

/**
 * Perche' la misura NON si fa. `null` = si fa.
 *
 * Tre premesse, e nessuna delle tre produce un `pass`: senza pagine dichiarate
 * non c'e' niente da misurare, su un'app che non e' una build di produzione la
 * misura direbbe un'altra cosa (`references/misurazione.md`: i numeri di
 * `next dev` sono finzione), e senza Lighthouse non c'e' misura affatto.
 */
export function motivoNessunaMisura({ contratto, baseUrl, strumento }) {
  if (!contratto || contratto.pagine.length === 0) return "nessuna pagina dichiarata da misurare";
  if (!baseUrl) return "l'app non e' stata riconosciuta come build di produzione: misurarla direbbe altro";
  // Dal 2026-08-06 `strumento` e' il Lighthouse DELLA SKILL, a versione fissata
  // (referto § H12): non si cerca piu' niente nel PATH, e non si scarica niente
  // a ogni giro. Se manca, manca l'installazione della skill — e si dice come.
  if (!strumento) return "Lighthouse non installato nella skill: lancia `npm install` in agenti/speed-demon. La misura non e' MANCANTE per scelta, e' mancante e basta";
  return null;
}

/**
 * Mediana e dispersione per categoria, dai punteggi di piu' giri.
 *
 * Una categoria che nessun giro ha prodotto non entra nel risultato: meglio
 * assente che con una mediana calcolata su niente.
 */
export function medianePerCategoria(giri, sogliaDispersione = DISPERSIONE_MASSIMA) {
  const perCategoria = {};
  for (const categoria of CATEGORIE) {
    const valori = giri.map((g) => g[categoria]).filter((v) => v !== null && v !== undefined);
    if (valori.length > 0) perCategoria[categoria] = misuraStabile(valori, sogliaDispersione);
  }
  return perCategoria;
}

/**
 * L'esito di UNA pagina: `{ misura, riga, scartata }`.
 *
 * `misura === null` significa **pagina non misurata**, e chi chiama la conta:
 * una pagina dichiarata e non misurata non lascia il passo verde.
 *
 * Il dirottamento non e' una misura bassa: e' la misura di **un'altra pagina**.
 * Scartarla e' l'unica cosa onesta, e dirlo qui evita che il numero finisca nel
 * contratto accanto al nome sbagliato.
 */
export function esitoPagina({ pagina, giri, dirottamento, giriRichiesti, sogliaDispersione }) {
  if (dirottamento) {
    return { misura: null, riga: null, scartata: `${pagina.id} (${pagina.percorso}) → ${dirottamento}` };
  }
  if (giri.length === 0) {
    return { misura: null, riga: `${pagina.id}: nessun giro riuscito su ${giriRichiesti}`, scartata: null };
  }
  const perCategoria = medianePerCategoria(giri, sogliaDispersione);
  const riga =
    `${pagina.id} (${pagina.percorso}) · ${giri.length}/${giriRichiesti} giri: ` +
    CATEGORIE.filter((c) => perCategoria[c])
      .map((c) => `${c} ${perCategoria[c].mediana}±${perCategoria[c].dispersione}`)
      .join(" · ");
  return { misura: perCategoria, riga, scartata: null };
}

// ─── il contrasto del testo ──────────────────────────────────────────────────
/**
 * LA SOGLIA DI UNA CATEGORIA NON E' LA MISURA DI UN AUDIT.
 *
 * `CANTIERE.md` § D21: delle nove voci di conformita' che site-doctor delega ai
 * vicini, `contrasti` e' di questo agente, perche' e' l'unico gate della casa
 * che apre un browser. Al 2026-08-06 la parola `contrast` non compariva in
 * NESSUN file di questa skill: il gate leggeva
 * `report.categories.accessibility.score` e non apriva mai l'audit.
 *
 * Perche' non basta. Lighthouse pesa `color-contrast` insieme ad altre venti e
 * passa audit dentro la categoria `accessibility`: un sito con contrasto
 * insufficiente perde qualche punto su cento e supera qualunque soglia
 * ragionevole. Misurato sulla forma vera di un report — categoria 98 contro
 * soglia 95, `color-contrast` con `score: 0` e tre elementi:
 *
 *   PRIMA   accessibility 98 >= 95 → nessun rilievo, passo verde
 *   DOPO    block: 3 elementi con contrasto insufficiente
 *
 * Una fixture in cui falliscono ENTRAMBI non prova niente: e' il caso in cui
 * anche il vecchio codice diceva rosso.
 *
 * Quattro stati e non due, perche' `notApplicable` (una pagina senza testo
 * sopra uno sfondo) non e' un successo e non e' un guasto, e un audit che
 * Lighthouse non ha prodotto e' una verifica MANCANTE.
 */
export function letturaContrasto(audit) {
  if (!audit || typeof audit !== "object") return { stato: "non-misurato", elementi: [] };
  if (audit.scoreDisplayMode === "notApplicable") return { stato: "non-applicabile", elementi: [] };
  if (audit.scoreDisplayMode === "error") return { stato: "non-misurato", elementi: [] };
  const elementi = (audit.details?.items ?? [])
    .map((i) => i?.node?.selector || i?.node?.snippet || "(elemento senza selettore)");
  if (audit.score === 1) return { stato: "pass", elementi: [] };
  if (audit.score === 0) return { stato: "fail", elementi };
  return { stato: "non-misurato", elementi };
}

/**
 * L'esito di una pagina sui suoi N giri. Un guasto trovato UNA volta e' trovato:
 * il contrasto non oscilla come un punteggio di performance, e se un giro lo ha
 * visto gli altri non lo smentiscono — lo hanno mancato.
 */
export function esitoContrasto(letture) {
  const falliti = letture.filter((l) => l.stato === "fail");
  if (falliti.length > 0) {
    return { stato: "fail", elementi: [...new Set(falliti.flatMap((l) => l.elementi))] };
  }
  if (letture.some((l) => l.stato === "pass")) return { stato: "pass", elementi: [] };
  if (letture.some((l) => l.stato === "non-applicabile")) return { stato: "non-applicabile", elementi: [] };
  return { stato: "non-misurato", elementi: [] };
}

const MASSIMI_ELEMENTI = 5;

export function findingsContrasto(pagine, perPagina) {
  const findings = [];
  for (const pagina of pagine) {
    const esito = perPagina.get(pagina.id);
    if (!esito || esito.stato === "non-misurato") {
      findings.push({
        severity: "issue",
        object: `pagina ${pagina.id}`,
        message: "audit `color-contrast` non prodotto da Lighthouse: il contrasto NON e' stato misurato. Il punteggio della categoria `accessibility` non lo dice — pesa questo audit insieme ad altri venti",
      });
      continue;
    }
    if (esito.stato !== "fail") continue;
    const primi = esito.elementi.slice(0, MASSIMI_ELEMENTI).map((e) => `  - ${e}`).join("\n");
    const coda = esito.elementi.length > MASSIMI_ELEMENTI ? `\n  … e altri ${esito.elementi.length - MASSIMI_ELEMENTI}` : "";
    findings.push({
      severity: "block",
      object: `pagina ${pagina.id}`,
      message: `${esito.elementi.length} element${esito.elementi.length === 1 ? "o" : "i"} con contrasto insufficiente (audit \`color-contrast\` di Lighthouse):\n${primi}${coda}`,
    });
  }
  return findings;
}

/**
 * Lo stato del passo del contrasto. Un audit non prodotto non e' un successo:
 * `issue` non fa rosso, ma il passo diventa MANCANTE, che e' la stessa regola
 * di ogni strumento assente in questa casa.
 */
export function statoContrasto(findings) {
  if (findings.some((f) => f.severity === "block")) return "fail";
  if (findings.some((f) => f.severity === "issue")) return "skipped";
  return "pass";
}

export function dettaglioContrasto(pagine, perPagina, findings) {
  const conta = (stato) => pagine.filter((p) => perPagina.get(p.id)?.stato === stato).length;
  const testa = `${pagine.length} pagine · ${conta("pass")} col contrasto verificato · ` +
    `${conta("fail")} con elementi insufficienti · ${conta("non-applicabile")} senza testo da confrontare`;
  return findings.length === 0 ? testa : `${testa}\n${dettaglioFindings(findings)}`;
}

/**
 * Lo stato del passo.
 *
 * Una pagina dichiarata e non misurata NON lascia il passo verde: prima bastava
 * che una sola pagina fosse riuscita perche' il passo dicesse `pass` e il
 * residuo finisse in una riga di dettaglio.
 */
export function statoMisura(misurate, nonMisurate) {
  if (misurate === 0) return "skipped";
  return nonMisurate > 0 ? "fail" : "pass";
}

/** Il dettaglio stampato dal passo: la soglia usata, una riga per pagina, le scartate. */
export function dettaglioMisura({ sogliaDispersione, dichiarataNelContratto, righe, dirotate, misurate }) {
  const dettaglio = [
    `dispersione massima ammessa: ${sogliaDispersione} punti (${dichiarataNelContratto ? "dichiarata nel contratto" : "ripiego della casa: il contratto non la dichiara"})`,
    ...righe,
    ...dirotate.map((d) => `SCARTATA — ${d}: Lighthouse ha misurato un'altra pagina, il punteggio non e' di quella dichiarata`),
  ];
  return dettaglio.join("\n") + (misurate === 0 ? "\nnessuna pagina misurata" : "");
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
/**
 * LA DEROGA CHE NON ESISTE: `accessibility` sotto la baseline.
 *
 * Il template lo scrive da sempre, e il gate non lo sapeva (referto § M10, con
 * la motivazione corretta dal verificatore): «una deroga puo' ammettere che una
 * soglia non e' stata RAGGIUNTA; non puo' legittimare una REGRESSIONE». La
 * costituzione mette l'accessibilita' sopra la performance, e questo agente e'
 * quello che rischia di introdurre la regressione piu' facilmente di chiunque
 * altro — togliere un `alt`, spegnere un focus visibile o svuotare un
 * `aria-label` fa salire il punteggio di performance mentre rompe la pagina per
 * chi la usa senza vederla.
 *
 * Distinguere i due casi vuole la BASELINE, che il gate non leggeva affatto: e'
 * per questo che una deroga su `accessibility` 61 contro soglia 95 diventava un
 * `warn` e il passo restava `pass`.
 *
 * Baseline non dichiarata e deroga su `accessibility`: `block` lo stesso, e il
 * motivo lo dice. Non e' severita': senza la baseline il gate non puo' sapere
 * se sta autorizzando una soglia non raggiunta o una regressione, e «non lo so»
 * non e' «va bene» — la stessa regola del `tsconfig` senza `strict` (§ H8).
 */
// PERCHE' SOLO `accessibility`, e non anche `best-practices` (rilievo del
// concilio, 2026-08-07). L'obiezione è buona: `best-practices` contiene audit
// che confinano con la sicurezza — librerie con CVE note, HTTPS, errori in
// console — e la costituzione mette la sicurezza SOPRA l'accessibilità, quindi
// una regressione lì peserebbe di più, non di meno.
//
// Resta fuori per due ragioni, e sono dichiarate perché la prossima persona non
// debba ricostruirle: (1) il template dichiara non derogabile
// `accessibility` **sotto la baseline** e nient'altro, e questo gate non
// inventa clausole che nessuno ha firmato — allargarla trasformerebbe in
// `block` deroghe già firmate su contratti esistenti, che è una rottura
// retroattiva, non un no-op; (2) `best-practices` è un paniere misto e non un
// controllo di sicurezza: farne un `block` irrevocabile userebbe il punteggio
// di una CATEGORIA come misura di un audit, che è esattamente l'errore che §D21
// e il passo `contrasto` esistono per non commettere più.
//
// La sicurezza delle dipendenze è di `code-maniac` e del tribunale, non di una
// soglia Lighthouse. Se un giorno il template la dichiarerà, questa funzione
// prenderà un secondo `if` e una riga nel verbale.
function motivoNonDerogabile(categoria, baseline, mediana) {
  if (categoria !== "accessibility") return null;
  if (baseline === undefined) {
    return "l'accessibilita' e' derogabile solo SOPRA la baseline, e questa pagina non ne dichiara una. " +
      "Scrivi la baseline nella colonna `Baseline (mediana di 3)`: senza, il gate non puo' distinguere una soglia non raggiunta da una regressione, e «non lo so» non e' «va bene»";
  }
  if (mediana < baseline) {
    return `la misura (${mediana}) e' sotto la BASELINE (${baseline}): non e' una soglia non raggiunta, e' una regressione. ` +
      "Una deroga puo' ammettere la prima, non puo' legittimare la seconda — si torna indietro sull'ottimizzazione che l'ha abbassata (la costituzione mette l'accessibilita' sopra la performance)";
  }
  return null;
}

/**
 * I due casi in cui il confronto con la soglia NON si puo' fare, e per cui non
 * esiste una deroga: la categoria che Lighthouse non ha prodotto, e la misura
 * che c'e' ma non e' affidabile. `null` se il confronto si puo' fare.
 */
function motivoSenzaConfronto(pagina, categoria, misura) {
  if (!misura) {
    return {
      severity: "block",
      object: `pagina ${pagina.id}`,
      message: `soglia dichiarata per \`${categoria}\` e nessuna misura: Lighthouse non ha prodotto quella categoria`,
    };
  }
  if (!misura.stabile) {
    return {
      severity: "block",
      object: `pagina ${pagina.id} · ${categoria}`,
      message: `misura inaffidabile, non bassa: ${misura.motivo}`,
    };
  }
  return null;
}

/** Il rilievo di una soglia non raggiunta, con o senza la sua deroga. */
function findingSottoSoglia({ pagina, categoria, soglia, misura, deroga }) {
  const irrevocabile = deroga && motivoNonDerogabile(categoria, pagina.baseline?.[categoria], misura.mediana);
  const testa = `${misura.mediana} sotto la soglia ${soglia}`;
  if (irrevocabile) {
    return { severity: "block", object: `pagina ${pagina.id} · ${categoria}`, message: `${testa}, e la deroga NON vale: ${irrevocabile}` };
  }
  if (deroga) {
    return { severity: "warn", object: `pagina ${pagina.id} · ${categoria}`, message: `${testa}, con deroga scritta e firmata da ${deroga.firma}: «${deroga.motivo}»` };
  }
  return {
    severity: "block",
    object: `pagina ${pagina.id} · ${categoria}`,
    message: `${testa} e nessuna deroga scritta nel contratto: o si ottimizza, o si scrive perche' non si puo'`,
  };
}

export function findingsBudget(pagine, misure, deroghe) {
  const derogata = (pagina, categoria) =>
    deroghe.find((d) => d.pagina === pagina && d.categoria === categoria);
  const findings = [];
  // Le deroghe SERVITE: quelle che hanno davvero coperto una soglia mancata.
  // Il resto sono avanzi, e un avanzo qui sembra valido.
  const servite = new Set();

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
      const premessa = motivoSenzaConfronto(pagina, categoria, m);
      if (premessa) {
        findings.push(premessa);
        continue;
      }
      if (m.mediana < soglia) {
        const d = derogata(pagina.id, categoria);
        if (d) servite.add(d);
        findings.push(findingSottoSoglia({ pagina, categoria, soglia, misura: m, deroga: d }));
      }
    }
  }

  // Le deroghe che non hanno coperto niente.
  //
  // AGGIUNTO il 2026-07-30. Il template lo prometteva gia' — «riga di deroga che
  // nomina una pagina non dichiarata qui sopra: `warn`» — e il gate non
  // guardava affatto le deroghe che nessuna pagina aveva usato. Sono due casi e
  // fanno lo stesso danno: una giustificazione scritta che sembra valida e non
  // copre piu' niente. Il primo nasce da una pagina rinominata o tolta
  // dall'elenco, il secondo da un'ottimizzazione riuscita che nessuno ha
  // festeggiato cancellando la scusa. Misurati tutti e due su
  // `banco-prova-immobiliare` il 2026-07-30, il secondo su `immobili ·
  // performance` dopo che `next/image` l'ha portata da 75 a 100.
  const dichiarate = new Set(pagine.map((p) => p.id));
  for (const d of deroghe) {
    if (servite.has(d)) continue;
    findings.push({
      severity: "warn",
      object: `deroga ${d.pagina} · ${d.categoria}`,
      message: dichiarate.has(d.pagina)
        ? `non copre niente: \`${d.pagina}\` rispetta la soglia di \`${d.categoria}\`. Una giustificazione che non giustifica piu' va tolta, o fra sei mesi qualcuno la leggera' come vera`
        : `nomina una pagina che il contratto non dichiara: e' l'avanzo di una pagina rinominata o tolta dall'elenco. Chi decide cosa farne e' chi ha firmato la lista`,
    });
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

/**
 * L'app che risponde a quell'indirizzo e' quella di QUESTO progetto?
 *
 * `--url` obbligatorio impedisce al gate di **indovinare** una porta. Non
 * impedisce di sbagliarla, e la differenza e' stata misurata il 2026-07-30 su
 * questa macchina, per caso, mentre si rilanciava il gate su
 * `banco-prova-negozio`:
 *
 *   3000 → Desktop\\Baldisport\\sito-web-baldisport
 *   3001 → Desktop\\Alberto Marocco
 *   3100 → Desktop\\GMSolar\\site        ← la porta che il contratto di
 *                                          Bottega Nord dichiara nel suo
 *                                          `Comando:`, occupata da un altro
 *                                          progetto
 *
 * Un `--url http://127.0.0.1:3100` scritto in buona fede, copiato dal contratto
 * firmato, avrebbe misurato un sito di un'altra azienda e stampato numeri
 * plausibili. Nessuno dei sette passi se ne sarebbe accorto: la build era di
 * produzione, l'app rispondeva, i metatag c'erano.
 *
 * Il discriminante e' il build id di Next, che sta in `.next/BUILD_ID` nel
 * progetto e nei percorsi degli asset dell'HTML servito. Misurato negli stessi
 * minuti: il build id del progetto compare 1 volta nel suo HTML e 0 volte in
 * quello dell'altro progetto. `references/misurazione.md` §211 lo scriveva gia'
 * fra le cose da annotare accanto all'URL misurato — non era mai stato usato
 * per verificare niente.
 */
export const eLaMiaBuild = (html, buildId) =>
  typeof buildId === "string" && buildId.length > 0 && senzaBom(html ?? "").includes(buildId);

// -------------------------------------------------------------------- SEO
/**
 * I metatag si leggono nell'HTML **servito**, non nel sorgente e non nel DOM.
 *
 * Un tag scritto dal client arriva dopo il crawler; un tag presente nel
 * sorgente puo' non arrivare mai nell'HTML se la pagina e' resa in un modo
 * diverso da quello che si crede. Qui si guarda cio' che esce dal server, che
 * e' esattamente cio' che vede chi indicizza.
 */
/**
 * Un `<svg>` inline non e' la testa del documento.
 *
 * `references/seo.md` §313 lo dice da sempre: «un `<title>` dentro un `<svg>`
 * inline e' un altro elemento in un altro spazio di nomi e viene catturato
 * dalla stessa espressione». Era vero: misurato il 2026-07-30 su
 * `/agenzia` del banco `banco-prova-immobiliare`, una pagina **senza titolo**
 * nella testa e con un'icona telefono accessibile nel corpo:
 *
 *   title letto = "Telefono"   → passo `seo-meta`: pass
 *
 * Il `<title>` dell'icona ce l'aveva messo l'accessibilita': e' la cosa giusta
 * da fare, ed era l'unica prova che il gate stesse guardando il posto sbagliato.
 */
//
// ...E NON UN `<svg` QUALUNQUE (referto § M7). `replace(/<svg\b[\s\S]*?<\/svg>/gi, "")`
// cancella dal PRIMO `<svg` che incontra, ovunque si trovi, fino al primo
// `</svg>`. Misurato il 2026-08-06 su una pagina con un'icona SVG di sfondo
// dichiarata in un data-URI dentro un `<style>` — cioe' una cosa che scrive
// Tailwind da solo:
//
//   PRIMA   title = null · description = null · canonical = null · robots = null
//   DOPO    i quattro valori veri
//
// Tre `block` che accusano l'imputato sbagliato, e — nell'ordine sfavorevole —
// un `noindex` cancellato, che e' il verso peggiore: una pagina esclusa
// dall'indice che risulta pubblica.
//
// La correzione e' la stessa dell'intera famiglia: sapere dove ci si trova. Un
// `<` dentro il valore di un attributo non apre un tag; dentro `<style>` e
// `<script>` non e' markup affatto; dentro un commento HTML nemmeno.
//
// `<style>`, `<script>` e i commenti si SVUOTANO invece di essere copiati: non
// sono mai metadati serviti, e un `<title>` scritto dentro un commento non e'
// il titolo della pagina.

/** L'indice del `>` che chiude il tag aperto in `da`, saltando i valori quotati. */
function fineTag(html, da) {
  let virgolette = null;
  for (let i = da + 1; i < html.length; i++) {
    const c = html[i];
    if (virgolette) {
      if (c === virgolette) virgolette = null;
      continue;
    }
    if (c === '"' || c === "'") { virgolette = c; continue; }
    if (c === ">") return i;
  }
  return -1;
}

const NOME_TAG = /^<\/?\s*([a-zA-Z][\w:-]*)/;
const TESTO_GREZZO = new Set(["script", "style"]);

/** Il tag letto: nome, se chiude, se si autochiude. */
function leggiTag(tag) {
  return {
    nome: (NOME_TAG.exec(tag)?.[1] ?? "").toLowerCase(),
    chiusura: tag.startsWith("</"),
    autochiuso: /\/>$/.test(tag),
  };
}

/** Dove finisce il contenuto grezzo di `<script>`/`<style>` aperto in `da`. */
function fineTestoGrezzo(html, da, nome) {
  const chiude = new RegExp(`</\\s*${nome}\\b`, "i").exec(html.slice(da));
  return chiude ? da + chiude.index : html.length;
}

function senzaSvg(html) {
  let fuori = "";
  let profondita = 0;
  let i = 0;
  // Dove si e' aperto l'svg piu' esterno, e cosa c'era gia' scritto: servono se
  // quell'svg non si chiude mai. Un `<svg` senza `</svg>` — o con una virgoletta
  // spaiata dentro, che rende illeggibile il tag — teneva `profondita` a 1 fino
  // in fondo e SI PORTAVA VIA IL RESTO DEL DOCUMENTO: misurato dal concilio il
  // 2026-08-07, un `<meta name="robots" content="noindex">` piu' sotto spariva
  // e il `block` sulla pagina dichiarata pubblica passava da 1 a 0. E' il verso
  // che § M7 chiama «il peggiore», rientrato dalla porta opposta. La regexp di
  // prima, senza `</svg>`, non cancellava niente: qui si torna a quello.
  let apertura = -1;
  let fuoriAllApertura = "";

  while (i < html.length) {
    if (html[i] !== "<") {
      if (profondita === 0) fuori += html[i];
      i += 1;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const fine = html.indexOf("-->", i + 4);
      i = fine === -1 ? html.length : fine + 3;
      continue;
    }
    const fine = fineTag(html, i);
    if (fine === -1) {
      if (profondita === 0) fuori += html.slice(i);
      break;
    }
    const tag = html.slice(i, fine + 1);
    const { nome, chiusura, autochiuso } = leggiTag(tag);

    if (nome === "svg") {
      if (chiusura) profondita = Math.max(0, profondita - 1);
      else if (!autochiuso) {
        if (profondita === 0) { apertura = i; fuoriAllApertura = fuori; }
        profondita += 1;
      }
      i = fine + 1;
      continue;
    }
    if (profondita === 0) fuori += tag;
    i = fine + 1;
    if (TESTO_GREZZO.has(nome) && !chiusura && !autochiuso) {
      i = fineTestoGrezzo(html, i, nome);
    }
  }

  // L'svg piu' esterno non si e' mai chiuso: cio' che si e' buttato via non era
  // un elemento, era il resto del documento. Si torna al comportamento della
  // regexp — non si cancella niente — perche' un `<title>` di un'icona letto per
  // sbaglio e' un rilievo in piu' su una pagina, e un `noindex` cancellato e'
  // una pagina esclusa dall'indice che risulta pubblica.
  if (profondita > 0 && apertura !== -1) return fuoriAllApertura + html.slice(apertura);

  return fuori;
}

/**
 * `href="x"`, `href='x'` o `href=x`: l'ordine e le virgolette sono liberi.
 *
 * CORRETTA il 2026-08-06 (referto § M6). Con `\bname=` il confine di parola
 * cade anche fra il trattino e la `n` di `data-name`, quindi
 * `<meta data-name="viewport" name="robots" content="noindex">` dava
 * `robots: null` — una pagina esclusa dall'indice che risulta pubblica. Il
 * carattere prima deve essere uno che in un nome di attributo non ci puo'
 * stare: niente trattino, niente lettera, niente due punti o punto.
 */
const attributo = (tag, nome) => {
  const m = new RegExp(`(?<![-\\w:.])${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s">]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
};

const meta = (html, nome) =>
  [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => (attributo(t, "name") ?? "").toLowerCase() === nome)
    .map((t) => attributo(t, "content"))
    .filter((v) => v);

/**
 * I metatag si leggono nell'HTML **servito**, e si CONTANO.
 *
 * RISCRITTA il 2026-07-30. La versione precedente cercava la **prima**
 * occorrenza di ciascun tag con un'espressione regolare che pretendeva anche
 * l'ordine degli attributi. `references/seo.md` §309 e §313 descrivevano gia'
 * tutti e tre i difetti che ne uscivano, e il collaudo li ha misurati:
 *
 *   - due `<title>` nello stesso documento: il gate leggeva il primo e taceva.
 *     Succede quando un componente rende un `<title>` che React issa nella
 *     testa accanto a quello di `metadata`;
 *   - due `rel=canonical`: Google li ignora **entrambi**, quindi due canonical
 *     corretti valgono come nessuno — e il gate leggeva il primo e diceva pass;
 *   - `<meta content="noindex" name="robots">`, che e' HTML legale: l'ordine
 *     inverso era gestito per `description` e per `canonical` (c'era anche il
 *     test) e NON per `robots`. Una pagina davvero esclusa dall'indice passava
 *     come pubblica.
 *
 * Adesso gli attributi si estraggono tag per tag senza assumerne l'ordine, e
 * ogni campo torna anche col suo elenco completo: chi decide sta in
 * `findingsSeo`, qui si legge soltanto.
 *
 * `intestazioni` sono quelle della risposta HTTP: `X-Robots-Tag` vale quanto il
 * metatag e sta fuori dal corpo (seo.md §311).
 */
export function metatagDaHtml(html, intestazioni = null) {
  const testo = senzaSvg(senzaBom(html ?? ""));
  const titoli = [...testo.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  const canonici = [...testo.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((t) => (attributo(t, "rel") ?? "").toLowerCase() === "canonical")
    .map((t) => attributo(t, "href"))
    .filter(Boolean);
  const descrizioni = meta(testo, "description");
  const robots = meta(testo, "robots");
  const xRobots = intestazioni?.get?.("x-robots-tag") ?? null;

  return {
    title: titoli[0] ?? null,
    description: descrizioni[0] ?? null,
    canonical: canonici[0] ?? null,
    robots: robots[0] ?? null,
    titoli,
    descrizioni,
    canonici,
    robotsTutti: robots,
    xRobots: xRobots || null,
  };
}

/**
 * `pagine` sono quelle **pubbliche** dichiarate nel contratto: una pagina dietro
 * autenticazione non ha bisogno di essere indicizzabile, e anzi non deve.
 */
export function findingsSeo(pagine, metatagPerPagina, redirezioni = new Map()) {
  const findings = [];
  const chiPossiede = new Map();

  for (const pagina of pagine) {
    // Una pagina che rimanda altrove non ha metatag da leggere: quelli
    // leggibili sono di un'altra pagina. seo.md §296 prescrive
    // `redirect: "manual"` con questa esatta motivazione, e il gate seguiva i
    // rimandi. Misurato il 2026-07-30: `/riservata` dichiarata nel contratto,
    // `/contatti` letta e misurata, `performance 100` scritta accanto al nome
    // della pagina sbagliata.
    const dove = redirezioni.get(pagina.id);
    if (dove) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `\`${pagina.percorso}\` rimanda a \`${dove}\`: i tag e i punteggi che se ne ricavano sono di un'altra pagina. O si dichiara la destinazione, o la pagina esiste davvero`,
      });
      continue;
    }

    const tag = metatagPerPagina.get(pagina.id);
    if (!tag) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `HTML non letto per \`${pagina.percorso}\`: i metatag non sono stati verificati`,
      });
      continue;
    }
    findings.push(...findingsTagPagina(pagina, tag));
    findings.push(...findingsCanonicalPagina(pagina, tag, chiPossiede));
  }
  return findings;
}

/**
 * I rilievi sui tag di UNA pagina: campi mancanti, doppioni, `noindex`.
 *
 * ESTRATTA il 2026-08-04 da `findingsSeo` (`complexity 17`, soglia 15). Pura e
 * senza stato condiviso: quello che serve confrontando pagine diverse — i
 * canonical — sta nella funzione qui sotto.
 */
function findingsTagPagina(pagina, tag) {
  const findings = [];
  for (const campo of ["title", "description", "canonical"]) {
    if (!tag[campo]) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `manca \`${campo}\` nell'HTML servito di \`${pagina.percorso}\``,
      });
    }
  }

  // Contare, non trovare (seo.md §309). Due titoli sono un difetto; due
  // canonical valgono come nessuno, perche' Google li ignora entrambi.
  for (const [campo, elenco, conseguenza] of [
    ["title", tag.titoli, "il motore ne sceglie uno e non sai quale"],
    ["canonical", tag.canonici, "Google li ignora ENTRAMBI: due canonical corretti valgono come nessuno"],
  ]) {
    if (Array.isArray(elenco) && elenco.length > 1) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `${elenco.length} \`${campo}\` nell'HTML servito di \`${pagina.percorso}\` (${elenco.map((v) => `«${v}»`).join(", ")}): ${conseguenza}`,
      });
    }
  }

  // Il difetto SEO piu' comune di un sito con backoffice non e' un tag che
  // manca: e' un `noindex` messo per sbaglio su una pagina che deve vendere.
  // L'intestazione vale quanto il metatag e sta fuori dal corpo (seo.md §311).
  for (const [origine, valore] of [
    ["robots", tag.robots],
    ["X-Robots-Tag", tag.xRobots],
  ]) {
    if (valore && /noindex/i.test(valore)) {
      findings.push({
        severity: "block",
        object: `pagina ${pagina.id}`,
        message: `\`${origine}: ${valore}\` su una pagina dichiarata pubblica: e' esclusa dall'indice, e nessun punteggio SEO lo dice`,
      });
    }
  }
  return findings;
}

/**
 * I rilievi sul `canonical`, che si vedono solo confrontando piu' pagine.
 *
 * `chiPossiede` e' la memoria del confronto e viene AGGIORNATA qui: due pagine
 * che dichiarano lo stesso canonical sono al massimo una originale, e l'altra
 * si sta cancellando dall'indice. E' il difetto che seo.md §119 dice di cercare
 * confrontando pagine diverse — «guardando solo la home il difetto e'
 * invisibile, perche' la home il canonical giusto ce l'ha». Misurato sul banco:
 * `/immobili` con `canonical` a `/`.
 */
function findingsCanonicalPagina(pagina, tag, chiPossiede) {
  const mio = percorsoNormalizzato(tag.canonical);
  if (!mio) return [];
  const findings = [];
  const gia = chiPossiede.get(mio);
  if (gia) {
    findings.push({
      severity: "block",
      object: `pagina ${pagina.id}`,
      message: `dichiara lo stesso \`canonical\` di \`${gia}\` (${tag.canonical}): al massimo una delle due e' l'originale, l'altra sta chiedendo di uscire dall'indice`,
    });
  } else {
    chiPossiede.set(mio, pagina.id);
  }
  // Un canonical che punta altrove puo' essere legittimo — una variante che si
  // dichiara copia della principale — quindi e' un `warn`, non un `block`:
  // quale delle due sia la principale e' una decisione di prodotto
  // (seo.md §356), e il gate non la puo' prendere.
  const suo = percorsoNormalizzato(pagina.percorso);
  if (suo && mio !== suo) {
    findings.push({
      severity: "warn",
      object: `pagina ${pagina.id}`,
      message: `\`canonical\` punta a \`${mio}\` e non a \`${suo}\`: se e' voluto (una variante che si dichiara copia) va scritto nel contratto, altrimenti questa pagina sparisce dall'indice pur essendo perfetta`,
    });
  }
  return findings;
}

/** Il percorso di un URL assoluto o relativo, senza barra finale. */
function percorsoNormalizzato(valore) {
  if (!valore) return null;
  try {
    const p = new URL(valore, "http://banco.invalido").pathname.replace(/\/+$/, "");
    return p || "/";
  } catch {
    return null;
  }
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

/**
 * CHI CERCA, e dove NON cerca. Referto del 2026-08-06, § C1 (`executed-confirmed`).
 *
 * Il gate si lancia dalla radice del progetto AUDITATO — lo prescrive il
 * `CLAUDE.md` — e `where` cerca nella directory corrente PRIMA che nel PATH: un
 * `npx.cmd` piantato nella radice sceglieva quale binario misura il sito, cioe'
 * quali numeri finiscono nel verdetto. Misurato dal finto progetto: `where
 * supabase` elencava per primo lo shim piantato, `where "$PATH:supabase"` no.
 * E `spawnSync` col nome nudo fa lo stesso di suo, per questo anche `where.exe`
 * e `cmd.exe` vogliono il percorso pieno: chi cerca e chi lancia sarebbero i
 * primi due binari sostituibili, e non li guarda nessuno.
 */
export function comandoRicerca(nome, piattaforma = process.platform, env = process.env) {
  // Su POSIX `which` legge il PATH e basta; alla directory corrente dentro il
  // PATH (`.`) risponde `dentroLaRadice`.
  if (piattaforma !== "win32") return { file: "which", args: [nome] };
  const sistema = env.SystemRoot || env.windir || "C:\\Windows";
  return { file: `${sistema}\\System32\\where.exe`, args: [`$PATH:${nome}`] };
}

/** La shell che lancia gli shim `.cmd`, col percorso pieno e mai come nome nudo. */
export const shellDiSistema = (env = process.env) =>
  env.ComSpec || `${env.SystemRoot || env.windir || "C:\\Windows"}\\System32\\cmd.exe`;

/**
 * Un candidato cade dentro il progetto auditato? Il PATH puo' contenerlo
 * davvero — `node_modules/.bin` ce lo mette npm — e allora il prefisso `$PATH:`
 * non basta piu'. Il confronto NON e' per prefisso di stringa: `C:\prog-altro`
 * comincia per `C:\prog` e non e' dentro. Si normalizzano le barre e si
 * confrontano i segmenti, senza importare `node:path` in un file che promette
 * di non toccare il mondo.
 */
export function dentroLaRadice(percorso, radice) {
  if (!percorso || !radice) return false;
  const segmenti = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").split("/");
  const r = segmenti(radice);
  const c = segmenti(percorso);
  if (c.length <= r.length) return false;
  // Windows non distingue maiuscole e minuscole nei percorsi, e un `C:\PROG`
  // e' lo stesso posto di `C:\prog`.
  return r.every((pezzo, i) => pezzo.toLowerCase() === c[i].toLowerCase());
}

/**
 * `file: null` quando il nome non si risolve: il nome nudo NON si lancia,
 * perche' lo risolverebbe la directory corrente. Strumento assente = verifica
 * MANCANTE, che e' la regola della casa, mai un `pass`.
 * Si cerca anche fuori da Windows, per la stessa ragione.
 */
export function formaEseguibile(
  nome,
  cercaPercorso,
  piattaforma = process.platform,
  comSpec = shellDiSistema(),
) {
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: null, prefisso: [] };
  return piattaforma === "win32" && /\.(cmd|bat)$/i.test(trovato)
    ? { file: comSpec, prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

/**
 * Gli argomenti che NON sopravvivono a `cmd /c` — e quelli che ne APPROFITTANO.
 *
 * PRIMA META', misurata il 2026-07-30: gli spazi. Con lo stesso comando e un
 * argomento solo di differenza:
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
 * Rimisurato il 2026-08-06 e PRECISATO: il collasso avviene quando anche il
 * percorso dello shim contiene uno spazio (`C:\\Program Files\\nodejs\\npx.cmd`
 * su questa macchina). Con uno shim senza spazi, l'argomento con spazi passa.
 * La riga resta com'era — restringerla sarebbe indebolire una regola su una
 * differenza che dipende da DOVE e' installato lo strumento.
 *
 * SECONDA META', misurata il 2026-08-06 (referto § H1/L1): i metacaratteri, che
 * questa funzione lasciava passare tutti. Stesso shim, stessa forma:
 *
 *   ...shim.cmd /&ver          → SHIM ricevuto: /   + «Microsoft Windows […]»
 *                                cioe' `ver` ESEGUITO, e status 0
 *   ...shim.cmd %USERNAME%     → SHIM ricevuto: Utente
 *   ...shim.cmd /|ver          → lo shim non parte affatto, parte `ver`, status 0
 *   ...shim.cmd />rubato.txt   → status 0, e su disco compare `rubato.txt`
 *
 * Il commento della casa «NON si usa `shell: true`» diceva il vero e non
 * bastava: `cmd.exe /c` **e' una shell**, e ri-analizza `& | < > ^ ( ) " %`
 * prima che gli argomenti diventino argomenti. La riga che filtrava i soli
 * spazi rifiutava l'unico caso che a volte funziona e lasciava passare i quattro
 * che eseguono codice.
 *
 * La difesa non e' virgolettare meglio: dentro `"…"` cmd neutralizza `&|<>()`
 * ma NON `%`, e Node virgoletta solo cio' che contiene spazi. Si rifiuta e si
 * dice perche' — un gate che li passasse in silenzio misurerebbe qualcos'altro
 * e stamperebbe un numero: direzione sicura, diagnosi bugiarda.
 */
// I caratteri di CONTROLLO sono proprio cio' che si cerca: un a capo dentro
// un argomento e' una riga di comando in piu' per `cmd`. `no-control-regex`
// esiste per chi ce li mette per sbaglio (DECISIONI.md §8: ogni esenzione ha
// il motivo sulla riga sopra).
// eslint-disable-next-line no-control-regex
const OSTILI_A_CMD = /[\s&|<>^()"%]|[\u0000-\u001f]/;

export function argomentiOstiliACmd(args, piattaforma = process.platform) {
  if (piattaforma !== "win32") return [];
  return (args ?? []).filter((a) => OSTILI_A_CMD.test(String(a)));
}

// ------------------------------------------------- quando il limite scatta
/**
 * `spawnSync` col `timeout` uccide il figlio e mette `error.code = "ETIMEDOUT"`
 * (misurato: `status: null`, `signal: "SIGKILL"`). Un processo ucciso NON e' un
 * processo che ha risposto male: distinguerli e' la differenza fra «lo strumento
 * dice che il sito e' lento» e «lo strumento non ha detto niente».
 */
export const scaduto = (res) => res?.error?.code === "ETIMEDOUT";

/**
 * Il messaggio di un limite scattato: QUALE comando, QUANTO ha aspettato, e che
 * cosa vale (MANCANTE, mai un successo). Senza queste tre cose un gate che si
 * ferma e' indistinguibile da un gate che ha misurato.
 */
export const motivoScaduto = (comando, ms) =>
  `\`${comando}\` non ha risposto entro ${Math.round(ms / 1000)} s ed e' stato interrotto. ` +
  "La misura NON e' stata fatta: verifica MANCANTE, non un successo. " +
  "Un server che accetta la connessione e non risponde e' il guasto tipico — la porta e' aperta, il processo e' vivo, la risposta non arriva.";

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
  const proprio = senzaZoneCitate(testoHandoff);
  // I SEGNAPOSTO NON COMPILATI (referto § M11). Era l'unico dei quattro gate
  // della casa a non guardarli, e il suo template di handoff ne ha 53: si
  // consegnava un modulo in bianco con una riga vera. La riga `Gate: VERDE`
  // e' l'unica che serve compilare per passare, ed e' anche l'unica che
  // qualcuno compila di sicuro.
  //
  // Si contano DOPO `senzaZoneCitate`, e per il motivo che Flow Sentinel ha
  // gia' pagato: uno snippet CI legittimo (`${{ secrets.X }}` di GitHub
  // Actions) dentro un recinto non e' un segnaposto rimasto.
  const segnaposto = [...proprio.matchAll(/\{\{[^}\n]*\}\}/g)].map((m) => m[0]);
  if (segnaposto.length > 0) {
    const primi = [...new Set(segnaposto)].slice(0, 3).join(", ");
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message: `contiene ${segnaposto.length} segnaposto \`{{…}}\` non compilati (${primi}${segnaposto.length > 3 ? ", …" : ""}): e' il modulo del template, non un passaggio di consegne`,
      },
    ];
  }
  // `.toUpperCase()`, come nelle tre skill sorelle (referto § L5). La regexp
  // e' `i`, il confronto no: `Gate: verde` su un gate VERDE veniva letto e poi
  // dichiarato diverso da «VERDE», e il gate chiudeva rosso su un handoff
  // giusto. Un rosso strutturale insegna a ignorare il rosso.
  const dichiarato = RIGA_VERDETTO.exec(proprio)?.[1]?.toUpperCase() ?? null;
  if (!dichiarato) {
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message: "manca la riga `Gate: VERDE` o `Gate: ROSSO`: un handoff senza verdetto non si puo' confrontare con niente",
      },
    ];
  }
  if (dichiarato !== verdettoPrima) {
    return [
      {
        severity: "block",
        object: percorsoHandoff,
        message: `dichiara \`Gate: ${dichiarato}\` ma il gate chiude ${verdettoPrima}: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA`,
      },
    ];
  }
  return [];
}
