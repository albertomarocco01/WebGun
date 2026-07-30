# Come si misura onestamente

Questo file decide **una cosa sola**: quando un numero di performance ha il diritto di essere scritto in `docs/performance.md` e di far prendere una decisione. Tutto il resto della skill — il catalogo delle ottimizzazioni, il costo di ognuna, il gate — poggia qui, perché un'ottimizzazione è una differenza fra due misure, e una differenza fra due misure sbagliate non è un miglioramento: è un errore raddoppiato con la firma dell'agente sotto.

La regola che governa tutte le altre: **ogni numero porta con sé il metodo che l'ha prodotto**, e il metodo dev'essere verificabile contro gli artefatti, non contro la memoria di chi ha lanciato il comando. Lighthouse salva dentro il proprio JSON com'è stata configurata quella esecuzione: `lighthouseVersion`, `fetchTime`, `requestedUrl`, `finalDisplayedUrl`, `configSettings.formFactor`, `configSettings.throttlingMethod`, `configSettings.throttling`, `environment.hostUserAgent`. Quei JSON si conservano; il numero trascritto a mano in un documento senza il suo JSON accanto è una dichiarazione, non una misura.

## Perché `next dev` non è misurabile

Non è una questione di «numeri un po' più bassi». È che i numeri di `next dev` **non descrivono il sito**: descrivono il compilatore mentre lavora. Quattro meccanismi distinti, ognuno dei quali basterebbe da solo.

**Non c'è minificazione, e non c'è la build di produzione di React.** In sviluppo il bundle contiene React in modalità development — con i suoi controlli, i suoi messaggi di avviso, i suoi nomi interi — più le source map e l'overlay degli errori. Sono byte da scaricare e lavoro da eseguire che in produzione non esistono. Di quanto? Non lo scrivo qui: è un rapporto che dipende dal progetto e va **misurato sul progetto**, con i due comandi della sezione dopo, prima di citarlo.

**La compilazione è a richiesta.** `next dev` compila una rotta la prima volta che qualcuno la chiede. Il primo giro di Lighthouse su `/prodotti/[slug]` paga il compilatore dentro il TTFB; il secondo no. Quindi la stessa misura, ripetuta senza cambiare una riga, dà numeri sistematicamente diversi — e la differenza fra i due giri è il compilatore, non il sito. Questo è precisamente il difetto che la terza legge della skill vuole rendere visibile: qui la varianza non è rumore, è un artefatto della modalità, e nessun numero di giri la fa sparire.

**Le cache si comportano in un altro modo.** In produzione una rotta statica esce già renderizzata da `.next`, una dinamica passa dalle cache dichiarate nel codice. In sviluppo si ri-renderizza, e l'invalidazione del watcher può azzerare fra un giro e l'altro cose che in produzione non si azzerano mai. La cache fredda dello sviluppo non è la cache fredda di un visitatore: è una terza condizione che non capita a nessuno.

**Il runtime di aggiornamento a caldo è dentro la pagina.** L'HMR apre una connessione, ascolta, e reagisce; il suo costo cade dentro la finestra che Lighthouse osserva, e in produzione non c'è.

Il risultato pratico è che ottimizzare guardando `next dev` fa prendere decisioni al contrario: si toglie una dipendenza che in produzione il tree-shaking già eliminava, si insegue un TBT che è tempo di compilazione, si dichiara «risolto» un LCP che era il primo accesso a una rotta mai compilata.

## Riconoscere una dev server da fuori

Il gate misura un URL. Deve poter dire «questa è una dev server» **senza fidarsi di chi gliel'ha passato**, perché il modo tipico in cui questo errore accade non è la malafede: è il terminale rimasto aperto. Le convenzioni di Flow Sentinel prescrivono `npm run dev` sulla porta 3000 mentre gira la batteria End-to-End (`agenti/flow-sentinel/references/playwright.md`, §Il comando unico). Speed Demon arriva subito dopo Flow Sentinel. Se misura la 3000 senza controllare, misura la dev server che il collega ha lasciato accesa — ed è un errore che non lascia tracce, perché risponde tutto e la pagina è giusta.

Cinque indizi, in ordine di robustezza. Nessuno di essi è un contratto pubblico di Next.js: sono dettagli implementativi che cambiano fra versioni, quindi il gate deve **dire quale indizio ha fatto scattare il rosso**, altrimenti il giorno in cui Next cambia formato la diagnosi diventa «dev server» su una build di produzione, e qualcuno perde un pomeriggio.

| Indizio | Produzione (`next start`) | Sviluppo (`next dev`) | Come si guarda |
|---|---|---|---|
| Cache degli asset statici | `Cache-Control: public, max-age=31536000, immutable` su `/_next/static/**` | `no-store` / `must-revalidate` sugli stessi percorsi | `curl -sI` su uno script referenziato dall'HTML |
| Nome dei chunk | hash del contenuto nel nome del file | nomi parlanti (`main-app.js`, `webpack.js`) e spesso una query `?v=<timestamp>` che cambia a ogni ricompilazione | i percorsi `/_next/static/**.js` estratti dall'HTML |
| Build id | id generato dalla build | la stringa letterale `development` | compare nei percorsi `/_next/static/<buildId>/` e nel payload RSC dentro l'HTML |
| Runtime di aggiornamento a caldo | assente | presente: client di refresh referenziato e connessione verso un endpoint `*-hmr` | ricerca nel testo dell'HTML servito |
| Minificazione | righe lunghissime, identificatori di una lettera | righe corte, commenti, nomi interi | byte per riga di un chunk scaricato |

```bash
# 1. quali script serve la pagina (i nomi sono gia' meta' della risposta)
curl -s "http://127.0.0.1:3210/" | grep -o '/_next/static/[^"]*\.js' | sort -u

# 2. l'indizio piu' stabile: gli asset di produzione sono immutabili
curl -sI "http://127.0.0.1:3210/_next/static/chunks/<file-visto-sopra>.js" | grep -i '^cache-control'
# produzione: cache-control: public, max-age=31536000, immutable
# sviluppo:   cache-control: no-store, must-revalidate

# 3. controprova sul disco, quando il gate gira nella radice del progetto:
#    `.next/BUILD_ID` lo scrive solo `next build`
cat .next/BUILD_ID
```

**Un solo indizio positivo rende il passo rosso.** L'asimmetria dei costi lo impone: un falso rosso costa un `next build` — minuti, e una riga nel log; un falso verde costa l'intera baseline e ogni decisione presa sopra di essa, incluse le ottimizzazioni applicate al codice di qualcun altro. Fra i due errori si sceglie quello che si paga subito.

**Cosa questo controllo non prova.** Non prova che la build serva il codice di *adesso*: `next start` serve qualunque cosa ci sia in `.next`, anche una build di tre commit fa (vedi le trappole, §Build vecchia). Non prova che sulla porta ci sia **questo** progetto: su una macchina con due app accese la porta 3210 può essere di qualcun altro — è lo stesso precedente delle porte di Schema Forge e Flow Sentinel (DECISIONI.md §11 e §14), e la difesa è la stessa: l'URL si dichiara, non si indovina, e il gate lo stampa anche quando è verde.

## Il ciclo giusto

```bash
# dalla radice del PROGETTO generato
npm run build                        # minificazione, chunk hashati, prerender delle rotte statiche
npm run start -- --port 3210         # porta DEDICATA: mai la 3000, che appartiene a `next dev`
```

La porta dedicata non è pignoleria, ed è utile sapere **come si comporta davvero** Next quando la porta è occupata, perché il ripiego automatico non vale per tutti e due i comandi. `next dev` occupa la 3000 per convenzione. Se `next start` viene lanciato sulla 3000 già presa, **non si sposta**: la ritentata sulla porta successiva è condizionata allo sviluppo (in Next 15.5, `EADDRINUSE` fa incrementare la porta solo se `isDev`, `next/dist/server/lib/start-server.js`), altrimenti stampa `Failed to start server` ed esce con codice 1. Il modo in cui la misura finisce sulla dev server è quindi silenzioso da una parte sola e per questo pericoloso: il processo di produzione muore, sulla 3000 continua a rispondere la dev server rimasta accesa, Lighthouse riceve una pagina giusta, e nessun numero ha l'aria di essere sbagliato. Il rovescio vale per lo sviluppo: `next dev` la porta la cambia da solo, quindi nemmeno «la 3000 è del dev server» è un'identità su cui fidarsi — resta il controllo della sezione precedente.

Prerequisiti, con la regola della casa: **uno strumento assente vale `MANCANTE`, non `PASS`.**

```bash
npx lighthouse --version      # assente -> il passo `misura` e' MANCANTE
node -e "console.log(process.env.CHROME_PATH ?? 'CHROME_PATH non impostata')"
```

Il difetto che il secondo comando previene: Lighthouse non porta Chrome con sé, se lo fa trovare. Su una macchina con più binari installati — il canale stabile, il Chromium che Playwright ha scaricato per Flow Sentinel, un residuo di Puppeteer — può partire un Chrome diverso da quello del giro precedente, e la versione di Chrome sposta i numeri per gli stessi motivi per cui li sposta la versione di Lighthouse. O `CHROME_PATH` è impostata e si sa quale binario ha misurato, o il passo è `MANCANTE`: in entrambi i casi la versione di Chrome finisce nel metodo, com'è nel modello più avanti.

Lighthouse va **installato nella cartella della skill e bloccato a una versione esatta**, come ESLint per Flow Sentinel e `.sqlfluff` per Schema Forge (DECISIONI.md §8): il punteggio di performance è una combinazione pesata di metriche, e i pesi cambiano fra versioni maggiori. Due numeri presi con due versioni diverse non sono confrontabili, e il «guadagno» che ne esce è un cambio di scala travestito da lavoro.

## N giri, mediana, dispersione

Un giro di Lighthouse non è una misura. Lo dice la documentazione di Lighthouse stessa, che riconosce la variabilità fra esecuzioni e raccomanda più giri con la mediana; e lo dice l'esperienza banale di lanciarlo due volte di fila sulla stessa build senza toccare niente. La variabilità non va nascosta né mediata via: va **dichiarata**, perché è il metro con cui si decide se un guadagno esiste.

La regola operativa: **N giri, N dispari, default 3**; si riporta la **mediana** del punteggio e di ogni metrica, e la **dispersione**, cioè `max − min` del punteggio. Se la dispersione supera la soglia dichiarata nel contratto, la misura **non è bassa: è MANCANTE**. Non si scrive un numero e non si prende una decisione; si va su una macchina più quieta, si alza N, e si rifà.

N dispari non è estetica: con N pari la mediana diventa la media dei due valori centrali, cioè rientra dalla finestra esattamente la statistica che si voleva evitare.

```js
// mediana e dispersione dai JSON dei giri — illustrazione del metodo
import { readFileSync } from "node:fs";

const giri = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));

// Un giro con `score: null` NON e' un giro: un audit e' andato in errore.
// Trattarlo come 0 abbassa la mediana per un motivo che non riguarda il sito.
const validi = giri.filter((lhr) => lhr.categories.performance.score !== null);
if (validi.length < giri.length) console.error(`${giri.length - validi.length} giri scartati (score null)`);
if (validi.length % 2 === 0) throw new Error("servono N giri validi con N dispari");

const mediana = (xs) => [...xs].sort((a, b) => a - b)[(xs.length - 1) >> 1];
const dispersione = (xs) => Math.max(...xs) - Math.min(...xs);

const punteggi = validi.map((lhr) => Math.round(lhr.categories.performance.score * 100));
const lcp = validi.map((lhr) => lhr.audits["largest-contentful-paint"].numericValue);

console.log({
  punteggio: mediana(punteggi),
  dispersione: dispersione(punteggi),
  lcpMs: Math.round(mediana(lcp)),
  lcpDispersioneMs: Math.round(dispersione(lcp)),
});
```

### Mediana e non media

È aritmetica, non un'opinione. Tre giri che danno 90, 90 e 40 — il terzo perché l'antivirus ha deciso di indicizzare una cartella, o perché il portatile era a batteria e ha ridotto la frequenza — hanno media 73 e mediana 90. La media riporta un sito che non esiste; la mediana riporta il sito. Con N=3 la media viene spostata da **un solo** giro sfortunato di un terzo della sua deviazione, mentre la mediana non si muove finché i giri contaminati restano meno della metà.

Il rovescio, che va saputo: la mediana **nasconde** il giro sfortunato invece di spiegarlo. Per questo la dispersione si riporta sempre accanto, e per questo la soglia esiste: la mediana dice quanto vale il sito, la dispersione dice se quel numero ha il diritto di essere creduto.

Una nota sulla mediana per metrica: la mediana del punteggio e la mediana di LCP possono venire da **giri diversi**. Va bene per riportare i numeri, non va bene per pubblicare un report: il rapporto HTML di un giro è la traccia di quel giro, e assemblare un rapporto con i valori mediani di metriche diverse produce una fotografia di un caricamento che non è mai avvenuto.

### Calibrare il rumore prima di leggere il segnale

La soglia di dispersione di default proposta dalla casa è **5 punti sul punteggio di performance**. È una convenzione, non una misura: va tarata sulla macchina che misura, e la taratura si fa così.

Si misura **due volte la stessa build**, senza toccare una riga, N giri per volta. La differenza fra le due mediane è il **rumore di fondo** di quella macchina in quelle condizioni. Da lì discende la regola che conta più della soglia: **un guadagno più piccolo del rumore di fondo non è misurabile su questa macchina**, e va riportato come tale — non come «piccolo miglioramento». Un'ottimizzazione che promette meno del rumore o si misura altrove, o si applica per ragioni che non sono il numero (e allora la ragione va scritta), o non si applica.

Le condizioni da tenere identiche fra il «prima» e il «dopo», perché ognuna sposta il numero senza toccare il codice: alimentazione a rete (su portatile la riduzione di frequenza a batteria è reale), nessun altro browser aperto, **nessuna build in corso**, e — specifico di questa casa — la batteria End-to-End ferma e lo stack Supabase locale nello **stesso stato** nei due momenti. Docker acceso o spento cambia quanta CPU resta libera, e quel delta finisce dentro il punteggio.

Un giro di riscaldamento scartato prima degli N contati è legittimo, ma **cambia cosa si sta misurando**: da «primo visitatore dopo il deploy, cache del server fredda» a «regime, cache del server calda». Sono due domande diverse, entrambe sensate, e mescolarle è il modo più comune di produrre un guadagno che non esiste. Si sceglie, si scrive nel metodo, e si tiene identica la scelta sui due lati del confronto.

## Mobile o desktop: due misure, e va detto quale

Non sono due viste dello stesso numero: sono due misure diverse, e la conversione fra loro non esiste. Il preset mobile — il **default** di Lighthouse — emula un telefono di fascia media, applica un rallentamento della CPU e una rete lenta; il preset desktop (`--preset=desktop`) usa una rete molto più veloce e **nessun** rallentamento della CPU. I valori esatti stanno nelle costanti di configurazione di Lighthouse e finiscono nel JSON di ogni giro sotto `configSettings.throttling` e `configSettings.screenEmulation`: **si leggono lì**, sulla versione installata, non si citano a memoria.

C'è una seconda differenza, meno nota e più insidiosa: **le curve di punteggio dei due preset non coincidono**. Lo stesso LCP in millisecondi non produce lo stesso punteggio parziale su mobile e su desktop. Quindi «80» mobile e «80» desktop non sono lo stesso 80, e un confronto fra i due dice qualcosa sul preset, non sul sito.

Dichiarare quale si usa è **obbligatorio** e va scritto nel metodo. Quale sia quello giusto per il progetto non lo decide questo agente: dipende dal traffico vero, che si conosce solo con dati di campo. In assenza di quei dati, «mobile» è una scelta ragionevole ed è un'**assunzione da scrivere**, non un fatto.

```bash
# mobile: e' il default. Si scrive comunque nel metodo — un default non e' una dichiarazione.
npx lighthouse "http://127.0.0.1:3210/" \
  --only-categories=performance,accessibility,seo,best-practices \
  --output=json --output-path=".perf/home-mobile-01.json" \
  --chrome-flags="--headless=new" --quiet

# desktop: e' un'ALTRA misura, con un suo file e una sua soglia
npx lighthouse "http://127.0.0.1:3210/" --preset=desktop \
  --only-categories=performance,accessibility,seo,best-practices \
  --output=json --output-path=".perf/home-desktop-01.json" \
  --chrome-flags="--headless=new" --quiet
```

Le categorie non sono solo `performance` di proposito. La skill vieta le ottimizzazioni che toccano l'accessibilità, e un `--only-categories=performance` rende quel divieto inverificabile: il punteggio di accessibilità che scende è esattamente il numero che non si vedrebbe.

## Il throttling simulato, e cosa non riproduce

Il metodo di default è `simulate`: Lighthouse carica la pagina **senza** strozzare la rete, costruisce un grafo delle dipendenze fra le richieste e poi **stima** cosa sarebbe successo con la rete e la CPU dichiarate. È un modello, e va letto come un modello: riduce la varianza e rende i confronti fra due build più stabili, al prezzo di essere una previsione invece di un'osservazione.

Cosa la simulazione **non riproduce**, in concreto:

Non riproduce una rete vera. Perdita di pacchetti, jitter, riprese TCP, handshake TLS, risoluzione DNS, comportamento di una radio mobile che si riaggancia: niente di tutto questo è nel modello, che lavora su latenza e banda come due numeri costanti. Non riproduce il **tempo di pensiero del server vero**: quello che il modello misura è il TTFB del processo Node sulla macchina di chi misura, senza altri utenti, con il database sullo stesso disco. Non riproduce il dispositivo: il rallentamento della CPU è un moltiplicatore, non un telefono — GPU, rasterizzazione, pressione di memoria e surriscaldamento non ci sono, e sono proprio le cose che rendono lento un telefono vero dopo il terzo minuto. Non riproduce i **terzi**: uno script di analytics servito da un CDN reale ha una latenza che il modello approssima con la stessa costante di tutto il resto. E non riproduce l'utente: nessuna interazione avviene, quindi nessuna metrica di reattività a un'interazione viene osservata — al suo posto c'è il TBT, che è un indicatore di laboratorio, non la stessa cosa.

Se la metrica che si sta inseguendo è il TBT su una pagina densa di JavaScript, esiste `--throttling-method=devtools`, che strozza davvero invece di stimare. È un metodo **diverso**: produce numeri diversi, e ci si aspetta una dispersione più alta, perché strozzare davvero espone la misura al traffico e allo stato reale della macchina invece di riassumerli in due costanti. «Ci si aspetta» è un'attesa, non un numero: quanto sia più alta si scopre con la taratura del rumore di fondo qui sopra, rifatta con questo metodo sulla macchina che misura, prima di dichiararne la soglia. Si può usare, va dichiarato, e non si confrontano mai numeri presi con i due metodi.

## Le pagine dietro autenticazione

Il modo tecnico esiste. Si avvia un Chrome con la porta di debug, si fa il login **dalla UI vera** con gli stessi utenti di prova del `global-setup` di Flow Sentinel, e si dice a Lighthouse di riusare quel browser senza azzerare lo storage.

```bash
# 1. Chrome con porta di debug e profilo usa e getta
chrome --remote-debugging-port=9222 --user-data-dir="$(mktemp -d)" --headless=new
```

```ts
// 2. il login passa dalla UI, con l'utente del global-setup: un token iniettato
//    a mano misurerebbe una pagina che nessun utente vede mai
import { chromium } from "@playwright/test";

import { UTENTI } from "../e2e/helpers/auth";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const contesto = browser.contexts()[0];
const page = contesto.pages()[0] ?? (await contesto.newPage());

await page.goto("http://127.0.0.1:3210/accesso");
await page.getByLabel("Email").fill(UTENTI.staff.email);
await page.getByLabel("Password").fill(UTENTI.staff.password);
await page.getByRole("button", { name: "Entra" }).click();
await page.getByRole("heading", { name: "Area riservata" }).waitFor();
```

```bash
# 3. Lighthouse riusa QUELLA Chrome e non azzera lo storage (altrimenti perde la sessione)
npx lighthouse "http://127.0.0.1:3210/admin/prodotti" \
  --port=9222 --disable-storage-reset \
  --output=json --output-path=".perf/admin-mobile-01.json" --quiet
```

E qui arriva la parte che conta: **spesso la risposta giusta è «non si misura, e lo si dichiara».** Tre motivi, tutti concreti.

`--disable-storage-reset` è ciò che tiene la sessione, ma tiene anche **la cache HTTP** riempita dalla navigazione di login. Il numero che ne esce è una misura a cache calda, e non è confrontabile con i numeri a cache fredda delle pagine pubbliche. Metterli nella stessa tabella, sotto la stessa soglia, è il modo più elegante che esista per dichiarare veloce una pagina che nessuno ha misurato.

Il contenuto di una pagina autenticata **dipende dallo stato**: il carrello di quel cliente, gli ordini di quello staff, i filtri rimasti in sessione. Due giri consecutivi possono misurare due pagine diverse, e la dispersione che ne esce non parla della macchina.

E il gestionale, tipicamente, ha un budget di performance diverso da quello della vetrina: lo usano poche persone, su connessioni note, e la costituzione della casa mette correttezza e sicurezza sopra la performance. Un LCP su dieci righe di seed non dice niente né sul gestionale vero né sul catalogo vero.

La regola, quindi: una pagina dietro autenticazione si misura **solo se il contratto la dichiara critica**, e allora il metodo va scritto per esteso (ruolo, cache calda, stato dei dati); altrimenti si scrive in `docs/performance.md` la riga **`non misurata`** con il motivo. Quello che non è mai ammesso è saltarla in silenzio: una pagina assente dalla tabella somiglia troppo a una pagina che va bene.

## Cosa si scrive nel metodo

`docs/performance.md` contiene una sezione «Metodo» che vale per tutte le misure del documento, e ogni sua riga dev'essere **verificabile contro i JSON conservati**. Se una riga non è verificabile, o si toglie o si marca come assunzione.

```markdown
## Metodo (vale per tutte le misure di questo documento)

- URL misurato: `http://127.0.0.1:3210` — `next start`, build id `<.next/BUILD_ID>`, commit `<sha>`
- Preset: **mobile** (default di Lighthouse; valori reali in `configSettings.throttling` dei JSON)
- Metodo di throttling: `simulate` (default)
- Lighthouse: versione bloccata `<x.y.z>` — Chrome: `<versione>` — headless
- Giri per pagina: **3** (dispari) · mediana del punteggio e di ogni metrica · dispersione = max − min
- Soglia di dispersione: **5 punti** (convenzione della casa) — sopra, la misura e' MANCANTE
- Rumore di fondo misurato su questa macchina il <data>: **<n> punti** (due misure della stessa build)
- Giro di riscaldamento: 1, scartato — le misure sono a **cache di server calda**
- Stato della macchina: alimentata a rete · stack Supabase acceso · batteria E2E ferma
- Pagine dietro autenticazione: <misurate con questo metodo> | **non misurate**, perche' <motivo>
- JSON dei giri: `.perf/` (non committati — vedi `.gitignore`)
```

L'ultima riga è una regola, e va detto quale difetto apre. I JSON stanno fuori dal versionamento per una ragione buona — sono grandi e cambiano per intero a ogni giro (percorsi assoluti, `fetchTime`, tempi), quindi committarli produce un diff enorme a ogni misura. Il difetto è che, cancellata `.perf/`, «verificabile contro i JSON conservati» smette di essere vero e i numeri del documento tornano a essere dichiarazioni. Perciò: i JSON si tengono almeno finché l'handoff non è accettato, e tutto ciò che dal JSON non si potrà più rileggere — versione di Lighthouse, versione di Chrome, preset, metodo di throttling, build id, commit, dispersione — sta **scritto nel documento**, non solo nel file.

## Cosa questa misura NON prova

**Che il sito sia veloce per gli utenti.** Il laboratorio non è il campo. I dati di campo — CrUX, e qualunque RUM installato sul sito — sono raccolti da utenti veri, su dispositivi veri, su reti vere, con cache in stati vari, e riportati come percentile su una finestra di giorni. Una misura di laboratorio è **un** caricamento sintetico. Un laboratorio verde e un campo rosso sono perfettamente compatibili, e non è una contraddizione: sono due domande diverse. Questo agente non vede il campo, e non deve fingere di vederlo.

**Che le metriche di interazione stiano bene.** In un giro standard nessuno interagisce con la pagina, quindi la reattività a un'interazione non viene osservata: si osserva un indicatore di laboratorio che le somiglia. Una pagina con un `onClick` costoso su un bottone può avere un ottimo punteggio.

**Che regga i dati veri.** Il banco ha dati di seed: dieci prodotti, non diecimila. Il DOM è piccolo, le immagini sono poche, la lista non pagina. È lo stesso limite che la skill dichiara nel gate, e vale doppio qui, perché la misura è proprio la grandezza che i dati falsificano.

**Che regga il server vero.** Su `localhost` non c'è TLS, non c'è DNS, non c'è CDN, non c'è avvio a freddo di una funzione serverless, non c'è un secondo utente. Il TTFB misurato è il caso migliore di una macchina scarica.

**Che le pagine misurate siano quelle giuste.** La misura risponde sulle pagine dichiarate nel contratto. Una baseline impeccabile sulle pagine sbagliate resta da buttare, e a difenderla non c'è nessun controllo automatico: c'è la firma di chi ha confermato l'elenco.

## Le trappole che producono un numero falso

Tutte hanno la stessa forma: il numero **migliora** senza che il sito sia migliorato, e nessuna lascia un errore visibile.

**Cache del browser calda.** Basta riusare un profilo Chrome persistente (`--user-data-dir` che punta al proprio profilo) o `--disable-storage-reset` fuori dal caso dell'autenticazione. Meccanismo: script, font e immagini non vengono scaricati affatto, quindi il tempo di rete di quelle risorse è zero e LCP crolla. Lighthouse per difetto lancia un profilo usa e getta: quel default è una difesa, e va lasciato acceso.

**Cache del server calda solo da un lato del confronto.** La baseline presa subito dopo `next start`, con il processo Node freddo e le rotte incrementali non ancora popolate; la misura «dopo» presa a fine sessione, con tutto caldo. Meccanismo: il TTFB scende, e con lui FCP e LCP. L'intero guadagno può essere il tepore. Difesa: stessa politica di riscaldamento sui due lati, dichiarata nel metodo.

**Cherry-picking dei giri.** Rilanciare finché non esce un bel numero, oppure riportare il migliore di N. Meccanismo: il massimo di N estrazioni è uno stimatore sistematicamente più alto della mediana, e il pregiudizio **cresce** con N — cioè più si insiste, più il numero è ottimista. È la stessa cosa della media travestita: la mediana su N dispari è l'unica statistica di questa lista che non si può spingere insistendo.

**Cambio di preset o di versione fra prima e dopo.** Il «prima» su mobile e il «dopo» su desktop; oppure Lighthouse aggiornato in mezzo. Meccanismo: il preset desktop non rallenta la CPU e usa una rete molto più veloce, e i pesi del punteggio cambiano fra versioni maggiori. In entrambi i casi il delta esiste, è grande, ed è un cambio di scala — nessuna riga di codice è stata toccata. Difesa: versione bloccata nella skill, preset scritto nel metodo, e il JSON di ogni giro conservato per poterlo verificare.

**Il contenuto tolto dalla finestra osservata.** `ssr: false`, un `dynamic()` sull'immagine di copertina, il lazy loading su un elemento sopra la piega, il contenuto spostato più in basso. Meccanismo doppio, ed è il più subdolo perché somiglia a un'ottimizzazione: il candidato LCP viene scelto fra gli elementi visibili nella prima schermata, quindi togliendo l'immagine dalla piega il **soggetto della metrica cambia** — si misura il titolo al posto dell'immagine; e il lavoro rimandato dopo la fine della traccia semplicemente non viene contato. L'utente aspetta lo stesso, o di più: aspetta soltanto dopo che Lighthouse ha smesso di guardare. Questa trappola merita attenzione particolare perché è esattamente il repertorio di ottimizzazioni che questa skill applica: la difesa non è il numero, è la rete E2E verde più il costo dichiarato di ogni modifica.

**I terzi che in locale non ci sono.** Analytics, tag manager, pixel, widget di chat, mappe: in locale la variabile d'ambiente non è impostata e lo script non viene nemmeno inserito, mentre in produzione c'è. Meccanismo: sparisce il JavaScript di terze parti, che su un sito vetrina è spesso la parte più pesante e la meno controllabile. Difesa: si guarda quali `NEXT_PUBLIC_*` mancano rispetto alla produzione, e se mancano lo si **scrive accanto alla misura** — altrimenti il numero descrive un sito che non verrà mai pubblicato.

**Build vecchia.** `next start` serve qualunque cosa sia in `.next`. Meccanismo: si misura codice che non è il codice di adesso, e nel caso che gonfia il numero è la build fatta prima che venisse aggiunta la sezione pesante. Difesa deterministica: `.next/BUILD_ID` deve essere **più recente** del file più recente sotto `src/`, e il build id va scritto accanto alla misura.

**URL richiesto diverso da URL misurato.** Si dichiara `/prodotti`, l'app fa un redirect verso `/it/prodotti`, verso la pagina di accesso o verso una variante con la barra finale. Lighthouse segue e misura la destinazione. Meccanismo: si finisce per misurare una pagina più leggera di quella dichiarata — la pagina di accesso è quasi sempre la più veloce del sito. Difesa: in ogni JSON si confrontano `requestedUrl` e `finalDisplayedUrl`; se differiscono, la misura riguarda un'altra pagina e va rifatta o ridichiarata.

**Rotta statica in laboratorio e dinamica in produzione.** Prima come funziona davvero, perché la versione sbagliata di questa trappola circola molto: nell'App Router statico o dinamico lo decide **`next build`**, guardando se il codice della rotta usa un'API dinamica (`cookies()`, `headers()`, i `searchParams` di una pagina, un `fetch` non cacheato, `export const dynamic`). Non lo decide la richiesta: una rotta prerenderizzata resta prerenderizzata anche quando arriva un cookie, e la stessa build non cambia idea una volta in produzione. La divergenza nasce quindi fra **due build diverse**: in locale mancano le variabili che accendono il ramo di codice che chiama l'API dinamica — il client autenticato, il flag di una feature, l'integrazione di terzi — così qui la pagina esce marcata statica e nella build vera esce dinamica, con un giro sul database dentro il TTFB. Meccanismo: si misura un file, si pubblica una query. Difesa: leggere dall'output di `next build` la marcatura di ogni pagina dichiarata, confrontarla con quella della build di produzione, e scrivere la divergenza accanto alla pagina nel contratto — è la stessa riga della trappola dei terzi, e nasce dalle stesse variabili mancanti.
