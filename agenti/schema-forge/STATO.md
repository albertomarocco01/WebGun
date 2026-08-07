# STATO — schema-forge

**A che punto è:** collaudata a fondo e usata su un pilota vero (`cavia`), mai su un cliente pagante; il gate ha smesso di essere verde su uno schema sfruttabile, ma resta cieco alla semantica delle policy.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria `node --test` **228/228** (misurata oggi); gate rilanciato dalla direzione sul pilota `cavia`, regia `01bb83d` (contiene tutte le correzioni P.7e): `GATE SCHEMA: VERDE (0 falliti su 9 passi)`.

## Cosa fa

Progetta e fa evolvere lo schema Postgres/Supabase dei progetti Web Gun: tabelle, vincoli, indici, RLS, policy, privilegi, seed, test pgTAP, tipi TypeScript. È il **primo agente costruttore**: tutto il resto della catena costruisce sopra ciò che decide qui. Comandi: `model`, `forge`, `seed`, `test`, `verify`, `types`, `evolve`, `handoff`.

Le tre leggi:

1. **Il modello prima del DDL (Specchio del dominio).** Niente SQL prima che entità, relazioni, cardinalità e regole di accesso siano riformulate **e confermate**. In pipeline lo Specchio si scrive nell'handoff come «modello assunto», e un'assunzione **strutturale** ferma la pipeline.
2. **Il database è il giudice, non l'LLM.** Una migrazione è valida se applicata davvero su un database pulito e passata alla batteria deterministica. Strumento assente = **verifica mancante**, mai un falso «tutto pulito».
3. **Nessuna tabella nuda.** RLS attiva e policy esplicite deny-by-default su ogni tabella raggiungibile dal client; viste `security_invoker`, funzioni `security definer` più `search_path`.

Due regole valgono quanto le leggi: **una migrazione applicata è immutabile** (evoluzione expand-contract; ogni distruttivo è un checkpoint umano e si dichiara al gate con `-- squawk-ignore`), e **i privilegi si scrivono, non si ereditano** (`revoke` poi `grant` per `anon`, `authenticated` **e** `service_role`).

## Il gate

**Nove passi**, in quest'ordine. Gli `id` sono il contratto del `--json` e non cambiano; le etichette sì.

| passo | cosa prova |
|---|---|
| `sqlfluff` | formato SQL — misura i byte di ogni file **prima**, perché sqlfluff salta in silenzio i file oltre il limite ed esce 0 |
| `squawk` | operazioni pericolose; un distruttivo passa solo se autorizzato e dichiarato |
| `db-reset` | applica davvero migrazioni e seed su un database pulito; un ritentativo, e il dettaglio dice che è stato usato |
| `db-lint` | il linter dello schema della CLI Supabase |
| `db-advisors` | linter sicurezza/performance mantenuto da Supabase; rosso solo sugli `ERROR`, i `WARN` restano scritti |
| `audit-rls` | le **undici** regole di `audit-lib.mjs` sul catalogo vero; dichiara quale database, quali schemi e **quanti oggetti** ha guardato |
| `pgtap` | i test delle policy girano davvero — conta i `.sql` di primo livello, cartella vuota = mancante |
| `tipi` | `supabase gen types` riproduce i tipi committati (BOM e CRLF normalizzati; un tipo diverso resta rosso) |
| `contratto-uscita` | configurazioni copiate, handoff esistente e senza segnaposto non sostituiti, e la riga `Gate: VERDE`/`Gate: ROSSO` **confrontata col verdetto degli otto passi precedenti** |

Si lancia dalla radice del progetto generato, da entrambi i canali (`agenti/…` e la junction `.claude/skills/…`):

```bash
node <skill>/scripts/verify.mjs [--db-url <url>] [--json] [--skip-reset]
```

Uno strumento assente vale `skipped`, cioè verifica mancante: **mai `pass`**.

## Come si prova

```bash
# 1. la batteria degli script (nessun database richiesto)
cd agenti/schema-forge && npm test          # 228 test, 0 fail (misurato il 2026-08-07)
# senza npm nel PATH:
# "/c/Program Files/nodejs/node.exe" "/c/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" test

# 2. il banco: banco-prova-vetcare/ nella radice della regia
supabase start                              # dalla cartella del banco
node <skill>/scripts/verify.mjs
# deve chiudere ROSSO, 2 falliti, 0 mancanti su 9: auto-promozione su
# staff.job_title, macchina a stati su visits.status, pgTAP 22-23.
# E' il caso di prova permanente di uno schema difettoso: e' rosso apposta.

# 3. il gate su un progetto vero, dalla sua radice
node <skill>/scripts/verify.mjs

# guardiani
npx eslint scripts/ && npx knip && npx jscpd scripts/
```

Prerequisiti e trappole **misurati su questa macchina**:

- Node **21+** per la batteria: `scripts/**/*.test.mjs` è un glob, e `node --test scripts/` non trova niente.
- `psql` in `%USERPROFILE%\scoop\apps\postgresql\current\bin` (senza, audit RLS ed ERD escono con verifica mancante); `sqlfluff` e `squawk` (pipx) in `%APPDATA%\Python\Python314\Scripts`; Supabase CLI **≥ 2.81.3** per `db advisors`.
- **I tipi si generano da Git Bash**: in PowerShell la redirezione scrive UTF-16 e il passo `tipi` resta rosso senza motivo apparente.
- **Non impostare `SUPABASE_DB_URL`**: il database lo decide `[db].port` del `config.toml`. Lanciando `rls-audit.mjs`/`erd.mjs` a mano su porta non standard, passa `--db-url`: il default 54322, con due stack accesi, è il database di un altro progetto.
- Porte dei banchi **sotto 49152**: gli intervalli che WinNAT riserva **si spostano fra un riavvio e l'altro** (misurati `57464-57963` un giorno, `50000-50059` / `50962-51461` / `61185-61284` il giorno dopo), quindi non se ne memorizza nessuno — si rilancia `netsh interface ipv4 show excludedportrange protocol=tcp` prima di scegliere. `Test-NetConnection` non li vede: guarda chi ascolta, non chi ha prenotato. Il sintomo è Docker che fallisce con «a socket in a way forbidden by its access permissions» — porta **vietata**, non occupata.
- `db reset` che fallisce con 502 = analytics acceso (`[analytics] enabled = false`). Un solo stack Supabase alla volta: la macchina ha 16 GB.
- Un **FAIL del passo `tipi` col dettaglio vuoto** è sospetto d'ambiente (`supabase gen types` morto senza stderr, a memoria satura), non tipi divergenti.
- Il gate fa un `db reset`: **lascia il database senza gli account di sviluppo**. Prima di flow-sentinel ci va il seed di sviluppo.
- In Docker una connessione «locale» **non è di loopback**: Postgres vede il client arrivare dal gateway della rete Docker (`172.18.0.1`), non da `127.0.0.1` — misurato con `inet_server_addr()`/`inet_client_addr()`. Una guardia che deduce l'ambiente dal loopback rifiuta **sempre**, anche in sviluppo (`references/modellazione.md` §La guardia del seed di sviluppo).
- **Un test pgTAP che pesca dal seed prova anche il seed**, e diventa rosso parlando d'altro il giorno che il seed cambia. Il banco condiviso fra i file va in `supabase/tests/` con estensione **non `.sql`** (ogni `.sql` di quella cartella è eseguito come test a sé, e il passo `pgtap` li conta) e si include con `\ir` dentro una transazione annullata.
- Il `hint` di PostgREST nomina il privilegio mancante su un `42501` **di tabella**, ma è **sempre `null`** sugli endpoint RPC: i permessi di una funzione esposta si debuggano leggendo il `proacl` nel catalogo, non la risposta HTTP.

## Cosa NON è mai stato provato

- **Nessun cliente vero.** Un pilota (`cavia`, in `C:/Users/Utente/Desktop/cavia`) e quattro banchi. Nessuno schema è mai andato in produzione con dati reali, né su Postgres gestito: solo Supabase locale in Docker su Windows.
- **Il gate guarda la forma delle policy, non la semantica.** Sullo schema che dichiarava VERDE 8/8 il tribunale riprodusse con comandi reali **16 difetti su 17**, cinque Critical, mentre sqlfluff, squawk e audit erano tutti verdi. Oggi il gate ne trova due; gli altri li trova solo chi li attacca.
- **Il gate verifica che i test negativi esistano e passino, non che siano severi.** Un `insert` che il test si aspetta riesca copre la casella: scelta misurata — pretendere `throws_ok` avrebbe bocciato test negativi corretti. Esemplare vivo dal pilota: un'asserzione pgTAP dichiarava di provare trigger e `grant` per colonna e **restava verde col trigger rimosso**. Nessuna regola dell'audit può vederlo: la prova richiede di **sabotare ed eseguire**.
- **Nessun passo tenta un accesso vero.** Le RLS si provano con `set role` e pgTAP, che parlano a Postgres senza passare da GoTrue né da PostgREST. Su un progetto chiuso VERDE 9/9 il login era **HTTP 500 per ogni utente** (seed con i token di `auth.users` a NULL) e nessun passo se n'è accorto. Stessa cecità quando la CLI Supabase cambiò i privilegi di default: nove passi verdi, nove test E2E rossi, progetto rotto **da fermo** — i passi girano tutti come `postgres` o con `set role`, **mai con la chiave di servizio**.
- **Nessuna prova di concorrenza.** pgTAP gira in una sessione dentro una transazione: un invariante su un **insieme** di righe («resta sempre almeno un titolare attivo») non si rompe lì. Sul pilota era falso — write skew a READ COMMITTED — e 82 asserzioni verdi non lo vedevano. La **difesa** è nota e provata su tre vie d'attacco (trigger di istruzione con `pg_advisory_xact_lock` prima del conteggio: `references/modellazione.md` §Invarianti su un insieme di righe); quello che manca è il **passo di gate** che la pretenda.
- **Le colonne di privilegio si riconoscono dal nome** (`ruolo|role|is_admin|is_staff|job_title|permessi…`), tranne quando la prova sta nel catalogo. Una colonna `livello`, o un `is_active` letto dentro una funzione chiamata da una policy, non la vede nessuno: su un banco a valle chi veniva disattivato si riaccendeva da solo.
- **Una colonna di stato con `check (col in (…))` e nessun trigger non produce nessun finding**: la regola 9 guarda solo le macchine a stati che un trigger difende. Se la macchina vive solo nell'applicazione, il gate tace.
- **Il gate non può vedere un seed non rieseguibile a caldo**: `db reset` parte sempre da un database pulito.
- **Nessuna regola per Storage**: non è fra gli schemi esposti dell'API, l'audit non lo guarda.
- **`docs/schema/ERD.md` è nel contratto d'uscita e nessun passo lo verifica**, di proposito: pretenderlo renderebbe rosso ogni progetto che non ha ancora rigenerato il diagramma, e un rosso strutturale insegna a ignorare il rosso.
- **Il controllo di arità dei record del catalogo non è mai stato esercitato dal guscio**: servirebbe un finto `psql.exe`, e uno `.cmd` viene respinto prima dal filtro degli eseguibili.
- **`banco-prova-vetcare` non è stato rilanciato dopo P.7d/P.7e**: il suo verdetto scritto (ROSSO, 2 falliti su 9) è del **2026-08-04**, precede le riscritture dell'audit. Il verde del pilota è del 2026-08-07; il rosso no.
- **Limiti dichiarati degli spogliatori**: `senzaCommentiSql` non gestisce `E'…''` e lascia dov'è un commento dentro un corpo quotato col dollaro; `senzaCommentoToml` non gestisce le stringhe TOML multi-riga. Il `translate` sulle undici query di testo libero dell'audit non è mai stato provato: vuole un Postgres vivo.
- **`semgrep` dichiara ancora 12 rilievi** su questi script (undici falsi positivi con la prova a fianco, uno vero e corretto ma invisibile allo strumento). Nessun `nosemgrep`: il conteggio resta **dichiarato**, non silenziato.
- **Il confronto con la skill ufficiale Supabase** fu fatto sulla 0.1.2 mentre il changelog accanto arrivava alla 0.1.5: prima di rifarlo va riscaricata (`skills-lock.json`).

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| **Template del seed**, due difetti: `auth.users` scritta a mano senza le quattro colonne dei token a stringa vuota e `auth.identities` mai popolata; e un file solo, con dentro le credenziali di sviluppo | sanati a mano su ogni progetto, mai alla fonte — **quarta volta** che la riga viene scritta. Nota: `auth.identities.email` è `generated always`, nominarla fa fallire l'`insert`. La forma provata sul pilota — tre file (riferimento / locale / solo-sviluppo), guardia a quattro condizioni fail-closed, account di produzione creato da uno script con la chiave di servizio — è scritta per esteso in `references/modellazione.md` §Seed: **manca solo di diventare il template** | proprietario |
| Un passo di gate che tenti un **accesso vero** (`POST /auth/v1/token` con un utente del seed) | chiuderebbe alla radice la cecità su GoTrue/PostgREST: deterministico, senza browser | proprietario |
| Versione della CLI Supabase e dell'immagine Postgres non fissata da nessuna parte | è la cosa che decide i permessi del database, ed è l'unica lasciata libera | direzione |
| Rieseguire `supabase/seed.sql` sul database caldo dentro `passoReset` | premessa già provata sul pilota, con trigger di dominio e macchina a stati: resta la decisione, non più la misura | proprietario |
| `evolve`, quattro voci: `tsc` sui tipi rigenerati **prima** del grep; riallineare i test pgTAP accanto al seed; diffare il residuo dell'audit spiegando ogni riga sparita; rilanciare i test preesistenti **e leggere perché** cambiano | misurate: il grep su `body`/`name`/`status` annega il segnale dove `tsc` trovava 15 errori in 4 file; togliendo una policy di `insert` un issue è sparito e *sembrava* un miglioramento; un'asserzione che cambia significato può **interrompere il file** invece di diventare rossa, nascondendone 11 su 29 | proprietario |
| `references/migrazioni.md`: manca il caso «cambiare la firma di una funzione» — il più probabile su Supabase, le RPC sono il contratto pubblico | `create or replace` non cambia il tipo di un argomento; stessi nomi di parametro = overload che PostgREST non risolve; **i `grant execute` non sopravvivono al `drop`**, e la funzione nuova nasce eseguibile da PUBLIC | proprietario |
| `references/migrazioni.md` **non dice se l'immutabilità valga anche dentro `forge`**, cioè prima che esistano un handoff e un consumatore | il testo motiva la regola con gli ambienti allineati («se è già in produzione…»), quindi ammette due letture: sul pilota è stata letta «no» e dichiarata nel verbale, un'altra chat leggerà «sì», e **le due producono artefatti diversi** | direzione |
| `references/modellazione.md` §Seed copre l'idempotenza degli `insert` e **tace sugli `update`** | con una macchina a stati gli ordini nascono nello stato iniziale e arrivano agli altri con `update`: alla seconda esecuzione a caldo tenterebbero una transizione all'indietro e il trigger li **rifiuta**. La forma che regge è l'`update` guardato dallo stato di partenza (`… and stato = 'in_preparazione'`), provata sul pilota con tre riesecuzioni a caldo — conteggi **e stati** identici | proprietario |
| Due trappole da una riga nelle reference delle funzioni — **scritte il 2026-08-07 in `references/migrazioni.md` §Due trappole da una riga** | (a) un `$$` dentro un **commento** del corpo chiude il corpo: la prima applicazione è morta con `syntax error` su una riga di prosa che citava `` `$$` ``; (b) un blocco `exception` intorno a un cast **non deve enumerare le condizioni** — ne erano state elencate tre perché tre misurate, e Postgres ne ha una quarta (`22009`): la forma giusta è la classe (`sqlstate like '22%'`) con `raise` per tutto il resto | **chiuso** |
| Reference RPC: ogni argomento esposto a PostgREST si dichiara `text` e si casta dentro, dopo un controllo | PostgREST casta **al legame**, prima che il corpo giri: la guardia non vede la stringa malformata e l'errore nativo (`22007`, `22P02`) va servito a uno sconosciuto; pgTAP non lo intercetta. Già violata due volte, la seconda nella migrazione che chiudeva il difetto | proprietario |
| Cartella `supabase/tests/concorrenza/` eseguita da `verify.mjs` **fuori** da `supabase test db`, con la regola sorella: **un limite dello strumento non è una proprietà del codice** | oggi la prova la lancia solo chi se ne ricorda; e «nessun test può renderlo rosso» ha già portato a concludere «irraggiungibile» e a non scrivere una difesa | proprietario |
| Euristica delle colonne di privilegio estesa agli interruttori (`is_active`, `attivo`, `abilitato`, `enabled`, `sospeso`), **solo dove la prova è nel catalogo** | il vincolo «solo dove la prova è nel catalogo» evita il rumore su `products.is_active` | proprietario |
| Un finding — anche solo `issue` — per una colonna di stato con `check` di dominio e nessun trigger | oggi non lo produce nessuna regola | proprietario |
| Voci non di sicurezza mancanti nelle references (M1-M4, M9, M11) | le sei di sicurezza sono chiuse, queste no. Le quattro righe di §Errori classici stanno **sotto la riga di separazione**: il gate non le guarda, ed è scritto quali | proprietario |
| «Nessun dato riservato in una colonna di una tabella leggibile» resta prosa | è una domanda di dominio, non una proprietà del catalogo: nessuna euristica sul nome la coprirebbe senza rumore | non chiudibile con una regola |
| Tre porte del tribunale del 2026-08-07: la E-string con la fuga a barra rovesciata ribalta la parità degli apici in `senzaCommentiSql` (riapre da SQL **valido** il verde falso del test commentato); `regolaTestNegativi` accetta un attacco che vive dentro una stringa; `primoArrayJson` accetta il primo array che si interpreta, non quello degli advisors | ognuna vuole un test che la falsifichi **e** il gate rilanciato su un banco vivo | proprietario |
| Il collaudo per sabotaggio deve verificare il proprio rilevatore — e **questa skill non ha nessuna `references/sabotaggio.md`** (ce l'hanno flow-sentinel, vetrina-crafter e site-doctor): la riga non ha ancora un file dove stare | il primo giro dichiarò sani dieci test tutti sabotabili: leggeva `psql` nel formato allineato, dove le righe TAP finiscono in una cella e cominciano con uno spazio. Il primo sabotaggio di una batteria dev'essere uno di cui si conosce già la risposta | proprietario |
| `.gitattributes` nel template dei progetti generati | senza, il difetto rinasce a ogni progetto; segnalato anche da flow-sentinel | direzione |
| `banco-prova-vetcare` resta rosso | è il caso di prova permanente di uno schema difettoso: portarlo a verde è lavoro sul banco, non sull'agente | nessuno, per scelta |
| `jscpd`: 1 clone (8 righe, 0,25%) fra `audit-lib.mjs` ed `erd-lib.mjs` | estrarlo accoppierebbe due librerie volutamente indipendenti per otto righe: decisione, non svista — ma va scritto che lo strumento lo vede | nessuno, dichiarato |

## Com'è andata (in breve)

- **2026-07-25, primo collaudo del comportamento.** Due bug vivi dal primo giorno spegnevano regole intere: il CRLF di `psql` su Windows, e il cast booleano (`boolean::text` rende `'true'`, non `'t'`). Da lì le regole pure nelle `*-lib.mjs` e i primi **49 test**.
- **2026-07-26, secondo collaudo, indipendente e avversario** su dominio non e-commerce: `/code-inquisition` riprodusse con comandi reali **16 difetti su 17**, cinque Critical, su uno schema VERDE 8/8. Nascono le tre regole nuove e i **test pgTAP negativi obbligatori**; lo stesso schema chiude ROSSO e i test negativi falliscono su quelle due cose e su nient'altro (2 asserzioni su 23).
- **2026-07-27**: sette regole nuove dal confronto con la skill ufficiale Supabase e il nono passo `db advisors`; due premesse consegnate col compito furono **smentite dal database**. 66 → 93 → 132 test.
- **2026-07-28, audit del repo**: il gate promuoveva un **handoff bugiardo**, verificandone la forma e non ciò che diceva. 143 test.
- **Tre consumatori a valle** hanno riportato ciò che il gate non vedeva: i `grant` delle migrazioni no-op su Supabase; un seed che rendeva il sito inaccessibile; e un progetto rotto **da fermo** quando la CLI cambiò i privilegi di default.
- **2026-08-03 (P.8)**: i privilegi entrano nel contratto. Cinque premesse provate su Postgres reale, due cambiarono la regola — `Dxtm` comprende TRUNCATE, e la RLS non si applica a TRUNCATE. Regola 7 riscritta: 0 findings prima, **21 `block`** dopo. 153 test.
- **2026-08-04**: primo pilota fuori dall'albero della regia (oggi `cavia`), gate **VERDE 9/9 al primo colpo**, invocato dalla junction; lo STOP dello Specchio ha tenuto.
- **2026-08-06/07 (P.7c → P.7e)**: `semgrep` e `gitleaks` puntati per la prima volta sugli script (12 rilievi, **uno vero**: un nome di colonna interpolato in una `RegExp` uccideva l'audit RLS); poi `/code-inquisition` trovò **dodici difetti** che ESLint 0, semgrep 0, gitleaks 0 e 156 test verdi non vedevano — fra cui il progetto auditato che sceglieva il binario che lo giudica. Un secondo tribunale, sul pacchetto stesso, ne aggiunse diciannove. Batteria **156 → 186 → 216 → 228**.
