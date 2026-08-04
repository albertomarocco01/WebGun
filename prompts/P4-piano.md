# P.4 — Filo completo: piano di scomposizione

> Redatto dal direttore dei lavori il 2026-08-04, mentre P.3 e P.7c sono in corso.
> **Non è un mandato**: è il documento da cui si ricavano i cinque mandati operai,
> quando P.3 e P.7c saranno chiuse. Contabilità: `CANTIERE.md`, riga P.4.

## 1. Cosa deve dimostrare P.4 (e cosa no)

P.4 **non è «costruire un sito»**: costruire un sito lo sanno già fare cinque skill con
gate verdi. P.4 esiste per togliere una frase che sta, con parole quasi identiche, in
quattro `STATO.md` su cinque — *non usabile su un progetto cliente* — e per tre di loro
il motivo è **lo stesso**:

| agente | la frase, testuale | la toglie P.4? |
|---|---|---|
| flow-sentinel | «i flussi critici li ha proposti l'agente e confermati l'orchestratore, **mai un committente**» | **sì**, se firma Alberto |
| speed-demon | «l'elenco delle pagine che contano **l'ha firmato chi collaudava**, e il gate legge la firma, non la sua verità» | **sì**, se firma Alberto |
| vetrina-crafter | «il contratto della vetrina **l'ha firmato chi costruiva**» | **sì**, se firma Alberto |
| gestionale-crafter | «il gate conta le guardie, **non sa se chiedono il ruolo giusto**» (misurato, `COLLAUDO-2026-07-28` §7.2) | **no** — è un limite del gate, non della firma |
| schema-forge | punti aperti **11** (seed a caldo) e **15** (voci di reference); il **12** lo sta chiudendo P.7c | **no** |

Detto altrimenti: **P.4 chiude il motivo «la firma è nostra» per tre skill su cinque, e
non ne chiude nessun altro.** Chi legge il verbale di P.4 e conclude «la pipeline è
pronta per un cliente» sta leggendo più di quello che c'è scritto — e questa riga esiste
per impedirlo.

La seconda cosa che P.4 dimostra, e che nessun gate misura: che la **catena degli
handoff regge**. Cinque agenti, cinque documenti, ognuno letto dal successivo. Finora
ogni handoff è stato scritto e nessuno è mai stato *consumato in sequenza* per l'intera
catena — il caso più lungo mai eseguito è stato due anelli (schema-forge → gestionale).

## 2. P.4 non si parallelizza, e va detto prima

La D8 ammette in parallelo solo pacchetti con perimetri di **scrittura** disgiunti e
banchi distinti. I cinque sotto-pacchetti di P.4 scrivono **nella stessa cartella di
progetto** e pilotano **lo stesso stack Docker**, e l'ingresso di ciascuno è l'handoff
del precedente. Il parallelismo qui non è rischioso: è **impossibile**.

Conseguenza pratica: cinque chat **in sequenza**, con la verifica del direttore fra
l'una e l'altra (regola del cantiere: *un verde che il direttore non sa rilanciare vale
non provato*). È il pacchetto più lungo del cantiere e non c'è modo di accorciarlo
comprando parallelismo. L'unica compressione onesta è tenere P.4 come **unico** lavoro
attivo, così i gate misurano su una macchina scarica.

## 3. I cinque sotto-pacchetti

Profilo D4 per tutti: **Opus 5 · effort high** (esecuzione di skill già collaudate,
guidata dai gate). Non `max`: qui non si scrivono regole, si eseguono.

| # | Chi | Comandi | Il committente firma | Gate | Handoff |
|---|---|---|---|---|---|
| **P.4a** | schema-forge | `model` → `forge` → `seed` → `test` → `types` → `verify` → `handoff` | **Specchio del dominio** (STOP prima di ogni DDL) | `node <skill>/scripts/verify.mjs` — 9 passi | `docs/handoff/07-schema-forge.md` |
| **P.4b** | vetrina-crafter | `specchio` → `scaffold` → `pagine` → `audit` → `verify` → `handoff` | **`docs/vetrina.md`** — *cosa vede un anonimo*, **doppio STOP**, mai delegabile | `node <skill>/scripts/verify.mjs --url <url>` — 10 passi, su build di produzione | `docs/handoff/08-vetrina-crafter.md` |
| **P.4c** | gestionale-crafter | `specchio` → `scaffold` → `viste` → `contenuti` → `audit` → `verify` → `handoff` | **Specchio del gestionale** (ruoli, chi scrive cosa) | `node <skill>/scripts/verify.mjs` — 7 passi | `docs/handoff/10-gestionale-crafter.md` |
| **P.4d** | flow-sentinel | `map` → `forge` → `run` → `verify` → `handoff` | **`docs/flussi-critici.md`** — quali flussi non possono rompersi | `node <skill>/scripts/verify.mjs [--url] [--db-url]` — 7 passi | `docs/handoff/12-flow-sentinel.md` |
| **P.4e** | speed-demon | `measure` → `plan` → `tune` → `verify` → `handoff` | **`docs/performance.md`** — quali pagine contano e con quale soglia | `node <skill>/scripts/verify.mjs --url <url> [--giri N≥3]` — 7 passi | `docs/handoff/13-speed-demon.md` |

Regole che valgono per tutti e cinque, da ripetere in ogni mandato:

- **L'agente successivo legge tutti gli handoff precedenti prima di iniziare** (CLAUDE.md).
  Prova falsificabile che l'ha fatto: il suo handoff **cita un fatto del precedente che
  non avrebbe potuto inventare** (un nome di colonna, una deroga, un residuo).
- **Il gate di ogni agente che ha lavorato si rilancia dopo ogni fase**, non solo il
  proprio: a P.4e devono essere verdi tutti e cinque. È la «regola dei guardiani».
- `code-maniac scan` dopo ogni fase; `/code-inquisition --scope diff` su auth, pagamenti,
  dati utente.
- Ogni sotto-pacchetto chiude con un verbale nel repo di regia:
  `agenti/<agente>/PILOTA-2026-08-<gg>.md`, e il progetto resta dov'è.

## 4. I cinque STOP del committente

Alberto non è lo spettatore di P.4: è **dentro** il cammino critico cinque volte, e
finché non firma la catena non avanza. Elencati qui perché il tempo del committente è la
risorsa che il piano deve prenotare, non scoprire.

1. **Specchio del dominio** (P.4a) — il modello in italiano prima di una riga di DDL.
   Errore qui = tutta la catena costruita sopra la cosa sbagliata.
2. **`docs/vetrina.md`** (P.4b) — *cosa diventa visibile a un anonimo*. Doppio STOP,
   e la §6 di `DECISIONI.md` **non** lo delega: pubblicare non si annulla.
3. **Specchio del gestionale** (P.4c) — ruoli e chi scrive cosa. Delegabile per la
   parte reversibile, mai per la parte «chi può promuovere chi».
4. **`docs/flussi-critici.md`** (P.4d) — se manca un flusso, il test che manca non lo
   segnala nessuno: è l'unico documento in cui **l'omissione è invisibile al gate**.
5. **`docs/performance.md`** (P.4e) — pagine e soglie. Il gate legge la firma, non la
   sua verità: se l'elenco è sbagliato, il verde è vero e inutile.

**La firma.** Forma prescritta dai template, con **data ISO**:

```
Confermato da: Alberto Marocco (committente) il 2026-08-JJ
```

## 5. Pre-flight — cinque cose da provare *prima* di emettere P.4a

Nessuna è un dettaglio: quattro sono rischi mai misurati, e ognuna fermerebbe la catena
a metà se scoperta dopo.

1. **La firma di una persona vera passa i gate che la leggono.** Non è teoria: fra i 17
   difetti del collaudo avversario di speed-demon c'era il gate che **rifiutava**
   `Confermato da: Alberto Marocco, sviluppatore` e **accettava** `ORCHESTRATORE`. È
   stato corretto — `speed-demon/scripts/gate-lib.mjs:47` oggi accetta `(.+)`,
   `flow-sentinel/scripts/gate-lib.mjs:132` accetta `(\S.*?)`, vetrina-crafter passa da
   `valoreRiga` più una data ISO. **Sulla carta passano tutte e tre: si prova lo
   stesso**, con la riga esatta del §4, perché è la prima volta nella storia del repo
   che quella riga porta un nome proprio.
2. **I gate girano su un progetto fuori dall'albero della regia?** Mai provato: *tutti*
   i banchi sono sempre stati dentro `WebGun/`. Letto il codice (2026-08-04), la
   risposta è **sì per i gate, no per le skill**, e sono due cose diverse:

   - **I gate reggono.** Tutti e cinque separano `SKILL_DIR`, derivato da
     `import.meta.url`, da `process.cwd()`, che è il progetto. Invocati con un percorso
     assoluto dentro la regia risolvono le proprie risorse (`.sqlfluff`, `squawk.toml`,
     i template) ovunque sia il progetto. Attenzione a **speed-demon**, l'unico che
     esce dalla propria cartella: `AGENTI_DIR = dirname(SKILL_DIR)` (`gate-lib`/`verify`
     riga 55), perché `rete-verde` lancia il gate di flow-sentinel come sottoprocesso.
     Regge se invocato da `WebGun/agenti/speed-demon/…`; **da provare** se invocato
     dalla junction, dove `AGENTI_DIR` diventa `.claude/skills`.
   - **Le skill no.** `scripts/installa-skill.ps1` **non ha un parametro di
     destinazione**: `$destinazione = Join-Path $radice ".claude\skills"`, con
     `$radice` = la regia. Una chat operaia aperta sul repo pilota **non vedrebbe
     nessuna skill**. Va chiuso prima di P.4a — è il deliverable 1 di P.4-pre.
3. **Docker e le porte.** Il pilota vuole il suo stack: vetcare occupa 57321/57322,
   controtempo le sue, valscura le sue. Porte del pilota **scelte e scritte** nel
   `config.toml` prima di partire; e i banchi che non servono più si spengono, perché
   speed-demon misura tempi su una macchina condivisa (precedente del 2026-07-30: una
   porta dichiarata in un documento firmato ha fatto misurare **il sito di un'altra
   azienda**).
4. **Node.** Gate col `node` di sistema (20.12.2), batterie `node --test` col 24.18.1.
   Dopo P.0-igiene i gate parlano su entrambi: è una precauzione, non più un difetto.
5. **P.3 e P.7c chiuse.** P.4b userebbe il gate della vetrina *corretto dal collaudo
   avversario*, non quello di oggi; e P.7c chiude semgrep/gitleaks e `/code-inquisition`
   sugli script — cioè i guardiani che P.4 invoca a ogni fase.

## 6. Criterio di accettazione di P.4 nel suo insieme

1. **Cinque gate verdi, ognuno rilanciato dal direttore** in proprio.
2. **Catena 07 → 08 → 10 → 12 → 13** completa, e ogni handoff cita un fatto verificabile
   del precedente.
3. **Cinque righe `Confermato da:`** col nome del committente e la data ISO.
4. Un verbale di catena — `PILOTA-<data>.md` alla radice della regia — che dichiara
   **cosa si è rotto fra un anello e l'altro**. Se non si è rotto niente, il verbale lo
   dice e diventa la prima prova che la catena regge; se si è rotto, ogni rottura è un
   punto aperto con l'agente che la eredita. *Un filo completo senza attriti dichiarati è
   un filo che nessuno ha guardato.*
5. **Le tre frasi del §1 riscritte** negli `STATO.md` di vetrina-crafter, flow-sentinel e
   speed-demon — e **le due che restano, restano**.

## 7. Cosa resta fuori, dichiarato

- **Il deploy** (D2): P.4 si ferma a speed-demon. Il deploy del pilota sarà il collaudo
  di **P.5 launchpad**, e resta comunque a checkpoint umano (`DECISIONI.md` §6).
- **site-doctor** (P.6), **cyber-shield**, **ai-specialist**: non esistono.
- **Prompt Smith**: il ruolo lo fa Alberto, orchestrato dal direttore (rotta n°4).
- **Il difetto noto di gestionale-crafter** (il gate conta le guardie, non sa se
  chiedono il ruolo giusto): P.4 non lo chiude. Sul pilota va **dichiarato in
  `docs/DEBITO-TECNICO.md`**, non aggirato.

## 8. Le due decisioni del committente — prese il 2026-08-04

- **Dominio: pizzeria con ordini d'asporto** (`CANTIERE.md` **D10**). Menu pubblico,
  ordinazione d'asporto, ruoli **titolare / cucina**, contenuti editabili. Il flusso
  critico è un **ordine con macchina a stati** (ricevuto → in preparazione → pronto),
  non una prenotazione: vetcare e valscura hanno già provato quella, e una classe di
  flusso mai attraversata è l'unica che può far emergere ciò che le reference danno per
  scontato. **Fuori perimetro: il pagamento** — nessun agente lo copre, e l'ordine si
  paga al ritiro. Va scritto nel `PROGETTO.md` del pilota, non lasciato implicito.
- **Casa: repo separato** (`CANTIERE.md` **D11**), come prescrive il `CLAUDE.md`. Il
  pilota è anche il candidato al deploy di P.5: dentro la regia sarebbe un
  `banco-prova-*` che la §25 imporrebbe di cancellare a fine P.4, cioè si butterebbe
  proprio il progetto che P.5 deve pubblicare. Il costo è dichiarato ed è il §5 punto 2.

## 9. P.4-pre — il pacchetto che apre la strada (Sonnet 5 · high)

Piccolo, meccanico, ben specificato: profilo D4 da minuteria. Va **prima** di P.4a e non
tocca nessun perimetro contestato.

1. **`scripts/installa-skill.ps1` impara una destinazione.** Parametro opzionale
   (`-Destinazione <percorso>`, default il comportamento di oggi), così il repo pilota
   riceve le junction verso `WebGun/agenti/`. Il gate della regia (`skill-elencate`)
   deve restare **verde**: legge questo file, e va verificato che il parametro non gli
   spezzi la lettura dell'elenco.
2. **Prova che un gate parla da fuori.** Da una cartella qualsiasi fuori da `WebGun/`,
   `node C:\...\WebGun\agenti\schema-forge\scripts\verify.mjs` deve **uscire 2 con il
   messaggio** (non 0 muto: è la regressione che P.0-igiene ha chiuso), e la stessa
   prova **dalla junction** per speed-demon, che è quello con `AGENTI_DIR`.
3. **Prova che la firma di una persona passa.** La riga esatta del §4 data in pasto ai
   tre gate che la leggono (vetrina, flow-sentinel, speed-demon), su un contratto
   minimo: accettata da tutti e tre, e **rifiutata** quando è il segnaposto `{{…}}`.
   Due direzioni, come si fa qui.
4. **Porte e stack.** Porte del pilota scelte e libere (vetcare 57321/57322, controtempo
   e valscura le loro); banchi non necessari spenti prima di P.4e.
5. Verbale breve nel repo di regia; nessuna riga di `CANTIERE.md` (la scrive il direttore).
