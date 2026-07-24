/**
 * `bugbay install` / `bugbay uninstall` — barriera 24/7 (Track P).
 *
 * Registra il daemon come task del Windows Task Scheduler:
 *   • `\BugBay\Daemon`   — at-logon, rilancia `bugbay start` (produzione).
 *   • `\BugBay\Watchdog` — ogni 5 min, `bugbay watchdog` (restart+dead-man+toast).
 *
 * Registrazione via `Register-ScheduledTask` (cmdlet ScheduledTasks, COM sotto):
 * NON `schtasks` (ACCESS DENIED non-elevato). RunLevel Limited = utente corrente,
 * nessuna elevazione. All'install: check ARSO (auto-restart sign-on) con warning se
 * assente, e opt-in heartbeat healthchecks.io. Nessun file dell'app web toccato:
 * la liveness è un probe TCP esterno sulla porta loopback del daemon.
 *
 * Owner unico: src/cli/*. Windows-only (i task Scheduler non esistono altrove).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { hubDir, BIN_PATH, VERSION, configuredPort } from './daemon.mjs';
import { CONFIG_FILENAME } from './config.mjs';
import { c, log, info, ok, warn, err, readJson } from './util.mjs';

const TASK_PATH = '\\BugBay\\';
const TASK_DAEMON = 'Daemon';
const TASK_WATCHDOG = 'Watchdog';

/** File di stato lifecycle (tutti machine-scoped in ~/.bugbay). */
export function autostartPath() { return path.join(hubDir(), 'autostart.json'); }
export function maintenancePausePath() { return path.join(hubDir(), 'maintenance-pause'); }

/** Descrittore di cosa/dove il daemon 24/7 deve avviarsi (scritto da install). */
export function readAutostart() { return readJson(autostartPath()); }

/**
 * Flag maintenance-pause: quando presente, il watchdog NON rilancia il daemon
 * (così non combatte uno stop manuale di `bugbay dev`). Best-effort su ogni scrittura.
 */
export function setMaintenancePause(on, reason = '') {
  const file = maintenancePausePath();
  try {
    if (on) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ since: new Date().toISOString(), reason }) + '\n');
    } else if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
    }
  } catch { /* best-effort */ }
}

export function isMaintenancePaused() {
  try { return fs.existsSync(maintenancePausePath()); } catch { return false; }
}

// ── ARSO (Auto Restart Sign-On) ────────────────────────────────────────────
/**
 * ARSO ("Usa i miei dati di accesso per completare la configurazione dopo un
 * riavvio") ri-logga l'utente dopo un reboot: senza, il task at-logon non parte
 * finché nessuno fa login → daemon+watchdog+toast muoiono insieme (blind spot A13).
 * Il consenso è per-utente sotto Winlogon\<SID> (OptOut=0 = ARSO ON). Chiave assente
 * o OptOut=1 → NON attivo → warning (non blocca: heartbeat esterno è la rete di sotto).
 */
export function checkArso() {
  const script = [
    "$sid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value",
    "$k = \"HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\$sid\"",
    "if (Test-Path $k) { $v = (Get-ItemProperty $k).OptOut; if ($null -eq $v) { 'CONSENTED' } elseif ($v -eq 0) { 'ENABLED' } else { 'OPTOUT' } } else { 'ABSENT' }",
  ].join('; ');
  const r = runPs(script, 'pipe');
  const state = String(r.stdout || '').trim();
  const enabled = state === 'ENABLED' || state === 'CONSENTED';
  return { enabled, state };
}

// ── PowerShell runner ──────────────────────────────────────────────────────
/**
 * Esegue uno script PowerShell scrivendolo su file (evita l'inferno del quoting di
 * `-Command`) e lanciandolo con `-File`. `mode`: 'inherit' (mostra l'output) o
 * 'pipe' (cattura stdout). Best-effort: il chiamante gestisce lo status.
 */
export function runPs(script, mode = 'inherit') {
  const file = path.join(hubDir(), `._bugbay-ps-${process.pid}-${Date.now()}.ps1`);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, script, 'utf8');
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], {
      stdio: mode === 'pipe' ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      encoding: 'utf8',
    });
  } finally {
    try { fs.rmSync(file, { force: true }); } catch { /* best-effort */ }
  }
}

/** Escape di una stringa per un literal single-quoted PowerShell ('' = '). */
function ps(s) { return String(s).replace(/'/g, "''"); }

// ── install / uninstall ────────────────────────────────────────────────────
export async function installCommand(opts = {}) {
  if (process.platform !== 'win32') {
    err('`bugbay install` registra i task del Windows Task Scheduler: supportato solo su Windows.');
    process.exitCode = 1;
    return;
  }
  const root = opts.root ? path.resolve(String(opts.root)) : process.cwd();
  if (!readJson(path.join(root, CONFIG_FILENAME))) {
    warn(`Nessun ${CONFIG_FILENAME} in ${root}: esegui prima \`bugbay init\` / \`bugbay setup\`.`);
  }
  const port = configuredPort(root, opts);
  const hub = !!opts.hub;
  const healthchecksUrl = typeof opts.healthchecks === 'string' ? opts.healthchecks.trim() : '';

  log('');
  log(c.bold(c.magenta('  BugBay · install (24/7)')));
  log('');
  info(`Target:   ${c.dim(root)}`);
  info(`Porta:    ${c.bold(String(port))}${hub ? c.dim(' (hub)') : ''}`);
  info(`Node:     ${c.dim(process.execPath)}`);

  // Descrittore autostart (fonte unica per watchdog + task at-logon).
  const descriptor = {
    version: VERSION,
    root,
    port,
    hub,
    node: process.execPath,
    bin: BIN_PATH,
    healthchecksUrl,
    createdAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(hubDir(), { recursive: true });
    fs.writeFileSync(autostartPath(), JSON.stringify(descriptor, null, 2) + '\n');
  } catch (e) {
    err(`Impossibile scrivere ${autostartPath()}: ${e?.message || e}`);
    process.exitCode = 1;
    return;
  }

  // Argomenti del daemon: la porta viene da config; --root fissa il repo target.
  const startArgs = `"${ps(BIN_PATH)}" start --root "${ps(root)}"${hub ? ' --hub' : ''}`;
  const watchArgs = `"${ps(BIN_PATH)}" watchdog`;

  const script = `
$ErrorActionPreference = 'Stop'
$node = '${ps(process.execPath)}'
$root = '${ps(root)}'

# --- Daemon: at-logon, produzione (next start). ExecutionTimeLimit 0 = nessun limite.
$dAct = New-ScheduledTaskAction -Execute $node -Argument '${ps(startArgs)}' -WorkingDirectory $root
$dTrg = New-ScheduledTaskTrigger -AtLogOn
$dSet = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName '${TASK_DAEMON}' -TaskPath '${TASK_PATH}' -Action $dAct -Trigger $dTrg -Settings $dSet -RunLevel Limited -Force | Out-Null
Write-Output 'OK Daemon'

# --- Watchdog: ogni 5 min + at-logon. Tick killato a 4 min (< intervallo) se appeso.
$wAct = New-ScheduledTaskAction -Execute $node -Argument '${ps(watchArgs)}'
$wRep = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$wLogon = New-ScheduledTaskTrigger -AtLogOn
$wSet = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
Register-ScheduledTask -TaskName '${TASK_WATCHDOG}' -TaskPath '${TASK_PATH}' -Action $wAct -Trigger @($wRep, $wLogon) -Settings $wSet -RunLevel Limited -Force | Out-Null
Write-Output 'OK Watchdog'
`;

  const r = runPs(script, 'pipe');
  const out = String(r.stdout || '');
  const errout = String(r.stderr || '').trim();
  if (r.status !== 0 || !out.includes('OK Watchdog')) {
    err('Registrazione dei task Scheduler fallita.');
    if (errout) errout.split(/\r?\n/).forEach((l) => l.trim() && warn(l.trim()));
    process.exitCode = 1;
    return;
  }
  ok(`Task registrati: ${c.cyan(`${TASK_PATH}${TASK_DAEMON}`)} (at-logon) + ${c.cyan(`${TASK_PATH}${TASK_WATCHDOG}`)} (5 min).`);

  // ARSO: warning non bloccante se non attivo (blind spot reboot/no-auto-logon).
  const arso = checkArso();
  if (arso.enabled) {
    ok('ARSO attivo: dopo un reboot l\'utente viene ri-loggato e il daemon riparte.');
  } else {
    warn(`ARSO non attivo (stato: ${arso.state}). Dopo un reboot senza login manuale il daemon`);
    warn('  non riparte da solo. Attivalo: Impostazioni → Account → Opzioni di accesso →');
    warn('  "Usa i miei dati di accesso per completare la configurazione dopo un aggiornamento/riavvio".');
    if (healthchecksUrl) warn('  (l\'heartbeat healthchecks.io ti avvisa comunque se il ping salta.)');
    else warn('  Consiglio: aggiungi --healthchecks <url> per un dead-man esterno che sopravvive al reboot.');
  }

  if (healthchecksUrl) ok(`Heartbeat esterno: ${c.dim(healthchecksUrl)} (ping ad ogni tick watchdog).`);
  else info('Heartbeat esterno healthchecks.io: disattivato (opt-in con --healthchecks <url>).');

  log('');
  log(`  Il daemon parte al prossimo login, o subito con: ${c.cyan('bugbay start')}`);
  log(`  Per rimuovere i task:                            ${c.cyan('bugbay uninstall')}`);
  log('');
}

export async function uninstallCommand() {
  if (process.platform !== 'win32') {
    err('`bugbay uninstall` è supportato solo su Windows.');
    process.exitCode = 1;
    return;
  }
  const script = `
foreach ($n in @('${TASK_DAEMON}','${TASK_WATCHDOG}')) {
  try { Unregister-ScheduledTask -TaskName $n -TaskPath '${TASK_PATH}' -Confirm:$false -ErrorAction Stop; Write-Output "removed $n" }
  catch { Write-Output "absent $n" }
}
`;
  const r = runPs(script, 'pipe');
  String(r.stdout || '').split(/\r?\n/).forEach((l) => { if (l.trim()) info(l.trim()); });
  try { fs.rmSync(autostartPath(), { force: true }); } catch { /* best-effort */ }
  setMaintenancePause(false);
  ok('Task 24/7 rimossi (descrittore autostart cancellato).');
}
