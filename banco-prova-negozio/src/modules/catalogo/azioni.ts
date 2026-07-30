"use server";

import { revalidatePath } from "next/cache";

import { esigiRigaToccata } from "@/lib/scritture";
import { clientServer } from "@/lib/supabase/server";
import { richiediStaff } from "@/modules/admin/guardia";

/**
 * Ogni azione e' un endpoint: la guardia della pagina non la protegge.
 * Una Server Action si invoca con una POST, e chi la invoca non passa
 * necessariamente dal layout che ha fatto il controllo.
 */
export async function creaProdotto(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { error } = await supabase.from("products").insert({
    name: String(dati.get("name") ?? ""),
    slug: String(dati.get("slug") ?? ""),
    description: String(dati.get("description") ?? ""),
    category_id: String(dati.get("category_id") ?? ""),
    is_published: dati.get("is_published") === "on",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/prodotti");
}

export async function aggiornaProdotto(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("products")
    .update({
      name: String(dati.get("name") ?? ""),
      slug: String(dati.get("slug") ?? ""),
      description: String(dati.get("description") ?? ""),
      is_published: dati.get("is_published") === "on",
    })
    .eq("id", String(dati.get("id") ?? ""))
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(data, "prodotto non trovato: ricarica la pagina");
  revalidatePath("/admin/prodotti");
}

export async function eliminaProdotto(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", String(dati.get("id") ?? ""))
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(data, "prodotto non trovato: forse l'ha gia' tolto qualcun altro");
  revalidatePath("/admin/prodotti");
}

/**
 * Del modulo delle varianti si scrivono SOLO prezzo e giacenza, che sono gli
 * unici due campi che l'interfaccia offre.
 *
 * `sku` e `size` viaggiavano in due `<input type="hidden">` e finivano
 * nell'`update`: una POST forgiata riscriveva codice e taglia di qualunque
 * variante, senza che nessuna schermata lo permettesse. Un campo nascosto non
 * e' un dato del server, e' un dato del client con un aspetto rassicurante:
 * cio' che non si modifica non si rimanda indietro.
 */
export async function aggiornaVariante(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  // Il prezzo arriva in euro dal modulo e diventa centesimi qui: in centesimi
  // resta un intero, e un intero non ha errori di arrotondamento.
  const euro = Number(dati.get("prezzo_euro") ?? 0);

  const { data, error } = await supabase
    .from("product_variants")
    .update({
      price_cents: Math.round(euro * 100),
      quantity: Number(dati.get("quantity") ?? 0),
    })
    .eq("id", String(dati.get("id") ?? ""))
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(data, "variante non trovata: ricarica la pagina");
  revalidatePath("/admin/prodotti");
}

export async function creaCategoria(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const { error } = await supabase.from("categories").insert({
    name: String(dati.get("name") ?? ""),
    slug: String(dati.get("slug") ?? ""),
    is_visible: dati.get("is_visible") === "on",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/categorie");
}
