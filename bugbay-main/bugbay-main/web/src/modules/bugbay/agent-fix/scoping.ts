/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Scoping deterministico dei file rilevanti per una segnalazione, per dare
 * all'agente un contesto minimo (token-efficient). Due fonti, nessuna esplorazione:
 *  1) mappa URL→file (la rotta indicata dalla segnalazione);
 *  2) indice graphify (query sul grafo del codice) per i file collegati.
 *
 * @indice
 * - resolveScope      → lista di file candidati per una segnalazione
 * - resolveScopeLight → solo i file da URL (niente graphify, per i task testo)
 */

import { targetRoot } from './target-root';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = (): string => targetRoot();

/**
 * Trova la cartella graphify-out: prima nel progetto, poi risalendo (il grafo
 * può essere stato costruito dalla root del monorepo, un livello sopra app/).
 */
function findGraphifyDir(): string | null {
  let dir = PROJECT_ROOT();
  for (let i = 0; i < 3; i++) {
    const cand = path.join(dir, 'graphify-out');
    if (fs.existsSync(path.join(cand, 'graph.json')) && fs.existsSync(path.join(cand, '.graphify_python'))) {
      return cand;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Dal pathname dell'URL deriva il file di pagina Next corrispondente, se esiste. */
function urlToFile(url?: string | null): string[] {
  if (!url) return [];
  let pathname = url;
  try {
    if (url.startsWith('http')) pathname = new URL(url).pathname;
  } catch { /* usa url così com'è */ }
  pathname = pathname.replace(/\/+$/, '');
  if (!pathname || pathname === '') pathname = '';

  // Sempre separatori posix: lo scope viene confrontato coi path di git
  // (forward slash) dal diff-guard — su Windows path.join produrrebbe `\`.
  const candidates = [
    path.posix.join('src/app', pathname, 'page.tsx'),
    path.posix.join('src/app', pathname, 'route.ts'),
    path.posix.join('src/app', `${pathname}.tsx`),
  ];

  // I route group Next `(gruppo)` non compaiono nell'URL: prova anche dentro
  // ogni gruppo top-level di src/app (es. /login → src/app/(auth)/login/page.tsx).
  try {
    const appDir = path.join(PROJECT_ROOT(),'src/app');
    for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
      if (entry.isDirectory() && /^\(.+\)$/.test(entry.name)) {
        candidates.push(
          path.posix.join('src/app', entry.name, pathname, 'page.tsx'),
          path.posix.join('src/app', entry.name, pathname, 'route.ts'),
        );
      }
    }
  } catch {
    /* src/app non leggibile → restano solo i candidati diretti */
  }

  return candidates.filter((rel) => fs.existsSync(path.join(PROJECT_ROOT(),rel)));
}

/** Estrae poche keyword significative dalla descrizione + sotto-area. */
function keywords(notes: string, subArea?: string): string {
  const base = `${subArea ?? ''} ${notes}`.toLowerCase();
  const stop = new Set(['il','lo','la','i','gli','le','un','una','di','che','non','per','con','del','della','dei','delle','nel','nella','come','sono','deve','essere','più','anche','questo','questa','quando','dove','tutti','tutto','adesso','poi']);
  const toks = (base.match(/[a-zàèéìòù]{4,}/g) ?? [])
    .filter((t) => !stop.has(t));
  // dedup mantenendo l'ordine, max 8
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of toks) {
    if (!seen.has(t)) { seen.add(t); out.push(t); }
    if (out.length >= 8) break;
  }
  return out.join(' ');
}

/** Interroga l'indice graphify per i file collegati (deterministico, budgetato). */
function graphifyRelated(query: string, budget = 1200): string[] {
  const graphifyDir = findGraphifyDir();
  if (!query.trim() || !graphifyDir) return [];

  const python = fs.readFileSync(path.join(graphifyDir, '.graphify_python'), 'utf-8').trim();
  // cwd = cartella che CONTIENE graphify-out: la CLI cerca il grafo lì.
  const res = spawnSync(python, ['-m', 'graphify', 'query', query, '--budget', String(budget)], {
    cwd: path.dirname(graphifyDir),
    encoding: 'utf-8',
    timeout: 30_000,
  });
  if (res.status !== 0 || !res.stdout) return [];

  // Parse righe "NODE ... [src=...]". Se il grafo è stato costruito dalla root
  // del monorepo i path hanno un prefisso (es. sito-web-baldisport/project/):
  // si riportano alla forma project-relative e si tengono solo quelli esistenti.
  const files = new Set<string>();
  for (const m of res.stdout.matchAll(/src=([^\s\]]+)/g)) {
    const grezzo = m[1].replace(/\\/g, '/');
    const rel = grezzo.match(/(?:^|\/)(src\/.+)$/)?.[1];
    if (!rel || !/\.(tsx?|jsx?)$/.test(rel)) continue;
    if (fs.existsSync(path.join(PROJECT_ROOT(),rel))) files.add(rel);
  }
  return [...files];
}

export interface ScopeResult {
  files: string[];
  daUrl: string[];
  daGrafo: string[];
}

export function resolveScope(report: { url?: string | null; notes: string; subArea?: string }): ScopeResult {
  const daUrl = urlToFile(report.url);
  const daGrafo = graphifyRelated(keywords(report.notes, report.subArea));

  // Unione: prima i file dell'URL (più rilevanti), poi i collegati dal grafo. Cap a 6.
  const ordered: string[] = [];
  for (const f of [...daUrl, ...daGrafo]) {
    if (!ordered.includes(f)) ordered.push(f);
    if (ordered.length >= 6) break;
  }
  return { files: ordered, daUrl, daGrafo };
}

/**
 * Scope "leggero" per i task di solo testo (riformulazioni): solo i file
 * derivati dall'URL, SENZA interrogare graphify — lo spawn del processo python
 * costa secondi (fino a 30s di timeout) e per riscrivere un testo non serve.
 */
export function resolveScopeLight(report: { url?: string | null }): ScopeResult {
  const daUrl = urlToFile(report.url);
  return { files: daUrl.slice(0, 6), daUrl, daGrafo: [] };
}
