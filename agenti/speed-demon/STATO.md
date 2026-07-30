# Stato — Speed Demon

- **Stato attuale:** v1.1 — costruita il 2026-07-30 e **collaudata in modo
  avversario lo stesso giorno da una sessione indipendente**, su un secondo
  banco costruito apposta con pagine davvero lente
  (`banco-prova-immobiliare`, Case di Langa). Gli script hanno test propri
  (`node --test`, **73 verdi**), il gate `verify` ha **7 passi** con id stabili.
  Il gate corretto e' stato **rilanciato sul banco vecchio**, `banco-prova-negozio`,
  e chiude **VERDE 7/7**: nessuna regressione, e `rete-verde` — la seconda legge
  della skill — ha finalmente girato dentro questo gate, verde sull'app giusta e
  rosso quando lo si punta su un'altra.
  **NON ancora usabile su un progetto cliente**: restano i punti in fondo,
  ordinati per gravita'. Il primo non e' un difetto della skill — e' che
  l'elenco delle pagine che contano lo firma chi collauda, non chi vende.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: **flow-sentinel** (la batteria E2E e' la rete: il passo `rete-verde`
    la rilancia davvero, non si fida dell'handoff) · gestionale-crafter e
    schema-forge (l'app da misurare) · brief-smith (quali pagine contano)
  - A valle: cyber-shield e site-doctor (verifiche finali sul sito ottimizzato),
    launchpad (non pubblica su gate rosso)
  - **Fly UI non esiste** (`DECISIONI.md` §21): non c'e' nessuna libreria di
    componenti da ottimizzare, i componenti sono scritti a mano nel progetto.
- **Guardiani:** code-maniac e code-inquisition valutano gli script di questa
  skill come qualsiasi altro codice. Nessuno dei due li ha mai visti: punto 5.

## Cosa fa, in una riga

Misura un sito Web Gun gia' costruito e gia' testato, propone le ottimizzazioni
**col loro costo**, le applica una alla volta rimisurando e rilanciando la rete
E2E, e si rifiuta di consegnare se ha misurato una dev server, se la rete e'
rossa, se una soglia dichiarata non regge senza deroga scritta, o se una pagina
pubblica esce senza `title` unico, `description` e `canonical` proprio.

## I due collaudi

**Costruzione — 2026-07-30**, banco `banco-prova-negozio` (verbale
`COSTRUZIONE-2026-07-30.md`). Gate VERDE 7/7, batteria E2E rilanciata dalla
skill e verde contro la build di produzione, **tre difetti SEO veri** trovati su
un progetto dove Lighthouse dichiarava SEO 100, sabotaggio sulla dev server
rosso con i due indizi stampati, **quattro difetti della skill** trovati e
corretti.

**Collaudo avversario — 2026-07-30**, banco `banco-prova-immobiliare` (verbale
`COLLAUDO-AVVERSARIO-2026-07-30.md`). Sessione separata, dominio nuovo, pagine
genuinamente lente. **Diciassette difetti**, tutti misurati prima di essere
corretti, tutti con test di regressione:

- **dodici falsi verdi**, fra cui `seo-meta` che chiudeva OK su quattro pagine di
  cui tre rotte (una senza `title` — quello letto era il `<title>` di un'icona
  SVG —, una col `canonical` che puntava alla home, una che rimandava altrove e
  di cui il gate leggeva e misurava un'altra pagina);
- **quattro rifiuti indebiti**, tutti dello stesso ceppo: **il gate non sapeva
  leggere il contratto che il suo template insegna a scrivere**, e rifiutava
  perfino una firma umana con nome e ruolo;
- **uno che misurava col profilo sbagliato in silenzio**: il contratto dichiarava
  desktop, il gate usava mobile. Sulla stessa build sono 14 punti di differenza e
  un'intera metrica che in un profilo esiste e nell'altro no (TBT 478 ms / 0 ms);
- **sei difetti su diciassette erano gia' descritti dentro le references della
  skill** (`seo.md` §296, §309, §313, §119 · `misurazione.md` §211, §256) e non
  erano implementati. La prosa sapeva, il codice no.

Il diciassettesimo non e' stato cercato: si e' presentato mentre si rilanciava il
gate corretto sul banco vecchio, ed e' il piu' grave. La porta 3100 — quella che
il contratto firmato di `banco-prova-negozio` dichiara nel suo `Comando:` — su
questa macchina era occupata dal sito di **un'altra azienda**. `--url`
obbligatorio impedisce al gate di *indovinare* la porta, non di *sbagliarla*, e
la porta sbagliata veniva da un documento firmato. Il passo `build-produzione`
ora pretende di trovare il `.next/BUILD_ID` del progetto nell'HTML servito.

E la prima esecuzione vera di `plan` e `tune` su guadagni misurati: home
`performance 77 → 100` (LCP 5 496 → 746 ms, peso 6,31 → 0,47 MB), `/immobili`
`75±8 → 100±0` e `seo 92 → 100` (LCP 13 543 → 582 ms, peso 15,25 → 0,43 MB).

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 7 | `verify.mjs --json`, `summary.passi` |
| Test degli script | **73 verdi** | `node --test "scripts/**/*.test.mjs"` |
| References | 3 | `misurazione.md` · `ottimizzazioni.md` · `seo.md` |
| Template | 2 | `performance.md` (il contratto) · `handoff-speed-demon.md` |
| Banchi su cui il gate e' girato | **2** | `banco-prova-negozio` · `banco-prova-immobiliare` |
| Difetti dell'app trovati | 3 (negozio) + 4 (immobiliare) | handoff 15 §2 · handoff 01 §1 |
| Difetti della skill trovati dai collaudi | 4 + **17** | i due verbali |

## Punti aperti — ordinati per gravita'

1. **Nessun committente ha mai firmato l'elenco delle pagine.** Su tutti e due i
   banchi la riga `Confermato da:` l'ha scritta chi costruiva o chi collaudava.
   Il gate legge la firma, non la sua verita': una baseline impeccabile sulle
   pagine sbagliate passa il gate ed e' comunque da buttare. E' il punto che
   nessun collaudo puo' chiudere, perche' si chiude con un cliente.
2. **La riga `Tipo:` del contratto non la legge nessuno.** Il gate tratta ogni
   pagina dichiarata come pubblica: su una rotta `autenticata` pretende
   `canonical` e considera un difetto il suo `noindex`, che invece e' la cosa
   giusta. Finche' e' cosi', le rotte autenticate vanno dichiarate fra le pagine
   escluse — il template ora lo scrive — e la reattivita' del backoffice resta
   **non misurata**. Dedotto dal codice, non riprodotto: nessuno dei due banchi
   ha una pagina autenticata nel contratto.
3. **Nessun passo verifica che le pagine escluse siano davvero escluse.** Il
   contratto dichiara `/admin/*` fuori misura e fuori indice, e il gate legge la
   dichiarazione senza controllarla. Su `banco-prova-negozio` si e' scoperto a
   mano che il `noindex` di `/admin` **non arriva a nessun crawler** perche' la
   guardia reindirizza prima.
4. **Nessun passo su `sitemap.ts` e `robots.ts`.** Il gate controlla i metatag di
   pagina e ignora i due file che dicono a un motore di ricerca cosa esiste.
5. **`code-inquisition` non e' mai stato lanciato sugli script di questa skill**,
   e `semgrep`/`gitleaks` non sono installati: MANCANTI, non PASS. Il collaudo
   avversario ha fatto crescere `gate-lib.mjs` e `verify.mjs`, quindi c'e' piu'
   codice mai passato ai guardiani di prima.
6. **Nessuna misura di campo.** Lighthouse e' un laboratorio. CrUX e RUM sono
   un'altra cosa e questa skill non li guarda.
7. **Il guadagno di `next/image` e' misurato su rumore, non su fotografie.** Le
   immagini di `banco-prova-immobiliare` sono pixel casuali con seme fisso:
   incomprimibili per costruzione, quindi il guadagno viene quasi tutto dal
   ridimensionamento e dalla compressione con perdita. Su foto vere la
   ripartizione fra le due cause e' diversa; la direzione no.

## Punti chiusi dai collaudi

- **«Un solo banco, e l'ho scritto io»** (ex punto 1) — chiuso dal collaudo
  avversario: secondo banco, dominio diverso, sessione indipendente, e `plan` e
  `tune` finalmente esercitati su un guadagno vero.
- **`rete-verde` mai visto funzionare** — **chiuso**, e in tutt'e due i versi. Il
  gate corretto rilanciato su `banco-prova-negozio` chiude `rete-verde` **OK**
  con «gate flussi: VERDE (0 falliti, 0 mancanti su 7 passi)»; puntato sull'app
  sbagliata lo stesso passo diventa **FAIL** con «gate flussi: ROSSO (2
  falliti)». La delega a Flow Sentinel non e' piu' verificata per lettura: e'
  stata vista funzionare e vista fallire.
- **Nessuna regressione sul banco vecchio** — il gate corretto chiude **VERDE
  7/7** su `banco-prova-negozio`, che col gate precedente chiudeva 7/7. Le regole
  nuove non hanno prodotto nessun falso rosso li', e una ha prodotto un `warn`
  vero: la deroga su `accesso · seo` non copriva piu' niente.
- **«`--giri 3` e' il minimo, e la soglia di dispersione non e' mai stata messa
  alla prova»** (ex punto 3) — chiuso a meta'. La soglia ora si legge dal
  contratto (il ripiego e' 5, come dice `misurazione.md`, non 10 come prima) ed
  e' scattata davvero: `/immobili` ballava di 8 punti. Si e' anche scoperto che
  la dispersione non parla solo della macchina — parla anche di una pagina
  troppo pesante per riprodursi: dopo `next/image` e' scesa a 0. La taratura per
  macchina resta da fare.
- **«`best-practices` si ferma a 96 e nessuno sa perche'»** (ex punto 4) —
  **chiuso, misurato**: audit `errors-in-console`, peso 1, un `404` su
  `/favicon.ico`. Aggiunta l'icona, la categoria e' passata a 100 su due pagine
  su tre. La terza si e' fermata a 96 per un'altra causa, anch'essa misurata: tre
  `<Link>` che precaricano una rotta di dettaglio **che non esiste**, tre `404`
  in console. Ha prodotto una correzione al catalogo
  (`references/ottimizzazioni.md` §11), che dichiarava che il prefetch «costa al
  server, non al punteggio». La stessa assenza di favicon c'e' su
  `banco-prova-negozio`, che infatti misura 96: e' lavoro di **site-doctor**, non
  di questa skill, ed e' il primo posto dove guardare quando quella categoria si
  ferma appena sotto il massimo.
