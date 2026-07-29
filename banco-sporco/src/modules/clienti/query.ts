import { clientServer } from "@/lib/supabase/server";

export async function elencoClienti() {
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, auth_user_id")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
