# Handoff — Flow Sentinel

> Progetto: **Bottega Nord** (banco di prova, e-commerce di maglieria: in
> pratica il solo backoffice piu' una home).
> Batteria costruita ed eseguita il 2026-07-30, sopra
> `docs/handoff/07-schema-forge.md` e `docs/handoff/10-gestionale-crafter.md`.
> E' il **primo consumatore reale** di Flow Sentinel: fino a qui la skill aveva
> giudicato solo banchi scritti dalla stessa mano che scriveva le sue regole.

## 1. Cosa ho fatto

- `docs/flussi-critici.md` — il contratto: **10 flussi** confermati
  (5 positivi, 3 ostili in lettura, 2 ostili in scrittura), piu' l'elenco
  esplicito dei flussi **assunti e non coperti**.
- `e2e/*.spec.ts` — **10 spec**, una per flusso, ognuna con l'etichetta
  `@flusso:<id>` nel titolo. In esecuzione sono **15 test** (tre flussi si
  articolano su piu' casi: le tre rotte dell'attacco anonimo, l'uscita dopo
  l'accesso, la home vista dall'anonimo dopo la modifica del contenuto).
- `e2e/helpers/db.ts` — l'unico punto con la chiave amministrativa, usata solo
  per **misurare**; `e2e/helpers/auth.ts` — utenti e sessioni coniate dalla UI
  vera; `e2e/helpers/env.ts`; `e2e/global-setup.ts`.
- `playwright.config.ts` — `retries: 1`, `forbidOnly`, trace al primo ritentativo.
- `.env.e2e.local` (non committato) e le righe di `.gitignore` che tengono fuori
  chiave, sessioni e artefatti.

**Comando unico per rilanciare** (l'app dev deve essere accesa):

```
E2E_BASE_URL=http://127.0.0.1:3001 npx playwright test
```

## 2. Esito

**Batteria: 15 test su 15 verdi**, zero al secondo tentativo, zero flaky noti.
**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi).

Il gate va lanciato dalla radice del progetto passando l'URL vero:

```
node ../agenti/flow-sentinel/scripts/verify.mjs --url http://127.0.0.1:3001
```

## 3. Difetti trovati, che i due gate a monte non avevano visto

### 3.1 Nessuno riusciva ad accedere al gestionale — BLOCCANTE, corretto

`supabase/seed.sql` inseriva le righe di `auth.users` a mano lasciando
`confirmation_token`, `recovery_token`, `email_change` e
`email_change_token_new` a **NULL**. GoTrue legge quelle colonne in una
`string` di Go e muore:

```
error finding user: sql: Scan error on column index 3, name "confirmation_token":
converting NULL to string is unsupported
→ HTTP 500 {"code":500,"error_code":"unexpected_failure",
   "msg":"Database error querying schema"}
```

Ogni `signInWithPassword`, per ogni utente, rispondeva 500. **Il backoffice era
inaccessibile a chiunque**, dal primo giorno.

Perche' nessuno se n'era accorto: lo schema non ha niente di sbagliato, quindi
il gate di schema-forge e' verde — prova le policy con pgTAP e `set role`, che
non passano da GoTrue; e il gate di gestionale-crafter legge codice e privilegi
in modo statico, senza mai autenticarsi. **Flow Sentinel e' il primo agente
della pipeline che prova a entrare invece che a ispezionare**, e l'ha trovato
nei primi minuti della fase `map`, misurando la premessa prima di scrivere una
riga di spec.

Correzione applicata al seed (le quattro colonne a stringa vuota, con il
commento che spiega il perche'). Verificata con `supabase db reset` da pulito:
login **HTTP 200**. **Il fix e' di schema-forge, non di Flow Sentinel** — qui e'
stato applicato perche' senza di esso non esisteva nessun flusso da percorrere,
e la regola «il verificatore non ripara cio' che verifica» va letta accanto
all'altra: senza premessa non c'e' esito.

**Residuo dichiarato:** il seed non scrive `auth.identities`. L'accesso a
password non ne ha bisogno e la batteria e' verde, ma un utente Supabase vero
ha sempre la sua riga di identita': va sanata prima di qualunque uso di OAuth o
di collegamento di identita'.

### 3.2 Il menu promette al magazziniere le due sezioni che gli nega — aperto

`src/app/admin/layout.tsx` rende le sei voci a ogni ruolo. Il magazziniere vede
e puo' cliccare «Contenuti» e «Personale», e finisce su `/admin` — dove **non
compare nessun messaggio**, perche' `src/app/admin/page.tsx` non legge
`searchParams` e il `?motivo=ruolo-insufficiente` scritto dalla guardia non lo
raccoglie nessuno. Il rifiuto e' corretto e la spec lo fissa; l'esperienza no.
Non l'ho corretto: e' dei costruttori.

### 3.3 Nessun `error.tsx` in tutto il progetto — aperto

Le dodici azioni server fanno `throw new Error(error.message)` e non hanno dove
atterrare. In sviluppo compare l'overlay di Next; in produzione il messaggio
viene sostituito da un digest. Conseguenza per la batteria: **nessuna spec puo'
asserire un testo d'errore a schermo**, e infatti nessuna lo fa. E' il punto 5
dei punti aperti di gestionale-crafter, qui confermato dall'esterno.

### 3.4 Campi nascosti creduti sulla parola — aperto, non coperto

`aggiornaVariante` mette `id`, `sku` e `size` in `<input type="hidden">` e li
**riscrive tutti e tre** nell'`update`: una POST forgiata cambia SKU e taglia di
qualunque variante. `aggiornaProdotto`, `eliminaProdotto` e `aggiornaContenuto`
si fidano dell'`id` nascosto senza verificarlo, e nessuna delle cinque
`update` (a differenza di `avanzaOrdine`) controlla **quante righe** ha toccato:
un id inesistente e' un successo silenzioso. Non e' un buco di privilegio nel
modello mono-negozio dichiarato, ma e' la classe di difetto che diventa uno il
giorno in cui le sedi sono due.

### 3.5 Due azioni server orfane — aperto, non coperto

`aggiornaCliente` e `creaContenuto`: nessuna vista le importa. Restano endpoint
POST raggiungibili senza percorso d'interfaccia, quindi la batteria non le
attraversa. O si collegano, o si tolgono.

## 4. Difetti trovati nella batteria stessa, mentre la si costruiva

Vale la pena scriverli: sono falsi verdi che stavano nascendo dentro la rete di
sicurezza, non nell'app.

1. **La sessione salvata era vuota e sembrava buona.** `salvaSessione`
   attendeva `getByRole("heading", { name: "Gestionale" })`, che confronta per
   **sottostringa e senza distinguere le maiuscole**: l'h1 di `/accedi` e'
   «Accesso al **gestionale**» e combaciava. L'attesa si risolveva restando
   sulla pagina di accesso, `storageState` fotografava un contesto senza cookie
   e scriveva tre file da 36 byte. Le sei spec autenticate diventavano rosse
   accusando l'app di non avere le proprie intestazioni. Chiuso aspettando
   **prima l'URL** e chiedendo l'intestazione `exact`, e rifiutando
   esplicitamente una sessione con zero cookie.
2. **`ultimoAccesso` riporta l'errore come `{}`.** L'oggetto d'errore
   dell'admin API non ha un `message` utile e finisce nel messaggio come oggetto
   vuoto: la diagnosi non dice niente. Residuo minore, segnato qui.

## 5. Il sabotaggio: quattro classi, quattro rossi

Una batteria che non e' mai diventata rossa non e' una rete di sicurezza.
Ogni difetto e' stato piantato, misurato e rimosso.

| Classe | Difetto piantato | Esito |
|---|---|---|
| premessa d'accesso | i token di `auth.users` riportati a NULL (il difetto vero di §3.1) | **rosso** su `accesso-staff` |
| guardia di rotta | `richiediRuolo("titolare")` declassata a `richiediStaff()` su `/admin/personale` | **rosso** su `sezioni-di-ruolo-negate-al-magazziniere` |
| effetto sul database | `creaProdotto` ignora la spunta «Pubblicato» | **rosso** su `crea-prodotto`, con «la spunta «Pubblicato» non e' arrivata al database» — la **pagina restava giusta**, solo l'asserzione sul database ha visto la differenza |
| permesso di colonna | `grant update (ruolo) on staff to authenticated` | **rosso** su `ruolo-non-scrivibile-dal-magazziniere`: l'auto-promozione riesce, e la RLS **non** la ferma |

L'ultima riga e' anche una conferma indipendente di quello che schema-forge
aveva scoperto sul suo banco: su Supabase la difesa e' il `grant` per colonna,
non la policy.

## 6. Cosa si aspetta chi viene dopo

- **Speed Demon**: ottimizza con questa rete tesa. Dopo ogni modifica rilancia
  il comando della §1; il gate va rilanciato con `--url`, non a mano.
- **Cyber Shield**: i flussi ostili qui dentro sono il **punto di partenza**, non
  la conclusione. Qui si prova che le porte **dichiarate** dal modello di accesso
  restano chiuse; le porte che nessuno ha dichiarato le cerchi tu. Comincia da
  §3.4 (campi nascosti riscritti) e §3.5 (azioni orfane).
- **Launchpad**: non pubblicare su gate rosso, e non pubblicare prima che §3.1
  sia chiusa anche in `auth.identities`.

## 7. Residui del gate e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi) — rilanciato il
2026-07-30 con `--url http://127.0.0.1:3001`.

| Gravita' | Cosa | Perche' resta | Rientro previsto |
|---|---|---|---|
| nota | `[auth].site_url` dichiara la **3000**, l'app gira sulla **3001** | su questa macchina la 3000 e' occupata da un altro progetto e Next ha spostato l'app senza che nessuno glielo chiedesse. Il gate va quindi lanciato con `--url`. Ha prodotto un falso verde su `app-viva`, corretto **nella skill** (vedi sotto) | quando la 3000 e' libera, o quando il progetto dichiara la porta vera |
| nota | `auth.identities` vuota | l'accesso a password non ne ha bisogno; OAuth si' | prima di qualunque provider esterno |
| nota | flussi non coperti | elencati in `docs/flussi-critici.md` §Flussi assunti e non coperti, con il perche' di ciascuno | — |
| nota | l'elenco dei flussi l'ha confermato l'**orchestratore**, non un umano | modalita' pipeline: nessun flusso muove denaro vero, manda comunicazioni o cancella dati di produzione. Resta che la completezza dell'elenco non e' automatizzabile | alla prima revisione umana |

Verifiche mancanti (strumenti non eseguiti): nessuna.

**Cosa un gate verde NON dimostra**: `agenti/flow-sentinel/SKILL.md` §Cosa un
gate verde NON prova. In breve, e misurato qui: che l'elenco dei flussi sia
completo non lo dice nessuno strumento — lo dice solo chi lo conferma.
