# I flussi critici

Legge n°1: **il flusso prima del test**. Prima di scrivere una riga di spec si stabilisce *cosa* va protetto, e quell'elenco lo conferma qualcuno che non è l'agente. Una batteria perfetta sui flussi sbagliati è comunque da buttare: gira verde, costa manutenzione e non protegge niente.

Questa reference dice cos'è un flusso critico, come si derivano i flussi ostili dal modello di accesso, e il **formato esatto** di `docs/flussi-critici.md` — che non è una convenzione di stile: è il file che il gate legge, e tre dei sette passi non esistono senza di lui.

## Cos'è un flusso critico

Un flusso critico è un **percorso completo** che, se si rompe in produzione, costa una di tre cose:

- **denaro** — il checkout che non registra l'ordine, il totale calcolato dal browser invece che dal server;
- **dati** — la rotta che mostra l'ordine di un altro cliente, la colonna che l'utente riscrive da solo;
- **fiducia** — il login che non fa entrare, la conferma che dice «fatto» mentre il database non ha ricevuto niente.

Il criterio pratico è una domanda sola: **se questo si rompe venerdì sera e nessuno se ne accorge fino a lunedì, cosa è successo?** Se la risposta è «niente di irreversibile», non è un flusso critico. Se è «abbiamo perso gli ordini del weekend», «i dati di un cliente erano leggibili da chiunque», «nessuno è riuscito a entrare», lo è.

**Non è un flusso critico una pagina che si vede.** «La home carica», «il footer c'è», «il titolo dice Bottega Nord» sono asserzioni su una resa grafica: passano anche quando il backend è spento e l'app serve una pagina statica, e falliscono al primo restyling che nessuno considerava un guasto. Il motivo per cui vanno tenute fuori non è il purismo: **ogni test costa manutenzione, e un test che si rompe quando il prodotto migliora insegna a ignorare il rosso.** Il giorno in cui il rosso è vero, nessuno lo guarda.

La distinzione operativa: un flusso critico **attraversa** l'applicazione — browser, rotta, logica, database — e finisce con un **effetto verificabile fuori dalla pagina**. Se il test non può guardare da nessun'altra parte che dalla pagina, quasi sempre non era un flusso critico.

## L'elenco si conferma, non si assume

Lo **Specchio dei flussi** è la forma che la Legge n°1 prende nel comando `map`: l'agente esplora rotte e handoff, **propone** l'elenco, e **si ferma**. Chi conferma dipende dalla modalità (SKILL.md §Modalità, precedente di `DECISIONI.md` §6):

- **interattiva** — l'umano, con un «sì» esplicito;
- **pipeline** — l'orchestratore (Prompt Smith), sulla base di brief e handoff; ciò che è stato **assunto** si scrive in `docs/handoff/12-flow-sentinel.md`, così un flusso critico dimenticato resta leggibile invece di sparire;
- **sempre l'umano** quando l'elenco contiene flussi che muovono denaro vero, inviano comunicazioni reali a persone o cancellano dati: l'orchestratore può autorizzare ciò che è reversibile, non ciò che non lo è.

Perché la conferma è una premessa e non una formalità: **un elenco che nessuno ha confermato è l'opinione dell'agente su cosa fosse critico.** L'agente ha letto il codice; il committente sa quale flusso paga gli stipendi.

Il gate la misura, e la misura come premessa. Il passo `flussi-critici` non guarda l'esito prima di aver verificato l'input:

| Cosa trova | Stato del passo | Conseguenza |
|---|---|---|
| `docs/flussi-critici.md` assente | `skipped` (MANCANTE) | non c'è contratto da coprire — si lancia `map` |
| file presente, nessuna riga `Confermato da:` | `skipped` (MANCANTE) | l'elenco c'è, la firma no: non è un contratto |
| file confermato, zero intestazioni di flusso leggibili | `skipped` (MANCANTE) | il formato non combacia, e nessun flusso è stato letto |
| tipo sconosciuto o id ripetuto | `fail` | il documento c'è ma dichiara una cosa che il gate non sa interpretare |
| tutto in ordine | `pass` | il dettaglio stampa quanti flussi, di che tipo, e **chi** li ha confermati |

Il costo di un contratto mancante non si ferma a un passo. `spec-coverage` ed `effetto-db` leggono l'elenco dei flussi: senza, diventano `skipped` a loro volta. **Un `docs/flussi-critici.md` assente o non confermato spegne tre dei sette passi**, e tre verifiche mancanti valgono rosso esattamente come tre fallimenti.

## I tre tipi di flusso

Il tipo non è un'etichetta descrittiva: **decide cosa la spec deve asserire**, e il gate ci si aggancia. I tre valori sono esattamente questi, in minuscolo:

| tipo | Cosa deve succedere nel browser | Cosa deve asserire la spec | Asserzione sul database |
|---|---|---|---|
| `positivo` | il percorso riesce | l'esito in pagina **e** l'effetto sul database | **obbligatoria** |
| `ostile-lettura` | la rotta o la UI negano | il rifiuto (404, redirect, pagina vuota, nessun dato altrui nell'HTML) | non richiesta, e il perché è qui sotto |
| `ostile-scrittura` | l'attacco viene rifiutato | il rifiuto **e** che il database non è cambiato | **obbligatoria** |

### `positivo` — riesce, e si vede nel database

Un flusso positivo non è finito quando la pagina dice «ordine confermato». È finito quando la riga esiste, con i valori giusti, nello stato giusto.

Perché: **un test che guarda solo la pagina passa anche con un backend che non ha scritto niente.** È il difetto più economico da introdurre e il più caro da scoprire — un `catch` che ingoia l'errore e mostra comunque la conferma, una server action che ritorna `{ ok: true }` prima di aver atteso la scrittura, un `insert` che la RLS respinge silenziosamente (`update`/`delete` senza policy di `select` toccano **zero righe senza errore**, `rls-supabase.md` §`update` e `delete`). In tutti e tre i casi la UI è impeccabile e il database è vuoto. È esattamente il difetto che `references/sabotaggio.md` pianta al collaudo per provare che la batteria lo vede.

L'asserzione minima per tipo di flusso: la riga **esiste** (creazione), la riga **è cambiata** nel modo previsto (aggiornamento, avanzamento di stato), il **valore** è quello calcolato dal server e non quello inviato dal client (prezzi, totali, ruoli).

### `ostile-lettura` — la porta chiusa resta chiusa

Un attacco in lettura tenta di **vedere** ciò che il modello di accesso vieta: l'anonimo che apre l'area riservata, il cliente che apre l'ordine di un altro, l'utente autenticato che apre `/admin`.

L'asserzione è il rifiuto, e va scritta guardando due cose: la rotta (stato HTTP, redirect al login, 404) **e** il contenuto (nessun dato dell'altro nell'HTML). La seconda non è pedanteria: una pagina che mostra un banner «non autorizzato» e sotto lascia i dati nel payload della pagina ha negato l'accesso solo agli occhi.

**Il gate non pretende l'asserzione sul database su questo tipo, ed è una scelta, non una dimenticanza.** Un attacco in lettura non cambia niente: non c'è uno stato «prima» da confrontare con uno «dopo», e pretendere un conteggio identico a sé stesso vorrebbe dire chiedere un'asserzione che non può fallire — cioè la definizione di un test finto. La costante che lo dice, in `scripts/gate-lib.mjs`, elenca i tipi con effetto DB e lascia fuori `ostile-lettura` di proposito:

```ts
// gate-lib.mjs — i tipi che DEVONO asserire l'effetto sul database
export const TIPI_CON_EFFETTO_DB = Object.freeze(["positivo", "ostile-scrittura"]);
```

Conseguenza da conoscere: **marcare `ostile-lettura` un attacco che in realtà scrive fa uscire quel flusso dalla regola.** Il gate crede al tipo dichiarato. Se l'attacco tenta un `insert`, un `update` o un `delete`, il tipo è `ostile-scrittura`, anche quando ti aspetti che fallisca subito.

### `ostile-scrittura` — rifiutato, e il database lo conferma

Un attacco in scrittura tenta di **cambiare** ciò che non gli compete: il cliente che avanza da sé lo stato del proprio ordine, il redattore che si promuove ad amministratore, l'utente che riscrive la riga di un altro.

Qui servono **due** asserzioni, e la seconda è quella che conta:

1. la chiamata **non riesce** — errore, redirect, messaggio di rifiuto;
2. il database **non è cambiato** — il valore (o il conteggio) misurato prima dell'attacco è identico a quello misurato dopo.

Perché la prima da sola non basta: un'interfaccia può mostrare un errore e aver scritto lo stesso (la scrittura passa, la lettura successiva fallisce, la pagina mostra il rosso), e un'interfaccia può non mostrare niente mentre la scrittura è andata a buon fine su un percorso diverso da quello che l'errore descrive. **La cosa che si sta difendendo è la riga, quindi è la riga che va guardata.** La forma corretta è: misuro prima, attacco, misuro dopo, asserisco l'uguaglianza — non «asserisco che sia zero», perché il valore legittimo spesso non è zero (il precedente sta in `rls-supabase.md` §Una policy senza test negativo: il test corretto asserisce che la visita è **rimasta** `prenotata`, conteggio 1, non 0).

### Cosa il gate controlla davvero, e cosa no

Il passo `effetto-db` verifica che almeno una delle spec che attaccano il flusso **importi e chiami** l'helper `e2e/helpers/db`. Il messaggio del rilievo lo dichiara: guarda la **forma**, non la semantica.

```ts
// e2e/checkout.spec.ts — la forma che il gate riconosce
import { expect, test } from "@playwright/test";
import { ordinePerEmail } from "./helpers/db"; // il percorso finisce in `helpers/db`, estensione facoltativa

test("l'ospite completa il checkout @flusso:checkout-ospite", async ({ page }) => {
  // ... i passi del flusso nel browser
  const ordine = await ordinePerEmail("ospite@prova.local"); // importato E chiamato
  expect(ordine?.status).toBe("in_attesa");
});
```

Un import senza chiamata non conta (un import non asserisce niente) e un percorso che non finisce in `helpers/db` non viene riconosciuto: `./helpers/db.ts` e `../../e2e/helpers/db.js` valgono, `./helpers/database` no. Ciò che il gate **non** sa è se l'asserzione è quella giusta: una spec che chiama l'helper e poi confronta un valore irrilevante passa il passo. Quella distanza la chiude il **sabotaggio** (`references/sabotaggio.md`), che rompe l'app in un punto noto e pretende il rosso. La stessa onestà che Schema Forge scrive sul suo audit RLS: lo strumento guarda la forma, la semantica la dimostrano i test.

## Come si derivano i flussi ostili

Gli ostili non si inventano: si **traducono**. La fonte è l'handoff di Schema Forge, `docs/handoff/07-schema-forge.md`, sezione **«Modello di accesso (chi vede cosa)»** — una tabella con una riga per tabella del database e una colonna per ruolo:

```
| Tabella              | anon | authenticated (cliente)        | staff |
|----------------------|------|--------------------------------|-------|
| `products`           | lettura se `is_published` | idem      | tutto |
| `orders`             | —    | solo i propri, sola lettura    | tutto |
| `internal_notes`     | —    | nessun accesso                 | tutto |
| `staff`              | —    | lettura se `is_active`         | tutto |
```

**La regola è meccanica: ogni cella che nega qualcosa è un attacco da tentare via browser.**

| Cella | Cosa vieta | L'attacco da tentare | id di esempio | tipo |
|---|---|---|---|---|
| `orders` × anon = «—» | nessun accesso agli ordini senza account | l'anonimo apre `/account/ordini` (e l'URL diretto di un ordine del seed) | `ordini-negati-anon` | `ostile-lettura` |
| `orders` × authenticated = «solo i propri» | la riga di un altro cliente | il cliente A entra e apre `/account/ordini/<id di B>` | `ordine-altrui-negato` | `ostile-lettura` |
| `orders` × authenticated = «**sola lettura** dopo la creazione» | qualsiasi scrittura del cliente sul proprio ordine | il cliente apre il proprio ordine e tenta l'avanzamento di stato che usa lo staff | `stato-ordine-negato-cliente` | `ostile-scrittura` |
| `internal_notes` × authenticated = «nessun accesso» + rotta `/admin` | l'intera area riservata | il cliente autenticato apre `/admin` e `/admin/note` | `admin-negato-al-cliente` | `ostile-lettura` |
| `staff` × authenticated = «lettura se `is_active`», con una colonna di privilegio | la modifica del proprio ruolo | il redattore apre il proprio profilo e tenta `ruolo = 'direttore'` | `promozione-negata` | `ostile-scrittura` |

L'ultimo merita una riga di più perché è il caso in cui una policy **corretta** perde. Sul banco veterinario di Schema Forge, un veterinario che aggiorna `job_title` sulla **propria** riga passa da 2 visite visibili a 6 e da 0 note interne a 1: la policy non è mai stata violata, perché la funzione di autorizzazione legge proprio quella colonna (`rls-supabase.md` §Il caso peggiore). Una colonna di privilegio scrivibile dal proprietario della riga è **auto-promozione ad amministratore**, e va nell'elenco degli ostili ogni volta che compare nel modello di accesso.

Tre precisazioni che evitano elenchi sbagliati:

- **Le celle «tutto» non sono attacchi**: sono i flussi **positivi** dello staff (il CRUD, l'avanzamento di stato). L'attacco è ciò che nega.
- **Si attacca con il ruolo vero**, dal browser: `anon` o un utente autenticato di prova. La chiave `service_role` vive solo negli helper di `e2e/` e **non** si usa per simulare l'attaccante: impersonare per comodità falsifica il flusso e prova una cosa che nessun utente potrà mai fare.
- **Questi test non sostituiscono i pgTAP di Schema Forge, e non li duplicano.** Quelli provano che *il database* rifiuta; questi provano che *la strada che passa dal browser* — rotta, route handler, server action, client PostgREST — non ne apre un'altra. Un `service_role` usato per sbaglio in una route handler rende verde il pgTAP e rosso il flusso ostile. È il motivo per cui i due controlli esistono entrambi.

### Se l'handoff di Schema Forge manca

**Ci si ferma.** Non si tira a indovinare, e non si scrive un elenco di ostili «plausibili».

Perché: senza il modello di accesso non si sa quale porta debba essere chiusa, e **un flusso ostile inventato che passa non dimostra niente** — può passare perché la difesa funziona, o perché quella rotta non esiste, o perché quel dato non è mai stato riservato. Un verde su una domanda sbagliata è peggio di nessun verde: occupa il posto della verifica vera.

Cosa fare, in concreto:

1. si verifica se il progetto ha davvero un database (una deroga allo stack standard va motivata per iscritto in `docs/PROGETTO.md`, `CLAUDE.md` §Stack);
2. se ce l'ha e l'handoff non c'è, è una **domanda strutturale**, di quelle che fermano la pipeline invece di diventare un'assunzione con un default (`DECISIONI.md` §6): chi ha costruito lo schema deve consegnare il modello di accesso;
3. l'attesa si dichiara — nell'handoff di Flow Sentinel come flusso **non coperto** con il suo perché, non come flusso coperto.

Il Flusso 1 lo dice già al passo 1: se manca l'handoff di chi ha costruito, ci si ferma. Non si testa alla cieca.

## Pattern per dominio

Sono il **punto di partenza dello Specchio**, non un elenco chiuso: si propongono, si discutono, si aggiungono i flussi che solo il committente conosce. Un pattern che arriva già confermato ha saltato la Legge n°1.

### E-commerce

**Positivi** (minimo del gate di chiusura: login, carrello, checkout):

| Flusso | Effetto atteso sul database |
|---|---|
| registrazione e login del cliente | l'utente esiste e la sessione è aperta (`auth.users`: `last_sign_in_at` valorizzato dopo l'accesso — il pattern che rende l'asserzione possibile sta in `references/playwright.md`) |
| carrello | le righe del carrello esistono con quantità e variante giuste, e sopravvivono a un ricaricamento della pagina |
| checkout | una riga in `orders` nello stato iniziale, le righe in `order_items` con il prezzo **di listino corrente**, non quello arrivato dal browser |

Il prezzo è il punto in cui un e-commerce generato in fretta perde soldi: `pattern-ecommerce.md` prescrive che l'ordine si crei da funzione del database o dal server, e l'asserzione che lo dimostra è confrontare `unit_price_cents` con il listino, non con ciò che la pagina mostrava.

**Ostili tipici:** l'anonimo che apre l'area ordini; il cliente che apre l'ordine di un altro; il cliente che modifica prezzo, quantità o stato del proprio ordine dopo la creazione; l'anonimo che raggiunge un prodotto non pubblicato dall'URL diretto; chiunque che apre `/admin`.

### Gestionale

**Positivi** (minimo del gate di chiusura: login, un CRUD completo, l'avanzamento di stato):

| Flusso | Effetto atteso sul database |
|---|---|
| login dello staff | sessione aperta con il ruolo giusto, e la rotta riservata raggiungibile |
| **un** CRUD completo in una spec sola: crea → compare in elenco → modifica → cancella (o disattiva) | dopo ogni passo la riga corrispondente esiste, ha i valori nuovi, e alla fine non c'è più (o ha il contrassegno di disattivazione) |
| l'avanzamento di stato (`in_attesa` → `confermato`) | lo stato della riga è quello nuovo, e la traccia dell'avanzamento esiste se il modello ne prevede una |

Perché **un** CRUD e non quattro spec da un'operazione ciascuna: il difetto tipico non sta nella singola operazione, sta nel **passaggio** — la creazione riesce e l'elenco non la mostra, la modifica riesce e la lettura serve la cache. Una catena in una spec sola attraversa quei passaggi; quattro spec indipendenti li saltano tutti.

Perché l'avanzamento di stato è sempre nell'elenco: una macchina a stati vincolata solo in `update` si aggira nascendo già nello stato di arrivo (`rls-supabase.md` §Macchine a stati). Il flusso positivo prova che il passaggio lecito funziona; l'ostile corrispondente prova che il salto non è concesso a chi non deve.

**Ostili tipici:** l'anonimo che apre `/admin`; il cliente autenticato che apre `/admin`; lo staff di una sede che scrive sui dati di un'altra; chiunque che si assegna un ruolo più alto; l'avanzamento di stato tentato dal proprietario del dato invece che dallo staff.

## Il formato di `docs/flussi-critici.md`

**Questo è un contratto parsato dal gate**, non una convenzione di stile. Ciò che non combacia non produce un errore di sintassi: produce un flusso che il gate non vede, cioè una copertura che nessuno ha misurato.

### L'intestazione di flusso

```
## `checkout-ospite` — positivo
```

Cosa il parser accetta, alla lettera:

- esattamente **due** cancelletti a inizio riga, seguiti da almeno uno spazio (`###` non viene letto: il flusso sparisce senza dire niente);
- gli **apici inversi attorno all'id sono facoltativi** — `## checkout-ospite — positivo` è valido;
- il separatore è **un carattere solo** fra `-`, `–` (mezza lineetta) e `—` (lineetta lunga): tre modi di scrivere lo stesso separatore in markdown, non tre significati;
- gli spazi attorno al separatore sono facoltativi, ma **vanno messi**: senza, `## carrello-persistito-positivo` viene spezzato all'ultimo trattino utile e diventa un id `carrello-persistito` di tipo `positivo` per caso;
- il tipo è **uno dei tre, tutto minuscolo**: `positivo`, `ostile-lettura`, `ostile-scrittura`;
- **la riga finisce lì**. `## \`checkout-ospite\` — positivo (carrello pieno)` non combacia con niente e il flusso non esiste per il gate. Passi, note e contesto vanno nel corpo, sotto l'intestazione.

Due modi di sbagliare che si comportano in modo diverso, e vale la pena conoscerli:

- **tipo scritto male nella forma** (`Positivo` con la maiuscola, `ostile lettura` con lo spazio) → la riga non combacia, il flusso **sparisce in silenzio**. Se una spec porta comunque la sua etichetta, si presenta come etichetta orfana (`warn`); se non c'è nessuna spec, non si presenta niente;
- **tipo scritto bene nella forma ma sconosciuto** (`ostile`, `negativo`) → la riga combacia, il gate produce un errore esplicito e il passo `flussi-critici` diventa `fail`.

Una conseguenza da tenere a mente scrivendo la prosa: **le intestazioni di sezione normali si scrivono con l'iniziale maiuscola.** Un `## note-operative` tutto minuscolo con un trattino dentro viene letto come un flusso `note` di tipo `operative` e fa fallire il passo. `## Note operative` no.

Diagnosi rapida: se il dettaglio del gate dice «non dichiara nessun flusso» ma nel file le intestazioni ci sono, allora **nessuna** è stata accettata, e le cause sono due — o non combaciano con il formato (`###`, una maiuscola, testo dopo il tipo), o combaciano tutte con un tipo sconosciuto. Nel secondo caso gli errori di tipo vengono calcolati e **buttati via**: l'elenco vuoto è una premessa che manca, e la premessa si legge prima dell'esito, quindi il passo esce `skipped` con quel solo messaggio. Si guardano le intestazioni una per una, non il messaggio.

### L'id stabile

L'alfabeto è stretto e non negoziabile: **minuscole, cifre e trattini**, e il primo carattere è una lettera o una cifra. Niente maiuscole, niente trattini bassi, niente accenti, niente spazi. `checkout-ospite`, `admin-negato-al-cliente`, `crea-prodotto`, `avanza-stato-ordine`.

Un id **ripetuto** è un errore e fa fallire il passo: un id stabile identifica un flusso solo, e due flussi con lo stesso nome rendono impossibile dire quale delle due spec ha coperto quale.

Perché **stabile**: l'id è la chiave che lega tre cose — la riga del contratto, l'etichetta `@flusso:<id>` nel titolo della spec, e il nome con cui il flusso compare in handoff, report e conversazioni. Rinominarlo senza rinominare l'etichetta rompe il legame: il flusso risulta scoperto (`block`) e la spec che lo attaccava davvero risulta orfana (`warn`). Il gate lo dice, ma **solo dentro il gate**: fuori — nell'handoff consegnato, nel verbale di collaudo, nella frase «il checkout è coperto» — il nome vecchio continua a circolare e non corrisponde più a niente. Si rinomina in un giro solo, contratto e spec insieme, e lo si scrive nell'handoff.

### La riga `Confermato da:`

```
Confermato da: UMANO (Alberto, committente) il 2026-07-28
```

Cosa il parser accetta:

- la riga può stare **ovunque** nel documento; vale la prima che compare;
- tollera l'elenco puntato, la citazione e il grassetto — `- **Confermato da:** ORCHESTRATORE (2026-07-28)` e `> Confermato da: …` valgono quanto la riga nuda, perché sono tre modi di scrivere la stessa riga in markdown;
- le parole sono **esattamente** `Confermato da` seguite dai due punti (maiuscole e minuscole indifferenti): `Confermato dall'umano:` **non** combacia;
- **la firma sta sulla stessa riga dei due punti.** Una riga `Confermato da:` lasciata vuota (o coi soli spazi) vale **come se non ci fosse**: il passo è MANCANTE. È una correzione fatta durante la costruzione, non un dettaglio di stile — la prima versione del parser ammetteva l'a capo fra i due punti e la firma, e allora una riga vuota catturava la prima riga non vuota che seguiva: il gate stampava `confermati da: ## \`accesso-staff\` — positivo` e usciva **verde su un contratto che nessuno aveva firmato**. Riprodotto il 2026-07-28 e chiuso ammettendo i soli spazi orizzontali, con due test che lo bloccano. Il caso conta perché una riga lasciata a metà è la forma tipica di un template non finito, cioè esattamente la situazione in cui la conferma non c'è stata.

Tutto ciò che segue i due punti viene catturato e **ristampato nel dettaglio del passo**, anche quando il gate è verde: chi legge l'esito vede chi ha firmato senza aprire il file. È la stessa regola con cui Schema Forge stampa sempre quale database ha guardato (`DECISIONI.md` §11): una verifica non deve poter assomigliare a una verifica diversa.

**La data la verifica nessuno.** È una convenzione della casa, non un controllo: scrivila comunque, perché è l'unica cosa che permette a `evolve` di dire se la conferma è più vecchia dell'ultimo cambio di rotte.

Perché la riga è obbligatoria al punto da valere una verifica mancante: senza, l'elenco è l'opinione dell'agente. Con, c'è un nome e una data da citare il giorno in cui un flusso critico è saltato fuori dopo il lancio — e quella conversazione è su cosa era stato mostrato e cosa era stato confermato, non su chi ricorda cosa.

### Il corpo di un flusso: passi ed effetto atteso

Sotto ogni intestazione vanno **i passi del percorso** e **l'effetto atteso sul database** (per un ostile: il rifiuto atteso, e cosa deve restare invariato).

**Questa parte il gate non la verifica.** È prosa per gli umani, e non c'è modo onesto di controllarla automaticamente: comprendere se «una riga in `orders` con `status = 'in_attesa'`» descrive davvero ciò che la spec asserisce vorrebbe dire reinventare la comprensione del testo.

Vale scriverla comunque, per quattro motivi concreti:

1. **è l'input di `forge`** — la spec si genera da qui; senza, l'agente inventa l'asserzione;
2. **è l'unica cosa che dice quale sia l'asserzione giusta.** Il passo `effetto-db` controlla che una spec chiami l'helper del database, non che confronti la cosa che conta: la prosa è la sola specifica di *cosa* confrontare;
3. **serve fra sei mesi**, quando la batteria diventa rossa e la domanda è «è sbagliato il test o è rotta l'app?»: senza l'effetto atteso scritto, si risponde leggendo il test, cioè chiedendo all'imputato;
4. **è la base del diff di `evolve`**: un flusso che *esiste ancora ma è cambiato* si vede confrontando i passi, non gli id.

Contenuto minimo per flusso: **chi** (quale ruolo), **da dove** (quali rotte), **i passi in ordine**, **l'effetto atteso** in termini di tabella, colonna e valore — oppure il **rifiuto atteso**: cosa vede l'utente e cosa deve restare identico nel database.

### Un documento completo e valido

Tre flussi, uno per tipo. Il gate lo legge così: `3 flussi (1 positivo · 1 ostile-lettura · 1 ostile-scrittura) — confermati da: UMANO (Alberto, committente) il 2026-07-28`.

```markdown
# Flussi critici — Bottega Nord

Confermato da: UMANO (Alberto, committente) il 2026-07-28

Derivati dalle rotte di `src/app/**/page.tsx` e dal modello di accesso di
`docs/handoff/07-schema-forge.md` §3. Chi modifica questo elenco rilancia lo
Specchio dei flussi: aggiungere una riga qui senza conferma è un'opinione.

## `checkout-ospite` — positivo

**Chi:** visitatore non autenticato. **Da dove:** `/prodotti` → `/carrello` → `/checkout`.

1. apre `/prodotti` e aggiunge al carrello la variante `SKU-CAFF-250`
2. apre `/carrello` e verifica quantità e totale mostrati
3. apre `/checkout`, compila email e indirizzo, conferma l'ordine

**Effetto atteso sul database:** una riga in `orders` con l'email inserita e
`status = 'in_attesa'`; una riga in `order_items` con la variante scelta,
`quantity = 1` e `unit_price_cents` uguale al **listino corrente** — non al prezzo
arrivato dal browser, che è il punto in cui un e-commerce perde soldi in silenzio.

## `ordine-altrui-negato` — ostile-lettura

Deriva dalla cella `orders` × `authenticated` = «solo i propri».

**Chi:** cliente autenticato (`cliente-a@prova.local`).
**Da dove:** `/account/ordini/<id>`, con l'id di un ordine di `cliente-b@prova.local`
preso dal seed.

1. entra come `cliente-a@prova.local`
2. apre l'URL diretto dell'ordine di B

**Rifiuto atteso:** la pagina nega (404 o pagina vuota con avviso) e **nessun dato di
B compare nell'HTML servito**: un banner «non autorizzato» sopra un payload che
contiene ancora l'ordine ha negato l'accesso solo agli occhi.
Nessuno stato da confrontare: una lettura non cambia il database.

## `stato-ordine-negato-cliente` — ostile-scrittura

Deriva dalla cella `orders` × `authenticated` = «sola lettura dopo la creazione».

**Chi:** cliente autenticato, proprietario dell'ordine.
**Da dove:** `/account/ordini/<id>`.

1. entra come `cliente-a@prova.local` e apre il proprio ordine, in `in_attesa`
2. tenta l'avanzamento a `pagato` con la stessa chiamata che usa la pagina dello staff

**Rifiuto atteso:** la chiamata fallisce e la pagina resta su `in_attesa`.
**Database invariato:** `orders.status` di quell'ordine vale `in_attesa` prima e dopo
l'attacco, e il conteggio di `order_status_history` per quell'ordine non cambia.
```

## Cosa fa `evolve` sull'elenco

`evolve` confronta rotte e handoff nuovi con `docs/flussi-critici.md`. Tre casi, tre comportamenti:

- **flusso nuovo** (una feature aggiunta, una rotta comparsa, una riga nuova nel modello di accesso) → **Specchio solo su quello**: si propone il flusso singolo e si ottiene conferma, senza rimettere in discussione l'elenco già confermato. Riconfermare tutto a ogni giro trasforma la conferma in una firma automatica, e una firma automatica non conferma niente. Poi il flusso entra nel contratto e riceve la sua spec, altrimenti il gate lo blocca (`block` di copertura).
- **flusso sparito dall'elenco** → la spec che lo attaccava resta e diventa **orfana**: il gate la marca `warn` («etichetta `@flusso:<id>` senza flusso dichiarato»), la stampa e **non blocca**. Non la si cancella in silenzio, perché **decidere che un flusso non è più critico spetta a chi ha confermato l'elenco**, non all'agente che sta riallineando i file. Il `warn` non blocca di proposito: la spec c'è ed è lavoro fatto, e un `block` qui premierebbe chi cancella la spec invece di chiedere.
- **id rinominato** → per il gate sono due cose insieme, un flusso sparito e uno nuovo: un `warn` di etichetta orfana e un `block` di copertura. È il motivo per cui una rinomina si fa in un giro solo, contratto ed etichette insieme.

Dal `warn` si esce in due modi, e sono entrambi onesti: **il flusso torna nel contratto** (era stato tolto per sbaglio), oppure **chi ha confermato dichiara che non è più critico** e nello stesso giro si cancella la spec e lo si scrive nell'handoff. Ciò che non è un'uscita è lasciare il `warn` lì a girare: un avviso che si stampa da mesi è rumore, e il rumore si impara a scavalcare.

## Cosa questo contratto non garantisce

Elenco onesto, perché un lettore che crede che il verde significhi più di quello che significa è più esposto di uno che non ha nessun test.

- **Il gate verifica che ogni flusso dichiarato sia attaccato, non che l'elenco sia completo.** I flussi che nessuno ha pensato restano fuori, e da fuori non producono nessun rosso: non esistono per il gate come non esistevano per chi ha scritto l'elenco. Questa è la ragione per cui lo Specchio dei flussi è una legge e non un passo del gate — nessun controllo automatico può scoprire una domanda che non è stata fatta.
- **La conferma prova che qualcuno ha firmato, non che abbia guardato bene.** Il gate legge la riga, non la sua verità. Una conferma di sei mesi fa su un'app che nel frattempo ha tre rotte nuove resta valida per il passo `flussi-critici`: è `evolve` a doverla rimettere in discussione, ed è un comando che qualcuno deve lanciare.
- **L'effetto sul database si controlla nella forma, non nella semantica.** Una spec che importa e chiama `e2e/helpers/db` supera il passo anche se poi confronta un valore che non c'entra. Il sabotaggio è ciò che misura la differenza, e va fatto almeno una volta al collaudo.
- **Il tipo lo dichiara chi scrive l'elenco.** Un attacco in scrittura marcato `ostile-lettura` esce dall'obbligo di asserzione sul database, e nessun controllo lo scopre. Nel dubbio, se l'attacco tenta di cambiare qualcosa, è `ostile-scrittura`.
- **L'etichetta `@flusso:<id>` viene cercata in tutto il file della spec**, non solo nel titolo del test: un id nominato in un commento conta come copertura agli occhi del gate. La copertura resta quindi, in ultima istanza, una **dichiarazione dell'autore della spec** — falsificabile solo facendo fallire l'app per davvero.
- **Restano fuori i flussi che nessuno può automatizzare in sicurezza**: pagamenti reali, email vere, cancellazioni definitive. Vanno nell'elenco come flussi **non coperti** con il perché scritto nell'handoff, non omessi — un buco dichiarato si recupera, uno nascosto costa dieci volte tre agenti più a valle.

Ciò che chiude questi buchi non è un controllo in più su questo file: è **Cyber Shield**, che parte dai flussi ostili dichiarati e va a cercare le porte che nessuno ha dichiarato, e `/code-inquisition` sui punti critici. Qui si prova che la porta chiusa dal modello di accesso **resta** chiusa dal browser. Le porte che non compaiono in nessuna tabella sono un altro mestiere.
