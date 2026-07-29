import { clientServer } from "@/lib/supabase/server";

export const TRANSIZIONI: Record<string, readonly string[]> = {
  richiesta: ["confermata", "ritirata"],
  confermata: ["ritirata"],
  ritirata: [],
};

export async function elencoIscrizioni() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, fee_cents, courses(name), students(full_name)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
