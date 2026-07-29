# Contenuti editabili — l'eredità del CMS che non c'è

La pipeline aveva un agente per il CMS (Sanity Creator). È stato cancellato. I testi e le immagini che il cliente deve poter cambiare da solo restano un bisogno reale: vivono in Supabase e si modificano dal gestionale. **Questo agente se ne prende carico esplicitamente**, altrimenti finiscono scritti nel codice — cioè il cliente chiama noi per cambiare una parola.

## Il modello minimo: uno slot per sezione

```
site_content
  slot          text unique   -- 'home-hero', 'chi-siamo', 'promo-natale'
  title         text
  corpo         text
  image_url     text
  is_published  boolean       -- bozza / pubblicato
  updated_at    timestamptz
```

Cosa fa lavorare questo modello, e perché sta scritto così:

- **`slot` è una chiave stabile**, non un titolo: il codice del sito chiede `contenutoPubblico("home-hero")`. Se la chiave fosse il titolo, cambiare il titolo romperebbe la pagina.
- **`is_published` separa bozza e pubblicato**: la policy per `anon` filtra su quella colonna, quindi una bozza non esce dalla chiave anonima. Senza, l'unico modo di lavorare a un testo è pubblicarlo.
- **Il sito pubblico legge la stessa tabella** con la stessa RLS: nessuna copia, nessuna sincronizzazione.

Questa tabella la scrive **schema-forge**, non questo agente. Se non c'è, si chiede — e la richiesta va in handoff §6 finché non è chiusa.

## Chi scrive i contenuti

Un ruolo dedicato (`redattore`) più il titolare. La coppia va scritta in tre posti che devono **coincidere**: la policy della tabella, la guardia della vista, la guardia dell'azione.

```sql
create policy contenuti_aggiornati_dal_redattore on public.site_content
for update to authenticated
using (public.ha_ruolo('redattore') or public.ha_ruolo('titolare'))
with check (public.ha_ruolo('redattore') or public.ha_ruolo('titolare'));
```

```ts
await richiediRuolo("redattore", "titolare");   // vista e azione
```

Se il cliente non ha un redattore, il ruolo esiste lo stesso e ce l'ha il titolare: aggiungerlo dopo è una migrazione, toglierlo è una riga di configurazione.

## Cosa NON si costruisce (e perché va detto al committente)

Un costruttore di pagine — blocchi trascinabili, pagine create dal cliente, versioni, anteprima — **non è questo**. Richiede tabelle nuove (pagine, blocchi, revisioni, stato di pubblicazione), un modello di composizione e un'anteprima che renda il sito con contenuti non pubblicati: è un prodotto, non una vista.

La scelta fra i due mondi è **strutturale** e va nello Specchio, con la conseguenza scritta:

- *slot con campi* → il cliente cambia i testi delle sezioni che esistono. Chiedere una sezione nuova resta una richiesta a noi;
- *pagine componibili* → il cliente si costruisce le pagine. Costa un modello dati diverso e un ciclo di lavoro diverso, e va preventivato.

Metà dei clienti chiede il secondo e usa il primo. L'errore da non fare è **promettere il primo e chiamarlo il secondo**.

## Immagini

`image_url` è un URL, non un file. Se il cliente deve caricare immagini serve Supabase Storage, e allora servono **tre** policy sullo stesso bucket — `insert` + `select` + `update` — perché sostituire un file è un `update` e per aggiornarlo bisogna prima leggerlo. Con la sola `insert` i caricamenti nuovi passano e la sostituzione **fallisce in silenzio**: il caso peggiore, perché sembra funzionare finché nessuno riprova con lo stesso nome (`schema-forge/references/rls-supabase.md` §Storage).

Il gate non guarda Storage: `storage` non è fra gli schemi esposti dell'API e l'audit non lo legge. Qui è documentazione, e si verifica a mano.

## Il testo che finisce in pagina

Il contenuto arriva dal database ed è scritto da una persona: si rende come **testo**, non come HTML. Un campo che accetta markup e lo inietta in pagina è una porta aperta — e nel gestionale la porta la apre chi ha il permesso di scrivere i contenuti, cioè un utente legittimo che può sbagliare o essere compromesso. Se serve davvero il testo formattato, si passa da un insieme di tag consentito e da una sanificazione, e la decisione va scritta nell'handoff.

## Errori classici

| Errore | Conseguenza |
|---|---|
| `slot` uguale al titolo | cambiare il titolo rompe la pagina che lo cerca |
| nessuna distinzione bozza/pubblicato | per lavorare a un testo bisogna pubblicarlo |
| tabella dei contenuti creata da questo agente | schema senza policy né test: fuori dal perimetro di chi la scrive |
| ruoli della policy diversi da quelli della vista | il redattore vede una pagina che non salva |
| upload con la sola policy di `insert` | la sostituzione di un file fallisce in silenzio |
| contenuto reso come HTML grezzo | iniezione, con l'aggravante che la porta l'ha aperta un utente legittimo |
| promettere pagine componibili e consegnare slot | il cliente scopre il limite quando gli serve una pagina nuova |
