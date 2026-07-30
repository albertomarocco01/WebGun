import { test, expect } from "@playwright/test";

import { contenutoPerSlot, forzaTitoloContenuto } from "./helpers/db";

// Marcatore fisso piu' istante: il titolo e' irripetibile fra due giri, ma resta
// riconoscibile come titolo di collaudo anche da un processo che non l'ha scritto
// (Playwright riavvia il worker dopo un fallimento, e la costante in memoria muore
// con lui).
const MARCATORE = "Collaudo hero";
const nuovoTitolo = `${MARCATORE} ${Date.now()}`;

// Rete per il caso in cui un giro precedente sia morto fra la scrittura e il
// ripristino: senza, il `beforeAll` conserverebbe come "originale" un titolo di
// collaudo e l'`afterAll` lo renderebbe permanente, rendendo la spec non
// rilanciabile senza `supabase db reset`.
const TITOLO_SEED = "Lana che dura";

let titoloOriginale = "";

test.beforeAll(async () => {
  const contenuto = await contenutoPerSlot("home-hero");
  if (!contenuto) {
    throw new Error("slot home-hero assente: il seed non e' quello che la spec assume");
  }
  titoloOriginale = contenuto.title.startsWith(MARCATORE) ? TITOLO_SEED : contenuto.title;
});

// Il ripristino sta a fine FILE, non a fine primo test: il secondo test deve
// ancora vedere il titolo nuovo sulla home.
test.afterAll(async () => {
  if (titoloOriginale) await forzaTitoloContenuto("home-hero", titoloOriginale);
});

test.describe("il redattore riscrive lo slot home-hero", () => {
  test.use({ storageState: "e2e/.auth/redattore.json" });

  test("il redattore cambia il titolo di home-hero @flusso:modifica-contenuto-home", async ({
    page,
  }) => {
    await page.goto("/admin/contenuti");
    await expect(
      page.getByRole("heading", { name: "Contenuti del sito", level: 1 }),
    ).toBeVisible();

    // Ogni slot ripete le stesse etichette ("Titolo", "Testo", "Pubblicato"):
    // senza restringere all'article dello slot giusto, `getByLabel` e' ambiguo e
    // il test potrebbe riscrivere home-promo restando verde.
    const scheda = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "home-hero" }) });
    await expect(scheda, "lo slot home-hero non e' nella pagina").toHaveCount(1);

    await scheda.getByLabel("Titolo").fill(nuovoTitolo);
    await scheda.getByRole("button", { name: "Salva" }).click();

    // Nessun componente client, quindi nessun messaggio di conferma da attendere:
    // la condizione e' la riga vera nel database.
    await expect
      .poll(async () => (await contenutoPerSlot("home-hero"))?.title, {
        message: "site_content.title dello slot home-hero non e' stato riscritto",
      })
      .toBe(nuovoTitolo);

    // Rilettura da una GET pulita: prova che il valore lo serve il server e non e'
    // soltanto quello digitato, rimasto nel campo dopo il submit.
    await page.goto("/admin/contenuti");
    await expect(scheda.getByLabel("Titolo")).toHaveValue(nuovoTitolo);
  });
});

test.describe("la home pubblica mostra il titolo riscritto", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("un anonimo legge il nuovo titolo in home @flusso:modifica-contenuto-home", async ({
    page,
  }) => {
    // Il titolo atteso si rilegge dal database invece di fidarsi della costante di
    // modulo: se il test precedente e' stato ritentato in un altro worker, quella
    // costante non e' piu' il valore scritto davvero.
    const titoloInTabella = (await contenutoPerSlot("home-hero"))?.title ?? "";
    expect(
      titoloInTabella,
      "il titolo in tabella non e' quello di collaudo: il primo test non ha scritto",
    ).toContain(MARCATORE);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(titoloInTabella);
  });
});
