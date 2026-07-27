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
      findings.push(trova("issue", obj, "vista materializzata in uno schema esposto: non supporta RLS",
        "spostala in uno schema privato ed esponi semmai una funzione controllata"));
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
      const usata = new RegExp(`\\b${nome}\\b`).test(espressione);
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

// ─── regola 7 — la trappola inversa: RLS in ordine, nessun `grant` ───────────
// RLS attiva e policy corrette non bastano a rendere una tabella raggiungibile:
// se `anon`/`authenticated` non hanno il `grant`, dalla Data API la tabella non
// legge e non scrive NIENTE, e il guasto sembra un bug del frontend. Su Supabase
// le tabelle nuove non sono sempre esposte d'ufficio: dipende dalle impostazioni
// della Data API del progetto (references/rls-supabase.md).
// Si giudica solo dove le altre regole tacciono — tabella con RLS attiva e almeno
// una policy — altrimenti la stessa tabella prende due findings per un difetto.
// Righe dei grant: [schema, tabella], gia' filtrate a anon/authenticated.
export function regolaGrant({ tabelle, grants }) {
  if (!grants) return []; // la query non c'e': nessun verdetto inventato
  const concessi = new Set(grants.map((r) => `${pulisci(r[0])}.${pulisci(r[1])}`));
  const findings = [];
  for (const r of tabelle) {
    const [schema, tabella, rls, numeroPolicy] = riga(r);
    const obj = `${schema}.${tabella}`;
    if (!vero(rls) || numeroPolicy === "0" || concessi.has(obj)) continue;
    findings.push(trova("issue", obj,
      "RLS e policy in ordine ma nessun `grant` a `anon`/`authenticated`: dalla Data API la tabella non legge nulla, e sembra un bug del frontend",
      `grant select on ${obj} to anon, authenticated; ` +
      `— se invece il client non deve raggiungerla, spostala in uno schema non esposto`));
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
    ...regolaViste(catalogo.viste),
    ...regolaFunzioni(catalogo.funzioni),
    ...regolaChiaviEsterne(catalogo.chiaviEsterne),
    ...regolaColonneDiPolicy(catalogo),
  ];
}
