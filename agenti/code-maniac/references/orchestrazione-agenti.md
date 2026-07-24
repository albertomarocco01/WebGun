# Orchestrazione & Progettazione degli Agenti

Come Code Maniac decide **se** servono più agenti, **quale topologia**, **quanti**, e **come progettare l'agente perfetto** per ogni pezzo di lavoro. È il motore che trasforma una commessa confermata in un piano multi-agente *adatto al problema* — non un template stampato.

> **Tutto nativo.** Solo il tool `Agent` (col parametro `model`), i subagent di Claude Code, lo spawn parallelo in un solo messaggio, `run_in_background` e `isolation:"worktree"`. **Nessuna** dipendenza da claude-flow/MCP/RuFlo.

> **Regola sovrana (YAGNI applicato all'orchestrazione):** il default è **un singolo agente lineare**. Il multi-agente è l'eccezione che si paga (~15× token vs una chat — Anthropic), non la norma. Si scala solo quando il problema lo *giustifica* (sotto). Multi-agente reflexivo = over-engineering, esattamente ciò che la costituzione combatte.

---

## §1 — Quando orchestrare (il gate "ne vale la pena")

Si valuta **per fase del DAG, non per l'intero task**. Il lavoro reale è quasi sempre *misto*: una fan-out di lettura in parallelo, poi un singolo scrittore. Si separa **la frontiera di lettura dalla frontiera di scrittura** e si gradua ognuna.

| Segnale della fase | → Architettura |
|---|---|
| ≤3 file, logica sequenziale accoppiata, requisiti chiari | **Singolo agente lineare** (default). Multi-agente non giustificato. |
| Lavoro generativo che scrive codice condiviso | **Singolo agente lineare**, anche se grande. **Mai scrittori paralleli.** |
| Esplorazione/indagine read-only ampia, info > una context window | **Orchestrator-worker**, worker paralleli read-only |
| Sottocompiti indipendenti, ognuno scrive in un'area **disgiunta** | **Sectioning** parallelo (fan-out/fan-in) |
| Stessa operazione meccanica/classificatoria su **molti file** | **Map-reduce su file** (mapper omogenei + reduce deterministico) |
| Posta alta, correttezza critica, criteri di verifica chiari | **Evaluator-optimizer** (loop generatore↔critico) |
| Catena fissa nota a priori (estrai→trasforma→valida) | **Pipeline / prompt-chaining** sequenziale |
| Ricerca aperta, sottocompiti imprevedibili | **Orchestrator-worker gerarchico** |

**Il perché (Cognition, "Don't build multi-agents"):** un'azione porta con sé decisioni implicite; agenti scrittori paralleli prendono **decisioni in conflitto** e produrre output incoerente. Quindi: il read-only si parallelizza, il generativo accoppiato resta single-thread.

> Stabilito *se* serve il multi-agente, il **meccanismo** (subagent / team / API / background) si sceglie col **selettore in §9** — esplicitamente, mai per abitudine.

---

## §2 — Classificazione del problema (decide la FORMA del piano)

`init` classifica la commessa confermata su 4 assi, con **segnali oggettivi** (da `scan`, dal grafo, da `PROGETTO.md`) — non a sensazione.

| Asse | Valori | Segnale oggettivo |
|---|---|---|
| **Natura** | greenfield · brownfield | il grafo/codice è vuoto? |
| **Intento** | feature · refactor · migration · bugfix · security · perf · incident · docs/config · spike | verbo dominante della commessa |
| **Accoppiamento/Rischio** | basso · medio · alto | n. moduli toccati (depcruise), tocca auth/dati? (semgrep/gitleaks), **hotspot di complessità** (`scan` §complessità), reversibilità |
| **Parallelizzabilità** | alta · bassa | i sotto-obiettivi condividono stato/file? (archi nel grafo tra le zone target) |

### Classe → forma della roadmap → topologia → agenti

| Classe (Intento × Rischio) | Forma roadmap | Topologia | Agenti task-specifici | Ricerca web |
|---|---|---|---|---|
| **bugfix · basso** | 1-2 fasi lineari | singolo | Riproduttore → Implementatore → Revisore | no (salvo dipendenza esterna) |
| **incident/hotfix** | **1 fase fast-path**, gate = "il sanguinamento si ferma", **nodo di debito a valle obbligatorio** | singolo | Riproduttore → Fixer | no |
| **feature · medio** | Spec→Design→Impl∥→Integra→Gate | hierarchical | Esploratore, Architetto, 1-N Implementatori (slice disgiunte), Revisore, Test-author | sì se tech/lib nuova |
| **refactor · medio/alto** | Caratterizza(test)→Estrai∥→Verifica-equivalenza | hierarchical | Caratterizzatore-test, Refactorer-per-modulo (∥), Revisore-comportamento | no |
| **migration · alto** | **Ricerca-web**→Spike→Strangler-fig per fetta→Cutover→Rollback | hierarchical + checkpoint stretti | Ricercatore-tech, Architetto, Migratore-per-fetta, Evaluator-parità, Rollback-owner | **sì obbligatorio** |
| **security · qualsiasi** | Audit→Threat-model→Patch→Re-audit (sempre Opus) | mesh/peer-review | Security-auditor, Architetto, Implementatore, **Re-auditor indipendente dal patcher** | sì (CVE/advisory) |
| **perf · medio** | Profila(misura)→Ipotesi→Ottimizza-1→Ri-misura | singolo+loop | Profiler, Implementatore, Evaluator(numero, non opinione) | sì se algoritmo/strumento |
| **greenfield · qualsiasi** | **Ricerca-web stack**→Scaffold→Vertical-slice→Itera | hierarchical | Ricercatore-stack, Architetto, Implementatore-slice, Revisore | **sì obbligatorio** |
| **docs/config-only** | 1 fase, gate = build/link (non `scan`), Specchio opzionale | singolo | Implementatore | no |
| **spike/research-only** | 1 fase time-boxed, output = **raccomandazione**, "il codice è usa-e-getta salvo promozione" | singolo | Ricercatore-tech | sì |

La classe **forza** la forma: niente improvvisazione. Lo Specchio (regola n°0) precede sempre — niente fase prima della commessa confermata.

---

## §3 — Catalogo topologie (nativo)

| Topologia | Quando | Come si spawna (nativo) | Fan-in |
|---|---|---|---|
| **Prompt-chaining** | catena fissa nota | Agent sequenziali, output→input | l'ultimo è il risultato |
| **Routing** | input eterogenei → handler diversi | un classificatore sceglie l'archetipo | n/a |
| **Parallel-sectioning** | sottocompiti disgiunti | più Agent in **un solo messaggio** | l'orchestratore sintetizza |
| **Parallel-voting** | decisione ad alta posta | N Agent stessa domanda, viste diverse | maggioranza/consenso |
| **Map-reduce su file** | stessa operazione su molti file indipendenti | mapper **omogenei**, raggruppati in shard (conteggio da §4, **non 1-per-file**) | **reduce deterministico**: concat/merge/`scan --json` aggregato — non un agente sintetizzatore (deterministico > LLM) |
| **Orchestrator-worker** | breadth > una context window, sottocompiti scoperti a runtime | un lead spawna worker read-only e distilla | il lead integra i riassunti |
| **Evaluator-optimizer** | qualità critica, criteri verificabili | generatore + Evaluator (verdetto PASS/FAIL+issue) in loop | stop: max 2-3 giri o "nessun blocco da `scan`", poi escalation |

---

## §4 — Quanti agenti (scala l'effort al problema)

| Complessità commessa | # agenti | tool-call/agente |
|---|---|---|
| fact-find / mappa singola | 1 | 3-10 |
| confronto / 2-4 aree | 2-4 | 10-15 |
| ricerca complessa multi-dominio | 5-10+ | divisi per responsabilità |

Regola: *non spawnare 5 agenti per una domanda da 1*; ma neanche schiacciare in un agente un lavoro che si divide pulito in 4 aree. Il **segnale di complessità** di `scan` (cognitive/CCN/hotspot, vedi `motore-deterministico.md`) dimensiona insieme **tier del modello** e **numero di agenti**.

---

## §5 — Lo Spec dell'Agente (9 campi)

L'agente perfetto = questi 9 campi, riempiti **meccanicamente** dal task (§7). Non un modulo burocratico: 9 righe.

```
1. RUOLO/MANDATO    – una frase: cosa fa e cosa NON fa (singola responsabilità)
2. MODELLO          – tier da routing-modelli ∝ complessità+criticità
3. TOOL (allowlist) – minimo indispensabile, ENFORCED: un tool omesso è
                      inaccessibile, non un consiglio. Read-only = ometti Edit/Write.
4. CONTESTO         – budget: cosa entra (estratti/grafo/path), MAI file interi inutili
5. INPUT            – task, file target, vincoli, definizione di "fatto"
6. OUTPUT (contratto)– risultato DISTILLATO (lista/diff/verdetto), non log grezzi
7. CRITERI SUCCESSO – condizione testabile di completamento
8. VERIFICA/GATE    – come si controlla l'output (scan/test/evaluator) prima di fidarsi
9. ESCALATION       – se incerto o più complesso del previsto → bump tier / spawn Architetto
```

L'allowlist è **sicurezza E token insieme**: meno tool = meno descrizioni-tool nel contesto; niente Edit/Write = l'agente non può rompere nulla mentre esplora/rivede; niente WebSearch dove non serve = niente fetch verbosi. Preferisci **allowlist** a denylist.

---

## §6 — Libreria archetipi

L'archetipo è il **TIPO**; lo Spec (§5) è l'**ISTANZA**. Le righe read-only NON hanno Edit/Write (sola-lettura *enforced* via allowlist).

| Archetipo | Modello | Tool (allowlist) | Output | Verifica | Usa quando | NON usare quando |
|---|---|---|---|---|---|---|
| **Esploratore** | Sonnet (Explore nativo: Haiku) | Read, Grep, Glob | mappa distillata (≤2k tok) | sola-lettura enforced | capire codice prima di toccarlo | basta `graphify query` |
| **Ricercatore-tech** | Sonnet | **WebSearch, WebFetch**, Read | findings + URL + scelta 2025-26 | citazioni presenti | scegliere libreria/pattern/stack moderni | stack già fissato e noto |
| **Riproduttore** | Sonnet (Opus se intermittente/concorrenza) | Read, Grep, Glob, Bash | repro minimo + causa-radice (1 par.), NON la fix | il repro fallisce *prima*, ipotesi su evidenza | bug / test rosso / "non funziona" | fix ovvio e meccanico → Implementatore |
| **Architetto** | **Opus** | Read, Grep, Glob, WebSearch | ADR breve: scelta + trade-off + confini | review umana (Specchio) | confini di modulo, sicurezza, trade-off non ovvio | edit meccanico |
| **Implementatore** | Sonnet | Read, Edit, Grep, Glob, Bash | diff minimo + nota | `scan` + test | scrivere il codice minimo di una fase | trasformazione deterministica (tier 1) |
| **Test-author** | Sonnet | Read, Write, Edit, Bash, Grep | test che fallisce→passa | i test girano verdi | bugfix non banale / nuova feature | typo/format |
| **Security-auditor** | **Opus** | Read, Grep, Glob, Bash | findings per severità + fix | `semgrep`/`gitleaks` confermano | auth/dati sensibili/confini (**SEMPRE** tier 3) | UI puramente estetica |
| **Revisore** | Sonnet | Read, Grep, Glob, Bash | lista bloccante→nice-to-have | sola-lettura enforced | gate di fine fase | nessun diff da rivedere |
| **Evaluator** | Sonnet | Read, Grep, Glob, Bash | **verdetto** PASS/FAIL + issue list | deterministico (criteri fissi) | loop evaluator-optimizer | one-shot già verificato da `scan` |
| **Integrator** | Sonnet/Opus | Read, Edit, Bash, Grep, Glob | merge funzionante + report conflitti | build+test verdi end-to-end | unire output di agenti paralleli | singolo agente, niente da unire |

---

## §7 — Dal task allo Spec (la regola, niente intuito)

| Segnale del task (osservabile) | Setta | Valore |
|---|---|---|
| transform noto (var→const, rename, format) | archetipo | tier 1 deterministico, **niente agente** |
| read-only ("capisci", "mappa", "dove sta") | tool + modello | Read/Grep/Glob, no Edit; Sonnet (Explore: Haiku) |
| stack/libreria/pattern da scegliere o "moderno/ottimale" | **+WebSearch/WebFetch** | Ricercatore-tech |
| test rosso / bug / "non funziona" | archetipo + ordine | **Riproduttore PRIMA dell'Implementatore** (reproduce-then-fix, mai fix su congettura) |
| tocca auth/segreti/dati sensibili/input non fidato | modello + archetipo | **Opus**, Security-auditor (SEMPRE, anche se piccolo) |
| confine di modulo / trade-off architetturale | modello + archetipo | **Opus**, Architetto + ADR |
| output verboso (test, log, fetch) | isolamento | spawna subagent, contratto = sola sintesi |
| >N file o hotspot di complessità alto | n. agenti | dimensiona con §4 (segnale `scan`) |
| output incerto / qualità critica | + gate | Evaluator in loop (max 2-3 giri, poi escalation) |
| più agenti paralleli con output da unire | + archetipo | Integrator a valle |
| ambiguo / >1 file / irreversibile | gate umano | **Specchio PRIMA** (regola n°0) |

---

## §8 — Coordinamento (DAG, frontiere, gate)

- **DAG**: ogni fase è un nodo; `dipende-da` = archi; deve essere **aciclico** (ciclo → due fasi sono in realtà una). Esiste anche il nodo **`checkpoint`** (zero-spawn, solo predicato: conferma utente / deploy / finestra di merge) — esente dalla regola "1 spawn + 1 gate".
- **Primitivo nativo: parallelo DENTRO un frontier, sequenziale TRA frontier.** Spawni in un solo messaggio **solo** gli agenti del frontier corrente (indipendenti per costruzione); usi `run_in_background:true`; aspetti la notifica di completamento di **tutti**; applichi il gate; **solo a PASS** spawni il frontier successivo. Mai spawnare un frontier dipendente nel messaggio del suo predecessore.
- **Conflitto-file = dipendenza implicita.** Due fasi che scrivono lo stesso file NON sono parallele anche se logicamente indipendenti. Due agenti dello stesso frontier che *potrebbero* toccare lo stesso file (barrel, manifest, lockfile, tipi condivisi) → **serializza**, oppure spawna con `isolation:"worktree"` e fai merge esplicito nel fan-in. Mai due scrittori concorrenti sullo stesso working tree.
- **Handoff contract** (previene la duplicazione: brief vaghi = lavoro duplicato): ogni worker riceve **obbligatoriamente** `obiettivo · formato output · tool/fonti consentiti · confini (cosa NON toccare)`.
- **Gate a 3 esiti**: `PASS`→avanza · `FAIL-recuperabile`→ripeti la fase (solo lavoro **pre-merge**) · `FAIL-struttura`→**ri-pianifica** le fasi rimanenti (riclassifica §2) e **riconferma all'utente** (Specchio).
- **Fase merged = immutabile.** Una fase già unita non si "ripete": il suo fallimento genera un **nodo compensativo** a valle (revert/fix come nuovo nodo del DAG). `rollback:` nello schema distingue **pre-merge** (scarta il branch) da **post-merge** (revert-come-nuovo-nodo).
- **Re-plan versionato**: il re-plan **appende** `## Re-plan N — <data> — causa: <gate fallito>` e **barra** (non cancella) le fasi superate — l'audit trail dello Specchio non si perde. `PROGETTO.md` si riconferma solo se lo scope è cambiato.
- **Granularità**: una fase = **1 spawn + 1 gate**; se serve >1 gate → spezzala; due "fasi" con lo stesso gate → fondile; **fasi > deliverable spedibili distinti → fondi** (no analisi-paralisi). Una fase che non produce un output spedibile in autonomia non è una fase.
- **Critical path** = la catena dipendente più lunga = il vero tempo del progetto; le fasi fuori dal path si parallelizzano per accorciarlo.

> **Lo schema di fase è UNO solo:** è il template `resources/templates/ROADMAP-MULTIAGENTE.md` (campi: obiettivo · dipende-da · tipo · input/output · agenti+spec · modello · definizione-di-fatto · gate · rischi&rollback · ricerca-web). Questo file dà il *metodo*; il template dà i *campi*. Non si duplica lo schema qui.

---

## §9 — Lanciare DAVVERO agenti in parallelo (non simulare)

> **Il problema #1 nella pratica:** chiedi "lancia più agenti" e l'assistente li esegue **a turni, uno dopo l'altro** — è parallelismo *simulato*, non reale. La regola che lo evita è sotto. Tre meccanismi nativi locali, scegli in base a *come* gli agenti devono lavorare insieme.

### Selettore del meccanismo (eseguilo SEMPRE — nessun meccanismo di default)

Per ogni lavoro non banale: scegli **esplicitamente** e **dichiara la scelta in una riga** ("Uso *X* perché *Y*") prima di spawnare. La skill **non spawna per abitudine** — né subagent "perché è il solito", né team "perché fa scena". §1 decide *single vs multi*; questo selettore decide *quale meccanismo*.

Procedura — fermati al primo sì:
1. **Transform deterministico noto** (var→const, rename, format, codemod)? → **NESSUN agente**: tier-1 / `scan`.
2. **Lavoro accoppiato/sequenziale che scrive codice condiviso?** → **1 agente lineare** (no multi-agente: gate §1, mai scrittori paralleli).
3. **Sotto-compiti parallelizzabili E read-only o su file disgiunti** (gate §1)? Se no → torna a (2).
4. Multi-agente confermato → scegli col discriminante ↓.

| Domanda chiave (in ordine) | Se sì → |
|---|---|
| Gli agenti devono **parlarsi/sfidarsi/coordinarsi mentre lavorano** (dibattito, ipotesi concorrenti, task list condivisa, consenso)? | **Agent Teams (B)** |
| Parallelismo **sostenuto/lungo**, o un worker **supera la context window**? | **Agent Teams (B)** (sessioni vere, context proprio) |
| …altrimenti ognuno fa il suo, **basta un riassunto al lead**, lavoro breve/contenuto (fan-out read-only, map-reduce su file) | **Subagent batch (A)** |
| **Molte sessioni indipendenti e lunghe** da sorvegliare da un pannello, **senza** coordinazione | **Background agents (C)** |

**Mappa rapida per classe di problema (da §2):** bugfix/feature con esplorazione → **A**; debugging a ipotesi concorrenti · security audit+re-audit incrociato · cross-layer con owner diversi → **B**; migrazione lunga multi-fetta → **B**; "mappa/classifica N file" → **A** (map-reduce + reduce deterministico).

**Regola sul flag (niente fallback silenzioso):** se la scelta è **B** ma `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` è spento → **non ripiegare di nascosto su A**. Dichiara: *"Servirebbe un team (gli agenti devono parlarsi) ma il flag è spento → (a) abilito il flag, oppure (b) procedo coi subagent A accettando che non comunicheranno."* La scelta è dell'utente.

### Meccanismo A — Subagent in batch (parallelismo vero ma "muto")
Il tool `Agent`/`Task`: ogni subagent vive **in una sola sessione**, ha la **sua context window**, fa il lavoro e **riporta solo al lead un riassunto distillato** — gli agenti **non si parlano** tra loro.
- **Parallelismo VERO ⇔ tutti gli spawn in UN SOLO messaggio** (più tool-call `Agent` nello stesso messaggio). Se li emetti uno per turno → **si serializzano** (la "simulazione" che vedi). Trigger naturale: *"indaga auth, database e API in parallelo con subagent separati"*.
- **Esecuzione concorrente:** `run_in_background: true` (o frontmatter `background: true`, o Ctrl+B, o `CLAUDE_CODE_FORK_SUBAGENT=1` che mette in background ogni spawn).
- **Annidamento:** un subagent può spawnare altri subagent, ma con **limite di profondità 5** (a profondità 5 non riceve più il tool `Agent`).
- Best per: fan-out read-only, sottocompiti disgiunti, "indaga e riporta". Costo token più basso (torna solo la sintesi al lead). Per parallelismo *sostenuto* o oltre la context window → Agent Teams (B).

### Meccanismo B — Agent Teams (vero team: gli agenti si parlano)
Istanze Claude Code **separate e indipendenti**, ognuna con la sua context window, una **task list condivisa** (claim con file-lock) e una **mailbox** per messaggiarsi direttamente. Un lead coordina; puoi anche parlare a ogni teammate.
- **Abilitazione** (sperimentale, off di default): `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `settings.json` (`env`) o nell'ambiente. Senza il flag, nessun team parte.
- **Spawn:** in linguaggio naturale al lead — *"spawn 3 teammates per rivedere la PR: uno sicurezza, uno performance, uno test; fateli confrontare"*. Il lead crea la task list e li lancia.
- Un teammate può usare una **definizione di subagent** (`.claude/agents/*.md`) per nome → ne onora `tools`/`model`; `SendMessage` e i tool di task sono sempre disponibili.
- Display: in-process (qualsiasi terminale) o split-pane (`tmux`/iTerm2, `teammateMode`).
- Best per: **dibattito/ipotesi concorrenti** (debugging), review in parallelo con sfida reciproca, lavoro cross-layer (frontend/backend/test, un owner ciascuno).
- 3-5 teammate è il punto giusto; costo token alto (ogni teammate è una Claude piena). File condivisi → assegna file disgiunti. Limiti: un team per sessione, niente team annidati, no resume dei teammate in-process.

### Meccanismo C — Background agents (agent view)
Quando vuoi lanciare **molte sessioni indipendenti in parallelo e sorvegliarle da un solo pannello** (non agenti che si parlano, non subagent che riportano: sessioni vere e proprie, monitorate insieme). È l'`agent view` nativo. Best per: tanti task isolati che girano a lungo in parallelo.

### Checklist anti-simulazione (la regola che chiedevi)
```
Vuoi parallelismo VERO, non simulato:
  ✓ Subagent (A): TUTTI gli spawn in UN solo messaggio (più tool-call insieme), MAI uno per turno
  ✓ run_in_background: true
  ✓ Gli agenti devono PARLARSI / sfidarsi? → i subagent NON bastano (riportano solo al lead):
      usa Agent Teams (B), col flag CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS abilitato
  ✓ Verifica: tornano INSIEME (un batch di risultati) o compaiono nel pannello teammate.
      Se rientrano in fila, a turni separati → stai simulando: ripeti il batch in un messaggio.
```

### Tipo persistente vs istanza ad-hoc (vale per A e B)
I file `.claude/agents/*.md` si registrano **solo** da `.claude/agents/`, `~/.claude/agents/` o dai plugin — **una skill non può fare auto-register dei propri**.

| Modo | Quando | Come (nativo) |
|---|---|---|
| **Ad-hoc** (default) | ogni istanza unica per-fase | `Agent(subagent_type, model, prompt)` — il `model` per-spawn vince sul frontmatter |
| **Persistente** | tipo rispawnato spesso (Esploratore/Revisore/Security-auditor/Evaluator), riusabile anche come teammate | `setup` **genera** lo scheletro in `.claude/agents/<nome>.md` e chiede conferma all'utente; la skill non lo registra da sé |

I 9 campi dello Spec (§5) mappano sui campi frontmatter reali: `name`+`description` (ruolo, obbligatori), `tools`/`disallowedTools` (allowlist enforced), `model` (il tier; `inherit` per ereditare), `permissionMode`, `isolation: worktree` (copia isolata del repo per i writer concorrenti), `maxTurns`, `effort`, `background`, `skills`, `memory`. Corpo del file = system prompt. Solo `name` e `description` sono obbligatori.

---

## §10 — Degradazione (per fase)

- Nessun parallelismo possibile → **collassa al singolo agente lineare** (nessuna perdita di correttezza, solo di velocità).
- Frontiera di lettura parallelizzabile + frontiera di scrittura accoppiata → **non è un collasso, è un confine di fase**: parallelizza la lettura, serializza la scrittura.
- Senza `WebSearch` → la fase di ricerca-web degrada (vedi `ricerca-web.md`): si decide sul knowledge cutoff e si **marca l'assunzione** come da verificare.
- Senza graphify → contesto via Grep/Glob mirati invece che dal grafo.
