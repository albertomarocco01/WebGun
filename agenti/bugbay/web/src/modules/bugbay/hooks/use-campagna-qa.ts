/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Hook della Campagna di revisione QA lato console, modello DB-backed
 * (Refresh-with-AI). Carica le voci generate dall'agente (GET), espone le
 * azioni di refresh / cancellazione / aggiornamento stato di una voce, le note
 * libere e i metadati dell'ultimo refresh. Conserva la superficie usata dalla
 * ConsolePage (conteggio problemi, mappa item→segnalazione, run batch) e ne
 * aggiunge la parte data-backed (items/meta/notes/refresh/deleteItem/setItem).
 *
 * @indice
 * - useCampagnaQa → stato checklist DB-backed + azioni campagna
 */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { AI_WORKING } from '@/modules/bugbay/config';
import type {
  ChecklistItemRow,
  ChecklistMeta,
} from '@/modules/bugbay/data/revisione-checklist';

const META_VUOTA: ChecklistMeta = { lastRefreshSha: null, lastRefreshAt: null, base: null };

interface Opts {
  aiRuns: Record<string, AgentRun>;
  /** Avvia UNA run batch sulle segnalazioni indicate (dal fix agentico). */
  startAiBatch: (ids: string[]) => Promise<boolean>;
  /** Rinfresca l'elenco segnalazioni dopo le creazioni. */
  onReportsChanged: () => void;
}

/** Voce di campagna accoppiata alla nota del revisore (input della run batch). */
interface VoceConNota {
  item: ChecklistItemRow;
  note: string;
}

const CHECKLIST_RUN_MAP_KEY = 'baldisport-checklist-run-map';

export function useCampagnaQa({ aiRuns, startAiBatch, onReportsChanged }: Opts) {
  const [items, setItems] = useState<ChecklistItemRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<ChecklistMeta>(META_VUOTA);
  const [revisionIssuesCount, setRevisionIssuesCount] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Mappa locale checklistItemId → reportId per tracciare le run avviate dalla campagna
  const [checklistRunMap, setChecklistRunMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedMap = localStorage.getItem(CHECKLIST_RUN_MAP_KEY);
    if (savedMap) {
      try { setChecklistRunMap(JSON.parse(savedMap)); } catch { /* ignore */ }
    }
  }, []);

  const updateChecklistRunMap = (itemId: string, reportId: string) => {
    setChecklistRunMap((prev) => {
      const next = { ...prev, [itemId]: reportId };
      localStorage.setItem(CHECKLIST_RUN_MAP_KEY, JSON.stringify(next));
      return next;
    });
  };

  const contaProblemi = (rows: ChecklistItemRow[]) =>
    setRevisionIssuesCount(rows.filter((it) => it.status === 'problema').length);

  /** GET /api/debug-checklist → popola items/notes/meta. */
  const fetchChecklistState = async () => {
    try {
      const res = await fetch('/api/debug-checklist', { cache: 'no-store' });
      if (!res.ok) return;
      const state = await res.json();
      const rows: ChecklistItemRow[] = Array.isArray(state?.items) ? state.items : [];
      setItems(rows);
      setNotes(state?.notes && typeof state.notes === 'object' ? state.notes : {});
      setMeta(state?.meta && typeof state.meta === 'object' ? state.meta : META_VUOTA);
      contaProblemi(rows);
    } catch { /* la UI resta sullo stato precedente */ }
  };

  /**
   * Refresh con AI: l'agente legge le modifiche git dall'ultimo refresh
   * (o dal `base` indicato) e rigenera la checklist. POST { action:'refresh' }.
   */
  const refresh = async (base?: string) => {
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
      await fetchChecklistState();
      toast.success(`Checklist aggiornata: ${added} nuove, ${updated} aggiornate.`);
    } catch {
      toast.error('Impossibile eseguire il refresh: errore di rete.');
    } finally {
      setRefreshing(false);
    }
  };

  /** DELETE ?itemId=<id> → rimuove una voce e aggiorna lo stato locale. */
  const deleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/debug-checklist?itemId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Errore durante la cancellazione della voce.'); return; }
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== id);
        contaProblemi(next);
        return next;
      });
      toast.success('Voce eliminata.');
    } catch {
      toast.error('Impossibile eliminare la voce: errore di rete.');
    }
  };

  /** POST { action:'set_item' } → aggiorna stato/nota di una voce (con optimistic update). */
  const setItem = async (id: string, status: ChecklistItemRow['status'], note?: string) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id
        ? { ...it, status, note: note !== undefined ? note : it.note }
        : it));
      contaProblemi(next);
      return next;
    });
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

  /** POST { action:'save_notes' } → salva le note libere (__general/__sec_*). */
  const saveNotes = async (next: Record<string, string>) => {
    setNotes(next);
    try {
      const res = await fetch('/api/debug-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_notes', notes: next }),
      });
      if (!res.ok) toast.error('Errore durante il salvataggio delle note.');
      else toast.success('Note salvate.');
    } catch {
      toast.error('Impossibile salvare le note: errore di rete.');
    }
  };

  /**
   * Crea le segnalazioni per le voci di campagna indicate e avvia UNA sola
   * run batch che le risolve tutte. Ritorna il primo reportId creato (o null).
   */
  const handleStartAiBulk = async (voci: VoceConNota[]): Promise<string | null> => {
    const createdIds: string[] = [];
    for (const { item, note } of voci) {
      const critico = item.badges.includes('critical');
      const newReport = {
        area: item.label.slice(0, 50),
        subArea: item.sectionTitle,
        category: critico ? 'Bug' : 'Miglioria Proposta',
        priority: item.priority || (critico ? 'Urgente' : 'Media'),
        url: item.urls[0]?.url || item.files[0] || '',
        notes: `[Revisione QA - ${item.id}] ${item.label}\n\nDescrizione: ${item.descr.replace(/<[^>]*>/g, '')}\n\nNota revisore: ${note || 'Verificare e risolvere.'}`,
        reporterName: 'Revisore QA',
        developer: null,
      };
      try {
        const res = await fetch('/api/debug-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport),
        });
        if (res.ok) {
          const created = await res.json();
          createdIds.push(created.id);
          updateChecklistRunMap(item.id, created.id);
        }
      } catch { /* continua con le altre */ }
    }
    if (createdIds.length === 0) { toast.error('Errore nella creazione delle segnalazioni.'); return null; }
    const ok = await startAiBatch(createdIds);
    onReportsChanged();
    return ok ? createdIds[0] : null;
  };

  /** Avvia in un solo workflow tutti i problemi aperti della campagna. */
  const handleResolveAllRevisionIssues = async () => {
    const issueItems = items.filter((it) => it.status === 'problema');
    if (issueItems.length === 0) {
      toast.info('Nessun problema attivo da risolvere.');
      return;
    }

    setBulkBusy(true);
    // Esclude le voci con una run già in lavorazione
    const toStart = issueItems.filter((item) => {
      const mappedReportId = checklistRunMap[item.id];
      const run = mappedReportId ? aiRuns[mappedReportId] : null;
      return !(run && AI_WORKING.includes(run.phase));
    });
    if (toStart.length === 0) {
      toast.info('Tutti i problemi hanno già una run AI attiva.');
      setBulkBusy(false);
      return;
    }

    toast.info(`Avvio risoluzione AI per ${toStart.length} problemi (un solo workflow)…`);
    const firstId = await handleStartAiBulk(
      toStart.map((item) => ({ item, note: item.note ?? '' })),
    );

    if (firstId) {
      // Avviata la run, le voci tornano "da controllare" finché non si approva il fix.
      setItems((prev) => {
        const next = prev.map((it) =>
          toStart.some((s) => s.id === it.id) ? { ...it, status: null } : it);
        contaProblemi(next);
        return next;
      });
      for (const item of toStart) void setItem(item.id, null);
      toast.success(`Risoluzione AI avviata: 1 workflow per ${toStart.length} problemi.`);
    }

    setBulkBusy(false);
  };

  return {
    // — superficie storica (consumata da ConsolePage, NON rinominare) —
    checklistState: items,
    revisionIssuesCount, bulkBusy, checklistRunMap,
    fetchChecklistState, handleStartAiBulk, handleResolveAllRevisionIssues,
    // — superficie DB-backed (Refresh-with-AI) —
    items, meta, notes, refreshing,
    refresh, deleteItem, setItem, saveNotes,
  };
}
