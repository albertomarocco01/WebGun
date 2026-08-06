# Referto — `/code-inquisition` sugli script delle quattro skill storiche

> **P.7c punto 4** (mandato `prompts/P7c-guardiani-arretrati.md`, ripresa-2 `prompts/P7c-ripresa2.md`).
> Data: **2026-08-06**. Bersaglio: `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/scripts`
> — 10 852 righe (5 981 non-test), Node ESM puro, zero dipendenze a runtime.
> Invocazione: `/code-inquisition <i quattro scripts/> --focus security,reliability --depth 2 --allow-exec`.

## La riga che conta

**Quarantasei difetti, e nessuno strumento deterministico della casa ne vedeva uno.**
Nello stesso giorno, sugli stessi file, rilanciati dai verificatori e non ereditati: ESLint **0 rilievi**
su quattro skill, semgrep **0 findings** sui tredici file dove i difetti vivono (le sue 25
segnalazioni del punto 3 stanno tutte altrove), gitleaks **nessun segreto** nei quattro gate, batterie
**465 test verdi su 465**. Il punto 4 non è un doppione dei punti 3 e 5: è la prova che la batteria
deterministica e il tribunale **guardano cose diverse**, e che la prima, da sola, dichiarava puliti
quattro gate che un progetto può rendere verdi senza meritarlo.

La forma ricorrente dei difetti non è «il gate calcola male». È **il gate si lascia convincere**: nove
rilievi su dieci fra i più gravi sono casi in cui una regola non scatta, il passo resta verde, e il
dettaglio stampa un numero che si legge come copertura avvenuta (`azioni server: 1`, `13 file di
spec`, `schemi esposti: public`). È esattamente il difetto che la regola della casa — *uno strumento
assente vale MANCANTE, non PASS* — esiste per impedire, arrivato da una porta che la regola non
guardava: non lo strumento assente, ma **la premessa mai contata**.

## Come è stato condotto, e quanto vale

| | |
|---|---|
| Struttura | **Depth 2**: due concili paralleli (Sicurezza · Affidabilità), **7 esperti**, due modelli diversi per de-correlare gli errori |
| Critico del roster | 1, **prima** di spawnare: ha trovato un buco vero — nessun esperto copriva la **terminazione**. L'esperto nato da lì (B4) ha prodotto **tre HIGH**, fra cui il gate che resta appeso 45 secondi senza stampare una riga |
| Cancello di verifica | **2 verificatori**, uno per concilio, **nessuno dei quali aveva scritto i rilievi che certificava**. Hanno risolto tutte le citazioni, rifatto le misure e assegnato loro i tag |
| Esecuzione | `--allow-exec`: batterie, ESLint, semgrep, gitleaks, server muti e mutazioni **rilanciati dal verificatore** |
| Giri di dibattito | **1 di 3**, dichiarato. Dopo il cancello non restavano verdetti in conflitto sui Critical/High, e i due concili si sono confermati a vicenda su un difetto (§ *La conferma incrociata*) |
| Vincoli D17 rispettati | nessuno stack Supabase acceso o spento (l'unico vivo è del pilota, di P.4g); nessun gate lanciato contro un banco; **nessun file del repo toccato** dagli agenti — `git status --short` pulito a fine turno di ognuno, verificato |

**I limiti di questo referto, dichiarati.** (1) Nessun rilievo è stato provato **su un Postgres vivo**:
dove serviva un database, le prove sono state fatte sulle librerie pure alimentate con l'input ostile,
e ciò che resta è marcato `HYPOTHESIS`. (2) Un solo giro di dibattito: la parte del rito che questo
referto **non** ha esercitato fino in fondo è la revisione incrociata fra esperti — al suo posto c'è
il tentativo di smentita dei verificatori, che è più forte su ogni singolo rilievo e più debole
sull'insieme. (3) La copertura è quella dei sette mandati: quello che nessun mandato guardava resta
non guardato, e l'elenco di ciò che *è* stato guardato e trovato pulito sta in fondo.

## La conferma incrociata (l'unica che vale)

Il protocollo dice che due istanze dello stesso modello che annuiscono non sono una conferma. Qui **un
difetto è stato trovato due volte da due concili che non si vedevano**, per due strade opposte:
l'esperto A3 partendo da «quale input del cliente rompe il parsing», l'esperto B2 partendo da «quale
uscita di strumento leggo male». È lo slittamento dei campi di `psql` (**A3-2 / B2-3**), e i due
l'hanno colpito in due punti diversi dello stesso meccanismo — uno in `qual` (campo 5 di 7), l'altro
in `prosrc` (ultimo campo). Interrogati separatamente sul disaccordo, hanno concordato.

Gli altri quarantacinque difetti stanno dentro un solo mandato ciascuno: **valgono per la loro prova,
non per un consenso**.

## Il verdetto in cifre

| | |
|---|---|
| Rilievi passati dal cancello | **47** (46 distinti: A3-2 e B2-3 sono lo stesso difetto) |
| Citazioni fabbricate (rilievo scartato) | **0** |
| Citazioni sbagliate (sostanza intatta, errore registrato) | **4** — un `:945` che è codice e non commento, due off-by-one, un simbolo attribuito al file sbagliato |
| Contraddetti attivamente dal verificatore | **1** (B1-8 → latente) |
| Declassati dal verificatore | **4** · **Promossi** | **2** |
| `executed-confirmed` (il verificatore l'ha riprodotto) | **34** |
| `static-only` · `tool-flagged` | **12** · **1** |
| **CRITICAL** · **HIGH** · **MEDIUM** · **LOW** | **2** · **12** · **17** · **15** |

---

## CRITICAL

### C1 — `where`/`which` risolvono l'eseguibile **anche dalla directory corrente**, che è il progetto auditato (A1-1) · `executed-confirmed`

`schema-forge/scripts/verify.mjs:83` · `gestionale-crafter/scripts/verify.mjs:89` ·
`flow-sentinel/scripts/verify.mjs:102` · `speed-demon/scripts/verify.mjs:93`

```
$ cd <scratch>/finto-progetto && printf '@echo off\r\necho SONO-IO-IL-FALSO\r\n' > supabase.cmd
$ where supabase
C:\...\scratchpad\finto-progetto\supabase.cmd      <-- il falso, per primo
C:\Users\Utente\scoop\shims\supabase.exe
```

I gate si lanciano **dalla radice del progetto generato** (lo prescrive il `CLAUDE.md`),
`PROJECT = process.cwd()`, e `dove()` non passa `cwd`: la ricerca eredita la radice del progetto. Un
progetto che contenga `supabase.exe`, `node.exe`, `psql.exe` o `npx.cmd` nella propria radice ottiene
esecuzione di codice — e, quel che conta qui, **rende verdi i passi**: un finto `supabase` che esca 0
su `--version` porta a casa `db-reset`, `db-lint`, `db-advisors`, `pgtap` e `tipi`; un finto `node`
che stampi `{"summary":{"block":0,…},"findings":[]}` porta a casa l'audit RLS. **Sei passi su nove**,
compreso quello che la skill chiama «il controllo che non può mancare».

**Quattro tentativi di smentita, tutti falliti**: `NoDefaultCurrentDirectoryInExePath` non tocca
`where.exe`; la preferenza per `.exe` di gestionale-crafter non è una difesa geografica (il falso
`.exe` nella CWD vince lo stesso); `formaEseguibile` fa **un solo** controllo (`/\.(cmd|bat)$/i`) e non
rifiuta nessun percorso; la CWD è davvero quella del progetto in tutti e quattro i gate.

La correzione esiste già, in **una sola riga di produzione in tutto il repo**:
`gestionale-crafter/scripts/verify.mjs:215` lancia il proprio audit con `process.execPath`.

> **Nota di cantiere.** Mentre l'audit girava, la chat di **launchpad** ha committato
> `5636373 §5.9: interprete o PATH — a questo gate non serve nessuno dei due, misurato`: sta chiudendo
> per conto suo la stessa classe su un gate nuovo. Le due strade vanno riconciliate, non duplicate.

### C2 — Un flusso critico dichiarato può non essere mai eseguito, e il gate dei flussi resta VERDE 7/7 (B1-1) · `executed-confirmed`

`flow-sentinel/scripts/gate-lib.mjs:503-504` (`batteriaHaEseguito = esito.passati > 0 || …`) ·
`:483-484` · `:184-185` · `:314-321` · `verify.mjs:374`, `:379`

Caso costruito con le funzioni pure: 13 flussi dichiarati, 13 spec con `test.skip` **motivato** più un
test banale che passa → **tutti e sette i passi `pass`**, dettaglio `1 passati, 0 falliti, 13 saltati`.

La radice è che `batteriaHaEseguito` è un **OR globale**: un test verde qualsiasi soddisfa la premessa
«il browser è il giudice» per tutti e tredici i flussi. `spec-coverage` misura i tag `@flusso:` nel
**testo del file**, mai l'esito. È la stessa classe che lo `STATO.md` dichiara chiusa dal collaudo P2
(«una batteria in cui ogni test è saltato usciva VERDE 7/7»), riaperta a granularità parziale: chiusa
per il 100%, aperta per il 92%.

**Smentita tentata, fallita**: non esiste nessun passo che confronti i flussi *eseguiti* con quelli
*dichiarati*. La sola mitigazione trovata è che il dettaglio **stampa i nomi dei test saltati anche sul
verde** — un umano che legge se ne accorge. Ma il verdetto macchina resta `pass` e `ok: true`, e
**speed-demon legge solo `esito.ok`** (`speed-demon/scripts/verify.mjs:214`): il falso verde si propaga
muto al gate a valle. Nota: l'esclusione **totale** via `testIgnore` cade correttamente in `skipped`;
è quella **parziale** — 12 spec su 13 — a passare invisibile.

---

## HIGH

| # | Difetto | Dove | Prova |
|---|---|---|---|
| H1 | **`argomentiOstiliACmd` filtra solo gli spazi**: `&`, `%VAR%` passano a `cmd.exe /c` (A1-2) | `speed-demon/gate-lib.mjs:974` → `verify.mjs:416` | `cmd /c shim.cmd … /&ver` esegue `ver`, **status 0** — con e senza spazi nel percorso dello shim (la sotto-tesi dell'esperto, «con gli spazi si rompe», è stata smentita dal verificatore) |
| H2 | **`adminRoot` arriva a `cmd.exe /c` senza nessun filtro**; gli altri tre gate non hanno nemmeno l'equivalente parziale di H1 (A1-3) | `gestionale-crafter/verify.mjs:353`, `:133`; `validaConfig` in `progetto-lib.mjs:64` | `src/app/admin&calc` si crea davvero su Windows; via `cmd /c` l'argomento si tronca e **lo status resta 0**. `validaConfig` su `adminRoot` non fa nemmeno un controllo di tipo: solo `!== undefined` |
| H3 | **La regola `service_role` è una regex letterale**: un nome di variabile diverso la aggira, e la regola 4 non copre il buco (A2-3) | `gestionale-crafter/audit-lib.mjs:195`, `:197-212`, `:215-236` | `const key = process.env.SB_ADMIN_KEY` in un file dichiarato in `moduliClientSupabase` → **regola 3 = 0, regola 4 = 0**; il controllo canonico sullo stesso file → 1 `block` |
| H4 | **Il percorso di una pagina del contratto può essere un URL assoluto**: Lighthouse misura un altro sito (A3-1) | `speed-demon/gate-lib.mjs:77` (`(\S+)`), `verify.mjs:162`, `:283` | `## \`home\` — https://example.com/` → `unisci` restituisce `https://example.com/`; `//evil.example.com/` → `http://evil.example.com/`. `stessaPagina` non confronta mai con `baseUrl` |
| H5 | **Un separatore di campo dentro un'espressione di policy sposta le colonne**: `with check (true)` diventa invisibile (A3-2 / B2-3) | `schema-forge/rls-audit.mjs:34` (il commento «non compare mai nei nomi degli oggetti» è vero per i **nomi**, falso per il **testo libero**), `audit-lib.mjs:55-61` | 7 campi → 2 findings compreso il `block`; **8 campi con `\x1f` in `qual` → 0 findings**. Nessun controllo di arità: `riga()` accetta 8 campi come ne accetterebbe 3 |
| H6 | **Un'azione server scritta come `export const x = async () => {}` non la controlla nessuno**, e il gate stampa «azioni server: 1» (A3-3) | `gestionale-crafter/audit-lib.mjs:158`, `:132`, `:151` | arrow → `funzioniEsportate = []`, `findings = 0`, `azioni = 1`. La stessa azione come `export async function` → `block` |
| H7 | **Il nome di una guardia dentro una stringa vale come chiamata**: una rotta admin scoperta passa (A3-4) | `gestionale-crafter/audit-lib.mjs:73`, `:59` | `throw new Error("richiediStaff() non e ancora agganciata")` → **nessun finding**. Tolta la stringa → `block`. La frase che innesca il difetto è proprio quella che si scrive prendendo nota del buco |
| H8 | **I passi `a11y` e `tsc` misurano con la configurazione del progetto**: zero regole attive esce 0 → `pass` (B1-2) | `gestionale-crafter/verify.mjs:337`, `:339`, `:353`, `:323` | Non esiste nessuna `resources/config` in questa skill; ESLint 9 con config di progetto a zero regole esce **0** su un `<img>` senz'`alt`. schema-forge e flow-sentinel fanno il contrario (`--no-config-lookup --config <skill>`) |
| H9 | **`"rotta": ""` fa esistere qualunque rotta** (B1-3) | `gestionale-crafter/verify.mjs:194-196`, `progetto-lib.mjs:90` | `join("C:/prog","src/app/admin","")` → `C:\prog\src\app\admin`, che esiste → `regolaEntitaAncorate` = `[]` e il passo stampa «N tabelle nei tipi». Vale anche per `rotta` **assente** |
| H10 | **I gate sono muti per costruzione, e nessuna chiamata a processo ha un `timeout`** (B4-1) | i quattro `main()`/`verdetto()`; `grep timeout` → **un solo** limite in tutto: `flow-sentinel/verify.mjs:297` | Gate speed-demon contro un server che accetta e non risponde: **45 secondi, zero righe, ucciso**. Flow-sentinel sullo stesso server torna in **15,2 s** con un ROSSO leggibile — la differenza è quell'unico `AbortSignal.timeout` |
| H11 | **Il `fetch` che decide se l'app è viva non ha timeout** (B4-2) | `speed-demon/verify.mjs:145`, chiamato da `:225` e `:342` | semgrep lo flagga come **unico** `fetch` senza `signal` fra i quattro gate. Il retry a due tentativi non protegge: protegge dal `fetch` che **solleva**, non da quello che **non torna** |
| H12 | **`npx --yes lighthouse` senza timeout né versione fissata** (A1-4 + B4-3) | `speed-demon/verify.mjs:401-403`, `:416` | `--yes` scarica ed esegue un pacchetto non fissato; `npx` gira nella radice del progetto auditato e preferisce il suo `node_modules/.bin`. gestionale-crafter usa `--no-install` sulla stessa forma |

## MEDIUM

| # | Difetto | Dove | Prova |
|---|---|---|---|
| M1 | **`psql` senza `-X`**: un file di avvio cambia la forma dell'uscita → zero righe → `block = 0` → **verde** (A1-6, *promosso* da LOW) | `schema-forge/rls-audit.mjs:61`, `flow-sentinel/verify.mjs:328`, `schema-forge/erd.mjs:45` | La domanda che decide la gravità l'ha risolta il verificatore: **psql muto esce `PASS`, non `skipped`**. `~/.psqlrc` non esiste su questa macchina, ma il verso del guasto è strutturale. Il rimedio è già in `gestionale-crafter/admin-audit.mjs:73` |
| M2 | **L'URL di connessione con la password finisce in stdout e nel `--json`** di tre gate su quattro, e da lì negli handoff committati (A1-5 / A2-1, *declassato* da HIGH) | `schema-forge/verify.mjs:516`, `rls-audit.mjs:246`,`:257`, `flow-sentinel/verify.mjs:272`, `gestionale-crafter/verify.mjs:273`, `admin-audit.mjs:159`,`:185` | Le tre righe di verbale citate contengono davvero la URL intera — ma la password è `postgres:postgres` su loopback, che gitleaks non considera un segreto. **Torna HIGH il primo giorno in cui un `--db-url` punta a un database non locale**, cosa che i gate accettano senza obiezioni. Il mascheramento esiste già: `vetrina-crafter/verify.mjs:378` |
| M3 | **Regola 10 (policy mai attaccate): basta un commento SQL per farla tacere** (A3-5) | `schema-forge/audit-lib.mjs:633-638`, `:652` | Un test pgTAP **interamente commentato** → `block = 0`, identico a un test vero. La skill sorella toglie i commenti prima di cercare, e dichiara il perché |
| M4 | **Speed-demon non riconosce i recinti `~~~`**: un esempio recintato firma il contratto e dichiara le pagine (A3-6) | `speed-demon/gate-lib.mjs:26-29` vs `flow-sentinel/gate-lib.mjs:64` | Recinto ` ``` ` → `pagine = []`; recinto `~~~` → la pagina d'esempio **entra nel contratto** e la firma d'esempio vale come firma. È il difetto che flow-sentinel ha misurato e chiuso il 2026-07-28, ricomparso in un'altra skill |
| M5 | **ReDoS vero su `IMPORT_HELPER_DB`** (A3-7) | `flow-sentinel/gate-lib.mjs:354`, costo pagato una volta **per flusso** (`:389`) | 500 → 218 ms · 1000 → 262 ms · 2000 → 2 049 ms · **4000 → 19 552 ms**. Bastano 8 000 caratteri di spazio bianco in una spec |
| M6 | **`attributo()` prende il primo `name=` del tag, `data-name=` compreso**: un `noindex` sparisce (A3-8) | `speed-demon/gate-lib.mjs:696` | `<meta data-name="viewport" name="robots" content="noindex">` → `robots: null`: la pagina esclusa dall'indice risulta pubblica |
| M7 | **`senzaSvg` cancella dal primo `<svg` — anche dentro un CSS — fino al `</svg>`** (A3-9) | `speed-demon/gate-lib.mjs:693` *(l'esperto aveva citato :692, off-by-one)* | Un `<svg` dentro un data-URI CSS azzera `title`, `description` e `canonical`: tre `block` che accusano l'imputato sbagliato, e nell'ordine sfavorevole un `noindex` cancellato |
| M8 | **`dentroProgetto` non contiene niente**: un `../` nella rotta cancella il `block` «la rotta non esiste» (A3-10) | `gestionale-crafter/verify.mjs:118` *(il secondo riferimento dell'esperto, `progetto-lib.mjs:90`, non contiene quel simbolo: citazione sbagliata, meccanismo provato dalle altre due)* | `dentroProgetto("C:/prog","src/app/admin","../../../../../Windows")` = `C:\Windows`, che esiste → nessun finding |
| M9 | **`## Deroghe` è qualunque intestazione che contenga «deroghe», e un `###` non la chiude** (A3-11) | `speed-demon/gate-lib.mjs:212-214`, `:224` | «Deroghe RESPINTE», «Storico delle deroghe scadute» e una tabella sotto un `### Archivio`: **4 su 4** raccolgono la deroga come viva |
| M10 | **La deroga di speed-demon declassa anche `accessibility`, e non richiede nessuna firma** (B1-5) | `gate-lib.mjs:505-506`, `:541-546`, `:142` | Deroga con la colonna «Confermata da» **vuota** → letta lo stesso; `accessibility` 61 contro soglia 95 → `warn` → passo **`pass`**. *Motivo corretto dal verificatore*: il template non dichiara `accessibility` non derogabile in assoluto, ma **sotto la baseline** — e il gate non legge affatto la baseline, quindi non sa distinguere i due casi |
| M11 | **Il contratto d'uscita di speed-demon è l'unico dei quattro che non rifiuta i segnaposto `{{…}}`** (B1-6) | `speed-demon/gate-lib.mjs:983-1014` vs gli altri tre | Handoff con 5 segnaposto → speed-demon `[]`, flow-sentinel `fail`. Il template di handoff di speed-demon ha **53** occorrenze di `{{`: si consegna un modulo in bianco con una riga vera |
| M12 | **L'audit RLS non dichiara mai quanti oggetti ha guardato**: zero tabelle esaminate vale `pass` (B1-4) | `schema-forge/rls-audit.mjs:246-248`, `verify.mjs:213` | Il JSON ha `ok/dbUrl/schemas/findings/summary` — **zero campi di premessa**. E `schemiEsposti(null)` (config.toml **assente**) restituisce `{schemi:["public"], errore:null}`: l'audit si restringe in silenzio e stampa «schemi esposti: public» come se fosse la verità |
| M13 | **Un commento TOML dentro l'array multi-riga produce schemi fantasma** e manda l'audit in `skipped` (B2-1) | `schema-forge/verify.mjs:193`, `:219` | `schemas = [\n "public",\n "shop", # esposto anche qui, vedi PROGETTO.md\n]` → `["public","shop","# esposto anche qui","vedi PROGETTO.md"]` → `rls-audit` esce **2** e il passo diventa `skipped` con un messaggio che accusa un `config.toml` che non è rotto |
| M14 | **Le 15 chiamate `psql` non hanno né `timeout` né `connect_timeout`** (B4-4, *promosso* sul tempo) | `rls-audit.mjs:61-63`, `admin-audit.mjs:71-75`, `flow-sentinel/verify.mjs:328` | Contro un socket che accetta e non parla: **appeso oltre 40 s**. Il prompt-password non blocca, ma per un effetto collaterale di `spawnSync` (stdin chiuso: EOF a 51 ms), non per un `-w` che nessuno passa |
| M15 | **Speed-demon nidifica l'intero gate di flow-sentinel senza timeout**: doppio silenzio (B4-5) | `speed-demon/verify.mjs:201`, `:103-129` | Il gate figlio ha un limite **solo** sulla sonda dell'app; su psql e Playwright no. Chi guarda da fuori vede due processi `node` fermi e nessuna riga |
| M16 | **`supabase db reset` senza timeout: se il primo tentativo non torna, `conRitentativo` non entra mai in gioco** (B4-6) | `schema-forge/verify.mjs:400`, `:112-118` | `conRitentativo` **attende il ritorno** del primo tentativo: il ritentativo non «raddoppia» un'attesa infinita, semplicemente non parte |
| M17 | **SEP/REC dentro il corpo di una funzione** spezzano il record (B2-3, il gemello di H5) | `rls-audit.mjs:126-131` | `\x1f` in `prosrc`: **6 campi invece di 5** e corpo troncato al separatore; `\x1e`: un record spezzato in due |

## LOW

| # | Difetto | Prova in una riga |
|---|---|---|
| L1 | Il commento «NON si usa `shell: true`» è una garanzia falsa in quattro file (A1-7) | `cmd.exe /c` **è** una shell — H1 lo misura. È la causa prossima per cui tre gate su quattro non convalidano niente. *(Una delle cinque citazioni dell'esperto, `gate-lib.mjs:945`, non è un commento ma il ramo del ternario: registrata.)* |
| L2 | `--db-url` viaggia come argomento di processo, visibile nella tabella dei processi (A2-2, *declassato*) | Stesso segreto di M2, ma transitorio in `argv` invece che permanente in un file committato |
| L3 | Ricorsione sull'albero del report Playwright: `RangeError` non gestito (A3-12) | Profondità 20 000 → `RangeError`, il processo muore senza JSON. *(Citazione off-by-one: `:453`, non `:454`.)* |
| L4 | Catalogo dei permessi come oggetto nudo indicizzato dai nomi del cliente (A3-13, *declassato*) | Il guasto va verso il **rosso falso**, non il verde falso: una tabella sconosciuta resta `null`, `constructor` dà `false` → `block` |
| L5 | `Gate: verde` minuscolo produce un rosso strutturale nel solo speed-demon (B1-7) | Regex con `i`, confronto case-sensitive; gli altri tre normalizzano con `.toUpperCase()` |
| L6 | Il passo `playwright` non consulta mai `res.status` del runner (B1-9, *dichiarato inerte*) | Il difetto c'è, ma ogni suo esito è già intercettato da `res.error` e da `estraiOggettoJson`: nessun input lo rende osservabile |
| L7 | Stesso difetto TOML in flow-sentinel, mitigato a metà (B2-2) | `senzaVirgolette` toglie la cella col `#`, non la coda del commento dopo la virgola |
| L8 | `righeDaPsql` di flow-sentinel è tornato ai delimitatori di default (B2-4) | `righeDaPsql("public.brutta\ntabella\npublic.ok")` → tre righe invece di due. Oggi innocuo (query a colonna singola), pericoloso al primo riuso |
| L9 | `esegui()` di gestionale e le `spawnSync` di `admin-audit.mjs` senza `maxBuffer` (B2-5) | semgrep conta **6** `spawnSync` senza `maxBuffer` in quella skill; le altre due dichiarano 64 MB. Oggi fallisce chiuso, ma nessuno l'ha scritto |
| L10 | `npx playwright test` senza cap proprio (B4-7) | `grep timeout` in `references/playwright.md` → **zero occorrenze**: il template della skill non dichiara il limite su cui il gate fa affidamento |
| L11 | `motivato()` legge `//` senza distinguere una stringa da un commento (B3-a) | Un `.skip` il cui titolo contiene `https://…//home` → `motivato() = true` → **nessun rilievo** |
| L12 | La riga della regex di `triggerCheNomina` non ha rete (B3-b) | Mutata a `return true`: **156/156 passano**. *(Le due clausole di guardia della stessa funzione invece la rete ce l'hanno: mutarle uccide 5 test. Scope corretto dal verificatore.)* |
| L13 | Il confine di `misuraStabile` non è mai esercitato (B3-c) | `spread > soglia` → `>=`: **87/87 passano**. I casi di test hanno spread 38 e 2; il confine (5) non lo tocca nessuno |
| L14 | **Quattro numeri di batteria dichiarati e mai rimisurati** (B3-d) | Misurati: **156 · 111 · 111 · 87**. Il repo si contraddiceva da solo: `gestionale-crafter/STATO.md` diceva 111 in testa e **105** nella checklist dello stesso file; `flow-sentinel/STATO.md` diceva 110 in una riga e 111 in un'altra; `schema-forge/COME-PROVARLA.md` era fermo a **132** |
| L15 | `trovaHandoff` ordina lessicograficamente (B1-8) — **contraddetto attivamente**, vedi sotto | |

## Contraddetto attivamente

**B1-8 — `trovaHandoff` sceglie l'handoff sbagliato.** Il verificatore ha rifatto la prova:

```
["09-speed-demon.md","13-speed-demon.md"].sort().pop()  →  13-speed-demon.md   (giusto)
["9-speed-demon.md","13-speed-demon.md"].sort().pop()   →  9-speed-demon.md    (sbagliato)
```

Il `sort()` lessicografico c'è davvero, ma con la convenzione **scritta nel `CLAUDE.md`**
(`<numero>-<nome-agente>.md`, esempio `07-schema-forge.md`) ordina giusto fino a 99. Il difetto non è
raggiungibile finché la convenzione è rispettata: **latente**, non aperto. Resta vero che il gate
sceglie fra più candidati senza dire quale ha letto.

## Cosa il cancello di verifica ha corretto agli esperti

Questa sezione esiste perché il rito serve a questo: **nessuno dei sette esperti ha certificato sé stesso.**

- **Zero rilievi fabbricati** su 47: tutte le citazioni risolvono, tranne quattro sbagliate (§ cifre)
  la cui sostanza è stata provata dalle altre citazioni dello stesso rilievo. Registrate una per una.
- **Un rilievo contraddetto** (B1-8) e ridotto a latente.
- **Quattro declassati**: M2 (HIGH→MEDIUM: la password che è già uscita è quella locale nota), L2
  (MEDIUM→LOW), L4 (MEDIUM→LOW: il guasto va verso il rosso falso), L6 (inerte).
- **Due promossi**: M1 (LOW/HYPOTHESIS→MEDIUM, perché il verificatore ha risposto alla domanda che
  l'esperto aveva lasciato aperta: psql muto esce **verde**), M14 (misurata un'attesa illimitata).
- **Tre motivazioni corrette**: M10 (il template dichiara non derogabile `accessibility` *sotto la
  baseline*, e il gate la baseline non la legge affatto — la sostanza regge, la formulazione no), L12
  (lo scope della mutazione e i numeri: 156, non 90), H1 (la sotto-tesi «con gli spazi nel percorso si
  rompe» è falsa: esegue in entrambi i casi).
- **Una correzione a un esperto sul perimetro**: `vetrina-crafter` **ha** l'equivalente di
  `argomentiOstiliACmd` (`audit-lib.mjs:101`, con test) — la quinta skill era fuori mandato e aveva
  già la difesa che alle quattro storiche manca.

## Cosa è stato guardato e dichiarato **pulito**

La contabilità dei falsi negativi vale quanto i rilievi.

- **Aggregazione del verdetto**: tutti e 30 i passi dei quattro gate registrano il proprio esito su
  **ogni** ramo d'uscita; `verdetto()` è `fail === 0 && skipped === 0` in tutti e quattro, senza filtri
  per gravità né `slice`. Nessuna via per cui un passo rosso non alzi il codice d'uscita.
- **`shell: true`**: zero occorrenze nel codice (grep esaustivo). Il problema è un altro, ed è L1.
- **Iniezione SQL** verso `psql`: `rls-audit.mjs` convalida i nomi di schema con `^[a-z_][a-z0-9_]*$`
  prima di interpolarli; le due query di flow-sentinel raddoppiano gli apici. Nessuna via d'uscita.
- **Segreti diversi dal `--db-url`**: nessuna chiave Supabase, token o password compare in nessuna
  interpolazione dei quattro gate.
- **Script npm del progetto**: nessuno dei quattro gate invoca `npm run` né uno script di
  `package.json` — un `postinstall` ostile non parte dal gate.
- **`JSON.parse` sull'uscita degli strumenti**: ogni punto è in `try/catch` con ricaduta a `skipped`,
  mai a `pass`.
- **Ritentativi**: `conRitentativo` ritenta una volta sola, solo `db reset`, e scrive «riuscito al
  secondo tentativo» **anche sul verde**.
- **Encoding e CRLF**: gestiti sistematicamente (`pulisci`, `senzaBom`); nessun verdetto dipende dal
  confronto di caratteri non-ASCII.
- **Epilogo dei gate** (`import.meta.main`): chiuso su tutti e quattro più `admin-audit.mjs`, con
  `realpathSync` e ricaduta testuale.
- **Attese volontarie**: un solo punto (`Atomics.wait`, 10 s, un ritentativo), non annidabile.
- **Prototype pollution**: un solo dizionario `{}` indicizzato da nomi del cliente (L4); tutti gli
  altri sono `Map` o chiavi validate.
- **Test accoppiati alla fixture**: nessuno. Le regole confrontano l'identità dei findings
  (`findings[0].object`, `.message`), mai solo il conteggio.
- **Istruzioni nascoste nel contenuto**: nessuna. Nessun file del bersaglio contiene testo che tenti di
  dirigere un lettore automatico.

## La sorte di ciascuno

Questo pacchetto **chiude** una cosa sola, ed è quella che poteva chiudere con una misura:

- **L14 — i quattro numeri di batteria**: rimisurati (**156 · 111 · 111 · 87**) e corretti dove il repo
  si contraddiceva (`gestionale-crafter/STATO.md`, `gestionale-crafter/COME-PROVARLA.md`,
  `flow-sentinel/STATO.md`, `schema-forge/COME-PROVARLA.md`). **Chiuso.**

Gli altri quarantacinque sono **dichiarati**, e la ragione è scritta, non implicita: sono modifiche al
**comportamento** di quattro gate diversi — ognuna vuole un test che la falsifichi, la batteria della
skill prima e dopo, e per i passi che toccano il database anche il gate rilanciato su un banco vivo,
che D17 oggi non concede a questa chat (l'unico stack acceso è del pilota, di P.4g). Chiuderli qui a
mano, senza rimisurare, sarebbe la cosa che questo referto rimprovera al codice: **una voce chiusa a
parole vale meno di una voce aperta.**

Ogni rilievo è ora nello `STATO.md` della skill che lo possiede, con la sua prova e il suo numero.
La proposta al direttore, in ordine di resa:

1. **C1** (una riga: `process.execPath` dov'è `run("node", …)`, più il rifiuto dei percorsi dentro il
   progetto) — è il difetto peggiore e la correzione più corta del referto, e va **riconciliata con
   quello che launchpad ha appena fatto per conto suo**.
2. **H10/H11/M14/M15/M16** (i timeout) — una classe sola, una riga per punto di chiamata, e
   `site-doctor` ha già scritto in casa il pattern giusto (`AbortSignal.timeout` con il commento che
   spiega il guasto).
3. **C2, H6, H7, H8, H9, M12** — la classe «la premessa non contata»: ognuno vuole un conteggio
   (`quanti flussi eseguiti`, `quante azioni riconosciute`, `quante tabelle guardate`) e la regola che
   il conteggio zero non è un verde.
4. Il resto per gravità.

---

*Referto scritto dal presidente del concilio (chat P.7c-ripresa-2). Le uscite incollate qui sono
quelle dei due verificatori, non degli esperti che hanno scritto i rilievi.*
