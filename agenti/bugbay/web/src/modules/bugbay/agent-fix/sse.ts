/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Emettitore SSE (text/event-stream) della spina `hub.sqlite` — TRACK B, Wave 1.
 * Trasmette le righe `events` (la timeline append-only, autorità di stato delle
 * run) a un consumer HTTP. NON scrive nulla: si limita a TAILARE la tabella
 * `events` già committata, onorando l'invariante INSERT-before-emit di W0
 * (`appendEvent()` fa l'INSERT atomico PRIMA che chiunque legga) — quindi qui
 * basta leggere la tabella committata, senza pub/sub né race.
 *
 * MECCANICA: `node:sqlite` (DatabaseSync) è sincrono e senza notifiche push, così
 * il tail è un POLL su `getEventsSince(cursor)` a intervallo breve. `events.id` è
 * monotono (AUTOINCREMENT) = SSE `Last-Event-ID`: il cursore avanza all'id
 * dell'ultima riga emessa. Su reconnect il client rimanda l'header `Last-Event-ID`
 * (o `?lastEventId=`): si RIPETONO gli eventi con id maggiore (replay del buco) e
 * poi si tailano i nuovi. Senza cursore, una connessione fresca parte dal massimo
 * corrente (`getMaxEventId()`) — nessun dump dell'intera storia a ogni apertura.
 *
 * ROBUSTEZZA: heartbeat/keepalive come commento SSE (`: ...`) quando il flusso è
 * idle (tiene viva la connessione contro proxy/timeout); teardown pulito su
 * disconnessione del client (abort del `request.signal` o `cancel()` dello
 * stream): si fermano i timer e si chiude il controller una sola volta.
 *
 * @indice
 * - SSE_HEADERS        → header della risposta text/event-stream
 * - parseSseCursor     → estrae Last-Event-ID (header o query) + filtro runId
 * - createEventStream  → ReadableStream<Uint8Array> che tail-a la tabella events
 * - sseResponse        → Response pronta (parsing + stream + header) per la route
 */

import { getEventsSince, getMaxEventId, type EventRow } from './hub';

/** Intervallo di poll della tabella `events` (ms): compromesso latenza/CPU. */
const DEFAULT_POLL_MS = 1000;
/** Idle oltre il quale si invia un heartbeat di keepalive (ms). */
const DEFAULT_HEARTBEAT_MS = 15000;
/** Suggerimento di retry al client per il reconnect automatico (ms). */
const RETRY_MS = 3000;

/**
 * Header canonici di uno stream SSE. `no-transform`/`X-Accel-Buffering: no`
 * disabilitano il buffering di eventuali proxy (altrimenti gli eventi non
 * arriverebbero finché il buffer non si riempie).
 */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export interface SseCursor {
  /** id da cui riprendere (esclusivo): si emettono gli eventi con id > lastEventId. `null` = connessione fresca. */
  lastEventId: number | null;
  /** Filtro opzionale: solo gli eventi di questa run. */
  runId?: string;
}

/**
 * Estrae il cursore di ripresa da una richiesta: prima l'header standard
 * `Last-Event-ID` (rimandato dal browser sui reconnect di EventSource), poi il
 * fallback `?lastEventId=` in query (utile a client non-EventSource). Un valore
 * non numerico o negativo viene ignorato (→ null = fresh). `?runId=` filtra.
 */
export function parseSseCursor(request: Request): SseCursor {
  const url = new URL(request.url);
  const headerId = request.headers.get('Last-Event-ID') ?? request.headers.get('last-event-id');
  const queryId = url.searchParams.get('lastEventId');
  const raw = headerId ?? queryId;

  let lastEventId: number | null = null;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) lastEventId = Math.floor(n);
  }

  const runId = url.searchParams.get('runId') ?? undefined;
  return { lastEventId, runId: runId || undefined };
}

/** Serializza una riga `events` in un frame SSE (`id`/`event`/`data`). */
function formatEvent(row: EventRow): string {
  // `data` porta la riga committata per intero: il consumer mappa
  // evento→observation via `payload` (JSON) senza altre query.
  return `id: ${row.id}\nevent: ${row.name}\ndata: ${JSON.stringify(row)}\n\n`;
}

export interface CreateEventStreamOptions extends SseCursor {
  /** Abort del client (Next fornisce `request.signal`): innesca il teardown. */
  signal?: AbortSignal;
  pollMs?: number;
  heartbeatMs?: number;
}

/**
 * Costruisce il `ReadableStream` che tail-a la tabella `events`. Fa un primo
 * poll immediato (replay del buco su reconnect, subito) e poi ripete ogni
 * `pollMs`; se il flusso resta idle oltre `heartbeatMs` invia un commento di
 * keepalive. Chiude una sola volta su abort/cancel o su errore di storage.
 */
export function createEventStream(opts: CreateEventStreamOptions): ReadableStream<Uint8Array> {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const { runId } = opts;
  const encoder = new TextEncoder();

  // Connessione fresca (nessun Last-Event-ID) → parte dal massimo corrente:
  // si tailano solo i NUOVI eventi, senza rovesciare l'intera storia.
  let cursor = opts.lastEventId != null ? opts.lastEventId : getMaxEventId();

  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let lastActivity = Date.now();
  // Hoistato: sia lo start (abort/errore) sia il cancel dello stream lo riusano.
  let teardown: () => void = () => {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      teardown = (): void => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        timer = null;
        opts.signal?.removeEventListener('abort', teardown);
        try {
          controller.close();
        } catch {
          /* già chiuso dal runtime */
        }
      };

      const send = (text: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(text));
          lastActivity = Date.now();
          return true;
        } catch {
          // Il consumer è sparito tra un check e l'enqueue: chiudi pulito.
          teardown();
          return false;
        }
      };

      // Abort del client (disconnessione TCP) → teardown immediato.
      if (opts.signal) {
        if (opts.signal.aborted) {
          teardown();
          return;
        }
        opts.signal.addEventListener('abort', teardown);
      }

      // Preambolo: hint di retry + commento di apertura (forza il flush iniziale).
      send(`retry: ${RETRY_MS}\n`);
      send(`: bugbay sse open @${new Date().toISOString()}\n\n`);

      const poll = (): void => {
        if (closed) return;
        let rows: EventRow[];
        try {
          rows = getEventsSince(cursor, runId);
        } catch (e) {
          // Errore di storage: segnalalo come commento e chiudi (probabile persistente).
          const msg = e instanceof Error ? e.message : 'storage error';
          send(`: bugbay sse error ${msg.replace(/\r?\n/g, ' ')}\n\n`);
          teardown();
          return;
        }

        for (const row of rows) {
          if (!send(formatEvent(row))) return; // consumer sparito a metà batch
          cursor = row.id;
        }

        // Nessun evento e flusso idle oltre la soglia → keepalive.
        if (rows.length === 0 && Date.now() - lastActivity >= heartbeatMs) {
          send(`: keepalive ${new Date().toISOString()}\n\n`);
        }
      };

      poll(); // primo giro subito: replay del buco senza attendere pollMs
      timer = setInterval(poll, pollMs);
    },

    cancel() {
      // Il consumer ha cancellato lo stream (equivalente all'abort): teardown pulito.
      teardown();
    },
  });
}

/**
 * Response SSE pronta all'uso per la route: estrae il cursore dalla richiesta,
 * costruisce lo stream legato a `request.signal` e applica gli header
 * text/event-stream. La route deve solo delegare (dopo la propria guardia).
 */
export function sseResponse(request: Request): Response {
  const { lastEventId, runId } = parseSseCursor(request);
  const stream = createEventStream({ lastEventId, runId, signal: request.signal });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
