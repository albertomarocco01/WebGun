# Handoff — Schema Forge

> Template. Ogni `{{placeholder}}` va sostituito: un file con `{{…}}` residui non è un handoff.
> Destinazione: `docs/handoff/07-schema-forge.md` del progetto generato.

## 1. Cosa ho fatto

- Migrazioni: {{ELENCO_MIGRAZIONI}}
- Tabelle create: {{ELENCO_TABELLE}}
- Tipi generati in: `{{PATH_TIPI}}`
- Diagramma: `docs/schema/ERD.md` (rigenerabile con `scripts/erd.mjs`)

## 2. Modello assunto (Specchio del dominio)

{{ENTITA_E_RELAZIONI_IN_ITALIANO_SEMPLICE}}

Confermato da: {{UMANO | ORCHESTRATORE}} il {{DATA}}.

## 3. Modello di accesso (chi vede cosa)

| Tabella | anon | authenticated | staff/admin |
|---|---|---|---|
| {{TABELLA}} | {{...}} | {{...}} | {{...}} |

Policy `using (true)` presenti e perché sono legittime: {{ELENCO_O_NESSUNA}}

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

## 5. Cosa si aspetta chi viene dopo

- **Fly UI**: {{TABELLE_E_TIPI_DA_USARE}}
- **Gestionale Crafter**: {{ENTITA_CON_CRUD}}
- Operazioni che **non** vanno fatte dal client: {{ELENCO}} (passano da funzione del database o dal server)

## 6. Residui di `verify` e problemi noti

**Gate: {{VERDE|ROSSO}}** ({{N}} falliti, {{N}} verifiche mancanti su 9 passi) — rilanciato il {{DATA}}.

> Questa riga **la verifica il gate stesso**, ultimo passo (`contratto-uscita`): se dichiara un verdetto diverso da quello dell'esecuzione in corso, il passo fallisce. Non è burocrazia — un handoff che dice «nessun bloccante» mentre il gate chiude rosso è il modo in cui un difetto arriva a valle con un timbro sopra. La forma è fissa: una riga che comincia con `Gate:` seguito da `VERDE` o `ROSSO`.

| Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| {{issue/warn}} | {{...}} | {{...}} | {{...}} |

Verifiche mancanti (strumenti non eseguiti): {{ELENCO_O_NESSUNA}}
