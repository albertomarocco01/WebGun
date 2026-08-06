# `evolve` sul pilota — i due debiti verso monte (P.4f)

Progetto: **Forno d'Oro** (`C:\Users\Utente\Desktop\fornodoro`). Data: **2026-08-06**.
Pacchetto **P.4f**, decisioni **D8, D13, D14, D15**. Modello: Opus 5, effort high.

È il **primo `evolve` di schema-forge su un progetto vero**: quattro anelli
costruiti sopra lo schema, cinque gate verdi, un verbale di catena chiuso il
giorno prima. Il collaudo del comando è in §8, ed è la sezione che nessuno aveva
mai potuto scrivere.

## 1. Le scelte autonome (regime D14: nessuna domanda al committente)

| # | Scelta | Alternativa scartata | Perché |
|---|---|---|---|
| 1 | **`ritiro_at` diventa `text`**, validato e convertito dentro il corpo | una funzione nuova che validasse a monte, lasciando in piedi `crea_ordine(… timestamptz …)` | la vecchia firma resterebbe chiamabile da `anon`: il difetto resterebbe aperto per chiunque non passi dalla porta nuova. È la stessa trappola in cui era caduta la mitigazione lato sito («mitigato, NON chiuso») |
| 2 | **Il nome dell'argomento non cambia** | `ritiro_at_text`, o un nome nuovo | PostgREST lega per nome: cambiarlo romperebbe due consumatori per un guadagno estetico. Misurato: il corpo della richiesta HTTP e la riga di `database.types.ts` sono **identici** prima e dopo |
| 3 | **`drop function` + `create`**, nella stessa transazione | `create or replace` | non può cambiare il tipo di un argomento: creerebbe un **overload**, e due `crea_ordine` con gli stessi nomi di parametro lascerebbero PostgREST senza modo di scegliere. Nessun dato distrutto, nessun istante in cui la funzione non c'è |
| 4 | **L'offset diventa obbligatorio** (`Z` o `±HH:MM`) | accettare anche `2026-08-07 20:00:00` | questo server è in **UTC** (`show timezone`): «20:00» senza offset diventerebbe le 22:00 in pizzeria, senza un errore da nessuna parte. Fra rifiutare una forma ambigua e accettarla sbagliata di due ore, si rifiuta |
| 5 | **Due strati di validazione, con messaggi diversi** | solo il controllo di forma | `2026-02-30T10:00:00.000Z` è scritta benissimo e non esiste: misurato `22008`. I messaggi sono diversi perché un test possa provare **uno strato per volta** — con un solo messaggio, togliere il primo strato lascerebbe l'asserzione verde |
| 6 | **La policy di `insert` si toglie**, non si restringe | lasciarla e revocare solo il privilegio | l'audit RLS della skill (regola 7) è un **`block`** su una policy che promette a un ruolo del client un accesso che il `grant` non concede: il progetto resterebbe rosso per sempre. Il rimedio è scritto dall'audit stesso: «si toglie la policy» |
| 7 | **`service_role` conserva `insert` e `update`** | revocarglieli | è con quella chiave che si assume qualcuno (D2 dello Specchio del gestionale, firmata: «gli account li creiamo noi»), e sul `ruolo` non apre niente: il trigger chiama `e_titolare()`, falsa per quella chiave perché `auth.uid()` è `null` |
| 8 | **`delete` resta ad `authenticated`** | revocarlo per simmetria | il mandato chiede due metà e questa sarebbe una terza; toglierlo cambierebbe il modello di accesso firmato nell'handoff 07 §3 («titolare: tutto»). La conseguenza — la porta gira in un senso solo — è **dichiarata**, non scoperta da chi cancella |
| 9 | **`cambia_ruolo` valida da sé, con messaggi propri**, e il trigger resta come rete | delegare l'autorizzazione al solo trigger | il trigger scatta **solo se `ruolo` cambia davvero**: su una chiamata che riscrive lo stesso ruolo non vede niente, e la funzione diventerebbe una sonda dell'esistenza di righe che la RLS non lascia leggere (bypassa la RLS: il proprietario ha `rolbypassrls`). Provato per sabotaggio |
| 10 | **NESSUN `if` che vieti di declassare l'ultimo titolare** | scriverlo «per sicurezza» | sarebbe **irraggiungibile**: chi chiama è un titolare attivo e non può essere il bersaglio, quindi dopo ogni declassamento riuscito chi l'ha fatto è ancora un titolare attivo. Nessun test potrebbe farlo diventare rosso, e la guida di questa skill dice che un'asserzione che non può fallire non è un'asserzione. L'invariante è provato **per derivazione**, e la riga che sa diventare rossa è quella sulla propria riga |
| 11 | **Il nome è `cambia_ruolo(persona uuid, nuovo_ruolo text)`** | `(persona uuid, nuovo text)` come nello schizzo del n°15 | nessun consumatore esiste ancora, quindi il nome si scegliesi una volta sola: `nuovo` da solo non dice di cosa |
| 12 | **Tre test preesistenti riscritti**, non aggirati | adattare i codici attesi e tirare dritto | due asserivano una difesa che si è **spostata** (dal trigger al privilegio) e una interrompeva il file invece di diventare rossa. Vedi §6 |
| 13 | **`src/lib/seo.ts` riformattato e quattro file riportati a LF** | dichiararli e lasciare giallo lo scan | non sono miei e non c'entrano con questo pacchetto, ma dichiarare «scan pulito» con cinque file segnalati sarebbe falso. Contenuto invariato: `git diff` sui quattro è vuoto. Vedi §7 |

## 2. La linea di partenza, misurata prima di toccare

Stack fornodoro acceso (API 7621, database 7622), app di produzione viva sulla
3621, build `p1ETtUu2HEAB4sH7mKrJW`, cinque gate verdi.

`postgres` ha **`rolbypassrls = true`** (verificato in catalogo): è il fatto da
cui dipende tutto il disegno di `cambia_ruolo`, e non è stato assunto.

```
rolname        | rolbypassrls | rolsuper
anon           | f | f
authenticated  | f | f
postgres       | t | f
service_role   | t | f
supabase_admin | t | t
```

Conteggi reali (l'analisi di impatto della skill li pretende, e non «quante ne
useranno»): `personale` **2** righe (1 titolare, 2 attivi) · `ordini` **5** ·
`righe_ordine` **8** · `auth.users` **2**.

### n°11 — prima

Contro l'endpoint vero, con la chiave anonima:

```
ritiro_at                            HTTP  codice  messaggio
'non-una-data'                       400   22007   invalid input syntax for type timestamp with time zone: "non-una-data"
'2026'                               400   22007   invalid input syntax for type timestamp with time zone: "2026"
'Wed Aug 05 2026 20:00:00 GMT+0200'  400   22023   time zone "gmt+0200" not recognized
'2026-02-30T10:00:00.000Z'           400   22008   date/time field value out of range: "2026-02-30T10:00:00.000Z"
''                                   400   22007   invalid input syntax for type timestamp with time zone: ""
```

**La voce del registro era incompleta**: n°11 cita solo `22007`. Le classi native
sono **tre** (`22007`, `22008`, `22023`), e la terza — un fuso orario con un nome
che Postgres non conosce — non si chiude con nessun controllo che non guardi anche
l'offset. È il motivo per cui la validazione è in due strati e non in uno.

### n°22 — prima

Sessione della titolare + chiave anonima, cioè quello che ha in mano chiunque
apra i DevTools:

```
PATCH /rest/v1/personale?nome_completo=eq.Nino%20Esposito {"ruolo":"titolare"}
  → HTTP 200, e in tabella DUE titolari
```

E la metà peggiore, quella che il tribunale del 2026-08-05 aveva visto fermarsi
su un `23505`. Quel `23505` era un **incidente del seed**, che ha due account e
due righe di personale: con un terzo account presente — un cliente registrato, e
`ordini.cliente_auth_user_id` esiste apposta — l'autorizzazione passa e la riga
entra. Misurato in transazione annullata:

```
insert into auth.users (… '…c1', 'cliente@example.com' …);
set local role authenticated;
set local request.jwt.claims = '{"sub":"…a1","role":"authenticated"}';
insert into public.personale (auth_user_id, nome_completo, ruolo)
values ('…c1', 'Titolare Intruso', 'titolare');
→ INSERT 0 1
   nome_completo    | ruolo    | is_attivo
   Nino Esposito    | cucina   | t
   Rosa Amato       | titolare | t
   Titolare Intruso | titolare | t
→ titolari_attivi: 2
```

E una terza via che **nessuna delle due metà chiude da sola**: `delete` +
`insert` è un cambio di ruolo. Chiudere una metà e dichiarare chiuso il debito
sarebbe stato un verde falso.

## 3. Le due migrazioni

`supabase/migrations/20260806120000_ritiro_validato.sql` — `drop function` +
`create function` con `ritiro_at text`; controllo del vuoto, controllo di forma
(ISO-8601 con offset esplicito, scritta senza `\d` come il resto dello schema),
cast dentro `begin/exception when invalid_datetime_format or
datetime_field_overflow or invalid_parameter_value`, e **solo dopo** l'orizzonte,
che è una regola di dominio e non di forma. `revoke execute … from public` +
`grant … to anon, authenticated` riemessi: una funzione nuova nasce con
`execute` a PUBLIC.

`supabase/migrations/20260806120100_ruolo_una_porta_sola.sql` —
`revoke update (ruolo)`, `drop policy "il titolare assume"`,
`revoke insert`, e `cambia_ruolo(persona uuid, nuovo_ruolo text)`
`security definer` con `set search_path = ''`, quattro controlli con messaggi
propri, `execute` revocato a `public` e concesso ad `authenticated` e
`service_role`.

Nessuna delle due distrugge un dato: si sostituisce una funzione, si toglie un
privilegio e una policy, si aggiunge una funzione. **Nessuno STOP da chiedere** —
e questo è il caso normale di un `evolve` che restringe.

## 4. n°11 — dopo, contro l'endpoint vero

```
non-una-data                         -> HTTP 400 P0001 orario di ritiro in un formato che non riconosco: serve una data con fuso, per esempio 2026-08-07T20:00:00Z
2026                                 -> HTTP 400 P0001 orario di ritiro in un formato che non riconosco: serve una data con fuso, per esempio 2026-08-07T20:00:00Z
Wed Aug 05 2026 20:00:00 GMT+0200    -> HTTP 400 P0001 orario di ritiro in un formato che non riconosco: serve una data con fuso, per esempio 2026-08-07T20:00:00Z
2026-02-30T10:00:00.000Z             -> HTTP 400 P0001 quella data non esiste sul calendario: ricontrolla giorno, ora e fuso del ritiro
(vuota)                              -> HTTP 400 P0001 serve la data e l'ora del ritiro
1900-01-01T00:00:00Z                 -> HTTP 400 P0001 orario di ritiro fuori dall'orizzonte consentito
2026-08-06T11:26:43.000Z             -> "FD-F3DB7B" HTTP 200
```

Le tre classi native non escono più; l'ultima riga è l'altra direzione, che vale
quanto le altre sei: **la funzione non si è chiusa in difesa**.

## 5. n°22 — dopo, contro l'endpoint vero

```
PATCH  ruolo di un collega            200        -> 403  42501 permission denied for table personale
POST   un titolare nuovo              INSERT 0 1 -> 403  42501 permission denied for table personale
PATCH  telefono di un collega                       204  (non si è chiuso troppo)

rpc/cambia_ruolo, dalla porta nuova:
  cucina    → (Nino, 'titolare')   400 P0001 solo un titolare attivo cambia il ruolo di qualcuno
  titolare  → (Nino, 'dio')        400 P0001 ruolo sconosciuto: si sceglie fra titolare e cucina
  titolare  → (inesistente,'cucina') 400 P0001 quella persona non e' nel personale
  titolare  → (sé stessa,'cucina') 400 P0001 il proprio ruolo non si cambia da soli
  titolare  → (Nino, 'titolare')   204  ← e la porta si apre davvero (n°15, metà di database)
  anonimo   → (Nino, 'titolare')   401 42501 permission denied for function cambia_ruolo
```

## 6. I test, e il collaudo per sabotaggio

pgTAP da **55 a 82** asserzioni, 5 file, tutte verdi
(`rls_negativi` 30 · `flusso_ordini` 14 · `indurimento` 12 ·
`ritiro_validato` 9 · `ruolo_una_porta` 17).

**Tredici sabotaggi, tredici asserzioni che diventano rosse.** Ogni difesa è
stata tolta dentro una transazione e il file che dice di provarla è stato
rilanciato. I primi dieci sono del primo giro; **K, L e M** sono le difese nate
dai rilievi del tribunale (§8):

```
A. `crea_ordine`: via il controllo di FORMA (strato 1 di 2)            -> ROSSO (bene)
      not ok 1 - una data malformata la rifiuta la funzione, non il cast dell'argomento
      not ok 2 - nemmeno un fuso orario col nome sbagliato arriva al parser di Postgres
      not ok 5 - un orario senza fuso non entra: sarebbe letto in UTC e sbagliato di due ore
B. `crea_ordine`: via il blocco `exception` intorno al cast (strato 2) -> ROSSO (bene)
      not ok 3 - una data ben scritta che non esiste la rifiuta la funzione, non il cast
C. `personale`: rimesso `grant update (ruolo)` ad authenticated        -> ROSSO (bene)
      not ok 1 - nemmeno un titolare scrive `ruolo` per via diretta
D. `personale`: rimesso `grant insert` ad authenticated                -> ROSSO (bene)
      not ok 3 - un titolare non crea piu' una riga di personale, quindi non crea titolari
      not ok 12 - e non puo' riaggiungerla: la porta gira in un senso solo
E. `cambia_ruolo`: via il controllo 1 (chi chiama e' titolare attivo)  -> ROSSO (bene)
      not ok 6 - la cucina non usa `cambia_ruolo` nemmeno per riscrivere il ruolo che ha
      not ok 7 - la cucina non si promuove titolare passando dalla funzione
F. `cambia_ruolo`: via il controllo 2 (il valore del ruolo)            -> ROSSO (bene)
      not ok 4 - un ruolo inventato lo rifiuta la funzione, non il check di tabella
G. `cambia_ruolo`: via il controllo 3 (la persona esiste)              -> ROSSO (bene)
      not ok 5 - promuovere una persona che non esiste non passa in silenzio
H. `cambia_ruolo`: via il controllo 4 (mai sulla propria riga)         -> ROSSO (bene)
      not ok 10 - l'ultimo titolare non si declassa da solo: IAM-1 sopravvive alla porta nuova
I. `personale`: policy di `update` portata a `using (true)`            -> ROSSO (bene)
      not ok 19 - chi non e' titolare non scrive nessuna riga di personale, nemmeno la propria (policy)
J. `personale`: via il trigger `personale_ruolo_protetto`              -> ROSSO (bene)
      not ok 30 - senza impersonare nessuno, il trigger difende ancora la colonna ruolo
K. `crea_ordine`: si torna a ENUMERARE tre condizioni invece della classe 22 -> ROSSO (bene)
      not ok 4 - un offset fuori scala non esce come errore nativo: la classe 22 e' intera
L. `cambia_ruolo`: via il controllo di forma dell'identificativo       -> ROSSO (bene)
      not ok 5 - un identificativo malformato lo rifiuta la funzione, non il cast
M. `personale_ruolo_protetto`: l'attivazione torna guardata in un verso solo -> ROSSO (bene)
      not ok 15 - riaccendere l'autorita' di un altro e' guardato come spegnerla

TUTTI I SABOTAGGI SANNO FAR DIVENTARE ROSSO UN TEST
```

### E il quattordicesimo sabotaggio, che pgTAP non può vedere

La difesa dell'invariante IAM-1 (§8, DEF-01) è un lucchetto più un conteggio.
Sabotarla vuol dire **togliere il lucchetto e tenere il conteggio** — e nessuna
asserzione pgTAP se ne accorgerebbe, perché il conteggio da solo è corretto in
una sessione. La prova è `scripts/prova-concorrenza.mjs`, a due sessioni:

```
=== con il conteggio da solo, senza pg_advisory_xact_lock ===
not ok due `cambia_ruolo` che si declassano a vicenda: titolari attivi = 0
not ok due `update is_attivo = false` a vicenda (senza cambia_ruolo): = 0
not ok due `delete` a vicenda: titolari attivi = 0
  ok   un `delete` concorrente non fa restituire successo a `cambia_ruolo`
3 COPPIE SU 4 ROMPONO L'INVARIANTE

=== con il lucchetto ===
TUTTE E 4 LE COPPIE RISPETTANO L'INVARIANTE
```

**È la misura che vale più di tutte in questo verbale**: dice che a difendere
l'invariante non è il conteggio — che è la cosa che verrebbe in mente — ma il
punto di serializzazione. Un `if (count = 0) raise` scritto in buona fede
avrebbe lasciato il difetto intatto e il gate verde.

**Il collaudo per sabotaggio ha mentito una volta, e la bugia era mia.** Il primo
giro ha dichiarato **verdi tutti e dieci** i sabotaggi, cioè «dieci asserzioni
non provano niente». Era lo strumento: psql con l'uscita allineata di default
incolonna le righe TAP dentro una cella, quindi cominciano con uno spazio e
`startswith("not ok")` non ne vede **nessuna**. Con `-At` sono uscite tutte.
Un collaudo per sabotaggio che non sa leggere il proprio output dichiara sano
qualunque test: vale la pena che il primo sabotaggio di ogni batteria sia uno di
cui si conosce già la risposta.

### I tre test preesistenti riscritti, e perché non bastava adattarli

| Dov'era | Cosa succedeva | Cosa dice adesso |
|---|---|---|
| `rls_negativi` §2, sonda su `ruolo` | l'`update` **solleva** `42501` invece di toccare zero righe, quindi il file si **interrompeva**: 11 asserzioni su 29 non partivano nemmeno. Un test che interrompe non è un test che diventa rosso | la sonda è `nome_completo`, che il `grant` per colonna **concede**: così l'unica cosa che può negare è la policy, che è quello che la riga dichiara di provare. Sabotaggio I |
| `rls_negativi` §3, «nemmeno il titolare cambia il proprio ruolo» | a negare era il trigger (`P0001`); adesso nega il privilegio (`42501`), **prima** che il trigger parli | asserisce `42501` **col messaggio per esteso**: un'asserzione sul solo codice non distinguerebbe questa negazione da quella di una policy |
| `rls_negativi` §2, «la cucina non assume nessuno» | resta verde, ma il commento diceva «il `with check` della policy nega la riga nuova» — e la policy **non esiste più** | commento corretto: a negare è il privilegio, e l'asserzione non distingue più cucina da titolare (quella per il titolare, l'attore forte, è in `ruolo_una_porta`) |

### E una cosa trovata per strada, che non c'entra con i due debiti

**`reset role` non azzera `request.jwt.claims`.** `set local` vale per tutta la
transazione, quindi la §4 di `rls_negativi` — il cui titolo dice «Questi girano
SENZA impersonare» — girava come il **proprietario con il token della titolare in
tasca**. Non era mai emerso perché nessuna asserzione della §4 dipendeva da
`auth.uid()`; la prima che ne ha dipeso è uscita rossa col messaggio sbagliato
(si aspettava «solo un titolare cambia ruolo…», ha ricevuto «la propria autorità
non si tocca da soli»), ed è così che si è vista. Chiuso con
`set local request.jwt.claims = '';` in testa alla §4.

## 7. I cinque gate, rilanciati sulla build ricostruita

Due giri: uno dopo le prime due migrazioni (build `pP4aTJEkPLpj89JIFVwxO`) e uno
dopo la terza, quella del tribunale. I numeri qui sotto sono del **secondo**,
sulla build rifatta da zero col Node 24 (`rm -rf .next`, debito n°21):
`p1ETtUu2HEAB4sH7mKrJW` → **`mRBe6eqMjjl0W5m2tfJ24`**, confrontata con l'HTML
servito dai passi `app-identita` della vetrina e `build-produzione` di
speed-demon.

| gate | esito |
|---|---|
| **schema-forge** | VERDE 9/9 · 7 migrazioni applicate + seed |
| **flow-sentinel** | VERDE 7/7 · **22 test passati, 0 falliti, 0 saltati** |
| **gestionale-crafter** | VERDE 7/7 · 0 issue, 0 warn nell'audit |
| **vetrina-crafter** | VERDE 10/10 |
| **speed-demon** | VERDE 7/7, col Node 24 · 20 soglie rispettate |

**Nessun gate a valle è diventato rosso**, in nessuno dei due giri — ed era la
domanda vera del pacchetto. Le tre modifiche a `src/` che ho fatto non sono
correzioni di codice rotto: sono **prose che erano diventate false** (il commento
di `azioni.ts` che diceva «il difetto resta aperto», quello di
`personale/azioni.ts` che diceva «il database glielo concederebbe», e l'avviso
nella pagina del personale).

Residuo dell'audit RLS: **5 issue** (le cinque policy `using (true)` sui dati
pubblici, dichiarate dal 2026-08-04), **0 block**. Erano **6**: l'issue
`public.personale.is_attivo` — «macchina a stati vincolata solo in `update`» — è
sparita, e vale sapere **perché** invece di festeggiare. La regola 9 dell'audit
guarda solo le tabelle che hanno una policy di `insert`
(`audit-lib.mjs:590`, `if (!inseribili.has(chiave)) continue;`): togliendo «il
titolare assume» la premessa della regola è caduta. Non è che lo stato iniziale
sia stato vincolato — è che **nessun ruolo del client può più creare una riga**.
La preoccupazione sopravvive per `service_role`, che la regola non guarda.

`code-maniac scan`: **0 passi con problemi**, 2 saltati (`gitleaks` assente,
n°9 ereditato; convenzioni di progetto non installate).

**Due cose trovate dallo scan che non erano mie, e le ho chiuse invece di
dichiararle.** Quattro file di `src/app/(sito)/` erano a **CRLF** su disco mentre
`git status` li dava puliti: è il debito **n°30** esatto, che ha colpito di nuovo
— e la sua stessa voce dice che «la stessa cosa succederà al prossimo che
ripristina un file». Riportati a LF, `git diff` sui quattro vuoto. Il quinto,
`src/lib/seo.ts`, era a LF e **davvero non formattato** (due righe che Prettier
vuole avvolgere): è un file dell'anello 13, identico a `HEAD`, e l'handoff 13 §8
dichiara «`code-maniac scan`: 0 passi con problemi». Su quel file quella riga
**non era vera**.

## 8. Il tribunale — quattro difetti nelle migrazioni di questa mattina

`/code-inquisition --focus security --council 3` sulle **sole** migrazioni nuove.
Il **critico del roster** ha fatto guadagnare un quarto esperto (nessuno dei tre
proposti aveva mandato sul confine fra SQL e ciò che PostgREST mette sul filo) —
la stessa cosa capitata all'anello 13, e la seconda volta su due che il critico
paga. Un esperto è morto per un `529` ed è stato **rilanciato**: la sua corsia
era il cuore del n°22 e non poteva restare vuota.

**Esito: 9 rilievi, 0 fabbricazioni, 4 correzioni applicate, 5 dichiarate.**
Le correzioni stanno in `20260806120200_indurimento_p4f.sql`.

| # | Cosa | Esito |
|---|---|---|
| **DEF-01** | **L'invariante IAM-1 era falso.** Due titolari che si declassano a vicenda, concorrenti, arrivano a **zero titolari attivi**. Write skew a READ COMMITTED: `e_titolare()` su un'istantanea, l'`update` su un'altra, e righe **diverse**, quindi nessun conflitto. Riprodotto anche con due `update is_attivo` e con due `delete`: era falso **dal 2026-08-04** | **CHIUSO**: trigger di istruzione con `pg_advisory_xact_lock` + conteggio, su tutte e tre le vie |
| **RPC-2** | **La migrazione che chiudeva il n°11 ha riprodotto il n°11**: `cambia_ruolo(persona uuid, …)`, cast al legame, `22P02` — e prima di ogni controllo di autorizzazione | **CHIUSO**: `persona text`, forma validata dopo il controllo d'autorità |
| **RPC-1** | **`22009` sfuggiva**: il blocco intercettava le tre condizioni *misurate*, e Postgres ne ha una quarta oltre ±15:59:59 | **CHIUSO**: classe 22 intera, e il resto rilanciato intatto |
| **DEF-03** | `cambia_ruolo` restituiva **204 su una promozione mai avvenuta** con un `delete` concorrente in mezzo | **CHIUSO**: `for update` + controllo di `found` |
| **IAM-01** | L'autorità è `ruolo AND is_attivo`, e la guardia copriva `is_attivo` **in un verso solo**: spegnerla sì, riaccenderla no | **CHIUSO** (guardia simmetrica) + residuo dichiarato: `is_attivo` resta una scrittura di colonna, quindi senza gancio per una traccia |
| **IAM-03** | **Il sabotaggio dichiarato da una mia correzione non funzionava**: `using (true)` da solo fa *sollevare* l'istruzione e **aborta il file** (13 asserzioni non partono) invece di rendere rossa l'asserzione. È la forma esatta del difetto che quella correzione aveva appena chiuso | **CHIUSO**: commento corretto, e detto quale sabotaggio prova cosa |
| **IAM-02** | **Una frase falsa**: «l'`insert` a `service_role` sul ruolo non apre niente, il trigger chiama `e_titolare()`». Il trigger è `before update`: su un `insert` non scatta mai (misurato: `INSERT 0 1` con la chiave di servizio) | **CORRETTA LA FRASE, non il codice**: un ramo `before insert` dovrebbe esentare il caso «nessun JWT», cioè `service_role` stesso. Debito n°41 |
| **DEF-04** | Da zero titolari **non si rientra**, nemmeno con la chiave di servizio: quattro vie provate, tutte negate | **DICHIARATO** (n°37): quello stato è ora irraggiungibile dal client, e un'esenzione allargherebbe la chiave di servizio per riparare l'irraggiungibile |
| **WIRE-1** | Il `hint` di PostgREST su un `42501` **di tabella** nomina il privilegio mancante | **DICHIARATO** (n°39): sui due RPC il `hint` è sempre `null`, e `personale`/`ordini` non sono nell'OpenAPI dell'anonimo |

**E una cosa che il collegio ha verificato vera**, che vale quanto un difetto
trovato: le tre affermazioni della prima migrazione sui suoi consumatori — nome
dell'argomento invariato, entrambi i chiamanti mandano già una stringa con
offset, `database.types.ts` dichiarava già `ritiro_at: string` — sono state
**confermate**, l'ultima con `git show --stat` che mostra il commit aggiungere
soltanto `cambia_ruolo`. E la necessità dei `revoke execute … from public` è
stata riprodotta creando una funzione usa-e-getta e chiamandola da `anon`.

## 9. `evolve` su un progetto vero: cosa ha retto e cosa no

Questa sezione è il motivo per cui il pacchetto esisteva anche senza i due
debiti: `evolve` è l'unico comando di schema-forge che il pilota non aveva mai
attraversato, e questo è il suo primo collaudo con quattro anelli costruiti
sopra.

### Cosa ha retto

- **L'analisi di impatto prescritta dalla skill ha pagato subito**, e in modo
  misurabile: `grep` sui consumatori veri ha detto che il corpo della richiesta
  HTTP non cambia, e il `diff` dei tipi rigenerati l'ha confermato **a
  posteriori** — l'unica riga nuova in `database.types.ts` è `cambia_ruolo`, e
  `crea_ordine` è **byte per byte identico**. Una firma SQL cambiata con zero
  righe di consumatore da toccare è esattamente il risultato che l'analisi
  serviva a ottenere, e senza di essa la strada ovvia (rinominare l'argomento)
  avrebbe rotto due consumatori.
- **Expand-contract ha funzionato in una forma che la reference non descrive.**
  `references/migrazioni.md` parla di colonne: aggiungi, popola, sposta le
  letture, togli. Qui l'oggetto era la **firma di una funzione**, dove
  «expand» è impossibile: due funzioni con gli stessi nomi di parametro sono un
  overload che PostgREST non sa risolvere. La forma giusta è `drop`+`create`
  nella stessa transazione, che non è né expand-contract né un distruttivo — ed è
  un caso che la reference non ha.
- **La disciplina «migrazione applicata = immutabile» ha tenuto senza attrito**:
  sei migrazioni, le prime quattro intoccate.
- **Quattro anelli a valle hanno retto una modifica dello schema** senza una
  riga di codice cambiata per necessità: 22 test E2E verdi, gestionale 7/7,
  vetrina 10/10, speed-demon 7/7. Le tre modifiche a `src/` che ho fatto sono
  **prose che erano diventate false**, non codice rotto.
- **Il gate ha fatto il suo mestiere due volte**: il passo `contratto-uscita` ha
  rifiutato l'handoff che dichiarava `Gate: VERDE` mentre l'esecuzione chiudeva
  rosso, e `sqlfluff` ha bocciato quattro righe di 81 caratteri.

### Cosa non ha retto, e va in `STATO.md`

- **`evolve` non prescrive di rilanciare i test preesistenti *e di leggere perché*
  cambiano.** Tre asserzioni su `personale` sono cambiate di significato, e una
  **interrompeva il file** invece di diventare rossa — nascondendo 11 asserzioni
  su 29. La procedura del comando dice «alla fine si riallinea `seed.sql`»: non
  dice niente sui test, che sono l'altra metà che un `evolve` sposta. Il seed qui
  non andava toccato; i test sì.
- **Restringere un privilegio può spegnere una regola dell'audit senza che nessuno
  lo veda.** Togliendo la policy di `insert`, l'issue su `personale.is_attivo` è
  scomparsa perché la regola 9 non guarda più quella tabella. Il gate è passato
  da 6 issue a 5 e **sembra un miglioramento**: lo è, ma per un motivo diverso da
  quello che il numero suggerisce. Un `evolve` che restringe dovrebbe essere
  tenuto a **diffare il residuo dell'audit** e a spiegare ogni riga sparita.
- **La reference non ha il caso «cambiare la firma di una funzione»**, che su un
  progetto Supabase è il caso più probabile di tutti: le RPC sono il contratto
  pubblico. Va aggiunto accanto a `alter column type`, con la trappola
  dell'overload PostgREST e con la regola che i `grant execute` **non
  sopravvivono al `drop`**.
- **Un `$$` dentro un commento del corpo di una funzione chiude la funzione.**
  La prima applicazione è morta con `syntax error at or near "`"` su una riga di
  prosa italiana che citava `` `$$` ``. È una trappola da una riga in
  `references/migrazioni.md`.
- **`references/sabotaggio.md` non dice di verificare il proprio rilevatore.**
  Il mio primo giro ha dichiarato sani dieci test che erano tutti sabotabili,
  perché leggeva l'output di psql nel formato sbagliato. Il primo sabotaggio di
  una batteria deve essere uno di cui si conosce già la risposta.

### E le quattro cose che ha insegnato il tribunale, che sono le più importanti

- **«Un'asserzione che non può fallire non è un'asserzione» è vera e mi ha fatto
  sbagliare.** È la regola giusta, e l'ho applicata al contrario: da «nessun test
  di pgTAP può far diventare rosso questo `if`» ho concluso «questo `if` è
  irraggiungibile», e ho deciso di non scriverlo. Ma pgTAP gira in **una
  sessione**, e l'invariante che quell'`if` doveva difendere è un invariante su un
  **insieme di righe**, che una sessione sola non può rompere. La regola va
  affiancata dalla sua sorella: **un limite dello strumento non è una proprietà
  del codice.** Concretamente, per la skill: *un invariante su un insieme (non su
  una riga) non è dimostrabile in pgTAP, e va provato con un test a due sessioni.*
- **Il gate non ha un posto per la concorrenza, e questo è il buco più grande che
  questo pacchetto ha trovato nella skill.** Nove passi, 82 asserzioni, e nessuno
  vede il write skew. Serve una cartella `supabase/tests/concorrenza/` che
  `verify.mjs` esegua **fuori** da `supabase test db`, o il passo pgTAP continuerà
  a dire verde su schemi che due utenti insieme rompono. Oggi la prova è in
  `scripts/prova-concorrenza.mjs` e **la lancia solo chi si ricorda**.
- **Chiudere un difetto di classe «cast prima della validazione» richiede di
  passare in rassegna TUTTI gli argomenti non-`text` di TUTTE le RPC, non quello
  segnalato.** L'ho imparato riproducendo il debito n°11 nella migrazione che lo
  chiudeva, la stessa mattina, su una funzione che ho scritto io. Va nel `evolve`
  come voce di elenco, non come consiglio.
- **Un blocco `exception` intorno a un cast non deve enumerare le condizioni.**
  Ne avevo elencate tre perché tre le avevo misurate; Postgres ne ha una quarta.
  La forma giusta è la **classe** (`sqlstate like '22%'`) con `raise` per tutto il
  resto. Vale per ogni cast difeso, non solo per le date.

## 10. Residui, e il debito

Il registro passa da **34 voci aperte a 38**: prima 35 righe con una chiusa
(n°26), ora **41 righe con tre chiuse** (n°26, n°11, n°22). Contato, non stimato:
`grep -c '^| [0-9]\+ |'` → 41, e tre righe portano `**CHIUSO`.

Il mandato diceva «32 voci»: era già stantio all'emissione — l'handoff 13
dichiara «da 30 a **34** voci aperte», e 34 è il numero che ho contato prima di
cominciare.

**Il debito cresce, e va detto perché non è un fallimento**: quattro delle sei
voci nuove esistono perché un tribunale ha guardato dove nessuno aveva guardato.
Un registro che cala dopo un audit avversario è un registro che non ha ascoltato.

**Chiuse con la misura (3):** n°11 (`ritiro_at` validato prima del cast, e le
classi native erano tre più una quarta) · n°22 (entrambe le metà, `PATCH` 200→403
e `POST` `INSERT 0 1`→403) · la **metà di database** del n°15 (`cambia_ruolo`,
HTTP 204 dalla porta vera; la metà d'interfaccia resta a `gestionale-crafter`).

**Aperte da qui (6), e cinque sono cose che il tribunale ha misurato:**

| # | Cosa | Perché non si chiude qui |
|---|---|---|
| **36** | la prova dell'invariante IAM-1 vive fuori dai gate | pgTAP è a una sessione: è una lacuna della **skill**, non del progetto |
| **37** | da zero titolari non si rientra nemmeno con la chiave di servizio | quello stato è ora irraggiungibile dal client; un'esenzione allargherebbe la chiave per riparare l'irraggiungibile. Decisione del direttore |
| **38** | `delete` su `personale` è una porta a senso unico | conseguenza scelta della chiusura del n°22; il modo previsto di togliere l'accesso è `is_attivo`, che è reversibile |
| **39** | il `hint` di PostgREST nomina il privilegio mancante | politica di PostgREST, non riga di schema; sui due RPC è `null` |
| **40** | restringere un privilegio ha spento una regola dell'audit | il residuo è passato da 6 a 5 issue e **sembra** un miglioramento: va spiegato |
| **41** | la porta dell'`insert` ha una serratura sola, e la frase diceva due | corretta la frase; il ramo `before insert` dovrebbe esentare `service_role`, cioè l'unico che inserisce |

**Corretta** anche la n°30 (fine-riga): ha colpito di nuovo, quattro file a CRLF
con `git status` pulito — la sua stessa previsione, avverata. E ho trovato che
`src/lib/seo.ts`, file dell'anello 13 e identico a `HEAD`, falliva
`prettier --check`: la riga «`code-maniac scan`: 0 passi con problemi»
dell'handoff 13 §8 su quel file **non era vera**.

Per lo `STATO.md` della skill, i difetti veri (la riga, non la correzione):
il gate senza un passo per la concorrenza · `evolve` che non prescrive di
rileggere i test preesistenti né di diffare il residuo dell'audit · la reference
senza il caso «firma di una funzione» e senza la regola che i `grant execute` non
sopravvivono al `drop` · il `$$` dentro un commento · `sabotaggio.md` che non fa
verificare il proprio rilevatore.

## 11. Riga finale

**P.4f consegnata.** I debiti **n°11** e **n°22** sono chiusi con la misura —
`ritiro_at` è `text` validato nel corpo con la **classe 22** intera intercettata
(le classi native erano tre, e il tribunale ne ha trovata una quarta), e il ruolo
si cambia da `cambia_ruolo()` sola, con `revoke update (ruolo)` **e**
`revoke insert` **e** la policy di `insert` tolta, misurato 200→403 e
`INSERT 0 1`→403 contro l'endpoint vero. Il sabotaggio dice che le tredici
asserzioni nuove sanno diventare rosse, e tutti e cinque i gate del filo sono
verdi dopo un `evolve` dello schema: **la catena regge una modifica a valle
costruita.**

Ma la riga che conta di più è un'altra, e non è quella che il mandato aveva
previsto: **l'invariante che il mandato mi chiedeva di far sopravvivere non
esisteva.** «Resta sempre almeno un titolare attivo» era un ragionamento seriale
dichiarato come invariante dal 2026-08-04, e due titolari concorrenti lo
riducevano a zero senza un errore — da dove non si rientrava nemmeno con la
chiave di servizio. Adesso è vero, difeso da un lucchetto e non da un conteggio,
e la sua prova sta fuori dai gate perché **pgTAP non può scriverla**. Il debito è
passato da **34 a 38** voci aperte: due chiuse in questo pacchetto, sei aperte, e
cinque delle sei sono cose che nessuno aveva ancora guardato.
