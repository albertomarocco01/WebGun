# Mandato P.4d — Flow Sentinel sul pilota `fornodoro`

> Emesso dal direttore dei lavori il 2026-08-05. Da incollare in una chat operaia
> nuova, aperta da terminale esterno nella radice del pilota
> `C:\Users\Utente\Desktop\fornodoro`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` della regia, riga **P.4d**; decisioni **D2, D8,
> D10, D11, D13, D14, D15**. La regia è `C:\Users\Utente\Desktop\WebGun`.

## Regola nuova di questo pacchetto: **arrivi in fondo da solo** (D14)

Il committente ha chiesto che la catena non si fermi più a lui. Quindi:

- **Nessuna domanda al committente, nessuna attesa.** Dove serve una scelta —
  quali flussi contano, quanti dati finti, che ora di ritiro, quale utente —
  **scegli tu quella più adatta**, scrivila nel verbale con la motivazione in
  una riga, e vai avanti. Una scelta dichiarata vale mille domande sospese.
- I **dati finti** li inventi tu, verosimili e riconoscibili come tali
  (`Mario Rossi`, `+39 333 1234567`, indirizzi inventati): mai dati di persone
  vere, mai numeri che possano essere di qualcuno.
- Se trovi un bivio che cambia il **contratto firmato da Alberto** (lo Specchio
  del dominio, `docs/vetrina.md`, `docs/gestionale.md`), non lo tocchi:
  scrivilo come attrito nel verbale e prosegui sulla strada compatibile.

### La firma del contratto: **per delega, e la riga lo dice**

`docs/flussi-critici.md` va firmato per andare avanti, e la firma **non è di
Alberto**: lui non lo leggerà prima del tuo gate. La riga esatta, con la data
ISO vera:

```
Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-05
```

**Non scrivere il nome di Alberto da solo.** Firmare col nome di un umano che
non ha letto è precisamente il difetto n°1 del collaudo avversario di
speed-demon, rifatto da noi. Sotto la riga aggiungi, in una frase:

> Firma delegata (D14): il committente controfirmerà sostituendo questa riga.
> Fino ad allora il motivo «la firma è nostra» dello `STATO.md` di
> flow-sentinel **resta aperto**.

Nel verbale scrivilo di nuovo. È il costo dichiarato dell'autonomia, non un
dettaglio da nascondere: il gate legge la firma, non la sua verità — e stavolta
la verità la scriviamo noi.

## Prerequisito — la catena, per intero

**Leggi `docs/handoff/07-schema-forge.md`, `08-vetrina-crafter.md` e
`10-gestionale-crafter.md`, in quest'ordine, prima di ogni altra cosa.** Il tuo
handoff 12 dovrà **citare un fatto del 10 che non avresti potuto inventare**.
Poi i tre contratti firmati e `docs/DEBITO-TECNICO.md` — **25 voci**: alcune
sono direttamente tue (vedi sotto).

## Cosa costruisci

Sei il **quarto anello**: la rete E2E Playwright sui flussi che non possono
rompersi. Flusso della skill: `map → forge → run → verify → handoff`.
Le leggi valgono intere: **il browser è il giudice** (nessun test vale se non è
girato contro l'app vera su database seminato); **ogni flusso critico asserisce
l'effetto sul database**, non solo la pagina; **i flussi ostili asseriscono il
rifiuto** — un test che non può fallire non è un test.

`docs/flussi-critici.md` è l'unico contratto in cui **l'omissione è invisibile
al gate**: un flusso che non dichiari non lo segnala nessuno. Perciò la mappa
la fai **camminando l'app**, non leggendo i documenti.

### I flussi che il dominio impone — punto di partenza, non elenco chiuso

Buoni (devono riuscire):

1. **Ordine d'asporto completo, da anonimo**: menu → carrello (vive nel
   browser, chiave `fornodoro:carrello`) → `/ordina` → invio → codice di
   ritiro in pagina → `/ordine/<codice>` mostra stato e righe. Asserzione sul
   database: la riga in `ordini` esiste con quel codice e il **totale calcolato
   dal database**, non dal browser.
2. **Il giro di cucina**: accesso come cucina → l'ordine appena creato compare
   → `ricevuto → in_preparazione → pronto` → `ritirato`. Asserzione: lo stato
   nel database dopo ogni passo.
3. **Il titolare cambia il menu**: pubblica/spubblica una voce
   (`is_pubblicata`) e la marca esaurita (`is_disponibile`) → il **menu
   pubblico** riflette entrambe **come prescrive il 07**: la bozza non si vede,
   l'esaurita **si vede marcata e non si può ordinare**.
4. **Il titolare cambia un testo** (uno dei 7 slot, i recapiti vanno bene) →
   compare nella pagina pubblica.

Ostili (devono essere **rifiutati**, e il test lo asserisce):

5. **Anonimo su `/admin`** → redirezione alla porta d'ingresso
   (`307 → /accedi?motivo=non-autorizzato`, misurato in P.4c).
6. **Cucina sulle rotte del titolare** → `307 → /admin?motivo=vietato`
   (5 rotte su 5, misurato in P.4c: usa quelle).
7. **Anonimo che legge gli ordini via API** → `GET /rest/v1/ordini` **401**.
8. **Transizione illegale della macchina a stati** (es. `ricevuto → ritirato`,
   o all'indietro) → **rifiutata dal trigger**, e il messaggio arriva in
   pagina con garbo.
9. **Ordine di una voce esaurita** → rifiuto `P0001` (è il fatto che l'handoff
   10 cita dall'08: la Capricciosa).

Aggiungine altri se camminando l'app ne trovi: dichiara ogni scelta.

### Il debito n°22 — lo attacchi ma **non lo chiudi**

Un titolare può cambiare il ruolo di un collega (e crearne uno nuovo) via HTTP
diretto: la capacità **è nota, misurata e aperta** (D15: si chiude in P.4f,
dopo P.4e, con `revoke update (ruolo)` + `cambia_ruolo()`). Quindi:

- **non scrivere un test che finge che sia chiusa** — sarebbe rosso e giusto,
  ma bloccherebbe il gate su un difetto che qualcun altro chiuderà;
- **non scrivere un test che asserisce la debolezza** come se fosse un
  comportamento voluto;
- **scrivi nel verbale** che il flusso ostile «la cucina non si promuove» è
  coperto (lo garantiscono policy e trigger) e che «il titolare non promuove»
  **non è garantito oggi**, con il rimando a D15. Quando P.4f chiuderà la
  capacità, quel test si scrive lì.

## Macchina e catena — lezioni già pagate, non ricomprarle

- **App di produzione viva su 3621**, build corrente `kFhToFT1wQ2jmUZpjX9Fa`.
  Se muore: `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` poi
  `npm run build && npm run start -- -p 3621` — **Node 24** per build e start
  (Next 16 pretende `^20.19 || >=22`), **node di sistema** per i gate.
- I **gate dalla junction del pilota**
  (`node .claude\skills\flow-sentinel\scripts\verify.mjs`).
- **Un solo stack** (fornodoro, 7621/7622) e **un gate alla volta**; porte
  nuove **sotto 49152**, verificate con
  `netsh interface ipv4 show excludedportrange protocol=tcp` (le esclusioni
  cambiano fra i riavvii: vale la regola, non l'elenco).
- **Build Turbopack intermittente** (~1 su 2): si ritenta una volta.
- Il seed di `auth.users` è sanato: titolare e cucina si autenticano davvero.
  Il database torna alle 5 righe di seed con `supabase db reset` — se i tuoi
  test lasciano ordini, **dichiaralo o pulisci**, e dillo nel verbale.
- Playwright: se i browser non sono installati, `npx playwright install
  chromium` è lecito e va dichiarato. Uno strumento assente vale **MANCANTE**,
  mai PASS.

## Gate e guardiani — a fine corsa quattro gate riverdi

1. **Il tuo: VERDE 7/7** dalla junction, su app vera e database seminato.
2. **Gestionale 7/7 · Vetrina 10/10 · Schema-forge 9/9** — rilanciali tu dopo
   il tuo lavoro. Se il tuo lavoro ne sposta uno, è un fatto da dichiarare.
3. `code-maniac scan` dalla radice del pilota; `/code-inquisition --focus
   reliability` sulla **batteria** (un test che non può fallire è il difetto di
   classe di questo anello — cercalo prima che lo trovi qualcun altro: nei tre
   anelli precedenti il tribunale ha trovato qualcosa **ogni volta**, e due
   volte era nel codice dell'operaio).

## Handoff e verbale

- **`docs/handoff/12-flow-sentinel.md`** nel pilota: template della skill, zero
  `{{…}}`, riga `Gate:` uguale all'esecuzione vera, **un fatto citato dal 10**,
  e per P.4e: quali pagine contano e quali flussi vanno rilanciati dopo ogni
  ottimizzazione (speed-demon rilancerà la tua batteria a ogni giro).
- Verbale nella regia: `agenti/flow-sentinel/PILOTA-2026-08-<gg>.md` — per
  punto, comando, **uscita incollata**. Gli attriti sono il valore del
  documento; le scelte che hai preso da solo (D14) sono la parte che il
  direttore leggerà per prima.

## Coordinamento (D8)

- Nel **pilota** commit piccoli e frequenti. Nella **regia** solo il verbale
  (`git add` esplicito) e le righe di `STATO.md` per i difetti veri della
  skill — la riga, non la correzione. **Non toccare**: `CANTIERE.md`,
  `prompts/`, le skill, i banchi, il docx.
- P.4 è lavoro unico.

## Riga finale del verbale

`P.4d consegnata. docs/flussi-critici.md porta la firma per delega (D14) del
2026-08-<gg> — il committente non l'ha letto, e il motivo «la firma è nostra»
di flow-sentinel resta aperto; il gate dei flussi è VERDE 7/7 dalla junction su
app vera e database seminato, con <n> flussi buoni e <n> ostili che asseriscono
il rifiuto; gestionale 7/7, vetrina 10/10 e schema-forge 9/9 riverdi;
l'handoff 12 cita <fatto> dal 10; il debito è passato da 25 a <n> voci.`
— o la verità, se è un'altra.
