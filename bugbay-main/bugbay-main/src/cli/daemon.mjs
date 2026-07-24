/**
 * Logica CONDIVISA del daemon BugBay, estratta da `dev.mjs` così che
 * `bugbay dev` (sviluppo, `next dev`) e `bugbay start` (produzione 24/7,
 * `next build` una volta → `next start`) costruiscano l'ambiente del figlio Next
 * da UN SOLO punto. Duplicare il blocco env tra dev e start sarebbe un bug latente
 * per un daemon 24/7 (una var aggiunta a dev e non a start = comportamento diverso
 * in produzione). Qui vive la preparazione (copia app per-versione, install deps,
 * CA aziendale, storage, segreti) e la costruzione dell'env; il sottocomando Next
 * (`dev`/`build`/`start`), la porta e `NODE_ENV` restano ai chiamanti.
 */
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILENAME, DEFAULT_PORT, STORAGE_DIR, readOrCreateToken, readAgentGuards, readProject, readAutonomy } from './config.mjs';
import { registerProject, readMachineEnv, resolveCaCert, caSetupInstructions } from './registry.mjs';
import { c, log, info, ok, warn, err, readJson, ensureGitignore, fileExists } from './util.mjs';

export const PKG_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const WEB_SRC = path.join(PKG_ROOT, 'web');
export const VERSION = readJson(path.join(PKG_ROOT, 'package.json'))?.version || '0';
/** Path del bin `bugbay` (usato dai task Scheduler per rilanciare il daemon). */
export const BIN_PATH = path.join(PKG_ROOT, 'bin', 'bugbay.mjs');

/**
 * Directory MACHINE-SCOPED dello stato lifecycle/spina (~/.bugbay). Override via
 * BUGBAY_HUB_DIR (sandbox/test). È la stessa radice che usa `dev.mjs` per hub.sqlite.
 */
export function hubDir() {
  return process.env.BUGBAY_HUB_DIR ? path.resolve(process.env.BUGBAY_HUB_DIR) : path.join(os.homedir(), '.bugbay');
}

/**
 * Gate hard-fail sulla versione di Node all'avvio del daemon. La spina v0.6
 * (`~/.bugbay/hub.sqlite`) usa `node:sqlite` DatabaseSync, stabile e senza flag
 * solo da Node ≥ 22.13.
 */
export function assertNodeVersion() {
  const [maj = 0, min = 0] = process.versions.node.split('.').map((n) => Number(n));
  const good = maj > 22 || (maj === 22 && min >= 13);
  if (!good) {
    err(`Node ${process.versions.node} non supportato: BugBay richiede Node >=22.13`);
    err('(node:sqlite/DatabaseSync stabile, richiesto dalla spina hub.sqlite). Aggiorna Node.');
    process.exit(1);
  }
}

/** Cerca la prima porta libera da `start` in su (prova fino a 50 porte). */
export function findFreePort(start, tries = 50) {
  return new Promise((resolve, reject) => {
    const probe = (p, left) => {
      const srv = net.createServer();
      srv.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && left > 0) probe(p + 1, left - 1);
        else reject(e);
      });
      srv.once('listening', () => srv.close(() => resolve(p)));
      srv.listen(p, '127.0.0.1'); // stesso host del bind `next -H 127.0.0.1`
    };
    probe(start, tries);
  });
}

/**
 * Probe di liveness: c'è qualcosa in ascolto su 127.0.0.1:port? Il daemon binda
 * loopback; il watchdog e `bugbay start` usano questo per decidere restart/no-op
 * senza toccare il codice dell'app web (nessun endpoint di health richiesto).
 */
export function isPortAlive(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (alive) => { if (done) return; done = true; try { sock.destroy(); } catch { /* noop */ } resolve(alive); };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, '127.0.0.1');
  });
}

/** Porta configurata (bugbay.config.json) senza ricerca di porta libera. */
export function configuredPort(root, opts = {}) {
  const config = readJson(path.join(root, CONFIG_FILENAME)) || {};
  return Number(opts.port) || config.server?.port || DEFAULT_PORT;
}

/**
 * Prepara TUTTO il contesto del daemon tranne lo spawn di Next:
 * hub dir, copia app per-versione, install deps, CA, storage, env del figlio.
 * `nodeEnv` distingue dev ('development') da produzione ('production'). Ritorna
 * `{ appDir, nextBin, childEnv, projectName, storageLabel, root }`.
 */
export async function prepareDaemon({ root, opts = {}, nodeEnv }) {
  assertNodeVersion();

  // Spina MACHINE-SCOPED: un solo hub.sqlite per TUTTI i repo (~/.bugbay).
  const dir = hubDir();
  fs.mkdirSync(dir, { recursive: true });

  const projectName = readJson(path.join(root, 'package.json'))?.name || path.basename(root);
  const config = readJson(path.join(root, CONFIG_FILENAME)) || {};
  const dataDir = path.join(root, config.storage?.dir || STORAGE_DIR);
  fs.mkdirSync(dataDir, { recursive: true });
  try { ensureGitignore(root, `${config.storage?.dir || STORAGE_DIR}/`); } catch { /* best-effort */ }

  // Sicurezza (F0): token per-daemon + perimetro di scrittura dell'agente.
  const token = readOrCreateToken(dataDir);
  const guards = readAgentGuards(root);
  const allowedOrigin = config.server?.allowedOrigin || '';
  const project = readProject(root);
  const autonomy = readAutonomy(root);
  const hub = !!opts.hub || config.server?.hub === true;
  registerProject({ id: project.id, name: projectName, root, writeScope: guards.writeScope, sensitiveFiles: guards.sensitiveFiles });

  // Auto-heal degli install ONLINE: riallinea la copia del widget in public/.
  syncPublicWidget(root);

  if (!fs.existsSync(WEB_SRC)) {
    err(`App web del daemon non trovata (${WEB_SRC}). Pacchetto incompleto.`);
    process.exit(1);
  }

  // App eseguita FUORI da node_modules. La cache è keyed per-versione.
  const appDir = path.join(os.homedir(), '.bugbay-cache', VERSION, 'app');
  const firstTime = !fs.existsSync(path.join(appDir, 'package.json'));
  if (firstTime) {
    info('Preparo la console (copia una-tantum per versione)...');
    fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(appDir, { recursive: true });
  }
  // Ri-sincronizza il SORGENTE a ogni avvio in SVILUPPO. La cache è keyed solo per
  // versione, ma la versione non cambia tra un'edit e l'altra: senza questo il daemon
  // girerebbe un vecchio snapshot ignorando ogni modifica al sorgente (bug reale: si
  // finiva a debuggare codice fossile). Copia tutto tranne le parti COSTOSE
  // (node_modules/.next); `next dev` ricompila da sé. In PRODUZIONE no: `next start`
  // serve `.next`, cambiare il sorgente senza rebuild darebbe un mismatch — il refresh
  // di prod è il build-once di `bugbay start` (nuova versione ⇒ nuova cache).
  // ponytail: overwrite-copy, non rimuove i file cancellati dal sorgente (restano
  //           orfani, innocui perché non importati); svuota ~/.bugbay-cache se dà noia.
  if (firstTime || nodeEnv === 'development') {
    for (const entry of fs.readdirSync(WEB_SRC)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      fs.cpSync(path.join(WEB_SRC, entry), path.join(appDir, entry), { recursive: true });
    }
  }

  // TLS: nessun bypass. CA aziendale AGGIUNTO al trust store via NODE_EXTRA_CA_CERTS.
  const ca = resolveCaCert();
  if (ca && !fileExists(ca.path)) {
    err(`Certificato CA non trovato: ${ca.path} (configurato da ${ca.source}).`);
    err('Correggi NODE_EXTRA_CA_CERTS e riprova.');
    process.exit(1);
  }
  const caEnv = ca ? { NODE_EXTRA_CA_CERTS: ca.path } : {};

  // Dipendenze della console (una tantum per versione, condivise tra progetti).
  if (!fs.existsSync(path.join(appDir, 'node_modules', 'next'))) {
    warn('Installo le dipendenze della console (una tantum per versione)...');
    const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: appDir, stdio: 'inherit', shell: true, env: { ...process.env, ...caEnv } });
    if (r.status !== 0) {
      err('Installazione dipendenze console fallita.');
      if (ca) err(`Il CA configurato (${ca.path}) non ha risolto il problema: verifica che sia il PEM corretto.`);
      else caSetupInstructions().forEach((line) => warn(line));
      process.exit(1);
    }
  }

  const storage = resolveStorage(root, config);
  const nextBin = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  const childEnv = {
    ...process.env,
    // CA aziendale ereditato dal daemon (aggiunto al trust store, non lo rimpiazza).
    ...caEnv,
    BUGBAY_TARGET_ROOT: root,
    // Spina machine-scoped: override opzionale del path hub.sqlite (default ~/.bugbay).
    ...(process.env.BUGBAY_HUB_DIR ? { BUGBAY_HUB_DIR: dir } : {}),
    BUGBAY_VERSION: VERSION,
    BUGBAY_PROJECT_ID: project.id,
    BUGBAY_PROJECT_NAME: projectName,
    BUGBAY_DATA_DIR: dataDir,
    BUGBAY_DAEMON_TOKEN: token,
    BUGBAY_ALLOWED_ORIGIN: allowedOrigin,
    BUGBAY_WRITE_SCOPE: JSON.stringify(guards.writeScope),
    BUGBAY_SENSITIVE_FILES: JSON.stringify(guards.sensitiveFiles),
    BUGBAY_HUB: hub ? '1' : '0',
    BUGBAY_AUTO_REFORMULATE: config.agent?.autoReformulate === false ? '0' : '1',
    BUGBAY_TEST_GATE: config.agent?.testGate === false ? '0' : '1',
    CONSOLE_ANTHROPIC_API_KEY: resolveSecret(root, 'CONSOLE_ANTHROPIC_API_KEY'),
    GEMINI_API_KEY: resolveSecret(root, 'GEMINI_API_KEY'),
    DEEPSEEK_API_KEY: resolveSecret(root, 'DEEPSEEK_API_KEY'),
    BUGBAY_AUTONOMY_ENABLED: autonomy.enabled ? '1' : '0',
    BUGBAY_AUTONOMY_POLL: String(autonomy.pollSeconds),
    BUGBAY_AUTONOMY_GATE_TEST: autonomy.gate.test ? '1' : '0',
    BUGBAY_AUTONOMY_GATE_BUILD: autonomy.gate.build ? '1' : '0',
    BUGBAY_NOTIFY_WEBHOOK: autonomy.notify.webhook || '',
    ENABLE_AGENT_FIX: '1',
    ...storage.env,
    NODE_ENV: nodeEnv,
  };

  return { appDir, nextBin, childEnv, projectName, storageLabel: storage.label, root };
}

/** Banner d'avvio comune a dev e start. */
export function printBanner({ mode, port, projectName, root, storageLabel }) {
  const modeLabel = mode === 'start' ? 'daemon · produzione' : 'daemon';
  log('');
  log(c.bold(c.magenta(`  BugBay · ${modeLabel}`)));
  log('');
  ok(`Console:  ${c.cyan(`http://localhost:${port}`)}`);
  info(`Widget:   ${c.cyan(`http://localhost:${port}/bugbay-widget.js`)}`);
  info(`Progetto: ${c.bold(projectName)}`);
  info(`Target:   ${c.dim(root)}`);
  info(`Storage:  ${c.dim(storageLabel)}`);
  log('');
  if (mode === 'start') log(c.dim('  Produzione: build una volta per versione, poi `next start`. Ctrl+C per fermare.'));
  else log(c.dim('  Primo avvio: la console può metterci ~10-20s a compilare. Ctrl+C per fermare.'));
  log('');
}

/**
 * Decide il backend dati. `storage.driver: "supabase"` → Supabase se trova le
 * credenziali; altrimenti DB locale in `.bugbay-local-db/`.
 */
export function resolveStorage(root, config) {
  if ((config.storage?.driver || 'local') === 'supabase') {
    const url = resolveSecret(root, 'BUGBAY_SUPABASE_URL');
    const key = resolveSecret(root, 'BUGBAY_SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      return { label: `Supabase (${url})`, env: { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } };
    }
    warn('storage.driver="supabase" ma mancano BUGBAY_SUPABASE_URL / BUGBAY_SUPABASE_SERVICE_ROLE_KEY → uso il DB locale.');
  }
  return { label: 'locale (.bugbay-local-db)', env: { BUGBAY_LOCAL_DB: '1' } };
}

/** Risolve un segreto: .env.local/.env del repo > env di processo > ~/.bugbay/env.json. */
export function resolveSecret(root, name) {
  return readEnvVar(root, name) || process.env[name] || readMachineEnv()[name] || undefined;
}

/** Legge una variabile da `.env.local` o `.env` del repo target (parser minimale). */
export function readEnvVar(root, name) {
  for (const f of ['.env.local', '.env']) {
    try {
      const txt = fs.readFileSync(path.join(root, f), 'utf8');
      const m = txt.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* file assente */ }
  }
  return undefined;
}

/**
 * Se il repo ha una copia del widget in public/ (install online), la riallinea
 * alla versione corrente del pacchetto. Copie stale = bug silenziosi nel browser.
 */
export function syncPublicWidget(root) {
  const src = path.join(WEB_SRC, 'public', 'bugbay-widget.js');
  const dst = path.join(root, 'public', 'bugbay-widget.js');
  try {
    if (!fs.existsSync(dst) || !fs.existsSync(src)) return;
    if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(dst, 'utf8')) {
      fs.copyFileSync(src, dst);
      ok('Widget in public/ aggiornato alla versione del pacchetto.');
    }
  } catch { /* best-effort */ }
}
