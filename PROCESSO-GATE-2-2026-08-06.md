# Processo ai gate, secondo turno — i trentuno, il parser che non guarda dove si trova, e il contrasto

> **P.7e**, chat unica, 2026-08-06/07. Bersaglio: il difetto n°50, i 31 MEDIUM e
> LOW residui di `INQUISIZIONE-GATE-2026-08-06.md`, la delega `contrasti` di
> `CANTIERE.md` §D21, e l'audit di tutti gli scanner scritti a mano delle quattro
> skill storiche.
>
> Il referto **non si tocca**, e nemmeno `PROCESSO-GATE-2026-08-06.md`: sono il
> verbale di ciò che è stato trovato e di ciò che P.7d ha fatto. Questo è il
> verbale del secondo turno.

## La riga che conta

**Il n°50 chiuso, ventitré voci del referto chiuse, tre difetti nuovi trovati
mentre le si chiudeva, e undici commit.** Nessuno chiuso a parole: ognuno ha una
misura *prima* e una *dopo*, e un test che lo falsifica nella forma vera
dell'ingresso.

I tre difetti che il referto non aveva sono la parte che conta di più, perché
sono **la stessa classe del n°50** trovata con la stessa domanda:

| n° | dove | il verso | cosa faceva |
|---|---|---|---|
| **n°51** | `gestionale-crafter/audit-lib.mjs:84` | **verde falso** | due stringhe qualunque cancellavano la riga di una chiave `service_role` |
| **n°52** | `gestionale-crafter/audit-lib.mjs` (4 funzioni) | **verde falso** ×2 | una `{` in una stringa faceva sconfinare il corpo di un'azione server in quella dopo, che le prestava la guardia |
| **n°53** | `flow-sentinel/gate-lib.mjs:1040` | **verde falso** | un `retries: 1` scritto dentro una stringa valeva come dichiarazione |

E le batterie:

| Skill | Prima (P.7d) | Dopo | Δ |
|---|---:|---:|---:|
| schema-forge | 186 | **228** | +42 |
| gestionale-crafter | 173 | **230** | +57 |
| flow-sentinel | 131 | **171** | +40 |
| speed-demon | 103 | **147** | +44 |
| **totale** | **593** | **776** | **+183** |

---

## 1. Il n°50 — l'alias che ogni progetto Next scrive apriva un commento

### La misura, prima

La direzione lo ha riprodotto dalla radice del pilota, contro la regia a
`d147f52`:

```
GATE GESTIONALE: ROSSO (0 falliti, 1 verifiche mancanti su 7 passi)
MANC  tipi del progetto (tsc)
        tsconfig.json non interpretabile (Expected ':' after property name in
        JSON at position 472): non si sa con quali controlli `tsc` abbia misurato
```

Il `tsconfig.json` del pilota è **655 byte di JSON valido**: `JSON.parse` sul
file grezzo riesce. A fallire era lo spogliatore JSONC di
`progetto-lib.mjs:137`. Riprodotto qui, copiando il file in una cartella di
lavoro e senza aprire il pilota in scrittura:

```
$ node -e 'JSON.parse(fs.readFileSync("tsconfig-pilota.json","utf8"))'
JSON.parse GREZZO: OK          (655 byte)

$ premessaTsc(<lo stesso testo>)
{ "strict": false,
  "motivo": "tsconfig.json non interpretabile (Expected ':' after property name
             in JSON at position 472 (line 22 column 15)): …" }
```

E il pezzo che spariva, misurato al carattere:

```
primo  /*  a offset 466   →  "      \"@/*\": [\"./src"
prima chiusura a  536     →  ".d.ts\",\n    \"**/*.ts"
caratteri divorati dalla PRIMA sostituzione: 72
totale byte persi (tutte le sostituzioni):  102   (da 655 a 553)
```

### Il raggio del guasto, in numeri

- Il passo è `MANCANTE`, **mai `pass`**: nessun falso verde è mai uscito da qui.
- Ma il gate di `gestionale-crafter` era **rosso su ogni progetto che questa casa
  genera**, perché `"@/*"` è l'alias che `create-next-app` scrive in ogni
  progetto Next con `src/` e import alias. Non è una forma esotica: è lo scaffold
  di default.
- La finestra è: **dal 2026-08-06, commit `3c6f152`** (la correzione H8, che ha
  portato la tolleranza JSONC) **al 2026-08-06, commit `cada13c`**. Cioè: la
  tolleranza è arrivata mentre si chiudevano i quattordici del tribunale, e ha
  rotto il caso che capita sempre.
- **Un solo passo su sette** ne era toccato (`tipi del progetto (tsc)`), e il suo
  effetto era di rendere il gate rosso, non verde.

### La correzione, e perché non è «gestire anche le stringhe»

Il commento sopra il codice diceva che la tolleranza JSONC c'è perché
«`create-next-app` non ne mette ma altri strumenti sì». **Una tolleranza aggiunta
per un caso che non capita ha rotto il caso che capita sempre.** Quindi
l'ordine, non la potenza:

1. `JSON.parse` sul **testo grezzo**. Un `tsconfig.json` valido non ha bisogno di
   nessuno spogliatore, e farcelo passare è l'unico modo di romperlo.
2. Solo se solleva, si spogliano i commenti con uno **scanner** che tiene due
   stati — dentro una stringa, dietro una barra di fuga — che sono esattamente
   ciò che alla regexp mancava.
3. Se non basta nemmeno quello: `MANCANTE`, col messaggio di sempre. E la
   posizione si riferisce al testo **senza commenti** quando i commenti c'erano
   davvero, perché la posizione del grezzo indicherebbe il commento — che in
   JSONC è lecito — e mentirebbe.

### La misura, dopo

```
$ premessaTsc(<lo stesso identico tsconfig.json del pilota>)
{"strict":true,"motivo":null}
```

Otto test nella forma vera dell'ingresso: il `tsconfig.json` del pilota
verbatim, un JSONC con un commento a blocco **e** un `/*` dentro una stringa
nello stesso file, un `//` dentro un valore (`"nota": "a // b"` — la seconda
regexp aveva la stessa cecità, guardata solo dal `://`), una barra di fuga, un
file troncato, un JSONC rotto davvero.

**Una nota che vale la riga.** Il commento che spiega questa correzione non può
citare per intero le due regexp che ha sostituito: la chiusura di commento
dentro la seconda chiuderebbe **quel** commento. È lo stesso guasto un piano più
su, e sta scritto nel file.

---

## 2. La forma dietro il n°50, e l'audit che si è preso

### La famiglia, dopo questo pacchetto

| quando | dove | il delimitatore | dentro cosa |
|---|---|---|---|
| tribunale, 2026-08-05 | site-doctor | `<!--` | un **attributo** |
| collaudo P.6-P2, 2026-08-06 | site-doctor | `</script>` | un **tag** |
| P.4h, 2026-08-06 | gestionale-crafter | `/*` | una **stringa** (n°50) |
| **P.7e, 2026-08-06** | **gestionale-crafter** | `/*` | una **stringa** (n°51) |
| **P.7e, 2026-08-06** | **gestionale-crafter** | `{` `}` `.from(` | una **stringa** (n°52) |
| **P.7e, 2026-08-06** | **flow-sentinel** | `retries:` | una **stringa** (n°53) |
| **P.7e, 2026-08-06** | schema-forge + flow-sentinel | `#` | una **stringa** (M13, L7) |
| **P.7e, 2026-08-06** | schema-forge | `--` e `/*` | una **stringa** SQL (M3) |
| **P.7e, 2026-08-06** | speed-demon | `<svg` | un **CSS** e un **attributo** (M7) |
| **P.7e, 2026-08-06** | schema-forge | `[` | la **prosa di uno strumento** |
| **P.7e, 2026-08-06** | flow-sentinel | `//` | una **stringa** (L11) |

**Undici istanze in tre giorni, sei skill, nove file diversi.** E ogni volta la
batteria era verde, perché ogni fixture era modellata sull'implementazione
invece che sull'ingresso vero.

### L'inventario, scanner per scanner

Ventidue sonde ostili, una per scanner, ciascuna con il delimitatore **dentro**
una stringa, un commento o un attributo. Sei rosse.

#### Riparati

| Scanner | File · riga | La sonda | Verso |
|---|---|---|---|
| `premessaTsc` | `gestionale-crafter/progetto-lib.mjs:216` | `"@/*"` nel tsconfig | rosso falso (n°50) |
| `senzaCommenti` | `gestionale-crafter/audit-lib.mjs:100` | `"…/*"` + `"*/"` | **verde falso** (n°51) |
| `dentroGraffe` | `gestionale-crafter/audit-lib.mjs:409` | `{ a: "{" }` | verde e rosso falsi (n°52) |
| `corpoFunzione` | `gestionale-crafter/audit-lib.mjs:375` | `{ const s = "}"; … }` | **verde falso** (n°52) |
| `chiaviOggetto` | `gestionale-crafter/audit-lib.mjs:672` | `{ a:1, n:"}", b:2 }` | **verde falso** (n°52) |
| `tabellaPrimaDi` | `gestionale-crafter/audit-lib.mjs:648` | `"…from('finta')"` | verdetto attribuito male (n°52) |
| `senzaCommentiJs` | `flow-sentinel/gate-lib.mjs:1052` | `nota: "retries: 1"` | **verde falso** (n°53) |
| `codiceSenzaCommenti`/`motivato` | `flow-sentinel/gate-lib.mjs:300` | `skip("…//home")` | verde falso (L11) |
| `valoreToml` | `schema-forge/verify.mjs:257` | `# …` nell'array | rosso falso (M13) |
| `senzaVirgolette`/`valoreToml` | `flow-sentinel/gate-lib.mjs:790` | `"…/#/app"` | rosso falso (L7) |
| `regolaTestNegativi` | `schema-forge/audit-lib.mjs:800` | test commentato | **verde falso** (M3) |
| `senzaSvg` | `speed-demon/gate-lib.mjs:1053` | `<svg` in un CSS | rosso falso ×3 + `noindex` perso (M7) |
| `attributo` | `speed-demon/gate-lib.mjs:1105` | `data-name=` prima di `name=` | **verde falso** (M6) |
| `senzaZoneCitate` | `speed-demon/gate-lib.mjs:26` | recinto `~~~` | **verde falso** (M4) |
| `dettaglioAdvisors` | `schema-forge/verify.mjs:182` | `[locale]` nel preambolo | dettaglio perso |
| `righeDaPsql` | `schema-forge/erd-lib.mjs:26` | separatore nel testo | diagramma sbagliato |

#### Provati immuni — e questo vale quanto una riparazione

| Scanner | File · riga | La sonda, verde |
|---|---|---|
| `leggiFlussi` | `flow-sentinel/gate-lib.mjs:171` | un'intestazione dentro un recinto e dentro un commento HTML |
| `estraiOggettoJson` | `flow-sentinel/gate-lib.mjs:437` | una `}` dentro una stringa del JSON |
| `sqlConteggioRighe` | `flow-sentinel/gate-lib.mjs:857` | una virgoletta nel nome di una tabella (raddoppia) |
| `leggiContratto` | `speed-demon/gate-lib.mjs:300` | una soglia dentro un recinto `~~~` (dopo M4) |
| `indiziDevServer` | `speed-demon/gate-lib.mjs:772` | l'indizio dentro il **testo visibile** della pagina |
| `metatagDaHtml` | `speed-demon/gate-lib.mjs:872` | un `<title>` dentro uno `<script>` (dopo M7) |
| `tabelleDaiTipi` | `gestionale-crafter/progetto-lib.mjs:22` | una graffa dentro una stringa dei tipi (passa da `dentroGraffe`) |
| `privilegiDaAcl` | `gestionale-crafter/audit-lib.mjs:754` | un altro ruolo non regala privilegi |
| `recordDiAritaSbagliata` | `schema-forge/audit-lib.mjs:92` | 8 campi dove ne servono 7 (il controllo di H5 tiene) |
| `leggiAudit` | `schema-forge/verify.mjs:660` | una `{` dentro una stringa del JSON |
| `scrittureNelCodice` | `gestionale-crafter/audit-lib.mjs:634` | `.insert(` nominato dentro una stringa (dopo n°52) |
| `verdettoDa`/`RIGA_VERDETTO` ×4 | tutte e quattro | la riga `Gate:` dentro un recinto (`senzaZoneCitate`) |

#### Rossa e **non chiusa**, con la sua ragione

| Scanner | La sonda | Perché resta |
|---|---|---|
| `righeDaPsql` | `flow-sentinel/gate-lib.mjs`: `"public.brutta\ntabella\npublic.ok"` → **3 righe invece di 2** | è il §L8 del referto. Vedi §7. |

### Dove esiste un parser vero, si usa quello

- **`mascheraUrl`** usa `new URL`, non una regexp — vedi §4.
- **`JSON.parse`** sul testo grezzo prima di ogni spogliatore — §1.
- **Non c'è un parser TypeScript** fra le dipendenze delle skill (zero
  dipendenze a runtime è una scelta dichiarata di tutte e quattro): per il
  codice del progetto restano scanner scritti a mano, e la difesa è che ora
  **sanno dove si trovano** e hanno la loro sonda ostile.
- **Non c'è un parser TOML** né uno HTML, per lo stesso motivo. `senzaCommentoToml`
  e `senzaSvg` dichiarano i loro limiti (stringhe multi-riga TOML; commenti dentro
  un corpo quotato col dollaro in SQL).

---

## 3. Il contrasto, e l'audit delle deleghe

### `contrasti` esisteva come delega e non la onorava nessuno

`CANTIERE.md` §D21 assegna a speed-demon la voce `contrasti`, perché è l'unico
gate della casa che apre un browser. Al 2026-08-06 la parola `contrast` compariva
in **zero file** di `agenti/speed-demon/`: il gate leggeva
`report.categories.accessibility.score` e non apriva mai l'audit.

**Perché non basta.** Lighthouse pesa `color-contrast` insieme ad altri venti
audit dentro `accessibility`. Misurato sulla forma vera di un report:

```
PRIMA   categoria accessibility 98 · soglia dichiarata 95
        → findingsBudget: []          → passo `budget` VERDE
        → nessun altro passo guarda il contrasto

DOPO    lo stesso report, con `color-contrast` score 0 e tre elementi
        → passo `contrasto`: FAIL
          [block] pagina home: 3 elementi con contrasto insufficiente
            - footer.sito > p.note
            - header a.link-secondario
            - <span class="badge">Novita'</span>
```

**La fixture è quella, ed è il punto.** Una in cui falliscono entrambi non prova
niente: è il caso in cui anche il codice vecchio diceva rosso. Qui la categoria
**passa** e il gate diventa rosso lo stesso.

Il gate passa da **sette a otto passi**, e `SKILL.md` è aggiornata — il numero
dei passi è un contratto dichiarato, non un dettaglio. Quattro stati e non due:
`notApplicable` (una pagina senza testo sopra uno sfondo) non è né un successo né
un guasto, e un audit che Lighthouse non ha prodotto è MANCANTE.

`robots.txt`, favicon, Open Graph, JSON-LD e `sitemap.xml` **non** sono di questo
agente e non sono stati aggiunti: D21 li assegna a site-doctor. Nessun documento
delle quattro skill li rivendicava — verificato.

### L'audit delle deleghe: ogni passo che conclude su X leggendo qualcos'altro

Trentuno passi, quattro gate. La domanda: *questo passo conclude qualcosa su X
leggendo un punteggio, un conteggio o una categoria che X la **contiene**?*

**Delegazione provata più debole della pretesa — corretta:**

| Passo | File · riga | Cosa concludeva | Cosa leggeva |
|---|---|---|---|
| `contrasto` (non esisteva) | speed-demon | «l'accessibilità è a posto» | il punteggio della categoria — vedi sopra |
| `budget` su `accessibility` | `speed-demon/gate-lib.mjs:809` | «la soglia non è raggiunta, c'è la deroga» | non leggeva **affatto** la baseline, quindi non distingueva una soglia mancata da una regressione (M10) |
| `a11y` | `gestionale-crafter/verify.mjs:455` | «l'accessibilità è verificata» / «non lo è» | `status !== 0`, che confonde «ho misurato e ho trovato» (1) con «non ho misurato» (2) |

**Delegazione provata adeguata — dichiarata:**

| Passo | File · riga | Perché regge |
|---|---|---|
| `db-advisors` | `schema-forge/verify.mjs:589` | passa `--fail-on error` **esplicitamente**, e il commento sopra dichiara perché i WARN non fanno rosso (impostazioni di Auth che una migrazione non corregge) |
| `a11y`, caso «zero file» | `gestionale-crafter/verify.mjs` | misurato: con cartelle che contengono `.ts` senza JSX ESLint li esamina davvero (2 file, 0 messaggi, uscita 0); con zero file lintabili l'uscita è **2**, che ora è MANCANTE. Il verde su niente non esiste da nessuna delle due parti |
| `pgtap` | `schema-forge/verify.mjs:653` | conta i **file** prima di lanciare: `supabase test db` su una cartella vuota esce 0 (`Result: NOTESTS`) |
| `sqlfluff` | `schema-forge/verify.mjs:441` | conta i **byte** prima di lanciare: i file oltre il limite sono `skipped`, non `pass` |
| `rete-verde` | `speed-demon/verify.mjs:214` | legge `esito.ok` del gate figlio — che dopo C2 (P.7d) è per flusso, non un OR globale. La delega è forte quanto il gate delegato, e ora lo è |
| `audit-rls` | `schema-forge/verify.mjs:637` | legge `summary.block` **e** `premesse.tabelle` (M12, qui sotto) |
| `audit` del gestionale | `gestionale-crafter/verify.mjs:342` | legge `summary.block` e stampa `azioni riconosciute in N file` (H6, P.7d) |
| `build-produzione` | `speed-demon/verify.mjs:248` | euristica **dichiarata** sugli indizi dell'HTML, più il confronto del `.next/BUILD_ID` |
| `tipi` (×2 skill) | | confronto byte a byte fra i tipi generati e quelli committati: nessuna delega |
| `contratto-uscita` (×4) | | legge il documento, non un riassunto |

---

## 4. M2 — la password non esce più dal gate

Il referto lo dava MEDIUM «finché la password è `postgres:postgres` su
loopback», e scriveva che torna HIGH il primo giorno in cui un `--db-url` punta
altrove. La direzione ha la prova che è vivo: il gate di launchpad, oggi, fra i
quattro blocchi che fermano la pubblicazione del pilota stampa

```
[block] docs/handoff/08-vetrina-crafter.md @ fff715b (2026-08-06):
        password dentro l'autorita' di un URL — password nell'URL `postgresql://…:…@….0.1`
```

Otto punti di stampa in tre skill. **PRIMA e DOPO**, sulle righe che il referto
cita:

```
PRIMA  AUDIT RLS su postgresql://postgres:postgres@127.0.0.1:7622/postgres · schemi: public
       schemi esposti: public · postgresql://postgres:postgres@127.0.0.1:7622/postgres
       app: http://127.0.0.1:3621 (HTTP 200) · database: postgresql://postgres:postgres@…
       permessi letti da postgresql://postgres:postgres@… per il ruolo authenticated
       --json → "dbUrl": "postgresql://postgres:postgres@127.0.0.1:7622/postgres"

DOPO   le stesse cinque righe, con `postgres:***@`
```

### Perché `new URL` e non la regexp che esisteva già in casa

Il mascheramento esisteva a `vetrina-crafter/verify.mjs:378`, ed è
`replace(/:[^:@]*@/, ":***@")`. Misurate le due su cinque forme, **la regexp
sbaglia tre volte**:

```
postgresql://postgres:p%40ss:word@db.example.com:5432/prod?sslmode=require
  regexp → postgresql://postgres:p%40ss:***@…       META' PASSWORD IN CHIARO
  URL    → postgresql://postgres:***@…

postgresql://postgres@127.0.0.1:54322/postgres              (nessuna password)
  regexp → postgresql:***@127.0.0.1:54322/postgres          URL DISTRUTTA
  URL    → intatta

postgres://127.0.0.1:5432/db?opt=a:b@c                      (nessuna password)
  regexp → postgres://127.0.0.1:5432/db?opt=a:***@c         QUERY MANGIATA
  URL    → intatta
```

È la stessa classe del n°50 — uno scanner che non sa in quale parte della
struttura si trova — e `new URL` la struttura la conosce: `password` è un campo,
non un pezzo di testo fra due caratteri. Ed è nel runtime, non è una dipendenza.

**Un buco trovato scrivendo il test che doveva chiuderlo**: `new URL` **non
solleva** su `postgres:pw@host` — schema più percorso opaco, `password` vuota — e
il testo sarebbe uscito intero. Se il parser non riconosce nessun host non ha
riconosciuto l'autorità: una `@` lì dentro non si stampa affatto.

**speed-demon non riceve la funzione**: `grep dbUrl|db-url|postgres` nei suoi
script dà zero occorrenze. Non tocca nessuna URL di database.

**La regexp di `vetrina-crafter` resta com'è**: quella skill è fuori dal perimetro
di scrittura di questo pacchetto. È una segnalazione per la direzione, con la
misura sopra.

### E L2 con lei: la password fuori dalla riga di comando

Il referto declassava L2 a LOW perché il segreto in `argv` è transitorio. Ora la
URL arriva a `psql` **senza** password e la password passa da `PGPASSWORD`: non
un mascheramento, un altro canale. Quattro punti di chiamata in tre skill. Senza
password non cambia niente.

---

## 5. I trentuno, blocco per blocco

L'ordine è quello proposto da P.7d in `PROCESSO-GATE-2026-08-06.md` §Proposte.
**Due spostamenti, e il perché è nel commit:**

- **M2 promosso in testa** (dal mandato: la direzione ha la prova che è vivo).
- **n°51, n°52 e n°53 inseriti dove sono stati trovati**, cioè mentre si faceva
  l'audit degli scanner: sono verdi falsi su regole di sicurezza, e aspettare
  sarebbe stato tenerli aperti sapendolo.

### Blocco 1 — la premessa non contata

**M12 — l'audit RLS non diceva quanto aveva guardato.**

```
un catalogo VUOTO, tutte e undici le regole:
  findings: 0 · block: 0

PRIMA  uscita 0 → il gate legge {ok:true, summary:{block:0}} → passo `pass`
       dettaglio: `schemi esposti: public · postgresql://…`
       (nessun campo dice quanto e' stato guardato)

DOPO   uscita 2, su stderr:
       «l'audit ha guardato ZERO tabelle negli schemi public. Non e' uno schema
        pulito: e' un audit su niente, e nessuna delle undici regole puo'
        scattare. O le migrazioni non sono applicate su questo database, o gli
        schemi esposti non sono questi, o la URL punta a un altro progetto.
        Verifica MANCANTE, non un audit senza rilievi.»
       → il gate registra `skipped`
```

E su un audit vero il dettaglio porta la premessa, **sempre, anche sul verde**:

```
guardati: 18 tabelle · 42 policy · 3 viste · 2 funzioni security definer ·
          130 colonne · 5 file di test pgTAP
```

«test pgTAP **NON letti**» resta distinto da «**0** file di test pgTAP»: il primo
è un'assenza di informazione, il secondo un'informazione. `premesse` entra nel
contratto del `--json`: un documento che non la porta non si usa più.

La seconda metà di M12 è `schemiEsposti(null)`, che tornava `["public"]` senza
errore. Il file **assente** non è la chiave assente: la chiave assente ha un
default che Supabase documenta, il file assente vuol dire che il gate non sa cosa
PostgREST pubblichi. Il test che asseriva il contrario è stato **corretto, non
tolto**: scriveva il difetto.

**M3 — commentare un test pgTAP era il modo più rapido di tenere verde la regola 10.**

```
test negativo vero                              block: 0
lo stesso con `-- ` davanti a ogni riga         block: 0   ← identico
lo stesso dentro un commento a blocco           block: 0   ← identico

DOPO   commentato riga per riga → block: 1
       dentro un commento a blocco → block: 1
```

`senzaCommentiSql` toglie **solo** i commenti, e il resto resta byte per byte:
un test negativo corretto scrive il tentativo dentro un
`throws_ok($$ insert into … $$)`, e uno spogliatore che svuotasse le stringhe
accuserebbe di «policy mai attaccata» proprio il test scritto bene. Due test
tengono la correzione da quella parte.

Postgres e non un SQL generico: i commenti a blocco **si annidano**
(`a /* x /* y */ z */ b` → `a   b`), le stringhe raddoppiano l'apice, gli
identificatori raddoppiano la virgoletta, il dollaro quota fino al tag gemello.
*Limiti dichiarati*: `E'…\''` non è gestita (con `standard_conforming_strings`
acceso, default da PG 9.1, la barra non fugge niente); un commento dentro un
corpo quotato col dollaro resta dov'è.

**M13 + L7 — due difetti opposti, una causa sola.**

```
schemas = [
  "public",
  "shop", # esposto anche qui, vedi PROGETTO.md
]
PRIMA  ["public","shop","# esposto anche qui","vedi PROGETTO.md"]
       → audit esce 2, passo `skipped`, accusa un config.toml che non e' rotto
DOPO   ["public","shop"]

site_url = "http://127.0.0.1:3000/#/app"
PRIMA  urlAppProgetto → "http://127.0.0.1:3000/"   mezza URL
DOPO   "http://127.0.0.1:3000/#/app"
```

`senzaCommentoToml` in tutte e tre le skill che leggono un `config.toml`, riga
per riga **prima** di ogni confronto — così vale anche per le righe su cui
prosegue un array. In gestionale-crafter arriva su uno scanner **oggi immune**
(la sola chiave letta è `[db].port`, e il `/^(\d+)/` reggeva già un commento in
coda): arriva lo stesso, perché uno scanner immune per fortuna torna difettoso al
primo riuso. *Limite dichiarato*: le stringhe TOML multi-riga (`"""`, `'''`) non
sono gestite.

### Blocco 2 — il contratto che si firma da solo

**M4.** Markdown ha due recinti, il gate ne conosceva uno:

```
stesso esempio, recinto ``` :  pagine = []
stesso esempio, recinto ~~~ :  pagine = ["esempio"]   ← l'esempio DICHIARA
DOPO   entrambi: []
```

Arriva la funzione di flow-sentinel, non una nuova: è il difetto che la sorella
ha misurato e chiuso il 2026-07-28.

**M9.** `## Deroghe` era qualunque intestazione che contenesse la parola, e un
`###` non la chiudeva:

```
                                    PRIMA   DOPO
## Deroghe                            1       1    (giusto)
## Deroghe RESPINTE                   1       0    (una deroga NEGATA)
## Storico delle deroghe scadute      1       0    (una deroga MORTA)
## Deroghe + ### Archivio             1       0    (un archivio)
```

**M10, prima metà.** Il template ha sei colonne e la sesta è `Confermata da`. Il
gate leggeva la riga con quella cella **vuota**: bastava aggiungere una riga a una
tabella per togliere una soglia. Ora una deroga senza firma non è una deroga, e
**non si scarta in silenzio** — è un errore di contratto, perché una riga che
sembra una deroga e non lo è è esattamente ciò che qualcuno rileggerà fra sei
mesi come valida.

**M10, seconda metà.** La baseline stava nella **stessa riga** che il gate già
analizzava — terza colonna — e nessuno la leggeva. Senza, «non ci si arriva» e «si
è peggiorato» erano lo stesso caso:

```
accessibility 61 contro soglia 95, con deroga scritta E firmata:
  baseline 96 (regressione)     BLOCK  «e' una regressione»
  baseline 40 (non raggiunta)   WARN   la deroga vale, e dice chi l'ha firmata
  baseline non dichiarata       BLOCK  «derogabile solo SOPRA la baseline»
```

Il terzo caso è la regola della casa applicata: senza la baseline il gate non sa
se sta autorizzando una soglia mancata o una regressione, e «non lo so» non è «va
bene» — la stessa forma del `tsconfig` senza `strict` (§H8). Vale **solo** per
`accessibility`, come scrive il template.

**M11.** Il template di handoff di speed-demon ha **131** occorrenze di `{{` (il
referto ne contava 53: è cresciuto). Passandolo così com'è, il gate ora ne trova
123 e blocca. Si contano **dopo** `senzaZoneCitate`, perché uno snippet CI dentro
un recinto (`${{ secrets.X }}`) non è un segnaposto rimasto — il caso che
flow-sentinel ha già pagato.

### Blocco 3 — il rosso falso

**M7 + M6, misurati insieme** su una pagina con un'icona SVG di sfondo in un
data-URI dentro `<style>` (cioè una cosa che scrive Tailwind da solo) e un
`<meta data-name="viewport" name="robots" content="noindex">`:

```
PRIMA  title = null · description = null · canonical = null · robots = null
DOPO   "Forno d'Oro — Pizzeria" · "La pizzeria di quartiere" ·
       "https://fornodoro.test/" · "noindex"
```

Tre `block` sull'imputato sbagliato e, nel verso peggiore, un `noindex`
cancellato — una pagina esclusa dall'indice che risulta pubblica.

`senzaSvg` è ora uno scanner: un `<` dentro il valore di un attributo non apre un
tag, dentro `<style>` e `<script>` non è markup affatto, dentro un commento HTML
nemmeno. L'annidamento si conta, `<svg/>` non apre niente. E ciò per cui
`senzaSvg` esiste **regge**: il `<title>` di un'icona accessibile continua a non
passare per il titolo della pagina.

`\bname=` ha un confine di parola anche fra il trattino e la `n` di `data-name`:
ora il carattere prima dev'essere uno che in un nome di attributo non ci può
stare, e per la stessa riga gli spazi attorno all'uguale sono ammessi.

**M5 — il ReDoS non si stringe, si toglie l'ambiguità.**

```
PRIMA    1 000 caratteri →     1,6 s
         2 000 caratteri →    15,0 s
         4 000 caratteri →  non finito in due minuti
DOPO    40 000 caratteri →     < 1 ms
```

Il costo si pagava **una volta per flusso**. Il limite arrivato con H10 lo
trasformava in un gate che si ferma con un messaggio invece che in uno muto, e va
bene — ma un gate che impiega venti secondi per flusso su un ingresso ostile è un
gate che qualcuno lancerà con un timeout più corto. **Per questo non è sceso di
priorità.**

La correzione non è un quantificatore più stretto: si cerca prima il
`from "…helpers/db…"`, che ha un solo quantificatore e nessuna alternanza
annidata, e poi si risale all'`import` più vicino. Nessun punto del testo può
essere consumato in due modi. E non riapre il difetto del 2026-07-28: fra
`import` e `from` non ci può stare la fine di un'altra istruzione.

### Blocco 4 — il resto

| # | Esito | Nota |
|---|---|---|
| L11 | **chiuso** | `motivato()` chiedeva `linea.includes("//")`: uno skip con un `//` dentro il titolo risultava motivato. Di rimbalzo, un `.only` **nominato** dentro una stringa non è più un `.only` committato |
| L5 | **chiuso** | `.toUpperCase()`, come nelle tre sorelle: `Gate: verde` non fa più chiudere rosso un handoff giusto |
| L3 | **chiuso** | la visita all'albero del report Playwright era ricorsiva: profondità 20 000 → `RangeError`, processo morto **senza JSON**, cioè un gate rosso indistinguibile da un gate che non ha risposto. Ora è iterativa, e il test costruisce l'albero |
| L8 | **MANCANTE** | vedi §7 |
| L9 | **chiuso** | anche la sonda `--version` di admin-audit dichiara il suo tetto: un tetto implicito non è un tetto |
| L2 | **chiuso** | vedi §4 |
| L4 | **chiuso** | il catalogo dei permessi era un oggetto nudo indicizzato dai nomi delle tabelle del **cliente**: `tabelle["constructor"]` rispondeva con una funzione ereditata. Ora è una `Map` |
| L6 | **inerte, dichiarato** | il referto stesso lo dichiara: ogni esito di `res.status` è già intercettato da `res.error` e da `estraiOggettoJson`, e nessun ingresso lo rende osservabile |
| L12 | **chiuso** | il difetto ERA l'assenza di rete: quattro test su `triggerCheNomina` (un trigger che parla d'altro non toglie il rilievo; uno su INSERT non copre l'UPDATE) |
| L13 | **chiuso** | tre test sul confine di `misuraStabile`: dispersione esattamente alla soglia = buona, un punto oltre = no, e il confine vale anche a soglia zero |
| L15 | **chiuso** | `trovaHandoff` confronta il numero come **numero**: `["9-…","13-…"]` dava il 9 |
| L1, L10, L14 | **già chiusi** da P.7d / dal referto | |

E due `new RegExp` costruite col nome di una colonna del progetto passano ora da
`perRegex`: erano le ultime due della skill. Sono **provate irraggiungibili** —
prima di arrivarci il nome deve superare un'alternanza letterale ancorata — e il
test che c'è scrive perché un test che fallisca senza `perRegex` non si può
scrivere.

---

## 6. Le regressioni possibili — cioè il sistema che funziona

Quattro correzioni possono far diventare rosso un progetto che finora passava. In
ogni commit c'è scritto quale e perché.

1. **Una tabella di deroghe senza la colonna `Confermata da`** (M10). Le due
   fixture del banco di Bottega Nord sono state corrette: la deroga che stava lì
   non l'aveva firmata nessuno.
2. **Una deroga su `accessibility` senza baseline dichiarata** (M10).
3. **Un `supabase/config.toml` assente** con `--db-url` esplicito: il passo
   `audit-rls` diventa `skipped` invece di auditare `public` in silenzio (M12).
4. **Un audit RLS su zero tabelle**: `skipped` invece di `pass` (M12).

Nessuna di queste è una regressione del pilota: il suo gate schema-forge era
VERDE 9/9 con 7 migrazioni e 18 tabelle.

---

## 7. Cosa resta MANCANTE, col suo nome

1. **Il rilancio dei quattro gate contro il pilota, dopo queste correzioni.**
   **È della direzione**, non di questa chat: il pilota
   `C:\Users\Utente\Desktop\fornodoro` è di un'altra chat in questa ondata, e il
   suo stack Supabase pure. Questa chat non l'ha aperto in scrittura, non ne ha
   lanciato i gate, non ha toccato Docker.

   La metà del MANCANTE n°1 di P.7d **è chiusa**, e non da qui: la direzione ha
   rilanciato i quattro gate contro il pilota vivo il 2026-08-06 sera, a regia
   `d147f52` — schema-forge VERDE 9/9, flow-sentinel VERDE 7/7 con **13 flussi
   critici su 13 percorsi davvero dal browser**, speed-demon VERDE 7/7 su cinque
   pagine, gestionale-crafter ROSSO per **un solo** motivo, che è il n°50 chiuso
   qui. C1 e C2 tengono su un progetto vero.

2. **`righeDaPsql` di flow-sentinel sui delimitatori di default (§L8).** La sonda
   è rossa e misurata: `righeDaPsql("public.brutta\ntabella\npublic.ok")` dà
   **tre righe invece di due**. Resta aperto per il motivo che P.7d ha già
   scritto e che regge ancora: oggi è innocuo (le due query di questa skill hanno
   **una colonna sola**) e pericoloso al primo riuso; neutralizzare i separatori
   in SQL vuole un Postgres vivo per essere provato, e applicarlo alla cieca
   renderebbe **silenzioso** un guasto che oggi è **rumoroso**. Va nel pacchetto
   che ha un banco.

3. **Il `translate` sulle undici query di testo libero dell'audit RLS (§H5).**
   Stessa posizione: renderebbe *impossibile* la collisione invece che *rumorosa*,
   e vuole un banco vivo. Il controllo di arità che c'è è provato dalle asserzioni
   pure, non da un giro del guscio.

4. **`code-maniac scan` non è stato lanciato come comando**: non è un eseguibile
   nel PATH di questa macchina e la sua skill non è fra quelle disponibili a
   questa chat. **La sua batteria deterministica è stata eseguita a mano**, ed è
   quella riportata in §8: ESLint, knip, jscpd, semgrep, gitleaks. Dichiarato,
   non taciuto.

5. **La regexp di mascheramento di `vetrina-crafter/verify.mjs:378`** resta
   difettosa (§4): quella skill è fuori dal perimetro di scrittura di questo
   pacchetto. La misura è sopra, la correzione è quella già scritta in casa.

6. **Nessun Docker avviato, nessuno stack Supabase acceso o spento, nessun banco
   toccato.** Nessuna porta aperta: le misure di §1, §3, §4 e §5 sono tutte su
   funzioni pure o su cartelle di lavoro.

7. **Undici rilievi del concilio restano aperti, con nome e verso.** Non sono
   stati chiusi per scelta di perimetro o di budget, non per svista, e ognuno ha
   la sua misura nel referto del concilio:

   | # | Dove | Cosa | Verso |
   |---|---|---|---|
   | P2 | `schema-forge/audit-lib.mjs` | una E-string con la fuga a barra rovesciata e' SQL Postgres valido e ribalta la parita' degli apici: § M3 si riapre, e ci si arriva da SQL corretto invece che da un file rotto | **verde falso** |
   | P4 | `flow-sentinel/gate-lib.mjs` | un `import … from './helpers/db'` scritto **dentro una stringa** soddisfa la Terza Legge: basta una riga di documentazione | **verde falso** |
   | P5 | `speed-demon/gate-lib.mjs` | `metatagDaHtml` taglia i tag con una classe negata e `attributo` cerca il nome ovunque nel tag: un `name=` dentro il **valore** di un altro attributo fabbrica un metatag fantasma che scavalca quello vero, e il `noindex` sparisce. La cura esiste gia' nello stesso file (`fineTag`), e i consumatori non la usano | **verde falso** |
   | P8 | `gestionale-crafter/audit-lib.mjs` | `scrittureNelCodice` scarta in silenzio le scritture che non sa leggere (una catena costruita a pezzi), e `misure.scritture` ne dichiara meno di quante ce ne sono: e' il gemello di «azioni server: 1» sull'altro passo, e manca il `scrittureNonLette` | **verde falso** |
   | P9 | `flow-sentinel/gate-lib.mjs` | `retries: 1` dentro un template **multi-riga** fa passare una configurazione che non lo dichiara: correzione incompleta di n.53 | verde falso |
   | P11 | `speed-demon/gate-lib.mjs` | un `<svg>` mai chiuso mangia il resto del documento, nei due versi | entrambi |
   | P12 | `schema-forge/verify.mjs` | `primoArrayJson` accetta il primo array che si interpreta, non quello degli advisors | rosso falso (residuo perso) |
   | SD-2 | `speed-demon/gate-lib.mjs` | `motivoNonDerogabile` vale solo per `accessibility`: la scelta ora e' **dichiarata** nel codice con le sue due ragioni, ma resta una scelta di perimetro che la direzione puo' ribaltare | — |
   | — | `speed-demon/gate-lib.mjs` | `TITOLO_DEROGHE` ammette un titolo senza spazio dopo i cancelletti, il cancello che lo interroga no: una tabella sotto quel titolo sparisce in silenzio | rosso falso |
   | — | `schema-forge/audit-lib.mjs` | `regolaTestNegativi` accetta come attacco una scrittura che vive dentro una stringa | verde falso |
   | — | tre copie | `mascheraUrl`/`credenzialiPsql` sono **tre copie identiche** in tre skill: la duplicazione e' dichiarata, ma e' la ragione per cui due mutazioni sono sopravvissute | — |
   | — | `gestionale-crafter/audit-lib.mjs` | `chiudeLaStringa` limita la scansione alla riga per `'` e `"` ma non per il backtick: un backtick spaiato costa una scansione dell'intero file. Al piu' una per file — chi scandisce salta alla chiusura quando la trova — ma va scritto | costo |

8. **Il `--db-url` resta nell'`argv` dei due processi Node a monte di `psql`**, e
   la riga «L2 chiuso» di questo verbale va letta con questa precisazione: L2 e'
   chiuso **alla foglia** (la chiamata a `psql`), non lungo tutta la catena. Il
   `verify.mjs` di tre skill riceve la URL come argomento e la ripassa al proprio
   script di audit, sempre come argomento: per l'intera durata del gate la
   password e' leggibile nella tabella dei processi. Chiuderlo vuol dire cambiare
   l'interfaccia fra `verify.mjs` e i suoi audit — e il primo salto e' la riga di
   comando che scrive un umano, che questa casa **non** vuole leggere
   dall'ambiente (e' la difesa contro l'auditare il database di un altro
   progetto, DECISIONI.md §11). Va deciso, non fatto di corsa.

9. **`CLAUDE.md` dichiara 7 passi per speed-demon; ne ha 8.** L'ottavo e'
   `contrasto`, nato in questo pacchetto. `SKILL.md` e `STATO.md` sono stati
   aggiornati; `CLAUDE.md` **e' fuori dal perimetro di scrittura di questo
   pacchetto** e la riga resta da correggere alla direzione. Le altre tre righe
   della tabella (9 · 7 · 7) sono state verificate e sono giuste.

---

## 9. Il tribunale sul pacchetto stesso

Il mandato chiedeva `/code-inquisition --scope diff` sul codice cambiato. E' stato
convocato sui 25 file di P.7e: **cinque esperti** (due modelli, per de-correlare
gli errori) piu' un **critico del roster**, che ha trovato il buco del roster —
nessuno guardava i test come imputati ne' i documenti come testimoni — e si e'
guadagnato il quinto esperto.

**Diciannove rilievi. Otto chiusi qui, e due erano regressioni di questo stesso
pacchetto.** E' il risultato che conta piu' di tutto il resto del verbale: la
correzione di una classe di difetto ha reintrodotto la stessa classe, e a
trovarla non e' stata nessuna delle 776 asserzioni.

### Le due regressioni, e il verso e' il peggiore

**P1 — `senzaCommenti`, un apice che non si chiude.** Su una riga di TSX in
italiano, cioe' la cosa piu' comune che ci sia:

```
  return <p>Elenco degli ordini dell'utente</p>; // TODO: qui manca richiediStaff()

PRIMA  l'apostrofo apre una stringa fino a fine riga, il commento in coda
       sopravvive, `chiamaUnaDi` ci trova dentro il nome della guardia
       -> rotta admin SCOPERTA, zero findings
       (e nel layout: 0 rilievi su 3 rotte figlie, tutte scoperte)
DOPO   1 block, come sulla stessa riga senza l'apostrofo
```

Variante peggiore, stessa causa: **un backtick spaiato** spegneva lo spogliatore
fino a fine file — cinque commenti su cinque sopravvivevano.

**Le due `replace` di prima davano la risposta giusta.** Lo scanner «che sa dove
si trova» aveva imparato a entrare in una stringa e non a chiedersi se quella
stringa fosse una stringa.

**P3 — `codiceSenzaCommenti`, lo stato che rinasce a ogni riga.** `inBlocco`
attraversa le righe, `delimitatore` no: la riga che **chiude** un template
multi-riga comincia con un backtick, che quindi ne apriva uno nuovo e spegneva
il resto della riga. `.only` committato -> zero rilievi. Anche qui: prima della
correzione di L11 le stringhe non si guardavano affatto, e il rilievo usciva.

La regola per entrambe e' quella che un lettore umano applica senza pensarci:
**si entra in una stringa solo se la stringa si chiude.** Gli apici non
attraversano la fine della riga, il backtick si'.

### Tre porte ancora aperte sui segreti, dopo M2 e L2

| Porta | Misura | Esito |
|---|---|---|
| `decodeURIComponent` che solleva | `new URL` accetta `Segreta%Finale` e lo lascia testuale, `decodeURIComponent` no — e il `try` avvolgeva entrambe: la ricaduta restituiva la URL **originale**, password in chiaro di nuovo in `argv`. E psql la rimanda nel proprio stderr (`invalid percent-encoded token`), che **tre gate stampano grezzo** | chiusa: `errore`, e i tre chiamanti lo onorano — non si misura |
| `?password=` in query | forma che libpq accetta, e che si usa proprio per evitare le fughe nell'userinfo: **sfuggiva a entrambe le funzioni** — in chiaro su stdout, nel `--json`, e in `argv` | chiusa: si **rifiuta**, non si riscrive |
| `PGPASSWORD` ereditato | con una URL senza password, un residuo d'ambiente autenticava al posto nostro, in silenzio | chiusa: `ambientePsql` lo cancella |

**Perche' si rifiuta invece di riscrivere.** Togliere il parametro dalla query
vorrebbe dire riserializzarla, e `searchParams` ricodifica `%20` in `+` —
misurato: `options=-c%20statement_timeout%3D0` diventa `options=-c+statement…`,
che per libpq **non e' uno spazio**. Il gate interrogherebbe il database con
un'altra configurazione. Meglio nessuna misura di una misura su un'altra cosa.

### Quattro mutazioni sopravvissute alla batteria

L'esperto dei test ha applicato **11 mutazioni** al codice di produzione e
rilanciato le batterie. Sette uccise, quattro sopravvissute:

| Mutazione | Batteria | Esito |
|---|---|---|
| `credenzialiPsql` -> no-op in **schema-forge** | 216/216 verdi | **SOPRAVVISSUTA** |
| `credenzialiPsql` -> no-op in **gestionale-crafter** | 208/208 verdi | **SOPRAVVISSUTA** |
| `clausoleHelperDb`: tolto il controllo `FINE_ISTRUZIONE` | 158/158 verdi | **SOPRAVVISSUTA** |
| `chiusuraQuadra`: tolto il salto delle stringhe | 216/216 verdi | **SOPRAVVISSUTA** |
| `stringheOscurate` non conserva la lunghezza | **14 rossi** | uccisa |
| `senzaCommentiSql` senza annidamento · `motivoNonDerogabile` -> null · `esitoContrasto` senza il fail · `cellaFirmata` -> true · `motivoPremessaVuota` -> null · `mascheraUrl` senza il ramo `host===""` | 1-2 rossi ciascuna | uccise |

La prima coppia e' la piu' istruttiva: **una difesa contro le password si poteva
spegnere del tutto in due skill su tre senza che una batteria diventasse
rossa**, perche' i test esistevano in una copia sola — e in questo stesso
pacchetto quella funzione era appena cresciuta. I test sono stati portati dove
la funzione vive.

### E tre difetti che il concilio ha trovato, non miei ma reali

- **`chiaviOggetto` non leggeva la proprieta' abbreviata.** `.update({ ruolo })`
  produceva **zero colonne**: ne' la regola dei permessi per colonna ne' quella
  dell'auto-promozione potevano scattare. E' la forma che l'esempio scritto in
  cima a quella stessa sezione usa (`.update({ status })`).
- **`corpoFunzione` prendeva la graffa del parametro destrutturato per il
  corpo.** Su `export async function salvaOrdine({ id }: { id: string })` il
  corpo letto era `{ id }`, e un'azione che chiama `richiediStaff()` come prima
  riga usciva `block` — un rosso su codice corretto.
- **`chiaviDiPrimoLivello` contava le graffe dentro le stringhe.** Una graffa
  spaiata dentro un tipo letterale (l'etichetta di un enum, che la scrive il
  progetto auditato) faceva sparire **in silenzio** tutte le tabelle successive
  dall'ancoraggio: due `block` diventavano zero.

### I costi che le riscritture avevano nascosto

Il quinto esperto ha misurato quello che nessun altro aveva misurato: non se le
funzioni nuove danno la risposta giusta, ma **quanto costano**. Quattro
quadratiche, e la peggiore l'ha introdotta il n°52.

| Funzione | Ingresso | PRIMA di P.7e | DOPO P.7e | ORA |
|---|---|---:|---:|---:|
| `scrittureNelCodice` | 3 200 scritture / 144 kB | 650 ms | **15 466 ms** | **555 ms** |
| `primoArrayJson` | 64 000 quadre mai chiuse | (non esisteva) | **9 228 ms** | **4 ms** |
| `visita` | profondità 40 000 | `RangeError` | **14 484 ms** | **16 ms** |
| `clausoleHelperDb` | 3 200 import | 180 ms | 750 ms | **99 ms** |
| `usaHelperDb` (§ M5) | 40 000 spazi fra `import` e `from` | non finiva a 4 000 | 0,1 ms | **0,6 ms** |

Il n°52 ha corretto la semantica e ha spostato `stringheOscurate` **dentro il
ciclo**: due maschere per ogni scrittura del file. È lo stesso ordine di
grandezza del ReDoS che questo pacchetto ha appena chiuso — **su un file che
nessuno definirebbe ostile**. La maschera ora si calcola una volta e viaggia; il
valore è identico.

E `visita` è la lezione più stretta: **§ L3 ha tolto la `RangeError` e ha
lasciato il costo.** Un gate che non muore e non risponde è MUTO lo stesso, che
è esattamente lo stato che L3 voleva evitare. Correggere la terminazione senza
misurare il costo non è correggere la terminazione.

### E due comportamenti persi, trovati confrontando col codice di prima

- **Un `<svg` mai chiuso** — o con una virgoletta spaiata dentro, che rende
  illeggibile il tag — teneva `profondita` a 1 fino in fondo e **si portava via
  il resto del documento**. Un `<meta name="robots" content="noindex">` più sotto
  spariva con lui, e il `block` sulla pagina dichiarata pubblica passava da 1 a
  **0**: è il verso che § M7 chiama «il peggiore», rientrato dalla porta opposta.
  La regexp di prima, senza `</svg>`, non cancellava niente — e lì si torna.
- **`visita` iterativa registrava tutte le spec di un livello prima di
  scendere**: i conteggi e il verdetto erano identici, l'**ordine** dei falliti
  no. La lista che un umano legge per triare usciva in un ordine che non era né
  quello dei file né quello d'esecuzione. La pila ora porta un nodo per elemento.


### Un test mio che asseriva una cosa falsa

Ne avevo scritto uno che pretendeva che l'interno di un template multi-riga non
producesse rilievi. Non e' vero, e non lo era nemmeno prima: lo scanner delle
spec analizza **riga per riga**, quindi le righe interne sono «codice». Il test
e' stato corretto in un **limite dichiarato**, con il verso scritto: e' il rosso
rumoroso, e portare lo stato della stringa attraverso tutto il file
riaprirebbe P3, che e' quello silenzioso.


---

## 8. I guardiani alla chiusura

```
########## BATTERIE (Node 24.18.1 — le quattro package.json usano un glob,
                     che vuole Node 21+; il node del PATH e' v20.12.2)
schema-forge         ℹ tests 228 ℹ pass 228 ℹ fail 0
gestionale-crafter   ℹ tests 230 ℹ pass 230 ℹ fail 0
flow-sentinel        ℹ tests 171 ℹ pass 171 ℹ fail 0
speed-demon          ℹ tests 147 ℹ pass 147 ℹ fail 0
                              776 verdi su 776

########## ESLINT                    ########## KNIP
schema-forge         0 rilievi       schema-forge         0 rilievi
gestionale-crafter   0 rilievi       gestionale-crafter   0 rilievi
flow-sentinel        0 rilievi       flow-sentinel        0 rilievi
speed-demon          0 rilievi       speed-demon          0 rilievi

########## SEMGREP (p/javascript + p/secrets, i quattro scripts/)
Ran 104 rules on 31 files: 0 findings.

########## GITLEAKS (per skill)
schema-forge · gestionale-crafter · flow-sentinel · speed-demon → no leaks found

########## JSCPD                          P.7d → P.7e
schema-forge         1 clone,  8 righe  →  3 cloni, 22 righe (0,59%)
gestionale-crafter   5 cloni, 48 righe  →  5 cloni, 48 righe (1,09%)
flow-sentinel        0 cloni,  0 righe  →  0 cloni,  0 righe (0%)
speed-demon          1 clone,  5 righe  →  1 clone,  5 righe (0,44%)

########## GATE DELLA REGIA
GATE REGIA: VERDE (0 falliti, 0 verifiche mancanti su 5 passi)
```

**I due cloni nuovi di schema-forge sono una decisione dichiarata**, non una
svista: sono il controllo di arità (`recordDiAritaSbagliata` +
`motivoAritaSbagliata`) portato in `erd-lib.mjs`. Le due librerie di Schema Forge
restano **indipendenti** — è la scelta scritta in testa a `progetto-lib.mjs` della
skill sorella e ripetuta qui — e otto righe duplicate costano meno di
un accoppiamento fra la libreria dell'audit e quella del diagramma. Il terzo
clone (`erd.mjs` ↔ `rls-audit.mjs`, la gestione dell'errore di psql) è
preesistente.

**Le complessità sono rientrate senza eccezioni.** I sei scanner nuovi hanno
superato la soglia 15 della casa mentre nascevano, e sono stati spezzati:
`leggiTag`/`fineTestoGrezzo`, `indiciDeroghe`/`derogaDaRiga`,
`motivoSenzaConfronto`/`findingSottoSoglia`, `dentroStringa`,
`fineStringaRaddoppiata`/`fineCommentoAnnidato`, `chiusuraQuadra`,
`saltaCommento`/`passoDentroStringa`. Un gate che viola le regole che impone non
è credibile, e questa è la terza volta che questa frase paga.

---

*Verbale di P.7e. Le uscite incollate qui sono quelle misurate su questa macchina
il 2026-08-06 e il 2026-08-07, prima e dopo ogni correzione. Il pilota non è
stato aperto in scrittura, i suoi gate non sono stati lanciati, il suo stack non
è stato toccato.*
