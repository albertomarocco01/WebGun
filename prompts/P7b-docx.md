# Mandato P.7b — Il documento madre torna a dire il vero

> Emesso dal direttore dei lavori il 2026-08-03. Da incollare in una chat operaia nuova.
> **Modello consigliato: Sonnet 5 · effort high** (D4: minuteria ben specificata).
> Contabilità: `CANTIERE.md` (decisione D8).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. `Web Gun.docx` è il
**documento madre**: si modifica **solo in Word, e lo fa Alberto**. `webgun_content.txt`
è la sua copia leggibile nei diff e **si genera** con `scripts/estrai-docx.ps1`
(`DECISIONI.md` §26): non si scrive mai a mano. Oggi il docx è rimasto indietro sul
repo — dichiara ancora stati vecchi (es. schema-forge a una versione superata, agenti
«da creare» che sono skill vere e collaudate).

## Leggi prima

1. `CLAUDE.md`; `DECISIONI.md` §3 e §26; `CANTIERE.md` (decisione **D8**).
2. La verità sugli stati: `README.md` (tabella §Natura degli agenti **e** note a piè
   di pagina) e gli `STATO.md` in `agenti/*/STATO.md`.
3. `webgun_content.txt` com'è oggi.

## Procedura

1. **Fotografa**: rilancia `scripts/estrai-docx.ps1`; se il txt cambia, committalo
   (è la fotografia fedele del docx attuale, giusta o sbagliata che sia).
2. **Confronta e proponi**: confronta il contenuto del docx (via txt) con la verità del
   repo e scrivi **in chat, per Alberto**, la lista puntuale delle correzioni:
   *riga attuale → riga proposta*, ognuna con la fonte (`STATO.md` o README). Dove il
   repo non dice, **chiedi** — non inventare.
3. **STOP**: Alberto apre Word e applica le correzioni che condivide. Tu aspetti.
4. **Richiudi il cerchio**: al suo «fatto», rilancia `estrai-docx.ps1`, verifica che le
   righe nuove compaiano nel txt, e committa con un messaggio nello stile della casa.

## Coordinamento (D8 — altre chat lavorano in parallelo)

- Perimetro di scrittura: **solo `webgun_content.txt`** (e `scripts/estrai-docx.ps1`
  soltanto se è rotto, dichiarandolo nel verbale). Il `.docx` lo tocca solo Alberto.
- **Non toccare**: `CANTIERE.md`, `README.md`, `agenti/**`, `prompts/`, `scripts/` di
  radice (P.7a ci sta lavorando).
- Committa **solo il txt** con `git add webgun_content.txt` — mai `git add -A`, mai
  `git commit -a`: l'index è condiviso con le altre chat.

## Verbale di chiusura

1. la lista delle correzioni proposte e quali Alberto ha applicato;
2. la sintesi del diff del txt (prima/dopo);
3. riga finale: `P.7b consegnata. Il txt è rigenerato dal docx aggiornato: sì/no —
   righe rimaste vecchie: <elenco o nessuna>.`
