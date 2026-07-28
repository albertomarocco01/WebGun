-- VetCare Nord — prestazioni e listini.
--
-- Due tipi di cliente con prezzi diversi: il prezzo NON e' un attributo della
-- prestazione. references/pattern-ecommerce.md §Listini — la regola e' scritta
-- per l'e-commerce ma il motivo (sicurezza + evoluzione) non ha niente di
-- commerciale: un prezzo riservato in una colonna leggibile e' un prezzo
-- pubblico, e il terzo listino dev'essere un `insert`, non una migrazione.
--
-- ROLLBACK:
--   drop table public.price_list_items, public.price_lists, public.services;
--   drop function public.mio_listino, public.e_mio_listino;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
create table public.services (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (length(code) <= 40),
    name text not null check (length(name) <= 120),
    description text check (length(description) <= 1000),
    -- listino base, quello pubblico dei privati. bigint di centesimi:
    -- references/modellazione.md, riga *Denaro*.
    base_price_cents bigint not null check (base_price_cents >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Un listino per contratto (risposta J del committente: «uno ciascuno»).
-- `owner_id` nullo = listino pubblico dei privati.
create table public.price_lists (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid references public.owners (id) on delete cascade,
    name text not null check (length(name) <= 120),
    valid_from date not null,
    valid_to date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (valid_to is null or valid_to > valid_from)
);

create table public.price_list_items (
    id uuid primary key default gen_random_uuid(),
    price_list_id uuid not null
    references public.price_lists (id) on delete cascade,
    service_id uuid not null
    references public.services (id) on delete restrict,
    price_cents bigint not null check (price_cents >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (price_list_id, service_id)
);

-- ---------------------------------------------------------------- 2. indici
create index price_lists_owner_id_idx on public.price_lists (owner_id);
create index price_list_items_price_list_id_idx
on public.price_list_items (price_list_id);
create index price_list_items_service_id_idx
on public.price_list_items (service_id);

-- --------------------------------------------------------------- 3. trigger
create trigger services_updated_at before update on public.services
for each row execute function public.tocca_updated_at();

create trigger price_lists_updated_at before update on public.price_lists
for each row execute function public.tocca_updated_at();

create trigger price_list_items_updated_at
before update on public.price_list_items
for each row execute function public.tocca_updated_at();

-- ------------------------------------------------------- 4. funzioni di RLS
-- Il cliente vede il PROPRIO listino e quello pubblico, mai quello di un altro
-- allevamento: il prezzo negoziato del concorrente e' un dato riservato.
create or replace function public.e_mio_listino(listino uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.price_lists pl
    where pl.id = listino
      and (pl.owner_id is null or pl.owner_id = public.mio_owner_id())
);
$$;

-- ------------------------------------------------------------------- 5. RLS
alter table public.services enable row level security;
alter table public.services force row level security;
alter table public.price_lists enable row level security;
alter table public.price_lists force row level security;
alter table public.price_list_items enable row level security;
alter table public.price_list_items force row level security;

create policy prestazioni_attive_visibili_a_tutti on public.services
for select to anon, authenticated using (is_active);

create policy prestazioni_gestite_dallo_staff on public.services
for all to authenticated using (public.e_staff())
with check (public.e_staff());

create policy cliente_legge_il_proprio_listino on public.price_lists
for select to authenticated
using (owner_id is null or owner_id = public.mio_owner_id());

create policy staff_legge_tutti_i_listini on public.price_lists
for select to authenticated using (public.e_staff());

create policy staff_gestisce_i_listini on public.price_lists
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_i_listini on public.price_lists
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy cliente_legge_le_righe_del_proprio_listino
on public.price_list_items
for select to authenticated using (public.e_mio_listino(price_list_id));

create policy staff_legge_le_righe_di_ogni_listino
on public.price_list_items
for select to authenticated using (public.e_staff());

create policy staff_scrive_le_righe_di_listino on public.price_list_items
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_le_righe_di_listino on public.price_list_items
for update to authenticated
using (public.e_staff()) with check (public.e_staff());
