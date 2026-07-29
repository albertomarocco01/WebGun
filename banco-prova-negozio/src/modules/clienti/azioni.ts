"use server";

import { revalidatePath } from "next/cache";

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

export async function aggiornaCliente(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: String(dati.get("full_name") ?? ""),
      email: String(dati.get("email") ?? "") || null,
      phone: String(dati.get("phone") ?? "") || null,
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clienti");
}
