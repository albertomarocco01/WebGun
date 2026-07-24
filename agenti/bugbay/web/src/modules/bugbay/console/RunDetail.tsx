/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * RUN DETAIL evidence-first della console-hub (v0.6 Wave-2). Vista read-only di
 * una singola run: header con titolo/fase/telemetria, evidenza sintetica (problema,
 * riassunto, verdetto, diff finale via widget riusati), la TIMELINE delle
 * observations come span annidati per `parent_id` (icona per span_kind, modello,
 * token, costo, durata, esito) con i corpi pesanti (prompt/diff/stdout) espandibili
 * e caricati lazy, e la striscia degli `events`. Tutti i dati arrivano da
 * /api/agent-fix/hub (server-only): il componente NON importa mai hub.ts/store.ts.
 *
 * @indice
 * - RunDetail   → shell della vista (fetch + header + evidenza + timeline + eventi)
 * - SpanRows    → render della sequenza observations annidata, con espansione lazy
 * - BodyView    → corpo pesante (DiffView se è un diff, altrimenti <pre>)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Brain,
  Wrench,
  ShieldCheck,
  Flag,
  RefreshCw,
  Map as MapIcon,
  ChevronRight,
  ChevronDown,
  Circle,
  RotateCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type {
  RunDetailResponse,
  RunDetailObservation,
  RunObservationBody,
  SpanKind,
  ObsStatus,
} from './run-detail-types';
import { DiffView, Markdown, VerdictBox } from '../components/RunWidgets';

const HUB_API = '/api/agent-fix/hub';

// ── Vocabolari di stile ──────────────────────────────────────────────────────
const SPAN_ICON: Record<SpanKind, typeof Brain> = {
  llm: Brain,
  tool: Wrench,
  gate: ShieldCheck,
  phase: Flag,
  repair: RefreshCw,
  plan: MapIcon,
};
const SPAN_COLOR: Record<SpanKind, string> = {
  llm: 'text-sky',
  tool: 'text-neutral-300',
  gate: 'text-orange',
  phase: 'bb-accent',
  repair: 'text-orange',
  plan: 'text-neutral-300',
};

/** Stile della pill di fase (allineato ai colori semantici della pipeline). */
const PHASE_STYLE: Record<string, string> = {
  queued: 'text-neutral-400 border-neutral-700',
  interpreting: 'text-sky border-sky/40',
  needs_clarification: 'text-orange border-orange/40',
  fixing: 'text-sky border-sky/40',
  verifying: 'text-sky border-sky/40',
  review: 'bb-accent bb-accent-border',
  paused: 'text-neutral-400 border-neutral-700',
  approved: 'text-green border-green/40',
  discarded: 'text-neutral-500 border-neutral-800',
  aborted: 'text-red border-red/40',
  error: 'text-red border-red/40',
};

// ── Formatter compatti ───────────────────────────────────────────────────────
function fmtTokens(n: number | null): string {
  if (n == null) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function fmtCost(n: number | null): string | null {
  if (n == null) return null;
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}
function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('it-IT');
}

function PhasePill({ phase }: { phase: string }) {
  return (
    <span
      className={`inline-flex items-center px-s-2 py-0.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider ${
        PHASE_STYLE[phase] ?? 'text-neutral-400 border-neutral-700'
      }`}
    >
      {phase.replace(/_/g, ' ')}
    </span>
  );
}

function StatusDot({ status }: { status: ObsStatus | null }) {
  const cls =
    status === 'ok'
      ? 'text-green'
      : status === 'error'
        ? 'text-red'
        : status === 'running'
          ? 'text-amber-400 animate-pulse'
          : 'text-neutral-700';
  return <Circle className={`w-2 h-2 fill-current shrink-0 ${cls}`} />;
}

/** Corpo pesante: DiffView se è un diff git, altrimenti <pre> monospazio. */
function BodyView({ body }: { body: string }) {
  if (body.trimStart().startsWith('diff --git')) return <DiffView diff={body} />;
  return (
    <pre className="mt-s-1 bg-neutral-950 border border-neutral-800 rounded-sm text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap break-words p-s-3">
      {body}
    </pre>
  );
}

type BodyState = { loading: boolean; body: string | null };

/** DFS di observations in albero (parent_id → figli), preservando l'ordine cronologico. */
function buildOrdered(
  observations: RunDetailObservation[],
): { obs: RunDetailObservation; depth: number }[] {
  const ids = new Set(observations.map((o) => o.id));
  const byParent = new Map<string | null, RunDetailObservation[]>();
  for (const o of observations) {
    // Un parent_id che non esiste tra le observations della run è trattato come root
    // (robustezza: nessuno span orfano sparisce dalla vista).
    const key = o.parentId && ids.has(o.parentId) ? o.parentId : null;
    const arr = byParent.get(key);
    if (arr) arr.push(o);
    else byParent.set(key, [o]);
  }
  const out: { obs: RunDetailObservation; depth: number }[] = [];
  const walk = (parent: string | null, depth: number): void => {
    for (const o of byParent.get(parent) ?? []) {
      out.push({ obs: o, depth });
      walk(o.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bodies, setBodies] = useState<Record<string, BodyState>>({});
  const [showDiff, setShowDiff] = useState(false);

  const load = useCallback(() => {
    setStatus('loading');
    fetch(`${HUB_API}?runId=${encodeURIComponent(runId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<RunDetailResponse>;
      })
      .then((d) => {
        setData(d);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [runId]);

  // Cambio run → reset dello stato locale di espansione/corpi, poi ricarica.
  useEffect(() => {
    setExpanded(new Set());
    setBodies({});
    setShowDiff(false);
    load();
  }, [load]);

  const toggleBody = useCallback(
    (obs: RunDetailObservation) => {
      const willOpen = !expanded.has(obs.id);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (willOpen) next.add(obs.id);
        else next.delete(obs.id);
        return next;
      });
      // Fetch lazy del corpo solo alla prima apertura di uno span che ne ha uno.
      if (willOpen && obs.hasBody && bodies[obs.id] === undefined) {
        setBodies((prev) => ({ ...prev, [obs.id]: { loading: true, body: null } }));
        fetch(`${HUB_API}?runId=${encodeURIComponent(runId)}&body=${encodeURIComponent(obs.id)}`)
          .then((r) => r.json() as Promise<RunObservationBody>)
          .then((d) => setBodies((prev) => ({ ...prev, [obs.id]: { loading: false, body: d.body } })))
          .catch(() => setBodies((prev) => ({ ...prev, [obs.id]: { loading: false, body: null } })));
      }
    },
    [expanded, bodies, runId],
  );

  const ordered = useMemo(
    () => (data ? buildOrdered(data.observations) : []),
    [data],
  );

  const run = data?.run ?? null;
  const phase = data?.phase ?? run?.phase ?? null;

  return (
    <section className="space-y-s-5 animate-fade-in">
      {/* Barra di controllo */}
      <div className="flex items-center gap-s-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-s-1 px-s-3 py-s-2 text-xs font-display font-bold uppercase tracking-brand rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <button
          onClick={load}
          title="Ricarica"
          className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status === 'error' ? (
        <div className="border border-red/30 bg-red/5 rounded-md p-s-6 text-center text-sm font-mono text-red">
          Impossibile caricare la run. Riprova.
        </div>
      ) : status === 'loading' && !data ? (
        <div className="border border-dashed border-neutral-800 rounded-md p-s-8 text-center text-xs font-mono text-neutral-500 inline-flex items-center gap-s-2 w-full justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento evidenza…
        </div>
      ) : (
        <>
          {/* Header run */}
          <header className="border-b border-neutral-850 pb-s-4 space-y-s-2">
            <div className="flex items-start justify-between gap-s-4 flex-wrap">
              <h2 className="text-h3 font-display font-bold text-white leading-tight">
                {run?.reportTitolo ?? 'Run'}
                {(run?.reports?.length ?? 0) > 1 && (
                  <span className="ml-s-2 text-xs font-mono text-neutral-500">
                    +{(run?.reports?.length ?? 1) - 1} altre segnalazioni
                  </span>
                )}
              </h2>
              {phase && <PhasePill phase={phase} />}
            </div>
            <div className="flex items-center gap-s-3 text-[11px] font-mono text-neutral-500 flex-wrap">
              <span className="text-neutral-600">{runId}</span>
              {run?.branch && <span className="text-neutral-500">⌥ {run.branch}</span>}
              {run?.fixModel && <span className="text-sky/80">{run.fixModel}</span>}
              {run?.usage && (
                <span className="tabular-nums" title={`${run.usage.calls} chiamate LLM`}>
                  {fmtTokens(run.usage.inputTokens)} in · {fmtTokens(run.usage.outputTokens)} out
                  {run.usage.costUsd > 0 && ` · ${fmtCost(run.usage.costUsd)}`}
                </span>
              )}
              {run?.codemod && <span className="text-sky">0 token (codemod)</span>}
              {run?.reportUrl && (
                <a
                  href={run.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-s-1 text-sky hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> pagina
                </a>
              )}
            </div>
          </header>

          {/* Evidenza sintetica (widget riusati dal drawer di dettaglio) */}
          {run?.problema && (
            <div className="text-sm text-neutral-300 border-l-2 border-neutral-800 pl-s-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-s-1">Problema</p>
              <Markdown text={run.problema} className="space-y-s-2 text-sm text-neutral-300" />
            </div>
          )}
          {run?.riassunto && (
            <div className="text-sm text-neutral-300 border-l-2 border-neutral-800 pl-s-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-s-1">Riassunto del fix</p>
              <Markdown text={run.riassunto} className="space-y-s-2 text-sm text-neutral-300" />
            </div>
          )}
          {run?.verdict && <VerdictBox verdict={run.verdict} />}

          {/* Timeline evidence-first delle observations */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-s-2">
              Timeline · {ordered.length} span
            </p>
            {ordered.length === 0 ? (
              <div className="border border-dashed border-neutral-800 rounded-md p-s-6 text-center text-xs font-mono text-neutral-600">
                Nessuna observation registrata per questa run.
              </div>
            ) : (
              <div className="border border-neutral-850 rounded-md overflow-hidden divide-y divide-neutral-850">
                {ordered.map(({ obs, depth }) => {
                  const Icon = SPAN_ICON[obs.spanKind] ?? Circle;
                  const isOpen = expanded.has(obs.id);
                  const body = bodies[obs.id];
                  const cost = fmtCost(obs.costUsd);
                  return (
                    <div key={obs.id} className="bg-neutral-900">
                      <button
                        type="button"
                        onClick={() => obs.hasBody && toggleBody(obs)}
                        className={`w-full flex items-center gap-s-2 pr-s-3 py-s-2 text-left ${
                          obs.hasBody ? 'cursor-pointer hover:bg-neutral-850' : 'cursor-default'
                        }`}
                        style={{ paddingLeft: `${0.75 + depth * 1.15}rem` }}
                      >
                        <span className="w-3 shrink-0 text-neutral-600">
                          {obs.hasBody ? (
                            isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                          ) : null}
                        </span>
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${SPAN_COLOR[obs.spanKind] ?? 'text-neutral-400'}`} />
                        <span className="font-mono text-xs text-neutral-200 truncate max-w-[260px]">{obs.name}</span>
                        {obs.stage && (
                          <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider shrink-0">
                            {obs.stage}
                          </span>
                        )}
                        {obs.model && (
                          <span className="font-mono text-[10px] text-sky/80 truncate shrink-0 max-w-[140px]">
                            {obs.model}
                          </span>
                        )}
                        <span className="flex-1" />
                        {(obs.inputTokens != null || obs.outputTokens != null) && (
                          <span className="font-mono text-[10px] text-neutral-500 tabular-nums shrink-0 hidden sm:inline">
                            {fmtTokens(obs.inputTokens)}/{fmtTokens(obs.outputTokens)} tok
                          </span>
                        )}
                        {cost && (
                          <span className="font-mono text-[10px] text-neutral-400 tabular-nums shrink-0">{cost}</span>
                        )}
                        <span className="font-mono text-[10px] text-neutral-500 tabular-nums w-12 text-right shrink-0">
                          {fmtMs(obs.ms)}
                        </span>
                        <StatusDot status={obs.status} />
                      </button>
                      {isOpen && obs.hasBody && (
                        <div className="pr-s-3 pb-s-2" style={{ paddingLeft: `${1.6 + depth * 1.15}rem` }}>
                          {body?.loading ? (
                            <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-s-2 py-s-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> caricamento corpo…
                            </div>
                          ) : body?.body ? (
                            <BodyView body={body.body} />
                          ) : (
                            <div className="text-[11px] font-mono text-neutral-600 py-s-2">corpo non disponibile</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diff finale della run (collassabile, riusa DiffView) */}
          {run?.diff && (
            <div>
              <button
                onClick={() => setShowDiff((v) => !v)}
                className="inline-flex items-center gap-s-1 text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer"
              >
                {showDiff ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Diff finale{run.modifiche?.length ? ` · ${run.modifiche.length} file` : ''}
              </button>
              {showDiff && <DiffView diff={run.diff} />}
            </div>
          )}

          {/* Striscia eventi */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-s-2">
              Eventi · {data?.events.length ?? 0}
            </p>
            {(data?.events.length ?? 0) === 0 ? (
              <div className="border border-dashed border-neutral-800 rounded-md p-s-4 text-center text-xs font-mono text-neutral-600">
                Nessun evento.
              </div>
            ) : (
              <ul className="border border-neutral-850 rounded-md overflow-hidden divide-y divide-neutral-850 max-h-72 overflow-y-auto">
                {data?.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-s-3 px-s-3 py-1.5 text-[11px] font-mono bg-neutral-900"
                  >
                    <span className="text-neutral-600 w-10 shrink-0">#{e.id}</span>
                    <span className="bb-accent w-32 shrink-0 truncate">{e.name}</span>
                    {(e.phaseFrom || e.phaseTo) && (
                      <span className="text-neutral-500 shrink-0">
                        {e.phaseFrom ?? '∅'} → {e.phaseTo ?? '∅'}
                      </span>
                    )}
                    <span className="text-neutral-600 truncate flex-1">{e.payload ?? ''}</span>
                    <span className="text-neutral-700 shrink-0">{fmtTime(e.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
