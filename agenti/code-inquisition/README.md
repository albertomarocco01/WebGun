# 🜲 Code Inquisition

**Un tribunale di esperti AI che mette il tuo codice sotto processo.**

Invece di chiedere a *una* AI "ci sono problemi?" e fidarti della prima risposta, questa skill convoca **una squadra di esperti specializzati** che esaminano il codice ognuno per conto suo, poi si siedono a un tavolo e **si contestano a vicenda** finché non resta solo la verità. Falsi allarmi eliminati, problemi veri confermati con prove.

---

## Installazione

Copia la cartella `code-inquisition` nelle skill di Claude Code (`~/.claude/skills/`):

```bash
cp -r code-inquisition ~/.claude/skills/        # macOS / Linux
```
```powershell
Copy-Item -Recurse -Force code-inquisition "$env:USERPROFILE\.claude\skills\"   # Windows
```

Riavvia Claude Code: la skill è pronta come `/code-inquisition`.

---

## A cosa serve, in una frase

Trova i problemi nel tuo codice — **bug di sicurezza, lentezze, errori di struttura** — con molta più precisione di un controllo normale, perché più esperti si controllano l'un l'altro e usano strumenti veri per verificare ogni accusa.

## L'idea, con una metafora

Immagina un **processo in tribunale**:

- 👨‍⚖️ **Il Presidente** dirige l'udienza.
- 🕵️ **Gli esperti** (3–10, scelti su misura per il tuo progetto) sono i testimoni: ognuno guarda il codice dalla sua specialità.
- 🔬 **Il Verificatore** è il perito: non si fida delle parole, *riesegue gli strumenti* (controlli automatici, test) per provare ogni affermazione.
- 🗣️ **Il dibattito**: gli esperti devono convincersi a vicenda. Un'accusa senza prove cade. Un'accusa provata resta.
- ✅ **La sentenza**: un report chiaro con cosa è rotto, quanto è grave, e cosa fare prima.

Risultato: niente "secondo me forse" — solo problemi **dimostrati**.

> **Importante:** la skill **non tocca il tuo codice**. Produce solo un **report** che individua i problemi (con prove e priorità). Le correzioni le decidi e le applichi tu — o passi il report a un agente che scrive codice.

---

## Come si usa

Nel tuo assistente, scrivi:

```
/code-inquisition <cosa-controllare> --focus <argomento>
```

**Esempi concreti:**

```
/code-inquisition ./mio-sito --focus sicurezza
/code-inquisition ./app --focus performance
/code-inquisition ./src/pagamenti --focus sicurezza,affidabilità
```

Se la richiesta è poco chiara (es. progetto enorme senza dire cosa guardare), la skill **si ferma e ti fa una domanda** prima di partire. Non spreca lavoro a vuoto.

### Cosa puoi mettere in `--focus`
`sicurezza` · `performance` (velocità) · `architettura` (struttura) · `refactoring` (pulizia) · `ux` · `affidabilità` · `all` (tutto)

---

## Cosa ottieni

Un report leggibile che contiene:

- **Verdetto in una riga** — *Si può pubblicare / Pubblicabile con correzioni / Non pubblicare / Prove insufficienti*.
- **Lista dei problemi** ordinata per gravità, ognuno con: dove si trova (file e riga), quanto è grave, e **come si verifica davvero** (uno strumento l'ha confermato? un test?).
- **Piano d'azione** — cosa sistemare per primo, per impatto reale.
- **Cosa è stato controllato e risultato pulito** — così sai che *non* è stato saltato.
- **Pareri di minoranza** — se un esperto non era d'accordo, resta scritto (non viene nascosto).

---

## Opzioni utili (tutte facoltative)

| Opzione | Cosa fa | Default |
|---|---|---|
| `--focus` | Su cosa concentrarsi | (te lo chiede se manca) |
| `--depth 1\|2\|3` | Quanto va a fondo (1 = veloce, 3 = analisi profonda per cose critiche) | `1` |
| `--council 3-10` | Quanti esperti nella squadra | **Decide la skill** in base a quanto è critico il task |
| `--scope diff` | Controlla **solo le modifiche recenti** (ideale per rivedere un cambiamento prima di pubblicarlo) | tutto il target |
| `--consensus strict` | Modalità "pignola": continua finché *nessuno* trova più niente, nemmeno dettagli minimi | `converge` (si ferma quando i problemi seri sono risolti) |

**Non devi impostare nulla:** la skill sceglie da sola quanti esperti servono e quando fermarsi. Le opzioni servono solo se vuoi il controllo.

---

## Quando usarla (e quando no)

✅ **Usala per:** audit importanti, codice che gestisce soldi/dati/login, "questo è pronto per andare online?", revisioni serie prima di pubblicare.

❌ **Non serve per:** una sbirciata veloce o sistemare il formato del codice. È uno strumento "pesante" (avvia diversi agenti e li fa discutere) — per un controllo rapido bastano strumenti più leggeri.

---

## Come decide quando fermarsi

Di default (`converge`) si ferma quando **tutti i problemi importanti sono stati risolti o confermati** e gli esperti sono d'accordo. I dettagli minori non bloccano: finiscono in una lista "da migliorare con calma".

Se vuoi la versione esaustiva, `--consensus strict` continua finché *nessun* esperto ha più *nulla* da aggiungere — anche il dettaglio più piccolo. Più completo, ma più lento e costoso.

In ogni caso c'è un **limite massimo di giri**: non gira mai all'infinito.

---

## In due righe

> Più esperti AI, ognuno specialista, che si contestano a vicenda e verificano tutto con strumenti veri prima di accusare il tuo codice. Trovi più problemi reali, con molti meno falsi allarmi.
