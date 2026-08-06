# Mandato P.5 — launchpad, progettazione **e** costruzione in un solo pacchetto

> Emesso dal direttore dei lavori il 2026-08-06. Da incollare in una chat operaia
> nuova, aperta **nella regia** `C:\Users\Utente\Desktop\WebGun`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md`, riga **P.5**; decisioni **D2, D4, D6, D8, D14, D17**.

## Perché questo pacchetto è unito, e cosa ti costa

Le quattro skill storiche hanno fatto **P0 (progettazione) e P1 (costruzione) in
due chat separate**, con una revisione del direttore in mezzo. Qui no: le fai
tutte e due tu, di seguito. È una decisione del committente sui tempi, con un
prezzo dichiarato: **un errore di progettazione non incontra un revisore prima
di diventare codice.** Il contrappeso è tuo:

- **Il gate si progetta e si scrive PRIMA del flusso operativo.**
- **A metà pacchetto ti fermi da solo** e rileggi la progettazione con una sola
  domanda: *quale passo del mio gate potrebbe essere verde su un deploy che non
  si deve fare?* Ogni risposta è un difetto da chiudere prima di costruire, e va
  nel verbale.
- **P2 (collaudo avversario) resta separato, in chat vergine.** Non lo fai tu.

## Regola di regime — e l'eccezione che qui non si tocca (D14, DECISIONI §6)

Arrivi in fondo da solo: scelte tecniche, dati finti e alternative le decidi tu
e le scrivi nel verbale.

**Ma il tuo mestiere è l'unica cosa della pipeline che è irreversibile e costa
soldi.** Quindi, e non è delegabile a te stesso:

> **Questo pacchetto non pubblica niente.** Non crei account, non colleghi
> repository a Vercel o Cloudflare, non compri domini, non tocchi DNS, non
> esegui un deploy vero — nemmeno di prova, nemmeno gratis. Costruisci la skill
> e il suo gate, ed **eserciti tutto fino al passo prima**. Il primo deploy vero
> è il collaudo di P.5, e lo autorizza Alberto di persona.

Se durante il lavoro ti sembra che «basterebbe un deploy di prova per
verificare»: quello è esattamente il pensiero da cui la §6 esiste. Scrivilo nel
verbale come cosa che il gate non può provare senza un umano, e vai avanti.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`, `README.md` (**note comprese**), `DECISIONI.md` (tutte; pesano
   **§6** — reversibile all'orchestratore, irreversibile all'umano —, §11, §18,
   §19, §26).
2. `template-skill/COME-USARE-QUESTO-TEMPLATE.md` e `template-skill/SKILL.md`.
3. **`agenti/speed-demon/`** — `SKILL.md` e `scripts/verify.mjs`. Il suo passo
   che confronta il **`BUILD_ID`** dell'HTML servito con quello di `.next/` è la
   risposta già trovata alla domanda «sto guardando davvero l'app di questo
   progetto». Il tuo problema è lo stesso, spostato in produzione: *l'URL
   pubblico sta servendo il commit che credo?*
4. **`agenti/vetrina-crafter/`** per intero (la skill più curata: `scripts/` con
   lib pure e batteria, `COLLAUDO-2026-08-04.md` coi 14 difetti che il collaudo
   avversario le ha trovato — sono le classi di errore che un gate nuovo
   ripete).
5. **`PILOTA-2026-08-06.md`** nella radice della regia (verbale di catena), in
   particolare **§6: cosa blocca la pubblicazione**.
6. Il tuo `agenti/launchpad/SKILL.md` (scaffold) e `STATO.md` — il suo paragrafo
   sulle dipendenze contiene già una legge: **«non si pubblica su gate rosso»**,
   posta da flow-sentinel e da speed-demon.
7. `agenti/site-doctor/STATO.md` — è il tuo fornitore a monte (certificato di
   idoneità). **Sta venendo costruito in parallelo in un'altra chat**: progetta
   il tuo aggancio a lui come un **contratto letto da file**, non come una
   dipendenza da codice suo. Se il certificato non c'è, il tuo passo è
   **MANCANTE**, non `PASS` e non un errore.

## Il cuore della skill: cosa deve essere vero perché si possa pubblicare

Non progettare «un deploy». Progetta **il permesso di pubblicare**. La skill è
un cancello, e il gate è la sua serratura. Le condizioni le decidi tu, motivate;
queste sono già leggi della casa e non si rimettono in discussione:

- **Non si pubblica su gate rosso** — di *nessuno* degli agenti a monte. Il tuo
  gate deve leggere i verdetti dichiarati negli handoff (§19: l'handoff dichiara
  il verdetto del gate) **e non fidarsi di ciò che legge**: un handoff che dice
  `Gate: VERDE` è un'affermazione, non una misura. Decidi tu cosa rilanci e cosa
  ti limiti a leggere — ma scrivi la differenza, perché è la differenza fra un
  certificato e una promessa.
- **Nessun segreto nel repo**, e in particolare: la chiave `service_role` di
  Supabase **non entra mai** in un progetto generato; le variabili d'ambiente di
  produzione sono dichiarate ma non committate.
- **Verifica d'identità dell'app pubblicata**: dopo il deploy, ciò che risponde
  sul dominio deve essere **dimostrabilmente** l'artefatto che hai costruito
  (l'idea del `BUILD_ID` è riusabile e regge).
- **Deploy riproducibile e rollback possibile**, documentati come procedura che
  un umano sa rifare.
- **Conferma umana prima di pubblicare** (§6), e la conferma è **sul contenuto**,
  non sul comando: chi firma deve sapere cosa va online.

## Il criterio di accettazione — ed è il più bello che questo cantiere abbia avuto

Il pilota `fornodoro` è un sito **completo, con cinque gate verdi**, e
**non si deve pubblicare**. Il suo `docs/DEBITO-TECNICO.md` dichiara quattro
bloccanti di deploy, misurati e scritti da altri agenti prima che tu esistessi:

| # | cosa | perché blocca |
|---|---|---|
| **27** | `supabase/seed.sql` crea `titolare@fornodoro.it` e `cucina@fornodoro.it` con **`password123`**, in chiaro in un file committato | un seed riusato su un ambiente vero consegna gli accessi a chiunque legga il repo |
| **32** | il sito **non si costruisce** su Node < 22: `@supabase/realtime-js` risolve il costruttore WebSocket in modo eager e **solleva**; `/`, `/menu`, `/chi-siamo` sono statiche e chiamano il client **durante `next build`**. `engines` in `package.json` **non lo dichiara** | una macchina di deploy con Node 20 fallisce la build — o peggio, non fallisce e serve pagine rotte |
| 4 · 17 | nessun tetto ai tentativi su `/accedi` (e per IP) | è una prescrizione di runbook del proxy, non una pagina |

> **Il tuo gate, lanciato sul pilota, deve uscire ROSSO e rifiutare la
> pubblicazione — e i motivi che stampa devono essere questi, trovati da lui,
> non copiati da me.** Se il tuo gate esce verde su un sito che va online con
> due password note nel repo, il gate non è un cancello: è una porta dipinta.

Poi **P.4g** (un'altra chat, in parallelo) chiuderà 27 e 32 nel pilota. Quando
lo avrà fatto, **rilanci il tuo gate**: deve passare da rosso a verde **per la
correzione, non per una tua modifica**. Quel passaggio, incollato prima e dopo,
è la prova che il tuo gate misura invece di dichiarare.
Se P.4g non è ancora tornata quando arrivi lì, **non aspettarla**: chiudi col
rosso motivato e scrivi nel verbale che il verde è da rilanciare — è un esito
onesto, e il direttore lo rilancia in proprio.

## Deliverable

1. **`SKILL.md` completo** — `description` che dice QUANDO attivarla; «Cosa fa»
   in tre righe; 2–4 Leggi non negoziabili (una è «non si pubblica su gate
   rosso», un'altra riguarda la §6); tabella dei comandi (**solo quelli che
   esisteranno davvero alla fine di questo pacchetto**); flusso operativo
   numerato **con gli STOP umani in chiaro**; **Gate di chiusura**; indice
   references; sezione **«Cosa un gate verde NON prova»** — e nella tua ha un
   posto d'onore: *un gate verde non prova che il sito sia pronto per il suo
   pubblico, prova che è pronto per il trasporto.*
2. **`scripts/verify.mjs`** — forma della casa: id stabili + `--json` (§15);
   **premessa misurata prima dell'esito** (§18), MANCANTE ≠ PASS; logica in lib
   pure con batteria `node --test`; guardiani locali; **epilogo a doppio
   confronto** (`resolve` **e** `realpathSync`, `try` con ricaduta testuale) —
   è la forma che P.0-igiene-2 ha imposto a otto script perché dalla junction i
   gate uscivano **0 muti**, e il gate della regia la verifica.
3. **`references/`** piene (una almeno sui provider: cosa cambia fra Vercel e
   Cloudflare per **questa** pipeline, e la procedura di rollback per ciascuno)
   e indicizzate nello SKILL.md. Niente indice verso file vuoti.
4. **`resources/templates/`** — il **runbook di deploy** (che raccoglie anche le
   prescrizioni lasciate dagli altri: n°4, n°17, n°27, n°32) e l'handoff
   `handoff-launchpad.md` con la riga `Gate: VERDE/ROSSO` (§19).
5. **`STATO.md` riscritto**: stato reale, dipendenze corrette, piano P0→P3 in
   tabella, «Cosa un gate verde NON prova», «Proposte a monte/valle».

## Le prove, oltre al pilota

- **Sabotaggio per ogni classe**: pianta il difetto nel banco → il passo deve
  diventare **rosso**. Un passo che resta verde col difetto piantato non prova
  quello che dichiara: riscrivilo. Classi ed esiti **incollati** nel verbale.
  La classe che ti interessa di più: *un segreto committato che il mio passo non
  vede* (prova con forme diverse, non solo la stringa ovvia).
- `node --test` verde (**Node 24**: `~/scoop/apps/nodejs-lts/current/node.exe`);
  **gate col node di sistema**, che è il canale reale.
  Nota di macchina, misurata dal direttore il 2026-08-06: «lanciare col Node 24»
  e «avere il Node 24 nel `PATH`» **non sono la stessa cosa**. Un gate che
  chiama uno strumento esterno via `npx`/shim `.cmd` (è quello che fa
  speed-demon per Lighthouse) eredita il node del **PATH**, non l'interprete che
  lo ha avviato. Il tuo gate quasi certamente chiamerà strumenti esterni:
  **dichiara quale delle due cose ti serve, e provalo.**
- `node scripts/verifica-regia.mjs` **VERDE 5/5 prima e dopo**.
- A gate funzionante: riga in `README.md` e in `installa-skill.ps1`.
- `code-maniac scan` e `/code-inquisition --focus security,reliability`. Sulle
  cinque skill il tribunale ha trovato qualcosa **ogni volta** (11+6+5+21+6
  rilievi) e **gli strumenti statici erano tutti verdi ogni volta**. Il tuo
  codice tratta segreti: aspettati che trovi.

## Coordinamento — ci sono altre tre chat vive (D8, D17)

In parallelo girano **P.7c-ripresa-2**, **P.6** (site-doctor) e **P.4g**
(prerequisiti del pilota). Quindi:

- **Non toccare niente fuori da `agenti/launchpad/`**, salvo le due righe di
  `README.md` e `installa-skill.ps1` a gate funzionante. Mai `CANTIERE.md`,
  `prompts/`, gli altri `agenti/*`, gli snapshot esterni, i banchi, il docx.
- Commit **solo dei tuoi percorsi** con `git add` espliciti — **mai `-A`, mai
  `commit -a`**: l'index è condiviso. Se `index.lock` è occupato, aspetta e
  riprova; non cancellarlo.
- **Sul pilota non scrivi.** Lo leggi, lo misuri, e **puoi ricostruire l'app**
  (`npm run build`, Node 24) se il tuo gate lo richiede — ma allora: dichiaralo
  nel verbale, **rilascia l'app viva sulla 3621 alla fine**, e sappi che un'altra
  chat sta misurando le stesse pagine. Non spegnere lo stack Supabase, non
  toccare schema, seed o migrazioni: quelli sono di P.4g.
- Un solo stack Supabase acceso: quello del pilota, già acceso. **Non
  accenderne altri** (16 GB).
- Commit **piccoli e frequenti**, uno per deliverable. Due pacchetti di questo
  cantiere sono morti con un'ora di lavoro in working tree e zero commit: se la
  corsa si ferma, committa con `WIP` nel titolo.

## Verbale di chiusura

`agenti/launchpad/COSTRUZIONE-2026-08-<gg>.md`:

1. **tabella delle scelte autonome** in testa (scelta · alternativa scartata ·
   motivo);
2. le **condizioni di pubblicazione** che hai deciso, e per ciascuna: *il gate
   la misura o la legge dichiarata?* — la tabella più importante del documento;
3. i passi scelti **e quelli scartati, col perché**;
4. la **risposta alla domanda di metà pacchetto**: quali passi potevano essere
   verdi su un deploy da non fare, e cosa hai cambiato;
5. le uscite **incollate**: gate sul pilota (**rosso, coi motivi**), sabotaggi
   classe per classe, batteria, gate della regia, code-maniac, tribunale;
6. rilievi del tribunale per gravità, con la sorte di ciascuno;
7. **«Cosa questo pacchetto non ha potuto provare senza un umano»** — l'elenco
   onesto di ciò che solo un deploy vero verificherà, che è il mandato del
   collaudo di P.5.

Riga finale:

`P.5 (P0+P1) consegnata. Il gate di launchpad rifiuta la pubblicazione del
pilota per <n> motivi misurati (<elenco>), e nessun deploy è stato eseguito.
Sabotaggio: <n> classi, tutte rosse. Batteria <n>/<n>. Gate della regia VERDE
5/5.`
— o la verità, se è un'altra.
