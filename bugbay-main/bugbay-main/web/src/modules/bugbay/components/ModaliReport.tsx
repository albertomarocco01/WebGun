/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Modali della console di debugging legate alla singola segnalazione:
 * creazione manuale, modifica e risoluzione manuale. Tutte controllate dal
 * genitore (lo stato del form vive nella pagina, le modali sono presentazione
 * + callback). Estratte da page.tsx per la convenzione sulla lunghezza file.
 *
 * @indice
 * - DatiNuovaSegnalazione      → shape del form di creazione (incl. reporterName)
 * - ModaleNuovaSegnalazione    → inserimento manuale (con campo "Segnalato da")
 * - ModaleModificaSegnalazione → modifica di una segnalazione esistente
 * - ModaleRisolvi              → chiusura manuale con note di risoluzione
 */

'use client';

import { useEffect } from 'react';
import { PlusCircle, Pencil, CheckCircle, X, Globe } from 'lucide-react';
import type { SystemReport, Attachment } from '@/modules/bugbay/types';
import { CATEGORIES, PRIORITIES, STATUSES } from '@/modules/bugbay/config';
import { WandRiformula } from './RiformulazioneAI';
import { DettaturaVocale } from './DettaturaVocale';
import { AllegatiUploader } from './AllegatiUploader';
import type { AiProvider } from '@/modules/bugbay/hooks/use-fix-agentico';

interface AiProps {
  aiProvider: AiProvider;
  geminiApiKey: string;
  deepseekApiKey: string;
}

function wandKeys(ai: AiProps) {
  return {
    provider: ai.aiProvider,
    geminiApiKey: ai.aiProvider === 'gemini' ? ai.geminiApiKey : undefined,
    deepseekApiKey: ai.aiProvider === 'deepseek' ? ai.deepseekApiKey : undefined,
  };
}

export interface DatiNuovaSegnalazione {
  category: SystemReport['category'];
  priority: SystemReport['priority'];
  url: string;
  notes: string;
  reporterName: string;
  attachments: Attachment[];
}

/**
 * Appende un frammento dettato a voce alla descrizione, separandolo con uno
 * spazio dal testo già presente (i frammenti finalizzati arrivano già trimmati).
 */
function appendiTestoDettato(notes: string, frammento: string): string {
  if (!notes.trim()) return frammento;
  return `${notes.trimEnd()} ${frammento}`;
}

/* ── Campi condivisi tra Nuova e Modifica ───────────────────────── */

function CampoSegnalatoDa({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-s-2">
      <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Segnalato da</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2 px-3 text-sm focus:outline-none focus:border-neutral-700"
        placeholder="Nome di chi ha segnalato…"
      />
    </div>
  );
}

/* ── Modale: nuova segnalazione manuale ─────────────────────────── */

export function ModaleNuovaSegnalazione({ value, onChange, onClose, onCreate, ai }: {
  value: DatiNuovaSegnalazione;
  onChange: (v: DatiNuovaSegnalazione) => void;
  onClose: () => void;
  onCreate: () => void;
  ai: AiProps;
}) {
  // Auto-popola l'URL di riferimento con la pagina corrente all'apertura della
  // modale (window.location.href: path completo + query string + fragment), se
  // non è già valorizzato. Coerente con il widget flottante: l'utente non deve
  // incollare manualmente l'URL d'origine della segnalazione.
  useEffect(() => {
    if (typeof window === 'undefined' || value.url) return;
    onChange({ ...value, url: window.location.href });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
          <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
            <PlusCircle className="w-5 h-5 text-red animate-bounce" />
            <span>Inserisci Segnalazione Manuale</span>
          </h3>
          <button onClick={onClose} className="p-s-1 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-s-6 space-y-s-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Categoria</label>
            <div className="grid grid-cols-3 gap-s-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onChange({ ...value, category: cat.key })}
                  className={`py-2 text-xs font-semibold rounded-md border text-center transition-all ${
                    value.category === cat.key ? `${cat.color} border-white/20` : 'bg-neutral-850 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Priorità</label>
            <div className="grid grid-cols-5 gap-s-1">
              {PRIORITIES.map((prio) => (
                <button
                  key={prio.key}
                  onClick={() => onChange({ ...value, priority: prio.key })}
                  className={`py-1.5 text-[11px] font-semibold rounded-md border text-center transition-all ${
                    value.priority === prio.key ? 'bg-neutral-800 text-white border-neutral-600' : 'bg-neutral-850 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {prio.key}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label flex items-center justify-between">
              <span>URL Riferimento</span>
              <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-s-1 normal-case tracking-normal">
                <Globe className="w-3 h-3" /> Automatico
              </span>
            </label>
            <input
              type="text"
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-350 rounded-sm py-2 px-3 font-mono text-xs focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <CampoSegnalatoDa value={value.reporterName} onChange={(reporterName) => onChange({ ...value, reporterName })} />

          <div className="space-y-s-2">
            <div className="flex items-center justify-between gap-s-2">
              <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Descrizione della Segnalazione *</label>
              <div className="flex items-center gap-s-2">
                <DettaturaVocale onText={(t) => onChange({ ...value, notes: appendiTestoDettato(value.notes, t) })} />
                <WandRiformula
                  value={value.notes}
                  onApply={(t) => onChange({ ...value, notes: t })}
                  {...wandKeys(ai)}
                  itemLabel="Descrizione segnalazione"
                  itemDesc={`Segnalazione ${value.category}`}
                  itemPath={value.url || '-'}
                />
              </div>
            </div>
            <textarea
              required
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-3 px-3 min-h-24 text-sm focus:outline-none leading-relaxed"
              placeholder="Descrivi il problema o la miglioria nei minimi dettagli..."
            />
          </div>

          <AllegatiUploader
            value={value.attachments ?? []}
            onChange={(attachments) => onChange({ ...value, attachments })}
          />
        </div>

        <div className="flex justify-end gap-s-3 p-s-6 border-t border-neutral-850 bg-neutral-950/20">
          <button onClick={onClose} className="px-s-5 py-s-3 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white cursor-pointer">
            Annulla
          </button>
          <button
            onClick={onCreate}
            disabled={!value.notes.trim()}
            className="px-s-6 py-s-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-red text-white hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            Invia
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modale: modifica segnalazione ──────────────────────────────── */

export function ModaleModificaSegnalazione({ value, onChange, onClose, onSave, ai }: {
  value: SystemReport;
  onChange: (v: SystemReport) => void;
  onClose: () => void;
  onSave: () => void;
  ai: AiProps;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
          <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
            <Pencil className="w-5 h-5 text-sky animate-pulse" />
            <span>Modifica Segnalazione</span>
          </h3>
          <button onClick={onClose} className="p-s-1 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-s-6 space-y-s-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label">Categoria</label>
            <div className="grid grid-cols-3 gap-s-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onChange({ ...value, category: cat.key })}
                  className={`py-2 text-xs font-semibold rounded-md border text-center transition-all ${
                    value.category === cat.key ? `${cat.color} border-white/20` : 'bg-neutral-850 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label">Stato</label>
            <div className="grid grid-cols-4 gap-s-2">
              {STATUSES.map((st) => (
                <button
                  key={st.key}
                  onClick={() => onChange({ ...value, status: st.key })}
                  className={`py-2 text-xs font-semibold rounded-md border text-center transition-all ${
                    value.status === st.key ? 'bg-navy text-white border-navy-300' : 'bg-neutral-850 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-s-2">
            <label className="text-label text-neutral-450 uppercase tracking-label">Priorità</label>
            <div className="grid grid-cols-5 gap-s-1">
              {PRIORITIES.map((prio) => (
                <button
                  key={prio.key}
                  onClick={() => onChange({ ...value, priority: prio.key })}
                  className={`py-1.5 text-[11px] font-semibold rounded-md border text-center transition-all ${
                    value.priority === prio.key ? 'bg-neutral-800 text-white border-neutral-605' : 'bg-neutral-850 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {prio.key}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-s-2">
            <label className="text-label text-neutral-400 uppercase tracking-label">Link URL</label>
            <input
              type="text"
              value={value.url || ''}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-350 rounded-sm py-2 px-3 font-mono text-xs focus:outline-none"
            />
          </div>

          <CampoSegnalatoDa value={value.reporterName ?? ''} onChange={(reporterName) => onChange({ ...value, reporterName })} />

          <div className="space-y-s-2">
            <div className="flex items-center justify-between gap-s-2">
              <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Descrizione</label>
              <div className="flex items-center gap-s-2">
                <DettaturaVocale onText={(t) => onChange({ ...value, notes: appendiTestoDettato(value.notes, t) })} />
                <WandRiformula
                  value={value.notes}
                  onApply={(t) => onChange({ ...value, notes: t })}
                  {...wandKeys(ai)}
                  itemLabel="Descrizione segnalazione"
                  itemDesc={`Segnalazione ${value.category}`}
                  itemPath={value.url || '-'}
                />
              </div>
            </div>
            <textarea
              value={value.notes}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2 px-3 min-h-24 text-sm focus:outline-none leading-relaxed"
            />
          </div>

          <AllegatiUploader
            value={value.attachments ?? []}
            onChange={(attachments) => onChange({ ...value, attachments })}
          />
        </div>

        <div className="flex justify-end gap-s-3 p-s-6 border-t border-neutral-850 bg-neutral-950/20">
          <button onClick={onClose} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white">
            Annulla
          </button>
          <button
            onClick={onSave}
            className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-sky text-navy hover:opacity-90 font-bold"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modale: risoluzione manuale ────────────────────────────────── */

export function ModaleRisolvi({ notes, onNotes, onClose, onConfirm, aiEnabled, ai }: {
  notes: string;
  onNotes: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  aiEnabled: boolean;
  ai: AiProps;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
          <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
            <CheckCircle className="w-5 h-5 text-green" />
            <span>Segna come Risolto</span>
          </h3>
          <button onClick={onClose} className="p-s-1 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-s-6 space-y-s-4">
          <div className="space-y-s-2">
            <div className="flex items-center justify-between gap-s-2">
              <label htmlFor="res-notes" className="text-label text-neutral-400 uppercase tracking-label font-bold">
                Note di Risoluzione dello Sviluppatore
              </label>
              {aiEnabled && (
                <WandRiformula
                  value={notes}
                  onApply={onNotes}
                  {...wandKeys(ai)}
                  itemLabel="Note di risoluzione"
                  itemDesc="Riscrivi in modo chiaro e professionale le note che descrivono come è stato risolto il problema."
                  itemPath="-"
                />
              )}
            </div>
            <textarea
              id="res-notes"
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Es. Risolto correggendo il CSS margin sul mobile e allineando i layout."
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-2.5 px-s-3 min-h-24 text-sm focus:outline-none focus:border-neutral-700"
            />
          </div>
        </div>

        <div className="flex justify-end gap-s-3 p-s-6 border-t border-neutral-850 bg-neutral-950/20">
          <button onClick={onClose} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white">
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-green text-white hover:bg-green-700"
          >
            Conferma Risoluzione
          </button>
        </div>
      </div>
    </div>
  );
}
