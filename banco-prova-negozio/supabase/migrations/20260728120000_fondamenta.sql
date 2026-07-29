-- Bottega Nord — fondamenta: personale, clienti, funzioni di contesto.
--
-- ROLLBACK:
--   drop table public.customers, public.staff;
--   drop function public.cambia_ruolo, public.e_staff, public.ha_ruolo,
--                 public.mio_customer_id, public.tocca_updated_at;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
-- Il ruolo NON e' scrivibile da chi possiede la riga: il `grant update` in
-- fondo al file e' PER COLONNA (`full_name`, `phone`), e il cambio di ruolo
-- passa dalla funzione `cambia_ruolo`. references/rls-supabase.md §Il caso
-- peggiore: la RLS filtra righe, non colonne.
create table public.staff (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique
    references auth.users (id) on delete restrict,
    full_name text not null check (length(full_name) <= 120),
    phone text check (length(phone) <= 40),
    ruolo text not null
    check (ruolo in ('titolare', 'magazziniere', 'redattore')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Il cliente esiste anche senza account: chi ordina per telefono non si
-- registra, e va fatturato lo stesso (references/pattern-ecommerce.md
-- §Clienti). `auth_user_id` e' quindi FACOLTATIVO, con la conseguenza scritta:
-- nessuna policy per `authenticated` raggiunge una riga con `auth_user_id`
-- nullo, perche' `null = null` non e' vero. Quei clienti li vede solo lo staff.
create table public.customers (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique references auth.users (id) on delete set null,
    full_name text not null check (length(full_name) <= 160),
    email text check (length(email) <= 160),
    phone text check (length(phone) <= 40),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index staff_auth_user_id_idx on public.staff (auth_user_id);
create index customers_auth_user_id_idx on public.customers (auth_user_id);

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

create trigger customers_updated_at before update on public.customers
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

-- Il ruolo si legge da qui, mai da una colonna che l'utente aggiorna e mai da
-- `user_metadata`: references/rls-supabase.md, pattern 4.
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

create or replace function public.mio_customer_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
select c.id
from public.customers c
where c.auth_user_id = (select auth.uid());
$$;

-- Postgres concede `execute` a PUBLIC per DEFAULT: senza queste righe ognuna di
-- queste funzioni e' un endpoint chiamabile da `anon` che scavalca la RLS.
revoke execute on function public.e_staff() from public;
revoke execute on function public.ha_ruolo(text) from public;
revoke execute on function public.mio_customer_id() from public;
grant execute on function public.e_staff() to authenticated;
grant execute on function public.ha_ruolo(text) to authenticated;
grant execute on function public.mio_customer_id() to authenticated;

-- ------------------------------------------------------------------- 5. RLS
alter table public.staff enable row level security;
alter table public.staff force row level security;
alter table public.customers enable row level security;
alter table public.customers force row level security;

-- ------------------------------------------------------------------ 6. policy
create policy personale_legge_se_stesso on public.staff
for select to authenticated using (auth_user_id = (select auth.uid()));

create policy personale_visibile_allo_staff on public.staff
for select to authenticated using (public.e_staff());

create policy personale_aggiorna_i_propri_recapiti on public.staff
for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy personale_assunto_dal_titolare on public.staff
for insert to authenticated with check (public.ha_ruolo('titolare'));

create policy personale_corretto_dal_titolare on public.staff
for update to authenticated
using (public.ha_ruolo('titolare'))
with check (public.ha_ruolo('titolare'));

create policy personale_licenziato_dal_titolare on public.staff
for delete to authenticated using (public.ha_ruolo('titolare'));

create policy cliente_legge_se_stesso on public.customers
for select to authenticated using (id = public.mio_customer_id());

create policy cliente_aggiorna_i_propri_recapiti on public.customers
for update to authenticated
using (id = public.mio_customer_id())
with check (id = public.mio_customer_id());

create policy staff_legge_l_anagrafica on public.customers
for select to authenticated using (public.e_staff());

create policy staff_registra_un_cliente on public.customers
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_l_anagrafica on public.customers
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

-- -------------------------------------------------------------- 7. grant
-- `update` PER COLONNA su `staff`: la policy autorizza la riga intera, quindi
-- senza questa riga chiunque sia nello staff si riscrive il proprio `ruolo`.
-- Verificato in Postgres: l'update di una colonna esclusa riceve
-- *permission denied for table*.
grant select, insert, delete on public.staff to authenticated;
grant update (full_name, phone) on public.staff to authenticated;

grant select, insert, update on public.customers to authenticated;

-- ------------------------------------------------- 8. cambio di ruolo (RPC)
-- L'unica strada per cambiare un ruolo. E' `security definer` perche' il
-- `grant update` per colonna nega la scrittura di `ruolo` a chiunque: gli
-- argomenti li sceglie il chiamante, quindi si validano tutti
-- (references/rls-supabase.md §Gli argomenti di un RPC).
create or replace function public.cambia_ruolo(persona uuid, nuovo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.ha_ruolo('titolare') then
        raise exception 'solo il titolare cambia i ruoli';
    end if;
    if nuovo is null
        or nuovo not in ('titolare', 'magazziniere', 'redattore') then
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
