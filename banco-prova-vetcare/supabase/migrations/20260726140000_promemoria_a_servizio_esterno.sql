-- VetCare Nord — i promemoria vaccinali passano a un servizio esterno.
--
-- Un motivo solo per file: qui si rimuove `reminders`. Il distruttivo sui
-- contrassegni interni sta nella migrazione successiva, perche' ha un'altra
-- causa (richiesta del legale) e va potuto leggere separatamente.
--
-- Analisi di impatto (2026-07-26, dati veri):
--   34 righe, di cui 30 con `sent_at` valorizzato — cioe' promemoria GIA'
--   INVIATI. Riportato al committente PRIMA di procedere: `reminders` non era
--   una coda, era il registro degli invii. Il servizio esterno prende in
--   carico solo i 4 ancora da mandare.
--   Consumatori: nessun codice applicativo (Fly UI non esiste ancora), 1
--   policy, 0 chiavi esterne entranti, 0 viste, 0 funzioni.
--
-- ROLLBACK:
-- -- IRREVERSIBILE: perdita delle 34 righe di `reminders`, comprese le 30
-- -- gia' inviate. Dati esportati in docs/export/promemoria-2026-07-26.csv
-- -- (unica copia: il committente ha scelto il CSV invece di una tabella di
-- -- archivio).

set lock_timeout = '5s';
set statement_timeout = '60s';

-- Distruttivo AUTORIZZATO: checkpoint umano superato il 2026-07-26,
-- dati esportati in docs/export/promemoria-2026-07-26.csv.
-- squawk-ignore ban-drop-table
drop table public.reminders;
