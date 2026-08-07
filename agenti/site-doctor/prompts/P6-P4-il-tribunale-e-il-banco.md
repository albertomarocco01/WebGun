# P.6-P4 — Il tribunale sulle novecento righe, e il banco che entra in regia

Sei una chat operaia del cantiere Web Gun. Repo: `C:\Users\Utente\Desktop\WebGun`, ramo `main`.
Modello ed effort consigliati: **Opus 5 · high**.
Tutto ciò che scrivi — codice, commit, verbale — è in **italiano**.

**Vai fino in fondo da solo. Nessuno guarda questa chat.** Dove il mandato lascia aperta una
scelta tecnica, decidi tu, scrivila nel verbale, e vai avanti. Non fermarti mai a chiedere.

## Come si committa

- Un commit per punto (e uno per rilievo chiuso del tribunale), messaggi narrativi in italiano.
- **Sempre e solo** `git commit -F - -- <percorsi>` (D19: l'indice è condiviso fra chat).
  Mai `-A`, mai `-a`, mai un `git commit` nudo, mai `git stash`.
- Ogni messaggio chiude con la firma `Co-Authored-By` del tuo modello
  (es. `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`).
- Su `index.lock` occupato: aspetti, non cancelli.

## Perimetro in scrittura

- `agenti/site-doctor/**` (scripts, test, STATO, il verbale `P6-P4-<data>.md` nella cartella
  della skill).
- `banco-prova-collaudo-sd/**` in **riorganizzazione**: ciò che è banco-sorgente entra
  tracciato nella skill (punto 2), ciò che si rigenera resta gitignorato.

**Fuori, e ci lavora un'altra chat**: `HOWTORUN.md`, `agenti/launchpad/**` e
`fornodoro/docs/**` sono di P.7f. Fuori anche: `CANTIERE.md` (della direzione), il pilota
(`C:\Users\Utente\Desktop\fornodoro`) che qui **non serve nemmeno in lettura**, ogni altra
skill, `C:\Users\Utente\Desktop\Informatica` (mai, per nessun motivo).
**Niente Docker, niente stack: questo pacchetto è tutto file, fetch locali e test.
Non si pubblica niente. Nessun `git push`.**

## Perché esiste questo pacchetto

P.6-P3 ha chiuso bene e ha dichiarato **tre MANCANTI onesti**, che sono questo mandato:

1. **Le ~900 righe nuove di P.6-P3 non le ha guardate nessun perito.** Il suo tribunale — sei
   periti, 48 rilievi con ESLint, knip, jscpd e batteria tutti verdi — è stato il primo atto,
   quindi ha processato il codice **com'era prima** delle sue stesse correzioni e aggiunte
   (`--scadenza`, le cinque voci di D21, i quattordici passi). È la stessa frase che il
   collaudo P.6-P2 aveva scritto del costruttore. Precedente da tenere davanti: **sette
   convocazioni su sette skill, sette volte rilievi veri con tutti gli strumenti statici
   verdi** — e P.7e ha appena misurato che la correzione di una classe di difetto può
   **reintrodurre la stessa classe** (due regressioni sue trovate dal concilio, zero dalle
   776 asserzioni). Aspettati che trovi.
2. **`code-maniac scan` non è mai stato eseguito sulla skill** — la batteria deterministica
   sì, pezzo per pezzo, ma non è la stessa cosa e P.6-P3 l'ha detto.
3. **Il banco del collaudo vive solo su questo disco** (decisione **D25** della direzione,
   2026-08-07). `banco-prova-collaudo-sd/` è gitignorato e contiene `banco-sl.mjs`,
   `giro.mjs`, `giro-costruttore.mjs`, `uno.mjs`: la correzione al buco di riproducibilità
   che P.6-P3 ha trovato rompendolo (il comando documentato in testa cancellava certificato
   e handoff, cioè i due documenti che il gate legge) **non è in nessun commit**. Il «VERDE
   14/14» del banco e le 42 classi di sabotaggio sono affermazioni che solo questa macchina
   sa rifare: la §25 di `DECISIONI.md` le chiama ricordi, non prove. La forma giusta è già
   in casa due volte: `scripts/banco.mjs` di questa stessa skill (25 classi del costruttore)
   e `banco.mjs` di launchpad, requisito permanente dal suo P3.

## Il lavoro

### 1. Il tribunale, come primo atto

Prima di spostare qualunque file: convoca `/code-inquisition` sul codice che P.6-P3 ha
scritto o riscritto — i commit `78fed32 · f7a9528 · 57cfc39 · c931c56 · 036eaaf · fc5c0f6 ·
88f4d72 · ed2d2dc` (leggili con `git show --stat` per il raggio esatto; sono
`servito-lib.mjs`, `conformita-lib.mjs`, `verify.mjs` e i loro test). Rito come P.7c l'ha
codificato: `--allow-exec`, **chi scrive un rilievo non lo certifica**, ogni rilievo con la
prova a fianco.

Poi, per ogni rilievo: **riprodotto prima di essere corretto** (input ostile vero, non
fixture modellata sull'implementazione — è la lezione delle quattro istanze del parser),
chiuso con un test nella forma d'input vera, **oppure** dichiarato aperto con la ragione e
il proprietario. Un rilievo alla volta, un commit ciascuno.

Occhio particolare a: la chiusura della chiave universale (`DENTRO_TAG`) — il perito n°5 di
P.6-P3 ha già trovato una quadratica peggiorata 2,6× da quella correzione, e la classe
potrebbe non essere finita; i rami di `--scadenza` dentro i cicli (i quattro `args` trovati
dai guardiani all'ultimo giro); e le due voci che P.6-P3 ha lasciato aperte **di proposito**
(`terziDi` che confronta l'host e non lo schema; il multilingua di Next mai misurato) — non
chiuderle di corsa: se un rilievo le tocca, la decisione resta scritta com'è, con la data.

### 2. D25: il banco entra in regia

Prova prima: incolla `git check-ignore -v banco-prova-collaudo-sd/banco-sl.mjs` e l'elenco
dei file della cartella — la prova che oggi il banco-sorgente non è tracciato.

Lavoro: gli script che **generano** il banco entrano tracciati nella skill (decidi tu la
collocazione — `scripts/` accanto a `banco.mjs` del costruttore, o una sottocartella
`collaudo/` — e dichiara il perché nel verbale; aggiorna i percorsi che i file citano in
testa). Ciò che gli script **rigenerano** (le cartelle `studio-legale/`, `sabotato/`,
`banco-costruttore/`, gli artefatti) resta gitignorato: il banco è i suoi sorgenti, non i
suoi prodotti. Decidi tu, e scrivilo, che cosa è sorgente e che cosa è scoria — `uno.mjs` e
`giro-costruttore.mjs` compresi.

Falsificazione, nell'ordine:
1. da percorso **tracciato**, in una cartella temporanea fuori dal repo, il banco si
   rigenera da zero e il gate ci chiude **VERDE 14/14** — incollato;
2. seconda corsa sul banco già fatto: stesso verdetto — incollato;
3. **almeno 5 delle 42 classi di sabotaggio rilanciate e rosse**, scelte tue ma con
   almeno una per la chiave universale e una per la scadenza;
4. il comando documentato in testa a `banco-sl.mjs` è quello che hai davvero lanciato
   (è il comando che mentiva prima: adesso deve dire il vero).

### 3. code-maniac scan

`code-maniac scan` sulla skill, esito **registrato per intero** nello STATO: ogni passo che
non può girare vale MANCANTE col suo nome, mai PASS. Se trova cose vere, rientrano nel
punto 1 (riprodotte, chiuse o dichiarate).

### 4. STATO e verbale

- `STATO.md`: la §Cosa resta aggiornata — le voci del banco e del tribunale si chiudono se
  chiuse; `terziDi` e il multilingua restano con la motivazione; i rilievi del tribunale
  rimasti aperti elencati uno per riga con dove, cosa e verso.
- Verbale `agenti/site-doctor/P6-P4-<data>.md`: rilievi con prima/dopo incollati, la
  decisione sulla collocazione del banco, e la sezione **«Cosa resta MANCANTE, col suo
  nome»**.

## Come chiudi

- Batteria della skill **sopra 264, zero falliti** (`npm test` con
  `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` — le batterie vogliono Node 21+;
  il reporter stampa `ℹ tests N` su Node 24 e `# tests N` su Node 20).
- Guardiani sulla skill incollati: ESLint, knip, jscpd, gitleaks, semgrep (i 5
  `detect-non-literal-regexp` già scritti nello STATO: o chiusi o riconfermati con la
  ragione).
- Gate della regia `node scripts/verifica-regia.mjs` **VERDE 5/5** prima e dopo.
- Un commit per punto, pathspec, come sopra.

**Non indebolire mai una regola per far passare un test.** Se un rosso sopravvive, il
verbale dice **di chi è**. Ogni numero che dichiari deve essere uscito da un comando che hai
lanciato tu, in questa chat.
