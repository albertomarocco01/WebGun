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
- Macchine a stati: campo `status` con `check` sui valori ammessi; le **transizioni** illegali si bloccano con trigger, non con la buona volontà del frontend. Il `check` che **enumera i valori** non è una difesa: ammette anche lo stato finale in `insert`. Serve un vincolo sullo stato **iniziale** — vedi `rls-supabase.md` §Macchine a stati
- **Ogni macchina a stati, non solo quella principale.** Se un trigger difende un dato *guardando uno stato* (*«una fattura emessa non si tocca»*), quello stato ha bisogno a sua volta delle sue transizioni vincolate: altrimenti la difesa si aggira in tre mosse — riporta lo stato indietro, modifica, rimettilo avanti. Vale per ogni colonna di stato dello schema; quella dimenticata è sempre quella dell'entità di servizio (fattura, spedizione, ticket), non quella dell'entità di cui parla il brief

### Invarianti su un insieme di righe

Un `check` difende una riga, e un trigger `for each row` difende una riga. *«Resta sempre almeno un titolare attivo»* non parla di una riga: parla dell'**insieme**. Il conteggio scritto in buona fede — `if (select count(*) … ) = 0 then raise` — **non lo difende**: a `read committed` due transazioni concorrenti leggono ognuna la propria istantanea, toccano righe **diverse**, non entrano in conflitto, e arrivano insieme a zero. È write skew, e la forma è sempre la stessa: due utenti che si declassano a vicenda, oppure due `delete`, oppure un `update` e un `delete`.

La forma provata è un **trigger di istruzione** (`after … for each statement`) che prende un `pg_advisory_xact_lock` su una chiave costante dell'invariante **prima** di contare. A difendere l'invariante non è il conteggio — che è la cosa che verrebbe in mente — ma il **punto di serializzazione**. E si verifica su tutte le vie che portano allo stesso stato, non solo su quella trovata: due `update` concorrenti, `update` + `delete`, due `delete`.

Un invariante d'insieme **non è falsificabile in pgTAP**, che gira in una sessione sola dentro una transazione: la prova è uno script a due connessioni, e va lanciata a parte. Da qui la regola sorella di *«un'asserzione che non può fallire non è un'asserzione»*: **un limite dello strumento non è una proprietà del codice.** Da «nessun test può renderlo rosso» non segue «non può succedere» — è il ragionamento che ha lasciato un invariante falso per due giorni con 82 asserzioni verdi.

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

- **Idempotente**: `on conflict do nothing` ovunque; due `db reset` di fila lasciano lo stesso stato. Attenzione: `on conflict do nothing` protegge dalla **violazione di un vincolo unico**, non dai **trigger di dominio**. Un trigger che blocca la modifica di un ordine spedito, o che ricalcola una giacenza, scatta comunque e fa fallire il seed rieseguito su un database caldo. Dove ci sono trigger di dominio la forma sicura è `insert … select … where not exists (…)`: la riga non si tenta nemmeno
- **Deterministico**: UUID scritti a mano e costanti. `gen_random_uuid()` nel seed rende i test non riproducibili e gli screenshot instabili
- **Rappresentativo**: abbastanza dati da mostrare ogni stato dell'interfaccia — lista vuota, lista lunga, testo lungo che rompe il layout, caso limite (ordine annullato, prodotto esaurito)
- **Separato per ambiente**, con il nome del file che dichiara cosa è (sotto)

### I tre file del seed, e il quarto che non è un file

```
supabase/seed/10-riferimento.sql    dati di riferimento (anagrafiche, categorie)     ogni ambiente
supabase/seed/20-locale.sql         contenuti del cliente (menu, orari, testi)       ogni ambiente
supabase/seed/90-solo-sviluppo.sql  account finti, password in chiaro, dati demo     MAI in produzione
```

Il numero mette il file in fondo all'ordine, il **nome dichiara cosa è**, e un riquadro in testa lo ripete. Il file di sviluppo stampa un `raise warning` *prima* di scrivere, con gli indirizzi e la password che sta per creare e l'invito a interrompere.

Il primo account **vero** non è un file SQL: una password in un file SQL è una password committata, comunque la si giri. Lo crea uno script (`scripts/crea-titolare.mjs`) che usa la **chiave di servizio** — `auth.users` non si scrive dal client — sta in `scripts/`, fuori da `src/` e da ogni bundle, **genera** la password e la stampa una volta sola. E si **rifiuta** se l'account esiste già: in un provisioning «esiste già» non è un caso benigno, è la domanda *chi l'ha creato?*, e lo script non sa rispondere.

### La guardia del seed di sviluppo: quattro condizioni in serie, tutte fail-closed

`sql_paths` con nomi espliciti (invece di un glob) impedisce che un file lasciato cadere nella cartella entri da solo in `db reset`, ma **non è una difesa contro la produzione**: `sql_paths` è esattamente l'elenco che `supabase db push --include-seed` e `db reset --linked` applicano a un progetto **remoto**. Un file pericoloso dentro `sql_paths` è un file a un comando di distanza dalla produzione. La forma provata:

| # | Dove | Cosa pretende | Se non lo trova |
|---|---|---|---|
| 0 | `config.toml` | il file di sviluppo **non è** in `[db.seed].sql_paths` | nessun comando della CLI lo applica, né locale né remoto |
| 1 | lo script che lo lancia | l'host lo dice `supabase status`, **mai** una variabile d'ambiente | esce `1`, non si collega nemmeno |
| 2 | dentro il file | lo `sha256` di `current_setting('app.settings.jwt_secret', true)` è quello del banco | `P0001`, transazione annullata |
| 3 | dentro il file | una GUC di sessione che solo lo script legittimo imposta | `P0001`, transazione annullata |
| 4 | dentro il file | `auth.users` e le tabelle di dominio senza righe estranee | `P0001`, transazione annullata |

Perché è fatta così:

- **La domanda giusta è rovesciata.** Non esiste in Postgres un segnale che dica «sei in produzione» — provato anche col privilegio: `current_user` è `postgres` e `rolsuper` è **falso** anche in locale, identico a un'istanza ospitata. Esiste invece un segnale che dice «sei il banco di prova della CLI». Si cerca la prova dell'unico ambiente in cui si è autorizzati a scrivere, e tutto il resto — compreso ciò a cui nessuno ha ancora pensato — cade dalla parte del rifiuto **per costruzione**.
- **Il segreto dimostrativo della CLI è un'etichetta d'ambiente, non un segreto.** `supabase start` scrive `app.settings.jwt_secret` con `ALTER DATABASE` (quindi **sopravvive a un `db reset`**) e il valore è identico in ogni progetto locale del mondo: `supabase status` lo stampa in chiaro. Nel file si confronta il suo `sha256`, mai il valore — una stringa a forma di segreto in un file committato è precisamente ciò che `gitleaks` esiste per trovare, e **non serve conoscerlo per riconoscerlo**.
- **La 3 esiste accanto alla 2** perché la 2 dipende da come è fatta una piattaforma, mentre una GUC che nessun comando della CLI imposta non dipende da niente. E se domani la CLI smettesse di scrivere quel segreto, la 2 si **irrigidirebbe** (rifiuterebbe anche in sviluppo) invece di ammorbidirsi: è la direzione giusta in cui sbagliare.
- **Quello che la guardia non copre**: una produzione **appena creata** ha `auth.users` e le tabelle di dominio vuote esattamente come un database appena resettato. È il caso che la condizione 0 esiste per chiudere, e per cui le altre non bastano.

**Non fondare la guardia sul loopback.** In Docker una connessione «locale» non è mai di loopback: Postgres vede il client arrivare dal **gateway della rete Docker** (`172.18.0.1`), non da `127.0.0.1` — misurato con `inet_server_addr()` / `inet_client_addr()`. Una guardia «loopback ⇒ sono in sviluppo» rifiuterebbe **sempre**, anche in sviluppo.

E `\set ON_ERROR_STOP on` va **dentro il file**, non sulla riga di comando: avvolgere tutto in `begin`…`commit` chiude solo metà del problema, perché un errore di `\ir` è un errore del **client** e non fa abortire nessuna transazione.
