/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Riga di una voce della Campagna di revisione QA (modello DB-backed): toggle
 * da-controllare/ok/problema, badge della voce (+ "nuovo" sulle voci dell'ultimo
 * refresh), file e URL toccati, stato live della run AI collegata, area note con
 * riformulazione e azioni AI contestuali, ed eliminazione della voce (🗑).
 *
 * @indice
 * - ItemRow → riga della checklist di campagna
 */

'use client';

import { CheckCircle, XCircle, ArrowUpRight, Sparkles, Loader2, Save, MessageCircleQuestion, Trash2 } from 'lucide-react';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { type ChecklistItemRow, type RevisioneBadge } from '@/modules/bugbay/data/revisione-checklist';
import { WandRiformula } from '../RiformulazioneAI';
import type { StatoVoce } from './revisione-stato';

const BADGE_STYLE: Record<RevisioneBadge, { cls: string; text: string }> = {
  manual:   { cls: 'bg-neutral-800 text-neutral-300 border-neutral-700', text: 'Manual' },
  ai:       { cls: 'bg-sky/10 text-sky border-sky/20', text: 'AI' },
  bugfix:   { cls: 'bg-orange/10 text-orange border-orange/20', text: 'Bugfix' },
  critical: { cls: 'bg-red/10 text-red border-red/20', text: 'Critico' },
};

interface Props {
  item: ChecklistItemRow;
  /** Stato di review effettivo (sovrascritto a undefined quando c'è una run AI live). */
  status?: StatoVoce;
  note: string;
  notesOpen: boolean;
  onOk: () => void;
  onIssue: () => void;
  onToggleNote: () => void;
  onNote: (v: string) => void;
  onGo: (url: string) => void;
  onDelete: () => void;
  onResolveAi?: () => void;
  run?: AgentRun | null;
  onOpenAiModal?: () => void;
  onAbortAi?: () => void;
  onSaveNote: () => void;
  isSaving: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  aiProvider?: 'claude-headless' | 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepseekApiKey?: string;
}

export function ItemRow({
  item, status, note, notesOpen, onOk, onIssue, onToggleNote, onNote, onGo, onDelete,
  onResolveAi, run, onOpenAiModal, onAbortAi,
  onSaveNote, isSaving, isSelected, onToggleSelect,
  aiProvider, geminiApiKey, deepseekApiKey,
}: Props) {
  const runPhase = run?.phase ?? '';
  const isWorking = ['queued', 'interpreting', 'fixing', 'verifying'].includes(runPhase);
  const isReview = runPhase === 'review';
  const isNeedsClarification = runPhase === 'needs_clarification';
  const isError = runPhase === 'error';

  let rowBg = '';
  let rowBorder = 'border-b border-neutral-850 last:border-b-0';

  if (isWorking) {
    rowBg = 'bg-sky-500/5 animate-pulse';
  } else if (isReview) {
    rowBg = 'bg-violet-500/10';
    rowBorder = 'border-b border-neutral-850 last:border-b-0 border-l-2 border-l-violet-500';
  } else if (isNeedsClarification) {
    rowBg = 'bg-orange-500/5';
    rowBorder = 'border-b border-neutral-850 last:border-b-0 border-l-2 border-l-orange-500';
  } else if (isError) {
    rowBg = 'bg-red-500/5';
    rowBorder = 'border-b border-neutral-850 last:border-b-0 border-l-2 border-l-red-500';
  } else if (status === 'ok') {
    rowBg = 'bg-green/5';
  } else if (status === 'problema') {
    rowBg = 'bg-red/5';
  }

  const handleDelete = () => {
    if (confirm(`Eliminare la voce "${item.label}"?`)) onDelete();
  };

  return (
    <div className={`flex gap-s-3 px-s-5 py-s-3 ${rowBorder} ${rowBg}`}>
      <div className="flex items-start shrink-0 pt-1.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 accent-sky cursor-pointer rounded border-neutral-800 bg-neutral-950"
        />
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={onOk}
          title="Verificato — OK"
          className={`w-8 h-8 rounded-sm flex items-center justify-center border transition-colors cursor-pointer ${status === 'ok' ? 'bg-green text-navy border-green' : 'bg-neutral-850 text-neutral-500 border-neutral-800 hover:text-green'}`}
        >
          <CheckCircle className="w-4 h-4" />
        </button>
        <button
          onClick={onIssue}
          title="Problema — da sistemare"
          className={`w-8 h-8 rounded-sm flex items-center justify-center border transition-colors cursor-pointer ${status === 'problema' ? 'bg-red text-white border-red' : 'bg-neutral-850 text-neutral-500 border-neutral-800 hover:text-red'}`}
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-s-2">
          <span className={`font-semibold text-sm ${status === 'ok' ? 'text-neutral-400 line-through' : 'text-neutral-100'}`}>{item.label}</span>

          {item.isNew && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky/15 text-sky border border-sky/30 animate-pulse">
              nuovo
            </span>
          )}

          {isWorking && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky border border-sky-500/30 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>AI: {runPhase === 'queued' ? 'In coda' : `Risoluzione in corso (${runPhase})`}...</span>
            </span>
          )}

          {isReview && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-300 animate-pulse" />
              <span>Risolto con AI (Da verificare)</span>
            </span>
          )}

          {isNeedsClarification && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange border border-orange-500/30 flex items-center gap-1">
              <MessageCircleQuestion className="w-3 h-3" />
              <span>AI chiede chiarimento</span>
            </span>
          )}

          {isError && (
            <button
              onClick={onOpenAiModal}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red border border-red-500/30 hover:bg-red-500/30 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              title="Clicca per visualizzare i dettagli dell'errore"
            >
              <XCircle className="w-3 h-3" />
              <span>AI Fallito (Clicca per dettagli)</span>
            </button>
          )}

          {item.priority && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-neutral-800 text-neutral-350 border-neutral-700">{item.priority}</span>
          )}

          {item.badges.map((b) => (
            <span key={b} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${BADGE_STYLE[b].cls}`}>{BADGE_STYLE[b].text}</span>
          ))}
        </div>

        {(item.files.length > 0 || item.urls.length > 0) && (
          <div className="flex flex-wrap items-center gap-s-2 mt-1">
            {item.files.map((f) => (
              <span key={f} className="text-[11px] font-mono text-neutral-500">{f}</span>
            ))}
            {item.urls.map((u) => (
              <button
                key={u.url}
                onClick={() => onGo(u.url)}
                className="text-[11px] text-sky hover:underline inline-flex items-center gap-0.5 cursor-pointer"
              >
                {u.label} <ArrowUpRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {isReview && run?.riassunto ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <p className="text-xs text-neutral-500 leading-relaxed italic">{item.descr}</p>
            <div className="p-2.5 rounded bg-violet-500/5 border border-violet-500/10 text-xs text-violet-300/90 leading-relaxed whitespace-pre-wrap">
              <p className="font-semibold text-violet-200 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-300 animate-pulse" />
                <span>Modifiche apportate dall&apos;AI:</span>
              </p>
              {run.riassunto}
            </div>
          </div>
        ) : (
          item.descr && <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{item.descr}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button onClick={onToggleNote} className="text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer">
            {notesOpen ? '− chiudi nota' : '+ note & AI'}
          </button>

          <button
            onClick={handleDelete}
            title="Elimina questa voce"
            className="text-[11px] text-neutral-500 hover:text-red inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Elimina
          </button>

          {!notesOpen && run && (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <span>· Stato AI:</span>
              <span className={`${isReview ? 'text-violet-400 font-bold animate-pulse' : isNeedsClarification ? 'text-orange-400 font-bold' : isError ? 'text-red-400' : 'text-sky'} font-semibold`}>
                {runPhase}
              </span>
              {onOpenAiModal && (isReview || isNeedsClarification || isError) && (
                <button
                  onClick={onOpenAiModal}
                  className={`ml-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition-all cursor-pointer ${
                    isReview
                      ? 'bg-violet-500/10 text-violet-305 hover:bg-violet-500/20'
                      : isNeedsClarification
                      ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  {isReview ? 'Vedi modifiche →' : isNeedsClarification ? 'Riprendi →' : 'Vedi errore →'}
                </button>
              )}
            </span>
          )}
        </div>

        {notesOpen && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-s-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">Note specifiche sul problema</label>
              <WandRiformula
                value={note}
                onApply={(t) => onNote(t)}
                provider={aiProvider}
                geminiApiKey={aiProvider === 'gemini' ? geminiApiKey : undefined}
                deepseekApiKey={aiProvider === 'deepseek' ? deepseekApiKey : undefined}
                itemLabel={`Nota checklist · ${item.label}`}
                itemDesc={item.descr}
                itemPath={item.files[0] ?? item.sectionTitle}
              />
            </div>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Note specifiche sul problema da correggere..."
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-3 px-3 text-sm focus:outline-none focus:border-neutral-700 min-h-[140px] resize-y leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-s-3 mt-1 bg-neutral-950/40 p-s-3 rounded-sm border border-neutral-850">
              <div className="flex flex-wrap items-center gap-s-2">
                <button
                  onClick={onSaveNote}
                  disabled={isSaving}
                  className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-green/10 border border-green/30 hover:border-green/50 text-green hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salva nota</span>
                    </>
                  )}
                </button>

                {/* Azioni AI contestuali allo stato della run */}
                {isWorking ? (
                  onAbortAi && (
                    <button
                      onClick={onAbortAi}
                      className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-red/10 border border-red/30 hover:bg-red/20 text-red hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red" />
                      <span>Interrompi AI</span>
                    </button>
                  )
                ) : isReview ? (
                  <div className="flex items-center gap-2">
                    {onOpenAiModal && (
                      <button
                        onClick={onOpenAiModal}
                        className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1 cursor-pointer shadow-sh-brand"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Vedi modifiche / Approva</span>
                      </button>
                    )}
                    {onResolveAi && (
                      <button
                        onClick={onResolveAi}
                        className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>Rilancia da capo</span>
                      </button>
                    )}
                  </div>
                ) : isNeedsClarification ? (
                  <div className="flex items-center gap-2">
                    {onOpenAiModal && (
                      <button
                        onClick={onOpenAiModal}
                        className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>Rispondi / Riprendi</span>
                      </button>
                    )}
                    {onResolveAi && (
                      <button
                        onClick={onResolveAi}
                        className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>Rilancia da capo</span>
                      </button>
                    )}
                  </div>
                ) : isError ? (
                  onResolveAi && (
                    <button
                      onClick={onResolveAi}
                      className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-red/10 border border-red/30 hover:bg-red/20 text-red hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rilancia da capo</span>
                    </button>
                  )
                ) : (
                  onResolveAi && (
                    <button
                      onClick={onResolveAi}
                      className="px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-sky/10 border border-sky/30 hover:border-sky/50 text-sky hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>→ run di fix</span>
                    </button>
                  )
                )}
              </div>

              {runPhase && (
                <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <span>Stato AI:</span>
                  <span className={`${isReview ? 'text-violet-400 font-bold' : isNeedsClarification ? 'text-orange-400 font-bold' : isError ? 'text-red-400' : 'text-sky'} font-semibold`}>
                    {runPhase}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
