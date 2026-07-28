# La verifica deterministica

Legge n°2: **il browser è il giudice, non l'LLM**. Una spec "sembra giusta" solo finché non gira davvero, contro un'app accesa e un database seedato. Perciò il gate non parte dall'esito: **prima misura la premessa** — il contratto dei flussi c'è ed è confermato, le spec esistono e sono contate, l'app risponde, il database del progetto è raggiungibile e ha dentro qualcosa. Dove la premessa manca il passo è una **verifica mancante**, mai un `pass`: un verde su niente è peggio di un rosso, perché viene creduto.

Il gate è `scripts/verify.mjs`; le regole pure stanno in `scripts/gate-lib.mjs` e hanno i loro test (`gate-lib.test.mjs`, `verify.test.mjs`).

```bash
# dalla radice del PROGETTO generato, non da qui
node <skill>/scripts/verify.mjs                 # riepilogo per umani
node <skill>/scripts/verify.mjs --json          # il contratto per l'orchestratore
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3000 --db-url postgresql://…
```

## La pipeline

L'**ordine di questa tabella è il gate**: un passo spostato più avanti cambia cosa il gate aveva guardato nel momento in cui ha deciso. `verify.test.mjs` blocca gli id e il loro ordine.

| # | `id` | Cosa misura come PREMESSA | Cosa legge come ESITO | Se la premessa manca |
|---|---|---|---|---|
| 1 | `flussi-critici` | `docs/flussi-critici.md` esiste, contiene una riga `Confermato da:`, dichiara almeno un flusso nella forma ``## `<id>` — <tipo>`` | tipi ammessi (`positivo`, `ostile-lettura`, `ostile-scrittura`) e id mai ripetuti; il dettaglio stampa quanti flussi per tipo e **chi** li ha confermati | MANCANTE — «*assente: non c'e' contratto da coprire*», «*senza riga `Confermato da:`: un elenco non confermato non e' un contratto*», «*non dichiara nessun flusso*» — quest'ultimo esce anche quando le intestazioni ci sono ma **nessuna** è riconosciuta (id con spazi, tipo sconosciuto): non ne è stata raccolta neanche una |
| 2 | `spec-coverage` | il passo 1 ha prodotto un elenco di flussi **e** in `e2e/` c'è almeno un file di spec (`*.spec.ts`, `*.test.ts` e varianti) | per ogni flusso dichiarato, almeno una spec che porta l'etichetta `@flusso:<id>` (il gate la cerca nel testo del file; la convenzione è scriverla nel titolo del test); le etichette che non corrispondono a nessun flusso | MANCANTE — «*contratto dei flussi non leggibile*», «*nessun file di spec in e2e/: la copertura sarebbe 0 su 0, cioe' nessuna misura*» |
| 3 | `lint-spec` | almeno un file di spec; ESLint installato **nella cartella della skill** (`agenti/flow-sentinel/node_modules`) | `.only` committato, `.skip` senza motivazione, più ESLint con `resources/config/eslint-spec.config.mjs` (`--no-config-lookup`) su `e2e` | MANCANTE se non ci sono spec o se ESLint non c'è — **ma un `block` già trovato vince**: si è guardato e si è trovato, quindi `fail` |
| 4 | `effetto-db` | il passo 2 ha misurato la copertura, cioè si sa quale spec attacca quale flusso | per ogni flusso `positivo` e `ostile-scrittura` **coperto**, almeno una delle sue spec importa **e** chiama `e2e/helpers/db` | MANCANTE — «*copertura non misurata: non si sa quale spec attacchi quale flusso*» |
| 5 | `app-viva` | `supabase/config.toml` leggibile (oppure `--url` **e** `--db-url` entrambi espliciti); `[auth].site_url`; `[db].port`; l'app risponde con uno stato < 500 entro 15 secondi (i redirect non vengono seguiti: un 307 verso `/login` è un'app viva); `psql` nel PATH; almeno una tabella negli schemi esposti; almeno una riga in quelle tabelle | quante tabelle e quante righe di seed. URL, database e schemi si stampano **anche sul verde** | MANCANTE in ognuno dei sette punti, con il motivo scritto per esteso (vedi sotto) |
| 6 | `playwright` | almeno un file di spec; `app-viva` = `pass`; `node_modules/@playwright/test` presente nel progetto; il report è interpretabile come JSON | `npx playwright test --reporter=json`: passati, falliti (per nome), **passati al secondo tentativo**, saltati, errori del runner | MANCANTE — «*`playwright test` su zero file esce 0, e zero test passati non e' un verde*», «*premessa mancante (passo `app-viva`)*», «*@playwright/test non installato nel progetto*», «*report JSON di Playwright non interpretabile*» |
| 7 | `contratto-uscita` | nessuna: legge sempre. È l'unico passo che non può essere MANCANTE | `playwright.config.ts` esiste e dichiara `retries: 1`; l'handoff esiste, non ha segnaposto `{{…}}`, e la sua riga `Gate: VERDE\|ROSSO` **coincide** col verdetto dei sei passi precedenti | non si applica: il passo è `pass` o `fail`. Un handoff assente è `fail`, non MANCANTE — quel file lo scrive l'agente, non uno strumento che può non essere installato |

Due dipendenze fra passi meritano di essere lette due volte.

**Il passo `playwright` è `skipped` se `app-viva` non è `pass`.** Non è prudenza: una batteria lanciata contro un'app che non risponde produce venti fallimenti che non parlano dell'app, parlano del fatto che non c'era. È un esito che non è un esito, e leggerlo come «rosso dei test» manda i costruttori a cercare un difetto che non esiste. Stessa cosa col database vuoto: i test falliscono per mancanza di dati e i loro rossi somigliano a difetti dell'applicazione. Quindi la batteria **non viene lanciata affatto**, e il gate lo dichiara: `premessa mancante (passo app-viva): la batteria non e' stata lanciata, perche' il suo esito non sarebbe un esito`.

**Il passo `contratto-uscita` guarda i sei precedenti.** `verdettoDa()` è ROSSO se anche uno solo dei sei non è `pass` (fallito *o* mancante), e l'handoff deve dichiarare esattamente quello. Dichiarare ROSSO su un gate rosso **passa**: dichiarare non è fallire (DECISIONI.md §19). Quello che non passa è un handoff che parla di un'altra esecuzione.

### Modi in cui questo gate potrebbe essere verde senza aver guardato

Cinque, tutti chiusi nel codice, tutti della stessa forma: **uno strumento che non ha letto niente esce 0**. È la generalizzazione della lezione di Schema Forge (DECISIONI.md §18), applicata a un dominio dove la tentazione è più forte, perché una batteria vuota è velocissima.

- **Zero spec.** `npx playwright test` su una cartella senza file esce 0 e stampa un report perfettamente valido con zero test. Cancellare le spec renderebbe il gate più verde che scriverle. Contromisura: i file si **contano prima** (`elencaSpec()` legge `e2e/` in ricorsione con lo stesso `testMatch` di Playwright), e con zero file i passi `spec-coverage`, `lint-spec` e `playwright` sono MANCANTI. Nessuno di loro può diventare `pass` per assenza di input.
- **Contratto non confermato.** Un `docs/flussi-critici.md` scritto dall'agente e mai confermato da nessuno non è un contratto: è l'opinione dell'agente su cosa fosse critico, e coprirla al 100% dimostra solo che l'agente è coerente con sé stesso. Contromisura: senza la riga `Confermato da:` il passo 1 è MANCANTE, e a cascata lo sono `spec-coverage` (niente elenco da coprire) ed `effetto-db` (niente mappa flusso → spec).
- **Database vuoto o migrazioni non applicate.** Un database acceso non è un database utile. Contromisura: prima di dichiarare viva la premessa si contano, con `psql`, le **tabelle** negli schemi esposti (`[api].schemas`, default `public`) e le **righe** dentro quelle tabelle. Zero tabelle = «*le migrazioni non sono applicate, la batteria girerebbe sul vuoto*». Zero righe = «*il seed non e' stato applicato, e i fallimenti della batteria sembrerebbero difetti dell'app*». Entrambi MANCANTE.
- **URL dell'app non dichiarato.** Il gate **non indovina** un `localhost:3000` e non legge variabili d'ambiente: l'URL viene da `[auth].site_url` del `config.toml` **del progetto**, o da un `--url` esplicito. Un default scritto nel gate è il modo esatto in cui si finisce per interrogare l'app di un altro progetto — o la propria di ieri, rimasta accesa — e chiamarla verde.
- **Database del progetto non risolvibile.** Stessa storia, con un precedente misurato: la porta 54322 di default, su una macchina con due stack Supabase accesi, è il database di **qualcun altro** (DECISIONI.md §11 e §14). Il gate la prende da `[db].port`, e se non la trova il passo è MANCANTE. La precedenza è **flag esplicito > `config.toml` del progetto > mai l'ambiente**.

Corollario di forma, non di sostanza: URL, database e schemi finiscono nel dettaglio di `app-viva` **anche quando è verde**. Un gate che ha guardato l'app sbagliata non deve poter assomigliare a un gate che ha guardato la tua.

### Il contratto `--json`

`verify.mjs --json` è ciò che legge l'orchestratore. La forma è stabile e versionata. Le **chiavi restano in inglese** (`contract`, `ok`, `summary`, `steps`, `id`, `name`, `status`, `detail`, `counts`, e `severity`/`object`/`message` nei findings) mentre le **etichette per gli umani restano italiane**: è la regola di DECISIONI.md §15 — la lingua della casa vale sul codice e sulla prosa, il formato di scambio resta com'è nato in `rls-audit.mjs` di Schema Forge, e mescolare le due lingue dentro lo stesso oggetto sarebbe peggio di entrambe le scelte. Una chiave italiana c'è, ed è meglio saperlo che scoprirlo interrogando il JSON: `summary.passi`, il conteggio dei passi. Resta com'è perché rinominare un campo alza `contract` (vedi sotto), e non si rompe un contratto per un refuso di lingua.

```json
{
  "contract": 1,
  "ok": false,
  "summary": { "passi": 7, "pass": 4, "fail": 1, "skipped": 2 },
  "steps": [
    { "id": "flussi-critici", "name": "contratto dei flussi critici", "status": "pass",
      "detail": "5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: Alberto Marocco, 2026-07-28" },
    { "id": "spec-coverage", "name": "copertura dei flussi (una spec per flusso)", "status": "fail",
      "detail": "5 flussi · 4 file di spec\n[block] flusso checkout-ospite: dichiarato critico e nessuna spec lo attacca: aggiungi una spec con `@flusso:checkout-ospite` nel titolo, oppure toglilo dal contratto (e falla riconfermare)",
      "counts": { "block": 1, "issue": 0, "warn": 0 } },
    { "id": "lint-spec", "name": "lint delle spec", "status": "pass",
      "detail": "[issue] e2e/carrello.spec.ts:31: `.skip` senza motivazione scritta accanto: scrivi in un commento perche' e' saltato e quando rientra, o toglilo",
      "counts": { "block": 0, "issue": 1, "warn": 0 } },
    { "id": "effetto-db", "name": "asserzione di effetto sul database", "status": "pass",
      "detail": "4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)\ntutti importano e chiamano `e2e/helpers/db`",
      "counts": { "block": 0, "issue": 0, "warn": 0 } },
    { "id": "app-viva", "name": "app viva e database del progetto", "status": "skipped",
      "detail": "app: http://127.0.0.1:3000 (HTTP 200)\npsql non disponibile nel PATH: il database del progetto NON e' stato interrogato (su Windows sta in %USERPROFILE%\\scoop\\apps\\postgresql\\current\\bin)" },
    { "id": "playwright", "name": "batteria Playwright (il browser giudica)", "status": "skipped",
      "detail": "premessa mancante (passo `app-viva`): la batteria non e' stata lanciata, perche' il suo esito non sarebbe un esito" },
    { "id": "contratto-uscita", "name": "contratto d'uscita (handoff + configurazione)", "status": "pass",
      "detail": "" }
  ]
}
```

- **`id`** — identificatore stabile del passo, uno dei sette della tabella, sempre in quest'ordine. **È l'unica cosa su cui un consumatore deve agganciarsi.** `name` è l'etichetta per gli umani ed è libera di cambiare: se l'identificatore fosse l'etichetta, riscriverla per renderla più chiara romperebbe in silenzio l'orchestratore — cioè il costo di comunicare meglio sarebbe un guasto invisibile a valle.
- **`status`** — `pass` · `fail` · `skipped`. `skipped` è una **verifica mancante**, e il gate resta rosso.
- **`detail`** — prosa per umani, multilinea. Non è un formato: non ci si aggancia. Nell'esempio sopra `contratto-uscita` ce l'ha vuoto perché non ha niente da rimproverare.
- **`counts`** — presente solo sui tre passi che producono findings per gravità: `spec-coverage`, `lint-spec`, `effetto-db`. Gli altri quattro non hanno findings, quindi non hanno `counts`; e nemmeno quei tre ce l'hanno quando si fermano prima per premessa mancante (zero spec, contratto illeggibile), perché non hanno guardato niente da contare.
- **`ok`** — vero **se e solo se** `summary.fail === 0 && summary.skipped === 0`. Sette `pass` su sette. Sei `pass` e un `skipped` è rosso.
- **`contract`** — si alza quando un campo viene **tolto o rinominato**, o quando cambia la lista degli `id`. Aggiungere un campo non lo alza: un consumatore che ignora ciò che non conosce non si rompe.

Uscita del processo: **`0`** gate verde · **`1`** gate rosso · **`2`** errore di esecuzione. Il `2` scatta quando nella cartella corrente non c'è né `docs/` né `e2e/`: lì non c'è un progetto Web Gun, e un gate che rispondesse ROSSO direbbe qualcosa su un progetto che non ha guardato. **Su `2` non c'è JSON**, il messaggio esce su stderr: chi automatizza distingua i tre codici prima di provare a interpretare stdout.

## Regola anti-simulazione (non negoziabile)

Uno strumento assente non è un passo superato. `verify` classifica ogni passo in tre stati:

- `pass` — eseguito, nessun problema
- `fail` — eseguito, problemi trovati (elencati per gravità o per nome del test)
- `skipped` — **non eseguito**: strumento mancante, app spenta, contratto assente, zero spec, database vuoto

Nel riepilogo gli `skipped` compaiono come **verifiche mancanti**, e l'ultima riga lo dice a lettere: *una verifica mancante non è una verifica superata: il gate resta rosso*. Una batteria con tre `skipped` non ha passato il gate: ha evitato tre domande. Se `psql` non è installato il gate è **rosso**, non "in attesa" — perché la sola alternativa onesta sarebbe scrivere che il database è stato controllato, e non è vero.

L'unica precedenza ammessa fra stati è dentro `lint-spec`: se le regole hanno già trovato un `block` (un `.only`), il passo è `fail` anche con ESLint assente. Un difetto trovato pesa più di uno strumento mancante — si è guardato, e si è trovato. Al contrario, ESLint assente senza bloccanti non produce `pass`: metà del passo non è stata eseguita.

## Gravità

I tre passi che producono findings usano tre gradi. **Un `block` rende rosso il passo; `issue` e `warn` si stampano e non bloccano** (`statoDaFindings`), ma finiscono in `counts` e nel dettaglio, quindi restano leggibili e vanno documentati nell'handoff.

| Grado | Significato | Esempi veri, dal codice |
|---|---|---|
| `block` | non si consegna | **flusso dichiarato che nessuna spec attacca** (`spec-coverage`) · **`.only` committato** (`lint-spec`) · **flusso positivo o ostile-in-scrittura le cui spec non importano e chiamano `e2e/helpers/db`** (`effetto-db`) |
| `issue` | si consegna solo se documentato nell'handoff | **`.skip` senza motivazione scritta accanto** — né in coda alla riga né nella riga di commento sopra |
| `warn` | si stampa, non blocca | **etichetta `@flusso:<id>` orfana**: una spec attacca un flusso che il contratto non nomina |

Il perché di ciascuno, in una riga.

**Flusso scoperto = `block`.** `docs/flussi-critici.md` non è un augurio: se un flusso è critico, o qualcosa lo attacca o il gate è rosso. Una rete che copre quattro flussi su cinque è una rete con un buco, e il buco è esattamente dove nessuno guarda.

**`.only` committato = `block`.** Spegne il resto della batteria in silenzio, e la riga che lo fa sembra un test come gli altri: è il modo più economico che esista per produrre un falso verde.

```typescript
import { test } from "@playwright/test";

// block: gli altri diciotto test non girano, e il verde non ha guardato niente
test.only("checkout ospite @flusso:checkout-ospite", async ({ page }) => { /* … */ });
```

Una riga di **commento** che nomina `.only` non è un `.only`: il controllo salta le righe che iniziano per `//`, `*` o `/*`, altrimenti boccerebbe le reference di questa casa e i commenti degli helper.

**Spec di flusso positivo che non guarda il database = `block`.** È la terza legge in forma verificabile: un test che asserisce solo il testo in pagina passa anche con un backend che non ha scritto niente. Lo stesso vale per un ostile **in scrittura**, che deve asserire il rifiuto *e* che il database non è cambiato. `ostile-lettura` è escluso apposta: un attacco in lettura non cambia nulla, non c'è stato da confrontare, e il rifiuto della rotta è l'asserzione.

```typescript
// pass: importa e chiama l'helper — l'ordine esiste davvero nel database
import { expect, test } from "@playwright/test";

import { contaOrdini } from "./helpers/db";

test("checkout ospite @flusso:checkout-ospite", async ({ page }) => {
  await page.getByRole("button", { name: "Conferma ordine" }).click();
  await expect(page.getByText("Grazie per l'ordine")).toBeVisible();
  expect(await contaOrdini("ospite@example.com")).toBe(1);
});
```

```typescript
// block: la pagina dice "Grazie", e nessuno ha chiesto al database se è vero
import { expect, test } from "@playwright/test";

test("checkout ospite @flusso:checkout-ospite", async ({ page }) => {
  await page.getByRole("button", { name: "Conferma ordine" }).click();
  await expect(page.getByText("Grazie per l'ordine")).toBeVisible();
});
```

**`.skip` non motivato = `issue`.** Nasce come il `.only` — qualcuno lo mette «per un attimo» — ma non spegne il resto della batteria, e uno skip legittimo esiste. La motivazione vale se sta in coda alla riga, oppure sulla **prima riga non vuota sopra** (le righe vuote in mezzo non contano): sono i due posti dove un umano la scrive davvero.

Niente sopra, niente in coda — `issue`:

```typescript
import { test } from "@playwright/test";

test.skip("resi @flusso:reso-ordine", async ({ page }) => { /* … */ });
```

Motivazione sopra — nessun rilievo, e fra un mese si sa se il test rientra o va cancellato:

```typescript
// saltato finché Gestionale Crafter non consegna la rotta /admin/resi (handoff 10)
test.skip("resi @flusso:reso-ordine", async ({ page }) => { /* … */ });
```

Il controllo guarda la **forma**: qualunque riga di commento sopra lo `skip` lo soddisfa, anche un `// FIXME` che non spiega niente, e così pure una `//` capitata sulla riga stessa — per esempio dentro un URL nel titolo del test. Sono i due modi in cui questo `issue` sparisce senza che nessuno abbia scritto un motivo: li vede chi rilegge le spec, non il gate.

**Etichetta orfana = `warn`.** La spec c'è ed è lavoro fatto: punta però a un flusso che il contratto non nomina. O l'etichetta ha un refuso, o il flusso è stato tolto dall'elenco senza dirlo — e nel secondo caso la decisione spetta a chi ha confermato l'elenco, non al gate e non all'agente (comando `evolve`).

## Prerequisiti

```bash
# nel PROGETTO generato
npm install                       # @playwright/test: senza, il passo `playwright` e' MANCANTE
npx playwright install            # i browser: senza, la batteria non produce un esito leggibile

# sulla macchina
psql --version                    # client Postgres: senza, `app-viva` e' MANCANTE
# su Windows sta in %USERPROFILE%\scoop\apps\postgresql\current\bin

# nella SKILL, una volta sola
cd agenti/flow-sentinel && npm install     # ESLint: senza, meta' di `lint-spec` non gira
```

La configurazione di ESLint viaggia con la **skill**, non col progetto (`resources/config/eslint-spec.config.mjs`, invocata con `--no-config-lookup`): il gate deve dare lo stesso esito ovunque giri, anche su un progetto che non l'ha ancora ricevuta da `forge`. È il precedente del `.sqlfluff` di Schema Forge, DECISIONI.md §8 — i linter si configurano, il gate non si declassa.

I browser mancanti non producono mai un `pass`: o Playwright emette un report con un errore del runner, che il passo legge come `fail` (`errore del runner: …`), o non emette JSON interpretabile e il passo è MANCANTE.

**Shim `.cmd` su Windows.** Questo gate risolve dal PATH tre soli comandi — `node`, `psql` e `npx` — e `npx` installato da npm è uno shim `.cmd`. `spawnSync(cmd, args)` senza shell **non consulta PATHEXT**: si ottiene ENOENT sul nome e EINVAL sul percorso pieno — Node rifiuta `.cmd`/`.bat` senza shell dalla mitigazione della CVE-2024-27980. Il guasto andrebbe nella direzione sicura (`skipped`), ma la **diagnosi** no: direbbe «strumento assente» dove lo strumento c'è e funziona, e qualcuno perderebbe un pomeriggio a reinstallarlo. Quindi `dove()` risolve il nome con `where` (`which` altrove) e `formaEseguibile()` lo lancia via `cmd.exe /c <percorso>` quando il percorso finisce in `.cmd` o `.bat`. **Mai `shell: true`**: lì gli argomenti vengono concatenati in una stringa invece che passati come vettore, e questo gate passa percorsi con spazi, URL di database e SQL intero. ESLint non passa mai dal proprio shim: il gate lo invoca come `node <skill>/node_modules/eslint/bin/eslint.js`, così l'unico eseguibile in gioco è quello che sta già girando.

**CRLF e BOM non devono far nascere rosso un passo verde.** Su Windows ogni file di testo che il gate legge arriva con `\r\n`, e se è passato da PowerShell anche con il BOM; `psql` lascia il `\r` in coda a ogni riga di output. Nessuna delle due cose porta significato, e a Schema Forge sono già costate una regola morta e un confronto di tipi sempre fallito. Si normalizzano una volta sola, all'ingresso (`righe()`, `senzaBom()`, `righeDaPsql()`), e **solo quelle**: tutto il resto del testo arriva alle regole com'è.

Due note operative minori ma reali: il report di Playwright arriva su **stdout** e viene letto con un buffer di 64 MB; e siccome il runner ci stampa attorno del rumore, il JSON viene estratto dalla prima `{` all'ultima `}` — se non ne esce un oggetto valido, il passo è MANCANTE, non `fail`, perché non si sa cosa sia successo alla batteria.

## Cosa riportare all'umano

Mai i log grezzi. Si riporta il **residuo** e le **verifiche mancanti**, nella forma che stampa il gate:

```
GATE FLUSSI: ROSSO (1 falliti, 2 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: Alberto Marocco, 2026-07-28
FAIL  copertura dei flussi (una spec per flusso)
        5 flussi · 4 file di spec
        [block] flusso checkout-ospite: dichiarato critico e nessuna spec lo attacca: aggiungi una spec con `@flusso:checkout-ospite` nel titolo, oppure toglilo dal contratto (e falla riconfermare)
OK    lint delle spec
        [issue] e2e/carrello.spec.ts:31: `.skip` senza motivazione scritta accanto: scrivi in un commento perche' e' saltato e quando rientra, o toglilo
OK    asserzione di effetto sul database
        4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        tutti importano e chiamano `e2e/helpers/db`
MANC  app viva e database del progetto
        app: http://127.0.0.1:3000 (HTTP 200)
        psql non disponibile nel PATH: il database del progetto NON e' stato interrogato (su Windows sta in %USERPROFILE%\scoop\apps\postgresql\current\bin)
MANC  batteria Playwright (il browser giudica)
        premessa mancante (passo `app-viva`): la batteria non e' stata lanciata, perche' il suo esito non sarebbe un esito
OK    contratto d'uscita (handoff + configurazione)

Una verifica mancante non e' una verifica superata: il gate resta rosso.
```

Il dettaglio si stampa **anche sui passi verdi**, e non è verbosità: è lì che finisce la riga «passati al SECONDO tentativo (retries = 1) — instabili, non verdi». Se quella riga uscisse solo sul rosso non la leggerebbe nessuno, ed è esattamente così che un flaky diventa normale.

## Cosa un gate verde non prova

Sette `pass` su sette dicono una cosa precisa e non di più. Vale la pena scrivere cosa restano fuori, perché un elenco onesto di limiti è ciò che impedisce a un verde di essere letto come una garanzia.

- **L'elenco dei flussi può essere incompleto.** Il gate verifica che ogni flusso **dichiarato** sia attaccato, non che siano stati dichiarati i flussi giusti. Se `map` ha dimenticato il reso, il gate è verde e il reso non è testato. La difesa non è automatica: è lo Specchio dei flussi, e la firma di chi conferma nella riga `Confermato da:`.
- **L'etichetta `@flusso:<id>` vale ovunque nel file.** Il gate cerca la stringa nel testo della spec, non dentro il titolo del test: una spec che nomina il flusso in un commento e poi attacca altro risulta comunque coperta, e `spec-coverage` è verde. L'etichetta va nel titolo perché è lì che serve davvero — esce nei report di Playwright e si filtra con `npx playwright test --grep @flusso:<id>` — ma a farlo rispettare è la revisione, non il gate.
- **`effetto-db` guarda la forma, non la semantica.** Verifica che una spec **importi e chiami** `e2e/helpers/db`; non sa se l'asserzione è quella giusta, sa che ce n'è una che ha interrogato il database. Una spec che chiama `contaOrdini()` e non confronta il risultato con niente passa. È la stessa onestà che Schema Forge scrive sul suo audit RLS — guarda la forma delle policy, la semantica la dimostrano i test.
- **Il gate non sa se il seed contiene i dati che servono.** Conta tabelle e righe. Un database con una riga in una tabella di configurazione e nient'altro supera `app-viva`, e i test che cercano un prodotto pubblicato falliranno al passo dopo, dove almeno il fallimento si vede.
- **I test `skipped` non fanno rosso la batteria.** `esitoBatteriaVerde` guarda i falliti e gli errori del runner: gli skip vengono **elencati** nel dettaglio ma non bloccano, perché uno skip motivato è legittimo. Il contrappeso è a monte, in `lint-spec` (`issue` sugli skip senza motivazione) e in `spec-coverage`: un flusso la cui unica spec è saltata resta dichiarato coperto. Chi legge il dettaglio se ne accorge; chi legge solo `ok: true` no.
- **ESLint pulito non vuol dire spec buone.** Vieta le attese fisse (`waitForTimeout`) e le variabili inutilizzate — che in una spec sono quasi sempre un'asserzione scritta a metà. Non ha opinioni sui selettori: quelle stanno in `references/playwright.md`, e le fa rispettare la revisione, non il gate.
- **Un ostile in scrittura può guardare il database senza aver provato l'attacco giusto.** Il gate misura che la spec interroghi il database; che l'attacco tentato sia quello che il modello di accesso vieta lo decide chi ha scritto `docs/flussi-critici.md`.

Nessuno di questi buchi si chiude con un altro controllo automatico: si chiudono provando che la batteria **sa diventare rossa**. Si rompe l'app in un punto noto, uno per classe di difetto, e si verifica che il rosso arrivi dove deve. La procedura, i difetti da piantare e il ripristino stanno in `references/sabotaggio.md`. Finché quel collaudo non è stato fatto almeno una volta, la rete di sicurezza è un'ipotesi.
