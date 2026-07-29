"use server";

import { revalidatePath } from "next/cache";

import { clientServer } from "@/lib/supabase/server";
import { richiediStaff } from "@/modules/admin/guardia";
import { TRANSIZIONI } from "@/modules/ordini/query";

/**
 * Lo stato dell'ordine lo vincola il database (trigger `orders_transizione`).
 * Qui si controlla lo stesso, per due motivi che non si sostituiscono:
 * l'interfaccia deve offrire solo le mosse legali, e un errore del database
 * arriva all'utente come un messaggio incomprensibile.
 * La difesa vera resta quella del trigger.
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

  const { error } = await supabase
    .from("orders")
    .update({ status: nuovo })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/ordini");
}
