// DIFETTO PIANTATO 1 — route handler admin senza guardia.
// Sta sotto `src/app/admin`, dove il layout chiama richiediStaff(): ma un
// route handler NON esegue i layout, quindi quella guardia non lo tocca.
import { NextResponse } from "next/server";

import { clientServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await clientServer();
  const { data } = await supabase.from("customers").select("id, email, phone");
  return NextResponse.json({ clienti: data });
}
