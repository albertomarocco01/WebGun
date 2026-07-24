# Stato — Schema Forge

- **Stato attuale:** v1 — leggi, comandi, flusso, gate e script deterministici scritti. Da collaudare su un progetto Supabase reale.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: prompt-smith (richiesta professionale), brief-smith (entità e contenuti del cliente)
  - A valle: fly-ui (costruisce sulle tabelle e sui tipi generati), gestionale-crafter (CRUD), sanity-creator (mappa i contenuti sul modello), ai-specialist (RAG sui dati)
- **Guardiani:** code-maniac e code-inquisition valutano l'SQL e gli script come qualsiasi altro codice.

## Da collaudare prima di dichiararlo pronto

- [ ] `scripts/verify.mjs` su un progetto Supabase vero, con Docker attivo (qui testato solo il percorso "strumenti assenti")
- [ ] `scripts/rls-audit.mjs` su uno schema con RLS reale: verificare che le 6 regole non diano falsi positivi
- [ ] `scripts/erd.mjs`: controllare che il Mermaid generato sia valido su uno schema con più chiavi esterne
- [ ] Un giro completo del Flusso 1 su un e-commerce di prova, dal brief all'handoff

## Decisioni prese

- Lo Specchio del dominio ha due modalità (interattiva / pipeline): in pipeline conferma l'orchestratore, ma il modello assunto viene **scritto** nell'handoff. I distruttivi restano sempre checkpoint umano. Risponde a `DECISIONI.md` §1 senza toccare code-maniac.
- La verifica passa dal database reale (`supabase db reset`), non dalla lettura dell'SQL: uno strumento assente produce `skipped`, mai `pass`.
