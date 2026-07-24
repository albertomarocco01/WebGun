/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Uploader degli allegati (screenshot/screencast) di una segnalazione. Zona di
 * drag-and-drop + bottone "Allega file" (input multiplo image/video). Ogni file
 * viene caricato via POST /api/debug-upload (FormData campo `file`); gli
 * Attachment restituiti vengono APPESI al valore corrente tramite onChange.
 * Mostra lo stato di caricamento per file ed errori (toast sonner). Anteprime:
 * immagini come miniatura, video con tag <video>, ognuna con bottone di rimozione.
 *
 * @indice
 * - AllegatiUploader → input allegati con drag-and-drop, upload e anteprime
 */

'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Paperclip, UploadCloud, Film, X, Loader2 } from 'lucide-react';
import type { Attachment } from '@/modules/bugbay/types';

/** Formatta una dimensione in byte in una stringa leggibile (KB/MB). */
function formattaDimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/** Carica un singolo file e ritorna l'Attachment salvato, o lancia con messaggio. */
async function caricaFile(file: File): Promise<Attachment> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/debug-upload', { method: 'POST', body });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const messaggio =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Caricamento non riuscito';
    throw new Error(messaggio);
  }
  return data as Attachment;
}

export function AllegatiUploader({ value, onChange }: { value: Attachment[]; onChange: (a: Attachment[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trascinamento, setTrascinamento] = useState(false);
  // Nomi dei file attualmente in caricamento, mostrati come placeholder.
  const [inCaricamento, setInCaricamento] = useState<string[]>([]);

  const caricaFiles = async (files: FileList | File[]) => {
    const elenco = Array.from(files);
    if (elenco.length === 0) return;

    setInCaricamento((prev) => [...prev, ...elenco.map((f) => f.name)]);
    // value qui è quello al momento dell'avvio: accumuliamo i nuovi e li
    // appendiamo in un colpo solo per non perdere update concorrenti.
    const aggiunti: Attachment[] = [];
    for (const file of elenco) {
      try {
        aggiunti.push(await caricaFile(file));
      } catch (errore) {
        const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto';
        toast.error(`«${file.name}»: ${messaggio}`);
      } finally {
        setInCaricamento((prev) => {
          const idx = prev.indexOf(file.name);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      }
    }
    if (aggiunti.length > 0) onChange([...value, ...aggiunti]);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTrascinamento(false);
    if (e.dataTransfer.files?.length) void caricaFiles(e.dataTransfer.files);
  };

  const rimuovi = (url: string) => {
    onChange(value.filter((a) => a.url !== url));
  };

  return (
    <div className="space-y-s-2">
      <label className="text-label text-neutral-400 uppercase tracking-label font-bold">Allegati</label>

      {/* Zona drag-and-drop + bottone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setTrascinamento(true); }}
        onDragLeave={() => setTrascinamento(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-s-2 px-s-4 py-s-5 rounded-md border border-dashed text-center transition-colors ${
          trascinamento ? 'border-sky bg-sky/5' : 'border-neutral-800 bg-neutral-950/40'
        }`}
      >
        <UploadCloud className={`w-6 h-6 ${trascinamento ? 'text-sky' : 'text-neutral-500'}`} />
        <p className="text-xs text-neutral-400 leading-relaxed">
          Trascina qui immagini o video, oppure
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-s-1 px-s-3 py-s-2 text-[11px] font-semibold uppercase tracking-brand rounded-sm bg-neutral-850 text-neutral-200 border border-neutral-750 hover:text-white hover:border-neutral-700 transition-all cursor-pointer"
        >
          <Paperclip className="w-3.5 h-3.5" /> Allega file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void caricaFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Anteprime + caricamenti in corso */}
      {(value.length > 0 || inCaricamento.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-2">
          {value.map((a) => (
            <div
              key={a.url}
              className="relative group flex flex-col gap-s-1 p-s-1 rounded-md bg-neutral-950/50 border border-neutral-800"
            >
              {a.type === 'image' ? (
                <img src={a.url} alt={a.name} className="w-full h-20 object-cover rounded-sm" />
              ) : (
                <video src={a.url} className="w-full h-20 object-cover rounded-sm bg-neutral-900" muted />
              )}
              <div className="flex items-center gap-s-1 px-s-1 min-w-0">
                {a.type === 'video' && <Film className="w-3 h-3 text-sky shrink-0" />}
                <span className="text-[10px] text-neutral-400 truncate" title={a.name}>{a.name}</span>
              </div>
              <span className="px-s-1 text-[10px] text-neutral-600 tabular-nums">{formattaDimensione(a.size)}</span>
              <button
                type="button"
                onClick={() => rimuovi(a.url)}
                title="Rimuovi allegato"
                className="absolute top-1 right-1 p-0.5 rounded-pill bg-neutral-950/80 text-neutral-300 border border-neutral-700 hover:bg-red hover:text-white hover:border-red transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {inCaricamento.map((nome, i) => (
            <div
              key={`up-${nome}-${i}`}
              className="flex flex-col items-center justify-center gap-s-1 h-[92px] rounded-md bg-neutral-950/50 border border-neutral-800"
            >
              <Loader2 className="w-5 h-5 text-sky animate-spin" />
              <span className="text-[10px] text-neutral-500 truncate max-w-full px-s-1" title={nome}>{nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
