-- VetCare Nord — visite e cartella clinica.
--
-- Due cose che il dominio impone e che nessun pattern di riferimento copre:
--  1. la cartella clinica e' un DOCUMENTO LEGALE: la versione precedente
--     finisce in `medical_record_revisions` con un trigger;
--  2. due prenotazioni sullo stesso veterinario alla stessa ora vogliono un
--     vincolo di ESCLUSIONE su un intervallo (btree_gist), non un `unique`.
--
-- ROLLBACK:
--   drop view public.v_cartella_animale;
--   drop table public.reminders, public.vaccinations, public.internal_notes,
--              public.prescriptions, public.treatments, public.diagnoses,
--              public.medical_record_revisions, public.medical_records,
--              public.visits;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
create table public.visits (
    id uuid primary key default gen_random_uuid(),
    animal_id uuid not null
    references public.animals (id) on delete restrict,
    clinic_id uuid not null
    references public.clinics (id) on delete restrict,
    staff_id uuid not null,
    service_id uuid not null
    references public.services (id) on delete restrict,
    scheduled_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'prenotata'
    check (
        status in (
            'prenotata', 'confermata', 'eseguita', 'fatturata', 'annullata'
        )
    ),
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at > scheduled_at),
    -- un veterinario appartiene a una sede: la visita non puo' assegnarlo a
    -- un'altra. Chiave esterna COMPOSITA verso `staff (id, clinic_id)`.
    foreign key (staff_id, clinic_id)
    references public.staff (id, clinic_id) on delete restrict,
    -- «due proprietari non prenotano lo stesso veterinario alla stessa ora»
    -- (risposta K del committente). Un `unique` non basta: le ore si
    -- SOVRAPPONGONO, non coincidono.
    exclude using gist (
        staff_id with =,
        tstzrange(scheduled_at, ends_at) with &&
    ) where (status <> 'annullata')
);

create table public.medical_records (
    id uuid primary key default gen_random_uuid(),
    visit_id uuid not null unique
    references public.visits (id) on delete restrict,
    created_by uuid not null references public.staff (id) on delete restrict,
    clinical_summary text not null check (length(clinical_summary) <= 4000),
    -- «quello che il proprietario puo' leggere»: sta qui perche' la riga e'
    -- gia' leggibile dal proprietario. Le note interne NO: tabella separata.
    owner_note text check (length(owner_note) <= 4000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Append-only: ci scrive solo il trigger, nessuno la aggiorna.
create table public.medical_record_revisions (
    id uuid primary key default gen_random_uuid(),
    medical_record_id uuid not null
    references public.medical_records (id) on delete restrict,
    clinical_summary text not null,
    owner_note text,
    replaced_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.diagnoses (
    id uuid primary key default gen_random_uuid(),
    medical_record_id uuid not null
    references public.medical_records (id) on delete cascade,
    code text check (length(code) <= 40),
    description text not null check (length(description) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.treatments (
    id uuid primary key default gen_random_uuid(),
    medical_record_id uuid not null
    references public.medical_records (id) on delete cascade,
    description text not null check (length(description) <= 1000),
    administered_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.prescriptions (
    id uuid primary key default gen_random_uuid(),
    medical_record_id uuid not null
    references public.medical_records (id) on delete cascade,
    drug_name text not null check (length(drug_name) <= 160),
    dosage text not null check (length(dosage) <= 240),
    duration_days bigint check (duration_days > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Riservatezza per colonna → tabella separata con la sua RLS. Il proprietario
-- non ha NESSUNA policy qui dentro: deny-by-default.
create table public.internal_notes (
    id uuid primary key default gen_random_uuid(),
    medical_record_id uuid not null
    references public.medical_records (id) on delete cascade,
    author_staff_id uuid not null
    references public.staff (id) on delete restrict,
    body text not null check (length(body) <= 4000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.vaccinations (
    id uuid primary key default gen_random_uuid(),
    animal_id uuid not null
    references public.animals (id) on delete restrict,
    visit_id uuid references public.visits (id) on delete set null,
    vaccine_name text not null check (length(vaccine_name) <= 160),
    administered_on date not null,
    next_due_on date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (next_due_on is null or next_due_on > administered_on)
);

create table public.reminders (
    id uuid primary key default gen_random_uuid(),
    vaccination_id uuid not null
    references public.vaccinations (id) on delete cascade,
    due_at timestamptz not null,
    channel text not null check (channel in ('email', 'sms')),
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index visits_animal_id_idx on public.visits (animal_id);
create index visits_clinic_id_idx on public.visits (clinic_id);
create index visits_staff_id_idx on public.visits (staff_id, scheduled_at);
create index visits_service_id_idx on public.visits (service_id);
create index visits_status_idx on public.visits (status, scheduled_at);
create index medical_records_created_by_idx
on public.medical_records (created_by);
create index medical_record_revisions_record_idx
on public.medical_record_revisions (medical_record_id);
create index diagnoses_record_idx on public.diagnoses (medical_record_id);
create index treatments_record_idx on public.treatments (medical_record_id);
create index prescriptions_record_idx on public.prescriptions (
    medical_record_id
);
create index internal_notes_record_idx on public.internal_notes (
    medical_record_id
);
create index internal_notes_author_idx on public.internal_notes (
    author_staff_id
);
create index vaccinations_animal_id_idx on public.vaccinations (animal_id);
create index vaccinations_visit_id_idx on public.vaccinations (visit_id);
create index reminders_vaccination_id_idx on public.reminders (vaccination_id);

-- --------------------------------------------------------- 3. trigger e regole
create trigger visits_updated_at before update on public.visits
for each row execute function public.tocca_updated_at();

create trigger medical_records_updated_at
before update on public.medical_records
for each row execute function public.tocca_updated_at();

create trigger diagnoses_updated_at before update on public.diagnoses
for each row execute function public.tocca_updated_at();

create trigger treatments_updated_at before update on public.treatments
for each row execute function public.tocca_updated_at();

create trigger prescriptions_updated_at before update on public.prescriptions
for each row execute function public.tocca_updated_at();

create trigger internal_notes_updated_at before update on public.internal_notes
for each row execute function public.tocca_updated_at();

create trigger vaccinations_updated_at before update on public.vaccinations
for each row execute function public.tocca_updated_at();

create trigger reminders_updated_at before update on public.reminders
for each row execute function public.tocca_updated_at();

-- Macchina a stati: le transizioni illegali si bloccano nel database, non nel
-- frontend (references/modellazione.md §Vincoli). La finestra di 24 ore non
-- puo' stare in un `check`: `now()` non e' immutabile.
create or replace function public.visite_transizione_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status = old.status then
        return new;
    end if;

    if not (
        (old.status = 'prenotata'
            and new.status in ('confermata', 'annullata'))
        or (old.status = 'confermata'
            and new.status in ('eseguita', 'annullata'))
        or (old.status = 'eseguita' and new.status = 'fatturata')
    ) then
        raise exception
            'transizione di stato non ammessa: % -> %', old.status, new.status;
    end if;

    if new.status = 'annullata'
        and old.scheduled_at - now() < interval '24 hours' then
        raise exception
            'una visita si annulla fino a 24 ore prima (inizio: %)',
            old.scheduled_at;
    end if;

    if new.status = 'annullata' then
        new.cancelled_at := now();
    end if;

    return new;
end;
$$;

create trigger visits_transizione before update on public.visits
for each row execute function public.visite_transizione_valida();

-- La cartella clinica e' un documento legale: la versione precedente non si
-- perde. Il trigger e' l'unico che scrive in `medical_record_revisions`.
create or replace function public.archivia_versione_cartella()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.clinical_summary is distinct from old.clinical_summary
        or new.owner_note is distinct from old.owner_note then
        insert into public.medical_record_revisions
            (medical_record_id, clinical_summary, owner_note)
        values (old.id, old.clinical_summary, old.owner_note);
    end if;
    return new;
end;
$$;

create trigger medical_records_archivio before update on public.medical_records
for each row execute function public.archivia_versione_cartella();

-- ------------------------------------------------------- 4. funzioni di RLS
create or replace function public.mia_visita(visita uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.visits v
    inner join public.animals a on a.id = v.animal_id
    where v.id = visita and a.owner_id = public.mio_owner_id()
);
$$;

create or replace function public.puo_vedere_visita(visita uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.visits v
    where v.id = visita and public.puo_vedere_clinica(v.clinic_id)
);
$$;

create or replace function public.mia_cartella(cartella uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.medical_records m
    where m.id = cartella and public.mia_visita(m.visit_id)
);
$$;

create or replace function public.puo_vedere_cartella(cartella uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.medical_records m
    where m.id = cartella and public.puo_vedere_visita(m.visit_id)
);
$$;

create or replace function public.mio_animale(animale uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.animals a
    where a.id = animale and a.owner_id = public.mio_owner_id()
);
$$;

-- Lo spostamento NON e' una policy di `update`: `with check` vede la riga, non
-- il campo modificato (references/rls-supabase.md §La RLS e' per riga, in
-- fondo). Con una policy di update il proprietario potrebbe cambiarsi anche
-- `status` e `service_id`. Percio' la scrittura passa da una funzione.
create or replace function public.sposta_visita(
    visita uuid, nuovo_inizio timestamptz, nuova_fine timestamptz
)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
    aggiornata public.visits;
begin
    if not public.mia_visita(visita) then
        raise exception 'visita non trovata';
    end if;

    update public.visits v
    set scheduled_at = nuovo_inizio, ends_at = nuova_fine
    where v.id = visita and v.status = 'prenotata'
    returning v.* into aggiornata;

    if aggiornata.id is null then
        raise exception
            'la visita e'' gia'' confermata: chiama la clinica per spostarla';
    end if;

    return aggiornata;
end;
$$;

-- ------------------------------------------------------------------- 5. RLS
alter table public.visits enable row level security;
alter table public.visits force row level security;
alter table public.medical_records enable row level security;
alter table public.medical_records force row level security;
alter table public.medical_record_revisions enable row level security;
alter table public.medical_record_revisions force row level security;
alter table public.diagnoses enable row level security;
alter table public.diagnoses force row level security;
alter table public.treatments enable row level security;
alter table public.treatments force row level security;
alter table public.prescriptions enable row level security;
alter table public.prescriptions force row level security;
alter table public.internal_notes enable row level security;
alter table public.internal_notes force row level security;
alter table public.vaccinations enable row level security;
alter table public.vaccinations force row level security;
alter table public.reminders enable row level security;
alter table public.reminders force row level security;

-- visits: il proprietario legge e prenota, ma NON aggiorna
-- (vedi sposta_visita).
create policy cliente_legge_le_proprie_visite on public.visits
for select to authenticated using (public.mio_animale(animal_id));

create policy cliente_prenota_per_i_propri_animali on public.visits
for insert to authenticated
with check (public.mio_animale(animal_id) and status = 'prenotata');

create policy staff_legge_le_visite_di_competenza on public.visits
for select to authenticated using (public.puo_vedere_clinica(clinic_id));

create policy staff_crea_visite_di_competenza on public.visits
for insert to authenticated
with check (public.puo_vedere_clinica(clinic_id));

create policy staff_aggiorna_le_visite_di_competenza on public.visits
for update to authenticated
using (public.puo_vedere_clinica(clinic_id))
with check (public.puo_vedere_clinica(clinic_id));

-- medical_records
create policy cliente_legge_la_cartella_dei_propri_animali
on public.medical_records
for select to authenticated using (public.mia_visita(visit_id));

create policy staff_legge_la_cartella_di_competenza on public.medical_records
for select to authenticated using (public.puo_vedere_visita(visit_id));

create policy staff_scrive_la_cartella_di_competenza on public.medical_records
for insert to authenticated with check (public.puo_vedere_visita(visit_id));

create policy staff_corregge_la_cartella_per_sempre on public.medical_records
for update to authenticated
using (public.puo_vedere_visita(visit_id))
with check (public.puo_vedere_visita(visit_id));

-- revisioni: solo staff, e nessuno le aggiorna (ci scrive il trigger).
create policy staff_legge_le_revisioni on public.medical_record_revisions
for select to authenticated
using (public.puo_vedere_cartella(medical_record_id));

-- diagnosi / trattamenti / prescrizioni: stessa visibilita' della cartella.
create policy cliente_legge_le_diagnosi on public.diagnoses
for select to authenticated using (public.mia_cartella(medical_record_id));

create policy staff_legge_le_diagnosi on public.diagnoses
for select to authenticated
using (public.puo_vedere_cartella(medical_record_id));

create policy staff_scrive_le_diagnosi on public.diagnoses
for insert to authenticated
with check (public.puo_vedere_cartella(medical_record_id));

create policy staff_corregge_le_diagnosi on public.diagnoses
for update to authenticated
using (public.puo_vedere_cartella(medical_record_id))
with check (public.puo_vedere_cartella(medical_record_id));

create policy cliente_legge_i_trattamenti on public.treatments
for select to authenticated using (public.mia_cartella(medical_record_id));

create policy staff_legge_i_trattamenti on public.treatments
for select to authenticated
using (public.puo_vedere_cartella(medical_record_id));

create policy staff_scrive_i_trattamenti on public.treatments
for insert to authenticated
with check (public.puo_vedere_cartella(medical_record_id));

create policy staff_corregge_i_trattamenti on public.treatments
for update to authenticated
using (public.puo_vedere_cartella(medical_record_id))
with check (public.puo_vedere_cartella(medical_record_id));

create policy cliente_legge_le_prescrizioni on public.prescriptions
for select to authenticated using (public.mia_cartella(medical_record_id));

create policy staff_legge_le_prescrizioni on public.prescriptions
for select to authenticated
using (public.puo_vedere_cartella(medical_record_id));

create policy staff_scrive_le_prescrizioni on public.prescriptions
for insert to authenticated
with check (public.puo_vedere_cartella(medical_record_id));

create policy staff_corregge_le_prescrizioni on public.prescriptions
for update to authenticated
using (public.puo_vedere_cartella(medical_record_id))
with check (public.puo_vedere_cartella(medical_record_id));

-- note interne: SOLO staff di competenza. Nessuna policy per il proprietario.
create policy note_interne_solo_allo_staff_di_competenza
on public.internal_notes
for all to authenticated
using (public.puo_vedere_cartella(medical_record_id))
with check (public.puo_vedere_cartella(medical_record_id));

-- vaccinazioni e promemoria
create policy cliente_legge_le_vaccinazioni_dei_suoi_animali
on public.vaccinations
for select to authenticated using (public.mio_animale(animal_id));

create policy staff_legge_le_vaccinazioni on public.vaccinations
for select to authenticated using (public.e_staff());

create policy staff_scrive_le_vaccinazioni on public.vaccinations
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_le_vaccinazioni on public.vaccinations
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy staff_gestisce_i_promemoria on public.reminders
for all to authenticated using (public.e_staff())
with check (public.e_staff());

-- --------------------------------------------- 6. vista per l'export GDPR
-- «Il proprietario deve poter scaricare la cartella completa del suo animale».
-- security_invoker = on: la vista gira coi diritti di CHI la interroga, quindi
-- la RLS delle tabelle sotto vale ancora. Le note interne non compaiono
-- (risposta H del committente).
create view public.v_cartella_animale
with (security_invoker = on) as
select
    a.id as animal_id,
    a.name as animal_name,
    v.id as visit_id,
    v.scheduled_at,
    v.status,
    c.name as clinic_name,
    m.id as medical_record_id,
    m.clinical_summary,
    m.owner_note,
    m.created_at as record_created_at
from public.animals as a
inner join public.visits as v on a.id = v.animal_id
inner join public.clinics as c on v.clinic_id = c.id
left join public.medical_records as m on v.id = m.visit_id;
