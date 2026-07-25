# Regole di modellazione

Il vincolo sta nel database, non nell'applicazione. Il codice cambia, gli agenti cambiano, i client sono tre (sito, gestionale, API): l'unico posto dove una regola vale **sempre** è lo schema.

## Naming (non negoziabile: da qui nascono i tipi TypeScript)

- `snake_case` ovunque · tabelle al **plurale** (`orders`, `product_variants`) · colonne al singolare
- Chiave primaria sempre `id` · chiavi esterne `<entita_singolare>_id` (`product_id`)
- Booleani con prefisso di stato (`is_active`, `has_shipping`) · timestamp con suffisso `_at`
- Niente prefisso della tabella nelle colonne (`orders.order_total` → `orders.total_cents`)
- Tabelle di collegamento: `<a>_<b>` in ordine alfabetico (`orders_promotions`)

## Chiavi e tipi

| Caso | Scelta | Perché |
|---|---|---|
| Chiave primaria | `uuid primary key default gen_random_uuid()` | non enumerabile dall'esterno, generabile lato client, coerente con `auth.users.id` |
| Riferimento all'utente | `references auth.users(id) on delete cascade` | Supabase possiede l'identità: non duplicare le credenziali |
| Denaro | `bigint` in **centesimi** (o `numeric(12,2)`) | mai `float`: gli arrotondamenti diventano contestazioni. **`bigint`, non `integer`**: `integer` in centesimi si ferma a 21.474.836,47 € — un totale annuo, non un caso limite — e allargarlo dopo è proprio l'`alter column type` che `migrazioni.md` classifica come pericoloso (riscrittura della tabella sotto lock esclusivo). Il tipo largo costa 4 byte per riga; cambiarlo in produzione costa un fermo |
| Data/ora | `timestamptz` **sempre** | `timestamp` senza fuso è un bug che si manifesta a marzo e a ottobre |
| Enumerazioni | `check (status in (...))` o tabella di lookup | i tipi `enum` di Postgres sono scomodi da far evolvere: un valore non si rimuove |
| Testo | `text` + `check (length(...) <= n)` | `varchar(n)` non dà vantaggi in Postgres |
| Semi-strutturato | `jsonb` **solo** per ciò che è davvero variabile | un campo che interroghi sempre è una colonna, non una chiave JSON |

### Regola della casa: interi a `bigint` per default

Non vale solo per il denaro. Il tipo largo costa **4 byte per riga** — spesso zero, per via dell'allineamento — mentre allargarlo dopo è un `alter column type` con **riscrittura della tabella sotto lock esclusivo**. `integer` si usa solo dove il limite è **strutturale e dimostrabile**, e si motiva.

Strutturale significa che il valore non può crescere per come è fatto il dominio, non che oggi è piccolo: una quantità d'ordine, una giacenza o un contatore sono `bigint`, anche se il cliente è convinto che non supereranno mai il centinaio. Le previsioni commerciali cambiano proprio quando l'azienda va bene, e il ripensamento si paga con un fermo del sito.

## Colonne di servizio (su ogni tabella)

```sql
id          uuid primary key default gen_random_uuid(),
created_at  timestamptz not null default now(),
updated_at  timestamptz not null default now()
```

`updated_at` va mantenuto da un **trigger**, mai dall'applicazione: un client che dimentica di aggiornarlo falsifica la cronologia.

## Vincoli: la correttezza sta qui

- `not null` su tutto ciò che non è davvero opzionale — ogni `null` è uno stato in più da gestire in ogni query
- `on delete` **esplicito** su ogni FK: `cascade` (figlio che da solo non ha senso), `restrict` (protegge i dati storici, es. ordini), `set null` (relazione facoltativa). Mai il default implicito
- `unique` sulle chiavi naturali (slug, SKU, email), anche se "l'applicazione già controlla"
- `check` per le regole invarianti: `quantity > 0`, `price_cents >= 0`, coerenza fra date (`ends_at > starts_at`)
- Macchine a stati: campo `status` con `check` sui valori ammessi; le **transizioni** illegali si bloccano con trigger, non con la buona volontà del frontend

## Indici

- **Postgres non indicizza automaticamente le chiavi esterne**: ogni FK vuole il suo indice, o ogni join e ogni `on delete` diventa una scansione
- Ogni colonna usata in una **policy RLS** vuole un indice: la policy gira su ogni riga di ogni query
- Indice sulle colonne di filtro e ordinamento delle liste (`created_at desc`, `status`)
- Indici parziali per i casi frequenti (`where deleted_at is null`)
- **Sulle colonne booleane si valuta l'indice parziale, non quello pieno**: due valori distinti non selezionano quasi nulla, e l'indice pieno rallenta ogni scrittura per niente. Se le query cercano sempre lo stesso lato (`where is_published`), l'indice utile è `create index ... on tabella (colonna) where colonna`, o meglio ancora un indice parziale sulla colonna che *filtra davvero*. Per questo l'audit RLS **non** segnala una colonna booleana di policy come "non indicizzata"
- Non indicizzare "per sicurezza": ogni indice rallenta le scritture. Si aggiunge quando la query esiste

## Normalizzazione e le sue due eccezioni

Normalizza per default (3NF). Denormalizza **solo** con motivo scritto:

1. **Snapshot storico** — un ordine conserva prezzo, nome e aliquota **del momento dell'acquisto**. Se leggi il prezzo dal catalogo, cambiando il listino riscrivi il passato. Vedi `pattern-ecommerce.md`.
2. **Aggregato misurato** — un contatore denormalizzato si aggiunge dopo aver visto la query lenta, mai prima, e lo mantiene un trigger.

## Seed

- **Idempotente**: `on conflict do nothing` ovunque; due `db reset` di fila lasciano lo stesso stato
- **Deterministico**: UUID scritti a mano e costanti. `gen_random_uuid()` nel seed rende i test non riproducibili e gli screenshot instabili
- **Rappresentativo**: abbastanza dati da mostrare ogni stato dell'interfaccia — lista vuota, lista lunga, testo lungo che rompe il layout, caso limite (ordine annullato, prodotto esaurito)
- Separato per ambiente: `seed.sql` è per lo sviluppo; i dati demo del cliente sono un'altra cosa e vivono altrove
