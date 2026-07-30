import { expect, test } from "@playwright/test";

import { UTENTI } from "./helpers/auth";
import {
  admin,
  clientComeUtente,
  contaOrdini,
  forzaStatoOrdine,
  statoOrdine,
  SEED,
} from "./helpers/db";

// Nessuna sessione di browser: l'attacco non passa dalla UI. La cliente non ha
// nessun bottone «crea ordine» da premere, quindi provarci dal gestionale
// dimostrerebbe solo che il bottone non c'e'. Cio' che le policy devono reggere
// e' la chiamata all'API dati fatta col suo token vero — quella che chiunque
// apra i DevTools puo' ripetere.
test.use({ storageState: { cookies: [], origins: [] } });

/** Anna Rossi in `customers`: l'ordine sarebbe intestato a lei, non a un terzo. */
const CLIENTE_ANNA = "22222222-2222-2222-2222-222222222001";

/** Marcatore dell'ordine iniettato: serve a ripulire se un giorno la RLS cede. */
const INDIRIZZO_ATTACCO = "Via Iniettata 1";

test("la cliente non crea ordini ne' li fa avanzare @flusso:ordine-non-creabile-dal-cliente", async () => {
  const ordiniPrima = await contaOrdini();
  const statoPrima = await statoOrdine(SEED.ordineConfermato);
  expect(statoPrima, "premessa del flusso: l'ordine di collaudo parte da «confermato»").toBe(
    "confermato",
  );

  // Il token vero della cliente, coniato dal server di Auth con la chiave
  // pubblica. Un token costruito a mano lo rifiuterebbe GoTrue prima che la RLS
  // entri in gioco, e il verde parlerebbe dell'autenticazione, non della policy.
  const cliente = await clientComeUtente(UTENTI.cliente.email, UTENTI.cliente.password);

  // ---------------------------------------------------------------- attacco 1
  // Tutte le colonne NOT NULL senza default di `orders` sono compilate
  // (customer_id, shipping_name, shipping_address, shipping_city) e `status` e'
  // lasciato al default `in_attesa`, che e' il solo stato di nascita che il
  // trigger `orders_transizione` ammette. La distinzione conta: se mancasse una
  // colonna il rifiuto sarebbe 23502 (vincolo di colonna) o 23514 (check), cioe'
  // Postgres che scarta una riga malfatta — e la spec resterebbe verde anche il
  // giorno in cui la policy sparisce. Riempiendo tutto, l'unica cosa che puo'
  // fermare l'inserimento e' la RLS: nessuna policy `for insert` di `orders`
  // vale per il cliente, solo `staff_scrive_gli_ordini`.
  const inserimento = await cliente
    .from("orders")
    .insert({
      customer_id: CLIENTE_ANNA,
      shipping_name: "Anna Rossi",
      shipping_address: INDIRIZZO_ATTACCO,
      shipping_city: "Novara",
    })
    .select();

  expect(
    inserimento.error?.code,
    `la RLS non ha respinto l'inserimento: ${inserimento.error?.message ?? "nessun errore"}`,
  ).toBe("42501");
  expect(inserimento.data, "PostgREST ha restituito la riga: l'ordine e' stato scritto").toBeNull();

  // ---------------------------------------------------------------- attacco 2
  // L'aggiornamento ha una forma di rifiuto diversa, e va saputa: senza policy
  // `for update` la RLS non solleva, FILTRA — la riga non entra nemmeno
  // nell'insieme da aggiornare. La risposta e' quindi un 200 senza errore, e il
  // `.select()` serve a contare le righe davvero toccate: e' l'unico modo di
  // distinguere «zero righe» da «riuscito». Un rifiuto silenzioso resta un
  // rifiuto, ma non lascia traccia nella risposta: per questo la prova finale la
  // da' il database, non lo status code.
  const aggiornamento = await cliente
    .from("orders")
    .update({ status: "consegnato" })
    .eq("id", SEED.ordineConfermato)
    .select();

  expect(
    aggiornamento.error,
    `atteso un rifiuto silenzioso, non un errore: ${aggiornamento.error?.message ?? ""}`,
  ).toBeNull();
  expect(
    aggiornamento.data ?? [],
    "la cliente ha toccato righe di `orders`: la policy di update la lascia passare",
  ).toHaveLength(0);

  // ------------------------------------------------------- database invariato
  // L'asserzione che non si puo' aggirare: lo status code lo decide l'API, il
  // conteggio lo decide il dato.
  expect(await contaOrdini(), "il numero di ordini e' cambiato: qualcosa e' stato scritto").toBe(
    ordiniPrima,
  );
  expect(
    await statoOrdine(SEED.ordineConfermato),
    "lo stato dell'ordine e' cambiato: l'update e' andato a segno",
  ).toBe("confermato");
});

test.afterAll(async () => {
  // La spec, quando passa, non sporca niente: entrambe le scritture sono
  // respinte. Il ripristino serve al caso in cui la RLS ceda — allora il test e'
  // rosso, ma il seed resta pulito e il giro successivo misura lo stesso
  // database di questo, senza `supabase db reset`.
  if ((await statoOrdine(SEED.ordineConfermato)) !== "confermato") {
    await forzaStatoOrdine(SEED.ordineConfermato, "confermato");
  }
  const { error } = await admin.from("orders").delete().eq("shipping_address", INDIRIZZO_ATTACCO);
  if (error) throw new Error(`ripristino degli ordini iniettati: ${error.message}`);
});
