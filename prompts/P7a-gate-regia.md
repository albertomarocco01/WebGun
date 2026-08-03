# Mandato P.7a — Il gate della regia

> Emesso dal direttore dei lavori il 2026-08-03. Da incollare in una chat operaia nuova.
> **Modello consigliato: Opus 5 · effort high** (deviazione da D4 dichiarata: è la
> scrittura di un gate, ma della regia — un suo errore non firma siti).
> Contabilità: `CANTIERE.md` (decisione D8).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto
costruisce il **gate della regia** — il controllo che `DECISIONI.md` §26 dichiara
mancante con la frase esatta: *«il posto giusto dove chiuderlo è un gate della regia,
che oggi non esiste»*.

I precedenti misurati che lo giustificano: `webgun_content.txt` **ha mentito per due
giorni** sul contenuto del `.docx` (§26); `installa-skill.ps1` ha elencato **quattro
skill quando erano cinque** (README §Installazione); la junction mancante ha reso
`code-inquisition` **non invocabile** finché qualcuno non se n'è accorto
(`agenti/schema-forge/COLLAUDO-2026-07-26.md` §8.2). Sono tutti difetti della stessa
classe: la regia che racconta un repo diverso da quello che esiste.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`; `CANTIERE.md` (voci del 2026-08-03, decisione **D8**).
2. `DECISIONI.md` §3, §7, §15, §18, §26.
3. `README.md` §Installazione delle skill e §Natura degli agenti;
   `scripts/estrai-docx.ps1`; `scripts/installa-skill.ps1`.
4. Come modello di gate: `agenti/vetrina-crafter/scripts/verify.mjs` (id stabili,
   MANCANTE ≠ PASS, epilogo compatibile Node 20 — **copia quella forma**, mai
   `import.meta.main`) e `agenti/vetrina-crafter/references/verifica-deterministica.md`
   §Il contratto `--json`.

## Deliverable

1. **`scripts/verifica-regia.mjs`** — gate deterministico della regia: passi con `id`
   stabili, `--json` nello stile della casa, uscite 0/1/2, MANCANTE ≠ PASS, bersaglio
   stampato anche sul verde (§11). Candidati — scegli i difendibili, scarta le
   opinioni, e **motiva gli scarti nel verbale**:
   - `docx-txt` — `webgun_content.txt` allineato a `Web Gun.docx`: riestrazione
     **in un file temporaneo** confrontata col tracciato. **Non riscrivere il txt**:
     il gate misura, non corregge (e in parallelo P.7b ci sta lavorando).
   - `skill-elencate` — ogni skill vera di casa (ha `scripts/verify.mjs` sotto
     `agenti/<nome>/`) compare in `installa-skill.ps1` **e** nel README
     §Installazione; gli scaffold no (regola del README: *gli scaffold non si
     installano finché sono scaffold*).
   - `stato-presente` — ogni cartella di `agenti/` di casa ha il suo `STATO.md`
     (gli snapshot esterni si saltano, e si dice quali).
   - `epiloghi-vivi` — nessun `if (import.meta.main)` vivo negli script degli agenti
     di casa (il difetto del 2026-08-03; le righe di commento non contano).
   - `segnaposto-radice` — nessun `{{…}}` nei `.md` di radice.
2. **Regole in lib pura + test `node --test`** (per ogni regola: il caso che scatta e
   quello che non deve scattare), e i **guardiani locali** per `scripts/` di radice
   (`package.json`, `eslint.config.mjs` con le soglie della casa): uno script senza
   guardiani non è consegnabile.
3. **Il gate eseguito, uscita incollata nel verbale.** Se trova rossi veri — ad
   esempio il txt stantio — **non correggerli**: quelli del documento madre sono
   materia di P.7b, che gira in parallelo. Un gate che al primo giro trova il difetto
   per cui è nato è un gate collaudato: dichiara il rosso e a chi appartiene.
4. **`DECISIONI.md` §26 aggiornata**: il residuo dichiarato lì ha ora il suo
   controllo (una riga in coda alla voce, non una riscrittura).

## Coordinamento (D8 — altre chat lavorano in parallelo)

- Perimetro di scrittura: `scripts/` di radice e la riga in `DECISIONI.md` §26.
  **Non toccare**: `agenti/**`, `CANTIERE.md`, `webgun_content.txt`, `prompts/`.
- Committa **solo i tuoi percorsi** con `git add` espliciti — mai `git add -A`, mai
  `git commit -a`: l'index è condiviso.
- Le batterie `node --test` si lanciano con
  `~/scoop/apps/nodejs-lts/current/node.exe` (il glob su Node 20 non si espande);
  il gate deve girare col `node` di sistema.

## Verbale di chiusura

1. passi scelti e scartati, con motivo;
2. uscita del gate incollata (e i rossi veri trovati, con il proprietario di ciascuno);
3. conteggio test e esito guardiani;
4. riga finale: `P.7a consegnata. Gate della regia: VERDE/ROSSO (N falliti, N mancanti
   su N passi) — rossi veri: <elenco o nessuno>.`
