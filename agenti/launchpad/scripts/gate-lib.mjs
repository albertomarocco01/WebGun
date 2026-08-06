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
export function findingsRadice({ sporco = [], ramo = null, upstream = null, avanti = 0 } = {}) {
  const findings = [];
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

export function findingsCatena({ handoff = [], proveTrovate = [], ultimoCommitCodice = null } = {}) {
  const findings = [];
  for (const h of handoff) {
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
    if (piuVecchioDi(h.data, ultimoCommitCodice)) {
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
const CHIUSA = /\bCHIUS[OA]\b/i;

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
export function leggiDebito(testo) {
  const voci = [];
  for (const riga of righe(senzaZoneCitate(testo))) {
    const m = riga.match(/^\s*\|\s*(\d+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const celle = m[2].split("|").map((c) => c.trim());
    const gravita = celle[1] ?? "";
    voci.push({
      numero: Number(m[1]),
      agente: celle[0] ?? "",
      gravita,
      chiusa: CHIUSA.test(gravita),
      bloccaDeploy: BLOCCA_DEPLOY.some((r) => r.test(riga)),
      cosa: (celle[2] ?? "").replace(/\*\*/g, "").slice(0, 120),
    });
  }
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
  const data = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (!data) return { valida: false, motivo: "senza data: una firma non datata non si puo' confrontare con niente" };
  return { valida: true, data, chi: f };
}

export function findingsRunbook({ runbook, ultimoCommitCodice = null } = {}) {
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
  const dichiaratoProvider = minimoNode((runbook?.runtimeProvider ?? "").replace(/^\s*node(?:js)?\s*[:v]?\s*/i, ""));
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

export function findingsImpronta({ nextConfig = null, buildIdDisco = null, commit = null, html = null, url = null } = {}) {
  const atteso = improntaAttesa(commit);
  return [
    ...findingsConfigImpronta(nextConfig),
    ...findingsArtefatto(buildIdDisco, atteso),
    ...(html === null ? [] : findingsServito(html, atteso, url)),
  ];
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
  const combacia = serviti.some((s) => improntaCombacia(s, atteso)) || (atteso.length >= 7 && html.includes(atteso));
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
