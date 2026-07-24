/**
 * `bugbay init` — aggancia BugBay a un'app qualsiasi con un comando:
 *  1. rileva package manager / framework / layout;
 *  2. scrive bugbay.config.json (non sovrascrive senza --force);
 *  3. aggiunge .bugbay/ a .gitignore;
 *  4. stampa lo snippet di aggancio del widget per il framework rilevato.
 *
 * Flag: --dry-run (mostra senza scrivere), --force (sovrascrive la config).
 */
import fs from 'node:fs';
import path from 'node:path';
import { inspectProject } from './detect.mjs';
import { buildDefaultConfig, CONFIG_FILENAME, readConfigPort, readProject } from './config.mjs';
import { applyWiring } from './wire.mjs';
import { registerProject } from './registry.mjs';
import { c, log, info, ok, warn, err, ensureGitignore } from './util.mjs';

export async function initCommand(opts = {}) {
  const root = process.cwd();
  const dryRun = !!opts['dry-run'];
  const force = !!opts.force;

  const inspect = inspectProject(root);
  if (!inspect) {
    err(`Nessun package.json in ${root}.`);
    log(`  Esegui ${c.bold('bugbay init')} dalla radice di un progetto.`);
    process.exitCode = 1;
    return;
  }

  log('');
  log(c.bold(c.magenta('  BugBay · init')));
  log('');
  info(`Progetto:        ${c.bold(inspect.pkgName)}`);
  info(`Framework:       ${c.bold(inspect.framework)}`);
  info(`Package manager: ${c.bold(inspect.packageManager)}`);
  info(`Layout:          srcDir=${c.bold(inspect.layout.srcDir)}, routes=${c.bold(inspect.layout.routes)}`);
  if (inspect.framework === 'unknown') {
    warn('Framework non riconosciuto: userò lo snippet universale (vale comunque).');
  }
  log('');

  const config = buildDefaultConfig(inspect, root);
  const configPath = path.join(root, CONFIG_FILENAME);
  const exists = fs.existsSync(configPath);

  if (dryRun) {
    info(`(dry-run) Scriverei ${c.bold(CONFIG_FILENAME)}:`);
    log(c.dim(JSON.stringify(config, null, 2)));
  } else if (exists && !force) {
    warn(`${CONFIG_FILENAME} esiste già — lo lascio intatto (usa --force per sovrascrivere).`);
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    ok(`Scritto ${c.bold(CONFIG_FILENAME)}`);
    const added = ensureGitignore(root, `${config.storage.dir}/`);
    if (added) ok(`Aggiunto ${c.bold(config.storage.dir + '/')} a .gitignore`);
  }

  // Aggancio del widget: auto-inject su Next app-router, istruzioni altrove.
  // Porta e project id EFFETTIVI: se una config esiste e non viene sovrascritta,
  // il widget deve puntare a QUELLA porta, non a quella dei default (bug che
  // lasciava il layout su una porta dove nessun daemon ascolta).
  const effPort = exists && !force ? readConfigPort(root) : config.server.port;
  const project = readProject(root);
  log('');
  log(c.bold('  Aggancia il widget'));
  if (dryRun) {
    log(`  ${c.dim('(dry-run) aggancio del widget: saltato.')}`);
  } else {
    applyWiring({ root, framework: inspect.framework, srcDir: inspect.layout.srcDir, routes: inspect.layout.routes, port: effPort, projectId: project.id });
    // Registra subito il progetto nell'hub multi-repo: "installare = l'app manda
    // segnalazioni E risulta registrata nel BugBay centrale", senza aspettare
    // il primo `bugbay dev` in questo repo.
    registerProject({ id: project.id, name: project.name, root, writeScope: config.agent.writeScope, sensitiveFiles: config.agent.sensitiveFiles });
    ok(`Registrato nell'hub multi-repo (${c.bold(project.name)}).`);
  }

  log('');
  log(c.bold('  Poi avvia il daemon'));
  log(`    ${c.cyan(`${runner(inspect.packageManager)} bugbay dev`)}`);
  log('');
  ok('Pronto. Il widget comparirà nella tua app quando il daemon è attivo.');
  log('');
}

/** Comando consigliato per eseguire un bin a seconda del package manager. */
function runner(pm) {
  if (pm === 'pnpm') return 'pnpm';
  if (pm === 'yarn') return 'yarn';
  if (pm === 'bun') return 'bunx';
  return 'npx';
}
