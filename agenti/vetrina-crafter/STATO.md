# STATO — vetrina-crafter

**A che punto è:** strumento collaudato in avversario su due banchi e usato **una volta** su un progetto pilota vero (`cavia`), mai su un cliente vero.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria **183 test verdi, 29 suite, 0 falliti**; ESLint 0 rilievi, knip pulito. Il gate non è stato rilanciato quel giorno: l'ultima esecuzione su un progetto è del 2026-08-05, VERDE 10/10 sul pilota.

## Cosa fa

Costruisce il **sito pubblico** di un progetto Web Gun — le pagine che vede chi non ha un account — sopra lo schema e le policy di schema-forge: pagine, layout, componenti dietro la cucitura `src/components/ui/`, lettura dei dati con la **chiave anonima**, contenuti presi dalle tabelle degli slot.

1. **Il modello prima delle pagine (Specchio della vetrina).** Nessuna riga generata prima di aver riformulato quali pagine esistono, cosa mostra ciascuna e da dove arriva ogni contenuto, e **ottenuto conferma**. Due domande non sono mai delegabili all'orchestratore: *quali dati vede un anonimo* e *ogni percorso di scrittura aperto all'anonimo*.
2. **Giudica l'app servita, non il sorgente.** Una pagina è pronta se una **build di produzione di questo progetto** la serve, e il gate la legge lì. Strumento che non gira, o che non ha letto il suo input: **verifica mancante**, mai un falso verde.
3. **Niente testo cablato dove il cliente deve poterlo cambiare, niente chiave che scavalchi le policy.** Il gate pretende di ritrovare nel database la stringa che sta in pagina, e di **non** ritrovarla nei sorgenti.

**A monte** schema-forge (tabelle, policy per `anon`, tabella dei contenuti col seed, tipi) — compresa la **migrazione dei privilegi**, che `forge` scrive dentro la migrazione della tabella: il suo `revoke all` toglie anche **TRUNCATE**, che la RLS **non filtra**. Senza quella riga un ruolo con permessi di scrittura può troncare la tabella dei contenuti aggirando ogni policy; il test pgTAP che lo attacca passa solo perché la riga esiste. **A fianco** gestionale-crafter: stessa tabella di slot — le chiavi devono coincidere, chi arriva secondo legge l'handoff del primo — e stessa cucitura, che chi arriva dopo **estende**, non riscrive. **A valle** flow-sentinel · speed-demon (`docs/vetrina.md` è la fonte del suo elenco di pagine) · site-doctor · launchpad.

## Il gate

**Dieci passi**, `id` stabili, ordine bloccato da un test. I primi cinque non hanno bisogno dell'app accesa, gli altri sì; l'ultimo guarda i nove precedenti.

| passo | cosa prova |
|---|---|
| 1 `contratto-vetrina` | esiste un elenco di pagine **firmato** in `docs/vetrina.md`, non più vecchio dello schema |
| 2 `tipi` | il progetto compila (`tsc --noEmit`) sui tipi veri del database |
| 3 `cucitura-ui` | la cucitura è l'unica fonte delle primitive e non contiene logica di dominio |
| 4 `chiavi-e-client` | nessuna chiave di servizio nel sito pubblico, nessun client fuori dai moduli dichiarati |
| 5 `a11y-statica` | pagine e cucitura passano `eslint-plugin-jsx-a11y` (l'ESLint della skill) |
| 6 `app-identita` | l'URL sotto esame è una build di produzione **di questo progetto** (`.next/BUILD_ID` nell'HTML servito) |
| 7 `pagine-vive` | ogni pagina dichiarata risponde, e ogni pagina servita è dichiarata (anche quelle da `route.ts`) |
| 8 `segnaposto-serviti` | nel testo servito non ci sono segnaposto né *lorem ipsum* |
| 9 `contenuti-vivi` | la stringa è nel database e non nei sorgenti; le fonti sono leggibili dall'anonimo e le tabelle dei **percorsi di scrittura pubblici no**; le colonne su cui `anon` ha `select` sono **quelle che la firma dichiara** |
| 10 `contratto-uscita` | l'handoff esiste, e la sua riga `Gate:` dice il vero su **questa** esecuzione |

Uno strumento assente vale `MANCANTE`, non `PASS` — e lo stesso vale per uno presente che non ha letto il suo input. Conta doppio sul passo 9: senza database la Legge n°3 non è verificata affatto.

```bash
node "<skill>/scripts/verify.mjs" --url http://127.0.0.1:3140 [--db-url <url>] [--json]
node "<skill>/scripts/vetrina-audit.mjs"     # i soli tre passi statici, senza app accesa
```

`--url` **non ha un default**: il gate non indovina `localhost:3000`, perché è così che si legge l'app di un altro progetto e si stampa `pass`; se manca ricade sulla riga `URL servito:` del contratto. Il database si risolve da `--db-url` o da `[db].port` di `supabase/config.toml` — l'ambiente non viene mai consultato. Serve `psql` nel PATH. Il gate parla anche invocato dalla junction `.claude/skills/…`, che è il canale con cui lo vede una chat aperta sul progetto.

**Due dettagli del passo 9 che non si indovinano, e che a sbagliarli il passo tace invece di sbagliare.** I permessi di colonna si leggono da `information_schema.column_privileges`, **non** da `role_table_grants`: il secondo sa dire solo «SELECT sulla tabella» e non *quali* colonne, mentre dopo un `revoke all on t from anon; grant select (a, b) on t to anon;` il primo risponde `a, b`. Regge tutti e due i modi di concedere, ed è anche la forma con cui si **rimedia** quando il passo diventa rosso. E `psql` va invocato con **`-q`**: senza, stampa su stdout il tag del comando (`SET`, per `set role anon`), e con `-R` quel tag finisce **dentro il primo record** — perché `-R` sostituisce il terminatore di riga, non quello di una riga di stato. Il conteggio diventa `SET0`, `Number(...)` dà `NaN`, `NaN === 0` è falso, e la regola «zero righe leggibili impersonando l'anonimo» — il modo n°1 in cui un sito pubblico sopra la RLS fallisce in silenzio — non scatta affatto.

**Costo:** 4,93 s su 9 pagine e 13 slot, varianza 0,22 s su tre giri — ripetibile. Fissi ~3,6 s (`tsc` + ESLint); il resto è lineare: una GET per pagina e **due `psql` per relazione** nominata (~100 ms l'una su Windows). Trenta pagine e quindici relazioni: ~10 s.

## Come si prova

```bash
# 1. la batteria, dentro agenti/vetrina-crafter
npm test        # atteso: 183 test, 0 falliti
npm run lint    # ESLint 0 rilievi
npm run knip    # pulito

# 2. il banco (usa e getta, gitignorato). Due vivi:
#    banco-prova-controtempo — P1: 5 pagine,  6 slot                  · db 574xx, app 3140
#    banco-prova-valscura    — P2: 9 pagine, 13 slot, modulo pubblico · db 575xx, app 3150
export PATH="$PATH:$USERPROFILE/scoop/apps/postgresql/current/bin"
docker ps && supabase start && supabase db reset
rm -rf .next/cache/fetch-cache .next/dev/types .next/types
npm run build && npm run start -- -p 3140

# 3. il gate, da un'altra shell
node "../agenti/vetrina-crafter/scripts/verify.mjs" --url http://127.0.0.1:3140
# atteso: VERDE 10/10, uscita 0
```

Trappole misurate qui, non lette da qualche parte:

- **La Data Cache sopravvive a `next build`.** Una riga cambiata nel database non entra nella build nuova finché non scade `revalidate`: il gate vede — correttamente — una pagina che non mostra ciò che il database dice. `rm -rf .next/cache/fetch-cache`.
- **I tipi di rotta generati sono uno stato.** Tolta una rotta, la build muore con `Cannot find module .../page.js` additando un file che nessuno ha scritto. `rm -rf .next/dev/types .next/types`.
- **Node di sistema 20.12.2.** Il glob `node --test "scripts/**/*.test.mjs"` gira su Node 24 e **non** su 20; `node --test scripts` fa l'opposto. Per questo `package.json` elenca i tre file di test **per esteso**: un file di test non elencato lì è una verifica MANCANTE travestita da PASS. **`jscpd`** gira solo col Node 24 di scoop, invocato come `node_modules/jscpd/bin/jscpd` (lo shim `.bin/jscpd` è shell, non Node).
- **La build Turbopack del banco fallisce a intermittenza** nel worker di postcss (`evaluate_webpack_loader` → connessione chiusa), ~1 volta su 2 con poca RAM e più stack Supabase accesi. Non dipende dalla versione di Node né da un `.next` sporco; `@tailwindcss/postcss` fuori da Turbopack processa lo stesso CSS in 3,1 s senza fallire. È l'ambiente, non la skill.

## Cosa NON è mai stato provato

Cieco per costruzione, e dichiarato tale:

- **La prosa del contratto.** `Cosa mostra:` e `Perché esiste:` non le legge nessuno strumento: riscritta in P2 la descrizione di una pagina come «la mappa interattiva col tracciato GPS, il meteo a sei giorni e il modulo per prenotare il trasferimento», il gate chiude **VERDE 10/10 su una pagina che non esiste**. Non chiudibile senza giudicare un significato.
- **La primitiva reimplementata a mano.** Un bottone riscritto dentro la pagina con classi a mano non lo vede `cucitura-ui`. Chiudibile e **non conveniente**: ogni regola immaginata produce rossi su pagine corrette, il difetto evitato è reversibile e il costo sarebbe strutturale. La copia **importata** invece si vede ovunque stia.
- **Il testo cablato che nel database non esiste affatto.** La regola copre le righe *pubblicate* che nessuno slot dichiara; una sezione scritta a mano e mai messa a contenuto non ha niente con cui confrontarsi.
- **Se quelle colonne DOVESSERO essere pubbliche.** Il gate prova che firmato e concesso coincidono; che sia *giusto* concederle lo dice solo la firma.
- **Le rotte che nessun file rappresenta:** una riscrittura di `next.config`, una rotta servita dal middleware.
- **La staleness del CONTENUTO.** `identita` confronta la build coi file **sorgente**, e qui il contenuto sta nel database: è l'unico ingresso rispetto a cui la build può invecchiare. `updated_at` da trigger è una convenzione di schema-forge, e il gate non la interroga.
- **La data della firma va scritta in forma ISO.** Il passo 1 la legge dal testo dell'handoff di schema-forge e ci confronta la firma della vetrina: con `il 24 luglio 2026` il confronto **non si fa affatto, in silenzio**.

Provabile e non provato:

- **Il database spento a metà corsa**: provate le risposte negative (`42501`, relazione assente, zero righe), non l'interruzione fra due passi. Né i timeout (vedi Debito).
- **`--json` non è mai stato esercitato**: il contratto d'uscita in JSON esiste, tutte le misure sono sull'uscita per umani. **`evolve` non è stato collaudato**: il collaudo ha attaccato il gate, non il flusso di evoluzione.
- **`semgrep`, `gitleaks` e `/code-inquisition` non sono mai stati puntati su questi script.** Il concilio del 2026-08-06 ha guardato le quattro skill storiche e ha dichiarato vetrina-crafter **fuori mandato**; `semgrep` è presente su questa macchina, quindi è una verifica disponibile e non fatta.
- **`jscpd` non è stato rilanciato dopo P2** (pulito in P1: 7 file, 3 121 righe, 0 cloni). **`code-maniac scan` non è stato lanciato sul banco**: è usa e getta, e i guardiani girano sugli script della skill.
- **§Dati visibili scritta in forme non immaginate.** Il parser legge le colonne in testa alla cella; le altre forme diventano MANCANTE — onesto, ma mai provato su contratti scritti da qualcun altro.
- **I segnaposto sono cercati come stringhe.** `da compilare` e `da decidere` sono italiano ordinario: su una prosa finita che li contenga il passo 8 darebbe un `block`. Mai misurato su un contenuto scritto in buona fede.
- **Storage non è stato toccato.** Le immagini dei banchi sono file statici; «il cliente carica una foto» ha tre policy sullo stesso bucket e nessuno strumento di questa pipeline le guarda.
- **Il modulo pubblico non è stato attaccato, e il tetto ai tentativi non c'è (debito RPC-1, mai chiuso).** Su valscura `/prenota` è stato misurato per quello che il contratto dichiara (chi scrive non rilegge, e le colonne concesse); che non lo si possa inviare mille volte in un minuto non lo dice nessuno. Sulle RPC pubbliche del pilota è stato **misurato**: **30 ordini inviati in 1,36 s, tutti 200**, nessun rate-limiting né lato database né lato applicazione. Non è materia di questa skill — la vetrina può al massimo scoraggiare l'abuso lato interfaccia (bottone disabilitato in volo, un solo invio per submit) e deve dichiararlo nell'handoff senza spacciarlo per un tetto; il tetto vero aspetta cyber-shield, che non esiste. Sul pilota il percorso di scrittura è stato guidato con `curl` e con la server action ricostruita: **nessuno ha mai premuto quel bottone in un browser**.

Quello che i banchi stessi non dimostrano:

- **I banchi li ha costruiti chi collaudava.** L'unica misura su un progetto non proprio è il rilancio su `banco-prova-controtempo`, ed è quella che ha trovato di più.
- **Dati di seed, non dati veri.** 4 camere e 6 escursioni; sul pilota 11 voci di menu, non ottanta. `contenuti-vivi` conta che ci sia *almeno una* riga leggibile, non che ce ne sia il numero giusto.
- **Niente su come si vede.** Nessun passo apre una finestra: viewport, telefono, stampa, JavaScript disattivato, immagini che non arrivano.
- **Due domini, un solo stack**: Next 16 con Turbopack e Supabase locale. P2 ha aggiunto un dominio e un percorso di scrittura pubblico, non un altro stack.
- **Un gate verde non è codice senza difetti.** Sul pilota ha chiuso 10/10 su codice in cui `/code-inquisition` ha poi trovato **sei** cose vere, nessuna nel perimetro dei dieci passi.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| Manca un gettone `funzione:` per una fonte che è una **RPC** | sul pilota due pagine leggono da `ordine_per_codice()` e hanno dovuto dichiarare `nessuna`, glossato dal template «pagina di solo markup» — vero a metà. `tabella:ordini` sarebbe peggio: l'anonimo non la può leggere, e il passo 9 la segnalerebbe come fonte negata | minuteria della skill |
| Il gate pretende una **colonna di pubblicazione** anche dove il dominio non ha bozze | `tabellaContenutiDa` esige `pubblicato <colonna>` e ci costruisce un `where`. Sul pilota la costante `pubblicato true` ha funzionato, ma **per caso**: nessun test la copre, nessun `hint` dice che è la strada | minuteria della skill |
| La regexp di mascheramento a `scripts/verify.mjs:378` (`/:[^:@]*@/`) | su cinque forme **sbaglia tre volte**: mezza password in chiaro se contiene una `:`, URL senza password distrutta, query string mangiata. La correzione (`new URL`, che conosce la struttura) è già in casa nelle altre tre skill; qui era fuori perimetro | direzione |
| Nessun passo ha un **timeout** | patologia mai provata, e `psql` bloccato blocca il gate | minuteria della skill |
| Le euristiche degli **alias** | `puntaA` risolve esatti i percorsi relativi; per `@/` e `~/`, che senza `tsconfig.json` non si risolvono, resta un confronto **ancorato in testa** — cieco su un monorepo con due cartelle omonime | minuteria della skill |
| I due test dell'epilogo di `vetrina-audit.mjs` stanno in `verify.test.mjs` | allora `package.json` era fuori perimetro. Spostarli costa due righe: `package.json` e la frase «i tre file» di `SKILL.md` | direzione |
| La tabella dei contenuti non è nelle references di schema-forge, né la sua policy, né **almeno una riga di seed per slot** | il modello degli slot è documentato nel consumatore (`gestionale-crafter/references/contenuti-editabili.md`), non nel produttore. Senza righe la vetrina si costruisce sul vuoto: è un `block` del passo 9 | schema-forge |
| Il **`grant update` per colonna** merita una riga nelle references di schema-forge | sul banco ha impedito alla redazione di rinominare la chiave di uno slot — cioè di rompere la pagina che la cerca, **senza nessun errore da nessuna parte**. È l'unica difesa che la RLS non può dare, e ha il suo test pgTAP | schema-forge |
| Il **controllo della data della firma** esiste già, in un gate: il passo 1 confronta due date *dichiarate* in due file dello stesso progetto | flow-sentinel lo lascia aperto proponendo `git log` e si ferma davanti ai progetti senza git. Qui è risolto **senza git**, e il falso positivo che temeva (un handoff riscritto) non si verifica, perché la data si legge dal testo | flow-sentinel |
| Una policy di lettura mancante per `anon` non è un `block` di nessun gate di schema-forge | il suo audit RLS cerca tabelle nude e policy sbagliate; RLS attiva **senza** policy per l'anonimo è *corretta* per l'audit e *invisibile* per il sito. La trova il passo 9, cioè a pagine già scritte | schema-forge |
| I sette indizi di dev server di speed-demon **non vedono Turbopack** | misurato qui su Next 16: nessuno scatta, e il passo che li usa accusa «un'altra applicazione sulla stessa porta». I due che funzionano sono `hmr-client` e `next-devtools` nei percorsi dei chunk, ancorati a `/_next/static/chunks/` | speed-demon |
| `docs/vetrina.md` e `docs/performance.md` elencano due volte «le pagine che contano» | possono divergere in silenzio: `contratto-performance` legga `docs/vetrina.md` quando c'è, almeno per un `warn` | speed-demon |
| Le chiavi degli slot vanno dette in **forma fissa** nell'handoff del gestionale | oggi in prosa: due agenti sulla stessa tabella possono scrivere insiemi diversi finché il cliente non modifica una riga che nessuna pagina mostra. Sul banco è successo, e a intercettarlo è stato il contratto della vetrina, non i tipi: una chiave di slot è una stringa | gestionale-crafter |

## Com'è andata (in breve)

**P0 (2026-08-02)** progettazione firmata dal committente: `SKILL.md`, la specifica del gate a dieci passi, i template.

**P1 (2026-08-03)** costruzione: 5 references, due librerie di regole pure divise **per input** (`audit-lib.mjs` guarda i sorgenti, `progetto-lib.mjs` il contratto e l'app servita) e due gusci di I/O; `verify.mjs` **importa** l'audit statico invece di lanciarlo come sottoprocesso, così un errore là dentro diventa MANCANTE invece di uccidere il gate. Il sabotaggio ha trovato **tre difetti del gate stesso** (diagnosi bugiarda su Turbopack, falso verde su una pagina non scaricata, frammento distintivo che cercava in pagina l'**UUID di una riga**) e ha smentito una premessa di dottrina: una colonna selezionata e non disegnata **non** arriva al browser — di un Server Component viaggia l'uscita, non i suoi dati. *Ciò che è pubblico lo decidono il `grant` e la policy, perché la chiave anonima sta nel bundle e con quella chiunque chiede a PostgREST le colonne concesse.*

**P2 (2026-08-04)** collaudo avversario su un secondo banco: **quattordici difetti**, tutti misurati prima di essere corretti e tutti con un test. Il filo che li lega: **il gate leggeva i documenti che qualcuno poteva riscrivere, e non il database che nessuno può riscrivere** — le due tabelle firmate del contratto, cioè le due domande irreversibili, non le leggeva nessuno dei dieci passi. Un contratto scritto con cura dichiarava **22 colonne** visibili a un anonimo e `anon` ne poteva leggere **36**; il gate scriveva **23 diagnosi** nel campo `hint` e ne stampava **zero**; tre delle sei classi dichiarate cieche non erano cieche, e una era perfino difesa da un test. La prova che conta di più: il gate corretto, rilanciato sul primo banco per escludere regressioni, ci ha trovato **diciannove colonne e una tabella intera leggibili da un anonimo che nessuno aveva firmato**. Batteria 122 → 177, poi **183** coi sei test dell'epilogo: dalla junction il gate usciva **0 senza stampare una riga**, perché `resolve(process.argv[1])` normalizza ma non scioglie una junction mentre `import.meta.url` è già canonico.

**P.4b (2026-08-05), pilota `cavia`** — primo consumatore reale: gate **VERDE 10/10** su build di produzione, e `docs/vetrina.md` firmato `Confermato da: Alberto Marocco (committente) il 2026-08-05`: prima skill della casa a chiudere il motivo «il contratto l'ha firmato chi costruiva» con una persona vera che non ha costruito niente. Il 2026-08-07 il contratto ha una seconda firma **per delega** per una settima pagina aggiunta dopo. Sullo stesso codice `/code-inquisition` ha poi trovato sei rilievi, due dei quali portati dal critico del roster.
