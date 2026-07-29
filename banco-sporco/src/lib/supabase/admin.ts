// DIFETTO PIANTATO 3 — il client che scavalca ogni policy.
// Nato per «risolvere» un permission denied: la scorciatoia che trasforma un
// problema di policy in un buco di sicurezza.
import { createClient } from "@supabase/supabase-js";

export function clientAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );
}
