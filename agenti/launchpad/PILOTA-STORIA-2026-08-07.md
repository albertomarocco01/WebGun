# Verbale — P.4k, la storia pulita e il seed senza password (pilota `fornodoro`)

Pacchetto **P.4k**, 2026-08-07, mandato della direzione **D24**. Chat operaia
sola sul pilota e sulla regia, come il mandato impone: questo pacchetto riscrive
la storia di git, e un commit concorrente su riferimenti vecchi è l'unico modo di
farsi male.

**Esito in una riga:** la credenziale del n°27 è uscita da HEAD **e dalla
storia**, prima di qualunque `git push`; il passo `segreti` di launchpad è
passato da **10 bloccanti a zero**; il gate di pubblicazione è **ROSSO 2**, e i
due rossi sono quelli attesi — la firma di un umano sul runbook e l'handoff di
launchpad, che nasce con la pubblicazione.

> **Attenzione a chi cita questo verbale.** Gli hash del pilota nominati dai
> verbali precedenti — `05cf644`, `8c87400`, `33d787c`, `fff715b`, `22fff27`,
> `e428a21`, `f2a4aa7`… — appartengono alla **storia pre-riscrittura**, quella
> conservata nei due bundle. Non si risolvono più nel repository. Restano atti
> storici, e **per questo i verbali chiusi non sono stati riscritti**.

---

## 1. Che cosa c'era, misurato prima di toccare

Corsa del passo `segreti` di launchpad sul pilota, la mattina del 2026-08-07,
prima di qualunque modifica:

```
SEGRETI: 10 BLOCCANTI (1 da guardare)
  151 file tracciati letti · 0 nuovi non ancora tracciati · 0 binari non letti
  4 file ignorati guardati (partono solo con un deploy da CLI)
  435 pezzi di storia (file x commit, piu' i messaggi di commit e di tag) letti · 6 famiglie cercate
```

Dieci rilievi su **sei posizioni**, per due famiglie:

| Famiglia | Dove | Quanti |
|---|---|---|
| `credenziale-sql` | `supabase/seed/90-solo-sviluppo.sql:226` **(HEAD)** | 1 |
| `credenziale-sql` | `supabase/seed/90-solo-sviluppo.sql @ 2a7291d` · `@ 967f2b4` (×2) | 3 |
| `credenziale-sql` | `supabase/seed.sql @ b1df957` (×2) | 2 |
| `url-con-credenziali` | `docs/deploy.md @ d4dcb2b` (×2) · `docs/DEBITO-TECNICO.md @ 710f9f0` · `docs/handoff/08-vetrina-crafter.md @ fff715b` | 4 |

Più un `[issue]` su `.env.e2e.local`, che è **ignorato da git**: non è storia,
non si riscrive, e parte solo con un deploy da CLI. Resta, ed è dichiarato.

## 2. I due paracadute

Il bundle preesistente c'era già; il mandato ne chiedeva un secondo, datato al
giorno della corsa. Sono entrambi **fuori dal repository**, sul Desktop, e
**contengono la credenziale**: sono la storia di prima, e quello è il loro
mestiere.

```
C:\Users\Utente\Desktop\fornodoro-storia-pre-riscrittura-2026-08-07.bundle       (preesistente)
C:\Users\Utente\Desktop\fornodoro-storia-pre-riscrittura-2026-08-07-P4k.bundle   (fatto oggi, PRIMA di riscrivere)
```

`git bundle verify` sul mio, dopo la riscrittura:

```
The bundle contains these 2 refs:
f2a4aa7469742294f3b6d4a10f935616a264710c refs/heads/master
f2a4aa7469742294f3b6d4a10f935616a264710c HEAD
The bundle records a complete history.
The bundle uses this hash algorithm: sha1
…-P4k.bundle is okay
```

Anche il preesistente rilanciato: `The bundle records a complete history. …
is okay`.

## 3. Punto 1 — il seed senza password cablata (commit `19e0c7c`)

**La forma scelta**, fra le due che il mandato lasciava aperte: **un file locale
gitignorato, senza `.example` accanto**. La ragione è misurata e non estetica —
il passo `segreti` di launchpad tratta come `block` **non derogabile** qualunque
percorso che combaci con `(^|[/\\])\.env(\.|$)` e non sia esattamente
`.env.example|sample|template|dist` (`segreti-lib.mjs`, `eFileAmbienteTracciato`).
Un file `.env.sviluppo.local.example` sarebbe stato un `.env` tracciato per la
regola sul nome, cioè un rosso strutturale creato per fare l'esempio. L'esempio
sta dove non può divergere: **nel messaggio d'errore che il comando stampa** se
la fonte manca, e in tre righe di prosa in `README.md` e in `.env.example`.

**La fonte è una sola**: `.env.sviluppo.local`, chiave `PASSWORD_SVILUPPO`,
aggiunta a `.gitignore` con il motivo scritto accanto. La leggono, dalla stessa
riga:

- `scripts/seed-sviluppo.mjs`, che la passa al seed in **`PGOPTIONS`** e non
  sulla riga di comando — un argomento sta nell'elenco dei processi di tutta la
  macchina e nella cronologia della shell;
- `playwright.config.ts`, che la passa a `e2e/helpers/auth.ts`.

Due copie sarebbero due account che divergono al primo che ne cambia una, e il
rosso che ne esce direbbe «credenziali non valide» invece di «avete due fonti».

**Il seed ha una quarta guardia.** `90-solo-sviluppo.sql` non contiene nessuna
password: la riceve dalla GUC `fornodoro.password_sviluppo`, e se manca, è vuota
o è più corta di otto caratteri **rifiuta**. Nessun valore di ripiego, nemmeno
casuale: un default silenzioso sarebbe la password committata con un nome
diverso. I messaggi dicono **quanto** è lunga, mai **cosa** dice — un `raise`
finisce nel log del database.

### Le misure, tutte rifatte oggi

| Cosa | Comando | Esito |
|---|---|---|
| applicazione vera | `npx supabase db reset && npm run seed-sviluppo` | `INSERT 0 2` ×3, `INSERT 0 5`, `INSERT 0 8`, `COMMIT` · uscita **0** |
| i due account aprono | `POST /auth/v1/token?grant_type=password` con la password nuova | **HTTP 200** per `titolare@` e per `cucina@` |
| la vecchia non apre più | stesso endpoint con la password di ieri | **HTTP 400** |
| sabotaggio 1 — fonte assente | `.env.sviluppo.local` spostato, poi `node scripts/seed-sviluppo.mjs` | uscita **2**, database intatto, e il messaggio nomina il file da scrivere |
| sabotaggio 2 — GUC assente col consenso presente | `PGOPTIONS="-c fornodoro.seed_sviluppo=…" psql -f 90-solo-sviluppo.sql` | **`P0001`**, transazione abortita, **nessuna scrittura** |

Uscita del sabotaggio 2, per intero:

```
BEGIN
psql:supabase/seed/90-solo-sviluppo.sql:247: ERROR:  seed di SVILUPPO rifiutato: la password di
sviluppo non e' arrivata, o e' piu' corta di 8 caratteri (ne ho ricevuti 0). Dal 2026-08-07 questo
file NON contiene nessuna password: la riceve dalla GUC `fornodoro.password_sviluppo`, che imposta
`npm run seed-sviluppo` leggendola da `.env.sviluppo.local` (ignorato da git). Non esiste un valore
di ripiego, ed e' il punto: un default silenzioso sarebbe una password committata che si e' spostata
di posto.
```

### Quello che il punto 1 ha toccato oltre al seed

- `scripts/crea-titolare.mjs`: la vecchia password **esce dalla lista delle
  vietate** e ci rientra come **impronta sha256** — riscriverla in un elenco di
  cose vietate sarebbe rimetterla in un file tracciato dopo averla tolta dalla
  storia. Rifiuta in più la password di sviluppo di oggi, se `PASSWORD_SVILUPPO`
  è nell'ambiente: un titolare vero non si apre con la parola che apre ogni
  banco di prova della casa.
- **40 occorrenze in 13 documenti** riallineate da «c'è e blocca» a «c'era,
  tolta il 2026-08-07, fonte locale non tracciata»: `CLAUDE.md`, `README.md`,
  `docs/PRODUZIONE.md`, `docs/deploy.md`, `docs/flussi-critici.md`,
  `docs/DEBITO-TECNICO.md` e sette handoff. Il conteggio dopo: **zero**
  occorrenze in HEAD, misurato con `git grep`.
- `docs/flussi-critici.md` prende la **quarta correzione sopra la firma**, con la
  stessa forma delle tre precedenti: cosa non cambia (i due account, gli UUID, i
  conteggi, 22/22), cosa cambia (una riga: la password arriva da fuori), e la
  sola cosa nuova per chi lancia la batteria.
- `docs/PRODUZIONE.md` §5: il controllo «nessun account apre con la password di
  sviluppo» non poteva più contenere la password. Adesso la prende da
  `PASSWORD_SVILUPPO` e **si ferma se è vuota** — un `crypt` contro una stringa
  vuota tornerebbe zero righe, cioè un verde che non ha guardato niente.

> **Deroga dichiarata.** `docs/deploy.md` è vietato agli agenti (D20) ed è stato
> modificato: il mandato P.4k lo prescrive per nome («deploy.md §percorso di
> produzione») ed è la sua materia — §0-bis parla solo di questo. Le modifiche
> sono tre: §0-bis punto 2, la riga n°27 del riquadro dei bloccanti, e §a).
> Nessuna sezione del runbook operativo è stata toccata, e la **firma non è
> stata avvicinata**: resta il segnaposto del template, che è il rosso di Alberto.

`tsc --noEmit` e `eslint` puliti prima del commit.

## 4. Punto 2 — la riscrittura della storia

Strumento: **`git-filter-repo` 2.47.0**, installato con `pip install
git-filter-repo` (non era sulla macchina). `--force` perché il repository non è
un clone appena fatto — ed è esattamente il motivo per cui i bundle si fanno
prima.

### La trappola che ha deciso la forma delle espressioni

`--replace-text` **non applica le espressioni nell'ordine del file**: applica
prima **tutte** le letterali e poi le regex (`git_filter_repo.py`,
`apply_replace_text`, righe 2964-2970). E il `***RIMOSSO***` che il mandato
suggerisce, messo dentro `crypt('…')`, **resta un bloccante**: la famiglia
`credenziale-sql` cerca `crypt\s*\(\s*'([^']{3,})'` e — a differenza della
famiglia degli URL — **non chiama `eSegnaposto`**. Sostituire e basta avrebbe
lasciato cinque `block` su cinque, con un nome diverso.

Quindi: **solo espressioni `regex:`**, così l'ordine è quello del file, e la
prima rompe la forma che la famiglia cerca.

```
regex:crypt\(\s*'<CREDENZIALE>'==>crypt(:'RIMOSSA_DALLA_STORIA_2026_08_07'
regex:postgresql://postgres:<TRE ASTERISCHI>@127\.0\.0\.1:7622/postgres==>postgresql://postgres:…@127.0.0.1:7622/postgres
regex:<CREDENZIALE>==><la stringa di rimozione>
```

> **`<CREDENZIALE>` e `<TRE ASTERISCHI>` sono elisi qui, e non è pignoleria.**
> Sono i due valori che questo pacchetto ha appena tolto dalla storia del pilota:
> scriverli in un verbale della **regia** — che è a sua volta un repository
> tracciato — vorrebbe dire toglierli da una storia e metterli in un'altra. È il
> difetto del n°56 al secondo giro, e la prima stesura di questo file **ci è
> cascata**: il passo `segreti` lanciato sulla regia ha alzato un `block` sulla
> riga dell'URL, tre righe sopra il §9 che quella lezione la scrive. Corretto
> rilanciando il gate, non rileggendo il file. Chi deve rifare la corsa legge il
> primo valore dalla storia conservata nei bundle; il secondo sono tre asterischi
> ed è già scritto in prosa qui sopra.

- **Prima riga.** Tutte e sette le occorrenze storiche dentro `crypt(…)` erano
  della forma `crypt('…', gen_salt('bf'))` o `extensions.crypt('…',
  extensions.gen_salt('bf'))`: una regex sola le copre. Il risultato,
  `crypt(:'RIMOSSA_DALLA_STORIA_2026_08_07', …)`, dice cosa è successo senza
  fingere un progetto che allora non c'era.
- **Seconda riga.** La «password» del n°56 sono **tre asterischi**, cioè il
  mascheramento che il gate della vetrina stampa da solo. Si sostituisce con
  l'autorità **elisa** (`…@`), che è la forma che P.4h aveva già dato a HEAD: i
  puntini di omissione il passo `segreti` li assolve per iscritto
  (`SEGNAPOSTO`, `/^(?:\.{3,}|…)/`), i tre asterischi no.
- **Terza riga.** Il residuo, che a quel punto sta solo in commenti e prosa.

**Anche i messaggi di commit**, con un file separato: `--replace-text` non li
tocca (serve `--replace-message`), e tre righe di messaggi nominavano la
credenziale e l'URL. Lì la sostituzione è in prosa — «la password nota» — perché
un `***RIMOSSO***` in mezzo a una frase non si legge.

### La corsa

```
Parsed 71 commits
HEAD is now at 19e0c7c La password di sviluppo esce dai file tracciati, e il seed la pretende da fuori
New history written in 0.62 seconds; now repacking/cleaning...
Completely finished after 1.45 seconds.
```

**Verifiche subito dopo:**

| Cosa | Esito |
|---|---|
| commit prima / dopo | **71 / 71** — nessuno perso, nessuno svuotato |
| la credenziale nei blob di tutta la storia | **zero** (`git rev-list --all` × `git grep -l`) |
| la credenziale nei messaggi | **zero** |
| autorità con i tre asterischi nella storia | **zero** |
| date | **conservate** — il primo commit resta `2026-08-04T21:54:50+02:00` |
| albero di lavoro | pulito |
| `git remote -v` | **vuoto**: l'innesco di D24 non è mai scattato |
| file ignorati (`.env.*`, junction `.claude/skills/`) | tutti sopravvissuti |

## 5. Punto 3 — le prove

### 5.1 `git log --oneline -5`

```
b462079 I due gate riconfermati anche sull'artefatto consegnato, e la citazione lo dice
07e4d27 n°27 e n°56 chiuse col gate in mano, e i due handoff scaduti riconfermati
19e0c7c La password di sviluppo esce dai file tracciati, e il seed la pretende da fuori
d5403bc La settima pagina entra nel contratto, per delega esplicita del committente
60441e5 Gli otto handoff riconfermati dalla direzione, coi gate rilanciati
```

I due commit in fondo sono i vecchi `f2a4aa7` e `33d787c` riscritti: stesso
messaggio, stessa data, hash nuovo.

### 5.2 Il passo `segreti`, stesso comando prima e dopo

```
prima:  SEGRETI: 10 BLOCCANTI (1 da guardare)
dopo:   SEGRETI: nessun bloccante (1 da guardare)
        151 file tracciati letti · 0 nuovi · 0 binari · 5 ignorati guardati · 0 NON letti
        storia: 462 pezzi (file x commit, piu' i messaggi) letti dagli ultimi 200 commit
        [issue] .env.e2e.local: 3 rilievi in un file IGNORATO da git
```

L'unico rilievo che resta è quello dichiarato dal mandato. Il quinto file
ignorato è `.env.sviluppo.local`, che **non produce nulla**: venti caratteri
stanno sotto la soglia della famiglia a entropia, che ne vuole trentadue.

### 5.3 `supabase db reset` + seed + batteria E2E

`GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)` — rilanciato
due volte, sulla build del commit di codice e di nuovo sull'artefatto
consegnato:

```
OK    app viva e database del progetto
        app: http://127.0.0.1:3621 (HTTP 200) · database: postgresql://postgres:…@127.0.0.1:7622/postgres
        schemi esposti: public, graphql_public · 9 tabelle, 74 righe di seed
OK    batteria Playwright (il browser giudica)
        13 file di spec · 22 passati, 0 falliti, 0 saltati
        13 flussi critici su 13 percorsi davvero dal browser
```

> L'autorità del database qui sopra è **elisa a mano**, non copiata: il gate
> stampa tre asterischi, e incollarli in un file tracciato è **esattamente** il
> modo in cui è nato il n°56. È il precedente che quella voce lascia, applicato
> alla prima occasione utile.

**22/22 con la password letta dalla fonte nuova**: è la prova che il punto 1 non
ha rotto il contratto dei due account.

### 5.4 Gli altri gate della catena

Tutti dalla radice del pilota, per percorso assoluto, con l'app viva sulla 3621.

| Gate | Esito | Su quale build |
|---|---|---|
| schema-forge | **VERDE 9/9** | `19e0c7c` (fa il proprio `db reset`) |
| gestionale-crafter | **VERDE 7/7** | `19e0c7c` |
| vetrina-crafter | **VERDE 10/10** | `19e0c7c` **e** `07e4d27` |
| flow-sentinel | **VERDE 7/7**, 22/22 | `19e0c7c` **e** `b462079` |
| speed-demon | **VERDE 8/8** | `19e0c7c` **e** `b462079` |
| site-doctor | **VERDE**, 0 falliti, 1 n/a su 14, «2 da guardare» | `19e0c7c` **e** `07e4d27` |
| launchpad | **ROSSO 2** | `b462079` |

Perché due build per alcuni: `.next/BUILD_ID` deriva dal commit, quindi anche un
commit di soli documenti sposta l'identità dell'artefatto. I gate che confrontano
l'app servita con il commit sono stati rilanciati sull'artefatto finale invece di
lasciare una citazione che sarebbe diventata falsa.

### 5.5 Launchpad

```
ok = false | {"passi":9,"pass":7,"fail":2,"skipped":0}
pass   radice-pulita
pass   catena-gate
pass   debito-bloccante
pass   segreti
pass   ambiente
pass   runtime-riproducibile
pass   impronta-artefatto
fail   runbook-firmato        [block] Confermato da: segnaposto del template, non una firma
fail   contratto-uscita       [block] docs/handoff/<n>-launchpad.md: handoff assente
```

**ROSSO 2, ed è l'atteso del mandato.** Nessuno dei due è di questo pacchetto:
il primo è la firma di Alberto, il secondo nasce con la pubblicazione.

**Un terzo rosso c'è stato, ed è la trappola già a registro.** Alla prima corsa
il passo `catena-gate` aveva due `block`: `08-vetrina-crafter` e `16-site-doctor`
erano diventati «più vecchi del codice che certificano», perché
`PERCORSI_CODICE` di launchpad include `supabase/` e il commit del punto 1 lo
tocca. Gli altri sette handoff erano rientrati da soli: il riallineamento dei
documenti li aveva ricommittati. La cura è quella scritta — **rilanciare il gate
di ognuno**, non ridatare — e sta al §6.

### 5.6 Il registro

```
OK    bloccanti dichiarati nel registro del debito
        61 voci lette · 7 dichiarano `Blocca il deploy: si`: n°4 · n°5 · n°33 · n°12 · n°17 · n°51 · n°52
```

Da **nove a sette**: n°27 e n°56 sono uscite. Il conteggio è del gate, non mio —
la casa ha già pagato due volte il riassunto che mente.

## 6. I due handoff riconfermati, e come

Non ridatati: **rilanciati**, ognuno col proprio gate e col verdetto accanto,
sull'artefatto consegnato.

- `docs/handoff/08-vetrina-crafter.md` — `GATE VETRINA: VERDE 10/10`. Il blocco
  nuovo dice anche cosa questo handoff **perde**: §8 incolla l'uscita del proprio
  gate con l'autorità mascherata a tre asterischi, e quella riga al commit
  `fff715b` **era** il n°56. Quel commit non esiste più.
- `docs/handoff/16-site-doctor.md` — `GATE CONFORMITA': VERDE`, le stesse «2 da
  guardare» (`accessibilita-admin`, `antispam`). Il certificato non è stato
  toccato: né la password del seed né la storia di git sono superfici che un
  visitatore raggiunge, e riemettere un certificato che nessuna misura ha
  cambiato sarebbe contabilità.

`docs/handoff/15-p4h-credenziale-e-certificati.md` ha un blocco di aggiornamento
dedicato, come il mandato chiedeva: il suo blocco di riconferma citava `fff715b`
e diceva «la riscrittura resta agganciata al primo `git push`». Entrambe le cose
erano vere quella mattina e la sera non lo sono più. Il corpo non è stato
toccato: è l'atto del 2026-08-06.

## 7. Cosa resta MANCANTE, col suo nome

| Cosa | Di chi è | Perché non è di questo pacchetto |
|---|---|---|
| `runbook-firmato` — `Confermato da: <NOME COGNOME> — <AAAA-MM-GG>` | **di Alberto Marocco** | una pubblicazione non si annulla: la firma di un umano è il punto in cui la catena si ferma apposta |
| `contratto-uscita` — `docs/handoff/<n>-launchpad.md` assente | **di launchpad, al momento della pubblicazione** | l'handoff di un agente si scrive quando l'agente ha fatto il suo lavoro, e launchpad non ha ancora pubblicato niente |
| `[issue] .env.e2e.local` (3 rilievi) | **dichiarato, non chiuso** | file **ignorato da git**: non è storia, non si riscrive. Parte solo con un deploy da CLI, e il runbook dichiara `Modo di deploy: git` |
| `[issue] next.config.ts → generateBuildId non solleva` | del n°48, già a registro | invariato da questo pacchetto |
| la credenziale nei **due bundle** | **dichiarata qui** | sono la storia di prima ed è il loro mestiere. Stanno fuori dal repository, sul Desktop di questa macchina, e non si consegnano a nessuno |
| chi avesse clonato **prima** del 2026-08-07 | **nessuno** | misurato: nessun remoto, nessun push mai eseguito, nessun clone consegnato. È la finestra che D24 imponeva di chiudere *prima*, ed è stata chiusa mentre era ancora vuota |

Nessun `git push`, nessun remoto aggiunto, nessuna pubblicazione: questo
pacchetto **prepara** il push, non lo fa.

## 8. La riga che serve al passo dopo

> **Da qui in poi la storia è pubblicabile.** Il primo `git push` è un atto di
> **P.3**, col runbook firmato dal committente e l'account del provider. Fino a
> quella firma il gate resta ROSSO 2, e i due rossi hanno il nome di chi li
> toglie: Alberto per la firma, launchpad per il proprio handoff.

## 9. Quello che questo pacchetto insegna, e non era nel mandato

1. **`--replace-text` non rispetta l'ordine del file.** Letterali prima, regex
   poi. Chi ha bisogno di un ordine resti in una sola famiglia.
2. **Un testo di sostituzione può essere un bloccante nuovo.** `***RIMOSSO***`
   dentro `crypt('…')` è ancora «password in chiaro dentro `crypt`» per il gate,
   perché quella famiglia non guarda i segnaposto. Il rimedio non è un
   segnaposto migliore: è **rompere la forma** che la famiglia cerca.
3. **La regola sul nome dei file d'ambiente decide la forma della soluzione.**
   Un `.example` accanto a un `.env.<qualcosa>.local` sarebbe stato un `.env`
   tracciato per `eFileAmbienteTracciato`, cioè un `block` non derogabile creato
   per dare il buon esempio. L'esempio è finito nel messaggio d'errore, dove non
   può divergere dal codice che lo stampa.
4. **Il precedente del n°56 si applica ai verbali della regia**, non solo al
   pilota: questo file elide a mano le autorità che i gate stampano mascherate.
   Un verbale che descrive un segreto può contenerlo.
