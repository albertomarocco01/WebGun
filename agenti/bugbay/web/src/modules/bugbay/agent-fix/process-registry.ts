/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Registro PERSISTENTE dei PID dei processi figli a vita lunga del fix agentico
 * (la CLI `claude`, fino a 15 min per il Fixer). In memoria i processi vivono in
 * claude.ts (per l'abort), ma un crash/riavvio del daemon Next perderebbe quei
 * riferimenti lasciando processi ORFANI che continuano a girare — e a editare il
 * repo — senza più nessuno che li fermi al timeout. Qui i PID sono persistiti su
 * file e, al primo avvio del processo, quelli rimasti vivi da una generazione
 * PRECEDENTE del daemon vengono uccisi (reaper).
 *
 * Il PID da solo NON è un'identità: il SO lo ricicla, e un kill alla cieca
 * colpirebbe un processo estraneo (un altro `node`, o persino la sessione Claude
 * Code dell'utente). Prima del kill si verifica quindi che (a) non sia il processo
 * corrente, (b) l'immagine combaci, e soprattutto (c) lo START-TIME del processo
 * vivo NON sia successivo alla registrazione: un PID riciclato appartiene a un
 * processo nato DOPO, quindi viene risparmiato. Se l'identità non è verificabile
 * NON si uccide (fail-safe): meglio un orfano vivo che un kill sbagliato.
 *
 * @indice
 * - registerChild / unregisterChild → traccia/dimentica un PID figlio (con start-time)
 * - reapOrphans                     → all'avvio uccide gli orfani della gen. precedente
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { bugbayDataDir } from './target-root';

interface PidEntry {
  /** Eseguibile spawnato (immagine attesa del processo). */
  image: string;
  runId: string;
  /** Momento della registrazione (ms epoch): un processo nato dopo NON è il nostro. */
  startedAt: number;
}
type Registry = Record<string, PidEntry>;

/** Tolleranza start-time (ms): copre l'arrotondamento al secondo di `ps -o etimes`. */
const START_SLACK_MS = 3000;

const file = (): string => path.join(bugbayDataDir(), 'agent-pids.json');

function read(): Registry {
  try { return JSON.parse(fs.readFileSync(file(), 'utf-8')) as Registry; } catch { return {}; }
}
function write(reg: Registry): void {
  try {
    const f = file();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(reg), 'utf-8');
    fs.renameSync(tmp, f);
  } catch { /* best-effort: la perdita del registro degrada solo il reaper */ }
}

/** basename lowercase senza estensione: rende confrontabili "node.exe" e "node". */
function baseName(p: string): string {
  return path.basename(p).toLowerCase().replace(/\.(exe|cmd|bat)$/, '');
}

/** Registra un processo figlio a vita lunga (`image` = eseguibile passato a spawn). */
export function registerChild(pid: number | undefined, image: string, runId: string): void {
  if (!pid) return;
  const reg = read();
  reg[String(pid)] = { image, runId, startedAt: Date.now() };
  write(reg);
}

/** Dimentica un processo figlio chiuso normalmente. */
export function unregisterChild(pid: number | undefined): void {
  if (!pid) return;
  const reg = read();
  if (reg[String(pid)]) { delete reg[String(pid)]; write(reg); }
}

/** True se `pid` è vivo: `kill(pid, 0)` non lancia ESRCH (EPERM = vivo ma non nostro). */
function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

interface ProcInfo { image: string; startedMs: number }

/**
 * Immagine + start-time (ms epoch) del processo `pid`, o null se non risolvibile.
 * Windows: CIM Win32_Process (Name + CreationDate). POSIX: `ps -o comm=,etimes=`
 * (etimes = secondi trascorsi → start = ora − trascorsi). Una sola query per PID.
 */
function processInfo(pid: number): ProcInfo | null {
  try {
    if (process.platform === 'win32') {
      const script = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction SilentlyContinue; if($p){[Console]::Out.Write($p.Name+'|'+([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds())}`;
      const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf-8', timeout: 8000 });
      const [name, ms] = (r.stdout || '').trim().split('|');
      const startedMs = Number(ms);
      return name && Number.isFinite(startedMs) ? { image: name, startedMs } : null;
    }
    const r = spawnSync('ps', ['-p', String(pid), '-o', 'comm=,etimes='], { encoding: 'utf-8', timeout: 5000 });
    const parts = (r.stdout || '').trim().split(/\s+/);
    const etimes = Number(parts[parts.length - 1]);
    const image = parts.slice(0, -1).join(' ') || parts[0];
    return image && Number.isFinite(etimes) ? { image, startedMs: Date.now() - etimes * 1000 } : null;
  } catch { return null; }
}

/**
 * All'avvio del processo: uccide i PID registrati che sono con ALTA CONFIDENZA gli
 * orfani che avevamo spawnato (generazione precedente del daemon), poi li rimuove
 * dal registro. Uccide solo se TUTTO combacia: pid ≠ processo corrente, immagine
 * uguale, e start-time del processo vivo non successivo alla registrazione (un PID
 * riciclato appartiene a un processo nato dopo → risparmiato). Se l'identità non è
 * verificabile (processInfo null, o startedAt mancante) NON uccide (fail-safe).
 * Rimuove solo i PID esaminati (non azzera in blocco), così un eventuale figlio
 * registrato in concorrenza da questa generazione non viene perso.
 */
export function reapOrphans(): void {
  const reg = read();
  const pids = Object.keys(reg);
  if (!pids.length) return;
  for (const p of pids) {
    const pid = Number(p);
    const entry = reg[p];
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue; // mai sé stessi
    if (!Number.isFinite(entry.startedAt)) continue;                          // entry legacy → non verificabile
    if (!isAlive(pid)) continue;
    const info = processInfo(pid);
    if (!info) continue;                                                      // identità ignota → fail-safe
    if (baseName(info.image) !== baseName(entry.image)) continue;            // altro programma
    if (info.startedMs > entry.startedAt + START_SLACK_MS) continue;         // nato dopo → PID riciclato
    try { process.kill(pid, 'SIGKILL'); } catch { /* già morto tra check e kill */ }
  }
  const after = read();
  for (const p of pids) delete after[p];
  write(after);
}
