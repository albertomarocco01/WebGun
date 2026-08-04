# P.4-pre — Verbale della strada per il progetto pilota

> Eseguito il 2026-08-04 (sera) da una chat operaia, mandato
> `prompts/P4-pre-strada.md` + ripresa `prompts/P4-pre-ripresa.md`.
> Node dei gate: **20.12.2** (`C:\Program Files\nodejs\node.exe`, il node di
> sistema — è il punto: si prova come lo lancia un umano).
> HEAD all'inizio: `7eb736b`, albero pulito (solo `prompts/P4-pre-ripresa.md`
> non tracciato).

**In una riga: la strada esiste, ma ha una buca, e la buca sta esattamente dove
passerà P.4.** I cinque gate parlano da fuori dall'albero della regia; invocati
**dalla junction** escono **0 muti** tutti e cinque — e la junction è il modo in
cui una chat aperta sul repo pilota vede le skill.

---

## 1. `installa-skill.ps1` accetta `-Destinazione` — verificato in proprio

Chiuso e committato dalla chat precedente (`7eb736b`). Non l'ho dato per buono:
rilanciato qui, su una cartella che **non esisteva**.

```
> powershell -File scripts\installa-skill.ps1 -Destinazione <...>\finto-pilota\.claude\skills

destinazione: ...\finto-pilota\.claude\skills
sorgente:     C:\Users\Utente\Desktop\WebGun\agenti

INSTALLATA schema-forge
INSTALLATA gestionale-crafter
INSTALLATA vetrina-crafter
INSTALLATA flow-sentinel
INSTALLATA speed-demon
INSTALLATA code-inquisition
```

Junction **vere**, non cartelle (`Get-Item | Select LinkTarget`), e tutte
puntate alla regia — la fonte di verità non si è spostata:

```
Name                 LinkTarget
schema-forge         C:\Users\Utente\Desktop\WebGun\agenti\schema-forge
gestionale-crafter   C:\Users\Utente\Desktop\WebGun\agenti\gestionale-crafter
vetrina-crafter      C:\Users\Utente\Desktop\WebGun\agenti\vetrina-crafter
flow-sentinel        C:\Users\Utente\Desktop\WebGun\agenti\flow-sentinel
speed-demon          C:\Users\Utente\Desktop\WebGun\agenti\speed-demon
code-inquisition     C:\Users\Utente\Desktop\WebGun\agenti\code-inquisition
```

**Gate della regia, rilanciato da me col node di sistema:**

```
> node scripts\verifica-regia.mjs
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
OK  documento madre e copia di testo
OK  skill vere ed elenchi che le dichiarano
    scripts/installa-skill.ps1: schema-forge, gestionale-crafter, vetrina-crafter, flow-sentinel, speed-demon, code-inquisition
OK  STATO.md di ogni agente di casa
OK  epiloghi degli script di casa
OK  segnaposto nei documenti di radice
--- uscita: 0 ---
```

`skill-elencate` legge ancora l'elenco: **VERDE 5/5**, il parametro non ha
spezzato la lettura dell'array.

---

## 2. I cinque gate da fuori dall'albero — metà misura è verde, metà è rossa

### 2a. Per percorso reale: 5 su 5 escono **2 con il messaggio**

Cartella **vuota** fuori da `WebGun/`
(`...\scratchpad\fuori-albero`, 0 elementi), comando
`node C:\Users\Utente\Desktop\WebGun\agenti\<skill>\scripts\verify.mjs`:

| gate | uscita | righe | messaggio |
|---|---|---|---|
| schema-forge | **2** | 1 | `Nessuna cartella <cwd>\supabase\migrations: non c'e' schema da verificare.` |
| gestionale-crafter | **2** | 1 | `Nessuna cartella src/ in <cwd>: non c'e' gestionale da verificare.` |
| vetrina-crafter | **2** | 1 | `Ne' docs/ ne' src/app/ in <cwd>: qui non c'e' un progetto Web Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.` |
| flow-sentinel | **2** | 1 | `Ne' docs/ ne' e2e/ in <cwd>: non c'e' batteria da verificare (lancia il gate dalla radice del progetto).` |
| speed-demon | **2** | 1 | `Nessuna cartella docs/ in <cwd>: lancia il gate dalla radice del progetto.` |

Nessun `0` muto. La separazione `SKILL_DIR` (da `import.meta.url`) / `process.cwd()`
regge fuori dall'albero — non più «letto nel codice»: misurato.

### 2b. Dalla junction: 5 su 5 escono **0 muti** — difetto vero

Stessa cartella vuota, stesso node, unica differenza il percorso di invocazione
`C:\...\WebGun\.claude\skills\<skill>\scripts\verify.mjs`:

```
=============== schema-forge (junction) ===         uscita: 0 | righe: 0
=============== gestionale-crafter (junction) ===   uscita: 0 | righe: 0
=============== vetrina-crafter (junction) ===      uscita: 0 | righe: 0
=============== flow-sentinel (junction) ===        uscita: 0 | righe: 0
=============== speed-demon (junction) ===          uscita: 0 | righe: 0
```

**Non è un difetto di speed-demon: è di tutti e cinque i gate.** È la stessa
classe di regressione che P.0-igiene ha chiuso — uscita 0 senza righe, che chi
legge il codice d'uscita scambia per un verde — riaperta da un canale che
P.0-igiene non copriva: **l'invocazione attraverso la junction**.

**Causa, misurata e non dedotta.** L'epilogo dei cinque gate è la forma che la
regola `epiloghi-vivi` del gate della regia **prescrive** (`scripts/regia-lib.mjs`,
campo `hint`):

```js
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
```

I due lati del confronto, stampati mentre il gate veniva invocato dalla junction:

```
argv[1] risolto  : C:\Users\Utente\Desktop\WebGun\.claude\skills\speed-demon\scripts\verify.mjs
import.meta.url  : C:\Users\Utente\Desktop\WebGun\agenti\speed-demon\scripts\verify.mjs
realpath della junction: C:\Users\Utente\Desktop\WebGun\agenti\speed-demon\scripts\verify.mjs
```

`resolve(argv[1])` **non** risolve la junction, `import.meta.url` **sì** (Node
canonicalizza i moduli). I due percorsi differiscono, la guardia è falsa, `main()`
non gira, il processo esce 0 senza stampare. La regola `epiloghi-vivi` cerca
`import.meta.main` nelle righe di codice e non ha modo di accorgersi di questo:
il suo passo è **OK** mentre i cinque gate sono muti su un canale reale.

### 2c. Il caso d'uso di P.4, misurato: è quello che si rompe

Non è una curiosità di laboratorio. Nel **finto repo pilota** (fuori dalla regia,
skill installate col deliverable 1), stessa cartella e stesso gate, due percorsi:

```
> cd <finto-pilota>
> node .claude\skills\schema-forge\scripts\verify.mjs
--- uscita: 0 | righe: 0 ---

> node .claude\skills\speed-demon\scripts\verify.mjs
--- uscita: 0 | righe: 0 ---

> node C:\Users\Utente\Desktop\WebGun\agenti\schema-forge\scripts\verify.mjs
--- uscita: 2 | righe: 1 ---
Nessuna cartella <finto-pilota>\supabase\migrations: non c'e' schema da verificare.
```

Una chat operaia aperta sul pilota vede le skill **in `.claude/skills`**: è da lì
che il percorso viene naturale, ed è il percorso muto.

### 2d. `AGENTI_DIR` di speed-demon: la domanda del mandato ha una risposta diversa da quella attesa

Il mandato chiedeva se speed-demon **si rompe** dalla junction per via di
`AGENTI_DIR = dirname(SKILL_DIR)`. Risposta misurata: **non ci arriva**. Il gate
non parte affatto (§2b), quindi il passo `rete-verde` non viene mai eseguito e
`AGENTI_DIR` non viene mai usato. La domanda su `AGENTI_DIR` resta **aperta e non
misurabile** finché l'epilogo non è corretto.

Quello che invece è stato misurato: **dal percorso reale `AGENTI_DIR` regge**. Su
un progetto con `docs/flussi-critici.md`, il passo `rete-verde` ha davvero lanciato
il gate di flow-sentinel come sottoprocesso e ne ha letto il JSON —

```
FAIL  rete E2E di Flow Sentinel
        gate flussi: ROSSO (1 falliti, 5 mancanti su 7 passi)
```

— numeri identici a quelli dell'esecuzione diretta di flow-sentinel sulla stessa
cartella (`GATE FLUSSI: ROSSO (1 falliti, 5 verifiche mancanti su 7 passi)`). Il
sottoprocesso è stato trovato ed eseguito.

### Non corretto, come prescritto

Nessuna riga di codice toccata: **la correzione la decide il direttore**. Per
quando deciderà, la forma che regge su entrambi i canali è un `realpathSync` sul
lato `argv[1]` del confronto — e va cambiata **anche nel `hint` della regola
`epiloghi-vivi`**, che oggi prescrive la forma difettosa a chiunque la legga.
Cinque gate, un `hint`, un punto negli `STATO.md`.

---

## 3. La firma di una persona vera passa i tre gate che la leggono

Cartella usa e getta, due varianti degli stessi tre contratti minimi. Nessun banco
acceso: per provare una riga di firma non serve un database.

Riga provata, quella del §4 del piano:

```
Confermato da: Alberto Marocco (committente) il 2026-08-05
```

*(la data è quella prescritta dal mandato — il giorno della firma vera, non quello
di questa prova)*

**Direzione 1 — accettata da tutti e tre**, letto nell'uscita e non presunto:

```
vetrina-crafter   OK  contratto della vetrina
                        1 pagine · 0 slot · confermato da: Alberto Marocco (committente) il 2026-08-05
flow-sentinel     OK  contratto dei flussi critici
                        1 flussi (1 positivo) — confermati da: Alberto Marocco (committente) il 2026-08-05
speed-demon       OK  contratto delle pagine e delle soglie
                        1 pagine · form factor: mobile · deroghe scritte: 0
                        confermato da: Alberto Marocco (committente) il 2026-08-05
```

I tre gate restano rossi per il resto (nessun progetto sotto: niente build, niente
spec, niente handoff) — è atteso, e il passo che conta è **quello**, che è verde.

**La data, per vetrina-crafter**, letta dal testo e non dal filesystem:

```
firma vera   dataConfermaDa -> "2026-08-05"  |  confermatoDa -> "Alberto Marocco (committente) il 2026-08-05"
segnaposto   dataConfermaDa -> null          |  confermatoDa -> null
```

**Direzione 2 — il segnaposto del template è rifiutato da tutti e tre.** Stessi
contratti, sostituita la sola riga di firma col segnaposto di ciascun template:

```
vetrina-crafter   MANC  contratto della vetrina
                        docs/vetrina.md senza riga `Confermato da:` leggibile: un elenco non confermato
                        non e' un contratto. Il segnaposto del template non e' una firma
flow-sentinel     MANC  contratto dei flussi critici
                        docs/flussi-critici.md senza riga `Confermato da:`: un elenco non confermato non e'
                        un contratto — chi ha deciso che questi sono i flussi critici?
speed-demon       FAIL  contratto delle pagine e delle soglie
                        [block] docs/performance.md: manca la riga `Confermato da:` (o e' rimasto il
                        segnaposto del template) …
```

Il difetto storico — gate che rifiutava `Alberto Marocco, sviluppatore` e accettava
`ORCHESTRATORE` — **non si ripresenta**. Provato, non dedotto.

---

## 4. Porte del pilota e banchi

### Le due porte: **57621** (API) e **57622** (database)

Scelte come blocco `576xx`, il successivo ai tre già presi: vetcare `573xx`,
controtempo `574xx`, valscura `575xx`. **Anche da spenti quei numeri restano
prenotati nei rispettivi `config.toml`** e non vanno riusati:

| banco | api | db | shadow | studio | inbucket | analytics |
|---|---|---|---|---|---|---|
| vetcare | 57321 | 57322 | 57320 | 57323 | 57324 | 57327 |
| controtempo | 57421 | 57422 | 54320 | 57423 | 57424 | 57427 |
| valscura | 57521 | 57522 | 57520 | 57523 | 57524 | 57527 |
| **pilota (fissato qui)** | **57621** | **57622** | 57620 | 57623 | 57624 | 57627 |

Verificate libere, non «sembrano libere»:

```
> Test-NetConnection 127.0.0.1 -Port 57621  → TcpTestSucceeded: False
> Test-NetConnection 127.0.0.1 -Port 57622  → TcpTestSucceeded: False

blocco intero 57620-57629: 57620 libera · 57621 libera · 57622 libera · 57623 libera
  · 57624 libera · 57625 libera · 57626 libera · 57627 libera · 57628 libera · 57629 libera

Get-NetTCPConnection -State Listen, porte 57300-57699 → NESSUNO
netstat -ano | :573xx|:574xx|:575xx|:576xx        → nessuna riga
porta 3100 (l'app dei template)                    → libera
```

**Il blocco intero è verificato, non solo le due porte**: uno stack Supabase ne
consuma sette, e fissarne due lasciando le altre al caso è come il precedente del
2026-07-30 con un passo in meno.

### Banchi: tutti e tre spenti, con i dati salvi

Nessuno da spegnere: erano già spenti prima di questo pacchetto.

```
> docker ps
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

**Docker Desktop non è nemmeno in esecuzione**, e nessuna porta dei tre banchi ha
un listener (sopra). Spenti il 2026-08-04 con `supabase stop --project-id <nome>`,
cioè **con backup**: i dati restano nei volumi e `supabase start` li riprende.

**Perché sono spenti, e perché non vanno riaccesi per distrazione:** il
2026-08-04 i tre banchi accesi insieme (trenta container, ~1,2 GB per stack) hanno
saturato il commit di questa macchina da 16 GB — tetto 21,6 GB, margine residuo
1,1 GB — e Windows ha ucciso le finestre dell'IDE (`0xE0000008`). **P.4e misurerà
tempi su questa macchina, e li misurerebbe male.** Da tenere acceso **un solo
banco alla volta**.

Esiste ora `C:\Users\Utente\.wslconfig`: WSL limitato a **5 GB** con
`autoMemoryReclaim=gradual` (prima teneva 3 GB anche a container fermi senza mai
restituirli). Se un giorno un `supabase start` morisse per memoria, il colpevole è
quel tetto: si alza lì, consapevolmente, non si toglie.

---

## 5. Cosa resta al direttore

1. **Decidere sull'epilogo dei cinque gate** (§2b). È l'unico punto che P.4a
   erediterebbe: finché è così, chi lavora sul pilota deve lanciare i gate
   **per percorso assoluto dentro la regia**, mai dalla junction — e questo va
   detto nel mandato di P.4a, perché nessun gate lo dirà.
2. `AGENTI_DIR` di speed-demon dalla junction resta **non misurabile** finché il
   punto 1 è aperto (§2d).
3. La contabilità di `CANTIERE.md` (riga P.4-pre): non scritta qui, come prescritto.

---

P.4-pre consegnata. La strada esiste: `installa-skill.ps1` accetta `-Destinazione`
(gate regia VERDE 5/5, junction vere verso `WebGun/agenti/`), i cinque gate escono
**2 col messaggio** da fuori dall'albero **per percorso reale** — ma **dalla
junction escono 0 muti tutti e cinque**, non solo speed-demon, ed è la regressione
di P.0-igiene riaperta dal canale che il repo pilota userà per primo (non corretta:
decide il direttore; di speed-demon non si è potuto misurare `AGENTI_DIR`, perché
il gate non arriva mai a usarlo). La firma di Alberto passa i tre gate che la
leggono e il segnaposto no, in tutte e due le direzioni, con la data letta dal
testo. Porte del pilota **57621/57622** libere, blocco `57620-57629` libero,
tre banchi spenti con backup e Docker fermo.
