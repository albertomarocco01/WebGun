/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API degli audit schedulati: lista (GET) e azioni save/delete/run (POST).
 * Protetta dalla stessa guardia del fix agentico (solo daemon locale con
 * ENABLE_AGENT_FIX=1): un audit lancia la CLI sul repo, non è un'API pubblica.
 * Ogni hit avvia (idempotente) lo scheduler in-process.
 *
 * @indice
 * - GET  → { audits, runs }
 * - POST → save | delete | run
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import { listAudits, saveAudit, deleteAudit, listAuditRuns, runAuditNow, startAuditScheduler } from '@/modules/bugbay/agent-fix/audits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function guard(): NextResponse | null {
  if (!isAgentFixEnabled()) {
    return NextResponse.json({ error: 'Audit disabilitati: attivi solo in locale con ENABLE_AGENT_FIX=1.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const blocked = guard();
  if (blocked) return blocked;
  startAuditScheduler();
  const [audits, runs] = await Promise.all([listAudits(), listAuditRuns()]);
  return NextResponse.json({ audits, runs });
}

export async function POST(request: Request) {
  const blocked = guard();
  if (blocked) return blocked;
  startAuditScheduler();
  let body: { action?: string; id?: string; audit?: Record<string, unknown> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Body non valido.' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'save': {
        if (!body.audit || typeof body.audit !== 'object') return NextResponse.json({ error: 'audit mancante.' }, { status: 400 });
        const audit = await saveAudit(body.audit);
        return NextResponse.json({ audit });
      }
      case 'delete': {
        if (!body.id) return NextResponse.json({ error: 'id mancante.' }, { status: 400 });
        await deleteAudit(body.id);
        return NextResponse.json({ success: true });
      }
      case 'run': {
        if (!body.id) return NextResponse.json({ error: 'id mancante.' }, { status: 400 });
        const run = await runAuditNow(body.id);
        return NextResponse.json({ run });
      }
      default:
        return NextResponse.json({ error: 'Azione sconosciuta.' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno.' }, { status: 500 });
  }
}
