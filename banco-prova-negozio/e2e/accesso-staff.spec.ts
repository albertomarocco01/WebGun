import { expect, test } from "@playwright/test";

import { UTENTI, salvaSessione } from "./helpers/auth";
import { ultimoAccesso } from "./helpers/db";

/**
 * Flusso `accesso-staff` — la premessa di tutti gli altri flussi autenticati.
 *
 * Nessuna sessione ereditata: qui il login lo si fa dalla UI vera, campo per
 * campo. Con lo `storageState` del global-setup addosso, `/accedi` rimanderebbe
 * via prima ancora del primo `fill`, e un file di sessione su disco resta
 * valido anche il giorno in cui la pagina di accesso e' rotta — cioe' proprio
 * il guasto che questa spec deve vedere.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("il titolare entra dalla pagina di accesso e il server di Auth lo registra @flusso:accesso-staff", async ({
  page,
}) => {
  // L'istante di partenza si legge dal DATABASE e non da `Date.now()` del
  // runner: cosi' il confronto non dipende dallo scarto fra l'orologio del
  // processo e quello di Postgres, che e' esattamente il genere di scarto che
  // produce un flaky. `null` (nessun accesso registrato) vale 0.
  const prima = (await ultimoAccesso(UTENTI.titolare.email)) ?? 0;

  await page.goto("/accedi");
  await expect(
    page.getByRole("heading", { name: "Accesso al gestionale", level: 1 }),
  ).toBeVisible();

  await page.getByLabel("Email").fill(UTENTI.titolare.email);
  await page.getByLabel("Password").fill(UTENTI.titolare.password);
  await page.getByRole("button", { name: "Entra" }).click();

  // Si attende una condizione, non un ritardo: il cruscotto dipinto. Il
  // progetto non ha componenti client, quindi dopo il submit non c'e' nessun
  // messaggio di conferma da aspettare — c'e' il ri-render della pagina.
  await expect(
    page.getByRole("heading", { name: "Gestionale", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);

  // Il nome della persona in sessione convive col ruolo dentro il menu: si
  // restringe al contenitore semantico invece di cercarlo in tutta la pagina.
  const menu = page.getByRole("navigation", { name: "Sezioni del gestionale" });
  await expect(menu.getByText("Giulia Ferrero")).toBeVisible();

  // EFFETTO SUL DATABASE, ed e' il punto del flusso. `auth.users.last_sign_in_at`
  // lo scrive il server di Auth nell'istante in cui verifica davvero la
  // password ed emette il token: il browser non lo puo' toccare, e nessuna
  // sessione fabbricata lato client lo fa avanzare. Fermarsi a «sono su /admin»
  // passerebbe anche con un cookie scritto a mano o con una guardia che ne
  // controlla l'esistenza senza validarlo.
  // `expect.poll` e non una lettura secca perche' la scrittura e' del server e
  // la pagina puo' essere gia' dipinta quando l'asserzione gira.
  await expect
    .poll(async () => (await ultimoAccesso(UTENTI.titolare.email)) ?? 0, {
      message:
        "last_sign_in_at non e' avanzato: nessuna credenziale verificata dal server di Auth, la sessione e' solo lato client",
    })
    .toBeGreaterThan(prima);
});

test("dopo l'uscita il gestionale torna a essere negato @flusso:accesso-staff", async ({
  page,
}) => {
  await page.goto("/accedi");
  await page.getByLabel("Email").fill(UTENTI.titolare.email);
  await page.getByLabel("Password").fill(UTENTI.titolare.password);
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(
    page.getByRole("heading", { name: "Gestionale", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(
    page.getByRole("heading", { name: "Accesso al gestionale", level: 1 }),
  ).toBeVisible();

  // Il rifiuto si misura sul CORPO SERVITO, non sul DOM: se la guardia si
  // spostasse dal server al browser, l'HTML del gestionale sarebbe gia' stato
  // consegnato e un `getByText` lo troverebbe pulito soltanto perche' il client
  // l'ha rimpiazzato dopo. Per questo il `goto` si tiene in una variabile.
  const risposta = await page.goto("/admin");
  await expect(page).toHaveURL(/\/accedi/);

  expect(risposta, "nessuna risposta di navigazione da /admin").not.toBeNull();
  const corpo = (await risposta?.text()) ?? "";
  expect(
    corpo,
    "il gestionale e' stato servito a una sessione chiusa",
  ).not.toContain("Gestionale");
  expect(
    corpo,
    "il nome del personale e' nel corpo servito dopo l'uscita",
  ).not.toContain("Giulia Ferrero");
});

/**
 * Ripristino: questa spec sporca uno stato condiviso, e va rimesso a posto o la
 * batteria non e' rilanciabile.
 *
 * `esci` chiama `supabase.auth.signOut()` con lo scope predefinito `global`,
 * che revoca TUTTE le sessioni del titolare — compresa quella che il
 * global-setup ha salvato in `e2e/.auth/titolare.json` e che serve alle spec
 * successive. Si riconia qui con lo stesso helper del setup, cosi' un rosso piu'
 * avanti parla dell'app e non di questa uscita.
 */
test.afterAll(async () => {
  const guasto = await salvaSessione(UTENTI.titolare);
  expect(
    guasto,
    "sessione del titolare non riconiata dopo l'uscita: le spec seguenti partirebbero senza credenziali",
  ).toBeNull();
});
