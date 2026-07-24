/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Vista Tabella della pipeline segnalazioni: KPI, banner campagna, barra di
 * ricerca/filtri/ordinamento, tabella con righe espandibili, selezione
 * multipla con barra bulk flottante (1 workflow batch / N run separate) ed
 * export CSV. Lo stato di filtri/ordinamento/selezione vive qui; le azioni
 * (AI, stato, modali) sono delegate al genitore via callback.
 *
 * @indice
 * - TabellaSegnalazioni → vista tabellare completa della console
 */

'use client';

import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Bug, CheckCircle, Search, SlidersHorizontal, Trash2, Wrench,
  FileText, Loader2, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SystemReport } from '@/modules/bugbay/types';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { CATEGORIES, PRIORITIES } from '@/modules/bugbay/config';
import { RigaSegnalazione } from './RigaSegnalazione';

const STATUS_CHIPS = [
  { key: 'Aperto', label: 'Aperte', dot: 'bg-red' },
  { key: 'In Lavorazione', label: 'In Lav.', dot: 'bg-amber-400' },
  { key: 'In Chiarimento', label: 'Chiarim.', dot: 'bg-orange' },
  { key: 'In Verifica', label: 'In Verifica', dot: 'bg-violet-400' },
  { key: 'Risolto', label: 'Chiuse', dot: 'bg-green' },
];

type SortBy = 'priority' | 'status' | 'category' | 'area' | 'createdAt';

interface Props {
  /** Segnalazioni già filtrate per sviluppatore. */
  reports: SystemReport[];
  loading: boolean;
  aiRuns: Record<string, AgentRun>;
  aiEnabled: boolean;
  stats: { total: number; open: number; inProgress: number; inVerifica: number; resolved: number };
  revisionIssuesCount: number;
  bulkBusy: boolean;
  onResolveAllIssues: () => void;
  onOpenDetail: (id: string) => void;
  onOpenEdit: (report: SystemReport) => void;
  onStartResolve: (id: string) => void;
  onUpdateStatus: (id: string, status: SystemReport['status']) => void;
  onAbortRun: (run: AgentRun) => void;
  onResumeRun: (run: AgentRun) => void;
  onDismissError: (reportId: string) => void;
  onBulkResolveAi: (ids: string[], mode: 'batch' | 'separate') => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onGoToArea: (url?: string | null) => void;
}

export default function TabellaSegnalazioni({
  reports, loading, aiRuns, aiEnabled, stats, revisionIssuesCount, bulkBusy,
  onResolveAllIssues, onOpenDetail, onOpenEdit, onStartResolve, onUpdateStatus,
  onAbortRun, onResumeRun, onDismissError, onBulkResolveAi, onBulkDelete, onGoToArea,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  // Filtri multi-select: array vuoto = nessun filtro (mostra tutti).
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  // Filtro "Segnalato da": stringa vuota = tutti i reporter.
  const [filterReporter, setFilterReporter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleFilterValue = (setter: Dispatch<SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleHeaderClick = (field: SortBy) => {
    if (sortBy === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('desc'); }
  };
  const sortIndicator = (field: SortBy) => (sortBy !== field ? null : sortOrder === 'asc' ? ' ▴' : ' ▾');

  // Reporter distinti presenti nelle segnalazioni correnti (per il filtro "Segnalato da").
  const reporterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const r of reports) {
      const name = (r.reporterName || '').trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const priorityWeights: Record<SystemReport['priority'], number> = { Bassa: 1, Media: 2, Alta: 3, Urgente: 4, Critica: 5 };
    const statusWeights: Record<SystemReport['status'], number> = {
      Aperto: 1, 'In Lavorazione': 2, 'In Chiarimento': 3, 'In Verifica': 4, Risolto: 5,
    };

    const filtered = reports.filter((r) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        (r.notes || '').toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        (r.subArea || '').toLowerCase().includes(q) ||
        (r.reporterName || '').toLowerCase().includes(q);
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(r.status);
      const matchCategory = filterCategory.length === 0 || filterCategory.includes(r.category);
      const matchPriority = filterPriority.length === 0 || filterPriority.includes(r.priority);
      const matchReporter = filterReporter === '' || (r.reporterName || '').trim() === filterReporter;
      return matchSearch && matchStatus && matchCategory && matchPriority && matchReporter;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'priority') comparison = (priorityWeights[a.priority] || 0) - (priorityWeights[b.priority] || 0);
      else if (sortBy === 'status') comparison = (statusWeights[a.status] || 0) - (statusWeights[b.status] || 0);
      else if (sortBy === 'category') comparison = a.category.localeCompare(b.category);
      else if (sortBy === 'area') comparison = a.area.localeCompare(b.area);
      else comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [reports, searchTerm, filterStatus, filterCategory, filterPriority, filterReporter, sortBy, sortOrder]);

  const exportToCSV = () => {
    if (reports.length === 0) { toast.info('Nessun dato da esportare'); return; }
    const headers = ['ID', 'Categoria', 'Priorità', 'Stato', 'Area', 'Sotto-area', 'Descrizione', 'Reporter', 'URL', 'Creato Il', 'Risolto Il', 'Note Risoluzione'];
    const rows = filteredReports.map((r) => [
      r.id, r.category, r.priority, r.status, r.area, r.subArea || '',
      (r.notes || '').replace(/"/g, '""').replace(/\n/g, ' '),
      r.reporterName || '', r.url || '', r.createdAt, r.resolvedAt || '',
      (r.resolutionNotes || '').replace(/"/g, '""').replace(/\n/g, ' '),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,﻿'
      + [headers.join(';'), ...rows.map((e) => e.map((val) => `"${val}"`).join(';'))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `segnalazioni_baldisport_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('File CSV esportato con successo');
  };

  const chipCls = (active: boolean) =>
    `px-s-3 py-s-2 rounded-sm text-xs font-semibold border transition-all cursor-pointer ${
      active ? 'bg-red text-white border-red' : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-850/50'
    }`;

  return (
    <>
      {/* Banner campagna QA */}
      {revisionIssuesCount > 0 && (
        <div className="max-w-[1800px] mx-auto bg-violet-500/10 border border-violet-500/30 rounded-md p-s-4 flex flex-col sm:flex-row items-center justify-between gap-s-3 mb-s-4">
          <div className="flex items-center gap-s-3 text-violet-255">
            <Sparkles className="w-5 h-5 text-violet-400 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-semibold">Ci sono {revisionIssuesCount} problemi aperti nella Campagna QA</p>
              <p className="text-xs text-neutral-400">Puoi avviare la risoluzione automatica con l&apos;AI per tutti gli elementi contrassegnati come problema.</p>
            </div>
          </div>
          <button
            onClick={onResolveAllIssues}
            disabled={bulkBusy}
            className="px-s-4 py-s-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-violet-600 hover:bg-violet-500 disabled:bg-violet-750 text-white flex items-center gap-s-2 cursor-pointer shadow-sh-brand whitespace-nowrap"
          >
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Risolvi tutti i problemi attuali con AI
          </button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 max-w-[1800px] mx-auto">
        {([
          { label: 'Totale Segnalazioni', value: stats.total, accent: 'border-l-neutral-600', text: 'text-white', labelCls: 'text-neutral-500', Icon: FileText, iconCls: 'text-neutral-700 bg-neutral-850' },
          { label: 'Aperte', value: stats.open, accent: 'border-l-red', text: 'text-red', labelCls: 'text-red/80', Icon: Bug, iconCls: 'text-red bg-red/10' },
          { label: 'In Lavorazione', value: stats.inProgress, accent: 'border-l-orange', text: 'text-orange', labelCls: 'text-orange/80', Icon: Wrench, iconCls: 'text-orange bg-orange/10' },
          { label: 'Chiuse (Storico)', value: stats.resolved, accent: 'border-l-green', text: 'text-green', labelCls: 'text-green/80', Icon: CheckCircle, iconCls: 'text-green bg-green/10' },
        ] as const).map(({ label, value, accent, text, labelCls, Icon, iconCls }) => (
          <div
            key={label}
            className={`bg-neutral-900 border border-neutral-850 border-l-2 ${accent} rounded-md p-s-4 flex items-center justify-between shadow-sh-1 hover:border-neutral-750 hover:shadow-sh-2 transition-all`}
          >
            <div>
              <p className={`${labelCls} text-[10px] font-bold uppercase tracking-wider`}>{label}</p>
              <h3 className={`text-h1 font-display font-bold mt-1 tabular-nums ${text}`}>{value}</h3>
            </div>
            <span className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${iconCls}`}>
              <Icon className="w-5 h-5" />
            </span>
          </div>
        ))}
      </div>

      {/* Ricerca + filtri + ordinamento */}
      <div className="max-w-[1800px] mx-auto bg-neutral-900 border border-neutral-850 p-s-4 rounded-md shadow-sh-2">
        {/* Due righe: ricerca + ordinamento sopra, chip dei filtri sotto
            (13+ chip sulla stessa riga schiaccerebbero la ricerca a icona sola). */}
        <div className="flex flex-col gap-s-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-s-3">
            <div className="relative w-full md:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca per descrizione, modulo, sotto-sezione, reporter..."
                className="w-full pl-9 bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-sm rounded-sm py-2 px-3 focus:outline-none focus:border-neutral-700"
              />
            </div>
            <div className="flex items-center gap-s-2 shrink-0">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold whitespace-nowrap">Ordina:</span>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as SortBy);
                  setSortOrder(order as 'asc' | 'desc');
                }}
                className="bg-neutral-950 border border-neutral-800 text-neutral-350 text-xs rounded-sm py-2.5 px-4 focus:outline-none cursor-pointer"
              >
                <option value="createdAt-desc">Più recenti</option>
                <option value="createdAt-asc">Più vecchie</option>
                <option value="priority-desc">Priorità più alta</option>
                <option value="priority-asc">Priorità più bassa</option>
                <option value="status-asc">Stato (Aperto prima)</option>
                <option value="status-desc">Stato (Chiuse prima)</option>
                <option value="area-asc">Area (A-Z)</option>
                <option value="area-desc">Area (Z-A)</option>
                <option value="category-asc">Categoria (A-Z)</option>
              </select>
              <button
                onClick={exportToCSV}
                className="px-s-3 py-s-2 text-xs font-semibold rounded-sm bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white hover:bg-neutral-850/50 transition-all cursor-pointer"
                title="Esporta le righe filtrate in CSV"
              >
                CSV
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-s-3">
            <div className="flex items-center gap-s-2 text-xs text-neutral-450 uppercase tracking-wider font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" /> Filtra:
            </div>

            <div className="flex items-center gap-s-2">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Stato</span>
              {STATUS_CHIPS.map((opt) => (
                <button key={opt.key} onClick={() => toggleFilterValue(setFilterStatus, opt.key)} className={chipCls(filterStatus.includes(opt.key))}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-s-2 pl-s-3 border-l border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Categoria</span>
              {CATEGORIES.map((cat) => (
                <button key={cat.key} onClick={() => toggleFilterValue(setFilterCategory, cat.key)} className={chipCls(filterCategory.includes(cat.key))}>
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-s-2 pl-s-3 border-l border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Priorità</span>
              {PRIORITIES.map((prio) => (
                <button key={prio.key} onClick={() => toggleFilterValue(setFilterPriority, prio.key)} className={chipCls(filterPriority.includes(prio.key))}>
                  {prio.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-s-2 pl-s-3 border-l border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Segnalato da</span>
              <select
                value={filterReporter}
                onChange={(e) => setFilterReporter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-neutral-350 text-xs rounded-sm py-2 px-3 focus:outline-none cursor-pointer max-w-[12rem]"
                title="Filtra per chi ha segnalato"
              >
                <option value="">Tutti</option>
                {reporterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* Barra azioni bulk flottante */}
      {selected.size > 0 && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[60] max-w-[95vw] bg-neutral-900/95 backdrop-blur border border-violet-500/30 rounded-lg shadow-sh-3 px-s-5 py-s-3 flex flex-wrap items-center justify-between gap-s-3 animate-in slide-in-from-bottom-5 duration-300">
          <span className="text-sm font-semibold text-violet-200 inline-flex items-center gap-s-2">
            <span className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs flex items-center justify-center font-bold tabular-nums">
              {selected.size}
            </span>
            {selected.size === 1 ? 'segnalazione selezionata' : 'segnalazioni selezionate'}
          </span>
          <div className="flex items-center gap-s-2">
            {aiEnabled && (
              <>
                <button
                  onClick={async () => { const ids = [...selected]; setSelected(new Set()); await onBulkResolveAi(ids, 'batch'); }}
                  title={selected.size > 1 ? 'Un solo workflow AI risolve tutte le segnalazioni selezionate insieme' : 'Avvia la risoluzione AI'}
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-violet-500 text-white hover:bg-violet-600 transition-all flex items-center gap-s-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {selected.size > 1 ? `Risolvi con AI — 1 workflow (${selected.size})` : 'Risolvi con AI'}
                </button>
                {selected.size > 1 && (
                  <button
                    onClick={async () => { const ids = [...selected]; setSelected(new Set()); await onBulkResolveAi(ids, 'separate'); }}
                    title="Una run AI indipendente per ogni segnalazione (in parallelo)"
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-all flex items-center gap-s-2 cursor-pointer"
                  >
                    Risolvi separatamente ({selected.size} run)
                  </button>
                )}
              </>
            )}
            <button
              onClick={async () => { const ids = [...selected]; setSelected(new Set()); await onBulkDelete(ids); }}
              className="px-6 py-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white transition-all flex items-center gap-s-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Elimina ({selected.size})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-5 py-3 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white cursor-pointer"
            >
              Deseleziona
            </button>
          </div>
        </div>
      )}

      {/* Tabella */}
      <div className="max-w-[1800px] mx-auto bg-neutral-900 border border-neutral-850 rounded-md overflow-hidden shadow-sh-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-s-3 text-neutral-400">
            <Loader2 className="w-8 h-8 text-red animate-spin" />
            <p className="text-xs font-mono tracking-wider uppercase">Caricamento segnalazioni…</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-20 text-neutral-500 font-light text-sm">
            Nessuna segnalazione risponde ai filtri selezionati.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-950 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-850 select-none">
                  <th className="py-s-3 px-s-4 text-center w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-violet-500 cursor-pointer align-middle"
                      checked={filteredReports.length > 0 && filteredReports.every((r) => selected.has(r.id))}
                      ref={(el) => { if (el) el.indeterminate = filteredReports.some((r) => selected.has(r.id)) && !filteredReports.every((r) => selected.has(r.id)); }}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) filteredReports.forEach((r) => next.add(r.id));
                          else filteredReports.forEach((r) => next.delete(r.id));
                          return next;
                        });
                      }}
                      title="Seleziona tutte (filtrate)"
                    />
                  </th>
                  <th className="py-s-3 px-s-4 text-center w-12">Dettagli</th>
                  <th className="py-s-3 px-s-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('status')}>Stato{sortIndicator('status')}</th>
                  <th className="py-s-3 px-s-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('category')}>Categoria{sortIndicator('category')}</th>
                  <th className="py-s-3 px-s-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('priority')}>Priorità{sortIndicator('priority')}</th>
                  <th className="py-s-3 px-s-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('area')}>Area / Modulo{sortIndicator('area')}</th>
                  <th className="py-s-3 px-s-4">Assegnato a</th>
                  <th className="py-s-3 px-s-4">Descrizione</th>
                  <th className="py-s-3 px-s-4 cursor-pointer hover:text-white" onClick={() => handleHeaderClick('createdAt')}>Data{sortIndicator('createdAt')}</th>
                  <th className="py-s-3 px-s-4 text-right w-36">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {filteredReports.map((report) => (
                  <RigaSegnalazione
                    key={report.id}
                    report={report}
                    aiRun={aiRuns[report.id]}
                    selected={selected.has(report.id)}
                    expanded={expandedNotes.has(report.id)}
                    onToggleSelect={() => toggleSelect(report.id)}
                    onToggleExpand={() => toggleNotes(report.id)}
                    onGoToArea={onGoToArea}
                    onOpenDetail={() => onOpenDetail(report.id)}
                    onOpenEdit={() => onOpenEdit(report)}
                    onUpdateStatus={(status) => onUpdateStatus(report.id, status)}
                    onStartResolve={() => onStartResolve(report.id)}
                    onAbortRun={onAbortRun}
                    onResumeRun={onResumeRun}
                    onDismissError={() => onDismissError(report.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
