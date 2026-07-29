# Handoff — Gestionale Crafter

> Progetto: **Bottega Nord** (banco di prova di gestionale-crafter, e-commerce di maglieria).
> Costruito il 2026-07-28 sopra `docs/handoff/07-schema-forge.md`.

## 1. Cosa ho fatto

- Radice del gestionale: `src/app/admin` (dichiarata in `gestionale.config.json`)
- Viste generate: `prodotti` (elenco, scheda, varianti), `categorie`, `ordini` (avanzamento di stato), `clienti`, `contenuti`, `personale`
- Moduli di dominio: `src/modules/catalogo`, `src/modules/ordini`, `src/modules/clienti`, `src/modules/contenuti`, `src/modules/personale`, `src/modules/admin` (guardia e accesso)
- Porta d'ingresso: `src/app/accedi` — l'unica rotta pubblica del gestionale, dichiarata come tale
- Contenuti editabili dal cliente: `site_content` (i testi delle sezioni del sito, l'eredità del CMS che la pipeline non ha più)

## 2. Modello assunto

Un negozio solo. Tre ruoli: **titolare** (tutto, compreso il personale), **magazziniere**
(catalogo e ordini), **redattore** (contenuti del sito). I clienti possono non avere un
account — chi ordina per telefono lo registra lo staff. Il ruolo si legge dalla tabella
`staff`, che l'utente non può riscrivere: il `grant update` è per colonna e `ruolo` non
c'è dentro.

Confermato da: UMANO il 2026-07-28.

| Assunzione | Default | Conseguenza se è sbagliata |
|---|---|---|
| il gestionale è mono-negozio | nessun filtro d'ambito oltre alla RLS | con più sedi ogni query va riscritta con l'ambito **dentro** la condizione, non accanto |
| i contenuti sono i campi delle sezioni previste | niente costruttore di pagine | se il cliente vuole creare pagine nuove servono tabelle nuove, e le scrive schema-forge |
| il magazzino è una colonna sulla variante | nessuna riserva di carrello | col carrello persistito serve una tabella di movimenti |

## 3. Entità gestite ed entità escluse

| Tabella | Vista | Chi può scrivere |
|---|---|---|
| `products` | `prodotti` | staff |
| `product_variants` | `prodotti` (dentro la scheda) | staff |
| `categories` | `categorie` | staff |
| `orders` | `ordini` (solo avanzamento di stato) | staff |
| `customers` | `clienti` | staff |
| `site_content` | `contenuti` | redattore e titolare |
| `staff` | `personale` | titolare (il ruolo solo via `cambia_ruolo`) |

Escluse **con motivazione**:

| Tabella | Perché il cliente non la gestisce |
|---|---|
| `order_items` | Le righe non hanno vita propria: si vedono e si correggono dentro la scheda dell'ordine, che è l'unico posto in cui il totale ha senso. Una vista separata inviterebbe a modificarle senza l'ordine davanti. |

## 4. Decisioni e deroghe

| Decisione | Alternativa scartata | Perché |
|---|---|---|
| componenti Tailwind scritti a mano in `src/components/ui` | Fly UI | `agenti/fly-ui` non esiste. I tre file dell'interfaccia sono la **cucitura**: quando la libreria arriverà si riscrive il loro corpo, non le pagine |
| il ruolo si legge da `staff` a ogni richiesta | claim nel JWT | una revoca di ruolo vale subito, non dal token successivo |
| il cambio di ruolo passa da `cambia_ruolo` (RPC) | un campo in più nel modulo dei recapiti | il `grant` per colonna nega la scrittura di `ruolo`: un modulo unico prenderebbe *permission denied* sull'intera riga — e se il permesso ci fosse, sarebbe auto-promozione |
| le transizioni di stato sono elencate anche nell'interfaccia | lasciare fare al trigger | la difesa resta del database; l'interfaccia evita di offrire un pulsante che porta a un errore incomprensibile |

Deroghe alla costituzione registrate in `docs/DEBITO-TECNICO.md`: la sostituzione di Fly UI (rientro: quando l'agente esiste).

## 5. Cosa si aspetta chi viene dopo

- **Flow Sentinel**: i flussi da coprire sono accesso → cruscotto, creazione prodotto, avanzamento di un ordine, modifica di un contenuto, cambio di ruolo. Utenti di prova nel seed: `titolare@bottreganord.it`, `magazzino@bottreganord.it`, `redazione@bottreganord.it` (password `password123`).
- **Cyber Shield**: la superficie critica è `src/modules/admin/guardia.ts`, le sei azioni server e la funzione `public.cambia_ruolo`.
- Cose che **non** vanno fatte dal client: cambio di ruolo (RPC), transizioni di stato illegali (le rifiuta il trigger), creazione di ordini da parte del cliente (nessuna policy la consente).

## 6. Richieste rimaste aperte verso schema-forge

| Cosa serve | Perché | Stato |
|---|---|---|
| `revoke all` prima di ogni `grant` sulle tabelle nuove | su Supabase i default privileges concedono già tutto ad `anon` e `authenticated`: senza `revoke`, il `grant update` per colonna non restringe niente e il gestionale può scrivere `ruolo` | **chiusa** il 2026-07-28 con la migrazione `20260728120400_permessi_espliciti.sql` |
| rinomina `site_content.body` → `corpo` | coerenza con il resto del dominio | **chiusa** con `evolve` in expand-contract (`20260728130000`, `20260728130100`) |

## 7. Residui del gate e problemi noti

**Gate: VERDE** (0 falliti, 0 verifiche mancanti su 7 passi) — rilanciato il 2026-07-28.

| Gravità | Cosa | Perché resta | Rientro previsto |
|---|---|---|---|
| nota | i componenti dell'interfaccia sono scritti a mano | Fly UI non esiste ancora | alla nascita di `agenti/fly-ui` |
| nota | dopo un `evolve` che cancella una rotta, `tsc` può fallire su tipi rimasti in `.next/types/` | è cache di Next, non codice | `rm -rf .next` prima del gate |

Verifiche mancanti (strumenti non eseguiti): nessuna.

**Cosa il gate verde non dimostra**: `agenti/gestionale-crafter/SKILL.md` §Cosa un gate verde NON dimostra. In breve: che ogni rotta abbia una guardia non dice che la guardia chieda il ruolo *giusto* per quel dominio. L'adversariale su auth e permessi si fa a mano con `/code-inquisition`.
