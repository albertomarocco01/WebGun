/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API della vista SYSTEM della console-hub (v0.9): superficie del RADAR
 * notify-only + degli `alerts` della spina. Un solo endpoint privilegiato
 * (stessa guardia ENABLE_AGENT_FIX / stessa middleware /api/* delle altre route
 * dell'agent-fix):
 *   - GET                    → payload SYSTEM: alert recenti + radar findings aperti.
 *   - POST { action:'scan' } → lancia una scansione dipendenze (best-effort).
 *   - POST { action:'file' } → "file as fix": RIUSA la ingest esistente
 *                              (POST /api/debug-reports → autoIngestReport) creando
 *                              una segnalazione/run che l'umano approverà; il finding
 *                              passa a `filed`. NON applica mai nulla in automatico.
 *   - POST { action:'dismiss' } → archivia un finding (`dismissed`).
 *
 * INVARIANTE: il "file as fix" non tocca git/file/run direttamente — delega alla
 * pipeline di intake, esattamente come una segnalazione umana. È l'unico ponte tra
 * il radar (informativo) e il fix (azione), ed è sempre a innesco umano.
 *
 * @indice
 * - GET  → payload SYSTEM (alerts + findings)
 * - POST → scan | file | dismiss
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import {
  scanDependencies,
  listRadarFindings,
  listRecentAlerts,
  getFinding,
  markFindingFiled,
  dismissFinding,
} from '@/modules/bugbay/agent-fix/radar';
import { POST as createReport } from '@/modules/bugbay/api/debug-reports';
import type { RadarFindingRow, AlertRow } from '@/modules/bugbay/agent-fix/hub';

// nodejs: la spina usa `node:sqlite`. force-dynamic: stato che cambia a ogni giro.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Proiezione client-safe di un alert (camelCase, niente colonne interne extra). */
export interface SystemAlert {
  id: string;
  channel: AlertRow['channel'];
  severity: AlertRow['severity'];
  runId: string | null;
  message: string;
  detail: string | null;
  createdAt: string;
  ackAt: string | null;
}

/** Proiezione client-safe di un radar finding (camelCase). */
export interface RadarFinding {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  status: RadarFindingRow['status'];
  createdAt: string;
}

/** Payload della vista SYSTEM: alert della spina + finding del radar. */
export interface SystemResponse {
  alerts: SystemAlert[];
  findings: RadarFinding[];
}

function toAlert(a: AlertRow): SystemAlert {
  return {
    id: a.id,
    channel: a.channel,
    severity: a.severity,
    runId: a.run_id,
    message: a.message,
    detail: a.detail,
    createdAt: a.created_at,
    ackAt: a.ack_at,
  };
}

function toFinding(f: RadarFindingRow): RadarFinding {
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    detail: f.detail,
    status: f.status,
    createdAt: f.created_at,
  };
}

function forbidden(): Response {
  return NextResponse.json(
    { error: 'Vista SYSTEM disabilitata. Attiva solo in locale con ENABLE_AGENT_FIX=1.' },
    { status: 403 },
  );
}

export function GET(): Response {
  if (!isAgentFixEnabled()) return forbidden();
  const payload: SystemResponse = {
    alerts: listRecentAlerts().map(toAlert),
    findings: listRadarFindings().map(toFinding),
  };
  return NextResponse.json(payload);
}

/**
 * Compone le note della segnalazione a partire dal finding: testo in italiano per
 * l'operatore + i dati grezzi (il fixer li rielabora in un prompt tecnico durante
 * l'ingest). Notify-only: qui si DESCRIVE l'aggiornamento, non lo si esegue.
 */
function noteFromFinding(f: RadarFindingRow): string {
  let extra: Record<string, unknown> = {};
  try {
    extra = f.detail ? (JSON.parse(f.detail) as Record<string, unknown>) : {};
  } catch {
    /* detail non-JSON: si usa il solo titolo */
  }
  const righe = [
    `[BugBay Radar — ${f.kind}] ${f.title}`,
    '',
    f.kind === 'dep-major'
      ? `È disponibile un major più recente di quello dichiarato. Valutare l'aggiornamento: nessuna rete di sicurezza automatica copre i major, quindi va rivisto e testato a mano.`
      : `La versione installata non soddisfa più il range dichiarato: riallineare install/lockfile (deriva di dipendenza).`,
    '',
    `Dettaglio: ${JSON.stringify(extra)}`,
  ];
  return righe.join('\n');
}

export async function POST(request: Request): Promise<Response> {
  if (!isAgentFixEnabled()) return forbidden();

  let body: { action?: string; id?: string };
  try {
    body = (await request.json()) as { action?: string; id?: string };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido.' }, { status: 400 });
  }

  // ── Scansione: scrive i nuovi finding, ritorna il riassunto ──
  if (body.action === 'scan') {
    const result = await scanDependencies();
    return NextResponse.json({
      scanned: result.scanned,
      inserted: result.inserted,
      registryReachable: result.registryReachable,
    });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id del finding mancante.' }, { status: 400 });
  }
  const finding = getFinding(body.id);
  if (!finding) {
    return NextResponse.json({ error: 'Finding non trovato.' }, { status: 404 });
  }

  // ── Archivia un finding: niente più notifiche dalle scansioni ──
  if (body.action === 'dismiss') {
    dismissFinding(finding.id);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  // ── "File as fix": RIUSA la ingest esistente, poi segna il finding come filed ──
  if (body.action === 'file') {
    // Costruisce una richiesta interna verso il POST di /api/debug-reports:
    // stessa pipeline dell'intake (persistenza + autoIngestReport fire-and-forget),
    // così l'umano trova la segnalazione in coda di revisione. Nessuna scorciatoia.
    const reportReq = new Request('http://127.0.0.1/api/debug-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category: 'Miglioria Proposta',
        priority: 'Bassa',
        notes: noteFromFinding(finding),
        reporterName: 'BugBay Radar',
      }),
    });
    const created = await createReport(reportReq);
    if (!created.ok) {
      const errBody = (await created.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json(
        { error: errBody.error ?? 'Creazione segnalazione fallita.' },
        { status: 502 },
      );
    }
    const report = (await created.json()) as { id?: string };
    markFindingFiled(finding.id);
    return NextResponse.json({ ok: true, status: 'filed', reportId: report.id ?? null });
  }

  return NextResponse.json({ error: `Azione sconosciuta: ${body.action ?? '—'}.` }, { status: 400 });
}
