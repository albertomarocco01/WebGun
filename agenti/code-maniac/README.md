# Code Maniac

> Disciplina per sviluppare codice pulito, tracciabile ed efficiente in token, dentro
> Claude Code. Capisce prima di scrivere, produce il minimo indispensabile, conosce la
> codebase tramite il suo grafo e delega agli strumenti deterministici tutto ciò che non
> richiede giudizio.
>
> Obiettivo unico: **codice pulito e rintracciabile, col minor consumo di token.**

---

## Come si usa

### 1. Installazione — un solo comando

Clona il repository, entra nella cartella e installa, tutto in uno:

```powershell
# Windows (PowerShell)
git clone https://github.com/finzidev/code-maniac.git; cd code-maniac; powershell -ExecutionPolicy Bypass -File .\install.ps1
```
```bash
# macOS / Linux
git clone https://github.com/finzidev/code-maniac.git && cd code-maniac && bash install.sh
```

Il comando clona il repo, copia la skill in `~/.claude/skills/code-maniac` **e** installa i tre
componenti esterni — graphify, caveman, ponytail — saltando quelli già presenti. Funziona anche
dietro proxy aziendali con TLS-interception. Al termine, **riavvia Claude Code**.
*(I componenti esterni sono opzionali: senza, la skill funziona comunque.)*

> Se hai già il repo in locale, salta il `git clone` e lancia solo lo script di installazione.

### 2. Utilizzo quotidiano

In una sessione di Claude Code, invoca un comando (oppure descrivi il compito a parole):

| Obiettivo | Comando | Effetto |
|---|---|---|
| Iniziare o riprendere un progetto | `code-maniac init` | analizza il codice, riassume cosa ha capito, **fa confermare l'obiettivo**, genera la documentazione in `/docs` |
| Controllare e ripulire | `code-maniac scan` | esegue lint, tipi, architettura, codice morto, duplicati, segreti e riporta **solo** ciò che richiede una decisione |
| Capire come funziona qualcosa | `code-maniac explore "come funziona il login?"` | risponde interrogando la mappa del progetto, senza leggere file interi |
| Rivedere una modifica | `code-maniac review` | esamina il diff: eccesso di codice, best-practice, pattern mal applicati |
| Valutare un design pattern | `code-maniac pattern` | lo propone **solo** se la duplicazione esiste già |
| Verificare una tecnologia attuale | `code-maniac research "<domanda>"` | ricerca web mirata e *gated*: tool/dipendenza/pattern corrente, advisory — un subagent distilla, non scarica |
| Registrare debito tecnico | `code-maniac debt` | mantiene il registro delle scorciatoie, dei residui e degli hotspot di complessità |

> Prima di toccare il codice, Code Maniac riformula la richiesta e attende una conferma
> esplicita: non procede mai su un'interpretazione errata.

---

## Le tre leggi (precedono ogni comando)

```
+----------------------------------------------------------------+
|  1. SPECCHIO PRIMA DI AGIRE                                     |
|     Riformula la richiesta e attende conferma.                 |
|     -> Non costruisce mai la cosa sbagliata.                   |
+----------------------------------------------------------------+
|  2. DETERMINISTICO PRIMA DELL'LLM                              |
|     Formato, lint, tipi, duplicati, segreti li risolve il tool.|
|     -> L'LLM vede solo il residuo che richiede giudizio.       |
+----------------------------------------------------------------+
|  3. MINIMO INDISPENSABILE (YAGNI)                              |
|     Meno codice, meno astrazioni, meno token...                |
|     -> ...senza mai sacrificare correttezza o sicurezza.       |
+----------------------------------------------------------------+
```

Quando due leggi confliggono decide la **costituzione**, una gerarchia di priorità:

```
correttezza > sicurezza > leggibilita > type-safety > accessibilita > minimalismo > performance
    (1)          (2)          (3)            (4)            (5)            (6)           (7)
   |__ non derogabili __|                                        |__ solo se misurata __|
```

---

## I comandi

| Comando   | Cosa fa |
|-----------|---------|
| `init`    | Onboarding: scansiona, mostra cosa ha capito, conferma la commessa, genera i documenti |
| `setup`   | Installa/aggiorna i componenti esterni (graphify, caveman, ponytail), saltando i presenti |
| `scan`    | Batteria deterministica (lint, tipi, **complessità**, architettura, codice morto, duplicati, segreti) + autofix |
| `explore` | Risponde su come funziona il codice interrogando il grafo, senza leggere file interi |
| `review`  | Rivede il diff: minimalismo, best-practice, pattern mal applicati |
| `pattern` | Suggerisce un design pattern, solo se la duplicazione esiste già |
| `research`| Ricerca web mirata e *gated*: tecnologia/dipendenza/pattern attuale, advisory di sicurezza |
| `debt`    | Mantiene il registro del debito tecnico (residui, scorciatoie, hotspot di complessità) |

---

## I due flussi

### Onboarding (`init`, una volta sola)

```
 1. Scansione muta        rileva stack, grafo, scan (+ hotspot complessita)   ~0 token
       |
 2. "Ecco cosa ho capito" stack, struttura, entita di dominio, stato di salute
       |
 3. Spieghi la commessa   il perche, gli utenti, i vincoli (cio che il codice non dice)
       |
 4. Specchio              riformula e CHIEDE CONFERMA -> niente prosegue senza conferma
       |
 5. Classifica problema   natura/intento/rischio/parallelizzabilita -> forma roadmap + topologia
       |
 6. Genera i documenti    6 file OBBLIGATORI in /docs: PROGETTO, struttura_directory,
       |                  ROADMAP, DEBITO-TECNICO, RICERCA, convenzioni/best-practices
       |
 7. Tara la costituzione  priorita adattate al progetto, confermate
       |
 8. Baseline              report di scan + prima roadmap di pulizie
```

### Lavoro quotidiano (sequenza fissa, non wizard)

```
  Specchio  ->  Esplora  ->  Pianifica  ->  Implementa  ->  Gate det.  ->  Review  ->  Aggiorna
  riformula     grafo +      classifica +   AGENTE giusto   scan +         best-     grafo +
  + conferma    research     topologia      (spec 9 campi)  complessita    practice  struttura
```

---

## Il motore deterministico

`scan` esegue gli strumenti dal più economico al più costoso e si ferma dove serve giudizio.
I tool mancanti o non configurati vengono saltati, senza falsi allarmi.

```
  piu economico  ---------------------------------------------------------------->  piu costoso
  Prettier   ESLint   tsc   complessita    depcruise   knip   jscpd   semgrep   gitleaks
  formato    lint+fix tipi  cognitive/CCN  architett.  morto  dupli.  regole    segreti

  [OK]   pass        [WARN]  problema -> all'LLM (solo il residuo, hotspot ordinati)
  [SKIP] non installato / non configurato
```

L'LLM non legge mai l'output grezzo dei tool: legge solo questo report sintetico. In coda
`scan` stampa il **risparmio** del run (righe grezze prodotte vs mostrate — proxy onesto dei token)
e il **routing suggerito** (tier del modello + se serve refactor/Security-auditor/Specchio),
derivato *deterministicamente* da **complessità e sicurezza** insieme: un file del task che tocca
auth/segreti/pagamenti, o un flag di semgrep/gitleaks, forza Opus a prescindere dalla complessità.
Così l'agente applica il tier, non lo indovina.

```bash
node scripts/scan.mjs            # scansione completa
node scripts/scan.mjs --fix      # autofix sicuri (Prettier --write, ESLint --fix)
node scripts/scan.mjs --staged   # Prettier/ESLint/complessità sui soli file in stage
node scripts/scan.mjs --since main  # come --staged ma sul diff main...HEAD (review di un branch)
node scripts/scan.mjs --json     # report JSON (incl. routing + risparmio; exit 1 se ci sono problemi)
```

---

## Routing dei modelli (3 livelli, nativo)

```
  Livello 1 - Deterministico   trasformazioni meccaniche, lint-fix, codemod      0 token
  Livello 2 - Sonnet (default) feature, fix, refactor guidati                        $
  Livello 3 - Opus             architettura, sicurezza, decisioni di design         $$

  In dubbio, o task piu complesso del previsto: si sale di livello, non si indovina.
  Sicurezza / dati sensibili: sempre Opus, anche se sembra piccolo.
  Il segnale di complessita (scan) decide il tier: cognitive>25 -> refactor Opus dedicato.
```

> Il modello è solo UN campo dell'agente. Per orchestrazione, topologie, spec dell'agente perfetto
> e numero di agenti: `references/orchestrazione-agenti.md`.

---

## Orchestrazione: quale meccanismo, e parallelismo VERO

Code Maniac **non spawna agenti per abitudine**. Per ogni lavoro non banale esegue un selettore e
**dichiara la scelta** ("Uso *X* perché *Y*") prima di partire. Default = nessuno.

```
  1. transform meccanico (rename, format, codemod)      -> NESSUN agente (tier-1 / scan)
  2. lavoro accoppiato che scrive codice condiviso       -> 1 agente lineare (mai writer paralleli)
  3. sotto-compiti parallelizzabili E read-only/disgiunti? no -> torna a (2)
  4. multi-agente -> scegli il meccanismo:

     gli agenti devono PARLARSI / sfidarsi / coordinarsi?   -> Agent Teams (B)
     parallelismo lungo o worker oltre la context window?    -> Agent Teams (B)
     ognuno fa il suo, basta un riassunto al lead (breve)    -> Subagent batch (A)
     molte sessioni indipendenti lunghe da sorvegliare       -> Background agents (C)
```

| Meccanismo | Cosa | Gli agenti si parlano? |
|---|---|---|
| **A — Subagent batch** | tool `Agent`, una sessione, riportano al lead | no |
| **B — Agent Teams** | istanze separate, task list condivisa, mailbox | **sì** |
| **C — Background agents** | tante sessioni indipendenti, un pannello | no |

> **Parallelismo VERO, non simulato:** i subagent (A) sono davvero paralleli **solo se lanciati tutti
> in UN messaggio** (più tool-call insieme) con `run_in_background: true`. Uno per turno = serializzati.
> Se gli agenti devono **comunicare tra loro**, i subagent non bastano: serve **Agent Teams**, da
> abilitare con `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Niente fallback silenzioso: se il flag è
> spento, la skill lo dichiara e lascia la scelta a te. Dettaglio in `references/orchestrazione-agenti.md`.

---

## Come comunica

| Con l'utente (chiaro) | Tra macchine (compresso, caveman) |
|---|---|
| Specchio, proposte, conferme | chat tra subagent, report, log interni |
| ne wall of text, ne telegramma | note di lavoro, status |

> Regola: caveman comprime ciò che le macchine si dicono; mai ciò che un umano legge per scegliere.

---

## Componenti esterni (opzionali, degrada con grazia)

Code Maniac **orchestra**, non reimplementa. Se mancano, ripiega senza perdere correttezza:

| Componente   | Ruolo                            | Se manca                                |
|--------------|----------------------------------|-----------------------------------------|
| **ponytail** | minimalismo del codice           | vale la costituzione (legge 3) + `knip` |
| **graphify** | grafo di conoscenza del codice   | Grep/Glob mirati + agente `Explore`     |
| **caveman**  | compressione della prosa interna | comunicazione normale (piu token interni) |
| **WebSearch**| ricerca tech attuale (`research`)| decide sul knowledge cutoff e MARCA l'assunzione in `docs/RICERCA.md` |
| **lizard**   | complessità poliglotta (TS/py/go)| ESLint built-in su JS/JSX; senza, lo step si salta con grazia |

I pilastri — costituzione, Specchio, motore deterministico — sono tutti interni:
la skill funziona anche senza i tre componenti esterni.

---

## Installazione — dettagli e opzioni

> La versione veloce è sopra (**Come si usa**): `install.ps1` / `install.sh` fanno copia **+**
> setup in un colpo. Qui i passi separati e le opzioni, se preferisci farli a mano.

La cartella è il sorgente della skill. Copiala (o crea un symlink) in una di queste posizioni:

```
 ~/.claude/skills/code-maniac            skill personale (tutti i progetti)
 <progetto>/.claude/skills/code-maniac   skill di progetto (versionata col team)
```

<details>
<summary><b>Copia manuale per piattaforma</b></summary>

```bash
# macOS / Linux
cp -r code-maniac ~/.claude/skills/code-maniac
```
```powershell
# Windows (PowerShell)
Copy-Item -Recurse code-maniac $HOME\.claude\skills\code-maniac
# oppure un symlink (richiede privilegi di amministratore):
New-Item -ItemType SymbolicLink -Path $HOME\.claude\skills\code-maniac -Target (Resolve-Path .\code-maniac)
```
</details>

Installazione dei soli componenti esterni (o per scegliere dove tenerli):

```bash
node scripts/setup.mjs                 # installa graphify, caveman, ponytail (salta i presenti)
node scripts/setup.mjs --skills-dir D:\skills   # dove tenere i repo dei componenti
node scripts/setup.mjs --in-root       # tienili in <root>/skills
node scripts/setup.mjs --check         # sola diagnosi, non installa nulla
node scripts/setup.mjs --tools         # installa anche il core deterministico nel progetto
```

I repo di caveman/ponytail vengono cercati in una cartella `skills/` sopra la root del progetto
(riusati se presenti) e installati come plugin di Claude dal path locale: niente npm/git, quindi
funziona anche dietro proxy aziendali. Dettagli in `references/skill-esterne.md`.

---

## Mappa dei file

```
code-maniac/
+-- install.ps1 . install.sh       installa tutto: copia la skill + i componenti esterni
+-- SKILL.md                       cio che Claude carica (leggi prima questo)
+-- scripts/
|   +-- scan.mjs                     il motore deterministico
|   +-- scan-lib.mjs . scan.test.mjs logica pura (skip/scope/complessita/routing/sicurezza) + test
|   +-- tree.mjs . tree.test.mjs     albero cartelle deterministico (git ls-files) per struttura_directory.md
|   +-- setup.mjs                    bootstrap dei componenti esterni
+-- references/                    il "come": una regola, un file
|   +-- costituzione.md              priorita di comportamento + risoluzione conflitti
|   +-- specchio-commessa.md         il gate "conferma di aver capito"
|   +-- best-practices.md            regole concrete di codice pulito
|   +-- motore-deterministico.md     i tool, l'ordine della pipeline, l'autofix, la complessita
|   +-- routing-modelli.md           quale modello per quale task (ponte complessita->tier)
|   +-- orchestrazione-agenti.md     quando/come orchestrare: topologie, spec agente, DAG, re-plan
|   +-- ricerca-web.md               ricerca web gated: quando si/no, disciplina token, fonti
|   +-- design-patterns.md           catalogo pattern + advisor (sotto il minimalismo)
|   +-- skill-esterne.md             graphify . caveman . ponytail
+-- resources/
|   +-- eslint-complexity.config.mjs  config complessita-only che la skill porta con se
|   +-- templates/                  i documenti generati da init
|       +-- PROGETTO.md               la commessa confermata = fonte di verita
|       +-- ROADMAP-MULTIAGENTE.md    piano a fasi classificato (topologia + agenti + DAG)
|       +-- DEBITO-TECNICO.md         registro di scorciatoie, residui, hotspot
|       +-- RICERCA.md                registro delle ricerche web (fatti con scadenza)
|       +-- struttura_directory.md    mappa cartelle (rigenerabile)
```

## Crediti

Code Maniac orchestra tre componenti open-source di terzi (non li reimplementa):
**ponytail**, **graphify**, **caveman**. Attribuzioni e licenze in `references/skill-esterne.md`.
