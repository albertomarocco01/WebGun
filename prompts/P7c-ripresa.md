# Mandato P.7c-ripresa — I guardiani arretrati: punti 3-7, e i numeri nei registri

> Emesso dal direttore dei lavori il 2026-08-04 (direzione subentrata in giornata).
> Da incollare in una chat operaia nuova.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` (riga P.7c, decisioni D8 e D9, giornale del
> 2026-08-04).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Riprendi
**P.7c**, interrotto a metà: i punti 1-2 del mandato originale sono fatti —
verificati e committati dal direttore — i punti 3-7 mai iniziati, e i numeri già
misurati non sono ancora scritti negli `STATO.md`.

## La regola che questa ripresa aggiunge al mandato originale

Il 2026-08-04 due chat operaie su tre sono morte prima del verbale, e la prima
metà di questo pacchetto è morta **con tutto in working tree e zero commit**: il
lavoro l'ha salvato la verifica del direttore, non chi l'aveva fatto. Quindi:

- **un commit per punto chiuso** (o per blocco sensato), appena l'esito c'è;
- gli **`STATO.md` si aggiornano man mano**: l'esito di ogni punto entra nel file
  della skill quando è misurato, non in coda al pacchetto.

## Leggi prima

1. **`prompts/P7c-guardiani-arretrati.md` — il mandato originale. Resta la legge
   del pacchetto**: deliverable, regole, verbale di chiusura. Questo file dice
   solo cosa è già fatto e cosa resta.
2. `CANTIERE.md`: riga **P.7c**, decisioni **D8** e **D9**, giornale del
   2026-08-04 (sera).
3. `git show --stat a6f6d1e` — la prima metà, committata dal direttore.

## Lo stato che ricevi (rilanciato dal direttore, non ereditato)

**Fatto (punti 1-2 del mandato originale), commit `a6f6d1e`:**

- `npm install` in gestionale-crafter, flow-sentinel e speed-demon;
- ESLint locale **0 rilievi** su speed-demon, gestionale-crafter e flow-sentinel
  — compreso il globale `URL` assente nella config di gestionale-crafter, vivo
  dal 2026-08-03 e invisibile finché ESLint non girava affatto;
- knip su speed-demon: **0 rilievi**;
- `complexity 19` di `speed-demon/scripts/verify.mjs` sciolto in funzioni pure;
  batteria speed-demon **75 → 86** (rilanciata dal direttore: 86/86).

**Resta (punti 3-7 del mandato originale, che è la specifica):**

3. **semgrep** sugli `scripts/` di schema-forge, flow-sentinel e speed-demon;
4. **`/code-inquisition`** sugli script delle quattro skill storiche
   (`--focus security,reliability`);
5. **gitleaks**: valuta l'installazione; se lo installi puntalo, se no motiva;
6. **D9 — il banco vetcare**: riallinea `supabase/tests/rls_policy.test.sql`,
   asserzione 11, a `throws_ok(…, '42501', …)`, poi rilancia il gate di
   schema-forge dalla radice del banco (node di sistema; lo stack è acceso:
   kong 57321, db 57322). **Verdetto atteso, falsificabile: ROSSO, 2 falliti,
   0 mancanti su 9; pgTAP «failed 2 tests of 23» (le storiche 22-23);
   `rls_policy` 11/11.** Aggiorna l'handoff del banco (la prosa dei motivi) e la
   riga dello `STATO.md` di schema-forge che dichiarava lo scarto;
7. **`STATO.md` delle quattro skill con data e numeri** — compresi: gli esiti dei
   punti 1-2 qui sopra, che nessuno ha ancora registrato nei file, e il **knip di
   gestionale-crafter e flow-sentinel**, che non risulta mai eseguito: eseguilo e
   registra il numero.

Se chiudi un rilievo toccando uno script, la batteria della skill gira **prima e
dopo** (Node 24).

## Coordinamento (D8 — in parallelo gira P.3-ripresa, il collaudo della vetrina)

- **Non toccare**: `agenti/vetrina-crafter`, `banco-prova-valscura` (il banco del
  collaudo), `banco-prova-controtempo`, `CANTIERE.md`, `prompts/`,
  `webgun_content.txt`.
- Il banco **vetcare è tuo** per il punto 6; gli altri banchi no.
- Commit **solo dei tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.
- Batterie `node --test` con `~/scoop/apps/nodejs-lts/current/node.exe`; i gate
  col `node` di sistema.

## Verbale di chiusura

Come nel mandato originale: esiti per punto (per il 6 l'uscita del gate
**incollata**), rilievi di semgrep e code-inquisition per gravità con la sorte di
ciascuno, e la riga finale:
`P.7c consegnata. Ogni MANCANTE è diventato un esito reale: <sintesi>. Gate
vetcare: ROSSO storico (2 falliti, 0 mancanti su 9), pgTAP 2/23, rls_policy
11/11.` — o la verità, se è un'altra.
