# Mandato P.1 — Progettazione (P0) di vetrina-crafter

> Emesso dal direttore dei lavori il 2026-08-02. Da incollare in una chat operaia nuova.
> Contabilità: `CANTIERE.md` alla radice del repo.

Sei un operaio della pipeline Web Gun, nel repo di regia `WebGun`. Il tuo pacchetto di
lavoro è la **PROGETTAZIONE (P0)** del nuovo agente **`vetrina-crafter`** — l'agente che
costruisce il **sito pubblico** di un progetto Web Gun: le pagine vetrina sopra lo schema
di schema-forge. In questo pacchetto **non si scrive codice**: si progetta la skill. La
costruzione (P1) e il collaudo avversario (P2) saranno pacchetti separati, in chat separate,
per la regola della casa: chi costruisce non collauda.

## Leggi prima, in quest'ordine (obbligatorio — non partire alla cieca)

1. `CLAUDE.md` — contratto operativo: stack standard, struttura dei progetti generati,
   handoff, Regola dei guardiani.
2. `README.md` — pipeline e stato reale degli agenti, **note a piè di pagina comprese**.
3. `DECISIONI.md` — tutte le voci; pesano qui in particolare: §6 (conferme in pipeline:
   reversibile → orchestratore, irreversibile → umano, ciò che si assume si scrive
   nell'handoff), §8 (i linter si configurano, il gate non si declassa), §11 (il gate
   dichiara sempre cosa ha guardato), §12+§25 (i banchi si buttano; se ne traccia uno solo
   se un clone pulito lo sa rilanciare), §15 (id stabili nel `--json`), §18 (uno strumento
   che non ha letto niente non produce un `pass`), §19 (l'handoff dichiara il verdetto del
   gate e il gate lo verifica), §21 (Fly UI non esiste: componenti a mano dietro la cucitura
   `src/components/ui/`), §24 (i contenuti editabili dal cliente vivono in tabelle di
   schema-forge, gli slot li genera il gestionale).
4. `template-skill/COME-USARE-QUESTO-TEMPLATE.md` e `template-skill/SKILL.md` — il punto di
   partenza. Il riferimento di qualità dichiarato è `agenti/code-maniac`.
5. Come modelli riusciti: `agenti/gestionale-crafter/SKILL.md` (il gemello backoffice:
   Specchio con STOP, gate a 7 passi) e `agenti/speed-demon/SKILL.md` +
   `agenti/speed-demon/resources/templates/performance.md` (il contratto firmato
   dall'umano, letto poi dal gate).
6. Gli `STATO.md` di schema-forge, gestionale-crafter, flow-sentinel e speed-demon — per le
   dipendenze, lo stile, e le sezioni «Cosa un gate verde NON prova», che qui sono un genere
   letterario obbligatorio.

## Contesto essenziale

- Questo repo è la **regia**: gli agenti vivono in `agenti/<nome>/`, i siti veri si
  generano in repo separati. Qui progetti l'agente, non un sito.
- Il buco che questo agente chiude: la pipeline ha i dati (schema-forge), il backoffice
  (gestionale-crafter), i test E2E (flow-sentinel) e le performance (speed-demon) — ma
  **nessuno costruisce le pagine pubbliche**. Fly UI (la libreria esterna promessa) non è
  mai arrivata e non si aspetta.
- La cartella `agenti/vetrina-crafter/` **esiste già** e contiene solo `prompts/` (i
  mandati di lavoro, questo compreso): copiaci dentro il contenuto di `template-skill/` e
  parti da lì. Non è un errore che esista.

## Decisioni già prese dalla direzione (non rimetterle in discussione)

- Nome: **`vetrina-crafter`** (gemello pubblico di gestionale-crafter).
- Stack standard del `CLAUDE.md`: Next.js App Router + TypeScript + Tailwind + Supabase.
- Componenti UI **scritti a mano nel progetto generato**, raccolti dietro la cucitura
  `src/components/ui/` e importati solo da lì (deroga `DECISIONI.md` §21). Se un giorno
  Fly UI arriva, si riscrive il corpo di quei file, non le pagine.
- I testi e i contenuti che il cliente cambia da solo **vivono nelle tabelle di
  schema-forge** (`DECISIONI.md` §24): la vetrina li **legge dal database**, non li cabla
  nel codice. Chi scrive la tabella è schema-forge; chi dà al cliente la vista per
  modificarli è gestionale-crafter; tu li mostri.
- **Gate scritto PRIMA del flusso** (template, passo 3) e `verify` come **ultimo** passo
  del flusso operativo, come per le altre tre skill: un gate che nasce rosso per l'ordine
  del flusso insegna a ignorare il rosso.
- **MANCANTE ≠ PASS**: uno strumento assente, o uno che non ha letto il suo input, produce
  una verifica mancante, mai un verde.

## Deliverable del pacchetto

1. **`agenti/vetrina-crafter/SKILL.md` completo**: frontmatter con `description` che dice
   QUANDO attivarla (trigger concreti, non marketing); «Cosa fa» in 3 righe; 2–4 Leggi non
   negoziabili; tabella Comandi (solo comandi che esisteranno davvero in P1 — niente
   speculazioni); Flusso operativo numerato con gli **STOP**; **Gate di chiusura** scritto
   prima del flusso; indice delle references previste.
2. **Il gate progettato in dettaglio** (nello SKILL.md o in una reference dedicata):
   l'elenco dei passi del futuro `scripts/verify.mjs` con **id stabili** stile
   speed-demon/flow-sentinel, cosa misura ogni passo, con quale comando, e **come ogni
   passo può produrre MANCANTE** invece di un falso verde.
3. **`resources/templates/`** con la bozza dei due documenti del contratto:
   - il contratto della vetrina che l'umano firma (quali pagine esistono, cosa mostra
     ciascuna, da quali tabelle/slot arrivano i contenuti, riga `Confermato da:` con nome,
     ruolo e data — impara dal `performance.md` di speed-demon, che il collaudo avversario
     ha dovuto correggere perché il gate non sapeva leggere il template);
   - l'handoff `handoff-vetrina-crafter.md` con la riga `Gate: VERDE/ROSSO` (§19).
4. **`STATO.md` aggiornato**: stato «progettata (P0), in attesa di conferma del
   committente», proprietario Alberto, dipendenze a monte/valle corrette (Fly UI non va
   elencata: non esiste), e il piano P0→P3 in tabella, come quello di flow-sentinel.
5. **Una sezione «Cosa un gate verde NON prova»** già abbozzata nello SKILL.md: la casa la
   pretende, ed è più facile scriverla ora che a posteriori.

## Questioni che la progettazione DEVE risolvere (sono tue — decidile e motiva)

- **Perimetro contro i vicini**, scritto nero su bianco: speed-demon fa SEO e performance
  a valle (non duplicare metatag e misure Lighthouse), flow-sentinel testa i flussi,
  site-doctor farà la conformità, gestionale-crafter fa l'admin. Cosa resta alla vetrina:
  pagine, layout, componenti, collegamento ai dati, contenuti — e cosa esplicitamente no.
- **Come un gate deterministico prova qualcosa su pagine vetrina.** Candidati da valutare
  (scegli i difendibili, scarta le opinioni, aggiungi i tuoi): build di produzione che
  compila; `tsc`; ogni pagina dichiarata nel contratto risponde **sull'app di questo
  progetto** (l'idea del `BUILD_ID` di speed-demon è riusabile); niente segnaposto
  `{{…}}`/lorem ipsum nell'HTML servito; import dei componenti solo dalla cucitura
  `src/components/ui/` (verificabile staticamente); i contenuti degli slot arrivano dal
  database e non da stringhe cablate (come lo provi? un'euristica dichiarata è meglio di
  una promessa); a11y automatica di base. Per ogni passo: la premessa da misurare prima
  di leggere l'esito (§18).
- **Dove sta lo STOP umano** (lo Specchio della vetrina: quali pagine, quali contenuti,
  che gerarchia) e cosa scrive l'agente nell'handoff quando gira in pipeline (§6).
- **Cosa fa il comando di evoluzione** quando lo schema a monte cambia — leggi cosa ha
  imparato flow-sentinel collaudando `evolve` (`COLLAUDO-EVOLVE-2026-07-30.md`: il caso
  cieco è il corpo che cambia a id fermo).
- **La numerazione dell'handoff** nel progetto generato è progressiva per progetto (07,
  12, 14, 15 nei banchi passati): non serve fissarla, serve dirlo nel template.

## Regole d'ingaggio

- Tutto in **italiano** (nomi di file, cartelle e comandi in inglese; chiavi JSON in
  inglese, come da §15).
- Niente flussi inventati per completezza: ciò che non è deciso resta `<!-- TODO -->`.
- **Non toccare nessun file fuori da `agenti/vetrina-crafter/`**: né altri agenti, né gli
  snapshot esterni (code-maniac, code-inquisition, bugbay), né README/DECISIONI/CANTIERE.
  Le proposte per gli altri agenti si scrivono nel tuo `STATO.md`, sezione «Proposte a
  monte/valle» (è il canale che usa la casa: il consumatore riporta, il proprietario
  decide).
- Alla fine: **un commit** con messaggio in italiano nello stile della casa (guarda
  `git log --oneline -10` prima di scriverlo).
- **STOP finale: non iniziare la costruzione.** Niente `scripts/`, niente references
  piene, niente banco. Il pacchetto finisce con la progettazione consegnata.

## Verbale di chiusura (obbligatorio)

Chiudi la chat riportando al direttore, in un unico messaggio finale:

1. l'elenco dei file prodotti;
2. le decisioni di progettazione prese, con la motivazione (soprattutto: i passi del gate
   scelti e quelli scartati, e perché);
3. le questioni rimaste aperte, ciascuna con la tua raccomandazione;
4. la riga finale, testuale: `P0 consegnata, in attesa di conferma del committente.
   Gate: NON APPLICABILE (pacchetto di sola progettazione, nessun codice prodotto).`
