import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

/**
 * Rinfresca il cookie di sessione a ogni richiesta.
 *
 * NON e' il controllo d'accesso, e non va usato come tale: il middleware si
 * puo' aggirare (vedi CVE-2025-29927) e non sa niente dei ruoli. La guardia
 * vera sta nel layout server della sezione admin.
 */
export async function aggiornaSessione(request: NextRequest) {
  let risposta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(daImpostare) {
          for (const { name, value } of daImpostare) {
            request.cookies.set(name, value);
          }
          risposta = NextResponse.next({ request });
          for (const { name, value, options } of daImpostare) {
            risposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();

  return risposta;
}
