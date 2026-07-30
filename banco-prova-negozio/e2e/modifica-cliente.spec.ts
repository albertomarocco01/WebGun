import { expect, test } from "@playwright/test";

import { SEED, clientePerId, forzaTelefonoCliente } from "./helpers/db";

/**
 * Flusso `modifica-cliente` — correggere il recapito di un cliente.
 *
 * Nasce il 2026-07-30 insieme alla vista che lo rende possibile: `aggiornaCliente`
 * esisteva gia' dal 2026-07-28 ma nessuna pagina la importava, cioe' era una POST
 * senza porta davanti. Flow Sentinel l'aveva segnalata come «azione orfana»
 * perche' una batteria non puo' attraversare cio' che l'interfaccia non offre.
 * Chiusa la porta mancante, il flusso diventa percorribile e quindi va coperto:
 * una scrittura su dati di persone senza spec e' esattamente il buco che questa
 * batteria esiste per non lasciare.
 *
 * Si sceglie **Pietro Gallo**, il cliente senza account: e' il caso che il
 * modello dichiara normale (ordina per telefono) ed e' anche quello in cui il
 * telefono e' l'unico modo di raggiungerlo, quindi sbagliarlo costa davvero.
 */
test.use({ storageState: "e2e/.auth/magazziniere.json" });

const NUOVO_TELEFONO = "333 9998877";

test("il magazziniere corregge il telefono di un cliente e il database lo registra @flusso:modifica-cliente", async ({
  page,
}) => {
  const prima = await clientePerId(SEED.clienteSenzaAccount);
  expect(
    prima,
    "il cliente senza account non c'e': la premessa del flusso e' saltata, non il flusso",
  ).not.toBeNull();
  expect(
    prima!.phone,
    `il telefono e' gia' «${NUOVO_TELEFONO}»: un giro precedente non ha ripristinato, e questa spec non potrebbe distinguere il successo dal nulla`,
  ).not.toBe(NUOVO_TELEFONO);

  await page.goto("/admin/clienti");

  // Il modulo giusto fra tanti: gli `id` dei campi portano il suffisso della
  // riga, che e' anche l'unica cosa che distingue due moduli identici.
  const campo = page.locator(`#phone-${SEED.clienteSenzaAccount}`);
  await expect(
    campo,
    "nessun modulo per riga in /admin/clienti: la vista dell'azione `aggiornaCliente` e' sparita di nuovo",
  ).toBeVisible();

  await campo.fill(NUOVO_TELEFONO);
  await page
    .locator(`form:has(#phone-${SEED.clienteSenzaAccount})`)
    .getByRole("button", { name: "Salva i recapiti" })
    .click();

  // EFFETTO SUL DATABASE, ed e' il punto. Il campo compilato a schermo si vede
  // anche quando l'azione non ha scritto niente: `defaultValue` viene dal
  // server solo al primo rendering, e dopo il submit il valore mostrato e'
  // quello che ha digitato il browser. Solo la riga vera distingue le due cose.
  await expect
    .poll(async () => (await clientePerId(SEED.clienteSenzaAccount))?.phone, {
      message:
        "il telefono non e' arrivato al database: la pagina puo' sembrare giusta lo stesso, perche' il valore a schermo l'ha scritto il browser",
    })
    .toBe(NUOVO_TELEFONO);

  // Il nome NON doveva cambiare: un modulo che riscrive tutta la riga fa danni
  // silenziosi quando due persone salvano di seguito.
  const dopo = await clientePerId(SEED.clienteSenzaAccount);
  expect(
    dopo!.full_name,
    "il nome del cliente e' cambiato salvando il telefono",
  ).toBe(prima!.full_name);
});

test.afterAll(async () => {
  await forzaTelefonoCliente(SEED.clienteSenzaAccount, "333 1110002");
});
