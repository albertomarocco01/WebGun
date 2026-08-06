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
 * USO:  node rls-audit.mjs [--db-url <url>] [--schemas public,shop]
 *                          [--tests supabase/tests] [--json]
 * USCITA: 0 = nessun problema bloccante · 1 = almeno un `block` · 2 = errore di esecuzione
 * DIPENDENZE: solo `psql` nel PATH. Zero pacchetti npm.
 *
 * ATTENZIONE al default: senza `--db-url` si audita la porta 54322, che su una
 * macchina con due stack Supabase accesi e' il progetto di QUALCUN ALTRO. Per
 * questo il database auditato si stampa sempre, anche quando non c'e' niente da
 * segnalare: un audit sul database sbagliato non deve poter assomigliare a un
 * audit riuscito. Dentro `verify.mjs` l'URL arriva sempre dal config.toml del
 * progetto e il passo e' `skipped` se non e' risolvibile.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { auditAll, motivoAritaSbagliata, recordDiAritaSbagliata, righeDaPsql } from "./audit-lib.mjs";
import { argomentiOstiliACmd, formaEseguibile, motivoOstile, risolviEseguibile } from "./eseguibili.mjs";

const SEP = "\x1f"; // unit separator: non compare mai nei nomi degli oggetti
const REC = "\x1e"; // record separator: l'espressione di una policy va a capo
const DEFAULT_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// ---------------------------------------------------------------- argomenti
function parseArgs(argv) {
  const args = { dbUrl: DEFAULT_DB_URL, schemas: ["public"], json: false, tests: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--schemas") args.schemas = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--tests") args.tests = argv[++i];
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
// `psql` si risolve UNA volta e col percorso pieno. Col nome nudo lo
// risolverebbe la directory corrente — che quando l'audit e' lanciato dal gate
// e' la radice del progetto auditato — e un `psql.exe` piantato li' deciderebbe
// cosa questo audit legge dal catalogo di Postgres (referto § C1, misurato il
// 2026-08-06 con `hostname.exe` rinominato).
const psql = (() => {
  const { percorso, rifiutati } = risolviEseguibile("psql", process.cwd());
  if (rifiutati.length > 0) {
    console.error(`psql trovato DENTRO il progetto auditato (${rifiutati.join(", ")}): rifiutato. Un progetto non sceglie il binario che lo giudica.`);
  }
  return formaEseguibile("psql", () => percorso);
})();

function query(dbUrl, sql, arita, nomeQuery) {
  if (psql.file === null) {
    console.error("psql non disponibile nel PATH: verifica RLS NON eseguita.");
    process.exit(2);
  }
  const argomenti = [dbUrl, "-X", "-At", "-F", SEP, "-R", REC, "-c", sql];
  // Se `psql` e' uno shim `.cmd` si passa da `cmd.exe /c`, che E' una shell: e
  // qui gli argomenti sono l'SQL intero (pieno di spazi) e i due separatori, che
  // sono caratteri di controllo. Attraverso una shell arriverebbero diversi da
  // come sono stati scritti, e l'audit interrogherebbe un'altra cosa
  // (referto § H1/H2/L1). Su questa macchina `psql` e' un `.exe` e il ramo non
  // scatta mai — ma il gate non gira solo su questa macchina.
  if (psql.prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(argomenti);
    if (ostili.length > 0) {
      console.error(`${motivoOstile(ostili)}\nQui gli argomenti sono l'SQL del catalogo e i separatori di campo: attraverso una shell l'audit interrogherebbe un'altra cosa. Verifica MANCANTE.`);
      process.exit(2);
    }
  }
  const res = spawnSync(psql.file, [...psql.prefisso, ...argomenti], {
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
  const record = righeDaPsql(res.stdout, SEP, REC);
  // OGNI query dichiara quanti campi ha, e un record che non li ha non si
  // interpreta. Un separatore dentro un testo libero del catalogo sposta le
  // colonne e fa sparire un `block` senza dire niente (referto § H5 / § M17):
  // qui il guasto diventa uscita 2, cioe' verifica MANCANTE.
  const rotti = recordDiAritaSbagliata(record, arita);
  if (rotti.length > 0) {
    console.error(motivoAritaSbagliata(nomeQuery, arita, rotti));
    process.exit(2);
  }
  return record;
}

// --------------------------------------------------- lettura dei test pgTAP
// Senza `--tests` la regola dei test negativi TACE (nessun verdetto inventato:
// stesso criterio di `grants`). Con `--tests` una cartella assente o vuota vale
// «zero test», che e' un'informazione, non un'assenza di informazione.
function leggiTestPgtap(cartella) {
  if (cartella === null) return null;
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ nome: f, testo: readFileSync(join(cartella, f), "utf8") }));
}

// ------------------------------------------------------- lettura del catalogo
// Undici query, nessun giudizio qui dentro: solo SELECT.
function leggiCatalogo({ dbUrl, schemas, tests }) {
  const list = schemas.map((s) => `'${s}'`).join(",");
  const q = (arita, nome, sql) => query(dbUrl, sql, arita, nome);

  return {
    testiPgtap: leggiTestPgtap(tests),
    // 1. tabelle: RLS attiva? quante policy? forzata anche per il proprietario?
    tabelle: q(5, "tabelle",
      `select n.nspname, c.relname, c.relrowsecurity::text,
              (select count(*) from pg_policies p
                where p.schemaname = n.nspname and p.tablename = c.relname)::text,
              c.relforcerowsecurity::text
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind = 'r'
        order by 1, 2`
    ),
    // 2. policy: permissivita' e performance
    policy: q(7, "policy",
      `select schemaname, tablename, policyname, coalesce(cmd,''),
              array_to_string(roles, ','), coalesce(qual,''), coalesce(with_check,'')
         from pg_policies where schemaname in (${list}) order by 1, 2, 3`
    ),
    // 3. viste: una vista senza security_invoker scavalca la RLS sottostante
    viste: q(4, "viste",
      `select n.nspname, c.relname, c.relkind::text,
              coalesce(array_to_string(c.reloptions, ','), '')
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind in ('v','m') order by 1, 2`
    ),
    // 4. funzioni security definer: search_path fisso? e chi puo' eseguirle?
    //    `proacl` NULL (quindi '' dopo il coalesce) = privilegi di DEFAULT, che
    //    in Postgres significano `execute` a PUBLIC: la funzione e' un endpoint
    //    pubblico raggiungibile da `anon`. Il campo si legge, non si interpreta:
    //    la lettura dell'ACL sta in `audit-lib.mjs`.
    //    Il quinto campo e' il CORPO: una policy che chiama `puo_vedere_x(...)`
    //    porta la decisione di privilegio li' dentro, non nel testo della
    //    policy. Sul banco veterinario `job_title` compare solo nel corpo.
    funzioni: q(5, "funzioni",
      `select n.nspname, p.proname, coalesce(array_to_string(p.proconfig, ','), ''),
              coalesce(p.proacl::text, ''), coalesce(p.prosrc, '')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in (${list}) and p.prosecdef order by 1, 2`
    ),
    // 5. chiavi esterne senza indice (Postgres non lo crea da solo)
    chiaviEsterne: q(3, "chiaviEsterne",
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
    indicizzate: q(1, "indicizzate",
      `select n.nspname || '.' || c.relname || '.' || a.attname
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
        where n.nspname in (${list})`
    ),
    // 6b. tutte le colonne delle tabelle, per cercarle nelle espressioni delle
    //     policy. Il tipo serve a esentare i booleani dall'indice pieno.
    colonne: q(4, "colonne",
      `select n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod)
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in (${list}) and c.relkind = 'r'
          and a.attnum > 0 and not a.attisdropped`
    ),
    // 7. QUALI privilegi CRUD ha davvero ogni ruolo del client, tabella per
    //    tabella. La trappola inversa: RLS e policy perfette non servono a
    //    niente se il ruolo non ha il permesso — dalla Data API non legge nulla.
    //
    //    Questa query ha SOSTITUITO un `select distinct` su
    //    `information_schema.role_table_grants` filtrato per il solo `grantee`.
    //    Quella forma non guardava QUALE privilegio, e il 2026-08-03 e' stata
    //    misurata muta su uno schema interamente illeggibile: le immagini
    //    Supabase nuove concedono `Dxtm` (TRUNCATE, REFERENCES, TRIGGER,
    //    MAINTAIN — zero CRUD), la tabella compariva lo stesso in
    //    `role_table_grants` con `privilege_type = 'TRUNCATE'`, e la regola
    //    taceva su 18 tabelle su 18.
    //
    //    `has_any_column_privilege` invece di `has_table_privilege`: un `grant
    //    update (colonna)` NON compare in `relacl` (sta in `pg_attribute.attacl`,
    //    ../../DECISIONI.md §22) ed e' la difesa PRESCRITTA contro
    //    l'auto-promozione. Con `has_table_privilege` la forma corretta
    //    risulterebbe un difetto: il falso positivo peggiore, quello sul rimedio
    //    che la skill stessa insegna.
    //    `delete` fa eccezione e la eccezione e' di Postgres, non nostra: non
    //    esiste un `delete` per colonna, e chiederlo e' un errore di esecuzione
    //    («unrecognized privilege type: "DELETE"», misurato su 17.6) — cioe' un
    //    audit MANCANTE, non un audit severo.
    privilegi: q(4, "privilegi",
      `select n.nspname, c.relname, r.rolname, p.priv
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p (priv)
        cross join pg_roles r
        where n.nspname in (${list}) and c.relkind = 'r'
          and r.rolname in ('anon', 'authenticated')
          and case
            when p.priv = 'DELETE' then has_table_privilege(r.oid, c.oid, p.priv)
            else has_any_column_privilege(r.oid, c.oid, p.priv)
          end
        order by 1, 2, 3, 4`
    ),
    // 8. grant di UPDATE sull'INTERA tabella. `role_table_grants` legge `relacl`
    //    e quindi NON elenca i grant per colonna (verificato su Postgres reale
    //    il 2026-07-27: con `grant update (nome) on t to authenticated` la
    //    tabella non compare qui, e l'update della colonna esclusa viene negato
    //    con «permission denied for table»). E' il segnale che distingue una
    //    scrittura su tutte le colonne da una scrittura ristretta.
    grantsScrittura: q(2, "grantsScrittura",
      `select distinct table_schema, table_name
         from information_schema.role_table_grants
        where table_schema in (${list}) and privilege_type = 'UPDATE'
          and grantee in ('anon', 'authenticated')`
    ),
    // 9. trigger non interni, con il CORPO della funzione. `tgtype` e' una
    //    maschera di bit: 4 = insert, 16 = update (verificate sul catalogo).
    //    Serve a vedere le macchine a stati vincolate solo in `update`.
    trigger: q(6, "trigger",
      `select n.nspname, c.relname, t.tgname,
              ((t.tgtype & 4) > 0)::text, ((t.tgtype & 16) > 0)::text,
              coalesce(f.prosrc, '')
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_proc f on f.oid = t.tgfoid
        where not t.tgisinternal and n.nspname in (${list}) order by 1, 2, 3`
    ),
    // 10. vincoli `check`: sono la difesa che pianta lo stato iniziale di una
    //     macchina a stati (e in generale l'unica che vale anche in `insert`).
    vincoli: q(4, "vincoli",
      `select n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid)
         from pg_constraint con
         join pg_class c on c.oid = con.conrelid
         join pg_namespace n on n.oid = c.relnamespace
        where con.contype = 'c' and n.nspname in (${list}) order by 1, 2, 3`
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
    console.log(JSON.stringify({ ok: blocking === 0, dbUrl: args.dbUrl,
      schemas: args.schemas, findings, summary: {
        block: blocking, issue: count("issue"), warn: count("warn") } }, null, 2));
    process.exit(blocking === 0 ? 0 : 1);
  }

  // intestazione sempre stampata: quale database, quali schemi. E' la stessa
  // garanzia che `verify` da' nel dettaglio del passo (DECISIONI.md §11), che
  // qui mancava — ed e' proprio per questo che il comando `rls`, eseguito alla
  // lettera, ha auditato il database di un altro progetto rispondendo «nessun
  // bloccante».
  console.log(`AUDIT RLS su ${args.dbUrl} · schemi: ${args.schemas.join(", ")}`);
  if (findings.length === 0) {
    console.log("Nessun problema rilevato.");
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
