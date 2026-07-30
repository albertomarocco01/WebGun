# Debito tecnico — Bottega Nord

Aperto il 2026-07-30, chiudendo i cinque difetti dell'handoff 12. Qui sta cio'
che **resta**: residui dichiarati, verifiche mancanti, scelte rimandate. Un
residuo che non e' scritto qui e nell'handoff non e' un residuo dichiarato, e
un gate verde con residui non scritti e' un gate che mente.

## 1. Verifiche MANCANTI (strumenti non eseguiti)

`code-maniac scan` chiude «0 passi con problemi, **6 saltati**». Uno strumento
assente vale **MANCANTE**, non `PASS`.

| Strumento | Cosa non stiamo verificando |
|---|---|
| Prettier | formattazione. ESLint copre la correttezza, non la forma |
| dependency-cruiser | **architettura**: nessuno verifica automaticamente che le dipendenze vadano in una direzione sola (`app` → `modules` → `lib`) e che non esistano cicli. Oggi e' vero perche' l'abbiamo guardato a mano |
| knip | **codice morto**. Le azioni orfane dell'handoff 12 §3.5 sono state trovate da una persona che leggeva, non da uno strumento. La prossima puo' sfuggire |
| jscpd | duplicati. `esigiRigaToccata` e' nata perche' sei copie della stessa condizione divergono — nessuno strumento l'aveva segnalato |
| gitleaks | **segreti**. E' l'unica difesa automatica contro una `service_role` finita nel bundle client. Oggi la difesa e' la prosa di `e2e/helpers/db.ts` e una revisione a mano |
| script convenzioni | non configurato per questo progetto |

**Rientro:** installarli come `devDependencies` del banco. Sono cinque
pacchetti; il motivo per cui non e' stato fatto oggi e' che nessuno l'ha
chiesto, non che non serva. `gitleaks` e `dependency-cruiser` sono i due che
mancano di piu'.

## 2. Difetti ridotti ma non chiusi

### 2.1 L'`id` nascosto e' ancora creduto sulla parola

`aggiornaProdotto`, `eliminaProdotto`, `aggiornaVariante`, `aggiornaContenuto`,
`aggiornaCliente` e `aggiornaRecapiti` ricevono l'`id` della riga da un
`<input type="hidden">`, cioe' dal client.

**Cosa e' migliorato il 2026-07-30:** `sku` e `size` non viaggiano piu' (erano
riscritti a ogni salvataggio), e tutte le scritture verificano quante righe
hanno toccato (`src/lib/scritture.ts`), quindi un `id` inventato non e' piu' un
successo silenzioso.

**Cosa resta:** nel modello mono-negozio dichiarato non e' un buco di
privilegio — ogni membro dello staff puo' legittimamente toccare ogni riga — ma
e' la classe di difetto che ne diventa uno il giorno in cui le sedi sono due.
`aggiornaRecapiti` e' l'unica che confronta il bersaglio con chi scrive.

**Rientro:** quando compare il secondo negozio, o quando Cyber Shield passa.

### 2.2 `error.tsx` esiste, ma nessun percorso di clic ci arriva

Il confine d'errore c'e' dal 2026-07-30. Nessuna spec lo attraversa, perche'
dall'interfaccia non c'e' modo di **provocare** un errore senza forgiare una
richiesta: le azioni offrono solo mosse legali. La pagina e' verificata a
vista, non dalla batteria.

### 2.3 Gli errori si mostrano su una pagina intera, non dentro il modulo

Le dodici azioni fanno `throw`, e l'utente perde la pagina su cui stava
lavorando. La forma giusta e' `useActionState` con l'errore accanto al campo, ma
vuol dire trasformare in componenti client tutti i moduli di tutte le viste:
e' una riscrittura, non una correzione. Decisione registrata in
`docs/handoff/13-gestionale-crafter.md` §3.3.

## 3. Fragilita' dell'ambiente

### 3.1 Il progetto si e' rotto da fermo

Il 2026-07-30, senza nessun commit, `service_role` ha perso `select/insert/
update/delete` su tutte le tabelle perche' la CLI Supabase e' passata da 2.95.4
a 2.110.0 e ha cambiato `alter default privileges`. Corretto scrivendo i
permessi (`20260730120000_permessi_service_role.sql`), ma la lezione e' piu'
larga: **la versione della CLI e dell'immagine Postgres non e' versionata da
nessuna parte in questo progetto.**

**Rientro:** fissare la versione della CLI (campo `[project] ... ` di
`supabase/config.toml` o un `packageManager`/devDependency) cosi' che un
aggiornamento sia una decisione e non un evento.

### 3.2 `[auth].site_url` dichiara la 3000, l'app gira sulla 3001

Su questa macchina la 3000 e' occupata da un altro progetto e Next sposta
l'app senza chiedere. Il gate dei flussi va lanciato con `--url`. Dal 2026-07-30
la batteria eredita l'URL che il gate ha misurato, quindi un'app sbagliata
produce un rosso rumoroso invece di un verde silenzioso.

### 3.3 `NEXT_PUBLIC_SITE_URL` decide il canonical, e non e' impostata

Dal 2026-07-30 ogni pagina dichiara il proprio `canonical`, risolto contro
`metadataBase`. Se quella variabile non e' impostata in produzione, il sito
pubblicato dichiara come canonico `http://127.0.0.1:3000` e regala la propria
autorita' a un indirizzo che non esiste. **Prima non serviva a niente; da oggi
e' la differenza fra un sito indicizzato e uno che chiede di non esserlo.**
Va verificata sull'HTML servito dal dominio vero, non nel sorgente.
Vedi `docs/handoff/15-speed-demon.md` §6.

### 3.4 `sitemap.ts` e `robots.ts` non esistono

Rimandati, non rifiutati: con due pagine il guadagno e' teorico, ma vanno
scritti prima di pubblicare su un dominio vero. Nessun passo di gate li
controlla — il gate di Speed Demon guarda i metatag di pagina e ignora i due
file che dicono a un motore di ricerca *cosa esiste*.

### 3.5 `auth.identities` c'e', nessun provider esterno e' configurato

Il seed scrive l'identita' `email` di ogni utente dal 2026-07-30. Nessun OAuth
e' configurato, quindi il percorso che quelle righe servono non e' mai stato
percorso.

## 4. Residui ereditati, ancora aperti

| Da | Cosa |
|---|---|
| `db advisors` | `multiple_permissive_policies` su 10 tabelle — **WARN**, non bloccante: piu' policy permissive sulla stessa azione costano in lettura. Preesistente all'handoff 07 |
| handoff 12 §Flussi assunti | carrello e checkout non esistono in questo progetto; il ramo `is_active = false` non ha percorso da browser; la transizione di stato illegale si prova solo forgiando la POST |
