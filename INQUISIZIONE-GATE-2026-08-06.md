# Referto — `/code-inquisition` sugli script delle quattro skill storiche

> **P.7c punto 4** (mandato `prompts/P7c-guardiani-arretrati.md`, ripresa-2 `prompts/P7c-ripresa2.md`).
> Data: **2026-08-06**. Bersaglio: `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/scripts`
> — 10 852 righe (5 981 non-test), Node ESM puro, zero dipendenze a runtime.
> Invocazione: `/code-inquisition <i quattro scripts/> --focus security,reliability --depth 2 --allow-exec`.

## La riga che conta

**Quarantaquattro rilievi, e nessuno degli strumenti deterministici della casa ne vedeva uno.**
Nello stesso giorno, sugli stessi file: ESLint **0 rilievi** su quattro skill, semgrep **0 findings**
sui tredici file dove vivono i difetti (le sue 25 segnalazioni stanno altrove), gitleaks **nessun
segreto** nei quattro gate, batterie **465 test verdi su 465**. Il punto 4 di questo pacchetto non è
un doppione dei punti 3 e 5: è la prova che la batteria deterministica e il tribunale **guardano cose
diverse**, e che la prima, da sola, dichiarava puliti quattro gate che possono essere resi verdi da un
progetto che non lo merita.

Il difetto più grave è di una specie che questa casa conosce e che nessuno aveva ancora nominato: non
un gate che sbaglia il verdetto, ma **un gate che si può convincere**. `where`/`which` cercano
l'eseguibile **anche nella directory corrente**, e la directory corrente è il progetto auditato.

## Come è stato condotto, e cosa vale

| | |
|---|---|
| Struttura | **Depth 2**: due concili paralleli (Sicurezza · Affidabilità), 7 esperti, 2 modelli diversi per de-correlare gli errori |
| Critico del roster | 1, prima di spawnare: ha trovato **un buco vero** (nessun esperto copriva la *terminazione*) → nato l'esperto B4, che ha prodotto tre HIGH |
| Cancello di verifica | **2 verificatori**, uno per concilio, nessuno dei quali aveva scritto i rilievi che certificava; hanno rifatto le misure e assegnato loro i tag |
| Esecuzione | `--allow-exec`: batterie, ESLint, semgrep e gitleaks rilanciati **dal verificatore**, non ereditati |
| Giri di dibattito | **1 di 3.** Dichiarato, non nascosto: dopo il cancello di verifica non restavano verdetti in conflitto sui Critical/High, e i due concili si sono confermati a vicenda su un rilievo (§ *La conferma incrociata*) |
| Vincoli rispettati | nessuno stack Supabase acceso o spento (D17: l'unico acceso è del pilota, di P.4g); nessun gate lanciato contro un banco; nessun file del repo modificato dagli agenti (`git status` pulito a fine turno di ognuno) |

**Il limite di questo referto, dichiarato**: nessun rilievo è stato provato **su un Postgres vivo**.
Dove serviva un database (lo slittamento dei campi di `psql`, lo stallo di `db reset`) le prove sono
state fatte sulle librerie pure alimentate con l'input ostile, e il residuo è marcato `HYPOTHESIS`.

## La conferma incrociata (l'unica che vale)

Il protocollo dice che due istanze dello stesso modello che annuiscono non sono una conferma. Qui
**un rilievo è stato trovato due volte da due concili che non si vedevano**, per due strade diverse:
l'esperto A3 partendo da «quale input del cliente rompe il parsing», l'esperto B2 partendo da «quale
uscita di strumento leggo male». È lo slittamento dei campi di `psql` (**A3-2 / B2-3**). Nessun altro
rilievo ha avuto una doppia paternità: gli altri stanno tutti dentro un solo mandato, e quindi valgono
per la loro prova, non per un consenso.

## I rilievi per gravità

### CRITICAL

#### 1. `where`/`which` risolvono l'eseguibile **anche dalla directory corrente**, che è il progetto auditato — e questo forgia il verde (A1-1)

`agenti/schema-forge/scripts/verify.mjs:83` · `gestionale-crafter/scripts/verify.mjs:89` ·
`flow-sentinel/scripts/verify.mjs:102` · `speed-demon/scripts/verify.mjs:93`

```
$ cd <scratch>/finto-progetto && printf '@echo off\r\necho SONO-IO-IL-FALSO\r\n' > supabase.cmd
$ where supabase
C:\...\scratchpad\finto-progetto\supabase.cmd      <-- il falso, per primo
C:\Users\Utente\scoop\shims\supabase.exe
```

I gate si lanciano **dalla radice del progetto generato** (lo prescrive il `CLAUDE.md`), `PROJECT =
process.cwd()`, e `dove()` non passa `cwd`: la ricerca eredita la radice del progetto. Un progetto che
contenga `supabase.exe`, `node.exe`, `psql.exe` o `npx.cmd` nella propria radice ottiene esecuzione di
codice — e, quel che è peggio qui, **rende verdi i passi**: un finto `supabase` che esca 0 su
`--version` porta a casa `db-reset`, `db-lint`, `db-advisors`, `pgtap` e `tipi`; un finto `node` che
stampi `{"summary":{"block":0,...},"findings":[]}` porta a casa l'audit RLS. **Sei passi su nove**,
compreso quello che la skill chiama «il controllo che non può mancare».

**Quattro tentativi di smentita, tutti falliti** (il verificatore li ha provati uno per uno):
`NoDefaultCurrentDirectoryInExePath` non tocca `where.exe`; la preferenza per `.exe` di
gestionale-crafter non è una difesa geografica (il falso `.exe` nella CWD vince lo stesso);
`formaEseguibile` fa **un solo** controllo (`/\.(cmd|bat)$/i`) e non rifiuta nessun percorso; la CWD è
davvero quella del progetto in tutti e quattro.

La correzione esiste già, in **una riga di produzione in tutto il repo**:
`gestionale-crafter/scripts/verify.mjs:215` lancia il proprio audit con `process.execPath`.

> **Nota di cantiere.** Mentre questo audit girava, la chat di **launchpad** ha committato
> `5636373 §5.9: interprete o PATH — a questo gate non serve nessuno dei due, misurato`: sta chiudendo
> per conto suo la stessa classe di difetto su un gate nuovo. Le due strade vanno riconciliate.

#### 2. Un flusso critico dichiarato può non essere mai eseguito, e il gate dei flussi resta VERDE 7/7 (B1-1)

*(verdetto del verificatore B in coda, § Tabella del concilio Affidabilità)*

### HIGH

*(sezione compilata dopo il cancello di verifica del concilio Affidabilità)*

### MEDIUM · LOW

*(idem)*

## Copertura: cosa è stato guardato e dichiarato pulito

La contabilità dei falsi negativi è parte del referto quanto i rilievi. Dichiarati **puliti dopo
ispezione**, con il dove:

- **Aggregazione del verdetto** (concilio B, classe 3): tutti e 30 i passi dei quattro gate registrano
  il proprio esito su **ogni** ramo d'uscita; `verdetto()` è `fail === 0 && skipped === 0` in tutti e
  quattro, senza filtri per gravità né `slice`. Nessuna via per cui un passo rosso non alzi l'uscita.
- **`shell: true`**: zero occorrenze nel codice (grep esaustivo). Il problema è un altro, ed è A1-7.
- **Iniezione SQL** verso `psql`: `rls-audit.mjs` convalida i nomi di schema con `^[a-z_][a-z0-9_]*$`
  prima di interpolarli; le due query di flow-sentinel raddoppiano gli apici. Nessuna via d'uscita
  trovata.
- **Segreti diversi dal `--db-url`**: nessuna chiave Supabase, token o password compare in nessuna
  interpolazione dei quattro gate.
- **Script npm del progetto**: nessuno dei quattro gate invoca `npm run` né uno script di
  `package.json`, quindi un `postinstall` ostile non parte dal gate.
- **`JSON.parse` sull'uscita degli strumenti**: ogni punto è dentro `try/catch` con ricaduta a
  `skipped`, mai a `pass`.
- **Ritentativi**: `conRitentativo` ritenta una volta sola, solo `db reset`, e dichiara «riuscito al
  secondo tentativo» **anche sul verde**.
- **Encoding e CRLF**: gestiti sistematicamente (`pulisci`, `senzaBom`); nessun verdetto dipende dal
  confronto di caratteri non-ASCII.
- **Epilogo dei gate** (`import.meta.main`): chiuso su tutti e quattro più `admin-audit.mjs`, con
  `realpathSync` e ricaduta testuale.
