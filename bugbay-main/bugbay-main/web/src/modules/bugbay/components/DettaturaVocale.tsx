/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Bottone di dettatura vocale per i campi descrizione delle segnalazioni.
 * Usa la Web Speech API (SpeechRecognition / webkitSpeechRecognition) in
 * italiano: al click avvia/ferma l'ascolto continuo e, ad ogni frammento di
 * trascritto finalizzato, lo restituisce al chiamante tramite onText perché lo
 * APPENDA alla descrizione. Se l'API non è disponibile mostra il bottone
 * disabilitato con un titolo esplicativo. Nessun `any`: l'oggetto di
 * riconoscimento è descritto da un'interfaccia locale minimale e window viene
 * tipizzata via unknown.
 *
 * @indice
 * - DettaturaVocale → bottone microfono con dettatura vocale it-IT
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

/* ── Tipi minimali della Web Speech API (no `any`) ──────────────── */

interface RisultatoRiconoscimento {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { readonly transcript: string };
  readonly [index: number]: { readonly transcript: string };
}

interface EventoRiconoscimento {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): RisultatoRiconoscimento;
    readonly [index: number]: RisultatoRiconoscimento;
  };
}

interface RiconoscimentoVocale {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: EventoRiconoscimento) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type CostruttoreRiconoscimento = new () => RiconoscimentoVocale;

interface WindowConRiconoscimento {
  SpeechRecognition?: CostruttoreRiconoscimento;
  webkitSpeechRecognition?: CostruttoreRiconoscimento;
}

/** Recupera il costruttore di SpeechRecognition, se il browser lo espone. */
function getCostruttoreRiconoscimento(): CostruttoreRiconoscimento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as WindowConRiconoscimento;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ── Componente ─────────────────────────────────────────────────── */

export function DettaturaVocale({ onText }: { onText: (text: string) => void }) {
  const [supportato, setSupportato] = useState(false);
  const [inAscolto, setInAscolto] = useState(false);
  const riconoscimentoRef = useRef<RiconoscimentoVocale | null>(null);
  // onText viene mantenuto in una ref per non ricreare il riconoscimento ad
  // ogni render del genitore (la closure di onresult resta sempre aggiornata).
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const Costruttore = getCostruttoreRiconoscimento();
    if (!Costruttore) {
      setSupportato(false);
      return;
    }
    setSupportato(true);

    const riconoscimento = new Costruttore();
    riconoscimento.lang = 'it-IT';
    riconoscimento.continuous = true;
    riconoscimento.interimResults = true;

    riconoscimento.onresult = (evento) => {
      // Appendiamo SOLO i frammenti finalizzati: gli interim cambiano e
      // sporcherebbero la descrizione.
      let finalizzato = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const risultato = evento.results[i];
        if (risultato.isFinal) finalizzato += risultato[0].transcript;
      }
      const testo = finalizzato.trim();
      if (testo) onTextRef.current(testo);
    };

    riconoscimento.onend = () => setInAscolto(false);
    riconoscimento.onerror = () => setInAscolto(false);

    riconoscimentoRef.current = riconoscimento;

    return () => {
      riconoscimento.onresult = null;
      riconoscimento.onend = null;
      riconoscimento.onerror = null;
      try { riconoscimento.stop(); } catch { /* già fermo */ }
      riconoscimentoRef.current = null;
    };
  }, []);

  const toggle = () => {
    const riconoscimento = riconoscimentoRef.current;
    if (!riconoscimento) return;
    if (inAscolto) {
      try { riconoscimento.stop(); } catch { /* già fermo */ }
      setInAscolto(false);
    } else {
      try {
        riconoscimento.start();
        setInAscolto(true);
      } catch {
        // start() può lanciare se già avviato: riallineiamo lo stato.
        setInAscolto(false);
      }
    }
  };

  if (!supportato) {
    return (
      <button
        type="button"
        disabled
        title="Dettatura non supportata da questo browser"
        className="inline-flex items-center gap-s-1 px-s-2 py-s-1 rounded-md text-[11px] font-semibold text-neutral-600 bg-neutral-850 border border-neutral-800 opacity-50 cursor-not-allowed"
      >
        <MicOff className="w-3.5 h-3.5" />
        Detta
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={inAscolto ? 'Ferma la dettatura' : 'Detta la descrizione a voce (it-IT)'}
      aria-pressed={inAscolto}
      className={`inline-flex items-center gap-s-1 px-s-2 py-s-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
        inAscolto
          ? 'bg-red/15 text-red border-red/30 animate-pulse'
          : 'bg-neutral-850 text-neutral-300 border-neutral-800 hover:text-white hover:border-neutral-700'
      }`}
    >
      <Mic className="w-3.5 h-3.5" />
      {inAscolto ? 'In ascolto…' : 'Detta'}
    </button>
  );
}
