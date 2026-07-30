# Performance — Bottega Nord

Contratto della misura: quali pagine contano, con quale metodo si misurano e
quale soglia devono reggere. Il passo `budget` del gate e' rosso se una soglia
non e' raggiunta e non c'e' una deroga scritta qui sotto.

Confermato da: ORCHESTRATORE (2026-07-30)
Form factor: desktop

> Modalita' **pipeline**: conferma l'orchestratore, non l'umano. Nessuna delle
> ottimizzazioni previste cambia cosa si vede o toglie contenuto ai motori di
> ricerca — sono metatag e attributi — quindi non scatta la risalita all'umano
> prevista dalla SKILL. **L'elenco delle pagine resta un elenco assunto**: che
> siano quelle giuste lo puo' dire solo chi vende, e non e' automatizzabile.

## Metodo

- **Build di produzione**: `npm run build && npx next start -p 3100`. Mai
  `next dev` — il gate lo rifiuta, e il passo `build-produzione` lo riconosce
  dagli indizi che una build di produzione non puo' produrre.
- **Tre giri** per pagina, **mediana** dei punteggi, **dispersione** dichiarata.
  Un giro solo non e' una misura: la variazione fra due giri identici puo'
  coprire da sola il guadagno di mezza ottimizzazione.
- **Desktop**, non mobile: questo banco gira su una macchina di sviluppo e la
  misura serve a confrontare *prima* e *dopo* sullo stesso metro, non a
  prevedere un telefono vero. Chi porta questo progetto in produzione rimisura
  in `mobile`, che e' il default di Lighthouse ed e' quello che conta per
  l'indicizzazione.
- **Dati di seed**: dieci prodotti, non diecimila. Cio' che vola qui puo'
  crollare col catalogo vero, e nessun numero preso qui lo dice.

## `home` — /

Perche' conta: e' **l'unica pagina pubblica che vende**. Bottega Nord non ha
vetrina ne' carrello — Gestionale Crafter ha costruito il backoffice — quindi
tutto cio' che un visitatore e un motore di ricerca vedono di questo sito e'
questa pagina.

| categoria | soglia |
|---|---|
| performance | 95 |
| accessibility | 100 |
| best-practices | 95 |
| seo | 100 |

## `accesso` — /accedi

Perche' conta: e' la porta del gestionale, la usa il personale ogni mattina, ed
e' l'unica altra rotta pubblica. Una porta lenta si paga ogni giorno.

| categoria | soglia |
|---|---|
| performance | 95 |
| accessibility | 100 |
| best-practices | 95 |
| seo | 90 |

## Deroghe

Una soglia non raggiunta senza una riga qui sotto e' un `block` del gate. Il
motivo dev'essere scritto **prima** della misura, non trovato dopo.

| pagina | categoria | motivo |
|---|---|---|
| `accesso` | seo | La pagina di accesso non deve vendere niente: le si chiede di essere raggiungibile e leggibile, non di posizionarsi. La soglia e' piu' bassa di proposito, e se un giorno portasse un `noindex` sarebbe corretto, non un difetto. |

## Pagine escluse dalla misura

| Pagina | Perche' non si misura |
|---|---|
| `/admin` e tutto `/admin/*` | Sono dietro autenticazione: Lighthouse arriverebbe alla pagina di accesso e misurerebbe quella, due volte. Misurarle richiederebbe una sessione dentro il browser di Lighthouse, e il numero che ne uscirebbe non e' confrontabile con gli altri. **Sono pero' un problema SEO**, e quello si risolve lo stesso: vanno tolte dall'indice, e la loro esclusione e' verificata a mano finche' non esiste un passo di gate che la controlli. |
| `/admin/prodotti/[id]` | Rotta dinamica: la pagina cambia col contenuto e non ha un indirizzo stabile da misurare. Vale l'esclusione di sopra. |
