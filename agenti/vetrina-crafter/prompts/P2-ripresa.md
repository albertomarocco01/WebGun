# Mandato P.3-ripresa — La caccia riprende da metà, e stavolta lascia il verbale

> Emesso dal direttore dei lavori il 2026-08-04 (direzione subentrata in giornata).
> Da incollare in una **chat vergine**: chi costruisce non collauda, e la chat che
> ha iniziato questa caccia è morta senza verbale.
> **Modello consigliato: Opus 5 · effort max.**
> Contabilità: `CANTIERE.md` (riga P.3, decisione D8, giornale del 2026-08-04).

Sei il **collaudatore avversario** della skill `vetrina-crafter` (pipeline Web Gun,
repo di regia `WebGun`). Riprendi un collaudo interrotto a metà: la chat precedente
ha trovato **sei difetti veri**, li ha corretti e committati — e poi è morta senza
scrivere il verbale, senza aggiornare `STATO.md` e con metà caccia da fare. Le sue
misure vivono nei messaggi di tre commit; il tuo lavoro è finire la caccia e
lasciare il documento che l'interruzione ha negato.

## La regola che questa ripresa aggiunge al mandato originale

Il 2026-08-04 due chat operaie su tre sono morte prima del verbale. Quindi:

- **un commit per difetto o per blocco sensato**, appena la misura è fatta — mai
  lavoro accumulato in working tree;
- **il verbale si scrive man mano, non in coda**: apri
  `agenti/vetrina-crafter/COLLAUDO-<data>.md` come **primo atto**, ricopiaci subito
  i sei difetti già committati (le misure sono nei messaggi di commit), e ogni
  difetto nuovo entra nel file nel momento in cui è misurato. Un'interruzione deve
  lasciare misure, non ricordi.

## Leggi prima, in quest'ordine

1. **`agenti/vetrina-crafter/prompts/P2-collaudo.md` — il mandato originale.
   Resta la legge di questo pacchetto**: piste, regole, coordinamento, verbale.
   Questo file lo integra solo dove lo stato di fatto è cambiato.
2. `CANTIERE.md`: riga **P.3** e giornale del 2026-08-04 (sera).
3. `git show -s d9c62b2 47ceb20 a315c78` — la prima metà della caccia, scritta
   da chi l'ha fatta, con le misure prima/dopo.
4. Il resto nell'ordine del mandato originale (SKILL, STATO, references —
   `sabotaggio.md` con le sei classi cieche — verbale di costruzione §10, i due
   verbali modello di speed-demon e flow-sentinel).

## Lo stato che ricevi (rilanciato dal direttore, non ereditato)

- **Il banco esiste: non lo creare.** `banco-prova-valscura/` — rifugio alpino,
  9 pagine, 13 slot, immagini vere, modulo pubblico `richieste_prenotazione` — è
  su disco alla radice del repo, gitignorato, con lo stack acceso: kong **57521**,
  db **57522**, studio 57523. Prima di misurare, accerta lo stato dei sabotaggi
  della prima metà (l'ultimo commit ne piantava per misurare): il banco torna in
  uno stato dichiarato prima che i tuoi numeri contino.
- **Sei difetti già chiusi, tre commit**: i tre `block` falsi del frammento
  distintivo (`to_jsonb(t)` candidava la chiave dello slot e il percorso di una
  foto; il testo alternativo invece non doveva sparire), la diagnosi sotto-soglia
  senza il numero della manopola, il percorso di scrittura pubblico che nessuno
  dei dieci passi leggeva (ora misurato impersonando `anon`), la regola delle
  zero righe morta da P1 (`SET0` → `NaN`), più la diagnosi delle fonti separata
  in quattro esiti.
- **Batteria a 144** (il direttore l'ha rilanciata: 144/144, Node 24). **Gate
  corretto già rilanciato dal direttore su `banco-prova-controtempo`: VERDE
  10/10, uscita 0** — la non-regressione della prima metà è a posto.

## Cosa resta da cacciare (le piste aperte del mandato originale)

1. le **sei classi cieche** di `references/sabotaggio.md`: confermale — o trova
   che una in realtà si poteva vedere;
2. la **lezione PostgREST** del §6 del verbale di costruzione: con la chiave
   anonima chiedi colonne che nessuna pagina seleziona — il contratto §Dati
   visibili a un anonimo e l'handoff §4 reggono a quel confronto?
3. le **due trappole di Next** del §7 (Data Cache che sopravvive alla build,
   tipi di rotta come stato): il gate diagnostica o manda dall'imputato
   sbagliato?
4. il **contratto compilato attenendoti al template alla lettera**: le righe
   SINTASSI/PROSA reggono tutte? (il precedente: speed-demon bocciava il proprio
   template);
5. il **cronometro del gate**, mai misurato — il banco ha le pagine e gli slot
   per farlo;
6. **sabotaggi nuovi**, oltre la reference: il rosso a comando è la metà facile,
   cerca il **verde immeritato**.

Metodo invariato: ogni difetto misurato prima e dopo, un test di regressione
ciascuno, commit subito.

## Chiusura (i deliverable che la prima metà non ha lasciato)

1. **`COLLAUDO-<data>.md`** che copre **tutti** i difetti — i sei committati e i
   tuoi — con uscita prima/dopo, test di regressione, e la sezione «cosa NON è
   stato collaudato»;
2. **`STATO.md`** aggiornato (punti aperti rivisti alla luce dell'intero
   collaudo);
3. gate rilanciato alla fine su **valscura** (verdetto incollato, con lo stato
   del banco dichiarato) e su **`banco-prova-controtempo`** senza regressioni
   (db già acceso su 57421-24; l'app si riavvia con `npm run start -- -p 3140`
   dalla sua radice e a prova finita si rispegne);
4. in chat, la riga finale del mandato originale — o la verità, se è un'altra.

## Coordinamento (D8 — in parallelo gira P.7c-ripresa sulle skill storiche)

Identico al mandato originale: **non toccare** `banco-prova-vetcare`,
`agenti/schema-forge`, `agenti/gestionale-crafter`, `agenti/flow-sentinel`,
`agenti/speed-demon`, `CANTIERE.md`, `prompts/` e `scripts/` di radice,
`webgun_content.txt`. Commit **solo dei tuoi percorsi** con `git add` espliciti —
mai `-A`, mai `commit -a`: l'index è condiviso. Batterie `node --test` con
`~/scoop/apps/nodejs-lts/current/node.exe`; i gate col `node` di sistema.
