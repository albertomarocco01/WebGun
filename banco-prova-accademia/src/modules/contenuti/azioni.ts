"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo } from "@/modules/admin/guardia";

/** I contenuti del sito: stessa coppia di ruoli della policy. */
export async function aggiornaContenuto(dati: FormData) {
  await richiediRuolo("segreteria", "direttore");
  const supabase = await clientServer();

  const { error } = await supabase
    .from("site_content")
    .update({
      title: String(dati.get("title") ?? ""),
      corpo: String(dati.get("corpo") ?? ""),
      is_published: dati.get("is_published") === "on",
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contenuti");
}
