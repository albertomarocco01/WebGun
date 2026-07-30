import { UTENTI, salvaSessione, verificaUtente } from "./helpers/auth";

/**
 * Prepara le sessioni prima della batteria.
 *
 * NON ripara niente: verifica che gli utenti del seed esistano e prova ad
 * accedere dalla UI vera. Ogni guasto viene stampato e la batteria parte lo
 * stesso — le spec che dipendono da una sessione mancante falliranno da sole,
 * con il nome del flusso addosso, invece di sparire dietro un setup esploso.
 */
export default async function globalSetup(): Promise<void> {
  const guasti: string[] = [];

  for (const [nome, utente] of Object.entries(UTENTI)) {
    const assente = await verificaUtente(utente);
    if (assente) {
      guasti.push(`${nome}: ${assente}`);
      continue;
    }
    const fallito = await salvaSessione(utente);
    if (fallito) guasti.push(`${nome}: ${fallito}`);
  }

  if (guasti.length > 0) {
    console.error(
      "\n[global-setup] premesse NON soddisfatte — le spec che ne dipendono falliranno:\n" +
        guasti.map((g) => `  - ${g}`).join("\n") +
        "\n",
    );
  }
}
