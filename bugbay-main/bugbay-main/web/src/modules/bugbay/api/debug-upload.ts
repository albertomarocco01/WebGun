/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Endpoint di upload degli allegati (screenshot/screencast) di una segnalazione.
 * Riceve un singolo file via multipart/form-data (campo `file`), valida MIME e
 * dimensione, lo salva su filesystem locale sotto public/bugbay-uploads/ con un
 * nome generato (UUID) per evitare path traversal, e ritorna un Attachment.
 *
 * NOTA PRODUZIONE: lo storage su filesystem locale qui è il SEAM unico da
 * sostituire con Supabase Storage in produzione. L'intero contratto (POST →
 * Attachment) resta identico: cambia solo dove si scrivono i byte e come si
 * deriva la `url` pubblica. Tutto il resto del modulo non va toccato.
 *
 * @indice
 * - POST → carica un allegato e restituisce l'Attachment salvato
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Attachment } from '@/modules/bugbay/types';

// Lo storage locale richiede il runtime Node (fs, Buffer): non Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tetto massimo per allegato: 50 MB. */
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Allow-list MIME → estensione. FONTE UNICA: l'estensione deriva SOLO dal MIME
 * validato, MAI dal nome file del client. SICUREZZA: il vecchio codice fidava
 * l'estensione del nome client (`.svg`/`.html` passavano) → file eseguibile
 * come script servito da public/bugbay-uploads/ (XSS). `svg` è escluso a
 * disegno: è renderizzabile come documento con script.
 */
const MIME_ESTENSIONE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    // Il campo deve essere un Blob/File, non una semplice stringa di form.
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Nessun file fornito (campo `file` mancante)' }, { status: 400 });
    }

    // Membership esatta sull'allow-list: rifiuta svg/html/octet-stream e ogni
    // tipo non in mappa. Il `type` (image|video) deriva dal MIME validato.
    const mime = (file.type || '').toLowerCase();
    const ext = MIME_ESTENSIONE[mime];
    if (!ext) {
      return NextResponse.json(
        { error: `Tipo di file non consentito (ricevuto "${mime || 'sconosciuto'}"). Ammessi: PNG, JPG, WEBP, GIF, MP4, WEBM.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File troppo grande: massimo ${MAX_SIZE_BYTES / (1024 * 1024)} MB` },
        { status: 413 },
      );
    }

    const type: Attachment['type'] = mime.startsWith('image/') ? 'image' : 'video';
    const originalName = typeof file.name === 'string' && file.name ? file.name : `allegato-${type}`;

    // Nome su disco generato: UUID + estensione dal MIME validato. MAI il nome
    // client (né come estensione né nel path) → niente XSS né directory traversal.
    const fileName = `${crypto.randomUUID()}${ext}`;

    // SEAM PRODUZIONE: qui in produzione si farebbe l'upload su Supabase Storage
    // (storage.from('bugbay-uploads').upload(fileName, bytes)) e si userebbe la
    // public URL restituita al posto del path locale sotto.
    const uploadsDir = path.join(process.cwd(), 'public', 'bugbay-uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadsDir, fileName), bytes);

    const attachment: Attachment = {
      type,
      url: `/bugbay-uploads/${fileName}`,
      name: originalName,
      size: file.size,
    };

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('[API/debug-upload] Error:', error);
    return NextResponse.json({ error: 'Errore durante il caricamento dell\'allegato' }, { status: 500 });
  }
}
