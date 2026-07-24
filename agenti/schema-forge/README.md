# Schema Forge

Agente Web Gun per la progettazione dello schema dati (Postgres/Supabase). Primo agente costruttore della pipeline: tutto ciò che viene dopo si appoggia a ciò che decide qui.

## Installazione

Copia la cartella tra le skill di Claude Code (`~/.claude/skills/schema-forge` oppure `.claude/skills/schema-forge` nel progetto).

## Prerequisiti

```bash
supabase --version   # Supabase CLI + Docker attivo
psql --version       # client Postgres
pipx install sqlfluff squawk-cli   # consigliati
```

## Uso rapido

```bash
node scripts/verify.mjs            # il gate: applica su DB pulito + batteria deterministica
node scripts/rls-audit.mjs         # solo l'audit di sicurezza
node scripts/erd.mjs --out docs/schema/ERD.md
```

Comandi dell'agente: `model`, `forge`, `rls`, `seed`, `verify`, `types`, `evolve`, `handoff` — dettagli in `SKILL.md`.
