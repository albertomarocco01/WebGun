/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Guard PREVENTIVO del perimetro di scrittura dell'agente Fixer (CLI claude).
 * Il diff-guard post-hoc (esecuzione.ts) reverte solo DOPO, e ha punti ciechi
 * (file già sporchi pre-run, finestra di esposizione durante la run). Qui
 * installiamo un hook `PreToolUse` che NEGA Edit/Write fuori da `writeScope` o su
 * `sensitiveFiles` PRIMA che avvengano. Il perimetro arriva via env
 * (BUGBAY_WRITE_SCOPE / BUGBAY_SENSITIVE_FILES / BUGBAY_TARGET_ROOT), impostati
 * dalla CLI `bugbay dev` dal bugbay.config.json del progetto.
 *
 * Lo script hook e il file settings vivono in BUGBAY_DATA_DIR (gitignored, fuori
 * dal git status del repo target). Restituisce il path del settings da passare a
 * `claude --settings`. È installato SEMPRE (root containment obbligatorio sotto
 * acceptEdits): con env non configurato l'hook usa default fail-safe (tutto dentro
 * la radice, segreti esclusi). Ritorna null SOLO se l'installazione fallisce (I/O).
 *
 * @indice
 * - scopeGuardSettingsPath → prepara hook + settings, ritorna il path (o null)
 */

import fs from 'fs';
import path from 'path';
import { targetRoot } from './target-root';

function dataDir(): string {
  return process.env.BUGBAY_DATA_DIR
    ? path.resolve(process.env.BUGBAY_DATA_DIR)
    : path.join(targetRoot(), '.bugbay');
}

/** Sorgente CJS dell'hook. Legge il payload PreToolUse da stdin, nega con exit 2. */
const GUARD_CJS = String.raw`'use strict';
// BugBay scope-guard (PreToolUse): nega Edit/Write fuori dal perimetro consentito.
const path = require('path');
const fs = require('fs');
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let inp;
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw; // strip BOM difensivo
  try { inp = JSON.parse(clean).tool_input || {}; } catch { return deny('payload PreToolUse illeggibile'); } // fail-closed
  const fp = inp.file_path || inp.notebook_path;
  if (!fp || typeof fp !== 'string') return deny('payload PreToolUse malformato: file_path assente'); // fail-closed
  const root = process.env.BUGBAY_TARGET_ROOT;
  if (!root) return deny('BUGBAY_TARGET_ROOT non configurato'); // fail-closed
  const abs = path.resolve(root, fp);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return deny('fuori dal progetto: ' + fp);
  // Difesa SYMLINK: il check sopra è LESSICALE. Risolvi l'antenato ESISTENTE più
  // vicino e verifica che il suo realpath resti dentro la radice reale — un symlink
  // in-repo che punta fuori sfuggirebbe al confronto lessicale.
  try {
    const realRoot = fs.realpathSync(root);
    let anc = path.dirname(abs);
    while (anc !== path.dirname(anc) && !fs.existsSync(anc)) anc = path.dirname(anc);
    const relReal = path.relative(realRoot, fs.realpathSync(anc)).split(path.sep).join('/');
    if (relReal !== '' && (relReal.startsWith('..') || path.isAbsolute(relReal))) return deny('symlink fuori radice: ' + fp);
  } catch (e) { /* realpath fallita: resta valido il check lessicale gia passato */ }
  // Default con env NON configurato: writeScope = tutto DENTRO la radice ('**'), non
  // 'src/**'. Il root containment è già garantito sopra (check '..'/assoluto): un fix
  // legittimo può toccare file OVUNQUE nel repo, non solo src/. Restringere a src/**
  // negherebbe edit validi fuori src/. I segreti restano protetti dal default sensitive
  // qui sotto (allineato a DEFAULT_SENSITIVE di scope-match.ts).
  const writeScope = arr(process.env.BUGBAY_WRITE_SCOPE, ['**']);
  // Allineato a DEFAULT_SENSITIVE di scope-match.ts. Include i path exec-on-commit
  // (.git/hooks, package.json postinstall, .github/workflows, Dockerfile, *.sh): un
  // Edit lì è RCE al commit/install successivo → sempre negato, anche con writeScope '**'.
  const sensitive = arr(process.env.BUGBAY_SENSITIVE_FILES, ['**/auth/**', '**/middleware.*', '**/.env*', '**/*.config.*', '.git/**', '**/package.json', '**/package-lock.json', '**/.npmrc', '.github/**', '**/Dockerfile*', '**/*.sh']);
  if (sensitive.some((g) => rx(g).test(rel))) return deny('file sensibile protetto: ' + rel);
  if (!writeScope.some((g) => rx(g).test(rel))) return deny('fuori dal writeScope (' + writeScope.join(', ') + '): ' + rel);
  process.exit(0);
});
function arr(s, dflt) { try { const a = JSON.parse(s); return Array.isArray(a) ? a : dflt; } catch { return dflt; } }
function deny(reason) {
  process.stderr.write('BugBay scope-guard: modifica negata — ' + reason + '. Resta dentro il perimetro consentito.');
  process.exit(2);
}
function rx(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; }
      else re += '[^/]*';
    } else if ('.+^$(){}|[]\\'.includes(ch)) { re += '\\' + ch; }
    else re += ch;
  }
  return new RegExp('^' + re + '$');
}
`;

/**
 * Prepara l'hook e il settings file per la run corrente. Idempotente: riscrive
 * solo se il contenuto cambia. Ritorna SEMPRE il path del settings da passare a
 * `--settings`: il guard PreToolUse va installato in OGNI run di editing, anche
 * senza BUGBAY_WRITE_SCOPE/BUGBAY_SENSITIVE_FILES (es. `npm run dev` diretto o repo
 * non registrato) — altrimenti acceptEdits potrebbe scrivere fuori dalla radice.
 * Con env assente l'hook applica i default fail-safe (root containment + segreti
 * esclusi). Ritorna null SOLO se l'installazione su disco fallisce (I/O): in quel
 * caso il chiamante è fail-closed (annulla la run, non gira senza guard).
 */
export function scopeGuardSettingsPath(): string | null {
  try {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const guardPath = path.join(dir, 'bugbay-scope-guard.cjs');
    if (readIfExists(guardPath) !== GUARD_CJS) fs.writeFileSync(guardPath, GUARD_CJS, 'utf-8');
    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit|Write|MultiEdit|NotebookEdit',
            hooks: [{ type: 'command', command: `node ${JSON.stringify(guardPath)}` }],
          },
        ],
      },
    };
    const settingsPath = path.join(dir, 'bugbay-hooks-settings.json');
    const json = JSON.stringify(settings, null, 2);
    if (readIfExists(settingsPath) !== json) fs.writeFileSync(settingsPath, json, 'utf-8');
    return settingsPath;
  } catch {
    return null; // best-effort: se non installabile, resta il diff-guard post-hoc
  }
}

function readIfExists(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}
