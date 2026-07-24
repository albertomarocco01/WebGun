/**
 * `bugbay watchdog` — UN tick del guardiano 24/7 (lanciato dal task Scheduler ogni
 * 5 min). Responsabilità:
 *   1. Dead-man esterno: ping a healthchecks.io ad OGNI tick → prova che il logon
 *      (e quindi il watchdog) è vivo. Reboot senza auto-logon = ping mancante =
 *      unico segnale superstite (daemon+watchdog+toast muoiono insieme, A13).
 *   2. Liveness locale: probe TCP sulla porta del daemon. Se morto → rilancia
 *      `bugbay start` (detached) + toast Windows. Se maintenance-pause → NON rilancia
 *      (non combatte uno stop manuale di `bugbay dev`).
 *
 * È un processo one-shot: fa il tick e esce. Nessun file dell'app web toccato.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { hubDir, isPortAlive } from './daemon.mjs';
import { readAutostart, isMaintenancePaused, runPs } from './lifecycle.mjs';

const LOG_MAX_BYTES = 256 * 1024;

export async function watchdogCommand() {
  const cfg = readAutostart();
  if (!cfg || !cfg.port) {
    // Niente da guardare: `bugbay install` non è mai stato eseguito.
    logLine('no-autostart: nessun descrittore, esco.');
    return;
  }

  const paused = isMaintenancePaused();
  const alive = await isPortAlive(cfg.port);

  if (alive) {
    logLine(`ok: daemon vivo su :${cfg.port}${paused ? ' (maintenance-pause)' : ''}`);
    await pingHealthchecks(cfg.healthchecksUrl);
    return;
  }

  if (paused) {
    // Stop manuale in corso: non combattere. Il ping resta (il logon è vivo).
    logLine(`paused: daemon giù su :${cfg.port} ma maintenance-pause attivo → nessun restart`);
    await pingHealthchecks(cfg.healthchecksUrl);
    return;
  }

  // Daemon morto e nessuna manutenzione → restart.
  logLine(`dead: daemon giù su :${cfg.port} → rilancio \`bugbay start\``);
  const started = restartDaemon(cfg);
  toast('BugBay riavviato', started
    ? `Il daemon era giù (porta ${cfg.port}) ed è stato rilanciato.`
    : `Il daemon è giù (porta ${cfg.port}) e il rilancio è fallito.`);
  await pingHealthchecks(cfg.healthchecksUrl);
}

/** Rilancia `bugbay start` staccato dal watchdog (che tra poco esce). */
function restartDaemon(cfg) {
  try {
    const node = cfg.node || process.execPath;
    const bin = cfg.bin;
    const args = [bin, 'start', '--root', cfg.root];
    if (cfg.hub) args.push('--hub');
    const child = spawn(node, args, {
      cwd: cfg.root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return true;
  } catch (e) {
    logLine(`restart-error: ${e?.message || e}`);
    return false;
  }
}

/**
 * Dead-man out-of-band: GET dell'URL healthchecks.io. Best-effort, timeout breve.
 * Opt-in: se l'URL non è configurato all'install, no-op.
 */
async function pingHealthchecks(url) {
  if (!url) return;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      await fetch(url, { method: 'GET', signal: ac.signal, headers: { 'User-Agent': 'bugbay-watchdog' } });
      logLine(`heartbeat: ping ok`);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    logLine(`heartbeat-error: ${e?.message || e}`);
  }
}

/**
 * Toast Windows best-effort via NotifyIcon (balloon), staccato così non blocca il
 * tick. Nessuna dipendenza: usa System.Windows.Forms. Se fallisce, silenzioso.
 */
function toast(title, message) {
  if (process.platform !== 'win32') return;
  const esc = (s) => String(s).replace(/'/g, "''");
  const script = `
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $ni = New-Object System.Windows.Forms.NotifyIcon
  $ni.Icon = [System.Drawing.SystemIcons]::Information
  $ni.BalloonTipTitle = '${esc(title)}'
  $ni.BalloonTipText = '${esc(message)}'
  $ni.Visible = $true
  $ni.ShowBalloonTip(6000)
  Start-Sleep -Seconds 7
  $ni.Dispose()
} catch { }
`;
  try {
    // runPs è sincrono; per non bloccare 7s, lo stacchiamo in un processo a parte.
    const file = path.join(hubDir(), `._bugbay-toast-${process.pid}-${Date.now()}.ps1`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, script, 'utf8');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    // Cleanup differito del file temporaneo.
    setTimeout(() => { try { fs.rmSync(file, { force: true }); } catch { /* noop */ } }, 15000).unref?.();
  } catch { /* best-effort */ }
}

/** Log rotante minimale in ~/.bugbay/watchdog.log (+ timestamp last-tick). */
function logLine(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  try {
    const dir = hubDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'watchdog.log');
    try {
      const st = fs.statSync(file);
      if (st.size > LOG_MAX_BYTES) fs.rmSync(file, { force: true });
    } catch { /* file assente */ }
    fs.appendFileSync(file, line);
    fs.writeFileSync(path.join(dir, 'watchdog-last'), new Date().toISOString() + '\n');
  } catch { /* best-effort */ }
}
