import { createClient } from "@supabase/supabase-js";

import { caricaEnvE2E } from "./env";

/**
 * L'UNICO punto del progetto in cui vive la chiave amministrativa.
 *
 * Serve alle asserzioni di effetto: dopo un flusso si guarda la riga vera nel
 * database, non il testo in pagina. Un test che guarda solo la UI passa anche
 * con un backend finto, ed e' il modo piu' comodo che esiste per firmare un
 * verde che non ha guardato niente.
 *
 * Regole che non si negoziano:
 *  - questa chiave non entra mai in `src/`, e nessun file di `src/` importa da `e2e/`;
 *  - il nome non comincia MAI per `NEXT_PUBLIC_`, o il bundle client se la porta via;
 *  - non si impersona con la chiave per "arrivare prima": i flussi si percorrono
 *    col ruolo vero (anonimo o utente autenticato), questa serve solo a MISURARE.
 */
caricaEnvE2E();

const URL_SUPABASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:57421";
const CHIAVE_SEGRETA = process.env.SUPABASE_SECRET_KEY;

if (!CHIAVE_SEGRETA) {
  throw new Error(
    "manca SUPABASE_SECRET_KEY in .env.e2e.local: senza chiave amministrativa " +
      "le asserzioni di effetto non possono leggere il database, e una batteria " +
      "che non misura l'effetto non e' una batteria",
  );
}

export { URL_SUPABASE };

export const CHIAVE_ANONIMA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const admin = createClient(URL_SUPABASE, CHIAVE_SEGRETA, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Un client con la chiave PUBBLICA, autenticato come una persona vera.
 *
 * Serve ai flussi ostili in scrittura: si attacca col ruolo che l'attaccante ha
 * davvero, non con la chiave amministrativa. Impersonare con `admin` per
 * "arrivare prima" proverebbe soltanto che la chiave amministrativa scavalca le
 * policy — cosa che sappiamo gia' e che non e' il flusso.
 */
export async function clientComeUtente(email: string, password: string) {
  const client = createClient(URL_SUPABASE, CHIAVE_ANONIMA, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`clientComeUtente(${email}): ${error.message}`);
  return client;
}

/** Client con la sola chiave pubblica, senza nessuna sessione. */
export function clientAnonimo() {
  return createClient(URL_SUPABASE, CHIAVE_ANONIMA, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** `last_sign_in_at` letto dall'admin API: lo scrive il server di Auth. */
export async function ultimoAccesso(email: string): Promise<number | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  // `error.message` dell'admin API puo' essere vuoto, e il messaggio diventava
  // `ultimoAccesso(...): ` — una diagnosi che non dice niente. Meglio l'oggetto
  // intero che il nulla (residuo §4.2 dell'handoff 12, chiuso il 2026-07-30).
  if (error) {
    throw new Error(
      `ultimoAccesso(${email}): ${error.message || JSON.stringify(error)}`,
    );
  }
  const utente = data.users.find((u) => u.email === email);
  if (!utente?.last_sign_in_at) return null;
  return new Date(utente.last_sign_in_at).getTime();
}

/** Cancella un prodotto di collaudo, cosi' il flusso e' rilanciabile. */
export async function cancellaProdottoPerSlug(slug: string): Promise<void> {
  const { error } = await admin.from("products").delete().eq("slug", slug);
  if (error) throw new Error(`cancellaProdottoPerSlug(${slug}): ${error.message}`);
}

/** Riporta uno stato a mano, per i ripristini di fine spec. */
export async function forzaStatoOrdine(id: string, stato: string): Promise<void> {
  const { error } = await admin.from("orders").update({ status: stato }).eq("id", id);
  if (error) throw new Error(`forzaStatoOrdine(${id}, ${stato}): ${error.message}`);
}

/** Riporta un ruolo a mano (l'RPC pretende di essere chiamata da un titolare). */
export async function forzaRuolo(idStaff: string, ruolo: string): Promise<void> {
  const { error } = await admin.from("staff").update({ ruolo }).eq("id", idStaff);
  if (error) throw new Error(`forzaRuolo(${idStaff}, ${ruolo}): ${error.message}`);
}

/** Riporta il titolo di uno slot di contenuto. */
export async function forzaTitoloContenuto(slot: string, titolo: string): Promise<void> {
  const { error } = await admin.from("site_content").update({ title: titolo }).eq("slot", slot);
  if (error) throw new Error(`forzaTitoloContenuto(${slot}): ${error.message}`);
}

export async function staffAttivo(idStaff: string): Promise<boolean | null> {
  const { data, error } = await admin
    .from("staff")
    .select("is_active")
    .eq("id", idStaff)
    .maybeSingle();
  if (error) throw new Error(`staffAttivo(${idStaff}): ${error.message}`);
  return data?.is_active ?? null;
}

export async function contaOrdini(): Promise<number> {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`contaOrdini: ${error.message}`);
  return count ?? 0;
}

/** Chiavi vere del seed, usate come punto d'aggancio dalle spec. */
export const SEED = {
  prodottoPubblicato: "44444444-4444-4444-4444-444444444001",
  ordineInAttesa: "66666666-6666-6666-6666-666666666001",
  ordineConfermato: "66666666-6666-6666-6666-666666666002",
  staffTitolare: "11111111-1111-1111-1111-111111111001",
  staffMagazziniere: "11111111-1111-1111-1111-111111111002",
  staffRedattore: "11111111-1111-1111-1111-111111111003",
  clienteSenzaAccount: "22222222-2222-2222-2222-222222222002",
} as const;

// Funzioni piccole e nominate, una per domanda: il nome finisce nel messaggio
// di fallimento, e `statoOrdine(...) === "confermato"` si legge, mentre un
// `query("select ...")` generico costringe a rileggere la spec per capire cosa
// e' andato storto.

export async function contaProdotti(): Promise<number> {
  const { count, error } = await admin
    .from("products")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`contaProdotti: ${error.message}`);
  return count ?? 0;
}

export async function prodottoPerSlug(
  slug: string,
): Promise<{ id: string; name: string; is_published: boolean } | null> {
  const { data, error } = await admin
    .from("products")
    .select("id, name, is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`prodottoPerSlug(${slug}): ${error.message}`);
  return data;
}

export async function contaCategorie(): Promise<number> {
  const { count, error } = await admin
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`contaCategorie: ${error.message}`);
  return count ?? 0;
}

export async function contaClienti(): Promise<number> {
  const { count, error } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`contaClienti: ${error.message}`);
  return count ?? 0;
}

export async function clientePerId(
  id: string,
): Promise<{ full_name: string; email: string | null; phone: string | null } | null> {
  const { data, error } = await admin
    .from("customers")
    .select("full_name, email, phone")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`clientePerId(${id}): ${error.message}`);
  return data;
}

/** Riporta il telefono di un cliente, per il ripristino di fine spec. */
export async function forzaTelefonoCliente(
  id: string,
  telefono: string | null,
): Promise<void> {
  const { error } = await admin
    .from("customers")
    .update({ phone: telefono })
    .eq("id", id);
  if (error) throw new Error(`forzaTelefonoCliente(${id}): ${error.message}`);
}

/**
 * Quante identita' ha l'utente in `auth.identities`, via l'admin API.
 *
 * Due chiamate e non una, per un motivo misurato il 2026-07-30: `listUsers`
 * **non idrata `identities`** e restituisce sempre `[]`, anche con quattro righe
 * vere nella tabella. Solo `getUserById` le carica. Chiedere la lista e contare
 * di li' produceva un rosso che accusava il seed di un buco che non c'era — il
 * genere di rosso che insegna a non fidarsi della batteria.
 */
export async function identitaDi(email: string): Promise<number | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    throw new Error(`identitaDi(${email}): ${error.message || JSON.stringify(error)}`);
  }
  const utente = data.users.find((u) => u.email === email);
  if (!utente) return null;

  const { data: pieno, error: erroreUtente } =
    await admin.auth.admin.getUserById(utente.id);
  if (erroreUtente) {
    throw new Error(
      `identitaDi(${email}): ${erroreUtente.message || JSON.stringify(erroreUtente)}`,
    );
  }
  return (pieno.user?.identities ?? []).length;
}

export async function statoOrdine(id: string): Promise<string | null> {
  const { data, error } = await admin
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`statoOrdine(${id}): ${error.message}`);
  return data?.status ?? null;
}

export async function ruoloDi(idStaff: string): Promise<string | null> {
  const { data, error } = await admin
    .from("staff")
    .select("ruolo")
    .eq("id", idStaff)
    .maybeSingle();
  if (error) throw new Error(`ruoloDi(${idStaff}): ${error.message}`);
  return data?.ruolo ?? null;
}

export async function contenutoPerSlot(
  slot: string,
): Promise<{ id: string; title: string; corpo: string | null } | null> {
  const { data, error } = await admin
    .from("site_content")
    .select("id, title, corpo")
    .eq("slot", slot)
    .maybeSingle();
  if (error) throw new Error(`contenutoPerSlot(${slot}): ${error.message}`);
  return data;
}

export async function variantePerSku(
  sku: string,
): Promise<{ id: string; size: string; price_cents: number; quantity: number } | null> {
  const { data, error } = await admin
    .from("product_variants")
    .select("id, size, price_cents, quantity")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(`variantePerSku(${sku}): ${error.message}`);
  return data;
}

export async function primaVariante(): Promise<{
  id: string;
  sku: string;
  size: string;
  price_cents: number;
  quantity: number;
} | null> {
  const { data, error } = await admin
    .from("product_variants")
    .select("id, sku, size, price_cents, quantity")
    .eq("product_id", SEED.prodottoPubblicato)
    .order("sku", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`primaVariante: ${error.message}`);
  return data;
}
