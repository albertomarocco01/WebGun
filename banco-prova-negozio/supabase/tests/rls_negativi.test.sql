-- Test pgTAP NEGATIVI: ogni tabella con policy di scrittura viene ATTACCATA.
--
-- Le policy si verificano violandole, non leggendole: l'audit RLS controlla che
-- questi tentativi esistano (`block` se una tabella scrivibile non compare mai
-- qui), pgTAP controlla che il database li respinga davvero.
--
-- Due attaccanti:
--   c1 = Anna Rossi, cliente — non e' staff, non scrive niente del negozio
--   a2 = Marco Bellini, magazziniere — non si promuove titolare, non scrive i
--        contenuti (sono del redattore), non assume nessuno
--
-- Due forme di rifiuto, entrambe legittime:
--   - `insert` bloccato da RLS, o colonna esclusa dal `grant` -> eccezione 42501
--   - `update` bloccato da RLS -> ZERO righe e NESSUN errore: si asserisce che
--     il dato non e' cambiato, perche' non c'e' niente da intercettare

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ═══════════════════════════════════ il cliente non scrive niente del negozio
set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select throws_ok(
    $$insert into public.categories (name, slug) values ('Abusiva', 'abusiva')$$,
    '42501', null, 'il cliente non apre una categoria'
);

select throws_ok(
    $$insert into public.products (category_id, name, slug)
      values ('33333333-3333-3333-3333-333333333001', 'Falso', 'falso')$$,
    '42501', null, 'il cliente non pubblica un prodotto'
);

select throws_ok(
    $$insert into public.product_variants
        (product_id, sku, size, price_cents)
      values ('44444444-4444-4444-4444-444444444001', 'X-1', 'M', 1)$$,
    '42501', null, 'il cliente non si inventa una variante da un centesimo'
);

select throws_ok(
    $$insert into public.staff (auth_user_id, full_name, ruolo)
      values ('00000000-0000-0000-0000-0000000000c1', 'Anna Rossi', 'titolare')$$,
    '42501', null, 'il cliente non si assume come titolare'
);

select throws_ok(
    $$insert into public.customers (full_name) values ('Cliente fantasma')$$,
    '42501', null, 'il cliente non registra altri clienti'
);

select throws_ok(
    $$insert into public.orders
        (customer_id, shipping_name, shipping_address, shipping_city)
      values ('22222222-2222-2222-2222-222222222001',
              'Anna Rossi', 'Via Perrone 12', 'Novara')$$,
    '42501', null, 'l ordine non lo crea il browser del cliente'
);

select throws_ok(
    $$insert into public.order_items
        (order_id, variant_id, quantity, unit_price_cents,
         product_name, variant_name)
      values ('66666666-6666-6666-6666-666666666001',
              '55555555-5555-5555-5555-555555555001', 1, 1, 'Maglione', 'M')$$,
    '42501', null, 'il cliente non aggiunge righe al proprio ordine'
);

select throws_ok(
    $$insert into public.site_content (slot, title, corpo)
      values ('hack', 'Titolo', 'Corpo')$$,
    '42501', null, 'il cliente non scrive i contenuti del sito'
);

-- `update` negato dalla RLS: zero righe e nessun errore. Si asserisce lo stato.
update public.orders set status = 'consegnato'
where id = '66666666-6666-6666-6666-666666666001';

select is(
    (select count(*) from public.orders
     where id = '66666666-6666-6666-6666-666666666001'
       and status = 'in_attesa')::bigint,
    1::bigint,
    'il cliente non si consegna da solo un ordine'
);

update public.customers set full_name = 'Rubato'
where id = '22222222-2222-2222-2222-222222222002';

select is(
    (select count(*) from public.customers
     where full_name = 'Rubato')::bigint,
    0::bigint,
    'il cliente non riscrive l anagrafica di un altro'
);

update public.product_variants set price_cents = 1
where id = '55555555-5555-5555-5555-555555555001';

select is(
    (select count(*) from public.product_variants
     where id = '55555555-5555-5555-5555-555555555001'
       and price_cents = 12900)::bigint,
    1::bigint,
    'il prezzo non lo decide il browser'
);

delete from public.staff where id = '11111111-1111-1111-1111-111111111002';

-- La verifica si fa con gli occhi di chi la tabella la vede: il cliente non ha
-- nessuna policy di lettura su `staff`, quindi contando da qui il risultato
-- sarebbe 0 sia che il `delete` sia passato sia che sia stato respinto — cioe'
-- un test che passa per il motivo sbagliato.
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is(
    (select count(*) from public.staff
     where id = '11111111-1111-1111-1111-111111111002')::bigint,
    1::bigint,
    'il cliente non licenzia il magazziniere'
);

set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is_empty(
    $$select id from public.products where slug = 'cardigan-grezzo'$$,
    'la bozza di prodotto non esce dalla chiave del cliente'
);

select is_empty(
    $$select id from public.orders
      where customer_id = '22222222-2222-2222-2222-222222222002'$$,
    'il cliente non legge gli ordini di un altro'
);

-- ═══════════════════════════════════ il magazziniere non si promuove titolare
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

-- Non e' la RLS a fermarlo — la policy gli concede la propria riga — ma il
-- `grant update` PER COLONNA: la RLS filtra righe, non colonne.
select throws_ok(
    $$update public.staff set ruolo = 'titolare'
      where auth_user_id = '00000000-0000-0000-0000-0000000000a2'$$,
    '42501', null, 'il magazziniere non si promuove titolare sulla propria riga'
);

select throws_ok(
    $$select public.cambia_ruolo('11111111-1111-1111-1111-111111111002',
                                 'titolare')$$,
    'P0001', 'solo il titolare cambia i ruoli',
    'e non ci arriva nemmeno passando dall RPC'
);

select throws_ok(
    $$insert into public.site_content (slot, title, corpo)
      values ('promo-magazzino', 'Titolo', 'Corpo')$$,
    '42501', null, 'il magazziniere non scrive i contenuti del sito'
);

update public.site_content set title = 'Riscritto'
where slot = 'home-hero';

select is(
    (select count(*) from public.site_content
     where slot = 'home-hero' and title = 'Lana che dura')::bigint,
    1::bigint,
    'e non li riscrive nemmeno con un update'
);

-- ═══════════════════════════ la macchina a stati vale anche in `insert`
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select throws_ok(
    $$insert into public.orders
        (customer_id, status, shipping_name, shipping_address, shipping_city)
      values ('22222222-2222-2222-2222-222222222001', 'consegnato',
              'Anna Rossi', 'Via Perrone 12', 'Novara')$$,
    'P0001', null, 'un ordine non nasce gia consegnato'
);

select throws_ok(
    $$update public.orders set status = 'consegnato'
      where id = '66666666-6666-6666-6666-666666666001'$$,
    'P0001', null, 'e non salta da in_attesa a consegnato'
);

select * from finish();
rollback;
