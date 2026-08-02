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

## Pacchetti di lavoro

Stati possibili: `da fare` · `in corso` (prompt emesso, operaio al lavoro) · `consegnato`
(esito riportato, verifica del direttore in corso) · `collaudato` (verificato, chiuso).

| # | Pacchetto | Obiettivo | Prerequisiti | Criterio di accettazione | Stato |
|---|---|---|---|---|---|
| P.1 | vetrina-crafter — P0 progettazione | `SKILL.md` completo col gate scritto PRIMA del flusso, passi del gate progettati con id stabili, template del contratto e dell'handoff, `STATO.md` col piano P0→P3 | analisi di cantiere (fatta) | revisione del direttore + **firma del committente** sulla progettazione; checklist del template (`COME-USARE-QUESTO-TEMPLATE.md` §9); nessun comando speculativo | **consegnata 2026-08-02** (commit `a1ee045`, Opus 5 · max) — revisione del direttore: **promossa**, 3 rilievi minori assorbiti nel mandato P.2; in attesa della firma del committente |
| P.2 | vetrina-crafter — P1 costruzione | references, `scripts/` (verify.mjs + lib pure + test), banco usa e getta via schema-forge, **tutti e 7 i comandi esercitati**, sabotaggio provato | P.1 firmata | gate **VERDE 10/10** sul banco e **ROSSO** su ogni sabotaggio; `node --test` verde; guardiani sugli script (package.json+eslint locali, come schema-forge); verbale `COSTRUZIONE-<data>.md`; a gate verde entra in `README.md` e `installa-skill.ps1` | **pronta** — mandato emesso 2026-08-02 (`agenti/vetrina-crafter/prompts/P1-costruzione.md`, consigliato Opus 5 · max); parte alla firma di P0 |
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
