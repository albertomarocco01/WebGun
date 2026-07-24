/**
 * `bugbay dev` — avvia il daemon in SVILUPPO: l'app Next bundlata (console + API +
 * motore di fix) via `next dev`, dalla cache per-versione fuori da node_modules.
 * Per il 24/7 autonomo usa `bugbay start` (produzione: `next build` una volta →
 * `next start`), NON questo comando: `next dev` ricompila/hot-reload/leaka.
 *
 * La preparazione (copia app, deps, CA, storage, env) vive in `daemon.mjs`, condivisa
 * con `bugbay start` così l'ambiente del figlio Next ha UN SOLO punto di verità.
 */
import { spawn } from 'node:child_process';
import { findFreePort, prepareDaemon, printBanner, configuredPort } from './daemon.mjs';
import { setMaintenancePause } from './lifecycle.mjs';
import { warn } from './util.mjs';

// Re-export per compat: `update.mjs` importa syncPublicWidget da qui.
export { syncPublicWidget } from './daemon.mjs';

export async function devCommand(opts = {}) {
  const root = process.cwd();
  const wanted = configuredPort(root, opts);
  const port = await findFreePort(wanted);
  if (port !== wanted) warn(`Porta ${wanted} occupata → uso la ${port}.`);

  const ctx = await prepareDaemon({ root, opts, nodeEnv: 'development' });
  printBanner({ mode: 'dev', port, projectName: ctx.projectName, root, storageLabel: ctx.storageLabel });

  // Maintenance-pause: mentre un umano lavora in `bugbay dev`, il watchdog NON
  // deve rilanciare il daemon di produzione (eviterebbe di combattere lo stop
  // manuale). Il flag è machine-scoped; lo togliamo all'uscita (pulita o segnale).
  setMaintenancePause(true, `bugbay dev (pid ${process.pid})`);
  let released = false;
  const release = () => { if (released) return; released = true; try { setMaintenancePause(false); } catch { /* best-effort */ } };

  // Bind loopback: il daemon non va esposto sulla LAN.
  const child = spawn(process.execPath, [ctx.nextBin, 'dev', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ctx.appDir,
    stdio: 'inherit',
    env: ctx.childEnv,
  });

  const stop = () => { release(); try { child.kill(); } catch { /* già morto */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => { release(); process.exit(code ?? 0); });
}
