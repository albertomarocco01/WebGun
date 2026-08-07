# P.4j — Il certificato riemesso, e le due anteprime che mancano

> **Modello consigliato: Opus 5 · effort high.** Chat operaia, 2026-08-07.
> Perimetro in scrittura: **`C:\Users\Utente\Desktop\fornodoro\**`** (il pilota,
> di cui questa chat è l'unica proprietaria mentre lavora) **+ il solo verbale**
> `agenti/site-doctor/PILOTA-CONFORMITA-2-2026-08-07.md` nella regia
> (`C:\Users\Utente\Desktop\WebGun`). Nient'altro della regia si tocca.
> Mandato della direzione lavori; per D14 va fino in fondo da solo — le firme
> sui verbali si fanno per delega dichiarata
> (`Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il <ISO>`),
> **mai** su `docs/deploy.md` (D20) e **mai** su `docs/vetrina.md` (il contratto
> delle pagine è del committente).

## Il contesto in cinque righe

La skill site-doctor è stata corretta e collaudata (P.6-P5, verbale
`agenti/site-doctor/P6-P5-2026-08-07.md`): il suo gate sul pilota oggi dice
**VERDE, 0 falliti, 1 n/a su 14, «2 da guardare»** — la voce «contrasti» è
uscita dalle scoperte. Il certificato del pilota (`docs/conformita.md`) porta
però ancora numeri dell'era precedente, e il gate rende visibili due rilievi
veri e non bloccanti: **`og:image` assente su 6 pagine** e **JSON-LD assente
ovunque**. Questo pacchetto riallinea il certificato alla misura e decide le
due anteprime.

## Regole assolute

- **Nessun `git push`, nessuna pubblicazione, nessun deploy** — nemmeno di
  prova. Nessun account, dominio, DNS.
- La chiave `service_role` non entra in nessun file del progetto, nemmeno
  ignorato.
- Commit **solo** `git commit -F - -- <percorsi>` (D19); su `index.lock` si
  aspetta. Mai `git reset --hard`, mai `git checkout --` su file non tuoi,
  mai `git stash`.
- Lo stack Supabase del pilota è acceso e **resta acceso**; l'app di
  produzione vive sulla porta **3621**.
- `C:\Users\Utente\Desktop\Informatica` non si tocca; gli snapshot esterni
  della regia nemmeno.
- **`docs/vetrina.md` non si tocca**: la settima pagina (`/privacy`) nel
  contratto e la rifirma sono un atto del committente in persona. Se un gate
  te la segnala come issue, è atteso: dichiaralo, non «sistemarlo».

## Da leggere prima

1. `C:\Users\Utente\Desktop\fornodoro\docs\conformita.md` — per intero, è il
   documento che riemetti.
2. `C:\Users\Utente\Desktop\fornodoro\docs\handoff\` — gli handoff 14-16 e il
   contesto della catena.
3. `agenti/site-doctor/P6-P5-2026-08-07.md` §2 punto 1 e §5 (cosa è cambiato
   nel gate e cosa resta dichiarato).
4. `agenti/site-doctor/PILOTA-CONFORMITA-2026-08-06.md` — il verbale di P.4i:
   il tuo è il suo seguito.
5. `CANTIERE.md`, voce di giornale «2026-08-07 (sera)» — le misure della
   direzione che il tuo lavoro deve rispettare.

## I quattro punti

### 1. Le due anteprime: og:image e JSON-LD — chiudere o dichiarare

Il gate stampa, dentro passi OK:

```
[issue] /, /chi-siamo, /menu, /ordina, /ordine, /privacy: dichiara l'Open Graph
        e gli mancano og:image
[issue] dati-strutturati: nessuna delle 6 pagine dichiara `application/ld+json`
```

Decidi con questo criterio, e scrivi la decisione nel verbale:

- **`og:image`**: se il sito ha già un'immagine adatta e servita (un logo, una
  foto di copertina in `public/`), aggiungerla ai metatag è un intervento
  piccolo e misurabile → **falla**. L'immagine promessa deve rispondere 200
  (il gate la scarica). Un'immagine inventata o un segnaposto è peggio di
  niente: in quel caso **dichiara** invece la voce nel registro.
- **JSON-LD**: per una pizzeria il blocco sensato è `LocalBusiness`/
  `Restaurant` con nome, indirizzo e orari **che il sito già dichiara** in
  pagina. Se quei dati ci sono, il blocco si scrive e si prova col gate. Se
  mancano (es. l'indirizzo non compare da nessuna parte), **non inventarli**:
  dichiara la voce nel registro. Un dato strutturato che promette ciò che la
  pagina non dice è la classe di difetto che questa casa misura negli altri.
- Qualunque strada per ciascuna delle due: la voce va o **chiusa e provata col
  gate** o **dichiarata in `docs/DEBITO-TECNICO.md`** con la riga
  `Blocca il deploy: no` e la motivazione (D23 §2).

### 2. Il certificato riallineato alla misura

`docs/conformita.md`:

- la sezione con **«Erano otto alle 22, sono quattro adesso»** (attorno alla
  riga 259): il gate oggi ne conta **DUE** (`accessibilita-admin` «sui
  sorgenti», `antispam`) — riscrivi il numero **rilanciando il gate**, mai
  leggendo un verbale (nemmeno questo mandato);
- la voce «contrasti» è già stata riscritta da P.7f con la delega piena: 
  verifica che nessun'altra frase del certificato citi ancora «3 da guardare»
  o la scoperta dei contrasti come viva;
- se hai chiuso og:image/JSON-LD al punto 1, le voci relative del certificato
  dicono la misura nuova; se le hai dichiarate, il certificato rimanda al
  registro;
- **ridatare il certificato è l'ULTIMO atto del pacchetto** (regola di casa):
  si ridata solo dopo l'ultimo commit di contenuto, contro le corse vere.

### 3. Ricostruire, riservire, rimisurare (la lezione del quarto rosso)

**Qualunque commit nel pilota porta HEAD oltre la build**: il passo
`impronta-artefatto` di launchpad lo vede e ha ragione. Quindi, **dopo
l'ultimo commit**:

```
cd C:\Users\Utente\Desktop\fornodoro
npm run build            # BUILD_ID deve diventare l'HEAD nuovo
# spegni il vecchio server sulla 3621 (per PID, letto da Get-NetTCPConnection)
npx next start -p 3621   # e lasciala viva quando chiudi
```

Poi i gate, **dalla radice del pilota**, e ogni verdetto incollato nel
verbale col commit della regia accanto:

| gate | comando | atteso |
|---|---|---|
| vetrina | `node C:\Users\Utente\Desktop\WebGun\.claude\skills\vetrina-crafter\scripts\verify.mjs --url http://127.0.0.1:3621` | 10/10 — con l'issue di `/privacy` fuori contratto, che è atteso e resta |
| speed-demon | `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` poi `node C:\Users\Utente\Desktop\WebGun\.claude\skills\speed-demon\scripts\verify.mjs --url http://127.0.0.1:3621` | 8/8 (Lighthouse vuole il node di scoop nel PATH; dopo, controlla i chrome orfani di Lighthouse — n°57 — SENZA toccare il Chrome del committente: guarda la riga di comando, uccidi solo headless/temp) |
| site-doctor | `node C:\Users\Utente\Desktop\WebGun\.claude\skills\site-doctor\scripts\verify.mjs --url http://127.0.0.1:3621` | VERDE, «2 da guardare» (o meglio, se il punto 1 ha chiuso le voci) |
| launchpad | `node C:\Users\Utente\Desktop\WebGun\.claude\skills\launchpad\scripts\verify.mjs --url http://127.0.0.1:3621` | **ROSSO 3, e solo 3**: segreti (n°27) · runbook · handoff. Un quarto rosso = ti sei perso un rebuild; un ROSSO 2 = qualcosa è cambiato che non doveva — in entrambi i casi fermati e scrivilo |

Se og:image/JSON-LD hanno toccato l'HTML delle pagine, dichiara nel verbale
anche che gli **E2E di flow-sentinel** restano validi (i flussi non toccano i
metatag) — o rilanciali se hai il dubbio: `22/22` è l'atteso.

### 4. Il verbale e la chiusura

`agenti/site-doctor/PILOTA-CONFORMITA-2-2026-08-07.md` (unico file di regia
che tocchi): cosa hai fatto, le decisioni con la motivazione, i verdetti dei
gate incollati col commit della regia, «Cosa resta MANCANTE col suo nome», e
cosa ti aspetti dal successivo. Handoff nel pilota solo se un gate lo
pretende. Commit pathspec, messaggi di casa, `Co-Authored-By:` col tuo
modello.

## Trappole di macchina (misurate)

- `npm run seed-sviluppo` (se mai ti servisse) **solo col node di sistema**
  (n°58); qui non dovrebbe servire — il database non si tocca.
- Il gate di speed-demon vuole il node di scoop **nel PATH** (Lighthouse usa
  `npx`): `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`.
- Un processo può morire `0xC0000409` **dopo** aver stampato il verdetto
  (Node 24.19, sporadico): fa fede il verdetto stampato/`doc.ok`, non la sola
  uscita — se succede, dichiaralo.
- La 3621 che trovi viva è servita da un processo di una sessione precedente:
  spegnila **per PID** e riservila tu dopo la build.

## Cosa NON è di questo pacchetto

- `/privacy` nel contratto della vetrina (del committente, in persona).
- La firma di `docs/deploy.md` (del committente, al deploy — D20).
- n°27 e la riscrittura della storia (D24: prima del primo push, coordinata
  dalla direzione).
- I 45 rilievi aperti della skill (restano in `P6-P4-2026-08-07.md` §6.1).

Alla fine riferisci alla direzione: esito, misure, scarti — la direzione
rilancia in proprio prima di chiudere.
