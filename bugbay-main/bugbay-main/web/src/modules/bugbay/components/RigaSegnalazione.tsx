/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Riga della tabella segnalazioni (vista Tabella della console): celle di
 * stato/categoria/priorità/area, azioni rapide contestuali allo stato della
 * pipeline e della run AI (interrompi/riprendi/rispondi/rivedi), più la riga
 * espansa con il dettaglio completo. Estratta da page.tsx (convenzione §3).
 *
 * @indice
 * - RigaSegnalazione → riga (+ eventuale riga espansa) della tabella
 */

'use client';

import { Fragment } from 'react';
import {
  CheckCircle, ArrowUpRight, CheckSquare, Wrench, ChevronDown, ChevronUp,
  Pencil, RotateCcw, Loader2, X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import type { SystemReport } from '@/modules/bugbay/types';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { AI_WORKING } from '@/modules/bugbay/config';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try { return format(parseISO(dateStr), 'd MMM yyyy, HH:mm', { locale: it }); }
  catch { return dateStr; }
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return '';
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); }
  catch { return dateStr; }
}

interface Props {
  report: SystemReport;
  aiRun?: AgentRun;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onGoToArea: (url?: string | null) => void;
  onOpenDetail: () => void;
  onOpenEdit: () => void;
  onUpdateStatus: (status: SystemReport['status']) => void;
  onStartResolve: () => void;
  onAbortRun: (run: AgentRun) => void;
  onResumeRun: (run: AgentRun) => void;
  onDismissError: () => void;
}

export function RigaSegnalazione({
  report, aiRun, selected, expanded,
  onToggleSelect, onToggleExpand, onGoToArea, onOpenDetail, onOpenEdit,
  onUpdateStatus, onStartResolve, onAbortRun, onResumeRun, onDismissError,
}: Props) {
  const isResolved = report.status === 'Risolto';
  const aiBusy = aiRun && AI_WORKING.includes(aiRun.phase);

  return (
    <Fragment>
      <tr
        className={`transition-colors text-sm ${
          aiRun ? 'bg-violet-500/10' : selected ? 'bg-violet-500/10' : isResolved ? 'opacity-60 bg-neutral-950/20 hover:opacity-100' : 'hover:bg-neutral-850/30'
        }`}
      >
        {/* Checkbox selezione (bloccato se la riga è in risoluzione AI) */}
        <td className="py-s-2 px-s-4 text-center">
          <input
            type="checkbox"
            className="w-4 h-4 accent-violet-500 cursor-pointer align-middle disabled:opacity-30 disabled:cursor-not-allowed"
            checked={selected}
            disabled={!!aiRun}
            onChange={onToggleSelect}
          />
        </td>

        {/* Espandi dettaglio inline */}
        <td className="py-s-2 px-s-4 text-center">
          <button
            onClick={onToggleExpand}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              expanded ? 'bg-neutral-800 text-white' : 'hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </td>

        {/* Stato */}
        <td className="py-s-2 px-s-4">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              report.status === 'Aperto' ? 'text-red'
                : report.status === 'In Lavorazione' || report.status === 'In Chiarimento' ? 'text-orange'
                : report.status === 'In Verifica' ? 'text-violet-300'
                : 'text-green'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                report.status === 'Aperto' ? 'bg-red animate-pulse'
                  : report.status === 'In Lavorazione' || report.status === 'In Chiarimento' ? 'bg-orange'
                  : report.status === 'In Verifica' ? 'bg-violet-400'
                  : 'bg-green'
              }`}
            />
            <span>{report.status}</span>
          </span>
        </td>

        {/* Categoria */}
        <td className="py-s-2 px-s-4 font-mono text-xs">
          <span
            className={`px-2 py-0.5 rounded-sm border text-[11px] font-semibold ${
              report.category === 'Bug' ? 'border-red/20 text-red bg-red/5'
                : report.category === 'Miglioria Proposta' ? 'border-orange/20 text-orange bg-orange/5'
                : 'border-green/20 text-green bg-green/5'
            }`}
          >
            {report.category}
          </span>
        </td>

        {/* Priorità */}
        <td className="py-s-2 px-s-4">
          <span
            className={`text-xs font-semibold ${
              report.priority === 'Bassa' ? 'text-neutral-400'
                : report.priority === 'Media' ? 'text-sky'
                : report.priority === 'Alta' ? 'text-orange'
                : report.priority === 'Urgente' ? 'text-red font-bold'
                : 'text-red font-extrabold animate-pulse'
            }`}
          >
            {report.priority}
          </span>
        </td>

        {/* Area */}
        <td className="py-s-2 px-s-4 font-semibold text-neutral-200">
          <div>
            {/* Origine progetto: valorizzata solo nella vista hub multi-progetto. */}
            {report.projectName && (
              <span className="inline-block mb-0.5 px-1.5 py-0.5 rounded-sm bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[10px] font-bold uppercase tracking-wide">
                {report.projectName}
              </span>
            )}
            <span className="block">{report.area}</span>
            {report.subArea && (
              <span className="text-neutral-500 font-normal text-xs block mt-0.5">
                &gt; <span className="text-sky font-medium">{report.subArea}</span>
              </span>
            )}
          </div>
        </td>

        {/* Sviluppatore */}
        <td className="py-s-2 px-s-4 text-xs font-semibold">
          {report.developer ? (
            <span className="px-2 py-0.5 rounded-sm bg-neutral-850 text-neutral-300 border border-neutral-800 capitalize">
              {report.developer}
            </span>
          ) : (
            <span className="text-neutral-500 font-normal italic text-[11px]">Generale</span>
          )}
        </td>

        {/* Anteprima descrizione */}
        <td className="py-s-2 px-s-4 max-w-xs truncate text-neutral-400 text-xs font-light" title={report.notes}>
          <span className={isResolved ? 'line-through opacity-70' : ''}>{report.notes}</span>
        </td>

        {/* Data */}
        <td className="py-s-2 px-s-4 text-xs text-neutral-500 font-mono whitespace-nowrap">
          {formatDateShort(report.createdAt)}
        </td>

        {/* Azioni rapide */}
        <td className="py-s-2 px-s-4 text-right">
          <div className="inline-flex gap-s-2 items-center">
            <button
              onClick={() => onGoToArea(report.url)}
              disabled={!report.url}
              className="p-2.5 rounded bg-sky/10 hover:bg-sky text-sky hover:text-navy border border-sky/20 hover:border-sky transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              title={report.url ? `Vai all'area: ${report.url}` : 'Nessuna area indicata'}
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>

            {aiRun ? (
              <>
                {aiBusy && (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-violet-300 whitespace-nowrap">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {aiRun.phase === 'queued' ? 'In coda…' : aiRun.phase === 'interpreting' ? 'Interpreto…' : aiRun.phase === 'verifying' ? 'Verifico…' : 'In elaborazione…'}
                    </span>
                    <button
                      onClick={() => onAbortRun(aiRun)}
                      title="Interrompi l'AI"
                      className="p-2.5 rounded bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                {aiRun.phase === 'needs_clarification' && (
                  <button
                    onClick={onOpenDetail}
                    className="px-s-3 py-s-2 text-xs font-bold uppercase tracking-wider rounded bg-orange/10 text-orange border border-orange/20 hover:bg-orange hover:text-white transition-colors cursor-pointer"
                  >
                    Rispondi
                  </button>
                )}
                {aiRun.phase === 'review' && (
                  <button
                    onClick={onOpenDetail}
                    className="px-s-3 py-s-2 text-xs font-bold uppercase tracking-wider rounded bg-green/10 text-green border border-green/20 hover:bg-green hover:text-navy transition-colors cursor-pointer"
                  >
                    Rivedi
                  </button>
                )}
                {aiRun.phase === 'paused' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-neutral-400 whitespace-nowrap">⏸ In pausa</span>
                    <button
                      onClick={() => onResumeRun(aiRun)}
                      className="px-s-3 py-s-2 text-xs font-bold uppercase tracking-wider rounded bg-sky/10 text-sky border border-sky/20 hover:bg-sky hover:text-navy transition-colors cursor-pointer"
                      title="Riprendi la run"
                    >
                      Riprendi
                    </button>
                    <button
                      onClick={() => onAbortRun(aiRun)}
                      title="Interrompi definitivamente"
                      className="p-2 rounded bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
                {aiRun.phase === 'error' && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-xs text-red" title={aiRun.error}>Errore</span>
                    <button
                      onClick={() => onResumeRun(aiRun)}
                      className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-sky/10 text-sky border border-sky/20 hover:bg-sky hover:text-navy transition-colors cursor-pointer"
                      title="Rilancia la run"
                    >
                      Rilancia
                    </button>
                    <button
                      onClick={onDismissError}
                      className="p-1.5 rounded text-neutral-400 hover:text-white cursor-pointer"
                      title="Chiudi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onOpenEdit}
                  className="p-2.5 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                  title="Modifica"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {report.status === 'In Lavorazione' && (
                  <button
                    onClick={() => onUpdateStatus('Aperto')}
                    className="p-2.5 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-orange border border-neutral-800 transition-colors cursor-pointer"
                    title="Rilascia (Torna in Aperto)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {report.status === 'Aperto' && (
                  <button
                    onClick={() => onUpdateStatus('In Lavorazione')}
                    className="p-2.5 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                    title="Prendi in Carico"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                )}

                {report.status !== 'Risolto' ? (
                  <button
                    onClick={onStartResolve}
                    className="p-2.5 rounded bg-green/10 hover:bg-green text-green hover:text-navy border border-green/20 hover:border-green transition-all cursor-pointer font-bold"
                    title="Segna come Risolto"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdateStatus('Aperto')}
                    className="px-s-3 py-s-2 text-xs font-bold uppercase tracking-wider rounded bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Riapri"
                  >
                    Riapri
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Riga espansa con il dettaglio completo */}
      {expanded && (
        <tr className="bg-neutral-950/40">
          <td colSpan={10} className="p-s-4 border-b border-neutral-850">
            <div className="space-y-s-3 font-sans text-xs max-w-5xl">
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold block">
                  Descrizione Dettagliata:
                </span>
                <p className="text-neutral-250 whitespace-pre-wrap leading-relaxed bg-neutral-900/60 p-s-3 rounded border border-neutral-850">
                  {report.notes}
                </p>
              </div>

              {report.url && (
                <div className="flex items-center gap-s-2 text-neutral-450 font-mono text-[11px]">
                  <span className="font-bold uppercase text-[9px] tracking-wider text-neutral-500">URL:</span>
                  <a href={report.url} target="_blank" rel="noreferrer" className="text-sky hover:underline flex items-center gap-s-1">
                    {report.url} <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center gap-s-4 text-neutral-500 text-[10px]">
                <div><span className="font-bold uppercase tracking-wider">Creato:</span> {formatDate(report.createdAt)}</div>
                <div><span className="font-bold uppercase tracking-wider">Segnalatore:</span> {report.reporterName || 'N/D'}</div>
              </div>

              {report.status === 'Risolto' && (
                <div className="bg-green/5 border border-green/20 rounded p-s-3 space-y-s-1">
                  <div className="text-[10px] font-bold text-green flex items-center gap-s-1 uppercase tracking-wider">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Risolto il {formatDate(report.resolvedAt || report.createdAt)}</span>
                  </div>
                  {report.resolutionNotes && (
                    <p className="text-green/80 italic whitespace-pre-wrap pl-s-4 border-l border-green/20">
                      &ldquo;{report.resolutionNotes}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
