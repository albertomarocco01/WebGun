<img src="resources/branding/schema-forge-logo.png" alt="Schema Forge" width="220">

# Schema Forge — manuale d'uso

Agente Web Gun per lo **schema dati** dei progetti generati (Postgres/Supabase). È il primo agente costruttore della pipeline: Fly UI, Gestionale Crafter, Sanity Creator e AI Specialist costruiscono tutti sopra ciò che decide qui.

**Stato:** v1.3 — collaudata su database reale e nel comportamento, 66 test sugli script, gate a 8 passi. **Non ancora usabile su un progetto cliente:** il collaudo indipendente del 2026-07-26 ha trovato 16 difetti riprodotti su uno schema che il gate dichiara verde — il gate verifica che la RLS *esista*, non che *funzioni*. Dettagli in `STATO.md`, verbali in `COLLAUDO-2026-07-25.md` e `COLLAUDO-2026-07-26.md`.

---

## 1. Installazione

La skill vive in `agenti/schema-forge/` di questo repo (fonte di verità) ed è esposta a Claude Code tramite una junction:

```powershell
# dalla radice del repo Web Gun, PowerShell da amministratore
New-Item -ItemType Junction -Path ".claude\skills\schema-forge" `
         -Target (Resolve-Path "agenti\schema-forge").Path
```

Per usarla in un **altro** progetto, copia la cartella in `~/.claude/skills/schema-forge` oppure in `.claude/skills/schema-forge` del progetto.

Verifica: in Claude Code deve comparire fra le skill disponibili e rispondere a `/schema-forge`.

## 2. Prerequisiti

| Strumento | Obbligatorio | Se manca |
|---|---|---|
| **Supabase CLI** + Docker attivo | sì | il gate non può applicare le migrazioni: **rosso**, non "in attesa" |
| **psql** | sì | audit RLS e diagramma non girano: **verifica mancante** |
| **sqlfluff** (`pipx install sqlfluff`) | consigliato | passo formato SQL `MANCANTE` |
| **squawk** (`pipx install squawk-cli`) | consigliato | passo operazioni pericolose `MANCANTE` |
| **Node ≥ 20** | sì | gli script sono ESM nativi, zero dipendenze runtime |

Regola non negoziabile: **strumento assente = verifica mancante, mai un `pass`**. Un gate rosso per verifiche mancanti resta rosso.

```bash
supabase --version && psql --version && sqlfluff --version && squawk --version
```

## 3. I comandi dell'agente

Si invocano in conversazione (`/schema-forge`, poi il comando).

| Comando | Cosa fa | Si ferma? |
|---|---|---|
| `model` | estrae entità, relazioni, cardinalità e **chi possiede ogni riga**; produce lo **Specchio del dominio** | **sì — STOP**, non scrive SQL prima del «sì» |
| `forge` | scrive la migrazione: lookup → tabelle → vincoli → indici → trigger → RLS; copia `.sqlfluff` e `squawk.toml` nel progetto | no |
| `rls` | genera o audita le policy, una per operazione e per ruolo, con gli indici che le reggono | no |
| `seed` | `supabase/seed.sql` idempotente e deterministico (UUID scritti a mano) | no |
| `verify` | **il gate**: 8 passi deterministici su database vero | — |
| `types` | rigenera `src/lib/database.types.ts` | no |
| `evolve` | modifica di uno schema esistente, in expand-contract, con analisi di impatto | **sì** su ogni distruttivo |
| `handoff` | scrive `docs/handoff/07-schema-forge.md` per l'agente successivo | no |

## 4. Il flusso, in ordine

```
1 contesto      brief, docs/PROGETTO.md, handoff precedenti   ← senza brief non si parte
2 dominio       entità, attributi, relazioni, cicli di vita
3 proprietà     chi legge e chi scrive ogni tabella, in base a cosa
4 SPECCHIO      riformulazione in italiano + ERD  →  STOP, si aspetta il «sì»
5 forge         la migrazione, RLS inclusa alla nascita
6 seed
7 types         PRIMA del gate, o il passo dei tipi è rosso per forza
8 handoff       PRIMA del gate, che ne verifica l'esistenza
9 VERIFY        ultimo passo. Finché è rosso, lo schema non esiste
```

L'ordine di 7-8-9 non è un dettaglio: un gate che nasce rosso per come è ordinato il flusso insegna a ignorare il rosso.

## 5. Il gate — `verify`

```bash
node <skill>/scripts/verify.mjs            # dalla radice del progetto generato
node <skill>/scripts/verify.mjs --json     # per l'orchestratore
node <skill>/scripts/verify.mjs --skip-reset --db-url postgresql://...
```

Otto passi, tre stati: `pass` · `fail` · `skipped` (= **verifica mancante**, il gate resta rosso).

| # | Passo | Cosa becca |
|---|---|---|
| 1 | `sqlfluff` | formato SQL |
| 2 | `squawk` | lock, riscritture di tabella, distruttivi non dichiarati |
| 3 | **`supabase db reset`** | il gate vero: le migrazioni applicate davvero, in ordine, più il seed |
| 4 | `supabase db lint` | funzioni e plpgsql non validi |
| 5 | **audit RLS** | tabelle nude, policy assenti o permissive, viste e funzioni pericolose, FK e colonne di policy senza indice |
| 6 | **pgTAP** | le policy verificate impersonando i ruoli |
| 7 | tipi TypeScript | disallineamento fra schema e codice |
| 8 | contratto d'uscita | `.sqlfluff`, `squawk.toml`, handoff scritto senza segnaposto |

Uscita: `0` gate verde · `1` gate rosso · `2` errore di esecuzione.

Due cose che il gate **dichiara sempre**, perché un audit parziale non deve assomigliare a un audit completo:
- **quali schemi** ha auditato (`[api].schemas` del `config.toml`, non solo `public`)
- **quale database** ha guardato (porta da `[db].port`, non la 54322 di default: con due stack Supabase accesi sarebbe il progetto di qualcun altro)

Solo `supabase db reset` ha **un** ritentativo dopo ~10 secondi, perché è saltuariamente instabile. Se riesce al secondo colpo il passo è `pass` ma il dettaglio scrive *«riuscito al secondo tentativo»*.

## 6. Gli altri script

```bash
# solo l'audit di sicurezza, senza toccare il database
node <skill>/scripts/rls-audit.mjs [--db-url <url>] [--schemas public,shop] [--json]

# diagramma ER dallo schema REALE (non lo disegna l'LLM)
node <skill>/scripts/erd.mjs --out docs/schema/ERD.md [--schemas public]

# i test degli script (dalla cartella della skill)
npm test          # oppure: node --test "scripts/**/*.test.mjs"
```

Attenzione al default: lanciati **a mano**, `rls-audit.mjs` ed `erd.mjs` puntano alla porta 54322. Su un progetto con porta diversa passa `--db-url`.

### Architettura degli script

| File | Ruolo |
|---|---|
| `verify.mjs` | il gate |
| `rls-audit.mjs` · `erd.mjs` | **gusci**: solo I/O (psql, stampa) |
| `audit-lib.mjs` · `erd-lib.mjs` | **le regole**, funzioni pure senza I/O |
| `*.test.mjs` | 66 test, runner nativo, zero dipendenze |

Le regole stanno nelle lib per un motivo: tre bug (CRLF di psql, cast booleano `'true'`/`'t'`, parsing per riga che mandava in crash l'audit sulle policy con sottoquery) hanno tenuto spente delle regole senza che nulla lo segnalasse, perché non c'era modo di eseguirle senza un database. **Una regola nuova si aggiunge nella lib, col suo test.**

## 7. Cosa consegna

```
supabase/migrations/*.sql          applicabili in ordine su DB pulito
supabase/seed.sql                  idempotente e deterministico
supabase/tests/*.sql               test pgTAP delle policy
src/lib/database.types.ts          tipi rigenerati — è ciò che consuma Fly UI
.sqlfluff · squawk.toml            configurazioni del gate, copiate da `forge`
docs/handoff/07-schema-forge.md    modello, decisioni, accessi, residui
docs/schema/ERD.md                 diagramma generato dallo schema reale
docs/export/*.csv                  dati esportati prima di un distruttivo autorizzato
```

## 8. Casi che si incontrano davvero

**Un `drop column` autorizzato tiene il gate rosso.** `squawk` non legge le motivazioni in prosa e le migrazioni sono immutabili. Si dichiara l'eccezione nel file:

```sql
-- Distruttivo AUTORIZZATO: checkpoint umano del <data>,
-- dati esportati in docs/export/<file>.csv.
-- squawk-ignore ban-drop-column
alter table public.orders drop column notes;
```

Il commento `squawk-ignore` sta **da solo sulla sua riga** — la motivazione va sopra, non accanto: squawk leggerebbe il resto della riga come altri nomi di regola. Si scrive **prima** di applicare la migrazione, e solo dopo l'autorizzazione umana.

**Il passo dei tipi resta rosso senza motivo (Windows).** I tipi vanno generati da **Git Bash**, non con la redirezione di PowerShell: `supabase gen types … > file.ts` in PowerShell scrive UTF-16 con CRLF e il confronto byte a byte fallisce sempre.

**`psql` non si trova.** Su questa macchina sta in `%USERPROFILE%\scoop\apps\postgresql\current\bin` — va aggiunto al PATH, altrimenti audit e diagramma risultano `MANCANTI`.

**`node --test scripts/` non trova i test.** Su Node ≥ 24 il percorso è trattato come glob: usa `node --test "scripts/**/*.test.mjs"`.

## 9. Documenti della skill

| File | Cosa c'è dentro |
|---|---|
| `SKILL.md` | le tre leggi, i comandi, il flusso, il gate di chiusura |
| `COME-PROVARLA.md` | **come vederla lavorare**: comandi eseguiti, banco di prova, caso d'uso VetCare Nord, cosa un gate verde non dimostra |
| `references/modellazione.md` | naming, chiavi, tipi, vincoli, indici, seed |
| `references/rls-supabase.md` | pattern RLS, errori classici, performance, **la RLS è per riga non per colonna** |
| `references/migrazioni.md` | immutabilità, expand-contract, distruttivo autorizzato e gate |
| `references/verifica-deterministica.md` | la batteria, l'ordine, cosa blocca |
| `references/pattern-ecommerce.md` | modello di riferimento e-commerce, listini, ordini |
| `STATO.md` | stato, collaudi, decisioni prese, cosa resta aperto |
| `COLLAUDO-2026-07-25.md` | verbale del collaudo del comportamento |
| `COLLAUDO-2026-07-26.md` | verbale del collaudo indipendente: dominio non e-commerce, attacchi agli script, `/code-inquisition` |
