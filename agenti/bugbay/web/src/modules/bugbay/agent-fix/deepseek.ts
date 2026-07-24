/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Client API per DeepSeek (100% REST e zero dipendenze). La logica di
 * interpretazione/riformulazione/fix è condivisa con gli altri provider REST
 * in provider-rest.ts: qui vive solo la chiamata HTTP specifica di DeepSeek.
 * Due tier di modello: PRO (deepseek-v4-pro) per i fix complessi, FLASH
 * (deepseek-v4-flash) per i task semplici (interprete, giudice, riformulazione).
 * Override via env. Il thinking di V4 è disattivato (rompe lo structured-output).
 *
 * @indice
 * - DEEPSEEK_PRO / DEEPSEEK_FLASH     → modelli per tier (env-configurabili)
 * - callDeepseek          → chiamata HTTP generica a DeepSeek
 * - deepseekReformulate / deepseekFix → wrapper sul provider condiviso
 */

import { restReformulate, restFix, type RestFixOpts } from './provider-rest';
import { recordUsage } from './telemetry';

/**
 * Modelli per tier (override via env). Default: TUTTO su deepseek-v4-pro (flash
 * non ritenuto affidabile). La struttura a tier resta per poter ridare flash ai
 * task semplici via env, senza toccare il codice:
 *   PRO   (fix complessi)                      ← DEEPSEEK_MODEL_PRO
 *   FLASH (interprete/giudice/riformulazione)  ← DEEPSEEK_MODEL_FLASH (es. deepseek-v4-flash)
 * I legacy `deepseek-chat`/`deepseek-reasoner` sono deprecati dal 2026-07-24.
 */
const DEEPSEEK_PRO = process.env.DEEPSEEK_MODEL_PRO || 'deepseek-v4-pro';
const DEEPSEEK_FLASH = process.env.DEEPSEEK_MODEL_FLASH || 'deepseek-v4-pro';

export async function callDeepseek(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  jsonMode: boolean = false,
  runId?: string,
  model: string = DEEPSEEK_FLASH,
): Promise<string> {
  const url = 'https://api.deepseek.com/chat/completions';

  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      // V4 ha il thinking ON di default: lo disattiviamo. Il thinking rompe lo
      // structured-output (json_object → 400 "reasoning_content…") e aggiunge
      // latenza inutile ai nostri task (JSON deterministici o fix mirati).
      thinking: { type: 'disabled' },
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore API DeepSeek (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // Telemetria: usage = { prompt_tokens, completion_tokens }
  if (data.usage) {
    recordUsage(runId, 'deepseek', {
      inputTokens: data.usage.prompt_tokens ?? 0,
      outputTokens: data.usage.completion_tokens ?? 0,
    });
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Risposta vuota o non valida da DeepSeek.');
  }

  return text;
}

const caller = (apiKey: string, runId?: string, model?: string) =>
  (prompt: string, system?: string, jsonMode?: boolean) => callDeepseek(apiKey, prompt, system, jsonMode ?? false, runId, model);

export async function deepseekReformulate(apiKey: string, report: any, files: string[]): Promise<string> {
  return restReformulate(caller(apiKey), report, files);
}

export async function deepseekFix(
  apiKey: string,
  opts: Omit<RestFixOpts, 'providerName'>,
): Promise<{ ok: boolean; text: string; error?: string }> {
  // Fix = task complesso → tier PRO. Interprete/giudice/riformulazione restano FLASH (default).
  return restFix(caller(apiKey, opts.runId, DEEPSEEK_PRO), { ...opts, providerName: 'DeepSeek' });
}
