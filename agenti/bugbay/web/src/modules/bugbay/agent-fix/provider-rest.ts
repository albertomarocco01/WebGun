/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Logica condivisa dei provider REST (Gemini, DeepSeek): riformulazione e fix
 * con loop di self-repair. Era duplicata al 95% tra gemini.ts e deepseek.ts;
 * qui vive una sola volta, parametrizzata dalla funzione di chiamata del
 * provider. Include il path-guard sulle scritture (l'LLM non può scrivere fuori
 * dal progetto né fuori da src/) e usa il gate tsc+ESLint relativo iniettato dal runner.
 *
 * @indice
 * - RestCaller       → firma della chiamata al provider
 * - restReformulate  → riscrive la segnalazione (senza modifica del codice)
 * - restFix          → fix con backup/rollback e gate iniettato
 */

import { targetRoot } from './target-root';
import fs from 'fs';
import path from 'path';
import { log, updateRun } from './store';
import type { GateResult } from './exec';
import { sliceFile, extractKeywords } from './slicing';
import { isPathAllowed, guardsFromEnv } from './scope-match';

const ROOT = (): string => targetRoot();

/** Funzione di chiamata di un provider REST (Gemini/DeepSeek). */
export type RestCaller = (prompt: string, systemInstruction?: string, jsonMode?: boolean) => Promise<string>;

export interface RestFixOpts {
  problema: string;
  criteri?: string[];
  files: string[];
  reportNotes: string;
  runId: string;
  /** Gate tsc (relativo alla baseline) iniettato dal runner. */
  gate: () => Promise<GateResult>;
  /** Nome del provider, per i log ("Gemini", "DeepSeek"). */
  providerName: string;
}

export async function restReformulate(call: RestCaller, report: any, files: string[]): Promise<string> {
  const prompt = `Rewrite the bug report below to be clearer, richer and more precise:
- write in technical ENGLISH (the rewritten text becomes the prompt for a fixing agent), even if the original is in Italian; keep UI labels, route paths and quoted strings exactly as they appear;
- keep the original intent;
- make expected vs. observed behavior explicit.

Context:
- area: ${report.area ?? ''} / ${report.subArea ?? ''}
- url: ${report.url ?? ''}
- involved files:
${files.map((f) => `  - ${f}`).join('\n')}

Original description:
${report.notes}`;

  const systemInstruction = 'You are a technical writing assistant for a bug-tracking console. Return only the improved description, no comments or markdown headers.';
  return await call(prompt, systemInstruction, false);
}

const SYSTEM_FIX = `You are the Fixer for the Baldisport management webapp (Next.js, TypeScript, Tailwind).
Your job is to analyze the problem and apply the necessary changes to the specified files,
through TARGETED EDITS in search/replace format (never rewrite whole files).

Non-negotiable rules:
- Modify ONLY the specified files. Do not touch other files.
- Laziest fix that works (YAGNI): reuse what already exists, prefer the standard library or an already-imported dependency, NEVER add a new dependency, one line before many; no refactors and no speculative abstractions that were not requested.
- "search" must be copied EXACTLY from the shown content (same casing, same indentation, same lines) and must identify a SINGLE spot in the file: include enough context lines to make it unique.
- To create a NEW file use "search": "" and put the whole content in "replace".
- Respect the file header convention (JSDoc with @convenzione docs/convenzioni/strutturaFile.md, @descrizione and an up-to-date @indice) where present; keep Italian naming consistent with the codebase. User-facing UI strings stay in the language used by the surrounding code.

Return the result as a JSON object with the following structure:
{
  "edits": [
    {
      "path": "src/path/to/file.tsx",
      "search": "exact text to find in the file (multiline allowed)",
      "replace": "text that replaces it"
    }
  ],
  "riassunto": "<short summary of what you changed, in Italian — it is shown to the reviewer>",
  "daVerificare": "<points to check manually, in Italian>"
}
Return ONLY the JSON, no other comments or markdown blocks.`;

/**
 * Contesto dei file per il prompt: slice dei blocchi rilevanti (token-efficient)
 * nei primi tentativi; file interi (`fullFiles`) come fallback per i file i cui
 * edit non hanno trovato il testo cercato.
 */
function buildFixPrompt(opts: RestFixOpts, fullFiles: Set<string>): string {
  const keywordSource = `${opts.problema}\n${(opts.criteri ?? []).join('\n')}\n${opts.reportNotes}`;
  const filesContext = opts.files
    .map((f) => {
      if (fullFiles.has(f)) {
        try {
          return `### FILE: ${f} (FULL content)\n\`\`\`\n${fs.readFileSync(path.join(ROOT(), f), 'utf-8')}\n\`\`\``;
        } catch {
          return `### FILE: ${f}\n(empty or missing file)`;
        }
      }
      const s = sliceFile(f, extractKeywords(keywordSource));
      const label = s.sliced ? ' (EXCERPT of the relevant blocks — omitted lines are marked)' : '';
      return `### FILE: ${f}${label}\n\`\`\`\n${s.excerpt}\n\`\`\``;
    })
    .join('\n\n');

  return `Problem to solve:
${opts.problema}

${opts.criteri?.length ? `Acceptance criteria:\n${opts.criteri.map((c) => `- ${c}`).join('\n')}\n` : ''}
Original description:
${opts.reportNotes}

Files to work on:
${filesContext}

Apply the search/replace edits needed to solve the problem. The "search" field must be copied verbatim from the content shown above.`;
}

interface ProposedEdit { path: string; search: string; replace: string }
interface EditFailure { path: string; search: string; reason: string }

/** Normalizza per il matching tollerante (CRLF e spazi finali di riga). */
function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n');
}

/**
 * Applica un edit search/replace a un contenuto. Match esatto, poi tollerante
 * su spazi finali/CRLF. Il search deve essere univoco nel file.
 */
function applySearchReplace(content: string, search: string, replace: string): { ok: boolean; next?: string; reason?: string } {
  if (!search) return { ok: false, reason: 'empty search on an existing file' };
  // 1) match esatto
  const idx = content.indexOf(search);
  if (idx !== -1) {
    if (content.indexOf(search, idx + 1) !== -1) return { ok: false, reason: 'ambiguous search (multiple occurrences): add context lines' };
    return { ok: true, next: content.slice(0, idx) + replace + content.slice(idx + search.length) };
  }
  // 2) match normalizzato riga-per-riga (riconverte agli offset reali)
  const contentLines = content.split('\n');
  const searchLines = normalize(search).split('\n');
  const matches: number[] = [];
  for (let i = 0; i + searchLines.length <= contentLines.length; i++) {
    let ok = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].replace(/\r$/, '').replace(/\s+$/, '') !== searchLines[j]) { ok = false; break; }
    }
    if (ok) matches.push(i);
  }
  if (matches.length === 0) return { ok: false, reason: 'search not found in the file (copy the shown text EXACTLY)' };
  if (matches.length > 1) return { ok: false, reason: 'ambiguous search (multiple occurrences): add context lines' };
  const start = matches[0];
  const next = [...contentLines.slice(0, start), ...replace.split('\n'), ...contentLines.slice(start + searchLines.length)].join('\n');
  return { ok: true, next };
}

/**
 * Normalizza e valida il path proposto dall'LLM (path-guard):
 * deve risolvere DENTRO il progetto ed essere tra i file in scope, oppure
 * un file nuovo sotto src/. Ritorna null se non valido.
 */
function sanitizeTargetPath(rawPath: string, scopedFiles: string[]): string | null {
  let targetPath = String(rawPath).replace(/\\/g, '/');
  if (!targetPath.startsWith('src/')) {
    const matchedInput = scopedFiles.find((f) => f === `src/${targetPath}` || f.endsWith(`/${targetPath}`));
    if (matchedInput) {
      targetPath = matchedInput;
    } else {
      const commonDirs = ['app/', 'components/', 'lib/', 'prisma/', 'hooks/', 'utils/', 'context/', 'types/', 'styles/'];
      if (commonDirs.some((dir) => targetPath.startsWith(dir))) {
        targetPath = `src/${targetPath}`;
      }
    }
  }
  // Path-guard sul path RISOLTO, non sul prefisso stringa: `src/../.env` ha
  // prefisso "src/" ma risolve FUORI da src → dev'essere rifiutato (RCE via
  // .git/hooks o furto .env). Stesso perimetro dell'hook PreToolUse (scope-match).
  const rel = path.relative(ROOT(), path.resolve(ROOT(), targetPath)).split(path.sep).join('/');
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null; // traversal fuori dal progetto
  const { writeScope, sensitiveFiles } = guardsFromEnv();
  if (!isPathAllowed(rel, writeScope, sensitiveFiles)) return null;            // fuori writeScope o file sensibile
  return rel;
}

export async function restFix(
  call: RestCaller,
  opts: RestFixOpts,
): Promise<{ ok: boolean; text: string; error?: string }> {
  const backups = new Map<string, string | null>();

  const rollback = () => {
    for (const [relPath, originalContent] of backups.entries()) {
      const fullPath = path.join(ROOT(), relPath);
      try {
        if (originalContent === null) {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            log(opts.runId, `Rollback: eliminato file creato ${relPath}`);
          }
        } else {
          fs.writeFileSync(fullPath, originalContent, 'utf-8');
          log(opts.runId, `Rollback: ripristinato file ${relPath}`);
        }
      } catch { /* best effort */ }
    }
  };

  try {
    const res = await restFixInternal(call, opts, backups);
    if (!res.ok) rollback();
    return res;
  } catch (err) {
    rollback();
    return { ok: false, text: '', error: err instanceof Error ? err.message : 'Errore imprevisto durante il fix.' };
  } finally {
    updateRun(opts.runId, { live: undefined });
  }
}

async function restFixInternal(
  call: RestCaller,
  opts: RestFixOpts,
  backups: Map<string, string | null>,
): Promise<{ ok: boolean; text: string; error?: string }> {
  let attempt = 0;
  const maxAttempts = 4;
  // File da mostrare INTERI nel prompt (fallback quando un search non matcha:
  // probabilmente il testo cercato stava in una zona omessa dallo slice).
  const fullFiles = new Set<string>();
  let currentPrompt = buildFixPrompt(opts, fullFiles);

  while (attempt < maxAttempts) {
    attempt++;
    log(opts.runId, `Tentativo di fix ${opts.providerName} #${attempt}…`);
    updateRun(opts.runId, { live: `🔧 ${opts.providerName}: tentativo #${attempt} su ${opts.files.length} file…` });

    let responseText: string;
    try {
      responseText = await call(currentPrompt, SYSTEM_FIX, true);
    } catch (e) {
      return { ok: false, text: '', error: e instanceof Error ? e.message : `Errore chiamata ${opts.providerName}.` };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      currentPrompt = `L'output non era un JSON valido. Per favore, restituisci l'esito ESCLUSIVAMENTE come JSON valido secondo lo schema richiesto.`;
      continue;
    }

    const edits: ProposedEdit[] = Array.isArray(parsed.edits) ? parsed.edits : [];
    if (edits.length === 0) {
      return { ok: false, text: '', error: `${opts.providerName} non ha proposto alcun edit.` };
    }

    // Applica gli edit (search/replace); raccoglie i fallimenti per il retry.
    const failures: EditFailure[] = [];
    let applied = 0;
    for (const edit of edits) {
      const targetPath = sanitizeTargetPath(edit.path, opts.files);
      if (!targetPath) {
        log(opts.runId, `Path-guard ⚠ scrittura rifiutata: "${edit.path}" è fuori dal perimetro consentito.`);
        continue;
      }
      const fullPath = path.join(ROOT(), targetPath);
      const exists = fs.existsSync(fullPath);

      // File nuovo: search vuoto + contenuto in replace
      if (!exists && !edit.search) {
        if (!backups.has(targetPath)) backups.set(targetPath, null);
        try {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, edit.replace ?? '', 'utf-8');
          applied++;
          log(opts.runId, `Creato file: ${targetPath}`);
        } catch (err) {
          return { ok: false, text: '', error: `Errore scrittura file ${targetPath}: ${(err as Error).message}` };
        }
        continue;
      }
      if (!exists) {
        failures.push({ path: targetPath, search: edit.search, reason: 'file does not exist (use an empty search to create it)' });
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const res = applySearchReplace(content, edit.search ?? '', edit.replace ?? '');
      if (!res.ok) {
        failures.push({ path: targetPath, search: (edit.search ?? '').slice(0, 200), reason: res.reason! });
        fullFiles.add(targetPath); // al prossimo giro questo file passa intero
        continue;
      }
      if (!backups.has(targetPath)) backups.set(targetPath, content);
      try {
        fs.writeFileSync(fullPath, res.next!, 'utf-8');
        applied++;
        log(opts.runId, `Edit applicato a ${targetPath}`);
      } catch (err) {
        return { ok: false, text: '', error: `Errore scrittura file ${targetPath}: ${(err as Error).message}` };
      }
    }

    if (failures.length) {
      log(opts.runId, `${failures.length} edit non applicabili (search non trovato/ambiguo) → retry con più contesto.`);
      currentPrompt = `${buildFixPrompt(opts, fullFiles)}

WARNING — the following edits from the previous attempt were NOT applied:
${failures.map((f) => `- ${f.path}: ${f.reason}\n  rejected search (start): "${f.search.slice(0, 120)}"`).join('\n')}
${applied > 0 ? `\n(${applied} edits HAVE already been applied: do NOT propose them again.)` : ''}

Propose ONLY the missing edits, copying "search" verbatim from the content shown above.`;
      continue;
    }

    log(opts.runId, 'Gate (tsc + ESLint, relativo alla baseline)…');
    const tsc = await opts.gate();
    if (tsc.ok) {
      const riassunto = parsed.riassunto || 'Correzione applicata con successo.';
      const daVerificare = parsed.daVerificare ? `DA VERIFICARE: ${parsed.daVerificare}` : '';
      return { ok: true, text: `${riassunto}\n\n${daVerificare}` };
    }

    // Self-repair mirato: passa SOLO gli errori nuovi, non l'intero output.
    const errori = tsc.newErrors?.length ? tsc.newErrors.join('\n') : tsc.output.slice(-2000);
    log(opts.runId, `Gate tsc/lint: ${tsc.newErrors?.length ?? '?'} nuovi problemi. Avvio auto-repair.`);
    currentPrompt = `The checks (tsc type-check + ESLint) reported the following NEW problems after the applied edits:\n\n${errori.slice(0, 2500)}\n\nPropose the search/replace edits that fix ONLY these problems (the files already contain the previous changes).`;
  }

  return { ok: false, text: '', error: 'Impossibile completare il fix dopo 4 tentativi.' };
}
