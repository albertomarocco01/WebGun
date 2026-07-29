"use server";

import { redirect } from "next/navigation";

import { clientServer } from "@/lib/supabase/server";

/**
 * Accesso e uscita. Sono le due sole azioni server senza guardia, ed e' ovvio
 * il motivo: sono la guardia. Il messaggio d'errore non distingue «email
 * sconosciuta» da «password sbagliata», o diventa un modo per sapere chi ha un
 * account.
 */
export async function accedi(dati: FormData) {
  const supabase = await clientServer();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(dati.get("email") ?? ""),
    password: String(dati.get("password") ?? ""),
  });

  if (error) {
    redirect("/accedi?motivo=credenziali");
  }

  redirect("/admin");
}

export async function esci() {
  const supabase = await clientServer();
  await supabase.auth.signOut();
  redirect("/accedi");
}
