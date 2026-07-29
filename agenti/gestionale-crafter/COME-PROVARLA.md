<img src="resources/branding/gestionale-crafter-logo.png" alt="Gestionale Crafter" width="220">

# Come provare Gestionale Crafter

Guida pratica: cosa fa l'agente, come vederlo lavorare, e cosa un gate verde **non** dimostra.

> Ogni comando qui sotto è stato **eseguito davvero** il 2026-07-28 su questa macchina (Windows 11, Node 24.14.0, Supabase CLI 2.95.4, Docker 29.4.1, psql 18.4). Le uscite riportate sono quelle vere, non ricostruite.

---

## 1. Come funziona, in una pagina

### Le tre leggi

1. **Il modello prima delle viste** — lo Specchio del gestionale si ferma e aspetta conferma.
2. **Gli strumenti giudicano** — `verify` su un progetto vero, non «sembra a posto».
3. **Nessuna rotta admin nuda, nessuna scorciatoia sulla RLS** — guardia su ogni rotta, sessione dell'utente su ogni query, `service_role` fuori dal progetto.

### I sette comandi

`specchio` (STOP) · `scaffold` · `viste` · `contenuti` · `audit` · `verify` · `handoff`

### L'ordine del flusso

```
1 contesto       brief, docs/PROGETTO.md, handoff 07-schema-forge
2 tipi           database.types.ts allineato alle migrazioni   ← senza, si costruisce sul falso
3 SPECCHIO       ruoli, entità gestite, entità escluse  →  STOP
4 scaffold       config, guardia, moduli client, porta d'ingresso
5 viste          una entità alla volta, già protette
6 contenuti      i testi che il cliente cambia da solo
7 audit          il giro corto: guardie, chiavi, permessi
8 handoff        PRIMA del gate, che ne verifica il verdetto dichiarato
9 VERIFY         ultimo. Finché è rosso, il gestionale non è consegnabile
10 guardiani     code-maniac scan · /code-inquisition sulla superficie critica
```

### Il gate — sette passi, tre stati

| # | `id` (`--json`) | Passo | Cosa becca |
|---|---|---|---|
| 1 | `config` | configurazione | dove sta il gestionale e quali entità dichiara — senza, il gate non audita alla cieca |
| 2 | `entities` | entità ancorate | una tabella dello schema senza vista **e** senza motivazione scritta |
| 3 | `admin-audit` | audit di accesso | rotte scoperte, azioni server senza guardia, `service_role`, client fuori posto, colonne scritte senza permesso |
| 4 | `types-fresh` | tipi allineati | il codice costruito su tipi vecchi |
| 5 | `tsc` | tipi del progetto | ciò che i tipi generati fanno emergere: colonne rinominate, campi spariti |
| 6 | `a11y` | accessibilità | `eslint-plugin-jsx-a11y` sulle viste e sui componenti |
| 7 | `handoff` | contratto d'uscita | handoff assente, con segnaposto, o che **dichiara un verdetto diverso** da quello misurato |

Uscita: `0` gate verde · `1` gate rosso · `2` errore di esecuzione.

`skipped` = **verifica mancante**, e il gate resta rosso. Nessun passo deduce un `pass` da un codice d'uscita: prima misura la premessa (quanti file, quante rotte, catalogo letto sì/no).

---

## 2. Provarla in dieci minuti

### 2.1 Prerequisiti

| Strumento | Obbligatorio | Se manca |
|---|---|---|
| **Node ≥ 20** | sì | gli script sono ESM nativi, zero dipendenze runtime |
| **Supabase CLI + Docker** | sì | passo `types-fresh` **MANCANTE**, e senza database niente catalogo dei permessi |
| **psql** | sì | l'audit non legge i permessi: passo `admin-audit` **MANCANTE** |
| `node_modules` del progetto | sì | `tsc` e `a11y` **MANCANTI** (`npm install`) |

```bash
node --version && supabase --version && psql --version && docker --version
```

### 2.2 Il modo più veloce: i test degli script, senza database

```bash
cd agenti/gestionale-crafter
npm install
node --test "scripts/**/*.test.mjs"
```

Uscita reale del 2026-07-28:

```
ℹ tests 105
ℹ pass 105
ℹ fail 0
```

Su Node ≥ 24 il percorso passato a `--test` è trattato come glob: **le virgolette servono**.

### 2.3 Il gate su un progetto vero

Dalla radice del progetto generato (che deve avere `gestionale.config.json`, i tipi, e uno stack Supabase acceso):

```bash
node "../agenti/gestionale-crafter/scripts/verify.mjs"
node "../agenti/gestionale-crafter/scripts/verify.mjs" --json     # per l'orchestratore
```

Uscita reale sul banco `banco-prova-negozio` (e-commerce, 8 tabelle):

```
GATE GESTIONALE: VERDE (0 falliti, 0 verifiche mancanti su 7 passi)

OK    configurazione del gestionale
        radice admin: src/app/admin · entita' dichiarate: 7 · escluse: 1
OK    entita' ancorate allo schema
        8 tabelle nei tipi: categories, customers, order_items, orders,
        product_variants, products, site_content, staff
OK    audit del gestionale (guardie, RLS, permessi)
        rotte: 8 · azioni server: 6 · scritture: 10 · postgresql://…:57422/postgres
        nessun bloccante (0 issue, 0 warn)
OK    tipi allineati allo schema
OK    tipi del progetto (tsc)
OK    accessibilita' (eslint jsx-a11y)
        controllate: src/app/admin, src/components
OK    contratto d'uscita (handoff)
```

Il dettaglio si stampa **anche sui passi verdi**: è lì che si legge *cosa* è stato guardato. Un audit su metà progetto non deve poter somigliare a un audit completo.

### 2.4 Solo l'audit, senza il giro completo

```bash
node "../agenti/gestionale-crafter/scripts/admin-audit.mjs" \
     --db-url "postgresql://postgres:postgres@127.0.0.1:57422/postgres"
```

Prima riga sempre stampata: quanti file ha letto, quante rotte, quante azioni, quante scritture, e **quale database** ha interrogato. Senza `--db-url` lo prende da `supabase/config.toml` del progetto; se non è risolvibile **non audita alla cieca** e lo dichiara.

### 2.5 Vedere il gate diventare rosso

Sono i quattro modi provati durante il collaudo, ognuno riprodotto:

```bash
# 1. un route handler admin senza guardia → block
#    (un route handler NON esegue i layout: misurato, §4)
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
#    (in `src/modules/personale/azioni.ts`, aggiungi `ruolo:` all'update)

# 4. un handoff che dichiara un verdetto che non è quello vero → il passo 7 fallisce
sed -i 's/Gate: VERDE/Gate: ROSSO/' docs/handoff/10-gestionale-crafter.md
```

L'ultimo, misurato:

```
FAIL  contratto d'uscita (handoff)
        docs/handoff/10-gestionale-crafter.md dichiara `Gate: ROSSO` ma il gate
        chiude VERDE: l'handoff parla di un'altra esecuzione. Riscrivilo con i
        residui di QUESTA
```

---

## 3. Il collaudo, in numeri

Verbale completo: `COLLAUDO-2026-07-28.md`.

| Prova | Esito misurato |
|---|---|
| difetti piantati sul banco sporco | **6 su 6 rilevati** (5 `block`, 4 `issue`: alcuni difetti ne producono due) |
| gemello pulito | **0 findings** su 32 file, 8 rotte, 6 azioni server, 10 scritture |
| gate sul banco pulito | **VERDE 7/7**, uscita `0` |
| test degli script | **105 verdi** |
| secondo banco, dominio non e-commerce (accademia musicale) | gate **6/7** al primo colpo, unico rosso l'handoff non ancora scritto; **0 falsi positivi** |
| `/code-inquisition` sulla superficie critica | **6 difetti reali** trovati dove il gate diceva pulito, 2 confermati da esperti indipendenti con evidenze disgiunte; 5 su 6 erano nel *pattern prescritto dalla skill*, non nel banco |
| correzioni dei rilievi | 5 su 6 **corrette e riprovate** (10 asserzioni pgTAP nuove sull'accademia, 20/20 sull'e-commerce); 1 resta aperta e dichiarata |
| stato finale dei due banchi | gestionale **VERDE 7/7** su entrambi · schema-forge **VERDE 9/9** sull'e-commerce |
| guardiani sugli script | ESLint 0/0 · knip pulito · jscpd pulito · semgrep **6 rilievi dichiarati** · gitleaks **MANCANTE** |

---

## 4. Cosa NON dimostra un gate verde

Questa sezione conta più delle altre. Il precedente sta in casa: il gate di schema-forge dichiarava **VERDE 8/8** su uno schema in cui `/code-inquisition` ha poi riprodotto **16 difetti, 5 Critical**.

**Il gate conta le guardie, non le confronta col modello.** Misurato sul secondo banco: sostituita nella pagina del personale la guardia `richiediRuolo("direttore")` con `richiediStaff()` — cioè aperta la gestione del personale a *chiunque* faccia parte dello staff, insegnanti compresi — l'audit ha risposto:

```
AUDIT GESTIONALE: nessun bloccante (0 issue, 0 warn)
```

La rotta *una* guardia ce l'ha. Che sia quella giusta è una domanda di dominio, e nessuna euristica la copre. A limitare il danno, lì, restavano le policy: `cambia_ruolo` verifica chi chiama, e il `grant` per colonna nega la scrittura di `ruolo`. **Il gate non l'ha visto; la RLS di schema-forge l'ha retto.**

Le altre cose che un verde non dice:

- **la lettura delle scritture è un'euristica di testo**: riconosce `.from("t").update({…})` nella forma che questa skill genera, non una catena costruita a pezzi;
- **le colonne di privilegio si riconoscono dal nome** (`ruolo`, `role`, `is_admin`, `job_title`…): una colonna `livello` che decide dei permessi non la vede nessuno;
- **`tsc` verde non è «funziona»**: dice che i tipi tornano. I flussi li prova Flow Sentinel;
- **l'accessibilità verificata è quella che `jsx-a11y` sa vedere**: etichette, ruoli, alternative testuali — non l'ordine di tabulazione né la comprensibilità di un messaggio;
- **il gate non guarda il database di produzione**: legge il catalogo del progetto locale;
- **il gate non lancia il gate di schema-forge**: è una casella della checklist e un passo del flusso, non un passo automatico.

Le domande da fare a mano, tutte nate da difetti veri di questi due banchi:

- Quale vista è aperta a un ruolo che non dovrebbe aprirla?
- Quale colonna scritta da un modulo cambia **chi è** chi la scrive?
- Quale azione server è raggiungibile senza passare da nessuna pagina?
- Se togliessi la RLS, quante di queste rotte perderebbero dati?

Dopo un gate verde, sulla superficie critica:

```
/code-inquisition src/modules/admin src/app/admin --focus security --depth 1 --council 3
```

---

## 5. Trappole di questa macchina

| Sintomo | Causa | Rimedio |
|---|---|---|
| `tsc` e `a11y` falliscono col **dettaglio vuoto** | `where npx` risponde prima con lo script senza estensione, che `spawnSync` non esegue | corretto nel gate (`scegliEseguibile`): se ricompare, l'errore di spawn ora **si legge** nel dettaglio |
| `tsc` fallisce su file che non esistono più | tipi rimasti in `.next/types/` dopo aver cancellato una rotta | `rm -rf .next` prima del gate |
| `admin-audit` dice «permessi non letti» | `psql` fuori dal PATH, o `[db].port` assente nel `config.toml` | aggiungi psql al PATH (qui: `%USERPROFILE%\scoop\apps\postgresql\current\bin`) o passa `--db-url` |
| `supabase start` lascia container `unhealthy` | due stack Supabase accesi insieme su questa macchina | `supabase stop --no-backup` sull'altro progetto |
| `node --test scripts/` non trova nulla | su Node ≥ 24 il percorso è un glob | `node --test "scripts/**/*.test.mjs"` |
| `gitleaks` | **non installato** | il suo passo vale `MANCANTE`, mai `pass` |

---

## 6. Riepilogo dei comandi

```bash
# test degli script, senza database
cd agenti/gestionale-crafter && npm test

# il gate, dalla radice del progetto generato
node "../agenti/gestionale-crafter/scripts/verify.mjs"

# solo l'audit
node "../agenti/gestionale-crafter/scripts/admin-audit.mjs" --db-url "$DB"

# i guardiani sugli script della skill
node "../code-maniac/scripts/scan.mjs"

# quello che il gate non fa
/code-inquisition src/modules/admin src/app/admin --focus security --depth 1 --council 3
```
