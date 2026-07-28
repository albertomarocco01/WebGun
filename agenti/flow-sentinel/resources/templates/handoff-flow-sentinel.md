# Handoff — Flow Sentinel

> Template. Ogni `{{segnaposto}}` va sostituito: un file con `{{…}}` residui non
> e' un handoff, e il gate lo boccia.
> Destinazione: `docs/handoff/12-flow-sentinel.md` del progetto generato.

## 1. Cosa ho fatto

- Contratto dei flussi: `docs/flussi-critici.md`, {{N}} flussi confermati da {{CHI}} il {{DATA}}
- Spec: {{ELENCO_FILE}} (una per flusso, etichetta `@flusso:<id>` nel titolo)
- Helper: `e2e/helpers/` — autenticazione ({{storage state / login via UI}}) e verifica DB
- Configurazione: `playwright.config.ts` (`retries: 1`, `forbidOnly`, trace on-first-retry)
- Comando unico per rilanciare tutto: `{{COMANDO}}`

## 2. Flussi coperti e non coperti

| id | tipo | spec che lo attacca | asserzione di effetto |
|---|---|---|---|
| {{id}} | {{tipo}} | {{file}} | {{quale riga / quale rifiuto}} |

**Non coperti, e perche':** {{ELENCO_O_NESSUNO}}

<!--
Un flusso dichiarato e non coperto rende ROSSO il gate: se e' qui, o e' appena
stato tolto dal contratto (e la rimozione l'ha confermata chi aveva confermato
l'elenco), o il gate e' rosso e questa riga lo dice.
Vanno qui anche i flussi che NON sono stati dichiarati e che si e' scelto di non
coprire: il posto peggiore dove tenerli e' la memoria di chi ha deciso.
-->

## 3. Difetti trovati (non corretti da me)

| Flusso | Cosa succede | Come si riproduce | A chi tocca |
|---|---|---|---|
| {{id}} | {{...}} | {{passi}} | {{agente/persona}} |

<!--
Flow Sentinel non corregge l'app: un verificatore che ripara cio' che verifica
smette di essere un verificatore. I difetti che restano vanno anche in
`docs/DEBITO-TECNICO.md`.
-->

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perche' |
|---|---|---|
| {{...}} | {{...}} | {{...}} |

## 5. Flaky noti, con spiegazione

| Test | Quando fallisce | Perche' resta | Rientro previsto |
|---|---|---|---|
| {{...}} | {{...}} | {{...}} | {{...}} |

<!--
Un test passato al SECONDO tentativo e' `pass`, ma il gate lo nomina anche sul
verde: se compare nel dettaglio del passo `playwright`, va scritto qui con la
sua spiegazione. Un flaky senza spiegazione scritta e' un difetto che si sta
imparando a ignorare.
-->

## 6. Cosa si aspetta chi viene dopo

- **Speed Demon**: ottimizza con questa rete tesa — dopo ogni modifica, `{{COMANDO}}`
- **Cyber Shield**: i flussi ostili di `docs/flussi-critici.md` sono il punto di
  partenza, non la conclusione: qui si prova che le porte dichiarate restano
  chiuse; quelle che nessuno ha dichiarato le cerca lui
- **Launchpad**: non pubblica su gate rosso

## 7. Residui del gate

**Gate: {{VERDE|ROSSO}}** ({{N}} falliti, {{N}} verifiche mancanti su 7 passi) — rilanciato il {{DATA}}.

> Questa riga **la verifica il gate stesso**, ultimo passo (`contratto-uscita`):
> se dichiara un verdetto diverso da quello dell'esecuzione in corso, il passo
> fallisce e dice quale dei due e' quello vero. Non e' burocrazia — un handoff
> che dice «tutto verde» mentre il gate chiude rosso e' il modo in cui un
> difetto arriva a valle con un timbro sopra. Dichiarare rosso su un gate rosso
> **passa**: dichiarare non e' fallire. La forma e' fissa: una riga che comincia
> con `Gate:` seguito da `VERDE` o `ROSSO`.

| Passo | Stato | Cosa resta | Rientro previsto |
|---|---|---|---|
| {{id}} | {{fail/skipped}} | {{...}} | {{...}} |

Verifiche mancanti (strumenti non eseguiti): {{ELENCO_O_NESSUNA}}

<!--
Una verifica mancante non e' una verifica superata. Se qui c'e' una riga, il
gate e' rosso e la riga `Gate:` qui sopra dice ROSSO.
-->
