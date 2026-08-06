# Stato — Speed Demon

- **Stato attuale:** v1.1 — costruita il 2026-07-30 e **collaudata in modo
  avversario lo stesso giorno da una sessione indipendente**, su un secondo
  banco costruito apposta con pagine davvero lente
  (`banco-prova-immobiliare`, Case di Langa). Gli script hanno test propri
  (`node --test`, **144 verdi** dal 2026-08-07 con P.7e; **103** con P.7d, **87**
  alla costruzione), il gate `verify` ha **8 passi** con id stabili — l'ottavo,
  `contrasto`, e' nato con P.7e ed e' la delega §D21 che nessuno onorava.
  Il gate corretto e' stato **rilanciato sul banco vecchio**, `banco-prova-negozio`,
  e chiude **VERDE 7/7**: nessuna regressione, e `rete-verde` — la seconda legge
  della skill — ha finalmente girato dentro questo gate, verde sull'app giusta e
  rosso quando lo si punta su un'altra.
  **NON ancora usabile su un progetto cliente**: restano i punti in fondo,
  ordinati per gravita'. Il primo non e' un difetto della skill — e' che
  l'elenco delle pagine che contano lo firma chi collauda, non chi vende.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: **flow-sentinel** (la batteria E2E e' la rete: il passo `rete-verde`
    la rilancia davvero, non si fida dell'handoff) · gestionale-crafter e
    schema-forge (l'app da misurare) · brief-smith (quali pagine contano)
  - A valle: cyber-shield e site-doctor (verifiche finali sul sito ottimizzato),
    launchpad (non pubblica su gate rosso)
  - **Fly UI non esiste** (`../../DECISIONI.md` §21): non c'e' nessuna libreria
    di componenti da ottimizzare, i componenti sono scritti a mano nel progetto.
- **Guardiani:** ESLint **0 errori 0 warning** e `knip` **0 rilievi** sugli
  script (P.7c punti 1-2, commit `a6f6d1e`, 2026-08-03); nello stesso giro la
  `complexity 19` di `verify.mjs` è stata sciolta in funzioni pure, batteria
  75 → **86**, rilanciata dal direttore il 2026-08-04 (86/86, 0 fail). `semgrep`
  **3 rilievi dichiarati, 0 veri** (2026-08-06, P.7c punto 3 — ma su
  `gate-lib.mjs` ha letto il 99,7% delle righe, non il 100%). Restano mai visti
  `jscpd` e, fino a P.7c punto 4, code-inquisition: punto 5. `gitleaks` **0
  rilievi** (2026-08-06, P.7c punto 5).
- **2026-08-03 — il gate non partiva sul Node di sistema, e usciva `0` muto.** *Il
  difetto:* l'epilogo era `if (import.meta.main) await main();`, e `import.meta.main`
  e' arrivato in **Node 24**; su Node 20.12.2 — l'unico Node di sistema di questa
  macchina — vale `undefined`, `main()` non girava e **il gate usciva `0` senza
  stampare una riga**, cioe' un verde che non aveva guardato niente. E' esattamente la
  classe di difetto per cui questa skill esiste — `--url` senza default,
  `eLaMiaBuild`, `indiziDevServer` — e ce l'aveva nell'ultima riga del proprio guscio.
  I prerequisiti dichiarati dicono «Node >= 20»: era il codice a violare il proprio
  contratto. *La correzione:* la forma gia' collaudata di `vetrina-crafter`,
  `process.argv[1]` risolto e confrontato con `fileURLToPath(import.meta.url)`, a
  comportamento invariato su Node 24. *Come si e' provata:* in una cartella
  non-progetto nelle **due direzioni** — prima Node 20 usciva `0` con zero righe e
  Node 24 usciva `2` con il messaggio, dopo **entrambi escono `2` con lo stesso
  messaggio**. Due test di regressione nel nuovo `scripts/verify.test.mjs` (73 →
  **75**), il primo file di test del guscio: uno **funzionale** (lancia il gate in una
  cartella non-progetto e pretende uscita != 0 e output non muto — copre tutta la
  classe «l'epilogo non parte», ma su Node 24 non vede *questo* difetto) e uno
  **statico** (il sorgente non contiene `import.meta.main` — l'unico dei due che lo
  impedisce su qualunque Node). Pacchetto P.0-igiene.

- **2026-08-06 — semgrep sugli script, la prima volta: 3 rilievi, 0 veri, e un
  guardiano che non legge tutto il file (P.7c punto 3).** Configurazione
  dichiarata: `semgrep scan --config auto` (1.172.0, il profilo della casa —
  `references/motore-deterministico.md` di code-maniac), **200 regole su 6
  file**. Esiti: **un `detect-child-process`** (`verify.mjs`:124, ERROR) →
  **falso positivo provato**: `spawnSync` senza `shell: true`, argomenti come
  vettore, e questo gate ha in più `argomentiOstiliACmd`, che rifiuta gli
  argomenti che `cmd.exe` non saprebbe passare interi. **Due
  `detect-non-literal-regexp`** (`gate-lib.mjs`:134 e :696) → **falsi positivi**:
  `derogheDaTabella` cerca l'intestazione con tre parole letterali
  (`pagina`, `categoria`, `motivo`) e `attributo(tag, nome)` è chiamato solo con
  `name`, `content`, `rel`, `href`. Nessuna correzione, nessun `nosemgrep`:
  tre rilievi **dichiarati**. **La cosa che conta non è nei rilievi**: su
  `gate-lib.mjs` semgrep si ferma a **~99,7% di righe analizzate**
  (`PartialParsing`) — cioè su questo file il guardiano **non ha letto tutto**,
  e la posizione che dichiara (riga 29) **non è dove sta il problema**: le
  stesse righe estratte in un file a parte, con lo stesso ruleset, parsano al
  100%, e gli offset dello span (`0` e `40`) non sono quelli del file. È un
  limite dello strumento, non una proprietà del codice — e vale come
  **MANCANTE parziale**, non come `PASS`: quello 0,3% nessuno l'ha guardato.

- **2026-08-06 — `/code-inquisition` sugli script, la prima volta, e il punto
  aperto n°5 ha una risposta: quattordici difetti, e questa skill ne ha piu' di
  tutte (P.7c punto 4).** Referto con le uscite incollate:
  `../../INQUISIZIONE-GATE-2026-08-06.md`. Sette esperti, due verificatori che
  hanno rifatto le misure. Lo stesso giorno: ESLint 0, semgrep 3 (0 veri),
  gitleaks 0, batteria **87/87**.
  - **HIGH — `argomentiOstiliACmd` filtra SOLO gli spazi** (`gate-lib.mjs:974`):
    `&`, `%VAR%` e i metacaratteri di `cmd.exe` passano. Misurato:
    `cmd /c shim.cmd … /&ver` esegue `ver` e **lo status resta 0**, con **e
    senza** spazi nel percorso dello shim (la tesi «con gli spazi si rompe» e'
    stata smentita dal verificatore). Il valore arriva dal `docs/performance.md`
    del progetto: il percorso di pagina e' letto come `(\S+)`.
  - **HIGH — il percorso di una pagina puo' essere un URL assoluto**: Lighthouse
    misura **un altro sito** e il gate scrive i numeri accanto al nome della
    pagina. `## \`home\` — https://example.com/` → `unisci` restituisce
    `https://example.com/`; `//evil.example.com/` funziona ugualmente.
    `stessaPagina` non confronta mai con `baseUrl`. E' il difetto del 2026-07-30
    («misurare l'app di un altro progetto») riaperto dal lato del contratto.
  - **HIGH — i gate sono muti per costruzione e nessuna chiamata ha un
    `timeout`**: contro un server che accetta e non risponde, questo gate resta
    **45 secondi senza stampare una riga** e va ucciso (misurato). Flow-sentinel
    sullo stesso server torna in **15,2 s** con un ROSSO leggibile: la
    differenza e' un solo `AbortSignal.timeout`, che qui manca (`verify.mjs:145`
    e' l'**unico** `fetch` senza `signal` dei quattro gate — lo dice semgrep).
  - **HIGH — `npx --yes lighthouse`**: pacchetto non fissato, installazione da
    rete senza conferma, `npx` che gira nella radice del progetto auditato e
    preferisce il suo `node_modules/.bin`. E nessun timeout: se la rete non
    risponde, resta appeso in silenzio.
  - **MEDIUM — i recinti `~~~` non sono riconosciuti** (`gate-lib.mjs:26-29`):
    un esempio recintato **firma il contratto** e dichiara le pagine. Misurato:
    recinto ` ``` ` → `pagine = []`; recinto `~~~` → la pagina d'esempio entra.
    E' il difetto che flow-sentinel ha misurato e chiuso il 2026-07-28,
    ricomparso qui — e la sua correzione (`senzaZoneCitate` a macchina a stati,
    entrambi i recinti, recinto aperto = tutto spento) e' gia' scritta li'.
  - **MEDIUM — `## Deroghe` e' qualunque intestazione che contenga «deroghe», e
    un `###` non la chiude**: «Deroghe RESPINTE», «deroghe scadute» e una
    tabella sotto un `### Archivio` **raccolgono tutte la deroga come viva**
    (4 casi su 4).
  - **MEDIUM — la deroga declassa anche `accessibility` e non vuole nessuna
    firma**: la colonna «Confermata da» del template **non viene letta**, e una
    deroga vuota vale; `accessibility` 61 contro soglia 95 → `warn` → passo
    `pass`. Il template dichiara non derogabile l'accessibilita' **sotto la
    baseline**, e il gate la baseline non la legge affatto (unica occorrenza in
    un commento).
  - **MEDIUM — il contratto d'uscita e' l'unico dei quattro che non rifiuta i
    segnaposto `{{…}}`**: handoff con 5 segnaposto → nessun finding (gli altri
    tre gate lo bocciano). Il template di handoff di questa skill ne ha **53**:
    si consegna un modulo in bianco con una riga vera.
  - **MEDIUM — `attributo()` prende il primo `name=` del tag, `data-name=`
    compreso**: `<meta data-name="viewport" name="robots" content="noindex">` →
    `robots: null`, e una pagina esclusa dall'indice risulta pubblica. Stessa
    classe del difetto dichiarato chiuso nella docstring, per un'altra via.
  - **MEDIUM — `senzaSvg` cancella dal primo `<svg` (anche dentro un CSS) fino
    al `</svg>`** (`gate-lib.mjs:693`): un data-URI SVG in un `<style>` azzera
    `title`, `description` e `canonical` — tre `block` che accusano l'imputato
    sbagliato.
  - **MEDIUM — nidifica l'intero gate di flow-sentinel senza timeout** e ne
    legge **solo `esito.ok`**: il falso verde del gate figlio arriva qui senza
    attenuazione, e uno stallo produce due processi fermi e zero righe.
  - **LOW — `Gate: verde` minuscolo** produce un rosso strutturale nel solo
    speed-demon (regex `i`, confronto case-sensitive; gli altri tre normalizzano).
  - **LOW — il confine di `misuraStabile` non e' mai esercitato**: `>` → `>=`
    e **87/87 passano**. I casi di test hanno dispersione 38 e 2; la soglia 5 non
    la tocca nessuno.
  - **LOW (latente) — `trovaHandoff` ordina lessicograficamente**: **contraddetto
    dal verificatore** — con la convenzione scritta nel `CLAUDE.md`
    (`07-schema-forge.md`) ordina giusto fino a 99. Rompe solo con numeri senza
    zero. Resta vero che il gate non dice **quale** handoff ha letto.

  **Sorte**: tutti **dichiarati**, nessuno chiuso qui — ognuno vuole un test che
  lo falsifichi e il gate rimisurato su un'app viva, che questa chat non ha (D17).

- **2026-08-06 — P.7d: i rilievi del tribunale su questa skill sono CHIUSI, e il
  punto aperto n°7 (Lighthouse non fissato) con loro** (verbale con le uscite
  incollate: `../../PROCESSO-GATE-2026-08-06.md`). Ognuno riprodotto **prima** di
  correggere e rimisurato dopo. Batteria **87 → 103**, ESLint 0 (nemmeno un
  warning), knip 0, gitleaks 0, jscpd 1 clone invariato (5 righe) e dallo 0,32%
  allo 0,28%.
  - **H1 + L1 — CHIUSI.** Il filtro guardava i soli spazi: rifiutava l'unico caso
    che a volte funziona e lasciava passare i quattro che eseguono codice.
    Misurato su uno shim `.cmd` vero: `/&ver` **esegue `ver`** con status 0,
    `%USERNAME%` arriva **espanso**, `/|ver` fa sì che lo shim non parta affatto,
    `/>rubato.txt` **crea un file su disco**. E la precisazione che rovescia il
    filtro: l'argomento con spazi passa benissimo quando il percorso dello shim
    non ha spazi. Gli spazi **restano** rifiutati — restringere la regola su una
    differenza che dipende da dove è installato lo strumento sarebbe indebolirla.
  - **H4 — CHIUSO**, con due porte. `erroreDiPercorso` nel contratto (e la pagina
    **non entra nell'elenco**, perché il passo `misura` gira anche su contratto
    rosso) e `stessaOrigine(baseUrl, indirizzo)` prima di ogni giro di
    Lighthouse. Misurato: da «pagine lette: 2 · findings 0 · Lighthouse misura
    `https://example.com/`» a «pagine lette: **0** · findings **3**».
  - **H11 + H12 + M15 — CHIUSI, e con essi il punto aperto n°7.** Lighthouse è
    **13.4.1 dentro la skill**, lanciato con `process.execPath` e col suo limite:
    `npx --yes` scaricava un pacchetto non fissato a ogni giro e lo cercava prima
    nel `node_modules/.bin` del progetto misurato. Il `fetch` ha 20 s, il gate dei
    flussi annidato un tetto di 30 minuti. **Misurato contro un server che accetta
    e non risponde mai**: da *ucciso a 120 s con ZERO righe stampate* a **57,8 s
    con sette passi motivati e 19 righe**.
  - **C1 (condiviso) — CHIUSO, e qui in un modo che vale la pena scrivere.** Con
    Lighthouse nella skill e il gate dei flussi lanciato con `process.execPath`,
    **questo gate non cerca più nessun binario per nome**: esegue due percorsi
    pieni, e basta. La macchina di C1/H1 esce dal guscio e resta in `gate-lib.mjs`
    con i suoi test — la classe di guasto qui non esiste più per costruzione, non
    per cura. È la stessa conclusione che launchpad ha scritto per il proprio gate
    il 2026-08-06 (`5636373`).
  - **Restano aperti** → **tutti chiusi da P.7e** il 2026-08-06/07: M4, M9, M10,
    M11, M6, M7, L5, L13. Vedi la voce in fondo.
  - **MANCANTE, con il suo nome**: il gate **non è stato rimisurato su un'app
    viva** (D17: l'unico stack acceso è del pilota, di P.4h) — le prove sono su
    funzioni pure, su un progetto finto e sui due server costruiti apposta. Il
    giro completo, con Lighthouse che gira davvero, è l'atto di chiusura del
    prossimo pacchetto.
- **2026-08-06 — `gitleaks` installato e puntato: il MANCANTE storico e' chiuso
  (P.7c punto 5).** `gitleaks` 8.30.1 (scoop, bucket `main`). Su questi
  `scripts/`: **nessun rilievo**. Sul repo intero: **storia** (`gitleaks git .`,
  143 commit) **4 rilievi, 0 veri**; **disco** (`gitleaks dir .`, 179,72 MB)
  **26 rilievi, 0 veri** — tre su file tracciati, tutti e tre **fixture di
  rilevatori di segreti**, gli altri in artefatti non tracciati dei banchi
  (`.next/`, `.env.local`) con la chiave demo locale di Supabase
  (`iss: supabase-demo`). Nota misurata: `gitleaks git` trova il segreto **dove
  e' stato introdotto**, non dove il file sta oggi; `dir` guarda il disco.

## Cosa fa, in una riga

Misura un sito Web Gun gia' costruito e gia' testato, propone le ottimizzazioni
**col loro costo**, le applica una alla volta rimisurando e rilanciando la rete
E2E, e si rifiuta di consegnare se ha misurato una dev server, se la rete e'
rossa, se una soglia dichiarata non regge senza deroga scritta, o se una pagina
pubblica esce senza `title` unico, `description` e `canonical` proprio.

## I due collaudi

**Costruzione — 2026-07-30**, banco `banco-prova-negozio` (verbale
`COSTRUZIONE-2026-07-30.md`). Gate VERDE 7/7, batteria E2E rilanciata dalla
skill e verde contro la build di produzione, **tre difetti SEO veri** trovati su
un progetto dove Lighthouse dichiarava SEO 100, sabotaggio sulla dev server
rosso con i due indizi stampati, **quattro difetti della skill** trovati e
corretti.

**Collaudo avversario — 2026-07-30**, banco `banco-prova-immobiliare` (verbale
`COLLAUDO-AVVERSARIO-2026-07-30.md`). Sessione separata, dominio nuovo, pagine
genuinamente lente. **Diciassette difetti**, tutti misurati prima di essere
corretti, tutti con test di regressione:

- **dodici falsi verdi**, fra cui `seo-meta` che chiudeva OK su quattro pagine di
  cui tre rotte (una senza `title` — quello letto era il `<title>` di un'icona
  SVG —, una col `canonical` che puntava alla home, una che rimandava altrove e
  di cui il gate leggeva e misurava un'altra pagina);
- **quattro rifiuti indebiti**, tutti dello stesso ceppo: **il gate non sapeva
  leggere il contratto che il suo template insegna a scrivere**, e rifiutava
  perfino una firma umana con nome e ruolo;
- **uno che misurava col profilo sbagliato in silenzio**: il contratto dichiarava
  desktop, il gate usava mobile. Sulla stessa build sono 14 punti di differenza e
  un'intera metrica che in un profilo esiste e nell'altro no (TBT 478 ms / 0 ms);
- **sei difetti su diciassette erano gia' descritti dentro le references della
  skill** (`seo.md` §296, §309, §313, §119 · `misurazione.md` §211, §256) e non
  erano implementati. La prosa sapeva, il codice no.

Il diciassettesimo non e' stato cercato: si e' presentato mentre si rilanciava il
gate corretto sul banco vecchio, ed e' il piu' grave. La porta 3100 — quella che
il contratto firmato di `banco-prova-negozio` dichiara nel suo `Comando:` — su
questa macchina era occupata dal sito di **un'altra azienda**. `--url`
obbligatorio impedisce al gate di *indovinare* la porta, non di *sbagliarla*, e
la porta sbagliata veniva da un documento firmato. Il passo `build-produzione`
ora pretende di trovare il `.next/BUILD_ID` del progetto nell'HTML servito.

E la prima esecuzione vera di `plan` e `tune` su guadagni misurati: home
`performance 77 → 100` (LCP 5 496 → 746 ms, peso 6,31 → 0,47 MB), `/immobili`
`75±8 → 100±0` e `seo 92 → 100` (LCP 13 543 → 582 ms, peso 15,25 → 0,43 MB).

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 8 | `verify.mjs --json`, `summary.passi` |
| Test degli script | **103 verdi** (73 al collaudo, +2 con P.0-igiene il 2026-08-03, +11 sciogliendo la `complexity 19` di `verify.mjs` — P.7c punti 1-2, `a6f6d1e`; +1 col test junction di P.0-igiene-2 il 2026-08-04, che fanno 87; **+16 con P.7d il 2026-08-06 sera**: 103/103, 0 fail) | `node --test "scripts/**/*.test.mjs"` |
| References | 3 | `misurazione.md` · `ottimizzazioni.md` · `seo.md` |
| Template | 2 | `performance.md` (il contratto) · `handoff-speed-demon.md` |
| Banchi su cui il gate e' girato | **2** | `banco-prova-negozio` · `banco-prova-immobiliare` — **cancellati dal disco il 2026-07-30** (`../../DECISIONI.md` §25): tornano con `git checkout 67f9001 -- <banco>` |
| Difetti dell'app trovati | 3 (negozio) + 4 (immobiliare) | handoff 15 §2 · handoff 01 §1 |
| Difetti della skill trovati dai collaudi | 4 + **17** | i due verbali |

## Punti aperti — ordinati per gravita'

> **CHIUSO il 2026-08-04 (P.0-igiene-2) — il gate parla anche dalla junction.**
> Era: invocato come `.claude/skills/speed-demon/scripts/verify.mjs` il gate usciva
> **0 senza stampare una riga**, mentre per percorso reale usciva 2 col messaggio
> (misura di P.4-pre, `../../PILOTA-PRE-2026-08-04.md` §2b). Causa:
> `resolve(process.argv[1])` normalizza il percorso ma non scioglie una junction,
> mentre `import.meta.url` è già canonico — guardia falsa, `main()` mai chiamata.
> Ora l'epilogo confronta **due volte** (testuale e `realpathSync`, con ricaduta
> sul testuale se `realpathSync` solleva), ed è la forma che l'`hint` della regola
> `epiloghi-vivi` prescrive da oggi. Commit `257e34d` (guardia), `e6deb39`
> (`hint`), `c96ae00` (test).
>
> **Misura del 2026-08-04**, node di sistema 20.12.2, cartella vuota fuori
> dall'albero: **entrambi i canali escono 2** con lo stesso messaggio, carattere
> per carattere — `Nessuna cartella docs/ in <cwd>: lancia il gate dalla radice del
> progetto.` Uscite incollate in `../../IGIENE2-JUNCTION-2026-08-04.md` §1. **Cade
> il vincolo provvisorio di D12**: i gate si lanciano da **entrambi** i canali,
> junction compresa — che è come li vede una chat aperta sul repo di un progetto
> generato.
>
> **`AGENTI_DIR` dalla junction: la domanda ha una risposta, ed è «regge».** P.4-pre
> l'aveva lasciata «aperta e non misurabile» perché il gate non partiva. Misurata
> oggi (verbale §5): su una cartella con `docs/flussi-critici.md`, il gate lanciato
> dalla junction e quello lanciato per percorso reale stampano un'uscita **identica
> riga per riga**, passo `rete-verde` compreso — `gate flussi: ROSSO (1 falliti, 6
> mancanti su 7 passi)`, gli stessi numeri che flow-sentinel dà lanciato a mano
> sulla stessa cartella. Il motivo è nel codice: `SKILL_DIR` nasce da
> `import.meta.url`, che Node canonicalizza anche quando l'invocazione non lo è, e
> `AGENTI_DIR`/`GATE_FLUSSI` ne discendono. Non diventa mai `.claude/skills`.
>
> Regressione piantata: un terzo test invoca il gate **attraverso una junction
> vera** e pretende uscita ≠ 0 e output non vuoto; statico e funzionale sono ciechi
> a questo difetto, provato col sabotaggio (verbale §4).

1. **Nessun committente ha mai firmato l'elenco delle pagine.** Su tutti e due i
   banchi la riga `Confermato da:` l'ha scritta chi costruiva o chi collaudava.
   Il gate legge la firma, non la sua verita': una baseline impeccabile sulle
   pagine sbagliate passa il gate ed e' comunque da buttare. E' il punto che
   nessun collaudo puo' chiudere, perche' si chiude con un cliente.
2. **La riga `Tipo:` del contratto non la legge nessuno.** Il gate tratta ogni
   pagina dichiarata come pubblica: su una rotta `autenticata` pretende
   `canonical` e considera un difetto il suo `noindex`, che invece e' la cosa
   giusta. Finche' e' cosi', le rotte autenticate vanno dichiarate fra le pagine
   escluse — il template ora lo scrive — e la reattivita' del backoffice resta
   **non misurata**. Dedotto dal codice, non riprodotto: nessuno dei due banchi
   ha una pagina autenticata nel contratto.
3. **Nessun passo verifica che le pagine escluse siano davvero escluse.** Il
   contratto dichiara `/admin/*` fuori misura e fuori indice, e il gate legge la
   dichiarazione senza controllarla. Su `banco-prova-negozio` si e' scoperto a
   mano che il `noindex` di `/admin` **non arriva a nessun crawler** perche' la
   guardia reindirizza prima.
4. **Nessun passo su `sitemap.ts` e `robots.ts`.** Il gate controlla i metatag di
   pagina e ignora i due file che dicono a un motore di ricerca cosa esiste.
5. **`semgrep` e `gitleaks` sono passati di qui il 2026-08-06** (3 rilievi 0 veri
   il primo, **nessun rilievo** il secondo — §2026-08-06). Resta MANCANTE una
   striscia sottile e vera: su `gate-lib.mjs` semgrep si e' fermato al **99,7%
   delle righe**, e quello 0,3% non l'ha guardato nessuno. **`code-inquisition` e'
   stato eseguito il 2026-08-06**: quattordici difetti, quattro HIGH, nessuno dei
   quali visto da ESLint, semgrep, gitleaks o dagli 87 test (§2026-08-06).
   La riga precedente dichiarava mancante anche semgrep, ed era
   falsa gia' quando e' stata scritta — `schema-forge/STATO.md` l'aveva misurato
   presente due giorni prima. Il collaudo avversario ha fatto crescere
   `gate-lib.mjs` e `verify.mjs`, quindi c'e' piu' codice mai passato ai guardiani
   di prima.
6. **Nessuna misura di campo.** Lighthouse e' un laboratorio. CrUX e RUM sono
   un'altra cosa e questa skill non li guarda.
7. **L'ambiente di misura si dichiara, non si verifica.** *(Numero in coda per
   non spostare le citazioni degli altri punti; per gravita' starebbe subito
   dopo il n°2.)* Due regole scritte nelle references non esistono nel codice, ed
   e' lo stesso ceppo dei sei difetti che il collaudo avversario ha trovato
   proprio cosi'. La prima: `references/misurazione.md` prometteva «o `CHROME_PATH`
   e' impostata, o il passo e' `MANCANTE`» — `verify.mjs` non legge mai
   `process.env.CHROME_PATH`, quindi due giri possono partire con due Chrome
   diversi e il gate non se ne accorge. La seconda: la stessa reference prescrive
   Lighthouse **bloccato a una versione esatta** nella cartella della skill, come
   ESLint per Flow Sentinel; in `agenti/speed-demon/` non c'e' nessun
   `package.json` e il passo lancia `npx --yes lighthouse`, cioe' quello che
   trova. I pesi delle categorie cambiano fra versioni maggiori: due misure di
   giorni diversi possono differire per il lavoro fatto o per lo strumento, e
   oggi il gate non sa dire quale delle due. Le due righe sono state corrette per
   dire il vero il 2026-07-30; il controllo che le renderebbe verificabili non
   c'e'.
8. **Il guadagno di `next/image` e' misurato su rumore, non su fotografie.** Le
   immagini di `banco-prova-immobiliare` sono pixel casuali con seme fisso:
   incomprimibili per costruzione, quindi il guadagno viene quasi tutto dal
   ridimensionamento e dalla compressione con perdita. Su foto vere la
   ripartizione fra le due cause e' diversa; la direzione no.
9. **Il passo `misura` verifica che Lighthouse ESISTA, non che possa girare.**
   Misurato sul pilota `fornodoro` il 2026-08-06 (`PILOTA-2026-08-06.md` §4):
   l'audit `canonical` di Lighthouse 13.4.1 chiama `URL.parse`, aggiunta in
   **Node 22**. Lanciato col node di sistema 20.12.2 — che e' il node con cui il
   `CLAUDE.md` dei progetti generati prescrive di lanciare i gate — quell'audit
   non emette un rilievo: va in **errore**, e l'errore porta l'**intera
   categoria SEO a `null`**. Stessa build, stesso Chrome: `seo: null` col node
   di sistema, `seo: 100` col Node 24. Il gate si comporta bene a valle (mappa
   `null → null` e chiude **rosso** con «soglia dichiarata per `seo` e nessuna
   misura»), quindi **non e' un falso verde** — ma nomina la categoria invece
   della causa, e chi legge va a cercare un difetto nel sito. Due aggravanti:
   **(a)** il difetto si accende **solo quando in pagina esiste un
   `<link rel="canonical">`**, cioe' solo dopo che la skill ha fatto il proprio
   lavoro — sui progetti senza canonical l'audit esce `notApplicable` e non si
   vede niente; **(b)** e' lo stesso ceppo del punto 7: una premessa
   dell'ambiente che si assume invece di misurarla. Il rimedio sta a monte del
   passo — lanciare Lighthouse con un node dichiarato, o rifiutarsi di girare
   sotto il minimo — non nel messaggio d'errore. Sul pilota e' registrato come
   `docs/DEBITO-TECNICO.md` n°31, con la deroga alla riga del `CLAUDE.md`
   dichiarata in quattro posti.
10. **`seo-meta` non guarda l'HOST del `canonical`.** Conta i canonical, ne
    pretende l'unicita' e verifica che due pagine non se lo dividano — tutte
    regole giuste. Ma **cinque canonical verso `http://127.0.0.1:3621` sono
    cinque canonical unici**, e il passo chiude verde su un sito che sta dicendo
    a ogni motore di ricerca «l'originale di questa pagina sta a un indirizzo che
    nessuno al mondo puo' raggiungere». Trovato dal tribunale sul pilota
    `fornodoro` (`PILOTA-2026-08-06.md` §5, rilievo MET-1) e confermato dal
    Verificatore contro l'app viva. E' il difetto piu' probabile di tutta la
    famiglia SEO, perche' il ripiego a un indirizzo locale e' esattamente cio'
    che fa un progetto non ancora deployato: il gate e' verde durante tutta la
    costruzione e resta verde il giorno del rilascio. Non basta confrontare con
    l'`--url` misurato (in locale coinciderebbero): serve che il contratto possa
    dichiarare il **dominio pubblico atteso**, distinto dall'indirizzo su cui si
    misura, e che il passo confronti i due.

## Punti chiusi dai collaudi

- **«Un solo banco, e l'ho scritto io»** (ex punto 1) — chiuso dal collaudo
  avversario: secondo banco, dominio diverso, sessione indipendente, e `plan` e
  `tune` finalmente esercitati su un guadagno vero.
- **`rete-verde` mai visto funzionare** — **chiuso**, e in tutt'e due i versi. Il
  gate corretto rilanciato su `banco-prova-negozio` chiude `rete-verde` **OK**
  con «gate flussi: VERDE (0 falliti, 0 mancanti su 7 passi)»; puntato sull'app
  sbagliata lo stesso passo diventa **FAIL** con «gate flussi: ROSSO (2
  falliti)». La delega a Flow Sentinel non e' piu' verificata per lettura: e'
  stata vista funzionare e vista fallire.
- **Nessuna regressione sul banco vecchio** — il gate corretto chiude **VERDE
  7/7** su `banco-prova-negozio`, che col gate precedente chiudeva 7/7. Le regole
  nuove non hanno prodotto nessun falso rosso li', e una ha prodotto un `warn`
  vero: la deroga su `accesso · seo` non copriva piu' niente.
- **«`--giri 3` e' il minimo, e la soglia di dispersione non e' mai stata messa
  alla prova»** (ex punto 3) — chiuso a meta'. La soglia ora si legge dal
  contratto (il ripiego e' 5, come dice `misurazione.md`, non 10 come prima) ed
  e' scattata davvero: `/immobili` ballava di 8 punti. Si e' anche scoperto che
  la dispersione non parla solo della macchina — parla anche di una pagina
  troppo pesante per riprodursi: dopo `next/image` e' scesa a 0. La taratura per
  macchina resta da fare.
- **«`best-practices` si ferma a 96 e nessuno sa perche'»** (ex punto 4) —
  **chiuso, misurato**: audit `errors-in-console`, peso 1, un `404` su
  `/favicon.ico`. Aggiunta l'icona, la categoria e' passata a 100 su due pagine
  su tre. La terza si e' fermata a 96 per un'altra causa, anch'essa misurata: tre
  `<Link>` che precaricano una rotta di dettaglio **che non esiste**, tre `404`
  in console. Ha prodotto una correzione al catalogo
  (`references/ottimizzazioni.md` §11), che dichiarava che il prefetch «costa al
  server, non al punteggio». La stessa assenza di favicon c'e' su
  `banco-prova-negozio`, che infatti misura 96: e' lavoro di **site-doctor**, non
  di questa skill, ed e' il primo posto dove guardare quando quella categoria si
  ferma appena sotto il massimo.

- **2026-08-06/07 — P.7e: la delega §D21, gli otto residui del referto, e il gate passa a otto passi. Verbale: `../../PROCESSO-GATE-2-2026-08-06.md`.** Batteria **103 → 144**. ESLint 0, knip 0, semgrep 0, gitleaks 0.
  - **§D21 `contrasti` — ONORATA, ed era una delega che non esisteva nel codice.** Al 2026-08-06 la parola `contrast` compariva in **zero file** di questa skill: il gate leggeva `report.categories.accessibility.score` e non apriva mai l'audit. Lighthouse pesa `color-contrast` insieme ad altri venti audit dentro `accessibility`, quindi un sito con contrasto insufficiente perde qualche punto su cento e supera qualunque soglia. Misurato sulla forma vera di un report: **categoria 98 contro soglia 95 → nessun rilievo, passo verde; lo stesso report con `color-contrast` a 0 → block con i tre selettori**. La fixture è quella e il punto è quello: una in cui falliscono entrambi non prova niente. Passo nuovo `contrasto`, quattro stati (`notApplicable` non è un successo, un audit non prodotto è MANCANTE), `SKILL.md` aggiornata perché **il numero dei passi è un contratto**.
  - **M10 — CHIUSO, in due metà.** La prima: il template ha sei colonne e la sesta è `Confermata da`, e il gate leggeva la riga con quella cella **vuota** — bastava aggiungere una riga a una tabella per togliere una soglia. Ora una deroga senza firma non è una deroga, e non si scarta in silenzio. La seconda: **la baseline stava nella stessa riga che il gate già analizzava** — terza colonna — e nessuno la leggeva, quindi «non ci si arriva» e «si è peggiorato» erano lo stesso caso. Misurato su `accessibility` 61 contro soglia 95 con deroga firmata: **baseline 96 → BLOCK «è una regressione» · baseline 40 → WARN, la deroga vale · baseline non dichiarata → BLOCK**, perché senza la baseline il gate non sa quale dei due casi sta autorizzando e «non lo so» non è «va bene».
  - **M4 — CHIUSO.** Markdown ha due recinti e il gate ne conosceva uno: lo stesso esempio con ``` dava `pagine = []` e con `~~~` dava `pagine = ["esempio"]`, firma d'esempio compresa. Arriva la funzione di flow-sentinel, non una nuova.
  - **M9 — CHIUSO.** `## Deroghe` era qualunque intestazione che contenesse la parola, e un `###` non la chiudeva: **quattro forme su quattro** raccoglievano una deroga morta come viva («Deroghe RESPINTE», «Storico delle deroghe scadute», un `### Archivio`). Ora 1 su 4.
  - **M11 — CHIUSO.** Era l'unico dei quattro gate della casa a non rifiutare i `{{…}}`, e il suo template di handoff ne ha **131** (il referto ne contava 53: è cresciuto). Si contano **dopo** `senzaZoneCitate`, perché uno snippet CI dentro un recinto non è un segnaposto rimasto.
  - **M7 + M6 — CHIUSI insieme, e si misurano insieme.** Una pagina con un'icona SVG di sfondo in un data-URI dentro `<style>` — cioè una cosa che scrive Tailwind da solo — più un `<meta data-name="viewport" name="robots" content="noindex">`: **PRIMA title, description, canonical e robots tutti `null`; DOPO i quattro valori veri.** Tre `block` sull'imputato sbagliato e, nel verso peggiore, un `noindex` cancellato. `senzaSvg` è ora uno scanner che sa dove si trova, e ciò per cui esiste regge: il `<title>` di un'icona accessibile continua a non passare per il titolo della pagina.
  - **L5 — CHIUSO** (`.toUpperCase()`, come nelle tre sorelle: `Gate: verde` non fa più chiudere rosso un handoff giusto). **L13 — CHIUSO**: il difetto ERA l'assenza di rete sul confine di `misuraStabile`, e ora ci sono tre test. **L15 — CHIUSO**: `trovaHandoff` confronta il numero come numero.
  - **MANCANTE, con il suo nome**: il gate **non è stato rilanciato dopo queste correzioni**. La direzione lo ha rilanciato contro il pilota vivo il 2026-08-06 sera, a regia `d147f52`, e chiudeva **VERDE 7/7** su cinque pagine con tre giri — ma quella misura è **prima** dell'ottavo passo. Il rilancio di chiusura è della direzione: il pilota e il suo stack sono di un'altra chat in questa ondata.

