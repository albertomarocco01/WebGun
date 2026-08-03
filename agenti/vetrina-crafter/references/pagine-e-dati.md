# Le pagine e i dati

Da caricare quando generi una **pagina**: come si compone, dove sta la query, cosa
succede quando i dati non ci sono, e da dove viene il titolo.

Una pagina si genera **una alla volta, nell'ordine del contratto**. Cinque pagine
scritte insieme e provate alla fine non sanno quale delle cinque ha rotto cosa.

## La pagina compone, il modulo interroga

```tsx
// src/app/catalogo/page.tsx — SOLO composizione
import { Card, Sezione } from "@/components/ui";
import { contenutoPubblico } from "@/modules/contenuti/leggi";
import { elencaPiante } from "@/modules/catalogo/query";

export const revalidate = 600;   // dichiarato anche nel contratto: `Aggiornamento: ISR 600`

export async function generateMetadata() {
  const intro = await contenutoPubblico("catalogo-intro");
  return { title: intro?.title ?? "Catalogo", description: intro?.corpo?.slice(0, 155) };
}

export default async function Catalogo() {
  const [intro, piante] = await Promise.all([
    contenutoPubblico("catalogo-intro"),
    elencaPiante(),
  ]);

  return (
    <Sezione titolo={intro?.title ?? "Catalogo"}>
      <p>{intro?.corpo}</p>
      {piante.length === 0 ? (
        <p>Il catalogo e' in aggiornamento. Chiamaci allo 0123 456789 e ti diciamo cosa c'e' in vivaio.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {piante.map((p) => (
            <li key={p.slug}><Card titolo={p.nome} href={`/catalogo/${p.slug}`} immagine={p.foto_url} /></li>
          ))}
        </ul>
      )}
    </Sezione>
  );
}
```

```ts
// src/modules/catalogo/query.ts — qui vive la logica, e solo qui
import { clientPubblico } from "@/lib/supabase/public";

export async function elencaPiante() {
  const { data, error } = await clientPubblico()
    .from("piante")
    // Le colonne si ELENCANO. `select("*")` porta al browser anche il costo
    // d'acquisto e il fornitore: non si vedono in pagina, ma stanno nell'HTML
    // servito e nel payload RSC — cioe' sono pubblicati (SKILL.md §Regole).
    .select("slug, nome, foto_url")
    .eq("pubblicata", true)
    .order("nome");

  if (error) throw new Error(`elenco piante non leggibile: ${error.message}`);
  return data ?? [];
}
```

**La riga che vale l'intera pagina:** `select` elenca le colonne. E il motivo per
cui la elenca e' stato **misurato in P1, e non e' quello che si crede**:

- su una pagina resa interamente sul server, un campo selezionato e non disegnato
  **non arriva al browser**. Provato sul banco aggiungendo `id, pubblicato,
  created_at` al `select`: zero occorrenze nell'HTML servito e zero nel payload RSC.
  Di un Server Component viaggia l'**uscita**, non i suoi dati;
- **arriva** appena quella riga passa a un Client Component come prop, o se la query
  si fa nel browser. Ed e' un cambio di una riga (`"use client"`), fatto un mese
  dopo da qualcun altro, che nessun gate segnala;
- e soprattutto: **cio' che e' pubblico non lo decide il `select`.** La chiave
  anonima sta nel bundle, quindi chiunque puo' chiedere a PostgREST le colonne che
  il `grant` e la policy concedono. Misurato:
  `curl ".../rest/v1/corsi?select=id,created_at,in_evidenza" -H "apikey: <anon>"`
  risponde con tre colonne che nessuna pagina seleziona e nessuna disegna.

Quindi: elencare le colonne resta giusto — non fa arrivare meno dati al browser
oggi, fa in modo che non ne arrivino domani, e dice a chi legge cosa serve davvero.
Ma la domanda «cosa e' pubblico» si porta **a monte**, ed e' la tabella §Dati
visibili a un anonimo del contratto piu' il modello di accesso di schema-forge.
Chi legge l'handoff §4 e' l'unico che puo' accorgersi di una colonna concessa per
distrazione.

## Gli stati vuoti non sono un caso limite

Una lista senza righe e' la **condizione normale** di un sito appena consegnato: il
seed ha dieci prodotti, il cliente non ha ancora caricato niente, la policy per
l'anonimo arriva dopo. Una pagina che in quel caso mostra il vuoto e' rotta il primo
giorno, e sembra rotta anche quando non lo e'.

Ogni stato vuoto dice **cosa fare adesso**, non «nessun risultato»:

| Situazione | Male | Bene |
|---|---|---|
| catalogo vuoto | «Nessun prodotto» | «Il catalogo e' in aggiornamento. Chiamaci e ti diciamo cosa c'e' in vivaio.» |
| ricerca senza esiti | «0 risultati» | «Non abbiamo piante che corrispondono. Prova per esposizione, o guarda tutto il catalogo.» |
| slot non pubblicato | pagina che salta una sezione | il testo di ripiego, scritto nel codice **e dichiarato nell'handoff** |

Il passo `contenuti-vivi` misura una cosa vicina ma diversa: che la fonte dichiarata
abbia **almeno una riga leggibile impersonando il ruolo anonimo**. Se la trova a
zero e' un `block`, e quasi sempre non e' un difetto della pagina — e' una policy
che manca a monte, cioe' una richiesta a schema-forge.

## Rotte dinamiche

```tsx
// src/app/catalogo/[slug]/page.tsx
import { notFound } from "next/navigation";

import { leggiPianta, slugPubblicati } from "@/modules/catalogo/query";

// In Next 15 `params` e' una Promise: va atteso, e chi copia un esempio vecchio
// ottiene un errore che parla di tutt'altro.
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await slugPubblicati()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const pianta = await leggiPianta(slug);
  return pianta ? { title: pianta.nome, description: pianta.descrizione_breve } : {};
}

export default async function SchedaPianta({ params }: Props) {
  const { slug } = await params;
  const pianta = await leggiPianta(slug);
  // `notFound()` e non una pagina vuota: una scheda inesistente deve rispondere
  // 404, o resta indicizzabile una pagina che non esiste.
  if (!pianta) notFound();
  return <article>{/* … */}</article>;
}
```

**Nel contratto una rotta dinamica si dichiara con UN'ISTANZA RAPPRESENTANTE**
(`## \`scheda-pianta\` — /catalogo/acero-palmato`), e si scrive quale e perche' —
di solito il caso peggiore, non quello medio. Il gate confronta i segmenti dinamici
come modelli: `/catalogo/acero-palmato` copre `/catalogo/[slug]`, quindi la rotta
non risulta «non dichiarata». Le altre istanze si scrivono in §Pagine escluse.

## Titolo e descrizione: sono contenuto

`title` e `description` li scrive **questa skill**, e vengono dalla stessa riga di
database da cui viene la pagina. Il contratto dichiara da dove, per pagina, nella
riga `Titolo da:`.

Cosa NON si scrive qui, ed e' di speed-demon e site-doctor: `canonical`, `robots` e
`noindex`, `sitemap.ts`, Open Graph, dati strutturati. Il gate della vetrina **non
guarda nessun metatag**: li conta `seo-meta`, che sa contarli invece di cercarli.

Due modi in cui il sorgente mente, e valgono anche qui:

- un `export const metadata` dentro un file `"use client"` **non diventa nessun
  tag**: l'App Router non ammette quell'export;
- un metatag generato da un componente reso solo nel browser non esiste per chi
  legge la risposta del server.

Per questo si verifica sull'**HTML servito**, mai sul sorgente:

```bash
curl -s http://127.0.0.1:3100/catalogo | grep -Eio '<title>[^<]*</title>'
```

## `Aggiornamento:` — la riga che il contratto dichiara e il codice deve rispettare

| Contratto | Codice | Quando |
|---|---|---|
| `statico` | nessun `revalidate` | contenuti che cambiano quando si ripubblica il sito |
| `ISR <secondi>` | `export const revalidate = <secondi>` | il caso normale di una vetrina |
| `dinamico` | `export const dynamic = "force-dynamic"` | dati che devono essere freschi a ogni richiesta |

Il gate confronta la dichiarazione con gli slot che la pagina mostra: una pagina
`statico` che mostra un contenuto editabile prende un `issue`, perche' il cliente
cambiera' il testo dal gestionale e **non vedra' cambiare niente** finche' qualcuno
non ripubblica. Non e' un `block` — un sito che si ripubblica a ogni modifica e' una
scelta legittima se e' dichiarata. Quello che non e' legittimo e' scoprirlo dal
cliente.

## Accessibilita': quella che il gate vede, e quella che non vede

Il passo `a11y-statica` gira `eslint-plugin-jsx-a11y` con la configurazione della
skill. Le cose che trova piu' spesso su una vetrina:

- `<img>` senza `alt` (e `alt=""` e' giusto **solo** se l'immagine e' decorativa);
- un `<div onClick>` che fa da bottone: serve un `<button>`, o ruolo e gestione da
  tastiera;
- un `<a>` senza `href` usato come bottone;
- un campo di modulo senza `<label>` associata.

Quello che **non** vede, ed e' di site-doctor e degli umani: contrasti, ordine di
tabulazione, se un messaggio d'errore si capisce, come suona la pagina con uno
screen reader. Un `a11y-statica` verde vuol dire «nessuno degli errori che un
linter sa riconoscere», non «accessibile».

## Errori classici

| Errore | Conseguenza |
|---|---|
| `select("*")` | colonne mai disegnate ma pubblicate nell'HTML servito |
| query dentro `page.tsx` | logica che nessun'altra pagina puo' riusare, e che il gate non vede spostarsi |
| nessuno stato vuoto | il sito sembra rotto il giorno della consegna |
| `notFound()` dimenticato | una scheda inesistente resta una pagina indicizzabile |
| testo cablato dove il contratto dichiara uno slot | `block` di `contenuti-vivi`, ed e' giusto: al primo cambio del cliente non succede niente |
| `revalidate` diverso da quello dichiarato nel contratto | il contratto smette di descrivere il sito, e nessuno se ne accorge |
| `canonical` scritto qui | duplica il lavoro di speed-demon, che lo fa meglio e lo misura |
