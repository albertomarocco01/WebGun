# Collaudo di `evolve` — l'ultimo comando che nessuno aveva mai eseguito

> Data: 2026-07-30, sera. Banco: `banco-prova-negozio` (Bottega Nord), lo stesso
> di P3, con l'app risanata dai cinque difetti dell'handoff 12.
>
> Punto aperto n°1 di `STATO.md`: *«`evolve` non e' mai stato collaudato. Dopo
> P3 e' il punto piu' grave: e' l'unico comando della skill che nessuno ha mai
> eseguito.»* Questo verbale lo chiude.

## 0. Esito in una riga

Il **gate** fa esattamente cio' che la reference promette — **5 casi su 5
combaciano**, e il caso del `warn` e' stato verificato anche end-to-end
(uscita **0**, gate **VERDE**, avviso stampato). La **procedura** no: la riga di
`SKILL.md` che descrive `evolve` copriva **un caso su quattro**, e il quarto
caso — quello piu' probabile nella vita vera — **il gate non lo puo' vedere**.

## 1. Come e' stato collaudato

Non su un banco inventato: sui **file veri** di Bottega Nord — undici flussi,
undici spec — mutati uno alla volta e dati in pasto alle **funzioni vere** del
gate (`leggiFlussi`, `findingsCopertura`, `contaGravita`, `statoDaFindings`).
Il caso piu' delicato e' stato poi rifatto **sul processo intero**, perche' «il
`warn` non blocca» e' un'affermazione sull'uscita di `verify.mjs`, non su una
funzione pura.

## 2. I cinque casi, misurati

| Caso | Cosa e' stato mutato | Atteso dalla reference | Misurato |
|---|---|---|---|
| riferimento | niente | `pass`, 0 block, 0 warn | **combacia** |
| A — flusso nuovo | aggiunto `svuota-magazzino` al contratto, nessuna spec | `block` di copertura | **combacia** (1 block) |
| B — flusso sparito | tolto `modifica-cliente` dal contratto, spec lasciata | `warn`, **non** block | **combacia** (1 warn, `pass`) |
| C — id rinominato | `modifica-cliente` → `correzione-recapito-cliente` solo nel contratto | warn **e** block insieme | **combacia** (1+1, `fail`) |
| D — corpo cambiato | stesso id, passi ed effetto atteso stravolti | *(non elencato)* | **verde, nessun rilievo** |

### 2.1 Il caso B, sul processo intero

```
$ node ../agenti/flow-sentinel/scripts/verify.mjs --url http://127.0.0.1:3001
GATE FLUSSI: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    copertura dei flussi (una spec per flusso)
        10 flussi · 11 file di spec
        [warn] e2e/modifica-cliente.spec.ts: etichetta `@flusso:modifica-cliente`
               senza flusso dichiarato in docs/flussi-critici.md
USCITA DEL GATE: 0
```

E' il comportamento giusto e vale la pena dire perche': un `block` qui
premierebbe chi cancella la spec invece di chiedere. La spec c'e' ed e' lavoro
fatto; decidere che un flusso non e' piu' critico spetta a chi ha firmato
l'elenco, non all'agente che sta riallineando i file.

### 2.2 Il caso C e' l'unico con due gravita' insieme

Non aveva un test. Ora ce l'ha, ed e' il motivo per cui **una rinomina si fa in
un giro solo**: chiudere solo il `block` (scrivendo la spec nuova) lascia il
`warn`; chiudere solo il `warn` (togliendo l'etichetta vecchia) lascia il
`block`.

## 3. Il difetto: il caso piu' probabile e' quello cieco

`leggiFlussi` legge le **intestazioni**. I passi e l'effetto atteso sono prosa,
e il gate non li guarda — cosa che la reference dichiara apertamente per il
contratto in generale. La conseguenza sul caso D non era pero' scritta da
nessuna parte, ed e' questa:

> un contratto in cui i passi di un flusso descrivono un percorso che la spec
> **non fa piu'** resta **verde**.

E' il caso piu' frequente nella vita di un progetto: una feature cambia, il
percorso cambia, e **nessuno rinomina l'id** — non c'e' motivo di farlo. Gli
altri tre casi lasciano una traccia strutturale (un id in piu', uno in meno, uno
diverso); questo no.

Non e' correggibile dentro il gate senza reinventare la comprensione del testo,
e infatti **non e' stato corretto**. E' stato fatto due volte esplicito:

1. un **test di regressione che fissa il limite** invece di un limite implicito
   — chi legge la suite trova scritto che il gate non vede quel caso, e non lo
   assume;
2. una riga nella procedura: nel caso D **la difesa e' l'agente**, che confronta
   la prosa e non gli id, e un flusso i cui passi non descrivono piu' la spec va
   **riconfermato**, non corretto di nascosto.

## 4. Il difetto della skill: la procedura copriva un caso su quattro

`SKILL.md` §Comando → procedura descriveva `evolve` cosi':

> *«confronto rotte e handoff nuovi con `docs/flussi-critici.md`: flussi nuovi →
> Specchio solo su quelli; flussi spariti → la spec diventa orfana e lo
> segnalo»*

Mancavano: **la rinomina** (l'unico caso a due gravita'), **il corpo cambiato**
(il caso cieco), **le due uscite oneste dal `warn`**, e **il controllo della
data** — che la reference indica come l'unica ragione per cui la riga
`Confermato da:` porta una data, e che la procedura non nominava affatto.

Riscritta. **E' la prima modifica a `SKILL.md` dopo P0**: era rimasta intatta
attraverso P1, P2 e P3, e ci e' voluto l'unico comando mai eseguito per trovarci
un buco. Un documento non cambia finche' nessuno prova a seguirlo.

## 5. Il difetto di esecuzione, mio

Poche ore prima, chiudendo i difetti dell'handoff 12, ho aggiunto l'undicesimo
flusso (`modifica-cliente`) a un contratto **gia' firmato**, senza rifare lo
Specchio su quel flusso e senza registrare la seconda conferma. Cioe' ho fatto
un `evolve` senza chiamarlo cosi', e ne ho saltato il passo che lo distingue da
una modifica qualsiasi.

Il gate non se n'e' accorto, e non poteva: `Confermato da:` c'era, la data era
di oggi, la copertura era piena. **Nessun controllo automatico distingue un
elenco confermato da un elenco confermato piu' una riga aggiunta dopo.**

Sanato scrivendo la seconda conferma nel contratto, con quali flussi copre e
quali no.

## 6. Numeri

| Cosa | Numero |
|---|---|
| Casi di `evolve` collaudati | **5** (riferimento + 4), tutti sui file veri del banco |
| Casi che combaciano con la reference | **5 su 5** |
| Casi verificati anche end-to-end sul processo | 1 (il `warn` che non deve bloccare) |
| Test di regressione aggiunti | **2** (rinomina a due gravita'; il limite del corpo cambiato) |
| Test degli script | **108 verdi** (106 + 2) |
| Difetti trovati | **3**: procedura incompleta nella SKILL · caso cieco non dichiarato · violazione di procedura mia |
| Difetti del gate trovati | **0** — e' l'unica parte che ha retto senza correzioni |

## 7. Cosa resta aperto

- Il **caso D resta cieco** per costruzione. La difesa e' dichiarata, non
  automatizzata.
- Il **controllo della data** e' adesso nella procedura, ma nessuno script lo
  esegue: `evolve` non e' uno script, e la data la confronta chi legge. Un passo
  di gate che confrontasse la data della firma con l'ultimo `git log` di
  `src/app/**/page.tsx` chiuderebbe la classe, e non e' stato scritto qui perche'
  richiede di decidere cosa fare in un progetto senza git.
