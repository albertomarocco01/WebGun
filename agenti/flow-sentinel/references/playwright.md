# Convenzioni Playwright

Come si scrive una spec che il gate accetta e che, quando l'app si rompe, diventa rossa. Le regole qui sotto non sono stile: metà le fa rispettare `scripts/verify.mjs` e la sua configurazione ESLint, l'altra metà resta prosa e si controlla a mano — l'ultima sezione dice esattamente quale metà è quale, perché una convenzione che nessuno verifica va saputa, non creduta.

Stack: Playwright + TypeScript contro Next.js (App Router) + Supabase **locale**. Mai contro produzione: un test che compra, cancella o scrive email su un ambiente vero non è un test, è un incidente.

## Dove vive la batteria, e perché i nomi non sono negoziabili

```
e2e/
├── <id-flusso>.spec.ts      una spec per flusso, tag @flusso:<id> nel titolo del test
├── helpers/
│   ├── db.ts                l'UNICO client con la chiave amministrativa
│   └── auth.ts              utenti di prova e sessioni salvate
├── global-setup.ts          crea gli utenti, genera le sessioni
└── .auth/*.json             storageState — gitignorati, sono sessioni vive
playwright.config.ts
.env.e2e.local               chiave amministrativa — NON committato
```

Quattro nomi sono contratto col gate, non gusto:

- **la cartella è `e2e/`**: `verify.mjs` la cerca lì (`DIR_SPEC = join(PROGETTO, "e2e")`). Un `testDir` diverso fa contare zero spec al gate, e zero spec è MANCANTE — non `pass`.
- **il file finisce in `.spec.ts`** (o `.test.ts`, `.spec.mts`…): `eSpec()` usa lo stesso `testMatch` di Playwright. Un `carrello.e2e.ts` non lo esegue il runner e non lo conta il gate: sparisce due volte, in silenzio.
- **l'helper di verifica sta in un percorso che finisce in `helpers/db`** (con o senza estensione). Il passo `effetto-db` cerca quello: un `helpers/database.ts` o un `supporto/db.ts` producono un `block` su una spec che il database lo guarda davvero.
- **l'id nel tag è minuscolo, cifre e trattini** (`/@flusso:([a-z0-9][a-z0-9-]*)/g`, tutte le occorrenze del file). `@flusso:Crea-Prodotto` non viene letto affatto: il flusso risulta scoperto e il gate è rosso su una spec che esiste.

## Selettori: ruolo e label prima di tutto

```ts
// SÌ — quello che l'utente vede e che una tecnologia assistiva annuncia
await page.getByRole("button", { name: "Salva" }).click();
await page.getByLabel("Prezzo in centesimi").fill("4900");
await expect(page.getByRole("heading", { name: "Area riservata" })).toBeVisible();

// quando il ruolo non basta a distinguere (tre righe identiche, un contenitore senza ruolo)
await page.getByTestId("riga-ordine-42").getByRole("button", { name: "Conferma" }).click();

// MAI
await page.locator(".css-1x2y3z").click();
await page.locator("div > div:nth-child(3) > button").click();
```

L'ordine è: `getByRole` / `getByLabel` → `getByText` per contenuti stabili → `getByTestId` quando il ruolo non distingue → niente. Il `data-testid` è l'uscita di sicurezza e non la porta principale — esiste solo per il test, quindi non dice niente su ciò che l'utente vede — e si aggiunge all'app (una riga in `src/`), non si aggira con un CSS.

Il perché è tutto nel momento in cui il selettore si rompe. **Un selettore di ruolo si rompe quando si rompe l'accessibilità** — il bottone perde il nome accessibile, l'input perde la sua label, la pagina smette di essere navigabile da tastiera: cioè esattamente quando serve che qualcosa diventi rosso. **Un selettore CSS si rompe quando qualcuno rinomina una classe**, cioè quando non è successo niente di male, e regge intatto mentre il bottone diventa inaccessibile. La prima classe di rotture è informazione, la seconda è rumore — e una batteria che produce rumore viene disattivata dopo la terza volta.

### Due trappole che fanno fallire un selettore giusto

**Su una pagina Next.js il ruolo `alert` è sempre almeno due.** `getByRole("alert")` da solo fallisce con `strict mode violation: getByRole('alert') resolved to 2 elements: - unexpected value ""`: oltre all'avviso dell'applicazione, l'App Router tiene sempre nel DOM l'annunciatore di rotta `__next-route-announcer__`, che ha ruolo `alert` ed è vuoto. **Si filtra sempre per il testo del messaggio**, col perché scritto accanto — non si aggira alzando `strict` o prendendo `.first()`, che sceglierebbe a caso fra i due:

```ts
// SÌ
await expect(page.getByRole("alert").filter({ hasText: "Prodotto creato" })).toBeVisible();

// NO — due elementi, e la spec fallisce per un motivo che non c'entra col flusso
await expect(page.getByRole("alert")).toHaveText("Prodotto creato");
```

**Il contenuto di un campo di testo non è testo della pagina.** `filter({ hasText: "Rosa Amato" })` non trova la riga della persona se quel nome sta nel `value` di un `<input>`: `hasText` guarda il testo reso, e il valore di un input non lo è. Si àncora la riga a qualcosa che la pagina *scrive* davvero (un'etichetta, un'intestazione) o si usa `getByRole("textbox")` con `toHaveValue`. Il modo in cui la trappola si presenta è ingannevole: la spec fallisce come «elemento non trovato», cioè esattamente come se la funzionalità fosse rotta.

## Attese: una condizione, mai un numero di millisecondi

`waitForTimeout` è **vietato**, ed è una delle due regole che questa configurazione aggiunge di suo — l'altra è in fondo a questa sezione, e sotto ci sono comunque le due raccomandate (`js` e `typescript-eslint`). La regola sta in `resources/config/eslint-spec.config.mjs` e il passo `lint-spec` la applica alla cartella `e2e/` con `--no-config-lookup`, cioè ignorando la configurazione del progetto:

```js
"no-restricted-syntax": ["error", {
  selector: "CallExpression[callee.property.name='waitForTimeout']",
  message: "Attesa fissa vietata: aspetta una condizione (locator, risposta di rete, riga nel database), non un numero di millisecondi.",
}],
```

Il perché è scritto accanto alla regola: `waitForTimeout(500)` passa sulla macchina veloce e fallisce in CI, poi qualcuno alza a 2000 e la batteria diventa lenta invece che affidabile. Nessun altro controllo del gate la vede — `verify.mjs` legge l'esito, non il modo in cui il test ci è arrivato.

Le tre forme giuste, in ordine di preferenza:

```ts
// 1. una condizione sulla pagina: `expect` riprova finche' non e' vera o scade.
//    Il ruolo `alert` e' filtrato per testo: su Next.js ce n'e' sempre un altro,
//    l'annunciatore di rotta vuoto (vedi §Selettori).
await expect(
  page.getByRole("alert").filter({ hasText: "Prodotto creato" }),
).toBeVisible();

// 2. una risposta di rete. L'attesa si CREA PRIMA del click: creandola dopo, la
// risposta puo' essere gia' arrivata e l'attesa scade su un evento passato.
const salvato = page.waitForResponse(
  (r) => r.url().includes("/admin/prodotti") && r.request().method() === "POST");
await page.getByRole("button", { name: "Salva" }).click();
await salvato;

// 3. una riga nel database, via helper: l'unica che sa se il lavoro e' finito
// davvero, quando l'effetto e' asincrono (coda, webhook, revalidate).
await expect.poll(() => statoOrdine(idOrdine), {
  message: "lo stato dell'ordine non e' avanzato: la pagina ha detto «confermato» e basta",
}).toBe("confermato");
```

Nota onesta sul linter: il selettore intercetta la chiamata **attraverso una proprietà** (`page.waitForTimeout(…)`, `context.waitForTimeout(…)`), che è la forma in cui la si scrive. Un `await new Promise((r) => setTimeout(r, 500))` scritto a mano passa il linter — è la stessa attesa fissa, e la regola contro di essa resta prosa. Se ESLint non è installato nella skill (`npm install` in `agenti/flow-sentinel`), il passo `lint-spec` è MANCANTE — a meno che le regole scritte a mano non abbiano già trovato un `.only`, e allora è `fail`: si è guardato e si è trovato. In entrambi i casi il gate è rosso, perché non aver lintato le spec non è averle trovate pulite.

L'altra regola della configurazione conviene saperla prima di incontrarla, perché rende rosso `lint-spec` su una riga che sembra innocua: **`@typescript-eslint/no-unused-vars` è `error`** (con `argsIgnorePattern: "^_"`). In una spec una variabile assegnata e mai letta è quasi sempre un'asserzione scritta a metà — il valore è stato preso dal database o dalla pagina, il confronto su quel valore no. Il resto della configurazione è `js.configs.recommended` più la raccomandazione di `typescript-eslint`, con `no-undef` spento: su un file `.ts` produce solo falsi positivi sui globali del runtime (`process`, `fetch`), che TypeScript conosce già coi suoi `@types/node`.

## Autenticazione: utenti veri, creati dal setup, sessioni salvate

Gli utenti di prova li crea il `global-setup` con l'admin API sul database **locale**, non il seed. Un utente di prova nel seed di produzione ci finisce il giorno in cui qualcuno riusa il file per popolare l'ambiente vero — ed è un account con password nota, scritto in un repo, che nessuno cercherà perché nessuno si ricorda di averlo messo lì.

```ts
// e2e/helpers/auth.ts
import { chromium, expect } from "@playwright/test";
import { admin } from "./db";   // nessun secondo client: la chiave ha UN posto

export type UtenteDiProva = { email: string; password: string };

export const UTENTI = {
  staff: { email: "staff@prova.local", password: "prova-staff-2026!" },
  cliente: { email: "cliente@prova.local", password: "prova-cliente-2026!" },
} satisfies Record<string, UtenteDiProva>;

/** Idempotente: il setup gira anche su un database che il reset non ha toccato. */
export async function creaUtente(u: UtenteDiProva): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true,
  });
  if (!error && data.user) return data.user.id;
  const gia = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }))
    .data.users.find((x) => x.email === u.email);
  if (!gia) throw new Error(`creazione di ${u.email} fallita: ${error?.message}`);
  // password riallineata: un utente rimasto da un altro giro con un'altra
  // password fa fallire il login con un rosso che non parla dell'app
  await admin.auth.admin.updateUserById(gia.id, { password: u.password });
  return gia.id;
}

/** La sessione si conia passando dalla UI vera, non iniettando un token. */
export async function salvaSessione(u: UtenteDiProva, percorso: string): Promise<void> {
  const browser = await chromium.launch();
  // stesso default di playwright.config.ts: il global-setup gira PRIMA che
  // `use.baseURL` esista, e senza URL il `goto` relativo qui sotto non parte
  const page = await browser.newPage({
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
  });
  await page.goto("/accesso");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Entra" }).click();
  await expect(page.getByRole("heading", { name: "Area riservata" })).toBeVisible();
  await page.context().storageState({ path: percorso });
  await browser.close();
}

// ----------- e2e/global-setup.ts (altro file) — `globalSetup` punta qui
import { creaUtente, salvaSessione, UTENTI } from "./helpers/auth";

export default async function globalSetup(): Promise<void> {
  for (const utente of Object.values(UTENTI)) await creaUtente(utente);
  await salvaSessione(UTENTI.staff, "e2e/.auth/staff.json");
  await salvaSessione(UTENTI.cliente, "e2e/.auth/cliente.json");
}
```

Regole che ne discendono, ciascuna col suo motivo:

- **La sessione salvata (`storageState`) serve a non ripagare il login a ogni spec**: dodici spec che passano dal form di accesso sono dodici volte lo stesso rischio di flaky e un minuto buttato a ogni giro.
- **Il flusso di login ha comunque la sua spec, che passa dalla UI vera.** Un file `storageState` è un token su disco: resta valido anche il giorno in cui la pagina di accesso smette di funzionare, e senza una spec dedicata quel guasto non ha nessuno che lo veda. La spec del login dichiara `test.use({ storageState: { cookies: [], origins: [] } })`, altrimenti eredita la sessione del setup e l'app la rimanda via da `/accesso` prima ancora del primo `fill`.
- **La chiave amministrativa (`service_role`; sulle CLI Supabase recenti la secret key `sb_secret_…`) sta in `.env.e2e.local`, non committato**, si usa solo dentro `e2e/`, e non deve essere raggiungibile da `src/`. Non le si dà mai un nome che inizi per `NEXT_PUBLIC_`, e nessun file di `src/` importa da `e2e/`: un modulo che finisce nel grafo di un componente client finisce nel bundle, e un bundle è pubblico per definizione. Nessun passo del gate lo verifica — lo provano un `grep -r "SECRET" src/` che non trova niente e `code-maniac scan` (gitleaks).
- **La UI si prova coi ruoli veri**: `anon` e utente autenticato, con il loro token. Impersonare con la chiave amministrativa per «arrivare più in fretta alla pagina» falsifica il flusso: quella chiave scavalca la RLS, quindi il test misura un mondo in cui le policy non esistono e resta verde anche quando ne manca una.
- **`.gitignore`**: `.env.e2e.local` ed `e2e/.auth/` perché sono una chiave amministrativa e delle sessioni vive — committarli è consegnare un accesso a chiunque legga il repo; `playwright-report/` e `test-results/` perché li riscrive ogni giro, e un diff pieno di screenshot rigenerati è un diff che nessuno rilegge.

## L'helper di effetto DB

`e2e/helpers/db.ts` è l'unico posto del progetto in cui vive un client con la chiave amministrativa. Un posto solo perché la chiave esce da dove la si crea: due `createClient` con la secret key sono due file da controllare a ogni revisione, e il secondo nasce sempre «per un attimo» dentro una spec.

```ts
// e2e/helpers/db.ts — l'unico client amministrativo del progetto.
import { createClient } from "@supabase/supabase-js";

// La porta e' quella di `[api].port` del PROGETTO, non un 54321 generico: con
// due stack Supabase accesi il default punta allo stack di qualcun altro.
const URL_SUPABASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:58321";
const CHIAVE_SEGRETA = process.env.SUPABASE_SECRET_KEY;
if (!CHIAVE_SEGRETA) {
  // Fallire qui, subito: senza chiave le funzioni sotto tornerebbero errori che
  // le asserzioni leggerebbero come «nessuna riga», cioe' come un rifiuto.
  throw new Error("manca SUPABASE_SECRET_KEY in .env.e2e.local (vedi references/playwright.md)");
}

/** La chiave anonima e' pubblica per costruzione: sta nel bundle del client. */
export const CHIAVE_ANONIMA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export { URL_SUPABASE };

export const admin = createClient(URL_SUPABASE, CHIAVE_SEGRETA, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type Prodotto = { id: string; nome: string; prezzo_cents: number };

export async function contaProdotti(): Promise<number> {
  const { count, error } = await admin.from("prodotti").select("*", { count: "exact", head: true });
  if (error) throw new Error(`conteggio prodotti fallito: ${error.message}`);
  return count ?? 0;
}

export async function prodottoPerNome(nome: string): Promise<Prodotto | null> {
  const { data, error } = await admin.from("prodotti")
    .select("id, nome, prezzo_cents").eq("nome", nome).maybeSingle();
  if (error) throw new Error(`lettura del prodotto ${nome} fallita: ${error.message}`);
  return data;
}

export async function statoOrdine(id: string): Promise<string | null> {
  const { data, error } = await admin.from("ordini").select("stato").eq("id", id).maybeSingle();
  if (error) throw new Error(`lettura dello stato dell'ordine ${id} fallita: ${error.message}`);
  return data?.stato ?? null;
}

export async function ultimoAccesso(email: string): Promise<Date | null> {
  // L'admin API non cerca per email: elenca, e `perPage` di default e' 50.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`elenco utenti fallito: ${error.message}`);
  const utente = data.users.find((u) => u.email === email);
  // assente = il global-setup non l'ha creato: dirlo, non restituire null e far
  // scadere un poll con un messaggio che parla di un'altra cosa
  if (!utente) throw new Error(`utente ${email} assente: il global-setup non l'ha creato`);
  return utente.last_sign_in_at ? new Date(utente.last_sign_in_at) : null;
}
```

Le funzioni sono **piccole e nominate**: `contaProdotti()`, `prodottoPerNome(nome)`, `statoOrdine(id)`, `ultimoAccesso(email)`. Una funzione per domanda, perché il nome della funzione è ciò che si legge nel messaggio di fallimento; un `query(sql)` generico costringe a leggere la query per capire cosa è andato storto. E ogni funzione **solleva** sull'errore invece di restituire `null`: un helper che ingoia l'errore fa passare l'asserzione «nessuna riga è stata scritta» per il motivo sbagliato — che è il modo esatto in cui un test ostile diventa cieco.

Se `supabase gen types typescript --local` ha prodotto i tipi, si tipizza `createClient<Database>(…)`: l'helper è l'unico posto in cui una colonna rinominata deve rompere la compilazione invece di far fallire un test a runtime con un messaggio su `undefined`.

### Cosa verifica davvero il passo `effetto-db`

Il passo cerca, in ogni spec dei flussi di tipo `positivo` e `ostile-scrittura`, **un import da un percorso che finisce in `helpers/db` e almeno una chiamata a ciò che ha importato** (`usaHelperDb` in `gate-lib.mjs`). Accetta:

```ts
import { contaProdotti } from "./helpers/db";        // nominato, senza estensione
import { contaProdotti as conta } from "../helpers/db.ts";  // rinominato: conta il nome locale
import * as db from "../../e2e/helpers/db.js";       // namespace
```

e riconosce la chiamata in due forme: `nome(` e `nome.metodo(`.

Un import senza chiamata **non** conta — un import non asserisce niente — ma la stretta vale davvero solo quando `helpers/db` è il **primo** import del file, e conviene saperlo. La clausola dell'import viene ritagliata da `import` fino a `from "…/helpers/db"`, quindi si porta dentro anche i nomi importati sopra: in una spec vera, che apre con `import { test, expect } from "@playwright/test";`, fra i nomi cercati finiscono pure `test` ed `expect` — e quelli vengono chiamati di sicuro. Su quelle spec l'import di `helpers/db` risulta «chiamato» anche se non lo si usa mai. Non è un buco che chiuda un controllo statico più furbo: lo chiude il sabotaggio di classe B (`references/sabotaggio.md`), che pretende il rosso quando la scrittura sparisce.

Il controllo guarda la **forma, non la semantica**: sa che qualcosa ha guardato il database, non che l'asserzione sia quella giusta. È la stessa onestà che Schema Forge scrive sul suo audit RLS («verifica che la policy esista, non che funzioni»). In concreto, questo passa il gate e non prova niente:

```ts
await contaProdotti();   // chiamato e mai confrontato: `effetto-db` e' soddisfatto
await expect(page.getByText("Creato")).toBeVisible();
```

La chiamata è nuda apposta: scriverla `const n = await contaProdotti();` soddisferebbe `effetto-db` allo stesso modo, ma la fermerebbe `no-unused-vars` nel passo `lint-spec` — due passi diversi, e il buco resta comunque aperto, perché nessuno dei due guarda l'asserzione.

Due granularità da sapere, perché stringono meno di quanto sembri: il gate guarda il **file intero**, non il singolo test (una spec con due test in cui solo uno chiama l'helper passa), e per un flusso attaccato da più spec basta che **una** lo faccia. Ciò che chiude questi buchi non è un controllo statico più furbo — è il sabotaggio (`references/sabotaggio.md`): si rompe l'app in un punto noto e si guarda se la batteria diventa rossa.

## Il pattern che rende `effetto-db` soddisfacibile per il login

Il login sembra il flusso senza effetto sul database: si entra, si vede una pagina. Ma asserire «sono su `/admin`» passa anche con una **sessione finta lato client** — un token scritto a mano in `localStorage`, un middleware che guarda l'esistenza di un cookie senza validarlo, un redirect che qualcuno ha tolto. L'effetto c'è, e sta in `auth.users`: GoTrue scrive `last_sign_in_at` solo quando ha verificato davvero delle credenziali.

```ts
// e2e/accesso-staff.spec.ts
import { test, expect } from "@playwright/test";
import { UTENTI } from "./helpers/auth";
import { ultimoAccesso } from "./helpers/db";

// senza questa riga la spec eredita la sessione del global-setup e /accesso
// la rimanda via prima del primo campo compilato
test.use({ storageState: { cookies: [], origins: [] } });

test("lo staff entra dalla UI vera @flusso:accesso-staff", async ({ page }) => {
  // l'istante si prende dal DATABASE, non da `new Date()` del runner: cosi'
  // l'asserzione non dipende dallo scarto fra l'orologio del processo e quello
  // di Postgres, che e' proprio il genere di scarto che produce un flaky
  const prima = (await ultimoAccesso(UTENTI.staff.email))?.getTime() ?? 0;

  await page.goto("/accesso");
  await page.getByLabel("Email").fill(UTENTI.staff.email);
  await page.getByLabel("Password").fill(UTENTI.staff.password);
  await page.getByRole("button", { name: "Entra" }).click();

  await expect(page.getByRole("heading", { name: "Area riservata" })).toBeVisible();

  // l'effetto sul database: l'accesso e' avvenuto sul server, non nel browser
  await expect.poll(async () => (await ultimoAccesso(UTENTI.staff.email))?.getTime() ?? 0, {
    message: "last_sign_in_at non e' avanzato: la sessione e' solo lato client",
  }).toBeGreaterThan(prima);
});
```

`expect.poll` invece di una lettura secca perché `last_sign_in_at` viene scritto dal server nell'istante in cui emette il token, e la pagina può essere già dipinta: si aspetta la **condizione**, non un ritardo. Chi preferisce l'id all'email usa `admin.auth.admin.getUserById(id)`, con l'id restituito da `creaUtente`.

## Flussi ostili via browser

### Lettura negata (`ostile-lettura`)

Si apre la rotta con la sessione sbagliata — o senza nessuna sessione — e si asserisce il rifiuto. Il rifiuto ha tre forme legittime: redirect alla pagina di accesso, risposta 403, contenuto assente.

```ts
// e2e/admin-negato-anon.spec.ts
import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("un anonimo non vede l'area prodotti @flusso:admin-negato-anon", async ({ page }) => {
  const risposta = await page.goto("/admin/prodotti");
  // il rifiuto dichiarato dall'app: redirect (qui) oppure `toBe(403)`
  await expect(page).toHaveURL(/\/accesso/);
  expect(risposta?.status() ?? 0).toBeLessThan(400);

  // e SOPRATTUTTO l'assenza del contenuto riservato NEL CORPO SERVITO. Questa
  // e' la riga che conta, e va letta due volte: `risposta.text()` e' cio' che il
  // server ha davvero consegnato, ed e' l'unica cosa che un redirect deciso dal
  // browser non puo' riscrivere.
  const servito = (await risposta?.text()) ?? "";
  expect(servito, "l'area riservata e' stata servita").not.toContain("Area prodotti");
  expect(servito, "il dato riservato e' nel payload").not.toContain("sedia-riservata-seed");

  // il DOM si guarda comunque, per il caso opposto: contenuto iniettato dopo
  await expect(page.getByRole("heading", { name: "Prodotti" })).toHaveCount(0);
  await expect(page.getByText("sedia-riservata-seed")).toHaveCount(0);
});
```

Il gate non ha un controllo automatico su questa classe: `effetto-db` non la riguarda (un attacco in lettura non cambia niente, non c'è stato da confrontare) e nessun passo legge le asserzioni. Regola in prosa, quindi, e va rispettata: **si asserisce l'assenza del contenuto nel corpo servito, non solo l'URL e non solo il DOM.**

**Perché il DOM non basta, misurato.** Le due righe `getByText(...).toHaveCount(0)` guardano la pagina *nello stato in cui si trova quando l'asserzione gira* — cioè **dopo** che l'attesa su `toHaveURL` è stata soddisfatta. Se il controllo di ruolo è passato dal server al browser (un `redirect` dentro un `useEffect`, un guard in un componente client), il server serve l'area riservata **per intero**, il browser la dipinge, e solo dopo la sostituisce con la pagina lecita: a quel punto ogni `getByText` la trova pulita, e la spec è verde su una fuga già avvenuta. Riprodotto al collaudo del 2026-07-28 sul banco `palestra`: col controllo spostato nel client, il corpo servito al socio conteneva `Area staff`, `Nuovo corso` e `Crea corso`, la batteria restava **verde 6 su 6** e il gate chiudeva **VERDE 7/7**. Con l'asserzione su `risposta.text()` lo stesso sabotaggio fa fallire quella spec — e solo quella. È il motivo per cui il `goto` si tiene in una variabile invece di scriverlo `await page.goto(...)` e basta.

Nota di lettura sul rosso: se cade la riga di `risposta.text()` ma il DOM è pulito, il difetto è **il momento** del rifiuto (si nega dopo aver consegnato), non il rifiuto in sé. Se cade il DOM ed è pulito il corpo, il contenuto riservato arriva da una chiamata successiva al caricamento, e allora la porta da chiudere è quella dell'API, non quella della rotta.

### Scrittura negata (`ostile-scrittura`)

L'attacco si esegue **dal browser, con il token vero dell'utente non autorizzato, contro l'API dati** (PostgREST). Non attraverso la UI: la UI il bottone non glielo mostra nemmeno, quindi provare da lì dimostra solo che il bottone è nascosto. Chiunque abbia la chiave pubblica dell'app — cioè chiunque apra i DevTools — può fare esattamente questa chiamata, ed è quella che le policy devono reggere.

```ts
// e2e/scrittura-negata-cliente.spec.ts
import { test, expect } from "@playwright/test";
import { CHIAVE_ANONIMA, URL_SUPABASE, contaProdotti, prodottoPerNome } from "./helpers/db";

test.use({ storageState: "e2e/.auth/cliente.json" });

test("il cliente non crea prodotti via API @flusso:scrittura-negata-cliente", async ({ page }) => {
  await page.goto("/");
  const prima = await contaProdotti();

  // il token VERO dell'utente, quello che supabase-js ha messo in localStorage
  const token = await page.evaluate(() => {
    const chiave = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    return chiave ? (JSON.parse(localStorage.getItem(chiave)!).access_token as string) : null;
  });
  expect(token, "sessione del cliente assente: l'attacco non sarebbe autenticato").not.toBeNull();

  const esito = await page.evaluate(async ([url, anon, jwt]) => {
    const r = await fetch(`${url}/rest/v1/prodotti`, {
      method: "POST",
      headers: {
        apikey: anon!, Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify({ nome: "iniettato-dal-cliente", prezzo_cents: 1 }),
    });
    return { stato: r.status, corpo: await r.text() };
  }, [URL_SUPABASE, CHIAVE_ANONIMA, token] as const);

  // 1. la risposta e' un rifiuto OPPURE zero righe scritte. Servono entrambe le
  // forme: una `insert` negata dalla RLS torna 401/403, ma una `update` che la
  // policy filtra torna 204 con zero righe e nessun errore.
  const scritte = esito.stato >= 400 || esito.corpo.trim() === ""
    ? 0 : (JSON.parse(esito.corpo) as unknown[]).length;
  expect(scritte, `PostgREST ha accettato la scrittura (HTTP ${esito.stato}): ${esito.corpo}`).toBe(0);

  // 2. e il database e' identico a prima. E' l'asserzione che non si puo'
  // aggirare: uno status code lo decide l'API, il conteggio lo decide il dato.
  expect(await contaProdotti()).toBe(prima);
  expect(await prodottoPerNome("iniettato-dal-cliente")).toBeNull();
});
```

Dove sta il token dipende da quale client lo ha scritto, e va guardato prima di copiare il blocco: `@supabase/supabase-js` nel browser lo tiene in `localStorage` (la forma qui sopra), mentre un'app App Router con `@supabase/ssr` lo tiene nei **cookie**, e allora si legge con `page.context().cookies()` filtrando i nomi `sb-…-auth-token`. Cambia la riga che lo recupera, non l'attacco: quello che conta è partire dal token **vero** dell'utente, perché un token coniato dal test lo rifiuta GoTrue prima ancora che la RLS entri in gioco — e il verde che ne uscirebbe direbbe che l'autenticazione funziona, non che la policy regge. È per questo che l'assenza del token è un fallimento esplicito (`.not.toBeNull()`) e non un test che prosegue.

## Struttura della spec

Una spec per flusso, e **il tag `@flusso:<id>` nel titolo del test**, non nel nome del file. Nel titolo per due motivi concreti: due spec possono attaccare lo stesso flusso (il caso felice e quello degenere), e un file rinominato non deve rompere il contratto con `docs/flussi-critici.md`. Il titolo, in più, è ciò su cui lavora `npx playwright test --grep "@flusso:checkout-ospite"`: il tag serve anche a rilanciare un flusso solo mentre lo si aggiusta.

Onestà sul controllo: `tagDaSpec` legge il tag **ovunque nel file**, commenti compresi — quindi un tag scritto in un commento accontenta `spec-coverage`. La convenzione del titolo la fa rispettare chi rilegge, non il gate, e serve a `--grep`.

```ts
// e2e/crea-prodotto.spec.ts — flusso positivo completo
import { test, expect } from "@playwright/test";
import { contaProdotti, prodottoPerNome } from "./helpers/db";

test.use({ storageState: "e2e/.auth/staff.json" });

test("lo staff crea un prodotto e finisce nel database @flusso:crea-prodotto", async ({ page }) => {
  // nome irripetibile: la spec rigira sullo stesso database senza dover pulire,
  // e due giri di seguito non si falsificano a vicenda
  const nome = `sedia-${Date.now()}`;
  const prima = await contaProdotti();

  await page.goto("/admin/prodotti");
  await page.getByRole("button", { name: "Nuovo prodotto" }).click();
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Prezzo in centesimi").fill("4900");

  const salvato = page.waitForResponse(
    (r) => r.url().includes("/admin/prodotti") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Salva" }).click();
  await salvato;

  // cosa vede l'utente
  await expect(page.getByRole("row", { name: new RegExp(nome) })).toBeVisible();

  // cosa e' successo davvero: la pagina puo' mentire, la riga no
  expect(await contaProdotti()).toBe(prima + 1);
  const riga = await prodottoPerNome(nome);
  expect(riga?.prezzo_cents, "il prezzo salvato non e' quello digitato").toBe(4900);
});
```

## `playwright.config.ts`

```ts
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Il file con la chiave amministrativa NON e' committato. Node lo legge da
// solo: niente `dotenv` aggiunto come dipendenza per una riga sola.
if (existsSync(".env.e2e.local")) process.loadEnvFile(".env.e2e.local");

// Uguale a `[auth].site_url` di supabase/config.toml: e' l'URL che il passo
// `app-viva` interroga, e due valori diversi vorrebbero dire gate che misura
// un'app e batteria che ne prova un'altra.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // Fisso a 1. Con zero tentativi un ambiente instabile e' rosso strutturale, e
  // un rosso strutturale insegna a ignorare il rosso; con due, un test che passa
  // una volta su tre diventa invisibile. Il passo `contratto-uscita` verifica
  // che questa riga esista e valga 1.
  retries: 1,
  // Sempre, non solo in CI: un `.only` fa girare mezza batteria e restituisce
  // un verde che non ha guardato niente. Il gate lo trova comunque (`block`),
  // ma qui lo si trova prima, senza aver letto un esito che non valeva.
  forbidOnly: true,
  // Le asserzioni di conteggio sono globali sul database: due spec in parallelo
  // che scrivono sulla stessa tabella si falsificano a vicenda, e un rosso che
  // non dipende dall'app insegna a ignorare il rosso.
  workers: 1,
  fullyParallel: false,

  // `open: "never"` sul report HTML: il default apre un server e resta appeso
  // in una sessione non interattiva. Il gate lancia comunque `--reporter=json`,
  // che sovrascrive questa lista e stampa su stdout; questa serve agli umani.
  reporter: [["list"], ["html", { open: "never" }],
             ["json", { outputFile: "playwright-report/report.json" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",     // la traccia del secondo tentativo: l'unica che mostra il flaky
    screenshot: "only-on-failure",
    // anonimo per default: ogni spec dichiara la sessione che le serve, cosi'
    // un flusso ostile non eredita per sbaglio i diritti di qualcun altro
    storageState: { cookies: [], origins: [] },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // NIENTE `webServer`, di proposito. Vedi la nota qui sotto.
});
```

**Perché il gate non usa `webServer`.** Il passo `app-viva` deve misurare che l'app risponde **prima** che la batteria parta: è la premessa, e senza premessa l'esito della batteria non è un esito, è il rumore di un'app che non c'era (DECISIONI.md §18). Un runner che si accende l'app da solo rende quella premessa non misurabile: `verify.mjs` interroga l'URL, non trova niente, dichiara `app-viva` MANCANTE e salta `playwright` — cioè il gate resta rosso proprio mentre la batteria sarebbe passata. L'app la si accende prima, a mano o dallo script di avvio, e il gate la trova viva.

**Cosa verifica `contratto-uscita` sulla configurazione**: che `playwright.config.ts` esista e che **ogni** `retries` dichiarato valga `1`. La lettura è testuale (`/(^|[^\w.])retries\s*:\s*(\d+)/gm`) sul file **senza i commenti**, e guarda tutte le occorrenze. Due precisazioni che sono costate due falsi verdi, misurati al collaudo del 2026-07-28:

- **i commenti non configurano niente.** Prima si prendeva la prima occorrenza nel file, commenti compresi: un `// retries: 1 e' la regola del gate` scritto sopra un `retries: 3` vero faceva uscire il passo `pass`. Non è una forma cercata — la configurazione qui sopra ha, proprio sopra quella riga, quattro righe di commento che spiegano perché il numero è 1;
- **il valore di un progetto scavalca quello globale.** `projects: [{ name: "chromium", retries: 3 }]` sopra un `retries: 1` globale fa girare **quattro** tentativi (misurato col runner: `TENTATIVO n.0 … n.3`), ed è la forma che la documentazione di Playwright suggerisce per alzare i tentativi di un progetto solo. Leggere la prima occorrenza dichiarava `pass` su una batteria che ritenta tre volte.

Resta vero che `retries: process.env.CI ? 1 : 0` risulta «non dichiarato» — non è un numero. Si scrive il numero, e le ragioni si scrivono in prosa come sopra. Il passo controlla anche che `docs/handoff/12-flow-sentinel.md` esista, non contenga segnaposto `{{…}}` e dichiari una riga `Gate: VERDE` o `Gate: ROSSO` coerente con i sei passi precedenti (DECISIONI.md §19).

`workers: 1` costa secondi su una batteria di dieci flussi e toglie di mezzo una classe intera di rossi che non parlano dell'app. Se un giorno la serialità pesa davvero, la via d'uscita è contare con un filtro per spec (`contaProdotti(prefisso)`), non alzare i worker e sperare — e la deroga va scritta nell'handoff.

Trappola del reporter: se nell'ambiente è impostata `PLAYWRIGHT_JSON_OUTPUT_NAME`, il reporter JSON scrive su file e lascia stdout vuoto. Il gate legge stdout, non trova un oggetto interpretabile e dichiara il passo MANCANTE. La variabile non si imposta.

## Il comando unico

```bash
# terminale 1 — l'app viva. Il gate la misura, non la accende (niente webServer).
npm run dev

# terminale 2 — dalla radice del progetto generato
supabase start                 # lo stack locale del PROGETTO, sulle porte del suo config.toml
supabase db reset              # migrazioni + seed su un database pulito
npx playwright test            # la batteria sola, mentre ci si lavora
npx playwright test --grep "@flusso:crea-prodotto"   # un flusso solo, mentre lo si aggiusta

# il gate completo: premesse, batteria, contratto d'uscita (--json per l'orchestratore)
node <percorso-repo-webgun>/agenti/flow-sentinel/scripts/verify.mjs
```

`verify.mjs` risolve URL dell'app e database dal `supabase/config.toml` del progetto (`[auth].site_url` e `[db].port`); `--url` e `--db-url` li sovrascrivono, l'ambiente non viene mai consultato — una variabile rimasta da un altro progetto è esattamente il modo in cui un gate finisce per dichiarare verde l'app di qualcun altro.

## Cosa il gate fa rispettare, e cosa no

| Convenzione | Chi la fa rispettare | Cosa resta scoperto |
|---|---|---|
| niente `waitForTimeout` | ESLint, passo `lint-spec` | un'attesa fissa scritta a mano con `setTimeout` |
| nessuna variabile assegnata e mai letta | ESLint (`no-unused-vars`), passo `lint-spec` | un valore letto e confrontato con la cosa sbagliata |
| nessun `.only`, ogni `.skip` e ogni `.fixme` motivato accanto | `regoleSpec`, passo `lint-spec` | uno skip motivato con «per ora» |
| ogni flusso dichiarato ha una spec che lo attacca | passo `spec-coverage` | il tag vale ovunque nel file, anche in un commento |
| le spec dei flussi `positivo` e `ostile-scrittura` importano **e chiamano** `helpers/db` | passo `effetto-db` | se l'asserzione è quella giusta; basta una spec per flusso e una chiamata per file |
| `retries` dichiarato e uguale a 1 | passo `contratto-uscita` | `workers`, `forbidOnly`, `trace`: nessuno li legge |
| la batteria è girata davvero, su app viva e database seedato | passi `app-viva` e `playwright` | che i flussi coperti siano quelli critici: lo decide `docs/flussi-critici.md`, e quello lo conferma un umano |
| selettori di ruolo, ruoli veri, chiave amministrativa fuori da `src/` | nessun passo | `grep`, `code-maniac scan`, revisione |
| il rifiuto asserito in un flusso `ostile-lettura` | nessun passo | prosa: qui il gate non guarda dentro le asserzioni |

Le righe senza un passo accanto non sono meno obbligatorie: sono quelle su cui **un gate verde non dice niente**. Per quelle esistono il sabotaggio al collaudo (`references/sabotaggio.md`) e `/code-inquisition` sui punti critici.
