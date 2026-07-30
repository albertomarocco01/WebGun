# Performance e SEO — Case di Langa

Contratto della misura: quali pagine contano, quale punteggio devono reggere,
con quale metodo sono state misurate e chi l'ha deciso.

> **Perche' questo file non ha la forma del template.** La prima stesura seguiva
> `agenti/speed-demon/resources/templates/performance.md` alla lettera, e il
> passo `contratto-performance` l'ha bocciata: nessuna soglia letta, nessuna
> deroga letta, firma rifiutata, profilo desktop ignorato. Il verbale
> `agenti/speed-demon/COLLAUDO-2026-07-30.md` §2 riporta l'esecuzione. Questa
> seconda stesura e' scritta nella forma che il gate legge davvero, per poter
> proseguire il collaudo sui passi a valle: le soglie sono le stesse, decise
> prima di misurare.

Confermato da: UMANO — Alberto Marocco (sviluppatore, collaudo avversario) (2026-07-30)
Form factor: desktop

## Metodo

- **Build di produzione**: `npm run build && npx next start -p 3200`. Porta 3200
  perche' la 3000 e' il portfolio della macchina e la 3001/3100 sono di
  `banco-prova-negozio`.
- **Tre giri** per pagina, **mediana**, **dispersione** dichiarata.
- **Desktop**: questa e' una macchina di sviluppo e la misura serve a confrontare
  prima e dopo sullo stesso metro.
- **Dispersione massima ammessa: 5 punti** — dichiarata qui come chiede il
  template. Il gate impone il suo 10 cablato e questa riga non la legge nessuno:
  e' il difetto n°5 del verbale.

## `home` — /

Perche' conta: e' dove arriva chi cerca «casa in Langa», e l'unica pagina con la
fotografia grande sopra la piega.

| categoria | soglia |
|---|---|
| performance | 85 |
| accessibility | 95 |
| best-practices | 95 |
| seo | 100 |

## `immobili` — /immobili

Perche' conta: e' la pagina che vende. Tre schede con fotografia a piena
larghezza: e' dove il peso delle immagini si somma.

| categoria | soglia |
|---|---|
| performance | 80 |
| accessibility | 95 |
| best-practices | 95 |
| seo | 100 |

## `agenzia` — /agenzia

Perche' conta: la legge chi arriva da una ricerca sul nome prima di telefonare,
ed e' l'unica che porta il numero di telefono nel corpo.

| categoria | soglia |
|---|---|
| performance | 90 |
| accessibility | 95 |
| best-practices | 95 |
| seo | 100 |

## `riservata` — /riservata

Perche' conta: e' l'area riservata ai proprietari mandanti, il cui indirizzo e'
gia' nelle lettere d'incarico. Oggi rimanda ai contatti.

| categoria | soglia |
|---|---|
| performance | 90 |
| accessibility | 95 |
| best-practices | 95 |
| seo | 100 |

## Deroghe

| pagina | categoria | motivo |
|---|---|---|
| `immobili` | performance | Le tre fotografie sono i file originali dei proprietari e il mandante ha chiesto per iscritto di non ritagliarle. Arrivare alla soglia senza ricomprimerle richiederebbe di mostrarne una sola sopra la piega: cambia cosa si vede. Rivedibile quando arriveranno gli scatti del fotografo, previsti per settembre. |

## Pagine escluse dalla misura

| Pagina | Perche' non si misura |
|---|---|
| `/contatti` | Tre righe di testo, nessuna immagine, nessun componente client. Rientra il giorno in cui ospitera' il modulo di richiesta visita. |
| `/immobili/[slug]` | Rotta di dettaglio non ancora costruita. |
