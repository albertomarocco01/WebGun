import { expect, test } from "@playwright/test";

import { UTENTI } from "./helpers/auth";

// Sessione vuota: qui il login lo fa la spec. Con la sessione ereditata dal
// global-setup si arriverebbe su /accedi gia' autenticati come staff, e
// l'attacco proverebbe il contrario di quel che deve provare.
test.use({ storageState: { cookies: [], origins: [] } });

test("un account valido ma non staff non entra nel gestionale @flusso:cliente-non-e-staff", async ({
  page,
}) => {
  await page.goto("/accedi");
  await page.getByLabel("Email").fill(UTENTI.cliente.email);
  await page.getByLabel("Password").fill(UTENTI.cliente.password);
  await page.getByRole("button", { name: "Entra" }).click();

  // `motivo=non-autorizzato` e NON `motivo=credenziali`: la password l'ha
  // accettata il server di Auth, e a fermare Anna Rossi e' `richiediStaff`, che
  // legge la tabella `staff` dove lei non ha nessuna riga. Un account valido
  // non e' un account autorizzato, e i due rifiuti si distinguono solo da qui:
  // e' la ragione per cui l'URL si asserisce per intero e non con un `/accedi/`.
  await expect(page).toHaveURL(/\/accedi\?motivo=non-autorizzato$/);
  await expect(page.getByRole("status")).toHaveText(
    "Questo account non appartiene al personale del negozio.",
  );

  // L'attacco vero: adesso la sessione esiste davvero, e /admin lo si chiede
  // con quella addosso. La risposta si tiene in una variabile perche' serve il
  // corpo, non solo la pagina risultante.
  const risposta = await page.goto("/admin");
  expect(risposta, "nessuna risposta di navigazione per /admin").not.toBeNull();
  await expect(page).toHaveURL(/\/accedi\?motivo=non-autorizzato$/);

  // L'asserzione che conta: il CORPO SERVITO dal server. Se il rifiuto lo
  // decidesse il client, l'HTML riservato sarebbe gia' stato consegnato e ogni
  // getByText lo troverebbe pulito dopo la sostituzione.
  const corpo = await risposta!.text();
  // "Gestionale" con la maiuscola e' l'intestazione di /admin; /accedi dice
  // "Accesso al gestionale", minuscolo. Il confronto e' sensibile al caso: la
  // maiuscola qui non e' un dettaglio da uniformare.
  expect(
    corpo,
    "il cruscotto e' stato servito a un account che non e' del personale",
  ).not.toContain("Gestionale");
  expect(
    corpo,
    "il nome di una persona del personale e' finito nel corpo servito",
  ).not.toContain("Giulia Ferrero");

  // Il DOM si guarda comunque, per il caso opposto: contenuto riservato
  // iniettato dopo il caricamento. `exact` e' obbligatorio, o "Accesso al
  // gestionale" verrebbe preso come sottostringa e questa riga sarebbe rossa
  // senza che sia successo niente.
  await expect(
    page.getByRole("heading", { name: "Gestionale", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Giulia Ferrero")).toHaveCount(0);

  // Nessun ripristino: il flusso e' di sola lettura e non tocca il seed, quindi
  // la spec si rilancia sullo stesso database senza `supabase db reset`.
});
