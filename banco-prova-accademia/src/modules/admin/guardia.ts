import { redirect } from "next/navigation";

import { clientServer } from "@/lib/supabase/server";

export type Ruolo = "direttore" | "segreteria" | "insegnante";

export type PersonaInSessione = {
  id: string;
  full_name: string;
  ruolo: Ruolo;
};

/** `getUser()` e non `getSession()`: il token lo valida il server di Auth.
 *  Il ruolo si legge da `staff`, che l'utente non puo' riscrivere. */
export async function richiediStaff(): Promise<PersonaInSessione> {
  const supabase = await clientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: persona } = await supabase
    .from("staff")
    .select("id, full_name, ruolo")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!persona) {
    redirect("/accedi?motivo=non-autorizzato");
  }

  return persona as PersonaInSessione;
}

export async function richiediRuolo(
  ...ammessi: readonly Ruolo[]
): Promise<PersonaInSessione> {
  const persona = await richiediStaff();

  if (!ammessi.includes(persona.ruolo)) {
    redirect("/admin?motivo=ruolo-insufficiente");
  }

  return persona;
}
