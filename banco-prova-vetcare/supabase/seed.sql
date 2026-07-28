-- VetCare Nord — seed di sviluppo.
-- Idempotente (`on conflict do nothing`) e deterministico (UUID scritti a
-- mano: `gen_random_uuid()` qui renderebbe i test non riproducibili).
-- references/modellazione.md §Seed.

-- ------------------------------------------------------------ utenti di auth
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
)
values
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated',
 'direttore@vetcarenord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
 'vet.novara@vetcarenord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
 'vet.biella@vetcarenord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated',
 'vet.vercelli@vetcarenord.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
 'anna.rossi@example.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated',
 'canile.sanrocco@example.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

-- ------------------------------------------------------------------ lookup
insert into public.species (id, code, label) values
('55555555-5555-5555-5555-555555555001', 'cane', 'Cane'),
('55555555-5555-5555-5555-555555555002', 'gatto', 'Gatto'),
('55555555-5555-5555-5555-555555555003', 'coniglio', 'Coniglio')
on conflict (id) do nothing;

-- ------------------------------------------------------------------- sedi
insert into public.clinics (id, name, address, phone, is_active) values
('11111111-1111-1111-1111-111111111001', 'VetCare Novara',
 'Via Perrone 12, Novara', '0321 111111', true),
('11111111-1111-1111-1111-111111111002', 'VetCare Biella',
 'Via Italia 44, Biella', '015 222222', true),
('11111111-1111-1111-1111-111111111003', 'VetCare Vercelli',
 'Corso Libertà 3, Vercelli', '0161 333333', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------------ staff
insert into public.staff (id, auth_user_id, clinic_id, full_name, job_title) values
('22222222-2222-2222-2222-222222222001',
 '00000000-0000-0000-0000-0000000000d1',
 '11111111-1111-1111-1111-111111111001', 'Giulia Ferraris', 'direttore'),
('22222222-2222-2222-2222-222222222002',
 '00000000-0000-0000-0000-0000000000a1',
 '11111111-1111-1111-1111-111111111001', 'Marco Bellini', 'veterinario'),
('22222222-2222-2222-2222-222222222003',
 '00000000-0000-0000-0000-0000000000a2',
 '11111111-1111-1111-1111-111111111002', 'Sara Pozzi', 'veterinario'),
('22222222-2222-2222-2222-222222222004',
 '00000000-0000-0000-0000-0000000000a3',
 '11111111-1111-1111-1111-111111111003', 'Luca Deidda', 'veterinario')
on conflict (id) do nothing;

-- --------------------------------------------------------------- clienti
-- Il terzo cliente NON ha account sul portale: e' il caso che il modello
-- `profiles.id = auth.users.id` non saprebbe rappresentare.
insert into public.owners
(id, auth_user_id, owner_type, full_name, email, phone, tax_code) values
('33333333-3333-3333-3333-333333333001',
 '00000000-0000-0000-0000-0000000000c1', 'privato', 'Anna Rossi',
 'anna.rossi@example.it', '333 1234567', 'RSSNNA80A41F952X'),
('33333333-3333-3333-3333-333333333002',
 '00000000-0000-0000-0000-0000000000c2', 'allevamento',
 'Canile San Rocco', 'canile.sanrocco@example.it', '015 998877',
 '01234567890'),
('33333333-3333-3333-3333-333333333003', null, 'privato', 'Ettore Melis',
 null, '0161 445566', 'MLSTTR45M02L750Y')
on conflict (id) do nothing;

-- --------------------------------------------------------------- animali
insert into public.animals
(id, owner_id, species_id, name, breed, sex, birth_date, microchip) values
('44444444-4444-4444-4444-444444444001',
 '33333333-3333-3333-3333-333333333001',
 '55555555-5555-5555-5555-555555555001', 'Zeus', 'Pastore tedesco', 'm',
 '2019-04-12', '380260000000001'),
('44444444-4444-4444-4444-444444444002',
 '33333333-3333-3333-3333-333333333001',
 '55555555-5555-5555-5555-555555555002', 'Milla', 'Europeo', 'f',
 '2021-09-01', '380260000000002'),
('44444444-4444-4444-4444-444444444003',
 '33333333-3333-3333-3333-333333333002',
 '55555555-5555-5555-5555-555555555001', 'Argo', 'Meticcio', 'm',
 '2020-01-20', '380260000000003'),
('44444444-4444-4444-4444-444444444004',
 '33333333-3333-3333-3333-333333333002',
 '55555555-5555-5555-5555-555555555001', 'Bea', 'Meticcio', 'f',
 '2022-06-15', '380260000000004'),
-- caso limite: animale senza microchip, senza data di nascita, deceduto
('44444444-4444-4444-4444-444444444005',
 '33333333-3333-3333-3333-333333333003',
 '55555555-5555-5555-5555-555555555003', 'Nuvola', null, 'sconosciuto',
 null, null)
on conflict (id) do nothing;

update public.animals
set deceased_at = '2026-03-02'
where id = '44444444-4444-4444-4444-444444444005';

-- ----------------------------------------------------------- prestazioni
insert into public.services
(id, code, name, description, base_price_cents, is_active) values
('66666666-6666-6666-6666-666666666001', 'visita-generica',
 'Visita generica', 'Visita clinica di controllo', 4500, true),
('66666666-6666-6666-6666-666666666002', 'vaccino-polivalente',
 'Vaccino polivalente', 'Richiamo annuale', 3800, true),
('66666666-6666-6666-6666-666666666003', 'sterilizzazione',
 'Sterilizzazione', 'Intervento in anestesia generale', 28000, true),
-- caso limite: prestazione ritirata dal listino, mai cancellata
('66666666-6666-6666-6666-666666666004', 'radiografia-analogica',
 'Radiografia analogica', 'Dismessa nel 2025', 6000, false)
on conflict (id) do nothing;

-- --------------------------------------------------------------- listini
insert into public.price_lists (id, owner_id, name, valid_from) values
('77777777-7777-7777-7777-777777777001', null, 'Listino privati',
 '2026-01-01'),
('77777777-7777-7777-7777-777777777002',
 '33333333-3333-3333-3333-333333333002',
 'Convenzione Canile San Rocco', '2026-01-01')
on conflict (id) do nothing;

insert into public.price_list_items
(id, price_list_id, service_id, price_cents) values
('78787878-7878-7878-7878-787878787001',
 '77777777-7777-7777-7777-777777777001',
 '66666666-6666-6666-6666-666666666001', 4500),
('78787878-7878-7878-7878-787878787002',
 '77777777-7777-7777-7777-777777777001',
 '66666666-6666-6666-6666-666666666002', 3800),
-- prezzo negoziato: e' il dato che NON deve essere leggibile dagli altri
('78787878-7878-7878-7878-787878787003',
 '77777777-7777-7777-7777-777777777002',
 '66666666-6666-6666-6666-666666666001', 2900),
('78787878-7878-7878-7878-787878787004',
 '77777777-7777-7777-7777-777777777002',
 '66666666-6666-6666-6666-666666666002', 2400)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- visite
-- Una per ogni stato dell'interfaccia: prenotata, confermata, eseguita,
-- fatturata, annullata.
insert into public.visits
(id, animal_id, clinic_id, staff_id, service_id, scheduled_at, ends_at,
 status, cancelled_at) values
('88888888-8888-8888-8888-888888888001',
 '44444444-4444-4444-4444-444444444001',
 '11111111-1111-1111-1111-111111111001',
 '22222222-2222-2222-2222-222222222002',
 '66666666-6666-6666-6666-666666666001',
 '2026-09-10 09:00:00+02', '2026-09-10 09:30:00+02', 'prenotata', null),
('88888888-8888-8888-8888-888888888002',
 '44444444-4444-4444-4444-444444444002',
 '11111111-1111-1111-1111-111111111001',
 '22222222-2222-2222-2222-222222222002',
 '66666666-6666-6666-6666-666666666002',
 '2026-09-11 10:00:00+02', '2026-09-11 10:20:00+02', 'confermata', null),
('88888888-8888-8888-8888-888888888003',
 '44444444-4444-4444-4444-444444444003',
 '11111111-1111-1111-1111-111111111002',
 '22222222-2222-2222-2222-222222222003',
 '66666666-6666-6666-6666-666666666001',
 '2026-06-02 11:00:00+02', '2026-06-02 11:30:00+02', 'eseguita', null),
('88888888-8888-8888-8888-888888888004',
 '44444444-4444-4444-4444-444444444004',
 '11111111-1111-1111-1111-111111111002',
 '22222222-2222-2222-2222-222222222003',
 '66666666-6666-6666-6666-666666666002',
 '2026-06-03 09:00:00+02', '2026-06-03 09:20:00+02', 'fatturata', null),
('88888888-8888-8888-8888-888888888005',
 '44444444-4444-4444-4444-444444444001',
 '11111111-1111-1111-1111-111111111001',
 '22222222-2222-2222-2222-222222222002',
 '66666666-6666-6666-6666-666666666003',
 '2026-05-20 08:00:00+02', '2026-05-20 10:00:00+02', 'annullata',
 '2026-05-15 12:00:00+02'),
-- il proprietario senza account ha comunque le sue visite
('88888888-8888-8888-8888-888888888006',
 '44444444-4444-4444-4444-444444444005',
 '11111111-1111-1111-1111-111111111003',
 '22222222-2222-2222-2222-222222222004',
 '66666666-6666-6666-6666-666666666001',
 '2026-02-18 15:00:00+01', '2026-02-18 15:30:00+01', 'eseguita', null)
on conflict (id) do nothing;

-- ------------------------------------------------------- cartelle cliniche
insert into public.medical_records
(id, visit_id, created_by, clinical_summary, owner_note) values
('99999999-9999-9999-9999-999999999001',
 '88888888-8888-8888-8888-888888888003',
 '22222222-2222-2222-2222-222222222003',
 'Otite esterna bilaterale, essudato scuro.',
 'Pulire le orecchie ogni giorno per una settimana.'),
('99999999-9999-9999-9999-999999999002',
 '88888888-8888-8888-8888-888888888004',
 '22222222-2222-2222-2222-222222222003',
 'Richiamo vaccinale eseguito senza reazioni.',
 'Prossimo richiamo fra un anno.'),
('99999999-9999-9999-9999-999999999003',
 '88888888-8888-8888-8888-888888888006',
 '22222222-2222-2222-2222-222222222004',
 'Insufficienza renale cronica in stadio avanzato.', null)
on conflict (id) do nothing;

insert into public.diagnoses
(id, medical_record_id, code, description) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
 '99999999-9999-9999-9999-999999999001', 'H60', 'Otite esterna'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
 '99999999-9999-9999-9999-999999999003', 'N18',
 'Insufficienza renale cronica')
on conflict (id) do nothing;

insert into public.treatments
(id, medical_record_id, description, administered_at) values
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
 '99999999-9999-9999-9999-999999999001',
 'Lavaggio auricolare in ambulatorio', '2026-06-02 11:10:00+02')
on conflict (id) do nothing;

insert into public.prescriptions
(id, medical_record_id, drug_name, dosage, duration_days) values
('cccccccc-cccc-cccc-cccc-cccccccc0001',
 '99999999-9999-9999-9999-999999999001',
 'Gocce auricolari antibiotiche', '4 gocce due volte al giorno', 7)
on conflict (id) do nothing;

-- La nota che il proprietario non deve poter leggere in nessun modo.
insert into public.internal_notes
(id, medical_record_id, author_staff_id, body) values
('dddddddd-dddd-dddd-dddd-dddddddd0001',
 '99999999-9999-9999-9999-999999999003',
 '22222222-2222-2222-2222-222222222004',
 'Prognosi infausta a breve termine: il proprietario non e'' ancora '
 'pronto a sentirselo dire.')
on conflict (id) do nothing;

-- ------------------------------------------------- vaccinazioni e promemoria
insert into public.vaccinations
(id, animal_id, visit_id, vaccine_name, administered_on, next_due_on) values
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0001',
 '44444444-4444-4444-4444-444444444004',
 '88888888-8888-8888-8888-888888888004', 'Polivalente DHPPi',
 '2026-06-03', '2027-06-03'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0002',
 '44444444-4444-4444-4444-444444444001', null, 'Antirabbica',
 '2025-11-04', '2026-11-04')
on conflict (id) do nothing;

-- ------------------------------------------------------------- fatturazione
insert into public.invoices
(id, owner_id, number, issued_on, due_on, status, period_start, period_end)
values
('12121212-1212-1212-1212-121212120001',
 '33333333-3333-3333-3333-333333333002', '2026/0042', '2026-06-30',
 '2026-07-30', 'emessa', '2026-06-01', '2026-06-30')
on conflict (id) do nothing;

-- `on conflict do nothing` NON basta qui: il trigger di dominio
-- `fattura_emessa_non_si_tocca` e' BEFORE INSERT e scatta PRIMA che il
-- conflitto sia rilevato. Rieseguendo il seed su un database caldo la fattura
-- e' gia' `pagata` e l'insert esplode. La riga non si tenta nemmeno:
-- references/modellazione.md §Seed.
insert into public.invoice_lines
(id, invoice_id, visit_id, service_name, unit_price_cents, quantity)
select '13131313-1313-1313-1313-131313130001',
       '12121212-1212-1212-1212-121212120001',
       '88888888-8888-8888-8888-888888888004', 'Vaccino polivalente', 2400, 1
where not exists (
    select 1 from public.invoice_lines
    where id = '13131313-1313-1313-1313-131313130001'
);

-- La fattura passa a `pagata` DOPO le sue righe: e' un trigger di dominio a
-- vietare di toccarla dopo.
update public.invoices
set status = 'pagata', paid_at = '2026-07-12 09:00:00+02'
where id = '12121212-1212-1212-1212-121212120001'
  and status = 'emessa';
