/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Riga della tabella di gestione agenti (sala macchine): identificativo run,
 * segnalazione, badge di fase, provider, modifiche, telemetria token/costo e
 * azioni (ferma/riprendi/revisiona/arresta/elimina), più la riga espansa con
 * la console dei log della run.
 *
 * @indice
 * - badgeFase / etichettaFase → stile e label della fase di una run
 * - GestioneAgentiRiga        → riga (+ log espansi) della tabella agenti
 */

'use client';

import React from 'react';
import { Play, Pause, XCircle, Terminal, CheckCircle2, Trash2 } from 'lucide-react';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { AI_WORKING } from '@/modules/bugbay/config';

export function badgeFase(phase: string): string {
  switch (phase) {
    case 'queued': return 'bg-neutral-800 text-neutral-400 border-neutral-700 animate-pulse';
    case 'interpreting': return 'bg-blue/10 text-blue border-blue/20 animate-pulse';
    case 'fixing': return 'bg-orange/10 text-orange border-orange/20 animate-pulse';
    case 'verifying': return 'bg-violet/15 text-violet border-violet/30 animate-pulse';
    case 'paused': return 'bg-neutral-850 text-neutral-455 border-neutral-800';
    case 'needs_clarification': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'review': return 'bg-green/10 text-green border-green/20 border-double border-2 animate-pulse';
    case 'approved': return 'bg-green/10 text-green border-green/20';
    case 'discarded':
    case 'aborted': return 'bg-red/10 text-red border-red/20';
    case 'error': return 'bg-red text-white border-red';
    default: return 'bg-neutral-900 text-neutral-300 border-neutral-800';
  }
}

export function etichettaFase(phase: string): string {
  switch (phase) {
    case 'queued': return 'In Coda';
    case 'interpreting': return 'Analisi';
    case 'fixing': return 'Scrittura Codice';
    case 'verifying': return 'Verifica compilation';
    case 'paused': return 'Fermata (riprendibile)';
    case 'needs_clarification': return 'Attesa Chiarimento';
    case 'review': return 'Pronto Revisione';
    case 'approved': return 'Approvato & Committato';
    case 'discarded': return 'Scartato';
    case 'aborted': return 'Cancellato';
    case 'error': return 'Errore';
    default: return phase;
  }
}

interface Props {
  run: AgentRun;
  selected: boolean;
  logsOpen: boolean;
  onToggleSelect: () => void;
  onToggleLogs: () => void;
  onPause: () => void;
  onResume: () => void;
  onReview: () => void;
  onAbort: () => void;
  onDelete: () => void;
}

export function GestioneAgentiRiga({
  run, selected, logsOpen,
  onToggleSelect, onToggleLogs, onPause, onResume, onReview, onAbort, onDelete,
}: Props) {
  const isWorking = AI_WORKING.includes(run.phase);
  const isPaused = run.phase === 'paused';
  const isFailedOrStopped = ['discarded', 'aborted', 'error'].includes(run.phase);
  const isReview = run.phase === 'review' || run.phase === 'needs_clarification';

  return (
    <React.Fragment>
      <tr
        className={`border-b border-neutral-900/60 hover:bg-neutral-900/35 transition-colors ${
          isWorking ? 'bg-sky/5' : isPaused ? 'bg-neutral-900/10' : ''
        }`}
      >
        <td className="py-4 px-4 w-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="rounded border-neutral-800 bg-neutral-950 focus:ring-0 cursor-pointer"
          />
        </td>
        <td className="py-4 px-4 font-mono text-[11px] text-neutral-400">
          <span className="text-white font-bold block">#{run.runId}</span>
          <span className="text-[10px] text-neutral-500">{new Date(run.createdAt).toLocaleString('it-IT')}</span>
        </td>
        <td className="py-4 px-4 max-w-sm">
          <span className="text-xs font-semibold text-neutral-200 block truncate" title={run.reportTitolo}>
            {run.reportTitolo}
          </span>
          {run.branch && (
            <span className="text-[9px] font-mono bg-neutral-900 px-1.5 py-0.5 rounded-sm text-neutral-550 inline-block mt-1">
              branch: {run.branch}
            </span>
          )}
        </td>
        <td className="py-4 px-4">
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm border ${badgeFase(run.phase)}`}>
            {etichettaFase(run.phase)}
          </span>
        </td>
        <td className="py-4 px-4 text-xs font-semibold text-neutral-400 uppercase">
          {run.provider || 'claude-headless'}
        </td>
        <td className="py-4 px-4 text-xs">
          {run.modifiche.length > 0 ? (
            <span className="text-green font-semibold" title={run.modifiche.map((m) => m.path).join(', ')}>
              {run.modifiche.length} file modificati
              {run.codemod && <span className="ml-1 text-[9px] font-bold text-sky" title="Risolto da codemod deterministico, 0 token LLM">· 0-token</span>}
            </span>
          ) : run.scopedFiles.length > 0 ? (
            <span className="text-neutral-500">{run.scopedFiles.length} file analizzati</span>
          ) : (
            <span className="text-neutral-600">-</span>
          )}
        </td>
        <td className="py-4 px-4 text-[11px] font-mono text-neutral-400 whitespace-nowrap">
          {run.usage ? (
            <div title={`${run.usage.calls} chiamate LLM`}>
              <span className="text-neutral-300 tabular-nums">{(run.usage.inputTokens / 1000).toFixed(1)}k</span>
              <span className="text-neutral-600"> in · </span>
              <span className="text-neutral-300 tabular-nums">{(run.usage.outputTokens / 1000).toFixed(1)}k</span>
              <span className="text-neutral-600"> out</span>
              {run.startedAt && run.finishedAt && (
                <span className="block text-neutral-600">{Math.max(1, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s</span>
              )}
            </div>
          ) : run.codemod ? (
            <span className="text-sky font-semibold">0 token (codemod)</span>
          ) : (
            <span className="text-neutral-600">-</span>
          )}
        </td>
        <td className="py-4 px-4 text-right">
          <div className="flex items-center justify-end gap-s-2">
            <button
              onClick={onToggleLogs}
              className={`p-s-2 rounded-sm border transition-all cursor-pointer ${
                logsOpen
                  ? 'bg-neutral-100 text-neutral-900 border-neutral-100'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-850 hover:text-white'
              }`}
              title="Mostra Terminale Log"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>

            {isWorking && (
              <button
                onClick={onPause}
                className="px-s-3 py-s-2 rounded-sm bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-850 hover:border-neutral-750 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                title="Ferma la run (i processi vengono interrotti e le modifiche della run annullate; potrai rilanciarla da capo)"
              >
                <Pause className="w-3 h-3 text-amber-500" />
                Ferma
              </button>
            )}

            {(isPaused || isFailedOrStopped) && (
              <button
                onClick={onResume}
                className="px-s-3 py-s-2 rounded-sm bg-sky/10 text-sky hover:bg-sky hover:text-navy border border-sky/20 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                title="Riprendi/Rilancia esecuzione"
              >
                <Play className="w-3 h-3" />
                Riprendi
              </button>
            )}

            {isReview && (
              <button
                onClick={onReview}
                className="px-s-3 py-s-2 rounded-sm bg-green/15 text-green hover:bg-green hover:text-navy border border-green/30 transition-all text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                title="Apri la revisione della risoluzione"
              >
                <CheckCircle2 className="w-3 h-3" />
                Revisiona
              </button>
            )}

            {!['approved', 'discarded', 'aborted'].includes(run.phase) && (
              <button
                onClick={onAbort}
                className="p-s-2 rounded-sm bg-neutral-900 text-neutral-500 hover:text-red border border-neutral-850 hover:border-red/20 transition-all cursor-pointer"
                title="Forza arresto"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onDelete}
              className="p-s-2 rounded-sm bg-neutral-900 text-neutral-500 hover:text-red border border-neutral-850 hover:border-red/20 transition-all cursor-pointer"
              title="Elimina definitivo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Console log espansa */}
      {logsOpen && (
        <tr className="bg-black/30">
          <td colSpan={8} className="py-3 px-6">
            <div className="border border-neutral-900 rounded-sm bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300 shadow-inner">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-3 text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-neutral-400" />
                  Console Log per Run #{run.runId}
                </span>
                <span>{run.log.length} righe registrate</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-850 pr-2">
                {run.log.length === 0 ? (
                  <p className="text-neutral-600 italic">Nessun log registrato per questa run.</p>
                ) : (
                  run.log.map((line, idx) => {
                    let textCls = 'text-neutral-400';
                    if (line.includes('Errore') || line.includes('fallito')) textCls = 'text-red font-semibold';
                    else if (line.includes('Approvato') || line.includes('Risolto')) textCls = 'text-green font-semibold';
                    else if (line.includes('Ripresa') || line.includes('avviato')) textCls = 'text-sky font-semibold';
                    else if (line.includes('PAUSA')) textCls = 'text-amber-500 font-semibold';
                    return (
                      <div key={idx} className={`leading-relaxed break-all ${textCls}`}>
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
