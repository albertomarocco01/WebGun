# GDPR, cookie e archiviazione — cosa si misura e cosa si dichiara

> Carica questo file prima di `scansiona` e `certifica`.
>
> **Nessuna riga qui è consulenza legale.** Questa reference descrive cosa un
> programma può **misurare** e cosa deve **pretendere che sia scritto**. Se le
> basi giuridiche dichiarate siano quelle giuste lo dice chi risponde davanti al
> Garante, non questa skill.

## 1. L'informativa: tre cose diverse, e vanno tutte e tre

Un'informativa privacy è conforme quando **esiste**, è **raggiungibile** e
**dice** le cose che l'art. 13 del Regolamento pretende. Sono tre proprietà
indipendenti, e in questa casa se ne sono viste fallire due su tre insieme.

### Esiste, e risponde

Un collegamento nel piè di pagina che porta a un `404` è peggio di nessun
collegamento: chi lo segue crede di aver letto qualcosa. Il gate scarica la
pagina e pretende `200`.

### È raggiungibile **da ogni** pagina pubblica

Non «dal piè di pagina della home». Da **ogni** pagina che un visitatore
raggiunge — perché la pagina su cui una persona lascia il proprio numero di
telefono potrebbe essere l'unica che visita.

**Come si trova la pagina dell'informativa.** Dai **collegamenti** che le pagine
mettono davanti a chi visita: testo del collegamento (`Informativa privacy`,
`Privacy`, `Cookie`) oppure percorso. **Mai** da un elenco di percorsi
indovinati: un elenco di tentativi trova una pagina `/privacy` che nessuno linka
— cioè che nessun visitatore vedrà mai — e manca un'informativa che sta a
`/note-legali/clienti`. Quello che conta per chi visita è il collegamento, ed è
quello che si misura.

### Dice le cose

Le voci che il gate cerca nel testo servito, con la forma in cui compaiono in
italiano:

| voce | come si riconosce |
|---|---|
| titolare del trattamento | «titolare del trattamento», «titolare dei dati» |
| finalità | «finalità», «per quali scopi», «scopo del trattamento» |
| base giuridica | «base giuridica», «fondamento giuridico», «art. 6» |
| tempi di conservazione | «conservazione», «per quanto tempo» |
| diritti dell'interessato | «diritti dell'interessato», «diritto di accesso», «rettifica», «cancellazione» |
| reclamo | «reclamo», «Garante», «autorità di controllo» |
| destinatari | «destinatari», «comunicazione a terzi», «responsabile del trattamento» |

**Cosa questo controllo prova**: che il documento **nomina** le sette voci.
**Cosa non prova**: che dica il vero su ognuna. È un controllo sul fatto che
qualcuno ci abbia pensato, non sul contenuto — e va letto così.

Due controlli in più, che valgono quanto i sette:

- **nessun segnaposto servito** (`{{…}}`, *lorem ipsum*, `TODO`): il documento
  che dice chi risponde dei dati non può andare online mezzo vuoto;
- **almeno 400 caratteri di testo visibile**: sotto quella soglia non è
  un'informativa, è un titolo.

## 2. Cosa è un dato personale, in un modulo

La domanda operativa non è filosofica: **quale prova ho che questo campo
raccolga un dato personale?** La risposta segue il criterio della `DECISIONI.md`
§17 — *un'euristica non produce un `block`, tranne dove la prova sta nel
catalogo*. Qui il catalogo è l'HTML stesso.

### Prova forte → `block`

- **`autocomplete`** con un valore dell'elenco chiuso dei dati personali:
  `name`, `given-name`, `family-name`, `email`, `username`, `tel` e varianti,
  `street-address`, `address-line1/2`, `address-level1/2`, `postal-code`,
  `country`, `bday`, `sex`, `organization`, `cc-name`, `cc-number`…
  È il segnale più forte che esista, e per un motivo che vale la pena dire:
  **non è un'inferenza nostra, è una dichiarazione di chi ha costruito il
  modulo**, presa da un vocabolario chiuso.
- **`type="email"`** e **`type="tel"`**.

### Prova debole → `issue`

Il **nome** del campo (`nome`, `cognome`, `telefono`, `indirizzo`, `citta`,
`codice_fiscale`…). Un campo che si chiama `nome` può essere il nome di una
persona o il nome di una pizza: bloccare sul nome vorrebbe dire un rosso su
moduli corretti, e un rosso su un modulo corretto è un rosso che si impara a
scavalcare (`DECISIONI.md` §8).

### Cosa non si conta

I campi `hidden`, `submit`, `button`, `reset`, `image`, `checkbox`, `radio`.
Il motivo di `hidden` è misurato: su Next in App Router **ogni** `<form>` con
Server Action ne porta quattro di servizio (`$ACTION_REF_1`, `$ACTION_KEY`, …)
che non raccolgono niente da nessuno. Contarli avrebbe prodotto quattro rilievi
per modulo su ogni sito di questa casa.

## 3. L'informazione va data **al momento della raccolta**

L'art. 13 chiede che l'informazione sia data *al momento in cui i dati sono
ottenuti*. Un sito che ha un'informativa impeccabile a `/privacy` e un modulo a
`/ordina` che non ci rimanda **non** è conforme, e questo è un `block` a sé —
distinto da «l'informativa non esiste».

È il rilievo che il gate ha prodotto sul pilota:

```
[block] /ordina: raccoglie dati personali e non rimanda a nessuna informativa:
        l'art. 13 chiede l'informazione AL MOMENTO della raccolta, non da
        qualche altra parte del sito
```

## 4. L'archiviazione non è solo il cookie

L'art. 5(3) della direttiva ePrivacy parla di **archiviazione di informazioni
nel terminale** dell'utente e di **accesso a informazioni già archiviate**: non
nomina i cookie come categoria esclusiva. `localStorage`, `sessionStorage` e
`indexedDB` ricadono nella stessa regola.

**La regola qui guarda cosa si scrive, non come si chiama.**

### Come si misura, invece di dedurla

1. **`Set-Cookie`** sulle risposte di ogni pagina della superficie, a un
   visitatore anonimo che non fa nulla.
2. **Le API di archiviazione nei bundle serviti**: per ogni pagina si prendono i
   `<script src>` della stessa origine, si **scaricano per intero** e ci si
   cerca `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`.

**Un bundle non scaricato non è un bundle pulito.** Se uno script non si scarica,
il passo è **MANCANTE** — non «nessuna archiviazione trovata». È la forma locale
del difetto n°2 del collaudo avversario di vetrina-crafter, dove una pagina non
scaricata rendeva muti in silenzio i suoi slot.

E va detto cosa questo prova: che il codice servito da quella pagina **può**
archiviare. Non che archivi **sempre**. È deliberato: dedurre dall'assenza è il
falso verde peggiore, e in questa direzione l'errore è a favore della cautela.

### I terzi: perché non dichiararli è un `block`

Un `<script src>`, un `<iframe src>`, un `<link href>` o un `<img src>` verso
un'**altra origine** significa che del codice o una richiesta di qualcun altro
entra nella pagina. Cosa quel terzo scrive nel browser **questo gate non lo può
misurare**: non scarica codice di terze parti, e anche se lo facesse una
richiesta a un dominio esterno pone un identificativo con o senza JavaScript.

Da qui la regola, e la sua gravità:

> **Un'origine di terzi non dichiarata nel certificato è un bloccante.**
> Proprio perché è la cosa che non possiamo misurare, è la cosa che dev'essere
> scritta.

Sono terzi anche le cose che nessuno pensa siano terzi: i font di un CDN, una
mappa incorporata, un video, un widget di recensioni, un pixel.

## 5. Il banner: quando serve, e quando è un danno

| misura | banner | perché |
|---|---|---|
| solo archiviazione **essenziale** | **no** | non c'è niente da chiedere. Un banner qui è un danno: abitua chi visita a cliccare «accetto» senza leggere, e il giorno in cui ci sarà davvero qualcosa da chiedere nessuno leggerà |
| almeno una **non essenziale** | **sì**, e prima che venga posta | il consenso si chiede prima, non dopo |

**Essenziale** è ciò che serve a fornire il servizio che la persona ha chiesto:
il carrello, la sessione autenticata, la preferenza di lingua, la protezione
CSRF. Analitica, mappe, incorporamenti, pubblicità, test A/B: **non** essenziali.

Il gate misura la premessa e poi guarda il banner, mai il contrario:

- non essenziale trovata **e** nessun banner dichiarato → `block`;
- banner dichiarato **e** nessuna archiviazione non essenziale misurata →
  `issue`, perché un banner che non protegge niente insegna la cosa sbagliata.

## 6. Il caso del pilota, per intero

Misurato il 2026-08-06 su `fornodoro` (pizzeria, ordini d'asporto):

| cosa | misura |
|---|---|
| `Set-Cookie` sulle 5 pagine pubbliche | **zero** |
| API di archiviazione nei 9 script serviti | **`localStorage` su `/ordina`** — il carrello |
| origini di terzi | **zero** |
| informativa privacy | **nessun collegamento su 5 pagine su 5** |
| campi personali raccolti | `nome` (`autocomplete="name"`) e `telefono` (`autocomplete="tel"`) su `/ordina` |

Il `localStorage` del carrello è **essenziale** e non vuole nessun banner. Ma va
**dichiarato**, e non lo era: il certificato non esisteva. È il caso limpido in
cui la conformità non chiede di cambiare il sito — chiede di scrivere cosa fa.

## 7. Cosa la misura NON vede

- **Un cookie posto dopo un'azione**: l'invio di un modulo, l'accesso, il
  consenso stesso. Si legge un visitatore anonimo che non fa nulla.
- **Un cookie di una sessione autenticata**: l'area amministrativa non è nella
  superficie pubblica.
- **Un modulo costruito nel browser** dopo il caricamento: nell'HTML servito non
  c'è. Se il sito non ha altri moduli, il passo `dati-raccolti` chiude
  `NON APPLICABILE` con una premessa vera e una conclusione sbagliata.
- **Un terzo caricato dinamicamente** da un pezzo di codice che l'HTML non
  referenzia.
- **Cosa succede ai dati dopo**: dove finiscono, chi li legge, per quanto
  restano davvero. Il certificato dichiara ciò che qualcuno ha scritto.
