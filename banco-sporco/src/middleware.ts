import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

// DIFETTO PIANTATO 6 — il middleware come controllo d'accesso.
// Sembra la difesa piu' comoda («una riga sola, vale per tutte le rotte») ed e'
// quella che si aggira: non conosce i ruoli e non gira dove crede chi la scrive.
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/accedi", request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
