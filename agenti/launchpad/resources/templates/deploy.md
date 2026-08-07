# Runbook di deploy — {{NOME PROGETTO}}

> **Questo documento è il permesso di pubblicare.** Chi firma in fondo autorizza
> un'azione che non si annulla e che costa soldi (`DECISIONI.md` §6). Per questo
> la firma sta **dopo** tutto il resto: la conferma è sul contenuto, non sul
> comando.
>
> È anche il documento che una persona che non c'era userà per **rifare** e per
> **disfare** quello che è stato fatto. Scritto per quello, non per noi.
>
> Compilato da `launchpad piano`; verificato da
> `node <skill>/scripts/verify.mjs`. Un `{{…}}` rimasto è un `block` del gate.

## Le coordinate

Provider: {{Vercel | Cloudflare}}
Dominio: {{https://esempio.it}}
Runtime del provider: Node {{24}}
Modo di deploy: {{git | cli}}
Radici spedite: src/, next.config.ts, public/
Commit approvato: {{sha completo}}
Impronta attesa: {{primi 12 caratteri del commit}}

**Perché questo provider** (una scelta di default non è una scelta —
`references/provider.md` §0):
{{motivo in due righe: costo del traffico, superficie Next supportata,
infrastruttura già presente, vincolo del cliente}}

**Apex e `www`**: {{quale dei due serve il sito, quale rimanda, in che verso}}.
Deve concordare con il `canonical` che speed-demon ha già scritto nelle pagine:
un rimando nel verso sbagliato lo contraddice.

**Chi possiede il dominio**: {{account/persona}} — un dominio registrato
sull'account sbagliato è un problema che si scopre al primo rinnovo.

**Chi riceve gli avvisi** quando il sito cade: {{persona / canale}}.

## Variabili d'ambiente di produzione

**Nomi, non valori.** Questo file è committato. Il valore di una
`NEXT_PUBLIC_*` si scrive (è pubblico per costruzione, e scriverlo è l'unico
modo perché chi firma veda che il dominio è quello giusto); il valore di
qualunque altra **mai**.

Per una `NEXT_PUBLIC_*` la sola risposta accettata nella colonna «Impostata» è
**prima della build**: `next build` la scrive nel bundle, e impostarla dopo
lascia rotti `sitemap.xml` e `robots.txt`, che sono prerenderizzati una volta
sola (`references/ambiente-e-runtime.md` §3).

| Nome | Impostata | Note |
|---|---|---|
| NEXT_PUBLIC_SITO_URL | prima della build | {{https://esempio.it}} |
| NEXT_PUBLIC_SUPABASE_URL | prima della build | {{progetto Supabase di produzione}} |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | prima della build | pubblica per costruzione: a difendere i dati sono le policy |

**La chiave `service_role` non è in questa tabella, e non deve esserci.**
Se un progetto generato ne avesse bisogno, il difetto è a monte e si chiude lì.

## Cosa diventa pubblico

Chi firma legge questa sezione per sapere **cosa va online**. Non è un riassunto
del sito: è l'elenco di ciò che diventa raggiungibile da chiunque.

- **Pagine pubbliche**: {{dall'handoff di vetrina-crafter, §Cosa è diventato pubblico}}
- **Dati leggibili da un anonimo**: {{tabelle e colonne, dal contratto della vetrina}}
- **Percorsi di scrittura aperti a un anonimo**: {{moduli pubblici, RPC}}
- **Aree protette** e chi vi accede: {{dal contratto del gestionale}}
- **Account che esistono in produzione al primo avvio**: {{elenco, o «nessuno»}}

## Rollback

Versione precedente: {{identificativo del deployment o del commit a cui si torna}}

Procedura, **verificata il {{data}}**:

```
{{comando del provider — references/provider.md §2 o §3}}
```

**Se questa pubblicazione comprende migrazioni del database**, il rollback ha
**due metà** e la seconda non è di questa skill: tornare al codice precedente
lascia lo schema nuovo sotto il codice vecchio, che è la forma in cui un
rollback peggiora la situazione. La seconda metà la scrive **schema-forge**, in
expand-contract, ed è una richiesta a monte da fare **prima** di pubblicare.

Migrazioni in questa pubblicazione: {{sì, elenco | no}}

## Prescrizioni lasciate dagli altri agenti

Il registro `docs/DEBITO-TECNICO.md` è l'unico posto in cui gli agenti a monte
scrivono, **numerato**, cosa impedisce di pubblicare. Ogni voce lo dichiara con
una riga di forma fissa dentro la propria riga di tabella — `Blocca il deploy:
sì` oppure `Blocca il deploy: no` (`CANTIERE.md` D23 §2) — e una voce che non ce
l'ha, se non è chiusa, vale **MANCANTE**: il gate resta rosso finché qualcuno non
risponde a quella domanda. Ogni voce che dichiara `sì` ha **due uscite oneste**,
e non ce n'è una terza:

- **chiusa a monte**, dall'agente che la possiede;
- **mitigata qui**, con una mitigazione scritta e accettata da chi firma.

Nominare non è rispondere: il gate pretende una risposta leggibile per numero.

| # | Cosa | Risposta |
|---|---|---|
| {{n}} | {{cosa dice la voce}} | {{chiusa da chi e quando · oppure la mitigazione}} |

### Le tre famiglie che questa casa ha già incontrato

Non sono di un progetto: sono i modi in cui un sito Web Gun arriva a un passo
dal deploy con qualcosa che non può partire. Sul pilota `cavia` sono i
debiti n°4, n°17, n°27 e n°32, misurati da quattro agenti diversi prima che
launchpad esistesse.

**a) Credenziali note nel seed** (pilota: n°27). Il seed crea account con una
password scritta in chiaro in un file committato. **In locale è la sua
funzione**: senza, nessuno proverebbe il gestionale, e la batteria E2E ci conia
le sessioni. Il rimedio non è togliere il seed — è che il seed di **produzione**
non porti account, oppure li porti con password generate e non committate. Il
passo `segreti` del gate lo trova da solo, senza leggere il registro.

**b) Nessun tetto ai tentativi** (pilota: n°4 sulle RPC pubbliche, n°17 su
`/accedi`). La limitazione di frequenza **non sta in una pagina**: sta nel
gateway o nel proxy del deploy, che prima di questo momento non esistevano.
È la prescrizione che diventa esigibile proprio qui, e va scritta come
configurazione del provider — non come una promessa.

**c) Il runtime che non regge la build** (pilota: n°32). Il sito non si
costruisce sotto una certa versione di Node, e `package.json` non lo dichiara.
Due metà: `engines.node` nel progetto **e** la versione fissata sul pannello del
provider, perché nessun provider impone `engines` da solo. Il passo
`runtime-riproducibile` misura la prima e confronta la seconda con la riga
`Runtime del provider:` qui sopra.

## Verdetti a monte, alla data della firma

Il gate **legge** questi verdetti dagli handoff e ne misura la freschezza; non
rilancia i gate degli altri (`references/verifica-deterministica.md` §6). Chi
firma può volerli rilanciati davvero: si fa qui, e si incolla l'esito.

| Agente | Handoff | `Gate:` dichiarato | Rilanciato il | Esito |
|---|---|---|---|---|
| {{agente}} | {{docs/handoff/…}} | {{VERDE}} | {{data o «non rilanciato»}} | {{esito o «—»}} |

## La procedura, per intero

1. `node <skill>/scripts/segreti.mjs` — prima di tutto: è il solo controllo che
   non si può rimediare dopo.
2. `node <skill>/scripts/impronta.mjs --scrivi` se `generateBuildId` non c'è,
   poi `npm ci && npm run build`.
3. `npm run start -- -p {{porta}}` e
   `node <skill>/scripts/verify.mjs --url http://127.0.0.1:{{porta}}` → **verde**.
4. **STOP.** Questo documento si legge e si firma. Il gate verde non è il
   permesso: è la condizione necessaria.
5. Pubblicazione: {{comando o azione sul pannello}}.
6. `node <skill>/scripts/impronta.mjs --url {{dominio}} --commit {{sha}}` →
   l'indirizzo pubblico serve il commit approvato.
7. Certificato valido, apex e `www` come dichiarato sopra.
8. Se qualcosa non combacia: **rollback prima, indagine poi**. Mentre si indaga
   il sito è online.

## Costi

{{piano e costo ricorrente atteso, e chi paga}}

Non è misurabile da nessuno script e cambia col piano dell'account: è una
dichiarazione, e chi firma la legge.

---

Confermato da: {{NOME COGNOME (ruolo)}} — {{AAAA-MM-GG}}

> Una firma è **una persona, un ruolo e una data**. Il gate rifiuta il
> segnaposto, il nome dell'agente, e una firma più vecchia dell'ultimo commit di
> codice — perché quella ha firmato un altro contenuto.
>
> **E rifiuta la delega** (`CANTIERE.md` D20): qui non si scrive
> `Direzione lavori (per delega del committente …)`. Quella forma vale sui
> **verbali** — i documenti che descrivono un lavoro già fatto — e questo
> documento non descrive: **autorizza**, e autorizza l'unica azione della
> pipeline che non si annulla. *Si può delegare la firma su un verbale, non su
> un mandato.*
