# Mandato P.8 — schema-forge emette privilegi espliciti

> Emesso dal direttore dei lavori il 2026-08-03. Da incollare in una chat operaia nuova,
> distinta da quelle di P.2 e P.0-igiene. **Modello consigliato: Opus 5 · effort max.**
> Contabilità: `CANTIERE.md` (voci del 2026-08-03, decisione D7).

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto
corregge il **contratto d'uscita di schema-forge**: oggi ogni schema che produce nasce
**illeggibile dai ruoli del client**, e nessuna regola del suo audit se ne accorge.

**Il difetto, misurato dal direttore il 2026-08-03 sul banco acceso.** Le immagini
Supabase nuove non concedono più i privilegi impliciti su cui gli schemi si appoggiavano:

```
select relname, relacl from pg_class where relnamespace='public'::regnamespace and relkind='r';
→ anon=Dxtm · authenticated=Dxtm · service_role=Dxtm     (su tutte le tabelle)
```

`Dxtm` è TRUNCATE, REFERENCES, TRIGGER, MAINTAIN: **zero** select/insert/update/delete.
Nelle 6 migrazioni del banco non c'è **un solo** `grant` né `alter default privileges`
(grep, zero risultati). Risultato: pgTAP muore con `permission denied for table animals`
e il gate chiude ROSSO — ma per una causa che non è quella per cui il banco è rosso
apposta. Il verde di luglio non era falso: **era scaduto**, girava su un'immagine con
altri default.

Questa è la **terza puntata di una storia già a verbale nel suo `STATO.md`**, e le prime
due contengono le richieste mai applicate che ora chiudi:

1. §Il difetto vero (2026-07-28): i `grant` nelle migrazioni erano no-op perché il
   default copriva tutto, e il `grant` per colonna è additivo → *«il `revoke` prima del
   `grant` va nella regola, non solo nell'esempio»* (richiesta n°1 del primo consumatore,
   mai applicata).
2. §Il difetto più grave di tutti (2026-07-30): la CLI 2.95.4→2.110.0 cambiò
   `defaclacl` e `service_role` perse tutto — sopravvissero solo i ruoli che una
   migrazione scritta (`permessi_espliciti.sql`) riconcedeva uno per uno →
   *«`permessi_espliciti` deve comprendere `service_role`»* (la richiesta «più importante
   dell'intero file», mai applicata).
3. Oggi: i default nuovi non concedono più nemmeno il CRUD. La regola generale, già
   scritta lì: **su Supabase un privilegio che non hai scritto non è un privilegio che
   hai** — e ora vale anche al contrario: senza scriverlo, non hai niente.

## Leggi prima, in quest'ordine

1. `CLAUDE.md`; `CANTIERE.md`, voci del 2026-08-03 e decisione **D7** (il tuo perimetro).
2. `agenti/schema-forge/STATO.md` — per intero le sezioni: §Il primo consumatore a valle
   (in fondo: *Il difetto vero*), §Il secondo consumatore a valle (*Il difetto più grave
   di tutti*), §Note operative (Windows).
3. `agenti/schema-forge/SKILL.md` (comando `forge`, comando `test`, gate) e
   `references/rls-supabase.md` §Il caso peggiore — la forma `revoke` → `grant` esiste
   già lì, come esempio.
4. `DECISIONI.md` §8, §10, §11, §15, §16, §17, §18, §19, §22 — in particolare §17: la
   gravità di una regola si decide da dove sta la prova, e §18: si misura la premessa
   prima di leggere l'esito.
5. `agenti/schema-forge/COME-PROVARLA.md` — per rilanciare il gate sul banco.

Ambiente, già pronto: banco `banco-prova-vetcare` acceso (porte 57321/57322,
`postgresql://postgres:postgres@127.0.0.1:57322/postgres`), Supabase CLI 2.111.0,
`psql` 18.4. I gate girano col `node` di sistema (P.0-igiene, chiusa); le **batterie**
`node --test` vogliono `~/scoop/apps/nodejs-lts/current/node.exe` (il glob su Node 20
non si espande).

## Deliverable

1. **La regola nella skill: ogni schema forgiato emette i privilegi per iscritto.**
   Nel comando `forge` di `SKILL.md` e nelle references (dove oggi è solo l'esempio del
   §Il caso peggiore): una migrazione di privilegi espliciti — `revoke` di ciò che i
   default concedono, poi `grant` scritti per `anon`, `authenticated` **e
   `service_role`**, coerenti col modello di accesso dello Specchio. Decidi tu la forma
   esatta (tabella per tabella o per schema, e se serva anche `alter default
   privileges` per gli oggetti delle migrazioni successive) — ma **ogni premessa la
   provi su Postgres reale prima di scriverla nella regola** (§18): il banco è acceso
   apposta. Ricorda il precedente misurato: senza `revoke` prima, un `grant` per colonna
   non restringe niente (§22).
2. **L'audit impara a vedere questo difetto.** La regola 6 («RLS e policy in ordine ma
   nessun `grant`») **non è scattata** sul banco — il direttore ha verificato che l'ACL
   non era vuota (`Dxtm`), e la regola evidentemente non distingue *quali* privilegi.
   Prima **spiega con una misura** perché taceva, poi correggila: una policy per un
   ruolo il cui privilegio corrispondente manca (policy di `select` per `anon`, e `anon`
   senza `select` sulla tabella) è un finding. La gravità la decidi col criterio §17 —
   qui la prova è **interamente nel catalogo** (`pg_policies` + `relacl`), niente
   euristica sul nome. Test: il caso che scatta **e** quello che non deve scattare
   (tabella coi grant giusti; e il caso `Dxtm` che oggi la regola promuove).
3. **Il banco torna al SUO rosso, con una migrazione nuova.** Le migrazioni applicate
   sono immutabili: scrivi una migrazione di privilegi espliciti in coda (la stessa che
   la skill corretta avrebbe emesso). Il verdetto atteso è **falsificabile, e lo
   verifichi**: gate **ROSSO, 2 falliti, 0 verifiche mancanti su 9** —
   - `audit RLS` → FAIL col **`block` su `staff.job_title` che DEVE tornare**: oggi
     tace perché nessuno può scrivere niente; coi grant giusti l'auto-promozione torna
     possibile e la regola deve rivederla. Se non torna, la tua migrazione ha concesso
     male o la regola è rotta;
   - `pgTAP` → FAIL che torna a **2 asserzioni su 23** (i test storici 22-23:
     auto-promozione del veterinario e visita che nasce `fatturata`), non 9+11 per
     `permission denied`.
   I difetti intenzionali del banco **restano**: le 12 `security definer` PUBLIC, le 20
   policy permissive, la `using (true)` su `species` sono il suo scopo (D7). Riallinea
   l'handoff del banco (`docs/handoff/07-schema-forge.md`): il verdetto resta `Gate:
   ROSSO` ma i **motivi** scritti devono tornare quelli storici — il passo
   `contratto-uscita` verifica la riga, tu verifica la prosa.
4. **sqlfluff e squawk installati** (`pipx install sqlfluff squawk-cli`; se `pipx`
   manca, installalo e documenta come). Il gate deve chiudere **senza verifiche
   mancanti**: erano gli ultimi due MANC.
5. **Guardiani della skill eseguiti**: `npm install` in `agenti/schema-forge/` (i
   `node_modules` non sono installati su questa macchina — residuo di P.0-igiene), poi
   ESLint e knip locali sugli script toccati. Esiti nel verbale, MANCANTE ≠ PASS.
6. **Una voce nuova in `DECISIONI.md`** (in coda, numerazione progressiva): la regola
   generale coi suoi tre episodi misurati — *i privilegi si scrivono nelle migrazioni,
   perché i default di Supabase sono cambiati due volte in un mese e nessuno dei due
   cambiamenti era annunciato dallo schema*.
7. **`STATO.md` aggiornato**: le due richieste storiche chiuse (revoke nella regola;
   `service_role` nei permessi espliciti), i numeri nuovi (test, regole), e il residuo
   che resta **fuori** per D7, dichiarato: la versione della CLI e dell'immagine
   Postgres continua a non essere versionata da nessuna parte.
8. **Test: da 146 in su, tutti verdi**, con la batteria rilanciata
   (`node --test "scripts/**/*.test.mjs"` col Node 24 di scoop).

## Regole d'ingaggio

- **Ogni premessa si prova su Postgres reale prima di diventare regola o reference**
  (§18): è la regola che ha già smentito due proposte scritte bene (`STATO.md` §Due
  premesse smentite). Il banco è acceso: usalo.
- **Il banco non si sana**: è il caso di prova permanente di uno schema difettoso
  (`DECISIONI.md` §20/§25). Il tuo lavoro gli restituisce il rosso *giusto*, non il verde.
- **MANCANTE ≠ PASS**; il gate dichiara sempre cosa ha guardato (§11).
- Le regole nuove nascono in `audit-lib.mjs` con i loro test, i gusci non giudicano.
- Perimetro: `agenti/schema-forge/**`, `banco-prova-vetcare/**` (migrazione nuova in
  coda + handoff + docs), la voce nuova in `DECISIONI.md`, la riga P.8 di `CANTIERE.md`
  a consegna. **Fuori**: gli altri agenti (le proposte restano proposte), il seed
  `auth.users`/`identities` (altra classe, D7), qualunque sanatoria dei difetti
  intenzionali del banco.
- Commit per blocco sensato, messaggi in italiano nello stile della casa.

## Verbale di chiusura (obbligatorio)

Riporta al direttore in un unico messaggio finale:

1. le ACL del banco **prima e dopo** la migrazione, incollate (`relacl` su un campione);
2. la spiegazione **misurata** del perché la regola 6 taceva, e la regola corretta col
   suo test;
3. l'uscita del gate sul banco **prima e dopo**, incollate — dopo: ROSSO, 2 falliti,
   0 mancanti, col `block` su `staff.job_title` tornato e pgTAP a 2/23;
4. conteggi test prima/dopo ed esiti dei guardiani;
5. cosa NON è stato fatto, e perché;
6. la riga finale, testuale:
   `P.8 consegnata. Gate del banco: ROSSO atteso (2 falliti, 0 verifiche mancanti su 9) — rosso storico ripristinato.`
   — o la verità, se è un'altra.
