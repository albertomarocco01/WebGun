# Handoff — Speed Demon

> Progetto: **Bottega Nord**. Data: 2026-07-30.
> **Primo consumatore reale della skill**, che e' nata oggi: Bottega Nord e' il
> banco su cui Speed Demon e' stato costruito e collaudato insieme.
>
> Leggere prima: `12-flow-sentinel.md`, `13-gestionale-crafter.md`,
> `14-flow-sentinel.md`.

## 1. Cosa ho fatto

- `docs/performance.md` — il contratto: **due pagine pubbliche** (`/` e
  `/accedi`) con le loro soglie per le quattro categorie di Lighthouse, il
  **metodo** (build di produzione, tre giri, mediana, desktop), una deroga
  scritta e l'elenco delle **pagine escluse** con il perche'.
- **Metadati SEO**, che e' l'unica cosa che questo sito aveva davvero da
  guadagnare (vedi §2): `metadataBase` + `title.template` + `canonical` nel
  layout radice, metadati propri su `/accedi`, `robots: noindex` sul layout di
  `/admin`.
- Rimisurato tutto e **rilanciata la batteria E2E** dopo la modifica, contro la
  build di produzione: **16 test su 16 verdi**.

**Comando per rilanciare il gate** (la build dev'essere accesa):

```
npm run build && npx next start -p 3100
node ../agenti/speed-demon/scripts/verify.mjs --url http://127.0.0.1:3100
```

## 2. Esito: il sito era gia' veloce, e non era quello il problema

| Pagina | categoria | prima | dopo | delta |
|---|---|---|---|---|
| `home` (`/`) | performance | 100 ±0 | 100 ±0 | — |
| | accessibility | 100 ±0 | 100 ±0 | — |
| | best-practices | 96 ±0 | 96 ±0 | — |
| | seo | **100** ±0 | **100** ±0 | — |
| `accesso` (`/accedi`) | performance | 100 ±0 | 100 ±0 | — |
| | accessibility | 100 ±0 | 100 ±0 | — |
| | best-practices | 96 ±0 | 96 ±0 | — |
| | seo | **100** ±0 | **100** ±0 | — |

Tre giri per pagina, mediana, dispersione **zero** su tutte le categorie: la
misura e' stabile, e non c'era niente da ottimizzare sul fronte della velocita'.
Il sito e' due pagine senza immagini, senza font esterni e con 103 kB di
JavaScript condiviso — **il caso in cui la risposta onesta e' «non toccare
niente»**, e ogni ottimizzazione applicata sarebbe stata un rischio pagato per
zero punti.

**Il risultato che conta e' un altro:** Lighthouse dichiarava **SEO 100** su due
pagine che

- non avevano **nessun `canonical`**,
- servivano **lo stesso identico `<title>`** — «Bottega Nord» — su ogni rotta del
  sito, gestionale compreso,
- lasciavano `/admin/*` senza `noindex`.

Il punteggio SEO di Lighthouse controlla che i tag esistano e siano leggibili,
non che **dicano cose diverse su pagine diverse**. Il passo `seo-meta` del gate,
che legge i tre tag nell'**HTML servito** e li pretende su ogni pagina
dichiarata, li ha trovati tutti e tre. Su questo progetto, **il valore di Speed
Demon e' stato interamente in cio' che Lighthouse non guarda**.

## 3. Ottimizzazioni applicate, con il costo

| Ottimizzazione | Cosa tocca | Guadagno | **Costo** |
|---|---|---|---|
| `metadataBase` + `alternates.canonical` | `src/app/layout.tsx`, `src/app/accedi/page.tsx` | ogni pagina dichiara il proprio indirizzo canonico | **Il canonical diventa una cosa che DEVE essere giusta.** Prima non c'era e non poteva sbagliare; adesso, se `NEXT_PUBLIC_SITE_URL` non e' impostata in produzione, il sito dichiara come canonico `http://127.0.0.1:3000` e regala la propria autorita' a un indirizzo che non esiste. **Un canonical sbagliato e' peggio di un canonical assente.** Vedi §6. |
| `title.template` + `title` per pagina | come sopra | ogni pagina ha un titolo suo | i titoli si allungano di «— Bottega Nord»; su `/accedi` il titolo passa da 13 a 34 caratteri, ben dentro il limite di troncamento dei risultati di ricerca |
| `robots: { index: false }` sul layout `/admin` | `src/app/admin/layout.tsx` | il gestionale dichiara di non voler essere indicizzato | **nessuno, e nemmeno nessun beneficio oggi**: misurato, un crawler non riceve mai quel tag, perche' `richiediStaff()` reindirizza prima del rendering. Resta come difesa in profondita' per il giorno in cui una rotta sotto `/admin` diventasse pubblica per errore. Scritto nel codice per non farlo sembrare cio' che non e'. |

## 4. Ottimizzazioni proposte e NON applicate

| Proposta | Perche' no | Chi ha deciso |
|---|---|---|
| `next/image` e formati moderni | il sito non ha nemmeno un'immagine | orchestratore |
| `next/font` con `display: swap` | nessun font esterno: si usa lo stack di sistema | orchestratore |
| `dynamic()` sui moduli del gestionale | il gestionale non e' fra le pagine misurate, ed e' dietro autenticazione: guadagnerebbe punti che nessuno conta, al prezzo di rendere lazy dei moduli che le spec E2E attraversano | orchestratore |
| Ridurre i 103 kB di JS condiviso | e' il runtime di Next e React: toglierlo significa cambiare stack, non ottimizzare | orchestratore |
| `sitemap.ts` e `robots.ts` | **rimandati, non rifiutati**: con due pagine il guadagno e' teorico, ma vanno scritti prima di pubblicare su un dominio vero. Sta in `docs/DEBITO-TECNICO.md` | orchestratore |

## 5. Regressioni: nessuna

Batteria E2E rilanciata **dopo** la modifica e **contro la build di
produzione** (non contro `next dev`): **16 su 16 verdi**, zero al secondo
tentativo. `npm run lint` e `tsc --noEmit` puliti.

Un rischio c'era ed e' stato controllato: il `<title>` di `/accedi` e' cambiato,
e una spec che avesse asserito il titolo della pagina sarebbe diventata rossa.
Le spec asseriscono le **intestazioni di primo livello**, che non sono state
toccate.

## 6. Cosa si aspetta chi viene dopo

- **Cyber Shield**: `robots: noindex` su `/admin` e' igiene, **non una difesa** —
  la difesa e' `richiediStaff()`. Non contarlo fra i controlli d'accesso.
- **Launchpad**, e questa e' la riga piu' importante di tutto l'handoff:
  **`NEXT_PUBLIC_SITE_URL` va impostata sul dominio vero prima del deploy.**
  Senza, ogni pagina del sito pubblicato dichiara come canonico
  `http://127.0.0.1:3000`. Prima di oggi questa variabile non serviva a niente;
  da oggi e' la differenza fra un sito indicizzato e un sito che chiede di non
  esserlo. Verificalo sull'HTML servito dal dominio vero, non nel sorgente.
- **Chiunque rimisuri**: questo contratto dichiara `Form factor: desktop`, scelto
  per confrontare *prima* e *dopo* sullo stesso metro su una macchina di
  sviluppo. Per l'indicizzazione conta **mobile**, che e' il default di
  Lighthouse: chi porta il progetto in produzione rimisura in mobile e
  riscrive le soglie.

## 7. Residui del gate e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi).

| Gravita' | Cosa | Perche' resta |
|---|---|---|
| nota | `best-practices` si ferma a **96** su entrambe le pagine | la soglia dichiarata e' 95, quindi passa. Il punto mancante non e' stato indagato: su `http://127.0.0.1` alcune verifiche di questa categoria non sono applicabili come lo sarebbero su HTTPS, e inseguire un punto in laboratorio prima di conoscere il dominio vero e' lavoro sprecato |
| nota | misura in **desktop**, non mobile | vedi §6 |
| nota | dati di **seed**: dieci prodotti, non diecimila | cio' che vola qui puo' crollare col catalogo vero, e nessun numero preso qui lo dice |
| nota | `/admin/*` **non misurato** | e' dietro autenticazione: Lighthouse arriverebbe alla pagina di accesso e misurerebbe quella due volte. Dichiarato in `docs/performance.md` §Pagine escluse |
| nota | `sitemap.ts` e `robots.ts` assenti | rimandati, in `docs/DEBITO-TECNICO.md` |

Verifiche mancanti: nessuna.

**Cosa un gate verde NON dimostra**: `agenti/speed-demon/SKILL.md` §Cosa un gate
verde NON prova. In breve, e misurato qui: non dimostra che il sito sia veloce
per gli utenti — Lighthouse misura un laboratorio — e non dimostra che le due
pagine dichiarate siano quelle giuste. Che siano le uniche pubbliche lo dice la
struttura di `src/app`; che siano quelle che contano lo direbbe solo chi vende.
