-- Bottega Nord — contenuti editabili dal cliente (eredita' del CMS caduto).
--
-- I testi e le immagini delle sezioni del sito stanno qui, non in un CMS
-- esterno: Sanity Creator e' stato cancellato dalla pipeline, e chi non ha un
-- posto dove scrivere i contenuti finisce per scriverli nel codice.
--
-- ROLLBACK:
--   drop table public.site_content;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabella
create table public.site_content (
    id uuid primary key default gen_random_uuid(),
    slot text not null unique check (length(slot) <= 60),
    title text not null check (length(title) <= 160),
    body text not null check (length(body) <= 4000),
    image_url text check (length(image_url) <= 500),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indice
create index site_content_is_published_idx
on public.site_content (is_published);

-- ------------------------------------------------------ 3. trigger updated_at
create trigger site_content_updated_at before update on public.site_content
for each row execute function public.tocca_updated_at();

-- ------------------------------------------------------------------- 4. RLS
alter table public.site_content enable row level security;
alter table public.site_content force row level security;

-- ------------------------------------------------------------------ 5. policy
-- Solo il pubblicato esce dalla chiave anonima: una bozza e' un testo che il
-- cliente non ha ancora deciso di mostrare.
create policy contenuti_pubblicati_visibili_a_tutti on public.site_content
for select to anon, authenticated using (is_published);

create policy contenuti_letti_dallo_staff on public.site_content
for select to authenticated using (public.e_staff());

create policy contenuti_scritti_dal_redattore on public.site_content
for insert to authenticated with check (
    public.ha_ruolo('redattore') or public.ha_ruolo('titolare')
);

create policy contenuti_aggiornati_dal_redattore on public.site_content
for update to authenticated
using (public.ha_ruolo('redattore') or public.ha_ruolo('titolare'))
with check (public.ha_ruolo('redattore') or public.ha_ruolo('titolare'));

create policy contenuti_cancellati_dal_titolare on public.site_content
for delete to authenticated using (public.ha_ruolo('titolare'));

-- -------------------------------------------------------------- 6. grant
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
