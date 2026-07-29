"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo, richiediStaff } from "@/modules/admin/guardia";

/**
 * Il modulo dei recapiti scrive SOLO le colonne che il `grant` per colonna
 * concede (`full_name`, `phone`, `is_active`). `ruolo` non e' fra queste: il
 * database rifiuterebbe l'intera `update` con *permission denied for table*,
 * e prima ancora sarebbe auto-promozione.
 */
export async function aggiornaRecapiti(dati: FormData) {
  const persona = await richiediStaff();
  const supabase = await clientServer();

  // La riga da modificare arriva dal modulo: senza questo confronto l'unica
  // difesa e' la policy RLS, cioe' una riga scritta in un altro file.
  const bersaglio = String(dati.get("id") ?? "");
  if (bersaglio !== persona.id && persona.ruolo !== "titolare") {
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

/**
 * Il ruolo si cambia solo cosi': la funzione e' `security definer` e ricontrolla
 * chi la chiama, perche' gli argomenti di un RPC li sceglie il chiamante.
 */
export async function cambiaRuolo(dati: FormData) {
  await richiediRuolo("titolare");
  const supabase = await clientServer();

  const { error } = await supabase.rpc("cambia_ruolo", {
    persona: String(dati.get("id") ?? ""),
    nuovo: String(dati.get("ruolo") ?? ""),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/personale");
}
