# Mandato P.4-pre — ripresa (D2 → D5)

> Emesso il 2026-08-04, sera. Da incollare in una chat operaia nuova, aperta da
> **terminale esterno** nella radice `C:\Users\Utente\Desktop\WebGun`.
> **Modello consigliato: Sonnet 5 · effort high** — invariato dal mandato originale
> (minuteria meccanica ben specificata, profilo D4).
> Contabilità: `CANTIERE.md`, riga **P.4-pre**, decisioni **D10** e **D11**.

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Riprendi il
pacchetto **P.4-pre**, lasciato a un quarto del guado. Il mandato integrale è
`prompts/P4-pre-strada.md`: **leggilo, è quello il contratto**. Questo foglio dice
soltanto da dove riparti e cosa è cambiato sotto i piedi nel frattempo — non lo
riassume e non lo sostituisce.

## Da dove riparti

Il **deliverable 1 è chiuso e committato**: `7eb736b` — *«Le junction imparano a
nascere fuori dalla regia, che resta la loro unica sorgente»*. `installa-skill.ps1`
accetta `-Destinazione`, l'albero di lavoro è pulito, non c'è niente in sospeso da
recuperare.

**Prima di credermi, verifica**: `git log --oneline -3` e `git status --short`. Se
l'albero non è pulito, fermati e dillo: qualcuno ha lavorato dopo di me.

Restano quattro deliverable, nell'ordine del mandato:

| | Deliverable | Stato |
|---|---|---|
| 1 | `installa-skill.ps1` impara `-Destinazione` | **fatto** (`7eb736b`) |
| 2 | I cinque gate parlano da fuori dall'albero della regia | da fare |
| 3 | La firma di una persona vera passa i tre gate che la leggono | da fare |
| 4 | Porte del pilota e spegnimento banchi | **parzialmente fatto, vedi sotto** |
| 5 | Verbale `PILOTA-PRE-2026-08-<gg>.md` | da fare |

Sul **2** c'è un avvertimento del mandato che vale la pena ripetere, perché è la
trappola dell'intero pacchetto: un gate che esce **0 muto** non è un gate che passa,
è la regressione che P.0-igiene ha chiuso. Pretendi **uscita 2 con il messaggio**.
E se speed-demon dalla junction si rompe, **non aggiustarlo**: si misura, si scrive,
decide il direttore.

## Cosa è cambiato sotto i piedi

Il 2026-08-04 la macchina di sviluppo è andata in saturazione di memoria: finestre
dell'IDE uccise dal gestore di memoria di Windows (`0xE0000008`), sistema
inutilizzabile. Causa: **trenta container Supabase accesi insieme** — i tre banchi
`valscura`, `controtempo`, `vetcare` — su una macchina da 16 GB con il tetto di
commit a 21,6 GB. Margine residuo prima del collasso: 1,1 GB.

Tre conseguenze che ti riguardano:

1. **I tre banchi sono già spenti**, con `supabase stop --project-id <nome>` e quindi
   **con backup**: i dati sono nei volumi, `supabase start` li riprende. Questo è
   metà del tuo deliverable 4: nel verbale scrivi che sono spenti tutti e tre, con
   questo motivo e questa data. Il *perché* conta quanto il *cosa*: P.4e misurerà i
   tempi su questa macchina, e li misurerà male se qualcuno li riaccende per
   distrazione.

2. Esiste ora `C:\Users\Utente\.wslconfig`: WSL è limitato a **5 GB** di RAM con
   `autoMemoryReclaim=gradual`. Prima teneva 3 GB anche a container fermi e non li
   restituiva mai. Se un giorno un `supabase start` muore per memoria, il colpevole
   è quel tetto — si alza lì, consapevolmente, non si toglie.

3. **Non riaccendere più di un banco alla volta.** Uno stack costa ~1,2 GB. Se per il
   deliverable 3 ti serve una cartella di prova, usane una vuota e usa e getta come
   dice il mandato: non ti serve un banco acceso per provare una riga di firma.

Per il **deliverable 4** restano quindi le **due porte libere** del pilota. Verificale
davvero libere (`Test-NetConnection`, non «sembrano libere»), tenendo presente che
vetcare tiene 57321/57322 e gli altri due banchi le loro — **anche da spenti quei
numeri restano prenotati nei loro `config.toml`**, quindi non riusarli. Il precedente
del 2026-07-30, una porta sbagliata in un documento firmato che ha fatto misurare il
sito di un'altra azienda, è il motivo per cui questo punto esiste.

## Perimetro (D8), invariato

- **Non toccare**: `agenti/vetrina-crafter`, `agenti/speed-demon`,
  `agenti/gestionale-crafter`, `CANTIERE.md`, `prompts/`, `webgun_content.txt`,
  i banchi `banco-prova-*`.
- Scrivi solo: il verbale nuovo, e — solo se il deliverable 2 trova un difetto vero —
  la riga di `STATO.md` della skill che lo ha. Il codice no.
- Committa **solo i tuoi percorsi** con `git add` espliciti: mai `-A`, mai `commit -a`.
  L'index è condiviso.
- Batterie `node --test` con `~/scoop/apps/nodejs-lts/current/node.exe`; i gate con il
  `node` di sistema — è il punto: si prova come lo lancia un umano.

## Riga finale del verbale

Quella del mandato originale, con la verità dentro:

`P.4-pre consegnata. La strada esiste: installa-skill.ps1 accetta -Destinazione (gate
regia VERDE 5/5), i cinque gate escono 2 col messaggio da fuori dall'albero
(speed-demon dalla junction: <esito>), la firma di Alberto passa i tre gate che la
leggono e il segnaposto no, porte del pilota <a>/<b> libere.`

— o un'altra, se la verità è un'altra. Un verbale che descrive un successo che non
c'è stato è peggio di un pacchetto non consegnato.
