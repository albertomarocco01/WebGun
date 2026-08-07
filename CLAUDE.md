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
3. **Lanciare il gate di ogni agente che ha lavorato**, dalla radice del progetto generato. Non ce n'è uno solo: al 2026-08-07 ne esistono sette, e ognuno prova una cosa che gli altri non guardano.

   | Chi ha costruito | Comando | Passi | Cosa prova |
   |---|---|---|---|
   | schema-forge | `node <skill>/scripts/verify.mjs` | 9 | applica le migrazioni su un database pulito vero, poi db lint, `db advisors`, audit RLS, pgTAP, tipi |
   | vetrina-crafter | `node <skill>/scripts/verify.mjs [--url]` | 10 | l'app servita è **questa** build, le pagine servite sono quelle firmate nel contratto, e l'anonimo legge solo ciò che uno slot dichiara |
   | gestionale-crafter | `node <skill>/scripts/verify.mjs` | 7 | nessuna rotta admin senza guardia, permessi, `tsc`, a11y |
   | flow-sentinel | `node <skill>/scripts/verify.mjs [--url] [--db-url]` | 7 | la batteria E2E è girata davvero contro l'app vera, e ogni flusso dichiarato ha una spec che lo attacca |
   | speed-demon | `node <skill>/scripts/verify.mjs --url <url>` | 8 | si misura una build di produzione, ed è **quella di questo progetto** (confronto del `.next/BUILD_ID`); più il contrasto del testo letto dall'audit `color-contrast`, non dal punteggio di categoria |
   | launchpad | `node <skill>/scripts/verify.mjs [--url]` | 9 | si può pubblicare? segreti (HEAD **e** storia), impronta derivata dal commit, verdetti a monte, registro col `Blocca il deploy:`, runbook firmato da un umano |
   | site-doctor | `node <skill>/scripts/verify.mjs [--url]` | 14 | conformità che nessun altro guarda: informativa, basi giuridiche, cosa si archivia nel browser, a11y dell'HTML servito, favicon, Open Graph, JSON-LD, sitemap, robots, proprietà di ogni voce |

   Il gate deve essere **verde** prima dell'handoff. Uno strumento assente vale `MANCANTE`, non `PASS`: un gate rosso per verifiche mancanti resta rosso.

**Nessun handoff è valido** senza scan pulito **oppure** residuo documentato (nel file di handoff e in `docs/DEBITO-TECNICO.md`). Vale anche per il gate di `verify.mjs`.
