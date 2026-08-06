# Il gate di Launchpad — specifica dei nove passi

> Scritta **prima** del flusso operativo e prima di una riga di codice
> (`template-skill/COME-USARE-QUESTO-TEMPLATE.md`, passo 3). Se non si sa dire
> cosa deve essere vero alla fine, non si sa ancora cosa fa l'agente.
>
> Questo documento è la fonte di verità del gate: `SKILL.md` ne porta la
> tabella, `scripts/gate-lib.mjs` ne porta le regole, `scripts/verify.mjs` ne
> porta l'ordine. Se i tre divergono, vince questo.

## 0. Cosa misura questo gate, e cosa non è

Launchpad non è un deployer. È **il permesso di pubblicare**, e il gate è la
sua serratura.

La differenza non è filosofica, è operativa: gli altri quattro gate della casa
misurano una cosa che **è già stata fatta** (lo schema è applicato, le pagine
sono servite, i test sono girati, i numeri sono presi). Questo misura una cosa
che **non è ancora stata fatta**, e che una volta fatta non si annulla. Da qui
discendono due proprietà che nessuno degli altri gate ha:

1. **Gira a deploy spento.** Nessun passo ha bisogno di un dominio, di un
   account o di una spesa. Il gate si esercita fino al passo prima della
   pubblicazione, e quello dopo lo autorizza un umano (`DECISIONI.md` §6).
2. **Il suo verde non è il permesso.** È la condizione *necessaria*. Il
   permesso lo firma una persona che ha letto cosa va online. Un gate che
   pubblicasse da solo su nove verdi avrebbe convertito la §6 in un `if`.

## 1. La domanda che ordina i passi

> **Cosa deve essere vero perché la pubblicazione di questo artefatto,
> su questo dominio, con queste variabili, sia una cosa che si può disfare
> e che non consegna niente a nessuno per sbaglio?**

Quattro parole di quella frase sono i quattro gruppi di passi:

| parola | passi | domanda |
|---|---|---|
| *questo artefatto* | `radice-pulita`, `impronta-artefatto` | ciò che va online è ciò che ho misurato, ed è dimostrabile **dopo** |
| *non consegna niente* | `segreti`, `ambiente` | nel pacchetto non viaggia nessun segreto, e le variabili vere restano fuori |
| *si può disfare* | `runtime-riproducibile`, `runbook-firmato` | la build si rifà uguale su un'altra macchina, e si torna indietro |
| *si può* | `catena-gate`, `debito-bloccante`, `contratto-uscita` | nessuno a monte ha detto di no, e ciò che ho fatto resta scritto |

## 2. Misurato o letto? — la tabella che vale più delle altre

Il mandato di P.5 chiede di scrivere la differenza «fra un certificato e una
promessa». Eccola, passo per passo. **`misura`** = il gate stabilisce il fatto
da solo, guardando il repo o l'app; **`legge`** = il gate legge
un'affermazione che qualcun altro ha scritto e può sbagliare o mentire.

| passo | misura | legge | cosa resta indimostrato |
|---|---|---|---|
| `radice-pulita` | albero git pulito, HEAD, scarto col remoto | — | che l'albero sia ancora pulito **al momento del deploy** — lo ricontrolla `pubblica`. E **l'età dell'artefatto non si misura**: era promessa qui e non implementata (rilievo VER-14 del tribunale), e l'`mtime` non sopravvive a una copia della cartella — produrrebbe falsi rossi. Chi costruisce con l'albero sporco e poi lo pulisce ha un `.next/` che nessun commit contiene, e questo gate non lo vede |
| `catena-gate` | **freschezza**: ogni handoff è più giovane dell'ultimo commit che tocca il codice che certifica (§3.2 dice quali percorsi contano, e quale commit è **esente**) | il verdetto `Gate: VERDE` scritto in ogni handoff | che quel verde fosse vero. Il gate **non rilancia** i gate a monte: vedi §6 |
| `debito-bloccante` | quali voci del registro dichiarano di bloccare il deploy, e quali di esse il runbook risponde per numero | il testo del registro | che le voci siano tutte quelle vere. Un bloccante che nessuno ha scritto non esiste per questo passo |
| `segreti` | contenuto di **ogni file tracciato** e della **storia git**, per otto famiglie di segreto | — | i segreti in forme che le otto famiglie non coprono (§5) |
| `ambiente` | le variabili che il codice **spedito** legge davvero (`process.env.X` sotto le radici dichiarate), confrontate con quelle dichiarate; nessun valore locale come valore di produzione | quali radici finiscono nel pacchetto | che i valori dichiarati siano **giusti**. Il gate sa che `NEXT_PUBLIC_SITO_URL` non è `127.0.0.1`; non sa se è il dominio del cliente |
| `runtime-riproducibile` | `engines.node` del progetto contro `engines.node` di **ogni dipendenza installata**; presenza e coerenza del lockfile | — | che la macchina di deploy rispetti `engines`. Nessun provider lo impone senza `engine-strict` |
| `impronta-artefatto` | che il `BUILD_ID` sia **derivato dal commit** e non casuale; che l'app servita porti quell'impronta | il commit approvato scritto nel runbook | che il provider costruisca dallo stesso commit. È il motivo per cui l'impronta deve essere *derivata*, non *registrata* (§4) |
| `runbook-firmato` | esistenza, assenza di segnaposto, firma non-agente, **data della firma ≥ data dell'artefatto** | il contenuto della procedura e del rollback | che la procedura funzioni. Nessuno l'ha eseguita: è il collaudo di P.5 |
| `contratto-uscita` | la riga `Gate:` dell'handoff contro il verdetto di **questa** esecuzione | — | che i residui elencati siano quelli giusti (`DECISIONI.md` §19) |

**Cinque passi su nove sono misure piene. Tre sono misure sulla forma di una
dichiarazione altrui. Uno — `catena-gate` — è una lettura con una misura di
freschezza attaccata.** Chi legge un verde di questo gate deve sapere che il
verde di `catena-gate` vale quanto valgono gli handoff, e non un grammo di più.

## 3. I nove passi

**L'ordine di questa tabella è il gate.** I primi sei girano su repo e file; il
settimo vuole un'app servita; l'ottavo e il nono guardano i documenti che i
precedenti hanno prodotto. Un passo spostato cambia cosa il gate aveva in mano
quando ha deciso.

| # | `id` | Cosa prova, in una riga | Con cosa | MANCANTE quando |
|---|---|---|---|---|
| 1 | `radice-pulita` | si sta per pubblicare **un commit**, non un working tree | `git status --porcelain`, `git rev-parse HEAD` | non è un repo git, o `git` non è installato |
| 2 | `catena-gate` | nessun gate a monte ha detto di no, e nessun handoff è più vecchio del codice che certifica | `docs/handoff/*.md` + `git log` | nessun handoff trovato |
| 3 | `debito-bloccante` | ogni residuo che dichiara di bloccare il deploy ha una risposta nel runbook | `docs/DEBITO-TECNICO.md` + `docs/deploy.md` | il registro del debito non esiste o non è una tabella leggibile |
| 4 | `segreti` | nel pacchetto che parte non viaggia nessun segreto — **né nella storia** | ogni file tracciato + `git log -p` | `git` non risponde (i file tracciati non si possono elencare) |
| 5 | `ambiente` | ogni variabile che il codice spedito legge è dichiarata, e nessun valore vero è committato | sorgenti sotto le radici spedite + runbook | il runbook non dichiara nessuna variabile né nessuna radice |
| 6 | `runtime-riproducibile` | la build si rifà uguale altrove: runtime dichiarato ≥ quello che le dipendenze pretendono, lockfile presente | `package.json`, `node_modules/*/package.json`, lockfile | `node_modules/` assente: senza albero installato non si sa cosa pretendono le dipendenze |
| 7 | `impronta-artefatto` | l'impronta è **derivata dal commit**, ed è quella che l'app servita mostra | `next.config.ts`, `.next/BUILD_ID`, HTTP su `--url` | `--url` non passato, app spenta, `.next/` assente |
| 8 | `runbook-firmato` | esiste una procedura firmata **sul contenuto**, con rollback, e la firma non è più vecchia dell'artefatto | `docs/deploy.md` | il file non esiste |
| 9 | `contratto-uscita` | l'handoff esiste e la sua riga `Gate:` dice il vero su **questa** esecuzione | `docs/handoff/` | non si applica: è `pass` o `fail` |

**Uno strumento assente vale `MANCANTE`, non `PASS`** (`DECISIONI.md` §18), e
vale lo stesso per uno strumento presente che non ha letto il suo input. Un gate
rosso per verifiche mancanti **resta rosso**: qui più che altrove, perché la cosa
che sta per succedere non si annulla.

### 3.1 `radice-pulita`

**Premessa misurata prima dell'esito:** `git rev-parse --is-inside-work-tree`
risponde, e `git rev-parse HEAD` dà un commit. Senza, MANCANTE — e non
«pulito».

| finding | gravità | perché |
|---|---|---|
| working tree sporco (file modificati o non tracciati che non sono ignorati) | `block` | ciò che il provider riceve è il **commit**, non il disco. Un file modificato e non committato è codice che hai misurato e che non partirà — o peggio, che partirà se il deploy è da CLI e non da git |
| **HEAD è avanti rispetto al suo `upstream`** | `block` | trovato dalla domanda di metà pacchetto (§8, n°1). Un deploy connesso a git pubblica ciò che sta **sul remoto**: con tre commit non spinti, il provider costruisce un commit più vecchio di quello che il gate ha appena misurato — e ogni altro passo resta verde, perché ha guardato il disco |
| nessun `upstream` configurato | `issue` | si può pubblicare da CLI; ma allora il runbook deve dichiararlo, perché il resto del gate ha misurato un commit che nessun remoto conosce |
| HEAD è distaccato o non ha un ramo | `warn` | si può pubblicare da un commit staccato; ma il rollback per ramo non esisterà |

Stampa **sempre** il commit e il ramo, anche sul verde: un gate che ha guardato
un altro commit non deve poter assomigliare a un gate che ha guardato il tuo
(`DECISIONI.md` §11).

### 3.2 `catena-gate`

Legge ogni `docs/handoff/<n>-<agente>.md`, ne estrae la riga `Gate:` nella forma
fissa che la §19 ha imposto a tutta la casa, e:

| finding | gravità | perché |
|---|---|---|
| un handoff dichiara `Gate: ROSSO` | `block` | **la legge n°1**: non si pubblica su gate rosso. Posta da flow-sentinel e da speed-demon prima che questo agente esistesse (`launchpad/STATO.md` §Dipendenze) |
| un handoff non ha nessuna riga `Gate:` leggibile | `block` | un handoff senza verdetto non è un certificato: è prosa. La §19 esiste perché la prosa libera non si controlla |
| l'handoff è **più vecchio** dell'ultimo commit che tocca `src/`, `supabase/`, `package.json` | `block` | il verde certificava un altro artefatto. È la stessa idea del `BUILD_ID`, applicata alla catena dei certificati invece che alle pagine |
| **il contratto di un agente esiste e il suo handoff no** | `block` | trovato dalla domanda di metà pacchetto (§8, n°2). Un agente che non è mai passato non lascia nessun `Gate: ROSSO` da leggere: lascia **silenzio**, e il silenzio era verde. La prova che un agente *doveva* passare non è una dichiarazione — è il suo contratto sul disco, che ha scritto lui |

**Le prove di appartenenza alla catena**, misurate e non dichiarate: ogni agente
della casa lascia un contratto firmato, e il contratto è l'evidenza che l'agente
faceva parte di questo progetto.

| se esiste… | …allora deve esserci l'handoff di |
|---|---|
| `supabase/migrations/` non vuota | `schema-forge` |
| `docs/vetrina.md` | `vetrina-crafter` |
| `docs/gestionale.md` | `gestionale-crafter` |
| `docs/flussi-critici.md` | `flow-sentinel` |
| `docs/performance.md` | `speed-demon` |

Il contrario **non** vale e non si controlla: un handoff senza contratto è un
agente che ha lavorato senza far firmare niente, ed è un difetto suo, non un
bloccante del deploy.

**Quali percorsi contano come «codice», e l'unico commit esente.** La scadenza
di un certificato si misura sull'ultimo commit che tocca

```
src/ · supabase/ · package.json · next.config.ts · next.config.mjs · next.config.js
```

e **non** su `public/`, `middleware.ts` fuori da `src/`, `tsconfig.json` o le
configurazioni di Tailwind e PostCSS: è un elenco, non un principio, e chi
cambia solo quelli non fa scadere niente. Dichiarato qui perché si veda.

Un solo commit è **esente**, e l'esenzione è misurata riga per riga sul diff,
non dedotta da chi ha committato: quello che porta **soltanto** il frammento
`generateBuildId` che questa skill scrive in `next.config.*`. Senza l'esenzione
il gate ha un **rosso strutturale contro sé stesso** — misurato dal collaudo del
2026-08-06 su un banco corretto in tutto il resto: il Flusso prescrive
`impronta` (passo 5) *dopo* che gli agenti a monte hanno depositato i loro
handoff, quindi il commit di launchpad diventa il più recente che tocca il
codice e fa scadere **tutti e quattro** i certificati, che nessuno dei quattro
agenti può rinnovare — dovrebbero ridatare un certificato su una modifica che
non hanno mai visto. Una riga in più in quel commit e la freschezza torna a
scattare. Il passo **stampa** quanti commit ha saltato e quali.

**Il gate non rilancia i gate a monte, ed è una scelta, non una dimenticanza:**
vedi §6.

### 3.3 `debito-bloccante`

`docs/DEBITO-TECNICO.md` è, in questa casa, l'unico posto in cui gli agenti a
monte scrivono **per iscritto e numerato** cosa impedisce di pubblicare. Il
passo lo legge come una tabella e cerca, nelle colonne libere di ogni riga, la
dichiarazione di bloccare il deploy — nelle forme in cui la casa la scrive
davvero: `blocca il deploy`, `blocca la pubblicazione`, `prescrizione di
deploy`, `il deploy … non può partire`, con o senza il riferimento a `P.5`.

**La forma della tabella è un contratto, e va scritta perché nessuno la indovini:**

```
| # | agente | gravità/stato | cosa | … |
```

Il **numero** sta in prima colonna (nudo, `n°27`, `27.`, in grassetto: sono tutte
accettate); il **gettone di chiusura** `CHIUSO <AAAA-MM-GG>` deve **aprire la
terza colonna**, come nel registro del pilota. È la stessa scelta della §19 —
una forma sola, perché un controllo su prosa libera è un controllo che non c'è —
e la sua conseguenza va detta: una chiusura scritta altrove **non viene letta**,
e il passo la segnala come `issue` invece di tacerne.

**E la negazione conta.** «**Non** blocca il deploy» non è una dichiarazione di
bloccare il deploy: la negazione deve *governare il verbo* (si guarda la sola
coda del testo che precede, con al più un pronome in mezzo), così che *«la voce
non è chiusa **e** blocca il deploy»* resti un bloccante. Il tribunale del
2026-08-06 aveva chiuso questa stessa classe sul gettone di **chiusura**
(VER-4: «NON CHIUSA» valeva chiusa) e l'aveva lasciata aperta su quello di
**blocco**: metà del problema. Un rifiuto indebito insegna a scavalcare il
passo — e qui insegnava a riscrivere la voce in un altro modo, che è peggio.

| finding | gravità | perché |
|---|---|---|
| una voce dichiara di bloccare il deploy e il runbook **non la nomina** | `block` | è la voce stessa a dire di essere un prerequisito. Ignorarla è pubblicare contro una prescrizione scritta |
| il runbook nomina la voce ma non dichiara come è stata chiusa o mitigata | `block` | nominare non è rispondere. La forma richiesta è una riga per numero con l'esito |
| una voce è dichiarata chiusa nel registro **e** risposta nel runbook | — | nessun finding: è il caso normale a lavoro fatto |
| **una voce dichiara `CHIUSO <data>` in una colonna diversa dalla terza** | `issue` | trovato dal collaudo del 2026-08-06. La chiusura si legge **solo** nella terza colonna, ed era un contratto che nessun documento dichiarava: su un registro nella forma `\| # \| Voce \| Chi \| Stato \|` — legittima e leggibile da un umano — il gate stampava «0 voci già chiuse» sopra due voci chiuse. Se una di quelle avesse dichiarato di bloccare, sarebbe stato un **rifiuto indebito su un progetto in regola**. Ora lo scarto si dichiara invece di sparire |
| **un handoff cita un numero di debito che il registro non contiene** | `issue` | trovato dalla domanda di metà pacchetto (§8, n°3). Il registro lo scrivono le stesse mani che potrebbero volerlo alleggerire: una riga cancellata non lascia traccia in sé, ma **lascia il riferimento orfano** nell'handoff che la citava. È l'unico controllo possibile sulla completezza di un elenco che nessuno può verificare da fuori |

**Questo è il passo che rende il gate del pilota rosso per i motivi giusti**, e
lo fa **leggendo** — non lo sa da sé. La sua forza è che l'elenco lo hanno
scritto altri, prima che questo agente esistesse; la sua debolezza è che un
bloccante che nessuno ha scritto qui non esiste per lui. Per questo `segreti` e
`runtime-riproducibile` **rimisurano da soli** due delle quattro voci del
pilota: perché ci fosse almeno un caso in cui la stessa verità esce una volta
come promessa e una volta come misura.

### 3.4 `segreti`

Il passo più importante, e l'unico su cui questo agente ha una responsabilità
che non condivide con nessuno: **è l'ultimo momento in cui un segreto committato
è ancora un problema interno.**

**Premessa misurata:** `git ls-files` risponde con almeno un file. Zero file
letti = MANCANTE, mai «nessun segreto trovato» (§18, e il precedente misurato
di gestionale-crafter, il cui walker saltava in silenzio la cartella dove
nascevano i client).

Cosa guarda, in ordine di gravità decrescente:

| famiglia | come la riconosce | gravità |
|---|---|---|
| **chiave `service_role` di Supabase** | JWT a tre segmenti il cui payload, decodificato da base64url, contiene `"role":"service_role"`; **oppure** una chiave `sb_secret_…` (formato nuovo); **oppure** il nome `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY` con un valore non vuoto e non segnaposto | `block` |
| **credenziali cablate in SQL** | `crypt('…')`, `encrypted_password`, `password` seguiti da un letterale in un file `supabase/**.sql` tracciato | `block` |
| **token di provider** | `vercel_…`, `ghp_`/`gho_`/`github_pat_`, `cf_…`/token API Cloudflare, `sk_live_`/`rk_live_` (Stripe), `AKIA…` (AWS), `xox[baprs]-` (Slack), `-----BEGIN … PRIVATE KEY-----` | `block` |
| **URL con credenziali** | `postgres://utente:password@…`, `https://x:y@…` — la password nell'autorità dell'URL | `block` |
| **file di ambiente tracciati** | un file che corrisponde a `.env`, `.env.*` **ed è tracciato**, salvo `.env.example`/`.env.sample`/`.env.template` | `block` |
| **valori veri in un file di esempio** | dentro `.env.example` & c.: una riga `NOME=valore` il cui valore non è vuoto, non è un segnaposto (`<…>`, `{{…}}`, `xxx`, `changeme`, `your-…`) **e** il cui nome suggerisce un segreto (`KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `DSN`, `CREDENTIAL`) | `block` |
| **segreto nella storia e non in HEAD** | le stesse famiglie cercate su `git log -p` (finestra configurabile, default: tutta la storia) | `block` |
| **entropia alta in un file di configurazione** | stringa ≥ 32 caratteri base64/hex in un file tracciato non di lockfile, che nessuna delle famiglie sopra spiega | `issue` |

**Perché la chiave anonima di Supabase non è in elenco.** È pubblica per
costruzione: viaggia nel bundle del browser e la legge chiunque. Segnalarla
sarebbe il falso positivo peggiore — quello sul file che la skill a monte
prescrive di scrivere. Ciò che difende i dati sono le policy, non la
segretezza di quella stringa (`vetrina-crafter/SKILL.md` §Perimetro).

**Perché la storia conta.** Un segreto tolto da HEAD con un commit successivo è
ancora consegnato: chi clona il repo lo ha. E un deploy connesso a git dà al
provider **la storia**, non lo snapshot. Questa riga è il motivo per cui il
passo non si accontenta di `git ls-files`.

**Cosa questo passo non vede — dichiarato qui perché la sua assenza è il modo
in cui un verde diventa una firma in bianco:** §5.

### 3.5 `ambiente`

**Premessa misurata:** il runbook dichiara **quali radici finiscono nel
pacchetto** (per un progetto Web Gun: `src/`, `next.config.ts`, `public/`; non
`e2e/`, non `scripts/`, non `supabase/tests/`). Senza quella dichiarazione il
passo è MANCANTE: contare le variabili di un file di test come variabili di
produzione produce un rosso sull'imputato sbagliato, e contarle tutte insieme
produce un verde che non ha distinto niente.

| finding | gravità | perché |
|---|---|---|
| una variabile letta dal codice spedito non è dichiarata nel runbook | `block` | il deploy costruisce, parte, e la pagina che la usa risponde 500 o mostra il ripiego. È il guasto di produzione più banale e più frequente |
| una variabile dichiarata ha, nel runbook, un **valore** invece di un nome | `block` | il runbook è committato. Le variabili si dichiarano, non si scrivono |
| una variabile `NEXT_PUBLIC_*` di indirizzo vale `localhost`/`127.0.0.1`/`http://` in produzione | `block` | misurato dal pilota stesso: da `NEXT_PUBLIC_SITO_URL` discendono `canonical`, Open Graph, `sitemap.xml` e `robots.txt`, **prerenderizzati una volta sola**. Sbagliata al deploy, resta sbagliata finché qualcuno non ricostruisce |
| una variabile dichiarata non è letta da nessun sorgente spedito | `issue` | non è un guasto, ma è quasi sempre il residuo di un nome cambiato: `NEXT_PUBLIC_SITE_URL` invece di `NEXT_PUBLIC_SITO_URL` sul pannello dell'hosting **sembra lavoro fatto** |
| **una `NEXT_PUBLIC_*` non è dichiarata come impostata prima della build** | `block` | trovato dalla domanda di metà pacchetto (§8, n°4). Una `NEXT_PUBLIC_*` viene **inserita nel bundle da `next build`**: impostarla solo a runtime sul pannello del provider ripara le pagine e lascia rotti `sitemap.xml` e `robots.txt`, che sono prerenderizzati una volta sola. Il pilota lo ha già scritto nel proprio `.env.example`, e nessuno strumento lo controllava |
| **il codice destruttura `process.env`** (`const { X } = process.env`) | `issue` | i nomi non si risolvono staticamente: il passo dichiara il file e ammette di non poter contare le variabili che ci sono dentro. Un passo che tace su ciò che non ha potuto leggere è un passo che dichiara di aver letto tutto |

**Come si contano le variabili lette.** `process.env.NOME`, `process.env["NOME"]`
e `process.env['NOME']`. La sola forma con il punto è quella che si scrive per
prima e quella che lascia scoperte le altre due: una variabile mancante che il
codice legge con le parentesi quadre passerebbe il gate e romperebbe la pagina.

### 3.6 `runtime-riproducibile`

**Premessa misurata:** `node_modules/` esiste e contiene almeno un pacchetto con
un `package.json` leggibile. Senza albero installato non si sa cosa pretendono
le dipendenze, e dichiarare «runtime coerente» avendo letto zero `engines` è la
forma esatta del falso verde che la §18 vieta.

| finding | gravità | perché |
|---|---|---|
| il progetto non dichiara `engines.node` | `block` | la macchina di deploy sceglie da sola. Vercel usa il suo default, che cambia; una macchina con Node 20 fallisce la build — o peggio, non fallisce e serve pagine rotte |
| il progetto dichiara `engines.node` **più basso** di quello che una dipendenza installata pretende | `block` | è la stessa cosa, scritta male invece che non scritta. Il gate nomina la dipendenza e la sua riga |
| nessun lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) | `block` | senza lockfile la build del provider non è la tua build: risolve le versioni il giorno in cui gira |
| il lockfile non è tracciato da git | `block` | esiste sul disco e non parte: identico al caso sopra, con l'aggravante che sembra a posto |
| più lockfile di gestori diversi | `issue` | il provider ne sceglie uno, e non è detto sia il tuo |
| `packageManager` non dichiarato | `warn` | non blocca; ma è la riga che rende la scelta esplicita invece che inferita |
| **il runbook non dichiara il runtime impostato sul provider**, o lo dichiara più basso del minimo richiesto | `block` | trovato dalla domanda di metà pacchetto (§8, n°5). `engines` **non è imposto da nessun provider** senza `engine-strict`: dichiararlo e basta produce una build che fallisce con la colpa assegnata, non una build che riesce. La riga `Runtime del provider: Node 24` nel runbook trasforma una prescrizione in un confronto |

**Come si legge `engines` delle dipendenze.** Ogni `node_modules/*/package.json`
e `node_modules/@scope/*/package.json`; si prende il **massimo** dei minimi
dichiarati. Il confronto è fra minimi (`>=22.0.0` contro `>=20.9.0`), non fra
range arbitrari: un range esotico si segnala e non si interpreta.

### 3.7 `impronta-artefatto`

Questo è il passo che risponde alla domanda di speed-demon spostata in
produzione: *l'URL pubblico sta servendo il commit che credo?*

**E la risposta di speed-demon, copiata così com'è, sarebbe sbagliata.**
Il suo gate confronta il `BUILD_ID` dell'HTML servito con quello di `.next/`
sul disco: funziona perché **quella build l'ha fatta lui, su quella macchina**.
Un deploy su Vercel o Cloudflare **ricostruisce dal sorgente**: il `BUILD_ID`
che ne esce è un altro, generato a caso, e il confronto fallirebbe su un deploy
perfettamente corretto — un rifiuto indebito, che è il difetto peggiore di un
gate perché insegna a scavalcarlo.

**Scelta: l'impronta si deriva dal commit, non si registra.**
`next.config.ts` dichiara una funzione che **risolve il commit dove si trova**,
in quest'ordine, e **solleva** se non lo trova da nessuna parte:

```ts
generateBuildId: () =>
  process.env.WEBGUN_COMMIT            // impostata a mano, ha la precedenza
  ?? process.env.VERCEL_GIT_COMMIT_SHA // Vercel, build connessa a git
  ?? process.env.CF_PAGES_COMMIT_SHA   // Cloudflare Pages
  ?? gitRevParseHead()                 // build locale
  ?? (() => { throw new Error("impronta: commit non risolvibile"); })(),
```

così il `BUILD_ID` è **una funzione del commit**: chiunque ricostruisca lo
stesso commit ottiene la stessa impronta, sulla mia macchina come sulla loro. E
la verifica dopo il deploy diventa una domanda a cui si può rispondere da fuori,
con un `curl`: *l'HTML servito da questo dominio porta l'impronta del commit che
ho approvato?*

| finding | gravità | perché |
|---|---|---|
| `next.config.ts` non dichiara `generateBuildId` | `block` | l'impronta è casuale: dopo una ricostruzione del provider **nessuno può più dimostrare cosa c'è online**. Non è un dettaglio di comodità: è la sola prova d'identità che sopravvive al fatto che non siamo noi a costruire |
| **`generateBuildId` contiene un SHA scritto come letterale** | `block` | trovato dalla domanda di metà pacchetto (§8, n°6), ed era **la mia prima versione**. Un letterale scritto il giorno di `impronta` resta lì al commit successivo: la build del provider dichiarerebbe con sicurezza il commit **sbagliato**. È peggio dell'impronta casuale — quella ammette di non sapere, questa afferma il falso |
| `generateBuildId` non solleva quando il commit non è risolvibile | `issue` | un ripiego silenzioso è un artefatto che non sa dire chi è. Una build che non può identificarsi non deve nascere |
| `.next/BUILD_ID` non corrisponde al commit di HEAD | `block` | l'artefatto sul disco è di un altro commit: si ricostruisce |
| l'app servita su `--url` non porta l'impronta attesa | `block` | sta rispondendo un'altra applicazione, o una build precedente. È il caso che vetrina-crafter ha misurato per davvero il 2026-08-04 |
| `--url` assente | MANCANTE | il meccanismo che verrà usato **dopo** il deploy non è stato esercitato. Approvare una pubblicazione la cui prova d'identità non si è mai vista funzionare è la definizione di firma in bianco |

**`--url` non ha un default.** Stessa regola di speed-demon e per lo stesso
prezzo già pagato: un gate che indovina `localhost:3000` misura l'app di un
altro progetto e stampa `pass`.

### 3.8 `runbook-firmato`

`docs/deploy.md` è il contratto di questo agente, come `docs/vetrina.md` lo è
della vetrina e `docs/performance.md` di speed-demon. Ma con una differenza che
va detta: gli altri contratti dichiarano **cosa fare**; questo dichiara anche
**cosa un umano ha accettato che diventi vero nel mondo**.

| finding | gravità | perché |
|---|---|---|
| il file non esiste | MANCANTE | (premessa) |
| segnaposto `{{…}}` residui | `block` | un runbook a metà è un runbook che nessuno ha compilato: e il rollback è la parte che si compila per ultima |
| riga `Confermato da:` assente, segnaposto, o che nomina l'agente | `block` | **la §6**. La firma dell'agente su un'azione irreversibile non è una firma |
| la firma è **più vecchia** dell'ultimo commit di codice | `block` | ha firmato un altro contenuto. È la stessa misura di freschezza di `catena-gate`, sulla cosa che conta di più |
| manca una delle sezioni obbligatorie: provider, dominio, variabili, **cosa diventa pubblico**, rollback, prescrizioni | `block` | «la conferma è sul contenuto, non sul comando»: chi firma deve trovare scritto cosa va online. Un runbook senza §Cosa diventa pubblico fa firmare un comando |
| la procedura di rollback non nomina un identificativo di versione precedente | `block` | «si può tornare indietro» senza dire *a cosa* è un'intenzione |

### 3.9 `contratto-uscita`

Forma della casa (`DECISIONI.md` §19), senza variazioni: l'handoff esiste, non
ha segnaposto, e la sua riga `Gate: VERDE|ROSSO` **combacia** col verdetto degli
otto passi precedenti. Se diverge, il passo fallisce e dice quale dei due è
quello vero. Se il gate è rosso, l'handoff dichiara rosso e il passo **passa**:
dichiarare non è fallire.

## 4. Il contratto `--json` (§15)

```jsonc
{
  "contract": 1,
  "ok": false,
  "summary": { "passi": 9, "pass": 3, "fail": 4, "skipped": 2 },
  "steps": [
    { "id": "radice-pulita", "name": "…", "status": "pass",
      "detail": "…", "counts": { "block": 0, "issue": 0, "warn": 0 } }
  ]
}
```

`id` stabili e in quest'ordine — un test li blocca:

```
radice-pulita · catena-gate · debito-bloccante · segreti · ambiente ·
runtime-riproducibile · impronta-artefatto · runbook-firmato · contratto-uscita
```

Chiavi in inglese come in tutta la casa (§15): il formato di scambio resta com'è
nato. Uscite: `0` verde · `1` rosso · `2` errore di esecuzione.

## 5. I modi noti in cui questo gate potrebbe essere verde senza aver guardato

Elencati **prima** di scriverlo, perché un difetto previsto è un test e un
difetto scoperto è un incidente.

1. **Un segreto in una forma che le otto famiglie non coprono.** Base64 di un
   base64; una chiave spezzata su due righe e ricomposta a runtime; un token
   dentro un PNG in `public/`; un segreto in un file `.docx` o `.xlsx`
   tracciato; una chiave in un commento di un file minificato. *Difesa:* le
   famiglie coprono le forme note; la regola a entropia prende una parte del
   resto; il resto è dichiarato cieco qui e nella §Cosa un gate verde NON prova.
2. **Un segreto in un file ignorato che il deploy manda comunque.** Un deploy da
   CLI carica la cartella di lavoro, non `git ls-files`. Vercel e Cloudflare
   rispettano `.gitignore`, ma un `.vercelignore` sbagliato può riaprire il
   buco. *Difesa:* il passo elenca **anche** i file ignorati che
   corrispondono alle famiglie, come `issue`, e il runbook prescrive il deploy
   da git e non da CLI.
3. **La catena verde di ieri.** `catena-gate` legge dichiarazioni. La misura di
   freschezza chiude il caso «il codice è cambiato dopo», non il caso «il gate
   era rosso e l'handoff dichiarava verde» — che la §19 chiude a monte, nel gate
   di ciascun agente, non qui.
4. **Il runbook giusto per il progetto sbagliato.** Un `docs/deploy.md` copiato
   da un altro cliente, con l'altro dominio, firmato. *Difesa parziale:* le
   variabili dichiarate si confrontano col codice **di questo** progetto, quindi
   un runbook di un altro progetto quasi certamente sbaglia l'elenco. Il
   dominio, no: quello lo legge e non lo verifica.
5. **L'impronta giusta sul dominio sbagliato.** `verifica-pubblicato` prova che
   *quel dominio* serve *quel commit*. Non prova che quel dominio sia quello del
   cliente: `docs/deploy.md` lo dichiara, e chi firma lo legge.
6. **Il rollback documentato e mai provato.** Il gate legge una procedura. Che
   funzioni lo si sa la prima volta che serve, ed è il momento peggiore per
   scoprirlo. È dichiarato in §Cosa un gate verde NON prova e sta nel mandato
   del collaudo di P.5.
7. **`engines` rispettato da nessuno.** Il gate misura che sia dichiarato e
   coerente. Nessun provider lo **impone** senza `engine-strict`: un `engines:
   {">=22"}` con la macchina a Node 20 dà una build che fallisce nello stesso
   modo di prima, solo con la colpa assegnata. *Difesa:* il runbook prescrive
   di fissare la versione **anche** nel pannello del provider, e il passo lo
   pretende scritto.
8. **Tutto verde e il sito è inutilizzabile.** Nessun passo apre una finestra,
   nessun passo guarda una pagina. Questo gate non sa se il sito è bello,
   veloce, accessibile o corretto: lo sanno i quattro gate a monte, e il loro
   verde lo **legge**. Vedi §6.

## 6. I passi valutati e **scartati**, col perché

**a) Rilanciare i gate a monte da dentro questo gate.** Era la scelta più
attraente e sarebbe stata la sbagliata. Tre motivi misurati, non temuti:

- **Costo e fragilità.** Rilanciare i cinque gate del pilota richiede lo stack
  Supabase acceso, l'app di produzione viva, Chrome e Lighthouse, e — misurato
  dal direttore il 2026-08-06 — il Node giusto **nel `PATH`**, non solo come
  interprete. Un gate che dipende da cinque ambienti esterni è un gate che è
  rosso per motivi suoi, e un rosso che si impara a ignorare non è un controllo.
- **Duplicazione.** Sarebbe il quinto posto in cui vive la stessa verità. La
  §19 ha già deciso, per tutta la casa, che il verdetto **si dichiara** e che a
  verificarlo è il gate di chi lo dichiara.
- **Non è il mio mestiere.** Se il gate di flow-sentinel è verde e la batteria è
  falsa, il difetto è di flow-sentinel; rilanciarlo da qui non lo scoprirebbe —
  darebbe lo stesso verde.

**Cosa si fa invece:** si legge il verdetto, si **misura la freschezza**, e si
scrive nella tabella §2 che quel passo è una lettura. La riga
`node <skill>/scripts/verify.mjs` di ciascun agente resta nel runbook come
**passo umano** prima della pubblicazione, con l'esito da incollare. È la stessa
soluzione che la casa ha dato al problema gemello: *ciò che non si può misurare
si dichiara, e la dichiarazione si data.*

**b) Un passo «sicurezza» generale.** Sarebbe cyber-shield, che non esiste. Un
agente che copre il buco di un altro perché quell'altro manca produce due skill
che un giorno divergeranno, e la divergenza si scopre come falso verde
(`vetrina-crafter/SKILL.md` §Regole non negoziabili). Il gate copre **i
segreti**, che sono la superficie del deploy, e dichiara il resto come non suo.

**c) Un passo «DNS e certificato».** Non si può misurare prima del deploy, e
dopo il deploy lo misura `verifica-pubblicato` (HTTPS che risponde, catena del
certificato, apex e `www` coerenti). Metterlo nel gate pre-volo lo avrebbe reso
MANCANTE per sempre, cioè un rosso strutturale — la cosa che la §19 vieta.

**d) Un passo «costi».** «Questo deploy costerà X» non è misurabile da qui e
cambia col piano dell'account. Sta nel runbook come dichiarazione, e chi firma
la legge.

**e) Un passo che verifica il `.gitignore`.** Ridondante: `segreti` guarda
**cosa è tracciato**, che è la conseguenza del `.gitignore` e non la sua causa.
Una regola giusta con un file tracciato per sbaglio prima che la regola
esistesse è il caso vero, e lo prende `segreti`.

## 7. Trappole di piattaforma, da rispettare nel codice

- **L'epilogo a doppio confronto.** `resolve(argv[1])` **e** `realpathSync`, con
  `try` e ricaduta testuale. Dalla junction `.claude/skills/launchpad/…` il
  confronto secco è falso e lo script esce **0 muto** — cioè un verde. Otto
  script di questa casa lo hanno fatto per davvero (`IGIENE2-JUNCTION-2026-08-04.md`),
  e il gate della regia oggi lo verifica.
- **`import.meta.main` non si usa:** è arrivato in Node 24, su Node 20 vale
  `undefined`, il corpo non gira e il processo esce 0 senza stampare niente.
- **`spawnSync` senza `shell` non consulta `PATHEXT`:** uno shim `.cmd` (`npx`,
  `git` da alcune installazioni) risulta `ENOENT` sul nome nudo. Si risolve con
  `where`/`which` e si prende la **prima riga eseguibile**, non la prima riga.
  E non si abilita `shell: true`: lì gli argomenti vengono concatenati.
- **Interprete ≠ `PATH`** (misurato dal direttore il 2026-08-06). Questo gate
  non chiama strumenti esterni via `npx`: chiama **`git`**, che è un `.exe`
  risolto dal `PATH` e non dipende dal Node. È una dipendenza da dichiarare, non
  un problema di versione — ma va detto, perché la famiglia di guasti è la
  stessa.
- **`node --test` con glob vuole Node 21+.** I file di test si elencano per
  esteso.

## 8. La domanda di metà pacchetto, e le sei risposte

Il mandato di P.5 prescrive una sosta a metà, prima di scrivere il codice, con
una sola domanda: **quale passo del mio gate potrebbe essere verde su un deploy
che non si deve fare?** È il contrappeso dichiarato al fatto che progettazione e
costruzione stanno nella stessa chat, senza un revisore in mezzo.

Eseguita passo per passo. Sei risposte, tutte diventate regole sopra.

| # | passo | il verde falso | cosa è cambiato |
|---|---|---|---|
| 1 | `radice-pulita` | albero pulito, **e HEAD avanti di tre commit rispetto al remoto**. Il provider costruisce dal remoto: pubblica un commit più vecchio di quello che ho misurato, e tutti gli altri passi restano verdi perché hanno guardato il disco | confronto con `@{upstream}`: avanti = `block`, nessun upstream = `issue` |
| 2 | `catena-gate` | un agente **non è mai passato**. Non lascia un `Gate: ROSSO` da leggere: lascia silenzio, e il silenzio è verde | il contratto sul disco (`docs/vetrina.md`, `docs/flussi-critici.md`, `supabase/migrations/`…) è la **prova misurata** che un agente doveva passare. Contratto senza handoff = `block` |
| 3 | `debito-bloccante` | qualcuno **cancella la riga** che blocca. L'elenco lo scrivono le stesse mani che vorrebbero alleggerirlo | i riferimenti orfani: un handoff che cita `n°32` mentre il registro non ce l'ha più = `issue`. È l'unico controllo di completezza possibile dall'esterno |
| 4 | `ambiente` | il codice legge `process.env["X"]` invece di `process.env.X`, e una variabile mancante non viene contata; oppure una `NEXT_PUBLIC_*` viene impostata **solo a runtime** sul pannello, e `sitemap.xml` resta rotto per sempre | tre forme di lettura invece di una, destrutturazione dichiarata come non leggibile, e `NEXT_PUBLIC_*` da dichiarare come impostata **prima della build** |
| 5 | `runtime-riproducibile` | `engines: ">=22"` dichiarato, provider a Node 20, **nessuno impone niente**. La build fallisce esattamente come prima, solo con la colpa scritta | il runbook dichiara `Runtime del provider: Node <n>` e il gate lo **confronta** col minimo richiesto. Una prescrizione diventa una misura |
| 6 | `impronta-artefatto` | **era un difetto mio, e l'avrei spedito.** La prima stesura scriveva `process.env.WEBGUN_COMMIT ?? "<sha corto>"`: un letterale, messo lì il giorno di `impronta`. Al commit successivo quel letterale è ancora lì, e la build del provider **dichiara con sicurezza il commit sbagliato** — peggio dell'impronta casuale, che almeno ammette di non sapere | la funzione risolve da `WEBGUN_COMMIT`, `VERCEL_GIT_COMMIT_SHA`, `CF_PAGES_COMMIT_SHA`, `git rev-parse`, e **solleva** se non trova niente. Un letterale in `generateBuildId` è ora un `block` del gate |

**Due osservazioni che vanno tenute insieme al risultato.**

La prima: cinque risposte su sei non erano falsi verdi del *codice* — erano
falsi verdi della *progettazione*, cioè cose che il gate non avrebbe mai
guardato perché nessuno gli aveva detto di guardarle. Un collaudo del codice non
le avrebbe trovate: si trovano solo rileggendo la specifica con l'intenzione di
scavalcarla.

La seconda: la sesta è di un'altra specie. Non era un buco, era **una riga
sbagliata scritta con sicurezza**, ed è la classe di errore che il verbale di
catena di P.4 ha misurato quattro volte su cinque anelli — *cause attribuite
male a fatti giusti*. Il fatto («l'impronta deve derivare dal commit») era
giusto; la conclusione («allora scrivo il commit nel file») era sbagliata, e
sembrava la stessa cosa.
