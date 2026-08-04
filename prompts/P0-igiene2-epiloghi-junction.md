# Mandato P.0-igiene-2 — I gate parlano anche dalla junction

> Emesso dal direttore dei lavori il 2026-08-04 (sera). Da incollare in una chat
> operaia nuova, aperta da terminale esterno nella radice
> `C:\Users\Utente\Desktop\WebGun`.
> **Modello consigliato: Opus 5 · effort max** (D4: si riscrive la forma che una
> regola della regia prescrive — è scrittura di regole, non minuteria).
> Contabilità: `CANTIERE.md`, riga **P.0-igiene-2**, decisione **D12**.

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. P.4-pre ha
misurato (verbale `PILOTA-PRE-2026-08-04.md` §2b) che **tutti e cinque i gate
escono `0` senza stampare una riga** se invocati dalla junction
(`.claude/skills/<skill>/scripts/verify.mjs`), mentre per percorso reale escono
`2` col messaggio. Il direttore ha riprodotto la misura in proprio prima di
emettere questo mandato. È la regressione che P.0-igiene aveva chiuso, riaperta
da un canale che P.0-igiene non copriva — e la junction è esattamente il canale
con cui una chat aperta sul repo di un progetto generato vede le skill (D11).
Tu la chiudi, su tutti i canali, e pianti il test che le impedisce di tornare.

## La causa, già misurata — non ri-diagnosticare: verifica e correggi

Nell'epilogo prescritto dal campo `hint` della regola `epiloghi-vivi`
(`scripts/regia-lib.mjs`, ~riga 158):

```js
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
```

`resolve()` normalizza il percorso ma **non scioglie la junction**;
`import.meta.url` è già canonico (Node canonicalizza i moduli che carica).
Invocato dalla junction i due lati differiscono, la guardia è falsa, `main()`
non gira, uscita 0 muta. La forma difettosa è **proprio quella che l'`hint`
prescrive**: per questo il mandato tocca anche la regola.

## Regola operativa (recidiva due volte in P.7c: ora è legge)

- **Un commit per punto chiuso**, appena l'esito c'è.
- Le righe di `STATO.md` nascono **nello stesso commit** del punto.
- Verbale scritto **man mano**, non in coda. Se senti che la corsa si ferma:
  commit di quello che c'è, subito, con `WIP` nel titolo.

## Leggi prima

1. `PILOTA-PRE-2026-08-04.md` §2 (le misure) e la sezione junction dello
   `STATO.md` di schema-forge (~righe 1060-1082: causa e vincolo provvisorio).
2. `scripts/regia-lib.mjs` righe ~139-163 (`EPILOGO`, `findingsEpiloghi`,
   `hint`) e i suoi test (`scripts/regia-lib.test.mjs`, describe
   `epiloghi-vivi`; `scripts/verifica-regia.test.mjs` ~41, ~66-71, ~143-150).
3. La coppia di test di P.0-igiene in
   `agenti/schema-forge/scripts/verify.test.mjs` ~469-520: il
   commento-motivazione spiega perché i test sono **due** e perché nessuno dei
   due basta. Tu ne aggiungi un **terzo**, e il motivo è simmetrico.
4. `CANTIERE.md`: riga P.0-igiene-2 e decisione D12.

## Deliverable

### 1. La guardia impara la junction — otto siti

I siti, dall'istruttoria del direttore (verifica i numeri di riga: il repo può
essersi mosso). L'epilogo è **l'ultima cosa di ogni file** e tale resta:

| File | Riga | Chiamata |
|---|---|---|
| `agenti/schema-forge/scripts/verify.mjs` | 656 | `main();` |
| `agenti/vetrina-crafter/scripts/verify.mjs` | 682 | `await main();` |
| `agenti/gestionale-crafter/scripts/verify.mjs` | 435 | `main();` |
| `agenti/gestionale-crafter/scripts/admin-audit.mjs` | 218 | `main();` |
| `agenti/flow-sentinel/scripts/verify.mjs` | 462 | `await main();` |
| `agenti/speed-demon/scripts/verify.mjs` | 553 | `await main();` |
| `agenti/vetrina-crafter/scripts/vetrina-audit.mjs` | 295 | `main();` |
| `scripts/verifica-regia.mjs` | 375 | `main();` |

La forma nuova, uguale ovunque (`await` dove `main` è `async`; `realpathSync`
si importa da `node:fs`, estendendo l'import esistente):

```js
// [le righe esistenti del commento su `import.meta.main` e Node 20/24 restano,
//  comprese le varianti per-file come quella di admin-audit]
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e il gate usciva 0 muto (misurato il 2026-08-04,
// P.4-pre, PILOTA-PRE-2026-08-04.md §2b). `realpathSync` scioglie la junction;
// se solleva si ricade sul confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) await main();
}
```

Due vincoli: **niente refactor oltre la guardia** (il perimetro è l'epilogo,
non il gate), e il blocco resta staccato da `main()` da una riga vuota, ultima
cosa del file.

Un **non-sito**, dichiarato: `agenti/code-maniac/scripts/tree.mjs:68` porta una
forma ancora più fragile (operandi invertiti, niente `resolve`), ma è
**snapshot esterno** (rotta n°5): non si tocca. Nel verbale scrivi la riga di
proposta per finzidev.

### 2. L'`hint` di `epiloghi-vivi` prescrive la forma nuova

`scripts/regia-lib.mjs`: aggiorna l'`hint` alla forma a doppio confronto (la
versione compatta che preferisci, col perché in una riga). **Non cambiare la
logica della regola** — `EPILOGO`, `righeDiCodice`, il confronto per
sottostringa: il suo compito resta vietare `import.meta.main`, e i suoi test
devono passare intatti (aggiornali solo se citano l'`hint` alla lettera).

Nota per il verbale, misurata dall'istruttoria, da **dichiarare senza
eseguire** (la decide il direttore): nessuna regola della regia pretende
*positivamente* che l'epilogo esista — uno script che perde del tutto la
guardia passa `epiloghi-vivi`. La contromisura per-skill è il tuo terzo test;
l'eventuale regola positiva di regia è un'altra storia.

### 3. Il terzo test: funzionale-junction, sette script di skill

Accanto alla coppia di P.0-igiene, nei file di test che coprono i sette script
di skill (i cinque `verify.mjs`, `admin-audit.mjs`, `vetrina-audit.mjs`):

- cartella temporanea con dentro **una junction vera** alla cartella della
  skill: `symlinkSync(SKILL_DIR_REALE, join(tmp, "skill"), "junction")` — su
  Windows le junction non chiedono privilegi;
- spawn di `process.execPath` sul percorso **attraverso la junction**
  (`join(tmp, "skill", "scripts", "<script>.mjs")`), `cwd` una seconda
  cartella non-progetto;
- le stesse due asserzioni del funzionale: **uscita ≠ 0** e **output non
  vuoto**. Se la creazione della junction solleva, il test **fallisce** con un
  messaggio chiaro — MANCANTE ≠ PASS, mai uno skip silenzioso;
- pulizia in `finally`.

Perché tre test, da scrivere nel commento come fa la coppia esistente: lo
statico vieta `import.meta.main` — questo difetto non contiene quel token,
quindi lo statico è cieco; il funzionale usa il percorso reale
(`new URL("./verify.mjs", import.meta.url)`) — canonico per costruzione, cieco
anche lui. **Solo il canale junction vede il canale junction.**

`verifica-regia.mjs` non ha canale junction (nessuna junction punta a
`scripts/` della regia): lì la forma si allinea per coerenza con l'`hint`, i
test esistenti bastano.

### 4. Prove, incollate nel verbale

Col **node di sistema** (`node`, 20.12.2), da una cartella vuota fuori
dall'albero della regia:

- i **cinque gate × due canali** (junction e percorso reale): dieci uscite,
  tutte **2 col messaggio** — incollate, non riassunte (lezione del collaudo
  di P.4-pre: le tabelle a frecce non sono uscite);
- `admin-audit.mjs` e `vetrina-audit.mjs` dalla junction: parlano — uscita e
  prime righe incollate;
- gate della regia `node scripts/verifica-regia.mjs`: **VERDE 5/5 prima e
  dopo**, uscite incollate;
- batterie delle cinque skill e della regia con Node 24
  (`~/scoop/apps/nodejs-lts/current/node.exe`): numeri **prima e dopo**
  dichiarati (i test nuovi alzano i conteggi: di' di quanto, per skill);
- **sabotaggio**: reintroduci la guardia vecchia in una skill → su Node 24
  statico e funzionale passano e **solo il test junction fallisce** — è la
  dimostrazione che il terzo test non è decorativo. Ripristina e dillo;
- la prova §2d del PILOTA-PRE ripetuta **dalla junction** (speed-demon,
  `rete-verde` che lancia il gate di flow-sentinel come sottoprocesso).
  Attesa falsificabile: **identica al percorso reale**, perché `SKILL_DIR`
  nasce da `import.meta.url`, che è canonico anche quando l'invocazione non lo
  è. Se non è così, fermati e scrivi cosa hai misurato: quella correzione la
  decide il direttore.

### 5. STATO.md e verbale

- Nei cinque `STATO.md`: il punto aperto del 2026-08-04 diventa **chiuso** —
  data, commit, misura — e la riga «i gate si lanciano per percorso assoluto»
  si aggiorna: da oggi parlano da entrambi i canali.
- Verbale **`IGIENE2-JUNCTION-2026-08-<gg>.md`** alla radice della regia:
  per punto, comando e uscita incollata.

## Perimetro (D8)

- **Scrivi solo**: gli otto file della tabella, i loro file di test,
  `scripts/regia-lib.mjs` (l'`hint`) e i suoi test se citano la forma, i
  cinque `STATO.md`, il verbale.
- **Non toccare**: `CANTIERE.md`, `prompts/`, `Web Gun.docx` /
  `webgun_content.txt`, i banchi `banco-prova-*`, gli stack Docker/Supabase
  (restano spenti: per queste prove non servono), gli snapshot esterni
  (code-maniac, code-inquisition, bugbay).
- Commit **solo dei tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.
- Gate col node di sistema; batterie con Node 24.

## Riga finale del verbale

`P.0-igiene-2 consegnata. I cinque gate escono 2 col messaggio da entrambi i
canali, l'hint prescrive la forma a doppio confronto, il terzo test morde
(sabotaggio provato), il gate della regia è VERDE 5/5 e le batterie passano da
<prima> a <dopo> senza regressioni.` — o la verità, se è un'altra.
