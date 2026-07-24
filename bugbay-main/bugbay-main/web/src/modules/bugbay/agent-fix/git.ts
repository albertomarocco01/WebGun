/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Operazioni git per il fix agentico: l'agente lavora sul branch CORRENTE
 * (nessun branch dedicato) lasciando le modifiche non committate, così sono
 * subito visibili e revertibili. È l'utente a decidere il branch.
 *
 * @indice
 * - currentBranch / diff / changedFiles / restore
 * - commitsSince / changedFilesSince / diffSummarySince → range base..HEAD (Refresh AI)
 * - headSha / lastTag → riferimenti per il range del refresh
 */

import { targetRoot } from './target-root';
import { spawnSync } from 'child_process';

// Radice per-op (NON cache): una run autonoma gira in un worktree isolato via
// withRunRoot → targetRoot() lì ritorna la cartella del worktree, e tutte le op
// git seguono. Per una run normale è il target root di sempre (nessun override).
const root = () => targetRoot();

function git(args: string[]): { ok: boolean; out: string } {
  const res = spawnSync('git', args, { cwd: root(), encoding: 'utf-8', timeout: 20_000 });
  return { ok: res.status === 0, out: (res.stdout ?? '') + (res.stderr ?? '') };
}

/**
 * Variante di `git()` per i comandi del Refresh-AI: il diff di un range può
 * essere enorme, quindi alziamo `maxBuffer` a 64 MiB (il default di Node è 1 MiB
 * e troncherebbe l'output, falsando il riassunto inviato all'LLM).
 */
function gitBig(args: string[]): { ok: boolean; out: string } {
  const res = spawnSync('git', args, {
    cwd: root(),
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: res.status === 0, out: (res.stdout ?? '') + (res.stderr ?? '') };
}

export function currentBranch(): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
}

/** Nome del branch dedicato ai fix agentici. */
export const AI_FIX_BRANCH = 'AI-fix';

export function ensureAiFixBranch(): boolean {
  // Disabilitato il passaggio al branch dedicato: usiamo il branch corrente
  return true;
}

/** Diff dei file working-tree (modifiche non committate fatte dall'agente). */
export function diff(): string {
  return git(['diff', '--no-color']).out;
}

/** Diff limitato a specifici file, inclusi i file NUOVI (untracked). */
export function diffFiles(files: string[]): string {
  if (files.length === 0) return '';
  // I file untracked non compaiono in `git diff`: li aggiungiamo all'index
  // in modo "intent-to-add" (reversibile) così il diff li mostra come +.
  const untracked = untrackedFiles().filter((f) => files.includes(f));
  if (untracked.length) git(['add', '--intent-to-add', '--', ...untracked]);
  const out = git(['diff', '--no-color', '--', ...files]).out;
  if (untracked.length) git(['reset', '--quiet', '--', ...untracked]);
  return out;
}

/** File NUOVI (untracked) nel working tree. */
export function untrackedFiles(): string[] {
  const out = git(['ls-files', '--others', '--exclude-standard']).out.trim();
  return out ? out.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

let cachedRepoPrefix: string | undefined;

/**
 * Prefisso del cwd rispetto alla root del repo (es. "project/" quando l'app
 * vive in una sottocartella). `git status --porcelain` stampa i path relativi
 * alla ROOT DEL REPO, ma tutto il resto (scope, restore, add) lavora relativo
 * al cwd: senza normalizzazione il diff-guard vede ogni file "fuori scope".
 */
function repoPrefix(): string {
  if (cachedRepoPrefix === undefined) {
    cachedRepoPrefix = git(['rev-parse', '--show-prefix']).out.trim();
  }
  return cachedRepoPrefix;
}

/** Converte un path repo-root-relative in cwd-relative. */
function toCwdRelative(p: string): string {
  const prefix = repoPrefix();
  if (!prefix) return p;
  if (p.startsWith(prefix)) return p.slice(prefix.length);
  // File fuori dalla sottocartella dell'app: raggiungibile risalendo dal cwd.
  const up = prefix.split('/').filter(Boolean).length;
  return '../'.repeat(up) + p;
}

/**
 * File toccati nel working tree (modificati + NUOVI), via status --porcelain:
 * `git diff --name-only` non vede gli untracked creati dall'agente.
 * I path sono normalizzati relativi al cwd (vedi repoPrefix).
 */
export function changedFiles(): string[] {
  const out = git(['status', '--porcelain']).out;
  const files: string[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    // Formato: XY <path> (o "XY old -> new" per i rename)
    const p = line.slice(3).trim();
    const renamed = p.includes(' -> ') ? p.split(' -> ')[1] : p;
    if (renamed) files.push(toCwdRelative(renamed.replace(/^"|"$/g, '')));
  }
  return files;
}

/**
 * Annulla le modifiche dei soli file indicati (scarta il fix di una run):
 * i file tracciati vengono ripristinati, i file NUOVI vengono eliminati.
 */
export function restoreFiles(files: string[]): void {
  if (files.length === 0) return;
  const untracked = new Set(untrackedFiles());
  const tracked = files.filter((f) => !untracked.has(f));
  const created = files.filter((f) => untracked.has(f));
  if (tracked.length) git(['restore', '--', ...tracked]);
  if (created.length) git(['clean', '-f', '--', ...created]);
}

/** Committa i file di una run approvata (P05: l'approve non resta volatile). */
export function commitFiles(files: string[], message: string): { ok: boolean; out: string } {
  if (files.length === 0) return { ok: true, out: 'nessun file da committare' };
  const add = git(['add', '--', ...files]);
  if (!add.ok) return { ok: false, out: add.out };
  return git(['commit', '-m', message, '--', ...files]);
}

/* ── Range base..HEAD (Refresh-with-AI) ─────────────────────────────
 * Helper di SOLA LETTURA su un intervallo di commit: l'agente di refresh legge
 * cosa è cambiato dall'ultimo refresh per generare la checklist QA. Tutti usano
 * `gitBig` (maxBuffer 64 MiB) perché il diff di un range può essere voluminoso.
 */

/**
 * Commit nel range `base..HEAD` (dal più recente al più vecchio), come coppie
 * `{ sha, message }`. Il `%s` (subject) è già una sola riga; il separatore di
 * campo `\x1f` (unit separator) non compare nei messaggi di commit, quindi lo
 * split per riga + per `\x1f` resta robusto.
 */
export function commitsSince(base: string): { sha: string; message: string }[] {
  const res = gitBig(['log', '--no-color', '--format=%h%x1f%s', `${base}..HEAD`]);
  if (!res.ok) return [];
  const out: { sha: string; message: string }[] = [];
  for (const line of res.out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [sha, message] = trimmed.split('\x1f');
    if (sha) out.push({ sha, message: (message ?? '').trim() });
  }
  return out;
}

/** File modificati nel range `base..HEAD` (de-duplicati). */
export function changedFilesSince(base: string): string[] {
  const res = gitBig(['diff', '--no-color', '--name-only', `${base}..HEAD`]);
  if (!res.ok) return [];
  const files: string[] = [];
  for (const line of res.out.split('\n')) {
    const f = line.trim();
    if (f && !files.includes(f)) files.push(f);
  }
  return files;
}

/**
 * Diff testuale del range `base..HEAD`, troncato a `budget` caratteri (budget
 * sui token approssimato dai caratteri). Il troncamento aggiunge un marcatore
 * esplicito così l'LLM sa che il diff è parziale.
 */
export function diffSummarySince(base: string, budget: number): string {
  const res = gitBig(['diff', '--no-color', `${base}..HEAD`]);
  if (!res.ok) return '';
  const out = res.out;
  if (out.length <= budget) return out;
  return `${out.slice(0, budget)}\n\n[…diff troncato a ${budget} caratteri…]`;
}

/** SHA breve di HEAD (riferimento dell'ultimo refresh). */
export function headSha(): string {
  return gitBig(['rev-parse', '--short', 'HEAD']).out.trim();
}

/** Ultimo tag raggiungibile da HEAD, o null se il repo non ha tag. */
export function lastTag(): string | null {
  const res = gitBig(['describe', '--tags', '--abbrev=0']);
  if (!res.ok) return null;
  const tag = res.out.trim();
  return tag || null;
}
