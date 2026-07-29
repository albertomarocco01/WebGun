import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Client per i componenti che girano nel browser. Usa la chiave pubblicabile:
 * e' la sola che puo' stare in un bundle, e senza RLS non proteggerebbe niente.
 */
export function clientBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
