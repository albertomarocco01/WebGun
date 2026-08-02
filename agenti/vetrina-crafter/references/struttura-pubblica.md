# La struttura del sito pubblico

Da caricare quando generi lo **scaffold**: dove sta cosa, com'e' fatta la cucitura,
da dove nasce l'unico client dei dati. E' la fase che rende verificabile tutto il
resto — dopo, ogni pagina eredita queste scelte.

## L'albero

```
progetto/
├── vetrina.config.json           le COORDINATE (percorsi, primitive, moduli client)
├── docs/vetrina.md               il CONTRATTO firmato (pagine, fonti, slot)
├── src/
│   ├── app/
│   │   ├── layout.tsx            intestazione, navigazione, pie' di pagina
│   │   ├── page.tsx              la home
│   │   ├── not-found.tsx         la pagina che non c'e'
│   │   └── <sezione>/page.tsx    una cartella per pagina dichiarata
│   ├── components/ui/            LA CUCITURA — solo primitive, niente dominio
│   ├── modules/<dominio>/        query e trasformazioni
│   └── lib/supabase/public.ts    l'UNICO client, con la chiave anonima
└── supabase/config.toml          da qui il gate ricava la porta del database
```

Regola di collocazione, dal `CLAUDE.md`: **l'entry-point compone soltanto**. Una
`page.tsx` che contiene una query e' un file che fa due mestieri, e il secondo non
si puo' riusare da nessun'altra parte.

## `vetrina.config.json`

Le coordinate, non le decisioni. Le decisioni stanno nel contratto, e sono firmate.

```json
{
  "radicePubblica": "src/app",
  "radiciEscluse": ["src/app/admin", "src/app/accedi"],
  "cucitura": "src/components/ui",
  "primitive": ["Bottone", "Card", "Sezione", "Campo"],
  "moduliClient": ["src/lib/supabase/public.ts"],
  "lettoreContenuti": "src/modules/contenuti/leggi.ts"
}
```

`radiciEscluse` si popola da `gestionale.config.json` quando quel file c'e': la
radice admin la dichiara il suo proprietario, e copiarla a mano significa avere due
verita' che divergono al primo `evolve`.

**Nessun valore va ripetuto fra questo file e il contratto.** Un valore scritto in
due posti prima o poi ne dichiara due diversi, e il gate leggerebbe quello sbagliato
senza nessun modo di accorgersene.

## La cucitura

`DECISIONI.md` §21: **Fly UI non esiste**. I componenti si scrivono a mano, e vivono
solo qui. La promessa e' che il giorno in cui una libreria arrivera' si riscriva il
**corpo** di questi file, non le venti pagine che li usano — e quella promessa e'
vera solo se questi file non sanno niente del dominio.

```tsx
// src/components/ui/Bottone.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principale" | "quieto";
  children: ReactNode;
};

export function Bottone({ variante = "principale", children, ...resto }: Props) {
  const stile = variante === "principale"
    ? "bg-verde-800 text-white hover:bg-verde-900"
    : "border border-neutral-300 text-neutral-800 hover:bg-neutral-50";
  return (
    <button
      {...resto}
      // `type` esplicito: dentro un `<form>` il default e' `submit`, e un
      // bottone che invia il modulo per sbaglio e' un difetto che si scopre
      // solo provando.
      type={resto.type ?? "button"}
      className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${stile}`}
    >
      {children}
    </button>
  );
}
```

```tsx
// src/components/ui/index.ts — la porta della cucitura
export { Bottone } from "./Bottone";
export { Card } from "./Card";
export { Sezione } from "./Sezione";
export { Campo } from "./Campo";
```

Le pagine importano **solo da qui**:

```tsx
import { Bottone, Card } from "@/components/ui";
```

### Cosa il gate boccia, e perche'

| Forma | Esito | Perche' |
|---|---|---|
| `import { Bottone } from "./Bottone"` dentro `src/app/` | `block` | e' una copia della primitiva: il giorno della sostituzione ne resta indietro una |
| `import { leggiPiante } from "@/modules/catalogo"` dentro la cucitura | `block` | una primitiva che sa di dominio non e' sostituibile |
| `import { db } from "@/lib/supabase/public"` dentro la cucitura | `block` | una primitiva che legge dati non e' una primitiva |
| un file `src/app/catalogo/Bottone.tsx` | `issue` | due file con lo stesso nome sono due componenti diversi, e nessuno se ne accorge finche' non divergono |

**Cosa il gate NON vede, e va difeso dalla revisione:** un bottone reimplementato
dentro la pagina con classi Tailwind a mano. Distinguere una classe di impaginazione
legittima da una primitiva riscritta e' un giudizio, non una regola — e' scritto in
`SKILL.md` §Cosa un gate verde NON prova, dove si puo' leggere invece di essere
dimenticato.

## L'unico client, e la chiave che porta

```ts
// src/lib/supabase/public.ts — l'UNICO posto in cui nasce un client
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Il sito pubblico legge con la CHIAVE ANONIMA e vede esattamente quello che le
 * policy concedono. Non e' una precauzione: e' il modello di sicurezza. Un dato
 * che non esce di qui non deve uscire nemmeno dal componente.
 */
export function clientPubblico() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Tre regole che il gate fa rispettare:

1. **Nessuna `service_role` raggiungibile da `src/`.** Scavalca ogni policy, e su
   una superficie interamente anonima e' la differenza fra un catalogo e
   l'anagrafica. Un permesso che manca si chiede a schema-forge (handoff §7), non si
   cambia chiave.
2. **Nessun client costruito fuori dai `moduliClient` dichiarati.** E' il punto in
   cui una chiave sbagliata entra senza che nessuno la veda: gestionale-crafter ci
   ha misurato un `src/lib/supabase/admin.ts` scritto per «risolvere» un
   `permission denied`.
3. **Nessuna variabile `NEXT_PUBLIC_` che prometta un segreto.** Quel prefisso e' un
   contratto col browser: il valore entra nel bundle e lo legge chiunque.

## Il layout pubblico

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";

import { Navigazione } from "@/components/ui";
import { contenutoPubblico } from "@/modules/contenuti/leggi";

export const metadata: Metadata = {
  // Il titolo di una pagina e' CONTENUTO e lo scrive questo agente; canonical,
  // robots, sitemap e Open Graph NO — sono di speed-demon e di site-doctor
  // (SKILL.md §Perimetro). Non scriverli qui e' una scelta, non una dimenticanza.
  title: { default: "Vivaio Corte Vecchia", template: "%s · Vivaio Corte Vecchia" },
};

export default async function LayoutPubblico({ children }: { children: React.ReactNode }) {
  const pie = await contenutoPubblico("pie-pagina");
  return (
    <html lang="it">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        {/* Il salto al contenuto e' la prima cosa che incontra chi naviga da
            tastiera, e `jsx-a11y` non lo pretende: lo pretende chi usa il sito. */}
        <a href="#contenuto" className="sr-only focus:not-sr-only focus:absolute focus:p-3">
          Vai al contenuto
        </a>
        <Navigazione />
        <main id="contenuto">{children}</main>
        <footer>{pie?.corpo}</footer>
      </body>
    </html>
  );
}
```

`lang="it"` non e' un dettaglio: senza, uno screen reader legge il testo italiano
con la pronuncia della lingua di sistema, ed e' incomprensibile.

## Quello che NON si costruisce qui

- **La porta d'ingresso, le rotte admin, la vista dei contenuti** — gestionale-crafter.
- **`sitemap.ts`, `robots.ts`, `canonical`, Open Graph** — speed-demon e site-doctor.
- **Tabelle, colonne, policy** — schema-forge. Se manca qualcosa e' una richiesta
  scritta nell'handoff, non una migrazione scritta di nascosto.
- **Il cookie banner** — site-doctor. E se il sito non ha ancora niente da
  consentire, dirlo e' meglio che metterne uno finto.
