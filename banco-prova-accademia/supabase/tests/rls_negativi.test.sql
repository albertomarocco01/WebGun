-- Test pgTAP NEGATIVI dell'accademia: i rilievi del tribunale, riprovati.
--
-- Ogni asserzione qui sotto e' un difetto che `/code-inquisition` ha trovato il
-- 2026-07-28, corretto con la migrazione `20260728160000_correzioni_tribunale`.
-- Un rilievo chiuso senza un test che lo attacchi e' un rilievo chiuso a parole.
--
-- Attaccanti:
--   e1 = Marta Sala, insegnante di violino
--   c1 = Paolo Vigna, segreteria

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

-- ══════════════════════════ IAM-01: l'interruttore non e' un recapito
select throws_ok(
    $$update public.staff set is_active = true
      where auth_user_id = '00000000-0000-0000-0000-0000000000e1'$$,
    '42501', null,
    'l''insegnante non si riaccende da solo: `is_active` fuori dal grant'
);

select throws_ok(
    $$update public.staff set ruolo = 'direttore'
      where auth_user_id = '00000000-0000-0000-0000-0000000000e1'$$,
    '42501', null, 'e nemmeno si promuove'
);

select throws_ok(
    $$select public.cambia_stato_attivo('11111111-1111-1111-1111-111111111003', true)$$,
    'P0001', 'solo il direttore attiva o disattiva il personale',
    'la funzione controlla chi la chiama, non solo cosa le si passa'
);

-- ══════════════════════════ IAM-02: l'anagrafica del personale non e' di tutti
select is(
    (select count(*) from public.staff)::bigint,
    1::bigint,
    'l''insegnante vede solo la propria riga, non i recapiti dei colleghi'
);

-- ══════════════════════════ l'isolamento degli allievi regge
select is(
    (select count(*) from public.students)::bigint,
    1::bigint,
    'l''insegnante vede solo gli allievi dei propri corsi'
);

select throws_ok(
    $$insert into public.enrollments (course_id, student_id)
      values ('33333333-3333-3333-3333-333333333002',
              '22222222-2222-2222-2222-222222222003')$$,
    '42501', null,
    'e non si iscrive un allievo per farselo comparire'
);

-- ══════════════════════════ IAM-03: la macchina a stati sta nel database
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
    (select count(*) from public.staff)::bigint,
    4::bigint,
    'la segreteria l''anagrafica la vede: la policy distingue i ruoli'
);

select lives_ok(
    $$update public.enrollments set status = 'ritirata'
      where id = '44444444-4444-4444-4444-444444444001'$$,
    'la segreteria puo' || ' ritirare un''iscrizione'
);

select throws_ok(
    $$update public.enrollments set status = 'confermata'
      where id = '44444444-4444-4444-4444-444444444001'$$,
    'P0001', null,
    'ma `ritirata` e'' terminale: il trigger rifiuta la resurrezione'
);

select throws_ok(
    $$insert into public.enrollments (course_id, student_id, status)
      values ('33333333-3333-3333-3333-333333333002',
              '22222222-2222-2222-2222-222222222003', 'confermata')$$,
    'P0001', null,
    'e un''iscrizione non nasce gia'' confermata'
);

select * from finish();
rollback;
