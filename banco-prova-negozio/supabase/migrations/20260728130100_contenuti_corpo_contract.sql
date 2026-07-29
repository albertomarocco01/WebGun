-- Bottega Nord — evolve, passo CONTRACT: via `site_content.body`.

set lock_timeout = '5s';
set statement_timeout = '60s';

-- Distruttivo AUTORIZZATO: checkpoint umano del 2026-07-28 (banco di prova),
-- dati esportati in docs/export/site_content-body-2026-07-28.csv.
-- squawk-ignore ban-drop-column
alter table public.site_content drop column body;
