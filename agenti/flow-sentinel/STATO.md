# Stato — Flow Sentinel

- **Stato attuale:** costruita (P1, 2026-07-28). `SKILL.md` confermata in P0 e **non modificata**; ora
  esistono le **4 references**, il gate `verify.mjs` a **7 passi** con id stabili, le regole pure in
  `scripts/gate-lib.mjs` con **79 test verdi** (`node --test`), i **3 template** e la configurazione
  ESLint delle spec. Il gate e' stato **eseguito davvero** su un banco Next.js + Supabase locale
  (`banco-prova-flow/`, usa e getta, gitignorato): **VERDE 7 su 7**, poi **rosso cinque volte** per
  cinque difetti piantati apposta, poi **verde di nuovo**. Verbale con le uscite incollate:
  `COSTRUZIONE-2026-07-28.md`.
  **NON ancora usabile su un progetto cliente:** la batteria e il banco sono stati scritti dalla stessa
  mano, quindi non e' mai successo che il gate trovasse un difetto di qualcun altro. Punti aperti in
  fondo, ordinati per gravita'.
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
| P2 | collaudo avversario indipendente su dominio diverso: caccia ai falsi verdi del gate | chat dedicata, vergine | da fare |
| P3 | primo consumatore reale: batteria su Bottega Nord (`banco-prova-negozio`), dopo l'handoff di gestionale-crafter | chat dedicata | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 7 | `verify.mjs --json`, `summary.passi` |
| Test degli script | 79 verdi | `node --test "scripts/**/*.test.mjs"` |
| References | 4 | `references/`, 1288 righe in tutto |
| Template | 3 | `flussi-critici.md`, `handoff-flow-sentinel.md`, `eslint-spec.config.mjs` |
| Flussi del banco | 5 (3 positivi, 1 ostile-lettura, 1 ostile-scrittura) | dettaglio del passo `flussi-critici` |
| Spec del banco | 5, tutte verdi | dettaglio del passo `playwright` |
| Difetti piantati e rilevati | 5 su 5 | `COSTRUZIONE-2026-07-28.md` §Sabotaggio |
| Premesse tolte e riconosciute mancanti | 3 su 3 | `COSTRUZIONE-2026-07-28.md` §MANCANTE |

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
- **Che il seed contenga i dati giusti.** `app-viva` conta tabelle e righe: sa che il database non e'
  vuoto, non sa che dentro ci sia quello che serve ai flussi.
- **Che la batteria trovi i difetti.** Lo dimostra il sabotaggio, e il sabotaggio si esegue al collaudo,
  a mano, non a ogni giro (`references/sabotaggio.md`).
- **Niente sulla sicurezza oltre i flussi dichiarati.** Le porte che nessuno ha dichiarato le cerca
  Cyber Shield: qui si prova che quelle dichiarate restano chiuse.

## Punti aperti — ordinati per gravita'

1. **Nessun consumatore reale.** Banco e batteria sono stati scritti dalla stessa mano, nello stesso
   giorno: il gate non ha mai giudicato il lavoro di qualcun altro, ed e' esattamente li' che Schema
   Forge ha trovato i suoi difetti veri. Lo chiude P3 (Bottega Nord).
2. **Nessun collaudo avversario indipendente.** I cinque sabotaggi li ha scelti chi ha scritto le
   regole: provano che le regole scattano dove chi le ha scritte si aspettava. P2 esiste per questo.
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
