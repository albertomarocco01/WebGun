# Stato — Flow Sentinel

- **Stato attuale:** progettazione confermata (P0, 2026-07-28) — `SKILL.md` completa: tre leggi, sei comandi, gate a sette passi con id stabili. Confermata dall'umano il 2026-07-28 (Specchio della progettazione: flussi proposti→confermati, solo E2E browser, effetto-DB nel gate + sabotaggio al collaudo, `retries = 1` dichiarato). **Costruzione (P1) non iniziata**: references, scripts e banco di prova non esistono ancora — la SKILL.md ha il contratto, non il come.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: gestionale-crafter e fly-ui (l'app da testare), schema-forge (il modello di accesso del suo handoff è la fonte dei flussi ostili; seed e utenti), ai-specialist se presente
  - A valle: speed-demon (ottimizza con la batteria come rete di sicurezza), cyber-shield (parte dai flussi ostili dichiarati), launchpad (non pubblica su gate rosso)

## Piano di costruzione (deciso in P0)

| Fase | Cosa | Dove |
|---|---|---|
| P0 | progettazione SKILL.md | fatta qui, confermata dall'umano |
| P1 | references, scripts (gate + lib pura + test), banco minimo usa e getta, sabotaggio provato una volta | chat dedicata, branch `agente/flow-sentinel` |
| P2 | collaudo avversario indipendente su dominio diverso: caccia ai falsi verdi del gate | chat dedicata, vergine |
| P3 | primo consumatore reale: batteria su Bottega Nord (`banco-prova-negozio`), dopo l'handoff di gestionale-crafter | chat dedicata |
