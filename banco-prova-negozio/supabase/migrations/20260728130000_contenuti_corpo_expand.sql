-- Bottega Nord — evolve, passo EXPAND: `site_content.body` diventa `corpo`.
--
-- Il cliente ha chiesto i nomi delle colonne in italiano come il resto del
-- dominio. Expand-contract: qui si aggiunge e si popola, la colonna vecchia
-- resta viva finche' i consumatori non sono spostati.
--
-- I vincoli nascono `not valid` e si convalidano subito dopo: `set not null` e
-- un `check` diretto prendono un ACCESS EXCLUSIVE che blocca le letture per
-- tutta la scansione della tabella. Su due righe non si vede; la forma giusta
-- si scrive quando non serve, o non la si impara mai.
--
-- ROLLBACK: alter table public.site_content drop column corpo;

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.site_content add column corpo text;

update public.site_content set corpo = body
where corpo is null;

alter table public.site_content
add constraint site_content_corpo_presente check (corpo is not null) not valid;

alter table public.site_content validate constraint site_content_corpo_presente;

alter table public.site_content
add constraint site_content_corpo_lungo check (length(corpo) <= 4000) not valid;

alter table public.site_content validate constraint site_content_corpo_lungo;
