/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API di LETTURA read-only della console-hub (v0.6 Wave-2). Un solo endpoint,
 * tre viste selezionate dai query param:
 *  - ?runId=X         → RUN DETAIL: blob run + observations (sequenza per started_at,
 *                       l'albero parent_id lo ricostruisce la UI) + timeline events,
 *                       con il flag `hasBody` per l'affordance di espansione.
 *  - ?runId=X&body=Y  → corpo pesante lazy di una observation (prompt/diff/stdout).
 *  - ?inbox=1         → INBOX: run in attesa di revisione umana (review + needs_clarification),
 *                       proiezione leggera, più recenti in testa.
 *
 * SICUREZZA: privilegiata come il resto del fix agentico. La middleware
 * (host loopback + bearer/same-origin, matcher /api/*) copre questa route; qui si
 * onora la STESSA guardia ENABLE_AGENT_FIX di events.ts (la timeline delle run non
 * è un'API pubblica). Consumo READ-ONLY: solo getRun/getAllRuns (store) e i getter
 * read-only di hub.ts — nessuna scrittura sulla spina, nessun side-effect
 * (a differenza di ?active=1 dell'agent-fix, che fa dispatch/reconcile).
 *
 * @indice
 * - GET → runDetail | observationBody | inbox, in base ai query param
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import { getRun, getAllRuns } from '@/modules/bugbay/agent-fix/store';
import {
  getRunRow,
  getObservations,
  getObservationBody,
  getObservationBodyIds,
  getEventsForRun,
} from '@/modules/bugbay/agent-fix/hub';
import type { RunPhase } from '@/modules/bugbay/agent-fix/types';
import type {
  InboxResponse,
  InboxRun,
  RunDetailEvent,
  RunDetailObservation,
  RunDetailResponse,
  RunObservationBody,
} from '@/modules/bugbay/console/run-detail-types';

// nodejs: la spina usa `node:sqlite` (non gira su edge). force-dynamic: mai
// cacheare uno stato che cambia a ogni run. maxDuration contenuto: query leggere.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Fasi che entrano nella coda di revisione quotidiana (INBOX). */
const REVIEW_PHASES: readonly RunPhase[] = ['review', 'needs_clarification'];

export function GET(request: Request): Response {
  if (!isAgentFixEnabled()) {
    return NextResponse.json(
      { error: 'Console hub disabilitata. Attiva solo in locale con ENABLE_AGENT_FIX=1.' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);

  if (searchParams.get('inbox') === '1') {
    return NextResponse.json(inbox());
  }

  const runId = searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
  }

  const bodyFor = searchParams.get('body');
  if (bodyFor) {
    const payload: RunObservationBody = { observationId: bodyFor, body: getObservationBody(bodyFor) };
    return NextResponse.json(payload);
  }

  return NextResponse.json(runDetail(runId));
}

/** INBOX: run in attesa di revisione umana, proiezione leggera (niente diff/log). */
function inbox(): InboxResponse {
  const runs = getAllRuns() // già ordinate per createdAt DESC
    .filter((r) => REVIEW_PHASES.includes(r.phase))
    .map<InboxRun>((r) => ({
      runId: r.runId,
      reportTitolo: r.reportTitolo,
      reportUrl: r.reportUrl ?? null,
      phase: r.phase,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      reportsCount: r.reports?.length ?? 1,
      modificheCount: r.modifiche?.length ?? 0,
      costUsd: r.usage?.costUsd ?? (r.codemod ? 0 : null),
      domanda: r.phase === 'needs_clarification' ? r.domanda : undefined,
    }));
  return { runs };
}

/** RUN DETAIL: blob run + observations (con hasBody) + timeline events. */
function runDetail(runId: string): RunDetailResponse {
  const run = getRun(runId) ?? null;
  const row = getRunRow(runId);
  const bodyIds = new Set(getObservationBodyIds(runId));

  const observations = getObservations(runId).map<RunDetailObservation>((o) => ({
    id: o.id,
    parentId: o.parent_id,
    spanKind: o.span_kind,
    name: o.name,
    stage: o.stage,
    sym: o.sym,
    model: o.model,
    status: o.status,
    inputTokens: o.input_tokens,
    outputTokens: o.output_tokens,
    costUsd: o.cost_usd,
    startedAt: o.started_at,
    endedAt: o.ended_at,
    ms: o.ms,
    hasBody: bodyIds.has(o.id),
  }));

  const events = getEventsForRun(runId).map<RunDetailEvent>((e) => ({
    id: e.id,
    name: e.name,
    phaseFrom: e.phase_from,
    phaseTo: e.phase_to,
    payload: e.payload,
    ts: e.ts,
  }));

  return {
    run,
    phase: row?.phase ?? run?.phase ?? null,
    createdAt: row?.created_at ?? run?.createdAt ?? null,
    updatedAt: row?.updated_at ?? null,
    observations,
    events,
  };
}
