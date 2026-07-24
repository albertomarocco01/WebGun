/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API locale del fix agentico (MVP). Tutte le azioni passano da qui:
 * start / clarify / reject / approve / discard (POST) e status (GET).
 * Protetta dalla guardia: attiva solo in locale con ENABLE_AGENT_FIX=1.
 *
 * @indice
 * - POST → esegue un'azione del workflow
 * - GET  → stato di una run
 */

import { NextResponse } from 'next/server';
import { isAgentFixEnabled } from '@/modules/bugbay/agent-fix/guard';
import { getRun, getVisibleRuns, hasActiveRunFor, getAllRuns, getSettings, saveSettings, deleteRuns } from '@/modules/bugbay/agent-fix/store';
import {
  startRun, startBatch, continueAfterClarify, rejectAndRelaunch, approve, approveReports, discard, abortRun, reformulateReport,
  reformulateChecklistItem, pauseRun, resumeRun, dispatchQueue, watchHeartbeat,
} from '@/modules/bugbay/agent-fix/runner';
import { environmentDiagnostics } from '@/modules/bugbay/agent-fix/exec';
import { startAuditScheduler } from '@/modules/bugbay/agent-fix/audits';
import { reconcileOrphanedReports, resolveKeys } from '@/modules/bugbay/agent-fix/run-context';
import { aggregateRuns, crossProjectOverview } from '@/modules/bugbay/agent-fix/observability';
import { autonomyState } from '@/modules/bugbay/agent-fix/autonomy';
import { projectId } from '@/modules/bugbay/lib/project';

export const runtime = 'nodejs';
export const maxDuration = 600;

function guard(): NextResponse | null {
  if (!isAgentFixEnabled()) {
    return NextResponse.json(
      { error: 'Fix agentico disabilitato. Attivo solo in locale con ENABLE_AGENT_FIX=1.' },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Se viene chiesto solo lo stato di abilitazione generico (+ nome progetto per l'header console)
  if (!searchParams.has('runId') && !searchParams.has('active') && !searchParams.has('all') && !searchParams.has('settings') && !searchParams.has('reportId') && !searchParams.has('diagnostics') && !searchParams.has('health') && !searchParams.has('overview')) {
    return NextResponse.json({ enabled: isAgentFixEnabled(), projectName: process.env.BUGBAY_PROJECT_NAME ?? null });
  }

  // Se chiede le impostazioni (utili per la riformulazione).
  // SICUREZZA: mai restituire i valori delle chiavi API — solo booleani di
  // presenza. La risposta è leggibile cross-origin: le chiavi non escono dal
  // server. I booleani rispecchiano resolveKeys() (env fallback inclusi).
  if (searchParams.get('settings') === '1') {
    const s = getSettings();
    return NextResponse.json({
      provider: s.provider,
      maxParallelRuns: s.maxParallelRuns ?? 2,
      hasGemini: Boolean(s.geminiApiKey || process.env.GEMINI_API_KEY),
      hasDeepseek: Boolean(s.deepseekApiKey || process.env.DEEPSEEK_API_KEY),
      hasAnthropic: Boolean(s.anthropicApiKey || process.env.CONSOLE_ANTHROPIC_API_KEY),
    });
  }

  // Health/observability (F4): stato del daemon aggregato — leggero (niente tsc),
  // pollabile. Solo booleani/config, mai chiavi. Read-only → prima del guard.
  if (searchParams.get('health') === '1') {
    const keys = resolveKeys();
    return NextResponse.json({
      ok: true,
      version: process.env.BUGBAY_VERSION ?? null,
      project: { id: projectId(), name: process.env.BUGBAY_PROJECT_NAME ?? null },
      storage: process.env.BUGBAY_LOCAL_DB === '1' ? 'local' : (process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'local'),
      provider: {
        selected: keys.provider,
        hasGemini: Boolean(keys.gemini),
        hasDeepseek: Boolean(keys.deepseek),
        hasAnthropic: Boolean(keys.anthropic),
      },
      autonomy: autonomyState(),
      watch: watchHeartbeat(),
      runs: aggregateRuns(getAllRuns()),
      uptimeMs: Math.round(process.uptime() * 1000),
    });
  }

  // Panoramica cross-progetto (F2-inc2): totali per progetto sul DB condiviso.
  if (searchParams.get('overview') === '1') {
    return NextResponse.json(await crossProjectOverview());
  }

  const blocked = guard();
  if (blocked) return blocked;

  // Diagnostica d'ambiente (tsc eseguibile? CLI claude trovata? git ok?)
  if (searchParams.get('diagnostics') === '1') {
    return NextResponse.json(await environmentDiagnostics());
  }

  if (searchParams.get('active') === '1') {
    // La coda è persistente: il polling fa anche da "tick" che riprende
    // le run rimaste in coda dopo un riavvio del server.
    dispatchQueue();
    // Gli audit schedulati partono col primo polling della console (idempotente).
    startAuditScheduler();
    // Self-healing: riapre le segnalazioni "in lavorazione" rimaste senza run
    // (invariante: nessuna segnalazione in lavorazione senza una run viva).
    await reconcileOrphanedReports();
    return NextResponse.json(getVisibleRuns());
  }

  if (searchParams.get('all') === '1') {
    dispatchQueue();
    return NextResponse.json(getAllRuns());
  }

  // Timeline: tutte le run (anche concluse) che hanno toccato una segnalazione
  const reportId = searchParams.get('reportId');
  if (reportId) {
    const runs = getAllRuns().filter((r) =>
      r.reportId === reportId || (r.reports ?? []).some((rep) => rep.reportId === reportId),
    );
    return NextResponse.json(runs);
  }

  const runId = searchParams.get('runId');
  if (!runId) return NextResponse.json({ enabled: true });
  const run = getRun(runId);
  if (!run) return NextResponse.json({ error: 'Run non trovata.' }, { status: 404 });
  return NextResponse.json(run);
}

export async function POST(request: Request) {
  let body: {
    action?: string;
    reportId?: string;
    reportIds?: string[];
    runId?: string;
    runIds?: string[];
    risposta?: string;
    motivo?: string;
    provider?: string;
    geminiApiKey?: string;
    deepseekApiKey?: string;
    settings?: any;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido.' }, { status: 400 });
  }

  // Ogni azione POST (inclusi reformulate/save_settings, che spendono chiavi LLM e
  // mutano le impostazioni) passa dalla guardia di esecuzione: nessuna bypass.
  const blocked = guard();
  if (blocked) return blocked;

  try {
    switch (body.action) {
      case 'start': {
        if (!body.reportId) return NextResponse.json({ error: 'reportId mancante.' }, { status: 400 });
        const active = hasActiveRunFor(body.reportId);
        if (active) return NextResponse.json(active);
        return NextResponse.json(await startRun(body.reportId, body.provider, body.geminiApiKey, body.deepseekApiKey));
      }
      case 'start_batch': {
        if (!Array.isArray(body.reportIds) || body.reportIds.length === 0) {
          return NextResponse.json({ error: 'reportIds mancanti.' }, { status: 400 });
        }
        // Idempotenza: esclude le segnalazioni già in lavorazione.
        const liberi = body.reportIds.filter((id) => !hasActiveRunFor(id));
        if (liberi.length === 0) return NextResponse.json({ error: 'Tutte le segnalazioni selezionate sono già in lavorazione.' }, { status: 409 });
        return NextResponse.json(await startBatch(liberi, body.provider, body.geminiApiKey, body.deepseekApiKey));
      }
      case 'reformulate': {
        if (body.reportId) {
          return NextResponse.json(await reformulateReport(body.reportId, body.provider, body.geminiApiKey, body.deepseekApiKey));
        }
        const { notes, itemLabel, itemDesc, itemPath } = body as any;
        if (notes === undefined || !itemLabel || !itemDesc || !itemPath) {
          return NextResponse.json({ error: 'Parametri di riformulazione checklist insufficienti.' }, { status: 400 });
        }
        return NextResponse.json(await reformulateChecklistItem(notes, itemLabel, itemDesc, itemPath, body.provider, body.geminiApiKey, body.deepseekApiKey));
      }
      case 'clarify':
        if (!body.runId || body.risposta === undefined) return NextResponse.json({ error: 'Parametri mancanti.' }, { status: 400 });
        return NextResponse.json(await continueAfterClarify(body.runId, body.risposta));
      case 'reject':
        if (!body.runId || !body.motivo) return NextResponse.json({ error: 'Motivo mancante.' }, { status: 400 });
        return NextResponse.json(rejectAndRelaunch(body.runId, body.motivo));
      case 'approve':
        if (!body.runId) return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
        return NextResponse.json(await approve(body.runId));
      case 'approve_reports':
        if (!body.runId || !Array.isArray(body.reportIds) || body.reportIds.length === 0) {
          return NextResponse.json({ error: 'runId o reportIds mancanti.' }, { status: 400 });
        }
        return NextResponse.json(await approveReports(body.runId, body.reportIds));
      case 'discard':
        if (!body.runId) return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
        return NextResponse.json(discard(body.runId));
      case 'abort':
        if (!body.runId) return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
        return NextResponse.json(abortRun(body.runId));
      case 'pause':
        if (!body.runId) return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
        return NextResponse.json(pauseRun(body.runId));
      case 'resume':
        if (!body.runId) return NextResponse.json({ error: 'runId mancante.' }, { status: 400 });
        return NextResponse.json(await resumeRun(body.runId));
      case 'save_settings': {
        if (!body.settings) return NextResponse.json({ error: 'settings mancanti.' }, { status: 400 });
        // MERGE, non overwrite: da quando ?settings=1 non ritorna più le chiavi,
        // il client rimanda una copia senza chiavi → un save cancellerebbe le
        // chiavi salvate. Una chiave vuota/assente = "invariata".
        const cur = getSettings();
        const inc = body.settings as Partial<typeof cur>;
        saveSettings({
          ...cur,
          provider: inc.provider ?? cur.provider,
          geminiApiKey: inc.geminiApiKey || cur.geminiApiKey,
          deepseekApiKey: inc.deepseekApiKey || cur.deepseekApiKey,
          anthropicApiKey: inc.anthropicApiKey || cur.anthropicApiKey,
          maxParallelRuns: inc.maxParallelRuns ?? cur.maxParallelRuns,
        });
        return NextResponse.json({ success: true });
      }
      case 'delete':
        if (!body.runIds || !Array.isArray(body.runIds)) {
          return NextResponse.json({ error: 'runIds mancante o non valido.' }, { status: 400 });
        }
        for (const runId of body.runIds) {
          try { abortRun(runId); } catch { /* ignore */ }
        }
        deleteRuns(body.runIds);
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ error: 'Azione sconosciuta.' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore interno.' },
      { status: 500 },
    );
  }
}
