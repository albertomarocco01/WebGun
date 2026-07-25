# RLS su Supabase — pattern, errori, performance

Su Supabase ogni tabella dello schema `public` è **esposta via PostgREST** con la chiave anonima. Senza RLS non stai "rimandando la sicurezza": stai pubblicando il database su internet. Per questo la Legge n°3 non ha eccezioni.

## Le due righe che vengono prima di tutto

```sql
alter table public.orders enable row level security;
-- consigliato: vale anche per il proprietario della tabella
alter table public.orders force row level security;
```
`enable` non protegge dal **proprietario** della tabella: una funzione o un job che gira come owner legge e scrive tutto scavalcando le policy. `force` chiude anche quella porta. `scripts/rls-audit.mjs` lo verifica: una tabella con RLS attiva ma senza `force` produce un finding di gravità **`warn`** (non blocca il gate, ma resta scritto). Una tabella senza RLS ha già il suo `block` e non riceve anche il warn.
RLS attiva **senza policy** = nessuno legge nulla (tranne `service_role`). È lo stato sicuro di partenza: si aprono i permessi uno alla volta, non si chiudono a posteriori.

## I quattro pattern che coprono il 95% dei casi

**1. Owner-based** — la riga appartiene a un utente.
```sql
create policy "utente legge i propri ordini"
on public.orders for select to authenticated
using ( (select auth.uid()) = user_id );
```

**2. Public read / write riservato** — cataloghi, contenuti pubblici.
```sql
create policy "catalogo pubblico" on public.products
for select to anon, authenticated using ( is_published );
```
Nota: `using (true)` è ammesso **solo** su dati realmente pubblici e **va documentato** nell'handoff, altrimenti l'audit lo segnala.

**3. Tenant-based** — dati di un'organizzazione/azienda. La verifica dell'appartenenza va in una funzione `security definer` per evitare ricorsione fra policy:
```sql
create or replace function public.is_member_of(org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = (select auth.uid())
  );
$$;

create policy "membri leggono l'organizzazione" on public.invoices
for select to authenticated using ( public.is_member_of(org_id) );
```

**4. Role-based** — ruoli applicativi (admin, staff). Il ruolo sta nei **claim del JWT** o in una tabella dei ruoli letta da funzione `security definer`; **mai** in una colonna che l'utente stesso può aggiornare.

## Una policy per operazione e per ruolo

Non esiste la policy "tuttofare": `select`, `insert`, `update`, `delete` hanno regole diverse. Su `insert` e `update` serve `with check` (cosa può **scrivere**), non solo `using` (cosa può **vedere**):
```sql
create policy "utente crea i propri ordini"
on public.orders for insert to authenticated
with check ( (select auth.uid()) = user_id );
```
Senza `with check`, un utente autenticato può inserire righe intestate a qualcun altro.

## Errori classici (l'audit li cerca tutti)

| Errore | Conseguenza |
|---|---|
| Tabella in `public` senza RLS | dati leggibili con la chiave anonima, cioè pubblici |
| RLS attiva ma zero policy | applicazione che non legge nulla e sembra un bug del frontend |
| `using (true)` su dati utente | RLS attiva ma inutile: falso senso di sicurezza |
| `insert`/`update` senza `with check` | scrittura per conto di altri utenti |
| Vista senza `security_invoker = on` | la vista gira coi diritti del **proprietario** e scavalca la RLS delle tabelle sotto |
| `security definer` senza `set search_path = ''` | escalation di privilegi tramite oggetti omonimi |
| Ruolo letto da una colonna scrivibile dall'utente | auto-promozione ad admin |
| `service_role` usata lato client | RLS completamente bypassata: la chiave sta **solo** sul server |

## Performance delle policy

La policy viene valutata **su ogni riga di ogni query**: è codice caldo.

- Avvolgi le funzioni di contesto: `(select auth.uid())` invece di `auth.uid()` — così viene valutata una volta per statement invece che per riga
- **Indice** sulla colonna usata nella policy (`user_id`, `org_id`): senza, ogni query diventa una scansione completa
- Specifica sempre `to authenticated` / `to anon`: evita di valutare la policy per ruoli che non la useranno
- Niente join dentro la policy: incapsula in una funzione `stable` `security definer`
- I filtri espliciti nella query (`.eq('user_id', uid)`) non sono ridondanti: aiutano il planner anche con RLS attiva

## Testare le policy (pgTAP)

Le policy si testano impersonando i ruoli, non leggendo il codice:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
select is_empty('select * from orders where user_id <> ''00000000-0000-0000-0000-000000000001''');
```
I test vivono in `supabase/tests/` e girano con `supabase test db`. Una policy senza test è un'ipotesi.
