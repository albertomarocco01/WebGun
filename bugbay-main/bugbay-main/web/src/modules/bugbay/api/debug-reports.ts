/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API delle segnalazioni della pipeline di debugging su Supabase
 * (debug_reports). POST accetta anche id/stato/date per il ripristino fedele
 * dell'undo di eliminazione. Persiste gli allegati (Attachment[]) nella colonna
 * `attachments`. Mappa snake_case DB ↔ camelCase SystemReport.
 *
 * @indice
 * - GET    → elenco segnalazioni (ordinato per data)
 * - POST   → crea (o ripristina) una segnalazione
 * - PUT    → aggiorna campi/stato di una segnalazione
 * - DELETE → elimina per id o ids
 */

import { NextResponse } from 'next/server';
import { SystemReport, Attachment } from '@/modules/bugbay/types';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { projectId, ensureProjectRegistered, isHub, scopeFilter } from '@/modules/bugbay/lib/project';
import { readRegistry } from '@/modules/bugbay/agent-fix/registry';

export const dynamic = 'force-dynamic';

/**
 * Legge la colonna `attachments` in modo tollerante al backend: sul DB locale
 * (SQLite/JSON, colonne TEXT) torna come stringa JSON, su Supabase jsonb come
 * array già parsato. Default [] se assente o non parsabile.
 */
function parseAttachments(raw: unknown): Attachment[] {
  if (Array.isArray(raw)) return raw as Attachment[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Deriva un'area leggibile dall'URL (l'intake non chiede più area/sotto-area). */
function areaFromUrl(url?: string | null): string {
  if (!url) return 'Generale';
  try {
    return (url.startsWith('http') ? new URL(url).pathname : url) || 'Generale';
  } catch {
    return url || 'Generale';
  }
}

export async function GET() {
  try {
    await ensureProjectRegistered();
    const supabase = createAdminClient() as any;
    // Filtro per progetto: fuori dall'hub ogni daemon vede solo le proprie
    // segnalazioni; in hub (scopeFilter()===null) le vede TUTTE (vista operatore).
    // Senza project_id (setup legacy) ritorna tutto, come prima.
    const pid = scopeFilter();
    let query = supabase.from('debug_reports').select('*').order('created_at', { ascending: false });
    if (pid) query = query.eq('project_id', pid);
    const { data, error } = await query;

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json([]);
    }

    // In hub: mappa project_id → nome dal registro locale, per taggare l'origine
    // di ogni segnalazione senza join lato DB (funziona su qualsiasi backend).
    const names = isHub() ? readRegistry().projects ?? {} : {};

    const reports: SystemReport[] = (data || []).map((row: any) => ({
      id: row.id,
      category: row.category,
      priority: row.priority,
      area: row.area,
      subArea: row.sub_area,
      url: row.url,
      notes: row.notes,
      reporterName: row.reporter_name,
      status: row.status,
      developer: row.developer || null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolutionNotes: row.resolution_notes,
      attachments: parseAttachments(row.attachments),
      ...(isHub() ? { projectId: row.project_id ?? null, projectName: names[row.project_id]?.name ?? null } : {}),
    }));

    return NextResponse.json(reports);
  } catch (error) {
    console.error('[API/debug-reports] Error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.notes) {
      return NextResponse.json({ error: 'Descrizione obbligatoria mancante' }, { status: 400 });
    }

    // `id`/`status`/`resolvedAt`/... opzionali: servono al ripristino fedele
    // dell'undo di eliminazione (la segnalazione torna identica, stesso id).
    const reportId = body.id || crypto.randomUUID();
    const attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments : [];
    const newReport: SystemReport = {
      id: reportId,
      category: body.category || 'Bug',
      priority: body.priority || 'Media',
      area: body.area || areaFromUrl(body.url),
      subArea: body.subArea || null,
      url: body.url || null,
      notes: body.notes,
      reporterName: body.reporterName || 'Sconosciuto',
      status: body.status || 'Aperto',
      developer: body.developer || null,
      createdAt: body.createdAt || new Date().toISOString(),
      resolvedAt: body.resolvedAt || null,
      resolutionNotes: body.resolutionNotes || null,
      attachments,
    };

    await ensureProjectRegistered();
    const supabase = createAdminClient() as any;
    // Attribuzione: il widget passa il SUO projectId (?p= nello snippet) così il
    // daemon centrale tagga la segnalazione con l'app d'origine anche quando serve
    // più progetti insieme; senza (install vecchi) usa il progetto del daemon.
    const pidBody = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : null;
    const { error } = await supabase.from('debug_reports').insert({
      id: reportId,
      project_id: pidBody || projectId(),
      category: newReport.category,
      priority: newReport.priority,
      area: newReport.area,
      sub_area: newReport.subArea,
      url: newReport.url,
      notes: newReport.notes,
      reporter_name: newReport.reporterName,
      status: newReport.status,
      developer: newReport.developer,
      created_at: newReport.createdAt,
      resolved_at: newReport.resolvedAt,
      resolution_notes: newReport.resolutionNotes,
      // Salvato come stringa JSON: round-trippa sul backend locale (colonne TEXT).
      // TODO: su Supabase jsonb una stringa è accettata, ma valutare l'invio
      // dell'array nativo per coerenza con il tipo di colonna.
      attachments: JSON.stringify(attachments)
    });

    if (error) {
      console.error('[API/debug-reports] Error inserting to Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ingest AI automatico (default del workflow): 1 agente riformula, 2
    // verificatori indipendenti validano interpretazione e problem posing, poi
    // il dedup-judge flagga gli eventuali duplicati tra le segnalazioni aperte.
    // Solo per segnalazioni NUOVE (l'undo di eliminazione porta un body.id).
    // Fire-and-forget: la risposta al widget non aspetta l'LLM.
    if (!body.id && process.env.BUGBAY_AUTO_REFORMULATE !== '0') {
      void import('@/modules/bugbay/agent-fix/runner')
        .then((m) => m.autoIngestReport(reportId))
        .catch((e) => console.error('[auto-ingest]', e));
    }

    return NextResponse.json(newReport, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Errore durante la creazione della segnalazione' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID segnalazione mancante' }, { status: 400 });
    }

    const dbUpdates: any = {};
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.area !== undefined) dbUpdates.area = updates.area;
    if (updates.subArea !== undefined) dbUpdates.sub_area = updates.subArea;
    if (updates.url !== undefined) dbUpdates.url = updates.url;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.reporterName !== undefined) dbUpdates.reporter_name = updates.reporterName;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.developer !== undefined) dbUpdates.developer = updates.developer;
    if (updates.resolvedAt !== undefined) dbUpdates.resolved_at = updates.resolvedAt;
    if (updates.resolutionNotes !== undefined) dbUpdates.resolution_notes = updates.resolutionNotes;
    // Allegati: salvati come stringa JSON (round-trip TEXT in locale).
    // TODO: su Supabase jsonb valutare l'array nativo (cfr. POST).
    if (updates.attachments !== undefined) {
      dbUpdates.attachments = JSON.stringify(Array.isArray(updates.attachments) ? updates.attachments : []);
    }

    const supabase = createAdminClient() as any;
    const pid = projectId();
    // Isolamento: un daemon aggiorna solo le righe del proprio progetto.
    let upd = supabase.from('debug_reports').update(dbUpdates).eq('id', id);
    if (pid) upd = upd.eq('project_id', pid);
    const { error } = await upd;

    if (error) {
      console.error('[API/debug-reports] Error updating in Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let sel = supabase.from('debug_reports').select('*').eq('id', id);
    if (pid) sel = sel.eq('project_id', pid);
    const { data, error: fetchError } = await sel.single();
    if (fetchError || !data) {
      return NextResponse.json({ error: 'Segnalazione non trovata' }, { status: 404 });
    }

    const updatedReport: SystemReport = {
      id: data.id,
      category: data.category,
      priority: data.priority,
      area: data.area,
      subArea: data.sub_area,
      url: data.url,
      notes: data.notes,
      reporterName: data.reporter_name,
      status: data.status,
      developer: data.developer || null,
      createdAt: data.created_at,
      resolvedAt: data.resolved_at,
      resolutionNotes: data.resolution_notes,
      attachments: parseAttachments(data.attachments)
    };

    return NextResponse.json(updatedReport);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento della segnalazione' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    if (!id && !ids) {
      return NextResponse.json({ error: 'ID o IDs segnalazione mancanti' }, { status: 400 });
    }

    const supabase = createAdminClient() as any;
    const pid = projectId();
    // Isolamento: un daemon cancella solo le righe del proprio progetto.
    if (ids) {
      let del = supabase.from('debug_reports').delete().in('id', ids.split(','));
      if (pid) del = del.eq('project_id', pid);
      const { error } = await del;
      if (error) throw error;
    } else if (id) {
      let del = supabase.from('debug_reports').delete().eq('id', id);
      if (pid) del = del.eq('project_id', pid);
      const { error } = await del;
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: 'Errore durante l\'eliminazione della segnalazione' }, { status: 500 });
  }
}
