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
| P.4f | `evolve` di schema-forge sul pilota | in un solo pacchetto: **n°22** (`revoke update (ruolo)` + `cambia_ruolo()`, D15) e **n°11** (`crea_ordine` valida `ritiro_at` **prima** del cast). Expand-contract, analisi di impatto sui dati veri, STOP su ogni distruttivo | **P.4e chiusa** (fatto 2026-08-06) | i cinque gate **riverdi dopo l'evolve** — è la prova che la catena regge una modifica dello schema, cioè il caso reale di un cliente che cambia idea; `docs/handoff/07-schema-forge.md` aggiornato; le due voci di debito chiuse con la misura; **ogni asserzione nuova sabotata** (togli la difesa → il test diventa rosso) | **mandato scritto 2026-08-06** — `agenti/schema-forge/prompts/P4f-evolve-pilota.md` (Opus 5 · high); è anche il **collaudo di `evolve`**, l'unico comando della skill che il pilota non ha attraversato |
| P.5 | launchpad — P0→P2 | deploy 1-click con verifica d'identità dell'app (`BUILD_ID` nell'HTML servito), "non si pubblica su gate rosso", deploy sempre a checkpoint umano. **Vincolo dal pilota**: il **debito n°27** (il seed porta due account con password nota) **blocca il deploy** — separare il seed di sviluppo da quello di produzione è un prerequisito di questo pacchetto, non un residuo | P.4 (consigliato: serve un sito vero da pubblicare) | come P.1–P.3; collaudo finale = deploy del pilota, autorizzato dal committente | da fare |
| P.6 | site-doctor — P0→P2 | certificato di idoneità pre-produzione (GDPR/cookie, a11y, OG, favicon, robots, sitemap — raccoglie anche i buchi noti: favicon 404, sitemap/robots mai verificati da speed-demon) | P.4 | come P.1–P.3 | da fare |
| P.7a | Gate della regia | lo dichiara mancante `DECISIONI.md` §26: controllo docx/txt allineati, più le coerenze della regia (junction, elenchi README vs skill reali) | — | script deterministico, verde riproducibile da un clone pulito; regole in lib pura con test; guardiani locali per `scripts/` di radice | **consegnata e collaudata 2026-08-04** (commit `d57e779`, Opus 5 · high) — `scripts/verifica-regia.mjs` + `regia-lib` con 5 passi (`docx-txt`, `skill-elencate`, `stato-presente`, `epiloghi-vivi`, `segnaposto-radice`), guardiani propri, DECISIONI §26 aggiornata. Verifica del direttore: gate **VERDE 5/5 rilanciato** (col node di sistema), batteria **46/46 rilanciata**. Il passo `skill-elencate` ha già fatto da testimone al README aggiornato da P.2. **Chiusa** |
| P.7b | Documento madre aggiornato | `Web Gun.docx` fermo (schema-forge dichiarato a versione vecchia) + `scripts/estrai-docx.ps1` rilanciato | — (il .docx lo edita Alberto in Word, con STOP a metà mandato) | `webgun_content.txt` rigenerato e coerente col repo | **parziale** — la fotografia è fatta (txt allineato al docx attuale, confermato dal passo `docx-txt` del gate della regia; il `M` in working tree era solo fine-riga, ripristinato). **Resta l'edit in Word di Alberto**: lista puntuale consegnata dal direttore il 2026-08-04 (schema-forge v1.3→v1.5, vetrina-crafter assente al posto 8, numeri test vecchi, il `BUTCHER`); al suo «fatto» il direttore rigenera il txt e committa (atto di registro) |
| P.7c | Guardiani arretrati + igiene del banco | `semgrep` (presente, mai puntato) sugli script di flow-sentinel e speed-demon; `/code-inquisition` sugli script delle 4 skill; valutare installazione `gitleaks`; **da P.0-igiene**: `npm install` nelle cartelle di gestionale-crafter e flow-sentinel (ESLint locale mai eseguibile senza) e il warning `complexity 19` preesistente su `speed-demon/scripts/verify.mjs:263`; **da D9**: riallineare `rls_policy.test.sql` asserzione 11 a `throws_ok(…, '42501', …)` e riverificare pgTAP a 2/23 sul banco | **dopo la ripresa di P.2** (D8: banco vetcare e Docker condivisi) | esiti registrati negli `STATO.md`: ogni MANCANTE diventa un esito reale; gate del banco rilanciato dopo il riallineo | **parziale, interrotta senza commit** — mandato emesso 2026-08-04 (`prompts/P7c-guardiani-arretrati.md`, Opus 5 · high). Eseguiti i punti 1 (a metà) e 2: `npm install` in gestionale-crafter, flow-sentinel e speed-demon; il globale `URL` mancante nella config ESLint di gestionale (rilievo vivo dal 2026-08-03 e invisibile: ESLint non girava affatto); il `complexity 19` di `speed-demon/scripts/verify.mjs` sciolto in funzioni pure, batteria 75 → **86**. Tutto era in working tree: **verificato e committato dal direttore** (batteria 86/86 rilanciata; ESLint pulito su speed-demon, gestionale e flow-sentinel; knip pulito su speed-demon). **Mancavano**: i numeri negli `STATO.md` (punti 1 e 7), semgrep (3), `/code-inquisition` (4), gitleaks (5) e **D9** (6) → ripresa emessa 2026-08-04 (`prompts/P7c-ripresa.md`, Opus 5 · high), **tornata di nuovo senza un commit**: un'ora di lavoro, in working tree il solo riallineo D9 — fatto bene, con la motivazione in commento. **Salvataggio e chiusura parziale del direttore 2026-08-04**: D9 chiuso (asserzione 11 → `throws_ok('…', '42501', null, …)`; gate vetcare rilanciato due volte col node di sistema: **ROSSO, 2 falliti, 0 mancanti su 9**, pgTAP **2/23** sulle storiche 22-23, `rls_policy` **11/11** — combacia col verdetto atteso falsificabile del mandato; al primo lancio un terzo FAIL sul passo `tipi` col dettaglio vuoto: memoria di paging esaurita sotto il carico di due gate e due batterie, non lo schema — tipi rigenerati a mano **identici** ai committati, secondo lancio OK); knip di gestionale-crafter e flow-sentinel eseguiti: **0 rilievi entrambi**; numeri dei punti 1-2 registrati negli `STATO.md` delle quattro skill; handoff del banco aggiornato (11 asserzioni, prosa dei motivi chiusa su D9). **Restano i punti 3-5** — semgrep (installato, 1.171.0, mai puntato), `/code-inquisition`, gitleaks (assente) — con le righe di `STATO.md` che ne nasceranno e il verbale → **ripresa-2 pronta** (`prompts/P7c-ripresa2.md`, Opus 5 · high; perimetro disgiunto da P.4-pre, possono girare accanto) |

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
