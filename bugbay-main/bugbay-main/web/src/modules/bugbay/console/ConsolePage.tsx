/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Console di debugging — pipeline unica delle segnalazioni. Orchestratore
 * delle tre viste (Lavagna ⇄ Tabella + Campagna QA), del drawer di dettaglio
 * e della sala macchine. Lo stato del fix agentico vive in use-fix-agentico,
 * quello della campagna in use-campagna-qa; tabella e modali sono componenti
 * dedicati in components/domain/debugging.
 *
 * @indice
 * - DebuggingPage → pagina della console di debugging
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bug, PlusCircle, CheckCircle, Wrench, Settings, Sparkles, LayoutGrid, Table2, ClipboardList, FolderGit2, CalendarClock } from 'lucide-react';
import { BugBayLogo } from '@/modules/bugbay/components/BugBayLogo';
import PanoramicaProgetti from '@/modules/bugbay/components/PanoramicaProgetti';
import PannelloAudit from '@/modules/bugbay/components/PannelloAudit';
import { toast } from 'sonner';
import type { SystemReport } from '@/modules/bugbay/types';
import PannelloRevisione from '@/modules/bugbay/components/pannello-revisione';
import LavagnaSegnalazioni from '@/modules/bugbay/components/LavagnaSegnalazioni';
import DettaglioSegnalazione from '@/modules/bugbay/components/DettaglioSegnalazione';
import SalaMacchine from '@/modules/bugbay/components/SalaMacchine';
import TabellaSegnalazioni from '@/modules/bugbay/components/TabellaSegnalazioni';
import { ModaleNuovaSegnalazione, ModaleModificaSegnalazione, ModaleRisolvi, type DatiNuovaSegnalazione } from '@/modules/bugbay/components/ModaliReport';
import { ModaleImpostazioniAI } from '@/modules/bugbay/components/ModaleImpostazioniAI';
import { useFixAgentico } from '@/modules/bugbay/hooks/use-fix-agentico';
import { useCampagnaQa } from '@/modules/bugbay/hooks/use-campagna-qa';

const FORM_VUOTO: DatiNuovaSegnalazione = {
  category: 'Bug', priority: 'Media',
  url: '', notes: '', reporterName: 'Sviluppatore', attachments: [],
};

export default function DebuggingPage() {
  // Pipeline unica: Lavagna (default) ⇄ Tabella sugli stessi dati + Campagna QA.
  const [vista, setVista] = useState<'lavagna' | 'tabella' | 'campagna' | 'progetti' | 'audit'>('lavagna');
  const [reports, setReports] = useState<SystemReport[]>([]);
  // Progetti registrati nell'hub, per il select "Progetto target" degli Audit.
  const [auditProjects, setAuditProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailReportId, setDetailReportId] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/debug-reports?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setReports(await res.json());
      else toast.error('Errore nel caricamento delle segnalazioni');
    } catch {
      toast.error('Impossibile connettersi alle API locali');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // Fix agentico e Campagna QA si parlano: la ref evita la dipendenza circolare
  // (l'approve di una run deve rinfrescare anche lo stato della campagna).
  const refreshCampagnaRef = useRef<() => void>(() => {});
  const fix = useFixAgentico({
    onApproved: () => { fetchReports(); refreshCampagnaRef.current(); },
  });
  const campagna = useCampagnaQa({
    aiRuns: fix.aiRuns,
    startAiBatch: fix.startAiBatch,
    onReportsChanged: fetchReports,
  });
  refreshCampagnaRef.current = campagna.fetchChecklistState;

  useEffect(() => { campagna.fetchChecklistState(); }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lista progetti hub per la vista Audit (lazy: solo quando serve).
  useEffect(() => {
    if (vista !== 'audit') return;
    fetch(`/api/agent-fix?overview=1&t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = (d?.projects ?? [])
          .filter((p: { projectId?: string | null }) => p.projectId)
          .map((p: { projectId: string; name?: string | null }) => ({ id: p.projectId, name: p.name || p.projectId.slice(0, 8) }));
        setAuditProjects(list);
      })
      .catch(() => setAuditProjects([]));
  }, [vista]);

  /* ── Stato modali ───────────────────────────────────────────── */
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<DatiNuovaSegnalazione>(FORM_VUOTO);
  const [editFormData, setEditFormData] = useState<SystemReport | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  /* ── Azioni sulle segnalazioni ──────────────────────────────── */

  /** Cambia stato di una segnalazione nella pipeline (Chiudi / Riapri / …). */
  const setReportStatus = async (id: string, status: SystemReport['status']) => {
    try {
      const res = await fetch('/api/debug-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, resolvedAt: status === 'Risolto' ? new Date().toISOString() : null }),
      });
      if (!res.ok) { toast.error('Impossibile aggiornare lo stato.'); return; }
      await fetchReports();
    } catch {
      toast.error('Errore di connessione.');
    }
  };

  const handleCreateReport = async () => {
    if (!formData.notes.trim()) {
      toast.error('Inserisci una descrizione per la segnalazione');
      return;
    }
    try {
      const res = await fetch('/api/debug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Nuova segnalazione inserita con successo');
        setIsFormOpen(false);
        fetchReports();
      } else toast.error('Errore durante l\'inserimento');
    } catch {
      toast.error('Errore di connessione');
    }
  };

  const handleUpdateReport = async () => {
    if (!editFormData || !editFormData.notes.trim() || !editFormData.area) return;
    try {
      const res = await fetch('/api/debug-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        toast.success('Segnalazione modificata con successo');
        setEditFormData(null);
        fetchReports();
      } else toast.error('Errore durante il salvataggio delle modifiche');
    } catch {
      toast.error('Errore di connessione');
    }
  };

  const handleConfirmResolve = async () => {
    if (!resolvingId) return;
    try {
      const res = await fetch('/api/debug-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolvingId,
          status: 'Risolto',
          resolvedAt: new Date().toISOString(),
          resolutionNotes: resolutionNotes.trim() || 'Risolto dallo sviluppatore.',
        }),
      });
      if (res.ok) {
        toast.success('Segnalazione chiusa');
        setResolvingId(null);
        fetchReports();
      } else toast.error('Errore nell\'aggiornamento dello stato');
    } catch {
      toast.error('Errore di connessione');
    }
  };

  /** Ripristino FEDELE per l'undo dell'eliminazione: stesso id e stato. */
  const ricreaSegnalazione = async (r: SystemReport) => {
    await fetch('/api/debug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: r.id, category: r.category, priority: r.priority, area: r.area, subArea: r.subArea,
        url: r.url, notes: r.notes, reporterName: r.reporterName, status: r.status,
        developer: r.developer, createdAt: r.createdAt, resolvedAt: r.resolvedAt,
        resolutionNotes: r.resolutionNotes,
      }),
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    const eliminate = reports.filter((r) => ids.includes(r.id));
    if (!confirm(`Eliminare ${eliminate.length} segnalazioni selezionate?`)) return;
    try {
      const res = await fetch(`/api/debug-reports?ids=${ids.join(',')}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Errore durante l\'eliminazione di gruppo'); return; }
      await fetchReports();
      toast.success(`${eliminate.length} segnalazioni eliminate`, {
        description: 'Puoi annullare l\'operazione.',
        action: {
          label: 'Annulla',
          onClick: async () => {
            for (const r of eliminate) await ricreaSegnalazione(r);
            fetchReports();
            toast.success('Eliminazione annullata, segnalazioni ripristinate.');
          },
        },
      });
    } catch {
      toast.error('Errore di connessione');
    }
  };

  /** Risolve un gruppo: 'batch' = 1 workflow per tutte, 'separate' = N run. */
  const handleBulkResolveAi = async (ids: string[], mode: 'batch' | 'separate') => {
    if (mode === 'batch' && ids.length > 1) {
      const ok = await fix.startAiBatch(ids);
      if (ok) toast.success(`Risoluzione AI avviata: 1 workflow per ${ids.length} segnalazioni.`);
    } else {
      const ok = await fix.startAiForReports(ids);
      if (ok) toast.success(`${ids.length} ${ids.length === 1 ? 'risoluzione avviata' : 'risoluzioni avviate'} in background.`);
    }
  };

  /** Apre l'area indicata dalla segnalazione (usa il path, non l'host). */
  const goToArea = (url?: string | null) => {
    if (!url) { toast.info('Nessuna area indicata per questa segnalazione.'); return; }
    let path = url;
    try {
      if (url.startsWith('http')) { const u = new URL(url); path = u.pathname + u.search; }
    } catch { path = url; }
    window.open(path || '/', '_blank', 'noopener,noreferrer');
  };

  /* ── Dati derivati ──────────────────────────────────────────── */

  const stats = useMemo(() => ({
    total: reports.length,
    open: reports.filter((r) => r.status === 'Aperto').length,
    inProgress: reports.filter((r) => r.status === 'In Lavorazione' || r.status === 'In Chiarimento').length,
    inVerifica: reports.filter((r) => r.status === 'In Verifica').length,
    resolved: reports.filter((r) => r.status === 'Risolto').length,
  }), [reports]);

  // Ordine di navigazione ↑/↓ nel drawer: stesso ordine della Lavagna.
  const navOrder = useMemo(() => {
    const cols: SystemReport['status'][][] = [['Aperto'], ['In Lavorazione', 'In Chiarimento'], ['In Verifica'], ['Risolto']];
    const peso: Record<string, number> = { Critica: 5, Urgente: 4, Alta: 3, Media: 2, Bassa: 1 };
    const out: string[] = [];
    for (const group of cols) {
      const items = reports
        .filter((r) => group.includes(r.status))
        .sort((a, b) => (peso[b.priority] ?? 0) - (peso[a.priority] ?? 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      out.push(...items.map((r) => r.id));
    }
    return out;
  }, [reports]);

  const navigateDetail = (dir: 1 | -1) => {
    setDetailReportId((cur) => {
      if (!cur) return cur;
      const idx = navOrder.indexOf(cur);
      if (idx === -1) return cur;
      return navOrder[idx + dir] ?? cur;
    });
  };

  /* ── Render ─────────────────────────────────────────────────── */

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
            {fix.projectName && (
              <span
                className="ml-s-1 px-s-3 py-1 rounded-md bb-accent-bg text-[11px] font-mono font-bold uppercase tracking-wider self-center shadow-sh-1"
                title="Progetto agganciato a questa console"
              >
                {fix.projectName}
              </span>
            )}
          </h1>
          <p className="text-sm font-mono text-neutral-400 mt-s-1">
            Issue pipeline — from intake to final verification, with agentic resolution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-s-3 shrink-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
            title="Impostazioni AI"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setFormData({ ...FORM_VUOTO, url: window.location.origin }); setIsFormOpen(true); }}
            className="px-s-6 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm bb-accent-bg transition-all flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
          >
            <PlusCircle className="w-4 h-4" />
            Nuova Segnalazione
          </button>
        </div>
      </div>

      {/* Switcher viste: Lavagna ⇄ Tabella (stessi dati) + Campagna QA */}
      <div className="max-w-[1800px] mx-auto">
        <div className="inline-flex items-center gap-1 bg-neutral-900 border border-neutral-850 rounded-md p-1 shadow-sh-1">
          {([['lavagna', 'Lavagna', LayoutGrid], ['tabella', 'Tabella', Table2], ['campagna', 'Campagna QA', ClipboardList], ['progetti', 'Progetti', FolderGit2], ['audit', 'Audit', CalendarClock]] as const).map(([key, label, Icon]) => {
            const badge = key === 'lavagna' ? stats.inVerifica + fix.aiAttention : key === 'tabella' ? stats.open : key === 'campagna' ? campagna.revisionIssuesCount : 0;
            const badgeCls = key === 'lavagna' ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-red/15 text-red border-red/30';
            return (
              <button
                key={key}
                onClick={() => setVista(key)}
                className={`px-s-5 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm transition-all cursor-pointer inline-flex items-center gap-s-2 ${
                  vista === key ? 'bb-accent-bg shadow-sh-1' : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none ${vista === key ? 'bg-neutral-900 text-white border-neutral-900' : badgeCls}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {vista === 'progetti' && (
        <PanoramicaProgetti currentProjectName={fix.projectName} />
      )}

      {vista === 'audit' && (
        <PannelloAudit projects={auditProjects} />
      )}

      {vista === 'campagna' && (
        <PannelloRevisione
          aiProvider={fix.aiProvider}
          geminiApiKey={fix.geminiApiKey}
          deepseekApiKey={fix.deepseekApiKey}
          aiRuns={fix.aiRuns}
          checklistRunMap={campagna.checklistRunMap}
          onOpenAiModal={(reportId) => setDetailReportId(reportId)}
          onAbortAi={async (reportId) => {
            const run = fix.aiRuns[reportId];
            if (run) await fix.abortAi(run);
          }}
          onStartAiBulk={campagna.handleStartAiBulk}
        />
      )}

      {vista === 'lavagna' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 max-w-[1800px] mx-auto">
            {([
              { label: 'Aperte', value: stats.open, accent: 'border-l-red', text: 'text-red', labelCls: 'text-red/80', Icon: Bug, iconCls: 'text-red bg-red/10' },
              { label: 'In lavorazione', value: stats.inProgress, accent: 'border-l-sky', text: 'text-sky', labelCls: 'text-sky/80', Icon: Wrench, iconCls: 'text-sky bg-sky/10' },
              { label: 'In verifica', value: stats.inVerifica, accent: 'border-l-violet-500', text: 'text-violet-300', labelCls: 'text-violet-300/80', Icon: Sparkles, iconCls: 'text-violet-300 bg-violet-500/10' },
              { label: 'Chiuse', value: stats.resolved, accent: 'border-l-green', text: 'text-green', labelCls: 'text-green/80', Icon: CheckCircle, iconCls: 'text-green bg-green/10' },
            ] as const).map(({ label, value, accent, text, labelCls, Icon, iconCls }) => (
              <div key={label} className={`bg-neutral-900 border border-neutral-850 border-l-2 ${accent} rounded-md p-s-4 flex items-center justify-between shadow-sh-1`}>
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

          <LavagnaSegnalazioni
            reports={reports}
            aiRuns={fix.aiRuns}
            aiEnabled={fix.aiEnabled}
            onOpenDetail={(id) => setDetailReportId(id)}
            onStartAi={(id) => { void fix.startAiForReports([id]); }}
          />
        </>
      )}

      {vista === 'tabella' && (
        <TabellaSegnalazioni
          reports={reports}
          loading={loading}
          aiRuns={fix.aiRuns}
          aiEnabled={fix.aiEnabled}
          stats={stats}
          revisionIssuesCount={campagna.revisionIssuesCount}
          bulkBusy={campagna.bulkBusy}
          onResolveAllIssues={campagna.handleResolveAllRevisionIssues}
          onOpenDetail={(id) => setDetailReportId(id)}
          onOpenEdit={(report) => setEditFormData({ ...report })}
          onStartResolve={(id) => { setResolvingId(id); setResolutionNotes(''); }}
          onUpdateStatus={(id, status) => { void setReportStatus(id, status); }}
          onAbortRun={fix.abortAi}
          onResumeRun={fix.resumeAi}
          onDismissError={fix.dismissError}
          onBulkResolveAi={handleBulkResolveAi}
          onBulkDelete={handleBulkDelete}
          onGoToArea={goToArea}
        />
      )}

      {/* Modali */}
      {isFormOpen && (
        <ModaleNuovaSegnalazione
          value={formData}
          onChange={setFormData}
          onClose={() => setIsFormOpen(false)}
          onCreate={handleCreateReport}
          ai={{ aiProvider: fix.aiProvider, geminiApiKey: fix.geminiApiKey, deepseekApiKey: fix.deepseekApiKey }}
        />
      )}
      {editFormData && (
        <ModaleModificaSegnalazione
          value={editFormData}
          onChange={setEditFormData}
          onClose={() => setEditFormData(null)}
          onSave={handleUpdateReport}
          ai={{ aiProvider: fix.aiProvider, geminiApiKey: fix.geminiApiKey, deepseekApiKey: fix.deepseekApiKey }}
        />
      )}
      {resolvingId && (
        <ModaleRisolvi
          notes={resolutionNotes}
          onNotes={setResolutionNotes}
          onClose={() => setResolvingId(null)}
          onConfirm={handleConfirmResolve}
          aiEnabled={fix.aiEnabled}
          ai={{ aiProvider: fix.aiProvider, geminiApiKey: fix.geminiApiKey, deepseekApiKey: fix.deepseekApiKey }}
        />
      )}
      {isSettingsOpen && (
        <ModaleImpostazioniAI
          provider={fix.aiProvider}
          geminiApiKey={fix.geminiApiKey}
          deepseekApiKey={fix.deepseekApiKey}
          anthropicApiKey={fix.anthropicApiKey}
          onProvider={fix.setAiProvider}
          onGeminiKey={fix.setGeminiApiKey}
          onDeepseekKey={fix.setDeepseekApiKey}
          onAnthropicKey={fix.setAnthropicApiKey}
          onClose={() => setIsSettingsOpen(false)}
          onSave={async () => {
            await fix.saveAiSettings(fix.aiProvider, fix.geminiApiKey, fix.deepseekApiKey, fix.anthropicApiKey);
            setIsSettingsOpen(false);
          }}
        />
      )}

      {/* Drawer di dettaglio segnalazione (review, chiarimento, timeline) */}
      {detailReportId && (() => {
        const rep = reports.find((r) => r.id === detailReportId);
        if (!rep) return null;
        return (
          <DettaglioSegnalazione
            report={rep}
            run={fix.aiRuns[detailReportId]}
            aiEnabled={fix.aiEnabled}
            aiProvider={fix.aiProvider}
            geminiApiKey={fix.geminiApiKey}
            deepseekApiKey={fix.deepseekApiKey}
            onClose={() => setDetailReportId(null)}
            onNavigate={navigateDetail}
            onUpdateRun={fix.applyRunUpdate}
            onStartAi={(id) => { void fix.startAiForReports([id]); }}
            onSetStatus={setReportStatus}
          />
        );
      })()}

      {/* Sala macchine: strip fissa + drawer gestione agenti, da ogni vista */}
      {fix.aiEnabled && (
        <SalaMacchine
          aiRuns={fix.aiRuns}
          setAiRuns={fix.setAiRuns}
          onOpenDetail={(id) => setDetailReportId(id)}
          onRefreshReports={() => fetchReports()}
        />
      )}
      </div>
    </div>
  );
}
