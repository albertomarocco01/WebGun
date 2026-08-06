# P.4g — Il pilota diventa pubblicabile: i due bloccanti e le minuterie

Verbale del pacchetto **P.4g**, eseguito il **2026-08-06** sul pilota
`C:\Users\Utente\Desktop\fornodoro` (pizzeria «Forno d'Oro»).
Modello: Opus 5, effort high. Regime **D14**: nessuna domanda al committente,
ogni scelta presa e motivata qui in testa.

---

## Le scelte autonome, e perché

| # | Scelta | Perché questa e non un'altra |
|---|---|---|
| 1 | **Il seed si separa in tre file, non si cancella** | Cancellare i due account avrebbe chiuso n°27 rompendo 22 test E2E. Il debito non era «esistono», era «il percorso di produzione legge lo stesso file di quello di sviluppo» |
| 2 | `sql_paths` con **tre nomi espliciti**, non un glob | Un glob fa entrare da solo in `db reset` qualunque file qualcuno lasci cadere in `supabase/seed/`. (Il tribunale ha poi mostrato che l'elenco esplicito non basta contro i **due comandi remoti** della CLI — n°45) |
| 3 | Il file di sviluppo si chiama **`90-solo-sviluppo.sql`** | Un file che si chiama come ciò che è. Il numero lo mette in fondo all'ordine, il nome lo dichiara, il riquadro in testa lo ripete |
| 4 | Il primo account di produzione lo crea uno **script**, non un file SQL | Una password in un file SQL è una password committata, comunque la si giri. Uno script la **genera** e la stampa una volta sola |
| 5 | Password **generata** per difetto, fornita solo se insistI | Passarla da variabile la lascia nella cronologia della shell. Il modo consigliato è non passarla affatto |
| 6 | `crea-titolare.mjs` usa la **chiave di servizio**, e sta in `scripts/` | `auth.users` non si scrive dal client, e da P.4f nemmeno `personale`. È la D2 dello Specchio del gestionale, firmata. `scripts/` è lo stesso confine di `prova-concorrenza.mjs`: fuori da `src/`, fuori da ogni bundle |
| 7 | La difesa del Node su **tre livelli**, ma **fuori** da `src/` e da `lint`/`type-check` | I cinque gate girano col node di sistema e non compilano il sito. Una difesa più in basso li avrebbe resi rossi per una versione di Node che per loro è irrilevante — la classe di errore del n°10 |
| 8 | La soglia del Node si **legge** da `package.json`, non si riscrive | Due posti che dichiarano lo stesso numero sono due posti che un giorno ne diranno due diversi |
| 9 | n°30 chiuso con **`.gitattributes`**, non con `core.autocrlf input` | La configurazione della macchina non viaggia col repo: chi clona altrove si riprende il difetto. `.gitattributes` è committato |
| 10 | **Niente `-diff`** su `package-lock.json` | La prima versione ce l'aveva, e dopo un `npm audit fix` `git diff --stat` stampava «Bin 291583 → 291638». Il file che dichiara quali versioni entrano nel progetto è l'ultimo posto dove nascondere un diff |
| 11 | n°20 **non** chiuso, con la misura di perché | `npm audit fix` lanciato davvero: rimuove due pacchetti, riscrive il lock, e lascia 2 high. Servirebbe un salto di major del linter. Lock ripristinato invece di lasciare una churn che non chiudeva niente |
| 12 | n°14 **attribuito**, non chiuso | Va chiuso insieme a n°29 e n°35 — tre facce dello stesso 500 — e tocca `src/middleware.ts`, che una regola dell'audit del gestionale sorveglia. Non è mezz'ora ed è di un'altra skill |
| 13 | **Dopo il tribunale**: `crea-titolare.mjs` si **rifiuta** su un account preesistente | «Idempotente» era la parola che nascondeva il difetto. In un flusso di provisioning «esiste già» non è un caso benigno: è la domanda *chi l'ha creato?*, e lo script non sa rispondere |
| 14 | **Dopo il tribunale**: n°44 e n°45 **dichiarati e non chiusi** | Togliere il file 90 da `sql_paths` li chiuderebbe, ma romperebbe il primo vincolo del mandato («`db reset` continua a produrre lo stesso stato») e il contratto del gate. È una decisione del direttore, non di un pacchetto di prerequisiti |
| 15 | **Docker Desktop riavviato** dopo la sua caduta | Il motore rispondeva 500 a ogni chiamata: lo stack era già giù per tutti. Riavviarlo restituisce, non toglie. Volumi intatti, dati sopravvissuti |

---

## 1. n°27 — il seed di produzione non porta account

### La forma scelta

```
supabase/seed/10-riferimento.sql    14 allergeni, 3 categorie          ogni ambiente
supabase/seed/20-locale.sql         menu, orari, 7 testi di sezione    ogni ambiente
supabase/seed/90-solo-sviluppo.sql  2 account password123, personale, 5 ordini finti   MAI
```

Percorso di produzione: `docs/PRODUZIONE.md` — migrazioni, i due file con
`psql -v ON_ERROR_STOP=1`, poi `node scripts/crea-titolare.mjs`.

### Le cinque cose che il mandato chiedeva di misurare

**(1) `supabase db reset` produce lo stesso stato di prima.**

```
Seeding data from supabase/seed/10-riferimento.sql...
Seeding data from supabase/seed/20-locale.sql...
Seeding data from supabase/seed/90-solo-sviluppo.sql...
WARNING (01000): SEED DI SVILUPPO IN CORSO: sto per creare titolare@fornodoro.it e
cucina@fornodoro.it con la password `password123`, che sta in chiaro in un file
committato. Se questo non e' un database di sviluppo, INTERROMPI e leggi
docs/PRODUZIONE.md.

conteggi (users/personale/voci/ordini/righe/contenuti/allergeni/legami/categorie/orari)
  linea di partenza:  2/2/11/5/8/7/14/17/3/7
  dopo la divisione:  2/2/11/5/8/7/14/17/3/7
  stati:  annullato:1 in_preparazione:1 pronto:1 ricevuto:1 ritirato:1   (identici)
```

**Rieseguibile a caldo, tre volte, senza `db reset` in mezzo** (P.4a l'aveva
provato tre volte: non è regredito):

```
  caldo 1: 2/2/11/5/8/7/14/17/3/7
  caldo 2: 2/2/11/5/8/7/14/17/3/7
  caldo 3: 2/2/11/5/8/7/14/17/3/7
```

E la batteria E2E: **22 passati, 0 falliti, 0 saltati** (§6).

**(2) Esiste un percorso di popolamento senza account cablati.** Misurato
davvero, non descritto: `sql_paths` puntato ai soli 10 e 20, `db reset`, e poi
`crea-titolare.mjs`.

```
=== lo stato di una macchina di PRODUZIONE appena popolata ===
allergeni|14      auth.users|0      categorie|3       contenuti_sito|7
orari_apertura|7  ordini|0          personale|0       voci_menu|11
  -> il dominio c'e', gli ACCOUNT NO.

=== il primo titolare ===
[1/2] account `rosa@fornodoro.it` su http://127.0.0.1:7621
      creato (id 245b5cd1-…), email gia' confermata.
[2/2] riga di `public.personale` per Rosa Amato, ruolo titolare
      creata (id 88ed538d-…).
  ┌───────────────────────────────────────────────────────────────────┐
  │  PASSWORD GENERATA — questa e' l'unica volta che la vedi.         │
  └───────────────────────────────────────────────────────────────────┘
      rosa@fornodoro.it
      <28 caratteri, non la incollo in un verbale>
fatto.                                                          EXIT=0
```

**E l'account entra davvero** — la lezione del n°3, un utente a metà che il
database considera perfetto:

```
POST /auth/v1/token?grant_type=password  (chiave ANONIMA)   HTTP 200
  access_token valido: true
  utente: nino@fornodoro.it | role: authenticated | aud: authenticated
con la password sbagliata:                                  HTTP 400
auth.identities: 1 riga per ogni account
last_sign_in_at: avanzato da NULL a 2026-08-06 11:32:16+00
```

**Idempotente**, rilanciato: `c'era gia' … non lo tocco, e non cambio la
password` · `la password generata in questo giro e' stata buttata via` · EXIT=0.

**(3) Nessuna password in chiaro sul percorso di produzione.**

```
$ grep -n "auth\.\|password\|encrypted_password" \
    supabase/seed/10-riferimento.sql supabase/seed/20-locale.sql
(nessuna riga)

$ git grep -n --name-only "password123"
docs/DEBITO-TECNICO.md          ← il registro, dove il debito è dichiarato
docs/PRODUZIONE.md              ← il runbook, che spiega perché è vietata
docs/flussi-critici.md          ← il contratto E2E, dove le credenziali dev sono firmate
docs/handoff/07,10,12,13        ← gli handoff, storici
e2e/helpers/auth.ts             ← la batteria: qui SERVE
scripts/crea-titolare.mjs       ← nell'elenco delle password VIETATE
supabase/seed/90-solo-sviluppo.sql  ← il file di sviluppo, che si chiama così
```

Nessuno dei file che la produzione legge. **Residuo dichiarato**: `password123`
resta negli oggetti di git (`git show <commit>^:supabase/seed.sql`) — nessuna
esposizione nuova, perché la stessa stringa è dichiarata in chiaro nell'albero
corrente, ma va detto perché la divisione non la faccia credere sparita.

**(4) Le credenziali di sviluppo restano dove servono e dichiaratamente di
sviluppo.** `e2e/helpers/auth.ts` è intatto; il file che le crea si chiama
`90-solo-sviluppo.sql` e ha in testa un riquadro che lo ripete.

**(5) `docs/flussi-critici.md` §Assunzioni resta vero.** La riga «in produzione
sarebbe una consegna di accessi, blocca il deploy» non lo era più: **correzione
scritta sopra la firma**, nella forma di `docs/gestionale.md` §12, con dentro
anche ciò che **non** è cambiato (nomi, password, UUID e conteggi identici,
nessuna spec toccata).

### La guardia, e i suoi limiti

`90-solo-sviluppo.sql` è **una transazione sola** e si rifiuta se il database ha
account o ordini che non sono i suoi. Sabotata su un database con un solo
account estraneo, **senza** il flag di `psql` (il caso che la prima versione
perdeva):

```
$ psql "$DB" -f supabase/seed/90-solo-sviluppo.sql          # senza ON_ERROR_STOP
BEGIN
ERROR:  seed di SVILUPPO rifiutato: questo database ha gia' 1 account e 0 ordini
        che non sono i suoi. […] Il percorso di produzione e' in docs/PRODUZIONE.md
ERROR:  current transaction is aborted, commands ignored until end of transaction block
  EXITCODE=0        ← psql mente ancora, ed è un fatto di psql
  dopo: auth.users=1  con password123=0  personale=0     ← ZERO SCRITTURE
```

Il codice d'uscita continua a mentire — quello è `psql` — ma **non entra
niente**, e prima entrava tutto.

---

## 2. n°32 — e la riga che c'era scritta era falsa

### Le due direzioni, come il mandato chiedeva

**Col node di sistema (20.12.2)** — `npm run build`:

```
> fornodoro@0.1.0 prebuild
> node scripts/controlla-node.mjs

  Node 20.12.2 non e' una versione su cui questo sito e' supportato.
  Serve Node >= 22.0.0 (package.json, campo "engines").
  […]
  COSA FARE — su questa macchina il Node 24 di scoop c'e' gia':
      export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"   # Git Bash
  NOTA per chi lancia i GATE: i cinque gate girano col node di sistema e non
  compilano niente. Questo controllo non li tocca.
EXITCODE=1              ← `next build` non è mai partito
```

`npm install`, con `.npmrc` `engine-strict=true`:

```
npm ERR! code EBADENGINE
npm ERR! notsup Required: {"node":">=22.0.0"}
npm ERR! notsup Actual:   {"npm":"10.5.0","node":"v20.12.2"}
EXITCODE=1
```

**Col Node 24.18.1**:

```
[node] v24.18.1 >= 22.0.0 dichiarato in package.json: si procede.
✓ Compiled successfully in 11.4s
  Finished TypeScript in 11.0s
BUILD_ID=vhj8fi1hxQrFTJFWHKPlb                              EXIT=0
```

### E poi il tribunale ha falsificato la premessa

Il debito diceva: «su Node 20 la **build fallisce**». **Nessuno l'aveva mai
provato** — la riproduzione dell'anello 13 era un `node -e` nudo. Misurato:

```
$ env PATH="/c/Program Files/nodejs:…" npx --no-install next build
⚠️  Node.js 20 and below are deprecated … Please upgrade to Node.js 22 or later
✓ Generating static pages using 15 workers (17/17)
17 rotte                                                    EXIT=0

$ grep -l Margherita .next/server/app/menu.html      → trovato
$ grep -l "Oggi esaurita" .next/server/app/menu.html → trovato
$ grep -l "Rosa e Nino" .next/server/app/chi-siamo.html → trovato
```

La build riesce **e i dati veri ci sono dentro**. La causa:

```
$ node -p "typeof globalThis.WebSocket"                                 → undefined
$ node -e "require('next/dist/server/node-environment.js'); …"          → function
```

`next/dist/server/node-environment.js` — che Next carica in **ogni** worker di
build e di server — installa un `WebSocket` globale. Dentro Next, `supabase-js`
non solleva mai.

**Cosa resta vero**, e perché la difesa rimane: il fornitore dichiara Node 20
deprecato e non supportato, e la `websocket-factory` solleva davvero fuori dal
polyfill (uno script di `scripts/`, un `instrumentation.ts`, un job). «Funziona
per via di un polyfill del framework» non è una versione supportata. Ma **n°32
non ha mai bloccato il deploy**, la sua gravità reale è bassa, e la riga è stata
riscritta in `docs/DEBITO-TECNICO.md`, in `scripts/controlla-node.mjs`, in
`.npmrc` e nel messaggio d'errore.

### Il confine che il mandato vietava di superare

I gate non sono toccati. Verificato col `PATH` forzato al solo node 20:

```
npx --no-install tsc --noEmit        → EXIT 0
npx --no-install eslint .            → EXIT 0
npx --no-install prettier --check .  → EXIT 0
```

---

## 3. Le minuterie

**n°30, i fine-riga.** `.gitattributes` con `* text=auto eol=lf`.

```
PRIMA:  sette file tracciati CRLF sul disco con `git status` PULITO
        (.sqlfluff, docs/DEBITO-TECNICO.md, docs/handoff/12, docs/performance.md,
         squawk.toml, supabase/config.toml, cj_cucina.txt)
        e ogni `git add` stampava
        «warning: LF will be replaced by CRLF the next time Git touches it»

DOPO:   `git add --renormalize .`  → nessun diff (l'indice conteneva già LF:
                                     non è cambiato un byte di contenuto)
        `git add`                  → nessun avviso
        tre file cancellati e `git restore`  → tutti e tre LF
        zero file CRLF su 135 tracciati, albero pulito
```

**n°42, `tsconfig.tsbuildinfo`** — 145 903 byte di cache di `tsc --incremental`
in ogni diff. `.gitignore` + `git rm --cached`: `git ls-files --error-unmatch` →
«Did you forget to 'git add'?», e il file è ancora sul disco.

**n°43, `cj_cucina.txt`** — un cookie jar di curl, tracciato dal commit `2cd20bf`
(il tribunale del gestionale). Questo era vuoto; un cookie jar pieno è una
sessione viva committata. Pattern `cj_*.txt`/`cookies*.txt` in `.gitignore`,
accanto a `e2e/.auth/` e con la ragione scritta.

**n°9, `gitleaks`** — chiuso **dalla regia**, che l'ha installato: `code-maniac
scan` da questa radice stampa `[ OK ] Segreti (gitleaks)` dove il 2026-08-05
stampava `[SKIP] non installato`. Qui solo verificato e datato.

**n°20, `npm audit`** — **non chiuso, con la misura di perché**: `npm audit fix`
lanciato davvero rimuove due pacchetti, riscrive il lock di 55 byte e lascia
**2 high**. La prima `eslint-plugin-sonarjs` sana è la **4.2.0**, cioè un salto
di major del linter di tutto il progetto. Lock ripristinato.

**n°2, il gate che non distingue i ruoli** — la metà di **progetto** è coperta
dall'anello 12 e va scritto: `titolare-negato-cucina` porta la sessione della
cucina su tutte e cinque le rotte del titolare e asserisce 307 **più il corpo
servito**; `scrittura-menu-negata-cucina` invoca la server action con i cookie
veri. Una guardia declassata da «sei il titolare?» a «sei autenticato?» le fa
diventare rosse. La cecità del gate resta della regia.

---

## 4. Il tribunale — quattro esperti, tredici rilievi, e due che mi riguardano

`/code-inquisition --focus security` sul percorso del seed. Roster: confine
seed dev/prod (opus) · IAM Supabase e chiave di servizio (opus) · igiene dei
segreti (sonnet) · catena di fornitura e toolchain (sonnet) · più un critico del
roster (haiku). Ha trovato qualcosa, come nei cinque anelli precedenti — e
stavolta ha trovato **il difetto peggiore dell'intero pacchetto**.

### F1 — lo script consegnava il gestionale a chi si registrava per primo

Riprodotto end-to-end dall'esperto IAM. Tre mosse:

1. `[auth] enable_signup = true` + `enable_confirmations = false`: chiunque, con
   la sola **chiave anonima che sta nel bundle**, fa `POST /auth/v1/signup` su
   `rosa@fornodoro.it` — un indirizzo prevedibile, **che stava nel mio esempio**.
2. Chi pubblica lancia lo script: *«c'era già, non lo tocco»* → poi gli crea la
   riga di `personale` con `ruolo = 'titolare'`. Uscita **0**, «fatto.».
3. L'attaccante entra come titolare **con la propria password**.

«Idempotente» era la parola che nascondeva il difetto. **Corretto**, e
l'attacco rifatto contro la correzione:

```
1. POST /auth/v1/signup (chiave anonima)                    HTTP 200
2. la procedura §3 alla lettera su quell'indirizzo:
   crea-titolare: esiste gia' un account per `…` (id 3bc12480-…, creato il
   2026-08-06T12:26:21Z) e non l'ho creato io.
     NON gli do il ruolo di titolare, ed e' voluto: non ho modo di sapere chi
     ha scelto quella password. […]
   EXIT=1
3. righe di personale per quell'account: 0
```

L'unica eccezione è lo **stato a metà** (account creato, `personale` no, perché
il giro precedente è morto in mezzo): lì la password non era mai stata
consegnata a nessuno, quindi il rilancio la reimposta e la ristampa — senza,
quell'account sarebbe un titolare irraggiungibile (rilievo **F2**, misurato).
Provato: percorso felice, rilancio idempotente, riparazione dello stato a metà,
tutti e tre verdi.

### Gli altri rilievi accolti e chiusi

| id | Cosa | Come è chiuso |
|---|---|---|
| **S3** | la guardia sollevava, e `psql` **proseguiva** eseguendo gli `insert`, uscendo 0 | il file è `begin`…`commit`: misurato, zero scritture anche senza il flag |
| **S4** | `on conflict (id)` non copriva le chiavi naturali UNIQUE: una voce cancellata dal pannello e ricreata faceva morire il seed **a metà** | `on conflict` sulle chiavi naturali, e i legami degli allergeni per `(codice, slug)` con una join. Misurato: il seed arriva in fondo |
| **S5** | due delle quattro verifiche di §5 non potevano fallire, e una era cieca perché il mio esempio usava **nome e telefono della persona finta del seed** | un comando solo che esce non-zero, e guarda la **password** (`crypt('password123', …)`) invece di una denylist di due email. Provato rosso su sviluppo, verde su una produzione corretta |
| **F3** | `SUPABASE_URL` non validata: la chiave di servizio partiva verso qualunque host, anche in chiaro | `indirizzoAccettabile()`: `https` obbligatorio fuori da loopback. Otto casi provati |
| **SEG-1** | la chiave di servizio sulla riga di comando → cronologia della shell ed elenco processi, e il documento avvertiva **solo per la password** | `.env.produzione.local` (ignorato) letto con `loadEnvFile`, come già fa `playwright.config.ts` |
| **SC-1** | la premessa di n°32 | §2 |
| **SC-4** | il commento su `min-release-age` diceva «non si installa»: in realtà **sostituisce in silenzio** su richieste a intervallo | commento corretto in `.npmrc` |

### I quattro rilievi dichiarati e non chiusi — voci nuove del registro

| # | Cosa | Perché non è chiuso |
|---|---|---|
| **44** | la guardia **non copre una produzione appena creata**: lì `auth.users` e `ordini` sono vuote come dopo un `db reset` | **Non esiste nessun segnale in Postgres che distingua i due casi.** Provato anche col privilegio: `current_user` è `postgres` e `rolsuper` è **falso** anche in locale, identico a Supabase ospitata. Chiuderlo vorrebbe dire togliere il file 90 da `sql_paths`, che rompe il **primo vincolo del mandato** e il contratto del gate |
| **45** | `sql_paths` **è** l'elenco che `db push --include-seed` e `db reset --linked` applicano a un progetto remoto | Chiuso per quanto un documento può: i due comandi sono vietati **per nome** in `docs/PRODUZIONE.md` §2. Una difesa di prosa non ferma un dito |
| **46** | `engine-strict` si spegne con `--no-engine-strict` o `npm_config_engine_strict=false` | Dichiarato in `.npmrc`. Una via è stata **esclusa misurandola**: un `.npmrc` utente/globale non vince su quello di progetto |
| **47** | `min-release-age` non esiste per pnpm/yarn/bun, e `pnpm` è già installato su questa macchina | `packageManager` + corepack lo chiuderebbe, ma rompe chi usa pnpm di proposito: decisione della regia |

---

## 5. Un difetto della skill, e una nota per la regia

**Il template del seed di schema-forge produce un file solo** (n°3, terza voce).
Ogni progetto generato nasce quindi con le credenziali di sviluppo nello stesso
file che qualcuno un giorno riuserà per popolare un ambiente vero. La forma di
qui — `10-riferimento` / `20-locale` / `90-solo-sviluppo` con guardia e
transazione — dovrebbe **essere il template**, non una correzione che ogni
pilota rifà da capo. Aggiunto alla riga n°3 del registro del pilota; la riga in
`agenti/schema-forge/STATO.md` la scrive il proprietario della skill.

**`.gitattributes`, stessa forma.** n°30 si è avverato due volte su questo
pilota. Il template dovrebbe nascere con quel file, altrimenti il difetto
rinasce a ogni progetto — già segnalato in `agenti/flow-sentinel/STATO.md`.

---

## 6. I gate — sulla build `vhj8fi1hxQrFTJFWHKPlb`

Tutti e cinque rilanciati da me, dopo `rm -rf .next && npm run build` col Node 24
e riavvio dell'app sulla 3621.

```
schema-forge   VERDE (0 falliti, 0 mancanti su 9 passi)   — 7 migrazioni + seed, pgTAP 5 file
flow-sentinel  VERDE (0 falliti, 0 mancanti su 7 passi)   — 13 spec · 22 passati, 0 falliti, 0 saltati
gestionale     VERDE (0 falliti, 0 mancanti su 7 passi)   — 11 rotte, 7 azioni, 0 issue 0 warn
vetrina        VERDE (0 falliti, 0 mancanti su 10 passi)  — build id vhj8fi1hxQrFTJFWHKPlb
speed-demon    VERDE (0 falliti, 0 mancanti su 7 passi)   — 5 pagine, 3 giri, seo 100±0 su tutte
```

speed-demon lanciato con `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`:
la categoria SEO ha un punteggio (100 su tutte e cinque le pagine) invece di
restare `null`, che è il difetto n°31.

`code-maniac scan`: **0 passi con problemi**, 1 saltato (`Convenzioni di
progetto`, script custom non installato). `gitleaks` **OK** — non più `SKIP`.
Nel primo giro `semgrep` aveva alzato un rilievo su un file appena creato da me
(`.npmrc` senza `min-release-age`): aggiunto, scan di nuovo pulito.

**Una caduta, e va scritta.** Durante un `db reset` di validazione **Docker
Desktop è caduto**: motore a 500 su ogni chiamata all'API, 3,5 GB liberi su 16
con tre altre chat vive. Recuperato con arresto dei processi Docker,
`wsl --shutdown` e riavvio; i volumi sono sopravvissuti e i conteggi erano
intatti. È la regola del `CLAUDE.md` — **un solo stack alla volta** — che si
avvera per la seconda volta su questa macchina.

---

## 7. Cosa resta fra il pilota e il suo pubblico

Onesto, che sia mio o di altri.

**Bloccanti veri, tutti fuori dal codice del pilota:**

| # | Cosa | Di chi |
|---|---|---|
| **4** | nessun tetto ai tentativi sulle due RPC pubbliche: 30 `crea_ordine` in 1,36 s tutte 200, e il codice di ritiro ha 24 bit | runbook del proxy, **P.5** |
| **17** | nessun tetto ai tentativi su `/accedi` | runbook del proxy, **P.5** |
| **12** | la difesa CSRF di Next si fida di `X-Forwarded-Host`: l'edge deve sovrascriverlo | runbook del proxy, **P.5** |
| **33** | `NEXT_PUBLIC_SITO_URL` **prima** di `next build`, o `robots.txt` e `sitemap.xml` restano congelati su `127.0.0.1` per sempre | runbook di deploy, **P.5** |

**Cose che il committente deve decidere prima del rilascio:**

- **n°5** — nessuna via di anonimizzazione dei dati personali del cliente. Nome
  e telefono di chi ordina restano per sempre.
- **n°34** — la `description` di quattro pagine su cinque sparisce se il
  titolare svuota lo slot. Serve una rete sotto il contenuto, o una validazione
  nel gestionale.
- **n°44** — se si vuole che il seed di sviluppo sia **irraggiungibile** e non
  solo vietato, va tolto da `sql_paths`: cambia la riga operativa del
  `CLAUDE.md`, il gate di schema-forge e l'handoff 12.

**Cose che nessuno possiede ancora:**

- **n°13** — nessuna Content-Security-Policy. Serve un `nonce`, quindi un
  middleware: è **site-doctor** o cyber-shield, e nessuno dei due esiste.
- **n°14 + n°29 + n°35** — i 500 di Next dove andrebbe un 4xx. Tre facce della
  stessa cosa, da chiudere insieme, di `vetrina-crafter`.
- **n°36** — la prova di concorrenza non gira in nessun gate. Lacuna della skill
  schema-forge, già nel suo `STATO.md`. **Chi tocca `personale` lancia a mano
  `node scripts/prova-concorrenza.mjs`.**

**Cose della regia:** n°10 (due Node sulla stessa macchina), n°20 (il salto di
major del linter), n°31 (speed-demon deve lanciare Lighthouse con Node ≥ 22 —
adesso può leggere la soglia da `engines`), n°3 e n°30 (i due template),
n°46 e n°47.

**Quello che il pilota può dire di sé, misurato**: lo schema regge gli attacchi
che dichiara di reggere (82 asserzioni pgTAP, ognuna sabotata), i tredici flussi
critici passano dal browser contro un database vero, le cinque pagine pubbliche
sono a 99-100 su quattro categorie Lighthouse, e da oggi **non c'è nessuna
credenziale sul percorso che porta il sito in produzione**.

---

## Riga finale

**P.4g consegnata.** Il bloccante n°27 è chiuso con la misura (seed diviso in
tre, percorso di produzione senza account e con la password generata, cinque
misure incollate); il bloccante **n°32 è chiuso, ma la sua premessa era falsa e
l'ho misurata falsa** — `next build` su Node 20 esce 0, e quel debito non ha mai
bloccato il deploy: resta la difesa, con la ragione vera. Le minuterie chiuse
sono **cinque** (n°30, n°42, n°43, più n°9 chiusa dalla regia e n°2 coperta a
metà) e **quattro** attribuite (n°14, n°20, n°36, n°31). I cinque gate del filo
sono verdi sulla build `vhj8fi1hxQrFTJFWHKPlb`, con 22 test E2E e scan pulito.
**Il debito è passato da 41 voci (3 chiuse) a 47 voci (9 chiuse)**: il registro è
cresciuto, perché il tribunale ha aperto **quattro voci nuove su cose che questo
stesso pacchetto aveva appena scritto** — e quattro voci vere dichiarate valgono
più di un registro che si accorcia.
