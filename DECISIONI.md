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

Motivo: un passo non bloccante è un passo che nessuno guarda. Un rosso che tutti imparano a ignorare non è più un controllo, è rumore — e il giorno in cui segnala una cosa vera nessuno se ne accorge. La configurazione, invece, costringe a **scrivere la motivazione** di ogni esenzione: nel file, sulla riga sopra la regola disattivata. Le esenzioni sono **quattro** e nessuna nasconde un difetto reale:

- `PG01` / `require-concurrent-index-creation` — `create index concurrently` non può stare nella transazione con cui il CLI Supabase applica una migrazione: la regola chiede una cosa impossibile in questo contesto;
- `RF04` limitata a `name`, `label`, `role` e `summary` — parole chiave **non riservate** in Postgres, legali senza virgolette. Le prime due sono i nomi imposti da `references/pattern-ecommerce.md`; le altre due sono state aggiunte il 2026-07-27 dopo il collaudo veterinario, che aveva dovuto rinominare `staff.role` e `medical_records.summary` per un rilievo del linter e non per una ragione di modello. La regola resta attiva su tutto il resto;
- `RF05` con `quoted_identifiers_policy = none` — esenta dai caratteri speciali i soli identificatori **quotati**, cioè i nomi di policy in italiano che le reference stesse prescrivono (`create policy "utente legge i propri ordini"`). Su un identificatore nudo la regola continua a scattare. Aggiunta il 2026-07-27: prima, chi copiava l'esempio della reference nasceva col gate rosso — 36 rilievi sul solo banco veterinario;
- `prefer-robust-stmts` — `if not exists` su una migrazione versionata non la rende robusta: le fa ignorare in silenzio una deriva fra ambienti che deve invece farla fallire.

- **Stato:** presa — il gate resta bloccante su tutti e **nove** i passi (erano sette quando questa voce è stata scritta; `db advisors` e il contratto d'uscita sono arrivati dopo).

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

- **Stato:** presa — **con l'eccezione della §20**, ristretta dalla §25. Fra il 2026-07-28 e il 2026-07-30 l'eccezione si era allargata fino a coprire tutti e cinque i banchi, cioè aveva smesso di essere un'eccezione. La §25 le ha rimesso un criterio falsificabile — *si traccia il banco che un clone pulito sa rilanciare* — e ha rimandato gli altri quattro alla regola scritta qui sopra.

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

È la risposta al blocco n°1: sullo schema che il gate dichiarava VERDE 8/8 (il 26 luglio, quando i passi erano otto), `/code-inquisition` aveva riprodotto 16 difetti su 17. Nessuno strumento guarda la **semantica** di una policy — verificano che esista.

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

## Decisioni prese chiudendo l'audit multiagentico del repo (2026-07-28)

### 19. L'handoff deve dichiarare il verdetto del gate, e il gate lo verifica

Il passo `contratto-uscita` verificava che `docs/handoff/07-schema-forge.md` **esistesse** e non avesse segnaposto `{{…}}`. Nient'altro. Sul banco veterinario, dove il gate chiude ROSSO su due passi, l'handoff — fermo a due giorni prima — dichiarava «1 issue, 1 warn, nessun bloccante» e citava una tabella già droppata: il passo lo promuoveva `pass`.

Il punto non è la svista. È che quel passo esiste **proprio** per far rispettare la clausola del `CLAUDE.md` («nessun handoff è valido senza scan pulito **oppure** residuo documentato»), e la faceva rispettare nella forma e non nella sostanza: verificava che il file ci fosse, non che dicesse la verità sul gate che lo stava verificando.

Tre strade: lasciare la verifica a un umano (cioè a nessuno), pretendere che l'handoff elenchi ogni finding (illeggibile, e si sfalsa a ogni rilancio), oppure pretendere **il verdetto**.

Scelta: **il verdetto, in una riga di forma fissa.** L'handoff contiene `Gate: VERDE` o `Gate: ROSSO`, e il passo la confronta con il verdetto degli **otto passi precedenti**. Se diverge, il passo fallisce e dice quale dei due è quello vero.

Motivo della forma fissa: la prosa libera si può sempre leggere come si vuole, e un controllo su prosa libera è un controllo che non c'è. Una riga sì. Il regex tollera elenco, citazione e grassetto — sono tre modi di scrivere la stessa riga in markdown, non tre significati.

**Non è un rosso strutturale.** Se il gate è rosso l'handoff dichiara rosso e il passo passa: dichiarare non è fallire. Il ciclo che ne esce — lancia, leggi, riscrivi l'handoff, rilancia — è esattamente quello che deve esistere, e converge in un giro.

Quello che questa regola **non** fa: non verifica che i residui elencati siano quelli giusti, né che siano tutti. Un handoff che dichiara `Gate: ROSSO` e poi tace su cosa è rosso passa. Il verdetto è la cosa che un consumatore a valle legge per decidere se fidarsi, ed è la sola falsificabile senza reinventare la comprensione del testo.

- **Stato:** presa — `SKILL.md` §Contratto d'uscita, `resources/templates/handoff-schema-forge.md` §6, 8 test in `verify.test.mjs`.

### 20. Il banco veterinario si traccia, perché non è più un banco usa e getta

La §12 dice che i banchi si buttano: un banco che resta in giro invecchia e diventa una fonte di verità falsa. Vale ancora, e `banco-prova/` e `banco-prova-pastificio/` sono stati buttati per quel motivo.

`banco-prova-vetcare/` è un'altra cosa, e la differenza non era stata vista: **`STATO.md` lo tratta come il caso di prova permanente di uno schema difettoso** («il banco resta rosso apposta»). Ma era gitignorato e non tracciato — cioè la prova centrale dello stato attuale dell'agente esisteva su un disco solo, e nessuno poteva riprodurre il rosso né verificare che fosse rosso per i motivi dichiarati. Un'affermazione non riproducibile non è una prova, è un ricordo.

Scelta: **si traccia**, con la regola `.gitignore` ristretta agli artefatti di runtime di Supabase (`supabase/.branches/`, `supabase/.temp/`). La regola generale `banco-prova*/` resta per i banchi effimeri che il prossimo agente creerà.

Motivo: le due cose che la §12 voleva evitare — l'invecchiamento e la fonte di verità falsa — le risolve il fatto che il banco è **dentro il gate**, non fuori. Se invecchia, il gate lo dice al primo rilancio. Il pericolo della §12 era un banco che nessuno controlla più; questo è controllato a ogni tornata.

- **Stato:** presa, e **ristretta dalla §25 del 2026-07-30**. Questa voce parlava di un banco; nei due giorni successivi la stessa motivazione è stata usata per tracciarne altri quattro senza estendere la voce, finché l'eccezione non ha coperto tutti i casi che la §12 doveva regolare. La §25 la riporta a uno solo — questo — con il criterio che qui era implicito e non scritto: *un banco si traccia se un clone pulito lo sa rilanciare*. `banco-prova-vetcare` lo soddisfa (gli manca solo ciò che `supabase start` riscrive), gli altri quattro no.

## Decisioni prese costruendo Gestionale Crafter (2026-07-28)

### 21. Fly UI non esiste: componenti scritti a mano, dietro una cucitura

Lo scaffold di gestionale-crafter dichiarava una dipendenza da **fly-ui** per i componenti delle viste. `agenti/fly-ui/` non esiste, e l'agente è segnato 🔴 («me lo devono mandare») da prima di questo lavoro. Tre strade: fermarsi e aspettare, inventare una libreria di componenti dentro questo agente, oppure scrivere i componenti nel progetto generato.

Scelta: **componenti Tailwind scritti a mano nel progetto generato**, raccolti in `src/components/ui/` e usati **solo** da lì — le pagine importano `Tabella`, `Campo`, `Bottone`, mai classi sparse nel markup di dominio. È la **cucitura**: quando Fly UI arriverà si riscrive il corpo di quei tre file, non le venti pagine che li usano.

Motivo per non inventare una libreria qui: sarebbe un secondo prodotto dentro un agente che ne ha già uno, e il giorno in cui Fly UI arriva ci si ritrova con due librerie da riconciliare. Motivo per non fermarsi: il backoffice è la fase 10 della pipeline e Fly UI è la 8 — aspettare significa non consegnare niente.

La deroga si scrive **due volte**: in `docs/PROGETTO.md` e in `docs/DEBITO-TECNICO.md` del progetto generato, con il rientro previsto («alla nascita di `agenti/fly-ui`»). Non basta scriverla qui: chi apre il progetto fra sei mesi legge quelli.

- **Stato:** presa — si chiude quando Fly UI esiste.

### 22. Su Supabase i `grant` scritti nelle migrazioni sono no-op, e il `grant` per colonna non restringe da solo

Misurato il 2026-07-28 su Postgres 18 con Supabase CLI 2.95.4 (`pg_default_acl`): Supabase applica `alter default privileges in schema public grant all on tables to anon, authenticated, service_role`. Quindi ogni tabella nuova nasce con `arwdDxtm` per **entrambi** i ruoli del client, e:

1. ogni `grant select, insert, update … to authenticated` scritto in una migrazione **non cambia niente**: il privilegio c'era già;
2. `grant update (colonna) to authenticated` **non restringe niente** senza un `revoke` prima, perché il permesso per colonna è **additivo**.

Non è un'argomentazione: sul banco il test pgTAP ha visto il magazziniere eseguire `update public.staff set ruolo = 'titolare'` **sulla propria riga** e diventare titolare — con la riga `grant update (full_name, phone)` regolarmente scritta nella migrazione.

Scelta: **prima si revoca, poi si concede**, e la forma completa entra nelle reference di gestionale-crafter (`references/form-e-permessi.md`). La segnalazione è stata riportata a schema-forge nel suo `STATO.md`, perché la migrazione la scrive lui.

Nota utile a chi cercherà la verità nel catalogo: `information_schema.column_privileges` **non** serve a questo — espande il permesso di tabella su ogni colonna, quindi mostra la stessa riga nei due casi opposti. La distinzione sta in `pg_class.relacl` (tabella) + `pg_attribute.attacl` (colonna), ed è lì che l'audit legge.

- **Stato:** presa.

### 23. Un route handler non esegue i layout: la guardia della sezione non lo protegge

Misurato sul banco con `next dev` acceso e senza cookie di sessione: `GET /admin` risponde **307** verso la pagina di accesso (la guardia del `layout.tsx` gira), `GET /admin/stato` — un `route.ts` nella **stessa** cartella protetta — risponde **200**.

Scelta: la regola dell'audit distingue i due casi. Le pagine ereditano la guardia dal layout; **i route handler devono chiamarla da soli**, e per loro non esiste un posto più in alto dove metterla.

Il dettaglio che vale più della regola: in quella risposta 200 il corpo era `{"clienti":null}`. A non far uscire i dati è stata la **RLS di schema-forge**, non l'applicazione — il client portava la chiave anonima senza sessione. Con un client `service_role` la stessa rotta avrebbe consegnato l'anagrafica intera. È il motivo per cui la Legge n°3 di gestionale-crafter ha **due metà** (guardia sulla rotta *e* nessuna scorciatoia sulla RLS): quel giorno una delle due aveva un buco, e a reggere è stata l'altra.

- **Stato:** presa.

### 24. I contenuti editabili dal cliente sono di Gestionale Crafter

Sanity Creator è stato cancellato dalla pipeline (commit del 2026-07-28). Il bisogno che copriva — il cliente cambia da solo i testi e le immagini delle sezioni del sito — non è sparito con l'agente.

Scelta: **se lo prende gestionale-crafter**, dichiarato nello `SKILL.md` §Cosa fa e coperto da `references/contenuti-editabili.md`. I contenuti vivono in una tabella Supabase (uno *slot* per sezione, bozza e pubblicato distinti), la tabella la scrive **schema-forge** su richiesta, e il gestionale ne genera la vista.

Il perimetro è dichiarato e **non** comprende un costruttore di pagine (blocchi componibili, pagine create dal cliente, revisioni): quello è un prodotto, richiede un modello dati diverso e va preventivato. La scelta fra i due mondi è una domanda **strutturale** dello Specchio: metà dei clienti chiede il secondo e usa il primo, e l'errore da non fare è promettere il primo chiamandolo il secondo.

Motivo per non lasciarlo scoperto: un bisogno senza proprietario non sparisce, si trasforma in testi scritti nel codice — cioè in una telefonata a noi ogni volta che il cliente vuole cambiare una parola.

- **Stato:** presa.

## Decisioni prese ripulendo la regia (2026-07-30)

### 25. Un banco si tiene solo se un clone pulito lo sa rilanciare

Il 2026-07-28 la §20 era stata estesa in silenzio da tre a quattro banchi: il verbale
`agenti/gestionale-crafter/COLLAUDO-2026-07-28.md` §Una nota sul `.gitignore` traccia anche
`banco-prova-negozio`, `banco-prova-accademia` e `banco-sporco`, e il 2026-07-30 il collaudo
avversario di Speed Demon ha aggiunto `banco-prova-immobiliare` con la stessa motivazione. A
quel punto tutti e cinque i banchi erano tracciati, l'eccezione era diventata la regola, e la
§12 — «i banchi si buttano, i verbali restano» — non aveva più nessun caso a cui applicarsi.

Il motivo scritto nel 2026-07-28 era: «le affermazioni *6 difetti su 6*, *zero falsi positivi*
e *l'audit non vede la guardia sbagliata* valgono finché qualcuno può rilanciarle». È il
criterio giusto, e **misurato non regge per quei banchi**. `git status --ignored` sui cinque:

```
banco-prova-vetcare       18 tracciati · ignorati: supabase/.branches/, supabase/.temp/
banco-prova-negozio       85 tracciati · ignorati: .env.e2e.local, .env.local, e2e/.auth/,
                                                   node_modules/, .next/, playwright-report/, …
banco-prova-accademia     48 tracciati · ignorati: .env.local, node_modules/, …
banco-sporco              40 tracciati · ignorati: nessuno (ma non ha package.json)
banco-prova-immobiliare   25 tracciati · ignorati: node_modules/, .next/, public/, next-env.d.ts
```

Da un clone pulito, `banco-prova-negozio` e `banco-prova-accademia` **non si rilanciano**: gli
mancano le chiavi che il loro gate legge, e sono gitignorate di proposito — giustamente. Non
sono prove riproducibili: sono prove riproducibili **su questa macchina**, che è la definizione
di ricordo che la §12 voleva evitare. `banco-sporco` è sorgente puro senza `package.json`, e la
sua affermazione centrale — «zero falsi positivi sul gemello pulito» — ha bisogno del gemello,
cioè di `banco-prova-negozio`: tenerne uno solo conserva la metà che da sola non prova niente.
`banco-prova-vetcare` invece si rilancia: ciò che gli manca (`supabase/.branches/`,
`supabase/.temp/`) lo riscrive `supabase start`, e tutto quello che il gate legge è tracciato.

Scelta: **resta `banco-prova-vetcare`, gli altri quattro si cancellano dal disco** — sono nel
commit `67f9001`, che li contiene tutti e cinque, e uno qualsiasi torna con:

```
git checkout 67f9001 -- banco-prova-negozio     # o accademia, sporco, immobiliare
```

Motivo per cancellarli davvero invece di lasciarli lì: pesavano **1,4 GB** su disco
(`banco-prova-negozio` 582 MB, `banco-prova-immobiliare` 451 MB, `banco-prova-accademia`
382 MB — quasi tutto `node_modules`), e cinque cartelle `banco-*` accanto ad `agenti/` fanno
sembrare questo repo un monorepo di applicazioni invece che una regia. Ma il motivo vero è
quello della §12: un banco che nessuno rilancia invecchia in silenzio, e il primo che ci guarda
dentro crede di leggere lo stato dell'arte.

**Cosa questa decisione costa, detto prima che qualcuno lo scopra dopo.** I verbali di
gestionale-crafter, flow-sentinel (P3, `evolve`) e speed-demon citano file dentro quei banchi:
quei riferimenti ora puntano nella storia, non nell'albero di lavoro. Chi vuole rileggerli fa
il `git checkout` qui sopra. E la batteria E2E di `banco-prova-negozio` — l'unico consumatore
reale che flow-sentinel abbia mai avuto — non è più a portata di un comando: per rifarla serve
`npm install`, `supabase start` e ricreare `.env.e2e.local`, che è esattamente lo stesso lavoro
che serviva ieri, solo dichiarato invece che presunto.

- **Stato:** presa. La §12 torna a essere la regola e la §20 torna a essere l'eccezione, con un
  criterio falsificabile invece che con un giudizio: **si traccia il banco che un clone pulito
  sa rilanciare**. Oggi ne risponde uno solo.

### 26. `webgun_content.txt` si genera, non si scrive

`Web Gun.docx` è il documento madre e si modifica in Word; `webgun_content.txt` esiste solo
perché un `.docx` è binario e git non lo sa confrontare (§3). Finché la copia di testo si è
aggiornata a mano, la coppia si è spezzata senza che nessuno se ne accorgesse: al 2026-07-30 il
`.docx` dichiarava Gestionale Crafter e Flow Sentinel «[Ce l'ho]» e il `.txt` li dichiarava
ancora «[Da creare]». Cioè l'unico dei due file che si può leggere in un diff — e quindi
l'unico che qualcuno legge davvero — era quello sbagliato, e lo era da due giorni.

Scelta: `scripts/estrai-docx.ps1`, quindici righe su `System.IO.Compression`, rigenera il
`.txt` dal `.docx`. Dopo ogni modifica in Word si rilancia; il `.txt` non si tocca a mano.

Un paragrafo per riga, non un run per riga come faceva l'estrazione precedente: Word spezza un
run a metà parola quando ci passa sopra il correttore, e il `.txt` tracciato ne portava la
cicatrice (`// BUTCHER DA METTE` e `REEEEEEEE` su due righe).

- **Stato:** presa. Non c'è nessun controllo automatico che i due file siano allineati: se il
  `.docx` cambia e nessuno rilancia lo script, il `.txt` torna a mentire. È un residuo noto, e
  il posto giusto dove chiuderlo è un gate della regia, che oggi non esiste.
- **Residuo chiuso il 2026-08-03 (P.7a):** il gate della regia esiste —
  `node scripts/verifica-regia.mjs`, passo `docx-txt`. Riestrae il `.docx` **in un file
  temporaneo** con lo stesso `estrai-docx.ps1` (`-Uscita`, aggiunto lì per questo) e lo
  confronta riga per riga col `.txt` tracciato: **misura, non riscrive**, perché un gate che
  sana quello che misura chiude verde a ogni giro e non dice mai che il documento madre è
  cambiato. PowerShell assente vale MANCANTE, mai PASS.

## Decisioni prese scrivendo i privilegi di Schema Forge (2026-08-03)

### 27. I privilegi si scrivono nelle migrazioni, perché i default di Supabase sono cambiati due volte in un mese

Terza puntata di una storia che questo repo aveva già a verbale due volte, e la prima
in cui la regola entra nel contratto d'uscita invece di restare un suggerimento.

**Gli episodi, tutti misurati su `pg_default_acl`, mai dedotti.**

| quando | CLI | `anon` / `authenticated` / `service_role` sulle tabelle nuove | come si è visto |
|---|---|---|---|
| 2026-07-28 | 2.95.4 | `arwdDxtm` — tutto, `anon` compreso | i `grant` scritti nelle migrazioni erano **no-op** (§22), e un `grant` per colonna non restringeva senza `revoke` |
| 2026-07-30 | 2.110.0 | `service_role` perde tutto; gli altri due sopravvivono **solo** dove una migrazione li riconcede | nove test E2E rossi **da fermo**, su un progetto che nessuno aveva toccato |
| 2026-08-03 | 2.111.0 | `Dxtm` — TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: **zero CRUD** | pgTAP muore con `permission denied for table animals`; il gate di luglio non era falso, era **scaduto** |

Nessuno dei tre cambiamenti era annunciato dallo schema, e nessuno dei tre poteva esserlo:
lo schema non conteneva una riga sui privilegi. Le due richieste nate dai primi due episodi
— «il `revoke` prima del `grant` va nella regola, non solo nell'esempio» e «`permessi_espliciti`
deve comprendere `service_role`» — erano rimaste scritte e non applicate.

**Scelta: ogni schema forgiato emette una migrazione di privilegi espliciti, nella forma
`revoke` → `grant`, per tutti e tre i ruoli.** Regola completa in
`agenti/schema-forge/SKILL.md` §I privilegi si scrivono, non si ereditano.

Le cinque premesse sono state provate su Postgres 17.6 reale prima di diventare regola (§18),
e due hanno cambiato la forma che era stata proposta a tavolino:

1. **Il `revoke` non serve «perché il default concede troppo»** — quella premessa è
   esattamente quella scaduta. Serve perché è l'unica riga che rende il `grant` scritto
   l'unica verità sui privilegi, qualunque cosa ci fosse prima: misurato, dopo un
   `grant update` di tabella intera il `grant update (full_name)` **non restringe niente**
   e l'auto-promozione riesce; con il `revoke` davanti, la stessa coppia nega.
2. **`Dxtm` non è «meno permissivo»: è distruttivo.** Comprende TRUNCATE, e **la RLS non si
   applica a TRUNCATE**. Misurato su uno schema con `force row level security` ovunque:
   `set role anon; truncate public.animals cascade` **riesce** e porta via dieci tabelle.
   La chiave anonima viaggia nel browser. Nessun `grant` riconcede mai `truncate`,
   `references`, `trigger` o `maintain` a un ruolo del client.
3. **Niente `alter default privileges`**, che era la proposta più elegante e la più sbagliata:
   sposta la cosa invisibile invece di toglierla, ed è legata a **chi crea l'oggetto**.
   Misurato sul banco: `pg_default_acl` conteneva **due righe in conflitto** per lo stesso
   schema (`supabase_admin` → `arwdDxtm`, `postgres` → `Dxtm`), e una tabella creata da un
   terzo ruolo nasceva con `relacl` **NULL**, cioè zero privilegi.
4. **Il privilegio ricalca le policy, ruolo per ruolo.** Dove il modello di accesso dice «—»
   non si scrive una riga; se il client non deve raggiungere una tabella affatto, la risposta
   resta spostarla in uno schema non esposto.
5. **`service_role` è nell'elenco.** Scavalca la RLS, non i privilegi.

**E l'audit impara a vederlo.** La regola 7 di `audit-lib.mjs` chiedeva al catalogo una cosa
più debole di quella che le serviva — «questa tabella compare in `role_table_grants` per
`anon` o `authenticated`?» — senza guardare **quale** privilegio. Con `Dxtm` la tabella
compariva lo stesso, con `privilege_type = 'TRUNCATE'`: la regola ha taciuto su 18 tabelle su
18, su uno schema in cui nessun ruolo del client poteva leggere una riga. Riscritta: confronta
i ruoli e i comandi di `pg_policies` con `has_any_column_privilege`, e produce un **`block`**.

Gravità `block` e non `issue`, per il criterio della §17: la prova è **interamente nel
catalogo**, senza una riga di euristica, quindi non c'è il caso legittimo da non disturbare —
e il danno è totale e muto, perché la metà dello schema che le policy descrivono non esiste.
`has_any_column_privilege` e non `has_table_privilege` perché un `grant update (colonna)` non
compare in `relacl` (§22): con la funzione sbagliata, l'audit boccerebbe il rimedio che la
skill stessa prescrive.

- **Stato:** presa. Resta **fuori**, e va detto: la versione della CLI Supabase e
  dell'immagine Postgres continua a non essere versionata da nessuna parte (era la richiesta
  n°2 del 2026-07-30). Finché non lo è, un aggiornamento resta un evento, non una decisione —
  e questa regola ne limita il danno invece di impedirlo.
