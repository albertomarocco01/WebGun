# La verifica deterministica

Legge n°2: **il database è il giudice**. Uno schema "sembra corretto" solo finché non lo applichi. La batteria gira dal più economico al più costoso e si ferma al primo passo che richiede giudizio.

## La pipeline

| # | Passo | Strumento | Esito |
|---|---|---|---|
| 1 | Sintassi e formato SQL | **sqlfluff** (`--dialect postgres`) | auto-fix quasi totale, 0 giudizio |
| 2 | Sicurezza della migrazione | **squawk** | operazioni pericolose, lock, riscritture di tabella |
| 3 | **Applicazione reale su DB pulito** | `supabase db reset` | il gate vero: migrazioni in ordine + seed |
| 4 | Lint del database | `supabase db lint` | funzioni e plpgsql non validi |
| 5 | **Audit RLS** | `scripts/rls-audit.mjs` | tabelle nude, policy assenti o permissive, viste e funzioni pericolose, FK e policy senza indice |
| 6 | Test delle policy | **pgTAP** (`supabase test db`) | le regole d'accesso verificate impersonando i ruoli |
| 7 | Tipi | `supabase gen types typescript --local` | disallineamento tra schema e codice |

`node <skill>/scripts/verify.mjs` esegue tutta la sequenza e restituisce **solo il residuo**.

## Regola anti-simulazione (non negoziabile)

Uno strumento assente non è un passo superato. `verify` classifica ogni passo in tre stati:

- `pass` — eseguito, nessun problema
- `fail` — eseguito, problemi trovati (elencati per gravità)
- `skipped` — **non eseguito** (strumento mancante, Docker spento, nessuna migrazione)

Nel report finale gli `skipped` compaiono come **verifiche mancanti**, non come successi. Uno schema con tre `skipped` non ha passato il gate: ha semplicemente evitato tre domande. Se `supabase db reset` non gira (Docker non avviato), il gate è **rosso**, non "in attesa".

## Gravità

| Grado | Significato | Esempi |
|---|---|---|
| `block` | non si consegna | tabella esposta senza RLS · vista senza `security_invoker` · `security definer` senza `search_path` · migrazione che non si applica · perdita dati non autorizzata |
| `issue` | si consegna solo se documentato nell'handoff | RLS attiva senza policy · FK senza indice · `on delete` implicito · `using (true)` su dati utente |
| `warn` | si stampa, non blocca | `auth.uid()` non avvolto in `select` · indice mancante su colonna di ordinamento · naming fuori convenzione |

## Prerequisiti

```bash
# obbligatori
supabase --version          # Supabase CLI (richiede Docker attivo per il DB locale)
psql --version              # client Postgres, usato dagli script di audit

# consigliati (senza, i passi relativi risultano "skipped")
pipx install sqlfluff
pipx install squawk-cli     # oppure: npm i -g squawk-cli
```

Il database locale di default è `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; si sovrascrive con `--db-url` o con la variabile `SUPABASE_DB_URL`.

## Cosa riportare all'umano

Mai i log grezzi. Il formato è:

```
GATE SCHEMA: ROSSO (2 block, 3 issue, 1 verifica mancante)

BLOCK
- public.orders: RLS non attiva (tabella esposta via PostgREST)
- public.v_report: vista senza security_invoker = on

ISSUE
- public.order_items.product_id: chiave esterna senza indice
...

VERIFICHE MANCANTI
- squawk non installato: sicurezza delle migrazioni non verificata
```
