<img src="resources/branding/schema-forge-logo.png" alt="Schema Forge" width="220">

# Schema Forge — manuale d'uso

Agente Web Gun per lo **schema dati** dei progetti generati (Postgres/Supabase). È il primo agente costruttore della pipeline: Gestionale Crafter e AI Specialist costruiscono sopra ciò che decide qui — **Fly UI no, perché non esiste** (`DECISIONI.md` §21).

**Stato:** v1.5 — collaudata su database reale e nel comportamento. **144 test** sugli script, gate a **9 passi**, ESLint 0 errori 0 warning, `knip` pulito. `jscpd` riporta **2 cloni**, entrambi dichiarati (§7).

> **Non ancora usabile su un progetto cliente**, ma il gate ha smesso di mentire. Il collaudo indipendente del 2026-07-26 aveva riprodotto **16 difetti su 17** — cinque Critical — su uno schema che il gate dichiarava **VERDE 8/8** (i passi erano otto). Dal 2026-07-27 quello stesso schema chiude **ROSSO**: l'audit blocca l'auto-promozione via colonna, segnala la macchina a stati aggirabile in `insert`, e **pretende un test pgTAP che attacchi ogni policy di scrittura** — scritti quei test, due asserzioni su 23 falliscono, e sono esattamente i due Critical. Resta vero che l'audit guarda la **forma** delle policy: la semantica la dimostrano i test negativi, e quelli li scrive l'agente. Dettagli in `STATO.md`, verbali in `COLLAUDO-2026-07-25.md` e `COLLAUDO-2026-07-26.md`.

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
| **Supabase CLI ≥ 2.81.3** + Docker attivo | sì | il gate non può applicare le migrazioni: **rosso**, non "in attesa". Sotto la 2.81.3 il passo `db advisors` è **verifica mancante** |
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
| `forge` | scrive la migrazione: lookup → tabelle → vincoli → indici → trigger → RLS → policy → `grant`; copia `.sqlfluff` e `squawk.toml` nel progetto | no |
| `seed` | `supabase/seed.sql` idempotente e deterministico (UUID scritti a mano) | no |
| `test` | i test pgTAP **negativi**: per ogni tabella scrivibile, il tentativo che deve fallire | no |
| `verify` | **il gate**: 9 passi deterministici su database vero | — |
| `types` | rigenera `src/lib/database.types.ts` | no |
| `evolve` | modifica di uno schema esistente, in expand-contract, con analisi di impatto | **sì** su ogni distruttivo |
| `handoff` | scrive `docs/handoff/07-schema-forge.md` per l'agente successivo, **riga `Gate:` col verdetto compresa** | no |

## 4. Il flusso, in ordine

```
1 contesto      brief, docs/PROGETTO.md, handoff precedenti   ← senza brief non si parte
2 dominio       entità, attributi, relazioni, cicli di vita
3 proprietà     chi legge e chi scrive ogni tabella, in base a cosa
4 SPECCHIO      riformulazione in italiano + ERD  →  STOP, si aspetta il «sì»
5 forge         la migrazione, RLS e policy incluse alla nascita
6 seed
7 test          i pgTAP negativi: il gate li PRETENDE, non li suggerisce
8 types         PRIMA del gate, o il passo dei tipi è rosso per forza
9 handoff       PRIMA del gate, che ne verifica esistenza e verdetto dichiarato
10 VERIFY       ultimo passo. Finché è rosso, lo schema non esiste
```

L'ordine di 8-9-10 non è un dettaglio: un gate che nasce rosso per come è ordinato il flusso insegna a ignorare il rosso. Il passo 7 invece **deve** nascere rosso finché non lo si fa — è l'unica prova che le policy funzionano davvero.

## 5. Il gate — `verify`

```bash
node <skill>/scripts/verify.mjs            # dalla radice del progetto generato
node <skill>/scripts/verify.mjs --json     # per l'orchestratore
node <skill>/scripts/verify.mjs --skip-reset --db-url postgresql://...
```

Nove passi, tre stati: `pass` · `fail` · `skipped` (= **verifica mancante**, il gate resta rosso).

| # | `id` (`--json`) | Passo | Cosa becca |
|---|---|---|---|
| 1 | `sqlfluff` | `sqlfluff` | formato SQL — e i file che sqlfluff **salta** perché oltre i 20 000 byte: quelli sono `MANC`, non `OK` |
| 2 | `squawk` | `squawk` | lock, riscritture di tabella, distruttivi non dichiarati |
| 3 | `db-reset` | **`supabase db reset`** | il gate vero: le migrazioni applicate davvero, in ordine, più il seed |
| 4 | `db-lint` | `supabase db lint` | funzioni e plpgsql non validi |
| 5 | `db-advisors` | **`supabase db advisors`** | il linter mantenuto da Supabase: `auth_users_exposed`, `policy_exists_rls_disabled`, `multiple_permissive_policies`, `extension_in_public`, `rls_references_user_metadata` |
| 6 | `audit-rls` | **audit RLS** | tabelle nude, policy assenti o permissive, **policy mai attaccate da un test**, **colonne di privilegio scrivibili**, **macchine a stati senza vincolo su `insert`**, viste e funzioni pericolose, FK e colonne di policy senza indice |
| 7 | `pgtap` | **pgTAP** | le policy verificate impersonando i ruoli — si contano i **file**: una cartella vuota è `MANC`, non `OK` |
| 8 | `tipi` | tipi TypeScript | disallineamento fra schema e codice |
| 9 | `contratto-uscita` | contratto d'uscita | `.sqlfluff`, `squawk.toml`, handoff senza segnaposto **e con la riga `Gate:` che dichiara il verdetto vero** |

Uscita: `0` gate verde · `1` gate rosso · `2` errore di esecuzione.

La colonna `id` è il **contratto con l'orchestratore**: l'etichetta italiana può cambiare, l'`id` no. Forma completa del `--json` (con `contract`, `summary` e i `counts` per gravità) in `references/verifica-deterministica.md`.

Due cose che il gate **dichiara sempre**, perché un audit parziale non deve assomigliare a un audit completo:
- **quali schemi** ha auditato (`[api].schemas` del `config.toml`, non solo `public`, e anche quando l'array TOML è su più righe)
- **quale database** ha guardato (porta da `[db].port`, non la 54322 di default: con due stack Supabase accesi sarebbe il progetto di qualcun altro). Se la porta non è risolvibile il passo è `MANC`: non si audita alla cieca.

Solo `supabase db reset` ha **un** ritentativo dopo ~10 secondi, perché è saltuariamente instabile. Se riesce al secondo colpo il passo è `pass` ma il dettaglio scrive *«riuscito al secondo tentativo»*.

**`db advisors` fallisce il gate solo sui rilievi `ERROR`** (`--fail-on error`). Fra i `WARN` ci sono impostazioni di **Auth del progetto** (scadenza degli OTP, opzioni MFA) che nessuna migrazione può correggere: renderle rosse sarebbe un rosso strutturale, e un rosso strutturale insegna a ignorare il rosso. I `WARN` restano **scritti** nel dettaglio, che si stampa anche sui passi verdi.

## 6. Cosa becca l'audit RLS

Undici funzioni di regola esportate da `audit-lib.mjs`, **ventiquattro verdetti** distinti, tre gravità: `block` (ferma il gate) · `issue` · `warn`.

| Verdetto | Gravità |
|---|---|
| tabella in schema esposto **senza RLS attiva** | `block` |
| **policy di scrittura mai attaccate** da un test pgTAP: nessun test tenta `insert`/`update`/`delete` sulla tabella impersonando un ruolo | `block` |
| **colonna che decide gli accessi** scrivibile dal proprietario della riga (auto-promozione) | `block` |
| vista **materializzata** in schema esposto: Postgres rifiuta `security_invoker` su una MV | `block` |
| `update`/`all` con `using (true)` e **senza** `with check` — riga di un altro riscrivibile | `block` |
| `with check (true)` su una policy di scrittura | `block` |
| policy che legge `user_metadata` / `raw_user_meta_data` — **lo scrive l'utente** | `block` |
| policy che usa `auth.role()` — con gli accessi anonimi attivi non controlla niente | `block` |
| vista senza `security_invoker` | `block` |
| `security definer` senza `search_path` fissato | `block` |
| RLS attiva **senza nessuna policy** (nega tutto in silenzio) | `issue` |
| policy con `using (true)`: RLS attiva ma senza filtro | `issue` |
| `insert` senza `with check` — Postgres **nega ogni inserimento**: guasto muto, non buco | `issue` |
| `update`/`delete` senza policy di `select` per gli **stessi ruoli** — tocca 0 righe senza errore | `issue` |
| **macchina a stati vincolata solo in `update`** — la riga nasce già nello stato di arrivo | `issue` |
| **colonna dal nome di privilegio** scrivibile, che però nessuna policy usa (euristica dichiarata) | `issue` |
| `security definer` con `execute` a PUBLIC (il **default** di Postgres) | `issue` |
| chiave esterna senza indice | `issue` |
| **policy per un ruolo il cui privilegio corrispondente manca** — compreso il caso «`Dxtm`: nessun privilegio CRUD affatto» | `block` |
| RLS attiva ma **non forzata** (`force row level security`): `enable` non vale per il proprietario della tabella | `warn` |
| `auth.uid()` non avvolto in `(select …)` · join dentro la policy · policy senza ruolo esplicito · colonna di policy senza indice | `warn` |

Il caso che rende queste regole non banali: quando `with check` è **omesso** su `update`/`all`, Postgres **riusa `using`** come controllo sulla riga nuova. Quindi `for update using ((select auth.uid()) = user_id)` senza `with check` è **sicuro** — segnalarlo sarebbe un falso positivo sul codice corretto delle reference. È la composizione con `using (true)` a essere il buco, ed è quella che la regola guarda. Provato su Postgres reale, non dedotto.

## 7. Gli altri script

```bash
# solo l'audit di sicurezza, senza toccare il database
node <skill>/scripts/rls-audit.mjs [--db-url <url>] [--schemas public,shop] \
                                   [--tests supabase/tests] [--json]

# diagramma ER dallo schema REALE (non lo disegna l'LLM)
node <skill>/scripts/erd.mjs --out docs/schema/ERD.md [--schemas public]

# i test degli script (dalla cartella della skill)
npm test          # oppure: node --test "scripts/**/*.test.mjs"
```

Attenzione al default: lanciati **a mano**, `rls-audit.mjs` ed `erd.mjs` puntano alla porta 54322. Su un progetto con porta diversa passa `--db-url`. `rls-audit.mjs` ora **stampa sempre in testa** il database e gli schemi che ha guardato: è stato eseguito sul database sbagliato rispondendo «nessun bloccante», e quella riga è ciò che lo rende impossibile senza accorgersene. Senza `--tests` la regola dei test negativi **tace** — non assolve: dentro `verify` la cartella la passa il gate.

### Architettura degli script

| File | Ruolo |
|---|---|
| `verify.mjs` | il gate — una funzione per passo, `main()` è solo l'elenco delle chiamate |
| `rls-audit.mjs` · `erd.mjs` | **gusci**: solo I/O (psql, stampa) |
| `audit-lib.mjs` · `erd-lib.mjs` | **le regole**, funzioni pure senza I/O |
| `*.test.mjs` | 132 test, runner nativo, zero dipendenze |

Le regole stanno nelle lib per un motivo: tre bug (CRLF di psql, cast booleano `'true'`/`'t'`, parsing per riga che mandava in crash l'audit sulle policy con sottoquery) hanno tenuto spente delle regole senza che nulla lo segnalasse, perché non c'era modo di eseguirle senza un database. **Una regola nuova si aggiunge nella lib, col suo test.**

**I due cloni che `jscpd` riporta, e perché restano.** `righeDaPsql` è identica in `audit-lib.mjs` ed `erd-lib.mjs` (8 righe); la gestione dell'errore di `psql` è identica in `erd.mjs` e `rls-audit.mjs` (11 righe, cambia solo il messaggio). Estrarle in un terzo modulo accoppierebbe due librerie tenute indipendenti apposta, per otto righe: la duplicazione è una **decisione**, non una svista. `jscpd` esce comunque `0` — non c'è soglia configurata — quindi non ferma niente: è scritto qui perché uno strumento che segnala qualcosa non deve essere raccontato come «pulito».

## 8. Cosa consegna

```
supabase/migrations/*.sql          applicabili in ordine su DB pulito
supabase/seed.sql                  idempotente e deterministico
supabase/tests/*.sql               test pgTAP delle policy
src/lib/database.types.ts          tipi rigenerati — è ciò che consuma Fly UI
.sqlfluff · squawk.toml            configurazioni del gate, copiate da `forge`
docs/handoff/07-schema-forge.md    modello, decisioni, accessi, residui, verdetto del gate
docs/schema/ERD.md                 diagramma generato dallo schema reale
docs/export/*.csv                  dati esportati prima di un distruttivo autorizzato
```

## 9. Casi che si incontrano davvero

**Un `drop column` autorizzato tiene il gate rosso.** `squawk` non legge le motivazioni in prosa e le migrazioni sono immutabili. Si dichiara l'eccezione nel file:

```sql
-- Distruttivo AUTORIZZATO: checkpoint umano del <data>,
-- dati esportati in docs/export/<file>.csv.
-- squawk-ignore ban-drop-column
alter table public.orders drop column notes;
```

Il commento `squawk-ignore` sta **da solo sulla sua riga** — la motivazione va sopra, non accanto: squawk leggerebbe il resto della riga come altri nomi di regola. Si scrive **prima** di applicare la migrazione, e solo dopo l'autorizzazione umana.

**Il passo dei tipi resta rosso senza motivo (Windows).** I tipi vanno generati da **Git Bash**, non con la redirezione di PowerShell: `supabase gen types … > file.ts` in PowerShell scrive UTF-16 con CRLF e il confronto byte a byte fallisce sempre.

**`psql` non si trova.** Su questa macchina sta in `%USERPROFILE%\scoop\apps\postgresql\current\bin` — va aggiunto al PATH, altrimenti audit e diagramma risultano `MANCANTI` e il gate è rosso.

**`db advisors` risulta `MANC` con la CLI installata.** Il sottocomando esiste dalla **v2.81.3**: `supabase --version` e aggiorna. Il passo non diventa mai `fail` per questo — una CLI vecchia non dice niente sullo schema.

**`node --test scripts/` non trova i test.** Su Node ≥ 24 il percorso è trattato come glob: usa `node --test "scripts/**/*.test.mjs"`.

## 10. Quello che il gate NON verifica

Scritto qui perché un gate verde non deve essere letto come «schema sicuro»:

- **Che il test negativo sia *severo*.** Dal 2026-07-27 il gate **pretende** che ogni tabella con policy di scrittura sia attaccata da un test pgTAP (`block` se non lo è). Ma verifica che il tentativo *esista*, non che sia quello giusto: un `insert` che il test si aspetta riesca copre la casella. La forma dell'asserzione non è controllata **apposta** — il test negativo corretto già scritto sul banco asserisce che la riga è *rimasta* nel suo stato (conteggio 1, non 0) e non usa `throws_ok`: pretendere una forma precisa avrebbe segnalato come mancante un test corretto.
- **Le colonne di privilegio, oltre il nome.** La regola riconosce `role`, `ruolo`, `is_admin`, `job_title`, `permessi`… — è un'**euristica sul nome**, dichiarata nel messaggio. Una colonna `livello` che decide dei permessi non la vede nessuno.
- **Le macchine a stati con più stati iniziali.** La regola riconosce come difesa un `check` che vieta almeno uno degli stati nominati dal trigger. Una macchina i cui vincoli stanno tutti dentro una funzione applicativa resta invisibile.
- **Storage.** `storage` non è in `[api].schemas` e l'audit non lo guarda: l'upsert che richiede INSERT + SELECT + UPDATE è documentato in `references/rls-supabase.md`, non verificato.
- **Chiavi API, `NEXT_PUBLIC_`, lockfile.** Territorio di `code-maniac` e `gitleaks`, non dello schema.

## 11. Documenti della skill

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
