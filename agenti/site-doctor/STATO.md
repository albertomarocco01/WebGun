# Stato — Site Doctor

- **P.6-P5 consegnata il 2026-08-07 (sera)** — dieci punti del mandato, tutti
  eseguiti: **11 rilievi del tribunale di P.6-P4 chiusi con un test** (i dieci
  chiesti piu' P3-R2, che era da dichiarare ed era la stanza accanto), ognuno
  riprodotto prima e falsificato contro `git show HEAD:` — 15 test nuovi rossi
  sull'originale. I capitali: l'**iframe invisibile** (P7-R2: la camminata ora
  legge l'inventario dei riferimenti navigabili), le **porte dell'amputazione**
  (P1-R2/R3: via il tetto dei 32 KB e l'apice trattato da stringa — Chromium
  `--dump-dom` come giudice), il **formaction** e il **form annidato**
  (P3-R1/R2), la **`<sitemapindex>`** riconosciuta (P4-R4+P7-R3, il formato di
  Next), `livelliTitoli` sui **visibili** (P4-R6), la **quadratica di
  `DENTRO_TAG` chiusa in tutti i lettori** (P2-R1: 11,5 s → 0,2 ms a 256 KB;
  P2-R8 rimisurato) e la **scadenza che sorveglia anche la CPU** (P2-R2:
  13 s → 8 s su scadenza 8). `contrasti` e' uscita da `SCOPERTE` **rilanciando
  il grep** (4 file, gate del vicino col passo `contrasto`): il banco chiude
  «2 da guardare». Batteria **285 → 308**, giro **43 classi** (con `SUP5`,
  l'iframe del perito) e **`giro-costruttore` eseguito per la prima volta** —
  che ha trovato il certificato del banco del costruttore fermo all'era
  pre-D21: il conforme usciva ROSSO per il motivo giusto, corretto. Verbale:
  `P6-P5-2026-08-07.md`.
- **P.6-P4 consegnata il 2026-08-07** — i tre MANCANTI onesti di P.6-P3, tutti
  eseguiti. **Il tribunale sulle ~900 righe nuove: otto periti, 61 rilievi**, e
  di nuovo ESLint · knip · jscpd · gitleaks · batteria **tutti verdi** mentre i
  61 erano vivi (ottava convocazione su otto skill, ottava volta così). **Cinque
  chiusi con un test, 56 dichiarati** uno per riga in `P6-P4-2026-08-07.md` §6.1.
  Il roster-critic ha trovato un buco **prima** di spawnare — nessuno copriva la
  superficie e l'identità — e da quell'ottavo perito è uscito il rilievo più
  grave: **gate VERDE, uscita 0, su un sito che raccoglie IBAN e codice fiscale
  in una pagina che il gate non apre mai**. `code-maniac scan` eseguito **per la
  prima volta** (3 PASS · 4 MANCANTE · 3 ISSUE). **D25 fatta**: i quattro
  sorgenti del banco sono tracciati in `scripts/`, e il gate ci chiude **VERDE
  14/14 da un percorso tracciato, due corse su due**, con sette classi di
  sabotaggio su otto rosse. Batteria **264 → 285**. Verbale:
  `P6-P4-2026-08-07.md`.
- **Stato attuale: P0+P1+P2 CONSEGNATE il 2026-08-06.** Il gate esiste, ha
  **nove passi** e **quattro stati**, chiude **VERDE 8/8 + 1 NON APPLICABILE**
  sul banco conforme, **VERDE 9/9** sul banco bilingue del collaudo, e **ROSSO
  su 25 classi di sabotaggio su 25** più **25 su 32** delle classi nuove. Sul
  pilota `fornodoro` esce **ROSSO (4 falliti, 3 verifiche mancanti su 9,
  identità dell'app confermata) per cinque motivi veri che nessuno dei cinque
  gate esistenti vede**. **168 test verdi.** Verbali:
  `COSTRUZIONE-2026-08-06.md` e `COLLAUDO-2026-08-06.md`.
- **Il collaudo avversario indipendente (P2) è stato fatto** il 2026-08-06 in
  chat vergine, su un banco **studio legale bilingue**: **quattordici difetti
  misurati, corretti e chiusi con un test**, dodici commit, batteria **144 →
  168**. I due più gravi:
  - **una chiave universale nuova che costa UN tag**: `</script>` veniva letta
    come apertura e il ripulitore amputava il documento fino alla fine. Effetto
    misurato: `dati-raccolti` chiude **`NON APPLICABILE` — «zero moduli e zero
    campi»** su un sito che raccoglie nome, email, telefono e PEC. È il punto
    aperto n°12 del costruttore avverato alla lettera;
  - **sette deleghe su nove erano vuote**, `favicon` e `open-graph` comprese.
    La parola «contrast» non compare in nessun file di speed-demon; `sitemap`,
    `og:`, `favicon`, `application/ld` hanno **zero occorrenze** nel suo gate.
    **La skill nata dalla favicon a 404 la delegava a un gate in cui quella
    parola non compare**: il difetto non era corretto, era spostato di un
    livello.
- **Il tribunale ha trovato 33 rilievi**, e gli strumenti statici erano **tutti
  verdi** su tutti e 33. Il piu' grave apriva **tutti e nove i passi insieme**:
  in HTML un `<!--` dentro il valore di un attributo e' testo, non l'apertura di
  un commento, e il ripulitore a regexp non lo sapeva — due `<div>` invisibili
  facevano sparire dal documento che il gate giudica immagini senza `alt`, campi
  che raccolgono dati personali, terzi non dichiarati e collegamenti. Chiuso con
  un ripulitore a una scansione, che ha chiuso anche un costo **quadratico**
  (200 KB di `<` ripetuti: 24,6 s → 16 ms). **26 rilievi chiusi con un test,
  5 aperti e scritti qui sotto, 1 accettato, 1 rimandato alla regia.**
- **Non ancora usabile su un progetto cliente**, e il motivo non è più il
  collaudo: è **P3**, cioè un certificato firmato da un committente vero e non
  per delega. Il collaudo avversario c'è stato e ha trovato **quattordici**
  difetti — lo stesso numero di vetrina-crafter, che era la più curata. Il
  rapporto completo del costo di D17 (P0+P1 uniti, senza la revisione del
  direttore in mezzo) è ora **8 → 3 → 33 → 14**: autorevisione, sabotaggio,
  tribunale, collaudo indipendente.
- **Il tribunale non è stato riconvocato sul codice cambiato** dal collaudo, ed
  è **MANCANTE**, non PASS: è la prima cosa da fare su questa skill.
- **Proprietario:** Alberto
- **Dipendenze:**
  - **A monte:** l'intera catena costruttiva — **schema-forge**,
    **vetrina-crafter**, **gestionale-crafter**, **flow-sentinel**,
    **speed-demon**. Non perché ne consumi i dati, ma perché il **perimetro** si
    compila leggendo i loro handoff: senza, «lo guarda un altro» resta una frase.
    **cyber-shield** è a monte sulla carta e **non esiste**: la voce che
    coprirebbe resta dichiarata **scoperta**.
  - **A valle: launchpad**, che **non pubblica senza `docs/conformita.md`
    firmato e con la riga `Gate: VERDE`**. Il certificato è il suo ingresso, ed è
    il motivo per cui questa skill sta alla fine della catena.

## Cosa fa, in una riga

Emette il certificato di idoneità di un sito prima del lancio: misura ciò che
riguarda chi lo visita e non ha firmato niente — informativa privacy, dati
raccolti dai moduli pubblici, cookie e archiviazione nel browser, accessibilità
dell'HTML servito, lingua e hreflang — e pretende che tutto il resto sia
dichiarato **con il nome del proprietario e il file che lo dice**.

## Piano P0 → P3

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione: `SKILL.md`, perimetro, specifica del gate a nove passi scritta **prima** del flusso, i quattro stati | qui | **fatta il 2026-08-06**, dentro lo stesso pacchetto di P1 (D17) — **senza revisione del direttore in mezzo**: è il costo dichiarato dell'unione |
| P1 | costruzione: references, `scripts/`, banco, guardiani, sabotaggio, gate rosso sul pilota per motivi veri | qui | **fatta il 2026-08-06**. Verbale `COSTRUZIONE-2026-08-06.md` |
| P2 | collaudo avversario indipendente in **chat vergine**, dominio diverso: caccia ai falsi verdi dei nove passi | chat vergine (chi costruisce non collauda) | **fatta il 2026-08-06** su un banco **studio legale bilingue**. Verbale `COLLAUDO-2026-08-06.md`: 14 difetti, 12 commit, batteria 144 → 168 |
| P.6-P3 | il **tribunale sul codice cambiato**, D21 (cinque voci tornate a casa) e `--scadenza` | qui | **fatta nella notte fra il 2026-08-06 e il 07**. Verbale `P6-P3-2026-08-06.md`: 48 rilievi su sei periti, gate 9 → 14 passi, batteria 168 → 264 |
| P4 | primo consumatore reale con un certificato firmato da un **committente**, non per delega | pacchetto di catena | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come è stato misurato |
|---|---|---|
| Test degli script | **308 verdi** | `npm test` (Node 24.19.0; le batterie vogliono Node 21+) |
| Passi del gate implementati | **14**, con `id` stabili e ordine bloccato da un test | `scripts/verify.mjs`, `ID` |
| Stati del verdetto | **4** (`pass` · `fail` · `skipped` · `n/a`) | `riepilogo()`, con i test dei tre casi |
| Voci di conformità nell'elenco | **16** — **11 mie**, 3 delegate, 2 scoperte/parziali, 1 scoperta | `conformita-lib.mjs`, `VOCI` |
| Deleghe misurate **vuote** | **0** + 1 parziale (`accessibilita-admin`) — era 7 su 9 prima di D21, poi 1+1; `contrasti` e' uscita il **2026-08-07 rilanciando il grep** (4 file sulla regia a `a1454cf`: il gate di speed-demon ha il passo `contrasto` che legge il singolo audit) | `SCOPERTE` in `conformita-lib.mjs`, col commit della regia accanto |
| Rilievi del **tribunale** della costruzione | **33** — 26 chiusi con un test | `COSTRUZIONE-2026-08-06.md` §6.6 |
| Difetti trovati dal **collaudo avversario** (P2) | **14**, tutti chiusi con un test | `COLLAUDO-2026-08-06.md` |
| Rilievi del **tribunale di P.6-P3** (sei periti su `scripts/`) | **48**, con ESLint · knip · jscpd · batteria **tutti verdi** | `P6-P3-2026-08-06.md` §1-2 |
| Rilievi del **tribunale di P.6-P4** (otto periti sulle ~900 righe di P.6-P3) | **61**, di cui **5 chiusi** e **56 dichiarati aperti** — di nuovo con ESLint · knip · jscpd · gitleaks · batteria **tutti verdi**. Ottava convocazione su otto skill, ottava volta così | `P6-P4-2026-08-07.md` §1-2 e §6.1 |
| Classi di sabotaggio del collaudo | **43** (con `SUP5`, l'iframe di P7-R2): **32 rosse sui passi giusti, 11 verdi dichiarate**. Il conteggio storico «32 rosse, 10 verdi» era un errore d'aritmetica del riepilogo di P.6-P3 §7.4 — la sua stessa tabella elenca 31+11 — propagato a due verbali e scoperto rilanciando **tutte** le classi (P.6-P5) | `scripts/banco-sl.mjs` + `scripts/giro.mjs`, **tracciati** (D25); giro completo il 2026-08-07 |
| Classi di sabotaggio del costruttore | **25 su 25 rosse sul loro passo + conforme VERDE** — `giro-costruttore.mjs` **eseguito per la prima volta** il 2026-08-07: ha trovato il certificato del banco fermo all'era pre-D21 (conforme ROSSO su `perimetro` per il motivo giusto), corretto in questo pacchetto | `scripts/banco.mjs` + `scripts/giro-costruttore.mjs` |
| Scadenza complessiva | **300 s**, estrapolati da una pendenza misurata (20,2 ms per ms di RTT, 19 richieste su 10 pagine) | `P6-P3-2026-08-06.md` §4.1 |
| Comandi esercitati | **3 su 5** (`perimetro`, `scansiona`, `verify`) — `certifica` e `handoff` **non** esercitati su un progetto vero da questa skill: il pilota è di sola lettura | verbali |
| Regole pure | 2 librerie | `servito-lib.mjs` · `conformita-lib.mjs` |
| Gusci di I/O | 2 | `verify.mjs` · `banco.mjs` |
| References | **5** | |
| Guardiani | ESLint **0 errori** / 24 avvisi (21 di P.6-P4 piu' tre da P.6-P5: `leggiTag`, `collegamentiInterni`, `destinazioniModuli` — elenchi di stati e di porte, stessa ragione dei sei di D21) · knip **pulito** · jscpd **0 cloni** · `gitleaks` **pulito sulla skill** (`no leaks found`) · `semgrep` di P.6-P4 riconfermati, **zero `nosemgrep`** — P2-R12 resta della stessa natura: la ricerca della chiusura ora e' per prefisso ma interpola ancora il nome del tag, che viene da un estrattore vincolato (`[a-zA-Z][a-zA-Z0-9-]*`, nessun metacarattere possibile) | eseguiti a chiusura di P.6-P5 |
| `code-maniac scan` | eseguito **per la prima volta** il 2026-08-07: 10 passi — **3 PASS** (eslint, knip, jscpd), **4 MANCANTE** (`prettier` non installato · `tsc` non configurato, la skill è ESM puro · `convenzioni` non installato · `depcruise` non installato), **3 ISSUE** (complessità 28 hotspot · semgrep 5 · gitleaks 5, **nessuno di questa skill**) | `P6-P4-2026-08-07.md` §4 |

## Cosa un gate verde NON prova

Per intero in `SKILL.md` §Cosa un gate verde NON prova. Le tre che contano di
più:

1. **Che il sito sia conforme al GDPR.** Prova che l'informativa esiste, è
   raggiungibile, nomina le voci dell'art. 13, e che ogni campo raccolto ha una
   base giuridica **scritta**. Non che sia quella giusta. Questo gate rende
   impossibile *dimenticarsene*, non superflua la firma di chi risponde.
2. **Che la superficie scoperta sia tutta la superficie.** Si cammina dai
   collegamenti e dalla `sitemap.xml`. Una pagina che nessuno linka non entra —
   e sul pilota è il caso di `/ordine/<codice>`, che resta fuori **anche** da
   qui, non solo dalla misura di speed-demon.
3. **Che il proprietario dichiarato abbia fatto il suo lavoro.** Il confine si è
   spostato due volte. Il passo `perimetro` prova che la voce è assegnata a **uno
   solo** e che il file citato esiste e la **nomina**; il collaudo P2 ha aggiunto
   che *se il vicino abbia un passo del gate che la guarda* non è comprensione di
   un testo — è codice, e si legge; **D21** ha tratto la conseguenza e ha
   riportato a casa cinque deleghe. Quello che resta non provato è solo che chi
   ha ancora una delega l'abbia poi **eseguita su questa build**: quello lo dice
   la riga «i gate dei vicini sono verdi sulla stessa build», ed è lavoro
   dell'agente.
4. **Che il gate abbia finito.** Dal 2026-08-06 finisce sempre — `--scadenza`,
   default 300 s — ma un giro scaduto ha `skipped` dove non ha guardato, e un
   `skipped` **non è un pass**. Il `--json` porta `scaduta` apposta.

## Punti aperti — ordinati per gravità

**Chiusi da P.6-P3 (notte 2026-08-06 → 07)**, e vale la pena dire quali: il
**n°1** (il tribunale, convocato per primo: 48 rilievi su sei periti), il **n°2**
(cinque delle sette deleghe vuote sono tornate a casa con D21, e le scoperte sono
tre), il **n°4** (`--scadenza`, con un default estrapolato da una pendenza
misurata), il **n°5** (`MAX_CORPO` = 8 MB, e un corpo oltre il tetto è una pagina
NON LETTA, non una pagina vuota), e il **n°7** (`--json` ha un secondo
consumatore, e ne è uscito con due campi in più: `scadenza` e `scaduta`).

**Chiusi dal collaudo P2 del 2026-08-06**: il n°1 di allora (il collaudo stesso),
il n°2 (`certifica` e `handoff` eseguiti come comandi su un progetto vero), il
n°3 (l'informativa in bozza generata), e il **n°12** — le premesse dei `NON
APPLICABILE` fatte su un documento amputabile.

**Chiusi da P.6-P4 (2026-08-07)**: il **n°1** di allora (il tribunale, convocato
per primo: **otto periti, 61 rilievi**), il **n°2** (`code-maniac scan` eseguito
per la prima volta, esito per intero qui sopra e in `P6-P4-2026-08-07.md` §4) e
il **n°6** (D25: i quattro sorgenti del banco sono tracciati in `scripts/`, e il
gate ci chiude VERDE 14/14 da un percorso tracciato, due corse su due).

**Chiusi da P.6-P5 (2026-08-07, sera)**: **11 dei 56 rilievi** (P7-R2, P1-R2,
P1-R3, P3-R1, P3-R2, P4-R4, P4-R6, P7-R3, P2-R1, P2-R8, P2-R2 — ognuno
riprodotto prima, falsificato contro `git show HEAD:`, con la domanda della
porta diversa nel verbale), la voce **n°3 per metà** (`contrasti` fuori da
`SCOPERTE` col grep rilanciato) e il **n°6 per intero** (giro 43/43 e
`giro-costruttore` eseguito). Verbale: `P6-P5-2026-08-07.md`.

1. **Quarantacinque dei 61 rilievi del tribunale restano aperti**, riprodotti e
   dichiarati uno per riga in `P6-P4-2026-08-07.md` §6.1 con dove, cosa e verso
   (11 chiusi da P.6-P5: la fotografia viva sta nel verbale P.6-P5 §5). I
   più pesanti fra quelli che restano:
   - **`<title>` è RCDATA** (P1-R4): un `<!--` nel titolo amputa il documento;
     e **un `<a>` non chiuso fonde i collegamenti** (P1-R5);
   - **il cookie che sparisce** (P3-R3) e **le sei richieste su sette non
     censite da `terziDi`** (P3-R6);
   - **`sitemap-xml` e `robots-txt` che chiudono `pass` senza risposta**
     (P5-R1) e il `?? new Set()` che **disarma l'unico block** (P5-R2);
   - **`MAX_PAGINE` conta solo `viste`** (P2-R6/P7-R5: 2001 richieste con una
     pagina vista) e la **coda da 223 678 elementi** (P2-R10, che il tetto
     delle sotto-sitemap NON tocca — dichiarato);
   - **l'HTML servito che sceglie quale file locale confrontare** (P7-R1) e
     `superficieCompleta` che non guarda **se ha trovato qualcosa** (P7-R6).
2. **Nessun rilievo di P.6-P4 è stato provato contro il pilota**: il mandato lo
   teneva fuori perimetro anche in lettura, quindi le conseguenze sul
   certificato già emesso non sono misurate. **MANCANTE.**
3. **Due voci di conformità restano su gate che non le guardano come questo le
   guarderebbe**: `contrasti` (delega **vuota**: speed-demon legge il punteggio
   di categoria e mai il singolo audit `color-contrast`) e `accessibilita-admin`
   (misura vera ma **sui sorgenti**). Il gate le segnala `issue` a ogni giro, con
   il **commit della regia** accanto alla misura (`d147f52`, D18 §3). Su
   `contrasti` un'altra chat sta chiudendo in questa stessa ondata: la riga si
   toglie **rilanciando il `grep`**, non leggendo un handoff.
4. **La firma resta il limite non automatizzabile.** Il gate legge una riga; che
   chi l'ha scritta abbia letto il documento non lo sa nessuno strumento. È però
   più stretto di prima: una data senza nome, un trattino, o una delega con la
   parentesi vuota non passano più (D14).
5. **Ventuno avvisi di complessità** di ESLint (erano 20), zero errori. I sei
   di D21 sono elenchi di casi, e spezzarli in funzioni da tre righe renderebbe
   più difficile leggere la regola; il ventunesimo viene dal banco entrato con
   D25. `code-maniac scan` conta **28 hotspot** con la sua soglia, i due maggiori
   `verify.mjs:685` (ccn 50) e `verify.mjs:439` (ccn 41).
6. **Le altre 34 classi di sabotaggio non sono state rimisurate** dopo le
   correzioni di P.6-P4, e **`giro-costruttore.mjs` non è stato eseguito**: è
   entrato tracciato e coi percorsi aggiornati, ma le 25 classi del costruttore
   sono verificate solo per lettura. **MANCANTE**, e adesso è un comando solo:
   `node scripts/giro.mjs` e `node scripts/giro-costruttore.mjs`.
6bis. **Tutte le misure di questo pacchetto sono su Node 24.18.1.** Nessuna su
   Node 20, che è l'altro motore di casa. **MANCANTE.**
7. **`terziDi` confronta l'host e non lo schema**: `http://stesso-host` su una
   pagina `https` non risulta un terzo. È contenuto misto, un'altra voce e un
   altro mestiere — rilevato dal tribunale e **non chiuso di proposito**.
   *P.6-P4 non l'ha toccata.* Il perito della privacy ha trovato che l'inventario
   degli **elementi** di `terziDi` perde sei richieste su sette (`@import` senza
   `url()`, `<input type=image>`, `<body background>`, `<svg><image>`, `srcdoc`) —
   e ha detto lui stesso che è cosa diversa: quella voce riguarda il **confronto
   delle origini**, questo l'**inventario**. Sta fra i 56 come P3-R6.
8. **Nessun sito multilingua costruito da vetrina-crafter è mai stato misurato.**
   Il banco bilingue è **statico**: gli hreflang, le due informative e le rotte
   per lingua sono provati, ma le rotte per lingua di Next potrebbero comportarsi
   diversamente. Domini misurati: due. Stack: uno e mezzo. **La voce resta
   aperta con questa motivazione**: P.6-P4 ha chiuso un confronto di stringhe che
   sbagliava in memoria (`it-IT` contro `it`, falso rosso su un sito bilingue
   corretto) — nessuna rotta di Next è stata misurata, e la voce non si sposta di
   un millimetro. `livelliTitoli` che ignora le regioni nascoste (P4-R6) resta
   fra i 56.
9. **Un `<script src>` della stessa origine che rimanda a un altro host** viene
   scaricato e il suo contenuto attribuito al sito, senza comparire fra i terzi.
   Non attaccato da nessuno dei due collaudi: resta aperto. `preleva` restituisce
   già l'URL finale, basta confrontarne l'host.
10. **Il doppio conteggio dentro un `<title>`.** Un `<img>` scritto dentro un
    `<title>` viene contato come elemento reale. Non corretto **di proposito**:
    il corpo di `<title>` serve a `nomeAccessibile` per le icone SVG, che è il
    rimedio `SD-ROSSO-01` del tribunale. (Il difetto **inverso** — un
    `<svg><title>` letto come titolo del documento — è invece chiuso da P.6-P3:
    il titolo si cerca nella testa del documento ripulito.)
11. **L'essenzialità di un'archiviazione è dichiarata, non misurata.** Chi scrive
    il certificato può dichiarare essenziale il proprio contatore di visite e non
    avere bisogno di banner secondo il gate. È il limite di un controllo
    falsificabile, scritto in `SKILL.md` §Cosa un gate verde NON prova. **Non si
    chiude**: inventare una misura per una cosa che nessuno può misurare sarebbe
    il difetto ricorrente di questa casa.
12. **L'offuscamento non è più cieco, ma non è una misura.**
    `window["local"+"Storage"]` non nomina l'API, e da P.6-P3 il gate lo
    riconosce come **indizio** e chiude `skipped` invece di `n/a`: «non lo so»
    non è «no». Resta che questo gate legge nomi e non esegue codice.
13. **Un `alt=""` su un'immagine di contenuto resta `issue`**, e un sito con
    quello passa. È corretto — su un'immagine davvero decorativa `alt=""` è la
    forma giusta, e distinguerle è un giudizio, non una regola.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. **Nessuno di questi file è stato
toccato da qui.**

**A speed-demon** — *le prime due nascono dal collaudo P2, e sono le più gravi
che questa skill abbia da riportare a un vicino.*

0a. **RITIRATA il 2026-08-06 con D21 — cinque voci su sei sono tornate a me.**
   Il collaudo P2 aveva misurato col `grep` sui tuoi script che sei delle voci
   che il certificato ti attribuiva il tuo gate non le guarda: `sitemap` **0
   occorrenze**, `og:` **0**, `favicon` **0**, `application/ld` **0**, e le
   occorrenze di `robots` tutte `<meta name="robots">`, cioè l'altra voce. La
   direzione ha deciso che **la proprietà segue la misura, non l'argomento**:
   favicon, Open Graph, JSON-LD, `sitemap.xml` e `robots.txt` sono passi di
   questo gate dal 2026-08-06, e costano una richiesta HTTP a chi cammina già
   ogni pagina. **Non hai più niente da fare su queste cinque.** Reggono
   `canonical` e `noindex-private`, e le misuri sull'HTML servito: quelle
   restano tue e la delega è **piena**.

0b. **Leggi il punteggio della categoria, mai il singolo audit.** **Resta
   aperta, ed è l'unica delega ancora vuota.** `audits` ha **0 occorrenze** nei
   tuoi script (misurato sulla regia a `d147f52`): prendi
   `report.categories.<x>.score` e lo confronti con una soglia scritta in
   `docs/performance.md` del progetto, che non ha un pavimento e che una deroga
   declassa da `block` a `warn`. Per i **contrasti** questo significa che un sito
   con `color-contrast` rosso perde pochi punti su cento e passa qualunque
   soglia ragionevole. È la delega che io non posso riprendermi: i contrasti
   vogliono un browser, e il browser ce l'hai tu. Proposta: leggere
   `report.audits["color-contrast"]` e produrre un esito su quello.
   *So che un'altra chat la sta chiudendo in questa stessa ondata; finché non è
   in regia il mio gate la segnala `issue`, e la toglierò rilanciando il `grep`.*

1. **L'identità dell'app merita una seconda via.** Il suo passo
   `build-produzione` confronta il solo `BUILD_ID` e, quando non combacia, dice
   *«sta rispondendo un'altra applicazione sulla stessa porta»*. Misurato sul
   pilota il 2026-08-06: era **questo** sito, servito da un processo partito
   prima dell'ultima build di un'altra chat — il suo gate e il mio hanno dato lo
   stesso verdetto con la stessa frase, ed **entrambe le frasi additavano
   l'imputato sbagliato**. La seconda via costa una richiesta: si prende un asset
   statico che l'HTML servito referenzia, lo si scarica e lo si confronta con il
   file sotto `.next/`. Se combacia, è questo progetto e il processo è indietro
   («riavvia `npm run start`»); se non combacia, allora sì, è un'altra
   applicazione. L'implementazione è in `servito-lib.mjs`, `esitoIdentita`.
2. **RITIRATA con D21: `sitemap.xml` e `robots.txt` li verifico io.** Restano
   due domande distinte e conviene dirlo: nel passo `superficie-pubblica` la
   `sitemap.xml` si **legge** come seconda sorgente (se ne usa il contenuto); nel
   passo `sitemap-xml` si **verifica** (risponde, è XML, e i suoi indirizzi sono
   serviti). E il passo `robots-txt` fa il confronto che nessun gate della casa
   faceva: **un `robots.txt` che vieta quello che la `sitemap.xml` pubblicizza**
   sono due file dello stesso sito che dicono il contrario. Continui a scriverli
   tu; da oggi qualcuno li rilegge.

**A vetrina-crafter**

3. **`a11y-statica` legge i sorgenti, e in questa casa è già scritto che il
   sorgente mente.** Le due cose non si sovrappongono (lui vede il JSX, io l'HTML
   servito), ma un componente composto a runtime o un contenuto che arriva dal
   database passano da lui e non da `jsx-a11y`. Non è una richiesta di cambiare
   niente: è la riga da mettere accanto al suo passo, perché chi legge il suo
   gate verde sappia cosa non copre.
4. **Il suo `STATO.md` §Punti aperti n°6 dice «nessun passo ha un timeout».**
   Qui il timeout c'è dalla nascita (`ATTESA_MS`), ed è quattro righe: un gate
   senza timeout, davanti a un server che accetta la connessione e non risponde,
   non è né verde né rosso — è appeso.

**A gestionale-crafter**

4b. **Il tuo passo `a11y` linta i sorgenti, e il certificato ti delega
   l'accessibilità *servita* dell'area amministrativa.** `verify.mjs:326-347`
   lancia `eslint-plugin-jsx-a11y` su `admin/` e `src/components`: è un
   controllo vero e utile, e non è la stessa cosa. In questa casa è già
   misurato che il sorgente mente — un `export const metadata` dentro un file
   `"use client"` non produce nessun tag, un contenuto reso nel browser non
   esiste per chi legge la risposta del server — ed è **esattamente** la ragione
   per cui l'accessibilità del sito pubblico è mia. La delega resta tua perché
   l'area protetta vuole una sessione e io leggo un anonimo; ma il mio gate la
   segnala `issue`, e la riga giusta da mettere accanto al tuo passo verde è
   *«l'HTML servito delle rotte protette non lo legge nessuno»*.

**A flow-sentinel**

5. **Un cookie posto dopo un'azione, e un modulo costruito nel browser, sono
   ciechi per me e non per lui.** Il mio gate legge l'HTML servito a un anonimo
   che non fa nulla: un cookie che nasce dopo l'invio di un modulo non lo vedo, e
   un modulo montato in JavaScript non ha campi. Lui un browser ce l'ha già.
   Proposta: una spec che, dopo l'invio del modulo di contatto, asserisca
   **quali cookie esistono** — è la metà della conformità che solo il browser può
   misurare, e oggi non la misura nessuno.

**A launchpad**

6. **Il certificato è il tuo ingresso, e ha una forma fissa.**
   `docs/conformita.md` con `Confermato da:` (data ISO) e, nell'handoff, la riga
   `Gate: VERDE`. Il parser è `leggiCertificato` in
   `agenti/site-doctor/scripts/conformita-lib.mjs`: importalo invece di
   riscriverlo, così se la forma cambia cambia in un posto solo.
7. **Un certificato è una fotografia di una build a una data.** Se il deploy
   costruisce di nuovo, il certificato che stai leggendo riguarda un'altra build.
   È lo stesso problema del `BUILD_ID` che la catena ha già pagato tre volte.

**Alla regia**

8. **La guardia dell'epilogo ha una ricaduta muta, ed è la forma che prescrivete
   voi.** Il tribunale (`SD-14`) osserva che, se `realpathSync` solleva, il
   confronto torna a quello **testuale** — cioè proprio a quello che P.0-igiene-2
   ha misurato come insufficiente attraverso una junction: lì lo script uscirebbe
   `0` senza stampare una riga. Non l'ho corretto qui **di proposito**: quella
   forma è nell'`hint` della regola `epiloghi-vivi` e vale per **otto** script
   della casa; cambiarla in uno solo li farebbe divergere, e il gate della regia
   guarda la forma. Proposta: nel `catch`, eseguire `main()` comunque (meglio un
   giro in più che nessuno) oppure uscire `2` con un messaggio — e aggiornare
   l'`hint` per tutti e otto insieme.

9. **Un banco può essere un file.** `DECISIONI.md` §25 traccia «il banco che un
   clone pulito sa rilanciare», e finora quel criterio ha selezionato un solo
   banco su cinque perché tutti erano progetti Next+Supabase con chiavi
   gitignorate. `scripts/banco.mjs` è un banco senza dipendenze, senza database e
   senza chiavi: 25 classi di sabotaggio rilanciabili con un comando su qualunque
   macchina. Dove il difetto da provare sta nell'**HTML servito** e non nel
   database, questa forma costa un file e rende ogni affermazione riproducibile.
10. **La regola «un gate non lancia strumenti esterni» ha un valore misurabile.**
   Questo gate usa solo `fetch` e la lettura di file: gli serve l'**interprete**,
   non il `PATH`, quindi la nota di macchina del 2026-08-06 non lo tocca e gira
   col node di sistema. Il prezzo è dichiarato e circoscritto (i contrasti sono
   delegati). Non è una regola generale — schema-forge ha bisogno di `psql` — ma
   dove è possibile toglie una classe intera di guasti d'ambiente.
