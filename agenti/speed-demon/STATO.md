# STATO — Speed Demon

**A che punto è:** strumento collaudato, girato verde su un'app viva (il pilota `cavia`), **mai usato per un cliente vero** — l'elenco delle pagine che contano non l'ha mai firmato un committente.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria degli script **147/147**, 0 falliti (rimisurata oggi con `npm test`); gate **VERDE 8/8** dalla radice del pilota `cavia` contro la build viva su `127.0.0.1:3621`, 5 pagine, passo `contrasto` compreso.

## Cosa fa

Misura un sito Web Gun già costruito e già testato, propone le ottimizzazioni **col loro costo**, le applica una alla volta rimisurando e rilanciando la rete E2E, e si rifiuta di consegnare se ha misurato una dev server, se la rete è rossa, se una soglia non regge senza deroga scritta e firmata, o se una pagina pubblica esce senza `title` unico, `description` e `canonical` proprio. Arriva **dopo flow-sentinel** (che gli lascia la rete) e **prima di site-doctor e launchpad**. Comandi: `measure`, `plan`, `tune`, `verify`, `handoff`.

Le tre leggi:

1. **La misura prima della modifica, e su una build di produzione.** I numeri di `next dev` non sono numeri: un LCP che dipende dal compilatore.
2. **La rete prima della corsa.** La batteria E2E di flow-sentinel verde **prima** e di nuovo **dopo ogni ottimizzazione applicata**. Se il progetto non ha una batteria, il passo è MANCANTE: mai un verde.
3. **Un numero solo non è una misura.** Ogni misura è la mediana di N giri (default 3; `--giri` non scende sotto 3) con la **dispersione** dichiarata. Sopra la soglia di dispersione la misura non è «bassa»: è MANCANTE. E una dispersione alta non parla solo della macchina occupata: può dire che la **pagina è troppo pesante per riprodursi** due volte uguale — `/immobili` ballava di 8 punti a 15 MB di peso, e dopo l'ottimizzazione è scesa a dispersione 0. «Rimisura più tardi» e «alleggerisci la pagina» sono due diagnosi diverse, e la seconda si vede solo se qualcuno guarda il peso accanto alla dispersione.

Sopra le tre leggi vale la costituzione, dove la performance è **ultima**: un 100/100 ottenuto togliendo un `alt` o il focus visibile è un punteggio rubato.

## Il gate

`scripts/verify.mjs` — **8 passi**, id stabili, `--json`.

| passo | cosa prova |
|---|---|
| `contratto-performance` | `docs/performance.md` esiste, dichiara almeno una pagina con la sua soglia ed è firmato (non col segnaposto) |
| `rete-verde` | rilancia **davvero** il gate di flow-sentinel, adesso: non si fida dell'handoff |
| `build-produzione` | l'URL risponde, non è una dev server, e l'HTML servito contiene il `.next/BUILD_ID` **di questo progetto** |
| `misura` | N giri di Lighthouse per pagina, mediana e dispersione; la pagina il cui `finalDisplayedUrl` non è quello richiesto viene **scartata** |
| `budget` | ogni pagina regge la soglia o ha una deroga scritta **e firmata**; su `accessibility` la deroga vale solo **sopra la baseline dichiarata** |
| `contrasto` | l'audit `color-contrast` letto **per sé**, non il punteggio della categoria `accessibility` che lo pesa insieme ad altri venti |
| `seo-meta` | metatag nell'HTML servito senza seguire i rimandi: `title` e `canonical` unici e non condivisi, `description`, nessun `noindex` (corpo o `X-Robots-Tag`) |
| `contratto-uscita` | l'handoff esiste, non ha segnaposto rimasti, e la sua riga `Gate:` combacia col verdetto di **questa** esecuzione |

Uno strumento assente vale **MANCANTE**, non `PASS`: un gate rosso per verifiche mancanti resta rosso.

Come si lancia, dalla radice del progetto generato:

```
export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"   # Lighthouse vuole Node 22+
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3621 [--giri N] [--json]
```

`--url` non ha default: senza, ripiega sulla riga `URL misurato:` del contratto, altrimenti si rifiuta di indovinare — un `localhost:3000` indovinato è il modo in cui si misura l'app di un altro progetto stampando `pass`. Il gate parla da **entrambi i canali**, percorso reale e junction `.claude/skills/speed-demon/scripts/verify.mjs` (provato il 2026-08-04, con un test che lo invoca attraverso una junction vera).

**Due trappole della macchina, misurate.** (1) Col Node 20 di sistema Lighthouse parte, ma l'audit `canonical` va in errore e porta l'intera categoria SEO a `null`: da qui il `PATH` qui sopra. (2) Dopo i giri restano **Chrome orfani**: si chiudono guardando la **riga di comando**, solo gli headless temporanei e mai il Chrome del committente.

## Come si prova

```
cd agenti/speed-demon
npm test                                  # 147 test, 0 falliti (misurato 2026-08-07)
node node_modules/eslint/bin/eslint.js scripts/   # 0 errori, 1 warning (vedi Debito)
node node_modules/knip/bin/knip.js        # 0 rilievi
```

Poi il gate, dalla radice di un progetto generato, col comando della sezione precedente.

I due banchi su cui il gate ha girato prima del pilota — `banco-prova-negozio` e `banco-prova-immobiliare` — **non stanno più sul disco** (`../../DECISIONI.md` §25): si ripescano con `git checkout 67f9001 -- banco-prova-negozio` (o `banco-prova-immobiliare`).

Lighthouse è **fissato dentro la skill** (`lighthouse@13.4.1` in `node_modules/`, lanciato con `process.execPath`), e col gate dei flussi annidato pure: questo gate **non cerca più nessun binario per nome**, esegue due percorsi pieni. La classe «il progetto auditato sceglie il binario che lo giudica» qui non esiste più per costruzione.

## Cosa NON è mai stato provato

- **Che le pagine dichiarate siano quelle giuste.** Nessun committente ha mai firmato l'elenco: sui due banchi la riga `Confermato da:` l'ha scritta chi costruiva o chi collaudava, sul pilota è una firma **per delega** (§D14), che per decisione esplicita **non chiude** questo punto. Il gate legge la firma, non la sua verità: una baseline impeccabile sulle pagine sbagliate passa il gate ed è comunque da buttare. Si chiude con un cliente, non con un collaudo.
- **Che esistano i difetti che il profilo dichiarato non misura.** Il profilo scritto nel contratto (`mobile` o `desktop`) decide **quali difetti esistono**, non solo quanto sono alti i punteggi: un calcolo sincrono in idratazione — un piano d'ammortamento in un componente client — produce **478 ms di TBT in mobile e 0 ms in desktop**. Su un contratto che dichiara `desktop`, `plan` non lo propone, e fa bene: sarebbe lavoro senza un numero che lo giustifichi. Ma chi sceglie il profilo sta scegliendo l'elenco dei difetti visibili, e la stessa build può valere 14 punti di differenza fra i due: la scelta va dichiarata nel contratto e scritta nell'handoff, perché non sembri una svista.
- **Che il sito sia veloce per gli utenti.** Lighthouse è un laboratorio: una macchina, una rete simulata, una cache fredda. CrUX e RUM non li guarda nessuno qui. Sul pilota il LCP **simulato** era 1,5-2,1 s, quello **osservato** fra 56 e 92 ms.
- **Che le ottimizzazioni reggano al contenuto vero.** Banchi e pilota hanno dati di seed: dieci prodotti, non diecimila.
- **Che il costo dichiarato sia il costo vero.** «Il lampo bianco è accettabile» è un giudizio di chi conferma, non una misura.
- **Il guadagno di `next/image` su fotografie vere.** Le immagini del banco immobiliare sono pixel casuali a seme fisso, incomprimibili per costruzione: il guadagno viene quasi tutto dal ridimensionamento. Su foto vere la ripartizione fra le cause è diversa; la direzione no.
- **Che una pagina autenticata sia trattata come tale.** Nessun banco ne ha una nel contratto e la reattività di un backoffice non è mai stata misurata: finché il gate non legge la riga `Tipo:`, le rotte autenticate vanno dichiarate fra le pagine **escluse** — che a loro volta nessun passo controlla (su `banco-prova-negozio` si scoprì **a mano** che il `noindex` di `/admin` non arriva a nessun crawler, perché la guardia reindirizza prima).
- **Che due misure di giorni diversi siano confrontabili, o che il gate regga altrove.** Lighthouse ora è fissato, Chrome no (`CHROME_PATH` non lo legge nessuno), e tutte le misure sono su questo disco con Chrome 150.0.7871.189. La taratura della soglia di dispersione per macchina resta da fare.
- **`sitemap.ts` e `robots.ts`:** nessun passo di questo gate li guarda. Dal 2026-08-06 (§D21) sono di **site-doctor**: scoperti per delega dichiarata, non per dimenticanza.
- **Che il `canonical` punti alla pagina giusta.** Il gate sa dire che c'è, che è uno solo e che due pagine non se lo dividono. Quale di due varianti sia la principale è una decisione di prodotto: se è sbagliata in un modo che nessuna delle due regole intercetta, il gate è verde su un errore che costa l'indicizzazione di una sezione.
- **Che una batteria verde anticipi un tribunale.** Non è mai successo: alle tre convocazioni di `/code-inquisition` ESLint, semgrep, gitleaks, knip e i test erano **tutti verdi**, e i rilievi sono usciti lo stesso (14, 19, 13).
- **Lo 0,3% di `gate-lib.mjs` che semgrep non ha letto.** Il 2026-08-06 lo scanner si è fermato a ~99,7% delle righe (`PartialParsing`) su quel file, dichiarando per giunta una posizione che non è quella vera. Vale **MANCANTE parziale**, non `PASS` — e da allora il file è cresciuto molto senza che nessuno rimisurasse.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| `seo-meta` non guarda l'**host** del `canonical`: cinque canonical verso `http://127.0.0.1:3621` sono cinque canonical unici, e il passo chiude verde | il difetto più probabile della famiglia SEO — il ripiego locale è ciò che fa un progetto non pubblicato, e il gate resta verde fino al rilascio. Non basta confrontare con `--url` (in locale coinciderebbero): serve che il contratto dichiari il **dominio pubblico atteso** | speed-demon |
| Il passo `misura` verifica che Lighthouse **esista**, non che possa **girare**: l'audit `canonical` di 13.4.1 chiama `URL.parse` (Node 22+) e sotto quel minimo porta l'intera categoria SEO a `null` | il gate chiude **rosso** (non è un falso verde) ma nomina la categoria invece della causa; e si accende solo dopo che la skill ha messo un `canonical` in pagina. Rimedio a monte: node dichiarato, o rifiuto sotto il minimo | speed-demon |
| La riga `Tipo:` del contratto non la legge nessuno: ogni pagina è trattata come pubblica, e su una rotta autenticata il gate pretende `canonical` e chiama difetto il suo `noindex` | dedotto dal codice, mai riprodotto: nessun banco ha una pagina autenticata nel contratto | speed-demon |
| Nessun passo verifica che le pagine **escluse** siano davvero escluse | serve una camminata sulle rotte escluse, che oggi non c'è | speed-demon |
| `CHROME_PATH` non viene mai letto, mentre `references/misurazione.md` promette «o è impostata, o il passo è MANCANTE» | stesso ceppo dei sei difetti del collaudo avversario: regola scritta nella prosa, assente dal codice | speed-demon |
| `metatagDaHtml` taglia i tag con una classe negata (`<link\b[^>]*>`) e `attributo` cerca il nome ovunque nel tag: un `name=` dentro il **valore** di un altro attributo fabbrica un metatag fantasma che scavalca quello vero e fa sparire un `noindex` | trovato dal concilio il 2026-08-07: la cura esiste già nello stesso file (`fineTag`) e i consumatori non la usano | speed-demon |
| `TITOLO_DEROGHE` ammette un titolo senza spazio dopo i cancelletti (`###Deroghe`) mentre il cancello che lo interroga no | due regexp dello stesso file disallineate | speed-demon |
| ESLint: **1 warning**, `senzaSvg` complessità 18 contro il massimo 15 (`gate-lib.mjs:1105`) | l'ha prodotto la correzione del concilio sull'`<svg` mai chiuso; il precedente esiste (la `complexity 19` di `verify.mjs` sciolta in funzioni pure, +11 test) | speed-demon |
| `motivoNonDerogabile` copre solo `accessibility`, non `best-practices` | scelta **dichiarata nel codice**: il template non ha firmato altro, e allargarla trasformerebbe in `block` deroghe già firmate | direzione |
| `SKILL.md` §«Cosa un gate verde NON prova» e la `description` di `package.json` dicono ancora che il gate lancia `npx --yes lighthouse` e che «in questa cartella non c'è nessun `package.json`» | **falso dal 2026-08-06**; la metà vera della frase (`CHROME_PATH`) va conservata | speed-demon |

## Com'è andata (in breve)

Costruita il **2026-07-30** su `banco-prova-negozio`: gate verde, tre difetti SEO veri su un progetto dove Lighthouse dichiarava SEO 100, quattro difetti della skill. Lo stesso giorno una sessione indipendente l'ha collaudata in modo avversario su un secondo banco con pagine lente (`banco-prova-immobiliare`): **diciassette difetti**, tutti misurati prima di essere corretti — dodici falsi verdi, quattro rifiuti indebiti (il gate non sapeva leggere il contratto che il suo stesso template insegna a scrivere), uno che misurava col profilo sbagliato in silenzio (14 punti sulla stessa build). **Sei su diciassette erano già scritti nelle references e non implementati: la prosa sapeva, il codice no.** Quattro in `references/seo.md` («contare, non trovare»; il `<title>` dentro un `<svg>` inline; `redirect: "manual"` con la sua motivazione; i canonical di tre pagine diverse) e due in `references/misurazione.md` (`requestedUrl` confrontato con `finalDisplayedUrl`; il build id annotato accanto all'URL misurato). Da lì la regola di casa: **una reference nuova si accompagna al suo test**, altrimenti descrive un gate che non esiste — ed è lo stesso ceppo del `CHROME_PATH` ancora aperto qui sotto. Il diciottesimo si presentò da solo: la porta dichiarata nel contratto **firmato** del banco vecchio era occupata dal sito di un'altra azienda — da lì il confronto del `.next/BUILD_ID`. Primi `plan` e `tune` veri: home `performance` 77→100 (LCP 5 496→746 ms, 6,31→0,47 MB), `/immobili` 75±8→100±0 e `seo` 92→100.

Il **2026-08-03/04** il gate usciva `0` **muto**: prima sul Node di sistema (`import.meta.main` è di Node 24), poi invocato dalla junction (`resolve()` non scioglie una junction, `import.meta.url` sì). Due correzioni, tre test, e da allora i gate si lanciano da entrambi i canali.

Il **2026-08-06** il primo giro su un'app viva, il pilota `cavia`. Baseline 99-100 con rumore di fondo di ±1 punto (559 ms sul LCP): **nessuna ottimizzazione di velocità era misurabile su questa macchina**, e la cosa è stata scritta invece di applicarne una attribuendole il rumore. Tre modifiche col loro costo: icona (`best-practices` 96→100 su cinque pagine), `description` su `/ordine` (`seo` 90→100), `canonical`/OG/`robots`/`sitemap`.

Tre tribunali. `/code-inquisition` sugli script (2026-08-06): **14 difetti, 4 HIGH**, nessuno visto dai guardiani statici — fra questi il gate che restava muto 45 s contro un server che accetta e non risponde. P.7d li ha chiusi riproducendoli prima e rimisurandoli dopo (da *ucciso a 120 s con zero righe* a **57,8 s con sette passi motivati**), batteria 87→103. P.7e ha onorato la delega §D21 col passo `contrasto` — al 2026-08-06 `contrast` compariva in **zero file** della skill — e chiuso gli otto residui: 103→144. Il concilio sul pacchetto stesso (2026-08-07, **19 rilievi**) ha trovato che la correzione di M7 aveva **reintrodotto la stessa classe dalla porta opposta**: un `<svg` mai chiuso si portava via il resto del documento, e il `noindex` più sotto spariva con lui.
