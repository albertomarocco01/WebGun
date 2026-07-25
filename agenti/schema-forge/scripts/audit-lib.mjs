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

// ─── regola 2 — permissivita' e costo delle policy ───────────────────────────
export function regolaPolicy(policy) {
  const findings = [];
  for (const r of policy) {
    const [schema, tabella, nome, cmd, ruoli, qual, withCheck] = riga(r);
    const obj = `${schema}.${tabella} → "${nome}"`;
    const espressione = `${qual} ${withCheck}`;

    if (qual.trim() === "true") {
      findings.push(trova("issue", obj, "policy con `using (true)`: RLS attiva ma senza filtro",
        "legittima solo su dati realmente pubblici, e va documentata nell'handoff"));
    }
    if (["INSERT", "UPDATE", "ALL"].includes(cmd) && withCheck.trim() === "true") {
      findings.push(trova("block", obj, "policy di scrittura con `with check (true)`: chiunque puo' scrivere per conto di altri",
        "vincola la scrittura all'utente: with check ((select auth.uid()) = user_id)"));
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

// ─── regola 4 — security definer senza search_path fisso ─────────────────────
export function regolaFunzioni(funzioni) {
  const findings = [];
  for (const r of funzioni) {
    const [schema, funzione, config] = riga(r);
    if (!/search_path/.test(config)) {
      findings.push(trova("block", `${schema}.${funzione}()`,
        "funzione `security definer` senza `search_path` fisso: escalation di privilegi",
        "aggiungi: set search_path = ''"));
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

// ─── composizione ────────────────────────────────────────────────────────────
// L'ordine e' quello del report: prima le tabelle, per ultima la performance.
export function auditAll(catalogo) {
  return [
    ...regolaTabelle(catalogo.tabelle),
    ...regolaPolicy(catalogo.policy),
    ...regolaViste(catalogo.viste),
    ...regolaFunzioni(catalogo.funzioni),
    ...regolaChiaviEsterne(catalogo.chiaviEsterne),
    ...regolaColonneDiPolicy(catalogo),
  ];
}
