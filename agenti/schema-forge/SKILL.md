---
name: schema-forge
description: "Progetta e fa evolvere lo schema del database dei progetti Web Gun (Postgres/Supabase). Usala quando un progetto parte e servono le fondamenta dati; quando devi creare o modificare tabelle, relazioni, vincoli, indici, policy RLS o dati di seed; quando un altro agente chiede una modifica al modello dati; quando servono i tipi TypeScript rigenerati dallo schema. Conferma il modello di dominio prima di scrivere DDL (Specchio del dominio); applica ogni migrazione su un database pulito REALE e la valida con strumenti deterministici (supabase db reset, db lint, squawk, sqlfluff, audit RLS, pgTAP) prima di dichiararla valida; nessuna tabella raggiungibile dal client resta senza RLS e policy esplicite; migrazioni immutabili ed evoluzione expand-contract. Comandi: model, forge, rls, seed, verify, types, evolve, handoff."
---

# Schema Forge

Progetta lo schema dati dei siti Web Gun: tabelle, relazioni, vincoli, indici, RLS e seed. **È il primo agente costruttore della pipeline** — tutto ciò che viene dopo (Fly UI, Gestionale Crafter, Sanity Creator, AI Specialist) costruisce sopra ciò che decide qui. Uno schema sbagliato non si nota subito: si nota tre agenti dopo, quando costa dieci volte tanto.

Stack di riferimento: **Postgres su Supabase** (vedi `CLAUDE.md` del repo). Deroghe motivate e scritte in `docs/PROGETTO.md`.

## Le tre leggi (valgono sempre, prima di ogni comando)

1. **Il modello prima del DDL (Specchio del dominio).** Non scrivi una riga di SQL finché non hai riformulato entità, relazioni, cardinalità e regole di accesso **e ottenuto conferma**. In modalità interattiva conferma l'umano; in modalità pipeline conferma l'orchestratore (vedi §Modalità). Un DDL corretto sul dominio sbagliato è comunque da buttare.
2. **Il database è il giudice, non l'LLM.** Nessuna migrazione è "valida" perché sembra giusta: è valida se **applicata davvero** su un database pulito (`supabase db reset`) e passata alla batteria deterministica (`scripts/verify.mjs`). Se uno strumento non gira, si dichiara **verifica mancante** — mai un falso "tutto pulito". Vedi `references/verifica-deterministica.md`.
3. **Nessuna tabella nuda.** Ogni tabella raggiungibile dal client ha RLS **attiva** e policy **esplicite**, deny-by-default. Anche le viste (`security_invoker`) e le funzioni (`security definer` + `search_path`). Una tabella senza RLS in `public` su Supabase è un data leak pubblico, non un TODO. Vedi `references/rls-supabase.md`.

> Conflitti: vince la **costituzione** di Web Gun (`agenti/code-maniac/references/costituzione.md`): correttezza > sicurezza > leggibilità > type-safety > minimalismo > performance. Sullo schema, correttezza = *i dati non possono entrare in uno stato illegale*: il vincolo nel database batte sempre il controllo nell'applicazione.

## Regole non negoziabili delle migrazioni

- **Una migrazione applicata è immutabile.** Non si modifica, non si rinumera, non si cancella: si scrive quella nuova. Se è già in produzione, correggerla a mano rompe ogni ambiente allineato.
- **Niente distruttivo di default.** `drop column`, `drop table`, restringimento di tipo, `rename` → si passa da **expand-contract** (aggiungi, popola, sposta le letture, poi togli in una migrazione successiva). Vedi `references/migrazioni.md`.
- **Ogni distruttivo è un checkpoint umano**, anche in modalità pipeline: l'orchestratore non ha l'autorità di autorizzare una perdita di dati.
- **Un file di migrazione = un motivo.** Reversibile a mano o documentato come irreversibile.

## Modalità: interattiva vs pipeline

| | Chi conferma lo Specchio del dominio | Chi autorizza i distruttivi |
|---|---|---|
| **Interattiva** (sviluppatore) | l'umano, con un "sì" esplicito | l'umano |
| **Pipeline** (Web Gun automatico) | l'orchestratore (Prompt Smith), sulla base del brief | **sempre l'umano** |

In pipeline lo Specchio non sparisce: viene **scritto** in `docs/handoff/07-schema-forge.md` come "modello assunto", così l'errore di comprensione resta tracciabile invece di essere silenzioso. Vedi `DECISIONI.md` §1 del repo.

## Comandi

| Comando | Cosa fa | Dettaglio |
|---|---|---|
| `model` | Deriva entità, relazioni, cardinalità e regole di accesso dal brief; produce l'ERD Mermaid e **lo Specchio del dominio** | Flusso 1 · `references/modellazione.md` |
| `forge` | Genera la migrazione: DDL + vincoli + indici + trigger `updated_at` + RLS della prima ora | `references/modellazione.md` |
| `rls` | Genera o audita le policy RLS (per ruolo, per operazione), con gli indici che le reggono | `scripts/rls-audit.mjs` · `references/rls-supabase.md` |
| `seed` | Genera dati di seed **idempotenti e deterministici** (UUID fissi, `on conflict do nothing`) | `references/modellazione.md` §Seed |
| `verify` | **Il gate**: applica su DB pulito reale + batteria deterministica + audit RLS; riporta solo il residuo | `scripts/verify.mjs` |
| `types` | Rigenera i tipi TypeScript dallo schema (`supabase gen types`) — è l'output che consuma Fly UI | §Contratto d'uscita |
| `evolve` | Modifica di uno schema esistente in expand-contract, con analisi di impatto sui consumatori | `references/migrazioni.md` |
| `handoff` | Scrive `docs/handoff/07-schema-forge.md` secondo il contratto del `CLAUDE.md` | §Contratto d'uscita |

## Comando → procedura (cosa eseguo, in concreto)

- **`model`** → leggo brief e handoff precedenti (`docs/handoff/`), estraggo i **sostantivi del dominio** e li classifico (entità · attributo · relazione · lookup), definisco cardinalità e proprietà dei dati (*chi possiede questa riga?* — è la domanda che genera le policy dopo), genero l'ERD con `node <skill>/scripts/erd.mjs --from-model` e **STOP allo Specchio**.
- **`forge`** → una migrazione per aggregato coerente in `supabase/migrations/<timestamp>_<nome>.sql`, nell'ordine: tipi/lookup → tabelle → vincoli → indici → trigger → RLS. Ogni tabella nasce **già** con `enable row level security`: non esiste una finestra temporale in cui è nuda.
- **`rls`** → derivo le policy dalla mappa di proprietà dello step `model` (owner-based / tenant-based / role-based / public-read), una policy **per operazione e per ruolo**, con `(select auth.uid())` e l'indice sulla colonna di ownership. Poi `node <skill>/scripts/rls-audit.mjs`.
- **`seed`** → `supabase/seed.sql` idempotente: UUID costanti scritti a mano (mai `gen_random_uuid()` nel seed, o i test non sono riproducibili), `on conflict do nothing`, quantità minime ma sufficienti a far vedere ogni stato dell'interfaccia (lista vuota, lista lunga, caso limite).
- **`verify`** → `node <skill>/scripts/verify.mjs [--json]`: reset su DB locale pulito → `supabase db lint` → `squawk` sulle migrazioni → `sqlfluff` → `rls-audit` → `supabase test db` (pgTAP, se presente). All'utente riporto **solo il residuo** e l'elenco delle **verifiche mancanti**, mai i log grezzi.
- **`types`** → `supabase gen types typescript --local > src/lib/database.types.ts`. Rigenerati **a ogni migrazione**: tipi disallineati sono il modo n°1 in cui Fly UI costruisce sul falso.
- **`evolve`** → prima l'**analisi di impatto** (chi legge questa colonna? grep + tipi + handoff a valle), poi il piano expand-contract in migrazioni separate, poi STOP se c'è un distruttivo.
- **`handoff`** → scrivo il file di handoff con: entità e relazioni finali, decisioni e deroghe, modello di accesso (chi vede cosa), path dei tipi generati, problemi noti e residui di `verify`.

## Flusso 1 — Nuovo schema (dal brief alla migrazione verificata)

1. **Leggi il contesto** — brief, `docs/PROGETTO.md`, handoff precedenti. Se manca il brief, **fermati**: non si modella per indovinare.
2. **Estrai il dominio** — entità, attributi, relazioni, cardinalità, cicli di vita (uno stato che cambia = una macchina a stati da vincolare, non un campo libero).
3. **Mappa la proprietà dei dati** — per ogni tabella: *chi può leggerla, chi può scriverla, in base a cosa*. Questa mappa **è** la specifica delle policy RLS: se non sai rispondere, non sai ancora modellare.
4. **Specchio del dominio → STOP.** Riformuli entità, relazioni e regole d'accesso in linguaggio semplice + ERD. Non scrivi SQL prima del "sì" (o della conferma dell'orchestratore in pipeline).
5. **Forgia** — migrazione(i) nell'ordine canonico, RLS inclusa alla nascita.
6. **Seed** — idempotente e deterministico.
7. **Verifica** — `verify` su DB pulito. Finché il gate è rosso, lo schema non esiste.
8. **Tipi + handoff** — `types` poi `handoff`. Il passaggio a valle non è valido senza entrambi.

## Gate di chiusura (riporta OGNI voce come PASS / FAIL / MANCANTE)

- [ ] `supabase db reset` eseguito **davvero** su DB pulito: tutte le migrazioni applicate in ordine senza errori
- [ ] Seed eseguito, idempotente (due reset di fila = stesso stato)
- [ ] **RLS attiva su ogni tabella** degli schemi esposti · nessuna tabella con RLS ma zero policy · nessuna `using (true)` non documentata
- [ ] Viste esposte con `security_invoker = on` · funzioni `security definer` con `set search_path = ''`
- [ ] Ogni chiave esterna e ogni colonna usata nelle policy hanno un indice
- [ ] Vincoli di integrità nel database (not null, check, unique, `on delete` esplicito su ogni FK) — non solo nell'applicazione
- [ ] `squawk` senza operazioni pericolose non motivate · `db lint` pulito · `sqlfluff` pulito
- [ ] Tipi TypeScript rigenerati e allineati allo schema
- [ ] `docs/handoff/07-schema-forge.md` scritto, con deroghe e residui
- [ ] Nessuna verifica dichiarata "ok" senza averla eseguita (strumento assente = **MANCANTE**, non PASS)

Se una sola casella è vuota, lo schema **non è consegnabile**.

## Contratto d'uscita (cosa trova chi viene dopo)

```
supabase/migrations/*.sql     migrazioni applicabili in ordine su DB pulito
supabase/seed.sql             seed idempotente
supabase/tests/*.sql          test pgTAP delle policy (se presenti)
src/lib/database.types.ts     tipi TypeScript rigenerati
docs/handoff/07-schema-forge.md   modello, decisioni, accessi, residui
docs/schema/ERD.md            diagramma Mermaid rigenerabile (scripts/erd.mjs)
```

## Come parla Schema Forge

- **Lo Specchio del dominio è in italiano semplice**, non in SQL: l'umano deve poter dire "no, un ordine può avere più indirizzi" senza leggere DDL.
- **Il residuo di `verify` è compresso**: lista di problemi per gravità, mai i log degli strumenti.
- Il diagramma non lo disegna l'LLM: lo stampa `scripts/erd.mjs` dallo schema reale.

## Indice references

- `references/modellazione.md` — regole di modellazione: naming, chiavi, tipi, vincoli, indici, seed
- `references/rls-supabase.md` — pattern RLS, errori classici, performance delle policy
- `references/migrazioni.md` — immutabilità, expand-contract, operazioni pericolose e lock
- `references/verifica-deterministica.md` — la batteria di strumenti, l'ordine, cosa blocca
- `references/pattern-ecommerce.md` — modello di riferimento e-commerce (il caso d'uso n°1 di Web Gun)
