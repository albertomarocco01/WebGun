# Disciplina delle migrazioni

## Immutabilità

Una migrazione **già applicata** (in un ambiente qualsiasi che non sia il tuo locale) è storia: non si modifica, non si rinumera, non si cancella. Ogni correzione è una **nuova** migrazione. Modificare un file già applicato produce ambienti che si credono allineati e non lo sono — il tipo di bug che si scopre in produzione, di venerdì.

Nel dubbio: `supabase migration new <nome_descrittivo>` e si scrive lì.

## Ordine dentro una migrazione

```
1. tipi / tabelle di lookup
2. tabelle
3. vincoli (fk, unique, check)
4. indici
5. trigger e funzioni
6. enable row level security + policy
```
La RLS è **nella stessa migrazione** della tabella. Non esiste un commit in cui la tabella esiste nuda.

## Expand-contract (l'unico modo sicuro di cambiare)

Un cambiamento distruttivo si spezza in migrazioni separate, applicate in momenti diversi:

| Fase | Cosa fa | Reversibile? |
|---|---|---|
| **Expand** | aggiunge la nuova struttura (colonna/tabella), **nullable**, senza toccare l'esistente | sì |
| **Migrate** | popola i nuovi dati dai vecchi (backfill a lotti se la tabella è grande) | sì |
| **Switch** | il codice scrive su entrambe e legge dalla nuova | sì |
| **Contract** | rimuove la vecchia struttura — **solo** quando nessun consumatore la usa più | no |

Rinominare una colonna in un colpo solo rompe ogni client che non è stato ridistribuito nello stesso istante. Rinominare non esiste: esiste aggiungere, copiare, spostare le letture, togliere.

**Il backfill non è sempre meccanico.** *Migrate* sembra il passo ovvio, e lo è finché la nuova struttura è una copia della vecchia. Quando una colonna si **divide in due** (una nota unica che diventa nota di cucina e nota di consegna), o si **fonde**, o cambia unità di misura, la regola di ripartizione è una **decisione di dominio**: nessun dato dice a chi vada la vecchia nota. In quel caso la regola la decide il committente, non l'agente, e la domanda va fatta **prima** di scrivere l'expand — con il default proposto e le sue conseguenze («le metto tutte in consegna: chi le rileggerà vedrà note di cucina archiviate come note di consegna»). Una scelta di backfill non dichiarata è un errore silenzioso che nessun gate può vedere: il database resta valido, i dati diventano sbagliati.

## Operazioni pericolose (squawk le segnala, tu le motivi)

| Operazione | Rischio | Alternativa |
|---|---|---|
| `alter column type` | riscrive la tabella con lock esclusivo | nuova colonna + backfill + switch |
| `set not null` su tabella grande | scansione completa sotto lock | `check (col is not null) not valid` → `validate constraint` |
| `create index` | blocca le scritture per tutta la durata | `create index concurrently` (fuori transazione) |
| `add column ... default <volatile>` | riscrittura completa | default costante (istantaneo da PG11) o backfill separato |
| `drop column` / `drop table` | perdita dati irreversibile | fase contract, dopo verifica dei consumatori |
| `truncate` in migrazione | cancella dati di produzione | mai in migrazione; semmai nel seed locale |

Su un database piccolo appena creato molte di queste sono innocue: la regola è **motivare nell'handoff**, non ignorare.

## Analisi di impatto (prima di `evolve`)

Prima di toccare una struttura esistente, rispondi con dati reali, non a memoria:

1. Chi legge questa tabella/colonna? (grep nel codice, `database.types.ts`, handoff a valle)
2. Esistono viste, funzioni, policy o indici che la referenziano?
3. È già in produzione con dati veri? Se sì → checkpoint umano obbligatorio
4. **Quante righe hanno davvero un valore?** `select count(*) filter (where col is not null)` — non «quante ne useranno», quante ce ne sono
5. Il rollback è possibile? Se no, va scritto nell'handoff **prima** di applicare

### I dati che smentiscono la richiesta si riportano, non si aggirano

L'analisi di impatto non serve a compilare un modulo: serve a **cambiare la conversazione** quando i numeri dicono un'altra cosa. «Il barcode non l'abbiamo mai usato» seguito da *6 varianti su 6 popolate con EAN-13 del fornitore* non è un dettaglio da nota a piè di pagina: è il motivo per cui la richiesta va rifatta.

Regola: se i dati contraddicono ciò che il committente ha detto, **la contraddizione si riporta prima di procedere**, con i numeri. Il checkpoint umano si fa sui dati veri, non sulla memoria del cliente — altrimenti è una firma su un foglio bianco.

### Prima di un distruttivo autorizzato su dati popolati: export

Autorizzato non vuol dire recuperabile. Prima di eseguire un `drop` su una colonna o una tabella **con valori dentro**:

1. esporta i dati (`copy … to` / `\copy`, oppure un `select` salvato) in `docs/export/<cosa>-<data>.csv`
2. **cita il percorso del file dentro la migrazione**, nella riga `-- IRREVERSIBILE`

Un export che non è scritto nella migrazione è un export che fra sei mesi nessuno ritrova. Il file è la differenza fra «dato perso» e «dato fuori dal database».

## Il distruttivo autorizzato e il gate

Problema reale: `squawk` segnala `ban-drop-column` e **non legge le motivazioni in prosa**. Le migrazioni sono immutabili, quindi il rilievo non se ne va più: un `evolve` legittimo, autorizzato dall'umano, lascerebbe il progetto **rosso per sempre** — cioè non consegnabile. Un gate che resta rosso per un motivo corretto è un gate che tutti imparano a ignorare.

La soluzione è dichiarare l'eccezione **nella migrazione**, dove sta anche la motivazione:

```sql
set lock_timeout = '5s';
set statement_timeout = '60s';

-- Distruttivo AUTORIZZATO: checkpoint umano superato il 2026-07-25,
-- dati esportati in docs/export/note-ordini-2026-07-25.csv.
-- squawk-ignore ban-drop-column
alter table public.orders drop column notes;
```

Tre vincoli, tutti verificati sul campo:

- **`-- squawk-ignore <regola>` sta da solo sulla sua riga.** La motivazione va nelle righe **sopra**, mai accanto: squawk legge il resto della riga come altri nomi di regola e il rilievo scatta lo stesso (più due `unused-ignore` in omaggio).
- **Immediatamente sopra lo statement**, e vale solo per quello.
- **Silenzia una sola regola.** Nella stessa migrazione `prefer-bigint-over-int` e le altre restano attive: l'esenzione è chirurgica, non un interruttore generale.

L'esenzione si scrive **mentre si scrive la migrazione**, non dopo: una volta applicata altrove, il file è storia. Se te ne accorgi dopo, aggiungere una riga di solo commento è l'unica eccezione ammessa all'immutabilità — non cambia una virgola del DDL eseguito — e va dichiarata nell'handoff.

Senza autorizzazione umana l'esenzione **non si scrive**. Non è un modo per far passare il gate: è il modo di registrare che qualcuno se n'è preso la responsabilità, con data e motivo, nel file che quella responsabilità la esegue.

## Rollback

Ogni migrazione dichiara come si torna indietro: SQL inverso in commento in testa al file, oppure la riga esplicita `-- IRREVERSIBILE: perdita di <cosa>`. Un'irreversibilità dichiarata è una decisione; un'irreversibilità scoperta dopo è un incidente.
