# La verifica deterministica

Legge n°2: **il database è il giudice**. Uno schema "sembra corretto" solo finché non lo applichi. La batteria gira dal più economico al più costoso e si ferma al primo passo che richiede giudizio.

## La pipeline

| # | `id` | Passo | Strumento | Esito |
|---|---|---|---|---|
| 1 | `sqlfluff` | Sintassi e formato SQL | **sqlfluff** (`--dialect postgres`) | auto-fix quasi totale, 0 giudizio |
| 2 | `squawk` | Sicurezza della migrazione | **squawk** | operazioni pericolose, lock, riscritture di tabella |
| 3 | `db-reset` | **Applicazione reale su DB pulito** | `supabase db reset` | il gate vero: migrazioni in ordine + seed |
| 4 | `db-lint` | Lint del database | `supabase db lint` | funzioni e plpgsql non validi |
| 5 | `db-advisors` | Advisor di sicurezza | `supabase db advisors` (CLI v2.81.3+) | il linter **mantenuto da Supabase**: `auth_users_exposed`, `extension_in_public`, `multiple_permissive_policies`, `rls_references_user_metadata`… Fallisce solo sui rilievi `ERROR` |
| 6 | `audit-rls` | **Audit RLS** | `scripts/rls-audit.mjs` | tabelle nude, policy assenti o permissive, scritture col controllo effettivo `true`, `user_metadata` e `auth.role()` nelle policy, scritture senza lettura, **policy che promettono un accesso che il privilegio non concede**, **policy di scrittura mai attaccate da un test**, **colonne di privilegio scrivibili**, **macchine a stati senza vincolo su `insert`**, viste e funzioni pericolose (incluso `execute` a PUBLIC), FK e policy senza indice |
| 7 | `pgtap` | Test delle policy | **pgTAP** (`supabase test db`) | le regole d'accesso verificate impersonando i ruoli |
| 8 | `tipi` | Tipi | `supabase gen types typescript --local` | disallineamento tra schema e codice |
| 9 | `contratto-uscita` | Contratto d'uscita | `scripts/verify.mjs` | `.sqlfluff` e `squawk.toml` copiati, handoff scritto e senza segnaposto |

I passi 5 e 6 si **sovrappongono in parte** (RLS assente, policy senza RLS attiva, `search_path` mancante, FK non indicizzate): la ridondanza è voluta. Metà delle regole di `db advisors` non sta in Schema Forge, e la mantiene Supabase.

`node <skill>/scripts/verify.mjs` esegue tutta la sequenza e restituisce **solo il residuo**.

### Tre modi in cui il gate poteva essere verde senza aver guardato

Chiusi il 2026-07-27, tutti e tre riprodotti prima di essere corretti. Sono qui perché la forma del guasto si ripete: **uno strumento che non ha letto niente esce 0**.

- **sqlfluff salta i file oltre `large_file_skip_byte_limit`** (default 20 000 byte) ed esce comunque 0 — misurato: uno statement invalido dentro un file da 26 023 byte dà «All Finished!» e uscita 0, con l'avviso su **stdout**, che il gate scartava. Il passo misura i byte di ogni migrazione **prima** di lanciare lo strumento: un file che sqlfluff non leggerà non può produrre `pass`. Rimedio: spezzare la migrazione (un file = un motivo), oppure alzare il limite nel `.sqlfluff` motivandolo.
- **`supabase test db` su `supabase/tests/` vuota esce 0** (`Result: NOTESTS`): cartella assente → `skipped`, cartella vuota → `pass`. Cancellare i test rendeva il gate più verde di tenerli. Si contano i file `.sql`, non si guarda se la cartella esiste.
- **Senza `[db].port` nel `config.toml`** l'audit RLS ripiegava sulla porta 54322 — su una macchina con due stack Supabase accesi, il database di un altro progetto — e la riga «quale database» spariva proprio lì. Ora il passo è `skipped`: senza un database risolvibile l'audit non può dire di aver auditato il progetto.

### Il contratto `--json`

`verify.mjs --json` è ciò che legge l'orchestratore. La forma è stabile e versionata:

```json
{
  "contract": 1,
  "ok": false,
  "summary": { "passi": 9, "pass": 7, "fail": 1, "skipped": 1 },
  "steps": [
    { "id": "sqlfluff", "name": "sqlfluff (formato SQL)", "status": "pass", "detail": "" },
    { "id": "audit-rls", "name": "audit RLS", "status": "fail",
      "detail": "schemi esposti: public · postgresql://…",
      "counts": { "block": 2, "issue": 5, "warn": 3 } }
  ]
}
```

- **`id`** — identificatore stabile del passo, uno dei nove della tabella qui sopra, sempre in quest'ordine. **È l'unica cosa su cui un consumatore deve agganciarsi.** `name` è l'etichetta per gli umani ed è libera di cambiare: prima era l'unico identificatore, e riscriverla avrebbe rotto in silenzio chi leggeva il JSON.
- **`status`** — `pass` · `fail` · `skipped`. `skipped` è una **verifica mancante**: il gate resta rosso.
- **`counts`** — presente solo sui passi che producono findings per gravità (oggi solo `audit-rls`). Chi vuole i findings uno per uno chiama `rls-audit.mjs --json`, che riporta anche `dbUrl` e `schemas`.
- **`ok`** — vero se e solo se `summary.fail === 0 && summary.skipped === 0`.
- **`contract`** — si alza quando un campo viene **tolto o rinominato**. Aggiungere un campo non lo alza: un consumatore che ignora i campi che non conosce non si rompe.

Uscita del processo: `0` gate verde · `1` gate rosso · `2` errore di esecuzione (nessuna migrazione da verificare). Su `2` non c'è JSON.

## Regola anti-simulazione (non negoziabile)

Uno strumento assente non è un passo superato. `verify` classifica ogni passo in tre stati:

- `pass` — eseguito, nessun problema
- `fail` — eseguito, problemi trovati (elencati per gravità)
- `skipped` — **non eseguito** (strumento mancante, Docker spento, nessuna migrazione)

Nel report finale gli `skipped` compaiono come **verifiche mancanti**, non come successi. Uno schema con tre `skipped` non ha passato il gate: ha semplicemente evitato tre domande. Se `supabase db reset` non gira (Docker non avviato), il gate è **rosso**, non "in attesa".

## Gravità

| Grado | Significato | Esempi |
|---|---|---|
| `block` | non si consegna | tabella esposta senza RLS · vista senza `security_invoker` · **vista materializzata** in schema esposto · `security definer` senza `search_path` · policy che autorizza da `user_metadata` · `auth.role()` in una policy · `update`/`all` con `using (true)` e senza `with check` · **colonna che decide gli accessi scrivibile dal proprietario della riga** · **policy di scrittura mai attaccata da un test pgTAP** · **policy per un ruolo il cui privilegio corrispondente manca** (compreso il caso «nessun privilegio CRUD affatto») · migrazione che non si applica · perdita dati non autorizzata |
| `issue` | si consegna solo se documentato nell'handoff | RLS attiva senza policy · FK senza indice · `on delete` implicito · `using (true)` su dati utente · `insert` senza `with check` · `update`/`delete` senza policy di `select` · `security definer` eseguibile da PUBLIC · **macchina a stati vincolata solo in `update`** · **colonna dal nome di privilegio** che nessuna policy usa |
| `warn` | si stampa, non blocca | `auth.uid()` non avvolto in `select` · indice mancante su colonna di ordinamento · naming fuori convenzione |

## Prerequisiti

```bash
# obbligatori
supabase --version          # Supabase CLI (richiede Docker attivo per il DB locale)
psql --version              # client Postgres, usato dagli script di audit

# consigliati (senza, i passi relativi risultano "skipped")
pipx install sqlfluff
pipx install squawk-cli     # oppure: npm i -g squawk-cli
```

Il database locale di default degli script lanciati **a mano** è `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; si sovrascrive con `--db-url` (o con `SUPABASE_DB_URL`, che però non conviene impostare). Dentro `verify.mjs` quel default **non esiste**: l'URL viene da `[db].port` del `config.toml` del progetto, e se non è risolvibile il passo è una verifica mancante.

Su Windows, se la CLI Supabase è stata installata da npm si ottiene uno shim `.cmd`. `spawnSync` senza shell non lo esegue (ENOENT sul nome, EINVAL sul percorso pieno: mitigazione della CVE-2024-27980), quindi il gate lo risolve con `where` e lo lancia via `cmd.exe /c <percorso>` — **non** con `shell: true`, che concatenerebbe gli argomenti invece di passarli come vettore, e questo gate passa percorsi con spazi.

## Cosa riportare all'umano

Mai i log grezzi. Il formato è:

```
GATE SCHEMA: ROSSO (2 block, 3 issue, 1 verifica mancante)

BLOCK
- public.orders: RLS non attiva (tabella esposta via PostgREST)
- public.v_report: vista senza security_invoker = on

ISSUE
- public.order_items.product_id: chiave esterna senza indice
...

VERIFICHE MANCANTI
- squawk non installato: sicurezza delle migrazioni non verificata
```
