-- Accademia Rossini — scuola di musica: personale, allievi, corsi, iscrizioni.
--
-- Dominio scelto apposta LONTANO dall'e-commerce: qui non c'e' un catalogo ne'
-- un ordine, c'e' un insegnante che deve vedere SOLO i propri corsi. E' la
-- forma che l'e-commerce non aveva: visibilita' ristretta per riga dentro lo
-- stesso ruolo.
--
-- ROLLBACK:
--   drop table public.enrollments, public.courses, public.students,
--              public.staff, public.site_content;
--   drop function public.cambia_ruolo, public.e_staff, public.ha_ruolo,
--                 public.insegna_il_corso, public.tocca_updated_at;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
create table public.staff (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique
    references auth.users (id) on delete restrict,
    full_name text not null check (length(full_name) <= 120),
    phone text check (length(phone) <= 40),
    ruolo text not null
    check (ruolo in ('direttore', 'segreteria', 'insegnante')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.students (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique references auth.users (id) on delete set null,
    full_name text not null check (length(full_name) <= 160),
    birth_date date,
    guardian_phone text check (length(guardian_phone) <= 40),
    -- Dato riservato che NON puo' stare qui: le note sull'allievo. Sta in una
    -- tabella a parte perche' la RLS filtra righe, non colonne
    -- (schema-forge/references/rls-supabase.md §La RLS e' per riga).
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.courses (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.staff (id) on delete restrict,
    name text not null check (length(name) <= 120),
    instrument text not null check (length(instrument) <= 60),
    giorno text not null
    check (giorno in ('lun', 'mar', 'mer', 'gio', 'ven', 'sab')),
    seats bigint not null check (seats > 0),
    is_open boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.enrollments (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses (id) on delete restrict,
    student_id uuid not null references public.students (id) on delete restrict,
    status text not null default 'richiesta'
    check (status in ('richiesta', 'confermata', 'ritirata')),
    fee_cents bigint not null default 0 check (fee_cents >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (course_id, student_id)
);

create table public.site_content (
    id uuid primary key default gen_random_uuid(),
    slot text not null unique check (length(slot) <= 60),
    title text not null check (length(title) <= 160),
    corpo text not null check (length(corpo) <= 4000),
    image_url text check (length(image_url) <= 500),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index staff_auth_user_id_idx on public.staff (auth_user_id);
create index students_auth_user_id_idx on public.students (auth_user_id);
create index courses_teacher_id_idx on public.courses (teacher_id);
create index enrollments_course_id_idx on public.enrollments (course_id);
create index enrollments_student_id_idx on public.enrollments (student_id);
create index site_content_is_published_idx
on public.site_content (is_published);

-- ------------------------------------------------------ 3. trigger updated_at
create or replace function public.tocca_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger staff_updated_at before update on public.staff
for each row execute function public.tocca_updated_at();

create trigger students_updated_at before update on public.students
for each row execute function public.tocca_updated_at();

create trigger courses_updated_at before update on public.courses
for each row execute function public.tocca_updated_at();

create trigger enrollments_updated_at before update on public.enrollments
for each row execute function public.tocca_updated_at();

create trigger site_content_updated_at before update on public.site_content
for each row execute function public.tocca_updated_at();

-- --------------------------------------------- 4. funzioni di contesto (RLS)
create or replace function public.e_staff()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.staff s
    where s.auth_user_id = (select auth.uid()) and s.is_active
);
$$;

create or replace function public.ha_ruolo(atteso text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.staff s
    where s.auth_user_id = (select auth.uid())
      and s.is_active
      and s.ruolo = atteso
);
$$;

-- Le due condizioni stanno DENTRO la stessa espressione: due policy separate si
-- sommerebbero in OR e l'insegnante vedrebbe i corsi di tutti
-- (schema-forge/references/rls-supabase.md, pattern 3b).
create or replace function public.insegna_il_corso(corso uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.courses c
    inner join public.staff s on s.id = c.teacher_id
    where c.id = corso
      and s.auth_user_id = (select auth.uid())
      and s.is_active
);
$$;

revoke execute on function public.e_staff() from public;
revoke execute on function public.ha_ruolo(text) from public;
revoke execute on function public.insegna_il_corso(uuid) from public;
grant execute on function public.e_staff() to authenticated;
grant execute on function public.ha_ruolo(text) to authenticated;
grant execute on function public.insegna_il_corso(uuid) to authenticated;

-- ------------------------------------------------------------------- 5. RLS
alter table public.staff enable row level security;
alter table public.staff force row level security;
alter table public.students enable row level security;
alter table public.students force row level security;
alter table public.courses enable row level security;
alter table public.courses force row level security;
alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
alter table public.site_content enable row level security;
alter table public.site_content force row level security;

-- ------------------------------------------------------------------ 6. policy
create policy personale_legge_se_stesso on public.staff
for select to authenticated using (auth_user_id = (select auth.uid()));

create policy personale_visibile_allo_staff on public.staff
for select to authenticated using (public.e_staff());

create policy personale_aggiorna_i_propri_recapiti on public.staff
for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy personale_assunto_dal_direttore on public.staff
for insert to authenticated with check (public.ha_ruolo('direttore'));

create policy personale_corretto_dal_direttore on public.staff
for update to authenticated
using (public.ha_ruolo('direttore'))
with check (public.ha_ruolo('direttore'));

create policy personale_licenziato_dal_direttore on public.staff
for delete to authenticated using (public.ha_ruolo('direttore'));

-- Gli allievi li vede la segreteria e la direzione; l'insegnante vede solo
-- quelli iscritti a un suo corso.
create policy allievo_legge_se_stesso on public.students
for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy segreteria_legge_gli_allievi on public.students
for select to authenticated
using (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy insegnante_legge_i_propri_allievi on public.students
for select to authenticated
using (
    exists (
        select 1
        from public.enrollments as e
        where
            e.student_id = students.id
            and public.insegna_il_corso(e.course_id)
    )
);

create policy segreteria_iscrive_un_allievo on public.students
for insert to authenticated
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy segreteria_corregge_un_allievo on public.students
for update to authenticated
using (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'))
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy corsi_aperti_visibili_a_tutti on public.courses
for select to anon, authenticated using (is_open);

create policy corsi_visibili_allo_staff on public.courses
for select to authenticated using (public.e_staff());

create policy corsi_scritti_dalla_direzione on public.courses
for insert to authenticated with check (public.ha_ruolo('direttore'));

create policy corsi_aggiornati_dalla_direzione on public.courses
for update to authenticated
using (public.ha_ruolo('direttore'))
with check (public.ha_ruolo('direttore'));

create policy iscrizioni_lette_dallo_staff on public.enrollments
for select to authenticated
using (
    public.ha_ruolo('segreteria')
    or public.ha_ruolo('direttore')
    or public.insegna_il_corso(course_id)
);

create policy iscrizioni_scritte_dalla_segreteria on public.enrollments
for insert to authenticated
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy iscrizioni_aggiornate_dalla_segreteria on public.enrollments
for update to authenticated
using (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'))
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy contenuti_pubblicati_visibili_a_tutti on public.site_content
for select to anon, authenticated using (is_published);

create policy contenuti_letti_dallo_staff on public.site_content
for select to authenticated using (public.e_staff());

create policy contenuti_scritti_dalla_segreteria on public.site_content
for insert to authenticated
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy contenuti_aggiornati_dalla_segreteria on public.site_content
for update to authenticated
using (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'))
with check (public.ha_ruolo('segreteria') or public.ha_ruolo('direttore'));

create policy contenuti_cancellati_dal_direttore on public.site_content
for delete to authenticated using (public.ha_ruolo('direttore'));

-- -------------------------------------------------------------- 7. grant
-- PRIMA si toglie: su Supabase i default privileges concedono gia' tutto ad
-- `anon` e `authenticated`, quindi un `grant` per colonna senza `revoke` non
-- restringe niente (misurato il 2026-07-28, references/form-e-permessi.md).
revoke all on public.staff from anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.courses from anon, authenticated;
revoke all on public.enrollments from anon, authenticated;
revoke all on public.site_content from anon, authenticated;

grant select, insert, delete on public.staff to authenticated;
grant update (full_name, phone, is_active) on public.staff to authenticated;

grant select, insert, update on public.students to authenticated;

grant select on public.courses to anon, authenticated;
grant insert, update on public.courses to authenticated;

grant select, insert, update on public.enrollments to authenticated;

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

-- ------------------------------------------------- 8. cambio di ruolo (RPC)
create or replace function public.cambia_ruolo(persona uuid, nuovo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.ha_ruolo('direttore') then
        raise exception 'solo il direttore cambia i ruoli';
    end if;
    if nuovo is null
        or nuovo not in ('direttore', 'segreteria', 'insegnante') then
        raise exception 'ruolo non ammesso';
    end if;
    update public.staff set ruolo = nuovo where id = persona;
    if not found then
        raise exception 'persona inesistente';
    end if;
end;
$$;

revoke execute on function public.cambia_ruolo(uuid, text) from public;
grant execute on function public.cambia_ruolo(uuid, text) to authenticated;
