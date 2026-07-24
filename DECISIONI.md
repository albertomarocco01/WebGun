# DECISIONI — Registro delle decisioni del repo Web Gun

Registro delle decisioni prese (o da prendere) sulla struttura e sull'orchestrazione. Una voce per decisione: contesto, decisione, stato.

## Decisioni aperte

### 1. Specchio della Commessa in modalità pipeline automatica

Lo Specchio della Commessa di code-maniac richiede conferma umana esplicita prima di agire. In modalità pipeline automatica questo gate va delegato all'orchestratore (Prompt Smith farà da committente), mantenendo la conferma umana solo per azioni irreversibili (deploy, spese, cancellazioni). **Da discutere con il proprietario di code-maniac prima di modificare qualsiasi cosa.**

- **Stato:** aperta — nessuna implementazione fatta, solo documentata.

## Decisioni prese autonomamente (durante la ristrutturazione del 2026-07-24)

### 2. Repo di origine di code-inquisition non noto

La sezione "Fonte di verità" del README indica code-maniac e bugbay con URL GitHub (finzidev). Per code-inquisition non esiste un URL documentato in HOWTORUN.md (l'installazione avviene copiando la cartella): nel README è segnato "esterno (finzidev, URL non noto)". Da completare quando il proprietario fornisce il link.

- **Stato:** presa — aggiornare il README quando l'URL è disponibile.

### 3. `Web Gun.docx` e `webgun_content.txt` restano in radice

Non è stata creata la cartella `docs-umani/`: con soli due file di documentazione umana la radice resta leggibile, e spostarli avrebbe rotto eventuali riferimenti esterni. Si riconsidera se i documenti umani crescono.

- **Stato:** presa.

### 4. Struttura standard dei progetti generati: aggiunte `lib/`, `public/`, `supabase/`

Il template `struttura_directory.md` di code-maniac è generico (placeholder). Nel CLAUDE.md la struttura è stata concretizzata per lo stack Next.js + Supabase aggiungendo `src/lib`, `public/` e `supabase/` (migrazioni e seed), oltre alle cartelle richieste (`src/app`, `src/components`, `src/modules/<dominio>`, `docs/`).

- **Stato:** presa — modificabile quando gli agenti costruttori definiranno esigenze diverse.

### 5. Dipendenze negli STATO.md dedotte dall'ordine di pipeline

Le dipendenze a monte/a valle di ogni agente scaffold sono dedotte dall'ordine delle fasi in HOWTORUN.md (es. gestionale-crafter dipende da schema-forge e fly-ui). Sono ipotesi di partenza, non vincoli: il proprietario di ogni agente le conferma o corregge quando lo sviluppa.

- **Stato:** presa.

## Decisioni prese durante l'installazione di Schema Forge (2026-07-24)

### 6. Conferma dei gate in pipeline: precedente valido per tutti gli agenti

La decisione §1 (Specchio della Commessa in pipeline automatica) resta aperta per code-maniac, ma Schema Forge l'ha risolta per sé, e la soluzione vale come **precedente per i prossimi agenti** finché §1 non viene chiusa diversamente:

1. **Il gate di comprensione non si elimina, si delega.** Lo Specchio del dominio ha due modalità: in interattiva conferma l'umano con un "sì" esplicito, in pipeline conferma l'orchestratore (Prompt Smith) sulla base del brief.
2. **Delegare non vuol dire perdere la tracciabilità.** In pipeline il modello assunto viene **scritto** in `docs/handoff/07-schema-forge.md` come "modello assunto": un errore di comprensione resta leggibile invece di sparire.
3. **Le azioni irreversibili restano sempre a checkpoint umano**, anche in pipeline. Per Schema Forge sono i distruttivi sullo schema (`drop column`, `drop table`, restringimenti di tipo, `rename`): l'orchestratore non ha l'autorità di autorizzare una perdita di dati.

Regola generale che ne discende: **un agente in pipeline può delegare all'orchestratore la conferma di ciò che è reversibile, mai la conferma di ciò che non lo è, e ciò che assume lo scrive nell'handoff.**

- **Stato:** presa — vale per Schema Forge; da riusare come modello dagli altri agenti. Non modifica code-maniac, quindi non chiude la §1.

### 7. Le skill stanno in `agenti/`, `.claude/skills/` è uno specchio via junction

Claude Code carica le skill da `.claude/skills/`, ma la fonte di verità del repo è `agenti/`. Tenere due copie significa vederle divergere.

Scelta: **junction di Windows** (`New-Item -ItemType Junction`), che non richiede permessi di amministratore — a differenza dei link simbolici. La copia con script di riallineamento (`scripts/sync-skills.ps1`) era il piano B e **non è stata necessaria**.

Due dettagli che costano tempo se non si sanno:

- il target della junction deve essere un **percorso assoluto** (`(Resolve-Path "agenti\schema-forge").Path`); con un percorso relativo `New-Item` fallisce;
- git segue la junction e committerebbe gli stessi file due volte: `.claude/skills/` è in `.gitignore`.

Su una macchina senza junction (o su un checkout Linux/macOS) il piano B resta valido: copia + script di riallineamento.

- **Stato:** presa — da replicare per ogni nuovo agente che diventa skill.
