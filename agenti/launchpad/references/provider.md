# Vercel e Cloudflare — cosa cambia **per questa pipeline**

> Non è un confronto generale fra due piattaforme: è cosa cambia per un
> progetto **Web Gun**, cioè Next.js App Router + TypeScript + Tailwind +
> Supabase, con la forma che gli danno gli altri cinque agenti.
>
> **Regola di lettura.** Prezzi, limiti e nomi dei pannelli cambiano più in
> fretta di questo documento. Ciò che qui è scritto come **struttura** (cosa
> succede al deploy, come si torna indietro, dove finiscono le variabili) è
> stabile; ciò che è scritto come **numero** va riverificato il giorno in cui si
> pubblica, e il numero verificato va nel `docs/deploy.md` del progetto, non
> qui.

## 0. La scelta in quattro righe

| | Vercel | Cloudflare |
|---|---|---|
| Next.js App Router | **di prima parte**: chi fa Next fa la piattaforma | **adattato**: gira attraverso un adattatore, e la superficie supportata è un sottoinsieme che si verifica versione per versione |
| Traffico in uscita | si paga | **non si paga**, ed è il motivo principale per cui si sceglie |
| Rollback | promozione di un deployment precedente, **immutabile** | rollback a una versione precedente |
| Rischio per noi | il vendor lock-in su ISR/middleware | che una funzione dell'App Router non sia supportata **e lo si scopra dopo** |

**Il default di questa pipeline è Vercel**, e il motivo non è la preferenza: è
che quattro agenti a monte producono codice che dà per scontata la semantica di
Next (rendering sul server, ISR, Server Actions, `middleware.ts` con
`@supabase/ssr`), e su Vercel quella semantica è la definizione. Cloudflare si
sceglie **quando c'è un motivo scritto** — traffico, costo, un'infrastruttura
già lì — e la deroga si motiva in `docs/PROGETTO.md` come tutte le altre
(`CLAUDE.md`).

## 1. Cosa succede davvero al deploy

**La cosa da avere in testa prima di tutte le altre: il provider RICOSTRUISCE.**
Non carichi `.next/`, carichi il sorgente; il `next build` lo esegue lui, sulla
sua macchina, col suo Node, con le sue variabili d'ambiente. Da qui discendono
quasi tutti i guasti di questa fase:

1. **Il `BUILD_ID` che esce di là non è quello che hai qui.** È il motivo per
   cui l'impronta di questa skill si **deriva dal commit** invece di
   registrarla (`references/verifica-deterministica.md` §3.7). Il confronto di
   speed-demon, copiato così com'è, avrebbe rifiutato ogni deploy corretto.
2. **Le `NEXT_PUBLIC_*` vengono scritte nel bundle in quel momento.**
   Impostarle dopo, dal pannello, non le cambia nel codice già costruito. E su
   un progetto Web Gun questo tocca `sitemap.xml` e `robots.txt`, che sono
   **prerenderizzati una volta sola**: un `NEXT_PUBLIC_SITO_URL` sbagliato al
   momento della build resta sbagliato finché qualcuno non ricostruisce, anche
   se il pannello nel frattempo è a posto.
3. **Il Node di là non è il Node di qui.** `engines.node` in `package.json` è
   una *dichiarazione*: nessun provider la impone senza `engine-strict`. La
   versione si fissa **anche** nel pannello, e il runbook la scrive
   (`Runtime del provider:`), perché è la sola forma in cui il gate può
   confrontarla con quello che le dipendenze pretendono.
4. **Le pagine statiche chiamano il database durante la build.** Su un progetto
   Web Gun `/`, il catalogo e le pagine informative sono generate staticamente e
   leggono Supabase con la chiave anonima **mentre `next build` gira**. Quindi
   la macchina di deploy deve poter raggiungere il progetto Supabase di
   produzione, e le sue variabili devono esserci **prima** della build. Il
   pilota ha misurato la versione cattiva di questo fatto: su Node 20 il client
   Supabase solleva durante la build, e la build fallisce (debito n°32).

## 2. Vercel

### Come si pubblica
Repository collegato al progetto: ogni push sul ramo di produzione produce un
deployment. **Non si pubblica dalla CLI** — o meglio, si può, e il runbook di
questa skill prescrive di non farlo: `vercel deploy` carica la cartella di
lavoro, cioè anche i file ignorati da git che nessun passo del gate ha
misurato. Il gate segnala i segreti nei file ignorati come `issue` proprio
perché la loro gravità dipende da questa scelta.

### Variabili
Tre ambienti separati (produzione, anteprima, sviluppo). Le variabili con
prefisso `NEXT_PUBLIC_` **finiscono nel bundle**: sul pannello vanno impostate
prima della build e cambiarle richiede un nuovo deployment. Le altre sono
disponibili solo lato server.

**La chiave `service_role` di Supabase non va impostata**, su nessun ambiente.
Se un progetto generato ne avesse bisogno, il difetto è a monte: la Legge n°3.

### Dominio, DNS, certificato
Il dominio si aggiunge al progetto; si sceglie fra delegare i nameserver o
tenere il DNS dove sta e aggiungere i record che il pannello indica (un record
per l'apex, un `CNAME` per `www`). Il certificato è automatico e si rinnova da
solo. **Apex e `www` vanno dichiarati insieme nel runbook**, con quale dei due è
il canonico e in che verso va il rimando: da lì discende il `canonical` che
speed-demon ha già scritto nelle pagine, e un rimando nel verso sbagliato lo
contraddice.

### Rollback
I deployment sono **immutabili**: quello di ieri esiste ancora, con il suo
indirizzo, e tornarci è promuoverlo di nuovo a produzione. È la proprietà che
rende il rollback una cosa da trenta secondi invece che una build.

```
# dal pannello: Deployments → il deployment precedente → Promote to Production
# da riga di comando:
vercel ls                     # elenco dei deployment, con URL e data
vercel promote <url-deploy>   # rimette in produzione quello scelto
```

**Cosa il rollback NON riporta indietro:** le migrazioni del database. Se la
pubblicazione è andata insieme a un `supabase db push`, tornare al codice
precedente lascia lo schema nuovo sotto il codice vecchio — che è la forma in
cui un rollback peggiora la situazione. Da qui la riga del runbook: *se questa
pubblicazione comprende migrazioni, il rollback ha due metà, e la seconda la
scrive schema-forge in expand-contract.* È una richiesta a monte, non
un'operazione di questa skill.

## 3. Cloudflare

### Come si pubblica
Attraverso un **adattatore** che traduce l'uscita di Next in ciò che i Worker
sanno eseguire. La conseguenza pratica: la compatibilità è una proprietà della
coppia (versione di Next, versione dell'adattatore), non della piattaforma.
**Prima di scegliere Cloudflare si verifica quella coppia**, e la verifica va
nel `docs/deploy.md` con la data: è esattamente il genere di fatto che scade.

Serve inoltre che il progetto dichiari la compatibilità con le API Node
(`nodejs_compat` o l'equivalente in `wrangler.toml`): senza, un pacchetto che
importa un modulo Node — e `@supabase/supabase-js` lo fa — non parte.

### Variabili
Variabili e **segreti** sono cose distinte: i secondi non si rileggono dal
pannello dopo essere stati impostati. Vale la stessa regola di Vercel per le
`NEXT_PUBLIC_*`: sono scritte nel bundle al momento della build.

### Dominio, DNS, certificato
Se il dominio è già su Cloudflare, apex e `www` sono record nella stessa zona e
il certificato è automatico. È il caso in cui questa scelta costa meno di
tutte.

### Rollback
Si torna a una versione precedente del deployment. Il concetto è lo stesso di
Vercel — versioni immutabili, si ripromuove — ma **il comando e il nome
cambiano fra Pages e Workers**, e quale dei due si sta usando dipende
dall'adattatore. Il runbook scrive il comando **verificato quel giorno**, non
quello ricordato.

```
wrangler deployments list          # le versioni, con id e data
wrangler rollback [--message "…"]  # torna alla precedente
```

Vale la stessa avvertenza sulle migrazioni: il rollback del codice non tocca il
database.

## 4. Dopo il deploy — la verifica che chiude il giro

Vale identica sui due provider, ed è il motivo per cui l'impronta si deriva dal
commit:

```bash
node <skill>/scripts/impronta.mjs --url https://<dominio> --commit <sha approvato>
```

Risponde a una domanda sola, e la risponde da fuori: **l'indirizzo pubblico sta
servendo il commit che è stato approvato?** Se no, la risposta è il rollback, e
**poi** l'indagine — in quest'ordine, perché mentre si indaga il sito è online.

Le altre due cose da guardare subito, che nessuno script di qui misura:

- `https://` risponde e il certificato è valido (il browser basta);
- apex e `www` si comportano come il runbook dichiara — uno serve, l'altro
  rimanda, e il verso è quello scritto.

## 5. Le cinque cose che si scelgono, e vanno scritte prima

Sono le domande a cui `piano` non può rispondere da solo, e che finiscono in
`docs/deploy.md` perché **chi firma le legga**:

1. **Quale provider, e perché.** Un provider scelto di default non è una scelta.
2. **Quale dominio, e chi lo possiede.** Un dominio registrato sull'account
   sbagliato è un problema che si scopre al primo rinnovo.
3. **Apex o `www` come canonico**, e in che verso il rimando.
4. **Se questa pubblicazione comprende migrazioni del database.** Se sì, il
   rollback ha due metà e la seconda non è di questa skill.
5. **Chi riceve gli avvisi** quando qualcosa cade. Un sito online che nessuno
   guarda è un sito che si scopre rotto dal cliente.
