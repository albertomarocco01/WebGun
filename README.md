# Web Gun

**Web Gun** è una pipeline di agenti specializzati che produce siti web professionali a partire da un prompt. Ogni agente copre una fase precisa del lavoro — dalla raccolta materiali del cliente al deploy finale — e passa le consegne al successivo tramite documenti di handoff. Questo repo è la "regia": contiene l'orchestrazione, le skill degli agenti e le fondamenta per quelli ancora da creare; non è un sito.

Ci lavora un team: ogni agente ha un proprietario che lo sviluppa e lo mantiene. Alcuni agenti sono snapshot di repo esterni (vedi [Fonte di verità](#fonte-di-verità)), altri nascono e vivono direttamente qui. La guida operativa di installazione e uso è in [HOWTORUN.md](HOWTORUN.md); il contratto operativo tra agenti è in [CLAUDE.md](CLAUDE.md).

---

## Pipeline

**Legenda:**
🟢 **VERDE** = ce l'ho
🔴 **ROSSO** = me lo devono mandare
🔵 **BLU** = da creare

### FASE 0 — Commerciale / Raccolta materiali

1. 🔵 **Brief Smith**
   Raccoglie automaticamente dal cliente logo, palette colori, immagini, testi e informazioni. È il carburante iniziale: tutto quello che Web Gun deve sapere prima di sparare.
2. 🔵 **Preventivo Smith**
   Calcola e genera il preventivo dettagliato con tempistiche e costi. Utile prima di iniziare, così il cliente firma e la pipeline parte con requisiti chiari.

### FASE 1 — Ingresso della richiesta

3. 🔴 **Prompt Smith**
   Il cancello d'ingresso: trasforma gli appunti in italiano in un prompt professionale in inglese e lo smista agli agenti specializzati. È l'orchestratore della richiesta.

### FASE 2 — Guardiani del codice (SEMPRE ATTIVI)

*Si attivano da subito e vigilano su tutto quello che gli agenti costruttori producono, per tutta la durata del progetto.*

4. 🟢 **Code Maniac**
   È una skill per Claude Code che impone disciplina, garantendo un codice pulito, rintracciabile ed efficiente nei token. Applica le "Tre Leggi": riformula la richiesta prima di agire, sfrutta strumenti deterministici (lint, type check) prima di usare l'LLM e produce il minimo indispensabile (YAGNI). Organizza, ottimizza e gestisce il debito tecnico senza sprechi.
5. 🟢 **Code Inquisition**
   Un vero e proprio tribunale di esperti AI che esamina il codice a fondo (sicurezza, performance, architettura). Non modifica direttamente il codice, ma convoca un gruppo di agenti specializzati che si confrontano e verificano le accuse tramite strumenti reali. Elimina i falsi positivi e produce un report chiaro (con verdetto, problemi provati e piano d'azione da attuare).
6. 🟢 **Bug Bay**
   Debugging agentico installabile in qualsiasi webapp tramite l'inserimento di un singolo `<script>`. Lancia un daemon in locale che apre una console di triage per i bug segnalati via widget. Permette la risoluzione tramite AI mostrando in anteprima il `diff` del fix proposto (che puoi approvare con un commit o scartare). Essendo un approccio "hub-and-spoke", puoi aggregare i bug di più progetti su un DB centrale (es. Supabase), mantenendo l'esecuzione del fix in locale su ogni progetto.

### FASE 3 — Costruzione (dati → interfaccia → funzioni)

7. 🟢 **Schema Forge**
   Progetta lo schema del database: tabelle, relazioni, vincoli, indici, RLS e seed. Si parte da qui perché in un e-commerce i dati (prodotti, ordini, utenti) sono le fondamenta. Applica tre leggi: il modello prima del DDL (riformula il dominio in italiano e si ferma finché non ottiene conferma), il database è il giudice (nessuna migrazione è valida se non è stata applicata davvero su un database pulito e passata a una batteria di nove controlli deterministici), nessuna tabella nuda (RLS attiva e policy esplicite alla nascita di ogni tabella — su Supabase una tabella senza RLS è pubblicata su internet). Evolve gli schemi esistenti in expand-contract, con analisi di impatto sui dati veri e checkpoint umano su ogni operazione distruttiva. Manuale: `agenti/schema-forge/README.md`.
8. 🟢\*\*\*\*\* **Vetrina Crafter**
   Costruisce il **sito pubblico** sopra lo schema di Schema Forge: le pagine che vede chi non ha un account — home, catalogo, scheda di dettaglio, chi siamo, contatti — con i componenti scritti a mano dietro la cucitura `src/components/ui/`, la lettura dei dati con la **chiave anonima**, e i testi delle sezioni presi dalle tabelle dei contenuti invece che dal codice. Tre leggi: il modello prima delle pagine (Specchio della vetrina, con STOP — e *cosa diventa visibile a un anonimo* resta sempre di un umano, perché pubblicare non si annulla), giudica l'app servita e non il sorgente (gate a dieci passi su una build di produzione di **questo** progetto, riconosciuta dal suo `BUILD_ID`), niente testo cablato dove il cliente deve poterlo cambiare e nessuna chiave che scavalchi le policy. Manuale: `agenti/vetrina-crafter/SKILL.md`.
9. 🟢 **Sites Effects**
   Libreria con UI degli effetti applicabili ai siti. Aggiunge animazioni e microinterazioni sopra l'interfaccia base per dare carattere al sito.
10. 🟢\*\* **Gestionale Crafter**
    Crea il pannello gestionale / backoffice sopra lo schema di Schema Forge: viste CRUD protette da autenticazione e ruolo, e i testi delle sezioni del sito che il cliente cambia da solo (l'eredità del CMS che la pipeline non ha più). Tre leggi: il modello prima delle viste (Specchio, con STOP), gli strumenti giudicano (gate a 7 passi su un progetto vero), nessuna rotta admin nuda e nessuna scorciatoia sulla RLS — la chiave `service_role` non entra nel progetto. Manuale: `agenti/gestionale-crafter/COME-PROVARLA.md`.
11. 🔵 **AI Specialist**
    Integra assistenti IA, RAG e agenti autonomi nel sito: ad esempio il chatbot che guida i clienti dell'e-commerce tra prodotti e ordini.

### FASE 4 — Test e performance

12. 🟢\*\*\* **Flow Sentinel**
    Genera ed esegue test End-to-End con Playwright sui flussi critici prima del lancio. Tre leggi: il contratto dei flussi lo conferma un umano (`docs/flussi-critici.md`, con STOP), giudica il browser su app vera e database seminato, e un test che non può fallire non è un test — ogni flusso di scrittura asserisce l'effetto nel database, i flussi ostili provano i confini d'accesso dal browser. Se il checkout si rompe, lo scopre lui e non il cliente.
13. 🟢\*\*\*\* **Speed Demon**
    Ottimizza velocità, SEO, metatag e performance puntando al 100/100 Lighthouse. Va lanciato a sito completo, perché ottimizzare prima è lavoro sprecato.

### FASE 5 — Sicurezza e conformità

14. 🔵 **Cyber Shield**
    Specializzato in cybersecurity: verifica vulnerabilità, permessi, esposizione di dati e configurazioni pericolose prima della messa online.
15. 🔵 **Site Doctor**
    Scanner pre-produzione di conformità: cookie/GDPR e privacy, accessibilità (alt, contrasti, HTML semantico), Open Graph per le anteprime social, hreflang multilingua, favicon, robots.txt e sitemap. In pratica: il certificato di idoneità del sito prima del lancio.

### FASE 6 — Lancio e vendita

16. 🔵 **Launchpad**
    Deployment 1-click su Vercel/Cloudflare con DNS, domini e certificati SSL. L'ultimo miglio: dal codice al sito online.
17. 🟢 **DemonIAc**
    Genera automaticamente video demo con Remotion da mostrare alle aziende. Opzionale nella pipeline: serve per vendere il risultato, non per costruirlo.

### ALTRI (fuori pipeline Web Gun)

*Progetti utili ma non parte della catena di produzione siti:*

- 🟢 **Maps Scraper:** Trova aziende e attività in tutto il mondo, con o senza sito web, e invia email automaticamente. È il motore commerciale che procura i clienti a Web Gun.
- 🟢 **Aisthenics:** Assistente per allenatori di Calisthenics con IA integrata.
- 🔴 **Everything Scraper:** Scraper online sempre attivo di qualsiasi prodotto: macchine, PC, telefoni…
- 🔴 **Agent Crafter:** Creatore e configuratore di agenti e assistenti IA su misura.
- 🔴 **Super Teacher:** Gli chiedi un argomento e te lo spiega in modo ultra dettagliato.
- 🔴 **Brainer:** Second brain personale.
- 🔴 **Projentic:** (In arrivo / Da farsi spiegare)
- 🔴 **Flowtastic:** (In arrivo / Da farsi spiegare)

---

## Natura degli agenti

| Nome | Categoria | Stato | Proprietario | Repo di origine |
|---|---|---|---|---|
| code-maniac | Skill Claude Code | 🟢 | finzidev | https://github.com/finzidev/code-maniac |
| code-inquisition | Skill Claude Code | 🟢 | finzidev | esterno (finzidev, URL non noto) |
| schema-forge | Skill Claude Code | 🟢\* | Alberto | questo repo |
| site-doctor | Skill Claude Code | 🔵 | — | questo repo |
| brief-smith | Skill Claude Code | 🔵 | — | questo repo |
| preventivo-smith | Skill Claude Code | 🔵 | — | questo repo |
| gestionale-crafter | Skill Claude Code | 🟢\*\* | Alberto | questo repo |
| vetrina-crafter | Skill Claude Code | 🟢\*\*\*\*\* | Alberto | questo repo |
| ai-specialist | Skill Claude Code | 🔵 | — | questo repo |
| speed-demon | Skill Claude Code | 🟢\*\*\*\* | Alberto | questo repo |
| flow-sentinel | Skill Claude Code | 🟢\*\*\* | Alberto | questo repo |
| cyber-shield | Skill Claude Code | 🔵 | — | questo repo |
| launchpad | Skill Claude Code | 🔵 | — | questo repo |
| prompt-smith | Skill Claude Code | 🔴 | — | esterno (in arrivo) |
| bugbay | Prodotto/Strumento | 🟢 | finzidev | https://github.com/finzidev/bugbay |
| demoniac | Prodotto/Strumento | 🟢 | — | esterno |
| fly-ui | Libreria | 🔴 | — | esterno (in arrivo) — **eventuale**: non è più al posto 8 della pipeline, e non è una dipendenza di nessuno (`DECISIONI.md` §21). Se un giorno arriverà, entra **dentro la cucitura** `src/components/ui/` che vetrina-crafter scrive a mano: si riscrive il corpo di quei file, non le pagine |
| sites-effects | Libreria | 🟢 | — | esterno |

Il proprietario è chi sviluppa e mantiene l'agente; `—` significa non ancora assegnato. Ogni agente lo ripete nel proprio `agenti/<nome>/STATO.md`.

\* **schema-forge è 🟢 come strumento, non come agente pronto alla consegna.** Il gate è collaudato su database reale (144 test, 9 passi, due collaudi avversari), ma `agenti/schema-forge/STATO.md` lo dichiara **non ancora usabile su un progetto cliente**: restano aperti i punti 11, 12 e 15. Il punto 13 è **chiuso**: il consumatore a valle esiste — gestionale-crafter ha costruito un backoffice reale sopra uno schema di questa skill e `evolve` ha girato con codice applicativo sopra, dove il controllo più forte si è rivelato `tsc` sui tipi rigenerati (15 errori in 4 file, nessuno arrivato a runtime). Chi lo usa legga prima `agenti/schema-forge/COME-PROVARLA.md` §4, *Cosa NON dimostra un gate verde*.

\*\* **gestionale-crafter è 🟢 come strumento, non come agente pronto alla consegna.** Due collaudi su banchi reali il 2026-07-28 (e-commerce e accademia musicale), 105 test sugli script, gate a 7 passi, 6 difetti piantati su 6 rilevati e zero falsi positivi sul gemello pulito. Ma `agenti/gestionale-crafter/STATO.md` lo dichiara **non ancora usabile su un progetto cliente**: il gate conta le guardie, non sa se chiedono il ruolo giusto — e questo è **misurato**, non temuto (`COLLAUDO-2026-07-28.md` §7.2). Chi lo usa legga prima `COME-PROVARLA.md` §4, *Cosa NON dimostra un gate verde*.

\*\*\*\* **speed-demon è 🟢 come strumento, non come agente pronto alla consegna.** Costruito il 2026-07-30 su `banco-prova-negozio` e **collaudato in modo avversario lo stesso giorno da una sessione indipendente**, su un secondo banco costruito apposta con pagine davvero lente (`banco-prova-immobiliare`): 73 test sugli script, gate a 7 passi, due banchi. Sulla costruzione ha trovato **tre difetti SEO veri** su un progetto che Lighthouse valutava **SEO 100**. Il collaudo avversario ne ha trovati **diciassette nella skill**, tutti misurati prima di essere corretti: dodici falsi verdi — fra cui `seo-meta` che chiudeva **verde su quattro pagine di cui tre rotte** — e quattro rifiuti indebiti tutti dello stesso ceppo, cioè **il gate non sapeva leggere il contratto che il suo stesso template insegna a scrivere**, e rifiutava perfino una firma umana con nome e ruolo. Sei dei diciassette erano **già descritti dentro le references della skill** e non implementati: la prosa sapeva, il codice no. Il diciassettesimo non era stato cercato: la porta che un contratto firmato dichiarava era occupata, su quella macchina, dal sito **di un'altra azienda** — `--url` obbligatorio impedisce al gate di *indovinare* la porta, non di *sbagliarla*. Lì `plan` e `tune` sono stati esercitati per la prima volta su guadagni misurati (home `performance 77 → 100`, LCP 5 496 → 746 ms, peso 6,31 → 0,47 MB). Il gate corretto è stato **rilanciato su `banco-prova-negozio`** e chiude **VERDE 7/7**: nessuna regressione, e `rete-verde` — la seconda legge della skill — ha finalmente girato dentro questo gate, verde sull'app giusta e rosso quando lo si punta su un'altra. Resta **non usabile su un progetto cliente**, e il motivo non è più un difetto della skill: su tutti e due i banchi **l'elenco delle pagine che contano l'ha firmato chi collaudava**, e il gate legge la firma, non la sua verità. Verbali: `COSTRUZIONE-2026-07-30.md` · `COLLAUDO-AVVERSARIO-2026-07-30.md`.

\*\*\* **flow-sentinel è 🟢 come strumento, non come agente pronto alla consegna.** Costruito e collaudato in modo indipendente il 2026-07-28, poi **usato su un consumatore reale il 2026-07-30**: 108 test sugli script, gate a 7 passi con id stabili, 10 difetti trovati dal collaudo avversario e corretti uno per commit (7 erano falsi verdi). Il terzo banco — `banco-prova-negozio`, l'unico **scritto da altri agenti** — ha dato batteria 16/16 e gate 7/7, ma solo dopo aver scoperto che **nessuno riusciva ad accedere al gestionale** che due gate verdi avevano già firmato, e che il passo `app-viva` dichiarava viva l'app di un altro progetto. Resta **non provato su un progetto cliente**: il contratto dei flussi l'ha confermato l'orchestratore, non un committente. Il comando `evolve` invece è stato eseguito — 2026-07-30, 5 casi su 5 combacianti col gate — e ha trovato il proprio limite: un flusso che cambia nel **corpo** tenendo lo stesso id il gate non lo vede, perché legge le intestazioni. Verbali: `COSTRUZIONE-2026-07-28.md` · `COLLAUDO-2026-07-28.md` · `COLLAUDO-P3-2026-07-30.md` · `COLLAUDO-EVOLVE-2026-07-30.md`.

\*\*\*\*\* **vetrina-crafter è 🟢 come strumento, non come agente pronto alla consegna.** Progettata il 2026-08-02 (gate scritto **prima** del flusso) e costruita il 2026-08-03 su `banco-prova-controtempo` — Scuola di Musica Controtempo, uno schema prodotto **eseguendo schema-forge** e che il suo gate chiude VERDE 9/9. Numeri: 122 test sugli script, gate a **dieci** passi, **sette comandi su sette esercitati**, 22 classi di sabotaggio provate. Il sabotaggio ha trovato **tre difetti del gate**: sulla dev server di Turbopack accusava «un'altra applicazione sulla stessa porta» mentre l'applicazione era proprio quella (nessuno dei sette indizi di dev server vede Next 16); una pagina non scaricata rendeva **muti in silenzio** i suoi slot; e il «frammento distintivo» di uno slot poteva essere l'**UUID della riga**, con un `block` su una pagina corretta. Le tre decisioni sospese dalla progettazione sono state chiuse **con la misura, non a tavolino**, e due su tre hanno cambiato il codice. La costruzione ha smentito quattro premesse della specifica, fra cui una riga di dottrina della casa: su una pagina resa interamente sul server una colonna selezionata e non disegnata **non** arriva al browser — ma la chiave anonima sta nel bundle, quindi *ciò che è pubblico lo decide il `grant` a monte, non l'elenco del nostro `select`*. Resta **non usabile su un progetto cliente**: sul banco il contratto della vetrina l'ha firmato chi costruiva, e il gate legge la firma, non la sua verità. Il collaudo avversario indipendente (P2) non è ancora stato fatto. Verbale: `agenti/vetrina-crafter/COSTRUZIONE-2026-08-03.md`.

I **sei** agenti 🔵 sono **scaffold**: `SKILL.md` di una trentina di righe (34–35, misurate con `wc -l`) con il gate di chiusura scritto e le sezioni operative a `TODO`, `references/` e `scripts/` con dentro il solo `.gitkeep`. Hanno il contratto d'uscita, non il come. Erano sette fino al 2026-07-30, quando speed-demon ha smesso di esserlo.

## I banchi di prova

Gli agenti si collaudano su **banchi**: progetti Next.js + Supabase costruiti apposta, su cui il gate gira davvero invece di essere letto. Il 2026-07-30 ne restano cinque, e quattro sono stati cancellati (`DECISIONI.md` §25) perché **un banco si tiene solo se un clone pulito lo sa rilanciare** — a `banco-prova-negozio` e `banco-prova-accademia` mancavano le chiavi gitignorate che i loro gate leggono, quindi erano prove riproducibili su una macchina sola. Stanno nel commit `67f9001` e tornano con `git checkout 67f9001 -- <banco>`; pesavano 1,4 GB.

Resta **`banco-prova-vetcare/`**, che è tracciato per la §20 ed è **rosso apposta**: è il caso di prova permanente di uno schema difettoso per Schema Forge. Chi lo trova rosso non ha trovato un difetto, ha trovato il suo scopo.

Quello che questo costa, detto qui e non scoperto dopo: le affermazioni «batteria 16/16», «gate VERDE 7/7», «6 difetti su 6 rilevati» sono **datate nei verbali**, non rilanciabili in un comando. Per rifarle serve ricostruire il banco, che è lo stesso lavoro di prima — solo dichiarato.

## Installazione delle skill

Claude Code carica le skill da `.claude/skills/`, che è una cartella di junction verso `agenti/` (gitignorata: la fonte di verità è `agenti/`). Dopo un clone:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1
```

Installa **schema-forge**, **gestionale-crafter**, **vetrina-crafter**, **flow-sentinel**, **speed-demon** e **code-inquisition** — le sole di questo repo che sono skill vere. `code-maniac` e `bugbay` si installano dai repo di origine (vedi [Fonte di verità](#fonte-di-verità)); gli scaffold non si installano finché sono scaffold, perché una skill che non fa niente in mezzo a quelle che funzionano è rumore.

**Chi ha già installato prima del 2026-08-03 rilanci lo script:** `vetrina-crafter` è entrato in elenco quel giorno, quando il suo gate ha chiuso VERDE 10/10 su un progetto vero. Lo script salta i link che esistono già, quindi non tocca nulla di quanto c'è.

**Chi ha già installato prima del 2026-07-30 rilanci lo script:** `speed-demon` è entrato in elenco quel giorno e lo script salta i link che esistono già, quindi non tocca nulla di quanto c'è. Per due giorni questa riga ne ha elencate quattro mentre la tabella qui sopra ne dichiarava cinque vere: un manuale che elenca meno di quello che esiste non produce un errore, produce una skill che non c'è e nessuno che se ne accorga.

## Fonte di verità

Le copie in `agenti/` di **code-maniac**, **code-inquisition** e **bugbay** sono **SNAPSHOT** dei repo originali di finzidev (https://github.com/finzidev/code-maniac, https://github.com/finzidev/bugbay). Per aggiornarle **si riscarica dal repo originale**: non si modificano qui. Correzioni e migliorie vanno proposte al proprietario nel repo di origine.

I **nuovi agenti creati direttamente in questo repo** (schema-forge, site-doctor, brief-smith, preventivo-smith, gestionale-crafter, ai-specialist, speed-demon, flow-sentinel, cyber-shield, launchpad) invece **vivono qui**: questo repo è la loro fonte di verità.
