# Stato — Schema Forge

- **Stato attuale:** v1.6 — collaudata su Postgres reale (Supabase locale, Windows), **nel comportamento** (`COLLAUDO-2026-07-25.md`) e **corretta quattro volte**: gli otto punti del primo collaudo il 2026-07-26, nove dei quindici del secondo il 2026-07-27, i residui dell'audit multiagentico del repo il 2026-07-28 (§Cosa ha trovato l'audit del repo) e il contratto d'uscita sui privilegi il 2026-08-03 (§I privilegi non erano nel contratto d'uscita). Gli script hanno test propri (`node --test`, **156 verdi** — il 144° è nato con la firma del gate, commit `a92b4f1`; i due del 2026-08-03 mattina con P.0-igiene; i sette del pomeriggio con la regola 7 riscritta; il 154° è il test junction di P.0-igiene-2, 2026-08-04; i due del 2026-08-06 con il rilievo semgrep sulla regola 6, P.7c punto 3), il gate `verify` ha **9 passi** e undici regole di audit.
  **NON ancora usabile su un progetto cliente — ma il gate ha smesso di mentire.** Il secondo collaudo, indipendente e avversario (`COLLAUDO-2026-07-26.md`, dominio **non e-commerce**), aveva riprodotto con comandi reali **16 difetti su 17**, cinque Critical, su uno schema che il gate dichiarava **VERDE 8/8** (i passi erano otto: `db advisors` e' nato il giorno dopo). Su quello stesso schema il gate chiude ora **ROSSO**: `block` sull'auto-promozione di ruolo via colonna, `issue` sulla macchina a stati aggirabile in `insert`, e `block` su ogni tabella con policy di scrittura che nessun test pgTAP attacca. Scritti i test negativi, **2 asserzioni su 23 falliscono** — l'auto-promozione e la visita che nasce già `fatturata`. Resta vero che **l'audit guarda la forma delle policy**: la semantica la dimostrano i test negativi, e il gate verifica che esistano e passino, non che siano severi. Punti aperti ordinati per gravità in fondo.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: prompt-smith (richiesta professionale), brief-smith (entità e contenuti del cliente)
  - A valle: gestionale-crafter (CRUD sulle tabelle e sui tipi generati), flow-sentinel (il modello di accesso di questo handoff è la fonte dei suoi flussi ostili), speed-demon (misura l'app costruita sopra), ai-specialist (RAG sui dati). **Fly UI non esiste**: deroga in `../../DECISIONI.md` §21, e questa riga lo elencava a valle
- **Guardiani:** code-maniac e code-inquisition valutano l'SQL e gli script come qualsiasi altro codice.
- **2026-08-03 — il gate non partiva sul Node di sistema, e usciva `0` muto.** *Il difetto:* l'epilogo era `if (import.meta.main) main();`, e `import.meta.main` è arrivato in **Node 24**; su Node 20.12.2 — l'unico Node di sistema di questa macchina — vale `undefined`, `main()` non girava e **il gate usciva `0` senza stampare una riga**, cioè un verde che non aveva guardato niente per chiunque lo lanciasse da script o da terminale. I prerequisiti dichiarati dicono «Node ≥ 20»: era il codice a violare il proprio contratto. I verdi storici non erano falsi — i collaudi di luglio giravano su Node 24.14. *La correzione:* la forma già collaudata di `vetrina-crafter`, `process.argv[1]` risolto e confrontato con `fileURLToPath(import.meta.url)`, a comportamento invariato su Node 24. *Come si è provata:* in una cartella non-progetto nelle **due direzioni** — prima Node 20 usciva `0` con zero righe e Node 24 usciva `2` con il messaggio, dopo **entrambi escono `2` con lo stesso messaggio**; e **sul banco `banco-prova-vetcare` col Node di sistema**, verdetto ROSSO (1 fallito, 2 verifiche mancanti su 9) identico alla misura fatta con Node 24. Due test di regressione in `scripts/verify.test.mjs` (144 → **146**): uno **funzionale** (lancia il gate in una cartella non-progetto e pretende uscita ≠ 0 e output non muto — copre tutta la classe «l'epilogo non parte», ma su Node 24 non vede *questo* difetto) e uno **statico** (il sorgente non contiene `import.meta.main` — l'unico dei due che lo impedisce su qualunque Node). Pacchetto P.0-igiene.

- **2026-08-06 — semgrep sugli script, la prima volta: 12 rilievi, uno vero (P.7c punto 3).** Configurazione dichiarata: `semgrep scan --config auto` (1.172.0, il profilo della casa — `references/motore-deterministico.md` di code-maniac: ruleset locale se c'è, altrimenti `auto`), **200 regole su 8 file, 100% di righe analizzate**. Esiti: **due `detect-child-process`** in `verify.mjs` (`run`/`has`, ERROR) → **falsi positivi provati**: nessuno dei due passa da `shell: true` — la scelta è scritta e motivata nel commento sopra `formaEseguibile` (CVE-2024-27980) — gli argomenti viaggiano come vettore e i nove nomi di comando sono letterali (`supabase`, `sqlfluff`, `squawk`, `node`). **Nove `detect-non-literal-regexp` + uno in `verify.mjs`**: otto sono falsi positivi con la prova a fianco — `NOMI_DI_PRIVILEGIO` è una lista ancorata `^(…)$` (regola 8: il nome non può contenere metacaratteri), `colonneDiTransizione` estrae i nomi con `([a-z_][a-z0-9_]*)` (regole 9), `valoreToml` riceve tre chiavi letterali, e `tentaScrittura` **già** passava da `perRegex`. **Uno era vero**, ed era l'unico punto in cui un nome arriva dal catalogo senza filtro: `regolaColonneDiPolicy` (regola 6) interpolava il nome della colonna grezzo. Un identificatore Postgres citato può contenere qualunque carattere, e i due danni misurati sul codice di ieri sono di specie diversa — `piano(a` → `SyntaxError: Invalid regular expression: /\bpiano(a\b/: Unterminated group` (e `rls-audit.mjs` non cattura: **l'audit RLS muore con lo stack trace**, cioè la verifica che «non può mancare» diventa un rosso che non parla dello schema), `a+b` → `\ba+b\b` **matcha `aaab`**, un `warn` su una colonna che la policy non nomina. Corretto con `perRegex`, che è stato spostato in cima al file perché vale per ogni nome del catalogo e non per l'ultima regola che ne aveva bisogno. Due test nuovi, entrambi **falsificati contro il codice pre-correzione** (uscite incollate nel verbale): batteria **154 → 156 verdi**. Il conteggio semgrep resta **12**: lo strumento non vede il sanitizzatore, quindi i rilievi restano *dichiarati*, non silenziati — nessun `nosemgrep` in questi file. **Il gate non è stato rilanciato**: richiede un Postgres vivo e D17 tiene acceso un solo stack, quello del pilota, di cui P.4g è proprietaria in scrittura; la modifica è nella libreria pura, che la batteria copre.

- **2026-08-06 — `gitleaks` installato e puntato: il MANCANTE storico è chiuso (P.7c punto 5).** `gitleaks` 8.30.1 (scoop, bucket `main`, shim su PATH). Su questi `scripts/`: **nessun rilievo**. Sul repo intero, perché i segreti sono il suo mestiere e non si fermano al perimetro di una skill: **storia** (`gitleaks git .`, 143 commit, 6,93 MB) **4 rilievi, 0 veri**; **disco** (`gitleaks dir .`, 179,72 MB) **26 rilievi, 0 veri** — 3 su file tracciati, e sono tutti e tre **fixture di rilevatori di segreti** (le stringhe finte che bugbay e launchpad usano per provare che il proprio rilevatore scatta), 23 in artefatti **non tracciati** dei banchi (`.next/`, `.env.local`) con la chiave demo locale di Supabase (payload `iss: supabase-demo`, la stessa su ogni macchina). Una cosa misurata che vale per chi userà lo strumento: `gitleaks git` trova il segreto **dove è stato introdotto**, non dove il file sta oggi — la fixture di bugbay è stata spostata in `agenti/bugbay/` da `b6796a0` come rinomina senza modifiche, e nella storia risulta ancora al percorso vecchio. Le due modalità non sono intercambiabili: `git` per la storia, `dir` per il disco.

- **2026-08-06 — `/code-inquisition` sugli script, la prima volta: dodici difetti di questa skill, e nessuno strumento ne vedeva uno (P.7c punto 4).** Referto completo con le uscite incollate: `../../INQUISIZIONE-GATE-2026-08-06.md`. Due concili, sette esperti, **due verificatori** che hanno rifatto le misure (chi scrive un rilievo non lo certifica). Lo stesso giorno, sugli stessi file: ESLint 0, semgrep 0 sui file dove i difetti vivono, gitleaks 0, batteria **156/156**. Quello che il tribunale ha trovato e la batteria deterministica non poteva vedere:
  - **CRITICAL — `where` cerca l'eseguibile anche nella directory corrente, che è il progetto auditato.** `verify.mjs:83`, e `dove()` non passa `cwd`. Un `supabase.cmd` piantato nella radice del progetto **vince sullo shim vero** (misurato). Un finto `supabase` che esca 0 su `--version` porta a casa `db-reset`, `db-lint`, `db-advisors`, `pgtap` e `tipi`; un finto `node` che stampi `{"summary":{"block":0},"findings":[]}` porta a casa l'audit RLS: **sei passi su nove**, compreso «il controllo che non può mancare». Quattro tentativi di smentita, tutti falliti. La correzione esiste in una sola riga di produzione in tutto il repo — `gestionale-crafter/scripts/verify.mjs:215` usa `process.execPath`.
  - **HIGH — un separatore di campo dentro un'espressione di policy sposta le colonne** (`rls-audit.mjs:34`, `audit-lib.mjs:55-61`): 7 campi → 2 findings compreso il `block`; **8 campi con `\x1f` in `qual` → 0 findings**. Nessun controllo di arità. Il commento «non compare mai nei nomi degli oggetti» è vero per i **nomi** e falso per il **testo libero** (`qual`, `with_check`, `prosrc`). **Trovato due volte da due concili che non si vedevano** — è l'unica conferma incrociata del referto. Raggiungibile solo di proposito: sabotaggio, non sfortuna.
  - **MEDIUM — `psql` senza `-X`**: un file di avvio cambia la forma dell'uscita, l'audit legge zero righe e `block === 0` esce **PASS, non `skipped`** (misurato dal verificatore: è la domanda che decide la gravità). Il rimedio è già in `gestionale-crafter/scripts/admin-audit.mjs:73`.
  - **MEDIUM — l'audit non dichiara mai quanti oggetti ha guardato**: il JSON di `rls-audit.mjs` ha `ok/dbUrl/schemas/findings/summary` e **zero campi di premessa**; `schemiEsposti(null)` — `config.toml` assente — ripiega su `public` in silenzio e stampa «schemi esposti: public» come se fosse la verità. `gestionale-crafter` ha già il guardiano equivalente (`if (misure.rotte === 0)`).
  - **MEDIUM — regola 10: un test pgTAP interamente commentato vale come test vero** (`audit-lib.mjs:633-652`, `block = 0`).
  - **MEDIUM — un commento TOML dentro l'array multi-riga produce schemi fantasma** (`verify.mjs:193`): `rls-audit` esce 2 e il passo diventa `skipped` accusando un `config.toml` che non è rotto.
  - **MEDIUM — nessun timeout**: 11 chiamate `psql` più `db reset`; contro un socket che accetta e non parla, psql resta appeso **oltre 40 secondi** (misurato). `conRitentativo` **attende il ritorno** del primo tentativo: se quello non torna, il ritentativo non parte mai.
  - **MEDIUM — l'URL di connessione con la password** finisce in stdout e nel `--json` (`verify.mjs:516`, `rls-audit.mjs:246`,`:257`). Oggi è `postgres:postgres` su loopback; torna grave il primo giorno in cui `--db-url` punta altrove. `vetrina-crafter/scripts/verify.mjs:378` maschera già.
  - **LOW — la riga della regex di `triggerCheNomina` non ha rete**: mutata a `return true`, **156/156 passano**. Le due clausole di guardia della stessa funzione la rete ce l'hanno (mutarle uccide 5 test).
  - **LOW — il commento «NON si usa `shell: true`»** è una garanzia falsa: `cmd.exe /c` è una shell.

  **Sorte**: tutti **dichiarati**, nessuno chiuso qui. Sono modifiche al comportamento del gate, e ognuna vuole un test che la falsifichi più il gate rilanciato su un banco vivo — che D17 non concede a questa chat (l'unico stack acceso è del pilota). Chiuderli a parole sarebbe la cosa che il referto rimprovera al codice.

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
- [x] **Configurazioni dei linter** — `resources/config/.sqlfluff` e `resources/config/squawk.toml`, ogni esenzione con la motivazione sulla riga sopra. Il gate **non** è stato declassato: `verify.mjs` passa le configurazioni agli strumenti (percorsi risolti sulla cartella della skill) e `forge` le copia nel progetto generato. Vedi `../../DECISIONI.md` §8.
- [x] **Denaro in `bigint` di centesimi** — `prefer-bigint-over-int` non è stata disattivata: aveva ragione. Corrette `references/modellazione.md` e `references/pattern-ecommerce.md`. Vedi `../../DECISIONI.md` §9.
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
| 3 | Nessuno verificava le configurazioni copiate né l'handoff | ultimo passo del gate, `contrattoUscita()` (l'ottavo allora, il nono da quando c'e' `db advisors`): `.sqlfluff`, `squawk.toml`, handoff esistente e senza segnaposto `{{` | 4 test unitari + passo verde sul banco |
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

### Banchi di prova rimossi

`banco-prova/` e `banco-prova-pastificio/` sono stati **cancellati il 2026-07-26**, a collaudo chiuso: erano progetti Supabase usa e getta e si rigenerano con `supabase init`. Restano i verbali (`COLLAUDO-2026-07-25.md`) e ciò che il collaudo ha prodotto — regole nelle references, test negli script. Il logo della skill, che stava dentro `banco-prova/`, è ora in `resources/branding/`.

`banco-prova-negozio/` — quello del consumatore a valle, otto tabelle, gate VERDE 9/9 — è stato **cancellato il 2026-07-30** dalla §25 di `../../DECISIONI.md`, con lo stesso criterio applicato in forma falsificabile: un banco si tiene solo se un clone pulito lo sa rilanciare, e a quello mancavano le chiavi gitignorate che il suo gate legge. Sta nel commit `67f9001` e torna con `git checkout 67f9001 -- banco-prova-negozio`.

**`banco-prova-vetcare/` resta, ed è l'unico.** È il caso di prova permanente di uno schema difettoso: il gate ci chiude ROSSO su due passi, e tutto ciò che il gate legge è tracciato — ciò che manca (`supabase/.branches/`, `supabase/.temp/`) lo riscrive `supabase start`. È il solo banco del repo su cui «il gate chiude rosso, e per questi due motivi» sia ancora un'affermazione che si rilancia invece che una che si ricorda.

## Collaudo indipendente del 2026-07-26 (`COLLAUDO-2026-07-26.md`)

Secondo collaudo, avversario, su un dominio **non e-commerce** (tre cliniche
veterinarie). Ha verificato le affermazioni di questo file invece di ereditarle,
e ha eseguito per la prima volta `/code-inquisition` sulle policy RLS.

**Cosa ha retto.** Flusso 1 su dominio nuovo: Specchio fermo davvero, 13 domande,
tutte le ambiguità attese emerse. Trappole per colonna, listini, pagamento
differito e `bigint` superate tutte da **regole scritte**. `evolve` con due
`drop table` autorizzati: gate **VERDE 8/8**. Audit su schema pulito: **0 warn**
su 20 tabelle e 64 policy — zero rumore.

**Cosa non ha retto.** Sullo stesso schema che il gate dichiara VERDE 8/8,
`/code-inquisition` ha **riprodotto con comandi reali 16 difetti su 17**, cinque
dei quali Critical, mentre `sqlfluff`, `squawk` e `rls-audit.mjs` erano **tutti
verdi**. Il gate verifica che la RLS *esista*, non che *funzioni*.

### Chiuso da questo collaudo

- ~~**`code-inquisition` non è mai stato eseguito** sui punti critici~~ — eseguito
  il 2026-07-26. Non era invocabile: `agenti/code-inquisition/` non era
  installato come skill. Creata la junction `.claude/skills/code-inquisition`
  (stessa procedura di `../../DECISIONI.md` §7). Referto in `COLLAUDO-2026-07-26.md` §8.2.
- ~~**Il comando `rls` non è mai stato collaudato da solo**, né uno schema con
  viste materializzate~~ — collaudati entrambi. Entrambi hanno prodotto un
  difetto: vedi i punti 2 e 5 qui sotto.

### Resta aperto — ordinato per gravità

1. ~~**Il gate è verde su uno schema sfruttabile.**~~ — **chiuso il 2026-07-27**
   (§Il gate ha smesso di essere verde su uno schema sfruttabile). Sullo stesso
   banco veterinario il gate chiude ora **ROSSO**: `block` sull'auto-promozione
   via colonna, `issue` sulla macchina a stati aggirabile in `insert`, e `block`
   su ogni tabella con policy di scrittura che nessun test pgTAP attacca.
   Scritti quei test, **2 asserzioni su 23 falliscono** — e sono esattamente due
   dei cinque Critical del tribunale. **Resta vero** che l'audit guarda la forma
   delle policy: la semantica la dimostrano i test negativi, e il gate verifica
   che esistano e passino, non che siano severi (vedi punto 16).
2. ~~**`SKILL.md`:62 fa auditare il database sbagliato.**~~ — **chiuso il
   2026-07-27**: il comando `rls` è stato **tolto** (`../../DECISIONI.md` §14). Le
   policy si scrivono in `forge`, si attaccano nel comando nuovo `test`, si
   verificano in `verify`. `rls-audit.mjs` resta lanciabile a mano e ora stampa
   sempre in testa **quale database** e **quali schemi** ha guardato.
3. ~~**Tre falsi verdi del gate**~~ — **chiusi tutti e tre il 2026-07-27**,
   ognuno riprodotto prima e dopo:
   - ~~`sqlfluff` salta in silenzio i file oltre 20 000 byte~~ → il gate misura i
     byte di ogni migrazione **prima** di lanciarlo: un file che sqlfluff non
     leggerà non può produrre `pass`. **La premessa del report era sbagliata**:
     l'avviso di sqlfluff esce su **stdout**, non su stderr (vedi §Due premesse
     smentite).
   - ~~`supabase/tests/` vuota → passo pgTAP `pass`~~ → si contano i file `.sql`,
     non si guarda se la cartella esiste. Misurato: `Result: NOTESTS`, uscita 0.
   - ~~senza `[db].port` l'audit ricade sulla 54322~~ → il passo è `skipped`.
     Senza un database risolvibile l'audit non può dire di aver auditato il
     progetto. La 54322 su questa macchina è `supabase_db_BaldisportV1`.
4. ~~**`schemas` su più righe non viene letto.**~~ — **chiuso il 2026-07-27**:
   `valoreToml()` accumula le righe fino alla quadra di chiusura. E una chiave
   `schemas` **presente ma illeggibile** non ripiega più su `public`: è una
   verifica mancante, e il passo è `skipped`.
5. ~~**Le viste materializzate sono `issue`, non `block`.**~~ — **chiuso il
   2026-07-27**, promosse a `block`. Premessa verificata sul database:
   `alter materialized view … set (security_invoker = on)` risponde
   `ERROR: unrecognized parameter "security_invoker"`. Sul banco veterinario non
   ci sono viste materializzate, quindi la promozione **non** rende il gate
   strutturalmente rosso; l'ho verificata piantandone una su uno schema usa e
   getta.
6. ~~**Due caselle del gate di chiusura che nessuno strumento verifica.**~~ —
   **chiusa la seconda** il 2026-07-27: il ruolo in colonna scrivibile ora è una
   regola dell'audit, che sul banco trova `staff.job_title` con `block`.
   **Resta aperta la prima** («nessun dato riservato in una colonna di una
   tabella leggibile»): quale colonna sia «riservata» è una domanda di dominio,
   non una proprietà del catalogo, e nessuna euristica sul nome la coprirebbe
   senza rumore. Difesa da prosa (`references/rls-supabase.md` §La RLS è per
   riga) e dai test negativi.
7. ~~**`resources/config/.sqlfluff` contro `references/rls-supabase.md`.**~~ —
   **chiuso il 2026-07-27**: `quoted_identifiers_policy = none` esenta i nomi di
   policy da `RF05` (solo i **quotati**: su un identificatore nudo la regola
   continua a scattare) e `ignore_words` passa da `name,label` a
   `name,label,role,summary`. Entrambe le esenzioni con la motivazione scritta
   nel file. Verificato: gli undici blocchi DDL delle quattro reference passano
   `sqlfluff` con la configurazione della skill, zero rilievi.
8. ~~**`rls-supabase.md`:90 dichiara un meccanismo falso.**~~ — corretto il
   2026-07-27 con la spiegazione **verificata al banco**: su `insert` Postgres nega
   ogni inserimento; su `update`/`all` riusa `using` come controllo sulla riga
   nuova, quindi `using (true)` senza `with check` è il buco e `using (ownership)`
   senza `with check` non lo è. È anche la regola `block` n°3 dell'audit.
9. ~~**Il contratto `--json` non è documentato né stabile.**~~ — **chiuso il
   2026-07-27**: `id` stabile per passo (separato dall'etichetta, che resta
   libera di cambiare), `contract`, `summary` per stato, `counts` per gravità
   dove ha senso. Documentato in `references/verifica-deterministica.md` §Il
   contratto `--json`, con un test che blocca gli id e il loro ordine.
   `../../DECISIONI.md` §15.
10. ~~**`pattern-ecommerce.md`:29 non regge fuori dall'e-commerce.**~~ — **chiuso
    il 2026-07-28.** §Clienti presenta ora **due** modelli, non uno: `profiles.id
    = auth.users.id` quando ogni cliente è per forza un utente, e `customers` con
    `auth_user_id` **facoltativo** (`unique`, `on delete set null`) quando non lo
    è. Scritta anche la conseguenza che si dimentica: con `auth_user_id is null`
    nessuna policy per `authenticated` raggiunge la riga, perché `null = null`
    non è vero e la riga sparisce **senza errore**. La domanda «il cliente ha per
    forza un account?» è entrata fra le assunzioni **strutturali** di
    `SKILL.md` §Modalità: senza risposta la pipeline si ferma.
11. **Il gate non può vedere un seed non rieseguibile a caldo.** `db reset` parte
    sempre da un database pulito, quindi la regola di `modellazione.md`:67
    (`insert … select … where not exists` coi trigger di dominio) — che è
    **vera**, verificata sul campo — resta non verificabile dal gate.
    **Correzione del 2026-07-28: non è "impossibile", è "non fatto".** La strada
    c'è ed è corta — rieseguire `supabase/seed.sql` sul database **caldo** dentro
    `passoReset`, subito dopo il reset riuscito, e fallire se solleva. Non è
    stata implementata perché la regola della casa dice che una premessa si prova
    su Postgres reale prima di diventare codice del gate, e provarla richiede un
    banco vivo con Docker: scriverla senza provarla sarebbe esattamente il modo
    in cui sono nate le tre premesse smentite di questo file. Costo: medio.
12. ~~**Sicurezza e segreti sugli script restano MANCANTI**~~ — **chiuso il
    2026-08-06** (P.7c punti 3 e 5). `semgrep` (1.172.0, `--config auto`)
    puntato su questi script per la prima volta: 12 rilievi, 11 falsi positivi
    con la prova a fianco e **uno vero**, corretto. `gitleaks` (8.30.1)
    installato e puntato: **nessun rilievo** su questi `scripts/`, 4 sulla
    storia del repo e 26 sul disco, **nessuno vero** (§2026-08-06). Resta vero
    il motivo per cui la riga esisteva: è l'unica difesa automatica contro una
    `service_role` finita nel client, e ora c'è.
13. ~~**Nessun consumatore reale a valle.**~~ — **chiuso il 2026-07-28**,
    riconfermato il 2026-07-30. Gestionale Crafter esiste e ha costruito un
    backoffice reale sopra uno schema di questa skill; l'analisi di impatto di
    `evolve` ha girato **con codice applicativo sopra** — rinomina di
    `site_content.body` in `corpo`, expand-contract completo — e il controllo
    più forte si è rivelato `tsc` sui tipi rigenerati: **15 errori in 4 file**,
    nessuna rottura arrivata a runtime. I tre limiti misurati della procedura
    stanno nell'appendice §Il primo consumatore a valle. Il 2026-07-30 il banco
    ha preso anche una batteria E2E (flow-sentinel, 16/16 la sera dello stesso
    giorno, 15/15 quando questa riga è stata scritta): da lì è arrivato il
    difetto del seed, §Il secondo consumatore a valle. **Fly UI** invece non
    esiste e non esisterà: deroga in `../../DECISIONI.md` §21.
14. ~~**`has()` non vede gli shim `.cmd` su Windows**~~ — **chiuso il
    2026-07-27**. Misurato: `spawnSync("finto-cli", ["--version"])` senza shell
    dà **ENOENT** (non consulta PATHEXT), e col **percorso pieno** dà **EINVAL** —
    Node rifiuta di eseguire `.cmd`/`.bat` senza shell dalla mitigazione della
    CVE-2024-27980. **Correggere la sola rilevazione avrebbe peggiorato le cose**:
    `has()` avrebbe detto sì e ogni `run()` sarebbe morto con un `fail` dal
    dettaglio vuoto. Corretti insieme, con `formaEseguibile()`: su win32 si
    risolve il percorso con `where` e, se è uno shim, si lancia
    `cmd.exe /c <percorso> <args>`. **Non** `shell: true` — lì gli argomenti
    vengono concatenati invece che passati come vettore, e questo gate passa
    percorsi con spazi (provato: con `cmd.exe /c` l'argomento con lo spazio
    arriva intero).
15. **Diciotto voci mancanti nelle references** (`COLLAUDO-2026-07-26.md` §1.2),
    ognuna con la frase esatta e il file esatto. **Le sei più gravi sono chiuse
    tutte**, le ultime cinque il 2026-07-28:
    - ~~M12 `revoke execute` sulle funzioni RPC~~ — 2026-07-27, ed è diventata
      anche una regola dell'audit (sul banco: 11 funzioni scoperte)
    - ~~M13 macchina a stati vincolata anche in `INSERT`~~ — 2026-07-27,
      `rls-supabase.md` §Macchine a stati + regola `issue` dell'audit
    - ~~M14 transizioni per **ogni** stato, non solo il principale~~ —
      `modellazione.md` §Vincoli: se un trigger difende un dato *guardando uno
      stato*, quello stato va vincolato a sua volta, o la difesa si aggira in tre
      mosse (indietro, modifica, avanti). Quella dimenticata è sempre l'entità di
      servizio — fattura, spedizione, ticket — non quella di cui parla il brief
    - ~~M15 trigger che scrive su tabella con RLS deve essere `security definer`~~
      — `rls-supabase.md`, sezione propria: gira coi diritti del **chiamante**, e
      il guasto non si vede come «l'audit non registra» ma come «il salvataggio
      non funziona», perché il trigger è nella stessa transazione
    - ~~M16 audit trail con la colonna dell'attore~~ — sezione propria: l'attore
      lo scrive il **trigger** dal contesto di sessione, mai il client; e
      «append-only» in un commento non è append-only, perché l'assenza di policy
      non ferma `service_role` — serve un trigger `before update or delete`
    - ~~M17 validazione degli argomenti di un RPC `security definer`~~ — sezione
      propria: estremi, ordine, orizzonte, nullità; e le violazioni di vincolo si
      catturano, perché il testo di un `exclusion_violation` contiene i valori
      della riga in conflitto, cioè di una riga che il chiamante non poteva
      leggere
    - ~~M18 il `with check` circolare~~ — non era fra le sei, ma è della stessa
      famiglia ed è la difesa che viene in mente per prima: una funzione `stable`
      chiamata dal `with check` legge lo snapshot **precedente** all'`update` e
      approva sempre. `rls-supabase.md` §Il caso peggiore, come quarta difesa che
      **non** funziona

    Restano aperte le voci non di sicurezza — M1-M4, M9, M11 — e le quattro nuove
    righe della tabella §Errori classici sono dichiarate **sotto la riga di
    separazione**: il gate non le guarda, e adesso c'è scritto quali e perché.

## Il gate ha smesso di essere verde su uno schema sfruttabile (2026-07-27, seconda tornata — chiusa il 2026-07-28)

> Le date dentro i commenti del codice e in questa sezione sono quelle in cui le
> misure sono state **prese** (27 luglio); il lavoro ha scavalcato la mezzanotte.

Chiusi **nove** dei quindici punti aperti: 1, 2, 3 (tutte e tre le voci), 4, 5, 7,
9, 14, e metà del 6. Ogni premessa è stata **provata sul database** prima di
diventare codice, e **due premesse consegnate col compito si sono rivelate
sbagliate** (§Due premesse smentite). Fuori perimetro per scelta dichiarata: 10,
11, 12, 13, 15 — **non toccati**.

### Il blocco n°1, chiuso su due strade

Il collaudo del 2026-07-26 aveva riprodotto 16 difetti su 17 — cinque Critical —
su uno schema che il gate dichiarava **VERDE 8/8** — otto perche' `db advisors`
non esisteva ancora. Le due direzioni sono state
percorse entrambe, e si controllano a vicenda.

**(a) Test pgTAP negativi obbligatori.** `audit-lib.mjs` produce un `block` su
ogni tabella con policy di `insert`/`update`/`delete`/`all` per cui nessun file di
`supabase/tests/` tenta una scrittura **impersonando un ruolo**.
`rls-audit.mjs --tests <cartella>` legge i file, la regola resta pura. Effetto
misurato sul banco: 17 tabelle scrivibili, **16 `block`** al primo giro — l'unica
salva era `visits`, che il test già esistente attaccava davvero. Scritti i test
negativi (`supabase/tests/rls_negativi.test.sql`, 23 asserzioni), i 16 `block`
spariscono: la regola è **soddisfacibile**, non è un rosso strutturale.

**(b) Tre regole nuove in `audit-lib.mjs`**, tutte provate su Postgres reale:

| Regola | Gravità | Prova |
|---|---|---|
| colonna che decide gli accessi, scrivibile dal proprietario della riga | `block` (se la colonna compare in una policy o nel corpo di una funzione chiamata da una policy) · `issue` (se c'è solo il nome) | sul banco: un veterinario di Biella vede 2 visite e 0 note interne; dopo `update public.staff set job_title = 'direttore'` sulla **propria** riga ne vede 6 e 1 |
| macchina a stati vincolata solo in `update` | `issue` | `insert into public.visits (…, status) values (…, 'fatturata')` passa senza un fiato: il trigger di transizione non scatta su `insert` |
| vista materializzata in schema esposto | `block` (era `issue`) | `alter materialized view … set (security_invoker = on)` → `ERROR: unrecognized parameter "security_invoker"` |

**Le due strade concordano.** Le regole del catalogo trovano l'auto-promozione e
la macchina a stati; i test negativi, scritti dopo, falliscono **su quelle due
cose e su nient'altro**:

```
# Failed test 22: "il veterinario non si promuove a direttore sulla propria riga"
#         have: direttore
#         want: veterinario
# Failed test 23: "una visita non nasce gia' fatturata"
#       caught: no exception
#       wanted: an exception
# Looks like you failed 2 tests of 23
```

### Il banco veterinario adesso: ROSSO, e per i motivi giusti

```
GATE SCHEMA: ROSSO (2 falliti, 0 verifiche mancanti su 9 passi)

OK    sqlfluff (formato SQL)
OK    squawk (operazioni pericolose)
OK    supabase db reset (applicazione reale)
        6 migrazioni applicate + seed
OK    supabase db lint
OK    supabase db advisors
        [WARN] multiple_permissive_policies (20): public.animals, public.clinics, …
FAIL  audit RLS
        schemi esposti: public, graphql_public · postgresql://…:57322/postgres
        [issue] public.species → "specie_visibili_a_tutti": policy con `using (true)` …
        [block] public.staff.job_title: colonna che decide gli accessi, scrivibile …
        [issue] public.visits.status: macchina a stati vincolata solo in `update` …
        [issue] public.<undici funzioni>(): `security definer` eseguibile da PUBLIC …
FAIL  pgTAP (test delle policy)
        Failed tests: 22-23  (auto-promozione · visita che nasce fatturata)
OK    tipi TypeScript
OK    contratto d'uscita (configurazioni + handoff)
```

**Il rosso è il risultato, non un regresso.** Lo stesso schema, con lo stesso
seed, chiudeva VERDE 8/8 il giorno prima mentre `/code-inquisition` ci riproduceva
sedici difetti. Portarlo a verde adesso richiede di **correggere lo schema del
banco** — nuove migrazioni per il `grant` per colonna su `staff`, il vincolo sullo
stato iniziale di `visits`, il `revoke execute` sulle undici funzioni — ed è
lavoro sul banco, non sull'agente: **non è stato fatto**, e il banco resta rosso
apposta, come caso di prova di uno schema difettoso.

### Due premesse smentite dal database

Nessuna delle due è stata implementata come chiesto.

1. **«sqlfluff emette l'avviso su stderr, e `verify.mjs` scarta stderr sui passi
   verdi».** Falso: l'avviso esce su **stdout**. Misurato — `sqlfluff lint` su un
   file da 26 023 byte con dentro `seleziona * da niente;` stampa
   `WARNING Length of file … Skipping to avoid parser lock` **su stdout**, poi
   `All Finished!`, uscita **0**; su stderr non arriva niente (in `2>&1 >/dev/null`
   compare solo un `UnicodeEncodeError` di colorama, artefatto della redirezione
   su Windows). «Far emergere stderr anche sui passi verdi» non avrebbe corretto
   niente. La correzione applicata è l'altra: **misurare i byte prima**, così il
   verdetto non dipende da come lo strumento formatta i suoi avvisi.
2. **«correggere la rilevazione di `has()`, scoping la modifica alla sola
   rilevazione se è la strada più sicura».** Sarebbe stato **peggio** del bug.
   Misurato: col percorso pieno di uno shim `.cmd`, `spawnSync` senza shell dà
   **EINVAL** (mitigazione della CVE-2024-27980), non solo ENOENT sul nome. Con la
   sola rilevazione corretta, `has()` avrebbe risposto sì e ogni `run()` sarebbe
   morto: quattro `fail` col dettaglio vuoto invece di quattro `skipped` con una
   diagnosi sbagliata. Corretti **insieme**, entrambi via `formaEseguibile()`.

Vale anche una terza correzione, trovata sul banco e non nel compito: la regola
della macchina a stati considerava difesa una tabella con un `check` sulla colonna
di stato. Il banco ne ha uno — `check (status = any (array[<tutti e cinque gli
stati>]))` — che **enumera il dominio** e non impedisce affatto di nascere già
`fatturata`. Con la versione ingenua la regola sarebbe stata muta proprio sul
difetto che doveva trovare. Ora un `check` vale come difesa solo se **vieta almeno
uno** degli stati che il trigger nomina, e gli stati del trigger sono quelli che il
trigger **confronta** con quella colonna — non tutti i letterali del corpo, o ci
finirebbero i messaggi di `raise exception` e gli `interval '24 hours'`.

### Falsi verdi chiusi, e come sono stati riprodotti

| Difetto | Prima | Dopo |
|---|---|---|
| migrazione da 23 423 byte con statement invalido | `OK sqlfluff` | `MANC sqlfluff` col file nominato e i byte |
| `supabase/tests/` svuotata | `OK pgTAP` | `MANC pgTAP`, «nessun file .sql» |
| `config.toml` senza `[db].port` | audit sulla 54322 di un altro progetto, riga «quale database» sparita | `MANC audit RLS` con la spiegazione |
| `schemas` su tre righe | «schemi esposti: public» | i tre schemi letti tutti |
| `schemas` presente ma illeggibile | «schemi esposti: public» | `MANC audit RLS` |

### Verifiche eseguite

- **Test unitari: da 93 a 132 verdi** (`node --test "scripts/**/*.test.mjs"`).
  Ogni regola nuova ha il caso che scatta **e** quello che non deve scattare,
  compresi i tre che le rendono non banali: `grant update` per colonna → nessun
  finding; trigger `updated_at` e trigger di archiviazione → non sono macchine a
  stati; un test negativo che asserisce «conteggio 1» invece di `throws_ok` →
  copre lo stesso.
- **Banco delle sole regole nuove**, schema usa e getta con le gemelle scritte
  bene accanto a quelle rotte: **5 difetti piantati, 5 rilevati** (4 `block`, 1
  `issue`) e **0 findings** su `profili_ok` (grant per colonna), `ordini_ok`
  (`check` sullo stato iniziale), `fatture` (sola lettura) e `v_ordini_ok` (vista
  con `security_invoker`). Zero falsi positivi.
- **Guardiani**: ESLint **0 errori 0 warning**, `knip` pulito, `jscpd` **2 cloni**
  (gli stessi due dichiarati: `righeDaPsql` fra le due lib, gestione dell'errore di
  `psql` fra i due gusci).
- **Reference contro la configurazione della skill**: gli **undici** blocchi DDL
  di `rls-supabase.md`, `pattern-ecommerce.md`, `modellazione.md` e
  `migrazioni.md` passano `sqlfluff` con `resources/config/.sqlfluff`, zero
  rilievi. (Restano fuori i frammenti che non sono statement — un elenco di
  colonne in `modellazione.md`, e lo snippet pgTAP con
  `set local request.jwt.claims`, che il dialetto postgres di sqlfluff non parsa:
  nessuno dei due è una migrazione, e il gate linta solo `supabase/migrations`.)

### Cosa resta aperto, di quello che è stato toccato

- **Il gate verifica che i test negativi esistano e passino, non che siano
  severi.** Un `insert` che il test si aspetta *riesca* copre la casella. È una
  scelta misurata, non una svista: pretendere `throws_ok` o «righe = 0» avrebbe
  segnalato come mancante il test negativo **corretto** già scritto sul banco, che
  asserisce che la visita è rimasta `prenotata` — conteggio **1**, non 0
  (`../../DECISIONI.md` §16).
- **Le colonne di privilegio si riconoscono dal nome.** Una colonna `livello` che
  decide dei permessi non la vede nessuno. L'euristica è dichiarata nel messaggio
  del finding, non solo nei documenti.
- **Il banco veterinario resta rosso**: correggerne lo schema è lavoro sul banco.

## Regole nuove dalla skill Supabase ufficiale (2026-07-27)

Installata `.claude/skills/supabase/SKILL.md` (skill ufficiale Supabase; il
frontmatter dichiara **0.1.2**, ma il `CHANGELOG.md` che le sta accanto arriva
alla **0.1.5** del 2026-07-10 — era già vecchia il giorno dell'installazione, e
prima di rifare il confronto va riscaricata: `skills-lock.json`) e
confrontata con Schema Forge. Chiuse le lacune che valeva chiudere: **sei regole
nuove** in `audit-lib.mjs` e un passo nuovo nel gate. Ogni premessa è stata
**provata su Postgres reale** prima di scrivere la regola, e una premessa si è
rivelata sbagliata (punto 4 qui sotto).

| # | Regola nuova | Gravità | Perché |
|---|---|---|---|
| 1 | `user_metadata` / `raw_user_meta_data` in una policy | `block` | `raw_user_meta_data` lo scrive **l'utente** con `updateUser` e finisce in `auth.jwt()`: è auto-promozione ad admin. Il claim va in `raw_app_meta_data` |
| 2 | `auth.role()` in una policy | `block` | deprecata, ma il guaio vero è che con gli **accessi anonimi** attivi un anonimo porta il ruolo Postgres `authenticated` e passa il controllo: il controllo c'è e non controlla niente |
| 3 | `update`/`all` con `using (true)` e **senza** `with check` | `block` (era `issue`) | è la **composizione** a essere il buco, non il singolo pezzo (vedi sotto) |
| 4 | `insert` senza `with check` | `issue` | Postgres **nega ogni inserimento**: non è un buco, è un guasto muto |
| 5 | `security definer` con `execute` a PUBLIC | `issue` | è il **default** di Postgres: ogni funzione nuova in uno schema esposto è un endpoint chiamabile da `anon` che scavalca la RLS |
| 6 | RLS e policy in ordine ma **nessun `grant`** a `anon`/`authenticated` | `issue` | la trappola inversa: il client non legge niente e sembra un bug del frontend |
| 7 | `update`/`delete` senza policy di `select` per gli **stessi ruoli** | `issue` | in Postgres l'update deve prima selezionare la riga: senza, tocca 0 righe **senza errore** |

**Una premessa del gap analysis era sbagliata, e non è stata implementata come
richiesta.** La proposta diceva: «`insert` senza `with check` → `block`, non c'è
`using` da cui ereditare». Provato sul database: è vero che non c'è `using` da cui
ereditare (Postgres rifiuta perfino `for insert using (…)` — *only WITH CHECK
expression allowed for INSERT*), ma la conseguenza è l'**opposto** di un buco —
`new row violates row-level security policy`, nessuna riga entra. Quindi `issue`,
con il messaggio che dice cosa succede davvero. Un `block` avrebbe insegnato a
temere la cosa sbagliata.

**Il tranello della regola 3, che è il motivo per cui non era già scritta.** Quando
`with check` è omesso su `update`/`all`, Postgres **riusa l'espressione di `using`**
come controllo sulla riga nuova. Quindi:

- `for update using ((select auth.uid()) = user_id)` senza `with check` è **sicuro**
  — provato: il tentativo di intestare la riga a un altro utente viene rifiutato.
  Segnalarlo sarebbe un falso positivo **sul codice corretto delle reference**.
- `for update using (true)` senza `with check` è un buco aperto — provato: come
  `authenticated`, `UPDATE 1` su una riga di un altro utente, riuscito.

La regola guarda la composizione. `rls-supabase.md`:90 spiegava il meccanismo in
modo **falso** («senza `with check` un utente può inserire righe intestate ad
altri»): era il punto 8 dei residui del collaudo del 2026-07-26, ora corretto con
la spiegazione verificata al banco.

### Verifiche eseguite (non "letto e sembra giusto")

- **Test unitari: da 66 a 93 verdi** (`node --test "scripts/**/*.test.mjs"`). Ogni
  regola nuova ha il caso che scatta e quello che non deve scattare, compresi i
  due che rendono le regole non banali: `update` con ownership in `using` e senza
  `with check` → **nessun** finding; `update` per `authenticated` con `select`
  solo per `anon` → finding comunque (gli insiemi di ruoli non si sovrappongono).
- **Forme del catalogo verificate su Postgres reale**, non immaginate:
  `proacl::text` rende `NULL` coi privilegi di default, `{postgres=X/postgres}`
  dopo il `revoke`, `{postgres=X/postgres,=X/postgres}` col `grant` a public — il
  **grantee vuoto** prima di `=` è PUBBLICO, ed è quello che la regola cerca.
  Colonne di `information_schema.role_table_grants` confermate.
- **Banco delle sole regole nuove** su uno schema usa e getta: 7 difetti piantati,
  **7 rilevati** con la gravità attesa (3 `block`, 4 `issue`), e una tabella
  scritta bene nello stesso schema → **0 findings**, incluso il `for update`
  senza `with check` che la versione ingenua avrebbe segnalato.
- **Gate completo su un progetto vero** (banco veterinario del collaudo
  precedente): **VERDE, 9 passi su 9**, `db advisors` compreso. Il passo nuovo non
  ha reso il gate strutturalmente rosso.
- **Le regole nuove hanno trovato difetti veri sul banco esistente**: **11 funzioni**
  `security definer` di quel progetto sono eseguibili da `anon` (`revoke execute`
  mai scritto), contate sull'uscita del gate. Era il primo dei sei punti gravi del
  residuo n°15 del collaudo, e ora lo trova uno strumento invece di un auditor.

### Passo nuovo del gate: `supabase db advisors`

Sesto→quinto passo di `verify.mjs`, dopo `db lint`. È il linter di
sicurezza/performance **mantenuto da Supabase**. La sovrapposizione è dichiarata,
non nascosta: circa **quattro delle sei regole storiche** di `audit-lib.mjs` le
copre anche lui (RLS assente, policy senza RLS attiva, `search_path` mancante, FK
non indicizzate). Il valore non è la novità, è che **l'altra metà la mantiene
qualcun altro**: `auth_users_exposed`, `policy_exists_rls_disabled`,
`multiple_permissive_policies`, `extension_in_public`,
`rls_references_user_metadata`.

- Fallisce il gate **solo** sui rilievi `ERROR` (`--fail-on error`). Fra i `WARN`
  ci sono impostazioni di **Auth del progetto** (scadenza degli OTP, opzioni MFA)
  che una migrazione non può correggere: farle diventare rosso il gate sarebbe un
  rosso strutturale, e un rosso strutturale insegna a ignorare il rosso. I `WARN`
  restano **scritti** nel dettaglio, che si stampa anche sui passi verdi.
- Richiede la CLI **v2.81.3+**. Se il sottocomando non c'è (o la CLI manca) il
  passo è `skipped` con la versione richiesta nel messaggio — **mai** `fail`:
  stesso trattamento di `sqlfluff` e `squawk`.
- L'uscita è JSON da centinaia di righe: `dettaglioAdvisors()` la comprime a una
  riga per regola (`ERROR` prima). È una funzione **pura ed esportata**, con i
  suoi test, non giudizio dentro il guscio.

### Fuori perimetro, deciso e scritto

- **Schemi dichiarativi** (`supabase/schemas/`): non adottati — vedi `../../DECISIONI.md` §13.
- **Server MCP di Supabase**: `psql` + CLI coprono già tutto; MCP aggiungerebbe
  OAuth, un `.mcp.json` e una dipendenza di rete **dentro un gate deterministico**.
- **Changelog di Supabase al gate**: no, renderebbe il gate non deterministico. È
  una riga nella procedura di `evolve`, da leggere a mano.
- **Chiavi API, `NEXT_PUBLIC_`, lockfile**: territorio di `code-maniac` e
  `gitleaks`, non dello schema.

### Residuo chiuso lo stesso giorno: la complessità di `main()`

- **`verify.mjs`:`main()` aveva complessità 56** (soglia dei guardiani: 15). Non era
  un regresso delle sette regole — era **51 prima**, verificato lanciando ESLint
  sulla versione precedente: la voce «Complessità PASS» della sezione qui sotto era
  già falsa. Spezzata in **una funzione per passo** (`passoSqlfluff`, `passoSquawk`,
  `passoReset`, `passoDbLint`, `passoAdvisors`, `passoAuditRls`, `passoPgtap`,
  `passoTipi`, `passoContratto`) più `migrazioniDaVerificare()` e `verdetto()`;
  `main()` è adesso solo l'elenco delle chiamate, e **l'ordine di quelle chiamate è
  il gate**. `verdetto()` restituisce il codice d'uscita invece di chiamare
  `process.exit` da due rami diversi. Nessun comportamento cambiato: 93 test verdi
  prima e dopo, e il gate rilanciato sul banco veterinario chiude **VERDE 9 su 9**
  con lo stesso dettaglio.
- **Guardiani, dopo**: ESLint **0 errori 0 warning**, `knip` pulito, 93 test verdi.
  Il gate non viola più la soglia che impone al codice che verifica.
- **Nessuna regola per Storage.** `storage` non è uno schema esposto dell'API e non
  compare in `[api].schemas`: l'audit non lo guarda. L'upsert che richiede
  `insert` + `select` + `update` è **solo documentazione** in
  `references/rls-supabase.md`, e su quella il gate verde non dice niente.

## Cosa ha trovato l'audit del repo (2026-07-28, terza tornata)

Cinque audit paralleli sul repo intero — non sulla skill soltanto. Il risultato
più utile è che **i tre numeri di intestazione di questo file reggevano alla
misura** (132 test, 9 passi, 11 regole: tutti riprodotti eseguendo), e che quasi
tutto ciò che non reggeva stava **fuori** dal codice: nei documenti che lo
descrivono. Un agente si giudica anche da lì — chi lo usa legge quelli.

### Il buco vero: il gate promuoveva un handoff bugiardo

`contrattoUscita` verificava che `docs/handoff/07-schema-forge.md` esistesse e
non avesse segnaposto `{{…}}`. **Niente altro.** Sul banco veterinario — dove il
gate chiude ROSSO su due passi — l'handoff dichiarava «1 issue, 1 warn, nessun
bloccante», era fermo a due giorni prima e citava `reminders`, una tabella che
l'`evolve` aveva già droppato. Il passo lo promuoveva `pass`.

Non è una svista qualsiasi: quel passo esiste **per** far rispettare la clausola
del `CLAUDE.md` («nessun handoff è valido senza scan pulito **oppure** residuo
documentato»), e la faceva rispettare nella forma e non nella sostanza.

**Correzione:** l'handoff deve contenere una riga `Gate: VERDE` o `Gate: ROSSO`,
e il passo la confronta col verdetto degli **otto passi precedenti**. Se diverge,
fallisce e dice quale dei due è quello vero. Non è un rosso strutturale —
dichiarare rosso su un gate rosso **passa**. `../../DECISIONI.md` §19.

Verificato sul file vero, non su una fixture: l'handoff del banco (riscritto con
i due FAIL dentro) → `pass` col verdetto `ROSSO`, `fail` se gli si chiede di
reggere un `VERDE`.

### Tre robustezze del gate

| Difetto | Prima | Dopo |
|---|---|---|
| `JSON.parse(audit.stdout)` nudo | un `rls-audit` morto a metà stampa faceva **crashare il gate**: nessun verdetto affatto | `leggiAudit()`: uscita non-JSON o senza `summary`/`findings` → `skipped`, verifica mancante |
| confronto dei tipi byte a byte | un BOM o dei CRLF bastavano a far nascere rosso il passo 8 su Windows | `normalizzaTipi()`: si normalizza **solo** ciò che non porta significato. Un tipo diverso resta rosso, e un file UTF-16 pure |
| «nessun file .sql» coi test annidati | messaggio falso a chi i test ce li ha, in sottocartelle | il conteggio che **decide** resta quello del primo livello (l'unico di cui si sa cosa faccia `supabase test db`); il ricorsivo entra solo nel messaggio |

Un gate che crasha non è né verde né rosso: è **assente**, ed è il peggiore dei
tre stati perché non lascia traccia.

### Le cinque voci di sicurezza mancanti, scritte

M14-M18 del residuo n°15, più M18-bis (il `with check` circolare). Tre sezioni
nuove in `references/rls-supabase.md`, una regola in `references/modellazione.md`
§Vincoli, e quattro righe nuove nella tabella §Errori classici — **sotto una riga
di separazione**, perché il gate non le guarda e va detto quali.

`references/pattern-ecommerce.md` §Clienti riscritta: due modelli invece di uno
(residuo n°10, chiuso).

### Documenti che dicevano il falso

Il rilievo più grave non era un numero: **`COME-PROVARLA.md`:241 insegnava a
bucare il gate.** «Una cartella vuota dà `pass`. Cancellare i test rende il gate
più verde» — vero fino al 2026-07-27, corretto quel giorno nel **codice** e non
nella guida. Una guida che insegna la scorciatoia che il gate ha chiuso è peggio
di una guida assente.

Gli altri, tutti verificati riga per riga:

| Documento | Diceva | È |
|---|---|---|
| `../../DECISIONI.md` §8 | «bloccante su tutti e **sette** i passi» · «le esenzioni sono **tre**» · `RF04` su `name,label` | nove passi · quattro esenzioni (c'è `RF05`) · `name,label,role,summary` |
| `../../HOWTORUN.md` | flusso senza il comando **`test`** · `rls-audit.mjs --json` **senza `--db-url`** · nessuna versione minima della CLI · code-inquisition installato con `Copy-Item` | `test` è obbligatorio (`block`) · senza `--db-url` è l'invocazione che nel collaudo ha auditato il database di un altro cliente · CLI ≥ 2.81.3 · junction, come le altre (`../../DECISIONI.md` §7) |
| questo file, 5 punti | «VERDE **9/9**» per il collaudo del 26/07 | **8/8**: il nono passo (`db advisors`) è nato il giorno dopo |
| questo file | `contrattoUscita` = «ottavo passo» · «**tre** devDependencies» seguite da quattro nomi · nove link `DECISIONI.md` relativi | nono passo · quattro · `../../DECISIONI.md` (il file sta nella radice del repo, non qui) |
| `COME-PROVARLA.md` | uscita `VERDE 9/9` del banco al §2.4, smentita dal §4 quattro sezioni sotto · numerazione dei passi ferma a otto · doppia intestazione che rompeva la tabella | uscita `ROSSO` datata, numerazione allineata, tabella che si renderizza |

### Il banco veterinario adesso si traccia

Era gitignorato: la prova centrale dello stato dell'agente — «il gate chiude
rosso, e per questi due motivi» — esisteva **su un disco solo**. Un'affermazione
non riproducibile non è una prova, è un ricordo. Ora è in git (18 file, 188 KB,
artefatti di runtime esclusi), con le configurazioni riallineate a quelle che la
skill spedisce oggi: il suo `.sqlfluff` era la copia pre-27/07, cioè il banco
girava con regole che la skill non ha più. `../../DECISIONI.md` §20.

### Verifiche eseguite

- **Test unitari: da 132 a 143 verdi.** Le otto asserzioni nuove sul contratto
  d'uscita coprono anche i casi che rendono la regola non banale: `Gate:` dentro
  un elenco, una citazione o del grassetto → riconosciuta; la parola `VERDE`
  nella **prosa** → non riconosciuta, perché un controllo su prosa libera è un
  controllo che non c'è.
- **Guardiani**: ESLint **0 errori 0 warning**, `knip` pulito, `jscpd` 2 cloni
  (gli stessi due dichiarati).
- **Reference contro la configurazione della skill**: i blocchi SQL estratti dalle
  quattro reference sono ora **20**, di cui **16 statement completi** che passano
  `sqlfluff` con `resources/config/.sqlfluff`, zero rilievi. I 4 che restano
  fuori sono frammenti che non sono statement e non finiranno mai in una
  migrazione: l'elenco di colonne di `modellazione.md`, i due snippet pgTAP con
  `set local request.jwt.claims`, e la coppia di espressioni `using (…)` di
  `rls-supabase.md` §I quattro pattern (quest'ultima non era mai stata
  dichiarata).
- **Contratto d'uscita provato sul file vero** del banco, non su una fixture.

### Cosa NON è stato fatto, e perché

- **Il seed a caldo (punto 11)**: la strada è corta e scritta, ma provarla vuole
  un banco vivo con Docker. La regola della casa — una premessa si prova su
  Postgres reale prima di diventare codice del gate — vale anche quando la
  correzione sembra ovvia. Sono state ovvie anche le tre premesse smentite.
- **Il banco a verde**: le tre migrazioni che lo porterebbero lì sono elencate
  nel suo handoff. Resta rosso apposta, ora però in modo riproducibile.
- **`semgrep` e `gitleaks`** (punto 12): non installati, restano `MANCANTI`.
  *(Fotografia del 2026-07-28. Al 2026-08-06 sono installati tutti e due ed
  eseguiti su questi script — §2026-08-06: il punto 12 è chiuso.)*
- **`docs/schema/ERD.md` nel contratto d'uscita**: `SKILL.md`:123 lo elenca e
  nessun passo lo verifica. Lasciato così **di proposito** e adesso dichiarato:
  aggiungerlo renderebbe rosso ogni progetto che non ha ancora rigenerato il
  diagramma, e un rosso strutturale insegna a ignorare il rosso.
- **La deriva di `code-maniac`** fra `~/.claude/skills/` e `agenti/`: 15 file
  diversi, fra cui `scan.mjs` e le due reference che il `CLAUDE.md` dichiara
  canoniche. Non toccata: il README dichiara quella cartella uno **snapshot** del
  repo di finzidev, quindi quale delle due copie sia quella buona non lo decide
  questo repo. È la prima cosa da chiarire col proprietario.

## Guardiani sugli script della skill (2026-07-25)

Gli script degli agenti passano sotto i guardiani **come qualsiasi altro codice** (CLAUDE.md, Regola dei guardiani). Predisposto il minimo perché la batteria giri sui soli `scripts/` della skill, senza trasformare il repo di regia in un progetto applicativo:

- `agenti/schema-forge/package.json` — `"type": "module"`, `private: true`, quattro devDependencies (`@eslint/js`, `eslint`, `jscpd`, `knip`)
- `agenti/schema-forge/eslint.config.mjs` — `js.configs.recommended` più le soglie di complessità (`complexity 15`, `max-depth 4`, `max-params 4`)
- `agenti/schema-forge/knip.jsonc` — entry point CLI dichiarati, ogni esenzione con la motivazione sulla riga sopra
- `node_modules/` e `.jscpd/` in `.gitignore`: si reinstallano con `npm install` dalla cartella dell'agente

**Residuo reale di `node agenti/code-maniac/scripts/scan.mjs`: 0 passi con problemi, 6 saltati su 10.**

| Passo | Esito |
|---|---|
| Lint (ESLint) · Complessità · Codice morto (knip) · Duplicati (jscpd) | **PASS** — ma la voce «Complessità» era **falsa il giorno in cui è stata scritta**: `verify.mjs`:`main()` era a 51 contro una soglia di 15, e lo scan non era stato rilanciato dopo l'ultima modifica. Vero dal 2026-07-27, quando `main()` è stata spezzata (§Residuo chiuso lo stesso giorno) |
| Prettier · tsc · convenzioni · dependency-cruiser | MANCANTE — non pertinenti qui (niente TypeScript, niente grafo di moduli da validare) |
| **semgrep · gitleaks** | **MANCANTE — non installati.** Regole di sicurezza e ricerca di segreti sugli script **non verificate**: vale `MANCANTE`, non `PASS` — *fotografia del 2026-07-25; entrambi eseguiti il 2026-08-06: semgrep 12 rilievi (1 vero, corretto), gitleaks 0 su questi `scripts/`* |

Corretto solo ciò che era oggettivo: quattro `export` inutilizzati (`pulisci`, `vero` in `audit-lib.mjs` e `erd-lib.mjs` — usati solo dentro il proprio file: superficie pubblica senza consumatori) e `@eslint/js` non dichiarato fra le dipendenze. **I 49 test restano verdi** dopo le correzioni.

Scelte di stile discutibili **elencate e non toccate**: `pulisci`, `vero` e `riga` sono triplicati identici fra `audit-lib.mjs` e `erd-lib.mjs`; estrarli in un terzo modulo accoppierebbe due librerie volutamente indipendenti, quindi la duplicazione resta una decisione, non una svista.

> **Correzione del 2026-07-27.** La frase originale diceva «jscpd non li segnala, sono sotto ogni soglia»: **falso**, e non era mai stato lanciato per controllare. Ai valori di default (`--min-lines 5 --min-tokens 50`) `jscpd` riporta **2 cloni**: `righeDaPsql` fra `audit-lib.mjs` ed `erd-lib.mjs` (8 righe) e la gestione dell'errore di `psql` fra `erd.mjs` ed `rls-audit.mjs` (11 righe, cambia solo il messaggio). La **decisione** di non estrarli resta — accoppierebbe due librerie indipendenti per otto righe — e `jscpd` esce `0` perché non c'è una soglia configurata. Ma andava scritto che lo strumento li vede: dire «pulito» di uno strumento che segnala qualcosa è la stessa bugia che il gate esiste per impedire.

**Stesso trattamento per `verify.mjs`**: lo script del gate è dentro `scripts/` e rientra nella stessa batteria — è già coperto da questo scan (ESLint, complessità, knip, jscpd verdi) e dai propri test (`verify.test.mjs`). Da qui in avanti, **ogni nuovo script di un agente nasce dentro questo perimetro**: se un agente aggiunge uno script, aggiunge anche il proprio `package.json`/`eslint.config.mjs` locale, oppure lo script non è consegnabile.

## Decisioni prese

- Lo Specchio del dominio ha due modalità (interattiva / pipeline): in pipeline conferma l'orchestratore, ma il modello assunto viene **scritto** nell'handoff. I distruttivi restano sempre checkpoint umano. Risponde a `../../DECISIONI.md` §1 senza toccare code-maniac.
- La verifica passa dal database reale (`supabase db reset`), non dalla lettura dell'SQL: uno strumento assente produce `skipped`, mai `pass`.
- Le regole stanno nelle `*-lib.mjs`, i gusci fanno solo I/O: una regola senza test è una regola che può essere spenta da un anno senza che nessuno lo sappia. Una regola nuova si aggiunge nella lib, col suo test.
- I linter si configurano, il gate non si declassa (`../../DECISIONI.md` §8).
- **Interi a `bigint` per default, non solo il denaro** (`references/modellazione.md`): il tipo largo costa 4 byte per riga, allargarlo dopo è un `alter column type` sotto lock esclusivo. `integer` solo dove il limite è strutturale e dimostrabile, e si motiva.
- **Gli script degli agenti passano sotto i guardiani come qualsiasi altro codice**: ogni agente che aggiunge uno script aggiunge il proprio `package.json`/`eslint.config.mjs` locale, altrimenti lo script non è consegnabile.
- **Un distruttivo autorizzato si dichiara al gate**, non lo si aggira: `-- squawk-ignore <regola>` da solo sulla sua riga, motivazione nelle righe sopra, autorizzazione umana come precondizione. È il modo di registrare chi se n'è preso la responsabilità, non un interruttore per far passare il rosso.
- **Il gate parla del database che ha davvero guardato**: schemi auditati e URL del database si stampano sempre nel dettaglio del passo. Un audit su metà database, o sul database di un altro progetto, non deve poter assomigliare a un audit completo.
- **`verify` è l'ultimo passo, non il penultimo.** Tipi e handoff si producono prima: un gate che nasce rosso per come è ordinato il flusso insegna a ignorare il rosso.
- **Uno strumento esterno nel gate fallisce solo su ciò che lo schema può correggere.** `supabase db advisors` gira con `--fail-on error`: i suoi `WARN` includono impostazioni di Auth del progetto, che nessuna migrazione tocca. Si registrano nel dettaglio, non nel verdetto. Vale come regola generale per ogni strumento che si aggiungerà.
- **L'handoff dichiara il verdetto del gate, e il gate lo verifica.** Un passo che controlla la *forma* di un documento e non ciò che dice non fa rispettare la regola per cui esiste. La verifica è su una riga di forma fissa (`Gate: VERDE` / `Gate: ROSSO`) perché un controllo su prosa libera è un controllo che non c'è. Dichiarare rosso su un gate rosso **passa**: la regola vieta di mentire, non di consegnare un rosso.
- **Un banco che è diventato un caso di prova non è più un banco usa e getta.** La §12 di `../../DECISIONI.md` resta valida per i banchi effimeri; `banco-prova-vetcare` si traccia, perché un'affermazione non riproducibile («il gate chiude rosso, e per questi due motivi») non è una prova ma un ricordo.
- **Una premessa si prova sul database prima di diventare una regola.** Delle sette regole del 2026-07-27, una era stata proposta con la gravità sbagliata (`insert` senza `with check` come `block`) e una avrebbe prodotto falsi positivi sul codice corretto delle reference (`with check` omesso su `update`). Entrambe si vedono solo eseguendo l'SQL: leggere la documentazione non basta, e il gap analysis di un LLM nemmeno.

## Il primo consumatore a valle: feedback da Gestionale Crafter (2026-07-28)

Appendice **aggiunta**, non sostitutiva: sopra resta ciò che era vero prima.

Il punto aperto n°13 di questo file dice: *«Nessun consumatore reale a valle. L'analisi di
impatto di `evolve` ha girato di nuovo sul caso facile, senza codice applicativo. Fly UI e
Gestionale Crafter non esistono ancora»*. Da oggi Gestionale Crafter esiste, e ha
costruito un backoffice Next.js reale su uno schema prodotto eseguendo il Flusso 1 di
questa skill (banco `banco-prova-negozio`, otto tabelle, gate **VERDE 9/9**). Quello che
segue è ciò che si è visto **dal lato di chi consuma**.

### Il contratto dei tipi: regge, ed è il controllo più forte della catena

`src/lib/database.types.ts` ha funzionato esattamente come promesso. Nell'esperimento di
`evolve` — rinomina di `site_content.body` in `corpo`, expand-contract completo — rigenerati
i tipi e **senza toccare il codice applicativo**, il gate a valle ha chiuso rosso con
**15 errori in 4 file**, e con il messaggio giusto:

```
error TS2339: Property 'body' does not exist on type
  'SelectQueryError<"column 'body' does not exist on 'site_content'.">'
```

`supabase-js` scrive *quale* colonna non esiste più. Nessuna delle quattro rotture è
arrivata a runtime. **L'analisi di impatto più affidabile di `evolve` è `tsc` sui tipi
rigenerati**, non il grep.

### Tre cose che l'analisi di impatto di `evolve` non fa, e dovrebbe

1. **Il grep su un nome di colonna comune produce rumore.** `grep -rn "\bbody\b" src` sul
   banco ha restituito, fra i consumatori veri, anche `<body className=…>` di
   `src/app/layout.tsx`. Su `body`, `title`, `name`, `status` il rumore nasconde il segnale:
   la procedura dovrebbe dire di **rigenerare i tipi e compilare**, e usare il grep solo per
   ciò che i tipi non vedono (stringhe di `.select()`, nomi di campo nei `FormData`).
2. **I test pgTAP sono un consumatore come il seed.** La procedura di `evolve` prescrive di
   riallineare `seed.sql` («o il `db reset` successivo fallisce») e tace sui test. Dopo la
   rinomina, due asserzioni del banco citavano ancora `body`: `throws_ok` catturava
   l'eccezione **sbagliata** (colonna inesistente, non permesso negato) e il passo pgTAP
   chiudeva rosso. Il gate l'ha visto — ma la procedura dovrebbe dirlo prima.
3. **Nessun errore, ma un'osservazione:** l'`evolve` ha attraversato la catena intera —
   analisi, expand, backfill, contract con `-- squawk-ignore`, export dei dati, riallineo del
   seed — e i due linter sono rimasti verdi su tutti e 7 i file. La ricetta della §10 di
   `../../DECISIONI.md` funziona su un progetto con codice sopra, non solo sul banco.

### Il difetto vero: su Supabase i `grant` delle migrazioni sono no-op

Misurato su Postgres 18 con la CLI 2.95.4, sul banco appena forgiato:

```sql
select defaclacl from pg_default_acl;
→ {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
   authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Supabase applica `alter default privileges in schema public grant all on tables to anon,
authenticated, service_role`. Conseguenze, entrambe provate sul campo:

1. ogni `grant select, insert, update … to authenticated` scritto in una migrazione **non
   cambia niente**: il privilegio c'era già. Anche `anon` ha `insert/update/delete` su ogni
   tabella nuova — a fermarlo è solo l'assenza di policy;
2. **`grant update (colonna) … to authenticated` non restringe niente senza un `revoke`
   prima**, perché il permesso per colonna è additivo. Sul banco, con la riga
   `grant update (full_name, phone) on public.staff to authenticated` regolarmente scritta,
   il test pgTAP ha visto il magazziniere eseguire `update public.staff set ruolo =
   'titolare'` sulla **propria riga** e diventare titolare.

`references/rls-supabase.md` §Il caso peggiore scrive la difesa n°2 nella forma giusta —
`revoke update on public.staff from authenticated;` **poi** il `grant` per colonna — ma
`SKILL.md` (comando `forge`) descrive solo il `grant`: *«il `grant` ad `anon`/`authenticated`
— per colonna … su ogni tabella che contiene una colonna di privilegio»*. Chi legge la
skill e non la reference scrive la riga inefficace. **Suggerimento: il `revoke` prima del
`grant` va nella regola, non solo nell'esempio.**

> **CHIUSO il 2026-08-03** (P.8). Il `revoke` → `grant` è ora la forma di **ogni**
> privilegio che uno schema forgiato emette: `SKILL.md` §I privilegi si scrivono, non si
> ereditano, richiamata dal comando `forge`, dal Flusso 1 e dal gate di chiusura. La
> premessa di questa sezione — «il default copre tutto, quindi il `grant` è no-op» — nel
> frattempo è **scaduta** (§I privilegi non erano nel contratto d'uscita): la regola regge
> lo stesso, ma per un motivo più solido di quello con cui era stata proposta.

L'audit di questa skill, va detto, **il difetto lo trova**: rimesso il permesso di tabella
intera, `rls-audit.mjs` risponde `[block] public.staff.ruolo: colonna che decide gli accessi,
scrivibile dal proprietario della riga`. Il buco era nella *prescrizione*, non nel controllo.

### Due punti ciechi dell'audit, trovati dal tribunale sul banco a valle

`/code-inquisition` (tre esperti, 2026-07-28) ha confermato due difetti che
`scripts/rls-audit.mjs` non vede, entrambi su schemi che il suo gate dichiara verdi:

1. **`is_active` non è nell'euristica delle colonne di privilegio.** La regex di
   `audit-lib.mjs` copre `ruolo|role|is_admin|is_staff|job_title|permessi…`, e su questo
   schema l'interruttore di revoca si chiamava `is_active`: lo leggono `e_staff()` e
   `ha_ruolo()`, era dentro il `grant update` per colonna, e chi veniva disattivato si
   **riaccendeva da solo** con un `update` sulla propria riga. La regola non ha detto niente.
   La prova che serve è già nel catalogo, e la regola sa già cercarla: la colonna compare nel
   corpo di due funzioni che le policy chiamano — è lo stesso caso di `job_title`, con un
   nome che l'elenco non contiene. **Suggerimento: aggiungere le forme dell'interruttore
   (`is_active`, `attivo`, `abilitato`, `enabled`, `sospeso`, `is_enabled`) alle sole
   colonne *provate nel catalogo*, non a quelle riconosciute per nome** — così il `block`
   resta dove c'è la prova e non nasce rumore su `products.is_active`.
2. **Una colonna di stato con `check (col in (…))` e nessun trigger non produce nessun
   finding.** La regola 9 guarda le macchine a stati *che hanno un trigger* e verifica che
   scatti anche in `insert`. Se il trigger non c'è affatto, la macchina vive solo
   nell'applicazione — che non è un vincolo — e il gate tace. Sul banco dell'accademia lo
   stato `ritirata` di `enrollments` era terminale **solo in TypeScript**: dal lato server
   bastava dichiarare uno stato attuale diverso per resuscitare un'iscrizione ritirata.

### Cosa questo consumatore chiede alla skill, in ordine di utilità

1. ~~il `revoke` prima del `grant` **nella regola** di `forge`, non solo nell'esempio della reference;~~ — **fatto il 2026-08-03** (P.8), ed esteso a `service_role`;
2. `tsc` sui tipi rigenerati come passo prescritto dell'analisi di impatto di `evolve`, prima del grep;
3. il riallineamento dei **test pgTAP** accanto a quello del seed, nella procedura di `evolve`;
4. l'euristica delle colonne di privilegio estesa agli interruttori di attivazione, **solo dove la prova è nel catalogo**;
5. un finding — anche solo `issue` — per una colonna di stato vincolata da un `check` di dominio e da nessun trigger.

Dei cinque punti, il **n°1 è stato applicato il 2026-08-03** (P.8). Gli altri quattro no:
**è il consumatore che riporta, il proprietario che decide.**

### Una deriva misurata, non corretta qui

Il punto 12 di questo file dice *«semgrep e gitleaks non sono installati»*. Al 2026-07-28
**`semgrep` c'è** (versione 1.171.0, misurata: `semgrep --version`); `gitleaks` no. La riga
resta com'è perché è la fotografia di quel giorno e la correzione è del proprietario, ma
chi la legge oggi sappia che metà di quella frase è invecchiata: sugli script di
gestionale-crafter semgrep gira e produce sei rilievi dichiarati.

## Il secondo consumatore a valle: feedback da Flow Sentinel (2026-07-30)

### Il difetto: un seed che scrive `auth.users` a mano rende il sito inaccessibile

Sul banco `banco-prova-negozio`, il seed generato da questa skill inseriva le righe di
`auth.users` lasciando `confirmation_token`, `recovery_token`, `email_change` e
`email_change_token_new` a **NULL**. GoTrue legge quelle colonne in una `string` di Go:

```
error finding user: sql: Scan error on column index 3, name "confirmation_token":
converting NULL to string is unsupported
```

Risultato: **HTTP 500 su ogni `signInWithPassword`, per ogni utente**. Il gestionale era
inaccessibile a chiunque, dal primo giorno, su un progetto che questa skill aveva chiuso
con **Gate: VERDE 9/9**.

**Perché il gate non poteva vederlo, e non è un'accusa ma una misura del suo perimetro.**
Lo schema è corretto: tabelle, vincoli, policy, `db lint`, `db advisors`, pgTAP — tutto
verde, e giustamente. Il gate prova le RLS con `set role` e pgTAP, che parlano a Postgres
**senza passare da GoTrue**. Nessuno dei nove passi tenta un accesso vero. Il difetto non
sta nello schema: sta nel **seed**, ed è visibile solo a chi prova a entrare.

L'ha trovato Flow Sentinel nei primi minuti della sua fase `map`, misurando la premessa
prima di scrivere una riga di spec. Verbale: `../flow-sentinel/COLLAUDO-P3-2026-07-30.md` §1.1.

**Corretto sul banco** (le quattro colonne a stringa vuota, con il commento che spiega il
perché) e riverificato con `supabase db reset` da pulito: login `HTTP 200`.

### Cosa questo chiede alla skill

1. **Il generatore di seed non deve scrivere `auth.users` a mano** senza le quattro colonne
   dei token a `''`. È una riga di template, e vale per ogni progetto con autenticazione:
   oggi il difetto nasce in ogni seed che questa skill produce.
2. ~~**`auth.identities` non viene mai scritta.**~~ — **sanata nel banco** poche ore dopo, il
   2026-07-30: il seed la popola con una `select` da `auth.users`, e la batteria lo asserisce
   (`identitaDi`, spec `accesso-staff`). Resta da portare nel **template** di questa skill:
   oggi il difetto rinasce in ogni seed che la skill produce. Nota di implementazione che è
   costata un rosso: la colonna `email` è `generated always`, nominarla fa fallire l'`insert`.
3. **Un passo di gate che tenti un accesso vero** chiuderebbe la classe alla radice — un
   `POST /auth/v1/token` con un utente del seed, che è deterministico e non richiede browser.
   È l'unico modo perché questa skill smetta di consegnare progetti in cui non si entra.

### Conferma indipendente sul `grant` per colonna

Il sabotaggio di Flow Sentinel ha concesso `update (ruolo) on staff to authenticated` e ha
misurato che **il magazziniere si promuove titolare e la RLS non lo ferma**. È la stessa cosa
che il collaudo di gestionale-crafter aveva scoperto, ora riprodotta da un terzo agente con
un metodo diverso: su Supabase la difesa è il `grant` per colonna, non la policy.

### Il difetto più grave di tutti: il progetto si è rotto da fermo (2026-07-30, sera)

Rilanciando la batteria sul banco **senza aver toccato una riga di applicazione**, nove test
sono diventati rossi con lo stesso messaggio:

```
403 {"code":"42501","message":"permission denied for table staff",
     "hint":"Grant the required privileges to the current role with:
             GRANT SELECT ON public.staff TO service_role;"}
```

La causa non è nel progetto. La CLI Supabase è passata da **2.95.4 a 2.110.0**, e con lei i
privilegi di default:

```sql
select defaclacl from pg_default_acl;   -- proprietario `postgres`
PRIMA:  {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm}
ADESSO: {postgres=arwdDxtm, anon=Dxtm, authenticated=Dxtm, service_role=Dxtm}
```

`Dxtm` è TRUNCATE, REFERENCES, TRIGGER, MAINTAIN. Sono spariti `select`, `insert`, `update`,
`delete` per **tutti e tre** i ruoli.

**Perché `anon` e `authenticated` sono sopravvissuti.** Perché la §Il difetto vero qui sopra
aveva prodotto `permessi_espliciti.sql`, che glieli **riconcede uno per uno** dopo il
`revoke`. Quella migrazione ha salvato il progetto da un cambiamento che non poteva prevedere,
e lo ha fatto per il motivo giusto: aveva sostituito un default con una riga scritta.
`service_role` non era nell'elenco — non è un ruolo del client, e aveva tutto per grazia del
default. Cambiato il default, non gli è rimasto niente.

**Cosa questo chiede alla skill, ed è la richiesta più importante dell'intero file:**

1. ~~**`permessi_espliciti` deve comprendere `service_role`.**~~ — **CHIUSA il 2026-08-03**
   (P.8). La regola di `forge` scrive il `revoke` e il `grant` per **tutti e tre** i ruoli,
   `service_role` compreso, e il gate di chiusura lo pretende. Restava vero fino a ieri che
   «ogni progetto già generato ha lo stesso buco latente»: da oggi ce l'hanno solo quelli
   generati prima.
2. **La versione della CLI e dell'immagine Postgres non è versionata da nessuna parte.** Un
   progetto Web Gun dichiara le sue dipendenze npm al patch e lascia libera la cosa che decide
   i permessi del suo database. Va fissata, così un aggiornamento è una decisione.
3. **Nessuno dei nove passi del gate se n'è accorto**, e non è un difetto del gate: lo schema è
   corretto, le policy sono corrette, i test pgTAP passano — girano tutti come `postgres` o con
   `set role`, mai con la chiave di servizio. Se ne accorge solo chi **usa** quella chiave, e
   in questa pipeline la usa un solo strumento: le asserzioni di effetto di Flow Sentinel.
   Un passo che interroghi PostgREST **con la chiave di servizio** chiuderebbe la classe.

La regola generale, che vale oltre questo caso: **su Supabase un privilegio che non hai
scritto non è un privilegio che hai** — e da oggi si sa che non lo è nemmeno domani.

## I privilegi non erano nel contratto d'uscita (2026-08-03, pacchetto P.8)

Terza puntata della stessa storia, e la prima in cui la regola entra nel contratto invece
di restare un suggerimento in fondo a una sezione. Le due richieste storiche qui sopra —
«il `revoke` prima del `grant` va nella regola» (2026-07-28) e «`permessi_espliciti` deve
comprendere `service_role`» (2026-07-30, *la richiesta più importante dell'intero file*) —
sono **chiuse**. Voce di decisione: `../../DECISIONI.md` §27.

### Il difetto, misurato prima di essere corretto

Le sei migrazioni del banco veterinario non contenevano **un solo** `grant` né un
`alter default privileges` (grep, zero risultati): lo schema si appoggiava ai privilegi che
l'immagine Supabase concedeva d'ufficio. Con la CLI 2.111.0 quei privilegi sono `Dxtm` —
TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: **zero CRUD** — su tutte e 18 le tabelle, e il
pgTAP moriva con `permission denied for table animals`. Il verde di luglio non era falso:
era **scaduto**.

La causa sta nel catalogo, ed è più precisa di «Supabase ha cambiato i default»:
`pg_default_acl` conteneva **due righe in conflitto** per (public, tabelle), una per ogni
ruolo che può creare oggetti.

```
defaclrole      | defaclacl
----------------+---------------------------------------------------------------
 supabase_admin | {postgres=arwdDxtm, anon=arwdDxtm, authenticated=arwdDxtm,
                |  service_role=arwdDxtm}
 postgres       | {postgres=arwdDxtm, anon=Dxtm, authenticated=Dxtm,
                |  service_role=Dxtm}
```

Le migrazioni le applica `postgres`. La stessa `create table`, eseguita da un terzo ruolo,
nasceva con `relacl` **NULL** — zero privilegi (misurato con un ruolo creato apposta).

### Cinque premesse provate su Postgres reale, e due che hanno cambiato la regola

Il banco acceso ha smentito la forma che sarebbe venuta in mente per prima (§18: si misura
la premessa prima di leggere l'esito). Le misure, su Postgres 17.6 · CLI 2.111.0:

| # | Premessa | Esito misurato |
|---|---|---|
| 1 | il `revoke` serve «perché il default concede troppo» | **falsa oggi**: il default non concede più niente. Il `revoke` serve perché è l'unica riga che rende il `grant` scritto l'unica verità, qualunque cosa ci fosse prima |
| 2 | un `grant` per colonna restringe da solo | **dipende**: col default di oggi sì; dopo un `grant update` di tabella intera **no**, il permesso per colonna è additivo e l'auto-promozione riesce lo stesso |
| 3 | `Dxtm` è «meno permissivo» | **falso, ed è la misura peggiore**: comprende TRUNCATE, e la RLS **non si applica a TRUNCATE**. `set role anon; truncate public.animals cascade` **riesce** e porta via dieci tabelle, su uno schema con `force row level security` ovunque |
| 4 | `alter default privileges` risolve il problema per le migrazioni successive | **no**: sposta la cosa invisibile. È legato a chi crea l'oggetto (vedi le due righe in conflitto qui sopra) |
| 5 | senza `select`, `anon` legge una lista vuota | **no**: riceve `42501 permission denied`. La RLS non arriva nemmeno a decidere |

Le premesse 1 e 3 hanno cambiato la motivazione scritta nella regola; la 4 ha tolto una
riga che stava per essere prescritta.

### La regola 7 dell'audit taceva, e si è misurato perché

Non era un'omissione: la regola chiedeva al catalogo una cosa **più debole** di quella che
le serviva — «questa tabella compare in `information_schema.role_table_grants` per `anon` o
`authenticated`?» — senza guardare *quale* privilegio. Con `Dxtm` la tabella compare, con
`privilege_type` = TRUNCATE/REFERENCES/TRIGGER. Misura, la stessa query dell'audit:

```
select distinct table_schema, table_name from information_schema.role_table_grants
 where table_schema in ('public') and grantee in ('anon','authenticated');
→ 19 righe su 19 oggetti          (quindi: nessun finding, su uno schema illeggibile)
```

Riscritta: confronta i ruoli e i comandi di `pg_policies` con `has_any_column_privilege`,
un finding per (tabella, ruolo), gravità **`block`** — la prova è interamente nel catalogo,
senza euristiche (§17), e il danno è totale e muto. Sullo stesso banco, **prima** 0 findings,
**dopo** 21 `block` (18 tabelle × `authenticated` + 3 × `anon`).

`has_any_column_privilege` e non `has_table_privilege`: un `grant update (colonna)` non
compare in `relacl` (§22), e con la funzione sbagliata l'audit boccerebbe il rimedio che la
skill stessa prescrive. `delete` fa eccezione perché in Postgres non esiste un `delete` per
colonna — chiederlo è un errore di esecuzione, cioè un audit mancante.

### Cosa è cambiato, in concreto

- `SKILL.md`: nuova sezione **§I privilegi si scrivono, non si ereditano** (la regola, le
  cinque premesse con la loro misura, la forma `revoke` → `grant` per tutti e tre i ruoli),
  richiamata dal comando `forge`, dal passo 5 del Flusso 1 e dal gate di chiusura.
- `references/rls-supabase.md`: §La trappola inversa riscritta (la forma completa, la
  verifica su `relacl` invece che su `role_table_grants`, e il nuovo §Il `truncate` che la
  RLS non filtra); §Il caso peggiore rimanda alla regola generale.
- `scripts/audit-lib.mjs` + `scripts/rls-audit.mjs`: regola 7 riscritta, query nuova.
- `resources/config/.sqlfluff`: `large_file_skip_byte_limit = 0`. Il default di sqlfluff
  (20 000 byte) faceva **saltare in silenzio** `20260726120200_clinico.sql` (20 384 byte),
  e il rimedio suggerito dal gate — spezzare il file — è impossibile su una migrazione già
  applicata, che è immutabile. Provato nelle due direzioni: col limite di default sqlfluff
  stampa un avviso su stdout, salta il file ed esce **0** anche con uno statement
  malformato dentro; con 0 lo legge e lo segnala.
- Test: **146 → 153** (`node --test`, 0 fail). Nove asserzioni nuove per la regola 7: il
  caso che scatta, il caso che non deve scattare, il caso `Dxtm` che la regola vecchia
  promuoveva, la promessa parziale, il `grant` per colonna che **non** deve produrre un
  finding, la policy `for all`, la policy senza `to`, la policy del solo `service_role`,
  l'ordine canonico dell'elenco.
- Guardiani: ESLint **pulito** (0 problemi) dopo due correzioni — `complexity 21` sulla
  regola nuova, estratte due funzioni pure; e un `no-undef` su `URL` in `verify.test.mjs`,
  **vivo dal 2026-08-03 mattina e mai visto** perché su questa macchina i `node_modules`
  della skill non erano installati e ESLint non girava affatto. `knip` pulito.
  `sqlfluff` 4.2.2 e `squawk` 2.61.0 installati con `pipx`.

### Il banco: stesso rosso, motivi tornati quelli storici

`banco-prova-vetcare` ha una settima migrazione, `20260803120000_permessi_espliciti.sql`,
che scrive i privilegi che lo schema aveva sempre presunto. **Non lo sana**: `public.staff`
riceve `update` di tabella intera, cioè l'auto-promozione resta.

| | prima di P.8 | dopo |
|---|---|---|
| gate | ROSSO, 1 fallito, **2 mancanti** su 9 | ROSSO, **2 falliti, 0 mancanti** su 9 |
| `audit-rls` | OK (0 block) — il `block` storico su `staff.job_title` **non scattava** | FAIL, `block` su `staff.job_title` **tornato** |
| `pgtap` | 9/23 + 11/11 falliti, tutti `permission denied` | **2/23** (asserzioni 22-23, le storiche) + 1/11 |

L'unica riga che non torna storica: `rls_policy.test.sql` si ferma sull'undicesima
asserzione, «la chiave anonima non legge nessun cliente», che asseriva `count = 0` — la
forma del rifiuto che dava la RLS quando `anon` aveva `select` su tutto per grazia del
default. Il modello di accesso del banco dice `owners → anon: —` e la migrazione scrive
quello, quindi il rifiuto arriva **prima** della RLS (`42501`). Non è un allentamento: è
più stretto di prima. Il test è un consumatore dello schema come il seed, e va riallineato
a `throws_ok(…, '42501', …)` — **non fatto qui**: chi scrive la migrazione non riscrive il
test che la giudica. Dichiarato nell'handoff del banco.
  **Riallineato il 2026-08-04** (decisione D9 del registro di cantiere, dentro P.7c):
asserzione 11 → `throws_ok('select * from public.owners', '42501', null, …)`, `errmsg` a
`null` perché il testo di Postgres non è un contratto. L'edit è della ripresa P.7c, il
rilancio e il commit sono del direttore. Gate rilanciato sul banco col node di sistema:
**ROSSO, 2 falliti, 0 mancanti su 9**, pgTAP alle sole storiche 22-23 di `rls_negativi` e
`rls_policy` **11/11** — i motivi del rosso tornati tutti storici, handoff aggiornato.
Nota di esercizio: al primo lancio, con la macchina satura (due gate e due batterie
insieme), il passo `tipi` è uscito **FAIL col dettaglio vuoto** — è la forma che
`passoTipi` prende quando `supabase gen types` muore senza stderr (qui: memoria di paging
esaurita, stesso minuto del rosso del gate della regia). Non era lo schema: rigenerazione
manuale uscita 0, tipi **identici** ai committati, secondo lancio OK. Un FAIL di quel
passo senza dettaglio va riletto come sospetto d'ambiente prima che come tipi divergenti.

### Cosa resta fuori, dichiarato

- **La versione della CLI Supabase e dell'immagine Postgres non è versionata da nessuna
  parte.** Era la richiesta n°2 del 2026-07-30 e resta aperta: un progetto Web Gun dichiara
  le sue dipendenze npm al patch e lascia libera la cosa che decide i permessi del suo
  database. La regola dei privilegi espliciti **limita il danno** di un aggiornamento non
  annunciato, non lo impedisce: fuori dal perimetro di P.8 (D7).
- Le tre migrazioni che porterebbero il banco a verde restano non scritte, per scelta: è il
  caso di prova permanente di uno schema difettoso (`../../DECISIONI.md` §20/§25).
- I quattro punti su cinque del primo consumatore e i due del secondo restano aperti.

## Il gate parla anche dalla junction — CHIUSO il 2026-08-04 (P.0-igiene-2)

Punto **chiuso**. Aperto dalla misura di P.4-pre (`../../PILOTA-PRE-2026-08-04.md`
§2b), corretto e collaudato lo stesso giorno: verbale
`../../IGIENE2-JUNCTION-2026-08-04.md`, commit `257e34d` (la guardia), `e6deb39`
(l'`hint` della regola), `c96ae00` (il test di regressione).

**Era.** `node <regia>/agenti/schema-forge/scripts/verify.mjs`, da una cartella
qualsiasi fuori dall'albero della regia, usciva **2 con il messaggio**; lo stesso gate
invocato come `node <...>/.claude/skills/schema-forge/scripts/verify.mjs`, stessa
cartella e stesso node di sistema (20.12.2), usciva **0 senza stampare una riga** — la
regressione che P.0-igiene aveva chiuso, per un canale che P.0-igiene non copriva.
Causa, misurata stampando i due lati del confronto: nell'epilogo prescritto dalla
regola `epiloghi-vivi` del gate della regia, `resolve(process.argv[1])` restituisce il
percorso della junction mentre `import.meta.url` restituisce quello reale (Node
canonicalizza i moduli). I due differivano, la guardia era falsa, `main()` non girava.
Non era un difetto di questa skill sola: **lo avevano tutti e cinque i gate**, e la
forma difettosa era quella che il campo `hint` prescriveva.

**È.** L'epilogo confronta **due volte**: il percorso testuale (`resolve`) e quello
sciolto (`realpathSync`), con ricaduta sul testuale se `realpathSync` solleva — mai un
errore che ammutolisce. La stessa forma è quella che l'`hint` prescrive da oggi.

**Misura del 2026-08-04**, node di sistema 20.12.2, cartella vuota fuori dall'albero,
i due canali uno dopo l'altro:

```
=== schema-forge [agenti] === uscita: 2 | righe: 1
Nessuna cartella <cwd>\supabase\migrations: non c'e' schema da verificare.
=== schema-forge [skills] === uscita: 2 | righe: 1
Nessuna cartella <cwd>\supabase\migrations: non c'e' schema da verificare.
```

Identico carattere per carattere: non un altro messaggio, lo stesso gate che parla.
**Cade il vincolo provvisorio di D12** — i gate si lanciano da **entrambi** i canali,
junction compresa, ed è il canale con cui una chat aperta sul repo di un progetto
generato vede le skill.

**Regressione piantata.** I test dell'epilogo diventano **tre**: al funzionale e allo
statico si aggiunge il **junction**, che crea una junction vera e invoca il gate
attraverso di essa. Gli altri due non potevano vederlo — lo statico vieta un token che
questo difetto non contiene, il funzionale usa il percorso reale, canonico per
costruzione. Provato col **sabotaggio**: guardia vecchia rimessa, batteria su Node 24
→ **52 verdi e un rosso**, e il rosso è il test junction (verbale §4).

## Il primo progetto pilota: `fornodoro` (2026-08-04, P.4a)

Primo giro del Flusso 1 su un progetto **fuori dall'albero della regia**, con lo
Specchio firmato da un committente in carne e ossa. Verbale:
`PILOTA-2026-08-04.md`. Gate **VERDE 9/9** invocato **dalla junction** dalla
radice del progetto, riconfermato per percorso assoluto — è la prima uscita vera
del canale riparato da P.0-igiene-2, su un progetto vero.

**Quello che è andato come promesso**, e non è poco: lo STOP dello Specchio ha
tenuto (nessun DDL prima della firma, cinque domande strutturali portate al
committente invece che risolte in silenzio, e una — «che succede a un ordine mai
ritirato?» — nata dal disegno del ciclo di vita e non dal testo del brief); il
gate è verde al primo colpo dopo `types` e `handoff`; l'ordine canonico del
Flusso 1 non ha prodotto nessun rosso strutturale.

### Le righe che questo pilota lascia alla skill — non applicate, come prescritto

1. **`references/modellazione.md` §Seed copre l'idempotenza degli `insert` e tace
   sugli `update`.** Con una macchina a stati nel seed non basta
   `insert … where not exists`: gli ordini nascono tutti nello stato iniziale e
   raggiungono gli altri con `update`, che alla seconda esecuzione a caldo
   tenterebbero una transizione all'indietro e verrebbero **rifiutati dal
   trigger**. La forma che regge è l'`update` **guardato dallo stato di
   partenza** (`… and stato = 'in_preparazione'`). Provata sul pilota: tre
   riesecuzioni a caldo, conteggi **e stati** identici.
2. **`references/migrazioni.md` non dice se l'immutabilità valga anche dentro
   `forge`**, cioè prima che esista un handoff e un consumatore. Il testo motiva
   la regola con gli ambienti allineati («se è già in produzione…»), quindi
   ammette due letture. Sul pilota ho letto «no» e l'ho dichiarato nel verbale;
   un'altra chat leggerà «sì», e le due produrranno artefatti diversi.
3. **Il punto 11 ha ora la premessa che gli mancava.** La strada — rieseguire
   `supabase/seed.sql` sul database caldo dentro `passoReset` — chiedeva «un
   banco vivo con Docker» per essere provata. Il pilota l'ha provata su un
   progetto vero **con trigger di dominio e una macchina a stati**, che è la
   condizione severa. Resta la decisione, non più la misura.
4. **Il difetto del template di seed (`auth.users` + `auth.identities`) è ancora
   lì.** Sul pilota il seed è nato **sanato a mano**; il template no. È la terza
   volta che questa riga viene scritta.

### Una classe che il gate non ha, trovata dal tribunale sul pilota

`/code-inquisition` (tre esperti, un critico del roster, un Verificatore
indipendente) ha prodotto **11 risultati, 0 fabbricazioni, 0 bloccanti** su uno
schema che il gate dichiarava VERDE 9/9, e ne ha **abbassate quattro** in
verifica. Cinque sono stati chiusi con una quarta migrazione, tre dichiarati
come debito. Ma il risultato che riguarda **questa skill** è un altro:

> Un'asserzione pgTAP dichiarava di provare il trigger e il `grant` per colonna,
> e **restava verde con il trigger rimosso** — per quell'attore la policy
> filtrava già tutto. Un test che sopravvive alla sparizione della difesa che
> dice di provare non è un test debole: è un **timbro**.

Lo `STATO.md` già dichiara che «il gate verifica che i test esistano e passino,
non che siano severi». Qui ce n'è un esemplare vivo, prodotto da questa skill al
primo giro su un progetto vero. Nessuna regola dell'audit può vederlo: la prova
richiede di **sabotare ed eseguire**, cioè togliere la difesa e guardare se il
test cade. È materia da decidere (un passo di mutazione nel gate? una regola di
scrittura nelle reference?), non da chiudere in un verbale.

E la riga del Verificatore, che è la conferma indipendente di
`COME-PROVARLA.md` §4 su un progetto nuovo: **i quattro strumenti statici del
gate — `sqlfluff`, `squawk`, `db lint`, `db advisors` — tacciono su tutti e
undici i risultati.** Nessun marchio `tool-flagged`: ogni conferma è nata da una
riproduzione del Verificatore.

### Fuori dalla skill, ma misurato qui

Le porte del pilota **non** sono quelle prenotate dalla regia: il blocco
`57620-57629` sta dentro l'esclusione WinNAT `57464-57963` e Docker rifiuta il
bind (*«a socket in a way forbidden by its access permissions»*).
`Test-NetConnection` e `Get-NetTCPConnection`, con cui il blocco era stato
misurato libero, **non vedono gli intervalli esclusi**. Vale per tutti i banchi
di questo repo: `netsh interface ipv4 show excludedportrange protocol=tcp`.

### Una riga dal consumatore a valle: il cast precede il corpo (P.4b, 2026-08-05)

Trovata dal tribunale dell'anello 08 sul pilota `fornodoro`, riprodotta da un
verificatore indipendente, **non corretta qui** (il consumatore riporta, il
proprietario decide).

La disciplina «la **forma** si valida PRIMA del cast, o è il cast a parlare al
posto nostro» — scritta dall'indurimento del 2026-08-04 e applicata a
`voce_menu_id` e `quantita` dentro `crea_ordine` — **non copre gli argomenti
tipizzati non-`text` della firma**. `crea_ordine(… ritiro_at timestamptz …)`:
PostgREST casta l'argomento **al legame**, prima che il corpo della funzione
giri, quindi la guardia `if ritiro_at is null or ritiro_at < now() …` non vede
mai una stringa malformata. Misurato con la chiave anonima:

```
POST /rest/v1/rpc/crea_ordine  {"ritiro_at":"non-una-data", …}
→ 400  {"code":"22007","message":"invalid input syntax for type timestamp with time zone: \"non-una-data\""}
```

Cioè esattamente l'errore nativo che il §6 di quella migrazione dichiara di aver
chiuso, e per l'unico argomento a cui la regola non è stata applicata. Non è un
difetto di quel progetto: è una **regola della skill che si ferma un passo
prima**, e rinasce in ogni RPC futura con un argomento non-`text`.

Proposta: la reference delle RPC dica che **ogni argomento di una funzione
esposta a PostgREST si dichiara `text`** e si casta dentro, dopo un controllo
esplicito; e che un `check` di tipo nella firma è, dal punto di vista del
messaggio d'errore, indistinguibile da un `check` di tabella — cioè una riga di
Postgres servita a uno sconosciuto. Un test pgTAP non lo intercetta: pgTAP chiama
la funzione **da dentro il database**, dove il cast è già avvenuto sul valore
tipizzato. Serve una prova che passi dall'endpoint HTTP.

## `evolve` sul pilota, 2026-08-06 (P.4f) — sei difetti della skill

Primo `evolve` su un progetto vero, con quattro anelli costruiti sopra. Verbale
con le misure: `PILOTA-EVOLVE-2026-08-06.md`. **Solo le righe, non le
correzioni**: le decisioni sono del proprietario della skill.

1. **Il gate non ha un posto per la concorrenza, ed è il buco più grande che
   questo pacchetto ha trovato.** Un invariante su un **insieme** di righe —
   «resta sempre almeno un titolare attivo» — non si rompe in una sessione, e
   pgTAP gira in una sessione dentro una transazione. Sul pilota quell'invariante
   era dichiarato per derivazione, era **falso** (due titolari concorrenti lo
   riducono a zero: write skew a READ COMMITTED), e nove passi con 82 asserzioni
   verdi non lo vedevano. Serve una cartella `supabase/tests/concorrenza/` che
   `verify.mjs` esegua **fuori** da `supabase test db`. Finché non c'è, la prova
   la lancia solo chi si ricorda (pilota: `scripts/prova-concorrenza.mjs`).
2. **La regola «un'asserzione che non può fallire non è un'asserzione» ha bisogno
   della sua sorella.** Applicata da sola mi ha fatto *non scrivere* una difesa
   necessaria: da «nessun test di pgTAP può renderlo rosso» ho concluso «è
   codice irraggiungibile». Va aggiunto: **un limite dello strumento non è una
   proprietà del codice**, e un invariante su un insieme va provato a due
   sessioni.
3. **`evolve` non prescrive di rilanciare i test preesistenti *e di leggere
   perché* cambiano.** Restringendo un privilegio, tre asserzioni su `personale`
   hanno cambiato significato e **una interrompeva il file** invece di diventare
   rossa, nascondendo 11 asserzioni su 29. La procedura dice «alla fine si
   riallinea `seed.sql`»: i test sono l'altra metà che un `evolve` sposta, e non
   sono citati.
4. **Un `evolve` che restringe può spegnere una regola dell'audit senza che
   nessuno lo veda.** Togliendo una policy di `insert`, l'issue su
   `personale.is_attivo` è sparita perché la regola 9 guarda solo le tabelle
   inseribili (`audit-lib.mjs:590`): il residuo è passato da 6 a 5 issue e
   *sembra* un miglioramento. Il comando dovrebbe essere tenuto a **diffare il
   residuo dell'audit** e a spiegare ogni riga sparita.
5. **`references/migrazioni.md` non ha il caso «cambiare la firma di una
   funzione»**, che su Supabase è il più probabile di tutti (le RPC sono il
   contratto pubblico). Serve accanto a `alter column type`, con tre righe che
   nella tabella delle operazioni pericolose non ci sono: `create or replace` non
   cambia il tipo di un argomento · due funzioni con gli stessi nomi di parametro
   sono un overload che PostgREST non sa risolvere · **i `grant execute` non
   sopravvivono al `drop`**, e una funzione nuova nasce `execute` a PUBLIC, cioè
   come endpoint per `anon`.
6. **Due trappole da una riga ciascuna.** (a) Un `$$` dentro un **commento** del
   corpo di una funzione chiude il corpo: la prima applicazione è morta con
   `syntax error` su una riga di prosa che citava `` `$$` ``. (b) Un blocco
   `exception` intorno a un cast **non deve enumerare le condizioni**: ne avevo
   elencate tre perché tre le avevo misurate, e Postgres ne ha una quarta
   (`22009`). La forma giusta è la classe (`sqlstate like '22%'`) con `raise` per
   tutto il resto.

E una per `references/sabotaggio.md`: **il collaudo per sabotaggio deve verificare
il proprio rilevatore.** Il mio primo giro ha dichiarato sani dieci test tutti
sabotabili, perché leggeva l'uscita di `psql` nel formato allineato (le righe TAP
finiscono dentro una cella e cominciano con uno spazio, quindi
`startswith("not ok")` non ne vede nessuna). Il primo sabotaggio di una batteria
deve essere uno di cui si conosce già la risposta.

**Conferma di una riga già in questo file**: la voce sul cast di `ritiro_at`
(sopra) prescriveva «ogni argomento di una funzione esposta a PostgREST si
dichiara `text`». È giusta, e su questo pilota l'ho violata **nella migrazione
che chiudeva quel difetto**, creando `cambia_ruolo(persona uuid, …)` — misurato
`22P02`, e prima di ogni controllo di autorizzazione. La regola va messa dove si
legge scrivendo una funzione nuova, non solo dove si corregge una vecchia.
