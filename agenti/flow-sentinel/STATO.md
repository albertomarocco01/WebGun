# STATO — flow-sentinel

**A che punto è:** collaudata in modo avversario e usata sul pilota della catena completa (`cavia`);
**mai su un progetto di un cliente vero**, e i flussi critici non li ha mai confermati un committente.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria delle regole pure **171/171 verde**, knip 0, jscpd 0 cloni,
**ESLint 1 errore** (regressione nuova, in §Debito); gate rilanciato dalla direzione sul pilota con app
viva e database seedato: **VERDE 7/7, 22 test su 13 file di spec**.

## Cosa fa

Genera ed esegue la batteria End-to-End (Playwright + TypeScript) sui flussi critici di un sito Web Gun
— carrello, checkout, login, area riservata — a costruzione finita, prima di speed-demon e launchpad.
**Non corregge l'app**: il difetto va nell'handoff e in `docs/DEBITO-TECNICO.md`, il fix è dei
costruttori. Comandi: `map`, `forge`, `run`, `verify`, `evolve`, `handoff`. Le tre leggi:

1. **Il flusso prima del test (Specchio dei flussi).** I flussi, positivi e ostili, si propongono e ci
   si ferma finché non arriva la conferma; `docs/flussi-critici.md` è il contratto. Una batteria
   perfetta sui flussi sbagliati è comunque da buttare.
2. **Il browser è il giudice, non l'LLM.** Un test vale se è girato davvero, contro app viva e database
   reale seedato. Premessa mancante = **MANCANTE**, mai verde.
3. **Un test che non può fallire non è un test.** Il positivo asserisce l'effetto sul **database**, non
   la pagina; l'ostile asserisce il **rifiuto**. Al collaudo si prova col **sabotaggio**: app rotta in
   un punto noto, batteria che deve diventare rossa.

## Il gate

**Sette passi**, id stabili, `--json` col contratto comune agli altri gate della pipeline.

| passo | cosa prova |
|---|---|
| `flussi-critici` | il contratto esiste, ha la riga `Confermato da:` firmata, ogni flusso ha id stabile e tipo |
| `spec-coverage` | ogni flusso dichiarato ha una spec col tag `@flusso:<id>`; le spec orfane si segnalano |
| `lint-spec` | ESLint sulle spec: `.only` committato = block, skip non motivato = issue |
| `effetto-db` | ogni spec positiva importa **e chiama** `e2e/helpers/db`; ogni ostile asserisce il rifiuto |
| `app-viva` | l'app risponde all'URL dichiarato, il database risponde sulla sua porta, seed applicato |
| `playwright` | esegue la batteria e conta i **flussi percorsi** dal titolo dei test eseguiti, non i tag nei file |
| `contratto-uscita` | handoff scritto, senza segnaposto a metà, riga `Gate:` coerente coi sei passi sopra |

Si lancia **dalla radice del progetto generato**:

```
node C:/Users/Utente/Desktop/WebGun/agenti/flow-sentinel/scripts/verify.mjs [--url <url>] [--db-url <url>] [--json]
```

Uscite: `0` verde · `1` rosso · `2` errore di esecuzione. Uno `skipped` è una **verifica mancante**, non
una superata: il gate resta rosso.

- **Senza `--url`/`--db-url` l'ambiente non viene mai consultato**: app e database escono da
  `supabase/config.toml` (`[auth].site_url`, `[db].port`) — una `SUPABASE_DB_URL` accesa da un altro
  progetto è il modo in cui il difetto nasce. Ma `site_url` è una riga di un documento e può mentire:
  sul pilota diceva `:3000` mentre l'app viveva sulla `:3621`. Lì il passo è uscito MANCANTE dicendolo;
  con un altro progetto acceso sulla 3000 avrebbe misurato l'app di uno sconosciuto chiamandola verde.
- **Prerequisiti**, ognuno assente vale MANCANTE: `@playwright/test` installato nel progetto, `psql` nel
  PATH, ESLint nella cartella della skill.
- **Limiti di tempo**: 30 min su `npx playwright test`, `timeout` + `PGCONNECT_TIMEOUT` su psql,
  `AbortSignal.timeout(15_000)` sulle sonde HTTP. Un gate che non risponde non è né verde né rosso.
- Gira col **node di sistema** (20.12.2) e da **entrambi i canali**, percorso reale e junction
  `.claude/skills/…`. `npx playwright test` eredita il node del **PATH**, non l'interprete del gate.

## Come si prova

1. **Batteria delle regole pure** (le regole stanno in `scripts/gate-lib.mjs`, il guscio di I/O in
   `verify.mjs`), da `agenti/flow-sentinel`:

   ```
   npm test
   # se npm non è nel PATH:
   "/c/Program Files/nodejs/node.exe" "/c/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" test
   ```

   **171 test, 171 verdi**, misurato il 2026-08-07. Il vecchio STATO diceva 158 in un punto e 131 in un
   altro: fotografie di pacchetti intermedi.

2. **Guardiani**: `npx eslint .` · `npx knip` · `npx jscpd scripts/`. Oggi **1 errore** ESLint (vedi
   Debito), 0 knip, 0 cloni.

3. **Il gate contro un'app vera.** La skill non ha un banco proprio: il consumatore vivo è il pilota
   `cavia` in `C:/Users/Utente/Desktop/cavia` (13 flussi, 13 spec, 22 test). Da quella radice, con
   `supabase start` + `supabase db reset` prima e **un solo stack Supabase acceso** (tre insieme
   saturano una macchina da 16 GB):

   ```
   node C:/Users/Utente/Desktop/WebGun/agenti/flow-sentinel/scripts/verify.mjs --url http://127.0.0.1:3621
   ```

   Il banco del primo consumatore reale torna con `git checkout 67f9001 -- banco-prova-negozio`, ma il
   checkout non basta: vuole `npm install`, `supabase start` e la ricreazione di `.env.e2e.local` ed
   `e2e/.auth/`, gitignorati di proposito.

4. **Sabotaggio**: `references/sabotaggio.md`, a mano al collaudo, non a ogni giro. È l'unica cosa che
   prova che la batteria sappia diventare rossa.

## Cosa NON è mai stato provato

Questa sezione esiste perché la sua assenza è il modo in cui un verde diventa una firma in bianco.

- **Un cliente vero.** I flussi li propone l'agente e li conferma l'orchestratore o la direzione lavori
  **per delega dichiarata**. Il gate legge la riga `Confermato da:`, **non la sua verità**.
- **Che l'elenco dei flussi sia completo.** Il gate verifica che ogni flusso *dichiarato* sia attaccato,
  non che sia stato dichiarato tutto ciò che conta: un checkout dimenticato allo Specchio resta
  invisibile a tutti e sette i passi. La difesa è la conferma umana, e non è automatizzabile.
- **Che l'asserzione di effetto sia quella giusta.** `effetto-db` guarda la **forma** — che la spec
  importi e chiami `e2e/helpers/db`. Una chiamata che legge la tabella sbagliata copre la casella.
- **Che i flussi ostili in lettura siano rifiutati davvero.** Lì il gate non pretende asserzioni sul
  database (non c'è stato da confrontare), quindi una spec che asserisce solo l'URL passa. E il DOM non
  basta: se il rifiuto lo decide il browser, l'HTML riservato è già stato servito e ogni `getByText` lo
  trova pulito. Si asserisce sul **corpo della risposta** di navigazione, che un redirect del client non
  può riscrivere (misurato al collaudo indipendente).
- **Che il seed contenga i dati giusti.** `app-viva` conta tabelle e righe: sa che il database non è
  vuoto, non che dentro ci sia quello che serve ai flussi.
- **Che la batteria trovi i difetti.** Lo dimostra solo il sabotaggio, che non gira a ogni giro.
- **Che un flusso CAMBIATO nel corpo venga visto.** Stesso id, passi o effetto diversi: il gate **non lo
  vede — misurato**, legge le intestazioni e non i passi, e resta verde su un contratto che descrive un
  percorso che la spec non fa più. È il caso più frequente nella vita di un progetto: gli altri tre di
  `evolve` lasciano una traccia strutturale, questo no. Non è correggibile senza reinventare la
  comprensione del testo — c'è un test che dichiara il limite, e la difesa è l'agente.
- **Che la data di `Confermato da:` sia più recente dell'ultimo cambio di rotte.** È nella procedura di
  `evolve`; **nessuno script la esegue**.
- **Che l'app misurata sia quella giusta, quando la batteria non esiste.** Con le spec la classe è chiusa
  (`ambienteBatteria` impone alla batteria l'URL appena interrogato: un'app sbagliata dà una batteria
  rossa invece di un verde muto); senza spec il passo vede solo «qualcuno risponde lì».
- **Che la batteria non sporchi il database.** Le asserzioni di conteggio che la reference insegna sono
  **relative**: una riga orfana non fa rossa nessuna spec e si scopre al giro dopo, come un rosso che
  parla d'altro. Sul pilota l'ha trovato il tribunale, non il gate; la rete che lo chiude sta fuori
  dalle spec e **non è nel contratto di `forge`** (§Le asserzioni che non potevano fallire, §Debito).
- **Che il sito serva quello che il database contiene.** Una spec che ripristina solo il **dato** lascia
  la pagina in cache ISR a servire il testo di prova: sul pilota `/chi-siamo` ha servito «Prova E2E» per
  cinque minuti, e a trovarlo è stato il gate della **vetrina**. Rimettere a posto il dato non è
  rimettere a posto ciò che dipende dal dato: il ripristino passa dalla stessa porta del cambiamento.
- **Che la chiave `service_role` funzioni.** Nessun passo la usa. Il 2026-07-30 ha perso
  `select/insert/update/delete` su tutte le tabelle perché la CLI Supabase era passata da 2.95.4 a
  2.110.0 cambiando `alter default privileges` — **un progetto fermo si è rotto da solo** — e tre gate
  della pipeline sono rimasti verdi: rossa è diventata solo la batteria. Senza spec quella rottura
  sarebbe invisibile a tutti e tre.
- **Le stringhe dentro le spec.** Un `import … from './helpers/db'` dentro una stringa soddisfa la Terza
  Legge (verde falso); un `retries: 1` dentro un template multi-riga fa passare una configurazione che
  non lo dichiara; l'interno di un template si legge come codice — **limite dichiarato**, col suo test,
  nel verso rumoroso.
- **Niente sulla sicurezza oltre i flussi dichiarati.** Le porte che nessuno ha dichiarato le cerca
  cyber-shield: qui si prova solo che quelle dichiarate restino chiuse.

## Le asserzioni che non potevano fallire — le forme viste sul pilota

Un tribunale (`/code-inquisition`) puntato **sulla batteria e non sull'app** — perché il difetto di
classe di questo anello è *un test che non può fallire*, e se lo trova qualcuno più a valle è già
costato — ha restituito **21 rilievi: 9 corretti, 1 refutato con una misura**, il resto dichiarato.
`tsc` ed ESLint erano **puliti e non ne hanno visto nessuno**: stanno tutti nello strato di «cosa
dimostra questa asserzione», che nessun analizzatore guarda. E il gate li dichiarava tutti coperti,
perché `effetto-db` verifica **import e chiamata**, non la semantica. Le forme si ripetono, quindi
valgono più dei nove casi:

- **Asserzioni di conteggio relative** (`+1 riga`, `stato diverso da prima`): nessuna spec diventa
  rossa per una riga lasciata dietro. Si chiude **fuori** dalle spec — un `e2e/global-teardown.ts` che
  confronta i totali col seed e solleva — e si **collauda piantando un residuo a mano**: 22 test
  passati e gate ROSSO lo stesso. Una rete che nessuno ha visto scattare non è una rete.
- **L'ostile in scrittura che non ripulisce quando l'attacco RIESCE**, cioè il giorno in cui la difesa
  che sorveglia regredisce: l'unico giorno in cui la pulizia serve davvero. La peggiore sospendeva una
  titolare e **chiudeva fuori il `global-setup` del giro successivo** — la batteria si serra fuori da
  sola. Ogni ostile in scrittura vuole il suo `afterEach`, non un `afterEach` sul caso felice.
- **L'asserzione tautologica**: la riga che il commento annunciava come «senza prezzo» ricontrollava
  l'etichetta che un `expect.poll` due righe sopra aveva appena stabilito. Vera per costruzione.
- **Il DOM al posto della policy**: spostare il filtro dalla policy alla query avrebbe lasciato il DOM
  identico e la bozza leggibile con la chiave anonima. Un rifiuto si asserisce rileggendo la tabella
  **dal browser con la chiave anonima**, pretendendo zero righe.
- **Conteggi negati invece che contati**: «sei voci» ne asseriva due, «due sole voci» negava due nomi
  su cinque. Si contano e si nominano.
- **La pulizia armata dopo un'asserzione che può scadere**, mentre la riga era già scritta: la finestra
  fra le due lascia orfani. La variabile di pulizia si arma dall'URL, **prima** di ogni asserzione.
- **Il ripristino d'emergenza che scrive dritto nel database**, saltando la `revalidatePath` da cui
  passa il cambiamento vero — lo stesso difetto già trovato sulla via normale, riaperto sulla via
  d'emergenza. L'`afterEach` passa dalla UI; la scrittura diretta è l'ultima spiaggia.
- **La prosa del contratto che descrive un passo che la spec non percorre** («porta la cucina su una
  pagina viva», e nessun `goto`). Costa 300 ms rendere vera una riga firmata.

**Il rilievo refutato vale quanto i nove corretti, per come è caduto**: non discutendone, ma con una
build sabotata. Sosteneva che una spec provasse solo la guardia della *rotta* e non quella
dell'*azione*; togliendo davvero la guardia dall'azione la spec è diventata rossa. In App Router la
Server Action gira **prima** del re-render, quindi la sua uscita vince su quella della pagina — e sotto
la guardia dell'azione c'è comunque la policy, che risponde `42501`. Un'ipotesi su cosa dimostri una
spec si chiude con una build, non con un secondo parere.

**Sette dei nove hanno la stessa forma: il contratto prometteva più di quanto la spec asserisse** — il
caso di `evolve` che il gate dichiara invisibile. Chi scrive sia il contratto sia le spec **non può
essere il proprio revisore**: le due metà si confermano a vicenda per costruzione.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| **ESLint 1 errore**: `PAROLA_IMPORT` assegnata e mai usata (`gate-lib.mjs:468`), residuo della riscrittura di `clausoleHelperDb` | misurato oggi; fino a ieri si dichiarava «0 errori 0 warning». Una riga da togliere, ma tocca il gate e vuole la batteria rilanciata | chi tiene la skill |
| `righeDaPsql` è tornato ai delimitatori di default di psql: una cella con un a capo dà **tre righe invece di due** | innocuo oggi (query a colonna singola), pericoloso al primo riuso; neutralizzare i separatori in SQL vuole un Postgres vivo, e farlo alla cieca rende **silenzioso** un guasto oggi **rumoroso** | pacchetto con un banco |
| Lo spogliatore delle spec legge l'interno dei template multi-riga come codice | correzione incompleta: la configurazione va letta con le stringhe svuotate, la spec con le stringhe intatte — il percorso dell'helper dentro una stringa ci vive | chi tiene la skill |
| `references/playwright.md` prescrive `goto("/accesso")` | il progetto reale aveva `/accedi`: forma inventata in un documento altrove preciso al carattere | chi tiene la skill |
| La stessa reference costruisce l'helper DB con `createClient` di `@supabase/supabase-js` | su Node 20.12.2, il node dei gate, **muore in costruzione** (`native WebSocket not found`): il vincolo duro è di `@supabase/realtime-js` (>=22). La deroga — PostgREST e GoTrue in HTTP diretto — sta nel pilota e non nella reference, e fa scrivere l'attacco ostile nella forma esatta di chi apre i DevTools | chi tiene la skill |
| La stessa reference tace su cosa fare quando gli **utenti di prova sono dati di dominio** | prescrive «li crea il global-setup con l'admin API, MAI il seed»; sul banco erano righe di `staff` legate a `auth_user_id` del seed: ricrearli li duplica, riallinearli avrebbe **riparato in silenzio** il difetto che la batteria doveva misurare | chi tiene la skill |
| Il residuo di un sabotaggio può sopravvivere a un `git status` pulito | con `core.autocrlf=true` (default Git su Windows) `git restore` riscrive **CRLF**: `git status` resta vuoto e `code-maniac scan` ingiallisce su file che nessuno ha toccato. Il limite e il rimedio (`prettier --check` accanto a `git status`, o `core.autocrlf input` nei progetti generati) sono ora scritti in `references/sabotaggio.md` §Il ripristino: resta una procedura **a mano**, nessuno script la impone | chi tiene la skill |
| `e2e/global-teardown.ts` non è nel contratto d'uscita di `forge` | nel pilota l'ha inventato chi ha scoperto il difetto, collaudandolo con un ordine piantato a mano: **22 test passati e gate rosso lo stesso**. `contratto-uscita` potrebbe pretenderlo come già pretende `retries: 1` | chi tiene la skill |
| Nessun passo del gate usa la **chiave di servizio** | chiuderebbe la classe del 2026-07-30 e costa una `curl` a PostgREST | chi tiene la skill |
| Nessuna regola statica sui flussi `ostile-lettura` | scelta dichiarata, ma resta un buco che solo la prosa difende | chi tiene la skill |
| Il gate non distingue una firma **per delega** da una vera | scelta dichiarata; con l'autonomia della catena la delega è però la condizione normale, quindi va deciso se stamparla come **residuo** invece che come conferma | direzione |
| Rilievi **dichiarati** e non chiusi | i 4 di semgrep sono falsi positivi provati (due `detect-child-process` che non passano da `shell: true`, due `detect-non-literal-regexp` su input validati o letterali), nessun `nosemgrep` messo; il passo `playwright` non consulta `res.status` del runner — reale ma **inerte** | — |
| Nessun banco proprio della skill è su disco | «batteria verde, gate 7/7» non si rilancia in un comando, si ricostruisce | — |

## Com'è andata (in breve)

**Costruzione (2026-07-28)** — 4 references, gate a 7 passi, regole pure con 79 test, 2 template più la
config ESLint delle spec; primo banco: 5 difetti piantati su 5 rilevati, 3 premesse tolte e riconosciute
mancanti su 3. La SKILL.md, confermata dall'umano, è rimasta intatta fino al 2026-07-30.

**Collaudo avversario indipendente (2026-07-28)**, altro dominio, chat vergine: **10 difetti**, di cui
**7 falsi verdi**. I peggiori: una batteria con **ogni test saltato** usciva VERDE 7/7 — le spec si
contavano come **file**, mai come esecuzioni, e «non è fallito niente» non è «è successo qualcosa»;
chiuso da `batteriaHaEseguito()`, che rende il passo **MANCANTE** e non `fail`, perché nessuno ha
guardato non è un difetto trovato. Playwright ha poi **due** parole per «questo test non gira» e il
gate ne leggeva una: un flusso critico spento con `test.fixme` (o `test.describe.fixme`) restava
**coperto**, perché l'etichetta `@flusso:` sta nel titolo e il titolo c'è lo stesso. Poi: una riga
`Confermato da:` **vuota** catturava la prima riga non vuota successiva, perché `\s` comprende l'a capo
— falso verde sul passo che esiste per impedirlo; un handoff con `Gate: VERDE` su un gate rosso passava
se più sopra citava il rosso precedente in un blocco recintato; la spec ostile guardava il DOM **dopo**
il redirect.

**Primo consumatore reale (2026-07-30)**, banco scritto da **altri due agenti**: 15/15 e gate 7/7,
riesteso a 11 flussi / 16 test la sera stessa. Ha trovato un difetto bloccante dell'app che due gate a
monte non avevano visto, e **un falso verde della skill** (`app-viva` dichiarava viva l'app di un altro
progetto). Lo stesso giorno il collaudo di `evolve` ha scoperto che quella procedura copriva **un caso su
quattro**: l'unica modifica mai fatta alla SKILL.md.

**Pilota della catena completa (2026-08-05)** — `cavia` (nei verbali archiviati porta ancora il nome
vecchio, `fornodoro`), quarto anello di `07 → 08 → 10 → 12 → 13`: 13 flussi, 22 test, **VERDE 7/7**,
sabotaggio su cinque classi. Il sabotaggio ha detto che la batteria **sapeva fallire** sui difetti
piantati; il tribunale, subito dopo, ne ha trovate nove che **non potevano fallire** —
§Le asserzioni che non potevano fallire.

**Guardiani e tribunale sugli script (2026-08-06/07)** — semgrep 1.172.0 `--config auto`: 4 rilievi,
0 veri; gitleaks 8.30.1: nessuno. Poi `/code-inquisition`, col rilievo capitale: **un flusso critico
dichiarato poteva non essere mai eseguito col gate VERDE 7/7**, perché il controllo era un OR globale
sulla batteria — chiuso contando i **flussi percorsi** dal titolo dei test **eseguiti**. Chiusi anche
`which`/`where` che cercavano nella directory corrente, i timeout mancanti, gli argomenti passati a
`cmd /c` senza filtro e un ReDoS vero (19,5 s per flusso su 4 000 caratteri, ora 40 000 in meno di
1 ms). Il tribunale sul pacchetto ha poi trovato **due regressioni delle correzioni stesse**, una delle
quali costava 14,5 s dove voleva togliere un crash: una correzione può peggiorare un costo, e si
rimisura HEAD contro corretto. Batteria 79 → 111 → 131 → 158 → **171**.

**2026-08-07** — gate rilanciato dalla direzione sul pilota, sulla build finale, app viva e database
seedato: **VERDE 7/7, 22 passati 0 falliti 0 saltati su 13 file di spec**. Chiude il MANCANTE delle due
tornate di correzioni, provate fino a lì su report JSON e mai su una batteria vera.
