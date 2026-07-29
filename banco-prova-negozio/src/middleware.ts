import { type NextRequest } from "next/server";

import { aggiornaSessione } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return aggiornaSessione(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
