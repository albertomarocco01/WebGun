# La verifica deterministica — i nove passi, i quattro stati, il contratto `--json`

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

## I nove passi

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

### 8. `perimetro`

**Premessa**: la sezione delle voci esiste.
**Prova**: `references/perimetro.md`.
Sta **dopo** i passi che misurano, perché confronta l'esito **dichiarato** delle
voci mie con lo stato dei passi di **questa** esecuzione. È la §19 applicata
voce per voce.

### 9. `contratto-uscita`

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
  "summary": { "passi": 9, "pass": 1, "fail": 5, "skipped": 3, "na": 0 },
  "steps": [ { "id": "certificato", "name": "…", "status": "skipped", "detail": "…" } ]
}
```

Le chiavi restano in inglese come nelle altre skill (§15): il formato di scambio
è nato così, e mescolare le due lingue nello stesso oggetto è peggio di entrambe.
`status` vale `pass` · `fail` · `skipped` · `n/a`.

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
| **`robots.txt` e `sitemap.xml` come voci misurate** | sono di speed-demon (`CANTIERE.md`, riga P.6: *«non si rimisurano»*). La `sitemap.xml` qui si **legge** come seconda sorgente della superficie, che è un'altra cosa dal verificarla |

## Le trappole di piattaforma già pagate

- **Il carico RSC** è HTML dentro `<script>`: vedi sopra.
- **`getSetCookie()`** esiste su Node 20+, ma il codice tiene la ricaduta su
  `headers.get("set-cookie")`: un solo cookie con una virgola dentro va letto
  come uno, non come due.
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
