"use server";

import { revalidatePath } from "next/cache";

import { esigiRigaToccata } from "@/lib/scritture";
import { clientServer } from "@/lib/supabase/server";
import { richiediStaff } from "@/modules/admin/guardia";

export async function registraCliente(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  // Il cliente senza account e' la norma, non l'eccezione: chi ordina per
  // telefono non si registrera' mai (handoff 07, §Modello assunto).
  const { error } = await supabase.from("customers").insert({
    full_name: String(dati.get("full_name") ?? ""),
    email: String(dati.get("email") ?? "") || null,
    phone: String(dati.get("phone") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clienti");
}

/**
 * Correggere il recapito di un cliente e' la cosa che in un negozio succede piu'
 * spesso: il numero lo si prende al telefono e lo si sbaglia.
 *
 * Fino al 2026-07-30 questa azione esisteva senza che nessuna vista la
 * importasse — un endpoint POST senza porta davanti, che Flow Sentinel ha
 * segnalato come «azione orfana» perche' una batteria non puo' attraversare cio'
 * che l'interfaccia non offre. Ora la vista c'e': `/admin/clienti`, un modulo
 * per riga. `auth_user_id` non si tocca: legare un'anagrafica a un altro account
 * non e' una correzione di recapito.
 */
export async function aggiornaCliente(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("customers")
    .update({
      full_name: String(dati.get("full_name") ?? ""),
      email: String(dati.get("email") ?? "") || null,
      phone: String(dati.get("phone") ?? "") || null,
    })
    .eq("id", String(dati.get("id") ?? ""))
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(data, "cliente non trovato: ricarica la pagina");
  revalidatePath("/admin/clienti");
}
