#!/usr/bin/env node
/**
 * Code Maniac — Bootstrap delle dipendenze (graphify · caveman · ponytail)
 *
 * Installa in automatico le tre skill esterne, MA le salta se già presenti:
 *   • plugin (caveman, ponytail) → installati come plugin Claude dal repo LOCALE
 *     (`claude plugin marketplace add <path>`), così funziona anche dietro proxy
 *     aziendali con TLS-interception, dove npm/git falliscono (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
 *     I repo vivono in una "skills home" condivisa.
 *   • graphify → pacchetto Python `graphifyy` + `graphify install` (non è folder-based).
 *
 * Dove cerca/mette i repo delle skill (in ordine di priorità):
 *   1. --skills-dir <path>            l'utente specifica dove sono / vanno
 *   2. env CODE_MANIAC_SKILLS_DIR     idem, via ambiente
 *   3. una cartella `skills/` SOPRA la root del progetto (se esiste → riusa, niente download)
 *   4. --in-root  →  <root>/skills    cartella dedicata dentro il progetto
 *   5. default    →  <root>/skills
 *
 * Uso:
 *   node setup.mjs                      auto-install (scarica solo ciò che manca)
 *   node setup.mjs --skills-dir <path>  usa/crea quella cartella per i repo
 *   node setup.mjs --in-root            tieni i repo in <root>/skills
 *   node setup.mjs --check              sola diagnosi (non scarica/installa nulla)
 *   node setup.mjs --tools              installa anche il core deterministico
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const ARGV = process.argv.slice(2);
const args = new Set(ARGV);
const CHECK = args.has('--check');
const TOOLS = args.has('--tools');
const IN_ROOT = args.has('--in-root');
const WIN = process.platform === 'win32';
const ROOT = process.cwd();

/** Valore di un flag `--nome <valore>`, o null. */
function flagValue(name) {
  const i = ARGV.indexOf(name);
  return i >= 0 && ARGV[i + 1] && !ARGV[i + 1].startsWith('--') ? ARGV[i + 1] : null;
}

/** Esegue catturando; { code, out } senza mai lanciare. */
function run(cmd, cmdArgs, { shell = WIN } = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell, stdio: 'pipe' });
  if (r.error) return { code: 127, out: '' };
  return { code: r.status ?? 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Stampa il comando e lo esegue mostrando l'output; true se exit 0. */
function exec(cmd, cmdArgs, { shell = WIN } = {}) {
  console.log(`     $ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', shell, stdio: 'inherit' });
  return !r.error && (r.status ?? 1) === 0;
}

const onPath = (cmd) => (spawnSync(WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' }).status ?? 1) === 0;

/** Un plugin Claude è già installato/attivo? */
const pluginActive = (name) => run('claude', ['plugin', 'details', name]).code === 0;

/** Prefisso per invocare graphify (console script o `python -m graphify`), o null. */
function graphifyExec() {
  if (onPath('graphify')) return ['graphify'];
  for (const py of ['python', 'python3']) {
    if (onPath(py) && run(py, ['-c', 'import graphify']).code === 0) return [py, '-m', 'graphify'];
  }
  return null;
}

/** Risolve la "skills home" dove vivono i repo delle skill esterne. */
function resolveSkillsHome() {
  const flag = flagValue('--skills-dir') || process.env.CODE_MANIAC_SKILLS_DIR;
  if (flag) return { dir: path.resolve(flag), source: 'specificata' };
  // cerca una cartella `skills/` dalla root verso l'alto (riusa se la trovi)
  let cur = ROOT;
  for (let i = 0; i < 6; i++) {
    const cand = path.join(cur, 'skills');
    if (existsSync(cand)) {
      const aboveRoot = cand !== path.join(ROOT, 'skills');
      return { dir: cand, source: aboveRoot ? 'trovata sopra la root' : 'trovata nel progetto' };
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return { dir: path.join(ROOT, 'skills'), source: IN_ROOT ? 'dedicata nel progetto (--in-root)' : 'default (nel progetto)' };
}

/** Legge .claude-plugin/marketplace.json → { marketplace, plugin } o null. */
function readMarketplace(repoDir) {
  try {
    const m = JSON.parse(readFileSync(path.join(repoDir, '.claude-plugin', 'marketplace.json'), 'utf8'));
    return { marketplace: m.name, plugin: (m.plugins?.[0]?.name) || m.name };
  } catch { return null; }
}

/** Scarica owner/repo nello skills home, cert-proof (zip via cert store su Windows). */
function downloadRepo(owner, repo, home) {
  mkdirSync(home, { recursive: true });
  for (const br of ['main', 'master']) {
    const ok = WIN ? dlWin(owner, repo, br, home) : dlUnix(owner, repo, br, home);
    if (!ok) continue;
    const extracted = path.join(home, `${repo}-${br}`);
    const final = path.join(home, repo);
    if (existsSync(extracted)) {
      if (existsSync(final)) rmSync(final, { recursive: true, force: true });
      renameSync(extracted, final);
    }
    if (existsSync(path.join(final, '.claude-plugin', 'marketplace.json'))) return true;
  }
  return false;
}

function dlWin(owner, repo, br, home) {
  const url = `https://github.com/${owner}/${repo}/archive/refs/heads/${br}.zip`;
  const h = home.replace(/'/g, "''");
  const ps = `$ErrorActionPreference='Stop'; $z=Join-Path $env:TEMP 'cm_dl.zip'; Invoke-WebRequest -Uri '${url}' -OutFile $z; Expand-Archive -Path $z -DestinationPath '${h}' -Force; Remove-Item $z -Force`;
  // shell:false → niente cmd.exe di mezzo; PowerShell usa il cert store di Windows.
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', shell: false, stdio: 'pipe' });
  return !r.error && (r.status ?? 1) === 0;
}

function dlUnix(owner, repo, br, home) {
  const url = `https://github.com/${owner}/${repo}/archive/refs/heads/${br}.tar.gz`;
  const tmp = path.join(os.tmpdir(), `cm_${repo}.tar.gz`);
  const r = spawnSync('bash', ['-c', `curl -fsSL "${url}" -o "${tmp}" && tar -xzf "${tmp}" -C "${home}" && rm -f "${tmp}"`], { encoding: 'utf8', stdio: 'pipe' });
  return !r.error && (r.status ?? 1) === 0;
}

// ── installazioni ───────────────────────────────────────────────────────────
function installGraphify() {
  const gx = graphifyExec();
  if (CHECK) return { name: 'graphify', status: gx ? 'ok' : 'todo', note: gx ? 'presente' : 'da installare (pip graphifyy)' };
  if (gx) { exec(gx[0], [...gx.slice(1), 'install', '--platform', 'claude']); return { name: 'graphify', status: 'ok', note: 'presente (skill allineata)' }; }
  const eng =
    (onPath('uv') && exec('uv', ['tool', 'install', '--upgrade', 'graphifyy'])) ||
    (onPath('pipx') && exec('pipx', ['install', 'graphifyy'])) ||
    (onPath('pip') && exec('pip', ['install', '--upgrade', 'graphifyy'])) ||
    (onPath('pip3') && exec('pip3', ['install', '--upgrade', 'graphifyy']));
  if (!eng) return { name: 'graphify', status: 'warn', note: 'nessun gestore Python (uv/pipx/pip)' };
  const gx2 = graphifyExec();
  if (gx2) exec(gx2[0], [...gx2.slice(1), 'install', '--platform', 'claude']);
  return { name: 'graphify', status: gx2 ? 'ok' : 'warn', note: gx2 ? 'engine + skill installati' : 'engine ok, `graphify` non sul PATH (riapri il terminale)' };
}

function installPlugin(dep, home) {
  if (pluginActive(dep.plugin)) return { name: dep.repo, status: 'ok', note: 'già installato (plugin attivo)' };
  const repoDir = path.join(home, dep.repo);
  const present = existsSync(path.join(repoDir, '.claude-plugin', 'marketplace.json'));
  if (CHECK) return { name: dep.repo, status: 'todo', note: present ? `repo presente in ${repoDir} → installa` : `da scaricare in ${repoDir}` };
  if (!present && !downloadRepo(dep.owner, dep.repo, home)) {
    return { name: dep.repo, status: 'warn', note: `download fallito (rete?) — ${dep.owner}/${dep.repo}` };
  }
  const mp = readMarketplace(repoDir);
  if (!mp) return { name: dep.repo, status: 'warn', note: 'manca .claude-plugin/marketplace.json' };
  exec('claude', ['plugin', 'marketplace', 'add', repoDir]); // best-effort (ok se già aggiunta)
  const ok = exec('claude', ['plugin', 'install', `${mp.plugin}@${mp.marketplace}`]);
  return { name: dep.repo, status: ok ? 'ok' : 'warn', note: ok ? `installato da ${repoDir}` : 'claude plugin install non riuscito' };
}

function setupTools() {
  if (!existsSync(path.join(ROOT, 'package.json'))) return { name: 'core deterministico', status: 'skip', note: 'nessun package.json nella root' };
  if (CHECK) return { name: 'core deterministico', status: 'todo', note: 'rilancia con --tools' };
  // eslint-plugin-sonarjs: cognitive complexity (il tier `block` dell'analisi complessità).
  // Puro JS, nessun build nativo → ok anche dietro proxy. Per la complessità poliglotta
  // (TS/py/go) installa anche `lizard`: pipx install lizard.
  const ok = exec('npm', ['i', '-D', 'prettier', 'eslint', 'eslint-plugin-sonarjs', 'typescript', 'dependency-cruiser', 'knip', 'jscpd']);
  return { name: 'core deterministico', status: ok ? 'ok' : 'warn', note: ok ? 'devDependencies installate (complessità poliglotta: pipx install lizard)' : 'npm i non riuscito' };
}

// ── esecuzione ──────────────────────────────────────────────────────────────
const home = resolveSkillsHome();
const PLUGINS = [
  { owner: 'JuliusBrussee', repo: 'caveman', plugin: 'caveman' },
  { owner: 'DietrichGebert', repo: 'ponytail', plugin: 'ponytail' },
];

console.log(`\nCode Maniac — setup${CHECK ? ' (check)' : ''}`);
console.log(`   skills home: ${home.dir}  (${home.source})`);
console.log(`   graphify: pacchetto Python (pip), non folder-based\n`);

const report = [installGraphify(), ...PLUGINS.map((p) => installPlugin(p, home.dir))];
if (TOOLS || CHECK) report.push(setupTools());

const icon = { ok: '[ OK ]', warn: '[WARN]', skip: '[SKIP]', todo: '[TODO]' };
console.log('');
for (const r of report) console.log(`  ${icon[r.status]} ${r.name} — ${r.note}`);

if (report.some((r) => r.status === 'warn')) {
  console.log('\nSe vedi "UNABLE_TO_VERIFY_LEAF_SIGNATURE": rete con TLS-interception →');
  console.log('  per npm/pip indica il root CA aziendale (NODE_EXTRA_CA_CERTS / pip --cert).');
  console.log('  I plugin (caveman/ponytail) scaricano via PowerShell e di norma evitano il problema.');
}
if (!CHECK) console.log('\nDiagnosi senza installare:  node setup.mjs --check');

process.exit(report.some((r) => r.status === 'warn') ? 1 : 0);
