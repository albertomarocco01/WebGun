/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * MOTORE ARCHETIPI (v1.0, fix concilio F4) — SHELL I/O della feature richiesta:
 * raggruppa i casi episodici che rappresentano la STESSA problematica ad alto livello
 * e ne distilla un ARCHETIPO (problema generale + classe di causa + strategia canonica);
 * i casi singoli restano linkati come ESEMPI (`member_case_ids`). Il clustering PURO è
 * in `./archetype-core`; qui: schema additivo, distillazione LLM del cluster, query FTS.
 *
 * INVARIANTI:
 *  - ADDITIVO: tabelle nuove (`archetypes` + `archetypes_fts`), nessuna delle 10
 *    congelate cambia. Init pigro su global (come `episodic_cases`).
 *  - COSTO LLM ⇒ OPT-IN: `maybeBuildArchetypes` è no-op salvo `BUGBAY_ARCHETYPES=1`,
 *    con throttle per-processo (non ricostruisce a ogni tick). Un progetto senza
 *    cluster ≥ soglia non fa NESSUNA chiamata LLM.
 *  - REBUILD-PER-PROGETTO (anti-drift): il concilio ha avvisato sull'instabilità dei
 *    cluster. Evitata trattando il build come RICOSTRUZIONE deterministica: si
 *    cancellano gli archetipi del progetto e si ricreano dai cluster correnti (stesso
 *    input → stesso output). Niente versioning incrementale fragile.
 *  - BEST-EFFORT: al confine ogni errore è inghiottito (non deve rompere un tick).
 *  - GUARDIA CONTAMINAZIONE: opera su `reformulated` (già INGLESE) — coerente con l'FTS.
 *
 * @indice
 * - queryArchetypes      → recupero FTS5 BM25 degli archetipi (read-only, per il retrieval)
 * - buildArchetypes      → (ri)costruisce gli archetipi per uno/tutti i progetti (LLM)
 * - maybeBuildArchetypes → build SOLO se abilitato + throttle scaduto (per i tick)
 */

import { openHubDb, transact } from './hub';
import type { SqliteDatabase } from './sqlite';
import { clusterCases, type ClusterInput } from './archetype-core';
import { resolveKeys, extractJson } from './run-context';
import { callAnthropic } from './anthropic';
import { callGemini } from './gemini';
import { callDeepseek } from './deepseek';
import { runHeadless } from './claude';
import { chooseModel } from './routing';

export interface ArchetypeRow {
  id: string;
  project_id: string | null;
  title: string;
  problem_class: string | null;
  canonical_strategy: string | null;
  member_case_ids: string; // JSON array
  member_count: number;
  created_at: string;
}

export interface ArchetypeMatch {
  archetype: ArchetypeRow;
  bm25: number;
}

const ARCHETYPE_SCHEMA = `
CREATE TABLE IF NOT EXISTS archetypes (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT,
  title              TEXT NOT NULL,
  problem_class      TEXT,
  canonical_strategy TEXT,
  member_case_ids    TEXT NOT NULL,
  member_count       INTEGER NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS archetypes_project_idx ON archetypes (project_id);

CREATE VIRTUAL TABLE IF NOT EXISTS archetypes_fts USING fts5(
  archetype_id UNINDEXED,
  title,
  problem_class,
  tokenize = 'porter unicode61'
);
`;

const ga = global as unknown as { __bugbay_archetypes_inited__?: boolean };
function ensureSchema(db: SqliteDatabase): void {
  if (ga.__bugbay_archetypes_inited__) return;
  db.exec(ARCHETYPE_SCHEMA);
  ga.__bugbay_archetypes_inited__ = true;
}

function tableExists(db: SqliteDatabase, name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

function cap(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// Costruisce una MATCH FTS5 sicura (stessa tecnica di episodic.ftsMatch): token
// alfanumerici quotati in OR; neutralizza la sintassi FTS5 dell'input. '' → salta.
function ftsMatch(raw: string): string {
  const tokens = (raw.match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1).slice(0, 32);
  if (tokens.length === 0) return '';
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
}

/**
 * Recupero FTS5 BM25 degli archetipi (read-only). `query` DEVE essere inglese
 * (guardia contaminazione). Filtra per progetto (come i casi episodici: F2) e
 * ordina per rilevanza. Best-effort: su qualunque errore → [].
 */
export function queryArchetypes(query: string, projectId?: string | null, limit = 2): ArchetypeMatch[] {
  try {
    const db = openHubDb();
    ensureSchema(db);
    const match = ftsMatch(query);
    if (!match) return [];
    const clauses = ['archetypes_fts MATCH ?'];
    const params: unknown[] = [match];
    if (projectId != null && projectId !== '') {
      clauses.push('(a.project_id = ? OR a.project_id IS NULL)');
      params.push(projectId);
    }
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT a.id, a.project_id, a.title, a.problem_class, a.canonical_strategy,
                a.member_case_ids, a.member_count, a.created_at,
                bm25(archetypes_fts) AS bm25
           FROM archetypes_fts
           JOIN archetypes a ON a.id = archetypes_fts.archetype_id
          WHERE ${clauses.join(' AND ')}
          ORDER BY bm25 ASC
          LIMIT ?`,
      )
      .all(...params) as (ArchetypeRow & { bm25: number })[];
    return rows.map(({ bm25, ...row }) => ({ archetype: row as ArchetypeRow, bm25 }));
  } catch {
    return [];
  }
}

// System prompt della distillazione dell'archetipo (SOLO JSON, inglese).
const ARCH_SYS =
  'You are a senior engineer distilling a GROUP of related bug-fix cases into ONE reusable ' +
  'high-level archetype. Return ONLY a JSON object: {"title": string (<=80 chars, the high-level ' +
  'problem, not a single case), "problem_class": string (the underlying cause category), ' +
  '"canonical_strategy": string (the general fix approach that applies across the cases)}. ' +
  'No markdown, no preamble. If the cases are NOT actually the same high-level problem, return ' +
  '{"reject": true}.';

interface DistilledArchetype {
  title: string;
  problem_class: string | null;
  canonical_strategy: string | null;
}

/** Distilla un cluster di testi `reformulated` in un archetipo via LLM (scala di
 *  fallback del giudice). Ritorna null se rifiutato/errore/vuoto. MAI throw. */
async function distillArchetype(reformulateds: string[]): Promise<DistilledArchetype | null> {
  const prompt =
    `The following ${reformulateds.length} bug-fix cases were grouped as likely the same high-level problem. ` +
    `Distill their shared archetype, or reject if they are unrelated.\n\n` +
    reformulateds.map((r, i) => `Case ${i + 1}: ${cap(r, 500)}`).join('\n');
  try {
    const keys = resolveKeys();
    let text: string | null = null;
    if (keys.anthropic) text = await callAnthropic(keys.anthropic, prompt, ARCH_SYS, 'archetype');
    else if (keys.provider === 'gemini' && keys.gemini) text = await callGemini(keys.gemini, prompt, ARCH_SYS, false, 'archetype');
    else if (keys.provider === 'deepseek' && keys.deepseek) text = await callDeepseek(keys.deepseek, prompt, ARCH_SYS, false, 'archetype');
    else if (keys.gemini) text = await callGemini(keys.gemini, prompt, ARCH_SYS, false, 'archetype');
    else if (keys.deepseek) text = await callDeepseek(keys.deepseek, prompt, ARCH_SYS, false, 'archetype');
    else {
      const r = await runHeadless({ prompt, model: chooseModel({ phase: 'giudice' }), runId: 'archetype', timeoutMs: 120_000, textMode: { systemPrompt: ARCH_SYS } });
      text = r.ok ? r.text : null;
    }
    if (!text || !text.trim()) return null;
    const parsed = extractJson(text) as Record<string, unknown> | null;
    if (!parsed || parsed.reject === true) return null;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (!title) return null;
    return {
      title: cap(title, 80),
      problem_class: typeof parsed.problem_class === 'string' ? cap(parsed.problem_class, 200) : null,
      canonical_strategy: typeof parsed.canonical_strategy === 'string' ? cap(parsed.canonical_strategy, 600) : null,
    };
  } catch {
    return null;
  }
}

/** Righe {id, reformulated} dei casi episodici di un progetto (per il clustering). */
function casesForProject(db: SqliteDatabase, projectId: string | null): ClusterInput[] {
  const rows = projectId == null
    ? db.prepare('SELECT id, reformulated FROM episodic_cases WHERE project_id IS NULL').all()
    : db.prepare('SELECT id, reformulated FROM episodic_cases WHERE project_id = ?').all(projectId);
  return (rows as { id: string; reformulated: string }[]).map((r) => ({ id: r.id, reformulated: r.reformulated }));
}

/** Elenco dei project_id distinti presenti nei casi episodici (incluso NULL). */
function distinctProjects(db: SqliteDatabase): (string | null)[] {
  const rows = db.prepare('SELECT DISTINCT project_id FROM episodic_cases').all() as { project_id: string | null }[];
  return rows.map((r) => r.project_id);
}

/** Cancella e reinserisce gli archetipi di UN progetto (rebuild deterministico). */
function replaceArchetypes(
  db: SqliteDatabase,
  projectId: string | null,
  built: { d: DistilledArchetype; members: string[] }[],
): void {
  const hasFts = tableExists(db, 'archetypes_fts');
  const now = new Date().toISOString();
  transact((tdb) => {
    // Rimuovi gli archetipi esistenti del progetto (+ righe FTS).
    const olds = (projectId == null
      ? tdb.prepare('SELECT id FROM archetypes WHERE project_id IS NULL').all()
      : tdb.prepare('SELECT id FROM archetypes WHERE project_id = ?').all(projectId)) as { id: string }[];
    const delA = tdb.prepare('DELETE FROM archetypes WHERE id = ?');
    const delF = hasFts ? tdb.prepare('DELETE FROM archetypes_fts WHERE archetype_id = ?') : null;
    for (const { id } of olds) { delA.run(id); if (delF) delF.run(id); }

    const insA = tdb.prepare(
      `INSERT INTO archetypes (id, project_id, title, problem_class, canonical_strategy, member_case_ids, member_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insF = hasFts
      ? tdb.prepare('INSERT INTO archetypes_fts (archetype_id, title, problem_class) VALUES (?, ?, ?)')
      : null;
    let i = 0;
    for (const { d, members } of built) {
      // Id deterministico per (progetto, indice) → rebuild stabile. Prefissi STRUTTURALMENTE
      // distinti per il bucket null vs un progetto reale: senza, un progetto chiamato
      // letteralmente "general" collideva col sentinel del null (PK conflict → rollback →
      // abort dell'intero batch). 'p-' prefissa sempre i progetti reali, 'null' il bucket null.
      const bucket = projectId == null ? 'null' : `p-${projectId}`;
      const id = `arch-${bucket}-${i++}`;
      insA.run(id, projectId, d.title, d.problem_class, d.canonical_strategy, JSON.stringify(members), members.length, now);
      if (insF) insF.run(id, d.title, d.problem_class ?? '');
    }
  });
}

/**
 * (Ri)costruisce gli archetipi. Se `projectId` è dato, solo quel progetto; altrimenti
 * tutti i progetti distinti. Per ognuno: clusterizza i casi episodici, distilla ogni
 * cluster via LLM (i rifiutati sono scartati), poi RICOSTRUISCE la tabella del
 * progetto. Ritorna il numero di archetipi creati. Best-effort: mai un throw.
 */
export async function buildArchetypes(projectId?: string | null): Promise<number> {
  try {
    const db = openHubDb();
    ensureSchema(db);
    if (!tableExists(db, 'episodic_cases')) return 0;
    const projects = projectId !== undefined ? [projectId] : distinctProjects(db);
    let created = 0;
    for (const pid of projects) {
      // try/catch PER-PROGETTO: il fallimento di un progetto (es. conflitto/IO) non
      // deve abortire il build degli ALTRI (prima l'errore usciva dal loop e l'intero
      // batch ritornava 0, perdendo silenziosamente i progetti successivi).
      try {
        const clusters = clusterCases(casesForProject(db, pid));
        const built: { d: DistilledArchetype; members: string[] }[] = [];
        for (const members of clusters) {
          const texts = members
            .map((id) => (db.prepare('SELECT reformulated FROM episodic_cases WHERE id = ?').get(id) as { reformulated: string } | undefined)?.reformulated)
            .filter((t): t is string => typeof t === 'string' && t.length > 0)
            .slice(0, 8);
          if (texts.length < 3) continue;
          const d = await distillArchetype(texts);
          if (d) built.push({ d, members });
        }
        replaceArchetypes(db, pid, built);
        created += built.length;
      } catch (e) {
        console.error('[bugbay] archetypes build (progetto):', e);
      }
    }
    return created;
  } catch {
    return 0;
  }
}

// ── Trigger gated per i tick (flag + throttle per-processo) ──────────────────
const gt = global as unknown as { __bugbay_archetypes_last__?: number };
/** Intervallo minimo tra due build (ms): non ricostruisce a ogni tick. Default 1h. */
const BUILD_THROTTLE_MS = 60 * 60 * 1000;

/** true se il motore archetipi è abilitato (OPT-IN esplicito: costa LLM). */
export function archetypesEnabled(): boolean {
  return process.env.BUGBAY_ARCHETYPES === '1';
}

/**
 * Build SOLO se abilitato E se il throttle è scaduto (chiamabile da un tick di loop).
 * ponytail: throttle su global in-processo (si resetta al restart) — sufficiente a
 * non spendere LLM a ogni minuto; se servisse durabilità, persistere come consolidation_log.
 * Best-effort: mai un throw.
 */
export async function maybeBuildArchetypes(): Promise<number> {
  if (!archetypesEnabled()) return 0;
  const now = Date.now();
  if (gt.__bugbay_archetypes_last__ && now - gt.__bugbay_archetypes_last__ < BUILD_THROTTLE_MS) return 0;
  gt.__bugbay_archetypes_last__ = now;
  return buildArchetypes();
}
