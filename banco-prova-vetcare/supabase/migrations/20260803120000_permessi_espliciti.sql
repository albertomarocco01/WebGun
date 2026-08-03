-- VetCare Nord — i privilegi di tabella, scritti.
--
-- PERCHE' QUESTA MIGRAZIONE ESISTE. Le quattro migrazioni delle fondamenta non
-- contengono un solo `grant`: lo schema si appoggiava ai privilegi che
-- l'immagine Supabase concedeva d'ufficio ai ruoli del client. Quei privilegi
-- sono cambiati due volte in un mese, e nessuno dei due cambiamenti passava di
-- qui:
--
--   2026-07-28 (CLI 2.95.4)   anon/authenticated/service_role = arwdDxtm
--   2026-07-30 (CLI 2.110.0)  service_role perde tutto; anon e authenticated
--                             sopravvivono solo dove una migrazione scritta li
--                             riconcede uno per uno
--   2026-08-03 (CLI 2.111.0)  anon/authenticated/service_role = Dxtm, cioe'
--                             TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: zero
--                             select/insert/update/delete
--
-- Misurato su questo database il 2026-08-03: `pg_default_acl` contiene DUE
-- righe per (public, tabelle), una per ogni ruolo che puo' creare oggetti —
-- `supabase_admin` concede `arwdDxtm`, `postgres` concede `Dxtm`. Le migrazioni
-- le applica `postgres`, quindi ogni tabella di questo schema e' nata
-- illeggibile per i tre ruoli, e il pgTAP moriva con «permission denied for
-- table animals». La regola generale: su Supabase un privilegio che non hai
-- scritto non e' un privilegio che hai — e non e' nemmeno un privilegio che
-- perdi con preavviso.
--
-- IL `revoke` PRIMA DEL `grant` NON E' UNA FORMALITA'. Due cose misurate qui:
--   1. `Dxtm` comprende TRUNCATE, e la RLS non si applica a TRUNCATE. Con i
--      privilegi di default, `set role anon; truncate public.animals cascade`
--      RIESCE e porta via dieci tabelle (visite, cartelle, righe di fattura,
--      revisioni, diagnosi, trattamenti, prescrizioni, note interne,
--      vaccinazioni). Dopo il `revoke`: «permission denied for table animals».
--   2. Un `grant` per colonna e' ADDITIVO: dopo un `grant update` di tabella
--      intera, `grant update (full_name)` non restringe niente — il veterinario
--      si e' promosso direttore lo stesso. Solo il `revoke` rende la riga
--      scritta l'unica verita' sui privilegi, qualunque cosa ci fosse prima.
--
-- COSA QUESTA MIGRAZIONE NON FA. Non sana i difetti per cui questo banco esiste
-- (DECISIONI.md §20/§25). In particolare `public.staff` riceve `update` di
-- TABELLA INTERA, non per colonna: e' esattamente l'auto-promozione che l'audit
-- deve continuare a segnalare come `block`. Le altre due migrazioni che
-- porterebbero il banco a verde — vincolo sullo stato iniziale di `visits`,
-- `revoke execute` sulle undici `security definer` — restano non scritte.
--
-- ROLLBACK:
--   -- torna ai privilegi di default dell'immagine, cioe' a nessuna garanzia:
--   revoke all on all tables in schema public
--   from anon, authenticated, service_role;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ──────────────────────────────────────────────── 1. si azzera, poi si scrive
-- Nessun privilegio ereditato sopravvive a questa riga: da qui in poi vale solo
-- cio' che le sezioni 2, 3 e 4 concedono per iscritto.
revoke all on all tables in schema public
from anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────── 2. `anon`
-- La chiave anonima viaggia nel browser. Legge le tre tabelle che sono
-- informazione pubblica del sito — e nient'altro, nemmeno in sola lettura:
-- dov'e' scritto «anon: —» nel modello di accesso dell'handoff, qui non c'e'
-- una riga. La policy filtra le righe, il privilegio decide se la tabella
-- esiste.
grant select on public.clinics to anon;
grant select on public.services to anon;
grant select on public.species to anon;

-- ──────────────────────────────────────────────────────── 3. `authenticated`
-- Un solo ruolo per due mestieri — il cliente e lo staff — perche' su Supabase
-- il ruolo lo decide l'autenticazione, non il mestiere: a distinguerli sono le
-- policy (`e_staff()`, `mio_owner_id()`, `puo_vedere_clinica()`). Il privilegio
-- qui e' l'unione di cio' che le policy della tabella promettono al ruolo.

-- 3a. tabelle con una policy `for all`: i quattro privilegi.
-- ATTENZIONE a `public.staff`: `update` di tabella intera comprende
-- `job_title`, che decide gli accessi. E' il difetto n°1 del banco, vivo
-- apposta.
grant select, insert, update, delete on public.clinics to authenticated;
grant select, insert, update, delete on public.internal_notes to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.species to authenticated;
grant select, insert, update, delete on public.staff to authenticated;

-- 3b. tabelle con policy di lettura, inserimento e correzione: nessun `delete`.
-- La cartella clinica e la fattura non si cancellano, si correggono lasciando
-- traccia (trigger di revisione, trigger sulla fattura emessa).
grant select, insert, update on public.animals to authenticated;
grant select, insert, update on public.diagnoses to authenticated;
grant select, insert, update on public.invoice_lines to authenticated;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update on public.medical_records to authenticated;
grant select, insert, update on public.owners to authenticated;
grant select, insert, update on public.prescriptions to authenticated;
grant select, insert, update on public.price_list_items to authenticated;
grant select, insert, update on public.price_lists to authenticated;
grant select, insert, update on public.treatments to authenticated;
grant select, insert, update on public.vaccinations to authenticated;
grant select, insert, update on public.visits to authenticated;

-- 3c. sola lettura: lo storico delle correzioni lo scrive solo il trigger.
grant select on public.medical_record_revisions to authenticated;

-- 3d. la vista dell'export GDPR: `security_invoker = on`, quindi legge con i
-- diritti di chi la interroga e la RLS delle tabelle sotto vale comunque.
grant select on public.v_cartella_animale to authenticated;

-- ───────────────────────────────────────────────────────── 4. `service_role`
-- La chiave di servizio scavalca la RLS (`bypassrls`) ma NON scavalca i
-- privilegi: senza queste righe non legge niente, e se ne accorge solo chi la
-- usa. Il 2026-07-30, su un altro progetto, era gia' successo — nove test rossi
-- da fermo — e li' `service_role` era l'unico ruolo che nessuno aveva scritto.
-- Riceve i quattro CRUD e NON riceve `truncate`: se un giorno servira' una
-- manutenzione che svuota una tabella intera, sara' una riga scritta.
-- Qui la forma «all tables in schema» dice il vero, mentre per i ruoli del
-- client non lo direbbe: a loro il privilegio cambia da tabella a tabella
-- perche' ricalca le policy, e una riga sola nasconderebbe proprio la
-- differenza che l'audit deve poter confrontare.
grant select, insert, update, delete on all tables in schema public
to service_role;
