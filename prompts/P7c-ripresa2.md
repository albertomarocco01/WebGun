# Mandato P.7c-ripresa-2 — I tre guardiani che mancano: semgrep, code-inquisition, gitleaks

> Emesso dal direttore dei lavori il 2026-08-04 (pomeriggio).
> Da incollare in una chat operaia nuova.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` (riga P.7c, giornale del 2026-08-04 pomeriggio).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Riprendi
**P.7c** per la terza volta: dei sette punti del mandato originale restano i
punti **3, 4 e 5** — tutto il resto è chiuso, committato e verificato.

## La regola, alla seconda recidiva, diventa il primo deliverable

Le due corse precedenti di questo pacchetto sono morte **tutte e due** con
lavoro in working tree e zero commit; tutte e due le volte l'ha salvato la
verifica del direttore, non chi aveva fatto il lavoro. Quindi:

- **un commit per punto chiuso**, appena l'esito c'è: un punto senza commit non
  esiste;
- le righe di **`STATO.md` nascono nello stesso commit del punto**, non in coda
  al pacchetto;
- se senti che la corsa sta per fermarsi: commit di quello che c'è, **subito**,
  con `WIP` nel titolo. Un WIP onesto vale più di un'ora perfetta e muta.

## Leggi prima

1. **`prompts/P7c-guardiani-arretrati.md` — il mandato originale. Resta la
   legge del pacchetto**: deliverable, regole, verbale di chiusura.
2. `CANTIERE.md`: riga **P.7c** e giornale del **2026-08-04 (pomeriggio)**.
3. `git show --stat a6f6d1e` (punti 1-2) e i due commit del direttore del
   2026-08-04 su **D9** e sui **registri** (`git log --oneline -8`).

## Lo stato che ricevi (misurato dal direttore, non ereditato)

- **Punti 1-2**: chiusi in `a6f6d1e` — ESLint 0 rilievi su speed-demon,
  gestionale-crafter e flow-sentinel; knip 0 su speed-demon; `complexity 19`
  sciolta; batteria speed-demon 86/86 (rilanciata il 2026-08-04).
- **Punto 6 (D9)**: chiuso — asserzione 11 di `rls_policy.test.sql` a
  `throws_ok(…, '42501', …)`, gate vetcare **ROSSO, 2 falliti, 0 mancanti su
  9**, pgTAP 2/23 (le storiche 22-23), `rls_policy` 11/11. **Sul banco non c'è
  niente da fare.**
- **Punto 7**: chiuso per la parte già esistente — numeri dei punti 1-2 e knip
  di gestionale-crafter e flow-sentinel (**0 rilievi entrambi**) registrati
  negli `STATO.md`. Restano solo le righe che nasceranno dai punti 3-5.
- `semgrep` è **installato**: 1.171.0, in `~/.local/bin`. `gitleaks` no.

## Resta da fare (punti 3-5 del mandato originale, che è la specifica)

3. **semgrep** sugli `scripts/` di schema-forge, flow-sentinel e speed-demon —
   configurazione dichiarata (default o profilo motivato); ogni rilievo con la
   sorte scritta: corretto, falso positivo col perché, o debito dichiarato.
   Un commit.
4. **`/code-inquisition`** sugli script delle quattro skill storiche
   (`--focus security,reliability`). Rilievi per gravità, sorte di ciascuno.
   Un commit.
5. **gitleaks**: valuta l'installazione; se lo installi puntalo (sul repo
   intero: i segreti sono il suo mestiere), se no scrivi perché. Un commit.

Se chiudi un rilievo toccando uno script, la batteria della skill gira **prima
e dopo** (Node 24: `~/scoop/apps/nodejs-lts/current/node.exe`); i gate col
`node` di sistema.

## Coordinamento (se in parallelo gira P.4-pre)

- **Non toccare**: `scripts/` della regia, `installa-skill.ps1`, `prompts/`,
  `CANTIERE.md`, `Web Gun.docx` / `webgun_content.txt`, i banchi
  (`banco-prova-*`) e gli stack Docker/Supabase. I punti 3-5 vivono in
  `agenti/*/scripts` e negli `STATO.md`: di tutto il resto non hai bisogno.
- Commit **solo dei tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.

## Verbale di chiusura

Come nel mandato originale — esiti per punto, rilievi per gravità con la sorte
di ciascuno — più la riga finale:
`P.7c consegnata. Ogni MANCANTE è diventato un esito reale: <sintesi per punto>.`
— o la verità, se è un'altra.
