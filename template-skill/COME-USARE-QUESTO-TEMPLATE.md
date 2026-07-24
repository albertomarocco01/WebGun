# Come usare questo template

Istruzioni per chi crea un agente nuovo di Web Gun. Il riferimento di qualità è `agenti/code-maniac`: guardalo quando hai un dubbio su come si struttura una skill fatta bene.

## Passi

1. **Copia la cartella** `template-skill/` in `agenti/<nome-agente>/` (nome in kebab-case, in inglese).
2. **Rinomina e compila il frontmatter** di `SKILL.md`:
   - `name`: il nome kebab-case della skill.
   - `description`: deve dire **QUANDO attivare la skill**, con verbi e casi d'uso concreti — è il criterio con cui Claude Code decide di caricarla. "Progetta schemi DB" è debole; "Usala quando devi creare o modificare tabelle, relazioni, RLS o seed su Supabase" è giusto.
3. **Scrivi PRIMA il Gate di chiusura**: la checklist di cosa deve essere vero a lavoro finito. Ogni voce verificabile (un comando che passa, un file che esiste), mai un'opinione. Se non sai scrivere il gate, non sai ancora cosa fa l'agente: fermati e chiarisci.
4. **Scrivi il flusso operativo a ritroso** partendo dal gate: quali passi portano ogni voce della checklist da falsa a vera? Numera i passi; segna **STOP** dove serve conferma umana.
5. **Compila "Leggi/Principi"**: 2-4 regole non negoziabili. Poche e ferree.
6. **Compila la tabella Comandi** solo per i comandi che esistono davvero. Niente comandi speculativi.
7. **Popola `references/`** con la conoscenza dettagliata (protocolli, checklist estese) e `scripts/` con gli strumenti deterministici. Aggiorna l'indice references in SKILL.md. Se una cartella resta vuota, lascia il `.gitkeep`.
8. **Aggiorna `STATO.md`** dell'agente: stato, proprietario, dipendenze.
9. **Verifica finale**: leggi lo SKILL.md come se fossi Claude Code a freddo. Capisce quando attivarsi? Sa cosa deve essere vero alla fine? Se no, torna al punto 2.

## Regole trasversali

- Tutto in **italiano** tranne nomi di file, cartelle e comandi.
- L'agente rispetta il contratto di `CLAUDE.md` (root del repo): handoff in `docs/handoff/`, Regola dei guardiani, stack standard.
- Niente flussi inventati "per completezza": ciò che non è ancora deciso resta `<!-- TODO -->`.
