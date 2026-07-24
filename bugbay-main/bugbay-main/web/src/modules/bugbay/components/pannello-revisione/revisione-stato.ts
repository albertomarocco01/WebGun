/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Tipi e helper di stato della Campagna di revisione QA nel modello DB-backed
 * (Refresh-with-AI). Lo stato di review (ok/problema + nota) vive ora sulla
 * riga della voce (`ChecklistItemRow`); qui restano i tipi di filtro, le chiavi
 * delle note libere (generali / di area) e piccoli helper di raggruppamento e
 * conteggio sulle voci.
 *
 * @indice
 * - StatoVoce / FilterType        → tipi di stato e filtro
 * - GENERAL_NOTE_KEY / sezKey     → chiavi delle note libere
 * - statByItems / raggruppaPerSezione → conteggi e raggruppamento delle voci
 */

import type { ChecklistItemRow } from '@/modules/bugbay/data/revisione-checklist';

/** Stato di review di una voce (contratto DB): null = "da controllare". */
export type StatoVoce = ChecklistItemRow['status'];

export type FilterType = 'ok' | 'problema' | 'pending' | 'ai_resolved' | 'ai_working';

/** Chiave delle note generali (trasversali) nel record `notes`. */
export const GENERAL_NOTE_KEY = '__general';

/** Chiave della nota libera di una sezione (slug del titolo). */
export function sezKey(sectionTitle: string): string {
  return `__sec_${sectionTitle}`;
}

/** Sezione di campagna: titolo + voci, ricavata raggruppando le righe DB. */
export interface SezioneCampagna {
  title: string;
  order: number;
  items: ChecklistItemRow[];
}

/** Raggruppa le voci per `sectionTitle`, ordinando sezioni e voci per `sectionOrder`. */
export function raggruppaPerSezione(items: ChecklistItemRow[]): SezioneCampagna[] {
  const map = new Map<string, SezioneCampagna>();
  for (const it of items) {
    const sez = map.get(it.sectionTitle);
    if (sez) sez.items.push(it);
    else map.set(it.sectionTitle, { title: it.sectionTitle, order: it.sectionOrder, items: [it] });
  }
  const sezioni = Array.from(map.values());
  for (const s of sezioni) s.items.sort((a, b) => a.sectionOrder - b.sectionOrder);
  sezioni.sort((a, b) => a.order - b.order);
  return sezioni;
}

export interface StatCampagna {
  total: number;
  ok: number;
  issues: number;
  pending: number;
  pct: number;
}

/** Conteggi globali sulle voci (risolti/problemi/in sospeso + % completata). */
export function statByItems(items: ChecklistItemRow[]): StatCampagna {
  let ok = 0, issues = 0;
  for (const it of items) {
    if (it.status === 'ok') ok++;
    else if (it.status === 'problema') issues++;
  }
  const total = items.length;
  const pending = total - ok - issues;
  return { total, ok, issues, pending, pct: total > 0 ? Math.round((ok / total) * 100) : 0 };
}
