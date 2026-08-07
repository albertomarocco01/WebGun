# STATO — site-doctor

**A che punto è:** gate a quattordici passi collaudato su due banchi e verde sul pilota `cavia`, **mai usata per un cliente vero** — e 45 rilievi del tribunale restano aperti.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria **308/308** rilanciata (`npm test`, Node 24.19.0), ESLint **0 errori / 24 avvisi**, quattordici passi contati in `scripts/verify.mjs`, giro **43/43** del banco del collaudo e **25/25** di quello del costruttore.

## Cosa fa

Emette il **certificato di idoneità** di un sito prima del lancio: misura ciò che riguarda chi lo visita e non ha firmato niente — informativa privacy, dati raccolti dai moduli pubblici, cookie e archiviazione nel browser, accessibilità dell'HTML servito, lingua e hreflang, favicon, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` — e pretende che tutto il resto sia dichiarato **col nome del proprietario e il file che lo dice**. Non costruisce e non ottimizza: è l'ingresso di **launchpad**, che non pubblica senza `docs/conformita.md` firmato e la riga `Gate: VERDE`. Le voci vivono in `conformita-lib.mjs` (`VOCI`): sedici, di cui **11 mie**, 3 deleghe piene (contrasti, `canonical`, `noindex` privato), 1 **parziale**, 1 **scoperta**. A monte serve l'intera catena costruttiva — non per i dati, ma perché il perimetro si compila leggendo i suoi handoff; **cyber-shield** è a monte sulla carta e **non esiste**.

**Le tre leggi.** (1) Una voce di conformità ha **un proprietario solo**, e si scrive: due proprietari è una voce di nessuno, e una che nessuno copre si scrive `scoperto`. (2) Dove un vicino misura non rimisuro, **verifico dichiarato** — ma «nominata in un documento» non è «guardata da un gate»: le deleghe si misurano leggendo il **codice** del vicino, e una riga esce da `SCOPERTE` solo **rilanciando il grep**, mai leggendo un handoff. (3) La superficie **si scopre camminando**, e la conformità si misura sull'**HTML servito**: in questa casa è già misurato che il sorgente mente.

## Il gate

`scripts/verify.mjs` — **quattordici** passi con `id` stabili e ordine bloccato da un test, **quattro** stati: `pass` · `fail` · `skipped` (verifica mancante, tiene rosso) · `n/a` (**con la premessa misurata stampata**). Verde vuole `fail = 0` **e** `skipped = 0`. Uscite `0` verde, `1` rosso, `2` errore.

| passo | cosa prova |
|---|---|
| `certificato` | `docs/conformita.md` esiste ed è **firmato**: lingue, archiviazione, basi giuridiche, proprietà |
| `superficie-pubblica` | l'app risponde ed è la build **di questo progetto**; superficie camminata da due sorgenti (riferimenti navigabili + `sitemap.xml`, indice risolto) |
| `informativa-privacy` | raggiunta **seguendo i collegamenti**, `200`, collegata da ogni pagina, nomina l'art. 13, zero segnaposto |
| `dati-raccolti` | ogni campo personale di ogni modulo pubblico ha una **base giuridica** dichiarata |
| `archiviazione-client` | cookie, API di archiviazione nei bundle serviti e **terzi** combaciano col dichiarato; banner se serve |
| `accessibilita-servita` | lingua, `alt`, un solo `h1`, gerarchia titoli, `main`, etichette, nome accessibile, `title` — su **ogni** pagina |
| `lingua-e-hreflang` | `<html lang>` combacia col dichiarato; se multilingua, hreflang **reciproci** e `x-default` |
| `favicon` | l'icona dichiarata risponde `200`; se nessuna è dichiarata, risponde `/favicon.ico` |
| `open-graph` | ogni pagina dichiara l'anteprima, e l'**immagine promessa** risponde |
| `dati-strutturati` | ogni blocco `application/ld+json` è JSON valido e dichiara un `@type` |
| `sitemap-xml` | risponde, **è** una sitemap, i suoi indirizzi sono serviti (tetto sotto-sitemap: 50) |
| `robots-txt` | risponde, e **non vieta ciò che la sitemap pubblicizza** |
| `perimetro` | ogni voce ha **un solo** proprietario, le delegate citano un file che esiste e la nomina, le mie riportano l'esito di **questo** giro |
| `contratto-uscita` | l'handoff esiste e la sua riga `Gate:` dice il vero su questa esecuzione |

I passi 3-12 leggono l'app **solo** attraverso la superficie del passo 2, e **solo se completa**: camminata troncata o identità non stabilita li rende MANCANTI, mai verdi.

```
node <skill>/scripts/verify.mjs --url <url-della-build> [--json] [--max-pagine N] [--scadenza SECONDI]
```

Dalla **radice del progetto generato**. `--url` non ha default: senza, legge la riga `URL verificato:` del certificato, altrimenti si rifiuta di indovinare (un gate che indovina `localhost:3000` certifica l'app di un altro progetto, ed è successo). Limiti nel codice: `MAX_PAGINE` 60, `MAX_CORPO` 8 MB, `ATTESA_MS` 15 000, `SCADENZA_S` 300 — estrapolata da una pendenza misurata (20,2 ms per ms di RTT) e **non disattivabile**. Il gate **non lancia strumenti esterni**: solo `fetch` e lettura di file, quindi gli serve l'**interprete**, non il `PATH`.

## Come si prova

```bash
cd agenti/site-doctor
npm test                             # 308 test, 62 suite — misurato il 2026-08-07
node scripts/giro.mjs                # 43 classi del banco del collaudo (--json, una riga per classe)
node scripts/giro-costruttore.mjs    # 25 classi del banco del costruttore
node scripts/uno.mjs <CLASSE>        # una classe sola, uscita UMANA del gate
node scripts/banco-sl.mjs --elenco   # l'elenco delle classi
```

- La batteria vuole **Node 21+**. Il comando elenca i file per esteso apposta: `node --test "scripts/**/*.test.mjs"` funziona su Node 24 e **non** su Node 20; `node --test scripts` fa l'opposto.
- I banchi ascoltano sulla **porta 3882** e generano sotto `scripts/banco-prova-collaudo-sd/` (gitignorata). `giro.mjs` non parte se la porta è occupata: una riga che parla del banco sbagliato è peggio di nessuna riga. Le porte si scelgono **sotto 49152** — gli intervalli riservati da WinNAT **si spostano fra un riavvio e l'altro** (`57464-57963` un giorno, `50000-50059` / `50962-51461` / `61185-61284` il giorno dopo): si rilancia `netsh interface ipv4 show excludedportrange protocol=tcp` invece di memorizzarne uno, perché `Test-NetConnection` non li vede — guarda chi ascolta, non chi ha prenotato.
- `banco-sl.mjs --dir` va a una **cartella di lavoro, mai a un progetto vero**: `genera` comincia con un `rmSync`.
- `banco-sl.mjs` definisce **50** classi; `giro.mjs` ne lancia **43** ed esclude per nome `DAT2 DAT4 INF2 INF3 SUP4 ARC2 ARC4`. Chi le vuole le passa a mano.
- Su Windows il processo a volte muore `3221226505` (`0xC0000409`) **dopo** aver stampato il verdetto: il `--json` è integro, l'uscita no. Si legge `doc.ok`, mai la sola uscita.

## Cosa NON è mai stato provato

- **Mai usata per un cliente vero.** Nessun certificato firmato da un **committente**: le firme esistenti sono per delega dichiarata (D14).
- **`certifica` e `handoff` mai eseguiti da qui su un progetto cliente.** Esercitati sul banco bilingue del collaudo — che produsse certificato, handoff e **due** informative in bozza, una per lingua — e sul pilota dalla chat che lo possiede; da qui il pilota è di sola lettura.
- **Nessuno dei 45 rilievi aperti è stato provato contro il pilota `cavia`** (`C:/Users/Utente/Desktop/cavia`): era fuori perimetro anche in lettura, quindi le conseguenze sul certificato già emesso non sono misurate. **MANCANTE.**
- **Nessuna misura su Node 20**, l'altro motore di casa: tutto su Node 24.19.0. **MANCANTE.**
- **Nessun sito multilingua costruito da vetrina-crafter è mai stato misurato.** Il banco bilingue è **statico**: hreflang, due informative e rotte per lingua sono provati, ma le rotte per lingua di **Next** potrebbero comportarsi diversamente. Domini misurati: due. Stack: uno e mezzo.
- **Che il sito sia conforme al GDPR.** Prova che l'informativa esiste, è raggiungibile, nomina le voci dell'art. 13 e che ogni campo ha una base giuridica **scritta** — non che sia quella giusta. Rende impossibile *dimenticarsene*, non superflua la firma di chi risponde.
- **Che la superficie scoperta sia tutta la superficie.** Si cammina dai collegamenti e dalla `sitemap.xml`: una pagina che nessuno linka non entra. Sul pilota è `/ordine/<codice>`, escluso per iscritto anche dalla misura di speed-demon: fuori da entrambi.
- **Che il proprietario dichiarato abbia lanciato il suo gate su questa build.** `perimetro` prova che la voce è di **uno solo** e che il file citato esiste e la nomina; che il vicino abbia un passo che la guarda è **codice, e si legge**; che l'abbia lanciato oggi non lo sa nessuno strumento — lo dice la riga «i gate dei vicini sono verdi sulla stessa build», ed è lavoro dell'agente.
- **Che il sito sia accessibile.** Solo ciò che si vede nell'HTML servito: **i contrasti non li misura questo gate**, e tabulazione, senso di un messaggio d'errore, focus visibile, screen reader e `prefers-reduced-motion` restano fuori.
- **Che i cookie misurati siano tutti i cookie.** Si legge un anonimo che non fa nulla: un cookie posto dopo l'invio di un modulo, o in sessione autenticata, o da codice caricato dinamicamente, non compare. Un **modulo montato in JavaScript non ha campi**, e `dati-raccolti` può chiudere `n/a` con premessa vera e conclusione sbagliata.
- **Che un'archiviazione dichiarata «essenziale» lo sia.** È dichiarata, non misurata. **Non si chiude**: inventare una misura per una cosa che nessuno può misurare sarebbe il difetto ricorrente di questa casa.
- **Che l'offuscamento sia visto.** `window["local"+"Storage"]` non nomina l'API: il gate lo tratta come **indizio** e chiude `skipped`, non `n/a` — «non lo so» non è «no». Legge nomi, non esegue codice.
- **Che il gate abbia guardato tutto quando finisce.** Un giro scaduto ha `skipped` dove non ha guardato, e uno `skipped` **non è un pass** (il `--json` porta `scaduta` apposta). La **granularità della scadenza è la pagina**: una singola pagina patologica può ancora sforare del suo costo.
- **`terziDi` confronta l'host e non lo schema**: `http://stesso-host` su una pagina `https` non risulta un terzo. È contenuto misto — altra voce, altro mestiere, **non chiuso di proposito**.
- **Uno `<script src>` della stessa origine che rimanda a un altro host** viene scaricato e attribuito al sito, senza comparire fra i terzi. Non attaccato da nessuno dei due collaudi; `preleva` restituisce già l'URL finale, basta confrontarne l'host.
- **Il doppio conteggio dentro un `<title>`**: un `<img>` scritto lì è contato come elemento reale. Non corretto **di proposito** — il corpo di `<title>` serve a `nomeAccessibile` per le icone SVG. (L'inverso, un `<svg><title>` letto come titolo del documento, è chiuso.)
- **Un `alt=""` su un'immagine di contenuto resta `issue`** e il sito passa: su un'immagine davvero decorativa `alt=""` è la forma giusta, e distinguerle è un giudizio.
- **Porte dichiarate aperte da P.6-P5 e non chiuse**: `object data`/`embed src` con HTML dentro; il `formaction` come *superficie* (destinazione censita, pagina non camminata); l'intestazione HTTP `Refresh:`; `<div =">">`; il `formaction` su un bottone legato con `form="id"` fuori dal tag; la sitemap compressa `.gz`; lo strabismo residuo di `regoleNomi` sulle regioni nascoste.
- **Che la firma sia vera, e che il certificato resti vero domani.** Il gate legge una riga, ed è una fotografia di **questa** build a **questa** data. Si rilancia, o non vale.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| **45 dei 61 rilievi** del tribunale (registro sotto) | misura di quanto entra in una chat, non giudizio sulla loro validità: sono riprodotti uno per uno | site-doctor |
| Una classe chiusa non è una **stanza** chiusa | il contenimento di `leggiDentroIlProgetto` è stato riaperto due volte da porte che il rimedio precedente non poteva coprire: una **junction NTFS** dentro `docs/` (una riga del certificato senza `..`, che un revisore approva a colpo d'occhio — chiusa con `realpathSync`) e il **flusso di dati alternativo NTFS**, `docs/handoff/altro.md:ombra`, che per `existsSync`, `isFile()` e `realpathSync` **è** quel file e vi nasconde un testo che nessun editor mostra — chiuso rifiutando il `:` prima di risolvere. Nessuna delle correzioni riaperte era sbagliata: erano **strette al caso trovato** | site-doctor — a ogni perito si chiede per quale **porta diversa** si entra nella stessa stanza, e la risposta si scrive |
| Nessun rilievo provato contro il pilota `cavia` | era fuori perimetro anche in lettura | direzione |
| Nessuna misura su **Node 20** | tutto misurato su Node 24.19.0 | site-doctor |
| **24 avvisi** ESLint di complessità, 0 errori | elenchi di casi e di porte: spezzarli in funzioni da tre righe renderebbe più difficile leggere la regola. `code-maniac scan` conta 28 hotspot con la sua soglia, i due maggiori in `verify.mjs` (ccn 50 e 41) | accettato, non silenziato |
| 4 MANCANTE di `code-maniac scan` | `prettier`, `convenzioni`, `depcruise` non installati; `tsc` non configurato perché la skill è **ESM puro** | regia |
| `accessibilita-admin`: delega **parziale misurata** | il passo `a11y` di gestionale-crafter lancia `jsx-a11y` sui **sorgenti**, non sull'HTML servito dell'area protetta. Resta sua perché quell'area vuole una sessione e questo gate non ne apre nessuna; `perimetro` la segnala `issue` a ogni giro | gestionale-crafter |
| `antispam` e limiti di frequenza sui moduli pubblici | **scoperto**: delegare a una skill che non esiste è il difetto da cui questa skill è nata | cyber-shield, quando esisterà |
| La **firma** non è automatizzabile | il gate legge una riga. È però più stretto: data senza nome, trattino, o delega con parentesi vuota non passano più (D14) | nessuno — limite dichiarato |
| Seconda via per l'**identità dell'app** | `build-produzione` di speed-demon confronta il solo `BUILD_ID` e, quando non combacia, dice «un'altra applicazione sulla stessa porta»: sul pilota era **questo** sito servito da un processo partito prima dell'ultima build, e due gate additarono l'imputato sbagliato. Costa una richiesta: confrontare un asset statico col file sotto `.next/`. Implementazione qui, `esitoIdentita` in `servito-lib.mjs` | speed-demon |
| Riga accanto al passo `a11y-statica` di vetrina-crafter | lui vede il JSX, io l'HTML servito: un componente composto a runtime o un contenuto dal database passano da me e non da `jsx-a11y` | vetrina-crafter |
| Il timeout mancante nel suo gate (`STATO` di vetrina-crafter, n°6) | qui c'è dalla nascita (`ATTESA_MS`), quattro righe: un gate senza timeout davanti a un server che accetta e non risponde non è né verde né rosso, è **appeso** | vetrina-crafter |
| Una spec che asserisca **quali cookie esistono** dopo l'invio del modulo di contatto | è la metà della conformità che solo un browser può misurare, e oggi non la misura nessuno | flow-sentinel |
| launchpad deve **importare** `leggiCertificato` (`conformita-lib.mjs`), non riscrivere il parser | se la forma cambia, deve cambiare in un posto solo. E un certificato è la fotografia di **una** build: se il deploy ricostruisce, riguarda un'altra build — il problema del `BUILD_ID` già pagato tre volte | launchpad |
| **Un banco può essere un file** | `DECISIONI.md` §25 traccia «il banco che un clone pulito sa rilanciare», e quel criterio ha selezionato **un banco su cinque**: erano tutti progetti Next+Supabase con chiavi gitignorate. `scripts/banco.mjs` è un banco senza dipendenze, senza database e senza chiavi — 25 classi rilanciabili con un comando su qualunque macchina. Dove il difetto sta nell'**HTML servito** e non nel database, questa forma costa un file e rende ogni affermazione riproducibile | regia |
| La guardia dell'epilogo ha una **ricaduta muta** | se `realpathSync` solleva, il confronto torna a quello **testuale**, che P.0-igiene-2 ha misurato insufficiente attraverso una junction: lo script uscirebbe `0` senza stampare una riga. Non corretto qui di proposito — quella forma è nell'`hint` di `epiloghi-vivi` e vale per **otto** script, da cambiare insieme | regia |

### Registro dei 45 rilievi aperti

Tribunale sulle ~900 righe nuove: otto periti, **61 rilievi**, con ESLint · knip · jscpd · gitleaks · batteria **tutti verdi** mentre i 61 erano vivi. Cinque chiusi subito, **11 da P.6-P5** (P1-R2/R3, P2-R1/R2/R8, P3-R1/R2, P4-R4/R6, P7-R2/R3), **45 restano**. `↓` falso verde · `↑` falso rosso · `≈` costo o forma. *Le righe citate sono quelle del tribunale: P.6-P5 ha spostato il codice sotto.*

**Parser** — `servito-lib.mjs`
- **P1-R4** ↓H `:253` — `<title>` è RCDATA: un `<!--` nel titolo amputa il documento, e il gate addita l'imputato sbagliato.
- **P1-R5** ↓H `:540` — un `<a>` non chiuso fonde i collegamenti: 3 bloccanti a11y riportati come 0, informativa attribuita alla pagina sbagliata.
- **P1-R6** ↓H `:852` — `display:/*c*/none`, `\6e one`, `visibility:collapse`: link nascosto nel browser, contato come raggiungibile.
- **P1-R7** ≈M `:1204` — `destinazioniModuli` quadratica: 1000 moduli con `id` = 7,2 s, in un passo senza controllo di scadenza.
- **P1-R8** ≈L `:454` — `attributi` interroga la catena di prototipi (`constructor` → funzione).

**Costi** — `servito-lib.mjs`, `verify.mjs`
- **P2-R3** ≈H `:545` — `elementiDi`: 90 KB di pagina → 90 MB da rileggere, 5,9 s.
- **P2-R4** ≈H `:1664` — `aria-labelledby` saturo su 8 collegamenti: **48 s** per una pagina.
- **P2-R5** ≈H `:1244` — `campiLegatiPerId` rilegge tutta la pagina per ogni `<form id>`: 4,9 s contro 14,5 ms.
- **P2-R6** ≈H `verify.mjs:490` — `MAX_PAGINE` conta solo `viste`: **2001 richieste servite con `viste.size = 1`**.
- **P2-R7** ≈M `:375` — `raggiungibiliDaCollegamenti`: `coda.shift()` su array, quadratica.
- **P2-R9** ≈M `:1512` — fattore costante 10-13×: `terziDi` fa undici scansioni del documento.
- **P2-R10** ≈L `verify.mjs:482` — la coda può nascere con **223 678 elementi** da una sitemap sola; risolvere l'indice la allarga, e il tetto delle sotto-sitemap **non** la chiude.
- **P2-R11** ≈L `:30` — `perStampa` fa lo spread dell'intera stringa prima di tagliarla.
- **P2-R12** ≈L `:268` — l'unico `new RegExp` con un frammento di documento fuori da `perRegexp`: oggi non sfruttabile, il nome del tag viene da un estrattore vincolato.

**Privacy** — `servito-lib.mjs`, `verify.mjs`. *Il perito ha costruito un sito che spedisce nome ed email a un terzo, pone un cookie da un anno e carica due terzi: gate VERDE, uscita 0.*
- **P3-R3** ↓H `verify.mjs:343` — un cookie chiamato `samesite` sparisce: gli attributi sono applicati al **primo** `name=value`, che per RFC 6265 è sempre il cookie.
- **P3-R4** ↓H `:1453` — `var d=document; d.cookie=…` (uscita ordinaria di un minificatore) → il passo chiude `n/a` con premessa falsa.
- **P3-R6** ↓H `:1512` — sei richieste su sette a un dominio terzo non censite: `@import` senza `url()`, `<input type=image>`, `<body background>`, `<svg><image>`, `srcdoc`.
- **P3-R7** ↓H `verify.mjs:603` — «collegata da 4 pagine su 4» è **falso**: conta i candidati, non i rimandi all'informativa scelta.
- **P3-R5** ↓M `:1453` — `caches`, service worker e `navigator.storage` non sono nel catalogo.
- **P3-R8** ↓M `:1132` — `autocomplete="username webauthn"`: un token di serie spegne la prova forte.
- **P3-R9** ↓M `:1340` — `codicefiscale`, `datanascita`, `cartaidentita` attaccati non sono niente.
- **P3-R10** ↓M `:1432` — la base giuridica «—» passa, e in questa casa `—` è la convenzione per la cella vuota.
- **P3-R11** ↓M `:1575` — per cookie e terzi vince la **prima** riga; per le API vince la più prudente.
- **P3-R12** ↓M `:1628` — l'essenzialità di un terzo è pura autodichiarazione, e decide da sola se serve il banner.
- **P3-R13** ↑M `:983` — un'informativa ospitata da iubenda produce «nessun collegamento a un'informativa».

**Indicizzazione** — `servito-lib.mjs`
- **P4-R2** ↑H `:2211` — `Allow`/`Disallow` di pari lunghezza: vince chi è scritto prima, non `Allow` come da RFC 9309.
- **P4-R3** ↓H `:2210` — `Disallow: /*.pdf$` e `/prodotti/*/bozza` sono **silenziosamente inerti**.
- **P4-R7** ↓M `:2046` — `og:image` relativo passa: il gate lo risolve contro l'origine che *lui* conosce, un social no.
- **P4-R1** ↓M `:2030` — favicon/OG/JSON-LD con `pagine=[]` tornano `pass`: raggiungibilità non provata, oggi protetta da una guardia a monte.

**Terminazione** — `verify.mjs`
- **P5-R1** ↓H `:973` — `sitemap-xml` e `robots-txt` chiudono **`pass`** quando la risposta non arriva, e la prosa dichiara un confronto che non poteva avvenire.
- **P5-R2** ↓H `:1002` — cascata: un `?? new Set()` di comodo **disarma l'unico `block`** del passo robots. Diff su 14 passi: un solo delta, `fail → pass`.
- **P5-R3** ≈M `:1324` — la scadenza non è un limite, è un **minimo**: `--scadenza 30` → 52,8 s reali. *Migliorata e rimisurata (+62% → +0 sul banco CPU), non chiusa: lo scenario dei 52,8 s non è stato ricostruito.*
- **P5-R4** ↓M `:1315` — `--scadenza 1e308` → `FINE = Infinity`, e il JSON archiviato dichiara `scaduta: false`. Anche `0x10` passa in silenzio.
- **P5-R5** ↑M `:890` — quando è la scadenza a tagliare la richiesta, `favicon` accusa **il sito**: quattro `block` su un markup a posto.
- **P5-R6** ≈L `:113` — `CONTRATTO_JSON = 1` mentre il documento è cresciuto di due campi.

**Filesystem** — `verify.mjs`
- **P6-R3** ≈M `:204` — nessun tetto sui documenti locali: un `conformita.md` da 299 MB consuma `--scadenza 5` prima del primo fetch. Asimmetria con `MAX_CORPO`.
- **P6-R4** ≈L `:1065` — `provaIdentita` costruisce un percorso su disco da input remoto senza containment. **Non sfruttato**, confidenza 0,4: incoerenza strutturale.

**Superficie e identità** — `servito-lib.mjs`, `verify.mjs`
- **P7-R1** ↓H `verify.mjs:1077` — l'HTML servito sceglie **quale file locale** confrontare: `/_next/static/../package.json` è `{"type":"commonjs"}` in ogni build di Next. 12 passi su 14 misurano un'altra applicazione, e il gate stampa la frase **opposta al vero**.
- **P7-R4** ↑H `:570` — `trailingSlash: true`, opzione documentata di Next: informativa dichiarata assente mentre risponde a `/privacy/`.
- **P7-R5** ≈H `verify.mjs:490` — `MAX_PAGINE` conta solo `viste`: 1409 richieste, 13 verifiche MANCANTI su 14, **322 KB di rapporto stampato**.
- **P7-R6** ↓H `verify.mjs:400` — `superficieCompleta` guarda *come è finita* la camminata, mai *se ha trovato qualcosa*: 7 verdetti su 1 pagina di 3, che diventano l'autorità del passo `perimetro`.
- **P7-R7** ↓L `:1033` — una pagina non dichiarata vale `issue`: il messaggio dice «nessuno l'ha guardata», la gravità dice «non importa».

**Certificato** — `conformita-lib.mjs`
- **P8-R2** ↓H `:383` — stessa voce, stesso proprietario, **esiti in contraddizione** → un solo `issue` non bloccante.
- **P8-R3** ↓H `:239` — la data della firma non è mai validata: `2099-12-31`, `9999-99-99` e `1970-01-01` passano tutte. Il commento dichiara lo scopo, il confronto non è mai stato scritto.
- **P8-R4** ↓M `:462` — il nome del vicino non è confrontato con l'elenco reale dei vicini.

## Com'è andata (in breve)

Nata dalla favicon del pilota, `404` per **tre anelli** perché due documenti dicevano che se ne occupava qualcun altro. Progettata e costruita insieme il **2026-08-06** (P0+P1 uniti senza revisione in mezzo, costo dichiarato di D17), col gate specificato **prima** del flusso. Il giro costò **8 → 3 → 33 → 14**: autorevisione, sabotaggio, tribunale, collaudo indipendente. Il tribunale della costruzione trovò **33** rilievi con gli strumenti statici tutti verdi, e il più grave apriva **tutti e nove i passi insieme**: in HTML un `<!--` dentro il valore di un attributo è testo, non l'apertura di un commento.

Il **collaudo avversario in chat vergine** (banco studio legale bilingue) misurò **14 difetti**, batteria 144 → 168. `</script>` letto come apertura amputava il documento, e **sette deleghe su nove erano vuote** — favicon e Open Graph comprese — misurate col `grep` sul codice dei vicini invece che sulla loro prosa. Da lì **D21**: cinque voci tornate a casa, perché la proprietà segue la misura, non l'argomento.

Poi **P.6-P3** (sei periti, 48 rilievi; gate 9 → 14 passi; `--scadenza`; batteria 168 → 264), **P.6-P4** (otto periti, **61** rilievi con tutti gli strumenti statici verdi — il critico del roster trovò il buco *prima* di spawnare, e dall'ottavo perito uscì «gate VERDE su un sito che raccoglie IBAN in una pagina mai aperta»; `code-maniac scan` per la prima volta; D25, banchi tracciati; batteria 264 → 285) e **P.6-P5** (11 rilievi chiusi, ognuno falsificato contro `git show HEAD:`; la quadratica di `DENTRO_TAG` chiusa in **dodici** lettori, 11,5 s → 0,2 ms a 256 KB; scadenza sulla CPU; batteria 285 → **308**; giro a 43 classi e `giro-costruttore` per la prima volta, che scoprì il certificato del banco fermo all'era pre-D21). Nella stessa ondata la delega dei contrasti è diventata **piena**, tolta da `SCOPERTE` rilanciando il grep.

Sul pilota `cavia` il gate ha girato **in sola lettura**: rosso per i motivi giusti quando il certificato attribuiva a un altro cose già misurate qui, poi **VERDE 14/14** dopo che la chat che possiede il pilota aveva riallineato il certificato a D21 — due chat, due repo, la stessa decisione nella stessa ondata, senza parlarsi. Ultima build del pilota: **14 passi, 1 `n/a`**. Una misura sul pilota, in ondata, ha una scadenza di **minuti**.
