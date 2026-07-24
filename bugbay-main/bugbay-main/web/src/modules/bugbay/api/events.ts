/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Endpoint SSE della console: streamma la timeline `events` della spina
 * `hub.sqlite` (TRACK B, Wave 1). Il consumo è read-only — nessuna scrittura
 * sulla spina — quindi qui c'è solo la guardia locale e la delega a `sseResponse`,
 * che apre lo stream legato a `request.signal` (teardown pulito sulla
 * disconnessione). Reconnect: il client rimanda `Last-Event-ID` (header) o
 * `?lastEventId=`; filtro opzionale per run con `?runId=`.
 *
 * Protetto come il resto del fix agentico: attivo solo in locale con
 * ENABLE_AGENT_FIX=1 (la timeline delle run non è un'API pubblica).
 *
 * @indice
 * - GET → stream text/event-stream degli eventi (con replay da Last-Event-ID)
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import { sseResponse } from '@/modules/bugbay/agent-fix/sse';

// nodejs: la spina usa `node:sqlite` (non gira su edge). force-dynamic: mai
// cacheare/prerenderare uno stream. maxDuration alto: l'SSE è long-lived.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

export function GET(request: Request): Response {
  if (!isAgentFixEnabled()) {
    return NextResponse.json(
      { error: 'Stream eventi disabilitato. Attivo solo in locale con ENABLE_AGENT_FIX=1.' },
      { status: 403 },
    );
  }
  return sseResponse(request);
}
