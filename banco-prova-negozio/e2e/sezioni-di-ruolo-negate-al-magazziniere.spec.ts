import { expect, test } from "@playwright/test";

import { SEED, ruoloDi } from "./helpers/db";

// La sessione vera del magazziniere, coniata dal global-setup passando dal form
// di /accedi. Un cookie costruito a mano proverebbe la RLS, non la guardia.
test.use({ storageState: "e2e/.auth/magazziniere.json" });

/** Il cruscotto, col `?motivo=...` che nessuno legge. Nessun segmento dopo `/admin`. */
const CRUSCOTTO = /\/admin(\?[^/]*)?$/;

/**
 * Le impronte sono stringhe che SOLO la sezione negata sa produrre.
 *
 * Attenzione alla parola «Personale» da sola: e' anche l'etichetta di una voce
 * del menu, quindi sta nel corpo di OGNI pagina sotto `/admin` — cruscotto
 * lecito compreso (vedi il secondo test). Cercarla nuda nel corpo servito
 * renderebbe rosso un rifiuto perfettamente riuscito, che e' il modo piu'
 * rapido per far disattivare la batteria. Nel corpo si cerca percio' il testo
 * che il menu non puo' fabbricare (la didascalia della tabella, i dati del
 * personale), e la parola nuda si asserisce sotto, come intestazione di primo
 * livello: e' li' che «Personale sezione» e «Personale voce di menu» si
 * distinguono davvero.
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

test("il menu promette al magazziniere le due sezioni che gli nega @flusso:sezioni-di-ruolo-negate-al-magazziniere", async ({
  page,
}) => {
  await page.goto("/admin");

  const menu = page.getByRole("navigation", { name: "Sezioni del gestionale" });
  // Senza questa riga il test passerebbe anche con la sessione di un titolare,
  // per cui quei due link sono legittimi.
  await expect(menu.getByText("Marco Bellini · magazziniere")).toBeVisible();

  // DIFETTO NOTO, fissato qui come comportamento corrente e non come desiderio:
  // il menu e' una lista fissa, non filtrata per ruolo, quindi offre al
  // magazziniere due porte che la guardia gli chiude in faccia — e `/admin` non
  // legge `searchParams`, percio' del `?motivo=ruolo-insufficiente` non resta
  // nulla a schermo: nessun messaggio spiega il rifiuto, e non se ne asserisce
  // nessuno. Vedi `docs/handoff/12-flow-sentinel.md` §Problemi noti (il menu
  // arriva da `src/app/admin/layout.tsx`, handoff 10-gestionale-crafter).
  // Il giorno in cui il menu verra' filtrato, questo test diventa rosso: e' il
  // segnale che il difetto e' stato chiuso e che la spec va aggiornata.
  await expect(
    menu.getByRole("link", { name: "Contenuti", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("link", { name: "Personale", exact: true }),
  ).toBeVisible();
});
