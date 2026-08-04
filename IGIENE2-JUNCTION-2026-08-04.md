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
