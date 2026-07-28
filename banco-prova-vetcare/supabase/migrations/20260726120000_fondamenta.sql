-- VetCare Nord — fondamenta: sedi, personale, clienti, animali.
--
-- ROLLBACK:
--   drop table public.animals, public.owner_staff_flags, public.owners,
--              public.staff, public.clinics, public.species;
--   drop function public.puo_vedere_clinica, public.e_staff,
--                 public.mio_owner_id, public.tocca_updated_at;

set lock_timeout = '5s';
set statement_timeout = '60s';

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- 1. lookup
create table public.species (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (length(code) <= 40),
    label text not null check (length(label) <= 80),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. tabelle
create table public.clinics (
    id uuid primary key default gen_random_uuid(),
    name text not null unique check (length(name) <= 120),
    address text not null check (length(address) <= 240),
    phone text not null check (length(phone) <= 40),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Il ruolo NON sta su una colonna che l'utente possa aggiornare da solo:
-- questa tabella la scrive solo la direzione (policy in fondo al file).
-- references/rls-supabase.md, pattern 4.
create table public.staff (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique
    references auth.users (id) on delete restrict,
    clinic_id uuid not null references public.clinics (id) on delete restrict,
    full_name text not null check (length(full_name) <= 120),
    job_title text not null
    check (job_title in ('direttore', 'veterinario', 'reception')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- bersaglio della chiave esterna composita di `visits`: una visita non puo'
    -- essere assegnata a un veterinario di un'altra sede.
    unique (id, clinic_id)
);

-- Il cliente esiste anche senza account sul portale (risposta B del
-- committente):
-- `auth_user_id` e' FACOLTATIVO. Non e' `profiles`: l'identita' Supabase e' un
-- attributo del cliente, non la sua chiave.
create table public.owners (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique references auth.users (id) on delete set null,
    owner_type text not null
    check (owner_type in ('privato', 'allevamento')),
    full_name text not null check (length(full_name) <= 160),
    email text check (length(email) <= 160),
    phone text check (length(phone) <= 40),
    tax_code text unique check (length(tax_code) <= 20),
    anonymized_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Riservatezza per COLONNA: il contrassegno «cliente difficile» non puo' stare
-- su `owners`, che il proprietario legge. La RLS filtra righe, non campi
-- (references/rls-supabase.md, §La RLS e' per riga). Tabella separata, sua RLS.
create table public.owner_staff_flags (
    owner_id uuid primary key
    references public.owners (id) on delete cascade,
    is_difficult boolean not null default false,
    note text check (length(note) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.animals (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.owners (id) on delete restrict,
    species_id uuid not null references public.species (id) on delete restrict,
    name text not null check (length(name) <= 80),
    breed text check (length(breed) <= 80),
    sex text not null check (sex in ('m', 'f', 'sconosciuto')),
    birth_date date,
    microchip text unique check (length(microchip) <= 20),
    deceased_at date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 3. indici
create index staff_clinic_id_idx on public.staff (clinic_id);
create index staff_auth_user_id_idx on public.staff (auth_user_id);
create index owners_auth_user_id_idx on public.owners (auth_user_id);
create index animals_owner_id_idx on public.animals (owner_id);
create index animals_species_id_idx on public.animals (species_id);

-- ------------------------------------------------------ 4. trigger updated_at
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

create trigger species_updated_at before update on public.species
for each row execute function public.tocca_updated_at();

create trigger clinics_updated_at before update on public.clinics
for each row execute function public.tocca_updated_at();

create trigger staff_updated_at before update on public.staff
for each row execute function public.tocca_updated_at();

create trigger owners_updated_at before update on public.owners
for each row execute function public.tocca_updated_at();

create trigger owner_staff_flags_updated_at
before update on public.owner_staff_flags
for each row execute function public.tocca_updated_at();

create trigger animals_updated_at before update on public.animals
for each row execute function public.tocca_updated_at();

-- --------------------------------------------- 5. funzioni di contesto (RLS)
create or replace function public.mio_owner_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
select o.id
from public.owners o
where o.auth_user_id = (select auth.uid());
$$;

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

-- Pattern 3b di references/rls-supabase.md: tenant con ruoli di ambito diverso.
-- Le due condizioni stanno DENTRO la stessa espressione: due policy separate si
-- sommerebbero in OR e il veterinario di sede vedrebbe tutte e tre le cliniche.
create or replace function public.puo_vedere_clinica(clinica uuid)
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
      and (s.job_title = 'direttore' or s.clinic_id = clinica)
);
$$;

-- ------------------------------------------------------------------- 6. RLS
alter table public.species enable row level security;
alter table public.species force row level security;
alter table public.clinics enable row level security;
alter table public.clinics force row level security;
alter table public.staff enable row level security;
alter table public.staff force row level security;
alter table public.owners enable row level security;
alter table public.owners force row level security;
alter table public.owner_staff_flags enable row level security;
alter table public.owner_staff_flags force row level security;
alter table public.animals enable row level security;
alter table public.animals force row level security;

-- species: lookup pubblico. `using (true)` DOCUMENTATO nell'handoff: e' una
-- tabella di codici (cane, gatto, coniglio), non contiene dati di nessuno.
create policy specie_visibili_a_tutti on public.species
for select to anon, authenticated using (true);

create policy specie_scritte_dalla_direzione on public.species
for all to authenticated using (public.e_staff())
with check (public.e_staff());

-- clinics: sedi e recapiti sono informazione pubblica del sito.
create policy sedi_attive_visibili_a_tutti on public.clinics
for select to anon, authenticated using (is_active);

create policy sedi_scritte_dallo_staff on public.clinics
for all to authenticated using (public.e_staff())
with check (public.e_staff());

-- staff: nome, sede e ruolo servono al proprietario per scegliere il
-- veterinario.
-- Nessuna colonna riservata su questa tabella (niente compensi, niente note):
-- se ne servisse una, va in un'altra tabella (§La RLS e' per riga).
create policy personale_attivo_visibile_agli_utenti on public.staff
for select to authenticated using (is_active);

create policy personale_gestito_dalla_direzione on public.staff
for all to authenticated
using (public.e_staff() and public.puo_vedere_clinica(clinic_id))
with check (public.e_staff() and public.puo_vedere_clinica(clinic_id));

-- owners: il cliente vede se stesso, lo staff vede l'anagrafica delle tre sedi
-- (una societa' sola: un animale curato a Novara ha la scheda aperta a Biella).
create policy cliente_legge_se_stesso on public.owners
for select to authenticated using (id = public.mio_owner_id());

create policy cliente_aggiorna_i_propri_recapiti on public.owners
for update to authenticated
using (id = public.mio_owner_id())
with check (id = public.mio_owner_id());

create policy staff_legge_l_anagrafica_clienti on public.owners
for select to authenticated using (public.e_staff());

create policy staff_scrive_l_anagrafica_clienti on public.owners
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_l_anagrafica_clienti on public.owners
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

-- owner_staff_flags: solo staff, in lettura e in scrittura. Il proprietario non
-- ha alcuna policy su questa tabella: deny-by-default.
create policy contrassegni_interni_solo_allo_staff on public.owner_staff_flags
for all to authenticated using (public.e_staff())
with check (public.e_staff());

-- animals
create policy cliente_legge_i_propri_animali on public.animals
for select to authenticated using (owner_id = public.mio_owner_id());

create policy cliente_registra_i_propri_animali on public.animals
for insert to authenticated with check (owner_id = public.mio_owner_id());

create policy cliente_aggiorna_i_propri_animali on public.animals
for update to authenticated
using (owner_id = public.mio_owner_id())
with check (owner_id = public.mio_owner_id());

create policy staff_legge_tutti_gli_animali on public.animals
for select to authenticated using (public.e_staff());

create policy staff_scrive_gli_animali on public.animals
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_gli_animali on public.animals
for update to authenticated
using (public.e_staff()) with check (public.e_staff());
