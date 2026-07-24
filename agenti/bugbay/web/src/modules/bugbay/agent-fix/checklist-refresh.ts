/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Orchestrazione del "Refresh-with-AI" della Campagna QA: legge le modifiche git
 * dall'ultimo refresh (commit + file toccati + diff troncato), chiede all'LLM del
 * provider corrente di elencare le cose DA VERIFICARE raggruppate per area, e
 * fa il MERGE con le voci già presenti su DB preservando lo stato di review
 * (status/note). Solo testo: non modifica file. I metadati dell'ultimo refresh
 * (sha/timestamp/base) vivono nella riga speciale debug_checklist['__refresh_meta'].
 *
 * @indice
 * - CHECKLIST_ITEMS_TABLE / REFRESH_META_ID → costanti del data layer
 * - ItemDbRow / parseJsonField / mapItemRow → mapping riga DB ↔ dominio (riusati dall'API)
 * - resolveBase   → riferimento git da cui diffare (esplicito | lastRefreshSha | tag | HEAD~50)
 * - refreshChecklist → pipeline completa: range git → LLM → merge → persist
 */

import { targetRoot } from './target-root';
import { spawnSync } from 'child_process';
import type { ChecklistItemRow, ChecklistMeta, RevisioneBadge, ChecklistUrl } from '@/modules/bugbay/data/revisione-checklist';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { projectId, scopeId } from '@/modules/bugbay/lib/project';
import * as git from './git';
import { resolveKeys, extractJson, fileToArea } from './run-context';
import { runHeadless, MODEL_HAIKU } from './claude';
import { callGemini } from './gemini';
import { callDeepseek } from './deepseek';
import { callAnthropic } from './anthropic';

/** Tabella dedicata delle voci di checklist (definizione + stato review). */
export const CHECKLIST_ITEMS_TABLE = 'debug_checklist_items';
/** Riga speciale di debug_checklist che custodisce i metadati dell'ultimo refresh. */
export const REFRESH_META_ID = '__refresh_meta';

/** Budget caratteri del diff inviato all'LLM (~8000, contesto compatto). */
const DIFF_BUDGET = 8000;
/** Profondità massima del primo refresh quando non c'è né sha né tag. */
const DEFAULT_DEPTH = 50;

const SYSTEM_PROMPT =
  'Sei un revisore QA; dato il diff, elenca le cose DA VERIFICARE raggruppate per area. Rispondi SOLO con JSON valido.';

/* ── Tipi dell'output LLM (validati prima dell'uso) ─────────────────── */

interface LlmItem {
  key?: string; label?: string; desc?: string; files?: string[];
  urls?: { url?: string; label?: string }[]; badges?: string[]; priority?: string;
}
interface LlmSection { title?: string; subtitle?: string; items?: LlmItem[] }

/* ── Slug (id stabile per il merge) ─────────────────────────────────── */

/** Slug deterministico: minuscole, ASCII, separatore `-`, niente bordi sporchi. */
function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // diacritici combinanti
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ALLOWED_BADGES: ReadonlySet<RevisioneBadge> = new Set(['manual', 'ai', 'bugfix', 'critical']);

/** Normalizza i badge tenendo solo quelli ammessi dal tipo RevisioneBadge. */
function normBadges(raw: unknown): RevisioneBadge[] {
  if (!Array.isArray(raw)) return [];
  const out: RevisioneBadge[] = [];
  for (const b of raw) {
    if (typeof b === 'string' && ALLOWED_BADGES.has(b as RevisioneBadge) && !out.includes(b as RevisioneBadge)) {
      out.push(b as RevisioneBadge);
    }
  }
  return out;
}

/** Normalizza gli URL scartando le voci senza url. */
function normUrls(raw: unknown): ChecklistUrl[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistUrl[] = [];
  for (const u of raw as { url?: unknown; label?: unknown }[]) {
    if (u && typeof u.url === 'string' && u.url) {
      out.push({ url: u.url, label: typeof u.label === 'string' && u.label ? u.label : 'Apri' });
    }
  }
  return out;
}

/** Normalizza una lista di path stringa. */
function normFiles(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((f): f is string => typeof f === 'string' && f.length > 0) : [];
}

/* ── Risoluzione del range base..HEAD ───────────────────────────────── */

/**
 * Sottoinsieme tipizzato del query-builder Supabase (compatibile col client reale
 * e con quello locale di lib/local-db): thenable + chainable. Evita il cast `any`.
 * Esportato per riuso nell'API (un solo punto di verità per il client DB).
 */
export type DbResult = { data: unknown; error: { message: string } | null };
export interface DbQuery extends PromiseLike<DbResult> {
  select(cols?: string): DbQuery;
  insert(rows: unknown): DbQuery;
  upsert(rows: unknown): DbQuery;
  update(patch: unknown): DbQuery;
  delete(): DbQuery;
  eq(col: string, val: unknown): DbQuery;
  single(): DbQuery;
}
export interface DbClient {
  from(table: string): DbQuery;
}

/** Legge i metadati dell'ultimo refresh dalla riga __refresh_meta. */
async function readMeta(supabase: DbClient): Promise<ChecklistMeta> {
  const empty: ChecklistMeta = { lastRefreshSha: null, lastRefreshAt: null, base: null };
  try {
    const { data } = await supabase
      .from('debug_checklist')
      .select('id, note')
      .eq('id', scopeId(REFRESH_META_ID)) // riga meta per-progetto
      .single();
    const note = (data as { note?: string | null } | null)?.note;
    if (note) {
      const parsed = JSON.parse(note) as Partial<ChecklistMeta>;
      return {
        lastRefreshSha: parsed.lastRefreshSha ?? null,
        lastRefreshAt: parsed.lastRefreshAt ?? null,
        base: parsed.base ?? null,
      };
    }
  } catch {
    // riga assente / JSON corrotto → metadati vuoti
  }
  return empty;
}

/** Numero totale di commit raggiungibili da HEAD (per il clamp del primo refresh). */
function totalCommits(): number {
  const res = spawnSync('git', ['rev-list', '--count', 'HEAD'], {
    cwd: targetRoot(),
    encoding: 'utf-8',
    timeout: 20_000,
  });
  if (res.status !== 0) return 0;
  const n = parseInt((res.stdout ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Riferimento git da cui partire: esplicito dell'utente, altrimenti l'ultimo
 * refresh memorizzato (incrementale), altrimenti l'ultimo tag, altrimenti gli
 * ultimi ~50 commit. CLAMP: se i commit totali sono ≤ DEFAULT_DEPTH, `HEAD~50`
 * non risolverebbe (git: "unknown revision") → si usa la radice (HEAD~(N-1)).
 */
export async function resolveBase(explicit?: string): Promise<string> {
  if (explicit && explicit.trim()) return explicit.trim();

  const supabase = createAdminClient() as unknown as DbClient;
  const meta = await readMeta(supabase);
  if (meta.lastRefreshSha) return meta.lastRefreshSha;

  const tag = git.lastTag();
  if (tag) return tag;

  const total = totalCommits();
  // Repo con un solo commit: nessun padre → range vuoto su HEAD (niente crash).
  if (total === 1) return 'HEAD';
  // Con N commit il padre più lontano risolvibile è HEAD~(N-1) (il root commit).
  const depth = total > 1 ? Math.min(DEFAULT_DEPTH, total - 1) : DEFAULT_DEPTH;
  return `HEAD~${depth}`;
}

/* ── Costruzione del riassunto compatto ─────────────────────────────── */

/** Riassunto compatto del range: messaggi commit + file toccati + diff troncato. */
function buildSummary(base: string): string {
  const commits = git.commitsSince(base);
  const files = git.changedFilesSince(base);
  const diff = git.diffSummarySince(base, DIFF_BUDGET);
  const commitLines = commits.map((c) => `- ${c.sha} ${c.message}`).join('\n') || '(nessun commit nel range)';
  const fileLines = files.map((f) => `- ${f}`).join('\n') || '(nessun file modificato)';
  return (
    `RANGE: ${base}..HEAD\n\n` +
    `COMMIT (${commits.length}):\n${commitLines}\n\n` +
    `FILE MODIFICATI (${files.length}):\n${fileLines}\n\n` +
    `DIFF (troncato a ${DIFF_BUDGET} caratteri):\n${diff}`
  );
}

/** Istruzioni allegate al riassunto: schema d'uscita richiesto all'LLM. */
function buildPrompt(summary: string): string {
  return (
    `${summary}\n\n` +
    `Dato il diff qui sopra, elenca SOLO le cose nuove DA VERIFICARE prima di una release, ` +
    `raggruppate per area/feature. Per ogni voce indica i file coinvolti e, se deducibile, la rotta da aprire.\n\n` +
    `Rispondi SOLO con un oggetto JSON di questa forma esatta:\n` +
    `{\n` +
    `  "sections": [\n` +
    `    { "title": "<area/feature>", "subtitle": "<cosa è cambiato>",\n` +
    `      "items": [\n` +
    `        { "key": "<slug stabile: file+titolo>", "label": "<cosa verificare>",\n` +
    `          "desc": "<dettaglio>", "files": ["src/..."],\n` +
    `          "urls": [{"url":"/...","label":"Apri"}],\n` +
    `          "badges": ["ai"|"bugfix"|"critical"], "priority": "Bassa|Media|Alta|Urgente" }\n` +
    `      ] }\n` +
    `  ]\n` +
    `}`
  );
}

/* ── Chiamata LLM (provider corrente) ───────────────────────────────── */

/**
 * Esegue il prompt sul provider corrente e ritorna il JSON grezzo come testo.
 * REST (Gemini/DeepSeek jsonMode, Anthropic Haiku) se c'è una chiave; altrimenti
 * CLI headless in text-mode con Haiku (modellato su fastText/giudice in runner/esecuzione).
 */
async function callProvider(prompt: string): Promise<string> {
  const keys = resolveKeys();
  if (keys.provider === 'gemini') {
    if (!keys.gemini) throw new Error('Chiave API Gemini mancante (impostazioni o GEMINI_API_KEY).');
    return callGemini(keys.gemini, prompt, SYSTEM_PROMPT, true);
  }
  if (keys.provider === 'deepseek') {
    if (!keys.deepseek) throw new Error('Chiave API DeepSeek mancante (impostazioni o DEEPSEEK_API_KEY).');
    return callDeepseek(keys.deepseek, prompt, SYSTEM_PROMPT, true);
  }
  // claude-headless: fast-path REST (Haiku) se la chiave è configurata,
  // altrimenti la CLI headless in text-mode.
  if (keys.anthropic) return callAnthropic(keys.anthropic, prompt, SYSTEM_PROMPT);
  const res = await runHeadless({
    prompt,
    model: MODEL_HAIKU,
    timeoutMs: 120_000,
    textMode: { systemPrompt: SYSTEM_PROMPT },
  });
  if (!res.ok) throw new Error(res.error ?? 'Refresh checklist: chiamata LLM fallita.');
  return res.text;
}

/* ── Mapping LLM → righe candidate ──────────────────────────────────── */

/** Riga candidata generata da un refresh (senza stato review, ancora da mergere). */
interface CandidateRow {
  id: string;
  sectionTitle: string;
  sectionOrder: number;
  label: string;
  descr: string;
  files: string[];
  urls: ChecklistUrl[];
  badges: RevisioneBadge[];
  priority: string | null;
}

/**
 * Sezioni LLM → righe candidate con `id` STABILE per il merge: slug della `key`
 * dell'agente; in fallback slug(primo file + label) troncato a 80 caratteri. Gli
 * id duplicati nello stesso refresh sono resi unici con un suffisso numerico.
 */
function toCandidates(sections: LlmSection[]): CandidateRow[] {
  const out: CandidateRow[] = [];
  const seen = new Set<string>();

  sections.forEach((sec, sIdx) => {
    const sectionTitle = (sec.title ?? '').trim() || 'Generale';
    const items = Array.isArray(sec.items) ? sec.items : [];
    for (const it of items) {
      const label = (it.label ?? '').trim();
      if (!label) continue; // una voce senza label non è verificabile
      const files = normFiles(it.files);

      let id = it.key && it.key.trim() ? slug(it.key) : '';
      if (!id) id = slug(`${files[0] ?? sectionTitle}-${label}`).slice(0, 80);
      if (!id) id = slug(label).slice(0, 80) || `voce-${sIdx}-${out.length}`;

      // Garantisce l'unicità all'interno di QUESTO refresh (id duplicato → -2, -3…).
      let unique = id;
      let n = 2;
      while (seen.has(unique)) unique = `${id}-${n++}`;
      seen.add(unique);
      // Namespace per progetto: lo slug è deterministico e collide tra progetti nel
      // DB centrale; `<pid>::slug` rende la PK unica per progetto (no-op se legacy).
      unique = scopeId(unique);

      // URL: quelli proposti dall'LLM, in fallback la rotta derivata dal file.
      const urls = normUrls(it.urls);
      if (urls.length === 0 && files[0]) {
        const area = fileToArea(files[0]);
        if (area) urls.push({ url: area, label: 'Apri' });
      }

      out.push({
        id: unique,
        sectionTitle,
        sectionOrder: sIdx,
        label,
        descr: (it.desc ?? '').trim(),
        files,
        urls,
        badges: normBadges(it.badges),
        priority: typeof it.priority === 'string' && it.priority.trim() ? it.priority.trim() : null,
      });
    }
  });

  return out;
}

/* ── Lettura/scrittura righe DB (snake_case ↔ camelCase) ────────────── */

/** Riga di debug_checklist_items (snake_case). I campi JSON sono TEXT in locale, jsonb su Supabase. */
export interface ItemDbRow {
  id: string;
  section_title?: string | null;
  section_order?: number | null;
  label?: string | null;
  descr?: string | null;
  files?: string | null;
  urls?: string | null;
  badges?: string | null;
  priority?: string | null;
  status?: string | null;
  note?: string | null;
  is_new?: boolean | string | number | null;
}

/** Parsing difensivo di un campo JSON serializzato (DB locale: TEXT; Supabase: jsonb già oggetto). */
export function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Mappa una riga DB → ChecklistItemRow di dominio (camelCase). */
export function mapItemRow(r: ItemDbRow): ChecklistItemRow {
  const status = r.status === 'ok' || r.status === 'problema' ? r.status : null;
  const isNew = r.is_new === true || r.is_new === 'true' || r.is_new === 1;
  return {
    id: r.id,
    sectionTitle: r.section_title ?? '',
    sectionOrder: typeof r.section_order === 'number' ? r.section_order : Number(r.section_order ?? 0) || 0,
    label: r.label ?? '',
    descr: r.descr ?? '',
    files: parseJsonField<string[]>(r.files, []),
    urls: parseJsonField<ChecklistUrl[]>(r.urls, []),
    badges: parseJsonField<RevisioneBadge[]>(r.badges, []),
    priority: r.priority ?? null,
    status,
    note: r.note ?? null,
    isNew,
  };
}

/** Serializza una ChecklistItemRow → riga DB (array/oggetti come stringhe JSON). */
function toDbRow(row: ChecklistItemRow, now: string): Record<string, unknown> {
  return {
    id: row.id,
    project_id: projectId(), // tag del progetto (null se legacy); l'id è già scoped
    section_title: row.sectionTitle,
    section_order: row.sectionOrder,
    label: row.label,
    descr: row.descr,
    files: JSON.stringify(row.files),
    urls: JSON.stringify(row.urls),
    badges: JSON.stringify(row.badges),
    priority: row.priority,
    status: row.status,
    note: row.note,
    is_new: row.isNew,
    updated_at: now,
  };
}

async function readExistingItems(supabase: DbClient): Promise<ChecklistItemRow[]> {
  try {
    // Scope al progetto: nel DB centrale il merge/upsert deve toccare SOLO le righe
    // di questo progetto, altrimenti un refresh riscriverebbe le voci altrui.
    const pid = projectId();
    let q = supabase.from(CHECKLIST_ITEMS_TABLE).select('*');
    if (pid) q = q.eq('project_id', pid);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return (data as ItemDbRow[]).map(mapItemRow);
  } catch {
    return [];
  }
}

/* ── Pipeline pubblica ──────────────────────────────────────────────── */

/** Esito del refresh, allineato al contratto dell'API. */
export interface RefreshResult {
  items: ChecklistItemRow[];
  meta: ChecklistMeta;
  added: number;
  updated: number;
}

/**
 * Esegue un refresh completo:
 *  1. risolve il range base..HEAD;
 *  2. costruisce il riassunto compatto e interroga l'LLM;
 *  3. mappa le sezioni in righe candidate con id stabile;
 *  4. fa il MERGE con le righe esistenti (preserva status/note, marca is_new);
 *  5. persiste righe + metadati e ritorna lo stato aggiornato.
 */
export async function refreshChecklist(explicitBase?: string): Promise<RefreshResult> {
  const supabase = createAdminClient() as unknown as DbClient;
  const base = await resolveBase(explicitBase);

  const raw = await callProvider(buildPrompt(buildSummary(base)));

  const parsed = extractJson(raw);
  const sections = Array.isArray((parsed as { sections?: unknown })?.sections)
    ? ((parsed as { sections: LlmSection[] }).sections)
    : [];
  const candidates = toCandidates(sections);

  const existing = await readExistingItems(supabase);
  const byId = new Map<string, ChecklistItemRow>(existing.map((r) => [r.id, r]));

  // 1) Reset is_new su TUTTE le righe esistenti (poi true solo su nuove/aggiornate).
  for (const row of byId.values()) row.isNew = false;

  // 2) Upsert dei candidati: PRESERVA status/note delle righe esistenti.
  let added = 0;
  let updated = 0;
  for (const c of candidates) {
    const prev = byId.get(c.id);
    if (prev) updated++;
    else added++;
    // Stato di review (status/note) preservato attraverso i refresh.
    byId.set(c.id, { ...c, status: prev?.status ?? null, note: prev?.note ?? null, isNew: true });
  }

  // 3) Persistenza. Le righe il cui id è sparito restano (non si cancellano):
  //    si scrivono comunque con is_new=false per azzerare il badge.
  const now = new Date().toISOString();
  const allRows = [...byId.values()];
  if (allRows.length) {
    await supabase.from(CHECKLIST_ITEMS_TABLE).upsert(allRows.map((r) => toDbRow(r, now)));
  }

  // 4) Metadati del refresh nella riga speciale di debug_checklist.
  const meta: ChecklistMeta = { lastRefreshSha: git.headSha(), lastRefreshAt: now, base };
  await supabase.from('debug_checklist').upsert({
    id: scopeId(REFRESH_META_ID), // meta per-progetto: id namespaced (no collisione tra progetti)
    status: null,
    note: JSON.stringify(meta),
    developer: null,
    updated_at: now,
  });

  // Ordinamento di ritorno: per sezione, poi per label (UI raggruppa per sezione).
  const items = allRows.sort(
    (a, b) => a.sectionOrder - b.sectionOrder || a.sectionTitle.localeCompare(b.sectionTitle) || a.label.localeCompare(b.label),
  );

  return { items, meta, added, updated };
}
