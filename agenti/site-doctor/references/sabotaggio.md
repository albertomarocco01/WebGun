# Sabotaggio — togli la difesa, il passo deve diventare rosso

> Carica questo file al collaudo. Un passo che resta verde col difetto piantato
> non prova quello che dichiara: si riscrive.

## Il banco, e perché è tracciato

`scripts/banco.mjs` genera e serve un sito **conforme**, e sa piantarci dentro
un difetto alla volta. Zero dipendenze, zero database, zero chiavi, zero
`node_modules`: un file.

```bash
node scripts/banco.mjs --elenco                              # le classi
node scripts/banco.mjs --dir /tmp/banco --porta 3821          # conforme
node scripts/banco.mjs --dir /tmp/banco --porta 3821 --sabota H
# in un'altra shell, con cwd = /tmp/banco:
node <skill>/scripts/verify.mjs --url http://127.0.0.1:3821
```

`DECISIONI.md` §12 dice che i banchi si buttano; la §25 traccia **il banco che
un clone pulito sa rilanciare**. Questo lo soddisfa: ogni affermazione di
sabotaggio si rilancia con un comando, su qualunque macchina, senza preparare
niente.

**Il banco non sostituisce il pilota.** Serve a provare che i passi sanno essere
**verdi** — un gate che sul solo sito disponibile è rosso ovunque non ha
dimostrato di saper distinguere, ha dimostrato di saper dire di no. Il pilota
serve a provare che il gate trova cose vere su un sito vero che nessuno ha
costruito per lui.

**Il banco va in un processo suo.** `spawnSync` blocca il ciclo di eventi: un
server HTTP acceso nello stesso processo che lancia il gate non risponde mai, e
il gate direbbe «nessuna risposta» su un banco vivo. Misurato: 26 classi su 26
con `superficie-pubblica: skipped`.

## Le venticinque classi, e l'esito misurato il 2026-08-06

Banco conforme: **VERDE 8/8 + 1 NON APPLICABILE**, uscita `0`.

| classe | difetto piantato | passo che deve cadere | esito misurato |
|---|---|---|---|
| — | (nessuno) | — | **VERDE** `pass=8 na=1` |
| A | informativa sparita (404) | `informativa-privacy` | **ROSSO** — e anche `superficie-pubblica` (la pagina è dichiarata e non risponde) e `perimetro` (esito divergente) |
| B | informativa scollegata da una pagina | `informativa-privacy` | **ROSSO** |
| C | informativa che non nomina le voci dell'art. 13 | `informativa-privacy` | **ROSSO** |
| D | informativa con un segnaposto dentro | `informativa-privacy` | **ROSSO** |
| E | campo personale non dichiarato | `dati-raccolti` | **ROSSO** |
| F | pagina che raccoglie e non rimanda all'informativa | `dati-raccolti` | **ROSSO** (+ `informativa-privacy`) |
| G | archiviazione non dichiarata | `archiviazione-client` | **ROSSO** |
| H | terzo caricato e non dichiarato | `archiviazione-client` | **ROSSO** — *al primo giro era verde: vedi sotto* |
| I | archiviazione non essenziale senza banner | `archiviazione-client` | **ROSSO** |
| J | script servito che non si scarica | `archiviazione-client` **MANCANTE** | **MANCANTE** |
| K | immagine senza `alt` | `accessibilita-servita` | **ROSSO** |
| L | `lang` sparito da `<html>` | `accessibilita-servita` | **ROSSO** (+ `lingua-e-hreflang`) |
| M | gerarchia dei titoli saltata | `accessibilita-servita` | **ROSSO** — *al primo giro era verde: vedi sotto* |
| N | campo senza etichetta | `accessibilita-servita` | **ROSSO** |
| O | collegamento senza nome accessibile | `accessibilita-servita` | **ROSSO** |
| P | **una voce con due proprietari** | `perimetro` | **ROSSO** |
| Q | una voce tolta dalla tabella | `perimetro` | **ROSSO** |
| R | voce delegata a un file che non esiste | `perimetro` | **ROSSO** |
| S | voce delegata a un file che non la nomina | `perimetro` | **ROSSO** |
| T | esito dichiarato ≠ esito di questa esecuzione | `perimetro` | **ROSSO** |
| U | handoff che dichiara un verdetto falso | `contratto-uscita` | **ROSSO** |
| V | sito multilingua senza nessun hreflang | `lingua-e-hreflang` | **ROSSO** |
| W | hreflang non reciproco | `lingua-e-hreflang` | **ROSSO** |
| X | sitemap più ricca dei collegamenti | `superficie-pubblica` | **ROSSO** — *al primo giro era verde: vedi sotto* |
| Y | un'altra applicazione sulla stessa porta | `superficie-pubblica` | **ROSSO**, e i cinque passi che leggono l'app diventano **MANCANTI** |

**25 classi su 25 rosse.** Ma tre lo sono diventate solo dopo una correzione, e
quelle tre valgono più delle ventidue che hanno funzionato subito.

## I tre difetti che il sabotaggio ha trovato nel gate

### H — «zero terzi» dopo aver tolto i terzi da soli

`senzaScript` cancellava i tag `<script>` **per intero**, e `terziDi` — che cerca
proprio gli `src` di terzi — girava su un documento da cui gli script li avevamo
tolti noi. Il passo chiudeva «zero terzi» dopo aver guardato un documento
ripulito di ciò che doveva trovare.

**Corretto**: si toglie il **corpo** degli script e si tiene il tag di apertura.
Il carico RSC sparisce lo stesso (è il corpo), e gli `src` restano.

### M — verde su una gerarchia dei titoli rotta

Il salto di livello era un `issue`, e solo un `block` fa fallire un passo. Il
passo dichiarava di provare «la gerarchia dei titoli» ed era verde con la
gerarchia rotta.

**Corretto**: promosso a `block`. La prova è interamente nel documento (h1
seguito da h3), senza una riga di euristica: `DECISIONI.md` §17 dice che lì la
gravità è bloccante.

### X — due sorgenti che erano diventate una sola

La camminata partiva **anche** dalle pagine della sitemap, quindi i collegamenti
trovati su quelle pagine rientravano fra «i collegamenti». Le due sorgenti che
dovevano controllarsi a vicenda si alimentavano. Con la home svuotata di
collegamenti e la sitemap intera, il passo chiudeva **verde**.

**Corretto**: la sitemap resta un **seme per lo scarico**, e la raggiungibilità
da `/` si calcola sul **grafo** (`raggiungibiliDaCollegamenti`), che è una misura
indipendente.

## Come si aggiunge una classe

1. Una riga in `CLASSI` di `banco.mjs`, con il passo che deve cadere.
2. Il difetto piantato, **una cosa sola**: se una classe rompe due cose, non si
   sa quale delle due ha fatto scattare il passo.
3. Si lancia, si guarda **quale** passo diventa rosso e **con che messaggio**.
   Un rosso col messaggio sbagliato è un difetto quanto un verde: manda a
   cercare l'imputato sbagliato (difetto n°1 del collaudo di vetrina-crafter).
4. Se il passo resta verde: **si riscrive la regola**, non la classe.
5. La regola nuova nasce nella lib, col suo test.

Un test in `verify.test.mjs` verifica che **ogni passo che misura abbia almeno
una classe** che lo punta: una classe cancellata si vede.

## Le classi che questo gate NON può vedere

Da provare comunque al collaudo avversario (P2), e devono restare **verdi**:
sono limiti dichiarati, non difetti.

| rottura | perché resta verde |
|---|---|
| un cookie posto **dopo** l'invio di un modulo | si legge un anonimo che non fa nulla |
| un modulo costruito interamente nel browser | nell'HTML servito non c'è |
| un terzo caricato da codice che l'HTML non referenzia | non si scarica ciò che non è referenziato |
| una pagina raggiungibile solo da un indirizzo che nessuno linka | non entra nella camminata né nella sitemap |
| un'informativa che nomina le sette voci e dice il falso | comprensione di un testo |
| un `alt="immagine"` | è presente e non vuoto |
| contrasti insufficienti | delegati a speed-demon |
| un handoff citato che esiste, nomina la voce e dice «da fare» | comprensione di un testo |
| una base giuridica dichiarata e sbagliata | non è automatizzabile |
| una firma su un certificato che chi firma non ha letto | nessuno strumento lo sa |
