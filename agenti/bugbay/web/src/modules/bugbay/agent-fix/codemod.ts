/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Codemod deterministici (0 token): pattern meccanici risolti senza LLM, sui
 * file in scope. Catena di pattern:
 *   1) sostituzione letterale  «sostituisci/cambia/correggi "A" con/in "B"»
 *   2) rimozione               «rimuovi/elimina/togli "X"»
 *   3) rename di identificatore «rinomina la variabile/funzione X in Y» (ast-grep,
 *      AST-aware: stringhe e commenti esclusi) — SOLO se il binario è disponibile.
 * Se nessun pattern matcha (o il binario ast-grep manca), il codemod si astiene
 * e la run prosegue con il Fixer LLM.
 *
 * @indice
 * - tryCodemod → tenta la risoluzione deterministica (catena); null se non applicabile
 */

import { targetRoot } from './target-root';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = (): string => targetRoot();

/**
 * Root REALE (env), IMMUNE all'override ALS del worktree. Serve a risolvere binari
 * STABILI (ast-grep) senza cacharne un path dentro un worktree effimero: quello
 * verrebbe cancellato da removeWorktree, avvelenando la cache per tutto il processo.
 * Il node_modules è comunque lo stesso (junctionato nel worktree), quindi il binario
 * del repo principale è sempre valido.
 */
function realRoot(): string {
  const t = process.env.BUGBAY_TARGET_ROOT;
  return t ? path.resolve(t) : process.cwd();
}

export interface CodemodResult {
  /** File effettivamente modificati (relativi al root). */
  modifiedFiles: string[];
  riassunto: string;
}

/**
 * Riconosce nelle note una richiesta di sostituzione letterale:
 * «sostituisci "A" con "B"», «cambia "A" in "B"», «correggi "A" con "B"»,
 * «rinomina "A" in "B"», anche con virgolette tipografiche.
 */
function parseLiteralReplace(text: string): { from: string; to: string } | null {
  const q = `["'«“]([^"'»”]{2,120})["'»”]`;
  const re = new RegExp(
    `(?:sostituisci|sostituire|cambia|cambiare|correggi|correggere|rinomina|rinominare|rimpiazza)\\s+(?:il\\s+testo\\s+|la\\s+scritta\\s+|la\\s+stringa\\s+)?${q}\\s+(?:con|in)\\s+${q}`,
    'i',
  );
  const m = text.match(re);
  if (!m) return null;
  const from = m[1];
  const to = m[2];
  if (!from || from === to) return null;
  return { from, to };
}

/** Applica una sostituzione letterale su tutti i file in scope (to vuoto = rimozione). */
function applyLiteral(from: string, to: string, scopedFiles: string[]): { modifiedFiles: string[]; occorrenze: number } {
  const modifiedFiles: string[] = [];
  let occorrenze = 0;
  for (const rel of scopedFiles) {
    const fullPath = path.join(ROOT(),rel);
    let content: string;
    try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }
    if (!content.includes(from)) continue;
    occorrenze += content.split(from).length - 1;
    fs.writeFileSync(fullPath, content.split(from).join(to), 'utf-8');
    modifiedFiles.push(rel);
  }
  return { modifiedFiles, occorrenze };
}

/** «rimuovi/elimina/togli "X"» → cancella la stringa letterale X. */
function parseRemoval(text: string): string | null {
  const q = `["'«“]([^"'»”]{2,120})["'»”]`;
  const re = new RegExp(
    `(?:rimuovi|rimuovere|elimina|eliminare|togli|togliere|cancella|cancellare)\\s+(?:il\\s+testo\\s+|la\\s+scritta\\s+|la\\s+stringa\\s+|la\\s+parola\\s+)?${q}`,
    'i',
  );
  return text.match(re)?.[1] ?? null;
}

/** «rinomina la variabile/funzione/prop X in Y» (identificatori, non stringhe). */
function parseIdentifierRename(text: string): { from: string; to: string } | null {
  const id = '([A-Za-z_$][\\w$]*)';
  const re = new RegExp(
    `(?:rinomina|rinominare)\\s+(?:la\\s+|il\\s+|lo\\s+)?(?:variabile|funzione|function|prop|propriet[àa]|costante|metodo|simbolo|componente)\\s+["'\`]?${id}["'\`]?\\s+(?:in|con|→)\\s+["'\`]?${id}["'\`]?`,
    'i',
  );
  const m = text.match(re);
  if (!m || m[1] === m[2]) return null;
  return { from: m[1], to: m[2] };
}

/* ── ast-grep (rename strutturale, AST-aware) ───────────────────────
 * Opzionale: usato SOLO se il binario `ast-grep` è disponibile nel target
 * (node_modules/.bin o PATH). Rinomina un identificatore senza toccare stringhe
 * o commenti (cosa che un `\bX\b` di sed sbaglierebbe). Se assente → null → il
 * Fixer LLM gestisce il rename come oggi. */
let cachedSg: string | null | undefined;
function astGrepBin(): string | null {
  if (cachedSg !== undefined) return cachedSg;
  const local = [
    path.join(realRoot(), 'node_modules', '.bin', 'ast-grep'),
    path.join(realRoot(), 'node_modules', '.bin', 'ast-grep.cmd'),
  ].find((p) => fs.existsSync(p));
  if (local) { cachedSg = local; return cachedSg; }
  for (const name of ['ast-grep', 'sg']) {
    const finder = process.platform === 'win32' ? 'where.exe' : 'which';
    const res = spawnSync(finder, [name], { encoding: 'utf-8', timeout: 10_000 });
    const first = res.status === 0 ? (res.stdout ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] : undefined;
    if (first) { cachedSg = first; return cachedSg; }
  }
  cachedSg = null;
  return cachedSg;
}

/** Rinomina l'identificatore via ast-grep sui file in scope; null se non disponibile/nessuna modifica. */
function astGrepRename(from: string, to: string, scopedFiles: string[]): string[] | null {
  const bin = astGrepBin();
  if (!bin) return null;
  const targets = scopedFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f) && fs.existsSync(path.join(ROOT(),f)));
  const modified: string[] = [];
  for (const rel of targets) {
    const fullPath = path.join(ROOT(),rel);
    const before = fs.readFileSync(fullPath, 'utf-8');
    const res = spawnSync(bin, ['run', '--pattern', from, '--rewrite', to, '--update-all', rel], { cwd: ROOT(), encoding: 'utf-8', timeout: 30_000 });
    if (res.status !== 0) continue;
    if (fs.readFileSync(fullPath, 'utf-8') !== before) modified.push(rel);
  }
  return modified.length ? modified : null;
}

/**
 * Tenta la risoluzione deterministica della segnalazione sui file in scope.
 * Catena: sostituzione letterale → rimozione → rename di identificatore (ast-grep).
 * Ritorna null se nessun codemod è applicabile (si procede col Fixer LLM).
 */
export function tryCodemod(text: string, scopedFiles: string[]): CodemodResult | null {
  // 1) Sostituzione letterale «A» → «B»
  const sub = parseLiteralReplace(text);
  if (sub) {
    const { modifiedFiles, occorrenze } = applyLiteral(sub.from, sub.to, scopedFiles);
    if (modifiedFiles.length) return {
      modifiedFiles,
      riassunto: `Codemod deterministico (0 token): sostituito "${sub.from}" con "${sub.to}" — ${occorrenze} occorrenz${occorrenze === 1 ? 'a' : 'e'} in ${modifiedFiles.length} file.\n\nDA VERIFICARE: che "${sub.to}" appaia correttamente al posto di "${sub.from}".`,
    };
  }

  // 2) Rimozione «X»
  const toRemove = parseRemoval(text);
  if (toRemove) {
    const { modifiedFiles, occorrenze } = applyLiteral(toRemove, '', scopedFiles);
    if (modifiedFiles.length) return {
      modifiedFiles,
      riassunto: `Codemod deterministico (0 token): rimosso "${toRemove}" — ${occorrenze} occorrenz${occorrenze === 1 ? 'a' : 'e'} in ${modifiedFiles.length} file.\n\nDA VERIFICARE: che "${toRemove}" non compaia più dove non serve.`,
    };
  }

  // 3) Rename di identificatore (solo se ast-grep è disponibile, altrimenti → LLM)
  const ren = parseIdentifierRename(text);
  if (ren) {
    const modifiedFiles = astGrepRename(ren.from, ren.to, scopedFiles);
    if (modifiedFiles) return {
      modifiedFiles,
      riassunto: `Codemod deterministico (0 token, ast-grep): rinominato l'identificatore "${ren.from}" in "${ren.to}" in ${modifiedFiles.length} file (AST-aware, stringhe e commenti esclusi).\n\nDA VERIFICARE: che il rename non abbia rotto riferimenti fuori dai file in scope.`,
    };
  }

  return null;
}
