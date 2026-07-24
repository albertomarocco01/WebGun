/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Lettura del registro multi-repo dell'hub (~/.bugbay/registry.json, scritto dalla
 * CLI `bugbay dev`). Mappa project_id → repo locale, e — dato una radice ATTIVA
 * (che può essere un worktree DENTRO un repo registrato) — risolve il perimetro di
 * scrittura (writeScope/sensitiveFiles) del repo proprietario. Serve a due cose:
 *  1) instradare il fix di una segnalazione al repo del suo project_id (hub);
 *  2) confinare il guard dell'agente alla radice ATTIVA, non a quella statica del
 *     daemon (fix del worktree autonomo + multi-repo).
 *
 * @indice
 * - resolveRepo          → entry del progetto per project_id
 * - resolveRunRoot       → repo in cui ESEGUIRE il fix di una segnalazione (routing hub)
 * - resolveGuardForRoot  → writeScope/sensitiveFiles del repo che CONTIENE activeRoot
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { targetRoot } from './target-root';

/**
 * true in modalità hub (`bugbay dev --hub`). Letto inline dall'env: registry.ts
 * resta un leaf senza dipendenze dal layer API (lib/project), così è testabile in
 * isolamento. `lib/project.isHub` è la copia usata dal layer API — stesso env.
 */
const hubMode = (): boolean => process.env.BUGBAY_HUB === '1';

const REGISTRY_FILE = path.join(os.homedir(), '.bugbay', 'registry.json');

export interface RepoEntry {
  name: string;
  root: string;
  writeScope: string[];
  sensitiveFiles: string[];
  updatedAt?: string;
}
interface Registry { version?: number; projects?: Record<string, RepoEntry> }

export function readRegistry(): Registry {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    return r && typeof r === 'object' ? r : { projects: {} };
  } catch {
    return { projects: {} };
  }
}

/** Entry del progetto per project_id (null se non registrato su questo pc). */
export function resolveRepo(projectId?: string | null): RepoEntry | null {
  if (!projectId) return null;
  return readRegistry().projects?.[projectId] ?? null;
}

/** Esito del routing: la radice risolta, oppure un rifiuto motivato (mai un fallback silenzioso). */
export type RunRoot = { ok: true; root: string } | { ok: false; reason: string };

/**
 * Radice del repo in cui ESEGUIRE il fix di una segnalazione (dispatch multi-repo).
 * SICUREZZA — la regola d'oro: si instrada a un repo DIVERSO dal proprio SOLO in
 * modalità hub, e SOLO per un project_id realmente registrato e ancora presente su
 * disco. Se non risolvibile → RIFIUTO ({ok:false}), MAI un fallback sul repo del
 * daemon: editare il repo sbagliato è il fallimento grave da evitare. Fuori dall'hub
 * (o per il proprio progetto / setup legacy senza id) → sempre il proprio targetRoot.
 */
export function resolveRunRoot(reportProjectId?: string | null): RunRoot {
  const own = targetRoot();
  const ownId = process.env.BUGBAY_PROJECT_ID || null;
  // Non-hub, oppure segnalazione del progetto stesso, oppure legacy senza id → il proprio repo.
  if (!hubMode() || !reportProjectId || reportProjectId === ownId) return { ok: true, root: own };
  // Hub + segnalazione di un ALTRO progetto: instrada al suo repo registrato.
  const entry = resolveRepo(reportProjectId);
  if (!entry?.root) return { ok: false, reason: `progetto ${reportProjectId} non registrato in questo hub` };
  const root = path.resolve(entry.root);
  // Il repo registrato dev'essere ancora una cartella esistente: se spostato/rimosso,
  // RIFIUTA (un fallback sul repo del daemon editerebbe il progetto sbagliato).
  try {
    if (!fs.statSync(root).isDirectory()) return { ok: false, reason: `repo di ${reportProjectId} non è una cartella: ${root}` };
  } catch {
    return { ok: false, reason: `repo di ${reportProjectId} non trovato su disco: ${root}` };
  }
  return { ok: true, root };
}

const norm = (p: string): string => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * Dato la radice ATTIVA (per una run autonoma è un worktree DENTRO il repo, es.
 * `<repo>/.bugbay/worktrees/<id>`), trova il repo REGISTRATO che la contiene
 * (prefix-match più lungo) e ne ritorna il perimetro. null se nessun repo
 * registrato la contiene (→ il chiamante usa il fallback dall'env del daemon).
 */
export function resolveGuardForRoot(activeRoot: string): { writeScope: string[]; sensitiveFiles: string[]; repoRoot: string } | null {
  const projects = readRegistry().projects ?? {};
  const a = norm(activeRoot);
  let best: RepoEntry | null = null;
  let bestLen = -1;
  for (const e of Object.values(projects)) {
    const r = norm(e.root);
    if ((a === r || a.startsWith(r + '/')) && r.length > bestLen) { best = e; bestLen = r.length; }
  }
  if (!best) return null;
  return { writeScope: best.writeScope, sensitiveFiles: best.sensitiveFiles, repoRoot: best.root };
}
