/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Shell della console-hub v0.6 (osservabilità delle run) con la nav top-level
 * INBOX / NOW / SYSTEM. Wave-2: i frame ospitano le viste ricche — INBOX
 * daily-review, NOW live-SSE — e la selezione di una run apre RUN DETAIL
 * (evidence-first) al posto della sezione, con un controllo "Indietro". Distinta
 * dalla console di triage (/debugging): questa rende `events`+`observations`
 * prodotti dalle run, non le segnalazioni.
 *
 * @indice
 * - SEZIONI    → descrittori delle tre schede della nav
 * - HubConsole → shell + switcher + selezione run → RUN DETAIL
 */

'use client';

import { useState } from 'react';
import { Inbox, Activity, ServerCog, BarChart3 } from 'lucide-react';
import { BugBayLogo } from '@/modules/bugbay/components/BugBayLogo';
import SezioneInbox from './sezioni/SezioneInbox';
import SezioneNow from './sezioni/SezioneNow';
import SezioneSystem from './sezioni/SezioneSystem';
import SezioneKpi from './sezioni/SezioneKpi';
import RunDetail from './RunDetail';

type SezioneId = 'inbox' | 'now' | 'system' | 'kpi';

const SEZIONI = [
  { id: 'inbox', label: 'Inbox', Icon: Inbox },
  { id: 'now', label: 'Now', Icon: Activity },
  { id: 'system', label: 'System', Icon: ServerCog },
  { id: 'kpi', label: 'KPI', Icon: BarChart3 },
] as const satisfies ReadonlyArray<{ id: SezioneId; label: string; Icon: typeof Inbox }>;

export default function HubConsole() {
  const [sezione, setSezione] = useState<SezioneId>('inbox');
  // Run selezionata (da INBOX o NOW): quando valorizzata, il frame mostra RUN DETAIL.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  return (
    <div className="min-h-screen text-neutral-200 pb-20 font-body">
      {/* Barra hazard: firma visiva BUG BAY */}
      <div className="bb-hazard h-1.5 w-full" aria-hidden />

      <div className="p-s-6 space-y-s-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-s-4 border-b border-neutral-850 pb-s-6 max-w-[1800px] mx-auto">
          <div>
            <h1 className="text-d2 font-display font-bold text-white flex items-center gap-s-3 tracking-tight">
              <BugBayLogo className="w-14 h-14 bb-accent shrink-0" />
              <span className="bb-wordmark">Bug&nbsp;Bay</span>
              <span className="ml-s-1 px-s-3 py-1 rounded-md bb-accent-dim bb-accent text-[11px] font-mono font-bold uppercase tracking-wider self-center">
                Hub
              </span>
            </h1>
            <p className="text-sm font-mono text-neutral-400 mt-s-1">
              Run observability — events &amp; traces from intake to verdict.
            </p>
          </div>
        </div>

        {/* Nav top-level: INBOX / NOW / SYSTEM */}
        <div className="max-w-[1800px] mx-auto">
          <div className="inline-flex items-center gap-1 bg-neutral-900 border border-neutral-850 rounded-md p-1 shadow-sh-1">
            {SEZIONI.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setSezione(id);
                  setSelectedRunId(null); // cambiare sezione esce dal RUN DETAIL
                }}
                className={`px-s-5 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm transition-all cursor-pointer inline-flex items-center gap-s-2 ${
                  sezione === id && !selectedRunId ? 'bb-accent-bg shadow-sh-1' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Frame: RUN DETAIL se una run è selezionata, altrimenti la sezione attiva. */}
        <div className="max-w-[1800px] mx-auto">
          {selectedRunId ? (
            <RunDetail runId={selectedRunId} onBack={() => setSelectedRunId(null)} />
          ) : (
            <>
              {sezione === 'inbox' && <SezioneInbox onSelectRun={setSelectedRunId} />}
              {sezione === 'now' && <SezioneNow onSelectRun={setSelectedRunId} />}
              {sezione === 'system' && <SezioneSystem />}
              {sezione === 'kpi' && <SezioneKpi />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
