/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Notifica di fine run AUTONOMA via webhook generico (F3). No-op se non
 * configurato (BUGBAY_NOTIFY_WEBHOOK vuoto): l'autonomia resta usabile senza.
 * Il body porta sia `text` (Slack/Mattermost) sia `content` (Discord), così un
 * solo POST copre i webhook più comuni senza integrazioni per-provider (Telegram
 * richiede il suo bot-API con chat_id → fuori scope, si usa un bridge se serve).
 *
 * @indice
 * - AutoOutcome        → esito di una run autonoma
 * - notifyAutonomous   → POST del riepilogo al webhook (best-effort)
 */

import { notifyWebhook } from './autonomy';
import type { AgentRun } from './types';

export type AutoOutcome =
  | 'committed-alta'   // fix committato sul branch, confidence alta → pronto da mergere
  | 'committed-bassa'  // fix committato sul branch, ma DA CONTROLLARE (confidence bassa)
  | 'gate-fail'        // gate tsc/eslint rosso → nessun commit, da controllare a mano
  | 'clarify'          // segnalazione vaga → serve un chiarimento umano
  | 'error'            // errore della run autonoma
  | 'worktree-fail';   // worktree isolato non creato

const LABELS: Record<AutoOutcome, string> = {
  'committed-alta': '✅ Auto-fix pronto (confidence alta)',
  'committed-bassa': '⚠️ Auto-fix DA CONTROLLARE',
  'gate-fail': '❌ Gate fallito — nessun commit',
  'clarify': '❓ Segnalazione vaga — serve chiarimento',
  'error': '💥 Errore run autonoma',
  'worktree-fail': '💥 Worktree isolato non creato',
};

/** Invia il riepilogo di una run autonoma al webhook, se configurato (best-effort). */
export async function notifyAutonomous(run: AgentRun, outcome: AutoOutcome, branch?: string): Promise<void> {
  const url = notifyWebhook();
  if (!url) return; // disattivato: niente notifica
  const titolo = (run.problema ?? run.reportTitolo ?? run.reportId).split('\n')[0].slice(0, 120);
  const msg = `BugBay · ${LABELS[outcome]}\n• ${titolo}${branch ? `\n• branch: ${branch}` : ''}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: msg, content: msg }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error('[bugbay] notify webhook:', e instanceof Error ? e.message : e);
  }
}
