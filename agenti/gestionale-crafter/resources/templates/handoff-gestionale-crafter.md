# Handoff — Gestionale Crafter

> Template. Ogni `{{segnaposto}}` va sostituito: un file con `{{…}}` residui non è un handoff.
> Destinazione: `docs/handoff/10-gestionale-crafter.md` del progetto generato.

## 1. Cosa ho fatto

- Radice del gestionale: `{{ADMIN_ROOT}}` (dichiarata in `gestionale.config.json`)
- Viste generate: {{ELENCO_ROTTE}}
- Moduli di dominio: {{ELENCO_MODULI}}
- Porta d'ingresso: {{ROTTA_DI_ACCESSO}}
- Contenuti editabili dal cliente: {{TABELLE_DI_CONTENUTO_O_NESSUNA}}

## 2. Modello assunto

{{IN_ITALIANO_SEMPLICE: chi amministra cosa, quali ruoli esistono, cosa può fare ognuno}}

Confermato da: {{UMANO | ORCHESTRATORE}} il {{DATA}}.

Assunzioni prese perché il brief non rispondeva (default scelto → conseguenza):

| Assunzione | Default | Conseguenza se è sbagliata |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

## 3. Entità gestite ed entità escluse

| Tabella | Vista | Chi può scrivere |
|---|---|---|
| {{TABELLA}} | `{{ROTTA}}` | {{RUOLI}} |

Escluse **con motivazione** (il gate le pretende scritte):

| Tabella | Perché il cliente non la gestisce |
|---|---|
| {{TABELLA}} | {{MOTIVO}} |

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

Deroghe alla costituzione registrate in `docs/DEBITO-TECNICO.md`: {{ELENCO_O_NESSUNA}}

## 5. Cosa si aspetta chi viene dopo

- **Flow Sentinel**: i flussi da coprire con Playwright sono {{ELENCO}}; l'utente di prova è {{UTENTE}} con ruolo {{RUOLO}}.
- **Cyber Shield**: la superficie critica è {{ELENCO}} — le rotte admin, le azioni server e le funzioni del database che il gestionale chiama.
- Cose che **non** vanno fatte dal client: {{ELENCO}} (passano da funzione del database o da azione server con guardia).

## 6. Richieste rimaste aperte verso schema-forge

Un permesso che manca non si aggira con una chiave: si chiede.

| Cosa serve | Perché | Stato |
|---|---|---|
| {{...}} | {{...}} | {{aperta/chiusa}} |

## 7. Residui del gate e problemi noti

**Gate: {{VERDE|ROSSO}}** ({{N}} falliti, {{N}} verifiche mancanti su 7 passi) — rilanciato il {{DATA}}.

> Questa riga **la verifica il gate stesso**, ultimo passo (`handoff`): se dichiara un verdetto diverso da quello dell'esecuzione in corso, il passo fallisce. Un handoff che dice «tutto a posto» mentre il gate chiude rosso è il modo in cui un difetto arriva a valle con un timbro sopra. La forma è fissa: una riga che comincia con `Gate:` seguito da `VERDE` o `ROSSO`.

| Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| {{issue/warn}} | {{...}} | {{...}} | {{...}} |

Verifiche mancanti (strumenti non eseguiti): {{ELENCO_O_NESSUNA}}

**Cosa il gate verde non dimostra** (da rileggere prima di fidarsi): `SKILL.md` §Cosa un gate verde NON dimostra. In sintesi: le guardie ci sono, non è detto che siano quelle giuste per il dominio. L'adversariale su auth e permessi si fa a mano con `/code-inquisition`.
