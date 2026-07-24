# BugBay

**Debugging agentico installabile in qualsiasi webapp.** Si aggancia con un solo
`<script>`; un daemon locale serve la **console completa di triage** e fa girare un
agente AI sul tuo repo, mostrandoti il **diff** prima di committare.

```
Segnala (widget)  →  Console di triage  →  Fix agentico (scope → fix → diff)
        →  Approva (commit) / Scarta (revert)
```

**Il pacchetto si aggancia a _qualsiasi_ webapp** (un tag `<script>`), ma la
**console/pannello di lavoro è in locale** — un daemon per progetto, legato al tuo
`localhost`. I **dati** invece possono essere **centralizzati**: puntando più
progetti allo stesso Supabase, un unico DB raccoglie le segnalazioni di _tutte_ le
tue app, ciascuna taggata col proprio `project_id` (→ [hub multi-progetto](#centralizzare-i-dati--hub-multi-progetto-supabase)).
_Hub-and-spoke_: **dati e identità centrali, esecuzione (git/tsc/edit/agente) locale
per progetto.**

## Installare

> Repo **privato**: serve essere collaboratore (con `git` autenticato) oppure usare un token GitHub.

Nel progetto dove vuoi usarlo, **tre passi** (PowerShell: un comando per riga):

```powershell
npm i -D "github:finzidev/bugbay"   # 1. installa
npx bugbay init                      # 2. aggancia (scrive config + inietta il widget nel layout)
npx bugbay dev                       # 3. avvia il daemon (tienilo aperto in un terminale)
```

Poi avvia la tua app come al solito (`npm run dev`) e apri il browser: compare il
**bottone BugBay** in basso a destra. La console di triage è all'**indirizzo che
`bugbay dev` stampa all'avvio** — ogni progetto ha la **sua porta dedicata**, così
puoi tenere più daemon accesi su progetti diversi.

> **Primo `bugbay dev`**: installa una-tantum le dipendenze della console (è un'app
> Next completa) — può volerci 1-2 min, poi parte subito. Se sei dietro un proxy che
> ispeziona il TLS e l'install dà errori di certificato, fornisci il **CA aziendale**
> (PEM) via `NODE_EXTRA_CA_CERTS` (variabile d'ambiente) o aggiungendo
> `"NODE_EXTRA_CA_CERTS": "C:/percorso/ca.pem"` in `~/.bugbay/env.json`. BugBay non
> disabilita mai la verifica TLS: senza CA valido l'install si ferma con istruzioni.

Varianti: `pnpm add -D` / `yarn add -D` / `bun add -D`. Con token (senza essere
collaboratore): `npm i -D "git+https://<TOKEN>@github.com/finzidev/bugbay.git"`.
Per bloccare una versione precisa: aggiungi `#v0.2.5` al riferimento.

## Aggiornare

BugBay si installa da git, quindi **`npm update` non basta**. Per prendere l'ultima
versione, reinstalla pulendo la cache — **un comando** (PowerShell):

```powershell
npm uninstall bugbay; Remove-Item -Recurse -Force $HOME\.bugbay-cache -ErrorAction SilentlyContinue; npm i -D "github:finzidev/bugbay"
```

bash/zsh:

```bash
npm uninstall bugbay && rm -rf ~/.bugbay-cache && npm i -D "github:finzidev/bugbay"
```

Poi riavvia `npx bugbay dev`. Verifica con `npx bugbay --version`.

## Uso

1. Segnala un bug col **widget** (bottone in basso a destra) da qualsiasi pagina.
2. Apri la **console** all'indirizzo stampato da `bugbay dev` (porta dedicata al progetto): trovi la segnalazione.
3. **Risolvi con AI** → BugBay individua il file, applica il fix, ti mostra il **diff**.
4. **Approva** (commit) oppure **Scarta** (revert).

Comandi CLI: `bugbay init` (aggancio) · `bugbay wire` (ri-aggancia il widget se serve)
· `bugbay dev` (avvia il daemon) · `bugbay --version`.

## Provalo subito (in locale + secondo progetto)

**A) Lancialo su questo repo** e guarda la console:

```bash
# dalla radice di questo repo (senza installarlo altrove)
node bin/bugbay.mjs dev
# apri l'URL "Console" stampato (es. http://localhost:7331)
```

Il daemon prende come target la cartella corrente: apri la console, crea segnalazioni
e prova il motore di fix su questo stesso repo.

**B) Collega un secondo progetto** (per vedere l'aggancio "in qualsiasi webapp"):

```bash
cd ../una-tua-altra-webapp
npm i -D "github:finzidev/bugbay"
npx bugbay init      # aggancia il widget + scrive la config (porta propria)
npx bugbay dev       # seconda console, su una porta diversa
```

Ora hai **due daemon** su due porte diverse, ciascuno sul suo repo. Per **vederli
nello stesso DB centrale**, imposta in entrambi `storage.driver:"supabase"` con le
_stesse_ credenziali (→ [hub multi-progetto](#centralizzare-i-dati--hub-multi-progetto-supabase)):
le segnalazioni dei due progetti finiscono nello stesso Supabase, separate per `project_id`.

## Se non vedi il widget

Quasi sempre una di queste tre:
1. **Il daemon non è attivo** → il widget si carica da `localhost:7331`. Avvia `npx bugbay dev`.
2. **CSP/CORS** (tipico nei gestionali): se in **F12 → Console** vedi un errore
   `Content-Security-Policy` o `CORS` su `bugbay-widget.js`, la tua app blocca lo
   script. Aggiungi `http://localhost:7331` a `script-src` **e** `connect-src` della
   CSP, **solo in sviluppo** (es. negli header di `next.config.mjs`).
3. **Snippet assente** dal layout → esegui `npx bugbay wire`.

## Come funziona

- **Widget** — web component in **Shadow DOM** (non eredita né inquina il CSS
  dell'host), servito dal daemon → funziona in qualsiasi stack con un solo `<script>`.
- **Daemon** (`bugbay dev`) — avvia l'app BugBay completa (console ricca + API +
  motore di fix) come app a sé, su `localhost:7331`. Gira dal pacchetto ma opera sul
  **tuo** repo via `BUGBAY_TARGET_ROOT`: la console è la stessa di sempre, qualunque
  sia il framework dell'host. Stato e segnalazioni in `.bugbay/`.
- **Console** — Lavagna Kanban, Tabella, Campagna QA, **Progetti** (panoramica
  cross-progetto del hub), Sala Macchine (log live + telemetria), drawer di dettaglio
  con review/diff. È l'app originale, non ridotta.
- **Motore di fix** — capisce la segnalazione, trova i file giusti e applica la
  correzione (gratis e all'istante per i ritocchi semplici, con l'AI per il resto),
  controlla di non aver rotto nulla e ti mostra la modifica da **approvare** (commit)
  o **scartare** (revert). Dettagli in [Cosa fanno gli agenti](#cosa-fanno-gli-agenti).
  Niente lascia la tua macchina, a parte le chiamate all'AI (zero, se usi `claude`).

## Cosa fanno gli agenti

Due aiutanti automatici, attivi **solo sul tuo computer**.

### Risolvere un bug

Premi **Risolvi con AI** su una segnalazione e l'agente fa tutto da solo:

1. **Capisce il problema** — anche se l'hai scritto di fretta — e trova da sé la
   pagina e i file giusti. Se la segnalazione è troppo vaga, ti fa **una** domanda
   e aspetta.
2. **Corregge**: i ritocchi semplici (cambiare un testo, togliere una parola,
   rinominare qualcosa) li fa all'istante e **gratis**; per i problemi veri usa l'AI.
3. **Controlla di non aver rotto nulla** prima di proporti la modifica.
4. **Ti mostra cosa ha cambiato**: decidi tu — **Approva** (tiene la modifica) o
   **Scarta** (torna com'era). Se non ti convince, **Rifiuta** e digli cosa
   sistemare: ci riprova da solo.

Niente viene salvato finché non approvi, e lavora **dove sei già** (nessun ramo
separato): vedi subito il risultato.

Se segnali **più bug insieme**, li smista da solo: quelli su pagine diverse li
risolve **in parallelo** e separati, così non si confondono tra loro.

Mentre lavora, la **Sala Macchine** ti fa vedere in diretta cosa sta facendo
(file aperti, modifiche, tempi e costo).

### Riscrivere una segnalazione

Il tasto **Riformula** (la bacchetta ✨) prende una descrizione confusa e la riscrive
**chiara e ordinata** — così chi (o cosa) la corregge capisce meglio e sbaglia meno.
Funziona sulle descrizioni delle segnalazioni, sulle note di risoluzione e sulle voci
della checklist.

## Autonomia (opzionale, OFF di default)

Il loop autonomo prende in carico da solo le segnalazioni `Aperto` e le fixa **su un
branch isolato** (`bugbay/auto/<id>`) — **senza mai toccare il tuo working tree**.
È **dietro flag** e spento di default: nessuna autonomia senza opt-in esplicito.

Come funziona una run autonoma:

1. un **poller (WATCH)** prende una segnalazione aperta del progetto;
2. crea un **git worktree isolato** (il `node_modules` è agganciato via junction) →
   l'agente edita lì, mai il tuo working tree;
3. gira interpret + fix + **gate `tsc`/ESLint** confinati nel worktree;
4. un **panel di Giudici multi-lente** (criteri / regressioni / correttezza,
   indipendenti) calcola la **confidence**;
5. **confidence gate**:
   - `tsc`/ESLint rosso → **nessun commit**, la segnalazione va in `In Verifica` come «da controllare a mano»;
   - verde → il fix è **committato sul branch isolato** (sicuro, reversibile, **mai
     auto-mergiato**) e va in `In Verifica` con una nota flaggata: **✅ pronto**
     (confidence alta) o **⚠️ DA CONTROLLARE** (ambigua);
6. **tu** rivedi il branch e fai il merge in blocchi. Se configuri un webhook, ricevi
   una **notifica** (Slack/Discord/Mattermost) a fine run.

Attivala in `bugbay.config.json`:

```jsonc
{
  "agent": {
    "autonomy": {
      "enabled": true,        // default false
      "pollSeconds": 60,      // intervallo di scansione delle segnalazioni aperte
      "gate": {               // Gate+ opzionali, eseguiti nel worktree (default OFF)
        "test": false,        // esegue `npm test`  (un test rosso → confidence bassa)
        "build": false        // esegue `npm run build` (nel worktree: niente collisione col dev server)
      },
      "notify": { "webhook": "" }  // URL webhook a fine run; vuoto = disattivato
    }
  }
}
```

> Le run **manuali** (Risolvi con AI) restano identiche: nessuna autonomia le tocca.

## Stato & observability

Due endpoint read-only (loopback, nessuna chiave esposta):

```bash
# stato del daemon: versione, storage, provider, autonomia, heartbeat WATCH,
# conteggi run per fase + token/costo, uptime
curl "http://localhost:7331/api/agent-fix?health=1"

# panoramica cross-progetto: totali per progetto sul DB condiviso
curl "http://localhost:7331/api/agent-fix?overview=1"
```

L'overview alimenta anche la vista **Progetti** della console.

## Requisiti

- **Node ≥ 18.17**. La CLI è leggera; alla **prima** esecuzione di `bugbay dev` il
  daemon installa una tantum le dipendenze della console (è un'app Next completa).
- Per il **fix agentico**: un **repo git** nel progetto (per diff/approva/scarta
  sicuri) e la **CLI `claude`** autenticata in locale (provider `claude-headless`).
  Senza `claude` resta il **codemod** deterministico per le correzioni meccaniche
  (sostituzioni, rimozioni, rename).
- Stack: **Next, Vite, Remix, SvelteKit, Astro, Nuxt** + fallback universale
  `<script>` per qualsiasi altro (anche backend non-JS). PM: **npm / pnpm / yarn / bun**.

## Configurazione — `bugbay.config.json`

Generato da `init`, sovrascrivibile:

```jsonc
{
  "project": { "id": "…", "name": "la-tua-app" },  // identità nel hub multi-progetto (id stabile)
  "app":     { "root": ".", "srcDir": "src", "routes": "app-router" },
  "server":  { "port": 7331 },          // porta dedicata, assegnata da `init` per-progetto
  "storage": { "driver": "local", "dir": ".bugbay" },
  "agent": {
    "provider": "claude-headless",
    "writeScope": ["src/**"],                        // l'agente scrive SOLO qui dentro
    "sensitiveFiles": ["**/auth/**", "**/.env*", "**/*.config.*"],  // mai toccati
    // Loop autonomo (OFF di default) — vedi la sezione "Autonomia".
    "autonomy": { "enabled": false, "pollSeconds": 60,
                  "gate": { "test": false, "build": false },
                  "notify": { "webhook": "" } }
  }
}
```

`storage.driver` può essere `"local"` (default) o `"supabase"` (vedi sotto).

## Centralizzare i dati — hub multi-progetto (Supabase)

Di default le segnalazioni stanno **in locale** nel progetto (`.bugbay-local-db/`,
gitignorato): perfetto per una singola app, ma **non condiviso** tra progetti.

Puntando **più progetti allo stesso Supabase** ottieni un **DB centrale unico** che
raccoglie le segnalazioni di tutte le tue app: ogni segnalazione è taggata col suo
**`project_id`** (stabile, derivato dal path o preso da `project.id` in config).
Ogni daemon resta **scoped al suo progetto** (la console vede solo le sue
segnalazioni), ma tutte vivono nello stesso database. Bastano 3 passi:

1. **Crea le tabelle**: nel tuo progetto Supabase apri lo **SQL Editor** e incolla
   il contenuto di [`supabase-schema.sql`](supabase-schema.sql) (incluso nel
   pacchetto: `node_modules/bugbay/supabase-schema.sql`). Crea `projects`,
   `debug_reports` e `debug_checklist_items` con la dimensione `project_id`; è
   **idempotente** (rieseguibile senza danni).
2. In **`bugbay.config.json`** imposta il driver:
   ```jsonc
   "storage": { "driver": "supabase" }
   ```
3. Fornisci le **credenziali** via ambiente o un `.env.local`/`.env` del progetto
   (la service-role key è un **segreto** → non committarla):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<tuo-progetto>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

Riavvia `bugbay dev`: all'avvio vedrai `Storage: Supabase (...)`. Se le credenziali
mancano, BugBay torna automaticamente al DB locale.

> ⚠️ BugBay accede con la service-role key. Usalo **solo in locale**: il daemon
> è pensato per la tua macchina, non per essere esposto in rete.

> Una **dashboard cross-progetto** unica (totali/fix/da-controllare di tutte le app
> insieme) è sul roadmap; oggi ogni console mostra il proprio progetto sul DB condiviso.

## Sicurezza

Il fix agentico **edita file ed esegue git**: usalo **solo in locale**, mai esposto
in produzione. Le note delle segnalazioni sono **input non fidato**. Difese in atto:

- **Bind loopback** — `bugbay dev` ascolta su `127.0.0.1`, non sulla LAN.
- **Guardia d'origine sulle API** — un sito remoto aperto nel tuo browser non può
  pilotare il daemon: si serve solo se **Host** e **Origin** sono di loopback
  (localhost/127.0.0.1). Blocca sia il cross-site diretto sia il **DNS rebinding**.
  La console e il widget su localhost funzionano; per embedding cross-site
  non-loopback c'è un token per-daemon (`?t=` sullo snippet).
- **Chiavi API mai esposte** — `?settings=1` ritorna solo booleani di presenza,
  mai i valori delle chiavi.
- **Perimetro di scrittura** — l'agente scrive **solo** dentro `agent.writeScope`
  (default `src/**`) e mai su `agent.sensitiveFiles`: un hook `PreToolUse` nega gli
  Edit fuori perimetro *prima* che avvengano, oltre al revert post-hoc del diff.
- **Upload ristretti** — solo immagini/video da allow-list MIME (no SVG/HTML), con
  `nosniff`: nessuno script eseguibile servito dal daemon.

## Struttura

```
bin/bugbay.mjs                 eseguibile della CLI
src/cli/                       CLI: init (aggancio) · dev (avvia il daemon) · detect · config · snippet
web/                           app Next del daemon: console di triage + API + motore di fix
web/public/bugbay-widget.js    widget flottante (web component) servito dal daemon
```
