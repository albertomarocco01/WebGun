/**
 * regia-lib.mjs — Le regole del gate della regia, senza I/O.
 *
 * Qui non si apre nessun file, non si lancia nessun processo e non si tocca la
 * rete: sono funzioni da testo a verdetto. Il guscio di I/O e' `verifica-regia.mjs`.
 *
 * PERCHE' LE REGOLE STANNO QUI: una regola che si puo' eseguire solo con il
 * repo intero davanti e' una regola che puo' restare spenta per mesi senza che
 * nessuno lo sappia. Qui hanno i loro test, e ogni regola ne ha due — il caso
 * in cui scatta e quello in cui NON deve scattare.
 *
 * CLASSE DI DIFETTI CHE QUESTE REGOLE CACCIANO: la regia che racconta un repo
 * diverso da quello che esiste. Tre precedenti misurati, non temuti:
 *   - `webgun_content.txt` ha mentito per due giorni sul contenuto del `.docx`
 *     (DECISIONI.md §26);
 *   - `installa-skill.ps1` elencava quattro skill quando erano cinque, e per due
 *     giorni chi seguiva il manuale non installava `speed-demon` e non lo sapeva
 *     (README.md §Installazione);
 *   - la junction mancante ha reso `code-inquisition` non invocabile finche'
 *     qualcuno non se n'e' accorto a mano.
 */

// ------------------------------------------------------------------- comuni
// Non esportata: la usano `righe` e `skillDaPs1`, e knip segnala giustamente
// un'esportazione che nessuno importa: un'API piu' larga di quello che serve
// e' superficie che qualcuno un giorno usera' male.
const senzaBom = (testo) => String(testo ?? "").replace(/^\uFEFF/, "");

/** CRLF e BOM non portano significato: si normalizzano una volta sola,
 *  all'ingresso, e solo loro. */
export const righe = (testo) => senzaBom(testo).split(/\r?\n/);

/** I percorsi si confrontano con le barre in avanti: su Windows arrivano con
 *  le barre rovesce, e due percorsi uguali smettono di esserlo. */
export const conBarre = (percorso) => String(percorso ?? "").replace(/\\/g, "/");

export const dettaglioFindings = (findings) =>
  findings.map((f) => `[${f.severity}] ${f.object}: ${f.message}${f.hint ? `\n         → ${f.hint}` : ""}`).join("\n");

export function contaGravita(findings) {
  const per = (s) => findings.filter((f) => f.severity === s).length;
  return { block: per("block"), issue: per("issue"), warn: per("warn") };
}

/** Un `block` non si consegna: il passo diventa rosso. Issue e warn si stampano
 *  ma non bloccano. */
export const statoDaFindings = (findings) =>
  findings.some((f) => f.severity === "block") ? "fail" : "pass";

const insieme = (elenco) => new Set(elenco.map((n) => n.trim().toLowerCase()).filter(Boolean));

/** L'ultima riga vuota che un `\n` finale produce non e' una riga. */
const senzaCodaVuota = (elenco) => (elenco.length > 0 && elenco[elenco.length - 1] === "" ? elenco.slice(0, -1) : elenco);

/**
 * Le righe di una sezione markdown `## <titolo>`, titolo escluso, fino alla
 * prossima intestazione dello stesso livello o superiore.
 *
 * Il confronto e' sul titolo NORMALIZZATO (minuscole, spazi compressi): le
 * intestazioni di questi documenti portano accenti e maiuscole che nessuno
 * garantisce stabili, e un gate che non trova la sezione deve dire MANCANTE per
 * un motivo vero, non per una lettera.
 */
export function sezione(testo, titolo) {
  const cercato = normalizza(titolo);
  const dentro = [];
  let raccogliendo = false;
  for (const riga of righe(testo)) {
    const intestazione = /^(#{1,6})\s+(.*)$/.exec(riga);
    if (intestazione) {
      const livello = intestazione[1].length;
      if (raccogliendo && livello <= 2) break;
      if (!raccogliendo && livello === 2 && normalizza(intestazione[2]).startsWith(cercato)) {
        raccogliendo = true;
        continue;
      }
    }
    if (raccogliendo) dentro.push(riga);
  }
  return raccogliendo ? dentro : null;
}

const normalizza = (testo) => String(testo ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// ------------------------------------------------------- righe che sono codice
/**
 * Le righe di un sorgente con commenti e contenuto delle stringhe TOLTI.
 *
 * Serve perche' la regola `epiloghi-vivi` cerca un frammento (`import.meta.main`)
 * che in questo repo compare tre volte per ogni skill in forma legittima: nel
 * commento che spiega perche' NON si usa, e dentro le stringhe dei test che
 * verificano che non ci sia. Cercarlo nel testo grezzo vorrebbe dire che il
 * primo a scattare sarebbe il rimedio, non il difetto.
 *
 * NON e' un parser JavaScript, ed e' bene sapere dove cede:
 *   - i backtick attraversano le righe (e' l'unica stringa che lo puo' fare in
 *     JS), apici e virgolette no: una virgoletta spaiata a fine riga NON si
 *     porta dietro la riga successiva;
 *   - una regexp che contiene una virgoletta spaiata (`/["]/`) apre uno stato di
 *     stringa fino a fine riga: quello che segue sulla stessa riga non viene
 *     guardato. E' un buco dichiarato, non un caso non pensato.
 */
export function righeDiCodice(testo) {
  const fuori = [];
  let inBlocco = false;
  let inBacktick = false;
  let numero = 0;
  for (const riga of righe(testo)) {
    numero += 1;
    let codice = "";
    let apice = inBacktick ? "`" : null;
    let i = 0;
    while (i < riga.length) {
      const uno = riga[i];
      const due = riga.slice(i, i + 2);
      if (inBlocco) {
        if (due === "*/") { inBlocco = false; i += 2; continue; }
        i += 1;
        continue;
      }
      if (apice) {
        if (uno === "\\") { i += 2; continue; }
        if (uno === apice) apice = null;
        i += 1;
        continue;
      }
      if (due === "/*") { inBlocco = true; i += 2; continue; }
      if (due === "//") break;
      if (uno === '"' || uno === "'" || uno === "`") { apice = uno; i += 1; continue; }
      codice += uno;
      i += 1;
    }
    inBacktick = apice === "`";
    fuori.push({ numero, codice });
  }
  return fuori;
}

// --------------------------------------------------------- regola: epiloghi vivi
const EPILOGO = "import.meta.main";

/**
 * `if (import.meta.main)` VIVO in uno script: la guardia e' arrivata in Node 24,
 * su Node 20 vale `undefined` e il corpo non gira. Il processo esce **0 senza
 * stampare una riga**, e chi legge il codice d'uscita crede di aver visto un
 * verde. Misurato il 2026-08-02 su questa macchina (Node 20.12.2) sui gate di
 * quattro skill: quattro gate muti (P.0-igiene, `CANTIERE.md`).
 */
export function findingsEpiloghi(file) {
  const findings = [];
  for (const { percorso, testo } of file) {
    for (const { numero, codice } of righeDiCodice(testo)) {
      if (!codice.includes(EPILOGO)) continue;
      findings.push({
        severity: "block",
        object: `${conBarre(percorso)}:${numero}`,
        message: `\`${EPILOGO}\` vivo in una riga di codice: e' arrivato in Node 24, e sul node di sistema di questa macchina (20.12.2) vale \`undefined\` — il corpo non gira e lo script esce 0 senza stampare niente`,
        hint:
          "usa la guardia a **doppio confronto**: `const questo = fileURLToPath(import.meta.url), invocato = resolve(process.argv[1]);` " +
          "poi `if (invocato === questo || realpathSync(invocato) === questo) await main();`, con `realpathSync` dentro un `try` che ricade sul testuale. " +
          "Doppio perche' il solo confronto testuale e' FALSO quando lo script e' invocato dalla junction `.claude/skills/<skill>/...`: li' `argv[1]` resta il percorso della junction mentre `import.meta.url` e' gia' canonico, e lo script esce 0 muto esattamente come con `import.meta.main` (misurato il 2026-08-04 sui cinque gate, `PILOTA-PRE-2026-08-04.md` §2b)",
      });
    }
  }
  return findings;
}

// ----------------------------------------------------- regola: segnaposto radice
/**
 * Un segnaposto di template rimasto in un documento di radice: `{{nome_cliente}}`.
 *
 * DUE COSE NON SCATTANO, ed e' il punto della regola:
 *   - `{{…}}` con i puntini di sospensione — e' come si *nomina* la classe dei
 *     segnaposto, non un segnaposto (DECISIONI.md §19 lo scrive cosi');
 *   - qualunque cosa dentro un blocco ``` o dentro `codice inline` — i documenti
 *     di questa regia CITANO i segnaposto dei template, ed e' li' che lo fanno.
 * Il buco che questo lascia, dichiarato: un segnaposto vero dimenticato dentro
 * un esempio di codice non viene visto.
 */
const SEGNAPOSTO = /\{\{\s*[A-Za-z0-9_][^{}]*\}\}/g;

export function senzaCodice(testo) {
  const fuori = [];
  let inFence = false;
  for (const riga of righe(testo)) {
    if (/^\s*(```|~~~)/.test(riga)) { inFence = !inFence; fuori.push(""); continue; }
    fuori.push(inFence ? "" : riga.replace(/`[^`]*`/g, ""));
  }
  return fuori;
}

export function findingsSegnaposto(file) {
  const findings = [];
  for (const { percorso, testo } of file) {
    senzaCodice(testo).forEach((riga, indice) => {
      for (const trovato of riga.matchAll(SEGNAPOSTO)) {
        findings.push({
          severity: "block",
          object: `${conBarre(percorso)}:${indice + 1}`,
          message: `segnaposto di template mai riempito: \`${trovato[0]}\``,
          hint: "i documenti di radice non sono template: o si riempie, o si toglie la riga",
        });
      }
    });
  }
  return findings;
}

// ------------------------------------------------- lettura degli elenchi dichiarati
/**
 * La tabella `## Natura degli agenti` del README: `nome → { stato, origine }`.
 *
 * E' la dichiarazione che il repo fa di se stesso, e il gate ci si appoggia
 * invece di dedurre: quali agenti siano SNAPSHOT di altri repo e quali siano di
 * casa non sta scritto da nessuna altra parte in forma leggibile da un
 * programma. Se la tabella non c'e', il passo e' MANCANTE — non si ripiega su
 * un elenco cablato qui, che il giorno dopo direbbe una cosa e il README
 * un'altra (DECISIONI.md §18).
 */
export function tabellaAgenti(readme) {
  const dentro = sezione(readme, "Natura degli agenti");
  if (!dentro) return null;
  const agenti = new Map();
  for (const riga of dentro) {
    if (!riga.trim().startsWith("|")) continue;
    const celle = riga.split("|").slice(1, -1).map((c) => c.trim());
    if (celle.length < 5) continue;
    const [nome, categoria, stato, proprietario, origine] = celle;
    if (/^-+:?$/.test(nome.replace(/:/g, "-")) || normalizza(nome) === "nome") continue;
    agenti.set(nome.toLowerCase(), {
      nome,
      categoria,
      stato,
      proprietario,
      origine,
      verde: stato.includes("🟢"),
      diCasa: normalizza(origine) === "questo repo",
    });
  }
  return agenti.size > 0 ? agenti : null;
}

/** L'array `$skill = @("…", "…")` di `installa-skill.ps1`. `null` = non trovato,
 *  e un elenco non trovato non e' un elenco vuoto. */
export function skillDaPs1(testo) {
  const blocco = /\$skill\s*=\s*@\(([\s\S]*?)\)/.exec(senzaBom(testo));
  if (!blocco) return null;
  const nomi = [...blocco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return nomi.length > 0 ? nomi : null;
}

/** L'elenco in grassetto della frase «Installa **x**, **y** e **z**» del README
 *  §Installazione delle skill. E' una frase in prosa perche' e' li' che il
 *  difetto del 2026-07-30 e' vissuto: quattro nomi mentre le skill vere erano
 *  cinque. */
export function skillDaReadme(testo) {
  const dentro = sezione(testo, "Installazione delle skill");
  if (!dentro) return null;
  const frase = dentro.find((r) => /^\s*Installa\s+\*\*/.test(r));
  if (!frase) return null;
  const nomi = [...frase.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
  return nomi.length > 0 ? nomi : null;
}

// -------------------------------------------------- regola: skill elencate
/**
 * Chi puo' installare cosa, detto da tre posti che devono dire la stessa cosa:
 * l'array di `installa-skill.ps1`, la frase del README e la tabella §Natura.
 *
 * TRE DIREZIONI, e nessuna e' la stessa dell'altra:
 *   1. i due elenchi (script e README) sono lo stesso insieme — e' esattamente
 *      il difetto del 2026-07-30, dove lo script ne aveva quattro e la tabella
 *      ne dichiarava cinque vere;
 *   2. ogni nome elencato ESISTE sotto `agenti/` — lo script salta in silenzio
 *      («SALTATA») una cartella che non c'e', e un manuale che nomina una skill
 *      inesistente non produce un errore, produce un'assenza;
 *   3. ogni skill che la tabella dichiara 🟢 e «questo repo» compare in tutti e
 *      due gli elenchi.
 *
 * PERCHE' IL CRITERIO E' LA TABELLA E NON `scripts/verify.mjs`. Un gate che
 * pretendesse in elenco ogni cartella con un `verify.mjs` dentro sarebbe rosso
 * oggi su `vetrina-crafter`, che e' in costruzione: la regola di casa dice che
 * una skill entra in README e nello script **a gate verde** (CANTIERE.md, giornale
 * del 2026-08-02), quindi quel rosso sarebbe strutturale — e un rosso strutturale
 * insegna a scavalcare i rossi veri (DECISIONI.md §16, CANTIERE.md D9). Il
 * segnale giusto e' la riga 🟢: e' il momento in cui il repo dichiara la skill
 * finita, ed e' proprio quello che il commento di `installa-skill.ps1` chiede
 * («quando una skill smette di essere uno scaffold, questa riga si tocca
 * INSIEME ai due documenti»).
 *
 * Il buco che resta, e per questo le esenti si STAMPANO invece di sparire: una
 * skill finita che nessuno ha ancora messo in tabella non viene pretesa in
 * elenco. Il gate la nomina a ogni giro, quindi non e' silenziosa.
 */
export function findingsSkillElencate({ cartelle, tabella, ps1, readme }) {
  const findings = [];
  const nelloScript = insieme(ps1);
  const nelReadme = insieme(readme);
  const esistenti = insieme(cartelle.map((c) => c.nome));

  for (const nome of nelloScript) {
    if (!nelReadme.has(nome)) {
      findings.push({
        severity: "block",
        object: `scripts/installa-skill.ps1 → ${nome}`,
        message: "lo script installa questa skill, il README §Installazione non la elenca: i due elenchi si scrivono a mano e hanno gia' divergito per due giorni",
        hint: "allinea la frase «Installa **…**» del README all'array `$skill`",
      });
    }
    if (!esistenti.has(nome)) {
      findings.push({
        severity: "block",
        object: `scripts/installa-skill.ps1 → ${nome}`,
        message: `\`agenti/${nome}/\` non esiste: lo script stampa «SALTATA» e prosegue, quindi chi lo lancia non installa questa skill e non se ne accorge`,
        hint: "o la cartella e' stata rinominata, o il nome nell'array e' un refuso",
      });
    }
  }
  for (const nome of nelReadme) {
    if (!nelloScript.has(nome)) {
      findings.push({
        severity: "block",
        object: `README.md §Installazione → ${nome}`,
        message: "il README dichiara installata questa skill, l'array di `installa-skill.ps1` non la contiene: chi segue il manuale non installa niente e non lo sa (precedente misurato: speed-demon, 2026-07-30)",
        hint: "aggiungi il nome all'array `$skill` dello script",
      });
    }
  }

  const esenti = [];
  for (const cartella of cartelle) {
    if (!cartella.haVerify) continue;
    const riga = tabella.get(cartella.nome.toLowerCase());
    if (!riga || !riga.diCasa || !riga.verde) {
      esenti.push({
        nome: cartella.nome,
        perche: !riga
          ? "la tabella §Natura non la dichiara affatto"
          : !riga.diCasa
            ? `la tabella la dichiara di «${riga.origine}», non di casa`
            : `la tabella la dichiara «${riga.stato}», non 🟢`,
      });
      continue;
    }
    const chiave = cartella.nome.toLowerCase();
    if (!nelloScript.has(chiave)) {
      findings.push({
        severity: "block",
        object: `agenti/${cartella.nome}`,
        message: "la tabella §Natura la dichiara 🟢 e di questo repo, ma `installa-skill.ps1` non la installa: una skill vera che nessuno puo' invocare",
        hint: "aggiungi il nome all'array `$skill`",
      });
    }
    if (!nelReadme.has(chiave)) {
      findings.push({
        severity: "block",
        object: `agenti/${cartella.nome}`,
        message: "la tabella §Natura la dichiara 🟢 e di questo repo, ma la frase «Installa **…**» del README non la nomina",
        hint: "aggiungi il nome alla frase del README §Installazione delle skill",
      });
    }
  }
  return { findings, esenti };
}

// ------------------------------------------------------ regola: STATO.md presente
/**
 * Ogni agente di casa ha il suo `STATO.md`: e' il file che dice a chi riprende
 * in mano l'agente cosa e' fatto, cosa no e cosa e' stato provato. Gli snapshot
 * esterni si SALTANO — la loro fonte di verita' non e' questa cartella (README
 * §Fonte di verita', DECISIONI.md §2) — e si dice quali, altrimenti «tutto a
 * posto» comprenderebbe in silenzio le cartelle che nessuno ha guardato.
 *
 * Una cartella che la tabella non nomina affatto conta come DI CASA: il verso
 * prudente e' chiedere un `STATO.md` in piu', non esentare in silenzio.
 */
export function findingsStato({ cartelle, tabella }) {
  const findings = [];
  const saltate = [];
  for (const cartella of cartelle) {
    const riga = tabella.get(cartella.nome.toLowerCase());
    if (riga && !riga.diCasa) {
      saltate.push({ nome: cartella.nome, origine: riga.origine });
      continue;
    }
    if (!cartella.haStato) {
      findings.push({
        severity: "block",
        object: `agenti/${cartella.nome}`,
        message: "agente di casa senza `STATO.md`: chi lo riprende non ha modo di sapere cosa e' provato e cosa e' solo scritto",
        hint: "anche uno scaffold ne ha uno: si copia la forma da un agente 🔵 gia' in casa",
      });
    }
  }
  return { findings, saltate };
}

// ------------------------------------------------------- regola: docx vs txt
/**
 * `webgun_content.txt` e' allineato a `Web Gun.docx`?
 *
 * Il confronto e' fra la riestrazione appena fatta (in un file temporaneo) e il
 * file tracciato. Il gate NON riscrive il `.txt`: misura. Un gate che corregge
 * quello che misura chiude verde su ogni giro e non dice mai che qualcuno ha
 * modificato il documento madre senza rilanciare lo script — che e' il difetto
 * (DECISIONI.md §26: il `.txt` ha mentito per due giorni, e il `.txt` e'
 * l'unico dei due file che qualcuno legge davvero, perche' e' l'unico che si
 * vede in un diff).
 */
export function findingsDocx({ attesa, trovata, percorso = "webgun_content.txt" }) {
  // Il confronto e' RIGA PER RIGA sul testo normalizzato, non byte a byte: un
  // checkout con `core.autocrlf` restituisce lo stesso documento con i CRLF, e
  // un gate che lo chiamasse «documento madre modificato» sarebbe rosso su una
  // macchina e verde sull'altra a parita' di contenuto. L'ultima riga vuota che
  // il `\n` finale produce non e' una riga.
  const a = senzaCodaVuota(righe(attesa));
  const t = senzaCodaVuota(righe(trovata));
  if (a.length === t.length && a.every((riga, i) => riga === t[i])) return { findings: [], diverse: 0, prime: [] };

  const prime = [];
  const massimo = Math.max(a.length, t.length);
  let diverse = 0;
  for (let i = 0; i < massimo; i++) {
    if (a[i] === t[i]) continue;
    diverse += 1;
    if (prime.length < 5) prime.push({ numero: i + 1, attesa: a[i] ?? "<fine file>", trovata: t[i] ?? "<fine file>" });
  }
  const findings = [{
    severity: "block",
    object: percorso,
    message:
      `${diverse} righe diverse da quello che si estrae adesso da \`Web Gun.docx\` ` +
      `(tracciato: ${t.length} righe, riestratto: ${a.length}). Il documento madre e' stato modificato in Word e nessuno ha rilanciato \`scripts/estrai-docx.ps1\`` +
      (prime.length > 0
        ? `\n${prime.map((r) => `         riga ${r.numero}\n           .docx  ${r.attesa}\n           .txt   ${r.trovata}`).join("\n")}`
        : ""),
    hint: "`powershell -ExecutionPolicy Bypass -File scripts/estrai-docx.ps1`, poi committa il `.txt` insieme al `.docx`. Il `.txt` non si scrive a mano (DECISIONI.md §26)",
  }];
  return { findings, diverse, prime };
}
