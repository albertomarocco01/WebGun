# Mandato P.4a — Schema Forge sul pilota `fornodoro`

> Emesso dal direttore dei lavori il 2026-08-04 (sera). Da incollare in una chat
> operaia nuova, aperta da terminale esterno su `C:\Users\Utente\Desktop` (la
> cartella del pilota non esiste ancora: la crei tu al passo 0).
> **Modello consigliato: Opus 5 · effort high** (D4 e piano §3: «esecuzione di
> skill già collaudate, guidata dai gate — qui non si scrivono regole, si
> eseguono»).
> Contabilità: `CANTIERE.md`, riga **P.4a**; decisioni **D2, D8, D10, D11,
> D12, D13**. Piano: `prompts/P4-piano.md` — questo mandato ne esegue il primo
> anello, non lo riassume.

## Prerequisito duro — verificalo prima di ogni altra cosa

**P.0-igiene-2 dev'essere chiusa e collaudata dal direttore.** Da
`C:\Users\Utente\Desktop\WebGun`: `git log --oneline -8` deve mostrare il
commit della correzione junction e il registro del direttore che la dichiara
collaudata (riga P.0-igiene-2 di `CANTIERE.md`). Controprova diretta, da una
cartella vuota qualsiasi:

```
node C:\Users\Utente\Desktop\WebGun\.claude\skills\schema-forge\scripts\verify.mjs
```

deve uscire **2 col messaggio**. Se esce **0 muto: fermati e riporta al
direttore** — stai camminando sul difetto che P.0-igiene-2 doveva chiudere.

## Chi sei e cosa dimostri

Sei l'operaio del **primo anello del filo completo (P.4)**: schema-forge su un
progetto pilota vero, in un repo separato dalla regia (D11), col committente in
carne e ossa. Il piano lo dice e qui si ripete: *«P.4 chiude il motivo "la
firma è nostra" per tre skill su cinque, e non ne chiude nessun altro»*. Tu
produci il primo anello e **la prima firma vera della storia del repo**. Non
stai dimostrando che la pipeline è pronta per un cliente; stai dimostrando che
la catena regge — e dichiarando ogni attrito: *«un filo completo senza attriti
dichiarati è un filo che nessuno ha guardato»*.

## Leggi prima, in quest'ordine

1. `CLAUDE.md` della regia — il contratto dei progetti generati: stack,
   struttura, handoff, regola dei guardiani.
2. `prompts/P4-piano.md` **per intero** — la legge del pacchetto.
3. `PILOTA-PRE-2026-08-04.md` — la strada: junction, firma, porte.
4. `agenti/schema-forge/SKILL.md` + `COME-PROVARLA.md` + `STATO.md` — in
   particolare i punti aperti **11** e **15**, il feedback dei consumatori a
   valle (seed `auth.users`), e la sezione junction ora chiusa.
5. `agenti/schema-forge/resources/templates/handoff-schema-forge.md`; poi
   `banco-prova-vetcare/docs/handoff/07-schema-forge.md` come esempio **di
   struttura** — il banco è ROSSO apposta (2 falliti su 9, caso di prova
   permanente): se ne copia la forma, mai il contenuto.

## 0. La casa del pilota (D11 + D13)

Crea **`C:\Users\Utente\Desktop\fornodoro`** — pizzeria «Forno d'Oro», ordini
d'asporto (D10). `git init`, poi:

- struttura del progetto generato come da `CLAUDE.md` della regia (`src/app`,
  `src/components`, `src/modules/<dominio>`, `src/lib`, `docs/`,
  `docs/handoff/`, `public/`, `supabase/`) — quello che serve a questo anello;
  il resto lo creano gli agenti a valle;
- `docs/PROGETTO.md`: dominio, stack standard (nessuna deroga) e, nero su
  bianco, il perimetro D10: **il pagamento è fuori** — nessun agente lo copre,
  si paga al ritiro; **niente consegna a domicilio**;
- `docs/DEBITO-TECNICO.md`: nasce adesso, anche se vuoto;
- un **`CLAUDE.md` del pilota**, breve (≤ 40 righe): cos'è (progetto generato
  dalla pipeline Web Gun; la regia è `C:\Users\Utente\Desktop\WebGun`), lo
  stack, dove sono le skill (`.claude/skills`, junction verso la regia), come
  si lanciano i gate (dalla radice del pilota, junction o percorso assoluto —
  **mai fidarsi di un'uscita 0 muta**), la regola di macchina (**un solo stack
  Supabase acceso alla volta**, 16 GB), e che ogni agente legge gli handoff in
  `docs/handoff/` prima di iniziare;
- le skill, dalla regia:

  ```
  powershell -File C:\Users\Utente\Desktop\WebGun\scripts\installa-skill.ps1 -Destinazione C:\Users\Utente\Desktop\fornodoro\.claude\skills
  ```

  → sei junction; verifica con `Get-Item ... | Select-Object Name, LinkType, Target`;
- primo commit del pilota. Nel pilota sei a casa tua: **commit piccoli e
  frequenti**, messaggi nello stile della casa (una frase che racconta il
  perché).

## 1. Supabase del pilota (porte D13)

`supabase init`, poi in `supabase/config.toml`:

- `project_id = "fornodoro"`;
- blocco **57620-57629** (misurato libero da P.4-pre, prenotato da D13):
  `[api] port = 57621` · `[db] port = 57622`, `shadow_port = 57620` ·
  `[studio] port = 57623` · posta di test `57624` · `[db.pooler] port = 57629`
  · `[analytics] port = 57627` **e `enabled = false`** (acceso, `db reset`
  muore con 502 — misurato sui banchi) · `major_version = 17`;
- prima di `supabase start`: `docker ps` — **nessun altro stack acceso**. I tre
  banchi della regia restano spenti; su questa macchina lo stack è uno, ed è
  il tuo.

## 2. Il brief del committente (D10)

Questo è il brief, come lo darebbe il cliente. Il resto lo tiri fuori tu con lo
Specchio:

> Pizzeria «Forno d'Oro». Vogliamo il menu sul sito — pizze, qualche antipasto,
> le bibite — coi prezzi e gli allergeni. I clienti ordinano dal sito per
> l'asporto e passano a ritirare: niente consegne, si paga al ritiro. In cucina
> serve una schermata dove gli ordini arrivano e si fanno avanzare: ricevuto,
> in preparazione, pronto. Il titolare aggiorna menu, prezzi, orari e i testi
> del sito; la cucina tocca solo gli ordini. Ogni tanto una pizza finisce:
> dev'essere possibile toglierla dal menu al volo.

Le domande **strutturali** che il brief non risolve — l'ordine si modifica dopo
l'invio? il cliente ordina da anonimo o con un account? le categorie del menu
sono piatte o ad albero? che cosa succede a un ordine mai ritirato? — sono
esattamente quelle che lo Specchio porta **ad Alberto**, non decisioni tue:
*«il pattern dice cosa costa cedere, il committente decide»* (SKILL.md,
Flusso 1, passo 4).

## 3. Il flusso, nell'ordine non negoziabile della skill

`model` → **SPECCHIO, STOP** → `forge` → `seed` → `test` → `types` → `handoff`
→ `verify` **ultimo**. (`types` e `handoff` prima del gate: il passo 9
`contratto-uscita` pretende l'handoff già scritto con la riga `Gate:`
veritiera. Il comando `rls` **non esiste più** — DECISIONI §14: se una
reference lo cita, è storia.)

**Lo STOP dello Specchio è vero e non delegabile.** Riformuli il dominio in
italiano semplice — entità, relazioni, cardinalità, cicli di vita, mappa di
proprietà delle righe, che È la specifica delle policy RLS — disegni l'ERD
Mermaid a mano, fai le domande, e **ti fermi**. Nessuna riga di DDL prima che
Alberto Marocco risponda e firmi. La riga, con la data ISO del giorno vero:

```
Confermato da: Alberto Marocco (committente) il 2026-08-<gg>
```

— la stessa che P.4-pre ha provato sui gate: firma vera accettata, segnaposto
rifiutato. La firma finisce nel §2 dell'handoff.

## 4. Le lezioni a monte — si eseguono qui, la skill non si corregge

- **Seed di `auth.users`**: come esce dal template della skill produce utenti
  che GoTrue rifiuta con HTTP 500 (`confirmation_token` e compagni a NULL) e
  non popola `auth.identities` (feedback di flow-sentinel nello STATO: sanato
  sul banco vetcare, **non ancora nel template**). Il pilota avrà titolare e
  cucina: scrivi il seed **già sanato** — token a stringa vuota, `identities`
  popolata **senza nominare `email`** (è `generated always`: nominarla fa
  fallire l'insert) — e dichiara nel debito: «template della skill ancora
  difettoso, rientro nello STATO di schema-forge». P.4d ci camminerà sopra: se
  lo lasci rotto, lo scopre lui al triplo del costo.
- **Punto 11 (aperto)**: il gate non vede un seed non rieseguibile a caldo.
  Prova a mano: tre esecuzioni consecutive del seed sul database caldo,
  conteggi identici, uscite incollate nel verbale.
- **La macchina a stati dell'ordine** (ricevuto → in preparazione → pronto) è
  il cuore di D10 ed è la classe mai attraversata dai tre banchi, tutti nati
  su una *prenotazione*: vincolo sullo **stato iniziale anche in INSERT** e
  transizioni definite per ogni stato (reference M13/M14 — stavolta su un
  flusso vero).

## 5. Gate e guardiani

- Il gate **dalla radice del pilota, via junction** — è la prima uscita vera
  del canale riparato da P.0-igiene-2:

  ```
  node .claude\skills\schema-forge\scripts\verify.mjs
  ```

  Se esce 0 muto: fermati, riprova per percorso assoluto
  (`node C:\Users\Utente\Desktop\WebGun\agenti\schema-forge\scripts\verify.mjs`),
  e riporta al direttore — è una regressione, non un tuo problema da aggirare.
- Requisiti che il gate pretende (MANCANTE ≠ PASS): CLI Supabase ≥ 2.81.3;
  `psql` (`%USERPROFILE%\scoop\apps\postgresql\current\bin`, non è nel PATH);
  `sqlfluff` e `squawk` (pipx, `~/.local/bin`); Docker acceso col **solo**
  stack del pilota. I tipi si generano da **Git Bash** — la redirezione di
  PowerShell scrive UTF-16 e il passo 8 resta rosso.
- Obiettivo: **VERDE 9/9**. Un rosso si corregge **nel progetto** o si
  dichiara nell'handoff e nel debito; non si aggira mai.
- Prima dell'handoff, da `COME-PROVARLA.md` §4 e dalla regola dei guardiani:
  `code-maniac scan` e
  `/code-inquisition supabase/migrations --focus security --depth 1 --council 3`
  (la junction di code-inquisition è fra le sei installate). Esiti nel
  verbale; i rilievi veri → migrazione corretta o debito dichiarato.
- Un gate alla volta; batterie eventuali con Node 24
  (`~/scoop/apps/nodejs-lts/current/node.exe`), gate col node di sistema.

## 6. Handoff e verbale

- **`docs/handoff/07-schema-forge.md`** nel pilota: le sei sezioni del
  template, nessun `{{…}}` superstite. §2 Specchio **con la firma di
  Alberto**; §3 modello di accesso tabella per tabella coi privilegi espliciti
  (P.8: revoke poi grant, `service_role` compreso, nessun ruolo client con
  `Dxtm`); §6 aperto dalla riga
  `Gate: VERDE|ROSSO (N falliti, N verifiche mancanti su 9 passi) — rilanciato il <data>`
  **uguale all'esecuzione vera**. È il primo anello della catena
  07 → 08 → 10 → 12 → 13: chi viene dopo deve trovarci fatti che non avrebbe
  potuto inventare — nomi di colonne, deroghe, residui.
- Verbale nella **regia**: `agenti/schema-forge/PILOTA-2026-08-<gg>.md` — per
  punto: comando, uscita incollata (incollata davvero: le tabelle a frecce del
  verbale di P.4-pre sono state annotate dal direttore come forma da non
  ripetere). Gli attriti — cosa si è rotto, cosa è stato strano, cosa ha
  chiesto un giro in più — sono il valore del documento, non la sua vergogna.

## Coordinamento (D8)

- Nel **pilota** sei a casa tua: commit piccoli e frequenti.
- Nella **regia** scrivi solo il verbale (`git add` esplicito del solo file).
  **Non toccare**: `CANTIERE.md`, `prompts/`, le skill, i banchi, il docx.
  Se scopri un difetto vero di schema-forge: riga nel verbale e nello
  `STATO.md` della skill — la riga, non la correzione: quella la decide il
  direttore.
- P.4 è **lavoro unico** (piano §2): niente altro in parallelo su questa
  macchina.
- Il committente firma una volta sola, ma davvero: se lo Specchio torna con
  domande aperte, la catena aspetta lui — non tira dritto.

## Riga finale del verbale

`P.4a consegnata. Lo Specchio del dominio porta la firma «Alberto Marocco
(committente)» del 2026-08-<gg>; il gate di schema-forge è VERDE 9/9 sul
database del pilota (57621/57622, invocato dalla junction); l'handoff 07 è
scritto senza segnaposto e il debito dichiarato è: <elenco o «nessuno»>.`
— o la verità, se è un'altra.
