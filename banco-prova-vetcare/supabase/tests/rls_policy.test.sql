-- Test delle policy RLS impersonando i ruoli (references/rls-supabase.md
-- §Testare le policy). Una policy senza test e' un'ipotesi.

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------- cliente privato
set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
    (select count(*) from public.animals)::bigint, 2::bigint,
    'il cliente vede solo i propri due animali'
);

select is_empty(
    'select * from public.internal_notes',
    'il cliente non legge NESSUNA nota clinica interna'
);

select is_empty(
    $$select * from public.price_list_items
      where price_list_id = '77777777-7777-7777-7777-777777777002'$$,
    'il privato non legge il listino negoziato dell''allevamento'
);

select is(
    (select count(*) from public.visits)::bigint, 3::bigint,
    'il cliente vede solo le visite dei propri animali'
);

-- la visita si sposta SOLO con la funzione, non con un update dal client:
-- `with check` vede la riga, non il campo modificato.
update public.visits set status = 'confermata'
where id = '88888888-8888-8888-8888-888888888001';

select is(
    (select count(*) from public.visits
     where id = '88888888-8888-8888-8888-888888888001'
       and status = 'prenotata')::bigint,
    1::bigint,
    'il cliente non puo'' confermarsi da solo una visita'
);

select throws_ok(
    $$select public.sposta_visita(
        '88888888-8888-8888-8888-888888888002'::uuid,
        '2026-09-12 10:00:00+02'::timestamptz,
        '2026-09-12 10:20:00+02'::timestamptz)$$,
    'la visita e'' gia'' confermata: chiama la clinica per spostarla',
    'una visita gia'' confermata non si sposta dal portale'
);

-- ------------------------------------------------ veterinario di una sede
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is(
    (select count(*) from public.visits)::bigint, 2::bigint,
    'il veterinario di Biella vede solo le visite di Biella'
);

select is(
    (select count(*) from public.internal_notes)::bigint, 0::bigint,
    'il veterinario di Biella non legge le note interne di Vercelli'
);

-- --------------------------------------------------------------- direttore
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select is(
    (select count(*) from public.visits)::bigint, 6::bigint,
    'il direttore vede le visite di tutte e tre le sedi'
);

select is(
    (select count(*) from public.internal_notes)::bigint, 1::bigint,
    'il direttore legge le note interne'
);

-- ------------------------------------------------------------------- anon
set local role anon;
set local request.jwt.claims = '';

select is(
    (select count(*) from public.owners)::bigint, 0::bigint,
    'la chiave anonima non legge nessun cliente'
);

select * from finish();
rollback;
