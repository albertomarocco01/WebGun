/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Widget flottante BUG BAY di segnalazione bug, montato nel root layout:
 * bottone fisso in basso a destra (ambra, brand del modulo) che apre il menu
 * strumenti (segnala un problema / apri la console). Il form rileva
 * automaticamente l'URL corrente (l'area si deduce dall'URL) e invia la
 * segnalazione nella pipeline (POST /api/debug-reports).
 *
 * @indice
 * - DebugWidget → widget flottante di segnalazione
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bug, X, Send, Globe } from 'lucide-react';
import { BugBayLogo } from '@/modules/bugbay/components/BugBayLogo';
import { toast } from 'sonner';
import { SystemReport, Attachment } from '@/modules/bugbay/types';
import { WandRiformula } from '@/modules/bugbay/components/RiformulazioneAI';
import { DettaturaVocale } from '@/modules/bugbay/components/DettaturaVocale';
import { AllegatiUploader } from '@/modules/bugbay/components/AllegatiUploader';
import { WIDGET_CATEGORIES as CATEGORIES, WIDGET_PRIORITIES as PRIORITIES } from '@/modules/bugbay/config';

export function DebugWidget() {
  const [activeView, setActiveView] = useState<'menu' | 'form' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Riformulazione AI disponibile solo se l'agente è abilitato (locale + ENABLE_AGENT_FIX=1)
  const [aiEnabled, setAiEnabled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/agent-fix')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAiEnabled(d?.enabled === true))
      .catch(() => setAiEnabled(false));
  }, []);

  const [formData, setFormData] = useState({
    category: 'Bug' as SystemReport['category'],
    priority: 'Media' as SystemReport['priority'],
    notes: '',
    reporterName: 'Sviluppatore',
    url: '',
    attachments: [] as Attachment[],
  });

  // Appende un frammento dettato a voce alla descrizione, con uno spazio.
  const appendiDettato = (frammento: string) =>
    setFormData(prev => ({
      ...prev,
      notes: prev.notes.trim() ? `${prev.notes.trimEnd()} ${frammento}` : frammento,
    }));

  // Rileva automaticamente l'URL corrente al montaggio e ogni volta che si apre
  // il widget o cambia pagina: window.location.href cattura path completo, query
  // string e fragment (#) della pagina d'origine. L'area si deduce dall'URL lato
  // API, non chiediamo più campi area/sotto-area specifici di un sito.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFormData(prev => ({ ...prev, url: window.location.href }));
  }, [pathname, activeView]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveView(null);
    };
    if (activeView !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [activeView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.notes.trim()) {
      toast.error('Inserisci una descrizione per la segnalazione');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/debug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      toast.success('Segnalazione inviata: è nella pipeline della console.');
      setFormData(prev => ({
        ...prev,
        notes: '',
        attachments: [],
      }));
      setActiveView(null);
    } catch (error) {
      console.error(error);
      toast.error('Impossibile inviare la segnalazione.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dentro la console BUG BAY il widget è ridondante (si segnala da lì).
  if (pathname?.startsWith('/debugging')) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setActiveView('menu')}
        className="fixed bottom-s-5 right-s-5 z-50 flex items-center justify-center w-14 h-14 bg-amber-400 text-neutral-950 rounded-pill shadow-sh-brand hover:bg-amber-500 hover:scale-105 active:scale-95 transition-all duration-200 group border-[1.5px] border-neutral-950/30 cursor-pointer"
        title="Bug Bay — segnala un problema"
      >
        <BugBayLogo className="w-9 h-9 group-hover:rotate-12 transition-transform duration-200" />
      </button>

      {/* Modal Backdrop & Overlay */}
      {activeView !== null && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 overflow-y-auto bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
          {/* Modal Container */}
          <div 
            className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
              <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
                <Bug className="w-6 h-6 text-amber-400 animate-bounce" />
                <span>
                  {activeView === 'menu' ? 'Bug Bay' : 'Segnala un Problema / Bug'}
                </span>
                <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 bg-amber-700/20 text-amber-400 border border-amber-700/30 rounded-pill uppercase">
                  Local Debug
                </span>
              </h3>
              <button
                onClick={() => setActiveView(null)}
                className="p-s-1 rounded-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeView === 'menu' ? (
              <div className="p-s-6 space-y-s-4">
                <p className="text-sm text-neutral-400 leading-relaxed text-center mb-s-2">
                  {"Seleziona l'azione desiderata per procedere con il debugging del sito."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
                  {/* Option 1: Segnala un problema */}
                  <button
                    type="button"
                    onClick={() => setActiveView('form')}
                    className="flex flex-col items-center justify-center text-center p-s-6 rounded-md bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all duration-200 cursor-pointer group hover:scale-[1.02] min-h-[160px]"
                  >
                    <div className="w-12 h-12 rounded-pill bg-red/10 text-red flex items-center justify-center mb-s-3 group-hover:bg-red/20 transition-colors">
                      <Bug className="w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-sm text-white mb-s-1">
                      Segnala un problema
                    </span>
                    <span className="text-[11px] text-neutral-400 leading-normal px-s-2">
                      {"Invia una segnalazione di bug, errore o suggerimento grafico per questa pagina."}
                    </span>
                  </button>

                  {/* Option 2: Console di debugging */}
                  <a
                    href="/debugging"
                    className="flex flex-col items-center justify-center text-center p-s-6 rounded-md bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all duration-200 cursor-pointer group hover:scale-[1.02] min-h-[160px]"
                  >
                    <div className="w-12 h-12 rounded-pill bg-sky/10 text-sky flex items-center justify-center mb-s-3 group-hover:bg-sky/20 transition-colors">
                      <Globe className="w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-sm text-white mb-s-1">
                      Console di debugging
                    </span>
                    <span className="text-[11px] text-neutral-400 leading-normal px-s-2">
                      {"Apri la pipeline delle segnalazioni: lavagna, verifiche e agenti AI."}
                    </span>
                  </a>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-s-6 py-s-5 space-y-s-5 max-h-[70vh]">
                {/* Category Rocker */}
                <div className="space-y-s-2">
                  <label className="text-label text-neutral-300 uppercase tracking-label font-bold">
                    Categoria *
                  </label>
                  <div className="grid grid-cols-3 gap-s-3">
                    {CATEGORIES.map(cat => {
                      const isSelected = formData.category === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: cat.key }))}
                          className={`py-s-3.5 px-s-4 text-xs font-semibold rounded-md border text-center transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? `${cat.color} scale-[1.02] border-white/30 shadow-md`
                              : 'bg-neutral-850 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Rocker */}
                <div className="space-y-s-2">
                  <label className="text-label text-neutral-300 uppercase tracking-label font-bold">
                    Priorità / Gravità *
                  </label>
                  <div className="grid grid-cols-5 gap-s-2">
                    {PRIORITIES.map(prio => {
                      const isSelected = formData.priority === prio.key;
                      return (
                        <button
                          key={prio.key}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, priority: prio.key }))}
                          className={`py-s-2.5 px-s-3 text-[11px] font-semibold rounded-md border text-center transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-navy text-white border-navy-300 scale-[1.02]'
                              : 'bg-neutral-850 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${prio.dot}`} />
                            {prio.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* URL Detect — rilevato in automatico, campo in sola lettura */}
                <div className="space-y-s-2">
                  <label className="text-label text-neutral-300 uppercase tracking-label font-bold flex items-center justify-between">
                    <span>URL Riferimento</span>
                    <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-s-1">
                      <Globe className="w-3 h-3" /> Automatico
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.url}
                    readOnly
                    aria-readonly="true"
                    title="Rilevato automaticamente dalla pagina corrente"
                    className="w-full bg-neutral-900 border border-dashed border-neutral-700 text-neutral-500 rounded-sm py-s-2 px-s-3 font-mono text-xs focus:outline-none cursor-not-allowed select-all"
                    placeholder="https://..."
                  />
                </div>

                {/* Segnalato da */}
                <div className="space-y-s-2">
                  <label className="text-label text-neutral-300 uppercase tracking-label font-bold">
                    Segnalato da
                  </label>
                  <input
                    type="text"
                    value={formData.reporterName}
                    onChange={(e) => setFormData(prev => ({ ...prev, reporterName: e.target.value }))}
                    className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-s-2 px-s-3 text-sm focus:outline-none focus:border-neutral-600"
                    placeholder="Il tuo nome…"
                  />
                </div>

                {/* Description Notes */}
                <div className="space-y-s-2">
                  <div className="flex items-center justify-between gap-s-2">
                    <label className="text-label text-neutral-300 uppercase tracking-label font-bold">
                      Descrizione del Bug / Problema *
                    </label>
                    <div className="flex items-center gap-s-2">
                      <DettaturaVocale onText={appendiDettato} />
                      <WandRiformula
                        value={formData.notes}
                        onApply={(t) => setFormData(prev => ({ ...prev, notes: t }))}
                        itemLabel="Descrizione segnalazione"
                        itemDesc={`Segnalazione ${formData.category}`}
                        itemPath={formData.url || '-'}
                      />
                    </div>
                  </div>
                  <textarea
                    required
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-sm py-s-3 px-s-3 min-h-24 focus:outline-none focus:border-neutral-600 text-sm leading-relaxed"
                    placeholder="Cosa succede? Quali passaggi portano all'errore? Descrivilo chiaramente qui..."
                  />
                </div>

                {/* Allegati */}
                <AllegatiUploader
                  value={formData.attachments}
                  onChange={(attachments) => setFormData(prev => ({ ...prev, attachments }))}
                />

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-s-3 pt-s-4 border-t border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setActiveView('menu')}
                    className="px-s-5 py-s-3 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.notes.trim()}
                    className="px-s-6 py-s-3 text-xs font-semibold uppercase tracking-brand rounded-sm bg-red text-white hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-s-2 shadow-sh-brand cursor-pointer"
                  >
                    {isSubmitting ? 'Salvataggio...' : 'Invia Segnalazione'}
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
