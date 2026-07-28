-- VetCare Nord — via i contrassegni interni sui clienti (richiesta del legale).
--
-- Il committente aveva chiesto di togliere la sola colonna `is_difficult`.
-- L'analisi di impatto ha mostrato che non basta: **3 righe su 3** avevano
-- anche `note` compilata, e la nota ripeteva lo stesso giudizio in prosa
-- («contesta sempre il preventivo in sala d'attesa»). Cancellare il booleano e
-- lasciare la nota non raggiunge lo scopo dichiarato — rende solo il dato piu'
-- difficile da trovare. Riportato al committente, che ha autorizzato la
-- rimozione dell'INTERA tabella.
--
-- Consumatori: nessun codice applicativo, 1 policy, 0 chiavi esterne entranti,
-- 0 viste, 0 funzioni. Il test pgTAP che verificava l'inaccessibilita' della
-- tabella al cliente e' stato rimosso insieme alla tabella.
--
-- ROLLBACK:
-- -- IRREVERSIBILE: perdita delle 3 righe di `owner_staff_flags`, colonna
-- -- `note` compresa. Dati esportati in
-- -- docs/export/contrassegni-clienti-2026-07-26.csv.

set lock_timeout = '5s';
set statement_timeout = '60s';

-- Distruttivo AUTORIZZATO: checkpoint umano superato il 2026-07-26,
-- dati esportati in docs/export/contrassegni-clienti-2026-07-26.csv.
-- squawk-ignore ban-drop-table
drop table public.owner_staff_flags;
