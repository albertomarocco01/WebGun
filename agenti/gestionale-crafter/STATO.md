# Stato — Gestionale Crafter

- **Stato attuale:** v1.0 — skill vera, collaudata su un progetto Next.js + Supabase reale (banco `banco-prova-negozio`, e-commerce di maglieria) il 2026-07-28. Gli script hanno test propri (`node --test`, **109 verdi**), il gate `verify` ha **7 passi** e l'audit **sei regole** con nove verdetti distinti.
  **NON ancora usabile su un progetto cliente.** Il gate misura le guardie e i permessi; non sa se il ruolo richiesto da una vista sia quello giusto per quel dominio, e la lettura delle scritture nel codice è un'euristica di testo, non un parser. Punti aperti in fondo, ordinati per gravità.
- **Proprietario:** Alberto
- **Dipendenze:**
  - A monte: **schema-forge** (tabelle, policy, `grant` per colonna, funzioni di ruolo, tipi generati) · brief-smith (entità e contenuti del cliente) · prompt-smith (richiesta professionale)
  - A valle: **flow-sentinel** (test end-to-end dei flussi del gestionale) · **cyber-shield** (verifica permessi e accessi) · speed-demon (performance a sito completo)
  - **Correzione dell'ipotesi dello scaffold**: la dipendenza da **fly-ui non esiste** — l'agente non esiste. I componenti si scrivono a mano nel progetto generato, dietro una cucitura (`src/components/ui/*`) fatta per essere sostituita. Deroga formale: `../../DECISIONI.md` §21.
- **Guardiani:** code-maniac e code-inquisition valutano gli script di questa skill come qualsiasi altro codice.
- **2026-08-03 — il gate e l'audit non partivano sul Node di sistema, e uscivano `0` muti.** *Il difetto:* l'epilogo di `verify.mjs` e quello di `admin-audit.mjs` erano `if (import.meta.main) main();`, e `import.meta.main` è arrivato in **Node 24**; su Node 20.12.2 — l'unico Node di sistema di questa macchina — vale `undefined`, `main()` non girava e **entrambi uscivano `0` senza stampare una riga**. Sull'audit era peggio che sul gate: `0` è proprio il suo codice di «nessun bloccante», quindi il silenzio si travestiva da esito buono. I prerequisiti dichiarati dicono «Node ≥ 20»: era il codice a violare il proprio contratto. I verdi storici non erano falsi — il `COLLAUDO-2026-07-28` dichiara Node 24.14.0. *La correzione:* la forma già collaudata di `vetrina-crafter`, `process.argv[1]` risolto e confrontato con `fileURLToPath(import.meta.url)`, a comportamento invariato su Node 24. *Come si è provata:* in una cartella non-progetto nelle **due direzioni** — prima Node 20 usciva `0` con zero righe e Node 24 usciva `2` con il messaggio, dopo **entrambi escono `2` con lo stesso messaggio**, per tutti e due gli script. Due test di regressione per script (105 → **109**), in `scripts/verify.test.mjs` e nel nuovo `scripts/admin-audit.test.mjs`: uno **funzionale** (lancia lo script in una cartella non-progetto e pretende uscita ≠ 0 e output non muto — copre tutta la classe «l'epilogo non parte», ma su Node 24 non vede *questo* difetto) e uno **statico** (il sorgente non contiene `import.meta.main` — l'unico dei due che lo impedisce su qualunque Node). Pacchetto P.0-igiene.

## Cosa fa, in una riga

Genera il backoffice di un progetto Web Gun — viste CRUD protette da autenticazione e ruolo sopra lo schema di schema-forge — e si rifiuta di consegnarlo se una rotta è scoperta, se una chiave scavalca le policy, o se un modulo scrive colonne che il database non concede.

## Collaudo del 2026-07-28 (banco `banco-prova-negozio`)

Verbale completo in `COLLAUDO-2026-07-28.md`. In sintesi, con i numeri misurati:

- [x] **Schema prodotto eseguendo schema-forge**: 8 tabelle, 6 migrazioni, 20 asserzioni pgTAP, gate di schema-forge **VERDE 9/9** sul banco.
- [x] **Gate del gestionale VERDE 7/7** sul banco pulito, uscita `0`.
- [x] **Difetti piantati: 6 su 6 rilevati** con la gravità attesa (5 `block`, 4 `issue` — alcuni difetti ne producono due).
- [x] **Gemello pulito: 0 findings.** Nessun falso positivo su 32 file, 8 rotte, 6 azioni server, 10 scritture.
- [x] **Esperimento `evolve` di schema-forge contro codice applicativo vero** — il suo punto aperto n°13 («nessun consumatore reale a valle») ha finalmente un consumatore. Esito nel verbale §5.
- [x] **Test degli script**: 105 verdi (`node --test "scripts/**/*.test.mjs"`).
- [x] **Guardiani sugli script**: ESLint 0 errori 0 warning, `knip` pulito, `jscpd` pulito, **semgrep 6 rilievi dichiarati**, `gitleaks` **MANCANTE** (non installato).

### Le tre cose che il collaudo ha trovato, e che nessuno aveva previsto

1. **Un route handler non esegue i layout** — quindi la guardia della sezione non lo protegge. Misurato con `next dev` acceso e senza cookie: `GET /admin` risponde `307` verso l'accesso, `GET /admin/stato` (nella stessa cartella) risponde **`200`**. La regola è stata corretta: le pagine ereditano dal layout, i route handler no. *A non far uscire i dati è stata la RLS di schema-forge, non l'applicazione*: con un client `service_role` quella rotta avrebbe consegnato l'anagrafica intera.
2. **L'audit non guardava la cartella dove nascono i client.** Il walker escludeva ogni directory chiamata `supabase` — pensando a `supabase/migrations` nella radice — e saltava quindi `src/lib/supabase/`. Un `service_role` piantato lì è passato inosservato al primo giro. Corretto: la scansione parte da `src/`, dove quella cartella non c'è.
3. **Su Supabase i `grant` scritti nelle migrazioni sono no-op, e il `grant` per colonna non restringe niente da solo.** `pg_default_acl` concede `arwdDxtm` ad `anon` e `authenticated` su ogni tabella nuova: senza un `revoke` esplicito, `grant update (full_name, phone)` è additivo e la colonna `ruolo` resta scrivibile. Non è un'argomentazione: il test pgTAP del banco ha visto il magazziniere promuoversi titolare e, da lì, scrivere i contenuti del sito. Corretto sul banco con una migrazione dedicata; scritto in `references/form-e-permessi.md` e riportato a schema-forge.

### Premesse smentite dalla misura

- «Il layout della sezione protegge tutto ciò che sta sotto» — **falso per i route handler** (punto 1).
- «`information_schema.column_privileges` dice se una colonna è ristretta» — **no**: espande il permesso di tabella su ogni colonna, quindi mostra la stessa riga nei due casi opposti. La verità sta in `pg_class.relacl` + `pg_attribute.attacl`, ed è lì che l'audit legge.
- «`chiamaUnaDi` riconoscerebbe `richiediStaffFinto()` come una chiamata a `richiediStaff`» — **no**: fra il nome e la parentesi la regola ammette solo spazi. Il test è rimasto a fissare il comportamento vero invece della supposizione.

## Cosa NON è stato fatto, e perché

- **Nessun collaudo su un progetto cliente vero.** Il banco è un progetto generato dalla forma giusta, non un progetto di produzione: non ha traffico, non ha dati reali, e il suo database è locale.
- **Nessuno dei tre banchi è più su disco.** `banco-prova-negozio`, `banco-prova-accademia` e `banco-sporco` sono stati cancellati il 2026-07-30 (`../../DECISIONI.md` §25) e stanno nel commit `67f9001`: tornano con `git checkout 67f9001 -- <banco>`. Il criterio che li ha esclusi è che un clone pulito non li sa rilanciare — ai primi due manca il `.env.local` che il gate legge, gitignorato di proposito, e il terzo è il gemello sporco di uno dei due, quindi da solo non prova la metà che gli si chiedeva («zero falsi positivi sul gemello pulito»). Conseguenza da dire chiaro: **«6 difetti su 6 rilevati» e «gate VERDE 7/7» oggi non si rilanciano in un comando** — sono affermazioni datate in `COLLAUDO-2026-07-28.md`, ferme al giorno in cui sono state misurate.
- **`gitleaks` non è installato**: la ricerca di segreti sugli script resta **MANCANTE**, non `PASS`. È anche l'unica difesa automatica contro una chiave finita in un file committato — l'audit trova `service_role` nel codice, non una chiave qualunque in un `.env` tracciato.
- **`next build` non è nel gate.** `tsc --noEmit` copre i tipi; una build completa aggiungerebbe minuti al gate per verificare cose (bundling, prerendering) che non riguardano l'accesso ai dati. Se un progetto ne ha bisogno, è un passo da aggiungere lì, non qui.
- **Nessuna regola sul grafo degli import.** Un file che *importa* un modulo con `service_role` non viene segnalato: viene segnalato il modulo. Bastava per il collaudo; con `dependency-cruiser` si potrebbe seguire la catena, ed è la prima cosa da aggiungere se il difetto si ripresenta di traverso.
- **Storage non è verificato.** L'upload di immagini dei contenuti è documentato in `references/contenuti-editabili.md` e non lo guarda nessuno strumento: `storage` non è uno schema esposto e l'audit non lo legge.
- **Nessun test end-to-end.** È il perimetro di flow-sentinel, e va lasciato lì: un agente che si testa da solo i flussi si dà anche i voti.

## Collaudo avversario del 2026-07-28 (banco `banco-prova-accademia`)

Secondo banco, **dominio non e-commerce** — un'accademia musicale con direttore, segreteria
e insegnanti, e un vincolo che l'e-commerce non aveva: *l'insegnante vede solo gli allievi
dei propri corsi*, cioè visibilità ristretta per riga dentro lo stesso ruolo. Ha verificato
le affermazioni di questo file invece di ereditarle, e ha eseguito `/code-inquisition` sulla
superficie critica (tre esperti in isolamento, modelli diversi).

**Cosa ha retto.** Gate **6/7 al primo colpo** su un dominio che nessuna reference aveva
previsto — l'unico rosso era l'handoff non ancora scritto: **zero falsi positivi**. Le
policy provate impersonando i ruoli: l'insegnante di violino vede 1 allievo, quello di
pianoforte 1, la segreteria 3. L'auto-promozione tentata davvero: `permission denied for
table staff`.

**Cosa non ha retto.** Il tribunale ha trovato **sei difetti reali** su una superficie che
il gate dichiarava pulita, e **cinque su sei erano nel pattern che questa skill prescrive**,
non nel banco: sarebbero finiti in ogni progetto generato. Due confermati da esperti
indipendenti con evidenze disgiunte:

| Difetto | Dove stava | Esito |
|---|---|---|
| `is_active` fra le colonne del `grant update`: chi viene disattivato **si riaccende da solo**, ed è la colonna che leggono `e_staff()` e `ha_ruolo()` | schema generato (entrambi i banchi) | corretto, riprovato con pgTAP |
| la macchina a stati si fidava del **campo nascosto**: `status_attuale` arriva dal client e l'`update` filtrava solo sull'`id`, quindi uno stato terminale non era terminale | **`references/ruoli-e-query.md`**, cioè il pattern prescritto | corretto nella reference e in entrambi i banchi, riprovato con pgTAP |
| l'anagrafica del personale aperta a tutto lo staff (`phone`, `auth_user_id`) mentre la vista era director-only | schema generato | corretto, riprovato |
| `aggiornaRecapiti` accettava un `id` qualunque: oggi lo fermava solo la RLS | pattern generato | corretto: il permesso si dichiara dove si esercita |
| `cambia_ruolo` non guardava lo stato risultante: un direttore che si declassa blocca il sistema | schema generato | corretto |
| messaggi d'errore di Postgres propagati verbatim dalle azioni | pattern generato | **aperto** (punto 5 qui sotto) |

**La misura che conta più di tutte** è §7.2 del verbale: sostituita nella vista del personale
la guardia `richiediRuolo("direttore")` con `richiediStaff()` — cioè aperta la gestione del
personale a qualunque insegnante — l'audit ha risposto **«nessun bloccante»**. Il limite n°1
di questo file non è più un timore dichiarato: è un fatto misurato.

## Punti aperti — ordinati per gravità

1. **Il gate non sa se la guardia chiede il ruolo giusto — misurato il 2026-07-28.** Conta le guardie, non le confronta col modello di dominio. Sul banco dell'accademia, con la vista del personale declassata da `richiediRuolo("direttore")` a `richiediStaff()`, l'audit ha risposto «nessun bloccante». Difesa attuale: lo Specchio (che scrive chi amministra cosa) e `/code-inquisition` a mano sulla superficie critica — che infatti l'ha trovato. Chiuderlo davvero richiederebbe di leggere il modello dall'handoff a monte in forma verificabile, cioè una struttura che oggi l'handoff di schema-forge non ha.
2. **La lettura delle scritture è un'euristica di testo.** Riconosce `.from("t").update({…})` nella forma che questa skill genera. Una catena costruita a pezzi, un nome di tabella in una variabile o un oggetto costruito altrove le sfuggono — e il finding che manca non fa rumore.
3. **Le colonne di privilegio si riconoscono dal nome.** Stessa euristica di schema-forge, stesso limite dichiarato: una colonna `livello` che decide dei permessi non la vede nessuno.
4. **semgrep: 6 rilievi dichiarati, nessuno corretto nel codice.** Quattro `detect-non-literal-regexp` (le regole si costruiscono da nomi che stanno nella configurazione del progetto: ora passano tutti da `perRegExp`, ma restano regex non letterali) e due `detect-child-process` in `verify.mjs` (un gate che lancia strumenti lancia processi). Sono dichiarati, non silenziati: il giorno in cui uno di questi punti riceve input non fidato, la valutazione cambia.
5. **Il gate non verifica il gate a monte.** Il `verify` di schema-forge resta un passo del flusso e una casella della checklist, non un passo automatico: farlo girare da qui significherebbe un secondo `db reset` dentro un gate che non parla di schema.
5. **I messaggi d'errore del database arrivano all'interfaccia.** Ogni azione generata fa `throw new Error(error.message)`: se Next.js non li redige, un utente già autenticato legge testi di vincolo e di policy. Due esperti su tre l'hanno segnalato e **nessuno dei due ha potuto chiuderlo**: serve una build di produzione (`next build && next start`) e l'ispezione della risposta di rete di un'azione che forza un errore. La ricetta è scritta, la misura no. Costo: basso, ma richiede di far girare l'app per davvero.
6. **Un commento che promette una tabella che non esiste.** Sul banco dell'accademia la migrazione dice che le note sull'allievo stanno «in una tabella a parte» — tabella che non c'è. Nessun dato esposto oggi; il rischio è che chi legge creda esista un confine e ci scriva dentro. Non corretto **perché la migrazione è applicata e non si riscrive**: sta qui e nel verbale.
7. **Un solo dominio nelle reference.** I due banchi sono e-commerce e scuola di musica, ma le reference restano scritte con esempi e-commerce, come quelle di schema-forge. Il secondo collaudo non ha trovato falsi positivi, il che è un buon segno; non prova che il terzo dominio andrà liscio.
8. **`npm audit` non è nel gate, ed è una scelta.** Il tribunale ha segnalato CVE nella catena `eslint` (dev) e in `sharp`/`postcss` (transitive di `next`). Metterlo nel gate significherebbe una lettura di rete dentro un controllo deterministico: rosso quando cade la connessione, e verde diverso a distanza di un'ora. Resta lavoro della catena di build del progetto generato.

## Decisioni prese

- **La Legge n°3 ha due metà**: la guardia sulla rotta *e* nessuna scorciatoia sulla RLS. Il collaudo ha mostrato perché servono entrambe — la prima aveva un buco e a tenere i dati dentro è stata la seconda.
- **L'elenco delle entità si ancora ai tipi generati, per differenza.** O una vista, o una riga fra le `escluse` con la motivazione scritta. Senza, «CRUD per ogni entità che il cliente deve gestire» è una casella che l'agente spunta da solo.
- **Il bersaglio dell'audit viene da `gestionale.config.json`**, e si stampa sempre. Un default silenzioso (`src/app/admin`) farebbe passare per audit completo un audit su una cartella che non esiste.
- **Nessun `pass` si deduce da un codice d'uscita**: ogni passo misura la propria premessa (file letti, rotte trovate, catalogo letto). Zero rotte trovate è `skipped`, non `pass`.
- **Un `fail` non ha mai il dettaglio vuoto.** `where npx` risponde prima con lo script senza estensione, che `spawnSync` non esegue: due passi fallivano muti su una macchina dove gli strumenti funzionano. Ora l'eseguibile si sceglie (`.exe` → `.cmd`) e l'errore di spawn finisce nel dettaglio.
- **Le regole stanno nelle lib pure, i gusci fanno solo I/O.** Una regola nuova nasce nella lib, col suo test.
- **Un permesso che manca si chiede, non si aggira.** La richiesta vive nell'handoff §6 finché non è chiusa: è il canale verso schema-forge, e lascia traccia.
