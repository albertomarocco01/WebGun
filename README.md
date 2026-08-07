# Web Gun

**Web Gun è una pipeline di agenti specializzati che costruisce siti web professionali.** Ogni
agente copre una fase — database, sito pubblico, pannello del cliente, test, velocità, conformità,
lancio — e passa le consegne al successivo con un documento di handoff.

**Questo repo non è un sito: è la regia.** Contiene gli agenti, le loro regole e i loro collaudi.
I siti veri nascono in cartelle separate, una per progetto.

| Vuoi… | Vai a |
|---|---|
| far girare la pipeline | [COME-SI-USA.md](COME-SI-USA.md) |
| sapere cosa manca ancora | [ROADMAP.md](ROADMAP.md) |
| le regole che gli agenti devono rispettare | [CLAUDE.md](CLAUDE.md) |
| perché una scelta è stata fatta così | [DECISIONI.md](DECISIONI.md) |
| un documento citato che non trovi più | [ARCHIVIO.md](ARCHIVIO.md) |

---

## L'idea in due minuti

Un sito fatto bene richiede mestieri diversi: chi progetta i dati non è chi disegna le pagine, chi
scrive i test non è chi ottimizza le performance. Web Gun li separa in **agenti specializzati**, e
mette fra loro due cose che di solito mancano:

**1. Un gate deterministico per ognuno.** Ogni agente ha uno script che *misura* il lavoro fatto
invece di fidarsi: applica le migrazioni su un database vero, scarica le pagine servite, apre un
browser, legge la storia di git. Il gate dev'essere verde prima di passare la mano.

**2. Uno STOP dove decide un umano.** Cosa diventa visibile a un anonimo, quali flussi sono
critici, cosa va online: sono firme, non output. Pubblicare non si annulla.

La regola che tiene su il resto: **uno strumento assente vale MANCANTE, mai PASS.** Un gate che
non ha potuto verificare qualcosa resta rosso.

## La catena

| Fase | Agente | Cosa produce | Gate |
|---|---|---|---|
| 1 | **schema-forge** | tabelle, relazioni, RLS, seed, tipi | 9 passi · database vero, pgTAP |
| 2 | **vetrina-crafter** | il sito pubblico | 10 passi · pagine servite, chiave anonima |
| 3 | **gestionale-crafter** | il pannello del cliente | 7 passi · guardie, ruoli, permessi |
| 4 | **flow-sentinel** | test End-to-End dei flussi critici | 7 passi · browser vero, effetto nel database |
| 5 | **speed-demon** | velocità, Core Web Vitals, SEO | 8 passi · build di produzione, Lighthouse |
| 6 | **site-doctor** | il certificato di conformità | 14 passi · privacy, a11y, cosa finisce nel browser |
| 7 | **launchpad** | il verdetto «si può pubblicare» | 9 passi · segreti, storia git, firme |

Sopra tutti, sempre attivi: **code-maniac** (disciplina e scan deterministico) e
**code-inquisition** (tribunale di periti su richiesta).

**64 passi di gate**, sorvegliati da **1 480 test automatici**. Otto convocazioni del tribunale
hanno prodotto **190 rilievi veri** su codice che lint, knip e batterie davano tutto verde.

## Cosa c'è in questo repo

```
WebGun/
├── agenti/<nome>/          una skill per agente
│   ├── SKILL.md            cosa fa e come si comanda
│   ├── STATO.md            a che punto è, cosa è provato e cosa no
│   ├── references/         le regole del mestiere
│   ├── resources/          i template che scrive nei progetti
│   └── scripts/verify.mjs  il gate + la sua batteria di test
├── scripts/                il gate della regia e l'installatore
├── template-skill/         lo scheletro per un agente nuovo
├── banco-prova-vetcare/    uno schema difettoso, rosso apposta
└── Web Gun.docx            il programma, scritto da Alberto
```

Il sito su cui si provano gli agenti è **`../cavia`**: un progetto completo costruito dalla
pipeline intera. Non è di un cliente e non verrà pubblicato.

## Natura degli agenti

| Nome | Categoria | Stato | Proprietario | Repo di origine |
|---|---|---|---|---|
| schema-forge | Skill Claude Code | 🟢 | Alberto | questo repo |
| vetrina-crafter | Skill Claude Code | 🟢 | Alberto | questo repo |
| gestionale-crafter | Skill Claude Code | 🟢 | Alberto | questo repo |
| flow-sentinel | Skill Claude Code | 🟢 | Alberto | questo repo |
| speed-demon | Skill Claude Code | 🟢 | Alberto | questo repo |
| site-doctor | Skill Claude Code | 🟢 | Alberto | questo repo |
| launchpad | Skill Claude Code | 🟢 | Alberto | questo repo |
| brief-smith | Skill Claude Code | 🔵 | — | questo repo |
| preventivo-smith | Skill Claude Code | 🔵 | — | questo repo |
| ai-specialist | Skill Claude Code | 🔵 | — | questo repo |
| cyber-shield | Skill Claude Code | 🔵 | — | questo repo |
| code-maniac | Skill Claude Code | 🟢 | finzidev | https://github.com/finzidev/code-maniac |
| code-inquisition | Skill Claude Code | 🟢 | finzidev | esterno (finzidev, URL non noto) |
| bugbay | Prodotto/Strumento | 🟢 | finzidev | https://github.com/finzidev/bugbay |
| prompt-smith | Skill Claude Code | 🔴 | — | esterno (in arrivo) |
| fly-ui | Libreria | 🔴 | — | esterno (in arrivo) |
| sites-effects | Libreria | 🟢 | — | esterno |
| demoniac | Prodotto/Strumento | 🟢 | — | esterno |

🟢 c'è · 🔵 da creare · 🔴 lo devono mandare. Il proprietario è chi sviluppa e mantiene l'agente;
`—` significa non ancora assegnato, e ogni agente lo ripete nel proprio `STATO.md`.

**I sette 🟢 di casa sono verdi come strumenti, non come agenti pronti a un cliente.** Il gate
misura ciò che il contratto dichiara, e su ogni collaudo finora **il contratto l'ha firmato chi
costruiva**: nessuna di queste skill è mai stata usata per un committente vero. Cosa manca a
ciascuna, in dettaglio e con le misure, sta nel suo `agenti/<nome>/STATO.md` — sezione *Cosa non
è mai stato provato*.

I quattro 🔵 sono **scaffold**: `SKILL.md` di una trentina di righe col contratto d'uscita
scritto e le sezioni operative ancora vuote. Hanno il *cosa*, non il *come*.

## Installazione delle skill

Claude Code carica le skill da `.claude/skills/`, che è una cartella di junction verso `agenti/`
(ignorata da git: la fonte di verità è `agenti/`). Dopo un clone:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/installa-skill.ps1
```

Installa **schema-forge**, **gestionale-crafter**, **vetrina-crafter**, **flow-sentinel**, **speed-demon**, **launchpad**, **site-doctor** e **code-inquisition** — le sole di questo repo che siano skill vere.

`code-maniac` e `bugbay` si installano dai repo di origine (vedi
[Fonte di verità](#fonte-di-verità)); gli scaffold non si installano finché sono scaffold, perché
una skill che non fa niente in mezzo a quelle che funzionano è rumore.

Una skill entra in questo elenco **a gate verde**, non prima. Dopo l'installazione, riavvia
Claude Code.

## Fonte di verità

Le copie in `agenti/` di **code-maniac**, **code-inquisition** e **bugbay** sono **snapshot** dei
repo di finzidev: per aggiornarle **si riscaricano**, non si modificano qui. Correzioni e
migliorie vanno proposte nel repo di origine.

Gli agenti nati in questo repo — schema-forge, vetrina-crafter, gestionale-crafter, flow-sentinel,
speed-demon, site-doctor, launchpad e i quattro scaffold — **vivono qui**: questa è la loro fonte
di verità.

## I banchi di prova

Gli agenti si collaudano su **banchi**: progetti Next.js + Supabase costruiti apposta, su cui il
gate gira davvero invece di essere letto. Un banco si tiene **come script, non come cartella**: si
rigenera con `node agenti/<skill>/scripts/banco.mjs`, non si archivia.

L'unica eccezione tracciata è **`banco-prova-vetcare/`**, che è **rosso apposta**: il caso di
prova permanente di uno schema difettoso per schema-forge. Chi lo trova rosso non ha trovato un
difetto, ha trovato il suo scopo.
