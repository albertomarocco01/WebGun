# Mandato P.7c — Guardiani arretrati e igiene del banco

> Emesso dal direttore dei lavori il 2026-08-04. Da incollare in una chat operaia
> nuova. **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` (decisioni D8 e D9, riga P.7c).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto
trasforma in **esiti reali** le verifiche che gli script delle skill storiche
dichiarano MANCANTI da settimane, e chiude la riga rossa del banco che non è sua (D9).
Il precedente che lo giustifica è fresco: un `no-undef` è rimasto vivo per un giorno
intero perché i `node_modules` della skill non erano installati e ESLint **non girava
affatto** — un guardiano che non gira è un guardiano che passa.

## Leggi prima

1. `CLAUDE.md`; `CANTIERE.md` (riga P.7c, decisioni **D8** e **D9**).
2. Gli `STATO.md` delle quattro skill storiche — le sezioni sui guardiani e i punti
   aperti pertinenti: flow-sentinel n°7, speed-demon n°5, schema-forge n°12.
3. `DECISIONI.md` §17 e §18.

## Deliverable

1. **`npm install` dove i `node_modules` mancano** (gestionale-crafter,
   flow-sentinel; verifica anche speed-demon), poi **ESLint e knip locali** di ogni
   skill: esiti reali — numeri, non «ok» — negli `STATO.md`.
2. **`complexity 19` su `speed-demon/scripts/verify.mjs:263`** (soglia della casa:
   15): spezza in funzioni pure come fece schema-forge con `main()`, batteria della
   skill verde **prima e dopo** (75+).
3. **semgrep** (installato, ≥1.171.0) puntato sugli `scripts/` di schema-forge,
   flow-sentinel e speed-demon (gestionale-crafter l'ha già: 6 rilievi dichiarati):
   ogni rilievo **chiuso o dichiarato** nello STATO — mai silenziato.
4. **`/code-inquisition` sugli script delle quattro skill storiche**
   (`--focus security,reliability`): referto; i rilievi veri chiusi o dichiarati.
   È il punto aperto n°7 di flow-sentinel e n°5 di speed-demon.
5. **gitleaks**: valuta l'installazione (scoop); se lo installi, puntalo su
   `agenti/*/scripts` e `scripts/` di radice, esito negli STATO — chiude un MANCANTE
   storico di tre skill. Se non lo installi, motiva.
6. **D9 — il banco vetcare**: riallinea `supabase/tests/rls_policy.test.sql`,
   asserzione 11, a `throws_ok(…, '42501', …)` — dopo P.8 il rifiuto arriva **prima**
   della RLS (`permission denied`), non come «zero righe». Poi rilancia il gate di
   schema-forge dalla radice del banco (il `node` di sistema va bene; se Docker è
   spento, riaccendilo — lo stack del vetcare è su 57321/57322). **Verdetto atteso,
   falsificabile**: ROSSO, **2 falliti, 0 mancanti su 9**, pgTAP «failed 2 tests of
   23» (le storiche 22-23) e `rls_policy` **11/11**. Aggiorna l'handoff del banco
   (la prosa dei motivi) e la riga dello `STATO.md` di schema-forge che dichiarava
   lo scarto.
7. `STATO.md` aggiornati con data e numeri; commit per blocco sensato, messaggi nello
   stile della casa.

## Coordinamento (D8 — in parallelo gira P.3, il collaudo avversario della vetrina)

- **Non toccare**: `agenti/vetrina-crafter`, `banco-prova-controtempo`, l'eventuale
  banco nuovo di P.3, `CANTIERE.md`, `prompts/`, `webgun_content.txt`.
- Il banco **vetcare è tuo** per il punto 6; gli altri banchi no.
- Committa **solo i tuoi percorsi** con `git add` espliciti — mai `-A`, mai
  `commit -a`: l'index è condiviso.
- Batterie `node --test` con `~/scoop/apps/nodejs-lts/current/node.exe`; i gate col
  `node` di sistema.

## Verbale di chiusura

1. esiti per punto (per il 6: l'uscita del gate **incollata**);
2. rilievi di semgrep e code-inquisition per gravità, con la sorte di ciascuno;
3. riga finale: `P.7c consegnata. Ogni MANCANTE è diventato un esito reale: <sintesi>.
   Gate vetcare: ROSSO storico (2 falliti, 0 mancanti su 9), pgTAP 2/23,
   rls_policy 11/11.` — o la verità, se è un'altra.
