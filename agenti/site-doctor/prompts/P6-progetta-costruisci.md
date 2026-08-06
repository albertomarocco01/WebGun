# Mandato P.6 — site-doctor, progettazione **e** costruzione in un solo pacchetto

> Emesso dal direttore dei lavori il 2026-08-06. Da incollare in una chat operaia
> nuova, aperta **nella regia** `C:\Users\Utente\Desktop\WebGun`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md`, riga **P.6**; decisioni **D2, D4, D8, D14, D17**.

## Perché questo pacchetto è unito, e cosa ti costa

Le quattro skill storiche hanno fatto **P0 (progettazione) e P1 (costruzione) in
due chat separate**, con una revisione del direttore in mezzo. Qui no: le fai
tutte e due tu, di seguito. È una decisione del committente sui tempi, e ha un
prezzo dichiarato: **un errore di progettazione non incontra un revisore prima
di diventare codice.** Il contrappeso è tuo e non è negoziabile:

- **Il gate si progetta e si scrive PRIMA del flusso operativo** (regola della
  casa, template passo 3). Un gate scritto dopo descrive ciò che il codice fa
  invece di ciò che deve provare.
- **A metà pacchetto ti fermi da solo** e rileggi la progettazione con una sola
  domanda: *quale passo del mio gate potrebbe essere verde su un sito che non è
  conforme?* Ogni risposta che trovi è un difetto da chiudere prima di
  costruire, e va nel verbale.
- **P2 (collaudo avversario) resta un pacchetto separato in chat vergine.** Non
  lo fai tu: chi costruisce non collauda. Non anticiparlo, non simularlo.

## Regola di regime: **arrivi in fondo da solo** (D14)

Nessuna domanda al committente. Le scelte tecniche, i dati finti e le
alternative le decidi tu e le scrivi nel verbale con la motivazione in una riga
(tabella in testa). L'unica cosa che resta all'umano è la **firma sul contratto**
che questa skill produrrà: la riga `Confermato da:` la lasci col segnaposto o la
firmi **per delega dichiarata** — `Confermato da: Direzione lavori (per delega
del committente Alberto Marocco) il <ISO>` — mai col nome di chi non ha letto.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`, `README.md` (**note a piè di pagina comprese**), `DECISIONI.md`
   (tutte le voci; pesano §6, §8, §11, §18, §19, §26).
2. `template-skill/COME-USARE-QUESTO-TEMPLATE.md` e `template-skill/SKILL.md`.
3. **La skill più vicina alla tua per forma di gate**: `agenti/speed-demon/` —
   `SKILL.md`, `scripts/verify.mjs`, `resources/templates/performance.md`. Il
   suo gate misura un'app viva e ne verifica l'identità dal `BUILD_ID`: è
   esattamente il tuo problema.
4. `agenti/vetrina-crafter/` per intero — è la skill più giovane, quella con la
   qualità più alta, e ha attraversato P0→P1→P2→pilota. Guarda in particolare
   `scripts/` (lib pure + test), `COLLAUDO-2026-08-04.md` (i **14 difetti** che
   il collaudo avversario le ha trovato: sono le classi di errore che un gate
   nuovo ripete) e `STATO.md`.
5. **`PILOTA-2026-08-06.md` nella radice della regia** — il verbale di catena.
   Ti serve tutto, ma soprattutto §4 e §5.
6. Il tuo `agenti/site-doctor/SKILL.md` attuale (scaffold: `description` e gate
   di chiusura abbozzato) e `STATO.md`.

## Il tuo perimetro — e la trappola che ci sta dentro

Il verbale di catena, §4, registra questo fatto: **la proprietà dell'Open Graph
era assegnata due volte** nello stesso handoff (a speed-demon *e* a te), e tu
non esistevi. Risultato: la favicon del pilota è stata un `404` su ogni pagina
per tre anelli. Quindi la prima cosa che questo pacchetto deve produrre è un
**perimetro scritto nero su bianco**, e la regola per deciderlo è:

> Dove un vicino **misura** una cosa, tu non la rimisuri: la **verifichi
> dichiarata**. Dove nessuno la guarda, è tua.

Al 2026-08-06, sul pilota, **speed-demon ha già fatto e misurato**: canonical,
sitemap.xml, robots.txt, `noindex` sulle pagine private, favicon, categoria SEO
di Lighthouse. **Gestionale-crafter** fa a11y sulle rotte admin. **Vetrina-crafter**
controlla i segnaposto e i contenuti dal database.

Resta a te — e nessuno lo guarda oggi:

- **Cookie / GDPR / privacy**: informativa presente e raggiungibile; banner solo
  se ci sono cookie non essenziali; **quali cookie il sito pone davvero** (si
  misura, non si dichiara: apri le pagine e leggi i `Set-Cookie`); base
  giuridica dei dati raccolti dai moduli pubblici.
- **Accessibilità del sito pubblico** (il gestionale è dei vicini): `alt` sulle
  immagini, contrasti, HTML semantico, gerarchia dei titoli, lingua dichiarata.
- **hreflang** e multilingua — sul pilota è monolingua: il tuo gate deve saper
  dire `NON APPLICABILE` con la premessa misurata, non `PASS`.
- **Il certificato di idoneità**: il documento che dice, voce per voce, cosa è
  stato guardato e con che esito. È il tuo deliverable verso launchpad, che
  **non pubblica senza**.

Il resto va nel perimetro come **esclusione esplicita, con il nome del vicino
che lo copre**. Un'esclusione senza il nome del proprietario è il difetto
dell'Open Graph rifatto.

## Deliverable

1. **`SKILL.md` completo** — frontmatter con `description` che dice QUANDO
   attivarla; «Cosa fa» in tre righe; 2–4 Leggi non negoziabili; tabella dei
   comandi (**solo comandi che esistono davvero alla fine di questo
   pacchetto**); flusso operativo numerato con gli STOP; **Gate di chiusura**;
   indice delle references; sezione **«Cosa un gate verde NON prova»**.
2. **`scripts/verify.mjs`** — il gate, con la forma della casa:
   - passi con **id stabili** e `--json` (§15);
   - **premessa misurata prima dell'esito** (§18): uno strumento assente, o che
     non ha letto il suo input, produce **MANCANTE**, mai un verde;
   - logica in **lib pure testabili** più una batteria `node --test`;
   - guardiani locali (`package.json` + config ESLint della cartella, come
     schema-forge e vetrina-crafter);
   - **epilogo a doppio confronto** (`resolve` **e** `realpathSync` in un `try`
     con ricaduta testuale): è la forma che P.0-igiene-2 ha imposto a otto
     script perché dalla junction i gate uscivano **0 muti**. Il gate della
     regia (`node scripts/verifica-regia.mjs`) la verifica: se sbagli forma,
     diventa rosso.
3. **`references/`** — le references che lo SKILL.md indicizza, piene. Niente
   indice che punta a file vuoti.
4. **`resources/templates/`** — il **certificato di idoneità** (il documento
   firmabile: cosa è stato guardato, con che esito, deroghe motivate, riga
   `Confermato da:` con nome, ruolo e data) e l'handoff
   `handoff-site-doctor.md` con la riga `Gate: VERDE/ROSSO` (§19).
5. **`STATO.md` riscritto**: stato reale, dipendenze a monte/valle corrette,
   piano P0→P3 in tabella, «Cosa un gate verde NON prova», e la sezione
   **«Proposte a monte/valle»** per tutto ciò che riguarda i vicini (è il canale
   della casa: il consumatore riporta, il proprietario decide).

## La prova che vale il pacchetto

Il tuo banco **non lo costruisci: esiste**. È il pilota
`C:\Users\Utente\Desktop\fornodoro` — pizzeria «Forno d'Oro», sei pagine
pubbliche, app di produzione **viva sulla 3621**, cinque gate verdi, un debito
tecnico di ~38 voci dichiarate. È un sito vero, completo, e **non conforme**:
il tuo gate deve dirlo.

**Il criterio di accettazione è questo, ed è falsificabile**:

> Il gate di site-doctor, lanciato sul pilota, deve uscire **ROSSO per motivi
> veri e misurati**, e ognuno di quei motivi deve essere una cosa che **nessuno
> dei cinque gate esistenti vede**. Un gate nuovo che esce verde su un sito
> senza informativa privacy non ha provato niente: ha solo imparato a tacere.

Poi, come le altre skill:

- **sabotaggio per ogni classe**: togli la difesa nel banco → il passo deve
  diventare **rosso**. Un passo che resta verde col difetto piantato non prova
  quello che dichiara: riscrivilo. Le classi di sabotaggio e i loro esiti vanno
  **incollati** nel verbale.
- `node --test` verde sulla batteria (**Node 24**:
  `~/scoop/apps/nodejs-lts/current/node.exe` — il `node --test` con glob vuole
  21+); il **gate col node di sistema**, che è il canale reale.
  Nota di macchina, misurata dal direttore il 2026-08-06: «lanciare col Node 24»
  e «avere il Node 24 nel `PATH`» **non sono la stessa cosa**. Un gate che
  chiama uno strumento esterno via `npx`/shim `.cmd` (è quello che fa
  speed-demon per Lighthouse) eredita il node del **PATH**, non l'interprete che
  lo ha avviato. Se il tuo gate lancia strumenti esterni, **dichiara quale
  delle due cose gli serve** — e provalo.
- `node scripts/verifica-regia.mjs` **VERDE 5/5 prima e dopo**.
- A gate funzionante: riga in `README.md` e in `installa-skill.ps1`, come le
  altre cinque. Il passo `skill-elencate` del gate della regia te lo verifica.
- `code-maniac scan` sui tuoi script, e `/code-inquisition --focus security,reliability`.
  Sulle cinque skill il tribunale ha trovato qualcosa **ogni volta**: 11 + 6 + 5
  + 21 + 6 rilievi, e **gli strumenti statici erano tutti verdi ogni volta**.

## Coordinamento — leggilo, ci sono altre tre chat vive (D8, D17)

Sulla macchina girano in parallelo: **P.7c-ripresa-2** (guardiani arretrati),
**P.5** (launchpad) e **P.4g** (prerequisiti del pilota). Quindi:

- **Non toccare niente fuori da `agenti/site-doctor/`**, con le due sole
  eccezioni dichiarate sopra (`README.md` e `installa-skill.ps1`, una riga
  ciascuno, a gate funzionante). Mai `CANTIERE.md`, `prompts/`, gli altri
  `agenti/*`, gli snapshot esterni, i banchi, il docx.
- Commit **solo dei tuoi percorsi**, con `git add` espliciti — **mai `-A`, mai
  `commit -a`**: l'index è condiviso con altre chat. Se `index.lock` è occupato,
  aspetta qualche secondo e riprova; non cancellarlo.
- **Il pilota è di sola lettura per te.** Non modifichi file di `fornodoro`, non
  tocchi lo schema, il seed, le migrazioni; **non spegni lo stack Supabase e non
  ricostruisci l'app** — c'è un'altra chat che ci lavora. Se ti serve una
  modifica al pilota per provare una classe di sabotaggio, **falla, provala e
  rimettila com'era nello stesso passo**, dichiarandolo; oppure prova su una
  copia dell'HTML servito.
- **Non citare un `BUILD_ID` come fatto in prosa**: un'altra chat può
  ricostruire. Se ti serve l'identità dell'app, rileggila al momento della
  misura (è quello che fa speed-demon).
- Un solo stack Supabase acceso su questa macchina: quello del pilota, ed è già
  acceso. **Non accenderne altri** (16 GB: tre insieme uccidono le finestre).
- Commit **piccoli e frequenti**, uno per deliverable chiuso. Due pacchetti di
  questo cantiere sono morti con un'ora di lavoro in working tree e zero
  commit: se senti che la corsa si ferma, committa quello che c'è con `WIP` nel
  titolo.

## Verbale di chiusura

`agenti/site-doctor/COSTRUZIONE-2026-08-<gg>.md`, con:

1. la **tabella delle scelte autonome** in testa (scelta · alternativa scartata
   · motivo, una riga ciascuna);
2. il **perimetro** deciso, con le esclusioni e il nome del vicino che le copre;
3. i passi del gate scelti **e quelli scartati, col perché** (i secondi valgono
   quanto i primi);
4. la **risposta alla domanda di metà pacchetto**: quali passi potevano essere
   verdi su un sito non conforme, e cosa hai cambiato;
5. le uscite **incollate**: gate sul pilota, sabotaggi (classe per classe, prima
   e dopo), batteria, gate della regia, code-maniac, tribunale;
6. i rilievi del tribunale per gravità, **con la sorte di ciascuno**;
7. cosa lascia al collaudo avversario (P2) — e le tue classi cieche dichiarate:
   *dove il mio gate è cieco per costruzione*.

Riga finale:

`P.6 (P0+P1) consegnata. Il gate di site-doctor esce ROSSO sul pilota per <n>
motivi veri che nessuno dei cinque gate esistenti vede: <elenco>. Sabotaggio:
<n> classi, tutte rosse. Batteria <n>/<n>. Gate della regia VERDE 5/5.`
— o la verità, se è un'altra.
