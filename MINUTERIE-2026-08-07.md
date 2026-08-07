# MINUTERIE — 2026-08-07 (P.7f)

Quattro residui misurati, nessuno grande, tutti della stessa famiglia:
**documentazione o premessa che mente**. Qui c'è, per ognuno, la prova prima
(incollata), la correzione, la prova dopo (incollata). Tre chiudono, uno chiude
a metà e la metà che resta ha un nome e un proprietario.

Macchina: Windows 11, Node di sistema `v20.12.2`, Node di scoop `v24.18.1`,
semgrep `1.172.0`. Regia a `270ee81` all'inizio.

---

## Indice degli esiti

| # | Cosa | Esito |
|---|---|---|
| 1 | `HOWTORUN.md`: due skill collaudate dichiarate «da creare» | **chiuso** — gate regia VERDE 5/5 |
| 2 | `banco.mjs`: la premessa della build fuori dall'elenco stampato | **chiuso** — secondo banco da zero VERDE 9/9, batteria 162 → 167 |
| 3 | Il semgrep che il collaudo vide e P.5-P3 no | **chiuso, RIPRODOTTO** — `--config=auto`, 2 rilievi, gli stessi due |
| 4 | La voce «contrasti» del certificato del pilota | **chiuso per la mia metà** — la voce è riscritta e misurata; il rilievo del gate **non è togliibile dal mio perimetro** (§4.5) |

---

## 1. `HOWTORUN.md` — le due righe che mentivano

### Prova prima

`HOWTORUN.md`, righe 123-135 alla regia `270ee81`:

```
## FASE 5 — Sicurezza e conformità

14. 🔵 **Cyber Shield**
   Specializzato in cybersecurity: verifica vulnerabilità, permessi, esposizione di dati e configurazioni pericolose prima della messa online.
15. 🔵 **Site Doctor**
   Scanner pre-produzione di conformità: cookie/GDPR e privacy, accessibilità (alt, contrasti, HTML semantico), Open Graph per le anteprime social, hreflang multilingua, favicon, robots.txt e sitemap. In pratica: il certificato di idoneità del sito prima del lancio.

## FASE 6 — Lancio e vendita

16. 🔵 **Launchpad**
   Deployment 1-click su Vercel/Cloudflare con DNS, domini e certificati SSL. L'ultimo miglio: dal codice al sito online.
17. 🟢 **DemonIAc**
   Genera automaticamente video demo con Remotion da mostrare alle aziende. Opzionale nella pipeline: serve per vendere il risultato, non per costruirlo.
```

La legenda del documento (riga 6-9) dice: **🔵 BLU = da creare**. Le due skill
esistono, sono installate dalla `installa-skill.ps1`, hanno un gate ciascuna e
sono state collaudate in chat vergine. Il gate della regia lo sapeva già — il
passo `skill-elencate` le legge da README e dallo script d'installazione e le
trova entrambe:

```
OK    skill vere ed elenchi che le dichiarano
        scripts/installa-skill.ps1: schema-forge, gestionale-crafter, vetrina-crafter, flow-sentinel, speed-demon, launchpad, site-doctor, code-inquisition
        README.md §Installazione: schema-forge, gestionale-crafter, vetrina-crafter, flow-sentinel, speed-demon, launchpad, site-doctor, code-inquisition
```

Il gate guarda README e `installa-skill.ps1`, **non HOWTORUN**: è il motivo per
cui quelle due righe hanno potuto mentire con tutti i verdi accesi.

### Correzione

Le due voci passano a **🟢** e prendono la forma piena delle altre skill di
casa già verdi (flow-sentinel n°12, speed-demon n°13): **Cosa fa** in un
paragrafo, **Prerequisiti**, **Come si installa**, **Come si usa / lancia** coi
comandi e i loro **STOP**, il gate a mano, i verbali. Il resto del documento non
è stato toccato.

Due cose che non erano scritte da nessuna parte in questo documento e che ci ho
messo perché sono il **prezzo dichiarato** di ognuna delle due skill:

- il gate di **site-doctor non misura i contrasti** — non apre nessun browser,
  e lo dice la sua stessa `SKILL.md`: *«Il prezzo è che i contrasti non li
  misura, e infatti sono delegati a chi apre un browser»*;
- **launchpad non ha mai eseguito un deploy.** Nessun account, nessun dominio,
  nessun record DNS, nessun centesimo. Una skill verde che non ha mai fatto la
  cosa per cui esiste va letta sapendolo, e il suo `STATO.md` lo dice in tre
  punti diversi.

### Prova dopo

```
$ node scripts/verifica-regia.mjs
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
repo: C:/Users/Utente/Desktop/WebGun

OK    documento madre e copia di testo
OK    skill vere ed elenchi che le dichiarano
OK    STATO.md di ogni agente di casa
OK    epiloghi degli script di casa
OK    segnaposto nei documenti di radice
        11 documenti letti: CANTIERE.md, CLAUDE.md, DECISIONI.md, HOWTORUN.md, …
        nessun rilievo
```

**VERDE 5/5.** Il passo `skill-elencate` è rimasto verde, come previsto: se
fosse diventato rosso avrei toccato qualcosa che non era mio.

Commit: `ffd8e21`.

---

## 2. `banco.mjs` — la premessa entra dove la si legge

### Prova prima

Rigenerato il banco in una cartella temporanea fuori dal repo e seguiti **alla
lettera e soltanto** i passi stampati.

```
$ node agenti/launchpad/scripts/banco.mjs --dove <tmp>/banco-lp --porta 3183
Banco scritto in …\scratchpad\banco-lp
Remoto locale in  …\scratchpad\banco-launchpad-remoto.git  (una cartella, non un servizio: qui non si pubblica niente)

Restano TRE passi, che questo script non fa e non finge di aver fatto:

  1.  cd …\banco-lp && npm install
      git add package-lock.json && git commit -m "Il lockfile"   ← il gate lo pretende TRACCIATO
  2.  node <skill>/scripts/impronta.mjs --scrivi
      git add next.config.ts && git commit -m "L'impronta dell'artefatto"
      node <skill>/scripts/banco.mjs --contratti --dove …\banco-lp --porta 3183
  3.  npm run build && npx next start -p 3183

Poi il gate:  node <skill>/scripts/verify.mjs --url http://127.0.0.1:3183
Atteso: VERDE 9/9.
```

Passo 1 e passo 2: nessun problema. Passo 3:

```
$ npm run build
   ▲ Next.js 15.5.23
   Creating an optimized production build ...
 ✓ Compiled successfully in 6.1s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/7) ...
Error occurred prerendering page "/prenota". Read more: https://nextjs.org/docs/messages/prerender-error
Error: supabaseUrl is required.
    at <unknown> (…\.next\server\app\prenota\page.js:24:57375)
    at new c4 (…\.next\server\app\prenota\page.js:24:57626)
    at c6 (…\.next\server\app\prenota\page.js:24:62943)
    at stringify (<anonymous>) {
  digest: '546204099'
}
Export encountered an error on /prenota/page: /prenota, exiting the build.
 ⨯ Next.js build worker exited with code: 1 and signal: null
=== exit: 1 ===
```

**Riprodotta identica** a quella della direzione. Poi, sulla stessa cartella,
con le due variabili impostate:

```
$ export NEXT_PUBLIC_SUPABASE_URL="https://banco.supabase.invalid"
$ export NEXT_PUBLIC_SUPABASE_ANON_KEY="chiave-anonima-finta-del-banco"
$ npm run build
 ✓ Generating static pages (7/7)
=== exit: 0 ===
```

### La diagnosi, e perché non era colpa del lettore

`src/app/prenota/page.tsx` del banco è `export const dynamic = "force-static"`
e costruisce il client Supabase nel corpo della pagina: il client si costruisce
**durante la build**, non a runtime. Le due `NEXT_PUBLIC_*` sono quindi una
**premessa del passo 3**, non configurazione di esercizio.

Erano dichiarate — in `docs/deploy.md` («prima della build», tabella delle
variabili) e in `.env.example` — cioè in **due file che il banco produce** e che
chi segue l'elenco stampato non ha ancora nessun motivo di aprire. Una premessa
vera scritta dove nessuno la legge è una premessa non dichiarata: il difetto era
nell'elenco, non nel lettore.

### Correzione — la forma scelta, e perché

Scelta mia, come da mandato: **un passo 0**, dentro l'elenco numerato, prima del
passo che ci casca. Le alternative erano un blocco di testo prima dell'elenco
(che chi segue una lista numerata salta) e una riga dentro il passo 3 (che
arriva tardi, quando la shell è già quella sbagliata). La riga di testata è
passata da *«Restano TRE passi»* a *«Restano TRE passi e UNA PREMESSA»*: i passi
restano tre, e la premessa è nominata per quello che è.

Il passo 3 porta un rimando di quattro parole — `← senza il passo 0 cade qui` —
e `--contratti` ripete le due righe, perché è l'altro punto da cui si arriva
alla build.

**Valori dichiaratamente finti.** `https://banco.supabase.invalid` usa il
dominio riservato di RFC 2606: non risolve per costruzione. Un esempio che
*somigliasse* a un progetto vero (`https://abcdefgh.supabase.co`) sarebbe stato
peggio di nessun esempio — chi lo copia non sa di aver copiato un segnaposto.
La build passa lo stesso perché `supabase-js` non contatta niente mentre
costruisce il client, e la lettura torna `{ data: null }` che la pagina rende
come lista vuota: misurato, 7 pagine su 7 prerenderizzate, exit 0.

**Nessun `.env.local` scritto in silenzio.** Sarebbe stata una riga di codice in
meno e un file di configurazione comparso dal nulla nel progetto di qualcun
altro: la classe di difetto che questa skill misura negli altri, fatta in casa.
Il motivo sta scritto nel codice, accanto alla funzione.

### Prova dopo (a) — secondo banco, da zero, seguendo solo le istruzioni nuove

```
Restano TRE passi e UNA PREMESSA, che questo script non fa e non finge di aver fatto:

  0.  LA PREMESSA DELLA BUILD — due variabili, o il passo 3 cade.
      `/prenota` e' `force-static`: il client Supabase si costruisce DURANTE
      la build. Senza queste due, `npm run build` esce 1 con
      `Error: supabaseUrl is required.` sul prerender di /prenota.
      I valori sono DICHIARATAMENTE FINTI (`.invalid` non risolve, RFC 2606):
      qui non si parla con nessun Supabase, e la pagina rende una lista vuota.
      Questo script NON scrive nessun `.env.local`: un file di configurazione
      comparso in silenzio e' il difetto che questa skill misura negli altri.

        bash / Git Bash:
          export NEXT_PUBLIC_SUPABASE_URL="https://banco.supabase.invalid"
          export NEXT_PUBLIC_SUPABASE_ANON_KEY="chiave-anonima-finta-del-banco"

        PowerShell:
          $env:NEXT_PUBLIC_SUPABASE_URL = "https://banco.supabase.invalid"
          $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "chiave-anonima-finta-del-banco"

      Valgono per la SHELL, non per la cartella: se apri un altro terminale
      fra il passo 1 e il passo 3, vanno riesportate li'.

  1.  cd …\secondo\banco-lp2 && npm install
      git add package-lock.json && git commit -m "Il lockfile"   ← il gate lo pretende TRACCIATO
  2.  node <skill>/scripts/impronta.mjs --scrivi
      git add next.config.ts && git commit -m "L'impronta dell'artefatto"
      node <skill>/scripts/banco.mjs --contratti --dove …\secondo\banco-lp2 --porta 3183
  3.  npm run build && npx next start -p 3183          ← senza il passo 0 cade qui

Poi il gate:  node <skill>/scripts/verify.mjs --url http://127.0.0.1:3183
Atteso: VERDE 9/9.
```

Seguito alla lettera, cartella nuova, `npm install` vero:

```
$ npm run build
 ✓ Generating static pages (7/7)
=== exit build: 0 ===

$ npx next start -p 3183
$ node <skill>/scripts/verify.mjs --url http://127.0.0.1:3183

GATE LAUNCHPAD: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)
progetto: …\secondo\banco-lp2

OK    si pubblica un commit, non un working tree
OK    verdetti dichiarati dagli agenti a monte
OK    bloccanti dichiarati nel registro del debito
OK    nessun segreto nel repository, e la storia non ne porta
OK    variabili d'ambiente dichiarate e non committate
OK    la build si rifa' uguale su un'altra macchina
OK    l'impronta dell'artefatto e' derivata dal commit
OK    runbook firmato da un umano, sul contenuto
OK    contratto d'uscita (handoff)

Il gate e' verde. NON e' il permesso di pubblicare: e' la condizione necessaria.
=== exit: 0 ===
```

**VERDE 9/9.**

### Prova dopo (b) — il test che tiene l'output

`agenti/launchpad/scripts/banco.test.mjs`, cinque test, dichiarati in
`package.json` (launchpad elenca i file di test uno per uno: un file non
elencato esiste e non gira mai).

I test **eseguono lo script vero** in una cartella temporanea e guardano il suo
`stdout`. Un regex sul sorgente sarebbe verde anche se il nome della variabile
vivesse solo dentro un commento, o in un ramo che non si esegue mai.

```
$ npm test
1..167
# tests 167
# pass 167
# fail 0
```

**Batteria 162 → 167, zero falliti** (era 162 prima, misurata all'inizio di
questa chat).

Sabotaggio, per provare che i test hanno denti — tolto
`NEXT_PUBLIC_SUPABASE_URL` **dalle sole righe stampate**, lasciando tutto il
resto (il nome resta in `.env.example`, in `public.ts` e nel commento):

```
$ node --test scripts/banco.test.mjs
not ok 1 - l'elenco stampato nomina le due NEXT_PUBLIC_* che la build pretende
not ok 2 - la premessa sta PRIMA del passo che ci casca, non dopo
ok 3 - i valori d'esempio sono dichiaratamente finti, e la falsita' e' scritta accanto
ok 4 - nessun `.env.local` compare nel progetto senza che nessuno l'abbia scritto
ok 5 - il banco non lascia niente fuori dalla cartella che gli si e' indicata
# pass 3
# fail 2
```

Ripristinato: 5 su 5 verdi.

### Un difetto mio, preso dal test alla sua prima esecuzione

Il test n°2 ancorava l'ordine sulla **prima** occorrenza di `npm run build`. Ma
la premessa stessa nomina quel comando mentre spiega perché cade: la premessa si
confrontava con se stessa, e il test è nato rosso con

```
la premessa e' stampata DOPO `npm run build` (premessa a 963, build a 514)
```

Ancora corretta sulla **riga del passo 3** (`/^ {2}3\. {2}npm run build/m`), col
perché scritto accanto. È il tipo di errore che un test scritto bene trova
addosso a chi lo scrive, ed è per questo che sta qui invece che essere
cancellato in silenzio.

### Guardiani sul codice cambiato

| Strumento | Esito |
|---|---|
| `npm test` | **167**, 0 falliti |
| ESLint su `banco.mjs` + `banco.test.mjs` | **0 rilievi** |
| ESLint su tutto `scripts/` | 0 errori, 13 warning — **tutti preesistenti** (complessità in `gate-lib.mjs`, `segreti-lib.mjs`, `verify.mjs`), nessuno nei due file nuovi |
| knip | pulito |
| jscpd | 4 cloni, 24 righe (**0,49%**) — gli stessi quattro di P.5-P3, nessuno mio |
| gitleaks | `no leaks found` (315 KB scansionati) |
| semgrep | vedi §3 |

**Nota di macchina, misurata:** `jscpd` **non gira sotto Node 20** — muore con
`ERR_REQUIRE_ESM` su `commander`. Sotto il Node 24 di scoop gira. È lo stesso
genere di trappola della nota su Lighthouse: lo strumento c'è, l'interprete no.

### Pulizia

Cartelle temporanee cancellate (entrambe, più i due remoti nudi), porta 3183
liberata e verificata:

```
ucciso PID 27856
porta 3183 libera
```

Nessun file nuovo nel repo fuori dal perimetro. Commit: `b7ea449`.

---

## 3. Il semgrep che il collaudo vide e P.5-P3 no

### Prova prima — le due dichiarazioni in disaccordo

`agenti/launchpad/COLLAUDO-2026-08-06.md:428` e `:443`:

```
semgrep      2 rilievi                              (erano 3)
```
```
- **2 rilievi semgrep**, entrambi `detect-non-literal-regexp`, entrambi con la
  motivazione scritta **accanto alla riga** (precedente della §8): in
  `gate-lib.mjs` l'etichetta arriva solo dai sette letterali dei chiamanti; in
  `impronta.mjs` il nome della variabile esportata viene da un gruppo di cattura
  ancorato a `[A-Za-z_$][\w$]*` e non può contenere metacaratteri.
```

`agenti/launchpad/P5-P3-2026-08-06.md:462` e `:487`:

```
semgrep      p/javascript + p/security-audit + p/eslint-plugin-security: 0 rilievi
```
```
- **semgrep: 0 rilievi, e non combacia con i 2 del collaudo.** […] Con i tre
  ruleset che ho lanciato quella regola non gira, e non so nominare quello che
  il collaudo aveva usato: **non è un rilievo chiuso, è un rilievo che non ho
  saputo rimisurare.**
```

L'indizio era negli atti del vicino, `agenti/site-doctor/COLLAUDO-2026-08-06.md:426`:

```
$ semgrep --config=auto scripts
5 Code Findings — tutti `detect-non-literal-regexp`
```

### Il lavoro — l'elenco esatto di ciò che ho lanciato

Tutto da `agenti/launchpad/`, semgrep `1.172.0`:

| Comando | Regole | File | Rilievi |
|---|---|---|---|
| `semgrep --config=auto scripts` | 200 | 13 | **2** |
| `semgrep --config=p/nodejs scripts` | 36 | 12 | 0 |
| `semgrep --config=p/javascript --config=p/security-audit --config=p/eslint-plugin-security scripts` | 83 | 13 | 0 |

### Esito: **RIPRODOTTO**

```
$ semgrep --config=auto scripts
 • Rules run: 200
 • Targets scanned: 13
Ran 200 rules on 13 files: 2 findings.

┌─────────────────┐
│ 2 Code Findings │
└─────────────────┘

    scripts\gate-lib.mjs
    ❯❱ javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          ❰❰ Blocking ❱❱
          RegExp() called with a `etichetta` function argument […]
          705┆ senzaZoneCitate(testo).match(new RegExp(`^[ \\t>*_-]*${etichetta}[ \\t*_]*:[ \\t*_]*(.+)$`, "im"))?.[1]

    scripts\impronta.mjs
    ❯❱ javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          ❰❰ Blocking ❱❱
          RegExp() called with a `testo` function argument […]
          210┆ const dichiarazione = new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${nome}\\s*(?::[^=]+)?=\\s*\\{`);
```

Stessi due file, stesse due righe, stessa regola del collaudo.

**Perché le due chat non combaciavano.** La regola
`javascript.lang.security.audit.detect-non-literal-regexp` **non è in nessuno
dei quattro pacchetti nominati** che ho provato: `p/nodejs` ne gira 36, i tre di
P.5-P3 ne girano 83 in tutto, e in nessuno dei due insiemi c'è. `auto` ne gira
200 e la contiene. Nessuna delle due chat aveva sbagliato: **un conteggio di
semgrep senza il ruleset accanto non è confrontabile con niente**, ed è la
lezione che vale più del numero.

### Le due esenzioni, rilette

**`impronta.mjs:210` — regge.** `nome` viene dal gruppo di cattura
`([A-Za-z_$][\w$]*)` due righe sopra (riga 202): è un identificatore
JavaScript, quindi non può portare metacaratteri. L'ancora è ancora quella.

**`gate-lib.mjs:705` (`riga1`) — regge, e il commento contava male.**
L'esenzione diceva: *«`etichetta` arriva solo dai **sette** letterali dei
chiamanti qui sotto»*. Verificato:

```
$ grep -rn "riga1" scripts/
scripts/gate-lib.mjs:758:    provider: riga1(pulito, "Provider"),
scripts/gate-lib.mjs:759:    dominio: riga1(pulito, "Dominio"),
scripts/gate-lib.mjs:760:    runtimeProvider: riga1(pulito, "Runtime del provider"),
scripts/gate-lib.mjs:761:    commitApprovato: riga1(pulito, "Commit approvato"),
scripts/gate-lib.mjs:762:    modoDeploy: riga1(pulito, "Modo di deploy"),
scripts/gate-lib.mjs:763:    radiciSpedite: (riga1(pulito, "Radici spedite") ?? "")
scripts/gate-lib.mjs:765:    versionePrecedente: riga1(pulito, "Versione precedente"),
scripts/gate-lib.mjs:766:    confermatoDa: riga1(pulito, "Confermato da"),

$ grep -c "riga1(pulito" scripts/gate-lib.mjs
8

$ grep -n "^export.*riga1" scripts/gate-lib.mjs     # (vuoto: non esportata)
$ grep -rn "riga1" scripts/*.test.mjs verify.mjs    # (vuoto: nessuno la chiama da fuori)
```

Sono **otto**, tutti letterali, e siccome `riga1` non è esportata e nessun test
la chiama, quegli otto sono l'elenco **completo e chiuso**: nessuna `etichetta`
può venire dal documento. **L'esenzione regge; il suo conteggio no.** Un'esenzione
che conta male le proprie premesse è un'esenzione che nessuno ha ricontrollato.

Corretto, col numero, la data e la ragione. Entrambi i commenti ora **nominano
il ruleset** sotto cui il rilievo compare: chi rilancia semgrep e non lo vede sa
che ha lanciato un'altra cosa.

Solo commenti: batteria **167 prima e dopo**, zero falliti.

Commit: `a1454cf`.

---

## 4. La voce «contrasti» del certificato del pilota

### Prova prima — il grep che la voce stessa prescriveva

La voce diceva: *«si tolgono **rilanciando il `grep`** nella regia, mai leggendo
questa frase»*. Rilanciato, regia al commit **`a1454cf`**, `contrast` in
`agenti/speed-demon/` esclusi i test:

```
$ grep -rl -i "contrast" agenti/speed-demon/ --exclude-dir=node_modules | grep -v "\.test\."
agenti/speed-demon/scripts/gate-lib.mjs
agenti/speed-demon/scripts/verify.mjs
agenti/speed-demon/SKILL.md
agenti/speed-demon/STATO.md

$ … | wc -l
4
```

**4 file**, dove alla regia `d147f52` erano **0**. `gate-lib.mjs` esporta
`letturaContrasto`, `esitoContrasto`, `findingsContrasto`, `statoContrasto`,
`dettaglioContrasto`; `verify.mjs` ha un passo `id: "contrasto"`.

E il gate del vicino rilanciato, non letto (dalla radice del pilota, sulla
build viva alla 3621, `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`
perché Lighthouse vuole Node 22+):

```
GATE PERFORMANCE: VERDE (0 falliti, 0 verifiche mancanti su 8 passi)

OK    contratto delle pagine e delle soglie
OK    rete E2E di Flow Sentinel
OK    build di produzione (non dev server)
        http://127.0.0.1:3621 (HTTP 200) · build id 05cf64463d2086e3da963d6d9cb9b5f77a9e54de
OK    misura Lighthouse (mediana di N giri)
OK    soglie dichiarate
OK    contrasto del testo (audit color-contrast)
        5 pagine · 5 col contrasto verificato · 0 con elementi insufficienti · 0 senza testo da confrontare
OK    metatag nell'HTML servito
OK    contratto d'uscita (handoff)
```

**Il passo esiste, ed è verde.** Chrome orfani dopo il gate (registro n°57):
`nessun chrome orfano` — la trappola non è scattata questa volta. App del pilota
ancora viva: `3621 → 200`.

E il gate di site-doctor **prima** della correzione:

```
GATE CONFORMITA': VERDE (0 falliti, 0 verifiche mancanti, 1 non applicabili su 14 passi)

OK    proprieta' delle voci di conformita'
        16 righe in tabella contro 12 passi eseguiti · 3 voci scoperte
        0 bloccanti, 3 da guardare, 0 righe fuori elenco
          [issue] contrasti: delegata a speed-demon, e il suo GATE non la guarda: misurato il 2026-08-06 sulla regia a `d147f52`: la parola «contrast» non compare in NESSUN file di `agenti/speed-demon/` (grep, 0 file). …
          [issue] accessibilita-admin: …
          [issue] antispam: SCOPERTA: nessuno la guarda. …
```

### Correzione

La voce `contrasti` di `docs/conformita.md` riscritta: delega **piena** a
speed-demon, con il grep (data, commit `a1454cf`, i quattro file) e il gate del
vicino rilanciato con il suo esito. La riga della tabella di proprietà —
`| contrasti | speed-demon | docs/handoff/13-speed-demon.md | delegato |` — non
è stata toccata: era già giusta.

Nessun altro file del pilota è stato toccato. Il gate **non** ha preteso
l'handoff 16 aggiornato: il passo `contratto d'uscita (handoff)` è verde prima e
dopo, quindi non l'ho toccato.

### Prova dopo — e il conteggio che NON è sceso

```
GATE CONFORMITA': VERDE (0 falliti, 0 verifiche mancanti, 1 non applicabili su 14 passi)

OK    proprieta' delle voci di conformita'
        16 righe in tabella contro 12 passi eseguiti · 3 voci scoperte
        0 bloccanti, 3 da guardare, 0 righe fuori elenco
          [issue] contrasti: delegata a speed-demon, e il suo GATE non la guarda: … `d147f52` … (grep, 0 file) …
          [issue] accessibilita-admin: …
          [issue] antispam: …
```

**Il mandato si aspettava «3 da guardare» → «2 da guardare». Non succede, e non
può succedere da questo perimetro.** Ecco il perché, misurato.

Il testo di quel rilievo **non viene dal certificato**. Viene da una costante
nel codice della skill:

```
$ grep -rn "RILANCIANDO IL GREP|d147f52" agenti/site-doctor/scripts/*.mjs
agenti/site-doctor/scripts/conformita-lib.mjs:70:  "misurato il 2026-08-06 sulla regia a `d147f52`: la parola «contrast» non compare in NESSUN file di `agenti/speed-demon/` (grep, 0 file). …"

$ grep -rn "RILANCIANDO IL GREP|d147f52" fornodoro/docs/*.md
docs/conformita.md:281:> `d147f52`, che è la data giusta della misura sbagliata   ← solo la prosa, non il rilievo
```

`conformita-lib.mjs:86` dichiara
`{ id: "contrasti", …, scoperta: SCOPERTE.contrasti }`, e il ramo che lo emette
(riga 499) è **incondizionato**:

```js
    // Il file citato esiste e la nomina: fin qui la delega e' in regola. Ma
    // «nominata in un documento» e «guardata da un gate» sono due cose, e la
    // seconda si legge nel codice del vicino invece che nella sua prosa.
    if (voce.scoperta) {
      findings.push({
        severity: "issue",
        object: voce.id,
        message: `delegata a ${proprietario}, e il suo GATE non la guarda: ${voce.scoperta}. …`,
      });
    }
```

Scatta ogni volta che la voce è delegata a un file che esiste e la nomina —
**qualunque cosa dica il certificato**. L'unico modo di spegnerlo scrivendo qui
sarebbe **rompere la delega**: togliere la riga dalla tabella, o farla puntare a
un file che non nomina la voce. Sarebbe peggiorare il certificato per abbassare
un conteggio, e produrrebbe per giunta un `block` al posto di un `issue`.
**Non si fa, e non l'ho fatto.**

Si toglie in regia, con **una riga**: la voce `contrasti` di `SCOPERTE`
(`conformita-lib.mjs:70`) e il `scoperta:` che la richiama in `VOCI` (riga 86).
Quel file è `agenti/site-doctor/**`, **il perimetro di P.6-P4**, che il mio
mandato mi vieta esplicitamente. E il commento sopra quella costante prescrive
esattamente la prova che serve:

> *«Si toglie una riga da qui il giorno in cui il vicino aggiunge il passo, e la
> si toglie **rilanciando il `grep`**, non fidandosi di un handoff.»*

**Il grep è stato rilanciato. L'esito è 4 file dove erano 0, e il gate del
vicino è verde sul passo che li legge.** La prova che quella riga aspettava
adesso esiste ed è scritta in due posti: qui e nel certificato del pilota.
Manca solo la mano che possiede il file.

Commit nel pilota: `5043bd9`, un solo file.

### 4.5 — Il gate di launchpad sul pilota: **ROSSO 4, non 3**

Il mandato dice: *«deve dire ancora ROSSO 3 (segreti · runbook · handoff) — se
dice altro, fermati e scrivilo nel verbale, non "sistemarlo"»*. Dice altro.

```
GATE LAUNCHPAD: ROSSO (4 falliti, 0 verifiche mancanti su 9 passi)
progetto: C:\Users\Utente\Desktop\fornodoro

OK    si pubblica un commit, non un working tree
OK    verdetti dichiarati dagli agenti a monte
OK    bloccanti dichiarati nel registro del debito
FAIL  nessun segreto nel pacchetto che parte
OK    variabili d'ambiente dichiarate e non committate
OK    la build si rifa' uguale su un'altra macchina
FAIL  l'impronta dell'artefatto e' derivata dal commit
FAIL  runbook firmato da un umano, sul contenuto
FAIL  contratto d'uscita (handoff)
```

I tre attesi ci sono tutti. **Il quarto è `impronta-artefatto`, ed è mio:**

```
FAIL  l'impronta dell'artefatto e' derivata dal commit
        impronta attesa dal commit di HEAD: `5043bd90c3e7` · `.next/BUILD_ID`: `05cf64463d2086e3da963d6d9cb9b5f77a9e54de`
        [block] .next/BUILD_ID: l'artefatto sul disco porta `05cf64463d2086e3da963d6d9cb9b5f77a9e54de`, il commit di HEAD e' `5043bd90c3e7`
        [block] http://127.0.0.1:3621: non porta l'impronta attesa `5043bd90c3e7` (serve `05cf64463d2086e3da963d6d9cb9b5f77a9e54de`)
```

Prova che è il mio commit e non altro:

```
$ cat .next/BUILD_ID
05cf64463d2086e3da963d6d9cb9b5f77a9e54de
$ git rev-parse HEAD~1
05cf64463d2086e3da963d6d9cb9b5f77a9e54de      ← identici: la build servita È il commit prima del mio
$ git rev-parse HEAD
5043bd90c3e7f9bb0fd9a9fe2dcb1b9b7719ea4c
$ git show --stat --oneline HEAD
5043bd9 La voce «contrasti» aveva prescritto la propria cura: il grep, rilanciato
 docs/conformita.md | 83 ++++++++++++++++++-----
 1 file changed, 66 insertions(+), 17 deletions(-)
```

L'app viva alla 3621 è stata costruita a `05cf644`; il mio commit ha portato
HEAD a `5043bd9` **senza ricostruire**, perché il mandato lo vietava
espressamente (*«l'app sulla 3621 è viva — non ricostruirla se risponde»*).

**Non è un guasto: è il passo che fa il suo mestiere.** `impronta-artefatto`
esiste per dire «l'artefatto che stai per spedire non è il commit che hai
approvato», e lo sta dicendo di una differenza vera. Le tre condizioni del
mandato — *committa nel pilota*, *non ricostruire*, *launchpad resti ROSSO 3* —
non possono valere tutte e tre insieme: **qualunque** commit nel pilota fa
scattare questo passo finché nessuno ricostruisce.

**Non l'ho sistemato**, e non andava sistemato da me: non un `npm run build`,
non un revert. Si chiude ricostruendo e riservendo l'app — che è una decisione
di chi possiede il pilota, ed è a costo basso perché il commit tocca un solo
file di documentazione.

---

## Cosa resta MANCANTE, col suo nome

1. **`SCOPERTE.contrasti` in `agenti/site-doctor/scripts/conformita-lib.mjs:70`
   (più il `scoperta:` a riga 86).** È la riga che tiene il gate di site-doctor
   a «3 da guardare» invece di 2. **Di P.6-P4**, che lavora in quel perimetro
   mentre scrivo. La prova che quella riga aspetta — il grep rilanciato, 4 file
   dove erano 0, e il gate di speed-demon verde sul passo `contrasto` — è
   misurata e scritta sia qui sia nel certificato del pilota. *Non è un rilievo
   aperto: è un rilievo pronto per chi possiede il file.*

2. **Il gate di launchpad sul pilota è ROSSO 4, e il quarto è mio** (§4.5).
   `impronta-artefatto` fallisce perché HEAD è avanzato di un commit di sola
   documentazione senza che l'app sia stata ricostruita. Si chiude con
   `npm run build` e il riavvio sulla 3621. **Di chi possiede il pilota**, e
   deliberatamente non fatto qui.

3. **Il certificato del pilota dice ancora «Erano otto alle 22, sono quattro
   adesso»** (`docs/conformita.md:259`), ma il gate ne conta **tre** —
   `dati-strutturati` è tornata a casa con D21 e non è più segnalata. È un
   numero stantio in una sezione che **non è la voce `contrasti`**, cioè fuori
   dal mio perimetro di scrittura su quel file. Non l'ho toccato apposta: è di
   chi riemetterà il certificato. *Misurato, non dedotto: il passo
   `proprieta' delle voci` stampa «3 voci scoperte» e le nomina tutte e tre.*

4. **Che il banco corretto regga su una macchina che non sia questa.** I due
   banchi li ho costruiti io, sullo stesso disco, con lo stesso Node 24 di
   scoop. La premessa stampata è misurata; che sia *sufficiente* altrove — per
   esempio dove un DNS dirotta gli errori e `.invalid` risolve — non è provato.

5. **Il conteggio semgrep di partenza del collaudo.**
   `COLLAUDO-2026-08-06.md:428` dice `semgrep 2 rilievi (erano 3)`. Ho
   riprodotto i **2**, non i 3 di partenza: quel terzo apparteneva a uno stato
   del codice che non esiste più, e non l'ho cercato. Non era nel mandato, e lo
   scrivo perché il numero è lì e qualcuno lo confronterà.

---

## Chiusura

| Cosa | Esito |
|---|---|
| Gate della regia | **VERDE 5/5** |
| Batteria launchpad | **167**, 0 falliti (era 162) |
| Gate di site-doctor sul pilota | **VERDE** — 0 falliti, 0 mancanti, 1 n/a su 14 passi |
| Gate di speed-demon sul pilota | **VERDE 8/8** |
| Gate di launchpad sul pilota | **ROSSO 4** — tre attesi, il quarto è §4.5 |
| Deploy eseguiti | **nessuno** |
| `git push` | **nessuno** |
| Stack Supabase | quello del pilota, acceso, non toccato |
| Porte lasciate occupate | nessuna (3183 liberata; la 3621 è del pilota e resta) |
| Chrome orfani | nessuno |
| Cartelle temporanee | cancellate |

Commit di questa chat — regia: `ffd8e21` · `b7ea449` · `a1454cf` · questo
verbale. Pilota: `5043bd9`.
