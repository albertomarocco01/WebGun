# Mandato P.4f — `evolve` di Schema Forge sul pilota: i due debiti verso monte

> Emesso dal direttore dei lavori il 2026-08-06. Da incollare in una chat operaia
> nuova, aperta da terminale esterno nella radice del pilota
> `C:\Users\Utente\Desktop\fornodoro`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` della regia, riga **P.4f**; decisioni **D8, D13,
> D14, D15**. La regia è `C:\Users\Utente\Desktop\WebGun`.

## Perché esisti

P.4 è chiusa: cinque anelli, cinque gate verdi, verbale di catena
`PILOTA-2026-08-06.md`. Restano **due debiti che puntano verso monte** — allo
schema — e che nessun anello poteva chiudere mentre la catena camminava sopra:

- **n°11** — `crea_ordine(ritiro_at timestamptz)` **casta l'argomento prima**
  che il corpo della funzione giri: un errore nativo di Postgres esce al
  client. È esattamente la classe che l'indurimento di P.4a dichiarava chiusa
  («valida la forma prima del cast»), sull'unico argomento non-`text`.
  Mitigato lato sito da P.4b, mai chiuso.
- **n°22** — un titolare cambia il ruolo di un collega **e ne crea uno nuovo**
  via HTTP diretto (`PATCH /rest/v1/personale`, misurato: 200). La riga dello
  Specchio del gestionale che diceva «non raggiungibile da un browser» era
  **falsa**, e la correzione è scritta sopra la firma. **D15** ha già deciso la
  strada: `revoke update (ruolo)` più una funzione `cambia_ruolo()`.

E c'è una seconda ragione, non minore: **`evolve` è l'unico comando di
schema-forge che il pilota non ha mai attraversato.** Questo pacchetto è anche
il suo collaudo su un progetto vero — cioè il caso reale del cliente che cambia
idea a sito fatto, con quattro anelli già costruiti sopra.

## Regola di regime: **arrivi in fondo da solo** (D14)

Nessuna domanda al committente. Ogni scelta la prendi tu e la scrivi nel
verbale con la motivazione in una riga (tabella in testa, come i verbali di
P.4d e P.4e). **Eccezione che resta**: gli **STOP sui distruttivi** che la
skill prescrive dentro `evolve` non si delegano a te stesso — se un passo
distrugge dati, ti fermi, lo scrivi, e proponi la strada non distruttiva. Su
questo pilota non dovrebbe servirne nessuno: se ne serve uno, è un segnale che
la strada è sbagliata.

## Prerequisito — la catena, per intero

Leggi **i quattro handoff** (`07`, `08`, `10`, `12`, `13`), i tre contratti
firmati, `docs/DEBITO-TECNICO.md` (**32 voci**) e il verbale di catena
`<regia>/PILOTA-2026-08-06.md`. Poi `agenti/schema-forge/SKILL.md` §`evolve` e
`references/migrazioni.md`.

**Stato della macchina all'emissione**: stack fornodoro acceso (7621/7622),
app di produzione viva sulla 3621, build `p1ETtUu2HEAB4sH7mKrJW`, cinque gate
verdi. È la linea di partenza: qualunque cosa non sia verde alla fine è tua.

## Il lavoro

### 1. Expand-contract, non «una migrazione che aggiusta»

Migrazioni **nuove** (le precedenti sono immutabili: hanno un handoff e quattro
consumatori). Analisi di impatto **prima**, come prescrive la skill: `grep` sui
consumatori veri, tipi, handoff a valle, conteggio delle righe reali. I
consumatori di `personale` e `crea_ordine` sono il gestionale (P.4c) e la
vetrina (P.4b): guardali, non immaginarli.

### 2. n°11 — validare prima del cast

`ritiro_at` deve arrivare alla funzione in una forma che il **corpo** possa
validare, così il rifiuto è un messaggio di regola e non un errore nativo. La
strada la scegli tu (argomento `text` validato e poi convertito, o una funzione
che valida a monte): dichiarala e **provala nelle due direzioni** — un orario
valido passa, uno malformato riceve il messaggio di regola, non
`22007 invalid input syntax`. La prova si fa **contro l'endpoint vero**, non
solo in pgTAP: il difetto nasce proprio dove pgTAP non arriva (chiama da dentro
il database, e P.4c l'ha già misurato).

### 3. n°22 — il ruolo si cambia da una porta sola

`revoke update (ruolo)` a `authenticated`, più `cambia_ruolo()` come unica via.
Tre cose da non sbagliare, e sono tutte già misurate in questa catena:

- **`grant insert` è di tabella intera**: se resta, un titolare crea un
  titolare nuovo e il `revoke` sulla colonna non serve a niente. Chiudi
  entrambe le metà o non hai chiuso niente.
- **L'invariante «resta sempre almeno un titolare attivo»** (IAM-1) deve
  sopravvivere: `cambia_ruolo()` non può degradare l'ultimo titolare.
- **Il test che non prova quello che dice**: P.4a ne ha trovato un esemplare
  vivo («la cucina non si promuove» restava verde col trigger rimosso, perché
  la policy filtrava già tutto per quell'attore). Ogni asserzione nuova va
  **sabotata**: togli la difesa, il test deve diventare **rosso**. Se resta
  verde, non prova quello che dichiara — riscrivilo.

### 4. Il seed e i consumatori si riallineano

`seed.sql` resta idempotente e rieseguibile **a caldo** (P.4a l'ha provato tre
volte con stati e conteggi identici: non regredire). I tipi si rigenerano
(**da Git Bash**: la redirezione di PowerShell scrive UTF-16). Se il
gestionale chiamava `update` diretto sul ruolo, ora chiama la funzione: è
codice del pilota, sei autorizzato a toccarlo — dichiaralo.

## Gate — la prova che vale il pacchetto

Alla fine **tutti e cinque verdi, rilanciati da te**, sulla build ricostruita:

| gate | note |
|---|---|
| schema-forge 9/9 | il tuo |
| flow-sentinel 7/7 | **`--url http://127.0.0.1:3621`** — 22 test devono restare verdi |
| gestionale 7/7 · vetrina 10/10 | app viva, build nuova |
| speed-demon 7/7 | **col Node 24** (`URL.parse`, debito n°31: senza, la categoria SEO resta senza punteggio e il gate blocca correttamente) |

**È questa la vera prova di P.4f**: non che la migrazione sia bella, ma che
**quattro anelli costruiti sopra reggano una modifica dello schema**. Se un
gate a valle diventa rosso, quello è il risultato del pacchetto — si misura, si
scrive, si corregge nel pilota; non si aggira.

Poi `code-maniac scan` e `/code-inquisition --focus security` sulle migrazioni
nuove. Nei cinque anelli il tribunale ha trovato qualcosa **ogni volta**.

## Handoff e verbale

- **`docs/handoff/07-schema-forge.md` aggiornato** (è il suo posto: lo schema è
  suo), con le due voci di debito **chiuse con la misura** e la riga `Gate:`
  veritiera. Se aggiorni il 07, dichiara in testa che il 08/10/12/13 sono stati
  scritti **prima** di questa modifica e cosa di loro non vale più.
- Verbale nella regia: `agenti/schema-forge/PILOTA-EVOLVE-2026-08-<gg>.md`, con
  la tabella delle scelte autonome in testa, le uscite **incollate**, e una
  sezione finale: **«`evolve` su un progetto vero: cosa ha retto e cosa no»** —
  è il collaudo del comando, e nessuno l'ha mai fatto.

## Coordinamento (D8)

Nel pilota commit piccoli e frequenti; nella regia solo il verbale e le righe di
`STATO.md` per i difetti veri della skill (la riga, non la correzione). Non
toccare `CANTIERE.md`, `prompts/`, le skill, i banchi, il docx.
Un solo stack acceso, un gate alla volta.

## Riga finale del verbale

`P.4f consegnata. I debiti n°11 e n°22 sono chiusi con la misura (<come>), il
sabotaggio dice che le asserzioni nuove sanno diventare rosse, e tutti e cinque
i gate del filo sono verdi dopo un evolve dello schema: la catena regge una
modifica a valle costruita. Il debito è passato da 32 a <n> voci.`
— o la verità, se è un'altra.
