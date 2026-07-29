"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediRuolo } from "@/modules/admin/guardia";

/**
 * I contenuti del sito sono l'eredita' del CMS che la pipeline non ha piu':
 * stanno in Supabase e si modificano da qui. Il permesso e' del redattore e del
 * titolare — la stessa coppia che sta nella policy di `site_content`.
 */
export async function aggiornaContenuto(dati: FormData) {
  await richiediRuolo("redattore", "titolare");
  const supabase = await clientServer();

  const { error } = await supabase
    .from("site_content")
    .update({
      title: String(dati.get("title") ?? ""),
      body: String(dati.get("body") ?? ""),
      image_url: String(dati.get("image_url") ?? "") || null,
      is_published: dati.get("is_published") === "on",
    })
    .eq("id", String(dati.get("id") ?? ""));

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contenuti");
}

export async function creaContenuto(dati: FormData) {
  await richiediRuolo("redattore", "titolare");
  const supabase = await clientServer();

  const { error } = await supabase.from("site_content").insert({
    slot: String(dati.get("slot") ?? ""),
    title: String(dati.get("title") ?? ""),
    body: String(dati.get("body") ?? ""),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contenuti");
}
