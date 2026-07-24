/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Modale delle impostazioni del fix agentico: scelta del provider AI
 * (Claude headless / Gemini / DeepSeek) e relative API key. Controllata dal
 * genitore: lo stato vive nell'hook use-fix-agentico, qui solo presentazione.
 *
 * @indice
 * - ModaleImpostazioniAI → modale di configurazione provider AI
 */

'use client';

import { Settings, X } from 'lucide-react';
import type { AiProvider } from '@/modules/bugbay/hooks/use-fix-agentico';

const PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'claude-headless', label: 'Claude (Headless)' },
  { key: 'gemini', label: 'Gemini API' },
  { key: 'deepseek', label: 'DeepSeek API' },
];

export function ModaleImpostazioniAI({ provider, geminiApiKey, deepseekApiKey, anthropicApiKey, onProvider, onGeminiKey, onDeepseekKey, onAnthropicKey, onClose, onSave }: {
  provider: AiProvider;
  geminiApiKey: string;
  deepseekApiKey: string;
  anthropicApiKey: string;
  onProvider: (p: AiProvider) => void;
  onGeminiKey: (k: string) => void;
  onDeepseekKey: (k: string) => void;
  onAnthropicKey: (k: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-s-4 bg-neutral-900/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-lg shadow-sh-3 flex flex-col text-neutral-200">
        <div className="flex items-center justify-between px-s-6 py-s-4 border-b border-neutral-850 bg-neutral-950/40">
          <h3 className="font-display font-semibold text-h3 text-white flex items-center gap-s-2">
            <Settings className="w-5 h-5 text-sky" />
            <span>Impostazioni AI</span>
          </h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-s-6 flex flex-col gap-s-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block mb-2">
              Provider AI
            </label>
            <div className="grid grid-cols-3 gap-s-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onProvider(p.key)}
                  className={`px-3 py-3 text-xs font-semibold rounded-sm border transition-all text-center cursor-pointer ${
                    provider === p.key
                      ? 'bg-sky/10 border-sky text-sky'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {provider === 'gemini' && (
            <div className="space-y-s-2 animate-fadeIn">
              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => onGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-sm py-2.5 px-3 text-sm focus:outline-none focus:border-sky text-neutral-200"
              />
              <p className="text-[11px] text-neutral-500">
                La chiave viene salvata nel browser e nelle impostazioni locali del server di sviluppo.
              </p>
            </div>
          )}

          {provider === 'deepseek' && (
            <div className="space-y-s-2 animate-fadeIn">
              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                DeepSeek API Key
              </label>
              <input
                type="password"
                value={deepseekApiKey}
                onChange={(e) => onDeepseekKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-sm py-2.5 px-3 text-sm focus:outline-none focus:border-sky text-neutral-200"
              />
              <p className="text-[11px] text-neutral-500">
                La chiave viene salvata nel browser e nelle impostazioni locali del server di sviluppo.
              </p>
            </div>
          )}

          {provider === 'claude-headless' && (
            <div className="space-y-s-2 animate-fadeIn">
              <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                Anthropic API Key <span className="text-neutral-600 normal-case font-normal">(opzionale — velocizza riformulazioni e giudice)</span>
              </label>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => onAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-sm py-2.5 px-3 text-sm focus:outline-none focus:border-sky text-neutral-200"
              />
              <p className="text-[11px] text-neutral-500">
                Senza chiave i task di testo passano dalla CLI claude (login locale, ~10s). Con la chiave usano
                l&apos;API REST con Haiku (~1-3s). Le run di fix usano sempre la CLI.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-s-3 px-s-6 py-s-4 border-t border-neutral-850 bg-neutral-950/20">
          <button onClick={onClose} className="px-s-4 py-s-2 text-xs font-semibold uppercase tracking-brand text-neutral-400 hover:text-white">
            Annulla
          </button>
          <button onClick={onSave} className="px-s-5 py-s-2 text-xs font-semibold uppercase tracking-brand rounded-sm bg-sky text-navy hover:opacity-90">
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
