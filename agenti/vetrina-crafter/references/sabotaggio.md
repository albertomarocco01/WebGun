# Il sabotaggio

Da caricare **al collaudo**: la procedura che dimostra che il gate sa diventare
rosso. Un gate che non e' mai stato puntato dove non doveva non e' stato collaudato
— e' l'unica riga di questo documento che conta davvero, e l'ha pagata Speed Demon:
il suo difetto piu' grave (il gate diceva `pass` su una dev server) e' uscito **solo**
col sabotaggio.

> **STATO AL 2026-08-02: NON ESEGUITO.** Le colonne «Esito misurato» sono vuote
> perche' il banco non esiste — Docker e lo stack Supabase locale non ci sono su
> questa macchina, quindi nessuna delle sette classi e' stata provata. Finche'
> restano vuote, **questa reference e' una procedura, non una prova**, e ogni riga
> va letta come «cosa deve succedere», mai come «cosa e' successo». E' anche il
> primo bersaglio del collaudo avversario.

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
  un difetto di `where npx`, e' costata un pomeriggio.

## Le sette classi

| # | Cosa si rompe | Come | Rosso atteso | Esito misurato |
|---|---|---|---|---|
| A | **il contratto non e' firmato** | sostituisci la riga `Confermato da:` col segnaposto `{{UMANO \| ORCHESTRATORE}}` | `contratto-vetrina` MANCANTE · tutti i passi che dipendono dal contratto (`pagine-vive`, `segnaposto-serviti`, `contenuti-vivi`) MANCANTI a cascata | *(da misurare)* |
| B | **la cucitura si sfalda** | copia `Bottone.tsx` in `src/app/catalogo/Bottone.tsx` e importalo da li' nella pagina | `cucitura-ui` FAIL, un `block` sull'import fuori cucitura **e** un `issue` sul file omonimo | *(da misurare)* |
| C | **una chiave di servizio entra nel sito pubblico** | in `src/lib/dati.ts`: `const k = process.env.SUPABASE_SERVICE_ROLE_KEY;` | `chiavi-e-client` FAIL, un `block` col file e la riga | *(da misurare)* |
| D | **il gate guarda un'altra app** | avvia una seconda app su un'altra porta e punta `--url` li'; oppure lancia `next dev` e punta il gate sulla dev server | `app-identita` **FAIL** (non MANCANTE): «risponde, ma NON e' l'app di questo progetto», col build id stampato · sulla dev server: FAIL con gli indizi elencati · i passi 7-9 MANCANTI | *(da misurare)* |
| E | **una pagina dichiarata non risponde** | rinomina `src/app/contatti/page.tsx` in `_page.tsx` | `pagine-vive` FAIL, `block` «risponde 404» sulla pagina dichiarata | *(da misurare)* |
| F | **il sito e' una bozza** | scrivi `Lorem ipsum dolor sit amet` in una sezione della home | `segnaposto-serviti` FAIL, `block` col frammento trovato | *(da misurare)* |
| G | **il contenuto e' cablato** | copia il testo pubblicato di uno slot dentro il JSX della pagina che lo mostra | `contenuti-vivi` FAIL, `block` «lo stesso testo sta CABLATO nei sorgenti» | *(da misurare)* |

## Le tre classi che completano il quadro

Non erano nel mandato, e vanno provate lo stesso: sono i passi che restano.

| # | Cosa si rompe | Come | Rosso atteso | Esito misurato |
|---|---|---|---|---|
| H | **i tipi non tornano** | rinomina una colonna in `database.types.ts` senza toccare la query | `tipi` FAIL col conteggio degli errori e i primi file | *(da misurare)* |
| I | **l'accessibilita' cede** | togli l'`alt` da un'immagine di contenuto | `a11y-statica` FAIL, `block` `jsx-a11y/alt-text` col file e la riga | *(da misurare)* |
| L | **l'handoff mente** | lascia `Gate: VERDE` in un handoff mentre il gate chiude rosso | `contratto-uscita` FAIL, «parla di un'altra esecuzione» | *(da misurare)* |

## Le classi che si provano al contrario

Un gate si collauda anche verificando che **non** diventi rosso dove non deve. Sono
i falsi positivi, e costano piu' dei falsi negativi: un rosso strutturale insegna a
scavalcare i rossi veri.

| Cosa si fa | Esito atteso | Esito misurato |
|---|---|---|
| firma il contratto con un nome e un ruolo veri (`Elena Barbieri (titolare)`) | `contratto-vetrina` **verde**: e' la modalita' interattiva della skill, e Speed Demon la rifiutava | *(da misurare)* |
| dichiara una rotta dinamica con la sua istanza rappresentante | `pagine-vive` **non** segnala `/catalogo/[slug]` come non dichiarata | *(da misurare)* |
| incolla l'uscita del gate dentro l'handoff, in un blocco recintato | `contratto-uscita` **verde**: e' una prova allegata, non un verdetto | *(da misurare)* |
| metti `/admin/*` fra le pagine escluse | `pagine-vive` **non** segnala le rotte del gestionale | *(da misurare)* |
| uno slot con un valore corto («Chi siamo») | `contenuti-vivi` MANCANTE su quello slot, **non** un `block`: sotto la soglia la ricerca non prova niente | *(da misurare)* |

## Le classi che questo gate NON puo' vedere

Si provano lo stesso, una volta, per **misurare il limite** invece di dichiararlo.
Ognuna deve restare **verde**, e quel verde e' il difetto: va nel verbale e in
§Cosa un gate verde NON prova.

| Cosa si rompe | Perche' resta verde |
|---|---|
| cambia cosa mostra una pagina senza toccarne l'id ne' il percorso | il caso F di `evolve`: il gate legge le intestazioni, non la prosa di `Cosa mostra:` |
| reimplementa un bottone dentro la pagina con classi Tailwind a mano | `cucitura-ui` intercetta un import sbagliato, non una primitiva riscritta |
| aggiungi una colonna riservata al `select` senza disegnarla | il gate guarda cio' che e' **in pagina**; quel dato viaggia nell'HTML servito e nel payload RSC |
| dichiara `Nessuno slot.` su un sito coi testi cablati | e' una dichiarazione firmata, non una misura |
| aggiungi una rotta servita da un `route.ts` o da una riscrittura | la seconda direzione di `pagine-vive` enumera i `page.tsx`, non l'app |

## Cosa scrivere nel verbale

Per ogni classe: **cosa e' stato rotto, il comando esatto, l'uscita incollata, e se
il rosso e' arrivato dove doveva.** Le classi che restano verdi si scrivono con la
stessa evidenza di quelle che diventano rosse: sono la parte del verbale che
qualcuno leggera' fra sei mesi per sapere di cosa non fidarsi.
