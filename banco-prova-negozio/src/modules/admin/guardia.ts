import { redirect } from "next/navigation";

import { clientServer } from "@/lib/supabase/server";

export type Ruolo = "titolare" | "magazziniere" | "redattore";

export type PersonaInSessione = {
  id: string;
  full_name: string;
  ruolo: Ruolo;
};

/**
 * La guardia della sezione admin. Due controlli, in quest'ordine:
 *
 *  1. `getUser()` — e non `getSession()`: la sessione arriva dai cookie, che
 *     il browser puo' scrivere; `getUser()` fa validare il token dal server di
 *     Auth. Un controllo su un dato che l'utente controlla non e' un controllo.
 *  2. il ruolo si legge dalla tabella `staff`, che l'utente non puo' scrivere
 *     (il `grant update` e' per colonna e non comprende `ruolo`). Mai da
 *     `user_metadata`, che lo scrive l'utente stesso.
 *
 * Chi non passa viene rimandato alla pagina di accesso: nessuna rotta admin
 * risponde a chi non e' staff.
 */
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

/**
 * Come sopra, piu' il vincolo di ruolo. Serve dove il permesso non e' «essere
 * staff» ma «essere quel ruolo li'»: i contenuti li scrive il redattore, il
 * personale lo gestisce il titolare.
 *
 * Questo controllo NON sostituisce la policy: la policy e' l'unica difesa vera,
 * questo evita all'utente di vedere un pulsante che il database rifiutera'.
 */
export async function richiediRuolo(
  ...ammessi: readonly Ruolo[]
): Promise<PersonaInSessione> {
  const persona = await richiediStaff();

  if (!ammessi.includes(persona.ruolo)) {
    redirect("/admin?motivo=ruolo-insufficiente");
  }

  return persona;
}
