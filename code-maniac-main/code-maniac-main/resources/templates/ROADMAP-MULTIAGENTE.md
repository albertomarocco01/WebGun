# Roadmap Multiagentica — {{NOME_PROGETTO}}

> Generato da Code Maniac `init` · {{DATA}}. **Derivata dalla commessa confermata** (`PROGETTO.md`) via classificazione del problema. Una fase = un obiettivo verificabile e gated.
> **Metodo completo (classificazione, topologie, spec agenti, DAG, re-plan):** `references/orchestrazione-agenti.md`.

## Classificazione del problema  → decide la FORMA della roadmap

<!-- Compila dai segnali oggettivi (scan, grafo, PROGETTO.md). La classe determina fasi, topologia e agenti: NON improvvisare, applica la tabella di orchestrazione-agenti.md §2. -->

- **Natura:** {{GREENFIELD|BROWNFIELD}}
- **Intento:** {{FEATURE|REFACTOR|MIGRATION|BUGFIX|SECURITY|PERF|INCIDENT|DOCS|SPIKE}}
- **Accoppiamento/Rischio:** {{BASSO|MEDIO|ALTO}}  (moduli toccati · auth/dati? · hotspot complessità · reversibilità)
- **Parallelizzabilità:** {{ALTA|BASSA}}
- → **Forma:** {{FORMA}} · **Topologia:** {{TOPOLOGIA}} · **Ricerca web:** {{SI|NO}}

## DAG delle fasi  → cosa va in parallelo, cosa in sequenza

```
{{DAG_ASCII}}
```
<!-- es. F0 → F1 → (F2a ∥ F2b) → CK1(conferma utente) → F3.  Rami ∥ senza file condivisi = spawn in UN solo messaggio. -->
**Critical path:** {{CRITICAL_PATH}}

## Principi (sempre)

- **Default = un agente lineare.** Multi-agente solo se la fase è parallelizzabile E read-only/disgiunta (orchestrazione-agenti.md §1). Mai scrittori paralleli.
- **Parallelo dentro un frontier, sequenziale tra frontier:** spawni solo il frontier corrente, aspetti tutti i completamenti, applichi il gate, poi il successivo.
- **Modello per fase = tier di complessità** (`scan` §3.5); sicurezza/dati sensibili → sempre Opus.
- Niente fase prima della commessa confermata (Specchio, regola n°0).

## Fasi

### Fase 0 — Baseline  {{STATO_F0}}
- [ ] Scansione muta + grafo costruito
- [ ] `scan` di partenza (incl. hotspot complessità) → `DEBITO-TECNICO.md`
- [ ] Commessa confermata (`PROGETTO.md`)

<!--
SCHEMA DI FASE — schema unico (questo template è la fonte; il metodo lo referenzia).
FASE NON PRONTA se (basta uno): l'obiettivo non è 1 frase verificabile · la definizione-di-fatto
non è un predicato testabile · `dipende-da` non elenca nodi esistenti · il gate non nomina il
comando concreto. Non spawnare finché tutti e 4 passano.
`tipo: checkpoint` = nodo a zero-spawn (conferma utente / deploy / merge), esente dal gate-spawn.
-->

### Fase N — {{VERBO+OGGETTO}}
- **Tipo:** {{fase|checkpoint}}
- **Obiettivo** (1, verificabile): {{OBIETTIVO}}
- **Dipende da:** {{[Fase X, …]}}   <!-- vuoto = radice = parallelizzabile -->
- **Input:** {{ARTEFATTI_IN}} · **Output:** {{ARTEFATTO_OUT}}
- **Agenti** (archetipi da §6, con spec): {{ARCHETIPO [modello] [tool] → [output contratto]}}
- **Modello:** {{TIER}}  <!-- dal segnale di complessità, routing-modelli.md -->
- **Ricerca web:** {{SI→Ricercatore-tech | NO, stack fissato}}
- **Definizione di fatto** (predicato testabile): {{FATTO}}
- **Gate:** `scan({{check rilevanti}})` PASS + review({{verdetto}})
- **Rischi & rollback:** {{failure mode}} → {{pre-merge: scarta branch | post-merge: nodo compensativo}}
- [ ] …

<!-- Aggiungi fasi secondo la classe del problema. Una fase = 1 spawn + 1 gate + 1 deliverable spedibile.
     Se serve >1 gate → spezza; se due fasi condividono il gate → fondi; fasi > deliverable → fondi. -->

## Re-plan (se un gate dà FAIL-struttura)

<!-- Non cancellare le fasi superate: BARRALE e appendi qui sotto una sezione di re-plan, così l'audit trail resta. Riconferma la commessa solo se lo scope è cambiato (Specchio). -->

{{RE_PLAN}}
<!-- es.  ## Re-plan 1 — 2026-07-01 — causa: F2 ha scoperto un accoppiamento non previsto (gate FAIL-struttura) -->
