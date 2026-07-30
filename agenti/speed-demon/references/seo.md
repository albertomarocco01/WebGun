# Metatag e indicizzazione nell'App Router

Cosa Speed Demon tocca dei metatag, come si verifica che un metatag esista **davvero**, e quali pagine di un sito Web Gun non devono finire in un indice. Il confine è netto: qui non si scrive contenuto e non si decide cosa il sito debba dire — si verifica che ciò che il sito dice arrivi al crawler nella forma in cui qualcuno ha deciso che dovesse arrivare. Un titolo brutto resta brutto anche dopo questo file; un titolo assente, o presente solo nel DOM, è un difetto che si misura.

Il passo di gate che ne dipende è `seo-meta`: `title`, `description` e `canonical` nell'**HTML servito** di ogni pagina pubblica dichiarata (SKILL.md §Gate). Se l'app non risponde il passo è MANCANTE, non `pass`.

## Dove vivono i metatag, e chi li calcola

Due sole forme, entrambe sul server, entrambe valutate mentre il segmento viene reso.

```ts
// src/app/layout.tsx — statico: nessun dato di richiesta entra nel calcolo
import type { Metadata } from "next";

const SITO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITO),
  title: {
    default: "Bottega Nord — arredi in legno massello",
    template: "%s | Bottega Nord",
  },
  description: "Arredi su misura in legno massello, progettati e costruiti a Biella.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Bottega Nord",
    images: [{ url: "/og/default.png", width: 1200, height: 630, alt: "Bottega Nord" }],
  },
  twitter: { card: "summary_large_image" },
};
```

`generateMetadata` serve **esattamente quando il valore dipende dai dati della richiesta** — lo slug, un parametro, una riga di Supabase — e mai come abitudine. Esportare entrambi dallo stesso file è un errore dichiarato da Next in fase di build: non è una preferenza, è un vincolo del framework.

```ts
// src/app/prodotti/[slug]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { clientServer } from "@/lib/supabase/server";

// `cache` di React deduplica la lettura fra `generateMetadata` e il corpo della
// pagina. La memoizzazione automatica di Next vale per le `fetch` GET identiche
// dentro lo stesso render: su una query di supabase-js dipende da come il client
// costruisce la richiesta, quindi non e' una cosa da assumere. `cache` rende la
// deduplica esplicita invece che sperata; senza, il prodotto rischia di essere
// letto due volte per richiesta, e la seconda latenza sta sulla strada dell'HTML
// — cioe' dentro il TTFB della pagina che vende. Se sia una o due letture si
// legge nei log del database, non qui.
const leggiProdotto = cache(async (slug: string) => {
  const supabase = await clientServer();
  const { data } = await supabase
    .from("prodotti")
    .select("slug, nome, descrizione_breve, prezzo_cents, immagine_url, disponibile, updated_at")
    .eq("slug", slug)
    .eq("pubblicato", true)
    .maybeSingle();
  return data;
});

// In Next 15 `params` e' una Promise: va atteso, anche qui.
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const prodotto = await leggiProdotto(slug);
  if (!prodotto) return { title: "Prodotto non disponibile", robots: { index: false } };

  return {
    title: prodotto.nome,
    description: prodotto.descrizione_breve,
    alternates: { canonical: `/prodotti/${prodotto.slug}` },
    openGraph: {
      title: prodotto.nome,
      description: prodotto.descrizione_breve,
      url: `/prodotti/${prodotto.slug}`,
      // ripetuti apposta: vedi §La fusione non e' profonda
      siteName: "Bottega Nord",
      images: [{ url: prodotto.immagine_url, width: 1200, height: 630, alt: prodotto.nome }],
    },
  };
}
```

Il ramo `if (!prodotto)` merita una nota, perché è il primo esempio di ciò che questo file ripete fino alla fine: se la pagina poi chiama `notFound()`, quel `title` **non viene servito**. Viene servito il metadata di `not-found.tsx`, con uno stato 404. Il sorgente qui sopra dice una cosa, la risposta ne dice un'altra, e ha ragione la risposta.

## Il template del titolo

`template` si applica ai segmenti **figli**, non al segmento che lo dichiara: per questo la forma a oggetto pretende anche `default`, che è il titolo del segmento stesso. Il tipo lo impone, quindi questo mezzo difetto non passa la compilazione.

Quello che passa la compilazione è il suffisso doppio. Una pagina figlia che scrive `title: "Sedia Nordica | Bottega Nord"` produce `<title>Sedia Nordica | Bottega Nord | Bottega Nord</title>`: il template viene applicato a un valore che se lo era già portato dietro. Nel sorgente della pagina figlia non si vede niente di strano — il difetto nasce dalla composizione di due file, e si vede solo nell'HTML servito. Quando il suffisso non deve esserci (una landing, una pagina di campagna) la via dichiarata è `title: { absolute: "…" }` sulla pagina: togliere il template dal layout risolve il caso di una pagina togliendo il suffisso a tutte le altre.

## La description

Non è un fattore di posizionamento dichiarato: è il testo candidato per lo snippet, e i motori lo riscrivono quando lo giudicano poco pertinente alla query. Quanto spesso lo riscrivano dipende dallo studio che si cita, quindi qui non c'è un numero da mettere.

Sulla lunghezza vale un ordine di grandezza, non una soglia: lo snippet viene troncato **in pixel**, quindi il punto di taglio cambia con il dispositivo e con i caratteri usati; le 150-160 battute che girano ovunque sono una regola pratica, non un limite del protocollo. Da verificare sul progetto guardando la SERP vera, non da far rispettare a un `verify.mjs` con un `length <= 160`.

Quello che invece si misura è l'**unicità**. Il difetto tipico di un catalogo generato è la description ricavata troncando il primo paragrafo del campo di descrizione: venti pagine che cominciano con la stessa frase di reparto, e mezze parole in coda. Il controllo confronta le description delle pagine dichiarate fra loro e segnala i duplicati; non prova che siano buone, prova che non sono la stessa.

## `alternates.canonical`, e perché uno sbagliato è peggio di uno assente

Il canonical è un **suggerimento**, non un ordine: il motore lo pesa insieme ai redirect, ai link interni, alla sitemap e alla forma dell'URL, e può scegliere diversamente. Da lì discende l'asimmetria.

Senza canonical il motore sceglie da sé, con un'euristica che su un sito piccolo e senza duplicati indovina quasi sempre. Con un canonical sbagliato gli si dichiara attivamente che *questa pagina è una copia di quell'altra*: se il suggerimento viene accolto, la pagina esce dall'indice e il traffico viene mandato su un URL che non contiene ciò che l'utente cercava. L'assenza lascia lavorare un'euristica; un valore sbagliato la scavalca nella direzione sbagliata.

Il modo concreto in cui succede, e che un sito Web Gun incontrerà prima o poi: **una riga nel layout radice**.

```ts
// src/app/layout.tsx — sbagliato
export const metadata: Metadata = {
  metadataBase: new URL(SITO),
  alternates: { canonical: "/" },   // ← ereditato da OGNI pagina che non dichiara il proprio
};
```

I campi non dichiarati da un figlio vengono ereditati dal genitore. Quella riga fa dichiarare all'intero catalogo di essere una copia della home. La verifica che lo trova è banale e va scritta apposta: **si leggono i canonical di almeno tre pagine diverse e si controlla che siano diversi**. Guardando solo la home il difetto è invisibile, perché la home il canonical giusto ce l'ha.

Altri tre modi di sbagliarlo, tutti visibili solo nella risposta:

- **canonical relativo con `metadataBase` sbagliato.** `canonical: "/prodotti/x"` viene risolto contro `metadataBase`; se quel valore arriva da una variabile d'ambiente non impostata, in produzione esce un canonical che punta a `localhost` o all'URL effimero di un'anteprima. Quando `metadataBase` manca del tutto Next usa un ripiego e lo segnala fra gli avvisi di build — il ripiego dipende dalla versione e dall'ambiente, quindi la verifica non è ricordarsi la regola, è leggere l'attributo `href` nell'HTML servito. In locale quell'host sarà legittimamente `127.0.0.1`: il controllo sull'host **di produzione** appartiene a chi misura il sito pubblicato, non a questo agente.
- **canonical che non risponde 200.** Punta a un URL che redirige, o che è 404. Costa una `fetch` verificarlo, e il difetto è muto: la pagina esiste, il tag esiste, e il bersaglio no.
- **canonical che ignora la forma servita.** Se il progetto ha `trailingSlash: true`, un canonical senza barra finale dichiara come preferito un URL che redirige verso sé stesso con la barra. Si guarda quale delle due forme il server risponde 200, e si scrive quella.

## Open Graph e Twitter

Non riguardano l'indice: decidono la scheda di anteprima in WhatsApp, Slack, Telegram, X, Facebook. È una distinzione che conta perché **quei consumatori leggono l'HTML e non eseguono JavaScript**: un tag scritto lato client, per loro, non esiste affatto — nemmeno più tardi, nemmeno in un secondo passaggio. La verifica è la stessa che vale per tutto il resto: se non è nel corpo servito, non c'è.

### La fusione non è profonda

`openGraph` e `twitter` vengono **sostituiti** dal figlio che li dichiara, non fusi campo per campo. Una pagina prodotto che scrive `openGraph: { title, description }` perde `images` e `siteName` del layout: il link condiviso resta senza immagine **esattamente sulle pagine che la gente condivide**, cioè quelle di prodotto. È il motivo per cui l'esempio più sopra ripete `siteName` e `images` invece di darli per ereditati.

Sull'immagine: dev'essere assoluta, e ci arriva attraverso `metadataBase`. La convenzione a file (`opengraph-image.tsx` con `ImageResponse`) genera immagine e tag insieme ed elimina questa classe di errori, ma ha un costo di generazione che va **misurato** sulla rotta dove la si mette — su una rotta dinamica l'immagine si genera su richiesta, e nessun ordine di grandezza scritto qui varrebbe per il tuo progetto.

`twitter.card` si dichiara esplicito, e il difetto che previene si vede a occhio: senza, il consumatore applica il ripiego che decide lui, e il link esce come scheda piccola con l'immagine in miniatura invece dell'anteprima grande che qualcuno aveva progettato. I ripieghi su Open Graph esistono, cambiano nel tempo e questo file non li ha misurati: dichiararlo costa una riga, verificarlo vuol dire guardare l'anteprima vera.

## `robots` per pagina, e `robots.ts`

Per pagina, dentro il metadata del segmento:

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false },   // → <meta name="robots" content="noindex, nofollow">
};
```

Il file, servito su `/robots.txt`:

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";

const SITO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }],
    sitemap: `${SITO}/sitemap.xml`,
  };
}
```

**I due strumenti non si sommano, si annullano.** `robots.txt` governa la **fetch**, `noindex` governa l'**indicizzazione**: una pagina bloccata da `Disallow` non viene scaricata, quindi il suo `noindex` non viene mai letto, e quell'URL può comunque comparire nei risultati come URL nudo se qualcuno lo linka da fuori. Chi vuole una pagina fuori dall'indice la lascia scaricabile e ci mette `noindex`. Chi vuole tenere un crawler lontano da un sottoalbero (un'area dietro autenticazione, uno spazio di filtri combinatorio) usa `Disallow` e accetta che non sia una deindicizzazione.

Seconda cosa da sapere prima di scriverlo: **`robots.txt` è un file pubblico**. Elencarci un percorso è pubblicarlo. Non è un problema di per sé — un URL non è un segreto e la protezione vera è la guardia (`gestionale-crafter/references/rotte-protette.md`) — ma se l'unica cosa che teneva quieto un percorso era il fatto che nessuno lo conoscesse, `robots.txt` ha appena smesso di tenerlo quieto.

## `sitemap.ts`

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";

import { clientServer } from "@/lib/supabase/server";

const SITO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

// La sitemap si rigenera al massimo una volta all'ora: un prodotto pubblicato
// adesso dal gestionale compare li' dentro al piu' tardi fra un'ora. E' un costo
// dichiarato, l'alternativa e' una query a ogni fetch del crawler.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await clientServer();
  const { data, error } = await supabase
    .from("prodotti")
    .select("slug, updated_at")
    .eq("pubblicato", true);          // ← i non pubblicati sono 404 per il crawler
  if (error) throw new Error(`sitemap: lettura prodotti fallita: ${error.message}`);

  return [
    { url: `${SITO}/`, lastModified: new Date("2026-07-01") },
    ...(data ?? []).map((p) => ({
      url: `${SITO}/prodotti/${p.slug}`,
      lastModified: new Date(p.updated_at),   // ← dal database, non da `new Date()`
    })),
  ];
}
```

Tre regole, ognuna col suo difetto.

**Dentro ci vanno solo URL che rispondono 200, che sono canonici e che sono indicizzabili.** Una sitemap che elenca un URL `noindex`, o uno che redirige, o uno coperto da un `Disallow`, dichiara due cose opposte allo stesso destinatario. Il controllo incrociato è facile e va fatto: nessun URL della sitemap può portare `noindex`, nessuno può cadere sotto una regola di `Disallow` del `robots.txt` dello stesso sito.

**`lastModified` viene da una colonna vera.** Scriverci `new Date()` rende ogni pagina "modificata adesso" a ogni fetch: il campo smette di portare informazione proprio mentre è l'unico che il crawler usa per decidere cosa vale la pena riscaricare, e due letture consecutive della sitemap non sono più uguali, il che rende inutile qualunque confronto.

**Il filtro sulla pubblicazione non è cosmetico.** Una sitemap costruita elencando tutte le righe pubblica gli URL dei prodotti non ancora pubblicati: per il crawler sono 404, per un concorrente sono il listino di domani.

Due dettagli operativi: `priority` e `changeFrequency` sono documentati come **ignorati** da Google, quindi sono decorazione — se restano, che sia una scelta e non un'abitudine; e il protocollo delle sitemap si ferma a 50.000 URL o 50 MB non compressi per file, oltre i quali si passa a `generateSitemaps`. Quei due numeri vengono dalla specifica, non da una misura.

## Dati strutturati (JSON-LD)

L'App Router non ha un'API di metadata per i dati strutturati: si rende uno `<script>` dentro il Server Component della pagina.

```tsx
// dentro src/app/prodotti/[slug]/page.tsx, nel Server Component
const prodotto = await leggiProdotto(slug);
if (!prodotto) notFound();

// Costruito dallo STESSO oggetto che dipinge la pagina: due sorgenti di verita'
// per il prezzo vogliono dire che il giorno in cui il prezzo cambia dal
// gestionale, il risultato ricco continua ad annunciare quello vecchio.
const datiStrutturati = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: prodotto.nome,
  description: prodotto.descrizione_breve,
  image: [new URL(prodotto.immagine_url, SITO).toString()],
  offers: {
    "@type": "Offer",
    url: `${SITO}/prodotti/${prodotto.slug}`,
    priceCurrency: "EUR",
    price: (prodotto.prezzo_cents / 100).toFixed(2),
    availability: prodotto.disponibile
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
  },
};

return (
  <>
    <script
      type="application/ld+json"
      // `</script>` dentro una descrizione presa dal database chiuderebbe il tag,
      // e da li' in poi il JSON verrebbe interpretato come markup. Non e' un
      // dettaglio di stile: e' il testo del cliente che diventa markup del sito.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datiStrutturati).replace(/</g, "\\u003c") }}
    />
    {/* … la pagina … */}
  </>
);
```

**Quando valgono la pena.** Solo quando esiste un risultato ricco che il motore disegna davvero per quel tipo e per quel sito: `Product` con prezzo e disponibilità, `Organization` o `LocalBusiness` con indirizzo e orari, `BreadcrumbList`. `FAQPage` no: dall'agosto 2023 Google ha ristretto quel risultato ricco ai siti governativi e sanitari riconosciuti, quindi su una bottega è markup che non produce niente — e siccome queste politiche cambiano, prima di scriverlo si verifica che sia ancora così, non si copia questa riga.

**La regola dura**: i dati strutturati devono dire la stessa cosa che la pagina mostra. Un prezzo nel JSON-LD che non è il prezzo reso in pagina viola le linee guida sui dati strutturati (contenuto dichiarato e non visibile), e la sanzione è manuale, cioè arriva quando arriva e non si vede in nessuna misura locale. Costruire l'oggetto dalla stessa variabile che dipinge la pagina non è eleganza: è l'unico modo di non avere due verità.

Cosa si può verificare in locale: che il JSON sia sintatticamente valido, che abbia `@context` e `@type`, e che i campi obbligatori di quel tipo ci siano. La validazione vera (Rich Results Test, Schema Markup Validator) è un servizio remoto e non entra in un gate che deve girare senza rete.

## Come si verifica un metatag

Le sorgenti di verità candidate sono tre, e **una sola conta**: il corpo della risposta HTTP. Non il sorgente TypeScript, non il DOM del browser.

### Perché il sorgente non è una prova

Perché fra `export const metadata` e il byte servito ci sono cinque cose che possono cambiare l'esito, e nessuna di loro si vede nel file che stai leggendo:

- **l'ereditarietà** — un campo che il figlio non dichiara arriva dal genitore, e il `canonical: "/"` del layout radice (§`alternates.canonical`) vale ancora;
- **la sostituzione** — `openGraph` e `robots` dichiarati dal figlio buttano via quelli del genitore per intero, non campo per campo;
- **il segmento che ha davvero reso** — `notFound()`, `redirect()`, un error boundary, un rewrite nel middleware: i tag serviti sono quelli di ciò che ha risposto, non di ciò che stavi leggendo;
- **i dati veri** — `generateMetadata` che con lo slug del seed torna un titolo e con lo slug vero cade nel ramo di ripiego;
- **la cache** — una rotta resa a build time porta il metadata calcolato a build time. Il sorgente non dice quando è stato calcolato, né quando verrà ricalcolato.

### Perché il DOM non è una prova

Perché il DOM è ciò che resta **dopo** che gli script hanno girato, e i crawler partono da prima. Un titolo scritto da un `useEffect`, un tag iniettato da uno script di consenso, un `<meta>` aggiunto da un componente che si monta solo dopo l'idratazione: nel DOM ci sono tutti e tre, nella risposta nessuno. Attenzione al caso che **non** appartiene a questo elenco: un `<title>` reso dentro un componente che il server rende comunque, e issato nel `<head>` da React 19, finisce **anche** nell'HTML servito. Non è un tag invisibile al crawler: è il secondo `<title>` di §Contare, non trovare, cioè il difetto opposto. Alcuni motori rendono JavaScript in un secondo passaggio, con un budget e una coda che non controlli; i raschiatori delle anteprime social non lo fanno mai.

C'è un modo più subdolo di ingannarsi, ed è specifico dell'App Router: **dopo una navigazione lato client la barra degli indirizzi dice `/prodotti/sedia-nordica`, ma quel documento non è mai stato scaricato**. Il titolo che vedi nella scheda l'ha messo il router React aggiornando la testa del documento della pagina precedente. Guardare quel DOM e concludere che la pagina ha il suo titolo è un errore di misura, non un'opinione. Per questo la verifica è **una richiesta HTTP indipendente all'URL**, non una navigazione dentro una sessione aperta.

### Come si fa, in concreto

```bash
# la premessa: build di produzione. `next dev` non e' il sito (SKILL.md, prima legge)
npm run build && npm run start -- --port 4311

# il corpo servito e le intestazioni, senza browser e senza seguire i redirect
curl -sS -D intestazioni.txt -o pagina.html --max-redirs 0 \
  http://127.0.0.1:4311/prodotti/sedia-nordica
```

```js
// `redirect: "manual"`: seguire un 307 verso /accedi significherebbe misurare i
// metatag della pagina di accesso credendo di misurare quelli di /admin — cioe'
// dichiarare `noindex` verificato su una pagina che non e' stata guardata.
const risposta = await fetch(url, { redirect: "manual" });
const html = await risposta.text();

// si CONTANO, non si cerca la prima occorrenza
const titoli = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim());
const canonici = [...html.matchAll(/<link\b[^>]*\brel=["']?canonical["']?[^>]*>/gi)];

// l'intestazione puo' contraddire il corpo, e vince lei
const xRobots = risposta.headers.get("x-robots-tag");
```

Quattro cose che questa verifica deve fare, e il difetto che ciascuna intercetta.

**Contare, non trovare.** Due `<title>` nello stesso documento sono un difetto — succede quando qualcuno rende un `<title>` dentro un componente e React lo issa nel `<head>` accanto a quello di `metadata`. Un controllo che si ferma al primo `match` dichiara verde. Peggio col canonical: la documentazione di Google dice che con più `rel=canonical` li ignora **tutti**, quindi due canonical corretti valgono come nessuno.

**Leggere anche le intestazioni.** `X-Robots-Tag` vale quanto il metatag e sta fuori dal corpo. Il caso da cercare per primo è una regola di `headers()` scritta per il backoffice con un `source` più largo di quanto si credesse — o un `noindex` da ambiente di collaudo mai tolto — che rende `noindex` l'intero sito: nel sorgente delle pagine non c'è **niente** da vedere, e la sola prova sta nelle intestazioni della risposta.

**Sapere che questo non è un parser HTML.** L'ordine degli attributi è libero: `<meta content="…" name="description">` è HTML legale, e un'espressione regolare che pretende `name` prima di `content` dichiara MANCANTE un tag che c'è. Un `<title>` dentro un `<svg>` inline è un altro elemento in un altro spazio di nomi e viene catturato dalla stessa espressione. O si estraggono gli attributi tag per tag senza assumerne l'ordine, o il residuo si dichiara — non si finge che non esista.

**Guardare una pagina per modello, non una per sito.** Home, elenco, dettaglio, pagina statica: i dettagli nascono da `generateMetadata` e sono quelli che si rompono in blocco, e il canonical ereditato dal layout si vede solo confrontando due pagine diverse.

## Cosa NON si indicizza

Ogni sito Web Gun ha un backoffice, e il backoffice ha una porta. Le rotte sono quelle dichiarate da `gestionale-crafter`: `/admin/*` per il gestionale, `/accedi` come unica rotta pubblica di accesso (`rotte-protette.md`). **Dimenticarle è facile, e non per distrazione**: la ragione è organizzativa prima che tecnica — l'area riservata la costruisce un agente, la collauda un altro, e la passata sui metatag guarda le pagine che vendono. `/accedi` non sta nell'elenco di nessuno.

La conseguenza non è una fuga di dati — la guardia regge, e la regge indipendentemente da tutto ciò che c'è scritto qui. È che cercando il nome del cliente il secondo risultato è la pagina di accesso dello staff: una query di marca sprecata, una porta pubblicizzata, e un URL che una volta entrato nell'indice ci resta finché qualcuno non ne chiede la rimozione con un accesso a Search Console che al lancio spesso non ha ancora nessuno.

| Rotta | Cosa vede il crawler | Cosa si dichiara | Perché non l'altra cosa |
|---|---|---|---|
| `/accedi` | 200, HTML pubblico | `robots: { index: false, follow: false }` nel metadata della pagina | **non** un `Disallow`: bloccata la fetch, il `noindex` non verrebbe mai letto |
| `/accedi?motivo=non-autorizzato` | 200, URL distinto | eredita il `noindex` della pagina; se non lo ereditasse, `canonical` a `/accedi` | un URL con query è un URL a sé: quel redirect lo produce il codice della guardia, e basta che qualcuno lo incolli da qualche parte |
| `/admin`, `/admin/*` (pagine) | 307 verso `/accedi` | `noindex` nel `layout.tsx` della sezione, accanto alla guardia | il redirect basta finché la guardia regge; il `noindex` è la riga che vale il giorno in cui una pagina viene resa pubblica per sbaglio |
| `/admin/*`, `/api/*` (route handler) | JSON, nessun `<head>` | `X-Robots-Tag: noindex` da `next.config.ts` | in una risposta JSON non esiste un metatag da mettere |
| pagine di esito (`/ordine/grazie?id=…`) | 200 | `noindex` | un identificativo d'ordine dentro un URL indicizzato è più di un problema di SEO |

Il `noindex` di `/admin` si scrive nel `layout.tsx` **della sezione**, cioè nello stesso file che porta la guardia: due dichiarazioni che riguardano la stessa cosa viaggiano insieme e si spostano insieme. Per i route handler non c'è alternativa all'intestazione, perché — misurato da `gestionale-crafter` — un route handler non esegue i layout e non produce `<head>`. Che l'intestazione impostata da `next.config.ts` sopravviva anche alla risposta 307 della guardia **va verificato leggendo la risposta**, non assunto: è esattamente il genere di dettaglio che cambia fra due versioni minori.

Tre strumenti, tre mestieri diversi, e confonderli è il modo in cui si finisce protetti sulla carta:

- la **guardia** protegge i dati, ed è l'unica delle tre che lo faccia;
- il **`noindex`** tiene una pagina fuori dall'indice, e solo se la pagina può essere scaricata;
- il **`Disallow`** tiene un crawler lontano, e non deindicizza niente.

Un `noindex` su una rotta admin senza guardia è un cartello che chiede gentilmente. Se Speed Demon trova una rotta amministrativa priva di controllo, **non è roba sua**: la segnala nell'handoff e la chiude chi l'ha scritta — questo agente cambia come il sito fa le cose, non cosa fa.

E l'errore speculare, che è più raro ma costa di più: il sito **intero** `noindex` perché un `robots.txt` di collaudo o un `robots: { index: false }` nel layout radice è sopravvissuto al lancio. Per questo il controllo ha due metà e non una: sulle pagine pubbliche dichiarate asserisce che il `noindex` **non c'è**, sulle rotte private che c'è. Un controllo che cerca solo la presenza dove se l'aspetta è mezzo controllo, ed è la metà che non ha mai fermato niente.

## Quello che `ssr: false` toglie ai motori

Un componente caricato con `ssr: false` non esiste nel corpo servito. Il metadata invece sì, perché lo calcola il server comunque: **una pagina può avere titolo, description, canonical e Open Graph perfetti e un corpo vuoto per il crawler**, e il passo `seo-meta` resta verde. Sono due controlli diversi e vanno tenuti diversi.

Il rimedio è economico: la stessa lettura del corpo servito asserisce anche la presenza di un ancoraggio di contenuto — l'`h1`, il nome di un prodotto del seed. È la stessa tecnica che Flow Sentinel usa per il fine opposto, asserire l'**assenza** di contenuto riservato in `risposta.text()` (`flow-sentinel/references/playwright.md`); qui si asserisce la presenza, e la ragione per cui il DOM non basta è identica.

Nota di versione: in App Router, `next/dynamic` con `ssr: false` dentro un Server Component è un errore in fase di build da Next 15. Resta scrivibile dentro un componente client, e lì fa esattamente il danno descritto. Da riverificare con un `next build` sul progetto: è un vincolo che si è già mosso una volta.

## Cosa un controllo di metatag NON prova

- **Che il contenuto sia buono.** Prova che `<title>` esiste, che non è duplicato fra le pagine misurate e che non è vuoto. Che dica qualcosa per cui una persona clicca è un giudizio, e non c'è una misura locale che lo produca.
- **Che Google indicizzi la pagina.** L'indicizzazione è una decisione del motore. Il canonical è un suggerimento, la sitemap è un invito, il `noindex` è l'unica direttiva forte del gruppo — e solo se la pagina viene scaricata. Nessun controllo eseguito in locale può dire che un URL è nell'indice: quello si vede in Search Console, che sta fuori da questo agente e fuori da questa build.
- **Che il canonical punti alla pagina giusta.** Il controllo può dire che il tag c'è, che è assoluto, che risponde 200 e che due pagine diverse non dichiarano lo stesso valore. Quale di due varianti sia la principale è una decisione di prodotto, e se è sbagliata il gate è verde su un errore che costa l'indicizzazione di una sezione intera.
- **Che i tag serviti in produzione siano questi.** Qui si legge una build locale. In produzione ci sono un dominio diverso, variabili d'ambiente diverse, una CDN e forse un proxy che riscrive intestazioni: `metadataBase`, canonical, `X-Robots-Tag` possono uscirne cambiati. La stessa lettura va rifatta sull'URL pubblicato, ed è lavoro di chi pubblica.
- **Che il crawler che conta si comporti come questa `fetch`.** Nessun user-agent particolare, nessuna esecuzione di JavaScript, nessun modello del budget di rendering. Si misura ciò che il server consegna a un client qualunque; è la premessa di tutto il resto, e non è tutto il resto.
- **Che le pagine misurate siano quelle giuste.** Vale qui la stessa onestà del gate: l'elenco delle pagine pubbliche arriva da `docs/performance.md`, e il gate legge la firma, non la sua verità. Una sezione dimenticata nell'elenco è una sezione su cui il verde non dice niente.
