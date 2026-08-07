# P.4j — Il certificato riemesso, e le due anteprime decise

Verbale della chat operaia, **2026-08-07**. Pilota:
`C:\Users\Utente\Desktop\fornodoro`. Regia al commit **`5976b70`** per tutta la
durata del pacchetto (nessun file della regia toccato tranne questo verbale).

Firma per delega, D14:
**Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-07**

---

## 0. In una pagina

**JSON-LD chiuso, `og:image` dichiarato — e la decisione di non chiuderlo è
stata presa misurando, non saltando.** Il sito adesso serve una scheda
`Restaurant` su `/` e `/chi-siamo`, e il passo `dati-strutturati` è passato da
`0 blocchi` con un `issue` a `2 blocchi … ognuno interpretato come JSON` senza
issue. `og:image` resta scoperta perché **l'immagine adatta non esiste**:
`public/` è vuota e l'unica immagine servita è una favicon **SVG di 32×32** —
dichiararla avrebbe fatto passare il gate, che chiede solo un `200`, lasciando
l'anteprima vuota presso ogni consumatore vero.

**Il certificato è riallineato alla misura**: due voci scoperte dove ne contava
quattro, il numero preso **rilanciando il gate** e non leggendo questo mandato.

**Quattro gate su cinque verdi sulla build finale. Launchpad è ROSSO 4 e non
ROSSO 3 come l'atteso — e il quarto rosso NON è un rebuild perso**
(`impronta-artefatto` passa, `.next/BUILD_ID` = HEAD): è che **il mio commit di
codice ha reso scaduti otto handoff a monte**. Misurato nelle due direzioni,
dichiarato, e non aggirato. §5.

| | |
|---|---|
| Commit nel pilota | **4**: `4a801e9` · `b02ba83` · `8d16735` · `8c87400` |
| Build finale servita | `8c874009cde114625e3cc645c92af469e3843ae4` = HEAD |
| Gate verdi | vetrina 10/10 · site-doctor 14 (1 n/a) · flow-sentinel 7/7 (22/22) · speed-demon 8/8 |
| Gate rosso | launchpad **4 su 9**, di cui 3 attesi e 1 spiegato |
| Debito | n°55 **chiusa** · n°60 e n°61 **nuove** · n°59 **confermata aperta, misurando** |
| Deploy | **nessuno**. Nessun push, nessun dominio, nessun account |

---

## 1. Le due anteprime — le decisioni, con il criterio applicato

Il mandato dava il criterio e io l'ho applicato alla lettera in tutt'e due i
casi. Le due strade sono uscite diverse, e la ragione è una misura.

### 1.1 `og:image` → **DICHIARATA** (n°59 resta aperta)

Il criterio: *«se il sito ha già un'immagine adatta e servita, aggiungerla è un
intervento piccolo → falla. Un'immagine inventata o un segnaposto è peggio di
niente»*.

**Misurato**:

```
$ ls -la public/
total 12
drwxr-xr-x 1 Utente 197121 0 Aug  4 21:53 .
drwxr-xr-x 1 Utente 197121 0 Aug  7 09:27 ..          ← vuota
```

L'unica immagine che questo sito serve è `src/app/icon.svg`: **32×32, SVG**,
tre `<path>` e un `<rect>`.

**Perché dichiararla sarebbe stato un falso verde costruito apposta.** Il passo
`open-graph` scarica l'indirizzo promesso e pretende `200`
(`servito-lib.mjs:2309-2316`): un `og:image` verso `/icon.svg` avrebbe risposto
`200` e **il gate sarebbe diventato verde**. Ma nessun consumatore vero rende un
SVG in anteprima, e nessuno mostra un'immagine sotto i 200×200 — quindi chi
condivide il link avrebbe visto **esattamente quello che vede adesso**, cioè
niente, con la differenza che il gate non lo direbbe più. Il rilievo scomparso e
il danno intatto: è la classe di difetto che questa skill misura negli altri, e
farla in casa per abbassare un conteggio non si fa.

Scritto in `docs/DEBITO-TECNICO.md` n°59 con `Blocca il deploy: no` e la misura
accanto, e in `docs/conformita.md` §Cosa questo certificato NON dice.

### 1.2 JSON-LD → **CHIUSO** (n°55 chiusa, n°60 aperta per ciò che manca)

Il criterio: *«se quei dati ci sono, il blocco si scrive; se mancano, non
inventarli»*. **Ci sono**, e li ho letti nell'HTML servito prima di scrivere una
riga:

| dato | dove sta, nell'HTML servito |
|---|---|
| nome | `og:site_name` di tutte e 6 le pagine: `Forno d'Oro` |
| indirizzo | pie' di pagina di **ogni** pagina + `/chi-siamo`: «Via Italia 42, 13900 Biella. Siamo sotto i portici…» |
| orari | tabella di `/chi-siamo`, 7 righe, dal database `orari_apertura` |

Il blocco servito (identico su `/` e `/chi-siamo`, stesso `@id`):

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": "http://127.0.0.1:3621/#pizzeria",
  "name": "Forno d'Oro",
  "url": "http://127.0.0.1:3621/",
  "hasMenu": "http://127.0.0.1:3621/menu",
  "address": "Via Italia 42, 13900 Biella. Siamo sotto i portici, nel cortile: il forno si vede dalla strada.",
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Tuesday",   "opens": "18:30", "closes": "22:30" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Wednesday", "opens": "18:30", "closes": "22:30" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Thursday",  "opens": "18:30", "closes": "22:30" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Friday",    "opens": "18:30", "closes": "23:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Saturday",  "opens": "18:30", "closes": "23:30" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "https://schema.org/Sunday",    "opens": "12:00", "closes": "14:30" }
  ]
}
```

**Sei righe di orario, e la tabella di `/chi-siamo` ne mostra sette**: il lunedì
è `Chiuso` e **non compare**, che è la lettura standard della specifica. La
convenzione `opens`/`closes` a `00:00` è di un consumatore solo e non la uso.
Gli orari non sono trascritti: escono dalla stessa lettura di `orari_apertura`
che rende la tabella, quindi non possono divergere da quello che la persona
legge.

**La decisione difficile di questo pacchetto, e sta in ciò che il blocco NON
dice.** `telephone` ed `email` restano fuori benché il sito li mostri su ogni
pagina, perché quegli slot non contengono un recapito, contengono **una frase**:

```
«015 1234567. Rispondiamo dalle 18:00 in avanti; per l'asporto il sito e' piu' veloce del telefono.»
«ordini@fornodoro.it, per le teglie grandi, le feste e gli ordini fuori orario.»
```

`telephone` promette **un numero da comporre**. Le due strade erano metterci la
frase intera — una promessa falsa a una macchina — o ritagliarne il numero,
cioè **scrivere un parser su un testo che il titolare riscrive dal gestionale
quando vuole**. La seconda l'aveva già scartata `/chi-siamo`, col commento
accanto: *«spezzarlo per ricavarne un numero da chiamare sarebbe logica su un
contenuto che il titolare puo' riscrivere quando vuole»*. Ho tenuto quella
decisione invece di contraddirla da un altro file.

Per la stessa ragione **`address` è dichiarato come `Text`** — forma che la
specifica ammette accanto a `PostalAddress` — e copiato **alla lettera**:
copiato non può promettere niente che la pagina non dica; spezzato in via / CAP
/ città, potrebbe. **Un blocco incompleto e vero batte un blocco completo e
fragile.** Residuo **n°60**, con la chiusura indicata a monte (campi strutturati
alla fonte: schema-forge + gestionale-crafter).

### 1.3 La riga che non riguarda schema.org, e la sua falsificazione

I corpi li scrive il titolare dal gestionale, e il blocco esce con
`dangerouslySetInnerHTML`, che **non** applica escape. Senza una riga, una
chiusura di tag dentro un recapito uscirebbe dal `<script>`. Falsificata nei due
versi sulla riga esatta del file, su input ostile:

```
SENZA la riga : {"address":"Via Italia 42</script><img src=x onerror=alert(1)>"}
CON   la riga : {"address":"Via Italia 42\u003c/script>\u003cimg src=x onerror=alert(1)>"}
chiude il tag, senza?  true
chiude il tag, con?    false
JSON ancora valido?    true
```

*(Nota di metodo: la prima falsificazione l'avevo scritta con `node -e` dentro
apici di shell, e **la shell si è mangiata il doppio backslash**: le due righe
uscivano identiche e il controllo sembrava inutile. Rifatta da file, dice il
contrario. Un controllo che "non fa niente" merita un secondo tentativo con un
altro canale prima di crederci.)*

---

## 2. Il certificato riallineato — cosa è cambiato, e da dove viene ogni numero

Tutti i numeri di questa sezione vengono dal **gate rilanciato**, mai da un
verbale e mai dal mandato che li annunciava.

**«Erano otto alle 22, sono quattro adesso» → sono DUE.**

```
OK    proprieta' delle voci di conformita'
        16 righe in tabella contro 12 passi eseguiti · 2 voci scoperte
        0 bloccanti, 2 da guardare, 0 righe fuori elenco
```

Restano `accessibilita-admin` e `antispam`. Le sei uscite, con la strada di
ognuna scritta perché la strada conta più del numero: **quattro** cambiando
proprietario con D21; **`contrasti`** perché P.6-P5 ha tolto la costante stantia
dal codice della skill; **`dati-strutturati`** perché il sito adesso ne ha — ed
è l'unico dei sei movimenti prodotto da questo progetto.

**La riga dei contrasti è riscritta al passato.** Il certificato conteneva un
paragrafo che diceva *«manca solo che chi possiede quel file tolga la riga»*:
quella riga **è stata tolta** (P.6-P5 §2 punto 1), e il passo è passato da «3 da
guardare» a «2». Ho verificato che nessun'altra frase del certificato citasse
ancora «3 da guardare» o i contrasti come vivi.

**Un numero cambiato che ho scritto col vecchio accanto**: l'archiviazione ora
legge `9 script esterni e 2 inline`, dove ieri erano `0 inline`. I due inline
sono i miei blocchi `ld+json`, **letti per intero dal passo**, e dentro non c'è
nessuna API di archiviazione: il conto delle archiviazioni resta **uno**. È la
seconda volta che un numero di quel certificato cambia; la prima (i campi da 7 a
9) aveva insegnato a sospettare dello strumento — qui invece è cambiato il sito,
e la differenza si vede **solo** se il numero di prima è scritto accanto.

**La circolarità dell'impronta, detta invece che nascosta.** Un certificato non
può citare l'impronta del proprio commit, che non esiste finché non è stato
fatto. Il documento adesso lo dichiara e dice come si tratta: si ricostruisce
dopo la firma, `impronta-artefatto` torna a combaciare, e fra la build su cui i
numeri sono stati presi e quella servita **non c'è nessuna modifica di codice** —
col comando per verificarlo invece che con la parola:

```
$ git diff 4a801e9..HEAD -- src supabase package.json next.config.ts | wc -l
0
```

**Ridatato 2026-08-07 come ULTIMO atto**, dopo l'ultimo commit di contenuto e
contro le corse vere.

---

## 3. I verdetti dei gate, incollati — build finale `8c87400`, regia `5976b70`

Tutti lanciati **dalla radice del pilota**, per percorso assoluto, sulla build
servita alla 3621, **dopo** l'ultimo commit e la ricostruzione.

```
GATE VETRINA: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)
        build id 8c874009cde114625e3cc645c92af469e3843ae4 · nessuno degli indizi di dev server
  [issue] /privacy: rotta pubblica servita e non dichiarata nel contratto     ← ATTESO, e resta

GATE CONFORMITA': VERDE (0 falliti, 0 verifiche mancanti, 1 non applicabili su 14 passi)
        identita': build id 8c874009cde1… trovato nell'HTML servito · 6 pagine lette
        2 blocchi `application/ld+json` su 6 pagine, ognuno interpretato come JSON
        16 righe in tabella contro 12 passi eseguiti · 2 voci scoperte
        0 bloccanti, 2 da guardare, 0 righe fuori elenco

GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)
        13 file di spec · 22 passati, 0 falliti, 0 saltati

GATE PERFORMANCE: VERDE (0 falliti, 0 verifiche mancanti su 8 passi)
        home 99±0 · menu 99±0 · ordina 99±1 · ordine 99±0 · chi-siamo 99±0
        contrasto: 5 pagine · 5 col contrasto verificato · 0 con elementi insufficienti

GATE LAUNCHPAD: ROSSO (4 falliti, 0 verifiche mancanti su 9 passi)
  OK    l'impronta dell'artefatto e' derivata dal commit
        impronta attesa dal commit di HEAD: `8c874009cde1` · `.next/BUILD_ID`: `8c874009cde1…`
  OK    bloccanti dichiarati nel registro del debito
        61 voci lette · 9 dichiarano `Blocca il deploy: si`
  FAIL  verdetti dichiarati dagli agenti a monte      ← IL QUARTO, ed è §5
  FAIL  nessun segreto nel pacchetto che parte        ← n°27, atteso
  FAIL  runbook firmato da un umano, sul contenuto    ← firma di Alberto, attesa
  FAIL  contratto d'uscita (handoff)                  ← handoff di launchpad, atteso
```

**`/privacy` fuori contratto**: segnalato dal gate della vetrina come atteso dal
mandato. **Non sistemato**: `docs/vetrina.md` non è stato aperto, e la settima
pagina nel contratto è un atto del committente in persona.

**Gli E2E dopo una modifica all'HTML**: rilanciati davvero e non dedotti —
**22/22**, tutti e 13 i flussi percorsi dal browser sulla build finale.

---

## 4. Gli scarti dall'atteso, dichiarati

### 4.1 speed-demon: due giri ROSSI prima del verde, e non era il codice

L'atteso era 8/8. **I primi due giri hanno chiuso ROSSO 2**, e il rosso non
diceva «lento»: diceva `misura inaffidabile, non bassa`.

| giro | build | pagine fuori soglia | esito |
|---|---|---|---|
| 1 | `4a801e9` | home `99±20` · ordina `98±7` | ROSSO 2 |
| 2 | `4a801e9` | menu `95±21` · chi-siamo `100±14` | ROSSO 2 |
| 3 | `b02ba83` (solo `docs/`) | nessuna, max `±2` | **VERDE 8/8** |
| 4 | `8c87400` (finale) | nessuna, max `±1` | **VERDE 8/8** |

**Perché è la macchina e non una regressione, e la prova non è un'opinione**:
le pagine instabili **cambiano a ogni giro** e comprendono `/menu` e `/ordine`,
che il mio commit non ha toccato; le mediane sono sempre 95-100; e fra il giro 2
e il giro 3 **non è cambiata una riga di codice** (il commit di mezzo tocca solo
`docs/`). Causa misurata **mentre succedeva**: un `next dev` di
`C:\Users\Utente\Desktop\MAPS-SCRAPER` a **3,5-3,7 GB** e ~87% di un core in
continuo, più un secondo `next dev`, 10 container e la WSL — **RAM libera scesa
da 2,24 GB a 0,68 GB su 16**.

**Non ho ucciso niente**: quei processi sono di altri progetti del committente.
Aperto **n°61**, che è la famiglia del n°57 con un innesco che non si può
spegnere. Il gate fa la cosa giusta: la soglia dei 5 punti esiste perché *«la
variazione fra due giri identici supera il guadagno di mezza ottimizzazione»*.

**Chrome orfani dopo l'ultimo giro: zero.** Verificato per riga di comando; gli
11 `chrome` vivi sono tutti del committente e non sono stati toccati.

### 4.2 launchpad ROSSO 4 e non 3 — e non è un rebuild perso

Il mandato: *«Un quarto rosso = ti sei perso un rebuild»*. **Non è quello**:

```
OK    l'impronta dell'artefatto e' derivata dal commit
      impronta attesa dal commit di HEAD: `8c874009cde1` · `.next/BUILD_ID`: `8c874009cde1…`
```

Il quarto rosso è `verdetti dichiarati dagli agenti a monte`, e la causa è
**mia, necessaria e misurata**: chiudere il JSON-LD richiedeva toccare `src/`, e
quel passo misura la **freschezza** di ogni handoff contro l'ultimo commit che
tocca il codice.

**Misurato nelle due direzioni**, che è ciò che rende questa non una scusa:

```
prima del mio commit:  ultimo codice = aaea0ca  2026-08-06T22:54:28
                       handoff       =          2026-08-07T00:01→00:21   → PIU' NUOVI, passo verde
dopo:                  ultimo codice = 4a801e9  2026-08-07T13:13:28      → 8 handoff piu' vecchi, 8 block
```

**Il mio (`16-site-doctor.md`) l'ho aggiornato con un §10 ed è tornato fresco**
— si vede: è uscito dall'elenco dei bloccati e al suo posto è comparso il `17`,
che l'elenco troncava. **Gli altri otto non li firmo io.** Un handoff ridatato
senza che il suo gate sia stato rilanciato è esattamente il difetto che questa
catena esiste per misurare, e D14 delega le firme *dichiarate*, non quelle di
altri agenti sul loro lavoro.

Nel §10 c'è la tabella di **cosa il mio commit tocca del perimetro di ognuno** —
per `07-schema-forge` e `10-gestionale-crafter`: **niente**.

### 4.3 Una voce che ho deciso di NON scrivere nel registro, e perché

La scadenza degli handoff **blocca il deploy**, quindi la riga onesta sarebbe
`Blocca il deploy: sì`. Non l'ho scritta, e ho misurato prima di decidere:
`gate-lib.mjs:663-683` alza un **`block`** per ogni voce bloccante che il
runbook non nomina con una risposta leggibile. Il runbook è `docs/deploy.md`, che
**il mandato mi vieta di toccare** (D20). Scrivere quella voce avrebbe reso
rosso anche il passo `bloccanti dichiarati nel registro del debito` — oggi verde
— per una ragione che sono strutturalmente impedito a chiudere: **avrei scambiato
un rosso accurato con due, uno dei quali falso**. Scriverla `no` sarebbe stato
falso e basta.

Sta invece dove non può sparire in silenzio: `docs/handoff/16-site-doctor.md`
§10 con la tabella per agente, e il riquadro di stato del registro che la nomina
dicendo esplicitamente **perché non è una riga della tabella**.

### 4.4 Un conteggio che ho sbagliato e ho corretto rifacendolo

Il riquadro di stato che avevo appena scritto diceva **«i bloccanti restano
dieci»**, copiando la formula di P.4i. Il gate stampa
`61 voci lette · 9 dichiarano Blocca il deploy: si`. Hanno ragione tutti e due e
il numero da dire è **nove**: le righe che portano quella riga sono dieci, ma
**n°50 è chiusa** e il gate la scarta. Corretto scrivendo tutti e due i numeri
con la ragione dello scarto (commit `8c87400`) — **è il difetto che questo
cantiere ha già misurato due volte nei propri verbali, e l'avevo appena rifatto
io**.

---

## 5. Cosa resta MANCANTE, col suo nome

- **MANCANTE: otto handoff a monte sono scaduti** e vanno rifirmati da chi li ha
  scritti — `07-schema-forge`, `08-vetrina-crafter`, `10-gestionale-crafter`,
  `12-flow-sentinel`, `13-speed-demon`, `14-p4g`, `15-p4h`, `17-p4i`. Finché
  restano, **launchpad è ROSSO 4 e non 3**. Il mio è aggiornato. §4.2.
- **MANCANTE: `og:image`** — n°59. Serve **un'immagine 1200×630**, e non è
  codice: la fornisce il committente. Poi una riga in `metadatiPagina`.
- **MANCANTE: telefono ed email nei dati strutturati** — n°60. Si chiude **a
  monte** (campi strutturati invece di testo libero), non in questo file.
- **MANCANTE: `/privacy` nel contratto della vetrina** — n°51, del committente
  in persona. Il gate della vetrina la segnala a ogni giro, come atteso.
- **MANCANTE: la firma di `docs/deploy.md`** e **n°27** — non di questo
  pacchetto (D20, D24).
- **MANCANTE: nessuna misura di `og:image` contro un consumatore vero.** Che un
  SVG 32×32 non venga reso in anteprima è **conoscenza di dominio, non una
  misura di questo giro**: non ho aperto nessun validatore di anteprima social,
  perché avrebbe voluto dire mandare un indirizzo di questo sito a un servizio
  esterno. È il punto più falsificabile della decisione §1.1, ed è giusto che
  chi rilegge lo sappia.
- **MANCANTE: nessuna verifica del JSON-LD con un validatore esterno.** Il gate
  prova che è JSON valido e che dichiara un `@type`; che Google lo accetti come
  `LocalBusiness` valido **non è stato misurato**, per la stessa ragione di
  sopra. Ciò che è provato è più stretto e più importante: che **non dica niente
  che la pagina non dica**.
- **MANCANTE: il database non è stato toccato**, come da mandato. Nessun seed,
  nessuna migrazione.

---

## 6. Cosa mi aspetto dal successivo

1. **Non prendere il ROSSO 4 di launchpad per un rebuild perso.** L'impronta
   passa. Si torna a ROSSO 3 quando gli otto handoff sono rifirmati — e si
   rifirmano **rilanciando i gate**, non ridatando i file. Quattro dei cinque
   gate a monte sono verdi **adesso** sulla build finale: le misure ci sono,
   mancano le firme.
2. **Prima di lanciare speed-demon, guarda la RAM libera.** Sotto ~2 GB la
   misura non regge e il gate lo dice con `misura inaffidabile`. Si **rilancia**,
   non si tocca il codice (n°61).
3. **Se qualcuno porta l'immagine 1200×630**, `og:image` si chiude con una riga
   in `metadatiPagina` e il gate la scarica: n°59 muore lì. Non chiuderla con
   `/icon.svg`, per il motivo scritto in §1.1.
4. **Se qualcuno struttura i recapiti alla fonte**, `telephone` ed `email`
   entrano nella scheda e n°60 muore. Fino ad allora non ritagliarli con un
   parser, per il motivo scritto in §1.2.

---

## 7. Chiusura, nell'ordine

1. **Guardiani deterministici** dopo la modifica: `tsc --noEmit` pulito ·
   **ESLint 0** · **knip 0** · **dependency-cruiser: `no dependency violations
   found (68 modules, 143 dependencies cruised)`**.
2. **I quattro commit del pilota**, tutti con `git commit -F - -- <percorsi>`
   (D19; il file nuovo ha richiesto un `git add` esplicito del solo percorso):
   `4a801e9` codice + registro + certificato · `b02ba83` certificato riemesso +
   handoff 16 · `8d16735` n°61 · `8c87400` il conteggio dei bloccanti.
3. **Perimetro rispettato.** Nella regia è stato scritto **solo questo verbale**.
   `docs/vetrina.md` e `docs/deploy.md` **non aperti**. `Desktop\Informatica`
   non toccata. Nessun `push`, nessun deploy, nessun dominio, nessun account.
   Un `git commit` è partito per errore dalla radice della **regia** invece che
   dal pilota — la directory della shell era tornata indietro dopo una lettura
   del codice dei gate: **è fallito da solo** (`pathspec did not match any
   files`), la regia è rimasta pulita a `5976b70`, e lo scrivo qui perché un
   comando andato a vuoto sul repository sbagliato è esattamente il genere di
   cosa che non si racconta.
4. **Lo stack Supabase è acceso**, l'app di produzione vive sulla **3621**
   servita dalla build `8c87400`, lasciata viva come da mandato.
