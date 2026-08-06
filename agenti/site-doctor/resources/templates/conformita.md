# Certificato di idoneità — {{NOME DEL SITO}}

Questo documento dice, **voce per voce**, cosa è stato guardato prima di
pubblicare, con che esito, e **chi risponde di ogni voce**. Non è un riassunto
del gate: è il documento che **launchpad legge per decidere se pubblicare**, e
senza il quale non pubblica.

Chi firma qui non firma il codice. Firma tre cose, e sono tre cose che il
software non può decidere al posto suo: **quali dati questo sito raccoglie e con
quale base giuridica**, **cosa mette nel browser di chi passa**, e **quali voci
restano scoperte**. Le prime due riguardano persone che non ci hanno mai
parlato; la terza è l'unica difesa contro una voce che sparisce senza che
nessuno decida di toglierla.

> **Nessuna riga di questo documento è consulenza legale.** Site Doctor misura
> che l'informativa esista, sia raggiungibile e nomini le voci che l'art. 13 del
> Regolamento pretende; non sa se le basi giuridiche dichiarate siano quelle
> giuste né se i tempi di conservazione siano leciti. Quello lo firma chi
> risponde davanti al Garante.

Confermato da: {{NOME COGNOME}} ({{RUOLO}}) il {{AAAA-MM-GG}}

<!-- La firma per DELEGA si scrive per esteso e non col nome di chi non ha
     letto (D14 della regia):
     Confermato da: Direzione lavori (per delega del committente {{NOME}}) il {{AAAA-MM-GG}}
     La data va in forma ISO: il gate la legge, e `il 6 agosto 2026` non la
     legge nessuno. -->

## Ambiente

URL verificato: {{http://127.0.0.1:3000}}
Lingue dichiarate: {{it}}
Informativa privacy: {{/privacy}}
Banner di consenso: {{no}}

<!-- `Lingue dichiarate` è l'elenco separato da spazi delle lingue che il sito
     serve davvero (`it`, oppure `it en fr`). Il gate confronta questo elenco
     con i `lang` che misura sulle pagine servite: se il sito ha una lingua sola
     il passo chiude NON APPLICABILE, e la premessa misurata la stampa lui.

     `Banner di consenso` si scrive `sì` **solo se** la misura ha trovato
     archiviazione non essenziale. Un banner su un sito che non pone nulla di
     non essenziale è un danno: abitua a cliccare «accetto» senza leggere, e non
     protegge niente. -->

## Superficie pubblica dichiarata

Le pagine che un visitatore anonimo raggiunge. Il gate **le cammina**, non le
copia da qui: questa tabella serve a far emergere le due differenze che
contano — una pagina raggiungibile che nessuno ha dichiarato, e una pagina
dichiarata che non risponde.

| percorso | cosa fa |
|---|---|
| {{/}} | {{la home}} |
| {{/contatti}} | {{il modulo di contatto}} |
| {{/privacy}} | {{l'informativa}} |

## Archiviazione dichiarata

Tutto quello che questo sito mette nel **terminale** di chi lo visita: cookie,
`localStorage`, `sessionStorage`, `indexedDB`, e **le origini di terzi** che
carica. Un terzo va dichiarato qui con la sua origine (`https://cdn.esempio.it`)
perché quello che un terzo scrive nel browser **questo gate non lo può
misurare**: è per quello che non dichiararlo è un bloccante e non un rilievo.

| chiave | tipo | essenziale | scopo | dove |
|---|---|---|---|---|
| {{nomesito:carrello}} | {{localStorage}} | {{sì}} | {{tiene il carrello fra una pagina e l'altra}} | {{/ordina}} |

<!-- `essenziale`: `sì` per ciò che serve a fornire il servizio che la persona ha
     chiesto (carrello, sessione, preferenza di lingua, protezione CSRF). Tutto
     il resto — analitica, mappe, incorporamenti, pubblicità — è `no`, e vuole
     il consenso PRIMA di essere posto.

     Cosa il gate confronta, colonna per colonna, perché seguire il modello e
     passare il gate devono essere la stessa cosa:
       - un COOKIE si dichiara col suo nome in `chiave` (`sl_sessione`), che è
         quello che si misura nel `Set-Cookie`;
       - un TERZO si dichiara con la sua origine in `chiave`
         (`https://www.google.com`);
       - un'API DI ARCHIVIAZIONE (`localStorage`, `sessionStorage`,
         `indexedDB`, `document.cookie`) si nomina in `tipo`, e in `chiave` va
         la chiave archiviata: nei bundle si misura il nome dell'API, non la
         chiave. Una riga per chiave archiviata, quindi, e se due chiavi usano
         la stessa API basta che UNA sia `essenziale: no` perché il banner
         diventi obbligatorio. -->

## Dati raccolti dai moduli pubblici

Una riga per **ogni campo** di ogni modulo pubblico che raccoglie un dato
personale. Il gate legge i campi dall'HTML servito e pretende di ritrovarli qui:
un campo con `autocomplete="tel"` o `type="email"` che non compare in questa
tabella è un bloccante.

| modulo | campo | base giuridica | conservazione |
|---|---|---|---|
| {{/contatti}} | {{nome}} | {{misure precontrattuali richieste dall'interessato (art. 6.1.b)}} | {{12 mesi}} |
| {{/contatti}} | {{email}} | {{misure precontrattuali richieste dall'interessato (art. 6.1.b)}} | {{12 mesi}} |

## Voci di conformità e proprietà

**La tabella per cui questa skill esiste.** Ogni voce ha **un proprietario
solo**. Tre esiti possibili e nessun quarto:

- **`site-doctor`** — la misuro io, e l'esito viene dal passo del gate che la
  copre: non si scrive a mano, si copia dall'esecuzione.
- **un vicino** (`speed-demon`, `gestionale-crafter`, `vetrina-crafter`,
  `flow-sentinel`, `schema-forge`) — allora la colonna «dove è dichiarato» porta
  il **percorso di un file del progetto** che esiste e che **nomina** quella
  voce. «Lo guarda un altro» non è verificabile finché non si dice in quale file.
- **`—` (scoperto)** — nessuno la guarda. Resta scoperta, e resta **visibile**:
  il gate la segnala a ogni esecuzione. Dichiararla è l'unica cosa che la
  distingue da una dimenticata.

L'elenco delle voci **non si accorcia riscrivendo questo file**: vive in
`scripts/conformita-lib.mjs` (`VOCI`), e una voce che manca da questa tabella è
un bloccante. È la cicatrice del 2026-08-06: l'Open Graph era assegnato **due
volte nello stesso handoff**, a speed-demon *e* a un site-doctor che non
esisteva, e la favicon del pilota è stata un `404` su ogni pagina per tre anelli.

| voce | proprietario | dove è dichiarato | esito |
|---|---|---|---|
| informativa-privacy | site-doctor | — | {{conforme}} |
| basi-giuridiche | site-doctor | — | {{conforme}} |
| cookie-archiviazione | site-doctor | — | {{conforme}} |
| consenso | site-doctor | — | {{conforme}} |
| accessibilita-pubblico | site-doctor | — | {{conforme}} |
| lingua-hreflang | site-doctor | — | {{non applicabile}} |
| contrasti | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| canonical | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| sitemap | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| robots | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| noindex-private | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| open-graph | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| favicon | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| dati-strutturati | speed-demon | {{docs/handoff/13-speed-demon.md}} | delegato |
| accessibilita-admin | gestionale-crafter | {{docs/handoff/10-gestionale-crafter.md}} | delegato |
| antispam | — | — | scoperto |

<!-- Gli esiti ammessi per le voci `site-doctor` sono esattamente quattro, e
     devono combaciare con l'esecuzione del gate:
       conforme · non conforme · non verificato · non applicabile -->

## Deroghe

Una riga per ogni cosa che **non** è conforme e che si è deciso di pubblicare
lo stesso, con **chi** l'ha deciso e **quando rientra**. Una deroga senza rientro
non è una deroga, è una rinuncia scritta in piccolo.

| voce | cosa resta | perché si pubblica lo stesso | chi lo ha deciso | rientro previsto |
|---|---|---|---|---|
| {{—}} | {{—}} | {{—}} | {{—}} | {{—}} |

## Cosa questo certificato NON dice

- Che il sito sia **conforme al GDPR**: dice che l'informativa esiste, è
  raggiungibile, nomina le voci obbligatorie, e che ogni campo raccolto ha una
  base giuridica **scritta**. Non che sia quella giusta.
- Che il sito sia **accessibile**: dice quello che si vede nell'HTML servito. I
  contrasti li misura speed-demon con un browser; ordine di tabulazione, focus
  visibile, screen reader e messaggi d'errore non li misura nessuno dei due.
- Che la **superficie scoperta** sia tutta la superficie: si cammina dai
  collegamenti e dalla `sitemap.xml`. Una pagina che nessuno linka non entra.
- Che i **cookie misurati** siano tutti i cookie: si legge quello che il sito
  pone a un visitatore anonimo che non fa nulla.
- Che resti vero **domani**: è una fotografia di questa build a questa data. Si
  rilancia, o non vale.
