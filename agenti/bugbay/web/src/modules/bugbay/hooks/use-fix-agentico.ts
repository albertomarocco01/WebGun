/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Hook del fix agentico lato client: incapsula stato e ciclo di vita delle run
 * AI (abilitazione, re-idratazione, poller unico su ?active=1 batch-aware),
 * le impostazioni del provider e tutte le azioni (start singolo/batch, abort,
 * resume, applicazione degli update dal drawer). Le run batch coprono più
 * segnalazioni: la mappa aiRuns è indicizzata per reportId.
 *
 * @indice
 * - useFixAgentico → stato + azioni del fix agentico per la console
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { AI_WORKING } from '@/modules/bugbay/config';

export type AiProvider = 'claude-headless' | 'gemini' | 'deepseek';

/** Indicizza le run per reportId: le run batch coprono più segnalazioni. */
function indexRunsByReport(runs: AgentRun[]): Record<string, AgentRun> {
  const map: Record<string, AgentRun> = {};
  for (const r of runs) {
    const ids = r.reports?.length ? r.reports.map((rep) => rep.reportId) : [r.reportId];
    for (const id of ids) map[id] = r;
  }
  return map;
}

interface Opts {
  /** Chiamata quando una run viene approvata (per rinfrescare report/checklist). */
  onApproved?: () => void;
}

export function useFixAgentico({ onApproved }: Opts = {}) {
  // Fix agentico (attivo solo in locale con ENABLE_AGENT_FIX=1)
  const [aiEnabled, setAiEnabled] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [aiRuns, setAiRuns] = useState<Record<string, AgentRun>>({});
  const aiRunsRef = useRef<Record<string, AgentRun>>({});
  aiRunsRef.current = aiRuns;

  // Impostazioni provider (localStorage + server)
  const [aiProvider, setAiProvider] = useState<AiProvider>('claude-headless');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');

  useEffect(() => {
    const savedProvider = localStorage.getItem('baldisport-ai-provider');
    const savedKey = localStorage.getItem('baldisport-gemini-key');
    const savedDeepseekKey = localStorage.getItem('baldisport-deepseek-key');
    const savedAnthropicKey = localStorage.getItem('baldisport-anthropic-key');
    if (savedProvider === 'claude-headless' || savedProvider === 'gemini' || savedProvider === 'deepseek') {
      setAiProvider(savedProvider);
    }
    if (savedKey) setGeminiApiKey(savedKey);
    if (savedDeepseekKey) setDeepseekApiKey(savedDeepseekKey);
    if (savedAnthropicKey) setAnthropicApiKey(savedAnthropicKey);

    // Il server dice quale provider e QUALI chiavi ha (solo booleani: le chiavi
    // non escono più dal server per sicurezza). I valori restano in localStorage;
    // il fix funziona comunque perché il server usa le proprie chiavi salvate.
    fetch('/api/agent-fix?settings=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.provider) setAiProvider(d.provider);
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Abilitazione + re-idratazione delle run attive (sopravvive ai refresh)
  useEffect(() => {
    fetch('/api/agent-fix')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAiEnabled(d?.enabled === true);
        if (d?.projectName) setProjectName(d.projectName);
        if (d?.enabled === true) {
          fetch('/api/agent-fix?active=1')
            .then((r) => (r.ok ? r.json() : []))
            .then((runs: AgentRun[]) => {
              if (Array.isArray(runs) && runs.length) setAiRuns(indexRunsByReport(runs));
            })
            .catch(() => { /* ignore */ });
        }
      })
      .catch(() => setAiEnabled(false));
  }, []);

  // Poller UNICO: una sola chiamata ?active=1 per tutta la pagina.
  useEffect(() => {
    const iv = setInterval(async () => {
      const current = aiRunsRef.current;
      const hasWork = Object.values(current).some((r) => AI_WORKING.includes(r.phase));
      if (!hasWork) return;
      try {
        const res = await fetch('/api/agent-fix?active=1');
        if (!res.ok) return;
        const runs: AgentRun[] = await res.json();
        const next = indexRunsByReport(Array.isArray(runs) ? runs : []);
        for (const [reportId, run] of Object.entries(next)) {
          const prev = current[reportId];
          if (prev && prev.phase !== run.phase) {
            if (run.phase === 'review') toast.success('Una risoluzione AI è pronta da rivedere.');
            else if (run.phase === 'needs_clarification') toast.info('Una risoluzione AI chiede un chiarimento.');
            else if (run.phase === 'error') toast.error(`Risoluzione AI fallita: ${run.error ?? ''}`);
          }
        }
        setAiRuns(next);
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  const saveAiSettings = async (provider: AiProvider, geminiKey: string, deepseekKey: string, anthropicKey?: string) => {
    setAiProvider(provider);
    setGeminiApiKey(geminiKey);
    setDeepseekApiKey(deepseekKey);
    if (anthropicKey !== undefined) setAnthropicApiKey(anthropicKey);
    localStorage.setItem('baldisport-ai-provider', provider);
    localStorage.setItem('baldisport-gemini-key', geminiKey);
    localStorage.setItem('baldisport-deepseek-key', deepseekKey);
    if (anthropicKey !== undefined) localStorage.setItem('baldisport-anthropic-key', anthropicKey);
    try {
      await fetch('/api/agent-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          settings: { provider, geminiApiKey: geminiKey, deepseekApiKey: deepseekKey, anthropicApiKey: anthropicKey ?? anthropicApiKey }
        })
      });
    } catch { /* il salvataggio locale resta valido */ }
    toast.success('Impostazioni AI salvate.');
  };

  const providerBody = () => ({
    provider: aiProvider,
    geminiApiKey: aiProvider === 'gemini' ? geminiApiKey : undefined,
    deepseekApiKey: aiProvider === 'deepseek' ? deepseekApiKey : undefined,
  });

  const startAiForReports = async (ids: string[]): Promise<boolean> => {
    let success = true;
    for (const reportId of ids) {
      if (aiRunsRef.current[reportId]) continue; // già in lavorazione
      try {
        const res = await fetch('/api/agent-fix', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', reportId, ...providerBody() }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error ?? 'Errore avvio AI'); success = false; continue; }
        setAiRuns((prev) => ({ ...prev, [reportId]: data }));
      } catch { toast.error('Errore avvio AI'); success = false; }
    }
    return success;
  };

  /** Avvia UNA sola run (batch) che risolve tutte le segnalazioni indicate. */
  const startAiBatch = async (ids: string[]): Promise<boolean> => {
    const liberi = ids.filter((id) => !aiRunsRef.current[id]);
    if (liberi.length === 0) return true;
    if (liberi.length === 1) return startAiForReports(liberi);
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_batch', reportIds: liberi, ...providerBody() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Errore avvio AI batch'); return false; }
      setAiRuns((prev) => ({ ...prev, ...indexRunsByReport([data]) }));
      return true;
    } catch { toast.error('Errore avvio AI batch'); return false; }
  };

  /** Applica al client l'esito di un'azione sul drawer (approve/reject/…). */
  const applyRunUpdate = (run: AgentRun) => {
    const ids = run.reports?.length ? run.reports.map((r) => r.reportId) : [run.reportId];
    setAiRuns((prev) => {
      const next = { ...prev };
      if (['approved', 'discarded', 'aborted'].includes(run.phase)) ids.forEach((id) => { delete next[id]; });
      else ids.forEach((id) => { next[id] = run; });
      return next;
    });
    if (run.phase === 'approved' || run.committed) {
      onApproved?.();
      if (typeof window !== 'undefined') {
        for (const id of ids) {
          window.dispatchEvent(new CustomEvent('baldisport-ai-approved', { detail: { reportId: id } }));
        }
      }
    }
  };

  const abortAi = async (run: AgentRun) => {
    const ids = run.reports?.length ? run.reports.map((r) => r.reportId) : [run.reportId];
    try {
      await fetch('/api/agent-fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abort', runId: run.runId }),
      });
    } catch { /* ignore */ }
    setAiRuns((prev) => { const n = { ...prev }; ids.forEach((id) => { delete n[id]; }); return n; });
    toast.info('Risoluzione interrotta.');
  };

  const resumeAi = async (run: AgentRun) => {
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', runId: run.runId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Errore nella ripresa.'); return; }
      setAiRuns((prev) => ({ ...prev, ...indexRunsByReport([data]) }));
      toast.success('Run ripresa.');
    } catch { toast.error('Errore di connessione.'); }
  };

  /** Scarta dal client una run in errore (la riga torna libera). */
  const dismissError = (reportId: string) => {
    setAiRuns((prev) => { const n = { ...prev }; delete n[reportId]; return n; });
  };

  // Run che richiedono attenzione (review o chiarimento) — per i badge
  const aiAttention = useMemo(() => {
    const ids = new Set<string>();
    for (const r of Object.values(aiRuns)) {
      if (r.phase === 'review' || r.phase === 'needs_clarification') ids.add(r.runId);
    }
    return ids.size;
  }, [aiRuns]);

  return {
    aiEnabled, projectName, aiRuns, setAiRuns, aiAttention,
    aiProvider, setAiProvider, geminiApiKey, setGeminiApiKey, deepseekApiKey, setDeepseekApiKey,
    anthropicApiKey, setAnthropicApiKey,
    saveAiSettings, startAiForReports, startAiBatch, applyRunUpdate, abortAi, resumeAi, dismissError,
  };
}
