# Mandato P.2-ripresa — vetrina-crafter riprende dal banco

> Emesso dal direttore dei lavori il 2026-08-03. Da incollare in una chat operaia nuova.
> **Modello consigliato: Opus 5 · effort max.**
> Contabilità: `CANTIERE.md` (voci del 2026-08-03, decisione D8).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Riprendi la
**COSTRUZIONE (P1)** di `vetrina-crafter` dal punto in cui si era fermata.

**Dove eravamo.** I deliverable 1-3 sono consegnati (commit `b7fa58f`, `43ff29f`,
`2697787`): quattro references di mestiere, `scripts/` completo (gate a 10 passi con id
stabili, lib pure, guscio) e **113 test verdi, rilanciati dal direttore**. Il pacchetto
si era fermato al deliverable 4 (il banco) per due prerequisiti fuori dal suo perimetro,
**oggi entrambi chiusi e collaudati**:

- **P.0-igiene**: i gate delle quattro skill storiche girano col `node` di sistema;
- **P.8**: schema-forge **emette privilegi espliciti** — il comando `forge` ora
  prescrive la migrazione `revoke`+`grant` per `anon`/`authenticated`/`service_role`.
  Il tuo banco nascerà leggibile dall'anonimo dove il modello di accesso lo dice, cioè
  il tuo passo 9 `contenuti-vivi` misurerà la vetrina e non un difetto altrui.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`; `CANTIERE.md` — le voci del 2026-08-03 e la decisione **D8**.
2. **`agenti/vetrina-crafter/prompts/P1-costruzione.md` — il tuo mandato originale.**
   Valgono per intero i deliverable **4-9**, le tre correzioni d'apertura (già
   applicate in P1 parziale: verificale, non rifarle), le regole d'ingaggio e il
   verbale di chiusura.
3. Tutta `agenti/vetrina-crafter/`: `SKILL.md`, `STATO.md` (con le **tre decisioni
   sospese S1-S3**), `references/verifica-deterministica.md`, i template, gli
   `scripts/` già scritti coi loro test.
4. `agenti/schema-forge/COME-PROVARLA.md`, `SKILL.md` (il comando `forge` **dopo P.8**:
   §I privilegi si scrivono, non si ereditano) e `STATO.md` §Note operative (Windows).

## Da fare

1. **I deliverable 4-9 del mandato originale**, invariati: banco via schema-forge
   (Flusso 1, con tabella dei contenuti, seed e policy per `anon`), la vetrina costruita
   col flusso vero della skill, **tutti e 7 i comandi esercitati**, sabotaggio per i
   passi elencati, gate **VERDE 10/10** sul banco pulito, `STATO.md` + verbale
   `COSTRUZIONE-<data>.md`, e — solo a gate verde — `README.md` + `installa-skill.ps1`.
2. **Il banco DEVE contenere la migrazione dei privilegi espliciti** che schema-forge
   ora prescrive; se `forge` non te la produce, è un difetto di P.8 da riportare al
   direttore, non da aggirare a mano.
3. **Chiudi con la misura le tre decisioni sospese**, e scrivi la scelta nella
   specifica con la misura accanto:
   - **S1** — slot dichiarato senza riga pubblicata: `block` o MANCANTE (prova i due
     casi sul banco);
   - **S2** — la soglia distintiva (ripiego 24): tarala sugli slot veri del banco e
     dichiara quanti resterebbero fuori;
   - **S3** — i due rilievi sulle date (firma vs handoff di schema-forge; build vs
     sorgenti): misura la frequenza dei falsi positivi previsti.

## Ambiente

- Docker acceso; **`banco-prova-vetcare` occupa le porte 57321/57322 e NON si tocca**:
  il tuo stack usa le porte del suo `config.toml` (diverse).
- I gate girano col `node` di sistema (P.0-igiene). Le **batterie** `node --test`
  vogliono `~/scoop/apps/nodejs-lts/current/node.exe` (il glob su Node 20 non si
  espande).
- `sqlfluff` 4.2.2 e `squawk` 2.61.0 sono installati (pipx): il gate di schema-forge
  sul tuo banco deve chiudere **senza verifiche mancanti**.

## Coordinamento (D8 — altre chat lavorano in parallelo)

- Committa **solo i tuoi percorsi** con `git add` espliciti — **mai** `git add -A`,
  **mai** `git commit -a`: l'index è condiviso con le altre chat.
- **Non toccare**: `CANTIERE.md` (la contabilità la scrive il direttore), `prompts/` di
  radice, `scripts/` di radice, `webgun_content.txt`, gli altri agenti.
- Commit frequenti e mirati; se nel log compaiono commit di altre chat, è normale.

## Verbale di chiusura

Come da mandato originale: numeri misurati, comandi 7/7 (o quali no e perché), uscita
del gate incollata, premesse smentite, cosa non è stato fatto, e la riga finale
`P1 consegnata. Gate: VERDE (0 falliti, 0 verifiche mancanti su 10 passi)` — o il rosso
vero, se è rosso. In più: le tre righe di chiusura di S1, S2, S3 con la misura.
