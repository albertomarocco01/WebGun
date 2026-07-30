import { expect, test } from "@playwright/test";

import { SEED, forzaRuolo, ruoloDi } from "./helpers/db";

// Solo il titolare entra in /admin/personale: con qualunque altra sessione la
// guardia rimanda a /admin e il flusso non esisterebbe nemmeno.
test.use({ storageState: "e2e/.auth/titolare.json" });

// Stato di partenza garantito e stato finale ripristinato: la spec e'
// rilanciabile senza `supabase db reset`. Il ripristino passa dalla chiave
// amministrativa perche' l'RPC `cambia_ruolo` pretende un titolare, e un test
// che si ripulisce da solo non e' un titolare.
test.beforeAll(async () => {
  await forzaRuolo(SEED.staffMagazziniere, "magazziniere");
});

test.afterAll(async () => {
  await forzaRuolo(SEED.staffMagazziniere, "magazziniere");
});

test("il titolare promuove il magazziniere a redattore @flusso:cambio-ruolo-titolare", async ({
  page,
}) => {
  expect(
    await ruoloDi(SEED.staffMagazziniere),
    "premessa mancata: il bersaglio non parte da magazziniere",
  ).toBe("magazziniere");

  await page.goto("/admin/personale");
  await expect(page.getByRole("heading", { name: "Personale", level: 1 })).toBeVisible();

  // I due moduli (recapiti e ruolo) sono ripetuti per ogni persona con etichette
  // identiche: senza restringere alla scheda giusta si cambierebbe il ruolo di
  // chi capita per primo nel documento, e il test resterebbe verde.
  const scheda = page.getByRole("article").filter({ hasText: "Marco Bellini" });
  await expect(scheda.getByRole("heading", { name: "Marco Bellini", level: 2 })).toBeVisible();

  // Il testo dell'opzione e' capitalizzato, il valore inviato e' minuscolo.
  await scheda.getByLabel("Ruolo").selectOption({ label: "Redattore" });
  await scheda.getByRole("button", { name: "Cambia ruolo" }).click();

  // Nessun componente client, quindi nessun messaggio di conferma: si attende la
  // condizione, cioe' il ri-render che `revalidatePath` innesca sulla tabella.
  await expect(page.getByRole("row").filter({ hasText: "Marco Bellini" })).toContainText(
    "redattore",
  );

  // Effetto sul database, ed e' anche la prova di QUALE strada ha scritto: il
  // `grant update` per colonna su `staff` concede solo `full_name`, `phone` e
  // `is_active`, mai `ruolo`. Nessuna update diretta del gestionale potrebbe
  // aver prodotto questo valore — l'unica strada consentita e' l'RPC
  // `cambia_ruolo`, `security definer`, che ricontrolla chi la chiama.
  await expect
    .poll(() => ruoloDi(SEED.staffMagazziniere), {
      message: "staff.ruolo non e' passato a redattore: la pagina ha detto di si', il database no",
    })
    .toBe("redattore");
});
