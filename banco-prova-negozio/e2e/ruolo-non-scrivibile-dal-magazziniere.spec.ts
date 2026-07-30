import { expect, test } from "@playwright/test";

import { UTENTI } from "./helpers/auth";
import {
  admin,
  clientComeUtente,
  forzaRuolo,
  ruoloDi,
  SEED,
  staffAttivo,
} from "./helpers/db";

// Nessuna sessione di browser: questo attacco non si fa cliccando, si forgia.
// La UI il bottone al magazziniere non glielo mostra nemmeno, quindi provare da
// li' dimostrerebbe solo che il bottone e' nascosto. Si dichiara comunque lo
// stato vuoto, cosi' la spec non eredita i diritti di qualcun altro.
test.use({ storageState: { cookies: [], origins: [] } });

test("il magazziniere non riscrive i ruoli, ne' direttamente ne' via RPC @flusso:ruolo-non-scrivibile-dal-magazziniere", async () => {
  // Il "prima" si legge dal database, non si assume: se il seed non e' quello
  // atteso, l'asserzione finale di invarianza sarebbe verde senza significare
  // niente.
  const ruoloPrima = await ruoloDi(SEED.staffMagazziniere);
  const attivoPrima = await staffAttivo(SEED.staffTitolare);
  expect(ruoloPrima, "premessa rotta: il magazziniere del seed non e' magazziniere").toBe(
    "magazziniere",
  );
  expect(attivoPrima, "premessa rotta: il titolare del seed non e' attivo").toBe(true);

  // Chiave PUBBLICA e credenziali vere: e' esattamente cio' che puo' fare
  // chiunque apra i DevTools. Con la chiave amministrativa si misurerebbe un
  // mondo in cui le policy non esistono.
  const magazziniere = await clientComeUtente(
    UTENTI.magazziniere.email,
    UTENTI.magazziniere.password,
  );

  // Attacco 1 — auto-promozione sulla propria riga. La policy autorizza la
  // riga intera; a fermarlo e' il `grant update` PER COLONNA, che comprende
  // solo `full_name` e `phone`: Postgres risponde
  // «permission denied for table staff», cioe' 42501.
  const autoPromozione = await magazziniere
    .from("staff")
    .update({ ruolo: "titolare" })
    .eq("id", SEED.staffMagazziniere);
  expect(
    autoPromozione.error?.code,
    `auto-promozione non respinta come attesa: ${JSON.stringify(autoPromozione.error)}`,
  ).toBe("42501");

  // Attacco 2 — disattivare il titolare per restare l'unico staff attivo.
  // Stessa porta chiusa: `is_active` non e' fra le colonne concesse.
  const disattivaTitolare = await magazziniere
    .from("staff")
    .update({ is_active: false })
    .eq("id", SEED.staffTitolare);
  expect(
    disattivaTitolare.error?.code,
    `disattivazione del titolare non respinta come attesa: ${JSON.stringify(disattivaTitolare.error)}`,
  ).toBe("42501");

  // Attacco 3 — la porta di servizio: l'RPC e' `security definer`, quindi
  // scavalca il grant per colonna. Deve difendersi da sola, controllando chi
  // chiama. Nomi dei parametri presi dalla migrazione
  // (`cambia_ruolo(persona uuid, nuovo text)`), non indovinati.
  const viaRpc = await magazziniere.rpc("cambia_ruolo", {
    persona: SEED.staffMagazziniere,
    nuovo: "titolare",
  });
  expect(
    viaRpc.error?.code,
    `l'RPC non ha respinto il chiamante: ${JSON.stringify(viaRpc.error)}`,
  ).toBe("P0001");
  expect(
    viaRpc.error?.message ?? "",
    "l'RPC ha fallito per un motivo diverso dal controllo di ruolo",
  ).toContain("solo il titolare cambia i ruoli");

  // Il codice d'errore lo decide l'API; il dato lo decide il database. Riletto
  // DOPO i tre attacchi, con gli helper amministrativi: e' l'asserzione che non
  // si puo' aggirare.
  expect(
    await ruoloDi(SEED.staffMagazziniere),
    "il magazziniere si e' promosso: il rifiuto e' arrivato dopo la scrittura",
  ).toBe("magazziniere");
  expect(
    await staffAttivo(SEED.staffTitolare),
    "il titolare e' stato disattivato: il rifiuto e' arrivato dopo la scrittura",
  ).toBe(true);
});

// Se uno dei tre attacchi fosse riuscito, il seed resterebbe sporco e il giro
// successivo misurerebbe un mondo gia' compromesso — verde per il motivo
// sbagliato. Il ripristino gira sempre: e' idempotente e non maschera niente,
// perche' le asserzioni sono gia' state valutate.
// `ruolo` torna con `forzaRuolo`; per `is_active` db.ts non espone un forza*,
// quindi si usa il client amministrativo che db.ts gia' esporta — nessun
// secondo posto in cui vive la chiave.
test.afterAll(async () => {
  await forzaRuolo(SEED.staffMagazziniere, "magazziniere");
  const { error } = await admin
    .from("staff")
    .update({ is_active: true })
    .eq("id", SEED.staffTitolare);
  if (error) throw new Error(`ripristino di is_active sul titolare fallito: ${error.message}`);
});
