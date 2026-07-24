# Routing dei Modelli (3-tier nativo)

Usa il modello giusto per il lavoro giusto. Implementato **nativamente** col parametro `model` del tool Agent — nessuna dipendenza da RuFlo.

| Tier | Chi | Quando | Come |
|---|---|---|---|
| **1 — Deterministico** | tool / WASM, 0 token | trasformazioni meccaniche, lint-fix, formattazione, codemod | `scan` / `ast-grep` / `ts-morph` (vedi `motore-deterministico.md`) |
| **2 — Sonnet** *(default)* | modello standard | il lavoro normale di sviluppo: feature, fix, refactor guidati | `Agent(model: "sonnet")` |
| **3 — Opus** | modello forte | architettura, sicurezza, decisioni di design, ragionamento complesso | `Agent(model: "opus")` |

## Perché (quasi) niente Haiku

I modelli piccoli sono più fragili su ragionamento multi-step, edge case e vincoli sottili. In una skill dove la **regola n°1 è la correttezza**, un errore da rifare costa più dei token risparmiati. Inoltre il grosso del risparmio **non era mai** Haiku-vs-Sonnet, ma il *non leggere file interi* (graphify) e il *far girare i tool deterministici*. Quindi: **Sonnet come pavimento per ogni output di cui ci si fida**, Opus per il difficile.

**L'unica eccezione: Haiku come Esploratore read-only.** Ammesso *solo* per il retrieval (allowlist enforced, niente Edit/Write): il suo output è informazione **non fidata**, sempre ri-giudicata da un consumer Sonnet+. Mai come output finale, mai con capacità di scrittura. Così l'Explore nativo (Haiku) è ok per mappare il codice a basso costo, senza contraddire la regola sopra.

## Come classificare la complessità (misurata, non a sensazione)

Il tier si decide da segnali oggettivi. I primi sono **qualitativi** (la natura del task), ma il segnale forte è **misurato** da `scan` (vedi `motore-deterministico.md` §3.5):

- **Tier 1** se: il task è un transform noto (var→const, add type, rename, organize imports), o un fix puramente da tool.
- **Tier 2 (Sonnet)** se: tocca pochi file, logica circoscritta, requisiti chiari, nessuna implicazione di sicurezza/architettura.
- **Tier 3 (Opus)** se: tocca molti file o confini di modulo, riguarda sicurezza/auth/dati sensibili, richiede una scelta architetturale o un trade-off non ovvio.

### Il segnale di complessità guida il tier (il ponte)

`scan --json` espone `results[].complexity.{counts,hotspots}`. Mappalo direttamente:

| Verdetto complessità | Azione di routing |
|---|---|
| tutto `pass`/`warn` | **Tier 2 (Sonnet)** — flusso normale |
| un `issue` (cognitive 15-25 / CCN>10…) in un file toccato dal task | **Tier 3 (Opus)** per l'edit di *quel* file: complessità alta = ragionamento non ovvio |
| un `block` (cognitive>25) | **Fase di refactor dedicata, subagent isolato Opus**, *prima* della feature: riceve la **sola funzione hotspot** (slice dal grafo, non il file intero), la scompone, poi si procede |
| la top hotspot (complessità×churn) interseca i file del task | **Specchio + Opus obbligatori** — stai toccando il codice più rischioso del repo, mai lasciar indovinare un modello debole |

> Questo rende vera, per la prima volta, la promessa "segnali oggettivi, non a sensazione": l'escalation scatta sul **numero**, non su una ri-lettura del file.

> **La tabella non si applica più a mano: `scan` la emette.** `scan --json` restituisce `routing.{tier,dedicatedRefactor,mirror,securityReview,reason}` calcolato da `scan-lib.recommendRouting` (coperto da test). È "deterministico prima dell'LLM" applicato **alla decisione di routing stessa**: l'agente legge il `tier` suggerito invece di riderivarlo (0 token di reasoning, scelta riproducibile). In `--staged`/`--since` la valutazione è ristretta ai file del task (un `block` fuori dai file toccati non forza Opus); senza scope è repo-wide. Resta un *suggerimento*: il gate di escalation qui sotto può sempre alzarlo, mai abbassarlo sotto il livello emesso.

> **Il routing copre entrambi gli assi, non solo la complessità.** Oltre al ponte complessità→tier, `recommendRouting` incrocia il **segnale di sicurezza** (`securitySignal`): se un file del task matcha un path sensibile (`auth·login·session·token·secret·password·oauth·jwt·crypto·payment·billing·webhook·.env`) **oppure** semgrep/gitleaks hanno flaggato, forza `tier: opus` + `securityReview: true` + `mirror: true` — la regola "sicurezza/dati sensibili → **sempre** Opus, anche se piccolo" (§Gate di escalation) diventa così **deterministica**, non un promemoria che l'LLM può dimenticare. L'override alza soltanto: un `block` di complessità resta a refactor dedicato, con in più la review di sicurezza.

### Il modello è UN campo dell'agente, non tutto

Il tier sceglie il *modello*; ma l'agente perfetto ha altri 8 campi (ruolo, tool allowlist, contratto di output, verifica, escalation…). Per lo spec completo, la libreria di archetipi e quanti agenti spawnare, vedi **`orchestrazione-agenti.md`**. Lì la stessa misura di complessità dimensiona **insieme** tier del modello e numero di agenti (effort-scaling: 1 / 2-4 / 10+).

## Gate di escalation (obbligatorio)

Il risparmio non deve **mai** erodere la correttezza. Quindi:

- Se un agente di tier inferiore è **incerto** o il task si rivela più complesso del previsto → **rilancia su Opus**, non tirare a indovinare.
- Lavoro che tocca sicurezza o dati sensibili → **sempre** tier 3, anche se sembra piccolo.

## Subagent e contesto isolato

Per esplorazioni pesanti, spawna **subagent** (es. l'agente `Explore`, read-only) così il loro contesto intermedio **non inquina il thread principale**: torna solo il risultato distillato, non i file grezzi. È un risparmio token strutturale, oltre che di modello.
