# Stato — Schema Forge

- **Stato attuale:** v1 collaudata su Postgres reale (Supabase locale 17.6, Windows). Gli script fanno il loro lavoro; il gate `verify` resta rosso su sqlfluff e squawk per regole di default in conflitto con le convenzioni della skill — vedi *Aperto*.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: prompt-smith (richiesta professionale), brief-smith (entità e contenuti del cliente)
  - A valle: fly-ui (costruisce sulle tabelle e sui tipi generati), gestionale-crafter (CRUD), sanity-creator (mappa i contenuti sul modello), ai-specialist (RAG sui dati)
- **Guardiani:** code-maniac e code-inquisition valutano l'SQL e gli script come qualsiasi altro codice.

## Collaudo del 2026-07-24 (banco di prova Supabase locale)

- [x] `scripts/verify.mjs` su un progetto Supabase vero, con Docker attivo — 5 passi su 7 verdi (`db reset`, `db lint`, audit RLS, pgTAP, tipi TypeScript), 0 verifiche mancanti
- [x] `scripts/rls-audit.mjs` su uno schema con RLS reale — **schema sporco:** 6 difetti piantati su 6 rilevati con la gravità attesa; **schema pulito:** nessun falso positivo (`nessun problema rilevato`)
- [x] `scripts/erd.mjs` su uno schema con 5 chiavi esterne — Mermaid validato dal parser ufficiale di mermaid (`diagramType: er`)
- [x] Seed idempotente — due `supabase db reset` di fila e una riesecuzione di `seed.sql` sullo stesso database danno gli stessi conteggi
- [ ] Un giro completo del Flusso 1 su un e-commerce di prova, dal brief all'handoff — **non fatto**: collaudati gli script, non il flusso conversazionale (`model` → Specchio → `forge` → `handoff`)

### Bug corretti durante il collaudo

1. **CRLF di psql su Windows.** `query()` faceva `split("\n")`, quindi l'ultimo campo di ogni riga finiva con `\r`. Conseguenza: la regola 6 di `rls-audit` (colonna di policy non indicizzata) non scattava **mai**, perché confrontava `"owner_id\r"`. Corretto in `rls-audit.mjs` e `erd.mjs` con `split(/\r?\n/)`.
2. **Cast booleano.** `boolean::text` in Postgres rende `'true'/'false'`, non `'t'/'f'`; gli script confrontavano con `"t"`. Conseguenza su `rls-audit`: la regola 1 segnalava **ogni** tabella come priva di RLS e la regola 1b (RLS attiva senza policy) era codice morto. Conseguenza su `erd.mjs`: nessun marcatore PK/FK, nessun `"obbligatorio"`, cardinalità sempre facoltativa. Corretto con un helper `vero()` che accetta entrambe le rese.

Nessuna regola è stata allargata: entrambe le correzioni rendono i controlli più severi.

## Aperto — decisioni per l'umano

- **sqlfluff e squawk senza configurazione bloccano il gate.** Su una migrazione realistica restano 8 rilievi sqlfluff (RF04: `name` e `label` sono parole chiave SQL, ma sono i nomi imposti da `references/pattern-ecommerce.md`; PG01: `create index concurrently`, impossibile dentro la transazione di una migrazione Supabase) e 27 rilievi squawk (`prefer-robust-stmts`, `prefer-bigint-over-int` in conflitto con `references/modellazione.md` che vuole i centesimi in `integer`, `require-concurrent-index-creation`). Serve decidere: la skill distribuisce un `.sqlfluff` e uno `squawk.toml` nei progetti generati, oppure `verify.mjs` tratta questi due passi come non bloccanti.
- **`supabase db reset` è saltuariamente instabile** (`Error status 502` durante il riavvio dei container): il passo viene registrato `fail` e il gate diventa rosso per un motivo ambientale. Da valutare un ritentativo in `verify.mjs`.
- **`erd.mjs` non qualifica lo schema:** una FK verso `auth.users` produce un'entità `users` senza attributi, e due tabelle omonime in schemi diversi collidono. Le cardinalità 1:1 (FK che è anche chiave primaria, es. `profiles`) vengono rese come 1:N.
- **`rls-audit` non controlla `force row level security`**, consigliato da `references/rls-supabase.md`.
- Nessun test automatico degli script stessi: i due bug sopra sono stati trovati a mano, sul campo.

## Decisioni prese

- Lo Specchio del dominio ha due modalità (interattiva / pipeline): in pipeline conferma l'orchestratore, ma il modello assunto viene **scritto** nell'handoff. I distruttivi restano sempre checkpoint umano. Risponde a `DECISIONI.md` §1 senza toccare code-maniac.
- La verifica passa dal database reale (`supabase db reset`), non dalla lettura dell'SQL: uno strumento assente produce `skipped`, mai `pass`.
