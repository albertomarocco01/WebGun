# P.4h — La credenziale che è sopravvissuta al numero, e i certificati scaduti

Pacchetto **P.4h**, 2026-08-06 pomeriggio e sera. Pilota
`C:\Users\Utente\Desktop\fornodoro`. Agente: **schema-forge**, unico scrittore
del pilota questa settimana (D17/D18).

**Consegna in una riga**: la strada (a) del n°44 è pagata per intero, la
credenziale non è più raggiungibile da nessun comando documentato contro un
database remoto, i cinque certificati sono rilanciati e ridatati sulle corse
vere, il runbook di pubblicazione esiste e **non è firmato di proposito**, e
**n°27 è tornata aperta** perché era stata rinumerata, non chiusa.

**Stato del pilota alla consegna**: commit `c60cee3e3ae2`, app viva sulla 3621
con `BUILD_ID = c60cee3e3ae2ae7c4a1f5a9b137b772f6d443c38`, stack Supabase
acceso (api 7621, db 7622), database allo stato di sviluppo completo. Nessun
deploy, nessun account, nessun dominio, nessun DNS.

**Vincolo non negoziabile, rispettato**: batteria E2E **22/22**, incollata in §2.

---

## 1. La caccia al discriminante

Il n°44 affermava: «**non esiste nessun segnale dentro Postgres che distingua
"sviluppo appena resettato" da "produzione appena creata"**», e portava a
sostegno due candidati morti. Due candidati non sono una dimostrazione, e questa
casa ha già imparato tre volte — n°10, n°31, n°32 — che **un limite dello
strumento non è una proprietà del mondo**.

Tutte le misure sono state fatte sullo stack locale del pilota
(`postgresql://…@127.0.0.1:7622/postgres`, Postgres 17.6, CLI Supabase 2.111.0).
La colonna «metà ospitata» dice cosa succederebbe su Supabase ospitata: è
**dedotta** dalla configurazione documentata, **non misurata**, perché la
direzione vieta di collegarsi a un progetto vero — e un discriminante che si
prova solo collegandosi al bersaglio da cui ci si difende non sarebbe una
difesa.

### 1.1 I candidati, uno per uno

| # | Candidato | Misurato in locale | Ospitata (dedotta) | Esito |
|---|---|---|---|---|
| **C1** | `current_setting('app.settings.jwt_secret', true)` | `'super-secret-jwt-token-with-at-least-32-characters-long'` — il **segreto dimostrativo pubblico** della CLI | il proprio, casuale; oppure **assente** sui progetti nati con chiavi asimmetriche | **VIVO** |
| C2 | `current_setting('app.settings.jwt_exp', true)` | `3600` | `3600`, che è anche il default di un ospitato | morto: valore identico |
| C3 | `current_user` + `rolsuper` | `postgres`, `rolsuper=false`, `rolbypassrls=true` | identico | morto (già noto al n°44, riverificato: **vero**) |
| C4 | elenco dei ruoli | `anon, authenticated, authenticator, dashboard_user, pgbouncer, postgres, service_role, supabase_admin, supabase_auth_admin, supabase_etl_admin, supabase_functions_admin, supabase_privileged_role, supabase_read_only_user, supabase_realtime_admin, supabase_replication_admin, supabase_storage_admin` | **identico**: l'immagine locale crea tutti i ruoli di piattaforma | morto |
| C5 | estensioni installate | `pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp` | stessa immagine, stesse estensioni | morto |
| C6 | schemi | `_realtime, auth, extensions, graphql, graphql_public, net, pgbouncer, public, realtime, storage, supabase_functions, supabase_migrations, vault` | identico | morto |
| C7 | database del cluster | `_supabase, postgres, storage_vectors, template0, template1` | contiene anch'esso `_supabase` | morto |
| C8 | `inet_server_addr()` / `inet_client_addr()` | `172.18.0.10` / **`172.18.0.1`** | indirizzi privati anche là | morto, **e questo è il più istruttivo** |
| C9 | `cluster_name`, `data_directory`, `listen_addresses` | `main`, `/var/lib/postgresql/data`, `*` | valori dell'immagine, uguali | morto |
| C10 | `pg_stat_ssl.ssl` sulla propria connessione | `false` | un ospitato **accetta** connessioni senza TLS se non si impone | morto: non fail-closed |
| C11 | `pg_read_file('/etc/hostname')` | `ERROR: permission denied for function pg_read_file`; `pg_has_role(…,'pg_read_server_files','member')` → `f` | identico | morto |
| C12 | `auth.instances` | vuota | vuota su un progetto nuovo | morto |
| **C13** | una **GUC di sessione** che solo il nostro script imposta | assente di suo (`<<NULL>>`); con `PGOPTIONS` → il valore atteso | irrilevante: non dipende dalla piattaforma | **VIVO, e interamente misurato** |

**C8 merita una riga in più.** L'idea intuitiva — «se la connessione è di
loopback sono in locale» — muore qui e muore male: nemmeno **in locale** la
connessione è di loopback. Postgres gira in un contenitore e vede il client
arrivare da `172.18.0.1`, il gateway della rete Docker. Chi provasse quella
strada scriverebbe una guardia che rifiuta sempre, in sviluppo compreso.

### 1.2 Le misure, incollate

```
=== C1: app.settings.jwt_secret ===
'super-secret-jwt-token-with-at-least-32-characters-long'
=== C3: privilegio di current_user ===
postgres | rolsuper=false | rolbypassrls=true | rolcreaterole=true
=== C4: ruoli presenti ===
anon, authenticated, authenticator, dashboard_user, pgbouncer, postgres, service_role,
supabase_admin, supabase_auth_admin, supabase_etl_admin, supabase_functions_admin,
supabase_privileged_role, supabase_read_only_user, supabase_realtime_admin,
supabase_replication_admin, supabase_storage_admin
=== C5: estensioni installate ===
pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp
=== C6: schemi ===
_realtime, auth, extensions, graphql, graphql_public, information_schema, net,
pg_catalog, pg_toast, pgbouncer, public, realtime, storage, supabase_functions,
supabase_migrations, vault
=== C7: database del cluster ===
_supabase, postgres, storage_vectors, template0, template1
=== C8: inet_server_addr / port / client ===
172.18.0.10 | 5432 | client=172.18.0.1
=== C9: cluster_name / data_directory / listen_addresses ===
cluster_name=main
data_directory=/var/lib/postgresql/data
listen_addresses=* port=5432
=== C10: pg_stat_ssl ===
false | 172.18.0.1/32
=== C11: lettura del filesystem del server ===
ERROR:  permission denied for function pg_read_file
=== C11b: appartenenza a pg_read_server_files ===
f
=== C12: auth.instances ===
<<vuota>>
=== C13: GUC personalizzata, senza e con PGOPTIONS ===
<<NULL>>
si-e-una-macchina-di-sviluppo
```

E la GUC di C1, con la sua provenienza — è scritta con `ALTER DATABASE`, non è
un default:

```
 datname  | rolname |                          setconfig
----------+---------+-------------------------------------------------------------
 postgres |         | {app.settings.jwt_secret=super-secret-jwt-token-with-at-least-32-characters-long,app.settings.jwt_exp=3600}
```

**E sopravvive a un `db reset`** — misurato subito dopo un reset completo, che
ricrea il database:

```
=== app.settings.jwt_secret DOPO il db reset (sopravvive?) ===
'super-secret-jwt-token-with-at-least-32-characters-long'
```

### 1.3 Il discriminante esiste, ma la domanda era sbagliata

Non esiste un segnale che dica **«sei in produzione»**. Esiste un segnale che
dice **«sei il banco di prova della CLI»**, ed è l'unica delle due domande che
ha una risposta. Il rovesciamento è tutto: si smette di cercare la prova
dell'ambiente da cui difendersi e si cerca la prova dell'unico ambiente in cui
si è autorizzati a scrivere. Tutto il resto — compreso ciò a cui nessuno ha
ancora pensato — cade dalla parte del rifiuto, **per costruzione**.

`supabase start` scrive `app.settings.jwt_secret` sul database `postgres`, e il
valore è il segreto dimostrativo pubblico della CLI: quello che `supabase status`
stampa in chiaro come `JWT_SECRET`, identico in ogni progetto locale del mondo.
Non è un segreto: è un'etichetta che dice «sono un banco di prova».

Nel file non si scrive quel valore, si confronta il suo **sha256**. Due ragioni:
una stringa a forma di segreto in un file committato è esattamente ciò che il
passo `gitleaks` esiste per trovare, e **non serve conoscerlo per riconoscerlo**.

```
select encode(digest(current_setting('app.settings.jwt_secret', true), 'sha256'), 'hex');
 a064b502e61d27e94b8717290e5e1b32e36720e9fbdf952ec81a84c07128cb37
-- controprova con la stringa scritta a mano: stesso valore
-- e una qualunque altra stringa: f831eb1cab8d872a84c2c3b1c3fa7789a8564aa39b46c30f5add91d51241358e
```

**Cosa prova e cosa no.** Prova che *questo* è lo stack locale della CLI. Non
prova che un altro database sia «produzione», e non ne ha bisogno: il ramo
`else` è il rifiuto. L'unico modo di ingannarla è scrivere a mano il segreto
dimostrativo su un database vero — che non è una distrazione, è un sabotaggio.

**Metà misurata, metà dedotta**, e va detto quale: che lo stack locale valga
quel segreto è **misurato**; che un ospitato ne abbia un altro o nessuno è
**dedotto**. Ma la deduzione **non regge la sicurezza della guardia** — regge
solo la previsione che il rifiuto non darà fastidio a nessuno in sviluppo.

### 1.4 La guardia adottata: quattro condizioni, in serie, tutte fail-closed

| # | Dove | Cosa pretende | Se non lo trova |
|---|---|---|---|
| 0 | `supabase/config.toml` | il file **non è** in `[db.seed].sql_paths` | nessun comando della CLI lo applica, né locale né remoto |
| 1 | `scripts/seed-sviluppo.mjs` | host locale, e l'indirizzo lo dice `supabase status` — mai una variabile d'ambiente | esce **1**, non si collega |
| 2 | dentro il file | sha256 di `app.settings.jwt_secret` = impronta del banco | `P0001`, transazione annullata |
| 3 | dentro il file | GUC di sessione `fornodoro.seed_sviluppo` col valore atteso | `P0001`, transazione annullata |
| 4 | dentro il file | `auth.users` e `ordini` senza righe estranee | `P0001`, transazione annullata |

**Perché la 3 esiste accanto alla 2.** La 2 è la più elegante ma dipende da come
è fatta una piattaforma; la 3 non dipende da niente ed è **interamente
misurata**. Se domani la CLI smettesse di impostare quella GUC, la 2 si
irrigidirebbe (rifiuterebbe anche in sviluppo) invece di ammorbidirsi: è la
direzione giusta in cui sbagliare.

Il file si difende anche da chi lo lancia: **`\set ON_ERROR_STOP on` sta dentro
il file**, non nella riga di comando. P.4g aveva chiuso metà di questo problema
con `begin`…`commit`; l'altra metà è che un errore di `\ir` è un errore del
**client** e non fa abortire nessuna transazione.

### 1.5 I quattro sabotaggi, incollati

```
########## SABOTAGGIO 1 — psql -f nudo, senza il consenso ##########
BEGIN
psql:…/90-solo-sviluppo.sql:198: ERROR:  seed di SVILUPPO rifiutato: manca il consenso esplicito di chi esegue. Questo file non si applica con `supabase db reset` ne' con `psql -f`: si applica con `npm run seed-sviluppo`, che imposta `fornodoro.seed_sviluppo`. Nessun comando della CLI la imposta, ed e' il punto.
EXITCODE=3

########## SABOTAGGIO 2 — consenso presente, ma jwt_secret di un altro database ##########
BEGIN
psql:…/90-solo-sviluppo.sql:198: ERROR:  seed di SVILUPPO rifiutato: questo database NON si e' dichiarato come lo stack locale della CLI Supabase. `app.settings.jwt_secret` ha impronta f831eb1cab8d872a84c2c3b1c3fa7789a8564aa39b46c30f5add91d51241358e, attesa a064b502e61d27e94b8717290e5e1b32e36720e9fbdf952ec81a84c07128cb37. …
EXITCODE=3

########## SABOTAGGIO 3 — jwt_secret ASSENTE (il caso «produzione appena creata» del n°44) ##########
BEGIN
psql:…/90-solo-sviluppo.sql:198: ERROR:  seed di SVILUPPO rifiutato: questo database NON si e' dichiarato come lo stack locale della CLI Supabase. `app.settings.jwt_secret` ha impronta <<assente>>, attesa a064b502e61d27e94b8717290e5e1b32e36720e9fbdf952ec81a84c07128cb37. …
EXITCODE=3

########## SABOTAGGIO 4 — un terzo account estraneo nel database ##########
INSERT 0 1
terzo account piantato
psql:…/90-solo-sviluppo.sql:198: ERROR:  seed di SVILUPPO rifiutato: questo database ha gia' 1 account e 0 ordini che non sono i suoi. …
Il seed di sviluppo NON e' stato applicato: la guardia dentro il file ha rifiutato…
DELETE 1
terzo account tolto
```

Il **sabotaggio 3 è la riproduzione esatta del n°44**: un database dove
`auth.users` e `ordini` sono vuote e la GUC non c'è, cioè una produzione appena
creata. Prima: `INSERT 0 2`. Adesso: `P0001`, nessuna scrittura.

E la via legittima, riproducibile a caldo tre volte:

```
########## RIESEGUIBILE A CALDO — tre volte di fila ##########
giro 1: exit 0  users=2 personale=2 ordini=5 righe=8 stati=annullato,ritirato,pronto,ricevuto,in_preparazione
giro 2: exit 0  users=2 personale=2 ordini=5 righe=8 stati=annullato,ritirato,pronto,ricevuto,in_preparazione
giro 3: exit 0  users=2 personale=2 ordini=5 righe=8 stati=annullato,ritirato,pronto,ricevuto,in_preparazione
```

---

## 2. Cosa è costata la strada (a), posto per posto

### 2.1 Il posto che nessuno aveva previsto: il gate di schema-forge

Il mandato avvertiva che (a) avrebbe potuto toccare il contratto del gate. Lo ha
toccato, e non dove ci si aspettava: non sul passo `db reset`, che continua a
uscire 0, ma sul passo **pgTAP**, che gira su ciò che il reset lascia.

**Prima misura, subito dopo aver tolto il file da `sql_paths`:**

```
Test Summary Report
-------------------
…/flusso_ordini.test.sql   (Wstat: 0   Tests: 14 Failed: 5)   Failed tests: 10-14
…/indurimento.test.sql     (Wstat: 0   Tests: 12 Failed: 4)   Failed tests: 4, 6-8
…/rls_negativi.test.sql    (Wstat: 0   Tests: 30 Failed: 8)   Failed tests: 14, 19, 23-25, 28-30
…/ruolo_una_porta.test.sql (Wstat: 768 Tests: 10 Failed: 5)   Parse errors: Bad plan. You planned 17 tests but ran 10.
Files=5, Tests=75
Result: FAIL
```

**22 sottotest rossi.** La causa: quattro file di test pescavano i due account,
le due righe di `personale` e i cinque ordini **dal seed**.

**Il gate non è stato piegato.** Rimettere il file in `sql_paths` sarebbe stato
piegarlo; la correzione è stata togliere ai test una dipendenza che non
avrebbero dovuto avere. **Un test delle policy che si appoggia al seed prova
anche il seed**, e quando il seed cambia diventa rosso parlando d'altro.

Ogni file include adesso `supabase/tests/banco-di-prova.psql` con `\ir`, dentro
la propria transazione, e lo annulla col `rollback`. Due dettagli misurati e non
dedotti:

- **il banco sta in `supabase/tests/`**, perché `supabase test db` monta nel
  contenitore quella cartella e basta. Con il file un livello più su:
  `psql:…/indurimento.test.sql:17: error: …/supabase/banco-di-prova.sql: No such
  file or directory`, e il file di test esce 3;
- **l'estensione è `.psql`**, perché ogni `.sql` di quella cartella verrebbe
  eseguito come test (`No plan found in TAP output`) e perché il gate conta i
  `.sql` di primo livello per decidere se i test esistono.

La password del banco è l'hash di un **UUID casuale coniato al momento**: il
banco non è una seconda copia della credenziale.

**Dopo:**

```
…/flusso_ordini.test.sql .... ok
…/indurimento.test.sql ...... ok
…/ritiro_validato.test.sql .. ok
…/rls_negativi.test.sql ..... ok
…/ruolo_una_porta.test.sql .. ok
All tests successful.
Files=5, Tests=82
Result: PASS
```

**82/82 su un database appena resettato e senza nessun account.**

### 2.2 I posti trovati col grep

`grep -rn "db reset\|db_reset\|seed\.sql\|sql_paths\|supabase db push"` sul
pilota, escluse `node_modules`, `.next`, `.git`:

| Dove | Cosa diceva | Cosa dice adesso |
|---|---|---|
| `supabase/config.toml` | tre nomi in `sql_paths` | due, con trenta righe che spiegano perché |
| `CLAUDE.md` | *(non lo diceva)* | sezione nuova: «Lo stato di sviluppo si rimette con DUE comandi» |
| `README.md` | **non esisteva** | creato: §Come si accende, con la tabella dei tre seed |
| `docs/PRODUZIONE.md` §1 | «l'elenco … tre nomi scritti a mano» | riquadro: in `sql_paths` sono rimasti in due |
| `docs/PRODUZIONE.md` §2 | «i due comandi consegnano le password» | vietati lo stesso, con la **ragione cambiata** |
| `docs/PRODUZIONE.md` §4 | guardia a una condizione | tabella delle quattro guardie + cosa prova la condizione 2 |
| `docs/flussi-critici.md` testa | due correzioni | terza correzione: la riga operativa cambia |
| `docs/flussi-critici.md` §Ambiente | «le 5 righe di `supabase db reset`» | «di `db reset && npm run seed-sviluppo`» |
| `docs/handoff/07-schema-forge.md` | riquadro P.4g | riquadro nuovo con le tre conseguenze |
| `docs/handoff/12-flow-sentinel.md` | — | riquadro ⚠ per chi lancia la batteria |
| `e2e/global-teardown.ts` | «rimetti il seed con `supabase db reset`» | i due comandi, con la ragione |

Il posto meno ovvio è l'ultimo: il messaggio che il teardown stampa **quando la
batteria ha sporcato il database** prescriveva un comando che non basta più. È
il posto in cui un consiglio sbagliato arriva nel momento peggiore.

### 2.3 La conseguenza operativa che va ricordata

Il gate di **schema-forge** fa un `db reset`, quindi **lascia il database senza
account di sviluppo**. Prima di **flow-sentinel** ci va `npm run seed-sviluppo`.
È scritto in `CLAUDE.md`, nell'handoff `12` e nell'handoff `15`.

### 2.4 La batteria E2E — il vincolo che vale più di tutto

```
Running 22 tests using 1 worker

  ✓   1 [chromium] › e2e\accesso-titolare.spec.ts:19:5 › la titolare entra dalla porta vera @flusso:accesso-titolare (737ms)
  ✓   2 [chromium] › e2e\admin-negato-anon.spec.ts:27:7 › un anonimo non entra in /admin @flusso:admin-negato-anon (240ms)
  ✓   3 [chromium] › e2e\admin-negato-anon.spec.ts:27:7 › un anonimo non entra in /admin/ordini @flusso:admin-negato-anon (254ms)
  ✓   4 [chromium] › e2e\admin-negato-anon.spec.ts:27:7 › un anonimo non entra in /admin/personale @flusso:admin-negato-anon (243ms)
  ✓   5 [chromium] › e2e\autodisattivazione-negata.spec.ts:46:5 › la titolare non si disattiva da sola @flusso:autodisattivazione-negata (1.4s)
  ✓   6 [chromium] › e2e\giro-cucina.spec.ts:25:5 › la cucina porta un ordine da ricevuto a ritirato @flusso:giro-cucina (2.0s)
  ✓   7 [chromium] › e2e\ordine-asporto-anonimo.spec.ts:25:5 › un anonimo ordina d'asporto e l'ordine finisce nel database @flusso:ordine-asporto-anonimo (1.7s)
  ✓   8 [chromium] › e2e\ordini-negati-anon.spec.ts:32:5 › un anonimo non legge gli ordini @flusso:ordini-negati-anon (203ms)
  ✓   9 [chromium] › e2e\ordini-negati-anon.spec.ts:60:5 › un codice di ritiro inventato non esiste @flusso:ordini-negati-anon (269ms)
  ✓  10 [chromium] › e2e\ordini-negati-anon.spec.ts:70:5 › col codice giusto l'ordine si legge, ma senza telefono @flusso:ordini-negati-anon (274ms)
  ✓  11 [chromium] › e2e\salto-di-stato-negato.spec.ts:35:5 › la cucina non salta uno stato @flusso:salto-di-stato-negato (1.4s)
  ✓  12 [chromium] › e2e\scrittura-menu-negata-cucina.spec.ts:40:5 › la cucina non scrive sul menu @flusso:scrittura-menu-negata-cucina (720ms)
  ✓  13 [chromium] › e2e\stato-falsificato-negato.spec.ts:34:5 › uno stato di partenza falso non muove niente @flusso:stato-falsificato-negato (837ms)
  ✓  14 [chromium] › e2e\titolare-cambia-menu.spec.ts:48:5 › il titolare spegne e riaccende i due interruttori @flusso:titolare-cambia-menu (3.7s)
  ✓  15 [chromium] › e2e\titolare-cambia-testo.spec.ts:41:5 › il titolare riscrive un testo e il sito lo mostra subito @flusso:titolare-cambia-testo (3.0s)
  ✓  16 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › la cucina non entra in /admin/menu @flusso:titolare-negato-cucina (610ms)
  ✓  17 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › la cucina non entra in /admin/categorie @flusso:titolare-negato-cucina (608ms)
  ✓  18 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › la cucina non entra in /admin/contenuti @flusso:titolare-negato-cucina (646ms)
  ✓  19 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › la cucina non entra in /admin/orari @flusso:titolare-negato-cucina (639ms)
  ✓  20 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › la cucina non entra in /admin/personale @flusso:titolare-negato-cucina (604ms)
  ✓  21 [chromium] › e2e\titolare-negato-cucina.spec.ts:43:7 › alla cucina la barra offre una sola sezione @flusso:titolare-negato-cucina (352ms)
  ✓  22 [chromium] › e2e\voce-esaurita-rifiutata.spec.ts:43:5 › una voce esaurita non si ordina @flusso:voce-esaurita-rifiutata (324ms)

  22 passed (24.3s)
```

E i conteggi dopo il ciclo pulito `db reset && seed-sviluppo`, identici a quelli
che P.4g dichiarava:

```
          t          | count
---------------------+-------
 allergeni           |    14
 allergeni_voci_menu |    17
 auth.identities     |     2
 auth.users          |     2
 categorie           |     3
 contenuti_sito      |     7
 orari_apertura      |     7
 ordini              |     5
 personale           |     2
 righe_ordine        |     8
 voci_menu           |    11
```

### 2.5 La rivendicazione misurata

> **La credenziale non è più raggiungibile da nessun comando documentato contro
> un database remoto.**

Cosa la sostiene, e non è una promessa:

1. `[db.seed].sql_paths` contiene **due** file, e `grep` su entrambi per
   `auth\.|password|encrypted_password` dà **zero righe**. I due comandi che
   leggono quell'elenco — quelli del n°45 — non hanno più niente di pericoloso
   da applicare.
2. Nessun altro comando della CLI legge `supabase/seed/90-solo-sviluppo.sql`:
   non sta in nessun elenco.
3. L'unico percorso che lo applica è `npm run seed-sviluppo`, che **rifiuta un
   host non locale** e che prende l'indirizzo da `supabase status`, non da una
   variabile d'ambiente — cioè non dal posto da cui arriverebbe per sbaglio
   l'indirizzo di un progetto vero.
4. E se qualcuno aggirasse tutti e tre, il file rifiuta comunque: sabotaggi 1-4.

**Cosa questa rivendicazione NON dice**, ed è §3: la credenziale è ancora nel
repository e nella sua storia.

---

## 3. Il registro, voce per voce

| # | Prima | Dopo |
|---|---|---|
| **27** | **CHIUSO** | **APERTA — RISTRETTA** |
| **44** | aperto, medio | **CHIUSO** |
| **45** | aperto, basso | **CHIUSO** |
| **46** | aperto, basso | **aperto — ristretto** |
| **47** | aperto, basso | **CHIUSO** |
| **48** | *(non esisteva)* | **aperto, basso** — divergenza dichiarata |
| **3** | aperto | aperto, con la forma nuova da portare nel template |

Totale: da **47 righe, 9 chiuse** a **48 righe, 11 chiuse**.

### 3.1 n°27 — perché torna aperta

La riga diceva `CHIUSO`. Non lo era: **aveva cambiato numero.**

Il pericolo del n°27 non era «il percorso di produzione legge il file
sbagliato». Era **«esiste una credenziale committata che qualcosa può portare su
un database vero»**. P.4g ha chiuso il primo, e ha scritto il secondo *altrove*,
ai numeri 44 e 45 — che restavano aperti. Il rischio non era diminuito di un
grammo.

**Nessuna chat sola poteva vederlo**, e vale la pena dire perché: serve tenere
insieme tre fonti che nessuna delle tre contraddice da sola. L'handoff che dice
«chiuso»; il registro che al n°44 dice «i due account entrano davvero,
riprodotto»; e il gate di launchpad che non legge la prosa e continua a stampare
`[block] credenziale cablata in un seed`. Ognuna è vera; è la loro somma a essere
un difetto.

**Cosa è chiuso** (riverificato, non ereditato): il percorso documentato di
produzione non legge nessun file con una password; `db reset` da solo dà
`auth.users` 0, `personale` 0, `ordini` 0 e il dominio completo;
`crea-titolare.mjs` crea un account che entra davvero. **Cosa è chiuso in più
oggi**: §2.5. **Cosa resta aperto**: `password123` è in un file **tracciato** e
in **cinque punti della storia**.

**Perché non è stata tolta**, e la decisione non è di questo pacchetto:

- la riga «utenti … password `password123`» di `docs/flussi-critici.md`
  §Ambiente è **firmata** (D14), e la batteria vi conia le sue due sessioni;
- toglierla da HEAD **non la toglie dalla storia**: chiuderebbe metà del rosso
  del gate e lascerebbe intatta la metà che conta;
- riscrivere la storia invalida ogni clone esistente ed è una decisione della
  direzione.

**Cosa apre, oggi**: nessun database che qualcuno possa raggiungere. Quei due
account non esistono in nessun ambiente che non sia lo stack locale di uno
sviluppatore, e in produzione non nascono.

Le tre strade sono scritte nella voce. La proposta di P.4h: **(i)** finché il
repository resta in casa, **(iii)** — riscrivere la storia — prima del giorno in
cui esce.

### 3.2 n°44, n°45, n°47 — chiuse con la misura

Le misure prima/dopo sono in §1 e §2 e sono ricopiate nelle voci del registro.
Per n°47, la sola che non è stata ancora incollata qui:

```
########## PRIMA — senza il campo packageManager ##########
Progress: resolved 585, reused 0, downloaded 0, added 0, done
Done in 15.9s
  EXITCODE=0

########## DOPO — con "packageManager": "npm@11.16.0" ##########
 ERROR  This project is configured to use npm
For help, run: pnpm help install
  EXITCODE=1
```

La riserva scritta nel registro — «rompe chiunque usi pnpm di proposito» — è
stata **misurata vuota per questo progetto**: c'è un `package-lock.json` e
nessun `pnpm-lock.yaml`, la riga operativa è npm ovunque, i cinque gate lanciano
npm. Usare pnpm qui non era «supportato»: era **non impedito**. E npm non si è
rotto: `npm ls` 0, `npm install --package-lock-only` 0, `npm run build` 0.

### 3.3 n°46 — ristretta, e ne è uscito un secondo flag

La domanda che nessuno aveva fatto era: *e allora?* Spento `engine-strict`, cosa
succede?

```
=== n°46: engine-strict si spegne col flag? ===
true
  con il flag:  false
  con la variabile: false

=== e cosa succede DOPO averlo spento, col node di sistema 20.12.2? ===
  ma «funziona per via di un polyfill del framework» non e' una versione
  supportata: e' una coincidenza che regge finche' regge. Debito n°32.
  …
  EXITCODE=1
```

Cioè il flag apre `npm install`, non la costruzione: `npm run build` si ferma
comunque sul `prebuild`. **Ma non si chiude**, perché cercando ho trovato il
secondo flag:

```
=== n°46 / residuo: e se si saltano anche gli script? ===
  npm run build --ignore-scripts   ->   EXITCODE=0
```

`--ignore-scripts` salta `prebuild`, quindi salta `controlla-node.mjs`. Due flag
in fila e la difesa non c'è più. **Scritto invece che lasciato trovare a
qualcun altro.** Si chiuderebbe con un controllo dentro `next.config.ts`, che
`next build` valuta sempre: non fatto, e la ragione è in §7.

---

## 4. I cinque gate rilanciati, e la provenienza delle versioni

Rilanciati **alla fine del lavoro**, una volta, dalla radice del pilota, per
**percorso assoluto**, sulla build `e428a21d5bcf8c6807627b3d05f061a18ae9cb34`.

**Regia al commit `47065da` (2026-08-06T17:30:21+02:00)** — e non basta dirlo,
perché il working tree della regia era **sporco**:

```
REGIA HEAD = 47065da
--- quali dei cinque gate sono SPORCHI in questo momento ---
schema-forge          M agenti/schema-forge/scripts/audit-lib.mjs M …/audit-lib.test.mjs M …/erd.mjs M …/rls-audit.mjs
gestionale-crafter    M agenti/gestionale-crafter/scripts/admin-audit.mjs
vetrina-crafter
flow-sentinel
speed-demon
```

Due dei cinque gate sono stati misurati su **codice non committato di P.7d**.
Questi verdi valgono per quelle versioni lì, e vanno riletti quando P.7d
committa. È scritto accanto al verde nei rispettivi handoff.

| Gate | Esito |
|---|---|
| schema-forge | `GATE SCHEMA: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)` |
| gestionale-crafter | `GATE GESTIONALE: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)` |
| vetrina-crafter | `GATE VETRINA: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)` |
| flow-sentinel | `GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)` — **22 passati** |
| speed-demon | `GATE PERFORMANCE: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)` |

Le uscite per intero sono **incollate negli handoff** `07`, `08`, `10`, `12`,
`13`, che sono anche il posto in cui devono stare per il contratto a valle.

### 4.1 Il rosso che ho incontrato, e di chi era

Il mandato avvertiva che i gate si sarebbero irrigiditi sotto di me e che un
rosso nuovo andava attribuito onestamente. **Un rosso c'è stato**, ed era mio:

```
FAIL  identita' dell'app servita
        http://localhost:3621 (HTTP 200) risponde, ma NON e' l'app di questo progetto.
          build id di C:/Users/Utente/Desktop/fornodoro: b7467cf132ac68e1f35475c4a15ef42ec38cea3a
          non compare da nessuna parte nell'HTML servito da quell'indirizzo.
        Sta rispondendo un'altra applicazione sulla stessa porta…
MANC  pagine dichiarate e pagine servite
        identita' dell'app non stabilita: interrogare pagine su un'app che non si sa quale sia produce un esito che non e' un esito
```

**Non una regressione, non una regola nuova**: sulla 3621 girava ancora un
processo avviato da una build precedente, perché avevo ricostruito senza
riavviare. Il gate se n'è accorto prima di me, e i tre passi a valle si sono
correttamente rifiutati di misurare. Rifatta la build e riavviato il processo:
verde. È il passo che impedisce di leggere dieci rilievi plausibili di un sito
che non è quello che si sta giudicando.

**Nessun altro rosso**: i cinque gate accettano il pilota anche dopo il lavoro
di P.7d che c'era al momento della corsa.

### 4.2 La trappola di speed-demon

Rispettata: `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` prima del
lancio, `node -v` → `v24.18.1`. Il gate chiama Lighthouse via `npx`, che prende
il node del `PATH` e non l'interprete che ha avviato `verify.mjs`; col node di
sistema l'audit `canonical` muore su `URL.parse`, la categoria `seo` resta senza
punteggio e il gate blocca — correttamente. Gli altri quattro girano col node di
sistema.

### 4.3 Gli handoff ridatati, e su cosa

Il passo `verdetti` di launchpad misura la **data di commit** dell'handoff
contro l'ultimo commit che tocca `src`, `supabase`, `package.json`,
`next.config.*`. I sei handoff sono stati committati **dopo** l'ultimo commit di
codice, e il passo è passato da sette `[block]` a `nessun rilievo`.

Fra la build su cui i cinque gate sono girati (`e428a21`) e il commit consegnato,
è cambiata **solo documentazione**, e va detto invece di lasciarlo supporre:

```
 docs/handoff/07-schema-forge.md                  |  42 +++++-
 docs/handoff/08-vetrina-crafter.md               |  57 +++++++-
 docs/handoff/10-gestionale-crafter.md            |  36 ++++-
 docs/handoff/12-flow-sentinel.md                 |  62 ++++++++-
 docs/handoff/13-speed-demon.md                   |  52 +++++++-
 docs/handoff/14-p4g-prerequisiti.md              |  77 +++++++++--
 docs/handoff/15-p4h-credenziale-e-certificati.md | 162 +++++++++++++++++++++++
 7 files changed, 458 insertions(+), 30 deletions(-)
```

### 4.4 L'handoff `14`, e la domanda che pone

Il gate rifiutava: `[block] docs/handoff/14-p4g-prerequisiti.md: nessuna riga
`Gate: VERDE|ROSSO` leggibile`. **Aveva ragione**: un handoff senza verdetto non
è un certificato, è prosa.

La causa non è una dimenticanza. P.4g era **trasversale** — non un anello di
`07 → 08 → 10 → 12 → 13` — e per un pacchetto trasversale **non esiste un gate
che lo copra**. Scrivendo un handoff senza un gate proprio, ne ha scritto uno che
il contratto a valle non sa leggere.

**Il documento è stato corretto**: ha una `## 0` con la riga `Gate: VERDE`, dice
quali cinque gate la sostengono, e ha la correzione della riga n°27 di §1, che
era falsa.

> ### La risposta alla domanda, che è una proposta e non una modifica di contratto
>
> **Un pacchetto trasversale deve scrivere un handoff?** Sì, e per una ragione
> che non è la simmetria: è il solo posto in cui un pacchetto che ha cambiato la
> **riga operativa** di altri agenti glielo dice. Il costo di P.4h per chi lancia
> la batteria E2E — due comandi invece di uno — non ha nessun altro posto dove
> stare che un handoff che gli altri leggono.
>
> **Cosa certifica la sua riga `Gate:`, se nessun gate lo copre?** Non «il
> pacchetto è corretto»: nessuno lo misura, e scriverlo sarebbe la firma di una
> macchina su se stessa. La formulazione che regge è più stretta e verificabile:
>
> > **i gate che questo pacchetto poteva far diventare rossi non lo sono
> > diventati**, sull'artefatto che consegna.
>
> Un pacchetto trasversale non ha un gate proprio, ma ha **sempre** un insieme
> non vuoto di gate che può rompere — altrimenti non ha toccato niente. Quello è
> il suo verdetto legittimo, **a condizione che il documento dica quali e li
> incolli**: senza l'elenco, «VERDE» è di nuovo prosa.
>
> **Proposta operativa**: la riga `Gate:` di un handoff trasversale sia sempre
> seguita, nello stesso paragrafo, dalla tabella dei gate rilanciati con il loro
> esito. È esattamente ciò che i documenti `14` e `15` fanno adesso, e non chiede
> nessuna modifica al gate di launchpad, che quella riga la legge già così com'è.

---

## 5. Il runbook, e perché è deliberatamente non firmato

`docs/deploy.md`, scritto dal modello della skill
(`agenti/launchpad/resources/templates/deploy.md`), seguendo la procedura
`piano` del `SKILL.md`.

**Contenuto oltre il modello:**

- **nomina n°4, n°12, n°17 per numero**, e ognuno ha una mitigazione con dei
  **numeri sui pannelli**, non una promessa: tetti per IP su
  `POST /rest/v1/rpc/crea_ordine` (10/min) e `ordine_per_codice` (30/min), il
  tetto di GoTrue su `/accedi` (5/min per IP), e per il n°12 la cancellazione di
  `X-Forwarded-Host` al bordo con la verifica `curl` da fare **dopo** il deploy;
- per ognuna è scritto **cosa la mitigazione NON copre**: il tetto per numero di
  telefono su `crea_ordine`, che nessuno dei due strati sa fare perché sta nel
  corpo; un ingresso DNS alternativo che scavalca il bordo e con esso la difesa
  del n°12; un attacco distribuito su un solo account, contro cui serve il
  secondo fattore, che questo progetto non ha;
- **una quarta voce che il gate non vede**: n°33, che non dichiara di bloccare e
  lo farebbe;
- **n°27**, aggiunta stasera: riaprirla l'ha rimessa fra i bloccanti, e il gate
  ha giustamente preteso che il runbook la nominasse;
- le tre variabili di produzione, tutte «prima della build», con il perché;
- **nessuna delle due stringhe vietate dal n°45**: `grep -c` → **0**;
- la `service_role` non compare in nessuna forma.

**Non firmato**, e §0 lo dice per esteso: la firma autorizza l'unico atto
irreversibile della pipeline e appartiene ad Alberto in persona
(`DECISIONI.md` §6); tre cose del documento — dominio, proprietà dell'account,
costi — non le sa nessun altro; e quattro bloccanti sono ancora aperti.

Il gate riporta:

```
FAIL  runbook firmato da un umano, sul contenuto
        provider: Vercel · dominio: https://fornodoro.it — PROPOSTO E NON REGISTRATO: nessuno lo possiede oggi, si verifica alla firma · modo: git
        firma: <NOME COGNOME> — <AAAA-MM-GG>
        sezioni presenti: variabili · pubblico · rollback · prescrizioni
        [block] Confermato da: segnaposto del template, non una firma
```

**È l'esito voluto.** Una nota sulla forma del segnaposto: si è usato `<…>` e
non le doppie graffe del modello, perché quelle avrebbero prodotto **due**
rifiuti — «segnaposto residui» sul documento intero *più* quello sulla firma — e
il primo avrebbe detto a chi legge il gate che il runbook è **incompleto**,
mentre è completo e **non firmato**. Sono due stati diversi e il gate deve poterli
distinguere. *(Costo secondario, misurato: la nota che spiega la scelta non può
nemmeno **citare** la forma a doppie graffe, perché il passo la conta ovunque
compaia — commenti inclusi. La regola è giusta.)*

**Il dominio dichiarato è `https://fornodoro.it` e non è registrato da nessuno**:
la riga lo dice a caratteri pieni. Il gate pretende un `https://` per poter
interrogare l'indirizzo dopo il deploy; ciò che non può pretendere è che esista,
e per questo la riga lo dichiara e la firma manca.

---

## 6. `generateBuildId` — la misura, e il verdetto

Il gate riportava `MANC impronta-artefatto`. **La correzione ovvia è stata
misurata prima di essere adottata**, perché P.5 ha già trovato che il proprio
frammento rompeva una build vera.

**Come**: `git clone --depth 1 file:///…/fornodoro` in una cartella temporanea,
`npm ci` (492 pacchetti, 33 s), `.env.local` copiato, `next build`, e
`cat .next/BUILD_ID`. *(Una prima prova con una **giunzione** verso il
`node_modules` del pilota è fallita e vale la pena scriverlo: Turbopack rifiuta
un `node_modules` che è un collegamento fuori dalla radice del progetto —
`Symlink [project]/node_modules is invalid, it points out of the filesystem
root`. L'installazione vera è più lenta e più fedele a ciò che fa un
fornitore.)*

### 6.1 Il candidato ovvio, e come muore

`generateBuildId: () => execSync("git rev-parse HEAD").toString().trim()`

| Condizione | Esito |
|---|---|
| clone `--depth 1`, con `.git` | `b3ebe8d1e90b116de7b6797725de5f315b8e47c1` = HEAD. **Funziona** |
| **senza** la cartella `.git` | **la build muore** |
| dentro **un altro repository** | scrive `78835ae4c3a165394c78964cd104f9b406a3d909`, **il commit di un repo estraneo** |

```
########## CANDIDATO A, senza la cartella .git ##########
    at generateBuildId (…/next.config.compiled.js:45:58) {
  status: 128,
  stderr: <Buffer 66 61 74 61 6c 3a 20 61 6d 62 69 67 75 6f 75 73 20 61 72 67 75 6d 65 6e 74 20 27 48 45 41 44 27 …>
}
BUILD_ID = cat: '…/.next/BUILD_ID': No such file or directory
```

La terza condizione è la peggiore delle tre e non era nel mandato: **non rompe
niente, e mente.** Un monorepo, o una cartella di lavoro che il fornitore
versiona, e l'artefatto dichiara con sicurezza un commit che non è il suo.

### 6.2 La forma adottata, e le quattro condizioni che sopravvive

Prima le tre variabili del fornitore — **con i nomi e l'ordine di launchpad**,
`WEBGUN_COMMIT` per prima perché è l'unica che una persona imposta a mano; poi
git, **ma solo se la radice che git dichiara è questa cartella**; poi `null`.

| Condizione | BUILD_ID | build |
|---|---|---|
| variabile del fornitore | lo sha passato | ok |
| clone `--depth 1` con `.git` | `b3ebe8d1e90b116d…` = HEAD | ok |
| senza `.git` | `s1MoOcbo3M1sIMx4GrHLV` (casuale) | ok |
| dentro un repository estraneo | `mwJiahdQV9ZB9gWD-COKV` (casuale) | ok |

Sul pilota, che è la radice del proprio repository:
`BUILD_ID = c60cee3e3ae2ae7c4a1f5a9b137b772f6d443c38`, uguale a HEAD, e il gate
riporta `OK l'impronta dell'artefatto e' derivata dal commit`.

**Verdetto: adottato.** Nessuno SHA letterale è stato scritto da nessuna parte —
è la condizione 3 travestita da configurazione.

### 6.3 La divergenza da launchpad, dichiarata al n°48

Il frammento di `impronta.mjs --scrivi` **solleva**. Il gate lo segnala come
`[issue]` e non `[block]`, quindi non impedisce niente.

**La motivazione scritta dentro `impronta.mjs` è d'accordo con la forma
adottata**, e vale la pena citarla:

> «Un ripiego silenzioso — per esempio uno SHA scritto come letterale — è peggio
> di un'impronta casuale: al commit successivo quel letterale è ancora lì e la
> build dichiarerebbe con sicurezza il commit SBAGLIATO. L'impronta casuale
> ammette di non sapere; questa afferma il falso.»

`null` **è** quell'impronta casuale. Il ripiego che la frase rifiuta è lo SHA
letterale, che qui non c'è. Sollevare aggiunge un terzo esito che la frase non
contempla — **la build non esiste** — e su un clone senza `.git` è l'esito che si
ottiene davvero. È in «Proposte a valle».

---

## 7. Proposte

### 7.1 Proposte per la direzione

1. **n°27: decidere fra le tre strade.** (i) lasciarla dichiarata, che è lo
   stato di oggi; (ii) toglierla da HEAD facendola generare a `seed-sviluppo` e
   leggere alla batteria da un file locale ignorato — costa la riscrittura di
   una **riga firmata** (`flussi-critici.md` §Ambiente, D14) e **non tocca la
   storia**; (iii) riscrivere la storia, l'unica che chiude il rosso del gate
   per intero e che **invalida ogni clone esistente**. Proposta: **(i) finché il
   repository resta in casa, (iii) prima del giorno in cui esce.** La (ii) da
   sola è la strada che sembra fare qualcosa e non chiude il rosso.
2. **n°46: il controllo in `next.config.ts`.** Chiuderebbe la voce davvero,
   perché `next build` valuta sempre quel file e nessun flag di npm lo salta.
   **Non fatto**: aggiunge un modo nuovo di non poter costruire, su un file che
   sta nel perimetro di `tsc` e di eslint, per una voce di gravità bassa la cui
   conseguenza misurata è **nulla** (n°32: su Node 20 la build riesce). La
   decisione è della direzione, non di un pacchetto.
3. **Il template di seed della skill (n°3) va aggiornato con la forma di oggi**,
   che è cambiata due volte in un giorno: non «dividere in tre», ma **(a)** in
   `sql_paths` solo i file applicabili ovunque, **(b)** il seed di sviluppo
   dietro uno script che rifiuta un bersaglio non locale, **(c)** la guardia in
   tre condizioni fail-closed dentro il file, **(d)** i test pgTAP che si
   costruiscono il proprio banco. I punti **(c)** e **(d)** sono quelli che
   nessun progetto indovina da solo — (d) in particolare si scopre solo
   *facendo* (a) e vedendo 22 test diventare rossi.
4. **La regola del `packageManager`** merita di salire nel template: la difesa
   di `min-release-age` è l'unica dei livelli del n°32 che **non sopravvive al
   cambio di gestore di pacchetti**, e il campo costa una riga.
5. **Un pacchetto trasversale scriva un handoff con la riga `Gate:` seguita
   dalla tabella dei gate rilanciati** — §4.4. Non chiede nessuna modifica di
   contratto a nessuno.
6. **Nota di metodo, sul collaudo che ha prodotto questo pacchetto.** Il difetto
   del n°27 era invisibile a ogni singola chat e visibile alla direzione perché
   solo lei tiene insieme handoff, registro e uscita di un gate. Vale la pena
   chiedersi se «una voce chiusa che il gate continua a segnalare» non debba
   essere un controllo **automatico**: il gate di launchpad conosce già sia i
   numeri chiusi nel registro sia i propri `[block]`, e potrebbe dire «n°27
   risulta chiusa e io la sto ancora bloccando». È materia di launchpad, e sta
   anche in §7.2.

### 7.2 Proposte a valle (launchpad, P.5-P2)

1. **La prescrizione del n°45 resta da implementare**: il gate di pubblicazione
   deve rifiutare un runbook che contenga `--include-seed` o `db reset --linked`.
   Il runbook scritto qui non contiene nessuna delle due (`grep -c` → 0), quindi
   quando la regola esisterà questo progetto la passerà.
2. **`generateBuildId`: il frammento prescritto solleva, e non dovrebbe** — §6.3,
   con le tre condizioni misurate. La forma proposta è quella adottata qui: tre
   variabili del fornitore, poi git **solo se la radice che dichiara è la
   cartella corrente**, poi `null`. Il controllo del gate
   (`non solleva quando il commit non e' risolvibile`) andrebbe cambiato di
   segno: ciò che va segnalato è **lo SHA letterale**, non il ripiego onesto.
   La difesa contro la risalita ai repository genitori è la parte che oggi manca
   sia al frammento sia al controllo, ed è quella che produce l'errore peggiore.
3. **Il passo `segreti` segnala la maschera di un altro gate.** Incollare
   l'uscita del gate della vetrina — che stampa l'indirizzo del database **già
   mascherato**, `postgres:***@` — produce
   `[block] password dentro l'autorita' di un URL: *** [3 caratteri]`. Il rilievo
   era mio e l'ho corretto elidendo l'autorità, ma il caso si ripeterà ogni volta
   che un handoff incolla l'uscita di un gate che maschera. Una sequenza di soli
   `*` (o `…`) nella posizione della password è, per costruzione, **non** una
   password. *Nota onesta: la mia correzione ha tolto quella riga da HEAD e le ha
   creato una voce nella **storia** — `@ fff715b`. Il passo la segnala ancora,
   giustamente, e questo è un piccolo caso di scuola di quanto costi una
   correzione dopo il commit.*
4. **Il passo `debito-bloccante` e il passo `segreti` non si parlano.** Il primo
   legge quali voci dichiarano di bloccare; il secondo trova segreti. Quando una
   voce risulta **chiusa** nel registro e il passo `segreti` sta ancora bloccando
   sul file che quella voce nomina, è esattamente il difetto che il collaudo
   della direzione ha trovato a mano su n°27. È un controllo che il gate ha già
   tutti i dati per fare.
5. **`Commit approvato:` non ammette l'assenza dichiarata.** Un runbook non
   ancora firmato non ha un commit approvato, e scriverne uno sarebbe approvare
   un contenuto che nessuno ha letto. Oggi l'unico modo di non prendere un
   `[block]` è **omettere la riga**, il che rende indistinguibili «non ancora
   approvato» e «dimenticato». Un valore riconosciuto — `non ancora` — li
   separerebbe.

---

## 8. Il gate di pubblicazione alla consegna

```
GATE LAUNCHPAD: ROSSO (3 falliti, 0 verifiche mancanti su 9 passi)
OK    si pubblica un commit, non un working tree
OK    verdetti dichiarati dagli agenti a monte
OK    bloccanti dichiarati nel registro del debito
FAIL  nessun segreto nel pacchetto che parte
OK    variabili d'ambiente dichiarate e non committate
OK    la build si rifa' uguale su un'altra macchina
OK    l'impronta dell'artefatto e' derivata dal commit
FAIL  runbook firmato da un umano, sul contenuto
FAIL  contratto d'uscita (handoff)
Non si pubblica. Ogni motivo dice di chi e': quasi nessuno e' di launchpad.
```

**Da 5 falliti + 2 mancanti a 3 falliti + 0 mancanti.** I tre che restano, e di
chi è ciascuno:

| Rifiuto | Di chi è | Perché non è di questo pacchetto |
|---|---|---|
| `segreti` | **della direzione** | è il n°27: la credenziale è in HEAD e in 5 punti della storia, e le tre strade sono decisioni sue |
| `runbook-firmato` | **di Alberto, in persona** | autorizza l'unico atto irreversibile della pipeline; il segnaposto è scritto apposta nella forma che il gate rifiuta |
| `contratto d'uscita` | **di launchpad (P.5)** | è l'handoff di launchpad, e un agente non firma il certificato di un altro |

I quattro passi portati dal rosso al verde: `verdetti`, `debito-bloccante`,
`ambiente`, `impronta-artefatto`.

---

## 9. Stato alla consegna, e cosa NON è stato fatto

**Pilota** — commit `c60cee3e3ae2`, ramo `master`, albero pulito. App viva sulla
**3621**, `BUILD_ID` uguale a HEAD. Stack Supabase **acceso** (api 7621, db
7622), unico stack acceso sulla macchina. Database allo stato di sviluppo
completo. Nessun `git add -A`, nessun `git add .`, nessun `commit -a`: tutto
messo in scena per nome, in dodici commit.

**Regia** — scritto **solo questo file**. Nessuna modifica a `agenti/launchpad`,
`agenti/site-doctor`, agli `scripts/` o agli `STATO.md` dei cinque agenti, a
`CANTIERE.md`, `README.md`, `DECISIONI.md`, `CLAUDE.md`, `HOWTORUN.md`,
`scripts/`. Le proposte per quei perimetri sono in §7.

**Non fatto, e dichiarato**: nessun deploy, nessun account, nessun dominio,
nessun DNS, niente pubblicato. La chiave `service_role` non è nel repository in
nessuna forma — l'unica cosa che il `grep` trova è il **nome del ruolo Postgres**
nelle migrazioni e nei documenti, mai un valore. `.env.e2e.local` resta ignorato
da git e launchpad lo riporta come `issue` e non `block`: è la forma voluta e non
è stata «corretta».

**Il residuo che chi legge deve avere in testa**: `password123` è ancora nel
repository e nella sua storia. Ciò che è cambiato oggi è che **non c'è più
nessun comando documentato che possa portarla su un database remoto**. Ciò che
non è cambiato è che chi ha clonato ce l'ha. Il n°27 è aperto e dice come si
chiude davvero.
