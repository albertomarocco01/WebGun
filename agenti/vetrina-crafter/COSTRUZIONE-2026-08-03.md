# Costruzione (P1) di Vetrina Crafter

> Verbale della fase P1, chiusa il **2026-08-03**. Mandato:
> `prompts/P1-costruzione.md` (deliverable 1-3, consegnati la mattina) e
> `prompts/P1-ripresa.md` (deliverable 4-9, questo verbale).
> Banco: **`banco-prova-controtempo`** — Scuola di Musica Controtempo, Bologna.
> Ogni uscita qui sotto è **incollata**, non riassunta: dove c'è un numero, c'è
> un comando che l'ha prodotto.

## 0. Esito in una riga

Il gate ha smesso di essere codice provato su fixture e ha misurato un sito vero:
**VERDE 10/10 su `banco-prova-controtempo`**, sopra uno schema che il gate di
schema-forge chiude **VERDE 9/9**. Sette comandi su sette esercitati. Il
sabotaggio ha trovato **tre difetti del gate** e uno del progetto generato, tutti
chiusi con un test; la misura ha smentito **quattro premesse** della specifica,
una delle quali era una riga di dottrina della casa.

## 1. Cosa è stato costruito

**Il banco, dal brief al sito servito.** Dominio scelto perché *non* è né
e-commerce né sanitario — i due su cui questa casa ha già generalizzato — e
perché ha la forma esatta che questa skill deve reggere: un catalogo pubblico,
una rotta dinamica, e testi di sezione che il cliente cambia da solo.

| Pezzo | Come | Numeri |
|---|---|---|
| schema | **eseguendo schema-forge**, Flusso 1 completo | 3 migrazioni + 1 di `evolve`, 4 tabelle, 1 vista `security_invoker`, 2 funzioni, seed idempotente, 12 asserzioni pgTAP |
| privilegi espliciti | prescritti da `forge` dopo P.8 | `revoke all` + `grant` per `anon`/`authenticated`/`service_role` **in ogni migrazione**, e un `grant update` **per colonna** su `site_content` |
| vetrina | col flusso vero della skill: `specchio` → `scaffold` → `pagine` → `audit` → `handoff` → `verify` | 5 pagine, 6 slot, 5 primitive nella cucitura, 1 solo client Supabase |
| app servita | build di produzione, porta 3140 | 13 pagine statiche, `Revalidate 10m` su tutte e cinque le rotte |

**La migrazione dei privilegi c'è, e non a mano.** Il mandato chiedeva di
verificare che `forge` la producesse dopo P.8: la produce, e la produce
**dentro la migrazione della tabella** invece che in coda. Sul banco ha anche
fatto il suo mestiere subito — il `revoke` toglie `TRUNCATE`, che la RLS non
filtra, e il test pgTAP che lo attacca (`l'anonimo non tronca la tabella dei
contenuti`) passa perché quella riga esiste.

**I sette comandi, tutti esercitati.**

| Comando | Come | Esito |
|---|---|---|
| `specchio` | riformulate 5 pagine, fonti, gerarchia e **cosa non esiste**; STOP; confermato dall'orchestratore e scritto in `docs/vetrina.md` e nell'handoff §2 | il contratto è la sola cosa che il gate legge come «deciso da qualcuno» |
| `scaffold` | `vetrina.config.json`, layout con `lang="it"` e salto al contenuto, cucitura, client anonimo, lettore degli slot | `audit` statico 3/3 al primo colpo |
| `pagine` | 5 pagine, una alla volta, ognuna col suo stato vuoto; `not-found` sulla rotta dinamica | `generateStaticParams` prerende le 6 istanze pubblicate |
| `audit` | `node …/vetrina-audit.mjs` senza app accesa | `18 file letti sotto src/ · 7 sotto src/app · 6 nella cucitura` |
| `evolve` | **caso E**: la segreteria rinomina uno slot a monte | §4 |
| `verify` | il gate, dieci passi | §5 |
| `handoff` | `docs/handoff/08-vetrina-crafter.md`, **prima** del gate | il numero si conta guardando la cartella: c'era `07-schema-forge.md` |

## 2. I tre difetti che il gate ha trovato di sé stesso

Nessuno dei tre si vedeva leggendo il codice. Sono usciti puntando il gate dove
non doveva, ed è il motivo per cui `references/sabotaggio.md` esiste.

### 2.1 Sulla dev server accusava l'imputato sbagliato — diagnosi bugiarda

Classe D del sabotaggio, seconda metà. `next dev` sulla 3141, gate puntato lì:

```
FAIL  identita' dell'app servita
        http://127.0.0.1:3141 (HTTP 200) risponde, ma NON e' l'app di questo progetto.
          build id di C:/Users/…/banco-prova-controtempo: afZapZ2L0jtWd88MW3xcM
          non compare da nessuna parte nell'HTML servito da quell'indirizzo.
        Sta rispondendo un'altra applicazione sulla stessa porta: …
```

L'applicazione era **proprio quella**, servita in sviluppo. Nessuno dei sette
indizi di dev server era scattato, e il motivo è strutturale: sono tutti
dell'era Webpack (`?v=`, `app-pages-internals`, `react-refresh`, `webpack-hmr`,
`__nextDevClientId`, …) e **da Next 16 il default è Turbopack**. Misurato sullo
stesso progetto servito nei due modi nello stesso momento:

| indizio | dev | prod |
|---|---|---|
| tutti e sette gli storici | 0 | 0 |
| `hmr-client` in un percorso di chunk | 1 | 0 |
| `next-devtools` in un percorso di chunk | 1 | 0 |
| la parola `turbopack` | 1 | **1** ← non serve: in produzione c'è `turbopack-<hash>.js` |

Chiuso con i due indizi che reggono, **ancorati a `/_next/static/chunks/`** così
una pagina che *parla* di HMR non fa fallire il proprio gate. Dopo:

```
FAIL  identita' dell'app servita
        http://127.0.0.1:3141 (HTTP 200) e' una DEV SERVER, non una build di produzione
          indizio: chunk `hmr-client` di Turbopack — il canale di aggiornamento a caldo esiste solo in sviluppo
          indizio: chunk `next-devtools` — il bundle degli strumenti di sviluppo non entra in una build di produzione
```

Tre test, uno dei quali è il caso che **non** deve scattare.

### 2.2 Una pagina non scaricata rendeva muti i suoi slot — falso verde

Classe E. Con `/contatti` a 404, il passo 7 dava giustamente `block`, ma il
passo 9 chiudeva **`OK … nessun rilievo`** — e i due slot di quella pagina
(`contatti-orari`, `pie-pagina`) non erano stati verificati affatto: la regola
faceva `if (testo !== undefined && …)` e su `undefined` non diceva niente.
È la forma esatta del difetto che questa casa combatte da tre skill, dentro il
passo che la Legge n°3 rende verificabile. Dopo:

```
MANC  contenuti dal database
        slot `contatti-orari`: la pagina contatti (/contatti) non e' stata scaricata — non si e' potuto verificare se il testo compare in pagina
        slot `pie-pagina`: la pagina contatti (/contatti) non e' stata scaricata — non si e' potuto verificare se il testo compare in pagina
```

### 2.3 Il frammento distintivo poteva essere un UUID — rosso falso, diagnosi bugiarda

Trovato tarando la soglia (S2). Il frammento si ricava con `to_jsonb(t)`, che
restituisce **come testo** anche `id` (36 caratteri) e `created_at`/`updated_at`
(32 ciascuna). Su uno slot il cui contenuto più lungo sta sotto i 36, «il più
lungo dei valori di testo» è l'UUID della riga. Misurato accorciando il corpo di
`pie-pagina` a 29 caratteri, su una pagina che mostrava esattamente ciò che il
database diceva:

```
FAIL  contenuti dal database
        [block] slot `pie-pagina` → contatti (/contatti): il valore pubblicato nel
        database non compare nel testo servito della pagina che dovrebbe mostrarlo:
        «44444444-4444-4444-8444-000000000006…»
```

Chiuso scartando **per forma** UUID e timestamp ISO dai candidati. Alzare la
soglia sopra 36 avrebbe nascosto il difetto trasformandolo in un MANCANTE su
ogni slot corto: il difetto non era il numero, era la candidatura.

### 2.4 Il quarto, che non è del gate ma la skill lo produceva

Classe H (colonna rinominata in `database.types.ts`): **non scattava**. I moduli
del banco riscrivevano i tipi a mano e chiudevano con `as unknown as`, quindi fra
i tipi generati e le pagine non c'era nessuna catena da rompere — il controllo
più forte della pipeline era spento, e niente lo diceva. Derivati i tipi con
`Pick<Database["public"]["Tables"][…]["Row"], …>`, la stessa rinomina dà:

```
FAIL  tipi TypeScript
        `tsc --noEmit`: 5 errori
        src/app/corsi/[slug]/page.tsx(32,7): error TS2322: Type 'unknown' is not assignable to type 'string'.
        src/app/corsi/page.tsx(39,17): error TS2322: Type 'unknown' is not assignable to type 'string'.
        src/modules/corsi/query.ts(25,3): error TS2344: Type '"durata_settimane" | … | "titolo"' does not satisfy the constraint '… | "titolo_rinominato" | …'.
```

`references/pagine-e-dati.md` ora lo prescrive.

## 3. Le tre decisioni sospese, chiuse con la misura

### S1 — slot dichiarato senza riga pubblicata: **`block`**

I due casi del mandato, piantati sullo slot `docenti-intro` della pagina
`/docenti`:

| caso | testo servito da `/docenti` | `<title>` | risposta del database |
|---|---|---|---|
| `is_published = false` | «Chi insegna» e **niente sotto** | da «Chi insegna · Controtempo» a «Docenti · Controtempo» | interrogata, zero righe |
| riga cancellata | **identico** | identico | identico |

Non si distinguono, e in tutti e due il database **ha risposto**: è una misura
riuscita con esito negativo, non una verifica che non si è potuta fare. MANCANTE
avrebbe mandato chi legge il rosso a controllare `psql`, la porta e la
connessione — l'imputato sbagliato.

```
FAIL  contenuti dal database
        [block] slot `docenti-intro` → docenti (/docenti): il contratto lo dichiara e nel
        database non c'e' nessuna riga pubblicata con questa chiave: la pagina serve la
        sua sezione senza il testo che dovrebbe contenere
```

**E la metà che resta MANCANTE, senza la quale la decisione sarebbe sbagliata:**
quando la tabella non è stata interrogata affatto, il codice di prima avrebbe
prodotto un `block` **per ogni slot dichiarato**, cioè N diagnosi che mandano a
cercare righe che magari ci sono tutte. Le due condizioni sono ora separate, con
un test ciascuna.

### S2 — la soglia distintiva: **resta 24**, e il numero da guardare era un altro

Frammenti di contenuto dei sei slot veri del banco: **43, 183, 247, 257, 271,
314** caratteri. A soglia 24 restano fuori **zero slot su sei**, e il più corto
sta **19 caratteri sopra**. La taratura conferma il ripiego.

Ma la misura interessante è che **24 era sotto il rumore**: nei candidati
entravano `id` (36) e i due timestamp (32), quindi ogni soglia sotto 33 era
decorativa. Vedi §2.3. Il numero resta 24 ed è dichiarato nel contratto del
banco.

### S3 — i due rilievi sulle date: uno dei due falsi positivi **non esiste**

| rilievo | falso positivo dichiarato in P0 | misurato |
|---|---|---|
| firma del contratto più vecchia dell'handoff di schema-forge | «un handoff riscritto per un refuso invecchia una firma buona» | **non esiste**: `touch` sull'handoff → nessun rilievo. La data si legge dal **testo**, non dal filesystem. Il falso positivo vero è più raro: qualcuno che *cambia la data* dentro l'handoff |
| build più vecchia dei sorgenti | «un `git checkout` o un formattatore che tocca file senza cambiarli» | **esiste ed è reale**: `touch src/components/ui/Card.tsx` → `[issue] .next/BUILD_ID: la build servita e' piu' vecchia del sorgente piu' recente` |

Frequenza su un ciclo normale costruisci → rilancia: **0 scatti su 9 esecuzioni**
per entrambi. Il vero positivo del primo è scattato una volta sola, ed è stato
durante l'`evolve` — cioè esattamente quando doveva.

Entrambe le regole restano `issue` e restano come sono. Per la seconda,
l'alternativa (confrontare il contenuto invece della data) vorrebbe dire tenere
un'impronta dei sorgenti dentro il gate: un secondo stato da mantenere allineato,
per chiudere un rilievo che si spegne rilanciando la build.

## 4. `evolve`, esercitato su un cambio vero

Caso E della sua tabella. La segreteria rinomina lo slot `home-perche-noi` in
`home-come-lavoriamo` («"perché noi" suona come una pubblicità»). Il cambio
arriva dal database, e **i tipi non hanno niente da dire**: una chiave di slot è
una stringa.

A dirlo sono state due regole indipendenti, nella stessa esecuzione:

```
OK    contratto della vetrina
        5 pagine · 6 slot · confermato da: ORCHESTRATORE (2026-08-03)
        [issue] docs/vetrina.md: firmato il 2026-08-03, ma l'handoff di schema-forge e'
        del 2026-08-04: lo schema e' cambiato dopo che qualcuno ha firmato l'elenco
FAIL  contenuti dal database
        [block] slot `home-perche-noi` → home (/): il contratto lo dichiara e nel database
        non c'e' nessuna riga pubblicata con questa chiave: …
```

Riparato **in un giro solo**, come prescrive la procedura: contratto (tabella
degli slot + riga `Contenuti da:`), pagina (`src/app/page.tsx`) e **nuova firma**
insieme. A monte, schema-forge ha riallineato il seed e il proprio test pgTAP,
che citava la chiave vecchia — e il suo gate lo ha detto:

```
FAIL  pgTAP (test delle policy)
        # Failed test 9: "la redazione riscrive il corpo di uno slot: la policy non nega e basta"
```

Dopo il riallineo: schema **VERDE 9/9**, vetrina **VERDE 10/10**.

## 5. Il sabotaggio

Sette classi del mandato + tre che completano il quadro + sei controlli al
contrario + sei classi cieche. Esiti riga per riga, con le uscite, in
`references/sabotaggio.md` (colonne «Esito misurato» ora compilate). Qui il
riepilogo:

| Gruppo | Provate | Come atteso | Difetti trovati |
|---|---|---|---|
| A-G (mandato) | 7 | 6 | 1 diagnosi bugiarda (D, dev server) + 1 falso verde (E, slot muti) + 1 ricetta sbagliata su Next 16 (E) |
| H, I, L | 3 | 2 | 1 controllo spento sul progetto (H, tipi) |
| controlli al contrario | 6 | 6 | nessun rifiuto indebito |
| classi cieche | 6 | 5 | 1 premessa smentita (colonna non disegnata) |

**Le classi cieche sono restate verdi, ed è il risultato**: contratto riscritto
per descrivere una pagina che non esiste → verde; bottone reimplementato a mano
→ verde; `Nessuno slot.` su un testo cablato → verde; rotta `route.ts` non
enumerata → verde. Ognuna con la sua uscita nella reference.

## 6. Le quattro premesse che il banco ha smentito

1. **«Il frammento distintivo è il più lungo dei valori di testo dello slot.»**
   Falso: `to_jsonb(t)` porta con sé la chiave primaria e le date. §2.3.
2. **«Una colonna selezionata e non disegnata arriva lo stesso al browser,
   nell'HTML servito e nel payload RSC.»** Misurato aggiungendo `id, pubblicato,
   created_at` al `select`: **zero occorrenze** nell'HTML e **zero** nel payload
   RSC richiesto a parte. Di un Server Component viaggia l'**uscita**, non i suoi
   dati. Vale appena la riga passa a un Client Component come prop, o se la query
   si fa nel browser — cioè dopo un `"use client"` scritto un mese dopo da
   qualcun altro.
   **E quello che è pubblico davvero è un'altra cosa**, che va scritta al posto
   di quella riga: la chiave anonima sta nel bundle, e con quella chiunque chiede
   a PostgREST le colonne che il `grant` e la policy concedono. Misurato:
   ```
   curl ".../rest/v1/corsi?select=id,created_at,in_evidenza" -H "apikey: <anon>"
   [{"id":"33333333-…-000000000001","created_at":"2026-08-03T16:49:10…","in_evidenza":true}, …]
   ```
   Tre colonne che nessuna pagina seleziona e nessuna disegna. **Ciò che è
   pubblico lo decide il modello di accesso a monte, non l'elenco del nostro
   `select`** — e l'handoff §4 ora porta due tabelle invece di una.
3. **«Un handoff riscritto per un refuso invecchia una firma buona.»** Non
   accade: la data si legge dal testo. §S3.
4. **La ricetta della classe E** (`page.tsx` → `_page.tsx`) **non funziona su
   Next 16**: la build muore prima, sui tipi di rotta generati.

## 7. Due cose di Next 16 che si pagano una volta sola

Non sono difetti della skill. Sono i due modi in cui su questo stack si misura
il sito di ieri credendo di misurare quello di adesso, e stanno nella reference
del sabotaggio perché il prossimo non li ripaghi.

- **La Data Cache sopravvive a `next build`.** Cambiata una riga nel database e
  ricostruito, la pagina serviva ancora il testo di prima: il gate diventa
  rosso — correttamente — su un codice corretto. Il `hint` di `contenuti-vivi`
  ora elenca tutte e tre le cause; si chiude con
  `rm -rf .next/cache/fetch-cache`.
- **I tipi di rotta generati sono uno stato.** Tolta una rotta, il validatore
  generato la cerca ancora e la build muore con
  `Cannot find module '../../../src/app/contatti/page.js'`, additando un file
  che nessuno ha scritto. Si chiude con `rm -rf .next/dev/types .next/types`.

## 8. Il gate sul banco pulito

```
GATE VETRINA: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)

OK    contratto della vetrina
        5 pagine · 6 slot · confermato da: ORCHESTRATORE (2026-08-04)
        nessun rilievo
OK    tipi TypeScript
        `tsc --noEmit` pulito
OK    cucitura dei componenti
        18 file letti sotto src/ · 7 sotto src/app · 6 nella cucitura src/components/ui
        primitive dichiarate: Bottone, Card, Sezione, Navigazione, PiePagina
        nessun rilievo
OK    chiavi e client dei dati
        18 file letti sotto src/ · 7 sotto src/app · 6 nella cucitura src/components/ui
        moduli client ammessi: src/lib/supabase/public.ts
        nessun rilievo
OK    accessibilita' statica (jsx-a11y)
        12 file con markup lintati in src/app, src/components/ui
        nessun rilievo
OK    identita' dell'app servita
        http://127.0.0.1:3140 (HTTP 200) · build id VzoKIsbjQBeR2VfQ54ZIm · nessuno degli indizi di dev server
OK    pagine dichiarate e pagine servite
        5 pagine dichiarate · 5 rotte pubbliche nei sorgenti · 2 escluse dal contratto
        nessun rilievo
OK    segnaposto nel testo servito
        5 pagine lette (senza `<script>` e `<style>`: dentro c'e' il payload RSC, non la pagina)
        nessun rilievo
OK    contenuti dal database
        database: postgresql://postgres:***@127.0.0.1:57422/postgres · schemi: public, graphql_public · soglia distintiva: 24 caratteri
        nessun rilievo
OK    contratto d'uscita (handoff)
        docs/handoff/08-vetrina-crafter.md · verdetto misurato: VERDE
        nessun rilievo
```

Uscita del processo: **0**.

E quello di schema-forge sullo stesso banco, perché la vetrina sta in piedi sulle
policy di qualcun altro:

```
GATE SCHEMA: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)
```

## 9. Numeri

| Cosa | Numero |
|---|---|
| Test degli script | **122 verdi** (21 suite, 0 falliti, 4,6 s) — erano 113 |
| Passi del gate eseguiti su un progetto vero | **10 su 10** (erano 0) |
| Comandi esercitati | **7 su 7** (erano 0) |
| Classi di sabotaggio provate | 7 del mandato + 3 + 6 controlli + 6 cieche = **22** |
| Difetti del gate trovati sabotando | **3**, tutti chiusi con un test |
| Difetti del progetto generato trovati sabotando | **1** (i tipi staccati dallo schema) |
| Premesse della specifica smentite | **4** |
| Migrazioni del banco | 4 (3 di fondazione + 1 di `evolve`) |
| Asserzioni pgTAP sul banco | 12, di cui **1 positiva di controllo** |
| Guardiani sugli script | ESLint **0/0** · knip **pulito** · jscpd **0 cloni** su 3 121 righe |

## 10. Cosa questa costruzione NON dimostra

- **Che le pagine del banco siano quelle giuste.** Il contratto l'ha firmato chi
  costruiva (`Confermato da: ORCHESTRATORE`), e il gate legge la firma, non la
  sua verità. È il limite ereditato dalla P0, e si chiude solo in P3 con un
  committente.
- **Che il gate regga su un dominio diverso.** Un banco solo, uno stack solo
  (Next 16 + Turbopack + Supabase locale), sei slot. Il collaudo avversario (P2)
  parte da un dominio diverso apposta, ed è il primo posto in cui questo verbale
  verrà messo in dubbio.
- **Che le euristiche dichiarate tengano.** `puntaA` confronta la coda di un
  percorso: sul banco non c'era nessun monorepo a ingannarla. I segnaposto sono
  cercati come stringhe: sul banco nessuna pagina parlava di template.
- **Che il gate sia veloce.** Non è stato cronometrato. Su cinque pagine sono
  secondi; su trenta non lo sa nessuno, e un gate che nessuno rilancia è un
  documento.
- **Niente sul modulo pubblico.** Il banco dichiara «Nessuna scrittura pubblica»,
  quindi il caso di frontiera del §Perimetro — la vetrina che apre un percorso di
  scrittura all'anonimo — non ha una misura.
- **Niente su come si vede.** Nessun passo ha aperto una finestra. Sul banco le
  immagini sono cinque JPEG da 1×1 pixel: il caso in cui «l'immagine arriva» e
  non si vede niente.
- **Che il sito regga il contenuto vero.** Sei corsi, quattro docenti, sei slot.
  Una griglia che sta in piedi con sei schede può diventare illeggibile con
  sessanta, e nessuna delle tre regole di `contenuti-vivi` lo dice.
