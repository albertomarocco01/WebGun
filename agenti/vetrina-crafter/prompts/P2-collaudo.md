# Mandato P.3 — Collaudo avversario di vetrina-crafter

> Emesso dal direttore dei lavori il 2026-08-04. Da incollare in una **chat vergine**:
> chi costruisce non collauda, e tu non hai costruito niente di questa skill.
> **Modello consigliato: Opus 5 · effort max.**
> Contabilità: `CANTIERE.md` (voci del 2026-08-04, decisione D8).

Sei il **collaudatore avversario** della skill `vetrina-crafter` (pipeline Web Gun,
repo di regia `WebGun`). Il tuo mestiere è **smentire il verbale di costruzione, non
confermarlo**: verifichi le affermazioni invece di ereditarle, cerchi i falsi verdi nei
dieci passi del gate, e ogni difetto lo **misuri prima** di correggerlo.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`; `CANTIERE.md` (voci del 2026-08-04, decisione **D8**).
2. Tutta `agenti/vetrina-crafter/`: `SKILL.md`, `STATO.md`,
   `references/verifica-deterministica.md` (§Modi in cui questo gate potrebbe essere
   verde: in P1 sono diventati test — **tu cerca quelli che non sono previsti**),
   `references/sabotaggio.md` (esiti compilati; le **sei classi cieche** dichiarate
   sono il tuo menu di partenza), `COSTRUZIONE-2026-08-03.md` — il verbale da mettere
   in dubbio, **§10 in particolare**: è l'elenco di ciò che la costruzione NON
   dimostra, scritto da chi costruiva.
3. Come modello del genere: `agenti/speed-demon/COLLAUDO-AVVERSARIO-2026-07-30.md`
   (17 difetti) e `agenti/flow-sentinel/COLLAUDO-2026-07-28.md` (10 difetti).

## Il tuo banco

Dominio **nuovo** (non: e-commerce, veterinario, accademia musicale, palestra,
immobiliare, scuola di musica), scelto per stressare ciò che il banco di costruzione
non stressava — il §10 del verbale ti dice dove:

- **il modulo pubblico**: il banco di P1 dichiarava «Nessuna scrittura pubblica»,
  quindi il caso di frontiera del §Perimetro non ha mai avuto una misura. Il tuo banco
  **deve** avere un percorso di scrittura aperto all'anonimo (modulo di contatto o
  prenotazione), con lo STOP e la firma che il contratto prescrive per quella tabella;
- **immagini vere**, non cinque JPEG da 1×1 pixel;
- **più pagine e più slot** — e il gate **cronometrato**, che non lo è mai stato;
- **slot con contenuti corti veri** (la soglia 24 su testi corti reali).

Schema **eseguendo schema-forge** (Flusso 1, coi privilegi espliciti post-P.8),
vetrina **col flusso vero della skill**. Porte tue: **non** 57321/57322 (vetcare),
**non** 57422 né 3140 (controtempo). Banco usa e getta, gitignorato.

## La caccia

Per ognuno dei dieci passi, tre domande: può dire **verde senza aver guardato**? può
dire **rosso su codice giusto**? può dare una **diagnosi che manda dalla parte
sbagliata**? Piste concrete che il verbale stesso lascia aperte:

- le **sei classi cieche** dichiarate (contratto che descrive un'altra pagina, bottone
  reimplementato a mano, `Nessuno slot.` falso, rotta `route.ts`, …): confermale — o
  trova che una in realtà si poteva vedere;
- le **euristiche mai stressate**: `puntaA` confronta code di percorso (provala dove
  può ingannarsi); i segnaposto cercati come stringhe (una pagina che **parla** di
  template: il falso positivo dichiarato in P0 e mai misurato);
- la **lezione PostgREST** del §6 del verbale: con la chiave anonima chiedi colonne
  che nessuna pagina seleziona — il contratto §Dati visibili a un anonimo e l'handoff
  §4 reggono a quel confronto?
- le **due trappole di Next** del §7 (Data Cache che sopravvive alla build, tipi di
  rotta come stato): il gate le diagnostica o ti manda dall'imputato sbagliato?
- il contratto compilato **attenendoti al template alla lettera** (il precedente:
  speed-demon bocciava il proprio template): le righe SINTASSI/PROSA marcate reggono
  tutte?
- sabotaggi **nuovi**, non solo quelli della reference: il rosso a comando è la metà
  facile — cerca il verde immeritato.

## Regole

- Ogni difetto **misurato prima e dopo**, un **test di regressione** ciascuno, un
  commit per difetto o blocco sensato.
- MANCANTE ≠ PASS; ogni premessa si prova prima di diventare regola; nessuna
  riscrittura della skill che non sia giustificata da una misura.
- Alla fine: **gate corretto rilanciato su `banco-prova-controtempo` senza
  regressioni** (lo stack db è acceso; l'app si riavvia con `npm run start -- -p 3140`
  dalla sua radice — la build e il suo `BUILD_ID` ci sono già).
- Batterie `node --test` con `~/scoop/apps/nodejs-lts/current/node.exe`; i gate col
  `node` di sistema.

## Coordinamento (D8 — in parallelo gira P.7c)

- **Non toccare**: `banco-prova-vetcare`, `agenti/schema-forge`,
  `agenti/gestionale-crafter`, `agenti/flow-sentinel`, `agenti/speed-demon`,
  `CANTIERE.md`, `prompts/`, `scripts/` di radice, `webgun_content.txt`.
- Committa **solo i tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.

## Verbale di chiusura

`agenti/vetrina-crafter/COLLAUDO-<data>.md` nello stile della casa: difetti numerati
con l'uscita **prima e dopo**, cosa NON è stato collaudato, il rilancio su controtempo
incollato; `STATO.md` aggiornato (punti aperti rivisti). In chat, la riga finale:
`P2 (collaudo avversario) consegnata. Difetti trovati: N, tutti misurati e con test.
Gate su controtempo dopo le correzioni: VERDE 10/10.` — o la verità, se è un'altra.
