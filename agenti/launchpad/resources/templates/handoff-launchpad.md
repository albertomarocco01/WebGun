# Handoff {{nn}} — Launchpad

> Contratto del `CLAUDE.md` della regia: **cosa ho fatto · decisioni prese ·
> cosa si aspetta chi viene dopo · problemi noti**, più la riga `Gate:`
> (`DECISIONI.md` §19).
>
> Si scrive **prima** del gate: `verify` controlla che esista e che dica il vero,
> quindi scriverlo dopo significa chiudere con un rosso strutturale.
>
> Se il gate è rosso, questo file **si scrive lo stesso e dichiara rosso**.
> Dichiarare non è fallire.

## 1. Cosa ho fatto

{{Pubblicato / preparato e non pubblicato. Se non è stato pubblicato, dirlo qui
in prima riga e dire perché: è l'informazione che chi legge cerca per prima.}}

- **Provider e dominio**: {{…}}
- **Commit pubblicato**: {{sha}} · **impronta**: {{primi 12}}
- **Quando**: {{AAAA-MM-GG hh:mm}}
- **Chi ha autorizzato**: {{nome, ruolo, data della firma su `docs/deploy.md`}}

## 2. Verifica d'identità dopo il deploy

La domanda a cui questa sezione risponde: **l'indirizzo pubblico sta servendo il
commit che è stato approvato?**

```
{{node <skill>/scripts/impronta.mjs --url https://… --commit … — uscita incollata}}
```

- HTTPS e certificato: {{valido / no}}
- Apex e `www`: {{coerenti col runbook / no}}

## 3. Decisioni prese

Le scelte che non erano derivabili dal codice, con la motivazione — soprattutto
le **deroghe**.

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| {{…}} | {{…}} | {{…}} |

**Codice altrui toccato**: `next.config.ts`, riga `generateBuildId` — è l'unica
riga di codice di un altro agente che launchpad scrive, e serve perché
l'impronta dell'artefatto **derivi dal commit**: il provider ricostruisce dal
sorgente, e un `BUILD_ID` casuale rende impossibile dimostrare cosa c'è online
un minuto dopo. {{Scritta il … / già presente}}

## 4. Variabili di produzione impostate

**Nomi, mai valori.**

| Nome | Dove | Impostata prima della build? |
|---|---|---|
| {{…}} | {{pannello del provider}} | {{sì/no}} |

Chiave `service_role`: **non impostata** — {{confermare, o dichiarare la deroga
e il motivo}}.

## 5. Rollback

- **Procedura**: {{riferimento a `docs/deploy.md` §Rollback}}
- **Versione a cui si torna**: {{identificativo}}
- **Provata?** {{sì, il … / **no** — e allora dirlo qui, perché una procedura
  di rollback mai eseguita è una procedura che si scopre la prima volta che
  serve, cioè nel momento peggiore}}
- **Migrazioni in questa pubblicazione**: {{sì/no}}. Se sì: il rollback del
  codice **non** tocca il database, e la seconda metà è una richiesta a
  schema-forge.

## 6. Cosa si aspetta chi viene dopo

- **DemonIAc**: il sito è online su {{dominio}}, e le pagine da riprendere sono
  {{…}}.
- **Chi mantiene**: `docs/deploy.md` è l'unico documento del progetto scritto
  perché una persona che non c'era sappia rifare — e disfare — quello che è
  stato fatto. Va riaperto **prima** di ogni pubblicazione successiva, e la
  firma **si rinnova**: una firma più vecchia dell'ultimo commit di codice ha
  autorizzato un altro contenuto.
- **Prima della prossima pubblicazione**: {{cosa deve essere vero}}

## 7. Problemi noti e residui

Ogni voce va **anche** in `docs/DEBITO-TECNICO.md` (Regola dei guardiani).

| # | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| {{n}} | {{…}} | {{…}} | {{…}} |

**Cosa questo deploy non ha provato** — l'elenco onesto, non una formalità:

- {{es. il rollback, se non è stato eseguito}}
- {{es. il comportamento sotto carico vero}}
- {{es. le prescrizioni di limitazione di frequenza, se sono state mitigate e
  non chiuse}}

## 8. Esito del gate

```
{{uscita di `node <skill>/scripts/verify.mjs --url …` — incollata, non riassunta}}
```

**Gate: {{VERDE | ROSSO}}** ({{n}} falliti, {{n}} verifiche mancanti su 9 passi)
— rilanciato il {{AAAA-MM-GG}} sull'artefatto {{impronta}}.

> Il gate verde dice che il sito è pronto **per il trasporto**, non per il suo
> pubblico. Non guarda una pagina, non guarda un flusso, non guarda un numero:
> quei verdetti li dànno i quattro gate a monte, e questo agente li **legge**.
