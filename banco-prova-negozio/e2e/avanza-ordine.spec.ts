import { expect, test } from "@playwright/test";

import { SEED, admin, statoOrdine } from "./helpers/db";

// Il flusso e' del magazziniere: /admin/ordini non ha vincolo di ruolo, ma
// percorrerlo col titolare misurerebbe un altro attore.
test.use({ storageState: "e2e/.auth/magazziniere.json" });

/** Coppia che identifica l'ordine 666...6001 nel seed, e solo lui. */
const CLIENTE = "Anna Rossi";
const CITTA = "Novara";

function esigi<T extends { error: { message: string } | null }>(esito: T, passo: string): T {
  if (esito.error) {
    throw new Error(`ripristino dell'ordine di collaudo, ${passo}: ${esito.error.message}`);
  }
  return esito;
}

/**
 * Riporta l'ordine di collaudo a `in_attesa`: e' cio' che rende la spec
 * rilanciabile senza `supabase db reset`.
 *
 * `forzaStatoOrdine(id, "in_attesa")` NON basta, e non e' un dettaglio di
 * stile. Il trigger `orders_transizione` (20260728120200_ordini.sql) ammette
 * solo in_attesa -> confermato|annullato, confermato -> spedito|annullato,
 * spedito -> consegnato: la macchina a stati e' a SENSO UNICO, e i trigger
 * valgono anche per la chiave amministrativa, che scavalca la RLS ma non loro.
 * A test passato quell'update risponderebbe «transizione non ammessa:
 * confermato -> in_attesa», l'hook morirebbe e un flusso funzionante
 * risulterebbe rosso — ogni giro, non solo il secondo.
 *
 * L'unica strada di ritorno e' ricreare la riga: all'INSERT il trigger pretende
 * `in_attesa`, che e' esattamente lo stato che serve. Le righe dell'ordine si
 * rileggono e si riscrivono identiche (`on delete restrict` obbliga a toglierle
 * per prime), e placed_at/created_at si riportano tali e quali, cosi' il
 * criterio di ordinamento della pagina resta quello del seed.
 */
async function riportaInAttesa(): Promise<void> {
  if ((await statoOrdine(SEED.ordineInAttesa)) === "in_attesa") return;

  const testata = esigi(
    await admin.from("orders").select("*").eq("id", SEED.ordineInAttesa).single(),
    "lettura della testata",
  );
  const righe = esigi(
    await admin.from("order_items").select("*").eq("order_id", SEED.ordineInAttesa),
    "lettura delle righe",
  );

  esigi(
    await admin.from("order_items").delete().eq("order_id", SEED.ordineInAttesa),
    "cancellazione delle righe",
  );
  esigi(
    await admin.from("orders").delete().eq("id", SEED.ordineInAttesa),
    "cancellazione della testata",
  );

  esigi(
    await admin
      .from("orders")
      .insert({ ...(testata.data as Record<string, unknown>), status: "in_attesa" }),
    "reinserimento della testata",
  );
  const daRimettere = (righe.data ?? []) as Record<string, unknown>[];
  if (daRimettere.length > 0) {
    esigi(await admin.from("order_items").insert(daRimettere), "reinserimento delle righe");
  }
}

// Stato di partenza garantito e stato finale ripristinato: vale anche quando il
// test fallisce a meta'.
test.beforeAll(async () => {
  await riportaInAttesa();
});

test.afterAll(async () => {
  await riportaInAttesa();
});

test("il magazziniere porta l'ordine in attesa a confermato @flusso:avanza-ordine", async ({
  page,
}) => {
  expect(
    await statoOrdine(SEED.ordineInAttesa),
    "premessa mancata: l'ordine di collaudo non parte da «in_attesa»",
  ).toBe("in_attesa");

  await page.goto("/admin/ordini");
  await expect(page.getByRole("heading", { name: "Ordini", level: 1 })).toBeVisible();

  // COME SI INDIVIDUA LA RIGA, e perche' non e' «la prima». L'elenco e' ordinato
  // per `placed_at` discendente e i due ordini del seed hanno lo stesso istante
  // (inseriti nella stessa transazione): a parita' di chiave la posizione non la
  // decide nessuno. In piu' il ripristino qui sopra riscrive la riga, e con essa
  // l'ordine fisico da cui Postgres pesca. L'unica ancora stabile e' il
  // contenuto: 666...6001 e' l'ordine di Anna Rossi spedito a Novara, l'altro e'
  // di Pietro Gallo a Biella. `toHaveCount(1)` trasforma l'individuazione in
  // un'asserzione: se un domani ci fossero due ordini di Anna Rossi la spec
  // diventerebbe rossa invece di far avanzare l'ordine sbagliato.
  const riga = page.getByRole("row").filter({ hasText: CLIENTE }).filter({ hasText: CITTA });
  await expect(riga, `nessuna riga unica per ${CLIENTE} a ${CITTA}`).toHaveCount(1);
  await expect(
    riga.getByRole("cell").filter({ hasText: "in_attesa" }),
    "la riga individuata non mostra «in_attesa»: e' l'ordine sbagliato",
  ).toHaveCount(1);

  // Il select NON si prende con getByLabel, e il motivo va scritto: `CampoScelta`
  // ricava l'`id` dal solo nome del campo e la pagina degli ordini non le passa
  // `suffisso`, quindi ogni riga ripete id="status". Con id duplicati il `for`
  // della seconda label risolve sul select della PRIMA riga (getElementById
  // restituisce il primo in ordine di documento) e `element.labels` della seconda
  // resta vuoto: `getByLabel("Nuovo stato")` dentro la riga giusta troverebbe
  // zero elementi ogni volta che quella riga non e' la prima. E' un difetto di
  // accessibilita' dell'app, non del test. Dentro la riga gia' ristretta il ruolo
  // e' univoco; l'etichetta si asserisce a parte, cosi' se sparisce si vede.
  await expect(
    riga.getByText("Nuovo stato"),
    "il campo di avanzamento non e' piu' etichettato",
  ).toBeVisible();
  // Testo e valore dell'opzione coincidono: sono gli stati grezzi del database.
  await riga.getByRole("combobox").selectOption("confermato");
  await riga.getByRole("button", { name: "Avanza" }).click();

  // Nessun componente client, quindi nessun messaggio di conferma da attendere:
  // la condizione e' il ri-render innescato da `revalidatePath`. Si asserisce la
  // SPARIZIONE di «in_attesa», non la comparsa di «confermato»: quella parola
  // era gia' nella riga prima del clic, come opzione del select, e cercarla e
  // basta sarebbe verde anche con l'azione server svuotata.
  await expect(
    riga.getByRole("cell").filter({ hasText: "in_attesa" }),
    "la riga mostra ancora «in_attesa»: l'avanzamento non e' arrivato in pagina",
  ).toHaveCount(0);
  await expect(
    riga.getByRole("cell").filter({ hasText: "confermato" }),
    "nessuna cella della riga mostra «confermato»",
  ).toHaveCount(1);

  // L'effetto vero. La pagina puo' mentire, la riga no — ed e' anche la prova
  // che la scrittura ha superato il trigger della macchina a stati, l'unico
  // giudice di quella transizione.
  await expect
    .poll(() => statoOrdine(SEED.ordineInAttesa), {
      message:
        "orders.status non e' avanzato: la pagina ha detto «confermato», il database no",
    })
    .toBe("confermato");
});
