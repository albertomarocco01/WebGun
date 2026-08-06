/**
 * audit-lib.mjs — Le REGOLE dell'audit del gestionale, senza una riga di I/O.
 *
 * COSA FA: prende i file gia' letti (`{percorso, testo}`), la configurazione
 * del progetto e il catalogo dei permessi gia' interrogato, e ritorna i
 * findings `{severity, object, message, hint}`.
 *
 * PERCHE' qui e non nel guscio: una regola che non si puo' eseguire senza un
 * progetto e un database e' una regola che puo' restare spenta per mesi senza
 * che nessuno lo sappia. E' successo a Schema Forge — tre regole spente da un
 * CRLF e da un cast booleano — e la lezione e' scritta nel suo STATO.md.
 * Una regola nuova si aggiunge QUI, col suo test.
 *
 * Le funzioni sono PURE: stesso input, stesso output, nessun effetto.
 */

// ─── forme di file ───────────────────────────────────────────────────────────
const ROTTA = /(^|\/)(page|route|default)\.(tsx?|jsx?)$/;
const LAYOUT = /(^|\/)layout\.(tsx?|jsx?)$/;
// Un route handler NON esegue i layout: la guardia del layout non lo tocca.
// MISURATO il 2026-07-28 sul banco, con `next dev` acceso e senza cookie:
//   GET /admin        → 307 verso /accedi   (la guardia del layout gira)
//   GET /admin/stato  → 200 {"clienti":null} (route handler: il layout non gira)
// Nel secondo caso a non far uscire i dati e' stata la RLS di schema-forge, non
// l'applicazione: con un client `service_role` la stessa rotta avrebbe
// consegnato l'anagrafica intera a chiunque.
const HANDLER = /(^|\/)route\.(tsx?|jsx?)$/;

/** I percorsi viaggiano sempre con le barre in avanti: su Windows arrivano con
 *  le barre rovesce, e un confronto fra `src\app\admin` e `src/app/admin` e' un
 *  confronto che non scatta mai. */
export const conBarre = (p) => String(p ?? "").replace(/\\/g, "/");

const eRotta = (percorso) => ROTTA.test(conBarre(percorso));
const eLayout = (percorso) => LAYOUT.test(conBarre(percorso));
const eRouteHandler = (percorso) => HANDLER.test(conBarre(percorso));

const sottoRadice = (percorso, radice) => {
  const p = conBarre(percorso);
  const r = conBarre(radice).replace(/\/$/, "");
  return p === r || p.startsWith(`${r}/`);
};

const cartellaDi = (percorso) => {
  const p = conBarre(percorso);
  const taglio = p.lastIndexOf("/");
  return taglio === -1 ? "" : p.slice(0, taglio);
};

const trova = (severity, object, message, hint) => ({ severity, object, message, hint });

// ─── testo dei file: commenti e stringhe ─────────────────────────────────────
// Un nome di guardia dentro un commento non e' una chiamata: `// qui manca
// richiediStaff()` renderebbe protetta una rotta scoperta, cioe' il falso
// negativo peggiore — quello che si scrive da solo mentre si prende nota.
export function senzaCommenti(testo) {
  return String(testo ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** Ogni pezzo variabile che finisce in una RegExp passa di qui. I nomi arrivano
 *  dalla configurazione del progetto e dal codice sorgente — non da un utente
 *  ostile — ma un metacarattere non sfuggito trasformerebbe una regola in
 *  un'altra senza che nessuno se ne accorga, e questo vale gia' la riga.
 *  (`semgrep detect-non-literal-regexp` resta acceso e resta dichiarato: una
 *  regola costruita da una lista di nomi non puo' essere una regex letterale.) */
export const perRegExp = (v) => String(v ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Le stringhe non sono codice.
 *
 * `senzaCommenti` toglieva i commenti e lasciava le stringhe, e una chiamata non
 * si distingue da un nome scritto dentro un messaggio. Misurato il 2026-08-06
 * (referto § H7):
 *
 *   throw new Error("richiediStaff() non e ancora agganciata");
 *     → rotta admin scoperta, ZERO findings
 *   la stessa riga senza quella stringa
 *     → 1 block
 *
 * La frase che innescava il difetto e' esattamente quella che si scrive prendendo
 * nota del buco: il codice che ammette di non essere protetto convinceva il gate
 * di esserlo.
 *
 * I template si spengono interi, `${…}` compreso: una guardia chiamata dentro
 * un'interpolazione non conta piu'. E' il verso sicuro — un rilievo in piu' su
 * una forma che nessuno usa per autenticare, non uno in meno.
 */
export function senzaStringhe(codice) {
  return String(codice ?? "")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/** Una chiamata, non una menzione: il nome seguito da parentesi aperta —
 *  e ne' dentro un commento ne' dentro una stringa. */
export function chiamaUnaDi(testo, nomi) {
  const codice = senzaStringhe(senzaCommenti(testo));
  return (nomi ?? []).some((n) => new RegExp(`\\b${perRegExp(n)}\\s*\\(`).test(codice));
}

// ─── regola 1 — nessuna rotta admin senza guardia ────────────────────────────
// E' la Legge n°3 dell'agente. La copertura si eredita dal layout: in App
// Router un `layout.tsx` gira sul server prima di ogni pagina figlia, quindi
// una guardia nel layout della sezione copre tutto cio' che ci sta sotto.
// Non si eredita dal middleware: quello rinfresca i cookie e si aggira.
export function regolaGuardieRotte(files, config) {
  const radice = config.adminRoot;
  const guardie = config.guardie ?? [];
  const eccezioni = (config.rotteScoperte ?? []).map(conBarre);

  const layoutProtetti = files
    .filter((f) => eLayout(f.percorso) && sottoRadice(f.percorso, radice))
    .filter((f) => chiamaUnaDi(f.testo, guardie))
    .map((f) => cartellaDi(f.percorso));

  const findings = [];
  const rotte = files.filter(
    (f) => eRotta(f.percorso) && sottoRadice(f.percorso, radice),
  );

  for (const rotta of rotte) {
    if (eccezioni.includes(conBarre(rotta.percorso))) continue;
    if (chiamaUnaDi(rotta.testo, guardie)) continue;

    const handler = eRouteHandler(rotta.percorso);
    if (!handler && layoutProtetti.some((c) => sottoRadice(cartellaDiRotta(rotta), c))) continue;

    findings.push(
      trova(
        "block",
        conBarre(rotta.percorso),
        handler
          ? `route handler admin senza guardia propria: un route handler NON esegue i layout, quindi la guardia della sezione non lo tocca (misurato: GET su un handler sotto un layout protetto risponde 200 senza cookie)`
          : `rotta admin senza controllo di autenticazione e ruolo: ne' il file ne' un layout che lo contiene chiama una delle guardie (${guardie.join(", ")})`,
        handler
          ? "chiama la guardia come prima riga di ogni verbo esportato (GET, POST, …): per un handler non esiste un posto piu' in alto dove metterla"
          : "aggiungi la guardia nel `layout.tsx` della sezione — non nel middleware, che rinfresca i cookie e non e' un controllo d'accesso",
      ),
    );
  }

  return { findings, rotte: rotte.length };
}

// funzione ausiliaria estratta per leggibilita': la cartella della rotta
const cartellaDiRotta = (rotta) => cartellaDi(rotta.percorso);

// ─── regola 2 — un'azione server e' una rotta ────────────────────────────────
// Una Server Action e' un endpoint POST: si invoca senza passare dal layout che
// ha fatto il controllo. La guardia della pagina NON la protegge, ed e' l'errore
// che si fa per primo, perche' la pagina «sembra» il posto giusto.
export function regolaAzioniServer(files, config) {
  const guardie = config.guardie ?? [];
  const esenti = (config.azioniPubbliche ?? []).map(conBarre);
  const findings = [];

  const azioni = files.filter((f) => /^\s*["']use server["']/m.test(f.testo));
  let riconosciute = 0;
  const nonLette = [];

  for (const file of azioni) {
    const percorso = conBarre(file.percorso);
    if (esenti.includes(percorso)) continue;

    // LA PREMESSA SI CONTA PRIMA DELL'ESITO. Un file `"use server"` di cui non
    // si e' letto nessun nome esportato non e' un file pulito: e' un file che
    // nessuno ha guardato, e il vecchio dettaglio lo contava come «azioni
    // server: 1» (referto § H6).
    const nomi = funzioniEsportate(file.testo);
    riconosciute += nomi.length;
    const quanteIgnote = esportazioniNonLette(file.testo, nomi);
    if (nomi.length === 0 || quanteIgnote > 0) {
      nonLette.push(nomi.length === 0
        ? `${percorso}: nessun nome esportato riconosciuto`
        : `${percorso}: ${quanteIgnote} \`export\` che il gate non sa leggere`);
    }

    for (const nome of nomi) {
      if (chiamaUnaDi(corpoFunzione(file.testo, nome), guardie)) continue;
      findings.push(
        trova(
          "block",
          `${percorso}:${nome}`,
          "azione server senza guardia: e' un endpoint POST raggiungibile senza passare dal layout che fa il controllo",
          "chiama la guardia come prima riga dell'azione, oppure dichiara il file in `azioniPubbliche` del gestionale.config.json (accesso e uscita sono le sole due che possono starci)",
        ),
      );
    }
  }

  // `azioni` conta ora le AZIONI RICONOSCIUTE, non i file: era il numero che si
  // leggeva come copertura avvenuta mentre nessuna azione era stata guardata.
  // `fileAzioni` e `nonLette` restano accanto, perche' la differenza fra i due
  // e' esattamente cio' che il gate non ha misurato.
  return { findings, azioni: riconosciute, fileAzioni: azioni.length, nonLette };
}

/**
 * I nomi ESPORTATI di un file. In un file `"use server"` sono tutti azioni:
 * Next pretende che ogni export di quel file sia una funzione asincrona, quindi
 * la domanda «e' una funzione?» non si pone — si pone «chi esce da qui?».
 *
 * FINO AL 2026-08-06 SI CERCAVA UNA SOLA FORMA, `export async function`.
 * Misurato (referto § H6):
 *
 *   export const salvaOrdine = async (dati) => { … }
 *     → funzioniEsportate = [], findings = 0, e il gate stampava «azioni server: 1»
 *   export async function salvaOrdine(dati) { … }
 *     → 1 block
 *
 * La stessa azione, scritta nell'altro modo che tutti scrivono, non la
 * controllava nessuno — e il dettaglio del passo diceva un numero che si legge
 * come copertura avvenuta.
 */
const FUNZIONE_ESPORTATA = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
const COSTANTE_ESPORTATA = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
const RIESPORTAZIONE = /export\s*\{([^}]*)\}/g;
const ESPORTA_DEFAULT = /export\s+default\b/;

export function funzioniEsportate(testo) {
  const codice = senzaCommenti(testo);
  const nomi = [];
  for (const re of [FUNZIONE_ESPORTATA, COSTANTE_ESPORTATA]) {
    for (const m of codice.matchAll(re)) nomi.push(m[1]);
  }
  // `export { salva, aggiorna as modifica }`: il nome con cui la cosa ESCE e'
  // l'ultimo identificatore della clausola, ed e' quello che un client invoca.
  for (const m of codice.matchAll(RIESPORTAZIONE)) {
    for (const pezzo of m[1].split(",")) {
      const nome = pezzo.trim().split(/\s+/).pop();
      if (nome && /^[A-Za-z_$][\w$]*$/.test(nome) && nome !== "type") nomi.push(nome);
    }
  }
  if (ESPORTA_DEFAULT.test(codice)) nomi.push("default");
  return [...new Set(nomi)];
}

/**
 * Quanti `export` questo file ha, e quanti nomi il gate e' riuscito a leggerne.
 *
 * E' la premessa del passo, ed e' la lezione del referto: «azioni server: 1» su
 * zero funzioni riconosciute si legge come copertura avvenuta. Un file
 * `"use server"` di cui non si e' letto nessun nome non e' un file pulito: e'
 * un file che nessuno ha guardato, e vale MANCANTE.
 *
 * I `export type` e `export interface` non contano: sono dichiarazioni di tipo,
 * non cose che escono a runtime.
 */
export function esportazioniNonLette(testo, nomiLetti) {
  const codice = senzaCommenti(testo)
    .replace(/export\s+(?:type|interface)\b/g, " ");
  const quanti = (codice.match(/\bexport\b/g) ?? []).length;
  return Math.max(0, quanti - nomiLetti.length);
}

/** Il corpo di una funzione, dalla graffa aperta alla sua chiusa. Serve perche'
 *  una guardia chiamata in un'ALTRA funzione dello stesso file non protegge
 *  questa: il file intero come unita' di misura assolverebbe troppo.
 *
 *  Dal 2026-08-06 riconosce anche la costante (referto § H6): un'azione scritta
 *  `export const salva = async (…) => { … }` aveva corpo vuoto, e un corpo vuoto
 *  non chiama nessuna guardia — ma nemmeno produceva un rilievo, perche' il suo
 *  nome non entrava mai nell'elenco. Ci sono due forme di corpo, e la seconda
 *  non ha graffe: `=> await scrivi()` finisce col punto e virgola. */
export function corpoFunzione(testo, nome) {
  const codice = senzaCommenti(testo);
  const dichiarata = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${perRegExp(nome)}\\b`,
  ).exec(codice);
  if (dichiarata) {
    const apertura = codice.indexOf("{", dichiarata.index);
    return apertura === -1 ? "" : dentroGraffe(codice, apertura);
  }
  const costante = new RegExp(
    `export\\s+(?:const|let|var)\\s+${perRegExp(nome)}\\b`,
  ).exec(codice);
  if (!costante) return "";
  const uguale = codice.indexOf("=", costante.index);
  if (uguale === -1) return "";
  const graffa = codice.indexOf("{", uguale);
  const puntoEVirgola = codice.indexOf(";", uguale);
  // corpo a graffe se la graffa arriva PRIMA della fine dell'istruzione;
  // altrimenti e' una freccia concisa, e il corpo e' cio' che resta fino al `;`
  if (graffa !== -1 && (puntoEVirgola === -1 || graffa < puntoEVirgola)) {
    return dentroGraffe(codice, graffa);
  }
  return codice.slice(uguale, puntoEVirgola === -1 ? codice.length : puntoEVirgola);
}

/** Dal `{` alla sua graffa di chiusura, contando i livelli. */
export function dentroGraffe(testo, indiceApertura) {
  let livello = 0;
  for (let i = indiceApertura; i < testo.length; i++) {
    if (testo[i] === "{") livello += 1;
    else if (testo[i] === "}") {
      livello -= 1;
      if (livello === 0) return testo.slice(indiceApertura, i + 1);
    }
  }
  return testo.slice(indiceApertura);
}

// ─── regola 3 — la chiave che scavalca le policy ─────────────────────────────
// `service_role` ignora la RLS per costruzione. In un progetto generato non ha
// nessun posto legittimo: un errore di permesso e' una conversazione con
// schema-forge sulla policy, mai un cambio di chiave.
//
// FINO AL 2026-08-06 LA REGOLA CERCAVA UN NOME. Bastava chiamarla in un altro
// modo (referto § H3, misurato):
//
//   const key = process.env.SB_ADMIN_KEY;
//   export const admin = createClient(process.env.SUPABASE_URL, key);
//     dentro un modulo DICHIARATO in `moduliClientSupabase`
//       → regola 3 = 0, regola 4 = 0, block totali = 0
//   la stessa riga con SUPABASE_SERVICE_ROLE_KEY
//       → 1 block
//
// Il gate riconosceva la parola, non la cosa. Ora guarda tre cose diverse, e
// nessuna delle tre e' il nome della variabile:
//
//   NOME       — la parola `service_role` resta un `block`, com'era: e' il caso
//                piu' frequente e non si toglie niente;
//   VALORE     — una chiave INCOLLATA nel codice si riconosce da com'e' fatta:
//                un JWT il cui payload dichiara `"role":"service_role"`, o una
//                chiave del formato nuovo (`sb_secret_…`). Il nome della
//                costante non conta piu' niente;
//   PROVENIENZA— dentro un modulo che costruisce un client Supabase, ogni
//                `process.env.X` che non sia `NEXT_PUBLIC_*` (cioe' cio' che
//                Next dichiara pubblicabile) e non sia un indirizzo e' una
//                chiave di cui il gate NON sa la provenienza. E' la clausola
//                che chiude il caso misurato, e non nomina nessuna parola.
const SERVICE_ROLE = /service[_-]?role/i;

/** Un JWT scritto nel codice: tre pezzi base64url separati da punto. */
const JWT_LETTERALE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
/** Il formato nuovo delle chiavi Supabase: `sb_secret_…` non e' pubblicabile. */
const CHIAVE_SEGRETA_NUOVA = /\bsb_secret_[A-Za-z0-9_-]{4,}/;
/** `NEXT_PUBLIC_` E' la dichiarazione di Next che quel valore finisce nel browser. */
const AMBIENTE_PUBBLICABILE = /^NEXT_PUBLIC_/;
/** Un indirizzo non e' una credenziale, e i progetti lo tengono fuori dai NEXT_PUBLIC. */
const AMBIENTE_NON_CREDENZIALE = /(^|_)(URL|URI|HOST|PORT|SCHEMA|REGION|PROJECT|REF)$/;
const COSTRUISCE_CLIENT = /\b(createServerClient|createBrowserClient|createClient)\s*\(/;
const AMBIENTE = /process\.env\.([A-Za-z_$][\w$]*)|process\.env\[\s*["'`]([^"'`]+)["'`]\s*\]/g;

/**
 * Il payload di un JWT dichiara `service_role`? Si guarda il VALORE, non il
 * nome: una chiave incollata in una costante che si chiama `k` e' la stessa
 * chiave. Un token illeggibile non e' un rilievo — e' un'altra cosa.
 */
export function jwtDiServiceRole(token) {
  const parti = String(token ?? "").split(".");
  if (parti.length !== 3) return false;
  try {
    const payload = Buffer.from(parti[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return SERVICE_ROLE.test(String(JSON.parse(payload)?.role ?? ""));
  } catch {
    return false;
  }
}

/** Gli identificatori d'ambiente letti in un file, senza doppioni. */
export function ambientiLetti(codice) {
  return [...new Set([...String(codice).matchAll(AMBIENTE)].map((m) => m[1] ?? m[2]))];
}

/**
 * Le variabili d'ambiente che, dentro un modulo che costruisce un client
 * Supabase, portano una credenziale di provenienza non dichiarata.
 */
export function ambientiDiProvenienzaIgnota(codice) {
  return ambientiLetti(codice).filter(
    (nome) => !AMBIENTE_PUBBLICABILE.test(nome) && !AMBIENTE_NON_CREDENZIALE.test(nome),
  );
}

function findingsChiaveNelCodice(percorso, codice) {
  const findings = [];
  for (const token of codice.match(JWT_LETTERALE) ?? []) {
    if (!jwtDiServiceRole(token)) continue;
    findings.push(trova("block", percorso,
      "una chiave Supabase INCOLLATA nel codice, e il suo payload dichiara `role: service_role`: scavalca ogni policy RLS, e qualunque nome le sia stato dato non cambia cosa e'",
      "togli la chiave dal repository, ruotala (e' compromessa: e' stata committata) e passa dal client con la sessione dell'utente"));
  }
  if (CHIAVE_SEGRETA_NUOVA.test(codice)) {
    findings.push(trova("block", percorso,
      "una chiave `sb_secret_…` nel codice: nel formato nuovo di Supabase e' quella che scavalca le policy, e non e' pubblicabile per costruzione",
      "togli la chiave dal repository, ruotala e usa la `sb_publishable_…`"));
  }
  return findings;
}

export function regolaServiceRole(files, config = {}) {
  const dichiarati = new Set((config.moduliClientSupabase ?? []).map(conBarre));
  const findings = [];
  for (const file of files) {
    const codice = senzaCommenti(file.testo);
    const percorso = conBarre(file.percorso);

    if (SERVICE_ROLE.test(codice)) {
      findings.push(trova("block", percorso,
        "chiave `service_role` raggiungibile dal codice dell'applicazione: scavalca ogni policy RLS, e in un percorso client la pubblica",
        "togli la chiave e passa dal client con la sessione dell'utente. Se un'operazione richiede piu' permessi di quelli che l'utente ha, la risposta e' una policy o una funzione `security definer` scritta da schema-forge"));
    }
    findings.push(...findingsChiaveNelCodice(percorso, codice));

    // La provenienza si guarda solo dove nasce un client: altrove un
    // `process.env.STRIPE_SECRET` e' affar suo, e accusarlo sarebbe rumore.
    if (!dichiarati.has(percorso) && !COSTRUISCE_CLIENT.test(codice)) continue;
    for (const nome of ambientiDiProvenienzaIgnota(codice)) {
      findings.push(trova("block", percorso,
        `\`process.env.${nome}\` entra in un modulo che costruisce il client Supabase, e non e' un valore pubblicabile: il gate non sa che chiave sia. Una chiave che non e' l'anonima scavalca le policy, e il nome che le e' stato dato non lo dice`,
        "usa la chiave anonima (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, o la `NEXT_PUBLIC_…PUBLISHABLE_KEY` nel formato nuovo). Se serve piu' potere, la risposta e' una policy o una `security definer` di schema-forge, mai un'altra chiave"));
    }
  }
  return { findings };
}

// ─── regola 4 — i client nascono in un posto solo ────────────────────────────
export function regolaFabbricaClient(files, config) {
  const ammessi = (config.moduliClientSupabase ?? []).map(conBarre);
  const findings = [];

  for (const file of files) {
    const percorso = conBarre(file.percorso);
    if (ammessi.includes(percorso)) continue;
    const codice = senzaCommenti(file.testo);
    if (!/\b(createServerClient|createBrowserClient|createClient)\s*\(/.test(codice)) continue;

    findings.push(
      trova(
        "issue",
        percorso,
        "client Supabase costruito fuori dai moduli dichiarati: e' il punto in cui una chiave sbagliata entra senza che nessuno la veda",
        `costruiscilo in uno di: ${ammessi.join(", ") || "(nessun modulo dichiarato in gestionale.config.json)"}`,
      ),
    );
  }

  return { findings };
}

// ─── regola 5 — il middleware non e' un controllo d'accesso ──────────────────
// Non e' un'opinione: un middleware si puo' aggirare (CVE-2025-29927 e' il caso
// famoso, ma vale la forma, non quel bug), e non sa niente dei ruoli.
export function regolaMiddleware(files) {
  const findings = [];
  const middleware = files.filter((f) => /(^|\/)middleware\.(tsx?|jsx?)$/.test(conBarre(f.percorso)));

  for (const file of middleware) {
    const codice = senzaCommenti(file.testo);
    const reindirizza = /NextResponse\.redirect|\bredirect\s*\(/.test(codice);
    const guarda = /getUser|getSession|auth\./.test(codice);
    if (!(reindirizza && guarda)) continue;

    findings.push(
      trova(
        "issue",
        conBarre(file.percorso),
        "il middleware decide chi entra: si aggira e non conosce i ruoli, quindi non e' il controllo d'accesso — al massimo un rinvio cortese",
        "lascia al middleware il solo rinfresco della sessione e metti la guardia nel layout server della sezione admin",
      ),
    );
  }

  return { findings };
}

// ─── lettura delle scritture nel codice ──────────────────────────────────────
// `.from("orders").update({ status })` → quali colonne tocca il modulo.
// E' un'EURISTICA di testo, non un parser TypeScript: sta scritto anche nel
// messaggio del finding. Regge la forma che questa skill genera; una catena
// costruita a pezzi in tre variabili le sfugge.
const SCRITTURE = /\.(insert|update|upsert)\s*\(/g;

export function scrittureNelCodice(testo) {
  const codice = senzaCommenti(testo);
  const trovate = [];

  SCRITTURE.lastIndex = 0;
  let m;
  while ((m = SCRITTURE.exec(codice)) !== null) {
    const tabella = tabellaPrimaDi(codice, m.index);
    if (!tabella) continue;
    const graffa = codice.indexOf("{", m.index);
    if (graffa === -1) continue;
    trovate.push({
      tabella,
      operazione: m[1] === "update" ? "update" : "insert",
      colonne: chiaviOggetto(dentroGraffe(codice, graffa)),
    });
  }

  return trovate;
}

/** L'ultima `.from("x")` che precede la scrittura: nella forma generata la
 *  catena e' una sola espressione, quindi la piu' vicina e' la sua. */
export function tabellaPrimaDi(codice, indice) {
  const prima = codice.slice(0, indice);
  const trovate = [...prima.matchAll(/\.from\s*\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*\)/g)];
  return trovate.length === 0 ? null : trovate[trovate.length - 1][1];
}

/** Le chiavi di primo livello di un oggetto letterale. */
export function chiaviOggetto(testo) {
  const chiavi = [];
  let livello = 0;
  const re = /[{}]|(^|[,{\s])["']?([A-Za-z_$][\w$]*)["']?\s*:/g;
  let m;
  while ((m = re.exec(testo)) !== null) {
    if (m[0] === "{") livello += 1;
    else if (m[0] === "}") livello -= 1;
    else if (livello === 1 && m[2]) chiavi.push(m[2]);
  }
  return [...new Set(chiavi)];
}

// ─── regola 6 e 7 — i moduli scrivono cio' che il database concede ───────────
// La RLS filtra le righe, non le colonne: il permesso per colonna e' un secondo
// sistema, e un modulo che non lo rispetta o fallisce (`permission denied for
// table`) o — se il permesso c'e' e la colonna decide dei ruoli — promuove.
const COLONNA_DI_PRIVILEGIO =
  /^(ruolo|ruoli|role|roles|is_admin|e_admin|admin|is_staff|is_superuser|permessi|permissions|privilegi|privileges|livello_accesso|access_level|job_title|mansione|qualifica|tipo_utente|user_type)$/i;

export const eColonnaDiPrivilegio = (nome) => COLONNA_DI_PRIVILEGIO.test(String(nome ?? ""));

/** Il catalogo dice, per tabella: il ruolo ha il permesso sull'intera tabella,
 *  e quali colonne ha per grant di colonna. `null` = catalogo non letto. */
export function puoScrivere(catalogo, tabella, colonna, operazione) {
  const t = catalogo?.tabelle?.[tabella];
  if (!t) return null;
  const intera = operazione === "update" ? t.updateTabella : t.insertTabella;
  if (intera) return true;
  const colonne = (operazione === "update" ? t.updateColonne : t.insertColonne) ?? [];
  return colonne.includes(colonna);
}

export function regolaScritture(files, catalogo) {
  const findings = [];
  let scritture = 0;

  for (const file of files) {
    for (const s of scrittureNelCodice(file.testo)) {
      scritture += 1;
      for (const colonna of s.colonne) {
        const permesso = puoScrivere(catalogo, s.tabella, colonna, s.operazione);
        const oggetto = `${conBarre(file.percorso)} → ${s.tabella}.${colonna}`;

        if (permesso === false) {
          findings.push(
            trova(
              "block",
              oggetto,
              `il modulo scrive una colonna che \`authenticated\` non puo' scrivere in \`${s.operazione}\`: Postgres rifiuta l'INTERA istruzione con *permission denied for table*, quindi non fallisce solo quel campo`,
              "togli la colonna dal modulo e passa da una funzione del database, oppure chiedi a schema-forge il `grant` per colonna — la seconda strada solo se quella colonna la deve davvero scrivere l'utente",
            ),
          );
          continue;
        }

        if (!eColonnaDiPrivilegio(colonna)) continue;

        findings.push(
          permesso === true
            ? trova(
                "block",
                oggetto,
                "il modulo scrive una colonna che decide i permessi, e il database gliela concede: e' auto-promozione, non un difetto di interfaccia (euristica sul NOME della colonna, dichiarata)",
                "il cambio di ruolo passa da una funzione `security definer` che verifica chi la chiama; sulla tabella serve `revoke update ... ; grant update (<le altre colonne>)`",
              )
            : trova(
                "issue",
                oggetto,
                "il modulo scrive una colonna dal nome di privilegio e il catalogo non e' stato letto: se il permesso c'e', e' auto-promozione (euristica sul NOME della colonna, dichiarata)",
                "rilancia l'audit con il database raggiungibile, cosi' la regola smette di essere un sospetto",
              ),
        );
      }
    }
  }

  return { findings, scritture };
}

// ─── lettura dei permessi dal catalogo ───────────────────────────────────────
// Un `aclitem` ha la forma `ruolo=privilegi/concedente`, e il ruolo vuoto
// (`=r/postgres`) e' PUBLIC. Le lettere che contano qui sono `a` (insert),
// `r` (select), `w` (update), `d` (delete).
//
// Misurato su Postgres 18 il 2026-07-28, ed e' il motivo per cui questa regola
// legge `pg_class.relacl` e `pg_attribute.attacl` e non
// `information_schema.column_privileges`: quella vista ESPANDE il permesso di
// tabella su ogni colonna, quindi mostra `authenticated|ruolo|UPDATE` sia
// quando il permesso e' per colonna sia quando e' sull'intera tabella. Le due
// cose sono l'opposto l'una dell'altra, e la vista non le distingue.
export function privilegiDaAcl(aclTesto, ruolo) {
  const lettere = new Set();
  const voci = String(aclTesto ?? "")
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  for (const voce of voci) {
    const taglio = voce.indexOf("=");
    if (taglio === -1) continue;
    const chi = voce.slice(0, taglio).replace(/^"|"$/g, "");
    if (chi !== ruolo) continue;
    for (const c of voce.slice(taglio + 1).split("/")[0]) {
      if (c !== "*") lettere.add(c);
    }
  }

  return lettere;
}

/** Il catalogo nella forma che le regole si aspettano. `righeTabelle` e
 *  `righeColonne` arrivano gia' divise dal guscio: qui non si legge niente. */
export function catalogoDaRighe(righeTabelle, righeColonne, ruolo = "authenticated") {
  const tabelle = {};

  for (const [nome, acl] of righeTabelle) {
    const p = privilegiDaAcl(acl, ruolo);
    tabelle[nome] = {
      updateTabella: p.has("w"),
      insertTabella: p.has("a"),
      updateColonne: [],
      insertColonne: [],
    };
  }

  for (const [nome, colonna, acl] of righeColonne) {
    if (!tabelle[nome]) continue;
    const p = privilegiDaAcl(acl, ruolo);
    if (p.has("w")) tabelle[nome].updateColonne.push(colonna);
    if (p.has("a")) tabelle[nome].insertColonne.push(colonna);
  }

  return { ruolo, tabelle };
}

// ─── l'audit intero ──────────────────────────────────────────────────────────
// L'ordine delle chiamate qui sotto E' l'audit. Ogni regola resta una funzione
// sola, testabile da sola.
export function auditAdmin({ files, config, catalogo = null }) {
  const guardie = regolaGuardieRotte(files, config);
  const azioni = regolaAzioniServer(files, config);
  const scritture = regolaScritture(files, catalogo);

  const findings = [
    ...guardie.findings,
    ...azioni.findings,
    ...regolaServiceRole(files, config).findings,
    ...regolaFabbricaClient(files, config).findings,
    ...regolaMiddleware(files).findings,
    ...scritture.findings,
  ];

  const per = (s) => findings.filter((f) => f.severity === s).length;

  return {
    findings,
    summary: { block: per("block"), issue: per("issue"), warn: per("warn") },
    // Le MISURE della premessa: un audit che non ha letto niente non deve
    // poter passare per un audit pulito. Chi legge decide, ma sui numeri.
    misure: {
      file: files.length,
      rotte: guardie.rotte,
      // `azioni` = azioni RICONOSCIUTE; `fileAzioni` = file `"use server"`.
      // Quando i due numeri non coincidono, `azioniNonLette` dice per quali file
      // — ed e' la premessa che rende il passo MANCANTE invece che verde.
      azioni: azioni.azioni,
      fileAzioni: azioni.fileAzioni,
      azioniNonLette: azioni.nonLette,
      scritture: scritture.scritture,
      catalogo: catalogo === null ? "assente" : "letto",
    },
  };
}
