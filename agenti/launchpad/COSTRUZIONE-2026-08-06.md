# Costruzione di Launchpad — P.5 (P0 + P1), 2026-08-06

> Progettazione **e** costruzione in un solo pacchetto, per decisione del
> committente sui tempi. Il prezzo dichiarato dal mandato: *un errore di
> progettazione non incontra un revisore prima di diventare codice.* I due
> contrappesi previsti — il gate scritto prima del flusso, e la sosta di metà
> pacchetto — sono stati eseguiti entrambi, e §4 dice cosa hanno prodotto.
>
> **Nessun deploy è stato eseguito.** Non un account, non un repository
> collegato, non un dominio, non un record DNS, non un centesimo. §7 elenca
> tutto ciò che di conseguenza resta non provato.

---

## 1. Le scelte autonome

| Scelta | Alternativa scartata | Perché |
|---|---|---|
| **Il gate non rilancia i gate a monte: legge il verdetto e ne misura la freschezza** | rilanciare i cinque gate da dentro `verify.mjs` | tre motivi misurati in `references/verifica-deterministica.md` §6. Il più forte: rilanciarli richiede stack Supabase, app viva, Chrome, Lighthouse e il Node giusto **nel `PATH`** — un gate che dipende da cinque ambienti esterni è rosso per motivi suoi, e un rosso che si impara a ignorare non è più un controllo. In cambio, la tabella §2 dichiara riga per riga dove il gate misura e dove legge |
| **L'impronta si DERIVA dal commit** (`generateBuildId`), non si registra | copiare il confronto di speed-demon (`.next/BUILD_ID` contro l'HTML servito) | il provider **ricostruisce dal sorgente**: il `BUILD_ID` che ne esce è un altro. Il confronto copiato avrebbe prodotto un **rifiuto indebito su ogni deploy corretto** — il difetto peggiore di un gate, perché insegna a scavalcarlo |
| **Nove passi**, e `--url` senza default | meno passi, o un `localhost:3000` di comodo | ogni passo costa una lettura di file o una `fetch`. E il prezzo di indovinare un indirizzo l'ha già pagato flow-sentinel il 2026-07-30, su questa macchina, misurando il sito di un'altra azienda |
| **L'eccezione dichiarata nel file** (`launchpad-consentito:`) | declassare la famiglia per tutti, o una configurazione della skill | precedente della §10. Il pilota ha **dimostrato** che senza questo il gate ha un rosso strutturale su un progetto corretto (§5.3), e un rosso strutturale è la cosa che la §19 vieta. Le prime due strade spengono il controllo anche per chi non ha autorizzato niente |
| **Le famiglie che aprono un sistema vero non sono derogabili** | rendere derogabili tutte le sei | `service-role`, `token-provider`, un `.env` tracciato: lì non esiste il caso legittimo, e un'eccezione sarebbe solo il modo di scriversi il permesso da soli |
| **Quello che il controllo trova non lo stampa** — famiglia, file, riga, quattro caratteri | stampare il rilievo per intero, per comodità di chi corregge | un gate che ricopia il segreto nel proprio log lo ha **pubblicato una seconda volta**, in un posto che finisce nella CI, nei transcript e negli appunti di chi passava |
| **Il controllo guarda anche i file NON ancora tracciati** | fermarsi a `git ls-files` | trovato dal sabotaggio: quattro classi su sette lo scavalcavano scrivendo un file **nuovo**. Il passo diceva «140 file letti · nessun rilievo» sopra una chiave `service_role` sul disco, e il gesto successivo di chiunque è `git add -A` |
| **La storia si legge raggruppata per FILE**, non per commit | un blocco per commit | senza, la famiglia `credenziale-sql` (che vale sui soli `.sql`) era **cieca** nella storia: una password committata in un seed e tolta il giorno dopo non la vedeva nessuno |
| **`git-lib.mjs`**: un solo posto che parla con git | tenere le copie nei tre gusci | rilievo di `jscpd` (44 righe clonate). **Due copie divergono**, e in questa casa è già successo (§7 di `DECISIONI.md`); una delle due copie di `leggiStoria` era già rimasta indietro di una correzione |
| **Il banco vive nello scratchpad**, non nella regia | un `banco-prova-launchpad/` accanto agli altri | la §25 chiede che un banco si tenga solo se un clone pulito lo sa rilanciare. Questo si **ricostruisce da uno script** (`banco.mjs`), che è meglio di tracciarlo: non invecchia |
| **`pubblica` esiste come procedura e non è mai stato eseguito** | non definirlo affatto | senza, la skill non avrebbe la sua azione centrale. Dichiarato qui, in `STATO.md` e nella nota del README |

---

## 2. Le condizioni di pubblicazione — **misura o legge?**

La tabella più importante di questo documento, e il motivo per cui il mandato
la chiedeva: è la differenza fra un certificato e una promessa.

| # | condizione | il gate la **misura** | il gate la **legge** | cosa resta indimostrato |
|---|---|---|---|---|
| 1 | si pubblica **un commit**, non un working tree | albero pulito, HEAD, scarto col remoto | — | che l'albero sia ancora pulito **al momento del deploy** |
| 2 | nessun gate a monte ha detto di no | **la freschezza**: ogni handoff è più giovane dell'ultimo commit di codice; e il contratto sul disco è la prova misurata che un agente doveva passare | il verdetto `Gate: VERDE` | **che quel verde fosse vero.** È la riga da leggere due volte |
| 3 | ogni bloccante dichiarato ha una risposta | quali voci il runbook nomina, e se la risposta è leggibile | il registro del debito | che le voci siano tutte quelle vere: un bloccante che nessuno ha scritto non esiste per questo passo |
| 4 | nessun segreto nel pacchetto | ogni file tracciato, i nuovi, gli ignorati, **e la storia**, per sei famiglie | — | i segreti in forme che le sei famiglie non coprono (`references/segreti.md` §4, sette voci) |
| 5 | le variabili sono dichiarate e non committate | le variabili che il codice **spedito** legge davvero, in tre forme di lettura; nessun indirizzo locale come valore di produzione | quali radici finiscono nel pacchetto | che i valori dichiarati siano **giusti**: il gate sa che non è `127.0.0.1`, non sa se è il dominio del cliente |
| 6 | la build si rifà uguale altrove | `engines.node` contro **ogni dipendenza installata**; lockfile presente e tracciato | il runtime impostato sul pannello | che il provider **rispetti** `engines`: nessuno lo impone senza `engine-strict` |
| 7 | ciò che va online resta dimostrabile | che l'impronta sia derivata dal commit e non un letterale; che l'artefatto e l'app servita la portino | il commit approvato nel runbook | che il provider costruisca **dallo stesso commit** |
| 8 | un umano ha firmato **il contenuto** | esistenza, assenza di segnaposto, firma non-agente, **data ≥ artefatto**, sei sezioni obbligatorie | la procedura e il rollback | **che la procedura funzioni.** Nessuno l'ha eseguita |
| 9 | ciò che ho fatto resta scritto | la riga `Gate:` contro il verdetto di questa esecuzione | — | che i residui elencati siano quelli giusti (§19) |

**Cinque passi su nove sono misure piene. Tre misurano la forma di una
dichiarazione altrui. Uno — `catena-gate` — legge e data.**

E il pilota ha offerto la prova che questa distinzione non è teorica: **due
delle stesse verità escono una volta come promessa e una volta come misura**
(§5.4).

---

## 3. I passi scelti, e i quattro scartati

**Scelti** (l'ordine è il gate): `radice-pulita` · `catena-gate` ·
`debito-bloccante` · `segreti` · `ambiente` · `runtime-riproducibile` ·
`impronta-artefatto` · `runbook-firmato` · `contratto-uscita`.

**Scartati**, col perché — per esteso in `references/verifica-deterministica.md` §6:

| passo scartato | perché |
|---|---|
| **rilanciare i gate a monte** | costo e fragilità (cinque ambienti esterni); duplicazione di una verità che la §19 ha già collocato altrove; e non è il mio mestiere — se la batteria di flow-sentinel è falsa, rilanciarla da qui darebbe lo stesso verde |
| **un passo «sicurezza» generale** | è cyber-shield, che non esiste. Un agente che copre il buco di un altro produce due skill che un giorno divergeranno, e la divergenza si scopre come falso verde |
| **un passo «DNS e certificato»** | non misurabile prima del deploy, e dopo lo misura `verifica-pubblicato`. Nel gate pre-volo sarebbe MANCANTE per sempre: un rosso strutturale |
| **un passo che verifica il `.gitignore`** | ridondante: `segreti` guarda **cosa è tracciato**, che è la conseguenza del `.gitignore` e non la sua causa |

---

## 4. La domanda di metà pacchetto

> *Quale passo del mio gate potrebbe essere verde su un deploy che non si deve
> fare?*

Eseguita passo per passo, **prima di scrivere una riga di codice**. Sei
risposte, tutte diventate regole.

| # | passo | il verde falso | cosa è cambiato |
|---|---|---|---|
| 1 | `radice-pulita` | albero pulito, **HEAD avanti di tre commit sul remoto**: il provider costruisce dal remoto e pubblica un commit più vecchio di quello misurato, con tutti gli altri passi verdi perché hanno guardato il disco | confronto con `@{upstream}` |
| 2 | `catena-gate` | un agente **non è mai passato**: non lascia un `Gate: ROSSO` da leggere, lascia **silenzio**, e il silenzio era verde | il contratto sul disco è la prova misurata che doveva passare |
| 3 | `debito-bloccante` | qualcuno **cancella la riga** che blocca | i riferimenti orfani: un handoff che cita `n°32` mentre il registro non ce l'ha più |
| 4 | `ambiente` | `process.env["X"]` non contato; una `NEXT_PUBLIC_*` impostata solo a runtime, con `sitemap.xml` rotto per sempre | tre forme di lettura, e `NEXT_PUBLIC_*` da dichiarare **prima della build** |
| 5 | `runtime-riproducibile` | `engines` dichiarato e **imposto da nessuno** | il runbook dichiara `Runtime del provider:` e il gate lo **confronta** |
| 6 | `impronta-artefatto` | **era un difetto mio, già scritto.** `process.env.WEBGUN_COMMIT ?? "<sha corto>"`: un **letterale**, che al commit successivo dichiarerebbe con sicurezza il commit **sbagliato** — peggio dell'impronta casuale, che almeno ammette di non sapere | la funzione risolve da quattro fonti e **solleva**; un letterale in `generateBuildId` è ora un `block` |

**Due osservazioni.** La prima: cinque risposte su sei non erano falsi verdi del
*codice* — erano falsi verdi della *progettazione*, cose che il gate non avrebbe
mai guardato perché nessuno gli aveva detto di guardarle. Un collaudo del codice
non le avrebbe trovate.

La seconda: la sesta è di un'altra specie. Non era un buco, era **una riga
sbagliata scritta con sicurezza** — il fatto («l'impronta deve derivare dal
commit») era giusto, la conclusione («allora scrivo il commit nel file») era
sbagliata, e sembravano la stessa cosa. È la classe di errore che il verbale di
catena di P.4 ha misurato quattro volte su cinque anelli: *cause attribuite male
a fatti giusti.*

---

## 5. Le uscite, incollate

### 5.1 Il gate sul pilota — **ROSSO**

Il pilota `fornodoro` è un sito completo con cinque gate verdi, e **non si deve
pubblicare**. Due esecuzioni, perché **P.4g stava lavorando in parallelo** sullo
stesso repo e lo stato è cambiato sotto la misura. Le riporto entrambe, con il
commit.

**(a) commit `e34ff13`, app di produzione viva sulla 3621** — 5 falliti, 2 mancanti:

```
FAIL  verdetti dichiarati dagli agenti a monte
        [block] docs/handoff/08-vetrina-crafter.md: piu' vecchio del codice che certifica
        [block] docs/handoff/10-gestionale-crafter.md: piu' vecchio del codice che certifica
        [block] docs/handoff/12-flow-sentinel.md: piu' vecchio del codice che certifica
        [block] docs/handoff/13-speed-demon.md: piu' vecchio del codice che certifica
FAIL  bloccanti dichiarati nel registro del debito
        43 voci lette · 3 dichiarano di bloccare il deploy: n°4 · n°12 · n°17
FAIL  nessun segreto nel pacchetto che parte
        [block] supabase/seed/90-solo-sviluppo.sql:87 · :92  credenziale cablata in un seed
FAIL  l'impronta dell'artefatto e' derivata dal commit
        [block] next.config.ts → generateBuildId: non dichiarato: l'impronta e' casuale
        [block] .next/BUILD_ID: l'artefatto sul disco porta `r1Z4WCJ4xQmKLXxy9aB5S`,
                il commit di HEAD e' `e34ff134274b`
        [block] http://127.0.0.1:3621: non porta l'impronta attesa `e34ff134274b`
MANC  variabili d'ambiente · MANC runbook firmato · FAIL contratto d'uscita
```

**(b) commit `0808163`, app spenta da P.4g** — 4 falliti, 3 mancanti. L'albero è
tornato pulito (`radice-pulita` OK) e il passo dell'impronta è diventato
**MANCANTE invece di FAIL**, dichiarando di non aver potuto esercitare il
meccanismo:

```
GATE LAUNCHPAD: ROSSO (4 falliti, 3 verifiche mancanti su 9 passi)

MANC  l'impronta dell'artefatto e' derivata dal commit
        nessuna risposta utile da http://127.0.0.1:3621: il meccanismo che verra'
        usato DOPO il deploy non e' stato esercitato
        [block] next.config.ts → generateBuildId: non dichiarato: l'impronta e' casuale
        [block] .next/BUILD_ID: l'artefatto sul disco porta `kdbOe9O-KCZs6KOPuJw_3`,
                il commit di HEAD e' `0808163f90a0`

Una verifica mancante non e' una verifica superata: il gate resta rosso.
Non si pubblica. Ogni motivo dice di chi e': quasi nessuno e' di launchpad.
```

**I motivi, e chi li ha trovati.** Il mandato chiedeva che fossero n°4, n°17,
n°27 e n°32 e che li trovasse il gate, non io. Al primo lancio (prima che P.4g
chiudesse due voci) il passo `debito-bloccante` ne ha nominati **cinque**:

```
43 voci lette · 5 dichiarano di bloccare il deploy: n°4 · n°32 · n°12 · n°17 · n°27
```

**Il n°12 non era nell'elenco che il mandato mi aveva dato** — la difesa CSRF
delle server action che si fida di `X-Forwarded-Host`. L'ha trovato lui leggendo
il registro.

E un motivo **nessuno lo aveva dichiarato**: `impronta-artefatto`. Il pilota non
ha `generateBuildId`, quindi dopo una ricostruzione del provider nessuno potrebbe
più dimostrare cosa c'è online. È il contributo del gate al debito del pilota,
non una voce copiata.

### 5.2 Il gemello pulito — **VERDE 9/9**

Un progetto costruito apposta (`scratchpad/banco-launchpad`, ricostruibile con
`banco.mjs`) che fa **tutto giusto**: albero pulito e allineato al remoto,
cinque handoff verdi e freschi, un bloccante risposto nel runbook, nessun
segreto, `engines` coerente, impronta derivata dal commit, runbook firmato.

```
GATE LAUNCHPAD: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)
```

Serve a una cosa che conta più del rosso: **zero falsi positivi**. Un gate che
è rosso su tutto non ha dimostrato niente.

### 5.3 Sabotaggio — **36 classi, 36 rosse, 0 non prese**

Un difetto per classe, piantato sul gemello pulito, col ripristino verificato
dopo ognuno (un banco che resta sporco fa sembrare rosse le classi successive
per il motivo sbagliato).

| # | passo che deve diventare rosso | difetto piantato | esito |
|---|---|---|---|
| S1 | `segreti` | chiave `service_role` in un file tracciato | **rosso** |
| S2 | `segreti` | chiave Supabase di formato nuovo (`sb_secret_`) | **rosso** |
| S3 | `segreti` | password in chiaro in un seed SQL | **rosso** |
| S4 | `segreti` | un `.env` **tracciato** (qualunque cosa contenga) | **rosso** |
| S5 | `segreti` | valore vero dentro un `.env.example` | **rosso** |
| S6 | `segreti` | segreto **solo nella storia** (aggiunto e poi tolto) | **rosso** |
| S7 | `segreti` | password dentro l'autorità di un URL remoto | **rosso** |
| C1 | `catena-gate` | un agente a monte dichiara `Gate: ROSSO` | **rosso** |
| C2 | `catena-gate` | handoff cancellato col contratto sul disco (il **silenzio**) | **rosso** |
| C3 | `catena-gate` | il codice cambia **dopo** l'handoff (certificato scaduto) | **rosso** |
| C4 | `catena-gate` | un handoff senza riga `Gate:` (prosa invece di certificato) | **rosso** |
| D1 | `debito-bloccante` | un bloccante dichiarato e non risposto nel runbook | **rosso** |
| D2 | `debito-bloccante` | nominato nel runbook ma senza risposta leggibile | **rosso** |
| D3 | `debito-bloccante` | riferimento orfano (dichiarato `issue`: **compare**, non blocca) | **preso** |
| R1 | `runtime-riproducibile` | `engines.node` tolto | **rosso** |
| R2 | `runtime-riproducibile` | `engines` più basso di quanto una dipendenza pretende | **rosso** |
| R3 | `runtime-riproducibile` | il runbook dichiara un runtime più basso del necessario | **rosso** |
| R4 | `runtime-riproducibile` | lockfile sul disco e **non tracciato** | **rosso** |
| R5 | `runtime-riproducibile` | il runbook non dichiara il runtime del provider | **rosso** |
| I1 | `impronta-artefatto` | `generateBuildId` tolto: l'impronta torna casuale | **rosso** |
| I2 | `impronta-artefatto` | **SHA scritto come letterale** (il difetto che avrei spedito) | **rosso** |
| I3 | `impronta-artefatto` | l'indirizzo serve un'**altra** build | **rosso** |
| I4 | `impronta-artefatto` | l'artefatto sul disco è di un altro commit | **rosso** |
| F1 | `runbook-firmato` | firma tolta | **rosso** |
| F2 | `runbook-firmato` | firma dell'**agente** su un'azione irreversibile (§6) | **rosso** |
| F3 | `runbook-firmato` | sezione «Cosa diventa pubblico» tolta: si firma un comando | **rosso** |
| F4 | `runbook-firmato` | rollback senza `Versione precedente:` | **rosso** |
| F5 | `runbook-firmato` | segnaposto del template rimasto dentro | **rosso** |
| A1 | `ambiente` | variabile letta dal codice spedito e non dichiarata | **rosso** |
| A2 | `ambiente` | `NEXT_PUBLIC_*` impostata solo a runtime | **rosso** |
| A3 | `ambiente` | indirizzo locale come valore di produzione | **rosso** |
| A4 | `ambiente` | variabile letta con le **parentesi quadre** (la forma che sfugge) | **rosso** |
| P1 | `radice-pulita` | working tree sporco | **rosso** |
| P2 | `radice-pulita` | HEAD avanti rispetto al remoto | **rosso** |
| U1 | `contratto-uscita` | handoff che dichiara VERDE mentre il gate è rosso | **rosso** |
| U2 | `contratto-uscita` | handoff di launchpad cancellato | **rosso** |

```
36 classi · 36 rosse · 0 NON prese
```

**Al primo giro ne restavano sette non prese, e sono la parte utile di questo
paragrafo.** Cinque avevano la stessa causa:

> il gate guardava solo `git ls-files`, e **un file nuovo era invisibile**.

Quattro sabotaggi lo scavalcavano semplicemente scrivendo un file nuovo — una
chiave `service_role` in `src/lib/admin.ts`, un valore vero in un `.env.example`
appena creato, due variabili non dichiarate. Il passo stampava «140 file letti ·
nessun rilievo» sopra una chiave che era sul disco.

Le altre due erano difetti di forma, entrambi **auto-inflitti**: il gate
pretendeva nel runbook le tre variabili che il frammento `generateBuildId` —
scritto dalla skill stessa — legge; e cercava il corpo di `generateBuildId` in
una finestra **dopo** la chiave, mentre la forma che il frammento produce
definisce la funzione **prima**, così accusava di «non sollevare» un frammento
che solleva.

E una lezione sul banco e non sul gate: due classi erano uscite «non prese» solo
perché git aveva riscritto i file in **CRLF** e la stringa cercata conteneva
`\n`. Un sabotaggio che non si applica assomiglia in tutto a un passo che non
vede. Ora `modifica()` solleva se non ha sostituito niente.

### 5.4 Prima e dopo P.4g — la prova che il gate misura

Il mandato chiedeva che, chiuse le voci a monte, il gate passasse da rosso a
verde **per la correzione e non per una mia modifica**. Misurato sui due soli
motivi che il gate stabilisce **da solo**, leggendo il contenuto committato con
`git show` (sul pilota non si scrive):

```
albero installato: 317 dipendenze dichiarano un engines.node
la piu' esigente: @supabase/auth-js >=22.0.0 (minimo 22)

=== n°32 — il runtime della build ===
PRIMA (d604718): engines.node = ASSENTE   → 1 bloccanti
    [block] package.json → engines.node: il progetto non dichiara il runtime
DOPO  (HEAD):    engines.node = >=22.0.0  → 0 bloccanti

=== n°27 — le credenziali nel seed ===
PRIMA (d604718): 1 file di seed  → 2 bloccanti
    [block] supabase/seed.sql:28 · :33  password in chiaro dentro `crypt('…')`
DOPO  (HEAD):    3 file di seed  → 2 bloccanti
    [block] supabase/seed/90-solo-sviluppo.sql:87 · :92
```

**Il n°32 è passato da 1 bloccante a 0 senza che una riga di questa skill
cambiasse.** È il passaggio che il mandato chiedeva.

**Il n°27 è più interessante, e va riportato con cura.** Il registro lo dichiara
`CHIUSO 2026-08-06 (schema-forge, P.4g)`, e la chiusura **è legittima**: il
debito non era «quelle password esistono» — senza, nessuno prova il gestionale
in locale e ventidue test E2E non hanno sessioni — era «il percorso di
produzione legge lo stesso file di quello di sviluppo», e P.4g l'ha chiuso
separando i seed in tre file, di cui solo due di produzione.

Ma la mia **misura** dice un'altra cosa, ed è vera anche lei: quelle credenziali
sono ancora in un file **tracciato**, e — da quando la storia si legge per file —
anche in `supabase/seed.sql @ b1df9572 (2026-08-04)`, dove nessuna separazione
può più toglierle. Chi ha clonato quel repo le ha.

Non è un'accusa a P.4g: è **esattamente la differenza fra letto e misurato** che
§2 esiste per dichiarare. E ha una chiusura da una riga, che **non è mia da
scrivere** (sul pilota non si scrive): l'eccezione dichiarata del §10.
Simulata, non applicata:

```
=== n°27, se il file dichiarasse l'eccezione (§10) ===
  0 bloccanti, 2 da guardare (simulazione: sul pilota NON si scrive)
    [issue] supabase/seed/90-solo-sviluppo.sql:88 … · ECCEZIONE DICHIARATA:
            solo sviluppo, il percorso di produzione non legge questo file
            (debito n°27, docs/PRODUZIONE.md)
```

Il rilievo **non sparisce**: resta stampato, resta contato, e finisce
nell'handoff con la motivazione accanto.

### 5.5 Batteria — **87/87**

```
node --test scripts/gate-lib.test.mjs scripts/segreti-lib.test.mjs scripts/verify.test.mjs
ℹ tests 87 · pass 87 · fail 0
```

Su **Node 24** (il glob di `node --test` vuole 21+; i tre file si elencano per
esteso, che è la forma che gira anche su 20). Il **gate** invece gira col node
di sistema (20.12.2), che è il canale reale: tutte le uscite di §5.1 sono di lì.

I test negativi contano più dei positivi, e in questa libreria si vede: la
chiave anonima di Supabase ha la **stessa forma** della `service_role` e
significato opposto, quindi c'è un test che pretende **zero rilievi** sul file
che vetrina-crafter prescrive di scrivere.

### 5.6 Gate della regia — **VERDE 5/5 prima e dopo**

Prima (44 sorgenti letti) e dopo (60, cioè gli otto file nuovi con l'epilogo a
doppio confronto):

```
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
OK  documento madre e copia di testo
OK  skill vere ed elenchi che le dichiarano
      scripts/installa-skill.ps1: … speed-demon, launchpad, …
      README.md §Installazione:   … speed-demon, launchpad, …
      tabella §Natura: … launchpad dichiarati 🟢 e di questo repo
OK  STATO.md di ogni agente di casa
OK  epiloghi degli script di casa — 60 sorgenti letti
OK  segnaposto nei documenti di radice
```

### 5.7 I guardiani deterministici

```
ESLint   0 errori, 5 warning (complessità sui tavoli di regole, max-params, max-depth)
knip     nessun export morto, nessun file morto
jscpd    Found 0 clones     (erano 2: 44 righe + 12)
```

Quattro rilievi trovati e chiusi: **due errori** (`no-irregular-whitespace`: il
BOM scritto come **carattere** dentro la regex, invisibile a chi legge — stesso
rimedio che speed-demon aveva già documentato); **due export morti**; **due
cloni**, che hanno prodotto `git-lib.mjs`.

Residuo dichiarato: **5 warning di complessità**. `findingsAmbiente` (20) e
`findingsRuntime` (22) sono tavoli di regole — una branch per regola — e
dividerli sparpaglierebbe le regole invece di semplificarle; `max-params` e
`max-depth` restano nei due gusci di I/O.

### 5.8 `verifica-pubblicato`, esercitato fino al passo prima

È il comando che risponde, **dopo** il deploy, alla domanda che dà senso alla
Legge n°4: *l'indirizzo pubblico sta servendo il commit che ho approvato?* Non
poteva essere provato contro un dominio (non c'è deploy), ma il **meccanismo**
sì — contro una build servita in locale, che è la stessa cosa vista da fuori.

Provato nei due versi, perché un controllo che accetta e non rifiuta non è un
controllo:

```
$ impronta.mjs --url http://127.0.0.1:3781 --commit f16501b7dfa6b4be…
IMPRONTA: coerente
  impronta attesa   f16501b7dfa6
  .next/BUILD_ID    f16501b7dfa6
  servito da http://127.0.0.1:3781   f16501b7dfa6
  combacia          SI
                                                        → uscita 0

$ impronta.mjs --url http://127.0.0.1:3781 --commit 0000000000000000…
  combacia          NO
  [block] http://127.0.0.1:3781: non porta l'impronta attesa `000000000000`
          (serve `f16501b7dfa6`)
                                                        → uscita 1
```

**Cosa questo prova e cosa no.** Prova che il meccanismo riconosce l'artefatto
giusto e rifiuta quello sbagliato, e che il codice d'uscita è utilizzabile in
una procedura. **Non** prova che funzioni contro un dominio vero dietro una CDN,
né che il provider costruisca lo stesso commit: quello è il punto 4 di §7.

---

## 7. Cosa questo pacchetto non ha potuto provare senza un umano

L'elenco onesto, ed è il mandato del collaudo di P.5.

**Nessun deploy è stato eseguito.** Non un account creato, non un repository
collegato a Vercel o Cloudflare, non un dominio comprato, non un record DNS
toccato, non un centesimo speso. Era una condizione esplicita del mandato
(§6 di `DECISIONI.md`), e va detto che **la tentazione c'è stata**: più di una
volta, davanti a un passo che non potevo esercitare, il pensiero è stato
«basterebbe un deploy di prova». È esattamente il pensiero da cui la §6 esiste.

Di conseguenza restano non provate **contro il mondo**:

1. **Il comando `pubblica`.** Esiste come procedura numerata; non è mai stato
   eseguito. Il gate arriva fino al passo prima.
2. **Il rollback**, su nessuno dei due provider. Il gate legge una procedura
   scritta; che funzioni si scopre la prima volta che serve, che è il momento
   peggiore.
3. **`verifica-pubblicato` contro un dominio vero.** È stato esercitato contro
   una build di produzione servita in locale: prova il **meccanismo**, non la
   pubblicazione. La differenza è tutta lì.
4. **`generateBuildId` sulla macchina di un provider** — cioè la premessa su cui
   poggia tutta la Legge n°4. Che Vercel imposti `VERCEL_GIT_COMMIT_SHA` e che
   Cloudflare imposti `CF_PAGES_COMMIT_SHA` è documentato, non misurato da me.
5. **Che il frammento `generateBuildId` non rompa la build di un progetto
   vero.** È stato provato su un banco, non su `fornodoro`: sul pilota non si
   scrive.
6. **Che `engines.node` venga rispettato da un provider.** Nessuno lo impone
   senza `engine-strict`: il gate misura che sia dichiarato e coerente, e il
   runbook prescrive di fissarlo **anche** sul pannello.
7. **Certificato SSL, propagazione DNS, coerenza fra apex e `www`.**
8. **Il costo vero** di una pubblicazione.

E due cose che non riguardano il mondo ma vanno dette qui:

9. **Il collaudo avversario indipendente (P2) non è stato fatto.** Sulle cinque
   skill che l'hanno avuto il tribunale ha trovato qualcosa **ogni volta**
   (11+6+5+21+6 rilievi), e gli strumenti statici erano **tutti verdi ogni
   volta**. Non c'è motivo di credere che questa sia diversa.
10. **Il gate non ha mai visto un progetto cliente.** Il gemello pulito l'ho
    costruito io, e un banco costruito da chi collauda dimostra meno di quanto
    sembri: dimostra che il gate riconosce ciò che **io** ho immaginato come
    corretto.

---

## 8. Note di cantiere

**Coordinamento (D8, D17).** Quattro chat vive. Ho toccato solo
`agenti/launchpad/`, più le righe di `README.md` e `scripts/installa-skill.ps1`
che il mandato autorizza. Commit sempre con `git add` espliciti dei miei
percorsi, mai `-A`.

Due intrecci con le chat parallele, entrambi risolti e nessuno dei due
silenzioso:

- **P.6 (site-doctor)** ha aggiunto la propria nota al README negli stessi
  minuti, scegliendo lo **stesso marcatore** a sei asterischi. Ho spostato il
  mio a sette — cedo io perché la fase 5 viene prima della 6 e così la sequenza
  delle note resta quella delle fasi.
- **P.4g** ha lavorato sul pilota per tutta la durata di questo pacchetto, e lo
  stato è cambiato tre volte sotto le mie misure (albero sporco → pulito;
  `engines` assente → dichiarato; app viva sulla 3621 → spenta). §5.1 riporta
  due esecuzioni col commit, invece di una sola che sembrerebbe più netta.

**L'app del pilota.** Alla chiusura di questo pacchetto la **3621 non è in
ascolto**, e non sono stato io a fermarla: l'ha fermata P.4g, che in questo
momento possiede il ciclo di vita di quell'app. Non l'ho riaccesa di proposito —
servire una build vecchia su quella porta mentre un'altra chat misura le stesse
pagine è il modo di far misurare a qualcun altro l'artefatto sbagliato. Lo stack
Supabase sulla 7621 è rimasto acceso e intatto: **non ho toccato schema, seed né
migrazioni**, che sono di P.4g.

**Il banco.** Vive nello scratchpad e si ricostruisce con `banco.mjs`. Non è
tracciato: la §25 chiede che un banco si tenga solo se un clone pulito lo sa
rilanciare, e uno script che lo ricostruisce da zero soddisfa quel criterio
meglio di una cartella che invecchia.
