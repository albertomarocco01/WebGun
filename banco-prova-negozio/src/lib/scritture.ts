/**
 * L'`id` della riga da scrivere arriva sempre da un campo nascosto, cioe' dal
 * client. Un `update ... .eq("id", x)` con un `x` inesistente — o con un `x` che
 * la RLS non lascia raggiungere — non e' un errore per Postgres: tocca **zero
 * righe** e ritorna successo. Il modulo si ricarica, la pagina non cambia, e
 * nessuno sa che non e' successo niente.
 *
 * `avanzaOrdine` era l'unica delle otto scritture che controllava; le altre sei
 * si fidavano. Il controllo si ottiene chiedendo `.select("id")` dopo la
 * scrittura e contando cosa e' tornato.
 *
 * NOTA sul falso allarme: `.select()` dopo un `update` ritorna le righe che la
 * policy di **lettura** lascia vedere. Se un giorno un ruolo potesse scrivere
 * una riga che non puo' rileggere, qui arriverebbe zero e questa funzione
 * direbbe «non trovata» a una scrittura riuscita. Sul modello di accesso di
 * Bottega Nord non succede — lo staff legge tutto cio' che scrive — ma il
 * giorno in cui le sedi fossero due andrebbe riletto.
 */
export function esigiRigaToccata(
  righe: readonly unknown[] | null,
  messaggio: string,
): void {
  if ((righe ?? []).length === 0) {
    throw new Error(messaggio);
  }
}
