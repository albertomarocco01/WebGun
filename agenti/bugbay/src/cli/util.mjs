/**
 * Utility della CLI: nessuna dipendenza esterna (build-free, robusto rispetto a
 * problemi di rete/TLS). Solo Node built-ins.
 */
import fs from 'node:fs';
import path from 'node:path';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
};

export const log = (...a) => console.log(...a);
export const info = (msg) => console.log(`${c.cyan('›')} ${msg}`);
export const ok = (msg) => console.log(`${c.green('✓')} ${msg}`);
export const warn = (msg) => console.log(`${c.yellow('!')} ${msg}`);
export const err = (msg) => console.error(`${c.red('✗')} ${msg}`);

/** Legge e fa il parse di un JSON; ritorna `null` se assente o malformato. */
export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Risale da `start` cercando un file con quel nome; ritorna la dir che lo contiene. */
export function findUp(filename, start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fileExists(path.join(dir, filename))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Aggiunge una riga a .gitignore se non già presente (idempotente). */
export function ensureGitignore(root, entry) {
  const file = path.join(root, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    /* .gitignore assente: lo creiamo */
  }
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(entry)) return false;
  const sep = content && !content.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${sep}\n# BugBay (stato locale)\n${entry}\n`);
  return true;
}
