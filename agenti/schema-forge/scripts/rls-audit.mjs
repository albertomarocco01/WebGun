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
 * Questo file e' solo il GUSCIO: legge da psql e stampa. Le regole stanno in
 * `audit-lib.mjs`, funzioni pure testabili senza database (`node --test`).
 *
 * USO:  node rls-audit.mjs [--db-url <url>] [--schemas public,shop] [--json]
 * USCITA: 0 = nessun problema bloccante · 1 = almeno un `block` · 2 = errore di esecuzione
 * DIPENDENZE: solo `psql` nel PATH. Zero pacchetti npm.
 */

import { spawnSync } from "node:child_process";

import { auditAll, righeDaPsql } from "./audit-lib.mjs";

const SEP = "\x1f"; // unit separator: non compare mai nei nomi degli oggetti
const REC = "\x1e"; // record separator: l'espressione di una policy va a capo
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
  const res = spawnSync("psql", [dbUrl, "-At", "-F", SEP, "-R", REC, "-c", sql], {
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
  return righeDaPsql(res.stdout, SEP, REC);
}

// ------------------------------------------------------- lettura del catalogo
// Sei query, una per regola: nessun giudizio qui dentro, solo SELECT.
function leggiCatalogo({ dbUrl, schemas }) {
  const list = schemas.map((s) => `'${s}'`).join(",");
  const q = (sql) => query(dbUrl, sql);

  return {
    // 1. tabelle: RLS attiva? quante policy? forzata anche per il proprietario?
    tabelle: q(
      `select n.nspname, c.relname, c.relrowsecurity::text,
              (select count(*) from pg_policies p
                where p.schemaname = n.nspname and p.tablename = c.relname)::text,
              c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind = 'r'
        order by 1, 2`
    ),
    // 2. policy: permissivita' e performance
    policy: q(
      `select schemaname, tablename, policyname, coalesce(cmd,''),
              array_to_string(roles, ','), coalesce(qual,''), coalesce(with_check,'')
         from pg_policies where schemaname in (${list}) order by 1, 2, 3`
    ),
    // 3. viste: una vista senza security_invoker scavalca la RLS sottostante
    viste: q(
      `select n.nspname, c.relname, c.relkind::text,
              coalesce(array_to_string(c.reloptions, ','), '')
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind in ('v','m') order by 1, 2`
    ),
    // 4. funzioni security definer senza search_path fisso
    funzioni: q(
      `select n.nspname, p.proname, coalesce(array_to_string(p.proconfig, ','), '')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in (${list}) and p.prosecdef order by 1, 2`
    ),
    // 5. chiavi esterne senza indice (Postgres non lo crea da solo)
    chiaviEsterne: q(
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
    ),
    // 6a. colonne gia' coperte da un indice (prima colonna dell'indice)
    indicizzate: q(
      `select n.nspname || '.' || c.relname || '.' || a.attname
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
        where n.nspname in (${list})`
    ),
    // 6b. tutte le colonne delle tabelle, per cercarle nelle espressioni delle
    //     policy. Il tipo serve a esentare i booleani dall'indice pieno.
    colonne: q(
      `select n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod)
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind = 'r'
          and a.attnum > 0 and not a.attisdropped`
    ),
  };
}

// ------------------------------------------------------------------ report
function main() {
  const args = parseArgs(process.argv.slice(2));
  const findings = auditAll(leggiCatalogo(args));
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
