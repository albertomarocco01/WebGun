# Il perimetro — chi guarda cosa, e come si decide

> Carica questo file **prima del comando `perimetro`**, che è il primo del
> flusso. Sapere cosa **non** devi guardare è metà del lavoro, ed è la metà che
> nessuno faceva.

## Il difetto da cui nasce questa skill

Il verbale di catena del progetto pilota elencava, fra le «tre cose che un
anello ha dovuto indovinare» (verbale archiviato il 2026-08-07: `ARCHIVIO.md`;
il passo che conta è trascritto qui sotto per esteso):

> **La proprietà dell'Open Graph** era assegnata due volte nello stesso file
> (08 §6: a speed-demon e a site-doctor) — e site-doctor **non esiste**. La
> favicon aveva lo stesso problema, ed era un `404` misurato su ogni pagina.

Tre anelli della catena — vetrina-crafter, gestionale-crafter, flow-sentinel —
sono passati sopra un sito la cui favicon rispondeva `404` su ogni pagina, e
cinque gate verdi non l'hanno vista. Non perché nessuno se ne fosse occupato:
perché **due documenti dicevano che se ne stava occupando qualcun altro**.

La lezione non è «bisogna stare attenti». È strutturale:

> **Una voce con due proprietari è una voce di nessuno.**
> Una voce con un proprietario che non esiste è peggio: sembra assegnata.

## La regola, in una riga

> Dove un vicino **misura** una cosa, non la rimisuro: la **verifico
> dichiarata**. Dove nessuno la guarda, è mia. Dove nessuno la guarda e non è
> mia, si scrive **`scoperto`**.

«Verifico dichiarata» non vuol dire «mi fido». Vuol dire che il certificato deve
**citare il file** in cui il vicino l'ha scritto, quel file deve **esistere nel
progetto**, e deve **nominare quella voce**. Il passo `perimetro` lo controlla a
ogni esecuzione.

## Perché non rimisurare

Duplicare il controllo di un altro agente costa due volte e produce, prima o
poi, **due verità diverse sulla stessa cosa**. Quando divergono, la divergenza
non si presenta come un errore: si presenta come un falso verde da una parte e
un falso rosso dall'altra, e chi guarda crede alla più comoda delle due.

C'è anche una ragione più concreta, ed è la misura: i contrasti di colore non si
possono calcolare senza risolvere cascata e specificità, cioè senza un browser.
speed-demon un browser lo apre già (Lighthouse, categoria `accessibility`, che
contiene l'audit `color-contrast`) e il contratto `docs/performance.md` ne
dichiara la soglia. Rifare quella misura a mano, senza browser, vorrebbe dire
rifarla **peggio**.

## I tre esiti, e nessun quarto

| Esito | Quando | Cosa scrive il certificato | Cosa fa il gate |
|---|---|---|---|
| **mia** | nessun vicino la misura, e io ho un passo che la copre | `site-doctor` nella colonna proprietario | confronta l'esito dichiarato con lo stato del **passo di questa esecuzione**: se divergono, `block` |
| **delegata** | un vicino la misura già | il nome del vicino **e il file** dove l'ha dichiarato | verifica che il file esista e **nomini** la voce; altrimenti `block`. E se la delega è fra quelle che una misura ha trovato **vuote** (`SCOPERTE`), `issue` |
| **scoperta** | nessuno la guarda | `—` in entrambe le colonne | `issue` a ogni esecuzione: resta visibile |

## La delega vuota: nominare non è misurare

**Trovata dal collaudo P2, il 2026-08-06, e vale il collaudo.** Il passo
`perimetro` provava che il file citato **esiste** e **nomina** la voce, e
`SKILL.md` dichiarava che verificare se il vicino avesse fatto il suo lavoro
sarebbe stata «comprensione di un testo». **Non lo è**: la domanda non è cosa
dice l'handoff del vicino, è cosa fa il suo **gate**, e un gate è codice.

Misurate le nove deleghe con un `grep` sui gate dei vicini, **sette non
reggevano**:

| voce | delegata a | il suo gate la misura? |
|---|---|---|
| `canonical` | speed-demon | **sì** — passo `seo-meta`, sull'HTML servito |
| `noindex-private` | speed-demon | **sì** — stesso passo |
| `contrasti` | speed-demon | **no**: «contrast» non compare in nessun file della sua skill. Legge il **punteggio** della categoria `accessibility`, mai il singolo audit |
| `sitemap` | speed-demon | **no**: 0 occorrenze nel suo gate |
| `robots` | speed-demon | **no**: le occorrenze sono `<meta name="robots">`, cioè `noindex-private` |
| `open-graph` | speed-demon | **no**: 0 occorrenze di `og:` |
| `favicon` | speed-demon | **no**: 0 occorrenze — ed **è la voce del difetto** |
| `dati-strutturati` | speed-demon | **no**: 0 occorrenze di `application/ld` |
| `accessibilita-admin` | gestionale-crafter | **parziale**: `jsx-a11y` sui **sorgenti**, non sull'HTML servito |

La favicon del pilota è stata un `404` su ogni pagina per tre anelli perché due
documenti dicevano che se ne occupava qualcun altro. Questa skill nasce da lì —
e delegava la favicon a un gate in cui la parola «favicon» non compare. **Il
difetto non era stato corretto: era stato spostato di un livello.**

Le sette stanno in `SCOPERTE` (`scripts/conformita-lib.mjs`) **con accanto la
misura che le ha trovate**, e il passo le segnala `issue` a ogni esecuzione. Il
rilievo è `issue` e non `block` per la `DECISIONI.md` §8: un `block` sarebbe
rosso su ogni progetto della casa per una cosa che non è del progetto ma della
catena, e un rosso strutturale è un rosso che si impara a scavalcare.

**Una riga si toglie da `SCOPERTE` rilanciando il `grep`**, non leggendo un
handoff. È la stessa regola per cui il gate legge l'HTML servito e non il
sorgente.

**Non esiste «da valutare».** Una voce che non si sa dove mettere è una voce
scoperta finché qualcuno non decide, e va scritta scoperta.

## L'elenco delle voci vive nel codice

`scripts/conformita-lib.mjs`, costante `VOCI`. Non in questo file, non nel
template, non nel certificato del progetto.

Il motivo è il difetto n°13 del collaudo avversario di vetrina-crafter, in
un'altra forma: *«il gate leggeva i documenti che qualcuno poteva riscrivere»*.
Se l'elenco stesse solo in un documento, accorciare il documento **toglierebbe
la voce senza che nessuno decida di toglierla** — e il gate sarebbe verde su un
elenco più corto. Con l'elenco nel codice, il certificato può dichiarare
l'**esito** di ogni voce, non **quali voci esistono**.

## Come si legge l'handoff di un vicino

Il comando `perimetro` legge, in ordine: `docs/PROGETTO.md`, **tutti** gli
handoff (`docs/handoff/*.md`), e i contratti firmati (`docs/vetrina.md`,
`docs/gestionale.md`, `docs/flussi-critici.md`, `docs/performance.md`).

Per ogni voce si cerca **chi la nomina**. Tre casi, e il terzo è quello che
questa skill esiste per trovare:

1. **La nomina uno solo** → delegata a lui, col percorso del file.
2. **Non la nomina nessuno** → è mia se ho un passo che la copre, altrimenti
   scoperta.
3. **La nominano due** → **STOP**. Non si sceglie a caso e non si scrivono
   entrambi: si va a leggere cosa hanno fatto davvero, si assegna a **uno**, e
   si scrive nell'handoff perché. È esattamente il caso dell'Open Graph.

**Quello che questa lettura NON fa**, ed è dichiarato in `SKILL.md`: non
distingue un file che dice «fatto» da uno che dice «da fare». Leggere quello
vorrebbe dire capire un testo, e un controllo su prosa libera è un controllo che
non c'è (`DECISIONI.md` §19). Il confine sta di proposito da questa parte.

## Le voci, al 2026-08-06

| voce | proprietario tipico | perché |
|---|---|---|
| `informativa-privacy` | **site-doctor** | nessuno la guarda |
| `basi-giuridiche` | **site-doctor** | nessuno la guarda |
| `cookie-archiviazione` | **site-doctor** | nessuno la guarda |
| `consenso` | **site-doctor** | nessuno la guarda |
| `accessibilita-pubblico` | **site-doctor** | vetrina-crafter linta i **sorgenti**, speed-demon misura un **punteggio** su un elenco firmato: nessuno legge l'HTML servito di **ogni** pagina raggiungibile |
| `lingua-hreflang` | **site-doctor** | nessuno la guarda |
| `contrasti` | speed-demon | apre un browser; l'audit `color-contrast` è dentro la categoria `accessibility` di Lighthouse |
| `canonical` · `sitemap` · `robots` · `noindex-private` | speed-demon | li scrive e li dichiara in `docs/performance.md` e nel suo handoff |
| `open-graph` · `favicon` · `dati-strutturati` | speed-demon | **è la voce del difetto**: fino al 2026-08-06 la casa la assegnava a due agenti insieme |
| `accessibilita-admin` | gestionale-crafter | il suo gate ha il passo a11y sull'area protetta |
| `antispam` | **— scoperto** | sarebbe di cyber-shield, che non esiste. Delegare a una skill che non c'è è il difetto dell'Open Graph rifatto |

## Perché `antispam` resta scoperto e non delegato

`agenti/cyber-shield/` esiste come **cartella**, ed è uno scaffold 🔵: `SKILL.md`
di trenta righe con le sezioni operative a `TODO`. Scrivere
`antispam | cyber-shield | … | delegato` sarebbe formalmente compilabile e
sostanzialmente falso — ed è **esattamente** ciò che è successo con l'Open Graph,
dove il secondo proprietario era un site-doctor che non esisteva.

Il gate non lo sa dalla cartella: lo sa dal fatto che **nessun file del progetto
generato** dichiara quella voce, perché una skill che non ha mai girato non
scrive nessun handoff. È il motivo per cui il controllo guarda i file **del
progetto** e non l'elenco degli agenti della regia.

## Quando il perimetro cambia

Cambia quando nasce una skill, quando una skill acquisisce una voce, o quando
una misura dimostra che un vicino **non** guardava una cosa che si credeva
guardasse. In tutti e tre i casi:

1. si aggiorna `VOCI` in `conformita-lib.mjs`, con il suo test;
2. si aggiorna la tabella di `SKILL.md` §Perimetro e questa;
3. si scrive la proposta nello `STATO.md`, sezione **Proposte a monte/valle** —
   il consumatore riporta, il proprietario decide. Non si tocca il codice del
   vicino.
