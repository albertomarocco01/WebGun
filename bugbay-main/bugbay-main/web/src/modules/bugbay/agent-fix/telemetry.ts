/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Telemetria del fix agentico: stima dei costi per provider e registrazione
 * dei token sulla run. Si ottimizza solo ciò che si misura: ogni chiamata LLM
 * passa da qui prima di essere accumulata nello store.
 *
 * @indice
 * - LlmUsage     → token di una singola chiamata
 * - costForUsd   → stima costo in USD (prezzi indicativi per 1M token)
 * - recordUsage  → accumula la chiamata sulla telemetria della run
 */

import { addUsage } from './store';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Prezzi indicativi USD per 1M token (input, output). Aggiornare se cambiano. */
const PRICING: Record<string, { in: number; out: number }> = {
  'gemini': { in: 0.30, out: 2.50 },     // gemini-2.5-flash
  'deepseek': { in: 0.27, out: 1.10 },   // deepseek-chat
};

export function costForUsd(provider: string, usage: LlmUsage): number {
  const p = PRICING[provider];
  if (!p) return 0;
  return (usage.inputTokens / 1_000_000) * p.in + (usage.outputTokens / 1_000_000) * p.out;
}

/**
 * Registra una chiamata LLM sulla run. `costUsd` esplicito (es. dall'envelope
 * della CLI claude) ha precedenza sulla stima da listino.
 */
export function recordUsage(runId: string | undefined, provider: string, usage: LlmUsage, costUsd?: number): void {
  if (!runId) return;
  addUsage(runId, {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: costUsd ?? costForUsd(provider, usage),
  });
}
