# Performance e SEO — {{NOME_PROGETTO}}

> Template. Ogni `{{segnaposto}}` va sostituito.
> Destinazione: `docs/performance.md` del progetto generato.
>
> Questo file **lo legge il gate** (`scripts/verify.mjs`, passi
> `contratto-performance` e `budget`), non solo un umano: ne estrae le pagine, le
> soglie e le deroghe. La forma delle intestazioni, della riga `Confermato da:`,
> delle righe del metodo e delle due tabelle **non e' stile, e' sintassi**. Tutto
> il resto e' prosa, e si scrive per chi leggera' un rosso fra tre mesi senza
> aver visto questa misura.

Contratto della misura: **quali pagine contano**, **quale punteggio devono
reggere**, **con quale metodo** sono state misurate e **chi l'ha deciso**. Una
pagina che non compare qui non viene misurata e nessuno se ne accorgera'; una
pagina misurata sotto la sua soglia senza una riga nella tabella delle deroghe e'
un `block` del gate.

Confermato da: {{UMANO (nome, ruolo) | ORCHESTRATORE}} ({{AAAA-MM-GG}})

<!--
SINTASSI. La riga qui sopra e' obbligatoria: senza, o col segnaposto ancora
dentro, il passo `contratto-performance` e' una VERIFICA MANCANTE, non un passo
superato.

Il difetto che previene e' concreto e si e' gia' visto in questa pipeline: un
elenco di pagine deciso dall'agente e' l'opinione dell'agente su cosa contasse, e
l'agente elenca le pagine nell'ordine in cui le trova nel routing. Cosi' si
ottimizza la home — quella che si mostra — e resta lenta la pagina che vende,
che magari sta tre livelli sotto e non e' nemmeno statica. Chi firma qui non
firma i numeri: firma la LISTA.

In modalita' interattiva conferma l'umano con un si' esplicito, e si scrive nome
e ruolo perche' fra sei mesi «confermato dal cliente» non identifica nessuno. In
pipeline conferma l'orchestratore sulla base del brief e degli handoff, e allora
si scrive ORCHESTRATORE senza inventare un nome proprio.

Il gate legge la firma, NON la sua verita': una baseline impeccabile sulle pagine
sbagliate passa il gate ed e' comunque da buttare.
-->

## Metodo

Metodo: build di produzione · {{3}} giri · mediana · profilo {{mobile | desktop}}
URL misurato: {{http://127.0.0.1:3100}}
Comando: {{npm run build && npm run start -- -p 3100}}
Strumento: {{lighthouse X.Y.Z}} su {{Chrome NNN}}
Dispersione massima ammessa: {{5}} punti di categoria
Misurato il: {{AAAA-MM-GG}} — {{macchina o CI, e cosa ci girava sopra}}

<!--
SINTASSI le sei righe qui sopra, nell'ordine, ognuna sulla sua riga.
Il gate ne usa due:
  - `Metodo:` deve contenere «build di produzione» e il numero di giri. Un
    contratto che non dichiara il metodo rende `misura` non interpretabile: due
    numeri presi in due modi diversi non sono confrontabili, e il delta
    prima/dopo dell'handoff sarebbe aritmetica su unita' diverse.
  - `URL misurato:` e' l'URL che il passo `build-produzione` interroga quando non
    gli si passa `--url`. Precedenza: flag esplicito > questa riga > MAI
    l'ambiente e MAI un `localhost:3000` scritto dentro il gate. Un default nel
    codice e' il modo esatto in cui si finisce per misurare l'app di ieri,
    rimasta accesa su 3000, e chiamarla baseline (stesso precedente di Flow
    Sentinel sulla porta del database).
Le altre quattro righe sono prosa obbligatoria: non le legge nessuno strumento,
le legge chi rifara' la misura fra un mese e deve rifarla nello stesso modo.
-->

Perche' il metodo sta scritto qui e non in un commento del commit:

**Build di produzione, mai `next dev`.** In sviluppo non c'e' minificazione, non
c'e' la cache dei moduli servita al browser, e ogni richiesta puo' innescare una
ricompilazione: il numero che esce parla del compilatore, non del sito. Non e'
una sfumatura da laboratorio — e' la differenza fra due punteggi che nessuno
riconoscerebbe come la stessa pagina, e quanto valga quella differenza su questo
progetto e' un numero che si scrive qui **dopo** averlo visto, non uno che si
copia da un template.

**Piu' giri e mediana, non un giro solo.** Due esecuzioni identiche di Lighthouse
sulla stessa build danno punteggi diversi: il punteggio nasce da metriche
temporali, e le metriche temporali dipendono da cosa faceva la macchina in quel
secondo. **Il default di questa casa e' 3 giri: e' una convenzione, non una
misura.** Il numero vero lo si ricava cosi', una volta per progetto: si lanciano
cinque giri sulla build **senza toccare niente in mezzo** e si scrive qui
l'escursione fra il minimo e il massimo. Se quell'escursione e' piu' grande del
guadagno che ci si aspetta da un'ottimizzazione, tre giri non bastano — e la
`Dispersione massima ammessa` va tarata su quel numero, non sul 5 di questo
template, che e' solo un valore di partenza.

Si prende la **mediana** e non la media perche' un solo giro anomalo — un
antivirus che si sveglia, un backup che parte — sposta la media e lascia ferma la
mediana. Una misura che il rumore puo' spostare non e' un punto di riferimento
contro cui giudicare le ottimizzazioni.

**Il profilo va dichiarato perche' cambia il risultato, non la sua precisione.**
Lighthouse di default emula un dispositivo mobile con limitazione di CPU e di
rete; `--preset=desktop` ne applica molta meno. Sono due macchine diverse: una
baseline mobile e una misura finale desktop non si sottraggono. Di quanto
divergano su questo sito e' un numero da scrivere qui se serve, dopo averlo
misurato.

**La versione di Lighthouse e' parte del metodo.** Solo `performance` e' una
media pesata di metriche di laboratorio; `accessibility`, `best-practices` e
`seo` sono medie pesate di controlli superati o falliti, non di tempi. In
entrambi i casi i pesi — e l'elenco stesso delle metriche e dei controlli — sono
cambiati fra versioni maggiori dello strumento. Due misure a mesi di distanza
con due versioni diverse non sono confrontabili, e il delta che ne uscirebbe
attribuirebbe a un'ottimizzazione un cambiamento di formula.

```bash
# Dalla radice del PROGETTO generato. La porta e' dedicata: 3000 e' dove sta
# gia' quasi sempre qualcos'altro, e misurare l'app di un altro progetto e' un
# errore che non si vede, perche' i numeri sembrano numeri.
npm run build
npm run start -- -p 3100 &

mkdir -p .lighthouse
for giro in 1 2 3; do
  npx lighthouse "http://127.0.0.1:3100/" \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=".lighthouse/home-$giro.json" \
    --chrome-flags="--headless=new" --quiet
done
# profilo desktop: --preset=desktop su TUTTI i giri, e dichiarato nella riga
# `Metodo:` qui sopra. Mezza baseline mobile e mezza desktop non e' una baseline.
```

`.lighthouse/` va in `.gitignore`: sono report riscritti a ogni giro, e un diff
di JSON rigenerati e' un diff che nessuno rilegge. Quello che resta nel repo e'
questo file.

## `{{id-pagina}}` — {{/percorso}}

**Perche' conta:** {{una o due righe: cosa perde il progetto se questa pagina e' lenta}}
**Tipo:** {{pubblica | autenticata (sessione: {{quale}})}}

| Categoria | Soglia | Baseline (mediana di {{N}}) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | {{>= 85}} | {{72}} | {{±4}} | {{—}} |
| `accessibility` | {{>= 95}} | {{96}} | {{±0}} | {{—}} |
| `best-practices` | {{>= 95}} | {{92}} | {{±0}} | {{—}} |
| `seo` | {{>= 100}} | {{91}} | {{±0}} | {{—}} |

**Metriche di laboratorio (mediana):** LCP {{2,9 s}} · TBT {{310 ms}} · CLS {{0,02}} · FCP {{1,4 s}}

<!--
SINTASSI dell'intestazione, la forma che il gate riconosce:
  ## `id-pagina` — /percorso
Gli apici inversi sono facoltativi; il separatore puo' essere -, – o —. L'id e'
minuscolo, cifre e trattini, e comincia con lettera o cifra (`home`,
`scheda-prodotto`, `admin-ordini`). La seconda meta' e' il percorso servito e
**comincia con `/`**: e' quello che distingue una sezione di pagina dalle
sezioni di servizio di questo file (`## Metodo`, `## Deroghe`, `## Pagine escluse
dalla misura`), che non hanno ne' separatore ne' percorso.

L'id e' la chiave che lega questa sezione alla tabella delle deroghe e
all'handoff. Rinominarlo scollega la deroga dalla pagina, e la scollega in
silenzio: la pagina torna sotto soglia senza giustificazione (`block`) e la riga
di deroga resta li' a sembrare valida.

SINTASSI anche la tabella: quattro righe, una per categoria Lighthouse, con gli
id di categoria in inglese perche' sono quelli dello strumento
(`performance`, `accessibility`, `best-practices`, `seo`, cosi' come li accetta
`--only-categories`). E' la regola della casa: le etichette per gli umani stanno
in italiano, i formati di scambio restano com'e' nati. Il difetto che previene:
una riga tradotta (`prestazioni`, `accessibilita'`) non si aggancia ne'
all'uscita di Lighthouse ne' alla riga di deroga, e il gate non distingue una
categoria tradotta da una categoria assente — la soglia sparisce senza che
nessuno la veda sparire. Una categoria non misurata si scrive `non misurata` con
accanto il perche', non si cancella la riga: una riga assente non si distingue
da una dimenticata.

La colonna `Dispersione` e' l'ESCURSIONE degli N giri — giro piu' alto meno giro
piu' basso — e la notazione `±4` va letta «4 punti fra il minimo e il massimo»,
non «4 sopra e 4 sotto». Si confronta direttamente con `Dispersione massima
ammessa` del §Metodo; se e' piu' grande, la misura non e' bassa, e' MANCANTE e
va rifatta. Il difetto che previene: la stessa cella letta come mezza ampiezza
da chi la scrive e come ampiezza intera da chi la rilegge fa passare per dentro
soglia una misura che oscilla il doppio, e un delta prima/dopo piu' piccolo di
quell'oscillazione e' rumore promosso a risultato.

PROSA il resto. «Perche' conta» non lo verifica nessuno strumento e va scritto
lo stesso, perche' e' l'unica cosa che permette a chi legge un rosso di decidere
se valeva la pena. Una pagina senza il suo «perche'» e' una pagina che sta
nell'elenco per inerzia.

Sulle SOGLIE, per evitare l'equivoco piu' costoso di questo file: la soglia e'
una DECISIONE di chi firma, non una misura e non uno standard. I numeri
dell'esempio in fondo sono di quel progetto. Una soglia bassa dichiarata in
partenza («l'amministrazione si usa da desktop in ufficio, `performance >= 60`
basta») e' una scelta legittima e non e' una deroga; una soglia alta dichiarata
e poi non raggiunta e' una deroga, e va nella tabella. La differenza fra le due
e' il momento in cui il numero e' stato deciso: prima della misura, o dopo
averla vista.

Sulle METRICHE: si scrivono accanto ai punteggi perche' il punteggio da solo non
dice CHE COSA e' cambiato — un `performance` che sale di sei punti puo' essere un
LCP sceso, un TBT sceso o un giro fortunato, e nell'handoff il delta va spiegato
dalla metrica che si e' mossa, altrimenti l'ottimizzazione si prende un merito
che non e' dimostrato suo. Qui vanno solo quelle che Lighthouse misura in
laboratorio.
L'INP non e' fra queste — e' una metrica di campo, e il TBT ne e' il sostituto
imperfetto: scriverlo qui significherebbe scrivere un numero che non e' stato
misurato. La soglia «buono» di 2,5 s per LCP pubblicata da Google e' un valore
di CAMPO al 75esimo percentile degli utenti reali: usarla come soglia di
laboratorio e' un'approssimazione utile, e va saputa per quello che e'.
-->

## Deroghe

| Pagina | Categoria | Soglia | Misurato | Motivo scritto | Confermata da |
|---|---|---|---|---|---|
| `{{id-pagina}}` | `{{performance}}` | {{>= 85}} | {{79}} | {{perche' non si arriva alla soglia e cosa costerebbe arrivarci}} | {{nome, ruolo}} ({{AAAA-MM-GG}}) |

<!--
SINTASSI la tabella, con queste sei colonne in quest'ordine. Se non ci sono
deroghe si lascia l'intestazione e si scrive sotto, su una riga sola fuori dalla
tabella, `Nessuna deroga.` — cosi' «non ce ne sono» si distingue da «la tabella
non e' stata compilata». Sono due stati diversi e uno dei due e' un problema.

COME LA LEGGE IL GATE, passo `budget`:
- soglia non raggiunta e nessuna riga qui che nomini quella pagina e quella
  categoria: `block`. Il gate e' rosso e non si consegna. Non e' severita': un
  punteggio sotto soglia senza motivo scritto sparisce dentro l'handoff come
  «abbiamo fatto il possibile», e nessuno sapra' mai se il possibile era stato
  fatto davvero o se qualcuno aveva rinunciato in fretta;
- riga di deroga che nomina una pagina non dichiarata qui sopra: `warn`. E'
  l'avanzo di una pagina rinominata o tolta dall'elenco senza dirlo. Chi decide
  cosa farne e' chi ha firmato la lista, non l'agente e non il gate.

QUANDO si scrive una deroga. Il momento giusto e' PRIMA della misura, quando il
limite e' gia' noto: «questa pagina interroga un servizio esterno con una latenza
che non controlliamo» e' una condizione, e va nel contratto. Una deroga scritta
DOPO aver visto il numero e' una giustificazione, e si riconosce dal motivo, che
descrive il punteggio invece della causa. «Non si arriva a 85» non e' un motivo:
e' la ripetizione della misura.

Il motivo deve dire due cose, non una: perche' non si arriva alla soglia, e cosa
costerebbe arrivarci. La seconda e' quella che serve fra sei mesi, quando
qualcuno rileggera' la riga per decidere se il costo nel frattempo e' sceso.

UNA DEROGA CHE NON ESISTE: `accessibility` sotto la baseline. La costituzione
mette l'accessibilita' sopra la performance, quindi un punteggio di
accessibilita' piu' basso di quello di partenza non e' derogabile — si torna
indietro sull'ottimizzazione che l'ha abbassato. Una deroga puo' ammettere che
una soglia non e' stata RAGGIUNTA; non puo' legittimare una REGRESSIONE, che e'
il difetto che questo agente rischia di introdurre piu' facilmente di chiunque
altro, perche' togliere un `alt`, spegnere un focus visibile o svuotare un
`aria-label` fa salire il punteggio di performance mentre rompe la pagina per
chi la usa senza vederla.
-->

## Pagine escluse dalla misura

- `{{/percorso}}` — {{perche' e' esclusa, e cosa la farebbe rientrare}}

<!--
PROSA, ma obbligatoria. Il gate non la legge: nessuno strumento sa distinguere
una pagina esclusa da una dimenticata, ed e' esattamente la distinzione che
questa sezione esiste per rendere leggibile. Senza, «non e' stata misurata»
resta ambiguo per sempre, e l'ambiguita' pende sempre dalla parte comoda.

Ogni riga dichiara anche COSA la farebbe rientrare, altrimenti l'esclusione
diventa definitiva per inerzia: la pagina di accesso esclusa perche' vuota resta
esclusa il giorno in cui ci si mette dentro la registrazione con il selettore
del piano.

Esclusioni che reggono: rotte API e `route.ts` (non c'e' un documento da
valutare, e Lighthouse su una risposta JSON produce numeri che non significano
niente); una variante della stessa vista gia' misurata da un'altra sezione,
purche' si scriva quale; una rotta dinamica con molte istanze, di cui si misura
un rappresentante — e allora si scrive QUALE istanza e perche' e'
rappresentativa, perche' non lo e' quasi mai.

Esclusione che non regge: «e' lenta e non sappiamo perche'». Quella e' una
deroga, e va nella tabella sopra con il suo motivo e la sua firma.
-->

## Cosa questo contratto NON prova

Anche compilato per intero, misurato per intero e con tutte le soglie verdi,
questo file dice una cosa precisa e non di piu'.

**Non prova che il sito sia veloce per gli utenti.** Lighthouse misura un
laboratorio: una macchina, una rete emulata, una cache fredda, un dispositivo
simulato. I dati di campo — CrUX, RUM — sono un'altra cosa, li produce il
traffico vero e questo agente non li vede. Un punteggio alto e' una condizione
favorevole, non un esito.

**Non prova che le pagine elencate siano quelle giuste.** Il gate verifica che
ogni pagina dichiarata sia misurata e stia nella sua soglia; che siano state
dichiarate le pagine che contano lo garantisce solo la riga `Confermato da:`, e
quella e' una firma, non una verifica.

**Non prova che le ottimizzazioni reggano al contenuto vero.** La misura passa
sui dati di seed. Una lista che vola con dieci righe puo' crollare con la lista
vera, e nessun numero preso qui lo dice: la differenza sta nella quantita' di
dati, e la quantita' di dati qui e' una scelta del seed.

**Non prova che il costo dichiarato di un'ottimizzazione sia accettabile.** «Il
lampo bianco sotto la piega e' accettabile» e' un giudizio di chi ha confermato,
non una misura, e va letto come tale anche quando sta accanto a numeri.

**Non prova niente su domani.** Una soglia raggiunta oggi vale su questa build,
con questo contenuto e con questa versione dello strumento. E' il motivo per cui
la riga `Misurato il:` e' obbligatoria: senza data, un contratto verde e' verde
per sempre.

---

## Esempio compilato

Serve a mostrare la FORMA, non a fornire numeri. Punteggi, soglie, metriche e
dispersioni qui sotto sono di quel progetto, misurati su quella build con quella
macchina: copiarli in un altro contratto significa scrivere come misurato
qualcosa che nessuno ha misurato.

````markdown
# Performance e SEO — Vivaio Corte Vecchia

Contratto della misura: quali pagine contano, quale punteggio devono reggere,
con quale metodo sono state misurate e chi l'ha deciso.

Confermato da: Elena Barbieri (titolare) (2026-07-24)

## Metodo

Metodo: build di produzione · 3 giri · mediana · profilo mobile
URL misurato: http://127.0.0.1:3100
Comando: npm run build && npm run start -- -p 3100
Strumento: lighthouse 12.2.1 su Chrome 138
Dispersione massima ammessa: 5 punti di categoria
Misurato il: 2026-07-24 — portatile dello sviluppo, nessun altro processo pesante

Giro a vuoto per tarare la dispersione: cinque esecuzioni sulla stessa build
senza toccare niente, home, punteggio performance 70 · 73 · 71 · 74 · 71 —
escursione 4 punti. Tre giri e mediana bastano per un guadagno atteso di dieci
punti; per giudicare un guadagno di tre punti non basterebbero, e infatti nessuna
ottimizzazione da tre punti e' stata accettata come tale.

## `home` — /

**Perche' conta:** e' dove arriva il traffico dalla ricerca locale e da Maps ed
e' l'unica pagina con il numero di telefono sopra la piega. Lenta qui significa
persa prima di aver detto dove siamo.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 85 | 71 | ±4 | 93 |
| `accessibility` | >= 95 | 96 | ±0 | 96 |
| `best-practices` | >= 95 | 92 | ±0 | 100 |
| `seo` | >= 100 | 91 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP 3,1 s → 1,6 s · TBT 290 ms → 40 ms · CLS 0,02 → 0,00 · FCP 1,5 s → 1,1 s

## `catalogo` — /catalogo

**Perche' conta:** e' la seconda pagina di ogni sessione che porta a un contatto,
e mostra 48 schede con immagine. E' la pagina dove il peso delle immagini si
somma.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 80 | 64 | ±5 | 88 |
| `accessibility` | >= 95 | 95 | ±0 | 95 |
| `best-practices` | >= 95 | 92 | ±0 | 100 |
| `seo` | >= 100 | 100 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP 4,2 s → 2,1 s · TBT 520 ms → 90 ms · CLS 0,11 → 0,00 · FCP 1,8 s → 1,2 s

## `scheda-prodotto` — /catalogo/acero-palmato

**Perche' conta:** e' la pagina che il cliente manda per messaggio quando
consiglia una pianta, ed e' quella che si apre in mobilita' su rete lenta.
Rappresentante di 48 istanze della stessa rotta dinamica: scelta perche' ha la
galleria piu' pesante del catalogo, quindi e' il caso peggiore, non quello medio.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 85 | 68 | ±4 | 79 |
| `accessibility` | >= 95 | 96 | ±0 | 96 |
| `best-practices` | >= 95 | 92 | ±0 | 100 |
| `seo` | >= 100 | 100 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP 3,8 s → 2,4 s · TBT 340 ms → 70 ms · CLS 0,05 → 0,00 · FCP 1,6 s → 1,2 s

## `admin-ordini` — /admin/ordini

**Perche' conta:** ci si passa mezz'ora al giorno per preparare le consegne. Non
la vedono i motori e non la vede un cliente: conta la reattivita' della tabella,
non il punteggio.
**Tipo:** autenticata (sessione: staff, `e2e/.auth/staff.json`)

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 60 | 74 | ±3 | 81 |
| `accessibility` | >= 95 | 97 | ±0 | 97 |
| `best-practices` | >= 95 | 100 | ±0 | 100 |
| `seo` | non misurata | — | — | — |

Soglia `performance` a 60 per decisione della titolare: l'amministrazione si usa
da desktop sulla rete del vivaio, e alzare la soglia avrebbe significato
paginare una tabella che si preferisce vedere intera. E' una decisione presa
prima della misura, quindi non e' una deroga.
`seo` non misurata: la rotta e' `noindex` e dietro autenticazione, un punteggio
SEO qui non descriverebbe niente.

**Metriche di laboratorio (mediana):** LCP 2,2 s → 1,7 s · TBT 180 ms → 110 ms · CLS 0,00 → 0,00 · FCP 1,1 s → 0,9 s

## Deroghe

| Pagina | Categoria | Soglia | Misurato | Motivo scritto | Confermata da |
|---|---|---|---|---|---|
| `scheda-prodotto` | `performance` | >= 85 | 79 | La galleria apre con cinque foto a piena larghezza, richieste per iscritto nel brief (§4: «le piante si vendono con le foto grandi»). Le tre sotto la piega sono gia' differite e le prime due gia' in AVIF con `priority` sulla sola prima. Arrivare a 85 richiede di ridurre la galleria a due immagini o di ritagliarle: cambia cosa si vede, e questa e' una decisione della titolare, non di chi ottimizza. Rivedibile quando le foto verranno riscattate a un rapporto piu' stretto. | Elena Barbieri (titolare) (2026-07-24) |

## Pagine escluse dalla misura

- `/api/contatti` — rotta `route.ts`, nessun documento HTML da valutare: un
  punteggio Lighthouse su una risposta JSON non descriverebbe niente. Rientra se
  un giorno servira' HTML.
- `/catalogo/[slug]` (le altre 47 istanze) — stessa vista, stesso layout,
  stessi componenti di `scheda-prodotto`, che e' il caso peggiore per peso della
  galleria. Rientrano se una scheda acquisisce contenuto che le altre non hanno
  (video, mappa dei vivai, configuratore).
- `/accesso` — modulo di due campi, nessuna immagine, `noindex`, la usa solo lo
  staff. Rientra il giorno in cui ospitera' la registrazione dei clienti, che e'
  in ROADMAP.
- `/grazie` — pagina di conferma dopo l'invio del modulo, raggiunta a sessione
  gia' vinta. Esclusa per decisione della titolare del 2026-07-24. Rientra se
  diventera' la pagina di conferma di un ordine con pagamento.
````
