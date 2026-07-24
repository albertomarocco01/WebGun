# CLAUDE.md — Contratto operativo Web Gun

## Contesto in 3 righe

Web Gun è una pipeline di agenti specializzati che produce siti web professionali a partire da un prompt.
Questo repo è la **regia**: orchestrazione, skill degli agenti e template — **non è un sito**.
I siti veri vengono generati in repo separati, uno per progetto cliente; qui si costruiscono e coordinano gli agenti che li producono.

## Stack standard dei progetti generati

Stack di default per ogni sito prodotto da Web Gun:

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS**
- **Supabase** (database e auth)

È modificabile per singolo progetto, ma la deroga **va motivata per iscritto** nel `docs/PROGETTO.md` del progetto generato (es. il cliente impone un CMS diverso, requisiti che Supabase non copre).

## Struttura standard di un progetto generato

```
progetto/
├── src/
│   ├── app/                  # routing e pagine (App Router) — solo composizione, niente business logic
│   ├── components/           # componenti UI riusabili e trasversali
│   ├── modules/<dominio>/    # logica di business per dominio (es. modules/catalogo, modules/ordini)
│   └── lib/                  # client condivisi (supabase, utility)
├── docs/                     # documentazione generata (PROGETTO, struttura_directory, ROADMAP, DEBITO-TECNICO…)
│   └── handoff/              # passaggi di consegne tra agenti (vedi sotto)
├── public/                   # asset statici
└── supabase/                 # migrazioni SQL, seed, policy RLS
```

Regole di collocazione (da `agenti/code-maniac/resources/templates/struttura_directory.md`):
- L'entry-point (routing/pagine) **compone** soltanto: niente logica di business.
- Componenti di business → cartella di feature dedicata, mai nuove cartelle top-level inventate.
- Le dipendenze vanno in **una direzione** (UI → logica → dati): nessun import ciclico.

## Passaggio di consegne tra agenti

Ogni agente che completa una fase **scrive** nel progetto generato un file:

```
docs/handoff/<numero>-<nome-agente>.md
```

(es. `docs/handoff/07-schema-forge.md`). Contenuto obbligatorio:

1. **Cosa ha fatto** — elenco concreto dei deliverable prodotti.
2. **Decisioni prese** — con motivazione, specialmente le deroghe.
3. **Cosa si aspetta faccia il successivo** — input pronti, punti di aggancio.
4. **Problemi noti** — residui, workaround, debito lasciato.

L'agente successivo **DEVE leggere gli handoff precedenti prima di iniziare**. Nessun agente parte "alla cieca".

## Convenzioni di codice

Fonte unica, non duplicata qui:

- `agenti/code-maniac/references/best-practices.md` — convenzioni e checklist "fatto"
- `agenti/code-maniac/references/costituzione.md` — priorità: correttezza > sicurezza > leggibilità/tracciabilità > type-safety > accessibilità > minimalismo > performance

In caso di conflitto tra regole vince la priorità più alta della costituzione.

## Regola dei guardiani

Dopo **ogni fase di costruzione**:

1. Lanciare `code-maniac scan` (batteria deterministica: lint, tipi, complessità, codice morto, duplicati, segreti).
2. Sui punti critici (auth, pagamenti, dati utente, deploy) lanciare `/code-inquisition --scope diff`.

**Nessun handoff è valido** senza scan pulito **oppure** residuo documentato (nel file di handoff e in `docs/DEBITO-TECNICO.md`).
