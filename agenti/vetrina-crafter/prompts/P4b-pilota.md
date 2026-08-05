# Mandato P.4b — Vetrina Crafter sul pilota `fornodoro`

> Emesso dal direttore dei lavori il 2026-08-05. Da incollare in una chat operaia
> nuova, aperta da terminale esterno nella radice del pilota
> `C:\Users\Utente\Desktop\fornodoro` (esiste, con quattro commit e lo stack
> acceso).
> **Modello consigliato: Opus 5 · effort high** (D4 e piano §3: esecuzione di
> skill già collaudate, guidata dai gate).
> Contabilità: `CANTIERE.md` della regia, riga **P.4b**; decisioni **D2, D8,
> D10, D11, D13 (corretta)**. La regia è `C:\Users\Utente\Desktop\WebGun`.

## Prerequisito — l'handoff prima di tutto

**Leggi `docs/handoff/07-schema-forge.md` per intero prima di aprire qualunque
altro file.** È la regola della casa (`CLAUDE.md`: nessun agente parte alla
cieca) e la prova che l'hai fatto è falsificabile: il tuo handoff 08 dovrà
**citare un fatto del 07 che non avresti potuto inventare** — un nome di
colonna, una deroga, un residuo. Poi leggi `docs/specchio-dominio.md` (firmato)
e `docs/DEBITO-TECNICO.md`: il debito dichiarato da P.4a è anche il tuo
perimetro di prudenza.

## Chi sei e cosa costruisci

Sei l'operaio del **secondo anello del filo completo (P.4)**: il sito pubblico
della pizzeria «Forno d'Oro» — quello che vede un visitatore **anonimo**. Home,
menu con categorie/prezzi/allergeni, ordinazione d'asporto, stato ordine col
codice di ritiro, chi siamo/orari/contatti. Tutto letto con la chiave anonima,
tutti i testi da `contenuti_sito`: **nessun testo cablato dove il cliente deve
poterlo cambiare** — è la legge della skill, e sul pilota è anche il contratto
D10 («contenuti editabili»).

## Leggi prima (dopo l'handoff 07)

1. `CLAUDE.md` del pilota e `CLAUDE.md` della regia.
2. `<regia>/prompts/P4-piano.md` — la legge del pacchetto P.4.
3. `<regia>/agenti/vetrina-crafter/SKILL.md` + `STATO.md` — il flusso
   (`specchio → scaffold → pagine → audit → verify → handoff`), il gate a 10
   passi, il doppio STOP.
4. `<regia>/agenti/schema-forge/PILOTA-2026-08-04.md` — il verbale del primo
   anello: il §6 (tribunale) e il debito dichiarato ti riguardano direttamente.

## Il dominio, come lo Specchio firmato lo ha fissato

Queste non sono proposte: sono le risposte firmate di Alberto (07 §2), e lo
schema le fa rispettare da solo.

- **Il carrello vive nel browser** (D5): niente tabella carrello, niente
  sessione lato database.
- **Un ordine entra solo da `crea_ordine()`**: nessun ruolo client ha `insert`
  su `ordini`/`righe_ordine`, e il prezzo lo calcola il database dalla voce di
  menu. Non provare strade alternative: non sono vietate, sono **impossibili**.
- **L'ordine non si modifica dopo l'invio** (D2): si annulla e si rifà.
- **La pagina di stato ordine** passa da `ordine_per_codice(codice)`: il
  cliente anonimo rilegge solo il proprio ordine, col codice di ritiro.
- **Gli errori delle RPC vanno gestiti con garbo**: dopo l'indurimento del
  tribunale le funzioni validano lunghezze massime e forma delle righe *prima*
  del cast (RPC-2/RPC-3) e rispondono con messaggi di regola, non con la riga
  fallita. La tua UI li mostra in modo umano, senza inghiottirli.
- **Debito RPC-1, dichiarato e non tuo da chiudere**: nessun tetto ai
  tentativi sulle due RPC (misurato: 30 ordini in 1,36 s, tutti 200). Se la tua
  pagina di ordinazione può scoraggiare l'abuso lato interfaccia (disabilitare
  il bottone in volo, un solo invio per submit), dichiaralo nell'handoff; il
  tetto vero è materia dell'anello applicativo futuro, non zittirlo con
  finzioni.

## Il doppio STOP — la firma di Alberto su `docs/vetrina.md`

Il flusso della skill si ferma **due volte** davanti al committente, e la §6 di
`DECISIONI.md` **non delega**: pubblicare non si annulla. `docs/vetrina.md`
dichiara **cosa diventa visibile a un anonimo** — pagine, slot di contenuto,
dati esposti — e la catena non avanza finché non porta:

```
Confermato da: Alberto Marocco (committente) il 2026-08-<gg>
```

con la data ISO del giorno vero. Le due tabelle firmate del contratto sono
esattamente ciò che il gate misura (P.3, difetti n°5 e n°9: il gate ora legge
il **database**, non solo i documenti — 22 colonne dichiarate contro 36
concesse è la storia da non ripetere). Sul pilota c'è un caso nuovo rispetto a
valscura: il **percorso di scrittura pubblico** non è un modulo di contatto, è
l'ordine stesso — `crea_ordine` e la rilettura via codice vanno dichiarati nel
contratto come ciò che sono: la superficie pubblica di scrittura.

## Trappole di macchina, già misurate — non riscoprirle

- **Porte: sotto 49152, sempre** (D13 corretta, lezione di P.4a §1). L'app di
  produzione va su **3621**. Verifica con
  `netsh interface ipv4 show excludedportrange protocol=tcp` **e**
  `Get-NetTCPConnection -State Listen`: la prima lista è quella che
  `Test-NetConnection` non vede, ed è quella che ha già fregato la regia una
  volta.
- **Build Turbopack intermittente su questa macchina** (~1 su 2, worker
  postcss — verbale P.3 §7.3, non dipende dal progetto): un fallimento di
  build si **ritenta una volta** prima di indagare.
- **Un solo stack**: fornodoro è acceso su 7621/7622 ed è l'unico; i banchi
  della regia restano spenti. **Un gate alla volta.**
- **Node**: gate col node di sistema (20.12.2), dalla junction del pilota
  (`node .claude\skills\vetrina-crafter\scripts\verify.mjs`); batterie
  eventuali con Node 24 (`~/scoop/apps/nodejs-lts/current/node.exe`).
  Redirezioni che generano file da **Git Bash** (PowerShell scrive UTF-16).

## La toolchain del pilota nasce con te

Con lo scaffold il pilota smette di essere solo SQL: installa i **guardiani
locali del progetto** (Prettier, ESLint, `tsc`, knip — quelli che
`code-maniac scan` cerca), così lo scan smette di essere quasi vuoto (P.4a §7
lo dichiara: «la lettura vera di questo scan arriverà dall'anello 08»).
Dichiara nell'handoff cosa hai installato e cosa no. `gitleaks` resta assente
(punto 12, in carico a P.7c-ripresa-2): dichiaralo MANCANTE, non PASS.

## Gate e guardiani

- Obiettivo: **VERDE 10/10** su **build di produzione**
  (`npm run build && npm run start -- -p 3621`), identità dell'app dal
  `BUILD_ID` — mai un dev server, mai l'app di un altro progetto (precedente
  del 2026-07-30). MANCANTE ≠ PASS.
- A gate verde, **rilancia anche il gate di schema-forge** (deve restare
  VERDE 9/9: se il tuo lavoro lo ha spostato, è un fatto da dichiarare, non da
  sistemare in silenzio).
- `code-maniac scan` dalla radice del pilota — ora significativo — e
  `/code-inquisition --focus security` sul **percorso di scrittura pubblico**
  (le pagine/azioni che chiamano `crea_ordine` e `ordine_per_codice`): è il
  punto critico dati-utente della regola dei guardiani. Esiti nel verbale,
  rilievi veri chiusi o a debito dichiarato.

## Handoff e verbale

- **`docs/handoff/08-vetrina-crafter.md`** nel pilota: template della skill,
  nessun `{{…}}` superstite, la riga `Gate:` uguale all'esecuzione vera, e
  **almeno un fatto citato dal 07**. Chi viene dopo (gestionale, P.4c) deve
  trovarci cosa hai esposto e cosa ti aspetti da lui.
- Verbale nella **regia**: `agenti/vetrina-crafter/PILOTA-2026-08-<gg>.md` —
  per punto, comando e **uscita incollata** (le tabelle a frecce di P.4-pre
  sono a registro come forma da non ripetere). Gli attriti sono il valore del
  documento.

## Coordinamento (D8)

- Nel **pilota** sei a casa tua: commit piccoli e frequenti, stile della casa.
- Nella **regia** scrivi solo il verbale (`git add` esplicito del solo file);
  se scopri un difetto vero della skill: riga nel suo `STATO.md`, non la
  correzione. **Non toccare**: `CANTIERE.md`, `prompts/`, le skill, i banchi,
  il docx.
- P.4 è **lavoro unico**: niente altro in parallelo su questa macchina.
- Se il doppio STOP torna con domande, la catena aspetta Alberto: non tira
  dritto.

## Riga finale del verbale

`P.4b consegnata. docs/vetrina.md porta la firma «Alberto Marocco (committente)»
del 2026-08-<gg>; il gate della vetrina è VERDE 10/10 su build di produzione
(porta 3621, BUILD_ID verificato) invocato dalla junction; schema-forge resta
VERDE 9/9; l'handoff 08 cita <fatto> dal 07; il debito dichiarato è: <elenco o
«nessuno»>.` — o la verità, se è un'altra.
