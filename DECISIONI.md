# DECISIONI — Registro delle decisioni del repo Web Gun

Registro delle decisioni prese (o da prendere) sulla struttura e sull'orchestrazione. Una voce per decisione: contesto, decisione, stato.

## Decisioni aperte

### 1. Specchio della Commessa in modalità pipeline automatica

Lo Specchio della Commessa di code-maniac richiede conferma umana esplicita prima di agire. In modalità pipeline automatica questo gate va delegato all'orchestratore (Prompt Smith farà da committente), mantenendo la conferma umana solo per azioni irreversibili (deploy, spese, cancellazioni). **Da discutere con il proprietario di code-maniac prima di modificare qualsiasi cosa.**

- **Stato:** aperta — nessuna implementazione fatta, solo documentata.

## Decisioni prese autonomamente (durante la ristrutturazione del 2026-07-24)

### 2. Repo di origine di code-inquisition non noto

La sezione "Fonte di verità" del README indica code-maniac e bugbay con URL GitHub (finzidev). Per code-inquisition non esiste un URL documentato in HOWTORUN.md (l'installazione avviene copiando la cartella): nel README è segnato "esterno (finzidev, URL non noto)". Da completare quando il proprietario fornisce il link.

- **Stato:** presa — aggiornare il README quando l'URL è disponibile.

### 3. `Web Gun.docx` e `webgun_content.txt` restano in radice

Non è stata creata la cartella `docs-umani/`: con soli due file di documentazione umana la radice resta leggibile, e spostarli avrebbe rotto eventuali riferimenti esterni. Si riconsidera se i documenti umani crescono.

- **Stato:** presa.

### 4. Struttura standard dei progetti generati: aggiunte `lib/`, `public/`, `supabase/`

Il template `struttura_directory.md` di code-maniac è generico (placeholder). Nel CLAUDE.md la struttura è stata concretizzata per lo stack Next.js + Supabase aggiungendo `src/lib`, `public/` e `supabase/` (migrazioni e seed), oltre alle cartelle richieste (`src/app`, `src/components`, `src/modules/<dominio>`, `docs/`).

- **Stato:** presa — modificabile quando gli agenti costruttori definiranno esigenze diverse.

### 5. Dipendenze negli STATO.md dedotte dall'ordine di pipeline

Le dipendenze a monte/a valle di ogni agente scaffold sono dedotte dall'ordine delle fasi in HOWTORUN.md (es. gestionale-crafter dipende da schema-forge e fly-ui). Sono ipotesi di partenza, non vincoli: il proprietario di ogni agente le conferma o corregge quando lo sviluppa.

- **Stato:** presa.

## Decisioni prese durante l'installazione di Schema Forge (2026-07-24)

### 6. Conferma dei gate in pipeline: precedente valido per tutti gli agenti

La decisione §1 (Specchio della Commessa in pipeline automatica) resta aperta per code-maniac, ma Schema Forge l'ha risolta per sé, e la soluzione vale come **precedente per i prossimi agenti** finché §1 non viene chiusa diversamente:

1. **Il gate di comprensione non si elimina, si delega.** Lo Specchio del dominio ha due modalità: in interattiva conferma l'umano con un "sì" esplicito, in pipeline conferma l'orchestratore (Prompt Smith) sulla base del brief.
2. **Delegare non vuol dire perdere la tracciabilità.** In pipeline il modello assunto viene **scritto** in `docs/handoff/07-schema-forge.md` come "modello assunto": un errore di comprensione resta leggibile invece di sparire.
3. **Le azioni irreversibili restano sempre a checkpoint umano**, anche in pipeline. Per Schema Forge sono i distruttivi sullo schema (`drop column`, `drop table`, restringimenti di tipo, `rename`): l'orchestratore non ha l'autorità di autorizzare una perdita di dati.

Regola generale che ne discende: **un agente in pipeline può delegare all'orchestratore la conferma di ciò che è reversibile, mai la conferma di ciò che non lo è, e ciò che assume lo scrive nell'handoff.**

- **Stato:** presa — vale per Schema Forge; da riusare come modello dagli altri agenti. Non modifica code-maniac, quindi non chiude la §1.

### 7. Le skill stanno in `agenti/`, `.claude/skills/` è uno specchio via junction

Claude Code carica le skill da `.claude/skills/`, ma la fonte di verità del repo è `agenti/`. Tenere due copie significa vederle divergere.

Scelta: **junction di Windows** (`New-Item -ItemType Junction`), che non richiede permessi di amministratore — a differenza dei link simbolici. La copia con script di riallineamento (`scripts/sync-skills.ps1`) era il piano B e **non è stata necessaria**.

Due dettagli che costano tempo se non si sanno:

- il target della junction deve essere un **percorso assoluto** (`(Resolve-Path "agenti\schema-forge").Path`); con un percorso relativo `New-Item` fallisce;
- git segue la junction e committerebbe gli stessi file due volte: `.claude/skills/` è in `.gitignore`.

Su una macchina senza junction (o su un checkout Linux/macOS) il piano B resta valido: copia + script di riallineamento.

- **Stato:** presa — da replicare per ogni nuovo agente che diventa skill.

## Decisioni prese durante l'irrobustimento di Schema Forge (2026-07-25)

### 8. I linter si configurano, il gate non si declassa

Il collaudo del 2026-07-24 aveva lasciato il gate `verify` rosso su `sqlfluff` (8 rilievi) e `squawk` (27 rilievi), tutti da regole di default in conflitto con convenzioni **scritte** della skill. Le due strade erano: rendere quei due passi non bloccanti, oppure dare alla skill la propria configurazione.

Scelta: **la configurazione**, in `agenti/schema-forge/resources/config/` (`.sqlfluff` e `squawk.toml`), passata agli strumenti da `verify.mjs` con percorsi risolti sulla cartella della skill, e copiata nel progetto generato dal comando `forge`.

Motivo: un passo non bloccante è un passo che nessuno guarda. Un rosso che tutti imparano a ignorare non è più un controllo, è rumore — e il giorno in cui segnala una cosa vera nessuno se ne accorge. La configurazione, invece, costringe a **scrivere la motivazione** di ogni esenzione: nel file, sulla riga sopra la regola disattivata. Le esenzioni sono tre e nessuna nasconde un difetto reale:

- `PG01` / `require-concurrent-index-creation` — `create index concurrently` non può stare nella transazione con cui il CLI Supabase applica una migrazione: la regola chiede una cosa impossibile in questo contesto;
- `RF04` limitata a `name` e `label` — parole chiave **non riservate** in Postgres, legali senza virgolette, e sono i nomi imposti da `references/pattern-ecommerce.md`. La regola resta attiva su tutto il resto;
- `prefer-robust-stmts` — `if not exists` su una migrazione versionata non la rende robusta: le fa ignorare in silenzio una deriva fra ambienti che deve invece farla fallire.

- **Stato:** presa — il gate resta bloccante su tutti e sette i passi.

### 9. Il denaro sta in `bigint` di centesimi, non in `integer`

`squawk` segnalava `prefer-bigint-over-int` sui `*_cents`, e `references/modellazione.md` prescriveva `integer`. **Aveva ragione lo strumento**: la regola non è stata disattivata, è stata corretta la reference.

Motivo: in centesimi, `integer` si ferma a 21.474.836,47 € — un fatturato annuo, non un caso di laboratorio. E allargarlo dopo è esattamente l'`alter column type` che `references/migrazioni.md` classifica come pericoloso: riscrittura completa della tabella sotto lock esclusivo, cioè un fermo del sito deciso da un risparmio di 4 byte per riga.

Aggiornati `references/modellazione.md` (riga *Denaro*) e `references/pattern-ecommerce.md` (tutti i `*_cents`). Il banco di prova è stato riportato a `bigint` e il gate è tornato verde su 7 passi su 7 senza toccare la regola.

- **Stato:** presa.

## Decisioni prese durante la correzione di Schema Forge (2026-07-26)

### 10. Un distruttivo autorizzato si dichiara al gate, non lo si aggira

`squawk` segnala `ban-drop-column` e non legge le motivazioni in prosa; le migrazioni sono immutabili, quindi il rilievo non se ne va più. Conseguenza: un `evolve` legittimo — autorizzato dall'umano, documentato, coi dati esportati — lasciava il progetto **rosso per sempre**, cioè non consegnabile.

Tre strade: declassare `squawk` a non bloccante, disattivare `ban-drop-column` nella configurazione, oppure dichiarare l'eccezione riga per riga nella migrazione.

Scelta: **l'eccezione nella migrazione** — `-- squawk-ignore ban-drop-column`, da solo sulla sua riga, con la motivazione nelle righe sopra e l'autorizzazione umana come precondizione.

Motivo: le prime due spengono il controllo per tutti i `drop` futuri, compresi quelli che nessuno ha autorizzato. La terza lo lascia acceso e costringe a **firmare** ogni eccezione nel file che la esegue: chi, quando, perché, dove sono finiti i dati. Coerente con la §8 — i linter si configurano, il gate non si declassa.

Verificato sul campo: la riga silenzia quella sola regola e lascia attive tutte le altre nello stesso file. La motivazione **accanto** al nome della regola non funziona: squawk la legge come altri nomi di regola e il rilievo scatta lo stesso.

- **Stato:** presa — scritta in `references/migrazioni.md` §Il distruttivo autorizzato e il gate.

### 11. Il gate dichiara sempre cosa ha guardato

Due bug trovati facendo girare il gate corretto su un progetto vero: l'audit RLS girava sul database della porta 54322 — cioè di un **altro** progetto, con due stack Supabase accesi — e copriva il solo schema `public` anche quando il progetto ne esponeva altri. In entrambi i casi rispondeva `OK`.

Scelta: il database viene da `[db].port` del `config.toml` del progetto e gli schemi da `[api].schemas`; **schemi e URL si stampano nel dettaglio del passo**, anche quando è verde.

Motivo: un audit parziale, o su un database sbagliato, non deve poter assomigliare a un audit completo. La precedenza è `--db-url` esplicito > `config.toml` > **mai** l'ambiente: una `SUPABASE_DB_URL` rimasta da un altro progetto è esattamente il modo in cui era nato il bug.

- **Stato:** presa.

### 12. I banchi di prova si buttano, i verbali restano

`banco-prova/` e `banco-prova-pastificio/` sono stati rimossi il 2026-07-26 a collaudo chiuso. Erano progetti Supabase usa e getta, gitignorati, e si rigenerano con `supabase init`.

Motivo: un banco che resta in giro invecchia e diventa una fonte di verità falsa — qualcuno ci guarda dentro e crede che sia lo stato dell'arte. Ciò che vale è il **verbale** (`COLLAUDO-2026-07-25.md`) e ciò che il collaudo ha prodotto: regole nelle references, test negli script. La regola `.gitignore` resta (`banco-prova*/`) perché il prossimo agente ne creerà altri.

Il logo di Schema Forge, che stava dentro `banco-prova/` per sbaglio, è stato spostato in `agenti/schema-forge/resources/branding/`.

- **Stato:** presa.

## Decisioni prese estendendo Schema Forge con la skill Supabase ufficiale (2026-07-27)

### 13. Schema Forge resta imperativo: niente `supabase/schemas/` dichiarativi

La skill Supabase ufficiale documenta due flussi, dichiarativo (`supabase/schemas/`, migrazioni **generate** da uno stato desiderato) e imperativo (migrazioni scritte a mano). Schema Forge resta imperativo.

Motivo: il dichiarativo è in conflitto diretto con due regole non negoziabili dell'agente. **Una migrazione applicata è immutabile** — ma il dichiarativo rigenera il diff dallo stato desiderato, quindi la storia diventa un prodotto derivato. E l'**expand-contract** è una sequenza di passi *intenzionali* (aggiungi, popola, sposta le letture, poi togli): un generatore di diff produce il passo unico e distruttivo, che è esattamente quello che serve un checkpoint umano per autorizzare.

- **Stato:** presa — si riconsidera solo se il dichiarativo impara a produrre sequenze expand-contract, non un diff singolo.

## Decisioni prese chiudendo i falsi verdi del gate (2026-07-27, seconda tornata — chiusa il 2026-07-28)

### 14. Il comando `rls` è stato tolto

`SKILL.md`:62 prescriveva `node <skill>/scripts/rls-audit.mjs` senza `--db-url` né `--schemas`. Eseguito alla lettera, nel collaudo del 2026-07-26 ha auditato **il database di un altro progetto** (porta 54322 di default) e ha risposto «nessun bloccante». La correzione della §11 era stata applicata a `verify.mjs` e non a quel percorso.

Tre strade: correggere la procedura del comando, lasciarla e documentare il rischio, oppure togliere il comando.

Scelta: **togliere il comando.** La generazione delle policy va in `forge` — dove già stavano RLS, indici e vincoli, e dove il `grant` per colonna e il vincolo sullo stato iniziale vanno scritti nella **stessa** migrazione della policy. L'audit va in `verify`, che l'URL lo risolve dal `config.toml`. Al suo posto nasce `test`, che scrive i pgTAP negativi.

Motivo: `rls` non aggiungeva niente a `forge` e faceva peggio di `verify`. Un comando che duplica un altro comando *in modo meno sicuro* è una trappola, non una comodità: chi lo usa ottiene una risposta più debole credendo di averne ottenuta una più mirata. Restano gli otto comandi, con `test` al posto di `rls`.

`scripts/rls-audit.mjs` resta, e resta lanciabile a mano: ma ora **stampa sempre in testa** il database e gli schemi che ha guardato, anche quando non ha niente da segnalare. La garanzia della §11 vale su entrambi i percorsi, non solo dentro il gate.

- **Stato:** presa — `SKILL.md`, `README.md`, `COME-PROVARLA.md` allineati.

### 15. Il contratto `--json` ha un `id` per passo, separato dall'etichetta

L'unico identificatore di passo era l'etichetta italiana (`"contratto d'uscita (configurazioni + handoff)"`), e block/issue/warn erano appiattiti in prosa dentro `detail`.

Scelta: ogni passo porta un **`id` stabile** (`sqlfluff`, `squawk`, `db-reset`, `db-lint`, `db-advisors`, `audit-rls`, `pgtap`, `tipi`, `contratto-uscita`), il documento porta `contract` (numero di versione) e `summary` (conteggi per stato), e i passi che producono findings per gravità portano `counts`. Un test blocca gli `id` e il loro ordine.

Motivo: senza, riscrivere un'etichetta per renderla più chiara agli umani avrebbe rotto in silenzio l'orchestratore — cioè il costo di migliorare la comunicazione sarebbe stato un guasto invisibile a valle. Con l'`id` separato, l'etichetta torna a essere prosa e può cambiare quando serve.

Le chiavi del JSON restano in inglese (`ok`, `steps`, `status`, `detail`, `counts`), come erano nate qui e in `rls-audit.mjs` (`severity`, `object`, `message`, `hint`, `findings`). Tradurle avrebbe significato un rinominamento totale del formato di scambio per zero guadagno, e mescolare le due lingue nello stesso oggetto è peggio di entrambe. La regola dell'italiano vale sul codice e sulla prosa: il formato di scambio resta com'è nato, e ora è documentato.

- **Stato:** presa — forma completa in `references/verifica-deterministica.md` §Il contratto `--json`.

### 16. Un test pgTAP che attacca ogni policy di scrittura è obbligatorio (`block`)

È la risposta al blocco n°1: sullo schema che il gate dichiarava VERDE 9/9, `/code-inquisition` aveva riprodotto 16 difetti su 17. Nessuno strumento guarda la **semantica** di una policy — verificano che esista.

Scelta: `audit-lib.mjs` produce un **`block`** su ogni tabella con policy di `insert`/`update`/`delete`/`all` per cui nessun file di `supabase/tests/` tenta una scrittura **impersonando un ruolo**.

**La regola proposta chiedeva anche che il test asserisse un rifiuto** (`throws_ok`, o «righe toccate = 0»). Non è stata implementata così, ed è stato misurato perché: il test negativo corretto già scritto sul banco veterinario asserisce che la visita è **rimasta** `prenotata` — conteggio **1**, non 0 — e non usa `throws_ok`. Quella clausola avrebbe segnalato come mancante un test negativo corretto: il falso positivo peggiore, quello sul codice di riferimento del progetto stesso. La forma dell'asserzione resta prescritta **in prosa** (`SKILL.md` comando `test`, `references/rls-supabase.md`), non nel controllo automatico.

Motivo della gravità `block`: è l'unica regola che converte «l'agente ha promesso» in «qualcosa ha ceduto quando ci abbiamo provato». Sul banco l'effetto si misura: 17 tabelle scrivibili, **16 `block`** al primo giro (l'unica salva era `visits`, che il test esistente attaccava davvero); scritti i test negativi, i 16 spariscono e **2 asserzioni su 23 falliscono** — l'auto-promozione del veterinario e la visita che nasce già `fatturata`. Non è un rosso strutturale: è il lavoro che l'agente deve fare, e quando è fatto il gate lo riconosce.

- **Stato:** presa.

### 17. Le regole euristiche non sono `block`, tranne dove la prova è nel catalogo

Due classi nuove di `audit-lib.mjs` si appoggiano a un'inferenza:

- **colonna di privilegio scrivibile dal proprietario della riga** — quali colonne siano «di privilegio» si decide dal **nome** (`role`, `ruolo`, `is_admin`, `job_title`, `permessi`…);
- **macchina a stati vincolata solo in `update`** — quale colonna sia «lo stato» si deduce dal corpo del trigger.

Scelta: la seconda è `issue`. La prima è **`block` solo quando la prova è nel catalogo** — cioè quando quella colonna compare in un'espressione di policy *oppure* nel corpo di una funzione che una policy chiama — e `issue` quando c'è solo il nome.

Motivo: un `block` inferito è un rosso che si impara a scavalcare, e sul banco esiste il caso che lo dimostra — `job_title` non compare in **nessuna** policy: sta nel corpo di `puo_vedere_clinica()`, che le policy chiamano. Guardare solo il testo delle policy avrebbe declassato a `issue` un Critical vero; guardare solo il nome avrebbe bloccato un `job_title` puramente descrittivo. La prova sta nel mezzo, ed è catalogabile.

Il segnale che distingue una scrittura su **tutte** le colonne da una ristretta non è euristico: `information_schema.role_table_grants` legge `relacl` e **non elenca i grant per colonna** (verificato su Postgres reale — con `grant update (nome) on t to authenticated` la tabella non compare, e l'update della colonna esclusa riceve *permission denied for table*).

- **Stato:** presa — l'euristica è dichiarata nel messaggio del finding, non solo qui.

### 18. Uno strumento che non ha letto niente non produce un `pass`

Tre passi potevano essere verdi senza aver guardato, tutti e tre riprodotti prima di essere corretti: `sqlfluff` salta i file oltre 20 000 byte ed esce 0; `supabase test db` su una cartella vuota esce 0; senza `[db].port` l'audit ripiegava sulla porta 54322 — il database di un altro progetto — e la riga «quale database» spariva.

Scelta: il gate **misura la premessa prima di leggere l'esito**. Byte di ogni migrazione prima di lanciare sqlfluff; conteggio dei file `.sql` invece dell'esistenza della cartella; URL del database risolto prima di invocare l'audit. Dove la premessa manca, il passo è `skipped` — verifica mancante — e mai `pass`.

Motivo: leggere gli avvisi in prosa dello strumento (l'avviso di sqlfluff esce su **stdout**, non su stderr come si credeva) fa dipendere il verdetto da come lo strumento formatta i suoi messaggi. Misurare la premessa non dipende da niente. È la generalizzazione della regola anti-simulazione: *uno strumento assente* era già `skipped`, adesso lo è anche *uno strumento presente che non ha letto l'input*.

- **Stato:** presa.
