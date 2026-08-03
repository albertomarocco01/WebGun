# Il sabotaggio

Da caricare **al collaudo**: la procedura che dimostra che il gate sa diventare
rosso. Un gate che non e' mai stato puntato dove non doveva non e' stato collaudato
— e' l'unica riga di questo documento che conta davvero, e l'ha pagata Speed Demon:
il suo difetto piu' grave (il gate diceva `pass` su una dev server) e' uscito **solo**
col sabotaggio.

> **STATO AL 2026-08-03: ESEGUITO.** Tutte le classi sono state provate su
> `banco-prova-controtempo` (Scuola di Musica Controtempo — Next 16.2.12 su
> Turbopack, Supabase locale sulle porte 574xx, app di produzione sulla 3140).
> Le colonne «Esito misurato» portano quello che e' successo, non quello che
> doveva succedere. **Il sabotaggio ha trovato tre difetti del gate**, tutti
> chiusi con un test: sono le righe in grassetto.

## Come si esegue

Un difetto alla volta, e per ciascuno:

1. si rilancia il gate **prima**, e deve essere verde (o si sa gia' che il rosso non
   viene dal sabotaggio);
2. si pianta **un solo** difetto;
3. si rilancia il gate e **si incolla l'uscita nel verbale** — non si riassume: il
   testo esatto e' la prova, e nel testo esatto si vedono anche le diagnosi
   bugiarde, che sono difetti quanto i falsi verdi;
4. si ripristina, e si verifica che il gate torni verde. **Il ripristino fa parte del
   collaudo**: un banco lasciato rotto rende inutile la classe successiva.

Due esiti sono entrambi difetti della skill, e vanno distinti nel verbale:

- **falso verde** — si e' rotto qualcosa e il gate non l'ha visto;
- **diagnosi bugiarda** — il gate e' diventato rosso, ma il messaggio manda a
  cercare la cosa sbagliata. Speed Demon ne ha avuta una che accusava Playwright di
  un difetto di `where npx`, e' costata un pomeriggio. **Questo sabotaggio ne ha
  trovate due** (classi D e S2).

**Su Next 16 il ciclo ha due passaggi in piu'**, e senza quelli si misura il sito di
prima invece di quello di adesso:

```bash
rm -rf .next/cache/fetch-cache   # la Data Cache SOPRAVVIVE a `next build`
rm -rf .next/dev/types .next/types  # i tipi di rotta generati sono uno STATO
npm run build && npm run start -- -p <porta>
```

## Le sette classi

| # | Cosa si rompe | Come | Rosso atteso | Esito misurato (2026-08-03) |
|---|---|---|---|---|
| A | **il contratto non e' firmato** | sostituisci la riga `Confermato da:` col segnaposto `{{UMANO \| ORCHESTRATORE}}` | `contratto-vetrina` MANCANTE · i passi che dipendono dal contratto MANCANTI a cascata | **come atteso.** `ROSSO (1 falliti, 4 verifiche mancanti)`: MANCANTE su `contratto-vetrina`, `pagine-vive`, `segnaposto-serviti`, `contenuti-vivi`, e FAIL su `contratto-uscita` perche' l'handoff dichiarava ancora VERDE |
| B | **la cucitura si sfalda** | copia `Card.tsx` in `src/app/corsi/Card.tsx` e importalo da li' nella pagina | `cucitura-ui` FAIL, un `block` sull'import fuori cucitura **e** un `issue` sul file omonimo | **come atteso**, tutti e due i rilievi: `[block] src/app/corsi/page.tsx → ./Card` e `[issue] src/app/corsi/Card.tsx: si chiama come la primitiva` |
| C | **una chiave di servizio entra nel sito pubblico** | in `src/lib/dati.ts`: `const k = process.env.SUPABASE_SERVICE_ROLE_KEY;` | `chiavi-e-client` FAIL, un `block` col file e la riga | **come atteso**: `[block] src/lib/dati.ts:2: SUPABASE_SERVICE_ROLE_KEY raggiungibile dal sito pubblico` |
| D | **il gate guarda un'altra app** | punta `--url` su un'altra applicazione; poi su una dev server | `app-identita` **FAIL** (non MANCANTE) col build id stampato · sulla dev server: FAIL con gli indizi elencati · i passi 7-9 MANCANTI | **un'altra app: come atteso.** **Dev server: DIAGNOSI BUGIARDA, corretta.** Nessuno dei sette indizi storici scattava — sono tutti dell'era Webpack, e da Next 16 il default e' Turbopack — quindi il gate accusava «sta rispondendo un'altra applicazione sulla stessa porta» mentre l'applicazione era proprio quella. Aggiunti due indizi strutturali misurati (`hmr-client`, `next-devtools` nei percorsi dei chunk); ora dice «e' una DEV SERVER, non una build di produzione» |
| E | **una pagina dichiarata non risponde** | ~~rinomina `page.tsx` in `_page.tsx`~~ → **sposta la cartella della pagina fuori da `src/app/`** | `pagine-vive` FAIL, `block` «risponde 404» sulla pagina dichiarata | **come atteso**, ma **la ricetta era sbagliata su Next 16**: con `_page.tsx` la build muore prima del gate sui tipi di rotta generati, e anche spostando la cartella serve `rm -rf .next/dev/types`. Uscita: `[block] contatti (/contatti): risponde 404`. **E ha trovato un falso verde**: `contenuti-vivi` chiudeva «nessun rilievo» avendo saltato **in silenzio** i due slot della pagina irraggiungibile. Ora sono due MANCANTI |
| F | **il sito e' una bozza** | scrivi `Lorem ipsum dolor sit amet` in una sezione della home | `segnaposto-serviti` FAIL, `block` col frammento trovato | **come atteso**: `[block] home (/): «lorem ipsum» nel testo servito: «a pagare due volte. Lorem ipsum dolor sit amet, consectetur…»` |
| G | **il contenuto e' cablato** | copia il testo pubblicato di uno slot dentro il JSX della pagina che lo mostra | `contenuti-vivi` FAIL, `block` «lo stesso testo sta CABLATO nei sorgenti» | **come atteso**: `[block] slot corsi-intro → src/app/corsi/page.tsx` |

## Le tre classi che completano il quadro

Non erano nel mandato, e vanno provate lo stesso: sono i passi che restano.

| # | Cosa si rompe | Come | Rosso atteso | Esito misurato (2026-08-03) |
|---|---|---|---|---|
| H | **i tipi non tornano** | rinomina una colonna in `database.types.ts` senza toccare la query | `tipi` FAIL col conteggio degli errori e i primi file | **al primo tentativo NON e' scattato**, e il difetto era del progetto: i moduli riscrivevano i tipi a mano e chiudevano con `as unknown as`, quindi la catena fra schema e pagine era **tagliata** e il controllo piu' forte del gate era spento senza che niente lo dicesse. Derivati i tipi con `Pick<Database[...]["Row"], …>`: la stessa rinomina ora da' `5 errori` in tre file |
| I | **l'accessibilita' cede** | togli l'`alt` da un'immagine di contenuto | `a11y-statica` FAIL, `block` `jsx-a11y/alt-text` col file e la riga | **come atteso**: `[block] src/app/docenti/page.tsx:35: jsx-a11y/alt-text` |
| L | **l'handoff mente** | lascia `Gate: ROSSO` in un handoff mentre il gate chiude verde | `contratto-uscita` FAIL, «parla di un'altra esecuzione» | **come atteso**, e nella direzione piu' difficile (handoff pessimista su gate verde): `dichiara Gate: ROSSO ma il gate chiude VERDE` |

## Le classi che si provano al contrario

Un gate si collauda anche verificando che **non** diventi rosso dove non deve. Sono
i falsi positivi, e costano piu' dei falsi negativi: un rosso strutturale insegna a
scavalcare i rossi veri.

| Cosa si fa | Esito atteso | Esito misurato (2026-08-03) |
|---|---|---|
| firma il contratto con un nome e un ruolo veri (`Chiara Melloni (direttrice)`) | `contratto-vetrina` **verde**: e' la modalita' interattiva della skill, e Speed Demon la rifiutava | **verde**, e il dettaglio stampa la firma per esteso |
| dichiara una rotta dinamica con la sua istanza rappresentante | `pagine-vive` **non** segnala `/corsi/[slug]` come non dichiarata | **verde** in tutte le esecuzioni: `5 pagine dichiarate · 5 rotte pubbliche nei sorgenti`, nessun rilievo |
| incolla l'uscita del gate dentro l'handoff, in un blocco recintato | `contratto-uscita` **verde**: e' una prova allegata, non un verdetto | **verde** con un blocco che conteneva `GATE VETRINA: ROSSO` mentre il gate chiudeva VERDE |
| metti `/admin/*` fra le pagine escluse | `pagine-vive` **non** segnala le rotte del gestionale | **verde**. Prima dell'esclusione i due `issue` c'erano (`/admin` e `/promozioni`), dopo: `7 rotte pubbliche nei sorgenti · 4 escluse dal contratto`, nessun rilievo |
| uno slot con un valore corto (`Chi siamo`) | `contenuti-vivi` MANCANTE su quello slot, **non** un `block` | **MANCANTE**: «nessun valore di contenuto lungo almeno 24 caratteri … quello slot NON e' stato verificato» |
| una pagina che PARLA di `hmr-client` o di `next-devtools` | `app-identita` **non** la scambia per una dev server | **verde**: i due indizi nuovi sono ancorati a un percorso di chunk apposta |

## Le classi che questo gate NON puo' vedere

Si provano lo stesso, una volta, per **misurare il limite** invece di dichiararlo.
Ognuna deve restare **verde**, e quel verde e' il difetto: va nel verbale e in
§Cosa un gate verde NON prova.

| Cosa si rompe | Perche' resta verde | Esito misurato (2026-08-03) |
|---|---|---|
| cambia cosa mostra una pagina senza toccarne l'id ne' il percorso | il caso F di `evolve`: il gate legge le intestazioni, non la prosa di `Cosa mostra:` | **verde 10/10** con `Cosa mostra:` di `/contatti` riscritto come «il modulo di prenotazione con calendario e pagamento della caparra», cioe' una pagina che non esiste |
| reimplementa un bottone dentro la pagina con classi Tailwind a mano | `cucitura-ui` intercetta un import sbagliato, non una primitiva riscritta | **verde**, «nessun rilievo», col `<Bottone>` sostituito da un `<a>` con le stesse classi copiate |
| aggiungi una colonna riservata al `select` senza disegnarla | ~~il dato viaggia nell'HTML servito e nel payload RSC~~ **vedi la riga sotto: la premessa era sbagliata** | **verde, ma per un motivo diverso da quello scritto.** Aggiunte `id, pubblicato, created_at` al `select` e misurato l'HTML servito: **0 occorrenze**, e 0 anche nel payload RSC richiesto a parte. Con un Server Component che interroga e rende, cio' che non e' disegnato **non lascia il server**. La premessa vale per un Client Component che riceve la riga come prop, o per una query fatta nel browser |
| **quello che invece e' pubblico davvero** | la chiave anonima sta nel bundle, e PostgREST accetta `?select=` da chiunque | **misurato**: `curl "…/rest/v1/corsi?select=id,created_at,in_evidenza" -H "apikey: <anon>"` risponde con quelle colonne, che nessuna pagina seleziona e nessuna disegna. **Cio' che e' pubblico lo decide il `grant` piu' la policy, non l'elenco del `select`** |
| dichiara `Nessuno slot.` su un sito coi testi cablati | e' una dichiarazione firmata, non una misura | **verde 10/10** con il testo di `corsi-intro` cablato nel JSX e `Nessuno slot.` nel contratto: il difetto della classe G, reso invisibile da una riga |
| aggiungi una rotta servita da un `route.ts` | la seconda direzione di `pagine-vive` enumera i `page.tsx`, non l'app | **verde**: `/api/iscrizioni` rispondeva `{"aperte":false}` e il gate contava `5 rotte pubbliche nei sorgenti` |

## Cosa scrivere nel verbale

Per ogni classe: **cosa e' stato rotto, il comando esatto, l'uscita incollata, e se
il rosso e' arrivato dove doveva.** Le classi che restano verdi si scrivono con la
stessa evidenza di quelle che diventano rosse: sono la parte del verbale che
qualcuno leggera' fra sei mesi per sapere di cosa non fidarsi.
