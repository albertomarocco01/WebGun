/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * VENDORED — algoritmo dei "session blocks" (finestre da 5h) di ccusage, hash-pinnato.
 *
 * PROVENIENZA: ccusage `src/_session-blocks.ts` — `identifySessionBlocks`
 * (ryoppippi/ccusage, MIT). Re-implementato QUI 1:1 e CONGELATO deliberatamente:
 * il breaker di budget del daemon NON deve dipendere da una dep npm che possa
 * driftare sotto il gate. Contratto identico: blocchi da 5h ancorati all'ORA piena
 * (floor UTC) del primo entry; un nuovo blocco parte se sono passate >5h dall'inizio
 * del blocco OPPURE se c'è un gap >5h dall'ultimo entry (inattività). Aggiornare a
 * mano (bump di VENDOR_PIN) se ccusage cambia l'algoritmo.
 *
 * VENDOR_PIN: ccusage-blocks-v1 (5h session-window, floor-to-hour UTC, gap-split).
 *
 * @indice
 * - VENDOR_PIN            → etichetta di versione dell'algoritmo congelato
 * - SESSION_DURATION_MS   → durata della finestra (5h)
 * - UsageEntry            → entry normalizzato (timestamp + costo/token)
 * - SessionBlock          → blocco aggregato con finestra [start, start+5h)
 * - identifySessionBlocks → partiziona gli entry ordinati in blocchi da 5h
 */

export const VENDOR_PIN = 'ccusage-blocks-v1' as const;

/** Durata della finestra di sessione: 5 ore (algoritmo ccusage). */
export const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

/** Entry normalizzato in ingresso all'algoritmo (già de-duplicato dal chiamante). */
export interface UsageEntry {
  timestampMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Blocco aggregato: finestra fissa [start, start+5h), più i totali degli entry. */
export interface SessionBlock {
  startMs: number;
  endMs: number; // startMs + 5h (reset della finestra)
  actualEndMs: number; // timestamp dell'ultimo entry del blocco
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  entries: number;
}

/** Floor del timestamp all'ora piena in UTC (ancoraggio dei blocchi, come ccusage). */
function floorToHourUtc(ms: number): number {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.getTime();
}

function seal(startMs: number, entries: UsageEntry[]): SessionBlock {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let actualEndMs = startMs;
  for (const e of entries) {
    inputTokens += e.inputTokens;
    outputTokens += e.outputTokens;
    costUsd += e.costUsd;
    if (e.timestampMs > actualEndMs) actualEndMs = e.timestampMs;
  }
  return {
    startMs,
    endMs: startMs + SESSION_DURATION_MS,
    actualEndMs,
    inputTokens,
    outputTokens,
    costUsd,
    entries: entries.length,
  };
}

/**
 * Partiziona gli entry in blocchi da 5h (algoritmo ccusage). Ordina per timestamp,
 * poi accumula finché non scatta un confine (>5h dall'inizio blocco o gap >5h
 * dall'ultimo entry): a quel punto sigilla il blocco e ne apre uno nuovo ancorato
 * all'ora piena del primo entry successivo.
 */
export function identifySessionBlocks(input: UsageEntry[]): SessionBlock[] {
  if (input.length === 0) return [];
  const sorted = [...input].sort((a, b) => a.timestampMs - b.timestampMs);
  const blocks: SessionBlock[] = [];
  let blockStart: number | null = null;
  let bucket: UsageEntry[] = [];
  for (const entry of sorted) {
    if (blockStart === null) {
      blockStart = floorToHourUtc(entry.timestampMs);
      bucket = [entry];
      continue;
    }
    const sinceStart = entry.timestampMs - blockStart;
    const last = bucket[bucket.length - 1];
    const sinceLast = entry.timestampMs - last.timestampMs;
    if (sinceStart > SESSION_DURATION_MS || sinceLast > SESSION_DURATION_MS) {
      blocks.push(seal(blockStart, bucket));
      blockStart = floorToHourUtc(entry.timestampMs);
      bucket = [entry];
    } else {
      bucket.push(entry);
    }
  }
  if (blockStart !== null && bucket.length) blocks.push(seal(blockStart, bucket));
  return blocks;
}
