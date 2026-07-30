# Stato — Speed Demon

- **Stato attuale:** v1.0 — skill vera, **costruita e collaudata lo stesso
  giorno** (2026-07-30) su un progetto Next.js + Supabase reale
  (`banco-prova-negozio`, Bottega Nord), che non era un banco fatto apposta: era
  gia' li', costruito da altri tre agenti e con una batteria E2E verde addosso.
  Gli script hanno test propri (`node --test`, **42 verdi**), il gate `verify` ha
  **7 passi** con id stabili.
  **NON ancora usabile su un progetto cliente.** Il gate misura Lighthouse, i
  metatag serviti e la rete E2E; non sa se le pagine dichiarate siano quelle che
  contano, e la misura resta di laboratorio. Punti aperti in fondo, ordinati per
  gravita'.
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
  skill come qualsiasi altro codice.

## Cosa fa, in una riga

Misura un sito Web Gun gia' costruito e gia' testato, propone le ottimizzazioni
**col loro costo**, le applica una alla volta rimisurando e rilanciando la rete
E2E, e si rifiuta di consegnare se ha misurato una dev server, se la rete e'
rossa, se una soglia dichiarata non regge senza deroga scritta, o se una pagina
pubblica esce senza `title`, `description` e `canonical`.

## Collaudo del 2026-07-30 (banco `banco-prova-negozio`)

Verbale completo in `COSTRUZIONE-2026-07-30.md`. In sintesi, coi numeri misurati:

- [x] **Gate VERDE 7/7** sul banco, uscita `0`.
- [x] **Batteria E2E rilanciata dalla skill** e verde: 16 test su 16, contro la
      **build di produzione**, non contro `next dev`.
- [x] **Tre difetti SEO veri trovati** su un progetto dove Lighthouse dichiarava
      **SEO 100**: nessun `canonical`, lo stesso `<title>` su ogni rotta,
      `/admin/*` senza `noindex`.
- [x] **Sabotaggio**: gate puntato sulla dev server → **ROSSO** su
      `build-produzione`, con i due indizi stampati, e i passi a valle
      **MANCANTI** invece che verdi.
- [x] **Quattro difetti della skill trovati durante il collaudo**, tutti
      misurati prima di essere corretti, tutti con un test di regressione.

## Cosa esiste, misurato

| Cosa | Numero | Come e' stato misurato |
|---|---|---|
| Passi del gate | 7 | `verify.mjs --json`, `summary.passi` |
| Test degli script | **42 verdi** | `node --test "scripts/**/*.test.mjs"` |
| References | 3 | `misurazione.md` · `ottimizzazioni.md` · `seo.md` |
| Template | 2 | `performance.md` (il contratto) · `handoff-speed-demon.md` |
| Banchi su cui il gate e' girato | 1 | `banco-prova-negozio/` (2 pagine, 3 giri, gate 7/7) |
| Difetti dell'app trovati | 3 (SEO), tutti corretti | handoff 15 §2 |
| Difetti della skill trovati dal collaudo | **4**, corretti | §Punti aperti e verbale |

## I quattro difetti che il collaudo ha trovato nella skill

Vale la pena elencarli qui e non solo nel verbale, perche' tre su quattro erano
**falsi verdi o diagnosi bugiarde**, cioe' la classe che questa casa insegue.

1. **Il gate diceva `pass` su una dev server.** Gli indizi cercati erano quelli
   ovvi (`react-refresh`, `/_next/static/development/`) e la dev server, dopo
   qualche ricompilazione, aveva smesso di servirli. Trovato **solo** puntando
   il gate dove non doveva andare. Chiuso con due indizi **strutturali** —
   il `?v=<timestamp>` sui chunk e `app-pages-internals` — misurati sullo stesso
   progetto servito nei due modi nello stesso momento.
2. **«Nessun giro riuscito» su una macchina dove Lighthouse gira benissimo.**
   Due cause in fila: la prima riga di `where npx` e' lo script senza estensione
   che Windows non sa eseguire, e un argomento con spazi (`--chrome-flags` con
   tre opzioni) non sopravvive a `cmd /c`. Il guasto andava nella direzione
   sicura (MANCANTE), la diagnosi no: incolpava Lighthouse.
3. **Una GET caduta diventava «manca il metatag».** Subito dopo sei giri di
   Lighthouse una lettura HTTP puo' fallire una volta sola; il passo `seo-meta`
   ne ricavava un `block` sui tag di una pagina che li aveva. Chiuso con un
   secondo tentativo **e** riclassificando «non letto» come **MANCANTE**, che e'
   cio' che e': una verifica non fatta, non una verifica fallita.
4. **Due test miei scritti male**, trovati facendoli girare: un'asserzione senza
   senso e una che pretendeva il contrario di cio' che il codice fa giustamente.

## Punti aperti — ordinati per gravita'

1. **Un solo banco, e l'ho scritto io.** Vale per Speed Demon oggi cio' che
   valeva per Flow Sentinel dopo P1: la skill e' stata collaudata sulla stessa
   app da chi scriveva le sue regole. Manca il collaudo avversario indipendente
   (il P2 degli altri agenti) e manca un progetto con una pagina davvero lenta:
   **qui non c'era niente da ottimizzare**, quindi `plan` e `tune` non sono mai
   stati messi alla prova su un guadagno vero.
2. **Nessun passo verifica che le pagine escluse siano davvero escluse.** Il
   contratto dichiara `/admin/*` fuori misura e fuori indice, e il gate legge la
   dichiarazione senza controllarla. Sul banco e' stato verificato a mano, e a
   mano si e' scoperto che il `noindex` di `/admin` **non arriva a nessun
   crawler** perche' la guardia reindirizza prima: una riga che dice una cosa e
   ne fa un'altra, tenuta come difesa in profondita' e documentata come tale.
3. **`--giri 3` e' il minimo, e su una macchina occupata puo' non bastare.** La
   soglia di dispersione (10 punti) e' un valore scelto, non misurato su una
   popolazione di macchine: sul banco la dispersione e' stata **zero** su tutte
   le categorie, quindi la regola non e' mai stata messa alla prova sul campo.
   Il suo test esiste, la sua taratura no.
4. **`best-practices` si ferma a 96 e nessuno sa perche'.** Non e' stato
   indagato: su `http://127.0.0.1` alcune verifiche di quella categoria non
   sono applicabili come su HTTPS. Va ripreso al primo dominio vero.
5. **Nessun passo su `sitemap.ts` e `robots.ts`.** Il gate controlla i metatag
   di pagina e ignora i due file che dicono a un motore di ricerca cosa esiste.
6. **`code-inquisition` non e' mai stato lanciato sugli script di questa skill**,
   e `semgrep`/`gitleaks` non sono installati: MANCANTI, non PASS.
7. **Nessuna misura di campo.** Lighthouse e' un laboratorio. CrUX e RUM sono
   un'altra cosa e questa skill non li guarda: e' scritto in §Cosa un gate verde
   NON prova, ma resta un buco fra cio' che si misura e cio' che gli utenti
   vivono.
