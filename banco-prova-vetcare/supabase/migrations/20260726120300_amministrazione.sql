-- VetCare Nord — fatturazione.
--
-- Lo stato dell'INCASSO e' indipendente dallo stato della VISITA: gli
-- allevamenti convenzionati ricevono la fattura a fine mese, quindi la
-- prestazione e' erogata prima del pagamento. Unire le due macchine a stati
-- costringerebbe a mentire allo schema — references/pattern-ecommerce.md,
-- §Ordini, capoverso sul pagamento differito.
--
-- Le righe di fattura sono uno SNAPSHOT: nome della prestazione e prezzo si
-- COPIANO al momento dell'emissione. Leggendoli dal listino, il giorno in cui
-- l'allevamento rinegozia il contratto cambierebbero le fatture gia' emesse
-- (references/pattern-ecommerce.md, «regola d'oro»).
--
-- ROLLBACK:
--   drop table public.invoice_lines, public.invoices;
--   drop function public.fattura_emessa_non_si_tocca;

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------- 1. tabelle
create table public.invoices (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.owners (id) on delete restrict,
    number text not null unique check (length(number) <= 40),
    issued_on date not null,
    due_on date not null,
    -- macchina a stati dell'INCASSO, separata da quella della visita
    status text not null default 'emessa'
    check (status in ('emessa', 'pagata', 'scaduta', 'annullata')),
    paid_at timestamptz,
    -- periodo coperto: una fattura di allevamento raccoglie un mese di visite
    period_start date,
    period_end date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (due_on >= issued_on),
    check (period_end is null or period_end >= period_start)
);

create table public.invoice_lines (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null
    references public.invoices (id) on delete cascade,
    -- una visita si fattura una volta sola
    visit_id uuid not null unique
    references public.visits (id) on delete restrict,
    service_name text not null check (length(service_name) <= 120),
    unit_price_cents bigint not null check (unit_price_cents >= 0),
    quantity bigint not null default 1 check (quantity > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- 2. indici
create index invoices_owner_id_idx on public.invoices (owner_id);
create index invoices_status_idx on public.invoices (status, due_on);
create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);

-- --------------------------------------------------------------- 3. trigger
create trigger invoices_updated_at before update on public.invoices
for each row execute function public.tocca_updated_at();

create trigger invoice_lines_updated_at before update on public.invoice_lines
for each row execute function public.tocca_updated_at();

-- Trigger di DOMINIO: una fattura pagata (o annullata) non cambia importo.
-- Nota per il seed: questo trigger scatta anche sotto `on conflict do nothing`,
-- perche' i trigger BEFORE si eseguono PRIMA che il conflitto sia rilevato.
-- references/modellazione.md §Seed.
create or replace function public.fattura_emessa_non_si_tocca()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    stato text;
begin
    select i.status into stato
    from public.invoices i
    where i.id = new.invoice_id;

    if stato is distinct from 'emessa' then
        raise exception
            'la fattura % non e'' piu'' modificabile (stato: %)',
            new.invoice_id, stato;
    end if;

    return new;
end;
$$;

create trigger invoice_lines_solo_su_fattura_emessa
before insert or update on public.invoice_lines
for each row execute function public.fattura_emessa_non_si_tocca();

-- ------------------------------------------------------- 4. funzione di RLS
create or replace function public.mia_fattura(fattura uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
select exists (
    select 1
    from public.invoices i
    where i.id = fattura and i.owner_id = public.mio_owner_id()
);
$$;

-- ------------------------------------------------------------------- 5. RLS
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_lines force row level security;

create policy cliente_legge_le_proprie_fatture on public.invoices
for select to authenticated using (owner_id = public.mio_owner_id());

create policy staff_legge_le_fatture on public.invoices
for select to authenticated using (public.e_staff());

create policy staff_emette_le_fatture on public.invoices
for insert to authenticated with check (public.e_staff());

create policy staff_aggiorna_le_fatture on public.invoices
for update to authenticated
using (public.e_staff()) with check (public.e_staff());

create policy cliente_legge_le_righe_delle_proprie_fatture
on public.invoice_lines
for select to authenticated using (public.mia_fattura(invoice_id));

create policy staff_legge_le_righe_di_fattura on public.invoice_lines
for select to authenticated using (public.e_staff());

create policy staff_scrive_le_righe_di_fattura on public.invoice_lines
for insert to authenticated with check (public.e_staff());

create policy staff_corregge_le_righe_di_fattura on public.invoice_lines
for update to authenticated
using (public.e_staff()) with check (public.e_staff());
