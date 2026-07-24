/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Invocazione headless della CLI `claude` (riusa il login locale, niente API key).
 * Espone tre operazioni: interpret (Haiku, output JSON), fix (Opus 4.8, edita i
 * file con permessi limitati) e resume (rilancio guidato dal feedback utente).
 * Il Fixer gira in `--output-format stream-json`: gli eventi (ragionamento +
 * tool_use) vengono parsati live e riversati nel run (`live` + traccia dei file
 * toccati nel log), così una run lunga non è più opaca. In parallelo il parser
 * (TRACK A) registra lo stream come observations sulla spina `hub`: ogni turno
 * assistant → span 'llm' (model/token), ogni tool_use → span 'tool' figlio del
 * turno, chiuso dal relativo tool_result con esito/durata; prompt/diff/output
 * pesanti finiscono in `observation_bodies` ed emette obs.started/obs.ended.
 * Interprete/giudice/riformulazioni restano `json` single-shot (sono rapidi).
 *
 * @indice
 * - ClaudeResult   → esito di una run headless
 * - runHeadless    → spawn generico di `claude -p` (streaming per il Fixer)
 * - MODEL_HAIKU / MODEL_SONNET / MODEL_OPUS (ri-esportate da ./routing)
 */

import { targetRoot } from './target-root';
import { spawn, type ChildProcess } from 'child_process';
import { resolveClaudeBin } from './exec';
import { scopeGuardSettingsPath } from './scope-guard';
import { resolveGuardForRoot } from './registry';
import { registerChild, unregisterChild } from './process-registry';
import { recordUsage } from './telemetry';
import { getRun, updateRun } from './store';
import {
  appendObservation,
  appendObservationBody,
  appendObsEvent,
  transact,
  type ObservationInput,
} from './hub';
import crypto from 'crypto';
import type { AgentRun } from './types';

// Fonte di verità unica in routing.ts; ri-esportate qui per gli importatori
// esistenti (runner.ts, checklist-refresh.ts, esecuzione.ts) che le prendono
// da './claude'. La scelta del modello per fase vive in routing.chooseModel.
export { MODEL_HAIKU, MODEL_SONNET, MODEL_OPUS } from './routing';

/** Processi vivi per run, per poter interrompere (abort). */
const liveChildren = new Map<string, Set<ChildProcess>>();

export function killRun(runId: string): void {
  const set = liveChildren.get(runId);
  if (set) {
    for (const c of set) { try { c.kill('SIGKILL'); } catch { /* già morto */ } }
    liveChildren.delete(runId);
  }
}

export function isAborted(runId: string): boolean {
  return liveChildren.has(`__aborted__${runId}`);
}
export function markAborted(runId: string): void {
  liveChildren.set(`__aborted__${runId}`, new Set());
}
export function clearAborted(runId: string): void {
  liveChildren.delete(`__aborted__${runId}`);
}

export interface ClaudeResult {
  ok: boolean;
  text: string;          // testo finale dell'assistente (campo result)
  sessionId?: string;
  raw?: string;
  error?: string;
}

interface HeadlessOpts {
  prompt: string;
  model: string;
  /** Permette all'agente di editare i file (per il Fixer). Attiva lo streaming live. */
  allowEdits?: boolean;
  /** Riprende una sessione esistente (per i rilanci col feedback). */
  resumeSessionId?: string;
  timeoutMs?: number;
  /** Id della run, per registrare il processo e poterlo interrompere. */
  runId?: string;
  /**
   * Modalità testo puro (riformulazioni, giudice): niente tools, niente
   * --add-dir e un system prompt minimo al posto di quello di default della
   * CLI (molto grande) — risposta single-shot, parecchio più rapida.
   */
  textMode?: { systemPrompt: string };
}

/**
 * Env sanificato per la CLI figlia: usa SEMPRE il login locale dell'utente.
 * Se il dev server è stato avviato da una sessione Claude Code, l'ambiente
 * eredita ANTHROPIC_API_KEY (chiave di sessione non valida per altri usi) e i
 * marker di sessione annidata: la CLI li preferirebbe al login → 401.
 */
function cleanChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.CLAUDE_CODE_CHILD_SESSION;
  delete env.CLAUDE_CODE_SSE_PORT;
  return env;
}

/** Descrive un tool_use della CLI in una riga leggibile per il log/attività live. */
function describeTool(name: string, input: unknown): string {
  const o = (input ?? {}) as Record<string, unknown>;
  if (typeof o.file_path === 'string') return `${name} ${o.file_path.split(/[\\/]/).pop()}`;
  if (typeof o.command === 'string') return `Bash: ${o.command.slice(0, 80)}`;
  if (typeof o.pattern === 'string') return `${name} "${o.pattern.slice(0, 40)}"`;
  return name || 'tool';
}

export function runHeadless(opts: HeadlessOpts): Promise<ClaudeResult> {
  // NB: --allowedTools e --add-dir sono variadici → il prompt NON va passato come
  // argomento posizionale (verrebbe inghiottito). Lo passiamo via stdin. Gli
  // allowedTools sono passati come elementi argv separati (così i pattern B(...)
  // con spazi restano integri).
  // Streaming live (run.live + traccia file) SOLO per il Fixer: le run di editing
  // sono lunghe e altrimenti opache. Interprete/giudice/testo restano json.
  const streaming = !!opts.allowEdits;
  const args = ['-p', '--output-format', streaming ? 'stream-json' : 'json', '--model', opts.model];
  if (streaming) args.push('--verbose'); // richiesto da stream-json in print mode
  if (opts.textMode) {
    args.push('--no-session-persistence', '--system-prompt', opts.textMode.systemPrompt);
  } else {
    // SICUREZZA (P0): il Fixer autonomo NON ha alcun tool Bash/shell — né graphify.
    // Un grant Bash, anche ristretto a un sottocomando, è una superficie RCE
    // (quoting/pattern bypassabili). Solo Edit/Read/Grep, in entrambe le modalità.
    const tools = opts.allowEdits ? ['Edit', 'Read', 'Grep'] : ['Read', 'Grep'];
    args.push('--add-dir', targetRoot());
    if (opts.allowEdits) {
      args.push('--permission-mode', 'acceptEdits');
      // Guard PREVENTIVO (P0): hook PreToolUse che nega Edit/Write fuori writeScope o
      // su file sensibili, PRIMA che accadano (non solo il revert post-hoc). DEVE essere
      // SEMPRE installato sotto acceptEdits: senza, l'agente potrebbe editare qualsiasi
      // path fuori dalla radice (file sensibili, altri repo, home). L'invariante duro è
      // il root containment su BUGBAY_TARGET_ROOT (impostato incondizionatamente più sotto).
      // Se il guard non è installabile → FAIL-CLOSED: annulla la run, MAI eseguire
      // acceptEdits senza guard (né degradare a un permission-mode che si bloccherebbe
      // headless in attesa di conferma).
      const guardSettings = scopeGuardSettingsPath();
      if (!guardSettings) {
        return Promise.resolve({
          ok: false, text: '',
          error: 'Guard di scope non installabile: run di editing annullata (fail-closed).',
        });
      }
      args.push('--settings', guardSettings);
    }
    args.push('--allowedTools', ...tools);
    if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  }

  // Risolve la CLI in modo cross-platform (su Windows gli shim .cmd non sono
  // spawnabili senza shell: vengono eseguiti via Node sul cli.js sottostante).
  const bin = resolveClaudeBin();
  if (!bin) {
    return Promise.resolve({
      ok: false, text: '',
      error: 'CLI claude non trovata. Installala (npm i -g @anthropic-ai/claude-code) o imposta CLAUDE_BIN in .env.local con il percorso completo.',
    });
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    // Guard confinato alla radice ATTIVA (worktree autonomo o repo multi-repo diverso
    // da quello del daemon), non a quella STATICA dell'env: senza, il guard negherebbe
    // gli edit nel worktree (`.bugbay/worktrees/…/src` non matcha `src/**`) e in un repo
    // diverso dal daemon. Lo scope del repo proprietario è risolto dal registro; se il
    // repo non è registrato, resta il perimetro dall'env del daemon (comportamento legacy).
    const childEnv = cleanChildEnv();
    if (opts.allowEdits) {
      const activeRoot = targetRoot();
      childEnv.BUGBAY_TARGET_ROOT = activeRoot;
      const g = resolveGuardForRoot(activeRoot);
      if (g) {
        childEnv.BUGBAY_WRITE_SCOPE = JSON.stringify(g.writeScope);
        childEnv.BUGBAY_SENSITIVE_FILES = JSON.stringify(g.sensitiveFiles);
      }
    }
    const child = spawn(bin.cmd, [...bin.prefixArgs, ...args], { cwd: targetRoot(), env: childEnv });

    // Registra il processo per l'eventuale interruzione
    if (opts.runId) {
      if (!liveChildren.has(opts.runId)) liveChildren.set(opts.runId, new Set());
      liveChildren.get(opts.runId)!.add(child);
    }
    // Registro PERSISTENTE (sopravvive al riavvio del daemon): il reaper allo
    // startup uccide questo processo se resta orfano dopo un crash.
    registerChild(child.pid, bin.cmd, opts.runId ?? '');
    const unregister = () => {
      unregisterChild(child.pid);
      if (opts.runId) liveChildren.get(opts.runId)?.delete(child);
    };

    // Prompt via stdin
    child.stdin.write(opts.prompt);
    child.stdin.end();
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, text: '', error: 'Timeout della run agentica.' });
    }, opts.timeoutMs ?? 5 * 60_000);

    /* ── Streaming live (Fixer): aggiorna run.live + log dei file toccati ── */
    let buf = '';
    let resultEnv: Record<string, any> | null = null;
    let pendingLive: string | undefined;
    const pendingLog: string[] = [];
    let lastFlush = 0;
    let lastLogged = '';
    // Flush throttolato (≥1.2s): una sola scrittura su disco per finestra, per non
    // martellare lo store a ogni evento (e attenuare la race read-modify-write).
    const flushLive = (force = false): void => {
      if (!opts.runId) return;
      if (pendingLive === undefined && pendingLog.length === 0) return;
      const now = Date.now();
      if (!force && now - lastFlush < 1200) return;
      lastFlush = now;
      const run = getRun(opts.runId);
      const patch: Partial<AgentRun> = {};
      if (pendingLive !== undefined) { patch.live = pendingLive; pendingLive = undefined; }
      if (pendingLog.length && run) { patch.log = [...run.log, ...pendingLog]; pendingLog.length = 0; }
      updateRun(opts.runId, patch);
    };

    /* ── TRACK A: parser stream-json → observations sulla spina (hub) ─────────
       Ogni turno `assistant` = span 'llm' (model + token). Ogni `tool_use` di quel
       turno = span 'tool' figlio (parent_id = id del turno), chiuso dal relativo
       `tool_result` (evento `user` successivo) con esito/durata. Prompt/diff/output
       pesanti → observation_bodies. INSERT-before-emit: la riga è scritta e POI si
       emette obs.started/obs.ended (nella stessa transact). Best-effort: un errore
       di traccia non deve MAI rompere la run del Fixer (try/catch che inghiotte).
       Nota: senza un helper di UPDATE sulle observations, gli span 'tool' vengono
       bufferizzati e inseriti UNA volta al completamento (started_at + ended_at
       insieme), così la riga è già chiusa quando emettiamo gli eventi. */
    let lastActivityMs = Date.now();
    interface PendingTool { obsId: string; parentId: string; name: string; inputBody: string; startedIso: string; startedMs: number; }
    const pendingTools = new Map<string, PendingTool>();
    const obsBody = (v: unknown): string => {
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    };
    const toolResultText = (c: unknown): string => {
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        return c
          .map((b: any) => (b && typeof b === 'object' && typeof b.text === 'string' ? b.text : obsBody(b)))
          .join('\n');
      }
      return c == null ? '' : obsBody(c);
    };
    const recordObs = (
      o: ObservationInput,
      body: string | undefined,
      emitEnded: boolean,
      evPayload: Record<string, unknown>,
    ): void => {
      try {
        transact(() => {
          appendObservation(o);
          if (body) appendObservationBody(o.id, body);
          appendObsEvent(o.run_id, 'started', o.id, evPayload);
          if (emitEnded) appendObsEvent(o.run_id, 'ended', o.id, evPayload);
        });
      } catch { /* osservabilità best-effort: mai rompere la run per la traccia */ }
    };
    const recordLlmTurn = (env: Record<string, any>, runId: string): string => {
      const nowMs = Date.now();
      const msg = (env.message ?? {}) as Record<string, any>;
      const usage = (msg.usage ?? {}) as Record<string, any>;
      const model = typeof msg.model === 'string' ? msg.model : opts.model;
      const inTok =
        (usage.input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0);
      const outTok = usage.output_tokens ?? 0;
      const texts: string[] = [];
      if (Array.isArray(msg.content)) {
        for (const b of msg.content as Array<Record<string, any>>) {
          if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) texts.push(b.text.trim());
        }
      }
      const id = crypto.randomUUID();
      recordObs(
        {
          id, run_id: runId, span_kind: 'llm', name: model, model, status: 'ok',
          input_tokens: inTok || null, output_tokens: outTok || null,
          started_at: new Date(lastActivityMs).toISOString(), ended_at: new Date(nowMs).toISOString(),
          ms: Math.max(0, nowMs - lastActivityMs),
        },
        texts.join('\n\n') || undefined,
        true,
        { span_kind: 'llm', model, input_tokens: inTok, output_tokens: outTok },
      );
      lastActivityMs = nowMs;
      return id;
    };
    const bufferTool = (parentId: string, block: Record<string, any>, name: string): void => {
      const useId = typeof block.id === 'string' && block.id ? block.id : crypto.randomUUID();
      pendingTools.set(useId, {
        obsId: crypto.randomUUID(), parentId, name,
        inputBody: obsBody(block.input),
        startedIso: new Date().toISOString(), startedMs: Date.now(),
      });
    };
    const completeTool = (block: Record<string, any>): void => {
      const runId = opts.runId;
      if (!runId) return;
      const useId = String(block.tool_use_id ?? '');
      const pt = pendingTools.get(useId);
      if (!pt) return;
      pendingTools.delete(useId);
      const endMs = Date.now();
      const isErr = block.is_error === true;
      const resText = toolResultText(block.content);
      const body = resText ? `${pt.inputBody}\n\n--- result ---\n${resText}` : pt.inputBody;
      recordObs(
        {
          id: pt.obsId, run_id: runId, parent_id: pt.parentId, span_kind: 'tool', name: pt.name,
          status: isErr ? 'error' : 'ok', started_at: pt.startedIso, ended_at: new Date(endMs).toISOString(),
          ms: Math.max(0, endMs - pt.startedMs),
        },
        body || undefined,
        true,
        { span_kind: 'tool', name: pt.name, status: isErr ? 'error' : 'ok' },
      );
    };
    // Chiusura dello stream: gli span 'tool' rimasti senza tool_result (run uccisa
    // o interrotta) vengono comunque persistiti come span aperti (solo started).
    const flushPendingTools = (): void => {
      const runId = opts.runId;
      if (!runId) { pendingTools.clear(); return; }
      for (const pt of pendingTools.values()) {
        recordObs(
          {
            id: pt.obsId, run_id: runId, parent_id: pt.parentId, span_kind: 'tool', name: pt.name,
            status: 'running', started_at: pt.startedIso, ended_at: null, ms: null,
          },
          pt.inputBody || undefined,
          false,
          { span_kind: 'tool', name: pt.name, status: 'running' },
        );
      }
      pendingTools.clear();
    };

    const onStreamEvent = (env: Record<string, any>): void => {
      if (typeof env.session_id === 'string') resultEnv = { ...(resultEnv ?? {}), session_id: env.session_id };
      const content = env.message?.content;
      if (env.type === 'assistant' && Array.isArray(content)) {
        // Il turno assistant è un'unità completa nello stream: lo registro come
        // span 'llm' e ne uso l'id come parent dei tool_use dello stesso turno.
        const llmObsId = opts.runId ? recordLlmTurn(env, opts.runId) : null;
        for (const block of content as Array<Record<string, any>>) {
          if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
            // Rumore fuori: i system-reminder/istruzioni di harness che trafilano
            // nel testo non sono "ragionamento" e confondono la riga live.
            const txt = block.text.trim().replace(/\s+/g, ' ');
            if (/^<?system-reminder/i.test(txt) || txt.includes('<system-reminder>')) continue;
            pendingLive = `💭 ${txt.slice(0, 160)}`;
          } else if (block.type === 'tool_use') {
            const name = String(block.name ?? '');
            const line = describeTool(name, block.input);
            pendingLive = `🔧 ${line}`;
            // Traccia osservabile: gli edit con "→", ogni altro tool
            // (Read/Grep/Bash/graphify) con "·". Dedup delle righe consecutive uguali.
            const entry = `${['Edit', 'Write', 'MultiEdit'].includes(name) ? '→' : '·'} ${line}`;
            if (entry !== lastLogged) {
              pendingLog.push(entry);
              lastLogged = entry;
            }
            // Span 'tool' figlio: bufferizzato ora (start), inserito al tool_result.
            if (llmObsId) bufferTool(llmObsId, block, line);
          }
        }
        flushLive();
      } else if (env.type === 'user' && Array.isArray(content)) {
        // Gli esiti dei tool arrivano nel turno `user` successivo: chiudono lo span.
        for (const block of content as Array<Record<string, any>>) {
          if (block?.type === 'tool_result') completeTool(block);
        }
      } else if (env.type === 'result') {
        resultEnv = env;
      }
    };

    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      if (!streaming) { stdout += chunk; return; }
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const ln of lines) {
        const s = ln.trim();
        if (!s) continue;
        try { onStreamEvent(JSON.parse(s)); } catch { /* riga non-JSON: ignora */ }
      }
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer); unregister();
      resolve({ ok: false, text: '', error: `Impossibile avviare la CLI claude: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer); unregister();

      if (streaming) {
        const tail = buf.trim();
        if (tail) { try { onStreamEvent(JSON.parse(tail)); } catch { /* ignora */ } }
        flushLive(true);
        flushPendingTools(); // tool senza esito (run interrotta): persistili come span aperti
        if (opts.runId) updateRun(opts.runId, { live: undefined });
        const env = resultEnv;
        if (!env) {
          resolve({ ok: false, text: '', error: (stderr || `claude uscito con codice ${code}`).trim().slice(0, 500) });
          return;
        }
        if (env.usage) {
          recordUsage(opts.runId, 'claude', {
            inputTokens: (env.usage.input_tokens ?? 0) + (env.usage.cache_read_input_tokens ?? 0) + (env.usage.cache_creation_input_tokens ?? 0),
            outputTokens: env.usage.output_tokens ?? 0,
          }, typeof env.total_cost_usd === 'number' ? env.total_cost_usd : 0);
        }
        const resultText = typeof env.result === 'string' ? env.result : JSON.stringify(env.result ?? '');
        if (env.is_error === true || (typeof env.subtype === 'string' && env.subtype !== 'success')) {
          resolve({ ok: false, text: '', error: resultText || stderr || 'Run claude fallita.' });
          return;
        }
        resolve({ ok: true, text: resultText, sessionId: env.session_id });
        return;
      }

      // ── Path non-streaming (interprete / giudice / testo): envelope JSON singolo ──
      if (code !== 0 && !stdout) {
        resolve({ ok: false, text: '', error: stderr || `claude uscito con codice ${code}` });
        return;
      }
      try {
        const env = JSON.parse(stdout);
        if (env.usage) {
          recordUsage(opts.runId, 'claude', {
            inputTokens: (env.usage.input_tokens ?? 0) + (env.usage.cache_read_input_tokens ?? 0) + (env.usage.cache_creation_input_tokens ?? 0),
            outputTokens: env.usage.output_tokens ?? 0,
          }, typeof env.total_cost_usd === 'number' ? env.total_cost_usd : 0);
        }
        const resultText = typeof env.result === 'string' ? env.result : JSON.stringify(env.result ?? '');
        if (env.is_error === true || (typeof env.subtype === 'string' && env.subtype !== 'success')) {
          resolve({ ok: false, text: '', error: resultText || stderr || 'Run claude fallita.', raw: stdout });
          return;
        }
        resolve({ ok: true, text: resultText, sessionId: env.session_id, raw: stdout });
      } catch {
        if (code === 0) resolve({ ok: true, text: stdout.trim(), raw: stdout });
        else resolve({ ok: false, text: '', error: (stderr || stdout).trim().slice(0, 500) || `claude uscito con codice ${code}`, raw: stdout });
      }
    });
  });
}
