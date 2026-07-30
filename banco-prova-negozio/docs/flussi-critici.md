# Flussi critici — Bottega Nord

Contratto della batteria End-to-End: l'elenco dei flussi che non possono
rompersi. Ogni flusso qui dentro ha un id stabile e almeno una spec che lo
attacca — il passo `spec-coverage` del gate e' rosso se non e' cosi'.

Confermato da: ORCHESTRATORE (2026-07-30)

> Modalita' **pipeline**: conferma l'orchestratore, non l'umano. Nessuno di
> questi flussi muove denaro vero, manda comunicazioni a persone o cancella
> dati di produzione — il banco e' locale e i dati sono di seed — quindi non
> scatta la risalita all'umano prevista dalla SKILL. **L'elenco resta un elenco
> assunto**: la conferma umana e' il solo modo di sapere che non manca un
> flusso, e non e' automatizzabile. Vedi §Flussi assunti e non coperti.

> **Secondo giro dello Specchio, stessa giornata.** L'elenco e' nato con dieci
> flussi. L'undicesimo — `modifica-cliente` — e' entrato dopo, quando
> `aggiornaCliente` ha smesso di essere un'azione orfana e ha preso la sua
> vista. **Lo Specchio e' stato rifatto solo su quello**, come prescrive
> `evolve`: gli altri dieci non sono stati rimessi in discussione, perche'
> riconfermare tutto a ogni giro trasforma la firma in un'abitudine e
> un'abitudine non conferma niente. Confermato dall'orchestratore il
> 2026-07-30, insieme al primo elenco.

Gli ostili sono derivati dalla tabella «Modello di accesso (chi vede cosa)» di
`docs/handoff/07-schema-forge.md` §3: ogni «—» delle colonne `anon` e
`authenticated` e' un attacco in lettura, e ogni «sola lettura» e' un attacco in
scrittura sulla stessa cella. Il vincolo di ruolo dentro lo staff
(contenuti al redattore, personale al titolare) viene invece da
`docs/handoff/10-gestionale-crafter.md` §3.

## `accesso-staff` — positivo

1. Da anonimo, apri `/accedi`.
2. Compila «Email» e «Password» con le credenziali del titolare del seed.
3. Premi «Entra».
4. Attendi il cruscotto: intestazione «Gestionale».

**Effetto atteso sul database:** `auth.users.last_sign_in_at` del titolare
avanza rispetto al valore letto prima del passo 1 — la sessione l'ha emessa il
server di Auth, non il browser. E' anche la sola misura della premessa su cui
poggiano tutti gli altri flussi autenticati: se il seed produce utenti con cui
non si entra, questo flusso e' il primo a dirlo.

## `crea-prodotto` — positivo

1. Con la sessione del magazziniere, apri `/admin/prodotti`.
2. Compila «Nome», «Slug», scegli una «Categoria», spunta «Pubblicato».
3. Premi «Crea».
4. Attendi che la riga compaia in tabella.

**Effetto atteso sul database:** esiste una riga di `products` con quello slug,
`is_published = true`, e il conteggio dei prodotti e' quello di prima piu' uno.
La spec cancella la riga alla fine, cosi' il flusso e' rilanciabile senza
`supabase db reset`.

## `avanza-ordine` — positivo

1. Con la sessione del magazziniere, apri `/admin/ordini`.
2. Sulla riga dell'ordine in `in_attesa`, scegli «confermato» in «Nuovo stato».
3. Premi «Avanza».

**Effetto atteso sul database:** `orders.status` dell'ordine di collaudo passa
da `in_attesa` a `confermato`. E' la macchina a stati vincolata dal trigger:
l'unica scrittura del gestionale che verifica quante righe ha toccato.

## `modifica-contenuto-home` — positivo

1. Con la sessione del redattore, apri `/admin/contenuti`.
2. Cambia il «Titolo» dello slot `home-hero`.
3. Premi «Salva».
4. Da anonimo, apri `/`.

**Effetto atteso sul database:** `site_content` dello slot `home-hero` ha il
nuovo titolo e resta pubblicato; la home servita all'anonimo mostra quel
titolo nell'intestazione. La spec ripristina il titolo originale.

## `cambio-ruolo-titolare` — positivo

1. Con la sessione del titolare, apri `/admin/personale`.
2. Nella scheda del magazziniere scegli «Redattore» in «Ruolo».
3. Premi «Cambia ruolo».

**Effetto atteso sul database:** `staff.ruolo` del magazziniere vale
`redattore`, scritto dall'RPC `cambia_ruolo` — l'unica strada consentita, visto
che il `grant update` per colonna non comprende `ruolo`. La spec ripristina
`magazziniere`.

## `modifica-cliente` — positivo

1. Con la sessione del magazziniere, apri `/admin/clienti`.
2. Nel modulo del cliente senza account (Pietro Gallo), cambia il «Telefono».
3. Premi «Salva i recapiti».

**Effetto atteso sul database:** `customers.phone` di quella riga vale il nuovo
numero e `full_name` **non** e' cambiato. Il flusso nasce il 2026-07-30 insieme
alla vista che lo rende percorribile: `aggiornaCliente` esisteva senza che
nessuna pagina la importasse — un endpoint POST senza porta davanti — ed era
elencata qui sotto fra i non coperti. La spec ripristina il numero del seed.

## `admin-negato-anon` — ostile-lettura

1. Senza nessuna sessione, naviga su `/admin`, `/admin/clienti` e
   `/admin/personale`.

**Rifiuto atteso:** ogni navigazione finisce su `/accedi`, e il **corpo della
risposta di navigazione** non contiene «Gestionale», «Anna Rossi» ne'
«Giulia Ferrero». Si asserisce sul corpo e non sul DOM: se il rifiuto lo
decidesse il browser, l'HTML riservato sarebbe gia' stato servito e ogni
`getByText` lo troverebbe pulito (misurato al collaudo del 2026-07-28 sul banco
palestra). Non c'e' effetto sul database da confrontare.

## `cliente-non-e-staff` — ostile-lettura

1. Accedi da `/accedi` con le credenziali della cliente Anna Rossi, che ha un
   account ma nessuna riga in `staff`.
2. Naviga su `/admin`.

**Rifiuto atteso:** l'URL finale e' `/accedi?motivo=non-autorizzato` col
messaggio «Questo account non appartiene al personale del negozio.», e il corpo
servito per `/admin` non contiene «Gestionale». Un account valido non e' un
account autorizzato.

## `sezioni-di-ruolo-negate-al-magazziniere` — ostile-lettura

1. Con la sessione del magazziniere, naviga su `/admin/contenuti` e
   `/admin/personale` — le due sezioni riservate ad altri ruoli.
2. Torna su `/admin` e guarda il menu.

**Rifiuto atteso:** entrambe le navigazioni finiscono su `/admin` e il corpo
servito non contiene «Contenuti del sito», «Personale del negozio», «Sara Conti»
ne' «0161 000001». Il menu offre le quattro voci che quel ruolo puo' aprire e
**non** le due che gli sono negate, e il cruscotto raggiunto per rifiuto scrive
il perche' («non e' aperta al tuo ruolo»).

Dal 2026-07-30 le due meta' si asseriscono insieme, e non e' pignoleria: il link
sparito **non e' la difesa** — la rotta si raggiunge scrivendola — quindi la
spec finisce sempre bussando alla porta. Fino a quel giorno il menu era una
lista fissa che offriva a ogni ruolo anche cio' che la guardia negava, e
`/admin` non leggeva `searchParams`: il rifiuto era corretto e **muto**.

## `ruolo-non-scrivibile-dal-magazziniere` — ostile-scrittura

1. Ottieni un token vero del magazziniere (chiave anonima, non amministrativa).
2. Con quel token, chiedi a PostgREST di scrivere `staff.ruolo = 'titolare'`
   sulla propria riga, e `is_active = false` sulla riga del titolare.
3. Chiama l'RPC `cambia_ruolo` con lo stesso token.

**Rifiuto atteso:** le due scritture dirette rispondono `42501`
(«permission denied for table staff»: il `grant update` per colonna comprende
solo `full_name` e `phone`) e l'RPC risponde `P0001` «solo il titolare cambia i
ruoli» **e** database invariato: il magazziniere e' ancora `magazziniere` e il
titolare e' ancora attivo. E' l'auto-promozione che il collaudo di
gestionale-crafter aveva gia' visto riuscire una volta.

## `ordine-non-creabile-dal-cliente` — ostile-scrittura

1. Ottieni un token vero della cliente Anna Rossi (chiave anonima).
2. Con quel token, prova a inserire una riga in `orders` a proprio nome, e a
   portare un ordine esistente a `consegnato`.

**Rifiuto atteso:** l'inserimento e' respinto dalla RLS (`42501`, nessuna
policy consente al cliente di creare ordini) e l'aggiornamento tocca **zero
righe** **e** database invariato: il conteggio degli ordini e' quello di prima e
lo stato dell'ordine non e' cambiato. Un rifiuto che non lascia errore ma non
scrive e' comunque un rifiuto, e va misurato sul database.

## Flussi assunti e non coperti

Scritti perche' un flusso critico dimenticato resti leggibile invece di
sparire. Nessuno di questi ha una spec, e il gate non li conta.

| Non coperto | Perche' |
|---|---|
| Carrello e checkout | **Non esistono in questo progetto**: `src/app` ha solo `/`, `/accedi` e `/admin/*`. Gestionale Crafter ha costruito il backoffice, non la vetrina. Il flusso piu' tipico di Flow Sentinel qui non e' rimandato: non c'e'. |
| Persona con riga `staff` ma `is_active = false` | Il seed non ha nessuno disattivato e nessuna vista chiama `cambia_stato_attivo`: il secondo ramo del rifiuto di `richiediStaff` non ha percorso da browser. Buco reale, segnalato dal critico di completezza. |
| POST forgiata su un campo nascosto | **Classe ridotta, non chiusa**, il 2026-07-30: `aggiornaVariante` non scrive piu' `sku` e `size` (non viaggiano piu' nel modulo) e tutte e otto le scritture verificano quante righe hanno toccato, quindi un `id` inventato non e' piu' un successo silenzioso. Resta che l'`id` arriva dal client: per provarlo servirebbe forgiare la POST, che non e' un clic. |
| Errore di un'azione server visto a schermo | `src/app/error.tsx` esiste dal 2026-07-30, quindi un errore ora atterra su una pagina con un testo. Ma dall'interfaccia non c'e' modo di **provocare** un errore senza forgiare una richiesta: nessun percorso di clic porta li'. La pagina c'e', il flusso per raggiungerla no. |
| Transizione di stato illegale dall'interfaccia | Il `select` offre solo le mosse legali e il form sparisce quando non ce ne sono: il rifiuto si puo' provare solo forgiando la POST. La difesa e' comunque doppia (azione + trigger) ed e' coperta dai test pgTAP di schema-forge. |
