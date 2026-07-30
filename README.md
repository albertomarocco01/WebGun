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
8. 🔴 **Fly UI**
   Libreria di componenti e interfacce utente veloci. Costruisce le pagine sopra lo schema dati già definito, senza reinventare i componenti ogni volta.
9. 🟢 **Sites Effects**
   Libreria con UI degli effetti applicabili ai siti. Aggiunge animazioni e microinterazioni sopra l'interfaccia base per dare carattere al sito.
10. 🟢\*\* **Gestionale Crafter**
    Crea il pannello gestionale / backoffice sopra lo schema di Schema Forge: viste CRUD protette da autenticazione e ruolo, e i testi delle sezioni del sito che il cliente cambia da solo (l'eredità del CMS che la pipeline non ha più). Tre leggi: il modello prima delle viste (Specchio, con STOP), gli strumenti giudicano (gate a 7 passi su un progetto vero), nessuna rotta admin nuda e nessuna scorciatoia sulla RLS — la chiave `service_role` non entra nel progetto. Manuale: `agenti/gestionale-crafter/COME-PROVARLA.md`.
11. 🔵 **AI Specialist**
    Integra assistenti IA, RAG e agenti autonomi nel sito: ad esempio il chatbot che guida i clienti dell'e-commerce tra prodotti e ordini.

### FASE 4 — Test e performance

12. 🟢\*\*\* **Flow Sentinel**
    Genera ed esegue test End-to-End con Playwright sui flussi critici prima del lancio. Tre leggi: il contratto dei flussi lo conferma un umano (`docs/flussi-critici.md`, con STOP), giudica il browser su app vera e database seminato, e un test che non può fallire non è un test — ogni flusso di scrittura asserisce l'effetto nel database, i flussi ostili provano i confini d'accesso dal browser. Se il checkout si rompe, lo scopre lui e non il cliente.
13. 🔵 **Speed Demon**
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
| ai-specialist | Skill Claude Code | 🔵 | — | questo repo |
| speed-demon | Skill Claude Code | 🔵 | — | questo repo |
| flow-sentinel | Skill Claude Code | 🟢\*\*\* | Alberto | questo repo |
| cyber-shield | Skill Claude Code | 🔵 | — | questo repo |
| launchpad | Skill Claude Code | 🔵 | — | questo repo |
| prompt-smith | Skill Claude Code | 🔴 | — | esterno (in arrivo) |
| bugbay | Prodotto/Strumento | 🟢 | finzidev | https://github.com/finzidev/bugbay |
| demoniac | Prodotto/Strumento | 🟢 | — | esterno |
| fly-ui | Libreria | 🔴 | — | esterno (in arrivo) |
| sites-effects | Libreria | 🟢 | — | esterno |

Il proprietario è chi sviluppa e mantiene l'agente; `—` significa non ancora assegnato. Ogni agente lo ripete nel proprio `agenti/<nome>/STATO.md`.

\* **schema-forge è 🟢 come strumento, non come agente pronto alla consegna.** Il gate è collaudato su database reale (144 test, 9 passi, due collaudi avversari), ma `agenti/schema-forge/STATO.md` lo dichiara **non ancora usabile su un progetto cliente**: restano aperti i punti 11, 12 e 15. Il punto 13 è **chiuso**: il consumatore a valle esiste — gestionale-crafter ha costruito un backoffice reale sopra uno schema di questa skill e `evolve` ha girato con codice applicativo sopra, dove il controllo più forte si è rivelato `tsc` sui tipi rigenerati (15 errori in 4 file, nessuno arrivato a runtime). Chi lo usa legga prima `agenti/schema-forge/COME-PROVARLA.md` §4, *Cosa NON dimostra un gate verde*.

\*\* **gestionale-crafter è 🟢 come strumento, non come agente pronto alla consegna.** Due collaudi su banchi reali il 2026-07-28 (e-commerce e accademia musicale), 105 test sugli script, gate a 7 passi, 6 difetti piantati su 6 rilevati e zero falsi positivi sul gemello pulito. Ma `agenti/gestionale-crafter/STATO.md` lo dichiara **non ancora usabile su un progetto cliente**: il gate conta le guardie, non sa se chiedono il ruolo giusto — e questo è **misurato**, non temuto (`COLLAUDO-2026-07-28.md` §7.2). Chi lo usa legga prima `COME-PROVARLA.md` §4, *Cosa NON dimostra un gate verde*.

\*\*\* **flow-sentinel è 🟢 come strumento, non come agente pronto alla consegna.** Costruito e collaudato in modo indipendente il 2026-07-28, poi **usato su un consumatore reale il 2026-07-30**: 106 test sugli script, gate a 7 passi con id stabili, 10 difetti trovati dal collaudo avversario e corretti uno per commit (7 erano falsi verdi). Il terzo banco — `banco-prova-negozio`, l'unico **scritto da altri agenti** — ha dato batteria 15/15 e gate 7/7, ma solo dopo aver scoperto che **nessuno riusciva ad accedere al gestionale** che due gate verdi avevano già firmato, e che il passo `app-viva` dichiarava viva l'app di un altro progetto. Resta **non provato su un progetto cliente**: il contratto dei flussi l'ha confermato l'orchestratore, non un committente, e il comando `evolve` non l'ha mai eseguito nessuno. Verbali: `COSTRUZIONE-2026-07-28.md` · `COLLAUDO-2026-07-28.md` · `COLLAUDO-P3-2026-07-30.md`.

I sette agenti 🔵 sono **scaffold**: `SKILL.md` di una ventina di righe con il gate di chiusura scritto e le sezioni operative a `TODO`, `references/` e `scripts/` vuote. Hanno il contratto d'uscita, non il come.

## Installazione delle skill

Claude Code carica le skill da `.claude/skills/`, che è una cartella di junction verso `agenti/` (gitignorata: la fonte di verità è `agenti/`). Dopo un clone:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1
```

Installa **schema-forge**, **gestionale-crafter**, **flow-sentinel** e **code-inquisition** — le sole di questo repo che sono skill vere. `code-maniac` e `bugbay` si installano dai repo di origine (vedi [Fonte di verità](#fonte-di-verità)); gli scaffold non si installano finché sono scaffold, perché una skill che non fa niente in mezzo a quelle che funzionano è rumore.

## Fonte di verità

Le copie in `agenti/` di **code-maniac**, **code-inquisition** e **bugbay** sono **SNAPSHOT** dei repo originali di finzidev (https://github.com/finzidev/code-maniac, https://github.com/finzidev/bugbay). Per aggiornarle **si riscarica dal repo originale**: non si modificano qui. Correzioni e migliorie vanno proposte al proprietario nel repo di origine.

I **nuovi agenti creati direttamente in questo repo** (schema-forge, site-doctor, brief-smith, preventivo-smith, gestionale-crafter, ai-specialist, speed-demon, flow-sentinel, cyber-shield, launchpad) invece **vivono qui**: questo repo è la loro fonte di verità.
