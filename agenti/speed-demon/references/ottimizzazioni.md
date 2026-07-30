# Il catalogo delle ottimizzazioni, e il costo di ognuna

Si legge prima di `plan` e prima di ogni singolo `tune`. Ogni voce dichiara quattro cose, e sono quattro perché tre non bastano a decidere: **cosa tocca** (quali file), **su quale metrica agisce**, **quanto costa** (cosa peggiora, cosa cambia a schermo, cosa si perde) e **cosa può rompere** (quali spec di Flow Sentinel possono diventare rosse). Una voce senza costo scritto non è stata capita: è un'ottimizzazione ricopiata.

Il costo non è una formalità retorica. Speed Demon è il primo agente che modifica codice già collaudato da un altro, e l'unica differenza fra un'ottimizzazione e una rottura è che la prima ha dichiarato in anticipo cosa stava barattando. Chi conferma lo Specchio delle ottimizzazioni approva il baratto, non il numero.

## Perché qui non ci sono percentuali di guadagno

Nessuna voce dice «fa guadagnare N punti». Non è prudenza: un guadagno dipende da cosa quel sito ha davvero addosso — se l'elemento LCP è un'immagine, `next/image` sposta molto e `dynamic()` quasi niente; se è un titolo di testo, è l'esatto contrario. Un numero copiato da un articolo è indistinguibile da un numero inventato una volta che è finito in `docs/performance.md`, e da lì diventa la promessa su cui qualcuno decide. Quindi qui c'è **su quale metrica** ci si aspetta il movimento, e **di quanto** lo dice la misura del progetto: mediana di N giri prima, mediana di N giri dopo (`references/misurazione.md`).

I pesi servono per ordinare le candidate, e quelli sono pubblicati. La categoria Performance di **Lighthouse 10-12** pesa TBT 30%, LCP 25%, CLS 25%, FCP 10%, Speed Index 10%: un'ottimizzazione che tocca solo il Speed Index e una che tocca il TBT non valgono uguale, e i pesi vanno riletti su `lighthouse --version` perché fra major sono cambiati (in Lighthouse 8 c'era ancora il TTI, in 10 non c'è più). Le soglie «buono» dei Core Web Vitals pubblicate da Chrome — LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms — sono la ragione per cui il contratto dichiara soglie invece di «più veloce»: senza una soglia, «più veloce» è sempre vero e non finisce mai.

Nota onesta e ricorrente: **Lighthouse non misura INP**. INP è una metrica di campo; in laboratorio il suo surrogato è il TBT, che misura quanto il thread principale è stato bloccato, non quanto risponde male un bottone vero premuto da un dito vero. Ogni voce di questo catalogo che promette «meno TBT» promette un surrogato.

## Indice, e cosa si baratta

| Voce | Metrica su cui agisce | Costo principale | Rompe tipicamente |
|---|---|---|---|
| `next/image` e formati moderni | LCP, byte trasferiti | build più lenta, `remotePatterns` obbligatori, SVG a parte | ogni pagina con immagini, se manca il pattern remoto |
| `priority` sull'immagine LCP | LCP | banda tolta al resto; se messo ovunque, si annulla | nulla — sbaglia in silenzio |
| `next/font` e `font-display` | FCP, LCP di testo, CLS | FOUT, o testo invisibile, o identità persa | screenshot di riferimento |
| confine client/server | TBT, First Load JS | leggibilità del confine, prop non serializzabili | form, handler, stato condiviso |
| `dynamic()` e `ssr: false` | TBT, byte iniziali | contenuto assente dall'HTML servito | crawler, SEO, asserzioni immediate |
| streaming e `<Suspense>` | TTFB, FCP | codice di stato già inviato, guscio senza dati | asserzioni che girano sul fallback |
| `revalidate` e cache | tempo di risposta del server | dati vecchi, sessioni perse | gestionale → vetrina, aree riservate |
| CSS di Tailwind in produzione | FCP (CSS bloccante), byte | classi che spariscono se costruite a runtime | niente — la batteria non vede lo stile |
| lazy loading sotto la piega | byte al caricamento | lampo bianco, CLS se il box non è riservato | elementi che compaiono dopo l'asserzione |
| meno JavaScript di terze parti | TBT | consenso e analytics fuori ordine | banner, chat, tracciamenti |
| `prefetch` dei `Link` | nessuna metrica di Lighthouse **se le rotte esistono** | richieste e carico sul database | `best-practices`, se le rotte prefetchate sono `404`: misurato, §11 |

L'ultima colonna dice già la cosa più importante di questo documento: **tre voci su undici** — `priority`, il CSS di Tailwind, il `prefetch` — **sbagliano senza produrre nessun rosso**, e `next/font` diventa la quarta in ogni progetto che non ha asserzioni visive. La rete di Flow Sentinel copre i flussi, non l'aspetto e non il conto del server.

---

## 1. `next/image` e i formati moderni

*Tocca:* `src/components/**`, `src/modules/<dominio>/**`, `next.config.ts` · *Metrica:* LCP, byte trasferiti (audit `uses-responsive-images`, `modern-image-formats`, `unsized-images`)

Un `<img>` scritto a mano consegna a tutti lo stesso file: il JPEG da 1600 px arriva identico al telefono da 360 px, che lo scala solo al momento di disegnarlo — i byte di troppo sono già stati scaricati e pagati. Quanti siano non si stima a occhio: è il peso trasferito della richiesta. `next/image` fa tre cose che si possono verificare una per una — genera un `srcset` sulle `deviceSizes`, ricodifica nel formato che il browser dichiara di accettare, e riserva il box perché `width`/`height` (o `fill` con un contenitore dimensionato) diventano un `aspect-ratio` in CSS. La terza è quella che nessuno ricorda ed è quella che tiene fermo il CLS, che pesa il 25%.

`sizes` non è opzionale quando l'immagine non ha larghezza fissa: senza, con `fill`, il default è `100vw` e il browser sceglie dal `srcset` la variante buona per uno schermo intero anche per una miniatura in griglia. È il difetto più frequente di questa voce, e non si vede a occhio — si vede nella colonna `Size` del pannello di rete, o nel `Content-Length` della richiesta a `/_next/image`.

```tsx
// src/modules/catalogo/foto-prodotto.tsx — Server Component
import Image from "next/image";

export function FotoProdotto({ url, nome, principale }: {
  url: string; nome: string; principale: boolean;
}) {
  return (
    <Image
      src={url}
      alt={nome}                                       // §Ottimizzazioni vietate: non si toglie
      width={800}
      height={600}                                     // riservano il box: CLS
      sizes="(max-width: 768px) 100vw, 400px"          // senza: il telefono scarica la variante da desktop
      priority={principale}                            // UNA sola per pagina: §2
      className="h-auto w-full rounded"
    />
  );
}
```

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // il default di Next 15 e' ["image/webp"]: AVIF si aggiunge, non si sostituisce,
    // perche' il browser negozia con Accept e chi non lo supporta deve trovare WebP
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "abcdefgh.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
```

```bash
# cosa e' stato davvero consegnato: formato e byte, non impressioni
curl -sI -H 'Accept: image/avif,image/webp,*/*' \
  'http://127.0.0.1:3000/_next/image?url=%2Fhero.jpg&w=828&q=75' | grep -i 'content-type\|content-length'
```

**Costo.** L'ottimizzazione avviene nel processo del server alla prima richiesta di ogni variante, e la documentazione di Next dichiara AVIF *circa il 20% più piccolo e circa il 20% più lento a codificare* di WebP: è il numero del fornitore, non una misura di questo progetto, e va confrontato col tempo della prima richiesta a freddo su una pagina con dodici immagini. L'ottimizzatore si appoggia a `sharp`, e se sia già incluso o vada installato cambia fra major di Next: va letto sulla versione del progetto, perché su un host che non ce l'ha il costo non è «più lento», è la richiesta di ottimizzazione che fallisce. Con `formats` che include AVIF la cache su disco arriva a tenere due file per variante invece di uno — uno per formato negoziato via `Accept` — e quanto occupi si guarda in `.next/cache/images`, non si stima. La qualità di default è 75: sotto, si vedono gli artefatti sulle foto di prodotto, ed è una decisione di chi vende, non di chi ottimizza. Gli SVG restano fuori: abilitarli richiede `dangerouslyAllowSVG`, e un SVG può contenere script — la costituzione mette la sicurezza (2) sopra la performance (7), quindi gli SVG si servono come sono.

**Cosa può diventare rosso.** Una sola cosa, e arriva subito: un `hostname` mancante in `remotePatterns` fa fallire il rendering dell'immagine con un errore, e **tutte** le spec che aprono una pagina di catalogo diventano rosse insieme. È il fallimento buono di questa voce — rumoroso, immediato, con il messaggio giusto. Il fallimento cattivo è silenzioso: `sizes` sbagliato non rompe nessuna spec e nessun punteggio se ne accorge finché non si guarda il peso trasferito.

**Cosa questa voce non prova.** Che l'immagine servita sia quella giusta. `next/image` ricodifica ciò che gli si dà: una foto sorgente da 4000 px caricata dal gestionale resta una foto da 4000 px nello storage, e il costo si sposta sul server invece di sparire. Ridurre la sorgente è lavoro di chi carica, non di questo agente.

---

## 2. `priority` sull'immagine LCP, e perché metterlo su tutte lo annulla

*Tocca:* il singolo componente che contiene l'elemento LCP · *Metrica:* LCP e basta

`priority` su un `next/image` fa tre cose insieme: toglie il `loading="lazy"`, imposta `fetchPriority="high"` e inserisce un `<link rel="preload">` nella testa del documento. Serve a chiudere una finestra precisa: il browser scopre un'immagine quando il parser arriva al tag, e se quel tag sta dopo un blocco di markup, o dentro un componente che arriva in streaming, la richiesta parte tardi. Il preload la fa partire subito.

Il punto che rende questa voce infida: `fetchPriority="high"` non è un acceleratore, è un **ordinamento**. Dice al browser «questa prima delle altre». Se dieci immagini sono `priority`, la frase diventa «queste dieci prima delle altre», il che non ordina più niente: il browser le richiede tutte insieme, si spartiscono la stessa banda, e l'immagine che davvero decide l'LCP arriva più tardi di quando sarebbe arrivata senza nessun `priority`. In più le nove sotto la piega hanno perso il lazy loading, quindi vengono scaricate durante il caricamento iniziale, rubando banda a se stesse. È un'ottimizzazione che, applicata due volte, vale meno di zero.

```bash
# quante IMMAGINI la pagina servita dichiara in preload. Il filtro su `as="image"`
# non e' pedanteria: Next precarica anche i chunk JS e i font, quindi contare
# `rel="preload"` da solo restituisce un numero alto su una pagina sana e fa
# concludere il contrario del vero. Piu' di uno va giustificato: §2 ne ammette una.
curl -s http://127.0.0.1:3000/ | grep -o '<link[^>]*as="image"[^>]*>' | wc -l
```

Qual è l'elemento LCP non si decide a intuito: lo dichiara Lighthouse nell'audit `largest-contentful-paint-element`, e cambia fra mobile e desktop perché cambia cosa sta sopra la piega. Su mobile l'LCP è spesso il titolo, non l'immagine — e allora `priority` non ha niente da fare e la voce giusta è la 3.

**Costo.** Banda sottratta a tutto il resto nel primo istante del caricamento, che è l'istante in cui la banda serve. Un preload su una risorsa che non è l'LCP è puro danno: la banda va a qualcosa che non serve subito, e l'unica traccia automatica è l'avviso in console di Chrome («preloaded using link preload but not used within a few seconds»), che nessun passo del gate legge. L'audit di Lighthouse su questo tema è cambiato di nome fra major, quindi si cerca nel report della versione installata invece di citarne uno a memoria.

**Cosa può diventare rosso.** Niente. Nessuna spec di Flow Sentinel guarda l'ordine di caricamento, e nessun `getByRole` cambia esito perché un'immagine è arrivata prima. Questa voce sbaglia in silenzio, e l'unico modo per accorgersene è la misura ripetuta: se `priority` non ha spostato la mediana dell'LCP, o non era l'elemento giusto o ce n'erano troppi.

---

## 3. `next/font` e `font-display`

*Tocca:* `src/app/layout.tsx`, la configurazione di Tailwind · *Metrica:* FCP e LCP quando l'LCP è testo, CLS

Un font caricato con `<link>` verso un dominio esterno costa una risoluzione DNS, una connessione TLS e una richiesta di CSS **prima** che il browser scopra il file del font: una catena di andate e ritorno che si paga tutta prima del primo carattere disegnato. `next/font` scarica i file al momento della build, li serve dal proprio dominio, e non lascia nessuna richiesta verso terzi — il che, oltre alla velocità, toglie di mezzo una trasmissione di indirizzi IP a un fornitore esterno che Cyber Shield dovrebbe altrimenti giustificare.

Il default di `next/font/google` è `display: "swap"`, e `adjustFontFallback` è attivo: Next calcola un fallback locale con `size-adjust` e le metriche corrette, così il testo dipinto col ripiego occupa quasi lo stesso spazio del font vero e la sostituzione non muove il layout. È la ragione per cui swap qui costa meno che scritto a mano.

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],        // senza: si scaricano alfabeti che il sito non usa
  display: "swap",           // default di next/font/google, scritto per non doverlo indovinare
  variable: "--font-inter",
});

export const metadata: Metadata = { title: { default: "…", template: "%s · …" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

Le quattro strategie non sono equivalenti e la scelta è di chi possiede il marchio, non di chi ottimizza. `swap` mostra subito il testo col ripiego e lo sostituisce quando il font arriva: il testo si legge sempre, e si vede il cambio. `block` tiene il testo **invisibile** per il periodo di blocco del browser — in Chrome sono 3 secondi, ed è comportamento del browser, non una misura di questo progetto — quindi se l'elemento LCP è un titolo, `block` sposta l'LCP di quanto ci mette il font. `optional` dà al font una finestra brevissima e, se non ce la fa, **rinuncia per quella visita**: il primo visitatore su rete lenta vede il sito con Arial, e nessuno se ne accorge in ufficio. `fallback` sta in mezzo.

**Costo.** Con `swap`, il lampo di sostituzione (FOUT), visibile a ogni prima visita. Con `optional`, l'identità visiva persa su una parte dei visitatori che non si può conoscere da qui. Con `block`, l'LCP peggiore in cambio di zero FOUT. Costo comune a tutte: i pesi del font finiscono nella build, e ogni peso e ogni stile aggiunto è un file in più da scaricare — tre pesi di un font variabile non sono tre file, un font statico con tre pesi sì.

**Cosa può diventare rosso.** Nessuna spec basata su `getByRole` o `getByText`: il testo è lo stesso, cambia il disegno. Diventano rosse le eventuali asserzioni visive (`toHaveScreenshot`) al primo giro dopo il cambio, ed è un rosso legittimo che si risolve rigenerando il riferimento e guardandolo. Se il progetto ha una Content-Security-Policy scritta da Cyber Shield con l'host dei font esterni in `font-src`, passare a `next/font` la rende una regola morta: va tolta, o resta lì a dichiarare un permesso che non serve più.

---

## 4. Il confine client/server nell'App Router

*Tocca:* `src/app/**`, `src/modules/<dominio>/**` · *Metrica:* TBT (peso 30%), First Load JS per rotta

Nell'App Router il default è il Server Component: non arriva nel bundle, non si idrata, non costa millisecondi di thread principale. `"use client"` segna un **confine**, e da quel confine in giù ogni modulo importato finisce nel bundle del browser — compresi quelli importati per una costante, compresa la libreria di date importata per formattare una riga.

La formula «`"use client"` risale l'albero» va detta con precisione, perché la direttiva da sola non risale: scende lungo il grafo degli import. A risalire è la mano di chi scrive, e per un motivo meccanico e verificabile — **fra server e client passano solo prop serializzabili**. Nel momento in cui un componente server prova a passare una funzione (un `onChange`, un handler) a un figlio client, non compila; la strada breve è mettere `"use client"` anche sul padre, e quella dopo sul nonno, finché il confine si trova in cima e la pagina intera è diventata un'applicazione client con un server che la stampa una volta. Il difetto concreto non è teorico: si vede nella colonna *First Load JS* della tabella che `next build` stampa a fine build, e cresce di colpo di centinaia di kilobyte quando qualcuno ha spostato il confine di un livello.

La via d'uscita è la composizione: un componente client può ricevere del contenuto **già renderizzato dal server** come `children`, e quel contenuto resta server.

```tsx
// src/app/prodotti/page.tsx — resta Server Component: non entra nel bundle
import { listaProdotti } from "@/modules/catalogo/query";
import { FiltroClient } from "@/modules/catalogo/filtro-client";   // "use client": ha lo stato dei filtri
import { SchedaProdotto } from "@/modules/catalogo/scheda-prodotto"; // server: solo markup e dati

export default async function Pagina() {
  const prodotti = await listaProdotti();
  return (
    // `children` attraversa il confine gia' renderizzato: SchedaProdotto NON
    // finisce nel bundle solo perche' il suo contenitore e' un componente client
    <FiltroClient totale={prodotti.length}>
      {prodotti.map((p) => <SchedaProdotto key={p.id} prodotto={p} />)}
    </FiltroClient>
  );
}
```

```bash
npm run build   # la colonna "First Load JS" per rotta e' la misura; l'impressione non lo e'
```

**Costo.** Il confine giusto è più difficile da leggere di quello comodo: due file invece di uno, e un lettore che deve sapere quale dei due gira dove. Si perde anche la scorciatoia di tenere tutto lo stato in un posto: la parte server non ha `useState`, quindi lo stato condiviso va ripensato invece che spostato. E c'è un modo di fallire che va conosciuto prima di provarci: **spostare un modulo dal client al server non è gratis se quel modulo tocca dati**. Un client Supabase creato in un componente server usa i cookie della richiesta e le policy dell'utente; lo stesso codice spostato altrove può cambiare identità, e cambiare identità è un problema di sicurezza, non di velocità.

**Cosa può diventare rosso.** Questa è la voce che rompe i **form**. Un bottone che perde `"use client"` perde il suo handler, la spec clicca, non succede niente, e l'asserzione sulla riga nel database (`effetto-db`) fallisce con un messaggio che parla del conteggio, non del bottone. Rompe anche i widget con stato — filtri, quantità nel carrello, accordion — con lo stesso profilo: la pagina si vede, l'interazione non c'è. È la classe di rottura che la batteria intercetta meglio, purché la spec assertisca l'effetto e non solo il testo.

---

## 5. `dynamic()`, e il caso `ssr: false`

*Tocca:* i componenti pesanti e raramente usati · *Metrica:* TBT, byte del bundle iniziale

`next/dynamic` spezza il bundle: il componente non entra nel pacchetto iniziale ma in un file a parte, richiesto quando serve. È l'ottimizzazione giusta per la mappa in fondo alla pagina contatti, l'editor di testo ricco del gestionale, il carosello di recensioni — cioè per il codice che pesa e che la maggioranza dei visitatori non incontra.

`ssr: false` è un'altra cosa e va tenuta separata: dice di non renderizzare quel componente sul server **affatto**. In Next 15 non è nemmeno ammesso dentro un Server Component — il build si ferma con un errore esplicito — quindi vive solo dentro un albero client, e questo è già un indizio di quanto sia una decisione, non un dettaglio.

```tsx
"use client";
import dynamic from "next/dynamic";

const Mappa = dynamic(() => import("./mappa"), {
  ssr: false,   // in Next 15 NON e' ammesso in un Server Component: e' un errore di build
  // il fallback occupa lo STESSO box del componente vero, altrimenti l'arrivo
  // della mappa sposta il layout e il CLS peggiora mentre il TBT migliora
  loading: () => (
    <div role="status" aria-label="Caricamento mappa" className="h-80 w-full rounded bg-neutral-100" />
  ),
});
```

```bash
# cosa vede chi non esegue JavaScript. Zero = il contenuto non e' nell'HTML servito.
curl -s http://127.0.0.1:3000/contatti | grep -c 'Via Roma 12'
```

**Costo.** Per `dynamic()` senza `ssr: false`: una richiesta in più al momento dell'uso, e quindi un ritardo dove prima non c'era — se il componente è dietro un click, il click ora aspetta la rete. Per `ssr: false` il costo è di un'altra categoria e non è negoziabile alla leggera: **il contenuto non esiste nell'HTML servito**. Googlebot dichiara di eseguire JavaScript, ma lo fa in un secondo passaggio con tempi che nessuno controlla; i crawler delle anteprime social (i preview di WhatsApp, Telegram, LinkedIn, Slack) leggono l'HTML e basta, non eseguono niente, e quindi un indirizzo, un prezzo o un titolo dentro un componente `ssr: false` per loro non esiste. Se quella pagina è pubblica e deve essere trovata, `ssr: false` è una perdita di contenuto travestita da ottimizzazione: va rifiutata, o accettata per iscritto da chi conferma. Vedi `references/seo.md`.

**Cosa può diventare rosso.** Le spec che asseriscono subito dopo il `goto`: il componente arriva con la sua richiesta, e `toBeVisible()` scade prima. Le spec dei flussi ostili in lettura scritte bene diventano invece rosse **al contrario** e per un motivo buono da capire: `agenti/flow-sentinel/references/playwright.md` pretende l'asserzione sul **corpo servito** (`risposta.text()`), quindi un contenuto spostato in `ssr: false` sparisce dal corpo e un'asserzione di *presenza* fallisce, mentre una di *assenza* passa senza aver dimostrato niente. Qui il rosso e il verde si scambiano di posto, ed è il motivo per cui questa voce va dichiarata nel piano parola per parola.

---

## 6. Streaming e `<Suspense>`

*Tocca:* `src/app/**/page.tsx`, `loading.tsx` · *Metrica:* TTFB e FCP; l'LCP solo se l'elemento LCP sta nel guscio

Una pagina che interroga tre volte Supabase non manda niente al browser finché la terza query non torna. Con `<Suspense>` — o con un `loading.tsx`, che è lo stesso avvolto attorno al segmento — il guscio parte subito e i pezzi lenti arrivano dopo, nella stessa risposta. Il difetto che previene è concreto: lo schermo bianco per tutta la durata della query più lenta, che l'utente legge come «il sito non funziona» e non come «il sito sta pensando».

```tsx
// src/app/prodotti/[slug]/page.tsx
import { Suspense } from "react";
import { SchedaProdotto } from "@/modules/catalogo/scheda-prodotto";
import { Recensioni } from "@/modules/recensioni/recensioni";

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;   // Next 15: params e searchParams sono Promise
  return (
    <>
      {/* nel guscio: e' l'elemento LCP, non va sospeso */}
      <SchedaProdotto slug={slug} />
      {/* sospeso: la query delle recensioni non deve trattenere il prezzo */}
      <Suspense fallback={<p role="status">Caricamento recensioni…</p>}>
        <Recensioni slug={slug} />
      </Suspense>
    </>
  );
}
```

```bash
# il codice di stato di una pagina che non esiste: 200 vuol dire soft-404
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/prodotti/non-esiste
```

**Costo.** Il primo è tecnico e va verificato sul progetto: **una volta che il guscio è partito, il codice di stato è già stato mandato**. Un `notFound()` che scatta dentro un ramo sospeso mostra la pagina 404 con una risposta 200, e un motore di ricerca indicizza una pagina che dice «non esiste» come pagina valida. Si verifica col `curl` qui sopra, non si assume. Il secondo costo è di percezione: il fallback è un pezzo di interfaccia in più che l'utente vede e che qualcuno deve disegnare — se il fallback ha un'altezza diversa dal contenuto vero, l'arrivo del contenuto sposta la pagina e il CLS peggiora esattamente mentre il TTFB migliora. Il terzo: sospendere l'elemento LCP peggiora l'LCP. Lo streaming non accorcia la query lenta, sposta chi la aspetta.

**Cosa può diventare rosso.** Le spec che asseriscono su contenuto sospeso subito dopo il `goto`: trovano il fallback. La forma corretta della spec non cambia — `expect(...).toBeVisible()` riprova fino al timeout, quindi regge — ma una spec che leggeva un conteggio con `page.locator(...).count()` (una lettura secca, non un'asserzione che riprova) diventa instabile: conta zero righe perché il blocco non è ancora arrivato. Il rosso arriva a intermittenza, che è la forma peggiore. Se il piano include streaming, va detto nel piano: la spec va corretta in un'asserzione che aspetta la condizione, non «rilanciata finché passa».

---

## 7. `revalidate` e le strategie di cache dell'App Router

*Tocca:* `src/app/**` (configurazione di segmento), le Server Action del gestionale · *Metrica:* tempo di risposta del server (audit `server-response-time`), e quindi TTFB, FCP, LCP

È la voce che sposta di più e che rompe di più. Una pagina statica servita dalla cache non interroga il database: risponde con un file. Su un catalogo che cambia due volte a settimana è la differenza fra una query per visita e nessuna.

Prima di applicarla vanno sapute tre cose che in **Next 15** sono cambiate rispetto al 14, e che rendono obsoleto metà di quello che si trova scritto in giro: `fetch` **non è più cachata di default**, i Route Handler `GET` **non sono più cachati di default**, e il Client Router Cache ha `staleTime` 0 sui segmenti di pagina. Tradotto: la cache in Next 15 è quasi tutta esplicita, e quella che si crede attiva per default probabilmente non lo è. Va verificato sull'output di `next build`, che marca ogni rotta come statica o dinamica.

```ts
// src/app/prodotti/page.tsx
// il catalogo puo' essere vecchio al massimo un'ora: e' una decisione di chi vende
export const revalidate = 3600;
```

```ts
// src/modules/catalogo/azioni.ts — la Server Action del gestionale
"use server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function creaProdotto(dati: FormData) {
  // …scrittura con la sessione dell'utente e le sue policy, mai con la service_role…

  // senza queste due righe la vetrina resta vecchia fino a un'ora, e il gestionale
  // sembra rotto a chi ha appena salvato: e' un difetto di correttezza, non di cache
  revalidateTag("prodotti");
  revalidatePath("/prodotti");
}
```

Una precisazione che costa un pomeriggio a chi non la sa: le opzioni `next: { tags, revalidate }` valgono sulla `fetch` di Next. `@supabase/supabase-js` usa la propria `fetch` e **non le riceve** a meno che non gliene si passi una; per cachare una query di Supabase o le si dà una `fetch` propria, o la si avvolge in `unstable_cache` con i suoi tag — nome che dichiara da solo quanto è stabile, quindi la scelta va scritta nell'handoff.

L'altra metà della voce è ciò che **non** si può cachare. `await cookies()`, `await headers()` e `await draftMode()` rendono la rotta dinamica per costruzione, ed è giusto: una pagina che legge la sessione con `@supabase/ssr` legge cookie. Metterci sopra `export const dynamic = "force-static"` non la rende veloce, la rende **sbagliata**: serve a tutti la stessa pagina, cioè la pagina di qualcun altro o quella di nessuno.

**Costo.** Dati vecchi, per una finestra che si sceglie. Su una descrizione di prodotto è accettabile e va scritto; su un prezzo, su una disponibilità, su un saldo, è un danno commerciale con la faccia di un'ottimizzazione, e la decisione non è dell'agente. Costo secondario: la cache va invalidata da chi scrive, quindi ogni percorso di scrittura acquisisce una responsabilità in più, e quella dimenticata è invisibile finché non se ne accorge un cliente.

**Cosa può diventare rosso.** Due classi, entrambe frequenti. Il **gestionale che non si riflette sulla vetrina**: la spec crea un prodotto da `/admin/prodotti`, poi apre `/prodotti` e non lo trova. Questo rosso è un regalo — non è la spec che è fragile, è la `revalidateTag` che manca — e la cura non è abbassare `revalidate` a zero, che spegne l'ottimizzazione, ma collegare l'invalidazione alla scrittura. E le **sessioni che non arrivano**: una rotta d'area riservata resa statica serve il guscio da anonimo, la spec con `storageState` non trova l'intestazione «Area riservata», e l'asserzione fallisce su una pagina che a mano sembra funzionare perché il browser dello sviluppatore ha già la sua cache. Peggio del rosso è il caso simmetrico: una spec ostile in lettura che passa perché il contenuto riservato è stato cachato e servito **a tutti** — lì il verde è il difetto.

---

## 8. Il CSS di Tailwind in produzione

*Tocca:* `src/app/globals.css`, la configurazione di Tailwind · *Metrica:* FCP e LCP (il CSS è bloccante per il rendering), byte trasferiti

Tailwind genera solo le classi che **trova scritte nei sorgenti**: non interpreta il codice, cerca stringhe. In produzione il foglio risultante è tipicamente piccolo, e il primo dovere di questa voce è dirlo — prima di toccare il CSS va misurato quanto pesa, perché nella grande maggioranza dei siti Web Gun non è lì il collo di bottiglia, e ottimizzare il CSS mentre il collo è un'immagine da 2 MB è tempo speso a spostare grammi.

```bash
npm run build && ls -l .next/static/css/*.css   # i byte veri, prima di decidere che sono troppi
```

Il difetto concreto di questa voce non è il peso: è la **classe che sparisce**. Una classe costruita a runtime non è una stringa nel sorgente, quindi lo scanner non la vede, quindi non finisce nel foglio, quindi l'elemento è senza stile — e nessuna spec se ne accorge, perché l'elemento c'è, ha il suo testo e il suo ruolo.

```tsx
// MALE: nel sorgente non esiste nessuna stringa "bg-emerald-100": lo scanner non
// la trova, la classe non viene generata, e l'etichetta esce senza colore
<span className={`bg-${stato}-100 text-${stato}-800`}>{etichetta}</span>

// BENE: le classi complete sono scritte, quindi esistono. La mappa e' anche il
// posto in cui si legge quali stati esistono, che il template concatenato nascondeva.
const COLORE_STATO: Record<StatoProdotto, string> = {
  bozza: "bg-neutral-100 text-neutral-800",
  pubblicato: "bg-emerald-100 text-emerald-800",
  esaurito: "bg-amber-100 text-amber-800",
};

<span className={COLORE_STATO[stato]}>{etichetta}</span>
```

**Costo.** Restringere l'area scansionata «perché la build sia più veloce» è il modo più diretto per far sparire lo stile di un pezzo di sito: qualunque sorgente fuori dall'area — un componente in un pacchetto, una cartella nuova che nessuno ha aggiunto ai percorsi — contribuisce classi che non verranno generate. Allargare l'area costa secondi di build e non rompe niente: fra i due errori, quello da fare è il secondo. Costo secondario: la mappa di classi complete è più verbosa del template concatenato, ed è il prezzo di avere uno stile che esiste.

**Cosa può diventare rosso.** Niente, e va detto chiaro: la batteria di Flow Sentinel usa selettori di ruolo e di testo, che di uno stile mancante non sanno niente. Una pagina completamente slavata supera i sette passi del gate. Questa voce si verifica guardando la pagina, o con un'asserzione visiva se il progetto ne ha una.

---

## 9. Il lazy loading sotto la piega, e il lampo bianco che costa

*Tocca:* immagini e componenti sotto la piega · *Metrica:* byte al caricamento, TBT se ciò che si rimanda è JavaScript; **rischio su CLS**

`next/image` è già lazy per default su tutto ciò che non è `priority`: il browser richiede l'immagine quando si avvicina alla finestra. Estendere lo stesso principio ai componenti — un carosello, una sezione di recensioni, una mappa — si fa con `dynamic()` (voce 5) o con un montaggio su `IntersectionObserver`.

Il costo si vede solo scorrendo, e per questo sfugge a chi misura da fermo: sopra la sezione rimandata compare un rettangolo vuoto, e il contenuto arriva mentre l'occhio ci è già sopra. È il **lampo bianco**. Su una connessione lenta dura abbastanza da sembrare un errore; su una rete d'ufficio non lo vede nessuno, che è il motivo per cui viene approvato. Se il rettangolo vuoto non ha la stessa altezza del contenuto vero, all'arrivo la pagina salta: si è comprato peso di caricamento pagando in CLS, che pesa quanto l'LCP. Riservare il box non è una raffinatezza, è la condizione perché questa voce sia un guadagno netto.

**Costo.** Un lampo bianco a ogni scorrimento sul contenuto rimandato, e la percezione di un sito che «si costruisce mentre lo guardi». Chi conferma decide se è accettabile: «il lampo è accettabile» è un giudizio, non una misura, e va scritto come giudizio nell'handoff.

**Cosa può diventare rosso.** Qui la meccanica di Playwright va conosciuta o si perde un pomeriggio. `toBeVisible()` **non richiede che l'elemento sia nella finestra**: chiede che sia nel DOM e abbia un box non vuoto. Quindi un componente montato su intersezione, che finché non si scorre non esiste affatto, non diventa mai visibile e l'asserzione scade — rosso pieno. Ma `click()` e `fill()` fanno scorrere automaticamente, quindi la stessa pagina passa i test che interagiscono e fallisce quelli che guardano. Il risultato è una batteria che diventa rossa a macchie, con un profilo che non assomiglia a niente, e la tentazione è di aggiungere uno scorrimento nella spec. Se lo si fa, va scritto nell'handoff: **il test è stato cambiato per accomodare un'ottimizzazione**, e da quel momento asserisce una cosa leggermente diversa da prima.

---

## 10. Ridurre il JavaScript di terze parti

*Tocca:* `src/app/layout.tsx` e ovunque ci siano `<Script>` · *Metrica:* TBT (peso 30%), byte

È spesso la voce col rapporto guadagno/rischio migliore, perché il codice di terze parti è quello che nessuno del progetto ha scritto e nessuno sta misurando. Lighthouse dà il numero da cui partire senza doverlo stimare: l'audit **`third-party-summary`** elenca per fornitore i byte trasferiti e il tempo di blocco del thread principale. Si parte da quella tabella, non da un'opinione su quale script sia pesante.

```tsx
import Script from "next/script";

// afterInteractive (default): dopo l'idratazione. Per cio' che deve funzionare presto.
<Script src="https://cdn.esempio.it/consenso.js" strategy="afterInteractive" />

// lazyOnload: durante il tempo morto dopo il caricamento. Per cio' che puo' aspettare.
<Script src="https://cdn.esempio.it/chat.js" strategy="lazyOnload" />
```

**Costo.** Cambiare il momento in cui uno script parte cambia **cosa quello script osserva**. Un tracciamento spostato su `lazyOnload` perde le visite di chi esce prima che parta: i numeri del cliente calano, il cliente lo nota, e nessuno collega il calo a un commit di performance fatto tre settimane prima. Un widget di chat che arriva tardi è una conversazione persa. E c'è un costo che non è di performance ma di legge: se il banner di consenso e lo script che traccia cambiano ordine, si può finire a tracciare **prima** del consenso. Questo non è un baratto fra velocità e comodità, è un difetto di correttezza — priorità 1 della costituzione contro la 7 — e l'ordine va verificato, non dedotto.

**Cosa può diventare rosso.** Le spec che aspettano il banner dei cookie o un widget di terze parti: l'elemento arriva più tardi del timeout. Le spec che cliccano «accetta» prima di procedere diventano instabili, il che è peggio di rosse. E si rompono i flussi che dipendono da uno script esterno per funzionare davvero — un campo di pagamento ospitato, un widget di prenotazione: lì il rimando non è un'ottimizzazione, è una funzione che smette di esserci per qualche secondo.

---

## 11. Il `prefetch` dei `Link`

*Tocca:* i componenti con liste di link · *Metrica:* **nessuna metrica di Lighthouse**

Questa voce va nel catalogo con un avvertimento in testa: `prefetch` non compare in nessun punteggio. Lighthouse misura il caricamento di **una** pagina; il prefetch migliora la navigazione *successiva*, che in laboratorio non esiste. Chi la mette nel piano deve dichiarare che il suo effetto non si vedrà nella misura — altrimenti si finisce a spiegare perché il punteggio non è salito.

Nell'App Router `<Link>` prefetcha per default i link che entrano nella finestra: per le rotte statiche l'intera rotta, per quelle dinamiche la parte fino al confine `loading.tsx` più vicino. Su una pagina con dieci link è un dettaglio. Su un catalogo con duecento schede visibili scorrendo sono duecento richieste al server, e se quelle rotte sono dinamiche sono duecento interrogazioni a Supabase per pagine che nessuno aprirà. Il costo si è spostato dal browser dell'utente al database del cliente, ed è una direzione che va scelta apposta, non subita.

```tsx
// in una lista lunga: la navigazione parte al click, e il server non serve
// duecento pagine che nessuno guardera'
<Link href={`/prodotti/${p.slug}`} prefetch={false}>{p.nome}</Link>
```

```bash
# le richieste di prefetch sono richieste RSC: nel pannello di rete si filtrano
# per `_rsc=` nella query. Contarle su una pagina di lista dice quanto costa.
```

Da verificare sulla versione installata: in Next 15 il Client Router Cache ha `staleTime` 0 sui segmenti di pagina, quindi una rotta prefetchata può essere richiesta di nuovo al momento della navigazione — cioè il prefetch rende meno di quanto rendeva in Next 14, se non si configura `experimental.staleTimes`. È comportamento del framework, va letto sulla versione del progetto prima di promettere qualcosa.

**Costo.** Richieste, banda dell'utente (su rete mobile a consumo si scaricano pagine mai aperte) e carico sul server. Spegnendolo: la navigazione torna a costare un viaggio, e su un sito da sfogliare si sente.

**Cosa può diventare rosso.** Praticamente niente, con **tre** eccezioni da conoscere. Una spec che conta le richieste di rete cambia esito. Un prefetch aggressivo può **mascherare** un difetto: la pagina successiva è già in cache, la spec la trova pronta, e la lentezza vera si vede solo in produzione a cache fredda.

E la terza, che smentisce l'avvertimento in testa a questa voce e che è stata **misurata** il 2026-07-30 su `banco-prova-immobiliare`: **se le rotte prefetchate non esistono, il prefetch costa punteggio.** Una lista con tre `<Link>` verso schede di dettaglio non ancora costruite produce tre richieste RSC che tornano `404`, e i 404 finiscono nella console del browser:

```
best-practices = 96
  FALLITO peso 1 — errors-in-console
     "Failed to load resource: 404" — /immobili/borgo-alto?_rsc=…
     "Failed to load resource: 404" — /immobili/casa-vigna?_rsc=…
     "Failed to load resource: 404" — /immobili/rustico-noce?_rsc=…
```

Quattro punti di `best-practices`, su una pagina che a occhio non ha niente che non va: i link ci sono, cliccarli porterebbe a una 404 che nessuno ha ancora cliccato. È il prefetch a *scoprire in anticipo* un link rotto e a scriverlo nel punteggio. La lettura giusta non è «togliere il prefetch»: è che **la voce ha reso visibile un difetto dell'applicazione**, cioè una lista che rimanda a pagine che non esistono. Toglierlo lo nasconderebbe di nuovo.

---

## Cosa rompe cosa

La tabella collega ogni voce alla classe di flusso che tipicamente manda in rosso, e — colonna che conta di più — dice quando invece **non** manda in rosso niente. La rete di Flow Sentinel è una rete sui flussi: non è una rete sull'aspetto, sui byte o sul conto del server.

| Ottimizzazione | Flusso che rompe, in concreto | Come si presenta | Se ne accorge la batteria? |
|---|---|---|---|
| `"use client"` tolto o spostato più in basso | il form non invia: l'handler non esiste nel browser | il click passa, l'asserzione su `helpers/db` conta la riga che non c'è | **sì**, se la spec asserisce l'effetto sul database |
| `dynamic()` con `ssr: false` | contenuto assente dall'HTML servito | `curl` non lo trova; le anteprime social sono vuote; l'asserzione di presenza sul corpo servito fallisce | **sì per i flussi ostili**, che leggono `risposta.text()`; per il resto no |
| `revalidate` / `force-static` su rotta con sessione | la sessione non arriva: si serve a tutti la pagina anonima | la spec con `storageState` non trova l'area riservata | **sì** — e se invece il contenuto riservato viene cachato e servito a tutti, la spec ostile passa: il **verde** è il difetto |
| `revalidate` senza invalidazione sulla scrittura | il gestionale non si riflette sulla vetrina | crea il prodotto, apre la lista pubblica, non c'è | **sì**, ed è il rosso più utile del catalogo |
| cache su un Route Handler `GET` | risposte di un utente servite a un altro | intermittente, e in produzione peggio che in locale | **raramente**: serve una spec che interroghi la rotta con due sessioni |
| lazy / montaggio su intersezione | l'elemento compare dopo l'asserzione | `toBeVisible()` scade; ma `click()` scorre e passa: rosso a macchie | **sì**, in modo confuso |
| `<Suspense>` e streaming | l'asserzione gira sul fallback | rosso a intermittenza sulle letture secche (`count()`), non sulle asserzioni che riprovano | **a intermittenza**, che è la forma peggiore |
| streaming e codice di stato | soft-404: pagina «non trovato» con risposta 200 | solo `curl -w '%{http_code}'` lo mostra | **no** |
| script di terze parti differiti | banner del consenso e chat arrivano tardi | timeout su elementi di terze parti; ordine consenso/tracciamento invertito | **sì** per il banner, **no** per l'ordine |
| `next/image` senza `remotePatterns` | ogni pagina con immagini remote fallisce | rosso immediato e generalizzato | **sì**, rumorosamente |
| `priority` su tutte le immagini | nessun flusso: solo l'LCP che non migliora | il punteggio non sale, e sembra che l'ottimizzazione «non funzioni» | **no** |
| classi Tailwind costruite a runtime | nessun flusso: solo lo stile che manca | la pagina è slavata e supera i sette passi del gate | **no** |
| `font-display: optional` | nessun flusso: il font non appare a una parte dei visitatori | invisibile in ufficio, invisibile in laboratorio | **no** |
| `prefetch` acceso su liste lunghe | nessun flusso: richieste e carico sul database | nei log del server; e **nel punteggio**, se le rotte prefetchate non esistono (`errors-in-console`, misurato §11) | **no** |

Cinque righe con «no» nell'ultima colonna. Sono le ottimizzazioni che vanno **guardate**, non solo misurate e testate: si apre la pagina, si scorre, si carica un font a rete strozzata, si conta cosa il server ha servito. Il gate di Speed Demon non le copre, e un gate verde su una di queste non dice niente.

---

## Ottimizzazioni vietate

Quattro mosse compaiono in ogni guida alla performance e in questo repo non si fanno, indipendentemente dal punteggio che promettono: togliere l'attributo `alt`, spegnere il focus visibile, ridurre il DOM eliminando testo, rimuovere gli attributi `aria-*`.

Il divieto ha una gerarchia dietro, e non è un'opinione: la costituzione di Web Gun mette **accessibilità al posto 5 e performance al posto 7**. Una regola più bassa non deroga a una più alta. Ma il divieto ha anche tre argomenti pratici, e conviene averli tutti e tre, perché chi propone queste mosse di solito ha in mano un numero.

**Il primo: Lighthouse le paga due volte.** Il guadagno in Performance è quello di qualche centinaio di byte su una categoria dominata da TBT (30%), LCP (25%) e CLS (25%) — cioè da rete, immagini e JavaScript, non da attributi HTML. Nel frattempo la categoria Accessibilità perde gli audit corrispondenti: `image-alt` per gli `alt` mancanti, i controlli sui nomi accessibili per gli `aria-*` tolti. Si paga una categoria intera per un arrotondamento nell'altra. E il gate di chiusura ha una casella apposta, «nessuna regressione di accessibilità (punteggio a11y non sceso)»: quella casella diventa rossa, e un gate rosso non si consegna.

**Il secondo, ed è quello che convince: la batteria diventa rossa.** `agenti/flow-sentinel/references/playwright.md` prescrive selettori di ruolo e di label — `getByRole("button", { name: "Salva" })`, `getByLabel("Prezzo in centesimi")`. Quei selettori si reggono sul **nome accessibile**. Togliere l'`alt` a un'immagine dentro un link, togliere un `aria-label` a un bottone icona, staccare una label da un input: il nome accessibile sparisce, il locator non trova più niente, e il flusso critico diventa rosso. Non è un effetto collaterale sfortunato, è il motivo esplicito per cui quella convenzione esiste: *un selettore di ruolo si rompe quando si rompe l'accessibilità*, cioè esattamente quando serve che qualcosa diventi rosso. Chi propone di togliere un `aria-label` per «pesare meno» sta proponendo di rompere la rete di sicurezza per risparmiare venti byte.

**Il terzo: quasi sempre non è nemmeno vero.** «Meno DOM, meno lavoro» esiste come effetto — Lighthouse ha l'audit `dom-size`, e la soglia oltre la quale segnala è cambiata fra major, quindi si legge nel report della versione installata invece di ricordarla — ma riguarda il **numero di nodi**, non il testo dentro un nodo: accorciare una descrizione di prodotto non toglie un nodo, toglie contenuto (e contenuto che i motori di ricerca leggono, il che porta il danno anche in `references/seo.md`). Se qualcuno sostiene il contrario, la regola della casa vale anche contro di lui: si misura, con la mediana di N giri e la dispersione dichiarata, prima e dopo. Un guadagno che non sopravvive alla seconda misura è rumore che ha fatto comodo.

Caso pratico che ricorre e va riconosciuto: `focus:outline-none` scritto in Tailwind per «pulire» un bottone. Se non è accompagnato da un anello visibile equivalente, quella riga rende il sito inutilizzabile da tastiera — e non fa guadagnare **niente**, perché è una dichiarazione CSS in un foglio già scaricato. Non è nemmeno un'ottimizzazione mal riuscita: è solo un danno, che si maschera da scelta estetica.

```tsx
// VIETATO: nessun guadagno, e chi naviga da tastiera non sa piu' dov'e'
<button className="focus:outline-none">Salva</button>

// AMMESSO: si sostituisce il contorno del browser, non lo si spegne
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">Salva</button>
```

Se un'ottimizzazione richiede davvero di togliere una funzione o del contenuto, la toglie chi l'ha messa, con la sua motivazione. Qui si cambia **come** il sito fa le cose, non **cosa** fa.

---

## Cosa questo catalogo non prova

- **Che una voce applicata correttamente porti un guadagno.** Dice su quale metrica cercare il movimento. Se la mediana non si è mossa, l'ottimizzazione non era per questo sito: si torna indietro e si scrive perché, invece di lasciarla lì «tanto non fa male».
- **Che le voci siano indipendenti.** Non lo sono: `priority` senza `sizes` sposta poco, `dynamic()` su un albero che è client per sbaglio cura il sintomo del difetto della voce 4, `revalidate` su una rotta che legge i cookie non fa niente perché quella rotta è dinamica comunque. È il motivo per cui `tune` ne applica **una alla volta**, rimisurando: cinque insieme non dicono quale ha funzionato né quale ha rotto.
- **Che l'elenco sia completo.** Copre ciò che nei siti Web Gun — Next.js App Router, Tailwind, Supabase — si è rivelato decisivo. Un progetto con una mappa interattiva, un player video o un configuratore 3D ha voci proprie, e vanno scritte con le stesse quattro colonne: cosa tocca, quale metrica, quanto costa, cosa rompe.
- **Che il costo dichiarato sia il costo vero.** «Il lampo bianco è accettabile», «un'ora di dati vecchi va bene», «il font può non arrivare»: sono giudizi di chi conferma lo Specchio, non misure. Questo catalogo garantisce che il giudizio venga **chiesto**, non che sia giusto.
