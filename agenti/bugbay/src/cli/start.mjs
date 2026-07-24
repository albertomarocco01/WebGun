/**
 * `bugbay start` — daemon di PRODUZIONE per il 24/7 autonomo. A differenza di
 * `bugbay dev` (`next dev`, ricompila/hot-reload/leaka), qui: `next build` UNA VOLTA
 * per versione → `next start`. È il comando che i task Scheduler (at-logon +
 * watchdog) rilanciano. Bind loopback, porta FISSA da config (niente drift di porta:
 * il watchdog deve sapere dove sondare la liveness).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { prepareDaemon, printBanner, configuredPort, isPortAlive, VERSION } from './daemon.mjs';
import { info, ok, warn, err } from './util.mjs';

export async function startCommand(opts = {}) {
  const root = opts.root ? path.resolve(String(opts.root)) : process.cwd();
  const port = configuredPort(root, opts);

  // Idempotenza: se un daemon sano è già sulla porta, non doppio-spawnare
  // (il task at-logon e un `start` manuale potrebbero sovrapporsi).
  if (await isPortAlive(port)) {
    ok(`BugBay è già attivo su http://localhost:${port} — niente da fare.`);
    return;
  }

  const ctx = await prepareDaemon({ root, opts, nodeEnv: 'production' });

  // Build una volta per versione: `.next/BUILD_ID` esiste solo dopo un build ok.
  // La cache app è per-versione, quindi il marker sopravvive tra i restart e
  // ricompila solo al bump di versione.
  const buildId = path.join(ctx.appDir, '.next', 'BUILD_ID');
  if (!fs.existsSync(buildId)) {
    info(`Compilo la console per la produzione (una volta per la versione ${VERSION})...`);
    const r = spawnSync(process.execPath, [ctx.nextBin, 'build'], { cwd: ctx.appDir, stdio: 'inherit', env: ctx.childEnv });
    if (r.status !== 0 || !fs.existsSync(buildId)) {
      err('`next build` fallito: impossibile avviare il daemon di produzione.');
      process.exit(1);
    }
  }

  printBanner({ mode: 'start', port, projectName: ctx.projectName, root, storageLabel: ctx.storageLabel });

  const child = spawn(process.execPath, [ctx.nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ctx.appDir,
    stdio: 'inherit',
    env: ctx.childEnv,
  });

  const stop = () => { try { child.kill(); } catch { /* già morto */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => {
    if (code) warn(`Il processo Next è uscito con codice ${code}.`);
    process.exit(code ?? 0);
  });
}
