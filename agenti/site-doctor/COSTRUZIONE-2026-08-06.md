# P.6 — site-doctor, progettazione e costruzione in un solo pacchetto

> Verbale dell'operaio, 2026-08-06. Mandato:
> `agenti/site-doctor/prompts/P6-progetta-costruisci.md` (Opus 5 · high).
> P0 e P1 unite in un pacchetto solo (**D17**), P2 resta in chat vergine.
> Banco: il pilota `fornodoro`, **in sola lettura** (D17 §3), più un banco
> statico costruito qui.

---

## 1. Le scelte che ho preso da solo (D14)

Nessuna domanda al committente. Ogni riga è una decisione mia, con la
motivazione e con cosa succede se è sbagliata.

| # | Scelta | Alternativa scartata | Motivo |
|---|---|---|---|
| S1 | **Quattro stati invece di tre**: `pass` · `fail` · `skipped` · **`n/a`** | tre stati, con `pass` oppure `skipped` per i casi non applicabili | tre stati costringono a mentire su due casi veri (sito monolingua, sito senza moduli). `pass` è una bugia comoda; `skipped` tiene rosso un gate che ha finito, e un rosso strutturale insegna a ignorare i rossi (§8) |
| S2 | **`n/a` costa una premessa misurata**, passata come argomento alla funzione che lo produce, che torna `skipped` se manca | `n/a` deciso dal passo | senza il vincolo, la quarta risposta sarebbe solo un modo più elegante di tacere |
| S3 | **I passi che misurano il sito NON dipendono dal certificato** | contratto assente → tutti i passi mancanti | un gate rosso per il solo contratto mancante avrebbe imparato a tacere sul resto. Sul pilota è la differenza fra «1 motivo» e «cinque motivi veri» |
| S4 | **L'elenco delle voci di conformità vive nel codice** (`VOCI`), non nel documento | elenco nel template del certificato | un elenco che sta solo in un file di testo lo si accorcia riscrivendo il file: la voce non viene decisa via, **sparisce**. È il difetto n°13 del collaudo di vetrina-crafter in un'altra forma |
| S5 | **Nessuno strumento esterno**: solo `fetch` e lettura di file | Playwright o Lighthouse per contrasti e cookie da browser | al gate serve **l'interprete**, non il `PATH`: la nota di macchina del 2026-08-06 non lo tocca, e gira col node di sistema. Prezzo dichiarato: i contrasti non li misura, e sono delegati |
| S6 | **I contrasti sono di speed-demon**, verificati dichiarati | misurarli qui | senza browser vorrebbe dire risolvere cascata e specificità a mano: si rifarebbe **peggio** una misura che esiste già dentro la categoria `accessibility` di Lighthouse |
| S7 | **L'accessibilità del sito pubblico è mia**, anche se due vicini la sfiorano | delegarla a vetrina-crafter + speed-demon | loro misurano un **campione dichiarato**; qui si misura la **superficie camminata**. Sono insiemi diversi, e la differenza si vede appena qualcuno aggiunge una pagina |
| S8 | **La superficie si scopre da DUE sorgenti** (collegamenti da `/` e `sitemap.xml`) | i soli collegamenti | una camminata che fallisce in silenzio e una che ha trovato tutto avrebbero lo stesso aspetto |
| S9 | **Un terzo non dichiarato è un `block`** | `issue` | è la cosa che questo gate **non può misurare** (non scarica codice di terzi): proprio per questo dev'essere scritta |
| S10 | **La prova di «dato personale» ha due forze**: `autocomplete`/`type` → `block`; nome del campo → `issue` | tutto `block` | §17: un'euristica non produce un bloccante. `nome` può essere il nome di una persona o di una pizza |
| S11 | **`antispam` resta `scoperto`, non delegato a cyber-shield** | delegarlo | cyber-shield è uno scaffold: nessun file del progetto lo dichiara. Delegare a una skill che non c'è **è** il difetto dell'Open Graph |
| S12 | **Il banco è un file `.mjs` tracciato**, non un progetto Next+Supabase | banco usa e getta (§12) | la §25 traccia «il banco che un clone pulito sa rilanciare»: zero dipendenze, zero database, zero chiavi. Ogni affermazione di sabotaggio si rilancia con un comando |
| S13 | **Un solo documento**: `docs/conformita.md` è insieme contratto (dichiarazioni) e certificato (esiti) | due documenti | è la forma di `docs/performance.md`: due documenti divergono, e la divergenza si scopre come falso verde |
| S14 | **Il gate emette un `block` sull'identità e misura lo stesso**, quando l'app servita è questo progetto a una build precedente | non misurare | il sito **è** questo: le misure dicono il vero su ciò che è online. Il certificato no, e quello è il bloccante |
| S15 | **La firma del banco è per delega dichiarata** (D14) | firmarla col nome del committente | mai il nome di chi non ha letto |
| S16 | **Timeout su ogni richiesta** (15 s) | nessun timeout, come le altre cinque skill | un gate appeso non è né verde né rosso. È il punto aperto n°6 dello `STATO.md` di vetrina-crafter, chiuso alla nascita invece che dopo |

---

## 2. Il perimetro

Il primo deliverable, e il motivo per cui questo pacchetto esiste. Il verbale di
catena, §4, registra:

> **La proprietà dell'Open Graph** era assegnata due volte nello stesso file
> (08 §6: a speed-demon e a site-doctor) — e site-doctor **non esiste**. La
> favicon aveva lo stesso problema, ed era un `404` misurato su ogni pagina.

Tre anelli sono passati sopra un sito con la favicon a `404`, e cinque gate
verdi non l'hanno vista: non perché nessuno se ne fosse occupato, ma perché
**due documenti dicevano che se ne stava occupando qualcun altro**.

**La regola**: dove un vicino **misura**, non rimisuro — **verifico dichiarato**,
e il certificato deve citare il file che lo dice, quel file deve esistere, e deve
**nominare** quella voce. Dove nessuno guarda, è mio. Dove nessuno guarda e non è
mio, si scrive **`scoperto`**.

### Mie, e misurate (6 voci)

`informativa-privacy` · `basi-giuridiche` · `cookie-archiviazione` · `consenso` ·
`accessibilita-pubblico` · `lingua-hreflang`

### Escluse, col nome del vicino che le copre (9 voci)

| voce | vicino | dove lo verifico |
|---|---|---|
| `contrasti` | **speed-demon** | apre un browser; `color-contrast` è dentro la categoria `accessibility` di Lighthouse, e `docs/performance.md` ne dichiara la soglia |
| `canonical` · `sitemap` · `robots` · `noindex-private` | **speed-demon** | `docs/handoff/<n>-speed-demon.md` |
| `open-graph` · `favicon` · `dati-strutturati` | **speed-demon** | **è la voce del difetto**: da qui in avanti ha **un** proprietario, e il gate rifiuta la tabella che gliene dà due |
| `accessibilita-admin` | **gestionale-crafter** | il suo gate ha il passo a11y sull'area protetta |

### Scoperta, dichiarata tale (1 voce)

| voce | perché non è delegata |
|---|---|
| `antispam` (antispam e limiti di frequenza sui moduli pubblici) | sarebbe di **cyber-shield**, che è uno scaffold 🔵. Scrivere `cyber-shield | … | delegato` sarebbe formalmente compilabile e sostanzialmente falso — **esattamente** ciò che è successo con l'Open Graph, dove il secondo proprietario era un site-doctor che non esisteva. Produce un `issue` a ogni esecuzione: resta scoperta e resta **visibile** |

**Come il gate lo rende falsificabile** (`findingsPerimetro`): voce assente
dall'elenco del codice → `block`; **due proprietari diversi → `block`** (è il
difetto, letteralmente); proprietario `site-doctor` su una voce che nessun passo
misura → `block`; esito dichiarato ≠ esito di questa esecuzione → `block` (§19
applicata voce per voce); delegata a un file che non esiste, o che esiste e non
la nomina → `block`; scoperta → `issue`.

**Quello che NON prova, e sta scritto in `SKILL.md`**: che il file citato dica
«fatto» invece di «da fare». Leggere quello vorrebbe dire capire un testo, e un
controllo su prosa libera è un controllo che non c'è (§19). Il confine sta di
proposito da questa parte.

---

## 3. I passi del gate — quelli scelti e quelli scartati

### I nove scelti

| # | id | cosa prova |
|---|---|---|
| 1 | `certificato` | esiste un certificato firmato, con data ISO, lingue, e la tabella di proprietà |
| 2 | `superficie-pubblica` | l'app risponde, è **questa** build, e la superficie è camminata da due sorgenti indipendenti |
| 3 | `informativa-privacy` | esiste, risponde 200, è collegata **da ogni** pagina, nomina le sette voci dell'art. 13, non ha segnaposto |
| 4 | `dati-raccolti` | ogni campo personale ha una base giuridica dichiarata, e il punto di raccolta rimanda all'informativa |
| 5 | `archiviazione-client` | cosa il sito archivia davvero (cookie + API nei bundle) e quali terzi carica, contro il dichiarato |
| 6 | `accessibilita-servita` | lingua, titoli, `alt`, `main`, etichette, nomi accessibili — su **ogni** pagina scoperta |
| 7 | `lingua-e-hreflang` | i `lang` misurati contro le lingue dichiarate; hreflang reciproci se multilingua |
| 8 | `perimetro` | ogni voce ha un proprietario solo, le delegate citano un file che le nomina |
| 9 | `contratto-uscita` | §19: la riga `Gate:` dell'handoff dice il vero su questa esecuzione |

### Quelli scartati, e valgono quanto i primi

| passo scartato | perché |
|---|---|
| **contrasti di colore** | vuole un browser. speed-demon lo misura già: rifarlo peggio e poi vederlo divergere è la ragione stessa della Legge n°2 |
| **verifica del contenuto dell'informativa** (che dica il vero, non solo che nomini le voci) | comprensione di un testo. §19: un controllo su prosa libera è un controllo che non c'è |
| **camminata con un browser** (per i cookie posti dopo un'azione e i moduli costruiti in JavaScript) | trascinerebbe Playwright dentro una skill senza dipendenze e duplicherebbe l'infrastruttura di flow-sentinel. **La proposta giusta è a flow-sentinel**, ed è nello `STATO.md` §Proposte n°5 |
| **validazione HTML (W3C)** | centinaia di rilievi su ogni progetto Next, nessuno dei quali riguarda la conformità: rumore che si impara a ignorare |
| **`robots.txt` e `sitemap.xml` come voci misurate** | sono di speed-demon (`CANTIERE.md` P.6: «non si rimisurano»). La `sitemap.xml` qui si **legge** come seconda sorgente della superficie, che è un'altra cosa |
| **tempo di risposta** | di speed-demon, e sarebbe la terza misura della stessa cosa |
| **verifica che il file citato da un vicino dica «fatto»** | vedi sopra |

---

## 4. Lo STOP di metà pacchetto — otto punti cambiati prima del codice

Il mandato prescrive di fermarsi a metà e rileggere la progettazione con una
domanda sola: **quale passo del mio gate potrebbe essere verde su un sito che non
è conforme?** L'ho fatto prima di scrivere una riga di libreria. Otto risposte,
tutte diventate modifiche alla progettazione.

| # | Il passo che poteva essere verde | Cosa ho cambiato |
|---|---|---|
| 1 | **`superficie-pubblica`** — se la camminata trova solo `/` (home senza `<a>`, parser che sbaglia), «ho trovato una pagina» e «le ho trovate tutte» si somigliano | due sorgenti indipendenti, e un `block` se i collegamenti danno ≤1 pagina mentre la sitemap ne dà di più |
| 2 | **`informativa-privacy`** — una pagina che nomina le sette voci dentro un *lorem ipsum* | il passo rifiuta **da sé** i segnaposto e il testo sotto 400 battute. Non delego a `segnaposto-serviti` di vetrina-crafter: quel passo guarda le pagine del **suo** contratto, e l'informativa non c'è |
| 3 | **`informativa-privacy`** — cercarla a percorsi indovinati (`/privacy`, `/cookie`…) trova una pagina che nessuno linka e manca una a `/note-legali/clienti` | i candidati vengono **dai collegamenti** che le pagine mettono davanti a chi visita. Nessun elenco di tentativi |
| 4 | **`dati-raccolti`** — decidere «dato personale» dal nome del campo lascia passare un `campo1` che raccoglie un telefono, e blocca un `nome` che è il nome di una pizza | due forze di prova (§17): `autocomplete`/`type` → `block`, nome → `issue` |
| 5 | **`archiviazione-client`** — un terzo (analitica, mappa, font) fa nel browser cose che questo gate non può misurare | un'origine di terzi non dichiarata è un **`block`**, proprio perché non è misurabile |
| 6 | **`accessibilita-servita`** — su Next il carico RSC porta l'albero serializzato dentro `<script>`: `["$","h1",…]`, `["$","img",…]`. Contare i tag senza ripulire legge due volte lo stesso documento | si toglie il corpo di `<script>` e `<style>` e i commenti **prima** di contare qualunque tag |
| 7 | **`lingua-e-hreflang`** — la premessa di `NON APPLICABILE` era **circolare**: «non ho trovato rotte alternative» si sarebbe misurato dagli hreflang, quindi **un sito multilingua a cui mancano gli hreflang — la non conformità da trovare — sarebbe uscito «non applicabile»** | la premessa è una misura indipendente: l'insieme dei `lang` dichiarati dalle pagine servite, più le rotte per lingua nella superficie |
| 8 | **`perimetro`** — la colonna «esito» la scrive chi compila il documento, quindi una voce mia poteva dichiararsi «conforme» mentre il mio passo la misurava rossa | per le voci di `site-doctor` l'esito dichiarato si confronta con lo **stato del passo di questa esecuzione**: divergenza → `block` |

Il settimo è quello che vale il pacchetto: era una circolarità, non una svista, e
sarebbe stata invisibile a chiunque avesse letto il codice **dopo** averlo
scritto.

**Un nono cambiamento, dallo stesso STOP ma di forma diversa**: tutti i passi che
leggono l'app consumano la superficie stabilita dal passo 2. Se l'identità
dell'app non è stabilita, sono **MANCANTI**, non verdi — leggere l'HTML di
un'altra applicazione e trovarci l'informativa giusta sarebbe il falso verde più
costoso di tutti.

---

## 5. I sei difetti trovati **dopo** lo STOP — e chi li ha trovati

Lo STOP è un'autorevisione, e un'autorevisione trova ciò che chi ha scritto sa
già di dover cercare. Questi sei li ha trovati **l'esecuzione**, e nessuno di
essi era nell'elenco di sopra.

### 5.1 — Trovato dal PRIMO LANCIO sul pilota: la diagnosi bugiarda sull'identità

Il controllo d'identità confrontava il solo `BUILD_ID` e, quando non combaciava,
diceva: *«sta rispondendo un'altra applicazione sulla stessa porta»*. Sul pilota
era **questo** sito, servito da un processo partito prima dell'ultima build di
un'altra chat.

Il gate di **speed-demon**, rilanciato da me sullo stesso indirizzo nello stesso
minuto, ha dato lo stesso verdetto con la stessa frase: **entrambe le frasi
additavano l'imputato sbagliato**. È la classe del difetto n°1 del collaudo
avversario di vetrina-crafter.

**Corretto** con una seconda via che non dipende dal build id: si prende un asset
statico che l'HTML servito referenzia, lo si scarica e lo si confronta **byte per
byte** con il file sotto `.next/` di questo progetto. Tre diagnosi invece di due,
e la seconda **lascia misurare** (il sito è questo) pur bloccando il certificato.
→ è la **proposta n°1 a speed-demon** nello `STATO.md`.

### 5.2, 5.3, 5.4 — Trovati dal SABOTAGGIO

Al primo giro delle 25 classi, tre restavano **verdi**.

| classe | il gate diceva | la causa | la correzione |
|---|---|---|---|
| **H** — terzo non dichiarato | «zero terzi» | `senzaScript` cancellava i tag `<script>` **per intero**, e `terziDi` — che cerca proprio gli `src` di terzi — girava su un documento da cui gli script li avevamo tolti noi | si toglie il **corpo** e si tiene il tag di apertura |
| **M** — gerarchia dei titoli saltata | nessun rilievo | il salto di livello era un `issue`, e solo un `block` fa fallire un passo: il passo dichiarava di provare la gerarchia dei titoli ed era **verde con la gerarchia rotta** | promosso a `block` — la prova è interamente nel documento, senza euristica (§17) |
| **X** — sitemap più ricca dei collegamenti | nessun rilievo | la camminata partiva **anche** dalle pagine della sitemap, quindi i collegamenti trovati su quelle pagine rientravano fra «i collegamenti»: **le due sorgenti che dovevano controllarsi a vicenda si alimentavano** | la sitemap resta un seme per lo scarico; la raggiungibilità da `/` si calcola sul **grafo** |

La classe X è la più istruttiva: la difesa che lo STOP aveva progettato (punto 1)
**c'era**, ed era stata implementata in un modo che la annullava. Progettare la
difesa non basta; bisogna provare a scavalcarla.

### 5.5, 5.6 — Trovati dalla BATTERIA

| difetto | come si manifestava |
|---|---|
| `rigaEtichettata` usava `\s*` attorno ai due punti, e `\s` comprende il ritorno a capo | su una riga con l'etichetta e il valore **vuoto** la ricerca scavalcava la riga e prendeva la successiva: un certificato con `Lingue dichiarate:` e niente accanto dichiarava come lingue **le parole della riga sotto**, e il rilievo «nessuna lingua dichiarata» non poteva più scattare |
| `/^(s[iì]\|yes\|presente)\b/i` | `Banner di consenso: sì` si leggeva come **«no»**: in JS senza il flag `u` la parola-confine è definita su `[A-Za-z0-9_]`, quindi dopo la `ì` un confine non c'è |

### 5.7 — Trovato da `grep`, e nessun test poteva vederlo

Un **byte NUL** dentro `servito-lib.mjs`, entrato alla prima scrittura e
committato tre volte. Stava dentro un ripiego morto —
`perChiave.get(a.chiaveDichiarata ?? "\0")` — dove `chiaveDichiarata` non è
popolata da nessuna parte. Tolto il NUL e tolto il ripiego: un ramo che non può
scattare è peggio di un ramo assente, perché chi legge crede che copra un caso.

Se ne è accorto `grep`, dicendo «Binary file matches» su un file di testo.

---

## 6. Le uscite, incollate

### 6.1 — Il gate sul pilota

`fornodoro`, pizzeria «Forno d'Oro», sei pagine pubbliche, cinque gate verdi
sopra, ~38 voci di debito dichiarate. Lanciato **col node di sistema** (20.12.2),
dalla radice del progetto.

```
$ node <skill>/scripts/verify.mjs --url http://127.0.0.1:3621

GATE CONFORMITA': ROSSO (5 falliti, 3 verifiche mancanti, 0 non applicabili su 9 passi)

MANC  certificato di idoneita' firmato
        docs/conformita.md assente: nessun certificato di idoneita'. Launchpad non pubblica senza, e senza questo documento nessuno ha scritto chi guarda cosa (comando `certifica`).
        I passi che misurano il sito girano lo stesso: un gate rosso per il solo contratto mancante avrebbe imparato a tacere sul resto.
FAIL  superficie pubblica camminata (collegamenti + sitemap)
        identita': NON confermata dal build id (vedi sotto) · 5 pagine lette · 0 rimandi o errori non seguiti
        sorgenti: collegamenti da / (5) · sitemap.xml (5)
        superficie: / /chi-siamo /menu /ordina /ordine
          [block] identita' dell'app: il build id su disco (KAjShKT6tg73C5JGZ7M5k) NON compare nell'HTML servito, ma l'asset `/_next/static/chunks/2zknr-jetryid.css` scaricato da http://127.0.0.1:3621 e' identico byte per byte a quello sotto `.next/` di questo progetto.
          Diagnosi: e' QUESTO sito, servito da un processo partito PRIMA dell'ultima build — non un'altra applicazione. Riavvia `npm run start`.
          Le misure di conformita' si fanno lo stesso (il sito e' questo), ma il certificato NON e' emettibile: certificherebbe una build che non e' quella su disco.
FAIL  informativa privacy raggiungibile
        nessun collegamento a un'informativa su 5 pagine
          [block] informativa privacy: nessun collegamento a un'informativa su 5 pagine pubbliche. Il sito raccoglie o puo' raccogliere dati, e chi visita non ha un posto dove leggere chi li tratta e perche'
FAIL  dati raccolti dai moduli pubblici
        2 pagine con moduli · 5 campi letti · 0 righe di base giuridica nel certificato
        3 bloccanti, 0 da guardare
          [block] /ordina → campo "nome": raccoglie un dato personale (autocomplete="name") e nessuna riga del certificato ne dichiara la base giuridica
          [block] /ordina → campo "telefono": raccoglie un dato personale (autocomplete="tel") e nessuna riga del certificato ne dichiara la base giuridica
          [block] /ordina: raccoglie dati personali e non rimanda a nessuna informativa: l'art. 13 chiede l'informazione AL MOMENTO della raccolta, non da qualche altra parte del sito
FAIL  cosa il sito archivia nel browser
        0 cookie · 1 usi di API di archiviazione · 0 origini di terzi · 9 script letti per intero
        archiviazione: localStorage in /ordina
        1 bloccanti, 0 da guardare
          [block] localStorage (/ordina): il codice servito da questa pagina archivia nel browser con localStorage, e il certificato non lo dichiara. L'archiviazione sul terminale di chi visita non e' solo il cookie: la regola guarda cosa si scrive, non come si chiama
OK    accessibilita' dell'HTML servito
        5 pagine lette sull'HTML servito, carico RSC escluso dal conteggio dei tag
        lingua, titoli, alt, main, etichette e nomi accessibili: nessun rilievo
        i CONTRASTI non sono misurati qui: sono di speed-demon, che apre un browser (SKILL.md §Perimetro)
MANC  lingua dichiarata e hreflang
        il certificato non dichiara nessuna lingua: senza, non c'e' niente contro cui confrontare i `lang` misurati, e un `NON APPLICABILE` qui sarebbe una risposta senza domanda
MANC  proprieta' delle voci di conformita'
        docs/conformita.md assente: nessuna tabella di proprieta'. E' la tabella che questa skill esiste per produrre — senza, «lo guarda qualcun altro» resta una frase
FAIL  contratto d'uscita (handoff)
          [block] docs/handoff/<n>-site-doctor.md: handoff assente: chi viene dopo non ha niente da leggere, e launchpad non pubblica senza

Una verifica mancante non e' una verifica superata: il gate resta rosso.

USCITA: 1
```

**I cinque motivi veri, e perché nessuno dei cinque gate esistenti li vede.**

| # | motivo | chi lo vedrebbe oggi |
|---|---|---|
| 1 | **Nessun collegamento a un'informativa privacy** su 5 pagine pubbliche su 5 | nessuno. vetrina-crafter verifica che ogni pagina **dichiarata** risponda e che ogni pagina **servita** sia dichiarata: un'informativa che non esiste non è né dichiarata né servita, quindi non manca a nessuno |
| 2 | **`/ordina` raccoglie `nome` e `telefono`** (prova forte: `autocomplete="name"` e `"tel"`) **senza nessuna base giuridica dichiarata** | nessuno. flow-sentinel prova che il flusso funziona; vetrina-crafter dichiara che il percorso di scrittura esiste; schema-forge controlla le policy. Il *perché legale* non lo guarda nessuno |
| 3 | **`/ordina` raccoglie dati personali e non rimanda a nessuna informativa** — l'art. 13 chiede l'informazione al momento della raccolta | nessuno |
| 4 | **`localStorage` posto dal codice servito da `/ordina` e dichiarato da nessuna parte** (9 script scaricati e letti per intero) | nessuno. Nessun gate della casa scarica i bundle serviti |
| 5 | **Nessun certificato di idoneità**, quindi nessuna tabella di proprietà delle voci | nessuno — ed è il motivo per cui launchpad non ha un ingresso |

Un sesto rilievo, non richiesto dal mandato e trovato per strada: **l'app viva
sulla 3621 era una build indietro rispetto a `.next/` su disco**, e il gate lo ha
detto con la diagnosi giusta.

**Nota di onestà sull'ultimo rilancio.** Alle 14:30 ho rilanciato il gate per
riconfermare l'uscita dopo le correzioni dei guardiani, e l'app del pilota era
**spenta** (un'altra chat la stava ricostruendo, D17). Il gate ha chiuso
`ROSSO (1 falliti, 8 verifiche mancanti)` con `nessuna risposta da
http://127.0.0.1:3621` — cioè ha detto **MANCANTE invece di fingere**, che è la
cosa giusta. L'uscita incollata qui sopra è quella misurata alle 13:5x, con l'app
viva; le correzioni successive non hanno toccato nessuna delle regole che la
producono, e il sabotaggio è stato **rilanciato per intero dopo** di esse (§6.2).

### 6.2 — Il banco e le venticinque classi di sabotaggio

```
(conforme)   VERDE  uscita=0 pass=8 fail=0 manc=0 na=1
A            ROSSO  uscita=1 pass=5 fail=3 manc=0 na=1  →  superficie-pubblica:ROSSO informativa-privacy:ROSSO perimetro:ROSSO
B            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  informativa-privacy:ROSSO perimetro:ROSSO
C            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  informativa-privacy:ROSSO perimetro:ROSSO
D            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  informativa-privacy:ROSSO perimetro:ROSSO
E            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  dati-raccolti:ROSSO perimetro:ROSSO
F            ROSSO  uscita=1 pass=5 fail=3 manc=0 na=1  →  informativa-privacy:ROSSO dati-raccolti:ROSSO perimetro:ROSSO
G            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  archiviazione-client:ROSSO perimetro:ROSSO
H            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  archiviazione-client:ROSSO perimetro:ROSSO
I            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  archiviazione-client:ROSSO perimetro:ROSSO
J            ROSSO  uscita=1 pass=6 fail=1 manc=1 na=1  →  archiviazione-client:MANC perimetro:ROSSO
K            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  accessibilita-servita:ROSSO perimetro:ROSSO
L            ROSSO  uscita=1 pass=6 fail=3 manc=0 na=0  →  accessibilita-servita:ROSSO lingua-e-hreflang:ROSSO perimetro:ROSSO
M            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  accessibilita-servita:ROSSO perimetro:ROSSO
N            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  accessibilita-servita:ROSSO perimetro:ROSSO
O            ROSSO  uscita=1 pass=6 fail=2 manc=0 na=1  →  accessibilita-servita:ROSSO perimetro:ROSSO
P            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  perimetro:ROSSO
Q            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  perimetro:ROSSO
R            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  perimetro:ROSSO
S            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  perimetro:ROSSO
T            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  perimetro:ROSSO
U            ROSSO  uscita=1 pass=7 fail=1 manc=0 na=1  →  contratto-uscita:ROSSO
V            ROSSO  uscita=1 pass=8 fail=1 manc=0 na=0  →  lingua-e-hreflang:ROSSO
W            ROSSO  uscita=1 pass=8 fail=1 manc=0 na=0  →  lingua-e-hreflang:ROSSO
X            ROSSO  uscita=1 pass=5 fail=3 manc=0 na=1  →  superficie-pubblica:ROSSO informativa-privacy:ROSSO perimetro:ROSSO
Y            ROSSO  uscita=1 pass=2 fail=2 manc=5 na=0  →  superficie-pubblica:ROSSO informativa-privacy:MANC dati-raccolti:MANC archiviazione-client:MANC accessibilita-servita:MANC lingua-e-hreflang:MANC perimetro:ROSSO
```

**25 classi su 25 rosse, ognuna sul passo che dichiara di sorvegliare.** Il banco
conforme chiude **VERDE 8/8 + 1 NON APPLICABILE**, uscita `0`. L'elenco delle
classi e il loro significato sono in `references/sabotaggio.md`.

Il banco conforme, per esteso:

```
   PASS   certificato
        lingue dichiarate: it · informativa dichiarata: /privacy · banner: no
        archiviazioni dichiarate: 1 · campi con base giuridica: 2 · voci in tabella: 16
        confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06
   PASS   superficie-pubblica
        identita': build id BANCOsitedoctor001 trovato nell'HTML servito · 3 pagine lette · 0 rimandi o errori non seguiti
        sorgenti: collegamenti da / (3) · sitemap.xml (3)
        superficie: / /contatti /privacy
   PASS   informativa-privacy
        informativa: /privacy (HTTP 200) · collegata da 3 pagine su 3
   PASS   dati-raccolti
        1 pagine con moduli · 2 campi letti · 2 righe di base giuridica nel certificato
        ogni campo che raccoglie un dato personale ha la sua base giuridica dichiarata
   PASS   archiviazione-client
        0 cookie · 3 usi di API di archiviazione · 0 origini di terzi · 1 script letti per intero
        tutto quello che il sito archivia e' dichiarato nel certificato
   PASS   accessibilita-servita
        3 pagine lette sull'HTML servito, carico RSC escluso dal conteggio dei tag
        lingua, titoli, alt, main, etichette e nomi accessibili: nessun rilievo
   N/A    lingua-e-hreflang
        lingue misurate sull'HTML servito di 3 pagine: it · rotte per lingua trovate nella superficie: nessuna · lingue dichiarate nel certificato: it
        NON APPLICABILE: sito monolingua misurato, gli hreflang non si applicano.
   PASS   perimetro
        16 righe in tabella contro 7 passi eseguiti · 1 voci scoperte
        0 bloccanti, 1 da guardare, 0 righe fuori elenco
          [issue] antispam: SCOPERTA: nessuno la guarda. Resta scoperta e visibile — dichiararla e' l'unica cosa che la distingue da una dimenticata
   PASS   contratto-uscita
        docs/handoff/15-site-doctor.md
```

### 6.3 — La batteria

```
$ ~/scoop/apps/nodejs-lts/current/node.exe --test scripts/servito-lib.test.mjs scripts/conformita-lib.test.mjs scripts/verify.test.mjs
ℹ tests 122
ℹ suites 21
ℹ pass 122
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Fra questi: 14 test che cominciano con «falso verde» (uno per ogni modo noto in
cui il gate potrebbe dire di sì senza aver guardato), i tre test dell'epilogo per
ciascuno dei due eseguibili — funzionale, statico e **dalla junction** — e i
cinque test che verificano che **il gate sappia leggere il contratto che il suo
stesso modello insegna a scrivere** (è il difetto n°17 del collaudo avversario di
speed-demon, chiuso alla nascita).

### 6.4 — Il gate della regia

```
$ node scripts/verifica-regia.mjs
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
OK  documento madre e copia di testo
OK  skill vere ed elenchi che le dichiarano
      scripts/installa-skill.ps1: schema-forge, gestionale-crafter, vetrina-crafter, flow-sentinel, speed-demon, launchpad, site-doctor, code-inquisition
      README.md §Installazione: schema-forge, gestionale-crafter, vetrina-crafter, flow-sentinel, speed-demon, launchpad, site-doctor, code-inquisition
      tabella §Natura: schema-forge, site-doctor, gestionale-crafter, vetrina-crafter, speed-demon, flow-sentinel, launchpad dichiarati 🟢 e di questo repo
OK  STATO.md di ogni agente di casa
OK  epiloghi degli script di casa
OK  segnaposto nei documenti di radice
USCITA: 0
```

**VERDE 5/5 prima e dopo.** Prima: misurato all'inizio del pacchetto, con
site-doctor ancora fra le «non pretese in elenco» perché la tabella la dichiarava
🔵. Dopo: con la skill entrata in tutti e tre gli elenchi insieme, che è
esattamente ciò che quel passo pretende.

### 6.5 — I guardiani (`code-maniac scan`)

```
Code Maniac — scan
  [SKIP] Formattazione (Prettier) — non installato
  [ OK ] Lint (ESLint)
  [SKIP] Tipi (tsc) — non configurato
  [WARN] Complessità funzioni — 0 block · 13 issue · 8 warn
  [SKIP] Convenzioni di progetto — non installato
  [SKIP] Architettura (dependency-cruiser) — non installato
  [ OK ] Codice morto (knip)
  [WARN] Duplicati (jscpd)   ← errore di esecuzione col node di sistema, vedi sotto
  [WARN] Regole (semgrep)    ← 3 rilievi
  [WARN] Segreti (gitleaks)  ← 4 leaks sull'INTERO repo, vedi sotto
```

Le tre righe di residuo, guardate una per una:

| strumento | esito grezzo | cosa vuol dire davvero |
|---|---|---|
| **gitleaks** | «4 leaks found», 154 commit | lo scan era del **repo intero**. Puntato solo su `agenti/site-doctor/`: `gitleaks dir agenti/site-doctor` → **`no leaks found`**. I quattro sono storia del repo, non miei — e il numero senza il perimetro non voleva dire niente |
| **semgrep** | 3 rilievi | tutti `detect-non-literal-regexp`, su `rigaEtichettata`, `tagDi`, `elementiDi`. Nessuno sfruttabile oggi (i frammenti interpolati sono stringhe letterali scritte nel file), ma sono funzioni **esportate**. Chiuso con `perRegexp`, che fa l'escape dei metacaratteri. **Semgrep continua a segnalarle**: la sua regola è sintattica e non può vedere l'escape. Il rilievo resta scritto qui invece di essere silenziato |
| **jscpd** | errore `ERR_REQUIRE_ESM` | è il difetto noto della macchina, non del codice: `jscpd` gira solo col Node 24 e va invocato come `node_modules/jscpd/bin/jscpd` (proposta n°10 dello `STATO.md` di vetrina-crafter). Rilanciato così: **1 clone, 8 righe (0,25%)**, ed è l'epilogo a doppio confronto duplicato apposta fra i due eseguibili |
| **complessità** | 13 issue, 8 warn | **0 bloccanti**. Sciolta la peggiore (`findingsAccessibilitaPagina`, ccn 29 → tre funzioni con un nome). Le altre restano come residuo dichiarato: è il precedente di speed-demon, che ha portato un `complexity 19` per tre giorni prima che P.7c lo sciogliesse |

ESLint: **0 errori**, 7 avvisi di complessità. knip: **pulito**.

### 6.6 — Il tribunale

`/code-inquisition agenti/site-doctor/scripts --focus security,reliability --depth 1 --council 3`.
Tre esperti in **isolamento**, con posture avversarie diverse e su due modelli
diversi: *parsing di input ostile* («chi ha scritto il sito vuole far uscire il
gate verde, oppure vuole bloccarlo per sempre»), *affidabilità del verdetto* («il
gate verrà lanciato da uno script di CI che guarda solo il codice d'uscita»),
*superficie di rete* («l'operatore punta il gate su un URL che gli è stato dato
da qualcun altro»). Il terzo è morto una prima volta su un errore d'API ed è
stato rilanciato: è scritto qui perché un esperto che non torna e non viene
sostituito è una corsia d'ispezione **vuota** che il verbale farebbe sembrare
piena.

**33 rilievi in tutto.** E la riga che questa casa scrive da quattro tornate vale
anche qui: **gli strumenti statici erano tutti verdi** — ESLint 0 errori, `knip`
pulito, `gitleaks` pulito sui miei file, `semgrep` coi soli
`detect-non-literal-regexp` — e **non hanno visto nessuno dei 33**.

```
$ npx eslint scripts/*.mjs         ->  0 errori, 13 avvisi di complessità
$ npx knip                         ->  (nessun rilievo)
$ gitleaks dir agenti/site-doctor  ->  no leaks found
$ jscpd scripts --min-lines 8      ->  Found 1 clones   (l'epilogo, duplicato apposta)
$ semgrep --config=auto scripts    ->  4 rilievi, tutti detect-non-literal-regexp
```

**Il più grave, e perché vale da solo il tribunale.** `SD-VERDE-01`: il
ripulitore toglieva i commenti con una regexp, ma **in HTML un `<!--` dentro il
valore di un attributo è testo**, non l'apertura di un commento. Bastava un
`<div data-nota="<!--">` all'inizio di una regione e un `<div data-nota="-->">`
alla fine per far sparire dal documento che il gate giudica **tutto quello che
stava in mezzo**: immagini senza `alt`, campi che raccolgono dati personali,
terzi non dichiarati, collegamenti. Il browser rendeva tutto; il gate non vedeva
niente e firmava. **Non era un passo aggirabile: erano tutti e nove**, con due
`<div>` invisibili — e la chiave la teneva in mano chi scrive il sito da
certificare.

Chiuso con un ripulitore a **una scansione** che conosce quattro stati (testo ·
tag · valore quotato · commento) e riconosce le forme brusche `<!-->` e `<!--->`
che lo standard chiude subito. Effetto secondario misurato: la vecchia catena di
`replace` era anche **quadratica** — 200 KB di `<` ripetuti costavano **24,6 s**,
adesso **16 ms** — cioè esisteva anche un modo per **appendere** il gate senza
mai fargli dire ROSSO.

#### I rilievi per gravità, con la sorte di ciascuno

| # | rilievo | gravità | sorte |
|---|---|---|---|
| SD-VERDE-01 | `<!--` in un attributo cancella elementi veri da **tutti** i passi | Critical | **chiuso** — ripulitore a scansione singola, 2 test |
| SD-01 | gli **script inline** non venivano mai letti: un sito che archivia da uno script scritto in pagina chiudeva `NON APPLICABILE` | Critical | **chiuso** — i corpi inline si leggono, escluso il carico RSC |
| SD-REDOS-01 | ripulitore quadratico: gate appeso senza mai un rosso | High | **chiuso** dallo stesso ripulitore, con un test sul tempo |
| SD-02 | `if (!ctx.pagine)` non ferma una superficie **vuota** (`![]` è `false`): tre passi verdi su zero pagine | High | **chiuso** — `superficieUsabile` più un `block` esplicito |
| SD-03 · SD-ROSSO-01(3) | la **radice che rimanda** (multilingua, www, barra finale) svuotava il grafo dei collegamenti | High | **chiuso** — il rimando della sola radice si segue, la camminata parte da lì |
| SD-04 | nessun `try`/`catch` in `main()`: un crash usciva **1 con stdout vuoto** mentre il contratto promette **2** | High | **chiuso** — `catch`, passi non eseguiti a `skipped`, uscita 2 col riepilogo |
| SD-05 | il confronto §19 per voce si disattivava lasciando la cella `esito` **vuota** | High | **chiuso** — esito vuoto = `block`, e gli esiti ammessi sono un elenco chiuso |
| SD-06 | una **superficie dichiarata vuota** disattivava in silenzio il confronto: chi dichiarava rischiava rilievi, chi taceva era verde | High | **chiuso** — `block`, distinguendo sezione assente da tabella vuota |
| SD-VERDE-03 | un terzo entra anche da `@import`, `<video>`, `<source>`, `srcset` | High | **chiuso** — dieci elementi più gli `url()` degli stili |
| SD-VERDE-03(4) | la sitemap **assente** non costava niente: il primo testimone poteva mentire da solo purché il secondo sparisse | High | **chiuso** — `block` quando anche la camminata non ha camminato |
| SD-VERDE-04 | solo il candidato **più collegato** veniva scaricato: un'esca nascosta rendeva verde un sito il cui collegamento visibile è un 404 | High | **chiuso** — si scaricano **tutti**, i nascosti non sono candidati, il testo pesa più del percorso |
| SD-PATH-01 | la colonna «dove è dichiarato» leggeva **qualunque file della macchina** | Medium | **chiuso** — `leggiDentroIlProgetto`, contenimento sotto la radice |
| SD-07 | uno stato scritto male spariva dal conteggio e il gate usciva **verde** | Medium | **chiuso** — `ignoti` lo conta e lo blocca |
| SD-08 | `--url --json` faceva diventare `--json` l'indirizzo; nessuna validazione | Medium | **chiuso** — validazione, forma `--url=`, argomenti sconosciuti rifiutati |
| SD-10 | `informativaRaggiungibile ?? new Set()`: un intoppo di rete produceva il bloccante più grave del gate su un sito corretto | Medium | **chiuso** — tre stati distinti, `null` diventa `skipped` |
| SD-12 | i `Set-Cookie` sulle risposte **3xx** venivano buttati insieme alla risposta | Medium | **chiuso** — i cookie si raccolgono nella camminata, rimandi compresi |
| SD-VERDE-05 | un campo `hidden` con `autocomplete="email"` spariva prima della classificazione | Medium | **chiuso** — i campi di servizio si scartano per **nome**, non per tipo |
| SD-VERDE-06 | `aria-labelledby` verso un id inesistente e `<label for>` vuota valevano come nome accessibile | Medium | **chiuso** — l'id si risolve, l'etichetta vuota non conta |
| SD-ROSSO-01(1,2) | `<label>` avvolgente e icona SVG con `aria-label`: **bloccanti su markup corretto** | Medium | **chiuso** — entrambi riconosciuti |
| SD-ROSSO-02 | `/prodotti/cookie-al-cioccolato` veniva eletto informativa (sottostringa) | Medium | **chiuso** — sul percorso si pretende un **segmento intero** |
| SD-NET-01 | i caratteri di controllo del testo **scaricato** arrivavano al terminale, e qui l'uscita del gate si **incolla nei verbali** | Medium | **chiuso** — `perStampa` filtra per punto di codice |
| SD-09 | il documento `--json` non diceva **quale indirizzo** era stato certificato | Medium | **chiuso** — `url`, `buildId`, `maxPagine` nel documento |
| SD-NET-05 | il banco sovrascriveva `docs/conformita.md` di un progetto vero se lanciato con `--dir .` | Low | **chiuso** — cartella vuota o marcatore, altrimenti si rifiuta |
| SD-13 | il verdetto era la **prima** riga, non l'ultima | Low | **chiuso** — si ristampa in fondo |
| SD-15 | i percorsi dichiarati non erano normalizzati: una barra finale produceva due rilievi opposti sulla stessa pagina | Low | **chiuso** — passano da `percorsoInterno` |
| semgrep ×4 | `detect-non-literal-regexp` | — | **chiuso nella sostanza** con `perRegexp` (escape dei metacaratteri). Semgrep continua a segnalarlo: la sua regola è **sintattica** e non può vedere l'escape. Scritto qui invece che silenziato |
| SD-MEM-01 · SD-NET-04 | nessun tetto sul corpo scaricato né sul numero di bundle | High · Low | **APERTO** — `STATO.md` punto n°9. Il timeout per richiesta limita il tempo, non i byte |
| SD-11 | nessuna **scadenza complessiva**: 60 pagine per 30,5 s è mezz'ora senza verdetto | Medium | **APERTO** — `STATO.md` punto n°10 |
| SD-NET-02 | un `<script src>` della stessa origine che **rimanda** a un altro host viene scaricato e attribuito al sito | Low | **APERTO** — `STATO.md` punto n°11 |
| SD-PROTO-01 | nessun inquinamento del prototipo possibile oggi (i valori sono sempre stringhe), ma due trappole latenti e le intestazioni duplicate che si sovrascrivono | Low | **APERTO**, con la misura accanto che dice perché non urge |
| SD-URL-01 | senza `--url`, l'indirizzo lo sceglie **il documento sotto esame** | Low | **APERTO** — il ripiego resta, va marcato con un `issue` visibile |
| SD-NET-03 | `--url` non ha restrizioni di destinazione (ricognizione verso reti interne) | Low | **accettato e dichiarato**: è la funzione dello strumento, e un divieto romperebbe i banchi su `127.0.0.1` |
| SD-14 | la ricaduta del `catch` su `realpathSync` torna al confronto testuale, che dalla junction è quello noto come insufficiente | Low | **non corretto qui, e per una ragione**: quella forma è **prescritta dalla regia** (`hint` della regola `epiloghi-vivi`, P.0-igiene-2) e vale per **otto** script della casa. Cambiarla in uno solo li farebbe divergere, e il gate della regia guarda la forma → proposta alla regia |

**Ventisei chiusi con un test, cinque aperti e scritti, uno accettato, uno
rimandato alla regia.** La batteria è passata da **122 a 144**.

**La cosa che il tribunale insegna, e non è nell'elenco.** Lo STOP di metà
pacchetto (§4) aveva **progettato** la difesa di due di questi difetti — le due
sorgenti indipendenti, e il ripulitore che toglie il carico RSC. Erano
implementate. Il tribunale ha trovato che **erano implementate in un modo che le
annullava**: la sitemap alimentava i collegamenti, e il ripulitore cancellava i
tag che un altro passo doveva leggere.

> Progettare la difesa non basta, e nemmeno scriverla. Bisogna provare a
> scavalcarla.

---

## 7. Cosa lascia al collaudo avversario (P2)

### 7.1 — Le mie classi cieche, dichiarate

Dove questo gate è cieco **per costruzione**. Non sono difetti da trovare: sono
il perimetro di ciò che un programma senza browser può dire.

1. **I contrasti di colore.** Delegati a speed-demon, che apre un browser.
2. **Un cookie posto dopo un'azione** — l'invio di un modulo, l'accesso, il
   consenso stesso. Si legge un anonimo che non fa nulla.
3. **Un modulo costruito nel browser** dopo il caricamento: nell'HTML servito non
   c'è, e se il sito non ne ha altri il passo chiude `NON APPLICABILE` con una
   premessa vera e una conclusione sbagliata.
4. **Codice caricato dinamicamente** e non referenziato nell'HTML.
5. **Una pagina che nessuno linka e che non è nella `sitemap.xml`.** Sul pilota è
   il caso di `/ordine/<codice>`.
6. **Che l'informativa dica il vero.** Si prova che nomina le sette voci
   dell'art. 13; che siano quelle giuste lo firma chi risponde.
7. **Che il file citato da un vicino dica «fatto»** invece di «da fare».
8. **Che la firma sia vera.**
9. **L'offuscamento**: `window["local"+"Storage"]` sfugge a una ricerca di
   sottostringa. È un indizio, non una misura, e va letto così.

### 7.2 — Le domande che lascio a chi collauda

Le scriverei io per prime, e chi collauda non deve fidarsi di questo elenco:

- **Il ripulitore nuovo è il pezzo più delicato e ha un giorno di vita.** Le
  forme che **non** ho provato: `<![CDATA[`, `<!DOCTYPE` con parentesi quadre,
  attributi senza virgolette che contengono `>`, un `<script>` nominato dentro un
  commento, `</script >` con lo spazio, `<svg>` con XML annidato. Ognuna può
  riaprire la chiave universale.
- **Le premesse di `NON APPLICABILE`.** Ne esistono tre. Ho reso indipendente
  quella della lingua; **le altre due non le ho riattaccate a niente**: «zero
  moduli» e «zero archiviazioni» sono misure fatte sullo stesso documento che
  potrebbe essere stato amputato. Se il ripulitore ha ancora un buco, quei due
  `n/a` mentono — ed è la forma più elegante di falso verde che questo gate
  abbia.
- **Il `perimetro` come superficie d'attacco.** Legge un documento e legge file
  del progetto. Ho chiuso l'uscita dalla radice; restano i **link simbolici**, e
  `realpathSync` lì non lo chiamo.
- **La classe di sabotaggio che manca.** Le 25 classi sono nate dalla mia idea di
  cosa può andare storto, e il tribunale ha trovato dieci cose che **nessuna**
  classe copriva. Si parta da lì: *quali classi non ho immaginato?*
- **Il pilota con l'app viva e la build allineata.** La mia misura è stata presa
  con l'app servita **una build indietro**: un giro con `identita: pass` sul
  pilota non l'ho mai visto.
- **`certifica` e `handoff` non sono mai stati eseguiti** su un progetto vero
  (pilota in sola lettura, D17). Sul banco quei documenti li genera il banco:
  sono provati come **input** del gate, non come **prodotto** del comando.

### 7.3 — E la cosa da dire per prima

Questa è la prima skill della casa **nata senza la revisione del direttore fra
progettazione e costruzione** (D17). Lo STOP di metà pacchetto ha sostituito
quella revisione con un'autorevisione, e l'autorevisione ha trovato otto punti —
tutti veri, e uno (la circolarità della premessa degli hreflang) che nessuna
lettura successiva avrebbe più visto, perché sarebbe diventato codice.

Ma **il sabotaggio ne ha trovati tre che l'autorevisione non aveva visto, e il
tribunale trentatré.** Il rapporto fra questi tre numeri è il costo dell'unione
di P0 e P1, misurato invece che temuto: *un'autorevisione trova ciò che chi ha
scritto sa già di dover cercare.*

---

`P.6 (P0+P1) consegnata. Il gate di site-doctor esce ROSSO sul pilota per 5
motivi veri che nessuno dei cinque gate esistenti vede: nessuna informativa
privacy raggiungibile su 5 pagine pubbliche su 5; nome e telefono raccolti da
/ordina senza nessuna base giuridica dichiarata (prova forte, autocomplete);
dati personali raccolti senza rimando all'informativa al punto di raccolta;
localStorage posto dal codice servito e dichiarato da nessuna parte; nessun
certificato di idoneità, quindi nessuna tabella di proprietà delle voci.
Sabotaggio: 25 classi, tutte rosse. Batteria 144/144. Gate della regia
VERDE 5/5.`

E la verità che va accanto, perché quella riga da sola direbbe meno di quello che
è successo: **il tribunale ha trovato 33 rilievi su un gate che tutti gli
strumenti statici dichiaravano pulito, e uno di essi — un `<!--` dentro un
attributo — apriva contemporaneamente tutti e nove i passi.** Ventisei sono
chiusi con un test, cinque restano aperti e scritti, e il collaudo avversario
indipendente non è stato fatto: questa skill ne ha più bisogno delle altre.
