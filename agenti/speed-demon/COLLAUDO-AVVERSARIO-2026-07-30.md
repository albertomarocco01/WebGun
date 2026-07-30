# Collaudo avversario di Speed Demon — 2026-07-30

Il punto 1 di `STATO.md` diceva: «un solo banco, e l'ho scritto io». Speed Demon
era stato costruito e collaudato lo stesso pomeriggio, sulla stessa app, dalla
stessa mano che ne scriveva le regole, e su un banco dove **non c'era niente da
ottimizzare** — 100/100 in partenza, due pagine di testo senza immagini. Questo
verbale e' il P2: sessione separata, dominio nuovo, pagine davvero lente, e la
caccia ai falsi verdi nei sette passi del gate.

Ne sono usciti **diciassette difetti**, tutti misurati prima di essere corretti,
tutti con un test di regressione:

- **dodici falsi verdi**, che e' la classe che questa casa insegue;
- **quattro rifiuti indebiti**: il gate che boccia il proprio template, fino a
  rifiutare la firma di un umano con nome e ruolo;
- **uno che misurava col profilo sbagliato in silenzio**, ne' verde ne' rosso —
  solo un altro metro.

Il diciassettesimo non e' stato cercato: si e' presentato da solo, mentre si
rilanciava il gate corretto sul banco vecchio, ed e' il piu' grave di tutti
(§3.6).

La cosa piu' scomoda: **sei difetti su diciassette erano gia' descritti, per
iscritto, dentro le references della skill**. `seo.md` §309 spiega «contare, non
trovare»; §313 nomina il `<title>` dentro un `<svg>` inline; §296 prescrive
`redirect: "manual"` con la motivazione esatta; §119 dice di confrontare i
canonical di tre pagine diverse; `misurazione.md` §256 prescrive di confrontare
`requestedUrl` con `finalDisplayedUrl`, e §211 annota il build id accanto
all'URL misurato. Il gate non ne implementava **nessuno**.
La prosa sapeva; il codice no.

---

## 1. Cosa e' stato collaudato, e cosa questo verbale NON dimostra

**Collaudato:** i sette passi di `scripts/verify.mjs`, il template
`resources/templates/performance.md`, e i comandi `measure`, `plan` e `tune` su
guadagni veri.

**NON collaudato, e va detto subito:**

- **`rete-verde` sul banco nuovo.** Non ha batteria E2E (scelta motivata in
  `banco-prova-immobiliare/docs/PROGETTO.md`), quindi li' quel passo e' rimasto
  MANCANTE per tutta la durata del collaudo. **E' stato pero' esercitato sul
  banco vecchio** (§4.2): verde quando l'app e' quella giusta, rosso quando la si
  punta su un'altra.
- **Le pagine autenticate.** Nessuna, qui. Il residuo dichiarato al §6.1 non e'
  stato riprodotto: e' stato dedotto dal codice e dal template.
- **Il campo.** Nessun dato CrUX o RUM. Lighthouse resta un laboratorio.
- **Un progetto cliente.** Questo e' un banco costruito da chi collaudava.

---

## 2. Il banco: `banco-prova-immobiliare` — Case di Langa

Agenzia immobiliare ad Alba. Dominio scelto apposta diverso dagli altri banchi
(e-commerce, veterinaria, accademia musicale): un sito immobiliare vive di
fotografie grandi, che sono la prima causa di lentezza dei siti veri.

Next.js 15.5 App Router + TypeScript + Tailwind 4, **senza Supabase e senza
Playwright** — deroga motivata in `docs/PROGETTO.md`: il gate di Speed Demon non
tocca il database, e un banco con un database che nessuno interroga sarebbe
manutenzione senza collaudo.

Le fotografie sono **rumore generato con seme fisso** (`npm run foto`, 21,3 MB in
quattro PNG scritti a mano con `zlib`, nessuna dipendenza): il rumore non si
comprime, quindi il peso e' garantito e identico su due macchine.

Sei difetti piantati, ognuno con la sua nota nel file che lo ospita:

| Dove | Difetto | Cosa doveva misurare |
|---|---|---|
| `page.tsx` | foto da 6,2 MB in un `<img>` nudo | LCP e CLS veri |
| `CalcolatoreRata.tsx` | ammortamento calcolato sincrono in idratazione | TBT vero |
| `immobili/page.tsx` | `canonical` che punta a `/` | se `seo-meta` guarda la verita' del canonical o solo la presenza |
| `agenzia/page.tsx` | nessun `title`, un `<title>` dentro un'icona SVG | se il gate distingue il titolo del documento da quello di un'immagine |
| `riservata/page.tsx` | rotta che rimanda a `/contatti` | se il gate si accorge di misurare un'altra pagina |
| `docs/performance.md` | scritto **attenendosi al template** | se il gate legge il contratto che il suo template insegna |

---

## 3. I diciassette difetti

### 3.1 Il gate non sapeva leggere il contratto che il suo template insegna a scrivere

Prima esecuzione, contratto compilato seguendo `resources/templates/performance.md`
alla lettera (`banco-prova-immobiliare/docs/collaudo/giro-A-contratto-forma-template.txt`):

```
FAIL  contratto delle pagine e delle soglie
        4 pagine · form factor: mobile · deroghe scritte: 0
        [block] docs/performance.md: manca la riga `Confermato da:` ...
        [block] pagina home: nessuna soglia dichiarata per `/` ...
        [block] pagina immobili: nessuna soglia dichiarata per `/immobili` ...
        [block] pagina agenzia: nessuna soglia dichiarata per `/agenzia` ...
        [block] pagina riservata: nessuna soglia dichiarata per `/riservata` ...
```

Il contratto dichiarava **profilo desktop** e **una deroga scritta**, ed era
firmato. Il gate leggeva `mobile`, `0` deroghe e nessuna firma. Nessuno dei
cinque rilievi parlava del sito. Sotto ci sono cinque difetti distinti.

**D1 — le soglie del template non si agganciano.** `RIGA_SOGLIA` pretendeva la
categoria nuda e il valore nudo:

```
template:  | `performance` | >= 85 | 71 | ±4 | 93 |   → NESSUNA SOGLIA LETTA
banco:     | performance   | 95 |                     → letta
```

Gli apici inversi e il `>=` sono ornamento: il numero e' lo stesso. Corretto
allargando l'espressione, non restringendo il template — le colonne baseline,
dispersione e misura finale sono quelle per cui il template esiste.

**D2 — la tabella delle deroghe a sei colonne non si legge, e a cinque mente.**
Misurato con la stessa riga, cambiando solo gli apici:

```
| `home` | `performance` | >= 85 | 79 | motivo | firma |  → NESSUNA DEROGA LETTA
| `home` | performance   | >= 85 | 79 | motivo | firma |  → motivo = ">= 85 | 79 | motivo | firma"
```

Cioe': o la deroga spariva — e la pagina tornava `block` con la sua
giustificazione scritta due righe sotto — oppure veniva letta con un motivo che
conteneva tre colonne altrui. Corretto leggendo la tabella **dalla sua
intestazione**, mappando le colonne `pagina`/`categoria`/`motivo` per nome:
venti righe, e il gate smette di dipendere da un numero di colonne.

**D3 — una firma umana veniva rifiutata.** `firmaVera` pretendeva la parola
letterale `UMANO` o `ORCHESTRATORE`:

```
Confermato da: Elena Barbieri (titolare) (2026-07-24)      → RIFIUTATA
Confermato da: Alberto Marocco, sviluppatore (2026-07-30)  → RIFIUTATA
Confermato da: ORCHESTRATORE (2026-07-30)                  → accettata
```

Il template chiede nome e ruolo, «perche' fra sei mesi *confermato dal cliente*
non identifica nessuno». Quindi l'unica firma che il gate accettava era quella
**senza nessun nome**, e la modalita' **interattiva** descritta nella SKILL — un
umano che dice si' — non poteva passare il proprio gate. A tenere fuori i
segnaposti basta il controllo sui segnaposti, che resta.

**D4 — il profilo dichiarato non veniva letto.** Il template non contiene una
riga `Form factor:`: scrive `Metodo: … · profilo desktop`. Il gate cercava solo
la prima e cadeva sul ripiego `mobile`.

Quanto costa e' stato misurato sulla home di questo banco, stessa build:

| profilo | performance | LCP | TBT |
|---|---|---|---|
| desktop | 77 | 5 496 ms | **0 ms** |
| mobile | 63 | 33 474 ms | **478 ms** |

Quattordici punti, un LCP sei volte piu' lungo, e **un'intera metrica che
esiste in un profilo e non nell'altro**. Non e' una differenza di precisione: e'
un'altra macchina. Un contratto che dichiara desktop e viene misurato in mobile
confronta soglie decise su un metro con numeri presi con l'altro.

**D5 — la dispersione firmata nel contratto non la leggeva nessuno.**
`misurazione.md` §78: «se la dispersione supera **la soglia dichiarata nel
contratto**, la misura non e' bassa: e' MANCANTE», e §118 e §216 fissano la
convenzione della casa a **5 punti**. Il gate ne aveva una **cablata a 10** e non
leggeva la riga. Misurato:

```
immobili (/immobili) · 3/3 giri: performance 75±8   → contratto: MANCANTE · gate: pass
```

Corretto leggendo `Dispersione massima ammessa: N` dal contratto, e portando il
ripiego da 10 a **5**, che e' il numero che la documentazione della skill
dichiara da sempre.

**D6 — `URL misurato:` era una promessa mai mantenuta.** Il template dichiara la
precedenza «flag esplicito > questa riga > MAI l'ambiente»; il gate usciva con
codice 2 quando `--url` mancava, anche con l'indirizzo scritto e firmato nel
contratto. Ora la legge. Il divieto che l'ha generata resta intatto: qui non si
indovina niente — si legge un valore che un umano ha firmato.

### 3.2 Un passo verde che diceva il contrario di quel che era successo

**D7.** Nello stesso giro A, due righe sotto i quattro `block` sulle soglie:

```
OK    soglie dichiarate
        ogni pagina dichiarata rispetta la sua soglia
```

Zero soglie lette, e il passo dichiarava che ogni pagina rispettava la sua.
Adesso, con zero soglie leggibili, `budget` e' **MANCANTE** e lo dice.

### 3.3 `seo-meta` verde su quattro pagine, di cui tre rotte

Seconda esecuzione, contratto riscritto nella forma che il gate sapeva leggere
(`docs/collaudo/giro-B-prima-delle-correzioni.txt`):

```
OK    metatag nell'HTML servito
        title, description e canonical presenti su 4 pagine
```

Le quattro pagine erano: una sana, e tre con un difetto SEO ciascuna. Sotto ci
sono sei difetti del gate.

**D8 — il `<title>` di un'icona SVG passava per il titolo della pagina.**
`/agenzia` non ha `<title>` nella testa; nel corpo ha un'icona telefono con il
suo `<title>`, che e' **esattamente cio' che un revisore di accessibilita'
chiede di mettere**. Misurato sull'HTML servito:

```
/agenzia   title: "Telefono"
```

`seo.md` §313 lo diceva gia': «un `<title>` dentro un `<svg>` inline e' un altro
elemento in un altro spazio di nomi e viene catturato dalla stessa espressione.
O si estraggono gli attributi tag per tag senza assumerne l'ordine, o **il
residuo si dichiara**». Non era stata fatta ne' l'una ne' l'altra cosa.

E c'e' un confronto che vale piu' di ogni argomento: **Lighthouse lo vedeva**.

```
=== /agenzia ===
  FALLITO: document-title — Document doesn't have a `<title>` element
```

Il passo dedicato ai metatag, che esiste perche' «un punteggio SEO 100 non dice
che i metatag ci sono», era piu' debole della categoria generica misurata due
passi prima nello stesso gate.

**D9 — si cercava la prima occorrenza invece di contarle.** Due `<title>` nello
stesso documento sono un difetto (succede quando un componente ne rende uno e
React lo issa nella testa accanto a quello di `metadata`); due `rel=canonical`
sono peggio, perche' Google li ignora **entrambi**. Il gate leggeva il primo e
taceva. `seo.md` §309, parola per parola: «un controllo che si ferma al primo
`match` dichiara verde».

**D10 — `robots` si leggeva in un ordine di attributi solo.** `description` e
`canonical` avevano tutt'e due gli ordini, e pure il test che lo dimostra;
`robots` no. Misurato:

```
<meta name="robots" content="noindex, nofollow">   → robots letto → block
<meta content="noindex, nofollow" name="robots">   → robots = null → PASS
```

La seconda forma e' HTML legale. Una pagina davvero esclusa dall'indice passava
come pubblica.

**D11 — `X-Robots-Tag` non veniva mai letto.** `seo.md` §311: «l'intestazione
vale quanto il metatag e sta fuori dal corpo. Il caso da cercare per primo e' una
regola di `headers()` scritta per il backoffice con un `source` piu' largo di
quanto si credesse — o un `noindex` da ambiente di collaudo mai tolto — che rende
`noindex` l'intero sito: nel sorgente delle pagine non c'e' **niente** da
vedere». Il gate non guardava le intestazioni.

**D12 — nessun confronto fra i canonical di pagine diverse.** `/immobili`
dichiarava `canonical` a `/`: l'errore di copia-incolla piu' comune che esista su
un sito con piu' rotte. Il gate verificava che il tag ci fosse. `seo.md` §119
prescriveva la difesa: «si leggono i canonical di almeno tre pagine diverse e si
controlla che siano diversi. Guardando solo la home il difetto e' invisibile,
perche' la home il canonical giusto ce l'ha».

E anche qui **Lighthouse lo vedeva**:

```
=== /immobili ===
  FALLITO: canonical — Document does not have a valid `rel=canonical`
```

Corretto con due regole di gravita' diversa, perche' il difetto ha due facce:
due pagine dichiarate che condividono un canonical sono un `block` (al massimo
una delle due e' l'originale, ed e' un fatto, non un giudizio); un canonical che
punta altrove senza collisioni e' un `warn`, perche' una variante che si dichiara
copia della principale e' legittima e «quale delle due sia la principale e' una
decisione di prodotto» (`seo.md` §356).

**D13 — i rimandi venivano seguiti.** `preleva` usava `redirect: "follow"`.
`/riservata` risponde 307 verso `/contatti`, e il gate leggeva i tag di
`/contatti` attribuendoli a `/riservata`:

```
/riservata   HTTP 200 | url finale: http://127.0.0.1:3200/contatti
             title: "Contatti — Case di Langa"
             canonical: "http://127.0.0.1:3200/contatti"
```

`seo.md` §296 prescriveva `redirect: "manual"` con questa motivazione esatta:
«seguire un 307 verso `/accedi` significherebbe misurare i metatag della pagina
di accesso credendo di misurare quelli di `/admin`».

### 3.4 Il punteggio di un'altra pagina, scritto accanto al nome sbagliato

**D14.** Lo stesso rimando falsifica la misura, non solo i tag. Misurato
lanciando Lighthouse a mano su `/riservata`:

```
requestedUrl     : http://127.0.0.1:3200/riservata
finalDisplayedUrl: http://127.0.0.1:3200/contatti
performance      : 100
seo              : 100
```

E infatti il giro B riportava `riservata (/riservata) · 3/3 giri: performance
100 · seo 100`. Una rotta che non e' un documento portava a casa il punteggio
pieno, preso su un'altra pagina.

`misurazione.md` §256 lo prescriveva: «in ogni JSON si confrontano `requestedUrl`
e `finalDisplayedUrl`; se differiscono, la misura riguarda un'altra pagina e va
rifatta o ridichiarata». Il gate leggeva solo `report.categories` e buttava via
le due righe che glielo dicevano.

**D15 — `misura` chiudeva `pass` con pagine non misurate.** Bastava che una sola
pagina producesse giri: il residuo finiva in una riga di dettaglio e il passo era
verde. Adesso una pagina dichiarata e non misurata rende il passo rosso.

### 3.5 Le deroghe che non coprono niente

**D16.** Il template promette: «riga di deroga che nomina una pagina non
dichiarata qui sopra: `warn`». Il gate non guardava affatto le deroghe non usate.
Sono due casi e fanno lo stesso danno — una giustificazione scritta che sembra
valida e non copre piu' niente:

- nomina una pagina che il contratto non dichiara (l'avanzo di una pagina
  rinominata);
- nomina una pagina che **rispetta** la soglia. Successo su questo banco: dopo
  `next/image`, `immobili · performance` e' passata da 75 a 100 e la sua deroga
  e' rimasta li' a sembrare vera.

### 3.6 Il gate non sapeva se stava misurando l'app di questo progetto

**D17**, e non e' stato cercato. Alla fine del collaudo, per verificare di non
aver rotto il gate sul banco dove era stato validato, si e' rilanciato tutto su
`banco-prova-negozio`. `npx next start -p 3100` — la porta che il contratto
firmato di quel banco dichiara nel suo `Comando:` — e' morto con `EADDRINUSE`.
Guardando **chi** occupava le porte di questa macchina:

```
3000 -> PID 24308  Desktop\Baldisport\sito-web-baldisport
3001 -> PID 43012  Desktop\Alberto Marocco
3100 -> PID 23640  Desktop\GMSolar\site        ← next start -p 3100
3200 -> PID 39964  banco-prova-immobiliare
```

Sulla 3100 c'era il sito di **un'altra azienda**. Un `--url
http://127.0.0.1:3100` scritto in buona fede — copiato dal contratto firmato del
banco — avrebbe misurato quello, e nessuno dei sette passi se ne sarebbe accorto:
la build era di produzione, l'app rispondeva 200, i metatag c'erano. Sarebbero
usciti numeri plausibili di un sito che non e' quello.

Questo e' il precedente che la casa credeva di aver gia' pagato. Il commento in
testa a `verify.mjs` dice: «`--url` NON ha un default, ed e' deliberato: un gate
che indovina `localhost:3000` misura l'app di un altro progetto e stampa `pass`».
Vero, e insufficiente: **`--url` obbligatorio impedisce di indovinare la porta,
non di sbagliarla**. E la porta sbagliata qui non veniva da una svista: veniva da
un documento firmato.

La difesa era gia' scritta anche questa, in `misurazione.md` §211, dove l'URL
misurato va annotato «`next start`, build id `<.next/BUILD_ID>`, commit `<sha>`»:
il build id di Next e' l'identificatore, e non era mai stato usato per
verificare niente. Misurato negli stessi minuti:

```
BUILD_ID di banco-prova-immobiliare: XtsnTQLMj1ATFL1bAIQnj
  compare nell'HTML servito dalla 3200 (il suo):        1 volta
  compare nell'HTML servito dalla 3100 (di un altro):   0 volte
```

Il passo `build-produzione` ora legge `.next/BUILD_ID` del progetto e pretende di
trovarlo nell'HTML servito. Se manca il file, il passo e' **MANCANTE**, non
`pass`: non si e' potuto verificare l'identita' dell'app. Il build id si stampa
**anche sul verde**, come Flow Sentinel fa con URL e database dal `DECISIONI.md`
§11: un gate che ha guardato un'altra app non deve poter assomigliare a uno che
ha guardato la tua.

**Sabotaggio, per provare che il passo scatta.** Gate di Bottega Nord puntato
sulla 3100:

```
GATE PERFORMANCE: ROSSO (3 falliti, 3 verifiche mancanti su 7 passi)

OK    contratto delle pagine e delle soglie
FAIL  rete E2E di Flow Sentinel
        gate flussi: ROSSO (2 falliti, 0 mancanti su 7 passi)
FAIL  build di produzione (non dev server)
        http://127.0.0.1:3100 (HTTP 200) risponde, ma NON e' l'app di questo progetto.
          build id di ...\banco-prova-negozio: eH-lBkIueW6ICN81sfsCz
          non compare da nessuna parte nell'HTML servito da quell'indirizzo.
MANC  misura Lighthouse (mediana di N giri)
        l'app non e' stata riconosciuta come build di produzione: misurarla direbbe altro
```

Rosso sul passo giusto, con la diagnosi giusta, e i passi a valle **MANCANTI**
invece che verdi. Da notare che anche `rete-verde` e' diventato rosso da solo: la
batteria di Flow Sentinel, girata contro l'app sbagliata, non ha trovato quello
che cercava. Sono due difese indipendenti, e una sola delle due basta a evitare
il disastro — ma la seconda dice «i test falliscono», non «stai guardando un
altro sito».

---

## 4. La prova d'insieme: stesso banco, stessi difetti, gate corretto

Il giro C e' stato lanciato sul banco **invariato** — nessuna riga dell'app
toccata fra B e C — e senza `--url`, per provare anche D6.

| passo | giro B (prima) | giro C (dopo) |
|---|---|---|
| `contratto-performance` | **FAIL**, 5 rilievi sulla forma del template | **OK** — firma umana, `desktop`, 1 deroga |
| `rete-verde` | MANCANTE | MANCANTE (il banco non ha batteria) |
| `build-produzione` | OK | OK |
| `misura` | OK — `riservata … performance 100` | **FAIL** — `SCARTATA — riservata (/riservata) → /contatti` |
| `budget` | 3 bloccanti | 5 — fra cui `dispersione 8 punti (massimo ammesso 5)` |
| `seo-meta` | **OK** «presenti su 4 pagine» | **FAIL** — 4 rilievi, uno per difetto piantato |
| `contratto-uscita` | FAIL (handoff assente) | FAIL (handoff assente) |

I quattro rilievi di `seo-meta` nel giro C, per esteso:

```
[block] pagina immobili: dichiara lo stesso `canonical` di `home` (http://127.0.0.1:3200)
[warn]  pagina immobili: `canonical` punta a `/` e non a `/immobili`
[block] pagina agenzia: manca `title` nell'HTML servito di `/agenzia`
[block] pagina riservata: `/riservata` rimanda a `/contatti`
```

Tre difetti SEO veri, ognuno col suo nome e la sua pagina, dove prima c'era una
riga sola che diceva «presenti su 4 pagine».

### 4.1 L'ultimo giro, a ottimizzazioni applicate

```
GATE PERFORMANCE: ROSSO (0 falliti, 1 verifiche mancanti su 7 passi)

OK    contratto delle pagine e delle soglie
        3 pagine · form factor: desktop · deroghe scritte: 0
        confermato da: Alberto Marocco (sviluppatore, collaudo avversario) (2026-07-30)
MANC  rete E2E di Flow Sentinel
OK    build di produzione (non dev server)
OK    misura Lighthouse (mediana di N giri)
        dispersione massima ammessa: 5 punti (dichiarata nel contratto)
        home (/) · 3/3 giri: performance 100±0 · accessibility 100±0 · best-practices 100±0 · seo 100±0
        immobili (/immobili) · 3/3 giri: performance 100±0 · accessibility 100±0 · best-practices 96±0 · seo 100±0
        agenzia (/agenzia) · 3/3 giri: performance 100±0 · accessibility 100±0 · best-practices 100±0 · seo 100±0
OK    soglie dichiarate
        12 soglie confrontate: ogni pagina dichiarata rispetta la sua
OK    metatag nell'HTML servito
        title unico, description e canonical proprio su 3 pagine · nessun noindex nel corpo ne' nelle intestazioni
OK    contratto d'uscita (handoff)
```

**Sei passi su sette verdi, e il gate resta ROSSO** perche' `rete-verde` e'
MANCANTE. E' la regola della casa applicata a se stessa: un banco senza batteria
E2E non produce un verde, e questo verbale non ne rivendica uno. `/immobili` a
`best-practices 96` e' spiegato al §5.4.

### 4.2 Nessuna regressione sul banco dove il gate era stato validato

Cambiare un gate condiviso senza rilanciarlo dove era stato validato e' come
scrivere un numero senza il comando che l'ha prodotto. Quindi: Supabase riacceso,
build di produzione di `banco-prova-negozio`, e gate corretto sulla **3110** —
perche' la 3100 era occupata da un altro progetto (§3.6).

```
GATE PERFORMANCE: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    contratto delle pagine e delle soglie
        2 pagine · form factor: desktop · deroghe scritte: 1
        confermato da: ORCHESTRATORE (2026-07-30)
OK    rete E2E di Flow Sentinel
        gate flussi: VERDE (0 falliti, 0 mancanti su 7 passi)
OK    build di produzione (non dev server)
        http://127.0.0.1:3110 (HTTP 200) · build id eH-lBkIueW6ICN81sfsCz · nessuno degli indizi di dev server
OK    misura Lighthouse (mediana di N giri)
        dispersione massima ammessa: 5 punti (ripiego della casa: il contratto non la dichiara)
        home (/) · 3/3 giri: performance 100±0 · accessibility 100±0 · best-practices 96±0 · seo 100±0
        accesso (/accedi) · 3/3 giri: performance 100±1 · accessibility 100±0 · best-practices 96±0 · seo 100±0
OK    soglie dichiarate
        0 bloccanti, 1 derogate
        [warn] deroga accesso · seo: non copre niente: `accesso` rispetta la soglia di `seo`
OK    metatag nell'HTML servito
        title unico, description e canonical proprio su 2 pagine · nessun noindex nel corpo ne' nelle intestazioni
OK    contratto d'uscita (handoff)
```

Tre cose da leggere qui.

**Nessuna regressione.** Sette passi su sette, come col gate precedente. Le
dodici regole nuove — piu' severe quasi tutte — non hanno prodotto **nessun**
falso rosso su un progetto vero fatto da altri agenti. Compresa la soglia di
dispersione portata da 10 a 5: le misure di quel banco stanno a ±0 e ±1.

**`rete-verde` ha finalmente girato dentro questo gate**, e in tutt'e due i
versi: `VERDE (0 falliti, 0 mancanti su 7 passi)` sull'app giusta, `ROSSO (2
falliti)` quando lo si punta sull'app di un altro progetto (§3.6). Non e' piu' la
seconda legge verificata leggendo il codice: e' stata vista funzionare e vista
fallire.

**E una regola nuova ha trovato qualcosa di vero anche li'.** La deroga su
`accesso · seo` — scritta quando quella pagina non arrivava a 100 — non copre
piu' niente, perche' adesso ci arriva. E' un `warn`, quindi il gate resta verde:
non e' un difetto, e' una riga di documentazione che ha smesso di essere vera e
che nessuno avrebbe piu' riletto.

**I test:** da **42** a **73** (`node --test "scripts/**/*.test.mjs"`), 0 rossi.
Le 31 nuove stanno in `scripts/collaudo-avversario.test.mjs`, una per difetto,
ciascuna con il caso in cui la regola scatta **e** quello in cui non deve
scattare. Un test e' esplicitamente di non-regressione: la forma a tre colonne di
`banco-prova-negozio` continua a leggersi.

---

## 5. `plan` e `tune` su un guadagno vero — la prima volta

Su `banco-prova-negozio` questi due comandi non erano mai stati esercitati:
non c'era niente da ottimizzare. Qui sei ottimizzazioni, una alla volta,
rimisurando dopo ciascuna. Dettaglio col costo dichiarato in
`banco-prova-immobiliare/docs/handoff/01-speed-demon.md`.

| pagina | prima | dopo |
|---|---|---|
| `home` | performance **77±1** · LCP 5 496 ms · 6,31 MB | **100±0** · LCP 746 ms · 0,47 MB |
| `immobili` | performance **75±8** · seo 92 · LCP 13 543 ms · 15,25 MB | **100±0** · seo **100** · LCP 582 ms · 0,43 MB |
| `agenzia` | a11y 95 · seo **91** | a11y **100** · seo **100** |
| `home`, `agenzia` | best-practices **96** | **100** |
| `immobili` | best-practices **96** | **96** — §5.4 |

L'immagine d'apertura servita passa da **6 482 248** a **1 336 698** byte
(−79%), misurata con `curl` sulla rotta `/_next/image`. I preload di immagine
nell'HTML servito sono **1**, come §2 del catalogo ammette.

Tre cose che il catalogo non diceva e che questo banco ha misurato:

**5.1 — La dispersione non parla solo della macchina.** La baseline di
`/immobili` ballava di 8 punti; dopo `next/image` balla di 0. Non era la
macchina occupata: erano quindici megabyte, che non arrivano due volte nello
stesso tempo. La soglia di dispersione segnala anche **una pagina troppo pesante
per riprodursi**, ed e' un'informazione diversa da «rimisura piu' tardi».

**5.2 — Il profilo decide quali difetti esistono.** Il componente client di
questo banco — un piano di ammortamento calcolato in modo sincrono durante
l'idratazione — produce **478 ms di TBT in mobile e 0 ms in desktop**. Il
contratto dichiara desktop, quindi `plan` non l'ha proposto: sarebbe stato lavoro
senza un numero che lo giustifichi. E' scritto nell'handoff perche' non sembri
una svista.

**5.3 — `best-practices` si fermava a 96 per una favicon.** Punto 4 di
`STATO.md`, «nessuno sa perche'». Misurato: audit `errors-in-console`, peso 1,
un `404` su `/favicon.ico`. Aggiunto `src/app/icon.svg`, la categoria e' passata
a **100** su `home` e `agenzia`: diagnosi provata togliendo la causa. La stessa
assenza c'e' su `banco-prova-negozio`, che infatti misurava 96. E' lavoro di
**site-doctor**, non di questa skill, ma e' il primo posto dove guardare quando
quella categoria si ferma appena sotto il massimo.

**5.4 — E su `/immobili` restava a 96 per un motivo che il catalogo dichiarava
impossibile.** Il catalogo §11 apre con un avvertimento: «`prefetch` non compare
in nessun punteggio». Qui compare. Misurato:

```
best-practices = 96
  FALLITO peso 1 — errors-in-console
     "Failed to load resource: 404" — /immobili/borgo-alto?_rsc=…
     "Failed to load resource: 404" — /immobili/casa-vigna?_rsc=…
     "Failed to load resource: 404" — /immobili/rustico-noce?_rsc=…
```

Le tre schede linkano una rotta di dettaglio **che non esiste ancora**. Il
`<Link>` dell'App Router va a prendersela in anticipo, riceve tre `404`, e i 404
finiscono nella console. Quattro punti persi su una pagina che a occhio non ha
niente che non va: i link ci sono, e nessuno li aveva ancora cliccati.

La lettura giusta non e' «togliere il prefetch»: e' che il prefetch **ha reso
visibile un difetto dell'applicazione** — una lista che rimanda al vuoto — prima
che lo trovasse un visitatore. Spegnerlo lo rinasconderebbe. Il catalogo e' stato
corretto (§11, terza eccezione), e il difetto e' stato **lasciato aperto**
nell'handoff: chi ottimizza non decide se costruire la rotta di dettaglio o
togliere i link.

---

## 6. Cosa resta aperto

**6.1 La riga `Tipo:` del contratto non la legge nessuno.** Il gate tratta ogni
pagina dichiarata come pubblica: su una rotta `autenticata` pretende `canonical`
e considera un difetto il suo `noindex`, che invece e' la cosa giusta.
**Non riprodotto** — questo banco non ha autenticazione — ma dedotto dal codice
e dall'esempio compilato del template, che infatti e' stato corretto: le rotte
autenticate si dichiarano ora fra le pagine escluse. Il prezzo e' che la
reattivita' del backoffice resta non misurata.

**6.2 Nessun committente ha mai firmato l'elenco delle pagine.** Su tutti e due i
banchi la riga `Confermato da:` l'ha scritta chi costruiva o chi collaudava. Il
gate legge la firma, non la sua verita': una baseline impeccabile sulle pagine
sbagliate passa il gate ed e' comunque da buttare. E' il punto che nessun
collaudo puo' chiudere, perche' si chiude con un cliente.

**6.3 Le pagine escluse non si verifica che siano davvero escluse.** Punto 2 di
`STATO.md`, ancora aperto: il contratto dichiara cosa sta fuori dall'indice e il
gate legge la dichiarazione senza controllarla.

**6.4 Nessun passo su `sitemap.ts` e `robots.ts`.** Punto 5 di `STATO.md`,
invariato.

**6.5 `code-inquisition`, `semgrep` e `gitleaks` non sono mai stati lanciati su
questi script.** MANCANTI, non PASS. Punto 6 di `STATO.md`, invariato — e adesso
gli script sono cresciuti.

**6.6 Nessuna misura di campo.** Punto 7 di `STATO.md`, invariato.

**6.7 Il guadagno di T1 e T2 e' misurato su rumore, non su fotografie.** Le
immagini del banco sono pixel casuali: incomprimibili per costruzione, quindi il
guadagno viene quasi tutto dal ridimensionamento e dalla compressione con
perdita, non dal cambio di formato. Su foto vere la ripartizione e' diversa; la
direzione no.

---

## 7. Cosa questo collaudo cambia nel giudizio su Speed Demon

Prima: 🟢 come strumento, «e per un giorno solo», collaudato dalla stessa mano
che ne aveva scritto le regole, su un banco dove non c'era niente da ottimizzare.

Adesso: collaudato da una sessione indipendente su un dominio nuovo, con `plan` e
`tune` esercitati su guadagni misurati, diciassette difetti chiusi, e il gate
corretto rilanciato sul banco vecchio dove chiude **VERDE 7/7** senza una
regressione. `rete-verde` — la seconda legge, la rete di sicurezza sotto ogni
modifica — non e' piu' una promessa: e' stata vista tendersi e vista strapparsi.

Resta **non usabile su un progetto cliente**, e adesso il motivo non e' piu' un
difetto della skill. E' il §6.2: su tutti e due i banchi l'elenco delle pagine
che contano l'ha firmato chi costruiva o chi collaudava. Il gate verifica che
ogni pagina dichiarata sia misurata e stia nella sua soglia; che siano state
dichiarate **le pagine giuste** lo garantisce una firma, e quella firma qui non
l'ha mai messa nessuno che venda qualcosa.

Il resto — `Tipo:`, le pagine escluse davvero escluse, `sitemap.ts` e
`robots.ts`, i guardiani mai lanciati, il campo — sta nel §6, ed e' tutto lavoro
che si puo' fare senza aspettare un cliente.
