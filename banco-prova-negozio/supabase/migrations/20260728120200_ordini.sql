-- Bottega Nord — ordini: testata, righe, macchina a stati.
--
-- ROLLBACK:
--   drop table public.order_items, public.orders;
--   drop function public.transizione_ordine;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
-- `on delete restrict` sul cliente: chi cancella l'account non porta via la
-- storia fiscale. L'indirizzo e' COPIATO, non referenziato: l'ordine e' uno
-- snapshot, non una vista sul presente (references/pattern-ecommerce.md).
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null
    references public.customers (id) on delete restrict,
    status text not null default 'in_attesa'
    check (
        status in (
            'in_attesa', 'confermato', 'spedito', 'consegnato', 'annullato'
        )
    ),
    total_cents bigint not null default 0 check (total_cents >= 0),
    shipping_name text not null check (length(shipping_name) <= 160),
    shipping_address text not null check (length(shipping_address) <= 240),
    shipping_city text not null check (length(shipping_city) <= 80),
    placed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete restrict,
    variant_id uuid not null
    references public.product_variants (id) on delete restrict,
    quantity bigint not null check (quantity > 0),
    unit_price_cents bigint not null check (unit_price_cents >= 0),
    product_name text not null check (length(product_name) <= 160),
    variant_name text not null check (length(variant_name) <= 40),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

-- ------------------------------------------------------ 3. trigger updated_at
create trigger orders_updated_at before update on public.orders
for each row execute function public.tocca_updated_at();

create trigger order_items_updated_at before update on public.order_items
for each row execute function public.tocca_updated_at();

-- ------------------------------------------------- 4. macchina a stati
-- Il trigger scatta anche su `insert`, non solo su `update`: un vincolo di
-- transizione non dice niente su da quale stato si possa PARTIRE, e un `check`
-- che enumera il dominio ammette proprio lo stato che si vuole vietare
-- (references/rls-supabase.md §Macchine a stati).
create or replace function public.transizione_ordine()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if new.status <> 'in_attesa' then
            raise exception 'un ordine nasce in_attesa, non % ', new.status;
        end if;
        return new;
    end if;

    if old.status = new.status then
        return new;
    end if;

    if not (
        (old.status = 'in_attesa'
            and new.status in ('confermato', 'annullato'))
        or (old.status = 'confermato'
            and new.status in ('spedito', 'annullato'))
        or (old.status = 'spedito' and new.status = 'consegnato')
    ) then
        raise exception
        'transizione non ammessa: % -> %', old.status, new.status;
    end if;

    return new;
end;
$$;

create trigger orders_transizione
before insert or update on public.orders
for each row execute function public.transizione_ordine();

-- ------------------------------------------------------------------- 5. RLS
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;

-- ------------------------------------------------------------------ 6. policy
-- Il cliente legge i propri ordini e non li modifica: il prezzo e lo stato non
-- si decidono dal browser (references/pattern-ecommerce.md §Modello di
-- accesso). Nessuna policy di `update`/`delete` per il cliente:
-- deny-by-default.
create policy cliente_legge_i_propri_ordini on public.orders
for select to authenticated using (customer_id = public.mio_customer_id());

create policy staff_legge_gli_ordini on public.orders
for select to authenticated using (public.e_staff());

create policy staff_scrive_gli_ordini on public.orders
for insert to authenticated with check (public.e_staff());

create policy staff_aggiorna_gli_ordini on public.orders
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy cliente_legge_le_proprie_righe on public.order_items
for select to authenticated using (
    exists (
        select 1
        from public.orders as o
        where
            o.id = order_items.order_id
            and o.customer_id = public.mio_customer_id()
    )
);

create policy staff_legge_le_righe on public.order_items
for select to authenticated using (public.e_staff());

create policy staff_scrive_le_righe on public.order_items
for insert to authenticated with check (public.e_staff());

create policy staff_aggiorna_le_righe on public.order_items
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy staff_cancella_le_righe on public.order_items
for delete to authenticated using (public.e_staff());

-- -------------------------------------------------------------- 7. grant
grant select, insert, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
