# P.7f — Le minuterie della consegna

Sei una chat operaia del cantiere Web Gun. Repo: `C:\Users\Utente\Desktop\WebGun`, ramo `main`.
Il pilota è `C:\Users\Utente\Desktop\fornodoro`, ramo `master`: lo tocchi **solo** al punto 4, solo su un file.
Modello ed effort consigliati: **Sonnet 5 · high** (minuterie meccaniche ben specificate, D4).
Tutto ciò che scrivi — codice, commit, verbale — è in **italiano**.

**Vai fino in fondo da solo. Nessuno guarda questa chat.** Dove il mandato lascia aperta una
scelta tecnica, decidi tu, scrivilo nel verbale, e vai avanti. Non fermarti mai a chiedere.

## Come si committa

- Un commit per punto, messaggi narrativi in italiano.
- **Sempre e solo** `git commit -F - -- <percorsi>` (D19: l'indice è condiviso fra chat).
  Mai `-A`, mai `-a`, mai un `git commit` nudo, mai `git stash`.
- Ogni messaggio chiude con la firma `Co-Authored-By` del tuo modello
  (es. `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`).
- Su `index.lock` occupato: aspetti, non cancelli.

## Perimetro in scrittura

- `HOWTORUN.md` (radice della regia) — solo le righe delle due skill.
- `agenti/launchpad/**` — `scripts/banco.mjs`, i suoi test, `STATO.md`.
- `fornodoro/docs/conformita.md` — la sola voce «contrasti» (più `docs/handoff/16-site-doctor.md`
  **solo se** il gate lo pretende aggiornato).
- Il verbale: `MINUTERIE-2026-08-07.md` alla radice della regia.

**Fuori, e ci lavora un'altra chat**: `agenti/site-doctor/**` è di P.6-P4 — non ci entri
nemmeno in lettura di modifica; il suo gate però **lo lanci** (è un eseguibile, non un file
da toccare). Fuori anche: `CANTIERE.md` (della direzione), ogni altro file del pilota,
`C:\Users\Utente\Desktop\Informatica` (mai, per nessun motivo), qualunque deploy o remoto.
**Non si pubblica niente. Nessun `git push`. Un solo stack Supabase: quello del pilota, acceso — non lo spegni.**

## Perché esiste questo pacchetto

Quattro residui misurati, nessuno grande, tutti «documentazione o premessa che mente»:

1. `HOWTORUN.md` riga 127 dichiara `15. 🔵 **Site Doctor**` e riga 132 `16. 🔵 **Launchpad**`
   («da creare») — ma le due skill esistono, sono collaudate (P.5-P2/P3, P.6-P2/P3) e hanno
   gate che la direzione ha rilanciato sul pilota il 2026-08-07. Documentazione che mente da
   due righe.
2. La direzione ha rigenerato il banco di launchpad da zero (2026-08-07 notte, regia `6a0ac6d`)
   seguendo **solo** l'elenco «Restano TRE passi» stampato da `banco.mjs`: `npm run build` è
   caduta con `Error: supabaseUrl is required.` sul prerender di `/prenota` (exit 1). Con
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` passate inline la stessa build
   esce 0 e il gate chiude **VERDE 9/9**. Le due variabili stanno nel runbook che il banco
   scrive («prima della build») ma **non nell'elenco stampato**: una premessa non dichiarata
   nel punto in cui la si legge.
3. Il collaudo P.5-P2 (`agenti/launchpad/COLLAUDO-2026-08-06.md`) dichiarava **2 rilievi
   semgrep `detect-non-literal-regexp`**; P.5-P3 con `p/javascript + p/security-audit +
   p/eslint-plugin-security` ne ottiene **0** e l'ha dichiarato onestamente «non misurato,
   della prossima chat che tocca i guardiani». Sei tu. Indizio: P.7c usava `--config auto`,
   e i guardiani di site-doctor hanno ottenuto 5 rilievi della stessa regola.
4. La voce «contrasti» di `fornodoro/docs/conformita.md` dichiara che il gate di speed-demon
   non la guarda, con un grep misurato alla regia `d147f52` (0 file). Da `8053c9d` (P.7e) il
   gate di speed-demon **ha un passo `contrasto`** che legge l'audit `color-contrast`, e la
   direzione l'ha rilanciato sul pilota: **8/8, 5 pagine col contrasto verificato**. Il
   certificato stesso prescrive la cura: «questa riga si toglie RILANCIANDO IL GREP».

## Il lavoro

### 1. HOWTORUN.md: le due righe che mentono

Prova prima: incolla nel verbale le righe attuali (127 e 132 e il loro intorno).
Correzione: Site Doctor e Launchpad passano a 🟢 con la stessa forma delle altre skill di
casa già verdi (guarda come sono scritte le righe di flow-sentinel e speed-demon: stato,
cosa fa in una riga, il gate). Non riscrivere il resto del documento.
Falsificazione: gate della regia `node scripts/verifica-regia.mjs` **VERDE 5/5** dopo la
modifica (il passo `skill-elencate` guarda README e `installa-skill.ps1`, non HOWTORUN:
se diventa rosso hai toccato altro).

### 2. banco.mjs di launchpad: la premessa entra dove la si legge

Prova prima: riproduci la caduta — in una cartella temporanea fuori dal repo:
`node agenti/launchpad/scripts/banco.mjs --dove <tmp>/banco-lp --porta 3183`, poi segui
**alla lettera e soltanto** i passi stampati. La build deve cadere con
`supabaseUrl is required` come è caduta alla direzione. Incolla.
Correzione: l'elenco stampato dichiara le due `NEXT_PUBLIC_*` come premessa della build,
con valori d'esempio **dichiaratamente finti** (la forma esatta la scegli tu: una riga in
più nell'elenco, o un passo 0 — ma niente `.env.local` scritto in silenzio da `banco.mjs`:
un file di configurazione inventato senza dirlo è la classe di difetto che questa skill
misura negli altri).
Falsificazione: (a) rigenera **da zero** in una seconda cartella temporanea e segui SOLO le
istruzioni stampate nuove, fino a **VERDE 9/9** — incolla il verdetto; (b) un test nella
batteria che tenga l'output: se l'elenco stampato smette di nominare una delle due
variabili, il test è rosso. Batteria launchpad **sopra 162**, zero falliti.
Pulizia: le cartelle temporanee si cancellano; la porta 3183 si libera (il processo si
spegne). Nessun file nuovo nel repo oltre a quelli del perimetro.

### 3. Il semgrep che il collaudo vide e P.5-P3 no

Lavoro: ritrova il ruleset che produce i 2 `detect-non-literal-regexp` sul codice di
launchpad. Prova almeno: `--config auto` (quello di P.7c), `p/nodejs`, e il comando che
i guardiani di site-doctor hanno usato (è negli atti di P.6-P3, che leggi ma non tocchi).
Esiti possibili, entrambi legittimi:
- **riprodotto**: incolla comando e conteggio, guarda le due righe che il collaudo esentava
  (`riga1` in `gate-lib.mjs` era una) e dichiara se l'esenzione regge ancora;
- **non riprodotto**: negli `STATO.md` di launchpad la voce passa da «non misurato» a
  «non riproducibile con: <elenco esatto dei ruleset provati>» — il nome di ciò che hai
  provato è il deliverable, «ho provato un po' di cose» non chiude niente.

### 4. La voce «contrasti» del certificato del pilota

Prova prima: rilancia il grep che la voce prescrive (`contrast` in `agenti/speed-demon/`,
esclusi i test) alla regia corrente e incolla il risultato — ora i file ci sono.
Poi rilancia il gate di speed-demon sul pilota per vedere coi tuoi occhi il passo:
`node "C:/Users/Utente/Desktop/WebGun/.claude/skills/speed-demon/scripts/verify.mjs" --url http://127.0.0.1:3621`
(serve `export PATH="$HOME/scoop/apps/nodejs-lts/current:$PATH"` prima: Lighthouse vuole
Node 22+; e dopo il gate controlla i chrome orfani — n°57 — e chiudili se restano).
Correzione: la voce «contrasti» di `docs/conformita.md` riscritta — delega **piena** a
speed-demon, misurata, con la data e il commit della regia del tuo grep.
Falsificazione: gate di site-doctor sul pilota prima e dopo:
`node "C:/Users/Utente/Desktop/WebGun/.claude/skills/site-doctor/scripts/verify.mjs" --url http://127.0.0.1:3621`
— il passo `proprieta' delle voci` passa da **«3 da guardare» a «2 da guardare»**
(`accessibilita-admin` e `antispam` restano, e restano di proposito: la prima è una misura
vera «sui sorgenti», la seconda è scoperta e dichiarata). Il gate resta **VERDE**.
Vincoli: l'app sulla 3621 è viva — **non ricostruirla** se risponde; nessun altro file del
pilota si tocca; se il gate pretende l'handoff 16 aggiornato, lo aggiorni, ed è l'ultimo
atto prima del commit (i certificati si ridatano per ultimi). Commit nel pilota con
pathspec sui soli file toccati. Dopo, per scrupolo: il gate di launchpad sul pilota deve
dire ancora **ROSSO 3** (segreti · runbook · handoff) — se dice altro, fermati e scrivilo
nel verbale, non «sistemarlo».

## Come chiudi

- Verbale `MINUTERIE-2026-08-07.md` alla radice della regia: per ogni punto la prova prima,
  la correzione, la prova dopo — incollate, non raccontate. Una sezione **«Cosa resta
  MANCANTE, col suo nome»** (se un punto non chiude, dichiara che cosa e perché).
- `STATO.md` di launchpad aggiornato (punti 2 e 3).
- Gate della regia **VERDE 5/5** alla fine. Batteria launchpad sopra 162.
- Un commit per punto, pathspec, come sopra. I commit del pilota nel repo del pilota.

**Non indebolire mai una regola per far passare un test.** Se un rosso sopravvive, il
verbale dice **di chi è**. Ogni numero che dichiari deve essere uscito da un comando che
hai lanciato tu, in questa chat.
