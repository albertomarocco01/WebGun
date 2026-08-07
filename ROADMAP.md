# ROADMAP — cosa c'è, cosa manca, cosa aspetta

Il programma di Web Gun è **`Web Gun.docx`**: diciassette agenti in sei fasi, scritti da Alberto.
Questo file dice, voce per voce, **a che punto è davvero** — e dove il documento è rimasto indietro
rispetto al lavoro fatto.

> Il `.docx` non si modifica da qui: è il documento madre, e un gate verifica che
> `webgun_content.txt` sia la sua copia fedele. Correggerlo è un lavoro da fare in Word.

Aggiornato al **2026-08-07**.

---

## In una riga

**Otto agenti sono operativi**, sette costruiti in casa con un gate deterministico ciascuno e uno
(vetrina-crafter) che il programma non aveva previsto. **Tre mancano e li possiamo fare noi.**
**Tre sono congelati** in attesa della libreria degli amici. Nessun sito è mai stato pubblicato:
è una scelta, non un ritardo.

| | |
|---|---|
| Agenti di casa collaudati | **7** (+ 1 non previsto dal programma) |
| Passi di gate deterministici | **64** in totale |
| Test automatici che li sorvegliano | **1 480**, tutti verdi il 2026-08-07 |
| Tribunali di revisione convocati | **8**, con **190 rilievi veri** |
| Siti pubblicati | **0** — mai un account, un dominio, un centesimo |

---

## Il programma, voce per voce

Legenda: ✅ fatto e collaudato · 🔨 da creare (possiamo noi) · ❄️ congelato (aspettiamo gli amici) ·
➖ fuori dalla catena

### FASE 0 — Commerciale

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 1 | **Brief Smith** | in arrivo dagli amici | ❄️ congelato · esiste solo lo scaffold |
| 2 | **Preventivo Smith** | da creare | 🔨 **manca** · scaffold, nessuno ci ha ancora lavorato |

### FASE 1 — Ingresso della richiesta

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 3 | **Prompt Smith** | in arrivo dagli amici | ❄️ congelato |

### FASE 2 — Guardiani (sempre attivi)

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 4 | **Code Maniac** | ce l'ho | ✅ in uso a ogni fase (`code-maniac scan`) |
| 5 | **Code Inquisition** | ce l'ho | ✅ in uso · **otto convocazioni, 190 rilievi veri** |
| 6 | **Bug Bay** | ce l'ho | ➖ presente, **mai agganciato alla catena** |

### FASE 3 — Costruzione

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 7 | **Schema Forge** | ce l'ho, fatto | ✅ gate **9 passi**, 228 test · database vero, RLS, pgTAP |
| 8 | **Fly UI** | in arrivo dagli amici | ❄️ congelato — **è il posto del design** (vedi sotto) |
| — | **Vetrina Crafter** | *non nel programma* | ✅ gate **10 passi**, 183 test · il sito pubblico |
| 9 | **Sites Effects** | ce l'ho | ➖ libreria di Alberto, fuori dalla catena |
| 10 | **Gestionale Crafter** | ce l'ho, fatto | ✅ gate **7 passi**, 230 test · backoffice con ruoli |
| 11 | **AI Specialist** | da creare | 🔨 **manca** · scaffold |

### FASE 4 — Test e performance

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 12 | **Flow Sentinel** | ce l'ho, fatto | ✅ gate **7 passi**, 171 test · E2E Playwright su app vera |
| 13 | **Speed Demon** | ce l'ho, fatto | ✅ gate **8 passi**, 147 test · Lighthouse su build di produzione |

### FASE 5 — Sicurezza e conformità

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 14 | **Cyber Shield** | da creare | 🔨 **manca** · scaffold — ma il perimetro va ristretto (vedi sotto) |
| 15 | **Site Doctor** | *«da creare»* | ✅ **il documento è indietro**: esiste, gate **14 passi**, 308 test |

### FASE 6 — Lancio

| # | Agente | Nel `.docx` | Davvero |
|---|---|---|---|
| 16 | **Launchpad** | *«da creare»* | ✅ **il documento è indietro**: esiste, gate **9 passi**, 167 test · **non ha mai pubblicato** |
| 17 | **DemonIAc** | ce l'ho | ➖ video demo, opzionale |

### Fuori pipeline

Maps Scraper e Aisthenics sono di Alberto e vivono per conto loro. Everything Scraper, Agent
Crafter, Super Teacher, Brainer, Projentic e Flowtastic sono degli amici e non toccano la catena
di produzione siti.

---

## I tre che mancano, in ordine di utilità

### 1. Preventivo Smith — il primo della catena e il più semplice

Calcola tempi e costi prima che il lavoro parta. È l'unico dei tre che **non dipende da nessun
altro agente**: legge un brief e produce un documento. Si può fare subito, e serve dal primo
cliente vero.

### 2. Cyber Shield — ma va ristretto prima di scriverlo

Il programma gli dà «vulnerabilità, permessi, esposizione dati e configurazioni pericolose». Metà
di quel perimetro **oggi è già coperto**, e da chi lo misura davvero:

| Cosa | Chi lo misura già |
|---|---|
| segreti nel repo, in HEAD e nella storia | launchpad, passo `segreti` |
| RLS, policy, privilegi di tabella | schema-forge, audit RLS + pgTAP |
| rotte admin senza guardia, permessi | gestionale-crafter |
| dati esposti a un anonimo | vetrina-crafter, site-doctor |
| audit profondo su richiesta | Code Inquisition |

**Regola di casa: una voce con due proprietari è una voce di nessuno.** Se lo facciamo, Cyber
Shield prende ciò che oggi nessuno guarda — dipendenze vulnerabili, header di sicurezza,
rate-limiting, superficie delle Server Action — e non ricalca i vicini.

### 3. AI Specialist — il più grosso, e il meno urgente

Chatbot, RAG, agenti dentro il sito del cliente. È lavoro vero e dipende da uno schema già forgiato.
Ha senso quando un cliente lo chiede, non prima.

---

## Il design: la casella vuota

Il programma mette **Fly UI** al posto 8 e lo dà «in arrivo dagli amici». Non è arrivato, e nel
frattempo la catena ha risolto da sola: vetrina-crafter scrive i componenti **a mano** dietro la
cucitura `src/components/ui/` (deroga in `DECISIONI.md` §21). Il sito funziona, è accessibile e
veloce — ma **nessun agente si occupa di come appare**, e si vede.

Le strade sono due, ed è una decisione da prendere:

- **aspettare Fly UI** — quando arriva entra *dentro* la cucitura: si riscrive il corpo di quei
  file, non le pagine. Costo zero adesso, tempo indefinito.
- **una skill di casa** — un agente del design con il suo gate, come gli altri sette. Costa un
  pacchetto di lavoro, e toglie la dipendenza da un consegnatario esterno.

---

## Cosa nessuno ha mai provato

Detto qui perché non lo si scopra dopo:

- **Nessun deploy.** Launchpad decide se si *può* pubblicare; nessuno ha mai premuto il pulsante.
  Il primo lo autorizza Alberto di persona (`DECISIONI.md` §6).
- **Nessun cliente vero.** Tutta la catena è stata provata sulla cavia (`../cavia`) e su banchi
  costruiti apposta. In ogni collaudo **i contratti li ha firmati chi costruiva**: il gate legge
  la firma, non la sua verità.
- **L'ingresso non esiste.** Brief Smith e Prompt Smith sono congelati: oggi il lavoro parte da un
  prompt scritto a mano.
- **I guardiani non sono automatici.** Code Maniac e Code Inquisition si lanciano a mano quando
  la Regola dei guardiani lo impone (`CLAUDE.md`); niente li fa scattare da solo.
