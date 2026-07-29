-- Accademia Rossini — correzioni dai rilievi del tribunale (2026-07-28).
--
-- Due rilievi confermati da `/code-inquisition`, entrambi sul modello di
-- accesso, entrambi con la stessa forma: l'applicazione dichiarava un permesso
-- piu' stretto di quello che il database concedeva.
--
--  1. `is_active` era dentro il `grant update` per colonna. Ma `is_active` NON
--     e' un recapito: e' l'interruttore che spegne una persona, e lo leggono
--     sia `e_staff()` sia `ha_ruolo()`. Con quel grant, la policy
--     `personale_aggiorna_i_propri_recapiti` (che autorizza la propria riga)
--     permetteva a chi era stato disattivato di **riaccendersi da solo**.
--     Il codice non lo scriveva nemmeno: nessun modulo tocca `is_active`.
--
--  2. `personale_visibile_allo_staff` apriva l'INTERA riga di ogni collega a
--     ogni membro dello staff — `phone`, e soprattutto `auth_user_id`, che e'
--     l'identita' Supabase di quella persona. La pagina del personale e'
--     `richiediRuolo("direttore")`: l'applicazione era piu' stretta del
--     database, e vince sempre il piu' largo.
--
-- ROLLBACK: nessuno. Ripristinare i permessi larghi riaprirebbe i due buchi.

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ------------------------------ 1. l'interruttore non e' un recapito
revoke update on public.staff from authenticated;
grant update (full_name, phone) on public.staff to authenticated;

-- Accendere e spegnere una persona e' un atto della direzione, e passa da qui:
-- il `grant` per colonna e' per RUOLO Postgres, non per persona, quindi non
-- puo' distinguere il direttore dagli altri. La distinzione la fa il codice
-- dentro la funzione.
create or replace function public.cambia_stato_attivo(
    persona uuid, attivo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    attivi_rimasti bigint;
begin
    if not public.ha_ruolo('direttore') then
        raise exception 'solo il direttore attiva o disattiva il personale';
    end if;
    if persona is null or attivo is null then
        raise exception 'argomenti non validi';
    end if;

    update public.staff set is_active = attivo where id = persona;
    if not found then
        raise exception 'persona inesistente';
    end if;

    -- Un'accademia senza direttori attivi non ha piu' nessuno che possa
    -- riaccendere qualcuno: il recupero sarebbe fuori banda.
    select count(*) into attivi_rimasti
    from public.staff
    where ruolo = 'direttore' and is_active;

    if attivi_rimasti = 0 then
        raise exception 'non puoi lasciare l''accademia senza un direttore attivo';
    end if;
end;
$$;

revoke execute on function public.cambia_stato_attivo(uuid, boolean)
from public;
grant execute on function public.cambia_stato_attivo(uuid, boolean)
to authenticated;

-- ------------------------------- 2. l'anagrafica del personale non e' di tutti
drop policy personale_visibile_allo_staff on public.staff;

create policy personale_visibile_alla_direzione on public.staff
for select to authenticated
using (public.ha_ruolo('direttore') or public.ha_ruolo('segreteria'));

-- `personale_legge_se_stesso` resta: ognuno vede la propria riga. Le funzioni
-- `e_staff()`, `ha_ruolo()` e `insegna_il_corso()` sono `security definer` e
-- continuano a leggere `staff` per conto proprio, quindi l'insegnante non
-- perde nessun permesso: perde la vista sui colleghi, che non gli serviva.

-- ------------------------------- 3. anche il direttore non si toglie da solo
-- `cambia_ruolo` validava il chiamante e il valore, non lo stato risultante: un
-- direttore che si declassa rende `ha_ruolo('direttore')` falso per tutti, e da
-- quel momento nessuno puo' piu' assegnare ruoli.
create or replace function public.cambia_ruolo(persona uuid, nuovo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    direttori_rimasti bigint;
begin
    if not public.ha_ruolo('direttore') then
        raise exception 'solo il direttore cambia i ruoli';
    end if;
    if nuovo is null
        or nuovo not in ('direttore', 'segreteria', 'insegnante') then
        raise exception 'ruolo non ammesso';
    end if;

    update public.staff set ruolo = nuovo where id = persona;
    if not found then
        raise exception 'persona inesistente';
    end if;

    select count(*) into direttori_rimasti
    from public.staff
    where ruolo = 'direttore' and is_active;

    if direttori_rimasti = 0 then
        raise exception 'non puoi lasciare l''accademia senza un direttore attivo';
    end if;
end;
$$;

-- ------------------------------- 4. la macchina a stati sta nel database
-- L'applicazione elencava le transizioni ammesse; il database no. Una macchina
-- a stati che vive solo nell'applicazione non e' un vincolo.
create or replace function public.transizione_iscrizione()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if new.status <> 'richiesta' then
            raise exception 'un''iscrizione nasce richiesta, non %', new.status;
        end if;
        return new;
    end if;

    if old.status = new.status then
        return new;
    end if;

    if not (
        (old.status = 'richiesta' and new.status in ('confermata', 'ritirata'))
        or (old.status = 'confermata' and new.status = 'ritirata')
    ) then
        raise exception
        'transizione non ammessa: % -> %', old.status, new.status;
    end if;

    return new;
end;
$$;

create trigger enrollments_transizione
before insert or update on public.enrollments
for each row execute function public.transizione_iscrizione();
