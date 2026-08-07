# ROADMAP — cosa c'è, cosa manca, cosa aspetta

Il programma di Web Gun è **`Web Gun.docx`**: diciassette agenti in sei fasi, scritti da Alberto.
Questo file dice, voce per voce, **a che punto è davvero** — e dove il documento è rimasto indietro
rispetto al lavoro fatto.

> Il `.docx` non si modifica da qui: è il documento madre, e un gate verifica che
> `webgun_content.txt` sia la sua copia fedele. Correggerlo è un lavoro da fare in Word.

Aggiornato al **2026-08-07**.

---

## Da fare — la lista, in ordine

Le prime tre sono decisioni già prese dal committente il **2026-08-07**: sono qui perché la lista
dica anche cosa *non* si sta facendo, e perché.

| # | Cosa | Di chi | Stato |
|---|---|---|---|
| 1 | **Aggiornare il documento madre `Web Gun.docx`** in Word: oggi dà *Site Doctor* e *Launchpad* per «da creare», ma sono finiti e collaudati da giorni; e il posto 8 (*Fly UI*) va allineato alla realtà. Poi si rigenera la copia di testo con `powershell -ExecutionPolicy Bypass -File scripts/estrai-docx.ps1` e si committano i due file **insieme** — il `.txt` non si scrive a mano (`DECISIONI.md` §26) | **Alberto** | aperta |
| 2 | **Il design** | Alberto | **si aspetta Fly UI.** Deciso il 2026-08-07: lo chiederà agli amici dopo le vacanze. Fino ad allora i componenti restano scritti a mano dietro `src/components/ui/` (`DECISIONI.md` §21), e nessun agente del design si costruisce in casa |
| 3 | **I tre agenti che mancano** — Preventivo Smith, Cyber Shield, AI Specialist | Alberto | **rimandati.** Deciso il 2026-08-07: si sviluppano più avanti. Cosa serve a ciascuno è scritto sotto |
| 4 | Il **debito trasversale** alle skill (tre voci) | direzione | aperto, sotto |
| 5 | Il **debito di ciascuna skill** | direzione | aperto, in `agenti/<nome>/STATO.md` §Debito |

---

## In una riga

**Otto agenti sono operativi**, sette costruiti in casa con un gate deterministico ciascuno e uno
(vetrina-crafter) che il programma non aveva previsto. **Tre mancano e li possiamo fare noi.**
**Tre sono congelati** in attesa della libreria degli amici. Nessun sito è mai stato pubblicato:
è una scelta, non un ritardo.

| | |
|---|---|
| Agenti di casa collaudati | **7** (+ 1 non previsto dal programma) |
| Passi di gate deterministici | **64** in totale |
| Test automatici che li sorvegliano | **1 480**, tutti verdi il 2026-08-07 |
| Tribunali di revisione convocati | **8**, con **190 rilievi veri** |
| Skill senza riserve per un cliente vero | **nessuna delle sette** — ognuna dichiara la sua, e non è la stessa (vedi in fondo) |
| Siti pubblicati | **0** — mai un account, un dominio, un centesimo |

---

## Il programma, voce per voce

Legenda: ✅ fatto e collaudato · 🔨 da creare (possiamo noi) · ❄️ congelato (aspettiamo gli amici) ·
➖ fuori dalla catena

### FASE 0 — Commerciale

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 1 | **Brief Smith** | in arrivo dagli amici | ❄️ congelato · esiste solo lo scaffold |
| 2 | **Preventivo Smith** | da creare | 🔨 **manca** · scaffold, nessuno ci ha ancora lavorato |

### FASE 1 — Ingresso della richiesta

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 3 | **Prompt Smith** | in arrivo dagli amici | ❄️ congelato |

### FASE 2 — Guardiani (sempre attivi)

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 4 | **Code Maniac** | ce l'ho | ✅ in uso a ogni fase (`code-maniac scan`) |
| 5 | **Code Inquisition** | ce l'ho | ✅ in uso · **otto convocazioni, 190 rilievi veri** |
| 6 | **Bug Bay** | ce l'ho | ➖ presente, **mai agganciato alla catena** |

### FASE 3 — Costruzione

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 7 | **Schema Forge** | ce l'ho, fatto | ✅ gate **9 passi**, 228 test · database vero, RLS, pgTAP |
| 8 | **Fly UI** | in arrivo dagli amici | ❄️ congelato — **è il posto del design** (vedi sotto) |
| — | **Vetrina Crafter** | *non nel programma* | ✅ gate **10 passi**, 183 test · il sito pubblico |
| 9 | **Sites Effects** | ce l'ho | ➖ libreria di Alberto, fuori dalla catena |
| 10 | **Gestionale Crafter** | ce l'ho, fatto | ✅ gate **7 passi**, 230 test · backoffice con ruoli |
| 11 | **AI Specialist** | da creare | 🔨 **manca** · scaffold |

### FASE 4 — Test e performance

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 12 | **Flow Sentinel** | ce l'ho, fatto | ✅ gate **7 passi**, 171 test · E2E Playwright su app vera |
| 13 | **Speed Demon** | ce l'ho, fatto | ✅ gate **8 passi**, 147 test · Lighthouse su build di produzione |

### FASE 5 — Sicurezza e conformità

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 14 | **Cyber Shield** | da creare | 🔨 **manca** · scaffold — ma il perimetro va ristretto (vedi sotto) |
| 15 | **Site Doctor** | *«da creare»* | ✅ **il documento è indietro**: esiste, gate **14 passi**, 308 test |

### FASE 6 — Lancio

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 16 | **Launchpad** | *«da creare»* | ✅ **il documento è indietro**: esiste, gate **9 passi**, 167 test · **non ha mai pubblicato** |
| 17 | **DemonIAc** | ce l'ho | ➖ video demo, opzionale |

### Fuori pipeline

Maps Scraper e Aisthenics sono di Alberto e vivono per conto loro. Everything Scraper, Agent
Crafter, Super Teacher, Brainer, Projentic e Flowtastic sono degli amici e non toccano la catena
di produzione siti.

**Quello che è degli amici non si corregge qui, e resta aperto lo stesso.** In
`agenti/code-maniac/scripts/tree.mjs` la guardia dell'epilogo confronta il percorso del modulo
con `process.argv[1]` **grezzo**: senza `resolve()` e senza sciogliere la junction, lo script
lanciato per percorso relativo o da `.claude/skills/` esce **senza stampare una riga**. È la
stessa classe che in casa si chiude con il doppio confronto (`resolve` + `realpathSync`, con
ricaduta sul testuale). Il file è uno snapshot esterno: la correzione va proposta a finzidev nel
repo d'origine, la proposta è scritta e **non è mai stata inoltrata**.

---

## I tre che mancano, in ordine di utilità

### 1. Preventivo Smith — il primo della catena e il più semplice

Calcola tempi e costi prima che il lavoro parta. È l'unico dei tre che **non dipende da nessun
altro agente**: legge un brief e produce un documento. Si può fare subito, e serve dal primo
cliente vero.

### 2. Cyber Shield — ma va ristretto prima di scriverlo

Il programma gli dà «vulnerabilità, permessi, esposizione dati e configurazioni pericolose». Metà
di quel perimetro **oggi è già coperto**, e da chi lo misura davvero:

| Cosa | Chi lo misura già |
|---|---|
| segreti nel repo, in HEAD e nella storia | launchpad, passo `segreti` |
| RLS, policy, privilegi di tabella | schema-forge, audit RLS + pgTAP |
| rotte admin senza guardia, permessi | gestionale-crafter |
| dati esposti a un anonimo | vetrina-crafter, site-doctor |
| audit profondo su richiesta | Code Inquisition |

**Regola di casa: una voce con due proprietari è una voce di nessuno.** Se lo facciamo, Cyber
Shield prende ciò che oggi nessuno guarda — dipendenze vulnerabili, header di sicurezza,
rate-limiting, superficie delle Server Action — e non ricalca i vicini.

La prima voce di quel perimetro è già misurata e aperta: **sulle RPC pubbliche del pilota non
c'è nessun tetto ai tentativi** — 30 ordini inviati in 1,36 s, tutti HTTP 200, e sessanta
tentativi di lettura per codice senza un solo 429. Non è materia di schema (non lo si scrive in
una policy) né di vetrina (un bottone disabilitato in volo non è un tetto), e infatti sta
dichiarata aperta in entrambi: è il debito che aspetta questo agente e nessun altro.

### 3. AI Specialist — il più grosso, e il meno urgente

Chatbot, RAG, agenti dentro il sito del cliente. È lavoro vero e dipende da uno schema già forgiato.
Ha senso quando un cliente lo chiede, non prima.

---

## Il design: la casella vuota

Il programma mette **Fly UI** al posto 8 e lo dà «in arrivo dagli amici». Non è arrivato, e nel
frattempo la catena ha risolto da sola: vetrina-crafter scrive i componenti **a mano** dietro la
cucitura `src/components/ui/` (deroga in `DECISIONI.md` §21). Il sito funziona, è accessibile e
veloce — ma **nessun agente si occupa di come appare**, e si vede.

Le strade sono due, ed è una decisione da prendere:

- **aspettare Fly UI** — quando arriva entra *dentro* la cucitura: si riscrive il corpo di quei
  file, non le pagine. Costo zero adesso, tempo indefinito.
- **una skill di casa** — un agente del design con il suo gate, come gli altri sette. Costa un
  pacchetto di lavoro, e toglie la dipendenza da un consegnatario esterno.

---

## Debito trasversale alle skill

Tre voci che non appartengono a nessuna skill in particolare: nessun gate le chiude da solo,
perché chiuderle vuol dire cambiare qualcosa che sta **fra** le skill. Sono decisioni di
architettura, non pulizie.

- **La stessa difesa esiste in tre copie identiche.** `mascheraUrl` (toglie la password da una
  URL prima di stamparla) e `credenzialiPsql` (passa le credenziali a `psql` fuori dalla riga di
  comando) vivono duplicate in schema-forge, gestionale-crafter e flow-sentinel. La duplicazione
  è dichiarata, e ha un costo misurato: spenta `credenzialiPsql` in schema-forge e in
  gestionale-crafter, le due batterie sono rimaste **verdi** (216/216 e 208/208) — una difesa
  contro le password si poteva togliere del tutto in due skill su tre senza un rosso, perché i
  test esistevano in una copia sola. I test ora stanno in ognuna; **le copie sono ancora tre**.
  Estrarre una libreria comune fra skill che si installano una per una è la decisione che manca.
- **La password del database resta leggibile nella tabella dei processi per tutta la durata del
  gate.** Tre `verify.mjs` ricevono il database come `--db-url` e lo ripassano al proprio script
  di audit sempre come argomento: la protezione è chiusa **alla foglia** (la chiamata a `psql`),
  non lungo la catena. Chiuderla significa cambiare l'interfaccia fra ogni `verify.mjs` e i suoi
  audit, e il primo salto è comunque la riga di comando che scrive un umano — che questa casa
  **non** vuole leggere dall'ambiente, perché passare la URL a mano è la difesa contro l'auditare
  per sbaglio il database di un altro progetto. Va decisa, non fatta di corsa.
- **Nessuna regola pretende che un epilogo esista.** Il passo `epiloghi-vivi` del gate della regia
  **vieta** il token `import.meta.main` — che su Node 20 fa uscire un gate muto con codice 0 — ma
  non impone in positivo che uno script chiami il suo `main()`. Uno script che perdesse del tutto
  l'invocazione passerebbe il gate della regia in silenzio: è dimostrato, non temuto, perché la
  regia finta dei test contiene apposta un `verify.mjs` privo di epilogo e il passo su quella
  regia chiude **verde**.

---

## Cosa nessuno ha mai provato

Detto qui perché non lo si scopra dopo:

- **Nessun deploy.** Launchpad decide se si *può* pubblicare; nessuno ha mai premuto il pulsante.
  Il primo lo autorizza Alberto di persona (`DECISIONI.md` §6).
- **Nessun cliente vero.** Tutta la catena è stata provata sulla cavia (`../cavia`) e su banchi
  costruiti apposta. Sui banchi **i contratti li ha firmati chi costruiva**: il gate legge la
  firma, non la sua verità. Tutte e sette le skill portano ancora la riserva nel proprio
  `STATO.md`, ma non per lo stesso motivo — vedi la tabella qui sotto.
- **L'ingresso non esiste.** Brief Smith e Prompt Smith sono congelati: oggi il lavoro parte da un
  prompt scritto a mano.
- **I guardiani non sono automatici.** Code Maniac e Code Inquisition si lanciano a mano quando
  la Regola dei guardiani lo impone (`CLAUDE.md`); niente li fa scattare da solo.

### Perché ciascuna non è ancora pronta per un cliente

La differenza conta, perché dice **cosa** serve per togliere la riserva: per due skill è una
firma, per due è lavoro sul gate, per una è un deploy.

| Skill | Perché la riserva resta | Cosa la toglie |
|---|---|---|
| **vetrina-crafter** | il motivo della firma è **chiuso**: `docs/vetrina.md` del pilota l'ha firmato Alberto di persona il 2026-08-05, senza aver costruito niente | un cliente pagante |
| **flow-sentinel**, **speed-demon** | il contratto del pilota porta una firma **per delega** (`CANTIERE.md`, D14), che per decisione esplicita **non** chiude il punto | la controfirma di Alberto sulle due righe, poi si rilanciano i due gate: cinque minuti |
| **gestionale-crafter** | limite del gate, non della firma: conta le guardie e **non sa se chiedono il ruolo giusto** — sostituita `richiediRuolo("direttore")` con `richiediStaff()` sulla vista del personale, l'audit ha risposto «nessun bloccante» | lavoro sulla skill |
| **schema-forge** | limiti del gate: non può vedere un seed non rieseguibile a caldo (`db reset` parte sempre da pulito), e guarda la forma delle policy, non la semantica | lavoro sulla skill |
| **site-doctor** | nessun certificato è mai stato firmato da un committente: le firme esistenti sono per delega | la firma di un committente |
| **launchpad** | un motivo solo: **il primo deploy non è mai avvenuto** | il primo deploy |
