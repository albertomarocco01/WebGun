# P.6-P5 — I falsi verdi capitali, la quadratica, e la riga dei contrasti

> **Modello consigliato: Opus 5 · effort high.** Chat operaia, perimetro in
> scrittura: **`agenti/site-doctor/**` e nient'altro**. Data di emissione:
> 2026-08-07. Mandato della direzione lavori; per D14 va **fino in fondo da
> solo** — dove serve una firma su un verbale, la forma è
> `Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il <ISO>`.

## Chi sei e cosa NON fai

Sei la chat operaia di P.6-P5. Correggi **dieci rilievi** del tribunale di
P.6-P4 dentro la skill site-doctor. Non tocchi nient'altro:

- **Il pilota (`C:\Users\Utente\Desktop\fornodoro`) non si apre. Nemmeno in
  lettura.** Il rilancio dei gate sul pilota è della direzione, al tuo ritorno.
- **Nessun `git push`, nessuna pubblicazione, nessun account, nessun deploy.**
- **Nessun Docker, nessuno stack Supabase**: non ti servono. Quello del pilota
  è acceso e non lo tocchi.
- `C:\Users\Utente\Desktop\Informatica` non si tocca. `Web Gun.docx`,
  `banco-prova-vetcare/`, `agenti/code-maniac`, `agenti/code-inquisition`,
  `agenti/bugbay` sono snapshot: non si modificano.
- Commit **solo** con `git commit -F - -- <i tuoi percorsi>` (D19): mai `-A`,
  mai `-a`, mai un commit nudo, mai `git stash`. Se trovi `index.lock`,
  **aspetti**: altre chat committano nello stesso repo. Mai `git reset --hard`,
  mai `git checkout --` su file che non hai scritto tu.
- I messaggi di commit nella lingua e nella forma di casa (guarda `git log`),
  firmati `Co-Authored-By:` col **tuo** modello, come fanno gli altri.

## Da leggere prima di toccare qualsiasi cosa

1. `agenti/site-doctor/P6-P4-2026-08-07.md` — **per intero**. La §6.1 è il tuo
   elenco di lavoro: ogni rilievo che chiudi sta lì con dove/cosa/verso, e i
   periti hanno lasciato input di riproduzione nel verbale.
2. `agenti/site-doctor/STATO.md` e `SKILL.md` (contratti e prezzi dichiarati).
3. `agenti/site-doctor/scripts/banco-sl.mjs` — la testa del file: il comando
   del giro completo. E `giro.mjs`, `uno.mjs`: come si lancia una classe.
4. Le due lezioni misurate che governano questo mandato:
   - **Correggere una classe la può riaprire** — P.6-P4 ne ha contate **tre**
     (ADS + separatore su `ed2d2dc`; `sciogliEntita` su `ID_PIU_LUNGO`), tutte
     da correzioni giuste ma **strette al caso trovato**.
   - **Una correzione può peggiorare un costo** — la chiusura della chiave
     universale del `>` ha reso una scansione **2,6× più lenta** (P2-R8), e
     l'ha trovato chi ha **riletto il file dopo**.

## Le regole di ogni chiusura (valgono per tutti i dieci punti)

1. **Riprodotto prima.** Ogni rilievo si riproduce con input ostile vero
   (quello del perito, o ricostruito dalla sua descrizione) **prima** di
   toccare il codice. Se non si riproduce, fermati e scrivilo: non correggere
   ciò che non hai visto rosso.
2. **Un test nella forma d'input vera**, non modellato sull'implementazione.
   Falsificazione contro **`git show HEAD:`** (l'originale vero), mai contro
   una de-correzione a mano: P.6-P4 ha misurato che una de-correzione parziale
   lascia passare un test e non prova niente.
3. **La domanda della porta diversa, scritta nel verbale.** Per ogni chiusura:
   *«per quale porta diversa si entra nella stessa stanza?»* — e la risposta,
   anche quando è «non ne ho trovate, ho provato queste tre». È la domanda che
   ha prodotto il rilievo migliore delle ultime due tornate.
4. **I costi si rimisurano dopo.** Ogni funzione toccata da una correzione si
   ricronometra sugli stessi input che l'hanno provata prima. Un rosso chiuso
   che apre un 2,6× va dichiarato, non scoperto dal prossimo.
5. Un criterio che scopri **impossibile dal tuo perimetro**: fermati e
   scrivilo nel verbale, non «sistemarlo». (P.7f l'ha fatto due volte su
   criteri sbagliati della direzione, e ha fatto bene.)

## I dieci punti

### 1. La riga che tiene il conteggio a «3 da guardare»

`conformita-lib.mjs:70` (`SCOPERTE.contrasti`) e il `scoperta:` che la
richiama (riga 86). Il commento sopra la costante prescrive la prova:
*«la si toglie rilanciando il `grep`, non fidandosi di un handoff»*.

**Rilancia il grep tu** — non fidarti nemmeno di questo mandato:

```
grep -rl -i "contrast" agenti/speed-demon/ --exclude-dir=node_modules | grep -v "\.test\."
```

Atteso (misurato dalla direzione a regia `a1454cf`): **4 file** —
`gate-lib.mjs` (esporta `letturaContrasto`, `esitoContrasto`,
`findingsContrasto`, `statoContrasto`, `dettaglioContrasto`), `verify.mjs`
(passo `id: "contrasto"`), `SKILL.md`, `STATO.md`. Il gate del vicino ha il
passo e sul pilota è verde (verbale `MINUTERIE-2026-08-07.md` §4). Se il tuo
grep dice altro, fermati e scrivilo.

Poi togli la voce da `SCOPERTE` e il richiamo. Atteso sul banco: il passo
`proprieta' delle voci` scende a **«2 da guardare»** (`accessibilita-admin` e
`antispam` restano — quelle scoperte sono vere) e il gate resta VERDE.
Test nei due versi: una voce delegata a un vicino il cui **gate** la guarda
non produce l'issue; una delegata a un vicino che la nomina solo in prosa sì.

### 2. P7-R2 — IBAN e codice fiscale in una pagina che il gate non apre mai

`servito-lib.mjs:590` e `:570`: `collegamentiInterni` legge **solo
`<a href>`**. Il perito ha ottenuto `GATE CONFORMITA': VERDE`, uscita 0, su un
sito che raccoglie IBAN e codice fiscale in una pagina raggiungibile solo via
`<iframe src>`: 1 riferimento navigabile su 7 letti.

L'inventario dei riferimenti che portano un visitatore su una pagina
dell'origine si allarga. Decidi tu la lista esatta e **dichiara ogni
esclusione con il motivo** — i candidati da valutare uno a uno: `iframe src`,
`frame src`, `area href`, `form action` (GET), `meta http-equiv=refresh`,
`link rel=alternate`. Criterio: il sito del perito **entra nella superficie**
e i suoi campi finiscono in `dati-raccolti`; un test tiene la classe.
Porta diversa obbligatoria: quale attributo NON in lista porta ancora un
utente su una pagina non camminata?

### 3. P1-R2 — un attributo sopra i 32 KB cancella la coda del documento

`servito-lib.mjs:316` → `:193`: un `<path d>` SVG oltre il tetto e **tutto
ciò che segue sparisce** — 8 bloccanti → 0, e `dati-raccolti` chiude `n/a`
con premessa misurata e falsa. In più **il commento alle righe 293-295
dichiara un prezzo falso** («un tag viene letto come testo»): correggi anche
il commento — un commento che promette una garanzia inesistente depista chi
legge, ed è rilievo a sé nel verbale di P.6-P4 (§7.3).

### 4. P1-R3 — un apostrofo in un valore non quotato apre la stessa porta

`servito-lib.mjs:307-310`: `data-autore=D'Angelo`. È la **stessa stanza** del
punto 3 con una porta diversa: chiudile **insieme**, con un test ciascuna, e
poni la domanda della terza porta (quali altri caratteri o limiti fanno
perdere al lettore l'allineamento col browser?). Il perito del parser ha
usato Chromium `--dump-dom` come giudice indipendente: fallo anche tu dove il
comportamento del browser è la definizione di «giusto».

### 5. P3-R1 — `formaction`: il gate descrive un sito che non esiste

`servito-lib.mjs:1188` e `:1087`: un `<button type=submit formaction=…>`
consegna nome ed email a un terzo, e il gate stampa **destinazione e gravità
di un altro sito**. Riproduci col banco del perito. Chiudi, e dichiara nel
verbale se la correzione copre anche **P3-R2** (il `<form>` annidato: il
browser tiene l'esterno, il gate l'interno) — se sì con un test, se no
scrivendo che resta aperto: è la stanza accanto, non la stessa.

### 6. P4-R4 + P7-R3 — `<sitemapindex>`: rosso sul formato che Next genera da solo

`servito-lib.mjs:616-626`, `:2126` e `verify.mjs:466`: una `<sitemapindex>`
valida produce **un block per ogni sotto-sitemap**, e i file XML camminano
come pagine. `generateSitemaps()` di Next produce esattamente quel formato:
**ogni prossimo progetto della casa può uscire rosso su un sito conforme**, ed
è così che un gate si fa scavalcare per abitudine.

Correzione: riconoscere l'indice, seguire le sotto-sitemap con un tetto
dichiarato, niente pagine-fantasma in camminata. Due versi: sitemapindex
conforme → verde (test); una sitemap che promette pagine morte → block come
oggi (test che il verso ↓ non si è aperto). Occhio a **P2-R10** (la coda da
223 678 elementi): se il tuo tetto la tocca, dichiaralo; se no, resta aperto
com'era.

### 7. P4-R6 — `livelliTitoli` è cieco alle regioni nascoste, nei due versi

`servito-lib.mjs:1725-1732`: `block` su un accordion corretto, **verde su una
pagina senza h1 visibile**. Un test per verso. Porta diversa: gli altri
lettori che consumano `regioniNascoste` — qualcuno ha lo stesso strabismo?

### 8. P2-R1 + P2-R8 — la quadratica di `DENTRO_TAG` in dodici lettori

`servito-lib.mjs:425` e le undici gemelle. Misura del perito: 1 MB di pagina,
scadenza predefinita 300 s → **554 s reali**, 12 passi su 14 MANCANTI. Il
rimedio esiste **già nel file**: `tagApertiIn`, misurato 0,0-0,2 ms sullo
stesso input, applicato al solo `tagDi`.

Portalo a **tutti** i lettori. Prima riproduci la curva (basta un input che
mostri la crescita, non servono 554 s); dopo, **rimisura sugli stessi input**
— compreso quello di P2-R8 (la scansione 2,6× più lenta della correzione del
`>`): quel numero deve scendere e il verbale deve dirlo. E la chiave
universale del `>` **deve restare chiusa**: i test di P.6-P3 su quella classe
sono il tuo controllo di non-regressione.

### 9. P2-R2 — la scadenza sorveglia solo la rete

`verify.mjs:833` e i nove punti gemelli: nessun ciclo di CPU controlla la
scadenza; il passo a11y non riceve nemmeno `args`. Dopo il punto 8 i cicli
costosi si accorciano, ma la classe resta: `--scadenza N` deve essere un
tetto anche quando a bruciare è la CPU.

Porta il controllo nei cicli di lettura (almeno: i passi che iterano su
tutte le pagine). Criterio: un input che prima sforava chiude **entro la
scadenza con un verdetto per ogni passo** — `skipped` col motivo va bene, il
silenzio no (è la promessa di `--scadenza` dal giorno in cui esiste).
Attenzione a **P5-R3** (la scadenza oggi è un *minimo*: `--scadenza 30` →
52,8 s): se la tua correzione lo chiude, dichiaralo con la misura; se lo
lascia, non peggiorarlo — rimisura.

### 10. A valle di tutto: il giro completo, per la prima volta tutto intero

- `node giro.mjs` — **le 42 classi**, comprese le 34 mai rimisurate dopo le
  correzioni di P.6-P4. Attese: le rosse rosse **sui passi giusti**, le dieci
  verdi dichiarate verdi. Ogni scarto: fermati e scrivilo.
- `node giro-costruttore.mjs` — le 25 classi del costruttore, **mai eseguito**
  dopo lo spostamento (P.6-P4 lo dichiara verificato solo per lettura).
- Se un punto sopra ti ha chiesto un sabotaggio che non esiste (es. la classe
  dell'iframe del punto 2), **aggiungila a `banco-sl.mjs`** come classe nuova:
  le classi possono crescere, il giro le prende da `CLASSI`.

## Trappole di macchina (misurate, non ipotetiche)

- Le batterie `node --test` vogliono Node 21+: `node --version` **prima** di
  fidarti del PATH; se serve, `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`.
  Non presumere: misura.
- La porta del giro è 3882 (sotto 49152, fuori dall'intervallo escluso di
  WinNAT 57464-57963). Il giro controlla che sia libera prima di partire e la
  firma `x-banco-sabotaggio` a ogni corsa: **leggi quello che stampa**.
- La tua shell **non deve restare dentro** le cartelle che gli script
  rigenerano: `rmSync` non può cancellare la cartella in cui sei, e il banco
  nasce monco (successo a P.6-P4, documentato nel suo §3.6).
- `jscpd` non gira su Node 20 (`ERR_REQUIRE_ESM`).

## Chiusura del pacchetto

Nell'ordine:

1. Batteria: **sopra 285, zero falliti** (`npm test` dalla cartella della skill).
2. Guardiani sul codice cambiato: ESLint (0 errori), knip, jscpd,
   `gitleaks dir agenti/site-doctor` — e i warning preesistenti restano
   dichiarati tali, non silenziati.
3. Gate del banco dal percorso tracciato: **VERDE 14/14, «2 da guardare»**.
4. Giro 42/42 + giro-costruttore 25/25 (punto 10).
5. Gate della regia: `node scripts/verifica-regia.mjs` dalla radice —
   **VERDE 5/5**, prima e dopo.
6. `STATO.md` aggiornato: cosa è chiuso qui, cosa resta dei 56 (il conteggio
   nuovo, voce per voce — il verbale P6-P4 **non si riscrive**: è un atto; la
   fotografia viva del debito sta nello STATO e nel tuo verbale).
7. Verbale `agenti/site-doctor/P6-P5-2026-08-07.md`: per ogni punto prova
   prima e prova dopo **incollate**, la domanda della porta diversa e la sua
   risposta, i costi rimisurati, e «Cosa resta MANCANTE, col suo nome».
8. Commit pathspec (D19), messaggi di casa.

Poi riferisci alla direzione: esito, misure, scarti dall'atteso — la
direzione rilancia tutto in proprio prima di chiudere, compreso il gate sul
pilota che tu non hai aperto.
