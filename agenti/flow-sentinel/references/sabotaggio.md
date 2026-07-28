# Il sabotaggio

Legge n°3: **un test che non può fallire non è un test**. Una batteria verde non dimostra niente finché nessuno l'ha vista diventare rossa: il verde è compatibile con «tutto funziona» e con «nessuno ha guardato», e dall'esterno i due casi hanno lo stesso aspetto. L'unico modo di distinguerli è rompere l'applicazione in un punto noto e verificare che la rete se ne accorga.

Il gate (`scripts/verify.mjs`) misura la **forma**: che ogni flusso dichiarato abbia una spec, che le spec importino e chiamino `e2e/helpers/db`, che la batteria sia girata davvero contro un'app viva. Non può misurare la **sostanza**: non sa se quell'asserzione guarda la riga giusta, se il flusso ostile controlla il contenuto negato o solo l'URL, se il `expect` che sta leggendo dimostra qualcosa. Il sabotaggio è la procedura che misura la sostanza, e la misura una volta sola: al collaudo.

## Quando si esegue

- **Al collaudo della batteria**, cioè quando la rete di sicurezza nasce: dopo `forge`, dopo il primo `run` verde e dopo il primo `verify` VERDE — quindi con l'handoff **già scritto**, perché `contratto-uscita` resta rosso finché `docs/handoff/12-flow-sentinel.md` non esiste e non dichiara il verdetto (in `SKILL.md`, Flusso 1: `handoff` è il passo 5, `verify` il 6). Si sabota prima di dichiarare consegnabile la rete: è la casella «la batteria è stata provata col sabotaggio almeno una volta» del gate di chiusura in `SKILL.md`.
- **Di nuovo quando la batteria cambia in modo sostanziale**: un flusso nuovo confermato dallo Specchio, un helper di verifica DB riscritto, il passaggio a un altro modello di autenticazione. Non a ogni `evolve` che aggiunge un `expect`: si risabota ciò che è cambiato, non tutto.

**Non a ogni giro del gate**, e il motivo non è il tempo che costa: il sabotaggio **modifica il codice dell'applicazione**, e un gate che modifica ciò che verifica non è più un gate — è un processo che produce lo stato che poi misura. Il gate deve poter girare mille volte lasciando invariato ogni file versionato — i suoi unici residui sono `test-results/` e `playwright-report/`, che il progetto gitignora; il sabotaggio invece tocca il codice per costruzione, e chiede a qualcuno di ripulirlo.

**Chi lo esegue è una persona**, o l'agente su richiesta esplicita di una persona. Non è un passo automatico e non finisce in uno script: richiede di decidere dove piantare il difetto, di leggere *perché* il rosso è arrivato, e di distinguere un rosso giusto da un rosso fortunato. Il risultato si scrive nel verbale di collaudo — vedi §Cosa si scrive nel verbale.

## La procedura

Il comando è sempre lo stesso, dalla radice del progetto generato (il gate legge `process.cwd()`):

```bash
node <skill>/scripts/verify.mjs
```

I passi, in ordine:

1. **Batteria verde di partenza, verificata.** Si lancia il gate e si legge la riga di testa: `GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)`. Si annota il conteggio del passo `playwright` (`N file di spec · M passati, 0 falliti, 0 saltati`): è il metro di paragone di tutto ciò che segue. Perché serve verificarlo e non ricordarlo: se la partenza era già rossa, il rosso che arriva dopo il sabotaggio non è merito del sabotaggio, e non si sta collaudando niente.
2. **`git status` pulito.** Prima di rompere si controlla che non ci sia già altro rotto. Un sabotaggio piantato sopra modifiche non committate è irripristinabile con `git restore`, e il ripristino diventa un lavoro a memoria.
3. **Si pianta UN difetto per volta.** Una classe alla volta, un file alla volta, la modifica più piccola che produce il difetto voluto.
4. **Si rilancia il gate.**
5. **Si verifica che il rosso arrivi dal passo giusto e per il motivo giusto.** Non basta che il gate chiuda ROSSO: si legge quale passo è `FAIL`, quale spec compare fra i falliti, e — nel caso della classe B — **quale asserzione** ha ceduto. Un rosso dal passo sbagliato è un rosso che non risponde alla domanda posta.
6. **Si ripristina** con `git restore <file>` (o `git checkout -- <file>`) del file toccato, **mai a memoria**: la modifica inversa scritta a mano lascia differenze di formattazione, righe vuote, importazioni orfane — e il giorno in cui ne lascia una che conta, il difetto vero è stato introdotto da chi doveva cercarli.
7. **Si rilancia e si verifica che torni verde**, con lo stesso conteggio del passo 1.

### Le due regole della procedura

- **Un difetto per volta.** Due difetti insieme e non si sa quale dei due ha prodotto il rosso: se il primo è sufficiente a far fallire la spec, il secondo non è stato collaudato affatto e resta la sola cosa che si credeva di aver provato.
- **Il difetto deve lasciare l'app viva.** Se il sabotaggio impedisce la compilazione o fa rispondere 500, il passo `app-viva` diventa `MANC` (`l'app risponde 500 … è accesa ma rotta`, oppure l'app non risponde), e a quel punto `playwright` è `MANC` a sua volta — `premessa mancante (passo app-viva): la batteria non è stata lanciata`. Il gate chiude ROSSO, ma per due verifiche mancanti, non per una spec che ha visto il difetto: **il sabotaggio non ha provato niente**. Un difetto di runtime dentro un'azione (che scatta quando il flusso ci passa) collauda; un difetto che rompe il build no.

### Il rosso che arriva sempre in coppia

Ogni sabotaggio che rende rosso il gate — le classi A, B, C **ed E** — fa fallire **due** passi, non uno. Il secondo è `contratto-uscita`:

```
FAIL  contratto d'uscita (handoff + configurazione)
        docs/handoff/12-flow-sentinel.md dichiara `Gate: VERDE` ma il gate chiude ROSSO:
        l'handoff parla di un'altra esecuzione. Riscrivilo con i residui di QUESTA
```

È corretto e va previsto: `contrattoUscita` confronta la riga `Gate:` dell'handoff con il verdetto dei sei passi precedenti (`verdettoDa()` dà ROSSO se anche uno solo non è `pass` — DECISIONI.md §19), e durante il sabotaggio uno di quei sei è rosso mentre l'handoff — scritto sulla batteria sana — dichiara `Gate: VERDE`. **Durante il sabotaggio l'handoff non si riscrive**: riscriverlo significherebbe dichiarare rosso uno stato che si sta per annullare, e al ripristino andrebbe riscritto di nuovo. Il secondo rosso sparisce da solo al passo 7, e la sua sparizione è parte della verifica di ripristino.

La classe D è l'eccezione: lascia il gate verde, quindi `contratto-uscita` resta verde.

---

## I difetti da piantare

### Classe A — un flusso genuinamente rotto

L'azione dell'utente non porta a termine il suo lavoro. È il caso banale, e si pianta per primo perché stabilisce che la catena — browser, app viva, database, reporter, gate — è collegata: se non si accorge nemmeno di questo, tutto ciò che segue è rumore.

```ts
// src/modules/ordini/azioni.ts — sabotaggio classe A (da rimuovere)
export async function creaOrdine(dati: DatiOrdine) {
  // il difetto scatta quando il flusso ci passa, non alla compilazione:
  // l'app resta viva e il passo `app-viva` resta verde
  throw new Error("sabotaggio classe A: il salvataggio solleva");
}
```

Variante equivalente e altrettanto valida: scollegare il bottone (`onSubmit` rimosso, `action` che non punta più alla server action) — rompe il flusso prima ancora della scrittura.

**Rosso atteso:** passo `playwright`, con la spec di quel flusso fra i falliti.

```
FAIL  batteria Playwright (il browser giudica)
        7 file di spec · 11 passati, 1 falliti, 0 saltati
        falliti:
          - e2e/checkout.spec.ts › il cliente completa il checkout @flusso:checkout-ospite
```

**Se resta verde:** la spec non percorre davvero quel flusso. O si ferma prima dell'azione (naviga, compila, e non invia), o l'azione che invoca non è quella sabotata — succede quando la spec attacca un endpoint di comodo invece del percorso dell'utente. In entrambi i casi la spec va riscritta: sta guardando una pagina, non un flusso.

### Classe B — la UI mente

**È la trappola che motiva la terza legge, ed è il difetto più importante di tutto il collaudo.** L'azione riporta successo e non scrive niente: si toglie l'`insert` (o l'`update`) dalla server action e si **lascia** il messaggio di successo, il redirect, il toast verde. Dal punto di vista del browser non è cambiato assolutamente nulla.

```ts
// src/modules/ordini/azioni.ts — sabotaggio classe B (da rimuovere)
export async function creaOrdine(dati: DatiOrdine) {
  // const { error } = await supabase.from("orders").insert(dati);
  // if (error) throw error;
  // la scrittura è sparita, il successo no: la UI mente
  redirect("/ordini/grazie");
}
```

**Rosso atteso:** passo `playwright`, **e il fallimento deve essere l'asserzione sull'effetto DB**, non l'asserzione sulla pagina. Il gate da solo non basta a saperlo: `dettaglioPlaywright` stampa il **nome** della spec fallita, non il messaggio dell'`expect` che ha ceduto. Quale asserzione sia caduta si legge rilanciando quella sola spec fuori dal gate (`npx playwright test e2e/checkout.spec.ts`), oppure nella traccia del secondo tentativo (`test-results/…/trace.zip`: esiste perché `forge` prescrive `trace: on-first-retry` e un test fallito viene ritentato). L'`expect` che cede dev'essere quello che ha interrogato il database attraverso `e2e/helpers/db`, e il messaggio dice che la riga attesa non c'è.

**Se fallisce invece l'asserzione sulla pagina**, la spec sta guardando la cosa sbagliata: significa che il messaggio di successo è arrivato dopo la scrittura e la sabotatura ha cambiato anche la pagina, cioè il sabotaggio è stato piantato male (si è tolto troppo). Si ripristina, si ripianta lasciando intatto tutto ciò che l'utente vede, e si ripete.

**Se resta VERDE, quella spec non asserisce l'effetto e va riscritta.** È il difetto più grave che questo collaudo possa trovare, e il gate **non lo vede**: il passo `effetto-db` verifica che la spec **importi e chiami** `e2e/helpers/db` — la forma, non la semantica; il suo stesso messaggio lo dichiara (*«Il controllo guarda la FORMA (import + chiamata), non se l'asserzione è quella giusta»*). Una spec che chiama l'helper e poi non asserisce sul valore che ha ricevuto, o che asserisce su una riga già presente nel seed, passa il gate e passa il sabotaggio B. Il rimedio è la lettura dell'asserzione riga per riga: deve riguardare **la riga che l'azione ha appena creato** e un valore che prima non c'era.

Va piantato una volta **per ogni flusso positivo** dichiarato, non una sola volta in tutto: è l'unico controllo che dimostra che quella specifica asserzione di effetto è viva.

### Classe C — una rotta ostile lasciata aperta

Si toglie il controllo di ruolo (o il redirect) dall'area riservata, lasciando la rotta raggiungibile a chi non deve entrarci.

```tsx
// src/app/admin/layout.tsx — sabotaggio classe C (da rimuovere)
import type { ReactNode } from "react";

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const profilo = await profiloCorrente();
  // if (profilo?.ruolo !== "admin") redirect("/");   ← il controllo tolto
  return <ShellAdmin>{children}</ShellAdmin>;
}
```

**Rosso atteso:** la spec del flusso ostile **di lettura** fallisce (`@flusso:admin-negato-al-cliente` o come si chiama nel contratto), sempre dentro il passo `playwright`.

**Se resta verde, la spec sta asserendo l'URL invece del contenuto negato.** È l'errore standard dei test ostili: si verifica `expect(page).toHaveURL("/")` dopo il redirect, e quando il redirect sparisce l'asserzione continua a passare perché la pagina è comunque una pagina. Un flusso ostile si asserisce sul **contenuto**: che l'elemento riservato non sia visibile, che il dato altrui non compaia, che la risposta sia quella di rifiuto. Il gate qui non aiuta per costruzione: `TIPI_CON_EFFETTO_DB` esclude `ostile-lettura` — un attacco in lettura non cambia niente, non c'è stato da confrontare — quindi per questa classe di flussi il sabotaggio è **l'unica** verifica di sostanza che esista.

**Variante C-client — il rifiuto che arriva dopo la consegna.** Il controllo non sparisce: si sposta dal server al browser. La pagina riservata viene servita per intero e poi un `useEffect` (o un guard in un componente client) rimanda l'utente altrove.

```tsx
// src/app/staff/page.tsx — sabotaggio C-client (da rimuovere)
  const profilo = await profiloCorrente();
  if (!profilo) redirect("/accesso");
- if (profilo.tipo !== "staff") redirect("/area");     ← il controllo tolto dal server
+ <RimandaSeNonStaff staff={profilo.tipo === "staff"} />  ← e rifatto nel browser
```

È la variante che conta di più, perché **lascia intatte tutte le asserzioni che una spec ostile scrive di solito**: l'URL finale è quello lecito (il redirect avviene davvero), e ogni `getByText(...).toHaveCount(0)` gira sulla pagina *dopo* la sostituzione, quindi la trova pulita. Misurato il 2026-07-28 sul banco `palestra` del collaudo: il corpo servito al socio conteneva `Area staff`, `Nuovo corso` e `Crea corso`; batteria **verde 6 su 6**, gate **VERDE 7/7**. Con l'asserzione riscritta sul corpo della risposta di navigazione (`references/playwright.md` §Lettura negata) lo stesso sabotaggio ha reso rossa quella spec, e solo quella.

Se il gate resta verde su questa variante, non serve concludere niente sulla RLS: **la spec ostile guarda il DOM invece del corpo servito**, e va riscritta prima di poter dire qualsiasi cosa su quella porta.

Per un flusso `ostile-scrittura` la variante è la stessa idea sull'altra faccia: si toglie la policy o il controllo che impedisce la scrittura vietata e si verifica che la spec fallisca sull'asserzione «il database non è cambiato». Se resta verde, la spec ha asserito solo ciò che si vede in pagina: in Postgres una scrittura negata da RLS non solleva niente, tocca **0 righe senza errore**, quindi l'app può mostrare lo stesso identico esito prima e dopo il sabotaggio. L'unica asserzione che distingue l'attacco respinto da quello riuscito è quella sul database — la riga vietata non c'è, o il valore non è cambiato.

### Classe D — il test instabile

Si fa fallire un test **solo al primo tentativo**, per provare che la dichiarazione del secondo tentativo esiste davvero e si vede anche sul verde.

```ts
// e2e/checkout.spec.ts — sabotaggio classe D (da rimuovere)
test("il cliente completa il checkout @flusso:checkout-ospite", async ({ page }, testInfo) => {
  // fallisce al primo giro, passa al secondo: è la definizione di flaky
  if (testInfo.retry === 0) throw new Error("sabotaggio classe D: instabilità simulata");
  // …il resto della spec, invariato
});
```

**Atteso: gate comunque VERDE**, e il dettaglio del passo `playwright` che **nomina** il test:

```
OK    batteria Playwright (il browser giudica)
        7 file di spec · 12 passati, 0 falliti, 0 saltati
        passati al SECONDO tentativo (retries = 1) — instabili, non verdi:
          - e2e/checkout.spec.ts › il cliente completa il checkout @flusso:checkout-ospite
```

Perché il verde è l'esito giusto e non un difetto del gate: con `retries = 1` un test passato al secondo colpo è `pass` — nel vocabolario di Playwright è `flaky`, e `registra()` lo conta fra i passati — ma la riga si stampa **anche sul verde**, perché un test che passa una volta su due non è uguale a un test che passa, e una riga che si vedesse solo sul rosso non la leggerebbe nessuno. Questa classe collauda esattamente quella riga: è l'unico modo di sapere che il giorno in cui un flaky vero comparirà, comparirà anche il suo nome.

**Se il gate diventa rosso**, il secondo tentativo non c'è stato e `retries` non vale 1. Dentro il gate decide **solo** `playwright.config.ts`: `verify.mjs` lancia `npx playwright test --reporter=json` e non passa nessun `--retries`, ed è quel file che `contratto-uscita` controlla. Un `--retries=0` scritto in uno script npm o digitato a mano scavalca la configurazione quando la batteria si lancia fuori dal gate, non quando la lancia il gate: se il rosso arriva lì, è la configurazione a dire un numero diverso da 1. **Se il gate è verde e il nome non compare**, il reporter JSON non sta arrivando al gate come dovrebbe (o la spec sabotata non è quella che si crede): un'instabilità invisibile è il modo in cui un flaky diventa normale.

### Classe E — una regola statica (collaudo del gate, non della batteria)

Le quattro classi precedenti collaudano **la batteria**. Questa collauda **il gate**, ed è dichiarata a parte perché risponde a un'altra domanda: non «le spec sanno fallire?» ma «le regole scritte in `gate-lib.mjs` scattano davvero su questo progetto?».

```ts
// e2e/checkout.spec.ts — sabotaggio classe E (da rimuovere)
test.only("il cliente completa il checkout @flusso:checkout-ospite", async ({ page }) => {
```

**Rosso atteso:** passo `lint-spec`, con la posizione esatta:

```
FAIL  lint delle spec
        [block] e2e/checkout.spec.ts:12: `.only` committato: il resto della batteria
        non gira, e il verde che ne esce non ha guardato niente
```

E, se `playwright.config.ts` dichiara `forbidOnly: true` come prescrive `forge`, **anche** il passo `playwright` diventa rosso — ma con una riga che comincia per `errore del runner:`, non con una spec fra i falliti: Playwright si rifiuta di eseguire. Sono due rossi con due significati diversi e vanno letti come tali.

**Se resta verde:** il `.only` è stato piantato su una riga che `regoleSpec` salta. Il controllo ignora le righe di commento (una reference che *parla* di `.only` non deve far fallire il gate), quindi un `.only` dentro un commento non collauda niente. Va piantato su codice eseguibile.

Varianti della stessa classe, tutte con lo stesso ripristino: uno `.skip` senza commento accanto (atteso: `[issue]`, il passo resta rosso solo se c'è anche un `block`, altrimenti l'issue si stampa e non blocca); una `page.waitForTimeout(500)` (atteso: `lint-spec` rosso via ESLint, `no-restricted-syntax`); un flusso tolto da `docs/flussi-critici.md` lasciando la spec al suo posto (atteso: `[warn]` di etichetta orfana su `spec-coverage`, che **resta verde** — un warn si stampa e non blocca: qui si collauda che il rilievo compaia, non che fermi il gate); una spec cancellata lasciando il flusso dichiarato (atteso: `[block]` di flusso scoperto, e `spec-coverage` rosso).

---

## Tabella riassuntiva

| Difetto | Dove si pianta | Passo che deve diventare rosso | Se resta verde, cosa vuol dire |
|---|---|---|---|
| **A** — il flusso è rotto (l'azione solleva, il bottone è scollegato) | `src/modules/<dominio>/…` o il componente del form | `playwright` — la spec di quel flusso fra i falliti | la spec non percorre il flusso: si ferma prima dell'azione, o invoca un percorso di comodo invece di quello dell'utente |
| **B** — la UI mente (successo dichiarato, niente scritto) | la server action: via l'`insert`/`update`, resta il messaggio di successo | `playwright` — e a cedere dev'essere l'**asserzione di effetto DB** | **il difetto più grave che questo collaudo trova**: quella spec non asserisce l'effetto. Il passo `effetto-db` non se ne accorge, guarda import e chiamata. Riscrivere la spec |
| **B′** — cede l'asserzione sulla pagina invece di quella sul DB | come sopra | `playwright`, ma sull'`expect` sbagliato | il sabotaggio è stato piantato male (tolto anche il messaggio di successo): ripiantarlo lasciando intatto ciò che l'utente vede |
| **C** — rotta ostile aperta (via il controllo di ruolo o il redirect) | `src/app/<area riservata>/layout.tsx` o il middleware | `playwright` — la spec del flusso `ostile-lettura` | la spec asserisce l'URL invece del contenuto negato. Per gli `ostile-lettura` il gate non ha nessun altro controllo: qui il sabotaggio è l'unica prova |
| **C-client** — il controllo di ruolo spostato dal server al browser (`useEffect` che rimanda via) | la pagina riservata: via il `redirect` del server, dentro il guard nel client | `playwright` — la spec `ostile-lettura`, **e solo se asserisce sul corpo della risposta** | la spec guarda il DOM dopo il redirect, cioè la pagina lecita: la fuga è già stata consegnata. Misurato: verde 6/6 e gate VERDE 7/7 con l'area riservata nel corpo servito |
| **C′** — scrittura vietata lasciata passare | la policy o il controllo che la nega | `playwright` — la spec del flusso `ostile-scrittura` | la spec asserisce il messaggio d'errore e non che il database è rimasto fermo: in Postgres una scrittura negata può toccare 0 righe **senza errore** |
| **D** — instabile al primo tentativo (`testInfo.retry === 0`) | dentro la spec | **nessuno: il gate resta VERDE** — ma il dettaglio di `playwright` nomina il test fra i «passati al SECONDO tentativo» | se il nome non compare, l'instabilità è invisibile; se il gate diventa rosso, `retries` non vale 1 |
| **E** — `test.only` committato | dentro la spec | `lint-spec` (`block`, con file e riga) — e `playwright` con `errore del runner:` se `forbidOnly` è attivo | è stato piantato in un commento: `regoleSpec` salta le righe di commento apposta |
| *(in tutte le classi tranne D)* | — | `contratto-uscita`, perché l'handoff dichiara `Gate: VERDE` e il gate chiude ROSSO | l'handoff dichiara già `Gate: ROSSO` — la partenza non era verde (passo 1 della procedura saltato) o qualcuno l'ha riscritto durante il sabotaggio. Un handoff **senza** riga `Gate:` non lascia verde il passo: lo fa fallire con un altro messaggio |

---

## Il ripristino

Si ripristina **subito dopo aver letto il rosso**, prima di piantare il difetto successivo. Il comando è quello, non la modifica inversa:

```bash
git restore src/modules/ordini/azioni.ts      # oppure: git checkout -- <file>
git status --porcelain                        # deve non stampare nulla sui file dell'app
node <skill>/scripts/verify.mjs
```

Il ripristino è completo quando valgono **tutte e tre**:

1. `GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)` — stesso numero di passi, stessi zeri;
2. il dettaglio del passo `playwright` riporta **lo stesso conteggio** annotato al passo 1 della procedura (`N file di spec · M passati, 0 falliti, 0 saltati`), e nessuna riga «passati al SECONDO tentativo» che prima non c'era;
3. `git status` pulito sui file dell'applicazione e delle spec. Gli artefatti di Playwright (`test-results/`, `playwright-report/`) restano fuori dal conteggio perché sono gitignorati: se compaiono in `git status`, il `.gitignore` del progetto è incompleto ed è un difetto a sé.

Perché conta più del sabotaggio stesso: **un sabotaggio dimenticato in casa è un difetto vero introdotto da chi doveva cercarli**. La classe B è la peggiore da dimenticare — l'app continua a funzionare, il messaggio di successo arriva, e l'unico segnale è una spec rossa che qualcuno, sapendo di aver sabotato quel giorno, potrebbe scambiare per un residuo del collaudo.

## Cosa si scrive nel verbale

Per ogni difetto piantato, nel verbale di collaudo del progetto:

1. **Classe e file toccato**, con lo snippet della modifica (tre righe bastano: si deve poter ripiantare lo stesso difetto fra sei mesi).
2. **L'uscita del gate PRIMA**, incollata — almeno la riga di testa e il blocco del passo `playwright` col suo dettaglio.
3. **L'uscita del gate DOPO**, incollata — la riga di testa, il passo diventato rosso con tutto il suo dettaglio, e il nome della spec fallita così come lo stampa il gate.
4. **Quale asserzione ha ceduto**, per la classe B: il messaggio dell'`expect`, preso dal rilancio della sola spec fuori dal gate o dalla traccia del secondo tentativo — il dettaglio del gate si ferma al nome della spec. È l'unico dato che distingue un sabotaggio B superato da uno fallito.
5. **L'uscita dopo il ripristino**, incollata, con i tre controlli della §Il ripristino.

**Perché incollata e non riassunta:** «il gate è diventato rosso» è un ricordo, l'uscita è una prova. Un riassunto non permette di verificare che il rosso venisse dal passo giusto, non conserva il nome della spec, e non distingue un `FAIL` da un `MANC` — cioè confonde «la batteria ha visto il difetto» con «la batteria non è stata lanciata», che è esattamente la distinzione per cui questo collaudo esiste. Per un verbale che un altro programma deve leggere, `verify.mjs --json` dà lo stesso verdetto con gli `id` stabili (`playwright`, `lint-spec`, `contratto-uscita`) e non cambia quando cambiano le etichette italiane.

Se il verbale del progetto non esiste, le stesse informazioni vanno in `docs/handoff/12-flow-sentinel.md` sotto «cosa ha fatto»: la casella del sabotaggio nel gate di chiusura è spuntabile solo da chi può indicare dove sta la prova.

## Cosa il sabotaggio NON prova

- **Prova che quelle spec possono fallire su quei difetti**, non che la batteria trovi ogni difetto. Un flusso può restare rotto in dieci modi che nessuno ha piantato; il sabotaggio dice che la spec non è cieca, non che è completa.
- **I flussi non dichiarati restano fuori anche dal sabotaggio.** Si può sabotare solo ciò che qualcuno ha deciso di attaccare: un'area dell'app che non compare in `docs/flussi-critici.md` non ha spec, quindi non ha niente da far fallire, e romperla non produce nessun rosso. Il buco non è nel collaudo, è nell'elenco confermato — ed è il motivo per cui lo Specchio dei flussi viene prima e la copertura è un `block`.
- **Non prova che l'asserzione guardi il dato giusto.** Una spec che asserisce su una riga già presente nel seed sopravvive alla classe B senza aver visto niente di ciò che l'azione ha scritto. Il sabotaggio riduce lo spazio dei falsi verdi, non lo azzera: quello che resta si chiude leggendo l'asserzione.
- **Non prova che la batteria sia stabile.** La classe D collauda la *dichiarazione* dell'instabilità, non l'assenza di instabilità: un test che passa due volte su tre continuerà a passare due volte su tre, e si vedrà solo quando comparirà nell'elenco dei secondi tentativi.
- **Non collauda gli altri passi del gate.** La classe E ne prova alcuni sulle spec (`lint-spec`, `spec-coverage`); `effetto-db` e `contratto-uscita` hanno i loro test in `scripts/gate-lib.test.mjs` e `scripts/verify.test.mjs`, che è il posto giusto: si eseguono a ogni modifica, senza rompere niente in casa di nessuno. Di `app-viva` quei test coprono le **regole pure** — URL dell'app, porta del database, schemi esposti, SQL del seed, righe di `psql` — e, dall'integrazione, il fatto che senza `supabase/config.toml` il passo esca MANCANTE; la sonda HTTP e l'interrogazione vera del database non ce l'hanno, e le prova solo un giro del gate su un progetto acceso.
- **Non dice niente su ciò che non passa dal browser.** Job pianificati, webhook, invii di posta, integrazioni: sono fuori dal perimetro di Flow Sentinel prima ancora che dal sabotaggio, e restano da verificare altrove.

Il sabotaggio è la prova che la rete esiste. Che sia larga abbastanza lo decide l'elenco dei flussi, e quello lo firma una persona.
