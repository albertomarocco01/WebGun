/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Blocchi accessori della Campagna di revisione QA (modello DB-backed): card di
 * sezione (header collassabile con progress + note di area), storico dei
 * controlli passati, note generali del revisore e modale di export del prompt.
 * La sezione è ora ricavata raggruppando le voci per `sectionTitle`.
 *
 * @indice
 * - SezioneCard       → card di sezione con header e note di area
 * - StoricoCampagna   → controlli verificati in passato (nullo se vuoto)
 * - NoteGeneraliCampagna → note trasversali del revisore
 * - EsportaPromptModal   → modale con il prompt Markdown generato
 * - BarraAzioniBulk      → barra fissa di azioni sulle voci selezionate
 */

'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle, ChevronDown, Copy, Download, PenLine, X, Loader2, Sparkles } from 'lucide-react';
import { STORICO_DATA } from '@/modules/bugbay/data/revisione-checklist';
import { WandRiformula } from '../RiformulazioneAI';

interface WandProps {
  aiProvider?: 'claude-headless' | 'gemini' | 'deepseek';
  geminiApiKey?: string;
  deepseekApiKey?: string;
}

function wandKeys(p: WandProps) {
  return {
    provider: p.aiProvider,
    geminiApiKey: p.aiProvider === 'gemini' ? p.geminiApiKey : undefined,
    deepseekApiKey: p.aiProvider === 'deepseek' ? p.deepseekApiKey : undefined,
  };
}

export function SezioneCard({ title, num, count, collapsed, sectionAllSelected, noteArea, onToggleCollapse, onSelectSection, onNoteArea, wand, children }: {
  title: string;
  num: number;
  count: { r: number; i: number; total: number; done: boolean };
  collapsed: boolean;
  sectionAllSelected: boolean;
  noteArea: string;
  onToggleCollapse: () => void;
  onSelectSection: () => void;
  onNoteArea: (v: string) => void;
  wand: WandProps;
  children: ReactNode;
}) {
  const c = count;
  return (
    <div className="bg-neutral-900 border border-neutral-850 rounded-md overflow-hidden shadow-sh-1">
      {/* Header di sezione: div cliccabile (un <button> non può contenerne altri) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleCollapse}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); } }}
        className="w-full flex items-center justify-between gap-s-3 px-s-5 py-s-4 hover:bg-neutral-850/40 transition-colors text-left cursor-pointer select-none group"
      >
        <div className="flex items-center gap-s-3 min-w-0">
          <span className={`w-9 h-9 rounded-md border flex items-center justify-center font-display font-bold text-sm shrink-0 transition-colors ${
            c.done && c.i === 0 ? 'bg-green/10 text-green border-green/25' : c.i > 0 ? 'bg-red/10 text-red border-red/25' : 'bg-neutral-850 text-sky border-neutral-750 group-hover:border-sky/30'
          }`}>{num}</span>
          <div className="min-w-0">
            <div className="font-display font-semibold text-white text-sm truncate">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-s-3 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onSelectSection(); }}
            className="px-2 py-1 text-[10px] uppercase font-semibold rounded-sm bg-neutral-800 text-sky hover:bg-neutral-750 transition-colors border border-sky/10 cursor-pointer opacity-70 group-hover:opacity-100"
          >
            {sectionAllSelected ? 'Deseleziona Sezione' : 'Seleziona Sezione'}
          </button>
          {/* Mini progress della sezione: verde = ok, rosso = problemi */}
          <div className="hidden md:block w-24 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full flex">
              <div className="h-full bg-green transition-all" style={{ width: `${c.total ? (c.r / c.total) * 100 : 0}%` }} />
              <div className="h-full bg-red transition-all" style={{ width: `${c.total ? (c.i / c.total) * 100 : 0}%` }} />
            </div>
          </div>
          <span className={`text-xs font-mono font-semibold tabular-nums ${c.done ? 'text-green' : 'text-neutral-400'}`}>
            {c.i > 0 ? `${c.r}✓ ${c.i}✗ / ${c.total}` : `${c.r}/${c.total}`}
          </span>
          <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-neutral-850">
          {/* Note di area */}
          <div className="px-s-5 py-s-3 bg-neutral-950/30 border-b border-neutral-850">
            <div className="flex items-center justify-between gap-s-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 inline-flex items-center gap-1">
                <PenLine className="w-3 h-3" /> Note di area
              </label>
              <WandRiformula
                value={noteArea}
                onApply={onNoteArea}
                {...wandKeys(wand)}
                itemLabel={`Note di area · ${title}`}
                itemDesc="Riscrivi in modo chiaro e ordinato le osservazioni generali su questa area di revisione."
                itemPath={title}
              />
            </div>
            <textarea
              value={noteArea}
              onChange={(e) => onNoteArea(e.target.value)}
              placeholder="Osservazioni generali su questa area…"
              className="mt-1 w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-3 px-3 text-xs focus:outline-none focus:border-neutral-700 min-h-[100px] resize-y"
            />
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

export function StoricoCampagna() {
  if (STORICO_DATA.items.length === 0) return null;
  return (
    <div className="bg-neutral-900 border border-green/20 rounded-md overflow-hidden shadow-sh-1">
      <div className="px-s-5 py-s-4 bg-green/5 border-b border-green/20 flex items-center gap-s-3">
        <CheckCircle className="w-6 h-6 text-green" />
        <div>
          <div className="font-display font-semibold text-green text-sm">Storico controlli eseguiti</div>
          <div className="text-xs text-neutral-400">Verificati il {STORICO_DATA.date} — {STORICO_DATA.items.length} voci</div>
        </div>
      </div>
      <ul className="px-s-5 py-s-3 flex flex-col gap-1.5">
        {STORICO_DATA.items.map((i, idx) => (
          <li key={idx} className="text-xs text-neutral-300 flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green shrink-0 mt-0.5" />
            <span><strong className="text-neutral-200">{i.label}</strong> — <code className="text-neutral-500 font-mono">{i.path}</code></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoteGeneraliCampagna({ value, onChange, onSave, wand }: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  wand: WandProps;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-850 rounded-md p-s-5 shadow-sh-1">
      <div className="flex items-center justify-between gap-s-2">
        <label className="text-xs uppercase tracking-wider font-bold text-neutral-400">Note generali</label>
        <WandRiformula
          value={value}
          onApply={onChange}
          {...wandKeys(wand)}
          itemLabel="Note generali della revisione"
          itemDesc="Riscrivi in modo chiaro e ordinato le osservazioni trasversali, i dubbi e le priorità del revisore."
          itemPath="-"
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        placeholder="Osservazioni trasversali, dubbi, priorità — incluse nell'export…"
        className="mt-2 w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2.5 px-3 text-sm focus:outline-none focus:border-neutral-700 min-h-[80px] resize-y"
      />
    </div>
  );
}

export function BarraAzioniBulk({ count, bulkBusy, showResolveAi, onResolveAi, onSelectAll, onClear }: {
  count: number;
  bulkBusy: boolean;
  showResolveAi: boolean;
  onResolveAi: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-s-4 px-s-6 py-s-3 bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 text-white animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-s-2 text-sm text-neutral-300">
        <span className="w-5 h-5 rounded-full bg-sky/20 border border-sky/30 text-sky text-xs flex items-center justify-center font-bold">{count}</span>
        <span>selezionati</span>
      </div>
      <div className="w-[1.5px] h-6 bg-neutral-800" />
      <div className="flex items-center gap-s-2">
        {showResolveAi && (
          <button
            onClick={onResolveAi}
            disabled={bulkBusy}
            className="px-s-3 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green text-navy hover:opacity-90 flex items-center gap-s-2 cursor-pointer disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Risolvi con AI</span>
          </button>
        )}
        <button
          onClick={onSelectAll}
          disabled={bulkBusy}
          className="px-s-3 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center gap-s-1 cursor-pointer"
        >
          Tutti
        </button>
        <button
          onClick={onClear}
          disabled={bulkBusy}
          className="px-s-3 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm text-neutral-400 hover:text-white cursor-pointer"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

export function EsportaPromptModal({ markdown, onClose }: { markdown: string; onClose: () => void }) {
  const copyMarkdown = () => { navigator.clipboard.writeText(markdown).then(() => toast.success('Copiato negli appunti.')); };
  const downloadMarkdown = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `campagna-revisione-${new Date().toISOString().slice(0, 10)}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-4xl h-[80vh] bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850">
          <h3 className="font-display font-semibold text-white">Prompt Markdown per LLM</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <textarea readOnly value={markdown} className="flex-1 bg-neutral-950 text-neutral-200 font-mono text-xs p-s-4 resize-none focus:outline-none overflow-y-auto" />
        <div className="flex justify-end gap-s-3 px-s-6 py-s-4 border-t border-neutral-850">
          <button onClick={copyMarkdown} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-750 flex items-center gap-s-2 cursor-pointer">
            <Copy className="w-4 h-4" /> Copia
          </button>
          <button onClick={downloadMarkdown} className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-sky text-navy hover:opacity-90 flex items-center gap-s-2 cursor-pointer">
            <Download className="w-4 h-4" /> Scarica .md
          </button>
        </div>
      </div>
    </div>
  );
}
