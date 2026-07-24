/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * CONTRATTO URL dello stream SSE dell'hub (v0.6 Wave-1) + hook client di
 * sottoscrizione. L'EMITTER vive in `sse.ts` (Track B, backend-dev) e non è
 * ancora atterrato: questo file NE definisce solo l'URL e vi si sottoscrive dal
 * browser, così la vista NOW è già cablata quando B/W2 riempiono l'endpoint.
 *
 * Contratto (ciò che l'emitter DEVE rispettare, congelato con lo schema hub):
 *   GET /api/agent-fix/stream  →  Content-Type: text/event-stream
 *     · ogni frame porta `id:` = events.id (Last-Event-ID monotono di hub.ts);
 *       il browser rimanda l'header Last-Event-ID al reconnect → replay senza buchi.
 *     · `event:` = uno degli EVENT_NAMES congelati; il `data:` è il payload JSON.
 *
 * NB: qui NON si importa hub.ts (tira dentro fs/node:sqlite): il vocabolario dei
 * nomi evento è duplicato come costante locale, single-source resta hub.ts.
 *
 * @indice
 * - HUB_STREAM_URL → l'URL del canale (unico punto da cambiare)
 * - useHubStream   → sottoscrive via EventSource, espone stato/conteggio/log
 */

'use client';

import { useEffect, useRef, useState } from 'react';

/** Unico punto di verità dell'URL: allineato alla route SSE di Track-B. */
export const HUB_STREAM_URL = '/api/agent-fix/stream';

// Specchio di EVENT_NAMES di hub.ts (congelato). Duplicato locale così il bundle
// client non importa mai il modulo server-only dell'hub.
const EVENT_NAMES = [
  'run.created',
  'run.transition',
  'obs.started',
  'obs.ended',
  'score.recorded',
  'alert.raised',
] as const;

export type HubStreamStatus = 'connecting' | 'open' | 'error';

export interface HubStreamEvent {
  /** events.id (= Last-Event-ID); '—' finché l'emitter non lo popola. */
  id: string;
  /** Nome dell'evento SSE (EVENT_NAMES) o 'message' per i frame senza `event:`. */
  name: string;
  /** Payload grezzo del frame (`data:`), tipicamente JSON. */
  data: string;
  /** Timestamp di ricezione lato client (ms). */
  at: number;
}

export interface HubStream {
  status: HubStreamStatus;
  /** Eventi ricevuti in questa sessione di stream. */
  count: number;
  /** Ultimi eventi (più recente in testa), limitati a `bufferSize`. */
  events: HubStreamEvent[];
  /** Azzera log e conteggio (non chiude la connessione). */
  clear: () => void;
}

/**
 * Sottoscrive il canale SSE dell'hub e mantiene stato di connessione, conteggio
 * e un buffer degli ultimi eventi. Il reconnect + Last-Event-ID è gestito
 * nativamente da EventSource. Se l'endpoint non esiste ancora (B non atterrato)
 * lo stato resta 'error' senza spam: è la condizione attesa in Wave-1.
 */
export function useHubStream(bufferSize = 50): HubStream {
  const [status, setStatus] = useState<HubStreamStatus>('connecting');
  const [count, setCount] = useState(0);
  const [events, setEvents] = useState<HubStreamEvent[]>([]);
  const bufRef = useRef(bufferSize);
  bufRef.current = bufferSize;

  useEffect(() => {
    const es = new EventSource(HUB_STREAM_URL);

    const push = (name: string) => (e: MessageEvent) => {
      setCount((c) => c + 1);
      setEvents((prev) =>
        [{ id: e.lastEventId || '—', name, data: e.data ?? '', at: Date.now() }, ...prev].slice(
          0,
          bufRef.current,
        ),
      );
    };

    es.onopen = () => setStatus('open');
    es.onerror = () => setStatus(es.readyState === EventSource.OPEN ? 'open' : 'error');
    es.onmessage = push('message');

    const named = EVENT_NAMES.map((n) => {
      const handler = push(n) as EventListener;
      es.addEventListener(n, handler);
      return [n, handler] as const;
    });

    return () => {
      named.forEach(([n, handler]) => es.removeEventListener(n, handler));
      es.close();
    };
  }, []);

  return {
    status,
    count,
    events,
    clear: () => {
      setEvents([]);
      setCount(0);
    },
  };
}
