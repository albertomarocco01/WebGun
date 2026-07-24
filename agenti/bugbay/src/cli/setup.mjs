/**
 * `bugbay setup` — installer "fa tutto": in un comando aggancia BugBay a un progetto.
 * Superset guidato di `init`: rileva il progetto, scrive la config, aggancia il
 * widget, sceglie lo storage (locale o Supabase hub) scrivendo `.env.local`, opziona
 * l'ingestione ONLINE (widget hosted + snippet), e registra il progetto nell'hub
 * multi-repo. Interattivo se c'è un TTY; altrimenti (o con --yes) usa flag/def.
 *
 * Flag: --yes (non interattivo), --force (sovrascrive la config), --storage
 * local|supabase, --supabase-url, --supabase-key, --online, --port.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { inspectProject } from './detect.mjs';
import { buildDefaultConfig, CONFIG_FILENAME, readConfigPort, readProject } from './config.mjs';
import { applyWiring } from './wire.mjs';
import { registerProject, readMachineEnv, writeMachineEnv } from './registry.mjs';
import { c, log, info, ok, warn, err, ensureGitignore, dirExists } from './util.mjs';

const PKG_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WIDGET_SRC = path.join(PKG_ROOT, 'web', 'public', 'bugbay-widget.js');

export async function setupCommand(opts = {}) {
  const root = process.cwd();
  const inspect = inspectProject(root);
  if (!inspect) {
    err(`Nessun package.json in ${root}. Esegui ${c.bold('bugbay setup')} nella radice del progetto.`);
    process.exitCode = 1;
    return;
  }

  const interactive = Boolean(process.stdin.isTTY) && !opts.yes;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ask = async (q, dflt = '') => { if (!rl) return dflt; const a = (await rl.question(q)).trim(); return a || dflt; };
  const askYN = async (q, dfltYes = false) => {
    if (!rl) return dfltYes;
    const a = (await ask(`${q} ${dfltYes ? '[S/n]' : '[s/N]'} `)).toLowerCase();
    if (!a) return dfltYes;
    return a.startsWith('s') || a.startsWith('y');
  };

  try {
    log(''); log(c.bold(c.magenta('  BugBay · setup'))); log('');
    info(`Progetto: ${c.bold(inspect.pkgName)} · framework ${c.bold(inspect.framework)} · pm ${c.bold(inspect.packageManager)}`);
    log('');

    const config = buildDefaultConfig(inspect, root);

    /* ── Storage ─────────────────────────────────────────────────── */
    const machine = readMachineEnv();
    const hasMachineHub = Boolean(machine.BUGBAY_SUPABASE_URL && machine.BUGBAY_SUPABASE_SERVICE_ROLE_KEY);
    let driver = opts.storage || (opts.supabase ? 'supabase' : '');
    if (!driver && interactive) {
      // Se questa macchina ha già un hub Supabase configurato, il default è
      // riusarlo: chiavi chieste UNA volta per macchina, non per progetto.
      driver = (await askYN('Salvare le segnalazioni su Supabase (hub condiviso multi-progetto)?', hasMachineHub)) ? 'supabase' : 'local';
    }
    if (!driver) driver = hasMachineHub ? 'supabase' : 'local';
    config.storage.driver = driver;

    if (driver === 'supabase') {
      let url = opts['supabase-url'] || '';
      let key = opts['supabase-key'] || '';
      if (!url && !key && hasMachineHub) {
        ok(`Hub Supabase già configurato su questa macchina (${machine.BUGBAY_SUPABASE_URL}) → lo riuso, nessuna chiave da reinserire.`);
      } else {
        if (interactive && !url) url = await ask('  URL Supabase (https://xxx.supabase.co): ');
        if (interactive && !key) key = await ask('  service_role key (salvata in ~/.bugbay/env.json e .env.local, mai committata): ');
        if (url && key) {
          writeEnvLocal(root, url, key);
          // Anche a livello macchina: i PROSSIMI progetti non chiederanno nulla.
          writeMachineEnv({ BUGBAY_SUPABASE_URL: url, BUGBAY_SUPABASE_SERVICE_ROLE_KEY: key });
          ok('Credenziali scritte in .env.local (gitignorato) e in ~/.bugbay/env.json (riusate dai prossimi setup).');
        } else {
          warn('Credenziali mancanti: metti BUGBAY_SUPABASE_URL e BUGBAY_SUPABASE_SERVICE_ROLE_KEY in .env.local prima di avviare.');
        }
      }
    }

    /* ── Chiave LLM (riformulazione AI automatica + fix) ─────────── */
    // Il workflow di default riformula OGNI segnalazione con AI (1 agente +
    // 2 verificatori): serve una chiave veloce (Anthropic o Gemini). Chiesta
    // una volta per macchina; vuoto = si usa la CLI claude locale (più lenta).
    const hasLlmKey = Boolean(machine.CONSOLE_ANTHROPIC_API_KEY || machine.GEMINI_API_KEY || opts['anthropic-key'] || opts['gemini-key']);
    let anthropicKey = opts['anthropic-key'] || '';
    let geminiKey = opts['gemini-key'] || '';
    if (!hasLlmKey && interactive) {
      anthropicKey = await ask('  Chiave API Anthropic per la riformulazione AI (invio per saltare): ');
      if (!anthropicKey) geminiKey = await ask('  ...oppure chiave API Gemini (invio per saltare): ');
    }
    if (anthropicKey || geminiKey) {
      writeMachineEnv({ CONSOLE_ANTHROPIC_API_KEY: anthropicKey, GEMINI_API_KEY: geminiKey });
      ok('Chiave LLM salvata in ~/.bugbay/env.json (vale per tutti i progetti).');
    } else if (machine.CONSOLE_ANTHROPIC_API_KEY || machine.GEMINI_API_KEY) {
      info('Chiave LLM già configurata su questa macchina → la riuso.');
    }

    /* ── Scrive config + gitignore ───────────────────────────────── */
    const cfgPath = path.join(root, CONFIG_FILENAME);
    if (fs.existsSync(cfgPath) && !opts.force) {
      warn(`${CONFIG_FILENAME} esiste già — lasciato intatto (usa --force per sovrascrivere).`);
    } else {
      if (opts.port) config.server.port = Number(opts.port) || config.server.port;
      fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n');
      ok(`Scritto ${c.bold(CONFIG_FILENAME)} (storage: ${driver}).`);
    }
    ensureGitignore(root, `${config.storage.dir}/`);
    ensureGitignore(root, '.bugbay-local-db/');

    /* ── Aggancio widget (dev locale) ────────────────────────────── */
    // Porta e project id EFFETTIVI: con una config esistente non sovrascritta il
    // widget deve puntare a quella porta (non ai default), e porta sempre ?p=.
    const effPort = fs.existsSync(cfgPath) && !opts.force ? readConfigPort(root) : config.server.port;
    const effProject = readProject(root);
    log('');
    applyWiring({ root, framework: inspect.framework, srcDir: inspect.layout.srcDir, routes: inspect.layout.routes, port: effPort, projectId: effProject.id });

    /* ── Ingestione ONLINE (widget hosted) ───────────────────────── */
    let online = Boolean(opts.online);
    if (!opts.online && interactive) {
      online = await askYN('Ricevere segnalazioni anche dall\'app DEPLOYATA (online, scrive diretto su Supabase)?', false);
    }
    if (online) setupOnline(root, config, opts['supabase-url'] || readEnvVar(root, 'BUGBAY_SUPABASE_URL') || '');

    /* ── Registrazione nell'hub multi-repo ───────────────────────── */
    const project = readProject(root);
    registerProject({
      id: project.id, name: project.name, root,
      writeScope: config.agent.writeScope, sensitiveFiles: config.agent.sensitiveFiles,
    });
    ok(`Registrato nell'hub multi-repo (${c.bold(project.name)}).`);
  } finally {
    if (rl) rl.close();
  }

  /* ── Riepilogo ───────────────────────────────────────────────── */
  const pm = runner(inspect.packageManager);
  log(''); log(c.bold('  Fatto ✓  Prossimi passi:'));
  if (fs.existsSync(path.join(root, '.env.local'))) {
    log(`   • Esegui ${c.cyan('supabase-schema.sql')} nello SQL Editor di Supabase (una volta, idempotente).`);
  }
  if (fs.existsSync(path.join(root, 'bugbay-online-snippet.html'))) {
    log(`   • App ONLINE: incolla ${c.cyan('bugbay-online-snippet.html')} prima di </body> e metti la ANON key.`);
  }
  log(`   • Avvia: ${c.cyan(`${pm} bugbay dev`)}   (o ${c.cyan(`${pm} bugbay dev --hub`)} per governare più repo)`);
  log('');
}

/**
 * Scrive/aggiorna le credenziali Supabase di BugBay in .env.local (upsert). Nomi PREFISSATI
 * BUGBAY_* apposta: l'app ospite può avere una PROPRIA Supabase su SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY (progetto diverso) e NON va sovrascritta. dev.mjs rimappa poi
 * BUGBAY_* → i nomi che la web console si aspetta.
 */
function writeEnvLocal(root, url, key) {
  const file = path.join(root, '.env.local');
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { /* nuovo */ }
  txt = upsertEnv(txt, 'BUGBAY_SUPABASE_URL', url);
  txt = upsertEnv(txt, 'BUGBAY_SUPABASE_SERVICE_ROLE_KEY', key);
  fs.writeFileSync(file, txt.endsWith('\n') ? txt : txt + '\n');
  ensureGitignore(root, '.env.local');
}

function upsertEnv(txt, name, value) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^\\s*${name}\\s*=.*$`, 'm');
  if (re.test(txt)) return txt.replace(re, line);
  return (txt && !txt.endsWith('\n') ? txt + '\n' : txt) + line + '\n';
}

/** Legge una variabile da .env.local/.env del progetto (parser minimale). */
function readEnvVar(root, name) {
  for (const f of ['.env.local', '.env']) {
    try {
      const m = fs.readFileSync(path.join(root, f), 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'));
      if (m) return m[1].replace(/^["']|["']$/g, '');
    } catch { /* assente */ }
  }
  return '';
}

/** Copia il widget nel public/ del progetto e scrive lo snippet per l'app online. */
function setupOnline(root, config, supaUrl) {
  // Cartella statica: public/ (Next/Vite/CRA/…); creata se assente.
  const pubDir = path.join(root, 'public');
  if (!dirExists(pubDir)) { try { fs.mkdirSync(pubDir, { recursive: true }); } catch { /* best-effort */ } }
  try {
    fs.copyFileSync(WIDGET_SRC, path.join(pubDir, 'bugbay-widget.js'));
    ok('Widget copiato in public/bugbay-widget.js (servito dall\'app online).');
  } catch {
    warn(`Non ho potuto copiare il widget: copialo a mano da ${WIDGET_SRC} nel tuo static dir.`);
  }
  const snippet = `<!-- BugBay — widget per l'app ONLINE (scrive diretto su Supabase). Incolla prima di </body>. -->
<script>
  window.BUGBAY = {
    supabaseUrl: ${JSON.stringify(supaUrl || 'https://xxx.supabase.co')},
    anonKey: 'INCOLLA_LA_ANON_KEY', // Supabase → Settings → API → anon/public (pubblica, insert-only via RLS)
    projectId: ${JSON.stringify(config.project.id)}
  };
</script>
<script type="module" src="/bugbay-widget.js"></script>
`;
  try { fs.writeFileSync(path.join(root, 'bugbay-online-snippet.html'), snippet); ok('Snippet online scritto: bugbay-online-snippet.html'); }
  catch { /* best-effort */ }
}

/** Comando consigliato per eseguire un bin a seconda del package manager. */
function runner(pm) {
  if (pm === 'pnpm') return 'pnpm';
  if (pm === 'yarn') return 'yarn';
  if (pm === 'bun') return 'bunx';
  return 'npx';
}
