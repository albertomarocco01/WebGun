# BugBay — App del daemon

Questa è l'**app Next.js del daemon** di BugBay: la console di triage, le API e il
**motore di fix agentico**. Non si installa né si usa da qui — viene servita dalla CLI:

```bash
npx bugbay dev        # avvia il daemon su http://localhost:7331
```

Per installazione, uso e **comportamento degli agenti** vedi il
[README principale](../README.md).

## Svilupparla in locale

L'app gira dalla cartella del pacchetto (`web/`) ma opera sul repo indicato da
**`BUGBAY_TARGET_ROOT`** (lo imposta la CLI; senza, usa la cartella corrente). Per
lavorarci direttamente:

```bash
cd web
npm install
# bash/zsh:
ENABLE_AGENT_FIX=1 BUGBAY_TARGET_ROOT=/percorso/al/progetto npm run dev
```

```powershell
# PowerShell:
$env:ENABLE_AGENT_FIX=1; $env:BUGBAY_TARGET_ROOT="C:\percorso\al\progetto"; npm run dev
```

- `ENABLE_AGENT_FIX=1` abilita il motore di fix (**solo in locale**).
- Il fix agentico richiede un **repo git** nel target e, per il provider di default
  (`claude-headless`), la **CLI `claude`** autenticata — in alternativa una API key
  Gemini/DeepSeek dalle Impostazioni della console.

## Struttura

- `src/app/` — pagine della console + route API (`/api/agent-fix`, …)
- `src/modules/bugbay/` — il modulo BugBay: componenti, hook e il motore `agent-fix/`
  (scope, interprete, fixer, codemod, gate tsc+ESLint, giudice)
- `public/bugbay-widget.js` — il widget flottante servito cross-origin
