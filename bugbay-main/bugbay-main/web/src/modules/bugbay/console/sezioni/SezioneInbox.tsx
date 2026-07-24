/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sezione INBOX della console-hub (v0.6 Wave-2): superficie di revisione
 * quotidiana. Elenca le run in attesa di un giudizio umano — `review` (fix pronto
 * da approvare/scartare) e `needs_clarification` (segnalazione vaga in attesa di
 * risposta) — le più recenti in testa, via la API read-only /api/agent-fix/hub?inbox=1
 * (il client NON importa store.ts: passa sempre dalla route). Ogni riga apre la
 * RUN DETAIL evidence-first. Il compile-job schedulato è territorio v0.7: qui è
 * una query live pollata a intervallo.
 *
 * @indice
 * - SezioneInbox → lista live delle run da revisionare, riga → RUN DETAIL
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, RotateCw, MessageCircleQuestion, ClipboardCheck, ChevronRight } from 'lucide-react';
import type { InboxResponse, InboxRun } from '../run-detail-types';

const INBOX_API = '/api/agent-fix/hub?inbox=1';
const POLL_MS = 5000;

/** Età leggibile a partire dal momento più significativo della run. */
function age(run: InboxRun): string {
  const iso = run.finishedAt ?? run.startedAt ?? run.createdAt;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.round(h / 24)}g fa`;
}

export default function SezioneInbox({ onSelectRun }: { onSelectRun: (runId: string) => void }) {
  const [runs, setRuns] = useState<InboxRun[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback((silent = false) => {
    if (!silent) setStatus('loading');
    fetch(INBOX_API)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<InboxResponse>;
      })
      .then((d) => {
        setRuns(d.runs);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  // Primo carico + poll leggero (query read-only, nessun side-effect sulla spina).
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section className="space-y-s-4">
      <header className="flex items-center justify-between gap-s-4">
        <div className="flex items-center gap-s-2 text-sm font-mono text-neutral-300">
          <Inbox className="w-4 h-4 bb-accent" />
          <span>Inbox — revisione quotidiana</span>
          {runs && (
            <span className="text-neutral-600">
              {runs.length} {runs.length === 1 ? 'run' : 'run'} in attesa
            </span>
          )}
        </div>
        <button
          onClick={() => load()}
          title="Ricarica"
          className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {status === 'error' ? (
        <div className="border border-red/30 bg-red/5 rounded-md p-s-6 text-center text-sm font-mono text-red">
          Impossibile caricare la coda di revisione.
        </div>
      ) : runs && runs.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-md p-s-8 text-center">
          <ClipboardCheck className="w-8 h-8 mx-auto text-neutral-600" />
          <p className="mt-s-3 text-sm font-mono text-neutral-400">Nessuna run in attesa di revisione.</p>
          <p className="mt-s-1 text-xs font-mono text-neutral-600">Tutto approvato o scartato — coda pulita.</p>
        </div>
      ) : !runs ? (
        <div className="border border-dashed border-neutral-800 rounded-md p-s-8 text-center text-xs font-mono text-neutral-500">
          Caricamento…
        </div>
      ) : (
        <ul className="divide-y divide-neutral-850 border border-neutral-850 rounded-md overflow-hidden">
          {runs.map((run) => {
            const needsClarify = run.phase === 'needs_clarification';
            return (
              <li key={run.runId}>
                <button
                  type="button"
                  onClick={() => onSelectRun(run.runId)}
                  className="w-full flex items-center gap-s-3 px-s-4 py-s-3 text-left bg-neutral-900 hover:bg-neutral-850 transition-colors cursor-pointer group"
                >
                  {needsClarify ? (
                    <MessageCircleQuestion className="w-4 h-4 text-orange shrink-0" />
                  ) : (
                    <ClipboardCheck className="w-4 h-4 bb-accent shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-200 truncate group-hover:text-white">
                      {run.reportTitolo}
                      {run.reportsCount > 1 && (
                        <span className="ml-s-2 text-[11px] font-mono text-neutral-500">
                          +{run.reportsCount - 1}
                        </span>
                      )}
                    </p>
                    {needsClarify && run.domanda && (
                      <p className="text-[11px] font-mono text-orange/80 truncate mt-0.5">{run.domanda}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-s-2 py-0.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                      needsClarify ? 'text-orange border-orange/40' : 'bb-accent bb-accent-border'
                    }`}
                  >
                    {run.phase.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500 shrink-0 tabular-nums hidden sm:inline">
                    {run.modificheCount > 0 && `${run.modificheCount} file · `}
                    {age(run)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0 group-hover:text-neutral-300" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
