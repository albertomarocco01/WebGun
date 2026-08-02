# Stato — Vetrina Crafter

- **Stato attuale: P1 PARZIALE — codice scritto, gate mai eseguito su un progetto
  vero.** Esistono le cinque references, i quattro script (due gusci di I/O e due
  librerie di regole pure), i **113 test verdi**, i guardiani della skill e i due
  template. **Non esiste il banco**: Docker e lo stack Supabase locale non ci sono su
  questa macchina (l'attivazione di `VirtualMachinePlatform` fallisce con `0x80073712`,
  riparazione in corso da parte del direttore), quindi i deliverable 4-9 del mandato
  P.2 non sono stati toccati per decisione del direttore stesso.
- **Nessuno dei sette comandi e' stato esercitato**, e nessuno dei dieci passi del gate
  ha misurato un progetto Next.js vero. Le uniche esecuzioni reali sono: i 113 test,
  i guardiani sugli script, e **tre percorsi di rifiuto** del gate (cartella che non e'
  un progetto → uscita 2; nessun `--url` e nessuna riga `URL servito:` → uscita 2;
  audit senza configurazione → tre MANCANTI, uscita 1).
- **Non usabile su nessun progetto.** Quello che oggi e' provato sono **le regole**,
  non il gate: 113 test coprono funzioni pure con input della forma vera, ma nessuna
  `fetch`, nessuna query `psql` e nessuna build di produzione sono mai state
  eseguite. La casa ha gia' misurato quanto vale la differenza — sei dei diciassette
  difetti del collaudo avversario di speed-demon erano **descritti nelle references e
  non implementati**: *la prosa sapeva, il codice no*. Qui il codice c'e', e non e'
  ancora stato messo davanti a un'app.
- **Proprietario:** Alberto
- **Dipendenze:**
  - **A monte:** **schema-forge** (tabelle, viste, policy di lettura per il ruolo
    anonimo, tabella dei contenuti e suo seed, tipi generati) · brief-smith (quali
    pagine e quali contenuti vuole il cliente) · prompt-smith (richiesta professionale)
  - **A fianco:** **gestionale-crafter** — non e' un prerequisito, ma lavora sulla
    **stessa tabella di slot**: le chiavi devono coincidere, e chi arriva secondo legge
    l'handoff del primo invece di inventarsele. Condivide anche la cucitura
    `src/components/ui/`: chi arriva dopo **la estende**, non la riscrive
  - **A valle:** **flow-sentinel** · **speed-demon** (`docs/vetrina.md` e' la fonte del
    suo elenco di pagine) · **site-doctor** · cyber-shield · launchpad
  - **Fly UI non e' una dipendenza e non lo diventera'**: non esiste
    (`../../DECISIONI.md` §21). Anche **sites-effects** resta fuori: e' una libreria
    esterna che in questo repo non c'e', e un progetto che la adotta lo dichiara come
    deroga in `docs/PROGETTO.md`
- **Guardiani sugli script:** ESLint **0 errori 0 avvisi** · `knip` **pulito** ·
  `jscpd` **MANCANTE** (non eseguibile: vedi §Cosa non e' stato fatto) ·
  `semgrep`, `gitleaks` e `/code-inquisition` **mai lanciati**.

## Cosa fa, in una riga

Costruisce le pagine pubbliche di un progetto Web Gun sopra lo schema di schema-forge
— layout, componenti dietro la cucitura, lettura dei dati con la chiave anonima,
contenuti presi dalle tabelle degli slot — e si rifiuta di consegnarle se una pagina
dichiarata non risponde, se una pagina servita non e' dichiarata, se nel testo servito
c'e' ancora un segnaposto, se un contenuto editabile e' cablato nel codice invece che
nel database, o se una chiave di servizio e' raggiungibile dal sito pubblico.

## Piano P0 → P3

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione: `SKILL.md`, specifica del gate a dieci passi, template del contratto e dell'handoff | qui | **fatta il 2026-08-02**, firmata dal committente (commit `a1ee045`) |
| P1 | costruzione: references, `scripts/`, guardiani, **banco**, sette comandi esercitati, sabotaggio, gate verde | qui | **parziale il 2026-08-02**: deliverable 1-3 fatti, 4-9 fermi al blocco Docker |
| P1-bis | il banco e tutto quello che ci gira sopra: `specchio` → `verify`, sabotaggio delle sette classi, gate VERDE 10/10 | chat dedicata, al via del direttore | da fare |
| P2 | collaudo avversario indipendente su **dominio diverso**: caccia ai falsi verdi dei dieci passi | chat vergine (chi costruisce non collauda) | da fare |
| P3 | primo consumatore reale, col contratto firmato da un **committente** | pacchetto «filo completo» | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Test degli script | **113 verdi** | `npm test` (21 suite, 0 falliti, 8,7 s) |
| Passi del gate implementati | 10, con `id` stabili e ordine bloccato da un test | `scripts/verify.mjs`, `ID` |
| Passi del gate **eseguiti su un progetto vero** | **0** | non esiste il banco |
| Comandi esercitati | **0 su 7** | non esiste il banco |
| Classi di sabotaggio provate | **0 su 7** (+3 aggiunte, +5 falsi positivi, +5 limiti) | `references/sabotaggio.md`, colonne «Esito misurato» vuote |
| Regole pure | 2 librerie, 35 funzioni esportate | `audit-lib.mjs` (327 righe) · `progetto-lib.mjs` (829 righe) |
| Gusci di I/O | 2 | `verify.mjs` (558) · `vetrina-audit.mjs` (295) |
| References | **5** | 1 149 righe in tutto |
| Template | 2 | `vetrina.md` (405) · `handoff-vetrina-crafter.md` (226) |
| Falsi verdi previsti dalla specifica e diventati test | **10 su 10** | i test che cominciano con «falso verde» |
| Difetti trovati costruendo | **3** | §Tre difetti trovati costruendo |
| Guardiani | ESLint 0/0 · knip pulito · jscpd MANCANTE | eseguiti |

## Tre difetti trovati costruendo, e chiusi

Nessuno dei tre veniva dal compito: sono usciti facendo girare le cose invece di
leggerle.

1. **La regola della cucitura non poteva scattare sul client dei dati.** `puntaA`
   confrontava un import (`@/lib/supabase/public`) con un modulo dichiarato **con
   estensione** (`src/lib/supabase/public.ts`), quindi la meta' della regola che vieta
   alla cucitura di leggere dati era **codice morto**. L'ha trovato il suo stesso test,
   che si aspettava due rilievi e ne vedeva uno. Chiuso togliendo l'estensione dal
   bersaglio del confronto.
2. **L'audit statico usciva 0 con tre verifiche mancanti.** Lanciato su una cartella
   senza `vetrina.config.json` stampava tre `MANC` e usciva **0**, cioe' «nessun
   bloccante» su un audit che non aveva letto un file. E' la forma esatta del difetto
   che questa casa combatte da tre skill (`../../DECISIONI.md` §18) e ce l'aveva dentro
   il proprio guscio. Chiuso: uscita 0 solo se tutti e tre i passi hanno **guardato**.
3. **ESLint non lintava niente e non lo diceva.** Invocato con percorsi assoluti sul
   progetto rispondeva «all of the files matching the glob pattern are ignored … the
   file is located outside of the base path»: il base path e' la cartella della
   configurazione, che vive **dentro la skill**. Il guasto andava nella direzione
   sicura (MANCANTE) ma con una diagnosi che avrebbe mandato qualcuno a cercare file
   `.tsx` che ci sono. Chiuso: ESLint gira con `cwd` sul progetto e percorsi relativi,
   misurato su una fixture con quattro errori a11y veri.

## Decisioni sospese, in attesa del banco

Il mandato ne assegnava esplicitamente una al banco; costruendo ne sono emerse altre
due della stessa famiglia. **Nessuna e' stata decisa a tavolino**, e ognuna e' marcata
nel codice dove sta.

| # | Decisione | Comportamento attuale | Come si chiude |
|---|---|---|---|
| S1 | **slot dichiarato dal contratto senza nessuna riga pubblicata**: `block` o MANCANTE? | **MANCANTE** — il comportamento della P0 firmata, marcato `DECISIONE SOSPESA` in `progetto-lib.mjs` e fissato da un test che dichiara di fissare *il comportamento attuale, non quello desiderato* | si piantano i due casi sul banco (slot assente / slot in bozza) e si guarda quale dei due rossi descrive meglio quello che e' successo |
| S2 | **la soglia distintiva di 24 caratteri** | ripiego dichiarato, sovrascrivibile dal contratto | si conta su un progetto vero quanti slot restano sotto soglia, cioe' **non verificati**: se sono tanti la soglia e' sbagliata, non gli slot |
| S3 | **il rilievo sulla build piu' vecchia dei sorgenti** (`app-identita`) e **quello sulla firma piu' vecchia dell'handoff** (`contratto-vetrina`) | entrambi `issue`, coi falsi positivi dichiarati | si misura quanto spesso scattano su un progetto vero. Se scattano quasi sempre sono rumore, e allora si cambia la regola — non si declassa il passo (`../../DECISIONI.md` §8) |

## Decisioni prese in P1

Le quattro che cambiano la forma del codice. Le tre correzioni del direttore in
revisione della P0 sono applicate e non sono ripetute qui.

1. **`verify.mjs` IMPORTA `vetrina-audit.mjs` invece di lanciarlo come
   sottoprocesso.** schema-forge e gestionale-crafter lanciano il loro audit perche'
   ha bisogno di `psql` e si punta anche su un database diverso; qui i tre passi
   statici girano sullo stesso progetto e non hanno nessun bersaglio separato, quindi
   una seconda serializzazione JSON aggiungerebbe solo un modo di fallire. Un errore
   imprevisto la' dentro **non uccide il gate**: e' catturato e diventa MANCANTE —
   un gate che crasha non e' ne' verde ne' rosso, e' assente.
2. **Due librerie di regole, divise per input e non per argomento.** `audit-lib.mjs`
   guarda i **sorgenti**, `progetto-lib.mjs` guarda il **contratto e l'app servita**.
   La seconda importa i primitivi dalla prima invece di riscriverli: girano sempre
   insieme dentro lo stesso gate, quindi la dipendenza non accoppia niente che fosse
   separato (stessa scelta, e stessa motivazione, di gestionale-crafter).
3. **Il frammento distintivo di uno slot e' il piu' lungo dei suoi valori di testo**,
   ricavato con `to_jsonb(t)` invece di elencare le colonne. Quali colonne contengano
   il testo non lo dichiara nessuno, e chiederlo al contratto avrebbe voluto dire una
   riga di sintassi in piu' per ogni progetto.
4. **Il comando dei test elenca i file per esteso.** `node --test "scripts/**/*.test.mjs"`
   funziona su Node 24 e **non** su Node 20 (dove il pattern e' un percorso letterale);
   `node --test scripts` fa l'opposto. Elencare i tre file e' l'unica forma che gira su
   entrambi — e questa macchina ha Node 20.12.2, mentre lo `STATO.md` di schema-forge
   documenta la forma di Node 24.

## Cosa NON e' stato fatto, e perche'

- **Il banco, e tutto quello che ci gira sopra** (deliverable 4-8 del mandato P.2):
  fermo per decisione del direttore, in attesa che Docker torni disponibile. Senza
  banco non ci sono comandi esercitati, non c'e' sabotaggio, e non c'e' nessun gate
  verde da incollare.
- **`README.md` e `scripts/installa-skill.ps1`** (deliverable 9): entrano **solo a
  gate verde**, ed e' l'unica eccezione al perimetro. Non toccati.
- **Le tre regole del passo `contenuti-vivi` non hanno mai interrogato un database.**
  `psql` non e' ancora visibile sul PATH di questa sessione (la voce di registro c'e',
  la cartella `scoop\apps\postgresql` no). Le regole sono provate come funzioni pure
  con input della forma vera; il guscio che le alimenta — la query `to_jsonb`, il
  `set role anon`, la lettura di `[db].port` — **non e' mai stato eseguito**.
- **`jscpd` non gira su questa macchina.** `jscpd@4` richiede `commander@15`, che e'
  solo-ESM e vuole Node ≥ 22.12; con Node 20.12.2 il bundle CJS di jscpd fallisce con
  `ERR_REQUIRE_ESM`. E' una verifica **MANCANTE**, non superata: la ricerca di cloni
  sugli script non e' stata fatta. Si chiude aggiornando Node oppure fissando
  `commander` a una versione compatibile — e' una decisione del direttore, non mia.
- **`semgrep`, `gitleaks` e `/code-inquisition` non sono mai stati puntati su questi
  script.** `semgrep` risulta presente su questa macchina secondo gli `STATO.md` di
  schema-forge e speed-demon: sarebbe una verifica **disponibile e non fatta**, che e'
  un residuo peggiore di una mancante.
- **Nessuna misura di quanto il gate impieghi.** Su un progetto vero fa una `fetch`
  per pagina, due query per slot, un `tsc` e un ESLint: quanto costi non lo sa nessuno.

## Cosa un gate verde NON prova

Scritta per intero in `SKILL.md` §Cosa un gate verde NON prova — dodici voci. Le tre
che contano di piu': il gate legge **la firma** del contratto e non la sua verita';
non sa se quello che la pagina mostra **debba** essere pubblico; e non vede una
colonna selezionata e non disegnata, che viaggia lo stesso nell'HTML servito e nel
payload RSC.

`references/sabotaggio.md` §Le classi che questo gate NON puo' vedere elenca le
cinque rotture che devono restare **verdi**, e prescrive di provarle lo stesso — per
misurare il limite invece di dichiararlo.

## Punti aperti — ordinati per gravita'

1. **Il gate non ha mai visto un'app.** Sette dei dieci passi (`tipi`, `app-identita`,
   `pagine-vive`, `segnaposto-serviti`, `contenuti-vivi`, piu' `a11y-statica` su un
   progetto vero e `contratto-uscita` su un handoff vero) esistono solo come codice
   provato su fixture. **Il primo difetto lo trovera' il banco**, ed e' normale;
   quello che non sarebbe normale e' credere il contrario perche' i test sono verdi.
2. **Nessun committente ha firmato niente.** Ereditato dalla P0, si chiude in P3.
3. **Le tre decisioni sospese** (S1, S2, S3) restano tali finche' non c'e' il banco.
   Indovinarle adesso e' esattamente il difetto che il collaudo avversario e' pagato
   per trovare.
4. **Il caso F di `evolve` e' cieco per costruzione**, e ora ha anche il suo posto in
   `references/sabotaggio.md` fra le rotture che devono restare verdi.
5. **`Nessuno slot.` e' un buco firmato**: rende quasi muto il passo `contenuti-vivi`.
   Non chiudibile nel codice.
6. **Le euristiche dichiarate non sono state messe alla prova.** `puntaA` confronta la
   **coda** di un percorso e non risolve gli alias di `tsconfig`: due cartelle con la
   stessa coda in un monorepo la ingannano. I segnaposto sono cercati come stringhe: un
   progetto che parla di template produce un falso positivo. Entrambe sono scritte nel
   codice e nella specifica; nessuna delle due ha ancora incontrato un progetto vero.
7. **Il gate non misura quanto ci mette.** Se su un sito di trenta pagine impiegasse
   minuti, sarebbe un gate che nessuno rilancia — e un gate che nessuno rilancia e' un
   documento.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. Nessuno di questi file e' stato
toccato da qui.

**A tutti e tre i gate esistenti — misurato, e grave**

0. **Su Node 20 i gate di schema-forge, gestionale-crafter, flow-sentinel e
   speed-demon non eseguono niente ed escono 0.** Tutti e quattro chiudono con
   `if (import.meta.main) …`, e `import.meta.main` **e' arrivato in Node 24**: su
   Node 20.12.2 vale `undefined`, quindi `main()` non gira, non viene stampato niente
   e il processo esce **0**. Misurato il 2026-08-02 su questa macchina:

   ```
   $ node .../flow-sentinel/scripts/verify.mjs --json     # cartella non-progetto
   (nessuna uscita)
   uscita: 0                                              # atteso: 2

   $ node .../speed-demon/scripts/verify.mjs              # senza --url
   (nessuna uscita)
   uscita: 0                                              # atteso: 2, «e' cosi' che si
                                                          # misura l'app di un altro progetto»
   ```

   E' la forma piu' pura del falso verde che questa casa combatte: uno strumento che
   non ha letto niente esce 0, e chi automatizza legge il codice d'uscita. Questa
   skill usa `process.argv[1] === fileURLToPath(import.meta.url)`, che funziona
   ovunque. **La correzione e' una riga per file**, ma sono file di altri agenti e
   non li tocco.

**A schema-forge**

1. **La tabella dei contenuti non e' nelle sue references, ed e' lui che deve
   scriverla.** Il modello degli slot e' documentato in
   `agenti/gestionale-crafter/references/contenuti-editabili.md`, cioe' nel consumatore
   e non nel produttore. Proposta: `forge` la genera quando il brief dichiara contenuti
   editabili, con la sua policy e **almeno una riga di seed per slot dichiarato** —
   senza righe la vetrina si costruisce sul vuoto e il passo `contenuti-vivi` non ha
   niente da verificare.
2. **Una policy di lettura mancante per `anon` non e' un `block` di nessun gate.**
   L'audit RLS cerca tabelle *nude* e policy *sbagliate*; una tabella con RLS attiva e
   nessuna policy per l'anonimo e' **corretta** per l'audit e **invisibile** per il
   sito pubblico.
3. **`Confermato da: … il <DATA>` andrebbe scritta in forma ISO.** Il mio passo
   `contratto-vetrina` confronta la data della firma della vetrina con quella
   dell'handoff di schema-forge, e legge la data **dal testo** (non dal filesystem, che
   su un clone direbbe sempre «oggi»). Se il template scrive `il 24 luglio 2026` il
   confronto non si fa affatto — in silenzio, che e' il modo peggiore.

**A speed-demon**

4. **`docs/vetrina.md` e `docs/performance.md` elencano due volte «le pagine che
   contano», e possono divergere in silenzio.** Proposta: `contratto-performance` legge
   `docs/vetrina.md` quando c'e', almeno per un `warn` sulle pagine presenti in uno e
   non nell'altro.
5. **Il controllo sulla build piu' vecchia dei sorgenti e' riusabile.** Qui e' un
   `issue` di `app-identita` e chiude il caso «la build risponde, ma non e' quella dei
   sorgenti di adesso», che il `BUILD_ID` da solo non copre.

**A flow-sentinel**

6. **Il controllo della data della firma esiste, in un gate.** Il §7 del suo
   `COLLAUDO-EVOLVE-2026-07-30.md` lo lascia aperto e propone `git log`, fermandosi
   davanti ai progetti senza git. Qui e' risolto senza git, confrontando due date
   **dichiarate** in due file dello stesso progetto.

**A gestionale-crafter**

7. **Le chiavi degli slot vanno dette in forma fissa.** Oggi il suo handoff le elenca
   in prosa: due agenti sulla stessa tabella possono scrivere due insiemi di chiavi
   diversi senza che nessuno se ne accorga finche' il cliente non modifica una riga che
   nessuna pagina mostra.

**Alla regia**

8. **Il `README.md` promette Fly UI al posto 8 della pipeline.** Quel posto e' questo
   agente: la riga 8, la tabella §Natura degli agenti e `scripts/installa-skill.ps1`
   si aggiornano **a gate verde**, non prima — per la regola del README stesso.
9. **Node 20.12.2 e' sotto quello che chiedono gli strumenti della casa.** `jscpd@4`
   non parte affatto, e diversi pacchetti avvisano `EBADENGINE`. Aggiornare Node
   chiuderebbe anche il punto 0, che oggi rende inservibili quattro gate su questa
   macchina.
