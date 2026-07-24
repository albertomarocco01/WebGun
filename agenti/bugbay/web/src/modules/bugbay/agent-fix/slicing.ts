/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Slice deterministico dei file per il contesto del Fixer (0 token): invece di
 * incollare file interi nel prompt, estrae solo i blocchi top-level (funzioni,
 * componenti, costanti) rilevanti per le keyword della segnalazione, con
 * marcatori di riga per gli edit. I file corti passano interi; se nessun blocco
 * matcha, il file passa intero (sotto soglia) o come mappa dei simboli.
 *
 * @indice
 * - extractKeywords → keyword dalla descrizione del problema
 * - sliceFile       → estratto rilevante di un singolo file
 * - sliceFiles      → contesto completo per il prompt del Fixer
 */

import { targetRoot } from './target-root';
import fs from 'fs';
import path from 'path';

const ROOT = (): string => targetRoot();

/** Sotto questa lunghezza il file passa intero (lo slice non conviene). */
const WHOLE_FILE_LINES = 160;
/** Budget massimo di righe estratte per file. */
const BUDGET_LINES = 220;

const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'che', 'non', 'per', 'con', 'del', 'della',
  'dei', 'delle', 'nel', 'nella', 'come', 'sono', 'deve', 'essere', 'più', 'anche', 'questo', 'questa',
  'quando', 'dove', 'tutti', 'tutto', 'viene', 'vengono', 'dovrebbe', 'fare', 'della', 'dalla', 'alla',
  'problema', 'errore', 'bug', 'pagina', 'sezione', 'invece', 'dopo', 'prima', 'verificare', 'risolvere',
]);

/** Estrae keyword significative da problema/criteri/note (testo libero). */
export function extractKeywords(text: string): string[] {
  const out = new Set<string>();
  // Stringhe quotate: riferimenti letterali a testi della UI (massimo peso)
  for (const m of text.matchAll(/["'«“]([^"'»”]{3,60})["'»”]/g)) out.add(m[1].toLowerCase());
  // Identificatori code-like (camelCase, snake_case, con punti o slash)
  for (const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*(?:[._/-][A-Za-z0-9_]+)+|[a-z]+[A-Z][A-Za-z0-9]*/g)) {
    out.add(m[0].toLowerCase());
  }
  // Parole comuni significative
  for (const m of text.toLowerCase().matchAll(/[a-zàèéìòù]{4,}/g)) {
    if (!STOPWORDS.has(m[0])) out.add(m[0]);
  }
  return [...out].slice(0, 24);
}

/** Confine di blocco top-level (dichiarazioni a inizio riga, non indentate). */
const BOUNDARY = /^(export\s+)?(default\s+)?(async\s+)?(function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;

interface Segment { start: number; end: number; name: string; score: number }

function segmentsOf(lines: string[]): Segment[] {
  const bounds: { line: number; name: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(BOUNDARY);
    if (m) bounds.push({ line: i, name: m[5] ?? '' });
  }
  if (bounds.length === 0) return [{ start: 0, end: lines.length, name: '', score: 0 }];
  const segs: Segment[] = [];
  // Preambolo (import, direttive) prima del primo blocco
  if (bounds[0].line > 0) segs.push({ start: 0, end: bounds[0].line, name: '(intestazione/import)', score: 0 });
  for (let b = 0; b < bounds.length; b++) {
    segs.push({
      start: bounds[b].line,
      end: b + 1 < bounds.length ? bounds[b + 1].line : lines.length,
      name: bounds[b].name,
      score: 0,
    });
  }
  return segs;
}

export interface FileSlice {
  path: string;
  /** Testo da mettere nel prompt (intero o estratto con marcatori). */
  excerpt: string;
  /** True se il file è stato tagliato (il Fixer deve citare search esatti). */
  sliced: boolean;
}

export function sliceFile(relPath: string, keywords: string[]): FileSlice {
  let content = '';
  try { content = fs.readFileSync(path.join(ROOT(), relPath), 'utf-8'); }
  catch { return { path: relPath, excerpt: '(file vuoto o non esistente)', sliced: false }; }

  const lines = content.split('\n');
  if (lines.length <= WHOLE_FILE_LINES) {
    return { path: relPath, excerpt: content, sliced: false };
  }

  const lower = lines.map((l) => l.toLowerCase());
  const segs = segmentsOf(lines);
  for (const seg of segs) {
    const nameLc = seg.name.toLowerCase();
    for (const kw of keywords) {
      if (nameLc.includes(kw)) seg.score += 5; // match sul nome del simbolo
      for (let i = seg.start; i < seg.end; i++) {
        if (lower[i].includes(kw)) seg.score += 1;
      }
    }
  }

  const hit = segs.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (hit.length === 0) {
    // Nessun match: mappa dei simboli (firme) così il Fixer sa cosa chiedere
    const firme = segs.map((s) => `riga ${s.start + 1}: ${lines[s.start].trim()}`).join('\n');
    return {
      path: relPath,
      sliced: true,
      excerpt: `(file di ${lines.length} righe — nessun blocco corrisponde alle keyword; mappa dei simboli:)\n${firme}`,
    };
  }

  // Seleziona i blocchi migliori entro il budget, poi riordina per posizione
  const chosen: Segment[] = [];
  let used = 0;
  for (const seg of hit) {
    const len = seg.end - seg.start;
    if (used + len > BUDGET_LINES && chosen.length > 0) continue;
    chosen.push(seg);
    used += len;
    if (used >= BUDGET_LINES) break;
  }
  chosen.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;
  for (const seg of chosen) {
    if (seg.start > cursor) parts.push(`// … [righe ${cursor + 1}–${seg.start} omesse] …`);
    parts.push(lines.slice(seg.start, seg.end).join('\n'));
    cursor = seg.end;
  }
  if (cursor < lines.length) parts.push(`// … [righe ${cursor + 1}–${lines.length} omesse] …`);

  return { path: relPath, excerpt: parts.join('\n'), sliced: true };
}

/** Slice di tutti i file in scope per il prompt del Fixer. */
export function sliceFiles(files: string[], keywordSource: string): FileSlice[] {
  const keywords = extractKeywords(keywordSource);
  return files.map((f) => sliceFile(f, keywords));
}
