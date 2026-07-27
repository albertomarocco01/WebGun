# RLS su Supabase — pattern, errori, performance

Su Supabase una tabella dello schema `public` è **raggiungibile via PostgREST** quando i ruoli `anon`/`authenticated` hanno il `grant` sulla tabella. Non è (più) vero che *ogni* tabella nuova sia esposta d'ufficio: dipende dalle **impostazioni della Data API del progetto**, e una tabella creata a mano in SQL può richiedere un `grant` esplicito per essere raggiungibile.

**Questo non indebolisce di una virgola la Legge n°3.** L'esposizione è una *impostazione*: si cambia da un pannello, o con un `grant` scritto da chiunque venga dopo, e non lascia traccia nello schema. La RLS invece sta attaccata alla tabella. Una tabella non esposta oggi è esposta domani senza che nessuno riapra la migrazione — quindi **nessuna tabella nuda**, mai, nemmeno "per ora". Senza RLS non stai rimandando la sicurezza: stai lasciando che sia una casella di configurazione a decidere se il database è pubblico.

Le due cose sono **ortogonali**, e vanno tenute distinte perché i due guasti hanno sintomi opposti:

| | tabella esposta | tabella non esposta |
|---|---|---|
| **con RLS e policy** | funziona come previsto | il client non legge nulla e sembra un bug del frontend (§La trappola inversa) |
| **senza RLS** | data leak pubblico (`block` dell'audit) | data leak in attesa di un `grant` |

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
using ((select auth.uid()) = user_id);
```

**2. Public read / write riservato** — cataloghi, contenuti pubblici.
```sql
create policy "catalogo pubblico" on public.products
for select to anon, authenticated using (is_published);
```
Nota: `using (true)` è ammesso **solo** su dati realmente pubblici e **va documentato** nell'handoff, altrimenti l'audit lo segnala.

**3. Tenant-based** — dati di un'organizzazione/azienda. La verifica dell'appartenenza va in una funzione `security definer` per evitare ricorsione fra policy:
```sql
create or replace function public.is_member_of(org uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = (select auth.uid()));
$$;
-- obbligatorio: Postgres concede `execute` a PUBLIC per DEFAULT, quindi senza
-- queste due righe la funzione è un endpoint chiamabile da `anon` che scavalca
-- la RLS. L'audit lo segnala (`issue`).
revoke execute on function public.is_member_of(uuid) from public;
grant execute on function public.is_member_of(uuid) to authenticated;

create policy "membri leggono l'organizzazione" on public.invoices
for select to authenticated using (public.is_member_of(org_id));
```

**4. Role-based** — ruoli applicativi (admin, staff). Il ruolo sta nei **claim del JWT** o in una tabella dei ruoli letta da funzione `security definer`; **mai** in una colonna che l'utente stesso può aggiornare.

Nel JWT c'è un solo posto giusto: `raw_app_meta_data` (`app_metadata` nel token), che scrive **solo il server**. `raw_user_meta_data` (`user_metadata`) lo scrive **l'utente** con una chiamata a `updateUser`, e finisce anch'esso in `auth.jwt()`: una policy che ne ricava l'autorizzazione è auto-promozione ad admin in una riga di JavaScript. L'audit la blocca.
```sql
-- corretto: app_metadata, scritto dal server
using (((auth.jwt() -> 'app_metadata') ->> 'role') = 'admin')
-- vulnerabile: user_metadata, scritto dall'utente
using (((auth.jwt() -> 'user_metadata') ->> 'role') = 'admin')
```
I claim del JWT **non sono freschi** fino al refresh del token: una revoca di ruolo vale dal token successivo. Se serve immediatezza, il ruolo si legge da tabella con una funzione `security definer`.

**3b. Tenant con ruoli interni di ambito diverso** — la composizione di 3 e 4, ed è il caso vero più frequente: il titolare vede tutta l'azienda, il responsabile di una singola sede vede solo la propria. Non sono due pattern da scegliere, sono due condizioni da comporre in **una** funzione, così la policy resta una riga e l'ambito ha un posto solo dove essere corretto:

```sql
create or replace function public.puo_vedere_sede(sede uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid())
      and s.org_id = (select l.org_id from public.locations l where l.id = sede)
      and (s.ruolo = 'titolare' or s.location_id = sede)   -- ambito del ruolo);
$$;
revoke execute on function public.puo_vedere_sede(uuid) from public;
grant execute on function public.puo_vedere_sede(uuid) to authenticated;

create policy "lo staff vede gli ordini di sua competenza" on public.orders
for select to authenticated using (public.puo_vedere_sede(location_id));
```

Le due condizioni in due policy separate si sommerebbero in **OR** (le policy permissive si uniscono): il responsabile di sede vedrebbe tutto. L'ambito ristretto va **dentro** la stessa condizione, non accanto.

## La RLS è per riga, non per colonna

L'errore più insidioso del modello, perché il database resta perfettamente valido mentre il dato è pubblico.

PostgREST lascia scegliere al client **quali colonne leggere** (`?select=…`). Una policy autorizza o nega **la riga intera**: non esiste `using` che nasconda una colonna sola. Quindi:

> **Un dato riservato messo in una colonna di una tabella leggibile è un dato pubblico.** Non «meno visibile»: pubblico, con una `select` sola.

Il prezzo riservato concordato con un cliente B2B, il margine, il costo d'acquisto, la nota interna sull'utente: se stanno in `products` o in `profiles`, chiunque possa leggere quella riga li legge. La risposta non è una policy più furba, è il **modello**:

- il dato riservato va in una **tabella separata** con la sua RLS (`product_prices` per listino, `internal_notes`, `costs`)
- oppure lo si espone tramite una **vista** che seleziona solo le colonne pubbliche (con `security_invoker = on`) e si nega l'accesso diretto alla tabella
- i `grant` **per colonna** esistono in Postgres e funzionano davvero: con `grant update (nome) on public.profiles to authenticated` il tentativo di scrivere un'altra colonna riceve *permission denied for table* (verificato il 2026-07-27). Sono un secondo sistema di permessi, che va scritto nella migrazione e ricordato in ogni `alter table`: rinforzo obbligatorio sulle colonne di privilegio, non sostituto del modello

### Il caso peggiore: la colonna che decide i permessi

Vale anche al contrario: una colonna che deve essere **scritta solo dallo staff** (uno sconto, uno stato) su una riga che l'utente può aggiornare è scrivibile dall'utente. Il `with check` vede la riga, non il campo modificato.

Quando quella colonna è il **ruolo**, non è un difetto di modello: è **auto-promozione ad admin**. Riprodotto sul banco veterinario il 2026-07-27, con la policy scritta correttamente:

```sql
-- policy corretta: lo staff modifica solo le righe della propria sede
create policy "personale gestito dalla direzione" on public.staff
for all to authenticated
using (e_staff() and puo_vedere_clinica(clinic_id))
with check (e_staff() and puo_vedere_clinica(clinic_id));
grant select, insert, update, delete on public.staff to authenticated;
```

Un veterinario vede 2 visite e 0 note interne. Dopo un solo `update public.staff set job_title = 'direttore'` sulla **propria** riga ne vede 6 e 1, perché `puo_vedere_clinica()` decide in base a `job_title`. La policy non è mai stata violata: ha fatto esattamente quello che diceva.

Le tre difese, in ordine di preferenza:

1. **la colonna in una tabella che l'utente non scrive** (`staff_roles` gestita solo dalla direzione, o il claim in `raw_app_meta_data`)
2. **`grant` per colonna**: `revoke update on public.staff from authenticated;` poi `grant update (full_name, phone) on public.staff to authenticated;`
3. **un trigger `before update`** che rifiuta la modifica della colonna a chi non è autorizzato

`scripts/rls-audit.mjs` lo controlla: colonna dal nome di privilegio (`role`, `ruolo`, `is_admin`, `job_title`, `permessi`…) + policy di scrittura + `grant update` sull'**intera** tabella + nessun trigger che la nomini → `block` se quella colonna compare in una policy o nel corpo di una funzione che una policy chiama, `issue` se c'è solo il nome.

## La trappola inversa: RLS perfetta, nessun `grant`

Il guasto simmetrico al data leak, e costa giorni perché non assomiglia a un problema di database. Tabella con RLS attiva, policy corrette, indici al posto giusto — e il client **non legge niente**. Non c'è errore: c'è una lista vuota, e sembra un bug del frontend.

Manca il permesso Postgres, che è un secondo sistema **sopra** la RLS: le policy decidono *quali righe*, il `grant` decide *se la tabella è raggiungibile affatto*.

```sql
grant select on public.orders to anon, authenticated;
grant insert, update, delete on public.orders to authenticated;
```
Verifica: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'orders';`

`scripts/rls-audit.mjs` lo controlla: una tabella con RLS attiva e almeno una policy ma **senza `grant`** a `anon`/`authenticated` produce un `issue`. Se il client non deve raggiungerla, la risposta giusta non è il `grant` — è **spostarla in uno schema non esposto**.

## Una policy per operazione e per ruolo

Non esiste la policy "tuttofare": `select`, `insert`, `update`, `delete` hanno regole diverse. Su `insert` e `update` serve `with check` (cosa può **scrivere**), non solo `using` (cosa può **vedere**):
```sql
create policy "utente crea i propri ordini"
on public.orders for insert to authenticated
with check ((select auth.uid()) = user_id);
```

**Cosa succede davvero se `with check` manca** — verificato su Postgres reale il 2026-07-27, perché la spiegazione che girava qui era falsa e mandava a cercare la cosa sbagliata:

- su **`insert`** Postgres **nega ogni inserimento** (`new row violates row-level security policy`). Non lascia passare righe intestate ad altri: non lascia passare niente. Il guasto è muto e sembra un bug del frontend. (`for insert using (…)` non è nemmeno scrivibile: *only WITH CHECK expression allowed for INSERT*.)
- su **`update`** e **`all`** Postgres **riusa l'espressione di `using`** come controllo sulla riga nuova. Quindi `for update using ((select auth.uid()) = user_id)` senza `with check` è **sicuro**: il tentativo di intestare la riga a un altro utente viene rifiutato. Ma `for update using (true)` senza `with check` è un buco aperto — il controllo effettivo è `true` e chiunque riscrive la riga di chiunque.

Scrivere entrambe le clausole resta la forma da preferire (l'intenzione si legge senza conoscere la regola di ereditarietà), ma l'audit segnala la **composizione** pericolosa, non l'assenza della clausola: segnalare l'assenza vorrebbe dire segnalare il codice corretto.

## `update` e `delete` hanno bisogno di una policy di `select`

In Postgres un `update` deve prima **selezionare** la riga da modificare. Senza una policy di `select` per gli **stessi ruoli**, l'operazione tocca **0 righe e non dà errore**: la chiamata riesce, il dato non cambia. È il guasto che sembra più di tutti un bug del frontend.

```sql
-- serve la coppia, non la sola scrittura
create policy "legge i propri ordini" on public.orders
for select to authenticated using ((select auth.uid()) = user_id);

create policy "aggiorna i propri ordini" on public.orders
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```
Attenzione ai **ruoli**: una policy di `select` per `anon` non copre un `update` per `authenticated`. L'audit confronta gli insiemi di ruoli, non solo la presenza della policy.

## Storage: l'upsert vuole tre policy, non una

`storage.objects` è una tabella con RLS come tutte le altre, e un **upsert non è un `insert`**: sostituire un file esistente è un `update`, e per aggiornarlo bisogna prima **leggerlo**. Servono quindi **tre** policy per lo stesso ruolo — `insert` + `select` + `update` — sullo stesso bucket.

Concedendo solo `insert`, i caricamenti **nuovi** passano e la sostituzione di un file esistente **fallisce in silenzio**: il caso peggiore, perché la funzione sembra funzionare finché nessuno riprova con lo stesso nome. Il `delete` serve a parte, se l'applicazione cancella i file.

```sql
create policy "carica nella propria cartella" on storage.objects
for insert to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "legge la propria cartella" on storage.objects
for select to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "sostituisce nella propria cartella" on storage.objects
for update to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);
```
`scripts/rls-audit.mjs` **non** ha una regola per Storage: `storage` non è uno schema esposto dell'API e non compare in `[api].schemas`, quindi l'audit non lo guarda. Qui è documentazione, e va controllata a mano.

## Macchine a stati: il vincolo su `update` non dice niente su `insert`

Un trigger di transizione risponde alla domanda «da questo stato si può passare a quest'altro?». Non risponde a «da quale stato si può **partire**?». Verificato il 2026-07-27: con il trigger di transizione delle visite attivo e funzionante, `insert into public.visits (…, status) values (…, 'fatturata')` passa senza un fiato — nessuna transizione è avvenuta, quindi non c'è niente da rifiutare.

Un `check` che **enumera il dominio** non è una difesa: `check (status = any (array['prenotata','confermata','eseguita','fatturata','annullata']))` ammette proprio lo stato che si vuole vietare all'inserimento. Serve un vincolo sullo stato **iniziale**:

```sql
-- lo stato iniziale è uno solo
alter table public.visits
add constraint visits_nasce_prenotata check (status = 'prenotata');
```

Se gli stati iniziali leciti sono più d'uno, o dipendono da chi inserisce, il vincolo diventa lo **stesso trigger anche `before insert`** (con `old` assente, quindi con un ramo dedicato). `scripts/rls-audit.mjs` lo controlla e produce un `issue`.

## Una policy senza test negativo è un'ipotesi

Il gate verifica che la RLS **esista**, non che **funzioni**: nessuno strumento legge la semantica di una policy. L'unica cosa che dimostra che una policy regge è **averla attaccata** e aver visto il database rifiutare.

Perciò `scripts/rls-audit.mjs` produce un **`block`** su ogni tabella che ha una policy di `insert`, `update`, `delete` o `all` e per cui **nessun** file di `supabase/tests/` tenta una scrittura impersonando un ruolo. Non si pretende una forma di asserzione precisa: il test negativo corretto può asserire un'eccezione (`throws_ok`) oppure che il dato **non è cambiato**.

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"…c1"}';

-- il tentativo che DEVE fallire
update public.visits set status = 'confermata' where id = '…001';

-- e l'asserzione che è fallito: la riga è rimasta dov'era
select is(
    (select count(*) from public.visits
     where id = '…001' and status = 'prenotata')::bigint,
    1::bigint,
    'il cliente non può confermarsi da solo una visita'
);
```

I test negativi si scrivono **insieme alla policy**, non dopo: sono la sua specifica eseguibile. Uno per ogni cosa che la policy deve impedire — non uno per tabella.

## Errori classici

`scripts/rls-audit.mjs` cerca tutte le righe di questa tabella **tranne** le ultime due: le policy di Storage e la `service_role` lato client non sono nel catalogo che l'audit legge (la seconda è territorio di `gitleaks`, non di Schema Forge). Su quelle due il gate verde non dice niente: si controllano a mano.

| Errore | Conseguenza |
|---|---|
| Tabella in `public` senza RLS | dati leggibili con la chiave anonima, cioè pubblici |
| Tabella nuda in uno schema **secondario esposto** (`[api].schemas` del `config.toml`) | identico al precedente: esposto è esposto, `public` non è l'unico schema pubblicato |
| Dato riservato in una **colonna** di una tabella leggibile | pubblico: la policy filtra righe, non campi (§La RLS è per riga) |
| RLS attiva ma zero policy | applicazione che non legge nulla e sembra un bug del frontend |
| RLS e policy corrette ma **nessun `grant`** a `anon`/`authenticated` | identico al precedente e più difficile da vedere: il permesso Postgres manca, non la policy (§La trappola inversa) |
| `using (true)` su dati utente | RLS attiva ma inutile: falso senso di sicurezza |
| `update`/`all` con `using (true)` e **senza** `with check` | il controllo sulla riga nuova è ereditato da `using`, quindi è `true`: chiunque riscrive la riga di chiunque (`block`) |
| `insert` senza `with check` | l'opposto di quel che si crede: Postgres **nega ogni** inserimento, e sembra un bug del frontend |
| `update`/`delete` senza una policy di `select` per gli **stessi ruoli** | l'operazione tocca 0 righe **senza errore**: la chiamata riesce e il dato non cambia |
| `user_metadata` / `raw_user_meta_data` in una policy | auto-promozione ad admin: quel campo lo scrive **l'utente** e finisce in `auth.jwt()` — il claim va in `raw_app_meta_data` |
| `auth.role()` in una policy | deprecata, e con gli **accessi anonimi** attivi un anonimo porta il ruolo `authenticated` e la passa senza essere autenticato: il ruolo si dichiara con `to` |
| Vista senza `security_invoker = on` | la vista gira coi diritti del **proprietario** e scavalca la RLS delle tabelle sotto |
| `security definer` senza `set search_path = ''` | escalation di privilegi tramite oggetti omonimi |
| `security definer` con `execute` a PUBLIC (il **default** di Postgres) | è un endpoint pubblico chiamabile da `anon` che scavalca la RLS: `revoke execute … from public` |
| Ruolo letto da una colonna scrivibile dall'utente | auto-promozione ad admin: la policy filtra la riga, non la colonna (§Il caso peggiore) |
| Macchina a stati vincolata solo in `update` | la riga si crea direttamente nello stato di arrivo e la macchina non è mai passata di lì (§Macchine a stati) |
| Policy di scrittura senza un test pgTAP che le attacchi | l'unica prova che una policy funziona è averla violata e aver visto il rifiuto: senza, è un'ipotesi (`block`) |
| Upsert su `storage.objects` con la sola policy di `insert` | i caricamenti nuovi passano, la sostituzione dei file **fallisce in silenzio** (§Storage) |
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
