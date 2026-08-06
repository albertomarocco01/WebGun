# Stato — Site Doctor

- **Stato attuale: P0+P1 CONSEGNATE il 2026-08-06, in un solo pacchetto** (D17
  del cantiere). Il gate esiste, ha **nove passi** e **quattro stati**, chiude
  **VERDE 8/8 + 1 NON APPLICABILE** sul banco conforme e **ROSSO su 25 classi di
  sabotaggio su 25**. Sul pilota `fornodoro` esce **ROSSO per cinque motivi veri
  che nessuno dei cinque gate esistenti vede**. **144 test verdi.** Verbale:
  `COSTRUZIONE-2026-08-06.md`.
- **Il tribunale ha trovato 33 rilievi**, e gli strumenti statici erano **tutti
  verdi** su tutti e 33. Il piu' grave apriva **tutti e nove i passi insieme**:
  in HTML un `<!--` dentro il valore di un attributo e' testo, non l'apertura di
  un commento, e il ripulitore a regexp non lo sapeva — due `<div>` invisibili
  facevano sparire dal documento che il gate giudica immagini senza `alt`, campi
  che raccolgono dati personali, terzi non dichiarati e collegamenti. Chiuso con
  un ripulitore a una scansione, che ha chiuso anche un costo **quadratico**
  (200 KB di `<` ripetuti: 24,6 s → 16 ms). **26 rilievi chiusi con un test,
  5 aperti e scritti qui sotto, 1 accettato, 1 rimandato alla regia.**
- **Non usabile su un progetto cliente**, e il motivo principale non è tecnico:
  il **collaudo avversario indipendente (P2) non è stato fatto**, e questa è la
  prima skill della casa nata **senza la revisione del direttore fra
  progettazione e costruzione**. Sulle cinque skill che ce l'hanno avuta, il
  collaudo avversario ha trovato in media dieci difetti veri a testa — su
  vetrina-crafter, la più curata, ne ha trovati **quattordici**.
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
| P2 | collaudo avversario indipendente in **chat vergine**, dominio diverso: caccia ai falsi verdi dei nove passi | chat vergine (chi costruisce non collauda) | **da fare — ed è il punto aperto n°1** |
| P3 | primo consumatore reale con un certificato firmato da un **committente**, non per delega | pacchetto di catena | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come è stato misurato |
|---|---|---|
| Test degli script | **144 verdi** | `npm test` (Node 24) |
| Passi del gate implementati | **9**, con `id` stabili e ordine bloccato da un test | `scripts/verify.mjs`, `ID` |
| Stati del verdetto | **4** (`pass` · `fail` · `skipped` · `n/a`) | `riepilogo()`, con i test dei tre casi |
| Classi di sabotaggio provate | **25 su 25 rosse**, ognuna sul passo che dichiara di sorvegliare | `scripts/banco.mjs`, uscite incollate nel verbale |
| Difetti **del gate** trovati sabotando | **3**, tutti chiusi con un test | verbale §5 |
| Difetti **del gate** trovati dalla batteria | **2** | verbale §5 |
| Difetti **del gate** trovati al primo lancio sul pilota | **1** (la diagnosi d'identità) | verbale §5 |
| Rilievi del **tribunale** | **33** — 26 chiusi con un test, 5 aperti, 1 accettato, 1 alla regia | verbale §6.6 |
| Punti della progettazione cambiati dallo STOP di metà pacchetto | **8**, prima che diventassero codice | verbale §4 |
| Voci di conformità nell'elenco | **16** — 6 mie, 9 delegate, 1 scoperta | `conformita-lib.mjs`, `VOCI` |
| Comandi esercitati | **3 su 5** (`perimetro`, `scansiona`, `verify`) — `certifica` e `handoff` **non** esercitati su un progetto vero: il pilota è di sola lettura | verbale §7 |
| Regole pure | 2 librerie | `servito-lib.mjs` · `conformita-lib.mjs` |
| Gusci di I/O | 2 | `verify.mjs` · `banco.mjs` |
| References | **5** | |
| Guardiani | ESLint **0 errori** / 13 avvisi di complessità · knip **pulito** · jscpd **1 clone di 8 righe** (l'epilogo, duplicato apposta) · `gitleaks` **pulito** · `semgrep` 4 rilievi, chiusi nella sostanza | eseguiti |

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
3. **Che il proprietario dichiarato abbia fatto il suo lavoro.** Il passo
   `perimetro` prova che la voce è assegnata a **uno solo** e che il file citato
   esiste e la **nomina**. Non legge se quel file dice «fatto» o «da fare»: è il
   confine fra un controllo falsificabile e la comprensione di un testo, e sta di
   proposito da questa parte.

## Punti aperti — ordinati per gravità

1. **Il collaudo avversario (P2) non è stato fatto, e questa skill ne ha più
   bisogno delle altre.** È l'unica nata senza revisione del direttore fra
   progettazione e costruzione (D17). Lo STOP di metà pacchetto ha sostituito
   quella revisione con un'autorevisione, e un'autorevisione trova ciò che chi
   ha scritto sa già di dover cercare: ha infatti trovato otto punti, e il
   sabotaggio — cioè la prima cosa che *esegue* invece di leggere — ne ha trovati
   altri tre che l'autorevisione non aveva visto.
2. **`certifica` e `handoff` non sono mai stati eseguiti su un progetto vero.**
   Il pilota è di sola lettura per questo pacchetto (D17 §3): non è stato
   possibile scrivere `docs/conformita.md` né `docs/handoff/<n>-site-doctor.md`
   dentro `fornodoro`. Sul banco i due documenti li **genera il banco**, quindi
   sono provati come *input del gate*, non come *prodotto del comando*. La prima
   volta che qualcuno eseguirà `certifica` su un progetto vero sarà la prima
   volta.
3. **Nessuna informativa è mai stata generata.** Il comando `certifica`
   prescrive di produrre la pagina dell'informativa **in bozza** quando manca, e
   la procedura è scritta — ma non è mai stata eseguita, quindi non esiste un
   modello di pagina provato. È la parte più delicata della skill (un documento
   legale generato da un programma) ed è la meno provata.
4. **La firma resta il limite non automatizzabile.** Il gate legge una riga; che
   chi l'ha scritta abbia letto il documento non lo sa nessuno strumento. È lo
   stesso limite che dichiarano speed-demon sull'elenco delle pagine e
   flow-sentinel sull'elenco dei flussi.
5. **Tredici avvisi di complessità** di ESLint (`complexity > 15`), saliti da
   sette con le correzioni del tribunale. Zero errori. È il precedente di speed-demon, che ha portato un
   `complexity 19` per tre giorni prima che P.7c lo sciogliesse: è un residuo
   dichiarato, non un guardiano spento.
6. **Un solo dominio, un solo stack.** Tutto quello che è scritto qui è vero su
   Next 16 con Turbopack. Il banco è statico e il pilota è una pizzeria: nessun
   sito multilingua **vero** è mai stato misurato — gli hreflang sono provati
   solo sul banco sabotato.
7. **`--json` non è stato esercitato oltre il driver del sabotaggio.** Il
   contratto d'uscita in JSON esiste, ha il suo numero di versione e i suoi
   `id`; nessun orchestratore lo ha ancora consumato.
8. **Il tempo di esecuzione non è stato cronometrato.** Sul pilota (5 pagine, 9
   script) è nell'ordine dei secondi; su un sito di trenta pagine con cinquanta
   bundle non lo sa nessuno, e il limite `--max-pagine 60` produrrebbe un
   `block` dichiarato invece di un troncamento silenzioso.
9. **Nessun tetto sul corpo scaricato né sul numero di bundle** (tribunale,
   `SD-MEM-01` e `SD-NET-04`). Il timeout per richiesta limita il **tempo**, non
   i **byte**: un server che risponde 200 e riversa dati per quindici secondi
   riempie la memoria, e oltre il limite di stringa di V8 l'errore viene
   inghiottito dal `catch` di `preleva` e si presenta come «nessuna risposta:
   avvia la build» — cioè con la diagnosi rovesciata, che accusa la macchina di
   chi misura. Rimedio noto: lettura a flusso con un tetto esplicito, e un
   `block` nominato al superamento invece di un `null`.
10. **Nessuna scadenza complessiva.** 60 pagine × 2 tentativi × 15 s è mezz'ora
    per le sole pagine, e il lavoro di CI viene ucciso dal proprio timeout prima
    di produrre un verdetto: il gate resta «appeso» dal punto di vista di chi lo
    guarda, che è la definizione che questo codice dà del difetto. Serve un
    `--scadenza` con un default, e allo scadere `skipped` sui passi non
    completati — mai una fine senza verdetto.
11. **Un `<script src>` della stessa origine che rimanda a un altro host** viene
    scaricato (`segui: true`) e il suo contenuto attribuito al sito, senza
    comparire fra i terzi. `preleva` restituisce già l'URL finale: basta
    confrontarne l'host e, se differisce, trattarlo come terzo.
12. **Le premesse di due `NON APPLICABILE` su tre non sono indipendenti.**
    Quella della lingua lo è (lo STOP l'ha resa tale); «zero moduli» e «zero
    archiviazioni» sono misure fatte **sullo stesso documento** che un difetto
    del ripulitore potrebbe amputare. È la forma più elegante di falso verde che
    questo gate abbia, ed è il primo posto dove guarderei al collaudo P2.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. **Nessuno di questi file è stato
toccato da qui.**

**A speed-demon**

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
2. **`sitemap.xml` e `robots.txt` li scrive lui e non li guarda nessun suo
   passo** (lo dichiara il suo `STATO.md`). Qui la `sitemap.xml` si legge come
   **seconda sorgente della superficie** — cioè se ne usa il contenuto senza
   verificarla. Se un giorno servisse verificarla, il proprietario è lui.

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
