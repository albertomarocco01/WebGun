# Skill Esterne — ponytail · graphify · caveman

Code Maniac **orchestra** tre skill open-source di terzi: non le reimplementa, le richiama al momento giusto. Sono opzionali-ma-consigliate; se mancano, Code Maniac degrada con grazia (salta il passo con una nota).

> **Installazione in un colpo:** `node scripts/setup.mjs` installa tutte e tre — graphify (pip) e caveman/ponytail (plugin Claude dal repo **locale**, quindi anche dietro proxy con TLS-interception) — **saltando** quelle già attive. Cerca i repo in una cartella `skills/` sopra la root (li riusa se presenti); `--skills-dir <path>` o `--in-root` per scegliere dove. `--check` = sola diagnosi · `--tools` = core deterministico. Tutte e tre **MIT**.

> **Licenze / attribuzione:** prima di *vendorare* (copiare i loro file dentro questa skill) va letto il `LICENSE` di ciascun repo e aggiunto un `ATTRIBUTION.md`. Di default le **installiamo come dipendenze** (sotto), così restano aggiornate e non ridistribuiamo codice altrui.

---

## ponytail — minimalismo del codice

[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) — filosofia da "senior pigro": *il miglior codice è quello che non scrivi*. Sposta il minimalismo a monte, in fase di generazione (YAGNI, scala decisionale). **Non taglia mai** validazione, sicurezza, gestione errori, accessibilità.

- **Installazione:** in sessione `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`; oppure da CLI cert-proof, dal repo locale: `claude plugin marketplace add <skills>/ponytail` → `claude plugin install ponytail@ponytail`. Automatizzato da `scripts/setup.mjs`.
- **Comandi:** `/ponytail [lite|full|ultra|off]` · `/ponytail-review` (over-engineering nel diff) · `/ponytail-audit` · `/ponytail-debt` (raccoglie i marcatori in un registro) · `/ponytail-gain`
- **Marcatori `// ponytail:`** — scorciatoie riconosciute ma posticipate; nel codebase compaiono anche come tracce di rimozioni (es. `// ponytail: export rimosso, usate solo internamente (knip)`).
- **Integrazione in Code Maniac:** attivo durante lo sviluppo (regola n°3); `/ponytail-review` dentro il comando `review`; `/ponytail-debt` dentro `debt`.

## graphify — grafo di conoscenza del codice

Trasforma una cartella (codice, docs, immagini, video) in un **grafo navigabile e interrogabile**: community detection, audit trail (`EXTRACTED`/`INFERRED`/`AMBIGUOUS`), output HTML + JSON + report.

- **Installazione:** `pip install graphifyy` (o `uv tool install graphifyy`), poi `graphify install --platform claude` per copiare/aggiornare la skill. Automatizzato da `scripts/setup.mjs`.
- **Trigger:** `/graphify` (full pipeline) · `/graphify --update` (incrementale) · `/graphify query "<domanda>"` · `/graphify path "A" "B"` · `/graphify explain "X"`
- **Salvare un risultato nel grafo:** `graphify save-result --question … --answer … --type query|path_query|explain --nodes …` — chiude il loop di apprendimento: il prossimo `--update` lo estrae come nodo (usato dallo Specchio per persistere la commessa confermata).
- **Tenerlo fresco:** `graphify hook install` (post-commit) · `graphify claude install` (sempre-attivo nelle sessioni).
- **Integrazione in Code Maniac:** è il motore del comando `explore` e della fase "Esplora" dei binari quotidiani — **interroga il grafo invece di leggere file interi** (risparmio token). Alimenta anche `pattern suggest`. Una volta che esiste `graphify-out/graph.json`, ogni domanda sul codice passa dal grafo, non da una ri-lettura.
- **Gate di freschezza (correttezza prima del risparmio).** Un grafo stale risponde con sicurezza *sbagliato* → prima di fidarsene, `explore` confronta la data del grafo con l'ultimo commit sui sorgenti (`git log -1 --format=%cI -- <dir sorgenti>`): se il codice è più recente, dichiara il grafo stale e lancia `/graphify --update` (incrementale) *prima* di rispondere. Tenerlo fresco a monte con `graphify hook install` (post-commit) elimina il problema alla radice.

## caveman — compressione della prosa

[JuliusBrussee/caveman](https://github.com/juliusbrussee/caveman) — comprime la *prosa* dell'agente (taglia articoli, riempitivi, meta-narrazione → stile telegrafico). ~65% sui token di output testuale, tre livelli (Lite/Full/Ultra) + "Caveman Compress" per ridurre i token di input riscrivendo i file di contesto.

> **Conflitto da gestire:** caveman è l'opposto di un testo chiaro e leggibile. Lo Specchio della Commessa e ogni prosa su cui l'umano decide **devono restare leggibili.**

**Uso selettivo:**

| Caveman ON (telegrafico) | Caveman OFF (chiaro) |
|---|---|
| chiacchiera tra subagent | Specchio della Commessa |
| report di `scan`, log, status interni | qualsiasi spiegazione su cui decidi tu |
| note di lavoro, commit brevi | onboarding, conferme, proposte di refactor |

Regola: **caveman comprime ciò che le macchine si dicono; mai ciò che un umano legge per scegliere.**

- **Installazione (MIT · Node ≥18):** plugin Claude dal repo locale (cert-proof): `claude plugin marketplace add <skills>/caveman` → `claude plugin install caveman@caveman`. `scripts/setup.mjs` scarica il repo (via cert store di sistema) e fa questo. Da evitare: lo shim one-line `irm … | iex` è rotto su Windows (bug upstream: `Split-Path` su `$MyInvocation.MyCommand.Path` null), e `npx github:…` fallisce dietro proxy con TLS-interception (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`).

---

## Degradazione con grazia

| Manca… | Code Maniac fa |
|---|---|
| graphify | esplora coi tool nativi (Grep/Glob mirati, agente `Explore`), avvisando che il grafo darebbe più contesto a meno token |
| ponytail | applica comunque il minimalismo della costituzione (regola n°3) e i check di `scan` (knip) |
| caveman | parla normale (un po' più di token sulla prosa interna, nessun impatto sulla correttezza) |

Nessuna delle tre è un pilastro: i pilastri sono la **costituzione**, lo **Specchio** e il **motore deterministico**, tutti interni alla skill.
