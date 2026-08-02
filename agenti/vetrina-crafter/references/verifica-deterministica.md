# La verifica deterministica — specifica del gate

> **Scritta in P0, prima del flusso operativo** (template, passo 3) e prima di una riga
> di codice: è la specifica che P1 deve implementare in `scripts/verify.mjs`, non la
> descrizione di qualcosa che esiste già. Finché `scripts/` contiene solo il `.gitkeep`,
> questo documento è un progetto — e va letto come tale.
>
> Da caricare prima di toccare il gate, e ogni volta che si aggiunge una regola.

Legge n°2: **giudica l'app servita, non il sorgente**. Una pagina "sembra pronta" solo
finché non la serve una build di produzione e qualcuno la legge da lì. Perciò il gate
non parte dall'esito: **prima misura la premessa** — il contratto c'è ed è firmato, i
file esistono e sono contati, l'app risponde ed è quella di questo progetto, il
database è raggiungibile. Dove la premessa manca il passo è una **verifica mancante**,
mai un `pass`: un verde su niente è peggio di un rosso, perché viene creduto
(`DECISIONI.md` §18).

```bash
# dalla radice del PROGETTO generato, non dalla cartella della skill
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3100
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3100 --json      # per l'orchestratore
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3100 --db-url postgresql://…
```

## La pipeline

**L'ordine di questa tabella è il gate.** Un passo spostato più avanti cambia cosa il
gate aveva guardato nel momento in cui ha deciso: i primi cinque non hanno bisogno
dell'app accesa, gli altri sì, e l'ultimo guarda i nove precedenti. Un test di P1 blocca
gli `id` e il loro ordine (`DECISIONI.md` §15).

| # | `id` | Premessa misurata prima | Esito letto | Se la premessa manca |
|---|---|---|---|---|
| 1 | `contratto-vetrina` | `docs/vetrina.md` esiste ed è leggibile | pagine dichiarate, righe obbligatorie, riga `Confermato da:` con data | MANCANTE |
| 2 | `tipi` | `tsconfig.json` nel progetto e `typescript` risolvibile | `tsc --noEmit` esce 0 | MANCANTE |
| 3 | `cucitura-ui` | `vetrina.config.json` leggibile, cucitura esistente e non vuota, almeno una primitiva dichiarata | import fuori dalla cucitura, import di dominio dentro la cucitura | MANCANTE |
| 4 | `chiavi-e-client` | almeno un file sorgente letto sotto la radice pubblica | chiavi di servizio, client fuori dai moduli dichiarati | MANCANTE |
| 5 | `a11y-statica` | ESLint risolvibile nella cartella della **skill**, almeno un file JSX da lintare | `eslint-plugin-jsx-a11y` con la configurazione della skill | MANCANTE |
| 6 | `app-identita` | un URL dichiarato o passato; `.next/BUILD_ID` esiste; l'app risponde | il `BUILD_ID` servito è quello di questo progetto, e non è una dev server | MANCANTE |
| 7 | `pagine-vive` | passo 1 con un elenco di pagine **e** passo 6 `pass` | ogni rotta dichiarata risponde; ogni rotta pubblica servita è dichiarata | MANCANTE |
| 8 | `segnaposto-serviti` | almeno una pagina scaricata dal passo 7 | `{{…}}`, *lorem ipsum*, formule del template nel testo servito | MANCANTE |
| 9 | `contenuti-vivi` | slot dichiarati (o `Nessuno slot.`); `psql` nel PATH; database risolto | il testo dello slot è nel database e in pagina e **non** nei sorgenti; le fonti sono leggibili dall'anonimo | MANCANTE |
| 10 | `contratto-uscita` | nessuna: legge sempre | handoff senza segnaposto, riga `Gate:` coerente coi nove passi | non si applica: `pass` o `fail` |

Dieci passi sono più dei sette di gestionale-crafter, flow-sentinel e speed-demon, e più
dei nove di schema-forge. Il motivo è che ognuno costa poco — una lettura di file, una
`fetch`, una query — e che questo è l'unico agente il cui prodotto lo legge chi non ci
ha mai parlato. **Se in P1 due passi si rivelano lo stesso passo, si fondono allora**,
con la misura in mano, non adesso per simmetria.

## Le due fonti, e perché sono due

Il gate legge **due** file del progetto, e la divisione non è organizzativa: è la
differenza fra ciò che qualcuno ha deciso e ciò che è vero del progetto.

- **`docs/vetrina.md` — le decisioni, firmate.** Pagine, cosa mostra ciascuna, fonti,
  slot, esclusioni, dati visibili a un anonimo, percorsi di scrittura pubblici, URL
  servito, tabella dei contenuti, soglia distintiva. Ha una riga `Confermato da:` perché
  ogni riga qui dentro è una scelta che qualcuno ha preso.
- **`vetrina.config.json` — le coordinate, generate.** Dove stanno le cose in questo
  progetto. Nessuna decisione, nessuna firma.

```json
{
  "radicePubblica": "src/app",
  "radiciEscluse": ["src/app/admin", "src/app/accedi"],
  "cucitura": "src/components/ui",
  "primitive": ["Bottone", "Card", "Sezione", "Campo"],
  "moduliClient": ["src/lib/supabase/public.ts"],
  "lettoreContenuti": "src/modules/contenuti/leggi.ts"
}
```

Le chiavi restano **in italiano** come quelle di `gestionale.config.json`: è un artefatto
di progetto letto da una skill sola, non un formato di scambio — e il formato di scambio
(`--json`) resta in inglese, `DECISIONI.md` §15.

`radiciEscluse` si popola da `gestionale.config.json` quando quel file c'è: la radice
admin la dichiara il suo proprietario, e copiarla a mano significa avere due verità che
divergono al primo `evolve`.

**Niente in questi due file va ripetuto nell'altro.** La tabella degli slot e la soglia
distintiva stanno **solo** nel contratto, i percorsi **solo** nella configurazione: un
valore scritto in due posti è un valore che prima o poi ne dichiara due diversi, e il
gate leggerebbe quello sbagliato senza nessun modo di accorgersene.

E l'obbligo che vale per entrambe: **il bersaglio si stampa sempre**, anche sul verde.
Un audit su una cartella che non esiste non deve poter somigliare a un audit pulito
(`DECISIONI.md` §11).

---

## Passo per passo

### 1. `contratto-vetrina` — l'elenco delle pagine, firmato

- **Premessa:** `docs/vetrina.md` esiste ed è leggibile.
- **Esito:** almeno una pagina dichiarata nella forma ``## `id-pagina` — /percorso``; ogni
  pagina ha le sue quattro righe obbligatorie (`Cosa mostra:`, `Contenuti da:`,
  `Titolo da:`, `Aggiornamento:`); la riga `Confermato da:` nomina qualcuno — un nome
  proprio col suo ruolo, oppure `ORCHESTRATORE` — e porta una data. Il dettaglio stampa
  **quante pagine, quanti slot e chi ha firmato**, anche sul verde.
- **Rilievi:** `issue` se la data della firma è **anteriore** all'ultima modifica
  dell'handoff di schema-forge: lo schema è cambiato dopo che qualcuno ha firmato
  l'elenco, quindi l'elenco è un'opinione datata. È il controllo che il collaudo di
  `evolve` di flow-sentinel ha lasciato aperto al suo §7 («nessuno script lo esegue»);
  qui costa poco, perché le due date stanno in due file dello stesso progetto. Falso
  positivo dichiarato: un handoff riscritto per un refuso invecchia una firma che era
  buona.
- **MANCANTE quando:** il file non c'è; la riga `Confermato da:` manca, è un segnaposto
  (`{{…}}`, `TODO`, `da compilare`) o non nomina nessuno (`—`, `-`, `?`); nessuna
  intestazione di pagina è riconosciuta — anche quando le intestazioni ci sono ma sono
  tutte malformate: non ne è stata raccolta neanche una.
- **Nota di forma, pagata da altre due skill.** Fra i due punti e la firma si ammettono
  **solo spazi orizzontali**: con `\s`, che comprende l'a capo, una riga vuota cattura la
  prima riga non vuota che segue e il passo esce verde su un contratto non firmato — è
  successo davvero (flow-sentinel, `STATO.md` §Tre falsi verdi). E una firma con nome e
  ruolo **deve passare**: pretendere la parola letterale `UMANO` è il rifiuto indebito
  che il collaudo avversario di speed-demon ha dovuto correggere, dove l'unica modalità
  accettata era quella senza nessun nome.

### 2. `tipi` — compila, e sui tipi veri

- **Premessa:** `tsconfig.json` nel progetto e `typescript` risolvibile dalle sue
  dipendenze.
- **Esito:** `tsc --noEmit` esce 0. Il dettaglio riporta il conteggio degli errori e i
  primi file, mai il log intero.
- **MANCANTE quando:** TypeScript non è installato nel progetto, o `tsconfig.json` non
  c'è.
- **Perché non basta la build.** `next.config` può dichiarare
  `typescript.ignoreBuildErrors: true` e la build passa lo stesso; `tsc --noEmit` non si
  può spegnere da lì. E i tipi sono il posto in cui una colonna rinominata a monte si
  manifesta **prima** di arrivare a runtime: schema-forge l'ha misurato su un consumatore
  vero — 15 errori in 4 file, nessuna rottura arrivata in pagina.

### 3. `cucitura-ui` — la cucitura regge

- **Premessa:** `vetrina.config.json` leggibile, dichiara `cucitura` e almeno una
  `primitiva`; la cartella della cucitura esiste e contiene almeno un file. Il conteggio
  dei file letti si stampa sempre.
- **Esito, tre regole.**
  1. `block` su ogni import di una primitiva dichiarata da un percorso che **non** è la
     cucitura: è la copia della primitiva che vive dentro una cartella di pagina.
  2. `block` su ogni import **dentro** la cucitura che punta a `src/modules/**`,
     `src/app/**` o a un modulo client Supabase. Una primitiva che sa di dominio o che
     legge dati non è sostituibile, e la promessa di `DECISIONI.md` §21 — «si riscrive il
     corpo di quei file, non le pagine» — smette di essere vera.
  3. `issue` su un file fuori dalla cucitura che si chiama come una primitiva.
- **MANCANTE quando:** manca la configurazione, manca la cartella della cucitura, o non
  è dichiarata nessuna primitiva: non c'è cucitura da verificare, e zero regole applicate
  non sono zero problemi.

### 4. `chiavi-e-client` — il sito pubblico resta anonimo

- **Premessa:** almeno un file sorgente letto sotto la radice pubblica dichiarata.
  Conteggio e cartelle si stampano sempre: il precedente è l'audit di
  gestionale-crafter, il cui walker escludeva ogni cartella chiamata `supabase` e saltava
  quindi `src/lib/supabase/` — cioè proprio dove nascono i client. Un `service_role`
  piantato lì è passato inosservato al primo giro.
- **Esito, tre regole.**
  1. `block` su `service_role` / `SUPABASE_SERVICE_ROLE_KEY` raggiungibile da `src/`.
  2. `block` su un client Supabase costruito fuori dai `moduliClient` dichiarati.
  3. `block` su una variabile d'ambiente **esposta al browser** (prefisso
     `NEXT_PUBLIC_`) il cui nome contiene `SERVICE`, `SECRET` o `PRIVATE`.
- **MANCANTE quando:** la radice pubblica non esiste o non contiene nessun file: zero
  file letti non è un `pass`.
- **Sovrapposizione dichiarata.** Su un progetto che ha anche il gestionale, questo passo
  e il suo `admin-audit` guardano lo stesso `src/`. È voluto: **una vetrina senza
  backoffice è un prodotto normale di questa pipeline** — il sito che non amministra
  niente — e lì il gestionale non gira mai. Un controllo di sicurezza che esiste solo se
  gira un altro agente è un controllo che manca proprio dove il sito è tutto pubblico.

### 5. `a11y-statica` — quello che un linter sa vedere

- **Premessa:** ESLint risolvibile **nella cartella della skill**
  (`agenti/vetrina-crafter/node_modules`, come per flow-sentinel) e almeno un file JSX
  sotto la radice pubblica o la cucitura.
- **Esito:** `eslint-plugin-jsx-a11y` con la configurazione della skill
  (`--no-config-lookup`): errori = `block`, warning = `issue`.
- **MANCANTE quando:** ESLint non è installato nella skill, o non c'è nessun file da
  lintare.
- **Perché la configurazione viaggia con la skill.** Il gate deve dare lo stesso esito
  ovunque giri, anche su un progetto che la sua configurazione non ce l'ha ancora. È il
  precedente del `.sqlfluff` di schema-forge, `DECISIONI.md` §8 — *i linter si
  configurano, il gate non si declassa*. E ESLint non passa mai dal proprio shim: si
  invoca come `node <skill>/node_modules/eslint/bin/eslint.js`, così l'unico eseguibile
  in gioco è quello che sta già girando (vedi §Note di piattaforma).

### 6. `app-identita` — stiamo guardando la build giusta

- **Premessa:** un URL da interrogare — `--url` esplicito, altrimenti la riga
  `URL servito:` del contratto, **mai** l'ambiente e **mai** un `localhost:3000` scritto
  dentro il gate; `.next/BUILD_ID` del progetto esiste, cioè il progetto è stato
  costruito.
- **Esito:** l'HTML servito contiene il `BUILD_ID` di **questo** progetto; nessun indizio
  di dev server; l'app risponde. Il dettaglio stampa URL e `BUILD_ID` **anche sul verde**
  (`DECISIONI.md` §11: un gate che ha guardato l'app sbagliata non deve poter assomigliare
  a un gate che ha guardato la tua).
- **Rilievi:** `issue` se il file sorgente più recente sotto `src/` è **più recente** di
  `.next/BUILD_ID`: la build servita potrebbe non contenere le ultime modifiche, e tutto
  ciò che i passi 7-9 leggeranno parlerebbe di un'altra versione del sito. Si esce
  rilanciando `npm run build`, e converge in un giro — come il ciclo della riga `Gate:`.
  Falso positivo dichiarato: un `git checkout` o un formattatore che tocca file senza
  cambiarli.
- **MANCANTE quando:** l'app non risponde; `.next/BUILD_ID` non c'è; nessun URL è stato
  dichiarato né passato; il `BUILD_ID` servito è di un altro progetto.
- **Perché esiste.** L'ha pagato speed-demon. Il suo diciassettesimo difetto — il più
  grave — era che la porta dichiarata in un contratto **firmato** era occupata, su quella
  macchina, dal sito di **un'altra azienda**. `--url` obbligatorio impedisce al gate di
  *indovinare* la porta, non di *sbagliarla*. Il `BUILD_ID` sì.

### 7. `pagine-vive` — le pagine dichiarate esistono, e quelle che esistono sono dichiarate

- **Premessa:** il passo 1 ha prodotto un elenco di pagine **e** il passo 6 è `pass`.
- **Esito, in due direzioni.**
  - *Dichiarata → servita:* ogni rotta del contratto risponde `200` senza rimandare
    altrove. Un `3xx` verso un'altra rotta è `block` a meno che il contratto non dichiari
    la destinazione con la riga `Rimanda a:` — **una pagina che rimanda altrove non è
    quella pagina**, ed è la trappola in cui speed-demon ha attribuito `performance 100` a
    una pagina che come documento non esisteva. `404` e `5xx` sono `block`.
  - *Servita → dichiarata:* ogni `page.tsx` sotto la radice pubblica che non compare né
    fra le pagine né fra le **escluse** del contratto è un `issue` col suo percorso: è una
    pagina pubblica che nessuno ha firmato. Le rotte sotto le `radiciEscluse` — che si
    popolano da `gestionale.config.json` quando c'è — non contano.
- **MANCANTE quando:** premessa mancante, cioè contratto illeggibile o identità dell'app
  non stabilita. Interrogare pagine su un'app che non si sa quale sia produce un esito
  che non è un esito, e leggerlo come «le pagine non rispondono» manda qualcuno a cercare
  un difetto che non esiste (stessa scelta di `playwright` dopo `app-viva` in
  flow-sentinel).
- **Perché la seconda direzione è `issue` e non `block`.** L'albero delle rotte non è un
  insieme chiuso come le tabelle dei tipi su cui si ancora gestionale-crafter: altri
  agenti ci scrivono dentro (la porta d'ingresso, le rotte API). Una rotta pubblica non
  dichiarata è però sempre una cosa da guardare, e si chiude in due modi onesti — entra
  nel contratto e la si fa riconfermare, oppure entra fra le escluse col perché.

### 8. `segnaposto-serviti` — il sito non è una bozza

- **Premessa:** almeno una pagina è stata scaricata dal passo 7.
- **Esito:** nel **testo servito** la presenza di `{{…}}`, di *lorem ipsum* o delle
  formule del template (`TODO`, `da compilare`, `da decidere`) è un `block`, col percorso
  della pagina e il frammento trovato.
- **MANCANTE quando:** nessuna pagina è stata scaricata.
- **Il testo servito si ricava togliendo prima i blocchi `<script>` e `<style>`**,
  altrimenti si legge il payload RSC invece della pagina. È lo stesso testo ripulito che
  usa il passo 9, e si calcola una volta sola per pagina.
- **Limite dichiarato:** è un'euristica su stringhe. Un progetto che parla davvero di
  template o di tipografia produce un falso positivo, e allora la deroga si scrive nel
  contratto — non si spegne il controllo (`DECISIONI.md` §8).

### 9. `contenuti-vivi` — il contenuto viene dal database, e non dal codice

È il passo che questa skill ha in più rispetto a tutti i suoi vicini, ed è quello che
rende verificabile la Legge n°3.

- **Premessa:** il contratto dichiara la tabella degli slot e, per ogni slot, la pagina
  che lo mostra — **oppure** dichiara `Nessuno slot.`; `psql` è nel PATH; il database del
  progetto è risolto (`--db-url` esplicito > `[db].port` di `supabase/config.toml` >
  **mai** l'ambiente, `DECISIONI.md` §11 e §14). Database e schemi si stampano sempre,
  anche sul verde.
- **Esito, tre regole.**
  1. **La stringa è in pagina.** Per ogni slot dichiarato si legge dal database il valore
     **pubblicato** e se ne cerca un frammento distintivo nel testo servito della sua
     pagina. Non c'è → `block`: la pagina non mostra il contenuto che dichiara.
  2. **La stringa non è nei sorgenti.** Lo stesso frammento cercato sotto `src/`. C'è →
     `block`: è cablato, e che oggi coincida col database è una coincidenza destinata a
     rompersi il primo giorno in cui il cliente cambia il testo.
  3. **Le fonti dichiarate sono leggibili dall'anonimo.** Per ogni `tabella:` o `vista:`
     dichiarata come fonte di una pagina si contano le righe **impersonando il ruolo
     anonimo**. Zero righe → `block`: la pagina è viva e vuota. È il modo n°1 in cui un
     sito pubblico sopra la RLS fallisce in silenzio — la policy non lascia leggere, la
     pagina non dà errore, e nessuno se ne accorge finché non lo dice un cliente.
- **Rilievi:** `issue` se la pagina che mostra uno slot dichiara `Aggiornamento: statico`
  senza rigenerazione: il cliente cambierà il testo dal gestionale e non vedrà cambiare
  niente finché qualcuno non ripubblica. È `issue` e non `block` perché un sito che si
  ripubblica a ogni modifica è una scelta legittima — **se è dichiarata**.
- **MANCANTE quando:** `psql` non c'è; il database non è risolvibile; uno slot dichiarato
  non ha nessuna riga pubblicata; il valore è **più corto della soglia distintiva**
  (`lunghezzaMinimaFrammento`, ripiego 24 caratteri). Su un valore corto la ricerca non
  prova niente in nessuna delle due direzioni: si dichiara che quello slot non è stato
  verificato, invece di far finta.
- **Due dettagli che in P1 decidono se questo passo funziona o mente.**
  1. Il confronto si fa **dopo aver decodificato le entità HTML e compattato gli spazi**:
     `L'orto d'inverno` arriva in pagina come `L&#x27;orto d&#x27;inverno`, e in italiano
     gli apostrofi sono dappertutto. Senza normalizzazione questo passo sarebbe una
     fabbrica di rossi falsi — la stessa classe di CRLF e BOM che a schema-forge sono già
     costati una regola morta e un confronto di tipi sempre fallito.
  2. La ricerca gira sul **testo ripulito** dagli `<script>`, lo stesso del passo 8: un
     valore che compare solo nel payload RSC e non nella pagina non è un contenuto
     mostrato.
- **La soglia di 24 caratteri è una convenzione, non una misura**, esattamente come i tre
  giri di Lighthouse: il numero giusto si ricava su un progetto vero, guardando quanti
  slot restano fuori. Va tarata in P1 e dichiarata nel contratto.

### 10. `contratto-uscita` — l'handoff dice il vero sul gate che lo verifica

- **Premessa:** nessuna. È l'unico passo che non può essere MANCANTE: quel file lo scrive
  l'agente, non uno strumento che può non essere installato.
- **Esito:** `docs/handoff/<n>-vetrina-crafter.md` esiste, non ha segnaposto `{{…}}`, e la
  sua riga `Gate: VERDE|ROSSO` **coincide** col verdetto dei nove passi precedenti — rosso
  se anche uno solo non è `pass`, fallito *o* mancante. Se diverge, il passo fallisce e
  dice quale dei due è quello vero.
- **Non è un rosso strutturale:** dichiarare `ROSSO` su un gate rosso **passa**.
  Dichiarare non è fallire (`DECISIONI.md` §19). Il ciclo che ne esce — lancia, leggi,
  riscrivi l'handoff, rilancia — converge in un giro.
- **Quello che questa regola non fa:** non verifica che i residui elencati siano quelli
  giusti, né che siano tutti. Un handoff che dichiara `Gate: ROSSO` e poi tace su cosa è
  rosso passa. Il verdetto è la cosa che un consumatore a valle legge per decidere se
  fidarsi, ed è la sola falsificabile senza reinventare la comprensione del testo.

---

## Modi in cui questo gate potrebbe essere verde senza aver guardato

Elencati **prima** di scrivere il codice, perché in questa casa ognuno di questi è già
costato a qualcuno: sono la stessa forma — *uno strumento che non ha letto niente esce
0* — applicata a un dominio nuovo. In P1 ognuno diventa un test, in P2 il collaudo
avversario ne cerca altri.

| Falso verde possibile | Contromisura |
|---|---|
| **Contratto scritto dall'agente e mai confermato.** Coprirlo al 100% dimostra solo che l'agente è coerente con sé stesso | senza `Confermato da:` leggibile il passo 1 è MANCANTE, e a cascata lo sono `pagine-vive` e `contenuti-vivi` |
| **Zero pagine dichiarate.** Un contratto vuoto rende verdi per assenza i passi 7, 8 e 9: cancellare le pagine dal contratto sarebbe più facile che costruirle | le pagine si **contano prima**; zero pagine riconosciute = MANCANTE al passo 1 |
| **App sbagliata.** Un'altra applicazione sulla stessa porta risponde 200 a tutto | `app-identita` pretende il `BUILD_ID` di **questo** progetto nell'HTML servito |
| **Build vecchia.** L'app risponde, ma è la build di ieri: si misura un sito che non è quello dei sorgenti | `issue` sul confronto fra la data di `.next/BUILD_ID` e il file sorgente più recente |
| **Dev server.** I numeri e il markup di `next dev` non sono quelli di produzione | indizi di dev server nell'HTML servito = passo rosso (precedente: speed-demon) |
| **Nessun file letto.** Una radice pubblica sbagliata nella configurazione fa uscire un audit «pulito» su una cartella che non esiste | conteggio dei file letto e **stampato sempre**; zero file = MANCANTE |
| **Cucitura vuota.** Nessuna primitiva dichiarata = nessuna regola può scattare | premessa del passo 3: cucitura assente o senza primitive = MANCANTE |
| **`Nessuno slot.` falso.** Dichiarare che non ci sono contenuti editabili rende muto il passo 9 su un sito coi testi cablati | **non chiudibile nel codice**: è una dichiarazione firmata. Sta scritto nel template e in §Cosa un gate verde NON prova |
| **Slot corto.** Un valore di sei caratteri rende casuali entrambe le ricerche del passo 9 | sotto la soglia distintiva lo slot è dichiarato **non verificato**, non promosso |
| **`psql` assente.** Senza database il passo 9 non ha interrogato niente | MANCANTE, e il gate è rosso: la Legge n°3 non è stata verificata affatto |

## Il contratto `--json`

È ciò che legge l'orchestratore. La forma è **la stessa degli altri tre gate della
pipeline**, perché chi ne legge quattro non deve imparare quattro formati.

```json
{
  "contract": 1,
  "ok": false,
  "summary": { "passi": 10, "pass": 8, "fail": 1, "skipped": 1 },
  "steps": [
    { "id": "contratto-vetrina", "name": "contratto della vetrina", "status": "pass",
      "detail": "4 pagine · 4 slot — confermato da: Elena Barbieri (titolare), 2026-07-24" },
    { "id": "pagine-vive", "name": "pagine dichiarate e pagine servite", "status": "fail",
      "detail": "4 pagine dichiarate · 5 rotte pubbliche servite\n[block] `contatti` (/contatti): risponde 404\n[issue] /promozioni: rotta pubblica servita e non dichiarata nel contratto",
      "counts": { "block": 1, "issue": 1, "warn": 0 } },
    { "id": "contenuti-vivi", "name": "contenuti dal database", "status": "skipped",
      "detail": "database: postgresql://…:54322/postgres · schemi: public\nslot `catalogo-intro`: valore pubblicato di 11 caratteri, sotto la soglia distintiva (24): NON verificato" }
  ]
}
```

- **`id`** — identificatore stabile del passo, uno dei dieci della tabella, sempre in
  quest'ordine. **È l'unica cosa su cui un consumatore deve agganciarsi.** `name` è
  l'etichetta per gli umani ed è libera di cambiare: se l'identificatore fosse
  l'etichetta, riscriverla per renderla più chiara romperebbe in silenzio l'orchestratore
  (`DECISIONI.md` §15).
- **`status`** — `pass` · `fail` · `skipped`. `skipped` è una **verifica mancante**, e il
  gate resta rosso.
- **`detail`** — prosa per umani, multilinea. Non è un formato: non ci si aggancia.
- **`counts`** — solo sui passi che producono findings per gravità (`contratto-vetrina`,
  `cucitura-ui`, `chiavi-e-client`, `a11y-statica`, `pagine-vive`, `segnaposto-serviti`,
  `contenuti-vivi`), e nemmeno su quelli quando si fermano prima per premessa mancante:
  non hanno guardato niente da contare.
- **`ok`** — vero **se e solo se** `summary.fail === 0 && summary.skipped === 0`. Nove
  `pass` e uno `skipped` è rosso.
- **`contract`** — si alza quando un campo viene tolto o rinominato, o quando cambia la
  lista degli `id`. Aggiungere un campo non lo alza.

Le **chiavi restano in inglese** e le etichette in italiano, come negli altri tre gate.
La chiave italiana `summary.passi` si eredita apposta: è così in schema-forge e
flow-sentinel, e un formato di scambio non si cambia per un refuso di lingua.

Uscita del processo: **`0`** verde · **`1`** rosso · **`2`** errore di esecuzione. Il `2`
scatta quando nella cartella corrente non c'è né `docs/` né `src/app/`: lì non c'è un
progetto Web Gun, e un gate che rispondesse ROSSO direbbe qualcosa su un progetto che
non ha guardato. **Su `2` non c'è JSON**: il messaggio esce su stderr, e chi automatizza
distingua i tre codici prima di provare a interpretare stdout.

## Gravità

**Un `block` rende rosso il passo; `issue` e `warn` si stampano e non bloccano**, ma
finiscono in `counts` e nel dettaglio, quindi restano leggibili e vanno documentati
nell'handoff.

| Grado | Significato | Esempi di questo gate |
|---|---|---|
| `block` | non si consegna | pagina dichiarata che non risponde · segnaposto nel testo servito · primitiva importata da fuori la cucitura · `service_role` raggiungibile da `src/` · slot che non compare in pagina · slot cablato nei sorgenti · fonte non leggibile dall'anonimo |
| `issue` | si consegna solo se documentato nell'handoff | rotta pubblica servita e non dichiarata · pagina statica che mostra un contenuto editabile · firma del contratto più vecchia dello schema · build più vecchia dei sorgenti · warning di `jsx-a11y` |
| `warn` | si stampa, non blocca | riservato: in P0 nessuna regola lo produce, e vale la pena che resti così finché non serve davvero |

## Passi valutati e scartati

Un gate si giudica anche da cosa ha deciso di non guardare.

- **Lighthouse, Core Web Vitals, peso della pagina** → di speed-demon. Duplicarli
  significherebbe due implementazioni della stessa misura destinate a divergere, e la
  divergenza si scopre sempre come falso verde. Questo gate non apre Chrome.
- **`canonical`, `noindex`, `sitemap.ts`, `robots.ts`, Open Graph** → `seo-meta` di
  speed-demon, e site-doctor per il resto. Quel passo sa **contare** i `title` e i
  `canonical` invece di cercarli, e sa leggere l'HTML senza seguire i rimandi: sono due
  lezioni pagate con dodici falsi verdi, e riscriverle qui da zero vorrebbe dire
  ripagarle.
- **`next build` lanciato dentro il gate** → minuti di attesa e variabili d'ambiente
  dentro un controllo che deve essere rapido e deterministico. Un URL che risponde col
  `BUILD_ID` di questo progetto **è** la prova che una build è compilata; quello che
  quella prova non dà — che sia la build dei sorgenti di adesso — lo dice il rilievo sulle
  date del passo 6.
- **Navigare, cliccare, compilare un modulo** → di flow-sentinel. Un gate che clicca è
  una batteria, e un costruttore che si prova da solo i flussi si dà anche i voti.
- **Contrasti, ordine di tabulazione, senso di un messaggio d'errore** → non si ricavano
  dal JSX. Sono il certificato di site-doctor e restano lavoro umano.
- **Confronto di schermate (screenshot diff)** → alla prima costruzione non esiste
  nessuna baseline con cui confrontare, quindi il controllo direbbe «uguale a niente».
  Diventa sensato per `evolve`, su un sito che esisteva già: candidato per P2, non per P1.
- **Che il testo sia scritto bene, tradotto bene, senza refusi** → nessuno strumento; la
  difesa è la firma sul contratto.
- **`npm audit`** → una lettura di rete dentro un gate deterministico: rosso quando cade
  la connessione, verde diverso a un'ora di distanza. Stessa scelta di
  gestionale-crafter, stesso motivo.
- **Regole sul markup di dominio** («niente classi Tailwind sparse fuori dalla cucitura»)
  → è il controllo che servirebbe davvero per far rispettare §21 in **sostanza**, e non lo
  so scrivere senza rumore: distinguere una classe di impaginazione legittima da una
  primitiva reimplementata a mano è un giudizio. Resta prosa nelle references, e sta
  scritto in `SKILL.md` §Cosa un gate verde NON prova — dove si può leggere, invece di
  essere dimenticato.

## Note di piattaforma (da rispettare in P1)

Tre trappole che questa casa ha già pagato due volte ciascuna. Non sono dettagli
implementativi: sono i modi in cui un gate sano dà un esito sbagliato.

- **Shim `.cmd` su Windows.** `spawnSync(cmd, args)` senza shell **non consulta PATHEXT**:
  ENOENT sul nome, EINVAL sul percorso pieno (mitigazione della CVE-2024-27980). E
  `where npx` elenca **per primo** lo script di shell senza estensione, che Windows non sa
  eseguire. Si risolve il nome con `where`, si prende la prima riga che finisce in `.exe`,
  `.cmd`, `.bat` o `.com`, e uno shim si lancia via `cmd.exe /c <percorso>`. **Mai
  `shell: true`**: lì gli argomenti vengono concatenati invece che passati come vettore, e
  questo gate passa URL, percorsi con spazi e SQL.
- **CRLF e BOM non devono far nascere rosso un passo verde.** Ogni file di testo letto su
  Windows arriva con `\r\n`, e se è passato da PowerShell anche con il BOM; `psql` lascia
  il `\r` in coda a ogni riga. Si normalizza **una volta sola, all'ingresso**, e solo ciò
  che non porta significato.
- **Le entità HTML e gli spazi**, per il passo 9: vedi il dettaglio lì sopra. È la stessa
  classe di problema, spostata dal file al documento servito.

## Cosa riportare all'umano

Mai i log grezzi. Si riporta il **residuo** e le **verifiche mancanti**, nella forma che
stampa il gate — e il dettaglio si stampa **anche sui passi verdi**, perché è lì che
finiscono l'URL interrogato, il `BUILD_ID`, il database e chi ha firmato il contratto. Se
quelle righe uscissero solo sul rosso non le leggerebbe nessuno, ed è esattamente così
che un gate finisce per guardare l'app di un altro senza che nessuno se ne accorga.

```
GATE VETRINA: ROSSO (1 falliti, 1 verifiche mancanti su 10 passi)

OK    contratto della vetrina
        4 pagine · 4 slot — confermato da: Elena Barbieri (titolare), 2026-07-24
OK    tipi TypeScript
OK    cucitura dei componenti
        12 file letti sotto src/components/ui
OK    chiavi e client Supabase
        38 file letti sotto src/ · 1 modulo client dichiarato
OK    accessibilita' statica (jsx-a11y)
OK    identita' dell'app servita
        http://127.0.0.1:3100 · BUILD_ID gTx2… (combacia con .next/BUILD_ID)
FAIL  pagine dichiarate e pagine servite
        4 pagine dichiarate · 5 rotte pubbliche servite
        [block] `contatti` (/contatti): risponde 404
        [issue] /promozioni: rotta pubblica servita e non dichiarata nel contratto
OK    segnaposto nel testo servito
MANC  contenuti dal database
        database: postgresql://…:54322/postgres · schemi: public
        slot `catalogo-intro`: valore pubblicato di 11 caratteri, sotto la soglia
        distintiva (24): NON verificato
OK    contratto d'uscita (handoff)

Una verifica mancante non e' una verifica superata: il gate resta rosso.
```
