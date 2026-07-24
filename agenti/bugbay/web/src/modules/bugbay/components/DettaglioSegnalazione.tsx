/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Drawer di dettaglio di una segnalazione: la "mappa del lavoro" per item.
 * Mostra descrizione e meta, le azioni di stato della pipeline (Risolvi con AI,
 * chiarimento, review con diff/criteri/verdetto, Verificata→Chiudi / Riapri) e
 * la timeline completa delle run che hanno toccato la segnalazione (con
 * telemetria). Navigazione ↑/↓ tra le segnalazioni senza chiudere il drawer.
 *
 * @indice
 * - DettaglioSegnalazione → drawer principale
 */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  X, CheckCircle, ArrowUpRight, Sparkles, RotateCcw, Loader2,
  ChevronUp, ChevronDown, History, AlertTriangle, Paperclip,
} from 'lucide-react';
import type { SystemReport } from '@/modules/bugbay/types';
import type { AgentRun } from '@/modules/bugbay/agent-fix/types';
import { DiffView, PhaseStepper, VerdictBox, UsageInline, Markdown } from './RunWidgets';
import { Collapsible } from './Collapsible';
import { WandRiformula } from './RiformulazioneAI';

const AI_WORKING = ['queued', 'interpreting', 'fixing', 'verifying'];

/** Separa il riassunto del Fixer in corpo + punti "DA VERIFICARE" (cosa controllare a mano). */
function splitRiassunto(riassunto?: string): { body: string; checks: string } {
  if (!riassunto) return { body: '', checks: '' };
  const parts = riassunto.split(/\n*DA\s+VERIFICARE\s*:?/i);
  return { body: (parts[0] ?? '').trim(), checks: parts.slice(1).join('\n').trim() };
}

const STATUS_BADGE: Record<string, string> = {
  'Aperto': 'bg-red/10 text-red border-red/25',
  'In Lavorazione': 'bg-sky/10 text-sky border-sky/25',
  'In Chiarimento': 'bg-orange/10 text-orange border-orange/25',
  'In Verifica': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Risolto': 'bg-green/10 text-green border-green/25',
};

interface Props {
  report: SystemReport;
  run?: AgentRun;
  aiEnabled: boolean;
  aiProvider?: 'claude-headless' | 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepseekApiKey?: string;
  onClose: () => void;
  onNavigate: (dir: 1 | -1) => void;
  onUpdateRun: (run: AgentRun) => void;
  onStartAi: (reportId: string) => void;
  onSetStatus: (reportId: string, status: SystemReport['status']) => Promise<void>;
}

export default function DettaglioSegnalazione({
  report, run, aiEnabled, aiProvider, geminiApiKey, deepseekApiKey,
  onClose, onNavigate, onUpdateRun, onStartAi, onSetStatus,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [risposta, setRisposta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [storia, setStoria] = useState<AgentRun[]>([]);

  // Timeline: tutte le run (anche concluse) che hanno toccato la segnalazione
  useEffect(() => {
    if (!aiEnabled) return;
    fetch(`/api/agent-fix?reportId=${report.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((runs: AgentRun[]) => setStoria(Array.isArray(runs) ? runs : []))
      .catch(() => setStoria([]));
  }, [report.id, run?.phase, aiEnabled]);

  // Navigazione da tastiera: ↑/↓ tra le segnalazioni, Esc per chiudere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); onNavigate(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); onNavigate(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  const callRun = async (body: Record<string, unknown>): Promise<AgentRun | null> => {
    setBusy(true);
    try {
      const res = await fetch('/api/agent-fix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Errore agentico.'); return null; }
      onUpdateRun(data);
      return data;
    } catch {
      toast.error('Impossibile contattare l\'agente.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const working = run && AI_WORKING.includes(run.phase);
  // Accept granulare dei batch: questa segnalazione è già stata accettata?
  const thisAccepted = run?.reports?.find((r) => r.reportId === report.id)?.accepted ?? false;
  const verifica = splitRiassunto(run?.riassunto);
  const goToArea = (url: string) => {
    let path = url;
    try { if (url.startsWith('http')) { const u = new URL(url); path = u.pathname + u.search; } } catch { /* usa url */ }
    window.open(path || '/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end bg-neutral-950/50 backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl h-full bg-neutral-900 border-l border-neutral-800 shadow-sh-3 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-s-3 px-s-5 py-s-4 border-b border-neutral-850 bg-neutral-950/40 shrink-0">
          <div className="flex items-center gap-s-2 min-w-0">
            <span className={`px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wider border shrink-0 ${STATUS_BADGE[report.status] ?? ''}`}>
              {report.status === 'Risolto' ? 'Chiusa' : report.status}
            </span>
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider truncate">
              {report.priority} · {report.category} · {report.area}{report.subArea ? ` / ${report.subArea}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-s-1 shrink-0">
            <button onClick={() => onNavigate(-1)} title="Segnalazione precedente (↑/K)" className="p-s-2 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => onNavigate(1)} title="Segnalazione successiva (↓/J)" className="p-s-2 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
            <button onClick={onClose} title="Chiudi (Esc)" className="p-s-2 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-s-5 flex flex-col gap-s-4">
          {/* Descrizione + meta */}
          <Markdown text={report.notes} className="text-sm text-neutral-200 leading-relaxed bg-neutral-950/50 border border-neutral-850 rounded-md p-s-3 flex flex-col gap-2" />
          <div className="flex flex-wrap items-center gap-s-3 text-[11px] text-neutral-500">
            <span>Segnalata da <strong className="text-neutral-400">{report.reporterName ?? 'N/D'}</strong></span>
            <span>· {new Date(report.createdAt).toLocaleString('it-IT')}</span>
            {report.url && (
              <button onClick={() => goToArea(report.url!)} className="inline-flex items-center gap-1 text-sky hover:underline cursor-pointer">
                Vai al modulo <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* ── Allegati (screenshot/screencast) ── */}
          {(report.attachments?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-s-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Allegati ({report.attachments!.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-2">
                {report.attachments!.map((a) => (
                  a.type === 'image' ? (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={a.name}
                      className="block rounded-md overflow-hidden border border-neutral-800 bg-neutral-950/50 hover:border-neutral-700 transition-colors"
                    >
                      <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                    </a>
                  ) : (
                    <video
                      key={a.url}
                      src={a.url}
                      controls
                      className="w-full h-24 object-cover rounded-md border border-neutral-800 bg-neutral-900"
                    />
                  )
                ))}
              </div>
            </div>
          )}

          {/* ── Azioni di stato della pipeline ── */}

          {report.status === 'Aperto' && aiEnabled && !run && (
            <button
              onClick={() => onStartAi(report.id)}
              className="self-start px-s-5 py-s-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-violet-500 text-white hover:bg-violet-600 inline-flex items-center gap-s-2 cursor-pointer shadow-sh-brand"
            >
              <Sparkles className="w-4 h-4" /> Risolvi con AI
            </button>
          )}

          {working && (
            <div className="flex flex-col items-center gap-s-4 py-s-4 bg-neutral-950/40 border border-sky/15 rounded-md">
              <PhaseStepper phase={run!.phase} />
              {run!.live && (
                <p className="w-full px-s-4 text-[11px] font-mono text-neutral-400 text-center truncate" title={run!.live}>
                  {run!.live}
                </p>
              )}
              <button
                onClick={() => callRun({ action: 'abort', runId: run!.runId })}
                disabled={busy}
                className="text-[11px] font-semibold uppercase tracking-wider text-red/80 hover:text-red cursor-pointer disabled:opacity-40"
              >
                Interrompi
              </button>
            </div>
          )}

          {run?.phase === 'needs_clarification' && (
            <div className="flex flex-col gap-s-2 bg-orange-500/5 border border-orange/25 rounded-md p-s-4">
              <p className="text-sm text-orange-200 font-semibold">L&apos;agente chiede un chiarimento:</p>
              <p className="text-sm text-orange-100/90 whitespace-pre-wrap">{run.domanda}</p>
              <textarea
                value={risposta} onChange={(e) => setRisposta(e.target.value)}
                placeholder="La tua risposta…"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-sm py-s-2 px-s-3 text-sm min-h-20 focus:outline-none focus:border-neutral-700"
              />
              <button
                onClick={async () => { if (!risposta.trim()) { toast.error('Rispondi alla domanda.'); return; } const r = await callRun({ action: 'clarify', runId: run.runId, risposta: risposta.trim() }); if (r) { setRisposta(''); toast.info('Procedo con il tuo chiarimento.'); } }}
                disabled={busy}
                className="self-end px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-sky text-navy hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                Invia e procedi
              </button>
            </div>
          )}

          {run?.phase === 'error' && (
            <div className="rounded-md border border-red/30 bg-red-500/10 px-s-4 py-s-3 text-sm text-red-300 flex items-start justify-between gap-s-3">
              <div>
                <p className="font-semibold mb-1">Risoluzione fallita:</p>
                <p className="font-mono text-xs">{run.error ?? 'Errore sconosciuto.'}</p>
              </div>
              <button onClick={() => callRun({ action: 'resume', runId: run.runId })} disabled={busy} className="shrink-0 px-s-3 py-s-2 text-[11px] font-bold uppercase tracking-wider rounded-sm bg-sky/10 text-sky border border-sky/20 hover:bg-sky hover:text-navy cursor-pointer disabled:opacity-40">Rilancia</button>
            </div>
          )}

          {run?.phase === 'paused' && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950/40 px-s-4 py-s-3 text-sm text-neutral-400 flex items-center justify-between gap-s-3">
              <span>⏸ Run fermata (riprendibile).</span>
              <button onClick={() => callRun({ action: 'resume', runId: run.runId })} disabled={busy} className="px-s-3 py-s-2 text-[11px] font-bold uppercase tracking-wider rounded-sm bg-sky/10 text-sky border border-sky/20 hover:bg-sky hover:text-navy cursor-pointer disabled:opacity-40">Riprendi</button>
            </div>
          )}

          {/* Accettata individualmente in un batch: le altre restano in review */}
          {run?.phase === 'review' && thisAccepted && (
            <div className="rounded-md border border-green/25 bg-green/5 px-s-4 py-s-3 text-sm text-green inline-flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Accettata e chiusa. Le altre segnalazioni del batch restano in revisione.
            </div>
          )}

          {/* Review della risoluzione AI */}
          {run?.phase === 'review' && !thisAccepted && (
            <div className="flex flex-col gap-s-3 border border-violet-500/25 bg-violet-500/5 rounded-md p-s-4">
              {/* Riga unica: titolo + stato (gate · criteri · file · token) */}
              <div className="flex items-center justify-between gap-s-2 flex-wrap">
                <p className="text-[10px] uppercase tracking-wider font-bold text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Risoluzione AI · #{run.runId}
                  {(run.reports?.length ?? 0) > 1 && <span className="px-1.5 rounded-pill bg-violet-500/20 border border-violet-500/30">batch ×{run.reports!.length}</span>}
                </p>
                <div className="flex items-center gap-s-3 text-xs">
                  {run.tscOk
                    ? <span className="inline-flex items-center gap-1 text-green"><CheckCircle className="w-3.5 h-3.5" /> tsc+lint</span>
                    : <span className="inline-flex items-center gap-1 text-red"><AlertTriangle className="w-3.5 h-3.5" /> tsc/lint ✗</span>}
                  {run.verdict && (
                    <span className={`inline-flex items-center gap-1 ${run.verdict.soddisfatto ? 'text-green' : 'text-orange'}`}>
                      {run.verdict.soddisfatto ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {run.verdict.criteri.filter((c) => c.ok).length}/{run.verdict.criteri.length} criteri
                    </span>
                  )}
                  {run.modifiche.length > 0 && <span className="text-neutral-400">{run.modifiche.length} file</span>}
                  <UsageInline run={run} />
                </div>
              </div>

              {/* Modifiche — elenco semplice, sempre visibile (il contenuto principale) */}
              {run.modifiche.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">Modifiche ({run.modifiche.length})</p>
                  <ul className="flex flex-col gap-1">
                    {run.modifiche.map((m) => (
                      <li key={m.path} className="flex items-center justify-between gap-2 text-xs">
                        <code className="text-neutral-300 font-mono truncate">{m.path}</code>
                        {m.area && (
                          <button onClick={() => goToArea(m.area!)} className="shrink-0 inline-flex items-center gap-1 text-sky hover:underline cursor-pointer">
                            Vai <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Da controllare — nota neutra, niente allarme */}
              {verifica.checks && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">Da controllare</p>
                  <Markdown text={verifica.checks} className="text-xs text-neutral-400 flex flex-col gap-1" />
                </div>
              )}

              {/* Errori del gate — solo se davvero fallito */}
              {!run.tscOk && run.tscOutput && (
                <div className="rounded-md border border-red/25 bg-red-500/5 px-s-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-red mb-1">Errori tsc / lint</p>
                  <pre className="text-[11px] font-mono text-red/80 overflow-x-auto max-h-40 whitespace-pre-wrap">{run.tscOutput}</pre>
                </div>
              )}

              {/* Dettagli, piegati: apri solo se ti serve */}
              <div className="flex flex-col gap-s-2">
                {verifica.body && (
                  <Collapsible titolo="Riassunto" preview={verifica.body.split('\n')[0].slice(0, 64)}>
                    <Markdown text={verifica.body} className="text-xs text-neutral-300 flex flex-col gap-2" />
                  </Collapsible>
                )}

                {run.diff && (
                  <Collapsible titolo="Diff" preview="git">
                    <DiffView diff={run.diff} />
                  </Collapsible>
                )}

                {run.verdict && (
                  <Collapsible
                    titolo="Criteri"
                    preview={run.verdict.soddisfatto ? 'tutti ✓' : 'da rivedere'}
                    defaultOpen={!run.verdict.soddisfatto}
                  >
                    <VerdictBox verdict={run.verdict} />
                  </Collapsible>
                )}
              </div>

              {showReject ? (
                <div className="flex flex-col gap-s-2">
                  <div className="flex items-center justify-between gap-s-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">Motivo del rifiuto</label>
                    <WandRiformula
                      value={motivo} onApply={setMotivo}
                      provider={aiProvider} geminiApiKey={geminiApiKey} deepseekApiKey={deepseekApiKey}
                      itemLabel="Motivo rifiuto AI" itemDesc={`Feedback del rifiuto per la run ${run.runId}`} itemPath="-"
                    />
                  </div>
                  <textarea
                    value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Cosa non va? (l'agente si rilancia con questo feedback)"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-sm py-s-2 px-s-3 text-sm min-h-20 focus:outline-none focus:border-neutral-700"
                  />
                  <div className="flex justify-end gap-s-2">
                    <button onClick={() => setShowReject(false)} className="px-s-3 py-s-2 text-xs text-neutral-400 hover:text-white cursor-pointer">Annulla</button>
                    <button
                      onClick={async () => { if (!motivo.trim()) { toast.error('Scrivi il motivo.'); return; } const r = await callRun({ action: 'reject', runId: run.runId, motivo: motivo.trim() }); if (r) { setMotivo(''); setShowReject(false); toast.info('Rilancio col tuo feedback.'); } }}
                      disabled={busy}
                      className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-orange text-white hover:bg-orange-600 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Rilancia col feedback
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-s-2 pt-s-2 border-t border-violet-500/15">
                  <button onClick={async () => { const r = await callRun({ action: 'discard', runId: run.runId }); if (r) toast.info('Modifiche scartate.'); }} disabled={busy} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white disabled:opacity-40 cursor-pointer">Scarta</button>
                  <button onClick={() => setShowReject(true)} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 text-neutral-200 border border-neutral-750 hover:text-white cursor-pointer">Rifiuta</button>
                  {(run.reports?.length ?? 0) > 1 ? (
                    <>
                      <button onClick={async () => { const r = await callRun({ action: 'approve_reports', runId: run.runId, reportIds: [report.id] }); if (r) toast.success('Segnalazione accettata e chiusa.'); }} disabled={busy} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green text-white hover:bg-green-700 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer">
                        <CheckCircle className="w-4 h-4" /> Accetta questa
                      </button>
                      <button onClick={async () => { const n = run.reports!.filter((r) => !r.accepted).length; const r = await callRun({ action: 'approve', runId: run.runId }); if (r) toast.success(`Accettate e chiuse (${n}).`); }} disabled={busy} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green/10 text-green border border-green/25 hover:bg-green hover:text-white inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer">
                        Accetta tutte ({run.reports!.filter((r) => !r.accepted).length})
                      </button>
                    </>
                  ) : (
                    <button onClick={async () => { const r = await callRun({ action: 'approve', runId: run.runId }); if (r) toast.success('Accettata e chiusa.'); }} disabled={busy} className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green text-white hover:bg-green-700 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer">
                    <CheckCircle className="w-4 h-4" /> Accetta e chiudi
                  </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* In Verifica: il loop si chiude solo con la verifica umana sul sito */}
          {report.status === 'In Verifica' && !working && run?.phase !== 'review' && (
            <div className="flex flex-col gap-s-3 border border-violet-500/25 bg-violet-500/5 rounded-md p-s-4">
              <p className="text-sm text-violet-200 font-semibold">Risoluzione applicata — verifica sul sito e decidi:</p>
              {report.resolutionNotes && <Markdown text={report.resolutionNotes} className="text-xs text-neutral-400 flex flex-col gap-2" />}
              <div className="flex justify-end gap-s-2">
                <button
                  onClick={async () => { setBusy(true); await onSetStatus(report.id, 'Aperto'); setBusy(false); toast.info('Riaperta: puoi rilanciare l\'AI o lavorarla a mano.'); }}
                  disabled={busy}
                  className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-red/10 text-red border border-red/20 hover:bg-red hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  ✗ Non risolta — Riapri
                </button>
                <button
                  onClick={async () => { setBusy(true); await onSetStatus(report.id, 'Risolto'); setBusy(false); toast.success('Verificata e chiusa.'); }}
                  disabled={busy}
                  className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green text-white hover:bg-green-700 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" /> Verificata — Chiudi
                </button>
              </div>
            </div>
          )}

          {report.status === 'Risolto' && (
            <button
              onClick={async () => { setBusy(true); await onSetStatus(report.id, 'Aperto'); setBusy(false); toast.info('Segnalazione riaperta.'); }}
              disabled={busy}
              className="self-start px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              Riapri segnalazione
            </button>
          )}

          {/* ── Timeline del lavoro ── */}
          {storia.length > 0 && (
            <div className="flex flex-col gap-s-2 mt-s-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Storia del lavoro ({storia.length} run)
              </p>
              <ol className="relative border-l border-neutral-800 ml-2 flex flex-col gap-s-3">
                {storia.map((r) => (
                  <li key={r.runId} className="ml-s-4 relative">
                    <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 ${
                      r.phase === 'approved' ? 'bg-green' : r.phase === 'review' ? 'bg-violet-400' : ['error', 'aborted', 'discarded'].includes(r.phase) ? 'bg-red' : 'bg-sky'
                    }`} />
                    <div className="text-xs text-neutral-300">
                      <span className="font-mono font-bold text-neutral-200">#{r.runId}</span>
                      <span className="text-neutral-500"> · {r.provider || 'claude'} · {new Date(r.createdAt).toLocaleString('it-IT')}</span>
                      <span className={`ml-1.5 font-semibold ${r.phase === 'approved' ? 'text-green' : ['error', 'aborted', 'discarded'].includes(r.phase) ? 'text-red' : 'text-sky'}`}>{r.phase}</span>
                      {(r.reports?.length ?? 0) > 1 && <span className="text-violet-300"> · batch ×{r.reports!.length}</span>}
                      {r.modifiche.length > 0 && <span className="text-neutral-500"> · {r.modifiche.length} file</span>}
                    </div>
                    <div className="mt-0.5"><UsageInline run={r} /></div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
