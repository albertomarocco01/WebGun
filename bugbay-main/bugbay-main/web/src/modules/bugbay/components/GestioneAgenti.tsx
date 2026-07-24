/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Tab "Agenti AI" della console di debugging: monitora il ciclo di vita delle
 * run dell'agente di fix in background (lista con filtri/ricerca, statistiche,
 * console log per run) e ne controlla lo stato (pausa, riprendi, interrompi,
 * elimina singola o multipla). Fa polling delle run attive e ne sincronizza lo
 * stato col componente padre (DebuggingPage).
 *
 * @indice
 * - GestioneAgenti → componente principale del tab Agenti AI
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pause, RefreshCw, CheckCircle2, Cpu, Loader2, Trash2, Sparkles, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { GestioneAgentiRiga } from './GestioneAgentiRiga';

/** Fasi di filtro mostrate nella barra dei filtri del tab. */
type FilterPhase = 'all' | 'working' | 'paused' | 'review' | 'completed' | 'failed';

interface Props {
  onOpenReviewModal: (reportId: string) => void;
  setParentAiRuns: React.Dispatch<React.SetStateAction<Record<string, AgentRun>>>;
  onRefreshParentReports?: () => void;
}

export default function GestioneAgenti({
  onOpenReviewModal,
  setParentAiRuns,
  onRefreshParentReports
}: Props) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Diagnostica d'ambiente: rende visibili i problemi che bloccherebbero le run
  // (tsc non eseguibile, CLI claude assente, repo git non disponibile).
  const [diag, setDiag] = useState<{
    tscExecutable: boolean; tscGreen: boolean; tscErrorCount: number;
    claudeFound: boolean; claudeCmd: string | null; gitOk: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/agent-fix?diagnostics=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.tscExecutable === 'boolean') setDiag(d); })
      .catch(() => { /* ignore */ });
  }, []);
  const [filterPhase, setFilterPhase] = useState<FilterPhase>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [selectedRuns, setSelectedRuns] = useState<Record<string, boolean>>({});

  // Ref per accedere al valore più recente di runs all'interno dell'intervallo di polling
  const runsRef = useRef<AgentRun[]>([]);
  runsRef.current = runs;

  // Fetch all runs
  const fetchRuns = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/agent-fix?all=1');
      if (res.ok) {
        const data = await res.json();
        setRuns(data);

        // Sincronizza lo stato attivo col parent (DebuggingPage).
        // Le run batch coprono più segnalazioni: una entry per ogni reportId.
        const activeMap: Record<string, AgentRun> = {};
        data.forEach((r: AgentRun) => {
          if (!['approved', 'discarded', 'aborted'].includes(r.phase)) {
            const ids = r.reports?.length ? r.reports.map((rep) => rep.reportId) : [r.reportId];
            for (const id of ids) activeMap[id] = r;
          }
        });
        setParentAiRuns(activeMap);
      }
    } catch {
      toast.error('Errore nel recupero degli agenti.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setParentAiRuns]);

  // Polling automatico ottimizzato (evita chiamate duplicate)
  useEffect(() => {
    fetchRuns();
    const iv = setInterval(() => {
      const hasActive = runsRef.current.some(r => ['queued', 'interpreting', 'fixing', 'verifying'].includes(r.phase));
      if (hasActive) {
        fetchRuns(true);
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [fetchRuns]);

  // Azioni di controllo individuali
  const handlePause = async (runId: string) => {
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', runId })
      });
      if (res.ok) {
        toast.info('Agente messo in pausa.');
        fetchRuns(true);
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Errore nella pausa.');
      }
    } catch {
      toast.error('Errore di connessione.');
    }
  };

  const handleResume = async (runId: string) => {
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', runId })
      });
      if (res.ok) {
        toast.success('Agente riavviato.');
        fetchRuns(true);
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Errore nel riavvio.');
      }
    } catch {
      toast.error('Errore di connessione.');
    }
  };

  const handleAbort = async (runId: string) => {
    if (!confirm('Sei sicuro di voler interrompere questo agente? Le modifiche non salvate andranno perse.')) return;
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort', runId })
      });
      if (res.ok) {
        toast.success('Agente abortito correttamente.');
        fetchRuns(true);
        if (onRefreshParentReports) onRefreshParentReports();
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Errore nell\'interruzione.');
      }
    } catch {
      toast.error('Errore di connessione.');
    }
  };

  const toggleLogs = (runId: string) => {
    setExpandedLogs(prev => ({ ...prev, [runId]: !prev[runId] }));
  };

  // Filtraggio runs
  const filteredRuns = runs.filter(run => {
    const textMatch = searchQuery === '' || 
      run.runId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.reportTitolo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (run.problema && run.problema.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!textMatch) return false;

    switch (filterPhase) {
      case 'working':
        return ['queued', 'interpreting', 'fixing', 'verifying'].includes(run.phase);
      case 'paused':
        return run.phase === 'paused';
      case 'review':
        return run.phase === 'review' || run.phase === 'needs_clarification';
      case 'completed':
        return run.phase === 'approved';
      case 'failed':
        return ['discarded', 'aborted', 'error'].includes(run.phase);
      default:
        return true;
    }
  });

  // Gestione selezioni multiple
  const handleSelectRow = (runId: string) => {
    setSelectedRuns(prev => ({
      ...prev,
      [runId]: !prev[runId]
    }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const next: Record<string, boolean> = {};
      filteredRuns.forEach(r => {
        next[r.runId] = true;
      });
      setSelectedRuns(next);
    } else {
      setSelectedRuns({});
    }
  };

  const selectedCount = Object.values(selectedRuns).filter(Boolean).length;

  const handleDeleteRuns = async (runIds: string[]) => {
    if (runIds.length === 0) return;
    const isMultiple = runIds.length > 1;
    const msg = isMultiple 
      ? `Sei sicuro di voler eliminare definitivamente ${runIds.length} agenti? Questa azione interromperà i processi attivi e rimuoverà per sempre la cronologia.`
      : `Sei sicuro di voler eliminare definitivamente questo agente? Questa azione interromperà il processo attivo e rimuoverà per sempre la cronologia.`;
    
    if (!confirm(msg)) return;

    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', runIds })
      });
      if (res.ok) {
        toast.success(isMultiple ? 'Agenti eliminati con successo.' : 'Agente eliminato con successo.');
        // Aggiorna lo stato locale per rimuovere immediatamente gli elementi
        setRuns(prev => prev.filter(r => !runIds.includes(r.runId)));
        
        // Pulisce selezione
        setSelectedRuns(prev => {
          const next = { ...prev };
          runIds.forEach(id => {
            delete next[id];
          });
          return next;
        });

        // Sincronizza col parent
        setParentAiRuns(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(reportId => {
            const run = next[reportId];
            if (run && runIds.includes(run.runId)) {
              delete next[reportId];
            }
          });
          return next;
        });

        if (onRefreshParentReports) onRefreshParentReports();
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Errore durante l\'eliminazione.');
      }
    } catch {
      toast.error('Errore di connessione.');
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto p-s-6 bg-neutral-950 border border-neutral-900 rounded-lg shadow-sh-2 mt-s-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-s-4 border-b border-neutral-900 pb-s-4 mb-s-6">
        <div>
          <h2 className="text-h2 font-display font-bold text-white flex items-center gap-s-2">
            <Cpu className="w-6 h-6 text-sky" />
            <span>Gestione Ciclo di Vita Agenti Background</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Monitora, metti in pausa, sblocca, elimina o interrompi i processi agentici di risoluzione in background.
          </p>
        </div>
        
        <div className="flex items-center gap-s-3">
          {selectedCount > 0 && (
            <button
              onClick={() => handleDeleteRuns(Object.keys(selectedRuns).filter(id => selectedRuns[id]))}
              className="px-3.5 py-2.5 rounded-sm bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sh-brand"
            >
              <Trash2 className="w-4 h-4" />
              Elimina Selezionati ({selectedCount})
            </button>
          )}
          
          <button
            onClick={() => fetchRuns(false)}
            disabled={refreshing}
            className="p-3 text-neutral-450 hover:text-white bg-neutral-900 border border-neutral-850 hover:border-neutral-750 transition-all rounded-sm flex items-center gap-s-2 cursor-pointer text-xs font-semibold shadow-sh-1"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Aggiorna Lista
          </button>
        </div>
      </div>

      {/* Diagnostica ambiente (mostrata solo se qualcosa non va) */}
      {diag && (!diag.tscExecutable || !diag.claudeFound || !diag.gitOk || !diag.tscGreen) && (
        <div className="mb-s-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-s-4 py-s-3 text-xs text-amber-200 flex flex-col gap-1">
          <p className="font-bold uppercase tracking-wider text-amber-400">Diagnostica ambiente</p>
          {!diag.tscExecutable && <p className="flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><strong>tsc non eseguibile</strong>: il gate di verifica non può girare (controlla node_modules/typescript).</span></p>}
          {diag.tscExecutable && !diag.tscGreen && <p className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Il branch ha <strong>{diag.tscErrorCount} errori tsc pre-esistenti</strong>: il gate è relativo (blocca solo i NUOVI errori), ma conviene bonificarli.</span></p>}
          {!diag.claudeFound && <p className="flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><strong>CLI claude non trovata</strong>: il provider Claude (Headless) non può partire. Installa la CLI o imposta CLAUDE_BIN in .env.local; in alternativa usa Gemini/DeepSeek.</span></p>}
          {!diag.gitOk && <p className="flex items-start gap-1.5"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><strong>git non disponibile</strong>: diff, revert e commit delle run non funzioneranno.</span></p>}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-s-4 mb-s-6">
        {([
          { label: 'Totale Task', value: runs.length, accent: 'border-l-neutral-600', text: 'text-white', Icon: Cpu, iconCls: 'text-neutral-500 bg-neutral-850' },
          { label: 'In Esecuzione', value: runs.filter(r => ['queued', 'interpreting', 'fixing', 'verifying'].includes(r.phase)).length, accent: 'border-l-sky', text: 'text-sky', Icon: Loader2, iconCls: 'text-sky bg-sky/10' },
          { label: 'In Pausa', value: runs.filter(r => r.phase === 'paused').length, accent: 'border-l-neutral-600', text: 'text-neutral-300', Icon: Pause, iconCls: 'text-neutral-400 bg-neutral-850' },
          { label: 'Da Revisionare', value: runs.filter(r => r.phase === 'review' || r.phase === 'needs_clarification').length, accent: 'border-l-amber-500', text: 'text-amber-400', Icon: Sparkles, iconCls: 'text-amber-400 bg-amber-500/10' },
          { label: 'Risolti', value: runs.filter(r => r.phase === 'approved').length, accent: 'border-l-green', text: 'text-green', Icon: CheckCircle2, iconCls: 'text-green bg-green/10' },
        ] as const).map(({ label, value, accent, text, Icon, iconCls }, i) => (
          <div
            key={label}
            className={`bg-neutral-900/60 border border-neutral-850 border-l-2 ${accent} p-s-4 rounded-md shadow-sh-1 flex items-center justify-between hover:border-neutral-750 transition-colors ${i === 4 ? 'col-span-2 md:col-span-1' : ''}`}
          >
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{label}</span>
              <h4 className={`text-h2 font-display font-bold mt-1 tabular-nums ${text}`}>{value}</h4>
            </div>
            <span className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${iconCls}`}>
              <Icon className={`w-5 h-5 ${label === 'In Esecuzione' && value > 0 ? 'animate-spin' : ''}`} />
            </span>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-s-4 items-center justify-between mb-s-4 bg-neutral-900/40 p-s-4 rounded-md border border-neutral-900">
        <div className="flex flex-wrap items-center gap-s-2 w-full lg:w-auto">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider mr-2">Filtra:</span>
          {[
            { key: 'all', label: 'Tutti' },
            { key: 'working', label: 'In corso' },
            { key: 'paused', label: 'In pausa' },
            { key: 'review', label: 'Da revisionare' },
            { key: 'completed', label: 'Completati' },
            { key: 'failed', label: 'Falliti/Cancellati' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => {
                setFilterPhase(f.key as FilterPhase);
                setSelectedRuns({});
              }}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all cursor-pointer ${
                filterPhase === f.key
                  ? 'bg-neutral-100 text-neutral-900 border-neutral-100'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cerca per ID run o titolo segnalazione..."
          className="w-full lg:w-96 bg-neutral-950 border border-neutral-800 rounded-sm py-2 px-3 text-xs focus:outline-none focus:border-neutral-600 text-neutral-200"
        />
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="py-s-9 flex flex-col items-center justify-center text-neutral-400 gap-s-2">
          <Loader2 className="w-8 h-8 animate-spin text-sky" />
          <p className="text-xs">Caricamento agenti in corso...</p>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="py-s-9 text-center text-neutral-500 border border-dashed border-neutral-850 rounded-md">
          <p className="text-xs">Nessun agente corrisponde ai filtri impostati.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-850 text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={filteredRuns.length > 0 && filteredRuns.every(r => selectedRuns[r.runId])}
                    onChange={handleSelectAll}
                    className="rounded border-neutral-800 bg-neutral-950 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Run ID & Data</th>
                <th className="py-3 px-4">Segnalazione / Task</th>
                <th className="py-3 px-4">Stato</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Modifiche</th>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map(run => (
                <GestioneAgentiRiga
                  key={run.runId}
                  run={run}
                  selected={!!selectedRuns[run.runId]}
                  logsOpen={expandedLogs[run.runId] === true}
                  onToggleSelect={() => handleSelectRow(run.runId)}
                  onToggleLogs={() => toggleLogs(run.runId)}
                  onPause={() => handlePause(run.runId)}
                  onResume={() => handleResume(run.runId)}
                  onReview={() => onOpenReviewModal(run.reportId)}
                  onAbort={() => handleAbort(run.runId)}
                  onDelete={() => handleDeleteRuns([run.runId])}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
