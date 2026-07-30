import { test, expect } from "@playwright/test";

import { cancellaProdottoPerSlug, contaProdotti, prodottoPerSlug } from "./helpers/db";

test.use({ storageState: "e2e/.auth/magazziniere.json" });

// Slug FISSO e riconoscibile invece di uno irripetibile con `Date.now()`: la
// riga va ritrovata per slug dal database e va tolta di mezzo alla fine, cosi'
// la spec rigira senza `supabase db reset`. Un nome irripetibile eviterebbe la
// pulizia ma lascerebbe un prodotto di collaudo a ogni giro, e il conteggio di
// `contaProdotti` diventerebbe una misura di quante volte e' girata la batteria.
const SLUG = "collaudo-e2e-maglia";
const NOME = "Maglia di collaudo E2E";

// Prima: il residuo di un giro precedente interrotto falserebbe sia il
// conteggio sia il vincolo di unicita' dello slug.
test.beforeAll(async () => {
  await cancellaProdottoPerSlug(SLUG);
});

// Dopo: vale anche quando il test fallisce a meta'.
test.afterAll(async () => {
  await cancellaProdottoPerSlug(SLUG);
});

test("il magazziniere crea un prodotto pubblicato @flusso:crea-prodotto", async ({ page }) => {
  const prima = await contaProdotti();

  await page.goto("/admin/prodotti");
  await expect(page.getByRole("heading", { name: "Prodotti", level: 1 })).toBeVisible();

  await page.getByLabel("Nome").fill(NOME);
  await page.getByLabel("Slug").fill(SLUG);
  // Il valore delle opzioni e' l'id della categoria: si sceglie per etichetta,
  // che e' l'unica cosa che l'utente legge davvero.
  await page.getByLabel("Categoria").selectOption({ label: "Maglieria" });
  await page.getByLabel("Pubblicato").check();
  await page.getByRole("button", { name: "Crea" }).click();

  // Nessun componente client, nessun messaggio di conferma: si aspetta il
  // ri-render della tabella, cioe' una condizione, non un ritardo.
  await expect(
    page.getByRole("row").filter({ hasText: NOME }),
    "la riga del prodotto non e' comparsa in tabella dopo «Crea»",
  ).toBeVisible();

  // L'effetto vero: la pagina puo' mentire, la riga no.
  const riga = await prodottoPerSlug(SLUG);
  expect(riga, `nessuna riga di products con slug ${SLUG}`).not.toBeNull();
  expect(riga?.name, "il nome salvato non e' quello digitato").toBe(NOME);
  expect(riga?.is_published, "la spunta «Pubblicato» non e' arrivata al database").toBe(true);
  expect(await contaProdotti(), "il catalogo non e' cresciuto di una riga").toBe(prima + 1);
});
