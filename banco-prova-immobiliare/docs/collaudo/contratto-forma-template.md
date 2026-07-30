# Performance e SEO — Case di Langa

Contratto della misura: **quali pagine contano**, **quale punteggio devono
reggere**, **con quale metodo** sono state misurate e **chi l'ha deciso**.

Confermato da: Alberto Marocco (sviluppatore, collaudo avversario) (2026-07-30)

## Metodo

Metodo: build di produzione · 3 giri · mediana · profilo desktop
URL misurato: http://127.0.0.1:3200
Comando: npm run build && npx next start -p 3200
Strumento: lighthouse 13.4.1 su Chrome installato dalla macchina
Dispersione massima ammessa: 5 punti di categoria
Misurato il: 2026-07-30 — portatile dello sviluppo, con Docker fermo e il
portfolio personale acceso sulla 3000

## `home` — /

**Perche' conta:** e' dove arriva chi cerca «casa in Langa» e l'unica pagina con
la fotografia grande sopra la piega. Se e' lenta qui, la sessione finisce prima
di aver visto un immobile.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 85 | — | — | — |
| `accessibility` | >= 95 | — | — | — |
| `best-practices` | >= 95 | — | — | — |
| `seo` | >= 100 | — | — | — |

## `immobili` — /immobili

**Perche' conta:** e' la pagina che vende. Tre schede con fotografia a piena
larghezza: e' dove il peso delle immagini si somma.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 80 | — | — | — |
| `accessibility` | >= 95 | — | — | — |
| `best-practices` | >= 95 | — | — | — |
| `seo` | >= 100 | — | — | — |

## `agenzia` — /agenzia

**Perche' conta:** e' la pagina che chi arriva da una ricerca sul nome legge
prima di telefonare, ed e' l'unica che porta il numero di telefono nel corpo.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 90 | — | — | — |
| `accessibility` | >= 95 | — | — | — |
| `best-practices` | >= 95 | — | — | — |
| `seo` | >= 100 | — | — | — |

## `riservata` — /riservata

**Perche' conta:** e' l'area riservata ai proprietari mandanti, linkata dalle
lettere d'incarico. Oggi rimanda ai contatti perche' non e' ancora stata
costruita, e resta dichiarata qui perche' l'indirizzo e' gia' in circolazione.
**Tipo:** pubblica

| Categoria | Soglia | Baseline (mediana di 3) | Dispersione | Misura finale |
|---|---|---|---|---|
| `performance` | >= 90 | — | — | — |
| `accessibility` | >= 95 | — | — | — |
| `best-practices` | >= 95 | — | — | — |
| `seo` | >= 100 | — | — | — |

## Deroghe

| Pagina | Categoria | Soglia | Misurato | Motivo scritto | Confermata da |
|---|---|---|---|---|---|
| `immobili` | `performance` | >= 80 | — | Le tre fotografie sono i file originali dei proprietari e il mandante ha chiesto per iscritto di non ritagliarle. Arrivare alla soglia senza ricomprimerle richiederebbe di mostrarne una sola sopra la piega: cambia cosa si vede. Rivedibile quando arriveranno gli scatti del fotografo, previsti per settembre. | Alberto Marocco (sviluppatore) (2026-07-30) |

## Pagine escluse dalla misura

- `/contatti` — tre righe di testo, nessuna immagine, nessun componente client.
  Rientra il giorno in cui ospitera' il modulo di richiesta visita, che e' in
  ROADMAP.
- `/immobili/[slug]` — rotta di dettaglio non ancora costruita.

## Cosa questo contratto NON prova

Che le pagine elencate siano quelle giuste: qui non c'e' un committente, c'e'
uno sviluppatore che collauda un agente. La firma dice chi ha deciso la lista,
non che la lista sia quella che vende.
