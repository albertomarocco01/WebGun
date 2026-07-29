-- Bottega Nord — correzioni dai rilievi del tribunale (2026-07-28).
--
-- I due rilievi sono nati sul banco gemello dell'accademia, ma la forma e'
-- identica qui, perche' identico era il pattern generato:
--
--  1. `is_active` stava nel `grant update` per colonna insieme ai recapiti. Ma
--     non e' un recapito: e' l'interruttore che spegne una persona, e lo legge
--     `e_staff()`. Con quel grant, chi veniva disattivato si riaccendeva da
--     solo — la policy che autorizza la propria riga non guarda quale colonna.
--
--  2. `personale_visibile_allo_staff` apriva l'intera riga di ogni collega a
--     ogni membro dello staff, `auth_user_id` compreso. La pagina del personale
--     e' `richiediRuolo("titolare")`: l'applicazione era piu' stretta del
--     database, e fra i due vince sempre il piu' largo.
--
-- ROLLBACK: nessuno.

set lock_timeout = '5s';
set statement_timeout = '60s';

revoke update on public.staff from authenticated;
grant update (full_name, phone) on public.staff to authenticated;

create or replace function public.cambia_stato_attivo(
    persona uuid, attivo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    titolari_rimasti bigint;
begin
    if not public.ha_ruolo('titolare') then
        raise exception 'solo il titolare attiva o disattiva il personale';
    end if;
    if persona is null or attivo is null then
        raise exception 'argomenti non validi';
    end if;

    update public.staff set is_active = attivo where id = persona;
    if not found then
        raise exception 'persona inesistente';
    end if;

    select count(*) into titolari_rimasti
    from public.staff
    where ruolo = 'titolare' and is_active;

    if titolari_rimasti = 0 then
        raise exception 'non puoi lasciare il negozio senza un titolare attivo';
    end if;
end;
$$;

revoke execute on function public.cambia_stato_attivo(uuid, boolean)
from public;
grant execute on function public.cambia_stato_attivo(uuid, boolean)
to authenticated;

drop policy personale_visibile_allo_staff on public.staff;

create policy personale_visibile_al_titolare on public.staff
for select to authenticated using (public.ha_ruolo('titolare'));

-- `cambia_ruolo` non guardava lo stato risultante: un titolare che si declassa
-- rende `ha_ruolo('titolare')` falso per tutti, e nessuno puo' piu' assegnare
-- ruoli. Il recupero sarebbe fuori banda.
create or replace function public.cambia_ruolo(persona uuid, nuovo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    titolari_rimasti bigint;
begin
    if not public.ha_ruolo('titolare') then
        raise exception 'solo il titolare cambia i ruoli';
    end if;
    if nuovo is null
        or nuovo not in ('titolare', 'magazziniere', 'redattore') then
        raise exception 'ruolo non ammesso';
    end if;

    update public.staff set ruolo = nuovo where id = persona;
    if not found then
        raise exception 'persona inesistente';
    end if;

    select count(*) into titolari_rimasti
    from public.staff
    where ruolo = 'titolare' and is_active;

    if titolari_rimasti = 0 then
        raise exception 'non puoi lasciare il negozio senza un titolare attivo';
    end if;
end;
$$;
