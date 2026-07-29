import { clientServer } from "@/lib/supabase/server";

export async function elencoProdotti() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, is_published, category_id, categories(name)")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function prodotto(id: string) {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, description, is_published, category_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function variantiDi(prodottoId: string) {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("product_variants")
    .select("id, sku, size, price_cents, quantity")
    .eq("product_id", prodottoId)
    .order("size", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function elencoCategorie() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, is_visible")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
