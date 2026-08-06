/**
 * gate-lib.mjs — Le regole del gate di Launchpad, pure e testabili.
 *
 * Qui non si apre nessun file, non si lancia nessun comando e non si tocca la
 * rete: sono funzioni da testo a verdetto. Il guscio di I/O sta in
 * `verify.mjs`, e l'ORDINE della sua lista `PASSI` e' il gate.
 *
 * La specifica di ogni regola sta in `references/verifica-deterministica.md`,
 * che e' stata scritta PRIMA di questo file. Se i due divergono, vince quella.
 */

import { ePubblicaPerCostruzione, eSegnaposto, nomeSospetto } from "./segreti-lib.mjs";

// ------------------------------------------------------------------- comuni
const senzaBom = (testo) => testo.replace(/^\uFEFF/, "");
const righe = (testo) => senzaBom(testo ?? "").split(/\r?\n/);

/**
 * Le zone citate non dichiarano niente: un blocco recintato dentro un template
 * contiene un ESEMPIO compilato, un commento HTML contiene un promemoria.
 * Leggerli come dichiarazioni fa nascere firme che nessuno ha messo — difetto
 * gia' pagato da Flow Sentinel il 2026-07-28 sul contratto dei flussi.
 */
const senzaZoneCitate = (testo) =>
  senzaBom(testo ?? "")
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

export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

/** Il verdetto degli altri passi, per il contratto d'uscita (§19). */
export const verdettoDa = (passi) =>
  passi.some((s) => s.status === "fail" || s.status === "skipped") ? "ROSSO" : "VERDE";

/** Confronto fra date ISO che tollera l'assenza: senza data non si accusa nessuno. */
export const piuVecchioDi = (aIso, bIso) => {
  if (!aIso || !bIso) return false;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
};

// ======================================================== 1. radice-pulita
export function findingsRadice({ sporco = [], ramo = null, upstream = null, avanti = 0, indietro = 0, bugiardi = [] } = {}) {
  const findings = [];
  /**
   * `git status` puo' MENTIRE, e si misura in un comando.
   *
   * Trovato dal collaudo del 2026-08-06. `--assume-unchanged` e
   * `--skip-worktree` dicono a git di non guardare piu' quel file: l'albero
   * risulta **pulito** mentre il disco e il commit sono due cose diverse. E la
   * direzione pericolosa e' quella che nessun altro passo copre — si committa
   * il file sbagliato, si rimette sul disco quello giusto, e **il gate legge il
   * disco mentre il provider riceve il commit**.
   *
   * Misurato sull'arena: un sorgente committato che legge
   * `process.env.CHIAVE_MAI_DICHIARATA`, con la versione pulita sul disco →
   * `ambiente` **pass**, zero rilievi, e la pagina che la usa risponde 500 in
   * produzione. Non e' un'ipotesi di laboratorio: `--skip-worktree` e' il modo
   * documentato di tenere una configurazione locale sopra un file tracciato.
   */
  if (bugiardi.length > 0) {
    findings.push({
      severity: "block",
      object: bugiardi.slice(0, 6).join(" · ") + (bugiardi.length > 6 ? " · …" : ""),
      message: `${bugiardi.length} file marcati \`assume-unchanged\`/\`skip-worktree\`: git non li guarda piu' e l'albero SEMBRA pulito`,
      hint: "il gate legge il disco, il provider riceve il commit: con questo marchio i due possono divergere senza che `git status` dica niente. Si toglie con `git update-index --no-assume-unchanged <file>` (o `--no-skip-worktree`) e si guarda cosa cambia",
    });
  }
  if (sporco.length > 0) {
    const mostrati = sporco.slice(0, 8).join(" · ");
    findings.push({
      severity: "block",
      object: "working tree",
      message: `${sporco.length} file non committati: ${mostrati}${sporco.length > 8 ? " · …" : ""}`,
      hint: "il provider riceve il COMMIT, non il disco. Cio' che e' qui e non li' non partira' — o partira' soltanto con un deploy da CLI, che e' un altro modo di pubblicare qualcosa che nessuno ha misurato",
    });
  }
  if (upstream && avanti > 0) {
    findings.push({
      severity: "block",
      object: `${ramo ?? "HEAD"} → ${upstream}`,
      message: `HEAD e' avanti di ${avanti} commit rispetto al remoto`,
      hint: "un deploy connesso a git costruisce cio' che sta SUL REMOTO: pubblicherebbe un commit piu' vecchio di quello che questo gate ha appena misurato, e ogni altro passo resterebbe verde perche' ha guardato il disco",
    });
  }
  /**
   * E il verso opposto, che la specifica non aveva previsto: HEAD **INDIETRO**.
   *
   * La sosta di meta' pacchetto aveva trovato «avanti di tre commit» — il
   * provider costruisce qualcosa di piu' VECCHIO. Il collaudo del 2026-08-06 ha
   * misurato il gemello: con il remoto avanti di uno, il gate chiude
   * `radice-pulita` **pass con zero rilievi**, e il provider costruisce un
   * commit **piu' nuovo** di quello che tutti gli altri otto passi hanno
   * misurato. E' peggio dell'altro caso, non meglio: li' si pubblicava roba
   * gia' vista, qui roba mai vista da nessuno di questi passi.
   */
  if (upstream && indietro > 0) {
    findings.push({
      severity: "block",
      object: `${ramo ?? "HEAD"} → ${upstream}`,
      message: `il remoto e' avanti di ${indietro} commit rispetto a HEAD`,
      hint: "un deploy connesso a git costruisce cio' che sta SUL REMOTO: pubblicherebbe un commit che nessuno degli altri otto passi ha guardato. Si allinea (`git pull`) e si rilancia il gate — non si pubblica sperando che quei commit siano innocui",
    });
  }
  if (!upstream) {
    findings.push({
      severity: "issue",
      object: ramo ?? "HEAD",
      message: "nessun ramo remoto configurato",
      hint: "si puo' pubblicare da CLI, ma allora il runbook deve dichiararlo (`Modo di deploy: cli`): tutto il resto del gate ha misurato un commit che nessun remoto conosce",
    });
  }
  if (!ramo) {
    findings.push({
      severity: "warn",
      object: "HEAD",
      message: "HEAD distaccato: nessun ramo",
      hint: "si pubblica lo stesso, ma il rollback «torna al commit precedente del ramo» non esistera'",
    });
  }
  return findings;
}

// ========================================================== 2. catena-gate
/** La riga di forma fissa che la §19 ha imposto a tutta la casa. */
const RIGA_GATE = /^[ \t>*_-]*Gate[ \t*_]*:[ \t*_]*(VERDE|ROSSO)\b/im;
export const verdettoHandoff = (testo) => senzaZoneCitate(testo ?? "").match(RIGA_GATE)?.[1] ?? null;

/**
 * Le prove di appartenenza alla catena, MISURATE e non dichiarate.
 *
 * Ogni agente della casa lascia un contratto firmato, e il contratto e'
 * l'evidenza che quell'agente faceva parte di questo progetto. Trovato dalla
 * domanda di meta' pacchetto: un agente che non e' mai passato non lascia
 * nessun `Gate: ROSSO` da leggere — lascia SILENZIO, e il silenzio era verde.
 */
export const CONTRATTI = Object.freeze([
  { agente: "schema-forge", prova: "supabase/migrations/" },
  { agente: "vetrina-crafter", prova: "docs/vetrina.md" },
  { agente: "gestionale-crafter", prova: "docs/gestionale.md" },
  { agente: "flow-sentinel", prova: "docs/flussi-critici.md" },
  { agente: "speed-demon", prova: "docs/performance.md" },
]);

/**
 * L'handoff di launchpad NON si giudica qui.
 *
 * Rilievo VER-16: un handoff onesto che dichiara `Gate: ROSSO` — come la §19
 * prescrive — faceva fallire il passo 2 **e** passare il passo 9, e il rosso
 * veniva attribuito alla catena a monte quando apparteneva a launchpad. La
 * riga di chiusura del gate («ogni motivo dice di chi e': quasi nessuno e' di
 * launchpad») diventava falsa proprio quando serviva. A giudicarlo e' il passo
 * 9, che e' l'unico che puo': conosce il verdetto misurato.
 */
const MIO = /(^|-)launchpad$/i;

/**
 * Le righe aggiunte da un commit sono SOLO il rimedio che questa skill scrive?
 *
 * Trovato dal collaudo del 2026-08-06, ed e' un ROSSO STRUTTURALE — la cosa che
 * la §19 vieta. Il flusso di questa skill prescrive `impronta` (passo 5) PRIMA
 * di `handoff` (passo 7) e di `verify` (passo 8): quindi launchpad scrive
 * `generateBuildId` in `next.config.ts`, quel commit e' il piu' recente che
 * tocca il codice spedito, e da quel momento **tutti** gli handoff a monte
 * risultano «piu' vecchi del codice che certificano». Misurato su un banco
 * corretto in tutto il resto: quattro `block` su quattro handoff, e nessuno dei
 * quattro agenti poteva farci niente — l'unico rimedio sarebbe stato ridatare
 * un certificato su una modifica che quell'agente non ha mai visto.
 *
 * L'esenzione e' STRETTA e misurata riga per riga, non dedotta dall'autore del
 * commit: il commit deve toccare **soltanto** un `next.config.*`, deve
 * introdurre `generateBuildId`, e **ogni** riga aggiunta deve appartenere al
 * frammento che questa skill genera. Una virgola in piu' in quel file, e la
 * freschezza torna a scattare.
 */
export function eSoloFrammentoImpronta(aggiunte, frammento) {
  const ammesse = new Set([
    ...String(frammento ?? "").split("\n").map((r) => r.trim()),
    "generateBuildId: improntaDalCommit,",
  ]);
  ammesse.delete("");
  const vere = (aggiunte ?? []).map((r) => r.trim()).filter(Boolean);
  if (vere.length === 0) return false;
  if (!vere.some((r) => /generateBuildId/.test(r))) return false;
  return vere.every((r) => ammesse.has(r));
}

export function findingsCatena({ handoff = [], proveTrovate = [], ultimoCommitCodice = null } = {}) {
  const findings = [];
  for (const h of handoff.filter((x) => !MIO.test(x.agente))) {
    const verdetto = verdettoHandoff(h.testo);
    if (verdetto === null) {
      findings.push({
        severity: "block",
        object: h.percorso,
        message: "nessuna riga `Gate: VERDE|ROSSO` leggibile",
        hint: "un handoff senza verdetto non e' un certificato, e' prosa. La forma fissa esiste perche' un controllo su prosa libera e' un controllo che non c'e' (DECISIONI.md §19)",
      });
    } else if (verdetto === "ROSSO") {
      findings.push({
        severity: "block",
        object: h.percorso,
        message: "dichiara `Gate: ROSSO`",
        hint: "non si pubblica su gate rosso. La risposta e' una richiesta all'agente che possiede quel gate, non una correzione di launchpad",
      });
    }
    if (h.data === null) {
      // Rilievo VER-9: senza data la misura di freschezza si spegne in
      // silenzio, e `catena-gate` torna a essere una lettura pura. La data
      // manca quando l'handoff NON e' tracciato da git — e un handoff ignorato
      // non lascia l'albero sporco, quindi `radice-pulita` non se ne accorge:
      // il gate certificherebbe una catena che non esiste per chi clona.
      findings.push({
        severity: "block",
        object: h.percorso,
        message: "non tracciato da git: nessuna data di commit, quindi nessuna misura di freschezza",
        hint: "un certificato che non parte col repository non e' un certificato. Va committato",
      });
    } else if (piuVecchioDi(h.data, ultimoCommitCodice)) {
      findings.push({
        severity: "block",
        object: h.percorso,
        message: `piu' vecchio del codice che certifica (handoff ${h.data?.slice(0, 10)} · ultimo commit di codice ${ultimoCommitCodice?.slice(0, 10)})`,
        hint: "quel verde certificava un altro artefatto. E' l'idea del `BUILD_ID` applicata alla catena dei certificati: si rilancia il gate di quell'agente e si riscrive la riga",
      });
    }
  }
  const conHandoff = new Set(handoff.map((h) => h.agente));
  for (const { agente, prova } of CONTRATTI) {
    if (!proveTrovate.includes(prova)) continue;
    if (conHandoff.has(agente)) continue;
    findings.push({
      severity: "block",
      object: agente,
      message: `il suo contratto esiste (\`${prova}\`) e il suo handoff no`,
      hint: "un agente che non e' mai arrivato in fondo non lascia un `Gate: ROSSO` da leggere: lascia silenzio. Il contratto sul disco e' la prova che doveva passare",
    });
  }
  return findings;
}

// ===================================================== 3. debito-bloccante
const BLOCCA_DEPLOY = [
  /blocca(?:no)?\s+(?:il\s+)?deploy/i,
  /blocca(?:no)?\s+la\s+pubblicazione/i,
  /prescrizione\s+di\s+deploy/i,
  // `[^\n]` e non `[^.]`, ed e' una correzione misurata: la voce n°4 del pilota
  // scrive «e il deploy (P.5) non puo' partire senza», e il PUNTO dentro `P.5`
  // faceva fallire la classe di caratteri. Il gate leggeva tre bloccanti su
  // quattro e taceva sul quarto — cioe' faceva esattamente quello che il
  // criterio di accettazione di P.5 esiste per scoprire.
  /il\s+deploy\b[^\n]{0,40}non\s+pu[oò]\s+partire/i,
  /prerequisit\w*\s+(?:di|per|del)\s+(?:deploy|P\.5|pubblicazione)/i,
];

/**
 * «**Non** blocca il deploy» non e' una dichiarazione di bloccare il deploy.
 *
 * Trovato dal collaudo del 2026-08-06 su un registro corretto: la voce
 * *«Le immagini sono segnaposto. Non blocca il deploy, e' un contenuto»*
 * veniva contata fra i bloccanti, e il runbook doveva risponderle. E' lo
 * stesso difetto che il tribunale aveva chiuso su `CHIUSA` (rilievo VER-4,
 * dove «NON CHIUSA» valeva chiusa): la negazione era stata gestita sul gettone
 * di chiusura e non su quello di blocco, cioe' su una delle due meta'.
 *
 * Un rifiuto indebito e' il difetto peggiore di un gate perche' insegna a
 * scavalcarlo — e qui insegnava a scriverlo in un modo diverso, che e' peggio:
 * il giorno che una voce blocca davvero, chi legge ha gia' imparato a passare
 * oltre.
 *
 * La negazione deve GOVERNARE il verbo, non stare da qualche parte nella riga:
 * si guarda solo la coda del testo che precede il combaciamento, e si ammette
 * al massimo un pronome in mezzo (`non lo blocca`). Cosi' «questa voce non e'
 * chiusa **e** blocca il deploy» resta un bloccante.
 */
const NEGAZIONE_PRIMA = /\bnon\b(?:\s+(?:lo|la|ne|ci|piu'|più))?[\s*_`~]*$/i;

function dichiaraDiBloccare(riga) {
  const t = String(riga ?? "");
  for (const r of BLOCCA_DEPLOY) {
    for (const m of t.matchAll(new RegExp(r.source, r.flags.includes("g") ? r.flags : `${r.flags}g`))) {
      if (!NEGAZIONE_PRIMA.test(t.slice(0, m.index))) return true;
    }
  }
  return false;
}
/**
 * Il gettone di chiusura, di FORMA FISSA.
 *
 * Prima era `/\bCHIUS[OA]\b/i` cercata come sottostringa nella cella della
 * gravita', cioe' in prosa libera — e il tribunale del 2026-08-06 (rilievo
 * VER-4) ha misurato che «NON CHIUSA» e «alto - non ancora chiuso» valevano
 * **chiusa**. Non era un'ipotesi: sul pilota vero la voce n°15 risultava chiusa
 * per via della frase «meta' di database CHIUSA il 2026-08-06» scritta li'
 * dentro. Chiudere un bloccante del deploy costava una parola scritta in
 * negativo.
 *
 * Ora la cella deve COMINCIARE (dopo il markup) con `CHIUSO <data>`. Il resto
 * della cella resta prosa libera. E' la stessa scelta della §19: una riga sola,
 * in una forma sola, perche' un controllo su prosa libera e' un controllo che
 * non c'e'.
 */
const CHIUSA = /^[\s*_`]*CHIUS[OA]\b[^|]*?\d{4}-\d{2}-\d{2}/i;

/**
 * Il registro del debito, letto come tabella.
 *
 * E' l'unico posto in cui questa casa scrive, numerato, cosa impedisce di
 * pubblicare — e lo scrivono gli agenti a monte, prima che launchpad esista.
 * Il passo che lo legge e' la parte del gate che sa DI PIU' e misura DI MENO:
 * per questo `segreti` e `runtime-riproducibile` rimisurano da soli due delle
 * voci, cosi' che almeno due verita' escano una volta come promessa e una
 * volta come misura.
 */
/** Una riga che SEMBRA una riga di tabella, escluse testata e separatore. */
const RIGA_DI_TABELLA = /^\s*\|.*\|\s*$/;
const SEPARATORE = /^\s*\|[-: |]+\|\s*$/;

/**
 * Il registro, letto come tabella — e con il conto di quello che NON ha letto.
 *
 * Rilievo VER-3 del tribunale: il numero si leggeva solo nudo (`| 27 |`), e
 * `| n°27 |` — **la notazione che questa casa usa ovunque**, e che
 * `leggiRunbook` accetta — era invisibile. Come il grassetto, il punto, e le
 * pipe esterne assenti. La voce spariva **in silenzio** e il passo diceva
 * «0 dichiarano di bloccare il deploy»: misurato un gate VERDE 9/9 con due
 * bloccanti nel registro.
 *
 * Due correzioni insieme, e la seconda vale piu' della prima: si accettano le
 * forme che la casa scrive davvero, **e** si contano le righe di tabella non
 * lette, perche' «nessun bloccante» e «non ho saputo leggere» non devono poter
 * assomigliarsi (`DECISIONI.md` §18).
 */
export function leggiDebito(testo) {
  const voci = [];
  let nonLette = 0;
  for (const riga of righe(senzaZoneCitate(testo))) {
    if (!RIGA_DI_TABELLA.test(riga) || SEPARATORE.test(riga)) continue;
    const m = riga.match(/^\s*\|[\s*_`]*(?:n[°.º]\s*)?(\d{1,4})[\s*_`.]*\|(.*)\|\s*$/i);
    if (!m) {
      // La testata (`| # | Agente | … |`) non e' una voce mancata.
      if (!/^\s*\|\s*#?\s*\|/.test(riga) && !/^\s*\|[^|]*\|\s*Agente\b/i.test(riga)) nonLette++;
      continue;
    }
    const celle = m[2].split("|").map((c) => c.trim());
    const gravita = celle[1] ?? "";
    voci.push({
      numero: Number(m[1]),
      agente: celle[0] ?? "",
      gravita,
      chiusa: CHIUSA.test(gravita),
      // La chiusura si legge nella TERZA colonna e in nessun'altra, ed e' un
      // contratto che nessun documento dichiarava: il collaudo del 2026-08-06
      // ha costruito un registro con la forma `| # | Voce | Chi | Stato |` —
      // legittima e leggibile da un umano — e il gate ha stampato «0 voci gia'
      // chiuse» sopra due voci che si dichiaravano chiuse. Se una voce fosse
      // stata anche bloccante, sarebbe stato un rifiuto indebito su un
      // progetto in regola. Ora la colonna e' scritta nella reference E lo
      // scarto si dichiara invece di sparire.
      chiusaAltrove: !CHIUSA.test(gravita) && celle.some((c, i) => i !== 1 && CHIUSA.test(c)),
      bloccaDeploy: dichiaraDiBloccare(riga),
      cosa: (celle[2] ?? "").replace(/\*\*/g, "").slice(0, 120),
    });
  }
  voci.nonLette = nonLette;
  return voci;
}

/** I numeri di debito citati altrove: servono a scoprire un riferimento orfano. */
export function numeriCitati(testi) {
  const numeri = new Set();
  for (const testo of testi) {
    for (const m of senzaZoneCitate(testo).matchAll(/\b(?:debito|voce|residuo)\w*[^.\n]{0,40}?n[°.º]\s*(\d{1,3})/gi)) {
      numeri.add(Number(m[1]));
    }
    for (const m of senzaZoneCitate(testo).matchAll(/\bDEBITO-TECNICO\.md\s*n[°.º]\s*(\d{1,3})/gi)) {
      numeri.add(Number(m[1]));
    }
  }
  return numeri;
}

export function findingsDebito({ voci = [], citati = new Set(), risposte = new Map(), runbookEsiste = false } = {}) {
  const findings = [];
  if (voci.nonLette > 0) {
    findings.push({
      severity: "block",
      object: "docs/DEBITO-TECNICO.md",
      message: `${voci.nonLette} righe di tabella non lette: non si sa se contengono un bloccante`,
      hint: "«nessun bloccante» e «non ho saputo leggere la riga» non devono potersi assomigliare (DECISIONI.md §18). Il numero va in prima cella, nudo oppure come `n°27`; le pipe esterne servono",
    });
  }
  for (const v of voci.filter((x) => x.chiusaAltrove)) {
    findings.push({
      severity: "issue",
      object: `debito n°${v.numero}`,
      message: "dichiara `CHIUSO <data>` in una colonna che questo passo non legge: per il gate resta APERTA",
      hint: "il gettone di chiusura si legge nella TERZA colonna (`| n | agente | gravita'/stato | cosa | … |`), come nel registro del pilota. Altrove non viene visto, e se la voce dichiarasse anche di bloccare il deploy il gate chiederebbe una risposta a una voce gia' chiusa",
    });
  }
  const bloccanti = voci.filter((v) => v.bloccaDeploy && !v.chiusa);
  for (const v of bloccanti) {
    const risposta = risposte.get(v.numero);
    if (!runbookEsiste || risposta === undefined) {
      findings.push({
        severity: "block",
        object: `debito n°${v.numero} (${v.agente})`,
        message: `dichiara di bloccare il deploy e il runbook non lo nomina — ${v.cosa}`,
        hint: runbookEsiste
          ? "aggiungi la riga `| " + v.numero + " | … | … |` in §Prescrizioni del runbook, con la risposta: chiusa a monte, oppure mitigata e da chi"
          : "non esiste `docs/deploy.md`: il comando `piano` lo scrive dal template, con questa voce gia' dentro",
      });
    } else if (risposta.trim().length < 10 || eSegnaposto(risposta)) {
      findings.push({
        severity: "block",
        object: `debito n°${v.numero} (${v.agente})`,
        message: "nominato nel runbook ma senza una risposta leggibile",
        hint: "nominare non e' rispondere. Le uscite oneste sono due: chiusa a monte dall'agente che la possiede, oppure mitigata con una mitigazione scritta e accettata da chi firma",
      });
    }
  }
  const presenti = new Set(voci.map((v) => v.numero));
  for (const n of citati) {
    if (!presenti.has(n)) {
      findings.push({
        severity: "issue",
        object: `debito n°${n}`,
        message: "citato in un handoff, assente dal registro",
        hint: "il registro lo scrivono le stesse mani che potrebbero volerlo alleggerire. Un riferimento orfano e' l'unico segno che resta di una riga cancellata — o di un refuso, che si chiude correggendolo",
      });
    }
  }
  return findings;
}

// ================================================================ il runbook
const riga1 = (testo, etichetta) =>
  senzaZoneCitate(testo).match(new RegExp(`^[ \\t>*_-]*${etichetta}[ \\t*_]*:[ \\t*_]*(.+)$`, "im"))?.[1]
    ?.replace(/\*\*/g, "").trim() ?? null;

const SEZIONI_RICHIESTE = Object.freeze([
  { chiave: "variabili", r: /^#{2,3}\s.*variabil/im, che: "Variabili d'ambiente di produzione" },
  { chiave: "pubblico", r: /^#{2,3}\s.*(?:cosa diventa pubblico|cosa va online)/im, che: "Cosa diventa pubblico" },
  { chiave: "rollback", r: /^#{2,3}\s.*rollback/im, che: "Rollback" },
  { chiave: "prescrizioni", r: /^#{2,3}\s.*prescrizioni/im, che: "Prescrizioni lasciate dagli altri" },
]);

export function leggiRunbook(testo) {
  const pulito = senzaZoneCitate(testo ?? "");
  const variabili = [];
  for (const riga of righe(pulito)) {
    const m = riga.match(/^\s*\|\s*`?([A-Z][A-Z0-9_]{2,})`?\s*\|([^|]*)\|(.*)\|\s*$/);
    if (!m) continue;
    variabili.push({
      nome: m[1],
      quando: m[2].replace(/\*\*/g, "").trim().toLowerCase(),
      note: m[3].replace(/\*\*/g, "").trim(),
    });
  }
  const risposte = new Map();
  for (const riga of righe(pulito)) {
    const m = riga.match(/^\s*\|\s*(?:n[°.º]\s*)?(\d{1,3})\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const celle = m[2].split("|").map((c) => c.trim());
    risposte.set(Number(m[1]), celle[celle.length - 1] ?? "");
  }
  return {
    provider: riga1(pulito, "Provider"),
    dominio: riga1(pulito, "Dominio"),
    runtimeProvider: riga1(pulito, "Runtime del provider"),
    commitApprovato: riga1(pulito, "Commit approvato"),
    modoDeploy: riga1(pulito, "Modo di deploy"),
    radiciSpedite: (riga1(pulito, "Radici spedite") ?? "")
      .split(/[,·]/).map((r) => r.trim().replace(/^`|`$/g, "")).filter(Boolean),
    versionePrecedente: riga1(pulito, "Versione precedente"),
    confermatoDa: riga1(pulito, "Confermato da"),
    variabili,
    risposte,
    sezioni: new Set(SEZIONI_RICHIESTE.filter((s) => s.r.test(pulito)).map((s) => s.chiave)),
    segnaposto: [...pulito.matchAll(/\{\{[^}]{0,60}\}\}/g)].map((m) => m[0]),
  };
}

/**
 * Una firma e' una persona con un ruolo e una data.
 *
 * Rifiutata: il segnaposto del template; il nome dell'agente (la §6 esiste
 * perche' una macchina non autorizza un'azione irreversibile); una riga che
 * nomina entrambe le possibilita' senza sceglierne una.
 */
export function esitoFirma(confermatoDa) {
  if (!confermatoDa) return { valida: false, motivo: "riga `Confermato da:` assente" };
  const f = confermatoDa.trim();
  if (/\{\{|<[A-Z ]+>|\.{3,}/.test(f) || eSegnaposto(f)) return { valida: false, motivo: "segnaposto del template, non una firma" };
  if (/\b(launchpad|agente|claude|assistente|automatic)\b/i.test(f)) {
    return { valida: false, motivo: "firmata dall'agente: la §6 esiste perche' una macchina non autorizza un'azione irreversibile" };
  }
  if (/\bUMANO\b.*\|.*\bORCHESTRATORE\b|\bORCHESTRATORE\b.*\|.*\bUMANO\b/i.test(f)) {
    return { valida: false, motivo: "nomina entrambe le possibilita': non ha scelto niente" };
  }
  // L'ULTIMA data della riga, non la prima (rilievo VER-5): con la prima,
  // `Alberto Marocco (committente, contratto 2030-01-01) — 2026-08-06`
  // veniva letta come firmata nel 2030.
  const tutte = [...f.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  const data = tutte.length > 0 ? tutte[tutte.length - 1] : null;
  if (!data) return { valida: false, motivo: "senza data: una firma non datata non si puo' confrontare con niente" };
  return { valida: true, data, chi: f };
}

/**
 * Una firma nel futuro non e' una firma: e' un permesso a tempo indeterminato.
 *
 * Rilievo VER-5, misurato: con `— 2030-01-01` il controllo di freschezza non
 * scatta piu' per nessun commit futuro, perche' una data futura non e' mai
 * «piu' vecchia» di niente. La §6 diventa una costante.
 *
 * L'oggi arriva da fuori (`adesso`): questa libreria resta pura, e chi la
 * chiama dichiara che ora e'. Un giorno di franchigia per i fusi orari.
 */
function findingFirmaFutura(firma, adesso) {
  if (!firma.valida || !adesso) return null;
  const franchigia = Date.parse(`${firma.data}T00:00:00Z`) - Date.parse(adesso);
  if (!Number.isFinite(franchigia) || franchigia <= 24 * 60 * 60 * 1000) return null;
  return {
    severity: "block",
    object: "Confermato da",
    message: `firma datata ${firma.data}, cioe' nel futuro (oggi e' ${adesso.slice(0, 10)})`,
    hint: "una firma futura non scade mai: autorizzerebbe ogni commit successivo senza che nessuno la rinnovi. La §6 non e' una costante",
  };
}

export function findingsRunbook({ runbook, ultimoCommitCodice = null, adesso = null } = {}) {
  const findings = [];
  const acapo = (chiave, che) => {
    if (!runbook.sezioni.has(chiave)) {
      findings.push({
        severity: "block",
        object: `§${che}`,
        message: "sezione obbligatoria assente",
        hint: "«la conferma e' sul contenuto, non sul comando»: chi firma deve trovare scritto cosa va online. Un runbook senza questa sezione fa firmare un comando",
      });
    }
  };
  for (const s of SEZIONI_RICHIESTE) acapo(s.chiave, s.che);

  if (runbook.segnaposto.length > 0) {
    findings.push({
      severity: "block",
      object: "docs/deploy.md",
      message: `${runbook.segnaposto.length} segnaposto residui: ${runbook.segnaposto.slice(0, 4).join(" · ")}`,
      hint: "un runbook a meta' e' un runbook che nessuno ha compilato, e la parte che si compila per ultima e' il rollback — cioe' quella che serve nel momento peggiore",
    });
  }
  for (const [campo, etichetta] of [["provider", "Provider"], ["dominio", "Dominio"], ["modoDeploy", "Modo di deploy"]]) {
    if (!runbook[campo]) {
      findings.push({
        severity: "block",
        object: etichetta,
        message: "non dichiarato",
        hint: "chi firma deve sapere dove va, con quale indirizzo e con quale modo. Un provider scelto di default non e' una scelta",
      });
    }
  }
  if (runbook.dominio && !/^https:\/\//i.test(runbook.dominio)) {
    findings.push({
      severity: "block",
      object: "Dominio",
      message: `\`${runbook.dominio}\` non e' un indirizzo \`https://\``,
      hint: "il dominio dichiarato e' quello che chi firma legge e quello che `verifica-pubblicato` interroga dopo",
    });
  }
  if (!runbook.versionePrecedente) {
    findings.push({
      severity: "block",
      object: "§Rollback",
      message: "nessuna riga `Versione precedente:`",
      hint: "«si puo' tornare indietro» senza dire A COSA e' un'intenzione, non una procedura",
    });
  }

  const firma = esitoFirma(runbook.confermatoDa);
  if (!firma.valida) {
    findings.push({
      severity: "block",
      object: "Confermato da",
      message: firma.motivo,
      hint: "DECISIONI.md §6: si delega la conferma di cio' che e' reversibile, mai quella di cio' che non lo e'. Pubblicare non lo e', e costa soldi",
    });
  } else if (piuVecchioDi(`${firma.data}T23:59:59Z`, ultimoCommitCodice)) {
    findings.push({
      severity: "block",
      object: "Confermato da",
      message: `firma del ${firma.data}, codice modificato il ${ultimoCommitCodice?.slice(0, 10)}`,
      hint: "ha firmato un altro contenuto. La firma si rinnova: e' l'unica riga del progetto che vale per un'azione che non si annulla",
    });
  }
  const futura = findingFirmaFutura(firma, adesso);
  if (futura) findings.push(futura);
  return findings;
}

// ============================================================== 5. ambiente
/**
 * Le variabili che un sorgente legge davvero.
 *
 * Tre forme e non una: `process.env.NOME` e' quella che si scrive per prima e
 * quella che lascia scoperte le altre due. Una variabile mancante letta con le
 * parentesi quadre passerebbe il gate e romperebbe la pagina.
 */
export function variabiliLette(testo) {
  const nomi = new Set();
  const t = testo ?? "";
  for (const m of t.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) nomi.add(m[1]);
  for (const m of t.matchAll(/process\.env\[\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\s*\]/g)) nomi.add(m[1]);
  const destruttura = /(?:const|let|var)\s*\{[^}]*\}\s*=\s*process\.env\b/.test(t);
  return { nomi, destruttura };
}

const INDIRIZZO_LOCALE = /(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])/i;

/**
 * Le fonti del commit che il frammento dell'impronta legge in `next.config`.
 *
 * NON sono configurazione dell'applicazione: sono gli ingressi del meccanismo
 * che questa skill stessa scrive, e le ultime due le imposta il provider da
 * solo su una build connessa a git. Pretenderle nel runbook produceva tre
 * `block` — misurati sul banco il 2026-08-06 — cioe' il gate diventava rosso
 * per il codice che il suo stesso comando `impronta` aveva appena messo li'.
 *
 * Un gate che boccia il rimedio che la sua skill prescrive e' un gate che
 * insegna a non applicare il rimedio.
 */
export const VARIABILI_IMPRONTA = Object.freeze(["WEBGUN_COMMIT", "VERCEL_GIT_COMMIT_SHA", "CF_PAGES_COMMIT_SHA"]);

export function findingsAmbiente({ lette = new Map(), destrutturano = [], runbook } = {}) {
  const findings = [];
  const dichiarate = new Map(runbook.variabili.map((v) => [v.nome, v]));

  for (const [nome, file] of lette) {
    if (VARIABILI_IMPRONTA.includes(nome)) continue;
    const v = dichiarate.get(nome);
    if (!v) {
      findings.push({
        severity: "block",
        object: nome,
        message: `letta da ${file} e non dichiarata nel runbook`,
        hint: "il deploy costruisce, parte, e la pagina che la usa risponde 500 o mostra il ripiego. E' il guasto di produzione piu' banale e piu' frequente",
      });
      continue;
    }
    if (ePubblicaPerCostruzione(nome) && !/prima della build|build time|a costruzione/i.test(v.quando)) {
      findings.push({
        severity: "block",
        object: nome,
        message: `dichiarata «${v.quando || "(vuoto)"}»: una \`NEXT_PUBLIC_*\` va impostata PRIMA della build`,
        hint: "`next build` la inserisce nel bundle. Impostarla solo a runtime sul pannello ripara le pagine e lascia rotti `sitemap.xml` e `robots.txt`, che sono prerenderizzati una volta sola e non si rigenerano mai",
      });
    }
    if (ePubblicaPerCostruzione(nome) && INDIRIZZO_LOCALE.test(v.note)) {
      findings.push({
        severity: "block",
        object: nome,
        message: `il valore di produzione dichiarato e' un indirizzo locale: \`${v.note}\``,
        hint: "da qui discendono `canonical`, Open Graph, `sitemap.xml` e `robots.txt`. Sbagliata al deploy, resta sbagliata finche' qualcuno non ricostruisce",
      });
    }
    if (!ePubblicaPerCostruzione(nome) && nomeSospetto(nome) && v.note && !eSegnaposto(v.note) && v.note.length > 8) {
      findings.push({
        severity: "block",
        object: nome,
        message: "il runbook ne riporta un VALORE, non solo il nome",
        hint: "`docs/deploy.md` e' committato. Le variabili di servizio si dichiarano; i loro valori si impostano sul pannello del provider e non entrano in un file",
      });
    }
  }
  for (const v of runbook.variabili) {
    if (!lette.has(v.nome)) {
      findings.push({
        severity: "issue",
        object: v.nome,
        message: "dichiarata nel runbook e letta da nessun sorgente spedito",
        hint: "quasi sempre e' il residuo di un nome cambiato: `NEXT_PUBLIC_SITE_URL` invece di `NEXT_PUBLIC_SITO_URL` sul pannello dell'hosting sembra lavoro fatto",
      });
    }
  }
  for (const file of destrutturano) {
    findings.push({
      severity: "issue",
      object: file,
      message: "destruttura `process.env`: i nomi non si risolvono staticamente",
      hint: "il passo dichiara di non aver potuto contare le variabili di questo file. Un passo che tace su cio' che non ha letto e' un passo che dichiara di aver letto tutto",
    });
  }
  return findings;
}

// ================================================== 6. runtime-riproducibile
/**
 * Il minimo di un range `engines`. `null` se non e' una forma che sappiamo leggere.
 *
 * `||` e' un'UNIONE, e il minimo di un'unione e' il piu' PICCOLO dei minimi,
 * non il primo che si incontra. Correzione misurata sul pilota il 2026-08-06:
 * `dependency-cruiser` dichiara `^20.12||^22||>=24`, cioe' «va bene da 20.12 in
 * su»; la prima stesura leggeva `>=24` e produceva un `block` su un progetto
 * corretto che dichiarava `>=22`. Un rifiuto indebito e' il difetto peggiore di
 * un gate, perche' insegna a scavalcarlo.
 */
export function minimoNode(range) {
  const r = String(range ?? "").trim();
  if (!r) return null;
  const minimi = r.split("||").map((alternativa) => {
    const a = alternativa.trim();
    const ge = a.match(/^>=?\s*v?(\d+)/);
    if (ge) return Number(ge[1]);
    const caret = a.match(/^[\^~]\s*v?(\d+)/);
    if (caret) return Number(caret[1]);
    const esatto = a.match(/^v?(\d+)(?:\.\d+)*$/);
    if (esatto) return Number(esatto[1]);
    return null;
  });
  const leggibili = minimi.filter((m) => m !== null);
  // Un'alternativa che non sappiamo leggere rende TUTTA l'unione illeggibile:
  // potrebbe essere quella che ammette la versione piu' bassa, e indovinarla
  // significherebbe alzare il minimo di un'unione senza averla capita.
  if (leggibili.length !== minimi.length || leggibili.length === 0) return null;
  return Math.min(...leggibili);
}

/**
 * La versione maggiore dichiarata sul pannello del provider.
 *
 * Accetta tutto ciò che una persona scrive davvero: `Node 24`, `Node 24.x`,
 * `Node.js 24`, `Node 24 LTS`, `22.x`. Rifiuta solo le righe che non portano
 * **nessun** numero, e quelle che ne portano **piu' di uno** — perche' li' non
 * si indovina quale sia (`Node 24 minimo, consigliato 22`).
 */
export function leggiRuntimeProvider(riga) {
  const t = String(riga ?? "").replace(/^\s*node(?:\.?js)?\s*[:v]?\s*/i, "").trim();
  if (!t) return null;
  const numeri = [...t.matchAll(/\d+/g)].map((m) => Number(m[0]));
  // `24.9.0` e `24.x` sono UNA versione, non tre numeri: si guardano i soli
  // gruppi separati da spazio.
  const gruppi = t.split(/\s+/).filter((g) => /\d/.test(g));
  if (numeri.length === 0 || gruppi.length !== 1) return null;
  return numeri[0];
}

export function findingsRuntime({ engines = null, richieste = [], lockfile = [], runbook = null } = {}) {
  const findings = [];
  const mio = minimoNode(engines);
  const massimoRichiesto = richieste.reduce(
    (acc, r) => (r.minimo !== null && (acc === null || r.minimo > acc.minimo) ? { ...r } : acc),
    null,
  );

  if (!engines) {
    findings.push({
      severity: "block",
      object: "package.json → engines.node",
      message: "il progetto non dichiara il runtime",
      hint: massimoRichiesto
        ? `la macchina di deploy sceglie da sola, e le dipendenze installate ne pretendono almeno ${massimoRichiesto.minimo} (\`${massimoRichiesto.nome}\`: \`${massimoRichiesto.range}\`). Una macchina piu' vecchia fallisce la build — o peggio, non fallisce e serve pagine rotte`
        : "la macchina di deploy sceglie da sola, e il suo default cambia nel tempo",
    });
  } else if (mio === null) {
    findings.push({
      severity: "issue",
      object: "package.json → engines.node",
      message: `\`${engines}\` non e' una forma che questo gate sa confrontare`,
      hint: "il confronto e' fra minimi (`>=22`), non fra range arbitrari: un range esotico si segnala e non si interpreta",
    });
  } else if (massimoRichiesto && mio < massimoRichiesto.minimo) {
    findings.push({
      severity: "block",
      object: "package.json → engines.node",
      message: `dichiara \`${engines}\` (minimo ${mio}) ma \`${massimoRichiesto.nome}\` pretende \`${massimoRichiesto.range}\` (minimo ${massimoRichiesto.minimo})`,
      hint: "e' lo stesso guasto di un runtime non dichiarato, scritto male invece che non scritto",
    });
  }

  const tracciati = lockfile.filter((l) => l.tracciato);
  if (lockfile.length === 0) {
    findings.push({
      severity: "block",
      object: "lockfile",
      message: "nessun lockfile nel progetto",
      hint: "senza lockfile la build del provider non e' la tua build: risolve le versioni il giorno in cui gira",
    });
  } else if (tracciati.length === 0) {
    findings.push({
      severity: "block",
      object: lockfile.map((l) => l.nome).join(" · "),
      message: "presente sul disco e non tracciato da git",
      hint: "esiste qui e non parte: identico a non averlo, con l'aggravante che sembra a posto",
    });
  } else if (tracciati.length > 1) {
    findings.push({
      severity: "issue",
      object: tracciati.map((l) => l.nome).join(" · "),
      message: "piu' lockfile di gestori diversi",
      hint: "il provider ne sceglie uno, e non e' detto sia il tuo. `packageManager` in `package.json` toglie l'ambiguita'",
    });
  }

  // `Runtime del provider: Node 24` — la parola si toglie prima di leggere il
  // numero. Il runbook lo legge un umano, e «24» da solo su quella riga non
  // dice a nessuno di cosa si stia parlando.
  //
  // E si prende il PRIMO NUMERO della riga, non si pretende una forma esatta
  // (rilievo VER-12): `Node 24.x`, `Node.js 24`, `Node 24 LTS` venivano
  // rifiutati con «non dichiarato», cioe' il gate accusava l'umano di non aver
  // dichiarato una cosa che aveva dichiarato — e `22.x` e' **la forma in cui il
  // pannello di Vercel scrive le versioni**, quella che una persona copia. Un
  // rifiuto indebito e' il difetto peggiore di un gate perche' insegna a
  // scavalcarlo, e qui la regola era violata dal codice che la cita.
  const dichiaratoProvider = leggiRuntimeProvider(runbook?.runtimeProvider);
  const minimoVero = massimoRichiesto ? Math.max(massimoRichiesto.minimo, mio ?? 0) : mio;
  if (runbook) {
    if (dichiaratoProvider === null) {
      findings.push({
        severity: "block",
        object: "Runtime del provider",
        message: "il runbook non dichiara quale runtime e' impostato sul pannello",
        hint: "`engines` NON e' imposto da nessun provider senza `engine-strict`: dichiararlo e basta produce una build che fallisce con la colpa assegnata, non una build che riesce",
      });
    } else if (minimoVero !== null && dichiaratoProvider < minimoVero) {
      findings.push({
        severity: "block",
        object: "Runtime del provider",
        message: `il runbook dichiara Node ${dichiaratoProvider}, il progetto ne richiede almeno ${minimoVero}`,
        hint: "e' la misura che trasforma una prescrizione in un confronto: qui il deploy fallirebbe, e si sa prima",
      });
    }
  }
  return findings;
}

// ==================================================== 7. impronta-artefatto
/** L'impronta e' il commit, accorciato a una lunghezza leggibile e stabile. */
export const improntaAttesa = (sha) => String(sha ?? "").trim().toLowerCase().slice(0, 12);

/**
 * Due impronte combaciano se una e' prefisso dell'altra e sono lunghe abbastanza.
 *
 * Il confronto per prefisso non e' pigrizia: `WEBGUN_COMMIT` puo' arrivare
 * corta da una mano umana, `VERCEL_GIT_COMMIT_SHA` arriva lunga 40. Sotto i
 * sette caratteri non si confronta niente: e' la soglia sotto la quale due
 * commit diversi collidono davvero.
 */
export function improntaCombacia(a, b) {
  const x = String(a ?? "").trim().toLowerCase();
  const y = String(b ?? "").trim().toLowerCase();
  if (x.length < 7 || y.length < 7) return false;
  return x.startsWith(y) || y.startsWith(x);
}

/**
 * Il build id dentro l'HTML servito.
 *
 * Tre forme, misurate su Next 16 con Turbopack il 2026-08-06: nel payload RSC
 * come `\"b\":\"<id>\"` (l'unica presente sul pilota), come `"buildId":"<id>"`
 * nel vecchio `__NEXT_DATA__`, e nel percorso `/_next/static/<id>/_buildManifest.js`.
 * Cercarne una sola sarebbe stato un rifiuto indebito su meta' dei progetti.
 */
export function buildIdDaHtml(html) {
  const t = senzaBom(html ?? "");
  const trovati = new Set();
  for (const m of t.matchAll(/\\?"b\\?":\\?"([A-Za-z0-9_-]{6,})\\?"/g)) trovati.add(m[1]);
  for (const m of t.matchAll(/\\?"buildId\\?":\\?"([A-Za-z0-9_-]{6,})\\?"/g)) trovati.add(m[1]);
  for (const m of t.matchAll(/\/_next\/static\/([A-Za-z0-9_-]{6,})\/_(?:buildManifest|ssgManifest)/g)) trovati.add(m[1]);
  return [...trovati];
}

const SHA_LETTERALE = /["'`][0-9a-f]{7,40}["'`]/i;

export function findingsImpronta({
  nextConfig = null, buildIdDisco = null, commit = null, html = null, url = null,
  commitApprovato = null, soloDocumentiDaAllora = null,
} = {}) {
  const atteso = improntaAttesa(commit);
  return [
    ...findingsConfigImpronta(nextConfig),
    ...findingsArtefatto(buildIdDisco, atteso),
    ...findingsCommitApprovato(commitApprovato, commit, soloDocumentiDaAllora),
    ...(html === null ? [] : findingsServito(html, atteso, url)),
  ];
}

/**
 * Il commit che l'umano ha firmato e' quello che sta per partire?
 *
 * Rilievo VER-8: `Commit approvato` veniva letto dal runbook e **non
 * confrontato con niente** — il campo esisteva nel template, nel parser e in un
 * test, e nessuna regola lo riceveva. Misurato: runbook con
 * `Commit approvato: 0000…`, HEAD diverso, gate VERDE 9/9. L'umano firma «X»,
 * il gate misura «Y», e stampa verde. E' il caso §5.4 («il runbook giusto per
 * il progetto sbagliato») applicato al commit invece che al dominio — con la
 * differenza che qui la riga per chiuderlo c'era gia'.
 */
function findingsCommitApprovato(commitApprovato, commit, soloDocumentiDaAllora) {
  if (commitApprovato === null) return [];
  const dichiarato = String(commitApprovato).trim();
  // Un runbook che scrive prosa al posto di uno sha non ha approvato un commit.
  if (!/^[0-9a-f]{7,40}$/i.test(dichiarato)) {
    return [{
      severity: "block",
      object: "Commit approvato",
      message: `\`${dichiarato.slice(0, 60)}\` non e' un identificativo di commit`,
      hint: "la firma vale per un contenuto solo: il runbook deve nominare lo sha che sta per andare online, e si riscrive a ogni pubblicazione",
    }];
  }
  if (improntaCombacia(dichiarato, String(commit ?? ""))) return [];
  // Il commit approvato puo' essere un ANTENATO di HEAD, ma solo se da allora
  // e' cambiata **soltanto la documentazione**: e' il caso normale e inevitabile
  // — il runbook si scrive dopo il commit che approva, e scriverlo produce un
  // altro commit. Se invece dopo l'approvazione e' cambiato del CODICE, la
  // firma e' su un altro contenuto e non vale piu'.
  if (soloDocumentiDaAllora === true) {
    return [{
      severity: "warn",
      object: "Commit approvato",
      message: `il runbook approva \`${dichiarato.slice(0, 12)}\` e HEAD e' \`${String(commit ?? "").slice(0, 12)}\`: da allora sono cambiati solo documenti`,
      hint: "va bene, ed e' il caso normale: il runbook si scrive dopo il commit che approva. Ma cio' che va online e' HEAD",
    }];
  }
  return [{
    severity: "block",
    object: "Commit approvato",
    message: `il runbook approva \`${dichiarato.slice(0, 12)}\`, HEAD e' \`${String(commit ?? "").slice(0, 12)}\`${soloDocumentiDaAllora === false ? " e da allora e' cambiato del CODICE" : ""}`,
    hint: "chi ha firmato ha autorizzato un altro contenuto. O si pubblica quel commit, o si rinnova la firma su questo",
  }];
}

/** Come nasce l'impronta: la parte che decide se sara' dimostrabile DOPO. */
function findingsConfigImpronta(nextConfig) {
  const findings = [];
  if (nextConfig === null) {
    findings.push({
      severity: "block",
      object: "next.config.ts",
      message: "non trovato: non si sa come nasce l'impronta dell'artefatto",
      hint: "il comando `impronta` lo scrive",
    });
  } else if (!/generateBuildId/.test(nextConfig)) {
    findings.push({
      severity: "block",
      object: "next.config.ts → generateBuildId",
      message: "non dichiarato: l'impronta e' casuale",
      hint: "dopo una ricostruzione del provider nessuno puo' piu' dimostrare cosa c'e' online. Non e' un dettaglio di comodita': e' la sola prova d'identita' che sopravvive al fatto che non siamo noi a costruire",
    });
  } else {
    // Il file INTERO, non una finestra dopo la chiave. Misurato sul banco il
    // 2026-08-06: `generateBuildId: improntaDalCommit` rimanda a una funzione
    // definita PRIMA — che e' la forma che il frammento della skill produce —
    // e una finestra di 600 caratteri dopo la chiave non vede mai il corpo.
    // Il gate accusava di «non sollevare» un frammento che solleva.
    // Un `next.config` e' un file piccolo e dedicato: leggerlo tutto costa
    // niente, e un letterale esadecimale li' dentro non ha altre spiegazioni.
    const corpo = nextConfig;
    if (SHA_LETTERALE.test(corpo)) {
      findings.push({
        severity: "block",
        object: "next.config.ts → generateBuildId",
        message: "contiene uno SHA scritto come letterale",
        hint: "al commit successivo quel letterale e' ancora li', e la build del provider dichiarerebbe con sicurezza il commit SBAGLIATO. E' peggio dell'impronta casuale: quella ammette di non sapere, questa afferma il falso",
      });
    }
    if (!/throw\b/.test(corpo)) {
      findings.push({
        severity: "issue",
        object: "next.config.ts → generateBuildId",
        message: "non solleva quando il commit non e' risolvibile",
        hint: "un ripiego silenzioso e' un artefatto che non sa dire chi e'. Una build che non puo' identificarsi non deve nascere",
      });
    }
  }

  return findings;
}

/** L'artefatto sul disco: e' di QUESTO commit? */
function findingsArtefatto(buildIdDisco, atteso) {
  if (buildIdDisco === null) {
    return [{
      severity: "block",
      object: ".next/BUILD_ID",
      message: "assente: nessun artefatto costruito",
      hint: "`npm run build` dalla radice del progetto, con il runtime dichiarato",
    }];
  }
  if (!improntaCombacia(buildIdDisco, atteso)) {
    return [{
      severity: "block",
      object: ".next/BUILD_ID",
      message: `l'artefatto sul disco porta \`${buildIdDisco}\`, il commit di HEAD e' \`${atteso}\``,
      hint: "l'artefatto e' di un altro commit, oppure l'impronta non e' ancora derivata dal commit. Si ricostruisce",
    }];
  }
  return [];
}

/** Cio' che risponde sull'indirizzo: e' l'artefatto che credo? */
function findingsServito(html, atteso, url) {
  const serviti = buildIdDaHtml(html);
  // NIENTE ripiego `html.includes(atteso)` — rilievo VER-7 del tribunale.
  // L'avevo scritto per robustezza, ed era un buco: il passo passava contro
  // QUALUNQUE pagina che si limitasse a NOMINARE il commit — un log di deploy,
  // la pagina del commit su GitHub, il cruscotto del provider. Misurato:
  // «Deploy log del progetto / Commit: 71541dae…» faceva chiudere il gate
  // VERDE 9/9. Il passo deve trovare un BUILD ID, non una stringa in un testo.
  const combacia = serviti.some((s) => improntaCombacia(s, atteso));
  if (combacia) return [];
  return [{
    severity: "block",
    object: url ?? "app servita",
    message: `non porta l'impronta attesa \`${atteso}\`${serviti.length ? ` (serve \`${serviti.join("`, `")}\`)` : " (nessun build id riconoscibile nell'HTML)"}`,
    hint: "sta rispondendo un'altra applicazione, o una build precedente. Misurare qualunque altra cosa su questo indirizzo darebbe numeri plausibili di un sito che non e' questo",
  }];
}

// ==================================================== 9. contratto-uscita
export function contrattoUscita(percorso, testo, verdettoMisurato) {
  if (testo === null || testo === undefined) {
    return [{
      severity: "block",
      object: percorso,
      message: "handoff assente",
      hint: "si scrive PRIMA del gate: `verify` lo controlla, quindi scriverlo dopo significa chiudere con un rosso strutturale",
    }];
  }
  const findings = [];
  const segnaposto = [...senzaZoneCitate(testo).matchAll(/\{\{[^}]{0,60}\}\}/g)].map((m) => m[0]);
  if (segnaposto.length > 0) {
    findings.push({
      severity: "block",
      object: percorso,
      message: `${segnaposto.length} segnaposto residui: ${segnaposto.slice(0, 4).join(" · ")}`,
      hint: "un handoff col template dentro non e' un passaggio di consegne",
    });
  }
  const dichiarato = verdettoHandoff(testo);
  if (dichiarato === null) {
    findings.push({
      severity: "block",
      object: percorso,
      message: "nessuna riga `Gate: VERDE|ROSSO`",
      hint: "DECISIONI.md §19: il verdetto in una riga di forma fissa. La prosa libera si puo' sempre leggere come si vuole",
    });
  } else if (dichiarato !== verdettoMisurato) {
    findings.push({
      severity: "block",
      object: percorso,
      message: `dichiara \`Gate: ${dichiarato}\`, questa esecuzione e' ${verdettoMisurato}`,
      hint: `quello vero e' ${verdettoMisurato}. Se il gate e' rosso l'handoff dichiara rosso e questo passo PASSA: dichiarare non e' fallire`,
    });
  }
  return findings;
}
