# Accessibilità dell'HTML servito — cosa si prova qui, e cosa sta di là

> Carica questo file prima di `scansiona`.

## Perché questa voce è mia, se due vicini la sfiorano

Tre agenti toccano l'accessibilità, e nessuno dei tre fa quello che fa questo
passo:

| chi | cosa guarda | cosa non guarda |
|---|---|---|
| **vetrina-crafter**, passo `a11y-statica` | i **sorgenti** JSX, con `eslint-plugin-jsx-a11y` | ciò che l'HTML **servito** contiene davvero: un componente composto a runtime, una pagina resa da dati, un `dangerouslySetInnerHTML` |
| **speed-demon**, categoria `accessibility` di Lighthouse | un **punteggio** su un **elenco firmato** di pagine, con un browser vero — **contrasti compresi** | le pagine fuori da quell'elenco; e un punteggio non è un elenco di voci da mettere in un certificato |
| **gestionale-crafter** | l'area **amministrativa** | il sito pubblico |
| **site-doctor** (qui) | l'HTML **servito** di **ogni pagina scoperta** | i contrasti, e tutto ciò che vuole un browser |

La differenza che conta non è tecnica, è di **insieme**:

> I vicini misurano un **campione dichiarato da qualcuno**. Qui si misura la
> **superficie che si raggiunge camminando**.

Sul pilota, `docs/performance.md` §1 S2 esclude `/ordine/<codice>` dalla misura
**per iscritto e con una buona ragione** (è il dato di una persona sola e porta
`noindex`). Quella pagina esiste, la usa chiunque abbia ordinato, e la sua
accessibilità non la guarda nessuno.

**Il limite, dichiarato**: se una pagina non è linkata da nessuna parte e non è
nella `sitemap.xml`, neanche questa camminata la trova. `/ordine/<codice>` sul
pilota è in quel caso. La differenza fra il campione e la superficie si vede
appena qualcuno **aggiunge** una pagina — quella entra qui e non entra
nell'elenco firmato di nessuno.

## La trappola di piattaforma, misurata

Su Next in App Router il **carico RSC** viaggia dentro `<script>` e contiene
l'albero serializzato della pagina:

```
self.__next_f.push([1,"[\"$\",\"h1\",null,{\"className\":\"...\",\"children\":\"...\"}]"])
```

Misurato sul pilota il 2026-08-06: la pagina `not-found` mostra **un** `h1` nel
DOM e ne ha un secondo dentro il carico. Contare i tag senza ripulire vuol dire
leggere due volte lo stesso documento — una nel DOM e una nella sua fotocopia —
e produrre rossi su pagine corrette, o verdi su pagine rotte se la fotocopia è
più completa del DOM.

Quindi: **si toglie il corpo di `<script>` e `<style>` e si tolgono i commenti,
prima di contare qualunque tag.** Il tag di apertura resta (serve a `terziDi` e
a `sorgentiInterne`, che cercano proprio gli `src`).

## Le regole, con la loro gravità e il perché

### Documento

| regola | gravità | perché |
|---|---|---|
| `<title>` presente e non vuoto | `block` | è la prima cosa che uno screen reader annuncia, e l'unica etichetta di una scheda del browser |
| `lang` su `<html>` | `block` | senza, la sintesi vocale non sa in che lingua leggere: un testo italiano letto con la pronuncia inglese è incomprensibile |
| `<main>` presente | `issue` | è il punto di salto al contenuto. `issue` e non `block` perché un documento può essere accessibile con altri landmark, e un rosso qui colpirebbe pagine corrette |

### Titoli

| regola | gravità | perché |
|---|---|---|
| almeno un `<h1>` | `block` | la pagina non dichiara di cosa parla |
| più di un `<h1>` | `issue` | in HTML5 le sezioni lo ammettono: non è un errore, è una cosa da guardare |
| **livello saltato** (h1 → h3) | **`block`** | chi naviga per intestazioni si trova un livello che non esiste. Era `issue`, ed è diventato `block` col sabotaggio: con `issue` il passo restava **verde** su una gerarchia rotta, cioè era verde proprio sul difetto che dichiara di provare |
| il primo titolo non è un `h1` | `issue` | quasi sempre un difetto, ma non sempre |

Il salto di livello è `block` per il criterio della `DECISIONI.md` §17: la prova
è **interamente nel documento** — h1 seguito da h3 — senza una riga di euristica.
Dove la prova è nel catalogo, la gravità è bloccante.

### Nomi accessibili

| regola | gravità | perché |
|---|---|---|
| `<img>` **senza** attributo `alt` | `block` | chi non vede l'immagine non sa cosa c'era |
| `<img alt="">` | `issue` | su un'immagine **davvero decorativa** è la forma **corretta**: bloccarla sarebbe un rosso su pagine giuste. Che sia decorativa lo dice una persona, non questo codice — ed è il confine fra una regola e un giudizio |
| `<a>` senza nome accessibile | `block` | «collegamento» è tutto ciò che uno screen reader può annunciare |
| `<button>` senza nome accessibile | `block` | idem |
| campo senza `<label for>` e senza `aria-label` | `block` | un campo senza etichetta è un campo che nessuno sa cosa vuole |

Il **nome accessibile** si calcola in quest'ordine: contenuto testuale →
`aria-label` → `aria-labelledby` (che si riconosce ma non si risolve) → `title`
→ `alt` di un'immagine contenuta.

## Cosa questo passo NON prova, e sta scritto anche in `SKILL.md`

- **I contrasti.** Sono di speed-demon, che apre un browser. Calcolarli qui
  vorrebbe dire risolvere cascata e specificità dei CSS a mano: si rifarebbe
  peggio una misura che esiste già.
- **L'ordine di tabulazione.** Dipende dal DOM renderizzato e dai `tabindex`
  effettivi.
- **Il focus visibile.** È uno stile, e serve un browser.
- **Il senso di un messaggio d'errore**, la chiarezza di un'etichetta, la
  sensatezza di un `alt`. `alt="immagine"` passa ogni controllo automatico ed è
  inutile a chi legge.
- **`prefers-reduced-motion`, animazioni, video, timing.**
- **L'uso reale con uno screen reader.** Nessun controllo automatico copre più
  di una frazione delle WCAG, e questo ne copre una frazione più piccola.

> Un sito **verde qui** può essere inservibile per chi naviga con la tastiera.
> Questo passo prova che le cose che si vedono nell'HTML ci sono; il resto lo
> prova una persona, e va scritto nel certificato come deroga o come limite.

## Cosa fare con i rilievi

**Non si corregge il codice dei vicini.** Un `alt` che manca in una pagina della
vetrina è una **richiesta a vetrina-crafter**, scritta nell'handoff §6. La
correzione fatta di nascosto sopra il lavoro di un altro agente rompe il
contratto della catena, e la prossima volta che quell'agente rigenera la pagina
il difetto torna — senza che nessuno sappia perché.
