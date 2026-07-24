/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Client locale Supabase-compatibile per lo sviluppo offline di BUG BAY: replica
 * il SOTTOINSIEME del query-builder di supabase-js usato dal modulo
 * (from/select/insert/update/upsert/delete + eq/neq/in/order/single) sulle
 * tabelle note (debug_reports, debug_checklist, projects, audits, ...).
 * Persistenza su SQLite locale via la STDLIB di Node (`node:sqlite`, WAL) —
 * condivisa con l'helper `agent-fix/sqlite`. NB: DB SEPARATO dalla spina
 * `hub.sqlite` (dati report/checklist di sviluppo, non stato run).
 *
 * INVARIANTE v0.6 (Wave 0): NESSUN fallback JSON silenzioso. Se lo storage non si
 * apre, `openWalDatabase` LANCIA (hard-fail) invece di degradare a un file JSON
 * con stato potenzialmente stantio.
 *
 * @indice
 * - createLocalClient → factory del client locale (duck-type del client Supabase)
 * - localDbInfo       → backend attivo e percorso del DB (per la diagnostica)
 */

import { openWalDatabase, transact, type SqliteDatabase } from '../agent-fix/sqlite';
import fs from 'fs';
import path from 'path';
import os from 'os';

type Row = Record<string, unknown>;
type FilterKind = 'eq' | 'neq' | 'in' | 'is';
interface Filter { kind: FilterKind; col: string; val: unknown }
interface QueryResult { data: unknown; error: { message: string; code?: string } | null }

/** Colonne note per tabella: i payload vengono ristretti a queste (difensivo). */
const KNOWN_COLUMNS: Record<string, string[]> = {
  // Registro dei progetti (hub multi-progetto): rispecchia la tabella `projects`
  // di Supabase così il DB locale di sviluppo funziona con la stessa dimensione.
  projects: ['id', 'name', 'repo_path', 'created_at', 'last_seen_at'],
  debug_reports: [
    'id', 'project_id', 'category', 'priority', 'area', 'sub_area', 'url', 'notes',
    // Testo grezzo del segnalatore, conservato quando l'auto-riformulazione AI
    // riscrive `notes` (workflow di default all'ingest).
    'notes_original',
    'reporter_name', 'status', 'developer', 'created_at', 'resolved_at', 'resolution_notes',
    // Allegati (Attachment[]): su Supabase è una colonna jsonb, qui sul DB locale
    // viene salvato come stringa JSON (l'API fa JSON.stringify/JSON.parse) su TEXT.
    'attachments',
  ],
  debug_checklist: ['id', 'status', 'note', 'developer', 'updated_at'],
  // Voci della checklist QA generate da Refresh-with-AI (definizione + stato review
  // sulla stessa riga). I campi `files`/`urls`/`badges` sono array/oggetti: su
  // Supabase reale sono colonne `jsonb`, qui sul DB locale vengono salvati come
  // stringhe JSON (l'API fa JSON.stringify in scrittura / JSON.parse in lettura),
  // e il backend locale memorizza tutto come TEXT — quindi il round-trip funziona.
  debug_checklist_items: [
    'id', 'project_id', 'section_title', 'section_order', 'label', 'descr',
    'files', 'urls', 'badges', 'priority', 'status', 'note', 'is_new',
    'created_at', 'updated_at',
  ],
  // Audit schedulati (cron in-process del daemon): configurazioni + esiti.
  // `scope_globs`/`report_ids` sono array salvati come stringhe JSON su TEXT.
  audits: [
    'id', 'project_id', 'nome', 'schedule', 'tipo', 'focus', 'scope_globs',
    'profondita', 'model', 'create_reports', 'enabled', 'created_at', 'last_run_at',
  ],
  audit_runs: [
    'id', 'audit_id', 'started_at', 'finished_at', 'status', 'report',
    'findings_count', 'report_ids', 'error',
  ],
};

interface Backend {
  kind: 'sqlite';
  read(table: string): Row[];
  write(table: string, rows: Row[]): void;
  file: string;
}

/**
 * Coerce un valore a un tipo accettato dal bind di node:sqlite
 * (null|number|bigint|string|Uint8Array): boolean → 1/0, oggetti/array → JSON.
 */
function toBindable(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function createSqliteBackend(dir: string): Backend {
  const file = path.join(dir, 'bugbay.sqlite');
  const db: SqliteDatabase = openWalDatabase(file); // hard-fail (WAL + FK già settati)
  for (const [table, cols] of Object.entries(KNOWN_COLUMNS)) {
    const defs = cols.map((c) => `"${c}" TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${defs}, PRIMARY KEY ("id"))`);
    // Migrazione additiva: aggiunge le colonne mancanti alle tabelle GIÀ esistenti
    // (es. project_id introdotto in F2). Senza, un INSERT che nomina la nuova
    // colonna fallirebbe su un DB creato con lo schema precedente (rompe tutte le
    // scritture). CREATE IF NOT EXISTS da solo non basta: la tabella esiste già.
    const present = new Set(
      (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((r) => r.name),
    );
    for (const c of cols) {
      if (!present.has(c)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${c}" TEXT`);
    }
  }
  return {
    kind: 'sqlite',
    file,
    read(table) {
      return db.prepare(`SELECT * FROM "${table}"`).all() as Row[];
    },
    write(table, rows) {
      const cols = KNOWN_COLUMNS[table];
      const insert = db.prepare(
        `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      );
      // Rimpiazzo atomico dell'intera tabella (DELETE + reinsert) in una transazione.
      transact(db, () => {
        db.exec(`DELETE FROM "${table}"`);
        for (const r of rows) {
          // node:sqlite accetta solo null|number|bigint|string|Uint8Array: i boolean
          // (es. debug_checklist_items.is_new) diventano 1/0, eventuali oggetti/array
          // residui vengono serializzati (le colonne sono TEXT). mapItemRow rilegge 1/0.
          insert.run(...cols.map((c) => toBindable(r[c])));
        }
      });
    },
  };
}

let _backend: Backend | undefined;
function backend(): Backend {
  if (_backend) return _backend;
  // MACHINE-SCOPED (come la spina hub.sqlite): UN SOLO db segnalazioni/checklist per
  // tutta la macchina, non uno per cartella. Le tabelle sono già taggate per
  // `project_id` (hub multi-progetto) e gli handler filtrano via scopeFilter, quindi
  // condividere un file è il modello INTESO (come Supabase). Così la console gira DA
  // QUALSIASI cwd e in --hub vede le segnalazioni di TUTTI i progetti; i widget dei
  // vari progetti che postano all'unico daemon finiscono tutti qui. Prima era
  // targetRoot()/.bugbay-local-db → un db diverso per cwd = segnalazioni sparse,
  // invisibili alla console centrale. BUGBAY_HUB_DIR override (sandbox/test).
  const hubRoot = process.env.BUGBAY_HUB_DIR
    ? path.resolve(process.env.BUGBAY_HUB_DIR)
    : path.join(os.homedir(), '.bugbay');
  const dir = path.join(hubRoot, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  _backend = createSqliteBackend(dir); // hard-fail: nessun fallback JSON
  // Nota one-shot in console (dev): rende esplicito quale backend è in uso.
  console.log(`[bugbay] DB locale di sviluppo · backend=${_backend.kind} · ${_backend.file}`);
  return _backend;
}

export function localDbInfo(): { kind: string; file: string } {
  const b = backend();
  return { kind: b.kind, file: b.file };
}

/** Query builder chainable e "thenable": esegue alla `await`. */
class LocalQuery implements PromiseLike<QueryResult> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private filters: Filter[] = [];
  private payload: Row[] = [];
  private patch: Row = {};
  private singleFlag = false;
  private orderBy?: { col: string; ascending: boolean };

  constructor(private readonly table: string) {}

  select(_cols?: string): this { this.op = 'select'; return this; }
  insert(rows: Row | Row[]): this { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch: Row): this { this.op = 'update'; this.patch = patch; return this; }
  delete(): this { this.op = 'delete'; return this; }
  upsert(rows: Row | Row[]): this { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }

  eq(col: string, val: unknown): this { this.filters.push({ kind: 'eq', col, val }); return this; }
  neq(col: string, val: unknown): this { this.filters.push({ kind: 'neq', col, val }); return this; }
  in(col: string, vals: unknown[]): this { this.filters.push({ kind: 'in', col, val: vals }); return this; }
  is(col: string, val: unknown): this { this.filters.push({ kind: 'is', col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }): this { this.orderBy = { col, ascending: opts?.ascending !== false }; return this; }
  single(): this { this.singleFlag = true; return this; }

  private cols(): string[] { return KNOWN_COLUMNS[this.table] ?? []; }
  private pick(r: Row): Row {
    const o: Row = {};
    for (const c of this.cols()) if (c in r) o[c] = r[c];
    return o;
  }
  private match(r: Row): boolean {
    return this.filters.every((f) => {
      if (f.kind === 'eq') return r[f.col] === f.val;
      if (f.kind === 'neq') return r[f.col] !== f.val;
      // `is`: confronto null-safe (colonna assente o null → null), come `.is(col, null)` di Supabase.
      if (f.kind === 'is') return (r[f.col] ?? null) === f.val;
      return Array.isArray(f.val) && (f.val as unknown[]).includes(r[f.col]);
    });
  }

  private run(): QueryResult {
    const b = backend();
    try {
      if (this.op === 'select') {
        let rows = b.read(this.table).filter((r) => this.match(r));
        if (this.orderBy) {
          const { col, ascending } = this.orderBy;
          const dir = ascending ? 1 : -1;
          rows = [...rows].sort((a, x) => {
            const av = a[col] as string; const xv = x[col] as string;
            return (av > xv ? 1 : av < xv ? -1 : 0) * dir;
          });
        }
        if (this.singleFlag) {
          if (rows.length === 1) return { data: rows[0], error: null };
          return { data: null, error: { message: `Expected one row, got ${rows.length}`, code: 'PGRST116' } };
        }
        return { data: rows, error: null };
      }
      if (this.op === 'insert') {
        const rows = b.read(this.table);
        for (const p of this.payload) rows.push(this.pick(p));
        b.write(this.table, rows);
        return { data: this.payload, error: null };
      }
      if (this.op === 'update') {
        const rows = b.read(this.table);
        const patch = this.pick(this.patch);
        for (const r of rows) if (this.match(r)) Object.assign(r, patch);
        b.write(this.table, rows);
        return { data: null, error: null };
      }
      if (this.op === 'delete') {
        const rows = b.read(this.table).filter((r) => !this.match(r));
        b.write(this.table, rows);
        return { data: null, error: null };
      }
      // upsert: chiave su id (PK di entrambe le tabelle)
      const rows = b.read(this.table);
      const byId = new Map<unknown, Row>(rows.map((r) => [r.id, r]));
      for (const p of this.payload) {
        const row = this.pick(p);
        byId.set(row.id, { ...(byId.get(row.id) ?? {}), ...row });
      }
      b.write(this.table, [...byId.values()]);
      return { data: this.payload, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }

  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((v: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    try {
      const res = this.run();
      return Promise.resolve(onfulfilled ? onfulfilled(res) : (res as unknown as R1));
    } catch (e) {
      return onrejected ? Promise.resolve(onrejected(e)) : Promise.reject(e);
    }
  }
}

/** Client locale: espone solo `.from(table)`, sufficiente per il modulo. */
export function createLocalClient(): { from: (table: string) => LocalQuery } {
  return { from: (table: string) => new LocalQuery(table) };
}
