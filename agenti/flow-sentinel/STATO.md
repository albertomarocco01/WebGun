# Stato — Flow Sentinel

- **Stato attuale:** costruita (P1) e **collaudata in modo indipendente** (P2), entrambe il 2026-07-28.
  `SKILL.md` confermata in P0 e **non modificata** da nessuna delle due fasi; esistono le
  **4 references**, il gate `verify.mjs` a **7 passi** con id stabili, le regole pure in
  `scripts/gate-lib.mjs` con **103 test verdi** (`node --test`), i **3 template** e la configurazione
  ESLint delle spec. Il gate e' stato **eseguito davvero** su due banchi Next.js + Supabase locale,
  scritti da due mani diverse: `banco-prova-flow/` (P1, e-commerce) e `banco-prova-collaudo-fs/`
  (P2, palestra) — **VERDE 7 su 7 su entrambi**, e rosso ogni volta che qualcosa e' stato rotto apposta.
- **Il collaudo avversario ha trovato dieci difetti**, tutti misurati prima di essere corretti, tutti
  con un test di regressione e un commit ciascuno. Sette erano **falsi verdi**: il gate diceva verde
  senza aver guardato. Verbale con le uscite incollate: `COLLAUDO-2026-07-28.md`.
  **NON ancora usabile su un progetto cliente:** i due banchi restano scritti da chi scriveva anche le
  regole, e i flussi critici li ha proposti l'agente. Punti aperti in fondo, ordinati per gravita'.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: gestionale-crafter e fly-ui (l'app da testare), schema-forge (il modello di accesso del suo
    handoff e' la fonte dei flussi ostili; seed e utenti), ai-specialist se presente
  - A valle: speed-demon (ottimizza con la batteria come rete di sicurezza), cyber-shield (parte dai
    flussi ostili dichiarati), launchpad (non pubblica su gate rosso)
- **Guardiani:** ESLint **0 errori 0 warning**, `knip` pulito, `jscpd` **0 cloni** su `scripts/`.

## Piano di costruzione (deciso in P0)

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione SKILL.md | qui | fatta, confermata dall'umano il 2026-07-28 |
| P1 | references, scripts (gate + lib pura + test), banco minimo usa e getta, sabotaggio provato | branch `agente/flow-sentinel` | **fatta il 2026-07-28** |
| P2 | collaudo avversario indipendente su dominio diverso: caccia ai falsi verdi del gate | chat dedicata, vergine | **fatta il 2026-07-28** — 10 difetti, `COLLAUDO-2026-07-28.md` |
| P3 | primo consumatore reale: batteria su Bottega Nord (`banco-prova-negozio`), dopo l'handoff di gestionale-crafter | chat dedicata | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 7 | `verify.mjs --json`, `summary.passi` |
| Test degli script | **103 verdi** (79 dopo P1, +24 di regressione in P2) | `node --test "scripts/**/*.test.mjs"` |
| References | 4 | `references/`, 1288 righe dopo P1, corrette in tre punti da P2 |
| Template | 3 | `flussi-critici.md`, `handoff-flow-sentinel.md`, `eslint-spec.config.mjs` |
| Banchi su cui il gate e' girato | 2, di due domini e due mani | `banco-prova-flow/` (5 flussi, 5 spec) · `banco-prova-collaudo-fs/` (6 flussi, 6 spec) |
| Difetti piantati e rilevati | 5 su 5 (P1) + 3 su 3 (P2, classi nuove) | `COSTRUZIONE` §3.2 · `COLLAUDO` §4 |
| Premesse tolte e riconosciute mancanti | 3 su 3 | `COSTRUZIONE-2026-07-28.md` §MANCANTE |
| Forme ostili provate sulle regole pure | 79, con input della forma vera | `COLLAUDO-2026-07-28.md` §6 |
| Difetti del gate trovati dal collaudo | **10** (7 falsi verdi, 3 crash o rossi sbagliati) | `COLLAUDO-2026-07-28.md` §3 |

## Tre falsi verdi trovati costruendo, e chiusi

Nessuno dei tre veniva dal compito: due sono usciti facendo girare il gate per davvero, il terzo
dalla verifica avversaria delle references — cercando di smentire una frase, non di leggere il codice.

1. **Un contratto non firmato passava per firmato.** `RIGA_CONFERMA` usava `\s` fra i due punti e la
   firma, e `\s` comprende l'a capo: una riga `Confermato da:` **vuota** catturava la prima riga non
   vuota che seguiva — l'intestazione del primo flusso — e il passo usciva **verde**. E' il falso verde
   peggiore, perche' sta esattamente sul passo che esiste per impedirlo. Riprodotto, chiuso ammettendo i
   soli spazi orizzontali, due test di regressione. Stessa correzione sulla riga `Gate:`.
   **Vale anche per Schema Forge**, che ha la stessa forma di regex: vedi le proposte del verbale.
2. **Lo shim che Windows non sa eseguire.** `where npx` elenca per primo lo script di shell **senza
   estensione** (quello per Git Bash); `spawnSync` non lo esegue, e il passo `playwright` diceva «report
   JSON non interpretabile» su una macchina dove `npx playwright test` funziona. Il guasto andava nella
   direzione sicura (MANCANTE, mai un falso verde), la diagnosi no: incolpava Playwright. Chiuso con
   `primoEseguibile()`, che sceglie la riga con estensione eseguibile, piu' un esito distinto per
   l'errore di esecuzione.
3. **`effetto-db` verificava l'import e non la chiamata.** Il ritaglio della clausola di import partiva
   dal **primo** `import` del file, quindi in una spec vera — che comincia sempre con
   `import { test, expect } from "@playwright/test";` — i nomi raccolti erano `test`, `expect`,
   `import`, `contaProdotti`, e un `expect(...)` qualsiasi passava per una chiamata all'helper del
   database. Bastava importare l'helper e non usarlo mai per avere il verde, **sul passo che esiste
   apposta per pretendere la chiamata**. Sul banco non si vedeva: le cinque spec l'helper lo chiamano.
   Chiuso vietando `;` e virgolette dentro la clausola, con due test nuovi che usano la forma **vera**
   di una spec. La lezione: i test della regola usavano frammenti con un solo import, cioe' una forma
   che nella realta' non esiste — un test che non somiglia all'input vero prova la fixture, non la
   regola.

## Cosa un gate verde NON prova

Questa sezione esiste perche' la sua assenza e' il modo in cui un verde diventa una firma in bianco.

- **Che l'elenco dei flussi sia completo.** Il gate verifica che ogni flusso *dichiarato* sia attaccato,
  non che sia stato dichiarato tutto quello che conta. Un checkout dimenticato allo Specchio resta
  invisibile a tutti e sette i passi. La difesa e' la conferma umana, e non e' automatizzabile.
- **Che l'asserzione di effetto sia quella giusta.** `effetto-db` guarda la **forma**: che la spec
  importi e chiami `e2e/helpers/db`. Una chiamata che legge la tabella sbagliata copre la casella.
  Stessa onesta' che Schema Forge scrive sul suo audit RLS.
- **Che i flussi ostili in lettura siano davvero rifiutati.** Su `ostile-lettura` il gate non pretende
  nessuna asserzione sul database — non c'e' stato da confrontare — quindi una spec che asserisce solo
  l'URL e non l'assenza del contenuto riservato passa. Lo trova il sabotaggio di classe C, non il gate.
  E non basta guardare il DOM: se il rifiuto lo decide il browser, l'HTML riservato e' gia' stato
  servito e ogni `getByText` lo trova pulito. Si asserisce sul **corpo della risposta** — misurato in
  P2, `COLLAUDO-2026-07-28.md` §4.1.
- **Che il seed contenga i dati giusti.** `app-viva` conta tabelle e righe: sa che il database non e'
  vuoto, non sa che dentro ci sia quello che serve ai flussi.
- **Che la batteria trovi i difetti.** Lo dimostra il sabotaggio, e il sabotaggio si esegue al collaudo,
  a mano, non a ogni giro (`references/sabotaggio.md`).
- **Niente sulla sicurezza oltre i flussi dichiarati.** Le porte che nessuno ha dichiarato le cerca
  Cyber Shield: qui si prova che quelle dichiarate restano chiuse.

## Cosa ha trovato il collaudo indipendente (P2)

Dieci difetti, tutti riprodotti prima di essere corretti. I quattro che contano:

1. **Una batteria in cui ogni test e' saltato usciva VERDE 7/7**, con `ok: true`: le spec si contavano
   come **file**, mai come esecuzioni. Bastavano sei `test.skip` con la motivazione accanto — cioe' la
   forma legittima, quella che `lint-spec` non segnala nemmeno — per avere un gate verde su zero flussi
   percorsi. Era l'ultimo punto in cui «uno strumento che esce 0 senza aver letto» era rimasto aperto.
2. **Un handoff che dichiarava `Gate: VERDE` su un gate ROSSO passava**, se piu' sopra citava in un
   blocco recintato il rosso dell'esecuzione precedente — cioe' esattamente cio' che
   `references/sabotaggio.md` prescrive di incollare li' dentro.
3. **Un contratto firmato da `{{UMANO | ORCHESTRATORE}}`** — il template compilato a meta' — o da un
   asterisco del grassetto passava per firmato.
4. **La spec ostile guardava il DOM dopo il redirect.** Col controllo di ruolo spostato nel browser,
   l'area riservata veniva servita per intero al socio e la batteria restava verde 6 su 6: ogni
   `getByText(...).toHaveCount(0)` girava sulla pagina lecita. Ora si asserisce sul corpo della
   risposta di navigazione, che un redirect del client non puo' riscrivere.

Gli altri sei: `retries` letto in un commento o ignorato dentro `projects`, `test.fixme` invisibile,
l'asserzione commentata via che contava come asserzione, gli schemi esposti multiriga che sparivano in
silenzio, tre crash su report malformati, e tre rossi sbagliati su codice commentato.

## Punti aperti — ordinati per gravita'

1. **Nessun consumatore reale.** I due banchi sono stati scritti da chi scriveva anche le regole, e i
   flussi critici li ha proposti l'agente: il gate non ha mai giudicato il lavoro di qualcun altro, ed
   e' esattamente li' che Schema Forge ha trovato i suoi difetti veri. Lo chiude P3 (Bottega Nord).
2. **`evolve` non e' mai stato collaudato.** Nessun flusso aggiunto o tolto dopo la conferma: il diff
   delle rotte, l'etichetta orfana sul campo e la rinomina in un giro solo restano non provati.
3. **`lint-spec` e' MANCANTE senza `npm install` nella cartella della skill.** ESLint viaggia con la
   skill (DECISIONI.md §8), quindi su una macchina nuova il primo giro del gate e' rosso finche' non si
   installano le dipendenze. E' corretto — MANCANTE non e' PASS — ma va scritto nel README della skill,
   che non esiste ancora.
4. **`app-viva` richiede `psql` nel PATH.** Senza, il passo e' MANCANTE e il gate resta rosso. Su questa
   macchina `psql` sta in `%USERPROFILE%\scoop\apps\postgresql\current\bin` e non e' nel PATH di default:
   e' la stessa nota operativa di Schema Forge, e non e' stata risolta, e' stata scritta.
5. **L'URL dell'app viene da `[auth].site_url`.** E' la sola riga che un progetto Web Gun dichiara
   davvero, ma e' nata per l'autenticazione: un progetto che la usa per altro (un dominio di produzione
   in un config locale) manderebbe il gate a interrogare un'app remota. Il flag `--url` ha la precedenza
   e il passo stampa sempre l'URL che ha interrogato, quindi l'errore e' visibile — non impedito.
6. **Nessuna regola statica sui flussi `ostile-lettura`.** Vedi sopra: e' una scelta dichiarata (non
   c'e' stato da confrontare), non una dimenticanza, ma resta un buco che solo la prosa difende.
7. **`code-inquisition` non e' mai stato lanciato sugli script di questa skill.** La Regola dei
   guardiani lo chiede sui punti critici; qui il punto critico e' la chiave amministrativa negli helper
   del progetto generato, e su quello il gate non ha nessun controllo automatico — solo la prosa di
   `references/playwright.md`. `semgrep` e `gitleaks` non sono installati: MANCANTI, non PASS.
8. **Il banco e' usa e getta e gitignorato.** Le prove stanno nel verbale, non su disco: rifare il banco
   richiede di rileggere `COSTRUZIONE-2026-07-28.md`. E' la §12 di DECISIONI.md applicata alla lettera;
   se P2 lo trasformasse nel caso di prova di un difetto, varrebbe la §20 e andrebbe tracciato.
