/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Tipi della pipeline di debugging: la segnalazione (SystemReport) e i suoi
 * stati (Aperto → In Lavorazione → In Chiarimento → In Verifica → Risolto).
 *
 * @indice
 * - ReportStatus → stati della pipeline
 * - Attachment   → allegato (immagine/video) di una segnalazione
 * - SystemReport → segnalazione della console
 */

/**
 * Stato della segnalazione nella pipeline unica:
 * Aperto → In Lavorazione → [In Chiarimento] → In Verifica → Risolto (=Chiusa)
 * 'In Verifica' = risoluzione applicata (dall'AI o a mano) in attesa della
 * verifica umana finale; il rifiuto riporta a In Lavorazione.
 */
export type ReportStatus = 'Aperto' | 'In Lavorazione' | 'In Chiarimento' | 'In Verifica' | 'Risolto';

/** Allegato di una segnalazione: screenshot (immagine) o screencast (video). */
export interface Attachment {
  type: 'image' | 'video';
  url: string;
  name: string;
  size: number;
}

export interface SystemReport {
  id: string;
  category: 'Bug' | 'Miglioria Proposta' | 'Nuova Feature';
  priority: 'Bassa' | 'Media' | 'Alta' | 'Urgente' | 'Critica';
  area: string;
  subArea?: string | null;
  url?: string | null;
  notes: string;
  reporterName?: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  developer?: 'alberto' | 'jacopo' | null;
  /** Allegati (screenshot/screencast) della segnalazione. */
  attachments?: Attachment[] | null;
  /** Progetto di origine (valorizzati SOLO nella vista hub multi-progetto). */
  projectId?: string | null;
  projectName?: string | null;
}
