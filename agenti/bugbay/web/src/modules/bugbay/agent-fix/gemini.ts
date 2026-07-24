/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Client API per Gemini (100% REST e zero dipendenze). La logica di
 * interpretazione/riformulazione/fix è condivisa con gli altri provider REST
 * in provider-rest.ts: qui vive solo la chiamata HTTP specifica di Gemini.
 *
 * @indice
 * - callGemini          → chiamata HTTP generica a Gemini
 * - geminiReformulate / geminiFix → wrapper sul provider condiviso
 */

import { restReformulate, restFix, type RestFixOpts } from './provider-rest';
import { recordUsage } from './telemetry';

export async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  jsonMode: boolean = false,
  runId?: string,
): Promise<string> {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      generationConfig: {
        temperature: 0.1,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore API Gemini (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // Telemetria: usageMetadata = { promptTokenCount, candidatesTokenCount }
  const um = data.usageMetadata;
  if (um) {
    recordUsage(runId, 'gemini', {
      inputTokens: um.promptTokenCount ?? 0,
      outputTokens: (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0),
    });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Risposta vuota o non valida da Gemini.');
  }

  return text;
}

const caller = (apiKey: string, runId?: string) =>
  (prompt: string, system?: string, jsonMode?: boolean) => callGemini(apiKey, prompt, system, jsonMode ?? false, runId);

export async function geminiReformulate(apiKey: string, report: any, files: string[]): Promise<string> {
  return restReformulate(caller(apiKey), report, files);
}

export async function geminiFix(
  apiKey: string,
  opts: Omit<RestFixOpts, 'providerName'>,
): Promise<{ ok: boolean; text: string; error?: string }> {
  return restFix(caller(apiKey, opts.runId), { ...opts, providerName: 'Gemini' });
}
