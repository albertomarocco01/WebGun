/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API di LETTURA read-only del CRUSCOTTO KPI (v0.9, Track K) — l'ultima vista che
 * si posa sopra a tutti gli altri track e li LEGGE senza mai scrivere. Un solo
 * endpoint privilegiato (stessa guardia ENABLE_AGENT_FIX / stessa middleware /api/*
 * delle altre route dell'agent-fix): aggrega la spina `hub.sqlite` in un payload
 * di metriche per la sezione KPI della console:
 *   - BUDGET       → finestre correnti + trend dai `usage_blocks` (channel 'total',
 *                    materializzati da Track L) vs i cap della config budget (letta,
 *                    MAI seminata: read-only stretto).
 *   - VERDETTI     → tassi approve/discard/regression dagli `scores`, per fonte
 *                    (HUMAN 1.0 / JUDGE / IMPLICIT 0.25) — classificati per polarità.
 *   - RUN          → distribuzione delle `runs` per fase.
 *   - GATE DI EVAL → gli `alerts` canale 'eval' (ogni riga = un gate ROSSO, cioè una
 *                    regressione intercettata dal conteggio-flip appaiato di Track G).
 *   - ALERT        → conteggio degli `alerts` per canale (budget/watchdog/parse/eval/stuck).
 *   - OSSERVAZIONI → costo/latenza dalle `observations`: totali, per modello, per giorno.
 *
 * SICUREZZA: privilegiata come events.ts/hub-observability.ts. Consumo READ-ONLY:
 * solo SELECT aggregate su colonne congelate + `getLatestConfig` (lettura pura, non
 * semina). Nessuna scrittura sulla spina, nessun side-effect. Il client (SezioneKpi)
 * NON importa mai questo modulo: passa sempre dalla route /api/agent-fix/kpi.
 *
 * @indice
 * - KpiResponse (+ tipi annidati) → forma del payload client-safe
 * - GET  → snapshot aggregato dei KPI
 * - collectKpi → orchestratore delle query aggregate read-only
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import { openHubDb } from '@/modules/bugbay/agent-fix/hub';
import { getLatestConfig } from '@/modules/bugbay/agent-fix/ledger';

// nodejs: la spina usa `node:sqlite` (non gira su edge). force-dynamic: le metriche
// cambiano a ogni run. maxDuration contenuto: sono SELECT aggregate leggere.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Forma del payload (client-safe: numeri e stringhe, niente righe grezze) ───

/** Una finestra di budget corrente (weekly o block 5h) con l'uso vs il cap effettivo. */
export interface KpiBudgetWindow {
  windowKind: 'weekly' | 'block_5h';
  startedAt: string;
  endsAt: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** Cap grezzo (USD) della finestra dalla config budget, o null se sconosciuta. */
  capUsd: number | null;
  /** Cap EFFETTIVO: weekly = cap×(1−riserva umana); block = cap. Null se sconosciuto. */
  effectiveCapUsd: number | null;
  /** costUsd / effectiveCapUsd (0..1+), o null se il cap è sconosciuto. */
  fraction: number | null;
}

export interface KpiBudget {
  weekly: KpiBudgetWindow | null;
  block: KpiBudgetWindow | null;
  /** Costo delle ultime finestre weekly (ascendente per data): trend di spesa. */
  weeklyTrend: { startedAt: string; costUsd: number }[];
  /** Frazione della weekly riservata all'umano (dalla config), o null se sconosciuta. */
  humanReserveFraction: number | null;
  /** true se la config budget non è ancora stata seminata (nessuna riga scope='budget'). */
  configUnknown: boolean;
}

export interface KpiVerdicts {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  /** Sottoinsieme dei negativi il cui verdetto menziona una regressione. */
  regressions: number;
  /** positive / (positive + negative), o null se non ci sono verdetti a polarità nota. */
  approveRate: number | null;
  bySource: { source: string; count: number; weight: number }[];
}

export interface KpiRunPhase {
  phase: string;
  count: number;
}

export interface KpiEvalGate {
  /** Gate ROSSI registrati (ogni `alert` canale 'eval' = una regressione intercettata). */
  redGates: number;
  /** Somma delle regressioni (flip pass→fail) sui gate rossi, dal detail degli alert. */
  regressionsCaught: number;
  recent: {
    id: string;
    message: string;
    createdAt: string;
    ackAt: string | null;
    regressions: number;
  }[];
}

export interface KpiAlertChannel {
  channel: string;
  count: number;
  errors: number;
}

export interface KpiModelStat {
  model: string;
  count: number;
  costUsd: number;
  avgMs: number | null;
}

export interface KpiObservations {
  count: number;
  totalCostUsd: number;
  avgMs: number | null;
  errorCount: number;
  byModel: KpiModelStat[];
  costByDay: { day: string; costUsd: number }[];
}

export interface KpiResponse {
  generatedAt: string;
  budget: KpiBudget;
  verdicts: KpiVerdicts;
  runsByPhase: KpiRunPhase[];
  evalGate: KpiEvalGate;
  alerts: KpiAlertChannel[];
  observations: KpiObservations;
}

// ── Classificazione dei verdetti (specchio di ace.ts POSITIVE/NEGATIVE) ──────
// Verdetti a polarità nota, normalizzati lowercase; input IT o EN. Tenuto locale
// (non importabile da ace.ts, che tira dentro il grafo di distillazione): qui basta
// la stessa lista per calcolare i tassi.
const POSITIVE = new Set([
  'approved', 'approve', 'merged', 'merge', 'resolved', 'risolto', 'pass', 'passed', 'accepted', 'fixed',
]);
const NEGATIVE = new Set([
  'discarded', 'discard', 'rejected', 'reject', 'fail', 'failed', 'invalid', 'regression',
]);

function polarity(verdict: string): 'positive' | 'negative' | 'neutral' {
  const v = verdict.trim().toLowerCase();
  if (POSITIVE.has(v)) return 'positive';
  if (NEGATIVE.has(v)) return 'negative';
  return 'neutral';
}

// Preset dei cap (specchio di DEFAULT_BUDGET_CONFIG in ledger.ts) — usati SOLO per
// leggere i campi dalla config esistente con un typing sicuro; NON seminano nulla.
interface BudgetConfigShape {
  weeklyCostCapUsd?: number;
  blockCostCapUsd?: number;
  humanReserveFraction?: number;
}

// ── Aggregazione read-only ───────────────────────────────────────────────────

/** Riga aggregata di usage_blocks per una finestra. */
interface UsageAgg {
  started_at: string;
  ends_at: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Snapshot aggregato dei KPI da `hub.sqlite`. Tutte SELECT read-only su colonne
 * congelate + una lettura pura della config budget. Nessuna scrittura.
 */
export function collectKpi(): KpiResponse {
  const db = openHubDb();
  const nowMs = Date.now();

  // ── Config budget (LETTURA pura: getLatestConfig non semina) ──
  let cfg: BudgetConfigShape = {};
  let configUnknown = true;
  const cfgRow = getLatestConfig('budget');
  if (cfgRow) {
    configUnknown = false;
    try {
      cfg = JSON.parse(cfgRow.value) as BudgetConfigShape;
    } catch {
      cfg = {};
    }
  }
  const reserve = typeof cfg.humanReserveFraction === 'number' ? cfg.humanReserveFraction : null;
  const weeklyCap = typeof cfg.weeklyCostCapUsd === 'number' ? cfg.weeklyCostCapUsd : null;
  const blockCap = typeof cfg.blockCostCapUsd === 'number' ? cfg.blockCostCapUsd : null;

  // ── Budget: finestra corrente + trend (channel 'total', materializzato da L) ──
  const weeklyRows = db
    .prepare(
      `SELECT started_at, ends_at, cost_usd, input_tokens, output_tokens
         FROM usage_blocks WHERE channel = 'total' AND window_kind = 'weekly'
        ORDER BY started_at DESC LIMIT 12`,
    )
    .all() as UsageAgg[];
  const blockRows = db
    .prepare(
      `SELECT started_at, ends_at, cost_usd, input_tokens, output_tokens
         FROM usage_blocks WHERE channel = 'total' AND window_kind = 'block_5h'
        ORDER BY started_at DESC LIMIT 12`,
    )
    .all() as UsageAgg[];

  const curWeekly = weeklyRows.find((r) => Date.parse(r.started_at) <= nowMs && nowMs < Date.parse(r.ends_at)) ?? null;
  const curBlock = blockRows.find((r) => Date.parse(r.started_at) <= nowMs && nowMs < Date.parse(r.ends_at)) ?? null;

  const weeklyEffCap = weeklyCap !== null ? weeklyCap * (1 - (reserve ?? 0)) : null;

  const budget: KpiBudget = {
    weekly: curWeekly
      ? {
          windowKind: 'weekly',
          startedAt: curWeekly.started_at,
          endsAt: curWeekly.ends_at,
          costUsd: curWeekly.cost_usd,
          inputTokens: curWeekly.input_tokens,
          outputTokens: curWeekly.output_tokens,
          capUsd: weeklyCap,
          effectiveCapUsd: weeklyEffCap,
          fraction: weeklyEffCap && weeklyEffCap > 0 ? curWeekly.cost_usd / weeklyEffCap : null,
        }
      : null,
    block: curBlock
      ? {
          windowKind: 'block_5h',
          startedAt: curBlock.started_at,
          endsAt: curBlock.ends_at,
          costUsd: curBlock.cost_usd,
          inputTokens: curBlock.input_tokens,
          outputTokens: curBlock.output_tokens,
          capUsd: blockCap,
          effectiveCapUsd: blockCap,
          fraction: blockCap && blockCap > 0 ? curBlock.cost_usd / blockCap : null,
        }
      : null,
    weeklyTrend: [...weeklyRows]
      .reverse() // ORDER BY DESC → ascendente per il grafico
      .map((r) => ({ startedAt: r.started_at, costUsd: r.cost_usd })),
    humanReserveFraction: reserve,
    configUnknown,
  };

  // ── Verdetti: classificazione per polarità + per fonte (peso incluso) ──
  const scoreRows = db
    .prepare('SELECT source, verdict, COUNT(*) AS n, SUM(weight) AS w FROM scores GROUP BY source, verdict')
    .all() as { source: string; verdict: string; n: number; w: number | null }[];
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  let regressions = 0;
  const bySourceMap = new Map<string, { count: number; weight: number }>();
  for (const row of scoreRows) {
    const p = polarity(row.verdict);
    if (p === 'positive') positive += row.n;
    else if (p === 'negative') negative += row.n;
    else neutral += row.n;
    if (row.verdict.trim().toLowerCase().includes('regression')) regressions += row.n;
    const cur = bySourceMap.get(row.source) ?? { count: 0, weight: 0 };
    cur.count += row.n;
    cur.weight += row.w ?? 0;
    bySourceMap.set(row.source, cur);
  }
  const verdicts: KpiVerdicts = {
    total: positive + negative + neutral,
    positive,
    negative,
    neutral,
    regressions,
    approveRate: positive + negative > 0 ? positive / (positive + negative) : null,
    bySource: [...bySourceMap.entries()]
      .map(([source, v]) => ({ source, count: v.count, weight: v.weight }))
      .sort((a, b) => b.count - a.count),
  };

  // ── Run per fase ──
  const runsByPhase = (
    db.prepare('SELECT phase, COUNT(*) AS n FROM runs GROUP BY phase').all() as { phase: string; n: number }[]
  )
    .map((r) => ({ phase: r.phase, count: r.n }))
    .sort((a, b) => b.count - a.count);

  // ── Gate di eval: ogni alert 'eval' = un gate ROSSO (regressione intercettata) ──
  const evalRows = db
    .prepare(
      `SELECT id, message, detail, created_at, ack_at FROM alerts
        WHERE channel = 'eval' ORDER BY created_at DESC LIMIT 20`,
    )
    .all() as { id: string; message: string; detail: string | null; created_at: string; ack_at: string | null }[];
  let regressionsCaught = 0;
  const recentEval = evalRows.map((r) => {
    let regCount = 0;
    if (r.detail) {
      try {
        const d = JSON.parse(r.detail) as { regressions?: unknown };
        if (Array.isArray(d.regressions)) regCount = d.regressions.length;
      } catch {
        /* detail non-JSON: 0 regressioni note */
      }
    }
    regressionsCaught += regCount;
    return { id: r.id, message: r.message, createdAt: r.created_at, ackAt: r.ack_at, regressions: regCount };
  });
  const evalGate: KpiEvalGate = {
    redGates: evalRows.length,
    regressionsCaught,
    recent: recentEval,
  };

  // ── Alert per canale ──
  const alerts = (
    db
      .prepare(
        `SELECT channel, COUNT(*) AS n, SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) AS e
           FROM alerts GROUP BY channel`,
      )
      .all() as { channel: string; n: number; e: number | null }[]
  )
    .map((r) => ({ channel: r.channel, count: r.n, errors: r.e ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // ── Osservazioni: costo/latenza totali, per modello, per giorno ──
  const obsTot = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd), 0) AS cost, AVG(ms) AS avg_ms,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errs
         FROM observations`,
    )
    .get() as { n: number; cost: number; avg_ms: number | null; errs: number | null } | undefined;

  const byModel = (
    db
      .prepare(
        `SELECT model, COUNT(*) AS n, COALESCE(SUM(cost_usd), 0) AS cost, AVG(ms) AS avg_ms
           FROM observations GROUP BY model ORDER BY cost DESC LIMIT 12`,
      )
      .all() as { model: string | null; n: number; cost: number; avg_ms: number | null }[]
  ).map((r) => ({
    model: r.model ?? '—',
    count: r.n,
    costUsd: r.cost,
    avgMs: r.avg_ms !== null ? Math.round(r.avg_ms) : null,
  }));

  const costByDay = (
    db
      .prepare(
        `SELECT substr(started_at, 1, 10) AS day, COALESCE(SUM(cost_usd), 0) AS cost
           FROM observations GROUP BY day ORDER BY day DESC LIMIT 30`,
      )
      .all() as { day: string; cost: number }[]
  )
    .reverse() // ascendente per il grafico
    .map((r) => ({ day: r.day, costUsd: r.cost }));

  const observations: KpiObservations = {
    count: obsTot?.n ?? 0,
    totalCostUsd: obsTot?.cost ?? 0,
    avgMs: obsTot?.avg_ms != null ? Math.round(obsTot.avg_ms) : null,
    errorCount: obsTot?.errs ?? 0,
    byModel,
    costByDay,
  };

  return {
    generatedAt: new Date().toISOString(),
    budget,
    verdicts,
    runsByPhase,
    evalGate,
    alerts,
    observations,
  };
}

function forbidden(): Response {
  return NextResponse.json(
    { error: 'Cruscotto KPI disabilitato. Attivo solo in locale con ENABLE_AGENT_FIX=1.' },
    { status: 403 },
  );
}

export function GET(): Response {
  if (!isAgentFixEnabled()) return forbidden();
  return NextResponse.json(collectKpi());
}
