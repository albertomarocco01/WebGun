/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Worktree git isolati per le run AUTONOME (F3): la run gira su
 * `bugbay/auto/<reportId>` in una cartella separata (`.bugbay/worktrees/<runId>`),
 * MAI nel working tree dell'utente. I worktree git NON contengono le dipendenze
 * gitignored, quindi `node_modules` viene JUNCTIONato dal repo principale (così
 * tsc/eslint/la CLI claude lo risolvono). La app-root dentro il worktree va
 * passata a `withRunRoot` (target-root.ts) per confinarci l'esecuzione.
 *
 * @indice
 * - autoBranch      → nome del ramo isolato per una segnalazione
 * - createWorktree  → crea worktree + junction node_modules → app-root (o null)
 * - removeWorktree  → smonta la junction e rimuove il worktree (il RAMO resta)
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { targetRoot } from './target-root';

function runGit(args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 30_000 });
  return { ok: r.status === 0, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

/** Root del repo git che contiene `repoRoot` (o '' se non risolvibile). */
function repoTop(repoRoot: string): string {
  return runGit(['rev-parse', '--show-toplevel'], repoRoot).out.trim();
}

/** Sottocartella dell'app relativa alla root del repo git (es. "apps/web"; "" se coincidono). */
function appSubdir(repoRoot: string): string {
  const top = repoTop(repoRoot);
  if (!top) return '';
  const rel = path.relative(path.resolve(top), repoRoot).split(path.sep).join('/');
  return rel && !rel.startsWith('..') ? rel : '';
}

// I worktree vivono DENTRO il repo instradato (`<repoRoot>/.bugbay/worktrees`), non
// nel data-dir del daemon: in modalità hub ogni repo ha i propri worktree, e la
// junction node_modules punta al node_modules di QUEL repo. `.bugbay/` è gitignored
// (setup/dev), quindi non finisce nei commit. Coincide col comportamento mono-repo
// (repoRoot === targetRoot()).
const worktreesDir = (repoRoot: string): string => path.join(repoRoot, '.bugbay', 'worktrees');

/** Ramo isolato dedicato ai fix autonomi di una segnalazione. */
export function autoBranch(reportId: string): string {
  return `bugbay/auto/${reportId}`;
}

/**
 * Crea un worktree isolato per la run su `bugbay/auto/<reportId>` (dir sotto
 * `.bugbay/worktrees/<runId>`, gitignored) e junctiona node_modules dal repo
 * principale. Ritorna la ROOT DELL'APP nel worktree (da passare a withRunRoot),
 * o null se qualcosa fallisce.
 * ponytail: il ramo viene creato/RESETtato da HEAD a ogni run (-B) — l'ultimo fix
 * autonomo su una segnalazione sostituisce il precedente non ancora mergiato.
 */
export function createWorktree(runId: string, reportId: string, repoRoot: string = targetRoot()): string | null {
  const root = path.resolve(repoRoot);
  const wtDir = path.join(worktreesDir(root), runId);
  const branch = autoBranch(reportId);
  try {
    fs.mkdirSync(worktreesDir(root), { recursive: true });
    removeWorktree(runId, root); // eventuale worktree stantìo con lo stesso runId
    const add = runGit(['worktree', 'add', '--force', '-B', branch, wtDir, 'HEAD'], root);
    if (!add.ok) return null;

    const appRoot = path.join(wtDir, appSubdir(root));
    // node_modules è gitignored → assente nel worktree: lo junctiono dal principale.
    const mainNm = path.join(root, 'node_modules');
    const wtNm = path.join(appRoot, 'node_modules');
    if (fs.existsSync(mainNm) && !fs.existsSync(wtNm)) {
      try { fs.symlinkSync(mainNm, wtNm, 'junction'); } catch { /* senza junction il gate fallirà, non fatale qui */ }
    }
    return appRoot;
  } catch {
    return null;
  }
}

/**
 * Smonta la junction node_modules (con recursive:false → MAI segue dentro il
 * node_modules reale) e rimuove il worktree. Il RAMO bugbay/auto/<reportId> viene
 * CONSERVATO: è il deliverable che l'utente mergerà. Best-effort.
 */
export function removeWorktree(runId: string, repoRoot: string = targetRoot()): void {
  const root = path.resolve(repoRoot);
  const wtDir = path.join(worktreesDir(root), runId);
  if (!fs.existsSync(wtDir)) return;
  // 1) Rimuovi PRIMA la junction — recursive:false così non si segue mai il link
  //    dentro il node_modules reale (verificato: rimuove solo il reparse point).
  try {
    const wtNm = path.join(wtDir, appSubdir(root), 'node_modules');
    if (fs.existsSync(wtNm)) fs.rmSync(wtNm, { recursive: false, force: true });
  } catch { /* junction assente o già rimossa */ }
  // 2) Rimuovi il worktree (git aggiorna il registro; il ramo resta).
  runGit(['worktree', 'remove', '--force', wtDir], root);
  runGit(['worktree', 'prune'], root); // pulizia difensiva del registro
}
