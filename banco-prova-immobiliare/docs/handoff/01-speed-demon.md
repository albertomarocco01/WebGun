# Handoff 01 — Speed Demon · Case di Langa

**Gate: ROSSO** (0 falliti, 1 verifiche mancanti su 7 passi) — rilanciato il
2026-07-30 dopo aver scritto questo file.

La verifica mancante e' `rete-verde`, e non e' un residuo da sistemare: questo
banco **non ha una batteria E2E** per scelta dichiarata in `docs/PROGETTO.md`.
Su un progetto vero questo rosso non si consegna.

## 1. Cosa ho fatto

Questo non e' un progetto cliente: e' il banco del **collaudo avversario di
Speed Demon** (P2), costruito il 2026-07-30 su un dominio scelto apposta diverso
dagli altri banchi e con pagine genuinamente lente. Il verbale completo, con
tutte le esecuzioni, e' in `agenti/speed-demon/COLLAUDO-AVVERSARIO-2026-07-30.md`.

**Misurato** (`measure`): baseline su build di produzione, porta 3200, tre giri
per pagina, mediana e dispersione, profilo desktop. Contratto firmato in
`docs/performance.md`.

**Applicato** (`tune`), una alla volta, rimisurando dopo ciascuna:

| # | Ottimizzazione | Dove | Guadagno misurato | Costo dichiarato |
|---|---|---|---|---|
| T1 | `next/image` con `width`/`height`/`sizes` e `priority` sull'elemento LCP (catalogo §1, §2) | `src/app/page.tsx` | `performance 77±1 → 100±0` · LCP 5 496 → 746 ms · peso 6,31 → 0,47 MB · l'immagine servita passa da 6 482 248 a 1 336 698 byte (−79%) | Le foto **vengono ricompresse** a qualita' 75 e servite in WebP: non e' un ritaglio, ma non e' piu' il file del proprietario. Su foto vere e' una decisione di chi vende. L'ottimizzazione avviene nel processo del server alla prima richiesta di ogni variante, e occupa cache su disco. Un solo `priority` in tutta la pagina: verificato, `1` preload con `as="image"` nell'HTML servito |
| T2 | `next/image` con `sizes` sulle tre schede, **senza** `priority` (catalogo §1, §2) | `src/app/immobili/page.tsx` | `performance 75±8 → 100±1` · LCP 13 543 → 615 ms · peso 15,25 → 0,43 MB | Come sopra. Niente `priority` perche' sono in griglia e §2 dice che metterlo su tutte lo annulla |
| T3 | `canonical` proprio invece di `/` (seo.md §103) | `src/app/immobili/page.tsx` | `seo 92 → 100`, audit `canonical` chiuso | Nessuno. Era un errore di copia-incolla del blocco `metadata` della home |
| T4 | `title` nel `metadata` (seo.md §89) | `src/app/agenzia/page.tsx` | `seo 91 → 100` e `accessibility 95 → 100` | Nessuno |
| T5 | `/riservata` tolta dalle pagine misurate e dichiarata fra le escluse | `docs/performance.md` | il gate smette di attribuire `performance 100` a una pagina che non e' un documento | Si perde la misura di quella rotta finche' non esistera' davvero. Non e' un'ottimizzazione: e' una correzione del contratto |
| T6 | `src/app/icon.svg` | `src/app/` | `best-practices 96 → 100` su `home` e `agenzia`; `/immobili` resta a 96 per un'altra causa, §4.6 | Nessuno |

## 2. Decisioni prese, con motivazione

**T6 l'ho applicata pur essendo lavoro di Site Doctor**, e vale la pena dire
perche'. Il punto 4 di `agenti/speed-demon/STATO.md` diceva «`best-practices` si
ferma a 96 e nessuno sa perche'». Qui si e' fermato a 96 uguale, e la causa
misurata e' una sola: audit `errors-in-console`, peso 1, un `404` su
`/favicon.ico`. Aggiungere l'icona ha portato la categoria a 100 su tutte le
pagine: **la diagnosi e' provata togliendo la causa**, non dedotta. La stessa
assenza c'e' su `banco-prova-negozio`, che infatti misurava 96.

**Il profilo di misura e' desktop, e cambia quali difetti esistono.** Sulla home,
stessa build: desktop `performance 77 · TBT 0 ms`, mobile `performance 63 ·
TBT 478 ms`. Il componente client di questa app — un piano di ammortamento
calcolato in modo sincrono durante l'idratazione — **in desktop non produce TBT
misurabile**, quindi non e' stato ottimizzato: sarebbe stato lavoro senza un
numero che lo giustifica. Chi rimisurera' in mobile lo trovera' e lo dovra'
togliere, ed e' scritto qui perche' non sembri una svista.

**Nessuna deroga.** La prima stesura del contratto ne portava una su
`immobili · performance`; dopo T2 la pagina sta a 100 e la deroga non copriva
piu' niente, quindi e' stata tolta.

## 3. Cosa mi aspetto faccia il prossimo

**Cyber Shield e Site Doctor** non hanno niente da raccogliere qui: questo banco
non ha autenticazione, non ha database, non raccoglie dati e non e' destinato a
essere pubblicato. Se un giorno lo diventasse:

- `sitemap.ts` e `robots.ts` **non esistono**, e nessun passo del gate di Speed
  Demon li guarda (SKILL §Cosa un gate verde NON prova);
- `NEXT_PUBLIC_SITE_URL` non e' impostata: `metadataBase` ripiega su
  `http://127.0.0.1:3200` e **i canonical serviti dichiarano quell'host**. In
  locale e' legittimo; pubblicato cosi' sarebbe un canonical sbagliato, che
  costa piu' di un canonical assente (seo.md §103). Stesso debito di
  `banco-prova-negozio` §3.3.

**Chi tocchera' questo banco** legga prima `docs/PROGETTO.md`: i difetti che
restano sono piantati apposta e sono le prove del collaudo.

## 4. Problemi noti

1. **`rete-verde` MANCANTE.** Non c'e' batteria E2E, quindi le sei modifiche qui
   sopra sono state applicate **senza rete**, cioe' nella condizione che la
   seconda legge della SKILL vieta. Regge solo perche' e' un banco e perche' le
   modifiche sono metatag e sostituzioni di tag immagine, non logica. Su un
   progetto cliente sarebbe un rosso strutturale.
2. **Le foto sono rumore generato, non fotografie.** `npm run foto` produce pixel
   casuali: incomprimibili per costruzione, quindi il guadagno di T1 e T2 viene
   quasi tutto dal **ridimensionamento** e dalla compressione con perdita, non
   dal cambio di formato. Su foto vere la ripartizione e' diversa; la direzione
   no.
3. **Tre immobili, non trecento.** La griglia vola con tre schede. Con il
   catalogo vero cambia tutto, e nessun numero preso qui lo dice.
4. **Il componente client resta lento in mobile** (TBT 478 ms), per la scelta
   spiegata al §2.
5. **`code-maniac scan` non e' stato lanciato su questo banco**: MANCANTE, non
   PASS. Il banco non ha ESLint ne' configurazione di lint — e' stato costruito
   per misurare Lighthouse, non per essere consegnato.
6. **`/immobili` linka tre pagine che non esistono.** `best-practices` si ferma a
   **96** su quella pagina, e la causa e' misurata: le tre schede rimandano a
   `/immobili/<slug>`, il prefetch dei `<Link>` va a prendersele, tornano `404`,
   e i 404 finiscono nella console (audit `errors-in-console`). **Non l'ho
   corretto**: e' un difetto dell'applicazione — una lista che rimanda al vuoto —
   e chi ottimizza non decide se costruire la rotta di dettaglio o togliere i
   link. Tolgo solo l'equivoco: non e' il prefetch a essere sbagliato, e
   spegnerlo nasconderebbe il difetto invece di chiuderlo. Ha prodotto anche una
   correzione al catalogo (`references/ottimizzazioni.md` §11), che dichiarava
   che il prefetch «costa al server, non al punteggio».
