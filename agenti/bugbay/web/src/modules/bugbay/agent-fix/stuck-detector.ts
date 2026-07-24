/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * StuckDetector a livello di RUN — distinto dal watchdog di PROCESSO (che sorveglia
 * solo la liveness del daemon). A ogni tick del poller ispeziona le run in fase
 * RUNNING e la loro attività sulla spina hub: se una run non produce più attività
 * (nessuna observation/tool_use e nessun avanzamento della riga `runs`) da oltre
 * STALL_MS — STALLO — oppure ha accumulato un loop di repair oltre REPAIR_LOOP_MAX,
 * alza un alert (evento `alert.raised`, canale 'stuck') e PARCHEGGIA la run
 * (`pauseRun`): il processo in volo viene fermato e la run resta RIPRENDIBILE da un
 * umano. Il parcheggio (non l'abort) è deliberato: una run 'paused' NON è terminale
 * → `hasActiveRunFor` la tiene occupata e il report NON si riapre, quindi il WATCH
 * non la ri-dispaccia in un loop di churn.
 *
 * Soglie VENDORATE (costanti in questo file): niente dipendenze esterne, niente
 * config runtime. STALL_MS è tenuto sopra il più lungo timeout di una singola
 * chiamata headless (15 min in esecuzione.ts) così una run lenta-ma-viva non viene
 * mai scambiata per bloccata.
 *
 * @indice
 * - STALL_MS / REPAIR_LOOP_MAX → soglie vendorate
 * - detectStuckRuns            → ispeziona le run attive e parcheggia le bloccate
 */

import { getActiveRuns, log } from './store';
import { getRunRow, getObservations, appendEvent } from './hub';
import { RUNNING_PHASES } from './run-context';
import { pauseRun } from './runner';
import type { AgentRun } from './types';

/**
 * Nessuna attività (observation/tool_use né avanzamento della riga `runs`) per
 * questo tempo, in una fase RUNNING, ⇒ stallo. Tenuto SOPRA il timeout massimo di
 * una singola chiamata headless (15 min): oltre questo, il processo o è morto o è
 * wedged, mai solo lento (un timeout avrebbe già fatto avanzare la run).
 */
const STALL_MS = 20 * 60_000;

/**
 * Numero di step di repair oltre il quale una run è in loop patologico. Il ciclo
 * normale di doFix si ferma a 2 repair: una soglia a 6 lascia margine ai rilanci
 * legittimi (reject/resume) e cattura solo il thrashing genuino.
 */
const REPAIR_LOOP_MAX = 6;

/** Timestamp (ms) dell'ultima attività osservabile della run, o 0 se sconosciuto. */
function lastActivityMs(run: AgentRun): number {
  let last = 0;
  const row = getRunRow(run.runId);
  if (row?.updated_at) last = Date.parse(row.updated_at) || 0;
  // La riga `runs` avanza su log/trace/transizioni; le observations avanzano
  // durante lo streaming della CLI. Il massimo dei due copre sia le fasi claude
  // sia le fasi non-claude (gemini/deepseek/gate) che non scrivono observations.
  for (const o of getObservations(run.runId)) {
    const t = Date.parse(o.ended_at ?? o.started_at) || 0;
    if (t > last) last = t;
  }
  // Fallback: se la spina non ha ancora nulla, usa l'inizio della run.
  if (!last) last = Date.parse(run.startedAt ?? run.createdAt) || 0;
  return last;
}

/** Motivo per cui la run è bloccata, o undefined se è viva. */
function stuckReason(run: AgentRun, now: number): string | undefined {
  const repairs = (run.timeline ?? []).filter((e) => e.stage === 'repair').length;
  if (repairs > REPAIR_LOOP_MAX) return `loop di repair (${repairs} tentativi oltre la soglia)`;

  const last = lastActivityMs(run);
  if (last && now - last > STALL_MS) {
    return `stallo: nessuna attività da ${Math.round((now - last) / 60_000)} min`;
  }
  return undefined;
}

/**
 * Ispeziona le run attive: quelle in fase RUNNING bloccate (stallo o loop di repair)
 * vengono segnalate con un alert 'stuck' e parcheggiate. Best-effort per-run: un
 * fallimento su una run non ferma la scansione delle altre. Sincrono (letture su
 * SQLite locale): chiamato dal poll loop del WATCH prima del gate di budget, così
 * una run bloccata viene liberata anche a budget esaurito.
 */
export function detectStuckRuns(): void {
  const now = Date.now();
  for (const run of getActiveRuns()) {
    if (!RUNNING_PHASES.includes(run.phase)) continue;
    const reason = stuckReason(run, now);
    if (!reason) continue;
    try {
      appendEvent({
        run_id: run.runId,
        name: 'alert.raised',
        payload: JSON.stringify({ channel: 'stuck', runId: run.runId, phase: run.phase, reason }),
      });
      log(run.runId, `⏸ StuckDetector: ${reason} → run parcheggiata (riprendibile a mano).`);
      pauseRun(run.runId);
    } catch (e) {
      console.error(`[bugbay] stuck-detector: parcheggio fallito per ${run.runId}:`, e);
    }
  }
}
