# La verifica deterministica — i quattordici passi, i quattro stati, il contratto `--json`

> Carica questo file **prima di toccare il gate**.

## I quattro stati

| stato | marchio | significato | blocca il verde? |
|---|---|---|---|
| `pass` | `OK  ` | la verifica è stata fatta e non ha trovato bloccanti | no |
| `fail` | `FAIL` | la verifica è stata fatta e ha trovato almeno un `block` | **sì** |
| `skipped` | `MANC` | **la verifica non è stata fatta**: strumento assente, premessa mancante, input non letto | **sì** |
| `n/a` | `N.A.` | la verifica **non si applica**, e la premessa è misurata e stampata | no |

**Il verde vuole `fail = 0` e `skipped = 0`.**

### Perché quattro e non tre

Tre stati costringono a mentire su due casi veri: un sito monolingua non ha
hreflang, un sito senza moduli non raccoglie dati. Dirlo `pass` è una bugia
comoda («ho verificato gli hreflang e stanno bene»); dirlo `skipped` tiene rosso
un gate che ha finito il suo lavoro, e un rosso strutturale è un rosso che si
impara a ignorare (`DECISIONI.md` §8).

### Il prezzo di `n/a`, e perché non è un'uscita di comodo

`statoNonApplicabile(premessa)` **riceve la premessa come argomento** e torna
`skipped` se manca. Non c'è modo di scrivere `n/a` senza aver misurato e
stampato *cosa* si è guardato per poterlo dire. Ogni `n/a` porta nel dettaglio
una riga come:

```
lingue misurate sull'HTML servito di 5 pagine: it · rotte per lingua trovate
nella superficie: nessuna · lingue dichiarate nel certificato: it
```

Se quella riga è falsa, lo è anche la risposta — e si vede, perché è stampata.

### La premessa di `n/a` non può essere circolare

**Trovato in progettazione, prima che diventasse codice** (`SKILL.md` §Gate,
STOP di metà pacchetto). La prima stesura diceva: *hreflang non applicabile
quando non si trovano rotte alternative*. Ma «non si trovano rotte alternative»
si sarebbe misurato… dagli `hreflang`. Cioè: **un sito multilingua a cui mancano
gli hreflang — la non conformità da trovare — sarebbe uscito «non applicabile»**.

La premessa dev'essere una misura **indipendente** da ciò che si sta
verificando: qui è l'insieme dei `lang` dichiarati dalle pagine servite, più gli
indizi di rotte per lingua (`/en/…`) nella superficie.

## I quattordici passi

L'**ordine della lista `PASSI` è il gate**, ed è bloccato da un test.

### 1. `certificato`

**Premessa**: `docs/conformita.md` esiste.
**Prova**: firma presente, non segnaposto, con data **ISO**; almeno una lingua
dichiarata; sezione delle voci presente.
**MANCANTE**: file assente.

I passi che misurano il sito **non dipendono da questo**. Un gate in cui la
mancanza del contratto rende mancanti anche le misure sarebbe rosso per un
motivo solo su un sito rotto in cinque: avrebbe imparato a tacere sul resto.

### 2. `superficie-pubblica`

**Premessa**: l'app risponde; `.next/BUILD_ID` esiste; l'identità è stabilita.
**Prova**: la superficie raggiungibile, camminata da **due sorgenti
indipendenti**.

**L'identità per due vie.** Il `BUILD_ID` da solo risponde sì o no, e il «no»
copre due fatti molto diversi:

| build id | asset servito vs. disco | esito | si misura? |
|---|---|---|---|
| combacia | — | `pass` | sì |
| **non** combacia | **identico** | `fail` | **sì**: è questo sito, servito da un processo partito prima dell'ultima build |
| **non** combacia | diverso o assente | `fail` | **no**: è un'altra applicazione |

Misurato sul pilota il 2026-08-06, mentre un'altra chat ricostruiva: `next start`
era partito prima dell'ultima build e teneva in memoria il build id vecchio,
mentre `.next/BUILD_ID` su disco era già quello nuovo. Il sito era vivo e intero,
e il controllo sul solo build id diceva *«sta rispondendo un'altra applicazione
sulla stessa porta»* — additando l'imputato sbagliato. È la classe del difetto
n°1 del collaudo avversario di vetrina-crafter.

**Le due sorgenti, e perché devono restare indipendenti.** La scoperta dai
collegamenti può fallire in silenzio: una home senza `<a>`, un parser che
sbaglia. Se fosse l'unica sorgente, «ho camminato e ho trovato una pagina» e «ho
camminato e le ho trovate tutte» avrebbero lo stesso aspetto. La `sitemap.xml` è
un secondo testimone.

Ma la prima stesura le aveva fatte diventare **una sola**: la camminata partiva
anche dalle pagine della sitemap, quindi i collegamenti trovati **su quelle**
pagine rientravano fra «i collegamenti». Il sabotaggio di classe X — home senza
collegamenti, sitemap intera — usciva **verde** sul passo che esiste apposta per
vederlo. Ora la sitemap è un **seme per lo scarico**, e la raggiungibilità da `/`
si calcola sul **grafo** (`raggiungibiliDaCollegamenti`).

**Cosa non si segue**: i rimandi. Una pagina che risponde 3xx non è quella
pagina — si registra il rimando e non ci si entra. È anche il motivo per cui
l'area amministrativa non finisce nella superficie pubblica senza che nessuno
debba elencarla: risponde `307` verso l'accesso.

**Cosa si segue — l'inventario dei riferimenti navigabili (P.6-P5, P7-R2).**
La camminata non legge i soli `<a href>`: il tribunale di P.6-P4 ha ottenuto un
gate VERDE, uscita 0, su un sito che raccoglie IBAN e codice fiscale in una
pagina raggiungibile solo via `<iframe src>`. Entrano: `a href`, `area href`
(la navigazione), `iframe src` e `frame src` (documenti dell'origine mostrati
dentro la pagina, coi loro moduli), `form action` con metodo GET o assente
(premere il bottone è una GET come questa camminata), `meta http-equiv=refresh`
(la navigazione succede da sola). **Esclusioni dichiarate**: `form action` POST
(non si misura con una GET; resta il rilievo di `findingsDestinazioni`),
`link rel=alternate` (un visitatore non ci naviga, e il passo
`lingua-e-hreflang` **blocca** già un hreflang interno fuori superficie —
camminarlo spegnerebbe quel controllo), `object data` ed `embed src` (quasi
sempre media non-HTML: porta dichiarata aperta nel verbale P.6-P5).

### 3. `informativa-privacy`

**Premessa**: superficie stabilita e pagine scaricate.
**Prova**: `references/gdpr-e-cookie.md` §1.
**MANCANTE**: nessuna pagina scaricata, o la pagina dell'informativa non
scaricabile — «non si sa» non è «non c'è».

### 4. `dati-raccolti`

**Premessa**: HTML di ogni pagina letto.
**Prova**: `references/gdpr-e-cookie.md` §2-3.
**`n/a`**: zero moduli **e** zero campi su N pagine lette, con la premessa
stampata.

### 5. `archiviazione-client`

**Premessa**: ogni pagina **e ogni bundle** scaricati. Un bundle non scaricato →
**MANCANTE**, mai «pulito».
**Prova**: `references/gdpr-e-cookie.md` §4-5.
**`n/a`**: zero cookie, zero API di archiviazione, zero terzi, con il conteggio
di pagine e script letti.

### 6. `accessibilita-servita`

**Premessa**: HTML di ogni pagina scoperta.
**Prova**: `references/accessibilita-servita.md`.

### 7. `lingua-e-hreflang`

**Premessa**: il certificato dichiara almeno una lingua. Senza, **MANCANTE**: un
`n/a` sarebbe una risposta senza domanda.
**`n/a`**: una sola lingua misurata su tutte le pagine e nessun indizio di rotte
per lingua.

### 8-12. Le cinque voci tornate a casa (D21, 2026-08-06)

`favicon` · `open-graph` · `dati-strutturati` · `sitemap-xml` · `robots-txt`.

**Premessa**: la superficie e' stabilita **e completa** (nessuna pagina scoperta
e non scaricata, nessun troncamento, nessuna scadenza).

**Il criterio comune, e vale per tutte e cinque**: *il dichiarato che non
risponde e' un bloccante, l'assenza e' un rilievo.* Una pagina che scrive
`<link rel="icon" href="/favicon.svg">` e serve un `404` ha **mentito nel markup
servito**, e chi legge quel markup — un browser, un motore, il prossimo agente —
sbaglia per causa sua. Un'assenza invece e' una scelta, e una scelta si firma in
una deroga.

| passo | bloccante | rilievo |
|---|---|---|
| `favicon` | un'icona dichiarata che non risponde `200`; **oppure** nessuna icona dichiarata e `/favicon.ico` che non risponde `200` (e' il difetto del pilota, dove la favicon e' stata un `404` per tre anelli) | alcune pagine dichiarano l'icona e altre no |
| `open-graph` | `og:image` che punta a una risorsa che non risponde | nessun tag `og:` sul sito; alcune pagine senza; `og:title`/`type`/`url`/`image` mancanti dove l'Open Graph c'e' |
| `dati-strutturati` | un blocco `application/ld+json` che **non e' JSON valido** (un motore lo scarta per intero, e il sito crede di avere dati strutturati) | nessun blocco sul sito; un blocco senza `@type` |
| `sitemap-xml` | `200` con un corpo che non e' una sitemap (un `200` che serve un'altra cosa e' peggio di un `404`); un indirizzo dichiarato e non servito; una **sotto-sitemap promessa dall'indice** che non risponde o non e' un `<urlset>` | sitemap assente o non `200`; sitemap valida con zero indirizzi |
| `robots-txt` | vieta ai motori indirizzi che la **`sitemap.xml` pubblicizza**: sono due file dello stesso sito che dicono il contrario | `robots.txt` assente; vieta pagine pubbliche non in sitemap; nessuna riga `Sitemap:`; `Sitemap:` verso un'altra origine |

**Perche' cinque passi e non uno.** La tabella di proprieta' assegna UNA voce a
UN proprietario, e il confronto §19 lega la riga del certificato allo stato del
passo. Un passo unico «indicizzazione» darebbe a cinque voci lo stesso `id`,
cioe' rifarebbe al contrario il difetto che questa skill esiste per chiudere.

**Il confronto che nessuno faceva.** `robots.txt` contro `sitemap.xml` era
elencato fra le cose scoperte del collaudo P2 — «due file che scrive lo stesso
agente e che nessuno confronta». Con D21 sono tutti e due di questa skill.

**La `<sitemapindex>` (P.6-P5, P4-R4 + P7-R3).** È il formato che
`generateSitemaps()` di Next produce da solo: le sue `<loc>` sono **altre
sitemap**, non pagine. Prima ognuna prendeva un `block` «dichiarata e non
servita» e i file XML entravano nella camminata come pagine — un ROSSO su un
sito conforme, che è il modo in cui un gate si fa scavalcare per abitudine.
Ora l'indice si riconosce, le sotto-sitemap si **seguono** (fino a
`MAX_SOTTO_SITEMAP` = 50, tetto dichiarato: oltre, il passo è **MANCANTE** —
un elenco letto a metà non è un elenco verificato) e le pagine sono l'unione
delle loro `<loc>`. Il tetto NON tocca il numero di `<loc>` per sitemap: la
coda della camminata può ancora nascere enorme da una sitemap sola (P2-R10,
dichiarata aperta).

### 13. `perimetro`

**Premessa**: la sezione delle voci esiste.
**Prova**: `references/perimetro.md`.
Sta **dopo** i passi che misurano, perché confronta l'esito **dichiarato** delle
voci mie con lo stato dei passi di **questa** esecuzione. È la §19 applicata
voce per voce.

### 14. `contratto-uscita`

`DECISIONI.md` §19. L'handoff esiste, non ha segnaposto, e la sua riga `Gate:`
combacia col verdetto di questa esecuzione. **Non è un rosso strutturale**: se il
gate è rosso e l'handoff dichiara rosso, il passo passa — dichiarare non è
fallire.

## Il contratto `--json`

`DECISIONI.md` §15: ogni passo ha un `id` stabile, separato dall'etichetta
italiana, così l'etichetta può cambiare senza rompere l'orchestratore.

```json
{
  "contract": 1,
  "ok": false,
  "scadenza": 300,
  "scaduta": false,
  "summary": { "passi": 14, "pass": 1, "fail": 5, "skipped": 8, "na": 0, "ignoti": 0 },
  "steps": [ { "id": "certificato", "name": "…", "status": "skipped", "detail": "…" } ]
}
```

Le chiavi restano in inglese come nelle altre skill (§15): il formato di scambio
è nato così, e mescolare le due lingue nello stesso oggetto è peggio di entrambe.
`status` vale `pass` · `fail` · `skipped` · `n/a`.

## La scadenza complessiva — `--scadenza`

**Un gate ucciso produce il MANCANTE peggiore che esista: un silenzio che nessuno
ha scritto.** Il timeout per richiesta (15 s × 2 tentativi) impedisce di restare
appesi su UNA pagina — misurato: un server che scrive un byte al secondo e non
chiude mai costa 30,8 s e produce un `block` onesto. Non impedisce che sessanta
pagine ostili costino mezz'ora, e in CI il lavoro viene ucciso dal proprio
timeout prima di produrre un verdetto.

### Il default, e come e' stato ottenuto

Misura sul banco «studio legale» il 2026-08-06, quattordici passi, dieci pagine,
con un ritardo artificiale su ogni risposta (`banco-sl.mjs --ritardo`):

| ritardo per risposta | 0 ms | 25 ms | 50 ms | 100 ms | 200 ms |
|---|---|---|---|---|---|
| giro completo | 298 ms | 859 ms | 1419 ms | 2356 ms | 4334 ms |

**19 richieste** per 10 pagine, e una pendenza di **20,2 ms per ogni ms di
ritardo**: le richieste sono in pratica seriali, e il costo di un giro e'
`avvio + richieste × (locale + RTT)`.

Le richieste sono ~1,9 per pagina su questo banco; su un Next con un pezzo di
codice per rotta arrivano a ~2. Al tetto documentato (`MAX_PAGINE` = 60) fanno
**circa 126 richieste**, quindi:

| RTT | giro completo, estrapolato |
|---|---|
| 1 ms (locale) | ≈ 2 s |
| 200 ms | ≈ 27 s |
| 500 ms | ≈ 65 s |
| 1 s (pessimo) | ≈ 128 s |

**300 secondi** stanno 2,3 volte sopra il caso sano peggiore e tagliano il caso
patologico da mezz'ora a cinque minuti. Il pilota, per confronto, gira in
356-584 ms su sei pagine. Chi ha un sito più grande alza il numero **e lo
scrive**: alzarlo è una decisione, lasciarlo scadere in silenzio no.

### Cosa succede quando scade

- L'attesa di ogni richiesta si accorcia al tempo che resta, e il secondo
  tentativo non parte: scadere non deve costare altri 15 secondi.
- **La scadenza sorveglia anche i cicli di lettura, non solo la rete**
  (P.6-P5, P2-R2): ogni passo che itera sulle pagine la controlla **a ogni
  pagina** — prima nessun ciclo di CPU la guardava, e il passo a11y non
  riceveva nemmeno `args`. La granularità dichiarata è LA PAGINA: dentro la
  lettura di una singola pagina il controllo non entra, e il superamento
  massimo è il costo di una. Misurato su un banco di 26 pagine da ~1,3 MB con
  `--scadenza 8`: il gate di prima chiudeva in **13 s** (+62%), questo in
  **8 s**, con ogni passo `skipped` col motivo e il conteggio («si è fermato
  dopo aver letto i moduli di 8 pagine su 26»).
- La camminata si interrompe, e il passo 2 diventa **`skipped`** — non `fail`: la
  causa non è il sito, è il tempo che gli abbiamo dato. I rilievi trovati sulle
  pagine già lette restano stampati, perché sono misure vere. (`--max-pagine`
  invece resta un `fail`: lì il tetto lo sceglie chi lancia il gate.)
- Ogni passo non completato è **`skipped`** con il motivo **e il conteggio di
  quello che aveva guardato** — mai `pass`, mai `n/a`.
- Ogni passo ha comunque il suo `record`: `steps[]` ha sempre quattordici voci, e
  **la riga finale si stampa sempre**.
- `--json` porta `scadenza` e `scaduta`: un consumatore distingue «rosso perché
  il sito è rotto» da «rosso perché il gate non ha fatto in tempo» senza leggere
  la prosa.

Provato con dodici scadenze diverse (1-16 s) contro un banco che risponde a
400 ms: quattordici passi e un verdetto stampato **in tutti e dodici i giri**,
con la scadenza che cade in punti diversi del gate.

## Nessuno strumento esterno, e cosa costa

Questo gate usa `fetch` e la lettura di file. Niente `npx`, niente shim `.cmd`,
niente browser.

**Conseguenza dichiarata**: gli serve **l'interprete**, non il `PATH`. La nota
di macchina del 2026-08-06 — *«lanciare col Node 24» e «avere il Node 24 nel
`PATH`» non sono la stessa cosa*, misurata dal direttore sul Lighthouse di
speed-demon — qui **non si applica**, e il gate gira col node di sistema (20.12.2
su questa macchina).

**Prezzo**: i contrasti non si misurano. Sono delegati, ed è scritto nel
perimetro.

## I modi noti in cui questo gate potrebbe essere verde senza aver guardato

Tutti hanno un test che comincia con «falso verde», e ognuno cita se viene dallo
STOP di progettazione o dal sabotaggio.

| # | Il falso verde | Chiuso da |
|---|---|---|
| 1 | il carico RSC conta come DOM (due `h1`, un `img` che non esiste) | `senzaScript`, che toglie il **corpo** degli script |
| 2 | `autoComplete` letto come attributo diverso da `autocomplete` | nomi degli attributi normalizzati in minuscolo |
| 3 | la camminata non cammina e la sitemap la copre | grafo indipendente + `block` se i collegamenti danno ≤1 pagina e la sitemap di più |
| 4 | l'informativa cercata a percorsi indovinati | i candidati vengono dai **collegamenti** |
| 5 | un'informativa che c'è ma è un segnaposto | `block` sui segnaposto serviti e sulle 400 battute |
| 6 | un terzo non visto perché gli script erano stati ripuliti via | `terziDi` sui tag intatti (sabotaggio H) |
| 7 | un bundle non scaricato letto come «pulito» | **MANCANTE** se anche uno solo non risponde |
| 8 | hreflang «non applicabili» perché non ce n'è nessuno | premessa **indipendente**: i `lang` misurati |
| 9 | una gerarchia dei titoli rotta con il passo verde | salto di livello promosso a `block` (sabotaggio M) |
| 10 | una voce di conformità che sparisce accorciando il documento | l'elenco `VOCI` vive nel **codice** |
| 11 | una voce delegata a un file che non esiste | il file si legge e deve **nominare** la voce |
| 12 | il certificato dichiara conforme una voce che il gate misura rossa | confronto per voce con lo stato del passo |
| 13 | un'app diversa misurata come se fosse questa | identità per due vie |
| 14 | un valore vuoto che si porta dietro la riga successiva | `[^\S\n]` invece di `\s` attorno ai due punti |

## I passi valutati e **scartati**

| passo scartato | perché |
|---|---|
| **contrasti di colore** | vorrebbe un browser: cascata, specificità, `currentColor`, gradienti, immagini di sfondo. speed-demon lo misura già dentro la categoria `accessibility` di Lighthouse. Rifarlo qui, peggio, per poi vederlo divergere: no |
| **verifica del testo dell'informativa** (che dica il vero, non solo che nomini le voci) | è comprensione di un testo. Un controllo su prosa libera è un controllo che non c'è (§19) |
| **crawl con browser** (per vedere cookie e moduli costruiti in JavaScript) | trascinerebbe Playwright o Chrome dentro una skill che oggi non ha dipendenze esterne, e duplicherebbe l'infrastruttura di flow-sentinel. La proposta giusta è **a flow-sentinel**, ed è scritta nello `STATO.md` |
| **validazione HTML** (W3C) | rumore: produce centinaia di rilievi su ogni progetto Next, e nessuno di quelli che contano per la conformità |
| **misura del tempo di risposta** | è di speed-demon, e sarebbe la terza misura della stessa cosa |
| **verifica che i file citati dai vicini dicano «fatto»** | vedi sopra: comprensione di un testo |
| ~~**`robots.txt` e `sitemap.xml` come voci misurate**~~ | **scartato fino al 2026-08-05, ripreso il 2026-08-06 con D21.** Erano di speed-demon, e una misura ha trovato che il suo gate non li rilegge: la proprietà segue la misura, non l'argomento. Restano due domande distinte — la `sitemap.xml` si **legge** come seconda sorgente nel passo 2, e si **verifica** nel passo 11 |

## Le trappole di piattaforma già pagate

- **Il carico RSC** è HTML dentro `<script>`: vedi sopra.
- **`getSetCookie()` e' l'unico modo di leggere i cookie**, e la ricaduta su
  `headers.get("set-cookie")` e' stata **tolta** dal tribunale del 2026-08-06:
  quel metodo restituisce le intestazioni fuse con una virgola, e una virgola
  dentro un `Expires=Wed, 09 Jun 2027` non si distingue da un separatore. Con due
  `Set-Cookie` — uno dichiarato e uno di tracciamento — il secondo spariva. Senza
  il metodo, i cookie non si sanno leggere e il passo lo **dichiara**: `skipped`.
- **`\b` dopo una lettera accentata non esiste**: in JS senza il flag `u` la
  parola-confine è definita su `[A-Za-z0-9_]`, quindi `/^s[iì]\b/` non trova
  niente dopo la `ì` di «sì». `Banner di consenso: sì` si leggeva come «no».
- **Un timeout su ogni richiesta.** Senza, un server che accetta la connessione e
  non risponde lascia il gate **appeso**: né verde né rosso. È il punto aperto
  n°6 dello `STATO.md` di vetrina-crafter, chiuso qui alla nascita.
- **`spawnSync` blocca il ciclo di eventi**: un server HTTP acceso nello stesso
  processo del gate non risponderebbe mai. Il banco vive in un processo suo — e
  la misura del difetto è nel verbale (26 classi su 26 con
  `superficie-pubblica: skipped` su un banco vivo).
