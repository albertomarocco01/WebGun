import { clientServer } from "@/lib/supabase/server";

export const TRANSIZIONI: Record<string, readonly string[]> = {
  in_attesa: ["confermato", "annullato"],
  confermato: ["spedito", "annullato"],
  spedito: ["consegnato"],
  consegnato: [],
  annullato: [],
};

export async function elencoOrdini() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total_cents, shipping_name, shipping_city, placed_at, customers(full_name)",
    )
    .order("placed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function righeDi(ordineId: string) {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("order_items")
    .select("id, product_name, variant_name, quantity, unit_price_cents")
    .eq("order_id", ordineId);

  if (error) throw new Error(error.message);
  return data ?? [];
}
