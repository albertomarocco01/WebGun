# Struttura delle Directory — {{NOME_PROGETTO}}

> Generato da Code Maniac `init` · {{DATA}}. **Documento deterministico:** rigenerabile a ogni commit. Non modificarlo a mano — modifica il codice, poi rigenera con `node <skill>/scripts/tree.mjs [--depth N]` (albero da `git ls-files`, rispetta `.gitignore`).

## Mappa

<!-- Rigenera con: node <skill>/scripts/tree.mjs --depth 3   →  incolla qui sotto. -->
```
{{ALBERO_CARTELLE}}
```

## Responsabilità per cartella

| Cartella | Responsabilità | Cosa NON ci va |
|---|---|---|
{{TABELLA_RESPONSABILITA}}

## Regole di collocazione

- L'entry-point (routing/pagine) **compone** soltanto: niente logica di business.
- Componenti di business → cartella di feature dedicata, mai nuove cartelle top-level inventate.
- Le dipendenze vanno in **una direzione** (UI → logica → dati): nessun import ciclico.
- Verifica deterministica: `dependency-cruiser` / `madge`.

## Note dal grafo (graphify)

{{NOTE_GRAFO}}
<!-- es. community principali, nodi-cardine (god nodes), accoppiamenti inattesi -->
