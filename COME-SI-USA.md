# Come si usa Web Gun

Guida operativa: dall'installazione al sito costruito. Se cerchi *cosa* è Web Gun parti dal
[README](README.md); se cerchi *cosa manca ancora*, la [ROADMAP](ROADMAP.md).

---

## 1. Cosa serve sulla macchina

| Serve | Perché | Come si controlla |
|---|---|---|
| **Node 22+** | i gate e le batterie girano lì | `node -v` |
| **Docker Desktop acceso** | Supabase in locale gira in container | `docker ps` |
| **Supabase CLI 2.81.3+** | sotto quella versione un passo del gate di schema-forge resta *mancante*, e un gate mancante è rosso | `npx supabase --version` |
| **psql** | l'audit RLS e i test pgTAP parlano col database | `psql --version` |
| **Chrome** | Lighthouse, per speed-demon | — |
| **Git** | tutto il lavoro si versiona | `git --version` |

Consigliati: `pipx install sqlfluff squawk-cli` (analisi statica dell'SQL) e
`npx playwright install chromium` (i test End-to-End).

> **Uno strumento assente vale MANCANTE, mai PASS.** È la regola che tiene in piedi tutto il
> resto: un gate che non ha potuto verificare una cosa resta rosso. Non esiste «verde con
> riserva».

## 2. Installazione, una volta sola

```powershell
git clone <questo repo> WebGun
cd WebGun
powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1
```

Lo script crea `.claude/skills/` come cartella di **junction** verso `agenti/`: la fonte di
verità resta una sola. Poi **riavvia Claude Code**, o le skill non vengono rilette.

Per installarle dentro un progetto invece che nella regia:

```powershell
powershell -File scripts\installa-skill.ps1 -Destinazione C:\percorso\del\progetto\.claude\skills
```

Verifica che la regia sia sana:

```bash
node scripts/verifica-regia.mjs      # atteso: GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
```

## 3. Il giro completo: dal prompt al sito

Ogni fase è una skill che si invoca in conversazione con Claude Code. **L'ordine conta**: i dati
prima dell'interfaccia, l'interfaccia prima dei test, i test prima delle ottimizzazioni.

### Fase 1 — Il database

```
/schema-forge
```
`model` → **STOP: conferma il modello di dominio** → `forge` → `seed` → `test` → `types` →
`handoff` → `verify`

`test` scrive i pgTAP che **attaccano** le policy e non è opzionale: una tabella con policy di
scrittura che nessun test attacca è un blocco del gate. `verify` va **per ultimo**, perché uno
dei suoi passi controlla l'handoff.

### Fase 2 — Il sito pubblico

```
/vetrina-crafter
```
`specchio` → **STOP: cosa vede un anonimo lo firma un umano** → `scaffold` → `pagine` → `audit` →
`handoff` → `verify`

Pubblicare non si annulla: l'elenco delle pagine pubbliche e dei dati che mostrano è un contratto
firmato in `docs/vetrina.md` del progetto.

### Fase 3 — Il pannello del cliente

```
/gestionale-crafter
```
`specchio` → **STOP** → `scaffold` → `viste` → `contenuti` → `audit` → `handoff` → `verify`

Nessuna rotta admin senza guardia di autenticazione **e** di ruolo. La chiave `service_role`
**non entra nel progetto**, in nessun file, nemmeno ignorato.

### Fase 4 — I test dei flussi

```
/flow-sentinel
```
`map` → **STOP: i flussi critici li conferma un umano** → `forge` → `run` → `handoff` → `verify`

Ogni flusso di scrittura asserisce l'effetto **nel database**, non solo la pagina. I flussi
ostili provano dal browser che i confini d'accesso reggono: un test che non può fallire non è un
test.

### Fase 5 — Velocità e SEO

```
/speed-demon
```
`measure` → `plan` → **STOP: ogni ottimizzazione col suo costo** → `tune` → `handoff` → `verify`

Si misura **una build di produzione**, mai `next dev`. Una ottimizzazione alla volta, rimisurando
e rilanciando la batteria E2E: un sito più veloce e rotto è un sito rotto.

### Fase 6 — Il certificato di conformità

```
/site-doctor
```
`perimetro` → **STOP: la tabella di proprietà, prima di ogni misura** → `scansiona` →
`certifica` → **STOP: la firma** → `handoff` → `verify`

Cammina la superficie che un visitatore raggiunge davvero — collegamenti *e* `sitemap.xml` — e
misura su quella: privacy, basi giuridiche dei moduli, cosa finisce nel browser, accessibilità
dell'HTML servito, favicon, Open Graph, JSON-LD, robots.

### Fase 7 — Il cancello

```
/launchpad
```
`segreti` → `impronta` → `piano` → **STOP: il runbook lo firma chi decide** → `handoff` →
`verify` → `pubblica` → **STOP: conferma che nomina il dominio** → `verifica-pubblicato`

Launchpad **non pubblica da solo**: dice se si *può*. Non si pubblica su gate rosso — di
*nessuno* degli agenti a monte.

## 4. La regola dei guardiani

Dopo **ogni** fase di costruzione, tre cose:

1. `code-maniac scan` — lint, tipi, complessità, codice morto, duplicati, segreti.
2. Sui punti critici (auth, pagamenti, dati utente, deploy): `/code-inquisition --scope diff`.
3. **Il gate di ogni agente che ha lavorato**, dalla radice del progetto generato:

```bash
node <regia>/.claude/skills/<skill>/scripts/verify.mjs [--url http://127.0.0.1:<porta>]
```

Il gate dev'essere **verde** prima dell'handoff. Nessun handoff è valido senza scan pulito
**oppure** residuo scritto in `docs/DEBITO-TECNICO.md` del progetto.

## 5. Provare senza un cliente

Due modi, e servono a cose diverse:

**La cavia** (`../cavia`) è un sito completo costruito dalla pipeline intera, un agente per fase.
Serve a lanciare i gate contro qualcosa di reale.

```bash
cd ../cavia
npx supabase start          # api 7621, db 7622, studio 7623
npx supabase db reset       # schema + dati che valgono ovunque
npm run seed-sviluppo       # i due account di prova (chiede la password da .env.sviluppo.local)
npm run build && npm start  # il sito sulla 3621
```

**I banchi** sono progetti usa-e-getta che una skill si costruisce da sola per provarsi:

```bash
node agenti/<skill>/scripts/banco.mjs --dove <cartella> --porta <porta>
```

Un banco si tiene **come script, non come cartella**: si rigenera, non si archivia. L'unica
eccezione è `banco-prova-vetcare/`, che è **rosso apposta** — è il caso di prova permanente di
uno schema difettoso, e chi lo trova rosso non ha trovato un difetto: ha trovato il suo scopo.

Le batterie di test delle skill:

```bash
cd agenti/<skill> && npm test        # 1 434 test in tutto, più 46 della regia
```

## 6. Le trappole di questa macchina

Ognuna è costata un pomeriggio a qualcuno. Sono scritte qui perché non lo costino due volte.

**Node: l'interprete non è il PATH.** Un gate che chiama uno strumento esterno con `npx` eredita
il node del `PATH`, non quello che lo ha avviato. Per Lighthouse serve:

```bash
export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"
```

**Il processo che muore dopo aver parlato.** Su Windows con Node 24.19 capita che un gate esca
`3221226505` (`0xC0000409`) **dopo** aver stampato il verdetto: il `--json` è integro, il codice
d'uscita no. Chi consuma un gate legge `doc.ok`, mai il solo codice d'uscita.

**Le porte.** WinNAT riserva l'intervallo **57464-57963** e Windows usa 49152-65535 per le porte
dinamiche: le porte dei banchi si scelgono **sotto 49152**. E la porta di un progetto si
*guarda*, non si suppone — `Get-NetTCPConnection -LocalPort <porta> -State Listen`: su questa
macchina la porta che un contratto dichiarava era occupata dal sito di un'altra azienda.

**Un solo stack Supabase alla volta.** Con 16 GB, tre stack accesi insieme saturano la memoria e
Windows uccide le finestre dell'IDE. `npx supabase stop` prima di accenderne un altro.

**Le junction.** `.claude/skills/` è fatta di junction verso `agenti/`. Spostare o rinominare una
cartella che ne contiene le **attraversa**: copia il contenuto puntato e lo **cancella
all'origine**. Prima di spostare una cartella si cercano i reparse point:

```powershell
Get-ChildItem -Recurse -Force -Directory | Where-Object LinkType
```

**I commit.** Più chat possono lavorare nella stessa cartella e l'indice di git è **condiviso**:
`git add` per nome non è un perimetro. Si committa sempre indicando i percorsi:

```bash
git commit -F - -- <percorsi>
```

Mai `-A`, mai `-a`, mai `git stash` mentre altri lavorano.

## 7. Se qualcosa va storto

| Sintomo | Dove guardare |
|---|---|
| il gate regia è rosso | il passo che stampa `FAIL` dice cosa manca e dove |
| una skill non compare in Claude Code | rilancia `installa-skill.ps1` e **riavvia** Claude Code |
| il gate di una skill dice *mancante* | manca uno strumento: l'elenco è al §1 |
| un gate misura l'app sbagliata | i gate confrontano il `BUILD_ID`: hai ricostruito dopo l'ultimo commit? |
| gli handoff risultano «più vecchi del codice» | qualunque commit sotto `src/`, `supabase/`, `package.json` o `next.config.*` fa scadere gli handoff a monte: si rilanciano i loro gate, **non si ridatano** |
| un file di documentazione citato non esiste | è stato archiviato: vedi [ARCHIVIO.md](ARCHIVIO.md) |
