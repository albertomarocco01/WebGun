import { clientServer } from "@/lib/supabase/server";

export async function elencoCorsi() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("courses")
    .select("id, name, instrument, giorno, seats, is_open, staff(full_name)")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function elencoInsegnanti() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, ruolo")
    .eq("ruolo", "insegnante")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
