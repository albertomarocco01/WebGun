# WEB GUN — Pipeline Agenti & How To Run
> Panoramica del progetto e stato agenti → [README.md](README.md)

Ordine operativo pensato per un progetto reale (es. e-commerce da zero).

**Legenda:**  
🟢 **VERDE** = ce l'ho  
🔴 **ROSSO** = me lo devono mandare  
🔵 **BLU** = da creare

---

## FASE 0 — Commerciale / Raccolta materiali

1. 🔵 **Brief Smith**  
   Raccoglie automaticamente dal cliente logo, palette colori, immagini, testi e informazioni. È il carburante iniziale: tutto quello che Web Gun deve sapere prima di sparare.
2. 🔵 **Preventivo Smith**  
   Calcola e genera il preventivo dettagliato con tempistiche e costi. Utile prima di iniziare, così il cliente firma e la pipeline parte con requisiti chiari.

## FASE 1 — Ingresso della richiesta

3. 🔴 **Prompt Smith**  
   Il cancello d'ingresso: trasforma gli appunti in italiano in un prompt professionale in inglese e lo smista agli agenti specializzati. È l'orchestratore della richiesta.

## FASE 2 — Guardiani del codice (SEMPRE ATTIVI)
*Si attivano da subito e vigilano su tutto quello che gli agenti costruttori producono, per tutta la durata del progetto.*

4. 🟢 **Code Maniac**  
   **Cosa fa:** È una skill per Claude Code che impone disciplina, garantendo un codice pulito, rintracciabile ed efficiente nei token. Applica le "Tre Leggi": riformula la richiesta prima di agire, sfrutta strumenti deterministici (lint, type check) prima di usare l'LLM e produce il minimo indispensabile (YAGNI). Organizza, ottimizza e gestisce il debito tecnico senza sprechi.  
   **Come si installa:**  
   *Su Windows (PowerShell):*  
   `git clone https://github.com/finzidev/code-maniac.git; cd code-maniac; powershell -ExecutionPolicy Bypass -File .\install.ps1`  
   *Su macOS/Linux:*  
   `git clone https://github.com/finzidev/code-maniac.git && cd code-maniac && bash install.sh`  
   *(Se il repo è già clonato localmente, puoi omettere `git clone` e lanciare direttamente lo script. Dopo l'installazione, riavvia Claude Code).*  
   **Come si usa / lancia:**  
   Avvia i comandi all'interno di una sessione di Claude Code:
   - `code-maniac init` (inizializzazione e documentazione on-boarding)
   - `code-maniac scan` (analisi deterministica, tipi, linting e codice morto)
   - `code-maniac review` (esamina il diff delle modifiche attuali)
   - `code-maniac explore "domanda"` (interroga il grafo del progetto senza leggere file interi)

5. 🟢 **Code Inquisition**  
   **Cosa fa:** Un vero e proprio tribunale di esperti AI che esamina il codice a fondo (sicurezza, performance, architettura). Non modifica direttamente il codice, ma convoca un gruppo di agenti specializzati che si confrontano e verificano le accuse tramite strumenti reali. Elimina i falsi positivi e produce un report chiaro (con verdetto, problemi provati e piano d'azione da attuare).  
   **Come si installa:**  
   In questo repo si espone con una **junction**, come le altre skill (`DECISIONI.md` §7): due copie divergono, un link no.  
   *Su Windows (PowerShell), dalla radice del repo:* `New-Item -ItemType Junction -Path ".claude\skills\code-inquisition" -Target (Resolve-Path "agenti\code-inquisition").Path`  
   *Su macOS/Linux:* `ln -s "$PWD/agenti/code-inquisition" .claude/skills/code-inquisition`  
   Tutte insieme: `powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1`.  
   *(Dopo l'installazione, riavvia Claude Code).*  
   **Come si usa / lancia:**  
   Tramite Claude Code invoca:  
   `/code-inquisition <percorso_o_file> --focus <argomento>`  
   I valori di `--focus` sono un elenco chiuso e sono **in inglese**: `security` | `performance` | `architecture` | `refactoring` | `ux` | `reliability` | `all` (`agenti/code-inquisition/SKILL.md` §48), separati da virgola.
   *(Esempio: `/code-inquisition ./mio-sito --focus security,reliability`)*. Se omesso, sarà la skill a chiederti su cosa concentrarsi.

6. 🟢 **Bug Bay**  
   **Cosa fa:** Debugging agentico installabile in qualsiasi webapp tramite l'inserimento di un singolo `<script>`. Lancia un daemon in locale che apre una console di triage per i bug segnalati via widget. Permette la risoluzione tramite AI mostrando in anteprima il `diff` del fix proposto (che puoi approvare con un commit o scartare). Essendo un approccio "hub-and-spoke", puoi aggregare i bug di più progetti su un DB centrale (es. Supabase), mantenendo l'esecuzione del fix in locale su ogni progetto.  
   **Come si installa:**  
   Nel terminale del tuo progetto (accanto al tuo package.json):  
   `npm i -D "github:finzidev/bugbay"`  
   *(Puoi usare anche pnpm/yarn/bun al posto di npm).*  
   **Come si usa / lancia:**  
   - `npx bugbay init` (esegue l'aggancio, inietta il widget e crea i file di configurazione)
   - `npx bugbay dev` (avvia il daemon e fornisce l'URL della console di triage per lavorare ai bug)

## FASE 3 — Costruzione (dati → interfaccia → funzioni)

7. 🟢 **Schema Forge**  
   **Cosa fa:** Progetta lo schema del database: tabelle, relazioni, vincoli, indici, RLS e seed. Si parte da qui perché in un e-commerce i dati (prodotti, ordini, utenti) sono le fondamenta. Non scrive SQL prima di aver riformulato il dominio in italiano e aver ottenuto conferma (*Specchio del dominio*); nessuna migrazione è valida finché non è stata applicata davvero su un database pulito e non ha passato la batteria deterministica.  
   **Prerequisiti:** Supabase CLI **v2.81.3+** con Docker attivo (sotto quella versione il passo `db advisors` è una verifica mancante e il gate resta rosso), `psql`, e consigliati `pipx install sqlfluff squawk-cli`. Uno strumento assente vale **MANCANTE**, mai `pass`.  
   **Come si installa:**  
   Vive in `agenti/schema-forge/` di questo repo, esposta a Claude Code da una junction. Da PowerShell nella radice del repo, oppure tutte insieme con `scripts/installa-skill.ps1`:  
   `New-Item -ItemType Junction -Path ".claude\skills\schema-forge" -Target (Resolve-Path "agenti\schema-forge").Path`  
   **Come si usa / lancia:**  
   - in conversazione: `/schema-forge`, poi `model` → `forge` → `seed` → **`test`** → `types` → `handoff` → `verify`
   - `test` scrive i pgTAP negativi e **non è opzionale**: una tabella con policy di scrittura che nessun test attacca è un `block` del gate
   - `verify` è **ultimo**: tipi e handoff si producono prima, o il gate nasce rosso per come è ordinato il flusso
   - il gate a mano, dalla radice del progetto generato: `node <skill>/scripts/verify.mjs`
   - solo l'audit di sicurezza — **sempre con `--db-url`**, o punta alla porta 54322 che con due stack accesi è il database di un altro progetto: `node <skill>/scripts/rls-audit.mjs --db-url "$DB" --schemas public --json`
   - manuale completo: `agenti/schema-forge/README.md` · guida pratica: `agenti/schema-forge/COME-PROVARLA.md`
8. 🔴 **Fly UI**  
   Libreria di componenti e interfacce utente veloci. Costruisce le pagine sopra lo schema dati già definito, senza reinventare i componenti ogni volta.
9. 🟢 **Sites Effects**  
   Libreria con UI degli effetti applicabili ai siti. Aggiunge animazioni e microinterazioni sopra l'interfaccia base per dare carattere al sito.
10. 🟢 **Gestionale Crafter**  
   **Cosa fa:** Crea il pannello gestionale / backoffice sopra lo schema di Schema Forge. Per un e-commerce: prodotti, ordini, magazzino, clienti — più i testi delle sezioni del sito, che il cliente cambia da solo (l'eredità del CMS cancellato). Non genera una vista finché non ha riformulato *chi amministra cosa* e ottenuto conferma (*Specchio del gestionale*); nessuna rotta admin senza controllo di autenticazione e ruolo; nessun accesso ai dati che aggiri le RLS — la chiave `service_role` non entra nel progetto.  
   **Prerequisiti:** Node ≥ 20, Supabase CLI + Docker (per i tipi e il catalogo dei permessi), `psql`, e il progetto generato con le sue `node_modules`: senza, i passi `tsc` e `a11y` sono **verifiche mancanti** e il gate resta rosso.  
   **Come si installa:**  
   Vive in `agenti/gestionale-crafter/` di questo repo, esposta a Claude Code da una junction. Da PowerShell nella radice del repo, oppure tutte insieme con `scripts/installa-skill.ps1`:  
   `New-Item -ItemType Junction -Path ".claude\skills\gestionale-crafter" -Target (Resolve-Path "agenti\gestionale-crafter").Path`  
   **Come si usa / lancia:**
   - in conversazione: `/gestionale-crafter`, poi `specchio` (**STOP**) → `scaffold` → `viste` → `contenuti` → `audit` → `handoff` → `verify`
   - `verify` è **ultimo**: tipi e handoff si producono prima, o il gate nasce rosso per come è ordinato il flusso
   - il gate a mano, dalla radice del progetto generato: `node <skill>/scripts/verify.mjs`
   - solo l'audit di accesso e permessi: `node <skill>/scripts/admin-audit.mjs --db-url "$DB"`
   - dopo un gate verde, sulla superficie critica: `/code-inquisition src/modules/admin src/app/admin --focus security`
   - guida pratica: `agenti/gestionale-crafter/COME-PROVARLA.md` · verbale: `agenti/gestionale-crafter/COLLAUDO-2026-07-28.md`
11. 🔵 **AI Specialist**  
   Integra assistenti IA, RAG e agenti autonomi nel sito: ad esempio il chatbot che guida i clienti dell'e-commerce tra prodotti e ordini.

## FASE 4 — Test e performance

12. 🟢 **Flow Sentinel**  
   **Cosa fa:** genera ed esegue test End-to-End Playwright sui flussi critici dichiarati in `docs/flussi-critici.md` del progetto generato — un contratto che conferma l'umano (**STOP**), non l'agente. Ogni flusso di scrittura asserisce l'**effetto nel database**, non solo la pagina; i flussi ostili (`ostile-lettura`, `ostile-scrittura`) provano dal browser che i confini d'accesso reggono. Gate a 7 passi con id stabili.  
   **Prerequisiti:** Node ≥ 20, Supabase CLI + Docker, il progetto generato con le sue `node_modules`, `@playwright/test` e i browser (`npx playwright install chromium`).  
   **Come si installa:** junction come le altre, da `scripts/installa-skill.ps1`.  
   **Come si usa / lancia:**
   - in conversazione: `/flow-sentinel`, poi `map` (**STOP**: conferma umana dei flussi) → `forge` → `run` → **`handoff`** → **`verify`**; dopo una migrazione dello schema: `evolve`
   - `verify` è **ultimo**, come per schema-forge e gestionale-crafter: uno dei sette passi controlla il contratto d'uscita, quindi scrivere l'handoff dopo il gate significa farlo nascere rosso per come è ordinato il flusso, e un rosso strutturale è quello che insegna a scavalcare i rossi veri. (Fino al 2026-07-30 questa riga insegnava l'ordine contrario, smentita dal Flusso 1 della sua stessa `SKILL.md`.)
   - il gate a mano, dalla radice del progetto generato: `node <skill>/scripts/verify.mjs [--url <url>] [--db-url <url>]`. Senza le due opzioni l'app e il database si risolvono dal `supabase/config.toml` del progetto e l'ambiente non viene mai consultato — una `SUPABASE_DB_URL` rimasta da un altro progetto è il modo in cui il difetto nasce
   - verbali: `agenti/flow-sentinel/COSTRUZIONE-2026-07-28.md` · `COLLAUDO-2026-07-28.md` · `COLLAUDO-P3-2026-07-30.md` (primo consumatore reale) · `COLLAUDO-EVOLVE-2026-07-30.md` (`evolve`, 5 casi su 5)
13. 🟢 **Speed Demon**  
   **Cosa fa:** misura un sito già costruito e già testato su una **build di produzione** (mai `next dev`), propone le ottimizzazioni **col loro costo** (**STOP** allo Specchio), le applica **una alla volta** rimisurando e rilanciando la batteria E2E, e verifica i metatag nell'**HTML servito**. Le pagine che contano, le soglie e il metodo stanno in `docs/performance.md` del progetto generato, firmato da chi decide. Gate a 7 passi con id stabili.  
   **Prerequisiti:** Node ≥ 20, **Chrome** e `lighthouse` raggiungibile (`npx lighthouse`), il progetto generato costruito (`npm run build`) e servito su una **porta dedicata**, e la skill `flow-sentinel` raggiungibile per il passo `rete-verde`. Ognuno assente vale MANCANTE, mai PASS.  
   **Come si installa:** junction come le altre, da `scripts/installa-skill.ps1`.  
   **Come si usa / lancia:**
   - in conversazione: `/speed-demon`, poi `measure` → `plan` (**STOP**: conferma delle ottimizzazioni e del loro costo) → `tune` → `handoff` → `verify`
   - il gate a mano, dalla radice del progetto generato: `node <skill>/scripts/verify.mjs --url http://127.0.0.1:<porta>`
   - **la porta va guardata, non supposta.** Il gate non indovina un `localhost:3000`, e dal 2026-07-30 verifica anche che l'app a quell'indirizzo sia **quella di questo progetto**, confrontando il `.next/BUILD_ID`: su questa macchina la 3100 — la porta che un contratto firmato dichiarava — era occupata dal sito di un'altra azienda. Chi occupa una porta si guarda con `Get-NetTCPConnection -LocalPort <porta> -State Listen`
   - verbali: `agenti/speed-demon/COSTRUZIONE-2026-07-30.md` · `COLLAUDO-AVVERSARIO-2026-07-30.md`

## FASE 5 — Sicurezza e conformità

14. 🔵 **Cyber Shield**  
   Specializzato in cybersecurity: verifica vulnerabilità, permessi, esposizione di dati e configurazioni pericolose prima della messa online.
15. 🔵 **Site Doctor**  
   Scanner pre-produzione di conformità: cookie/GDPR e privacy, accessibilità (alt, contrasti, HTML semantico), Open Graph per le anteprime social, hreflang multilingua, favicon, robots.txt e sitemap. In pratica: il certificato di idoneità del sito prima del lancio.

## FASE 6 — Lancio e vendita

16. 🔵 **Launchpad**  
   Deployment 1-click su Vercel/Cloudflare con DNS, domini e certificati SSL. L'ultimo miglio: dal codice al sito online.
17. 🟢 **DemonIAc**  
   Genera automaticamente video demo con Remotion da mostrare alle aziende. Opzionale nella pipeline: serve per vendere il risultato, non per costruirlo.

---

## ALTRI (fuori pipeline Web Gun)
*Progetti utili ma non parte della catena di produzione siti:*

- 🟢 **Maps Scraper:** Trova aziende e attività in tutto il mondo, con o senza sito web, e invia email automaticamente. È il motore commerciale che procura i clienti a Web Gun.
- 🟢 **Aisthenics:** Assistente per allenatori di Calisthenics con IA integrata.
- 🔴 **Everything Scraper:** Scraper online sempre attivo di qualsiasi prodotto: macchine, PC, telefoni…
- 🔴 **Agent Crafter:** Creatore e configuratore di agenti e assistenti IA su misura.
- 🔴 **Super Teacher:** Gli chiedi un argomento e te lo spiega in modo ultra dettagliato.
- 🔴 **Brainer:** Second brain personale.
- 🔴 **Projentic:** (In arrivo / Da farsi spiegare)
- 🔴 **Flowtastic:** (In arrivo / Da farsi spiegare)
