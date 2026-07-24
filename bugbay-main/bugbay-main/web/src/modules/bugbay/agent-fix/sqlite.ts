/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Apertura di un database SQLite locale in modalità WAL usando la STDLIB di Node
 * (`node:sqlite`, DatabaseSync — Node ≥ 22.13 senza flag). Nessuna dipendenza
 * nativa da compilare.
 *
 * INVARIANTE v0.6 (Wave 0): NESSUN fallback silenzioso. Un guasto di storage
 * DEVE emergere RUMOROSO, non degradare in silenzio a un backend JSON con stato
 * stantio. `openWalDatabase` quindi NON ritorna più `null`: se `node:sqlite` non
 * c'è (Node < 22.13) o il file non si apre, LANCIA. Il contratto della spina
 * (`hub.ts`) pretende Node ≥ 22.13: `assertNodeVersion` è il gate hard-fail.
 *
 * @indice
 * - SqliteDatabase    → tipo minimo del db (node:sqlite non è tipizzato qui)
 * - assertNodeVersion → hard-fail su Node < 22.13 (node:sqlite/DatabaseSync stabile)
 * - openWalDatabase   → apre un .sqlite in WAL + FK ON, o LANCIA (mai null)
 * - transact          → esegue una fn dentro BEGIN/COMMIT (ROLLBACK su errore)
 */

export interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}
export interface SqliteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): SqliteRunResult;
}
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
}

import { createRequire } from 'node:module';

/** `require` a runtime non analizzabile dal bundler (node:sqlite resta esterno). */
function runtimeRequire(name: string): unknown {
  // 1) CJS (bundle server di Next): `require` globale. eval così il bundler non
  //    risolve `name` come dipendenza (node:sqlite resta esterno).
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as ((id: string) => unknown) | undefined;
    if (typeof req === 'function') return req(name);
  } catch { /* nessun require in scope: prova ESM sotto */ }
  // 2) ESM (runner nativo `node --test`, runtime ESM puro): niente `require` in
  //    scope. `node:sqlite` è un BUILTIN → la base-path di createRequire è
  //    irrilevante alla risoluzione; uso cwd per non dipendere da import.meta
  //    (vietato in eval e assente in CJS).
  try {
    return createRequire(process.cwd() + '/noop.js')(name);
  } catch { /* né CJS né ESM risolvibile */ }
  return null;
}

/**
 * Gate hard-fail sulla versione di Node. La spina v0.6 usa `node:sqlite`
 * DatabaseSync, stabile e senza flag solo da Node ≥ 22.13. Chiamata all'apertura
 * di qualsiasi DB e all'avvio del daemon: meglio un errore chiaro subito che un
 * `Cannot find module 'node:sqlite'` più a valle.
 */
export function assertNodeVersion(): void {
  const parts = process.versions.node.split('.').map((n) => Number(n));
  const maj = parts[0] ?? 0;
  const min = parts[1] ?? 0;
  const ok = maj > 22 || (maj === 22 && min >= 13);
  if (!ok) {
    throw new Error(
      `[bugbay] Node ${process.versions.node} non supportato: serve >=22.13 ` +
        `(node:sqlite DatabaseSync stabile, richiesto dalla spina hub.sqlite). Aggiorna Node.`,
    );
  }
}

/**
 * Apre un DB SQLite in WAL + foreign_keys ON via `node:sqlite`.
 * HARD-FAIL: lancia se Node < 22.13, se `node:sqlite` manca o se il file non si
 * apre — nessun ritorno `null`, nessun degrade silenzioso a JSON.
 */
export function openWalDatabase(file: string): SqliteDatabase {
  assertNodeVersion();
  const mod = runtimeRequire('node:sqlite') as
    | { DatabaseSync?: new (p: string) => SqliteDatabase }
    | null;
  if (!mod?.DatabaseSync) {
    throw new Error(
      `[bugbay] node:sqlite/DatabaseSync non disponibile su Node ${process.versions.node}. ` +
        `Storage non inizializzabile (nessun fallback JSON: v0.6 richiede la spina SQLite).`,
    );
  }
  const db = new mod.DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // La spina è scritta da DUE processi (daemon sidecar + server Next). Senza
  // busy_timeout il default è 0 → SQLITE_BUSY immediato alla prima contesa sul
  // write-lock. Con timeout SQLite ATTENDE il lock invece di fallire subito.
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

/** Errore di lock SQLite, ritentabile (contesa multi-processo sul write-lock). */
function isBusyError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /SQLITE_BUSY|database is locked|database table is locked|snapshot/i.test(m);
}

/**
 * Esegue `fn` dentro una transazione (node:sqlite non ha l'helper di better-sqlite3).
 * `BEGIN IMMEDIATE` prende SUBITO il write-lock: niente read-snapshot da invalidare,
 * quindi nessun SQLITE_BUSY_SNAPSHOT sull'upgrade read→write dei pattern
 * read-modify-write (store.ts) sotto contesa daemon+Next. `busy_timeout` fa attendere
 * il lock; il retry (≤3) copre il residuo raro. ROLLBACK + rethrow su errore non-lock:
 * comportamento invariato.
 */
export function transact<T>(db: SqliteDatabase, fn: () => T): T {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      db.exec('BEGIN IMMEDIATE');
    } catch (e) {
      lastErr = e;
      if (isBusyError(e)) continue; // lock non ottenuto entro busy_timeout: ritenta
      throw e;
    }
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* già annullata */ }
      lastErr = e;
      if (isBusyError(e)) continue;
      throw e;
    }
  }
  throw lastErr;
}
