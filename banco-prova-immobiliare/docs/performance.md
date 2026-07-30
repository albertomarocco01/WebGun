# Performance e SEO — Case di Langa

Contratto della misura: **quali pagine contano**, **quale punteggio devono
reggere**, **con quale metodo** sono state misurate e **chi l'ha deciso**.

Confermato da: Alberto Marocco (sviluppatore, collaudo avversario) (2026-07-30)

## Metodo

Metodo: build di produzione · 3 giri · mediana · profilo desktop
URL misurato: http://127.0.0.1:3200
Comando: npm run build && npx next start -p 3200
Strumento: lighthouse 13.4.1 su Chrome della macchina · Node 24.14.0
Dispersione massima ammessa: 5 punti di categoria
Misurato il: 2026-07-30 — portatile dello sviluppo, Docker fermo, il portfolio
personale acceso sulla 3000 e nient'altro di pesante

Questo contratto e' scritto nella forma del template
`agenti/speed-demon/resources/templates/performance.md`. Fino al 2026-07-30
quella forma **non era leggibile dal gate**: la prima stesura di questo file ha
prodotto cinque `block` che parlavano del sito quando il difetto stava nella
punteggiatura. L'esecuzione e' conservata in
`docs/collaudo/giro-A-contratto-forma-template.txt`, e le correzioni sono nel
verbale `agenti/speed-demon/COLLAUDO-AVVERSARIO-2026-07-30.md`.

**Desktop e mobile non sono due viste della stessa misura.** Misurato su questa
home, stessa build: desktop `performance 77 · LCP 5 496 ms · TBT 0 ms`, mobile
`performance 63 · LCP 33 474 ms · TBT 478 ms`. Il difetto del componente client
di questo banco **in desktop non esiste**: e' il motivo per cui il profilo si
dichiara qui e non lo sceglie chi lancia il comando. Chi portera' questo sito in
produzione rimisura in mobile, che e' il profilo che conta per l'indicizzazione,
e riscrive queste tabelle.

## `home` — /

**Perche' conta:** e' dove arriva chi cerca «casa in Langa» ed e' l'unica pagina
con la fotografia grande sopra la piega. Lenta qui significa persa prima di aver
visto un immobile.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 85 | 77 | ±1 | 100 |
| `accessibility` | >= 95 | 100 | ±0 | 100 |
| `best-practices` | >= 95 | 96 | ±0 | 100 |
| `seo` | >= 100 | 100 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP 5 496 ms → 746 ms · TBT 0 ms → 0 ms ·
CLS 0,000 → 0,000 · FCP 216 ms → 226 ms · peso totale 6,31 MB → 0,47 MB

## `immobili` — /immobili

**Perche' conta:** e' la pagina che vende. Tre schede con fotografia a piena
larghezza: e' dove il peso delle immagini si somma.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 80 | 75 | ±8 | 100 |
| `accessibility` | >= 95 | 100 | ±0 | 100 |
| `best-practices` | >= 95 | 96 | ±0 | 96 |
| `seo` | >= 100 | 92 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP 13 543 ms → 582 ms · TBT 4 ms → 4 ms ·
CLS 0,000 → 0,000 · FCP 220 ms → 228 ms · peso totale 15,25 MB → 0,43 MB

`best-practices` resta a **96** su questa pagina sola, e la causa e' misurata:
le tre schede linkano `/immobili/<slug>`, che **non esiste ancora**, e il
prefetch dei `<Link>` dell'App Router va a prendersele in anticipo. Tre richieste
RSC, tre `404`, tre righe nella console del browser, audit `errors-in-console`
fallito. Non e' il prefetch a essere sbagliato: e' la lista che rimanda a pagine
che non ci sono, e il prefetch l'ha solo scoperto prima di un visitatore.
Rientra a 100 quando la rotta di dettaglio esistera'. **Difetto
dell'applicazione, non della misura**: sta nell'handoff §4 e lo chiude chi
costruisce, non chi ottimizza.

La baseline di `performance` era **inutilizzabile**, non bassa: dispersione 8
punti su una soglia dichiarata di 5. Dopo `next/image` la dispersione e' scesa a
±0. Non era la macchina a ballare: era la pagina, e quindici megabyte non
arrivano due volte nello stesso tempo. La soglia di dispersione non protegge
solo da una macchina occupata — segnala anche una pagina abbastanza pesante da
non riprodursi.

## `agenzia` — /agenzia

**Perche' conta:** la legge chi arriva da una ricerca sul nome prima di
telefonare, ed e' l'unica che porta il numero di telefono nel corpo.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 90 | 100 | ±0 | 100 |
| `accessibility` | >= 95 | 95 | ±0 | 100 |
| `best-practices` | >= 95 | 96 | ±0 | 100 |
| `seo` | >= 100 | 91 | ±0 | 100 |

**Metriche di laboratorio (mediana):** LCP — → 451 ms · TBT — → 0 ms · CLS — →
0,000 · FCP — → 222 ms · peso totale — → 0,13 MB

Le metriche di laboratorio della baseline non sono state prese separatamente su
questa pagina: la baseline e' quella del gate
(`docs/collaudo/giro-B-prima-delle-correzioni.txt`), che riporta i punteggi e non
le metriche. Si scrive `—` invece di un numero plausibile.

## Deroghe

| Pagina | Categoria | Soglia | Misurato | Motivo scritto | Confermata da |
|---|---|---|---|---|---|

Nessuna deroga.

La prima stesura di questo contratto ne portava una su `immobili · performance`
(«le fotografie sono i file originali dei proprietari»). E' stata tolta perche'
non copre piu' niente: dopo `next/image` la pagina sta a 100, e una
giustificazione che non giustifica piu' e' peggio di nessuna giustificazione —
fra sei mesi qualcuno la leggerebbe come vera. Dal 2026-07-30 il passo `budget`
lo dice da solo, con un `warn`.

## Pagine escluse dalla misura

- `/riservata` — **rimanda a `/contatti`** con un 307: non e' un documento, e
  misurarla significa misurare `/contatti` credendo di misurare lei. Era
  dichiarata come pagina nella prima stesura, e ha prodotto `performance 100 ·
  seo 100` scritti accanto al nome sbagliato
  (`docs/collaudo/giro-B-prima-delle-correzioni.txt`). Rientra il giorno in cui
  l'area riservata ai proprietari mandanti esistera' davvero: l'indirizzo e' gia'
  nelle lettere d'incarico.
- `/contatti` — tre righe di testo, nessuna immagine, nessun componente client.
  Rientra il giorno in cui ospitera' il modulo di richiesta visita.
- `/immobili/[slug]` — rotta di dettaglio non ancora costruita. Rientra alla
  prima scheda vera, e allora si misura **l'istanza con la galleria piu'
  pesante**, non una a caso.

## Cosa questo contratto NON prova

**Che le pagine elencate siano quelle giuste.** Qui non c'e' un committente:
c'e' uno sviluppatore che collauda un agente. La firma dice chi ha deciso la
lista, non che la lista sia quella che vende.

**Che il sito sia veloce per gli utenti.** Lighthouse e' un laboratorio: una
macchina, una rete emulata, una cache fredda. Nessun dato di campo e' stato
guardato.

**Che le ottimizzazioni reggano al contenuto vero.** Tre immobili, non
trecento. La griglia di `/immobili` vola con tre schede; con trecento cambia
tutto, e nessun numero preso qui lo dice.

**Che il sito non si sia rotto.** Questo banco **non ha una batteria E2E**, e il
passo `rete-verde` del gate e' MANCANTE. Le ottimizzazioni qui sopra sono state
applicate senza rete sotto, cioe' nella condizione che la seconda legge della
SKILL vieta. E' una scelta dichiarata in `docs/PROGETTO.md` e vale solo perche'
questo e' un banco: su un progetto vero sarebbe un rosso strutturale.
