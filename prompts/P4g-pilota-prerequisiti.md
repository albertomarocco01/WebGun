# Mandato P.4g — Il pilota diventa pubblicabile: i due bloccanti e le minuterie della catena

> Emesso dal direttore dei lavori il 2026-08-06. Da incollare in una chat operaia
> nuova, aperta da terminale esterno **nella radice del pilota**
> `C:\Users\Utente\Desktop\fornodoro`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` della regia, riga **P.4g**; decisioni **D8, D14, D17**.
> La regia è `C:\Users\Utente\Desktop\WebGun`.

## Perché esisti

P.4 è chiusa (cinque anelli, cinque gate verdi) e P.4f ha pagato i due debiti
verso monte. Restano **due bloccanti dichiarati per la pubblicazione**, scritti
da agenti diversi in momenti diversi, e nessuno dei due si chiude da dentro un
anello: sono trasversali. Finché stanno lì, il pilota non è pubblicabile — e in
parallelo, in un'altra chat, sta nascendo **launchpad**, il cui gate deve
rifiutare di pubblicare questo sito **proprio per questi motivi**.

Tu sei quello che glieli toglie da sotto i piedi. Se fai bene il lavoro, il suo
gate passa da rosso a verde **per la tua correzione**: è la prova che quel gate
misura invece di dichiarare, e vale per entrambi.

## Regola di regime: **arrivi in fondo da solo** (D14)

Nessuna domanda al committente. Ogni scelta la prendi tu e la scrivi nel verbale
con la motivazione in una riga (tabella in testa, come i verbali di P.4d e
P.4e). **Eccezione che resta**: se un passo distrugge dati o è irreversibile, ti
fermi, lo scrivi, e proponi la strada non distruttiva.

## Prerequisito — leggi prima

`docs/DEBITO-TECNICO.md` (le voci **27**, **32**, **10**, **30**, **36**, e
scorri le altre: alcune si chiudono da sole con queste), i cinque handoff
(`07` aggiornato da P.4f, `08`, `10`, `12`, `13`), e nella regia il verbale di
catena `PILOTA-2026-08-06.md` **§6**.

**Stato all'emissione**: stack `fornodoro` acceso (api 7621, db 7622), app di
produzione viva sulla **3621**, cinque gate verdi rilanciati dal direttore sulla
build `mRBe6eqMjjl0W5m2tfJ24` dopo l'`evolve` di P.4f. È la linea di partenza:
qualunque cosa non sia verde alla fine è tua.

## Il lavoro

### 1. n°27 — il seed di produzione non porta account (bloccante)

`supabase/seed.sql` crea `titolare@fornodoro.it` e `cucina@fornodoro.it` con
**`password123`**, in chiaro in un file committato. In locale **è la loro
funzione**: senza, nessuno prova il gestionale, e la batteria di flow-sentinel
conia le sue sessioni proprio con quelle (dichiarato in `docs/flussi-critici.md`
§Assunzioni). Quindi **non si tratta di cancellarli**: si tratta di **separare
il seed di sviluppo da quello di produzione**.

La strada la scegli tu e la dichiari. Quali che siano i dettagli, alla fine
devono essere vere tutte e cinque queste cose, e ognuna va **misurata**:

1. `supabase db reset` su questa macchina continua a produrre lo **stesso stato
   di sviluppo** di oggi — conteggi identici, e la batteria E2E resta verde
   (22 test). Il seed è **idempotente e rieseguibile a caldo**: P.4a l'ha provato
   tre volte con stati e conteggi identici, **non regredire**.
2. Esiste un percorso di popolamento **senza account cablati** che una macchina
   di produzione può usare, e la sua procedura è scritta dove chi pubblica la
   trova (candidato naturale: il runbook che launchpad sta progettando — ma non
   dipendere dal suo lavoro: scrivila nel pilota).
3. **Nessuna password in chiaro** resta in un file che il percorso di produzione
   legge. Provalo con `grep`, e incolla l'uscita.
4. Le credenziali di sviluppo restano dichiarate **dove servono** (la batteria
   deve continuare a sapere come coniare le sessioni) e **dichiaratamente di
   sviluppo**: un file che si chiama come ciò che è.
5. `docs/flussi-critici.md` §Assunzioni resta **vero**. È un contratto firmato:
   se la tua modifica lo rende falso, la riga si corregge **sopra la firma**,
   dichiarando la correzione — è la forma che questo cantiere usa già
   (`docs/gestionale.md` §12).

### 2. n°32 — il sito non si costruisce su Node < 22 (bloccante, alto)

Misurato: `@supabase/supabase-js` costruisce sempre un `RealtimeClient`, che
risolve il costruttore WebSocket in modo eager; su Node < 22 non esiste
`WebSocket` nativo e **solleva** (`websocket-factory.js:86`). `/`, `/menu` e
`/chi-siamo` sono statiche e chiamano il client **durante `next build`**: su
Node 20 **la build fallisce**, non il sito. Oggi non si vede solo perché il
processo sulla 3621 è acceso col Node 24.

Tre livelli, e li vuoi tutti e tre perché coprono momenti diversi:

- **Dichiarato**: `engines` in `package.json` dice `>=22` (oggi non dice
  niente). Da solo npm non lo fa rispettare, e va detto.
- **Fatto rispettare**: la scelta è tua (`.npmrc` con `engine-strict`, un
  controllo che fallisce presto con un messaggio chiaro, o entrambi). Il criterio
  è che **chi sbaglia versione lo scopra subito e con un messaggio che dice cosa
  fare**, non con `Node.js detected but native WebSocket not found`.
- **Provato nelle due direzioni**, ed è la parte che conta: col node di sistema
  (20.12.2) la build o l'installazione **fallisce con il tuo messaggio**; col
  Node 24 (`~/scoop/apps/nodejs-lts/current/node.exe`, o quel percorso in testa
  al `PATH`) va a buon fine. **Incolla entrambe le uscite.**

Attenzione al confine: **i gate girano col node di sistema** e non compilano il
sito (fanno richieste HTTP a un processo già acceso). La tua difesa non deve
rendere rossi i gate. Se lo fa, hai fatto rispettare la versione nel posto
sbagliato — e questa è esattamente la classe di errore del debito n°10, dove per
tre anelli **la causa è stata attribuita al pacchetto sbagliato**.

### 3. Le minuterie che la catena ha lasciato

Piccole, ma ognuna è un difetto vero misurato da qualcuno:

- **`tsconfig.tsbuildinfo` è tracciato da git**: artefatto di build che sporca
  ogni diff. In `.gitignore`, e rimosso dall'indice **senza cancellarlo dal
  disco** (`git rm --cached`).
- **n°30, i fine-riga**: si è avverato due volte (P.4f ha trovato quattro file a
  CRLF). Chiudilo alla radice invece di ripulire a mano — un `.gitattributes`
  che dichiari il trattamento, e la prova che dopo un `git add` il file non
  cambia più modo. Se decidi che non si chiude, scrivi perché.
- **Il resto di `docs/DEBITO-TECNICO.md`**: rileggilo per intero e chiudi quello
  che **si chiude in mezz'ora e non appartiene a un'altra skill**. Per ogni voce
  che tocchi: chiusa **con la misura** (prima → dopo), oppure lasciata con una
  riga che dice di chi è. **Non gonfiare il registro chiudendo voci a parole**:
  in questo cantiere una voce chiusa senza misura è peggio di una voce aperta.

Quello che **non** è tuo: n°4 e n°17 (tetto ai tentativi: sono prescrizioni del
proxy, vanno nel runbook di launchpad) e n°36 (la prova di concorrenza fuori dai
gate: è una lacuna della **skill** schema-forge, e sta nel suo `STATO.md`).

## Gate — la prova che vale il pacchetto

Alla fine **tutti e cinque verdi, rilanciati da te**, sulla build ricostruita:

| gate | note |
|---|---|
| schema-forge 9/9 | il seed cambia: questo è il gate che lo applica davvero |
| flow-sentinel 7/7 | **`--url http://127.0.0.1:3621`** — **22 test devono restare verdi**, ed è la prova che il seed di sviluppo funziona ancora |
| gestionale 7/7 · vetrina 10/10 | app viva, build nuova |
| speed-demon 7/7 | **con Node 24 nel `PATH`**: `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`. Non basta *avviare* `verify.mjs` col Node 24: il gate lancia Lighthouse con **`npx` dal PATH** (`scripts/verify.mjs:416`), quindi è il PATH a decidere. Senza, la categoria SEO resta senza punteggio e il gate blocca correttamente (debito n°31) |

Più `code-maniac scan` pulito, e `/code-inquisition --focus security` sul
percorso del seed: è la superficie dove un errore tuo diventa una consegna di
accessi. Nei cinque anelli il tribunale ha trovato qualcosa **ogni volta**.

**Lascia l'app viva sulla 3621 e lo stack acceso quando finisci**: altre chat
stanno misurando lo stesso sito.

## Coordinamento — ci sono altre tre chat vive (D8, D17)

In parallelo girano **P.7c-ripresa-2**, **P.5** (launchpad) e **P.6**
(site-doctor). Le ultime due **leggono e misurano questo pilota**. Quindi:

- **Il pilota è tuo**: schema, seed, migrazioni, `package.json`, `.gitignore`
  sono di questa chat e di nessun'altra. Ricostruisci pure l'app quando serve, e
  **rilasciala viva alla fine**.
- **Non spegnere lo stack Supabase.** Un `supabase db reset` va benissimo (è ciò
  che fa il gate di schema-forge); uno `stop` no.
- **Nella regia** tocca **solo** il tuo verbale e, se trovi un difetto vero di
  una skill, la **riga** nel suo `STATO.md` (la riga, non la correzione: la
  correzione la decide il proprietario). Mai `CANTIERE.md`, `prompts/`, le
  skill, i banchi, il docx.
- Commit **solo dei tuoi percorsi** con `git add` espliciti — **mai `-A`, mai
  `commit -a`**: nella regia l'index è condiviso. Se `index.lock` è occupato,
  aspetta e riprova; non cancellarlo.
- Commit **piccoli e frequenti**, uno per punto chiuso. Se la corsa si ferma,
  committa quello che c'è con `WIP` nel titolo.

## Verbale

`agenti/schema-forge/PILOTA-PREREQUISITI-2026-08-<gg>.md` nella regia, con la
tabella delle scelte autonome in testa, le uscite **incollate** (le due
direzioni del Node, il `grep` sulle password, i cinque gate, i 22 test), e una
sezione finale: **«cosa resta fra il pilota e il suo pubblico»** — l'elenco
onesto di ciò che ancora impedisce di pubblicare, che sia tuo o di altri.

## Riga finale del verbale

`P.4g consegnata. I due bloccanti del deploy sono chiusi con la misura (<come>),
le minuterie <n> chiuse e <n> attribuite, e i cinque gate del filo sono verdi
sulla build <id>. Il debito è passato da <n> a <n> voci.`
— o la verità, se è un'altra.
