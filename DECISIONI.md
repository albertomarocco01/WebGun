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
