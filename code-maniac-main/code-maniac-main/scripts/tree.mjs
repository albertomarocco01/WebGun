#!/usr/bin/env node
/**
 * @descrizione  Genera l'albero delle cartelle in modo DETERMINISTICO (0 token) per il
 *               placeholder {{ALBERO_CARTELLE}} di docs/struttura_directory.md — il doc
 *               che si dichiara "rigenerabile, non modificare a mano". La sorgente è
 *               `git ls-files`: solo i file TRACCIATI → rispetta .gitignore per costruzione,
 *               nessuna dipendenza esterna. La logica di costruzione/render è pura e testata
 *               (tree.test.mjs); l'I/O (git) sta solo nel blocco CLI in fondo.
 * @indice
 * - buildTree(paths)                       → oggetto annidato { nome → subtree | null(file) }
 * - renderTree(node, prefix, maxDepth)     → stringa ASCII ├──/└── (dir prima, poi alfabetico)
 *
 * Uso:  node <skill>/scripts/tree.mjs [--depth N]     (dalla root del progetto)
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Costruisce un albero annidato da una lista di path POSIX. Ogni nodo è un oggetto
 * (cartella) o `null` (file). `git ls-files` non produce mai un path che è insieme file
 * e cartella, quindi niente collisioni da gestire.
 */
export function buildTree(paths) {
  const root = {};
  for (const p of paths) {
    const parts = String(p).split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (node[part] === undefined) node[part] = isFile ? null : {};
      if (!isFile) {
        // se un path più corto aveva già segnato `part` come file, promuovilo a cartella
        if (node[part] === null) node[part] = {};
        node = node[part];
      }
    });
  }
  return root;
}

/**
 * Render ASCII dell'albero. Cartelle prima dei file, poi ordine alfabetico (stabile,
 * deterministico). `maxDepth` taglia la profondità (cartelle oltre soglia mostrate col `/`
 * ma non espanse) per tenere il doc leggibile e token-cheap; default = illimitato.
 */
export function renderTree(node, prefix = '', maxDepth = Infinity, depth = 1) {
  const entries = Object.entries(node).sort(([an, av], [bn, bv]) => {
    const ad = av !== null;
    const bd = bv !== null;
    if (ad !== bd) return ad ? -1 : 1; // cartelle prima
    return an.localeCompare(bn);
  });
  const lines = [];
  entries.forEach(([name, child], i) => {
    const last = i === entries.length - 1;
    const isDir = child !== null;
    lines.push(`${prefix}${last ? '└── ' : '├── '}${name}${isDir ? '/' : ''}`);
    if (isDir && depth < maxDepth) {
      const sub = renderTree(child, `${prefix}${last ? '    ' : '│   '}`, maxDepth, depth + 1);
      if (sub) lines.push(sub);
    }
  });
  return lines.join('\n');
}

// ── CLI (solo se eseguito direttamente, non all'import dai test) ───────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const di = argv.indexOf('--depth');
  const maxDepth = di >= 0 && argv[di + 1] ? Number(argv[di + 1]) : Infinity;

  const r = spawnSync('git', ['ls-files'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if ((r.status ?? 1) !== 0) {
    console.error('tree: non è un repo git (o git assente) — impossibile derivare l\'albero deterministicamente.');
    process.exit(2);
  }
  const files = r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(renderTree(buildTree(files), '', maxDepth));
}
