# Modello di riferimento — e-commerce

Il caso d'uso n°1 di Web Gun. **Non è un template da copiare**: è la mappa delle decisioni che si ripetono, con la motivazione. Il modello vero nasce sempre dal brief del cliente.

## Le entità e le decisioni che contano

### Catalogo

```
categories        albero (parent_id nullable) o tag piatti — decidere PRIMA: cambiarlo dopo è una migrazione dolorosa
products          il concetto commerciale: nome, descrizione, slug unico, is_published
product_variants  ciò che si compra davvero: taglia/colore, SKU unico, price_cents (bigint), barcode
product_images    ordinate (position), con alt_text obbligatorio (serve a Site Doctor per l'accessibilità)
```

**Decisione chiave: prodotto ≠ variante.** Anche un catalogo che oggi non ha taglie le avrà. Il prezzo e la giacenza stanno sulla **variante**, non sul prodotto: metterli sul prodotto e spostarli dopo significa riscrivere ogni query, ogni componente e ogni riga di storico.

### Inventario

```
inventory   variant_id, quantity, reserved_quantity
```

La giacenza è una colonna sulla variante solo se il magazzino è uno solo e non ci sono prenotazioni. Appena esistono carrello con riserva o più magazzini, serve una tabella separata con movimenti. La quantità **non si aggiorna con un `update` dal client**: è un'operazione transazionale che vive in una funzione del database, o vendi due volte l'ultimo pezzo.

### Clienti

```
profiles    id references auth.users(id) — dati applicativi dell'utente
addresses   più indirizzi per utente, con is_default; MAI un solo indirizzo sul profilo
```

Supabase possiede l'identità in `auth.users`: `profiles` la estende, non la duplica. Email e password non si copiano.

### Ordini — dove si sbaglia di più

```
orders       user_id (on delete restrict!), status, total_cents (bigint),
             indirizzi COPIATI, created_at
order_items  order_id, variant_id (on delete restrict), quantity,
             unit_price_cents (bigint), product_name, variant_name, tax_rate   ← snapshot
payments     order_id, provider, provider_reference, amount_cents (bigint), status
```

**Ogni `*_cents` è `bigint`**, mai `integer`: in centesimi `integer` si ferma a 21.474.836,47 € e il totale di un anno lo supera. Vedi `modellazione.md`, riga *Denaro*.

**Regola d'oro: l'ordine è uno snapshot, non una vista sul catalogo.** Prezzo, nome prodotto, nome variante e aliquota si **copiano** dentro `order_items` al momento dell'acquisto, e l'indirizzo di spedizione si copia dentro `orders`. Se leggi questi dati per riferimento, quando il cliente cambia listino o l'utente modifica l'indirizzo **cambi retroattivamente gli ordini passati**: fatture sbagliate, contabilità sbagliata, contestazioni. È l'unica denormalizzazione obbligatoria del modello.

**`on delete restrict` sugli ordini**, mai `cascade`: un utente che cancella l'account non può cancellare la storia fiscale. Per il GDPR si anonimizza il profilo, non si distrugge l'ordine (e questo va scritto nell'handoff, perché riguarda Site Doctor).

**Lo stato dell'ordine è una macchina a stati**, non un testo libero: `pending → paid → shipped → delivered`, più `cancelled` / `refunded`. Valori vincolati con `check`, transizioni illegali bloccate da trigger.

### Carrello

Due strade, da decidere nello Specchio: **carrello lato client** (localStorage, zero tabelle, si perde cambiando dispositivo) oppure **carrello persistito** (`carts` + `cart_items`, serve anche all'utente anonimo tramite un token di sessione). Non è un dettaglio implementativo: cambia lo schema e cambia la RLS.

## Modello di accesso tipico (input diretto per le policy)

| Tabella | anon | authenticated | staff/admin |
|---|---|---|---|
| `products`, `product_variants`, `categories`, `product_images` | lettura se `is_published` | idem | tutto |
| `inventory` | nessun accesso diretto (esporre semmai una vista "disponibile sì/no") | idem | tutto |
| `profiles`, `addresses` | — | solo le proprie righe | lettura |
| `orders`, `order_items` | — | solo i propri, **sola lettura** dopo la creazione | tutto |
| `payments` | — | lettura dei propri | tutto |

Gli ordini **non si modificano dal client**: la creazione passa da una funzione del database o dal server (che valida prezzi e giacenza), altrimenti il prezzo lo decide il browser dell'utente. È il singolo errore più costoso di un e-commerce generato in fretta.

## Cosa lasciare fuori al primo giro (YAGNI)

Coupon e promozioni, multi-valuta, multi-lingua dei contenuti, resi e RMA, punti fedeltà, recensioni, wishlist. Ognuna è una tabella che nasce quando il cliente la chiede — con una nota nell'handoff su come si aggancerebbe, così Gestionale Crafter non progetta l'interfaccia su un modello che non esiste.
