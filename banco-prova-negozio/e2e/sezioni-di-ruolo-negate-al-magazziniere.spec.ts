import { expect, test } from "@playwright/test";

import { SEED, ruoloDi } from "./helpers/db";

// La sessione vera del magazziniere, coniata dal global-setup passando dal form
// di /accedi. Un cookie costruito a mano proverebbe la RLS, non la guardia.
test.use({ storageState: "e2e/.auth/magazziniere.json" });

/** Il cruscotto, con o senza il `?motivo=...`. Nessun segmento dopo `/admin`. */
const CRUSCOTTO = /\/admin(\?[^/]*)?$/;

/**
 * Le impronte sono stringhe che SOLO la sezione negata sa produrre.
 *
 * La parola «Personale» da sola non basta: dal 2026-07-30 il menu e' filtrato
 * per ruolo e al magazziniere quella voce non compare piu', ma la cautela resta
 * scritta perche' la stessa impronta con la sessione di un titolare tornerebbe
 * ambigua. Nel corpo si cerca percio' il testo che un menu non puo' fabbricare
 * (la didascalia della tabella, i dati del personale), e la parola nuda si
 * asserisce sotto come intestazione di primo livello.
 */
const SEZIONI_NEGATE = [
  {
    percorso: "/admin/contenuti",
    titolo: "Contenuti del sito",
    impronte: ["Contenuti del sito", "home-hero", "Immagine (URL)"],
  },
  {
    percorso: "/admin/personale",
    titolo: "Personale",
    impronte: [
      "Personale del negozio",
      "Sara Conti",
      "0161 000001",
      "Cambia ruolo",
    ],
  },
] as const;

/** Quello che il magazziniere deve poter aprire, e quello che non deve vedere. */
const VOCI_ATTESE = ["Prodotti", "Categorie", "Ordini", "Clienti"] as const;
const VOCI_NEGATE = ["Contenuti", "Personale"] as const;

test.beforeAll(async () => {
  // Premessa, non cortesia: `cambio-ruolo-titolare` promuove e ripristina questa
  // stessa riga. Se un giro precedente l'avesse lasciata a `redattore`, i
  // contenuti si aprirebbero e la spec racconterebbe una fuga che non c'e'.
  expect(
    await ruoloDi(SEED.staffMagazziniere),
    "il magazziniere non e' piu' `magazziniere`: la premessa del flusso e' saltata, il rosso qui sotto non parlerebbe della guardia",
  ).toBe("magazziniere");
});

// La spec non scrive niente: nessuno stato da ripristinare, e' rilanciabile a
// ciclo continuo senza `supabase db reset`.

test("le sezioni di altri ruoli non vengono servite al magazziniere @flusso:sezioni-di-ruolo-negate-al-magazziniere", async ({
  page,
}) => {
  for (const sezione of SEZIONI_NEGATE) {
    const risposta = await page.goto(sezione.percorso);
    expect(
      risposta,
      `nessuna risposta di navigazione per ${sezione.percorso}: l'attacco non e' nemmeno partito`,
    ).not.toBeNull();

    await expect(page).toHaveURL(CRUSCOTTO);

    // La riga che conta: il corpo SERVITO dal server, non il DOM. Se il
    // controllo di ruolo fosse deciso nel browser, l'HTML riservato sarebbe
    // gia' stato consegnato e ogni getByText lo troverebbe pulito.
    const corpo = await risposta!.text();
    for (const impronta of sezione.impronte) {
      expect(
        corpo,
        `${sezione.percorso}: contenuto riservato servito al magazziniere («${impronta}»)`,
      ).not.toContain(impronta);
    }

    // Il DOM si guarda comunque, per il caso opposto: contenuto iniettato dopo
    // il caricamento, che nel corpo servito non poteva esserci.
    await expect(
      page.getByRole("heading", { name: "Gestionale", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: sezione.titolo, level: 1, exact: true }),
    ).toHaveCount(0);
  }
});

/**
 * Il difetto che questo test fissava e' stato CHIUSO il 2026-07-30, ed e' andata
 * esattamente come la versione precedente aveva previsto per iscritto: «il
 * giorno in cui il menu verra' filtrato, questo test diventa rosso: e' il
 * segnale che il difetto e' stato chiuso e che la spec va aggiornata».
 *
 * Prima il menu era una lista fissa e offriva al magazziniere due porte che la
 * guardia gli chiudeva in faccia, con `/admin` che nemmeno leggeva il
 * `?motivo=ruolo-insufficiente`: il rifiuto era muto. Ora menu e guardia leggono
 * la stessa `SEZIONI` (`src/modules/admin/guardia.ts`) e il cruscotto scrive
 * perche' ha detto di no.
 *
 * Le due meta' vanno asserite insieme: il link sparito NON e' la difesa — la
 * rotta si raggiunge scrivendola — quindi il test finisce provando che, tolta
 * la voce, il rifiuto vero e' ancora al suo posto.
 */
test("il menu offre al magazziniere solo cio' che puo' aprire, e il rifiuto e' scritto @flusso:sezioni-di-ruolo-negate-al-magazziniere", async ({
  page,
}) => {
  await page.goto("/admin");

  const menu = page.getByRole("navigation", { name: "Sezioni del gestionale" });
  // Senza questa riga il test passerebbe anche con la sessione di un titolare,
  // per cui quei due link sono legittimi.
  await expect(menu.getByText("Marco Bellini · magazziniere")).toBeVisible();

  for (const voce of VOCI_ATTESE) {
    await expect(
      menu.getByRole("link", { name: voce, exact: true }),
      `«${voce}» manca dal menu: il filtro per ruolo ha tolto anche cio' che il magazziniere puo' aprire`,
    ).toBeVisible();
  }

  for (const voce of VOCI_NEGATE) {
    await expect(
      menu.getByRole("link", { name: voce, exact: true }),
      `il menu offre ancora «${voce}» al magazziniere, che la guardia gli nega`,
    ).toHaveCount(0);
  }

  // Tolta la voce, resta la porta. Si bussa scrivendo l'indirizzo.
  await page.goto("/admin/personale");
  await expect(page).toHaveURL(/\/admin\?motivo=ruolo-insufficiente$/);
  await expect(
    page.getByRole("status"),
    "il rifiuto e' tornato muto: `/admin` non racconta il `?motivo=` che la guardia gli ha scritto nell'URL",
  ).toContainText("non e' aperta al tuo ruolo");
});
