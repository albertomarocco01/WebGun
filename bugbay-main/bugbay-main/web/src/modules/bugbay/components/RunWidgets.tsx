/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Widget riusabili per visualizzare lo stato delle run agentiche: diff git
 * colorato per riga, stepper delle fasi di lavorazione, badge del verdetto del
 * Giudice e riepilogo telemetria. Usati dal drawer di dettaglio segnalazione e
 * dalla sala macchine.
 *
 * @indice
 * - DiffView      → diff git colorato (+/−/@@, header file)
 * - PhaseStepper  → stepper In coda → Interpretazione → Fix → Verifica
 * - VerdictBox    → verdetto del Giudice (criteri ✓/✗ + gap)
 * - UsageInline   → token/costo/durata compatti di una run
 * - Markdown      → render leggero del markdown generato dall'LLM (riassunto, problema…)
 */

'use client';

import { type ReactNode } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import type { AgentRun, RunVerdict } from '@/modules/bugbay/agent-fix/types';

/** Diff git colorato per riga (+ verde, − rosso, @@ sky, header file evidenziati). */
export function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="mt-2 bg-neutral-950 border border-neutral-800 rounded-sm text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed">
      {diff.split('\n').map((line, i) => {
        let cls = 'text-neutral-400 px-3';
        if (line.startsWith('diff --git') || line.startsWith('index ')) cls = 'text-neutral-500 px-3 bg-neutral-900/80';
        else if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-neutral-200 font-bold px-3 bg-neutral-900/80';
        else if (line.startsWith('@@')) cls = 'text-sky px-3 bg-sky/5';
        else if (line.startsWith('+')) cls = 'text-green px-3 bg-green/5';
        else if (line.startsWith('-')) cls = 'text-red px-3 bg-red/5';
        return <div key={i} className={cls}>{line || ' '}</div>;
      })}
    </pre>
  );
}

/** Stepper delle fasi della run durante la lavorazione in background. */
export function PhaseStepper({ phase }: { phase: string }) {
  const steps = [
    { key: 'queued', label: 'In coda' },
    { key: 'interpreting', label: 'Interpretazione' },
    { key: 'fixing', label: 'Fix del codice' },
    { key: 'verifying', label: 'Verifica tsc' },
  ];
  const idx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="flex items-center gap-0 w-full max-w-md">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5 relative">
            {i > 0 && (
              <span className={`absolute left-[-50%] right-[50%] top-[7px] h-0.5 ${i <= idx ? 'bg-sky' : 'bg-neutral-800'}`} />
            )}
            <span className={`relative z-10 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              done ? 'bg-sky border-sky' : active ? 'bg-neutral-950 border-sky animate-pulse' : 'bg-neutral-950 border-neutral-700'
            }`}>
              {done && <CheckCircle className="w-3 h-3 text-navy" />}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${active ? 'text-sky' : done ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Verdetto del Giudice: criteri ✓/✗ e gap da colmare. */
export function VerdictBox({ verdict }: { verdict: RunVerdict }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${verdict.soddisfatto ? 'border-green/25 bg-green/5' : 'border-orange/30 bg-orange-500/10'}`}>
      <p className={`text-[10px] uppercase tracking-wider font-bold mb-2 ${verdict.soddisfatto ? 'text-green' : 'text-orange'}`}>
        Verdetto del Giudice — {verdict.soddisfatto ? 'criteri soddisfatti' : 'richiede la tua attenzione'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {verdict.criteri.map((c, i) => (
          <li key={i} className="text-xs flex items-start gap-2">
            {c.ok
              ? <CheckCircle className="w-3.5 h-3.5 text-green shrink-0 mt-0.5" />
              : <AlertTriangle className="w-3.5 h-3.5 text-orange shrink-0 mt-0.5" />}
            <span className={c.ok ? 'text-neutral-300' : 'text-orange-200'}>{c.criterio}</span>
          </li>
        ))}
      </ul>
      {verdict.gap && (
        <p className="mt-2 text-xs text-orange-200/90 border-t border-orange-500/20 pt-2">
          <span className="font-bold">Gap:</span> {verdict.gap}
        </p>
      )}
    </div>
  );
}

/* ── Markdown leggero ───────────────────────────────────────────────
 * ponytail: i campi generati dall'LLM (riassunto, problema) escono in markdown
 * ma venivano mostrati come plain text. Renderer minimale del sottoinsieme che
 * gli LLM usano davvero — heading, liste, **bold**, *italic*, `code`, link —
 * senza una dipendenza markdown. Costruisce nodi React (no innerHTML → no XSS).
 * Passare a react-markdown solo se servono tabelle o markdown annidato.
 */

/** Inline: **bold**, *italic*, `code`, [testo](url). Il resto resta letterale. */
function renderInline(s: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={`${key}-${i}`} className="font-semibold text-neutral-100">{m[2]}</strong>);
    else if (m[4] != null) nodes.push(<code key={`${key}-${i}`} className="px-1 py-0.5 rounded-sm bg-neutral-800 text-neutral-200 font-mono text-[0.9em]">{m[4]}</code>);
    else if (m[6] != null) nodes.push(<em key={`${key}-${i}`}>{m[6]}</em>);
    else if (m[8] != null) nodes.push(<a key={`${key}-${i}`} href={m[9]} target="_blank" rel="noopener noreferrer" className="text-sky hover:underline">{m[8]}</a>);
    last = re.lastIndex;
    i++;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

/** Render leggero del markdown LLM (heading, liste ord./non, paragrafi). */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const k = `p${out.length}`;
    out.push(
      <p key={k} className="leading-relaxed">
        {para.flatMap((l, i) => [...(i ? [<br key={`br${i}`} />] : []), ...renderInline(l, `${k}-${i}`)])}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${out.length}`;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it, `${k}-${i}`)}</li>);
    out.push(
      list.ordered
        ? <ol key={k} className="list-decimal ml-5 flex flex-col gap-1">{items}</ol>
        : <ul key={k} className="list-disc ml-5 flex flex-col gap-1">{items}</ul>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      out.push(<p key={`h${out.length}`} className={`font-bold text-neutral-100 ${h[1].length === 1 ? 'text-sm' : 'text-[13px]'}`}>{renderInline(h[2], `h${out.length}`)}</p>);
    } else if (ul) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
    } else if (ol) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList(); para.push(line);
    }
  }
  flushPara(); flushList();
  return <div className={className}>{out}</div>;
}

/** Telemetria compatta di una run: token e durata. */
export function UsageInline({ run }: { run: AgentRun }) {
  if (run.codemod) return <span className="text-sky font-semibold text-[11px] font-mono">0 token (codemod)</span>;
  if (!run.usage) return null;
  const dur = run.startedAt && run.finishedAt
    ? Math.max(1, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))
    : null;
  return (
    <span className="text-[11px] font-mono text-neutral-400" title={`${run.usage.calls} chiamate LLM`}>
      <span className="text-neutral-300 tabular-nums">{(run.usage.inputTokens / 1000).toFixed(1)}k</span> in ·{' '}
      <span className="text-neutral-300 tabular-nums">{(run.usage.outputTokens / 1000).toFixed(1)}k</span> out
      {dur !== null && <span className="text-neutral-600"> · {dur}s</span>}
    </span>
  );
}
