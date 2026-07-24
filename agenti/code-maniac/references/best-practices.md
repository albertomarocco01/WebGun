# Best-practice — Codice pulito e rintracciabile

Le regole **concrete** del codice pulito. La costituzione (`costituzione.md`) dà le priorità; qui c'è il *come*. Dove possibile, ogni regola è verificata da un tool deterministico (`motore-deterministico.md`).

## 0. L'edit minimo vince

In un edit puntuale su codice esistente prevale **l'edit minimo**: non splittare file "di passaggio", non spostare stringhe, non rinominare fuori scope. I limiti sotto valgono per **file nuovi** e **refactor dedicati**. Se incontri una violazione fuori scope, **segnalala** invece di sistemarla. *Un commit = un motivo.*

## 1. Ogni file si presenta da solo

In testa, un'intestazione che dice cosa fa e cosa esporta:

```ts
/**
 * @descrizione  Cosa fa il file e come viene usato.
 * @indice
 * - nomeEsportazione → descrizione breve
 */
```

Il codice è la fonte di verità; i commenti spiegano il *perché*, non il *cosa*.

## 2. File corti, funzioni semplici, una responsabilità

**File:** < 200 righe OK · 200–350 valuta · 350–500 split al prossimo refactor · > 500 refactor dedicato.

**Funzione:** la complessità si **misura**, non si stima a occhio (`scan` §3.5, `motore-deterministico.md`). Soglie `issue`: cognitive complexity >15, CCN >10, nesting >4, lunghezza >60 righe, parametri >5; cognitive >25 → `block` (refactor dedicato). Sotto l'`issue` c'è un tier `warn` (cognitive >10, CCN >8, nesting >3, lunghezza >50, parametri >4) che segnala senza bloccare; la **lunghezza conta righe non vuote e non commento**. La tabella a tre livelli canonica e allineata al codice è in `motore-deterministico.md` §3.5 (= `scan-lib.gradeFunction`); `max-nested-callbacks` confluisce nella metrica `nesting`. Una funzione complessa *e* toccata spesso (hotspot churn×complessità) è il candidato n°1 alla semplificazione.

La soglia è un *segnale*: il criterio vero è la **singola responsabilità**.

## 3. Nessun valore hardcoded — cambialo in un punto solo

Sorgente unica di verità: stringhe utente → file testi; costanti di dominio (stati, ruoli, soglie) → file costanti; env → wrapper tipizzato; design (colori, spaziature, tipografia) → token del design system. **Mai** valori arbitrari di stile inline (`text-[64px]`, `#1a1a2e`).

## 4. Architettura: separa per responsabilità

- **L'entry-point non contiene logica** — pagine/route compongono componenti e chiamano azioni; niente fetch/calcoli inline.
- **Componente di business → cartella di feature**, non nuove cartelle top-level inventate.
- **Le dipendenze vanno in una direzione** (UI → logica → dati): niente import ciclici (verifica: `dependency-cruiser`, `madge`).

## 5. Estrai i componenti, parametrizza con le props

Un blocco di UI riconoscibile **non si scrive inline nella pagina** — si estrae in un componente con un suo file e si **parametrizza con props**.

**Quando estrarre** (basta uno): ha un nome proprio (Hero, Card, sezione) · si ripete ≥ 2 volte · la pagina mescola più sezioni indipendenti.

```tsx
// NO: Hero murata nella pagina: non riusabile, non testabile
// OK: <Hero titolo={..} sottotitolo={..} cta={..} /> — la pagina torna pura composizione
```

Componenti "stupidi" per quanto possibile: ricevono dati e callback via props, non fanno fetch, non conoscono il routing. È "no duplicazioni" applicato all'UI (vedi anche il pattern container/presentational in `design-patterns.md`).

## 6. Naming coerente

File componente PascalCase · file non-componente kebab-case · cartelle kebab-case · funzione/hook camelCase · costante globale SCREAMING_SNAKE_CASE · tipo PascalCase. Un nome dice *cosa*, non *come* (`calcolaPrezzo`, non `priceUtil`). Lingua del dominio coerente; inglese solo per i termini tecnici standard.

## 7. Anti-pattern

Niente logica nell'entry-point · niente fetch nei componenti di presentazione · niente `any` · niente duplicazioni (funzione → modulo condiviso; markup → componente) · niente file-jolly (`utils.ts`, `helpers.ts`, `misc.ts` → nomi tematici) · niente import ciclici · niente funzioni oltre soglia di complessità (cognitive >15 → semplifica; >25 → refactor dedicato) · niente file `.bak`/temporanei nel sorgente.

## 8. Errori e logging

Log strutturato (`logger`), mai `console.*` nel codice applicativo. Feedback utente esplicito (successo conciso, errore con causa). Lo strato dati **non lancia verso l'UI**: logga e ritorna un fallback (`[]`, `null`). Conosci le eccezioni di controllo del framework che vanno **rilanciate**, non loggate.

## 9. Strato dati: un pattern unico

Selezione esplicita delle colonne (mai `SELECT *` nelle liste); mappatura sorgente→dominio in un solo punto (l'UI non vede i nomi grezzi del DB); fallback invece di eccezioni.

## 10. Test

Unit per la logica pura · componenti per l'UI riusabile (comportamento, non implementazione) · e2e per i flussi critici. Un bugfix non banale lascia **un test che lo copre**. L'estrazione dei componenti (§5) è ciò che rende l'UI testabile in isolamento.

## 11. Rintracciabilità delle rimozioni

Cancellare in silenzio cancella anche il *perché*. Ogni rimozione/declassamento non banale lascia una traccia (la convenzione `ponytail:` — vedi `skill-esterne.md`), con cosa e perché. È grep-abile e rende la potatura del codice una scelta, non una svista.

## Checklist "fatto"

- [ ] `tsc` verde · linter senza **nuovi** warning · `scan` senza nuovi problemi
- [ ] Intestazione presente nei file nuovi/riscritti
- [ ] Niente nuovo hardcoded (stringhe, numeri magici, stili inline)
- [ ] Blocchi UI riconoscibili estratti in componenti con props (§5)
- [ ] File nuovi sotto soglia e nella cartella giusta
- [ ] Niente funzione/markup duplicato
- [ ] Nessuna funzione nuova oltre soglia di complessità (`scan` §3.5)
- [ ] Rimozioni non banali tracciate
- [ ] Un commit = un motivo
