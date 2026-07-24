/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * SEGNALI IMPLICITI (v0.8) — TRACK S. Traduce eventi di lifecycle che valgono
 * un giudizio SENZA un voto umano esplicito in righe `scores` (source `IMPLICIT`):
 *  - MERGE del branch auto / "Risolto" ⇒ approvazione IMPLICITA (positiva);
 *  - DISCARD ⇒ segnale NEGATIVO;
 *  - (una REGRESSIONE decisa dal BRT è un discard con `detail` dedicato — la
 *    scrive `recordRegressionSignal` in `signal-watch.ts`, che passa di qui).
 *
 * CONTRATTO (congelato per il fan-out — la firma non cambia):
 *  - Unico writer = `hub.addScore`, il collo di bottiglia dove OGNI verdetto
 *    viene registrato. Poiché `addScore` innesca `onVerdict`, la DISTILLAZIONE
 *    (memoria episodica E / bullet ACE) parte in automatico: S NON aggancia il
 *    hook — basta scrivere lo score.
 *  - PESO (design memo + roadmap): tutti i segnali IMPLICITI pesano 0.25 (la
 *    fiducia della SORGENTE). La POLARITÀ (positivo/negativo) NON sta nel peso ma
 *    nel `verdict` ('merge'/'resolved' = positivi · 'discard' = negativo), così
 *    l'aggregazione a valle decide il segno leggendo il verdetto. Il memo segnava
 *    una tensione (merge potrebbe pesare HUMAN 1.0): risolta a 0.25 — un merge è
 *    un'approvazione IMPLICITA, non un voto umano diretto.
 *  - BEST-EFFORT: un segnale non deve MAI rompere il chiamante (un tick del
 *    watcher, un update di stato). La scrittura è avvolta in try/catch — se la run
 *    non esiste (FK) o lo storage è indisponibile, il segnale si perde in silenzio
 *    invece di propagare (stessa filosofia fire-and-forget di `onVerdict`).
 *
 * @indice
 * - ImplicitSignal       → tipo di segnale implicito
 * - SignalContext        → contesto (report/branch/dettaglio)
 * - recordImplicitSignal → scrive lo score IMPLICIT (innesca la distillazione)
 */

import crypto from 'crypto';
import { addScore, getRunRow } from './hub';

export type ImplicitSignal = 'merge' | 'resolved' | 'discard';

export interface SignalContext {
  reportId?: string | null;
  branch?: string | null;
  detail?: string | null;
}

/** Peso della SORGENTE per ogni verdetto implicito (design memo: IMPLICIT = 0.25). */
const IMPLICIT_WEIGHT = 0.25;

/**
 * Mappa segnale → stringa `verdict` persistita in `scores.verdict`. Whitelist:
 * un segnale fuori dai tre valori congelati è ignorato (no-op difensivo) invece
 * di scrivere un verdetto sconosciuto. I valori coincidono col vocabolario dello
 * schema (`'merge'|'discard'|…`), così i consumatori non traducono.
 */
const VERDICT: Record<ImplicitSignal, string> = {
  merge: 'merge',
  resolved: 'resolved',
  discard: 'discard',
};

/**
 * Registra un segnale implicito come riga `scores` (source `IMPLICIT`, peso 0.25).
 * `hub.addScore` innesca `onVerdict` ⇒ la distillazione (E/A) segue in automatico:
 * S non aggancia nulla al hook.
 *
 * - `report_id` risolto da `ctx.reportId`, altrimenti dalla riga `runs` (getRunRow).
 * - `detail` = JSON compatto `{ signal, branch?, note? }`: dà ai distiller il
 *   contesto (es. quale ramo è stato mergiato, o `note` = "regression: …").
 * - BEST-EFFORT: `runId` vuoto ⇒ no-op; segnale ignoto ⇒ no-op; ogni errore di
 *   scrittura (FK/storage) è inghiottito — un segnale non rompe mai il chiamante.
 */
export function recordImplicitSignal(
  runId: string,
  signal: ImplicitSignal,
  ctx?: SignalContext,
): void {
  if (!runId) return;
  const verdict = VERDICT[signal];
  if (!verdict) return; // segnale fuori contratto: no-op difensivo

  try {
    const reportId = ctx?.reportId ?? getRunRow(runId)?.report_id ?? null;
    const meta: Record<string, string> = { signal };
    if (ctx?.branch) meta.branch = ctx.branch;
    if (ctx?.detail) meta.note = ctx.detail;

    addScore({
      id: crypto.randomUUID(),
      run_id: runId,
      report_id: reportId,
      source: 'IMPLICIT',
      verdict,
      weight: IMPLICIT_WEIGHT,
      detail: JSON.stringify(meta),
    });
  } catch {
    /* un segnale implicito non deve MAI rompere il chiamante (tick del watcher,
       update di stato): se la run non esiste o lo storage è giù, si perde. */
  }
}
