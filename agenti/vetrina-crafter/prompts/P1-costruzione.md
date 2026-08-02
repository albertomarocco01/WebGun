# Mandato P.2 — Costruzione (P1) di vetrina-crafter

> Emesso dal direttore dei lavori il 2026-08-02. Da incollare in una chat operaia nuova.
> **Modello consigliato: Opus 5 · effort max.**
> Prerequisito: P0 firmata dal committente. Contabilità: `CANTIERE.md` alla radice.

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto è la
**COSTRUZIONE (P1)** della skill **`vetrina-crafter`**, progettata in P0 (commit `a1ee045`)
e firmata dal committente. Implementi la specifica esistente: non riprogetti. Dove la
specifica si rivela sbagliata alla prova dei fatti, la correggi **dichiarandolo, con la
misura che l'ha smentita** — è già successo due volte in questa casa, e le premesse
smentite stanno nei verbali con le uscite incollate.

Il collaudo avversario (P2) sarà un'altra chat, su un altro dominio: tu costruisci e
provi, **non ti dai i voti**.

## Leggi prima, in quest'ordine (obbligatorio)

1. `CLAUDE.md` — contratto operativo del repo.
2. **Tutta** `agenti/vetrina-crafter/`: `SKILL.md`, `STATO.md`,
   `references/verifica-deterministica.md` (**la specifica che devi implementare**,
   comprese le §Note di piattaforma), i due template in `resources/templates/`,
   `prompts/P0-progettazione.md`.
3. `DECISIONI.md` — §8, §11, §12, §15, §18, §19, §21, §24, §25.
4. `agenti/speed-demon/COSTRUZIONE-2026-07-30.md` — l'ultimo verbale di costruzione
   della casa: è la forma attesa del tuo.
5. `agenti/schema-forge/COME-PROVARLA.md` e `agenti/schema-forge/STATO.md` §Note
   operative (Windows) — il banco lo costruisci **eseguendo schema-forge**, e quelle note
   (tipi generati da Git Bash e non da PowerShell, `psql` fuori dal PATH, shim `.cmd`)
   costano mezze giornate a chi non le legge.
6. `agenti/gestionale-crafter/references/contenuti-editabili.md` — il modello degli slot
   che la vetrina legge.

## Tre correzioni decise dal direttore in revisione della P0 (applicale PRIMA di costruire)

1. **`app-identita`: il `BUILD_ID` di un altro progetto è un `fail`, non un MANCANTE.**
   Un'app che risponde col BUILD_ID sbagliato è un fatto misurato — «stai guardando un
   altro sito» — e il precedente è `build-produzione` di speed-demon: FAIL con la
   diagnosi, e i passi a valle in MANCANTE. Il MANCANTE resta per le premesse assenti
   (app spenta, `.next/BUILD_ID` inesistente, nessun URL dichiarato né passato). Allinea
   la tabella di `SKILL.md` §Gate e il passo 6 della specifica.
2. **`pagine-vive`, seconda direzione: dichiara cosa misura davvero.** Si chiama
   «servita → dichiarata» ma l'esito proposto conta i `page.tsx` **nei sorgenti**: la
   misura va bene, la parola no. Scrivi nella specifica che la seconda direzione enumera
   l'albero delle rotte dai sorgenti, e che una rotta non rappresentata da un `page.tsx`
   non la vede.
3. **`contenuti-vivi`: «slot dichiarato senza riga pubblicata = MANCANTE» si decide col
   banco, non a tavolino.** Uno slot che il contratto dichiara e che nel database non ha
   nessuna riga pubblicata somiglia più a un `block` (la pagina dichiara un contenuto che
   non esiste) che a una verifica mancante. Prova i due casi sul banco, decidi, e scrivi
   nella specifica la scelta con la misura accanto.

## Deliverable

1. **Le quattro references di mestiere**: `struttura-pubblica.md`, `pagine-e-dati.md`,
   `contenuti-in-pagina.md`, `sabotaggio.md` (quest'ultima con un difetto da piantare per
   classe e il rosso atteso di ciascuno).
2. **`scripts/`**: `verify.mjs` (dieci passi, `id` stabili nell'ordine della specifica,
   `--json` conforme al contratto documentato, uscite 0/1/2, e **un test che blocca gli
   id e il loro ordine** — §15) · `vetrina-audit.mjs` (guscio di I/O) · `audit-lib.mjs` e
   `progetto-lib.mjs` (**regole pure, zero I/O**) · test
   `node --test "scripts/**/*.test.mjs"`: per ogni regola il caso in cui scatta **e**
   quello in cui non deve scattare.
3. **Guardiani della skill**: `package.json` (`private`, `"type": "module"`,
   devDependencies), `eslint.config.mjs` con le soglie della casa (`complexity 15`,
   `max-depth 4`, `max-params 4`), `knip.jsonc`;
   `resources/config/eslint-a11y.config.mjs` per il passo `a11y-statica`. Ogni script di
   agente nasce dentro questo perimetro o non è consegnabile (regola di schema-forge).
4. **Il banco**, usa e getta e **gitignorato** (`banco-prova*/` è già nel `.gitignore`;
   §12/§25: si butta a collaudo finito, i verbali restano): dominio semplice e diverso
   dai precedenti, schema **prodotto eseguendo schema-forge** (Flusso 1, con la tabella
   dei contenuti, il suo seed e le policy per `anon`: è il percorso di §24 — la tabella
   la chiede la vetrina, la scrive schema-forge), poi la vetrina costruita **col flusso
   vero della skill**: `specchio` (STOP: su questo banco conferma l'orchestratore, cioè
   tu, e lo scrivi nell'handoff come da §6) → `scaffold` → `pagine` → `audit` →
   `handoff` → `verify`.
5. **Tutti e sette i comandi esercitati almeno una volta** sul banco — `evolve` almeno
   su un caso reale semplice (B o E della sua tabella). Ciò che non eserciti **non si
   dichiara fatto**: si scrive nel verbale ed è il primo bersaglio del collaudo
   avversario. Il precedente è `evolve` di flow-sentinel: unico comando mai eseguito per
   tre fasi, e quando qualcuno l'ha provato copriva un caso su quattro.
6. **Sabotaggio**: almeno un difetto piantato per i passi `contratto-vetrina`,
   `cucitura-ui`, `chiavi-e-client`, `app-identita`, `pagine-vive`,
   `segnaposto-serviti`, `contenuti-vivi` — ognuno col suo rosso **misurato** (uscita
   incollata nel verbale), poi rimosso.
7. **Gate VERDE 10/10 sul banco pulito**, uscita incollata nel verbale. I dieci falsi
   verdi previsti dalla specifica (§Modi in cui questo gate potrebbe essere verde)
   diventano **test**.
8. **`STATO.md` aggiornato** coi numeri misurati (test verdi, difetti piantati/rilevati,
   comandi esercitati) e **verbale `COSTRUZIONE-<data>.md`** nella forma di quello di
   speed-demon.
9. **Solo a gate verde**, ed è l'unica eccezione al perimetro: aggiorna `README.md` — la
   riga 8 della pipeline passa da Fly UI a `vetrina-crafter` (Fly UI resta solo nella
   tabella §Natura degli agenti, 🔴 eventuale: se un giorno arriva entra nella cucitura,
   §21); la tabella §Natura degli agenti; la §Installazione delle skill con la nota per
   chi ha già installato, nello stile della riga su speed-demon — e
   `scripts/installa-skill.ps1` (la junction di `vetrina-crafter`). È la tradizione: una
   skill entra in elenco il giorno in cui smette di essere scaffold.

## Regole d'ingaggio

- **Una premessa si prova prima di diventare codice del gate** (§18): `fetch`, `psql`,
  `spawnSync` si misurano su casi reali prima di scrivere la regola. Le §Note di
  piattaforma della specifica (shim `.cmd` senza `shell: true`, CRLF/BOM, entità HTML e
  spazi) sono obbligatorie: questa casa le ha già pagate due volte ciascuna.
- **MANCANTE ≠ PASS**, e il bersaglio si stampa **anche sul verde** (§11): URL,
  `BUILD_ID`, database e schemi, conteggi di file letti.
- **Le regole nascono nelle lib pure, col test.** Un guscio non contiene giudizio.
- **Il banco resta su disco a fine pacchetto** (gitignorato): serve al direttore per
  rilanciare il gate in verifica, e a fine collaudo avversario per il controllo di
  non-regressione. Si butta a fine P.3.
- Fuori perimetro: tutto ciò che non è `agenti/vetrina-crafter/`, il banco, e — a gate
  verde — `README.md` + `scripts/installa-skill.ps1`. Le proposte agli altri agenti
  restano nello `STATO.md` §Proposte.
- Commit frequenti, messaggi in italiano nello stile della casa
  (`git log --oneline -15` prima di scrivere il primo).
- Tutto in italiano; chiavi JSON in inglese (§15).

## Verbale di chiusura (obbligatorio)

Riporta al direttore in un unico messaggio finale:

1. i numeri misurati: test verdi, difetti piantati/rilevati per passo, comandi
   esercitati (sette su sette, o quali no e perché);
2. l'uscita del gate sul banco pulito, **incollata**;
3. le premesse della specifica che la costruzione ha smentito, se ci sono, con la misura;
4. cosa NON è stato fatto, e perché;
5. la riga finale, testuale:
   `P1 consegnata. Gate: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)` — o il
   rosso vero, se è rosso.
