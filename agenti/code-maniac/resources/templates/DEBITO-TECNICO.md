# Debito Tecnico — {{NOME_PROGETTO}}

> Generato e mantenuto da Code Maniac · {{DATA}}. Registro delle scorciatoie e dei residui, così *"dopo"* non diventa *"mai"*. Alimentato da `scan` (knip, jscpd, dependency-cruiser, **hotspot di complessità**…), dai marcatori `ponytail:` e dalle deroghe motivate alla costituzione.

## Come si legge

- **Origine:** chi ha segnalato il debito (tool o decisione).
- **Destinazione:** dove deve andare a finire (refactor previsto), non solo "è sbagliato".
- Un debito **dichiarato** non va propagato nei file nuovi né "sistemato di passaggio" (regola §0).

## Registro

| # | Debito | Origine | Destinazione | Priorità |
|---|---|---|---|---|
| 1 | {{DEBITO_1}} | {{ORIGINE_1}} | {{DESTINAZIONE_1}} | {{PRIO_1}} |
<!-- es. | 2 | File > 500 righe: X | scan/knip | split in refactor dedicato | media | -->
<!-- es. | 3 | Hotspot: validateSession() cognitive 28, churn 47× | scan §3.5 | refactor dedicato (subagent Opus) | alta | -->

## Scorciatoie `ponytail:` aperte

{{PONYTAIL_DEBT}}
<!-- Output di /ponytail-debt: scorciatoie riconosciute ma posticipate. -->

## Deroghe alla costituzione

| Regola derogata | Dove | Perché | Rientro previsto |
|---|---|---|---|
{{DEROGHE}}
<!-- Le regole 1 (correttezza) e 2 (sicurezza) NON sono derogabili: non compaiono mai qui. -->
