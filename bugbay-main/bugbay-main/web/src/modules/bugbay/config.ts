/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Costanti di dominio della console di debugging (pipeline segnalazioni):
 * aree/sotto-aree del sito, categorie, priorità e stati con le rispettive
 * classi di stile. Unica fonte per pagina, tabella, modali e widget
 * (prima erano duplicate in page.tsx e DebugWidget.tsx).
 *
 * @indice
 * - AREA_SUBAREAS                  → mappa area → sotto-aree
 * - CATEGORIES / PRIORITIES / STATUSES → opzioni della console (con stili)
 * - WIDGET_CATEGORIES / WIDGET_PRIORITIES → varianti del widget flottante
 * - AI_WORKING                     → fasi di una run agentica in lavorazione
 */

import { Clock, Wrench, Sparkles, CheckCircle } from 'lucide-react';

export const AREA_SUBAREAS: Record<string, string[]> = {
  'Sito Pubblico (Showcase)': [
    'Generale',
    'Home Page',
    'Attività',
    'Chi Siamo',
    'Contatti',
    'News / Blog',
    'Sponsor',
    'Trasparenza / Safeguarding'
  ],
  'Pannello Amministrativo (Admin)': [
    'Generale',
    'Dashboard',
    'Comunicazioni / Sponsor / Documenti',
    'Attività',
    'Gestione Utenti / Iscrizioni',
    'Pagamenti',
    'Statistiche / Analytics',
    'Impostazioni Sistema'
  ],
  'Area Riservata': [
    'Generale',
    'Profilo Personale',
    'Iscrizioni Attive',
    'Storico Pagamenti',
    'Certificati Medici'
  ],
  'Generale / Altro': [
    'Autenticazione / Login',
    'Navbar & Navigazione',
    'Problema di Layout',
    'Errore Generico'
  ]
};

export const CATEGORIES = [
  { key: 'Bug', label: 'Bug', color: 'text-red bg-red/10 border-red/20' },
  { key: 'Miglioria Proposta', label: 'Miglioria UX', color: 'text-orange bg-orange/10 border-orange/20' },
  { key: 'Nuova Feature', label: 'Nuova Feature', color: 'text-green bg-green/10 border-green/20' }
] as const;

export const PRIORITIES = [
  { key: 'Bassa', label: 'Bassa', color: 'text-neutral-400 bg-neutral-800/50 border-neutral-700' },
  { key: 'Media', label: 'Media', color: 'text-sky bg-sky/10 border-sky/20' },
  { key: 'Alta', label: 'Alta', color: 'text-orange bg-orange/10 border-orange/20' },
  { key: 'Urgente', label: 'Urgente', color: 'text-red bg-red/10 border-red/20' },
  { key: 'Critica', label: 'Bloccante / Critica', color: 'text-red bg-red/20 border-red/30 font-bold animate-pulse' }
] as const;

export const STATUSES = [
  { key: 'Aperto', label: 'Aperto', color: 'bg-red/10 text-red border-red/20', icon: Clock },
  { key: 'In Lavorazione', label: 'In Lavorazione', color: 'bg-orange/10 text-orange border-orange/20', icon: Wrench },
  { key: 'In Verifica', label: 'In Verifica', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30', icon: Sparkles },
  { key: 'Risolto', label: 'Chiusa', color: 'bg-green/10 text-green border-green/20', icon: CheckCircle }
] as const;

/** Varianti del widget flottante (stili pieni). */
export const WIDGET_CATEGORIES = [
  { key: 'Bug', label: 'Bug', color: 'bg-red text-white border-red-700' },
  { key: 'Miglioria Proposta', label: 'Miglioria UX', color: 'bg-orange text-white border-orange-700' },
  { key: 'Nuova Feature', label: 'Nuova Feature', color: 'bg-green text-white border-green-700' }
] as const;

/** Priorità del widget: `dot` è il colore del pallino indicatore (niente emoji). */
export const WIDGET_PRIORITIES = [
  { key: 'Bassa', label: 'Bassa', dot: 'bg-green' },
  { key: 'Media', label: 'Media', dot: 'bg-amber-400' },
  { key: 'Alta', label: 'Alta', dot: 'bg-orange' },
  { key: 'Urgente', label: 'Urgente', dot: 'bg-red' },
  { key: 'Critica', label: 'Bloccante / Critica', dot: 'bg-red animate-pulse' }
] as const;

/** Fasi di una run agentica considerate "in lavorazione" (poller attivo). */
export const AI_WORKING = ['queued', 'interpreting', 'fixing', 'verifying'];
