# Mandato P.4-pre — La strada per un progetto fuori dalla regia

> Emesso dal direttore dei lavori il 2026-08-04. Da incollare in una chat operaia
> nuova. **Modello consigliato: Sonnet 5 · effort high** (minuteria meccanica ben
> specificata, profilo D4).
> Contabilità: `CANTIERE.md`, riga **P.4-pre**, decisioni **D10** e **D11**.
> Piano di riferimento: `prompts/P4-piano.md` §5 e §9 — leggilo, questo mandato ne è
> l'esecuzione, non il riassunto.

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto
apre la strada a **P.4**, il filo completo: un progetto pilota che vive in un **repo
separato** (D11) e che le cinque skill attraverseranno in sequenza. Quattro cose non
sono mai state provate, e ognuna fermerebbe la catena a metà se scoperta dopo. Tu le
provi **prima**, quando costano un'ora invece di una catena.

Non costruisci il pilota. Non tocchi le skill. Fai in modo che, quando P.4a partirà,
la strada esista.

## Leggi prima

1. `CLAUDE.md`; `CANTIERE.md` (riga P.4-pre, decisioni **D8**, **D10**, **D11**).
2. `prompts/P4-piano.md` — **§5** (i cinque rischi mai misurati) e **§9** (i cinque
   deliverable che stai per eseguire). Il §4 contiene la riga di firma esatta.
3. `DECISIONI.md` §16 (i rossi strutturali) e §26 (il gate della regia).
4. `scripts/regia-lib.mjs`, la regola `skill-elencate` e la funzione `skillDaPs1`:
   è il guardiano che il tuo deliverable 1 deve lasciare verde.

## Deliverable

### 1. `scripts/installa-skill.ps1` impara una destinazione

Parametro **opzionale** `-Destinazione <percorso>`; senza parametro il comportamento
è **identico a oggi** (`$radice/.claude/skills`, con `$radice` = la regia). Con il
parametro, le junction nascono lì e puntano sempre a `WebGun/agenti/<nome>` — la
fonte di verità non si sposta: è tutto il punto delle junction.

Tre cose che si rompono facilmente, dette prima:

- In PowerShell il blocco `param()` deve essere la **prima istruzione eseguibile**
  dello script: i commenti sopra vanno bene, `$ErrorActionPreference` (oggi riga 13)
  **no**. Se lo metti dopo, lo script muore con un errore di parsing.
- Il gate della regia legge l'array `$skill = @("…")` con la regex di
  `skillDaPs1` (`regia-lib.mjs:243`). **Non cambiare la forma dell'array.** Se la
  cambi, `skill-elencate` smette di trovare l'elenco — e «elenco non trovato» non è
  «elenco vuoto», quindi il gate non diventa rosso: diventa **cieco**.
- Il percorso di destinazione può non esistere ancora (il repo pilota è nuovo):
  crealo, come già fa per `.claude\skills`.

**Prova, due direzioni**: senza parametro le junction finiscono dove finivano ieri;
con `-Destinazione` finiscono dove hai detto tu e sono junction vere (`Get-Item …
| Select LinkTarget`, non «esiste una cartella»). E il gate della regia
(`node scripts/verifica-regia.mjs`, col `node` di sistema) resta **VERDE 5/5** —
incollane l'uscita, prima e dopo.

### 2. Prova che un gate parla da fuori dall'albero della regia

Mai fatto: *tutti* i banchi sono sempre stati dentro `WebGun/`. Letto il codice, i
cinque gate reggono (separano `SKILL_DIR`, da `import.meta.url`, da `process.cwd()`,
che è il progetto), ma «letto il codice» non è una misura.

Da una cartella qualsiasi **fuori** da `WebGun/` (va bene una cartella vuota, non
serve un progetto vero):

```
node C:\Users\Utente\Desktop\WebGun\agenti\schema-forge\scripts\verify.mjs
```

deve uscire **2 con il messaggio** — «questa non è la radice di un progetto», o quel
che dice — e **mai `0` muto**: l'uscita 0 senza righe è esattamente la regressione
che P.0-igiene ha chiuso, e riaprirla qui la renderebbe invisibile.

Ripeti per tutti e cinque i gate. Poi la prova che vale doppio: **speed-demon
invocato dalla junction**, `C:\...\WebGun\.claude\skills\speed-demon\scripts\verify.mjs`.
È l'unico gate che esce dalla propria cartella — `AGENTI_DIR = dirname(SKILL_DIR)`,
perché `rete-verde` lancia il gate di flow-sentinel come sottoprocesso — e dalla
junction `AGENTI_DIR` diventa `.claude/skills`. Lì dentro flow-sentinel **c'è** (è in
elenco), quindi può anche funzionare: dillo con l'uscita, non con la lettura.

Se dalla junction si rompe, **non aggiustarlo di nascosto**: è un difetto vero di
speed-demon, va misurato, scritto nel verbale e nel suo `STATO.md`, e la correzione
la decide il direttore. Attenzione: `speed-demon/scripts/gate-lib.mjs` è stato
riscritto da P.7c (deliverable 2, complessità) — lavora su quello **committato**,
e cita la regola per nome, non per numero di riga.

### 3. Prova che la firma di una persona vera passa

Prima volta nella storia del repo che la riga di conferma porta un nome proprio.
Non è teoria: fra i 17 difetti del collaudo avversario di speed-demon c'era il gate
che **rifiutava** `Confermato da: Alberto Marocco, sviluppatore` e **accettava**
`ORCHESTRATORE`. È stato corretto; sulla carta oggi passano tutte e tre le regole
(speed-demon `RIGA_CONFERMA` con `(.+)`, flow-sentinel con `(\S.*?)`, vetrina-crafter
per `valoreRiga` più `dataConfermaDa`). **Si prova lo stesso.**

La riga esatta, quella del §4 del piano, con una data ISO vera:

```
Confermato da: Alberto Marocco (committente) il 2026-08-05
```

Su un contratto **minimo** per ciascuno dei tre (rispettivamente `docs/performance.md`,
`docs/flussi-critici.md`, `docs/vetrina.md`: il template di ognuna dice la forma), da
una cartella di prova usa e getta:

- **accettata** da tutti e tre — e per vetrina-crafter la data va **letta**
  (`dataConfermaDa` la ricava dal testo, non dal filesystem: verifica che ne esca
  `2026-08-05` e non `null`);
- **rifiutata** quando al posto del nome resta il segnaposto `{{…}}` del template.

Due direzioni, come si fa qui. Il passo che valuta la firma può essere l'unico che
gira (gli altri passi falliranno per assenza di progetto): va benissimo, quello che
conta è **quel** verdetto, e si legge nell'uscita, non si presume.

### 4. Porte e stack

Il pilota vuole il suo stack Docker e le sue porte: vetcare occupa 57321/57322,
controtempo e valscura le loro. **Scegli due porte libere** (verificate libere:
`netstat`/`Test-NetConnection`, non «sembrano libere») e **scrivile nel verbale** —
il `config.toml` del pilota lo scriverà P.4a, ma il numero lo fissi tu, adesso.

Precedente del 2026-07-30, per cui questo punto esiste: una porta dichiarata in un
documento firmato ha fatto misurare **il sito di un'altra azienda**.

Poi spegni i banchi che non servono (`supabase stop` nella loro radice): P.4e misura
tempi, e li misura su questa macchina. Elenca nel verbale cosa hai spento e cosa hai
lasciato acceso, con il motivo.

### 5. Verbale

`PILOTA-PRE-2026-08-<gg>.md` alla radice della regia. Breve. Per punto: cosa hai
provato, con quale comando, e **l'uscita incollata**. Nessuna riga di `CANTIERE.md`:
la contabilità la scrive il direttore al ritorno.

## Coordinamento (D8)

- **Non toccare**: `agenti/vetrina-crafter`, `agenti/speed-demon`,
  `agenti/gestionale-crafter`, `CANTIERE.md`, `prompts/`, `webgun_content.txt`,
  i banchi `banco-prova-*` (a parte spegnerli).
- Il tuo perimetro di **scrittura** è: `scripts/installa-skill.ps1`, il verbale nuovo,
  e — solo se il deliverable 2 trova un difetto vero — la riga di `STATO.md` della
  skill che lo ha (il codice **no**: quella correzione la decide il direttore).
- Committa **solo i tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.
- Batterie `node --test` con `~/scoop/apps/nodejs-lts/current/node.exe`; i gate col
  `node` di sistema (è il punto: si prova come lo lancia un umano).

## Riga finale del verbale

`P.4-pre consegnata. La strada esiste: installa-skill.ps1 accetta -Destinazione (gate
regia VERDE 5/5), i cinque gate escono 2 col messaggio da fuori dall'albero
(speed-demon dalla junction: <esito>), la firma di Alberto passa i tre gate che la
leggono e il segnaposto no, porte del pilota <a>/<b> libere.` — o la verità, se è
un'altra.
