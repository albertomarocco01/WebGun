"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo } from "@/modules/admin/guardia";

/** I corsi li apre la direzione: la policy dice `ha_ruolo('direttore')`, e
 *  questa guardia dice lo stesso. Divergere significa mostrare una pagina che
 *  non salva. */
export async function creaCorso(dati: FormData) {
  await richiediRuolo("direttore");
  const supabase = await clientServer();

  const { error } = await supabase.from("courses").insert({
    teacher_id: String(dati.get("teacher_id") ?? ""),
    name: String(dati.get("name") ?? ""),
    instrument: String(dati.get("instrument") ?? ""),
    giorno: String(dati.get("giorno") ?? "lun"),
    seats: Number(dati.get("seats") ?? 1),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/corsi");
}

export async function chiudiCorso(dati: FormData) {
  await richiediRuolo("direttore");
  const supabase = await clientServer();

  const { error } = await supabase
    .from("courses")
    .update({ is_open: false })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/corsi");
}
