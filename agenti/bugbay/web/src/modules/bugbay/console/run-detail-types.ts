/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Contratto CLIENT-SAFE delle viste RUN DETAIL / INBOX della console-hub
 * (v0.6 Wave-2). Tipi puri, ZERO import di runtime server (niente fs/node:sqlite):
 * sia la API route (server) sia i componenti client li importano, così il
 * boundary read-only resta netto — i client NON toccano mai hub.ts/store.ts. Gli
 * shape delle righe (observation/event) rispecchiano le *Row congelate di hub.ts,
 * ma sono ri-dichiarati qui (stessa scelta di hub-stream.ts per EVENT_NAMES) e
 * mappati in camelCase dal server, così il modulo server non finisce nel bundle
 * client.
 *
 * @indice
 * - SpanKind / ObsStatus       → vocabolari (specchio di hub.ts)
 * - RunDetailObservation       → riga observation (camelCase) + flag hasBody
 * - RunDetailEvent             → riga event della timeline
 * - RunDetailResponse          → payload di GET ?runId=
 * - RunObservationBody         → payload di GET ?runId=&body=
 * - InboxRun / InboxResponse   → payload di GET ?inbox=1
 */

import type { AgentRun, RunPhase } from '../agent-fix/types';

/** Tipo di span di una observation (specchio di hub.ts SpanKind). */
export type SpanKind = 'llm' | 'tool' | 'gate' | 'phase' | 'repair' | 'plan';
/** Esito di uno span (specchio di hub.ts ObservationRow.status). */
export type ObsStatus = 'ok' | 'error' | 'running';

/** Una observation della run, pronta per la UI (camelCase, con affordance di espansione). */
export interface RunDetailObservation {
  id: string;
  parentId: string | null;
  spanKind: SpanKind;
  name: string;
  stage: string | null;
  sym: string | null;
  model: string | null;
  status: ObsStatus | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  startedAt: string;
  endedAt: string | null;
  ms: number | null;
  /** True se esiste un corpo pesante (prompt/diff/stdout) da caricare lazy. */
  hasBody: boolean;
}

/** Una riga della timeline `events` della run (camelCase). */
export interface RunDetailEvent {
  id: number;
  name: string;
  phaseFrom: RunPhase | null;
  phaseTo: RunPhase | null;
  payload: string | null;
  ts: string;
}

/** Payload di GET /api/agent-fix/hub?runId=… — evidenza completa di una run. */
export interface RunDetailResponse {
  /** Blob AgentRun (titolo, fase, usage, diff, riassunto…) — null se la run non esiste più. */
  run: AgentRun | null;
  /** Fase autoritativa dalla colonna `runs.phase` (fonte di verità dello stato). */
  phase: RunPhase | null;
  createdAt: string | null;
  updatedAt: string | null;
  observations: RunDetailObservation[];
  events: RunDetailEvent[];
}

/** Payload di GET /api/agent-fix/hub?runId=…&body=… — corpo pesante lazy. */
export interface RunObservationBody {
  observationId: string;
  body: string | null;
}

/** Una run in attesa di revisione umana, proiezione leggera per la lista INBOX. */
export interface InboxRun {
  runId: string;
  reportTitolo: string;
  reportUrl?: string | null;
  phase: RunPhase;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Numero di segnalazioni della run (1 per le singole, N per le batch). */
  reportsCount: number;
  /** Numero di file modificati dall'agente. */
  modificheCount: number;
  /** Costo stimato in USD (0 per i codemod, null se ignoto). */
  costUsd: number | null;
  /** Domanda di chiarimento, presente solo quando phase === 'needs_clarification'. */
  domanda?: string;
}

/** Payload di GET /api/agent-fix/hub?inbox=1 — coda di revisione quotidiana. */
export interface InboxResponse {
  runs: InboxRun[];
}
