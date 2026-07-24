/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * RADAR di manutenzione (v0.9) — scanner NOTIFY-ONLY della salute delle
 * dipendenze del repo target. Legge il `package.json` dell'host, confronta i
 * range dichiarati con la versione installata e con l'ultima pubblicata sul
 * registry, e scrive le derive in `radar_findings` (tabella congelata, Appendice
 * A). Due generi di segnalazione:
 *   - `dep-major`  → esiste un major NUOVO oltre quello dichiarato (nessuna rete
 *                    di sicurezza BRT: i major si NOTIFICANO, non si applicano).
 *   - `dep-drift` → la versione installata NON soddisfa più il range dichiarato
 *                    (deriva install/lockfile), rilevabile OFFLINE.
 *
 * INVARIANTE DI SICUREZZA (load-bearing): il radar NON applica MAI nulla. Il solo
 * effetto della scansione è scrivere righe informative. L'azione umana "file as
 * fix" (nel route) RIUSA la ingest esistente (`POST /api/debug-reports` →
 * `autoIngestReport`) creando una segnalazione/run che l'umano dovrà approvare —
 * il radar non tocca né git né i file, né crea run direttamente.
 *
 * DEDUP: prima di inserire si verifica l'esistenza di un finding con lo stesso
 * (project_id, kind, title) a QUALSIASI stato — così un finding già archiviato
 * (`dismissed`) o già trasformato in fix (`filed`) non viene ri-notificato a ogni
 * giro. Il `title` incorpora la versione bersaglio: cambia solo quando cambia la
 * situazione (es. arriva un major ulteriore), generando allora un nuovo finding.
 *
 * ACCESSO SPINA: la tabella `radar_findings` è di proprietà di questo modulo;
 * hub.ts (contratto congelato) espone `openHubDb()` — qui si fanno le SELECT/
 * INSERT su colonne esplicite = `RadarFindingRow`. Nessuna scrittura sulle altre
 * tabelle: gli `alerts` si leggono soltanto (vista SYSTEM).
 *
 * @indice
 * - scanDependencies  → scansione best-effort, scrive i nuovi finding, ritorna il riassunto
 * - listRadarFindings → finding aperti/recenti per la vista SYSTEM (read-only)
 * - listRecentAlerts  → ultimi alert della spina per la vista SYSTEM (read-only)
 * - getFinding        → singolo finding per id (usato dal "file as fix")
 * - markFindingFiled  → segna un finding come `filed` dopo l'ingest
 * - dismissFinding    → archivia un finding (`dismissed`), niente più notifiche
 */

import fs from 'fs';
import path from 'path';
import * as semver from 'semver';
import { openHubDb, type RadarFindingRow, type AlertRow } from './hub';
import { targetRoot } from './target-root';
import { projectId } from '../lib/project';

/** Generi di finding prodotti dal radar (colonna `kind` di radar_findings). */
export type RadarKind = 'dep-major' | 'dep-drift';

/** Riassunto di una scansione (per l'eco al chiamante / route). */
export interface RadarScanResult {
  /** Dipendenze considerate (range risolvibili). */
  scanned: number;
  /** Finding NUOVI inseriti in questo giro (esclusi i dedup). */
  inserted: number;
  /** Vero se la rete verso il registry era disponibile per almeno un pacchetto. */
  registryReachable: boolean;
  /** I finding inseriti in questo giro. */
  findings: RadarFindingRow[];
}

// Prefissi di range che NON puntano al registry pubblico: si saltano (il radar
// ragiona solo su versioni semver pubblicate). Include workspace/monorepo, path
// locali, tarball, git e alias.
const NON_REGISTRY = /^(workspace:|file:|link:|git\+|git:|https?:|github:|npm:|catalog:|portal:)/i;

/** Legge e fa il parse del package.json del repo target; null se assente/illeggibile. */
interface TargetPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
function readTargetPackageJson(): TargetPackageJson | null {
  try {
    const raw = fs.readFileSync(path.join(targetRoot(), 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TargetPackageJson) : null;
  } catch {
    return null;
  }
}

/** Versione realmente installata di un pacchetto (da node_modules), o null. */
function installedVersion(name: string): string | null {
  try {
    const raw = fs.readFileSync(
      path.join(targetRoot(), 'node_modules', name, 'package.json'),
      'utf8',
    );
    const v = (JSON.parse(raw) as { version?: string }).version;
    return typeof v === 'string' && semver.valid(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Ultima versione pubblicata sul registry (best-effort). Timeout corto e
 * TOLLERANTE agli errori (rete/TLS possono fallire su questa macchina): in caso
 * di errore ritorna null e la scansione degrada al solo controllo offline
 * (dep-drift), senza mai lanciare.
 */
async function latestFromRegistry(name: string, timeoutMs = 4000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
      signal: controller.signal,
      headers: { accept: 'application/vnd.npm.install-v1+json, application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return typeof body.version === 'string' && semver.valid(body.version) ? body.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Vero se esiste già un finding con la stessa firma (dedup a qualsiasi stato). */
function findingExists(pid: string | null, kind: RadarKind, title: string): boolean {
  const db = openHubDb();
  const row = db
    .prepare(
      `SELECT 1 FROM radar_findings
        WHERE kind = ? AND title = ? AND (project_id IS ? OR project_id = ?)
        LIMIT 1`,
    )
    .get(kind, title, pid, pid);
  return !!row;
}

/** INSERT di un finding NUOVO (colonne esplicite = RadarFindingRow). Ritorna la riga. */
function insertFinding(
  pid: string | null,
  kind: RadarKind,
  title: string,
  detail: Record<string, unknown>,
): RadarFindingRow {
  const row: RadarFindingRow = {
    id: crypto.randomUUID(),
    project_id: pid,
    kind,
    title,
    detail: JSON.stringify(detail),
    status: 'new',
    created_at: new Date().toISOString(),
  };
  openHubDb()
    .prepare(
      `INSERT INTO radar_findings (id, project_id, kind, title, detail, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.project_id, row.kind, row.title, row.detail, row.status, row.created_at);
  return row;
}

/**
 * Scansione NOTIFY-ONLY delle dipendenze del repo target. Best-effort e
 * non-throwing: se il package.json manca, ritorna un riassunto vuoto; se la rete
 * è giù, produce comunque i dep-drift offline. Ogni finding nuovo (non-dedup)
 * viene scritto in radar_findings con status='new'.
 */
export async function scanDependencies(): Promise<RadarScanResult> {
  const pkg = readTargetPackageJson();
  const pid = projectId();
  const result: RadarScanResult = {
    scanned: 0,
    inserted: 0,
    registryReachable: false,
    findings: [],
  };
  if (!pkg) return result;

  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, range] of Object.entries(deps)) {
    if (typeof range !== 'string' || NON_REGISTRY.test(range)) continue;
    // Range risolvibile a un minimo semver? (esclude '*', 'latest', tag arbitrari)
    const min = semver.minVersion(range);
    if (!min) continue;
    result.scanned++;

    const declaredMajor = min.major;
    const installed = installedVersion(name);

    // ── dep-drift (OFFLINE): l'installato non soddisfa il range dichiarato ──
    if (installed && !semver.satisfies(installed, range, { includePrerelease: true })) {
      const title = `${name}: installato ${installed} fuori dal range ${range}`;
      if (!findingExists(pid, 'dep-drift', title)) {
        result.findings.push(
          insertFinding(pid, 'dep-drift', title, { name, range, installed }),
        );
        result.inserted++;
      }
    }

    // ── dep-major (RETE, best-effort): esiste un major oltre il dichiarato ──
    const latest = await latestFromRegistry(name);
    if (latest) {
      result.registryReachable = true;
      const latestMajor = semver.major(latest);
      if (latestMajor > declaredMajor) {
        const title = `${name}: major ${latestMajor} disponibile (dichiarato ${range})`;
        if (!findingExists(pid, 'dep-major', title)) {
          result.findings.push(
            insertFinding(pid, 'dep-major', title, {
              name,
              range,
              installed,
              latest,
              latestMajor,
              declaredMajor,
            }),
          );
          result.inserted++;
        }
      }
    }
  }

  return result;
}

/**
 * Finding del radar per la vista SYSTEM (read-only). Di default esclude gli
 * archiviati (`dismissed`), più recenti in testa. `all=true` li include per un
 * eventuale storico.
 */
export function listRadarFindings(opts?: { limit?: number; all?: boolean }): RadarFindingRow[] {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const db = openHubDb();
  const sql = opts?.all
    ? `SELECT id, project_id, kind, title, detail, status, created_at
         FROM radar_findings ORDER BY created_at DESC LIMIT ?`
    : `SELECT id, project_id, kind, title, detail, status, created_at
         FROM radar_findings WHERE status != 'dismissed' ORDER BY created_at DESC LIMIT ?`;
  return db.prepare(sql).all(limit) as RadarFindingRow[];
}

/** Ultimi alert della spina (read-only) per la vista SYSTEM, più recenti in testa. */
export function listRecentAlerts(limit = 30): AlertRow[] {
  const capped = Math.min(Math.max(limit, 1), 200);
  const db = openHubDb();
  return db
    .prepare(
      `SELECT id, channel, severity, run_id, message, detail, created_at, ack_at
         FROM alerts ORDER BY created_at DESC LIMIT ?`,
    )
    .all(capped) as AlertRow[];
}

/** Singolo finding per id (o undefined). Usato dal flusso "file as fix". */
export function getFinding(id: string): RadarFindingRow | undefined {
  const db = openHubDb();
  const row = db
    .prepare(
      `SELECT id, project_id, kind, title, detail, status, created_at
         FROM radar_findings WHERE id = ?`,
    )
    .get(id);
  return (row as RadarFindingRow | undefined) ?? undefined;
}

/** Segna un finding come `filed` (dopo aver creato la segnalazione via ingest). */
export function markFindingFiled(id: string): void {
  openHubDb().prepare(`UPDATE radar_findings SET status = 'filed' WHERE id = ?`).run(id);
}

/** Archivia un finding (`dismissed`): non verrà più ri-notificato dalle scansioni. */
export function dismissFinding(id: string): void {
  openHubDb().prepare(`UPDATE radar_findings SET status = 'dismissed' WHERE id = ?`).run(id);
}
