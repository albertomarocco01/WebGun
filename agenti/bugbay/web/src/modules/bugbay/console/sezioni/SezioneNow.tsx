/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sezione NOW della console-hub (v0.6): timeline LIVE degli `events` della spina,
 * via SSE (`useHubStream`, wiring invariato). Wave-2: ogni evento porta il payload
 * grezzo della riga `events` (JSON) — da cui si estrae `run_id` e il contesto di
 * fase (`phase_from → phase_to`) — così ogni riga è cliccabile e apre la RUN DETAIL
 * della sua run. Nessun import di store.ts/hub.ts: il `run_id` viaggia già nel
 * frame SSE, la navigazione passa dal parent (HubConsole) che monta RUN DETAIL.
 *
 * @indice
 * - parseEventData → estrae run_id + fasi dal payload JSON del frame SSE
 * - SezioneNow     → stato stream + lista eventi cliccabili → RUN DETAIL
 */

'use client';

import { Activity, Circle } from 'lucide-react';
import { useHubStream } from '../hub-stream';

const STATUS_LABEL = {
  connecting: 'Connessione…',
  open: 'Live',
  error: 'Endpoint non raggiungibile',
} as const;

const STATUS_COLOR = {
  connecting: 'text-amber-400',
  open: 'text-emerald-400',
  error: 'text-red-400',
} as const;

/** Estrae run_id e contesto di fase dal `data` JSON di un frame SSE (riga `events`). */
function parseEventData(data: string): { runId?: string; phaseFrom?: string; phaseTo?: string } {
  try {
    const o = JSON.parse(data) as { run_id?: string; phase_from?: string | null; phase_to?: string | null };
    return {
      runId: o.run_id ?? undefined,
      phaseFrom: o.phase_from ?? undefined,
      phaseTo: o.phase_to ?? undefined,
    };
  } catch {
    return {};
  }
}

export default function SezioneNow({ onSelectRun }: { onSelectRun: (runId: string) => void }) {
  const { status, count, events, clear } = useHubStream();

  return (
    <section className="space-y-s-4">
      <header className="flex items-center justify-between gap-s-4">
        <div className="flex items-center gap-s-2 text-sm font-mono text-neutral-300">
          <Activity className="w-4 h-4 bb-accent" />
          <span>Now — timeline live degli eventi</span>
        </div>
        <div className="flex items-center gap-s-3 text-xs font-mono">
          <span className={`inline-flex items-center gap-s-1 ${STATUS_COLOR[status]}`}>
            <Circle className="w-2 h-2 fill-current" /> {STATUS_LABEL[status]}
          </span>
          <span className="text-neutral-500">{count} eventi</span>
          <button onClick={clear} className="text-neutral-400 hover:text-white cursor-pointer">
            pulisci
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-md p-s-6 text-center text-xs font-mono text-neutral-500">
          {status === 'open' ? 'In ascolto. Nessun evento ancora.' : 'Nessun evento sul canale.'}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-850 border border-neutral-850 rounded-md overflow-hidden">
          {events.map((e, i) => {
            const { runId, phaseFrom, phaseTo } = parseEventData(e.data);
            const clickable = Boolean(runId);
            return (
              <li
                key={`${e.id}-${i}`}
                onClick={clickable ? () => onSelectRun(runId as string) : undefined}
                className={`flex items-center gap-s-3 px-s-4 py-s-2 text-xs font-mono bg-neutral-900 ${
                  clickable ? 'cursor-pointer hover:bg-neutral-850 transition-colors' : ''
                }`}
                title={clickable ? 'Apri la run' : undefined}
              >
                <span className="text-neutral-600 w-14 shrink-0">#{e.id}</span>
                <span className="bb-accent w-40 shrink-0 truncate">{e.name}</span>
                {(phaseFrom || phaseTo) && (
                  <span className="text-neutral-500 shrink-0">
                    {phaseFrom ?? '∅'} → {phaseTo ?? '∅'}
                  </span>
                )}
                <span className="text-neutral-400 truncate flex-1">{e.data}</span>
                {clickable && (
                  <span className="text-neutral-600 shrink-0 hidden sm:inline">apri →</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
