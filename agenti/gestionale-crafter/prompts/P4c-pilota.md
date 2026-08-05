# Mandato P.4c — Gestionale Crafter sul pilota `fornodoro`

> Emesso dal direttore dei lavori il 2026-08-05. Da incollare in una chat operaia
> nuova, aperta da terminale esterno nella radice del pilota
> `C:\Users\Utente\Desktop\fornodoro`.
> **Modello consigliato: Opus 5 · effort high** (D4 e piano §3: esecuzione di
> skill già collaudate, guidata dai gate).
> Contabilità: `CANTIERE.md` della regia, riga **P.4c**; decisioni **D2, D8,
> D10, D11, D13 (corretta)**. La regia è `C:\Users\Utente\Desktop\WebGun`.

## Prerequisito — gli handoff prima di tutto

**Leggi `docs/handoff/07-schema-forge.md` e `docs/handoff/08-vetrina-crafter.md`
per interi, in quest'ordine, prima di aprire qualunque altro file.** Il tuo
handoff 10 dovrà **citare un fatto dell'08 che non avresti potuto inventare**.
Poi `docs/specchio-dominio.md` (firmato), `docs/vetrina.md` (firmato) e
`docs/DEBITO-TECNICO.md` — **14 voci**: sono anche il tuo perimetro di
prudenza, e alcune ti parlano direttamente (il n°11 su `crea_ordine` **non è
tuo da chiudere**; il limite noto del tuo stesso gate è già in lista e ci deve
restare).

## Chi sei e cosa costruisci

Sei l'operaio del **terzo anello del filo completo (P.4)**: il backoffice del
Forno d'Oro, nello **stesso progetto Next.js** della vetrina, dietro rotte
protette. Due ruoli, due mestieri (D10, Specchio firmato):

- **cucina** — la schermata dove gli ordini arrivano e si fanno avanzare lungo
  la macchina a stati del database: `ricevuto → in_preparazione → pronto`, poi
  `ritirato` o `non_ritirato`; `annullato` dove il dominio lo consente. Le
  transizioni illegali **le rifiuta il trigger**: la tua UI mostra solo le
  mosse lecite dallo stato corrente e, se il database dice di no, riporta il
  rifiuto con garbo — mai inghiottirlo, mai aggirarlo.
- **titolare** — tutto quello della cucina, più: il menu (prezzi, voci,
  categorie, allergeni) coi **due interruttori distinti** che l'handoff 08
  cita dal 07 — `is_pubblicata` (bozza/pubblicata: la «Tartufo e patate» del
  seed è il caso di prova) e `is_disponibile` («oggi esaurita»: si mostra
  marcata, non si nasconde) — i **contenuti** (i 7 slot di `contenuti_sito`,
  recapiti compresi), gli **orari**, e il **personale**.

## Il personale: le tre difese sono del database, la UI le rispetta

`personale.ruolo` è difeso tre volte (policy, `grant` per colonna, trigger —
07 §3), e l'indurimento IAM-1 garantisce l'invariante «resta sempre almeno un
titolare **attivo**»: disattivare o degradare l'ultimo titolare **fallisce nel
database**. La tua UI: solo un titolare vede e tocca il personale; le
operazioni che il database rifiuterà per invariante è meglio che la UI le
spieghi prima («sei l'ultimo titolare attivo») — ma la difesa resta quella del
trigger, non il tuo `if`. E le leggi della skill valgono intere: **nessuna
rotta admin senza guardia di autenticazione e ruolo verificato; la chiave
`service_role` non entra nel progetto; i moduli scrivono solo le colonne che
il database concede davvero** — se un `permission denied` ti sorprende, è una
domanda per il modello di accesso del 07, non un invito ad allargare un grant.

## La terza firma — Specchio del gestionale

Il flusso della skill (`specchio → scaffold → viste → contenuti → audit →
verify → handoff`) si ferma allo Specchio: chi vede cosa, chi scrive cosa,
ruolo per ruolo, vista per vista. **La parte «chi può promuovere chi» non è
delegabile** (piano §4): la firma è di Alberto, riga canonica con data ISO
vera:

```
Confermato da: Alberto Marocco (committente) il 2026-08-<gg>
```

Presenta lo Specchio con la matrice ruoli × operazioni **misurata sui grant e
sulle policy veri** (la lezione dell'08: si misura il database, non le proprie
query) e fermati lì finché la riga non c'è.

## Lezioni di macchina e di catena, già pagate — non ricomprarle

- **Build e `npm start` col Node 24 di scoop** (Next 16 pretende
  `^20.19 || >=22`); **i gate col node di sistema**, dalla junction del pilota
  (`node .claude\skills\gestionale-crafter\scripts\verify.mjs`).
- **`FlatCompat` di eslintrc muore su Next 16**: si importano le flat config
  di `eslint-config-next` direttamente (già fatto così nell'anello 08 — non
  reintrodurlo).
- **Porte sotto 49152 sempre**; l'app di produzione resta su **3621**;
  verifica con `netsh interface ipv4 show excludedportrange protocol=tcp`
  (le esclusioni **cambiano fra i riavvii**: vale la regola, non l'elenco).
- **Build Turbopack intermittente** (~1 su 2 su questa macchina, worker
  postcss): un fallimento si ritenta una volta prima di indagare.
- **Un solo stack** (fornodoro, 7621/7622) e **un gate alla volta**. Il gate
  della vetrina misura **un'app viva**: prima di lanciarlo, l'app di
  produzione dev'essere su (`npm run build && npm run start -- -p 3621`).
- Il seed di `auth.users` è **già sanato** (07): titolare e cucina si
  autenticano davvero. Se GoTrue desse 500, non è teoria nuova — rileggi il
  debito, non riscrivere il seed.

## Gate e guardiani — a fine corsa, tre gate riverdi

1. **Il tuo: VERDE 7/7** dalla junction. Il **limite noto del tuo gate** — 
   conta le guardie, non sa se chiedono il ruolo giusto — resta dichiarato in
   `docs/DEBITO-TECNICO.md`, mai aggirato e mai raccontato come coperto.
2. **Vetrina: VERDE 10/10** sull'app **ricostruita** — il tuo lavoro cambia la
   build, e la vetrina deve restare intera sopra (BUILD_ID nuovo, app viva).
3. **Schema-forge: VERDE 9/9** — se il tuo lavoro lo sposta, è un fatto da
   dichiarare, non da sistemare in silenzio.

Poi `code-maniac scan` dalla radice del pilota, e
`/code-inquisition --focus security` sul **punto critico di questo anello:
autenticazione, guardie delle rotte admin e gestione del personale** (è il
caso «auth + dati utente» della regola dei guardiani). Esiti nel verbale,
rilievi veri chiusi o a debito dichiarato.

## Handoff e verbale

- **`docs/handoff/10-gestionale-crafter.md`** nel pilota: template della
  skill, nessun `{{…}}` superstite, riga `Gate:` uguale all'esecuzione vera,
  **almeno un fatto citato dall'08**, e la sezione «cosa si aspetta chi viene
  dopo» scritta per P.4d: flow-sentinel attaccherà i flussi — digli quali
  contano e dove fanno male.
- Verbale nella **regia**: `agenti/gestionale-crafter/PILOTA-2026-08-<gg>.md`
  — per punto, comando e **uscita incollata**. Gli attriti sono il valore del
  documento.

## Coordinamento (D8)

- Nel **pilota** sei a casa tua: commit piccoli e frequenti, stile della casa.
- Nella **regia** scrivi solo il verbale (`git add` esplicito); un difetto
  vero della skill → riga nello `STATO.md`, non la correzione. **Non
  toccare**: `CANTIERE.md`, `prompts/`, le skill, i banchi, il docx.
- P.4 è **lavoro unico**. Se lo Specchio torna con domande, la catena aspetta
  Alberto.

## Riga finale del verbale

`P.4c consegnata. Lo Specchio del gestionale porta la firma «Alberto Marocco
(committente)» del 2026-08-<gg>; il gate del gestionale è VERDE 7/7 dalla
junction; vetrina 10/10 sull'app ricostruita e schema-forge 9/9 riverdi;
l'handoff 10 cita <fatto> dall'08; il limite noto del gate resta dichiarato;
il debito è passato da 14 a <n> voci.` — o la verità, se è un'altra.
