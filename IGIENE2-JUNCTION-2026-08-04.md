# P.0-igiene-2 — I gate parlano anche dalla junction

> Verbale dell'operaio. Mandato: `prompts/P0-igiene2-epiloghi-junction.md`
> (emesso il 2026-08-04 sera, Opus 5 · max). Contabilità: `CANTIERE.md`, riga
> **P.0-igiene-2**, decisione **D12**.
> Macchina: Windows 11, node di sistema **v20.12.2**, Node 24
> (`~/scoop/apps/nodejs-lts/current/node.exe`) **v24.18.1**.
> Le uscite qui sotto sono **incollate**, non riassunte: la lezione del collaudo
> di P.4-pre è che una tabella a frecce non è un'uscita.

---

## 0. La misura di partenza, ripresa in proprio

Prima di toccare una riga. Cartella **vuota** fuori dall'albero della regia
(`...\scratchpad\fuori-albero`, `Get-ChildItem -Force | Measure-Object` → **0**),
node di sistema.

```
node di sistema: v20.12.2  |  cwd: ...\scratchpad\fuori-albero
=== schema-forge [agenti] === uscita: 2 | righe: 1
Nessuna cartella ...\fuori-albero\supabase\migrations: non c'e' schema da verificare.
=== schema-forge [skills] === uscita: 0 | righe: 0
=== vetrina-crafter [agenti] === uscita: 2 | righe: 1
Ne' docs/ ne' src/app/ in ...\fuori-albero: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.
=== vetrina-crafter [skills] === uscita: 0 | righe: 0
=== gestionale-crafter [agenti] === uscita: 2 | righe: 1
Nessuna cartella src/ in ...\fuori-albero: non c'e' gestionale da verificare.
=== gestionale-crafter [skills] === uscita: 0 | righe: 0
=== flow-sentinel [agenti] === uscita: 2 | righe: 1
Ne' docs/ ne' e2e/ in ...\fuori-albero: non c'e' batteria da verificare (lancia il gate dalla radice del progetto).
=== flow-sentinel [skills] === uscita: 0 | righe: 0
=== speed-demon [agenti] === uscita: 2 | righe: 1
Nessuna cartella docs/ in ...\fuori-albero: lancia il gate dalla radice del progetto.
=== speed-demon [skills] === uscita: 0 | righe: 0
```

Il difetto di §2b del `PILOTA-PRE-2026-08-04.md` è riprodotto: **cinque gate, 0
muti dalla junction**. E non solo i gate — i due gusci di audit, mai misurati
prima su questo canale, fanno lo stesso:

```
=== .claude\skills\gestionale-crafter\scripts\admin-audit.mjs  === uscita: 0 | righe: 0
=== .claude\skills\vetrina-crafter\scripts\vetrina-audit.mjs   === uscita: 0 | righe: 0
=== agenti\gestionale-crafter\scripts\admin-audit.mjs          === uscita: 2 | righe: 1
gestionale.config.json assente in ...\fuori-albero: l'audit non sa dove sia il gestionale.
=== agenti\vetrina-crafter\scripts\vetrina-audit.mjs           === uscita: 1 | righe: 7
AUDIT STATICO — .../fuori-albero
MANC  cucitura dei componenti
```

Su `admin-audit.mjs` il silenzio è peggio che altrove, ed è scritto nel suo
stesso commento: `0` è il codice di «nessun bloccante». Dalla junction l'audit
dichiarava «nessun bloccante» **senza aver letto un file**.

Gate della regia **prima**: `node scripts/verifica-regia.mjs` →

```
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
repo: C:/Users/Utente/Desktop/WebGun
```

Batterie **prima** (Node 24, `node --test "scripts/**/*.test.mjs"` da ogni
cartella):

| batteria | tests | pass | fail |
|---|---|---|---|
| schema-forge | 153 | 153 | 0 |
| vetrina-crafter | 177 | 177 | 0 |
| gestionale-crafter | 109 | 109 | 0 |
| flow-sentinel | 110 | 110 | 0 |
| speed-demon | 86 | 86 | 0 |
| regia | 46 | 46 | 0 |

---

## 1. La guardia impara la junction — otto siti

Otto epiloghi passati alla forma a doppio confronto. Perimetro rispettato:
**solo l'epilogo**, che resta l'ultima cosa del file, staccato da `main()` da
una riga vuota. `realpathSync` aggiunto all'import esistente da `node:fs` in
tutti e otto.

| File | Guardia: riga prima → blocco dopo | Chiamata |
|---|---|---|
| `agenti/schema-forge/scripts/verify.mjs` | 656 → 662-668 | `main();` |
| `agenti/vetrina-crafter/scripts/verify.mjs` | 682 → 688-694 | `await main();` |
| `agenti/gestionale-crafter/scripts/verify.mjs` | 435 → 441-447 | `main();` |
| `agenti/gestionale-crafter/scripts/admin-audit.mjs` | 218 → 226-232 | `main();` |
| `agenti/flow-sentinel/scripts/verify.mjs` | 462 → 468-474 | `await main();` |
| `agenti/speed-demon/scripts/verify.mjs` | 553 → 559-565 | `await main();` |
| `agenti/vetrina-crafter/scripts/vetrina-audit.mjs` | 295 → 303-309 | `main();` |
| `scripts/verifica-regia.mjs` | 375 → 385-391 | `main();` |

(Le righe dell'epilogo che precedono il blocco sono il commento: quello vecchio,
intatto, più le sei-nove righe nuove che dichiarano il fatto misurato.)

Il codice della guardia è **identico negli otto**; varia solo la riga di
commento che dichiara il fatto misurato, come già variava prima (i due gusci di
audit dicono «questo guscio usciva 0 muto», e `admin-audit` aggiunge che quel
silenzio si travestiva da «nessun bloccante»).

`scripts/verifica-regia.mjs` è un caso a parte, ed è scritto nel suo commento:
**a `scripts/` della regia nessuna junction punta**, quindi lì la forma nuova
non corregge niente. È allineata perché è la forma che l'`hint` di
`epiloghi-vivi` prescrive due file più in là — chi prescrive una forma la porta
in casa.

### Il non-sito, dichiarato

`agenti/code-maniac/scripts/tree.mjs:68` porta una guardia **più fragile** di
quella corretta oggi:

```js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
```

Operandi invertiti rispetto alla forma di casa e **nessun `resolve`**: si
confronta il percorso canonico del modulo con `process.argv[1]` **grezzo**. Non
è stato toccato: è **snapshot esterno** (rotta n°5,
`https://github.com/finzidev/code-maniac`).

> **Proposta per finzidev (code-maniac).** `scripts/tree.mjs:68` ha lo stesso
> identico buco che questo pacchetto ha appena chiuso sui sette script di casa:
> invocato attraverso una **junction**
> (`.claude/skills/code-maniac/scripts/tree.mjs` — il percorso con cui una chat
> aperta sul repo di un progetto vede la skill) il confronto è **falso**, il
> corpo non gira e il comando esce **0 senza stampare niente**. Misurato oggi su
> una sonda che riproduce quella riga esatta: attraverso una junction
> `argv[1]` resta il percorso della junction mentre `import.meta.url` è già
> canonico. Forma suggerita, la stessa adottata qui:
> `const questo = fileURLToPath(import.meta.url); const inv = resolve(process.argv[1]);`
> `if (inv === questo || realpathSync(inv) === questo) { … }`
>
> Cosa **non** è un buco, misurato e dichiarato per non far perdere tempo a chi
> legge: l'assenza di `resolve` non rompe l'invocazione con percorso relativo.
> Node **assolutizza da sé** `process.argv[1]` (`node scripts/sonda.mjs` da una
> cartella qualsiasi → `argv[1]` = `C:\...\scripts\sonda.mjs`, confronto `true`).
> Vale anche per la forma di casa: nella guardia nuova il lavoro lo fa
> `realpathSync`, `resolve` è cintura oltre le bretelle — resta perché costa
> nulla e perché non è documentato da nessuna parte che `argv[1]` sia assoluto
> per contratto.

### Prova: dieci uscite, due canali, cinque gate

Stessa cartella vuota, stesso node di sistema, subito dopo la correzione:

```
node: v20.12.2 | cwd: ...\scratchpad\fuori-albero
=== schema-forge [agenti] === uscita: 2 | righe: 1
Nessuna cartella ...\fuori-albero\supabase\migrations: non c'e' schema da verificare.
=== schema-forge [skills] === uscita: 2 | righe: 1
Nessuna cartella ...\fuori-albero\supabase\migrations: non c'e' schema da verificare.
=== vetrina-crafter [agenti] === uscita: 2 | righe: 1
Ne' docs/ ne' src/app/ in ...\fuori-albero: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.
=== vetrina-crafter [skills] === uscita: 2 | righe: 1
Ne' docs/ ne' src/app/ in ...\fuori-albero: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.
=== gestionale-crafter [agenti] === uscita: 2 | righe: 1
Nessuna cartella src/ in ...\fuori-albero: non c'e' gestionale da verificare.
=== gestionale-crafter [skills] === uscita: 2 | righe: 1
Nessuna cartella src/ in ...\fuori-albero: non c'e' gestionale da verificare.
=== flow-sentinel [agenti] === uscita: 2 | righe: 1
Ne' docs/ ne' e2e/ in ...\fuori-albero: non c'e' batteria da verificare (lancia il gate dalla radice del progetto).
=== flow-sentinel [skills] === uscita: 2 | righe: 1
Ne' docs/ ne' e2e/ in ...\fuori-albero: non c'e' batteria da verificare (lancia il gate dalla radice del progetto).
=== speed-demon [agenti] === uscita: 2 | righe: 1
Nessuna cartella docs/ in ...\fuori-albero: lancia il gate dalla radice del progetto.
=== speed-demon [skills] === uscita: 2 | righe: 1
Nessuna cartella docs/ in ...\fuori-albero: lancia il gate dalla radice del progetto.
```

**Dieci uscite su dieci: 2 col messaggio.** Il messaggio del canale junction è
identico, carattere per carattere, a quello del canale reale — non un messaggio
diverso: lo stesso gate che parla.

### I due gusci di audit, dalla junction

```
=== .claude\skills\gestionale-crafter\scripts\admin-audit.mjs === uscita: 2 | righe: 1
gestionale.config.json assente in ...\fuori-albero: l'audit non sa dove sia il gestionale.

=== .claude\skills\vetrina-crafter\scripts\vetrina-audit.mjs === uscita: 1 | righe: 8
AUDIT STATICO — .../fuori-albero

MANC  cucitura dei componenti
        vetrina.config.json assente: il gate non sa dove sia la radice pubblica, ne' quali siano le primitive della cucitura (comando `scaffold`)
MANC  chiavi e client dei dati
```

`vetrina-audit` esce **1** e non 2 perché il suo contratto è un altro (`0` solo
se tutti e tre i passi hanno guardato): l'asserzione che conta è **≠ 0 e
parla**, ed è rispettata.

### Gate della regia, dopo la correzione degli otto epiloghi

```
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
uscita reale del gate della regia: 0
```

Commit: `257e34d`.

---

## 2. L'`hint` di `epiloghi-vivi` prescrive la forma nuova

`scripts/regia-lib.mjs:158`. **La logica della regola non è stata toccata**:
`EPILOGO` è ancora la costante `import.meta.main`, `righeDiCodice` è intatta, il
confronto resta per sottostringa. Cambia solo il testo che il rilievo suggerisce
a chi lo legge — che fino a stamattina prescriveva la forma difettosa.

Il rilievo, stampato per davvero (`findingsEpiloghi` su una riga colpevole):

```
[block] agenti/x/scripts/verify.mjs:1
  → usa la guardia a **doppio confronto**: `const questo = fileURLToPath(import.meta.url), invocato = resolve(process.argv[1]);` poi `if (invocato === questo || realpathSync(invocato) === questo) await main();`, con `realpathSync` dentro un `try` che ricade sul testuale. Doppio perche' il solo confronto testuale e' FALSO quando lo script e' invocato dalla junction `.claude/skills/<skill>/...`: li' `argv[1]` resta il percorso della junction mentre `import.meta.url` e' gia' canonico, e lo script esce 0 muto esattamente come con `import.meta.main` (misurato il 2026-08-04 sui cinque gate, `PILOTA-PRE-2026-08-04.md` §2b)
```

Un test è stato aggiornato, ed è dentro il perimetro («i suoi test **se citano
la forma**»): `scripts/regia-lib.test.mjs`, il caso «NON scatta sul commento che
spiega perché non si usa». Citava la vecchia riga a confronto singolo
dichiarandola «la riga vera di tutte e cinque le skill» — da oggi non lo è più.
Ora cita l'epilogo vero di oggi, blocco compreso, e asserisce la stessa cosa di
prima. Gli altri quattro casi di `epiloghi-vivi` sono intatti.

### Nota misurata, dichiarata e non eseguita (la decide il direttore)

**Nessuna regola della regia pretende positivamente che l'epilogo esista.** La
regola `epiloghi-vivi` vieta un token: non chiede che una guardia ci sia. Chi
cancellasse l'ultima riga di un `verify.mjs` avrebbe un gate che non parte mai —
uscita 0 muta su **tutti** i canali — e il gate della regia resterebbe VERDE.

Non è una deduzione: è già scritto nella suite. `scripts/verifica-regia.test.mjs`
costruisce la sua regia finta con
`writeFileSync(join(radice, "agenti", "attrezzo", "scripts", "verify.mjs"), "// niente epilogo qui\n")`
(riga 98) e poi asserisce che i quattro passi non-`docx` **chiudono verdi**
(righe 120-125). Un file senza epilogo passa `epiloghi-vivi` oggi.

La contromisura per-skill c'è ed è il terzo test del §3 (il funzionale pretende
che il gate parli: se l'epilogo sparisce, non parla). Una regola **positiva** di
regia — «ogni `scripts/*.mjs` di casa che ha un `main()` deve avere una guardia
che lo chiami» — è un'altra storia, e non è stata scritta: fuori mandato.

Commit: `e6deb39`.

---

## 3. Il terzo test: funzionale-junction, sette script di skill

Il test crea una **junction vera** (`symlinkSync(SKILL_DIR, …, "junction")` — su
Windows non chiede privilegi), invoca lo script **attraverso** di essa con
`process.execPath`, `cwd` su una **seconda** cartella non-progetto, e asserisce
le due cose del funzionale: **uscita ≠ 0** e **output non vuoto**. Se la junction
non si crea, il test **fallisce** con un messaggio che lo dice — nessuno skip
silenzioso. Pulizia in `finally`.

Una cosa è stata **misurata prima di scriverla**, perché sbagliarla avrebbe
cancellato il sorgente di una skill: `rmSync(dir, { recursive: true })` su una
cartella che contiene una junction rimuove **la junction, non il suo bersaglio**.
Provato su Node 20.12.2 e su Node 24.18.1 con un bersaglio finto — bersaglio
vivo e coi suoi file dopo la rimozione. È scritto nel commento del `finally`.

| Test file | Script coperti | Test aggiunti |
|---|---|---|
| `agenti/schema-forge/scripts/verify.test.mjs` | `verify.mjs` | +1 (junction) |
| `agenti/gestionale-crafter/scripts/verify.test.mjs` | `verify.mjs` | +1 (junction) |
| `agenti/gestionale-crafter/scripts/admin-audit.test.mjs` | `admin-audit.mjs` | +1 (junction) |
| `agenti/flow-sentinel/scripts/verify.test.mjs` | `verify.mjs` | +1 (junction) |
| `agenti/speed-demon/scripts/verify.test.mjs` | `verify.mjs` | +1 (junction) |
| `agenti/vetrina-crafter/scripts/verify.test.mjs` | `verify.mjs` **e** `vetrina-audit.mjs` | +6 (la **terna** per ognuno) |

In ogni file il commento che diceva «i test sono **DUE** perché…» ora dice
**TRE**, con la terza voce e il perché: lo statico vieta un token che questo
difetto non contiene, il funzionale usa il percorso reale — canonico per
costruzione. **Solo il canale junction vede il canale junction.**

### Due scelte da dichiarare, perché non sono quelle che il mandato prescriveva

1. **A vetrina-crafter è stata data la terna intera, non il solo terzo test**
   (+6 invece di +2). Motivo: questa skill non aveva **nessuno** dei tre. A
   P.0-igiene non le fu dato niente perché il suo epilogo era già
   `resolve(argv[1]) === …` — era anzi *il modello* che l'`hint` citava. Il
   2026-08-04 quel modello è diventato il difetto. Lasciarle il solo test
   junction avrebbe significato: se domani qualcuno ci rimette `import.meta.main`,
   la batteria di vetrina-crafter passa e nessuno se ne accorge (lo statico non
   c'è, il funzionale su Node 24 non lo vede). Le altre quattro skill hanno tre
   protezioni; questa ne avrebbe avuta una.

2. **I test di `vetrina-audit.mjs` stanno in `verify.test.mjs`**, non in un
   `vetrina-audit.test.mjs` nuovo. Motivo, ed è un vincolo di perimetro, non un
   gusto: lo `npm test` di vetrina-crafter **elenca i file di test per esteso**
   nel suo `package.json` (il glob `scripts/**/*.test.mjs` non gira su Node 20,
   e questa macchina ha Node 20 di sistema — `STATO.md` §4, `SKILL.md`). Un file
   nuovo non elencato lì sarebbe una verifica **MANCANTE travestita da PASS**;
   elencarlo vorrebbe dire toccare `package.json` e la frase «i tre file» di
   `SKILL.md`, **fuori dal perimetro di questo mandato**. La casa giusta di quei
   due test resta un `vetrina-audit.test.mjs`: **la decide il direttore**,
   insieme alle due righe da aggiornare. È scritto anche nel commento del file.

### Batterie: prima → dopo (Node 24, `node --test "scripts/**/*.test.mjs"`)

| batteria | prima | dopo | delta | fail |
|---|---|---|---|---|
| schema-forge | 153 | **154** | +1 | 0 |
| vetrina-crafter | 177 | **183** | +6 | 0 |
| gestionale-crafter | 109 | **111** | +2 | 0 |
| flow-sentinel | 110 | **111** | +1 | 0 |
| speed-demon | 86 | **87** | +1 | 0 |
| regia | 46 | **46** | 0 | 0 |

Totale **+11**, nessuna regressione. La regia non cresce: `verifica-regia.mjs`
non ha canale junction, e i suoi test esistenti bastano (l'unico suo file
toccato è un test che citava la forma vecchia, §2).

Commit: `c96ae00`.

---

## 4. Il sabotaggio: il terzo test morde davvero

La domanda che rende il test non decorativo: **se il difetto tornasse, chi lo
vedrebbe?** Risposta misurata, non argomentata. La guardia vecchia è stata
rimessa in `agenti/schema-forge/scripts/verify.mjs` (una riga al posto del
blocco) e la batteria della skill è girata su **Node 24**, cioè nelle condizioni
più favorevoli al difetto — lì `import.meta.main` funzionerebbe e il funzionale
per percorso reale passa comunque:

```
✔ il gate parla anche fuori da un progetto: mai un'uscita 0 muta (53.915ms)
✔ il sorgente del gate non contiene `import.meta.main` (0.6014ms)
✖ il gate parla anche invocato dalla junction: e' il canale con cui lo vede un progetto (61.7467ms)
ℹ tests 53
ℹ pass 52
ℹ fail 1
✖ failing tests:
✖ il gate parla anche invocato dalla junction: e' il canale con cui lo vede un progetto
AssertionError [ERR_ASSERTION]: uscita 0 invocando il gate dalla junction: non ha guardato niente e sembra verde
```

**Cinquantadue verdi e un rosso, e il rosso è il terzo test.** Il funzionale
passa, lo statico passa: da soli avrebbero dichiarato sana una skill i cui gate
escono 0 muti sul canale con cui li vede un progetto.

Ripristino con `git checkout -- agenti/schema-forge/scripts/verify.mjs` (il
sabotaggio non è mai stato committato: l'albero era pulito prima e dopo), e
riverifica:

```
dopo il ripristino: uscita 0 :: tests 53 | pass 53 | fail 0
```

---

## 5. La prova §2d ripetuta dalla junction — l'attesa falsificabile ha tenuto

L'attesa dichiarata dal mandato: **identica al percorso reale**, perché
`SKILL_DIR` di speed-demon nasce da `import.meta.url`, canonico anche quando
l'invocazione non lo è — e da lì `AGENTI_DIR` e `GATE_FLUSSI`.

Fixture: cartella temporanea fuori dall'albero con dentro solo
`docs/flussi-critici.md` (è ciò che accende il passo `rete-verde`), `--url` su
una porta che non risponde. Node di sistema. Due canali, stessa cartella:

**Percorso reale** — `node <regia>\agenti\speed-demon\scripts\verify.mjs --url http://127.0.0.1:59999`:

```
GATE PERFORMANCE: ROSSO (2 falliti, 5 verifiche mancanti su 7 passi)

MANC  contratto delle pagine e delle soglie
        docs/performance.md assente: senza contratto non si sa quali pagine contano, e ottimizzare senza saperlo significa ottimizzare la home lasciando lenta la pagina che vende (comando `measure`)
FAIL  rete E2E di Flow Sentinel
        gate flussi: ROSSO (1 falliti, 6 mancanti su 7 passi)
MANC  build di produzione (non dev server)
        nessuna risposta da http://127.0.0.1:59999: avvia la build con `npm run build && npm run start` prima del gate
MANC  misura Lighthouse (mediana di N giri)
        nessuna pagina dichiarata da misurare
MANC  soglie dichiarate
        senza misura non ci sono soglie da confrontare
MANC  metatag nell'HTML servito
        senza contratto o senza app non c'e' HTML da leggere
FAIL  contratto d'uscita (handoff)
        [block] docs/handoff/<n>-speed-demon.md: handoff assente: chi viene dopo non sa cosa e' stato ottimizzato ne' a che prezzo (comando `handoff`)

Una verifica mancante non e' una verifica superata: il gate resta rosso.
uscita: 1
```

**Junction** — `node <regia>\.claude\skills\speed-demon\scripts\verify.mjs --url http://127.0.0.1:59999`:

```
GATE PERFORMANCE: ROSSO (2 falliti, 5 verifiche mancanti su 7 passi)

MANC  contratto delle pagine e delle soglie
        docs/performance.md assente: senza contratto non si sa quali pagine contano, e ottimizzare senza saperlo significa ottimizzare la home lasciando lenta la pagina che vende (comando `measure`)
FAIL  rete E2E di Flow Sentinel
        gate flussi: ROSSO (1 falliti, 6 mancanti su 7 passi)
MANC  build di produzione (non dev server)
        nessuna risposta da http://127.0.0.1:59999: avvia la build con `npm run build && npm run start` prima del gate
MANC  misura Lighthouse (mediana di N giri)
        nessuna pagina dichiarata da misurare
MANC  soglie dichiarate
        senza misura non ci sono soglie da confrontare
MANC  metatag nell'HTML servito
        senza contratto o senza app non c'e' HTML da leggere
FAIL  contratto d'uscita (handoff)
        [block] docs/handoff/<n>-speed-demon.md: handoff assente: chi viene dopo non sa cosa e' stato ottimizzato ne' a che prezzo (comando `handoff`)

Una verifica mancante non e' una verifica superata: il gate resta rosso.
uscita: 1
```

**Identiche riga per riga, `rete-verde` compreso.** `AGENTI_DIR` regge dalla
junction: la domanda che P.4-pre aveva lasciato «aperta e non misurabile» (§2d,
il gate non partiva) ora ha una risposta misurata, ed è **sì**.

Il sottoprocesso è stato eseguito davvero, non finto: flow-sentinel lanciato a
mano sulla stessa cartella dà gli stessi numeri, da **entrambi** i canali —

```
--- flow-sentinel DIRETTAMENTE, percorso reale ---   uscita: 1
GATE FLUSSI: ROSSO (1 falliti, 6 verifiche mancanti su 7 passi)
--- flow-sentinel DIRETTAMENTE, dalla junction ---   uscita: 1
GATE FLUSSI: ROSSO (1 falliti, 6 verifiche mancanti su 7 passi)
```

Una differenza dal verbale di P.4-pre, dichiarata per non farla passare per una
regressione: là §2d riportava «1 falliti, **5** mancanti», qui sono **6**. È la
fixture a essere diversa — la mia ha il solo `docs/flussi-critici.md`, la loro un
progetto più popolato. Ciò che questa prova confronta sono i **due canali fra
loro**, sulla **stessa** cartella, e lì la differenza è zero.

---

## 6. `STATO.md` e verifica finale

Nei cinque `STATO.md` il punto aperto del 2026-08-04 è **chiuso**: data, i tre
commit, la misura coi due canali e il messaggio incollato, e la caduta del
vincolo provvisorio di **D12** — da oggi i gate si lanciano da **entrambi** i
canali, junction compresa. Due chiusure dicono qualcosa in più:

- **speed-demon**: la domanda di P.4-pre su `AGENTI_DIR` non è più «aperta e non
  misurabile». È misurata, e la risposta è **regge** (§5).
- **vetrina-crafter**: sta scritto che fino a ieri il suo epilogo era *il
  modello* citato dall'`hint` — la forma giusta contro `import.meta.main` e falsa
  attraverso una junction. E che i suoi due gusci, che non avevano nessuno dei
  tre test, ora ne hanno tre a testa.

Corrette anche le righe dei conteggi, che il lavoro di oggi ha spostato:
154 / 183 / 111 / 111 / 87. Su vetrina-crafter la riga diceva **122**, il conto
di P1: era già indietro di due pacchetti, e il numero nuovo è **misurato**, non
stimato — è scritto lì.

### Verifica finale, dopo tutto

Cinque gate × due canali, node di sistema, cartella vuota fuori dall'albero:

```
schema-forge       [agenti] -> uscita 2 | righe 1     [skills] -> uscita 2 | righe 1
vetrina-crafter    [agenti] -> uscita 2 | righe 1     [skills] -> uscita 2 | righe 1
gestionale-crafter [agenti] -> uscita 2 | righe 1     [skills] -> uscita 2 | righe 1
flow-sentinel      [agenti] -> uscita 2 | righe 1     [skills] -> uscita 2 | righe 1
speed-demon        [agenti] -> uscita 2 | righe 1     [skills] -> uscita 2 | righe 1
```

Gate della regia: `uscita 0 :: GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)`.

Batterie (Node 24.18.1):

```
agenti\schema-forge       :: uscita 0 :: tests 154 | pass 154 | fail 0
agenti\vetrina-crafter    :: uscita 0 :: tests 183 | pass 183 | fail 0
agenti\gestionale-crafter :: uscita 0 :: tests 111 | pass 111 | fail 0
agenti\flow-sentinel      :: uscita 0 :: tests 111 | pass 111 | fail 0
agenti\speed-demon        :: uscita 0 :: tests  87 | pass  87 | fail 0
.                         :: uscita 0 :: tests  46 | pass  46 | fail 0
```

E il comando che elenca i file per esteso — quello che vetrina-crafter usa come
`npm test` — legge anche i sei test nuovi: `uscita 0 :: tests 183 | pass 183 |
fail 0`. La scelta di §3 punto 2 non lascia nulla di non eseguito.

---

## Cosa resta al direttore

1. **Una regola positiva di regia**, se la vuole: nessuna regola pretende che
   l'epilogo *esista* (§2). Oggi il buco è coperto solo per-skill.
2. **La casa dei due test di `vetrina-audit.mjs`**: stanno in `verify.test.mjs`
   per non toccare `package.json` e `SKILL.md`, fuori perimetro (§3 punto 2).
3. **La proposta a finzidev** su `code-maniac/scripts/tree.mjs:68` (§1), da
   inoltrare o cestinare.

---

P.0-igiene-2 consegnata. I cinque gate escono 2 col messaggio da entrambi i
canali, l'hint prescrive la forma a doppio confronto, il terzo test morde
(sabotaggio provato: 52 verdi e un rosso, ed è lui), il gate della regia è VERDE
5/5 e le batterie passano da 153/177/109/110/86/46 a 154/183/111/111/87/46 senza
regressioni.
