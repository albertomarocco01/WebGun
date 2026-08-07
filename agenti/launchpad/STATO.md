# STATO — launchpad

**A che punto è:** gate costruito, sabotato, processato e collaudato in chat
vergine — ma **nessun deploy è mai stato eseguito**, da nessuno, su nessun
provider.
**Proprietario:** Alberto Marocco.
**Ultima misura:** 2026-08-07 — batteria **167 test, 0 falliti**; gate contro il
pilota `cavia` (`C:/Users/Utente/Desktop/cavia`) senza `--url`: **ROSSO, 3
falliti e 1 verifica mancante su 9 passi**. I tre rossi: `catena-gate` (dopo la
rinomina del progetto i nove handoff sono più vecchi dell'ultimo commit di
codice), `runbook-firmato` (segnaposto del template al posto della firma),
`contratto-uscita` (l'handoff nasce con la pubblicazione).

## Cosa fa

Decide se un sito Web Gun **si può pubblicare**, e fa firmare a un umano *cosa*
va online: non è un deployer con un cancello davanti, è **il cancello**, e il
deploy è ciò che succede quando si apre. Legge i verdetti degli agenti a monte,
misura ciò che il deploy porterebbe con sé (segreti, variabili, runtime,
impronta) e scrive `docs/deploy.md`, il runbook che un umano firma. Le quattro
leggi:

1. **Non si pubblica su gate rosso**, di nessun agente a monte né del proprio —
   legge scritta da flow-sentinel e speed-demon prima che questo agente
   esistesse.
2. **La pubblicazione la autorizza un umano, sul contenuto**: dominio, commit,
   variabili, cosa diventa pubblico, come si torna indietro. E **questa firma
   non si delega** (D20): `docs/deploy.md` non descrive un lavoro fatto, lo
   **autorizza**. *Si delega la firma su un verbale, non su un mandato.*
3. **Nel pacchetto che parte non viaggia nessun segreto**, né in HEAD né nella
   storia (diff, messaggi di commit e di tag); la chiave `service_role` non
   entra mai in un progetto generato.
4. **Ciò che va online resta dimostrabile dopo**: l'impronta si **deriva** dal
   commit, non si registra.

Non misura il sito — niente Chrome, Playwright o database: quei verdetti li
**legge** — e non aggiusta il lavoro degli altri. L'unica riga di codice altrui
che tocca è `generateBuildId` in `next.config.ts`, con `impronta --scrivi`.

## Il gate

Nove passi con `id` stabili, uscita `0` verde / `1` rosso / `2` errore, contratto
`--json` versione 1. **L'ordine della tabella è il gate.**

| passo | cosa prova |
|---|---|
| 1 `radice-pulita` | si pubblica **un commit**, non un working tree: albero pulito, HEAD non sfasato col remoto |
| 2 `catena-gate` | nessun gate a monte ha detto di no, e nessun handoff è più vecchio del codice che certifica. **Un verdetto scritto dentro una citazione non conta** (D23 §1): costo accettato e dichiarato — un verdetto legittimo messo in citazione diventa un rosso, e il messaggio dice come si toglie. La §19 generale, che vive in cinque gate e nel passo 9, **non** è toccata |
| 3 `debito-bloccante` | ogni voce che dichiara `Blocca il deploy: sì` ha risposta **per numero** nel runbook |
| 4 `segreti` | nessun segreto nei file tracciati, nuovi, ignorati **e nella storia** |
| 5 `ambiente` | ogni variabile che il codice spedito legge è dichiarata, nessun valore vero committato |
| 6 `runtime-riproducibile` | `engines.node` ≥ di quanto pretende ogni dipendenza installata; lockfile presente e tracciato |
| 7 `impronta-artefatto` | l'impronta è **derivata dal commit**, e l'app servita la porta |
| 8 `runbook-firmato` | `docs/deploy.md` esiste, senza segnaposto, firmato da un umano con data ≥ artefatto |
| 9 `contratto-uscita` | la riga `Gate:` dell'handoff dice il vero su **questa** esecuzione |

**Cinque passi misurano; tre misurano la forma di una dichiarazione altrui; uno
— `catena-gate` — legge e data.** Quale è quale, e cosa resta indimostrato passo
per passo, sta in `references/verifica-deterministica.md` §2: è la differenza
fra un certificato e una promessa.

Si lancia **dalla radice del progetto generato**:

```bash
npm run build && npm run start -- -p 3100
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3100 [--json]
```

Senza `--url` il passo 7 è **MANCANTE**, non `pass`: il gate non indovina un
`localhost:3000`, perché è così che si misura l'app di un altro progetto e si
stampa verde. Uno strumento assente vale MANCANTE, e un gate rosso per verifiche
mancanti resta rosso.

## Come si prova

Dalla cartella della skill (`agenti/launchpad`):

```bash
npm test        # 167 test, 0 falliti — misurato il 2026-08-07
```

Se `npm` non è nel PATH:
`"/c/Program Files/nodejs/node.exe" "/c/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" test`

Il banco di prova **si rigenera da zero, non si ricorda**:

```bash
node scripts/banco.mjs --dove <cartella> --porta 3182
# lo script stampa il passo 0 (le due NEXT_PUBLIC_*), poi npm install e impronta --scrivi
node scripts/banco.mjs --contratti --dove <cartella> --porta 3182
# poi npm run build, npm run start, e infine il gate con --url
```

`banco.mjs` **non scrive nessun `.env.local`**: le due `NEXT_PUBLIC_*` che
servono a `npm run build` le stampa come **passo 0**, con valori dichiaratamente
finti (dominio `.invalid`, RFC 2606) — un file di configurazione comparso in
silenzio è la classe di difetto che questa skill misura negli altri. `npm
install`, `npm run build` e l'avvio dell'app **non li fa**: li stampa, perché un
banco che finge di averli fatti sarebbe la stessa cosa. Chiude **VERDE 9/9**.

Trappole della macchina, da non riscoprire:

- porte **sotto 49152**: gli intervalli riservati da WinNAT **si spostano fra un
  riavvio e l'altro** (`57464-57963` un giorno, `50000-50059` / `50962-51461` /
  `61185-61284` il giorno dopo), quindi non si memorizzano — si rilancia `netsh
  interface ipv4 show excludedportrange protocol=tcp` prima di scegliere.
  `Test-NetConnection` non lo dice: guarda chi ascolta, non chi ha prenotato;
- `node --test` col glob vuole Node 21+: i file di test si elencano per esteso
  in `package.json`;
- `import.meta.main` **non si usa** (Node 24; su Node 20 vale `undefined`, il
  corpo non gira e il processo esce **0 muto**, cioè verde). E l'epilogo di ogni
  script fa il **doppio confronto** `resolve(argv[1])` + `realpathSync` con
  ricaduta testuale: dalla junction `.claude/skills/…` il confronto secco è
  falso e lo script esce 0 senza stampare niente;
- `spawnSync` senza `shell` non consulta `PATHEXT`: uno shim `.cmd` risulta
  `ENOENT`. Si risolve con `where`/`which` prendendo la prima riga
  **eseguibile** — non con `shell: true`, che concatena gli argomenti;
- **un conteggio di `semgrep` senza il ruleset accanto non è confrontabile con
  niente**: `--config=auto` (200 regole) alza 2 `detect-non-literal-regexp`
  (`gate-lib.mjs`, `impronta.mjs`, entrambi esentati per iscritto); `p/nodejs`,
  `p/javascript`, `p/security-audit` e `p/eslint-plugin-security` ne alzano
  **zero** — quella regola la tira dentro solo `auto`.

## Cosa NON è mai stato provato

**Nessun deploy è stato eseguito.** Non un account creato, non un repository
collegato, non un dominio comprato, non un record DNS toccato, non un centesimo
speso. Non sono mai stati esercitati contro il mondo:

1. il comando `pubblica` — esiste come procedura, non è mai stato eseguito;
2. la procedura di **rollback**, su nessuno dei due provider: il gate legge una
   procedura scritta, e che funzioni si scopre la prima volta che serve;
3. `verifica-pubblicato` **contro un dominio vero** — esercitato solo contro una
   build di produzione servita in locale, quindi prova il **meccanismo**, non la
   pubblicazione;
4. `generateBuildId` **sulla macchina di un provider**, cioè la premessa della
   Legge n°4. In locale regge nei due casi che i provider usano davvero (clone
   `--depth 1` con `.git`; `.git` assente con `VERCEL_GIT_COMMIT_SHA` /
   `CF_PAGES_COMMIT_SHA`) e cadeva nel terzo — `.git` assente, nessuna
   variabile, dentro **un altro** repository: nasceva un artefatto che
   dichiarava l'identità di un repository diverso. Corretto. Che i provider
   impostino davvero quelle variabili è **documentato, non misurato**;
5. che `engines.node` venga rispettato da un provider: non lo impone nessuno
   senza `engine-strict`. Il gate misura che sia **dichiarato e coerente**;
6. il certificato SSL, la propagazione DNS, la coerenza fra apex e `www`;
7. il costo vero di una pubblicazione.

**E nove `pass` su nove non provano:**

> Un gate verde non prova che il sito sia pronto per il suo pubblico. Prova che
> è pronto per il **trasporto**.

- **che i gate a monte fossero verdi davvero.** `catena-gate` legge una riga
  scritta da chi l'ha eseguito e ne misura solo la freschezza. Rilanciarli da
  qui è stato **valutato e scartato** (reference §6);
- **che non ci siano segreti**: solo che non ce ne sono *delle sei famiglie di
  contenuto e delle due regole sul nome*. Un segreto codificato due volte,
  spezzato su due righe, dentro un'immagine o in un documento binario passa;
- **che il file letto sia quello che parte.** Ogni passo apre il file **sul
  disco**, non il blob del commit: a rendere le due cose la stessa è
  `radice-pulita`, ed è perché quel passo è `block` e non un avviso cortese;
- **l'età dell'artefatto**: promessa nella specifica e mai implementata (rilievo
  VER-14 del tribunale), perché l'`mtime` non sopravvive a una copia della
  cartella. Chi costruisce con l'albero sporco e poi lo pulisce ha un `.next/`
  che nessun commit contiene, e il gate non lo vede;
- **che il remoto esista ancora.** `origin/main` è una copia locale: col remoto
  puntato su un percorso inesistente il passo chiude `pass` con zero rilievi. Il
  runbook prescrive un `git fetch` prima del gate;
- **che il dominio dichiarato sia quello del cliente**, né **che le variabili
  abbiano i valori giusti**: il gate sa che `NEXT_PUBLIC_SITO_URL` non è
  `127.0.0.1` e non è `http://`, non sa se è il dominio del cliente. Un valore
  plausibile e sbagliato passa, portandosi dietro `canonical`, Open Graph,
  `sitemap.xml` e `robots.txt`, prerenderizzati **una volta sola**;
- **le dipendenze transitive annidate** (`node_modules/a/node_modules/b`) non
  entrano nel confronto di `engines`;
- **il contenuto** degli handoff e del runbook: se ne misura forma, freschezza e
  coerenza dei verdetti, non la verità. Il registro del debito resta verde **per
  dichiarazione** — la riga di forma fissa sposta la soglia da «so leggere la
  prosa» a «hai dichiarato», non da «leggo» a «misuro»;
- **che il gate sia giusto su un progetto che non ha costruito lui.** I banchi li
  genera `banco.mjs`, scritto da chi ha costruito la skill: provano che il gate
  riconosce ciò che **quello script** considera corretto. L'unico progetto
  estraneo che questo gate abbia mai visto è `cavia`, e lì è rosso — per motivi
  quasi tutti di altri;
- **che pubblicare sia una buona idea.** Nessuna misura risponde: per questo
  l'ultima parola non è del gate.

**Non è usabile su un progetto cliente**, per un motivo solo: il primo deploy
non è ancora avvenuto. Fra «il gate rifiuta correttamente» e «il deploy riesce»
c'è esattamente lo spazio dove vivono i guasti di questa fase.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| **Il primo deploy vero** | è il mestiere di questa skill e l'unica cosa che non ha potuto provare; una pubblicazione non si annulla | **Alberto**, di persona |
| Firma umana su `docs/deploy.md` di `cavia` | c'è ancora il segnaposto del template. Non è un difetto: è la riga che aspetta una persona, e la D20 ha tolto l'unica scorciatoia | **Alberto**, di persona |
| `docs/handoff/<n>-launchpad.md` in `cavia` | scriverlo prima di una pubblicazione vera sarebbe il certificato di un lavoro non fatto | launchpad, alla pubblicazione |
| **schema-forge** — il template di `docs/DEBITO-TECNICO.md` porti `Blocca il deploy: sì \| no` in ogni voce aperta (D23 §2; forma in reference §3.3) | finché non la porta, **ogni progetto nuovo nasce con un registro che il gate dichiara MANCANTE**, e lo dice per nome. Sul pilota migrato a mano. *Verificato il 2026-08-07: il template non ce l'ha* | schema-forge |
| **schema-forge** — il seed nasca in due file, `riferimento` (ogni ambiente) e `sviluppo` (mai in produzione), col secondo che porta già `-- launchpad-consentito: credenziale-sql — …` | il pilota ci è arrivato a un passo dal deploy e ha dovuto separarli sotto scadenza. Nascere separati costa una riga | schema-forge |
| **schema-forge** — `engines.node` dichiarato alla nascita, dal massimo che le dipendenze pretendono | il pilota è arrivato all'ultimo miglio senza, e **il sito non si costruiva** su Node 20: il gate lo misura, ma lì è tardi | schema-forge |
| **vetrina-crafter** e **gestionale-crafter** — `generateBuildId` derivato dal commit già nello scaffold | è la sola prova d'identità che sopravvive alla ricostruzione del provider. *Verificato il 2026-08-07: non c'è in nessuno dei due* | i due crafter |
| **i cinque costruttori** — l'handoff si riconferma **rilanciando il gate**, non ridatando | un pacchetto che tocca `src/` o `supabase/` fa scadere **tutti** gli handoff a monte in un colpo. Rimisurato il 2026-08-07 su `cavia`: dopo la rinomina, **nove su nove** scaduti | i cinque costruttori |
| **cyber-shield** (non esiste) — la limitazione di frequenza | il pilota la dichiara come prescrizione di deploy in due voci: finché cyber-shield non esiste resta una riga nel runbook invece che una difesa | cyber-shield |
| `[issue] .env.e2e.local` in `cavia`, 3 rilievi | **ignorato da git**: non è storia, non si riscrive, e parte solo con un deploy da CLI — il runbook dichiara `Modo di deploy: git` | dichiarato, non chiuso |
| `[issue] generateBuildId non solleva` quando il commit non è risolvibile, in `cavia` | a registro nel debito del pilota, invariato | il pilota |

## Com'è andata (in breve)

Costruita il 2026-08-06 **col gate scritto prima del flusso**, con una sosta a
metà su una domanda sola — *quale passo potrebbe essere verde su un deploy che
non si deve fare?*: sei risposte, tutte diventate regole, una era un difetto che
sarebbe stato spedito. Sabotaggio: **36 classi, 36 rosse, 0 non prese**, col
gemello pulito VERDE 9/9. Tribunale a tre periti: **32 rilievi, 32 chiusi**; il
più grave era che il rimedio prescritto da questa skill **rompeva la build del
cliente**, non compilando sotto `strict`. Collaudo avversario in chat vergine:
**26 difetti, 26 chiusi**, di cui **nove falsi verdi con gravità di blocco**, e
gli strumenti statici erano tutti verdi. Lo stesso collaudo ha riverificato il
verbale di costruzione: **quattro** affermazioni non si riproducevano — 105 test
erano 104, «5 warning» erano 8, «0 cloni» erano 4, e `banco.mjs` **non
esisteva**, viveva nello scratchpad di quella sessione. Poi le tre decisioni
della direzione (D20, D23 §1, D23 §2), con una misura non prevista: il gate
**vecchio** davanti al registro **appena migrato** leggeva 45 bloccanti su 56,
quello nuovo 10 — una correzione a monte senza la sua metà a valle peggiora
invece di lasciare uguale.

La batteria è passata da 104 alla consegna a **167** oggi. Sul pilota, il
2026-08-07 con l'app viva e la storia ripulita da una credenziale (`segreti` da
**10 bloccanti a zero**), il gate chiudeva **ROSSO 2**; rilanciato oggi dopo la
rinomina in `cavia` è **ROSSO 3**, e il terzo è `catena-gate`.
