# Stato — Launchpad

- **Stato attuale:** **costruito e collaudato** (P.5 P0+P1+P2, 2026-08-06).
  SKILL.md completo, gate a **nove passi** con `--json`, **148 test** sugli
  script (erano 104 alla consegna), quattro reference, due template e un
  generatore di banco. Il collaudo avversario in chat vergine (P2) **e' stato
  fatto** ed e' costato **26 difetti**, di cui **nove falsi verdi con gravita' di
  blocco**; prima c'era stato un tribunale a tre periti, 32 rilievi.
  **Nessun deploy è mai stato eseguito da questa skill.** Vedi §Cosa non è mai
  stato provato.
- **I due difetti che vale la pena sapere prima degli altri**, e nessuno dei due
  era nel gate: il **rimedio che questa skill scrive** nel `next.config.ts` del
  cliente **non compilava** sotto `strict`, e faceva nascere un artefatto che
  dichiarava **l'identita' di un altro repository** quando il progetto stava
  dentro un repository che non lo tracciava. Il terzo: il gate aveva un **rosso
  strutturale contro se stesso** — la riga che launchpad scrive faceva scadere
  tutti i certificati a monte.
- **Proprietario:** Alberto
- **Dipendenze:**
  - **A monte:** tutti e cinque gli agenti costruttori (schema-forge,
    vetrina-crafter, gestionale-crafter, flow-sentinel, speed-demon) più
    cyber-shield e site-doctor quando esisteranno. La condizione che due di loro
    hanno posto **prima che questo agente esistesse** — *non si pubblica su gate
    rosso* (`flow-sentinel/STATO.md`, `speed-demon/STATO.md`) — è diventata la
    **Legge n°1**.
    Il legame con **site-doctor** è un **contratto letto da file**, non una
    dipendenza di codice: se il certificato di idoneità non c'è, il passo è
    MANCANTE — non `PASS`, e non un errore.
  - **A valle:** demoniac (video demo sul sito online, opzionale).

## Cosa fa, in una riga

Non pubblica: **decide se si può pubblicare**, e fa firmare a un umano cosa va
online. Il deploy è ciò che succede quando il cancello si apre.

## Il gate — nove passi

| # | `id` | misura o legge? |
|---|---|---|
| 1 | `radice-pulita` | **misura** |
| 2 | `catena-gate` | **legge** il verdetto, **misura** la freschezza |
| 3 | `debito-bloccante` | **legge** il registro, **misura** la corrispondenza col runbook |
| 4 | `segreti` | **misura** |
| 5 | `ambiente` | **misura** |
| 6 | `runtime-riproducibile` | **misura** |
| 7 | `impronta-artefatto` | **misura** |
| 8 | `runbook-firmato` | **misura** la forma, **legge** il contenuto |
| 9 | `contratto-uscita` | **misura** |

La tabella completa — cosa resta indimostrato passo per passo — è in
`references/verifica-deterministica.md` §2. È la sezione da leggere per prima:
è la differenza fra un certificato e una promessa.

## Piano P0 → P3

| Fase | Cosa | Stato |
|---|---|---|
| **P0** — progettazione | il gate scritto **prima** del flusso: nove passi, premessa e MANCANTE, contratto `--json`, otto falsi verdi possibili, passi scartati col perché | **fatta** — `references/verifica-deterministica.md`, 2026-08-06 |
| **P0b** — la sosta di metà pacchetto | rilettura della progettazione con una domanda sola: *quale passo potrebbe essere verde su un deploy che non si deve fare?* | **fatta** — sei risposte, tutte diventate regole (§8 della reference). Una era un difetto che sarebbe stato spedito |
| **P1** — costruzione | `verify.mjs` + tre librerie pure + due gusci; 105 test; 4 reference; 2 template | **fatta** — 2026-08-06 |
| **P1b** — sabotaggio | un difetto per classe, e il rosso misurato | **fatta** — gemello pulito VERDE 9/9, **36 classi, 36 rosse, 0 non prese** |
| **P1c** — tribunale (`/code-inquisition`, council di 3) | tre periti in isolamento, modelli diversi, posture avversarie distinte | **fatto** — **32 rilievi, 32 chiusi**, ognuno col suo test di regressione. Il più grave: il rimedio che questa skill prescrive **rompeva la build del cliente** su un `next.config.mjs` |
| **P2** — collaudo avversario, in chat vergine | il gate è il contratto sotto esame; il verbale di costruzione è un'affermazione da verificare | **fatto** — 2026-08-06, `COLLAUDO-2026-08-06.md`. **26 difetti, 26 chiusi**, ognuno con la sua misura prima/dopo e il suo test. Banco nuovo (studio dentistico) costruito dai soli documenti: **VERDE 9/9**, e ricostruibile con `scripts/banco.mjs`. **Quattro** affermazioni del verbale di costruzione non si riproducono: 105 test erano 104, «5 warning» erano 8, «0 cloni» erano 4, e `banco.mjs` non esisteva. Le 36 classi di sabotaggio invece **reggono**: 31 rilanciate, 31 rosse sul passo giusto |
| **P3** — il primo deploy vero | **lo autorizza Alberto di persona.** È l'unica cosa che questa skill non ha potuto provare, ed è il suo mestiere | **da fare** |

## Cosa un gate verde NON prova

La riga che va letta due volte, e che ha un posto d'onore nello `SKILL.md`:

> **Un gate verde non prova che il sito sia pronto per il suo pubblico. Prova
> che è pronto per il trasporto.**

Questo gate misura il *pacchetto* e il *viaggio*: che parta il commit giusto,
che non porti segreti, che si ricostruisca uguale altrove, che si possa
dimostrare cosa è arrivato e tornare indietro. Non guarda **niente** di ciò che
il sito fa: non una pagina, non un flusso, non una query, non un numero. Quei
verdetti li dànno i quattro gate a monte, e questo agente li **legge**.

L'elenco completo è in `SKILL.md` §Cosa un gate verde NON prova. Le tre voci che
pesano di più:

- **che i gate a monte fossero verdi davvero.** `catena-gate` legge una riga
  scritta da chi l'ha eseguito, e ne misura solo la scadenza. Rilanciarli da qui
  è stato **valutato e scartato**, coi tre motivi in
  `references/verifica-deterministica.md` §6;
- **che non ci siano segreti.** Prova che non ce ne sono *delle sei famiglie di
  contenuto e delle due regole sul nome*, nei file letti — tracciati, nuovi,
  ignorati, e nella storia (diff **e** messaggi di commit e di tag). Un segreto
  codificato due volte, spezzato su due righe o dentro un binario vero passa;
- **che il file letto sia quello che parte.** Ogni passo apre il file **sul
  disco**, non il blob del commit: a rendere le due cose la stessa è
  `radice-pulita`, ed è il motivo per cui quel passo non è un preliminare
  cortese;
- **che il rollback funzioni.** Il gate legge una procedura scritta. Che
  funzioni si scopre la prima volta che serve.

## Cosa non è mai stato provato — l'elenco onesto

**Nessun deploy è stato eseguito.** Non un account creato, non un repository
collegato, non un dominio comprato, non un record DNS toccato, non un centesimo
speso. È la §6 applicata al mestiere che è l'unico irreversibile della pipeline,
ed era una condizione esplicita del mandato di P.5.

Di conseguenza **non sono mai stati esercitati contro il mondo**:

1. il comando `pubblica` — esiste come procedura, non è mai stato eseguito;
2. la procedura di rollback, su nessuno dei due provider;
3. `verifica-pubblicato` **contro un dominio vero** (è stato esercitato contro
   una build di produzione servita in locale: prova il **meccanismo**, non la
   pubblicazione);
4. il comportamento di `generateBuildId` **sulla macchina di un provider** —
   cioè la premessa su cui poggia tutta la Legge n°4;
5. che `engines.node` venga rispettato da un provider (non lo impone nessuno
   senza `engine-strict`);
6. il certificato SSL, la propagazione DNS, la coerenza fra apex e `www`;
7. il costo vero di una pubblicazione.

Sono il mandato del collaudo di P.5, ed è giusto che ci vada un umano.

## Non usabile su un progetto cliente

Resta **un** motivo, ed è quello che conta:

**Il primo deploy non è ancora avvenuto.** Tutto ciò che sta qui sopra è
misurato su due banchi e su un pilota che **non si deve pubblicare**. Fra «il
gate rifiuta correttamente» e «il deploy riesce» c'è esattamente lo spazio dove
vivono i guasti di questa fase.

Il secondo motivo — *il collaudo avversario indipendente non è stato fatto* — è
caduto il 2026-08-06, e ha confermato la regola della casa per la sesta volta su
sei: il collaudo ha trovato qualcosa, e **gli strumenti statici erano tutti
verdi**.

## Proposte a monte

Cose che questo agente ha **misurato** e che non può chiudere da solo.

| A chi | Cosa | Perché |
|---|---|---|
| **schema-forge** | il template del seed produca **due file distinti** fin dall'inizio: `seed di riferimento` (ogni ambiente) e `seed di sviluppo` (mai in produzione), col secondo che porta già la riga `-- launchpad-consentito: credenziale-sql — …` | il pilota ci è arrivato **a un passo dal deploy** (debito n°27) e ha dovuto separarli in P.4g. Nascere separati costa una riga; separarli dopo costa un debito che blocca la pubblicazione |
| **schema-forge** | dichiarare `engines.node` in `package.json` alla nascita del progetto, derivandolo dal massimo di ciò che le dipendenze pretendono | il pilota è arrivato a P.5 senza (debito n°32), e **il sito non si costruiva** su Node 20. Il gate lo misura, ma misurarlo dopo è tardi |
| **vetrina-crafter** e **gestionale-crafter** | scrivere `generateBuildId` derivato dal commit già nello scaffold | è la sola prova d'identità che sopravvive alla ricostruzione del provider, e oggi il progetto generato non ce l'ha |
| **tutti e cinque** | l'handoff **si ridata** quando il codice cambia dopo | sul pilota, al 2026-08-06, **quattro handoff su cinque** sono più vecchi dell'ultimo commit di codice: i certificati ci sono e sono scaduti |
| **cyber-shield** (🔵) | la limitazione di frequenza. Il pilota la dichiara come prescrizione di deploy in **due** voci (n°4 e n°17) | non è materia di questa skill, e finché cyber-shield non esiste resta una riga nel runbook invece che una difesa |

## Proposte a valle

| A chi | Cosa |
|---|---|
| **demoniac** | l'handoff di launchpad dichiara dominio, commit e impronta: è da lì che si sa quale versione del sito sta riprendendo il video |
| **chi mantiene** | `docs/deploy.md` è l'unico documento del progetto scritto perché una persona che non c'era sappia **rifare** e **disfare**. La firma **si rinnova** a ogni pubblicazione: una firma più vecchia dell'ultimo commit ha autorizzato un altro contenuto |

## Le tre decisioni che restano alla direzione

Misurate dal collaudo e **non** chiuse da qui, perché chiuderle sarebbe
riscrivere il contratto dell'agente. Per esteso in `COLLAUDO-2026-08-06.md` §9-10.

1. **La firma per delega** su `docs/deploy.md`. Il gate oggi l'accetta e la
   dichiara con un `warn`: la D14 ha introdotto quella forma per **due contratti
   di collaudo**, la §6 vieta di delegare ciò che non si annulla, e questo
   documento autorizza l'unica azione irreversibile della pipeline.
2. **La §19 e la citazione.** Un `> Gate: VERDE` copiato da un altro progetto
   vale come verdetto di questo. Per gli altri cinque agenti la §19 vale su un
   documento proprio; launchpad è l'unico che legge **certificati altrui**.
3. **Il registro del debito con una riga di forma fissa** (`Blocca il deploy:
   sì | no`) invece della prosa. L'elenco delle forme che il gate riconosce è
   aperto per costruzione: il collaudo ne ha scavalcate due e ne ha aggiunte due,
   e la prossima persona ne inventerà una terza.

## Verbali

- `COSTRUZIONE-2026-08-06.md` — progettazione e costruzione (P.5, P0+P1).
- `COLLAUDO-2026-08-06.md` — collaudo avversario indipendente (P.5, P2):
  26 difetti misurati e chiusi, l'audit delle affermazioni del verbale di
  costruzione, le tensioni con la `SKILL.md`.
