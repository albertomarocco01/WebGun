import { redirect } from "next/navigation";

/**
 * NOTA DI BANCO — questa rotta esiste solo per rimandare altrove.
 *
 * E' il caso descritto in `agenti/speed-demon/references/misurazione.md` §256:
 * «si dichiara `/prodotti`, l'app fa un redirect verso la pagina di accesso,
 * Lighthouse segue e misura la destinazione». La difesa scritta li' e'
 * confrontare `requestedUrl` con `finalDisplayedUrl`.
 *
 * Questa pagina serve a misurare se quella difesa esiste davvero nel gate,
 * oppure solo nella prosa che la prescrive.
 */
export default function Riservata() {
  redirect("/contatti");
}
