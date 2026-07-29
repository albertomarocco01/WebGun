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

/** Una chiamata, non una menzione: il nome seguito da parentesi aperta. */
export function chiamaUnaDi(testo, nomi) {
  const codice = senzaCommenti(testo);
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

  for (const file of azioni) {
    const percorso = conBarre(file.percorso);
    if (esenti.includes(percorso)) continue;

    for (const nome of funzioniEsportate(file.testo)) {
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

  return { findings, azioni: azioni.length };
}

/** I nomi delle funzioni esportate: `export async function nome(`. */
export function funzioniEsportate(testo) {
  const codice = senzaCommenti(testo);
  const nomi = [];
  const re = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(codice)) !== null) nomi.push(m[1]);
  return nomi;
}

/** Il corpo di una funzione, dalla graffa aperta alla sua chiusa. Serve perche'
 *  una guardia chiamata in un'ALTRA funzione dello stesso file non protegge
 *  questa: il file intero come unita' di misura assolverebbe troppo. */
export function corpoFunzione(testo, nome) {
  const codice = senzaCommenti(testo);
  const inizio = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${perRegExp(nome)}\\b`,
  ).exec(codice);
  if (!inizio) return "";
  const apertura = codice.indexOf("{", inizio.index);
  if (apertura === -1) return "";
  return dentroGraffe(codice, apertura);
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
const SERVICE_ROLE = /service[_-]?role/i;

export function regolaServiceRole(files) {
  const findings = [];
  for (const file of files) {
    const codice = senzaCommenti(file.testo);
    if (!SERVICE_ROLE.test(codice)) continue;
    findings.push(
      trova(
        "block",
        conBarre(file.percorso),
        "chiave `service_role` raggiungibile dal codice dell'applicazione: scavalca ogni policy RLS, e in un percorso client la pubblica",
        "togli la chiave e passa dal client con la sessione dell'utente. Se un'operazione richiede piu' permessi di quelli che l'utente ha, la risposta e' una policy o una funzione `security definer` scritta da schema-forge",
      ),
    );
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
    ...regolaServiceRole(files).findings,
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
      azioni: azioni.azioni,
      scritture: scritture.scritture,
      catalogo: catalogo === null ? "assente" : "letto",
    },
  };
}
