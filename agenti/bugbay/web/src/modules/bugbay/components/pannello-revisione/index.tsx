/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Campagna di revisione QA (tab della console di debugging), modello DB-backed
 * (Refresh-with-AI). Carica le voci generate dall'agente (GET), le raggruppa per
 * sezione e le rende editabili: stato da-controllare/ok/problema, note per voce/
 * area/generali, "Refresh con AI" che rigenera la checklist dalle modifiche git,
 * cancellazione per voce e risoluzione AI cumulativa (le voci diventano
 * segnalazioni della pipeline risolte da una run batch). Sotto-componenti nella
 * stessa cartella; lo stato vive su DB tramite /api/debug-checklist.
 *
 * @indice
 * - PannelloRevisione → componente principale della Campagna QA
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ChecklistItemRow, ChecklistMeta, ChecklistState } from '@/modules/bugbay/data/revisione-checklist';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { AI_WORKING } from '@/modules/bugbay/config';
import { ItemRow } from './ItemRow';
import { IntestazioneCampagna, FiltriCampagna } from './CampagnaHeader';
import { SezioneCard, StoricoCampagna, NoteGeneraliCampagna, EsportaPromptModal, BarraAzioniBulk } from './CampagnaExtra';
import { generaPromptMarkdown } from './revisione-markdown';
import {
  GENERAL_NOTE_KEY, sezKey, raggruppaPerSezione, statByItems,
  type FilterType, type StatoVoce,
} from './revisione-stato';
import { ClipboardList } from 'lucide-react';

const META_VUOTA: ChecklistMeta = { lastRefreshSha: null, lastRefreshAt: null, base: null };

/** Stato vuoto della campagna (nessuna voce / nessun risultato di ricerca). */
function MessaggioVuoto({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-850 rounded-md p-s-10 text-center shadow-sh-2">
      <div className="w-12 h-12 rounded-full bg-neutral-850 flex items-center justify-center mx-auto mb-s-3 text-neutral-500">
        <ClipboardList className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-white text-base">{titolo}</h3>
      <p className="text-xs text-neutral-400 mt-1">{testo}</p>
    </div>
  );
}

interface Props {
  aiProvider?: 'claude-headless' | 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepseekApiKey?: string;
  aiRuns?: Record<string, AgentRun>;
  onStartAiBulk?: (items: { item: ChecklistItemRow; note: string }[]) => Promise<string | null>;
  onOpenAiModal?: (reportId: string) => void;
  checklistRunMap?: Record<string, string>;
  onAbortAi?: (reportId: string) => Promise<void>;
}

export default function PannelloRevisione({
  aiProvider = 'claude-headless',
  geminiApiKey = '',
  deepseekApiKey = '',
  aiRuns = {},
  onStartAiBulk,
  onOpenAiModal,
  checklistRunMap = {},
  onAbortAi,
}: Props) {
  const [items, setItems] = useState<ChecklistItemRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<ChecklistMeta>(META_VUOTA);
  const [refreshing, setRefreshing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  // Filtro tipo multi-select: Set vuoto = "Tutti" (nessun filtro).
  const [filterTypes, setFilterTypes] = useState<Set<FilterType>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [exportMarkdown, setExportMarkdown] = useState<string | null>(null);

  /* ── Caricamento stato (GET → ChecklistState) ── */

  const fetchState = async () => {
    try {
      const res = await fetch('/api/debug-checklist', { cache: 'no-store' });
      if (!res.ok) return;
      const state = (await res.json()) as Partial<ChecklistState>;
      setItems(Array.isArray(state?.items) ? state.items : []);
      setNotes(state?.notes && typeof state.notes === 'object' ? state.notes : {});
      setMeta(state?.meta && typeof state.meta === 'object' ? state.meta : META_VUOTA);
    } catch { /* la UI resta sullo stato precedente */ }
  };

  useEffect(() => { fetchState(); }, []);

  // L'approve di una run marca "ok" le voci collegate (evento dalla pagina)
  useEffect(() => {
    const handleAiApproved = (e: Event) => {
      const { reportId } = (e as CustomEvent).detail;
      const itemIds = Object.keys(checklistRunMap).filter((k) => checklistRunMap[k] === reportId);
      if (itemIds.length === 0) return;
      const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      for (const id of itemIds) {
        const cur = items.find((it) => it.id === id);
        void saveItem(id, 'ok', `[Risolto da AI alle ${nowTime}] ${cur?.note || ''}`.trim());
      }
      setOpenNotes((prev) => { const n = new Set(prev); itemIds.forEach((id) => n.delete(id)); return n; });
      setSelectedItemIds((prev) => { const n = new Set(prev); itemIds.forEach((id) => n.delete(id)); return n; });
      toast.success(`${itemIds.length} elementi contrassegnati come OK.`);
    };
    window.addEventListener('baldisport-ai-approved', handleAiApproved);
    return () => window.removeEventListener('baldisport-ai-approved', handleAiApproved);
  }, [items, checklistRunMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deseleziona le voci la cui run è arrivata in review
  useEffect(() => {
    let changed = false;
    const nextSelected = new Set(selectedItemIds);
    for (const id of Array.from(selectedItemIds)) {
      const runId = checklistRunMap[id];
      const run = runId ? aiRuns[runId] : null;
      if (run && run.phase === 'review') { nextSelected.delete(id); changed = true; }
    }
    if (changed) setSelectedItemIds(nextSelected);
  }, [aiRuns, checklistRunMap, selectedItemIds]);

  /* ── Mutazioni voce/stato/note (DB) ── */

  /** POST { action:'set_item' } con optimistic update sulla riga. */
  const saveItem = async (id: string, status: StatoVoce, note?: string) => {
    setItems((prev) => prev.map((it) => (it.id === id
      ? { ...it, status, note: note !== undefined ? note : it.note }
      : it)));
    try {
      const res = await fetch('/api/debug-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_item', id, status, ...(note !== undefined ? { note } : {}) }),
      });
      if (!res.ok) toast.error('Errore durante il salvataggio della voce.');
    } catch {
      toast.error('Impossibile salvare la voce: errore di rete.');
    }
  };

  const itemById = (id: string) => items.find((it) => it.id === id);

  const setStatus = (id: string, status: 'ok' | 'problema') => {
    const cur = itemById(id);
    const next: StatoVoce = cur?.status === status ? null : status;
    void saveItem(id, next);
    if (next === 'problema') setOpenNotes((p) => new Set(p).add(id));
  };

  // La nota si modifica localmente; il salvataggio su DB avviene con "Salva nota".
  const setNoteLocal = (id: string, note: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, note } : it)));

  const saveNote = async (id: string) => {
    const cur = itemById(id);
    if (!cur) return;
    setSavingNote(true);
    await saveItem(id, cur.status, cur.note ?? '');
    setSavingNote(false);
    toast.success('Nota salvata.');
  };

  /** DELETE ?itemId=<id> con rimozione locale. */
  const deleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/debug-checklist?itemId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Errore durante la cancellazione della voce.'); return; }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setSelectedItemIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Voce eliminata.');
    } catch {
      toast.error('Impossibile eliminare la voce: errore di rete.');
    }
  };

  /* ── Note libere (generali / di area) ── */

  const persistNotes = async (next: Record<string, string>) => {
    setNotes(next);
    try {
      const res = await fetch('/api/debug-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_notes', notes: next }),
      });
      if (!res.ok) toast.error('Errore durante il salvataggio delle note.');
    } catch {
      toast.error('Impossibile salvare le note: errore di rete.');
    }
  };

  const setSectionNote = (title: string, note: string) => setNotes((prev) => ({ ...prev, [sezKey(title)]: note }));
  const setGeneral = (note: string) => setNotes((prev) => ({ ...prev, [GENERAL_NOTE_KEY]: note }));

  /* ── Refresh con AI ── */

  const handleRefresh = async (base?: string) => {
    setRefreshing(true);
    toast.info('Refresh con AI avviato: analisi delle modifiche recenti…');
    try {
      const res = await fetch('/api/debug-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', ...(base ? { base } : {}) }),
      });
      if (!res.ok) { toast.error('Errore durante il refresh con AI.'); return; }
      const out = await res.json();
      const added = typeof out?.added === 'number' ? out.added : 0;
      const updated = typeof out?.updated === 'number' ? out.updated : 0;
      await fetchState();
      toast.success(`Checklist aggiornata: ${added} nuove, ${updated} aggiornate.`);
    } catch {
      toast.error('Impossibile eseguire il refresh: errore di rete.');
    } finally {
      setRefreshing(false);
    }
  };

  /* ── Azioni AI (run batch via prop dalla console) ── */

  const avviaBulk = async (voci: { item: ChecklistItemRow; note: string }[], ids: string[]) => {
    if (!onStartAiBulk) return;
    setBulkBusy(true);
    try {
      const reportId = await onStartAiBulk(voci);
      if (reportId) {
        for (const id of ids) void saveItem(id, null);
        setSelectedItemIds(new Set());
        toast.success(`Risoluzione AI avviata per ${ids.length} element${ids.length === 1 ? 'o' : 'i'}.`);
      }
    } catch {
      toast.error("Errore durante l'avvio della risoluzione AI.");
    }
    setBulkBusy(false);
  };

  const handleBulkResolveAi = async () => {
    if (selectedItemIds.size === 0 || !onStartAiBulk) return;
    const toStart = Array.from(selectedItemIds).filter((id) => {
      const runId = checklistRunMap[id];
      const run = runId ? aiRuns[runId] : null;
      return !(run && AI_WORKING.includes(run.phase));
    });
    if (toStart.length === 0) {
      toast.info('Tutti gli elementi selezionati hanno già una run AI attiva.');
      setSelectedItemIds(new Set());
      return;
    }
    toast.info(`Avvio risoluzione AI cumulativa per ${toStart.length} elementi...`);
    const voci = toStart
      .map((id) => itemById(id))
      .filter((it): it is ChecklistItemRow => Boolean(it))
      .map((it) => ({ item: it, note: it.note ?? '' }));
    await avviaBulk(voci, toStart);
  };

  const handleResolveAi = (item: ChecklistItemRow) =>
    avviaBulk([{ item, note: item.note ?? '' }], [item.id]);

  const handleResolveAllIssues = async () => {
    const issueItems = items.filter((it) => it.status === 'problema');
    if (issueItems.length === 0) { toast.info('Nessun problema attivo da risolvere.'); return; }
    toast.info(`Avvio risoluzione AI cumulativa per ${issueItems.length} problemi...`);
    await avviaBulk(issueItems.map((item) => ({ item, note: item.note ?? '' })), issueItems.map((i) => i.id));
  };

  /* ── Statistiche, filtri, raggruppamento ── */

  const stats = useMemo(() => statByItems(items), [items]);

  const visibleSezioni = useMemo(() => {
    const filtered = items.filter((it) => {
      const run = checklistRunMap[it.id] ? aiRuns[checklistRunMap[it.id]] : null;
      const runPhase = run?.phase ?? '';

      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase();
        if (!it.label.toLowerCase().includes(query) && !it.descr.toLowerCase().includes(query) && !(it.note ?? '').toLowerCase().includes(query)) return false;
      }
      if (filterTypes.size > 0) {
        const matchType = Array.from(filterTypes).some((ft) => {
          if (ft === 'ok') return it.status === 'ok';
          if (ft === 'problema') return it.status === 'problema';
          if (ft === 'pending') return it.status === null;
          if (ft === 'ai_resolved') return runPhase === 'review';
          if (ft === 'ai_working') return AI_WORKING.includes(runPhase);
          return false;
        });
        if (!matchType) return false;
      }
      return true;
    });
    return raggruppaPerSezione(filtered);
  }, [items, checklistRunMap, aiRuns, filterSearch, filterTypes]);

  const hasActiveAiRuns = useMemo(
    () => Object.values(aiRuns).some((run) => run && AI_WORKING.includes(run.phase)),
    [aiRuns],
  );

  const visibleIds = useMemo(() => visibleSezioni.flatMap((s) => s.items.map((it) => it.id)), [visibleSezioni]);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedItemIds.has(id));

  const handleSelectAll = () => {
    if (visibleIds.length === 0) return;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleSelectSection = (sectionItems: ChecklistItemRow[]) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const ids = sectionItems.map((it) => it.id);
      if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  /** Conteggio della sezione sull'INSIEME completo (non solo le voci filtrate). */
  const sectionCount = (title: string) => {
    let r = 0, i = 0, total = 0;
    for (const it of items) {
      if (it.sectionTitle !== title) continue;
      total++;
      if (it.status === 'ok') r++; else if (it.status === 'problema') i++;
    }
    return { r, i, total, done: total > 0 && r + i === total };
  };

  const toggleCollapse = (title: string) =>
    setCollapsed((p) => { const n = new Set(p); if (n.has(title)) n.delete(title); else n.add(title); return n; });
  const toggleNote = (id: string) =>
    setOpenNotes((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleFilterType = (t: FilterType) =>
    setFilterTypes((prev) => { const next = new Set(prev); if (next.has(t)) next.delete(t); else next.add(t); return next; });

  const goToArea = (url: string) => {
    let path = url;
    try {
      if (url.startsWith('http')) { const u = new URL(url); path = u.pathname + u.search; }
    } catch { path = url; }
    window.open(path || '/', '_blank', 'noopener,noreferrer');
  };

  const handleReset = async () => {
    if (!confirm('Azzerare lo stato di revisione (ok/problema/note) di tutte le voci? Le voci NON vengono eliminate.')) return;
    for (const it of items) {
      if (it.status !== null || (it.note && it.note.length > 0)) void saveItem(it.id, null, '');
    }
    setOpenNotes(new Set());
    await persistNotes({});
    toast.success('Stato di revisione azzerato.');
  };

  const wand = { aiProvider, geminiApiKey, deepseekApiKey };

  /* ── Render ── */
  return (
    <div className="max-w-[1800px] mx-auto flex flex-col gap-s-5">
      <IntestazioneCampagna
        stats={stats}
        meta={meta}
        bulkBusy={bulkBusy}
        refreshing={refreshing}
        showResolveAll={!!onStartAiBulk}
        onResolveAll={handleResolveAllIssues}
        onRefresh={handleRefresh}
        onExport={() => setExportMarkdown(generaPromptMarkdown(items, notes))}
        onReset={handleReset}
      />

      <FiltriCampagna
        search={filterSearch}
        onSearch={setFilterSearch}
        filterTypes={filterTypes}
        onToggleType={toggleFilterType}
        onClearTypes={() => setFilterTypes(new Set())}
        hasActiveAiRuns={hasActiveAiRuns}
        isAllSelected={isAllVisibleSelected}
        onSelectAll={handleSelectAll}
      />

      {items.length === 0 ? (
        <MessaggioVuoto titolo="Nessuna voce" testo="Nessuna voce — avvia un Refresh con AI per generarla dalle modifiche recenti." />
      ) : visibleSezioni.length === 0 ? (
        <MessaggioVuoto titolo="Nessun elemento trovato" testo="Nessuna voce corrisponde ai criteri di ricerca impostati." />
      ) : (
        visibleSezioni.map((sez, idx) => (
          <SezioneCard
            key={sez.title}
            title={sez.title}
            num={idx + 1}
            count={sectionCount(sez.title)}
            collapsed={collapsed.has(sez.title)}
            sectionAllSelected={sez.items.length > 0 && sez.items.every((it) => selectedItemIds.has(it.id))}
            noteArea={notes[sezKey(sez.title)] ?? ''}
            onToggleCollapse={() => toggleCollapse(sez.title)}
            onSelectSection={() => handleSelectSection(sez.items)}
            onNoteArea={(v) => setSectionNote(sez.title, v)}
            wand={wand}
          >
            {sez.items.map((it) => {
              const run = checklistRunMap[it.id] ? aiRuns[checklistRunMap[it.id]] : null;
              return (
                <ItemRow
                  key={it.id}
                  item={it}
                  status={run?.phase ? undefined : (it.status ?? undefined)}
                  note={it.note ?? ''}
                  notesOpen={openNotes.has(it.id)}
                  onOk={() => setStatus(it.id, 'ok')}
                  onIssue={() => setStatus(it.id, 'problema')}
                  onToggleNote={() => toggleNote(it.id)}
                  onNote={(v) => setNoteLocal(it.id, v)}
                  onGo={goToArea}
                  onDelete={() => deleteItem(it.id)}
                  onResolveAi={onStartAiBulk ? () => handleResolveAi(it) : undefined}
                  run={run}
                  aiProvider={aiProvider}
                  geminiApiKey={geminiApiKey}
                  deepseekApiKey={deepseekApiKey}
                  onOpenAiModal={run && onOpenAiModal ? () => onOpenAiModal(run.reportId) : undefined}
                  onAbortAi={onAbortAi ? () => onAbortAi(checklistRunMap[it.id]) : undefined}
                  onSaveNote={() => saveNote(it.id)}
                  isSaving={savingNote}
                  isSelected={selectedItemIds.has(it.id)}
                  onToggleSelect={() => setSelectedItemIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(it.id)) next.delete(it.id); else next.add(it.id);
                    return next;
                  })}
                />
              );
            })}
          </SezioneCard>
        ))
      )}

      <StoricoCampagna />

      <NoteGeneraliCampagna
        value={notes[GENERAL_NOTE_KEY] ?? ''}
        onChange={setGeneral}
        onSave={() => persistNotes(notes)}
        wand={wand}
      />

      {exportMarkdown !== null && (
        <EsportaPromptModal markdown={exportMarkdown} onClose={() => setExportMarkdown(null)} />
      )}

      {/* Barra azioni bulk della campagna */}
      <BarraAzioniBulk
        count={selectedItemIds.size}
        bulkBusy={bulkBusy}
        showResolveAi={!!onStartAiBulk}
        onResolveAi={handleBulkResolveAi}
        onSelectAll={() => setSelectedItemIds(new Set(items.map((it) => it.id)))}
        onClear={() => setSelectedItemIds(new Set())}
      />
    </div>
  );
}
