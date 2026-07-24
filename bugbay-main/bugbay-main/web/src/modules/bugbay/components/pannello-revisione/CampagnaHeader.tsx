/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Testata della Campagna di revisione QA: card statistiche (ok/problemi/in
 * sospeso + progress), azione "🔄 Refresh con AI" (rigenera la checklist dalle
 * modifiche git recenti, con override del ref base e stato dell'ultimo refresh),
 * azioni globali (risolvi tutto con AI, esporta prompt, reset) e barra di
 * ricerca/filtri/selezione.
 *
 * @indice
 * - IntestazioneCampagna → card statistiche + refresh AI + azioni globali
 * - FiltriCampagna       → ricerca, seleziona tutto e filtri multi-select
 */

'use client';

import { useState } from 'react';
import { ClipboardList, RotateCcw, Download, Sparkles, Loader2, Search, RefreshCw, GitCommitHorizontal } from 'lucide-react';
import type { ChecklistMeta } from '@/modules/bugbay/data/revisione-checklist';
import type { FilterType } from './revisione-stato';

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-display font-bold ${color}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

/** "aggiornato da abc1234, 17/06/2026 14:32" — riassunto leggibile dei metadati. */
function descriviMeta(meta: ChecklistMeta): string | null {
  if (!meta.lastRefreshSha && !meta.lastRefreshAt) return null;
  const parti: string[] = [];
  if (meta.lastRefreshSha) parti.push(`da ${meta.lastRefreshSha.slice(0, 7)}`);
  if (meta.lastRefreshAt) {
    const d = new Date(meta.lastRefreshAt);
    if (!Number.isNaN(d.getTime())) {
      parti.push(d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }
  }
  return parti.length > 0 ? `aggiornato ${parti.join(', ')}` : null;
}

export function IntestazioneCampagna({ stats, meta, bulkBusy, refreshing, showResolveAll, onResolveAll, onRefresh, onExport, onReset }: {
  stats: { ok: number; issues: number; pending: number; pct: number };
  meta: ChecklistMeta;
  bulkBusy: boolean;
  refreshing: boolean;
  showResolveAll: boolean;
  onResolveAll: () => void;
  onRefresh: (base?: string) => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const [base, setBase] = useState('');
  const metaLabel = descriviMeta(meta);

  return (
    <div className="bg-neutral-900 border border-neutral-850 rounded-md p-s-5 shadow-sh-2 flex flex-col gap-s-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-s-4">
        <div className="flex items-center gap-s-3">
          <ClipboardList className="w-7 h-7 text-sky" />
          <div>
            <h2 className="text-h3 font-display font-bold text-white">Campagna di revisione QA</h2>
            <p className="text-xs text-neutral-400">Checklist generata dalle modifiche recenti — le voci segnate come problema diventano segnalazioni della pipeline</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-s-4">
          <div className="flex items-center gap-s-4">
            <Stat n={stats.ok} label="OK" color="text-green" />
            <Stat n={stats.issues} label="Problemi" color="text-red" />
            <Stat n={stats.pending} label="In sospeso" color="text-sky" />
          </div>
          <div className="w-40">
            <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
              <div className="h-full bg-green transition-all" style={{ width: `${stats.pct}%` }} />
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 text-right">{stats.pct}%</p>
          </div>
        </div>
      </div>

      {/* Riga azioni: Refresh con AI + override del ref base + azioni globali */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-s-3 border-t border-neutral-850 pt-s-4">
        <div className="flex flex-wrap items-center gap-s-3">
          <button
            onClick={() => onRefresh(base.trim() || undefined)}
            disabled={refreshing}
            title="Rigenera la checklist dalle modifiche git dall'ultimo refresh"
            className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bb-accent-bg disabled:opacity-50 flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {refreshing ? 'Refresh in corso…' : 'Refresh con AI'}
          </button>
          <div className="flex items-center gap-s-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">da:</label>
            <input
              type="text"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="ultimo refresh (branch/tag/SHA)"
              disabled={refreshing}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-1.5 px-3 text-xs focus:outline-none focus:border-sky/50 transition-all placeholder-neutral-600 w-56 disabled:opacity-50"
            />
          </div>
          {metaLabel && (
            <span className="text-[11px] text-neutral-500 inline-flex items-center gap-1">
              <GitCommitHorizontal className="w-3.5 h-3.5" /> {metaLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-s-2">
          {showResolveAll && stats.issues > 0 && (
            <button
              onClick={onResolveAll}
              disabled={bulkBusy}
              title="Avvia la risoluzione AI per tutti gli elementi attualmente contrassegnati come problema"
              className="px-s-3 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
            >
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Risolvi tutti i problemi con AI ({stats.issues})
            </button>
          )}
          <button onClick={onExport} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-sky text-navy hover:opacity-90 flex items-center gap-s-2 cursor-pointer">
            <Download className="w-4 h-4" /> Esporta prompt
          </button>
          <button onClick={onReset} className="px-s-3 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-750 flex items-center gap-s-2 cursor-pointer">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

const FILTRI: { key: FilterType | 'all'; label: string; icon?: typeof Sparkles; color?: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'ok', label: 'OK' },
  { key: 'problema', label: 'Problemi' },
  { key: 'pending', label: 'Da controllare' },
  { key: 'ai_resolved', label: 'Risolti con AI', icon: Sparkles, color: 'text-violet-400 border-violet-500/20' },
  { key: 'ai_working', label: 'AI in corso', icon: Loader2, color: 'text-sky border-sky/20' },
];

export function FiltriCampagna({ search, onSearch, filterTypes, onToggleType, onClearTypes, hasActiveAiRuns, isAllSelected, onSelectAll }: {
  search: string;
  onSearch: (v: string) => void;
  filterTypes: Set<FilterType>;
  onToggleType: (t: FilterType) => void;
  onClearTypes: () => void;
  hasActiveAiRuns: boolean;
  isAllSelected: boolean;
  onSelectAll: () => void;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-850 rounded-md p-s-4 shadow-sh-1 flex flex-col md:flex-row md:items-center justify-between gap-s-3">
      <div className="flex items-center gap-s-2 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Cerca per testo, descrizione o nota..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-sky/50 transition-all placeholder-neutral-600"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs cursor-pointer"
            >
              Annulla
            </button>
          )}
        </div>

        <button
          onClick={onSelectAll}
          className="px-s-4 py-s-2 text-xs font-semibold rounded-sm bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-850/50 flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
        >
          <span>{isAllSelected ? 'Deseleziona Tutto' : 'Seleziona Tutto'}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-s-2">
        {FILTRI.map((opt) => {
          const isAll = opt.key === 'all';
          const isActive = isAll ? filterTypes.size === 0 : filterTypes.has(opt.key as FilterType);
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => (isAll ? onClearTypes() : onToggleType(opt.key as FilterType))}
              className={`px-s-3 py-s-2 rounded-sm text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky text-navy border-sky shadow-sm'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-850/50'
              }`}
            >
              {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-navy' : opt.color} ${(opt.key === 'ai_working' && hasActiveAiRuns) ? 'animate-spin' : ''}`} />}
              <span>{opt.label}</span>
            </button>
          );
        })}
        {filterTypes.size > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky/15 text-sky border border-sky/30">
            {filterTypes.size} filtri attivi
          </span>
        )}
      </div>
    </div>
  );
}
