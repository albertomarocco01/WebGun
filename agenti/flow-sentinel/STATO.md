# Stato — Flow Sentinel

- **Stato attuale:** costruita (P1), **collaudata in modo indipendente** (P2) il 2026-07-28, e
  **usata su un consumatore reale** (P3) il 2026-07-30 sul banco `banco-prova-negozio`
  (Bottega Nord), costruito da altri due agenti. Batteria **16/16 verde**, gate **VERDE 7/7**.
  P3 ha trovato **un difetto bloccante dell'app** che due gate verdi a monte non avevano visto
  — nessuno riusciva ad accedere al gestionale — e **un falso verde della skill**: `app-viva`
  ha dichiarato viva l'app di un altro progetto. Verbale: `COLLAUDO-P3-2026-07-30.md`.
  **Secondo passaggio la sera stessa**, dopo che i costruttori avevano chiuso i cinque difetti
  riportati: batteria riestesa a **11 flussi / 16 test**, e un difetto nuovo che non era di
  nessun codice — `service_role` aveva perso i permessi perche' la CLI Supabase era passata da
  2.95.4 a 2.110.0 cambiando `alter default privileges`. **Un progetto fermo si e' rotto da
  solo**, e l'ha visto solo chi usa la chiave per misurare. Dettagli:
  `banco-prova-negozio/docs/handoff/14-flow-sentinel.md`.
  Dettagli della costruzione originale:
  `SKILL.md` confermata in P0 e rimasta **non modificata** attraverso P1, P2 e P3 — la prima
  modifica e' del 2026-07-30, quando il collaudo di `evolve` ha scoperto che quella procedura
  copriva un caso su quattro (`COLLAUDO-EVOLVE-2026-07-30.md` §4); esistono le
  **4 references**, il gate `verify.mjs` a **7 passi** con id stabili, le regole pure in
  `scripts/gate-lib.mjs` con **103 test verdi allora** (**111 oggi**, rimisurati il 2026-08-06 — questa riga diceva 110 mentre §Cosa esiste diceva 111), i **3 template** e la configurazione
  ESLint delle spec. Il gate e' stato **eseguito davvero** su due banchi Next.js + Supabase locale,
  scritti da due mani diverse: `banco-prova-flow/` (P1, e-commerce) e `banco-prova-collaudo-fs/`
  (P2, palestra) — **VERDE 7 su 7 su entrambi**, e rosso ogni volta che qualcosa e' stato rotto apposta.
- **Il collaudo avversario ha trovato dieci difetti**, tutti misurati prima di essere corretti, tutti
  con un test di regressione e un commit ciascuno. Sette erano **falsi verdi**: il gate diceva verde
  senza aver guardato. Verbale con le uscite incollate: `COLLAUDO-2026-07-28.md`.
  **NON ancora usabile su un progetto cliente:** P3 ha tolto il primo dei due dubbi — il terzo banco
  l'hanno scritto **altri agenti**, non chi scriveva le regole — ma il secondo resta intero: i flussi
  critici li ha proposti l'agente e confermati l'orchestratore, mai un committente. Punti aperti in
  fondo, ordinati per gravita'.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: gestionale-crafter (l'app da testare), schema-forge (il modello di accesso del suo
    handoff e' la fonte dei flussi ostili; seed e utenti), ai-specialist se presente.
    **Fly UI non esiste** (`../../DECISIONI.md` §21): non c'e' nessuna libreria di
    componenti a monte, i componenti li scrive a mano chi costruisce il progetto
  - A valle: speed-demon (ottimizza con la batteria come rete di sicurezza), cyber-shield (parte dai
    flussi ostili dichiarati), launchpad (non pubblica su gate rosso)
- **Guardiani:** ESLint **0 errori 0 warning** (riconfermato con `node_modules` locali veri — P.7c punti 1-2, commit `a6f6d1e`, 2026-08-03), `knip` **0 rilievi** (rieseguito dal direttore il 2026-08-04), `jscpd` **0 cloni** su `scripts/`.
- **2026-08-03 — il gate non partiva sul Node di sistema, e usciva `0` muto.** *Il difetto:* l'epilogo era
  `if (import.meta.main) await main();`, e `import.meta.main` e' arrivato in **Node 24**; su Node 20.12.2
  — l'unico Node di sistema di questa macchina — vale `undefined`, `main()` non girava e **il gate usciva
  `0` senza stampare una riga**, cioe' un verde che non aveva guardato niente. Questo gate lo pagava due
  volte: **speed-demon lo lancia come sottoprocesso** col `node` del PATH per il suo passo `rete-verde`, e
  da un gate muto ricavava «non ha prodotto JSON leggibile», cioe' una verifica MANCANTE per colpa d'altri.
  I prerequisiti dichiarati dicono «Node >= 20»: era il codice a violare il proprio contratto. *La
  correzione:* la forma gia' collaudata di `vetrina-crafter`, `process.argv[1]` risolto e confrontato con
  `fileURLToPath(import.meta.url)`, a comportamento invariato su Node 24. *Come si e' provata:* in una
  cartella non-progetto nelle **due direzioni** — prima Node 20 usciva `0` con zero righe e Node 24 usciva
  `2` con il messaggio, dopo **entrambi escono `2` con lo stesso messaggio**. Due test di regressione in
  `scripts/verify.test.mjs` (108 → **110**): uno **funzionale** (lancia il gate in una cartella
  non-progetto e pretende uscita != 0 e output non muto — copre tutta la classe «l'epilogo non parte», ma
  su Node 24 non vede *questo* difetto) e uno **statico** (il sorgente non contiene `import.meta.main` —
  l'unico dei due che lo impedisce su qualunque Node). Pacchetto P.0-igiene.

- **2026-08-06 — semgrep sugli script, la prima volta: 4 rilievi, 0 veri (P.7c punto 3).**
  Configurazione dichiarata: `semgrep scan --config auto` (1.172.0, il profilo della casa —
  `references/motore-deterministico.md` di code-maniac), **200 regole su 5 file, 100% di righe
  analizzate**. Esiti: **due `detect-child-process`** (`verify.mjs`:109 e :115, ERROR) → **falsi
  positivi provati**: nessuno dei due passa da `shell: true` — la scelta e' scritta e motivata nel
  commento sopra `dove` (CVE-2024-27980, «prezzo gia' pagato da Schema Forge») — e gli argomenti
  viaggiano come vettore. **Due `detect-non-literal-regexp`**: `gate-lib.mjs`:376, dove il nome
  interpolato ha appena passato `/^[A-Za-z_$][\w$]*$/` **tre righe sopra** (nessun metacarattere
  possibile), e `gate-lib.mjs`:550, dove `valoreToml` riceve tre chiavi letterali (`port`,
  `site_url`, `schemas`). Nessuna correzione, nessun `nosemgrep`: quattro rilievi **dichiarati**.
  Nessuno script toccato, quindi **batteria non ripetuta** (nulla da misurare prima e dopo).

- **2026-08-06 — `/code-inquisition` sugli script, la prima volta, e il punto aperto n°7 ha una risposta: il difetto piu' grave e' qui (P.7c punto 4).** Referto con le uscite incollate: `../../INQUISIZIONE-GATE-2026-08-06.md`. Sette esperti, due verificatori che hanno rifatto le misure. Lo stesso giorno: ESLint 0, semgrep 4 (0 veri), gitleaks 0, batteria **111/111**.
  - **CRITICAL — un flusso critico dichiarato puo' non essere mai eseguito, e il gate resta VERDE 7/7.** `batteriaHaEseguito` (`gate-lib.mjs:503-504`) e' un **OR globale**: `esito.passati > 0` per **tutta** la batteria. Caso costruito con le funzioni pure: 13 flussi, 13 spec con `test.skip` **motivato** piu' un test banale che passa → **tutti e sette i passi `pass`**, dettaglio `1 passati, 0 falliti, 13 saltati`. `spec-coverage` misura i tag `@flusso:` nel **testo del file**, mai l'esito. E' la stessa classe che lo STATO dichiara chiusa dal collaudo P2 — chiusa per il 100% dei test saltati, **aperta per il 92%**. Smentita tentata e fallita: non esiste nessun passo che confronti i flussi *eseguiti* con quelli *dichiarati*. Aggravante: **speed-demon legge solo `esito.ok`**, quindi il falso verde si propaga muto al gate a valle. Seconda via, piu' silenziosa: `testIgnore`/`grep` in `playwright.config.ts`, di cui il gate legge **solo** `retries` (l'esclusione totale cade in `skipped`; quella parziale no).
  - **CRITICAL (condiviso) — `which`/`where` cercano anche nella directory corrente**, che e' il progetto auditato (`verify.mjs:102`): un `npx.cmd` o un `psql.exe` piantato nella radice del progetto vince sul PATH (misurato).
  - **MEDIUM — ReDoS vero su `IMPORT_HELPER_DB`** (`gate-lib.mjs:354`), e il costo si paga **una volta per flusso** (`:389`): 500 → 218 ms · 1000 → 262 ms · 2000 → 2 049 ms · **4000 → 19 552 ms**. Bastano 8 000 caratteri di spazio bianco in una spec del progetto. Un gate che non risponde non e' ne' verde ne' rosso.
  - **MEDIUM — nessun timeout su psql e su `npx playwright test`**: l'unico limite dei quattro gate della pipeline e' il `AbortSignal.timeout(15_000)` di `verify.mjs:297` — ed e' proprio quello che fa uscire questo gate **ROSSO e leggibile in 15,2 s** dove speed-demon resta appeso 45 secondi in silenzio. La lezione e' che il pattern giusto e' gia' in casa, in questo file.
  - **LOW — `motivato()` legge `//` senza distinguere una stringa da un commento**: un `.skip` il cui titolo contiene `https://…//home` risulta motivato → nessun rilievo.
  - **LOW — ricorsione sull'albero del report Playwright** (`gate-lib.mjs:453`): profondita' 20 000 → `RangeError` non catturato, il processo muore senza JSON. La docstring della funzione dichiara l'opposto («un report malformato deve portare a MANCANTE, mai a un'eccezione»).
  - **LOW — il passo `playwright` non consulta mai `res.status`** del runner: difetto reale ma **inerte** (ogni suo esito e' gia' intercettato da `res.error` e dal parse del report).
  - **LOW — `righeDaPsql` di questa skill e' tornato ai delimitatori di default di psql**: innocuo oggi (query a colonna singola), pericoloso al primo riuso — e' la classe che schema-forge ha gia' pagato.
  - **LOW — commento TOML nell'array multi-riga**: `senzaVirgolette` toglie la cella col `#`, non la coda del commento dopo la virgola → uno schema fantasma nella riga stampata.
  - **LOW — `references/playwright.md` non dichiara nessun `timeout`** (grep: zero occorrenze), ed e' il limite su cui il gate fa affidamento.

  **Sorte**: tutti **dichiarati**, nessuno chiuso qui — ognuno vuole un test che lo falsifichi e il gate rilanciato contro un'app viva, che questa chat non ha (D17).
- **2026-08-06 — `gitleaks` installato e puntato: il MANCANTE storico e' chiuso (P.7c punto 5).**
  `gitleaks` 8.30.1 (scoop, bucket `main`). Su questi `scripts/`: **nessun rilievo**. Sul repo
  intero: **storia** (`gitleaks git .`, 143 commit) **4 rilievi, 0 veri**; **disco**
  (`gitleaks dir .`, 179,72 MB) **26 rilievi, 0 veri** — tre su file tracciati, tutti e tre
  **fixture di rilevatori di segreti**, gli altri in artefatti non tracciati dei banchi
  (`.next/`, `.env.local`) con la chiave demo locale di Supabase (`iss: supabase-demo`).
  Nota per chi usera' lo strumento: `gitleaks git` trova il segreto **dove e' stato
  introdotto**, non dove il file sta oggi (una rinomina senza modifiche non lascia diff da
  leggere); `dir` guarda il disco. Le due modalita' non si sostituiscono a vicenda.

## Piano di costruzione (deciso in P0)

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione SKILL.md | qui | fatta, confermata dall'umano il 2026-07-28 |
| P1 | references, scripts (gate + lib pura + test), banco minimo usa e getta, sabotaggio provato | branch `agente/flow-sentinel` | **fatta il 2026-07-28** |
| P2 | collaudo avversario indipendente su dominio diverso: caccia ai falsi verdi del gate | chat dedicata, vergine | **fatta il 2026-07-28** — 10 difetti, `COLLAUDO-2026-07-28.md` |
| P3 | primo consumatore reale: batteria su Bottega Nord (`banco-prova-negozio`), dopo l'handoff di gestionale-crafter | chat dedicata | **fatta il 2026-07-30** — 15/15 verde, gate 7/7, 2 difetti veri, `COLLAUDO-P3-2026-07-30.md` |

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 7 | `verify.mjs --json`, `summary.passi` |
| Test degli script | **111 verdi** (79 dopo P1, +24 in P2, +3 in P3 su `ambienteBatteria`, +2 col collaudo di `evolve`, +2 con P.0-igiene il 2026-08-03, +1 col test junction di P.0-igiene-2 il 2026-08-04) | `node --test "scripts/**/*.test.mjs"` |
| References | 4 | `references/`, 1288 righe dopo P1, corrette in tre punti da P2 |
| Template | 3 | `flussi-critici.md`, `handoff-flow-sentinel.md`, `eslint-spec.config.mjs` |
| Banchi su cui il gate e' girato | **3**, di tre domini — e il terzo scritto da **altri agenti** | `banco-prova-flow/` (5 flussi, 5 spec) · `banco-prova-collaudo-fs/` (6 flussi, 6 spec) · **`banco-prova-negozio/` (11 flussi, 11 spec, 16 test, gate 7/7)**. Nessuno dei tre e' piu' su disco: i primi due erano usa e getta, il terzo e' stato cancellato il 2026-07-30 (`../../DECISIONI.md` §25) e torna con `git checkout 67f9001 -- banco-prova-negozio` |
| Difetti piantati e rilevati | 5 su 5 (P1) + 3 su 3 (P2, classi nuove) | `COSTRUZIONE` §3.2 · `COLLAUDO` §4 |
| Premesse tolte e riconosciute mancanti | 3 su 3 | `COSTRUZIONE-2026-07-28.md` §MANCANTE |
| Forme ostili provate sulle regole pure | 79, con input della forma vera | `COLLAUDO-2026-07-28.md` §6 |
| Difetti del gate trovati dal collaudo | **10** (7 falsi verdi, 3 crash o rossi sbagliati) | `COLLAUDO-2026-07-28.md` §3 |

## Tre falsi verdi trovati costruendo, e chiusi

Nessuno dei tre veniva dal compito: due sono usciti facendo girare il gate per davvero, il terzo
dalla verifica avversaria delle references — cercando di smentire una frase, non di leggere il codice.

1. **Un contratto non firmato passava per firmato.** `RIGA_CONFERMA` usava `\s` fra i due punti e la
   firma, e `\s` comprende l'a capo: una riga `Confermato da:` **vuota** catturava la prima riga non
   vuota che seguiva — l'intestazione del primo flusso — e il passo usciva **verde**. E' il falso verde
   peggiore, perche' sta esattamente sul passo che esiste per impedirlo. Riprodotto, chiuso ammettendo i
   soli spazi orizzontali, due test di regressione. Stessa correzione sulla riga `Gate:`.
   **Vale anche per Schema Forge**, che ha la stessa forma di regex: vedi le proposte del verbale.
2. **Lo shim che Windows non sa eseguire.** `where npx` elenca per primo lo script di shell **senza
   estensione** (quello per Git Bash); `spawnSync` non lo esegue, e il passo `playwright` diceva «report
   JSON non interpretabile» su una macchina dove `npx playwright test` funziona. Il guasto andava nella
   direzione sicura (MANCANTE, mai un falso verde), la diagnosi no: incolpava Playwright. Chiuso con
   `primoEseguibile()`, che sceglie la riga con estensione eseguibile, piu' un esito distinto per
   l'errore di esecuzione.
3. **`effetto-db` verificava l'import e non la chiamata.** Il ritaglio della clausola di import partiva
   dal **primo** `import` del file, quindi in una spec vera — che comincia sempre con
   `import { test, expect } from "@playwright/test";` — i nomi raccolti erano `test`, `expect`,
   `import`, `contaProdotti`, e un `expect(...)` qualsiasi passava per una chiamata all'helper del
   database. Bastava importare l'helper e non usarlo mai per avere il verde, **sul passo che esiste
   apposta per pretendere la chiamata**. Sul banco non si vedeva: le cinque spec l'helper lo chiamano.
   Chiuso vietando `;` e virgolette dentro la clausola, con due test nuovi che usano la forma **vera**
   di una spec. La lezione: i test della regola usavano frammenti con un solo import, cioe' una forma
   che nella realta' non esiste — un test che non somiglia all'input vero prova la fixture, non la
   regola.

## Cosa un gate verde NON prova

Questa sezione esiste perche' la sua assenza e' il modo in cui un verde diventa una firma in bianco.

- **Che l'elenco dei flussi sia completo.** Il gate verifica che ogni flusso *dichiarato* sia attaccato,
  non che sia stato dichiarato tutto quello che conta. Un checkout dimenticato allo Specchio resta
  invisibile a tutti e sette i passi. La difesa e' la conferma umana, e non e' automatizzabile.
- **Che l'asserzione di effetto sia quella giusta.** `effetto-db` guarda la **forma**: che la spec
  importi e chiami `e2e/helpers/db`. Una chiamata che legge la tabella sbagliata copre la casella.
  Stessa onesta' che Schema Forge scrive sul suo audit RLS.
- **Che i flussi ostili in lettura siano davvero rifiutati.** Su `ostile-lettura` il gate non pretende
  nessuna asserzione sul database — non c'e' stato da confrontare — quindi una spec che asserisce solo
  l'URL e non l'assenza del contenuto riservato passa. Lo trova il sabotaggio di classe C, non il gate.
  E non basta guardare il DOM: se il rifiuto lo decide il browser, l'HTML riservato e' gia' stato
  servito e ogni `getByText` lo trova pulito. Si asserisce sul **corpo della risposta** — misurato in
  P2, `COLLAUDO-2026-07-28.md` §4.1.
- **Che il seed contenga i dati giusti.** `app-viva` conta tabelle e righe: sa che il database non e'
  vuoto, non sa che dentro ci sia quello che serve ai flussi.
- **Che la batteria trovi i difetti.** Lo dimostra il sabotaggio, e il sabotaggio si esegue al collaudo,
  a mano, non a ogni giro (`references/sabotaggio.md`).
- **Niente sulla sicurezza oltre i flussi dichiarati.** Le porte che nessuno ha dichiarato le cerca
  Cyber Shield: qui si prova che quelle dichiarate restano chiuse.

## Cosa ha trovato il collaudo indipendente (P2)

Dieci difetti, tutti riprodotti prima di essere corretti. I quattro che contano:

1. **Una batteria in cui ogni test e' saltato usciva VERDE 7/7**, con `ok: true`: le spec si contavano
   come **file**, mai come esecuzioni. Bastavano sei `test.skip` con la motivazione accanto — cioe' la
   forma legittima, quella che `lint-spec` non segnala nemmeno — per avere un gate verde su zero flussi
   percorsi. Era l'ultimo punto in cui «uno strumento che esce 0 senza aver letto» era rimasto aperto.
2. **Un handoff che dichiarava `Gate: VERDE` su un gate ROSSO passava**, se piu' sopra citava in un
   blocco recintato il rosso dell'esecuzione precedente — cioe' esattamente cio' che
   `references/sabotaggio.md` prescrive di incollare li' dentro.
3. **Un contratto firmato da `{{UMANO | ORCHESTRATORE}}`** — il template compilato a meta' — o da un
   asterisco del grassetto passava per firmato.
4. **La spec ostile guardava il DOM dopo il redirect.** Col controllo di ruolo spostato nel browser,
   l'area riservata veniva servita per intero al socio e la batteria restava verde 6 su 6: ogni
   `getByText(...).toHaveCount(0)` girava sulla pagina lecita. Ora si asserisce sul corpo della
   risposta di navigazione, che un redirect del client non puo' riscrivere.

Gli altri sei: `retries` letto in un commento o ignorato dentro `projects`, `test.fixme` invisibile,
l'asserzione commentata via che contava come asserzione, gli schemi esposti multiriga che sparivano in
silenzio, tre crash su report malformati, e tre rossi sbagliati su codice commentato.

## Punti aperti — ordinati per gravita'

> **CHIUSO il 2026-08-04 (P.0-igiene-2) — il gate parla anche dalla junction.**
> Era: invocato come `.claude/skills/flow-sentinel/scripts/verify.mjs` il gate
> usciva **0 senza stampare una riga**, mentre per percorso reale usciva 2 col
> messaggio (misura di P.4-pre, `../../PILOTA-PRE-2026-08-04.md` §2b). Causa:
> `resolve(process.argv[1])` normalizza il percorso ma non scioglie una junction,
> mentre `import.meta.url` è già canonico — guardia falsa, `main()` mai chiamata.
> Ora l'epilogo confronta **due volte** (testuale e `realpathSync`, con ricaduta
> sul testuale se `realpathSync` solleva), ed è la forma che l'`hint` della regola
> `epiloghi-vivi` prescrive da oggi. Commit `257e34d` (guardia), `e6deb39`
> (`hint`), `c96ae00` (test).
>
> **Misura del 2026-08-04**, node di sistema 20.12.2, cartella vuota fuori
> dall'albero: **entrambi i canali escono 2** con lo stesso messaggio, carattere
> per carattere — `Ne' docs/ ne' e2e/ in <cwd>: non c'e' batteria da verificare
> (lancia il gate dalla radice del progetto).` Uscite incollate in
> `../../IGIENE2-JUNCTION-2026-08-04.md` §1. **Cade il vincolo provvisorio di
> D12**: i gate si lanciano da **entrambi** i canali, junction compresa — che è
> come li vede una chat aperta sul repo di un progetto generato.
>
> Ricaduta che riguardava questa skill in proprio: speed-demon lancia questo gate
> come sottoprocesso per il suo passo `rete-verde`, e da un gate muto ricavava
> «non ha prodotto JSON leggibile», cioè una verifica MANCANTE per colpa d'altri.
> Misurato oggi sulla stessa cartella dai due canali: `GATE FLUSSI: ROSSO (1
> falliti, 6 verifiche mancanti su 7 passi)`, identico (verbale §5).
>
> Regressione piantata: un terzo test invoca il gate **attraverso una junction
> vera** e pretende uscita ≠ 0 e output non vuoto; statico e funzionale sono
> ciechi a questo difetto, provato col sabotaggio (verbale §4).

> **Quattro punti chiusi da P3** il 2026-07-30 — il consumatore reale (era il n°1), `lint-spec`
> senza dipendenze (n°3, chiuso operativamente: resta da scrivere il README), `psql` nel PATH (n°4,
> c'e' e il passo interroga il database davvero) e l'URL preso da `[auth].site_url` (n°5, che non e'
> piu' un timore: e' stato **misurato** come falso verde e **corretto**). Dettaglio in
> `COLLAUDO-P3-2026-07-30.md` §6.

1. ~~**`evolve` non e' mai stato collaudato.**~~ — **chiuso il 2026-07-30**,
   `COLLAUDO-EVOLVE-2026-07-30.md`. Cinque casi guidati sui file veri di Bottega Nord contro le
   funzioni vere del gate: **5 su 5 combaciano** con la reference, e il caso del `warn` e' stato
   rifatto sul processo intero (uscita **0**, gate VERDE, avviso stampato). Il gate e' l'unica
   parte che ha retto senza correzioni. **Resta aperto cio' che il collaudo ha scoperto:** un
   flusso che cambia nel **corpo** mantenendo lo stesso id il gate **non lo vede** — legge le
   intestazioni, non i passi — ed e' il caso piu' frequente nella vita di un progetto, perche'
   gli altri tre lasciano una traccia strutturale e questo no. Non e' correggibile senza
   reinventare la comprensione del testo: e' fissato da un test di regressione che dichiara il
   limite, e nella procedura la difesa e' l'agente. Manca anche l'esecuzione del **controllo
   della data** di `Confermato da:`: ora e' nella procedura, ma nessuno script lo fa.
2. **Il gate puo' ancora dire `app-viva` verde su un'app estranea, quando la batteria non esiste.**
   P3 ha chiuso la classe dove conta: `verify.mjs` **impone** ora alla batteria l'URL che ha appena
   interrogato (`ambienteBatteria`), quindi un'app sbagliata produce una batteria rossa invece di un
   verde silenzioso. Ma su un progetto senza spec il passo vede ancora solo «qualcuno risponde a
   quell'indirizzo». Difesa residua: l'URL stampato sempre, anche sul verde.
3. **La reference prescrive una rotta di accesso che non esiste.** `references/playwright.md` scrive
   `goto("/accesso")`; il progetto reale ha `/accedi`. Non ha fatto danni — la spec la scrive chi
   guarda l'app — ma e' una forma inventata dentro un documento che altrove e' preciso al carattere.
4. **La reference non dice cosa fare quando gli utenti di prova sono dati di dominio.** Prescrive che
   li crei il global-setup con l'admin API e «MAI il seed». Su Bottega Nord sono righe di `staff`
   legate a `auth_user_id` scritti nel seed: ricrearli li duplicherebbe, e «riallinearli» con
   `updateUserById` avrebbe **riparato in silenzio** il difetto bloccante che P3 ha trovato — cioe' la
   batteria avrebbe aggiustato la premessa che doveva misurare. La deroga e' stata dichiarata nel
   banco; la reference tace.
6. **Nessuna regola statica sui flussi `ostile-lettura`.** Vedi sopra: e' una scelta dichiarata (non
   c'e' stato da confrontare), non una dimenticanza, ma resta un buco che solo la prosa difende.
7. **`code-inquisition` non e' mai stato lanciato sugli script di questa skill.** La Regola dei
   guardiani lo chiede sui punti critici; qui il punto critico e' la chiave amministrativa negli helper
   del progetto generato, e su quello il gate non ha nessun controllo automatico — solo la prosa di
   `references/playwright.md`. **`semgrep` e `gitleaks` sono stati puntati su questi script il
   2026-08-06** (semgrep 1.172.0 `--config auto`: **4 rilievi, 0 veri**, tutti dichiarati con la
   prova a fianco; gitleaks 8.30.1: **nessun rilievo** — §2026-08-06). **`code-inquisition` e' stato
   eseguito il 2026-08-06** e ha risposto alla domanda che questo punto poneva: la parte che pesa non
   era la chiave amministrativa negli helper — era che **un flusso critico dichiarato puo' non essere
   mai eseguito col gate VERDE 7/7** (CRITICAL, §2026-08-06). Il punto resta aperto per quel difetto,
   non piu' per la verifica mancante.
8. **Il gate non ha nessun passo che usi la chiave di servizio.** *(Numero in coda per non
   spostare le citazioni degli altri punti; per gravita' starebbe subito dopo il n°2.)*
   Il 2026-07-30, sul banco
   di P3, `service_role` ha perso `select/insert/update/delete` su tutte le tabelle perche' era
   cambiata la versione della CLI Supabase — e i **tre** gate della pipeline sono rimasti verdi,
   perche' nessuno dei tre usa quella chiave: schema-forge gira come `postgres` o con
   `set role`, gestionale-crafter legge il codice, e `app-viva` di questa skill chiede solo un
   HTTP sotto il 500. Rossa e' diventata la **batteria**, che con quella chiave misura l'effetto
   dei flussi. E' un buon esito — il rosso e' arrivato — ma dipende dal fatto che il progetto
   abbia una batteria: su un progetto senza spec la stessa rottura sarebbe invisibile a tutti e
   tre i gate. Un passo che interroghi PostgREST **con la chiave di servizio** chiuderebbe la
   classe, e costa una `curl`.
9. **Nessuno dei tre banchi e' su disco, e le prove stanno nei verbali.** I due di P1 e P2 erano usa e
   getta e gitignorati; `banco-prova-negozio` — l'unico consumatore reale che questa skill abbia mai
   avuto — e' stato tracciato dal 2026-07-28 e **cancellato dal disco il 2026-07-30** (`../../DECISIONI.md`
   §25): i suoi sorgenti sono nel commit `67f9001`, ma le chiavi che la batteria legge (`.env.e2e.local`,
   `e2e/.auth/`) erano gitignorate di proposito, quindi rilanciarla non e' un `git checkout` — e' `npm
   install`, `supabase start` e ricreare le chiavi. Lo stesso lavoro di prima, adesso dichiarato invece
   che presunto. **Nessun banco vivo significa che «batteria 16/16, gate 7/7» oggi non e' verificabile in
   un comando**: e' un'affermazione datata in `COLLAUDO-P3-2026-07-30.md`, non un fatto che si rilancia.

---

## Dal primo consumatore reale della pipeline completa — pilota `fornodoro`, P.4d (2026-08-05)

Quarto anello di una catena vera (`07 → 08 → 10 → 12`), su un'app di produzione viva e un database
seminato: 13 flussi, 22 test, gate **VERDE 7/7**. Verbale: `PILOTA-2026-08-05.md`.
Quattro difetti della **skill**, non del progetto. Sono righe, non correzioni: decide chi possiede la skill.

10. **`references/playwright.md` §L'helper di effetto DB prescrive una forma che non parte sul node
    dei gate.** L'esempio costruisce l'helper con `createClient` di `@supabase/supabase-js`. Su
    Node 20.12.2 — il node di sistema, cioe' quello con cui il `CLAUDE.md` della regia prescrive di
    lanciare i gate, e quello con cui `verify.mjs` lancia `npx playwright test` — `createClient`
    **muore in costruzione**: `Error: Node.js detected but native WebSocket not found`, perche'
    inizializza il client realtime anche quando nessuno lo usa. Misurato il 2026-08-05. Nel pilota la
    deroga e' stata scritta (PostgREST e GoTrue in HTTP diretto, con il perche' dentro il file), e ha
    avuto un effetto collaterale buono: sulle spec ostili l'attacco si scrive nella forma esatta in
    cui lo farebbe chi apre i DevTools. **La reference dovrebbe mostrare quella forma**, o almeno
    dichiarare che l'esempio pretende Node 22+.

11. **`references/sabotaggio.md` §Il ripristino prescrive un controllo che non puo' vedere il
    residuo che il sabotaggio stesso produce.** Il passo 3 dice «`git status` pulito sui file
    dell'applicazione e delle spec». Su una macchina con `core.autocrlf=true` — il default di Git per
    Windows — `git restore` rimette il contenuto e **scrive CRLF**, e Prettier (`endOfLine: "lf"`)
    segnala quei file. Git normalizza i fine-riga nel confronto con l'indice, quindi `git status`
    resta **vuoto** mentre `code-maniac scan` diventa giallo su cinque file che nessuno ha
    modificato. Misurato il 2026-08-05 dopo cinque classi di sabotaggio. Rimedio: aggiungere
    `npx prettier --check` accanto a `git status` nel passo 3, oppure far nascere i progetti generati
    con `core.autocrlf input`.

12. **Il gate non ha nessun modo di accorgersi che la batteria sporca il database — e la skill non
    chiede a `forge` di generarne uno.** Le asserzioni di conteggio che la reference insegna
    (`contaProdotti()` prima, `contaProdotti()` dopo) sono tutte **relative**: una riga orfana non fa
    diventare rossa nessuna spec, e si scopre solo al giro dopo sotto forma di un rosso che parla
    d'altro. Nel pilota l'ha trovato il **tribunale**, non il gate, e la chiusura e' stata un
    `e2e/global-teardown.ts` che confronta i totali con quelli del seed e solleva — collaudato
    piantando un ordine a mano: **22 test passati e gate rosso lo stesso**. Quel file dovrebbe stare
    nel contratto d'uscita di `forge` accanto a `global-setup`, non essere inventato da chi lo scopre.
    E il passo `contratto-uscita` potrebbe pretenderlo, come gia' pretende `retries: 1`.

13. **Il motivo «la firma e' nostra» resta aperto, e adesso ha un precedente.** Su `fornodoro` il
    contratto dei flussi porta `Confermato da: Direzione lavori (per delega del committente Alberto
    Marocco) il 2026-08-05` — firma per delega dichiarata (D14 della regia), scritta in tre posti
    perche' non la si scambi per una vera. Il gate la legge e la ristampa, e **non puo' distinguerla
    da una firma vera**: e' una scelta dichiarata di `flussi-critici` («il gate legge la riga, non la
    sua verita'»), ma con l'autonomia della catena diventa la condizione normale, non l'eccezione.
    Vale la pena decidere se il passo debba **riconoscere** la forma «per delega» e stamparla come
    residuo invece che come conferma.

### La lezione che vale oltre questa skill

Il collaudo per sabotaggio ha detto che la batteria **sapeva fallire** su cinque classi piantate; il
tribunale ha trovato **nove asserzioni che non potevano fallire** su difetti che nessuno aveva
pensato di piantare — e sette avevano la stessa forma: **il contratto prometteva piu' di quanto la
spec asserisse**. E' il caso 4 di `evolve`, che la `SKILL.md` dichiara invisibile al gate («e' l'unico
dei quattro casi in cui la difesa sono io»). Su `fornodoro` la difesa **non** e' stato l'agente: un
anello che scrive sia il contratto sia le spec non puo' essere il proprio revisore — le sue due meta'
si confermano a vicenda per costruzione. Le due verifiche non si sostituiscono, e la Regola dei
guardiani fa bene a chiederle entrambe.
