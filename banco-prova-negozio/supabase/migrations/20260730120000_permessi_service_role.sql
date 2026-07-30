-- Bottega Nord — i permessi di `service_role`, scritti invece che sperati.
--
-- MOTIVO, misurato il 2026-07-30 e non dedotto.
--
-- `20260728120400_permessi_espliciti.sql` aveva imparato meta' lezione: su
-- Supabase i `grant` nelle migrazioni erano no-op, perche' `alter default
-- privileges` aveva gia' concesso tutto ad `anon`, `authenticated` e
-- `service_role`. Cio' che contava era il `revoke`, e da li' la forma «prima
-- togli ai due ruoli del client, poi concedi cio' che serve».
--
-- I due ruoli del client, appunto. `service_role` non compariva perche' non
-- serviva: aveva tutto per default. Il 2026-07-30, con la CLI passata da
-- 2.95.4 a 2.110.0, il default e' cambiato:
--
--   select defaclacl from pg_default_acl;   -- proprietario `postgres`
--   PRIMA:  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
--            service_role=arwdDxtm}
--   ADESSO: {postgres=arwdDxtm, anon=Dxtm, authenticated=Dxtm,
--            service_role=Dxtm}
--
-- `Dxtm` e' TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: niente `select`,
-- `insert`, `update`, `delete`. `anon` e `authenticated` non se ne sono
-- accorti, perche' la migrazione dei permessi espliciti glieli riconcede uno
-- per uno. `service_role` si e' ritrovato con la chiave amministrativa e
-- nessun permesso:
--
--   GET /rest/v1/staff  →  403
--   {"code":"42501","message":"permission denied for table staff",
--    "hint":"Grant the required privileges to the current role with:
--            GRANT SELECT ON public.staff TO service_role;"}
--
-- L'ha trovato la batteria E2E, che usa quella chiave per MISURARE l'effetto
-- dei flussi sul database: nove test rossi in un progetto dove non era
-- cambiata una riga di applicazione. Nessun controllo statico poteva vederlo
-- — non c'e' niente di sbagliato nel codice, e' l'ambiente sotto che si e'
-- mosso.
--
-- La lezione e' quella di due giorni fa, allargata: su Supabase un privilegio
-- che non hai scritto non e' un privilegio che hai. Vale per i ruoli del
-- client e vale per quello di servizio.
--
-- SCELTA DELIBERATA: nessun `alter default privileges` qui dentro. Rimetterlo
-- restaurerebbe la magia implicita che ha appena smesso di funzionare. Una
-- tabella nuova nascera' senza permessi per `service_role`, la batteria
-- diventera' rossa e qualcuno scrivera' la riga: e' il modo rumoroso, ed e'
-- quello giusto.
--
-- ROLLBACK: `revoke select, insert, update, delete on all tables in schema
-- public from service_role;` — ma toglierebbe alla chiave amministrativa la
-- capacita' di leggere il database che amministra.

set lock_timeout = '5s';
set statement_timeout = '60s';

grant select, insert, update, delete
on all tables in schema public to service_role;

-- Le sequenze servono agli `insert` sulle colonne seriali. Qui le chiavi sono
-- tutte `uuid`, quindi oggi non ne esiste nemmeno una: la riga c'e' lo stesso
-- perche' il giorno in cui ne nasce una il fallimento sarebbe un
-- `permission denied for sequence` dentro un `insert` dall'aria innocua.
grant usage, select on all sequences in schema public to service_role;
