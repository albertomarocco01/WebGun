import { clientServer } from "@/lib/supabase/server";

export async function elencoPersonale() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, phone, ruolo, is_active")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
