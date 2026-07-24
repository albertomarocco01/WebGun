/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Audit SCHEDULATI del codice (cron in-process): configurazioni persistite su
 * DB (tabelle `audits` + `audit_runs`, locali o Supabase), uno scheduler a tick
 * di 60s dentro il daemon (nessun cron di sistema) e un executor che lancia la
 * CLI claude in SOLA LETTURA con la skill adatta al tipo di audit
 * (code-inquisition / security / performance / quality / custom). I finding
 * possono diventare segnalazioni nella lavagna, entrando nel normale workflow
 * riformula→fix.
 *
 * @indice
 * - AuditConfig / AuditRunRecord → tipi persistiti
 * - cronMatches                  → matcher cron a 5 campi (m h dom mon dow)
 * - listAudits / saveAudit / deleteAudit / listAuditRuns → CRUD
 * - runAuditNow                  → esecuzione immediata (fire-and-forget)
 * - startAuditScheduler          → tick 60s, una sola istanza per processo
 */

import crypto from 'crypto';
import { Cron } from 'croner';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { projectId } from '@/modules/bugbay/lib/project';
import { resolveRunRoot } from './registry';
import { withRunRoot } from './target-root';
import { runHeadless } from './claude';
import { extractJson } from './run-context';
import { budgetGate } from './ledger';
import { maybeConsolidate } from './consolidation';
import { scanAutoBranchMerges } from './signal-watch';
import { maybeBuildArchetypes } from './archetypes';

export interface AuditConfig {
  id: string;
  projectId?: string | null;
  nome: string;
  /** Cron a 5 campi "m h dom mon dow" (supporta * , - e *\/n). */
  schedule: string;
  tipo: 'code-inquisition' | 'security' | 'performance' | 'quality' | 'custom';
  focus: string;
  scopeGlobs?: string[];
  profondita: 'rapida' | 'standard' | 'profonda';
  model: string;
  createReports: boolean;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string | null;
}

export interface AuditRunRecord {
  id: string;
  auditId: string;
  startedAt: string;
  finishedAt?: string | null;
  status: 'running' | 'done' | 'error';
  report?: string | null;
  findingsCount?: number | null;
  reportIds?: string[];
  error?: string | null;
}

/* ── Cron matcher (minimale, 5 campi) ───────────────────────────── */

function fieldMatches(field: string, v: number): boolean {
  return field.split(',').some((tok) => {
    if (tok === '*') return true;
    const step = tok.match(/^\*\/(\d+)$/);
    if (step) return Number(step[1]) > 0 && v % Number(step[1]) === 0;
    const range = tok.match(/^(\d+)-(\d+)$/);
    if (range) return v >= Number(range[1]) && v <= Number(range[2]);
    return Number(tok) === v;
  });
}

/** true se l'espressione cron matcha il minuto di `d` (ora locale del pc). */
export function cronMatches(expr: string, d: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const vals = [d.getMinutes(), d.getHours(), d.getDate(), d.getMonth() + 1, d.getDay()];
  return parts.every((p, i) => fieldMatches(p, vals[i]));
}

/* ── Mapping righe DB ↔ tipi (snake_case ↔ camelCase, JSON su TEXT) ── */

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function rowToAudit(row: any): AuditConfig {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    nome: row.nome ?? '',
    schedule: row.schedule ?? '0 3 * * *',
    tipo: row.tipo ?? 'custom',
    focus: row.focus ?? '',
    scopeGlobs: parseJsonArray(row.scope_globs),
    profondita: row.profondita ?? 'standard',
    model: row.model ?? 'claude-sonnet-5',
    createReports: row.create_reports === true || row.create_reports === 1 || row.create_reports === '1',
    enabled: row.enabled === true || row.enabled === 1 || row.enabled === '1',
    createdAt: row.created_at,
    lastRunAt: row.last_run_at ?? null,
  };
}

function rowToRun(row: any): AuditRunRecord {
  return {
    id: row.id,
    auditId: row.audit_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    status: row.status ?? 'done',
    report: row.report ?? null,
    findingsCount: typeof row.findings_count === 'number' ? row.findings_count : Number(row.findings_count ?? 0),
    reportIds: parseJsonArray(row.report_ids),
    error: row.error ?? null,
  };
}

/* ── CRUD ────────────────────────────────────────────────────────── */

export async function listAudits(): Promise<AuditConfig[]> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase.from('audits').select('*').order('created_at', { ascending: true });
  return (data ?? []).map(rowToAudit);
}

export async function saveAudit(input: Partial<AuditConfig>): Promise<AuditConfig> {
  const supabase = createAdminClient() as any;
  const id = input.id || crypto.randomUUID();
  const existing = input.id
    ? (await supabase.from('audits').select('*').eq('id', input.id).single()).data
    : null;
  const audit: AuditConfig = {
    ...(existing ? rowToAudit(existing) : {
      id, nome: '', schedule: '0 3 * * *', tipo: 'custom' as const, focus: '',
      scopeGlobs: [], profondita: 'standard' as const, model: 'claude-sonnet-5',
      createReports: true, enabled: true, createdAt: new Date().toISOString(), projectId: null,
    }),
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    id,
  } as AuditConfig;
  const { error } = await supabase.from('audits').upsert({
    id: audit.id,
    project_id: audit.projectId ?? null,
    nome: audit.nome,
    schedule: audit.schedule,
    tipo: audit.tipo,
    focus: audit.focus,
    scope_globs: JSON.stringify(audit.scopeGlobs ?? []),
    profondita: audit.profondita,
    model: audit.model,
    create_reports: audit.createReports ? 1 : 0,
    enabled: audit.enabled ? 1 : 0,
    created_at: audit.createdAt,
    last_run_at: audit.lastRunAt ?? null,
  });
  if (error) throw new Error(error.message);
  return audit;
}

export async function deleteAudit(id: string): Promise<void> {
  const supabase = createAdminClient() as any;
  await supabase.from('audit_runs').delete().eq('audit_id', id);
  await supabase.from('audits').delete().eq('id', id);
}

export async function listAuditRuns(limit = 30): Promise<AuditRunRecord[]> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase.from('audit_runs').select('*').order('started_at', { ascending: false });
  return (data ?? []).slice(0, limit).map(rowToRun);
}

/* ── Esecuzione ──────────────────────────────────────────────────── */

const TIMEOUT_BY_DEPTH: Record<AuditConfig['profondita'], number> = {
  rapida: 6 * 60_000,
  standard: 15 * 60_000,
  profonda: 30 * 60_000,
};

const DEPTH_INSTRUCTIONS: Record<AuditConfig['profondita'], string> = {
  rapida: 'DEPTH = QUICK PASS: scan the most likely hotspots only, report the TOP 5 most important findings. Budget your reading.',
  standard: 'DEPTH = STANDARD: one thorough pass over the scoped area; report every finding that matters (aim for the top 10).',
  profonda: 'DEPTH = DEEP: exhaustive adversarial audit; use subagents if your environment supports them; cross-check every suspicious area before reporting.',
};

const TYPE_INSTRUCTIONS: Record<AuditConfig['tipo'], string> = {
  'code-inquisition':
    'AUDIT TYPE = ADVERSARIAL INQUISITION. If the "code-inquisition" skill is available in your environment, load it and follow its council methodology. Otherwise emulate it: attack the code from independent expert angles (correctness, security, performance, architecture), verify each suspicion against the actual code, and keep only findings that survive scrutiny.',
  security:
    'AUDIT TYPE = SECURITY. If the "security-review" or "supabase" skills are available, use them. Hunt: injection points, authz/authn gaps, RLS weaknesses, secrets in code, unsafe input handling at trust boundaries, SSRF/path traversal. Report ONLY concrete, exploitable-in-principle issues with the vulnerable line.',
  performance:
    'AUDIT TYPE = PERFORMANCE. Hunt: N+1 queries, unnecessary re-renders, unbounded growth, sync I/O on hot paths, missing indexes/caches, O(n²) on large inputs. Quantify the impact when possible.',
  quality:
    'AUDIT TYPE = QUALITY/DEBT. If the "ponytail-audit" approach is available use it: over-engineering, dead code, reinvented stdlib, speculative abstractions, files over 500 lines, duplicated logic. Each finding must name what to DELETE or simplify.',
  custom: 'AUDIT TYPE = CUSTOM: follow the focus instructions below literally.',
};

function buildAuditPrompt(audit: AuditConfig): string {
  return `You are running a SCHEDULED READ-ONLY AUDIT of this repository. You cannot edit files. Ground every claim in code you actually read (cite file paths and lines).

${TYPE_INSTRUCTIONS[audit.tipo]}

${DEPTH_INSTRUCTIONS[audit.profondita]}
${audit.focus ? `\nFOCUS (from the operator, follow it): ${audit.focus}` : ''}
${audit.scopeGlobs?.length ? `\nSCOPE: limit the audit to files matching: ${audit.scopeGlobs.join(', ')}` : ''}

OUTPUT CONTRACT — return, in this order:
1. ONE fenced json block:
\`\`\`json
{ "findings": [ { "titolo": "<short title, Italian>", "descrizione": "<what/where/why + concrete fix direction, Italian>", "file": "<main file path>", "priorita": "Bassa"|"Media"|"Alta"|"Urgente"|"Critica", "categoria": "Bug"|"Miglioria Proposta" } ] }
\`\`\`
2. A markdown report (in Italian): executive summary, then one section per finding with the evidence.
No findings → empty array + a short "tutto in ordine" report. Never invent findings to fill quota.`;
}

async function updateAuditRun(id: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient() as any;
  await supabase.from('audit_runs').update(patch).eq('id', id);
}

/** Crea le segnalazioni dai finding (entrano nel normale workflow riformula→fix). */
async function createReportsFromFindings(audit: AuditConfig, findings: any[]): Promise<string[]> {
  const supabase = createAdminClient() as any;
  const ids: string[] = [];
  for (const f of findings) {
    if (!f?.titolo && !f?.descrizione) continue;
    const id = crypto.randomUUID();
    const { error } = await supabase.from('debug_reports').insert({
      id,
      project_id: audit.projectId || projectId(),
      category: f.categoria === 'Miglioria Proposta' ? 'Miglioria Proposta' : 'Bug',
      priority: ['Bassa', 'Media', 'Alta', 'Urgente', 'Critica'].includes(f.priorita) ? f.priorita : 'Media',
      area: typeof f.file === 'string' && f.file ? f.file : 'Audit',
      url: null,
      notes: `[audit:${audit.nome}] ${f.titolo ?? ''}\n\n${f.descrizione ?? ''}`.trim().slice(0, 5000),
      reporter_name: `Audit · ${audit.nome}`,
      status: 'Aperto',
      created_at: new Date().toISOString(),
      attachments: JSON.stringify([]),
    });
    if (!error) ids.push(id);
  }
  return ids;
}

async function executeAudit(audit: AuditConfig, runRecId: string): Promise<void> {
  try {
    const rr = resolveRunRoot(audit.projectId ?? undefined);
    if (!rr.ok) {
      await updateAuditRun(runRecId, { status: 'error', error: `Routing repo fallito: ${rr.reason}`, finished_at: new Date().toISOString() });
      return;
    }
    const res = await withRunRoot(rr.root, () =>
      // SOLA LETTURA: niente allowEdits → la CLI ha solo Read/Grep/graphify.
      runHeadless({ prompt: buildAuditPrompt(audit), model: audit.model, timeoutMs: TIMEOUT_BY_DEPTH[audit.profondita] }),
    );
    if (!res.ok) {
      await updateAuditRun(runRecId, { status: 'error', error: (res.error ?? 'Audit fallito.').slice(0, 1000), finished_at: new Date().toISOString() });
      return;
    }
    // Il contratto mette i finding in un fence ```json seguito dal report
    // markdown: va parsato IL FENCE (extractJson prende primo `{`…ultimo `}`
    // e inghiottirebbe anche il markdown, fallendo il parse).
    const fence = res.text.match(/```json\s*([\s\S]*?)```/);
    let parsed: any = null;
    if (fence) { try { parsed = JSON.parse(fence[1]); } catch { parsed = null; } }
    if (!parsed) parsed = extractJson(res.text);
    const findings: any[] = Array.isArray(parsed?.findings) ? parsed.findings : [];
    let reportIds: string[] = [];
    if (audit.createReports && findings.length) {
      reportIds = await createReportsFromFindings(audit, findings);
    }
    await updateAuditRun(runRecId, {
      status: 'done',
      report: res.text.slice(0, 60_000),
      findings_count: findings.length,
      report_ids: JSON.stringify(reportIds),
      finished_at: new Date().toISOString(),
    });
  } catch (e) {
    await updateAuditRun(runRecId, { status: 'error', error: e instanceof Error ? e.message.slice(0, 1000) : 'Errore interno.', finished_at: new Date().toISOString() });
  }
}

/** Esegue subito un audit (fire-and-forget); ritorna il record della run. */
export async function runAuditNow(id: string): Promise<AuditRunRecord> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase.from('audits').select('*').eq('id', id).single();
  if (!data) throw new Error('Audit non trovato.');
  const audit = rowToAudit(data);

  // Idempotenza: se una run di QUESTO audit è già in corso, ritorna quella.
  const running = (await listAuditRuns(50)).find((r) => r.auditId === id && r.status === 'running');
  if (running) return running;

  const rec: AuditRunRecord = { id: crypto.randomUUID(), auditId: id, startedAt: new Date().toISOString(), status: 'running' };
  await supabase.from('audit_runs').insert({
    id: rec.id, audit_id: id, started_at: rec.startedAt, status: 'running',
    report: null, findings_count: 0, report_ids: JSON.stringify([]), error: null, finished_at: null,
  });
  await supabase.from('audits').update({ last_run_at: rec.startedAt }).eq('id', id);
  void executeAudit(audit, rec.id).catch((e) => console.error('[bugbay] audit:', e));
  return rec;
}

/* ── Scheduler (croner, tick al minuto, in-process) ──────────────── */

// Job croner su global: gli hot-reload di Next ri-valutano il modulo, una `let`
// accumulerebbe job duplicati (stesso pattern del WATCH autonomo). UN SOLO job per
// processo. Croner `protect:true` serializza i tick (rimpiazza il vecchio flag
// `ticking`): un tick lento non ne fa partire un secondo sovrapposto.
const ga = global as unknown as {
  __bugbay_audit_cron__?: Cron;
};

async function auditTick(): Promise<void> {
  // Consolidamento memoria (v0.9, TRACK C): trigger-based, agganciato al tick di
  // loop esistente (nessun timer proprio). Gira PRIMA del gate di budget e a
  // prescindere dagli audit abilitati — è manutenzione locale (dedup/prune di bullet
  // ACE + casi episodici) che NON spende LLM, quindi non soggetta al breaker.
  // maybeConsolidate è no-op leggero finché il trigger (nuovi verdetti / periodico)
  // non scatta; best-effort, mai un throw che rompa il tick.
  try { maybeConsolidate(); } catch (e) { console.error('[bugbay] consolidation:', e); }

  // Segnali impliciti (fix concilio F1/A4): un branch bugbay/auto/* mergiato in HEAD
  // = approvazione IMPLICITA → score sulla spina (innesca memoria + credit). Prima
  // `scanAutoBranchMerges` non era chiamato da nessuno. De-dup sulla spina, best-effort.
  try { scanAutoBranchMerges(); } catch (e) { console.error('[bugbay] signal-watch:', e); }

  // Gate di budget del canale 'audit' (v0.7): a canale in pausa niente audit
  // schedulati. È lo shedding a zone — l'audit (basso valore) si ferma prima del
  // 'fixer' (alto valore) man mano che la weekly con riserva-umana si esaurisce.
  if (!budgetGate('audit').ok) return;

  // Motore archetipi (fix concilio F4): OPT-IN (BUGBAY_ARCHETYPES=1) + throttle interno,
  // gira DOPO il gate di budget perché distilla via LLM (costo). No-op a flag spento.
  void maybeBuildArchetypes().catch((e) => console.error('[bugbay] archetypes:', e));

  try {
    const now = new Date();
    const audits = await listAudits();
    for (const a of audits) {
      if (!a.enabled || !cronMatches(a.schedule, now)) continue;
      // Anti-doppione: se l'ultima partenza è in QUESTO minuto, già lanciato.
      if (a.lastRunAt && now.getTime() - new Date(a.lastRunAt).getTime() < 60_000) continue;
      try { await runAuditNow(a.id); } catch (e) { console.error('[bugbay] audit schedulato:', e); }
    }
  } catch { /* DB non pronto: riprova al prossimo tick */ }
}

/** Avvia lo scheduler una sola volta per processo (no-op alle chiamate successive). */
export function startAuditScheduler(): void {
  if (ga.__bugbay_audit_cron__) return;
  // Pattern a 5 campi = al secondo 0 di ogni minuto: allineato alla granularità del
  // matcher `cronMatches` (minuto), meglio del vecchio setInterval che derivava.
  ga.__bugbay_audit_cron__ = new Cron('* * * * *', { protect: true, catch: true, name: 'bugbay-audit' }, auditTick);
}
