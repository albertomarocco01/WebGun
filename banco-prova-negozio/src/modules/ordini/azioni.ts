"use server";

import { revalidatePath } from "next/cache";

import { esigiRigaToccata } from "@/lib/scritture";
import { clientServer } from "@/lib/supabase/server";
import { richiediStaff } from "@/modules/admin/guardia";
import { TRANSIZIONI } from "@/modules/ordini/query";

/**
 * Lo stato dell'ordine lo vincola il database (trigger `orders_transizione`).
 * Qui si controlla lo stesso, per due motivi che non si sostituiscono:
 * l'interfaccia deve offrire solo le mosse legali, e un errore del database
 * arriva all'utente come un messaggio incomprensibile.
 *
 * `status_attuale` arriva da un campo nascosto — cioè dal client — quindi non
 * è un'ipotesi da credere: entra nella CONDIZIONE dell'update. Se la riga è
 * cambiata nel frattempo si toccano zero righe, e zero righe non è un successo.
 * (Difetto trovato dal tribunale il 2026-07-28 sulla forma gemella di questa
 * azione nel banco dell'accademia.)
 */
export async function avanzaOrdine(dati: FormData) {
  await richiediStaff();
  const supabase = await clientServer();

  const id = String(dati.get("id") ?? "");
  const nuovo = String(dati.get("status") ?? "");
  const attuale = String(dati.get("status_attuale") ?? "");

  if (!TRANSIZIONI[attuale]?.includes(nuovo)) {
    throw new Error(`transizione non ammessa: ${attuale} -> ${nuovo}`);
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: nuovo })
    .eq("id", id)
    .eq("status", attuale)
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(
    data,
    "l'ordine è cambiato nel frattempo: ricarica la pagina",
  );

  revalidatePath("/admin/ordini");
}
