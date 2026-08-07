#!/usr/bin/env node
/**
 * banco.mjs — ricostruisce da zero il banco di prova del gate di Launchpad.
 *
 * PERCHE' ESISTE. Il verbale di costruzione (`COSTRUZIONE-2026-08-06.md` §1,
 * §5.2, §8) dichiara un gemello pulito che chiude **VERDE 9/9** e dice che «si
 * ricostruisce con `banco.mjs`». Il collaudo del 2026-08-06 ha cercato quel
 * file e **non esiste in nessun percorso del repository**: viveva nello
 * scratchpad di quella sessione, che e' sparito con la sessione. L'affermazione
 * centrale del pacchetto — *zero falsi positivi su un progetto corretto* — non
 * era quindi riproducibile da nessuno, ed e' esattamente cio' che la §25 di
 * `DECISIONI.md` chiama un ricordo invece di una prova.
 *
 * Questo script chiude quel buco per il banco del collaudo, e per il prossimo.
 *
 * USO:  node banco.mjs [--dove <cartella>] [--porta 3182]
 *       node banco.mjs --contratti [--dove <cartella>] [--porta 3182]
 *
 * COSA FA DA SOLO: scrive il progetto, lo mette in un repository git con un
 * remoto locale (serve a `radice-pulita`), e mette in fila i commit
 * NELL'ORDINE CHE CONTA — codice, contratti, handoff, poi l'impronta, poi il
 * runbook — perche' la freschezza dei certificati dipende da quell'ordine.
 *
 * `--contratti` e' la SECONDA meta', e si lancia DOPO `impronta --scrivi`:
 * scrive `docs/deploy.md` (col commit approvato letto da git, non inventato) e
 * `docs/handoff/14-launchpad.md`, li committa e li spinge. Esiste perche' senza
 * di lei due dei nove ingressi del banco vivevano nella sessione di chi lo
 * aveva costruito — che e' esattamente il difetto per cui `banco.mjs` e' nato.
 *
 * COSA NON FA, e lo stampa invece di simularlo: `npm install`, `npm run build`
 * e l'avvio dell'app. Sono i tre passi che vogliono la rete e qualche minuto, e
 * un banco che finge di averli fatti sarebbe la cosa che questa skill misura
 * negli altri.
 *
 * NESSUNA PUBBLICAZIONE: qui non si crea nessun account, non si compra nessun
 * dominio, non si tocca nessun DNS. Il remoto e' una cartella `.git` nuda sul
 * disco di chi lancia.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OGGI = new Date().toISOString().slice(0, 10);

const handoff = (numero, nome, passi) => `# Handoff ${numero} — ${nome}

## 1. Cosa ho fatto

I deliverable di questo agente per lo Studio Dentistico Ponteverde. L'elenco per
esteso sta nel contratto; qui restano il verdetto e cio' che serve a chi viene
dopo.

## 2. Decisioni prese

| Decisione | Alternativa scartata | Perche' |
|---|---|---|
| il perimetro e' quello del contratto e non cresce | allargarlo strada facendo | un perimetro che cresce senza firma e' un perimetro che nessuno ha approvato |

## 3. Cosa si aspetta chi viene dopo

Che legga questo file e il contratto prima di iniziare.

## 4. Problemi noti

Quelli in \`docs/DEBITO-TECNICO.md\`, per numero. Nessun altro.

## 5. Esito del gate

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su ${passi} passi) — rilanciato il ${OGGI}.
`;

const FILE = {
  "package.json": JSON.stringify({
    name: "ponteverde", version: "0.1.0", private: true,
    packageManager: "npm@10.5.0",
    engines: { node: ">=22.0.0" },
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { "@supabase/supabase-js": "^2.58.0", next: "^15.5.4", react: "^19.1.0", "react-dom": "^19.1.0" },
    devDependencies: { "@types/node": "^22.10.0", "@types/react": "^19.1.0", typescript: "^5.7.0" },
  }, null, 2) + "\n",

  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true,
      // `strict` NON e' decorativo: e' l'impostazione sotto la quale il
      // frammento `generateBuildId` della skill non compilava (collaudo P2).
      strict: true, noEmit: true, esModuleInterop: true, module: "esnext",
      moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true,
      jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2) + "\n",

  "next.config.ts": `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,

  ".gitignore": "node_modules/\n.next/\nout/\nnext-env.d.ts\n.env\n.env.local\n.env.production\nsupabase/.temp/\nsupabase/.branches/\ntsconfig.tsbuildinfo\n",

  ".env.example": `# Nomi, non valori. Le NEXT_PUBLIC_* le scrive \`next build\` nel bundle:
# vanno impostate PRIMA della build.
NEXT_PUBLIC_SITO_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
`,

  "src/lib/seo.ts": `export function sitoUrl(): string {
  return process.env.NEXT_PUBLIC_SITO_URL ?? "https://studioponteverde.it";
}

export function canonical(percorso: string): string {
  return new URL(percorso, sitoUrl()).toString();
}
`,

  "src/lib/supabase/public.ts": `import { createClient } from "@supabase/supabase-js";

/** Chiave anonima: pubblica per costruzione, a difendere i dati sono le policy. */
export function clientPubblico() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const chiave = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
  return createClient(url, chiave, { auth: { persistSession: false } });
}
`,

  "src/components/ui/Bottone.tsx": `import type { ReactNode } from "react";

export function Bottone({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded bg-teal-700 px-4 py-2 text-white">{children}</span>;
}
`,

  "src/app/layout.tsx": `import type { Metadata } from "next";
import type { ReactNode } from "react";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Studio Dentistico Ponteverde",
  description: "Igiene, conservativa e ortodonzia a Ponteverde.",
  alternates: { canonical: canonical("/") },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
`,

  "src/app/page.tsx": `import { Bottone } from "@/components/ui/Bottone";

export default function Home() {
  return (
    <main>
      <h1>Studio Dentistico Ponteverde</h1>
      <p>Prima visita e piano di cura in un solo appuntamento.</p>
      <Bottone>Prenota una visita</Bottone>
    </main>
  );
}
`,

  "src/app/prenota/page.tsx": `import { clientPubblico } from "@/lib/supabase/public";

export const dynamic = "force-static";

export default async function Prenota() {
  const supabase = clientPubblico();
  const { data } = await supabase.from("trattamenti").select("nome").limit(5);
  return (
    <main>
      <h1>Prenota una visita</h1>
      <ul>
        {(data ?? []).map((t: { nome: string }) => (
          <li key={t.nome}>{t.nome}</li>
        ))}
      </ul>
    </main>
  );
}
`,

  "src/app/sitemap.ts": `import type { MetadataRoute } from "next";
import { canonical } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: canonical("/"), priority: 1 }, { url: canonical("/prenota"), priority: 0.8 }];
}
`,

  "src/app/robots.ts": `import type { MetadataRoute } from "next";
import { canonical } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: canonical("/sitemap.xml") };
}
`,

  "public/manifest.webmanifest": JSON.stringify({
    name: "Studio Dentistico Ponteverde", short_name: "Ponteverde", start_url: "/", display: "standalone",
  }, null, 2) + "\n",

  "supabase/migrations/20260801093000_iniziale.sql": `-- Listino dei trattamenti: l'unica tabella raggiungibile dal client.
create table if not exists public.trattamenti (
  id bigint generated always as identity primary key,
  nome text not null,
  descrizione text not null default '',
  prezzo_cents bigint not null default 0
);

alter table public.trattamenti enable row level security;

create policy "chiunque legge il listino"
  on public.trattamenti for select to anon, authenticated using (true);

revoke all on public.trattamenti from anon, authenticated, service_role;
grant select on public.trattamenti to anon, authenticated;
grant select, insert, update, delete on public.trattamenti to service_role;
`,

  "supabase/seed/00-riferimento.sql": `-- Seed di riferimento: vale in ogni ambiente. Nessun account, nessuna credenziale.
insert into public.trattamenti (nome, descrizione, prezzo_cents)
values ('Igiene professionale', 'Ablazione del tartaro.', 8000),
       ('Prima visita', 'Valutazione e piano di cura.', 0)
on conflict do nothing;
`,

  "docs/PROGETTO.md": `# Progetto — Studio Dentistico Ponteverde

**Banco di prova del gate di Launchpad. NON si pubblica.** Sito vetrina di uno
studio dentistico: home, pagina di prenotazione che legge il listino con la
chiave anonima, \`sitemap.xml\` e \`robots.txt\` derivati da \`NEXT_PUBLIC_SITO_URL\`.

Stack standard del \`CLAUDE.md\`, nessuna deroga. **Nessun gestionale**: quindi non
esiste \`docs/gestionale.md\` e non esiste l'handoff di gestionale-crafter — ed e'
corretto che il gate non lo pretenda, perche' la prova che un agente doveva
passare e' il suo contratto sul disco, non un elenco fisso.
`,

  "docs/vetrina.md": `# Contratto della vetrina — Ponteverde

| Percorso | Cosa mostra | Chi la vede |
|---|---|---|
| \`/\` | presentazione | chiunque |
| \`/prenota\` | listino dei trattamenti | chiunque |

Visibile a un anonimo: la tabella \`public.trattamenti\`. Nessun percorso di
scrittura aperto: la prenotazione e' un numero di telefono.

Confermato da: Alberto Marocco (committente) — ${OGGI}
`,

  "docs/flussi-critici.md": `# Flussi critici — Ponteverde

| # | Flusso | Effetto asserito sul database |
|---|---|---|
| 1 | la home risponde | nessuno: e' statica |
| 2 | \`/prenota\` elenca i trattamenti | \`select\` con la chiave anonima |
| 3 | un anonimo NON puo' scrivere sul listino | \`insert\` rifiutato: 0 righe |

Confermato da: Alberto Marocco (committente) — ${OGGI}
`,

  "docs/performance.md": `# Performance e indicizzazione — Ponteverde

Misurato su una build di produzione, non su \`next dev\`.

| Metrica | Valore |
|---|---|
| LCP (mediana di 3 giri) | 1,2 s |
| \`sitemap.xml\` e \`robots.txt\` | presenti, derivati da \`NEXT_PUBLIC_SITO_URL\` |

I due file sono **prerenderizzati una volta sola**: se la variabile e' sbagliata
al momento della build restano sbagliati finche' qualcuno non ricostruisce.

Confermato da: Alberto Marocco (committente) — ${OGGI}
`,

  "docs/DEBITO-TECNICO.md": `# Registro del debito tecnico — Ponteverde

La forma della tabella e' un contratto del gate: il numero in prima colonna, il
gettone \`CHIUSO <data>\` che **apre la terza**, e — dalla D23 §2 del
\`CANTIERE.md\` — la riga di forma fissa \`Blocca il deploy: si | no\` dentro la
riga di ogni voce **aperta**. Le voci chiuse sono esenti: una voce chiusa non e'
un residuo. Senza quella riga il gate non dice «non blocca»: dice **MANCANTE**,
perche' e' una domanda che a quella voce nessuno ha posto.

| # | Agente | Gravita' / stato | Cosa | Blocca il deploy? | Rientro previsto |
|---|---|---|---|---|---|
| n°1 | flow-sentinel | alto | Nessun tetto ai tentativi sulla pagina \`/prenota\`: un robot puo' martellarla. La limitazione di frequenza sta nel gateway del provider, che prima del deploy non esiste | **Blocca il deploy: si** — finche' non e' configurata o mitigata per iscritto | alla nascita di cyber-shield |
| n°2 | vetrina-crafter | basso | Le immagini dello studio sono segnaposto: e' un contenuto, non un difetto | Blocca il deploy: no | quando arrivano le foto |
| n°3 | schema-forge | CHIUSO ${OGGI} | \`engines.node\` non era dichiarato e la build falliva sotto Node 22 | — | — |
| n°4 | schema-forge | CHIUSO ${OGGI} | Il seed di riferimento non porta account: nessuna credenziale committata | — | — |
`,
};

/**
 * I due documenti che li scrive launchpad, non il banco: il runbook e il
 * proprio handoff. Qui stanno gia' compilati, ed e' una scelta dichiarata —
 * il banco serve a provare il GATE, non la prosa dell'agente.
 *
 * **La firma e' di una persona che non esiste**, e deve restare tale: questo e'
 * un banco di prova, non un progetto, e nessuno lo pubblichera' mai. Firmarlo
 * col nome di una persona vera sarebbe la cosa che la §6 esiste per impedire,
 * fatta su un file finto — e la casa ha gia' pagato una volta per una firma
 * messa da chi non aveva letto.
 */
const runbook = (sha, porta) => `# Runbook di deploy — Studio Dentistico Ponteverde

> **BANCO DI PROVA. Nessuno pubblichera' mai questo progetto**, e la firma qui
> sotto e' di una persona che non esiste. Serve a esercitare il passo
> \`runbook-firmato\`, non ad autorizzare niente.

## Le coordinate

Provider: Vercel
Dominio: https://studioponteverde.it
Runtime del provider: Node 24
Modo di deploy: git
Radici spedite: src/, next.config.ts, public/
Commit approvato: ${sha}
Impronta attesa: ${sha.slice(0, 12)}

**Perche' questo provider**: e' il default dichiarato di questa pipeline
(\`references/provider.md\` §0) e il sito e' interamente statico piu' una lettura
con la chiave anonima: nessuna funzione lunga, nessun ISR, traffico minimo.

**Apex e \`www\`**: l'apex serve il sito, \`www\` rimanda all'apex con un 308.
Concorda col \`canonical\`, che \`src/lib/seo.ts\` costruisce sull'apex.

**Chi possiede il dominio**: lo studio, non noi.

**Chi riceve gli avvisi** quando il sito cade: la segreteria dello studio.

## Variabili d'ambiente di produzione

**Nomi, non valori.** Questo file e' committato.

| Nome | Impostata | Note |
|---|---|---|
| NEXT_PUBLIC_SITO_URL | prima della build | https://studioponteverde.it |
| NEXT_PUBLIC_SUPABASE_URL | prima della build | progetto Supabase di produzione |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | prima della build | pubblica per costruzione: a difendere i dati sono le policy |

## Cosa diventa pubblico

- **Pagine pubbliche**: \`/\` e \`/prenota\`, piu' \`sitemap.xml\` e \`robots.txt\`.
- **Dati leggibili da un anonimo**: la sola tabella \`public.trattamenti\` — nome,
  descrizione e prezzo del listino.
- **Percorsi di scrittura aperti a un anonimo**: nessuno. La prenotazione e' un
  numero di telefono, non un modulo.
- **Aree protette**: nessuna. Questo progetto non ha gestionale.
- **Account che esistono in produzione al primo avvio**: nessuno.

## Rollback

Versione precedente: il deployment immediatamente precedente sul pannello del
provider, identificato dal commit che porta.

Procedura, **verificata il ${OGGI}** (sul banco, non su un provider):

\`\`\`
vercel rollback <deployment-precedente>   # oppure «Promote to Production» sul
                                          # deployment precedente dal pannello
\`\`\`

**Migrazioni in questa pubblicazione**: no. Lo schema non cambia, quindi il
rollback ha una meta' sola.

## Prescrizioni lasciate dagli altri agenti

| # | Cosa | Risposta |
|---|---|---|
| 1 | nessun tetto ai tentativi su \`/prenota\` | mitigata qui: tetto per IP sul gateway del provider, 60 richieste al minuto, impostato prima della pubblicazione e accettato da chi firma |

## Verdetti a monte, alla data della firma

| Agente | Handoff | \`Gate:\` dichiarato | Rilanciato il | Esito |
|---|---|---|---|---|
| schema-forge | docs/handoff/07-schema-forge.md | VERDE | non rilanciato | letto, non rimisurato |
| vetrina-crafter | docs/handoff/08-vetrina-crafter.md | VERDE | non rilanciato | letto, non rimisurato |
| flow-sentinel | docs/handoff/12-flow-sentinel.md | VERDE | non rilanciato | letto, non rimisurato |
| speed-demon | docs/handoff/13-speed-demon.md | VERDE | non rilanciato | letto, non rimisurato |

## La procedura, per intero

1. \`node <skill>/scripts/segreti.mjs\` — prima di tutto.
2. \`node <skill>/scripts/impronta.mjs --scrivi\`, poi \`npm ci && npm run build\`.
3. \`npx next start -p ${porta}\` e
   \`node <skill>/scripts/verify.mjs --url http://127.0.0.1:${porta}\` → verde.
4. **STOP.** Questo documento si legge e si firma.
5. Pubblicazione: **mai** — questo e' un banco di prova.

## Costi

Piano gratuito del provider, traffico di uno studio di quartiere. Non e'
misurabile da nessuno script: e' una dichiarazione, e chi firma la legge.

---

Confermato da: Elena Ferraris (titolare dello Studio Ponteverde) — ${OGGI}

> Persona di fantasia, su un progetto che non si pubblichera' mai. La riga sta
> **su una riga sola**, e non e' pignoleria: \`leggiRunbook\` legge la firma con
> un'ancora di riga, quindi una firma mandata a capo perde la data e il gate
> risponde «senza data: una firma non datata non si puo' confrontare con
> niente». Misurato su questo banco il 2026-08-06, alla prima esecuzione.
`;

const handoffLaunchpad = (sha) => `# Handoff 14 — Launchpad

## 1. Cosa ho fatto

- \`next.config.ts\`: \`generateBuildId\` derivato dal commit (l'unica riga di
  codice altrui che questo agente tocca).
- \`docs/deploy.md\`: il runbook, firmato sul contenuto.
- Gate a nove passi rilanciato sull'app servita in locale.

**Nessuna pubblicazione.** Nessun account, nessun dominio, nessun DNS, nessuna
spesa: questo e' il banco di prova del gate.

## 2. Decisioni prese

| Decisione | Alternativa scartata | Perche' |
|---|---|---|
| provider Vercel | Cloudflare | default dichiarato della pipeline, e il sito non usa niente che li distingua |
| impronta derivata dal commit | impronta registrata a mano | il provider ricostruisce dal sorgente: una registrazione non sopravvive |

## 3. Cosa si aspetta chi viene dopo

Che l'indirizzo pubblico, dopo il deploy, porti l'impronta \`${sha.slice(0, 12)}\`.
Si verifica con \`impronta.mjs --url <dominio> --commit ${sha.slice(0, 12)}\`.

## 4. Problemi noti

Il debito n°1 (nessun tetto ai tentativi) e' **mitigato**, non chiuso: la
risposta e' nel runbook, in §Prescrizioni, e la difesa vera arrivera' con
cyber-shield.

## 5. Esito del gate

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 9 passi).
`;

// ---------------------------------------------------------------- esecuzione
function parseArgs(argv) {
  const args = { dove: resolve("banco-launchpad"), porta: 3182, contratti: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dove") args.dove = resolve(argv[++i]);
    else if (argv[i] === "--porta") args.porta = Number(argv[++i]);
    else if (argv[i] === "--contratti") args.contratti = true;
  }
  return args;
}

function scrivi(radice, percorso, contenuto) {
  const pieno = join(radice, percorso);
  mkdirSync(dirname(pieno), { recursive: true });
  writeFileSync(pieno, contenuto, "utf8");
}

/**
 * IL PASSO 0 — la premessa della build, stampata dove la si legge.
 *
 * Il 2026-08-07 la direzione ha rigenerato questo banco da zero seguendo
 * **soltanto** l'elenco stampato qui sotto, ed e' esattamente cio' che l'elenco
 * chiede di fare. `npm run build` e' caduta con exit 1 e
 *
 *     Error: supabaseUrl is required.
 *     Export encountered an error on /prenota/page: /prenota, exiting the build.
 *
 * `src/app/prenota/page.tsx` e' `force-static`: il client Supabase si costruisce
 * **durante** la build, non a runtime, quindi le due `NEXT_PUBLIC_*` sono una
 * premessa del passo 3 e non una configurazione di esercizio. Erano scritte in
 * `docs/deploy.md` («prima della build») e in `.env.example` — cioe' in due file
 * che il banco produce, e che chi segue l'elenco stampato non ha ancora aperto.
 * Una premessa vera scritta dove nessuno la legge e' una premessa non
 * dichiarata: il difetto era qui, non nel lettore.
 *
 * PERCHE' NON UN `.env.local` SCRITTO DA QUESTO SCRIPT. Sarebbe una riga di
 * codice in meno e un file di configurazione comparso in silenzio nel progetto
 * di qualcun altro — la classe di difetto che questa skill misura negli altri,
 * fatta in casa. Il banco stampa cosa serve e lascia il comando a chi lo lancia.
 *
 * I VALORI SONO FINTI, E DEVONO RESTARLO. `.invalid` e' il dominio riservato di
 * RFC 2606: non risolve per costruzione, quindi nessuno puo' credere che questo
 * banco parli con un Supabase vero. La build passa lo stesso perche'
 * `supabase-js` non contatta niente mentre si costruisce il client, e la lettura
 * di `/prenota` torna `{ data: null }` — che la pagina rende come lista vuota.
 * Misurato su questo banco il 2026-08-07: exit 0, 7 pagine su 7 prerenderizzate.
 */
function premessaBuild() {
  return [
    "  0.  LA PREMESSA DELLA BUILD — due variabili, o il passo 3 cade.",
    "      `/prenota` e' `force-static`: il client Supabase si costruisce DURANTE",
    "      la build. Senza queste due, `npm run build` esce 1 con",
    "      `Error: supabaseUrl is required.` sul prerender di /prenota.",
    "      I valori sono DICHIARATAMENTE FINTI (`.invalid` non risolve, RFC 2606):",
    "      qui non si parla con nessun Supabase, e la pagina rende una lista vuota.",
    "      Questo script NON scrive nessun `.env.local`: un file di configurazione",
    "      comparso in silenzio e' il difetto che questa skill misura negli altri.",
    "",
    "        bash / Git Bash:",
    '          export NEXT_PUBLIC_SUPABASE_URL="https://banco.supabase.invalid"',
    '          export NEXT_PUBLIC_SUPABASE_ANON_KEY="chiave-anonima-finta-del-banco"',
    "",
    "        PowerShell:",
    '          $env:NEXT_PUBLIC_SUPABASE_URL = "https://banco.supabase.invalid"',
    '          $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "chiave-anonima-finta-del-banco"',
    "",
    "      Valgono per la SHELL, non per la cartella: se apri un altro terminale",
    "      fra il passo 1 e il passo 3, vanno riesportate li'.",
    "",
  ];
}

function costruisci(args) {
  const { dove, porta } = args;
  if (existsSync(dove)) {
    console.error(`${dove} esiste gia'. Il banco si ricostruisce da zero: cancellalo o passa un'altra cartella con --dove.`);
    process.exit(2);
  }
  mkdirSync(dove, { recursive: true });
  for (const [percorso, contenuto] of Object.entries(FILE)) scrivi(dove, percorso, contenuto);
  for (const [numero, nome, passi] of [["07", "Schema Forge", 9], ["08", "Vetrina Crafter", 10], ["12", "Flow Sentinel", 7], ["13", "Speed Demon", 7]]) {
    scrivi(dove, `docs/handoff/${numero}-${nome.toLowerCase().replace(/ /g, "-")}.md`, handoff(numero, nome, passi));
  }

  const remoto = join(dove, "..", "banco-launchpad-remoto.git");
  const g = (...a) => execFileSync("git", ["-C", dove, ...a], { encoding: "utf8" });
  execFileSync("git", ["init", "--bare", "-q", "-b", "main", remoto]);
  g("init", "-q", "-b", "main");
  g("config", "user.name", "Banco Launchpad");
  g("config", "user.email", "banco@esempio.invalid");
  g("config", "core.autocrlf", "false");

  // L'ORDINE E' IL PUNTO: il codice prima, i certificati dopo. Un handoff piu'
  // vecchio dell'ultimo commit di codice e' scaduto, e il gate lo dice.
  g("add", "package.json", "tsconfig.json", "next.config.ts", ".gitignore", ".env.example", "src", "public", "supabase");
  g("commit", "-q", "-m", "Impianto del sito: pagine, listino, schema e seed di riferimento");
  g("add", "docs/PROGETTO.md", "docs/vetrina.md", "docs/flussi-critici.md", "docs/performance.md", "docs/DEBITO-TECNICO.md");
  g("commit", "-q", "-m", "I contratti degli agenti a monte e il registro del debito");
  g("add", "docs/handoff");
  g("commit", "-q", "-m", "Gli handoff a monte, tutti verdi");
  g("remote", "add", "origin", remoto);
  g("push", "-q", "-u", "origin", "main");

  console.log(`Banco scritto in ${dove}`);
  console.log(`Remoto locale in  ${resolve(remoto)}  (una cartella, non un servizio: qui non si pubblica niente)`);
  console.log("");
  console.log("Restano TRE passi e UNA PREMESSA, che questo script non fa e non finge di aver fatto:");
  console.log("");
  for (const riga of premessaBuild()) console.log(riga);
  console.log(`  1.  cd ${dove} && npm install`);
  console.log("      git add package-lock.json && git commit -m \"Il lockfile\"   ← il gate lo pretende TRACCIATO");
  console.log("  2.  node <skill>/scripts/impronta.mjs --scrivi");
  console.log("      git add next.config.ts && git commit -m \"L'impronta dell'artefatto\"");
  console.log(`      node <skill>/scripts/banco.mjs --contratti --dove ${dove} --porta ${porta}`);
  console.log(`  3.  npm run build && npx next start -p ${porta}          ← senza il passo 0 cade qui`);
  console.log("");
  console.log(`Poi il gate:  node <skill>/scripts/verify.mjs --url http://127.0.0.1:${porta}`);
  console.log("Atteso: VERDE 9/9.");
}

function contratti(args) {
  const { dove, porta } = args;
  if (!existsSync(join(dove, ".git"))) {
    console.error(`${dove} non e' un banco costruito: lancia prima \`node banco.mjs --dove ${dove}\`.`);
    process.exit(2);
  }
  const g = (...a) => execFileSync("git", ["-C", dove, ...a], { encoding: "utf8" });
  const sha = g("rev-parse", "HEAD").trim();
  const config = join(dove, "next.config.ts");
  if (!/generateBuildId/.test(readFileSync(config, "utf8"))) {
    console.error("`next.config.ts` non dichiara ancora `generateBuildId`: lancia prima `impronta.mjs --scrivi` e committa.");
    process.exit(2);
  }
  scrivi(dove, "docs/deploy.md", runbook(sha, porta));
  scrivi(dove, "docs/handoff/14-launchpad.md", handoffLaunchpad(sha));
  g("add", "docs/deploy.md", "docs/handoff/14-launchpad.md");
  g("commit", "-q", "-m", "Il runbook firmato e il contratto d'uscita di launchpad");
  g("push", "-q", "origin", "main");

  console.log(`Scritti e committati in ${dove}:`);
  console.log("  docs/deploy.md                   commit approvato " + sha.slice(0, 12) + ", firmato da una persona di FANTASIA");
  console.log("  docs/handoff/14-launchpad.md     `Gate: VERDE`, come prescrive il Flusso (l'handoff si scrive PRIMA del gate)");
  console.log("");
  console.log("Se il gate uscisse rosso, e' l'handoff che va riscritto: dichiarare non e' fallire.");
  console.log("");
  console.log("Prima di costruire, la premessa del passo 0 — nella shell da cui lanci la build:");
  console.log('  export NEXT_PUBLIC_SUPABASE_URL="https://banco.supabase.invalid"        (valori finti)');
  console.log('  export NEXT_PUBLIC_SUPABASE_ANON_KEY="chiave-anonima-finta-del-banco"   (`.invalid` non risolve)');
  console.log("");
  console.log(`Ora: npm run build && npx next start -p ${porta}`);
  console.log(`Poi: node <skill>/scripts/verify.mjs --url http://127.0.0.1:${porta}`);
}

// Epilogo a doppio confronto — vedi la nota estesa in `verify.mjs`.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) {
    const args = parseArgs(process.argv.slice(2));
    if (args.contratti) contratti(args);
    else costruisci(args);
  }
}
