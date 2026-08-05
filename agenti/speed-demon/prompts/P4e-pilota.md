# Mandato P.4e — Speed Demon sul pilota `fornodoro` (ultimo anello)

> Emesso dal direttore dei lavori il 2026-08-05. Da incollare in una chat operaia
> nuova, aperta da terminale esterno nella radice del pilota
> `C:\Users\Utente\Desktop\fornodoro`.
> **Modello consigliato: Opus 5 · effort high.**
> Contabilità: `CANTIERE.md` della regia, riga **P.4e**; decisioni **D2, D8,
> D10, D11, D13, D14, D15, D16**. La regia è `C:\Users\Utente\Desktop\WebGun`.

## Sei l'ultimo anello

Dopo di te P.4 chiude (D2: **il deploy non è di questo pacchetto**, è di P.5).
Il tuo lavoro non è «fare punteggio»: è dimostrare che dopo cinque agenti in
sequenza il sito **regge una misura vera** e che le ottimizzazioni non hanno
rotto niente di quello che i quattro anelli prima di te hanno costruito.

## Regola di regime: **arrivi in fondo da solo** (D14)

Nessuna domanda al committente, nessuna attesa. Ogni scelta — quali pagine
contano, quali soglie, quale ottimizzazione vale il rischio — **la prendi tu**,
la scrivi nel verbale con la motivazione in una riga, e vai avanti. Il verbale
di P.4d ha messo tutte le scelte autonome in una tabella in testa (§0): fa'
lo stesso, è la parte che il direttore legge per prima.

**La firma di `docs/performance.md` è per delega**, riga esatta con la data ISO
vera:

```
Confermato da: Direzione lavori (per delega del committente Alberto Marocco) il 2026-08-<gg>
```

Sotto, la nota: *firma delegata (D14); il committente controfirmerà sostituendo
questa riga, e fino ad allora il motivo «la firma è nostra» dello `STATO.md` di
speed-demon resta aperto.* **Mai il nome di Alberto da solo.** E ricorda la
frase della tua stessa skill: *il gate legge la firma, non la sua verità* — se
l'elenco delle pagine è sbagliato, il verde è vero e inutile. Quindi l'elenco
lo costruisci camminando il sito, non copiando `docs/vetrina.md`.

## Prerequisito — la catena, per intero

**Leggi i quattro handoff in ordine** (`07`, `08`, `10`, `12`) prima di ogni
altra cosa; il tuo `13-speed-demon.md` dovrà **citare un fatto del 12** che non
avresti potuto inventare. Poi i contratti firmati e `docs/DEBITO-TECNICO.md`
(**30 voci**).

Due fatti del 12 che ti riguardano subito, e non sono opinioni:

- `/chi-siamo` (e le pagine che leggono `contenuti_sito`) sono in **cache ISR
  300 s**, e si rinfrescano perché le azioni del gestionale chiamano
  `revalidatePath`. P.4d ci è quasi inciampato: per cinque minuti il sito
  serviva un testo di prova. Quando misuri, sappi **cosa stai misurando**: una
  pagina servita dalla cache non racconta la stessa storia di una rigenerata.
- La batteria E2E **asserisce l'effetto sul database** e ha un `globalTeardown`
  che confronta i totali col seed e **solleva** se resta un residuo. Se una tua
  ottimizzazione lascia il database sporco, te lo dice lui.

## Passo 0 — chiudi il debito n°26 (D16)

`supabase/config.toml` del pilota dichiara `[auth].site_url` sulla **3000**
mentre l'app vive sulla **3621**: senza `--url` il gate dei flussi misura una
porta vuota, e su un'altra macchina misurerebbe **l'app di uno sconosciuto**
(precedente del 2026-07-30). Correggilo a `http://127.0.0.1:3621`, riavvia lo
stack, e **rilancia i gate a valle** per dimostrare che non hai rotto l'auth
(il giro di cucina e l'accesso titolare della batteria di P.4d sono la prova).
Un commit dedicato, e la voce n°26 chiusa nel debito con la misura.

## Il flusso: `measure` → `plan` → `tune` → `verify` → `handoff`

Le tue tre leggi valgono intere, e questo anello è il posto dove costano:

1. **Si misura una build di produzione**, mai `next dev`, e il gate confronta
   il `BUILD_ID` per non misurare l'app di un altro progetto. Build e `start`
   col **Node 24** di scoop (`export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"`,
   poi `npm run build && npm run start -- -p 3621`); i **gate** col node di
   sistema.
2. **Un'ottimizzazione alla volta**, rimisurando, e **rilanciando la batteria
   E2E dopo ognuna** — con `--url http://127.0.0.1:3621` esplicito. Un sito più
   veloce e rotto è un sito rotto: qui la rete di P.4d è la tua rete.
3. **Un solo giro di Lighthouse non è una misura**: `--giri ≥ 3`, mediana. E
   niente altro acceso sulla macchina mentre misuri — un solo stack, un gate
   alla volta, l'IDE quieto (su 16 GB il carico multiplo ha già prodotto due
   falsi rossi in questo cantiere).

Le pagine che contano, secondo me — ma **decidi tu**, e scrivi perché: la home
(prima impressione), `/menu` (è il catalogo, e legge quattro tabelle),
`/ordina` (è la pagina che *vende*: se è lenta, non si ordina),
`/ordine/<codice>` (dinamica, non cacheabile). Le soglie le fissi tu: oneste,
raggiungibili su questa macchina, e dichiarate.

## Cosa NON fare

- **Non toccare lo schema** (D15: il n°22 e il n°11 sono di P.4f, dopo di te).
- **Non aggirare la cache** cambiando i tempi di rivalidazione per far salire
  un numero: se lo fai per un motivo vero, è una decisione di prodotto e va
  scritta come tale nel contratto e nell'handoff.
- **Non toccare i contratti firmati da Alberto** né i tre handoff a monte.
- Non deployare, non installare `launchpad`, non toccare i banchi della regia.

## Gate e guardiani — la prova finale del filo

A fine corsa devono essere **tutti e cinque verdi**, rilanciati da te:

| gate | atteso |
|---|---|
| speed-demon (il tuo) | **7/7**, `--giri ≥ 3`, `BUILD_ID` della build che hai misurato |
| flow-sentinel | **7/7** — `--url http://127.0.0.1:3621` |
| gestionale-crafter | **7/7** |
| vetrina-crafter | **10/10** su app viva |
| schema-forge | **9/9** |

Poi `code-maniac scan` e `/code-inquisition --focus performance,reliability`
sulle ottimizzazioni applicate. Nei quattro anelli precedenti il tribunale ha
trovato qualcosa **ogni volta**, e tre volte era nel codice dell'operaio: dagli
in pasto ciò che hai cambiato, non ciò che era già lì.

## Handoff e verbale

- **`docs/handoff/13-speed-demon.md`**: template della skill, zero `{{…}}`,
  riga `Gate:` veritiera, **un fatto citato dal 12**, e — visto che sei
  l'ultimo — una sezione **«cosa serve prima di pubblicare»** per P.5: il
  debito n°27 (password note nel seed) **blocca il deploy**, e ogni altra cosa
  che hai visto e che un sito vero non può portarsi in produzione.
- Verbale nella regia: `agenti/speed-demon/PILOTA-2026-08-<gg>.md`, con in
  testa la tabella delle scelte autonome (D14) e le uscite **incollate**.
- **In più, solo per te**: una sezione finale **«il filo, visto dall'ultimo
  anello»** — cosa si è rotto fra un anello e l'altro, quali handoff ti sono
  serviti davvero e quali no, e se un agente a valle ha dovuto indovinare
  qualcosa che il precedente sapeva. È il materiale con cui il direttore
  scriverà il verbale di catena, ed è la cosa che P.4 esiste per produrre.

## Coordinamento (D8)

Nel pilota commit piccoli e frequenti; nella regia solo il verbale e le righe
di `STATO.md` per i difetti veri della skill (la riga, non la correzione).
Non toccare `CANTIERE.md`, `prompts/`, le skill, i banchi, il docx.

## Riga finale del verbale

`P.4e consegnata. docs/performance.md porta la firma per delega (D14) del
2026-08-<gg>; il gate delle performance è VERDE 7/7 con <n> giri sulla build
<BUILD_ID>; tutti e cinque i gate del filo sono verdi rilanciati da me; il
debito n°26 è chiuso e l'handoff 13 dice a P.5 cosa manca prima di pubblicare;
il debito è passato da 30 a <n> voci.` — o la verità, se è un'altra.
