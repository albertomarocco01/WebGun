/**
 * audit-lib.mjs — Le REGOLE dell'audit RLS, senza una riga di I/O.
 *
 * COSA FA: prende le righe gia' lette dal catalogo di Postgres (array di array
 * di stringhe, esattamente come le restituisce `query()` di rls-audit.mjs) e
 * ritorna i findings `{severity, object, message, hint}`.
 *
 * PERCHE': mescolare psql e giudizio rende il giudizio non testabile. I due bug
 * del collaudo (CRLF di psql, cast booleano) hanno tenuto spente due regole su
 * sei senza che nulla lo segnalasse, perche' non c'era modo di eseguire le
 * regole senza un database. Stesso schema di scan-lib.mjs / scan.mjs in
 * code-maniac: il guscio fa I/O, la libreria giudica.
 *
 * Le funzioni qui dentro sono PURE: stesso input, stesso output, nessun effetto.
 */

// psql su Windows chiude le righe con CRLF. Se il \r sopravvive al parsing
// finisce in coda all'ultimo campo di ogni riga e falsa ogni confronto:
// "owner_id\r" !== "owner_id". La normalizzazione sta qui, non solo nel
// parsing, cosi' la regola resta corretta anche con un guscio diverso.
const pulisci = (v) => (v ?? "").replace(/\r/g, "");

// psql rende i boolean come 'true'/'false' quando la query ha il cast ::text,
// come 't'/'f' senza cast: un controllo di sicurezza li accetta entrambi.
// Trattare 'true' come falso significava segnalare OGNI tabella come priva di
// RLS (rumore) e rendere codice morto la regola 1b.
const vero = (v) => {
  const s = pulisci(v);
  return s === "true" || s === "t";
};

const riga = (r) => r.map(pulisci);

// Un identificatore Postgres CITATO puo' contenere qualunque cosa: `create
// table t ("piano(a" text)` e' SQL valido. Interpolato grezzo in una RegExp
// quel nome fa due danni, e sono di specie diversa:
//   - `piano(a`  → `new RegExp("\\bpiano(a\\b")` SOLLEVA, e siccome nessuno qui
//     cattura, l'audit RLS muore con uno stack trace: la verifica «che non puo'
//     mancare» diventa un passo rosso per un motivo che non parla dello schema;
//   - `a+b`      → `\ba+b\b` MATCHA `aaab`, cioe' una colonna che non esiste.
//     Nessun errore, un verdetto sbagliato in silenzio — il caso peggiore per
//     un auditor.
// Sta in cima perche' vale per ogni nome che arriva dal catalogo, non solo per
// l'ultima regola che ne aveva bisogno (trovato da semgrep il 2026-08-06,
// `detect-non-literal-regexp`).
const perRegex = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── parsing dell'uscita di psql ─────────────────────────────────────────────
// Si divide sul SEPARATORE DI RECORD (`psql -R`), non sui newline. Motivo: una
// policy con una sottoquery viene deparsata da `pg_policies.qual` su piu' righe.
// Dividendo per riga il record si spezza, i campi diventano `undefined` e
// l'audit CRASHA — cioe' la verifica che «non puo' mancare» risulta MANCANTE
// proprio sugli schemi veri, che sono quelli con le policy complesse.
// Trovato sul campo il 2026-07-26 su un progetto vero, non sul banco di prova.
export function righeDaPsql(stdout, sep = "\x1f", rs = "\x1e") {
  return (stdout ?? "")
    .split(rs)
    .map((r) => r.replace(/\r?\n$/, ""))
    .filter((r) => r.length > 0)
    .map((r) => r.split(sep));
}

// ─── l'arita': un record non e' cio' che il separatore dice che sia ──────────
// I due separatori sono byte di controllo, scelti perche' «non compaiono mai
// nei nomi degli oggetti». E' vero per i NOMI, ed e' falso per il TESTO LIBERO:
// l'espressione di una policy (`qual`, `with_check`), il corpo di una funzione
// `security definer` (`prosrc`), la definizione di un vincolo. Li' dentro ci sta
// qualunque byte, separatori compresi.
//
// MISURATO il 2026-08-06 (referto § H5 e § M17, l'unica conferma incrociata del
// referto — due concili l'hanno trovato per due strade opposte):
//
//   record di `pg_policies` sano, 7 campi
//     → 2 findings, fra cui il `block` «with check (true)»
//   lo stesso record con un `\x1f` dentro `qual`, 8 campi
//     → 1 finding, e ZERO block: `with_check` finisce in nona posizione,
//       nessuno la legge piu', e la policy che lascia scrivere per conto di
//       altri diventa invisibile
//   un `\x1f` dentro `prosrc`  → 6 campi invece di 5, corpo troncato
//   un `\x1e` dentro `prosrc`  → un record spezzato in due
//
// Nessun controllo di arita' da nessuna parte: `riga()` accettava 8 campi come
// ne accetterebbe 3, e i campi mancanti diventavano `undefined` — cioe' un
// verdetto costruito su un record che non e' quello che il database ha mandato.
//
// La correzione qui e' il controllo, non la neutralizzazione: un record che non
// ha i campi che la query dichiara NON e' un record, e l'audit non lo
// interpreta. Il guasto diventa rumoroso (uscita 2 = audit MANCANTE) invece che
// silenzioso (un `block` in meno). La neutralizzazione dei separatori nella SQL
// vorrebbe un Postgres vivo per essere provata, e questo pacchetto non ne ha
// uno: e' scritta come proposta nello STATO, non applicata alla cieca.
export function recordDiAritaSbagliata(record, arita) {
  return (record ?? [])
    .map((campi, indice) => ({ indice, quanti: campi.length }))
    .filter((r) => r.quanti !== arita);
}

/** Il messaggio che accompagna il rifiuto: dice quale query, quale record e cosa. */
export function motivoAritaSbagliata(nomeQuery, arita, rotti) {
  const primi = rotti.slice(0, 3)
    .map((r) => `record ${r.indice + 1}: ${r.quanti} campi invece di ${arita}`)
    .join("; ");
  const coda = rotti.length > 3 ? `, e altri ${rotti.length - 3}` : "";
  return `la query \`${nomeQuery}\` ha restituito ${rotti.length} record con un numero di campi diverso da quello dichiarato (${primi}${coda}). ` +
    "Quasi certamente un separatore di campo (\\x1f) o di record (\\x1e) dentro un testo libero del catalogo — l'espressione di una policy, il corpo di una funzione, la definizione di un vincolo. " +
    "L'audit NON interpreta un record spostato: un campo che slitta fa sparire un `block` senza dirlo. Verifica MANCANTE, non un audit pulito.";
}

const trova = (severity, object, message, hint) => ({ severity, object, message, hint });

// ─── regola 1, 1b e 1c — RLS attiva? con policy? forzata? ────────────────────
// Righe: [schema, tabella, rls, numeroPolicy, force]
export function regolaTabelle(tabelle) {
  const findings = [];
  for (const r of tabelle) {
    const [schema, tabella, rls, numeroPolicy, force = ""] = riga(r);
    const obj = `${schema}.${tabella}`;
    if (!vero(rls)) {
      // la tabella e' gia' un block: aggiungere il warn su `force` e' rumore
      findings.push(trova("block", obj, "RLS non attiva su una tabella esposta",
        `alter table ${obj} enable row level security;`));
      continue;
    }
    if (numeroPolicy === "0") {
      findings.push(trova("issue", obj, "RLS attiva ma nessuna policy: nessun ruolo puo' leggere o scrivere",
        "aggiungi almeno una policy, oppure sposta la tabella in uno schema non esposto"));
    }
    // `enable` non vale per il PROPRIETARIO della tabella: una funzione o un
    // job che gira come owner legge e scrive tutto scavalcando le policy.
    // `force` chiude anche quella porta (references/rls-supabase.md).
    // Campo vuoto = la riga non porta l'informazione: non si inventa un verdetto.
    if (force !== "" && !vero(force)) {
      findings.push(trova("warn", obj,
        "`force row level security` non attiva: le policy non valgono per il proprietario della tabella",
        `alter table ${obj} force row level security;`));
    }
  }
  return findings;
}

// ─── regola 2a — quanto e' permissiva la SCRITTURA ───────────────────────────
// Sta in una funzione a parte perche' e' un solo albero di decisione su
// `with check`: presente, OMESSO (e allora su `update`/`all` Postgres eredita
// `using`), o inesistente per costruzione (`insert`). Tenerlo dentro
// `regolaPolicy` porterebbe quella funzione oltre la soglia di complessita' dei
// guardiani, e il ramo `else if` si perderebbe in mezzo agli altri controlli.
// `coalesce(with_check,'')` nella query: stringa vuota = clausola OMESSA.
function regolaPermissivita({ schema, tabella, nome, cmd, qual, withCheck }) {
  const findings = [];
  const obj = `${schema}.${tabella} → "${nome}"`;
  // CREATE POLICY: «If no WITH CHECK expression is defined, then the USING
  // expression will be used both to determine which rows are visible and which
  // new rows will be allowed to be added».
  const ereditaIlControllo = ["UPDATE", "ALL"].includes(cmd) && withCheck.trim() === "";

  if (qual.trim() === "true" && ereditaIlControllo) {
    // La composizione, non il singolo pezzo: `using (true)` + nessun
    // `with check` su una scrittura = controllo effettivo `true`. Verificato
    // su Postgres reale il 2026-07-27: con `for update using (true)` e nessun
    // `with check`, un utente autenticato riesce a intestare a se' la riga di
    // un altro (`UPDATE 1`). Con `using ((select auth.uid()) = user_id)` lo
    // stesso tentativo viene rifiutato: e' la composizione che apre il buco.
    findings.push(trova("block", obj,
      "policy di scrittura con `using (true)` e nessun `with check`: Postgres usa `using` anche come controllo sulla riga nuova, quindi il controllo effettivo e' `true` e chiunque puo' scrivere per conto di altri",
      `alter policy "${nome}" on ${schema}.${tabella} using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);`));
  } else if (qual.trim() === "true") {
    findings.push(trova("issue", obj, "policy con `using (true)`: RLS attiva ma senza filtro",
      "legittima solo su dati realmente pubblici, e va documentata nell'handoff"));
  }
  // NON si segnala `for update using (<predicato vero>)` senza `with check`:
  // il controllo ereditato E' quel predicato, e sulla forma raccomandata
  // dalle reference Postgres rifiuta davvero il dirottamento della riga.
  // Un warn qui scatterebbe sul codice CORRETTO: rumore, non implicitezza.
  if (["INSERT", "UPDATE", "ALL"].includes(cmd) && withCheck.trim() === "true") {
    findings.push(trova("block", obj, "policy di scrittura con `with check (true)`: chiunque puo' scrivere per conto di altri",
      "vincola la scrittura all'utente: with check ((select auth.uid()) = user_id)"));
  }
  // Su `insert` non esiste `using` da cui ereditare (Postgres rifiuta
  // `for insert using (...)`: «only WITH CHECK expression allowed for
  // INSERT»). Una policy di `insert` senza `with check` non e' pero' un buco:
  // e' l'opposto — Postgres NEGA ogni inserimento («new row violates row-level
  // security policy»). Verificato su Postgres reale il 2026-07-27. Quindi
  // `issue` e non `block`: l'applicazione non scrive e sembra un bug del
  // frontend, esattamente come "RLS attiva senza policy".
  if (cmd === "INSERT" && withCheck.trim() === "") {
    findings.push(trova("issue", obj,
      "policy di `insert` senza `with check`: nessun inserimento passera' mai (su `insert` non c'e' `using` da cui ereditare il controllo)",
      `alter policy "${nome}" on ${schema}.${tabella} with check ((select auth.uid()) = user_id);`));
  }
  return findings;
}

// ─── regola 2 — permissivita' e costo delle policy ───────────────────────────
export function regolaPolicy(policy) {
  const findings = [];
  for (const r of policy) {
    const [schema, tabella, nome, cmd, ruoli, qual, withCheck] = riga(r);
    const obj = `${schema}.${tabella} → "${nome}"`;
    const espressione = `${qual} ${withCheck}`;

    findings.push(...regolaPermissivita({ schema, tabella, nome, cmd, qual, withCheck }));

    // `raw_user_meta_data` e' scrivibile DALL'UTENTE su Supabase e finisce in
    // `auth.jwt()`: una policy che ne ricava l'autorizzazione e' auto-promozione
    // ad admin. `app_metadata` no, quella la scrive solo il server.
    if (/user_metadata|raw_user_meta_data/.test(espressione)) {
      findings.push(trova("block", obj,
        "policy che autorizza in base a `user_metadata`: e' scrivibile dall'utente stesso, quindi e' auto-promozione ad admin",
        `alter policy "${nome}" on ${schema}.${tabella} using (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin'); — sposta il claim in raw_app_meta_data, che l'utente non puo' scrivere`));
    }
    // Deprecata da Supabase in favore della clausola `to`, ma il motivo grave e'
    // un altro: con gli accessi anonimi attivi un utente anonimo porta il ruolo
    // Postgres `authenticated` e passa `auth.role() = 'authenticated'` senza
    // essere davvero autenticato. Il controllo c'e' e non controlla niente.
    if (/\bauth\.role\s*\(\s*\)/.test(espressione)) {
      findings.push(trova("block", obj,
        "`auth.role()` nella policy: deprecata, e con gli accessi anonimi attivi un utente anonimo porta il ruolo `authenticated` e la passa senza essere autenticato",
        `alter policy "${nome}" on ${schema}.${tabella} to authenticated using ((select auth.uid()) = user_id); — il ruolo si dichiara con \`to\`, la proprieta' della riga in \`using\``));
    }
    if (/auth\.uid\(\)/.test(espressione) && !/select\s+auth\.uid\(\)/i.test(espressione)) {
      findings.push(trova("warn", obj, "`auth.uid()` non avvolto in `(select ...)`: valutata per ogni riga",
        "usa (select auth.uid()) — il planner la calcola una volta per statement"));
    }
    if (/\bjoin\b/i.test(espressione)) {
      findings.push(trova("warn", obj, "join dentro la policy: costo per riga e rischio di ricorsione",
        "incapsula la verifica in una funzione stable security definer"));
    }
    if (ruoli === "{public}" || ruoli === "public") {
      findings.push(trova("warn", obj, "policy senza ruolo esplicito: valutata anche per ruoli che non la usano",
        "aggiungi `to authenticated` oppure `to anon`"));
    }
  }
  return findings;
}

// ─── regola 2f — scrittura senza lettura per gli stessi ruoli ────────────────
// In Postgres un `update` (e un `delete`) deve prima SELEZIONARE la riga. Senza
// una policy di `select` per gli stessi ruoli l'operazione tocca 0 righe e NON
// da' errore: sembra un bug del frontend e costa giorni. Non e' un buco di
// sicurezza — e' un guasto silenzioso, quindi `issue`.
// I ruoli arrivano da `array_to_string(roles, ',')`; `public` vale "tutti i
// ruoli" e percio' si sovrappone a qualunque insieme.
const insiemeRuoli = (s) =>
  new Set(s.replace(/^\{|\}$/g, "").split(",").map((x) => x.trim()).filter(Boolean));

const siSovrappongono = (a, b) =>
  a.has("public") || b.has("public") || [...a].some((r) => b.has(r));

export function regolaLetturaPerScrittura(policy) {
  const perTabella = new Map();
  for (const r of policy) {
    const [schema, tabella, , cmd, ruoli] = riga(r);
    const chiave = `${schema}.${tabella}`;
    if (!perTabella.has(chiave)) perTabella.set(chiave, []);
    perTabella.get(chiave).push({ cmd, ruoli: insiemeRuoli(ruoli) });
  }

  const findings = [];
  for (const r of policy) {
    const [schema, tabella, nome, cmd, ruoli] = riga(r);
    if (!["UPDATE", "DELETE"].includes(cmd)) continue;
    const chiave = `${schema}.${tabella}`;
    const miei = insiemeRuoli(ruoli);
    const legge = (perTabella.get(chiave) ?? []).some(
      (p) => ["SELECT", "ALL"].includes(p.cmd) && siSovrappongono(miei, p.ruoli)
    );
    if (legge) continue;
    findings.push(trova("issue", `${chiave} → "${nome}"`,
      `policy di ${cmd.toLowerCase()} senza una policy di \`select\` per gli stessi ruoli: l'operazione non trova la riga e torna 0 righe SENZA errore`,
      `create policy "${nome} (lettura)" on ${chiave} for select to ${[...miei].join(", ")} using (<la stessa condizione della scrittura>);`));
  }
  return findings;
}

// ─── regola 3 — viste che scavalcano la RLS delle tabelle sotto ──────────────
export function regolaViste(viste) {
  const findings = [];
  for (const r of viste) {
    const [schema, vista, tipo, opzioni] = riga(r);
    const obj = `${schema}.${vista}`;
    if (tipo === "m") {
      // `block` e non `issue` dal 2026-07-27: una vista materializzata non
      // puo' avere `security_invoker` per COSTRUZIONE — Postgres risponde
      // «unrecognized parameter "security_invoker"» (provato sul banco). E'
      // quindi strettamente peggiore di una vista nuda, che e' gia' `block`:
      // una MV che unisce ogni cartella clinica a ogni nota interna passava.
      findings.push(trova("block", obj,
        "vista materializzata in uno schema esposto: non supporta `security_invoker` (Postgres lo rifiuta), quindi si legge coi diritti del proprietario e scavalca la RLS di ogni tabella sottostante",
        `drop materialized view ${obj}; — spostala in uno schema non esposto, oppure sostituiscila con una vista normale \`security_invoker = on\``));
    } else if (!/security_invoker\s*=\s*(on|true)/i.test(opzioni)) {
      findings.push(trova("block", obj, "vista senza `security_invoker`: gira coi diritti del proprietario e scavalca la RLS",
        `alter view ${obj} set (security_invoker = on);`));
    }
  }
  return findings;
}

// ─── regola 4 e 4b — security definer: search_path fisso? e chi la esegue? ───
// Righe: [schema, funzione, config, acl]
// Postgres concede `EXECUTE` a PUBLIC per DEFAULT su ogni funzione nuova: una
// `security definer` in uno schema esposto e' quindi un endpoint pubblico
// raggiungibile da `anon`, oltre che una funzione che scavalca la RLS.
// Rese di `proacl::text` verificate su Postgres reale il 2026-07-27:
//   privilegi di default            → NULL, quindi '' dopo il coalesce
//   revoke execute ... from public  → {postgres=X/postgres}
//   grant execute ... to public     → {postgres=X/postgres,=X/postgres}
// Il grantee vuoto prima di `=` E' PUBLIC: e' quello che si cerca.
const eseguibileDaTutti = (acl) => acl === "" || /(?:^|[{,])=[^,}]*X/.test(acl);

export function regolaFunzioni(funzioni) {
  const findings = [];
  for (const r of funzioni) {
    const [schema, funzione, config, acl] = riga(r);
    const obj = `${schema}.${funzione}()`;
    if (!/search_path/.test(config)) {
      findings.push(trova("block", obj,
        "funzione `security definer` senza `search_path` fisso: escalation di privilegi",
        "aggiungi: set search_path = ''"));
    }
    // La riga porta l'ACL solo se la query la seleziona: senza il campo non si
    // inventa un verdetto (stesso criterio di `force` nella regola 1). Qui la
    // stringa VUOTA e' invece un'informazione — sono i privilegi di default.
    if (r.length < 4) continue;
    if (eseguibileDaTutti(acl)) {
      findings.push(trova("issue", obj,
        "funzione `security definer` eseguibile da PUBLIC (quindi da `anon`): e' un endpoint pubblico che scavalca la RLS",
        `revoke execute on function ${schema}.${funzione} from public; grant execute on function ${schema}.${funzione} to authenticated; ` +
        `— meglio ancora in uno schema non esposto, e con un controllo su (select auth.uid()) dentro il corpo`));
    }
  }
  return findings;
}

// ─── regola 5 — chiavi esterne senza indice ──────────────────────────────────
// Le righe arrivano gia' filtrate dalla query: qui c'e' solo cio' che manca.
export function regolaChiaviEsterne(chiaviEsterne) {
  const findings = [];
  for (const r of chiaviEsterne) {
    const [, tabella, colonna] = riga(r);
    findings.push(trova("issue", `${tabella}.${colonna}`,
      "chiave esterna senza indice: join e `on delete` fanno scansione completa",
      `create index on ${tabella} (${colonna});`));
  }
  return findings;
}

// ─── regola 6 — colonne usate nelle policy senza indice ──────────────────────
// La policy gira su ogni riga di ogni query: senza indice e' scansione completa.
// Righe delle colonne: [schema, tabella, colonna, tipo]
const booleano = (tipo) => /^bool(ean)?$/i.test(tipo);

export function regolaColonneDiPolicy({ policy, colonne, indicizzate }) {
  const findings = [];
  const indice = new Set(indicizzate.map((r) => pulisci(r[0])));

  const perTabella = new Map();
  for (const r of colonne) {
    const [schema, tabella, nome, tipo] = riga(r);
    const chiave = `${schema}.${tabella}`;
    if (!perTabella.has(chiave)) perTabella.set(chiave, []);
    perTabella.get(chiave).push({ nome, tipo });
  }

  const viste = new Set();
  for (const r of policy) {
    const [schema, tabella, , , , qual, withCheck] = riga(r);
    const chiave = `${schema}.${tabella}`;
    const espressione = `${qual} ${withCheck}`;
    for (const { nome, tipo } of perTabella.get(chiave) ?? []) {
      if (nome === "id") continue; // gia' chiave primaria
      // Un booleano ha due valori: l'indice pieno non seleziona quasi nulla e
      // rallenta ogni scrittura. references/modellazione.md: non si indicizza
      // "per sicurezza" — semmai un indice PARZIALE, che qui non sappiamo
      // proporre senza conoscere la query. Nessun finding: sarebbe rumore.
      if (booleano(tipo)) continue;
      const usata = new RegExp(`\\b${perRegex(nome)}\\b`).test(espressione);
      const dedupe = `${chiave}.${nome}`;
      if (usata && !indice.has(dedupe) && !viste.has(dedupe)) {
        viste.add(dedupe);
        findings.push(trova("warn", dedupe,
          "colonna usata in una policy ma non indicizzata: costo su ogni riga di ogni query",
          `create index on ${chiave} (${nome}); ` +
          `— se la policy tocca solo un sottoinsieme stabile delle righe, l'indice parziale ` +
          `costa meno in scrittura: create index on ${chiave} (${nome}) where <condizione>;`));
      }
    }
  }
  return findings;
}

// ─── regola 7 — la policy promette un accesso che il privilegio non concede ──
// Due sistemi di permessi in fila, e passano ENTRAMBI o non passa niente: la
// policy decide QUALI RIGHE, il `grant` decide SE la tabella e' raggiungibile
// affatto. Una policy di `select` per `anon` su una tabella dove `anon` non ha
// `select` e' una funzione che non esiste: il client riceve
// «permission denied for table», o una lista vuota, e sembra un bug del frontend.
//
// PERCHE' LA REGOLA E' STATA RISCRITTA (2026-08-03). Prima chiedeva al catalogo
// una cosa piu' debole — «questa tabella compare in `role_table_grants` per
// `anon` o `authenticated`?» — senza guardare QUALE privilegio. Misurata sul
// banco veterinario con l'immagine Supabase nuova: le 18 tabelle avevano
// `relacl` = `anon=Dxtm` (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: zero CRUD),
// comparivano tutte e 18 in `role_table_grants` con `privilege_type` =
// TRUNCATE/REFERENCES/TRIGGER, e la regola taceva su uno schema in cui NESSUN
// ruolo del client poteva leggere una riga. La prova che serviva era gia' nel
// catalogo, alla colonna accanto.
//
// GRAVITA' `block`, e non `issue` come prima (../../DECISIONI.md §17: la
// gravita' si decide da dove sta la prova). Qui la prova e' INTERAMENTE nel
// catalogo — `pg_policies.cmd`/`roles` contro `has_any_column_privilege` — senza
// una riga di euristica: non c'e' il caso legittimo da non disturbare. E il
// danno e' totale e muto: la meta' dello schema che la policy descrive non
// esiste, e il gate verde la dichiarava consegnabile.
//
// Un solo finding per (tabella, ruolo): un difetto, una riga.
// Righe di `privilegi`: [schema, tabella, ruolo, privilegio] — presenti SOLO se
// il ruolo il privilegio ce l'ha davvero (a livello di tabella o di colonna).
const RUOLI_DEL_CLIENT = ["anon", "authenticated"];

// L'ordine canonico del report. Senza, l'elenco dei privilegi mancanti seguirebbe
// l'ordine in cui il catalogo ha restituito le policy: due esecuzioni sullo
// stesso database darebbero due messaggi diversi, e un gate che non si confronta
// con se' stesso non si sa nemmeno rilanciare.
const ORDINE_CRUD = ["SELECT", "INSERT", "UPDATE", "DELETE"];

const PRIVILEGI_DELLA_POLICY = {
  SELECT: ["SELECT"],
  INSERT: ["INSERT"],
  UPDATE: ["UPDATE"],
  DELETE: ["DELETE"],
  ALL: ["SELECT", "INSERT", "UPDATE", "DELETE"],
};

// Quali privilegi CRUD ogni ruolo del client HA, per tabella.
const privilegiPosseduti = (privilegi) => {
  const posseduti = new Map(); // "schema.tabella|ruolo" -> Set(privilegi)
  for (const r of privilegi) {
    const [schema, tabella, ruolo, privilegio] = riga(r);
    const chiave = `${schema}.${tabella}|${ruolo}`;
    if (!posseduti.has(chiave)) posseduti.set(chiave, new Set());
    posseduti.get(chiave).add(privilegio.toUpperCase());
  }
  return posseduti;
};

// Quali privilegi le policy PROMETTONO, per tabella e per ruolo del client.
// `public` in una policy vale «tutti i ruoli», quindi promette a entrambi.
const privilegiPromessi = (policy) => {
  const promessi = new Map();
  for (const r of policy ?? []) {
    const [schema, tabella, , cmd, ruoli] = riga(r);
    const richiesti = PRIVILEGI_DELLA_POLICY[cmd.toUpperCase()];
    if (!richiesti) continue;
    const suoi = insiemeRuoli(ruoli);
    const destinatari = RUOLI_DEL_CLIENT.filter(
      (ruolo) => suoi.has(ruolo) || suoi.has("public")
    );
    for (const ruolo of destinatari) {
      const chiave = `${schema}.${tabella}|${ruolo}`;
      if (!promessi.has(chiave)) promessi.set(chiave, new Set());
      for (const p of richiesti) promessi.get(chiave).add(p);
    }
  }
  return promessi;
};

export function regolaGrant({ tabelle, policy, privilegi }) {
  if (!privilegi) return []; // la query non c'e': nessun verdetto inventato
  const posseduti = privilegiPosseduti(privilegi);
  const promessi = privilegiPromessi(policy);
  const findings = [];
  for (const r of tabelle) {
    const [schema, tabella, rls, numeroPolicy] = riga(r);
    const obj = `${schema}.${tabella}`;
    // RLS spenta o zero policy: la regola 1 ha gia' parlato, qui si tace —
    // altrimenti la stessa tabella prende due findings per un difetto solo.
    if (!vero(rls) || numeroPolicy === "0") continue;
    for (const ruolo of RUOLI_DEL_CLIENT) {
      const chiave = `${obj}|${ruolo}`;
      const promessa = promessi.get(chiave);
      if (!promessa || promessa.size === 0) continue;
      const ha = posseduti.get(chiave) ?? new Set();
      const mancanti = ORDINE_CRUD.filter((p) => promessa.has(p) && !ha.has(p));
      if (mancanti.length === 0) continue;
      const elenco = mancanti.map((p) => p.toLowerCase()).join(", ");
      const rimedio =
        `grant ${elenco} on ${obj} to ${ruolo}; ` +
        `— se invece ${ruolo} non deve raggiungerla, la risposta non e' il grant: ` +
        `si toglie la policy, o la tabella si sposta in uno schema non esposto`;
      findings.push(ha.size === 0
        ? trova("block", `${obj} → ${ruolo}`,
          `la tabella ha RLS e policy per \`${ruolo}\`, ma \`${ruolo}\` non ha NESSUN privilegio CRUD su di essa: dalla Data API non legge e non scrive niente, e il guasto sembra un bug del frontend. Su Supabase un privilegio che non hai scritto in una migrazione non e' un privilegio che hai`,
          rimedio)
        : trova("block", `${obj} → ${ruolo}`,
          `le policy promettono a \`${ruolo}\` un accesso che il privilegio non concede: manca \`${elenco}\`. La policy decide quali righe, il \`grant\` decide se la tabella e' raggiungibile: passano entrambi o non passa niente`,
          rimedio));
    }
  }
  return findings;
}

// ─── regola 8 — auto-promozione: la colonna che decide i permessi ────────────
// La RLS di Postgres filtra le RIGHE, non le COLONNE. Una policy di `update`
// che autorizza l'utente sulla propria riga lo autorizza su OGNI colonna di
// quella riga, compresa quella che decide i suoi permessi.
// Provato sul banco veterinario il 2026-07-27, con comandi reali: un
// veterinario di Biella vede 2 visite e 0 note interne; dopo un solo
// `update public.staff set job_title = 'direttore' where auth_user_id = <se stesso>`
// ne vede 6 e 1. La policy era corretta, il grant no.
//
// Le difese vere sono tre, e il catalogo le vede tutte:
//   1. `grant update (col, ...)` per COLONNA — con quello Postgres nega
//      l'update della colonna esclusa («permission denied for table», provato).
//      Un grant per colonna NON compare in `role_table_grants`: e' quello il
//      segnale, e non e' euristico.
//   2. un trigger su `update` che nomina la colonna (la blocca o la ripristina)
//   3. la colonna in una tabella che l'utente non scrive — allora non c'e'
//      nessuna policy di scrittura e la regola non arriva nemmeno qui.
//
// L'EURISTICA, dichiarata: quali colonne sono "di privilegio" si decide dal
// NOME. Per limitarne il danno il verdetto e' doppio — `block` solo quando si
// puo' DIMOSTRARE che quella colonna decide accessi (compare in una policy, o
// nel corpo di una funzione `security definer` che una policy chiama: sul banco
// `job_title` sta li' dentro, non nel testo delle policy), `issue` quando c'e'
// solo il nome. Un `block` sul nome soltanto segnalerebbe un `job_title`
// descrittivo, e un rosso strutturale insegna a ignorare il rosso.
const NOMI_DI_PRIVILEGIO =
  /^(ruolo|ruoli|role|roles|is_admin|e_admin|admin|is_staff|is_superuser|permessi|permissions|privilegi|privileges|livello_accesso|access_level|job_title|mansione|qualifica|tipo_utente|user_type)$/i;

const chiaviDi = (righe, indiceCmd, comandi) =>
  new Set(righe
    .filter((r) => comandi.includes(riga(r)[indiceCmd]))
    .map((r) => `${riga(r)[0]}.${riga(r)[1]}`));

// Il corpo delle funzioni che le policy CHIAMANO davvero: `puo_vedere_clinica(...)`
// nel testo di una policy tira dentro il corpo di `puo_vedere_clinica`.
const corpiChiamatiDallePolicy = (funzioni, espressioni) =>
  (funzioni ?? [])
    .filter((r) => espressioni.includes(`${pulisci(r[1])}(`))
    .map((r) => pulisci(r[4] ?? ""))
    .join(" ");

const triggerCheNomina = (trigger, chiave, colonna, suQuale) =>
  (trigger ?? []).some((r) => {
    const [schema, tabella, , suInsert, suUpdate, corpo] = riga(r);
    if (`${schema}.${tabella}` !== chiave) return false;
    if (!vero(suQuale === "insert" ? suInsert : suUpdate)) return false;
    return new RegExp(`\\b${colonna}\\b`).test(corpo);
  });

export function regolaColonnaDiPrivilegio({ policy, colonne, grantsScrittura, trigger, funzioni }) {
  if (!grantsScrittura) return []; // la query non c'e': nessun verdetto inventato
  const scrivibili = chiaviDi(policy, 3, ["UPDATE", "ALL"]);
  const grantPieno = new Set(grantsScrittura.map((r) => `${pulisci(r[0])}.${pulisci(r[1])}`));
  const espressioni = policy.map((r) => `${riga(r)[5]} ${riga(r)[6]}`).join(" ");
  const decisionale = `${espressioni} ${corpiChiamatiDallePolicy(funzioni, espressioni)}`;

  const findings = [];
  for (const r of colonne) {
    const [schema, tabella, nome] = riga(r);
    const chiave = `${schema}.${tabella}`;
    if (!NOMI_DI_PRIVILEGIO.test(nome)) continue;
    if (!scrivibili.has(chiave) || !grantPieno.has(chiave)) continue;
    if (triggerCheNomina(trigger, chiave, nome, "update")) continue;
    const dimostrata = new RegExp(`\\b${nome}\\b`).test(decisionale);
    const rimedio =
      `revoke update on ${chiave} from anon, authenticated; ` +
      `grant update (<solo le colonne che l'utente puo' davvero cambiare>) on ${chiave} to authenticated; ` +
      `— in alternativa un trigger su update che rifiuta la modifica di ${nome}, o la colonna in una tabella che l'utente non scrive`;
    findings.push(dimostrata
      ? trova("block", `${chiave}.${nome}`,
        `colonna che decide gli accessi, scrivibile dal proprietario della riga: la RLS filtra le righe e non le colonne, quindi la policy di scrittura lascia riscrivere anche \`${nome}\`, che compare in una policy o nel corpo di una funzione chiamata da una policy. E' auto-promozione`,
        rimedio)
      : trova("issue", `${chiave}.${nome}`,
        `colonna dal nome di privilegio (euristica sul nome) scrivibile dal proprietario della riga: oggi nessuna policy la usa, ma se un domani decidesse dei permessi sarebbe auto-promozione, perche' la RLS filtra le righe e non le colonne`,
        rimedio));
  }
  return findings;
}

// ─── regola 9 — macchina a stati vincolata solo in `update` ──────────────────
// Un trigger di transizione su `update` non dice niente su `insert`: la riga si
// crea direttamente nello stato di arrivo. Provato: con il trigger di
// transizione delle visite attivo, `insert into visits (id, status) values
// (..., 'fatturata')` passa senza un fiato.
// Due filtri tengono fuori il rumore, ed entrambi lavorano davvero sul banco:
//   - il corpo deve contenere un `raise` — cosi' i 18 trigger `updated_at`
//     (che non rifiutano niente) e il trigger di archiviazione delle cartelle
//     (che scrive una revisione e basta) restano fuori;
//   - il trigger non deve gia' scattare anche su `insert` — cosi' il trigger
//     delle righe di fattura, che scatta su entrambi, resta fuori.
// La colonna di stato non si indovina dal nome: e' quella che il trigger
// confronta fra `old.` e `new.`, cioe' la definizione stessa di transizione.
// `issue` e non `block`: quale sia "lo stato" resta un'inferenza sul corpo del
// trigger, e un `block` inferito e' un rosso che si impara a scavalcare. Chi
// deve dimostrare che il buco non c'e' e' il test pgTAP negativo (regola 10).
const colonneDiTransizione = (corpo) => {
  const nomi = (prefisso) =>
    new Set([...corpo.matchAll(new RegExp(`\\b${prefisso}\\.([a-z_][a-z0-9_]*)`, "gi"))]
      .map((m) => m[1].toLowerCase()));
  const vecchie = nomi("old");
  return [...nomi("new")].filter((c) => vecchie.has(c));
};

const letterali = (sql) => [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1]);

// Gli stati che il trigger CONFRONTA con quella colonna, e nient'altro. Presi
// tutti i letterali del corpo ci finirebbero i messaggi di `raise exception` e
// gli `interval '24 hours'`, e basta uno di quelli fuori dal `check` per far
// sembrare difesa una tabella che non lo e' — misurato sul banco veterinario.
const statiConfrontati = (corpo, colonna) => {
  const rif = `(?:old|new)\\.${colonna}`;
  const uguaglianze = [...corpo.matchAll(new RegExp(`${rif}\\s*(?:=|<>|!=)\\s*'([^']*)'`, "gi"))]
    .map((m) => m[1]);
  const elenchi = [...corpo.matchAll(new RegExp(`${rif}\\s+(?:not\\s+)?in\\s*\\(([^)]*)\\)`, "gi"))]
    .flatMap((m) => letterali(m[1]));
  return new Set([...uguaglianze, ...elenchi]);
};

// Un `check` sulla colonna di stato NON e' automaticamente un vincolo sullo
// stato iniziale. Sul banco veterinario c'e'
//   check (status = any (array['prenotata','confermata','eseguita','fatturata','annullata']))
// che enumera il DOMINIO — permette ogni stato di cui parla la macchina, quindi
// non impedisce affatto di nascere gia' `fatturata`. Trattarlo come difesa
// avrebbe reso muta la regola proprio sul difetto vero. Il vincolo vale come
// difesa se VIETA almeno uno stato che il trigger nomina.
// Se il trigger non nomina nessuno stato letterale non c'e' niente da
// confrontare: allora un `check` sulla colonna vale come difesa, perche' un
// verdetto non si inventa.
const vincolaLoStatoIniziale = (vincoli, chiave, colonna, statiDelTrigger) =>
  vincoli.some((v) => {
    const [schema, tabella, , definizione] = riga(v);
    if (`${schema}.${tabella}` !== chiave) return false;
    if (!new RegExp(`\\b${colonna}\\b`).test(definizione)) return false;
    if (statiDelTrigger.size === 0) return true;
    const ammessi = new Set(letterali(definizione));
    return [...statiDelTrigger].some((stato) => !ammessi.has(stato));
  });

export function regolaStatoIniziale({ policy, trigger, vincoli }) {
  if (!trigger || !vincoli) return []; // le query non ci sono: nessun verdetto
  const inseribili = chiaviDi(policy, 3, ["INSERT", "ALL"]);
  const findings = [];
  const viste = new Set();
  for (const r of trigger) {
    const [schema, tabella, , suInsert, suUpdate, corpo] = riga(r);
    const chiave = `${schema}.${tabella}`;
    if (!vero(suUpdate) || vero(suInsert)) continue;
    if (!/\braise\b/i.test(corpo)) continue;
    if (!inseribili.has(chiave)) continue;
    for (const colonna of colonneDiTransizione(corpo)) {
      const dedupe = `${chiave}.${colonna}`;
      if (viste.has(dedupe)) continue;
      if (vincolaLoStatoIniziale(vincoli, chiave, colonna, statiConfrontati(corpo, colonna))) continue;
      if (triggerCheNomina(trigger, chiave, colonna, "insert")) continue;
      viste.add(dedupe);
      findings.push(trova("issue", dedupe,
        "macchina a stati vincolata solo in `update`: il trigger di transizione non scatta su `insert`, e non c'e' nessun `check` sullo stato iniziale — la riga si crea direttamente nello stato di arrivo e la macchina non e' mai passata di li'",
        `alter table ${chiave} add constraint ${tabella}_stato_iniziale check (${colonna} = '<stato iniziale>'); ` +
        `— oppure lo stesso trigger anche \`before insert\`, se gli stati iniziali leciti sono piu' di uno`));
    }
  }
  return findings;
}

// ─── regola 10 — policy di scrittura mai attaccate da un test ────────────────
// E' il blocco n°1 del collaudo del 2026-07-26: sullo schema che il gate
// dichiarava VERDE, `/code-inquisition` ha riprodotto 16 difetti su 17. Nessuno
// strumento guarda la SEMANTICA di una policy — verificano che esista. L'unica
// cosa che dimostra che una policy funziona e' averla attaccata e aver visto il
// database rifiutare.
// Il test cercato e' testuale, e la coppia e' dichiarata: il file deve (a)
// impersonare un ruolo (`set local role` / `request.jwt.claims`) e (b) tentare
// una SCRITTURA su quella tabella. Non si pretende anche che l'asserzione sia
// di rifiuto: il test negativo corretto gia' scritto sul banco asserisce che la
// visita e' RIMASTA `prenotata` (conteggio 1, non 0) e non usa `throws_ok` —
// pretendere `throws_ok` o «righe = 0» avrebbe segnalato come mancante un test
// negativo corretto, cioe' il falso positivo peggiore possibile.
const tentaScrittura = (testo, schema, tabella) => {
  const rif = `(?:${perRegex(schema)}\\.)?${perRegex(tabella)}\\b`;
  return new RegExp(
    `insert\\s+into\\s+${rif}|update\\s+(?:only\\s+)?${rif}|delete\\s+from\\s+${rif}`, "i"
  ).test(testo);
};

export function regolaTestNegativi({ policy, testiPgtap }) {
  if (!testiPgtap) return []; // i test non sono stati letti: nessun verdetto
  const conRuolo = testiPgtap
    .filter((t) => /set\s+local\s+role|request\.jwt\.claims/i.test(t.testo))
    .map((t) => t.testo);
  const findings = [];
  const viste = new Set();
  for (const r of policy) {
    const [schema, tabella, , cmd] = riga(r);
    const chiave = `${schema}.${tabella}`;
    if (!["INSERT", "UPDATE", "DELETE", "ALL"].includes(cmd) || viste.has(chiave)) continue;
    viste.add(chiave);
    if (conRuolo.some((testo) => tentaScrittura(testo, schema, tabella))) continue;
    findings.push(trova("block", chiave,
      "policy di scrittura mai attaccate: nessun test pgTAP tenta un `insert`/`update`/`delete` su questa tabella impersonando un ruolo, quindi le sue policy sono un'ipotesi non verificata",
      `in supabase/tests/: \`set local role authenticated; set local request.jwt.claims = '{"sub":"<utente>"}';\` ` +
      `poi il tentativo che DEVE fallire su ${chiave}, e l'asserzione che e' fallito`));
  }
  return findings;
}

// ─── composizione ────────────────────────────────────────────────────────────
// L'ordine e' quello del report: prima le tabelle, per ultima la performance.
export function auditAll(catalogo) {
  return [
    ...regolaTabelle(catalogo.tabelle),
    ...regolaGrant(catalogo),
    ...regolaPolicy(catalogo.policy),
    ...regolaLetturaPerScrittura(catalogo.policy),
    ...regolaTestNegativi(catalogo),
    ...regolaColonnaDiPrivilegio(catalogo),
    ...regolaStatoIniziale(catalogo),
    ...regolaViste(catalogo.viste),
    ...regolaFunzioni(catalogo.funzioni),
    ...regolaChiaviEsterne(catalogo.chiaviEsterne),
    ...regolaColonneDiPolicy(catalogo),
  ];
}
