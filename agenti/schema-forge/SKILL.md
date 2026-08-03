---
name: schema-forge
description: "Progetta e fa evolvere lo schema del database dei progetti Web Gun (Postgres/Supabase). Usala quando un progetto parte e servono le fondamenta dati; quando devi creare o modificare tabelle, relazioni, vincoli, indici, policy RLS o dati di seed; quando un altro agente chiede una modifica al modello dati; quando servono i tipi TypeScript rigenerati dallo schema. Conferma il modello di dominio prima di scrivere DDL (Specchio del dominio); applica ogni migrazione su un database pulito REALE e la valida con strumenti deterministici (supabase db reset, db lint, db advisors, squawk, sqlfluff, audit RLS, pgTAP) prima di dichiararla valida; nessuna tabella raggiungibile dal client resta senza RLS, policy esplicite e test pgTAP che le attacchino; migrazioni immutabili ed evoluzione expand-contract. Comandi: model, forge, seed, test, verify, types, evolve, handoff."
---

# Schema Forge

Progetta lo schema dati dei siti Web Gun: tabelle, relazioni, vincoli, indici, RLS e seed. **È il primo agente costruttore della pipeline** — tutto ciò che viene dopo (Gestionale Crafter, Flow Sentinel, Speed Demon, AI Specialist) costruisce, testa o misura sopra ciò che decide qui. Uno schema sbagliato non si nota subito: si nota tre agenti dopo, quando costa dieci volte tanto.

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
2. Se l'assunzione è **strutturale**, la pipeline si **ferma** e la domanda va all'umano. Sono strutturali le scelte che dopo si cambiano solo riscrivendo lo schema e i suoi consumatori: carrello persistito o no · categorie ad albero o piatte · multi-tenant o singolo cliente · listino unico o differenziato · identità di chi possiede le righe · **il cliente ha per forza un account** o esiste anche senza (fuori dall'e-commerce è la maggioranza: chi telefona non si registra, e va fatturato lo stesso — `references/pattern-ecommerce.md` §Clienti) · eventi ricorrenti e scadenze: righe con uno stato d'invio o un lavoro schedulato.
3. Tutte le altre proseguono col default, e l'elenco delle assunzioni è la prima sezione dell'handoff.

Una lista di assunzioni dichiarate è recuperabile in mezz'ora. Un'assunzione confermata da chi non poteva saperlo si scopre a tre agenti di distanza.

## Comandi

| Comando | Cosa fa | Dettaglio |
|---|---|---|
| `model` | Deriva entità, relazioni, cardinalità e regole di accesso dal brief; produce l'ERD Mermaid e **lo Specchio del dominio** | Flusso 1 · `references/modellazione.md` |
| `forge` | Genera la migrazione: DDL + vincoli + indici + trigger `updated_at` + **RLS, policy e privilegi espliciti della prima ora**; **copia `.sqlfluff` e `squawk.toml` nella radice del progetto** | `references/modellazione.md` · `references/rls-supabase.md` · §I privilegi si scrivono · `resources/config/` |
| `seed` | Genera dati di seed **idempotenti e deterministici** (UUID fissi, `on conflict do nothing`) | `references/modellazione.md` §Seed |
| `test` | Scrive i **test pgTAP negativi** delle policy: per ogni tabella scrivibile, il tentativo che deve fallire | `references/rls-supabase.md` §Una policy senza test |
| `verify` | **Il gate**: applica su DB pulito reale + batteria deterministica + audit RLS; riporta solo il residuo | `scripts/verify.mjs` · `resources/config/` |
| `types` | Rigenera i tipi TypeScript dallo schema (`supabase gen types`) — è l'output che consuma Fly UI | §Contratto d'uscita |
| `evolve` | Modifica di uno schema esistente in expand-contract, con analisi di impatto sui consumatori | `references/migrazioni.md` |
| `handoff` | Scrive `docs/handoff/07-schema-forge.md` secondo il contratto del `CLAUDE.md` | §Contratto d'uscita |

## Comando → procedura (cosa eseguo, in concreto)

- **`model`** → leggo brief e handoff precedenti (`docs/handoff/`), estraggo i **sostantivi del dominio** e li classifico (entità · attributo · relazione · lookup), definisco cardinalità e proprietà dei dati (*chi possiede questa riga?* — è la domanda che genera le policy dopo), disegno l'ERD dello Specchio **a mano** (qui il database non esiste ancora: è una *proposta* da correggere, non una fotografia — l'ERD generato arriva dopo `forge`, con `erd.mjs`) e **STOP allo Specchio**.
- **`forge`** → una migrazione per aggregato coerente in `supabase/migrations/<timestamp>_<nome>.sql`, nell'ordine: tipi/lookup → tabelle → vincoli → indici → trigger → RLS → policy → **privilegi**. Ogni tabella nasce **già** con `enable row level security` (e `force row level security`): non esiste una finestra temporale in cui è nuda. Le policy le derivo dalla mappa di proprietà dello step `model` (owner-based / tenant-based / role-based / public-read), **una per operazione e per ruolo**, con `(select auth.uid())` e l'indice sulla colonna di ownership. Tre cose si scrivono **nella stessa migrazione** della policy, non dopo:
  - i **privilegi espliciti**, nella forma `revoke` → `grant`, per **tutti e tre** i ruoli (`anon`, `authenticated`, `service_role`). Vedi §I privilegi si scrivono, non si ereditano: è la regola, non un esempio;
  - il **vincolo sullo stato iniziale** di ogni macchina a stati (`check`, o lo stesso trigger anche `before insert`): un trigger di transizione su `update` non dice niente su `insert`;
  - il **test pgTAP negativo** in `supabase/tests/` (vedi `test`). Una policy senza il tentativo che deve fallire non è consegnabile, ed è un `block` del gate.

  Copio anche `resources/config/.sqlfluff` e `resources/config/squawk.toml` nella radice del progetto, così il gate si riproduce anche senza la skill.
- **`seed`** → `supabase/seed.sql` idempotente: UUID costanti scritti a mano (mai `gen_random_uuid()` nel seed, o i test non sono riproducibili), `on conflict do nothing`, quantità minime ma sufficienti a far vedere ogni stato dell'interfaccia (lista vuota, lista lunga, caso limite).
- **`test`** → `supabase/tests/*.sql`, pgTAP. Per **ogni** tabella con una policy di `insert`/`update`/`delete`/`all`: impersono il ruolo (`set local role` + `set local request.jwt.claims`), tento la scrittura che la policy deve impedire e **asserisco il rifiuto** — con `throws_ok` se il database solleva un'eccezione, oppure verificando che il dato **non è cambiato** (la RLS non dà errore: tocca zero righe). Un test che legge soltanto non prova niente sulle policy di scrittura, e il gate lo tratta come assente. Uno per ogni cosa che la policy deve impedire, non uno per tabella.
- **`verify`** → `node <skill>/scripts/verify.mjs [--json]`: `sqlfluff` → `squawk` sulle migrazioni → reset su DB locale pulito → `supabase db lint` → `supabase db advisors` → `rls-audit` → `supabase test db` (pgTAP) → tipi → **contratto d'uscita**. Tre passi non possono più risultare verdi per assenza di verifica: `sqlfluff` **salta** i file oltre 20 000 byte uscendo 0, quindi il gate misura i byte prima e dichiara `MANCANTE` i file che lo strumento non ha letto; `supabase test db` su una cartella `supabase/tests/` **vuota** esce 0, quindi si contano i file `.sql` e non si guarda se la cartella esiste; senza `[db].port` nel `config.toml` l'audit RLS ripiegherebbe sulla porta 54322 — che con due stack accesi è il database di un altro progetto — quindi il passo è `MANCANTE` invece di auditare alla cieca. `db advisors` è il linter di sicurezza/performance **mantenuto da Supabase** e si sovrappone in parte all'audit RLS (RLS assente, policy senza RLS, `search_path` mancante, FK non indicizzate): il valore è l'altra metà — `auth_users_exposed`, `multiple_permissive_policies`, `extension_in_public`, `rls_references_user_metadata` — che resta aggiornata senza che questa skill la rincorra. Fallisce il gate **solo** sui rilievi `ERROR`: fra i `WARN` ci sono impostazioni di Auth del progetto che una migrazione non può correggere, e un rosso strutturale insegna a ignorare il rosso. Richiede la CLI **v2.81.3+**; se il sottocomando non c'è il passo è `skipped`, mai `fail`. `sqlfluff` e `squawk` girano con le configurazioni della skill (`resources/config/`, percorsi risolti sulla cartella della skill, non sul progetto): le regole disattivate sono poche e ognuna motivata nel file. L'audit RLS gira sul **database del progetto** (porta da `supabase/config.toml`, non quella di default: con due stack accesi il gate auditerebbe un altro progetto) e su **tutti** gli schemi di `[api].schemas`, non solo `public` — anche quando l'array TOML è scritto su più righe. Legge anche `supabase/tests/`: una policy di scrittura che nessun test attacca è un `block`. Il `db reset` — e **solo** lui — ha un ritentativo dopo ~10 secondi, perché è saltuariamente instabile; se riesce al secondo colpo il passo è `pass` ma il dettaglio lo **dichiara**. All'utente riporto **solo il residuo** e l'elenco delle **verifiche mancanti**, mai i log grezzi.
- **`types`** → `supabase gen types typescript --local > src/lib/database.types.ts`. Rigenerati **a ogni migrazione**: tipi disallineati sono il modo n°1 in cui Fly UI costruisce sul falso.
- **`evolve`** → prima l'**analisi di impatto** (chi legge questa colonna? grep + tipi + handoff a valle + **quante righe hanno davvero un valore**), poi il piano expand-contract in migrazioni separate, poi STOP se c'è un distruttivo. Se i dati contraddicono la richiesta, la contraddizione si riporta **prima**, coi numeri. Dopo l'autorizzazione: export dei dati in `docs/export/`, percorso citato nella migrazione, `-- squawk-ignore` sulla riga sopra il distruttivo. Alla fine **si riallinea `seed.sql`**, o il `db reset` successivo fallisce. Prima di un `evolve` che tocca RLS, funzioni o Auth vale leggere `https://supabase.com/changelog.md` cercando i `breaking-change`: Supabase cambia spesso. **A mano, non nel gate** — una lettura di rete dentro `verify.mjs` renderebbe il gate non deterministico e rosso quando cade la connessione.
- **`handoff`** → scrivo il file di handoff con: entità e relazioni finali, decisioni e deroghe, modello di accesso (chi vede cosa), path dei tipi generati, problemi noti e residui di `verify`. **In fondo, una riga `Gate: VERDE` o `Gate: ROSSO`** con i conteggi: la verifica il gate stesso (passo `contratto-uscita`), e un handoff che dichiara un verdetto diverso da quello dell'esecuzione in corso fa fallire il passo. Se il gate è rosso l'handoff **si scrive lo stesso e dichiara rosso** — quello che non si può fare è consegnare a valle un verdetto che non è mai esistito.

## I privilegi si scrivono, non si ereditano

Su Postgres i sistemi di permessi sono **due**, in fila: il `grant` decide se il ruolo raggiunge la tabella, la policy decide quali righe. Passano entrambi o non passa niente. Su Supabase il primo dei due è stato a lungo invisibile, perché l'immagine lo concedeva d'ufficio — e in un mese è cambiato **due volte**, senza che nulla nello schema lo dicesse (`STATO.md`, `../../DECISIONI.md` §27):

| quando | cosa concedeva il default a `anon`/`authenticated`/`service_role` |
|---|---|
| CLI 2.95.4 | `arwdDxtm` — tutto, compreso `insert`/`update`/`delete` per `anon` |
| CLI 2.110.0 | `service_role` perde tutto; sopravvive solo chi una migrazione riconcede |
| CLI 2.111.0 | `Dxtm` — TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: **zero CRUD** |

> **Un privilegio che non hai scritto non è un privilegio che hai.** E non è nemmeno un privilegio che perdi con preavviso: lo schema resta identico, il gate resta verde, e il sito smette di leggere.

**Ogni schema forgiato emette una migrazione di privilegi espliciti**, nello stesso file delle policy che li accompagnano. La forma è `revoke` **poi** `grant`:

```sql
-- 1. si azzera: nessun privilegio ereditato sopravvive a questa riga
revoke all on public.staff from anon, authenticated, service_role;

-- 2. si scrive, ruolo per ruolo, cio' che il modello di accesso dichiara
grant select on public.staff to authenticated;
grant update (full_name, phone) on public.staff to authenticated;   -- per colonna
grant select, insert, update, delete on public.staff to service_role;
-- `anon` non compare: nel modello di accesso non ha questa tabella.
```

Cinque regole, ognuna con la misura che la giustifica (Postgres 17.6, CLI 2.111.0, 2026-08-03):

1. **Il `revoke` viene prima, sempre.** Non perché il default conceda troppo — quello cambia — ma perché è l'unica riga che rende il `grant` scritto l'**unica verità** sui privilegi di quella tabella, qualunque cosa ci fosse prima. Misurato: dopo un `grant update` di tabella intera, aggiungere `grant update (full_name)` **non restringe niente** (il permesso per colonna è additivo) e il veterinario si promuove direttore lo stesso. Con il `revoke` davanti, la stessa coppia di righe nega.
2. **Il `revoke` toglie anche ciò che la RLS non può filtrare.** `Dxtm` comprende **TRUNCATE**, e la RLS **non si applica a TRUNCATE**. Misurato su uno schema con `force row level security` su tutte le tabelle: `set role anon; truncate public.animals cascade` **riesce**, e porta via dieci tabelle. Dopo il `revoke`: `permission denied for table animals`. Nessun `grant` riconcede mai `truncate`, `references`, `trigger` o `maintain` a un ruolo del client.
3. **`service_role` è nell'elenco.** Scavalca la RLS (`bypassrls`), **non** i privilegi: senza le sue righe non legge niente, e se ne accorge solo chi usa quella chiave — cioè nessuno dei nove passi del gate. È già costato nove test rossi da fermo su un progetto che non era stato toccato (`STATO.md` §Il difetto più grave di tutti).
4. **Il privilegio ricalca le policy, ruolo per ruolo.** Una policy di `select` per `anon` senza il `select` ad `anon` è una funzione che non esiste; un `grant` senza la policy corrispondente è un cancello aperto su un cancello chiuso, che il giorno di una policy sbagliata diventa l'unica difesa mancante. Dove il modello di accesso dice «—», non si scrive una riga. Se il client non deve raggiungere una tabella affatto, la risposta giusta resta **spostarla in uno schema non esposto**. L'audit RLS confronta le due cose e produce un **`block`** (regola 7).
5. **Niente `alter default privileges`.** Sostituire il default implicito di Supabase con un default implicito nostro sposta la cosa invisibile, non la toglie. Ed è legata a **chi crea l'oggetto**: misurato sul banco, `pg_default_acl` conteneva **due righe in conflitto** per lo stesso schema (`supabase_admin` → `arwdDxtm`, `postgres` → `Dxtm`), e una tabella creata da un terzo ruolo nasceva con `relacl` **NULL** — zero privilegi. Il privilegio di una tabella si scrive nella migrazione di quella tabella, dove chi legge il file lo vede.

Il `revoke`/`grant` per colonna resta obbligatorio sulle **colonne di privilegio** (§Il caso peggiore di `references/rls-supabase.md`): la RLS filtra le righe, non i campi.

## Flusso 1 — Nuovo schema (dal brief alla migrazione verificata)

1. **Leggi il contesto** — brief, `docs/PROGETTO.md`, handoff precedenti. Se manca il brief, **fermati**: non si modella per indovinare.
2. **Estrai il dominio** — entità, attributi, relazioni, cardinalità, cicli di vita (uno stato che cambia = una macchina a stati da vincolare, non un campo libero).
3. **Mappa la proprietà dei dati** — per ogni tabella: *chi può leggerla, chi può scriverla, in base a cosa*. Questa mappa **è** la specifica delle policy RLS: se non sai rispondere, non sai ancora modellare.
4. **Specchio del dominio → STOP.** Riformuli entità, relazioni e regole d'accesso in linguaggio semplice + ERD. Non scrivi SQL prima del "sì" (o della conferma dell'orchestratore in pipeline).
   **Ogni punto in cui il brief contraddice un pattern di riferimento diventa una domanda dello Specchio, non una decisione dell'agente.** «Gli ordini si modificano finché non spediamo» contro lo snapshot in sola lettura di `pattern-ecommerce.md` non è un conflitto da sciogliere in silenzio scegliendo il più autorevole dei due: è esattamente la cosa che l'umano deve vedere. Il pattern dice cosa costa cedere, il committente decide.
5. **Forgia** — migrazione(i) nell'ordine canonico, RLS, policy, **privilegi espliciti** (`revoke` poi `grant`, per tutti e tre i ruoli — §I privilegi si scrivono, non si ereditano; per colonna dove c'è una colonna di privilegio) e vincoli sugli stati iniziali inclusi alla nascita.
6. **Seed** — idempotente e deterministico.
7. **Test negativi** — `test`. Per ogni tabella scrivibile, il tentativo che deve fallire. Si scrivono **qui**, non dopo il gate: il gate li pretende (`block`), e una policy senza il suo test è un'ipotesi che nessuno ha mai messo alla prova.
8. **Tipi** — `types`. Prima del gate: senza, il passo dei tipi è rosso per forza e il primo gate di ogni progetto nascerebbe rosso per un motivo che non è un difetto dello schema. Un rosso strutturale insegna a ignorare il rosso.
9. **Handoff** — `handoff`. Anche questo prima del gate: `verify` controlla il **contratto d'uscita** (configurazioni copiate da `forge`, handoff scritto e senza segnaposto), quindi scriverlo dopo significherebbe chiudere con un gate rosso.
10. **Verifica** — `verify` è l'**ultimo** passo. Finché il gate è rosso, lo schema non esiste. Il residuo si riporta nell'handoff e si rilancia finché non è verde: l'handoff è un documento e si aggiorna, le migrazioni no.

## Gate di chiusura (riporta OGNI voce come PASS / FAIL / MANCANTE)

- [ ] `supabase db reset` eseguito **davvero** su DB pulito: tutte le migrazioni applicate in ordine senza errori
- [ ] Seed eseguito, idempotente (due reset di fila = stesso stato)
- [ ] **RLS attiva su ogni tabella** di **tutti** gli schemi esposti (`[api].schemas`, non solo `public`) · nessuna tabella con RLS ma zero policy · nessuna `using (true)` non documentata
- [ ] Nessun dato riservato in una **colonna** di una tabella leggibile: la policy filtra righe, non campi
- [ ] Nessuna **colonna di privilegio** (`role`, `ruolo`, `is_admin`, `job_title`, `permessi`…) su una tabella che l'utente può aggiornare, se non protetta da `grant update (…)` **per colonna**, da un trigger o dallo spostamento in un'altra tabella: la policy autorizza la riga intera
- [ ] Ogni **macchina a stati** vincolata anche in `insert` (`check` sullo stato iniziale, o lo stesso trigger `before insert`): un trigger di transizione su `update` non impedisce di nascere già nello stato di arrivo
- [ ] **Ogni tabella con policy di scrittura ha un test pgTAP che la attacca**: impersonando un ruolo, il tentativo che deve fallire, e l'asserzione che è fallito. Senza, le policy sono un'ipotesi e il gate è rosso
- [ ] Nessuna policy autorizza in base a `user_metadata` (lo scrive l'utente) e nessuna usa `auth.role()` (con gli accessi anonimi non controlla niente): il ruolo si dichiara con `to`, il claim sta in `raw_app_meta_data`
- [ ] Nessuna scrittura con controllo effettivo `true`: su `update`/`all` senza `with check` il controllo è quello di `using`, quindi `using (true)` **è** `with check (true)`
- [ ] Ogni `update` e `delete` ha la sua policy di `select` per gli **stessi ruoli**: senza, l'operazione tocca 0 righe e non dà errore
- [ ] **Privilegi espliciti scritti in migrazione** (`revoke` poi `grant`) per `anon`, `authenticated` **e `service_role`**: nessuna tabella si appoggia ai default dell'immagine Supabase, che sono cambiati due volte in un mese. Per ogni policy, il privilegio corrispondente esiste per gli **stessi ruoli** — o sta in uno schema non esposto: RLS corretta senza `grant` non legge nulla e sembra un bug del frontend. Nessun ruolo del client conserva `truncate`/`references`/`trigger`/`maintain`: la RLS non li filtra
- [ ] Viste esposte con `security_invoker = on` · **nessuna vista materializzata** in uno schema esposto (Postgres rifiuta `security_invoker` su una MV: si legge coi diritti del proprietario) · funzioni `security definer` con `set search_path = ''` e con `revoke execute … from public` (il default di Postgres è `execute` a PUBLIC, cioè un endpoint per `anon`)
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

Tre righe del contratto — `.sqlfluff`, `squawk.toml`, l'handoff — **le verifica `verify`**, ultimo passo del Flusso 1. Erano obblighi scritti che nessuno strumento controllava: il gate restava verde identico se l'agente se ne dimenticava, perché le configurazioni le passa la skill e l'handoff non lo legge nessun linter. Chi viene dopo, invece, ha solo quelli.

Sull'handoff il controllo non si ferma all'esistenza: deve contenere una riga **`Gate: VERDE`** o **`Gate: ROSSO`** che coincide col verdetto degli otto passi precedenti. Esistere ed essere compilato non basta — sul banco veterinario un handoff fermo a due giorni prima, che dichiarava «1 issue, 1 warn» mentre il gate chiudeva rosso su due passi, passava `pass`. Il passo nato per far rispettare la Regola dei guardiani del `CLAUDE.md` era cieco esattamente su quella clausola.

Non lo verifica `verify`, e va detto: `docs/schema/ERD.md`, `docs/export/*.csv` e il seed. Il diagramma perché un progetto può legittimamente non averlo ancora rigenerato, gli export perché esistono solo dopo un distruttivo, il seed perché `db reset` lo esegue già (se fallisce, fallisce il passo `db-reset`). Su questi tre il gate verde non dice niente.

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
| `scripts/verify.mjs` | il gate (§Gate di chiusura) — esporta `ID`, `CONTRATTO_JSON`, `conRitentativo`, `dettaglioReset`, `dettaglioAdvisors`, `fileNonLintati`, `formaEseguibile`, `leggiAudit`, `limiteSqlfluff`, `normalizzaTipi`, `riepilogo`, `schemiEsposti`, `soloSql`, `urlDbProgetto`, `contrattoUscita`, `verdettoDa` |
| `scripts/rls-audit.mjs` | guscio di I/O: legge il catalogo con `psql` e i test da `supabase/tests/`, e stampa |
| `scripts/audit-lib.mjs` | **le regole** dell'audit, funzioni pure senza I/O — più `righeDaPsql` |
| `scripts/erd.mjs` | guscio di I/O del diagramma |
| `scripts/erd-lib.mjs` | **la costruzione** del Mermaid, funzione pura |
| `scripts/*.test.mjs` | test degli script — `node --test "scripts/**/*.test.mjs"` dalla cartella della skill |
| `resources/config/.sqlfluff` | configurazione sqlfluff del gate, ogni esenzione motivata |
| `resources/config/squawk.toml` | configurazione squawk del gate, ogni esenzione motivata |
| `resources/templates/handoff-schema-forge.md` | modello del file di handoff |

Le regole stanno nelle `*-lib.mjs` e non nei gusci per un motivo preciso: tre bug (CRLF di psql su Windows, cast booleano `'true'` vs `'t'`, e il parsing per riga che mandava in crash l'audit su ogni policy con una sottoquery) hanno tenuto spente delle regole senza che nulla lo segnalasse, perché non c'era modo di eseguire le regole senza un database. **Una regola nuova si aggiunge nella lib, col suo test.**
