/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Panoramica cross-progetto (F2-inc2): totali per progetto sul DB condiviso del
 * hub multi-progetto. Read-only, si alimenta da `/api/agent-fix?overview=1`
 * (nessun filtro project_id). Col backend locale mostra il solo progetto corrente.
 *
 * @indice
 * - PanoramicaProgetti → cards dei totali + tabella per progetto
 */

'use client';

import { useEffect, useState } from 'react';
import { Bug, Wrench, Sparkles, CheckCircle, FolderGit2, RefreshCw } from 'lucide-react';

interface ProjectRow {
  projectId: string | null;
  name: string;
  total: number;
  open: number;
  inProgress: number;
  inVerifica: number;
  resolved: number;
}
interface Overview { projects: ProjectRow[]; totals: Omit<ProjectRow, 'projectId' | 'name'> }

export default function PanoramicaProgetti({ currentProjectName }: { currentProjectName?: string | null }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`/api/agent-fix?overview=1&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
      else setError(true);
    } catch { setError(true); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const t = data?.totals ?? { total: 0, open: 0, inProgress: 0, inVerifica: 0, resolved: 0 };
  const cards = [
    { label: 'Aperte', value: t.open, text: 'text-red', labelCls: 'text-red/80', accent: 'border-l-red', Icon: Bug, iconCls: 'text-red bg-red/10' },
    { label: 'In lavorazione', value: t.inProgress, text: 'text-sky', labelCls: 'text-sky/80', accent: 'border-l-sky', Icon: Wrench, iconCls: 'text-sky bg-sky/10' },
    { label: 'In verifica', value: t.inVerifica, text: 'text-violet-300', labelCls: 'text-violet-300/80', accent: 'border-l-violet-500', Icon: Sparkles, iconCls: 'text-violet-300 bg-violet-500/10' },
    { label: 'Chiuse', value: t.resolved, text: 'text-green', labelCls: 'text-green/80', accent: 'border-l-green', Icon: CheckCircle, iconCls: 'text-green bg-green/10' },
  ] as const;

  const projects = data?.projects ?? [];

  return (
    <div className="max-w-[1800px] mx-auto space-y-s-4">
      <div className="flex items-center justify-between gap-s-3">
        <p className="text-sm font-mono text-neutral-400">
          Totali per progetto sul <span className="text-neutral-200">DB condiviso</span> — hub multi-progetto.
        </p>
        <button
          onClick={load}
          className="p-2.5 text-neutral-400 hover:text-white bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 hover:border-neutral-700 transition-all rounded-sm cursor-pointer shadow-sh-1"
          title="Aggiorna"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Totali aggregati (tutti i progetti) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4">
        {cards.map(({ label, value, accent, text, labelCls, Icon, iconCls }) => (
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

      {/* Tabella per progetto */}
      <div className="bg-neutral-900 border border-neutral-850 rounded-md shadow-sh-1 overflow-x-auto">
        {error ? (
          <div className="p-s-6 text-sm font-mono text-red">Impossibile caricare la panoramica.</div>
        ) : loading && !data ? (
          <div className="p-s-6 text-sm font-mono text-neutral-400">Caricamento…</div>
        ) : projects.length === 0 ? (
          <div className="p-s-6 text-sm font-mono text-neutral-400">Nessuna segnalazione ancora.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-850">
                <th className="text-left px-s-4 py-s-3 font-bold">Progetto</th>
                <th className="text-right px-s-3 py-s-3 font-bold text-red/80">Aperte</th>
                <th className="text-right px-s-3 py-s-3 font-bold text-sky/80">In lav.</th>
                <th className="text-right px-s-3 py-s-3 font-bold text-violet-300/80">In verifica</th>
                <th className="text-right px-s-3 py-s-3 font-bold text-green/80">Chiuse</th>
                <th className="text-right px-s-4 py-s-3 font-bold text-neutral-300">Totale</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {projects.map((p) => {
                const mine = currentProjectName && p.name === currentProjectName;
                return (
                  <tr key={p.projectId ?? p.name} className={`border-b border-neutral-850/60 last:border-0 ${mine ? 'bg-neutral-850/50' : ''}`}>
                    <td className="px-s-4 py-s-3 font-body">
                      <span className="inline-flex items-center gap-s-2 text-neutral-200">
                        <FolderGit2 className={`w-4 h-4 shrink-0 ${mine ? 'bb-accent' : 'text-neutral-500'}`} />
                        {p.name}
                        {mine ? <span className="px-1.5 py-0.5 rounded-pill text-[9px] font-bold uppercase bb-accent-bg leading-none">questo</span> : null}
                      </span>
                    </td>
                    <td className="text-right px-s-3 py-s-3 text-red">{p.open}</td>
                    <td className="text-right px-s-3 py-s-3 text-sky">{p.inProgress}</td>
                    <td className="text-right px-s-3 py-s-3 text-violet-300">{p.inVerifica}</td>
                    <td className="text-right px-s-3 py-s-3 text-green">{p.resolved}</td>
                    <td className="text-right px-s-4 py-s-3 font-bold text-white">{p.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
