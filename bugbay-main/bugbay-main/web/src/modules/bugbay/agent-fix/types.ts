/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Tipi condivisi del sistema di fix agentico (MVP). Una "run" rappresenta il
 * tentativo dell'agente di risolvere una singola segnalazione, con le sue fasi.
 *
 * @indice
 * - RunPhase     → fase corrente della run
 * - FileChange   → file modificato dall'agente
 * - AgentRun     → stato completo di una run
 */

/** Telemetria token/costo accumulata da tutte le chiamate LLM di una run. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  /** Numero di chiamate LLM effettuate. */
  calls: number;
  /** Costo stimato in USD (prezzi indicativi per provider). */
  costUsd: number;
}

/**
 * Evento della timeline osservabile di una run: cosa è successo, in quale
 * stadio, con quale simbolo. Vocabolario simboli:
 * 📥 ingest · ✨ riformula · 🧠 interprete · 🔍 scope · 📏 baseline · 🔧 fixer ·
 * 🛡 guard · 🧪 gate · ⚖️ giudice · ♻️ repair · ⬆️ escalation · 🗺 piano ·
 * ✅ ok · ❌ fail · ⏸ attesa
 */
export interface TimelineEvent {
  ts: string;      // ISO
  sym: string;     // simbolo del vocabolario
  stage: string;   // 'scope' | 'interprete' | 'fixer' | 'gate' | 'giudice' | ...
  msg: string;
  /** Durata dello step in ms, quando misurabile. */
  ms?: number;
  /** Modello usato nello step, quando rilevante. */
  model?: string;
}

/** Verdetto del Giudice sui criteri di accettazione. */
export interface RunVerdict {
  soddisfatto: boolean;
  /** Cosa manca, se non soddisfatto (alimenta il repair mirato). */
  gap?: string;
  criteri: { criterio: string; ok: boolean }[];
}

export type RunPhase =
  | 'queued'              // in coda di attesa per esecuzione sequenziale
  | 'interpreting'        // l'Interprete (Haiku) sta analizzando la segnalazione
  | 'needs_clarification' // segnalazione vaga: attende una risposta dell'utente
  | 'fixing'              // il Fixer (Opus 4.8) sta modificando il codice
  | 'verifying'           // gate tsc in corso
  | 'review'             // pronto per la tua revisione (Approva / Rifiuta)
  | 'paused'             // in pausa (manualmente o dopo riavvio)
  | 'approved'
  | 'discarded'
  | 'aborted'            // interrotto dall'utente
  | 'error';

export interface FileChange {
  path: string;       // relativo al project root
  area?: string;      // rotta/area navigabile, se derivabile dal path
}

/** Una segnalazione presa in carico da una run (le run batch ne hanno più di una). */
export interface RunReport {
  reportId: string;
  titolo: string;
  url?: string | null;
  /** Problema riscritto dall'Interprete per questa segnalazione. */
  problema?: string;
  criteri?: string[];
  /** Domanda di chiarimento, se questa segnalazione è vaga. */
  domanda?: string;
  /** Accettata individualmente nella review (accept granulare dei batch). */
  accepted?: boolean;
}

export interface AgentRun {
  runId: string;
  /** Segnalazione principale (compatibilità: per le run batch è la prima). */
  reportId: string;
  reportTitolo: string;
  reportUrl?: string | null;
  /** Tutte le segnalazioni della run (1 per le run singole, N per le batch). */
  reports?: RunReport[];
  branch: string;
  sessionId?: string;   // session id della CLI claude, per --resume nei rilanci
  phase: RunPhase;
  /** Problema riscritto dall'Interprete (per le batch: problemi concatenati). */
  problema?: string;
  criteri?: string[];
  /** Domanda di chiarimento se la segnalazione è troppo vaga. */
  domanda?: string;
  /** File candidati scopati (deterministico + graphify). */
  scopedFiles: string[];
  /** File già sporchi PRIMA del fix (mai toccati da guard/restore). */
  preDirty?: string[];
  /** Chiarimenti forniti dall'utente (forzano la reinterpretazione). */
  chiarimento?: string;
  /** Feedback del rifiuto in attesa di rilancio (consumato dal dispatcher). */
  rejectFeedback?: string;
  /** Riassunto in linguaggio naturale di cosa ha fatto il Fixer. */
  riassunto?: string;
  /** File effettivamente modificati. */
  modifiche: FileChange[];
  /** Diff testuale (git). */
  diff?: string;
  tscOk?: boolean;
  tscOutput?: string;
  log: string[];
  /** Attività live dell'agente durante il fix (ragionamento/file correnti, da stream-json). */
  live?: string;
  error?: string;
  /** Provider AI della run. Le API key NON vengono mai persistite nella run. */
  provider?: string;
  fixPrompt?: string;   // prompt salvato per consentire il resume
  createdAt: string;
  /** Telemetria: token, chiamate e costo stimato. */
  usage?: RunUsage;
  /** Tentativi di fix/repair effettuati. */
  attempts?: number;
  /** Verdetto del Giudice sui criteri di accettazione. */
  verdict?: RunVerdict;
  /** Risolto senza LLM da un codemod deterministico (0 token). */
  codemod?: boolean;
  /** File già committati all'accettazione (commit unico, anche nei batch). */
  committed?: boolean;
  /** project_id delle segnalazioni della run: instrada il fix al repo giusto (hub multi-repo). */
  projectId?: string | null;
  /** Complessità stimata dall'Interprete: pilota il routing del modello Fixer. */
  complessita?: 'banale' | 'media' | 'alta';
  /** Tipo di task dalla categoria della segnalazione: seleziona il profilo agente (bug-fixer/ux-improver/feature-builder). */
  tipoTask?: 'bug' | 'miglioria' | 'feature';
  /** Test di riproduzione fail-to-pass (BRT): confirmed = falliva pre-fix; pass/fail = esito post-fix; invalid = scartato (non riproduceva). */
  reproTest?: { path: string; status: 'confirmed' | 'invalid' | 'pass' | 'fail' };
  /** Categoria tecnica stimata dall'Interprete: pilota i tool hint (playwright/supabase/...). */
  categoriaTecnica?: string;
  /** Modello usato dal Fixer in questa run (routing multi-modello). */
  fixModel?: string;
  /** Escalation ladder: il fix è stato riprovato con il modello superiore. */
  escalated?: boolean;
  /** Esito del gate comportamentale (npm test) quando auto-rilevato. */
  testGate?: 'pass' | 'fail' | 'skipped';
  /** Timeline osservabile della run (eventi simbolici tipizzati). */
  timeline?: TimelineEvent[];
  /** Run AUTONOMA (F3): eseguita in un worktree isolato, non nel working tree. */
  autonomous?: boolean;
  /** Ramo isolato dove il fix autonomo è stato committato (deliverable da mergere). */
  autoBranch?: string;
  startedAt?: string;
  finishedAt?: string;
}
