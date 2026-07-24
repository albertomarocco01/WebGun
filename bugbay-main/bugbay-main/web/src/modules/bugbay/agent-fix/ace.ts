/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * DISTILLER ACE (v0.8, TRACK A) — a ogni VERDETTO distilla un bullet semantico
 * COMPATTO e riusabile nella base di conoscenza (`.bugbay/knowledge/*.md`) e lo
 * committa sotto identità bot. Registrato su `onVerdict` via `registerDistiller`;
 * la registrazione è agganciata dal barile `./distill-register` (l'UNICA riga che
 * TRACK A aggiunge lì) — né `distill.ts` né `hub.ts` vengono toccati.
 *
 * SCELTE (load-bearing):
 *  - DETERMINISTICO: il bullet è estratto dai campi già strutturati della run
 *    (problema, riassunto, file toccati, verdetto) — nessuno spawn LLM per verdetto
 *    (costo/latenza/non-determinismo evitati). La distillazione è pura e testabile.
 *  - FILTRO: `onVerdict` scatta per OGNI score; qui distilliamo SOLO i verdetti a
 *    polarità chiara (approvato/merge/risolto = positivo, scartato/fail = negativo).
 *    Verdetti intermedi/ignoti → skip.
 *  - BEST-EFFORT & SERIALIZZATO: ogni distillazione gira in una coda a mutex
 *    (una scrittura+commit git per volta, per evitare le race su index.lock) ed è
 *    interamente avvolta: un errore non deve MAI propagare (già swallow in onVerdict).
 *
 * @indice
 * - polarity     → mappa il verdetto grezzo a positivo/negativo (o null = skip)
 * - buildBullet  → costruisce il bullet dai dati della run + verdetto
 * - aceDistiller → il distiller registrato su onVerdict (registrazione a fondo file)
 */

import { registerDistiller, type Distiller, type VerdictContext } from './distill';
import { getRunRow } from './hub';
import { writeBullet, commitKnowledge, type KnowledgeBullet } from './knowledge';
import { verdictPolarity } from './verdict-polarity';
import type { AgentRun } from './types';

/**
 * GATE ANTI-POISONING (fix concilio F7): la scrittura dei bullet ACE committa
 * markdown nel working tree del repo, che il Fixer può LEGGERE via Grep/shell —
 * bypassando il gate `BUGBAY_RETRIEVAL`. Poiché i bullet oggi non hanno consumatore
 * (superficie write-only + rischio), la scrittura è OPT-IN esplicito, default OFF.
 */
function knowledgeCommitEnabled(): boolean {
  return process.env.BUGBAY_KNOWLEDGE_COMMIT === '1';
}

/** Riga `runs` → AgentRun (best-effort; null se assente/non parsabile). */
function parseRun(runId: string): { row: ReturnType<typeof getRunRow>; run: Partial<AgentRun> | null } {
  const row = getRunRow(runId);
  if (!row) return { row: undefined, run: null };
  try {
    return { row, run: JSON.parse(row.data) as Partial<AgentRun> };
  } catch {
    return { row, run: null };
  }
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs.filter((s) => typeof s === 'string' && s.trim().length > 0)));
}

/** Corpo markdown compatto del bullet. */
function renderInsight(
  outcome: 'positive' | 'negative',
  problem: string,
  summary: string,
  files: string[],
): string {
  const lines: string[] = [`**Quando:** ${problem.trim()}`];
  if (outcome === 'positive') {
    lines.push(`**Fix che ha funzionato:** ${summary || '(nessun riassunto)'}`);
  } else {
    lines.push(`**Da evitare (fix scartato):** ${summary || '(nessun riassunto)'}`);
  }
  if (files.length) lines.push(`**File:** ${files.map((f) => `\`${f}\``).join(', ')}`);
  return lines.join('\n\n');
}

/** Costruisce il bullet dai dati della run + verdetto, o null se non c'è nulla da ricordare. */
function buildBullet(
  runId: string,
  verdict: VerdictContext,
  outcome: 'positive' | 'negative',
): KnowledgeBullet | null {
  const { row, run } = parseRun(runId);
  const problem = (run?.problema || run?.reportTitolo || verdict.detail || '').trim();
  if (!problem) return null; // niente di riusabile da distillare

  const summary = (run?.riassunto ?? '').trim();
  const files = dedupe((run?.modifiche ?? []).map((m) => m.path)).slice(0, 20);
  const project = (run?.projectId || row?.project_id || 'general').trim() || 'general';
  const report = verdict.reportId ?? run?.reportId ?? row?.report_id ?? null;
  const tags = dedupe([run?.tipoTask, run?.categoriaTecnica, run?.complessita].filter(
    (t): t is string => typeof t === 'string',
  ));

  return {
    // Id deterministico per-run → filename stabile: un run con più score sovrascrive
    // il proprio bullet (latest-wins) invece di accumularne duplicati.
    id: `ace-${runId}`,
    project,
    report,
    run: runId,
    verdict: verdict.verdict,
    source: verdict.source,
    outcome,
    files,
    tags,
    created: new Date().toISOString(),
    insight: renderInsight(outcome, problem, summary, files),
  };
}

// Coda a mutex (promise-chain) su `global`: le callback `setImmediate` di
// `onVerdict` possono sovrapporsi e `git add/commit` non è concorrenza-safe
// (index.lock). Serializziamo scrittura+commit una alla volta. Su global per
// sopravvivere agli hot-reload del dev server (una `let` di modulo perderebbe la coda).
const gq = global as unknown as { __bugbay_ace_queue__?: Promise<void> };
function enqueue(task: () => void): Promise<void> {
  const prev = gq.__bugbay_ace_queue__ ?? Promise.resolve();
  const next = prev.then(() => { try { task(); } catch { /* best-effort */ } });
  gq.__bugbay_ace_queue__ = next;
  return next;
}

/**
 * Distiller ACE: filtra sulla polarità del verdetto, costruisce il bullet, lo
 * scrive (quarantena in scrittura dentro `writeBullet`) e committa la conoscenza
 * sotto identità bot. Tutto best-effort e serializzato.
 */
const aceDistiller: Distiller = (runId, verdict) => {
  if (!knowledgeCommitEnabled()) return; // F7: scrittura bullet OPT-IN (default OFF)
  const outcome = verdictPolarity(verdict.verdict);
  if (!outcome) return; // solo verdetti a polarità chiara diventano memoria
  void enqueue(() => {
    const bullet = buildBullet(runId, verdict, outcome);
    if (!bullet) return;
    const written = writeBullet(bullet); // null se malformato (quarantena) o errore
    if (!written) return;
    const label = bullet.report ? ` ${bullet.report}` : '';
    commitKnowledge(`memoria(ace): ${bullet.project} ${bullet.verdict}${label}`.trim());
  });
};

// Registrazione idempotente (Map globale name-keyed, hot-reload safe) al load del
// modulo — cioè quando `./distill-register` lo importa a solo effetto.
registerDistiller('ace', aceDistiller);
