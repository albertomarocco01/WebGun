# Costruzione e primo collaudo di Speed Demon

> Data: 2026-07-30. Banco: `banco-prova-negozio` (Bottega Nord).
>
> Cosa distingue questa costruzione da quelle di Schema Forge e Flow Sentinel:
> il banco **non e' stato fatto per collaudare la skill**. Era gia' li',
> costruito da altri tre agenti nei giorni prima, con otto tabelle, un
> backoffice e sedici test End-to-End verdi addosso. La skill e' nata contro
> un'app che non sapeva di doverla servire.

## 0. Esito in una riga

Gate **VERDE 7/7**, batteria E2E **16/16** rilanciata dalla skill contro la
build di produzione, **tre difetti SEO veri** trovati su un progetto che
Lighthouse valutava **SEO 100** — e **quattro difetti della skill**, tre dei
quali erano falsi verdi o diagnosi bugiarde.

## 1. Cosa e' stato costruito

| Pezzo | Cosa |
|---|---|
| `SKILL.md` | tre leggi, sette regole non negoziabili, cinque comandi, i sette passi del gate, §Cosa un gate verde NON prova |
| `scripts/gate-lib.mjs` | le regole pure: contratto, statistica, budget, dev-vs-build, metatag, contratto d'uscita |
| `scripts/verify.mjs` | il guscio di I/O: sette passi con id stabili, `--json`, `--url` **senza default** |
| `scripts/gate-lib.test.mjs` | **42 test**, ognuno col caso in cui la regola scatta e quello in cui non deve |
| `references/` | `misurazione.md` · `ottimizzazioni.md` · `seo.md` |
| `resources/templates/` | `performance.md` (il contratto) · `handoff-speed-demon.md` |

### Le tre leggi, e perche' sono quelle

1. **La misura prima della modifica, e su una build di produzione.** Senza
   baseline il «dopo» e' un'opinione; e i numeri di `next dev` non sono numeri.
2. **La rete prima della corsa.** Speed Demon e' il primo agente della pipeline
   che **modifica codice gia' collaudato da un altro agente**. Il passo
   `rete-verde` **rilancia** il gate di Flow Sentinel invece di fidarsi
   dell'handoff, perche' un handoff e' il ricordo di un'altra esecuzione.
3. **Un numero solo non e' una misura.** Mediana di N giri (minimo 3) e
   dispersione dichiarata. Una dispersione ampia rende la misura **inaffidabile,
   non bassa** — e la differenza conta, perche' un numero basso fa correggere il
   sito e un numero inaffidabile fa rimisurare.

## 2. I tre difetti dell'app, su un progetto con SEO 100

```
$ npx lighthouse http://127.0.0.1:3100/ --preset=desktop --only-categories=seo
performance=100 accessibility=100 best-practices=96 seo=100
```

Sulla stessa pagina, nello stesso momento:

```
$ curl -s http://127.0.0.1:3100/ | grep -i 'canonical'
(niente)
$ for p in / /accedi /admin; do curl -s "http://127.0.0.1:3100$p" | grep -o '<title>[^<]*'; done
<title>Bottega Nord
<title>Bottega Nord
<title>Bottega Nord
```

1. **Nessun `canonical`** su nessuna pagina.
2. **Lo stesso `<title>` su ogni rotta del sito**, gestionale compreso. Due
   pagine con lo stesso titolo sono, per chi indicizza, una pagina raddoppiata.
3. **`/admin/*` senza `noindex`.**

**Il punteggio SEO di Lighthouse controlla che i tag esistano e siano leggibili,
non che dicano cose diverse su pagine diverse.** Il passo `seo-meta` — che legge
i tre tag nell'**HTML servito** e li pretende su ogni pagina dichiarata — li ha
trovati tutti e tre al primo giro. Su questo progetto il valore della skill e'
stato interamente in cio' che Lighthouse non guarda.

Corretti (handoff 15 §3), e con una scoperta che vale piu' della correzione: il
`noindex` messo su `/admin` **non arriva a nessun crawler**, perche'
`richiediStaff()` reindirizza prima del rendering. Resta come difesa in
profondita', e il commento nel codice dice che e' quello e non altro.

## 3. I quattro difetti della skill

### 3.1 Il gate diceva `pass` su una dev server — falso verde

Trovato **solo** col sabotaggio, cioe' puntando il gate dove non doveva andare:

```
$ node verify.mjs --url http://127.0.0.1:3001     # la dev server
OK    build di produzione (non dev server)
        http://127.0.0.1:3001 (HTTP 200) · nessuno degli indizi di dev server
```

Gli indizi cercati erano quelli ovvi — `react-refresh`,
`/_next/static/development/` — e un'ora prima **c'erano davvero**. Dopo qualche
ricompilazione la stessa dev server aveva smesso di servirli.

Chiuso con due indizi **strutturali**, misurati sullo stesso progetto servito
nei due modi nello stesso momento:

```
dev  (next dev -p 3001):   /_next/static/chunks/main-app.js?v=1785407832332
                           /_next/static/chunks/app-pages-internals.js
prod (next start -p 3100): /_next/static/chunks/main-app-f1e4859868969239.js
                           (nessun `?v=`, nessun `app-pages-internals`)
```

In produzione i chunk portano l'hash nel **nome** e non hanno bisogno di un
parametro anti-cache. E' una differenza che non puo' sparire senza che sparisca
il modo in cui Next serve lo sviluppo. Test di regressione con **i due HTML
veri incollati**.

### 3.2 «Nessun giro riuscito» su una macchina dove Lighthouse gira — diagnosi bugiarda

Due cause in fila, e ognuna nascondeva l'altra.

```
npx risolto in: C:\Program Files\nodejs\npx
"C:\Program" non e' riconosciuto come comando interno o esterno
```

La prima riga di `where npx` e' lo **script senza estensione** (per Git Bash),
che Windows non sa eseguire; la seconda e' lo shim `.cmd`. E' esattamente il
difetto che Flow Sentinel aveva gia' pagato il 2026-07-28, e che avevo citato in
un commento — «prezzo gia' pagato, non si ripaga» — prima di ripagarlo lo stesso
sei righe piu' sotto.

Risolto quello, restava:

```
...npx.cmd lighthouse <url> --preset=desktop                  → status 0, 181688 byte
...npx.cmd lighthouse <url> --preset=desktop \
           "--chrome-flags=--headless=new --no-sandbox ..."   → status 1
```

Un argomento **con spazi** passato da `cmd /c` fa collassare il virgolettato del
**programma**, che sta tre argomenti prima: per questo l'errore parla di
`C:\Program` e non dell'argomento colpevole, ed e' il motivo per cui la diagnosi
ha richiesto due giri. La difesa non e' virgolettare meglio (misurato: le
virgolette manuali **peggiorano** le cose, Node quota gia') — e' **non passare
argomenti con spazi**, e riconoscerli prima di lanciare.

### 3.3 Una GET caduta diventava «manca il metatag» — rosso nella direzione sbagliata

Subito dopo sei giri di Lighthouse, il passo `seo-meta` riportava:

```
[block] pagina home: HTML non letto per `/`: i metatag non sono stati verificati
```

su un server che rispondeva `200` a ogni `curl` lanciato un secondo dopo.
Chiuso in due modi, e servivano entrambi: un **secondo tentativo** nella GET, e
la riclassificazione di «non letto» da `block` a **MANCANTE**. Una pagina che
non si e' riusciti a leggere non e' una pagina senza metatag: e' una verifica
che non e' stata fatta. MANCANTE tiene comunque il gate rosso — non e' un modo
per far passare qualcosa, e' un modo per non mandare qualcuno a cercare un tag
che c'e'.

### 3.4 Due test scritti male, trovati facendoli girare

Uno con un'asserzione priva di senso, uno che pretendeva il contrario di cio'
che il codice fa giustamente (un giro fallito **si scarta**, non vale zero).
Vale la pena scriverlo: sono stati trovati al primo `node --test`, cioe' dalla
sola cosa che distingue un test scritto da un test che gira.

## 4. Il sabotaggio

| Cosa e' stato rotto | Esito atteso | Esito |
|---|---|---|
| gate puntato sulla **dev server** | rosso su `build-produzione`, passi a valle MANCANTI | **ROSSO 3 falliti, 3 mancanti** — e i due indizi stampati |
| handoff assente | rosso su `contratto-uscita` | **ROSSO** |
| `canonical` assente (difetto vero, prima della correzione) | rosso su `seo-meta` | **ROSSO** su entrambe le pagine |
| `--giri 2` | rifiuto all'avvio, non una misura peggiore | **uscita 2**, «sotto i tre giri non esiste una mediana» |
| gate lanciato **senza `--url`** | rifiuto, non un `localhost:3000` indovinato | **uscita 2**, «e' cosi' che si misura l'app di un altro progetto» |

La prima riga e' quella che conta, ed e' anche l'unica che ha trovato un difetto
vero: **un gate che non e' mai stato puntato dove non doveva non e' stato
collaudato.**

## 5. Numeri

| Cosa | Numero |
|---|---|
| Passi del gate | 7, id stabili |
| Test degli script | **42 verdi** |
| Pagine misurate sul banco | 2, tre giri ciascuna |
| Dispersione misurata | **0** su tutte le categorie di entrambe le pagine |
| Difetti dell'app trovati | **3** (SEO), tutti corretti |
| Difetti della skill trovati | **4**, tutti corretti con test di regressione |
| Classi di sabotaggio provate | 5 su 5 rosse |
| Batteria E2E dopo le modifiche | **16/16**, contro la build di produzione |

## 6. Cosa questo collaudo NON dimostra

- **Che la skill sappia ottimizzare.** Su questo banco non c'era niente da
  ottimizzare: due pagine, nessuna immagine, nessun font esterno, 100/100 in
  partenza. `plan` e `tune` non sono mai stati messi alla prova su un guadagno
  vero, e la parte di skill che elenca ottimizzazioni col loro costo e' **prosa
  non ancora eseguita**.
- **Che il gate regga su un progetto di qualcun altro.** E' il P2 che manca:
  qui la skill e l'app sono state guardate dalla stessa mano nello stesso
  pomeriggio.
- **Che la soglia di dispersione sia tarata.** Dieci punti e' un numero scelto.
  Sul banco la dispersione e' stata zero, quindi la regola non e' mai scattata
  sul campo: il suo test esiste, la sua taratura no.
