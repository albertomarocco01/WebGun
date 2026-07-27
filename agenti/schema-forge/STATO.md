# Stato — Schema Forge

- **Stato attuale:** v1.3 — collaudata su Postgres reale (Supabase locale, Windows), **nel comportamento** (`COLLAUDO-2026-07-25.md`) e **corretta**: gli otto punti aperti del primo collaudo sono chiusi il 2026-07-26 (§Correzioni del 2026-07-26). Gli script hanno test propri (`node --test`, **93 verdi**), e il gate `verify` è **VERDE su 9 passi su 9** (dal 2026-07-27 include `supabase db advisors`) anche dopo un `evolve` con distruttivi autorizzati, su due domini diversi. Sette regole nuove il 2026-07-27, tutte provate su Postgres reale (§Regole nuove dalla skill Supabase ufficiale).
  **NON usabile su un progetto cliente.** Il secondo collaudo, indipendente e avversario (`COLLAUDO-2026-07-26.md`, dominio **non e-commerce**), ha fatto girare per la prima volta `/code-inquisition` sulle policy RLS: sullo schema che il gate dichiara VERDE, il tribunale ha **riprodotto con comandi reali 16 difetti su 17**, cinque Critical, mentre `sqlfluff`, `squawk` e `rls-audit.mjs` erano tutti verdi. Le regole del 2026-07-27 hanno portato l'audit di quello schema da 1 a 12 `issue`, ma il gate lì è **ancora VERDE (9/9)** e i 16 difetti sono ancora tutti riproducibili: il flusso regge, **il gate verifica che la RLS esista, non che funzioni**. Punti aperti ordinati per gravità in fondo.
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

### Banchi di prova rimossi

`banco-prova/` e `banco-prova-pastificio/` sono stati **cancellati il 2026-07-26**, a collaudo chiuso: erano progetti Supabase usa e getta e si rigenerano con `supabase init`. Restano i verbali (`COLLAUDO-2026-07-25.md`) e ciò che il collaudo ha prodotto — regole nelle references, test negli script. Il logo della skill, che stava dentro `banco-prova/`, è ora in `resources/branding/`.

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
  (stessa procedura di `DECISIONI.md` §7). Referto in `COLLAUDO-2026-07-26.md` §8.2.
- ~~**Il comando `rls` non è mai stato collaudato da solo**, né uno schema con
  viste materializzate~~ — collaudati entrambi. Entrambi hanno prodotto un
  difetto: vedi i punti 2 e 5 qui sotto.

### Resta aperto — ordinato per gravità

1. **Il gate è verde su uno schema sfruttabile.** È il blocco n°1. Nessuno degli
   strumenti guarda la **semantica** delle policy: verificano che la RLS esista,
   che le policy ci siano e che gli indici ci siano. I cinque Critical del
   tribunale (auto-promozione di ruolo, fattura riapribile, riga di fattura
   spostabile, macchina a stati aggirabile in `INSERT`, archivio clinico che
   copre 2 colonne su 8) sono tutti invisibili al gate. **Finché non si chiude,
   un gate verde non è una garanzia consegnabile.**
   Le due direzioni possibili: (a) test pgTAP **negativi** obbligatori — che
   tentino l'exploit e ne asseriscano il rifiuto; (b) regole nuove in
   `audit-lib.mjs` per le classi che sono catalogabili (colonna di ruolo
   scrivibile dal suo stesso proprietario, trigger di transizione senza
   controparte `INSERT`, ~~funzione `EXECUTE`-abile da `anon`~~ — quest'ultima
   **fatta** il 2026-07-27, con le altre sei della skill Supabase ufficiale).
   Restano fuori l'auto-promozione via **colonna** (l'audit ora blocca solo quella
   via `user_metadata`) e la macchina a stati: il blocco n°1 **resta aperto**.
2. **`SKILL.md`:62 fa auditare il database sbagliato.** La procedura del comando
   `rls` prescrive `node <skill>/scripts/rls-audit.mjs` senza `--db-url` né
   `--schemas`: eseguita alla lettera ha auditato **il database di un altro
   progetto** e ha risposto «nessun bloccante». La correzione di `DECISIONI.md`
   §11 è stata applicata a `verify.mjs` e non a questo percorso. Il comando `rls`
   **andrebbe tolto**: non aggiunge nulla a `forge` e fa peggio di `verify`.
3. **Tre falsi verdi del gate**, tutti riprodotti:
   - `sqlfluff` **salta in silenzio** i file oltre 20 000 byte ed esce 0;
     `verify.mjs`:168 scarta stderr sui passi verdi, quindi l'avviso non arriva
     mai. Uno statement invalido dentro un file da 20 047 byte → passo `OK`.
   - `supabase/tests/` **vuota** → passo pgTAP `pass`. Cartella assente →
     `skipped` (rosso). **Cancellare i test rende il gate più verde.**
   - Senza `[db].port`, `urlDbProgetto()` torna `null`, `verify` non passa
     `--db-url`, l'audit ricade sulla 54322 **e la riga «quale database»
     sparisce** — la garanzia di `DECISIONI.md` §11 svanisce dove servirebbe.
4. **`schemas` su più righe non viene letto.** TOML valido; `schemiEsposti()`
   ripiega su `["public"]` **senza dirlo**, e il gate stampa «schemi esposti:
   public» come se fosse la verità. Uno schema secondario esposto resta
   inaudito.
5. **Le viste materializzate sono `issue`, non `block`.** Non supportano
   `security_invoker` per costruzione — sono strettamente peggiori di una vista
   nuda, che è `block` — eppure **non bloccano il gate**. Una MV che unisce ogni
   cartella clinica a ogni nota interna passa.
6. **Due caselle del gate di chiusura che nessuno strumento verifica.**
   `SKILL.md`:87 («nessun dato riservato in una colonna di una tabella
   leggibile») e il divieto di ruolo in colonna scrivibile: piantati entrambi,
   **0 findings**. Sono le due prove avversarie più pericolose, difese solo da
   prosa.
7. **`resources/config/.sqlfluff` contro `references/rls-supabase.md`.** Il nome
   di policy dell'esempio della reference, verbatim, fa scattare `RF05`;
   `ignore_words = name,label` è il vocabolario dell'e-commerce e blocca `role`
   e `summary`. La configurazione viaggia con la **skill**, quindi un progetto
   non può estenderla senza modificare l'agente. O si esenta `RF05` sui nomi di
   policy, o le reference vanno riscritte in `snake_case`.
8. ~~**`rls-supabase.md`:90 dichiara un meccanismo falso.**~~ — corretto il
   2026-07-27 con la spiegazione **verificata al banco**: su `insert` Postgres nega
   ogni inserimento; su `update`/`all` riusa `using` come controllo sulla riga
   nuova, quindi `using (true)` senza `with check` è il buco e `using (ownership)`
   senza `with check` non lo è. È anche la regola `block` n°3 dell'audit.
9. **Il contratto `--json` non è documentato né stabile.** Nessuno schema; l'unico
   identificatore di passo è l'etichetta italiana (`"contratto d'uscita
   (configurazioni + handoff)"`); block/issue/warn appiattiti in prosa dentro
   `detail`. Serve un `id` stabile per passo e i conteggi strutturati.
10. **`pattern-ecommerce.md`:29 non regge fuori dall'e-commerce.**
    `profiles.id = auth.users.id` presuppone che ogni cliente sia un utente del
    sito. Una clinica ha clienti che telefonano: seguendolo alla lettera, metà
    della clientela non è rappresentabile.
11. **Il gate non può vedere un seed non rieseguibile a caldo.** `db reset` parte
    sempre da un database pulito, quindi la regola di `modellazione.md`:67
    (`insert … select … where not exists` coi trigger di dominio) — che è
    **vera**, verificata sul campo — resta non verificabile dal gate.
12. **semgrep e gitleaks non sono installati**: sicurezza e segreti sugli script
    restano **MANCANTI**, non `PASS`. È anche l'unica difesa automatica contro
    una `service_role` finita nel client.
13. **Nessun consumatore reale a valle.** L'analisi di impatto di `evolve` ha
    girato di nuovo sul caso facile, senza codice applicativo. Fly UI e
    Gestionale Crafter non esistono ancora.
14. **`has()` non vede gli shim `.cmd` su Windows** (`verify.mjs`:35-38): chi
    installa la CLI Supabase via npm ottiene quattro passi `skipped` con il
    messaggio «Supabase CLI assente» su una macchina dove è installata. Il guasto
    va nella direzione sicura, la diagnosi no.
15. **Diciotto voci mancanti nelle references** (`COLLAUDO-2026-07-26.md` §1.2),
    ognuna con la frase esatta e il file esatto. Le sei più gravi non le aveva
    colmate nemmeno l'auditor: ~~`revoke execute` sulle funzioni RPC~~ (chiuso il
    2026-07-27: scritto nelle reference **e** diventato una regola dell'audit,
    che sul banco ha trovato 11 funzioni scoperte) · macchina a
    stati vincolata anche in `INSERT` · transizioni per **ogni** stato, non solo
    il principale · trigger che scrive su tabella con RLS deve essere
    `security definer` · audit trail con la colonna dell'attore · validazione
    degli argomenti di un RPC `security definer`.

## Regole nuove dalla skill Supabase ufficiale (2026-07-27)

Installata `.claude/skills/supabase/SKILL.md` (skill ufficiale Supabase, v0.1.2) e
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

- **Schemi dichiarativi** (`supabase/schemas/`): non adottati — vedi `DECISIONI.md` §13.
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

## Guardiani sugli script della skill (2026-07-25)

Gli script degli agenti passano sotto i guardiani **come qualsiasi altro codice** (CLAUDE.md, Regola dei guardiani). Predisposto il minimo perché la batteria giri sui soli `scripts/` della skill, senza trasformare il repo di regia in un progetto applicativo:

- `agenti/schema-forge/package.json` — `"type": "module"`, `private: true`, tre devDependencies (`@eslint/js`, `eslint`, `jscpd`, `knip`)
- `agenti/schema-forge/eslint.config.mjs` — `js.configs.recommended` più le soglie di complessità (`complexity 15`, `max-depth 4`, `max-params 4`)
- `agenti/schema-forge/knip.jsonc` — entry point CLI dichiarati, ogni esenzione con la motivazione sulla riga sopra
- `node_modules/` e `.jscpd/` in `.gitignore`: si reinstallano con `npm install` dalla cartella dell'agente

**Residuo reale di `node agenti/code-maniac/scripts/scan.mjs`: 0 passi con problemi, 6 saltati su 10.**

| Passo | Esito |
|---|---|
| Lint (ESLint) · Complessità · Codice morto (knip) · Duplicati (jscpd) | **PASS** — ma la voce «Complessità» era **falsa il giorno in cui è stata scritta**: `verify.mjs`:`main()` era a 51 contro una soglia di 15, e lo scan non era stato rilanciato dopo l'ultima modifica. Vero dal 2026-07-27, quando `main()` è stata spezzata (§Residuo chiuso lo stesso giorno) |
| Prettier · tsc · convenzioni · dependency-cruiser | MANCANTE — non pertinenti qui (niente TypeScript, niente grafo di moduli da validare) |
| **semgrep · gitleaks** | **MANCANTE — non installati.** Regole di sicurezza e ricerca di segreti sugli script **non verificate**: vale `MANCANTE`, non `PASS` |

Corretto solo ciò che era oggettivo: quattro `export` inutilizzati (`pulisci`, `vero` in `audit-lib.mjs` e `erd-lib.mjs` — usati solo dentro il proprio file: superficie pubblica senza consumatori) e `@eslint/js` non dichiarato fra le dipendenze. **I 49 test restano verdi** dopo le correzioni.

Scelte di stile discutibili **elencate e non toccate**: `pulisci`, `vero` e `riga` sono triplicati identici fra `audit-lib.mjs` e `erd-lib.mjs`; estrarli in un terzo modulo accoppierebbe due librerie volutamente indipendenti, quindi la duplicazione resta una decisione, non una svista.

> **Correzione del 2026-07-27.** La frase originale diceva «jscpd non li segnala, sono sotto ogni soglia»: **falso**, e non era mai stato lanciato per controllare. Ai valori di default (`--min-lines 5 --min-tokens 50`) `jscpd` riporta **2 cloni**: `righeDaPsql` fra `audit-lib.mjs` ed `erd-lib.mjs` (8 righe) e la gestione dell'errore di `psql` fra `erd.mjs` ed `rls-audit.mjs` (11 righe, cambia solo il messaggio). La **decisione** di non estrarli resta — accoppierebbe due librerie indipendenti per otto righe — e `jscpd` esce `0` perché non c'è una soglia configurata. Ma andava scritto che lo strumento li vede: dire «pulito» di uno strumento che segnala qualcosa è la stessa bugia che il gate esiste per impedire.

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
- **Uno strumento esterno nel gate fallisce solo su ciò che lo schema può correggere.** `supabase db advisors` gira con `--fail-on error`: i suoi `WARN` includono impostazioni di Auth del progetto, che nessuna migrazione tocca. Si registrano nel dettaglio, non nel verdetto. Vale come regola generale per ogni strumento che si aggiungerà.
- **Una premessa si prova sul database prima di diventare una regola.** Delle sette regole del 2026-07-27, una era stata proposta con la gravità sbagliata (`insert` senza `with check` come `block`) e una avrebbe prodotto falsi positivi sul codice corretto delle reference (`with check` omesso su `update`). Entrambe si vedono solo eseguendo l'SQL: leggere la documentazione non basta, e il gap analysis di un LLM nemmeno.
