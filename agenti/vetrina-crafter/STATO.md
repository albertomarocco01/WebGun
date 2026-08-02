# Stato — Vetrina Crafter

- **Stato attuale: progettata (P0), in attesa di conferma del committente.** Esistono
  `SKILL.md`, la specifica del gate (`references/verifica-deterministica.md`) e i due
  template del contratto e dell'handoff. **Non esiste una riga di codice**: `scripts/`
  contiene il solo `.gitkeep`, non c'è nessun `package.json`, nessun test, nessun banco.
  Il gate è **scritto e non eseguito**: dieci passi progettati con premessa, esito e
  condizione di MANCANTE, zero passi provati. Finché P1 non gira, ogni affermazione di
  questo file su cosa il gate «fa» va letta come *cosa il gate dovrà fare*.
- **Non usabile su nessun progetto**, nemmeno di prova: è una progettazione, e la casa ha
  già misurato quanto vale una prosa non eseguita — sei dei diciassette difetti del
  collaudo avversario di speed-demon erano **già descritti dentro le references della
  skill** e non implementati. *La prosa sapeva, il codice no.* Questo documento è, oggi,
  solo prosa.
- **Proprietario:** Alberto
- **Dipendenze:**
  - **A monte:** **schema-forge** (tabelle, viste, policy di lettura per il ruolo
    anonimo, tabella dei contenuti e suo seed, tipi generati) · brief-smith (quali pagine
    e quali contenuti vuole il cliente) · prompt-smith (richiesta professionale)
  - **A fianco:** **gestionale-crafter** — non è un prerequisito, ma lavora sulla
    **stessa tabella di slot**: le chiavi devono coincidere, e chi arriva secondo legge
    l'handoff del primo invece di inventarsele. Condivide anche la cucitura
    `src/components/ui/`: chi arriva dopo **la estende**, non la riscrive
  - **A valle:** **flow-sentinel** (i flussi pubblici che questa vetrina apre sono
    l'ingresso del suo `map`) · **speed-demon** (misura e ottimizza queste pagine, e
    `docs/vetrina.md` è la fonte del suo elenco) · **site-doctor** (conformità: cookie,
    OG, favicon, `robots.txt`, contrasti) · cyber-shield (superficie pubblica) ·
    launchpad (non pubblica su gate rosso)
  - **Fly UI non è una dipendenza e non lo diventerà:** non esiste
    (`../../DECISIONI.md` §21). I componenti si scrivono a mano dietro la cucitura. Anche
    **sites-effects** resta fuori: è una libreria esterna che in questo repo non c'è, e
    un progetto che la adotta lo dichiara come deroga in `docs/PROGETTO.md`
- **Guardiani:** **nessuno, e non è un residuo: non c'è niente da guardare.** ESLint,
  `knip`, `jscpd`, `semgrep` e `/code-inquisition` entrano in P1, sugli script. Vale come
  MANCANTE, non come PASS.

## Cosa fa, in una riga

Costruisce le pagine pubbliche di un progetto Web Gun sopra lo schema di schema-forge —
layout, componenti dietro la cucitura, lettura dei dati con la chiave anonima, contenuti
presi dalle tabelle degli slot — e si rifiuta di consegnarle se una pagina dichiarata non
risponde, se una pagina servita non è dichiarata, se nel testo servito c'è ancora un
segnaposto, se un contenuto editabile è cablato nel codice invece che nel database, o se
una chiave di servizio è raggiungibile dal sito pubblico.

## Piano P0 → P3

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione: `SKILL.md`, specifica del gate a dieci passi, template del contratto e dell'handoff, questo `STATO.md` | qui | **fatta il 2026-08-02** — in attesa della conferma del committente |
| P1 | costruzione: le quattro references di mestiere, `scripts/` (gate + lib pure + test), `resources/config/` (ESLint a11y), `package.json` della skill, banco usa e getta, sabotaggio provato | chat dedicata, dopo la conferma di P0 | da fare |
| P2 | collaudo avversario indipendente su **dominio diverso**: caccia ai falsi verdi dei dieci passi, ognuno misurato prima e dopo la correzione, un test di regressione per difetto | chat vergine (chi costruisce non collauda) | da fare |
| P3 | primo consumatore reale: la vetrina di un progetto che attraversa la catena intera, col contratto firmato da un **committente** e non da chi costruisce | pacchetto «filo completo» | da fare |

Il piano è quello di flow-sentinel, e la ragione per copiarlo è misurata: le sue P1, P2 e
P3 hanno trovato rispettivamente 5, 10 e 2 difetti, e **sette dei dieci di P2 erano falsi
verdi** — il gate diceva verde senza aver guardato. Una skill che salta P2 non è una
skill collaudata: è una skill che nessuno ha provato a smentire.

## Cosa esiste, misurato

| Cosa | Numero | Come è stato misurato |
|---|---|---|
| `SKILL.md` | 244 righe | `wc -l` |
| Specifica del gate (`references/verifica-deterministica.md`) | 481 righe | `wc -l` |
| Template | **2** — `vetrina.md` (405 righe) · `handoff-vetrina-crafter.md` (226 righe) | `wc -l` |
| Passi del gate **progettati** | **10**, con id stabile, premessa, esito e condizione di MANCANTE | §Gate della `SKILL.md` |
| Passi del gate **eseguiti** | **0** | non esiste `scripts/verify.mjs` |
| Comandi dichiarati | 7 — `specchio`, `scaffold`, `pagine`, `audit`, `evolve`, `verify`, `handoff` | tabella §Comandi |
| Comandi implementati | **0** | `scripts/` contiene il solo `.gitkeep` |
| Falsi verdi previsti e con contromisura scritta | **10** | `references/verifica-deterministica.md` §Modi in cui questo gate potrebbe essere verde |
| Test degli script | **0** | non c'è codice |

## Decisioni prese in P0

Le sei che cambiano la forma dell'agente. Le altre stanno nei documenti dove servono.

1. **Il perimetro è scritto in una tabella, non dedotto.** `SKILL.md` §Perimetro elenca
   riga per riga cosa è di questa skill e cosa è di speed-demon, flow-sentinel,
   site-doctor, gestionale-crafter, schema-forge e cyber-shield. *Motivo:* un perimetro
   non dichiarato lo si scopre litigando su un file, e in questa pipeline il primo
   candidato al litigio era il SEO — che qui è stato **diviso**, non condiviso.
2. **`title` e `description` sono di questa skill; `canonical`, `robots`, `sitemap` e
   Open Graph no.** Il titolo di una pagina viene dalla stessa riga di database da cui
   viene la pagina: è **contenuto**, e chi lo scrive è chi costruisce la pagina. Tutto il
   resto è indicizzazione e sta a speed-demon. *Motivo:* il suo passo `seo-meta` sa
   contare i `title` e i `canonical` invece di cercarli, e sa leggere l'HTML senza
   seguire i rimandi — due lezioni pagate con dodici falsi verdi. Riscriverle qui
   significherebbe ripagarle, e poi mantenerle in due copie destinate a divergere.
   **Conseguenza dichiarata:** il mio gate non guarda **nessun** metatag; se speed-demon
   non gira, di quelle pagine nessuno verifica i metadati.
3. **Il gate ha dieci passi, più di ogni altro della casa** (7, 7, 7, 9). *Motivo:*
   ognuno costa una lettura di file, una `fetch` o una query, e questo è l'unico agente
   il cui prodotto lo legge chi non ci ha mai parlato. Se in P1 due passi si rivelano lo
   stesso passo si fondono **allora**, con la misura in mano, non adesso per simmetria.
4. **`contenuti-vivi` è il passo che questa skill ha in più, e prova la Legge n°3 in due
   direzioni**: il testo di uno slot deve stare **nel database e in pagina**, e **non**
   nei sorgenti. *Motivo:* la prima metà da sola non distingue un contenuto letto dal
   database da un contenuto cablato che per caso coincide; la seconda è quella che
   trasforma «i contenuti li legge dal database» da promessa in misura. La terza regola
   dello stesso passo — contare le righe leggibili **impersonando il ruolo anonimo** —
   copre il modo n°1 in cui un sito pubblico sopra la RLS fallisce in silenzio: la
   pagina è viva, è vuota, e non dà nessun errore.
5. **Lo STOP umano non è uno solo.** Lo Specchio della vetrina si può delegare
   all'orchestratore in pipeline; **quali dati vede un anonimo** e **se esiste un
   percorso di scrittura pubblico** no, mai. *Motivo:* è `DECISIONI.md` §6 applicata a
   questo mestiere — pubblicare un dato è irreversibile nel solo modo che conta: dopo, è
   di chi l'ha copiato. Per questo il contratto ha una sezione §Dati visibili a un
   anonimo con la sua firma, e l'handoff ha una §4 che nessun altro handoff della casa ha.
6. **La soglia distintiva degli slot (24 caratteri) è dichiarata come convenzione, non
   come misura.** *Motivo:* è la stessa onestà dei tre giri di Lighthouse. Sotto la
   soglia il passo dichiara lo slot **non verificato** invece di promuoverlo: su un
   valore corto entrambe le ricerche darebbero risposte casuali. Il numero vero si ricava
   in P1 su un progetto vero, guardando quanti slot restano fuori.

## Cosa un gate verde NON prova

Scritta per intero in `SKILL.md` §Cosa un gate verde NON prova — dodici voci, di cui le
tre che contano di più: il gate legge **la firma** del contratto e non la sua verità; non
sa se quello che la pagina mostra **debba** essere pubblico; e non vede una colonna
selezionata e non disegnata, che viaggia lo stesso nell'HTML servito e nel payload RSC.

La sezione è stata scritta **in P0 e non a posteriori**, che è il motivo per cui esiste
la richiesta della casa: scriverla dopo un collaudo verde significa scriverla mentre si
ha interesse a essere brevi.

## Punti aperti — ordinati per gravità

1. **Niente di tutto questo è stato eseguito.** È un progetto, e la casa ha misurato due
   volte cosa succede a una prosa che nessuno esegue: la procedura di `evolve` di
   flow-sentinel copriva un caso su quattro e nessuno se n'era accorto in tre fasi; sei
   dei diciassette difetti di speed-demon erano già scritti nelle sue references. **Il
   primo difetto di questa progettazione lo troverà chi la implementa**, ed è normale:
   quello che non è normale sarebbe crederla verificata perché è scritta bene.
2. **Nessun committente ha firmato niente.** È lo stesso punto aperto n°1 di speed-demon
   e il secondo di flow-sentinel, ereditato prima ancora di nascere: il contratto della
   vetrina prevede una firma con nome e ruolo, e finché a firmare è chi costruisce o chi
   collauda, il gate legge la firma di sé stesso. Si chiude in P3, con un cliente.
3. **Tre passi su dieci hanno un falso positivo dichiarato e non misurato.** La data
   della firma contro l'handoff di schema-forge (un handoff riscritto per un refuso
   invecchia una firma buona); la data della build contro i sorgenti (un `git checkout` o
   un formattatore); i segnaposto nel testo servito (un progetto che parla di template).
   Tutti e tre producono **rossi**, e un rosso strutturale insegna a ignorare il rosso:
   se in P1 o P2 si rivelano frequenti, la risposta è cambiare la regola — non
   declassare il passo (`../../DECISIONI.md` §8).
4. **Il caso F di `evolve` è cieco per costruzione.** Una pagina che continua a
   rispondere, senza segnaposto, con i suoi slot, e che mostra un'altra cosa rispetto a
   quello che il contratto dice: nessuno dei dieci passi la vede. È lo stesso limite del
   caso D di flow-sentinel, ed è il caso **più frequente nella vita di un progetto**
   perché gli altri lasciano una traccia strutturale e questo no. La difesa è l'agente,
   dichiarata nella procedura; in P1 va fissata con un test di regressione che dichiari
   il limite.
5. **`Nessuno slot.` è un buco firmato.** Un contratto che dichiara di non avere
   contenuti editabili rende quasi muto il passo `contenuti-vivi`, e il gate resta verde
   su un sito coi testi cablati — cioè su una telefonata a noi ogni volta che il cliente
   vuole cambiare una parola (`../../DECISIONI.md` §24). Non è chiudibile nel codice: è
   scritto nel template e in §Cosa un gate verde NON prova, ed è l'unico posto dove può
   stare.
6. **La riga `Aggiornamento:` è l'unica difesa contro il contenuto che non si aggiorna
   mai.** Il gate confronta una dichiarazione con un'altra dichiarazione: che la pagina
   sia davvero statica lo dice il contratto, non una misura sull'app. Un controllo vero
   richiederebbe di **scrivere** nel database del progetto e ricaricare la pagina, e un
   gate che muta i dati che verifica è un'altra categoria di strumento. Resta un
   candidato per P2, dichiarato.
7. **Sette comandi sono molti per una skill che non esiste ancora.** Sono modellati su
   gestionale-crafter, che ne ha sette e li ha collaudati; ma `evolve` è il comando che
   in flow-sentinel è rimasto **l'unico mai eseguito** fino al 2026-07-30, e quando
   qualcuno l'ha provato la sua procedura copriva un caso su quattro. In P1 vale la pena
   costruirli nell'ordine in cui verranno usati e **non dichiarare fatto** quello che non
   è stato eseguito almeno una volta.
8. **Nessuna reference di mestiere esiste.** Le quattro di P1 — struttura pubblica,
   pagine e dati, contenuti in pagina, sabotaggio — sono elencate con il loro «quando
   caricarlo» e non hanno una riga dentro. È voluto (il pacchetto P0 finisce con la
   progettazione), ma va detto: oggi un agente che caricasse questa skill saprebbe *cosa*
   deve essere vero alla fine e non *come* arrivarci.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. Nessuno di questi file è stato toccato da
qui.

**A schema-forge**

1. **La tabella dei contenuti non è nelle sue references, ed è lui che deve scriverla.**
   Il modello degli slot (`site_content`: chiave stabile, bozza/pubblicato, policy per
   `anon` filtrata su `is_published`) è documentato in
   `agenti/gestionale-crafter/references/contenuti-editabili.md`, cioè **nel consumatore
   e non nel produttore**. Proposta: `forge` la genera quando il brief dichiara contenuti
   editabili, con la sua policy e **almeno una riga di seed per slot dichiarato** —
   perché senza righe la vetrina si costruisce sul vuoto e il passo `contenuti-vivi` non
   ha niente da verificare.
2. **Una policy di lettura mancante per `anon` non è un `block` di nessun gate.** L'audit
   RLS cerca tabelle *nude* e policy *sbagliate*; una tabella con RLS attiva e nessuna
   policy per l'anonimo è **corretta** per l'audit e **invisibile** per il sito pubblico.
   Il mio passo `contenuti-vivi` la trova solo se quella tabella è dichiarata come fonte
   di una pagina. Proposta: valutare un `issue` su una tabella che l'handoff dichiara
   pubblica e che `anon` non può leggere.

**A speed-demon**

3. **`docs/vetrina.md` e `docs/performance.md` elencano due volte «le pagine che
   contano», e possono divergere in silenzio.** Proposta: `contratto-performance` legge
   `docs/vetrina.md` quando c'è, almeno per un `warn` sulle pagine presenti in uno e non
   nell'altro. Chi decide resta chi firma; oggi però nessuno vede la divergenza.
4. **L'idea del `BUILD_ID` è stata riusata qui, e il controllo delle date è nuovo.** Il
   passo `app-identita` aggiunge un `issue` quando `.next/BUILD_ID` è più vecchio del
   file sorgente più recente: chiude il caso «la build risponde, ma non è quella dei
   sorgenti di adesso», che il `BUILD_ID` da solo non copre. Se regge in P1, è riusabile
   dal suo `build-produzione`.

**A flow-sentinel**

5. **Il controllo della data della firma esiste, in un gate.** Il §7 del suo
   `COLLAUDO-EVOLVE-2026-07-30.md` lo lascia aperto («nessuno script lo esegue») e
   propone di confrontarlo con `git log`, fermandosi davanti ai progetti senza git. Qui è
   risolto senza git: si confronta la data della riga `Confermato da:` con la **data di
   modifica dell'handoff di schema-forge**, che è un file dello stesso progetto. Se in P1
   funziona, la stessa forma vale per `docs/flussi-critici.md`.

**A gestionale-crafter**

6. **Le chiavi degli slot vanno dette in forma fissa.** Oggi il suo handoff elenca i
   contenuti editabili in prosa (`{{TABELLE_DI_CONTENUTO_O_NESSUNA}}`): la vetrina le
   riprende dal contratto e dal database, quindi due agenti sulla stessa tabella possono
   scrivere due insiemi di chiavi diversi senza che nessuno se ne accorga finché il
   cliente non modifica una riga che nessuna pagina mostra. Proposta: una tabella
   `Slot | Chi lo modifica` nel suo handoff, con la stessa forma della §Slot dei contenuti
   del contratto della vetrina.

**Alla regia** (non a un agente)

7. **Il `README.md` promette Fly UI al posto 8 della pipeline** («🔴 Fly UI — Costruisce
   le pagine sopra lo schema dati già definito»). Quel posto è questo agente: quando P0
   sarà confermata, la riga 8 e la tabella §Natura degli agenti vanno aggiornate, e
   `scripts/installa-skill.ps1` dovrà includere `vetrina-crafter` quando sarà una skill
   vera — non prima, per la regola del README stesso: *gli scaffold non si installano
   finché sono scaffold*.
