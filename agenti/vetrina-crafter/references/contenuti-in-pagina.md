# I contenuti in pagina

Da caricare quando una pagina mostra **contenuti editabili dal cliente**: i testi e
le immagini delle sezioni, che vivono in una tabella di Supabase e non nel codice.

E' la Legge n°3 di questa skill, ed e' l'unica che il gate misura in due direzioni:
il testo deve stare **nel database e in pagina**, e **non nei sorgenti**.

## Chi fa cosa (`DECISIONI.md` §24)

| Pezzo | Di chi |
|---|---|
| la tabella degli slot, la sua RLS, il seed | **schema-forge** |
| la vista con cui il cliente li modifica | **gestionale-crafter** |
| mostrarli in pagina | **questa skill** |

Tre agenti sulla stessa tabella, e **le chiavi devono coincidere in tutti e tre**.
Chi arriva secondo legge l'handoff del primo invece di inventarsele: uno slot
chiamato `home-hero` qui e `hero_home` nel gestionale produce un cliente che
modifica righe che nessuna pagina mostra, e nessun errore da nessuna parte.

Se la tabella non c'e', **e' una richiesta a schema-forge** (handoff §7), non una
migrazione scritta di nascosto. Il modello minimo e' in
`agenti/gestionale-crafter/references/contenuti-editabili.md`:

```
site_content
  slot          text unique   -- 'home-hero', 'catalogo-intro'
  title         text
  corpo         text
  image_url     text
  is_published  boolean       -- bozza / pubblicato
```

## Il lettore

```ts
// src/modules/contenuti/leggi.ts
import { clientPubblico } from "@/lib/supabase/public";

export type Contenuto = { title: string | null; corpo: string | null; image_url: string | null };

/**
 * Legge SOLO i pubblicati. Il filtro sta anche nella policy per `anon`, e qui e'
 * ripetuto di proposito: due difese per la stessa cosa, e quella che regge il
 * giorno in cui l'altra ha un buco non si sa mai quale sia in anticipo.
 */
export async function contenutoPubblico(slot: string): Promise<Contenuto | null> {
  const { data, error } = await clientPubblico()
    .from("site_content")
    .select("title, corpo, image_url")
    .eq("slot", slot)
    .eq("is_published", true)
    .maybeSingle();

  // `maybeSingle` e non `single`: uno slot non ancora pubblicato e' una
  // condizione normale, non un errore. `single` solleverebbe, e una sezione
  // mancante farebbe cadere l'intera pagina.
  if (error) throw new Error(`slot ${slot} non leggibile: ${error.message}`);
  return data ?? null;
}
```

## Il testo si rende come testo

Il contenuto arriva dal database ed e' scritto da una persona: si rende come
**testo**, non come HTML.

```tsx
<p className="whitespace-pre-line">{contenuto?.corpo}</p>   // si'
<div dangerouslySetInnerHTML={{ __html: contenuto?.corpo }} />  // NO
```

Un campo che accetta markup e lo inietta in pagina e' una porta aperta, con
l'aggravante che la porta la apre **un utente legittimo** — quello che ha il
permesso di scrivere i contenuti, e che puo' sbagliare o essere compromesso. Se
serve davvero il testo formattato si passa da un insieme di tag consentito e da una
sanificazione, e **la decisione si scrive nell'handoff**.

## Quando lo slot non c'e'

Tre casi, tre comportamenti diversi, e la differenza conta:

| Caso | Cosa fa la pagina | Cosa fa il gate |
|---|---|---|
| lo slot esiste ed e' pubblicato | lo mostra | verifica che il testo sia in pagina e **non** nei sorgenti |
| lo slot esiste ed e' in bozza | mostra il ripiego | *(decisione sospesa: vedi sotto)* |
| lo slot non esiste affatto | mostra il ripiego | *(decisione sospesa: vedi sotto)* |

> **DECISIONE SOSPESA.** Uno slot che il contratto dichiara e che nel database non
> ha nessuna riga pubblicata oggi produce una **verifica MANCANTE**. Il direttore ha
> osservato in revisione della P0 che somiglia di piu' a un `block` — il contratto
> dichiara un contenuto che non esiste — e la scelta **si prende sul banco**,
> provando i due casi. Finche' il banco non esiste resta MANCANTE, che e' il
> comportamento della P0 firmata, ed e' marcato nel codice.

Il ripiego si scrive nel codice **e si dichiara nell'handoff**: un testo di riserva
che nessuno sa che esiste diventa il testo del sito senza che nessuno l'abbia
deciso.

```tsx
const intro = await contenutoPubblico("catalogo-intro");
<h1>{intro?.title ?? "Catalogo"}</h1>
```

## Perche' il gate cerca il testo anche NEI SORGENTI

E' la meta' che nessuno scrive, ed e' quella che rende la Legge n°3 una misura
invece di una promessa. La prima meta' — «il testo sta in pagina» — non distingue
un contenuto **letto dal database** da un contenuto **cablato nel codice che per
caso coincide**. La seconda lo distingue, e trova il difetto piu' comune di tutti:

```tsx
// il gate dice `block`, e ha ragione
<h1>Il vivaio delle piante rare della Corte Vecchia</h1>
```

Quel titolo oggi e' identico a quello nel database. Domani il cliente lo cambia dal
gestionale, la pagina non cambia, e nessuno capisce perche'.

**La soglia distintiva.** Il confronto si fa solo su valori lunghi almeno
`Lunghezza minima del frammento distintivo` caratteri (ripiego: 24). Sotto quella
soglia la ricerca non prova niente in nessuna delle due direzioni — «Chi siamo» si
trova in pagina per caso e nei sorgenti per caso — e allora il gate dichiara che
quello slot **non e' stato verificato**, invece di far finta. Il numero e' una
convenzione, non una misura: si tara su un progetto vero guardando quanti slot
restano fuori.

## Immagini

`image_url` e' un URL, non un file. Se il cliente deve **caricare** immagini serve
Supabase Storage, e allora servono **tre** policy sullo stesso bucket — `insert` +
`select` + `update` — perche' sostituire un file e' un `update` e per aggiornarlo
bisogna prima leggerlo. Con la sola `insert` i caricamenti nuovi passano e la
sostituzione **fallisce in silenzio**.

Storage non lo guarda nessuno strumento di questa pipeline: `storage` non e' fra gli
schemi esposti dell'API. Qui e' documentazione, e si verifica a mano.

E ogni immagine di contenuto ha bisogno del suo testo alternativo, che e' **un altro
campo della riga**, non una stringa inventata dal codice: se l'alternativa la scrive
il programma, descrive il layout e non la fotografia.

## Errori classici

| Errore | Conseguenza |
|---|---|
| chiavi di slot diverse fra vetrina e gestionale | il cliente modifica righe che nessuna pagina mostra |
| `single` invece di `maybeSingle` | uno slot in bozza fa cadere la pagina intera |
| contenuto reso come HTML grezzo | iniezione, con la porta aperta da un utente legittimo |
| testo di ripiego non dichiarato | diventa il testo del sito senza che nessuno l'abbia deciso |
| pagina `statico` che mostra uno slot | il cliente cambia il testo e non succede niente fino alla ripubblicazione |
| tabella dei contenuti creata da questa skill | schema senza policy ne' test: fuori dal perimetro di chi la scrive |
| `alt` generato dal codice | descrive il layout invece della fotografia |
