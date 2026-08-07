# P.4k — La storia pulita e il seed senza password (parte al «si pubblica»)

> **Modello consigliato: Opus 5 · effort high.** Chat operaia. Perimetro in
> scrittura: **`C:\Users\Utente\Desktop\fornodoro\**`** + il solo verbale
> `agenti/launchpad/PILOTA-STORIA-2026-08-XX.md` nella regia. **NON partire se
> altre chat operaie sono aperte sul pilota o sulla regia**: questo pacchetto
> riscrive la storia di git, e un commit concorrente su riferimenti vecchi è
> l'unico modo di farsi male. Il committente lo conferma all'apertura.
> Mandato della direzione (D24); D14 vale: fino in fondo da solo.

## Perché esiste, in cinque righe

D24: la credenziale n°27 esce dalla storia **prima del primo `git push`** —
l'istante in cui la storia smette di essere riscrivibile. Il gate di launchpad
oggi blocca su **password in 6 posizioni**: una **in HEAD**
(`supabase/seed/90-solo-sviluppo.sql:226`, `password123` dentro `crypt('…')`)
e cinque **in storia**. Toglierle a metà non serve: si fa **una volta sola,
tutte insieme**, e questo pacchetto è quel giro.

## L'elenco esatto (misurato dalla direzione il 2026-08-07, gate launchpad)

| dove | cosa |
|---|---|
| `supabase/seed/90-solo-sviluppo.sql:226` **(HEAD)** | `password123` in chiaro dentro `crypt('…')` |
| `docs/deploy.md @ d4dcb2b` (×2) | password (3 caratteri) dentro l'autorità di un URL `postgresql://` |
| `docs/DEBITO-TECNICO.md @ 710f9f0` | idem |
| `docs/handoff/08-vetrina-crafter.md @ fff715b` | idem |
| `supabase/seed/90-solo-sviluppo.sql @ 2a7291d, @ 967f2b4` (×2) | `password123` storica |
| `supabase/seed.sql @ b1df957` (×2) | `password123` nel seed unico pre-P.4g |

C'è anche un `[issue]` su `.env.e2e.local` (file **ignorato** da git, 3
rilievi): non è storia, non si riscrive — verifica solo che resti ignorato.

**Un bundle di backup esiste già**:
`C:\Users\Utente\Desktop\fornodoro-storia-pre-riscrittura-2026-08-07.bundle`
(tutta la storia, verificato). Prima di riscrivere fanne uno TUO, datato al
giorno della corsa, stesso posto — due paracadute costano una riga.

## I quattro punti

### 1. Il seed di sviluppo senza password cablata

`90-solo-sviluppo.sql` crea i due account (`titolare@fornodoro.it`,
`cucina@fornodoro.it`) con `password123` cablata. Va sostituita con una fonte
**non tracciata**: la scelta della forma è tua (variabile d'ambiente letta dal
comando `seed-sviluppo`, o un file locale gitignorato con un esempio
`.example` accanto) — con questi vincoli:

- nessun valore di password in nessun file tracciato, nemmeno come esempio
  «verosimile»: l'esempio dice `CAMBIAMI` o simile, dichiaratamente finto;
- **il contratto di flow-sentinel regge**: `docs/flussi-critici.md` §Domande
  (riga ~125) dichiara che la batteria usa «i due del seed» — gli E2E devono
  leggere la password **dalla stessa fonte** del seed, e la batteria deve
  restare **22/22 rilanciata davvero**;
- `npm run seed-sviluppo` senza la fonte configurata **si ferma con un
  messaggio che dice cosa manca** — mai un default silenzioso;
- i documenti che nominano `password123` come fatto vivo (handoff, registro,
  deploy.md §percorso di produzione) vanno riallineati: da «c'è e blocca» a
  «c'era, tolta il <data>, fonte locale non tracciata».

### 2. La riscrittura della storia

Strumento consigliato: `git filter-repo` (se manca: `scoop install
git-filter-repo`, oppure `pip install git-filter-repo`). Con `--replace-text`
e un file di espressioni che contiene **le stringhe esatte** (la password
dell'URL — leggila da `git show fff715b:docs/handoff/08-vetrina-crafter.md`,
NON incollarla nel verbale — e `password123`), sostituite con `***RIMOSSO***`.

Attenzioni misurate, non ipotetiche:

- `filter-repo` rifiuta un repo non appena clonato: serve `--force`, ed è il
  motivo per cui il bundle si fa PRIMA;
- la sostituzione è **globale sui blob**: va bene *perché* il punto 1 ha già
  tolto `password123` da HEAD — dopo il punto 1, ogni occorrenza residua nella
  storia è una copia da pulire. **L'ordine punto 1 → punto 2 non è
  facoltativo**;
- gli **hash cambiano tutti** dal primo commit toccato in poi: i verbali e i
  registri che citano hash del pilota (`05cf644`, `8c87400`, `33d787c`…)
  restano atti storici — nel verbale scrivi che quegli hash appartengono alla
  storia pre-riscrittura, conservata nei bundle, e **non riscrivere i verbali
  chiusi**;
- `docs/handoff/15-p4h-credenziale-e-certificati.md` cita `fff715b` nel blocco
  di riconferma della direzione: aggiorna **quel blocco** (la sua materia è
  esattamente questa) con la nuova verità e la data;
- le **date** dei commit si conservano; la freschezza degli handoff (blocchi
  del 2026-08-07) non deve rompersi — verificala col gate.

### 3. La prova

Nell'ordine, tutti incollati nel verbale:

1. `git log --oneline -5` nuovo + `git bundle verify` sul TUO bundle.
2. Gate launchpad: il passo `nessun segreto nel pacchetto che parte` **OK** —
   zero block in HEAD e zero in storia (l'`[issue]` sul file ignorato può
   restare, dichiarato). Atteso complessivo: **ROSSO 2** — `runbook-firmato`
   (di Alberto) e `contratto-uscita` (la pubblicazione non è ancora avvenuta).
   Se dice altro: fermati e scrivilo.
3. `supabase db reset` + seed dalla fonte nuova + **E2E 22/22 rilanciati**
   (gate flow-sentinel VERDE 7/7) — è la prova che il punto 1 non ha rotto il
   contratto dei due account.
4. Gli altri gate della catena: schema 9/9 · gestionale 7/7 · vetrina 10/10 ·
   speed-demon 8/8 · site-doctor VERDE — rilanciati dopo rebuild e riavvio
   della 3621 (l'app va lasciata viva).
5. Registro `docs/DEBITO-TECNICO.md`: **n°27 e n°56 chiusi** con la prova
   (data, comando, verdetto del gate), colonna `Blocca il deploy:` aggiornata
   di conseguenza. Il conteggio dei bloccanti lo **rifai col gate**, non a
   mano: la casa ha già pagato due volte il riassunto che mente.

### 4. Il verbale

`agenti/launchpad/PILOTA-STORIA-2026-08-XX.md` (unico file di regia): cosa è
stato riscritto (per famiglia e file, MAI il valore), i due bundle e dove
stanno, le prove del punto 3, «Cosa resta MANCANTE col suo nome», e la riga
che al prossimo passo serve: **da qui in poi la storia è pubblicabile; il
primo `git push` è un atto di P.3, col runbook firmato dal committente.**

## Regole assolute

- **Nessun `git push`, nessun remote, nessuna pubblicazione**: questo
  pacchetto PREPARA il push, non lo fa. Il deploy è P.3, col committente.
- Commit `git commit -F - -- <percorsi>` (D19) per i commit ORDINARI del
  punto 1; la riscrittura del punto 2 è l'unica operazione fuori da questa
  forma, ed è il motivo per cui questo pacchetto gira **da solo** sul repo.
- La chiave `service_role` non entra in nessun file. Lo stack del pilota
  resta acceso. `Informatica` e gli snapshot non si toccano.
- Se qualcosa non torna a metà riscrittura: **ferma tutto, ripristina dal
  bundle** (`git clone <bundle>` in una cartella nuova per confronto, o
  fetch dei ref), e scrivi cosa hai visto. Il bundle è il motivo per cui
  nessun errore qui è irreversibile.

Alla fine riferisci alla direzione: esito, misure, scarti — la direzione
rilancia in proprio, e il passo dopo è dei soli umani: la firma del runbook e
l'account del provider.
