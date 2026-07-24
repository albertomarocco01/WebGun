/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Client REST per l'API Anthropic (Messages API, zero dipendenze) — usato come
 * fast-path opzionale per i task di SOLO testo (riformulazioni, giudice) quando
 * nelle impostazioni è configurata una API key: salta il boot della CLI claude
 * (~6-10s) e risponde in ~1-3s con Haiku. Le run di fix continuano a usare la
 * CLI headless (serve l'editing dei file).
 *
 * @indice
 * - callAnthropic → chiamata HTTP generica alla Messages API (Haiku)
 */

import { recordUsage } from './telemetry';

const ANTHROPIC_VERSION = '2023-06-01';
const MODEL_TEXT = 'claude-haiku-4-5';

export async function callAnthropic(
  apiKey: string,
  prompt: string,
  system?: string,
  runId?: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL_TEXT,
      max_tokens: 2048,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    // Envelope d'errore: { type: "error", error: { type, message } }
    const errText = await response.text();
    let message = errText;
    try { message = JSON.parse(errText)?.error?.message ?? errText; } catch { /* testo grezzo */ }
    throw new Error(`Errore API Anthropic (${response.status}): ${message}`);
  }

  const data = await response.json();

  if (data.usage) {
    recordUsage(runId, 'claude', {
      inputTokens: (data.usage.input_tokens ?? 0)
        + (data.usage.cache_read_input_tokens ?? 0)
        + (data.usage.cache_creation_input_tokens ?? 0),
      outputTokens: data.usage.output_tokens ?? 0,
    });
  }

  const text = Array.isArray(data.content)
    ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
    : '';
  if (!text.trim()) {
    throw new Error('Risposta vuota o non valida dall\'API Anthropic.');
  }
  return text;
}
