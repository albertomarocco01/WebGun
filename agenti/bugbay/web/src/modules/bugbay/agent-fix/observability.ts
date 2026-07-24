/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Observability (F4) e panoramica cross-progetto (F2-inc2). Aggregazioni PURE
 * sulle run (per l'endpoint health) e una vista dei totali per progetto sul DB
 * condiviso (hub multi-progetto): a differenza del resto, quest'ultima IGNORA lo
 * scope di progetto per mostrare tutte le app insieme.
 *
 * @indice
 * - aggregateRuns        → conteggi per fase + attive/errori + usage totale (puro)
 * - crossProjectOverview → totali per progetto sul DB condiviso (cross-progetto)
 */

import type { AgentRun } from './types';
import { RUNNING_PHASES } from './run-context';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { readRegistry } from './registry';

export interface RunsAggregate {
  total: number;
  active: number;
  errors: number;
  autonomous: number;
  byPhase: Record<string, number>;
  usage: { inputTokens: number; outputTokens: number; calls: number; costUsd: number };
}

/** Aggrega lo stato delle run per l'endpoint health (puro: testabile senza store). */
export function aggregateRuns(runs: AgentRun[]): RunsAggregate {
  const byPhase: Record<string, number> = {};
  const usage = { inputTokens: 0, outputTokens: 0, calls: 0, costUsd: 0 };
  let active = 0, errors = 0, autonomous = 0;
  for (const r of runs) {
    byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
    if (RUNNING_PHASES.includes(r.phase)) active++;
    if (r.phase === 'error') errors++;
    if (r.autonomous) autonomous++;
    if (r.usage) {
      usage.inputTokens += r.usage.inputTokens || 0;
      usage.outputTokens += r.usage.outputTokens || 0;
      usage.calls += r.usage.calls || 0;
      usage.costUsd += r.usage.costUsd || 0;
    }
  }
  usage.costUsd = Math.round(usage.costUsd * 1e6) / 1e6;
  return { total: runs.length, active, errors, autonomous, byPhase, usage };
}

export interface ProjectOverview {
  projectId: string | null;
  name: string;
  total: number;
  open: number;
  inProgress: number;
  inVerifica: number;
  resolved: number;
}

/**
 * Totali per progetto sul DB CONDIVISO — la dashboard del hub multi-progetto.
 * Nessun filtro `project_id`: raccoglie tutte le app che scrivono su questo DB.
 * Col backend locale (DB per-progetto) restituisce di fatto un solo progetto.
 * ponytail: full-scan delle colonne leggere aggregato in JS; se il hub cresce
 * molto, spostare l'aggregazione in una VIEW/RPC SQL.
 */
export async function crossProjectOverview(): Promise<{ projects: ProjectOverview[]; totals: Omit<ProjectOverview, 'projectId' | 'name'> }> {
  const supabase = createAdminClient() as any;

  // Nomi progetti (se la tabella esiste: schema pre-F2 potrebbe non averla).
  const names = new Map<string, string>();
  try {
    const { data } = await supabase.from('projects').select('id, name');
    for (const p of (data ?? []) as { id: string; name: string }[]) names.set(p.id, p.name);
  } catch { /* tabella projects assente → nomi derivati dall'id */ }
  // Il registry machine-scoped (~/.bugbay/registry.json) è la fonte di verità dei
  // nomi (lo scrive `bugbay init`): un progetto che ha SCRITTO segnalazioni ma non
  // ha una riga nella tabella `projects` del DB mostrerebbe l'UUID troncato. Il
  // registry ha il nome leggibile → lo sovrappone (vince sulla tabella DB).
  try {
    for (const [id, p] of Object.entries(readRegistry().projects ?? {})) {
      if (p?.name) names.set(id, p.name);
    }
  } catch { /* registry assente → resta il nome dalla tabella/id */ }

  const { data: reps } = await supabase.from('debug_reports').select('project_id, status');

  const byProj = new Map<string, ProjectOverview>();
  for (const r of (reps ?? []) as { project_id?: string | null; status?: string }[]) {
    const pid = r.project_id ?? null;
    const key = pid ?? '(none)';
    let o = byProj.get(key);
    if (!o) {
      o = { projectId: pid, name: (pid && names.get(pid)) || (pid ? pid.slice(0, 8) : 'Senza progetto'), total: 0, open: 0, inProgress: 0, inVerifica: 0, resolved: 0 };
      byProj.set(key, o);
    }
    o.total++;
    switch (r.status) {
      case 'Aperto': o.open++; break;
      case 'In Lavorazione': case 'In Chiarimento': o.inProgress++; break;
      case 'In Verifica': o.inVerifica++; break;
      case 'Risolto': o.resolved++; break;
    }
  }

  const projects = [...byProj.values()].sort((a, b) => b.total - a.total);
  const totals = projects.reduce(
    (acc, p) => ({
      total: acc.total + p.total, open: acc.open + p.open, inProgress: acc.inProgress + p.inProgress,
      inVerifica: acc.inVerifica + p.inVerifica, resolved: acc.resolved + p.resolved,
    }),
    { total: 0, open: 0, inProgress: 0, inVerifica: 0, resolved: 0 },
  );
  return { projects, totals };
}
