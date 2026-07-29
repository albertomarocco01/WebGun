-- Accademia Rossini — seed di sviluppo, deterministico e idempotente.

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
)
values
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated',
 'direzione@accademiarossini.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
 'segreteria@accademiarossini.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated',
 'violino@accademiarossini.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000',
 '00000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated',
 'piano@accademiarossini.it', crypt('password123', gen_salt('bf')), now(),
 '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.staff (id, auth_user_id, full_name, phone, ruolo) values
('11111111-1111-1111-1111-111111111001',
 '00000000-0000-0000-0000-0000000000d1', 'Elena Rossini', '015 000001',
 'direttore'),
('11111111-1111-1111-1111-111111111002',
 '00000000-0000-0000-0000-0000000000c1', 'Paolo Vigna', '015 000002',
 'segreteria'),
('11111111-1111-1111-1111-111111111003',
 '00000000-0000-0000-0000-0000000000e1', 'Marta Sala', '015 000003',
 'insegnante'),
('11111111-1111-1111-1111-111111111004',
 '00000000-0000-0000-0000-0000000000e2', 'Ivan Bruno', '015 000004',
 'insegnante')
on conflict (id) do nothing;

insert into public.students (id, auth_user_id, full_name, birth_date, guardian_phone) values
('22222222-2222-2222-2222-222222222001', null, 'Giada Ferro', '2012-04-11', '333 2220001'),
('22222222-2222-2222-2222-222222222002', null, 'Luca Prato', '2010-09-02', '333 2220002'),
('22222222-2222-2222-2222-222222222003', null, 'Sofia Manzi', '2013-01-27', '333 2220003')
on conflict (id) do nothing;

insert into public.courses (id, teacher_id, name, instrument, giorno, seats) values
('33333333-3333-3333-3333-333333333001',
 '11111111-1111-1111-1111-111111111003', 'Violino principianti', 'violino',
 'lun', 6),
('33333333-3333-3333-3333-333333333002',
 '11111111-1111-1111-1111-111111111004', 'Pianoforte medio', 'pianoforte',
 'mer', 4)
on conflict (id) do nothing;

insert into public.enrollments (id, course_id, student_id, fee_cents) values
('44444444-4444-4444-4444-444444444001',
 '33333333-3333-3333-3333-333333333001',
 '22222222-2222-2222-2222-222222222001', 32000),
('44444444-4444-4444-4444-444444444002',
 '33333333-3333-3333-3333-333333333002',
 '22222222-2222-2222-2222-222222222002', 38000)
on conflict (id) do nothing;

insert into public.site_content (id, slot, title, corpo, is_published) values
('55555555-5555-5555-5555-555555555001', 'home-hero', 'Musica dal 1978',
 'Corsi di strumento per bambini e adulti.', true)
on conflict (id) do nothing;
