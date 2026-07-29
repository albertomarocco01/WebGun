"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo, richiediStaff } from "@/modules/admin/guardia";

/** Scrive SOLO le colonne che il `grant` per colonna concede. `ruolo` non c'e'. */
export async function aggiornaRecapiti(dati: FormData) {
  const persona = await richiediStaff();
  const supabase = await clientServer();

  // La riga da modificare arriva dal modulo: senza questo confronto l'unica
  // difesa e' la policy RLS, cioe' una riga scritta in un altro file. Il
  // tribunale (2026-07-28) l'ha classificata «chiusa oggi, aperta il giorno in
  // cui quella policy cambia»: il permesso si dichiara dove si esercita.
  const bersaglio = String(dati.get("id") ?? "");
  if (bersaglio !== persona.id && persona.ruolo !== "direttore") {
    throw new Error("puoi modificare solo i tuoi recapiti");
  }

  const { error } = await supabase
    .from("staff")
    .update({
      full_name: String(dati.get("full_name") ?? ""),
      phone: String(dati.get("phone") ?? "") || null,
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/personale");
}

export async function cambiaRuolo(dati: FormData) {
  await richiediRuolo("direttore");
  const supabase = await clientServer();

  const { error } = await supabase.rpc("cambia_ruolo", {
    persona: String(dati.get("id") ?? ""),
    nuovo: String(dati.get("ruolo") ?? ""),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/personale");
}
