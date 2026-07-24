/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Tipi della checklist di revisione QA. I DATI sono stati SVUOTATI: la checklist
 * non è più cablata per uno specifico sito (conteneva la revisione Baldisport,
 * ormai obsoleta). Verrà ripopolata dinamicamente dalla feature "Refresh with
 * AI" — un agente legge le modifiche git recenti e genera le voci da verificare,
 * persistite su DB. Qui restano solo i tipi e costanti vuote di compatibilità.
 *
 * @indice
 * - RevisioneBadge / ChecklistUrl / ChecklistItem / ChecklistSection → tipi base
 * - ChecklistItemRow / ChecklistMeta / ChecklistState → modello DB-backed (Refresh AI)
 * - CHECKLIST_DATA → checklist legacy (vuota; fallback)
 * - STORICO_DATA   → storico controlli (vuoto)
 */

export type RevisioneBadge = 'manual' | 'ai' | 'bugfix' | 'critical';

export interface ChecklistUrl {
  url: string;
  label: string;
}

export interface ChecklistItem {
  id: string;
  badges: RevisioneBadge[];
  label: string;
  path: string;
  desc: string;
  urls: ChecklistUrl[];
  developer?: 'alberto' | 'jacopo';
}

export interface ChecklistSection {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  items: ChecklistItem[];
}

/**
 * Voce di checklist generata dal Refresh-with-AI e persistita su DB
 * (tabella debug_checklist_items). Porta sulla stessa riga sia la definizione
 * sia lo stato di revisione, così il merge tra refresh preserva il lavoro fatto.
 */
export interface ChecklistItemRow {
  id: string;
  sectionTitle: string;
  sectionOrder: number;
  label: string;
  descr: string;
  files: string[];
  urls: ChecklistUrl[];
  badges: RevisioneBadge[];
  priority: string | null;
  status: 'ok' | 'problema' | null;
  note: string | null;
  isNew: boolean;
}

/** Metadati dell'ultimo refresh (range git usato). */
export interface ChecklistMeta {
  lastRefreshSha: string | null;
  lastRefreshAt: string | null;
  base: string | null;
}

/** Risposta di GET /api/debug-checklist nel modello DB-backed. */
export interface ChecklistState {
  items: ChecklistItemRow[];
  notes: Record<string, string>;
  meta: ChecklistMeta;
}

/** Checklist legacy vuota (fallback; le voci vive arrivano dal DB via Refresh AI). */
export const CHECKLIST_DATA: { sections: ChecklistSection[] } = { sections: [] };

/** Storico vuoto. */
export const STORICO_DATA: { date: string; items: { label: string; path: string }[] } = {
  date: '',
  items: [],
};
