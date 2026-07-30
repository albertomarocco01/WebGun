import { chromium } from "@playwright/test";

import { admin } from "./db";

export type UtenteDiProva = {
  email: string;
  password: string;
  /** Dove finisce la sessione salvata; `null` per chi non deve averne una. */
  sessione: string | null;
};

/**
 * Gli attori della batteria.
 *
 * DEROGA DICHIARATA alla reference `playwright.md`, che prescrive di far creare
 * gli utenti di prova al global-setup con l'admin API e «MAI dal seed».
 * Qui gli utenti NON sono fixture: sono dati di dominio. Schema Forge lega ogni
 * riga di `staff` a un `auth_user_id` scritto a mano nel seed, quindi ricrearli
 * dal setup significherebbe o duplicarli o riscrivere righe che appartengono al
 * modello. Il setup percio' li VERIFICA e basta.
 *
 * La conseguenza e' voluta: se il seed produce utenti con cui non si riesce ad
 * accedere, la batteria deve accorgersene. Un setup che "riallinea" l'utente
 * con `updateUserById` ripara la premessa che dovrebbe misurare, e quel giorno
 * il flusso di accesso non puo' piu' fallire.
 */
export const UTENTI = {
  titolare: {
    email: "titolare@bottreganord.it",
    password: "password123",
    sessione: "e2e/.auth/titolare.json",
  },
  magazziniere: {
    email: "magazzino@bottreganord.it",
    password: "password123",
    sessione: "e2e/.auth/magazziniere.json",
  },
  redattore: {
    email: "redazione@bottreganord.it",
    password: "password123",
    sessione: "e2e/.auth/redattore.json",
  },
  cliente: {
    email: "anna.rossi@example.it",
    password: "password123",
    sessione: null,
  },
} satisfies Record<string, UtenteDiProva>;

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Verifica che l'utente esista davvero in `auth.users`, senza toccarlo.
 * Ritorna il messaggio del guasto, oppure `null` se e' tutto a posto.
 */
export async function verificaUtente(u: UtenteDiProva): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return `admin.listUsers: ${error.message}`;
  const trovato = data.users.some((utente) => utente.email === u.email);
  return trovato ? null : `nessun utente ${u.email} in auth.users`;
}

/**
 * Conia la sessione passando dalla UI vera: la stessa pagina, lo stesso form e
 * la stessa azione che usa una persona. Un `setSession` costruito con la chiave
 * amministrativa produrrebbe un cookie valido anche il giorno in cui la pagina
 * di accesso e' rotta.
 *
 * Non solleva: ritorna il messaggio del guasto. Un global-setup che esplode
 * spegne l'intera batteria e trasforma un flusso rotto in "nessun esito";
 * cosi' invece le spec che non dipendono dalla sessione girano lo stesso, e il
 * flusso di accesso ha la sua spec che diventa rossa da sola.
 */
export async function salvaSessione(u: UtenteDiProva): Promise<string | null> {
  if (!u.sessione) return null;
  const browser = await chromium.launch();
  try {
    // `use.baseURL` non esiste ancora qui: il global-setup gira prima.
    const contesto = await browser.newContext({ baseURL: BASE_URL });
    const pagina = await contesto.newPage();
    await pagina.goto("/accedi");
    await pagina.getByLabel("Email").fill(u.email);
    await pagina.getByLabel("Password").fill(u.password);
    await pagina.getByRole("button", { name: "Entra" }).click();

    // Si aspetta l'URL PRIMA dell'intestazione, e l'intestazione si chiede
    // `exact`. Senza queste due precauzioni il setup si dichiara autenticato
    // restando sulla pagina di accesso: `getByRole(..., { name: "Gestionale" })`
    // confronta per sottostringa e senza distinguere le maiuscole, e l'h1 di
    // `/accedi` e' «Accesso al gestionale» — combacia. L'attesa si risolveva
    // subito, `storageState` fotografava un contesto senza ancora il cookie di
    // sessione e scriveva un file VUOTO che sembrava buono.
    // Misurato il 2026-07-30: tre sessioni salvate da 36 byte e sei spec rosse
    // che accusavano l'app di non avere le sue intestazioni.
    await pagina.waitForURL(/\/admin\/?$/, { timeout: 15_000 });
    await pagina
      .getByRole("heading", { name: "Gestionale", exact: true, level: 1 })
      .waitFor({ state: "visible", timeout: 15_000 });

    const stato = await contesto.storageState({ path: u.sessione });
    if (stato.cookies.length === 0) {
      return `sessione vuota per ${u.email}: nessun cookie dopo l'accesso`;
    }
    return null;
  } catch (guasto) {
    return `accesso fallito per ${u.email}: ${(guasto as Error).message}`;
  } finally {
    await browser.close();
  }
}
