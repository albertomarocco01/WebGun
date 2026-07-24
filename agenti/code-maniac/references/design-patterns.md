# Design Pattern — Advisor sotto il vincolo del minimalismo

I design pattern e il minimalismo sono in **tensione produttiva**. La regola che li riconcilia:

> **Un pattern si applica solo quando la duplicazione/variazione esiste GIÀ (regola del tre), mai in anticipo.** Applicare un pattern "perché bello" è over-engineering — esattamente ciò che la costituzione combatte (priorità 6 < 3).

Quindi `pattern` non *propone* astrazioni: le **riconosce quando il codice le sta già chiedendo**.

## Quando un pattern è giustificato

- **Sì** — la stessa struttura si ripete ≥ 3 volte con piccole variazioni.
- **Sì** — un `if/switch` cresce a ogni nuovo caso (→ apertura/chiusura violata).
- **Sì** — più punti costruiscono lo stesso oggetto complesso a mano.
- **No** — "potrebbe servire in futuro": YAGNI.
- **No** — un solo caso d'uso attuale: il pattern aggiunge indirezione senza ritorno.

## Catalogo (con il "quando NON usarlo")

### Frontend / React
- **Container / Presentational** — separa il componente "stupido" (props in, JSX out) dalla logica/dati. *È la formalizzazione della best-practice §5.* Non usarlo per componenti banali senza logica.
- **Custom hooks** — estrai logica con stato riusata in più componenti. Non per logica usata una volta sola.
- **Compound components** — gruppi di componenti che condividono stato implicito (Tabs, Accordion). Non per un singolo componente.
- **Provider** — stato condiviso da molti livelli. Non per props che passano 1-2 livelli (prop drilling va benissimo lì).

### Generali (GoF utili)
- **Strategy** — algoritmi intercambiabili dietro un'interfaccia. Quando un `switch` su un tipo cresce.
- **Factory** — centralizza la costruzione di oggetti che varia. Quando la costruzione si ripete e diverge.
- **Adapter** — adatta un'interfaccia esterna alla tua. Ai confini con librerie/API di terzi.
- **Facade** — una porta semplice su un sottosistema complesso. Quando i chiamanti conoscono troppi dettagli interni.
- **Command** — incapsula un'azione (undo/redo, code). Non per chiamate di funzione dirette.
- **Decorator** — aggiunge comportamento senza modificare. Quando la sottoclasse esploderebbe in combinazioni.

### Backend / DDD
- **Repository** — astrae l'accesso ai dati dal dominio (cfr. lo strato dati §9).
- **Domain Events** — disaccoppia gli effetti collaterali dall'azione che li scatena.
- **Bounded Context** — confini espliciti tra aree di dominio con linguaggio proprio.

## Rilevamento (con graphify)

Se il grafo è attivo, `pattern suggest` cerca i segnali oggettivi:
- dispatch condizionale ripetuto su un tipo → candidato **Strategy**
- costruzione oggetti ripetuta e divergente → candidato **Factory**
- markup inline duplicato in più pagine → estrazione **Container/Presentational** (§5)
- nodi `semantically_similar_to` che risolvono lo stesso problema senza legame strutturale → duplicazione da unificare

E segnala i pattern **mal-applicati**: indirezione senza un secondo caso d'uso, factory con un solo prodotto, provider per prop drilling di 1 livello → semplifica (`/code-maniac review` lo include).
