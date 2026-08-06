# Stato — Vetrina Crafter

- **Stato attuale: P2 CONSEGNATA — collaudo avversario fatto, quattordici difetti
  trovati e chiusi.** Il gate chiude **VERDE 10/10 su due banchi indipendenti**
  (`banco-prova-valscura`, rifugio alpino: 9 pagine, 13 slot, modulo pubblico;
  `banco-prova-controtempo`, il banco di P1). **177 test verdi** (erano 122),
  ESLint e knip puliti. Verbale: `COLLAUDO-2026-08-04.md`.
- **Il collaudo ha trovato quattordici difetti**, tutti misurati prima di essere
  corretti e tutti con un test. Il filo che li lega quasi tutti: **il gate leggeva
  i documenti che qualcuno poteva riscrivere, e non il database che nessuno può
  riscrivere.** Le due tabelle firmate del contratto — §Percorsi di scrittura e
  §Dati visibili a un anonimo, le due domande che `SKILL.md` dichiara
  irreversibili — **non le leggeva nessuno dei dieci passi**. Adesso il gate le
  confronta col `grant`.
- **Tre delle sei classi dichiarate cieche non erano cieche**, e una quarta si è
  ristretta: erano righe che nessuno aveva provato a guardare. Una era perfino
  difesa da un test (`route.ts` → `null`).
- **La prova che conta di più:** il gate corretto, rilanciato su
  `banco-prova-controtempo` per dimostrare l'assenza di regressioni, ci ha trovato
  **diciannove colonne e una tabella intera leggibili da un anonimo che nessuno
  aveva firmato** — su un banco che chi scriveva la regola non stava guardando.
- **P1, per memoria: il gate aveva trovato tre difetti di sé stesso** col
  sabotaggio: una diagnosi bugiarda sulla dev server di Turbopack, un falso verde
  su una pagina non scaricata, e un `block` che cercava in pagina l'**UUID di una
  riga**.
- **Il motivo «il contratto l'ha firmato chi costruiva» è CHIUSO** (2026-08-05,
  P.4b sul pilota `fornodoro`): `docs/vetrina.md` porta
  `Confermato da: Alberto Marocco (committente) il 2026-08-05` — una persona
  vera, che non ha costruito niente, sul documento che dichiara *cosa diventa
  visibile a uno sconosciuto*. Gate **VERDE 10/10** su build di produzione
  rilanciato dal direttore. È la prima e (al 2026-08-06) l'unica delle tre
  skill a chiuderlo: flow-sentinel e speed-demon hanno contratti firmati **per
  delega** (D14), che non chiude il motivo.
  **Resta aperto**, e non è la firma: il gate pretende una colonna di
  pubblicazione anche dove il dominio non ha bozze, e al contratto manca un
  gettone `funzione:` per le pagine che leggono da una RPC (P.4b, attriti 2 e
  3). Nessuno dei due impedisce l'uso su un progetto vero; entrambi vanno
  chiusi nella minuteria della skill.
- **Proprietario:** Alberto
- **Dipendenze:**
  - **A monte:** **schema-forge** (tabelle, viste, policy di lettura per il ruolo
    anonimo, tabella dei contenuti e suo seed, tipi generati) · brief-smith (quali
    pagine e quali contenuti vuole il cliente) · prompt-smith (richiesta professionale)
  - **A fianco:** **gestionale-crafter** — non e' un prerequisito, ma lavora sulla
    **stessa tabella di slot**: le chiavi devono coincidere, e chi arriva secondo legge
    l'handoff del primo invece di inventarsele. Condivide anche la cucitura
    `src/components/ui/`: chi arriva dopo **la estende**, non la riscrive
  - **A valle:** **flow-sentinel** · **speed-demon** (`docs/vetrina.md` e' la fonte del
    suo elenco di pagine) · **site-doctor** · cyber-shield · launchpad
  - **Fly UI non e' una dipendenza e non lo diventera'**: non esiste
    (`../../DECISIONI.md` §21). Anche **sites-effects** resta fuori: e' una libreria
    esterna che in questo repo non c'e', e un progetto che la adotta lo dichiara come
    deroga in `docs/PROGETTO.md`
- **Guardiani sugli script:** ESLint **0 errori 0 avvisi** · `knip` **pulito**
  (rilanciati a fine P2) · `jscpd` pulito in P1 (7 file, 3 121 righe, 0 cloni),
  **non rilanciato dopo P2** · `semgrep`, `gitleaks` e `/code-inquisition`
  **mai lanciati**.

## Cosa fa, in una riga

Costruisce le pagine pubbliche di un progetto Web Gun sopra lo schema di schema-forge
— layout, componenti dietro la cucitura, lettura dei dati con la chiave anonima,
contenuti presi dalle tabelle degli slot — e si rifiuta di consegnarle se una pagina
dichiarata non risponde, se una pagina servita non e' dichiarata, se nel testo servito
c'e' ancora un segnaposto, se un contenuto editabile e' cablato nel codice invece che
nel database, o se una chiave di servizio e' raggiungibile dal sito pubblico.

## Piano P0 → P3

| Fase | Cosa | Dove | Stato |
|---|---|---|---|
| P0 | progettazione: `SKILL.md`, specifica del gate a dieci passi, template del contratto e dell'handoff | qui | **fatta il 2026-08-02**, firmata dal committente (commit `a1ee045`) |
| P1 | costruzione: references, `scripts/`, guardiani, **banco**, sette comandi esercitati, sabotaggio, gate verde | qui | **consegnata il 2026-08-03** — deliverable 1-3 il 2026-08-03 (commit `b7fa58f · 43ff29f · 2697787`), 4-9 lo stesso giorno dopo P.0-igiene e P.8. Verbale: `COSTRUZIONE-2026-08-03.md` |
| P2 | collaudo avversario indipendente su **dominio diverso**: caccia ai falsi verdi dei dieci passi | chat vergine (chi costruisce non collauda) | da fare |
| P3 | primo consumatore reale, col contratto firmato da un **committente** | pacchetto «filo completo» | da fare |

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Test degli script | **183 verdi** (misurati il 2026-08-04: 177 prima di P.0-igiene-2, +6 con la terna dell'epilogo per i due gusci eseguibili. La riga diceva **122**, il conto di P1: era rimasta indietro di due pacchetti — corretta qui col numero misurato, non stimato) | `npm test` · `node --test "scripts/**/*.test.mjs"` |
| Passi del gate implementati | 10, con `id` stabili e ordine bloccato da un test | `scripts/verify.mjs`, `ID` |
| Passi del gate **eseguiti su un progetto vero** | **10 su 10** | gate su `banco-prova-controtempo`, uscita incollata nel verbale |
| Comandi esercitati | **7 su 7** | `specchio` · `scaffold` · `pagine` · `audit` · `evolve` · `verify` · `handoff` |
| Classi di sabotaggio provate | **7 su 7** del mandato, **+3** (tipi, a11y, handoff), **+6** controlli al contrario, **+6** classi cieche | `references/sabotaggio.md`, colonne «Esito misurato» compilate |
| Difetti **del gate** trovati sabotando | **3**, tutti chiusi con un test | §Quattro difetti trovati costruendo e sabotando |
| Premesse della specifica smentite dalla misura | **4** | §Le premesse che il banco ha smentito |
| Regole pure | 2 librerie, 35 funzioni esportate | `audit-lib.mjs` (327 righe) · `progetto-lib.mjs` (900 righe) |
| Gusci di I/O | 2 | `verify.mjs` (566) · `vetrina-audit.mjs` (295) |
| References | **5** | 1 400 righe in tutto |
| Falsi verdi previsti dalla specifica e diventati test | **10 su 10** | i test che cominciano con «falso verde» |
| Guardiani | ESLint 0/0 · knip pulito · jscpd 0 cloni | eseguiti |

## Le tre decisioni sospese, chiuse col banco

Nessuna era stata decisa a tavolino, e nessuna è stata decisa leggendo: ognuna ha
la sua misura accanto, e la misura ha cambiato due delle tre.

| # | Decisione | Esito | La misura che l'ha decisa |
|---|---|---|---|
| **S1** | slot dichiarato senza riga pubblicata: `block` o MANCANTE? | **`block`** | i due casi (riga in bozza / riga assente) piantati sul banco danno lo **stesso** esito: `/docenti` serve la sezione decapitata e il `<title>` scende da «Chi insegna · Controtempo» a «Docenti · Controtempo». In tutti e due il database **ha risposto**. Resta MANCANTE l'altra metà — la tabella **non interrogata** — che prima avrebbe prodotto un `block` per ogni slot dichiarato |
| **S2** | la soglia distintiva (ripiego 24) | **resta 24**, e il numero da guardare era un altro | sui sei slot veri i frammenti misurano 43, 183, 247, 257, 271, 314 caratteri: a 24 restano fuori **zero slot su sei**, il più corto sta 19 sopra. Ma 24 era **sotto il rumore**: `to_jsonb(t)` portava nei candidati anche `id` (36) e i due timestamp (32), e su uno slot corto vinceva l'**UUID**. Ogni soglia sotto 33 era decorativa |
| **S3** | i due rilievi sulle date | **uno dei due falsi positivi dichiarati non esiste** | firma: `touch` sull'handoff di schema-forge → **nessun rilievo** (la data si legge dal testo, non dal filesystem); il vero positivo scatta con le due date stampate. Build: `touch` su un sorgente → l'`issue` scatta davvero. Frequenza su un ciclo normale costruisci → rilancia: **0 scatti su 9 esecuzioni** per entrambi |

## Quattro difetti trovati costruendo e sabotando, e chiusi

I primi tre non li ha trovati nessuna lettura: sono usciti puntando il gate dove
non doveva.

1. **Sulla dev server il gate accusava l'imputato sbagliato — diagnosi
   bugiarda.** Puntato su `next dev`, chiudeva `FAIL` dicendo «sta rispondendo
   un'altra applicazione sulla stessa porta», mentre l'applicazione era proprio
   quella. **Nessuno dei sette indizi di dev server scattava**: sono tutti
   dell'era Webpack, e da Next 16 il default è Turbopack. Chiuso con due indizi
   strutturali misurati sullo stesso progetto servito nei due modi — `hmr-client`
   e `next-devtools` nei percorsi dei chunk — ancorati a `/_next/static/chunks/`
   così una pagina che *parla* di HMR non li fa scattare. Tre test.
2. **Una pagina non scaricata rendeva muti i suoi slot — falso verde.** Col
   sabotaggio della classe E (`/contatti` a 404), `contenuti-vivi` chiudeva
   «nessun rilievo» avendo saltato **in silenzio** due slot su sei: la metà «la
   stringa è in pagina» non era stata verificata affatto. Ora sono due MANCANTI
   con il percorso della pagina. Due test.
3. **Il frammento distintivo poteva essere l'UUID della riga — rosso falso con
   diagnosi bugiarda.** Vedi S2. Su una pagina perfettamente corretta il gate
   stampava `il valore pubblicato nel database non compare nel testo servito …
   «44444444-4444-4444-8444-000000000006…»`. Chiuso scartando **per forma** UUID
   e timestamp ISO dai candidati. Tre test.
4. **Il passo `tipi` era spento sul progetto, e non per colpa del gate.** La
   classe H di sabotaggio (colonna rinominata in `database.types.ts`) **non
   scattava**: i moduli del banco riscrivevano i tipi a mano e chiudevano con
   `as unknown as`, quindi la catena fra schema e pagine era tagliata. È un
   difetto del *progetto generato*, non della skill — ma la skill lo produceva,
   e ora `references/pagine-e-dati.md` prescrive di derivare i tipi con
   `Pick<Database[...]["Row"], …>`. Con i tipi derivati la stessa rinomina
   produce 5 errori in tre file.

Restano validi i tre difetti trovati nella prima metà di P1 (regola della
cucitura che non poteva scattare, audit che usciva 0 con tre MANCANTI, ESLint che
non lintava niente e non lo diceva): sono in `COSTRUZIONE-2026-08-03.md` §2.

## Le premesse che il banco ha smentito

Quattro, e la seconda è quella che cambia una riga di dottrina.

1. **«Il frammento distintivo è il più lungo dei valori di testo dello slot».**
   Falso: `to_jsonb(t)` porta con sé la chiave primaria e le date. Vedi S2.
2. **«Una colonna selezionata e non disegnata arriva lo stesso al browser, nell'HTML
   servito e nel payload RSC».** Misurato: **zero occorrenze** in entrambi. Di un
   Server Component viaggia l'*uscita*, non i suoi dati. La premessa vale appena
   la riga passa a un Client Component come prop, o se la query si fa nel browser.
   **Quello che è pubblico davvero** è un'altra cosa, e va scritta al posto di
   quella: la chiave anonima sta nel bundle, e con quella chiunque chiede a
   PostgREST le colonne che il `grant` e la policy concedono —
   `?select=id,created_at,in_evidenza` risponde. *Ciò che è pubblico lo decide il
   modello di accesso a monte, non l'elenco del nostro `select`.*
3. **«Il falso positivo del rilievo sulla firma: un handoff riscritto per un refuso
   invecchia una firma buona».** Non esiste: la data si legge dal testo. Vedi S3.
4. **La ricetta della classe E di sabotaggio** («rinomina `page.tsx` in
   `_page.tsx`») **non funziona su Next 16**: la build muore prima sui tipi di
   rotta generati. Corretta nella reference.

## Due cose di Next 16 che una vetrina deve sapere, misurate qui

Non sono difetti della skill, e non sono note di colore: sono i due modi in cui su
questo stack si misura il sito di ieri credendo di misurare quello di adesso.

- **La Data Cache sopravvive a `next build`.** Una riga cambiata nel database non
  entra nella build nuova finché non scade la finestra di `revalidate`: il gate
  vede — correttamente — una pagina che non mostra ciò che il database dice, e la
  diagnosi da sola manderebbe a cercare un difetto nel codice della pagina. Il
  `hint` di `contenuti-vivi` ora elenca tutte e tre le cause.
  Si chiude con `rm -rf .next/cache/fetch-cache`.
- **I tipi di rotta generati sono uno stato.** Se una rotta sparisce, il validatore
  generato la cerca ancora e la build muore con `Cannot find module
  ../../../src/app/<rotta>/page.js`, additando un file che nessuno ha scritto.
  Si chiude con `rm -rf .next/dev/types .next/types`.

## Decisioni prese in P1

Le quattro che cambiano la forma del codice. Le tre correzioni del direttore in
revisione della P0 sono applicate e non sono ripetute qui.

1. **`verify.mjs` IMPORTA `vetrina-audit.mjs` invece di lanciarlo come
   sottoprocesso.** schema-forge e gestionale-crafter lanciano il loro audit perche'
   ha bisogno di `psql` e si punta anche su un database diverso; qui i tre passi
   statici girano sullo stesso progetto e non hanno nessun bersaglio separato, quindi
   una seconda serializzazione JSON aggiungerebbe solo un modo di fallire. Un errore
   imprevisto la' dentro **non uccide il gate**: e' catturato e diventa MANCANTE —
   un gate che crasha non e' ne' verde ne' rosso, e' assente.
2. **Due librerie di regole, divise per input e non per argomento.** `audit-lib.mjs`
   guarda i **sorgenti**, `progetto-lib.mjs` guarda il **contratto e l'app servita**.
   La seconda importa i primitivi dalla prima invece di riscriverli: girano sempre
   insieme dentro lo stesso gate, quindi la dipendenza non accoppia niente che fosse
   separato (stessa scelta, e stessa motivazione, di gestionale-crafter).
3. **Il frammento distintivo di uno slot e' il piu' lungo dei suoi valori di testo**,
   ricavato con `to_jsonb(t)` invece di elencare le colonne — **meno i valori
   tecnici**, che si scartano per forma. La seconda metà di questa frase l'ha
   scritta il banco: senza, il gate cercava un UUID dentro una pagina.
4. **Il comando dei test elenca i file per esteso.** `node --test "scripts/**/*.test.mjs"`
   funziona su Node 24 e **non** su Node 20 (dove il pattern e' un percorso letterale);
   `node --test scripts` fa l'opposto. Elencare i tre file e' l'unica forma che gira su
   entrambi — e questa macchina ha Node 20.12.2 di sistema.

## Cosa NON e' stato fatto, e perche'

- **Nessun committente ha firmato niente.** Sul banco il contratto della vetrina
  porta `Confermato da: ORCHESTRATORE`, cioè la firma di chi costruiva. È il
  limite ereditato dalla P0 e si chiude in P3.
- **`semgrep`, `gitleaks` e `/code-inquisition` non sono mai stati puntati su
  questi script.** `semgrep` risulta presente su questa macchina secondo gli
  `STATO.md` di schema-forge e speed-demon: è una verifica **disponibile e non
  fatta**, e sta nel perimetro di P.7c.
- **`code-maniac scan` non è stato lanciato sul banco.** Il banco è usa e getta e
  i guardiani della casa girano sugli **script della skill**, dove sono verdi.
- **Nessuna misura di quanto il gate impieghi.** Sul banco (5 pagine, 6 slot, 2
  fonti) l'esecuzione completa è nell'ordine dei secondi, ma non è stata
  cronometrata: su un sito di trenta pagine non lo sa nessuno.
- **Il modulo pubblico non è stato provato.** Il banco dichiara «Nessuna scrittura
  pubblica», quindi il caso di frontiera di `SKILL.md` §Perimetro — la vetrina che
  apre un percorso di scrittura all'anonimo — resta senza una misura.
- **Storage non è stato toccato.** Le immagini del banco sono file statici; il
  caso «il cliente carica una foto» ha tre policy sullo stesso bucket e nessuno
  strumento di questa pipeline le guarda.

## Cosa un gate verde NON prova

Scritta per intero in `SKILL.md` §Cosa un gate verde NON prova — dodici voci. Le tre
che contano di piu': il gate legge **la firma** del contratto e non la sua verita';
non sa se quello che la pagina mostra **debba** essere pubblico; e quello che è
pubblico lo decide il `grant` a monte, non l'elenco del nostro `select`.

`references/sabotaggio.md` §Le classi che questo gate NON puo' vedere elenca le
rotture che devono restare **verdi**, e adesso ognuna ha accanto la misura che lo
dimostra invece della previsione. **Dopo il collaudo P2 quell'elenco è più corto**:
tre righe sono barrate (`route.ts`, le colonne concesse a PostgREST, e — a metà —
`Nessuno slot.`) perché erano righe che nessuno aveva provato a guardare, non
limiti. Le due che restano sono in §Punti aperti, coi loro perché.

## Punti aperti — ordinati per gravita'

> **CHIUSO il 2026-08-04 (P.0-igiene-2) — il gate parla anche dalla junction.**
> Era: invocato come `.claude/skills/vetrina-crafter/scripts/verify.mjs` il gate
> usciva **0 senza stampare una riga**, mentre per percorso reale usciva 2 col
> messaggio (misura di P.4-pre, `../../PILOTA-PRE-2026-08-04.md` §2b). Causa:
> `resolve(process.argv[1])` normalizza il percorso ma non scioglie una junction,
> mentre `import.meta.url` è già canonico — guardia falsa, `main()` mai chiamata.
> Ora l'epilogo confronta **due volte** (testuale e `realpathSync`, con ricaduta
> sul testuale se `realpathSync` solleva), ed è la forma che l'`hint` della regola
> `epiloghi-vivi` prescrive da oggi. Commit `257e34d` (guardia, anche in
> `vetrina-audit.mjs`), `e6deb39` (`hint`), `c96ae00` (test).
>
> Da leggere senza consolazione: fino al 2026-08-04 l'epilogo di questa skill era
> **il modello** — l'`hint` della regola diceva «usa la forma di vetrina-crafter».
> Era la forma giusta contro `import.meta.main` e falsa attraverso una junction.
>
> **Misura del 2026-08-04**, node di sistema 20.12.2, cartella vuota fuori
> dall'albero: **entrambi i canali escono 2** con lo stesso messaggio, carattere
> per carattere — `Ne' docs/ ne' src/app/ in <cwd>: qui non c'e' un progetto Web
> Gun, e un ROSSO direbbe qualcosa su un progetto che il gate non ha guardato.`; e
> `vetrina-audit.mjs` dalla junction esce **1** stampando il suo `AUDIT STATICO`
> con i `MANC` (prima usciva 0 muto). Uscite incollate in
> `../../IGIENE2-JUNCTION-2026-08-04.md` §1. **Cade il vincolo provvisorio di
> D12**: i gate si lanciano da **entrambi** i canali, junction compresa — che è
> come li vede una chat aperta sul repo di un progetto generato.
>
> Regressione piantata: i due gusci eseguibili di questa skill non avevano
> **nessuno** dei test dell'epilogo (a P.0-igiene non c'era niente da correggere
> qui). Ora ne hanno **tre a testa** — funzionale, statico, junction — in
> `scripts/verify.test.mjs`: +6 test. Perché i due di `vetrina-audit.mjs` stanno
> in quel file e non in un `vetrina-audit.test.mjs` proprio: lo `npm test` di
> questa skill elenca i file per esteso in `package.json` (§4 qui sotto: il glob
> non gira su Node 20), e `package.json` era fuori dal perimetro del mandato — un
> file di test non elencato sarebbe una verifica MANCANTE travestita da PASS.
> **Resta al direttore** decidere se spostarli, con le due righe da aggiornare
> (`package.json` e la frase «i tre file» di `SKILL.md`).

1. **Nessun committente ha firmato niente.** Ereditato dalla P0, si chiude in P.4.
   È il punto più grave rimasto, e il collaudo P2 **non lo tocca**: due banchi
   verdi su elenchi di pagine che si sono scritti da soli dimostrano che l'agente
   è coerente con sé stesso.
2. **Il caso F di `evolve` e' cieco per costruzione**, e **rimisurato in P2** su un
   secondo banco: riscritto `Cosa mostra:` di `/come-arrivare` come «la mappa
   interattiva con il tracciato GPS, il meteo a sei giorni e il modulo per
   prenotare il trasferimento in fuoristrada», il gate chiude verde 10/10 su una
   pagina che non esiste. Non chiudibile senza giudicare un significato.
3. **La primitiva reimplementata a mano resta cieca**, e in P2 si è deciso che
   **conviene lasciarla tale**: ogni regola immaginata produce rossi su pagine
   corrette, e il difetto evitato è reversibile mentre il costo sarebbe
   strutturale (`COLLAUDO-2026-08-04.md` §4). Il confine si è però spostato: la
   copia **importata** ora si vede ovunque stia (difetto n°7).
4. **`Nessuno slot.` non è più un buco intero.** Il difetto n°13 applica la regola
   del testo cablato anche alle righe **pubblicate** che nessuno slot dichiara —
   il database è un elenco che nessuno accorcia riscrivendo un documento. **Resta
   cieco** il solo caso in cui il testo cablato nel database non esiste affatto.
5. **Il gate non misura la staleness del CONTENUTO.** `identita` confronta la
   build coi file **sorgente**, e in una skill la cui dottrina è «il contenuto sta
   nel database» quello è l'unico ingresso rispetto a cui la build può invecchiare.
   Il difetto n°8 ha reso la diagnosi giusta (il `hint` ora si stampa e nomina la
   Data Cache), **non automatica**: `updated_at` mantenuto da un trigger è una
   convenzione dichiarata di schema-forge, e il gate non la interroga.
6. **Nessun passo ha un timeout.** Se `psql` si blocca, il gate si blocca con lui.
   Misurato il tempo (**4,93 s di media su 9 pagine e 13 slot**, varianza 0,22 s su
   tre giri identici), non la sua patologia.
7. **Le euristiche degli alias hanno ancora un limite dichiarato.** `puntaA`
   risolve ora **esatto** i percorsi relativi (difetto n°7); per `@/` e `~/`, che
   senza `tsconfig.json` non si risolvono, resta un confronto **ancorato in testa**
   — cieco su un monorepo con due cartelle omonime in pacchetti diversi. I
   segnaposto sono ancora cercati come stringhe: `da compilare` e `da decidere`
   sono italiano ordinario, e su un contenuto vero che li contenga il passo
   `segnaposto-serviti` darebbe un `block` su prosa finita. **Non misurato** su un
   contenuto scritto in buona fede: sul banco quella frase c'era come residuo di
   sabotaggio, non come testo del rifugio.
8. **Due domini, un solo stack.** Tutto quello che è scritto qui è vero su Next 16
   con Turbopack e Supabase locale. Il collaudo P2 ha aggiunto un dominio (rifugio
   alpino) e un percorso di scrittura pubblico, non un altro stack.
9. **`--json` non è stato esercitato in P2.** Il contratto d'uscita in JSON esiste;
   tutte le misure di questo collaudo sono sull'uscita per umani.

## Proposte a monte/valle

Il consumatore riporta, il proprietario decide. Nessuno di questi file e' stato
toccato da qui.

**A schema-forge**

1. **La tabella dei contenuti non e' nelle sue references, ed e' lui che deve
   scriverla.** Il modello degli slot è documentato in
   `agenti/gestionale-crafter/references/contenuti-editabili.md`, cioè nel consumatore
   e non nel produttore. Proposta: `forge` la genera quando il brief dichiara contenuti
   editabili, con la sua policy e **almeno una riga di seed per slot dichiarato** —
   senza righe la vetrina si costruisce sul vuoto, e dal 2026-08-03 quel caso è un
   `block` del passo `contenuti-vivi` (decisione S1).
2. **Una policy di lettura mancante per `anon` non e' un `block` di nessun gate suo.**
   L'audit RLS cerca tabelle *nude* e policy *sbagliate*; una tabella con RLS attiva e
   nessuna policy per l'anonimo e' **corretta** per l'audit e **invisibile** per il
   sito pubblico. Qui la trova `contenuti-vivi` contando le righe leggibili
   impersonando il ruolo — cioè a valle, quando le pagine sono già state scritte.
3. **`Confermato da: … il <DATA>` va scritta in forma ISO**, e su questo il banco dà
   ragione alla proposta: il passo `contratto-vetrina` legge quella data dal testo
   dell'handoff di schema-forge e ci confronta la firma della vetrina. Con
   `il 24 luglio 2026` il confronto **non si fa affatto**, in silenzio.
4. **Il `grant update` per colonna merita una riga nelle sue references.** Sul banco
   ha impedito alla redazione di rinominare la chiave di uno slot — cioè di rompere
   la pagina che la cerca, senza nessun errore da nessuna parte. È l'unica difesa che
   la RLS non può dare, e ha il suo test pgTAP.

**A speed-demon**

5. **`docs/vetrina.md` e `docs/performance.md` elencano due volte «le pagine che
   contano», e possono divergere in silenzio.** Proposta: `contratto-performance` legge
   `docs/vetrina.md` quando c'e', almeno per un `warn` sulle pagine presenti in uno e
   non nell'altro.
6. **I suoi sette indizi di dev server non vedono Turbopack.** Misurato qui il
   2026-08-03 su Next 16: nessuno dei sette scatta, e il passo che li usa accusa
   «un'altra applicazione sulla stessa porta». I due indizi che funzionano sono
   `hmr-client` e `next-devtools` nei percorsi dei chunk, ancorati a
   `/_next/static/chunks/`. **È lo stesso elenco che speed-demon ha nel proprio
   gate**, ed è una correzione da portare lì.
7. **Il controllo sulla build piu' vecchia dei sorgenti e' riusabile**, e ora ha anche
   la sua frequenza misurata: 0 falsi positivi su 9 esecuzioni in un ciclo normale.

**A flow-sentinel**

8. **Il controllo della data della firma esiste, in un gate.** Il §7 del suo
   `COLLAUDO-EVOLVE-2026-07-30.md` lo lascia aperto e propone `git log`, fermandosi
   davanti ai progetti senza git. Qui e' risolto senza git, confrontando due date
   **dichiarate** in due file dello stesso progetto — e il falso positivo che temeva
   (un handoff riscritto) **non si verifica**, perché la data si legge dal testo.

**A gestionale-crafter**

9. **Le chiavi degli slot vanno dette in forma fissa.** Oggi il suo handoff le elenca
   in prosa: due agenti sulla stessa tabella possono scrivere due insiemi di chiavi
   diversi senza che nessuno se ne accorga finche' il cliente non modifica una riga che
   nessuna pagina mostra. Sul banco il caso è arrivato per davvero — uno slot
   rinominato a monte — e a intercettarlo è stato il **contratto della vetrina**, non
   i tipi: una chiave di slot è una stringa.

**Alla regia**

10. **Node 20.12.2 di sistema è sotto quello che chiedono gli strumenti della casa.**
    `jscpd` gira solo col Node 24 di scoop, e va invocato come
    `node_modules/jscpd/bin/jscpd` (lo shim `.bin/jscpd` è uno script di shell che
    Node non sa eseguire). Con quello è **pulito: 0 cloni su 3 121 righe**.

**Dal primo consumatore reale (P.4b, pilota `fornodoro`, 2026-08-05)**

11. **Il contratto non ha un gettone per una fonte-FUNZIONE.** Le fonti si
    dichiarano `tabella:`, `vista:` o `slot:`. Sul pilota due pagine
    (`/ordine` e `/ordine/<codice>`) leggono da una RPC — `ordine_per_codice()`
    — e hanno dovuto dichiarare `nessuna`, che il template glossa come «pagina
    di solo markup»: vero a metà, perché la seconda legge dati veri. Dichiarare
    `tabella:ordini` sarebbe stato **peggio che falso**: quella tabella
    l'anonimo non la può leggere (è il punto del disegno) e `contenuti-vivi`
    l'avrebbe segnalata come fonte negata. Proposta: un gettone `funzione:` che
    il passo 9 tratti come «non conta righe, non cerca testo». Chiuso sul pilota
    con `nessuna` più una prosa che dice cos'è.
12. **Il gate pretende una colonna di pubblicazione anche dove il dominio non ha
    una bozza.** `tabellaContenutiDa` esige `pubblicato <colonna>` e ci
    costruisce un `where`; sul pilota `contenuti_sito` è nata senza stato di
    bozza (scelta di schema-forge), quindi la riga dichiara la costante
    `pubblicato `true``. Ha funzionato — `IDENTIFICATORE` accetta `true` e
    `where true` è SQL valido — ma **per caso, non per disegno**: nessun test
    copre il caso, e nessun `hint` dice a chi lo incontra che è la strada.
    Proposta: ammettere esplicitamente una costante dichiarata, oppure una forma
    `pubblicato: sempre` che il gate traduca lui.
13. **Il verde al primo lancio non ha impedito sei rilievi.** Il gate ha chiuso
    10/10 su codice in cui `/code-inquisition` ha poi trovato sei cose vere (due
    delle quali portate dal **critico del roster**, non dagli esperti). Nessuna
    era nel perimetro dei dieci passi, e va bene così — ma la riga §Cosa un gate
    verde NON prova adesso ha un numero accanto, misurato su un progetto vero:
    **sei**.
