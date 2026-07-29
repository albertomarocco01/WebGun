# Rotte protette — App Router + Supabase SSR

Dove va la guardia, dove **non** va, e cosa ciascun posto protegge davvero. Le policy stanno in `agenti/schema-forge/references/rls-supabase.md`: qui c'è solo ciò che riguarda l'applicazione.

## La misura, prima delle opinioni

Sul banco di prova, con `next dev` acceso e **senza cookie di sessione** (2026-07-28):

```
GET /admin        → 307 → /accedi          la guardia del `layout.tsx` gira
GET /admin/stato  → 200 {"clienti":null}   route handler: il layout NON gira
```

Il route handler stava nella **stessa cartella protetta** dal layout con `richiediStaff()`. Ha risposto `200` a un anonimo.

Due conseguenze, e la seconda conta più della prima:

1. **Un route handler non esegue i layout.** La guardia della sezione non lo tocca: se ne serve una, va scritta dentro il verbo esportato (`GET`, `POST`, …). Non esiste un posto più in alto dove metterla.
2. **A non far uscire i dati è stata la RLS, non l'applicazione.** Il client portava la chiave anonima senza sessione, e le policy hanno restituito `null`. Con un client `service_role` la stessa rotta avrebbe consegnato l'anagrafica intera. È la ragione per cui la Legge n°3 ha due metà: *la guardia* e *nessuna scorciatoia sulla RLS*. Una sola delle due non basta — la prima aveva un buco, la seconda ha retto.

## I quattro posti, e cosa protegge ciascuno

| Posto | Protegge | Non protegge |
|---|---|---|
| `middleware.ts` | niente. Rinfresca il cookie di sessione | tutto: si aggira, non conosce i ruoli, e la sua sola presenza fa credere che ci sia un controllo |
| `layout.tsx` della sezione | tutte le **pagine** figlie, sul server, prima del rendering | i **route handler**, le **azioni server** |
| il file di rotta (`page.tsx`, `route.ts`) | sé stesso | — |
| l'azione server (`"use server"`) | sé stessa | — |

La forma che questa skill genera: guardia nel `layout.tsx` della sezione admin, **più** una chiamata dentro ogni azione server e dentro ogni route handler. Non è ridondanza: sono tre superfici diverse che il browser raggiunge per strade diverse.

## `getUser()`, non `getSession()`

```ts
// giusto: il token lo valida il server di Auth
const { data: { user } } = await supabase.auth.getUser();

// sbagliato in una guardia: legge il cookie, che il browser può scrivere
const { data: { session } } = await supabase.auth.getSession();
```

`getSession()` legge la sessione dai cookie senza farla validare. Per decidere *cosa mostrare* va bene; per decidere *chi entra* è un controllo su un dato che l'utente controlla — cioè non è un controllo.

## Il ruolo non sta nel token, se la revoca deve valere subito

```ts
const { data: persona } = await supabase
  .from("staff")
  .select("id, full_name, ruolo")
  .eq("auth_user_id", user.id)
  .eq("is_active", true)
  .maybeSingle();

if (!persona) redirect("/accedi?motivo=non-autorizzato");
```

La tabella dei ruoli è scritta solo da chi ha il permesso di scriverla (`grant update` per colonna, o una funzione `security definer`): vedi `form-e-permessi.md`. **Mai** da `user_metadata`, che lo scrive l'utente con una chiamata a `updateUser` e finisce dentro `auth.jwt()` — è auto-promozione ad admin in una riga di JavaScript (`schema-forge/references/rls-supabase.md`, pattern 4).

Il claim nel JWT (`raw_app_meta_data`) è legittimo e costa una query in meno, ma **non è fresco**: una revoca vale dal token successivo. Se il gestionale deve poter licenziare qualcuno *adesso*, il ruolo si legge da tabella.

## Un'azione server è un endpoint

```ts
"use server";

export async function aggiornaProdotto(dati: FormData) {
  await richiediStaff();          // ← prima riga, sempre
  const supabase = await clientServer();
  // …
}
```

Next serializza ogni Server Action in un identificatore invocabile con una POST. Chi la invoca **non passa** dal layout che ha fatto il controllo, né dalla pagina che mostrava il pulsante. La guardia nella pagina non protegge l'azione: protegge la vista della pagina.

Le due sole azioni che possono restare senza guardia sono **accesso e uscita** — sono la guardia — e vanno dichiarate:

```json
{ "azioniPubbliche": ["src/modules/admin/accesso.ts"] }
```

`scripts/admin-audit.mjs` produce un `block` su ogni funzione esportata di un file `"use server"` che non chiama una guardia e non è dichiarata. La guardia chiamata in un'**altra** funzione dello stesso file non conta: l'unità di misura è la funzione, perché è la funzione a essere invocabile.

## Il client Supabase nasce in un posto solo

```
src/lib/supabase/server.ts       Server Components e azioni: sessione dai cookie
src/lib/supabase/client.ts       componenti nel browser: chiave pubblicabile
src/lib/supabase/middleware.ts   solo il rinfresco della sessione
```

Dichiarati in `gestionale.config.json` (`moduliClientSupabase`). Un client costruito altrove è un `issue`: è il punto in cui una chiave sbagliata entra senza che nessuno la veda, ed è esattamente com'è nato il difetto piantato n°3 del collaudo — un `src/lib/supabase/admin.ts` scritto per «risolvere» un permission denied.

**`service_role` non entra nel progetto.** Non in un file server-only, non «solo per questo report». Scavalca ogni policy per costruzione: se un'operazione richiede più permessi di quelli che l'utente ha, la risposta è una funzione `security definer` scritta da schema-forge, che il permesso lo controlla dentro.

## La porta d'ingresso

È l'unica rotta pubblica del gestionale, e va dichiarata (`rottaPubblicaDiAccesso`). Due dettagli che sembrano cosmetici e non lo sono:

- **il messaggio d'errore non distingue** «email sconosciuta» da «password sbagliata», o diventa un modo per sapere chi ha un account;
- **dopo l'accesso si rimanda alla sezione admin**, e la guardia rifà il controllo: il fatto che l'accesso sia riuscito non dice che quell'utente sia staff. Un cliente del sito che si autentica è autenticato — e non deve entrare nel gestionale.

## Errori classici

| Errore | Conseguenza |
|---|---|
| guardia solo nel `middleware.ts` | si aggira, e non conosce i ruoli: il controllo c'è e non controlla |
| `route.ts` sotto un layout protetto, senza guardia propria | risponde 200 a un anonimo (**misurato**) |
| azione server senza guardia | endpoint POST aperto: il pulsante era protetto, l'azione no |
| `getSession()` in una guardia | decisione presa su un dato che il browser scrive |
| ruolo letto da `user_metadata` | auto-promozione ad admin |
| `service_role` «solo per un report» | ogni policy scavalcata, per sempre |
| redirect dopo l'accesso senza ricontrollo del ruolo | un cliente autenticato entra nel backoffice |
| client Supabase costruito nella pagina | la chiave sbagliata passa inosservata al primo copia-incolla |
