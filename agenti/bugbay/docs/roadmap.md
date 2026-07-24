# Roadmap multiagentica — BugBay 24/7

Mappa d'esecuzione parallela sopra il design finalizzato (concilio a due giri, 0 rigetti).
Design di riferimento in memoria: `bugbay-autonomous-24-7-design`. Evidenze JSON in `scratchpad/oss-research/` e `scratchpad/concilio/` (sessione a2e03322).
Audit di completezza (6 lenti → consolidamento → verifica avversariale → sintesi, 43 agenti): 56 gap grezzi → 35 unici → 21 confermati, ripiegati qui sotto.

Milestone: **v0.5.1** (hotfix P0, *S*) → **v0.6** (observability, *L*) → **v0.7** (governo+lifecycle, *L*) → **v0.8** (memoria, *M*) → **v0.9** (autonomia shadow-first, *L*).
Effort band = agent-wall-clock grossolano, non person-day. La catena critica è tutta M-L: W0 spina → L ledger → R retrieval → G eval-gate.

---

## Principio che rende il parallelo sicuro

Un solo punto di serializzazione per milestone: **congelare il contratto condiviso** (schema DB + tipi TS delle righe + nomi eventi) come *Wave 0*. Poi tutti gli agenti fanno fan-out contro il contratto congelato. Senza → merge-hell sulle tabelle condivise. Con → 4-6 track paralleli, zero collisioni.

Regole operative:
- **1 track = 1 branch/worktree** (isolamento worktree già nel design).
- **1 file conteso = 1 solo owner** (es. `api/agent-fix.ts` non lo toccano due agenti insieme).
- **Ordine di merge dentro la milestone:** schema → writer → reader → viste.
- **Ogni loop di apprendimento nasce in shadow** ("avrei fatto X" in console) dietro il suo gate e la sua vista — mai live prima.

Aggiunte alle Regole operative (valgono da v0.5.1 in poi):

- **Invarianti di sicurezza permanenti** — ogni branch che tocca `claude.ts` o `scope-guard.ts` DEVE passare: (1) gli `allowedTools` del fixer non contengono alcun grant `Bash`/shell né in read né in edit (`claude.ts:120-121`); (2) lo scope-guard NEGA (exit 2) con `BUGBAY_TARGET_ROOT` non settato o payload `PreToolUse` non-parsabile (oggi fail-OPEN, `scope-guard.ts:40,44`). Questi file sono ri-ownati dopo v0.5.1 (v0.6-A parser, v0.7-R routing, v0.8-R prompt) → i check impediscono la regressione silenziosa del P0.
- **Secret-scan sul commit non presidiato** — prima di OGNI commit autonomo (`git.ts` `commitFiles`) e di ogni commit bullet ACE (v0.8-A), il regex secret-scan vendorizzato gira sul diff staged; un hit blocca il commit e scrive una riga `alerts`. Owner: security-auditor; nel gate v0.9-G, o attaccato al commit path se atterra prima.
- **Disciplina vendoring** — ogni artefatto vendorizzato vive sotto un solo `vendor/`, con hash della sorgente + commento di provenienza; `verify`/CI falliscono se l'hash driftà. Owner: security-auditor (controllo supply-chain, legato alla history chiavi-committate). Mappa ai track consumer esistenti (nessun track nuovo): secret-scan → v0.5.1 gate; ccusage block + pricing subset → v0.7-L; soglie StuckDetector → v0.6 obs; Thompson → v0.9-B; autoevals → v0.9-G. Ogni dep nuova è un add esplicito a `web/package.json` nel suo track: `croner`→v0.7-S, `gray-matter`→v0.8-A, `semver`→v0.9-Ra, `recharts`→v0.9-K.

## Roster (8 ruoli, non tutti attivi insieme)

| Ruolo | Agent type | Dove pesa |
|---|---|---|
| Architetto spina | `system-architect` | Wave 0 di ogni milestone |
| Backend core | `backend-dev` / `coder` | writer, parser, ledger, retrieval |
| Sicurezza | `security-architect` + `security-auditor` | v0.5.1, trust boundary L2 |
| Piattaforma/lifecycle | `cicd-engineer` | Task Scheduler, watchdog, install |
| Memoria | `memory-specialist` + `reasoningbank-learner` | v0.8, bandit shadow |
| Test/eval | `tester` + `tdd-london-swarm` | harness (da v0.5.1), BRT, golden, eval gate |
| Perf | `performance-engineer` | benchmark ledger, materializzazione |
| Review | `reviewer` / `code-analyzer` | gate di merge per ogni track |

Il ruolo test/eval è staffato **da v0.5.1**, non solo a v0.9-G: serve l'harness che ospita ogni barriera "Sync" prima ancora del primo fan-out.

### Rischi residui e P0 → track (ogni item ha una casa)

| P0 (hotfix) | Track | Owner |
|---|---|---|
| route auth mancante | v0.5.1 T1/T2 | security-architect |
| grant `Bash(graphify)` (RCE) | v0.5.1 T3 + invariante permanente | security-auditor |
| scope-guard fail-open | v0.5.1 T3 + invariante permanente | security-auditor |
| `strict-ssl=false` (TLS off) | v0.5.1 T4 | cicd-engineer |
| chiavi committate | v0.5.1 T5 + secret-scan gate | utente + security-auditor |

| Rischio residuo (design) | Track | Mitigazione |
|---|---|---|
| A13 reboot blind spot | v0.7-P | check ARSO + heartbeat healthchecks.io |
| watchdog vs stop di dev | v0.7-P | flag maintenance-pause |
| drift formato ccusage/JSONL | v0.7-L | parse-failure → alert + breaker (budget-unknown) |
| A20 bullet malformato | v0.8-A | quarantena + identità committer dedicata |
| run stallata/in loop | v0.7 StuckDetector | alert + park/abort |
| contaminazione retrieval (IT grezzo) | v0.8-R | guard + gate di misura |
| auto-rollback = vettore persistenza | v0.9 | rollback resta umano (già) |

---

## v0.5.1 — hotfix P0 (parallelo pieno, ~2-4gg, effort *S*)

Cinque fix indipendenti. Fan-out immediato, nessuna Wave 0 (nessuno schema nuovo).

| Track | Owner | File | Note collisione |
|---|---|---|---|
| T1 auth bearer (**tutte** le route privilegiate, non solo agent-fix — incl. `api/audits.ts` che spawna la CLI) | security-architect | `middleware.ts`, `api/agent-fix.ts`, `api/audits.ts` | **T1+T2 stesso file → un solo owner per la route** |
| T2 rimuovi bypass `isSafeAction` | (stesso di T1) | `api/agent-fix.ts:153` | accorpato a T1 |
| T3 drop `Bash(graphify)` + scope-guard fail-closed | security-auditor | `claude.ts:120-121`, `scope-guard.ts:40,44` | indipendente |
| T4 CA fix (`NODE_EXTRA_CA_CERTS`) ritira `strict-ssl=false` | cicd-engineer | `src/cli/dev.mjs:83-84`, `src/cli/update.mjs:38-39` (**NON** `.npmrc`) | indipendente |
| T5 rotazione chiavi | **utente** + coder | dashboard provider | azione umana, non bloccante |

3 agenti in parallelo (security×2 + cicd), T5 in mano all'utente.

**Correzione T4:** non esiste `.npmrc` nel repo. Il `--strict-ssl=false` insicuro (verifica TLS spenta) vive in due retry di spawn npm — `dev.mjs:83-84` e `update.mjs:38-39` (+ nota `README.md:39`). Ritarga T4 lì: rimuovi il retry e passa la CA aziendale via `NODE_EXTRA_CA_CERTS` sull'env di npm (ereditato dal figlio daemon), catturando il path della CA una volta nel config per-macchina (`setup.mjs` → `~/.bugbay`). NON basta cancellare il flag: il proxy TLS-inspecting di questa macchina rompe gli install senza una CA valida.

**Gate della barriera v0.5.1** (oltre "route rifiuta senza token"):
- **T3** — `allowedTools` del fixer senza `Bash`/shell (read+edit); scope-guard exit 2 con root unset o payload non-parsabile.
- **T4** — grep: nessun `--strict-ssl=false` residuo; `npm install` riesce con verifica cert ON.
- **T5** — le chiavi sono già nella history git → il check vincolante è la **conferma di revoca dalla dashboard provider** (revocate = copie committate inerti), non uno scan di HEAD/working-tree.

---

## v0.6 — fondamenta observability (spina = collo di bottiglia, effort *L*)

**Wave 0 — SERIALE, 1 architetto spina (effort M-L da solo = collo di bottiglia). Congela il contratto `hub.sqlite` (DDL in Appendice A). Deliverable con owner+file — non più prosa:**

| # | Deliverable | File | Nota |
|---|---|---|---|
| 0 | Harness self-test daemon su `web/src` (`npm test`) | `web/package.json`, `tests/` | prerequisito di OGNI barriera "Sync"; runner deciso a build (node:test = zero-dep; vitest solo se Next lo impone). Tirabile in v0.5.1. |
| 1 | `openWalDatabase` **hard-fail** (via `return null`) | `sqlite.ts:42-44` | kill del fallback silenzioso |
| 2 | Bump `engines.node >=22.13` + assert hard-fail all'avvio | root **+** `web/package.json` | web NON ha il campo oggi; senza, i nodi <22.13 perdono storage muto |
| 3 | Spina 3 tabelle + `runs`/`alerts` + skeleton `usage_blocks`/`daemon_sessions`/`config_versions` + tipi TS + set eventi | nuovo `hub.ts` + DDL | freeze unico: FK pinnate qui |
| 4 | `store.ts`: droppa `createJsonBackend`, migra `agent_runs` → `runs` in `hub.sqlite` | `store.ts:87,149` | **poi FROZEN** → handoff a Wave-1-C (unico file su 2 wave, sequenziale sulla barriera: non è violazione doppio-owner) |
| 5 | Relocation spina → **machine-scoped** `~/.bugbay/hub.sqlite` + migrazione una-tantum del `.bugbay/agent-runs.sqlite` per-repo | `target-root.ts:40-48`, `dev.mjs` (`BUGBAY_DATA_DIR`) | SOLO la spina si sposta; token daemon/registro PID/settings restano per-repo. `target-root.ts`+`dev.mjs` sono **W0-owned** → nessun track W1 li tocca |
| 6 | `local-db.ts`: migrazione PROPRIA a `node:sqlite` + rimozione `createJsonBackend` | `local-db.ts:94,146,170` | DB SEPARATO (report/checklist dev, MAI la spina): cancellarne solo il fallback lo romperebbe (better-sqlite3 mai installato) |

**Autorità dello stato run (decisione W0):** `runs` row in `hub.sqlite`, colonna `phase` autoritativa (il blob `AgentRun` resta in `runs.data` per compat). La transizione di fase e il suo `events` INSERT commitano nella **stessa `transact()`** — invariante impossibile finché lo stato è un blob in un DB per-repo separato. `alerts` freeza QUI (consumer già v0.6: SYSTEM tab + toast parse-failure/watchdog); `config_versions` slitta al mini-freeze v0.7; `radar_findings` freeza al landing di Ra.

**Wave 1 — 4 track paralleli contro lo schema congelato:**

| Track | Owner | File |
|---|---|---|
| A · parser stream-json (stdout claude → `observations`) | backend-dev | `claude.ts` |
| B · SSE emitter (`events` → HTTP, Last-Event-ID resume) | backend-dev | nuovo `sse.ts` |
| C · state machine (transizione run + evento **stessa txn**) | backend-dev | `store.ts` congelato (handoff da W0-#4) |
| D · shell console + nav INBOX/NOW/SYSTEM | coder | `web/…/console/` |

Sync: una run produce `events`+`observations`, la console li rende.

**Wave 2 — 2 owner (dopo Wave 1):** coder(fe) possiede RUN DETAIL evidence-first + NOW live-SSE (entrambi editano la shell console D e consumano la SSE B → 1 coder in serie, ~2 lane); backend-dev possiede il job INBOX daily-review. Sync: smoke end-to-end.

---

## v0.7 — governo + lifecycle (effort *L*)

Mini-freeze di 1 slice per le tabelle `usage_blocks`/`daemon_sessions`/`config_versions` **+ la firma del breaker** `budgetGate(channel) -> { ok, pausedUntil }`. Con la firma freezata la collisione L↔S sparisce.

| Track | Owner | File (owner UNICO) | Dipende | ‖ |
|---|---|---|---|---|
| **L · Ledger duale** (materializza `usage_blocks`, weekly rollup, riserva umana, dedup `daemon_sessions`, **implementa `budgetGate`**; parse-failure ccusage → `alerts`+budget-unknown→breaker, NON zero-count; **park `session_id` all'esaurimento → `pausedUntil`=prossimo reset, al reset rilancio `--resume`, zero re-spend**) | backend-dev + performance-engineer | nuovo `ledger.ts` | mini-freeze | S,R,P |
| **S · Scheduler** (croner al posto di `setInterval`, coda su lease; **wira `budgetGate` ai siti dispatch/poll**) | backend-dev | `runner.ts:49,291,298` + `audits.ts:316,336` | firma `budgetGate` | L,R,P |
| **R · Routing** (vedi correzione R) | coder | `esecuzione.ts` | — | tutti |
| **P · Piattaforma** (vedi Track P) | cicd-engineer | fuori dal codice app | — | tutti |

S è **owner unico** di `runner.ts`+`audits.ts` (i soli 2 loop `setInterval` e i soli siti dispatch-spesa); L implementa solo `budgetGate` in `ledger.ts` — nessuno tocca i file dell'altro, L‖S regge. Il park/resume auto-al-reset è un touchpoint L↔S (S possiede `dispatchQueue` sul lease): coordinamento, non meccanismo a sé.

**StuckDetector** (guard a livello-run, soglie vendorizzate): piccolo track governance v0.7, **dipende dalle `observations` di v0.6** — legge la timeline della run e su stallo/loop (nessuna nuova observation/`tool_use` per N min; repair-loop oltre soglia) scrive `alerts` e parka/aborta. Distinto dal watchdog di P (solo liveness di processo). Superficie: NOW view.

**Gate S:** sotto tick croner sovrapposti la coda dispatcha ogni report **esattamente una volta** (no doppio-dispatch: due run sullo stesso `reportId` doppio-spendono E collidono sul branch `bugbay/auto/<reportId>`); 1 solo poller per processo.

**Digest mattutino:** owner **L** (backend-dev, legge il ledger) — non attaccarlo al job INBOX di v0.6.

### Track P — percorso di produzione e barriera 24/7

Track P è l'unico senza barriera d'integrazione nella mappa originale. Due item che il design impone e la mappa aveva perso:

- **Percorso di produzione**: il daemon 24/7 gira su `next build` (uno per versione) → `next start`; ritira `next dev` per la via autonoma (`dev.mjs:106`). Oggi lancia `next dev` — ricompila/hot-reload/leaka (gli hack singleton-su-`global` in `store.ts`/watch/audit esistono SOLO per sopravvivere ai reload). Porta la decisione "Production next start, NOT next dev" nella mappa: senza owner spedirebbe su dev.
- **Heartbeat esterno opt-in**: sul tick del watchdog 5-min, ping a healthchecks.io — dead-man out-of-band per il caso reboot/no-auto-logon dove daemon+watchdog+toast muoiono insieme (un ping mancato è l'unico segnale superstite). Spedito con il check ARSO all'install; opt-in, degrada se rifiutato.

**Barriera P:** daemon killato riparte ≤5 min + toast; con maintenance-pause il watchdog NON riavvia; check ARSO all'install avverte se assente; runtime asserisce `next start`, non `next dev`; il tick emette sia il restart locale sia il ping esterno.

### Correzione R — superficie reale del routing

Le due note originali su R erano sbagliate rispetto al codice.

- **Superficie R:** R estrae `chooseModel(ctx)` dai siti di selezione modello hardcoded in **`esecuzione.ts`** (interprete→Haiku `:112,119`; repro→Sonnet `:267`; fix `heavy?Opus:Sonnet` `:311-314`; piano→Opus `:326`; escalation→Opus `:441-446`; giudice→Haiku `:503,565`) — **~6 siti, non 3**. `claude.ts` tiene solo le costanti `MODEL_*` (`:29-31`) + `runHeadless`; il modello audit è config-driven (`audit.model`) → fuori scope. Sposta `MODEL_*` in un nuovo `routing.ts` per azzerare ogni overlap con A.
- **Perché R non si pull-forwarda (motivo corretto):** R **non** collide con v0.6-A su `claude.ts` (A riscrive il parser stream di `claude.ts`; R edita i siti-decisione in `esecuzione.ts`). Il vero vincolo: `esecuzione.ts` è non-ownato nella tabella W1 e i suoi call-site `updateRun` sono churnati dal track state-machine W1 (C). Va sequenziato dopo W1 per QUESTO, non per una collisione su `claude.ts`.

Invariante R: estrazione behaviour-preserving — `chooseModel(ctx)` ritorna lo stesso modello che ogni contesto seleziona oggi (test di caratterizzazione su `complessità × priority × escalated × tipoTask`).

Digest mattutino: dopo L (legge il ledger). Sync: la coda rispetta le zone del ledger.

---

## v0.8 — memoria (spina di v0.6 è prerequisito, effort *M*)

| Track | Owner | Dipende | Parallelo con |
|---|---|---|---|
| **E · Episodica** (schema caso ExpeRepair, write-on-verdict) | memory-specialist | `scores` (v0.6) | A |
| **A · Bullet ACE** (`.bugbay/knowledge/*.md`, gray-matter, quarantena malformati, identità committer dedicata) | memory-specialist | — | E |
| **R · Retrieval** (FTS5 BM25 su inglese-riformulato + error-string, guard contaminazione) | backend-dev | E+A | S |
| **S · Segnali** (impliciti merge/discard → `scores`, regressione decisa dal BRT) | coder | `scores` + git watch | R |

E‖A prima; R dopo E+A; S‖R.

**Gate R (falsificabile):** su una fixture piccola fissa misurata in-milestone (NON bloccare sul golden SWE-bench-tradotti, deliverable v0.9), retrieval-ON deve dare delta **≥0** vs OFF su una metrica nominata (tasso "soddisfatto" al primo giro, o round di repair medi); se negativo, il retrieval spedisce dietro flag, non nel prompt live. La reiezione dell'italiano grezzo è la condizione-di-pass di questo gate (è già la "guard contaminazione" di R, non un item nuovo).

---

## v0.9 — autonomia shadow-first (il gate comanda, effort *L*)

| Track | Owner | Dipende | Note |
|---|---|---|---|
| **G · Eval gate** (flip-count appaiato, ≤10 smoke L2, golden SWE-bench-tradotti, `evalWorktree`, rollback 1-click) | tester + reviewer | v0.6+v0.8 | **gate di tutto — atterra per primo** |
| **B · Bandit shadow** (Thompson + soglie A33, "avrei fatto X" in console) | reasoningbank-learner | routing v0.7 | live solo oltre soglia |
| **C · Consolidamento** (trigger-based) | memory-specialist | v0.8 | — |
| **Ra · Radar notify-only** (dep major, semver, file-as-fix 1-click) | coder | — | **indipendente → può atterrare presto** |
| **K · KPI/dashboard** | coder | tutti | ultimo |

G prima di B/C live. Ra parallelizzabile fin da v0.7 se serve riempire una wave.

**Gate G (meta-test):** il gate deve dimostrare di sapere diventare ROSSO prima di poter gateare. DoD = coppia di controllo seeded permanente — un diff **BAD** che DEVE fare rosso (regressione presa) + un diff **GOOD** che DEVE passare verde (nessun falso allarme), tenuta come self-test. Il rollback (già deliverable) asserisce il ripristino dello SHA known-good.

**Gate B (shadow):** con soglie A33 **non** superate, l'output live di `chooseModel` è **invariato** dal bandit (raccomandazione shadow registrata ma non applicata); solo oltre soglia la selezione live segue il bandit.

---

## Percorso critico (la catena più lunga)

```
v0.5.1 auth ─┐
             ├─► v0.6 SPINA ─► v0.7 ledger ─► v0.8 retrieval ─► v0.9 eval-gate ─► v0.9 bandit-live
(P0, a parte)┘   (Wave 0)      (scores)       (memoria)         (gate)            (shadow→live)
```

Tutto il resto è slack attorno a questa catena. La spina **v0.6 Wave 0** è il singolo punto dove il parallelo si ferma: fin lì 1 architetto, da lì in poi 4-6 agenti sempre. P/Ra/K sono slack overlappabile in calendario; la catena W0→L→R→G è strettamente seriale (ciascun anello M-L) — il pull-forward di P+Ra la accorcia di ~una milestone.

## Definition-of-Done per track (barriere eseguibili)

**"Sync" ridefinito globalmente:** ogni riga "Sync"/"Barriera d'integrazione" è un **check automatico eseguibile non presidiato** (harness Wave-0), non la lettura di un diff da un reviewer-agent. È questo che rende auditabile il merge parallelo contract-first.

| Track | Gate |
|---|---|
| v0.5.1 T1/T2 | route privilegiata rifiuta senza bearer |
| v0.5.1 T3 | `allowedTools` senza Bash/shell (read+edit); scope-guard exit 2 su root-unset e payload non-parsabile |
| v0.5.1 T4 | nessun `--strict-ssl=false`; `npm install` OK con cert ON |
| v0.5.1 T5 | revoca confermata da dashboard provider (chiavi già in history) |
| v0.6-C | crash tra state-write ed event-write → ROLLBACK entrambi; `events` append-only (mai update/delete) |
| v0.6-B | resume via Last-Event-ID non perde né duplica eventi |
| v0.7-S | ogni report leased+eseguito 1 volta sotto tick sovrapposti; 1 poller/processo |
| v0.7-L | parse-failure → alert+breaker (no zero-count); park→`--resume` zero re-spend |
| v0.7-P | restart ≤5min+toast; maintenance-pause sopprime; ARSO warn; runtime `next start`; heartbeat sul tick |
| v0.7 StuckDetector | run stallata/loop → alert + park/abort |
| v0.8-R | delta ≥0 su metrica nominata; contesto solo inglese-riformulato/error-string |
| v0.9-G | coppia seeded BAD→rosso, GOOD→verde; rollback → SHA known-good |
| v0.9-B | sotto soglia A33 live invariato dal bandit |
| commit path | secret-scan sul diff staged blocca commit autonomo/ACE + alert |

## Sequenza d'onda (chi lavora quando)

| Fase | Agenti in parallelo | Barriera d'integrazione |
|---|---|---|
| v0.5.1 | 3 (sec×2, cicd) | route rifiuta senza token |
| v0.6 W0 | 1 (architetto) | schema+tipi congelati |
| v0.6 W1 | 4 (backend×3, coder) | run→events+obs→console |
| v0.6 W2 | 2 (coder serie ~2 lane, backend INBOX) | smoke e2e |
| v0.7 | 4 (backend+perf, backend, coder, cicd) | coda rispetta zone ledger |
| v0.8 | 2→3 (E‖A, poi R‖S) | retrieval nel prompt fixer (delta ≥0) |
| v0.9 | G da solo → poi 3 (B,C,Ra) → K | gate verde prima di live |

---

## Kickoff

Primo comando reale: spawn dei 3 agenti di v0.5.1 in un messaggio (P0 vivo, non dipende da niente). In parallelo l'architetto disegna lo schema spina v0.6 (Wave 0, Appendice A) così quando l'hotfix chiude, la spina parte subito. L'harness di test (W0-#0) è tirabile già ora, così le barriere "Sync" nascono eseguibili.

---

## Ricontrollo del metodo

**Fan-out contract-first è il modo giusto — ma solo da v0.6 Wave 1 in poi** (≥4 track isolati). Nelle fasi strette lo swarm è overhead netto: v0.5.1 sono 3 fix piccoli, v0.6 Wave 0 è 1 solo architetto. Lì non orchestrare pesante — un agente per fix, e via.

### Ottimizzazione critical-path: pull-forward

Durante v0.6 Wave 0 lavora **solo l'architetto**, 5+ agenti fermi. Quella finestra si riempie con i track **indipendenti dalla spina**, tirati avanti:

| Track tirato avanti | Owner | Perché può |
|---|---|---|
| v0.7-P (Task Scheduler/watchdog/install) | cicd-engineer | zero dipendenza dallo schema |
| v0.9-Ra (radar notify-only) | coder | zero dipendenza dallo schema |
| Harness di test (W0-#0) | tester | prerequisito trasversale, zero dipendenza dallo schema |

**NON** tirare avanti v0.7-R (routing): non per collisione su `claude.ts` (motivo originale errato — R vive in `esecuzione.ts`, non in `claude.ts`), ma perché `esecuzione.ts` è churnato dal track W1-C (state-machine) sui call-site `updateRun` → R va dopo W1.

Risultato: mentre l'architetto congela lo schema, cicd + coder + tester consegnano lifecycle + radar + harness. Lo stallo "1 architetto" diventa produttivo → il percorso critico si accorcia di ~una milestone.

### Touchpoint umani (tutti spinti in fondo)

| Touchpoint | Quando | Blocca? | Nota |
|---|---|---|---|
| Rotazione chiavi | v0.5.1 | **No, async** | Unica presenza umana precoce, inevitabile (dashboard provider). Non ferma nessun merge — i track girano lo stesso. |
| Sign-off merge | **solo a fine milestone** | soft | Non per-track. Il `reviewer` agent fa il gate su ogni branch; l'umano firma solo il confine di milestone. |
| Rollback eval | v0.9 | — | 1-click, by-design. L'auto-rollback è vettore di persistenza attacco → resta umano, e sta già il più tardi possibile. |
| Approve/discard runtime | runtime, non build | — | È il prodotto, non impalcatura. Lo **shadow-first lo riduce nel tempo** (merge = approve): l'autonomia stessa spinge l'umano in fondo. |

Il design **già** incarna "umano in fondo": la progressione shadow→live di v0.9 è esattamente questo. L'unica presenza umana che non si può spostare è la rotazione chiavi, ed è resa non-bloccante.

### Verdetto

Struttura confermata. Modifiche dal ricontrollo: (1) pull-forward di P+Ra+harness nella finestra Wave 0; (2) sign-off umano consolidato ai confini di milestone; (3) audit di completezza (43 agenti) ha chiuso 21 gap — contratto Wave-0 concreto con file+owner, gate falsificabili per ogni track, correzioni fattuali (T4 su `dev.mjs`/`update.mjs` non `.npmrc`; R su `esecuzione.ts` ~6 siti non `claude.ts`). Nessun altro punto umano prima di v0.9 se non la rotazione chiavi (async).

### Fuori scope (deliberato, da design)

La valutazione golden SWE-bench-tradotti completa resta il gate v0.9 (non tirata in v0.8); il learner P90 del budget è rimandato a v0.9; le asserzioni di test concrete restano al build di milestone — la roadmap possiede le barriere e le regole-invariante, non il codice dei test.

---

## Appendice A — Contratto Wave-0 congelato (DDL + tipi + eventi)

Artefatto che v0.6 Wave 0 freeza. Congelato ⇒ nessuno scrive writer/reader prima. FK pinnate qui una volta.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- BugBay hub.sqlite — CONTRATTO WAVE-0 CONGELATO (v0.6). Artefatto che Wave 0 freeza.
-- Un solo file MACHINE-SCOPED: ~/.bugbay/hub.sqlite (node:sqlite/DatabaseSync, WAL).
-- Congelato ⇒ nessuno scrive writer/reader prima. Tutte le FK pinnate qui, una volta.
-- Invarianti onorati: INSERT-before-emit · transizione-run + suo evento STESSA txn ·
-- usage_blocks MATERIALIZZATA (non VIEW) · observations flat snake_case + parent_id
-- nullable + span_kind · events.id = SSE Last-Event-ID (monotono, mai riusato).
-- ═══════════════════════════════════════════════════════════════════════════
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys  = ON;

-- runs — AUTORITÀ dello stato run (consolida agent_runs qui, per la garanzia same-txn).
-- Decisione W0: runs row, colonna `phase` autoritativa; il blob AgentRun resta in `data`
-- (campi non-spina, compat). phase aggiornata nella STESSA transact() dell'events INSERT.
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,               -- runId
  report_id   TEXT NOT NULL,
  project_id  TEXT,
  phase       TEXT NOT NULL,                  -- RunPhase (queued|interpreting|…|error)
  branch      TEXT,
  session_id  TEXT,                           -- --resume (park/resume budget v0.7-L)
  data        TEXT NOT NULL,                  -- blob AgentRun JSON (campi non-spina)
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_report_idx ON runs (report_id);
CREATE INDEX IF NOT EXISTS runs_phase_idx  ON runs (phase);

-- events — append-only (MAI update/delete). id monotono = SSE Last-Event-ID.
-- INSERT-before-emit: il COMMIT dell'INSERT precede l'emit sul canale SSE.
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,   -- Last-Event-ID
  run_id      TEXT NOT NULL REFERENCES runs(id),
  name        TEXT NOT NULL,                   -- vedi EVENT_NAMES
  phase_from  TEXT,                            -- transizione: stato precedente (null = nascita)
  phase_to    TEXT,                            -- transizione: nuovo stato (null = non-transizione)
  payload     TEXT,                            -- JSON opzionale
  ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_run_idx ON events (run_id, id);

-- observations — timeline PIATTA snake_case; alberatura via parent_id nullable;
-- span_kind tipizza lo span. Nomi OTel gen_ai.* SOLO al confine export opzionale.
CREATE TABLE IF NOT EXISTS observations (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(id),
  parent_id     TEXT REFERENCES observations(id),  -- nullable (root span)
  span_kind     TEXT NOT NULL,                 -- 'llm'|'tool'|'gate'|'phase'|'repair'|'plan'
  name          TEXT NOT NULL,
  stage         TEXT,                          -- 'interprete'|'fixer'|'gate'|'giudice'|…
  sym           TEXT,                          -- vocabolario simboli (types.ts)
  model         TEXT,
  status        TEXT,                          -- 'ok'|'error'|'running'
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      REAL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  ms            INTEGER
);
CREATE INDEX IF NOT EXISTS obs_run_idx    ON observations (run_id, started_at);
CREATE INDEX IF NOT EXISTS obs_parent_idx ON observations (parent_id);

-- observation_bodies — payload pesanti (prompt/diff/stdout) fuori dalla riga calda,
-- STESSO DB (non file attach). 1:1 con observations.
CREATE TABLE IF NOT EXISTS observation_bodies (
  observation_id TEXT PRIMARY KEY REFERENCES observations(id),
  body           TEXT NOT NULL
);

-- scores — verdetti: HUMAN (peso 1.0) | JUDGE | IMPLICIT (0.25). Alimenta v0.8.
CREATE TABLE IF NOT EXISTS scores (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  report_id   TEXT,
  source      TEXT NOT NULL,                   -- 'HUMAN'|'JUDGE'|'IMPLICIT'
  verdict     TEXT NOT NULL,                   -- 'soddisfatto'|'gap'|'merge'|'discard'|…
  weight      REAL NOT NULL,                   -- HUMAN 1.0 · IMPLICIT 0.25
  detail      TEXT,                            -- JSON: criteri/gap
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_run_idx ON scores (run_id);

-- alerts — SYSTEM tab (Track D) + toast parse-failure/watchdog + allarme eval + StuckDetector.
-- Freezata QUI (consumer già in v0.6). channel='budget' scritto anche dal parse-failure L.
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,                   -- 'budget'|'watchdog'|'parse'|'eval'|'stuck'
  severity    TEXT NOT NULL,                   -- 'info'|'warn'|'error'
  run_id      TEXT,                            -- nullable (alert di processo)
  message     TEXT NOT NULL,
  detail      TEXT,                            -- JSON
  created_at  TEXT NOT NULL,
  ack_at      TEXT
);
CREATE INDEX IF NOT EXISTS alerts_channel_idx ON alerts (channel, created_at);

-- usage_blocks — MATERIALIZZATA (non VIEW: benchmark 19s/tick). Ledger duale block(5h)+weekly.
-- Skeleton pinnato QUI; riempita al mini-freeze v0.7-L.
CREATE TABLE IF NOT EXISTS usage_blocks (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL,
  window_kind   TEXT NOT NULL,                 -- 'block_5h'|'weekly'
  started_at    TEXT NOT NULL,
  ends_at       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL    NOT NULL DEFAULT 0,
  paused_until  TEXT,                          -- breaker per-canale (budgetGate)
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_blocks_win_idx ON usage_blocks (channel, window_kind, started_at);

-- daemon_sessions — dedup sessioni ccusage/JSONL (una riga per sessione).
CREATE TABLE IF NOT EXISTS daemon_sessions (
  session_id   TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  meta         TEXT
);

-- config_versions — audit trail routing/budget/soglie (v0.7-L/R → v0.9-B). Skeleton QUI,
-- freeze dei valori al mini-freeze v0.7.
CREATE TABLE IF NOT EXISTS config_versions (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,                   -- 'routing'|'budget'|'threshold'
  value       TEXT NOT NULL,                   -- JSON snapshot
  author      TEXT,                            -- 'human'|'system'
  created_at  TEXT NOT NULL
);

-- radar_findings — dep-major/semver notify-only (v0.9-Ra). Skeleton freeza al landing di Ra.
CREATE TABLE IF NOT EXISTS radar_findings (
  id          TEXT PRIMARY KEY,
  project_id  TEXT,
  kind        TEXT NOT NULL,                   -- 'dep_major'|'semver'
  title       TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'new',     -- 'new'|'filed'|'dismissed'
  created_at  TEXT NOT NULL
);

-- ── Tipi TS delle righe (congelati con lo schema) ────────────────────────────
-- export type RunPhase = 'queued'|'interpreting'|'needs_clarification'|'fixing'
--   |'verifying'|'review'|'paused'|'approved'|'discarded'|'aborted'|'error';
-- export interface RunRow { id:string; report_id:string; project_id:string|null;
--   phase:RunPhase; branch:string|null; session_id:string|null; data:string;
--   created_at:string; updated_at:string }
-- export interface EventRow { id:number; run_id:string; name:EventName;
--   phase_from:RunPhase|null; phase_to:RunPhase|null; payload:string|null; ts:string }
-- export interface ObservationRow { id:string; run_id:string; parent_id:string|null;
--   span_kind:'llm'|'tool'|'gate'|'phase'|'repair'|'plan'; name:string; stage:string|null;
--   sym:string|null; model:string|null; status:'ok'|'error'|'running'|null;
--   input_tokens:number|null; output_tokens:number|null; cost_usd:number|null;
--   started_at:string; ended_at:string|null; ms:number|null }
-- export interface ObservationBodyRow { observation_id:string; body:string }
-- export interface ScoreRow { id:string; run_id:string; report_id:string|null;
--   source:'HUMAN'|'JUDGE'|'IMPLICIT'; verdict:string; weight:number;
--   detail:string|null; created_at:string }
-- export interface AlertRow { id:string; channel:'budget'|'watchdog'|'parse'|'eval'|'stuck';
--   severity:'info'|'warn'|'error'; run_id:string|null; message:string;
--   detail:string|null; created_at:string; ack_at:string|null }
-- export interface UsageBlockRow { id:string; channel:string;
--   window_kind:'block_5h'|'weekly'; started_at:string; ends_at:string;
--   input_tokens:number; output_tokens:number; cost_usd:number;
--   paused_until:string|null; updated_at:string }
-- export interface DaemonSessionRow { session_id:string; started_at:string;
--   last_seen_at:string; meta:string|null }
-- export interface ConfigVersionRow { id:string; scope:'routing'|'budget'|'threshold';
--   value:string; author:string|null; created_at:string }
-- export interface RadarFindingRow { id:string; project_id:string|null; kind:string;
--   title:string; detail:string|null; status:'new'|'filed'|'dismissed'; created_at:string }

-- ── Set nomi eventi (congelato) ──────────────────────────────────────────────
-- export const EVENT_NAMES = ['run.created','run.transition','obs.started',
--   'obs.ended','score.recorded','alert.raised'] as const;
-- export type EventName = typeof EVENT_NAMES[number];
--   • run.created    → nascita run (phase_to = 'queued')
--   • run.transition → UPDATE runs.phase + INSERT events, STESSA transact()
--   • obs.started / obs.ended → INSERT observation poi INSERT event, poi emit (INSERT-before-emit)
--   • score.recorded → verdetto scritto (HUMAN/JUDGE/IMPLICIT)
--   • alert.raised   → riga alerts (budget/watchdog/parse/eval/stuck)
-- ── Freeze split: alerts + skeleton usage_blocks/daemon_sessions/config_versions/runs
--    freezano in v0.6 W0; VALORI usage_blocks/daemon_sessions/config_versions al mini-freeze
--    v0.7; radar_findings al landing di v0.9-Ra. Le FK pinnano perché ogni tabella referenziata
--    freeza nella stessa wave o prima (ordine schema→writer→reader già garantito).
-- ── firma breaker (freezata col mini-freeze v0.7): budgetGate(channel) -> { ok, pausedUntil }
```
