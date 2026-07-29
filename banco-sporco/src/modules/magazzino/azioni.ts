"use server";

// DIFETTO PIANTATO 2 — azione server senza guardia.
// La pagina che la chiama e' protetta, ma l'azione e' un endpoint POST a se':
// si invoca senza passare da nessun layout.
import { clientServer } from "@/lib/supabase/server";

export async function scaricaGiacenza(dati: FormData) {
  const supabase = await clientServer();
  await supabase
    .from("product_variants")
    .update({ quantity: Number(dati.get("quantity") ?? 0) })
    .eq("id", String(dati.get("id") ?? ""));
}
