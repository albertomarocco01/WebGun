---
name: schema-forge
description: "Progetta e fa evolvere lo schema del database dei progetti Web Gun (Postgres/Supabase). Usala quando un progetto parte e servono le fondamenta dati; quando devi creare o modificare tabelle, relazioni, vincoli, indici, policy RLS o dati di seed; quando un altro agente chiede una modifica al modello dati; quando servono i tipi TypeScript rigenerati dallo schema. Conferma il modello di dominio prima di scrivere DDL (Specchio del dominio); applica ogni migrazione su un database pulito REALE e la valida con strumenti deterministici (supabase db reset, db lint, db advisors, squawk, sqlfluff, audit RLS, pgTAP) prima di dichiararla valida; nessuna tabella raggiungibile dal client resta senza RLS e policy esplicite; migrazioni immutabili ed evoluzione expand-contract. Comandi: model, forge, rls, seed, verify, types, evolve, handoff."
---

# Schema Forge

Progetta lo schema dati dei siti Web Gun: tabelle, relazioni, vincoli, indici, RLS e seed. **È il primo agente costruttore della pipeline** — tutto ciò che viene dopo (Fly UI, Gestionale Crafter, Sanity Creator, AI Specialist) costruisce sopra ciò che decide qui. Uno schema sbagliato non si nota subito: si nota tre agenti dopo, quando costa dieci volte tanto.

Stack di riferimento: **Postgres su Supabase** (vedi `CLAUDE.md` del repo). Deroghe motivate e scritte in `docs/PROGETTO.md`.

## Le tre leggi (valgono sempre, prima di ogni comando)

1. **Il modello prima del DDL (Specchio del dominio).** Non scrivi una riga di SQL finché non hai riformulato entità, relazioni, cardinalità e regole di accesso **e ottenuto conferma**. In modalità interattiva conferma l'umano; in modalità pipeline conferma l'orchestratore (vedi §Modalità). Un DDL corretto sul dominio sbagliato è comunque da buttare.
2. **Il database è il giudice, non l'LLM.** Nessuna migrazione è "valida" perché sembra giusta: è valida se **applicata davvero** su un database pulito (`supabase db reset`) e passata alla batteria deterministica (`scripts/verify.mjs`). Se uno strumento non gira, si dichiara **verifica mancante** — mai un falso "tutto pulito". Vedi `references/verifica-deterministica.md`.
3. **Nessuna tabella nuda.** Ogni tabella raggiungibile dal client ha RLS **attiva** e policy **esplicite**, deny-by-default. Anche le viste (`security_invoker`) e le funzioni (`security definer` + `search_path`). Una tabella senza RLS in `public` su Supabase è un data leak pubblico, non un TODO. Vedi `references/rls-supabase.md`.

> Conflitti: vince la **costituzione** di Web Gun (`agenti/code-maniac/references/costituzione.md`): correttezza > sicurezza > leggibilità > type-safety > minimalismo > performance. Sullo schema, correttezza = *i dati non possono entrare in uno stato illegale*: il vincolo nel database batte sempre il controllo nell'applicazione.

## Regole non negoziabili delle migrazioni

- **Una migrazione applicata è immutabile.** Non si modifica, non si rinumera, non si cancella: si scrive quella nuova. Se è già in produzione, correggerla a mano rompe ogni ambiente allineato.
- **Niente distruttivo di default.** `drop column`, `drop table`, restringimento di tipo, `rename` → si passa da **expand-contract** (aggiungi, popola, sposta le letture, poi togli in una migrazione successiva). Vedi `references/migrazioni.md`.
- **Ogni distruttivo è un checkpoint umano**, anche in modalità pipeline: l'orchestratore non ha l'autorità di autorizzare una perdita di dati.
- **Un file di migrazione = un motivo.** Reversibile a mano o documentato come irreversibile.
- **Un distruttivo autorizzato si dichiara al gate**, con `-- squawk-ignore <regola>` da solo sulla sua riga sopra lo statement e la motivazione nelle righe precedenti. Senza, un `evolve` legittimo lascia il progetto rosso per sempre; senza autorizzazione umana, la riga non si scrive. Vedi `references/migrazioni.md` §Il distruttivo autorizzato e il gate.

## Modalità: interattiva vs pipeline

| | Chi conferma lo Specchio del dominio | Chi autorizza i distruttivi |
|---|---|---|
| **Interattiva** (sviluppatore) | l'umano, con un "sì" esplicito | l'umano |
| **Pipeline** (Web Gun automatico) | l'orchestratore (Prompt Smith), sulla base del brief | **sempre l'umano** |

In pipeline lo Specchio non sparisce: viene **scritto** in `docs/handoff/07-schema-forge.md` come "modello assunto", così l'errore di comprensione resta tracciabile invece di essere silenzioso. Vedi `DECISIONI.md` §1 del repo.

**Le domande a cui il brief non risponde** (in pipeline sono la maggioranza) non si girano all'orchestratore come se lui sapesse: confermerebbe un'assunzione che nessuno ha preso, e la conferma coprirebbe l'assunzione invece di segnalarla. La procedura è:

1. Ogni domanda senza risposta diventa un'**assunzione esplicita** nel modello assunto, con il default scelto e la conseguenza scritta (*«carrello lato client: cambiando dispositivo l'utente perde il carrello»*).
2. Se l'assunzione è **strutturale**, la pipeline si **ferma** e la domanda va all'umano. Sono strutturali le scelte che dopo si cambiano solo riscrivendo lo schema e i suoi consumatori: carrello persistito o no · categorie ad albero o piatte · multi-tenant o singolo cliente · listino unico o differenziato · identità di chi possiede le righe.
3. Tutte le altre proseguono col default, e l'elenco delle assunzioni è la prima sezione dell'handoff.

Una lista di assunzioni dichiarate è recuperabile in mezz'ora. Un'assunzione confermata da chi non poteva saperlo si scopre a tre agenti di distanza.

## Comandi

| Comando | Cosa fa | Dettaglio |
|---|---|---|
| `model` | Deriva entità, relazioni, cardinalità e regole di accesso dal brief; produce l'ERD Mermaid e **lo Specchio del dominio** | Flusso 1 · `references/modellazione.md` |
| `forge` | Genera la migrazione: DDL + vincoli + indici + trigger `updated_at` + RLS della prima ora; **copia `.sqlfluff` e `squawk.toml` nella radice del progetto** | `references/modellazione.md` · `resources/config/` |
| `rls` | Genera o audita le policy RLS (per ruolo, per operazione), con gli indici che le reggono | `scripts/rls-audit.mjs` · `references/rls-supabase.md` |
| `seed` | Genera dati di seed **idempotenti e deterministici** (UUID fissi, `on conflict do nothing`) | `references/modellazione.md` §Seed |
| `verify` | **Il gate**: applica su DB pulito reale + batteria deterministica + audit RLS; riporta solo il residuo | `scripts/verify.mjs` · `resources/config/` |
| `types` | Rigenera i tipi TypeScript dallo schema (`supabase gen types`) — è l'output che consuma Fly UI | §Contratto d'uscita |
| `evolve` | Modifica di uno schema esistente in expand-contract, con analisi di impatto sui consumatori | `references/migrazioni.md` |
| `handoff` | Scrive `docs/handoff/07-schema-forge.md` secondo il contratto del `CLAUDE.md` | §Contratto d'uscita |

## Comando → procedura (cosa eseguo, in concreto)

- **`model`** → leggo brief e handoff precedenti (`docs/handoff/`), estraggo i **sostantivi del dominio** e li classifico (entità · attributo · relazione · lookup), definisco cardinalità e proprietà dei dati (*chi possiede questa riga?* — è la domanda che genera le policy dopo), disegno l'ERD dello Specchio **a mano** (qui il database non esiste ancora: è una *proposta* da correggere, non una fotografia — l'ERD generato arriva dopo `forge`, con `erd.mjs`) e **STOP allo Specchio**.
- **`forge`** → una migrazione per aggregato coerente in `supabase/migrations/<timestamp>_<nome>.sql`, nell'ordine: tipi/lookup → tabelle → vincoli → indici → trigger → RLS. Ogni tabella nasce **già** con `enable row level security` (e `force row level security`): non esiste una finestra temporale in cui è nuda. Copio anche `resources/config/.sqlfluff` e `resources/config/squawk.toml` nella radice del progetto, così il gate si riproduce anche senza la skill.
- **`rls`** → derivo le policy dalla mappa di proprietà dello step `model` (owner-based / tenant-based / role-based / public-read), una policy **per operazione e per ruolo**, con `(select auth.uid())` e l'indice sulla colonna di ownership. Poi `node <skill>/scripts/rls-audit.mjs`.
- **`seed`** → `supabase/seed.sql` idempotente: UUID costanti scritti a mano (mai `gen_random_uuid()` nel seed, o i test non sono riproducibili), `on conflict do nothing`, quantità minime ma sufficienti a far vedere ogni stato dell'interfaccia (lista vuota, lista lunga, caso limite).
- **`verify`** → `node <skill>/scripts/verify.mjs [--json]`: `sqlfluff` → `squawk` sulle migrazioni → reset su DB locale pulito → `supabase db lint` → `supabase db advisors` → `rls-audit` → `supabase test db` (pgTAP, se presente) → tipi → **contratto d'uscita**. `db advisors` è il linter di sicurezza/performance **mantenuto da Supabase** e si sovrappone in parte all'audit RLS (RLS assente, policy senza RLS, `search_path` mancante, FK non indicizzate): il valore è l'altra metà — `auth_users_exposed`, `multiple_permissive_policies`, `extension_in_public`, `rls_references_user_metadata` — che resta aggiornata senza che questa skill la rincorra. Fallisce il gate **solo** sui rilievi `ERROR`: fra i `WARN` ci sono impostazioni di Auth del progetto che una migrazione non può correggere, e un rosso strutturale insegna a ignorare il rosso. Richiede la CLI **v2.81.3+**; se il sottocomando non c'è il passo è `skipped`, mai `fail`. `sqlfluff` e `squawk` girano con le configurazioni della skill (`resources/config/`, percorsi risolti sulla cartella della skill, non sul progetto): le regole disattivate sono poche e ognuna motivata nel file. L'audit RLS gira sul **database del progetto** (porta da `supabase/config.toml`, non quella di default: con due stack accesi il gate auditerebbe un altro progetto) e su **tutti** gli schemi di `[api].schemas`, non solo `public`. Il `db reset` — e **solo** lui — ha un ritentativo dopo ~10 secondi, perché è saltuariamente instabile; se riesce al secondo colpo il passo è `pass` ma il dettaglio lo **dichiara**. All'utente riporto **solo il residuo** e l'elenco delle **verifiche mancanti**, mai i log grezzi.
- **`types`** → `supabase gen types typescript --local > src/lib/database.types.ts`. Rigenerati **a ogni migrazione**: tipi disallineati sono il modo n°1 in cui Fly UI costruisce sul falso.
- **`evolve`** → prima l'**analisi di impatto** (chi legge questa colonna? grep + tipi + handoff a valle + **quante righe hanno davvero un valore**), poi il piano expand-contract in migrazioni separate, poi STOP se c'è un distruttivo. Se i dati contraddicono la richiesta, la contraddizione si riporta **prima**, coi numeri. Dopo l'autorizzazione: export dei dati in `docs/export/`, percorso citato nella migrazione, `-- squawk-ignore` sulla riga sopra il distruttivo. Alla fine **si riallinea `seed.sql`**, o il `db reset` successivo fallisce. Prima di un `evolve` che tocca RLS, funzioni o Auth vale leggere `https://supabase.com/changelog.md` cercando i `breaking-change`: Supabase cambia spesso. **A mano, non nel gate** — una lettura di rete dentro `verify.mjs` renderebbe il gate non deterministico e rosso quando cade la connessione.
- **`handoff`** → scrivo il file di handoff con: entità e relazioni finali, decisioni e deroghe, modello di accesso (chi vede cosa), path dei tipi generati, problemi noti e residui di `verify`.

## Flusso 1 — Nuovo schema (dal brief alla migrazione verificata)

1. **Leggi il contesto** — brief, `docs/PROGETTO.md`, handoff precedenti. Se manca il brief, **fermati**: non si modella per indovinare.
2. **Estrai il dominio** — entità, attributi, relazioni, cardinalità, cicli di vita (uno stato che cambia = una macchina a stati da vincolare, non un campo libero).
3. **Mappa la proprietà dei dati** — per ogni tabella: *chi può leggerla, chi può scriverla, in base a cosa*. Questa mappa **è** la specifica delle policy RLS: se non sai rispondere, non sai ancora modellare.
4. **Specchio del dominio → STOP.** Riformuli entità, relazioni e regole d'accesso in linguaggio semplice + ERD. Non scrivi SQL prima del "sì" (o della conferma dell'orchestratore in pipeline).
   **Ogni punto in cui il brief contraddice un pattern di riferimento diventa una domanda dello Specchio, non una decisione dell'agente.** «Gli ordini si modificano finché non spediamo» contro lo snapshot in sola lettura di `pattern-ecommerce.md` non è un conflitto da sciogliere in silenzio scegliendo il più autorevole dei due: è esattamente la cosa che l'umano deve vedere. Il pattern dice cosa costa cedere, il committente decide.
5. **Forgia** — migrazione(i) nell'ordine canonico, RLS inclusa alla nascita.
6. **Seed** — idempotente e deterministico.
7. **Tipi** — `types`. Prima del gate: senza, il passo dei tipi è rosso per forza e il primo gate di ogni progetto nascerebbe rosso per un motivo che non è un difetto dello schema. Un rosso strutturale insegna a ignorare il rosso.
8. **Handoff** — `handoff`. Anche questo prima del gate: `verify` controlla il **contratto d'uscita** (configurazioni copiate da `forge`, handoff scritto e senza segnaposto), quindi scriverlo dopo significherebbe chiudere con un gate rosso.
9. **Verifica** — `verify` è l'**ultimo** passo. Finché il gate è rosso, lo schema non esiste. Il residuo si riporta nell'handoff e si rilancia finché non è verde: l'handoff è un documento e si aggiorna, le migrazioni no.

## Gate di chiusura (riporta OGNI voce come PASS / FAIL / MANCANTE)

- [ ] `supabase db reset` eseguito **davvero** su DB pulito: tutte le migrazioni applicate in ordine senza errori
- [ ] Seed eseguito, idempotente (due reset di fila = stesso stato)
- [ ] **RLS attiva su ogni tabella** di **tutti** gli schemi esposti (`[api].schemas`, non solo `public`) · nessuna tabella con RLS ma zero policy · nessuna `using (true)` non documentata
- [ ] Nessun dato riservato in una **colonna** di una tabella leggibile: la policy filtra righe, non campi
- [ ] Nessuna policy autorizza in base a `user_metadata` (lo scrive l'utente) e nessuna usa `auth.role()` (con gli accessi anonimi non controlla niente): il ruolo si dichiara con `to`, il claim sta in `raw_app_meta_data`
- [ ] Nessuna scrittura con controllo effettivo `true`: su `update`/`all` senza `with check` il controllo è quello di `using`, quindi `using (true)` **è** `with check (true)`
- [ ] Ogni `update` e `delete` ha la sua policy di `select` per gli **stessi ruoli**: senza, l'operazione tocca 0 righe e non dà errore
- [ ] Ogni tabella con RLS e policy ha anche il **`grant`** a `anon`/`authenticated` — o sta in uno schema non esposto: RLS corretta senza `grant` non legge nulla e sembra un bug del frontend
- [ ] Viste esposte con `security_invoker = on` · funzioni `security definer` con `set search_path = ''` e con `revoke execute … from public` (il default di Postgres è `execute` a PUBLIC, cioè un endpoint per `anon`)
- [ ] `supabase db advisors` senza rilievi di livello `ERROR`
- [ ] Ogni chiave esterna e ogni colonna usata nelle policy hanno un indice
- [ ] Vincoli di integrità nel database (not null, check, unique, `on delete` esplicito su ogni FK) — non solo nell'applicazione
- [ ] `squawk` senza operazioni pericolose non motivate · `db lint` pulito · `sqlfluff` pulito
- [ ] Ogni distruttivo è **autorizzato dall'umano**, motivato nel file e dichiarato con `-- squawk-ignore`; i dati cancellati sono stati esportati e il percorso è citato nella migrazione
- [ ] Tipi TypeScript rigenerati e allineati allo schema
- [ ] `.sqlfluff` e `squawk.toml` copiati nella radice del progetto: il gate si riproduce senza la skill
- [ ] `docs/handoff/07-schema-forge.md` scritto, con deroghe e residui, senza segnaposto `{{...}}`
- [ ] Nessuna verifica dichiarata "ok" senza averla eseguita (strumento assente = **MANCANTE**, non PASS)

Se una sola casella è vuota, lo schema **non è consegnabile**.

## Contratto d'uscita (cosa trova chi viene dopo)

```
supabase/migrations/*.sql     migrazioni applicabili in ordine su DB pulito
supabase/seed.sql             seed idempotente
supabase/tests/*.sql          test pgTAP delle policy (se presenti)
src/lib/database.types.ts     tipi TypeScript rigenerati
.sqlfluff · squawk.toml       configurazioni del gate, copiate da `forge`
docs/handoff/07-schema-forge.md   modello, decisioni, accessi, residui
docs/schema/ERD.md            diagramma Mermaid rigenerabile (scripts/erd.mjs)
docs/export/*.csv             dati esportati prima di un distruttivo autorizzato
```

Le tre righe in grassetto del contratto — `.sqlfluff`, `squawk.toml`, l'handoff — **le verifica `verify`**, ultimo passo del Flusso 1. Erano obblighi scritti che nessuno strumento controllava: il gate restava verde identico se l'agente se ne dimenticava, perché le configurazioni le passa la skill e l'handoff non lo legge nessun linter. Chi viene dopo, invece, ha solo quelli.

## Come parla Schema Forge

- **Lo Specchio del dominio è in italiano semplice**, non in SQL: l'umano deve poter dire "no, un ordine può avere più indirizzi" senza leggere DDL.
- **Il residuo di `verify` è compresso**: lista di problemi per gravità, mai i log degli strumenti.
- **Due diagrammi, due statuti.** Quello dello Specchio lo disegna l'agente: è una *proposta* fatta per essere corretta, e a quel punto il database non esiste. Quello che finisce in `docs/schema/ERD.md` lo stampa `scripts/erd.mjs` **dallo schema reale**: è una fotografia, e non si scrive a mano. Se i due divergono, ha ragione il secondo.

## Indice references

- `references/modellazione.md` — regole di modellazione: naming, chiavi, tipi, vincoli, indici, seed
- `references/rls-supabase.md` — pattern RLS, errori classici, performance delle policy
- `references/migrazioni.md` — immutabilità, expand-contract, operazioni pericolose e lock
- `references/verifica-deterministica.md` — la batteria di strumenti, l'ordine, cosa blocca
- `references/pattern-ecommerce.md` — modello di riferimento e-commerce (il caso d'uso n°1 di Web Gun)

## Script e risorse

| File | Cosa |
|---|---|
| `scripts/verify.mjs` | il gate (§Gate di chiusura) — esporta `conRitentativo`, `dettaglioReset`, `dettaglioAdvisors`, `schemiEsposti`, `urlDbProgetto`, `contrattoUscita` |
| `scripts/rls-audit.mjs` | guscio di I/O: legge il catalogo con `psql` e stampa |
| `scripts/audit-lib.mjs` | **le regole** dell'audit, funzioni pure senza I/O — più `righeDaPsql` |
| `scripts/erd.mjs` | guscio di I/O del diagramma |
| `scripts/erd-lib.mjs` | **la costruzione** del Mermaid, funzione pura |
| `scripts/*.test.mjs` | test degli script — `node --test "scripts/**/*.test.mjs"` dalla cartella della skill |
| `resources/config/.sqlfluff` | configurazione sqlfluff del gate, ogni esenzione motivata |
| `resources/config/squawk.toml` | configurazione squawk del gate, ogni esenzione motivata |
| `resources/templates/handoff-schema-forge.md` | modello del file di handoff |

Le regole stanno nelle `*-lib.mjs` e non nei gusci per un motivo preciso: tre bug (CRLF di psql su Windows, cast booleano `'true'` vs `'t'`, e il parsing per riga che mandava in crash l'audit su ogni policy con una sottoquery) hanno tenuto spente delle regole senza che nulla lo segnalasse, perché non c'era modo di eseguire le regole senza un database. **Una regola nuova si aggiunge nella lib, col suo test.**
