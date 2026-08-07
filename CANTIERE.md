# CANTIERE — Direzione lavori Web Gun

Contabilità del cantiere, tenuta dal **direttore dei lavori** (la sessione Claude Code di
regia). Gli operai sono chat separate di Claude Code: ricevono un prompt autosufficiente,
consegnano, e il direttore verifica prima di emettere il mandato successivo.
Chi riprende la direzione in una sessione nuova legge: **questo file**, poi `CLAUDE.md`,
`README.md`, `DECISIONI.md`, e gli `STATO.md` degli agenti toccati dai pacchetti in corso.

## Regole del cantiere (fissate dal committente il 2026-08-02)

- Il direttore **non costruisce**: scrive i mandati, gli operai costruiscono.
- Ogni prompt operaio è **autosufficiente**: dichiara i file da leggere, il deliverable, il
  gate da chiudere e il verbale da scrivere. La memoria condivisa è il repo.
- **Chi costruisce non collauda**: costruzione e collaudo avversario in chat diverse.
- **MANCANTE ≠ PASS**; nessun handoff senza riga `Gate:` veritiera; le prove si eseguono,
  non si raccontano.
- Azioni **irreversibili** (cancellazione dati, deploy, spese) a checkpoint umano
  (`DECISIONI.md` §6).
- Al ritorno di ogni operaio il direttore **verifica** — rilancia i gate quando può — prima
  del prompt successivo. Un verde che il direttore non sa rilanciare vale **non provato**.

## Rotta (decisioni del committente — non in discussione)

1. Prima l'agente del **sito pubblico** (in casa, da `template-skill/`, gate scritto PRIMA
   del flusso, componenti dietro la cucitura `src/components/ui` — deroga `DECISIONI.md` §21).
2. Poi il **filo completo**: un progetto realistico attraverso l'intera catena, con Alberto
   nel ruolo di committente che firma i contratti (`docs/flussi-critici.md`,
   `docs/performance.md`, il contratto della vetrina).
3. Poi **launchpad** (riusando l'idea del `BUILD_ID` di speed-demon), poi **site-doctor**.
4. **Non ora**: brief-smith, preventivo-smith, ai-specialist, cyber-shield, prompt-smith
   (quel ruolo lo fa Alberto, orchestrato dal direttore).
5. Gli **snapshot esterni** (code-maniac, code-inquisition, bugbay) non si toccano qui: le
   migliorie si propongono a finzidev nei repo d'origine.
6. Le **minuterie d'igiene** entrano dopo i punti 1–3.

## Decisioni di direzione

| # | Decisione | Motivo | Stato |
|---|---|---|---|
| D1 | Il nuovo agente del sito pubblico si chiama **`vetrina-crafter`** | è il gemello pubblico di `gestionale-crafter` (stesso schema a monte, l'uno il frontoffice l'altro il backoffice); il precedente di nome misto italiano/inglese è già in casa | presa 2026-08-02 — revocabile finché P.1 non parte |
| D2 | Il filo completo (P.4) **si ferma a speed-demon** | launchpad non esiste ancora (rotta n°3); il deploy è irreversibile e resta comunque a checkpoint umano. Il deploy del pilota diventerà il collaudo di launchpad (P.5) | presa 2026-08-02 |
| D3 | I prompt operai si **salvano nel repo**, in `agenti/<agente>/prompts/` | tradizione di flow-sentinel (`prompts/P1-costruzione.md`, `P2-collaudo.md`); i mandati sono tracciabili e sopravvivono alle sessioni | presa 2026-08-02 |
| D4 | Ogni mandato dichiara **modello ed effort consigliati** per la chat operaia. Profili: progettazione (P0), costruzione (P1) e collaudo avversario (P2) di una skill → **Opus 5 · max**; esecuzione di skill già collaudate su un progetto (filo completo) → **Opus 5 · high**; minuterie meccaniche ben specificate (P.7b) → **Sonnet 5 · high**; mai Haiku per pacchetti di cantiere | richiesto dal committente il 2026-08-02; le fasi che scrivono regole e cacciano falsi verdi meritano il massimo, l'esecuzione guidata dai gate no | presa 2026-08-02 |
| D5 | I mandati **trasversali** (più skill) si salvano in `prompts/` alla radice della regia | la D3 copre i pacchetti d'agente; P.0-igiene tocca quattro skill e non appartiene a nessuna | presa 2026-08-03 |
| D6 | P.0-igiene e P.8 **in sequenza, non in parallelo** (P.0-igiene → P.8 → ripresa P.2) | due chat parallele condividerebbero lo stesso working tree (commit intrecciati su `main`) e lo stesso banco acceso — il `db reset` di P.8 sotto il gate di prova di P.0-igiene produce esiti spuri. P.0-igiene è piccola: il parallelismo comprerebbe un'ora e rischierebbe misure sporche. Deviazione dichiarata dalla proposta del 2026-08-03 | presa 2026-08-03 |
| D7 | Perimetro di **P.8**: (a) il contratto d'uscita di `forge` emette privilegi espliciti — `revoke` + `grant` per `anon`/`authenticated` **e `service_role`** (la richiesta del 2026-07-30 nel suo STATO) — nella regola, non solo nell'esempio; (b) la regola 6 dell'audit impara a distinguere `Dxtm` da un grant vero (sul banco non è scattata: l'ACL non era vuota); (c) il banco torna al **suo rosso storico** documentato, non si sana; (d) sqlfluff e squawk installati (chiudono i 2 MANCANTI). **Fuori**: i 12 `security definer` PUBLIC e le 20 policy permissive del banco (il banco è rosso apposta e l'audit già li segnala); il seed `auth.users`/`identities` (altra classe: si apre prima di P.4) | non gonfiare il pacchetto; il banco è un caso di prova, non un progetto da sanare | presa 2026-08-03 — eseguita e collaudata (nota: le `security definer` PUBLIC sono **11**, non 12: conteggio corretto dal verbale P.8) |
| D8 | **Parallelismo a file disgiunti.** Possono correre insieme solo pacchetti i cui perimetri di **scrittura** non si intersecano e che non condividono un banco. Ogni operaio committa **solo i propri percorsi** (`git add` espliciti, mai `-A`, mai `commit -a`: l'index git è unico) e **non tocca `CANTIERE.md`** — la contabilità la scrive il direttore ai ritorni. Assetto corrente (aggiornato 2026-08-04, sera): **P.0-igiene-2 da sola**, poi **P.4a da sola** — il difetto junction rende i perimetri di correzione e guardiani non più disgiunti (stessi `scripts/` e stessi `STATO.md`), e il piano di P.4 prescrive il filo come **unico lavoro attivo** (§2); **P.7c-ripresa-2 accodata** a valle | richiesta di velocità del committente (2026-08-03); il working tree e l'index sono unici, e due gate sullo stesso banco producono misure sporche (lezione D6) | presa 2026-08-03 |
| D10 | Il **dominio del pilota di P.4 è una pizzeria con ordini d'asporto** — menu pubblico, ruoli titolare/cucina, contenuti editabili, flusso critico = **ordine con macchina a stati** (ricevuto → in preparazione → pronto). **Il pagamento resta fuori** (nessun agente lo copre; si paga al ritiro), e va scritto nel `PROGETTO.md` del pilota | dominio nuovo: vetcare, controtempo e valscura hanno già provato la *prenotazione*, e una classe di flusso mai attraversata è l'unica che fa emergere ciò che le reference danno per scontato. È anche il cliente-tipo che Maps Scraper procura davvero | presa dal committente 2026-08-04 |
| D11 | Il **progetto pilota vive in un repo separato**, non dentro la regia | lo prescrive il `CLAUDE.md` («i siti veri vengono generati in repo separati»), e il pilota è il candidato al deploy di P.5: dentro la regia sarebbe un `banco-prova-*` che la §25 imporrebbe di cancellare a fine P.4 — cioè si butterebbe proprio il progetto che P.5 deve pubblicare. Costo dichiarato: i gate non hanno mai girato fuori dall'albero della regia (misurato: reggono, perché separano `SKILL_DIR` da `process.cwd()`; **ma `installa-skill.ps1` non ha un parametro di destinazione**, quindi il repo pilota non vedrebbe nessuna skill → deliverable 1 di **P.4-pre**) | presa dal committente 2026-08-04 |
| D9 | Lo **scarto pgTAP del banco** (P.8: `rls_policy.test.sql`, asserzione 11 — `count = 0` presupponeva un `select` che il modello di accesso nega) si chiude **riallineando il test a `throws_ok(…, '42501', …)`**, la forma più forte del rifiuto — non aggiungendo il grant che lo farebbe passare. Esecutore: **P.7c** (l'operaio di P.8 giustamente non ha riscritto il giudice della propria migrazione). Fino ad allora il rosso documentato del banco comprende anche quella riga | un'asserzione che pretende un privilegio mai scritto è un rosso strutturale, e un rosso strutturale insegna a ignorare il rosso | presa 2026-08-03 |
| D12 | Il **difetto junction** (P.4-pre: tutti e cinque i gate escono **0 muti** invocati da `.claude/skills/...`, mentre per percorso reale escono 2 col messaggio) si chiude **prima di P.4a** con un pacchetto dedicato, **P.0-igiene-2**; fino al collaudo della correzione i gate si lanciano **per percorso assoluto dentro la regia** | la junction è esattamente il canale con cui una chat aperta sul repo pilota vede le skill (D11): misurare il filo completo aggirandola lascerebbe il falso verde piantato dove il pilota cammina — e l'aggiramento «percorso assoluto» non lo suggerisce nessun gate, perché il difetto è proprio il silenzio | presa 2026-08-04 |
| D13 | Il pilota si chiama **`fornodoro`** (pizzeria «Forno d'Oro»), repo `C:\Users\Utente\Desktop\fornodoro`, blocco porte **7620-7629** (api 7621, db 7622), app di produzione **3621**. Regola generale che ne nasce: **le porte nuove si scelgono sotto 49152** e si verificano con `netsh interface ipv4 show excludedportrange protocol=tcp`, non con `Test-NetConnection` | il blocco 5762x prenotato in origine cade dentro l'esclusione WinNAT 57464-57963 (P.4a §1: «forbidden by its access permissions»), e l'intero intervallo dinamico 49152-65535 è risucchiabile a ogni riavvio — le porte dei tre banchi ci abitano e hanno funzionato per fortuna; `Test-NetConnection` guarda chi ascolta, non chi ha prenotato. I banchi restano sui loro numeri finché non falliscono un avvio (migrazione deliberata, non preventiva) | presa 2026-08-04; **corretta e ratificata dal direttore il 2026-08-05** sulla deroga dichiarata di P.4a |
| D14 | **La catena non si ferma più al committente.** Dal 2026-08-05 i mandati prescrivono di **arrivare in fondo da soli**: le scelte tecniche, i dati finti e le alternative le decide l'operaio (o il direttore al ritorno), e i due contratti che restano (`docs/flussi-critici.md`, `docs/performance.md`) si firmano **per delega dichiarata** — `Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il <ISO>`, mai col nome di chi non ha letto. **Conseguenza dichiarata, non aggirata**: una firma delegata **non chiude** il motivo «la firma è nostra» negli `STATO.md` di flow-sentinel e speed-demon — P.4 chiuderà quel motivo per **una** skill su tre (vetrina, firmata davvero il 2026-08-05) e lo lascerà aperto per le altre due finché Alberto non controfiirma le due righe. I contratti restano pronti alla controfirma: sostituire la riga e rilanciare i due gate costa cinque minuti | richiesta del committente del 2026-08-05 («fai in modo che vada fino in fondo da solo senza indicazioni mie»); la §6 di `DECISIONI.md` vieta di delegare ciò che è irreversibile — pubblicare (vetrina) e «chi può promuovere chi» (gestionale) **sono già firmati da lui**, quindi la delega tocca solo i due contratti di collaudo. Firmare col nome di un umano che non ha letto sarebbe il difetto n°1 del collaudo avversario di speed-demon rifatto da noi | presa 2026-08-05 |
| D16 | Il **debito n°26** (`[auth].site_url` del pilota dichiara la 3000 mentre l'app vive sulla 3621: senza `--url` il gate dei flussi misura una porta vuota — su un'altra macchina misurerebbe **l'app di uno sconosciuto**) si chiude **in apertura di P.4e**, che riavvia comunque lo stack e ricostruisce; e la lezione generale va in minuteria: **ogni gate che accetta `--url` deve saper leggere l'indirizzo dal contratto**, come fa la vetrina da `docs/vetrina.md` | è il precedente del 2026-07-30 in forma nuova (una porta dichiarata in un documento firmato ha fatto misurare il sito di un'altra azienda); e il difetto non è del pilota, è **di tre skill** che si fidano di un default | presa 2026-08-05 |
| D15 | Il **debito n°22 del pilota** (un titolare cambia il ruolo di un collega — e ne crea uno nuovo — via HTTP diretto: la riga «non raggiungibile da un browser» dello Specchio del gestionale era **falsa**, smentita dal tribunale di P.4c) si chiude con la strada **(b)**: `revoke update (ruolo)` più la funzione `cambia_ruolo()`. **Esecuzione rimandata a dopo P.4e**, in un pacchetto `evolve` unico insieme al **n°11** (`crea_ordine` casta prima di validare) → riga **P.4f** | (a) lasciare la capacità con la sola traccia non regge alla costituzione (sicurezza > minimalismo) quando il privilegio è di tabella intera; ma riaprire l'anello 07 **a metà catena** invaliderebbe le misure a valle (flow-sentinel prova i flussi su questo schema, speed-demon misura questa build), e la lezione D6 vale qui alla lettera. In più il pacchetto fa esercitare al pilota il comando `evolve`, l'unico della skill che la catena non ha ancora attraversato: il costo diventa copertura. Fino ad allora la capacità resta, e la giustificazione falsa è **già corretta sopra la firma** (`docs/gestionale.md` §12) | presa 2026-08-05 |
| D17 | **Cantiere a quattro chat parallele, e il pilota è il banco condiviso.** Dal 2026-08-06 (scadenza del committente: sabato 2026-08-08) girano insieme fino a quattro chat operaie. Protocollo: (1) **perimetri disgiunti dichiarati in ogni mandato**, commit **solo** coi propri percorsi e `git add` espliciti — mai `-A`, mai `commit -a`; su `index.lock` occupato si aspetta, non si cancella; (2) **`fornodoro` è il banco di P.5 e P.6** invece di due banchi nuovi: è un sito vero, completo, gate-verde e **non conforme** — proprio ciò che serve a due gate nuovi per uscire rossi per motivi veri; (3) **la proprietà in scrittura del pilota è di P.4g e di nessun altro** (schema, seed, migrazioni, `package.json`): P.6 legge, P.5 può ricostruire l'app dichiarandolo e rilasciandola viva; (4) **un solo stack Supabase acceso**, quello del pilota, e nessuno lo spegne; (5) **nessuno cita un `BUILD_ID` come fatto in prosa** — chi vuole l'identità dell'app la rilegge al momento della misura. In più: **P0 e P1 delle due skill nuove si fanno in un pacchetto solo**, con **P2 (collaudo avversario) sempre in chat vergine** | la regola «chi costruisce non collauda» difende il *collaudo*, non la *revisione di progettazione*: unire P0+P1 costa la revisione del direttore in mezzo — costo **dichiarato**, compensato dall'obbligo di scrivere il gate prima del flusso e da uno STOP di auto-revisione a metà pacchetto («quale passo del mio gate sarebbe verde su un sito non conforme / su un deploy da non fare»). Il banco condiviso non è un risparmio di tempo: un banco costruito dalla stessa chat che scrive il gate è un banco che il gate sa già superare, mentre il pilota è stato costruito da cinque agenti che non sapevano dell'esistenza di questi due | presa 2026-08-06 |
| D18 | **La seconda ondata, e la credenziale che è sopravvissuta al numero.** Quattro consegne il 2026-08-06 (P.7c-ripresa-2, P.6, P.5, P.4g), tutte verificate in proprio dal direttore. Tre decisioni che ne escono. **(1) Il debito n°27 del pilota non è chiuso: è stato rinumerato.** Tre fonti indipendenti convergono e nessuna delle tre da sola bastava: l'handoff `14` dichiara nella stessa tabella «27 chiuso» e «44 aperto»; n°44 misura che su una **produzione appena creata** i due account con `password123` **entrano davvero** (riprodotto in transazione annullata, `INSERT 0 2`, la password committata li apre); il gate di launchpad, che la prosa non la legge, blocca sul file tracciato **e sulla storia**. Ciò che P.4g ha chiuso — il percorso di produzione documentato — è chiuso e misurato; il pericolo è sopravvissuto sotto un altro numero. **Una voce che cambia numero senza cambiare rischio è contabilità, non una correzione.** (2) Sulla scelta che P.4g ha correttamente lasciato alla direzione (n°44: **(a)** il seed di sviluppo esce da `sql_paths`, **(b)** la difesa è la procedura scritta) vince **(a)**, preceduta da una **caccia misurata a un discriminante fail-closed** — n°44 dichiara che nessun segnale dentro Postgres distingue uno sviluppo appena resettato da una produzione appena creata, ma ne ha provati morti **due**, e questa casa sa che *un limite dello strumento non è una proprietà del mondo*. (3) **I gate diventano più severi mentre il pilota lavora**, e va bene così: P.7d irrigidisce i quattro gate storici mentre P.4h li rilancia sul pilota. Un gate che comincia a rifiutare un progetto che prima accettava è il sistema che funziona; una chat che nasconde quel rosso è il sistema che fallisce. Ogni rilancio cita il commit della regia con cui è stato fatto | il direttore è l'unico che vede tutte e quattro le consegne insieme: n°27 lo scopre solo chi legge l'handoff di una chat, il registro di un'altra e il gate di una terza nello stesso pomeriggio. E la scelta fra (a) e (b) tocca il contratto di un gate: nessun pacchetto di prerequisiti poteva prenderla | presa 2026-08-06 (sera) |
| D19 | **L'indice di git è condiviso, e `git add` per nome non è un perimetro.** Da oggi ogni chat operaia committa **`git commit -F - -- <i suoi percorsi>`**: un commit limitato da pathspec ignora l'indice e prende il contenuto dell'albero di lavoro di quei soli percorsi. Mai `git commit` nudo, mai `-A`, mai `-a` | misurato il 2026-08-06: `03a3bac` (17:01:52) è di launchpad; `ab978cd` (17:02:44) è di site-doctor **e si porta via due file di launchpad** già messi in scena; `670730c` (17:03:00) è di nuovo di launchpad e ritocca gli stessi due file. Cinquantadue secondi. Niente è andato perso, ma `git log -- agenti/launchpad/scripts/gate-lib.mjs` risponde con un messaggio che parla della favicon. Il collaudo di site-doctor aveva scritto, in buona fede e con ragione, che `git add` per nome l'aveva salvato **due volte**: protegge da ciò che un'altra chat ha **modificato**, non da ciò che un'altra chat ha **messo in scena**. Una regola che difende l'abitudine di una chat non è un perimetro quando lo stato è condiviso | presa 2026-08-06 (notte) |
| D20 | **La firma per delega non copre ciò che autorizza.** La D14 ha introdotto `Confermato da: Direzione lavori (per delega…)` per contratti che **descrivono un lavoro già fatto**. `docs/deploy.md` non descrive: **autorizza**, e autorizza l'unico atto irreversibile della catena. Il gate di launchpad la trasforma in `block` **sul solo runbook**; resta valida ovunque altrove | il collaudo di P.5 ha misurato che oggi passa, ha detto che non va accettata **e** che non va rifiutata da un gate che si riscrive il mandato da solo: aveva ragione su entrambe le metà, e la metà mancante è della direzione. La riga che separa i due casi: **si può delegare la firma su un verbale, non su un mandato** | presa 2026-08-06 (notte) |
| D21 | **Le sette deleghe vuote: chi misura, possiede.** `favicon`, Open Graph, JSON-LD, `sitemap.xml` e `robots.txt` passano a **site-doctor**, che cammina già ogni pagina e scarica già la sitemap. `contrasti` resta a **speed-demon** — unico gate con un browser — che smette di leggere `report.categories.accessibility.score` e legge `report.audits["color-contrast"]`. L'a11y dell'area admin resta a gestionale-crafter ma la dichiarazione deve dire **«sui sorgenti»** | rimisurato in proprio dalla direzione: in `agenti/speed-demon/`, esclusi i test, `contrast` **0 file**, `og:` **0**, `favicon` **0**; `sitemap` e `application/ld+json` compaiono **solo dentro `references/seo.md`**, cioè documentazione che *insegna* e non un gate che *misura*; ogni `robots` negli script è `<meta name="robots">`, cioè l'altra voce. La skill nata dalla favicon a 404 delegava la favicon a un gate in cui la parola non compare: il difetto non era corretto, era spostato di un piano. **Regola generale che ne esce: la soglia di una categoria non è la misura di un audit** — ogni gate che delega a «una categoria che contiene X» è più debole di quanto dichiara, e i quattro gate storici vanno auditati per quella forma | presa 2026-08-06 (notte) |
| D22 | **n°50, e la terza volta della stessa forma.** Il gate del gestionale legge `tsconfig.json` come JSONC e toglie i commenti a blocco con `/\/\*[\s\S]*?\*\//g`, senza saltare le stringhe: `"@/*"` — l'alias che `create-next-app` scrive in **ogni** progetto Next — apre un commento che si chiude dentro `"**/*.ts"` di `include`, e settanta caratteri di JSON valido spariscono. Correzione prescritta: `JSON.parse` sul **testo grezzo per primo**, e solo se fallisce uno spogliatore che sa di essere dentro una stringa | riprodotto in proprio il 2026-08-06 (`MANC tipi del progetto`, posizione 472, mentre `JSON.parse` sul file vero riesce): il gate è **rosso su ogni progetto che questa casa genera**, ed è arrivato con P.7d mentre chiudeva i quattordici del tribunale. È la **terza istanza in due giorni** di un solo difetto — `<!--` dentro un attributo (tribunale, site-doctor), `</script>` letto come apertura (collaudo P.6-P2, site-doctor), `/*` dentro una stringa (P.4h, gestionale): **un parser scritto a mano che non rispetta il contesto che lo racchiude**, con la batteria verde ogni volta perché ogni fixture era modellata sull'implementazione invece che sull'input vero. Ne segue un audit di tutti gli scanner a mano delle quattro skill, con un test ostile ciascuno | presa 2026-08-06 (notte) |
| D23 | **Due classi aperte per costruzione, chiuse con una forma fissa.** (1) Per il solo passo `catena-gate`, un `Gate: VERDE` **dentro una citazione non conta**: per gli altri cinque agenti la §19 vale su un documento che scrivono loro, per launchpad vale su **certificati altrui**, e la citazione è esattamente il modo in cui si riporta il verdetto di un altro progetto. Costo accettato e da pagare ad alta voce: un verdetto legittimo scritto in citazione diventa un rosso, e il messaggio deve dire come si toglie. (2) `docs/DEBITO-TECNICO.md` prende una riga di forma fissa `Blocca il deploy: sì \| no`; l'assenza vale **MANCANTE per quella voce**, non `pass`. Le euristiche sulla prosa restano solo come `warn` che nomina le voci non ancora migrate | il collaudo di P.5 ha scavalcato due forme di «blocca il deploy» e ne ha aggiunte due, e ha scritto la frase che decide: *l'elenco delle forme che il gate riconosce è aperto per costruzione*. Una colonna chiude la classe invece di rincorrerla — è la stessa scelta della §19. Il cambio del gate e la migrazione delle cinquanta voci del pilota **viaggiano nella stessa ondata**, così non esiste una finestra in cui il pilota è rosso per una regola che nessuno poteva soddisfare (governata da D18 §3) | presa 2026-08-06 (notte) |
| D24 | **n°27: dichiarata adesso, riscritta prima del primo `push`.** Si accetta la proposta di P.4h — lasciarla dichiarata finché il repository resta in casa, riscrivere la storia prima che esca — con un innesco più preciso: **il primo `git push` verso un qualunque remoto**, perché è l'istante in cui la storia smette di essere riscrivibile. Fino ad allora il `block` di launchpad è corretto e **non si «risolve» accorciando la finestra di storia che il gate legge** | oggi `master` non ha nessun remoto configurato — lo stampa il gate stesso. `password123` è in HEAD e in cinque punti della storia: P.4h l'ha resa irraggiungibile da ogni comando documentato contro un database remoto (rimisurato dalla direzione: `db reset` lascia `auth.users=0`, `psql -f` a mano è rifiutato `P0001` senza scrivere), ma nessuna modifica futura la toglie a chi ha già clonato. Il costo della riscrittura è basso adesso e diventa impossibile dopo | presa 2026-08-06 (notte) |
| D25 | **Il banco di un collaudo entra in regia come script.** Gli script che rigenerano `banco-prova-collaudo-sd` (`banco-sl.mjs`, `giro.mjs` e compagni) vivono **solo dentro la cartella gitignorata**: la correzione al buco di riproducibilità trovata da P.6-P3 (il comando documentato in testa cancellava i due documenti che il gate legge) non è in nessun commit, e il «VERDE 14/14» del banco resta un'affermazione che solo questa macchina sa rifare. Accolta la proposta della chat: i **sorgenti** del banco entrano tracciati in `agenti/site-doctor/`, ciò che si rigenera resta ignorato — esecutore **P.6-P4** | è la §25 di `DECISIONI.md` applicata col suo stesso criterio («si traccia il banco che un clone pulito sa rilanciare» — e questo banco è fatto di file, senza chiavi né database), ed è la forma che launchpad ha già come requisito permanente (`banco.mjs`, P.5-P3). Escalation dichiarata da P.6-P3 (`STATO.md` §Cosa resta n°6: «proposta alla direzione, non decisione della skill»); rimisurato dalla direzione: gli script esistono solo su disco | presa 2026-08-07 |
| D27 | **Il pilota va in archivio: ha fatto il suo mestiere.** Parole del committente, 2026-08-07 sera: *«fornodoro era solo per testare i vari agenti… a me non interessa quel sito»*. Conseguenze: **niente pubblicazione** — P.3 è **sospeso a data da destinarsi** e si farà sul primo sito che meriti di uscire; la **firma del runbook decade come richiesta** (il segnaposto resta, e launchpad **ROSSO 2 è lo stato finale corretto**: il sistema dice «questo sito non è autorizzato a uscire», che è la verità); app 3621 e stack Supabase **spenti dalla direzione** (volumi preservati — si riaccende con `npx supabase start` + `npx next start -p 3621` da `fornodoro`); la **cartella non si elimina**: è il solo banco end-to-end della catena, e le ondate future (i 45 di site-doctor, le skill che verranno) si collaudano lì. Se il committente vorrà eliminarla davvero, è un gesto suo, con questo costo scritto accanto | il pilota era il banco, non il prodotto: il prodotto è la catena, e la catena è collaudata. Tenere acceso uno stack per un sito che nessuno guarda è RAM buttata su una macchina da 16 GB | presa 2026-08-07 (sera) |
| D26 | **Le voci del docx «in arrivo dagli amici» non si costruiscono in casa.** Quanto `Web Gun.docx` etichetta `[In arrivo dagli amici]` — dentro la pipeline **Brief Smith** (fase 0), **Prompt Smith** (fase 1) e **Fly UI** (n°8); fuori pipeline Everything Scraper, Agent Crafter, Super Teacher, Brainer, Projentic, Flowtastic — **si aspetta: nessun P0 si scrive qui**, la casa si concentra sulle skill proprie. Di conseguenza la terna d'ingresso resta chiusa per decisione e non solo per rotta: due voci su tre sono «dagli amici», e Preventivo Smith da solo non è una terna | parole del committente, 2026-08-07: *«quello che c'è scritto etichettato come "in arrivo dai miei amici" non lo facciamo e aspettiamo, ci concentriamo sulle cose nostre»*. Etichette rilette dal docx estratto in cartella temporanea (il gate della regia già prova che docx e copia di testo combaciano); il docx resta uno snapshot: non si tocca | presa 2026-08-07 |

## Pacchetti di lavoro

Stati possibili: `da fare` · `in corso` (prompt emesso, operaio al lavoro) · `consegnato`
(esito riportato, verifica del direttore in corso) · `collaudato` (verificato, chiuso).

| # | Pacchetto | Obiettivo | Prerequisiti | Criterio di accettazione | Stato |
|---|---|---|---|---|---|
| P.1 | vetrina-crafter — P0 progettazione | `SKILL.md` completo col gate scritto PRIMA del flusso, passi del gate progettati con id stabili, template del contratto e dell'handoff, `STATO.md` col piano P0→P3 | analisi di cantiere (fatta) | revisione del direttore + **firma del committente** sulla progettazione; checklist del template (`COME-USARE-QUESTO-TEMPLATE.md` §9); nessun comando speculativo | **consegnata 2026-08-02** (commit `a1ee045`, Opus 5 · max) — revisione del direttore: **promossa**, 3 rilievi minori assorbiti nel mandato P.2; in attesa della firma del committente |
| P.2 | vetrina-crafter — P1 costruzione | references, `scripts/` (verify.mjs + lib pure + test), banco usa e getta via schema-forge, **tutti e 7 i comandi esercitati**, sabotaggio provato | P.1 firmata | gate **VERDE 10/10** sul banco e **ROSSO** su ogni sabotaggio; `node --test` verde; guardiani sugli script (package.json+eslint locali, come schema-forge); verbale `COSTRUZIONE-<data>.md`; a gate verde entra in `README.md` e `installa-skill.ps1` | **parziale, ferma al banco** — deliverable 1-3 consegnati 2026-08-03 (Opus 5 · max, commit `b7fa58f · 43ff29f · 2697787`); 113 test **rilanciati dal direttore**, 113 pass 0 fail. Fermata al deliverable 4 per **due prerequisiti fuori dal suo perimetro**: i GRANT di schema-forge (P.8) e i cinque `import.meta.main` (P.0-igiene). Tre decisioni sospese in attesa del banco (S1 slot senza riga pubblicata, S2 soglia 24 caratteri, S3 rilievi sulle date). **Ripresa emessa 2026-08-03**: mandato `agenti/vetrina-crafter/prompts/P1-ripresa.md` (Opus 5 · max). **Consegnata e collaudata il 2026-08-04**: gate **VERDE 10/10 rilanciato dal direttore** su `banco-prova-controtempo` (e visto rifiutare il verde con Docker spento: MANCANTE ≠ PASS dal vivo, con `contratto-uscita` che boccia l'handoff `VERDE` su esecuzione rossa); batteria **122/122 rilanciata**; 7/7 comandi esercitati; S1=`block` (misurata), S2=24 confermata (e scoperto che i candidati contenevano UUID e timestamp), S3: un falso positivo previsto **non esiste**; 22 classi di sabotaggio, 3 difetti del gate chiusi con test, 4 premesse smentite (fra cui la dottrina sulla colonna non disegnata: nei Server Components non viaggia — ma la chiave anonima nel bundle espone ciò che grant+policy concedono, ed è la misura che sostituisce la regola); schema-forge VERDE 9/9 sopra; README riga 8 e `installa-skill.ps1` aggiornati (verificati dal gate della regia). Verbale `COSTRUZIONE-2026-08-03.md`. **Chiusa** |
| P.0-igiene | I gate tornano a parlare su Node 20 | i cinque `import.meta.main` corretti con la forma di vetrina-crafter + **due** test di regressione per script (funzionale: spawn in cartella non-progetto, uscita ≠ 0 e output non muto; statico: il sorgente non contiene `import.meta.main` — il funzionale su Node 24 non vede questo difetto) | — (urgente: col node di sistema ogni gate esce 0 muto) | prove **due-direzioni** su 5 script incollate; gate di schema-forge sul banco col node di sistema = stesso verdetto misurato dal direttore (ROSSO, 1 fallito, 2 mancanti); batterie 144/105/108/73 verdi; `STATO.md` delle quattro skill aggiornati | **consegnata 2026-08-03** (Opus 5 · max) — 5 punti corretti con la forma di vetrina-crafter; prove due-direzioni su 5 script × 2 node: **prima** Node 20 usciva `0` con zero righe e Node 24 usciva `2` col messaggio, **dopo** tutti e dieci escono `2` con lo stesso messaggio. Gate di schema-forge sul banco **col node di sistema**: ROSSO, 1 fallito (pgTAP `permission denied for table animals`/`price_list_items` → P.8) e 2 mancanti (sqlfluff, squawk) su 9 — identico alla misura del direttore con Node 24. Batterie **146/109/110/75** (+10 test nuovi: 2 per script, funzionale e statico); i due test provati per sabotaggio — reintrodotto `import.meta.main` in schema-forge, su Node 24 il funzionale **passa** e lo statico fallisce, su Node 20 falliscono entrambi. `STATO.md` delle quattro skill aggiornati. **Collaudata dal direttore il 2026-08-03**: 5/5 script rilanciati col node di sistema (tutti exit `2` con messaggio), batterie **146/109/110/75 rilanciate, 0 fail**, gate sul banco col node di sistema **ROSSO 1 fallito / 2 mancanti, uscita 1** (identico), grep: nessuna guardia viva, residui solo in commenti e test. **Chiusa** |
| P.8 | schema-forge emette privilegi espliciti | contratto d'uscita di `forge` con `revoke`+`grant` espliciti (compreso `service_role`); regola d'audit che distingue i privilegi CRUD da `Dxtm`; banco riportato al suo rosso storico; sqlfluff+squawk installati (perimetro: D7) | P.0-igiene collaudata (fatto) | gate di schema-forge sul banco: ROSSO **per i soli motivi storici documentati** (pgTAP 2 fail su 23 + block/issue noti), **0 verifiche mancanti**; regola nuova con test (caso che scatta + caso che non scatta); `STATO.md` aggiornato | **consegnata 2026-08-03** (Opus 5 · max) — gate sul banco **ROSSO, 2 falliti, 0 mancanti su 9**, col `block` su `staff.job_title` **tornato** e pgTAP a **2/23** (asserzioni storiche 22-23). Regola 7 dell'audit riscritta (`role_table_grants` non distingueva `Dxtm` da un grant vero): **0 findings prima → 21 `block` dopo** sullo stesso banco, gravità `block` per il criterio §17. Migrazione nuova in coda (`20260803120000_permessi_espliciti.sql`), banco **non sanato**. Test **146 → 153**; ESLint e knip puliti; sqlfluff 4.2.2 e squawk 2.61.0 installati con `pipx`. Voce **`DECISIONI.md` §27**. Tre scoperte oltre il mandato: `anon` col default poteva **`truncate`** (la RLS non filtra TRUNCATE); `pg_default_acl` aveva **due righe in conflitto**; sqlfluff **saltava in silenzio** una migrazione da 20 384 byte. **Uno scarto dal verdetto atteso**: `rls_policy.test.sql` si ferma a 10/11 — l'undicesima asserzione pretendeva un `select` ad `anon` che il modello di accesso nega (vedi giornale). **Collaudata dal direttore il 2026-08-03**, tutto rilanciato in proprio: gate sul banco ROSSO 2 falliti / 0 mancanti (uscita 1), `block` su `job_title` presente, pgTAP 22-23; ACL verificate con psql (`anon=r` solo su `clinics`/`species`, nessun ruolo client con `Dxtm`); batteria 153/153. Lo scarto `rls_policy` 10/11 → decisione **D9** (riallineo a `throws_ok` in P.7c). **Chiusa** |
| P.3 | vetrina-crafter — P2 collaudo avversario | chat vergine, dominio diverso, caccia ai falsi verdi dei passi del gate; il banco del collaudo DEVE avere un **modulo pubblico** (mai misurato), immagini vere, più pagine/slot, gate cronometrato | P.2 collaudata (fatto) | verbale `COLLAUDO-<data>.md` con difetti **misurati prima e dopo**, un test di regressione per difetto; gate corretto rilanciato senza regressioni su `banco-prova-controtempo` | **parziale, interrotta senza verbale** — mandato emesso 2026-08-04 (`agenti/vetrina-crafter/prompts/P2-collaudo.md`, Opus 5 · max). La chat ha aperto il banco nuovo (`banco-prova-valscura`, rifugio alpino: 9 pagine, 13 slot, immagini vere, modulo pubblico `richieste_prenotazione`) e committato **sei difetti veri in tre commit** (`d9c62b2 · 47ceb20 · a315c78`): tre `block` falsi del frammento distintivo (`to_jsonb(t)` candidava la chiave dello slot e il percorso di una foto — e il testo alternativo, che invece non doveva sparire); la diagnosi sotto-soglia senza il numero della manopola; **il percorso di scrittura pubblico che nessuno dei dieci passi leggeva** (lettura anonima della buca delle lettere aperta con due righe di SQL → VERDE 10/10; ora `block` misurando impersonando `anon`); **la regola delle zero righe morta da P1** (`psql` senza `-q`: `SET0` → `NaN`, il modo n°1 in cui una vetrina fallisce in silenzio non poteva scattare). Batteria 122 → **144**. **Verifica del direttore 2026-08-04**: batteria **144/144 rilanciata**; gate corretto **rilanciato su `banco-prova-controtempo`: VERDE 10/10, uscita 0** — la prova finale del mandato, senza regressioni. **Mancavano**: verbale, `STATO.md` e il resto della caccia → ripresa emessa 2026-08-04 (`agenti/vetrina-crafter/prompts/P2-ripresa.md`, Opus 5 · max), **consegnata lo stesso giorno come prescritto** — un commit ogni ~7 minuti, verbale `COLLAUDO-2026-08-04.md` aperto prima della caccia coi 6 difetti già committati ricopiati con la provenienza dichiarata riga per riga, poi **8 difetti nuovi** (§3.7-3.14, un commit ciascuno): **14 in tutto**, batteria 122 → **177**, `STATO.md` riscritto. Gate su controtempo **VERDE 10/10 al secondo lancio** — il primo rosso non era una regressione: nove passi invariati e verdi, e le regole nuove hanno trovato **19 colonne e una tabella intera leggibili da un anonimo che nessuno aveva firmato**, sanate rendendo vero il contratto senza toccare il banco (il filo dei 14: il gate leggeva i documenti riscrivibili, non il database — le due tabelle firmate di `SKILL.md` non le leggeva nessun passo, difetti n°5 e n°9; sul banco: 22 colonne dichiarate a un anonimo, 36 concesse). 3 classi cieche su 6 smentite (una era perfino difesa da un test), una ristretta, due confermate con la motivazione del non-chiuderle. Due residui non dichiarati della prima metà trovati e rimossi (un sabotaggio di classe B ancora piantato, una riga di contenuto scostata dal seed). Dichiarati: **jscpd non rilanciato** dopo il collaudo (in `STATO.md` come non rilanciato, non come pulito), build Turbopack del banco **intermittente su questa macchina** (~1 su 2, worker postcss — isolata: non dipende da Node né da `.next`; §7.3 del verbale, non è della skill). **Verifica del direttore 2026-08-04**: batteria **177/177 rilanciata** (0 fail), gate vetrina **rilanciato in proprio su valscura vivo: VERDE 10/10, 0 mancanti, uscita 0** (identità dell'app dal build id, nessun indizio di dev server), gate della regia VERDE 5/5. **Chiusa** |
| P.4 | Filo completo (progetto pilota) — **ombrello** | un progetto realistico attraversa schema-forge → vetrina-crafter → gestionale-crafter → flow-sentinel → speed-demon; Alberto firma i contratti da committente | P.3 collaudato | i cinque gate VERDI **rilanciati dal direttore**; catena handoff 07→08→10→12→13, ognuno che cita un fatto verificabile del precedente; cinque righe `Confermato da:` col nome del committente; verbale di catena che dichiara **cosa si è rotto fra un anello e l'altro**; le tre frasi «non usabile su un progetto cliente» riscritte (vetrina, flow-sentinel, speed-demon) e **le due che restano, restano**; si ferma a speed-demon (D2) | **CHIUSA il 2026-08-06** — verbale di catena `PILOTA-2026-08-06.md` (scritto dal direttore). **Cinque gate verdi rilanciati in proprio** sulla build `p1ETtUu2HEAB4sH7mKrJW`: 9/9 · 10/10 · 7/7 · 7/7 (22 test E2E) · 7/7 (3 giri, seo 100). **Catena 07→08→10→12→13 consumata davvero**: ogni handoff cita un fatto del precedente che non poteva inventare, e quello del 12→13 ha impedito a un anello di scrivere un test verde e falso. **Firme: tre vere di Alberto** (Specchio del dominio, `vetrina.md`, Specchio del gestionale) **e due per delega** (D14) → il motivo «la firma è nostra» si chiude **per vetrina-crafter soltanto**; flow-sentinel e speed-demon restano aperti in attesa di controfirma (cinque minuti del committente). **Cosa si è rotto fra un anello e l'altro**: nessuna difesa dichiarata; ma **quattro volte su cinque anelli una causa è stata attribuita male a un difetto trovato**, e ogni volta l'ha scoperta il rimisurare dopo la correzione — *convalidato non è misurato*. I quattro tribunali hanno prodotto **43 rilievi** che gli strumenti statici (tutti verdi) non vedevano. Debito del pilota **6 → 32 voci**, con due bloccanti dichiarati per P.5 (n°27 password note nel seed, n°32 build impossibile su Node 20). Piano: `prompts/P4-piano.md`; decisioni del committente **D10** e **D11** |
| P.4-pre | La strada per un progetto fuori dalla regia | (1) `installa-skill.ps1` impara un `-Destinazione` (default invariato), gate della regia ancora verde; (2) prova che un gate parla da fuori dall'albero — uscita **2 col messaggio**, mai 0 muto — e la stessa prova **dalla junction** per speed-demon, l'unico con `AGENTI_DIR = dirname(SKILL_DIR)`; (3) prova che la riga `Confermato da: Alberto Marocco (committente) il <ISO>` è accettata dai tre gate che la leggono e **rifiutata** col segnaposto `{{…}}`; (4) porte del pilota libere, banchi inutili spenti | P.3 e P.7c chiuse | le quattro prove **incollate**, due direzioni dove la forma le prevede; gate della regia verde | **mandato scritto 2026-08-04** — `prompts/P4-pre-strada.md`, **Sonnet 5 · high** (minuteria meccanica ben specificata, D4). Prerequisito riletto il 2026-08-04 (pomeriggio): P.3 è chiusa, e di P.7c restano i soli punti 3-5, che non toccano banchi, stack né i percorsi di questo mandato — la ragione del prerequisito era il banco vetcare e Docker condivisi (D8), e quella parte è finita. **Può essere emesso, anche in parallelo a P.7c-ripresa-2** (perimetri disgiunti dichiarati in entrambi i mandati). **Emesso e consegnato il 2026-08-04** (D1 già chiuso in `7eb736b`; ripresa `prompts/P4-pre-ripresa.md`, Sonnet 5 · high; consegna `744e76d`, verbale `PILOTA-PRE-2026-08-04.md`): D1 riverificato in proprio dall'operaio; D2 **metà verde metà rossa** — per percorso reale i cinque gate escono 2 col messaggio anche da fuori dall'albero, **dalla junction escono 0 muti tutti e cinque** (causa misurata: `resolve(argv[1])` non scioglie la junction, `import.meta.url` è canonico → guardia falsa, `main()` mai eseguito), non corretto come da mandato → **D12 / P.0-igiene-2**; D3 firma vera accettata dai tre gate che la leggono e segnaposto `{{…}}` rifiutato, `dataConfermaDa` → `2026-08-05` (non null); D4 porte **57621/57622** col blocco 57620-57629 verificato libero per intero, tre banchi spenti con backup; AGENTI_DIR di speed-demon dalla junction **non misurabile** (il gate non parte). **Collaudata dal direttore il 2026-08-04 (sera)**, rimisure in proprio: perimetro del commit pulito (verbale + 5 `STATO.md`, zero codice → batterie invariate per costruzione), junction riprodotta nelle due direzioni su schema-forge e speed-demon (0 muto / 2 col messaggio, node di sistema), gate della regia **VERDE 5/5**, porte confermate libere (`Test-NetConnection`). Tre annotazioni di forma sul verbale (§2a, §2d, §4: tabelle riassuntive e frecce al posto di uscite incollate) — sostanza coperta dalle rimisure del direttore, annotate perché la prossima volta si incolli. **Chiusa** |
| P.0-igiene-2 | I gate parlano anche dalla junction | otto epiloghi (i 5 `verify.mjs`, `admin-audit.mjs`, `vetrina-audit.mjs`, `verifica-regia.mjs`) passano alla guardia a **doppio confronto** (`resolve` e `realpathSync`, con ricaduta testuale se il realpath solleva); `hint` di `epiloghi-vivi` aggiornato alla forma nuova; **terzo test di regressione** (funzionale-junction) sui sette script di skill; prove due-canali sui cinque gate; la prova §2d di speed-demon (`rete-verde`) ripetuta dalla junction | P.4-pre collaudata (fatto) | junction e percorso reale escono **2 col messaggio** su tutti e cinque i gate, uscite incollate; gate della regia VERDE 5/5 **prima e dopo**; batterie prima/dopo senza regressioni; **sabotaggio provato** (guardia vecchia reintrodotta → solo il test junction la vede su Node 24); `code-maniac/tree.mjs` non toccato (snapshot esterno, proposta a finzidev) | **mandato scritto 2026-08-04** — `prompts/P0-igiene2-epiloghi-junction.md`, **Opus 5 · max** (D4: si riscrive la forma che una regola della regia prescrive). **Consegnata il 2026-08-04 (notte)**, quattro commit uno per punto (`257e34d` guardia · `e6deb39` hint · `c96ae00` terzo test · `a7652fe` STATO+verbale), verbale `IGIENE2-JUNCTION-2026-08-04.md` con le uscite incollate: otto epiloghi a doppio confronto, `hint` riscritto a logica intatta, terzo test sui sette script, **sabotaggio provato** (52 verdi e un rosso, ed è il terzo test, su Node 24 dove statico e funzionale passano), §2d dalla junction **identica riga per riga** al reale (`AGENTI_DIR` regge: la domanda di P.4-pre ha risposta). Scoperte oltre il mandato: i due gusci di audit erano muti anche loro (admin-audit dichiarava «nessun bloccante» senza leggere un file); Node assolutizza da sé `argv[1]`, il lavoro vero lo fa `realpathSync`. Due scelte fuori lettera dichiarate: terna intera a vetrina-crafter (+6: non aveva nessuno dei tre test), test di `vetrina-audit` in `verify.test.mjs` (lo `npm test` elenca i file per esteso; un file non elencato = MANCANTE travestito da PASS). **Collaudata dal direttore il 2026-08-04 (notte)**, tutto rilanciato in proprio: cinque gate × due canali = **dieci uscite 2 col messaggio, identico fra i canali**; gusci di audit dalla junction parlanti; gate della regia **VERDE 5/5**; batterie **154/183/111/111/87/46, 0 fail**; epilogo letto = forma prescritta; perimetro dei commit conforme. **Chiusa** |
| P.4a | schema-forge sul pilota | `model` → `forge` → `seed` → `test` → `types` → `verify` → `handoff` | P.4-pre | **Specchio del dominio firmato dal committente**; gate 9/9 rilanciato dal direttore; `docs/handoff/07-schema-forge.md` | **mandato scritto 2026-08-04** — `agenti/schema-forge/prompts/P4a-pilota.md` (Opus 5 · high, piano §3); per **D12** parte solo a P.0-igiene-2 collaudata dal direttore — **soddisfatta il 2026-08-04 (notte): via libera**, il mandato si rilancia tal quale in chat vergine; pilota **`fornodoro`**, porte 57621/57622 (D13). Primo lancio (prematuro, prima della correzione) fermatosi **da solo** sul prerequisito rosso: controprova junction 0 muto → stop al passo 0, zero file toccati, nessuna toppa locale — la guardia D12 ha morso al primo uso. **Consegnata il 2026-08-04** (secondo lancio; 4 commit nel pilota, verbale `agenti/schema-forge/PILOTA-2026-08-04.md`, commit di regia `8b5b8aa` nel perimetro): nove tabelle in quattro migrazioni, 55 asserzioni pgTAP, **prima firma vera del repo** sullo Specchio (Alberto Marocco, 2026-08-04) con le cinque risposte strutturali nello schema; gate **VERDE 9/9 dalla junction** riconfermato per percorso assoluto; seed provato rieseguibile a caldo 3× (stati e conteggi identici — la premessa del punto 11); porte spostate a **7621/7622** per esclusione WinNAT (deroga dichiarata → D13 corretta); tribunale `/code-inquisition`: 11 risultati, 0 fabbricazioni, 5 chiusi in una quarta migrazione, 3 a debito, e i quattro strumenti statici del gate muti su tutti e undici. **Collaudata dal direttore il 2026-08-05**: stack riacceso (Docker era spento al mio arrivo), gate **rilanciato in proprio dalla junction: VERDE 9/9, uscita 0, identico al verbale riga per riga**; firma verificata nell'handoff §2; albero del pilota pulito. **Chiusa** |
| P.4b | vetrina-crafter sul pilota | `specchio` → `scaffold` → `pagine` → `audit` → `verify` → `handoff` | P.4a | **`docs/vetrina.md` firmato** (doppio STOP, mai delegabile: pubblicare non si annulla); gate 10/10 su build di produzione; `08-vetrina-crafter.md` che cita un fatto del 07 | **mandato scritto 2026-08-05** — `agenti/vetrina-crafter/prompts/P4b-pilota.md` (Opus 5 · high); doppio STOP di Alberto su `docs/vetrina.md`; app di produzione su **3621** (D13); stack fornodoro acceso su 7621/7622, lo trova pronto. **Consegnata il 2026-08-05** (commit pilota `51c3791 · 31d8e28 · f8c8aa7`, regia `a7cbf48`; verbale `agenti/vetrina-crafter/PILOTA-2026-08-05.md`): sei pagine, sette slot — **i recapiti nati come tre righe di seed** autorizzate dal direttore —, **seconda firma vera** su `docs/vetrina.md` (2026-08-05), toolchain del pilota installata (`code-maniac scan` da 9 salti a 1: resta gitleaks), percorso di scrittura pubblico **provato vivo** (ordine anonimo creato e riletto, esaurita rifiutata con messaggio di regola, `GET /rest/v1/ordini` → 401). Tribunale: 6 rilievi, 0 fabbricazioni, due lezioni a registro — **il rimedio più ovvio era un placebo** (`allowedOrigins` ritirato dopo la ricostruzione della red team) e **una causa su sei era sbagliata** (SA-4, scoperta solo rimisurando dopo la correzione). Aperto verso schema-forge: `crea_ordine(ritiro_at timestamptz)` **casta prima di validare** → **debito n°11 del pilota**, vuole un `evolve`. Debito 6 → 14 voci. Deviazione di forma (chat sulla regia) dichiarata e governata. **Collaudata dal direttore il 2026-08-05**: primo rilancio ROSSO 1 fallito / 4 mancanti — **l'app su 3621 era morta con la shell dell'operaio** (fatto d'ambiente: il gate della vetrina misura un'app viva); riaccesa con Node 24, gate **rilanciato VERDE 10/10** (`BUILD_ID r5b7BNi6MSSP-HOd_7EFg`, nessun indizio di dev server), **schema-forge riconfermato 9/9**, firma e handoff 08 verificati (0 segnaposto), perimetro dei commit conforme. **Chiusa** |
| P.4c | gestionale-crafter sul pilota | `specchio` → `scaffold` → `viste` → `contenuti` → `audit` → `verify` → `handoff` | P.4b | **Specchio del gestionale firmato**; gate 7/7; `10-gestionale-crafter.md`. Il difetto noto (il gate conta le guardie, non sa se chiedono il ruolo giusto) **dichiarato in `docs/DEBITO-TECNICO.md`**, non aggirato | **mandato scritto 2026-08-05** — `agenti/gestionale-crafter/prompts/P4c-pilota.md` (Opus 5 · high); terza firma di Alberto sullo Specchio del gestionale (la parte «chi può promuovere chi» non è delegabile); a fine corsa i tre gate riverdi (7/7, 10/10 sull'app ricostruita, 9/9). **Consegnata il 2026-08-05** (6 commit nel pilota `4f954b2`…`2cd20bf`, regia `6d6da42`; verbale `agenti/gestionale-crafter/PILOTA-2026-08-05.md`): sette viste sopra le policy del 07 più la porta d'ingresso che non esisteva, **tutto senza JavaScript** — ed è anche il motivo per cui `curl` ha potuto attaccare le sue stesse azioni; **terza firma vera** di Alberto (2026-08-05); l'handoff 10 cita dall'08 il rifiuto `P0001` della Capricciosa e la chiave `fornodoro:carrello`. Il **limite noto del gate** (conta le guardie, non sa se chiedono il ruolo giusto) non aggirato ma **misurato a mano**: 11 richieste con due sessioni vere, la cucina prende `307 → /admin?motivo=vietato` su 5 rotte su 5 e vede 2 voci di barra invece di 7. Tribunale: 5 rilievi, e **una riga firmata smentita** (§12 → **D15**). Il più grave era nel codice dell'operaio e l'ha chiuso: `sincronizzaAllergeni` cancellava tutti i legami fuori transazione — una voce restava a zero allergeni e il menu pubblico leggeva «Nessun allergene fra i quattordici dichiarati»; riscritta per differenza, **aggiunge prima di togliere**, così si rompe per eccesso. Debito 14 → **25 voci**. Deviazione di forma (chat sulla regia) dichiarata. **Collaudata dal direttore il 2026-08-05**: tre gate rilanciati in proprio sulla stessa build `kFhToFT1wQ2jmUZpjX9Fa` — **gestionale VERDE 7/7** (0 issue, 0 warn nell'audit; 11 rotte, 7 azioni, 10 scritture), **vetrina VERDE 10/10**, **schema-forge VERDE 9/9**; firma e handoff 10 verificati (0 segnaposto), due repo puliti. **Chiusa** |
| P.4d | flow-sentinel sul pilota | `map` → `forge` → `run` → `verify` → `handoff` | P.4c | **`docs/flussi-critici.md` firmato dal committente** — è l'unico contratto in cui **l'omissione è invisibile al gate**; gate 7/7 su app vera e database seminato; `12-flow-sentinel.md` | **mandato scritto 2026-08-05** — `agenti/flow-sentinel/prompts/P4d-pilota.md` (Opus 5 · high); **firma per delega** (D14), autonomia piena, app viva su 3621 (`kFhToFT1wQ2jmUZpjX9Fa`), i tre rifiuti che il database garantisce da attaccare davvero. **Consegnata il 2026-08-05** (3 commit nel pilota `86df34c · 6d0adba · df3f520`, regia `9c97a4f`; verbale `agenti/flow-sentinel/PILOTA-2026-08-05.md`): **13 flussi** (5 positivi · 3 ostili in lettura · 5 in scrittura) e 22 test contro l'app viva, mappa **camminata** sulle 20 rotte e 7 azioni e solo dopo confrontata coi tre handoff (+4 flussi, −0); **prima firma per delega** (D14) scritta in tre posti col suo costo; collaudo per **sabotaggio su cinque classi** — la classe B ha ceduto **sempre sull'asserzione del database**; il fatto citato dal 10 ha cambiato la forma di due spec (dal browser il trigger delle transizioni è **irraggiungibile per costruzione**: lo precedono la tabella delle transizioni e il lock ottimistico — e nessuna delle due spec dice di aver visto il trigger). Tribunale sulla batteria: **21 rilievi, 9 chiusi, 1 refutato con una build** (BLIND-1: in App Router l'azione gira prima del re-render, quindi la sua uscita vince — la spec sorveglia davvero la guardia dell'azione). Debito 25 → **30 voci**. **Collaudata dal direttore il 2026-08-05**: Docker e app erano spenti al mio arrivo — riaccesi, stack ripreso, app ricostruita viva; **flussi VERDE 7/7** (13 spec, **22 passati / 0 falliti**, app 3621 + db 7622, 9 tabelle e 74 righe di seed), **gestionale 7/7 · vetrina 10/10 · schema-forge 9/9** sulla build `IZYYrgi0xJcQUjhk_uM3B`; firma delegata e handoff 12 verificati (0 segnaposto). Un rilievo mio: **senza `--url` il gate cerca la 3000** e chiude ROSSO — vedi **D16**. **Chiusa** |
| P.4e | speed-demon sul pilota | `measure` → `plan` → `tune` → `verify` → `handoff` | P.4d | **`docs/performance.md` firmato**; gate 7/7 con `--giri ≥ 3` su build di produzione riconosciuta dal `BUILD_ID`; **tutti e cinque i gate riverdi** dopo le ottimizzazioni; `13-speed-demon.md` | **mandato scritto 2026-08-05** — `agenti/speed-demon/prompts/P4e-pilota.md` (Opus 5 · high); firma per delega (D14), **D16 da chiudere in apertura**, la batteria di flow-sentinel da rilanciare **a ogni giro** (`--url` esplicito), l'ultimo anello del filo. **Consegnata il 2026-08-06** (5 commit nel pilota `92e7723`…`778333d`, regia `f4ace33`; verbale `agenti/speed-demon/PILOTA-2026-08-06.md`): **D16 chiusa con la misura** (n°26 riguardava **una** skill, non tre — la voce sembrava plausibile e nessuno l'aveva verificata); favicon `404` su ogni pagina, canonical, sitemap, robots e `noindex` sull'ordine di una persona; **nessuna ottimizzazione di velocità applicata, e i numeri lo giustificano** — il rumore misurato (1 punto) coincideva col margine disponibile (1 punto): la terza legge della skill è servita **a non inventare un guadagno**, non a non crederci. Gate **VERDE 7/7**, 3 giri, `seo 100` su 5 pagine. Tribunale: 3 difetti su 3 nel suo codice. Deroga dichiarata in 4 posti: **Lighthouse vuole Node 22+** (l'audit `canonical` chiama `URL.parse`) → debito n°31; e il debito **n°32**, alto: *il sito non si costruisce col node di sistema* — `@supabase/realtime-js` vuole `>=22`, mentre «Next 16 pretende `^20.19 || >=22`» scritto in due handoff era **falso**. Debito 30 → **32**. **Collaudata dal direttore il 2026-08-06**: al primo lancio speed-demon **ROSSO 5 bloccanti** col node di sistema — causa riprodotta da me (`URL.parse` assente su 20.12.2, categoria SEO senza punteggio, e il gate **blocca invece di fingere**), col Node 24 **VERDE 7/7**: conferma indipendente della diagnosi dell'operaio; **flussi 7/7 (22 test) · gestionale 7/7 · vetrina 10/10 · schema-forge 9/9** sulla build `p1ETtUu2HEAB4sH7mKrJW`. **Chiusa** |
| P.4f | `evolve` di schema-forge sul pilota | in un solo pacchetto: **n°22** (`revoke update (ruolo)` + `cambia_ruolo()`, D15) e **n°11** (`crea_ordine` valida `ritiro_at` **prima** del cast). Expand-contract, analisi di impatto sui dati veri, STOP su ogni distruttivo | **P.4e chiusa** (fatto 2026-08-06) | i cinque gate **riverdi dopo l'evolve** — è la prova che la catena regge una modifica dello schema, cioè il caso reale di un cliente che cambia idea; `docs/handoff/07-schema-forge.md` aggiornato; le due voci di debito chiuse con la misura; **ogni asserzione nuova sabotata** (togli la difesa → il test diventa rosso) | **mandato scritto 2026-08-06** — `agenti/schema-forge/prompts/P4f-evolve-pilota.md` (Opus 5 · high); è anche il **collaudo di `evolve`**, l'unico comando della skill che il pilota non ha attraversato. **Consegnata il 2026-08-06** (commit pilota `bdb8a5f · d604718`, regia `df1b612`; verbale `agenti/schema-forge/PILOTA-EVOLVE-2026-08-06.md`): tre migrazioni nuove, **le prime quattro intoccate**; **n°11 chiuso** (`22007 · 22008 · 22023` nativi → `P0001` con messaggi nostri su tutte le forme) e **n°22 chiuso su entrambe le metà** (`PATCH {"ruolo":"titolare"}` 200 → **403 42501**; `POST` di un titolare nuovo `INSERT 0 1` → **403 42501**), con la controprova che il legittimo passa ancora (`PATCH` del telefono 204) e la funzione `cambia_ruolo` → 204; pgTAP **55 → 82**, **tredici sabotaggi tutti rossi**. **Ma la scoperta non è quella che il mandato prevedeva**: il mandato chiedeva che l'invariante **IAM-1** «sopravvivesse», e IAM-1 **non esisteva** — era un ragionamento seriale dichiarato come invariante dal 2026-08-04, e due titolari concorrenti lo portano a **zero** senza un errore (write skew in READ COMMITTED, riprodotto anche via `is_attivo` e via `delete`, e da quello stato non si rientra nemmeno con la chiave di servizio). Misura che lo dimostra: **col solo conteggio 3 coppie su 4 rompono l'invariante; con `pg_advisory_xact_lock` tutte e 4 lo rispettano** — un `if (count = 0) raise` scritto in buona fede avrebbe lasciato il difetto intatto e il gate verde. L'operaio ha anche **riprodotto il n°11 dentro la migrazione che lo chiudeva** (`cambia_ruolo(persona uuid, …)`) e se l'è trovato da solo applicando alla propria superficie il sospetto del tribunale; il tribunale, dal canto suo, ha trovato una **quarta classe nativa** su `ritiro_at` (`22009`) che l'enumerazione di tre nomi lasciava passare → ora si intercetta la classe `22` intera. Due correzioni fuori perimetro dichiarate: quattro file a **CRLF** (n°30 avverato di nuovo) e `src/lib/seo.ts` che falliva `prettier --check` mentre l'handoff 13 §8 dichiarava lo scan pulito. Debito **34 → 38 voci dichiarate dall'operaio** (tre chiuse, sei aperte; il direttore non ha ricontato): quattro delle sei esistono perché un tribunale ha guardato dove nessuno guardava. **Residuo grosso: n°36** — la prova dell'invariante (`scripts/prova-concorrenza.mjs`) **non gira in nessun gate**, perché pgTAP vive in una sessione sola e un invariante su un *insieme* di righe lì è indimostrabile: è la lacuna più grande che questo pacchetto abbia trovato nella skill, ed è in `agenti/schema-forge/STATO.md`. **Collaudata dal direttore il 2026-08-06**, cinque gate rilanciati in proprio sulla build `mRBe6eqMjjl0W5m2tfJ24`: **schema-forge 9/9** (7 migrazioni applicate su database pulito), **gestionale 7/7**, **vetrina 10/10**, **flussi 7/7 (22 passati / 0 falliti)**, **speed-demon 7/7** (3 giri, `seo 100` su 5 pagine). La catena regge una modifica dello schema a valle costruita. Un rilievo mio, nato da un rosso: **«lanciare il gate col Node 24» e «avere il Node 24 nel `PATH`» non sono la stessa cosa** — vedi giornale. **Chiusa** |
| P.4g | Il pilota diventa pubblicabile | i **due bloccanti del deploy**: **n°27** (il seed crea due account con `password123` in chiaro in un file committato → separare il seed di sviluppo da quello di produzione **senza** perdere le sessioni della batteria E2E, che li usa per dichiarazione in `docs/flussi-critici.md` §Assunzioni) e **n°32** (il sito **non si costruisce** su Node < 22: `@supabase/realtime-js` risolve il WebSocket in modo eager e solleva **durante `next build`** sulle tre pagine statiche; `engines` non lo dichiara) — più le minuterie della catena (`tsconfig.tsbuildinfo` tracciato, n°30 fine-riga avverato due volte, e il resto del registro riletto) | P.4f consegnata | i cinque gate **riverdi**, **22 test E2E ancora verdi** (è la prova che il seed di sviluppo funziona ancora), `grep` incollato che nessuna password resta nel percorso di produzione, e le **due direzioni del Node** incollate (node di sistema → fallisce col *nostro* messaggio; Node 24 → passa). Ogni voce di debito toccata **chiusa con la misura** (prima → dopo) o attribuita a chi è: una voce chiusa a parole vale meno di una voce aperta | **mandato scritto 2026-08-06** — `prompts/P4g-pilota-prerequisiti.md` (Opus 5 · high). **Proprietario in scrittura del pilota** mentre girano P.5 e P.6 (D17). Sblocca il deploy e, insieme, dà a launchpad la sua prova migliore: il gate di P.5 deve passare da rosso a verde **per questa correzione**, non per una modifica sua. **Consegnata il 2026-08-06** (2h08): n°27 chiuso separando invece di cancellare (`10-riferimento` / `20-locale` / `90-solo-sviluppo`, elencati per nome in `config.toml`), `db reset` riproduce lo stato identico (2/2/11/5/8/7/14/17/3/7) tre volte a caldo, E2E 22/22, il percorso di produzione non legge nessun file con una password (grep) e l'account che crea entra davvero (HTTP 200, `last_sign_in_at` avanzato); n°32 dichiarato, fatto rispettare e provato **nelle due direzioni** — ma **la premessa del debito era falsa e l'operaio l'ha misurata falsa**: nessuno aveva mai lanciato `next build` col Node 20, esce 0 e produce pagine coi dati veri (`next/dist/server/node-environment.js` installa un WebSocket globale); la difesa resta con la ragione vera (il fornitore dichiara Node 20 non supportato), riscritta nei quattro posti che ripetevano la frase sbagliata. Il tribunale ha trovato **il difetto peggiore del pacchetto**: `crea-titolare.mjs` consegnava il gestionale a chi si registrava per primo (con `enable_signup = true` chiunque fa signup su `rosa@fornodoro.it` — l'indirizzo dell'esempio — e lo script gli dava `ruolo = titolare` dicendo «fatto.»); riprodotto end-to-end, corretto, attacco rifatto contro la correzione → exit 1, zero righe di personale. Registro 41 voci (3 chiuse) → **47 (9 chiuse)**, quattro nuove aperte dal tribunale su cose che P.4g aveva appena scritto. Docker Desktop caduto durante un `db reset` (3,5 GB liberi su 16, tre chat vive), recuperato con `wsl --shutdown`, volumi intatti — la regola «un solo stack» che si avvera. **Collaudata dal direttore il 2026-08-06 (sera)**, tutto rilanciato in proprio sulla build `vhj8fi1hxQrFTJFWHKPlb`: **9/9 · 7/7 · 10/10 · 7/7 (13 spec, 22 test) · 7/7 (`seo 100±0` su cinque pagine)**, perimetro pulito. **Uno scarto trovato dal direttore, e non è un difetto di P.4g soltanto**: n°27 è dichiarato chiuso e n°44 — nella stessa tabella dello stesso handoff — dice che su una produzione appena creata i due account con `password123` entrano. **n°27 è ristretto, non chiuso** → decisione **D18 §1**, e il seguito è P.4h. Secondo scarto: `docs/handoff/14` non ha nessuna riga `Gate:` leggibile (trovato dal gate di launchpad, confermato col grep dal direttore). **Chiusa** |
| P.5 | launchpad — P0→P2 | deploy 1-click con verifica d'identità dell'app (`BUILD_ID` nell'HTML servito), "non si pubblica su gate rosso", deploy sempre a checkpoint umano. **Vincolo dal pilota**: il **debito n°27** (il seed porta due account con password nota) **blocca il deploy** — separare il seed di sviluppo da quello di produzione è un prerequisito di questo pacchetto, non un residuo | P.4 (consigliato: serve un sito vero da pubblicare) | come P.1–P.3; collaudo finale = deploy del pilota, autorizzato dal committente. **Criterio falsificabile di P0+P1**: il gate di launchpad, lanciato sul pilota, deve uscire **ROSSO e rifiutare la pubblicazione** per i bloccanti dichiarati (n°27, n°32, e le prescrizioni di runbook n°4/n°17) — trovati da lui, non copiati dal mandato; e deve passare a verde **per la correzione di P.4g**, non per una modifica sua | **mandato scritto 2026-08-06** — `agenti/launchpad/prompts/P5-progetta-costruisci.md` (Opus 5 · high). **P0+P1 uniti** (D17), P2 resta in chat vergine. **Questo pacchetto non pubblica niente**: nessun account, nessun dominio, nessun DNS, nessun deploy nemmeno di prova — l'irreversibile resta al checkpoint umano (`DECISIONI.md` §6) e il primo deploy vero è il collaudo di P.5, autorizzato da Alberto. Prerequisiti n°27 e n°32 in lavorazione **in parallelo** in P.4g: il mandato prescrive di **non aspettarla** e di chiudere col rosso motivato. **P0+P1 consegnati il 2026-08-06** (28 min): SKILL.md, gate a nove passi con `--json`, tre librerie pure e tre gusci, quattro reference, due template, verbale. La skill non è un deployer con un cancello davanti: **è il cancello** — quattro leggi (non si pubblica su gate rosso di *nessuno* a monte; la conferma umana è sul contenuto e non sul comando; nel pacchetto non viaggia nessun segreto, né in HEAD né nella storia; ciò che va online resta dimostrabile dopo). Batteria **105/105**, sabotaggio **36 classi 36 rosse**, tribunale **32 rilievi 32 chiusi** (batteria 87 → 105). La **tabella «misura o legge»** è il deliverable concettuale: cinque passi misurano, tre misurano solo la *forma* di una dichiarazione, uno legge e data — e il pilota ne ha dato la prova nello stesso pomeriggio, chiuso il n°32 il passo del runtime è passato da 1 bloccante a 0 **senza che una riga della skill cambiasse**. La sosta di metà pacchetto ha intercettato un difetto che sarebbe stato spedito (`generateBuildId` con lo SHA scritto come letterale: al commit dopo la build dichiara con sicurezza il commit **sbagliato** — peggio dell'impronta casuale, che almeno ammette di non sapere). Il rilievo più grave del tribunale era **sul rimedio, non sul gate**: il frammento che la skill prescrive rompeva la build del cliente su `next.config.mjs` (`require` in un ESM), verificato con una build Next.js vera; e due periti su tre, con riproduzioni disgiunte, hanno confermato che un file UTF-16 trattato come binario faceva uscire il gate **verde su una chiave `service_role` committata**. Lezione registrata: *una correzione di sicurezza produce falsi positivi finché non la si rilancia su un progetto vero* — chiuso un rilievo, il gate ha accusato `docs/PRODUZIONE.md` del pilota, cioè la documentazione che insegna a non committare la chiave, di committarla. **Collaudato dal direttore il 2026-08-06 (sera)**: gate rilanciato in proprio sul pilota → **ROSSO (4 falliti, 3 mancanti su 9)**, criterio di accettazione soddisfatto, e due dei rifiuti **cross-verificati veri** (l'handoff `14` senza riga `Gate:`; la credenziale del seed che il registro dice chiusa e n°44 dice viva); batteria 105/105 rilanciata; **nessun deploy eseguito, nessun account, nessun dominio, nessun DNS**. P0+P1 **chiusi** → resta **P.5-P2** |
| P.6 | site-doctor — P0→P2 | certificato di idoneità pre-produzione (GDPR/cookie, a11y, OG, favicon, robots, sitemap — raccoglie anche i buchi noti: favicon 404, sitemap/robots mai verificati da speed-demon) | P.4 | come P.1–P.3. **Criterio falsificabile di P0+P1**: il gate di site-doctor, lanciato sul pilota, deve uscire **ROSSO per motivi veri e misurati**, e ognuno deve essere una cosa che **nessuno dei cinque gate esistenti vede** (candidati: informativa privacy assente, cookie posti e non dichiarati, a11y del sito pubblico che nessuno lintava) | **mandato scritto 2026-08-06** — `agenti/site-doctor/prompts/P6-progetta-costruisci.md` (Opus 5 · high). **P0+P1 uniti** (D17), P2 in chat vergine; banco = il pilota, **in sola lettura**. Primo deliverable: il **perimetro contro i vicini**, con la regola «dove un vicino misura, tu verifichi dichiarato; dove nessuno guarda, è tuo» — nasce dal difetto §4 del verbale di catena (l'Open Graph assegnato **due volte** nello stesso handoff, a speed-demon *e* a un site-doctor che non esisteva: la favicon è stata un `404` su ogni pagina per tre anelli). Al 2026-08-06 speed-demon ha già misurato canonical, sitemap, robots, `noindex` e favicon: **non si rimisurano**. **P0+P1 consegnati il 2026-08-06** (7 min di resoconto, il lavoro molto più lungo): SKILL.md, gate a nove passi e **quattro stati** (`pass`/`fail`/`skipped`/`n/a`, con la regola che `n/a` costa una premessa misurata), due librerie pure, due gusci, cinque reference. Banco conforme **VERDE 8/8 + 1 NON APPLICABILE**, **25 classi di sabotaggio tutte rosse**, batteria **144/144**, gate della regia verde prima e dopo. Lo **STOP di metà pacchetto** ha cambiato otto punti della progettazione prima che diventassero codice — il migliore: la premessa di `NON APPLICABILE` sugli hreflang era **circolare**, e un sito multilingua senza hreflang sarebbe uscito «non applicabile». Poi il sabotaggio ne ha trovati tre che l'autorevisione non aveva visto, e il tribunale **trentatré**, con ESLint, knip, jscpd, gitleaks e semgrep **tutti verdi**. Il più grave apriva tutti e nove i passi insieme: in HTML un `<!--` dentro il valore di un attributo è **testo**, non l'apertura di un commento, quindi due `<div>` invisibili facevano sparire dal documento che il gate giudica immagini senz'`alt`, campi che raccolgono dati personali e terzi non dichiarati — chiuso con un ripulitore a scansione singola, che ha chiuso anche un costo quadratico (24,6 s → **16 ms** su 200 KB). Il rapporto **8 → 3 → 33** è la misura di quanto vale un'autorevisione al posto della revisione del direttore: è il costo dichiarato di D17, ed è documentato. **Collaudato dal direttore il 2026-08-06 (sera)**: gate rilanciato in proprio sul pilota vivo (build `vhj8fi1hxQrFTJFWHKPlb` **riletta nell'HTML servito**, non citata a memoria) → **ROSSO (4 falliti, 3 mancanti, 0 non applicabili su 9)** per cinque motivi che nessuno dei cinque gate esistenti vede — nessun collegamento a un'informativa su 5 pagine su 5; `/ordina` raccoglie nome e telefono senza base giuridica dichiarata e senza rimandare all'informativa **al punto di raccolta** (art. 13); `localStorage` posto dal codice servito e dichiarato da nessuna parte; nessun certificato di idoneità, quindi launchpad non ha un ingresso. Batteria 144/144 rilanciata. **Pilota mai toccato in scrittura.** Due residui che il collaudo avversario eredita: `certifica` e `handoff` non sono mai stati eseguiti **come comandi** su un progetto vero, e nessuna informativa è mai stata generata. P0+P1 **chiusi** → resta **P.6-P2**, e questa skill ne ha più bisogno delle altre |
| P.7a | Gate della regia | lo dichiara mancante `DECISIONI.md` §26: controllo docx/txt allineati, più le coerenze della regia (junction, elenchi README vs skill reali) | — | script deterministico, verde riproducibile da un clone pulito; regole in lib pura con test; guardiani locali per `scripts/` di radice | **consegnata e collaudata 2026-08-04** (commit `d57e779`, Opus 5 · high) — `scripts/verifica-regia.mjs` + `regia-lib` con 5 passi (`docx-txt`, `skill-elencate`, `stato-presente`, `epiloghi-vivi`, `segnaposto-radice`), guardiani propri, DECISIONI §26 aggiornata. Verifica del direttore: gate **VERDE 5/5 rilanciato** (col node di sistema), batteria **46/46 rilanciata**. Il passo `skill-elencate` ha già fatto da testimone al README aggiornato da P.2. **Chiusa** |
| P.7b | Documento madre aggiornato | `Web Gun.docx` fermo (schema-forge dichiarato a versione vecchia) + `scripts/estrai-docx.ps1` rilanciato | — (il .docx lo edita Alberto in Word, con STOP a metà mandato) | `webgun_content.txt` rigenerato e coerente col repo | **parziale** — la fotografia è fatta (txt allineato al docx attuale, confermato dal passo `docx-txt` del gate della regia; il `M` in working tree era solo fine-riga, ripristinato). **Resta l'edit in Word di Alberto**: lista puntuale consegnata dal direttore il 2026-08-04 (schema-forge v1.3→v1.5, vetrina-crafter assente al posto 8, numeri test vecchi, il `BUTCHER`); al suo «fatto» il direttore rigenera il txt e committa (atto di registro) |
| P.7c | Guardiani arretrati + igiene del banco | `semgrep` (presente, mai puntato) sugli script di flow-sentinel e speed-demon; `/code-inquisition` sugli script delle 4 skill; valutare installazione `gitleaks`; **da P.0-igiene**: `npm install` nelle cartelle di gestionale-crafter e flow-sentinel (ESLint locale mai eseguibile senza) e il warning `complexity 19` preesistente su `speed-demon/scripts/verify.mjs:263`; **da D9**: riallineare `rls_policy.test.sql` asserzione 11 a `throws_ok(…, '42501', …)` e riverificare pgTAP a 2/23 sul banco | **dopo la ripresa di P.2** (D8: banco vetcare e Docker condivisi) | esiti registrati negli `STATO.md`: ogni MANCANTE diventa un esito reale; gate del banco rilanciato dopo il riallineo | **parziale, interrotta senza commit** — mandato emesso 2026-08-04 (`prompts/P7c-guardiani-arretrati.md`, Opus 5 · high). Eseguiti i punti 1 (a metà) e 2: `npm install` in gestionale-crafter, flow-sentinel e speed-demon; il globale `URL` mancante nella config ESLint di gestionale (rilievo vivo dal 2026-08-03 e invisibile: ESLint non girava affatto); il `complexity 19` di `speed-demon/scripts/verify.mjs` sciolto in funzioni pure, batteria 75 → **86**. Tutto era in working tree: **verificato e committato dal direttore** (batteria 86/86 rilanciata; ESLint pulito su speed-demon, gestionale e flow-sentinel; knip pulito su speed-demon). **Mancavano**: i numeri negli `STATO.md` (punti 1 e 7), semgrep (3), `/code-inquisition` (4), gitleaks (5) e **D9** (6) → ripresa emessa 2026-08-04 (`prompts/P7c-ripresa.md`, Opus 5 · high), **tornata di nuovo senza un commit**: un'ora di lavoro, in working tree il solo riallineo D9 — fatto bene, con la motivazione in commento. **Salvataggio e chiusura parziale del direttore 2026-08-04**: D9 chiuso (asserzione 11 → `throws_ok('…', '42501', null, …)`; gate vetcare rilanciato due volte col node di sistema: **ROSSO, 2 falliti, 0 mancanti su 9**, pgTAP **2/23** sulle storiche 22-23, `rls_policy` **11/11** — combacia col verdetto atteso falsificabile del mandato; al primo lancio un terzo FAIL sul passo `tipi` col dettaglio vuoto: memoria di paging esaurita sotto il carico di due gate e due batterie, non lo schema — tipi rigenerati a mano **identici** ai committati, secondo lancio OK); knip di gestionale-crafter e flow-sentinel eseguiti: **0 rilievi entrambi**; numeri dei punti 1-2 registrati negli `STATO.md` delle quattro skill; handoff del banco aggiornato (11 asserzioni, prosa dei motivi chiusa su D9). **Restano i punti 3-5** — semgrep (installato, 1.171.0, mai puntato), `/code-inquisition`, gitleaks (assente) — con le righe di `STATO.md` che ne nasceranno e il verbale → **ripresa-2 pronta** (`prompts/P7c-ripresa2.md`, Opus 5 · high; perimetro disgiunto da P.4-pre, possono girare accanto). **Ripresa-2 consegnata il 2026-08-06** (1h41, quattro commit, **nessun punto senza commit**). *Punto 3 — semgrep*: `--config auto` (1.172.0, non 1.171.0 come diceva il registro) sui tre gate mai puntati: schema-forge 12, flow-sentinel 4, speed-demon 3, più gestionale-crafter rimisurato (dichiarava 6 dal 2026-07-28: ne trova esattamente 6, gli stessi). **18 falsi positivi ognuno con la prova a fianco** (`spawnSync` senza `shell: true` con nomi letterali; regexp che interpolano chiavi letterali, o nomi filtrati da una lista ancorata, o nomi estratti da `([a-z_][a-z0-9_]*)`), **zero `nosemgrep`**. Il diciannovesimo era vero, ed era l'unico punto dove un nome arriva dal catalogo **senza filtro**: `regolaColonneDiPolicy` interpolava il nome della colonna grezzo in `new RegExp` → (A) `SyntaxError: Invalid regular expression: /\bpiano(a\b/` uccide l'audit RLS con uno stack trace, (B) *findings su una colonna che la policy non nomina* — verdetto sbagliato **in silenzio**. Corretto con `perRegex`, due test falsificati contro il codice di ieri, batteria 154 → **156**. Residuo dichiarato: su `speed-demon/gate-lib.mjs` semgrep si ferma al **99,7%** delle righe e la posizione che dichiara non è dove sta il problema — quello 0,3% vale **MANCANTE**, perché è un limite dello strumento, non una proprietà del codice. *Punto 5 — gitleaks* 8.30.1 installato: `scripts/` nessun rilievo; storia (143 commit) 4, disco (179,72 MB) 26, **nessuno vero** — i tre su file tracciati sono fixture di rilevatori di segreti (bugbay e launchpad). Due misure per chi lo userà: `gitleaks git` trova il segreto **dove è stato introdotto**, non dove il file sta oggi; e il passo gitleaks di `code-maniac scan` da oggi esce `issue` per quelle tre fixture. *Punto 4 — il tribunale*: due concili paralleli, **sette esperti**, due verificatori (chi scrive un rilievo non lo certifica), `--allow-exec`. Il critico del roster ha trovato un buco **prima** di spawnare — nessuno copriva la terminazione — e l'esperto nato da lì ha prodotto tre HIGH. **46 difetti** (CRITICAL 2 · HIGH 12 · MEDIUM 17 · LOW 15), referto `INQUISIZIONE-GATE-2026-08-06.md`. La riga che regge il punto: **stesso giorno, stessi file, rilanciati dai verificatori — ESLint 0, semgrep 0 sui tredici file dove i difetti vivono, gitleaks 0, batterie 465/465**. Il rito si vede da cosa ha buttato: **0 fabbricazioni su 47**, 4 citazioni sbagliate registrate, 1 contraddetto attivamente, 4 declassati, 2 promossi, e **una sola conferma incrociata** (lo slittamento dei campi di `psql`, trovato da due concili che non si vedevano) — gli altri 45 valgono per la loro prova, non per un consenso. Sorte: **una chiusa** (i quattro numeri di batteria mai rimisurati: 156 · 111 · 111 · 87 — il repo si contraddiceva da solo), **quarantacinque dichiarate** negli `STATO.md` con prova e proposta d'ordine, perché ognuna è una modifica al comportamento di un gate e vuole un test che la falsifichi. **Collaudata dal direttore il 2026-08-06 (sera)**: gate della regia **VERDE 5/5**; quattro batterie rilanciate in proprio **156 · 111 · 111 · 87**, zero falliti; C1 e C2 **riletti nel codice e confermati** (`dove()` chiama `spawnSync("where", …)` senza `cwd`, quindi eredita la radice del progetto auditato; `batteriaHaEseguito = passati > 0 || falliti.length > 0`, un OR globale); perimetro dei quattro commit pulito. **Chiusa** — i 45 dichiarati diventano **P.7d** (i quattordici) e un P.7e |

### Seconda ondata — emessa il 2026-08-06 (sera), quattro chat in parallelo

| # | Cosa | Perimetro in **scrittura** | Criterio falsificabile | Stato |
|---|---|---|---|---|
| P.4h | **Il pilota: la credenziale sopravvissuta al numero, e i certificati scaduti** — n°27 riportato al vero (D18 §1); caccia misurata a un discriminante fail-closed e poi **strada (a)** su n°44 (il seed di sviluppo esce da `sql_paths`); i cinque handoff ridatati contro rilanci veri; la riga `Gate:` mancante nell'handoff `14`; `docs/deploy.md` scritto e **deliberatamente non firmato**; n°46/n°47 | `fornodoro/**` (unico proprietario) + il solo verbale `agenti/schema-forge/PILOTA-SEED-2026-08-06.md` | E2E **22/22** dopo la separazione — è il vincolo che batte tutti gli altri; la credenziale non più raggiungibile da nessun comando documentato contro un database remoto, **detto come misura**; cinque gate rilanciati col commit della regia citato accanto; il gate di launchpad **ancora rosso**, e per ogni rifiuto sopravvissuto è scritto **di chi è** | mandato `prompts/P4h-pilota-seed-e-certificati.md` (Opus 5 · high) — **consegnata e collaudata 2026-08-06 (notte)**. Rilanciato in proprio dalla direzione a regia `d147f52`: dopo il gate di schema-forge il database resta a **`auth.users=0`, `ordini=0`**; il seed di sviluppo lanciato a mano con `psql -f` è **rifiutato `P0001` senza scrivere niente**; `npm run seed-sviluppo` restituisce **2 · 2 · 5 · 8 · 11**, i numeri esatti dell'handoff `15`. E2E **22/22**, e il passo stampa **13 flussi critici su 13 percorsi davvero dal browser**. Il discriminante fail-closed che n°44 dichiarava inesistente **esiste**: non «sei in produzione» ma «sei il banco di prova della CLI» — dieci candidati provati, elencati. Due residui misurati dalla direzione: i cinque certificati sono **scaduti di nuovo** (ridatati e *poi* un commit di codice: `0a48fba`), e n°50 tiene rosso il gate del gestionale |
| P.5-P2 | **Collaudo avversario di launchpad**, chat vergine | `agenti/launchpad/**` + `banco-prova-collaudo-lp/**` | banco in un dominio diverso costruito **dai soli documenti**, gate VERDE 9/9 su di esso; ognuno dei nove passi attaccato con **almeno un falso verde tentato ed eseguito**; ogni rimedio prescritto eseguito contro una build vera in due forme di config; e l'attacco che vale da solo il pacchetto: **clone shallow senza `.git`**, cioè la condizione in cui il fornitore costruisce, contro `generateBuildId` — se l'impronta non sopravvive lì, la catena d'identità è una finzione proprio sulla macchina per cui è stata progettata | mandato `agenti/launchpad/prompts/P5-P2-collaudo.md` (Opus 5 · high). **Non pubblica niente**, come P.5 — **consegnata e collaudata 2026-08-06 (notte)**. 26 difetti chiusi, 9 falsi verdi con gravità di blocco; batteria **148/148 rilanciata dalla direzione**. I due che valgono il pacchetto stanno nel **rimedio che la skill scrive nel `next.config.ts` del cliente**, non nel gate: non compilava sotto `strict`, e su un clone `--depth 1` senza `.git` prendeva **l'identità del repository che lo conteneva** (`BUILD_ID 9c2914484e28` mentre il commit vero era `2d1355e3d697`). Nessuna pubblicazione, nessun account, nessuna spesa: i due «remoti» erano cartelle `.git` nude sul disco. Tre decisioni escalate → **D20**, **D23**. Audit delle affermazioni: quattro numeri del costruttore non riprodotti — di cui **uno smentito dalla direzione**, «105 test erano 104»: al commit di consegna vero (`9d8fb73`, misurato in un worktree separato) la batteria dà **105/105** |
| P.6-P2 | **Collaudo avversario di site-doctor**, chat vergine | `agenti/site-doctor/**` + `banco-prova-collaudo-sd/**` | banco **multilingua, con un terzo vero e un cookie vero** — le tre cose che il pilota non ha; `certifica` e `handoff` eseguiti **come comandi** su un progetto vero per la prima volta, e l'informativa in bozza generata e **giudicata per iscritto**; i nove passi attaccati nei **due** versi (falso `pass` e falso `n/a`); le **sedici voci di conformità** verificate contro il gate del vicino a cui sono delegate — una voce delegata a chi non la misura è il buco della favicon un piano più su; l'attacco al parsing HTML con almeno sei forme ostili oltre quella che il tribunale ha trovato | mandato `agenti/site-doctor/prompts/P6-P2-collaudo.md` (Opus 5 · high). Pilota in **sola lettura** — **consegnata e collaudata 2026-08-06 (notte)**. 14 difetti chiusi con un test ciascuno, batteria **144 → 168 rilanciata dalla direzione**; banco studio legale bilingue VERDE 9/9 con `lingua-e-hreflang` a `pass`; `certifica` e `handoff` eseguiti **come comandi** per la prima volta; informativa in bozza generata **e giudicata** («scheletro da far riempire, non un'informativa»). Il difetto n°12 è la **chiave universale** prevista dal costruttore e avverata: `</script>` letto come *apertura* di tag, e il ripulitore mangia fino a fine documento — costa **un tag** contro i due `<div>` del tribunale. Verificato in proprio sul pilota: il gate ora legge i 7 campi dei moduli, prende `localStorage`, e conta **0 origini di terzi** (prima nominava sé stesso come terzo). Due proposte escalate → **D21** |
| P.7d | **I quattordici**: i due CRITICAL e i dodici HIGH del referto, più i MEDIUM della famiglia dei timeout | `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/**` esclusi `SKILL.md` e `prompts/` + il verbale `PROCESSO-GATE-2026-08-06.md` | ognuno **riprodotto prima** di essere corretto, e chiuso con un test nella forma d'input vera; C1 chiuso in **tutti e quattro** i gate e provato **col sabotaggio** (marcatore presente prima, assente dopo); C2 chiuso **per flusso**, non con una soglia, e il passo stampa quanti flussi dichiarati sono stati davvero esercitati; la famiglia dei timeout chiusa **su tutti e sei** i punti di chiamata, misurata contro un server lento prima e dopo; quattro batterie sopra 156 · 111 · 111 · 87 | mandato `prompts/P7d-i-quattordici.md` (Opus 5 · high). **Niente Docker, niente stack**: le prove sono input ostili a librerie pure e progetti finti. Il rilancio dei quattro gate su banco vivo resta **MANCANTE dichiarato** (precedente di P.7c, accettato dal direttore) ed è l'atto di chiusura di P.7e — **consegnata e collaudata 2026-08-06 (notte)**. Quattordici su quattordici riprodotti prima di essere corretti e chiusi; batterie **465 → 593**, rilanciate dalla direzione: **186 · 173 · 131 · 103**, zero falliti. C1 provato col sabotaggio (`ESEGUITO.txt` non viene più creato affatto); C2 chiuso **per flusso** e non con una soglia. **Il MANCANTE del banco vivo l'ha chiuso in buona parte la direzione**, rilanciando i quattro gate contro il pilota vero a `d147f52`: schema **9/9**, flussi **7/7 con 13 flussi su 13 percorsi davvero**, speed-demon **7/7** — e gestionale **ROSSO**, per un difetto del gate nato in questo stesso pacchetto: **n°50**, decisione **D22** |

### Terza ondata — emessa il 2026-08-06 (notte), quattro chat in parallelo

Tutte **Opus 5 · high**. Solo P.4i usa Docker (possiede lo stack); le altre tre non ne hanno bisogno. Tutte committano **`git commit -F - -- <percorsi>`** (D19).

| # | Cosa | Perimetro in **scrittura** | Criterio falsificabile | Stato |
|---|---|---|---|---|
| P.7e | **Il parser che non guarda dove si trova, e i trentuno che restano** — n°50 in testa (D22), l'audit di **ogni scanner scritto a mano** delle quattro skill con un test ostile ciascuno, il contrasto letto per audit e non per categoria (D21), M2 promosso fuori ordine, i 31 MEDIUM/LOW nell'ordine proposto da P.7d | `agenti/{schema-forge,gestionale-crafter,flow-sentinel,speed-demon}/**` esclusi i `prompts/` — **`SKILL.md` incluso** stavolta, dove una correzione cambia un contratto dichiarato + il verbale `PROCESSO-GATE-2-2026-08-06.md` | n°50 riprodotto **prima** di essere corretto, sul contenuto vero del `tsconfig.json` del pilota copiato in una cartella di lavoro, e la portata scritta in numeri; ogni scanner a mano o **riparato** o **dichiarato immune con file e riga**; il contrasto provato con un report dove la **categoria passa** e `color-contrast` no; quattro batterie sopra 186 · 173 · 131 · 103 | mandato `prompts/P7e-il-parser-e-i-trentuno.md`. **Niente Docker, e il pilota non si apre**: il rilancio dei gate sul pilota è della direzione, al ritorno — **consegnata e collaudata 2026-08-07 (notte)**: 19 commit, perimetro pulito. **n°50 riprodotto prima** (72 caratteri divorati su 655 byte di JSON valido) **e chiuso** (`cada13c`: `JSON.parse` sul testo com'è, spogliatore consapevole solo se solleva); 23 voci del referto chiuse, L8+L6 **MANCANTI dichiarati** con la ragione; audit degli scanner a mano: tre difetti nuovi e sei provati immuni con file e riga; D21 eseguita — il contrasto è un **passo** di speed-demon che legge `color-contrast`, non un punteggio di categoria; tribunale convocato sul proprio codice cambiato (due regressioni sue trovate dal concilio e da nessuna delle 776 asserzioni) e cinque costi chiusi (15,5 s → 0,5 s). **Verificata in proprio dalla direzione**: batterie **228 · 230 · 171 · 147, zero falliti** (sopra 186·173·131·103); il MANCANTE n°1 del verbale — i quattro gate sul pilota dopo le correzioni — **chiuso dalla direzione**: schema **9/9** · gestionale **7/7** (n°50 morde: legge il tsconfig vero) · flussi **7/7** (22 test, 13/13) · speed-demon **8/8** (l'ottavo è il contrasto: 5 pagine, 0 insufficienti) a regia `6a0ac6d`, build `05cf644`. Il MANCANTE che il suo verbale assegnava fuori perimetro — `CLAUDE.md` fermo a 4 gate e 7 passi — chiuso dalla direzione nello stesso giro. **Chiusa** |
| P.5-P3 | **Le tre decisioni della direzione, eseguite** — la delega diventa `block` sul solo runbook (D20), la citazione non conta in `catena-gate` (D23 §1), il registro letto per colonna fissa (D23 §2); più il messaggio che stampa una data e confronta un istante, e `banco.mjs` come requisito permanente | `agenti/launchpad/**` | ogni decisione provata **nei due versi** (la forma vietata → rosso, la forma buona → verde, e altrove invariata); il messaggio del blocco dice **come si toglie**; `banco.mjs` VERDE 9/9 **due volte**, da rigenerazione pulita e sul banco già fatto; batteria sopra 148 | mandato `agenti/launchpad/prompts/P5-P3-le-tre-decisioni.md`. **Non pubblica niente**, come sempre — **consegnata e collaudata 2026-08-07 (notte)**: 8 commit, tutti in `agenti/launchpad/**` con tre chat che committavano in mezzo (D19 regge). Le tre decisioni eseguite **nei due versi con test**: D20 (`block` sul solo runbook, `esitoFirma` invariato altrove e un test tiene il perimetro — cinque gate ci contano), D23 §1 (la citazione blocca nel solo `catena-gate`, il messaggio dice la cura), D23 §2 (colonna nella riga della voce, chiuse esenti, assenza = MANCANTE per voce, prosa declassata a `warn`); più i sette messaggi grossolani riscritti. Misura che vale la D18 §3: il gate vecchio davanti al registro migrato leggeva **45 bloccanti su 56** (le parole della colonna accendevano la sua euristica), il nuovo ne legge i veri — e la finestra di rosso non c'è stata perché P.4i migrava nella stessa ondata. Un difetto trovato nel proprio banco (la firma a capo spariva a un'ancora di riga) corretto **nel banco, non nella regola**. **Verificata in proprio dalla direzione**: batteria **162/162**; `banco.mjs` — requisito permanente — **VERDE 9/9 riprodotto da rigenerazione pulita**, con **un rilievo della direzione**: senza le due `NEXT_PUBLIC_*` la build del banco cade (`supabaseUrl is required` sul prerender di `/prenota`) e l'elenco «Restano TRE passi» non le nomina mentre il runbook del banco sì — premessa non dichiarata dove la si legge → **P.7f**; gate sul pilota **ROSSO 3 rimisurato** (segreti n°27 · runbook di Alberto · handoff di una pubblicazione mai avvenuta), registro letto per colonna: **59 voci · 9 bloccanti · 0 mancanti**. semgrep dichiarato **non misurato** (2 rilievi del collaudo non riprodotti, ruleset ignoto) → P.7f. **Chiusa** |
| P.6-P3 | **Le quattro voci che tornano a casa, e il gate che non finisce mai** — il tribunale sul codice cambiato **come primo atto**, le cinque voci prese in carico (D21), `--scadenza` con default **misurato** e `skipped` sui passi non completati, la tabella dei sedici proprietari riscritta | `agenti/site-doctor/**` + `banco-prova-collaudo-sd/**` | per ognuna delle cinque voci nuove una fixture ostile in cui la cosa è **dichiarata e assente** e una in cui è **presente e sbagliata**; il default della scadenza dichiarato **con la misura che l'ha prodotto**; scadenza provata contro il server lento già costruito, e **ogni passo stampa comunque un verdetto**; batteria sopra 168 | mandato `agenti/site-doctor/prompts/P6-P3-le-deleghe-e-la-scadenza.md`. Pilota in **sola lettura**; `agenti/speed-demon/**` è di un'altra chat — **consegnata e collaudata 2026-08-07 (notte)**: 12 commit in `agenti/site-doctor/**` più **uno fuori perimetro** (`78df00c` su `README.md` di radice: la riga dei 14 passi — contenuto giusto, perimetro no, nessun file altrui coinvolto; rilievo di forma a registro). Tribunale **come primo atto**: sei periti, **48 rilievi** con ESLint·knip·jscpd·batteria tutti verdi (settima convocazione su sette skill, settima volta così) — il `>` dentro un attributo quotato apriva **quattro passi insieme** (quarta istanza del parser in tre giorni, la più economica), l'`aria-labelledby` da 40.000 caratteri in una RegExp era un crash deterministico che azzerava tutti i passi, `responsabile` per `proprietario` spegneva in silenzio la regola per cui la skill esiste, una junction NTFS dentro `docs/` leggeva fuori dal progetto, quattro quadratiche distinte (49 s → 0 ms, 16,7 s → 2 ms); il perito n°5, rimisurando **dopo** le correzioni, ha trovato la chiusura della chiave universale costare una quadratica peggiorata 2,6× — il rilievo migliore della tornata. D21 eseguita: gate **9 → 14 passi**, voci scoperte **8 → 3**, `robots.txt` confrontato con `sitemap.xml` per la prima volta, e il buco di D21 (una voce misurata ma dichiarabile d'altri) trovato sul pilota e chiuso; `--scadenza` col default **estrapolato da una pendenza misurata** (300 s da 20,2 ms per ms di RTT su 19 richieste), provato con dodici scadenze e **un verdetto stampato sempre**. **Verificata in proprio dalla direzione**: batteria **264/264**; gate sul pilota **VERDE — 0 falliti, 1 n/a su 14**, premessa del n/a stampata e misurata. Dichiarati e accettati: tribunale sulle **~900 righe nuove MANCANTE**, `code-maniac scan` mai eseguito, banco del collaudo gitignorato → **D25** e **P.6-P4**. **Chiusa** |
| P.4i | **Il pilota prende il suo certificato, e il registro prende una colonna** — site-doctor eseguita end-to-end sul pilota per la prima volta (`docs/conformita.md`, l'informativa in bozza, la base giuridica, `localStorage` dichiarato), le ~50 voci del registro migrate alla colonna fissa, n°27 scritta secondo D24, M2 mascherato in HEAD, i certificati ridatati **come ultimo atto** | `fornodoro/**` (unico proprietario, possiede lo stack) + il solo verbale `agenti/site-doctor/PILOTA-CONFORMITA-2026-08-06.md` | **E2E 22/22** e 13 flussi su 13 percorsi, qualunque cosa cambi; l'informativa dichiarata **bozza da revisionare** e mai «il pilota è conforme»; ogni voce del registro con la riga fissa, e quelle ambigue risolte **verso `sì`**; i cinque gate rilanciati **dopo** l'ultimo commit di codice, col commit della regia accanto; `docs/deploy.md` ancora **non firmato** | mandato `prompts/P4i-il-certificato-e-la-colonna.md`. `10-gestionale-crafter.md` resta `Gate: ROSSO` finché P.7e non chiude n°50: **non esiste una correzione onesta dal lato del pilota** — **consegnata e collaudata 2026-08-07 (notte)**: 15 commit nel pilota (`749faae → 05cf644`) e 3 in regia sul solo verbale (perimetro esatto). Il **primo certificato di conformità esiste**: `docs/conformita.md`; l'informativa `/privacy` in bozza art. 13 **senza segnaposto** (dove il contenuto lo sa solo il titolare c'è scritto che manca), collegata da 6 pagine su 6, base giuridica 6.1.b su nome e telefono, `fornodoro:carrello` essenziale con la ragione falsificabile, e **in nessun documento c'è scritto che il pilota è conforme**; site-doctor sul pilota da ROSSO (4+3) a VERDE, e i quattro rossi di partenza erano tutti cose vere mai scritte. Registro **59 voci tutte con la colonna D23 §2** (ambigue risolte verso `sì`); n°27 secondo D24, innesco al primo `push`, anche in `deploy.md` §0-bis — **non firmato**; n°56: citare il segreto nel registro l'ha rimesso in HEAD, tolto, e le copie in storia (1 → 3) viaggiano con n°27; due trappole di macchina misurate e a registro (n°57 Lighthouse esce 1 dopo il rapporto e lascia chrome vivi; n°58 `seed-sviluppo` col node di scoop accusa lo stack spento). D21 arrivata **a certificato emesso**: il gate cresciuto l'ha rifiutato e la voce è stata riscritta rilanciando — «nessuna avvertenza dentro un documento lo tiene aggiornato». Sei blocchi malformati del proprio script d'incollaggio trovati e riparati (`48242df → 05cf644`), dichiarati. **Verificata in proprio dalla direzione — sette gate a regia `6a0ac6d` su build `05cf644`, E2E 22/22**: schema 9/9 · vetrina 10/10 (**con l'issue dichiarata**: `/privacy` servita e non nel contratto firmato — la firma è di Alberto, mai delegabile) · gestionale 7/7 · flussi 7/7 (13/13) · speed-demon 8/8 · site-doctor VERDE (1 n/a) · launchpad **ROSSO 3**, e ogni rosso dice di chi è. La voce «contrasti» del certificato va rimisurata ora che speed-demon la guarda → P.7f. **Chiusa** |

### Quarta ondata — emessa il 2026-08-07 (notte), due chat in parallelo

Perimetri disgiunti (P.7f non scrive in `agenti/site-doctor/**`; P.6-P4 scrive **solo** lì).
Commit con `git commit -F - -- <percorsi>` (D19). Nessuna delle due usa Docker; lo stack del
pilota resta acceso e l'app viva sulla 3621.

| # | Cosa | Perimetro in **scrittura** | Criterio falsificabile | Stato |
|---|---|---|---|---|
| P.7f | **Le minuterie della consegna** — HOWTORUN che dichiara 🔵 due skill collaudate (righe 127 e 132); la premessa delle due `NEXT_PUBLIC_*` nell'elenco stampato da `banco.mjs` di launchpad; il semgrep del collaudo P.5 riprodotto o dichiarato coi ruleset provati per nome; la voce «contrasti» del certificato del pilota rimisurata ora che speed-demon la guarda | `HOWTORUN.md` + `agenti/launchpad/**` + `fornodoro/docs/conformita.md` (e handoff 16 solo se il gate lo pretende) + verbale `MINUTERIE-2026-08-07.md` | da rigenerazione pulita, seguendo **solo** le istruzioni stampate da `banco.mjs`, si arriva a VERDE 9/9, e un test tiene l'output; il gate di site-doctor sul pilota passa da «3 da guardare» a «2 da guardare» **senza toccare nient'altro** e resta VERDE; launchpad sul pilota ancora ROSSO 3 identici; gate della regia VERDE prima e dopo; batteria launchpad sopra 162 | mandato `prompts/P7f-le-minuterie-della-consegna.md` (Sonnet 5 · high) — **consegnata e collaudata 2026-08-07**: 5 commit in regia (`ffd8e21` HOWTORUN con la forma piena e i **due prezzi dichiarati** — site-doctor non misura i contrasti, launchpad non ha mai eseguito un deploy; `b7ea449` la caduta riprodotta identica e il **passo 0** con valori finti per costruzione (`.invalid`, RFC 2606), nessun `.env.local` scritto in silenzio, 5 test che eseguono lo script vero e sabotati diventano rossi, secondo banco da zero VERDE 9/9, batteria **162 → 167**; `a1454cf` semgrep **RIPRODOTTO**: era `--config=auto` — 200 regole → gli stessi 2, `p/nodejs` 36 → 0, i tre ruleset di P.5-P3 83 → 0: *un conteggio semgrep senza il ruleset accanto non è confrontabile con niente*; esenzioni rilette: una reggeva contando male i propri chiamanti, 7 dichiarati e 8 veri, corretto) + 1 nel pilota (`5043bd9`, voce «contrasti» riscritta con delega piena e misurata). **Due criteri del mandato erano impossibili, ed erano errori del mandato**: «3 da guardare → 2» non può avvenire da quel perimetro (il rilievo lo emette `SCOPERTE.contrasti` in `conformita-lib.mjs:70`, ramo incondizionato — perimetro site-doctor), e «launchpad ancora ROSSO 3» non convive con «committa nel pilota» + «non ricostruire»: qualunque commit porta HEAD oltre la build e accende `impronta-artefatto` (ROSSO 4). La chat si è fermata e l'ha scritto invece di «sistemarlo» — giusto così. **Verificata in proprio dalla direzione**: batteria **167/167**, perimetro dei commit pulito, e il quarto rosso **chiuso dalla direzione ricostruendo il pilota a `5043bd9`** → launchpad **ROSSO 3** (segreti n°27 · runbook · handoff), site-doctor **VERDE 1 n/a**. **Chiusa** |
| P.6-P4 | **Il tribunale sulle ~900 righe, e il banco che entra in regia** — i tre MANCANTI onesti di P.6-P3: tribunale sul codice nuovo **come primo atto**, D25 eseguita (i sorgenti del banco tracciati, «VERDE 14/14» rilanciabile da un clone pulito), `code-maniac scan` per la prima volta sulla skill | `agenti/site-doctor/**` + `banco-prova-collaudo-sd/**` in riorganizzazione (ciò che si rigenera resta ignorato) | ogni rilievo del tribunale **riprodotto prima** di essere chiuso, un test nella forma d'input vera ciascuno; banco rigenerato **dal percorso tracciato** in cartella temporanea → gate VERDE 14/14 due volte, e almeno 5 delle 42 classi di sabotaggio rilanciate rosse (almeno una sulla chiave universale e una sulla scadenza); batteria sopra 264; gate della regia VERDE prima e dopo | mandato `agenti/site-doctor/prompts/P6-P4-il-tribunale-e-il-banco.md` (Opus 5 · high) — **consegnata e collaudata 2026-08-07**: 7 commit, pilota mai aperto. Tribunale come primo atto su 2535 inserzioni: **otto periti, 61 rilievi** — ottava convocazione su otto skill, ottava volta con ESLint·knip·jscpd·gitleaks·batteria tutti verdi. Il **roster-critic** ha trovato il buco prima di spawnare (nessuno copriva superficie e identità, il passo su cui poggiano dieci passi su quattordici) e il perito nato da lì ha portato il rilievo più grave: **gate VERDE, uscita 0, su un sito che raccoglie IBAN e codice fiscale in una pagina che il gate non apre mai**. **5 chiusi con un test** falsificato contro `git show HEAD:` (crash `&#1114112;` da `String.fromCodePoint`, `9dd61e3`; flusso NTFS `file.md:ombra` + separatore che rendeva `10_site-doctor.md` invisibile — la classe di `ed2d2dc` riaperta da **due porte** diverse, `a9a462a`; doppia sezione «Voci di conformità» letta in silenzio, `1548fdc`; `it-IT` vs `it`, un bilingue perfetto bocciato ovunque, `897da07`); **56 dichiarati riga per riga** in §6.1 del verbale con dove/cosa/verso. **D25 eseguita**: quattro sorgenti tracciati in `scripts/` (precedente di casa due su due), e la correzione di P.6-P3 era stata fatta **al banco e non a chi lo lancia** (`--sabota` non rigenera → il giro presupponeva il disco) più due difetti veri (`vivo()` su `r.ok` perdeva i sabotaggi che rispondono 404; attesa fissa fra classi); corsa 1 e 2 dal percorso tracciato **VERDE 14/14**, otto classi da zero → sette rosse (HTM9 verde già dichiarata). Primo `code-maniac scan`: 3 PASS · 4 MANCANTE col nome · 3 ISSUE, e **due numeri dichiarati corretti dalla misura** (i «5 `detect-non-literal-regexp`» erano 4 + un `react-insecure-request` su un test; il gitleaks ISSUE è della storia dell'intero repo, sulla skill `no leaks found`). Guardiani sul banco appena entrato: 3 rilievi, suoi, chiusi (`c1df66b`). **Verificata in proprio dalla direzione**: batteria **285/285**; banco dal percorso tracciato **VERDE 14/14, 0 n/a** riprodotto; classe **SUP2** (il 404 sulla radice che il vecchio `vivo()` perdeva, fuori dalle otto della chat) **rossa sui passi giusti**; perimetro dei 7 commit pulito. I primi rilievi dei 56 → **P.6-P5**. **Chiusa** |

### Quinta ondata — emessa il 2026-08-07, una chat

Il debito vivo della skill sta in `agenti/site-doctor/P6-P4-2026-08-07.md` §6.1: 56 rilievi
riprodotti, riga per riga. La direzione ne sceglie **dieci** — i falsi verdi capitali, il falso
rosso sul formato che Next genera da solo, i due costi CRITICAL, e la riga che tiene il
conteggio a «3 da guardare». Il resto resta debito dichiarato lì, non sparisce e non si
rincorre tutto insieme. Commit `git commit -F - -- <percorsi>` (D19); niente Docker; pilota
**mai aperto** (il rilancio dei gate sul pilota e la riemissione del certificato — P.4j —
sono della direzione, al ritorno).

| # | Cosa | Perimetro in **scrittura** | Criterio falsificabile | Stato |
|---|---|---|---|---|
| P.6-P5 | **I falsi verdi capitali, la quadratica, e la riga dei contrasti** — dieci rilievi di §6.1 scelti dalla direzione: `SCOPERTE.contrasti` (`conformita-lib.mjs:70` + riga 86 — la prova che quella riga aspettava esiste: grep 4 file a `a1454cf`, gate del vicino verde sul passo `contrasto`); **P7-R2** (IBAN e codice fiscale in una pagina mai aperta: `collegamentiInterni` legge solo `<a href>`); **P1-R2 + P1-R3** (attributo >32 KB che cancella la coda, apostrofo in valore non quotato — due porte della stessa stanza, e il commento 293-295 che dichiara un prezzo falso); **P3-R1** (`formaction`: il gate descrive un sito che non esiste); **P4-R4 + P7-R3** (`<sitemapindex>`: block sul formato che `generateSitemaps()` di Next produce da solo); **P4-R6** (`livelliTitoli` cieco alle regioni nascoste nei due versi); **P2-R1 + P2-R8** (la quadratica di `DENTRO_TAG` in dodici lettori — il rimedio `tagApertiIn` è già nel file, applicato a uno — e la 2,6× da rimisurare dopo); **P2-R2** (la scadenza sorveglia solo la rete: nessun ciclo di CPU la controlla) | `agenti/site-doctor/**` | ogni rilievo **riprodotto prima** di essere chiuso, un test nella forma d'input vera, e per ognuno la **domanda della porta diversa** scritta nel verbale (tre riaperture di classe misurate da P.6-P4); i **costi rimisurati dopo** le correzioni, sugli stessi input che li hanno provati (precedente della 2,6×); gate sul banco «3 da guardare» → **«2 da guardare»** e resta VERDE 14/14; le **42 classi del giro tutte rilanciate** (le 34 mai rimisurate comprese) e `giro-costruttore.mjs` (25 classi) **eseguito per la prima volta**; batteria sopra 285; gate della regia VERDE prima e dopo | mandato `agenti/site-doctor/prompts/P6-P5-i-falsi-verdi-e-la-quadratica.md` (Opus 5 · high) — **consegnata e collaudata 2026-08-07 (sera)**: 3 commit (`c74af63` · `cb56197` · `bdd2edc`), perimetro pulito, pilota mai aperto. **Dieci punti su dieci, undici rilievi chiusi** (P3-R2 — il form annidato — chiuso invece che solo dichiarato), ognuno riprodotto prima e **falsificato contro `git show HEAD:`** (15 test rossi sull'originale), **Chromium `--dump-dom` come giudice** sui cinque casi del parser. `leggiTag` riscritto sugli stati del tokenizer (via il tetto dei 32 KB **col commento che prometteva la garanzia falsa**; terza porta trovata e chiusa: `<!…>`/`<?…>` chiudono al primo `>` anche fra apici); la camminata legge l'inventario dei riferimenti navigabili (a, area, iframe/frame, form GET, meta refresh) **con le esclusioni dichiarate col motivo**; `<sitemapindex>` riconosciuta e seguita con tetto (50, oltre = MANCANTE); `DENTRO_TAG` **non esiste più** — dodici lettori su una passata sola, curva ×4-a-raddoppio → 0,2 ms, la chiave del `>` resta chiusa; la **scadenza sorveglia anche la CPU** (granularità: la pagina; banco CPU da +62% a +0 di sforamento). **La lezione dei costi applicata a sé**: la prima stesura costava ×4 sul benigno, trovato **ricronometrando HEAD-contro-corretto prima della consegna**, ridotto a ×1,0-1,6 dichiarato voce per voce. **Tre scarti dichiarati**: «32 rosse/10 verdi» era un errore d'aritmetica di P.6-P3 §7.4 copiato in due verbali (la tabella dice 31+11 e il giro combacia classe per classe); il banco del costruttore era **pre-D21** — al primo giro vero il conforme usciva ROSSO per il motivo giusto, corretto coi sabotaggi P e S spostati senza perdere la classe; crash di macchina `0xC0000409` **dopo** il verdetto stampato (Node 24.19.0, non deterministico, uguale su HEAD e corrente — i giri leggono `doc.ok`, memoria salvata). Batteria **285 → 308**; giro **43 classi** (nuova `SUP5`: il sito del perito che usciva VERDE con uscita 0); `giro-costruttore` eseguito **per la prima volta** (conforme VERDE + 25/25). **Verificata in proprio dalla direzione**: batteria **308/308** · gate regia **VERDE 5/5** · banco dal percorso tracciato **VERDE 14/14, «2 da guardare»** · **SUP5 rossa sui passi giusti** · **pilota: VERDE, 1 n/a, «2 da guardare»** (contrasti sparita dalle scoperte; restano le due vere: `accessibilita-admin` «sui sorgenti» e `antispam`). Restano **45 dei 61** rilievi, nominati nel verbale §5. **Chiusa** |
| P.4j | **Il certificato riemesso, e le due anteprime** — riallineare `docs/conformita.md` del pilota alla misura nuova («2 da guardare»), chiudere o dichiarare `og:image` e JSON-LD col criterio scritto, ricostruire e riservire dopo l'ultimo commit coi quattro gate dichiarati | `fornodoro/**` + il solo verbale `agenti/site-doctor/PILOTA-CONFORMITA-2-2026-08-07.md` | le voci o chiuse e provate col gate o dichiarate nel registro con la colonna; il certificato ridatato **per ultimo** col numero preso rilanciando il gate; launchpad atteso ROSSO 3 — e se dice altro, fermarsi e scriverlo | mandato `prompts/P4j-il-certificato-riemesso.md` (Opus 5 · high) — **consegnata e collaudata 2026-08-07 (sera)**: 4 commit nel pilota (`4a801e9`..`8c87400`), 1 in regia (solo verbale, `01bb83d`). **JSON-LD chiuso** (scheda `Restaurant` su `/` e `/chi-siamo`, orari da `orari_apertura` non trascritti, n°55 chiusa) e **`og:image` dichiarata invece che chiusa, misurando**: `public/` è vuota e l'unica immagine è una favicon SVG 32×32 — dichiararla col solo `200` sarebbe stato **un falso verde costruito apposta** (n°59 resta, con la misura). Telefono/email fuori dal blocco perché gli slot portano una **frase**, non un recapito: ritagliarli sarebbe il quinto parser a mano (n°60). Certificato riemesso: «sono quattro» → **due**, numero preso rilanciando il gate; ridatato per ultimo. **Il criterio «launchpad ROSSO 3» del mandato era impossibile per costruzione** — terzo errore della stessa classe della direzione: chiudere un rilievo nel codice fa scadere in blocco la freschezza di **tutti** gli handoff a monte (misurato nei due versi) → ROSSO 4, dichiarato e non «sistemato». Due scarti di macchina dichiarati: speed-demon rosso due volte per un `next dev` estraneo da 3,5 GB (n°61), un conteggio copiato da P.4i corretto rifacendolo (9 bloccanti, non 10). **Collaudata dalla direzione, che ha poi chiuso il quarto rosso in proprio**: catena intera rilanciata sulla build finale — schema **9/9** (reset vero + seed, n°58 non scattata: il node di sistema è salito a 24.19) · gestionale **7/7** · flussi **7/7 con Playwright 22/22** · speed-demon **8/8 al primo giro** · vetrina **10/10** · site-doctor **VERDE, 1 n/a, «2 da guardare»** — e gli **otto handoff riconfermati per delega coi verdetti accanto** (commit `33d787c` nel pilota, poi rebuild e riservito). **Launchpad: ROSSO 3 — i tre costituzionali** (segreti/D24 · runbook di Alberto · handoff di una pubblicazione mai avvenuta). **Chiusa** |
| P.4k | **La storia pulita e il seed senza password** — D24 eseguita per intero, una volta sola: il seed di sviluppo perde la password cablata (fonte locale non tracciata, contratto E2E riconfermato con 22/22), poi la riscrittura della storia toglie **tutte** le copie (1 in HEAD + 5 file storici, elenco misurato nel mandato), bundle di backup prima, registro n°27/n°56 chiusi con la prova | `fornodoro/**` + il solo verbale `agenti/launchpad/PILOTA-STORIA-2026-08-XX.md` | gate segreti **OK su HEAD e storia**; launchpad **ROSSO 2** (runbook · contratto d'uscita) e se dice altro ci si ferma; E2E **22/22 rilanciati** con la fonte nuova; catena intera verde dopo rebuild; gli hash storici nei verbali dichiarati pre-riscrittura, i verbali chiusi non si riscrivono | mandato `prompts/P4k-la-storia-pulita-e-il-seed.md` (Opus 5 · high) — **consegnata e collaudata 2026-08-07 (sera tardi)**, avviata dal committente dopo il suo «vai pure». **D24 onorata mentre era ancora una finestra vuota** (`git remote -v` vuoto, nessun push mai eseguito): il seed non contiene più nessuna password — la **riceve** dalla GUC `fornodoro.password_sviluppo`, quarta guardia fail-closed, letta da `.env.sviluppo.local` (ignorato), **fonte sola** che legge anche la batteria E2E; storia riscritta con `git-filter-repo` su **71 commit**, date conservate, due bundle verificati sul Desktop; **`segreti`: 10 bloccanti → zero** (stesso comando prima e dopo), **n°27 e n°56 chiuse col gate in mano** (bloccanti a registro 9 → 7, conteggio del gate); 40 occorrenze in 13 documenti riallineate. **Tre scarti dichiarati e giusti**: il `***RIMOSSO***` suggerito dal mandato restava un bloccante dentro `crypt('…')` (la famiglia credenziale-sql non guarda i segnaposto) → rotta la forma; `--replace-text` non rispetta l'ordine del file → solo righe `regex:`; il `.example` accanto al file sarebbe stato **un `.env` tracciato**, cioè un block creato per dare il buon esempio → l'esempio vive nel messaggio d'errore del comando. Deroga dichiarata: `docs/deploy.md` toccato perché il mandato lo prescrive per nome, **firma mai avvicinata**. Primo rilancio ROSSO 3: `supabase/` sta in `PERCORSI_CODICE` e il commit del punto 1 aveva fatto scadere **due** handoff (08 e 16) — curato **rilanciando i loro gate, non ridatandoli**. **Verificata in proprio dalla direzione sulla storia riscritta**: launchpad **ROSSO 2 con `segreti` OK** · schema **9/9** con reset vero · **seed dalla GUC funzionante** (e il messaggio non stampa più nessuna password) · flussi **7/7 con Playwright 22/22 sulla fonte nuova** · site-doctor **VERDE «2 da guardare»** · vetrina **10/10** · `.env.sviluppo.local` ignorato e non tracciato · firma del runbook ancora segnaposto · perimetri puliti (3 commit pilota, 1 regia sul solo verbale). Gestionale e speed-demon accettati dalle corse della chat, dichiarato. **I due rossi rimasti sono i due gesti del committente: la firma del runbook e la pubblicazione stessa. Chiusa** |

## Giornale di cantiere

- **2026-08-02** — Apertura del cantiere. Fase 1 (analisi) eseguita dal direttore: letti
  `CLAUDE.md`, `README.md` (note comprese), `HOWTORUN.md`, `DECISIONI.md` (26 voci), i 10
  `STATO.md`, i verbali del 2026-07-30 (flow-sentinel P3 + evolve, speed-demon avversario),
  `.claude/agents/code-guardian.md`, `template-skill/`. Creato questo file. Decisioni D1–D3.
  Emesso il mandato **P.1** (`agenti/vetrina-crafter/prompts/P0-progettazione.md`). In attesa
  dell'esito dell'operaio.
- **2026-08-02 (sera)** — **P.1 consegnata** dall'operaio (Opus 5 · max, commit `a1ee045`,
  7 file, 1.731 righe, perimetro rispettato). Revisione del direttore sui cinque file per
  intero: **promossa**. Punti di forza: gate a 10 passi con premessa/MANCANTE per passo,
  perimetro SEO diviso e motivato, template con SINTASSI/PROSA marcate (risposta diretta ai
  17 difetti di speed-demon), doppio STOP umano su «cosa diventa pubblico» (§6 applicata),
  10 falsi verdi previsti con contromisura, 7 proposte a monte/valle bene incanalate.
  Tre rilievi minori assorbiti come correzioni d'apertura nel mandato P.2: (1) BUILD_ID di
  un altro progetto = `fail` con diagnosi, non MANCANTE (precedente speed-demon);
  (2) la seconda direzione di `pagine-vive` misura i sorgenti e va dichiarata così;
  (3) slot dichiarato senza riga pubblicata: block vs MANCANTE si decide col banco.
  Decisioni di direzione: in P1 **tutti e 7 i comandi si esercitano** (lezione `evolve`);
  README e `installa-skill.ps1` si aggiornano **solo a gate verde** (tradizione speed-demon);
  il banco di P1 resta su disco fino a fine P.3 per verifica e non-regressione. Nuova regola
  **D4** (modello/effort nei mandati, richiesta del committente). Emesso il mandato **P.2**
  (`prompts/P1-costruzione.md`, consigliato Opus 5 · max): parte alla firma di P0.
- **2026-08-03** — **Giornata di ambiente, e due difetti che l'ambiente teneva nascosti.**

  *Ambiente (risolto).* Il banco di P.2 era irrealizzabile: Docker, CLI Supabase e `psql`
  assenti. Installati `scoop`, **Supabase CLI 2.111.0**, **psql 18.4**. `wsl --install`
  falliva con DISM 14098 / `0x80073712` — metadati corrotti di
  `Microsoft-OneCore-CimFS-UnionFS-Deployment 10.0.26100.8328`. **DISM RestoreHealth (due
  volte), `sfc`, `StartComponentCleanup` e un riavvio hanno tutti dichiarato successo
  lasciando `VirtualMachinePlatform` su `Disabled`**: è servito **Impostazioni → Sistema →
  Ripristino → «Correggi i problemi con Windows Update»** (build 26200, UBR 8655 → 8875).
  Poi **Docker Desktop 4.84.0** (motore 29.6.2), e `C:\Windows.old` (31 GB) rimossa per
  fare spazio allo stack. Banco `banco-prova-vetcare` **acceso**: Postgres 17.6, 6
  migrazioni + seed, porte **57321/57322** (non le 54321/54322 di default).

  *Difetto 1 — i gate non eseguono su Node 20.* Trovato dall'operaio di P.2 costruendo,
  **verificato dal direttore in tutte e due le direzioni**. Cinque `if (import.meta.main)`
  in quattro skill (`schema-forge/verify.mjs:649`, `gestionale-crafter/verify.mjs:427`,
  `gestionale-crafter/admin-audit.mjs:208`, `flow-sentinel/verify.mjs:455`,
  `speed-demon/verify.mjs:559`). `import.meta.main` è arrivato in **Node 24**: su Node
  20.12.2 — l'unico Node di sistema di questa macchina — vale `undefined`, `main()` non
  gira e **i quattro gate escono `0` senza stampare una riga**. Stesso comando su Node
  24.18.1: parlano ed escono `2`. I verdi storici **non erano falsi**: il
  `COLLAUDO-2026-07-28` di gestionale-crafter dichiara Node 24.14.0. Installato **Node
  24.18.1 accanto** al 20 (`~/scoop/apps/nodejs-lts/current/node.exe`), che non lo
  sostituisce. Il gate nuovo di `vetrina-crafter` evita la trappola apposta.

  *Difetto 2 — schema-forge non emette GRANT.* Gate di schema-forge rilanciato sul banco
  con Node 24, prima misura vera dal 27 luglio: **ROSSO** (1 fallito, 2 mancanti su 9).
  pgTAP muore con `permission denied for table animals`: **18 tabelle in `public`,
  `anon`/`authenticated`/`service_role` hanno solo REFERENCES/TRIGGER/TRUNCATE, zero
  `GRANT` e zero `ALTER DEFAULT PRIVILEGES` nelle migrazioni**. Lo schema si appoggiava ai
  privilegi impliciti che le vecchie immagini Supabase concedevano e le nuove no. Non è un
  difetto del banco: è il **contratto d'uscita di schema-forge**, e la vetrina legge con la
  chiave anonima — su uno schema così il passo 9 `contenuti-vivi` di P.2 fallirebbe per
  colpa d'altri. Il verde di luglio **non era falso: era scaduto**.

  *Rilievi minori misurati lo stesso giorno:* `db advisors` segnala 20 tabelle con policy
  permissive multiple; l'audit RLS trova **12 funzioni `security definer` eseguibili da
  PUBLIC** (quindi da `anon`) e una policy `using (true)` su `public.species`. `sqlfluff` e
  `squawk` restano `MANCANTI`, mai installati.

  *Proposte al committente, in attesa di firma:* **P.8** (GRANT espliciti in schema-forge +
  regola d'audit «RLS senza GRANT = difetto») — **prerequisito duro del deliverable 4 di
  P.2**; **P.0-igiene** (i cinque `import.meta.main`, più un test che impedisca il ritorno).
  I due non si toccano e possono correre in parallelo, in chat vergini e distinte da quella
  di P.2 — chi costruisce non collauda. Profilo D4: Opus 5 · max per entrambi.
- **2026-08-03 (ripresa della direzione)** — Verifiche rifatte in proprio prima di firmare:
  **(a)** difetto Node riprodotto nelle due direzioni — `node` 20.12.2 sul gate di
  schema-forge in cartella non-progetto: **uscita 0, zero righe stampate**; Node 24.18.1,
  stesso comando: parla ed esce 2. **(b)** ACL del banco lette con psql:
  `anon/authenticated/service_role = Dxtm` (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, zero
  CRUD) su tutte le tabelle campionate, e **zero** `grant` / `alter default privileges`
  nelle 6 migrazioni (grep). **(c)** i 113 test di vetrina-crafter rilanciati con Node 24:
  113 pass, 0 fail. **(d)** grep di `import.meta.main` su tutto `agenti/`: i cinque punti
  confermati, gli **snapshot esterni esenti**, vetrina-crafter lo evita con commento.
  *Nota d'indagine per P.8:* la regola 6 dell'audit («RLS senza grant») **non è scattata**
  sul banco — l'ACL `Dxtm` non è vuota, e la regola evidentemente non distingue quali
  privilegi: è il cuore del difetto d'audit, da misurare in P.8.
  **Decisioni:** P.0-igiene **firmata e aperta**; P.8 **aperta** col perimetro **D7**;
  **sequenza** al posto del parallelo proposto (**D6**); **D5** sui mandati trasversali.
  Emesso il mandato **P.0-igiene** (`prompts/P0-igiene-gate-node20.md`, Opus 5 · max);
  il mandato P.8 si scrive alla chiusura di P.0-igiene, la ripresa di P.2 dopo P.8.
- **2026-08-03 (pomeriggio)** — **P.0-igiene consegnata e collaudata.** L'operaio
  (Opus 5 · max, commit `cdd6189` + `0b7fa09`) ha corretto i cinque punti con la forma di
  vetrina-crafter, aggiunto **due** test per script (funzionale + statico) e provato i
  test per sabotaggio (reintrodotto il difetto: su Node 24 il funzionale passa e lo
  statico fallisce — esattamente il motivo per cui i test sono due). Verifica del
  direttore, tutta rilanciata in proprio: 5/5 script col node di sistema → exit `2` col
  messaggio; batterie **146/109/110/75, 0 fail**; gate sul banco col node di sistema →
  **ROSSO 1 fallito / 2 mancanti, uscita 1**, identico alla misura con Node 24; grep:
  nessuna guardia viva. Residui riportati dall'operaio e smistati: ESLint locale delle
  skill storiche senza `node_modules` e `complexity 19` preesistente su
  `speed-demon/verify.mjs:263` → **P.7c** (per schema-forge invece l'`npm install` entra
  in **P.8**, che ne tocca gli script); le batterie `node --test` vogliono Node 21+ per
  il glob (fatto d'ambiente, in memoria). Bonus misurato: il difetto azzoppava anche
  `rete-verde` di speed-demon, che lancia il gate di flow-sentinel come sottoprocesso —
  ora funziona. Emesso il mandato **P.8**
  (`agenti/schema-forge/prompts/P8-privilegi-espliciti.md`, Opus 5 · max).
- **2026-08-03 (sera)** — **P.8 consegnata: i privilegi entrano nel contratto d'uscita.**
  L'operaio (Opus 5 · max) ha chiuso le due richieste storiche mai applicate dello
  `STATO.md` di schema-forge — il `revoke` prima del `grant` **nella regola** (2026-07-28) e
  `service_role` nei permessi espliciti (2026-07-30, «la richiesta più importante
  dell'intero file»). Regola nuova in `SKILL.md` §I privilegi si scrivono, non si ereditano;
  voce **`DECISIONI.md` §27**.

  *Perché la regola 6/7 dell'audit taceva, misurato.* Chiedeva al catalogo una cosa più
  debole di quella che le serviva: «questa tabella compare in `role_table_grants` per `anon`
  o `authenticated`?», senza guardare **quale** privilegio. Con `Dxtm` la tabella compare lo
  stesso, con `privilege_type` = TRUNCATE/REFERENCES/TRIGGER — la stessa query dell'audit
  rendeva **19 righe su 19 oggetti** su uno schema in cui nessun ruolo del client poteva
  leggere una riga. Riscritta su `pg_policies` × `has_any_column_privilege`: sullo stesso
  banco, **0 findings prima, 21 `block` dopo**. Gravità `block` e non `issue` per il criterio
  della §17 (prova interamente nel catalogo, zero euristica) e perché il danno è totale e
  muto. `has_any_column_privilege` e non `has_table_privilege`, altrimenti l'audit boccerebbe
  il `grant update (colonna)` che la skill stessa prescrive.

  *Tre cose trovate misurando, che il mandato non prevedeva.* **(a)** `Dxtm` non è «meno
  permissivo»: comprende TRUNCATE, e **la RLS non si applica a TRUNCATE** — `set role anon;
  truncate public.animals cascade` **riusciva** sul banco, portandosi via dieci tabelle, con
  `force row level security` attiva ovunque. È la giustificazione più forte del `revoke`, e
  non era nel mandato. **(b)** `pg_default_acl` conteneva **due righe in conflitto** per lo
  stesso schema (`supabase_admin` → `arwdDxtm`, `postgres` → `Dxtm`): il default dipende da
  **chi crea l'oggetto**, e una tabella creata da un terzo ruolo nasce con `relacl` NULL. Da
  qui la decisione di **non** prescrivere `alter default privileges`, che era la forma più
  elegante e la più sbagliata. **(c)** `sqlfluff` **saltava in silenzio**
  `20260726120200_clinico.sql` (20 384 byte, oltre il default di 20 000) uscendo 0: il passo
  restava `MANCANTE` e il rimedio suggerito dal gate — spezzare il file — è impossibile su
  una migrazione immutabile. Corretto con `large_file_skip_byte_limit = 0` motivato nel
  `.sqlfluff` della skill e del banco, provato nelle due direzioni.

  *Il banco.* Settima migrazione in coda (`20260803120000_permessi_espliciti.sql`), banco
  **non sanato**: `staff` riceve `update` di tabella intera, cioè l'auto-promozione resta.
  Gate **prima**: ROSSO, 1 fallito, 2 mancanti su 9, `audit-rls` **OK** (il `block` storico
  non scattava), pgTAP 9/23 + 11/11 tutti `permission denied`. Gate **dopo**: **ROSSO, 2
  falliti, 0 mancanti su 9**, `block` su `staff.job_title` **tornato**, pgTAP **2/23** —
  le asserzioni storiche 22-23. Le ACL sono passate da `anon/authenticated/service_role =
  Dxtm` su tutte e 18 le tabelle a `anon=r` sulle sole tre pubbliche, `authenticated`
  l'unione di ciò che le sue policy promettono, `service_role=arwd`, e **nessun** ruolo del
  client con `truncate`.

  *Lo scarto dal verdetto atteso, ed è una cosa da decidere.* Il mandato prevedeva pgTAP a
  2 asserzioni su 23 e `rls_policy.test.sql` verde. Il file esegue **10 asserzioni su 11** e
  si ferma sull'undicesima — «la chiave anonima non legge nessun cliente» — che asseriva
  `count = 0`, cioè la forma del rifiuto che dava la RLS **quando `anon` aveva `select` su
  tutto per grazia del default**. Il modello di accesso del banco dice `owners → anon: —` e
  la migrazione scrive quello, quindi il rifiuto arriva prima della RLS (`42501 permission
  denied`). Non è un allentamento: è più stretto di prima. L'operaio non ha toccato il test
  («chi scrive la migrazione non riscrive il test che la giudica») né aggiunto il `grant`
  che lo farebbe passare («è la scorciatoia che la migrazione esiste per chiudere»), e ha
  dichiarato la riga nell'handoff del banco e nello `STATO.md`. **Decisione del direttore:**
  riallineare l'asserzione a `throws_ok(…, '42501', …)` — più forte di `count = 0` — oppure
  accettare la quarta riga rossa come parte del rosso documentato del banco.

  *Guardiani.* ESLint sugli script **pulito** dopo due correzioni: `complexity 21` sulla
  regola nuova (estratte due funzioni pure) e un `no-undef` su `URL` in `verify.test.mjs`
  **vivo da P.0-igiene e mai visto**, perché i `node_modules` della skill non erano
  installati e ESLint non girava affatto — cioè un guardiano che non gira è un guardiano che
  passa. `knip` pulito. Batteria **153 verdi, 0 fail** (era 146). `sqlfluff` 4.2.2 e `squawk`
  2.61.0 installati con `pipx` (`python -m pip install --user pipx`, poi `pipx ensurepath`:
  `~/.local/bin` è ora nel PATH utente permanente).

  *Resta fuori, dichiarato:* la versione della CLI Supabase e dell'immagine Postgres non è
  versionata da nessuna parte (richiesta n°2 del 2026-07-30, fuori da D7). La regola limita
  il danno di un aggiornamento non annunciato, non lo impedisce.
- **2026-08-04 — Ritorno delle tre chat parallele, verifiche del direttore.**
  **P.2 chiusa**: gate della vetrina **VERDE 10/10 rilanciato in proprio** su
  `banco-prova-controtempo` (prima Docker era spento e il gate ha correttamente
  rifiutato il verde: MANCANTE su `contenuti-vivi`, FAIL su `contratto-uscita` che
  boccia un handoff `VERDE` su esecuzione rossa — MANCANTE ≠ PASS visto dal vivo);
  batteria 122/122; il verbale `COSTRUZIONE-2026-08-03.md` regge punto per punto.
  **P.7a chiusa**: gate della regia **VERDE 5/5 rilanciato** col node di sistema,
  batteria 46/46; il passo `docx-txt` estrae in un temporaneo e non riscrive; nota a
  perimetro: `estrai-docx.ps1` rifattorizzato (12 righe) dentro `scripts/`, lecito.
  **P.7b parziale**: il txt in working tree differiva dal committato solo nei
  fine-riga (ripristinato, albero pulito); il docx (modificato 2026-08-02 17:21) non è
  stato editato durante il mandato — lista puntuale delle righe stantie consegnata dal
  direttore al committente (schema-forge v1.3→v1.5 · vetrina-crafter assente al posto 8
  · test 105/108/73→109/110/75 · la cicatrice `BUTCHER`); al «fatto» di Alberto il
  direttore rigenera e committa (atto di registro).
  **Nuovo giro (D8 aggiornata): P.3 ∥ P.7c** — mandati emessi
  (`agenti/vetrina-crafter/prompts/P2-collaudo.md`, Opus 5 · max ·
  `prompts/P7c-guardiani-arretrati.md`, Opus 5 · high). Il collaudo avversario parte
  dal §10 del verbale di costruzione: modulo pubblico mai misurato, euristiche mai
  stressate, classi cieche da confermare. Stack: vetcare a P.7c, controtempo fermo
  (db acceso) per la non-regressione finale di P.3. Dopo P.3: la rotta arriva a
  **P.4, il filo completo** — il primo pacchetto col committente in campo. — **P.8 collaudata dal direttore**, tutto rilanciato in
  proprio: gate sul banco **ROSSO 2 falliti / 0 mancanti, uscita 1** (`block` su
  `job_title` presente, pgTAP 22-23), ACL verificate con psql (`anon=r` solo su
  `clinics`/`species`, `service_role=arwd`, nessun ruolo client con `Dxtm`, coerenti col
  modello di accesso), batteria **153/153**, perimetro dei quattro commit conforme a D7.
  Lo scarto `rls_policy` 10/11 deciso con **D9**: si riallinea l'asserzione a `throws_ok`
  in P.7c — la forma più forte del rifiuto, non il grant che la farebbe passare.
  **Pit stop e cambio di assetto (richiesta del committente): si passa a tre chat in
  parallelo** su perimetri disgiunti (**D8**): **P.2-ripresa** (il cammino critico della
  rotta, `agenti/vetrina-crafter/prompts/P1-ripresa.md`, Opus 5 · max) ∥ **P.7a** gate
  della regia (`prompts/P7a-gate-regia.md`, Opus 5 · high) ∥ **P.7b** documento madre
  (`prompts/P7b-docx.md`, Sonnet 5 · high). **P.7c** arricchito (guardiani arretrati +
  riallineo D9) resta in coda a P.2. Al ritorno di P.2: verifica del direttore, poi
  mandato **P.3** (collaudo avversario, chat vergine). La rotta non cambia:
  P.3 → P.4 filo completo → P.5 launchpad → P.6 site-doctor.
- **2026-08-04 (attesa delle due chat) — P.4 scomposta: `prompts/P4-piano.md`.**
  Con P.3 e P.7c ancora al lavoro, il direttore non ha niente da verificare (rilanciare
  un gate adesso sporcherebbe le loro misure, lezione D6) e prepara il pacchetto più
  lungo della rotta.

  *Cosa deve dimostrare P.4, scritto prima di partire.* Non «costruire un sito»: togliere
  la frase *non usabile su un progetto cliente* dagli `STATO.md`. Per tre skill il motivo
  è **letteralmente lo stesso** — il contratto l'ha firmato chi costruiva o chi
  collaudava, e il gate legge la firma, non la sua verità — e quel motivo lo toglie solo
  una firma vera. Per le altre due **no, e va detto**: il gate di gestionale-crafter conta
  le guardie senza sapere se chiedono il ruolo giusto (misurato, non temuto), e
  schema-forge ha i punti 11 e 15 aperti. Chi leggerà il verbale di P.4 non deve poterne
  concludere «la pipeline è pronta per un cliente».

  *Due fatti strutturali.* **(a) P.4 non si parallelizza**: i cinque sotto-pacchetti
  scrivono nella stessa cartella e pilotano lo stesso stack, e l'ingresso di ciascuno è
  l'handoff del precedente — la D8 qui non ha niente da applicare. Cinque chat in
  sequenza, con la verifica del direttore fra l'una e l'altra. **(b) Il committente è
  dentro il cammino critico cinque volte** (Specchio del dominio, `vetrina.md`, Specchio
  del gestionale, `flussi-critici.md`, `performance.md`): il suo tempo è una risorsa da
  prenotare, non da scoprire.

  *Decisioni del committente:* **D10** dominio = pizzeria con ordini d'asporto (flusso a
  macchina di stati, classe mai attraversata: gli altri tre banchi provavano tutti una
  *prenotazione*; pagamento fuori perimetro), **D11** repo separato.

  *Tre cose misurate preparando il piano, non dedotte.* **(a)** I cinque gate **reggono
  fuori dall'albero della regia**: tutti separano `SKILL_DIR` (da `import.meta.url`) da
  `process.cwd()` (il progetto). **(b)** L'eccezione è **speed-demon**, l'unico che esce
  dalla propria cartella — `AGENTI_DIR = dirname(SKILL_DIR)`, perché `rete-verde` lancia
  il gate di flow-sentinel come sottoprocesso: invocato **dalla junction** `AGENTI_DIR`
  diventa `.claude/skills`, e va provato. **(c)** `scripts/installa-skill.ps1` **non ha
  un parametro di destinazione** (`$destinazione = Join-Path $radice ".claude\skills"`):
  una chat operaia aperta sul repo pilota non vedrebbe **nessuna skill**. Da qui nasce
  **P.4-pre**, che chiude anche la prova mai fatta della firma con un nome proprio —
  fra i 17 difetti di speed-demon c'era il gate che rifiutava
  `Confermato da: Alberto Marocco, sviluppatore` e accettava `ORCHESTRATORE`.

  *Non committato*: i due file restano in working tree finché una delle due chat non
  torna, per non toccare l'index condiviso a metà del loro lavoro (D8).
- **2026-08-04 (stessa attesa) — mandato P.4-pre scritto: `prompts/P4-pre-strada.md`.**
  Il primo dei sei sotto-pacchetti ha il suo mandato; gli altri cinque no, e di
  proposito: P.4a andrà scritto **dopo** aver letto il verbale di P.4-pre, perché tre
  dei suoi presupposti (la destinazione delle skill, le porte, la firma) sono
  esattamente ciò che P.4-pre misura.

  Due cose trovate leggendo il codice mentre lo scrivevo, che il mandato dichiara
  perché l'operaio non le scopra a metà: **(a)** in PowerShell il blocco `param()`
  dev'essere la prima istruzione eseguibile, e `installa-skill.ps1` ha
  `$ErrorActionPreference` alla riga 13 — messo dopo, il parametro non è un difetto
  di comportamento, è un errore di parsing; **(b)** `skillDaPs1`
  (`regia-lib.mjs:243`) legge l'elenco con una regex sull'array `$skill = @("…")`, e
  «elenco non trovato» ritorna `null`, che nella regola `skill-elencate` **non è**
  «elenco vuoto»: cambiare la forma dell'array non renderebbe il gate rosso, lo
  renderebbe **cieco**. È la classe di difetti peggiore che il gate della regia possa
  contrarre, ed è la ragione per cui il deliverable 1 pretende il verde 5/5 incollato
  prima e dopo.
- **2026-08-04 (sera) — ritorno di P.3 e P.7c, entrambe interrotte a metà; verifiche
  del direttore; passaggio di direzione.**

  *P.3 (collaudo avversario della vetrina).* Tre commit veri, nessun verbale: la chat
  si è fermata prima di scriverlo. I sei difetti sono nel registro (riga P.3); il più
  grave è il n°5 — **il percorso di scrittura pubblico non lo guardava nessuno dei
  dieci passi**: aperta all'anonimo la rilettura di `richieste_prenotazione` con due
  righe di SQL, chiunque leggeva nome/email/telefono di chi aveva scritto prima, e il
  gate chiudeva VERDE 10/10 (l'audit di schema-forge, a monte, degradava a `issue`
  rimandando proprio al documento che questo passo ora verifica). Il n°6 spiega
  perché non si era mai visto: la regola delle zero righe era **morta dalla nascita**
  (`SET0` → `NaN`), e il suo test passava perché verificava la regola con una Mappa
  scritta a mano — il guscio non produceva mai un numero. Verifiche del direttore,
  tutte in proprio: batteria **144/144**; app di controtempo riavviata e gate corretto
  **rilanciato: VERDE 10/10, uscita 0** (poi app rispenta). La prova finale del
  mandato c'è; mancano verbale, `STATO.md` e il resto della caccia.

  *P.7c (guardiani arretrati).* Interrotta ancora prima: lavoro giusto ma **tutto in
  working tree**, zero commit, e i punti 3-7 mai iniziati (semgrep, code-inquisition,
  gitleaks, D9, STATO). Verificato in proprio prima di committare: batteria
  speed-demon **86/86** (75 → 86 col refactor della complessità), ESLint pulito su
  speed-demon, gestionale-crafter e flow-sentinel (ora che gira: il globale `URL`
  mancante è il primo rilievo trovato *perché* gira), knip pulito. Committato dal
  direttore come P.7c parziale.

  *Terza chat (direzione d'attesa).* Ha scritto `prompts/P4-piano.md` e
  `prompts/P4-pre-strada.md` e preso con il committente **D10** (pizzeria d'asporto)
  e **D11** (repo separato). Revisionati dal direttore: riferimenti giusti, premesse
  misurate e non dedotte (l'`AGENTI_DIR` di speed-demon, il `param()` di PowerShell,
  `skillDaPs1`); promossi e committati così come sono.

  *P.7b, per il committente.* La lista per l'edit in Word resta questa, coi numeri
  correnti a stasera: (1) riga Schema Forge: «v1.3» → v1.5, gate 9 passi, 153 test,
  privilegi espliciti; (2) posto 8: Fly UI → **Vetrina Crafter [Ce l'ho]**, gate 10
  passi, 144 test, in collaudo avversario (Fly UI eventuale, entrerebbe nella
  cucitura); (3) test: Gestionale 105→109, Flow Sentinel 108→110, Speed Demon 73→86;
  (4) via il `// BUTCHER DA METTEREEEEEEEE`. Al «fatto» il direttore rigenera il txt
  con `scripts/estrai-docx.ps1` e committa.

  *Stato macchina a fine giornata.* Docker acceso; **tre stack Supabase attivi**:
  vetcare (57321/57322), controtempo (57421-57424), valscura (porte sue, banco di P.3
  su disco, gitignorato); l'app di controtempo su 3140 è **spenta** (si riavvia con
  `npm run start -- -p 3140` dalla sua radice). Node: gate col node di sistema
  (20.12.2), batterie con `~/scoop/apps/nodejs-lts/current/node.exe` (24.18.1).

  *Passaggio di direzione.* Il committente trasferisce la direzione a una chat nuova
  (Claude Fable · effort max). Il passaggio è scritto in
  `prompts/passaggio-direzione-2026-08-04.md`; chi lo riceve legge questo file per
  intero prima di emettere qualsiasi mandato. Prossime mosse nell'ordine: **P.3-ripresa
  ∥ P.7c-ripresa** (perimetri disgiunti, D8) → **P.4-pre** (mandato già pronto,
  Sonnet 5 · high) → **P.4a…e in sequenza** (Opus 5 · high, mai in parallelo) →
  P.5 → P.6. P.7b si chiude appena Alberto edita il docx.
- **2026-08-04 (notte) — insediamento della nuova direzione; le due riprese emesse.**
  Direzione assunta secondo il passaggio: letti per intero
  `prompts/passaggio-direzione-2026-08-04.md`, questo registro, `CLAUDE.md` e
  `DECISIONI.md`. **Verifiche d'insediamento rilanciate in proprio prima di
  emettere**: batteria vetrina-crafter **144/144** e speed-demon **86/86**
  (Node 24), gate della regia **uscita 0** col node di sistema, tre stack accesi
  (vetcare 57321-24, controtempo 57421-24, valscura 57521-27), tre banchi su disco,
  HEAD `bec428c` — tutto coerente con la tabella del passaggio. Emessi i due
  mandati di ripresa in parallelo (D8, perimetri disgiunti): **P.3-ripresa**
  (`agenti/vetrina-crafter/prompts/P2-ripresa.md`, Opus 5 · max — resto della
  caccia sul banco valscura, verbale che copre anche i sei difetti committati,
  stato dei sabotaggi del banco da accertare prima di misurare) e **P.7c-ripresa**
  (`prompts/P7c-ripresa.md`, Opus 5 · high — punti 3-7, compreso il riallineo D9
  col verdetto atteso falsificabile; in più il knip di gestionale-crafter e
  flow-sentinel, mai eseguito). In entrambi la lezione del giorno, prescritta come
  regola operativa: **un commit per difetto o punto chiuso, verbale e `STATO.md`
  scritti man mano** — un'interruzione deve lasciare misure, non ricordi. P.7b
  resta in attesa dell'edit del committente sul docx; alla chiusura delle due
  riprese: verifica del direttore, poi **P.4-pre**.
- **2026-08-04 (pomeriggio) — le due riprese tornano: P.3 chiusa, P.7c di nuovo
  muta; il direttore salva D9, chiude i registri, e tutte le verifiche
  combaciano con l'atteso.**

  *P.3-ripresa.* Consegnata come prescritto — un commit ogni ~7 minuti, verbale
  aperto prima della caccia: la regola «misure, non ricordi» ha funzionato al
  primo impiego. 14 difetti, batteria 122 → 177, due banchi verdi. Dettaglio e
  residui dichiarati nella riga P.3.

  *P.7c-ripresa.* La forma della morte precedente, ripetuta: un'ora di lavoro,
  zero commit, in working tree il solo riallineo D9 — fatto bene. Dei punti 3-5
  nessuna traccia nel repo. Salvataggio del direttore: D9 chiuso e committato
  col gate rilanciato, knip di gestionale-crafter e flow-sentinel eseguiti (0
  rilievi entrambi), numeri dei punti 1-2 nei quattro `STATO.md`, handoff del
  banco aggiornato. **Ripresa-2 pronta** per i punti 3-5
  (`prompts/P7c-ripresa2.md`), con la regola del commit promossa a primo
  deliverable.

  *Verifiche del direttore — attese dichiarate prima, poi misurate.* Batteria
  vetrina **177/177**; batteria speed-demon **86/86**; gate della regia
  **VERDE 5/5** al secondo lancio; gate vetcare **ROSSO, 2 falliti, 0 mancanti
  su 9** al secondo lancio — pgTAP 2/23 (le storiche 22-23), `rls_policy`
  11/11, identico al verdetto atteso del mandato; gate vetrina su valscura vivo
  **VERDE 10/10, uscita 0** (identità dell'app dal build id). I due «secondi
  lanci» hanno la stessa causa, misurata e provata: col carico di due gate e
  due batterie insieme la macchina ha esaurito la memoria di paging
  (0x800705AF) — il gate della regia ha perso il passo docx (Windows PowerShell
  non caricava `System.Core` → MANCANTE, quindi rosso: mai un verde non
  guardato) e il gate vetcare il passo tipi (FAIL a dettaglio vuoto). A
  macchina quieta entrambi verdi, e i tipi rigenerati a mano sono identici ai
  committati. Lezione operativa: **un gate per volta quando gli stack sono
  accesi**.

  *Igiene.* `.claude/settings.json` — permessi di sessione accumulati, con
  percorsi di macchina e ID dentro — messo in `.gitignore` con la motivazione
  nel file: è stato della macchina, non del repo.

  *Prossimo.* **P.4-pre** può essere emesso (prerequisito riletto nella sua
  riga), anche in parallelo a **P.7c-ripresa-2**: perimetri disgiunti
  dichiarati nei due mandati. Poi P.4a…e in sequenza. P.7b resta in attesa
  dell'edit del committente sul docx.
- **2026-08-04 (sera) — la macchina rinasce, P.4-pre torna col difetto per cui
  esisteva, e il pilota ha nome e strada.**

  *La macchina, prima di tutto.* In mattinata saturazione totale: finestre
  dell'IDE uccise dal gestore memoria di Windows (`0xE0000008`), commit a
  20,5/21,6 GB, disco C: a 4 GB liberi. Cause: i tre stack Supabase mai spenti
  dopo i collaudi (30 container, 3,2 GB dentro `vmmemWSL` mai restituiti),
  pagefile manuale sottodimensionato, disco pieno che gli impediva di crescere.
  Rimedi (fuori repo, registrati nella memoria di progetto): banchi spenti con
  backup, `~/.wslconfig` (WSL a 5 GB, `autoMemoryReclaim=gradual`), pagefile
  fisso 16/32 GB, ~148 GB liberati, riavvio. Dopo il riavvio: commit 11,3/31,9
  GB (tetto espandibile ~48), 6,7 GB di RAM libera. Regola di cantiere che ne
  nasce: **un solo stack Supabase acceso alla volta**.

  *P.4-pre consegnata (`744e76d`) e collaudata.* Il verde: D1 riverificato
  dall'operaio (junction vere, gate regia 5/5 prima e dopo); D3 firma vera
  accettata dai tre gate e segnaposto rifiutato, con `dataConfermaDa` letta dal
  testo; D4 porte 57621/57622 sul blocco 57620-57629 libero. Il rosso che vale
  il pacchetto: **dalla junction tutti e cinque i gate escono 0 muti** — causa
  misurata nell'epilogo prescritto dall'`hint` di `epiloghi-vivi`
  (`resolve(argv[1])` non scioglie la junction, `import.meta.url` è canonico:
  guardia falsa, `main()` mai eseguito). È la regressione di P.0-igiene su un
  canale che P.0-igiene non copriva, e l'operaio giustamente non l'ha corretta:
  trasversale, tocca la regola. Verifiche del direttore, tutte in proprio:
  perimetro del commit pulito (verbale + 5 `STATO.md`, zero codice — batterie
  invariate per costruzione); junction riprodotta nelle due direzioni su
  schema-forge e speed-demon col node di sistema; gate della regia VERDE 5/5;
  porte confermate libere. Tre annotazioni di forma sul verbale (§2a, §2d, §4:
  tabelle e frecce al posto di uscite incollate) — sostanza coperta dalle
  rimisure, annotate perché la prossima volta si incolli.

  *Decisioni.* **D12**: il difetto junction si chiude PRIMA di P.4a col
  pacchetto **P.0-igiene-2** (`prompts/P0-igiene2-epiloghi-junction.md`,
  Opus 5 · max); fino al suo collaudo i gate si lanciano per percorso assoluto.
  **D13**: pilota `fornodoro`, `C:\Users\Utente\Desktop\fornodoro`, blocco
  porte 57620-57629. Assetto D8 aggiornato: P.0-igiene-2 da sola → P.4a da
  sola (piano §2: P.4 è lavoro unico); **P.7c-ripresa-2 accodata** — dopo il
  difetto junction i suoi perimetri (stessi `scripts/`, stessi `STATO.md`) non
  sono più disgiunti da niente di ciò che corre.

  *Registro e istruttoria.* Ripresa P.4-pre committata (`1738ae1`, atto di
  registro D3); mandato **P.4a** scritto
  (`agenti/schema-forge/prompts/P4a-pilota.md`, Opus 5 · high) col brief D10,
  il prerequisito D12 in testa e le lezioni a monte da eseguire (seed
  `auth.users` sanato, punto 11 provato a mano, macchina a stati vincolata in
  INSERT). Su richiesta del committente, inventario dei **117 `.md`** del
  repo: **nessun deprecato** — i mandati sono registro (D3), i verbali sono
  memoria, gli unici file senza citazioni incrociate sono la doc interna degli
  snapshot esterni (per disegno, rotta n°5). Due rilievi d'istruttoria
  dichiarati e non eseguiti, decisione futura del direttore: nessuna regola
  della regia pretende **positivamente** l'epilogo (uno script che perde la
  guardia passa `epiloghi-vivi`; la contromisura per-skill è il terzo test di
  P.0-igiene-2); `code-maniac/scripts/tree.mjs:68` porta la guardia più
  fragile di tutte ma è snapshot esterno → proposta per finzidev, qui non si
  tocca.
- **2026-08-04 (notte) — la guardia D12 morde al primo uso, P.0-igiene-2 chiude
  la junction, e il collaudo del direttore apre la strada al pilota.**

  *P.4a si ferma da sola, ed è la notizia buona.* Lanciata per errore di
  sequenza prima della correzione, la chat operaia ha eseguito il prerequisito
  duro del mandato: controprova dalla junction → 0 muto → **fermo al passo 0**,
  nessun file creato, nessuna toppa locale («toccarne uno solo qui produrrebbe
  proprio il falso verde che D12 vuole togliere di mezzo»), rapporto al
  direttore, e niente verbale per un pacchetto mai partito. Comportamento
  esattamente conforme al mandato: la prima firma vera del repo non nascerà
  accanto a un gate che non sa dire di no.

  *P.0-igiene-2 consegnata e collaudata* (dettaglio nella sua riga). Le cose
  da ricordare: i **gusci di audit** erano muti anche loro dalla junction —
  `admin-audit` dichiarava «nessun bloccante» senza aver letto un file, il
  travestimento peggiore; `rmSync` ricorsivo su cartella con junction rimuove
  la junction e **non il bersaglio** — misurato *prima* di scriverlo in un
  test, perché sbagliarlo cancellava il sorgente di una skill; Node
  **assolutizza da sé `argv[1]`**, quindi il difetto era solo la junction e la
  proposta a finzidev è stata corretta prima di denunciare un buco
  inesistente. Il collaudo del direttore ha rilanciato tutto in proprio:
  dieci uscite 2/2 canali, gusci parlanti, regia VERDE 5/5, batterie
  154/183/111/111/87/46 identiche alla consegna, epilogo letto = forma
  prescritta.

  *Le tre code, decise.* (1) La **regola positiva** di regia («ogni script di
  casa con un `main()` ha una guardia che lo chiami») resta non scritta:
  materia per una minuteria post-P.4 (rotta n°6) — il buco è documentato
  dalla suite stessa (`verifica-regia.test.mjs:98`, un `verify.mjs` di solo
  commento chiude verde) e la copertura per-skill del terzo test basta al
  filo. (2) La **casa dei test di `vetrina-audit`** resta `verify.test.mjs`
  finché regge il vincolo Node 20; il trasloco in un `vetrina-audit.test.mjs`
  elencato (+ `package.json` + la frase «i tre file» di `SKILL.md`) entra
  nella prossima minuteria della skill. (3) La **proposta a finzidev** su
  `code-maniac/scripts/tree.mjs:68` è pronta nel verbale §1: l'inoltro è un
  atto del committente, fuori dal repo. — **P.4a ha via libera**: D12
  soddisfatta, il mandato si rilancia tal quale.
- **2026-08-05 — il primo anello si chiude collaudato, D13 impara le porte di
  Windows, e il secondo anello ha il mandato.**

  *P.4a consegnata.* Quattro commit nel pilota, albero pulito: nove tabelle in
  quattro migrazioni, 55 asserzioni pgTAP, tipi, ERD, handoff 07 senza
  segnaposto. Lo Specchio porta la **prima firma vera della storia del repo**
  (`Confermato da: Alberto Marocco (committente) il 2026-08-04`) e le cinque
  risposte strutturali (anonimo · non modificabile · categorie piatte ·
  `non_ritirato` · carrello nel browser) sono **nello schema**, non solo nel
  documento. Il verbale `agenti/schema-forge/PILOTA-2026-08-04.md` è il
  migliore del cantiere finora: uscite incollate, attriti dichiarati, D4 del
  ciclo di vita («che succede a un ordine mai ritirato?») nata dal disegno e
  non dal brief — lo Specchio che fa il suo mestiere.

  *L'attrito che vale il pacchetto: le porte di D13 non erano libere.* WinNAT
  riserva 57464-57963 e il blocco 5762x ci stava dentro; peggio, l'intervallo
  dinamico è 49152-65535, quindi **tutte** le porte dei quattro progetti ci
  abitano e i tre banchi hanno funzionato per fortuna. La misura di P.4-pre
  non era sbagliata: era la domanda — `Test-NetConnection` guarda chi ascolta,
  non chi ha prenotato. **D13 corretta e ratificata** (7620-7629, app 3621,
  porte nuove sotto 49152, banchi fermi finché non falliscono un avvio).

  *Il tribunale su uno schema verde: 11 risultati, 0 fabbricazioni.* Il
  peggiore (IAM-1): il titolare poteva togliersi l'autorità da solo e, con un
  solo titolare, il gestionale non si riapriva più. Cinque chiusi in una
  quarta migrazione, tre a debito dichiarato (tetto ai tentativi sulle RPC —
  misurato: 30 ordini in 1,36 s tutti 200 —, anonimizzazione, privilegi
  dell'immagine). La riga del Verificatore che resta a registro: **i quattro
  strumenti statici del gate tacciono su tutti e undici.** In più un
  esemplare vivo della classe che nessun audit statico vede: un **test che
  restava verde con la difesa rimossa** (la policy filtrava già tutto per
  quell'attore) — rinominato e affiancato da un test che isola davvero il
  grant per colonna. La classe va a registro come materia futura: per vederla
  serve sabotare ed eseguire.

  *Collaudo del direttore.* Docker spento al mio arrivo (stack fermato dopo la
  consegna): riacceso, stack ripreso dai volumi, gate **rilanciato in proprio
  dalla junction — VERDE 9/9, uscita 0, identico al verbale riga per riga**
  (stesso WARN advisors, stesse sei `issue` dichiarate dell'audit RLS).
  Commit di regia `8b5b8aa` nel perimetro (verbale + STATO), firma verificata
  nell'handoff §2, albero del pilota pulito. **P.4a chiusa.**

  *Code smistate.* **Punto 11 approvato**: la premessa che mancava è ora
  misurata su un progetto vero con trigger di dominio e macchina a stati —
  l'implementazione (riesecuzione del seed a caldo dentro `passoReset`) entra
  nella **minuteria schema-forge post-P.4**, insieme alle due righe di
  reference nate dal pilota (`modellazione.md` §Seed: gli `update` del seed
  si guardano dallo stato di partenza; `migrazioni.md`: l'immutabilità dentro
  `forge` — la lettura dell'operaio, «prima dell'handoff si corregge, dopo si
  aggiunge», è promossa a regola da scrivere) e al template di seed
  `auth.users` ancora difettoso. **Mandato P.4b emesso**
  (`agenti/vetrina-crafter/prompts/P4b-pilota.md`, Opus 5 · high): doppio
  STOP di Alberto su `docs/vetrina.md`, app di produzione su 3621, le lezioni
  di P.4a dentro (porte sotto 49152 via `netsh`, build Turbopack
  intermittente, errori delle RPC da gestire con garbo). Stack del pilota
  lasciato acceso: P.4b lo trova pronto.
- **2026-08-05 (pomeriggio) — il secondo anello si chiude collaudato, e il
  terzo ha il mandato.**

  *P.4b consegnata* (dettaglio nella sua riga). Le cose da registro: i
  **recapiti** — che non esistevano in nessuna tabella — sono diventati tre
  slot di `contenuti_sito` con le righe di seed autorizzate in corsa dal
  direttore, e il gate di schema-forge è rimasto verde sopra; il **percorso di
  scrittura pubblico è stato provato vivo**, non solo compilato; il tribunale
  ha insegnato due cose che valgono più delle sei correzioni — *il rimedio più
  ovvio era un placebo* (ritirato dopo che la red team ha ricostruito l'app
  per provarlo: la lista `allowedOrigins` non è mai consultata nel ramo
  dell'attacco) e *una causa su sei era sbagliata* nonostante collegio,
  verificatore e red team l'avessero convalidata — se n'è accorto solo il
  rimisurare dopo la correzione. Convalidato non è misurato.

  *Aperto verso monte, non chiuso qui:* `crea_ordine(ritiro_at timestamptz)`
  casta l'argomento prima che il corpo della funzione giri — l'errore nativo
  esce al client, proprio la classe che l'indurimento del 07 dichiarava
  chiusa, sull'unico argomento non-`text`. Mitigato lato sito, **debito n°11
  del pilota**: vuole un `evolve` di schema-forge — in coda alla minuteria,
  salvo che P.4d non lo renda urgente. Due righe negli `STATO.md` (vetrina:
  manca il gettone `funzione:` e il gate pretende una colonna di
  pubblicazione anche dove il dominio non ha bozze; schema-forge: la regola
  «valida prima del cast» si ferma ai `text`, e pgTAP non può vedere il
  difetto perché chiama da dentro il database) → minuterie post-P.4.

  *Collaudo del direttore.* Primo rilancio della vetrina **ROSSO 1 fallito /
  4 mancanti**: l'app su 3621 era morta con la shell dell'operaio — le quattro
  mancanze avevano quella sola radice, e il FAIL sul contratto d'uscita era la
  conseguenza. Fatto d'ambiente, non del pacchetto, e lezione operativa che
  resta: **il gate della vetrina misura un'app viva** — a ogni riconsegna
  l'app si riaccende (`npm run start -- -p 3621`, Node 24) prima di
  rimisurare. Riaccesa: gate **VERDE 10/10 rilanciato in proprio**
  (`BUILD_ID r5b7BNi6MSSP-HOd_7EFg`, nessun indizio di dev server, psql e
  impersonazione anonima verdi), **schema-forge riconfermato 9/9**, firma del
  2026-08-05 e handoff 08 senza segnaposto verificati, perimetro dei commit
  conforme (pilota 3 commit + regia `a7cbf48` con solo verbale e STATO).
  **P.4b chiusa.**

  *Mandato P.4c emesso* (`agenti/gestionale-crafter/prompts/P4c-pilota.md`,
  Opus 5 · high): il backoffice del Forno d'Oro — schermata cucina sulla
  macchina a stati, menu con i due interruttori distinti
  (`is_pubblicata`/`is_disponibile`, il fatto che l'handoff 08 cita dal 07),
  contenuti e orari, personale sotto le tre difese di IAM-1. **Terza firma di
  Alberto** sullo Specchio del gestionale: la parte «chi può promuovere chi»
  non è delegabile. A fine corsa i tre gate riverdi: 7/7, 10/10 sull'app
  ricostruita, 9/9.
- **2026-08-05 (sera) — il terzo anello si chiude collaudato, il tribunale
  smentisce una riga firmata, e la catena passa in autonomia.**

  *P.4c consegnata e collaudata* (dettaglio nella sua riga). Tre gate
  rilanciati dal direttore sulla stessa build: **7/7 · 10/10 · 9/9**. Il
  gestionale è **senza JavaScript** — scelta dell'operaio, e la conseguenza
  l'ha pagata lui: `curl` ha potuto attaccare le sue stesse azioni, che è
  anche il motivo per cui il tribunale ha trovato qualcosa. Il **limite noto
  del gate** non è stato aggirato ma **misurato a mano** (11 richieste, due
  sessioni vere, 5 rotte su 5 respinte alla cucina): è il modo giusto di
  trattare un difetto dichiarato.

  *La riga firmata che era falsa.* Lo Specchio vendeva la decisione D1(a) —
  niente bottone «promuovi» — con la motivazione «la superficie da cui si
  cambiano i poteri non è raggiungibile da un browser». Il Verificatore l'ha
  smentita su HTTP vero: `PATCH /rest/v1/personale` col token del titolare →
  **200, due titolari in tabella**; e la metà che nessuno aveva guardato,
  `grant insert` di tabella intera, cioè un titolare **crea** un titolare
  nuovo. *Non costruire il bottone ha tolto l'affordance, non la capacità.*
  La correzione è scritta **sopra** la firma, non sotto — e la decisione è
  **D15**: strada (b), `revoke update (ruolo)` + `cambia_ruolo()`, eseguita
  dopo P.4e nel pacchetto **P.4f** insieme al n°11. Riaprire lo schema adesso
  invaliderebbe le misure dei due anelli che restano (lezione D6).

  *La lezione dell'operaio, che vale più delle cinque correzioni.* Tre rilievi
  su cinque avevano la stessa forma e non se n'era accorto scrivendo tre
  pagine di Specchio: il bottone non costruito, la pagina non fatta, la
  colonna non selezionata — **sembravano decisioni di sicurezza, erano
  decisioni di interfaccia**. *Ciò che il gestionale non mostra non è ciò che
  il database non concede.* È la proposta n°9 nel suo `STATO.md`. E la
  conferma indipendente si ripete per la terza volta: semgrep (210 regole),
  `tsc`, ESLint e `npm audit` **tutti e quattro verdi**, ciechi su tutti e
  cinque i rilievi — che vivono nello strato di grant, policy e transazioni.

  *Cambio di regime: **D14**.* Su richiesta del committente la catena procede
  **senza fermarsi a lui**: gli operai decidono, i dati finti li scelgono
  loro, e i due contratti che restano si firmano **per delega dichiarata**.
  Il prezzo è scritto in D14 e non si nasconde: una firma delegata **non
  chiude** il motivo «la firma è nostra» per flow-sentinel e speed-demon —
  P.4 lo chiuderà per **una** skill su tre, non per tre. I due contratti
  restano pronti alla controfirma di Alberto: due righe e un rilancio di gate.
  **Mandato P.4d emesso** (`agenti/flow-sentinel/prompts/P4d-pilota.md`).
- **2026-08-05 (notte) — il quarto anello si chiude collaudato, e il difetto
  della batteria lo trova il gate di un altro agente.**

  *P.4d consegnata e collaudata* (dettaglio nella sua riga). Tredici flussi,
  22 test contro l'app viva, gate **VERDE 7/7** rilanciato dal direttore
  insieme agli altri tre (7/7 · 10/10 · 9/9) sulla build
  `IZYYrgi0xJcQUjhk_uM3B`. La mappa è stata **camminata** (20 rotte, 7 azioni)
  e solo dopo confrontata coi tre handoff: quattro flussi in più, zero in
  meno — cioè il contratto in cui l'omissione è invisibile al gate è stato
  trattato come tale.

  *La cosa più importante del pacchetto, e non l'ha trovata la batteria.*
  Rilanciando i gate a monte, **la vetrina è uscita ROSSA**: una spec
  rimetteva a posto il testo **solo nel database**, ma `/chi-siamo` è in cache
  ISR 300 s e si rinfresca solo perché l'azione del gestionale chiama
  `revalidatePath`. Per cinque minuti il sito serviva «Prova E2E» — e
  **speed-demon avrebbe misurato quella pagina**. Tre lezioni, tutte scomode:
  la batteria si dichiarava pulita e non lo era (*rimettere a posto il dato
  non è rimettere a posto ciò che dipende dal dato*); a trovarlo è stato il
  gate di un **altro** agente, cioè la regola dei guardiani ha pagato al primo
  giro; la correzione fa passare il ripristino **dalla stessa porta del
  cambiamento**. Poi vetrina VERDE 10/10.

  *Il tribunale sulla batteria: 21 rilievi, 9 chiusi, 1 refutato con una
  build.* BLIND-1 sosteneva che una spec non provasse la guardia dell'azione
  ma solo quella della pagina: ragionamento solido e **falso** — sabotata la
  guardia, la spec **diventa rossa**, perché in App Router l'azione gira prima
  del re-render e la sua uscita vince (e sotto la guardia c'è comunque il
  database, che risponde `42501`). *Il modo per chiudere una buona ipotesi non
  era discuterne.* Le due righe che restano: `tsc` ed ESLint puliti e ciechi su
  tutti e nove i difetti — che vivono nello strato di «cosa dimostra questa
  asserzione»; e **sette dei nove avevano la stessa forma**, il contratto
  prometteva più di quanto la spec asserisse. Da cui la frase da tenere: *il
  gate verde di questo anello dice che la batteria è ben formata, non che
  sappia fallire* — e un anello che scrive sia il contratto sia le spec **non
  può essere il proprio revisore**.

  *Decisioni.* **D16**: il `site_url` alla 3000 mentre l'app vive sulla 3621
  (debito n°26) si chiude in apertura di P.4e, e la lezione generale — ogni
  gate con `--url` deve leggere l'indirizzo dal contratto, come fa la vetrina
  — va in minuteria: è il precedente del 2026-07-30 in forma nuova, e riguarda
  **tre** skill. Il **debito n°27** (due account col seed a password nota)
  diventa un **prerequisito dichiarato di P.5**: blocca il deploy. Debito del
  pilota a **30 voci**. **Mandato P.4e emesso**
  (`agenti/speed-demon/prompts/P4e-pilota.md`): l'ultimo anello del filo.
- **2026-08-06 — P.4 È CHIUSA. Il filo completo esiste, e il verbale di catena
  dice anche cosa non ha chiuso.**

  *P.4e consegnata e collaudata* (dettaglio nella sua riga). Il pacchetto più
  onesto della catena: **nessuna ottimizzazione di velocità applicata**, e i
  numeri che lo giustificano — il rumore di fondo misurato (1 punto)
  coincideva col margine disponibile (1 punto). La terza legge della skill
  («un solo giro non è una misura») ha funzionato **al contrario di come ci si
  aspetta**: non è servita a non credere a un guadagno, è servita a **non
  inventarne uno** attribuendo il rumore al codice di quattro agenti. Quello
  che ha fatto: favicon (era un `404` su ogni pagina), canonical, sitemap,
  robots, `noindex` sull'ordine di una persona.

  *Il mio collaudo, e perché il rosso vale.* Al primo lancio speed-demon mi è
  uscito **ROSSO, 5 bloccanti**. Causa riprodotta prima di attribuirla:
  Lighthouse 13.4.1 chiama `URL.parse` nell'audit `canonical`, API di Node 22;
  sul node di sistema (20.12.2) l'audit va in errore, la categoria SEO resta
  senza punteggio e **il gate blocca invece di fingere**. Col Node 24: VERDE
  7/7, `seo 100`. L'operaio l'aveva già misurato e dichiarato in quattro
  posti: il mio rosso è la **conferma indipendente**, non una scoperta. E
  *MANCANTE ≠ PASS* ha retto anche quando la verifica mancante era colpa
  dell'interprete.

  *Verbale di catena: `PILOTA-2026-08-06.md`* — scritto dal direttore, è il
  criterio di accettazione di P.4. Dice tre cose. **(1)** La catena regge:
  cinque gate verdi rilanciati in proprio sulla stessa build, e gli handoff
  **consumati davvero** — il fatto che il 12 ha passato al 13 ha impedito di
  scrivere un test verde e falso. **(2)** P.4 chiude **una** delle tre frasi
  «non usabile su un progetto cliente», non tre: solo vetrina-crafter ha una
  firma vera sul suo contratto (riga del suo `STATO.md` aggiornata dal
  direttore); flow-sentinel e speed-demon aspettano la controfirma. È il
  prezzo di D14, ed era scritto prima di pagarlo. **(3)** La forma ricorrente
  dei difetti di questa catena non è il difetto non trovato ma **la causa
  attribuita male a un difetto trovato** — quattro volte su cinque anelli, e
  ogni volta l'ha scoperta il rimisurare dopo la correzione. *Convalidato non
  è misurato.*

  *Cosa resta.* **P.4f** (`evolve`: n°11 e n°22) prima di P.5; due bloccanti
  di pubblicazione dichiarati (n°27 password note nel seed, **n°32** il sito
  non si costruisce col node di sistema — e la riga «Next 16 pretende
  `^20.19 || >=22`» ripetuta in due handoff era **falsa**: il vincolo è di
  `@supabase/realtime-js`); le minuterie post-P.4 accumulate (schema-forge,
  vetrina, speed-demon, regia); `tsconfig.tsbuildinfo` tracciato da git nel
  pilota; e **P.7c-ripresa-2**, che da qui in poi non è più bloccata da
  nulla.

- **2026-08-06 (pomeriggio)** — **P.4f consegnata e collaudata**, e il cantiere
  passa a **quattro chat in parallelo**: il committente ha una scadenza (sabato
  2026-08-08) e la possibilità di tenerne vive più d'una. Decisione **D17**, che
  scrive il protocollo invece di lasciarlo all'improvvisazione.

  *P.4f — `evolve` su un progetto vero, il primo.* I due debiti verso monte
  chiusi con la misura (n°11: errori nativi `22007/22008/22023` → `P0001` con
  messaggi nostri; n°22: `PATCH` del ruolo e `POST` di un titolare nuovo, **403
  42501** tutti e due, col legittimo che passa ancora). pgTAP 55 → 82, tredici
  sabotaggi tutti rossi. **Cinque gate rilanciati dal direttore sulla build
  `mRBe6eqMjjl0W5m2tfJ24`: 9/9 · 7/7 · 10/10 · 7/7 (22 test) · 7/7 (`seo 100`
  su 5 pagine).** La catena regge una modifica dello schema costruita a valle:
  è la domanda che P.4f esisteva per porre.

  *La lezione del pacchetto non è quella che il mandato prevedeva.* Il mandato
  chiedeva che l'invariante **IAM-1** «sopravvivesse»: **non esisteva**. Era un
  ragionamento seriale dichiarato come invariante il 2026-08-04, e due titolari
  concorrenti lo portano a zero senza un errore. La misura che lo dimostra è la
  cosa più utile uscita da questa giornata — *col solo conteggio 3 coppie su 4
  rompono l'invariante; col lucchetto, tutte e 4 lo rispettano* —, e la frase
  che la accompagna vale per tutta la pipeline: **un limite dello strumento non
  è una proprietà del codice.** «Nessun test potrebbe farlo diventare rosso» era
  un'affermazione su pgTAP, che gira in una sessione, scambiata per
  un'affermazione sul codice. Da qui il **n°36**: la prova a due sessioni non
  gira in nessun gate, ed è la lacuna più grande trovata finora nella skill.

  *Un rilievo mio, nato da un rosso.* Speed-demon mi è uscito ROSSO con la
  stessa firma di ieri (`seo` senza misura, le altre tre categorie misurate) e
  la causa **non** era quella di ieri: il gate lancia Lighthouse con **`npx`
  preso dal `PATH`** (`agenti/speed-demon/scripts/verify.mjs:416`), quindi
  *avviare* `verify.mjs` con l'eseguibile del Node 24 non cambia niente — è il
  `PATH` a decidere. Col `PATH` giusto: VERDE 7/7. La scorciatoia **«lancialo
  col Node 24»**, che il direttore stesso aveva scritto nel verbale di catena,
  è imprecisa; la forma corretta (`export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`)
  era già nel mandato P.4e, ed è quella che vale. Corretta nei tre mandati
  nuovi. È di nuovo la forma di P.4: *la causa attribuita male a un difetto
  trovato* — stavolta il difetto era il mio.

  *I tre mandati nuovi* (commit `8905fa1`), perimetri disgiunti dichiarati:
  **P.6** site-doctor e **P.5** launchpad, **P0+P1 uniti** (D17) con P2 sempre
  in chat vergine; **P.4g**, i due bloccanti del deploy nel pilota. Le due skill
  nuove hanno lo stesso criterio di accettazione, ed è falsificabile: **il loro
  gate, lanciato sul pilota, deve uscire ROSSO per motivi veri che i cinque gate
  esistenti non vedono.** Un gate nuovo che esce verde su un sito senza
  informativa privacy, o su un deploy con `password123` in un file committato,
  non ha provato niente: ha imparato a tacere. Il banco è il pilota e non un
  banco loro — un banco costruito dalla stessa chat che scrive il gate è un
  banco che il gate sa già superare.

  *E una cosa che launchpad non farà:* pubblicare. Nessun account, nessun
  dominio, nessun DNS, nemmeno un deploy gratuito di prova. È l'unico mestiere
  della pipeline che è irreversibile e costa soldi: resta al checkpoint umano
  (`DECISIONI.md` §6), e il primo deploy vero è il collaudo di P.5.

- **2026-08-06 (sera)** — **le quattro chat tornano tutte e quattro, e il
  parallelismo produce la sua prima scoperta che nessuna delle quattro poteva
  fare da sola.** Consegnate insieme: **P.7c-ripresa-2** (1h41), **P.6**
  site-doctor P0+P1, **P.5** launchpad P0+P1 (28 min), **P.4g** (2h08). D17 ha
  retto: perimetri disgiunti rispettati da tutte e quattro, `git add` espliciti,
  nessuno ha toccato `CANTIERE.md`, un solo stack Supabase acceso per tutto il
  pomeriggio. La verifica del direttore, tutta rilanciata in proprio:

  | cosa | misura |
  |---|---|
  | gate della regia | **VERDE 5/5** |
  | sei batterie | site-doctor **144** · launchpad **105** · schema-forge **156** · gestionale **111** · flussi **111** · speed-demon **87** — zero falliti |
  | cinque gate sul pilota, build `vhj8fi1hxQrFTJFWHKPlb` | **9/9 · 7/7 · 10/10 · 7/7** (13 spec, 22 test) **· 7/7** (`seo 100±0` su cinque pagine) |
  | gate di site-doctor sul pilota | **ROSSO** 4 falliti + 3 mancanti su 9 — criterio soddisfatto |
  | gate di launchpad sul pilota | **ROSSO** 4 falliti + 3 mancanti su 9 — criterio soddisfatto |
  | perimetri dei commit | puliti: fuori dalle due skill nuove solo referto, `STATO.md`, `README.md`, `installa-skill.ps1`, la correzione `audit-lib` e il verbale di P.4g |

  *Un solo scarto di forma, e me lo prendo io.* La batteria di launchpad la
  prima volta ha detto **18** invece di 105: avevo lanciato `node --test` da una
  directory sbagliata mentre giravano altre chiamate in parallelo. Rimisurata dal
  posto giusto: **105/105**. Un numero che non torna si rimisura prima di
  scriverlo — vale anche quando a scriverlo è chi verifica gli altri.

  **La scoperta.** Tre documenti scritti nello stesso pomeriggio da tre chat che
  non si vedevano, letti insieme, dicono una cosa che nessuno dei tre dice da
  solo. L'handoff `14` di P.4g ha nella **stessa tabella** «n°27 chiuso» e «n°44
  aperto»; il registro, alla voce n°44, misura che su una **produzione appena
  creata** i due account con `password123` **entrano davvero** (riprodotto in
  transazione annullata: `INSERT 0 2`, e la password committata li apre); il gate
  di launchpad, che la prosa non sa leggerla, blocca sul file tracciato e sulla
  storia. Quello che P.4g ha chiuso — il percorso di produzione documentato — è
  chiuso, misurato, e le misure reggono. Il pericolo è sopravvissuto sotto un
  altro numero. **Una voce che cambia numero senza cambiare rischio è
  contabilità, non una correzione**: decisione **D18 §1**.

  Non è un rimprovero a P.4g, ed è importante dirlo: n°44 e n°45 li ha trovati il
  **suo** tribunale, su cose che P.4g aveva appena scritto, e li ha lasciati alla
  direzione perché la scelta tocca il contratto di un gate. Ha fatto la cosa
  giusta. È il ruolo del direttore che si vede qui: è l'unico che legge
  l'handoff di una chat, il registro di un'altra e il gate di una terza nello
  stesso pomeriggio.

  **La decisione che ne segue** (D18 §2): sulla forcella che P.4g ha lasciato —
  **(a)** il seed di sviluppo esce da `sql_paths`, **(b)** la difesa è la
  procedura scritta — vince **(a)**, perché una difesa di prosa non ferma un
  dito e la costituzione mette la sicurezza sopra la comodità. Ma prima si va a
  **cercare un discriminante fail-closed**: n°44 afferma che nessun segnale dentro
  Postgres distingue uno sviluppo appena resettato da una produzione appena
  creata, e ne ha provati morti **due**. Due candidati non sono una prova
  generale, e questa casa ha già imparato una volta questo mese che *un limite
  dello strumento non è una proprietà del mondo* — era la lezione di P.4f su
  pgTAP, e sotto c'era un write skew vero.

  **Le altre due cose che il collaudo ha trovato**, entrambe dai gate nuovi e
  non da me: l'handoff `14` non ha **nessuna riga `Gate:`** leggibile (gli altri
  cinque ce l'hanno; confermato col grep) — un pacchetto trasversale ha scritto
  un handoff che il contratto a valle non sa leggere; e **quattro handoff su
  cinque sono più vecchi dell'ultimo commit di codice**, cioè i certificati ci
  sono e sono scaduti. Il secondo è il costo dichiarato del parallelismo, non un
  difetto di nessuno: si chiude rilanciando i gate e ridatando le righe.

  **Emessa la seconda ondata**, di nuovo quattro chat (tabella sopra): **P.4h**
  sul pilota, **P.5-P2** e **P.6-P2** avversari in chat vergine come D17 impone,
  **P.7d** sui quattordici del referto. I perimetri restano disgiunti; la
  novità di questa ondata è che **due chat si toccano di proposito** — P.7d
  irrigidisce i quattro gate mentre P.4h li rilancia sul pilota. Non è una
  collisione da evitare: **D18 §3** la dichiara e la governa (ogni rilancio cita
  il commit della regia con cui è stato fatto, e un rosso nuovo da un gate più
  severo si segnala invece di nasconderlo). Un gate che comincia a rifiutare un
  progetto che prima accettava è il sistema che funziona.

  Restano fuori dall'ondata, e sono per Alberto: **P.7b** (aspetta l'edit del
  docx) e la **controfirma** di `docs/flussi-critici.md` e `docs/performance.md`,
  cinque minuti che chiudono il motivo «la firma è nostra» per le ultime due
  skill su tre.

- **2026-08-06 (notte) — la terza ondata, e i sette gate contro il pilota per la
  prima volta insieme.** Tornate tutte e quattro le chat della seconda ondata.
  Verificate in proprio, senza fidarsi di nessun resoconto.

  **Le misure.** Gate della regia **VERDE 5/5**. Sette batterie rilanciate:
  schema-forge **186** · gestionale **173** · flow-sentinel **131** ·
  speed-demon **103** · launchpad **148** · site-doctor **168** · vetrina
  **183** — 1092 test, zero falliti. Poi la cosa che nessuna delle quattro chat
  poteva fare, perché ognuna vedeva un pezzo: **tutti e sette i gate contro il
  pilota vero, alla regia finale `d147f52`**, app viva sulla 3621 e stack acceso.
  schema **VERDE 9/9** · vetrina **VERDE 10/10** · flussi **VERDE 7/7**, 22 test,
  e il passo che adesso stampa **«13 flussi critici su 13 percorsi davvero dal
  browser»** coi nomi — C2 chiuso e provato su un progetto vero, non su una
  fixture · speed-demon **VERDE 7/7** con `seo 100±0` su cinque pagine ·
  launchpad **ROSSO** 4 falliti · site-doctor **ROSSO** 4 falliti + 3 mancanti ·
  gestionale **ROSSO**, e quel rosso è il pezzo grosso di stanotte.

  **Un errore mio, misurato prima di scriverlo.** Le prime due batterie hanno
  taciuto: il node del PATH è **v20.12.2** e i quattro `package.json` storici
  dichiarano i test con un **glob**, che vuole 21+. Rilanciate con
  `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` (v24.18.1) hanno
  taciuto di nuovo — perché sotto Node 24 il reporter stampa `ℹ tests N` e il mio
  grep cercava `# tests N`. Due cause diverse per lo stesso silenzio, e nessuna
  delle due era «zero test».

  **n°50 — la terza volta della stessa forma, in due giorni.** Riprodotto in
  proprio: il gate del gestionale dichiara `MANC tipi del progetto` sul
  `tsconfig.json` del pilota, che è **JSON valido** (`JSON.parse` sul file vero
  riesce; 655 byte). A rompersi è lo spogliatore JSONC del gate: `"@/*"` — l'alias
  che `create-next-app` scrive in ogni progetto Next — viene letto come apertura
  di commento, e il primo `*/` che lo chiude sta dentro `"**/*.ts"` di `include`.
  Il gate è **rosso su ogni progetto che questa casa genera**, ed è nato ieri,
  dentro il pacchetto che chiudeva i quattordici del tribunale. Sopra il codice
  c'è scritto che la tolleranza JSONC serve per strumenti *diversi* da
  `create-next-app`: **una tolleranza aggiunta per un caso che non capita ha
  rotto quello che capita sempre.** E messo in fila con gli altri due (`<!--`
  dentro un attributo; `</script>` letto come apertura) dà la forma che questa
  casa deve smettere di ripetere: **un parser scritto a mano che non rispetta il
  contesto che lo racchiude**, con la batteria verde ogni volta perché la fixture
  era modellata sull'implementazione invece che sull'input vero. Decisione
  **D22**, e con essa l'audit di tutti gli scanner a mano delle quattro skill.

  **Il commit che attraversa due perimetri.** Audit di tutti i 42 commit
  dell'ondata: quattro toccano più skill e sono di P.7d, che le ha tutte e
  quattro per mandato. Uno solo è un'anomalia vera — `ab978cd` — e la sequenza
  dice il meccanismo in cinquantadue secondi: `03a3bac` (17:01:52) è di
  launchpad; `ab978cd` (17:02:44) è di **site-doctor** e si porta via due file di
  launchpad già messi in scena; `670730c` (17:03:00) è di nuovo launchpad, sugli
  stessi due file. Niente perso, ma un commento scritto da launchpad sul proprio
  gate vive, nella storia, dentro un commit che parla della favicon. Il collaudo
  di site-doctor aveva scritto in buona fede che `git add` per nome l'aveva
  salvato due volte: è vero, e **protegge da ciò che un'altra chat ha modificato,
  non da ciò che un'altra chat ha messo in scena**. L'indice è stato condiviso
  per tutto il tempo. Decisione **D19**: `git commit -F - -- <percorsi>`.

  **I numeri contestati, verificati uno per uno.** Le sette deleghe vuote sono
  confermate col grep (`contrast`, `og:`, `favicon` **zero occorrenze** in tutto
  speed-demon; `sitemap` e `ld+json` solo dentro `references/seo.md`, cioè
  documentazione che insegna e non un gate che misura) → **D21**. La guardia del
  seed regge in proprio: dopo il gate di schema-forge `auth.users=0`, `psql -f` a
  mano è rifiutato `P0001` senza scrivere, `npm run seed-sviluppo` restituisce i
  numeri esatti dell'handoff `15`. E **un'accusa del collaudo di launchpad è
  sbagliata**: «105 test erano 104» non regge — misurata in un worktree separato
  al commit di consegna vero (`9d8fb73`) la batteria dà **105/105**. Il numero
  scritto nel registro era giusto. Vale la pena dirlo: l'audit delle affermazioni
  è la cosa più preziosa che fa un collaudo, ed è anche quella che va riverificata
  come tutte le altre.

  **Il difetto che ho trovato da solo, e che vale una riga.** Il blocco di
  launchpad sui certificati scaduti stampa `.slice(0, 10)` sui due lati e dice
  *«più vecchio del codice che certifica (handoff 2026-08-06 · ultimo commit di
  codice 2026-08-06)»*. La **regola è giusta** — confronta istanti, e `0a48fba` ha
  toccato `src/` dopo che P.4h aveva ridatato i certificati. È il messaggio che
  mente: un blocco che sembra un errore del gate è un blocco che qualcuno
  scavalca. Da cui anche la regola operativa: **ridatare i certificati è
  l'ultimo atto di un pacchetto**, dopo l'ultimo commit di codice — P.4h li ha
  ridatati e poi ha corretto il codice, e sono durati due ore.

  **Sei decisioni** (D19-D24) e **la terza ondata emessa**: P.7e (il parser e i
  trentuno), P.5-P3 (le tre decisioni eseguite), P.6-P3 (le voci che tornano a
  casa e la scadenza), P.4i (il pilota prende il suo certificato). Di nuovo
  quattro chat, di nuovo un solo stack, e di nuovo due chat che si toccano di
  proposito — il gate che legge la colonna del registro e il registro che la
  prende viaggiano insieme, governati da D18 §3.

  Restano per Alberto, invariate: **P.7b** e la **controfirma** dei due
  contratti. E una che è solo sua: **n°27 esce dalla storia prima del primo
  `push`** (D24), e nessun pacchetto può prenderla al posto suo.

- **2026-08-07 (notte) — la terza ondata collaudata in proprio, e la quarta
  emessa.** Tornate tutte e quattro le chat. Prima le misure, poi i resoconti.

  **Le misure.** Gate della regia **VERDE 5/5** a `6a0ac6d`. Sei batterie
  rilanciate: schema **228** · gestionale **230** · flussi **171** · speed-demon
  **147** · launchpad **162** · site-doctor **264** — **1202 test, zero
  falliti**, tutte sopra il pavimento del 2026-08-06 (vetrina 183 non
  rimisurata: l'ondata non la toccava). Poi i **sette gate sul pilota**, build
  `05cf644` = HEAD, app viva sulla 3621: schema 9/9 · vetrina 10/10 · gestionale
  **7/7** (n°50 chiuso: il gate legge il tsconfig vero del pilota) · flussi 7/7
  con **E2E 22/22 e 13 flussi su 13** · speed-demon **8/8** (l'ottavo passo è il
  contrasto di D21: legge l'audit `color-contrast`, 5 pagine, 0 insufficienti) ·
  site-doctor **VERDE, 1 n/a su 14** (premessa del n/a stampata) · launchpad
  **ROSSO 3** — segreti (n°27), runbook (di Alberto), handoff (di una
  pubblicazione mai avvenuta) — col registro letto per colonna: 59 voci, 9
  bloccanti, 0 mancanti. Il banco di launchpad **rigenerato da zero: VERDE
  9/9**. Con questo si chiudono anche il MANCANTE n°1 di P.7e (i quattro gate
  sul pilota dopo le correzioni) e quello che P.7e assegnava fuori dal proprio
  perimetro: `CLAUDE.md` fermo a «quattro gate, speed-demon 7 passi» — ora
  dichiara i sette, coi passi veri.

  **L'audit dei perimetri sui 42 commit**: P.7e 19 · P.6-P3 12 · P.5-P3 8 ·
  P.4i 3 (solo il suo verbale, come da mandato). Un solo commit fuori
  perimetro — `78df00c` di P.6-P3 su `README.md` di radice: contenuto giusto
  (la riga dei 14 passi), perimetro no, nessun file altrui coinvolto. Rilievo
  di forma, registrato qui.

  **Due rilievi della direzione.** (1) La build del banco di launchpad, da
  rigenerazione pulita seguendo **solo** l'elenco «Restano TRE passi», cade con
  `supabaseUrl is required` sul prerender di `/prenota`: le due `NEXT_PUBLIC_*`
  stanno nel runbook che il banco scrive, ma non nell'elenco stampato — una
  premessa non dichiarata nel punto in cui la si legge → P.7f. (2) La pagina
  `/privacy` del pilota è servita e collegata da ogni pagina ma **non è nel
  contratto firmato della vetrina**: il gate la segna `issue` e ha ragione —
  è una pagina che chiunque può aprire e che nessuno ha firmato. La firma su
  quel contratto non è delegabile: è una riga di Alberto.

  **Cosa ho sbagliato.** Il primo «exit=0» che ho letto dopo la build del banco
  era l'exit di `tail`, non di `npm`: la build era rossa e l'ho visto dal testo,
  ma il numero stampato era sbagliato — da lì in poi `PIPESTATUS`. E un `curl`
  lanciato quattro secondi dopo l'avvio del server del banco ha misurato
  `HTTP 000` su un server che un secondo dopo rispondeva 200: un mio errore di
  tempi, non un difetto del banco.

  **Decisione D25** (il banco di un collaudo entra in regia come script) e
  **quarta ondata emessa**: P.7f (le minuterie della consegna, Sonnet 5 · high)
  e P.6-P4 (il tribunale sulle ~900 righe e il banco tracciato, Opus 5 · high) —
  perimetri disgiunti, possono correre insieme.

  Restano per Alberto, e sono la strada del deploy: la **controfirma** di
  `docs/flussi-critici.md` e `docs/performance.md`; **`/privacy` nel contratto
  della vetrina** (`docs/vetrina.md`, aggiunta da riconfermare); la **firma del
  runbook** `docs/deploy.md` quando deciderà di pubblicare (P.3, di persona);
  **n°27 fuori dalla storia prima del primo `push`** (D24); **P.7b**. La terna
  d'ingresso (Prompt Smith in testa) resta «non ora» per rotta: se la scadenza
  di sabato la include, è una decisione del committente da chiedere, non da
  prendere qui.
- **2026-08-07 (giorno)** — **la quarta ondata collaudata in proprio, D26, e la quinta emessa.**

  **Le misure della direzione, rilanciate tutte.** Batteria launchpad **167/167**,
  batteria site-doctor **285/285**, gate della regia **VERDE 5/5**; il banco di D25
  **dal percorso tracciato**: VERDE **14/14, 0 n/a** al primo colpo, e la classe
  **SUP2** — il 404 sulla radice che il vecchio `vivo()` perdeva, fuori dalle otto
  della chat — **rossa sui passi giusti**. Perimetri: i 12 commit della quarta
  ondata stanno **tutti** nei perimetri dichiarati, zero sconfinamenti (la terza
  ondata ne aveva uno). Il semgrep di P.7f **non l'ho rimisurato in proprio**: la
  chat lo ha riprodotto con la tabella comando-per-comando (`--config=auto`,
  200 regole → gli stessi 2) e la accetto dichiarandolo.

  **Il pilota, e il quarto rosso chiuso.** L'app sulla 3621 è caduta **due volte**
  (durante P.7f, e di nuovo prima del mio giro): non è una mano — è il ciclo di
  vita dei processi, l'app muore con la shell della chat che l'ha avviata. La
  direzione ha ricostruito a HEAD `5043bd9` e riservito: launchpad da **ROSSO 4 a
  ROSSO 3** (il quarto era `impronta-artefatto`, cioè il commit di documentazione
  oltre la build — chiuso col rebuild; i tre restanti sono quelli giusti),
  site-doctor **VERDE, 1 n/a, «3 da guardare»**.

  **Due criteri impossibili nel mandato P.7f, ed erano miei.** Ho chiesto «3 da
  guardare → 2» a una chat il cui perimetro non contiene la riga che emette il
  rilievo, e «launchpad resti ROSSO 3» a una chat obbligata a committare nel
  pilota senza ricostruire. La chat si è fermata e ha scritto — il mandato era
  sbagliato, non l'esecuzione. Un criterio falsificabile va verificato **contro il
  perimetro** prima di emetterlo.

  **D26** — le voci del docx «in arrivo dagli amici» (Brief Smith, Prompt Smith,
  Fly UI; più i sei progetti fuori pipeline) **non si costruiscono in casa**: si
  aspetta la consegna esterna, parole del committente. La terna d'ingresso resta
  chiusa per decisione, non solo per rotta.

  **La lista di Alberto, ricalibrata sui fatti.** `docs/flussi-critici.md` (riga 3)
  e `docs/performance.md` (riga 223) del pilota sono **già firmati per delega**
  (D14): la controfirma di persona è un upgrade, non un blocco. I veri atti suoi:
  **`/privacy` nel contratto della vetrina** (`C:\Users\Utente\Desktop\fornodoro\docs\vetrina.md`,
  firma a riga 14 — aggiunta e rifirma, mai delegabile), la **firma del runbook**
  al momento del deploy (D20), **n°27 fuori dalla storia prima del primo `push`**
  (D24 — il lavoro tecnico lo coordina la direzione quando lui decide), P.7b.
  E d'ora in poi ogni resoconto chiude con «cosa devi fare tu» **solo se c'è un
  bloccante** — richiesta del committente, 2026-08-07.

  **Quinta ondata emessa**: P.6-P5 (dieci rilievi di §6.1 scelti dalla direzione,
  Opus 5 · high). **P.4j** — la riemissione del certificato del pilota col
  conteggio a «2 da guardare» e il numero stantio di `conformita.md:259` — si
  scrive al ritorno di P.6-P5, non prima: il certificato si riemette con la
  skill corretta, non con quella che sta per cambiare.
- **2026-08-07 (sera)** — **P.6-P5 collaudata in proprio e chiusa; P.4j emesso.**

  **Le misure della direzione**: batteria **308/308** · gate della regia
  **VERDE 5/5** · perimetro dei 3 commit pulito · banco dal percorso tracciato
  **VERDE 14/14, «2 da guardare»** · classe nuova **SUP5 rossa sui passi
  giusti** (il sito del perito che raccoglieva IBAN dietro un iframe e usciva
  VERDE) · **gate sul pilota: VERDE, 1 n/a, «2 da guardare»** — la voce
  «contrasti» è sparita dalle scoperte e restano le due vere. Non rilanciati in
  proprio: il giro completo 43/43, `giro-costruttore` 25/25+conforme e i
  cronometraggi — dichiarati dalla chat con le prove incollate, accettati.

  Il verbale `agenti/site-doctor/P6-P5-2026-08-07.md` è il migliore visto in
  questo cantiere: ogni chiusura porta la **porta diversa con la risposta**, i
  costi sono **rimisurati prima della consegna** (trovato e ridotto un ×4 suo),
  e i tre scarti dall'atteso sono dichiarati con la prova — compreso un errore
  d'aritmetica **nei nostri verbali storici** («32/10» dove la tabella dice
  31+11: il conteggio che nessuno rifà, di nuovo) e il banco del costruttore
  **pre-D21** che «verificato solo per lettura» non aveva visto: l'ha visto la
  prima esecuzione. Due conferme di metodo: *eseguire batte leggere*, e *il
  riassunto mente dove la tabella no*.

  Sul pilota il gate nuovo rende visibili due rilievi **veri e non bloccanti**
  già presenti: **`og:image` assente su 6 pagine** e **JSON-LD assente
  ovunque** — materia di P.4j, che li chiude o li dichiara nel registro con la
  colonna. **P.4j emesso** (`prompts/P4j-il-certificato-riemesso.md`,
  Opus 5 · high): riemettere il certificato con le misure nuove (2 scoperte,
  non «quattro» come dice la riga 259), decidere og:image e JSON-LD, e — la
  lezione del quarto rosso — **ricostruire e riservire dopo l'ultimo commit**,
  coi quattro gate rilanciati e dichiarati (launchpad atteso ROSSO 3, e solo 3).

  Il debito vivo di site-doctor scende a **45 dei 61**, nominati nel verbale
  §5; fra questi la P5-R3 «migliorata e rimisurata, non chiusa» e le porte
  dichiarate aperte. Si riprendono a ondate future, non tutti insieme.
- **2026-08-07 (notte) — P.4j collaudata, gli otto handoff riconfermati, e la
  catena del pilota è tutta verde tranne i tre rossi costituzionali.**

  **Il collaudo di P.4j**: perimetri puliti (4 commit nel pilota, 1 in regia sul
  solo verbale), le due decisioni rette da misure — JSON-LD chiuso leggendo
  l'HTML servito prima di scrivere, og:image **dichiarata apposta** perché
  chiuderla col solo `200` era un falso verde costruito. Il suo «ROSSO 4» era
  vero e onesto, e il quarto rosso era **il terzo errore della stessa classe nei
  miei mandati**: un criterio («launchpad ROSSO 3») incompatibile per costruzione
  con un altro obbligo dello stesso mandato («chiudi il rilievo nel codice») —
  ogni commit su `src/` fa scadere la freschezza di **tutti** gli handoff a
  monte. La classe ha ora un nome in memoria: prima di emettere un criterio,
  verificarlo **contro il perimetro e contro gli altri obblighi dello stesso
  mandato**.

  **Il lavoro della direzione a valle**: la catena intera rilanciata in proprio
  sulla build `8c87400` — schema **9/9** (db reset vero, seed riapplicato col
  node di sistema che è **salito a 24.19**: la trappola n°58 non è scattata) ·
  gestionale **7/7** · flussi **7/7, Playwright 22/22** · speed-demon **8/8 al
  primo giro** (nonostante **due** `next dev` estranei — MAPS-SCRAPER a 3,5 GB e
  AIsthenics — che restano accesi e non sono nostri: n°61 confermata come
  avvertenza) · vetrina **10/10** · site-doctor **VERDE, 1 n/a, «2 da
  guardare»**. Poi gli **otto handoff riconfermati** con un blocco in citazione
  ciascuno — il gate rilanciato, non riletto, e la firma per delega dichiarata —
  commit `33d787c`, rebuild, riservito, e **launchpad: ROSSO 3** — segreti
  (n°27, si chiude con D24 al primo push) · runbook (firma di Alberto) ·
  handoff di launchpad (esisterà quando una pubblicazione sarà avvenuta).
  Site-doctor riverificato anche sulla build servita finale: VERDE.

  **Igiene di macchina**: spenti due banchi orfani di P.6-P5 (porte 3894/3896);
  i quattro processi `chrome-devtools-mcp` sono MCP di altre finestre Claude e
  **non si toccano**; nessun chrome orfano di Lighthouse; RAM libera a 1,1 GB
  con i due dev server estranei accesi — se sabato servono misure pulite,
  conviene chiuderli (decisione di Alberto: sono suoi).

  **Lo stato della strada del deploy, a valle di tutto**: ogni gate della
  catena è verde sulla build servita; launchpad conta 9 bloccanti dichiarati e
  0 mancanti; i tre rossi che restano sono esattamente i tre atti fuori
  portata dei pacchetti — la settima pagina nel contratto della vetrina e la
  firma del runbook (di Alberto), la riscrittura della storia (D24, al
  momento del push, coordinata dalla direzione).
- **2026-08-07 (più tardi) — il «vai pure» del committente, incassato per quanto
  vale e non oltre.**

  Alberto, in chat: *«fornodoro è solo una prova no? se è quello il motivo che
  aspetti la mia conferma io ti dico vai pure»*. La direzione l'ha letto così:
  autorizzazione esplicita a procedere su ciò che aspettava la sua mano, **non**
  un deploy stanotte — che comunque non può avvenire: il gate esige la firma
  umana sul runbook (D20, la delega lì è `block` per costruzione) e un account
  sul provider esiste solo nel suo browser.

  **Fatto col «vai pure»:** la settima pagina `/privacy` è **nel contratto
  della vetrina** (`docs/vetrina.md`, sezione nella forma delle altre sei +
  riconferma di firma che cita la fonte dell'autorizzazione; la firma
  originaria del committente resta, ed è l'atto sulle prime sei) — commit
  `f2a4aa7`, rebuild, riservito, e **gate vetrina VERDE 10/10 senza più
  nessun issue**; site-doctor VERDE «2 da guardare»; launchpad **ROSSO 3**
  confermato sulla build finale. E un **bundle di backup dell'intera storia**
  del pilota sta sul Desktop
  (`fornodoro-storia-pre-riscrittura-2026-08-07.bundle`, verificato).

  **Non fatto, con la misura che lo motiva:** la riscrittura della storia
  (n°27). L'elenco completo del gate conta **6 posizioni**: cinque in storia
  **e una in HEAD** (`supabase/seed/90-solo-sviluppo.sql:226` — la password
  del seed di sviluppo, che è anche il contratto dei due account E2E).
  Riscrivere stasera solo la storia lascerebbe il gate rosso su HEAD e
  obbligherebbe a **riscrivere la storia due volte**. Si fa una volta sola,
  tutta: **P.4k emesso** (`prompts/P4k-la-storia-pulita-e-il-seed.md`,
  Opus 5 · high) — parte al «si pubblica», con le altre chat chiuse. Al suo
  ritorno launchpad sarà **ROSSO 2**, e i due rossi saranno i due atti umani:
  la firma del runbook e la pubblicazione stessa.
- **2026-08-07 (sera tardi) — P.4k collaudata: D24 onorata, e il gate di
  pubblicazione conta due rossi che sono due gesti.**

  Il committente ha chiuso le altre finestre e avviato P.4k. **Collaudo della
  direzione sulla storia riscritta**: launchpad **ROSSO 2 con `segreti` OK su
  HEAD e su tutta la storia** (era il rosso più vecchio del cantiere); schema
  **9/9** con reset vero; il **seed dalla GUC** riapplicato dalla direzione —
  funziona e il suo messaggio non stampa più nessuna password; flussi **7/7
  con Playwright 22/22** sui due account aperti con la fonte nuova;
  site-doctor **VERDE «2 da guardare»**; vetrina **10/10**;
  `.env.sviluppo.local` ignorato (`.gitignore:43`) e non tracciato; la firma
  del runbook è ancora il segnaposto — la deroga su `docs/deploy.md` è stata
  usata per la prosa e mai per la firma, come prescritto. Storia: HEAD
  `b462079` = BUILD_ID servito; i commit conservano data e messaggio (i miei
  `33d787c`/`f2a4aa7` vivono come `60441e5`/`d5403bc`); **gli hash pre-P.4k
  citati nei verbali di regia appartengono alla storia dei due bundle sul
  Desktop** — che contengono la credenziale, ed è il loro mestiere: non si
  consegnano a nessuno.

  I tre scarti della chat erano tutti giusti e misurati (il segnaposto che
  restava bloccante, l'ordine di `--replace-text`, l'`.example` che sarebbe
  stato un block «per dare il buon esempio»), e il primo rilancio ROSSO 3 —
  due handoff scaduti da `supabase/` in `PERCORSI_CODICE` — è stato curato
  **rilanciando i gate, non ridatando**.

  **La strada del deploy adesso è tutta di Alberto, e sono due gesti**: la
  firma su `docs/deploy.md` (riga 368, dopo averlo letto: è il documento che
  autorizza) e l'account sul provider dal suo browser. Poi P.3 — il primo
  deploy vero della catena — e l'ultimo rosso (l'handoff di launchpad) si
  chiude da solo con la pubblicazione avvenuta.
- **2026-08-07 (chiusura) — D27: il pilota in archivio, e il bilancio che il
  committente ha chiesto.**

  Alberto: *«era solo per testare i vari agenti… ci siamo riusciti almeno in
  quello? a me non interessa quel sito»*. **D27 presa**: fornodoro non si
  pubblica e non si elimina — si archivia. App e stack spenti dalla direzione
  (volumi preservati), P.3 sospeso a data da destinarsi, la firma del runbook
  decade come richiesta: **ROSSO 2 è lo stato finale corretto del gate di
  pubblicazione** — dice che nessun umano ha autorizzato l'uscita, ed è vero.

  **Il bilancio, in tre righe da registro.** La specializzazione è dimostrata:
  sette skill, ognuna con un gate che misura ciò che le altre non guardano,
  ~1.430 test di batteria, otto tribunali con 190 rilievi veri trovati quando
  ogni strumento statico era verde, e — la prova migliore — **gli agenti si
  sono controllati a vicenda** (il gate di conformità ha rifiutato un
  certificato appena emesso; launchpad ha tenuto il deploy rosso per una
  password in storia finché la storia non è stata riscritta). **Non è
  dimostrato ciò che nessun agente possiede**: il design — la vetrina compone,
  nessuno disegna (Fly UI è «dagli amici», D26) — l'ingresso
  (Brief/Prompt Smith, idem), e il deploy mai eseguito, fermo per scelta
  all'ultimo gradino. Il brutto di fornodoro non è un fallimento della
  catena: è il ruolo vacante della squadra, misurato.
