# Variabili, runtime, riproducibilità

> Le tre cose che rendono una build **rifacibile su un'altra macchina** — e
> quindi disfacibile. Un deploy che non si sa rifare non si sa nemmeno tornare
> indietro: il rollback è una build precedente, e se quella build non è
> riproducibile il rollback è una speranza.

## 1. Quali radici finiscono nel pacchetto

Il runbook lo **dichiara** (`Radici spedite:`), e il gate lo usa per decidere
dove contare le variabili. Senza quella riga il passo `ambiente` è **MANCANTE**,
e non è pedanteria: per un progetto Web Gun l'elenco dei file che leggono
`process.env` è

```
src/lib/seo.ts                  NEXT_PUBLIC_SITO_URL
src/lib/supabase/public.ts      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
src/lib/supabase/server.ts      idem
src/lib/supabase/middleware.ts  idem
e2e/helpers/db.ts               SUPABASE_SECRET_KEY, SUPABASE_URL      ← NON spedito
playwright.config.ts            E2E_BASE_URL                            ← NON spedito
scripts/prova-concorrenza.mjs   PGPASSWORD, SUPABASE_DB_URL             ← NON spedito
```

(misurato sul pilota il 2026-08-06). Contare tutto insieme darebbe **otto**
variabili di produzione invece di tre, e chiederebbe di impostare sul pannello
del provider la chiave che scavalca le policy — cioè il gate spingerebbe verso
esattamente ciò che la Legge n°3 vieta. Contare le radici sbagliate non è un
errore di conteggio: è un rosso sull'imputato sbagliato, che è il modo in cui un
controllo perde credito.

Il valore predefinito, quando il runbook tace, è `src`, `next.config.*` — ma
resta un MANCANTE, perché un default non è una dichiarazione.

## 2. Come si contano le variabili lette

Tre forme, non una:

```ts
process.env.NOME           // quella che si scrive per prima
process.env["NOME"]        // e le due che restano scoperte se guardi solo la prima
process.env['NOME']
```

E una quarta che **non si può contare**:

```ts
const { NOME_A, NOME_B } = process.env;   // i nomi non si risolvono staticamente
```

Su questa il passo produce un `issue` che **nomina il file e dichiara di non
aver potuto leggere**. È la regola generale di questa casa applicata qui: *un
passo che tace su ciò che non ha letto è un passo che dichiara di aver letto
tutto.*

## 3. `NEXT_PUBLIC_*`: il momento in cui vengono lette

È la cosa che costa di più quando la si scopre dopo.

Una variabile con quel prefisso **non viene letta a runtime**: `next build` la
sostituisce nel codice, testualmente, mentre costruisce. Quindi:

- impostarla sul pannello **dopo** la build non cambia niente nell'artefatto già
  costruito;
- cambiarla richiede **un nuovo deployment**, non un riavvio;
- e su un progetto Web Gun tocca cose che non si rigenerano mai da sole.

Il caso concreto, scritto dal pilota nel proprio `.env.example` prima che questa
skill esistesse: da `NEXT_PUBLIC_SITO_URL` discendono `canonical`, Open Graph,
`sitemap.xml` e `robots.txt`. I due file sono **prerenderizzati una volta
sola**: impostare la variabile solo a runtime ripara le pagine — che hanno un
ISR e si rigenerano — e lascia rotti proprio i due file che parlano ai motori di
ricerca. Un guasto che non si vede guardando il sito.

Per questo il runbook dichiara, per ogni variabile, **quando** viene impostata,
e per una `NEXT_PUBLIC_*` la sola risposta accettata è «prima della build».

**E il nome va copiato, non ricordato.** Il pilota usa `NEXT_PUBLIC_SITO_URL`
(italiano, come il resto del progetto). `NEXT_PUBLIC_SITE_URL` è il nome che usa
ogni tutorial, non viene letto da nessuno, e sul pannello dell'hosting **sembra
lavoro fatto**. È il motivo per cui una variabile dichiarata e mai letta è un
`issue` invece che niente.

## 4. Cosa il runbook può contenere, e cosa no

`docs/deploy.md` è **committato**. Quindi:

| | nel runbook |
|---|---|
| il **nome** di ogni variabile | sempre |
| **quando** viene impostata | sempre |
| il **valore** di una `NEXT_PUBLIC_*` | sì — è pubblico per costruzione, e scriverlo è l'unico modo perché chi firma veda che il dominio è quello giusto |
| il **valore** di qualunque altra | **mai** |

Un valore di servizio nel runbook è un `block` del gate, e la ragione è la
stessa per cui esiste il passo `segreti`: quel file parte col deploy.

## 5. Il runtime, e perché dichiararlo non basta

`engines.node` in `package.json` è una **dichiarazione**. Nessun provider la
impone senza `engine-strict`: con `engines: {">=22"}` e la macchina a Node 20 la
build fallisce esattamente come prima, solo con la colpa assegnata.

Il gate fa due cose distinte:

1. **Misura** `engines.node` contro l'`engines.node` di **ogni dipendenza
   installata**, e prende il più esigente. Sul pilota il 2026-08-06:
   `@supabase/auth-js` e `@supabase/realtime-js` dichiarano `>=22.0.0`, e il
   progetto non dichiarava niente. È il debito n°32, ritrovato da una misura
   invece che letto da un elenco.
2. **Confronta** con `Runtime del provider:` scritto nel runbook. È la riga che
   trasforma una prescrizione in un confronto: se il pannello dice Node 20 e le
   dipendenze ne vogliono 22, il gate lo dice **prima** che la build fallisca.

### Come si legge un range `engines`

Il confronto è **fra minimi**, non fra range arbitrari. E `||` è un'**unione**:
il minimo di un'unione è il **più piccolo** dei minimi, non il primo che si
incontra.

```
">=22.0.0"            → 22
"^18.17.0"            → 18
"^20.12||^22||>=24"   → 20      ← «da 20.12 in su», non «da 24 in su»
"^20 || cosa-strana"  → null    ← illeggibile: non si indovina
```

L'ultimo caso è deliberato: se un'alternativa non si sa leggere, **tutta**
l'unione è illeggibile, perché potrebbe essere proprio quella che ammette la
versione più bassa. Alzare il minimo di un'unione non capita significa
rifiutare un progetto corretto — e un rifiuto indebito è il difetto peggiore di
un gate, perché insegna a scavalcarlo. Questa regola è nata da un rifiuto
indebito vero, misurato sul pilota su `dependency-cruiser`.

## 6. Il lockfile

Senza, la build del provider **non è la tua build**: risolve le versioni il
giorno in cui gira, e due deploy dello stesso commit possono installare
dipendenze diverse. Il gate pretende che ce ne sia uno **e che sia tracciato da
git**: un lockfile presente sul disco e non tracciato è identico a non averlo,
con l'aggravante che sembra a posto.

Più lockfile di gestori diversi sono un `issue`: il provider ne sceglie uno, e
non è detto sia il tuo. `packageManager` in `package.json` toglie l'ambiguità, e
la sua assenza è un `warn` — non blocca, ma è la riga che rende esplicita una
scelta che altrimenti è inferita.

## 7. Cosa resta comunque fuori

- **Che le versioni installate siano quelle del lockfile.** Il gate legge il
  lockfile e l'albero installato come due cose separate; non verifica che il
  secondo discenda dal primo. `npm ci` lo garantisce, ed è una prescrizione del
  runbook.
- **Che il provider rispetti `engines`.** Vedi sopra: si dichiara, si scrive nel
  pannello, e il gate confronta le due dichiarazioni. Nessuna delle due è la
  macchina vera.
- **Che i valori impostati sul pannello siano quelli giusti.** Il gate conosce i
  nomi e sa che un `NEXT_PUBLIC_*` di indirizzo non deve essere `127.0.0.1`. Che
  `https://fornodoro.it` sia il dominio del cliente lo sa chi firma.
