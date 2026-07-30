import { redirect } from "next/navigation";

import { clientServer } from "@/lib/supabase/server";

export type Ruolo = "titolare" | "magazziniere" | "redattore";

export type PersonaInSessione = {
  id: string;
  full_name: string;
  ruolo: Ruolo;
};

/**
 * Le sezioni del gestionale e chi puo' entrarci. **Fonte unica**: la usa il menu
 * per decidere cosa mostrare e la usa la pagina per decidere chi far passare.
 *
 * Prima erano due elenchi separati — una costante nel layout e una chiamata a
 * `richiediRuolo` dentro ogni pagina — e divergevano gia' il primo giorno: il
 * menu offriva «Contenuti» e «Personale» a ogni ruolo, la guardia li negava. Il
 * magazziniere cliccava una voce che lo rimbalzava indietro. Con due elenchi il
 * disallineamento non e' un errore che capita, e' lo stato normale.
 *
 * `ruoli: null` significa «basta essere staff», non «aperta a tutti».
 */
export const SEZIONI = [
  { href: "/admin/prodotti", testo: "Prodotti", ruoli: null },
  { href: "/admin/categorie", testo: "Categorie", ruoli: null },
  { href: "/admin/ordini", testo: "Ordini", ruoli: null },
  { href: "/admin/clienti", testo: "Clienti", ruoli: null },
  {
    href: "/admin/contenuti",
    testo: "Contenuti",
    ruoli: ["redattore", "titolare"],
  },
  { href: "/admin/personale", testo: "Personale", ruoli: ["titolare"] },
] as const satisfies readonly {
  href: string;
  testo: string;
  ruoli: readonly Ruolo[] | null;
}[];

export type Sezione = (typeof SEZIONI)[number];

/** Le voci che quel ruolo puo' davvero aprire: il menu non promette altro. */
export function sezioniPer(ruolo: Ruolo): readonly Sezione[] {
  return SEZIONI.filter((s) => {
    if (s.ruoli === null) return true;
    // L'`as const` rende ogni elenco una tupla di letterali (`readonly
    // ["titolare"]`), e `includes` di una tupla accetta solo i suoi letterali.
    // Si allarga con un'annotazione, non con un cast: qui il compilatore
    // controlla ancora che i valori siano `Ruolo`.
    const ammessi: readonly Ruolo[] = s.ruoli;
    return ammessi.includes(ruolo);
  });
}

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

/**
 * La guardia di una sezione, letta da `SEZIONI`. Una pagina che la usa non puo'
 * chiedere un ruolo diverso da quello per cui il menu la mostra: e' lo stesso
 * dato, non due copie che si assomigliano.
 */
export async function richiediSezione(
  href: Sezione["href"],
): Promise<PersonaInSessione> {
  const sezione = SEZIONI.find((s) => s.href === href);

  // Una sezione che non sta nell'elenco non e' «aperta»: e' un errore di
  // programmazione, e il caso peggiore va chiuso, non lasciato passare.
  if (!sezione) {
    throw new Error(`sezione sconosciuta: ${href}`);
  }

  return sezione.ruoli === null
    ? richiediStaff()
    : richiediRuolo(...sezione.ruoli);
}
