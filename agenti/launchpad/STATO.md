# Stato — Launchpad

- **Stato attuale:** **costruito e non collaudato** (P.5, 2026-08-06). SKILL.md
  completo, gate a **nove passi** con `--json`, 87 test sugli script, 36 classi
  di sabotaggio tutte rosse, quattro reference e due template.
  **Nessun deploy è mai stato eseguito da questa skill.** Vedi §Cosa non è mai
  stato provato.
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
| **P1** — costruzione | `verify.mjs` + due librerie pure + due gusci; 87 test; 4 reference; 2 template | **fatta** — 2026-08-06 |
| **P1b** — sabotaggio | un difetto per classe, e il rosso misurato | **fatta** — gemello pulito VERDE 9/9, **36 classi, 36 rosse, 0 non prese** |
| **P2** — collaudo avversario, in chat vergine | il gate è il contratto sotto esame; il verbale di costruzione è un'affermazione da verificare | **da fare** |
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
- **che non ci siano segreti.** Prova che non ce ne sono *delle sei famiglie che
  sa riconoscere*, nei file letti. Un segreto codificato due volte, spezzato su
  due righe o dentro un binario passa;
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

Per due motivi distinti, e vanno tenuti separati:

1. **Il primo deploy non è ancora avvenuto.** Tutto ciò che sta qui sopra è
   misurato su un banco e su un pilota che **non si deve pubblicare**. Fra
   «il gate rifiuta correttamente» e «il deploy riesce» c'è esattamente lo
   spazio dove vivono i guasti di questa fase.
2. **Il collaudo avversario indipendente (P2) non è stato fatto.** Sulle cinque
   skill che l'hanno avuto, il tribunale ha trovato qualcosa **ogni volta** —
   11+6+5+21+6 rilievi — e gli strumenti statici erano **tutti verdi ogni
   volta**. Non c'è motivo di credere che questa sia diversa.

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

## Verbali

- `COSTRUZIONE-2026-08-06.md` — progettazione e costruzione (P.5, P0+P1).
