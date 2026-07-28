# Costruzione di Flow Sentinel — 2026-07-28 (P1)

Verbale della fase di costruzione. La progettazione (`SKILL.md`, confermata in P0) **non e' stata
toccata**: qui c'e' il come. Tutte le uscite riportate sono incollate da esecuzioni reali, non
riassunte — «il gate e' diventato rosso» e' un ricordo, l'uscita e' una prova.

Branch: `agente/flow-sentinel`. Banco di prova: `banco-prova-flow/` (Next.js 16 + Supabase locale sulle
porte 583xx, app sulla 3170), usa e getta e gitignorato per la §12 di `DECISIONI.md`.

## 1. Cosa e' stato costruito

| Cosa | Dove | Misura |
|---|---|---|
| References | `references/` | 4 file, 1288 righe |
| Gate | `scripts/verify.mjs` | 7 passi, id stabili, `--json`, uscite 0/1/2 |
| Regole pure | `scripts/gate-lib.mjs` | nessun I/O: stringhe dentro, verdetti fuori |
| Test | `scripts/gate-lib.test.mjs`, `scripts/verify.test.mjs` | **79 verdi** |
| Template | `resources/templates/` | contratto dei flussi, handoff |
| Configurazione delle spec | `resources/config/eslint-spec.config.mjs` | viaggia con la skill, `forge` la copia |
| Guardiani | `package.json`, `eslint.config.mjs`, `knip.jsonc` | ESLint 0/0, knip pulito, jscpd 0 cloni |
| Banco | `banco-prova-flow/` | 3 tabelle con RLS, 5 flussi, 5 spec |

Il gate misura le premesse prima degli esiti: conta le spec **prima** di lanciare Playwright,
interroga l'app **prima** di leggere i risultati, risolve database e URL dal `supabase/config.toml` del
progetto e **mai** dall'ambiente.

## 2. Decisioni prese, con il motivo

| Decisione | Alternativa scartata | Perche' |
|---|---|---|
| L'URL dell'app viene da `[auth].site_url` del `config.toml` | un default `localhost:3000` nel gate, o una variabile d'ambiente | e' l'unica riga in cui un progetto Web Gun **dichiara** il proprio indirizzo. Un default indovinato e' il modo in cui si testa l'app di un altro progetto e la si chiama verde — la stessa forma del bug della porta 54322 (DECISIONI.md §11) |
| `app-viva` conta tabelle **e righe** con `psql` | fermarsi a «il database risponde» | una batteria su un database vuoto fallisce per mancanza di dati, e i suoi rossi somigliano a difetti dell'app. La `SKILL.md` chiede «seed applicato»: il gate misura che ci siano righe, non **quali** — quale tabella porti il seed e' conoscenza di progetto che il gate non ha, ed e' scritto fra i limiti |
| `playwright` e' MANCANTE se `app-viva` non e' `pass` | lanciare comunque la batteria | l'esito di una batteria su un'app che non risponde non e' un esito. E' la stessa regola di DECISIONI.md §18 applicata al passo piu' costoso |
| `contratto-uscita` verifica anche `retries: 1` in `playwright.config.ts` | verificare solo l'handoff, come dice la lettera della `SKILL.md` | `retries = 1` e' una regola **non negoziabile** della skill, e nessun altro passo la guardava: con `retries: 3` il gate resterebbe verde mentre un test che passa una volta su quattro diventa invisibile. E' un'estensione dichiarata rispetto alla tabella della `SKILL.md`, non un passo nuovo — vedi §6 |
| `.only` e skip non motivati sono regole **pure** in `gate-lib.mjs`, non regole ESLint | esprimerle come `no-restricted-syntax` | servono due gravita' diverse (`block` e `issue`) che ESLint non sa distinguere nel modello del gate, e una regola pura si prova con un test invece che con un progetto |
| ESLint vive nella cartella della **skill**, non del progetto | usare l'ESLint del progetto | il gate deve dare lo stesso esito ovunque giri, anche su un progetto che la configurazione non l'ha ancora ricevuta da `forge`. Precedente: `.sqlfluff` di Schema Forge, DECISIONI.md §8 |
| `waitForTimeout` vietato da ESLint | solo prosa nella reference | e' l'unica convenzione Playwright che uno strumento puo' far rispettare davvero; le altre (selettori, struttura) nessun linter le vede |
| `ostile-lettura` **non** deve asserire l'effetto DB | pretendere l'helper su tutti i flussi ostili | un attacco in lettura non cambia niente: non c'e' stato da confrontare, e pretenderlo avrebbe insegnato a scrivere un'asserzione finta per far tacere il gate |
| L'attacco in scrittura del banco passa dall'API dati col token vero del cliente | premere un bottone che al cliente non compare | provare che il bottone non c'e' non prova che il database dica di no. La chiave pubblica sta gia' nel bundle: e' esattamente cio' che puo' fare chiunque apra gli strumenti di sviluppo |
| Banco senza Tailwind, con storage e analytics spenti | stack standard completo del `CLAUDE.md` | il banco prova il gate, non la resa grafica; nessun flusso dipende dallo stile, e il container di storage non diventava sano su questa macchina |
| Banco a un solo worker Playwright | esecuzione parallela | un database solo: due spec che contano le stesse righe insieme producono un flaky che parla dell'ordine di esecuzione, non dell'app |

## 3. Le prove

### 3.1 Corsa verde — VERDE 7 su 7

```
GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: UMANO (P0, 2026-07-28)
OK    copertura dei flussi (una spec per flusso)
        5 flussi · 5 file di spec
        ogni flusso dichiarato ha almeno una spec che lo attacca
OK    lint delle spec
        nessun `.only`, nessuno skip non motivato, ESLint pulito
OK    asserzione di effetto sul database
        4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        tutti importano e chiamano `e2e/helpers/db`
OK    app viva e database del progetto
        app: http://127.0.0.1:3170 (HTTP 200) · database: postgresql://postgres:postgres@127.0.0.1:58322/postgres
        schemi esposti: public, graphql_public · 3 tabelle, 6 righe di seed
OK    batteria Playwright (il browser giudica)
        5 file di spec · 5 passati, 0 falliti, 0 saltati
OK    contratto d'uscita (handoff + configurazione)
```

Uscita del processo: `0`. Contratto `--json` della stessa esecuzione (estratto: `detail` e `name` tolti
per brevita', `id` e ordine sono quelli veri):

```json
{
  "contract": 1,
  "ok": true,
  "summary": { "passi": 7, "pass": 7, "fail": 0, "skipped": 0 },
  "steps": [
    { "id": "flussi-critici",   "status": "pass" },
    { "id": "spec-coverage",    "status": "pass", "counts": { "block": 0, "issue": 0, "warn": 0 } },
    { "id": "lint-spec",        "status": "pass", "counts": { "block": 0, "issue": 0, "warn": 0 } },
    { "id": "effetto-db",       "status": "pass", "counts": { "block": 0, "issue": 0, "warn": 0 } },
    { "id": "app-viva",         "status": "pass" },
    { "id": "playwright",       "status": "pass" },
    { "id": "contratto-uscita", "status": "pass" }
  ]
}
```

### 3.2 Sabotaggio — cinque difetti piantati, cinque rossi

Procedura di `references/sabotaggio.md`: un difetto per volta, si rilancia, si verifica che il rosso
arrivi dal passo giusto **e per il motivo giusto**, si ripristina, si rilancia.

#### Classe B — «la UI mente» (la trappola che motiva la terza legge)

L'`insert` tolto da `src/modules/catalogo/azioni.ts`, il messaggio di successo lasciato intatto:

```diff
-  const supabase = await clientSupabase();
-  const { error } = await supabase.from("prodotti").insert({ nome, prezzo_cents: prezzo });
-  if (error) redirect("/admin?errore=" + encodeURIComponent(error.message));
+  await clientSupabase();
   revalidatePath("/admin");
   redirect("/admin?esito=prodotto-creato");
```

```
GATE FLUSSI: ROSSO (2 falliti, 0 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: UMANO (P0, 2026-07-28)
OK    copertura dei flussi (una spec per flusso)
        5 flussi · 5 file di spec
        ogni flusso dichiarato ha almeno una spec che lo attacca
OK    lint delle spec
        nessun `.only`, nessuno skip non motivato, ESLint pulito
OK    asserzione di effetto sul database
        4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        tutti importano e chiamano `e2e/helpers/db`
OK    app viva e database del progetto
        app: http://127.0.0.1:3170 (HTTP 200) · database: postgresql://postgres:postgres@127.0.0.1:58322/postgres
        schemi esposti: public, graphql_public · 3 tabelle, 6 righe di seed
FAIL  batteria Playwright (il browser giudica)
        5 file di spec · 4 passati, 1 falliti, 0 saltati
        falliti:
          - crea-prodotto.spec.ts › lo staff crea un prodotto e la riga esiste davvero @flusso:crea-prodotto
FAIL  contratto d'uscita (handoff + configurazione)
        docs/handoff/12-flow-sentinel.md dichiara `Gate: VERDE` ma il gate chiude ROSSO: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA
```

**Il rosso arriva dall'asserzione giusta.** Non e' la pagina a cadere — la pagina dichiara successo, ed
e' proprio il punto:

```
    Error: la pagina dichiara successo: la riga deve esistere nel database

    expect(received).not.toBeNull()

    Received: null

      19 |   // per cui la terza legge esiste.
      20 |   const riga = await prodottoPerNome(PRODOTTO_DI_PROVA.nome);
    > 21 |   expect(riga, "la pagina dichiara successo: la riga deve esistere nel database").not.toBeNull();
         |                                                                                       ^
```

L'asserzione sulla pagina (`expect(page.getByRole("status")).toHaveText("Prodotto creato")`, riga 17)
**passa**: se la spec si fosse fermata li', il gate sarebbe rimasto verde su un'app che non scrive
niente. Il secondo `FAIL` e' un effetto collaterale voluto: l'handoff dichiarava `Gate: VERDE` e il
gate chiudeva rosso — la regola di `DECISIONI.md` §19 ha scattato senza che fosse lei l'oggetto della
prova.

Ripristinato l'`insert`, ricostruita e riavviata l'app: **VERDE 7 su 7**, identico alla §3.1.

#### Classe A — flusso genuinamente rotto

`src/modules/ordini/azioni.ts` scrive uno stato fuori dominio (`'evaso'`), che il `check` rifiuta:

```
GATE FLUSSI: ROSSO (2 falliti, 0 verifiche mancanti su 7 passi)
...
FAIL  batteria Playwright (il browser giudica)
        5 file di spec · 4 passati, 1 falliti, 0 saltati
        falliti:
          - avanza-stato-ordine.spec.ts › lo staff conferma l'ordine e lo stato avanza nel database @flusso:avanza-stato-ordine
```

Dettaglio del fallimento — qui cade la **pagina**, ed e' corretto: l'azione va in errore e il messaggio
di successo non compare affatto.

```
    Error: expect(locator).toHaveText(expected) failed

    Locator: getByRole('status')
    Expected: "Ordine confermato"
    Timeout: 5000ms
    Error: element(s) not found
```

#### Classe C — rotta ostile lasciata aperta

Tolto da `src/app/admin/page.tsx` il controllo di sessione e quello di ruolo:

```
FAIL  batteria Playwright (il browser giudica)
        5 file di spec · 4 passati, 1 falliti, 0 saltati
        falliti:
          - admin-negato-anon.spec.ts › l'anonimo non entra nell'area riservata @flusso:admin-negato-anon
```

```
    Error: expect(page).toHaveURL(expected) failed

    Expected pattern: /\/login$/
    Received string:  "http://127.0.0.1:3170/admin"
```

#### Classe D — il test instabile (prova della dichiarazione del secondo tentativo)

`if (info.retry === 0) throw new Error("instabilita' piantata dal collaudo");` in `crea-prodotto.spec.ts`.
Il gate resta **VERDE**, ma l'instabilita' e' **scritta**, che e' esattamente il comportamento
prescritto dalla `SKILL.md`:

```
GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)
...
OK    batteria Playwright (il browser giudica)
        5 file di spec · 5 passati, 0 falliti, 0 saltati
        passati al SECONDO tentativo (retries = 1) — instabili, non verdi:
          - crea-prodotto.spec.ts › lo staff crea un prodotto e la riga esiste davvero @flusso:crea-prodotto
OK    contratto d'uscita (handoff + configurazione)
```

#### Classe E — `.only` committato (collaudo del gate, non della batteria)

`test(` → `test.only(` in `admin-negato-anon.spec.ts`. Qui il rosso arriva da due passi diversi, ed e'
la prova piu' istruttiva di tutte:

```
GATE FLUSSI: ROSSO (3 falliti, 0 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
FAIL  lint delle spec
        [block] e2e/admin-negato-anon.spec.ts:10: `.only` committato: il resto della batteria non gira, e il verde che ne esce non ha guardato niente
OK    asserzione di effetto sul database
FAIL  batteria Playwright (il browser giudica)
        5 file di spec · 0 passati, 0 falliti, 0 saltati
        errore del runner: Error: item focused with '.only' is not allowed due to the 'forbidOnly' option in '..\playwright.config.ts': "admin-negato-anon.spec.ts l'anonimo non entra nell'area riservata @flusso:admin-negato-anon"
FAIL  contratto d'uscita (handoff + configurazione)
```

**`0 passati, 0 falliti, 0 saltati` e il passo e' rosso.** Senza `esito.errori`, una batteria che non ha
eseguito niente avrebbe zero fallimenti — cioe' sarebbe passata per verde. E' lo stesso falso verde
delle spec cancellate, in una forma che si presenta da sola il giorno in cui qualcuno dimentica un
`.only`.

#### Prova extra: la regola sulle attese fisse non e' decorativa

Una spec temporanea con `await page.waitForTimeout(500)`, e il passo `lint-spec`:

```
FAIL  lint delle spec
        C:\...\banco-prova-flow\e2e\tmp-prova-regola.spec.ts
          5:9  error  Attesa fissa vietata: aspetta una condizione (locator, risposta di rete, riga nel database), non un numero di millisecondi  no-restricted-syntax

        ✖ 1 problem (1 error, 0 warnings)
```

E' l'unica convenzione Playwright che uno strumento fa rispettare davvero, e ora c'e' la misura che
scatta invece della promessa che scatterebbe.

Tutti e cinque i sabotaggi sono stati **ripristinati** e l'ultimo giro chiude VERDE 7 su 7.

### 3.3 Premesse tolte — MANCANTE, mai PASS

#### App spenta

```
GATE FLUSSI: ROSSO (1 falliti, 2 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: UMANO (P0, 2026-07-28)
OK    copertura dei flussi (una spec per flusso)
        5 flussi · 5 file di spec
        ogni flusso dichiarato ha almeno una spec che lo attacca
OK    lint delle spec
        nessun `.only`, nessuno skip non motivato, ESLint pulito
OK    asserzione di effetto sul database
        4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        tutti importano e chiamano `e2e/helpers/db`
MANC  app viva e database del progetto
        l'app non risponde su http://127.0.0.1:3170 (fetch failed): senza app viva non esiste esito, e un verde qui sarebbe un verde su niente
MANC  batteria Playwright (il browser giudica)
        premessa mancante (passo `app-viva`): la batteria non e' stata lanciata, perche' il suo esito non sarebbe un esito
FAIL  contratto d'uscita (handoff + configurazione)
        docs/handoff/12-flow-sentinel.md dichiara `Gate: VERDE` ma il gate chiude ROSSO: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA

Una verifica mancante non e' una verifica superata: il gate resta rosso.
```

**La batteria non e' stata lanciata affatto**: senza app viva un `playwright test` avrebbe prodotto
cinque rossi che parlano dell'ambiente e non dell'app.

#### Spec cancellate

```
GATE FLUSSI: ROSSO (1 falliti, 4 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        5 flussi (3 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: UMANO (P0, 2026-07-28)
MANC  copertura dei flussi (una spec per flusso)
        nessun file di spec in e2e/: la copertura sarebbe 0 su 0, cioe' nessuna misura
MANC  lint delle spec
        nessun file di spec in e2e/: non c'e' niente da lintare
MANC  asserzione di effetto sul database
        copertura non misurata: non si sa quale spec attacchi quale flusso
OK    app viva e database del progetto
        app: http://127.0.0.1:3170 (HTTP 200) · database: postgresql://postgres:postgres@127.0.0.1:58322/postgres
        schemi esposti: public, graphql_public · 3 tabelle, 6 righe di seed
MANC  batteria Playwright (il browser giudica)
        nessun file di spec in e2e/: `playwright test` su zero file esce 0, e zero test passati non e' un verde
FAIL  contratto d'uscita (handoff + configurazione)
        docs/handoff/12-flow-sentinel.md dichiara `Gate: VERDE` ma il gate chiude ROSSO: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA

Una verifica mancante non e' una verifica superata: il gate resta rosso.
```

E' la forma esatta del falso verde che Schema Forge aveva su `supabase/tests/` vuota: cancellare i test
rendeva il gate piu' verde di tenerli. Qui **quattro** passi su sette diventano MANCANTI.

#### Contratto dei flussi rimosso

```
GATE FLUSSI: ROSSO (1 falliti, 3 verifiche mancanti su 7 passi)

MANC  contratto dei flussi critici
        docs/flussi-critici.md assente: non c'e' contratto da coprire (comando `map`, con lo Specchio dei flussi)
MANC  copertura dei flussi (una spec per flusso)
        contratto dei flussi non leggibile: non c'e' niente di cui misurare la copertura
OK    lint delle spec
        nessun `.only`, nessuno skip non motivato, ESLint pulito
MANC  asserzione di effetto sul database
        copertura non misurata: non si sa quale spec attacchi quale flusso
OK    app viva e database del progetto
        app: http://127.0.0.1:3170 (HTTP 200) · database: postgresql://postgres:postgres@127.0.0.1:58322/postgres
        schemi esposti: public, graphql_public · 3 tabelle, 6 righe di seed
OK    batteria Playwright (il browser giudica)
        5 file di spec · 5 passati, 0 falliti, 0 saltati
FAIL  contratto d'uscita (handoff + configurazione)
        docs/handoff/12-flow-sentinel.md dichiara `Gate: VERDE` ma il gate chiude ROSSO: l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA

Una verifica mancante non e' una verifica superata: il gate resta rosso.
```

Da leggere con attenzione: la batteria **e' verde** e il gate **e' rosso**, ed e' giusto cosi'. Cinque
spec che passano senza un elenco confermato non dicono che i flussi critici sono coperti: dicono che
cinque test passano. La copertura e' un rapporto fra due cose, e una delle due non c'e' piu'.

### 3.4 Guardiani

```
=== node --test ===
ℹ tests 79
ℹ pass 79
ℹ fail 0
=== ESLint ===
ESLint uscita: 0        (0 errori, 0 warning su scripts/ e resources/)
=== knip ===
knip uscita: 0          (nessun file morto, nessun export inutilizzato, nessuna dipendenza sospesa)
=== jscpd ===
javascript │ 4 file │ 1560 righe │ 0 cloni │ 0 (0%) righe duplicate
```

**79 test**: ogni regola pura ha il caso in cui scatta e quello in cui non deve scattare (e' il secondo
che conta: una regola che scatta sempre e' rumore, e il rumore si impara a scavalcare). Fra questi:
tre test bloccano gli id dei sette passi e il loro ordine — uno sulla lista `PASSI`, uno sulla tabella
`ID`, e uno che lancia `verify.mjs` per davvero su una cartella temporanea e controlla l'ordine
nell'uscita `--json` vera. Due prove d'integrazione verificano che «premessa assente» produca MANCANTE
e non `pass`, e che fuori da un progetto l'uscita sia `2` senza JSON.

## 4. Tre falsi verdi trovati costruendo

Nessuno dei due era nel compito: sono usciti facendo girare il gate per davvero, che e' l'unico posto
dove escono.

### 4.1 Un contratto non firmato passava per firmato

`RIGA_CONFERMA` usava `\s` fra i due punti e la firma. `\s` comprende l'a capo, quindi una riga
`Confermato da:` **vuota** catturava la prima riga non vuota che seguiva. Riprodotto:

```
firma catturata su riga VUOTA: "## `a-b` — positivo"
firma catturata su riga piena: "UMANO (2026-07-28)"
```

Il passo `flussi-critici` usciva **verde** su un contratto che nessuno aveva confermato — cioe' il passo
nato per impedire proprio quello. E' anche la forma piu' probabile del guasto: una riga lasciata a meta'
e' come si presenta un template non finito.

Chiuso ammettendo i soli spazi orizzontali
(`/^[ \t>*_-]*Confermato da[ \t*_]*:[ \t*_]*(\S.*?)[ \t*_]*$/im`), con due test di regressione. Stessa
correzione applicata alla riga `Gate:`, che aveva la stessa forma.

### 4.2 Lo shim che Windows non sa eseguire

`where npx` elenca **due** file: lo script di shell senza estensione (per Git Bash) e lo shim `.cmd`.
La prima riga e' quella senza estensione, e `spawnSync` non la esegue. Effetto: il passo `playwright`
diceva

```
MANC  batteria Playwright (il browser giudica)
        report JSON di Playwright non interpretabile: uscita non interpretabile come JSON:
```

su una macchina dove `npx playwright test` funziona benissimo. **Il guasto andava nella direzione
sicura** — MANCANTE, mai un falso verde — **la diagnosi no**: incolpava Playwright di un problema di
PATHEXT. E' la stessa lezione del `has()` di Schema Forge (STATO.md §14), in una forma che quella
correzione non copriva: li' il problema era `.cmd` non eseguibile senza shell, qui e' *quale* delle
righe di `where` guardare.

Chiuso con `primoEseguibile()` (funzione pura, quattro test) e con un esito distinto per l'errore di
esecuzione: «la batteria non e' stata lanciata: `<messaggio>`».

### 4.3 `effetto-db` verificava l'import e non la chiamata

Il piu' grave dei tre, e l'ha trovato la **seconda** verifica avversaria delle references — cercando di
smentire una frase, non di leggere il codice.

`IMPORT_HELPER_DB` ritagliava la clausola dell'import con `[\s\S]*?`, cioe' a partire dal **primo**
`import` del file. In una spec vera — e ogni spec Playwright comincia cosi' — i nomi raccolti erano:

```
import c'e', helper MAI chiamato -> {"importa":true,"chiama":true,"nomi":["test","expect","import","contaProdotti"]}
```

`test` ed `expect` finivano fra i «nomi importati dall'helper del database», quindi un `expect(...)`
qualsiasi contava come chiamata. **La regola verificava l'import e non la chiamata**, sul passo che
esiste apposta per pretendere la chiamata: bastava importare l'helper e non usarlo mai per avere il
verde. Sul banco non si vedeva, perche' le cinque spec l'helper lo chiamano davvero.

Chiuso vietando `;` e virgolette dentro la clausola (`[^;"']*?`), che e' cio' che le impedisce di
scavalcare all'indietro gli import precedenti. Due test nuovi con la forma **vera** di una spec — import
di Playwright in testa — uno che scatta e uno che non deve scattare.

Provato end-to-end togliendo l'asserzione sul database da `crea-prodotto.spec.ts` e lasciando l'import:

```
GATE FLUSSI: ROSSO (3 falliti, 0 verifiche mancanti su 7 passi)

FAIL  asserzione di effetto sul database
        4 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        [block] flusso crea-prodotto: nessuna delle spec che lo attaccano (e2e/crea-prodotto.spec.ts) importa e chiama `e2e/helpers/db`: un flusso positivo che asserisce solo la pagina passa anche con un backend che non ha scritto niente. Il controllo guarda la FORMA (import + chiamata), non se l'asserzione e' quella giusta
```

Prima della correzione questo giro sarebbe stato **verde**. La lezione e' la stessa dei primi due: i
test della regola usavano frammenti con **un solo import**, cioe' una forma che nella realta' non
esiste mai. Un test che non somiglia all'input vero non e' un test della regola, e' un test della
fixture.

## 5. Verifica avversaria delle references

Le quattro references sono state scritte e poi passate a una verifica avversaria indipendente, con il
compito di smentirle contro il codice invece che di riscriverle. Cosa ha trovato, in sintesi:

- l'affermazione sul parser che ha portato al difetto §4.1 (era stata **misurata**, non dedotta: e'
  cosi' che il buco e' emerso);
- un esempio di spec che il gate avrebbe bocciato per una variabile inutilizzata — cioe' una reference
  che insegnava a scrivere codice che il suo stesso gate rifiuta;
- un `.skip` d'esempio etichettato «issue» che, per via del commento sulla riga sopra, il gate
  considerava motivato: i due esempi «issue» e «pass» erano indistinguibili;
- un regex citato senza il flag `/m`, un helper d'esempio che non girava senza una variabile
  d'ambiente, due regole senza il loro perche', un attacco descritto con il token in `localStorage`
  (vero per `supabase-js` nel browser, falso per `@supabase/ssr`, che e' lo stack di default del
  `CLAUDE.md`).

Tutti corretti nei file. Dopo le correzioni §4.1 e §4.2 le references sono state ripassate una seconda
volta contro il codice nuovo.

## 6. Punti di attrito con la `SKILL.md` (spec issues)

Nessuno grave: la `SKILL.md` non e' stata modificata. Tre tensioni, dichiarate qui perche' chi la
rileggera' le incontrera'.

1. **`contratto-uscita` fa un controllo in piu' di quanto la tabella dichiari.** La riga della `SKILL.md`
   parla solo dell'handoff; l'implementazione verifica anche che `playwright.config.ts` esista e
   dichiari `retries: 1`. Motivo: `retries = 1` e' una **regola non negoziabile** della skill e nessun
   passo la guardava — un progetto con `retries: 3` avrebbe avuto il gate verde e i flaky invisibili.
   Non e' un passo nuovo (YAGNI rispettato), e' una regola dentro il passo che gia' si chiama «contratto
   d'uscita» e la cui lista, nella `SKILL.md` stessa, comprende `playwright.config.ts`. Se il
   proprietario preferisce la lettera, si toglie in tre righe — ma allora `retries` non lo verifica
   nessuno, e va scritto.
2. **`app-viva` e il «seed applicato».** La `SKILL.md` chiede «seed applicato»; il gate conta tabelle e
   righe negli schemi esposti. Sa che il database non e' vuoto, non sa che dentro ci sia quello che
   serve ai flussi: quale tabella porti il seed e' conoscenza di progetto. E' un limite dichiarato, non
   una svista.
3. **`webServer` di Playwright.** La `SKILL.md` (§Comando → procedura, `forge`) lo elenca come
   «opzionale»; `references/playwright.md` prescrive di **non** usarlo. Non e' una contraddizione
   formale (opzionale comprende assente) ma la ragione va scritta: se e' Playwright ad accendere l'app,
   il passo `app-viva` non misura piu' niente, e quella premessa e' meta' del valore del gate.

## 7. Gate di chiusura della fase

| Voce | Esito |
|---|---|
| 4 references scritte, zero `TODO`, ogni regola col suo perche' | **PASS** — 1285 righe, verificate due volte contro il codice |
| `verify.mjs` + lib pura + test, `node --test` verde, id e ordine bloccati da un test | **PASS** — 79 test, tre dei quali bloccano id e ordine |
| ESLint 0/0, knip pulito sugli script dell'agente | **PASS** — piu' jscpd a 0 cloni |
| Corsa verde VERDE 7/7 incollata | **PASS** — §3.1 |
| Sabotaggio: rosso per il motivo GIUSTO, poi verde dopo il ripristino | **PASS** — §3.2, quattro classi invece della sola richiesta |
| Tre corse MANCANTE incollate | **PASS** — §3.3 |
| `retries = 1` e dichiarazione del secondo tentativo visibili nell'uscita | **PASS** — §3.2 classe D |
| Template + configurazione ESLint in `resources/` | **PASS** |
| `STATO.md` con numeri misurati e punti aperti onesti | **PASS** |
| `COSTRUZIONE-<data>.md` | **PASS** — questo file |
| Junction creata, skill invocabile | **PASS** — `.claude/skills/flow-sentinel` → `agenti/flow-sentinel` |
| Commit su `agente/flow-sentinel`, in italiano, niente fuori dal perimetro | **PASS** |
| `code-inquisition` sui punti critici | **MANCANTE** — non eseguito; `semgrep` e `gitleaks` non installati |
| Collaudo avversario indipendente | **MANCANTE per progetto** — e' la fase P2 |

## 8. Proposte per il coordinatore

Cose fuori dal perimetro di questa fase, che qualcuno con i permessi deve decidere.

1. **`scripts/installa-skill.ps1`: aggiungere flow-sentinel.** La junction e' stata creata a mano
   (`New-Item -ItemType Junction -Path .claude\skills\flow-sentinel -Target (Resolve-Path agenti\flow-sentinel).Path`,
   percorso assoluto obbligatorio, DECISIONI.md §7). Va nell'installatore, o la prossima macchina non ce
   l'ha.
2. **`README.md`: aggiornare la riga di Flow Sentinel** da «scaffold/progettata» a «costruita, gate a 7
   passi, 79 test, non ancora provata su un progetto cliente».
3. **`DECISIONI.md`: tre voci nuove.**
   - *La firma sta sulla riga della firma.* Una riga di contratto lasciata a meta' non vale come
     compilata: le classi di spazi dei regex che leggono i verdetti ammettono i soli spazi orizzontali.
     Nasce dal difetto §4.1 e vale per tutti gli agenti che leggono una riga di forma fissa.
   - *Quale riga di `where` si esegue.* Estensione del precedente sugli shim (`formaEseguibile`): non
     basta sapere **come** lanciare, bisogna scegliere **quale** delle righe che `where` restituisce.
     Nasce dal difetto §4.2.
   - *Il gate verifica la configurazione del runner, non solo l'handoff.* La regola «retries = 1» e' non
     negoziabile e non era verificata da nessuno: un obbligo scritto e mai controllato e' un obbligo che
     dura fino al primo che ha fretta (§6.1).
4. **Schema Forge ha la stessa forma di regex, e il buco c'e' — piu' stretto.** Non l'ho toccato:
   `agenti/schema-forge/` e' fuori dal mio perimetro. **Misurato** chiamando la sua `contrattoUscita`:

   ```
   PASS — riga `Gate:` vuota, poi una riga che COMINCIA con VERDE
   FAIL — riga `Gate:` vuota, poi prosa che contiene VERDE piu' avanti
   ```

   Cioe': un handoff con `Gate:` lasciato vuoto e la parola `VERDE` a inizio della riga seguente passa
   il passo `contratto-uscita` di Schema Forge. E' piu' stretto del difetto §4.1 (li' il gruppo
   catturato era «qualsiasi testo», qui deve essere esattamente `VERDE` o `ROSSO`), ma e' lo stesso
   errore. La correzione e' identica: spazi orizzontali soltanto.
5. **Il banco `banco-prova-flow/` resta usa e getta**, come vuole la §12. Se P2 lo trasformasse nel caso
   di prova di un difetto che deve restare riproducibile, allora varrebbe la §20 e andrebbe tracciato —
   con l'eccezione `.gitignore` ristretta agli artefatti di runtime.
