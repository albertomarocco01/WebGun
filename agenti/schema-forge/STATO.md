# Stato — Schema Forge

- **Stato attuale:** v1.2 — collaudata su Postgres reale (Supabase locale, Windows) **e nel comportamento**: il Flusso 1 conversazionale, `evolve` e i gate sono stati provati sul campo il 2026-07-25 (`COLLAUDO-2026-07-25.md`). Gli script hanno test propri (`node --test`, 49 verdi), passano sotto i guardiani, e il gate `verify` è verde su 7 su 7 su uno schema nuovo. **Non ancora usabile su un cliente vero senza la correzione n°1 qui sotto.**
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
- [x] Un giro completo del Flusso 1 su un e-commerce di prova, dal brief all'handoff — **fatto il 2026-07-25** (vedi `COLLAUDO-2026-07-25.md`)

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
- **I tipi si generano da Git Bash, non con la redirezione di PowerShell.** `supabase gen types … > file.ts` in PowerShell scrive UTF-16 con CRLF: il confronto di `verify.mjs` fallisce sempre e il passo resta rosso senza motivo apparente.
- `psql` non è nel PATH di default su questa macchina: sta in `%USERPROFILE%\scoop\apps\postgresql\current\bin`. Senza, `rls-audit.mjs` ed `erd.mjs` escono con `psql non disponibile nel PATH` e il gate registra una **verifica mancante** (correttamente, ma il messaggio va letto).

## Aperto — decisioni per l'umano

- ~~**Il Flusso 1 conversazionale non è ancora provato.**~~ — **chiuso il 2026-07-25**: giro completo eseguito sul brief «Pastificio Ferrero» (`COLLAUDO-2026-07-25.md`). Ne escono i punti qui sotto, tutti **nuovi**.

### Da decidere dopo il collaudo del comportamento (2026-07-25)

Elenco completo, motivazioni e correzioni proposte in `COLLAUDO-2026-07-25.md` §Report finale. In ordine di gravità:

1. **Un distruttivo autorizzato tiene il gate rosso per sempre.** `squawk` segnala `ban-drop-column` e non legge le motivazioni in prosa; le migrazioni sono immutabili, quindi il rilievo non se ne va più. Cioè: **usare `evolve` come previsto rende il progetto permanentemente non consegnabile.** La via d'uscita esiste ed è stata verificata (`-- squawk-ignore ban-drop-column` sulla riga sopra, con la motivazione accanto) ma **non è scritta da nessuna parte** — e va messa *prima* di applicare la migrazione. **Blocca l'uso su un cliente vero.**
2. **`verify.mjs` non passa mai `--schemas` all'audit RLS**: gli schemi diversi da `public` non sono coperti dal gate, benché `rls-audit.mjs` li supporti e li documenti. Provato: una tabella nuda in uno schema secondario passa con `OK`.
3. **`forge` copia `.sqlfluff` e `squawk.toml` solo se l'agente si ricorda di farlo**, e nulla lo verifica (il gate usa le configurazioni della skill, quindi resta verde comunque). Idem per l'esistenza dell'handoff. Due controlli in `verify.mjs` chiuderebbero entrambi.
4. **`SKILL.md` prescrive `erd.mjs --from-model`, che non esiste**: al passo `model` il database non c'è ancora, quindi l'ERD dello Specchio lo disegna per forza l'LLM — in contraddizione con «il diagramma non lo disegna l'LLM».
5. **Il Flusso 1 mette `verify` prima di `types`**: il primo `verify` di ogni progetto è sempre rosso sul passo dei tipi.
6. **Voci mancanti nelle references** (tutte incontrate sul brief vero): listini differenziati per tipo cliente · un dato riservato è una tabella, non una colonna (la RLS è per riga) · pagamento differito con stato separato dalla consegna · un brief che contraddice un pattern diventa una **domanda dello Specchio**, non una decisione dell'agente · in `evolve`, riportare al committente i dati che smentiscono la sua richiesta, ed esportarli prima di un `drop`.
7. **In pipeline, le domande dello Specchio senza risposta nel brief non hanno procedura**: l'orchestratore finisce per "confermare" assunzioni che nessuno ha preso.
8. **`seed.sql` non è ri-eseguibile su un database caldo** se esistono trigger di dominio: `on conflict do nothing` non li previene.
- ~~**`code-maniac scan` sul repo di regia riporta 10 passi saltati su 10**~~ — **chiuso il 2026-07-25** (vedi §Guardiani sugli script, sotto).

## Guardiani sugli script della skill (2026-07-25)

Gli script degli agenti passano sotto i guardiani **come qualsiasi altro codice** (CLAUDE.md, Regola dei guardiani). Predisposto il minimo perché la batteria giri sui soli `scripts/` della skill, senza trasformare il repo di regia in un progetto applicativo:

- `agenti/schema-forge/package.json` — `"type": "module"`, `private: true`, tre devDependencies (`@eslint/js`, `eslint`, `jscpd`, `knip`)
- `agenti/schema-forge/eslint.config.mjs` — `js.configs.recommended` più le soglie di complessità (`complexity 15`, `max-depth 4`, `max-params 4`)
- `agenti/schema-forge/knip.jsonc` — entry point CLI dichiarati, ogni esenzione con la motivazione sulla riga sopra
- `node_modules/` e `.jscpd/` in `.gitignore`: si reinstallano con `npm install` dalla cartella dell'agente

**Residuo reale di `node agenti/code-maniac/scripts/scan.mjs`: 0 passi con problemi, 6 saltati su 10.**

| Passo | Esito |
|---|---|
| Lint (ESLint) · Complessità · Codice morto (knip) · Duplicati (jscpd) | **PASS** |
| Prettier · tsc · convenzioni · dependency-cruiser | MANCANTE — non pertinenti qui (niente TypeScript, niente grafo di moduli da validare) |
| **semgrep · gitleaks** | **MANCANTE — non installati.** Regole di sicurezza e ricerca di segreti sugli script **non verificate**: vale `MANCANTE`, non `PASS` |

Corretto solo ciò che era oggettivo: quattro `export` inutilizzati (`pulisci`, `vero` in `audit-lib.mjs` e `erd-lib.mjs` — usati solo dentro il proprio file: superficie pubblica senza consumatori) e `@eslint/js` non dichiarato fra le dipendenze. **I 49 test restano verdi** dopo le correzioni.

Scelte di stile discutibili **elencate e non toccate**: `pulisci`, `vero` e `riga` sono triplicati identici fra `audit-lib.mjs` e `erd-lib.mjs` (jscpd non li segnala, sono sotto ogni soglia); estrarli in un terzo modulo accoppierebbe due librerie volutamente indipendenti, quindi la duplicazione resta una decisione, non una svista.

**Stesso trattamento per `verify.mjs`**: lo script del gate è dentro `scripts/` e rientra nella stessa batteria — è già coperto da questo scan (ESLint, complessità, knip, jscpd verdi) e dai propri test (`verify.test.mjs`). Da qui in avanti, **ogni nuovo script di un agente nasce dentro questo perimetro**: se un agente aggiunge uno script, aggiunge anche il proprio `package.json`/`eslint.config.mjs` locale, oppure lo script non è consegnabile.

## Decisioni prese

- Lo Specchio del dominio ha due modalità (interattiva / pipeline): in pipeline conferma l'orchestratore, ma il modello assunto viene **scritto** nell'handoff. I distruttivi restano sempre checkpoint umano. Risponde a `DECISIONI.md` §1 senza toccare code-maniac.
- La verifica passa dal database reale (`supabase db reset`), non dalla lettura dell'SQL: uno strumento assente produce `skipped`, mai `pass`.
- Le regole stanno nelle `*-lib.mjs`, i gusci fanno solo I/O: una regola senza test è una regola che può essere spenta da un anno senza che nessuno lo sappia. Una regola nuova si aggiunge nella lib, col suo test.
- I linter si configurano, il gate non si declassa (`DECISIONI.md` §8).
- **Interi a `bigint` per default, non solo il denaro** (`references/modellazione.md`): il tipo largo costa 4 byte per riga, allargarlo dopo è un `alter column type` sotto lock esclusivo. `integer` solo dove il limite è strutturale e dimostrabile, e si motiva.
- **Gli script degli agenti passano sotto i guardiani come qualsiasi altro codice**: ogni agente che aggiunge uno script aggiunge il proprio `package.json`/`eslint.config.mjs` locale, altrimenti lo script non è consegnabile.
