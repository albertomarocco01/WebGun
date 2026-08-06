# I segreti — cosa il controllo vede, e cosa no

> Questa è l'unica responsabilità di Launchpad che non condivide con nessuno:
> **è l'ultimo momento in cui un segreto committato è ancora un problema
> interno.** Dopo, è un problema di chi ha clonato.
>
> La regola che vale per tutto il codice di `segreti-lib.mjs`: **quello che si
> trova non si stampa.** Famiglia, file, riga, e i primi quattro caratteri con
> la lunghezza. Un controllo che ricopia il segreto nel proprio log lo ha
> pubblicato una seconda volta, in un posto che finisce nella CI, nei
> transcript e negli appunti di chi passava.

## 1. Le sei famiglie, e perché sono queste

Una famiglia è **un modo noto in cui un segreto finisce in un repo**, non una
categoria di segreto. La distinzione conta: la stessa chiave arriva per strade
diverse e si riconosce in modi diversi.

| id | cosa riconosce | gravità |
|---|---|---|
| `service-role` | JWT il cui payload decodificato dice `"role":"service_role"`; chiave `sb_secret_…` del formato nuovo | `block` |
| `nome-di-servizio-valorizzato` | `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` con un **valore letterale** accanto | `block` |
| `credenziale-sql` | `crypt('…')`, `encrypted_password = '…'`, `create role … password '…'` — **solo nei `.sql`** | `block` |
| `token-provider` | Vercel, GitHub, Cloudflare, Stripe live, AWS, Slack, chiavi private PEM | `block` |
| `url-con-credenziali` | la password dentro l'autorità di un URL | `block` |
| `entropia-alta` | stringa ≥ 32 caratteri con ≥ 4 bit/carattere, su un nome sospetto | `issue` |

Più due regole che guardano il **nome del file** invece del contenuto: un
`.env*` **tracciato** è un `block` a prescindere da cosa contenga, e un
`.env.example` con un valore vero su un nome sospetto è un `block` perché quel
file esiste per portare i nomi.

### Le due esenzioni, e perché sono scritte accanto alla regola

Il precedente è la §8 di `DECISIONI.md`: *i linter si configurano, il gate non
si declassa* — e ogni esenzione si scrive **nel file, accanto alla regola che
disattiva**, con la motivazione. Qui ce ne sono due, e sono entrambe la stessa
cosa: **un falso positivo sul lavoro corretto degli altri agenti insegna a
ignorare il rosso, e da lì non si torna.**

**a) La chiave anonima di Supabase non è un segreto.** Ha la stessa identica
forma della `service_role` — è un JWT, comincia per `eyJ` — e significato
opposto: viaggia nel bundle del browser e la legge chiunque. È fatta per stare
lì. A difendere i dati sono le policy RLS, non la segretezza di quella stringa;
lo scrive `vetrina-crafter/SKILL.md` §Perimetro e lo ripete il `.env.example`
del pilota. Per questo la famiglia 1 **decodifica il payload** invece di
riconoscere la forma: è l'unico modo di distinguere due stringhe identiche a
occhio. C'è un test che pretende **zero rilievi** sulla chiave anonima nel file
che vetrina-crafter prescrive di scrivere.

**b) `postgresql://postgres:postgres@127.0.0.1:<porta>/postgres` è esente.** È
l'indirizzo che il CLI di Supabase **stampa a ogni `supabase start`**, ed è
scritto in ogni documento di ogni progetto di questa casa. L'esenzione è
stretta: utente e password devono essere **entrambi** `postgres` **e** l'host
deve essere locale. `postgres://postgres:Tr0ub4dor@db.example.com` resta un
`block`.

### Perché `NEXT_PUBLIC_*` è trattata a parte

Una variabile con quel prefisso è **pubblica per costruzione**: `next build` la
scrive nel bundle. Quindi il *nome* non fa scattare né la regola a entropia né
quella sui file di esempio. Ma **il nome non assolve il contenuto**: se dentro
una `NEXT_PUBLIC_*` c'è una chiave `service_role`, la famiglia 1 la trova lo
stesso, perché guarda il valore. Il nome decide soltanto se una stringa opaca
*qualunque* vada segnalata.

## 2. Tre luoghi, tre gravità diverse

Il controllo guarda tre insiemi, e la gravità dipende da **come quel file
arriverebbe al provider**:

| dove | gravità | perché |
|---|---|---|
| **file tracciati da git** | quella della famiglia | è il pacchetto che parte con un deploy connesso al repository. È *il* caso |
| **storia git** | `block`, con un rimedio diverso | un deploy connesso a git dà al provider **la storia**. E toglierlo da HEAD non basta: chi ha clonato ce l'ha già. Il rimedio è **ruotare la credenziale**, e il messaggio lo dice |
| **file ignorati** | `issue`, **una riga per file** | non partono con un deploy da git; partono con un deploy da CLI, che carica la cartella di lavoro. La gravità dipende da una scelta che sta nel runbook (`Modo di deploy:`) |

**Una riga per file, e non una per rilievo**, è una correzione misurata: sul
pilota il 2026-08-06 uscivano 40 `issue`, di cui 34 erano lo stesso file di
segreti dello stack Supabase locale ripetuto. Quaranta righe che dicono la
stessa cosa non sono più informazione: sono il modo in cui un passo si impara a
saltare, e il giorno che dice una cosa nuova nessuno se ne accorge.

E le cartelle che nessun deploy carica sono **fuori** dall'elenco degli
ignorati: `node_modules/`, `.next/`, `out/`, `dist/`, `coverage/`,
`test-results/`, `playwright-report/`, `.perf/`, `supabase/.temp/`,
`supabase/.branches/`, `e2e/.auth/` — e **`.claude/`**, che in questa casa è una
**junction verso la regia**. Senza quest'ultima riga il controllo attraversa il
link e legge un altro repository intero: misurato sul pilota, 181 file
«ignorati» di cui la maggior parte erano i verbali di un'altra skill.

## 3. La premessa prima dell'esito

`DECISIONI.md` §18: *uno strumento che non ha letto niente non produce un
`pass`.* Qui la premessa è `git ls-files`, e il controllo **stampa sempre**
quanti file ha letto, quanti erano binari e quanti commit ha attraversato —
anche quando non ha niente da segnalare.

Zero file letti **non è** «nessun segreto»: è una verifica non fatta, e
`segreti.mjs` esce **2** invece di 0.

I file **binari** non si leggono come testo: il rumore produce falsi positivi.
Si contano, e se uno ha un nome che suggerisce un segreto (`*.key`, `.env*`) si
segnala come `issue` dichiarando che **non è stato letto** — che è diverso da
dire che è pulito.

## 4. Cosa questo controllo NON vede

Elencato qui perché la sua assenza è il modo in cui un verde diventa una firma
in bianco.

1. **Un segreto codificato due volte.** Base64 di un base64, hex di un base64.
   La regola a entropia ne prende una parte, e resta `issue` proprio perché è
   euristica.
2. **Un segreto spezzato e ricomposto a runtime.**
   `const k = "sk_live_" + a + b;` non assomiglia a niente.
3. **Un segreto dentro un binario.** Un token in un PNG, in un `.docx`, in un
   `.xlsx`, in un archivio. I binari si contano e si dichiarano, non si leggono.
4. **Un segreto in un file minificato o generato.** Sintatticamente è una riga
   sola lunghissima; le famiglie funzionano ma il numero di riga non aiuta
   nessuno.
5. **Un segreto che non appartiene a nessuna delle famiglie.** Una chiave API di
   un servizio che non è in elenco, con un formato che non è né un JWT né una
   stringa a entropia alta su un nome sospetto: passa.
6. **Un segreto impostato sul pannello del provider e sbagliato.** Non è nel
   repo, quindi non è affare di questo controllo — ma è la metà del problema che
   nessuno guarda.
7. **Che i segreti veri siano stati ruotati.** Se il controllo ne trova uno, il
   commit che lo toglie chiude il rilievo; **non** chiude l'esposizione. Chi
   legge il rosso deve fare due cose, e il gate ne verifica una.

## 5. Cosa fare quando ne trova uno

Nell'ordine, e l'ordine conta:

1. **Considerarlo compromesso.** Non «probabilmente no perché il repo è
   privato»: un segreto che è stato in un repo è stato su ogni disco che ha
   clonato quel repo, in ogni cache di ogni strumento, e nei log di chiunque
   abbia fatto un `git log -p`.
2. **Ruotarlo**, dal pannello del servizio che lo ha emesso. Questa è la parte
   che chiude l'esposizione, ed è l'unica.
3. **Toglierlo dal repo** e aggiungere il file al `.gitignore`. Questa è la
   parte che chiude il rilievo del gate.
4. **Se era nella storia**, decidere se riscriverla — e sapere che riscriverla
   non è un rimedio, è un'igiene: chi aveva clonato ha ancora la vecchia.
5. **Scriverlo nell'handoff e nel registro del debito**, con quando è stato
   ruotato. Un segreto ruotato e non scritto è un segreto che qualcuno
   rimetterà.

E il caso del pilota, che vale come esempio perché è vero: il seed dichiara due
account con `password123` **e va bene così in locale** — senza, nessuno
potrebbe provare il gestionale, e la batteria E2E ci conia le sessioni. Quello
che non va bene è che quel file **si riusi** su un ambiente vero. Il rimedio non
è togliere il seed: è che il seed di produzione **non porti account**, oppure li
porti con password generate e non committate. Il rilievo del gate non dice
«hai sbagliato»: dice **«questo file non può partire così»**.
