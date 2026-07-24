/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Riformulazione AI inline e riusabile per i campi note/descrizione. Espone
 * WandRiformula, l'icona bacchetta magica da affiancare a ogni textarea:
 * al click riscrive il contenuto con un modello veloce (Haiku per Claude,
 * Flash per Gemini/DeepSeek) mostrando lo stato di caricamento al posto
 * dell'icona, senza aprire alcuna modale. Il testo riscritto viene restituito
 * al chiamante tramite onApply.
 *
 * @indice
 * - reformulateText → helper condiviso che chiama l'agente di riformulazione
 * - WandRiformula   → bottone bacchetta magica con riformulazione inline
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';

interface ReformulateParams {
  value: string;
  provider?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  itemLabel?: string;
  itemDesc?: string;
  itemPath?: string;
}

/**
 * Chiama l'agente per riscrivere un testo note/descrizione usando un modello
 * veloce. Ritorna la proposta riformulata (trim) o lancia in caso di errore.
 */
export async function reformulateText({
  value, provider, geminiApiKey, deepseekApiKey, itemLabel, itemDesc, itemPath,
}: ReformulateParams): Promise<string> {
  const res = await fetch('/api/agent-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reformulate',
      notes: value ?? '',
      itemLabel: itemLabel || 'Campo note',
      itemDesc: itemDesc || 'Riscrivi il testo seguente rendendolo chiaro, ordinato e professionale.',
      itemPath: itemPath || '-',
      provider, geminiApiKey, deepseekApiKey,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Errore riformulazione.');
  return (data.proposta ?? '').trim();
}

/**
 * Icona bacchetta magica da affiancare a una textarea/campo note: al click
 * riscrive il contenuto con l'AI mostrando uno spinner di caricamento al posto
 * dell'icona (inline, nessuna modale). All'esito, il testo riformulato viene
 * passato a onApply.
 */
export function WandRiformula({
  value, onApply, provider, geminiApiKey, deepseekApiKey,
  itemLabel, itemDesc, itemPath, title, className, disabled,
}: {
  value: string;
  onApply: (text: string) => void;
  provider?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  itemLabel?: string;
  itemDesc?: string;
  itemPath?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const proposta = await reformulateText({
        value, provider, geminiApiKey, deepseekApiKey, itemLabel, itemDesc, itemPath,
      });
      if (proposta) {
        onApply(proposta);
        toast.success('Testo riformulato con AI.');
      } else {
        toast.error('La riformulazione non ha prodotto alcun testo.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossibile contattare l\'agente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      title={loading ? 'Riformulazione in corso…' : (title ?? 'Riformula con AI')}
      className={className ?? 'p-1.5 rounded-sm text-sky hover:text-white hover:bg-sky/10 border border-sky/20 transition-colors cursor-pointer inline-flex items-center justify-center disabled:opacity-60 disabled:cursor-wait'}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
    </button>
  );
}
