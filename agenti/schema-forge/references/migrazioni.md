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
4. Il rollback è possibile? Se no, va scritto nell'handoff **prima** di applicare

## Rollback

Ogni migrazione dichiara come si torna indietro: SQL inverso in commento in testa al file, oppure la riga esplicita `-- IRREVERSIBILE: perdita di <cosa>`. Un'irreversibilità dichiarata è una decisione; un'irreversibilità scoperta dopo è un incidente.
