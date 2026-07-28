# Handoff — Schema Forge

Progetto: **VetCare Nord** — portale di tre cliniche veterinarie.

## 1. Cosa ho fatto

- Migrazioni:
  - `20260726120000_fondamenta.sql` — sedi, personale, clienti, animali
  - `20260726120100_prestazioni.sql` — prestazioni e listini
  - `20260726120200_clinico.sql` — visite e cartella clinica
  - `20260726120300_amministrazione.sql` — fatturazione
- Tabelle create: `species`, `clinics`, `staff`, `owners`, `owner_staff_flags`,
  `animals`, `services`, `price_lists`, `price_list_items`, `visits`,
  `medical_records`, `medical_record_revisions`, `diagnoses`, `treatments`,
  `prescriptions`, `internal_notes`, `vaccinations`, `invoices`,
  `invoice_lines`. Una vista: `v_cartella_animale` (`security_invoker = on`).
- Tipi generati in: `src/lib/database.types.ts`
- Diagramma: `docs/schema/ERD.md` (rigenerabile con `scripts/erd.mjs`)
- Test delle policy: `supabase/tests/rls_policy.test.sql` (12 asserzioni) e
  `supabase/tests/rls_negativi.test.sql` (23 asserzioni, di cui **2 rosse**)

## 2. Modello assunto (Specchio del dominio)

Tre sedi di una sola società. Ogni membro dello staff appartiene a **una** sede;
il **direttore** è staff con ambito **tutte e tre** — le due condizioni stanno
dentro una sola funzione (`puo_vedere_clinica`), non in due policy: due policy
permissive si sommerebbero in OR e il veterinario di sede vedrebbe tutto.

Un **cliente** (`owners`) esiste anche **senza account** sul portale:
`auth_user_id` è facoltativo. Non è un `profiles` che estende `auth.users`: metà
della clientela telefona e non si registrerà mai.

Ogni animale ha **un** proprietario. Ogni visita produce **una** cartella
clinica. La cartella contiene diagnosi, trattamenti e prescrizioni, più una nota
leggibile dal proprietario (`medical_records.owner_note`). Le note **interne**
stanno in un'altra tabella (`internal_notes`), come il contrassegno «cliente
difficile» (`owner_staff_flags`): la RLS filtra righe, non colonne.

Due macchine a stati **indipendenti**: la visita
(`prenotata → confermata → eseguita → fatturata`, più `annullata`) e l'incasso
(`invoices.status`: `emessa → pagata → scaduta`, più `annullata`). Gli
allevamenti convenzionati ricevono una fattura mensile: la prestazione è erogata
prima del pagamento, quindi unire le due macchine costringerebbe a mentire.

Confermato da: **UMANO** (committente recitato dall'auditor del collaudo) il
2026-07-26.

## 3. Modello di accesso (chi vede cosa)

| Tabella | anon | authenticated (cliente) | staff |
|---|---|---|---|
| `species` | lettura | lettura | tutto |
| `clinics` | lettura se `is_active` | idem | tutto |
| `services` | lettura se `is_active` | idem | tutto |
| `staff` | — | lettura se `is_active` | tutto (di competenza) |
| `owners` | — | **solo sé stesso** (lettura + recapiti) | tutto |
| `owner_staff_flags` | — | **nessun accesso** | tutto |
| `animals` | — | solo i propri | tutto |
| `price_lists` / `price_list_items` | — | il pubblico + **solo il proprio** | tutto |
| `visits` | — | lettura dei propri, `insert` propri, **nessun `update`** | di competenza |
| `medical_records` | — | sola lettura dei propri | scrittura, di competenza |
| `diagnoses` / `treatments` / `prescriptions` | — | sola lettura | scrittura, di competenza |
| `medical_record_revisions` | — | **nessun accesso** | lettura, di competenza |
| `internal_notes` | — | **nessun accesso** | tutto, di competenza |
| `vaccinations` | — | sola lettura dei propri | tutto |
| `invoices` / `invoice_lines` | — | sola lettura delle proprie | tutto |

Policy `using (true)` presenti e perché sono legittime: **una sola** —
`species` («specie visibili a tutti»). È una tabella di codici (cane, gatto,
coniglio): non contiene dati di nessuno. L'audit la segnala come `issue`; resta
per scelta, documentata qui.

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| `owners` con `auth_user_id` **facoltativo** | `profiles.id = auth.users.id` (pattern-ecommerce.md §Clienti) | metà dei clienti non ha e non avrà un account: con la chiave sull'identità non si possono registrare |
| Nota interna e contrassegno «cliente difficile» in **tabelle separate** | colonne su `medical_records` / `owners` con filtro nel frontend | la RLS filtra righe, non colonne: PostgREST lascia scegliere le colonne al client (`rls-supabase.md` §La RLS è per riga) |
| Spostamento visita tramite `public.sposta_visita()` | policy di `update` per il proprietario | `with check` vede la riga, non il campo: con una policy di update il cliente potrebbe cambiarsi `status` e `service_id` |
| `exclude using gist` su `(staff_id, tstzrange)` | `unique (staff_id, scheduled_at)` | gli orari si **sovrappongono**, non coincidono: un `unique` non impedisce la doppia prenotazione |
| Finestra di 24 ore in un **trigger** | `check (scheduled_at - now() > interval '24 hours')` | `now()` non è immutabile: Postgres rifiuta il `check` |
| `medical_record_revisions` scritta da trigger | `update` diretto sulla cartella | la cartella clinica è un documento legale: «correggere per sempre» senza traccia = cancellare per sempre |
| Listini in tabella (`price_lists` + `price_list_items`) | colonna `price_allevamento_cents` su `services` | il prezzo negoziato in una colonna leggibile è pubblico; e il terzo contratto dev'essere un `insert`, non una migrazione |
| Stato incasso separato dallo stato visita | `paid` dentro la catena della visita | fatturazione mensile agli allevamenti: la merce parte prima dell'incasso |
| Nessun `total_cents` su `invoices` | contatore denormalizzato mantenuto da trigger | `modellazione.md` §Normalizzazione: l'aggregato si aggiunge **dopo** aver visto la query lenta |
| Tutti gli interi in `bigint` (`duration_days`, `quantity`) | `integer`/`smallint` sulle 500 unità dichiarate dal cliente | «mai più di 500 animali» è una previsione commerciale, non un limite strutturale (`modellazione.md` §Regola della casa) |
| Anagrafica (clienti, animali) visibile a **tutto** lo staff; dati **clinici** ristretti alla sede | scoping per sede anche sull'anagrafica | un animale curato a Novara deve avere la scheda apribile a Biella. **Assunzione risolta senza chiedere**: da confermare col committente |

## 5. Cosa si aspetta chi viene dopo

- **Fly UI**: `src/lib/database.types.ts` è la fonte dei tipi. Le liste del
  portale cliente si costruiscono su `animals`, `visits`, `v_cartella_animale`,
  `invoices`. La vista è il punto d'aggancio dell'**export GDPR**: contiene solo
  ciò che il proprietario può vedere.
- **Gestionale Crafter**: CRUD su `owners`, `animals`, `visits`,
  `medical_records` (+ figlie), `services`, `price_lists`, `invoices`. Il
  contrassegno interno sta in `owner_staff_flags`, **non** su `owners`.
- Operazioni che **non** vanno fatte dal client:
  - spostare una visita → `public.sposta_visita(visita, inizio, fine)`
  - cambiare lo stato di una visita → `update` riservato allo staff, con
    trigger sulle transizioni ammesse
  - modificare una riga di fattura → il trigger la blocca appena la fattura non
    è più `emessa`
  - qualunque scrittura su `medical_record_revisions`: ci scrive solo il trigger

## 6. Residui di `verify` e problemi noti

**Gate: ROSSO** (2 falliti, 0 verifiche mancanti su 9 passi) — rilancio del 2026-07-28.

> Questo schema **non è consegnabile**, ed è tracciato apposta in quello stato: è
> il caso di prova di uno schema difettoso per le regole del blocco n°1
> (`DECISIONI.md` §20). Chi legge questo handoff cercando uno schema da cui
> partire ha sbagliato file.
>
> Il 26 luglio lo stesso schema, con lo stesso seed, chiudeva **VERDE 8/8**
> mentre `/code-inquisition` ci riproduceva 16 difetti su 17 con comandi reali.
> Le due righe rosse qui sotto sono due di quei difetti, trovati da due strade
> indipendenti — le regole del catalogo e i test pgTAP negativi — che concordano
> senza sapersi.

### I due passi rossi

| Passo | Gravità | Cosa |
|---|---|---|
| `audit-rls` | **block** | `public.staff.job_title`: colonna che decide gli accessi, scrivibile dal proprietario della riga. Un veterinario fa `update public.staff set job_title = 'direttore'` sulla **propria** riga e passa da 2 visite / 0 note interne a 6 / 1, perché `puo_vedere_clinica()` decide in base a quella colonna |
| `audit-rls` | issue | `public.visits.status`: macchina a stati vincolata solo in `update`. `insert … values (…, 'fatturata')` passa: il trigger di transizione non scatta su `insert`, e il `check` enumera il dominio invece di vietare gli stati d'arrivo |
| `pgtap` | **fail** | asserzioni 22 e 23 su 23: «il veterinario non si promuove a direttore sulla propria riga» e «una visita non nasce già fatturata» |

**Le tre migrazioni che porterebbero il banco a verde** — non scritte, perché sono lavoro sul banco e il banco serve rosso: `grant update` per colonna su `staff` (togliendo `job_title`), vincolo sullo stato iniziale di `visits`, `revoke execute … from public, anon` sulle undici funzioni `security definer`.

### Residui che restano anche a gate verde

| Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| issue | `public.species → "specie visibili a tutti"`: `using (true)` | tabella di codici, nessun dato personale | nessuno: è una scelta |
| issue | undici funzioni `security definer` eseguibili da `PUBLIC` | è il **default** di Postgres, mai revocato | vedi le tre migrazioni sopra |
| warn | `public.v_cartella_animale` non ha RLS propria | è una vista: la RLS è quella delle tabelle sotto, con `security_invoker = on` | — |
| debito | i promemoria vaccinali non esistono più nello schema: `reminders` è stata droppata dall'`evolve` del 26/07 (servizio esterno) | scelta del committente, dati esportati in `docs/export/promemoria-2026-07-26.csv` | nessuno |
| debito | nessuna anonimizzazione automatica alla cancellazione GDPR di un cliente | `owners.anonymized_at` esiste, la procedura no | prima del rilascio |

Verifiche mancanti (strumenti non eseguiti): **nessuna** — 0 `skipped` su 9 passi. `semgrep` e `gitleaks` non sono nel gate dello schema (sono di `code-maniac`) e non sono installati su questa macchina.
