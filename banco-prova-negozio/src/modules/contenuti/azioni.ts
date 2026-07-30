"use server";

import { revalidatePath } from "next/cache";

import { esigiRigaToccata } from "@/lib/scritture";
import { clientServer } from "@/lib/supabase/server";
import { richiediSezione } from "@/modules/admin/guardia";

/**
 * I contenuti del sito sono l'eredita' del CMS che la pipeline non ha piu':
 * stanno in Supabase e si modificano da qui. Il permesso e' quello della sezione
 * `/admin/contenuti` — redattore e titolare — e si legge da `SEZIONI`, la stessa
 * fonte che decide se la voce compare nel menu.
 *
 * `creaContenuto` viveva qui ed e' stata TOLTA il 2026-07-30. Nessuna vista la
 * importava: era una POST raggiungibile senza percorso d'interfaccia, e cio' che
 * creava — una riga con uno `slot` nuovo — non lo mostra nessuna pagina, perche'
 * gli slot li nomina il codice del sito (`home-hero` in `src/app/page.tsx`). Uno
 * slot che nessuno rende e' una riga morta con un endpoint aperto davanti.
 * Il giorno in cui il sito avra' slot dinamici, si riscrive con la sua vista e
 * la sua spec.
 */
export async function aggiornaContenuto(dati: FormData) {
  await richiediSezione("/admin/contenuti");
  const supabase = await clientServer();

  const { data, error } = await supabase
    .from("site_content")
    .update({
      title: String(dati.get("title") ?? ""),
      corpo: String(dati.get("corpo") ?? ""),
      image_url: String(dati.get("image_url") ?? "") || null,
      is_published: dati.get("is_published") === "on",
    })
    .eq("id", String(dati.get("id") ?? ""))
    .select("id");

  if (error) throw new Error(error.message);
  esigiRigaToccata(data, "contenuto non trovato: ricarica la pagina");
  revalidatePath("/admin/contenuti");
}
