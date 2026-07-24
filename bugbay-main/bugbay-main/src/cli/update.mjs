/**
 * `bugbay update` — aggiorna BugBay nel progetto corrente all'ultima versione:
 * reinstalla lo spec dichiarato in package.json (per i git-spec tipo
 * `github:finzidev/bugbay` npm ri-risolve l'HEAD del branch), poi riallinea la
 * copia del widget in public/ (install online). La console si auto-aggiorna al
 * prossimo `bugbay dev`: la cache in ~/.bugbay-cache è per-versione.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { syncPublicWidget } from './dev.mjs';
import { resolveCaCert, caSetupInstructions } from './registry.mjs';
import { c, log, info, ok, warn, err, readJson, fileExists } from './util.mjs';

export async function updateCommand() {
  const root = process.cwd();
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg) { err('Nessun package.json qui: esegui `bugbay update` nella radice del progetto.'); process.exitCode = 1; return; }

  const inDev = Boolean(pkg.devDependencies?.bugbay);
  const spec = pkg.devDependencies?.bugbay || pkg.dependencies?.bugbay;
  if (!spec) {
    warn('BugBay non è tra le dipendenze di questo progetto.');
    log(`  Installa con: ${c.cyan('npm install -D github:finzidev/bugbay')}`);
    process.exitCode = 1;
    return;
  }

  const before = readJson(path.join(root, 'node_modules', 'bugbay', 'package.json'))?.version || '?';
  log('');
  log(c.bold(c.magenta('  BugBay · update')));
  info(`Versione installata: ${c.bold(before)} · spec: ${c.dim(spec)}`);

  // Reinstallare lo spec ri-risolve i git-spec all'ultimo commit del branch.
  // Git/URL spec vanno passati "nudi" a npm; le versioni npm come bugbay@<range>.
  const installArg = /^(github:|git\+|git:|https?:|file:)/.test(spec) ? spec : `bugbay@${spec}`;
  const args = ['install', inDev ? '-D' : '-S', installArg, '--no-audit', '--no-fund'];
  // TLS: nessun bypass. Dietro un proxy che ispeziona il TLS, fornisci il CA
  // aziendale via NODE_EXTRA_CA_CERTS (env o ~/.bugbay/env.json): viene aggiunto
  // al trust store, non lo rimpiazza.
  const ca = resolveCaCert();
  if (ca && !fileExists(ca.path)) {
    err(`Certificato CA non trovato: ${ca.path} (configurato da ${ca.source}).`);
    err('Correggi NODE_EXTRA_CA_CERTS e riprova.'); process.exitCode = 1; return;
  }
  const npmEnv = ca ? { ...process.env, NODE_EXTRA_CA_CERTS: ca.path } : process.env;
  const r = spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: true, env: npmEnv });
  if (r.status !== 0) {
    err('Aggiornamento fallito (vedi output npm sopra).');
    if (ca) err(`Il CA configurato (${ca.path}) non ha risolto il problema: verifica il PEM.`);
    else caSetupInstructions().forEach((line) => warn(line));
    process.exitCode = 1; return;
  }

  const after = readJson(path.join(root, 'node_modules', 'bugbay', 'package.json'))?.version || '?';
  ok(after === before ? `Già all'ultima versione (${after}).` : `Aggiornato: ${before} → ${c.bold(after)}.`);

  // Riallinea l'eventuale copia del widget in public/ (install online).
  syncPublicWidget(root);

  log('');
  log(`  Al prossimo ${c.cyan('bugbay dev')} la console usa la nuova versione (cache per-versione, si prepara da sola).`);
  log('');
}
