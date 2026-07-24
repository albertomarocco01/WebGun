/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * API della Campagna di revisione QA, modello DB-backed (Refresh-with-AI). Le
 * voci vive stanno in debug_checklist_items (definizione + stato review); le note
 * libere (__general/__sec_*) e i metadati dell'ultimo refresh (__refresh_meta)
 * restano in debug_checklist. GET ritorna lo stato completo; POST è azione-based
 * (refresh/set_item/save_notes); DELETE cancella una voce.
 *
 * @indice
 * - GET    → ChecklistState { items, notes, meta }
 * - POST   → { action: 'refresh' | 'set_item' | 'save_notes', ... }
 * - DELETE → ?itemId=<id> rimuove una voce
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/modules/bugbay/lib/supabase-admin';
import { projectId, scopeId, unscopeId, belongsToProject, ensureProjectRegistered } from '@/modules/bugbay/lib/project';
import type { ChecklistItemRow, ChecklistMeta, ChecklistState } from '@/modules/bugbay/data/revisione-checklist';
import {
  refreshChecklist, mapItemRow, parseJsonField,
  REFRESH_META_ID, CHECKLIST_ITEMS_TABLE, type ItemDbRow, type DbClient,
} from '@/modules/bugbay/agent-fix/checklist-refresh';

export const dynamic = 'force-dynamic';

const EMPTY_META: ChecklistMeta = { lastRefreshSha: null, lastRefreshAt: null, base: null };

interface ChecklistDbRow { id: string; note?: string | null }

/* ── GET: stato completo della campagna ─────────────────────────────── */

export async function GET() {
  try {
    await ensureProjectRegistered();
    const supabase = createAdminClient() as unknown as DbClient;
    const pid = projectId();

    // Voci di QUESTO progetto (nel DB centrale ogni daemon vede solo le proprie).
    let itemsQ = supabase.from(CHECKLIST_ITEMS_TABLE).select('*');
    if (pid) itemsQ = itemsQ.eq('project_id', pid);
    const itemsRes = await itemsQ;
    const items: ChecklistItemRow[] = Array.isArray(itemsRes.data)
      ? (itemsRes.data as ItemDbRow[])
          .map(mapItemRow)
          .sort(
            (a, b) =>
              a.sectionOrder - b.sectionOrder ||
              a.sectionTitle.localeCompare(b.sectionTitle) ||
              a.label.localeCompare(b.label),
          )
      : [];

    // Note libere (__general/__sec_*) e metadati (__refresh_meta) da debug_checklist.
    // Gli id sono namespaced per progetto (scopeId): filtro a quelli di questo
    // progetto e li rimuovo dal prefisso, così il client vede le chiavi che conosce.
    const notesRes = await supabase.from('debug_checklist').select('id, note');
    const notes: Record<string, string> = {};
    let meta: ChecklistMeta = EMPTY_META;
    if (Array.isArray(notesRes.data)) {
      for (const row of notesRes.data as ChecklistDbRow[]) {
        if (typeof row.id !== 'string' || !row.note) continue;
        if (!belongsToProject(row.id)) continue;
        const uid = unscopeId(row.id);
        if (uid === REFRESH_META_ID) {
          meta = parseJsonField<ChecklistMeta>(row.note, EMPTY_META);
        } else if (uid.startsWith('__')) {
          notes[uid] = row.note;
        }
      }
    }

    const state: ChecklistState = { items, notes, meta };
    return NextResponse.json(state);
  } catch (error) {
    console.error('[API/debug-checklist] GET error:', error);
    return NextResponse.json({ items: [], notes: {}, meta: EMPTY_META } satisfies ChecklistState);
  }
}

/* ── POST: azioni (refresh / set_item / save_notes) ─────────────────── */

interface RefreshBody { action: 'refresh'; base?: string }
interface SetItemBody { action: 'set_item'; id: string; status?: 'ok' | 'problema' | null; note?: string | null }
interface SaveNotesBody { action: 'save_notes'; notes: Record<string, string> }
type PostBody = RefreshBody | SetItemBody | SaveNotesBody;

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido.' }, { status: 400 });
  }

  try {
    if (body.action === 'refresh') {
      const { items, meta, added, updated } = await refreshChecklist(body.base);
      return NextResponse.json({ items, meta, added, updated });
    }

    if (body.action === 'set_item') {
      if (!body.id) return NextResponse.json({ error: 'id mancante.' }, { status: 400 });
      const status = body.status === 'ok' || body.status === 'problema' ? body.status : null;
      const supabase = createAdminClient() as unknown as DbClient;
      // body.id è già scoped (arriva dal GET); l'eq su project_id è difesa extra.
      const pid = projectId();
      let upd = supabase
        .from(CHECKLIST_ITEMS_TABLE)
        .update({ status, note: body.note ?? null, updated_at: new Date().toISOString() })
        .eq('id', body.id);
      if (pid) upd = upd.eq('project_id', pid);
      const { error } = await upd;
      if (error) {
        console.error('[API/debug-checklist] set_item error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === 'save_notes') {
      const entries = Object.entries(body.notes ?? {});
      if (entries.length) {
        const now = new Date().toISOString();
        // Le note libere sono righe polimorfiche di debug_checklist (tutto in `note`).
        // Gli id (__general/__sec_*) sono costruiti dal client e condivisi tra
        // progetti: li namespacio con scopeId così non collidono nel DB centrale.
        const rows = entries.map(([id, note]) => ({
          id: scopeId(id), status: null, note: note || null, developer: null, updated_at: now,
        }));
        const supabase = createAdminClient() as unknown as DbClient;
        const { error } = await supabase.from('debug_checklist').upsert(rows);
        if (error) {
          console.error('[API/debug-checklist] save_notes error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Azione non riconosciuta.' }, { status: 400 });
  } catch (error) {
    console.error('[API/debug-checklist] POST error:', error);
    const message = error instanceof Error ? error.message : 'Errore interno.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ── DELETE: rimozione di una voce ──────────────────────────────────── */

export async function DELETE(request: Request) {
  try {
    const itemId = new URL(request.url).searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId mancante.' }, { status: 400 });
    const supabase = createAdminClient() as unknown as DbClient;
    // itemId è già scoped (arriva dal GET); l'eq su project_id è difesa extra.
    const pid = projectId();
    let del = supabase.from(CHECKLIST_ITEMS_TABLE).delete().eq('id', itemId);
    if (pid) del = del.eq('project_id', pid);
    const { error } = await del;
    if (error) {
      console.error('[API/debug-checklist] DELETE error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/debug-checklist] DELETE error:', error);
    return NextResponse.json({ error: 'Errore eliminazione voce.' }, { status: 500 });
  }
}
