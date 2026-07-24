/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Pannello degli audit schedulati (cron) del codice: lista degli audit
 * configurati, form crea/modifica, esecuzione immediata con polling e
 * dettaglio dell'ultima run (report markdown, finding, segnalazioni create).
 * Si alimenta da `/api/audits` (azioni save / delete / run).
 *
 * @indice
 * - AuditConfig / AuditRunRecord → tipi del contratto API
 * - StatoRunBadge → badge di stato di una run
 * - Campo → wrapper label+campo del form
 * - PannelloAudit → lista audit + form + dettaglio ultima run
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle, CalendarClock, ChevronDown, ChevronUp, FileText,
  Loader2, Pencil, Play, PlusCircle, RefreshCw, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Tipi del contratto API ─────────────────────────────────────── */

export interface AuditConfig {
  id: string;
  projectId?: string | null;
  nome: string;
  schedule: string; // cron a 5 campi "m h dom mon dow"
  tipo: 'code-inquisition' | 'security' | 'performance' | 'quality' | 'custom';
  focus: string;
  scopeGlobs?: string[];
  profondita: 'rapida' | 'standard' | 'profonda';
  model: string; // 'haiku' | 'claude-sonnet-5' | 'claude-opus-4-8'
  createReports: boolean;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string | null;
}
export interface AuditRunRecord {
  id: string;
  auditId: string;
  startedAt: string;
  finishedAt?: string | null;
  status: 'running' | 'done' | 'error';
  report?: string | null;       // markdown del report finale
  findingsCount?: number | null;
  reportIds?: string[];         // segnalazioni create dai finding
  error?: string | null;
}
interface RispostaAudits { audits: AuditConfig[]; runs: AuditRunRecord[] }

/* ── Costanti di dominio ────────────────────────────────────────── */

const TIPI: Record<AuditConfig['tipo'], { label: string; desc: string; badge: string }> = {
  'code-inquisition': { label: 'Code Inquisition', desc: 'audit avversario profondo multi-agente', badge: 'bg-violet-500/10 text-violet-300 border-violet-500/40' },
  security: { label: 'Security', desc: 'vulnerabilità e superfici d\'attacco', badge: 'bg-red/10 text-red border-red/30' },
  performance: { label: 'Performance', desc: 'colli di bottiglia e sprechi', badge: 'bg-sky/10 text-sky border-sky/30' },
  quality: { label: 'Quality', desc: 'debito tecnico e over-engineering', badge: 'bg-green/10 text-green border-green/30' },
  custom: { label: 'Custom', desc: 'istruzioni libere', badge: 'bg-neutral-800 text-neutral-300 border-neutral-700' },
};

const PRESET_SCHEDULE = [
  { cron: '0 3 * * *', label: 'Ogni notte alle 03:00' },
  { cron: '0 9 * * 1', label: 'Ogni lunedì alle 09:00' },
  { cron: '0 12 * * *', label: 'Ogni giorno alle 12:00' },
  { cron: '0 * * * *', label: 'Ogni ora' },
] as const;

const MODELLI = [
  { value: 'haiku', label: 'Haiku — veloce/economico' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5 — bilanciato (consigliato)' },
  { value: 'claude-opus-4-8', label: 'Opus — massima profondità' },
] as const;

const PROFONDITA: AuditConfig['profondita'][] = ['rapida', 'standard', 'profonda'];

const POLL_MS = 5_000;
const MAX_POLL = 180; // 15 minuti a passi di 5s

const INPUT_CLS = 'w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2 px-3 text-sm focus:outline-none';

/* ── Stato del form crea/modifica ───────────────────────────────── */

interface FormAudit {
  id?: string;
  nome: string;
  projectId: string; // '' = progetto del daemon
  tipo: AuditConfig['tipo'];
  focus: string;
  scope: string;     // glob separati da virgola
  preset: string;    // cron del preset oppure 'custom'
  customCron: string;
  profondita: AuditConfig['profondita'];
  model: string;
  createReports: boolean;
  enabled: boolean;
}

const FORM_VUOTO: FormAudit = {
  nome: '', projectId: '', tipo: 'code-inquisition', focus: '', scope: '',
  preset: '0 3 * * *', customCron: '', profondita: 'standard',
  model: 'claude-sonnet-5', createReports: true, enabled: true,
};

/* ── Helper ─────────────────────────────────────────────────────── */

const descriviPreset = (cron: string): string | null =>
  PRESET_SCHEDULE.find((p) => p.cron === cron)?.label ?? null;

const formatData = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function StatoRunBadge({ status }: { status: AuditRunRecord['status'] }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none bg-sky/10 text-sky border-sky/30">
        <Loader2 className="w-3 h-3 animate-spin" /> In corso
      </span>
    );
  }
  if (status === 'done') {
    return <span className="px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none bg-green/10 text-green border-green/30">Completata</span>;
  }
  return <span className="px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none bg-red/10 text-red border-red/30">Errore</span>;
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-s-2">
      <label className="text-label text-neutral-400 uppercase tracking-label font-bold">{label}</label>
      {children}
    </div>
  );
}

/* ── Componente ─────────────────────────────────────────────────── */

export default function PannelloAudit({ projects }: { projects: { id: string; name: string }[] }) {
  const [audits, setAudits] = useState<AuditConfig[]>([]);
  const [runs, setRuns] = useState<AuditRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormAudit | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = async () => {
    try {
      const res = await fetch(`/api/audits?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) { toast.error('Errore nel caricamento degli audit.'); return; }
      const data: RispostaAudits = await res.json();
      if (mountedRef.current) { setAudits(data.audits); setRuns(data.runs); }
    } catch {
      toast.error('Impossibile connettersi alle API locali.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Polling GET ogni 5s finché la run non esce da 'running' (max 15 min). */
  const avviaPolling = (runId: string) => {
    if (pollersRef.current.has(runId)) return;
    pollersRef.current.add(runId);
    let tentativi = 0;
    const tick = async () => {
      if (!mountedRef.current) { pollersRef.current.delete(runId); return; }
      tentativi += 1;
      try {
        const res = await fetch(`/api/audits?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data: RispostaAudits = await res.json();
          if (mountedRef.current) { setAudits(data.audits); setRuns(data.runs); }
          const run = data.runs.find((r) => r.id === runId);
          if (run && run.status !== 'running') {
            pollersRef.current.delete(runId);
            if (run.status === 'done') toast.success(`Audit completato: ${run.findingsCount ?? 0} finding.`);
            else toast.error(`Audit fallito: ${run.error ?? 'errore sconosciuto'}.`);
            return;
          }
        }
      } catch { /* riprova al prossimo giro */ }
      if (tentativi >= MAX_POLL) {
        pollersRef.current.delete(runId);
        toast.error('Timeout: la run è ancora in corso dopo 15 minuti.');
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    setTimeout(tick, POLL_MS);
  };

  /* ── Azioni ───────────────────────────────────────────────────── */

  const postAudits = (body: object) =>
    fetch('/api/audits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const salvaAudit = async () => {
    if (!form) return;
    if (!form.nome.trim()) { toast.error('Il nome è obbligatorio.'); return; }
    const schedule = form.preset === 'custom' ? form.customCron.trim() : form.preset;
    if (!/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(schedule)) {
      toast.error('Cron non valida: servono 5 campi (m h dom mon dow).');
      return;
    }
    const scopeGlobs = form.scope.split(',').map((s) => s.trim()).filter(Boolean);
    const audit: Partial<AuditConfig> = {
      ...(form.id ? { id: form.id } : {}),
      nome: form.nome.trim(),
      projectId: form.projectId || null,
      schedule,
      tipo: form.tipo,
      focus: form.focus.trim(),
      scopeGlobs: scopeGlobs.length ? scopeGlobs : undefined,
      profondita: form.profondita,
      model: form.model,
      createReports: form.createReports,
      enabled: form.enabled,
    };
    setSalvando(true);
    try {
      const res = await postAudits({ action: 'save', audit });
      if (!res.ok) { toast.error('Errore durante il salvataggio.'); return; }
      toast.success(form.id ? 'Audit aggiornato.' : 'Audit creato.');
      setForm(null);
      await load();
    } catch {
      toast.error('Errore di connessione.');
    } finally {
      setSalvando(false);
    }
  };

  const toggleEnabled = async (a: AuditConfig) => {
    try {
      const res = await postAudits({ action: 'save', audit: { ...a, enabled: !a.enabled } });
      if (!res.ok) { toast.error('Impossibile aggiornare l\'audit.'); return; }
      await load();
    } catch { toast.error('Errore di connessione.'); }
  };

  const eliminaAudit = async (a: AuditConfig) => {
    if (!confirm(`Eliminare l'audit "${a.nome}"?`)) return;
    try {
      const res = await postAudits({ action: 'delete', id: a.id });
      if (!res.ok) { toast.error('Errore durante l\'eliminazione.'); return; }
      toast.success('Audit eliminato.');
      await load();
    } catch { toast.error('Errore di connessione.'); }
  };

  const eseguiOra = async (a: AuditConfig) => {
    try {
      const res = await postAudits({ action: 'run', id: a.id });
      if (!res.ok) { toast.error('Impossibile avviare l\'audit.'); return; }
      const data: { run: AuditRunRecord } = await res.json();
      toast.success(`Audit "${a.nome}" avviato.`);
      setExpandedId(a.id);
      await load();
      avviaPolling(data.run.id);
    } catch { toast.error('Errore di connessione.'); }
  };

  const apriModifica = (a: AuditConfig) => {
    setForm({
      id: a.id,
      nome: a.nome,
      projectId: a.projectId ?? '',
      tipo: a.tipo,
      focus: a.focus,
      scope: (a.scopeGlobs ?? []).join(', '),
      preset: descriviPreset(a.schedule) ? a.schedule : 'custom',
      customCron: a.schedule,
      profondita: a.profondita,
      model: a.model,
      createReports: a.createReports,
      enabled: a.enabled,
    });
  };

  /* ── Dati derivati ────────────────────────────────────────────── */

  // runs è già ordinato dalla più recente: la prima per auditId è l'ultima run.
  const ultimaRun = (auditId: string) => runs.find((r) => r.auditId === auditId);
  const nomeProgetto = (projectId?: string | null) =>
    projectId ? (projects.find((p) => p.id === projectId)?.name ?? projectId) : 'questo progetto';
  const labelModello = (model: string) => MODELLI.find((m) => m.value === model)?.label ?? model;

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div className="max-w-[1800px] mx-auto space-y-s-4">
      {/* Header pannello */}
      <div className="flex items-center justify-between gap-s-3">
        <p className="text-sm font-mono text-neutral-400">
          Audit schedulati del codice — girano in automatico <span className="text-neutral-200">quando il daemon è attivo</span>.
        </p>
        <div className="flex items-center gap-s-3 shrink-0">
          <button
            onClick={load}
            className="p-2.5 text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
            title="Aggiorna"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setForm({ ...FORM_VUOTO })}
            className="px-s-5 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm bb-accent-bg transition-all flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
          >
            <PlusCircle className="w-4 h-4" />
            Nuovo Audit
          </button>
        </div>
      </div>

      {/* Lista audit / stato vuoto */}
      {loading && audits.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-850 rounded-md shadow-sh-1 p-s-6 text-sm font-mono text-neutral-400">Caricamento…</div>
      ) : audits.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-850 rounded-md shadow-sh-1 p-s-8 text-center space-y-s-3">
          <CalendarClock className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm font-mono text-neutral-400">
            Nessun audit programmato. Gli audit girano automaticamente quando il daemon è attivo.
          </p>
          <button
            onClick={() => setForm({ ...FORM_VUOTO })}
            className="px-s-5 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm bb-accent-bg transition-all inline-flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
          >
            <PlusCircle className="w-4 h-4" />
            Nuovo Audit
          </button>
        </div>
      ) : (
        <div className="space-y-s-3">
          {audits.map((a) => {
            const run = ultimaRun(a.id);
            const inCorso = run?.status === 'running';
            const preset = descriviPreset(a.schedule);
            const espanso = expandedId === a.id;
            return (
              <div key={a.id} className="bg-neutral-900 border border-neutral-850 rounded-md shadow-sh-1">
                <div className="p-s-4 flex flex-col lg:flex-row lg:items-center gap-s-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-s-2">
                      <CalendarClock className={`w-4 h-4 shrink-0 ${a.enabled ? 'bb-accent' : 'text-neutral-600'}`} />
                      <h3 className={`font-display font-bold truncate ${a.enabled ? 'text-white' : 'text-neutral-500'}`}>{a.nome}</h3>
                      <span className={`px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none ${TIPI[a.tipo].badge}`} title={TIPI[a.tipo].desc}>
                        {TIPI[a.tipo].label}
                      </span>
                      {!a.enabled && (
                        <span className="px-1.5 py-0.5 rounded-pill text-[10px] font-bold border leading-none bg-neutral-850 text-neutral-500 border-neutral-750">Disattivo</span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-neutral-400 mt-s-1 flex flex-wrap items-center gap-x-s-3 gap-y-1">
                      <span className="text-neutral-200">{a.schedule}</span>
                      {preset && <span>{preset}</span>}
                      <span>· {nomeProgetto(a.projectId)}</span>
                      <span>· {a.profondita}</span>
                      <span>· {labelModello(a.model)}</span>
                      <span className="inline-flex items-center gap-s-1">
                        · Ultima: {formatData(a.lastRunAt ?? run?.startedAt)}
                        {run && <StatoRunBadge status={run.status} />}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-s-2 shrink-0">
                    {/* Toggle Attivo/Disattivo: salva subito con enabled invertito */}
                    <button
                      onClick={() => toggleEnabled(a)}
                      title={a.enabled ? 'Disattiva audit' : 'Attiva audit'}
                      className={`relative w-9 h-5 rounded-pill border transition-all cursor-pointer ${a.enabled ? 'bg-green/30 border-green/50' : 'bg-neutral-850 border-neutral-750'}`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-pill transition-all ${a.enabled ? 'left-[18px] bg-green' : 'left-0.5 bg-neutral-500'}`} />
                    </button>
                    <button
                      onClick={() => eseguiOra(a)}
                      disabled={inCorso}
                      title={inCorso ? 'Audit in esecuzione…' : 'Esegui ora'}
                      className="p-2.5 text-neutral-400 hover:text-green bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {inCorso ? <Loader2 className="w-4 h-4 animate-spin text-sky" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => apriModifica(a)}
                      title="Modifica"
                      className="p-2.5 text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => eliminaAudit(a)}
                      title="Elimina"
                      className="p-2.5 text-neutral-400 hover:text-red bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(espanso ? null : a.id)}
                      title={espanso ? 'Chiudi dettaglio' : 'Dettaglio ultima run'}
                      className="p-2.5 text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
                    >
                      {espanso ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Dettaglio ultima run */}
                {espanso && (
                  <div className="border-t border-neutral-850 bg-neutral-950/30 p-s-4 space-y-s-3">
                    {!run ? (
                      <p className="text-sm font-mono text-neutral-400">Nessuna esecuzione ancora per questo audit.</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-s-3 text-xs font-mono text-neutral-400">
                          <StatoRunBadge status={run.status} />
                          <span>Avvio: {formatData(run.startedAt)}</span>
                          <span>Fine: {formatData(run.finishedAt)}</span>
                          {typeof run.findingsCount === 'number' && (
                            <span className="text-neutral-200">{run.findingsCount} finding</span>
                          )}
                          {run.reportIds && run.reportIds.length > 0 && (
                            <span className="bb-accent underline underline-offset-2">
                              {run.reportIds.length} segnalazioni create
                            </span>
                          )}
                        </div>
                        {run.status === 'error' && (
                          <p className="text-sm font-mono text-red flex items-start gap-s-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {run.error ?? 'Errore sconosciuto durante l\'audit.'}
                          </p>
                        )}
                        {run.report && (
                          <div className="bg-neutral-950 border border-neutral-800 rounded-sm p-s-4 max-h-96 overflow-y-auto">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-s-2 flex items-center gap-s-1">
                              <FileText className="w-3 h-3" /> Report
                            </p>
                            <pre className="whitespace-pre-wrap text-xs font-mono text-neutral-300 leading-relaxed">{run.report}</pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale crea/modifica */}
      {form && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200 overflow-hidden">
            <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
              <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
                <CalendarClock className="w-5 h-5 bb-accent" />
                <span>{form.id ? 'Modifica Audit' : 'Nuovo Audit'}</span>
              </h3>
              <button onClick={() => setForm(null)} className="p-s-1 text-neutral-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-s-6 space-y-s-4 overflow-y-auto max-h-[70vh]">
              <Campo label="Nome *">
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={INPUT_CLS}
                  placeholder="Es: Audit notturno sicurezza"
                />
              </Campo>

              <Campo label="Progetto target">
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className={INPUT_CLS}
                >
                  <option value="">— questo progetto —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Campo>

              <Campo label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as AuditConfig['tipo'] })}
                  className={INPUT_CLS}
                >
                  {(Object.keys(TIPI) as AuditConfig['tipo'][]).map((t) => (
                    <option key={t} value={t}>{TIPI[t].label} — {TIPI[t].desc}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Focus">
                <textarea
                  value={form.focus}
                  onChange={(e) => setForm({ ...form, focus: e.target.value })}
                  className={`${INPUT_CLS} min-h-20 leading-relaxed`}
                  placeholder="Su cosa concentrarsi, es: auth e RLS, gestione errori nelle API…"
                />
              </Campo>

              <Campo label="Scope (glob separati da virgola, opzionale)">
                <input
                  type="text"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className={`${INPUT_CLS} font-mono text-xs`}
                  placeholder="src/api/**, src/lib/**"
                />
              </Campo>

              <Campo label="Schedule">
                <select
                  value={form.preset}
                  onChange={(e) => setForm({ ...form, preset: e.target.value })}
                  className={INPUT_CLS}
                >
                  {PRESET_SCHEDULE.map((p) => <option key={p.cron} value={p.cron}>{p.label} ({p.cron})</option>)}
                  <option value="custom">Cron personalizzata…</option>
                </select>
                {form.preset === 'custom' && (
                  <input
                    type="text"
                    value={form.customCron}
                    onChange={(e) => setForm({ ...form, customCron: e.target.value })}
                    className={`${INPUT_CLS} font-mono text-xs mt-s-2`}
                    placeholder="m h dom mon dow — es: 30 2 * * 1-5"
                  />
                )}
              </Campo>

              <div className="grid grid-cols-2 gap-s-4">
                <Campo label="Profondità">
                  <select
                    value={form.profondita}
                    onChange={(e) => setForm({ ...form, profondita: e.target.value as AuditConfig['profondita'] })}
                    className={INPUT_CLS}
                  >
                    {PROFONDITA.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo label="Modello">
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className={INPUT_CLS}
                  >
                    {MODELLI.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Campo>
              </div>

              <label className="flex items-center gap-s-2 text-sm text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.createReports}
                  onChange={(e) => setForm({ ...form, createReports: e.target.checked })}
                  className="w-4 h-4 accent-current"
                />
                Crea segnalazioni dai finding
              </label>
            </div>

            <div className="flex justify-end gap-s-3 p-s-6 border-t border-neutral-850 bg-neutral-950/20">
              <button
                onClick={() => setForm(null)}
                className="px-s-5 py-s-3 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={salvaAudit}
                disabled={salvando || !form.nome.trim()}
                className="px-s-6 py-s-3 text-xs font-display font-bold uppercase tracking-brand rounded-sm bb-accent-bg transition-all cursor-pointer shadow-sh-brand disabled:opacity-40 disabled:pointer-events-none"
              >
                {salvando ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
