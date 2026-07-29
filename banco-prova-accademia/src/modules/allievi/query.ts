import { clientServer } from "@/lib/supabase/server";

/**
 * L'insegnante vede solo gli allievi iscritti ai propri corsi: NON e' un filtro
 * di questa query, e' la policy `insegnante_legge_i_propri_allievi`. Qui si
 * chiede l'elenco e si mostra quello che il database concede — se un giorno
 * l'insegnante vedesse tutti, il difetto sarebbe nella policy.
 */
export async function elencoAllievi() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, birth_date, guardian_phone")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
