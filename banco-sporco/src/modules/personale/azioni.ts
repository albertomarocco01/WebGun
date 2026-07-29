"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediStaff } from "@/modules/admin/guardia";

// DIFETTO PIANTATO 5 — un unico modulo «anagrafica» che scrive anche il ruolo.
// E' la forma piu' naturale del difetto: un solo form per tutta la riga.
export async function aggiornaRecapiti(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { error } = await supabase
    .from("staff")
    .update({
      full_name: String(dati.get("full_name") ?? ""),
      phone: String(dati.get("phone") ?? "") || null,
      ruolo: String(dati.get("ruolo") ?? ""),
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/personale");
}
