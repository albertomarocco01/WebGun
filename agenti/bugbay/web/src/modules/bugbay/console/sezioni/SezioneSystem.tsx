/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sezione SYSTEM della console-hub (v0.9): stato di sistema notify-only. Due
 * pannelli alimentati da /api/agent-fix/radar (read-only + azioni a innesco
 * umano):
 *   - ALERTS  → gli `alerts` della spina (budget, watchdog, parse, eval, stuck),
 *               sola lettura, più recenti in testa.
 *   - RADAR   → i `radar_findings` (dep-major / dep-drift). Ogni finding offre
 *               "File as fix" (crea una segnalazione via la ingest esistente,
 *               che l'umano approverà) e "Ignora" (archivia). MAI auto-apply.
 * Un pulsante "Scansiona" lancia una scansione dipendenze on-demand.
 *
 * Il client NON importa mai i moduli server (node:sqlite): passa dalla route e
 * ridichiara i tipi del payload localmente (come SezioneInbox/hub-stream).
 *
 * @indice
 * - SezioneSystem → pannelli ALERTS + RADAR con scan/file-as-fix/dismiss
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ServerCog,
  RotateCw,
  Radar,
  ShieldAlert,
  PackagePlus,
  GitCompareArrows,
  FilePlus2,
  X,
  Bell,
  BellOff,
} from 'lucide-react';
import { toast } from 'sonner';

const SYSTEM_API = '/api/agent-fix/radar';
const POLL_MS = 8000;

/** Specchio client-safe di SystemAlert (api/radar.ts). */
interface SystemAlert {
  id: string;
  channel: string;
  severity: 'info' | 'warn' | 'error';
  runId: string | null;
  message: string;
  detail: string | null;
  createdAt: string;
  ackAt: string | null;
}

/** Specchio client-safe di RadarFinding (api/radar.ts). */
interface RadarFinding {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  status: 'new' | 'filed' | 'dismissed';
  createdAt: string;
}

interface SystemResponse {
  alerts: SystemAlert[];
  findings: RadarFinding[];
}

/** Età leggibile a partire da un ISO. */
function age(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.round(h / 24)}g fa`;
}

const SEVERITY_STYLE: Record<SystemAlert['severity'], string> = {
  info: 'text-neutral-300 border-neutral-700',
  warn: 'text-orange border-orange/40',
  error: 'text-red border-red/40',
};

export default function SezioneSystem() {
  const [data, setData] = useState<SystemResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setStatus('loading');
    fetch(SYSTEM_API)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<SystemResponse>;
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

  const scan = useCallback(() => {
    setScanning(true);
    fetch(SYSTEM_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'scan' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ scanned: number; inserted: number; registryReachable: boolean }>;
      })
      .then((res) => {
        toast.success(
          res.inserted > 0
            ? `Radar: ${res.inserted} ${res.inserted === 1 ? 'nuovo finding' : 'nuovi finding'} (${res.scanned} dep)`
            : `Radar: nessun nuovo finding (${res.scanned} dep scansionate)`,
        );
        if (!res.registryReachable) {
          toast.warning('Registry npm irraggiungibile: solo controllo offline (drift).');
        }
        load(true);
      })
      .catch(() => toast.error('Scansione radar fallita.'))
      .finally(() => setScanning(false));
  }, [load]);

  const act = useCallback(
    (id: string, action: 'file' | 'dismiss') => {
      setBusyId(id);
      fetch(SYSTEM_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then(() => {
          toast.success(
            action === 'file'
              ? 'Segnalato: la fix è in coda di revisione (approva dall’Inbox).'
              : 'Finding archiviato.',
          );
          load(true);
        })
        .catch(() =>
          toast.error(action === 'file' ? 'Creazione segnalazione fallita.' : 'Archiviazione fallita.'),
        )
        .finally(() => setBusyId(null));
    },
    [load],
  );

  const alerts = data?.alerts ?? [];
  const findings = data?.findings ?? [];

  return (
    <section className="space-y-s-6">
      <header className="flex items-center justify-between gap-s-4">
        <div className="flex items-center gap-s-2 text-sm font-mono text-neutral-300">
          <ServerCog className="w-4 h-4 bb-accent" />
          <span>System — alert della spina &amp; radar dipendenze</span>
        </div>
        <div className="flex items-center gap-s-2">
          <button
            onClick={scan}
            disabled={scanning}
            className="inline-flex items-center gap-s-2 px-s-3 py-s-2 rounded-sm border border-neutral-800 text-xs font-mono text-neutral-300 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <Radar className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scansione…' : 'Scansiona'}
          </button>
          <button
            onClick={() => load()}
            title="Ricarica"
            className="inline-flex items-center justify-center w-8 h-8 rounded-sm text-neutral-400 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {status === 'error' && (
        <div className="border border-red/30 bg-red/5 rounded-md p-s-6 text-center text-sm font-mono text-red">
          Impossibile caricare lo stato di sistema.
        </div>
      )}

      {/* ── ALERTS ── */}
      <div className="space-y-s-3">
        <div className="flex items-center gap-s-2 text-xs font-display font-bold uppercase tracking-brand text-neutral-400">
          <ShieldAlert className="w-4 h-4" />
          Alert spina
          <span className="text-neutral-600 font-mono normal-case tracking-normal">
            {alerts.length}
          </span>
        </div>
        {alerts.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-md p-s-6 text-center">
            <BellOff className="w-6 h-6 mx-auto text-neutral-600" />
            <p className="mt-s-2 text-xs font-mono text-neutral-500">
              Nessun alert. Budget, watchdog, parse, eval e stuck sono silenti.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-850 border border-neutral-850 rounded-md overflow-hidden">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-s-3 px-s-4 py-s-3 bg-neutral-900">
                <Bell
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    a.severity === 'error'
                      ? 'text-red'
                      : a.severity === 'warn'
                        ? 'text-orange'
                        : 'text-neutral-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-200 break-words">{a.message}</p>
                  {a.detail && (
                    <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">{a.detail}</p>
                  )}
                </div>
                <div className="flex items-center gap-s-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-s-2 py-0.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider ${SEVERITY_STYLE[a.severity]}`}
                  >
                    {a.channel}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500 tabular-nums hidden sm:inline">
                    {age(a.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── RADAR ── */}
      <div className="space-y-s-3">
        <div className="flex items-center gap-s-2 text-xs font-display font-bold uppercase tracking-brand text-neutral-400">
          <Radar className="w-4 h-4" />
          Radar dipendenze
          <span className="text-neutral-600 font-mono normal-case tracking-normal">
            {findings.length}
          </span>
          <span className="text-neutral-600 font-mono normal-case tracking-normal">
            · notify-only
          </span>
        </div>
        {findings.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-md p-s-6 text-center">
            <Radar className="w-6 h-6 mx-auto text-neutral-600" />
            <p className="mt-s-2 text-xs font-mono text-neutral-500">
              Nessun finding. Lancia una scansione per controllare major e drift delle dipendenze.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-850 border border-neutral-850 rounded-md overflow-hidden">
            {findings.map((f) => {
              const isMajor = f.kind === 'dep-major';
              const busy = busyId === f.id;
              return (
                <li key={f.id} className="flex items-start gap-s-3 px-s-4 py-s-3 bg-neutral-900">
                  {isMajor ? (
                    <PackagePlus className="w-4 h-4 mt-0.5 shrink-0 text-orange" />
                  ) : (
                    <GitCompareArrows className="w-4 h-4 mt-0.5 shrink-0 bb-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-200 break-words">{f.title}</p>
                    <div className="flex items-center gap-s-2 mt-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                        {f.kind}
                      </span>
                      {f.status === 'filed' && (
                        <span className="text-[10px] font-mono uppercase tracking-wider bb-accent">
                          · in coda
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-neutral-600 tabular-nums">
                        {age(f.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-s-2 shrink-0">
                    <button
                      onClick={() => act(f.id, 'file')}
                      disabled={busy || f.status === 'filed'}
                      title="Crea una segnalazione da approvare (nessuna modifica automatica)"
                      className="inline-flex items-center gap-s-1 px-s-2 py-s-1 rounded-sm border bb-accent-border bb-accent text-[11px] font-mono hover:bb-accent-bg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      File as fix
                    </button>
                    <button
                      onClick={() => act(f.id, 'dismiss')}
                      disabled={busy}
                      title="Ignora questo finding"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-neutral-500 hover:text-white hover:bg-neutral-850 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
