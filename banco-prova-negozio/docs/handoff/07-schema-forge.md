# Handoff — Schema Forge

> Progetto: **Bottega Nord** (banco di prova di gestionale-crafter, e-commerce di maglieria).
> Generato eseguendo il Flusso 1 di Schema Forge il 2026-07-28.

## 1. Cosa ho fatto

- Migrazioni: `20260728120000_fondamenta.sql`, `20260728120100_catalogo.sql`, `20260728120200_ordini.sql`, `20260728120300_contenuti.sql`, `20260728120400_permessi_espliciti.sql`, `20260728130000_contenuti_corpo_expand.sql`, `20260728130100_contenuti_corpo_contract.sql`, `20260728160000_correzioni_tribunale.sql`
- Tabelle create: `staff`, `customers`, `categories`, `products`, `product_variants`, `orders`, `order_items`, `site_content`
- Tipi generati in: `src/lib/database.types.ts`
- Test pgTAP negativi: `supabase/tests/rls_negativi.test.sql` (20 asserzioni)

## 2. Modello assunto (Specchio del dominio)

Un negozio solo, con personale a ruoli (titolare, magazziniere, redattore) e clienti che
possono **non** avere un account: chi ordina per telefono non si registra e va servito lo
stesso. Il catalogo ha categorie, prodotti e varianti; prezzo e giacenza stanno sulla
**variante**, perché è ciò che si compra davvero. L'ordine è uno **snapshot**: nome
prodotto, nome variante, prezzo e indirizzo si copiano al momento dell'acquisto. Lo stato
dell'ordine è una macchina a stati (`in_attesa → confermato → spedito → consegnato`, più
`annullato`), vincolata **anche in `insert`** da trigger. I testi delle sezioni del sito
stanno in `site_content`: è la casa dei contenuti che sarebbero andati nel CMS, e la
modifica passa dal gestionale.

Confermato da: UMANO il 2026-07-28.

## 3. Modello di accesso (chi vede cosa)

| Tabella | anon | authenticated (cliente) | staff |
|---|---|---|---|
| `categories` | lettura se `is_visible` | idem | tutto |
| `products` | lettura se `is_published` | idem | tutto |
| `product_variants` | lettura se il prodotto è pubblicato | idem | tutto |
| `site_content` | lettura se `is_published` | idem | lettura sempre; scrittura al redattore e al titolare |
| `customers` | — | la propria riga (lettura e recapiti) | tutto tranne `delete` |
| `orders` | — | i propri, **sola lettura** | lettura, creazione, avanzamento di stato |
| `order_items` | — | le righe dei propri ordini, sola lettura | tutto |
| `staff` | — | — | la propria riga (`full_name`, `phone`, `is_active`); il titolare assume, corregge e licenzia |

Policy `using (true)` presenti: **nessuna**. Ogni lettura pubblica passa da una colonna
(`is_visible`, `is_published`) o da un `exists` sul prodotto padre.

**`ruolo` non è scrivibile da nessuno**: il `grant update` di `staff` è per colonna e non
la comprende. Si cambia solo con `public.cambia_ruolo(persona, nuovo)`, che verifica che
chi chiama sia titolare.

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| `customers.auth_user_id` facoltativo | `profiles.id = auth.users.id` | metà della clientela ordina per telefono e non si registrerà mai; con la chiave sull'utente non sarebbe rappresentabile |
| Giacenza come colonna di `product_variants` | tabella `inventory` con movimenti | un magazzino solo e nessuna riserva di carrello. Quando nasce il carrello persistito, serve la tabella |
| Ruolo cambiato da RPC | `grant update (ruolo)` al titolare | il `grant` è per ruolo Postgres, non per persona: concederlo al titolare lo concede a chiunque sia `authenticated` |
| `revoke all` prima di ogni `grant` | i soli `grant` | su Supabase i default privileges concedono già tutto ad `anon` e `authenticated`: senza il `revoke`, ogni `grant` è un no-op e il `grant` per colonna non restringe niente (misurato, §6) |

## 5. Cosa si aspetta chi viene dopo

- **Gestionale Crafter**: CRUD su `products`, `product_variants`, `categories`, `orders`
  (avanzamento di stato), `customers`, `site_content`, `staff`. Le entità gestibili sono
  queste otto: `order_items` si modifica dentro la vista dell'ordine, non da sola.
- Operazioni che **non** vanno fatte dal client:
  - cambio di `staff.ruolo` → `public.cambia_ruolo(persona, nuovo)`;
  - transizioni di stato illegali → le rifiuta il trigger, l'interfaccia deve offrire solo
    quelle ammesse (`in_attesa → confermato|annullato`, `confermato → spedito|annullato`,
    `spedito → consegnato`);
  - creazione dell'ordine da parte del cliente → nessuna policy la consente.

## 6. Residui di `verify` e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 9 passi) — rilanciato il 2026-07-28.

| Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| nota | il primo giro di migrazioni aveva il `grant` per colonna **senza** il `revoke` | su Supabase il permesso di tabella intera c'era già per default: il `grant` per colonna è additivo e non toglie niente. Trovato dal test pgTAP (il magazziniere si è promosso titolare), corretto con la migrazione `20260728120400` | chiuso |
| nota | `is_active` era fra le colonne concesse in `update` | non è un recapito: è l'interruttore che spegne una persona, e lo legge `e_staff()`. Chi veniva disattivato si riaccendeva da solo. Rilievo del tribunale, corretto con `20260728160000` (grant ristretto + RPC `cambia_stato_attivo`) | chiuso |
| nota | `personale_visibile_allo_staff` apriva l'intera riga di ogni collega a chiunque fosse staff | `phone` e `auth_user_id` non servivano a nessuno tranne al titolare, e l'applicazione era già più stretta. Corretto con `20260728160000` | chiuso |
| nota | i test pgTAP citavano `site_content.body` dopo l'`evolve` che l'aveva rinominata | dopo un `evolve` i test sono un consumatore come il codice: il gate li ha visti rossi al primo rilancio | chiuso |

Verifiche mancanti (strumenti non eseguiti): nessuna.
