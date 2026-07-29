import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * L'unico posto in cui nasce un client Supabase lato server.
 *
 * Porta la sessione dell'utente nei cookie: ogni query passa dalle policy RLS
 * con l'identita' di chi ha fatto la richiesta. La chiave `service_role` qui
 * non entra mai — scavalcherebbe le policy, e un errore di permesso si risolve
 * cambiando la policy con schema-forge, non la chiave.
 */
export async function clientServer() {
  const store = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(daImpostare) {
          try {
            for (const { name, value, options } of daImpostare) {
              store.set(name, value, options);
            }
          } catch {
            // In un Server Component i cookie sono in sola lettura: li riscrive
            // il middleware al giro successivo. Ignorare qui e' corretto.
          }
        },
      },
    },
  );
}
