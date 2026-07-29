import { clientServer } from "@/lib/supabase/server";

export async function elencoContenuti() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("site_content")
    .select("id, slot, title, corpo, image_url, is_published, updated_at")
    .order("slot", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Il sito pubblico legge solo il pubblicato: lo garantisce la policy. */
export async function contenutoPubblico(slot: string) {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("site_content")
    .select("title, corpo, image_url")
    .eq("slot", slot)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
