/**
 * Aggancio (auto-wire) del widget nell'app dell'utente. Per Next inietta lo
 * snippet nel root layout (idempotente); per gli altri stack stampa lo snippet
 * da incollare (fallback). Esposto sia da `init` sia dal comando `bugbay wire`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { inspectProject } from './detect.mjs';
import { wiringInstructions, universalScript, widgetUrl } from './snippet.mjs';
import { readConfigPort, readProject } from './config.mjs';
import { c, log, info, ok, warn, err } from './util.mjs';

const MARK = 'bugbay-widget.js';
// Matcha lo src del widget in un layout già wired, con o senza query (?p=/?t=).
const SRC_RE = /localhost:\d+\/bugbay-widget\.js(\?[^"'\s]*)?/g;

/** Candidati per il root layout Next, in ordine di preferenza. */
function nextLayoutCandidates(root, srcDir) {
  const base = srcDir && srcDir !== '.' ? srcDir : '';
  const dirs = [path.join(base, 'app'), 'app', path.join('src', 'app')];
  const files = [];
  for (const d of dirs) {
    for (const ext of ['tsx', 'jsx']) files.push(path.join(root, d, `layout.${ext}`));
  }
  return [...new Set(files)];
}

/**
 * Inietta lo snippet del widget nel root layout Next prima di </body>.
 * Ritorna { status: 'wired'|'updated'|'already'|'manual', file? }.
 */
function wireNext(root, srcDir, port, projectId) {
  const file = nextLayoutCandidates(root, srcDir).find((f) => fs.existsSync(f));
  if (!file) return { status: 'manual' };
  let src = fs.readFileSync(file, 'utf8');
  const target = `localhost:${port}/bugbay-widget.js${projectId ? `?p=${projectId}` : ''}`;
  if (src.includes(MARK)) {
    // Snippet già presente: riallinea porta e projectId se cambiati (re-init,
    // upgrade da install senza ?p=). Idempotente se già combaciano.
    const updated = src.replace(SRC_RE, target);
    if (updated !== src) { fs.writeFileSync(file, updated); return { status: 'updated', file }; }
    return { status: 'already', file };
  }
  const i = src.lastIndexOf('</body>');
  if (i === -1) return { status: 'manual' };
  const snippet =
    `{/* BugBay widget (solo in sviluppo) */}\n` +
    `        {process.env.NODE_ENV === 'development' && (\n` +
    `          <script type="module" src="${widgetUrl(port, projectId)}" async />\n` +
    `        )}\n      `;
  src = src.slice(0, i) + snippet + src.slice(i);
  fs.writeFileSync(file, src);
  return { status: 'wired', file };
}

/** Logica condivisa: aggancia (o istruisce) il widget. Stampa l'esito. */
export function applyWiring({ root, framework, srcDir, routes, port, projectId }) {
  if (framework === 'next' && routes === 'app-router') {
    const r = wireNext(root, srcDir, port, projectId);
    if (r.status === 'wired') { ok(`Widget agganciato in ${c.bold(path.relative(root, r.file))}`); return; }
    if (r.status === 'updated') { ok(`Widget riallineato (porta ${c.bold(port)}, progetto taggato) in ${c.bold(path.relative(root, r.file))}`); return; }
    if (r.status === 'already') { info(`Widget già presente in ${c.bold(path.relative(root, r.file))}`); return; }
    warn('Root layout non trovato: incolla lo snippet a mano (sotto).');
  }
  // Fallback (altri stack o layout non trovato): istruzioni manuali.
  const wiring = wiringInstructions(framework, { srcDir, routes }, port, projectId);
  log('');
  log(`  ${c.dim('Incolla in')} ${c.cyan(wiring.file)}:`);
  for (const line of wiring.code.split('\n')) log(`    ${c.green(line)}`);
  log(`  ${c.dim(wiring.note)}`);
  if (wiring.code !== universalScript(port, projectId)) {
    log(`  ${c.dim('Fallback universale:')} ${c.green(universalScript(port, projectId))}`);
  }
}

/** Comando `bugbay wire`: (ri)aggancia il widget al progetto corrente. */
export async function wireCommand() {
  const root = process.cwd();
  const inspect = inspectProject(root);
  if (!inspect) { err('Nessun package.json qui.'); process.exitCode = 1; return; }
  const port = readConfigPort(root);
  const project = readProject(root);
  log('');
  log(c.bold(c.magenta('  BugBay · wire')));
  applyWiring({ root, framework: inspect.framework, srcDir: inspect.layout.srcDir, routes: inspect.layout.routes, port, projectId: project.id });
  log('');
}
