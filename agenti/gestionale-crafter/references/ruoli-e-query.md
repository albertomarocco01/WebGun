# Ruoli e query — l'interfaccia sopra la RLS

Come cambia il gestionale in base a chi lo usa, e perché quasi tutti i guasti "misteriosi" di un backoffice su Supabase sono la stessa cosa vista da angoli diversi: **la RLS ha risposto, e ha risposto vuoto**.

## Il ruolo si legge una volta, per richiesta

```ts
const persona = await richiediStaff();      // { id, full_name, ruolo }
```

La guardia restituisce già la persona: non si rilegge il ruolo in ogni componente. Una seconda lettura è una seconda occasione di leggerlo da un posto sbagliato.

Per le sezioni con permesso più stretto:

```ts
await richiediRuolo("redattore", "titolare");
```

La regola di corrispondenza: **gli stessi ruoli della policy**. Se la policy di scrittura di `site_content` dice `ha_ruolo('redattore') or ha_ruolo('titolare')`, la guardia della vista dice gli stessi due. Divergere significa mostrare una pagina che non salva, o nascondere una pagina che funzionerebbe.

## Quattro sintomi, una causa

| Sintomo nel gestionale | Causa quasi certa |
|---|---|
| elenco vuoto, nessun errore | manca il `grant` a `authenticated`, o la policy di `select` non copre questo ruolo |
| «salva» non dà errore e non cambia niente | `update` senza policy di `select` per lo stesso ruolo: tocca 0 righe |
| una riga sparisce dopo il salvataggio | l'`update` l'ha portata fuori dal `using` della policy: il record esiste e non è più leggibile da chi l'ha scritto |
| il cliente vede meno del previsto | una colonna `null` usata in un confronto: in SQL `null = null` non è vero, e la riga sparisce senza errore |

L'ultimo è il più insidioso ed è modellistico: un cliente senza account (`auth_user_id is null`) **non è raggiungibile** da nessuna policy per `authenticated`. Quelle righe le vede solo lo staff — ed è giusto così, ma va saputo prima di scrivere la vista, non dopo (`schema-forge/references/pattern-ecommerce.md` §Clienti).

## L'interfaccia non filtra i dati: li chiede filtrati

```ts
// giusto: il filtro è nella query, la RLS lo ricontrolla
.from("orders").select("…").eq("customer_id", clienteId)

// sbagliato: tutto in memoria e poi si nasconde
const tutti = await supabase.from("orders").select("*");
const miei = tutti.data?.filter((o) => o.customer_id === clienteId);
```

Il secondo modo funziona finché la RLS lo salva — e il giorno in cui una policy si allarga, il "filtro" dell'interfaccia diventa l'unica difesa. Non lo è mai stata: una `select` senza filtro è già uscita dal database.

I filtri espliciti non sono ridondanti nemmeno per le prestazioni: aiutano il planner anche con la RLS attiva (`rls-supabase.md` §Performance).

## `select` con le colonne, non con l'asterisco

```ts
.select("id, slot, title, corpo, is_published")
```

Tre motivi, in ordine di importanza:

1. **il tipo generato diventa esatto**, e `tsc` diventa il controllo che accorge di una colonna rinominata a monte — è successo sul banco: dopo un `evolve` che rinominava `body` in `corpo`, `supabase-js` ha prodotto `SelectQueryError<"column 'body' does not exist on 'site_content'">` e il gate è diventato rosso su 15 errori in 4 file, invece che a runtime davanti al cliente;
2. si legge cosa serve, non tutto ciò che c'è;
3. una colonna riservata aggiunta domani non entra nel bundle per inerzia.

## Le macchine a stati: si offre solo ciò che il database ammette

```ts
export const TRANSIZIONI: Record<string, readonly string[]> = {
  in_attesa: ["confermato", "annullato"],
  confermato: ["spedito", "annullato"],
  spedito: ["consegnato"],
  consegnato: [],
  annullato: [],
};
```

La difesa resta il trigger: questa tabella serve a non offrire un pulsante che porta a un `raise exception` incomprensibile. Va tenuta **accanto** alle query del dominio (`src/modules/<dominio>/query.ts`), non dentro un componente, e va aggiornata quando cambia il trigger — un'interfaccia che offre una transizione morta è un difetto, anche se il database la respinge correttamente.

### Lo stato attuale non arriva dal modulo

È il difetto che il tribunale ha trovato in questa stessa skill il 2026-07-28, confermato da due esperti per strade diverse. La forma sbagliata sembra innocua:

```ts
// SBAGLIATO: `status_attuale` è un campo nascosto, cioè un dato del client
const attuale = String(dati.get("status_attuale") ?? "");
if (!TRANSIZIONI[attuale]?.includes(nuovo)) throw new Error("transizione non ammessa");
await supabase.from("enrollments").update({ status: nuovo }).eq("id", id);
```

Il controllo confronta la mossa con uno stato **dichiarato da chi la richiede**, e l'`update` filtra solo sull'`id`: chi invoca l'azione direttamente (è un endpoint POST, non un form) dichiara lo stato che gli conviene e ottiene la transizione. Uno stato terminale — `ritirata`, `annullato`, `consegnato` — smette di essere terminale.

```ts
// GIUSTO: lo stato è nella CONDIZIONE, non nell'ipotesi
const { data, error } = await supabase
  .from("enrollments")
  .update({ status: nuovo })
  .eq("id", id)
  .eq("status", attuale)     // ← se la riga non è più lì, non si tocca
  .select("id");

if (error) throw new Error(error.message);
if (data?.length === 0) throw new Error("l'iscrizione è cambiata nel frattempo: ricarica");
```

Due cose in una riga: l'ipotesi del client diventa una **condizione verificata dal database**, e due operatori sulla stessa riga smettono di sovrascriversi (è un lock ottimistico). Zero righe toccate **non è un successo**: è un conflitto, e va detto.

E resta l'altra metà: **la macchina a stati va vincolata nel database**, con un trigger che rifiuti le transizioni illegali *e* lo stato iniziale sbagliato (`schema-forge/references/rls-supabase.md` §Macchine a stati). Senza, la macchina esiste solo nell'applicazione — e un'applicazione non è un vincolo. Se lo schema non ce l'ha, è una richiesta per schema-forge, e va nell'handoff §6.

Chi scrive lo stato non è chi lo mostra: l'avanzamento passa da un'azione server con guardia, e lo stato nuovo si valida **tre** volte — l'interfaccia offre solo le mosse legali, l'azione le verifica contro lo stato reale, il trigger le impone.

## Cosa cambia in base al ruolo, e cosa no

- **Cambia la navigazione**: le voci che portano a sezioni vietate non si mostrano. È cortesia, non sicurezza.
- **Cambiano i moduli**: un campo che l'utente non può scrivere non si disabilita, si **omette** — un campo disabilitato in HTML si riabilita con due clic negli strumenti di sviluppo, e il `FormData` che ne esce arriva comunque all'azione.
- **Non cambia il filtro dei dati**: quello lo fa la RLS. Se il gestionale mostra a un ruolo righe che non dovrebbe vedere, il difetto è nella policy, e si porta a schema-forge.

## Errori classici

| Errore | Conseguenza |
|---|---|
| ruolo riletto in ogni componente | quattro strade per leggerlo, una sbagliata prima o poi |
| guardia della vista con ruoli diversi dalla policy | pagina che non salva, o sezione nascosta senza motivo |
| `select("*")` ovunque | il tipo non aiuta più, e una colonna riservata esce da sola |
| filtro fatto in memoria dopo un `select` senza `eq` | i dati sono già usciti dal database |
| campo vietato mostrato disabilitato | si riabilita dal browser, e l'azione lo riceve |
| elenco vuoto letto come «non ci sono dati» | quasi sempre è un `grant` o una policy: si guarda lì prima di riscrivere la query |
