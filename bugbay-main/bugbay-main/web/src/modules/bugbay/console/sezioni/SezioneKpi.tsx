/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sezione KPI della console-hub (v0.9, Track K): il cruscotto di metriche che si
 * posa sopra a tutti gli altri track e li LEGGE. Alimentato dalla API read-only
 * /api/agent-fix/kpi (aggregati della spina `hub.sqlite`): budget (usage_blocks vs
 * cap), tassi di verdetto (scores approve/discard/regression), esiti del gate di
 * eval (alert 'eval'), alert per canale, costo/latenza delle observations. Grafici
 * con recharts. Sola lettura: nessuna azione, nessuna scrittura.
 *
 * Il client NON importa mai i moduli server (node:sqlite): passa dalla route e
 * ridichiara i tipi del payload localmente (come SezioneInbox/SezioneSystem).
 *
 * @indice
 * - SezioneKpi → cruscotto: stat card + grafici budget/verdetti/run/eval/costi
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  RotateCw,
  Wallet,
  CheckCircle2,
  ShieldCheck,
  Coins,
  Timer,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const KPI_API = '/api/agent-fix/kpi';
const POLL_MS = 10000;

// ── Specchi client-safe del payload di api/kpi.ts (ridichiarati: niente import server) ──

interface KpiBudgetWindow {
  windowKind: 'weekly' | 'block_5h';
  startedAt: string;
  endsAt: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  capUsd: number | null;
  effectiveCapUsd: number | null;
  fraction: number | null;
}
interface KpiBudget {
  weekly: KpiBudgetWindow | null;
  block: KpiBudgetWindow | null;
  weeklyTrend: { startedAt: string; costUsd: number }[];
  humanReserveFraction: number | null;
  configUnknown: boolean;
}
interface KpiVerdicts {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  regressions: number;
  approveRate: number | null;
  bySource: { source: string; count: number; weight: number }[];
}
interface KpiEvalGate {
  redGates: number;
  regressionsCaught: number;
  recent: { id: string; message: string; createdAt: string; ackAt: string | null; regressions: number }[];
}
interface KpiModelStat {
  model: string;
  count: number;
  costUsd: number;
  avgMs: number | null;
}
interface KpiObservations {
  count: number;
  totalCostUsd: number;
  avgMs: number | null;
  errorCount: number;
  byModel: KpiModelStat[];
  costByDay: { day: string; costUsd: number }[];
}
interface KpiResponse {
  generatedAt: string;
  budget: KpiBudget;
  verdicts: KpiVerdicts;
  runsByPhase: { phase: string; count: number }[];
  evalGate: KpiEvalGate;
  alerts: { channel: string; count: number; errors: number }[];
  observations: KpiObservations;
}

// ── Palette (concreta: recharts non legge le CSS var del tema) ────────────────
const C = {
  accent: '#f5a623',
  green: '#34d399',
  red: '#f87171',
  orange: '#fb923c',
  blue: '#60a5fa',
  violet: '#a78bfa',
  neutral: '#737373',
  grid: '#262626',
};

const PHASE_COLOR: Record<string, string> = {
  approved: C.green,
  discarded: C.neutral,
  review: C.accent,
  needs_clarification: C.orange,
  fixing: C.blue,
  verifying: C.violet,
  interpreting: C.blue,
  queued: C.neutral,
  paused: C.orange,
  aborted: C.neutral,
  error: C.red,
};

// ── Formattatori ──────────────────────────────────────────────────────────────
const fmtUsd = (n: number): string => `$${n.toFixed(n < 100 ? 2 : 0)}`;
const fmtPct = (n: number | null): string => (n === null ? '—' : `${Math.round(n * 100)}%`);
const fmtMs = (n: number | null): string => {
  if (n === null) return '—';
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
};
const shortDay = (iso: string): string => iso.slice(5); // YYYY-MM-DD → MM-DD

const TOOLTIP_STYLE = {
  background: '#0a0a0a',
  border: '1px solid #262626',
  borderRadius: 6,
  fontSize: 12,
  fontFamily: 'monospace',
  color: '#e5e5e5',
} as const;

/** Stat card compatta: etichetta + valore grande + eventuale sotto-riga. */
function Stat({
  Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  Icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'accent' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'accent' ? 'bb-accent' : tone === 'green' ? 'text-green' : tone === 'red' ? 'text-red' : 'text-white';
  return (
    <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4 flex flex-col gap-s-2">
      <div className="flex items-center gap-s-2 text-[11px] font-mono uppercase tracking-wider text-neutral-500">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`text-h1 font-display font-bold tabular-nums leading-none ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] font-mono text-neutral-500 tabular-nums">{sub}</div>}
    </div>
  );
}

/** Titolo di un pannello grafico. */
function PanelTitle({ Icon, children }: { Icon: typeof Wallet; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-s-2 text-xs font-display font-bold uppercase tracking-brand text-neutral-400 mb-s-3">
      <Icon className="w-4 h-4" />
      {children}
    </div>
  );
}

export default function SezioneKpi() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback((silent = false) => {
    if (!silent) setStatus('loading');
    fetch(KPI_API)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<KpiResponse>;
      })
      .then((d) => {
        setData(d);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (status === 'error') {
    return (
      <div className="border border-red/30 bg-red/5 rounded-md p-s-6 text-center text-sm font-mono text-red">
        Impossibile caricare i KPI.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="border border-dashed border-neutral-800 rounded-md p-s-8 text-center text-xs font-mono text-neutral-500">
        Caricamento metriche…
      </div>
    );
  }

  const { budget, verdicts, evalGate, observations, alerts, runsByPhase } = data;

  const verdictBars = [
    { name: 'Approvati', value: verdicts.positive, fill: C.green },
    { name: 'Scartati', value: verdicts.negative, fill: C.red },
    { name: 'Neutri', value: verdicts.neutral, fill: C.neutral },
  ];

  return (
    <section className="space-y-s-6">
      <header className="flex items-center justify-between gap-s-4">
        <div className="flex items-center gap-s-2 text-sm font-mono text-neutral-300">
          <BarChart3 className="w-4 h-4 bb-accent" />
          <span>KPI — budget, verdetti, gate di eval &amp; costi</span>
          <span className="text-neutral-600 text-[11px] tabular-nums hidden sm:inline">
            aggiornato {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <button
          onClick={() => load()}
          title="Ricarica"
          className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-s-3">
        <Stat
          Icon={Wallet}
          label="Budget weekly"
          tone={budget.weekly && budget.weekly.fraction !== null && budget.weekly.fraction >= 1 ? 'red' : 'accent'}
          value={budget.weekly ? fmtPct(budget.weekly.fraction) : '—'}
          sub={
            budget.weekly
              ? `${fmtUsd(budget.weekly.costUsd)}${budget.weekly.effectiveCapUsd !== null ? ` / ${fmtUsd(budget.weekly.effectiveCapUsd)}` : ''}`
              : 'nessun dato ledger'
          }
        />
        <Stat
          Icon={CheckCircle2}
          label="Approve rate"
          tone="green"
          value={fmtPct(verdicts.approveRate)}
          sub={`${verdicts.positive}✓ · ${verdicts.negative}✗ · ${verdicts.total} tot`}
        />
        <Stat
          Icon={ShieldCheck}
          label="Regressioni bloccate"
          tone={evalGate.regressionsCaught > 0 ? 'red' : 'neutral'}
          value={String(evalGate.regressionsCaught)}
          sub={`${evalGate.redGates} gate ${evalGate.redGates === 1 ? 'rosso' : 'rossi'}`}
        />
        <Stat
          Icon={Coins}
          label="Costo osservato"
          value={fmtUsd(observations.totalCostUsd)}
          sub={`${observations.count} span · ${observations.errorCount} err`}
        />
        <Stat
          Icon={Timer}
          label="Latenza media"
          value={fmtMs(observations.avgMs)}
          sub={`${observations.byModel.length} modelli`}
        />
      </div>

      {/* ── BUDGET TREND + VERDETTI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-s-4">
        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={Wallet}>Trend spesa weekly</PanelTitle>
          {budget.weeklyTrend.length === 0 ? (
            <EmptyChart label="Nessun blocco di budget materializzato." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={budget.weeklyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="budgetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />
                <XAxis dataKey="startedAt" tickFormatter={(v: string) => v.slice(0, 10).slice(5)} tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} />
                <YAxis tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} tickFormatter={(v: number) => fmtUsd(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmtUsd(v), 'costo']} labelFormatter={(l: string) => l.slice(0, 10)} />
                <Area type="monotone" dataKey="costUsd" stroke={C.accent} strokeWidth={2} fill="url(#budgetGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={CheckCircle2}>Verdetti per esito</PanelTitle>
          {verdicts.total === 0 ? (
            <EmptyChart label="Nessun verdetto registrato." />
          ) : (
            <div className="flex items-center gap-s-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={verdictBars} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {verdictBars.map((d) => (
                      <Cell key={d.name} fill={d.fill} stroke="#0a0a0a" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-s-2 text-xs font-mono">
                {verdictBars.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-s-2">
                    <span className="flex items-center gap-s-2 text-neutral-300">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                    <span className="tabular-nums text-neutral-400">{d.value}</span>
                  </div>
                ))}
                <div className="pt-s-2 mt-s-1 border-t border-neutral-850 text-neutral-500">
                  {verdicts.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between gap-s-2">
                      <span>{s.source}</span>
                      <span className="tabular-nums">
                        {s.count} · peso {s.weight.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── COSTO PER GIORNO ── */}
      <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
        <PanelTitle Icon={Coins}>Costo osservazioni per giorno</PanelTitle>
        {observations.costByDay.length === 0 ? (
          <EmptyChart label="Nessuna observation con costo." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={observations.costByDay} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} />
              <YAxis tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} tickFormatter={(v: number) => fmtUsd(v)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#ffffff08' }} formatter={(v: number) => [fmtUsd(v), 'costo']} />
              <Bar dataKey="costUsd" fill={C.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── RUN PER FASE + COSTO PER MODELLO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-s-4">
        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={BarChart3}>Run per fase</PanelTitle>
          {runsByPhase.length === 0 ? (
            <EmptyChart label="Nessuna run registrata." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, runsByPhase.length * 34)}>
              <BarChart data={runsByPhase} layout="vertical" margin={{ top: 4, right: 16, left: 40, bottom: 4 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} allowDecimals={false} />
                <YAxis type="category" dataKey="phase" tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} width={110} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {runsByPhase.map((r) => (
                    <Cell key={r.phase} fill={PHASE_COLOR[r.phase] ?? C.neutral} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={Coins}>Costo per modello</PanelTitle>
          {observations.byModel.length === 0 ? (
            <EmptyChart label="Nessuna observation con modello." />
          ) : (
            <ul className="divide-y divide-neutral-850 text-xs font-mono">
              {observations.byModel.map((m) => (
                <li key={m.model} className="flex items-center justify-between gap-s-3 py-s-2">
                  <span className="min-w-0 truncate text-neutral-300">{m.model}</span>
                  <span className="flex items-center gap-s-4 shrink-0 tabular-nums text-neutral-500">
                    <span>{m.count}×</span>
                    <span className="text-neutral-400">{fmtMs(m.avgMs)}</span>
                    <span className="bb-accent w-14 text-right">{fmtUsd(m.costUsd)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── ALERT PER CANALE + GATE DI EVAL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-s-4">
        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={ShieldAlert}>Alert per canale</PanelTitle>
          {alerts.length === 0 ? (
            <EmptyChart label="Nessun alert. Tutti i canali silenti." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, alerts.length * 34)}>
              <BarChart data={alerts} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 4 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} allowDecimals={false} />
                <YAxis type="category" dataKey="channel" tick={{ fill: C.neutral, fontSize: 11 }} stroke={C.grid} width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {alerts.map((a) => (
                    <Cell key={a.channel} fill={a.errors > 0 ? C.red : C.orange} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-neutral-850 bg-neutral-900 rounded-md p-s-4">
          <PanelTitle Icon={ShieldCheck}>Gate di eval — regressioni intercettate</PanelTitle>
          {evalGate.recent.length === 0 ? (
            <EmptyChart label="Nessun gate rosso: nessuna regressione intercettata." />
          ) : (
            <ul className="divide-y divide-neutral-850 text-xs font-mono max-h-[240px] overflow-y-auto">
              {evalGate.recent.map((e) => (
                <li key={e.id} className="flex items-start gap-s-3 py-s-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red" />
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-300 break-words">{e.message}</p>
                    <p className="text-[11px] text-neutral-600 tabular-nums mt-0.5">
                      {e.regressions} {e.regressions === 1 ? 'regressione' : 'regressioni'}
                      {' · '}
                      {new Date(e.createdAt).toLocaleString()}
                      {e.ackAt ? ' · ack' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Placeholder quando un pannello non ha dati da graficare. */
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-center text-xs font-mono text-neutral-600 border border-dashed border-neutral-850 rounded-sm">
      {label}
    </div>
  );
}
