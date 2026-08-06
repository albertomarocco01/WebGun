# Stato — Site Doctor

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
| P3 | primo consumatore reale con un certificato firmato da un **committente**, non per delega | pacchetto di catena | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come è stato misurato |
|---|---|---|
| Test degli script | **168 verdi** | `node --test scripts/`, sul node di sistema (20.12.2) **e** su Node 24 |
| Difetti trovati dal **collaudo avversario** (P2) | **14**, tutti chiusi con un test | `COLLAUDO-2026-08-06.md` |
| Classi di sabotaggio del collaudo | **32**, di cui **25 rosse**; le 7 verdi sono limiti dichiarati che reggono | `banco-prova-collaudo-sd/`, gitignorato |
| Deleghe misurate **vuote** | **7 su 9** — `grep` sui gate dei vicini | `SCOPERTE` in `conformita-lib.mjs` |
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

**Chiusi dal collaudo P2 del 2026-08-06**, e vale la pena dire quali: il n°1 (il
collaudo stesso), il n°2 (`certifica` e `handoff` eseguiti come comandi su un
progetto vero), il n°3 (l'informativa in bozza generata, con il modello che
prima non esisteva), e il **n°12** — le premesse dei `NON APPLICABILE` fatte su
un documento che poteva essere amputato: era la previsione più acuta del
costruttore, si è avverata, ed è chiusa.

1. **Il tribunale non è stato riconvocato sul codice cambiato.** Quattordici
   correzioni sono entrate dopo l'ultimo `/code-inquisition`, fra cui il
   ripulitore e due regole nuove. Su questa skill il tribunale ha trovato **33**
   rilievi che tutti gli strumenti statici dichiaravano puliti: è **MANCANTE**,
   non PASS, ed è la prima cosa da fare.
2. **Sette voci di conformità sono delegate a gate che non le guardano**, e il
   gate oggi lo dice con un `issue` a ogni esecuzione. Dichiararlo non è
   coprirlo: finché la direzione non decide (proposta n°2 del collaudo), un
   certificato può essere firmato con `favicon`, `open-graph`,
   `dati-strutturati`, `sitemap`, `robots` e `contrasti` **scoperte**.
3. **La firma resta il limite non automatizzabile.** Il gate legge una riga; che
   chi l'ha scritta abbia letto il documento non lo sa nessuno strumento.
4. **Nessuna scadenza complessiva.** Misurato al collaudo contro un server che
   manda un byte al secondo e non chiude mai: il gate **non si appende** (il
   timeout per richiesta funziona, 31 s e un `block` con la diagnosi giusta), ma
   60 pagine ostili costano mezz'ora e in CI il lavoro viene ucciso prima di
   produrre un verdetto. Serve `--scadenza` con un default e `skipped` sui passi
   non completati — mai una fine senza verdetto. È un cambio di contratto:
   proposta n°1 del collaudo.
5. **Nessun tetto sul corpo scaricato né sul numero di bundle.** La forma temuta
   — l'errore inghiottito e la diagnosi rovesciata che accusa la macchina di chi
   misura — **non si è riprodotta**: contro un corpo da 900 MB il gate esce con
   `1 pagine non scaricate`, che è vero. Resta il costo: 31 s per pagina e tutto
   ciò che arriva in memoria.
6. **Quattordici avvisi di complessità** di ESLint (era 13), zero errori. Il
   nuovo è `regioniNascoste`, il parser a scansione singola: la sua alternativa
   è la versione quadratica che il collaudo ha tolto.
7. **`--json` non è stato consumato da un orchestratore.** I due runner del
   collaudo lo leggono, ed è la prima volta che qualcosa lo fa fuori dal driver
   del sabotaggio; un consumatore vero non c'è ancora.
8. **Nessun sito multilingua costruito da vetrina-crafter è mai stato misurato.**
   Il collaudo ha misurato un banco bilingue **statico**: gli hreflang, le due
   informative e le rotte per lingua sono provati, ma le rotte per lingua di Next
   potrebbero comportarsi diversamente. I domini misurati sono due (pizzeria,
   studio legale), gli stack ancora uno e mezzo.
9. **Un `<script src>` della stessa origine che rimanda a un altro host** viene
   scaricato e il suo contenuto attribuito al sito, senza comparire fra i terzi.
   Non attaccato dal collaudo: resta aperto. `preleva` restituisce già l'URL
   finale, basta confrontarne l'host.
10. **Il doppio conteggio dentro un `<title>`.** Un `<img>` scritto dentro un
    `<title>` viene contato come elemento reale. Non corretto **di proposito**:
    il corpo di `<title>` serve a `nomeAccessibile` per le icone SVG, che è il
    rimedio `SD-ROSSO-01` del tribunale.
11. **L'essenzialità di un'archiviazione è dichiarata, non misurata.** Chi scrive
    il certificato può dichiarare essenziale il proprio contatore di visite e non
    avere bisogno di banner secondo il gate. È il limite di un controllo
    falsificabile, ora scritto in `SKILL.md` §Cosa un gate verde NON prova.
12. **L'offuscamento resta cieco**: `window["local"+"Storage"]` sfugge a una
    ricerca di sottostringa. È un indizio, non una misura, e va letto così.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. **Nessuno di questi file è stato
toccato da qui.**

**A speed-demon** — *le prime due nascono dal collaudo P2, e sono le più gravi
che questa skill abbia da riportare a un vicino.*

0a. **Sei voci che il certificato ti delega, il tuo gate non le guarda.**
   Misurato il 2026-08-06 col `grep` sui tuoi script, non letto nel tuo handoff:
   `sitemap` **0 occorrenze**, `og:` **0**, `favicon` **0**, `application/ld`
   **0**; le occorrenze di `robots` sono tutte `<meta name="robots">`, cioè la
   voce `noindex-private`, e `robots.txt` non lo richiede nessun passo. Reggono
   `canonical` e `noindex-private`, e le misuri sull'HTML servito.
   **La favicon è la voce da cui site-doctor è nata** — un `404` su ogni pagina
   per tre anelli — e le delega a te. Finché non c'è un passo, il mio gate le
   segnala `issue` a ogni esecuzione. Costo stimato: una richiesta HTTP per
   voce, sull'app che il tuo gate già interroga. In alternativa passano a me,
   che cammino già ogni pagina e scarico già la `sitemap.xml`: **la scelta è di
   chi risponde della voce, non mia.**

0b. **Leggi il punteggio della categoria, mai il singolo audit.** `audits` ha
   **0 occorrenze** nei tuoi script: prendi `report.categories.<x>.score` e lo
   confronti con una soglia scritta in `docs/performance.md` del progetto, che
   non ha un pavimento e che una deroga declassa da `block` a `warn`. Per i
   **contrasti** questo significa che un sito con `color-contrast` rosso perde
   pochi punti su cento e passa qualunque soglia ragionevole. È la delega più
   debole delle nove, ed è quella che io non posso riprendermi: i contrasti
   vogliono un browser, e il browser ce l'hai tu. Proposta: leggere
   `report.audits["color-contrast"]` e produrre un esito su quello.

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
