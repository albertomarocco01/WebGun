# Stato — Schema Forge

- **Stato attuale:** v1.3 — collaudata su Postgres reale (Supabase locale, Windows), **nel comportamento** (`COLLAUDO-2026-07-25.md`) e **corretta**: gli otto punti aperti del collaudo sono chiusi il 2026-07-26 (§Correzioni del 2026-07-26). Gli script hanno test propri (`node --test`, **66 verdi**), passano sotto i guardiani, e il gate `verify` è **VERDE su 8 passi su 8** sullo schema del banco *dopo* un `evolve` con due distruttivi autorizzati — il caso che prima restava rosso per sempre. **Usabile su un progetto cliente**, con le verifiche mancanti dichiarate in fondo.
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
- **`SUPABASE_DB_URL` non serve più e conviene non impostarla.** Da `verify` il database lo decide `[db].port` del `config.toml` del progetto. Lanciando gli script **a mano** (`rls-audit.mjs`, `erd.mjs`) su un progetto con porta non standard, passa `--db-url`: il default resta 54322, che con più stack accesi è il database di qualcun altro.

## Correzioni del 2026-07-26 (chiusura degli otto punti del collaudo)

Tutti e otto i punti aperti dal collaudo del comportamento sono chiusi. Ognuno **verificato sul campo**, non solo scritto.

| # | Punto del collaudo | Correzione | Prova |
|---|---|---|---|
| 1 | Un distruttivo autorizzato teneva il gate rosso per sempre | `references/migrazioni.md` §Il distruttivo autorizzato e il gate: ricetta completa `-- squawk-ignore`, più il richiamo in `SKILL.md` §Regole non negoziabili e §`evolve` | banco: `squawk` **OK**, gate **VERDE 8/8** con i due `drop column` di `evolve` in casa |
| 2 | `verify.mjs` auditava solo `public` | `schemiEsposti()` legge `[api].schemas` da `supabase/config.toml` e li passa tutti a `rls-audit` | tabella nuda in schema `privato` esposto → `[block] privato.log_interno: RLS non attiva`, gate rosso (prima: `OK`) |
| 3 | Nessuno verificava le configurazioni copiate né l'handoff | ottavo passo del gate, `contrattoUscita()`: `.sqlfluff`, `squawk.toml`, handoff esistente e senza segnaposto `{{` | 4 test unitari + passo verde sul banco |
| 4 | `erd.mjs --from-model` non esiste | `SKILL.md`: l'ERD dello Specchio è una **proposta** disegnata a mano (lì il database non c'è), quello di `docs/schema/ERD.md` è una **fotografia** generata. Se divergono ha ragione il secondo | — |
| 5 | Il Flusso 1 metteva `verify` prima di `types` | Flusso 1 riordinato: forgia → seed → **tipi** → **handoff** → **verifica ultima**. Un rosso strutturale insegna a ignorare il rosso | il gate del banco è verde al primo colpo |
| 6 | Voci mancanti nelle references | `pattern-ecommerce.md`: §Listini + `paid` fuori dalla catena col pagamento differito · `rls-supabase.md`: §La RLS è per riga, non per colonna + pattern 3b (tenant con ruoli di ambito diverso) · `migrazioni.md`: dati che smentiscono la richiesta, export prima del `drop`, backfill non meccanico = domanda di dominio · `SKILL.md` Flusso 1 passo 4: brief in conflitto col pattern → domanda dello Specchio | — |
| 7 | In pipeline le domande senza risposta non avevano procedura | `SKILL.md` §Modalità: assunzione esplicita col default e la conseguenza; se l'assunzione è **strutturale** (carrello, albero categorie, multi-tenant, listini, proprietà delle righe) la pipeline **si ferma** | — |
| 8 | `seed.sql` non ri-eseguibile a caldo coi trigger di dominio | `modellazione.md` §Seed: `on conflict do nothing` protegge dai vincoli unici, non dai trigger — forma sicura `insert … select … where not exists` | — |

### Due bug trovati durante la correzione (non erano nel report)

Entrambi **veri**, entrambi capaci di rendere silenziosamente inutile il gate. Trovati facendo girare il gate corretto su un progetto **vero**, non sul banco.

1. **L'audit RLS crashava su ogni policy con una sottoquery.** `pg_policies.qual` viene deparsato **su più righe**; il guscio divideva l'uscita di `psql` per riga, quindi il record si spezzava, i campi diventavano `undefined` e lo script moriva. `verify` lo registrava come **verifica mancante** — cioè il controllo che «non può mancare» mancava proprio sugli schemi seri, che sono quelli con le policy complesse. Il banco non lo mostrava: le sue policy stanno tutte su una riga. Corretto col **separatore di record** di psql (`-R \x1e`) in `rls-audit.mjs` ed `erd.mjs`, regola pura `righeDaPsql()` in entrambe le lib, con 4 test di regressione. Verificato su un progetto reale da 150 warn: prima crash, ora audit completo.
2. **Il gate auditava il database sbagliato.** `rls-audit.mjs` ripiega su `SUPABASE_DB_URL` o sulla porta 54322; `verify.mjs` non gli passava mai un URL. Con due stack Supabase accesi — normale su una macchina di sviluppo — il gate applicava le migrazioni su un database e auditava **quello di un altro progetto**, riportando `OK`. Corretto con `urlDbProgetto()`: la porta viene da `[db].port` del `config.toml` del progetto, la stessa che usa il CLI per `db reset`. Precedenza: `--db-url` esplicito > `config.toml` > mai l'ambiente. Il database auditato ora si **stampa** nel dettaglio del passo.

**Test: da 49 a 66.** Nessuna regola allargata: ogni correzione rende il gate più severo o più veritiero.

## Aperto — decisioni per l'umano

- ~~**Il Flusso 1 conversazionale non è ancora provato.**~~ — chiuso il 2026-07-25 (`COLLAUDO-2026-07-25.md`).
- ~~**Gli otto punti del collaudo del comportamento**~~ — chiusi il 2026-07-26 (tabella qui sopra).
- ~~**`code-maniac scan` sul repo di regia riporta 10 passi saltati su 10**~~ — chiuso il 2026-07-25 (§Guardiani sugli script).

### Resta aperto

1. **semgrep e gitleaks non sono installati**: sicurezza e segreti sugli script della skill restano **MANCANTI**, non `PASS`. È l'unica casella del gate dei guardiani che non si può spuntare senza installarli.
2. **`code-inquisition --scope diff` non è mai stato eseguito** sui punti critici (policy RLS, dati utente), benché la Regola dei guardiani del `CLAUDE.md` lo richieda.
3. **Nessun consumatore reale a valle.** L'analisi di impatto di `evolve` ha girato su un progetto senza codice applicativo: il caso facile. Fly UI e Gestionale Crafter non esistono ancora.
4. **Il comando `rls` non è mai stato collaudato da solo** (esercitato dentro `forge` e `verify`), né il carrello persistito, né uno schema con viste materializzate.

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
- **Un distruttivo autorizzato si dichiara al gate**, non lo si aggira: `-- squawk-ignore <regola>` da solo sulla sua riga, motivazione nelle righe sopra, autorizzazione umana come precondizione. È il modo di registrare chi se n'è preso la responsabilità, non un interruttore per far passare il rosso.
- **Il gate parla del database che ha davvero guardato**: schemi auditati e URL del database si stampano sempre nel dettaglio del passo. Un audit su metà database, o sul database di un altro progetto, non deve poter assomigliare a un audit completo.
- **`verify` è l'ultimo passo, non il penultimo.** Tipi e handoff si producono prima: un gate che nasce rosso per come è ordinato il flusso insegna a ignorare il rosso.
