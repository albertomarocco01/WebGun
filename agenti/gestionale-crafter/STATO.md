# STATO — gestionale-crafter

**A che punto è:** strumento collaudato su due banchi e su un progetto pilota, **mai usato per un cliente vero** — e le correzioni del 2026-08-07 non hanno ancora visto un database.
**Proprietario:** Alberto
**Ultima misura:** 2026-08-07 — batteria **230/230 verdi**, ESLint 0, knip 0, semgrep **8** con `--config=auto` (200 regole, 10 file) e **0** con `p/javascript`+`p/secrets`. L'ultima corsa del gate contro un progetto vivo è più vecchia: 2026-08-06 sera tardi, pilota `cavia`, **VERDE 7/7**.

## Cosa fa

Costruisce il **backoffice** dei siti Web Gun — viste CRUD con cui il cliente amministra i propri dati (prodotti, ordini, magazzino, clienti, personale) e i testi delle sezioni del sito — sopra lo schema e le policy di **schema-forge**. Stack: Next.js App Router + TypeScript + Tailwind + Supabase. È anche l'erede del CMS che la pipeline non ha più: se i contenuti editabili non li fa lui, finiscono scritti nel codice.

1. **Il modello prima delle viste (Specchio del gestionale).** Non genera nulla finché non ha riformulato *chi amministra cosa, con quale ruolo* e ottenuto conferma. In pipeline conferma l'orchestratore, ma il modello assunto si **scrive** nell'handoff; cinque scelte fermano comunque la pipeline e vanno all'umano: modello dei ruoli, ambito mono/multi-sede, confine dei contenuti editabili, proprietà della porta d'ingresso, elenco delle entità amministrate.
2. **Gli strumenti giudicano, non l'LLM.** Una vista è pronta se `verify.mjs` chiude verde su un progetto vero. Strumento assente = **verifica mancante**, mai un falso «tutto pulito».
3. **Nessuna rotta admin nuda, nessuna scorciatoia sulla RLS.** Guardia di autenticazione **e** ruolo eseguita sul server su ogni rotta; ogni query passa dalla sessione dell'utente. La `service_role` non entra nel progetto: un permesso che manca è una conversazione con schema-forge, non un cambio di chiave.

> **Deroga dichiarata** (`../../DECISIONI.md` §21): `fly-ui` non esiste, quell'agente non esiste. I componenti si scrivono a mano dietro la cucitura `src/components/ui/*`, fatta per essere sostituita.

## Il gate

**7 passi**, tre stati. `skipped` **non è un successo**: è una verifica mancante, e il gate resta rosso.

| passo (`id`) | cosa prova |
|---|---|
| `config` | `gestionale.config.json` c'è ed è valido, e dice dove sta il gestionale — niente audit su un default silenzioso |
| `entities` | ogni tabella dei tipi generati ha una vista **o** una riga fra le `escluse` con motivazione scritta |
| `admin-audit` | rotte scoperte, azioni server senza guardia, `service_role`, client Supabase fuori dai moduli dichiarati, colonne scritte senza permesso |
| `types-fresh` | `database.types.ts` è quello che lo schema genera oggi, non tipi vecchi |
| `tsc` | i tipi compilano, e `tsconfig.json` dichiara `strict: true` esplicito — altrimenti MANCANTE col motivo |
| `a11y` | `eslint-plugin-jsx-a11y` **sui sorgenti** di viste e componenti, con la config della skill (D21) |
| `handoff` | l'handoff esiste, non ha segnaposto del template, e la sua riga `Gate:` **coincide** col verdetto misurato |

```bash
# dalla radice del progetto generato
node "<skill>/scripts/verify.mjs" [--progetto <dir>] [--db-url <url>] [--json]
# uscita: 0 verde · 1 rosso · 2 errore di esecuzione

# l'audit da solo
node "<skill>/scripts/admin-audit.mjs" [--progetto <dir>] [--db-url <url>] [--json]
```

L'audit ha **sei regole** (`regolaGuardieRotte`, `regolaAzioniServer`, `regolaServiceRole`, `regolaFabbricaClient`, `regolaMiddleware`, `regolaScritture`) con **11 punti di emissione** fra `block` e `issue` — misurato sul sorgente: il vecchio STATO diceva «nove».

Invarianti da mantenere toccandolo (i perché stanno nei commenti del codice):

- **Nessun `pass` si deduce da un codice d'uscita**: ogni passo misura prima la propria premessa (quanti file, quante rotte, catalogo letto sì/no) e stampa il bersaglio anche quando è verde. Zero rotte trovate è `skipped`.
- **Le regole con cui si misura viaggiano con la skill** (`resources/config/eslint-a11y.config.mjs`, ESLint della skill), e **nessun eseguibile si cerca nella directory corrente** (`scripts/eseguibili.mjs`): un progetto non sceglie il binario che lo giudica.
- **Un `fail` non ha mai il dettaglio vuoto**, e ogni chiamata a processo ha un limite di tempo: un gate muto non è né verde né rosso, è assente. **Le regole stanno nelle lib pure**, i gusci fanno solo I/O.

Tre premesse smentite dalla misura, e per questo scritte nelle `references/`:

- **Un route handler non esegue i layout**, quindi la guardia della sezione non lo protegge: senza cookie `GET /admin` → `307`, `GET /admin/stato` nella stessa cartella → **`200`**. A non far uscire i dati fu la RLS.
- **Su Supabase i `grant` nelle migrazioni sono no-op, e il `grant` per colonna da solo non restringe niente**: `pg_default_acl` concede `arwdDxtm` ad `anon` e `authenticated` su ogni tabella nuova, quindi senza `revoke` esplicito la colonna `ruolo` resta scrivibile (pgTAP: un magazziniere si è promosso titolare).
- **`information_schema.column_privileges` non dice se una colonna è ristretta**: mostra la stessa riga nei due casi opposti. La verità sta in `pg_class.relacl` + `pg_attribute.attacl`, ed è lì che l'audit legge.

## Come si prova

```bash
cd agenti/gestionale-crafter && npm install && npm test
```

**230 test verdi**, 46 suite, ~2 s (misurati il 2026-08-07). Lo script è `node --test "scripts/**/*.test.mjs"`: le virgolette servono (su Node ≥ 24 il percorso è un glob) e la batteria **vuole Node 21+** — il node di sistema qui è 20.12.2 e non basta. Gli script del gate girano invece da **Node ≥ 20**.

**Banco: non ce n'è più uno.** I tre banchi (`banco-prova-negozio`, `banco-prova-accademia`, `banco-sporco`) sono stati cancellati il 2026-07-30 (`../../DECISIONI.md` §25) e stanno nel commit `67f9001`: tornano con `git checkout 67f9001 -- <banco>`. Esclusi perché un clone pulito non li sa rilanciare — ai primi due manca il `.env.local` che il gate legge, gitignorato di proposito.

Il gate si lancia dalla radice di un progetto generato che abbia `gestionale.config.json`, i tipi, `node_modules` e uno stack Supabase acceso; vale sia il percorso reale sia la junction `.claude/skills/gestionale-crafter/`, che è il canale con cui lo vede una chat aperta sul progetto — entrambi hanno un test di regressione.

**Vederlo diventare rosso senza un banco.** I quattro sabotaggi riprodotti al collaudo, ognuno su un progetto generato qualunque: rimetterlo com'era è un `git checkout`.

```bash
# 1. un route handler admin senza guardia → block
#    (un route.ts NON esegue i layout: la guardia della sezione non lo copre)
mkdir -p src/app/admin/stato && cat > src/app/admin/stato/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { clientServer } from "@/lib/supabase/server";
export async function GET() {
  const supabase = await clientServer();
  const { data } = await supabase.from("customers").select("id, email");
  return NextResponse.json({ clienti: data });
}
EOF

# 2. una chiave che scavalca le policy → block
echo 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;' > src/lib/supabase/admin.ts

# 3. un form che scrive la colonna del ruolo → block
#    (in src/modules/personale/azioni.ts, aggiungi `ruolo:` all'update)

# 4. un handoff che dichiara un verdetto diverso da quello misurato → passo 7 rosso
sed -i 's/Gate: VERDE/Gate: ROSSO/' docs/handoff/10-gestionale-crafter.md
```

| Prerequisito / sintomo | Rimedio |
|---|---|
| Supabase CLI + Docker assenti → `types-fresh` MANCANTE, niente catalogo permessi | installali, accendi lo stack |
| `psql` fuori dal PATH → «permessi non letti» | `%USERPROFILE%\scoop\apps\postgresql\current\bin`, oppure `--db-url` |
| `node_modules` del progetto assente → `tsc` e `a11y` MANCANTI | `npm install` nel progetto |
| `tsc` e `a11y` falliscono col **dettaglio vuoto**: su Windows `where npx` elenca per primo lo script senza estensione (quello per Git Bash), che `spawnSync` senza shell non sa eseguire | chiuso in `scegliEseguibile` (`scripts/eseguibili.mjs`), che sceglie il primo eseguibile vero (`.exe`, poi `.cmd`); se ricompare, l'errore di spawn ora **si legge** nel dettaglio |
| `tsc` fallisce citando file che non esistono più | sono i tipi di rotta rimasti in `.next/types/` (e `.next/dev/types/`) dopo aver cancellato una rotta: `rm -rf .next` prima del gate |
| due stack Supabase accesi → container `unhealthy`, e su 16 GB Windows uccide le finestre dell'IDE | **un solo stack alla volta** (`supabase stop --no-backup` sull'altro progetto); porte sotto 49152, perché gli intervalli riservati da WinNAT **si spostano fra un riavvio e l'altro** e vanno riletti con `netsh interface ipv4 show excludedportrange protocol=tcp` |
| Node 24.19 su Windows: il processo può morire `3221226505` **dopo** il verdetto | leggere `doc.ok` del `--json`, mai la sola uscita |

## Cosa NON è mai stato provato

- **Nessun collaudo su un progetto cliente vero.** `cavia` (`C:/Users/Utente/Desktop/cavia`) e i banchi sono progetti generati della forma giusta: nessun traffico, nessun dato reale, database locale.
- **Il gate nella forma di oggi non è mai girato contro un progetto vivo.** L'ultima corsa vera è del 2026-08-06 sera tardi sul pilota (VERDE 7/7, regia al commit `3b2df31`) e **precede** le correzioni del 2026-08-07 (l'apostrofo che apriva una stringa, `chiaviOggetto`, `corpoFunzione`, `chiaviDiPrimoLivello`, la maschera quadratica): sono provate **per batteria e per sabotaggio su progetti finti**, non da un giro completo con un database dietro.
- **«6 difetti su 6 rilevati» e «VERDE 7/7 sul banco» non si rilanciano in un comando**: misure del 2026-07-28 su banchi che non stanno più su disco.
- **Il gate non sa se la guardia chiede il ruolo *giusto*.** Misurato: sostituita `richiediRuolo("direttore")` con `richiediStaff()` sulla vista del personale — cioè aperta la gestione del personale a qualunque insegnante — l'audit ha risposto **«nessun bloccante»**. La rotta *una* guardia ce l'ha; che sia quella giusta è una domanda di dominio e nessuna euristica la copre. A limitare il danno restavano solo le policy del database (`cambia_ruolo` verifica chi chiama, il `grant` per colonna nega la scrittura di `ruolo`): il gate non l'ha visto, la RLS di schema-forge l'ha retto.
- **La lettura delle scritture è un'euristica di testo, non un parser TypeScript.** Regge `.from("t").update({…})` nella forma che questa skill genera; una catena costruita a pezzi, un nome di tabella in una variabile o un oggetto costruito altrove le sfuggono — e il finding che manca non fa rumore.
- **Le colonne di privilegio si riconoscono dal nome** (`ruolo`, `role`, `is_admin`, `job_title`…): una colonna `livello` che decide dei permessi non la vede nessuno.
- **`tsc` verde non è «funziona»**, e **non c'è nessun test end-to-end**: è il perimetro di flow-sentinel e va lasciato lì — un agente che si testa i flussi da solo si dà anche i voti.
- **Nessuna regola sul grafo degli import**: chi *importa* un modulo con `service_role` non viene segnalato, viene segnalato il modulo. `dependency-cruiser` è la prima cosa da aggiungere se il difetto si ripresenta di traverso.
- **Storage non è verificato**: l'upload di immagini dei contenuti non lo guarda nessuno strumento (`storage` non è uno schema esposto).
- **L'accessibilità misurata è solo quella che `jsx-a11y` sa vedere, e solo sui sorgenti** (D21): non l'HTML servito, non l'ordine di tabulazione, non la comprensibilità di un messaggio d'errore.
- **Nessun passo guarda il database di produzione**: legge il catalogo del progetto locale. Un `grant` diverso in produzione è un altro mondo.
- **Tre cose sono fuori dal gate per scelta dichiarata**: `next build` (minuti per bundling e prerendering, che non riguardano l'accesso ai dati); il **gate di schema-forge**, che resta un passo del flusso e una casella di checklist perché qui sarebbe un secondo `db reset`; **`npm audit`**, che porterebbe una lettura di rete in un controllo deterministico — restano note CVE nella catena `eslint` (dev) e in `sharp`/`postcss` (transitive di `next`), ed è lavoro della build del progetto generato.
- **Un solo dominio nelle reference**: gli esempi restano e-commerce. Il secondo dominio (accademia musicale) non ha prodotto falsi positivi, ma non prova che il terzo andrà liscio.

## Debito aperto

| cosa | perché resta | chi lo chiude |
|---|---|---|
| Il gate non confronta la guardia col modello di dominio | serve leggere il modello dall'handoff a monte in **forma verificabile**: struttura che l'handoff di schema-forge oggi non ha. Finché non esiste, la difesa è a mano e ha una forma minima misurata sul pilota — **non una dichiarazione, una tabella di richieste e risposte**: limite aggirato zero volte e verificato a mano **undici**, con due sessioni vere sull'app (utente cucina → `307 /admin?motivo=vietato` su cinque rotte su cinque) | direzione + schema-forge |
| `scrittureNelCodice` scarta **in silenzio** le scritture che non sa leggere, e `misure.scritture` ne dichiara meno di quante ce ne sono; manca `scrittureNonLette` | verde falso, gemello di «azioni server: 1» già chiuso sull'altro passo (rilievo P8 del concilio 2026-08-07) | gestionale-crafter |
| `regolaMiddleware` cerca solo `middleware.*`: su Next 16.3+, che deprecia quel nome a favore di `proxy.*`, la regola **non scatta mai** | nel pilota il file è stato tenuto col nome vecchio *apposta* per non spegnere il controllo: la scelta che una skill non dovrebbe costringere a fare | gestionale-crafter |
| Lo Specchio non chiede, per ogni entità esclusa e ogni controllo omesso, «**lo impedisce il database? sì/no, e con cosa**» | tre rilievi su cinque del tribunale del pilota avevano questa forma: decisioni di interfaccia firmate come confini. Il caso peggiore è una garanzia falsa in un documento firmato dal committente, smentita da `PATCH /rest/v1/personale` → `HTTP 200` | gestionale-crafter (template dello Specchio) |
| `azioniPubbliche` non distingue «la guardia» dal «sito»: su un progetto con vetrina vede le server action pubbliche del sito | senza dichiararle è un `block`, dichiarandole si allarga una lista che il messaggio descrive come «accesso e uscita, non altro»: servono due gettoni | gestionale-crafter |
| Il messaggio della regola sulle colonne di privilegio dice «è **auto-promozione**», e non l'ha misurato | nel pilota il database concede la colonna *ma* un trigger vieta di toccare la propria riga: falso positivo. Deve dire «il modulo scriverebbe una colonna che decide i permessi» | gestionale-crafter |
| Le azioni generate fanno `throw new Error(error.message)`: vincoli e policy di Postgres possono arrivare all'interfaccia | serve `next build && next start` e l'ispezione della risposta di rete di un'azione che forza un errore. Ricetta scritta, misura no | pacchetto con un'app viva |
| `--db-url` resta nell'`argv` dei processi Node a monte di `psql` | chiuso **alla foglia** (la chiamata a `psql`), non lungo la catena: per tutta la durata del gate la password è leggibile nella tabella dei processi | direzione (vale per tre skill) |
| semgrep `--config=auto`: **8 rilievi dichiarati, nessuno corretto** — 5 `detect-non-literal-regexp` (`audit-lib.mjs` 260/432/444, `progetto-lib.mjs` 24/444), 3 `detect-child-process` (`verify.mjs` 111/182, `eseguibili.mjs` 195) | le regex si costruiscono da nomi della configurazione del progetto, dietro `perRegExp` che semgrep non vede; un gate che lancia strumenti lancia processi. Dichiarati, non silenziati | gestionale-crafter |
| `chiudeLaStringa` non limita la scansione alla riga per il backtick (lo fa per `'` e `"`) | costo, non correttezza: un backtick spaiato costa una scansione dell'intero file, al più una volta per file | gestionale-crafter |
| `jscpd`: 5 cloni, 48 righe (1,09%) | residuo dichiarato e stabile da P.7d; nessun clone nuovo | gestionale-crafter |
| **Proposta verso schema-forge, mai portata**: l'analisi di impatto per grep che `evolve` prescrive prima di rinominare una colonna non distingue una colonna da un tag o attributo HTML omonimo, e i **test pgTAP non sono nell'elenco dei consumatori da riallineare** | misurato rinominando `site_content.body` in `corpo` (expand-contract completo) su un gestionale vero: il grep di `\bbody\b` restituiva anche il `<body>` del `layout.tsx`, e a trovare davvero tutti i consumatori è stato **`tsc` sui tipi rigenerati** (15 errori in 4 file, codice non toccato). Dopo la stessa rinomina i test pgTAP citavano ancora la colonna vecchia: `Failed tests: 8, 17`, con `throws_ok` che catturava l'errore *sbagliato* (colonna inesistente invece di permesso negato). La procedura di `evolve` prescrive di riallineare solo `seed.sql`: pgTAP è un consumatore esattamente come il seed | schema-forge |

## Com'è andata (in breve)

Costruita a luglio 2026, collaudata il **2026-07-28** su due banchi: un e-commerce di maglieria (8 tabelle, 6 migrazioni, 20 asserzioni pgTAP) e — collaudo avversario — un'accademia musicale, dominio che nessuna reference aveva previsto. Gate **VERDE 7/7** sul primo, **6/7 al primo colpo** sul secondo, **6 difetti piantati su 6 rilevati**, **0 falsi positivi** sul gemello pulito. Lo stesso giorno il tribunale trovò **6 difetti reali dove il gate diceva pulito**, e **5 su 6 stavano nel pattern che questa skill prescrive**: sarebbero finiti in ogni progetto generato.

Due igieni: il **2026-08-03** gate e audit uscivano `0` **muti** sul Node di sistema (`import.meta.main` è arrivato in Node 24, e sull'audit `0` è proprio il codice di «nessun bloccante»: il silenzio si travestiva da esito buono); il **2026-08-04** la stessa cosa dalla junction, perché `resolve(process.argv[1])` non scioglie un link. Il **2026-08-05** il pilota `cavia` ha chiuso VERDE 7/7, lasciando quattro rilievi ancora in tabella. Il **2026-08-06** `/code-inquisition` sugli script ne ha portati **dieci**, quattro dei quali sulle regole che dovrebbero fermare gli altri: P.7d li ha chiusi tutti riproducendo ognuno prima di correggere (batteria **111 → 173**); P.7e ha chiuso n°50, n°51 e n°52 (**→ 208**), e il tribunale sul pacchetto stesso — 19 rilievi, **due dei quali regressioni di P.7e** — ha portato la batteria a **230**.

Il filo conduttore, cinque istanze in due giorni: **uno scanner scritto a mano che non sa in quale contesto si trova.** `"@/*"`, l'alias che `create-next-app` scrive in ogni progetto Next, apriva un commento nel `tsconfig.json` e ne divorava 102 byte, lasciando il gate **rosso su ogni progetto che questa casa genera**; due stringhe qualunque cancellavano la riga di una chiave `service_role`; una `{` in una stringa faceva sconfinare il corpo di un'azione server in quella dopo, **che le prestava la guardia**; l'apostrofo di un normale testo JSX italiano (`dell'utente`) lasciava sopravvivere il commento che spegneva la regola, e una rotta admin scoperta usciva con zero findings. Ogni volta la batteria era verde, perché ogni fixture era modellata sull'implementazione invece che sull'input vero — e una delle correzioni ha reso `scrittureNelCodice` quadratica (3 200 scritture in **15,5 s**, ×24; oggi **555 ms**).
