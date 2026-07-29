"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo } from "@/modules/admin/guardia";

export async function iscriviAllievo(dati: FormData) {
  await richiediRuolo("segreteria", "direttore");
  const supabase = await clientServer();

  const { error } = await supabase.from("students").insert({
    full_name: String(dati.get("full_name") ?? ""),
    guardian_phone: String(dati.get("guardian_phone") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/allievi");
}

export async function aggiornaAllievo(dati: FormData) {
  await richiediRuolo("segreteria", "direttore");
  const supabase = await clientServer();

  const { error } = await supabase
    .from("students")
    .update({
      full_name: String(dati.get("full_name") ?? ""),
      guardian_phone: String(dati.get("guardian_phone") ?? "") || null,
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/allievi");
}
