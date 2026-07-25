#!/usr/bin/env node
/**
 * erd.mjs — Genera il diagramma ER (Mermaid) dallo schema REALE.
 *
 * COSA FA: legge tabelle, colonne e chiavi esterne dal catalogo di Postgres e
 * stampa un `erDiagram`. Il diagramma non lo disegna l'LLM: lo stampa il tool.
 * Stesso principio di tree.mjs in code-maniac — la mappa e' rigenerabile, non scritta a mano.
 *
 * Questo file e' solo il GUSCIO: legge da psql e scrive. La costruzione del
 * Mermaid sta in `erd-lib.mjs`, funzione pura testabile senza database.
 *
 * USO:  node erd.mjs [--db-url <url>] [--schemas public] [--out docs/schema/ERD.md]
 * DIPENDENZE: solo `psql` nel PATH.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { costruisciErd } from "./erd-lib.mjs";

const SEP = "\x1f";
const DEFAULT_DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function parseArgs(argv) {
  const args = { dbUrl: DEFAULT_DB_URL, schemas: ["public"], out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--schemas") args.schemas = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  for (const s of args.schemas) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(s)) {
      console.error(`Nome di schema non valido: ${s}`);
      process.exit(2);
    }
  }
  return args;
}

function query(dbUrl, sql) {
  const res = spawnSync("psql", [dbUrl, "-At", "-F", SEP, "-c", sql], { encoding: "utf8" });
  if (res.error) {
    console.error("psql non disponibile nel PATH: diagramma NON generato.");
    process.exit(2);
  }
  if (res.status !== 0) {
    console.error(`psql ha fallito: ${(res.stderr || "").trim()}`);
    process.exit(2);
  }
  // split su \r?\n: su Windows psql chiude le righe con CRLF (vedi rls-audit.mjs).
  return res.stdout.split(/\r?\n/).filter(Boolean).map((r) => r.split(SEP));
}

// ------------------------------------------------------- lettura del catalogo
function leggiCatalogo({ dbUrl, schemas }) {
  const list = schemas.map((s) => `'${s}'`).join(",");

  const colonne = query(
    dbUrl,
    `select c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
            (a.attnotnull)::text,
            (exists (select 1 from pg_index i
                      where i.indrelid = c.oid and i.indisprimary
                        and a.attnum = any(i.indkey)))::text,
            (exists (select 1 from pg_constraint k
                      where k.conrelid = c.oid and k.contype = 'f'
                        and a.attnum = any(k.conkey)))::text
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in (${list}) and c.relkind = 'r'
        and a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attnum`
  );

  // L'ultima colonna dice se l'insieme di colonne della FK e' anche UNICO: in
  // quel caso la riga figlia non puo' ripetersi e la relazione e' 1:1.
  // Un indice unico PARZIALE non garantisce l'unicita' globale: escluso.
  const relazioni = query(
    dbUrl,
    `select src.relname, tgt.relname, con.conname,
            (select bool_and(att.attnotnull) from pg_attribute att
              where att.attrelid = con.conrelid and att.attnum = any(con.conkey))::text,
            tgtn.nspname,
            (exists (
               select 1 from pg_index i
                where i.indrelid = con.conrelid
                  and i.indisunique and i.indisvalid and i.indpred is null
                  and (select array_agg(k order by k)
                         from unnest((string_to_array(i.indkey::text, ' ')::smallint[])[1:i.indnkeyatts]) k)
                      = (select array_agg(k order by k) from unnest(con.conkey) k)
            ))::text
       from pg_constraint con
       join pg_class src on src.oid = con.conrelid
       join pg_class tgt on tgt.oid = con.confrelid
       join pg_namespace tgtn on tgtn.oid = tgt.relnamespace
       join pg_namespace n on n.oid = con.connamespace
      where con.contype = 'f' and n.nspname in (${list})
      order by 1, 2`
  );

  return { colonne, relazioni, schemi: schemas };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const diagram = costruisciErd(leggiCatalogo(args));
  const document = [
    "# Diagramma ER",
    "",
    "> Generato da `scripts/erd.mjs` dallo schema reale. **Non modificare a mano**: rigeneralo.",
    "",
    "```mermaid",
    diagram,
    "```",
    "",
  ].join("\n");

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, document);
    console.log(`Diagramma scritto in ${args.out}`);
  } else {
    console.log(document);
  }
}

main();
