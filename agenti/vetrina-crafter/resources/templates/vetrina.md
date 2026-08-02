# Vetrina — {{NOME_PROGETTO}}

> Template. Ogni `{{segnaposto}}` va sostituito.
> Destinazione: `docs/vetrina.md` del progetto generato.
>
> Questo file **lo legge il gate** (`scripts/verify.mjs`, passi `contratto-vetrina`,
> `pagine-vive`, `segnaposto-serviti`, `contenuti-vivi`), non solo un umano: ne
> estrae le pagine, i percorsi, le fonti dei dati, gli slot e le esclusioni. La
> forma delle intestazioni, della riga `Confermato da:`, delle righe di pagina e
> delle due tabelle **non è stile, è sintassi**. Tutto il resto è prosa, e si
> scrive per chi leggerà un rosso fra tre mesi senza aver visto questo sito.

Contratto della vetrina: **quali pagine esistono**, **cosa mostra ciascuna**, **da
dove arriva ogni contenuto**, **che gerarchia hanno** e **chi l'ha deciso**. Una
pagina che non compare qui e che il sito serve lo stesso è una pagina pubblicata
che nessuno ha firmato; una pagina dichiarata qui che il sito non serve è un
`block` del gate.

Confermato da: {{NOME COGNOME (ruolo) | ORCHESTRATORE}} ({{AAAA-MM-GG}})

<!--
SINTASSI. La riga qui sopra e' obbligatoria: senza, o col segnaposto ancora
dentro, il passo `contratto-vetrina` chiude MANCANTE e il gate e' rosso.

Cosa il gate rifiuta, di preciso: i segnaposti (`{{...}}`, `TODO`, `da
compilare`, `da decidere`) e le firme che non nominano nessuno (`—`, `-`, `?`).
Un nome proprio con il suo ruolo e' una firma valida, ed e' la forma preferita:
fra sei mesi «confermato dal cliente» non identifica nessuno. In pipeline
conferma l'orchestratore sulla base del brief e degli handoff, e allora si
scrive ORCHESTRATORE senza inventare un nome proprio.

Due difetti gia' pagati da altre due skill di questa casa, e che qui non devono
ripetersi:
  - fra i due punti e la firma si ammettono SOLO SPAZI ORIZZONTALI. Con `\s`,
    che comprende l'a capo, una riga `Confermato da:` VUOTA cattura la prima
    riga non vuota che segue — l'intestazione della prima pagina — e il passo
    esce verde su un contratto che nessuno ha firmato. E' successo davvero
    (flow-sentinel, `STATO.md` §Tre falsi verdi);
  - una firma con nome e ruolo DEVE passare. Pretendere la parola letterale
    `UMANO` significa accettare solo la modalita' senza nessun nome, che e'
    l'opposto di quello che questo commento chiede (speed-demon, collaudo
    avversario del 2026-07-30: quattro rifiuti indebiti dello stesso ceppo).

La DATA non e' decorativa: il passo 1 la confronta con l'ultima modifica
dell'handoff di schema-forge e alza un `issue` se lo schema e' cambiato DOPO la
firma. Un elenco di pagine firmato prima dell'ultimo cambio di schema e'
un'opinione datata.

E la cosa piu' importante di tutte: il gate legge la firma, NON la sua verita'.
Un sito impeccabile delle pagine sbagliate passa dieci passi su dieci ed e'
comunque da buttare. Chi firma qui non firma il codice: firma la LISTA, e firma
COSA DIVENTA PUBBLICO.
-->

## Ambiente

URL servito: {{http://127.0.0.1:3100}}
Comando: {{npm run build && npm run start -- -p 3100}}
Tabella dei contenuti: {{site_content}} — chiave `{{slot}}`, pubblicato `{{is_published}}`
Lunghezza minima del frammento distintivo: {{24}} caratteri

<!--
SINTASSI le quattro righe qui sopra, ognuna sulla sua riga. Il gate le legge
tutte e quattro, e ognuna esiste per un difetto preciso.

  - `URL servito:` e' l'indirizzo che il gate interroga quando non gli si passa
    `--url`. Precedenza: flag esplicito > questa riga > MAI l'ambiente e MAI un
    `localhost:3000` scritto dentro il gate. Un default nel codice e' il modo
    esatto in cui si finisce per misurare l'app di ieri rimasta accesa, e
    chiamarla verde. Questa riga non e' un default: e' un valore che qualcuno ha
    scritto in un file di questo progetto.
    Attenzione: dichiarare la porta NON basta a proteggersi. Su una macchina di
    sviluppo quella porta puo' essere occupata da un altro sito — e' successo, e
    il sito era di un'altra azienda (speed-demon, diciassettesimo difetto). Per
    questo il passo `app-identita` non si fida dell'URL: pretende di trovare
    nell'HTML servito il `.next/BUILD_ID` di QUESTO progetto.
  - `Comando:` e' prosa obbligatoria: non lo legge nessuno strumento, lo legge
    chi dovra' rimettere in piedi la build fra un mese.
  - `Tabella dei contenuti:` dice al passo `contenuti-vivi` dove cercare gli
    slot, con quale colonna-chiave e quale colonna di pubblicazione. Senza,
    quel passo non sa cosa interrogare ed e' MANCANTE. Se il progetto non ha
    contenuti editabili si scrive `nessuna` e si compila `Nessuno slot.` piu'
    sotto: sono due dichiarazioni, non due omissioni.
  - `Lunghezza minima del frammento distintivo:` e' la soglia sotto la quale il
    valore di uno slot non prova niente. Il gate cerca il testo dello slot nella
    pagina servita e si assicura che NON stia nei sorgenti: su un valore di sei
    caratteri («Chi siamo») entrambe le ricerche darebbero risposte casuali,
    quindi quello slot si dichiara NON VERIFICATO invece di far finta. Il
    ripiego del gate e' 24 caratteri, ed e' una convenzione, non una misura:
    il numero giusto si ricava su un progetto vero guardando quanti slot restano
    fuori. Come i tre giri di Lighthouse.
-->

## Gerarchia

{{DUE_O_TRE_RIGHE: cosa sta nella navigazione principale, cosa e' pagina figlia,
qual e' l'azione che il sito chiede al visitatore.}}

<!--
PROSA, ma obbligatoria per chi firma — il gate non la legge.

E' la sezione che rende il contratto leggibile a un committente: l'elenco delle
pagine dice COSA c'e', la gerarchia dice COSA CONTA. Senza, un sito di nove
pagine tutte allo stesso livello sembra una scelta, e quasi sempre e' l'assenza
di una scelta.

Va scritto qui anche cosa NON esiste: le pagine che il committente potrebbe dare
per scontate (blog, area riservata, ricerca, versione in inglese) e che non ci
saranno. Una cosa non promessa a voce si ricorda diversamente da una cosa
scritta accanto alla propria firma.
-->

## Dati visibili a un anonimo

| Tabella o vista | Cosa vede un visitatore senza account | Chi l'ha autorizzato |
|---|---|---|
| `{{prodotti}}` | {{quali colonne, e con quale filtro}} | {{nome, ruolo}} ({{AAAA-MM-GG}}) |

<!--
SINTASSI la tabella, con queste tre colonne in quest'ordine. Il gate non la
verifica riga per riga — non sa quali colonne DOVREBBERO essere pubbliche — ma
questa e' la sezione per cui esiste la firma, e quindi non e' facoltativa. Se
non c'e' nessuna tabella pubblica si scrive sotto, fuori dalla tabella,
`Nessun dato pubblico.`

PERCHE' STA IN UN DOCUMENTO E NON IN UNA CHAT: pubblicare un dato e'
irreversibile nel solo modo che conta — dopo, e' di chi l'ha copiato, indicizzato
o messo in cache, e nessuna correzione lo riporta indietro. E' per questo che in
modalita' pipeline questa e' una delle due domande che si fermano comunque a un
umano (`DECISIONI.md` §6: si delega cio' che e' reversibile, mai cio' che non lo
e').

La riga da non scrivere mai: «tutte le colonne della tabella». Se una colonna
non serve alla pagina, non deve arrivare al browser — e non perche' sia brutto,
ma perche' quello che arriva al browser e' pubblicato anche se non e' disegnato.
Nascondere un campo nel componente lascia il dato nell'HTML servito e nel payload
RSC: se un anonimo non deve vederlo, non deve RICEVERLO.
-->

## Percorsi di scrittura aperti al pubblico

| Rotta | Cosa scrive | Tabella | Chi l'ha autorizzato |
|---|---|---|---|
| `{{/contatti}}` | {{un messaggio del modulo di contatto}} | `{{messaggi}}` | {{nome, ruolo}} ({{AAAA-MM-GG}}) |

<!--
SINTASSI la tabella. Se non ce ne sono si scrive sotto, fuori dalla tabella,
`Nessuna scrittura pubblica.` — cosi' «non ce ne sono» si distingue da «la
tabella non e' stata compilata». Sono due stati diversi e uno dei due e' un
problema.

E' la seconda domanda che ferma la pipeline anche in automatico. Un modulo che
scrive da una sessione anonima e' una porta: la vetrina la disegna e la collega,
la POLICY che la fa funzionare la scrive schema-forge, e la difesa dagli abusi
(spam, frequenza, dimensione) e' di cyber-shield. Tre proprietari diversi per una
riga sola: se non e' scritto qui, non ce l'ha nessuno.
-->

## `{{id-pagina}}` — {{/percorso}}

**Cosa mostra:** {{una o due righe in italiano semplice: cosa vede chi arriva qui}}
**Contenuti da:** `tabella:{{prodotti}}` · `slot:{{home-hero}}`
**Titolo da:** {{slot `home-hero`, campo title}}
**Aggiornamento:** {{statico | ISR 300 | dinamico}}
**Perché esiste:** {{una riga: cosa perde il progetto se questa pagina non c'è}}

<!--
SINTASSI dell'intestazione, la forma che il gate riconosce:
  ## `id-pagina` — /percorso
Gli apici inversi sono facoltativi; il separatore puo' essere -, – o —. L'id e'
minuscolo, cifre e trattini, e comincia con lettera o cifra (`home`, `catalogo`,
`scheda-prodotto`). La seconda meta' e' il percorso servito e COMINCIA CON `/`:
e' quello che distingue una sezione di pagina dalle sezioni di servizio di
questo file (`## Ambiente`, `## Gerarchia`, `## Slot dei contenuti`, `## Pagine
escluse dal contratto`), che non hanno ne' separatore ne' percorso.

L'id e' la chiave che lega questa sezione alla tabella degli slot e all'handoff.
Rinominarlo scollega lo slot dalla pagina, e lo scollega in silenzio.

SINTASSI anche le quattro righe in grassetto: il gate pretende che ci siano
tutte e quattro, e ne INTERPRETA due.

  - `Contenuti da:` e' un elenco di gettoni col loro prefisso, separati da `·`
    o da virgole: `tabella:<nome>`, `vista:<nome>`, `slot:<chiave>`. Il prefisso
    non e' pedanteria — e' quello che permette al passo `contenuti-vivi` di
    sapere se deve contare righe leggibili dall'anonimo (tabella, vista) o
    cercare un testo in pagina (slot). Una pagina senza fonti si scrive
    `nessuna`, e allora e' una pagina di solo markup: legittima, e dichiarata.
  - `Aggiornamento:` e' uno di tre valori: `statico`, `ISR <secondi>`,
    `dinamico`. Il gate lo confronta con gli slot che la pagina mostra: una
    pagina `statico` che mostra un contenuto editabile prende un `issue`, perche'
    il cliente cambiera' il testo dal gestionale e non vedra' cambiare niente
    finche' qualcuno non ripubblica. Non e' un `block`: un sito che si ripubblica
    a ogni modifica e' una scelta legittima SE E' DICHIARATA. Quello che non e'
    legittimo e' scoprirlo dal cliente.

  - `Titolo da:` il gate ne verifica la PRESENZA, non il contenuto: i metatag
    li misura speed-demon col suo passo `seo-meta`, che sa contarli invece di
    cercarli. Questa riga esiste perche' il titolo di una pagina e' CONTENUTO —
    viene dalla stessa riga di database da cui viene la pagina — e chi ottimizza
    a valle deve trovare scritto da dove, invece di inventarselo.
  - `Cosa mostra:` e `Perche' esiste:` sono prosa e nessuno strumento le legge.
    Si scrivono lo stesso: la prima e' l'unica difesa contro il caso cieco (una
    pagina che continua a rispondere e a mostrare tutt'altro — vedi §`evolve`
    della SKILL, caso F); la seconda e' quello che permette a chi legge un rosso
    di decidere se valeva la pena. Una pagina senza il suo «perche'» sta
    nell'elenco per inerzia.

RIGA FACOLTATIVA, quando serve:
  **Rimanda a:** /altro-percorso
Una pagina che risponde con un 3xx verso un'altra rotta NON e' quella pagina, e
senza questa riga il passo `pagine-vive` la boccia. Il precedente e' misurato:
speed-demon ha attribuito `performance 100` a una pagina che come documento non
esisteva, perche' il browser aveva seguito il rimando e nessuno se n'era
accorto.
-->

## Slot dei contenuti

| Slot | Pagina | Cosa contiene | Chi lo modifica |
|---|---|---|---|
| `{{home-hero}}` | `{{home}}` | {{titolo e sottotitolo dell'apertura}} | {{redattore, titolare}} |

<!--
SINTASSI la tabella, con queste quattro colonne in quest'ordine. Il gate legge
le prime due: la chiave dello slot e l'ID della pagina che deve mostrarlo (non
il percorso: l'id, quello dell'intestazione `## `id` — /percorso`).

Se il progetto non ha contenuti editabili si lascia l'intestazione e si scrive
sotto, su una riga fuori dalla tabella, `Nessuno slot.` Il passo `contenuti-vivi`
lo legge come una dichiarazione e non come un'omissione — ed e' l'unico modo per
distinguere «questo sito non ha testi editabili» da «nessuno ha compilato la
tabella».

Detto chiaro, perche' e' il buco piu' comodo di tutto questo contratto: un
`Nessuno slot.` FALSO rende il passo 9 quasi muto e il gate resta verde su un
sito coi testi cablati nel codice — cioe' su una telefonata a noi ogni volta che
il cliente vuole cambiare una parola (`DECISIONI.md` §24). Il gate legge la
dichiarazione, non la sua verita'.

La tabella la scrive schema-forge, la vista con cui il cliente la modifica la
genera gestionale-crafter, e questa vetrina la MOSTRA: tre agenti sulla stessa
tabella, e le chiavi devono coincidere in tutti e tre. Chi arriva secondo legge
l'handoff del primo invece di inventarsi le chiavi.
-->

## Pagine escluse dal contratto

- `{{/percorso}}` — {{perché è esclusa, e cosa la farebbe rientrare}}

<!--
SINTASSI le righe di elenco che cominciano con un percorso fra apici inversi: il
passo `pagine-vive` le legge per non segnalare come «pagina pubblica non
firmata» qualcosa che qualcuno ha gia' deciso di lasciare fuori.

Ogni riga dichiara anche COSA la farebbe rientrare, altrimenti l'esclusione
diventa definitiva per inerzia.

Esclusioni che reggono: le rotte dell'area amministrativa e la porta d'ingresso
(sono di gestionale-crafter, e su un progetto che ce l'ha si popolano da
`gestionale.config.json`); le rotte `route.ts` che non servono un documento; una
pagina di servizio che il framework genera. Una rotta dinamica con molte istanze
NON si esclude: se ne dichiara UNA come rappresentante, con la sua sezione, e si
scrive quale e perche'.

Esclusione che non regge: «e' una pagina di prova». Una pagina di prova servita
da una build di produzione e' una pagina pubblica come le altre, e la sta gia'
leggendo qualcuno.
-->

## Cosa questo contratto NON prova

Anche compilato per intero, firmato e con tutti e dieci i passi verdi, questo
file dice una cosa precisa e non di più.

**Non prova che le pagine elencate siano quelle giuste.** Il gate verifica che
ogni pagina dichiarata sia servita e che ogni pagina servita sia dichiarata; che
siano state dichiarate le pagine che servono al progetto lo garantisce solo la
riga `Confermato da:`, e quella è una firma, non una verifica.

**Non prova che quello che le pagine mostrano debba essere pubblico.** Il gate
vede un dato in pagina; non sa se qualcuno voleva che ci fosse. Una colonna che
la policy dell'anonimo concede per distrazione finisce in vetrina con dieci passi
verdi sopra. La difesa è la tabella §Dati visibili a un anonimo, e la firma che
ci sta accanto.

**Non prova che il sito sia fatto bene.** Nessun controllo deterministico del
design esiste. Le pagine esistono, sono finite, leggono da dove dicono: che siano
belle, chiare e utili lo decide chi le guarda.

**Non prova niente su come si vede.** Nessun passo apre una finestra: telefono,
viewport stretti, stampa, JavaScript disattivato, immagini che non arrivano.

**Non prova niente su domani.** Tutto ciò che sta qui vale su questa build, con
questo contenuto e con questo schema. È il motivo per cui la data accanto alla
firma è obbligatoria: senza data, un contratto verde è verde per sempre.

---

## Esempio compilato

Serve a mostrare la **forma**, non a fornire contenuti. Pagine, slot e tabelle
qui sotto sono di quel progetto.

````markdown
# Vetrina — Vivaio Corte Vecchia

Contratto della vetrina: quali pagine esistono, cosa mostra ciascuna, da dove
arriva ogni contenuto, che gerarchia hanno e chi l'ha deciso.

Confermato da: Elena Barbieri (titolare) (2026-07-24)

## Ambiente

URL servito: http://127.0.0.1:3100
Comando: npm run build && npm run start -- -p 3100
Tabella dei contenuti: site_content — chiave `slot`, pubblicato `is_published`
Lunghezza minima del frammento distintivo: 24 caratteri

## Gerarchia

Nella navigazione principale stanno quattro voci: Catalogo, Chi siamo, Dove
siamo, Contatti. La scheda di una pianta è figlia del catalogo e non compare in
navigazione: ci si arriva dal catalogo o da un link mandato per messaggio.
L'azione che il sito chiede è una sola — telefonare o scrivere — e per questo il
recapito sta sopra la piega su tutte e quattro le pagine principali.

Non esistono, ed è una scelta: il blog (nessuno lo aggiornerebbe), il carrello
(non si vende online), la versione in inglese (il vivaio serve la provincia).

## Dati visibili a un anonimo

| Tabella o vista | Cosa vede un visitatore senza account | Chi l'ha autorizzato |
|---|---|---|
| `piante` | nome, specie, foto, descrizione e fascia di prezzo delle piante con `pubblicata = true`. Restano fuori il costo d'acquisto e il fornitore | Elena Barbieri (titolare) (2026-07-24) |
| `site_content` | i soli slot con `is_published = true` | Elena Barbieri (titolare) (2026-07-24) |

## Percorsi di scrittura aperti al pubblico

Nessuna scrittura pubblica.

I contatti arrivano per telefono e per email: il modulo di contatto è stato
proposto e rifiutato dalla titolare il 2026-07-24 («le richieste vere arrivano al
telefono, il modulo mi riempirebbe la casella di spam»). Rientra se un giorno
servirà la prenotazione di una consulenza.

## `home` — /

**Cosa mostra:** l'apertura con la foto del vivaio e il recapito, le sei piante
in evidenza di stagione, e le tre righe su chi siamo.
**Contenuti da:** `slot:home-hero` · `slot:home-chi-siamo` · `tabella:piante`
**Titolo da:** slot `home-hero`, campo title
**Aggiornamento:** ISR 600
**Perché esiste:** è dove arriva il traffico dalla ricerca locale e da Maps, ed è
l'unica pagina con il numero di telefono sopra la piega.

## `catalogo` — /catalogo

**Cosa mostra:** tutte le piante pubblicate, con filtro per specie e per
esposizione, in schede con foto e fascia di prezzo.
**Contenuti da:** `tabella:piante` · `slot:catalogo-intro`
**Titolo da:** slot `catalogo-intro`, campo title
**Aggiornamento:** ISR 600
**Perché esiste:** è la seconda pagina di ogni visita che finisce in una
telefonata.

## `scheda-pianta` — /catalogo/acero-palmato

**Cosa mostra:** la scheda di una pianta: galleria, descrizione lunga,
esposizione, periodo di fioritura, e il richiamo al recapito.
**Contenuti da:** `tabella:piante`
**Titolo da:** colonna `piante.nome`
**Aggiornamento:** ISR 600
**Perché esiste:** è la pagina che il cliente manda per messaggio quando
consiglia una pianta. Rappresentante delle 48 istanze della rotta dinamica
`/catalogo/[slug]`: scelta perché è quella con la galleria più lunga.

## `contatti` — /contatti

**Cosa mostra:** recapiti, orari, mappa statica e le indicazioni per arrivare.
**Contenuti da:** `slot:contatti-testo`
**Titolo da:** slot `contatti-testo`, campo title
**Aggiornamento:** statico
**Perché esiste:** è la pagina che si apre in auto, davanti al cancello.

## Slot dei contenuti

| Slot | Pagina | Cosa contiene | Chi lo modifica |
|---|---|---|---|
| `home-hero` | `home` | titolo, sottotitolo e foto dell'apertura | titolare |
| `home-chi-siamo` | `home` | le tre righe di presentazione in home | titolare |
| `catalogo-intro` | `catalogo` | il testo sopra l'elenco delle piante | titolare |
| `contatti-testo` | `contatti` | orari, indicazioni e periodo di chiusura | titolare |

## Pagine escluse dal contratto

- `/catalogo/[slug]` (le altre 47 istanze) — stessa vista, stesso layout,
  stessi componenti di `scheda-pianta`. Rientrano se una scheda acquisirà
  contenuto che le altre non hanno.
- `/admin/*` e `/accedi` — sono del gestionale, non della vetrina (radici
  escluse in `vetrina.config.json`, lette da `gestionale.config.json`).
  Rientrano mai: non sono pagine pubbliche.
- `/api/newsletter` — rotta `route.ts`, nessun documento HTML da servire.
  Rientra se un giorno servirà una pagina.
````
