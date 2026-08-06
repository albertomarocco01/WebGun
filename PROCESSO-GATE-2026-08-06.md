# Processo ai gate — i quattordici del tribunale

> **P.7d**, chat unica, 2026-08-06. Bersaglio: i due CRITICAL e i dodici HIGH di
> `INQUISIZIONE-GATE-2026-08-06.md`, sui quattro gate storici.
> Il referto **non si tocca**: è il verbale di ciò che è stato trovato quel
> giorno. Questo è il verbale di ciò che è stato fatto.

## La riga che conta

**Quattordici su quattordici riprodotti prima di correggere, quattordici chiusi,
undici commit.** Nessuno è stato chiuso a parole: ognuno ha una misura *prima* e
una *dopo*, e un test che lo falsifica nella forma vera dell'ingresso.

Con loro sono caduti **cinque MEDIUM e un LOW** che stavano dentro le funzioni
riscritte — M1, M8, M14, M15, M16, M17 e L1 — e **tre difetti che il referto non
aveva visto**, trovati mentre si riproducevano i suoi:

1. `spawnSync` col nome nudo risolve dalla directory corrente *anche senza
   `where`*: le `spawnSync("psql", …)` di `rls-audit.mjs`, `erd.mjs` e
   `admin-audit.mjs` avevano lo stesso buco di C1 da un'altra porta;
2. `cmd.exe` e `where.exe` invocati per nome erano **i primi due binari
   sostituibili**, e non li guardava nessuno;
3. il filtro degli argomenti ostili rifiutava l'unico caso che a volte funziona
   (gli spazi) e lasciava passare i quattro che eseguono codice.

## I quattordici, uno per uno

| # | Difetto | Riprodotto | Chiuso | Test aggiunto | Skill |
|---|---|:--:|:--:|---|---|
| **C1** | l'eseguibile si risolve dalla directory corrente, che è il progetto auditato | sì | sì | `eseguibili.test.mjs` ×2 skill, `gate-lib.test.mjs` ×2 | tutte e quattro |
| **C2** | un flusso dichiarato può non essere mai eseguito, gate VERDE 7/7 | sì | sì | 8 test su report Playwright vero | flow-sentinel |
| **H1** | `argomentiOstiliACmd` filtra solo gli spazi | sì | sì | 4 test | speed-demon |
| **H2** | `adminRoot` arriva a `cmd /c` senza filtro; `validaConfig` non controlla il tipo | sì | sì | 4 + 7 test | gestionale-crafter |
| **H3** | la regola `service_role` è una regex letterale | sì | sì | 12 test | gestionale-crafter |
| **H4** | il percorso di una pagina può essere un URL assoluto | sì | sì | 5 test | speed-demon |
| **H5** | un separatore di campo dentro una policy sposta le colonne | sì | sì | 8 test | schema-forge |
| **H6** | un'azione server scritta come arrow non la controlla nessuno | sì | sì | 7 test | gestionale-crafter |
| **H7** | il nome di una guardia dentro una stringa vale come chiamata | sì | sì | 4 test | gestionale-crafter |
| **H8** | `a11y` e `tsc` misurano con la configurazione del progetto | sì | sì | 6 test + config della skill | gestionale-crafter |
| **H9** | `"rotta": ""` fa esistere qualunque rotta | sì | sì | 7 test | gestionale-crafter |
| **H10** | i gate sono muti per costruzione: nessun `timeout` | sì | sì | 2 test ×3 skill + misura | tutte e quattro |
| **H11** | il `fetch` che decide se l'app è viva non ha timeout | sì | sì | misura prima/dopo | speed-demon |
| **H12** | `npx --yes lighthouse` senza timeout né versione fissata | sì | sì | 1 test corretto | speed-demon |

E i **sei presi con loro**, perché stavano dentro la funzione che si stava
riscrivendo: **M1** (`psql` senza `-X`, tre punti di chiamata), **M8**
(`dentroProgetto` non contiene niente), **M14** (le chiamate a psql senza
timeout), **M15** (il gate annidato senza tetto), **M16** (`db reset` senza
limite, e `conRitentativo` che non partiva), **M17** (il gemello di H5 in
`prosrc`), **L1** (il commento «non si usa `shell: true`»).

---

## C1 — il progetto auditato sceglieva il binario che lo giudica

Il difetto peggiore del referto, e quello con la correzione più corta.

### Il sabotaggio, per intero

Un finto progetto con quattro shim piantati nella radice. Ognuno lascia una riga
in `ESEGUITO.txt` **oltre** a stampare un marcatore su stdout: il file è la prova
che non dipende da come un dettaglio è formattato.

```bat
@echo off
echo SONO-IO-IL-FALSO-supabase>> "%~dp0ESEGUITO.txt"
echo MARCATORE-FALSO-supabase
exit /b 0
```

**PRIMA** — i quattro gate di `HEAD`, lanciati dalla radice del finto progetto:

```
--- schema-forge
GATE SCHEMA: ROSSO (2 falliti, 2 verifiche mancanti su 9 passi)
OK    sqlfluff (formato SQL)
OK    squawk (operazioni pericolose)
OK    supabase db reset (applicazione reale)
OK    supabase db lint
OK    supabase db advisors
        MARCATORE-FALSO-supabase
MANC  audit RLS
        uscita dell'audit non interpretabile come JSON: MARCATORE-FALSO-node
--- gestionale-crafter
OK    tipi del progetto (tsc)
--- flow-sentinel
OK    lint delle spec
=== ESEGUITO.txt (traccia lasciata dai falsi):
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-node
SONO-IO-IL-FALSO-supabase
SONO-IO-IL-FALSO-npx
SONO-IO-IL-FALSO-node
SONO-IO-IL-FALSO-node
```

**Dieci esecuzioni di binari piantati**, e cinque passi verdi comprati: `db
reset` («1 migrazioni applicate + seed», senza nessun database), `db lint`, `db
advisors`, il `tsc` di gestionale-crafter e il `lint delle spec` di
flow-sentinel.

**DOPO** — gli stessi quattro gate, lo stesso finto progetto, lo stesso comando:

```
--- schema-forge
GATE SCHEMA: ROSSO (5 falliti, 2 verifiche mancanti su 9 passi)
FAIL  supabase db reset (applicazione reale)
        {"_tag":"Error","error":{"code":"LegacyDbResetNotRunningError",
         "message":"supabase start is not running."}}
FAIL  supabase db lint
FAIL  supabase db advisors
--- gestionale-crafter
FAIL  tipi del progetto (tsc)
=== ESEGUITO.txt (traccia lasciata dai falsi):
(il file NON esiste: nessun falso e' stato eseguito)
```

**Zero occorrenze del marcatore** in tutte e quattro le uscite (`grep -c` = 0), e
il file della traccia **non viene creato affatto**. Il vero `supabase` è stato
raggiunto e ha detto la verità: «supabase start is not running».

### Perché quattro chiusure e non una

Ognuna lascia aperta una via che le altre coprono. Le prime due sono state
misurate su questa macchina il 2026-08-06:

```
$ cd <finto-progetto>
$ where supabase
C:\...\finto-progetto\supabase.cmd      <-- il falso, per primo
C:\Users\Utente\scoop\shims\supabase.exe
$ where "$PATH:supabase"
C:\Users\Utente\scoop\shims\supabase.exe
```

```
$ cp C:/Windows/System32/hostname.exe ./psql.exe
$ node -e 'spawnSync("psql",["--version"])'        (dalla stessa cartella)
  status 1 · stdout ""                              <-- la copia
$ node -e 'spawnSync("psql",["--version"])'        (da un'altra cartella)
  status 0 · stdout "psql (PostgreSQL) 18.4"        <-- il vero
```

La seconda misura è **un difetto che il referto non aveva**: `spawnSync` col nome
nudo risolve dalla directory corrente da solo, senza passare da `where`. Le
`spawnSync("psql", …)` di `rls-audit.mjs`, `erd.mjs` e `admin-audit.mjs` avevano
lo stesso buco, e con esse `where.exe` e `cmd.exe` invocati per nome — i due
binari che nessuno guarda perché servono a guardare gli altri.

1. `where "$PATH:<nome>"` limita la ricerca alle cartelle del PATH;
2. `where.exe` e `cmd.exe` col **percorso pieno**;
3. i candidati **dentro** il progetto si rifiutano comunque (npm mette
   `node_modules/.bin` nel PATH), e il percorso rifiutato si stampa;
4. un nome non risolto **non si lancia nudo**: strumento assente = MANCANTE.

Più `process.execPath` dove i gate lanciavano `node` per i propri sotto-script:
audit RLS, ESLint delle spec, gate dei flussi annidato. Tre punti; il quarto —
`gestionale-crafter/verify.mjs:215` — era già l'unica riga giusta del repo.

### Le due asserzioni corrette

Non tolte: **corrette**, perché scrivevano il difetto.

- «fuori da Windows non si cerca niente: il nome basta» → ora si cerca ovunque,
  perché il nome nudo non si lancia più;
- «comando davvero assente: si torna al nome, e il probe fallirà come prima» →
  il probe **non** falliva come prima: falliva solo se nella cartella corrente
  non c'era un omonimo.

---

## C2 — il gate contava i test girati, non i flussi percorsi

`batteriaHaEseguito` era un OR globale: un test verde qualunque soddisfaceva la
premessa «il browser è il giudice» per **tutti** i flussi dichiarati.

**PRIMA**, su un report nella forma vera del reporter JSON di Playwright — una
suite per file, `tests[].status`, `results[].status`, annotazione `skip` con la
motivazione scritta — con 13 flussi dichiarati, 13 spec `test.skip` **motivate**
(quindi `lint-spec` pulito) e un test banale che passa:

```
flussi dichiarati nel contratto : 13
dettaglio del passo             : 14 file di spec · 1 passati, 0 falliti, 13 saltati
esitoBatteriaVerde              : true
batteriaHaEseguito              : true
=> il passo `playwright` chiude : pass
   flussi critici davvero percorsi dal browser: 0 su 13
```

**DOPO**, sullo stesso identico report:

```
MANC  batteria Playwright (il browser giudica)
        14 file di spec · 1 passati, 0 falliti, 13 saltati
        saltati:
          - accesso-socio.spec.ts › accesso-socio — saltato @flusso:accesso-socio
          …
        0 flussi critici su 13 percorsi davvero dal browser
          - flusso accesso-socio: le sue spec ci sono e sono state SALTATE
            (…). Uno skip motivato resta uno skip: su questo flusso il browser
            non ha giudicato niente
          … una riga per flusso
        13 flussi critici dichiarati non sono stati percorsi da nessun test
        eseguito: e' una verifica MANCANTE, non un verde. Il gate resta rosso
```

**Non è una soglia.** Dodici su tredici è lo stesso difetto di tredici su
tredici, un flusso critico più tardi. Il criterio è per flusso: ogni flusso
dichiarato vuole almeno un test **eseguito** che porti `@flusso:<id>` nel titolo
pieno.

L'etichetta si legge dal **titolo del test eseguito** e non dal testo del file:
il testo del file dichiara la COPERTURA (`spec-coverage`), il titolo di un test
che gira dichiara l'ESECUZIONE. Confonderle è ciò che teneva aperto il difetto —
ed è anche ciò che il rilievo di copertura chiede da sempre («nel titolo»).

Tre stati, nell'ordine di `passoLint`: un difetto **trovato** pesa più di una
verifica mancante; una verifica mancante non è mai un `pass`. Un test **fallito**
conta come percorso — il browser lo ha giudicato — e un `flaky` pure.

---

## H1 + H2 + L1 — `cmd.exe /c` è una shell

Il commento «NON si usa `shell: true`» era vero e insufficiente in quattro file.

**PRIMA**, su uno shim `.cmd` vero, con `cmd.exe /c`:

```
######## shim: …\h1\shim.cmd
  argomento con spazi      status=0  →  SHIM ricevuto: "--chrome-flags=--headless=new --no-sandbox"
  argomento con &          status=0  →  SHIM ricevuto: /  ||  Microsoft Windows [Versione 10.0.26200.8875]
  argomento con %VAR%      status=0  →  SHIM ricevuto: Utente
  argomento con |          status=0  →  Microsoft Windows [Versione 10.0.26200.8875]
  argomento con >          status=0  →

######## shim: …\h1\con spazio\shim.cmd
  argomento con spazi      status=1  →  "…\h1\con" non è riconosciuto come comando interno o esterno
  argomento con &          status=0  →  SHIM ricevuto: /  ||  Microsoft Windows […]
  argomento con %VAR%      status=0  →  SHIM ricevuto: Utente
  argomento con |          status=0  →  Microsoft Windows […]
  argomento con >          status=0  →

$ ls rubato.txt
rubato.txt        <-- un REINDIRIZZAMENTO dentro un argomento ha scritto su disco
```

Quattro cose in una tabella:

- `/&ver` **esegue `ver`**, con status 0, con e senza spazi nel percorso dello
  shim (la sotto-tesi «con gli spazi si rompe» resta smentita, come dal referto);
- `%USERNAME%` arriva **espanso**: l'argomento che arriva non è quello passato;
- `/|ver` fa sì che **lo shim non parta affatto**;
- `/>rubato.txt` **crea un file**.

E la precisazione che rovescia il filtro esistente: **l'argomento con spazi passa
benissimo** quando il percorso dello shim non ha spazi, e collassa solo quando ce
l'ha anche lui. Il filtro rifiutava l'unico caso che a volte funziona e lasciava
passare i quattro che eseguono codice. **Gli spazi restano rifiutati**:
restringere la regola su una differenza che dipende da *dove* è installato lo
strumento sarebbe indebolirla.

### H2 sul gate vero

`adminRoot: "src/app/admin&calc"` — e la cartella col `&` si crea davvero su
Windows:

```
PRIMA  OK    configurazione del gestionale
       OK    accessibilita' (eslint jsx-a11y)   ← ESLint su un percorso troncato,
                                                  status 0, passo VERDE
DOPO   FAIL  configurazione del gestionale
             - `adminRoot` contiene un metacarattere di shell (& | < > ^ ( ) " % * ?):
               questo percorso viene passato a `cmd.exe /c`, che lo ri-analizza …
```

`validaConfig` controllava `adminRoot` con `!== undefined`: nemmeno un controllo
di tipo, su un valore che il progetto **auditato** scrive. Ora `erroriAdminRoot`
pretende una stringa non vuota, relativa, senza `..` e senza metacaratteri — le
quattro condizioni che il resto del gate dava per scontate senza dirlo. Il
trattino resta lecito (`src/app/area-riservata`), e c'è il test che lo blocca.

---

## H3 — la chiave si riconosce da cos'è, non da come si chiama

**PRIMA e DOPO**, dentro un modulo **dichiarato** in `moduliClientSupabase`
(quindi nemmeno la regola 4 lo guarda):

```js
const key = process.env.SB_ADMIN_KEY;
export const admin = createClient(process.env.SUPABASE_URL, key);
```

```
PRIMA  nome diverso (SB_ADMIN_KEY)     regola 3 = 0  regola 4 = 0  block = 0
       nome canonico (SERVICE_ROLE)    regola 3 = 1  regola 4 = 0  block = 1
DOPO   nome diverso (SB_ADMIN_KEY)     regola 3 = 1  regola 4 = 0  block = 1
       nome canonico (SERVICE_ROLE)    regola 3 = 2  regola 4 = 0  block = 2
```

Tre domande al posto di una, e due non nominano nessuna parola:

- **NOME** — `service_role` resta un `block`, com'era. Non si toglie niente.
- **VALORE** — una chiave *incollata* nel codice si riconosce da com'è fatta: un
  JWT il cui payload dichiara `"role":"service_role"`, o una `sb_secret_…` del
  formato nuovo. Il nome della costante non conta.
- **PROVENIENZA** — dentro un modulo che costruisce un client Supabase, ogni
  `process.env.X` che non sia `NEXT_PUBLIC_*` — cioè ciò che Next **dichiara**
  pubblicabile — e non sia un indirizzo è una chiave di provenienza ignota.

Il perimetro della terza è stretto apposta: fuori dai moduli client un
`process.env.STRIPE_SECRET_KEY` è affar suo. Accusare ogni segreto del progetto
renderebbe la regola rumore, e il rumore si impara a scavalcare — c'è il test che
lo blocca, insieme a quelli sulla chiave anonima nei due formati e sul JWT
`role: anon`, che è pubblicabile per costruzione.

---

## H4 — il percorso di una pagina è un percorso

**PRIMA**, su un contratto firmato e senza nessun rilievo:

```
pagine lette: [{"id":"home","percorso":"https://example.com/"},
               {"id":"catalogo","percorso":"//evil.example.com/"}]
findings del contratto: 0
  home       baseUrl=http://127.0.0.1:3200  →  Lighthouse misura  https://example.com/
             stessaPagina(richiesto, finale) = true  (non confronta mai con baseUrl)
  catalogo   baseUrl=http://127.0.0.1:3200  →  Lighthouse misura  http://evil.example.com/
```

**DOPO**, sullo stesso identico contratto:

```
pagine lette: []
findings del contratto: 3
```

Due porte indipendenti: `erroreDiPercorso` nel contratto (e la pagina **non entra
nell'elenco**, perché il passo `misura` gira anche su contratto rosso), e
`stessaOrigine(baseUrl, indirizzo)` prima di ogni giro di Lighthouse. La forma
ammessa è quella che il template scrive da sempre — il segnaposto è
`{{/percorso}}` e i tre esempi sono `/`, `/catalogo`, `/catalogo/acero-palmato`.

---

## H5 + M17 — un record che non ha i suoi campi non si interpreta

L'unico difetto del referto trovato **due volte** da due concili che non si
vedevano.

**PRIMA**, sul record vero di `pg_policies` (7 campi):

```
7 campi (sano)                campi=7  findings=2  block=1
      [issue] policy con `using (true)`: RLS attiva ma senza filtro
      [block] policy di scrittura con `with check (true)`: chiunque puo' …
8 campi: \x1f dentro `qual`   campi=8  findings=1  block=0
      [issue] policy con `using (true)`: RLS attiva ma senza filtro
```

Il `block` — la riga che decide il verdetto — **sparisce**. E il gemello, sul
record di `pg_proc` (5 campi):

```
corpo sano           record=1  campi=5   (attesi: 1 record, 5 campi)
corpo con \x1f       record=1  campi=6   (corpo troncato al separatore)
corpo con \x1e       record=2  campi=5   (un record spezzato in due)
```

*(Il referto riportava «8 campi → 0 findings»; qui il conteggio misurato è
1 finding e 0 block. La sostanza è la stessa e il `block` sparisce in entrambe le
varianti: cambia solo dove si inserisce il separatore dentro `qual`.)*

**La correzione è il controllo, non la neutralizzazione.** Ognuna delle undici
query dichiara quanti campi ha; un record che non li ha non si interpreta, e
l'audit esce 2 — verifica MANCANTE, che il gate legge come `skipped`.

**Perché non anche la neutralizzazione in SQL** (un `translate` sui campi di testo
libero): vorrebbe un Postgres vivo per essere provata, e questo pacchetto non ne
ha uno. Applicarla alla cieca su undici query metterebbe a rischio l'intero audit
per rendere *silenzioso* un guasto che ora è *rumoroso*. Sta fra le proposte.

**Limite dichiarato.** Il controllo di arità è provato dalle otto asserzioni pure
sulle forme misurate — fra cui quella che mostra il `block` che sparisce — non da
un giro del guscio. Per raggiungerlo dal guscio servirebbe un finto `psql.exe`:
uno `.cmd` ora viene respinto **prima**, dal filtro di H1/H2, e la prova di quel
respingimento è essa stessa una misura:

```
### catalogo SANO (7 campi, come li manda il database)
argomenti non passabili da `cmd.exe /c`, che E' una shell e li ri-analizza
(spazi, oppure uno fra & | < > ^ ( ) " % o un carattere di controllo):
"\u001f", "\u001e", "select n.nspname, c.relname, …"
Qui gli argomenti sono l'SQL del catalogo e i separatori di campo: attraverso
una shell l'audit interrogherebbe un'altra cosa. Verifica MANCANTE.
  uscita=2
```

---

## H6 + H7 — l'audit delle azioni server era cieco due volte

**H6, PRIMA** (funzioni pure e poi il guscio vero):

```
arrow                    funzioniEsportate=[]              findings=0  «azioni server: 1»
export async function    funzioniEsportate=["salvaOrdine"] findings=1  «azioni server: 1»

PRIMA  file letti: 3 · rotte admin: 1 · azioni server: 1 · scritture: 0
       AUDIT GESTIONALE: nessun bloccante (0 issue, 0 warn)
DOPO   file letti: 3 · rotte admin: 1 · azioni server: 1 · scritture: 0
       - src/modules/ordini/azioni.ts:salvaOrdine: azione server senza guardia …
       AUDIT GESTIONALE: ROSSO (1 block, 0 issue, 0 warn)
```

**H7, PRIMA e DOPO**:

```
PRIMA  con la stringa       rotte=1  findings=0  block=0
       senza la stringa     rotte=1  findings=1  block=1
DOPO   con la stringa       rotte=1  findings=1  block=1
       senza la stringa     rotte=1  findings=1  block=1
```

La frase che innescava il difetto è esattamente quella che si scrive prendendo
nota del buco: `throw new Error("richiediStaff() non e ancora agganciata")`. Il
codice che **ammette** di non essere protetto convinceva il gate di esserlo.

**E la premessa.** «azioni server: 1» contava i *file* con `"use server"`, non le
azioni guardate. Ora `azioni` conta le azioni **riconosciute**, `fileAzioni` i
file, e `azioniNonLette` nomina i file di cui il gate non ha saputo leggere gli
export — e il passo con quella lista non è `pass`: è `skipped`, terza premessa
accanto a «nessuna rotta trovata» e «permessi non letti».

---

## H8 — il gate chiedeva all'imputato con quali regole voleva essere misurato

**PRIMA**, su un progetto vero (eslint 9 e `eslint-plugin-jsx-a11y` installati
davvero) con una `eslint.config.mjs` che guarda i file e non ha nessuna regola
attiva, e un `<img src="/logo.png" />` senza `alt` dentro una vista admin:

```
$ npx --no-install eslint src/app/admin src/components
  status di ESLint = 0
OK    accessibilita' (eslint jsx-a11y)
        controllate: src/app/admin, src/components
```

**DOPO**:

```
FAIL  accessibilita' (eslint jsx-a11y)
        controllate: src/app/admin, src/components · regole:
        …/resources/config/eslint-a11y.config.mjs (della skill, non del progetto)
        src/app/admin/prodotti/page.tsx
          3:10  error  img elements must have an alt prop, either with meaningful
                       text, or an empty string for decorative images  jsx-a11y/alt-text
        ✖ 1 problem (1 error, 0 warnings)
```

La forma non è inventata: è quella delle due sorelle (`flow-sentinel` linta le
spec con `--no-config-lookup --config <skill>/…`, `schema-forge` passa il proprio
`.sqlfluff`). Quattro regole passano da `warn` a `error`, perché un `warn` non fa
uscire ESLint diverso da 0 e un passo che non può diventare rosso non è un passo.

**E il gemello sul `tsc`**, che il referto nomina e non misura. Il tsconfig del
progetto resta quello giusto — gli alias li conosce solo lui — ma con
`strict: false` TypeScript esce 0 su codice che un controllo vero boccia. La
correzione è contare la premessa:

```
MANC  tipi del progetto (tsc)
        `compilerOptions.strict` e' `false`: `tsc --noEmit` esce 0 su codice che
        un controllo vero boccia, e un passo verde qui direbbe il contrario di
        cio' che e' successo
        I tipi NON sono stati controllati sul serio: verifica mancante, non un successo.
```

---

## H9 + M8 — una rotta è un pezzo di percorso, e non altro

**PRIMA**, su una radice che esiste davvero:

```
rotta ""                       → join = <adminRoot>  esiste = true   findings = 0
rotta assente                  → join = <adminRoot>  esiste = true   findings = 0
rotta "../../../../../Windows" → join = C:\Windows   esiste = true   findings = 0
rotta "prodotti"               → esiste = false      findings = 1
```

**DOPO**, sugli stessi identici valori:

```
rotta ""                       findings = 1 → …ma `rotta` vuota: la vista sarebbe la radice admin…
rotta assente                  findings = 1 → …ma `rotta` non dichiarata: senza, il gate cercherebbe…
rotta "prodotti"               findings = 1 → …la rotta `prodotti` non esiste sotto agenti
rotta "../../../../../Windows" findings = 1 → …ma `rotta` contiene `..`: risalendo sopra la radice…
rotta "schema-forge"           findings = 0   (la vista esiste davvero)
```

Il messaggio conta quanto il verdetto: «la rotta `` non esiste» manderebbe a
cercare una cartella, quando il difetto è che quella non è una rotta.

---

## La famiglia dei timeout, misurata prima e dopo

Due server costruiti apposta: uno HTTP che **accetta la connessione e non
risponde mai** (`createServer((req) => {})`, porta 48311) e un socket TCP che
**accetta e non parla** (porta 48312). Porte sotto 49152: WinNAT riserva
57464-57963.

### PRIMA

```
speed-demon    ucciso a 120 s · uscita 124 · ZERO righe stampate
flow-sentinel  18 250 ms · uscita 1 · ROSSO leggibile:
               MANC  app viva e database del progetto
                     l'app non risponde su http://127.0.0.1:48311
                     (The operation was aborted due to timeout): senza app viva
                     non esiste esito, e un verde qui sarebbe un verde su niente
rls-audit      ucciso a 100 s · uscita 124 · UNA riga stampata
```

La differenza fra 18 secondi e l'infinito era **un solo `AbortSignal.timeout`**,
l'unico limite di tutta la casa.

### DOPO

```
speed-demon    57 767 ms · uscita 1 · 19 righe

GATE PERFORMANCE: ROSSO (2 falliti, 4 verifiche mancanti su 7 passi)
OK    contratto delle pagine e delle soglie
FAIL  rete E2E di Flow Sentinel
        gate flussi: ROSSO (2 falliti, 2 mancanti su 7 passi)
MANC  build di produzione (non dev server)
        nessuna risposta da http://127.0.0.1:48311: avvia la build con
        `npm run build && npm run start` prima del gate
MANC  misura Lighthouse (mediana di N giri)
MANC  soglie dichiarate
MANC  metatag nell'HTML servito
FAIL  contratto d'uscita (handoff)

rls-audit      10 262 ms · uscita 2
               psql ha fallito: psql: error: connection to server at
               "127.0.0.1", port 48312 failed: timeout expired
```

**Da ∞ a 57,8 secondi con sette passi motivati; da ∞ a 10,3 secondi con il
motivo scritto.**

### I punti di chiamata, tutti

| Referto | Dove | Limite | Nota |
|---|---|---|---|
| H11 | `preleva` (fetch) | 20 s | il retry a due tentativi protegge dal `fetch` che **solleva**, non da quello che non torna |
| H12 | Lighthouse | 180 s | e la versione è **fissata**: 13.4.1, dentro la skill |
| M15 | gate dei flussi annidato | 30 min | tetto sopra i limiti del figlio |
| M14 | psql ×3 skill | 60 s + `PGCONNECT_TIMEOUT` 10 s | `connect_timeout` non vede la query che non torna; il `timeout` da solo aspetta troppo il database che non c'è |
| M16 | `supabase db reset` | 10 min | qui vale doppio: `conRitentativo` **attende** il ritorno del primo tentativo, e senza limite il ritentativo non «raddoppiava» l'attesa — non partiva |
| H10 | probe `--version`, linter, `gen types`, ESLint a11y, `npx playwright test`, i due audit come figli | tabella `LIMITI` per skill | ogni `run`/`esegui` ha un default; i passi lunghi lo alzano dichiarandolo |

Quando un limite scatta si stampa **quale comando, quanto ha aspettato** e che
vale MANCANTE. `scaduto()` distingue il processo **ucciso** da quello che ha
risposto male, e la forma è misurata:

```
status: null · signal: "SIGKILL" · error.code: "ETIMEDOUT"
```

### Lighthouse fissato

`npx --yes lighthouse` faceva tre cose in una riga: scaricava un pacchetto **non
fissato** a ogni giro, richiedeva la rete per misurare, e lo cercava **prima** nel
`node_modules/.bin` del progetto misurato. Ora `lighthouse@13.4.1` è una
devDependency della skill, lanciata con `process.execPath` e col suo limite.

**Conseguenza, e vale la pena scriverla**: con Lighthouse nella skill e il gate
dei flussi lanciato con `process.execPath`, **speed-demon non cerca più nessun
binario per nome**. La macchina di C1/H1 esce dal suo guscio e resta in
`gate-lib.mjs` con i suoi test: lì la classe di guasto non esiste più per
costruzione, non per cura. È la stessa conclusione che launchpad ha scritto per
il proprio gate il 2026-08-06 (`5636373`).

---

## Le batterie, prima e dopo

Numeri di partenza misurati dalla direzione il 2026-08-06 e riconfermati
all'apertura di questo pacchetto.

| Skill | Prima | Dopo | Δ |
|---|---:|---:|---:|
| schema-forge | 156 | **186** | +30 |
| gestionale-crafter | 111 | **173** | +62 |
| flow-sentinel | 111 | **131** | +20 |
| speed-demon | 87 | **103** | +16 |
| **totale** | **465** | **593** | **+128** |

```
schema-forge         ℹ tests 186 ℹ pass 186 ℹ fail 0
gestionale-crafter   ℹ tests 173 ℹ pass 173 ℹ fail 0
flow-sentinel        ℹ tests 131 ℹ pass 131 ℹ fail 0
speed-demon          ℹ tests 103 ℹ pass 103 ℹ fail 0
```

## I guardiani alla chiusura

```
########## ESLINT              ########## KNIP
schema-forge         0 rilievi  schema-forge         0 rilievi
gestionale-crafter   0 rilievi  gestionale-crafter   0 rilievi
flow-sentinel        0 rilievi  flow-sentinel        0 rilievi
speed-demon          0 rilievi  speed-demon          0 rilievi

########## SEMGREP (p/javascript + p/secrets, i quattro scripts/)
findings: 0 · file scansionati: 31 · errori: 1
   (l'errore è un file che il parser salta, non un rilievo)

########## GITLEAKS (per gate)
schema-forge         no leaks found
gestionale-crafter   no leaks found
flow-sentinel        no leaks found
speed-demon          no leaks found
   (una scansione dell'intero repo trova 63 rilievi: 0 nei quattro gate,
    tutti in `agenti/bugbay` — snapshot esterno — e in `banco-prova-collaudo-lp/`,
    che è un banco ignorato da git)

########## JSCPD (duplicazione)                prima → dopo
schema-forge         2 cloni, 18 righe (0,51%) → 1 clone,  8 righe (0,25%)
gestionale-crafter   5 cloni, 48 righe (1,95%) → 5 cloni, 48 righe (1,31%)
flow-sentinel        0 cloni,  0 righe (0%)    → 0 cloni,  0 righe (0%)
speed-demon          1 clone,  5 righe (0,32%) → 1 clone,  5 righe (0,28%)

########## GATE DELLA REGIA
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
```

**Nessun clone nuovo**: schema-forge ne perde uno, gli altri restano identici in
numero e calano in percentuale. I cloni residui sono l'epilogo `import.meta.main`
e le intestazioni dei test — codice che il repo duplica **per scelta dichiarata**,
perché due copie divergenti sarebbero peggio di due copie uguali.

---

## Cosa resta MANCANTE, con il suo nome

1. **I quattro gate non sono stati rilanciati contro un banco vivo.** D17 concede
   un solo stack Supabase a questa macchina, e quello acceso è del pilota, di
   P.4h. I quattordici sono stati riprovati **per batteria e per sabotaggio su
   progetti finti**; il giro completo su un banco vero è l'atto di chiusura del
   prossimo pacchetto. È il precedente che P.7c ha stabilito il 2026-08-06
   correggendo la regexp dell'audit RLS senza rilanciare il gate, dichiarandolo,
   e vedendoselo accettare dalla direzione. **Dichiarato è la differenza fra un
   limite e una bugia.**

2. **Il controllo di arità (H5/M17) non è stato esercitato dal guscio**, per il
   motivo scritto sopra: serve un finto `psql.exe`, e uno `.cmd` ora viene
   respinto prima. Le otto asserzioni pure coprono le forme misurate.

3. **La neutralizzazione dei separatori in SQL** — proposta, non applicata:
   vuole un Postgres vivo.

4. **Nessun Docker avviato, nessuno stack Supabase acceso o spento, nessun banco
   toccato.** Il pilota `C:\Users\Utente\Desktop\fornodoro` non è stato aperto.
   I due server finti costruiti per la misura dei timeout sono stati **uccisi a
   fine misura**, e le porte 48311/48312 verificate libere:
   `Get-NetTCPConnection … → nessuna in ascolto`.

## Proposte per la direzione

### Quali dei 31 MEDIUM/LOW residui meritano il prossimo pacchetto

Sei sono già caduti qui (M1, M8, M14, M15, M16, M17 e L1: sette voci in tutto).
Dei rimanenti, l'ordine che propongo — e il criterio è uno solo: **prima ciò che
produce un verde falso, poi ciò che produce un rosso falso, poi il resto**.

**Blocco 1 — la premessa non contata, ciò che resta della classe di C2/H6/H9.**
Sono i tre che ancora fanno passare per copertura un silenzio.

1. **M12** — l'audit RLS non dichiara mai quanti oggetti ha guardato, e
   `schemiEsposti(null)` restringe l'audit **in silenzio** stampando «schemi
   esposti: public» come se fosse la verità. È il gemello esatto di «azioni
   server: 1», sul passo che la skill chiama «il controllo che non può mancare».
2. **M3** — regola 10: un test pgTAP **interamente commentato** vale come un test
   vero. La skill sorella toglie i commenti prima di cercare, e dichiara il
   perché: la correzione esiste già in casa.
3. **M13** — un commento TOML dentro l'array multi-riga produce schemi fantasma e
   manda l'audit in `skipped` accusando un `config.toml` che non è rotto. Va con
   M12 perché tocca la stessa riga di premessa, e con **L7**, che è lo stesso
   difetto in flow-sentinel mitigato a metà.

**Blocco 2 — il contratto che si firma da solo.** Tre difetti che permettono a un
documento di dichiarare ciò che vuole.

4. **M4** — speed-demon non riconosce i recinti `~~~`, quindi un esempio recintato
   **firma il contratto e dichiara le pagine**. È il difetto che flow-sentinel ha
   misurato e chiuso il 2026-07-28, ricomparso in un'altra skill: costa poco e la
   correzione è già scritta altrove.
5. **M9** — `## Deroghe` è qualunque intestazione che contenga «deroghe», e un
   `###` non la chiude: quattro forme su quattro raccolgono una deroga morta come
   viva.
6. **M10** — la deroga declassa anche `accessibility` e non richiede nessuna
   firma. Va **dopo** M9 perché ne condivide il parser, e la sua motivazione
   corretta dal verificatore («il template la dichiara non derogabile *sotto la
   baseline*, e il gate la baseline non la legge») è un lavoro in più: leggere la
   baseline.
7. **M11** — il contratto d'uscita di speed-demon è l'unico dei quattro che non
   rifiuta i segnaposto `{{…}}`, e il suo template ne ha 53. Una riga, e chiude
   la consegna di un modulo in bianco.

**Blocco 3 — il rosso falso, che è meno grave ma insegna a ignorare il rosso.**

8. **M7** — `senzaSvg` cancella dal primo `<svg` anche dentro un CSS: tre `block`
   che accusano l'imputato sbagliato, e nell'ordine sfavorevole un `noindex`
   cancellato. Ha entrambe le direzioni, e per questo sta in cima al blocco.
9. **M6** — `attributo()` prende il primo `name=`, `data-name=` compreso: una
   pagina esclusa dall'indice risulta pubblica.
10. **M5** — ReDoS vero su `IMPORT_HELPER_DB`: 4000 caratteri → 19,5 s, e il costo
    si paga **una volta per flusso**. Non è un falso verde, è un gate che si
    ferma — ma ora che i limiti esistono si ferma con un messaggio, e questo lo
    fa scendere di priorità rispetto a quando è stato scritto.

**Blocco 4 — il resto, per gravità**: L11 (`motivato()` legge `//` dentro una
stringa), L5 (`Gate: verde` minuscolo, rosso strutturale nel solo speed-demon),
L3 (ricorsione sull'albero del report), L8 (`righeDaPsql` di flow-sentinel tornato
ai delimitatori di default: oggi innocuo, pericoloso al primo riuso), L9
(`maxBuffer` — già chiuso di fatto nei punti che ho riscritto, resta da
dichiarare), L2, L4, L6, L12, L13, L15.

**M2 lo terrei fuori dall'ordine per gravità e lo tratterei a parte**: la URL con
la password negli handoff committati è MEDIUM solo finché la password è
`postgres:postgres` su loopback. Il referto scrive che **torna HIGH il primo
giorno in cui un `--db-url` punta a un database non locale**, e i gate lo
accettano senza obiezioni. Il mascheramento esiste già in
`vetrina-crafter/verify.mjs:378`: è mezza giornata, e toglie di mezzo una bomba a
orologeria invece di una scomodità.

### Due proposte che non sono nel referto

- **Il `translate` sui campi di testo libero** delle undici query dell'audit RLS
  (§ H5): renderebbe *impossibile* la collisione invece che *rumorosa*. Vuole un
  banco vivo, e va nel pacchetto che ce l'ha.
- **Rilanciare i quattro gate contro il pilota** appena P.4h libera lo stack: è il
  MANCANTE n°1 di questo verbale, e non si chiude altrimenti.

### Una cosa per il vicino

Cinque delle quattordici correzioni possono far diventare rosso un progetto che
finora passava, e in ogni commit c'è scritto quale e perché: la radice admin con
uno spazio o un `&`; un contratto performance con un percorso senza `/` iniziale;
un `gestionale.config.json` con una rotta vuota; un tsconfig senza
`strict: true`; una vista con un problema di accessibilità vero che la
configurazione del progetto non guardava. **Non sono regressioni del pilota: sono
il sistema che funziona.** Il messaggio dice sempre quale delle cinque e dove.

---

*Verbale di P.7d. Le uscite incollate qui sono quelle misurate su questa
macchina il 2026-08-06, prima e dopo ogni correzione.*
