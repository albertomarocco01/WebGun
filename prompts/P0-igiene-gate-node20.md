# Mandato P.0-igiene — I gate tornano a parlare su Node 20

> Emesso dal direttore dei lavori il 2026-08-03. Da incollare in una chat operaia nuova,
> distinta da quella di P.2. **Modello consigliato: Opus 5 · effort max.**
> Contabilità: `CANTIERE.md` (voci del 2026-08-03).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto è
chirurgico: **cinque `if (import.meta.main)` in quattro skill** rendono i gate muti sul
Node di sistema di questa macchina.

**Il difetto, verificato dal direttore nelle due direzioni il 2026-08-03.**
`import.meta.main` esiste da Node 24. Su Node 20.12.2 — il `node` di sistema — vale
`undefined`: `main()` non parte e **il gate esce `0` senza stampare una riga**, cioè un
verde che non ha guardato niente, per chiunque lo lanci da script o da terminale. Su
Node 24.18.1 (`~/scoop/apps/nodejs-lts/current/node.exe`) gli stessi comandi parlano ed
escono col codice giusto. I prerequisiti dichiarati delle skill dicono «Node ≥ 20»: il
codice viola il proprio contratto scritto. I verdi storici non erano falsi (i collaudi
di luglio giravano su Node 24.14): è questa macchina che non poteva più eseguirli, in
silenzio.

I cinque punti:

- `agenti/schema-forge/scripts/verify.mjs:649`
- `agenti/gestionale-crafter/scripts/verify.mjs:427`
- `agenti/gestionale-crafter/scripts/admin-audit.mjs:208`
- `agenti/flow-sentinel/scripts/verify.mjs:455`
- `agenti/speed-demon/scripts/verify.mjs:559`

## Leggi prima, in quest'ordine

1. `CLAUDE.md`; `CANTIERE.md`, le voci del 2026-08-03.
2. **La forma corretta, già scritta e collaudata** (113 test verdi):
   `agenti/vetrina-crafter/scripts/verify.mjs` (il commento verso riga 554 e l'epilogo
   che ne segue) e `agenti/vetrina-crafter/scripts/vetrina-audit.mjs` (verso riga 290).
   **Copia quella forma** — non inventarne una terza.
3. `DECISIONI.md` §18 — uno strumento che non ha letto niente non produce un `pass`;
   qui lo strumento non era nemmeno partito.
4. `agenti/schema-forge/STATO.md` §Note operative (Windows) — il glob giusto di
   `node --test`, gli shim, le trappole di piattaforma.

## Deliverable

1. **I cinque punti corretti** con la forma di vetrina-crafter, a comportamento
   invariato su Node 24: stessi codici d'uscita, stesse stampe.
2. **Due test di regressione per script, nella suite della propria skill** — e il
   perché dei due va capito prima di scriverli:
   - *funzionale*: esegue lo script con `process.execPath` in una cartella temporanea
     che **non** è un progetto e pretende **uscita ≠ 0 E almeno una riga di output**.
     Uno script che esce `0` muto fa fallire il test. Protegge da tutta la classe
     «epilogo che non parte» — ma **su Node 24 non vede questo difetto specifico**,
     perché lì `import.meta.main` funziona;
   - *statico*: il sorgente dello script **non contiene** `import.meta.main`. È l'unico
     dei due che impedisce il ritorno del difetto su qualunque Node. Brutale, e va
     bene così: il commento del test spiega il perché.
   Prima del test funzionale, guarda cosa fa davvero ogni gate in una cartella
   non-progetto: hanno convenzioni proprie (schema-forge esce `2` con messaggio).
3. **La prova nelle due direzioni, incollata nel verbale**, per tutti e cinque gli
   script: lanciati in una cartella non-progetto con il `node` di sistema (20.12.2) E
   con `~/scoop/apps/nodejs-lts/current/node.exe` (24.18.1). Dopo la correzione devono
   parlare ed uscire **con lo stesso codice** su entrambi.
4. **La prova sul campo**: il gate di schema-forge rilanciato dalla radice di
   `banco-prova-vetcare` (acceso, porte 57321/57322) **col node di sistema**. Verdetto
   atteso, identico alla misura del direttore con Node 24: **ROSSO, 1 fallito** (pgTAP:
   `permission denied`) **e 2 verifiche mancanti** (sqlfluff, squawk) su 9 passi. Quel
   rosso è **atteso e non lo correggi**: i GRANT sono il pacchetto P.8, non questo.
5. **Le batterie esistenti delle quattro skill rilanciate**, coi conteggi incollati:
   attese 144 (schema-forge), 105 (gestionale-crafter), 108 (flow-sentinel), 73
   (speed-demon), più i tuoi test nuovi. Comando: `node --test "scripts/**/*.test.mjs"`
   dalla cartella di ogni skill, virgolette comprese.
6. **Una riga datata negli `STATO.md` delle quattro skill**: il difetto, la correzione,
   come si è provata. Niente riscritture del resto.
7. **Commit** con messaggi in italiano nello stile della casa (`git log --oneline -15`).

## Fuori perimetro

- Qualunque altro refactoring: «già che ci sei» non esiste in questo mandato.
- Gli snapshot esterni (code-maniac, code-inquisition, bugbay): il grep del direttore
  li ha già verificati **esenti** dal difetto.
- Le migrazioni del banco (`banco-prova-vetcare`): sono materia di P.8.
- `agenti/vetrina-crafter/`: è già corretta, ed è il modello.

## Verbale di chiusura (obbligatorio)

Riporta al direttore in un unico messaggio finale:

1. le prove due-direzioni incollate (5 script × 2 node);
2. i conteggi test per skill, prima e dopo;
3. l'esito del gate sul banco col node di sistema, incollato;
4. la riga finale, testuale:
   `P.0-igiene consegnata. Prove: eseguite (5/5 script, 2 node, gate sul banco).`
