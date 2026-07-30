-- Bottega Nord — seed di sviluppo.
-- Idempotente (`on conflict do nothing`) e deterministico (UUID scritti a
-- mano: `gen_random_uuid()` qui renderebbe i test non riproducibili).
-- references/modellazione.md §Seed.
--
-- Quantita' minime ma sufficienti a far vedere ogni stato dell'interfaccia:
-- un prodotto pubblicato e uno in bozza, un cliente con account e uno senza,
-- un ordine in ognuno dei due stati che il gestionale deve saper mostrare.

-- ------------------------------------------------------------ utenti di auth
--
-- Le quattro colonne dei token si scrivono a stringa VUOTA, mai lasciate a
-- NULL, e non e' un vezzo: GoTrue le legge in una `string` di Go, e su un NULL
-- l'intero accesso muore con
--   `Scan error on column index 3, name "confirmation_token":
--    converting NULL to string is unsupported`
-- cioe' HTTP 500 su ogni `signInWithPassword`, per ogni utente. Il database
-- resta perfetto e il gestionale diventa inaccessibile: nessun controllo di
-- schema se ne accorge, perche' non c'e' niente di sbagliato nello schema.
-- Trovato il 2026-07-30 da Flow Sentinel (P3), che e' il primo verificatore
-- della pipeline che prova ad ENTRARE invece di ispezionare.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
)
values
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
 'titolare@bottreganord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now(),
 '', '', '', ''),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
 'magazzino@bottreganord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now(),
 '', '', '', ''),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated',
 'redazione@bottreganord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now(),
 '', '', '', ''),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
 'anna.rossi@example.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now(),
 '', '', '', '')
on conflict (id) do nothing;

-- ------------------------------------------------------- identita' degli utenti
--
-- Un utente Supabase vero ha sempre la sua riga in `auth.identities`: la scrive
-- GoTrue quando l'utente nasce dall'API. Un seed che inserisce in `auth.users` a
-- mano e si ferma li' produce un utente a meta' — l'accesso a password funziona
-- lo stesso (GoTrue cerca in `auth.users`), quindi il difetto resta invisibile
-- finche' non si tocca OAuth, il collegamento di identita' o `getUserIdentities`,
-- e a quel punto sembra un guasto del provider.
-- Residuo dichiarato da Flow Sentinel in `docs/handoff/12-flow-sentinel.md` §3.1,
-- chiuso il 2026-07-30.
--
-- `email` NON si scrive: e' una colonna generata (`generated always as
-- (lower(identity_data->>'email'))`), e nominarla fa fallire l'insert.
-- `provider_id` per il provider `email` e' l'id dell'utente in forma di testo.
insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
)
select
    u.id::text,
    u.id,
    jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    now(), now(), now()
from auth.users u
where u.id in (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000c1'
)
on conflict do nothing;

-- ----------------------------------------------------------------- personale
insert into public.staff (id, auth_user_id, full_name, phone, ruolo) values
('11111111-1111-1111-1111-111111111001',
 '00000000-0000-0000-0000-0000000000a1', 'Giulia Ferrero', '0161 000001',
 'titolare'),
('11111111-1111-1111-1111-111111111002',
 '00000000-0000-0000-0000-0000000000a2', 'Marco Bellini', '0161 000002',
 'magazziniere'),
('11111111-1111-1111-1111-111111111003',
 '00000000-0000-0000-0000-0000000000a3', 'Sara Conti', '0161 000003',
 'redattore')
on conflict (id) do nothing;

-- ------------------------------------------------------------------- clienti
-- Il secondo non ha account: ordina per telefono, e nessuna policy per
-- `authenticated` raggiunge la sua riga (references/pattern-ecommerce.md).
insert into public.customers (id, auth_user_id, full_name, email, phone) values
('22222222-2222-2222-2222-222222222001',
 '00000000-0000-0000-0000-0000000000c1', 'Anna Rossi',
 'anna.rossi@example.it', '333 1110001'),
('22222222-2222-2222-2222-222222222002', null, 'Pietro Gallo',
 null, '333 1110002')
on conflict (id) do nothing;

-- ----------------------------------------------------------------- catalogo
insert into public.categories (id, name, slug, is_visible) values
('33333333-3333-3333-3333-333333333001', 'Maglieria', 'maglieria', true),
('33333333-3333-3333-3333-333333333002', 'Archivio', 'archivio', false)
on conflict (id) do nothing;

insert into public.products
(id, category_id, name, slug, description, is_published)
values
('44444444-4444-4444-4444-444444444001',
 '33333333-3333-3333-3333-333333333001', 'Maglione di lana', 'maglione-lana',
 'Lana merino, tinto in capo.', true),
('44444444-4444-4444-4444-444444444002',
 '33333333-3333-3333-3333-333333333001', 'Cardigan grezzo', 'cardigan-grezzo',
 'Bozza: prezzi non definitivi.', false)
on conflict (id) do nothing;

insert into public.product_variants
(id, product_id, sku, size, price_cents, quantity)
values
('55555555-5555-5555-5555-555555555001',
 '44444444-4444-4444-4444-444444444001', 'MAG-L-M', 'M', 12900, 7),
('55555555-5555-5555-5555-555555555002',
 '44444444-4444-4444-4444-444444444001', 'MAG-L-L', 'L', 12900, 0),
('55555555-5555-5555-5555-555555555003',
 '44444444-4444-4444-4444-444444444002', 'CAR-G-M', 'M', 15900, 3)
on conflict (id) do nothing;

-- ------------------------------------------------------------------- ordini
insert into public.orders (
    id, customer_id, total_cents,
    shipping_name, shipping_address, shipping_city
)
values
('66666666-6666-6666-6666-666666666001',
 '22222222-2222-2222-2222-222222222001', 12900,
 'Anna Rossi', 'Via Perrone 12', 'Novara'),
('66666666-6666-6666-6666-666666666002',
 '22222222-2222-2222-2222-222222222002', 25800,
 'Pietro Gallo', 'Corso Italia 4', 'Biella')
on conflict (id) do nothing;

-- Il secondo ordine e' gia' stato confermato: lo stato non si scrive
-- all'inserimento (il trigger lo vieta), si sposta con un `update`.
update public.orders set status = 'confermato'
where id = '66666666-6666-6666-6666-666666666002' and status = 'in_attesa';

insert into public.order_items (
    id, order_id, variant_id, quantity,
    unit_price_cents, product_name, variant_name
)
values
('77777777-7777-7777-7777-777777777001',
 '66666666-6666-6666-6666-666666666001',
 '55555555-5555-5555-5555-555555555001', 1, 12900, 'Maglione di lana', 'M'),
('77777777-7777-7777-7777-777777777002',
 '66666666-6666-6666-6666-666666666002',
 '55555555-5555-5555-5555-555555555001', 2, 12900, 'Maglione di lana', 'M')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- contenuti
insert into public.site_content (id, slot, title, corpo, is_published) values
('88888888-8888-8888-8888-888888888001', 'home-hero', 'Lana che dura',
 'Filati italiani, capi fatti a Biella.', true),
('88888888-8888-8888-8888-888888888002', 'home-promo', 'Saldi di stagione',
 'Bozza da rivedere con il titolare.', false)
on conflict (id) do nothing;
