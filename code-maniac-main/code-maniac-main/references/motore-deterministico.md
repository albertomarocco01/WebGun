# Il Motore Deterministico

Il cuore del risparmio token: **tutto ciò che un tool risolve senza ragionare, l'LLM non lo deve nemmeno leggere.** Strumenti indipendenti e collaudati da anni — nessuna dipendenza da RuFlo/agent-booster.

## La pipeline, dal più economico al più costoso

L'ordine conta: ogni passo è più caro del precedente. Ci si ferma al primo che richiede giudizio umano/LLM.

| # | Passo | Tool | Esito |
|---|---|---|---|
| 1 | Formattazione | **Prettier** (`--write`) | auto-fix totale, 0 giudizio |
| 2 | Lint + autofix | **ESLint** `--fix` (+ typescript-eslint, jsx-a11y, import, security) | auto-fix sicuro; residuo → LLM |
| 3 | Tipi | **tsc** `--noEmit` | errori deterministici; fix → LLM se servono scelte |
| 3.5 | Complessità | **ESLint** (complexity/sonarjs) · **lizard** (poliglotta) | funzioni oltre soglia, *report-only*; hotspot = complessità×churn |
| 4 | Architettura | **dependency-cruiser** | viola regole §arch (lib↛components, niente cicli) → segnala |
| 5 | Codice morto | **knip** | file/export/deps inutili → decidere cosa togliere (ponytail) |
| 6 | Duplicati | **jscpd** | blocchi copia-incolla → candidati estrazione |
| 7 | Pattern/regole custom | **semgrep** | "vietato X" con autofix dove definito |
| 8 | Segreti | **gitleaks** | credenziali nel codice → bloccante |

**Codemod a tappeto / find-replace strutturale** — *fuori* dalla batteria di `scan`, da invocare a mano quando un fix meccanico va applicato ovunque: `ast-grep` (`sg`) e `comby` per pattern strutturali language-agnostic, `jscodeshift` / `ts-morph` come "braccio armato" tipato su AST. Riscritture a tappeto, 0 token.

**Albero delle cartelle deterministico** — `node <skill>/scripts/tree.mjs [--depth N]` rigenera il placeholder `{{ALBERO_CARTELLE}}` di `docs/struttura_directory.md` da `git ls-files` (solo file tracciati → rispetta `.gitignore`, 0 dipendenze, 0 token). È ciò che chiude il loop del doc che si dichiara "rigenerabile, non modificare a mano": la mappa cartelle non la *scrive l'LLM*, la stampa il tool. Logica pura testata (`tree.test.mjs`).

## 3.5 — Complessità delle funzioni (il caso da manuale del deterministico)

La complessità è l'esempio perfetto del "deterministico prima dell'LLM": cognitive complexity, CCN, nesting sono **conteggi puri sull'AST, 0 giudizio**. L'LLM non deve *mai* guardare una funzione per stimarne la complessità — la misura il tool e gli passa solo le **hotspot** in cima alla classifica.

- **Cognitive complexity** (SonarSource) è la metrica primaria: nesting-aware, non penalizza uno `switch` piatto (a differenza della ciclomatica) → è la più vicina a "quanto è difficile da capire". È l'**unica** che porta al grado `block` (>25).
- **CCN, nesting, lunghezza (NLOC), parametri, callback annidate** completano il quadro ma si fermano a `issue` — così un grande dispatch table non fa scattare un refactor inutile.
- **Hotspot = complessità × churn** (Tornhill, *Your Code as a Crime Scene*): una funzione complessa *e* toccata spesso è il rischio n°1. `scan` incrocia le funzioni flaggate con la frequenza di modifica (`git log` ultimi 12 mesi, rename-aware) e mostra le top-5. Senza storia git (clone shallow) ordina per sola complessità e lo **dichiara** (`solo complessità`).

**Soglie** (gate): cognitive >10 `warn` / >15 `issue` / >25 `block`; CCN >8/>10; nesting >3/>4; NLOC funzione >50/>60; param >4/>5; callback annidate >3. `warn` si stampa ma **non** fa fallire (exit 0). Test/generati/`.d.ts`/vendored sono esclusi deterministicamente.

**Strumenti** (non ridondanti): la skill porta la sua config (`resources/eslint-complexity.config.mjs`) con le **regole built-in di ESLint** (`complexity`, `max-depth`, `max-lines-per-function`, `max-params`, `max-nested-callbacks`) → gira **anche senza ESLint configurato** nel progetto, e su JS/JSX senza rischi di parser. La **cognitive complexity** arriva da `eslint-plugin-sonarjs` (opzionale, installato da `setup --tools`); senza, resta tutto tranne il tier `block`. Per la complessità **poliglotta** (TS, Python, Go…) usa **lizard** (`pipx install lizard`), che `scan` preferisce quando presente.

> **Niente Maintainability Index / Halstead.** L'MI è funzione di LOC+CCN+Halstead (cose che già misuriamo) ed è dominato dalla lunghezza file / empiricamente debole — sarebbe ridondanza di tooling.

**Il segnale guida il routing** (vedi `routing-modelli.md`): `block` → fase di refactor dedicata, subagent Opus sulla sola funzione; `issue` su un file toccato dal task → l'edit sale a Opus; la top hotspot dentro i file del task → Specchio + Opus obbligati. **Questa mappatura non è più prosa da applicare a mano: `scan` la *emette*.** `scan --json` espone `results[].complexity.{counts,hotspots}` **e** `routing.{tier,dedicatedRefactor,mirror,securityReview,reason}` — calcolato nel codice (`scan-lib.recommendRouting`), 0 token di reasoning, riproducibile. Il routing copre **entrambi gli assi della costituzione**: (1) *complessità* → tier; (2) *sicurezza* → se un file del task matcha un path sensibile (auth/segreti/pagamenti/crypto/`.env`) **o** semgrep/gitleaks hanno flaggato, ALZA a Opus + Security-auditor + Specchio a prescindere dalla complessità (§2, sempre; mai abbassa il tier già derivato). In `--staged`/`--since` la valutazione è sui soli file del task; senza scope è repo-wide. Espone anche `savings.{rawLines,shownLines,savedPct,unit,note}`: il **meter di risparmio** — conta **righe** (proxy onesto dei token: output grezzo prodotto dai tool vs righe mostrate all'LLM), rende misurabile per run la tesi "l'LLM legge il residuo, non i log".

## Regole d'oro

- **Auto-fixa il sicuro, riporta il resto.** L'LLM riceve solo il *residuo* (warning non auto-fixabili, decisioni di design), mai l'intero output dei tool.
- **Scope sui soli file cambiati** quando possibile (`lint-staged`, `git diff`) — non scansionare tutto il repo per un edit.
- **Niente ridondanza di tooling.** `knip` ingloba `ts-prune`+`depcheck`. `Biome` (Rust, veloce) sostituirebbe Prettier+ESLint: o l'uno o l'altro, mai entrambi. Mettere tutto è pattern-itis di tooling.
- **Mai bloccare su tool mancanti o non configurati.** Se uno strumento non è installato — o è presente ma senza config (ESLint/dependency-cruiser senza file di config, `tsc` senza `tsconfig.json`) — `scan` salta il passo con una nota (`[SKIP] … non installato` / `non configurato`), senza interrompere la pipeline né generare falsi `issue`.
- **Soffitto poliglotta (dichiaralo, non fingere copertura piena).** Formato/lint/tipi/morto/architettura sono tarati sull'ecosistema **JS/TS** (Prettier, ESLint, tsc, knip, dependency-cruiser). Su Python/Go/Rust… quei passi vanno in `[SKIP]` e restano attivi solo i language-agnostic: **complessità** (`lizard`, poliglotta), **duplicati** (`jscpd`, multi-linguaggio), **regole** (`semgrep`), **segreti** (`gitleaks`). Su uno stack non-JS `scan` è quindi più sottile: è un limite noto, non un bug — il report lo mostra coi `[SKIP]`.

## Lo script

`scripts/scan.mjs` esegue questa batteria via `npx`, salta con grazia i tool assenti, e stampa un report sintetico (non l'output grezzo). Lancialo dalla root del progetto:

```bash
node <skill>/scripts/scan.mjs              # scansione completa
node <skill>/scripts/scan.mjs --staged     # Prettier/ESLint/complessità sui soli file in stage; gli analizzatori whole-program (tsc, knip, jscpd…) girano sull'intero repo
node <skill>/scripts/scan.mjs --since main # come --staged ma sul diff main...HEAD (review di un branch/PR intero)
node <skill>/scripts/scan.mjs --fix        # applica gli autofix sicuri (Prettier/ESLint)
node <skill>/scripts/scan.mjs --json       # report JSON (pipeline/agenti); exit 1 se ci sono problemi
```

> **In `--staged`/`--since` anche la complessità è scopata ai soli sorgenti cambiati** (review più rapida e pertinente: dice se le funzioni *toccate* sforano, non tutto il repo). Gli analizzatori whole-program (tsc, knip, depcruise, jscpd) restano interi per costruzione.

> **Due guardie (sicurezza, costituzione §2):** (a) `--since <ref>` **valida il ref** (`git rev-parse --verify`): un ref invalido abortisce con exit 2 invece di ritornare una lista vuota → mai un falso *"tutto pulito"* su una review che non ha guardato nulla. (b) I nomi file che entrano nello scoping passano da `guardFiles`: su Windows l'esecuzione usa `shell:true` (i `.cmd` lo richiedono) e Node non escapa gli argomenti, quindi un nome coi metacaratteri di shell (`& | ; \` $` redirect) verrebbe eseguito — quei file sono **esclusi dallo scoping** con nota `[SICUREZZA]`, non dati in pasto alla shell (i nomi vengono da git, ma "input non fidato = ostile").

> **Sotto il cofano:** `scan.mjs` preferisce gli script npm del progetto quando esistono (`format`, `lint`, `type-check`, e uno script "convenzioni" custom) per rispettarne la config — tranne in `--staged`, dove sugli step scopabili vince lo scoping sui file in stage. La logica di decisione (skip / scope / comando) vive in `scan-lib.mjs` ed è coperta da `scan.test.mjs` (`node --test scripts/scan.test.mjs`). jscpd gira con `--gitignore` per non sporcare il report con le cartelle generate; Prettier (v3) rispetta già `.gitignore` + `.prettierignore` di default. semgrep usa un ruleset locale se presente (`.semgrep.yml` / `semgrep.yml` / `.semgrep/`) e gira così **offline**; altrimenti ricade su `--config auto`, che scarica le regole dal registry (richiede rete + telemetria).

## Core set consigliato (non ridondante)

> Prettier · ESLint(+plugin, +eslint-plugin-sonarjs per la cognitive complexity) · tsc · dependency-cruiser · knip · jscpd · semgrep · ast-grep · gitleaks · lint-staged — con jscodeshift/ts-morph per i codemod e **lizard** (`pipx install lizard`) per la complessità poliglotta.

In un colpo: `node <skill>/scripts/setup.mjs --tools` installa il core come devDependencies. Manualmente (progetto Node/TS):

```bash
npm i -D prettier eslint eslint-plugin-sonarjs typescript dependency-cruiser knip jscpd
# lizard (complessità poliglotta): pipx install lizard   (o pip install lizard)
# semgrep:  pipx install semgrep        (macOS/Linux/Windows)  ·  o brew install semgrep
# ast-grep: npm i -g @ast-grep/cli      (o brew install ast-grep)
# gitleaks: brew install gitleaks (macOS/Linux)  ·  scoop install gitleaks  /  winget install gitleaks (Windows)
```
