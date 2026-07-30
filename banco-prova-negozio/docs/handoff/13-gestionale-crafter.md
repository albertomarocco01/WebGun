# Handoff — Gestionale Crafter (secondo passaggio)

> Progetto: **Bottega Nord**. Data: 2026-07-30.
> Non e' una costruzione nuova: e' la chiusura dei cinque difetti che
> `docs/handoff/12-flow-sentinel.md` §3 aveva riportato **senza correggerli**,
> perche' un verificatore che ripara cio' che verifica smette di essere un
> verificatore. Il fix e' dei costruttori, e questo e' il passaggio in cui i
> costruttori lo fanno.
>
> Leggere prima: `07-schema-forge.md`, `10-gestionale-crafter.md`,
> `12-flow-sentinel.md`.

## 1. Cosa ho fatto

### 1.1 Il menu prometteva le sezioni che la guardia negava (§3.2) — chiuso

La causa non era il menu: erano **due elenchi**. Uno costante dentro
`src/app/admin/layout.tsx`, uno sparso nelle chiamate a `richiediRuolo(...)` in
cima a ogni pagina. Due elenchi che descrivono la stessa cosa divergono, e
questi erano divergenti dal primo giorno.

Ora la fonte e' una: `SEZIONI` in `src/modules/admin/guardia.ts`, sei voci con
`href`, `testo` e `ruoli` (`null` = «basta essere staff»).

- il layout chiama `sezioniPer(persona.ruolo)` e rende solo quelle;
- le pagine chiamano `richiediSezione("/admin/contenuti")` invece di ripetere a
  mano i ruoli ammessi.

`richiediSezione` **lancia** su un href sconosciuto invece di lasciar passare:
una sezione fuori elenco e' un errore di programmazione, e il caso peggiore va
chiuso.

### 1.2 Il rifiuto era muto (§3.2, seconda meta') — chiuso

`richiediRuolo` rimandava a `/admin?motivo=ruolo-insufficiente` e `/admin` non
leggeva `searchParams`: la porta si chiudeva e la pagina non diceva perche'. Ora
`src/app/admin/page.tsx` legge il motivo e lo traduce con una tabella di
messaggi (`MOTIVI`), nella stessa forma che `/accedi` usava gia' per
`non-autorizzato` — `role="status"`, testo rosso.

**Il link tolto non e' la difesa**: la rotta si raggiunge scrivendola, e la
guardia server e' rimasta dov'era. Le due meta' sono asserite insieme nella
spec (vedi handoff 14).

### 1.3 Nessun `error.tsx` in tutto il progetto (§3.3) — chiuso

`src/app/error.tsx`, componente client, al livello piu' alto: cattura tutto cio'
che sta sotto `app/`.

**`error.message` non si mostra.** In produzione Next lo sostituisce comunque
con un `digest`; in sviluppo sarebbe il messaggio grezzo di Postgres, cioe' i
nomi delle tabelle regalati a chi ha appena forzato una POST. A schermo va la
frase stabile piu' il `digest`, che serve a ritrovare la riga nei log.

### 1.4 Campi nascosti creduti sulla parola (§3.4) — chiuso in due mosse

**Prima mossa.** `aggiornaVariante` non scrive piu' `sku` e `size`, e i due
`<input type="hidden">` che li portavano sono spariti dalla pagina. Il modulo
offre prezzo e giacenza: sono quelli che scrive. Cio' che non si modifica non si
rimanda indietro.

**Seconda mossa.** Tutte le scritture verificano quante righe hanno toccato.
`avanzaOrdine` era l'unica che lo faceva; ora la regola sta in
`src/lib/scritture.ts` (`esigiRigaToccata`) e la usano in otto:
`aggiornaProdotto`, `eliminaProdotto`, `aggiornaVariante`, `aggiornaContenuto`,
`aggiornaCliente`, `aggiornaRecapiti`, piu' `avanzaOrdine` che e' stata
riscritta per usarla invece della sua copia.

Un `id` inesistente non e' piu' un successo silenzioso: e' un errore, e adesso
ha anche dove atterrare (§1.3).

### 1.5 Due azioni server orfane (§3.5) — chiuse in due modi diversi

| Azione | Scelta | Perche' |
|---|---|---|
| `aggiornaCliente` | **collegata** | Correggere un recapito preso al telefono e' la cosa che in un negozio succede piu' spesso. La vista c'e': `/admin/clienti`, un modulo per riga, nella stessa forma di `/admin/personale`. Ha anche una spec (handoff 14, flusso `modifica-cliente`). |
| `creaContenuto` | **tolta** | Creava una riga con uno `slot` nuovo, e gli slot li nomina il codice del sito (`home-hero` in `src/app/page.tsx`). Uno slot che nessuna pagina rende e' una riga morta con un endpoint aperto davanti. Il giorno in cui il sito avra' slot dinamici si riscrive, con la sua vista e la sua spec. |

Verificato: ogni azione esportata da `src/modules/**` e' importata da almeno una
vista. Zero orfane.

### 1.6 `gestionale.config.json`

Aggiunto `richiediSezione` all'elenco `guardie`. L'audit non indovina i nomi
delle guardie — li legge dalla configurazione — e ha fatto bene a chiudere
`[block]` finche' quel nome non c'era: un nome sconosciuto in cima a un'azione
non e' una guardia, e' una funzione qualsiasi.

## 2. Esito dei gate

| Gate | Esito |
|---|---|
| `gestionale-crafter/scripts/verify.mjs` | **VERDE 7/7** — 8 rotte, 6 azioni server, 9 scritture, 0 issue 0 warn |
| `schema-forge/scripts/verify.mjs` | **VERDE 9/9** — 9 migrazioni + seed |
| `flow-sentinel/scripts/verify.mjs --url http://127.0.0.1:3001` | **VERDE 7/7** — 11 flussi, 16 test |
| `code-maniac scan` | 0 passi con problemi, **6 saltati** (vedi `docs/DEBITO-TECNICO.md`) |

`tsc --noEmit` e `npm run lint`: puliti.

## 3. Decisioni prese, con la motivazione

1. **Una sola `SEZIONI`, non due elenchi che si assomigliano.** Il difetto non
   era un menu sbagliato: era che menu e guardia erano copie. Filtrare il menu
   senza unificare la fonte avrebbe rimesso in piedi lo stesso difetto al primo
   ruolo nuovo.
2. **`error.tsx` alla radice e non uno per sezione.** Un solo file copre tutto
   `app/`. Un confine dedicato sotto `/admin` terrebbe in piedi il menu durante
   l'errore, ed e' un miglioramento vero — ma e' un secondo file per un
   guadagno di aspetto, e il difetto riportato era l'assenza di **qualunque**
   testo d'errore.
3. **Nessun passaggio a `useActionState`.** Sarebbe la forma giusta per mostrare
   l'errore *dentro* il modulo invece che su una pagina intera, ma vuol dire
   trasformare in componenti client tutti i moduli di tutte le viste. E' una
   riscrittura, non una correzione: resta nel debito tecnico.
4. **`creaContenuto` tolta invece che collegata.** Vedi §1.5. Cancellare e'
   preferibile ad aggiungere una vista che nessuno ha chiesto per creare righe
   che nessuna pagina mostra.
5. **`esigiRigaToccata` in `src/lib` e non in ogni modulo.** Sei copie della
   stessa condizione divergono come divergevano i due elenchi delle sezioni. La
   direzione delle dipendenze resta quella dichiarata: `modules` → `lib`.

## 4. Cosa si aspetta chi viene dopo

- **Flow Sentinel** ha gia' rilanciato: handoff 14. La spec che fissava il menu
  non filtrato e' stata riscritta — era stata scritta prevedendo per iscritto il
  giorno in cui sarebbe diventata rossa.
- **Cyber Shield**: §3.4 dell'handoff 12 e' **ridotto, non chiuso**. `sku` e
  `size` non viaggiano piu' e le righe toccate si contano, ma l'`id` arriva
  ancora dal client su sei scritture. Serve una POST forgiata per provarlo, e
  quello e' il tuo mestiere.
- **Speed Demon**: `/admin/clienti` ora rende un modulo per riga. Su
  un'anagrafica vera e' il primo posto che diventa lento.

## 5. Problemi noti

Tutti in `docs/DEBITO-TECNICO.md`. In breve: sei strumenti di `code-maniac` non
installati in questo progetto (**MANCANTI**, non `PASS`); nessun percorso di
clic raggiunge `error.tsx`; l'`id` nascosto resta creduto sulla parola.
