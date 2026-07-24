/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Sezione collassabile riusabile per spezzare blocchi lunghi (es. il report di
 * una run agentica) in sezioni scansionabili. Header con titolo, chevron e una
 * breve anteprima (es. "Log (23 righe)") visibile anche da chiusa; lo stato di
 * apertura è gestito internamente con un default configurabile. Stile coerente
 * col chrome scuro del modulo (border-neutral-850, bg-neutral-900, accenti).
 *
 * @indice
 * - Collapsible → sezione apri/chiudi con titolo, anteprima e chevron
 */

'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  /** Titolo della sezione (es. "Log", "Modifiche / Diff"). */
  titolo: string;
  /** Anteprima sintetica mostrata accanto al titolo (es. "23 righe", "4 file"). */
  preview?: string;
  /** Sezione aperta al primo render. Default: chiusa. */
  defaultOpen?: boolean;
  /** Icona opzionale a sinistra del titolo. */
  icon?: ReactNode;
  /** Accento ambra per evidenziare la sezione (es. il riassunto). */
  accent?: boolean;
  children: ReactNode;
}

/** Sezione collassabile con header (titolo + anteprima + chevron) e corpo. */
export function Collapsible({ titolo, preview, defaultOpen = false, icon, accent = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-md border bg-neutral-950/40 overflow-hidden ${accent ? 'bb-accent-border' : 'border-neutral-850'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-s-2 px-s-3 py-s-2 text-left hover:bg-neutral-850/40 cursor-pointer transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        {icon && <span className="shrink-0 inline-flex items-center text-neutral-500">{icon}</span>}
        <span className={`text-[10px] uppercase tracking-wider font-bold ${accent ? 'bb-accent' : 'text-neutral-300'}`}>
          {titolo}
        </span>
        {preview && (
          <span className="text-[11px] font-mono text-neutral-500 tabular-nums truncate">{preview}</span>
        )}
      </button>
      {open && <div className="px-s-3 pb-s-3 pt-s-1">{children}</div>}
    </div>
  );
}
