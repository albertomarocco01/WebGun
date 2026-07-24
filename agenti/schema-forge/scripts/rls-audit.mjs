#!/usr/bin/env node
/**
 * rls-audit.mjs — Audit deterministico della Row Level Security.
 *
 * COSA FA: interroga il database REALE (pg_class, pg_policies, pg_proc, pg_index)
 * e riporta ogni tabella esposta senza protezione. Nessun giudizio dell'LLM:
 * sono conteggi e confronti puri sul catalogo di Postgres.
 *
 * PERCHE': su Supabase ogni tabella dello schema public e' pubblicata via
 * PostgREST. Una tabella senza RLS non e' un TODO, e' un data leak.
 *
 * USO:  node rls-audit.mjs [--db-url <url>] [--schemas public,shop] [--json]
 * USCITA: 0 = nessun problema bloccante · 1 = almeno un `block` · 2 = errore di esecuzione
 * DIPENDENZE: solo `psql` nel PATH. Zero pacchetti npm.
 */

import { spawnSync } from "node:child_process";

const SEP = "\x1f"; // unit separator: non compare mai nei nomi degli oggetti
const DEFAULT_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// ---------------------------------------------------------------- argomenti
function parseArgs(argv) {
  const args = { dbUrl: DEFAULT_DB_URL, schemas: ["public"], json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--schemas") args.schemas = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--json") args.json = true;
  }
  // identificatori validati: finiscono dentro una query, non si accettano sorprese
  for (const s of args.schemas) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(s)) {
      console.error(`Nome di schema non valido: ${s}`);
      process.exit(2);
    }
  }
  return args;
}

// ------------------------------------------------------------------- query
function query(dbUrl, sql) {
  const res = spawnSync("psql", [dbUrl, "-At", "-F", SEP, "-c", sql], {
    encoding: "utf8",
  });
  if (res.error) {
    console.error("psql non disponibile nel PATH: verifica RLS NON eseguita.");
    process.exit(2);
  }
  if (res.status !== 0) {
    console.error(`psql ha fallito: ${(res.stderr || "").trim()}`);
    process.exit(2);
  }
  return res.stdout
    .split("\n")
    .filter((r) => r.length > 0)
    .map((r) => r.split(SEP));
}

// ------------------------------------------------------------------ regole
function audit({ dbUrl, schemas }) {
  const list = schemas.map((s) => `'${s}'`).join(",");
  const findings = [];
  const add = (severity, object, message, hint) =>
    findings.push({ severity, object, message, hint });

  // 1. tabelle: RLS attiva? quante policy?
  const tables = query(
    dbUrl,
    `select n.nspname, c.relname, c.relrowsecurity::text,
            (select count(*) from pg_policies p
              where p.schemaname = n.nspname and p.tablename = c.relname)::text
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in (${list}) and c.relkind = 'r'
      order by 1, 2`
  );
  for (const [schema, table, rls, policyCount] of tables) {
    const obj = `${schema}.${table}`;
    if (rls !== "t") {
      add("block", obj, "RLS non attiva su una tabella esposta",
        `alter table ${obj} enable row level security;`);
    } else if (policyCount === "0") {
      add("issue", obj, "RLS attiva ma nessuna policy: nessun ruolo puo' leggere o scrivere",
        "aggiungi almeno una policy, oppure sposta la tabella in uno schema non esposto");
    }
  }

  // 2. policy: permissivita' e performance
  const policies = query(
    dbUrl,
    `select schemaname, tablename, policyname, coalesce(cmd,''),
            array_to_string(roles, ','), coalesce(qual,''), coalesce(with_check,'')
       from pg_policies where schemaname in (${list}) order by 1, 2, 3`
  );
  for (const [schema, table, name, cmd, roles, qual, withCheck] of policies) {
    const obj = `${schema}.${table} → "${name}"`;
    const expr = `${qual} ${withCheck}`;

    if (qual.trim() === "true") {
      add("issue", obj, "policy con `using (true)`: RLS attiva ma senza filtro",
        "legittima solo su dati realmente pubblici, e va documentata nell'handoff");
    }
    if (["INSERT", "UPDATE", "ALL"].includes(cmd) && withCheck.trim() === "true") {
      add("block", obj, "policy di scrittura con `with check (true)`: chiunque puo' scrivere per conto di altri",
        "vincola la scrittura all'utente: with check ((select auth.uid()) = user_id)");
    }
    if (/auth\.uid\(\)/.test(expr) && !/select\s+auth\.uid\(\)/i.test(expr)) {
      add("warn", obj, "`auth.uid()` non avvolto in `(select ...)`: valutata per ogni riga",
        "usa (select auth.uid()) — il planner la calcola una volta per statement");
    }
    if (/\bjoin\b/i.test(expr)) {
      add("warn", obj, "join dentro la policy: costo per riga e rischio di ricorsione",
        "incapsula la verifica in una funzione stable security definer");
    }
    if (roles === "{public}" || roles === "public") {
      add("warn", obj, "policy senza ruolo esplicito: valutata anche per ruoli che non la usano",
        "aggiungi `to authenticated` oppure `to anon`");
    }
  }

  // 3. viste: security_invoker (una vista senza invoker scavalca la RLS delle tabelle sotto)
  const views = query(
    dbUrl,
    `select n.nspname, c.relname, c.relkind::text,
            coalesce(array_to_string(c.reloptions, ','), '')
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in (${list}) and c.relkind in ('v','m') order by 1, 2`
  );
  for (const [schema, view, kind, opts] of views) {
    const obj = `${schema}.${view}`;
    if (kind === "m") {
      add("issue", obj, "vista materializzata in uno schema esposto: non supporta RLS",
        "spostala in uno schema privato ed esponi semmai una funzione controllata");
    } else if (!/security_invoker\s*=\s*(on|true)/i.test(opts)) {
      add("block", obj, "vista senza `security_invoker`: gira coi diritti del proprietario e scavalca la RLS",
        `alter view ${obj} set (security_invoker = on);`);
    }
  }

  // 4. funzioni security definer senza search_path fisso
  const functions = query(
    dbUrl,
    `select n.nspname, p.proname, coalesce(array_to_string(p.proconfig, ','), '')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in (${list}) and p.prosecdef order by 1, 2`
  );
  for (const [schema, fn, config] of functions) {
    if (!/search_path/.test(config)) {
      add("block", `${schema}.${fn}()`,
        "funzione `security definer` senza `search_path` fisso: escalation di privilegi",
        "aggiungi: set search_path = ''");
    }
  }

  // 5. chiavi esterne senza indice (Postgres non lo crea da solo)
  const fks = query(
    dbUrl,
    `select n.nspname, con.conrelid::regclass::text, a.attname
       from pg_constraint con
       join pg_namespace n on n.oid = con.connamespace
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
      where con.contype = 'f' and n.nspname in (${list})
        and not exists (
          select 1 from pg_index i
           where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1]
        )
      order by 2, 3`
  );
  for (const [, table, column] of fks) {
    add("issue", `${table}.${column}`, "chiave esterna senza indice: join e `on delete` fanno scansione completa",
      `create index on ${table} (${column});`);
  }

  // 6. colonne usate nelle policy senza indice (la policy gira su ogni riga)
  const indexed = new Set(
    query(
      dbUrl,
      `select n.nspname || '.' || c.relname || '.' || a.attname
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
        where n.nspname in (${list})`
    ).map((r) => r[0])
  );
  const columns = query(
    dbUrl,
    `select n.nspname, c.relname, a.attname
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in (${list}) and c.relkind = 'r'
        and a.attnum > 0 and not a.attisdropped`
  );
  const columnsByTable = new Map();
  for (const [schema, table, column] of columns) {
    const key = `${schema}.${table}`;
    if (!columnsByTable.has(key)) columnsByTable.set(key, []);
    columnsByTable.get(key).push(column);
  }
  const seen = new Set();
  for (const [schema, table, , , , qual, withCheck] of policies) {
    const key = `${schema}.${table}`;
    const expr = `${qual} ${withCheck}`;
    for (const column of columnsByTable.get(key) ?? []) {
      if (column === "id") continue; // gia' chiave primaria
      const used = new RegExp(`\\b${column}\\b`).test(expr);
      const dedupe = `${key}.${column}`;
      if (used && !indexed.has(dedupe) && !seen.has(dedupe)) {
        seen.add(dedupe);
        add("warn", dedupe, "colonna usata in una policy ma non indicizzata: costo su ogni riga di ogni query",
          `create index on ${key} (${column});`);
      }
    }
  }

  return findings;
}

// ------------------------------------------------------------------ report
function main() {
  const args = parseArgs(process.argv.slice(2));
  const findings = audit(args);
  const count = (s) => findings.filter((f) => f.severity === s).length;
  const blocking = count("block");

  if (args.json) {
    console.log(JSON.stringify({ ok: blocking === 0, findings, summary: {
      block: blocking, issue: count("issue"), warn: count("warn") } }, null, 2));
    process.exit(blocking === 0 ? 0 : 1);
  }

  if (findings.length === 0) {
    console.log("AUDIT RLS: nessun problema rilevato.");
    process.exit(0);
  }
  for (const severity of ["block", "issue", "warn"]) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    console.log(`\n${severity.toUpperCase()} (${group.length})`);
    for (const f of group) {
      console.log(`- ${f.object}: ${f.message}`);
      if (f.hint) console.log(`    → ${f.hint}`);
    }
  }
  console.log(
    `\nAUDIT RLS: ${blocking === 0 ? "nessun bloccante" : "GATE ROSSO"} ` +
    `(${blocking} block, ${count("issue")} issue, ${count("warn")} warn)`
  );
  process.exit(blocking === 0 ? 0 : 1);
}

main();
