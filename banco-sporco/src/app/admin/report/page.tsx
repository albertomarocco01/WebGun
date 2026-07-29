// DIFETTO PIANTATO 4 — query che aggira le RLS, dentro una rotta protetta.
// La guardia c'e' e non serve a niente: il client e' costruito qui, con la
// chiave che ignora le policy, e legge l'anagrafica intera.
import { createClient } from "@supabase/supabase-js";

import { richiediStaff } from "@/modules/admin/guardia";

export default async function Report() {
  await richiediStaff();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );

  const { data } = await supabase.from("customers").select("id, email, phone");

  return <p>{data?.length ?? 0} clienti</p>;
}
