-- Bottega Nord — permessi espliciti: quello che su Supabase conta e' il REVOKE.
--
-- MOTIVO, misurato su questo database il 2026-07-28 e non dedotto:
--   select defaclacl from pg_default_acl
--   → {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
--      authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
-- Supabase imposta `alter default privileges in schema public grant all on
-- tables to anon, authenticated, service_role`. Conseguenze, entrambe provate:
--
--   1. ogni `grant` scritto nelle migrazioni precedenti era un NO-OP: il
--      privilegio c'era gia'. Anche `anon` aveva insert/update/delete su tutte
--      e otto le tabelle — a fermarlo era solo l'assenza di policy;
--   2. `grant update (full_name, phone) on public.staff to authenticated`
--      NON restringeva niente, perche' il permesso di tabella intera era gia'
--      concesso: il `grant` per colonna e' ADDITIVO. Il test pgTAP l'ha
--      dimostrato — il magazziniere si e' promosso titolare con
--      `update public.staff set ruolo = 'titolare'` sulla PROPRIA riga, e da
--      li' ha scritto i contenuti del sito.
--
-- Da qui la forma: prima si TOGLIE tutto ai due ruoli del client, poi si
-- concede esattamente cio' che serve. `pg_attribute.attacl` e' l'unico posto
-- del catalogo dove il grant per colonna si vede davvero:
-- `information_schema.column_privileges` espande anche i permessi di tabella
-- su ogni colonna, quindi non distingue i due casi.
--
-- ROLLBACK: nessuno. Riconcedere i permessi di default riaprirebbe il buco.

set lock_timeout = '5s';
set statement_timeout = '60s';

revoke all on public.staff from anon, authenticated;
revoke all on public.customers from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_variants from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.site_content from anon, authenticated;

-- staff: il ruolo NON e' fra le colonne scrivibili. Si cambia solo con
-- `public.cambia_ruolo`, che verifica chi chiama.
grant select, insert, delete on public.staff to authenticated;
grant update (full_name, phone, is_active) on public.staff to authenticated;

grant select, insert, update on public.customers to authenticated;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

grant select, insert, update on public.orders to authenticated;

grant select, insert, update, delete on public.order_items to authenticated;

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
