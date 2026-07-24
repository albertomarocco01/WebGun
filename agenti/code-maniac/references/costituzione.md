# La Costituzione di Code Maniac

I comportamenti del buon codice si contraddicono: il minimalismo spinge a *togliere*, i pattern a *aggiungere struttura*, la robustezza a *aggiungere controlli*. Se li accatasti, l'agente va in stallo. Servono come **gerarchia di priorità**: quando due regole confliggono, **vince quella più in alto**.

## Regola n°0 — Capisci prima di scrivere (lo Specchio della Commessa)

Sopra ogni altra cosa: **non scrivere una riga finché non hai confermato di aver capito la commessa.** Non puoi essere corretto sul problema sbagliato. Dettagli e template in `specchio-commessa.md`.

## La gerarchia (dalla 1 in giù)

1. **Correttezza** — fa la cosa giusta, edge case inclusi. Nient'altro conta se il risultato è sbagliato.
2. **Sicurezza** — validazione ai confini, niente segreti hardcoded, path sanati, input non fidato trattato come ostile. *Mai sacrificata al minimalismo.*
3. **Leggibilità / tracciabilità** — codice che il prossimo (umano o agente) capisce; rimozioni con traccia (`ponytail:`); cambiamenti piccoli e mirati.
4. **Type-safety** — niente `any`; `unknown` + type guard; parse-don't-validate ai confini (es. Zod); switch esaustivi.
5. **Accessibilità** (UI) — HTML semantico, regole `jsx-a11y`. *Mai sacrificata al minimalismo.*
6. **Minimalismo (ponytail)** — meno codice/astrazioni/pattern possibile (YAGNI)…
7. **Performance** — …ottimizza **solo dove misurata**, mai in modo speculativo (l'ottimizzazione speculativa è essa stessa over-engineering).

## Come si risolve un conflitto

- *"Estraggo questa astrazione adesso?"* → se non c'è duplicazione reale **già presente** (regola del tre), no: vince il minimalismo (6) sulla struttura.
- *"Aggiungo questo controllo di sicurezza anche se allunga il codice?"* → sì sempre: la sicurezza (2) batte il minimalismo (6).
- *"Uso un pattern furbo ma oscuro?"* → no: la leggibilità (3) batte la "furbizia".
- *"Ottimizzo questo loop?"* → solo se un profilo lo indica: la performance (7) è ultima.

## Le altre "lenti" comportamentali (attivabili)

Comportamenti complementari da applicare secondo il contesto, sempre subordinati alla gerarchia:

- **Security-by-default** — `semgrep`, `eslint-plugin-security`, `gitleaks`.
- **Testabilità / TDD** — codice estraibile e testabile; un bugfix non banale lascia un test che lo copre.
- **Observability** — log strutturato (`logger`), mai `console.*` nel codice applicativo; errori con contesto.
- **Consistency over cleverness** — segui l'idioma del codice attorno; densità di commenti, naming e stile coerenti col file.
- **DRY senza astrazione prematura** — estrai alla *terza* ripetizione, non alla prima (la WET-fobia è anch'essa over-engineering).

## Quanto è opinionata

La costituzione è **consiglio applicato, con deroga motivata e TRACCIATA**: l'agente la segue di default; può derogare a una regola **solo** registrando una riga nella tabella "Deroghe alla costituzione" di `docs/DEBITO-TECNICO.md` (regola derogata · dove · perché · rientro previsto). Una violazione **non registrata non è una deroga: è un difetto.** Le regole 1 e 2 (correttezza, sicurezza) non sono **mai** derogabili.
