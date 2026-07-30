import { expect, test } from "@playwright/test";

/**
 * Flusso `admin-negato-anon` — ostile in lettura.
 *
 * Un visitatore senza sessione non deve ricevere niente del gestionale: ne'
 * l'intestazione del cruscotto, ne' i dati di clienti e personale che le sue
 * sezioni mostrano.
 *
 * Nessun ripristino e nessuna asserzione di effetto sul database: un attacco in
 * LETTURA non scrive niente, quindi non c'e' stato da confrontare prima e dopo
 * — e la spec e' rilanciabile all'infinito senza `supabase db reset`.
 */

// Nessuna sessione: e' esattamente il ruolo dell'attaccante. Senza questa riga
// la spec potrebbe ereditare uno storageState e misurare un altro mondo.
test.use({ storageState: { cookies: [], origins: [] } });

// Le tre rotte del contratto: il cruscotto e le due sezioni che servono dati di
// persone vere (clienti e personale).
const ROTTE = ["/admin", "/admin/clienti", "/admin/personale"] as const;

// Frammenti riservati presi dal seed: l'intestazione del cruscotto, i due
// clienti, una persona dello staff e un recapito. Se anche uno solo compare nel
// corpo servito, il dato ha gia' lasciato il server.
const RISERVATI = [
  "Gestionale",
  "Anna Rossi",
  "Pietro Gallo",
  "Giulia Ferrero",
  "0161 000001",
] as const;

// Sottoinsieme controllabile anche nel DOM. «Gestionale» resta fuori di
// proposito: `getByText` fa un confronto per sottostringa e senza distinguere
// maiuscole, e l'h1 di `/accedi` e' «Accesso al gestionale» — cercarlo qui
// darebbe un rosso che parla della pagina lecita, non di una fuga.
const RISERVATI_NEL_DOM = ["Anna Rossi", "Pietro Gallo", "Giulia Ferrero", "0161 000001"] as const;

for (const rotta of ROTTE) {
  test(`un anonimo non riceve ${rotta} @flusso:admin-negato-anon`, async ({ page }) => {
    const risposta = await page.goto(rotta);
    expect(risposta, `nessuna risposta di navigazione per ${rotta}`).not.toBeNull();

    // Il corpo si legge SUBITO e si asserisce su quello, non sul DOM: se il
    // rifiuto lo decidesse il client (un redirect dentro un componente, una
    // guardia lato browser), il server avrebbe gia' consegnato l'HTML riservato
    // e il browser lo avrebbe poi sostituito con la pagina lecita — a quel
    // punto ogni `getByText` troverebbe la pagina pulita e la spec sarebbe
    // verde su una fuga gia' avvenuta. Misurato il 2026-07-28 sul banco
    // palestra: col controllo spostato nel client la batteria restava verde
    // 6 su 6 e il gate chiudeva VERDE. `risposta.text()` e' l'unica cosa che un
    // redirect deciso dal browser non puo' riscrivere.
    const corpo = await risposta!.text();

    await expect(page).toHaveURL(/\/accedi/);

    for (const riservato of RISERVATI) {
      expect(corpo, `«${riservato}» servito da ${rotta} a un anonimo`).not.toContain(riservato);
    }

    // Il DOM si guarda comunque, per il caso opposto a quello di sopra:
    // contenuto riservato caricato dopo la pagina, che nel corpo non c'e'.
    for (const riservato of RISERVATI_NEL_DOM) {
      await expect(
        page.getByText(riservato),
        `«${riservato}» comparso nella pagina dopo il caricamento di ${rotta}`,
      ).toHaveCount(0);
    }
  });
}
