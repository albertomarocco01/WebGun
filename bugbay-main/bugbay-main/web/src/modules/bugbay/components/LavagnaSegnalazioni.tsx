/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Lavagna della pipeline di debugging: quattro colonne per stato
 * (Aperte → In lavorazione → In verifica → Chiuse) con card per segnalazione.
 * Le card mostrano priorità, categoria, fase AI live, verdetto e costo; le run
 * batch raggruppano più segnalazioni. Click sulla card → drawer di dettaglio.
 *
 * @indice
 * - LavagnaSegnalazioni → componente principale della vista Lavagna
 */

'use client';

import { useMemo, useState } from 'react';
import { Sparkles, Loader2, ChevronDown, MessageCircleQuestion, ClipboardCheck } from 'lucide-react';
import type { SystemReport } from '@/modules/bugbay/types';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';

const AI_WORKING = ['queued', 'interpreting', 'fixing', 'verifying'];

interface Colonna {
  key: 'aperte' | 'lavorazione' | 'verifica' | 'chiuse';
  title: string;
  accent: string;
  match: (r: SystemReport) => boolean;
}

const COLONNE: Colonna[] = [
  { key: 'aperte', title: 'Aperte', accent: 'border-t-red', match: (r) => r.status === 'Aperto' },
  { key: 'lavorazione', title: 'In lavorazione', accent: 'border-t-sky', match: (r) => r.status === 'In Lavorazione' || r.status === 'In Chiarimento' },
  { key: 'verifica', title: 'In verifica', accent: 'border-t-violet-500', match: (r) => r.status === 'In Verifica' },
  { key: 'chiuse', title: 'Chiuse', accent: 'border-t-green', match: (r) => r.status === 'Risolto' },
];

const PRIORITY_DOT: Record<string, string> = {
  Bassa: 'bg-neutral-500', Media: 'bg-sky', Alta: 'bg-orange', Urgente: 'bg-red', Critica: 'bg-red animate-pulse',
};

const PESO_PRIORITA: Record<string, number> = { Critica: 5, Urgente: 4, Alta: 3, Media: 2, Bassa: 1 };

interface Props {
  reports: SystemReport[];
  aiRuns: Record<string, AgentRun>;
  aiEnabled: boolean;
  onOpenDetail: (reportId: string) => void;
  onStartAi: (reportId: string) => void;
}

export default function LavagnaSegnalazioni({ reports, aiRuns, aiEnabled, onOpenDetail, onStartAi }: Props) {
  const [chiuseOpen, setChiuseOpen] = useState(false);

  const perColonna = useMemo(() => {
    const map: Record<string, SystemReport[]> = { aperte: [], lavorazione: [], verifica: [], chiuse: [] };
    for (const r of reports) {
      const col = COLONNE.find((c) => c.match(r));
      if (col) map[col.key].push(r);
    }
    // Aperte/lavorazione/verifica: priorità poi data; Chiuse: più recenti prima
    const byPrio = (a: SystemReport, b: SystemReport) =>
      (PESO_PRIORITA[b.priority] ?? 0) - (PESO_PRIORITA[a.priority] ?? 0) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    map.aperte.sort(byPrio); map.lavorazione.sort(byPrio); map.verifica.sort(byPrio);
    map.chiuse.sort((a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime());
    return map;
  }, [reports]);

  return (
    <div className="max-w-[1800px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-s-4 items-start">
      {COLONNE.map((col) => {
        const items = perColonna[col.key];
        const collassata = col.key === 'chiuse' && !chiuseOpen;
        return (
          <div key={col.key} className={`bg-neutral-900/60 border border-neutral-850 border-t-2 ${col.accent} rounded-md shadow-sh-1 flex flex-col max-h-[calc(100vh-260px)]`}>
            <button
              onClick={() => { if (col.key === 'chiuse') setChiuseOpen((v) => !v); }}
              className={`flex items-center justify-between px-s-4 py-s-3 border-b border-neutral-850 ${col.key === 'chiuse' ? 'cursor-pointer hover:bg-neutral-850/40' : 'cursor-default'}`}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">{col.title}</span>
              <span className="inline-flex items-center gap-s-2">
                <span className="px-2 py-0.5 rounded-pill bg-neutral-850 border border-neutral-800 text-[11px] font-bold text-neutral-400 tabular-nums">{items.length}</span>
                {col.key === 'chiuse' && <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${chiuseOpen ? '' : '-rotate-90'}`} />}
              </span>
            </button>

            {!collassata && (
              <div className="flex-1 overflow-y-auto p-s-3 flex flex-col gap-s-3 scrollbar-thin">
                {items.length === 0 && (
                  <p className="text-xs text-neutral-600 text-center py-s-6">Nessuna segnalazione</p>
                )}
                {items.slice(0, col.key === 'chiuse' ? 30 : 100).map((r) => (
                  <CardSegnalazione
                    key={r.id}
                    report={r}
                    run={aiRuns[r.id]}
                    aiEnabled={aiEnabled}
                    colonna={col.key}
                    onOpen={() => onOpenDetail(r.id)}
                    onStartAi={() => onStartAi(r.id)}
                  />
                ))}
                {col.key === 'chiuse' && items.length > 30 && (
                  <p className="text-[11px] text-neutral-600 text-center">… e altre {items.length - 30} (vista Tabella per lo storico completo)</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardSegnalazione({ report, run, aiEnabled, colonna, onOpen, onStartAi }: {
  report: SystemReport;
  run?: AgentRun;
  aiEnabled: boolean;
  colonna: Colonna['key'];
  onOpen: () => void;
  onStartAi: () => void;
}) {
  const working = run && AI_WORKING.includes(run.phase);
  const inReview = run?.phase === 'review';
  const isBatch = (run?.reports?.length ?? 0) > 1;
  const isQa = report.reporterName === 'Revisore QA';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className={`group text-left bg-neutral-900 border rounded-md p-s-3 shadow-sh-1 cursor-pointer transition-all hover:shadow-sh-2 hover:-translate-y-px ${
        inReview ? 'border-violet-500/40' : working ? 'border-sky/30' : 'border-neutral-800 hover:border-neutral-700'
      } ${colonna === 'chiuse' ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      <div className="flex items-center gap-s-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[report.priority] ?? 'bg-neutral-500'}`} title={`Priorità: ${report.priority}`} />
        <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider truncate">{report.area}{report.subArea ? ` · ${report.subArea}` : ''}</span>
        {isQa && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky/10 text-sky border border-sky/20 shrink-0" title="Nata da una campagna di revisione QA"><ClipboardCheck className="w-3 h-3 inline" /> QA</span>}
      </div>

      <p className={`text-xs leading-relaxed line-clamp-3 ${colonna === 'chiuse' ? 'text-neutral-500' : 'text-neutral-200'}`}>{report.notes}</p>

      <div className="flex flex-wrap items-center gap-s-2 mt-s-2 min-h-[22px]">
        {/* Stato AI live */}
        {working && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky bg-sky/10 border border-sky/20 px-1.5 py-0.5 rounded-pill">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI · {run!.phase === 'queued' ? 'in coda' : run!.phase}{isBatch ? ` · batch ×${run!.reports!.length}` : ''}
          </span>
        )}
        {run?.phase === 'needs_clarification' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange bg-orange/10 border border-orange/20 px-1.5 py-0.5 rounded-pill">
            <MessageCircleQuestion className="w-3 h-3" /> Chiarimento richiesto
          </span>
        )}
        {inReview && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-300 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded-pill">
            <Sparkles className="w-3 h-3" /> Risoluzione pronta
            {run!.verdict && <span className="tabular-nums">· Giudice {run!.verdict.criteri.filter((c) => c.ok).length}/{run!.verdict.criteri.length}</span>}
          </span>
        )}
        {run?.phase === 'error' && (
          <span className="text-[10px] font-bold text-red bg-red/10 border border-red/20 px-1.5 py-0.5 rounded-pill" title={run.error}>AI fallita</span>
        )}
        {/* Quick action: Risolvi con AI (solo Aperte, su hover) */}
        {colonna === 'aperte' && aiEnabled && !run && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartAi(); }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/15 border border-violet-500/30 hover:bg-violet-500/30 px-2 py-1 rounded-sm cursor-pointer"
          >
            <Sparkles className="w-3 h-3" /> AI
          </button>
        )}
        {colonna === 'verifica' && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity">Verifica →</span>
        )}
      </div>
    </div>
  );
}
