"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo } from "@/modules/admin/guardia";
import { TRANSIZIONI } from "@/modules/iscrizioni/query";

/**
 * Lo stato attuale NON è quello che dichiara il modulo: è quello che sta nella
 * riga. `status_attuale` arriva da un campo nascosto, cioè dal client, e chi
 * invoca questa azione direttamente (è un endpoint POST) può dichiarare quello
 * che gli conviene — trovato dal tribunale il 2026-07-28: uno stato terminale
 * come `ritirata` smetteva di essere terminale.
 *
 * Quindi lo stato entra nella CONDIZIONE dell'update, non nell'ipotesi. Se la
 * riga non è più in quello stato, zero righe toccate — che non è un successo,
 * è un conflitto.
 */
export async function cambiaStatoIscrizione(dati: FormData) {
  await richiediRuolo("segreteria", "direttore");
  const supabase = await clientServer();

  const attuale = String(dati.get("status_attuale") ?? "");
  const nuovo = String(dati.get("status") ?? "");

  if (!TRANSIZIONI[attuale]?.includes(nuovo)) {
    throw new Error(`transizione non ammessa: ${attuale} -> ${nuovo}`);
  }

  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: nuovo })
    .eq("id", String(dati.get("id") ?? ""))
    .eq("status", attuale)
    .select("id");

  if (error) throw new Error(error.message);
  if ((data ?? []).length === 0) {
    throw new Error("l'iscrizione è cambiata nel frattempo: ricarica la pagina");
  }

  revalidatePath("/admin/iscrizioni");
}
