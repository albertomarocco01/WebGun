-- Bottega Nord — catalogo: categorie, prodotti, varianti.
--
-- ROLLBACK:
--   drop table public.product_variants, public.products, public.categories;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
create table public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(name) <= 80),
    slug text not null unique check (length(slug) <= 80),
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null
    references public.categories (id) on delete restrict,
    name text not null check (length(name) <= 160),
    slug text not null unique check (length(slug) <= 160),
    description text check (length(description) <= 4000),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Prodotto != variante: e' cio' che si compra davvero a portare prezzo e
-- giacenza (references/pattern-ecommerce.md). Il denaro sta in `bigint` di
-- centesimi: in centesimi `integer` si ferma a 21.474.836,47 euro.
-- Magazzino su una colonna e non su una tabella di movimenti: un magazzino
-- solo, nessuna riserva di carrello. Deroga dichiarata nell'handoff.
create table public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products (id) on delete restrict,
    sku text not null unique check (length(sku) <= 40),
    size text not null check (length(size) <= 20),
    price_cents bigint not null check (price_cents >= 0),
    quantity bigint not null default 0 check (quantity >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index products_category_id_idx on public.products (category_id);
create index products_is_published_idx on public.products (is_published);
create index product_variants_product_id_idx
on public.product_variants (product_id);

-- ------------------------------------------------------ 3. trigger updated_at
create trigger categories_updated_at before update on public.categories
for each row execute function public.tocca_updated_at();

create trigger products_updated_at before update on public.products
for each row execute function public.tocca_updated_at();

create trigger product_variants_updated_at
before update on public.product_variants
for each row execute function public.tocca_updated_at();

-- ------------------------------------------------------------------- 4. RLS
alter table public.categories enable row level security;
alter table public.categories force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;

-- ------------------------------------------------------------------ 5. policy
create policy categorie_visibili_a_tutti on public.categories
for select to anon, authenticated using (is_visible);

create policy categorie_scritte_dallo_staff on public.categories
for all to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy prodotti_pubblicati_visibili_a_tutti on public.products
for select to anon, authenticated using (is_published);

create policy prodotti_scritti_dallo_staff on public.products
for all to authenticated
using (public.e_staff()) with check (public.e_staff());

-- La variante e' leggibile solo se il prodotto e' pubblicato: il prezzo di una
-- bozza non deve uscire dalla chiave anonima.
create policy varianti_dei_prodotti_pubblicati on public.product_variants
for select to anon, authenticated using (
    exists (
        select 1
        from public.products as p
        where p.id = product_variants.product_id and p.is_published
    )
);

create policy varianti_scritte_dallo_staff on public.product_variants
for all to authenticated
using (public.e_staff()) with check (public.e_staff());

-- -------------------------------------------------------------- 6. grant
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
