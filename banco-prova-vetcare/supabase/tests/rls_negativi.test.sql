-- Test pgTAP NEGATIVI: ogni tabella con policy di scrittura viene ATTACCATA.
--
-- Le policy si verificano violandole, non leggendole: l'audit RLS controlla che
-- questi tentativi esistano (`block` se una tabella scrivibile non compare mai
-- qui), pgTAP controlla che il database li respinga davvero.
--
-- Due attaccanti:
--   c1 = Anna Rossi, cliente privato — non e' staff, non deve scrivere niente
--        del clinico, dell'amministrativo o dell'anagrafica altrui
--   a2 = Marco Bellini, veterinario della sede di Biella — non deve scrivere
--        fuori dalla propria sede, ne' promuoversi
--
-- Due forme di rifiuto, entrambe legittime:
--   - `insert` bloccato da RLS -> eccezione 42501 (`new row violates ...`)
--   - `update` bloccato da RLS -> ZERO righe e NESSUN errore: si asserisce che
--     il dato non e' cambiato, perche' non c'e' niente da intercettare

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- ═══════════════════════════════════════ il cliente non scrive il clinico
set local role authenticated;
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select throws_ok(
    $$insert into public.clinics (name, address, phone)
      values ('Sede abusiva', 'via Falsa 1', '000')$$,
    '42501', null, 'il cliente non apre una sede'
);

select throws_ok(
    $$insert into public.species (code, label) values ('drago', 'Drago')$$,
    '42501', null, 'il cliente non aggiunge specie'
);

select throws_ok(
    $$insert into public.services (code, name, base_price_cents)
      values ('sconto-abusivo', 'Visita gratis', 0)$$,
    '42501', null, 'il cliente non si inventa una prestazione'
);

select throws_ok(
    $$insert into public.staff (auth_user_id, clinic_id, full_name, job_title)
      values ('00000000-0000-0000-0000-0000000000c1',
              '11111111-1111-1111-1111-111111111001', 'Anna Rossi', 'direttore')$$,
    '42501', null, 'il cliente non si assume come direttore'
);

select throws_ok(
    $$insert into public.medical_records (visit_id, created_by, clinical_summary)
      values ('88888888-8888-8888-8888-888888888001',
              '22222222-2222-2222-2222-222222222001', 'sto benissimo')$$,
    '42501', null, 'il cliente non scrive la propria cartella clinica'
);

select throws_ok(
    $$insert into public.diagnoses (medical_record_id, description)
      values ('99999999-9999-9999-9999-999999999001', 'nessuna patologia')$$,
    '42501', null, 'il cliente non si autodiagnostica'
);

select throws_ok(
    $$insert into public.treatments (medical_record_id, description)
      values ('99999999-9999-9999-9999-999999999001', 'niente da fare')$$,
    '42501', null, 'il cliente non scrive i trattamenti'
);

select throws_ok(
    $$insert into public.prescriptions (medical_record_id, drug_name, dosage)
      values ('99999999-9999-9999-9999-999999999001', 'morfina', 'a volonta')$$,
    '42501', null, 'il cliente non si prescrive farmaci'
);

select throws_ok(
    $$insert into public.vaccinations (animal_id, vaccine_name, administered_on)
      values ('44444444-4444-4444-4444-444444444001', 'antirabbica', current_date)$$,
    '42501', null, 'il cliente non registra vaccinazioni'
);

select throws_ok(
    $$insert into public.internal_notes
          (medical_record_id, author_staff_id, body)
      values ('99999999-9999-9999-9999-999999999001',
              '22222222-2222-2222-2222-222222222001', 'nota mia')$$,
    '42501', null, 'il cliente non scrive nelle note interne'
);

-- ═══════════════════════════════════════ il cliente non tocca il denaro
select throws_ok(
    $$insert into public.invoices (owner_id, number, issued_on, due_on)
      values ('33333333-3333-3333-3333-333333333001', 'FT-ABUSIVA',
              current_date, current_date)$$,
    '42501', null, 'il cliente non emette fatture'
);

-- qui non si pretende il 42501: il trigger `fattura_emessa_non_si_tocca` scatta
-- PRIMA del controllo RLS e rifiuta con un P0001. Il rifiuto e' quello che conta
select throws_ok(
    $$insert into public.invoice_lines
          (invoice_id, visit_id, service_name, unit_price_cents)
      values ('12121212-1212-1212-1212-121212120001',
              '88888888-8888-8888-8888-888888888001', 'sconto', 0)$$,
    null, null, 'il cliente non aggiunge righe di fattura'
);

select throws_ok(
    $$insert into public.price_lists (name, valid_from)
      values ('Listino personale di Anna', current_date)$$,
    '42501', null, 'il cliente non si crea un listino'
);

select throws_ok(
    $$insert into public.price_list_items (price_list_id, service_id, price_cents)
      values ('77777777-7777-7777-7777-777777777001',
              '66666666-6666-6666-6666-666666666001', 0)$$,
    '42501', null, 'il cliente non si azzera il prezzo di una prestazione'
);

-- l'update bloccato dalla RLS non da' errore: tocca zero righe
update public.price_list_items set price_cents = 1
where price_list_id = '77777777-7777-7777-7777-777777777001';

select is(
    (select count(*) from public.price_list_items
     where price_list_id = '77777777-7777-7777-7777-777777777001'
       and price_cents = 1)::bigint,
    0::bigint,
    'il cliente non riscrive i prezzi del listino'
);

-- ═══════════════════════════════════ il cliente non scrive per conto d'altri
select throws_ok(
    $$insert into public.animals (owner_id, species_id, name, sex)
      values ('33333333-3333-3333-3333-333333333003',
              '55555555-5555-5555-5555-555555555001', 'Cavallo di Troia', 'm')$$,
    '42501', null, 'il cliente non registra animali intestati a un altro cliente'
);

update public.owners set phone = '000000000'
where id = '33333333-3333-3333-3333-333333333003';

select is(
    (select count(*) from public.owners
     where id = '33333333-3333-3333-3333-333333333003'
       and phone = '000000000')::bigint,
    0::bigint,
    'il cliente non cambia i recapiti di un altro cliente'
);

select throws_ok(
    $$insert into public.visits
          (animal_id, clinic_id, staff_id, service_id, scheduled_at, ends_at)
      values ('44444444-4444-4444-4444-444444444003',
              '11111111-1111-1111-1111-111111111001',
              '22222222-2222-2222-2222-222222222001',
              '66666666-6666-6666-6666-666666666001',
              now() + interval '9 days', now() + interval '9 days 20 minutes')$$,
    '42501', null, 'il cliente non prenota per l''animale di un altro'
);

-- ═════════════════════════ il veterinario non esce dalla propria sede
set local request.jwt.claims =
    '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

update public.visits set status = 'annullata'
where id = '88888888-8888-8888-8888-888888888001';

select is(
    (select count(*) from public.visits
     where id = '88888888-8888-8888-8888-888888888001'
       and status = 'annullata')::bigint,
    0::bigint,
    'il veterinario di Biella non annulla una visita di Novara'
);

-- dentro `throws_ok` perche' l'esito va CATTURATO: eseguito nudo, lo statement
-- interrompe la transazione e il resto della suite non gira nemmeno.
-- ATTENZIONE a come fallisce oggi: non lo ferma la policy — la policy lo lascia
-- passare — lo ferma il trigger di archiviazione, che non e' `security definer`
-- e non riesce a scrivere in `medical_record_revisions`. Il rifiuto arriva per
-- il motivo sbagliato: la riga di un'altra sede era raggiungibile.
select throws_ok(
    $$update public.medical_records set clinical_summary = 'riscritta'
      where id = '99999999-9999-9999-9999-999999999001'$$,
    null, null, 'la riscrittura di una cartella di Novara viene rifiutata'
);

select is(
    (select count(*) from public.medical_records
     where id = '99999999-9999-9999-9999-999999999001'
       and clinical_summary = 'riscritta')::bigint,
    0::bigint,
    'il veterinario di Biella non riscrive una cartella di Novara'
);

-- ═══════════════ auto-promozione: la RLS filtra la riga, non la colonna
update public.staff set job_title = 'direttore'
where auth_user_id = '00000000-0000-0000-0000-0000000000a2';

select is(
    (select job_title from public.staff
     where auth_user_id = '00000000-0000-0000-0000-0000000000a2'),
    'veterinario',
    'il veterinario non si promuove a direttore sulla propria riga'
);

-- ═════════════════ macchina a stati: non si nasce nello stato di arrivo
select throws_ok(
    $$insert into public.visits
          (animal_id, clinic_id, staff_id, service_id,
           scheduled_at, ends_at, status)
      values ('44444444-4444-4444-4444-444444444004',
              '11111111-1111-1111-1111-111111111002',
              '22222222-2222-2222-2222-222222222003',
              '66666666-6666-6666-6666-666666666001',
              now() + interval '10 days', now() + interval '10 days 20 minutes',
              'fatturata')$$,
    null, null, 'una visita non nasce gia'' fatturata'
);

select * from finish();
rollback;
