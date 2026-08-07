# ARCHIVIO — cosa è stato tolto dal repo, e come si ritrova

Il **2026-08-07** il repo è stato potato (decisione `CANTIERE.md` **D28**): ottanta documenti che
raccontavano lavori già finiti sono usciti dai file vivi. **Non sono stati persi.** Git li
conserva per intero, e questa pagina dice come arrivarci.

La regola che ha guidato il taglio: *resta ciò che serve a costruire domani; la storia la tiene
git*. E prima di cancellare, tutto ciò che un documento sapeva e nessun altro sapeva — trappole
della macchina, debito ancora aperto, limiti dichiarati dei gate — è stato **travasato** negli
`STATO.md` delle skill, in [COME-SI-USA.md](COME-SI-USA.md) e in [ROADMAP.md](ROADMAP.md).

---

## Come si ripesca un file

```bash
# 1. in quale commit è stato cancellato?
git log --diff-filter=D --name-only -- "**/NOME-DEL-FILE.md"

# 2. leggerlo com'era l'ultimo giorno che esisteva (nota il ^)
git show <quel-commit>^:agenti/site-doctor/COLLAUDO-2026-08-06.md

# 3. riportarlo nel working tree, se serve davvero
git checkout <quel-commit>^ -- agenti/site-doctor/COLLAUDO-2026-08-06.md

# 4. tutta la storia di un file, anche dopo un rename
git log --follow --oneline -- CANTIERE.md
```

Per cercare **dentro** i file archiviati senza ripescarli:

```bash
git grep "quello che cerchi" $(git rev-parse HEAD~1) -- agenti/
```

## Cosa è stato archiviato

Tre famiglie, tutte con la stessa natura: raccontano un lavoro **concluso**.

| Famiglia | Cos'erano |
|---|---|
| **Verbali** (`COLLAUDO-*`, `COSTRUZIONE-*`, `PILOTA-*`, `P5-*`, `P6-*`) | il resoconto di una costruzione o di un collaudo, col dettaglio delle misure di quel giorno |
| **Mandati** (`prompts/`) | il prompt autosufficiente dato a una chat operaia, già eseguito |
| **Guide congelate** | documenti fermi a una data che nel frattempo avevano cominciato a dire il falso |

### L'elenco

**Radice (7)** — verbali di pacchetti trasversali:
`IGIENE2-JUNCTION-2026-08-04` · `INQUISIZIONE-GATE-2026-08-06` · `MINUTERIE-2026-08-07` ·
`PILOTA-2026-08-06` · `PILOTA-PRE-2026-08-04` · `PROCESSO-GATE-2026-08-06` ·
`PROCESSO-GATE-2-2026-08-06`

**`prompts/` (19 su 20)** — i mandati della direzione, da `P0-igiene-gate-node20` a
`P7f-le-minuterie-della-consegna`, più `passaggio-direzione-2026-08-04`.
**Resta `prompts/DIREZIONE-lavori.md`**, che non è un mandato eseguito: è il ruolo permanente.

**Dentro le skill (54)** — verbali e mandati di ciascuna:

| Skill | Quanti | Cosa se ne va |
|---|---|---|
| site-doctor | 12 | costruzione, collaudo avversario, i due tribunali (48 e 61 rilievi), due passaggi sul pilota |
| schema-forge | 9 | due collaudi di luglio, quattro passaggi sul pilota, i mandati |
| vetrina-crafter | 9 | progettazione, costruzione, collaudo, il passaggio sul pilota |
| flow-sentinel | 8 | costruzione, tre collaudi, il pilota |
| launchpad | 7 | costruzione, collaudo avversario, le tre decisioni, la riscrittura della storia del pilota |
| gestionale-crafter | 5 | collaudo di luglio, `COME-PROVARLA.md`, il logo che restava orfano |
| speed-demon | 4 | costruzione e collaudo avversario del 30 luglio |

Il **giornale di cantiere** (1 177 righe) e i **pacchetti di lavoro** sono usciti da `CANTIERE.md`
lo stesso giorno: l'ultima versione che li contiene è **`f4b625a`**.

```bash
git show f4b625a:CANTIERE.md
```

## I commit che vale la pena conoscere

| Commit | Cosa ci trovi |
|---|---|
| **`f4b625a`** | l'ultimo `CANTIERE.md` col giornale completo e i pacchetti di lavoro |
| **`67f9001`** | gli ultimi quattro banchi di prova cancellati nel 2026-07-30 — `banco-prova-negozio`, `banco-prova-accademia`, `banco-prova-immobiliare`, `banco-sporco` (1,4 GB). Si ripescano con `git checkout 67f9001 -- <banco>` |
| **`e6deb39`** | la chiusura di P.0-igiene-2: i gate che uscivano `0` muti dalla junction |
| **`d9c62b2`, `47ceb20`, `a315c78`** | i primi difetti trovati dal collaudo avversario di vetrina-crafter, uno per commit |
| **`a1ee045`** | la firma della progettazione P0 di vetrina-crafter — l'atto con cui un umano ha accettato l'impianto delle pagine pubbliche |

Attenzione: **`banco-prova-controtempo` e `banco-prova-valscura` non stanno in nessun commit.**
Sono gitignorati e vivono solo sul disco: se qualcuno li cancella non c'è niente da ripescare.

### Due file sul Desktop che nessun repo dichiara più

La storia del pilota è stata riscritta il **2026-08-07** per togliere una credenziale dai blob
(P.4k). Prima di toccarla è stato fatto un bundle di **tutta** la storia, due volte:

```
C:\Users\Utente\Desktop\fornodoro-storia-pre-riscrittura-2026-08-07.bundle
C:\Users\Utente\Desktop\fornodoro-storia-pre-riscrittura-2026-08-07-P4k.bundle
```

Portano il **nome vecchio** del pilota (la rinomina in `cavia` non ha rinominato i bundle), stanno
**fuori** da ogni repository, e **contengono la credenziale**: sono la rete di sicurezza della
riscrittura, non un archivio da condividere. L'unico documento che li registrava era il verbale
della riscrittura, archiviato con gli altri — da qui in poi lo dice questa riga.

Il pilota vive in **una sola** cartella, `C:\Users\Utente\Desktop\cavia`. Durante il lavoro del
2026-08-07 un guscio vuoto `fornodoro\` si è ricreato per un istante (un solo `.gitignore` da 14
byte, nessun repository dentro) ed è stato eliminato: se ricompare, è spazzatura di uno strumento
che scrive su un percorso vecchio, non un secondo pilota. Vale comunque la regola generale — prima
di lanciare un gate «sul pilota» si guarda **quale cartella**: due repo con lo stesso schema e lo
stesso blocco di porte sono il modo esatto in cui si finisce ad auditare un database che non è
quello che si crede.

## Cosa vale la pena ripescare, e perché

Non tutti gli ottanta meritano un viaggio. Questi tre sì.

| File archiviato | Cosa ci trovi che non sta altrove |
|---|---|
| `INQUISIZIONE-GATE-2026-08-06.md` | il tribunale sui gate della regia: **46 difetti** — 2 CRITICAL, 12 HIGH, 17 MEDIUM, 15 LOW — trovati in un giorno in cui ESLint, semgrep, gitleaks e 465 test erano **tutti verdi**. È l'esemplare che giustifica la regola: una batteria verde non è un'assoluzione |
| `agenti/site-doctor/P6-P4-2026-08-07.md` §6.1 | il registro dei **61 rilievi** nella forma originale, con dove/cosa/verso per ciascuno. Nello `STATO.md` vivo restano i 45 dichiarati aperti, senza quel dettaglio |
| `PROCESSO-GATE-2026-08-06.md` e `PROCESSO-GATE-2-2026-08-06.md` | come sono state chiuse le voci del referto, una per una, e i **difetti nuovi che il referto non aveva** — trovati mentre lo si eseguiva |

### «referto § C1», «referto § L11»: cos'è il referto

Circa **centoventi commenti** negli script vivi di flow-sentinel, gestionale-crafter, schema-forge e
speed-demon citano *«il referto»* con una sigla — `C1`, `H2`, `L11`, `M5` — e **non nominano nessun
file**: nessuna ricerca per nome li trova.

**Il referto è `INQUISIZIONE-GATE-2026-08-06.md`**, archiviato qui. Le sigle sono le sue voci,
ordinate per gravità: `C` critical, `H` high, `M` medium, `L` low. Ogni commento porta il proprio
fatto per esteso — la sigla è la provenienza, non la spiegazione — quindi il codice si legge lo
stesso. Ma se cerchi la voce originale, è lì che sta.

## Perché un numero che leggi in giro può non tornare

Le batterie di test sono cresciute a ogni tornata. Se un documento archiviato dichiara un numero
diverso da quello di oggi, **non è un errore: è la sua data**.

| Quando | Test in tutto |
|---|---|
| 2026-08-06, prima di P.7d | 465 |
| dopo P.7d | 593 |
| dopo P.7e | 776 |
| **2026-08-07 (oggi)** | **1 480** — 228+183+230+171+147+167+308 nelle skill, 46 nella regia |

Il numero vero di una skill si misura, non si cita: `cd agenti/<skill> && npm test`.

## Cosa NON è stato archiviato, e perché

Resta tutto ciò che serve a lavorare domani: le sette skill (`SKILL.md`, `STATO.md`,
`references/`, `resources/`, `scripts/` con i gate e le batterie), gli scaffold dei quattro agenti
da creare, gli snapshot esterni, `template-skill/`, `banco-prova-vetcare/` (il caso di prova
permanente, rosso apposta), il programma `Web Gun.docx` con la sua copia di testo, e i sei
documenti d'ingresso: `README`, `COME-SI-USA`, `ROADMAP`, `DECISIONI`, `CANTIERE`, questo.

E resta `prompts/DIREZIONE-lavori.md`: descrive il ruolo di chi dirige i lavori, e finché il ruolo
esiste non è un documento storico.
