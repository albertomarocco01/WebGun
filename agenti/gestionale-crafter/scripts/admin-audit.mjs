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
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditAdmin, catalogoDaRighe, conBarre } from "./audit-lib.mjs";
import { argomentiOstiliACmd, formaEseguibile, motivoOstile, motivoScaduto, risolviEseguibile, scaduto } from "./eseguibili.mjs";
import { urlDbProgetto, validaConfig } from "./progetto-lib.mjs";

const SEP = "\x1f";
const RS = "\x1e";
// I limiti: una query sul catalogo dei permessi non dura minuti, e un database
// che non risponde non e' lento — e' assente (referto § M14).
const LIMITE_PSQL = 60_000;
const LIMITE_CONNESSIONE = 10_000;
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

// `psql` si risolve UNA volta, col percorso pieno e senza guardare la directory
// corrente — che quando l'audit e' lanciato dal gate e' la radice del progetto
// AUDITATO. Col nome nudo, un `psql.exe` piantato li' deciderebbe cosa questo
// audit legge dal catalogo dei permessi (referto § C1, misurato il 2026-08-06
// copiando `hostname.exe` in `psql.exe`: `spawnSync("psql", …)` eseguiva la
// copia). La radice auditata e' `--progetto`, non la CWD: si passa da fuori.
let psql = { file: null, prefisso: [] };
let psqlRifiutati = [];

function risolviPsql(radiceAuditata) {
  const { percorso, rifiutati } = risolviEseguibile("psql", radiceAuditata);
  psqlRifiutati = rifiutati;
  psql = formaEseguibile("psql", () => percorso);
}

function psqlDisponibile() {
  if (psql.file === null) return false;
  const p = spawnSync(psql.file, [...psql.prefisso, "--version"], {
    encoding: "utf8", timeout: 15_000, killSignal: "SIGKILL",
  });
  return !p.error && p.status === 0;
}

function interroga(dbUrl, sql) {
  const argomenti = [dbUrl, "-X", "-A", "-t", "-F", SEP, "-R", RS, "-c", sql];
  // Attraverso uno shim `.cmd` si passa da `cmd.exe /c`, che E' una shell: qui
  // gli argomenti sono l'SQL intero e i separatori di campo, e ci arriverebbero
  // diversi da come sono scritti — il catalogo dei permessi risulterebbe un
  // altro (referto § H1/H2/L1). Meglio nessun catalogo di un catalogo altrui:
  // `leggiCatalogo` lo trasforma in «permessi non letti», cioe' MANCANTE.
  if (psql.prefisso.length > 0) {
    const ostili = argomentiOstiliACmd(argomenti);
    if (ostili.length > 0) throw new Error(motivoOstile(ostili));
  }
  const res = spawnSync(
    psql.file,
    [...psql.prefisso, ...argomenti],
    {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      // IL LIMITE (referto § M14): contro un socket che accetta la connessione e
      // non parla, un audit senza limite resta appeso finche' qualcuno non lo
      // uccide. `PGCONNECT_TIMEOUT` taglia prima il caso piu' comune (il
      // database che non c'e'); il `timeout` copre anche la query che non torna.
      timeout: LIMITE_PSQL, killSignal: "SIGKILL",
      env: { ...process.env, PGCONNECT_TIMEOUT: String(Math.round(LIMITE_CONNESSIONE / 1000)) },
    },
  );
  if (scaduto(res)) throw new Error(motivoScaduto("psql (catalogo dei permessi)", LIMITE_PSQL));
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
    const rifiutato = psqlRifiutati.length === 0 ? "" :
      ` — trovato DENTRO il progetto auditato (${psqlRifiutati.join(", ")}) e rifiutato: un progetto non sceglie il binario che lo giudica`;
    return { catalogo: null, dbUrl, motivo: `psql non disponibile nel PATH: permessi non verificati${rifiutato}` };
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
  risolviPsql(resolve(args.progetto));
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
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e questo guscio usciva 0 muto, cioe' di nuovo
// «nessun bloccante» (misurato il 2026-08-04 sui cinque gate, P.4-pre
// `PILOTA-PRE-2026-08-04.md` §2b, e su questo stesso file nell'istruttoria di
// P.0-igiene-2). `realpathSync` scioglie la junction; se solleva si ricade sul
// confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
