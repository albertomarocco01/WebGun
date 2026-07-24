/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sala macchine del fix agentico: strip fissa in fondo alla console, visibile
 * da ogni vista, con le run attive (fase live), i conteggi e la diagnostica
 * d'ambiente. Espandibile in un drawer che incapsula la gestione completa
 * degli agenti (GestioneAgenti: log, pausa/riprendi, telemetria, elimina).
 *
 * @indice
 * - SalaMacchine → strip + drawer della gestione agenti
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Loader2, ChevronUp, X, AlertTriangle } from 'lucide-react';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import GestioneAgenti from './GestioneAgenti';

const AI_WORKING = ['queued', 'interpreting', 'fixing', 'verifying'];

interface Props {
  aiRuns: Record<string, AgentRun>;
  setAiRuns: React.Dispatch<React.SetStateAction<Record<string, AgentRun>>>;
  onOpenDetail: (reportId: string) => void;
  onRefreshReports: () => void;
}

export default function SalaMacchine({ aiRuns, setAiRuns, onOpenDetail, onRefreshReports }: Props) {
  const [open, setOpen] = useState(false);
  const [envWarning, setEnvWarning] = useState(false);

  useEffect(() => {
    fetch('/api/agent-fix?diagnostics=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setEnvWarning(!d.tscExecutable || !d.gitOk); })
      .catch(() => { /* ignore */ });
  }, []);

  // Run uniche (le batch compaiono una volta sola), divise per stato
  const { working, attention } = useMemo(() => {
    const seen = new Map<string, AgentRun>();
    for (const r of Object.values(aiRuns)) seen.set(r.runId, r);
    const runs = [...seen.values()];
    return {
      working: runs.filter((r) => AI_WORKING.includes(r.phase)),
      attention: runs.filter((r) => r.phase === 'review' || r.phase === 'needs_clarification'),
    };
  }, [aiRuns]);

  return (
    <>
      {/* Strip fissa */}
      <div className="fixed bottom-0 left-0 right-0 z-[55] bg-neutral-950/95 backdrop-blur border-t border-neutral-850 shadow-sh-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full max-w-[1800px] mx-auto flex items-center gap-s-4 px-s-5 py-s-3 text-left cursor-pointer hover:bg-neutral-900/60 transition-colors"
        >
          <span className="inline-flex items-center gap-s-2 text-xs font-display font-bold uppercase tracking-wider text-neutral-400 shrink-0">
            <Cpu className="w-4 h-4 bb-accent" /> Sala macchine
          </span>

          {envWarning && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Problemi ambiente
            </span>
          )}

          <span className="flex items-center gap-s-3 text-[11px] text-neutral-400 min-w-0 overflow-hidden">
            {working.length === 0 ? (
              <span className="text-neutral-600">Nessuna run in corso</span>
            ) : (
              working.slice(0, 3).map((r) => (
                <span key={r.runId} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill bg-sky/10 border border-sky/20 text-sky font-mono shrink-0">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  #{r.runId} · {r.phase}
                </span>
              ))
            )}
            {working.length > 3 && <span className="text-neutral-500 shrink-0">+{working.length - 3}</span>}
            {working[0]?.live && (
              <span className="hidden md:inline text-neutral-500 font-mono truncate" title={working[0].live}>
                {working[0].live}
              </span>
            )}
          </span>

          <span className="ml-auto flex items-center gap-s-4 shrink-0 text-[11px] font-mono text-neutral-500">
            {attention.length > 0 && (
              <span className="text-violet-300 font-bold">{attention.length} da rivedere</span>
            )}
            <ChevronUp className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </div>

      {/* Drawer espanso con la gestione completa degli agenti */}
      {open && (
        <div className="fixed inset-0 z-[9000] flex flex-col justify-end bg-neutral-950/60 backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="h-[78vh] bg-neutral-950 border-t border-neutral-800 shadow-sh-3 overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-s-5 py-s-3 bg-neutral-950/95 backdrop-blur border-b border-neutral-850">
              <span className="inline-flex items-center gap-s-2 text-sm font-bold text-white">
                <Cpu className="w-4 h-4 text-sky" /> Sala macchine — Gestione agenti
              </span>
              <button onClick={() => setOpen(false)} className="p-s-2 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-s-5 pb-s-8">
              <GestioneAgenti
                onOpenReviewModal={(reportId) => { setOpen(false); onOpenDetail(reportId); }}
                setParentAiRuns={setAiRuns}
                onRefreshParentReports={onRefreshReports}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
