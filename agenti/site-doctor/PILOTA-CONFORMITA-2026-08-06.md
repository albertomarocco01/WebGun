# Verbale — site-doctor sul pilota, la prima volta

Progetto: **`fornodoro`** (pizzeria «Forno d'Oro»), ramo `master`.
Pacchetto **P.4i**, 2026-08-06 sera → 2026-08-07 notte.
Regia: `d147f52` → `980e61a` → `cbcbdc7` → `bee36c9` → **`3b2df31`** (si è mossa
**cinque volte** mentre il pacchetto lavorava; il giro dei gate è stato
rilanciato per intero **tre volte**, e ogni corsa porta lo `sha` catturato prima
e dopo).

> **Il commit non descrive tutto quello che ha girato.** Alla consegna la regia
> ha ancora script dei gate **modificati e non committati** — fra cui
> `agenti/site-doctor/scripts/conformita-lib.mjs`. Le corse di questo verbale
> hanno usato quelle versioni lì. Chi rilegge questi verdetti a modifiche
> committate **rilanci**.

Questo verbale è **della regia**: raccoglie le uscite per intero e i rilievi che
riguardano **le skill**, non il pilota. Ciò che riguarda il pilota sta nei suoi
documenti — `docs/conformita.md`, `docs/handoff/16-site-doctor.md`,
`docs/handoff/17-p4i-certificato-e-registro.md`, `docs/DEBITO-TECNICO.md`.

## 1. Cosa è successo, in dieci righe

La skill **site-doctor** ha girato per la prima volta su un progetto vero,
`perimetro → scansiona → certifica → handoff`, e il suo gate è passato da
**ROSSO (4 falliti, 3 verifiche mancanti su 9 passi)** a **VERDE (12 `pass`,
1 `n/a` su 14 passi)** — i passi sono diventati quattordici a metà strada, §1-bis.

Tutti e quattro i rossi di partenza erano **cose vere di quel sito**, e nessuna
era mai stata scritta da nessuna parte: un sito che chiede nome e telefono e non
ha un'informativa; una base giuridica che nessuno aveva dichiarato; un
`localStorage` che nessun documento nominava; un contratto d'uscita inesistente.
Il pilota ha avuto in una sera il documento che la catena non aveva mai
prodotto, e otto voci nuove nel registro del debito.

## 1-bis. Il momento che vale più di tutto il resto: D21 è arrivata a certificato emesso

Alle 22 il certificato del pilota delegava `sitemap`, `robots`, `open-graph`,
`favicon` e `dati-strutturati` a **speed-demon**. Era la verità di allora, ed era
scritta con la misura accanto. Tre ore dopo la regia ha committato **D21**, e il
gate è passato da **9 passi a 14**.

**Il gate ha rifiutato il certificato che questa stessa skill aveva appena
emesso**, con quattro bloccanti e con la frase che vale più di questo verbale:

> *«delegata a speed-demon, ma questo gate la MISURA con il passo `sitemap-xml`.
> Dal 2026-08-06 (D21) è di site-doctor: il certificato va aggiornato, perché
> così com'è attribuisce a un altro una cosa che ho appena guardato io»*.

Due cose da tenere.

**La prima**: il rifiuto è **corretto e utile**. Una voce attribuita a chi non la
guarda è il difetto da cui questa skill è nata; il caso più difficile da vedere
non è l'attribuzione sbagliata, è quella **giusta ieri**. Il passo `perimetro` la
prende, e la prende senza sapere niente di D21 — sa solo che `mio` non è `null`
e che il documento dice un altro nome.

**La seconda, ed è un limite della prosa e non del codice**: la prima stesura del
certificato conteneva **già** l'avvertenza — *«queste righe cambieranno
proprietario, e vanno cambiate rilanciando il gate, mai rileggendo questa
frase»*. Averlo previsto non è servito a niente: il documento è rimasto
sbagliato finché qualcuno non ha rilanciato. **Nessuna avvertenza scritta dentro
un documento lo tiene aggiornato.**

I cinque passi nuovi hanno trovato, sul pilota, tre cose che nessuno misurava:
la **favicon risponde 200** su tutte e sei le pagine (ed è la voce da cui la
skill è nata: sul pilota è stata un `404` per tre anelli); **sei pagine su sei
dichiarano l'Open Graph e nessuna ha `og:image`**; **zero blocchi
`application/ld+json`**. Le ultime due sono diventate residui n°59 e n°55.

## 2. Quattro rilievi sulle skill, in ordine di gravità

### 2.1 `SCOPERTE` invecchia in un'ora, e il gate se ne accorge nel modo peggiore

**Gravità: media. Di chi: site-doctor.**

Alle 22 la parola «contrast» non compariva in nessun file di
`agenti/speed-demon/`, e il certificato ha scritto `contrasti` **scoperta**, con
la misura accanto. Un'ora dopo la regia ha committato il passo
`contrasto del testo (audit color-contrast)` e il rilancio l'ha misurato:
*5 pagine, 5 col contrasto verificato*. La riga del certificato è passata a
**delegata**, e il file citato adesso la nomina — **ma il gate continua a
stampare** `contrasti: delegata a speed-demon, e il suo GATE non la guarda`,
perché `SCOPERTE` in `scripts/conformita-lib.mjs` porta ancora la misura delle
22.

La skill prescrive che una riga esca da `SCOPERTE` **solo rilanciando il
`grep`**, mai leggendo un handoff — ed è la regola giusta. Quello che non
prescrive è **quando**: l'elenco è una misura del 2026-08-06 scritta in un
letterale, e nessun passo del gate la ridata. Il difetto non è il contenuto
stantio: è che un `issue` falso convive con sette veri, e chi legge otto righe
uguali smette di leggerle.

**E in poche ore è successo due volte**: `contrasti` e `dati-strutturati` sono
tutte e due misurate davvero — la prima da speed-demon, la seconda **da questo
stesso gate** dopo D21 — e tutte e due continuano a uscire come scoperte.

**Proposta**: il `grep` che produce `SCOPERTE` diventi eseguibile — uno script
della skill che lo rilancia sui gate dei vicini e stampa la differenza — oppure
ogni riga porti la **data della misura** accanto al testo, così che «misurato il
2026-08-06» si legga come una data e non come un fatto. La versione di stanotte
già stampa `misurato il 2026-08-06 sulla regia a d147f52`, che è metà del
rimedio: dice **quando**, e non ancora **che è vecchio**. Decide la regia.

### 2.2 Il filtro dei nomi di servizio è cambiato, e un numero è cambiato con lui

**Gravità: bassa. Di chi: site-doctor.**

`NOMI_DI_SERVIZIO` è passata da un confronto sul **prefisso** a uno sul **nome
intero** (`/^(\$ACTION[\w-]*|…)$/i`). Su App Router i campi di servizio delle
Server Action sono quattro, e due portano i due punti — `$ACTION_1:0`,
`$ACTION_1:1` — quindi non combaciano più con `[\w-]*$`: il passo `dati-raccolti`
è passato da «7 campi letti» a «9 campi letti» **senza che il sito cambiasse**.

Nessuna conseguenza sull'esito — quei campi non sono dati personali per nessun
criterio del gate — ma è la forma in cui un numero cambia in un certificato
senza che il progetto sia cambiato, e chi rilegge sospetta di sé invece che
dello strumento. Sul pilota è scritto in `docs/conformita.md`, §Dati raccolti.
**Proposta**: se il nome intero è la forma voluta, il commento accanto nomini
`$ACTION_1:0` come caso, così il prossimo lettore non lo riscopre.

### 2.3 Una voce del registro del pilota nomina site-doctor, e site-doctor non la copre

**Gravità: media. Di chi: la regia (perimetro).**

`docs/DEBITO-TECNICO.md` n°13 — «nessuna Content-Security-Policy» — scrive alla
colonna «rientro previsto»: *«site-doctor quando esisterà, o cyber-shield.
Nessuno dei due esiste: è un bisogno senza proprietario»*. Site-doctor adesso
esiste, e la CSP **non è** fra le sue voci di conformità: l'elenco `VOCI` vive
nel codice e non la contiene.

Quella riga ha oggi un proprietario **scritto e falso**, che è peggio di uno
scoperto: la Legge n°1 della skill esiste per impedire esattamente questo, e qui
si applica a una voce che sta fuori dal suo elenco. **O la CSP entra in `VOCI`,
o la riga del pilota va corretta.** È una decisione di perimetro, non
un'esecuzione: non è stata presa qui.

### 2.4 Il gate di launchpad legge una tabella; il modello del registro non la prescrive

**Gravità: bassa. Di chi: launchpad.**

La riga di forma fissa `Blocca il deploy: sì|no` (D23 §2) vale **in un punto
qualunque** della voce, e la reference lo dice. Sul pilota è diventata una
**settima colonna**, perché una tabella di cinquantotto righe si legge per
colonne — ma sette voci del registro si fermavano alla sesta colonna, e senza
riempirle la colonna nuova sarebbe finita nella loro sesta. Chi migra un
registro con questa forma deve pareggiare le righe corte prima, e non è scritto
da nessuna parte.

**Proposta**: il modello del registro (`resources/templates/`) nasca con la
colonna già presente, come la reference stessa suggerisce quando dice che «la
difesa che regge è che il registro nasca da un template con una riga di forma
fissa».

## 3. Due trappole di macchina, misurate

Non sono difetti di nessuna skill, ma tutte e due fanno **dire a un gate una
cosa falsa sul sito**, e la diagnosi dal solo verdetto è impossibile. Sul pilota
sono i debiti n°57 e n°58.

**Lighthouse esce `1` dopo aver stampato il rapporto.** `chrome-launcher` non
riesce a cancellare il profilo temporaneo — `EPERM` su `%TEMP%\lighthouse.<n>` in
`Launcher.destroyTmp` — e il rapporto JSON, già prodotto per intero, viene
buttato. I processi `chrome` restano vivi: **sedici**, contati. Da lì in poi
nessun giro parte più, e il gate di speed-demon chiude **ROSSO con `nessun giro
riuscito su 3` su tutte e cinque le pagine**, con `MANC` sulla misura **e** sul
contrasto. Il gate fa la cosa giusta — un giro fallito non vale zero — e per
questo il rosso non dice il perché. Spenti i `chrome`: **VERDE 8/8**, senza
toccare una riga del progetto.
*Se il rimedio deve stare nel gate, è di speed-demon: leggere il codice
d'uscita insieme allo `stdout`, o rilanciare una volta prima di dichiarare il
giro perso.*

**`npm run seed-sviluppo` col Node di scoop nel `PATH` non trova la CLI di
Supabase.** Vive nella cache `_npx` **del node che la invoca**, e su questa
macchina i node sono due con due cache. Lo script muore con «*Non sono riuscito
a chiedere a `supabase status` dov'è il database. Lo stack di questo progetto è
acceso?*» — **e lo stack era acceso**. È la terza faccia del n°10 del pilota su
una superficie nuova.

## 4. La lezione che è costata due commit

Il passo `segreti` di launchpad blocca su
`postgresql://<utente>:<tre asterischi>@127.0.0.1:7622/postgres`, perché tre
asterischi sono una password di tre caratteri e il gate non ha modo di saperlo.
P.4h l'aveva già trovato incollando un'uscita, e aveva eliso l'autorità
dichiarandolo.

**P.4i l'ha rifatto scrivendo la voce di registro che lo descrive.** La voce
n°56 e il §0-bis del runbook citavano la stringa **per intero**, e il gate l'ha
ritrovata in `docs/DEBITO-TECNICO.md:202`. Tolta da HEAD, ma il prezzo è pagato:
le copie nella storia sono passate da una a **tre**. *Una voce di registro che
descrive un segreto può contenerlo, e allora il registro diventa il segreto.*

Da questo giro **tutti** i gate della catena stampano l'autorità già mascherata:
la trappola non è più di una uscita su cinque, è di tutte. Chi ridata un
certificato elida l'autorità e lo dichiari.

## 5. Cosa è stato scritto nel pilota

| File | Cosa |
|---|---|
| `docs/conformita.md` | il certificato di idoneità — **non esisteva** |
| `src/app/(sito)/privacy/page.tsx` | l'informativa in bozza, art. 13 per intero, senza segnaposto |
| `src/components/CorniceSito.tsx` | una riga: il collegamento nel piè di pagina |
| `docs/handoff/16-site-doctor.md` | il contratto d'uscita dell'anello |
| `docs/handoff/17-p4i-certificato-e-registro.md` | il contratto d'uscita del pacchetto |
| `docs/DEBITO-TECNICO.md` | 58 voci, tutte con `Blocca il deploy: sì\|no`; otto nuove |
| `docs/deploy.md` | §0-bis (n°27, D24 e il primo `git push`) e nove bloccanti risposti |
| `docs/handoff/07 · 08 · 10 · 12 · 13 · 14 · 15` | ridatati contro le corse vere |

**Il gate di pubblicazione, alla consegna: ROSSO con tre rifiuti**, e nessuno
dei tre è di questo pacchetto — `segreti` (n°27, della direzione),
`runbook-firmato` (di Alberto, in persona), `contratto-uscita` (l'handoff di
launchpad, che non esiste finché non esiste una pubblicazione). Erano **quattro**
a inizio serata: il quarto, `verdetti`, era nostro ed è chiuso.

**Niente è stato pubblicato**: nessun account, nessun dominio, nessun DNS,
nessun deploy, nessun `git push`. `git remote -v` è vuoto, ed è la precondizione
scritta in `docs/deploy.md` §0-bis. `docs/deploy.md` resta **non firmato**.

## Le uscite, per intero

### schema-forge — VERDE 9/9 (regia `cbcbdc7`)

```
GATE SCHEMA: VERDE (0 falliti, 0 verifiche mancanti su 9 passi)

OK    sqlfluff (formato SQL)
OK    squawk (operazioni pericolose)
OK    supabase db reset (applicazione reale)
        7 migrazioni applicate + seed
OK    supabase db lint
OK    supabase db advisors
        [WARN] multiple_permissive_policies (6): public.allergeni, public.allergeni_voci_menu, public.categorie, …
OK    audit RLS
        schemi esposti: public, graphql_public · postgresql://…@127.0.0.1:7622/postgres
        guardati: 9 tabelle · 19 policy · 0 viste · 6 funzioni security definer · 64 colonne · 5 file di test pgTAP
        [issue] public.allergeni → "gli allergeni sono pubblici": policy con `using (true)`: RLS attiva ma senza filtro
        [issue] public.allergeni_voci_menu → "gli allergeni delle voci sono pubblici": policy con `using (true)`: RLS attiva ma senza filtro
        [issue] public.categorie → "le categorie sono pubbliche": policy con `using (true)`: RLS attiva ma senza filtro
        [issue] public.contenuti_sito → "i testi del sito sono pubblici": policy con `using (true)`: RLS attiva ma senza filtro
        [issue] public.orari_apertura → "gli orari sono pubblici": policy con `using (true)`: RLS attiva ma senza filtro
OK    pgTAP (test delle policy)
        5 file di test eseguiti
OK    tipi TypeScript
OK    contratto d'uscita (configurazioni + handoff)
```

### vetrina-crafter — VERDE 10/10, un `issue` su `/privacy` (regia `bee36c9`)

```
--url assente: uso l'indirizzo dichiarato in docs/vetrina.md → http://127.0.0.1:3621
GATE VETRINA: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)

OK    contratto della vetrina
        6 pagine · 7 slot · confermato da: Alberto Marocco (committente) il 2026-08-05
        nessun rilievo
OK    tipi TypeScript
        `tsc --noEmit` pulito
OK    cucitura dei componenti
        66 file letti sotto src/ · 25 sotto src/app · 12 nella cucitura src/components/ui
        primitive dichiarate: Bottone, Card, Sezione, Campo, Etichetta, Avviso, Navigazione, Prezzo, Invito, AreaTesto, Conto
        nessun rilievo
OK    chiavi e client dei dati
        66 file letti sotto src/ · 25 sotto src/app · 12 nella cucitura src/components/ui
        moduli client ammessi: src/lib/supabase/public.ts, src/lib/supabase/server.ts, src/lib/supabase/middleware.ts
        nessun rilievo
OK    accessibilita' statica (jsx-a11y)
        34 file con markup lintati in src/app, src/components/ui
        nessun rilievo
OK    identita' dell'app servita
        http://127.0.0.1:3621 (HTTP 200) · build id 9b6802a5de9b68da529c8da0924e99ea92916ddd · nessuno degli indizi di dev server
OK    pagine dichiarate e pagine servite
        6 pagine dichiarate · 7 rotte da `page` nei sorgenti · 0 da `route` · 1 escluse dal contratto
        [issue] /privacy: rotta pubblica servita da `src/app/(sito)/privacy/page.tsx` e non dichiarata nel contratto: e' una pagina che chiunque puo' aprire e che nessuno ha firmato
          → aggiungila al contratto e falla riconfermare, oppure mettila fra le §Pagine escluse dal contratto col perche'
OK    segnaposto nel testo servito
        6 pagine lette (senza `<script>` e `<style>`: dentro c'e' il payload RSC, non la pagina)
        nessun rilievo
OK    contenuti e permessi dell'anonimo
        database: postgresql://…@127.0.0.1:7622/postgres · schemi: public, graphql_public · soglia distintiva: 24 caratteri · 7 slot dichiarati, 0 righe pubblicate che nessuno slot dichiara
        nessun rilievo
OK    contratto d'uscita (handoff)
        docs/handoff/08-vetrina-crafter.md · verdetto misurato: VERDE
        nessun rilievo
```

### gestionale-crafter — VERDE 7/7, era ROSSO per il n°50 (regia `bee36c9`)

```
GATE GESTIONALE: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    configurazione del gestionale
        radice admin: src/app/admin · entita' dichiarate: 7 · escluse: 2
OK    entita' ancorate allo schema
        9 tabelle nei tipi: allergeni, allergeni_voci_menu, categorie, contenuti_sito, orari_apertura, ordini, personale, righe_ordine, voci_menu
OK    audit del gestionale (guardie, RLS, permessi)
        rotte: 11 · azioni server: 7 riconosciute in 7 file · scritture: 10 · postgresql://…@127.0.0.1:7622/postgres
        nessun bloccante (0 issue, 0 warn)
OK    tipi allineati allo schema
OK    tipi del progetto (tsc)
        tsconfig.json del progetto · compilerOptions.strict: true
OK    accessibilita' (eslint jsx-a11y)
        controllate: src/app/admin, src/components · regole: C:/Users/Utente/Desktop/WebGun/agenti/gestionale-crafter/resources/config/eslint-a11y.config.mjs (della skill, non del progetto)
OK    contratto d'uscita (handoff)
```

### flow-sentinel — VERDE 7/7, 22 test passati, 13 flussi su 13 (regia `bee36c9`)

```
GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    contratto dei flussi critici
        13 flussi (5 positivo · 3 ostile-lettura · 5 ostile-scrittura) — confermati da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-05
OK    copertura dei flussi (una spec per flusso)
        13 flussi · 13 file di spec
        ogni flusso dichiarato ha almeno una spec che lo attacca
OK    lint delle spec
        nessun `.only`, nessuno skip non motivato, ESLint pulito
OK    asserzione di effetto sul database
        10 flussi devono asserire l'effetto sul database (i positivi e gli ostili in scrittura)
        tutti importano e chiamano `e2e/helpers/db`
OK    app viva e database del progetto
        app: http://127.0.0.1:3621 (HTTP 200) · database: postgresql://…@127.0.0.1:7622/postgres
        schemi esposti: public, graphql_public · 9 tabelle, 74 righe di seed
OK    batteria Playwright (il browser giudica)
        13 file di spec · 22 passati, 0 falliti, 0 saltati
        13 flussi critici su 13 percorsi davvero dal browser: accesso-titolare, admin-negato-anon, autodisattivazione-negata, giro-cucina, ordine-asporto-anonimo, ordini-negati-anon, salto-di-stato-negato, scrittura-menu-negata-cucina, stato-falsificato-negato, titolare-cambia-menu, titolare-cambia-testo, titolare-negato-cucina, voce-esaurita-rifiutata
OK    contratto d'uscita (handoff + configurazione)
```

### speed-demon — VERDE 8/8, un passo in piu': il contrasto (regia `bee36c9`)

```
--url assente: uso l'indirizzo dichiarato in docs/performance.md → http://127.0.0.1:3621
GATE PERFORMANCE: VERDE (0 falliti, 0 verifiche mancanti su 8 passi)

OK    contratto delle pagine e delle soglie
        5 pagine · form factor: mobile · deroghe scritte: 0
        confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06
OK    rete E2E di Flow Sentinel
        gate flussi: VERDE (0 falliti, 0 mancanti su 7 passi)
OK    build di produzione (non dev server)
        http://127.0.0.1:3621 (HTTP 200) · build id 9b6802a5de9b68da529c8da0924e99ea92916ddd · nessuno degli indizi di dev server nell'HTML servito
OK    misura Lighthouse (mediana di N giri)
        dispersione massima ammessa: 5 punti (dichiarata nel contratto)
        home (/) · 3/3 giri: performance 99±0 · accessibility 100±0 · best-practices 100±0 · seo 100±0
        menu (/menu) · 3/3 giri: performance 99±0 · accessibility 100±0 · best-practices 100±0 · seo 100±0
        ordina (/ordina) · 3/3 giri: performance 99±1 · accessibility 100±0 · best-practices 100±0 · seo 100±0
        ordine (/ordine) · 3/3 giri: performance 99±0 · accessibility 100±0 · best-practices 100±0 · seo 100±0
        chi-siamo (/chi-siamo) · 3/3 giri: performance 99±1 · accessibility 100±0 · best-practices 100±0 · seo 100±0
OK    soglie dichiarate
        20 soglie confrontate: ogni pagina dichiarata rispetta la sua
OK    contrasto del testo (audit color-contrast)
        5 pagine · 5 col contrasto verificato · 0 con elementi insufficienti · 0 senza testo da confrontare
OK    metatag nell'HTML servito
        title unico, description e canonical proprio su 5 pagine · nessun noindex nel corpo ne' nelle intestazioni
OK    contratto d'uscita (handoff)
        docs/handoff/13-speed-demon.md
```

### site-doctor — VERDE, 8 `pass` e 1 `n/a` su 9 passi (regia `bee36c9`)

```
GATE CONFORMITA': VERDE (0 falliti, 0 verifiche mancanti, 1 non applicabili su 14 passi)

OK    certificato di idoneita' firmato
        lingue dichiarate: it · informativa dichiarata: /privacy · banner: no
        archiviazioni dichiarate: 1 · campi con base giuridica: 5 · voci in tabella: 16
        confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-06
OK    superficie pubblica camminata (collegamenti + sitemap)
        identita': build id 9b6802a5de9b68da529c8da0924e99ea92916ddd trovato nell'HTML servito · 6 pagine lette · 0 rimandi o errori non seguiti
        radice: /
        sorgenti: collegamenti da / (6) · sitemap.xml (5)
        superficie: / /chi-siamo /menu /ordina /ordine /privacy
OK    informativa privacy raggiungibile
        informativa: /privacy (HTTP 200) · 1 candidati scaricati · collegata da 6 pagine su 6
OK    dati raccolti dai moduli pubblici
        2 pagine con moduli · 9 campi letti · 5 righe di base giuridica nel certificato
        ogni campo che raccoglie un dato personale ha la sua base giuridica dichiarata
OK    cosa il sito archivia nel browser
        0 cookie · 1 usi di API di archiviazione · 0 origini di terzi · 9 script esterni e 0 inline letti per intero
        archiviazione: localStorage in /ordina
        tutto quello che il sito archivia e' dichiarato nel certificato
OK    accessibilita' dell'HTML servito
        6 pagine lette sull'HTML servito, carico RSC escluso dal conteggio dei tag
        lingua, titoli, alt, main, etichette e nomi accessibili: nessun rilievo
        i CONTRASTI non sono misurati qui: sono di speed-demon, che apre un browser (SKILL.md §Perimetro)
N.A.  lingua dichiarata e hreflang
        lingue misurate sull'HTML servito di 6 pagine: it · rotte per lingua trovate nella superficie: nessuna · lingue dichiarate nel certificato: it
        NON APPLICABILE: sito monolingua misurato, gli hreflang non si applicano.
OK    favicon: dichiarata e servita
        1 icone dichiarate su 6 pagine, ognuna scaricata: /icon.svg?icon.3rkzeymsm89ww.svg → 200
        ogni icona dichiarata risponde 200
OK    Open Graph: l'anteprima che il sito sceglie
        6 pagine su 6 dichiarano l'Open Graph · 0 immagini di anteprima scaricate
          [issue] /: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
          [issue] /chi-siamo: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
          [issue] /menu: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
          [issue] /ordina: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
          [issue] /ordine: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
          [issue] /privacy: dichiara l'Open Graph e gli mancano og:image: un'anteprima a meta' e' quella che decide il motore, non il sito
OK    dati strutturati (JSON-LD)
        0 blocchi `application/ld+json` su 6 pagine, ognuno interpretato come JSON
          [issue] dati-strutturati: nessuna delle 6 pagine dichiara dati strutturati (`application/ld+json`)
OK    sitemap.xml: la promessa fatta ai motori
        `/sitemap.xml` → HTTP 200 · 5 indirizzi dichiarati, confrontati con le 6 pagine servite
        ogni indirizzo dichiarato nella sitemap e' servito
OK    robots.txt: cosa il sito ammette
        `/robots.txt` → HTTP 200 · 1 gruppi di regole · 1 righe `Sitemap:`
        confrontato con la superficie camminata (6 pagine) e con la sitemap (5 indirizzi)
        niente di cio' che il sito pubblicizza e' vietato ai motori
OK    proprieta' delle voci di conformita'
        16 righe in tabella contro 12 passi eseguiti · 3 voci scoperte
        0 bloccanti, 3 da guardare, 0 righe fuori elenco
          [issue] contrasti: delegata a speed-demon, e il suo GATE non la guarda: misurato il 2026-08-06 sulla regia a `d147f52`: la parola «contrast» non compare in NESSUN file di `agenti/speed-demon/` (grep, 0 file). Il suo gate esegue Lighthouse con la categoria `accessibility`, che contiene l'audit `color-contrast`, ma legge solo il PUNTEGGIO della categoria (0 occorrenze di `audits` nei suoi script): il singolo audit non lo apre mai, la soglia sta in `docs/performance.md` del progetto e non ha un pavimento, e una deroga porta il rilievo da `block` a `warn`. Un'altra chat sta aggiungendo la lettura del singolo audit in questa stessa ondata: quando sara' in regia, questa riga si toglie RILANCIANDO IL GREP, non leggen…
          [issue] accessibilita-admin: delegata a gestionale-crafter, e il suo GATE non la guarda: misurato il 2026-08-06 sulla regia a `d147f52`: il passo `a11y` di gestionale-crafter lancia `eslint-plugin-jsx-a11y` sui SORGENTI (`verify.mjs:326-347`), non sull'HTML servito delle rotte protette. E' una misura vera e dichiarata «sui sorgenti», non una delega vuota come le altre — ma non e' la stessa cosa che questa skill fa sul sito pubblico, ed e' per quella differenza che l'accessibilita' del pubblico e' mia. La delega resta perche' l'area protetta vuole una sessione. Il documento citato la nomina — nominare non e' misurare, ed e' la forma esatta del difetto della favicon. Finche' resta cosi' questa voce e' SCOPERTA e va letta …
          [issue] antispam: SCOPERTA: nessuno la guarda. Resta scoperta e visibile — dichiararla e' l'unica cosa che la distingue da una dimenticata
OK    contratto d'uscita (handoff)
        docs/handoff/16-site-doctor.md
Un NON APPLICABILE ha la sua premessa misurata stampata qui sopra: se la premessa e' falsa, lo e' anche la risposta.

GATE CONFORMITA': VERDE (0 falliti, 0 verifiche mancanti, 1 non applicabili su 14 passi)
```

### launchpad — ROSSO, 3 falliti e nessuno di questo pacchetto

```
GATE LAUNCHPAD: ROSSO (3 falliti, 0 verifiche mancanti su 9 passi)
progetto: C:\Users\Utente\Desktop\fornodoro

OK    si pubblica un commit, non un working tree
        commit 05cf64463d20 · ramo master · remoto (nessuno)
        [issue] master: nessun ramo remoto configurato
OK    verdetti dichiarati dagli agenti a monte
        9 handoff letti: schema-forge · vetrina-crafter · gestionale-crafter · flow-sentinel · speed-demon · p4g-prerequisiti · p4h-credenziale-e-certificati · site-doctor · p4i-certificato-e-registro
        contratti trovati sul disco (prova che l'agente doveva passare): supabase/migrations/ · docs/vetrina.md · docs/gestionale.md · docs/flussi-critici.md · docs/performance.md
        ultimo commit che tocca il codice: 2026-08-06T22:54:28+02:00
        questo passo LEGGE una dichiarazione e ne misura la freschezza: non rilancia i gate a monte (references/verifica-deterministica.md §6)
        nessun rilievo
OK    bloccanti dichiarati nel registro del debito
        59 voci lette · 9 dichiarano `Blocca il deploy: si`: n°4 · n°5 · n°33 · n°12 · n°17 · n°27 · n°51 · n°52 · n°56
        13 voci gia' chiuse a monte · 31 numeri citati dagli handoff
        questo passo LEGGE: l'elenco l'hanno scritto altri. `segreti` e `runtime-riproducibile` rimisurano da soli due di queste voci
        nessun rilievo
FAIL  nessun segreto nel pacchetto che parte
        150 file tracciati letti · 0 nuovi non ancora tracciati · 0 binari · 4 ignorati guardati · 0 NON letti
        regole sul nome applicate a 150 percorsi, prima e indipendentemente dalla lettura
        storia: 406 pezzi (file x commit, piu' i messaggi di commit e di tag) letti dagli ultimi 200 commit — un segreto tolto da HEAD e' ancora consegnato a chi ha clonato
        6 famiglie di segreto cercate · quello che si trova NON si stampa: solo famiglia, file, riga e i primi quattro caratteri
        [block] supabase/seed/90-solo-sviluppo.sql:226: credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
        [issue] .env.e2e.local: 3 rilievi in un file IGNORATO da git (service-role · nome-di-servizio-valorizzato · entropia-alta) — prime righe: .env.e2e.local:11 · .env.e2e.local:11 · .env.e2e.local:11
        [block] docs/deploy.md @ d4dcb2b522bd (2026-08-06): password dentro l'autorita' di un URL — password nell'URL `postgresql://…@….0.1`: *** [3 caratteri]
        [block] docs/deploy.md @ d4dcb2b522bd (2026-08-06): password dentro l'autorita' di un URL — password nell'URL `postgresql://…@….0.1`: *** [3 caratteri]
        [block] docs/DEBITO-TECNICO.md @ 710f9f02eff7 (2026-08-06): password dentro l'autorita' di un URL — password nell'URL `postgresql://…@….0.1`: *** [3 caratteri]
        [block] docs/handoff/08-vetrina-crafter.md @ fff715b02c83 (2026-08-06): password dentro l'autorita' di un URL — password nell'URL `postgresql://…@….0.1`: *** [3 caratteri]
        [block] supabase/seed/90-solo-sviluppo.sql @ 2a7291d6df2b (2026-08-06): credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
        [block] supabase/seed/90-solo-sviluppo.sql @ 967f2b4fd48b (2026-08-06): credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
        [block] supabase/seed/90-solo-sviluppo.sql @ 967f2b4fd48b (2026-08-06): credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
        [block] supabase/seed.sql @ b1df95724521 (2026-08-04): credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
        [block] supabase/seed.sql @ b1df95724521 (2026-08-04): credenziale cablata in una migrazione o in un seed — password in chiaro dentro `crypt('…')`: pas… [11 caratteri]
OK    variabili d'ambiente dichiarate e non committate
        radici spedite: src/ · next.config.ts · public/ · 67 sorgenti letti
        6 variabili lette dal codice · 3 dichiarate nel runbook
        3 escluse perche' sono le fonti del commit dell'impronta, non configurazione dell'app: WEBGUN_COMMIT · VERCEL_GIT_COMMIT_SHA · CF_PAGES_COMMIT_SHA
        nessun rilievo
OK    la build si rifa' uguale su un'altra macchina
        455 package.json di dipendenze LETTI · 317 dichiarano un `engines.node` · il piu' esigente e' `@supabase/auth-js` (>=22.0.0)
        il progetto dichiara: `>=22.0.0` · packageManager: npm@11.16.0
        lockfile: package-lock.json
        runtime dichiarato sul provider: Node 24
        nessun rilievo
OK    l'impronta dell'artefatto e' derivata dal commit
        impronta attesa dal commit di HEAD: `05cf64463d20` · `.next/BUILD_ID`: `05cf64463d2086e3da963d6d9cb9b5f77a9e54de`
        verificata su http://127.0.0.1:3621 — prova il MECCANISMO, non la pubblicazione: dopo il deploy si rilancia con `--url` sul dominio vero
        [issue] next.config.ts → generateBuildId: non solleva quando il commit non e' risolvibile
FAIL  runbook firmato da un umano, sul contenuto
        provider: Vercel · dominio: https://fornodoro.it — PROPOSTO E NON REGISTRATO: nessuno lo possiede oggi, si verifica alla firma · modo: git
        firma: <NOME COGNOME> — <AAAA-MM-GG>
        sezioni presenti: variabili · pubblico · rollback · prescrizioni
        [block] Confermato da: segnaposto del template, non una firma
FAIL  contratto d'uscita (handoff)
        docs/handoff/<n>-launchpad.md
        [block] docs/handoff/<n>-launchpad.md: handoff assente

Non si pubblica. Ogni motivo dice di chi e': quasi nessuno e' di launchpad.
```

### code-maniac scan — 1 passo con problemi, 1 saltato

```

Code Maniac — scan

  [ OK ] Formattazione (Prettier)
  [ OK ] Lint (ESLint) — via npm run lint
  [ OK ] Tipi (tsc) — via npm run type-check
  [ OK ] Complessità funzioni (cognitive/CCN/nesting) — eslint
  [SKIP] Convenzioni di progetto (script custom) — non installato
  [ OK ] Architettura (dependency-cruiser)
  [ OK ] Codice morto (knip)
  [ OK ] Duplicati (jscpd)
  [WARN] Regole (semgrep)
      ┌─────────────────┐
      │ 3 Code Findings │
      └─────────────────┘
          next.config.ts
         ❯❯❱ javascript.lang.security.detect-child-process.detect-child-process
                ❰❰ Blocking ❱❱
  [ OK ] Segreti (gitleaks)

Residuo per l'LLM: 1 passi con problemi, 1 saltati (tool mancanti o non configurati).
Da risolvere a giudizio: semgrep
Risparmio: i tool hanno prodotto 195 righe di output; all'LLM ne arrivano 6 (≈97% non lette — l'LLM legge il residuo, non i log grezzi).
Routing suggerito (complessità + sicurezza): opus + Security-auditor + Specchio — sicurezza: semgrep/gitleaks hanno segnalato → Opus + Security-auditor + Specchio (costituzione §2, sempre) · [complessità: complessità nella norma (pass/warn) — Sonnet, flusso normale]
```

### I commit della regia, catturati prima e dopo ogni corsa

```
schema | exit=0 | regia prima=3b2df31 dopo=3b2df31
seed exit=0
vetrina | exit=0 | regia prima=3b2df31 dopo=3b2df31
gestionale | exit=0 | regia prima=3b2df31 dopo=3b2df31
flussi | exit=0 | regia prima=3b2df31 dopo=3b2df31
conformita | exit=1 | regia prima=3b2df31 dopo=3b2df31
speed | exit=0 | regia prima=3b2df31 dopo=86b1855
```
