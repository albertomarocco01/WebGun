#!/usr/bin/env node
/**
 * admin-audit.mjs — guscio di I/O dell'audit del gestionale.
 *
 * COSA FA: legge i file sorgente del progetto e il catalogo dei permessi
 * (`psql`), passa tutto alle regole pure di `audit-lib.mjs` e stampa.
 * Nessun giudizio qui dentro: se una regola sta nel guscio, non la si puo'
 * eseguire senza un progetto e un database, e una regola che non si esegue e'
 * una regola che si spegne senza che nessuno lo sappia.
 *
 * USO:  node admin-audit.mjs [--progetto <dir>] [--db-url <url>] [--json]
 * USCITA: 0 nessun `block` · 1 almeno un `block` · 2 errore di esecuzione
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditAdmin, catalogoDaRighe, conBarre } from "./audit-lib.mjs";
import { urlDbProgetto, validaConfig } from "./progetto-lib.mjs";

const SEP = "\x1f";
const RS = "\x1e";
const ESTENSIONI = /\.(tsx?|jsx?|mjs)$/;
// Si salta solo cio' che non e' codice del progetto. `supabase` NON e' in
// elenco, e c'era: la cartella delle migrazioni sta nella radice e la scansione
// parte da `src/`, quindi escluderla per nome significava saltare
// `src/lib/supabase/` — cioe' esattamente la cartella dove nascono i client, e
// dove il collaudo del 2026-07-28 aveva piantato una chiave `service_role` che
// l'audit non ha visto.
const IGNORATE = new Set(["node_modules", ".next", ".git", "dist", "build"]);

function argomenti(argv) {
  const args = { progetto: process.cwd(), dbUrl: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--progetto") args.progetto = argv[++i];
    else if (argv[i] === "--db-url") args.dbUrl = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

/** Tutti i sorgenti sotto `src/`, con il percorso relativo alla radice del
 *  progetto e le barre in avanti: le regole confrontano stringhe. */
export function fileSorgente(radice, cartella, raccolti = []) {
  if (!existsSync(cartella)) return raccolti;

  for (const voce of readdirSync(cartella)) {
    if (IGNORATE.has(voce)) continue;
    const pieno = join(cartella, voce);
    if (statSync(pieno).isDirectory()) {
      fileSorgente(radice, pieno, raccolti);
    } else if (ESTENSIONI.test(voce)) {
      raccolti.push({
        percorso: conBarre(relative(radice, pieno)),
        testo: readFileSync(pieno, "utf8"),
      });
    }
  }

  return raccolti;
}

function psqlDisponibile() {
  const p = spawnSync("psql", ["--version"], { encoding: "utf8" });
  return !p.error && p.status === 0;
}

function interroga(dbUrl, sql) {
  const res = spawnSync(
    "psql",
    [dbUrl, "-X", "-A", "-t", "-F", SEP, "-R", RS, "-c", sql],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error((res.stderr || "psql non ha risposto").trim());
  }
  return (res.stdout ?? "")
    .split(RS)
    .map((r) => r.replace(/\r?\n$/, ""))
    .filter((r) => r.length > 0)
    .map((r) => r.split(SEP).map((c) => c.replace(/\r/g, "")));
}

/** Il catalogo, o `null` con il motivo: senza, la regola sui permessi non gira
 *  e il gate lo dichiara verifica MANCANTE. Mai un audit che tace e sembra
 *  pulito. */
function leggiCatalogo(progetto, dbUrlEsplicito) {
  const configToml = join(progetto, "supabase", "config.toml");
  const dbUrl =
    dbUrlEsplicito ??
    (existsSync(configToml) ? urlDbProgetto(readFileSync(configToml, "utf8")) : null);

  if (!dbUrl) {
    return {
      catalogo: null,
      dbUrl: null,
      motivo:
        "database del progetto non risolvibile: manca `[db].port` in supabase/config.toml e non e' stato passato --db-url. Senza catalogo non si sa quali colonne il ruolo puo' scrivere, e la porta 54322 di default e' il progetto di qualcun altro",
    };
  }

  if (!psqlDisponibile()) {
    return { catalogo: null, dbUrl, motivo: "psql non disponibile nel PATH: permessi non verificati" };
  }

  try {
    const tabelle = interroga(
      dbUrl,
      `select c.relname, coalesce(c.relacl::text, '') from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
       order by c.relname`,
    );
    const colonne = interroga(
      dbUrl,
      `select c.relname, a.attname, coalesce(a.attacl::text, '') from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       where c.relnamespace = 'public'::regnamespace and a.attacl is not null
       order by c.relname, a.attname`,
    );
    return { catalogo: catalogoDaRighe(tabelle, colonne), dbUrl, motivo: null };
  } catch (errore) {
    return { catalogo: null, dbUrl, motivo: `psql: ${errore.message}` };
  }
}

export const CONTRATTO_AUDIT = 1;

function main() {
  const args = argomenti(process.argv.slice(2));
  const percorsoConfig = join(args.progetto, "gestionale.config.json");

  if (!existsSync(percorsoConfig)) {
    console.error(`gestionale.config.json assente in ${args.progetto}: l'audit non sa dove sia il gestionale.`);
    process.exit(2);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(percorsoConfig, "utf8"));
  } catch (errore) {
    console.error(`gestionale.config.json illeggibile: ${errore.message}`);
    process.exit(2);
  }

  const { errori } = validaConfig(config);
  if (errori.length > 0) {
    console.error(`gestionale.config.json incompleto:\n- ${errori.join("\n- ")}`);
    process.exit(2);
  }

  const files = fileSorgente(args.progetto, join(args.progetto, "src"));
  const { catalogo, dbUrl, motivo } = leggiCatalogo(args.progetto, args.dbUrl);
  const esito = auditAdmin({ files, config, catalogo });

  const documento = {
    contract: CONTRATTO_AUDIT,
    dbUrl,
    catalogo: catalogo === null ? { letto: false, motivo } : { letto: true, ruolo: catalogo.ruolo },
    summary: esito.summary,
    misure: esito.misure,
    findings: esito.findings,
  };

  if (args.json) {
    console.log(JSON.stringify(documento, null, 2));
  } else {
    stampa(documento, args.progetto);
  }

  process.exit(esito.summary.block === 0 ? 0 : 1);
}

// Si stampa SEMPRE cosa e' stato guardato, anche quando non c'e' niente da
// dire: un audit su meta' progetto non deve poter assomigliare a un audit
// completo (DECISIONI.md §11, la stessa garanzia di Schema Forge).
function stampa(doc, progetto) {
  console.log(`AUDIT GESTIONALE su ${conBarre(progetto)}`);
  console.log(
    `file letti: ${doc.misure.file} · rotte admin: ${doc.misure.rotte} · azioni server: ${doc.misure.azioni} · scritture: ${doc.misure.scritture}`,
  );
  console.log(
    doc.catalogo.letto
      ? `permessi letti da ${doc.dbUrl} per il ruolo ${doc.catalogo.ruolo}`
      : `PERMESSI NON LETTI — ${doc.catalogo.motivo}`,
  );
  console.log("");

  for (const gravita of ["block", "issue", "warn"]) {
    const gruppo = doc.findings.filter((f) => f.severity === gravita);
    if (gruppo.length === 0) continue;
    console.log(`${gravita.toUpperCase()} (${gruppo.length})`);
    for (const f of gruppo) {
      console.log(`- ${f.object}: ${f.message}`);
      if (f.hint) console.log(`    → ${f.hint}`);
    }
    console.log("");
  }

  const { block, issue, warn } = doc.summary;
  console.log(
    block === 0
      ? `AUDIT GESTIONALE: nessun bloccante (${issue} issue, ${warn} warn)`
      : `AUDIT GESTIONALE: ROSSO (${block} block, ${issue} issue, ${warn} warn)`,
  );
}

// eseguito come comando, non quando qualcun altro importa questo guscio.
// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un audit senza bloccanti.
// Qui e' peggio che altrove: 0 e' proprio il codice di «nessun bloccante», cioe'
// il silenzio si traveste da esito buono. Misurato il 2026-08-03 su questa
// macchina (Node 20.12.2, l'unico Node di sistema) in una cartella
// non-progetto — uscita 0, zero righe, dove Node 24.18.1 stampava il messaggio
// e usciva 2. Il confronto qui sotto funziona su qualunque Node.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
