# Come provare Schema Forge

Guida pratica: cosa fa l'agente, come vederlo lavorare su questa macchina, e un
caso d'uso completo dal brief al gate. Ogni comando qui sotto è stato **eseguito**
durante i collaudi del 25 e 26 luglio 2026 — non sono esempi ipotetici.

Riferimenti: `README.md` (manuale), `STATO.md` (cosa è aperto),
`COLLAUDO-2026-07-26.md` (il verbale che spiega perché un gate verde non basta).

---

## 1. Come funziona, in una pagina

### Le tre leggi

1. **Prima il modello, poi il DDL.** L'agente non scrive una riga di SQL finché
   non ha riformulato il dominio in italiano — lo **Specchio del dominio** — e
   non ha ricevuto un «sì» esplicito. È uno **STOP vero**, non una formalità.
2. **Il giudice è il database, non l'LLM.** Ogni migrazione viene applicata su un
   database pulito reale e passata sotto una batteria deterministica. Uno
   strumento assente vale **verifica mancante**, mai `pass`.
3. **Nessuna tabella nuda.** RLS attiva più policy esplicite su tutto ciò che il
   client può raggiungere, scritte **alla nascita** della tabella, non dopo.

### Gli otto comandi

| Comando | Cosa fa | Si ferma? |
|---|---|---|
| `model` | entità, relazioni, cardinalità, **chi possiede ogni riga** → Specchio | **sì, STOP** |
| `forge` | la migrazione: lookup → tabelle → vincoli → indici → trigger → RLS → policy → `grant` | no |
| `seed` | `supabase/seed.sql` idempotente e deterministico | no |
| `test` | i test pgTAP **negativi**: per ogni tabella scrivibile, il tentativo che deve fallire | no |
| `verify` | **il gate**, 9 passi su database vero | — |
| `types` | rigenera `src/lib/database.types.ts` | no |
| `evolve` | modifica di uno schema esistente, expand-contract | **sì** su ogni distruttivo |
| `handoff` | scrive `docs/handoff/07-schema-forge.md` | no |

> **Il comando `rls` non esiste più**, dal 2026-07-27. Nella forma prescritta da
> `SKILL.md`:62 auditava il database **di un altro progetto** (la porta 54322 di
> default) e rispondeva «nessun bloccante»; per il resto non aggiungeva niente a
> `forge`. Le policy si scrivono in `forge`, si attaccano in `test` e si
> verificano in `verify`. Vedi `DECISIONI.md` §14.

### L'ordine del flusso

```
1 contesto      brief, docs/PROGETTO.md, handoff precedenti
2 dominio       entità, attributi, relazioni, cicli di vita
3 proprietà     chi legge e chi scrive ogni tabella, in base a cosa
4 SPECCHIO      riformulazione + ERD  →  STOP, aspetta il «sì»
5 forge         la migrazione, RLS e policy incluse
6 seed
7 test          i pgTAP negativi: il gate li pretende (block), non li suggerisce
8 types         PRIMA del gate, o il passo dei tipi è rosso per forza
9 handoff       PRIMA del gate, che ne verifica l'esistenza
10 VERIFY       ultimo. Finché è rosso, lo schema non esiste
```

8-9-10 in quest'ordine non è pedanteria: un gate che nasce rosso per come è
ordinato il flusso insegna a ignorare il rosso. Il passo 7 invece **deve**
nascere rosso finché non lo si fa: è l'unica prova che le policy funzionano.

### Il gate — nove passi, tre stati

`pass` · `fail` · `skipped` (= **verifica mancante**, il gate resta rosso).

| # | Passo | Cosa becca |
|---|---|---|
| # | `id` (`--json`) | Passo | Cosa becca |
|---|---|---|---|
| 1 | `sqlfluff` | `sqlfluff` | formato SQL — e i file che sqlfluff **salta** perché troppo grandi: quelli sono `MANC`, non `OK` |
| 2 | `squawk` | `squawk` | lock, riscritture di tabella, distruttivi non dichiarati |
| 3 | `db-reset` | `supabase db reset` | le migrazioni applicate davvero, in ordine, più il seed |
| 4 | `db-lint` | `supabase db lint` | funzioni e plpgsql non validi |
| 5 | `db-advisors` | `supabase db advisors` | il linter mantenuto da Supabase (CLI ≥ 2.81.3): rosso solo sugli `ERROR`, i `WARN` restano scritti |
| 6 | `audit-rls` | audit RLS | tabelle nude, policy assenti o permissive, **policy mai attaccate da un test**, **colonna di privilegio scrivibile**, **macchina a stati senza vincolo su `insert`**, viste e funzioni pericolose, FK e colonne di policy senza indice |
| 7 | `pgtap` | pgTAP | le policy verificate impersonando i ruoli — **si contano i file**, una cartella vuota è `MANC` |
| 8 | `tipi` | tipi TypeScript | disallineamento fra schema e codice |
| 9 | `contratto-uscita` | contratto d'uscita | `.sqlfluff`, `squawk.toml`, handoff senza segnaposto |

Uscita: `0` verde · `1` rosso · `2` errore di esecuzione.

La colonna `id` è il **contratto con l'orchestratore**: l'etichetta italiana può
cambiare, l'`id` no. Forma completa in `references/verifica-deterministica.md`
§Il contratto `--json`.

---

## 2. Provarla in dieci minuti

### 2.1 Prerequisiti — verificali prima, non dopo

```bash
supabase --version && psql --version && sqlfluff --version && squawk --version && node --version
```

Su questa macchina i binari non sono nel PATH di default. Da **Git Bash**:

```bash
export PATH="$PATH:$USERPROFILE/scoop/apps/postgresql/current/bin:$APPDATA/Python/Python314/Scripts"
```

Docker dev'essere acceso. Se manca uno strumento il passo relativo esce
`MANCANTE` e il gate resta **rosso** — è il comportamento voluto.

### 2.2 Il modo più veloce: i test degli script, senza database

```bash
cd "agenti/schema-forge"
npm test          # equivale a: node --test "scripts/**/*.test.mjs"
```

132 test verdi, zero dipendenze runtime, nessun Docker. Verificano le **regole**
dell'audit e del diagramma come funzioni pure. Se vuoi capire cosa becca l'audit
RLS senza montare niente, questo è il punto d'ingresso.

### 2.3 Il banco di prova completo

Un banco è un progetto Supabase usa-e-getta. La cartella `banco-prova*/` è
gitignorata apposta.

```bash
mkdir banco-prova-mio && cd banco-prova-mio
supabase init
```

Poi **due modifiche obbligatorie** a `supabase/config.toml`:

```toml
# 1. porte 57xxx: sulla 54322 c'è quasi sempre lo stack di un altro progetto
[api]
port = 57321
[db]
port = 57322
[studio]
port = 57323
[inbucket]
port = 57324

# 2. senza questo, `supabase db reset` fallisce con un 502
[analytics]
enabled = false
```

Poi:

```bash
supabase start
cp ../agenti/schema-forge/resources/config/.sqlfluff .
cp ../agenti/schema-forge/resources/config/squawk.toml .
```

A questo punto scrivi (o fai scrivere all'agente) le migrazioni in
`supabase/migrations/`, il seed in `supabase/seed.sql`, i test in
`supabase/tests/`.

### 2.4 Far girare il gate

```bash
cd banco-prova-mio
node "../agenti/schema-forge/scripts/verify.mjs"
node "../agenti/schema-forge/scripts/verify.mjs" --json      # per l'orchestratore
node "../agenti/schema-forge/scripts/verify.mjs" --skip-reset --db-url postgresql://...
```

Uscita reale del banco VetCare, rilanciata il 2026-07-27 **dopo** le sette regole
nuove e il passo `db advisors` (dettaglio dell'audit accorciato qui, sono dodici
righe uguali):

```
GATE SCHEMA: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)

OK    sqlfluff (formato SQL)
OK    squawk (operazioni pericolose)
OK    supabase db reset (applicazione reale)
        6 migrazioni applicate + seed
OK    supabase db lint
OK    supabase db advisors
        [WARN] multiple_permissive_policies (20): public.animals, public.clinics, public.diagnoses, …
OK    audit RLS
        schemi esposti: public, graphql_public · postgresql://postgres:postgres@127.0.0.1:57322/postgres
        [issue] public.species → "specie_visibili_a_tutti": policy con `using (true)`: RLS attiva ma senza filtro
        [issue] public.e_staff(): funzione `security definer` eseguibile da PUBLIC (quindi da `anon`): e' un endpoint pubblico che scavalca la RLS
        …altre dieci funzioni nella stessa condizione…
OK    pgTAP (test delle policy)
OK    tipi TypeScript
OK    contratto d'uscita (configurazioni + handoff)
```

Undici di quelle righe **prima non c'erano**: le funzioni `security definer` di
questo banco sono sempre state chiamabili da `anon`, ma nessuno strumento lo
diceva. Sono `issue`, non `block`: il gate resta verde e le scrive — che è
esattamente il punto del §5 qui sotto.

Le due righe di dettaglio dell'audit RLS — **quali schemi** e **quale database** —
non sono decorative: con due stack Supabase accesi sono l'unica cosa che ti dice
che hai auditato il progetto giusto.

### 2.5 Gli altri script, a mano

```bash
# audit di sicurezza, non tocca il database
node "../agenti/schema-forge/scripts/rls-audit.mjs" \
     --db-url "postgresql://postgres:postgres@127.0.0.1:57322/postgres" \
     --schemas public --json

# diagramma ER dallo schema REALE (non lo disegna l'LLM)
node "../agenti/schema-forge/scripts/erd.mjs" --out docs/schema/ERD.md \
     --db-url "postgresql://postgres:postgres@127.0.0.1:57322/postgres"
```

**Passa sempre `--db-url`.** Lanciati a mano, entrambi puntano alla 54322 di
default e non lo dichiarano: nel collaudo `rls-audit.mjs` ha auditato il
database di un altro cliente e ha risposto «nessun bloccante».

### 2.6 I tipi TypeScript — da Git Bash, non da PowerShell

```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

In PowerShell la redirezione `>` scrive **UTF-16 con CRLF**: il confronto byte a
byte del passo 7 fallisce sempre, e il gate resta rosso senza un motivo vero.

### 2.7 Vedere il gate diventare rosso

Il modo migliore di capire un gate è romperlo. Tre rotture che ho verificato:

```bash
# tabella nuda → passo 5 rosso
psql "$DB" -c "create table public.nuda (id uuid primary key);"

# distruttivo non dichiarato → passo 2 rosso
echo "drop table public.species;" > supabase/migrations/29990101000000_boom.sql

# cartella dei test assente → passo 6 `skipped` = verifica mancante = gate rosso
mv supabase/tests supabase/tests-off
```

Occhio all'ultima: la cartella **assente** dà `skipped` e il gate è rosso, ma una
cartella **vuota** dà `pass`. Cancellare i test rende il gate più verde. È il
punto aperto n°4 di `STATO.md`.

---

## 3. Caso d'uso: VetCare Nord

Il giro completo del collaudo del 2026-07-26. Dominio deliberatamente **non
e-commerce**, perché tutte le reference della skill sono e-commerce ed è lì che
la generalizzazione si rompe.

### 3.1 Il brief, ambiguo apposta

> Tre cliniche veterinarie in Piemonte. Serve un portale dove i proprietari
> vedono lo storico del proprio animale, prenotano visite e ricevono promemoria.
> I veterinari devono vedere le cartelle dei loro pazienti. Il direttore vede
> tutto. I prezzi cambiano per convenzione. Mai più di 500 animali per sede.

Sei ambiguità sepolte: cosa vuol dire «loro pazienti»; se il direttore è staff o
un ruolo a parte; se il proprietario ha per forza un account; cosa succede al
prezzo dopo che è cambiato; se «tutto» del direttore include le note interne; e
quel «mai più di 500» che invita a usare un `int`.

### 3.2 `model` — lo Specchio, e lo STOP

L'agente ha classificato i sostantivi, disegnato la mappa di proprietà, prodotto
un ERD, e **si è fermato con 13 domande**, cinque marcate `[S]` (strutturali:
senza risposta non si può scrivere lo schema). Ha anche dichiarato due
contraddizioni del brief invece di risolverle in silenzio.

Non ha scritto una riga di SQL prima del «sì». Questo è il comportamento che il
collaudo doveva falsificare e non è riuscito a falsificare.

Estratto delle domande strutturali:

- «Loro pazienti» = animali visitati da quel veterinario, o tutti gli animali
  della sua sede? *(risposta: della sede)*
- Il direttore è una riga di `staff` con ambito su tre sedi, o un ruolo separato?
- Un cliente che telefona e non si registra mai esiste nel database?
- Le note interne sono visibili al proprietario nello «storico»?

### 3.3 `forge` — dove il dominio ha morso

Quattro migrazioni. Tre decisioni che valgono la pena di essere lette:

**Il direttore in una funzione sola, non in due policy.** Due policy permissive
si sommano in **OR**: quella di sede più quella di direzione avrebbe dato tutto
a tutti. Le due condizioni stanno dentro un'unica funzione:

```sql
create or replace function public.puo_vedere_clinica(clinica uuid)
returns boolean language sql security definer set search_path = '' stable as $$
select exists (
    select 1 from public.staff s
    where s.auth_user_id = (select auth.uid()) and s.is_active
      and (s.job_title = 'direttore' or s.clinic_id = clinica)
);
$$;
```

**Un veterinario non si presta a un'altra sede.** Chiave esterna **composita**
verso `staff (id, clinic_id)`, più un vincolo di esclusione che impedisce due
visite sovrapposte allo stesso veterinario:

```sql
foreign key (staff_id, clinic_id)
    references public.staff (id, clinic_id) on delete restrict,
exclude using gist (
    staff_id with =,
    tstzrange(scheduled_at, ends_at) with &&
) where (status <> 'annullata')
```

Il vincolo ha funzionato subito: il primo `db reset` è **fallito** perché il seed
assegnava un veterinario di Novara a una visita di Vercelli. Non era un bug — era
il database che faceva il suo mestiere.

**Le «mai più di 500 bestie» non hanno prodotto un `int`.** La regola di casa
(`modellazione.md`:25-29) impone `bigint` sulle chiavi a prescindere dai numeri
promessi dal cliente. Le stime dei clienti non sono vincoli.

### 3.4 `seed` — l'idempotenza che `on conflict` non dà

```sql
-- `on conflict do nothing` NON basta qui: il trigger di dominio
-- `fattura_emessa_non_si_tocca` e' BEFORE INSERT e scatta PRIMA che il
-- conflitto sia rilevato.
insert into public.invoice_lines (id, invoice_id, visit_id, service_name, unit_price_cents, quantity)
select '13131313-...-13130001', ...
where not exists (
    select 1 from public.invoice_lines where id = '13131313-...-13130001'
);
```

Verificato: tre riesecuzioni del seed sul database **caldo**, conteggi identici.
Con `on conflict do nothing` il trigger avrebbe sollevato eccezione al secondo
giro.

### 3.5 `types`, `handoff`, poi `verify`

In quest'ordine, o i passi 7 e 8 nascono rossi. Gate **VERDE 8/8**.

### 3.6 `evolve` — un distruttivo autorizzato

Richiesta: «buttate `reminders`, useremo un servizio esterno; e il flag *cliente
difficile*, il legale dice di cancellarlo».

L'agente ha prodotto l'analisi di impatto **con dati veri** (righe contate, non
stimate), si è fermato al checkpoint, ha esportato in `docs/export/*.csv`, e solo
dopo l'autorizzazione ha scritto:

```sql
-- Distruttivo AUTORIZZATO: checkpoint umano superato il 2026-07-26,
-- dati esportati in docs/export/promemoria-2026-07-26.csv.
-- squawk-ignore ban-drop-table
drop table public.reminders;
```

Il commento `squawk-ignore` sta **da solo sulla sua riga**. La motivazione va
**sopra**: sulla stessa riga, squawk legge il resto come altri nomi di regola e
il gate resta rosso con un `unused-ignore`. Verificato in esperimento
controllato.

Gate dopo l'`evolve`: **VERDE 8/8**, sei migrazioni.

---

## 4. Cosa NON dimostra un gate verde

Questa sezione conta più di tutte le altre.

Sullo schema qui sopra — quello che il gate dichiara **VERDE** — il tribunale di
`/code-inquisition` ha riprodotto con comandi reali **16 difetti su 17**, cinque
Critical. Nello stesso momento:

```
sqlfluff       All Finished!            (pulito)
squawk         Found 0 issues in 6 files
rls-audit.mjs  0 block, 1 issue, 0 warn
GATE SCHEMA:   VERDE (0 falliti, 0 verifiche mancanti su 8 passi)
```

**Questo era il 26 luglio. Il 27-28 il gate ha smesso di dirlo.** Sullo stesso
schema, con lo stesso seed, chiude ora:

```
GATE SCHEMA:   ROSSO (2 falliti, 0 verifiche mancanti su 9 passi)
FAIL  audit RLS     [block] public.staff.job_title: colonna che decide gli accessi …
                    [issue] public.visits.status: macchina a stati vincolata solo in `update` …
FAIL  pgTAP         Failed tests: 22-23
```

Le due strade concordano senza sapere l'una dell'altra: le regole nuove del
catalogo trovano l'auto-promozione e la macchina a stati; i test pgTAP negativi
— che il gate adesso **pretende** su ogni tabella scrivibile — falliscono su
quelle due cose e su nient'altro, 2 asserzioni su 23.

Quello che resta vero, e che nessuna regola chiuderà: **l'audit guarda la forma
delle policy.** La semantica la dimostrano i test negativi, e il gate verifica
che esistano e passino, non che siano severi. I difetti qui sotto che non sono
auto-promozione né macchina a stati sono ancora lì, e li trova solo chi li
attacca.

Il più grave, riprodotto di nuovo il 2026-07-27 dentro una transazione annullata:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uid di un veterinario>","role":"authenticated"}';
select public.puo_vedere_clinica('<uuid della sede di Biella>');   -- f
update public.staff set job_title = 'direttore' where auth_user_id = '<uid>';
select public.puo_vedere_clinica('<uuid della sede di Biella>');   -- t
select count(*) from public.medical_records;                        -- 3
rollback;
```

Un veterinario si promuove direttore con un `UPDATE` sulla propria riga e ottiene
le cartelle cliniche di tutte e tre le sedi. La policy di `staff` gli permette di
scrivere la propria riga; nessuno ha mai detto che la colonna `job_title` fosse
diversa dalle altre. **La RLS filtra le righe, non le colonne.**

I tre strumenti non hanno sbagliato: guardano cose diverse. Sono ciechi alla
*semantica* delle policy.

> **Il gate di Schema Forge verifica che la RLS esista. Non verifica che serva a
> qualcosa.**

Quindi: dopo un gate verde su un progetto vero, prima dell'handoff, lancia il
tribunale sulle migrazioni.

```
/code-inquisition supabase/migrations --focus security --depth 1 --council 3
```

Serve la junction della skill (una volta sola, PowerShell da amministratore):

```powershell
New-Item -ItemType Junction -Path ".claude\skills\code-inquisition" `
         -Target (Resolve-Path "agenti\code-inquisition").Path
```

Domande che il gate non pone e che vanno poste a mano, tutte nate da difetti veri
di questo banco:

- Quale colonna, scritta dal suo proprietario, **cambia chi lui è**?
- Ogni macchina a stati è protetta anche sull'`INSERT`, o solo sull'`UPDATE`?
- L'archivio delle revisioni copre **tutte** le colonne o due su otto?
- Le funzioni hanno `revoke ... from anon`, o `anon` può eseguirle tutte?
- Un messaggio d'errore rivela dati di un altro cliente?

---

## 5. Trappole di questa macchina

| Sintomo | Causa | Rimedio |
|---|---|---|
| passo tipi sempre rosso | PowerShell scrive UTF-16 + CRLF | genera i tipi da **Git Bash** |
| `psql` non trovato | non è nel PATH | `%USERPROFILE%\scoop\apps\postgresql\current\bin` |
| `sqlfluff`/`squawk` non trovati | non nel PATH | `%APPDATA%\Python\Python314\Scripts` |
| `db reset` fallisce con 502 | analytics acceso | `[analytics] enabled = false` |
| audit su tabelle sconosciute | porta 54322 = altro progetto | porte 57xxx nel banco, `--db-url` a mano |
| `node --test scripts/` non trova nulla | su Node ≥ 24 il percorso è un glob | `node --test "scripts/**/*.test.mjs"` |
| `semgrep`/`gitleaks` | **non installati** | i loro passi valgono `MANCANTE`, mai `pass` |

---

## 6. Riepilogo dei comandi

```bash
# test degli script, senza database
cd agenti/schema-forge && npm test

# banco: dopo supabase init + porte 57xxx + [analytics] enabled = false
supabase start

# il gate
node "../agenti/schema-forge/scripts/verify.mjs"

# audit e diagramma, sempre con --db-url
node "../agenti/schema-forge/scripts/rls-audit.mjs" --db-url "$DB" --schemas public
node "../agenti/schema-forge/scripts/erd.mjs" --out docs/schema/ERD.md --db-url "$DB"

# tipi, da Git Bash
supabase gen types typescript --local > src/lib/database.types.ts

# quello che il gate non fa
/code-inquisition supabase/migrations --focus security --depth 1 --council 3

# smontare il banco
supabase stop --no-backup
```
