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
| D7 | Perimetro di **P.8**: (a) il contratto d'uscita di `forge` emette privilegi espliciti — `revoke` + `grant` per `anon`/`authenticated` **e `service_role`** (la richiesta del 2026-07-30 nel suo STATO) — nella regola, non solo nell'esempio; (b) la regola 6 dell'audit impara a distinguere `Dxtm` da un grant vero (sul banco non è scattata: l'ACL non era vuota); (c) il banco torna al **suo rosso storico** documentato, non si sana; (d) sqlfluff e squawk installati (chiudono i 2 MANCANTI). **Fuori**: i 12 `security definer` PUBLIC e le 20 policy permissive del banco (il banco è rosso apposta e l'audit già li segnala); il seed `auth.users`/`identities` (altra classe: si apre prima di P.4) | non gonfiare il pacchetto; il banco è un caso di prova, non un progetto da sanare | presa 2026-08-03 |

## Pacchetti di lavoro

Stati possibili: `da fare` · `in corso` (prompt emesso, operaio al lavoro) · `consegnato`
(esito riportato, verifica del direttore in corso) · `collaudato` (verificato, chiuso).

| # | Pacchetto | Obiettivo | Prerequisiti | Criterio di accettazione | Stato |
|---|---|---|---|---|---|
| P.1 | vetrina-crafter — P0 progettazione | `SKILL.md` completo col gate scritto PRIMA del flusso, passi del gate progettati con id stabili, template del contratto e dell'handoff, `STATO.md` col piano P0→P3 | analisi di cantiere (fatta) | revisione del direttore + **firma del committente** sulla progettazione; checklist del template (`COME-USARE-QUESTO-TEMPLATE.md` §9); nessun comando speculativo | **consegnata 2026-08-02** (commit `a1ee045`, Opus 5 · max) — revisione del direttore: **promossa**, 3 rilievi minori assorbiti nel mandato P.2; in attesa della firma del committente |
| P.2 | vetrina-crafter — P1 costruzione | references, `scripts/` (verify.mjs + lib pure + test), banco usa e getta via schema-forge, **tutti e 7 i comandi esercitati**, sabotaggio provato | P.1 firmata | gate **VERDE 10/10** sul banco e **ROSSO** su ogni sabotaggio; `node --test` verde; guardiani sugli script (package.json+eslint locali, come schema-forge); verbale `COSTRUZIONE-<data>.md`; a gate verde entra in `README.md` e `installa-skill.ps1` | **parziale, ferma al banco** — deliverable 1-3 consegnati 2026-08-03 (Opus 5 · max, commit `b7fa58f · 43ff29f · 2697787`); 113 test **rilanciati dal direttore**, 113 pass 0 fail. Fermata al deliverable 4 per **due prerequisiti fuori dal suo perimetro**: i GRANT di schema-forge (P.8) e i cinque `import.meta.main` (P.0-igiene). Tre decisioni sospese in attesa del banco (S1 slot senza riga pubblicata, S2 soglia 24 caratteri, S3 rilievi sulle date) |
| P.0-igiene | I gate tornano a parlare su Node 20 | i cinque `import.meta.main` corretti con la forma di vetrina-crafter + **due** test di regressione per script (funzionale: spawn in cartella non-progetto, uscita ≠ 0 e output non muto; statico: il sorgente non contiene `import.meta.main` — il funzionale su Node 24 non vede questo difetto) | — (urgente: col node di sistema ogni gate esce 0 muto) | prove **due-direzioni** su 5 script incollate; gate di schema-forge sul banco col node di sistema = stesso verdetto misurato dal direttore (ROSSO, 1 fallito, 2 mancanti); batterie 144/105/108/73 verdi; `STATO.md` delle quattro skill aggiornati | **consegnata 2026-08-03** (Opus 5 · max) — 5 punti corretti con la forma di vetrina-crafter; prove due-direzioni su 5 script × 2 node: **prima** Node 20 usciva `0` con zero righe e Node 24 usciva `2` col messaggio, **dopo** tutti e dieci escono `2` con lo stesso messaggio. Gate di schema-forge sul banco **col node di sistema**: ROSSO, 1 fallito (pgTAP `permission denied for table animals`/`price_list_items` → P.8) e 2 mancanti (sqlfluff, squawk) su 9 — identico alla misura del direttore con Node 24. Batterie **146/109/110/75** (+10 test nuovi: 2 per script, funzionale e statico); i due test provati per sabotaggio — reintrodotto `import.meta.main` in schema-forge, su Node 24 il funzionale **passa** e lo statico fallisce, su Node 20 falliscono entrambi. `STATO.md` delle quattro skill aggiornati. In attesa della verifica del direttore |
| P.8 | schema-forge emette privilegi espliciti | contratto d'uscita di `forge` con `revoke`+`grant` espliciti (compreso `service_role`); regola d'audit che distingue i privilegi CRUD da `Dxtm`; banco riportato al suo rosso storico; sqlfluff+squawk installati (perimetro: D7) | P.0-igiene collaudata (D6: banco e working tree condivisi) | gate di schema-forge sul banco: ROSSO **per i soli motivi storici documentati** (pgTAP 2 fail su 23 + block/issue noti), **0 verifiche mancanti**; regola nuova con test (caso che scatta + caso che non scatta); `STATO.md` aggiornato | da fare — mandato all'esito di P.0-igiene |
| P.3 | vetrina-crafter — P2 collaudo avversario | chat vergine, dominio diverso, caccia ai falsi verdi dei passi del gate | P.2 consegnato | verbale `COLLAUDO-<data>.md` con difetti **misurati prima e dopo**, un test di regressione per difetto; gate corretto rilanciato senza regressioni sul banco di P.2 | da fare |
| P.4 | Filo completo (progetto pilota) | un progetto realistico attraversa schema-forge → vetrina-crafter → gestionale-crafter → flow-sentinel → speed-demon; Alberto firma i contratti da committente | P.3 collaudato | ogni gate VERDE **rilanciato dal direttore**; handoff a catena letti e scritti; le righe `Confermato da:` portano la firma del **committente** (chiude il §6.2 di speed-demon e il punto "mai un committente" di flow-sentinel); si ferma a speed-demon (D2) | da fare — si spezzerà in sotto-pacchetti (una chat per agente) |
| P.5 | launchpad — P0→P2 | deploy 1-click con verifica d'identità dell'app (`BUILD_ID` nell'HTML servito), "non si pubblica su gate rosso", deploy sempre a checkpoint umano | P.4 (consigliato: serve un sito vero da pubblicare) | come P.1–P.3; collaudo finale = deploy del pilota, autorizzato dal committente | da fare |
| P.6 | site-doctor — P0→P2 | certificato di idoneità pre-produzione (GDPR/cookie, a11y, OG, favicon, robots, sitemap — raccoglie anche i buchi noti: favicon 404, sitemap/robots mai verificati da speed-demon) | P.4 | come P.1–P.3 | da fare |
| P.7a | Gate della regia | lo dichiara mancante `DECISIONI.md` §26: controllo docx/txt allineati, più le coerenze della regia (junction, elenchi README vs skill reali) | — (bassa priorità) | script deterministico, verde riproducibile da un clone pulito | da fare |
| P.7b | Documento madre aggiornato | `Web Gun.docx` fermo (schema-forge dichiarato a versione vecchia) + `scripts/estrai-docx.ps1` rilanciato | — (il .docx lo edita Alberto in Word) | `webgun_content.txt` rigenerato e coerente col repo | da fare |
| P.7c | Guardiani arretrati | `semgrep` (presente, mai puntato) sugli script di flow-sentinel e speed-demon; `/code-inquisition` sugli script delle 4 skill; valutare installazione `gitleaks` | — (bassa priorità) | esiti registrati negli `STATO.md`: ogni MANCANTE diventa un esito reale | da fare |

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
