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
| D8 | **Parallelismo a file disgiunti.** Possono correre insieme solo pacchetti i cui perimetri di **scrittura** non si intersecano e che non condividono un banco. Ogni operaio committa **solo i propri percorsi** (`git add` espliciti, mai `-A`, mai `commit -a`: l'index git è unico) e **non tocca `CANTIERE.md`** — la contabilità la scrive il direttore ai ritorni. Assetto corrente (aggiornato 2026-08-04, sera): **nessuna chat operaia attiva** — P.3 e P.7c tornate parziali, le riprese le emette la direzione nuova | richiesta di velocità del committente (2026-08-03); il working tree e l'index sono unici, e due gate sullo stesso banco producono misure sporche (lezione D6) | presa 2026-08-03 |
| D10 | Il **dominio del pilota di P.4 è una pizzeria con ordini d'asporto** — menu pubblico, ruoli titolare/cucina, contenuti editabili, flusso critico = **ordine con macchina a stati** (ricevuto → in preparazione → pronto). **Il pagamento resta fuori** (nessun agente lo copre; si paga al ritiro), e va scritto nel `PROGETTO.md` del pilota | dominio nuovo: vetcare, controtempo e valscura hanno già provato la *prenotazione*, e una classe di flusso mai attraversata è l'unica che fa emergere ciò che le reference danno per scontato. È anche il cliente-tipo che Maps Scraper procura davvero | presa dal committente 2026-08-04 |
| D11 | Il **progetto pilota vive in un repo separato**, non dentro la regia | lo prescrive il `CLAUDE.md` («i siti veri vengono generati in repo separati»), e il pilota è il candidato al deploy di P.5: dentro la regia sarebbe un `banco-prova-*` che la §25 imporrebbe di cancellare a fine P.4 — cioè si butterebbe proprio il progetto che P.5 deve pubblicare. Costo dichiarato: i gate non hanno mai girato fuori dall'albero della regia (misurato: reggono, perché separano `SKILL_DIR` da `process.cwd()`; **ma `installa-skill.ps1` non ha un parametro di destinazione**, quindi il repo pilota non vedrebbe nessuna skill → deliverable 1 di **P.4-pre**) | presa dal committente 2026-08-04 |
| D9 | Lo **scarto pgTAP del banco** (P.8: `rls_policy.test.sql`, asserzione 11 — `count = 0` presupponeva un `select` che il modello di accesso nega) si chiude **riallineando il test a `throws_ok(…, '42501', …)`**, la forma più forte del rifiuto — non aggiungendo il grant che lo farebbe passare. Esecutore: **P.7c** (l'operaio di P.8 giustamente non ha riscritto il giudice della propria migrazione). Fino ad allora il rosso documentato del banco comprende anche quella riga | un'asserzione che pretende un privilegio mai scritto è un rosso strutturale, e un rosso strutturale insegna a ignorare il rosso | presa 2026-08-03 |

## Pacchetti di lavoro

Stati possibili: `da fare` · `in corso` (prompt emesso, operaio al lavoro) · `consegnato`
(esito riportato, verifica del direttore in corso) · `collaudato` (verificato, chiuso).

| # | Pacchetto | Obiettivo | Prerequisiti | Criterio di accettazione | Stato |
|---|---|---|---|---|---|
| P.1 | vetrina-crafter — P0 progettazione | `SKILL.md` completo col gate scritto PRIMA del flusso, passi del gate progettati con id stabili, template del contratto e dell'handoff, `STATO.md` col piano P0→P3 | analisi di cantiere (fatta) | revisione del direttore + **firma del committente** sulla progettazione; checklist del template (`COME-USARE-QUESTO-TEMPLATE.md` §9); nessun comando speculativo | **consegnata 2026-08-02** (commit `a1ee045`, Opus 5 · max) — revisione del direttore: **promossa**, 3 rilievi minori assorbiti nel mandato P.2; in attesa della firma del committente |
| P.2 | vetrina-crafter — P1 costruzione | references, `scripts/` (verify.mjs + lib pure + test), banco usa e getta via schema-forge, **tutti e 7 i comandi esercitati**, sabotaggio provato | P.1 firmata | gate **VERDE 10/10** sul banco e **ROSSO** su ogni sabotaggio; `node --test` verde; guardiani sugli script (package.json+eslint locali, come schema-forge); verbale `COSTRUZIONE-<data>.md`; a gate verde entra in `README.md` e `installa-skill.ps1` | **parziale, ferma al banco** — deliverable 1-3 consegnati 2026-08-03 (Opus 5 · max, commit `b7fa58f · 43ff29f · 2697787`); 113 test **rilanciati dal direttore**, 113 pass 0 fail. Fermata al deliverable 4 per **due prerequisiti fuori dal suo perimetro**: i GRANT di schema-forge (P.8) e i cinque `import.meta.main` (P.0-igiene). Tre decisioni sospese in attesa del banco (S1 slot senza riga pubblicata, S2 soglia 24 caratteri, S3 rilievi sulle date). **Ripresa emessa 2026-08-03**: mandato `agenti/vetrina-crafter/prompts/P1-ripresa.md` (Opus 5 · max). **Consegnata e collaudata il 2026-08-04**: gate **VERDE 10/10 rilanciato dal direttore** su `banco-prova-controtempo` (e visto rifiutare il verde con Docker spento: MANCANTE ≠ PASS dal vivo, con `contratto-uscita` che boccia l'handoff `VERDE` su esecuzione rossa); batteria **122/122 rilanciata**; 7/7 comandi esercitati; S1=`block` (misurata), S2=24 confermata (e scoperto che i candidati contenevano UUID e timestamp), S3: un falso positivo previsto **non esiste**; 22 classi di sabotaggio, 3 difetti del gate chiusi con test, 4 premesse smentite (fra cui la dottrina sulla colonna non disegnata: nei Server Components non viaggia — ma la chiave anonima nel bundle espone ciò che grant+policy concedono, ed è la misura che sostituisce la regola); schema-forge VERDE 9/9 sopra; README riga 8 e `installa-skill.ps1` aggiornati (verificati dal gate della regia). Verbale `COSTRUZIONE-2026-08-03.md`. **Chiusa** |
| P.0-igiene | I gate tornano a parlare su Node 20 | i cinque `import.meta.main` corretti con la forma di vetrina-crafter + **due** test di regressione per script (funzionale: spawn in cartella non-progetto, uscita ≠ 0 e output non muto; statico: il sorgente non contiene `import.meta.main` — il funzionale su Node 24 non vede questo difetto) | — (urgente: col node di sistema ogni gate esce 0 muto) | prove **due-direzioni** su 5 script incollate; gate di schema-forge sul banco col node di sistema = stesso verdetto misurato dal direttore (ROSSO, 1 fallito, 2 mancanti); batterie 144/105/108/73 verdi; `STATO.md` delle quattro skill aggiornati | **consegnata 2026-08-03** (Opus 5 · max) — 5 punti corretti con la forma di vetrina-crafter; prove due-direzioni su 5 script × 2 node: **prima** Node 20 usciva `0` con zero righe e Node 24 usciva `2` col messaggio, **dopo** tutti e dieci escono `2` con lo stesso messaggio. Gate di schema-forge sul banco **col node di sistema**: ROSSO, 1 fallito (pgTAP `permission denied for table animals`/`price_list_items` → P.8) e 2 mancanti (sqlfluff, squawk) su 9 — identico alla misura del direttore con Node 24. Batterie **146/109/110/75** (+10 test nuovi: 2 per script, funzionale e statico); i due test provati per sabotaggio — reintrodotto `import.meta.main` in schema-forge, su Node 24 il funzionale **passa** e lo statico fallisce, su Node 20 falliscono entrambi. `STATO.md` delle quattro skill aggiornati. **Collaudata dal direttore il 2026-08-03**: 5/5 script rilanciati col node di sistema (tutti exit `2` con messaggio), batterie **146/109/110/75 rilanciate, 0 fail**, gate sul banco col node di sistema **ROSSO 1 fallito / 2 mancanti, uscita 1** (identico), grep: nessuna guardia viva, residui solo in commenti e test. **Chiusa** |
| P.8 | schema-forge emette privilegi espliciti | contratto d'uscita di `forge` con `revoke`+`grant` espliciti (compreso `service_role`); regola d'audit che distingue i privilegi CRUD da `Dxtm`; banco riportato al suo rosso storico; sqlfluff+squawk installati (perimetro: D7) | P.0-igiene collaudata (fatto) | gate di schema-forge sul banco: ROSSO **per i soli motivi storici documentati** (pgTAP 2 fail su 23 + block/issue noti), **0 verifiche mancanti**; regola nuova con test (caso che scatta + caso che non scatta); `STATO.md` aggiornato | **consegnata 2026-08-03** (Opus 5 · max) — gate sul banco **ROSSO, 2 falliti, 0 mancanti su 9**, col `block` su `staff.job_title` **tornato** e pgTAP a **2/23** (asserzioni storiche 22-23). Regola 7 dell'audit riscritta (`role_table_grants` non distingueva `Dxtm` da un grant vero): **0 findings prima → 21 `block` dopo** sullo stesso banco, gravità `block` per il criterio §17. Migrazione nuova in coda (`20260803120000_permessi_espliciti.sql`), banco **non sanato**. Test **146 → 153**; ESLint e knip puliti; sqlfluff 4.2.2 e squawk 2.61.0 installati con `pipx`. Voce **`DECISIONI.md` §27**. Tre scoperte oltre il mandato: `anon` col default poteva **`truncate`** (la RLS non filtra TRUNCATE); `pg_default_acl` aveva **due righe in conflitto**; sqlfluff **saltava in silenzio** una migrazione da 20 384 byte. **Uno scarto dal verdetto atteso**: `rls_policy.test.sql` si ferma a 10/11 — l'undicesima asserzione pretendeva un `select` ad `anon` che il modello di accesso nega (vedi giornale). **Collaudata dal direttore il 2026-08-03**, tutto rilanciato in proprio: gate sul banco ROSSO 2 falliti / 0 mancanti (uscita 1), `block` su `job_title` presente, pgTAP 22-23; ACL verificate con psql (`anon=r` solo su `clinics`/`species`, nessun ruolo client con `Dxtm`); batteria 153/153. Lo scarto `rls_policy` 10/11 → decisione **D9** (riallineo a `throws_ok` in P.7c). **Chiusa** |
| P.3 | vetrina-crafter — P2 collaudo avversario | chat vergine, dominio diverso, caccia ai falsi verdi dei passi del gate; il banco del collaudo DEVE avere un **modulo pubblico** (mai misurato), immagini vere, più pagine/slot, gate cronometrato | P.2 collaudata (fatto) | verbale `COLLAUDO-<data>.md` con difetti **misurati prima e dopo**, un test di regressione per difetto; gate corretto rilanciato senza regressioni su `banco-prova-controtempo` | **parziale, interrotta senza verbale** — mandato emesso 2026-08-04 (`agenti/vetrina-crafter/prompts/P2-collaudo.md`, Opus 5 · max). La chat ha aperto il banco nuovo (`banco-prova-valscura`, rifugio alpino: 9 pagine, 13 slot, immagini vere, modulo pubblico `richieste_prenotazione`) e committato **sei difetti veri in tre commit** (`d9c62b2 · 47ceb20 · a315c78`): tre `block` falsi del frammento distintivo (`to_jsonb(t)` candidava la chiave dello slot e il percorso di una foto — e il testo alternativo, che invece non doveva sparire); la diagnosi sotto-soglia senza il numero della manopola; **il percorso di scrittura pubblico che nessuno dei dieci passi leggeva** (lettura anonima della buca delle lettere aperta con due righe di SQL → VERDE 10/10; ora `block` misurando impersonando `anon`); **la regola delle zero righe morta da P1** (`psql` senza `-q`: `SET0` → `NaN`, il modo n°1 in cui una vetrina fallisce in silenzio non poteva scattare). Batteria 122 → **144**. **Verifica del direttore 2026-08-04**: batteria **144/144 rilanciata**; gate corretto **rilanciato su `banco-prova-controtempo`: VERDE 10/10, uscita 0** — la prova finale del mandato, senza regressioni. **Mancano**: verbale `COLLAUDO-<data>.md`, `STATO.md`, e il resto della caccia (sei classi cieche, PostgREST, trappole Next, contratto alla lettera, cronometro) → **P.3-ripresa da emettere** |
| P.4 | Filo completo (progetto pilota) — **ombrello** | un progetto realistico attraversa schema-forge → vetrina-crafter → gestionale-crafter → flow-sentinel → speed-demon; Alberto firma i contratti da committente | P.3 collaudato | i cinque gate VERDI **rilanciati dal direttore**; catena handoff 07→08→10→12→13, ognuno che cita un fatto verificabile del precedente; cinque righe `Confermato da:` col nome del committente; verbale di catena che dichiara **cosa si è rotto fra un anello e l'altro**; le tre frasi «non usabile su un progetto cliente» riscritte (vetrina, flow-sentinel, speed-demon) e **le due che restano, restano**; si ferma a speed-demon (D2) | **piano scritto 2026-08-04** — `prompts/P4-piano.md`, scomposto nelle sei righe qui sotto. Decisioni del committente: **D10** (dominio) e **D11** (repo separato) |
| P.4-pre | La strada per un progetto fuori dalla regia | (1) `installa-skill.ps1` impara un `-Destinazione` (default invariato), gate della regia ancora verde; (2) prova che un gate parla da fuori dall'albero — uscita **2 col messaggio**, mai 0 muto — e la stessa prova **dalla junction** per speed-demon, l'unico con `AGENTI_DIR = dirname(SKILL_DIR)`; (3) prova che la riga `Confermato da: Alberto Marocco (committente) il <ISO>` è accettata dai tre gate che la leggono e **rifiutata** col segnaposto `{{…}}`; (4) porte del pilota libere, banchi inutili spenti | P.3 e P.7c chiuse | le quattro prove **incollate**, due direzioni dove la forma le prevede; gate della regia verde | **mandato scritto 2026-08-04** — `prompts/P4-pre-strada.md`, **Sonnet 5 · high** (minuteria meccanica ben specificata, D4). Da emettere quando P.3 e P.7c sono chiuse |
| P.4a | schema-forge sul pilota | `model` → `forge` → `seed` → `test` → `types` → `verify` → `handoff` | P.4-pre | **Specchio del dominio firmato dal committente**; gate 9/9 rilanciato dal direttore; `docs/handoff/07-schema-forge.md` | da fare — Opus 5 · high |
| P.4b | vetrina-crafter sul pilota | `specchio` → `scaffold` → `pagine` → `audit` → `verify` → `handoff` | P.4a | **`docs/vetrina.md` firmato** (doppio STOP, mai delegabile: pubblicare non si annulla); gate 10/10 su build di produzione; `08-vetrina-crafter.md` che cita un fatto del 07 | da fare — Opus 5 · high |
| P.4c | gestionale-crafter sul pilota | `specchio` → `scaffold` → `viste` → `contenuti` → `audit` → `verify` → `handoff` | P.4b | **Specchio del gestionale firmato**; gate 7/7; `10-gestionale-crafter.md`. Il difetto noto (il gate conta le guardie, non sa se chiedono il ruolo giusto) **dichiarato in `docs/DEBITO-TECNICO.md`**, non aggirato | da fare — Opus 5 · high |
| P.4d | flow-sentinel sul pilota | `map` → `forge` → `run` → `verify` → `handoff` | P.4c | **`docs/flussi-critici.md` firmato dal committente** — è l'unico contratto in cui **l'omissione è invisibile al gate**; gate 7/7 su app vera e database seminato; `12-flow-sentinel.md` | da fare — Opus 5 · high |
| P.4e | speed-demon sul pilota | `measure` → `plan` → `tune` → `verify` → `handoff` | P.4d | **`docs/performance.md` firmato**; gate 7/7 con `--giri ≥ 3` su build di produzione riconosciuta dal `BUILD_ID`; **tutti e cinque i gate riverdi** dopo le ottimizzazioni; `13-speed-demon.md` | da fare — Opus 5 · high |
| P.5 | launchpad — P0→P2 | deploy 1-click con verifica d'identità dell'app (`BUILD_ID` nell'HTML servito), "non si pubblica su gate rosso", deploy sempre a checkpoint umano | P.4 (consigliato: serve un sito vero da pubblicare) | come P.1–P.3; collaudo finale = deploy del pilota, autorizzato dal committente | da fare |
| P.6 | site-doctor — P0→P2 | certificato di idoneità pre-produzione (GDPR/cookie, a11y, OG, favicon, robots, sitemap — raccoglie anche i buchi noti: favicon 404, sitemap/robots mai verificati da speed-demon) | P.4 | come P.1–P.3 | da fare |
| P.7a | Gate della regia | lo dichiara mancante `DECISIONI.md` §26: controllo docx/txt allineati, più le coerenze della regia (junction, elenchi README vs skill reali) | — | script deterministico, verde riproducibile da un clone pulito; regole in lib pura con test; guardiani locali per `scripts/` di radice | **consegnata e collaudata 2026-08-04** (commit `d57e779`, Opus 5 · high) — `scripts/verifica-regia.mjs` + `regia-lib` con 5 passi (`docx-txt`, `skill-elencate`, `stato-presente`, `epiloghi-vivi`, `segnaposto-radice`), guardiani propri, DECISIONI §26 aggiornata. Verifica del direttore: gate **VERDE 5/5 rilanciato** (col node di sistema), batteria **46/46 rilanciata**. Il passo `skill-elencate` ha già fatto da testimone al README aggiornato da P.2. **Chiusa** |
| P.7b | Documento madre aggiornato | `Web Gun.docx` fermo (schema-forge dichiarato a versione vecchia) + `scripts/estrai-docx.ps1` rilanciato | — (il .docx lo edita Alberto in Word, con STOP a metà mandato) | `webgun_content.txt` rigenerato e coerente col repo | **parziale** — la fotografia è fatta (txt allineato al docx attuale, confermato dal passo `docx-txt` del gate della regia; il `M` in working tree era solo fine-riga, ripristinato). **Resta l'edit in Word di Alberto**: lista puntuale consegnata dal direttore il 2026-08-04 (schema-forge v1.3→v1.5, vetrina-crafter assente al posto 8, numeri test vecchi, il `BUTCHER`); al suo «fatto» il direttore rigenera il txt e committa (atto di registro) |
| P.7c | Guardiani arretrati + igiene del banco | `semgrep` (presente, mai puntato) sugli script di flow-sentinel e speed-demon; `/code-inquisition` sugli script delle 4 skill; valutare installazione `gitleaks`; **da P.0-igiene**: `npm install` nelle cartelle di gestionale-crafter e flow-sentinel (ESLint locale mai eseguibile senza) e il warning `complexity 19` preesistente su `speed-demon/scripts/verify.mjs:263`; **da D9**: riallineare `rls_policy.test.sql` asserzione 11 a `throws_ok(…, '42501', …)` e riverificare pgTAP a 2/23 sul banco | **dopo la ripresa di P.2** (D8: banco vetcare e Docker condivisi) | esiti registrati negli `STATO.md`: ogni MANCANTE diventa un esito reale; gate del banco rilanciato dopo il riallineo | **parziale, interrotta senza commit** — mandato emesso 2026-08-04 (`prompts/P7c-guardiani-arretrati.md`, Opus 5 · high). Eseguiti i punti 1 (a metà) e 2: `npm install` in gestionale-crafter, flow-sentinel e speed-demon; il globale `URL` mancante nella config ESLint di gestionale (rilievo vivo dal 2026-08-03 e invisibile: ESLint non girava affatto); il `complexity 19` di `speed-demon/scripts/verify.mjs` sciolto in funzioni pure, batteria 75 → **86**. Tutto era in working tree: **verificato e committato dal direttore** (batteria 86/86 rilanciata; ESLint pulito su speed-demon, gestionale e flow-sentinel; knip pulito su speed-demon). **Mancano**: i numeri negli `STATO.md` (punti 1 e 7), semgrep (3), `/code-inquisition` (4), gitleaks (5) e **D9** — riallineo di `rls_policy.test.sql` e rilancio del gate vetcare (6) → **P.7c-ripresa da emettere** |

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
