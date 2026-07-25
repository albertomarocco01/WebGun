# Stato — Schema Forge

- **Stato attuale:** v1.1 collaudata su Postgres reale (Supabase locale 17.6, Windows). Gli script hanno test propri (`node --test`, 49 verdi) e il gate `verify` è **verde su 7 passi su 7** sul banco di prova.
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

## Irrobustimento del 2026-07-25 (test prima, correzioni dopo)

I due bug qui sopra erano vivi dal primo giorno ed erano stati trovati **a mano**, sul campo: gli script non avevano test propri perché regole e I/O erano nello stesso file e le regole non si potevano eseguire senza un database. Ordine di lavoro: prima l'estrazione, poi i test, poi le correzioni.

- [x] **Logica pura estratta** — `scripts/audit-lib.mjs` (una funzione per regola + `auditAll`) e `scripts/erd-lib.mjs` (`costruisciErd`). `rls-audit.mjs` ed `erd.mjs` restano gusci di I/O: nessuna regola dentro. Estrazione verificata a comportamento invariato — 5 uscite (audit testo/JSON su schema sporco e pulito, ERD su entrambi) identiche byte per byte prima e dopo, confrontate con SHA-256.
- [x] **Test degli script** — `node --test "scripts/**/*.test.mjs"`: **49 verdi**. Per ognuna delle 6 regole un caso in cui scatta con la gravità attesa e uno in cui non deve scattare; i due bug del collaudo sono test di regressione permanenti (rese `'true'/'t'` e `'false'/'f'`; campo con `\r` in coda che non deve rompere né il confronto con l'espressione della policy né la ricerca dell'indice).
- [x] **`force row level security`** — l'audit lo verifica: RLS attiva ma non forzata → `warn` (`enable` non vale per il proprietario della tabella). Una tabella senza RLS ha già il suo `block` e non riceve anche il warn.
- [x] **Booleani esenti dalla regola 6** — una colonna booleana usata in una policy e non indicizzata non produce più un `warn`: due valori distinti non giustificano un indice pieno, che rallenta ogni scrittura per niente. Sulle altre colonne il suggerimento propone anche l'indice parziale.
- [x] **ERD: cardinalità 1:1 e qualificazione dello schema** — una FK il cui insieme di colonne è anche unico (o chiave primaria) rende `||--||`; un'entità fuori dagli schemi richiesti prende il nome qualificato (`auth_users`), così due tabelle omonime in schemi diversi non collidono. `profiles` compare ora come `auth_users ||--|| profiles`.
- [x] **`verify.mjs`: un ritentativo su `supabase db reset`** — e solo su quello. Se il secondo tentativo riesce il passo è `pass`, ma il dettaglio dichiara *"riuscito al secondo tentativo"*: l'instabilità dell'ambiente resta visibile invece di sparire. Il dettaglio si stampa anche sui passi verdi, altrimenti quella riga non la leggerebbe nessuno.
- [x] **Configurazioni dei linter** — `resources/config/.sqlfluff` e `resources/config/squawk.toml`, ogni esenzione con la motivazione sulla riga sopra. Il gate **non** è stato declassato: `verify.mjs` passa le configurazioni agli strumenti (percorsi risolti sulla cartella della skill) e `forge` le copia nel progetto generato. Vedi `DECISIONI.md` §8.
- [x] **Denaro in `bigint` di centesimi** — `prefer-bigint-over-int` non è stata disattivata: aveva ragione. Corrette `references/modellazione.md` e `references/pattern-ecommerce.md`. Vedi `DECISIONI.md` §9.
- [x] **Ricollaudo** — schema sporco: i 6 difetti tutti rilevati con la stessa gravità (4 block, 2 issue, 1 warn) più 4 nuovi `warn` su `force row level security` dove manca. Schema pulito aggiornato a `bigint` e a `force row level security`: **gate VERDE, 7 passi su 7**, zero rilievi residui di sqlfluff e squawk.

### Note operative (Windows)

- `sqlfluff` e `squawk` stanno in `%APPDATA%\Python\Python314\Scripts`: la cartella è nel PATH utente permanente, entrambi rispondono in una shell nuova.
- `node --test scripts/` **non** funziona su Node 24: i percorsi passati a `--test` sono trattati come pattern glob, non come cartelle. Il comando è `node --test "scripts/**/*.test.mjs"`.

## Aperto — decisioni per l'umano

- **Il Flusso 1 conversazionale non è ancora provato.** Sono collaudati gli script; il giro `model` → Specchio del dominio → `forge` → `seed` → `verify` → `types` → `handoff` su un e-commerce di prova, dal brief all'handoff, resta da fare. È l'unica casella vuota del collaudo del 2026-07-24.
- **La copia delle configurazioni dei linter da parte di `forge` è documentata in `SKILL.md`, non automatizzata da uno script.** Finché `forge` è una procedura che esegue l'agente, dipende dall'agente che la esegua.
- **`code-maniac scan` sul repo di regia riporta 10 passi saltati su 10** (nessuno strumento installato: il repo non è un progetto npm). Vale `MANCANTE`, non `PASS`: gli script di Schema Forge non sono passati sotto lint, tipi, complessità, duplicati e segreti in modo deterministico.

## Decisioni prese

- Lo Specchio del dominio ha due modalità (interattiva / pipeline): in pipeline conferma l'orchestratore, ma il modello assunto viene **scritto** nell'handoff. I distruttivi restano sempre checkpoint umano. Risponde a `DECISIONI.md` §1 senza toccare code-maniac.
- La verifica passa dal database reale (`supabase db reset`), non dalla lettura dell'SQL: uno strumento assente produce `skipped`, mai `pass`.
- Le regole stanno nelle `*-lib.mjs`, i gusci fanno solo I/O: una regola senza test è una regola che può essere spenta da un anno senza che nessuno lo sappia. Una regola nuova si aggiunge nella lib, col suo test.
- I linter si configurano, il gate non si declassa (`DECISIONI.md` §8).
