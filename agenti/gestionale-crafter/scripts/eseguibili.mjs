/**
 * eseguibili.mjs — Chi decide QUALE binario esegue il gate.
 *
 * PERCHE' ESISTE UN MODULO APPOSTA. Il 2026-08-06 il tribunale
 * (`INQUISIZIONE-GATE-2026-08-06.md` § C1, `executed-confirmed`) ha misurato che
 * i quattro gate storici lasciavano scegliere al progetto AUDITATO quale
 * eseguibile lanciare. I gate si lanciano dalla radice del progetto generato —
 * lo prescrive il `CLAUDE.md` — e sia `where` sia `spawnSync` col nome nudo
 * cercano PRIMA nella directory corrente. Un `supabase.cmd` piantato nella
 * radice portava a casa `db-reset`, `db-lint` e `db-advisors`; un finto `node`
 * portava a casa l'audit RLS. Sei passi su nove, compreso quello che la skill
 * chiama «il controllo che non puo' mancare».
 *
 * Non e' un difetto di calcolo: e' esecuzione di codice scelta da chi consegna
 * il repository da giudicare.
 *
 * QUATTRO CHIUSURE, non una — ognuna copre una via che le altre lasciano aperta:
 *
 *  1. `where "$PATH:<nome>"`: la forma col prefisso limita la ricerca alle
 *     cartelle del PATH e NON guarda la directory corrente. Misurata su questa
 *     macchina il 2026-08-06: dal finto progetto `where supabase` elencava per
 *     primo il `supabase.cmd` piantato, `where "$PATH:supabase"` no.
 *  2. `where.exe` e `cmd.exe` si invocano col PERCORSO PIENO. `spawnSync` senza
 *     shell risolve il nome nudo dalla directory corrente: misurato lo stesso
 *     giorno copiando `hostname.exe` in `psql.exe` dentro una cartella qualsiasi
 *     — `spawnSync("psql", ["--version"])` eseguiva la copia (status 1, stdout
 *     vuoto) mentre da un'altra cartella rispondeva `psql (PostgreSQL) 18.4`.
 *     Chi cerca e chi lancia sarebbero i primi due binari sostituibili, e non li
 *     guarda nessuno.
 *  3. Un candidato che cade DENTRO il progetto auditato si rifiuta comunque: il
 *     PATH puo' contenerlo davvero, perche' `node_modules/.bin` ce lo mette npm.
 *  4. Un nome non risolto NON si lancia col nome nudo: vale strumento assente,
 *     cioe' verifica MANCANTE (regola della casa), mai un `pass`.
 *
 * CONSEGUENZA DICHIARATA. Un progetto che tenesse il proprio `supabase` SOLO
 * dentro `node_modules/.bin`, e col PATH che ce lo porta, vede ora quel passo
 * MANCANTE invece che verde. Non e' un rosso muto: il percorso rifiutato e il
 * motivo si stampano nel dettaglio del passo.
 *
 * Le decisioni qui dentro sono funzioni pure con i loro test
 * (`eseguibili.test.mjs`). L'unica impura e' `risolviEseguibile`, ed e' l'unico
 * punto della skill autorizzato a chiedere al sistema dove sta un binario.
 */

import { spawnSync } from "node:child_process";

/**
 * Il comando che CERCA, col percorso pieno e senza guardare la directory
 * corrente.
 *
 * Su POSIX `which` legge il PATH e basta: la directory corrente non entra nella
 * risoluzione a meno che il PATH non contenga `.`, e a quel caso risponde
 * `dentroLaRadice`. Il nome resta nudo perche' la sua collocazione cambia da
 * distribuzione a distribuzione; se manca, tutto vale MANCANTE, che e' la
 * direzione sicura.
 */
export function comandoRicerca(nome, piattaforma = process.platform, env = process.env) {
  if (piattaforma !== "win32") return { file: "which", args: [nome] };
  const sistema = env.SystemRoot || env.windir || "C:\\Windows";
  return { file: `${sistema}\\System32\\where.exe`, args: [`$PATH:${nome}`] };
}

/**
 * La shell che lancia gli shim `.cmd`, col percorso pieno.
 * `cmd.exe` scritto nudo si risolverebbe dalla directory corrente come tutto il
 * resto: sarebbe il buco n°2 lasciato aperto proprio dalla riga che chiude il n°1.
 */
export const shellDiSistema = (env = process.env) =>
  env.ComSpec || `${env.SystemRoot || env.windir || "C:\\Windows"}\\System32\\cmd.exe`;

/**
 * Un percorso cade dentro la radice del progetto auditato?
 * Il confronto NON e' per prefisso di stringa: `C:\prog-altro` comincia per
 * `C:\prog` e non e' dentro. Si normalizzano le barre e si confrontano i
 * SEGMENTI — cosi' la regola vale uguale su ogni piattaforma, e il suo test pure.
 */
export function dentroLaRadice(percorso, radice) {
  if (!percorso || !radice) return false;
  const segmenti = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").split("/");
  const r = segmenti(radice);
  const c = segmenti(percorso);
  if (c.length <= r.length) return false;
  // Windows non distingue maiuscole e minuscole nei percorsi: `C:\PROG` e
  // `C:\prog` sono lo stesso posto.
  return r.every((pezzo, i) => pezzo.toLowerCase() === c[i].toLowerCase());
}

/**
 * Quale candidato e' davvero LANCIABILE senza shell.
 *
 * npm installa DUE file per ogni comando: uno script di shell senza estensione
 * (per Git Bash) e uno shim `.cmd` (per Windows), e la ricerca li elenca in
 * quest'ordine. Il primo, Windows non sa eseguirlo. Misurato il 2026-07-28 in
 * questa skill: prendendo la prima riga, i passi `tsc` e `a11y` fallivano col
 * DETTAGLIO VUOTO su una macchina dove entrambi gli strumenti funzionano.
 * La funzione arriva qui da `verify.mjs`, dove si chiamava allo stesso modo:
 * tutto cio' che riguarda «quale binario si lancia» sta ora in un posto solo.
 */
export function scegliEseguibile(candidati) {
  const puliti = (candidati ?? []).map((c) => String(c).trim()).filter(Boolean);
  return (
    puliti.find((c) => /\.exe$/i.test(c)) ??
    puliti.find((c) => /\.(cmd|bat|com)$/i.test(c)) ??
    puliti[0] ??
    null
  );
}

/**
 * La forma con cui si lancia un eseguibile gia' risolto.
 *
 * `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd`
 * (quello che si ottiene installando la CLI Supabase da npm) risulta ENOENT sul
 * nome e EINVAL col percorso pieno — Node rifiuta di eseguire .cmd/.bat senza
 * shell dalla mitigazione della CVE-2024-27980. Risultato misurato il
 * 2026-07-27: quattro passi `skipped` con scritto «Supabase CLI assente» su una
 * macchina dove la CLI c'e' e funziona. Il guasto va nella direzione sicura, la
 * diagnosi no. Si passa da `cmd.exe /c <percorso pieno>`, che riceve gli
 * argomenti uno per uno — provato con un percorso contenente uno spazio.
 *
 * NON si abilita `shell: true`: li' gli argomenti vengono concatenati invece che
 * passati come vettore. Ma `cmd.exe /c` **e' una shell**, e chi legge questa
 * riga deve saperlo: gli argomenti che ci passano attraverso vanno filtrati
 * (referto § L1/H1/H2). Qui si decide solo CHI si lancia.
 *
 * `file: null` quando il nome non si risolve: il nome nudo non si lancia piu',
 * perche' lo risolverebbe la directory corrente del progetto auditato.
 */
export function formaEseguibile(
  nome,
  cercaPercorso,
  piattaforma = process.platform,
  comSpec = shellDiSistema(),
) {
  const trovato = cercaPercorso(nome);
  if (!trovato) return { file: null, prefisso: [] };
  return piattaforma === "win32" && /\.(cmd|bat)$/i.test(trovato)
    ? { file: comSpec, prefisso: ["/c", trovato] }
    : { file: trovato, prefisso: [] };
}

/**
 * Gli argomenti che non sopravvivono a `cmd /c` — e quelli che ne APPROFITTANO.
 *
 * Il commento della casa «NON si usa `shell: true`» diceva il vero e non
 * bastava: `cmd.exe /c` **E' una shell**, e ri-analizza `& | < > ^ ( ) " %`
 * prima che gli argomenti diventino argomenti. Di questi tre gate su quattro non
 * avevano nessun filtro (referto § H2/L1). Misurato il 2026-08-06 su uno shim
 * `.cmd` qualsiasi:
 *
 *   shim.cmd /&ver         → SHIM ricevuto: /  + «Microsoft Windows […]»: `ver`
 *                             ESEGUITO, e status 0
 *   shim.cmd %USERNAME%    → SHIM ricevuto: Utente (l'argomento arriva espanso)
 *   shim.cmd /|ver         → lo shim non parte affatto, parte `ver`, status 0
 *   shim.cmd />rubato.txt  → status 0, e su disco compare `rubato.txt`
 *
 * Gli spazi restano rifiutati, ed e' la regola misurata da speed-demon il
 * 2026-07-30: quando anche il percorso dello shim contiene uno spazio — e
 * `C:\Program Files\nodejs\npx.cmd` ce l'ha — un argomento con spazi fa
 * collassare il virgolettato del PROGRAMMA, e il messaggio d'errore accusa
 * `C:\Program`, cioe' tutt'altro argomento.
 *
 * Non si virgoletta meglio: dentro `"…"` cmd neutralizza `&|<>()` ma NON `%`, e
 * Node virgoletta da solo soltanto cio' che contiene spazi. Si rifiuta e si dice
 * perche': uno strumento che riceve un altro argomento risponde comunque, e
 * risponde di un'altra cosa.
 */
// I caratteri di CONTROLLO sono proprio cio' che si cerca: un a capo dentro
// un argomento e' una riga di comando in piu' per `cmd`. `no-control-regex`
// esiste per chi ce li mette per sbaglio (DECISIONI.md §8: ogni esenzione ha
// il motivo sulla riga sopra).
// eslint-disable-next-line no-control-regex
const OSTILI_A_CMD = /[\s&|<>^()"%]|[\u0000-\u001f]/;

export function argomentiOstiliACmd(args, piattaforma = process.platform) {
  if (piattaforma !== "win32") return [];
  return (args ?? []).filter((a) => OSTILI_A_CMD.test(String(a)));
}

/** Il messaggio, uguale ovunque: dice il carattere colpevole, non «errore». */
export const motivoOstile = (ostili) =>
  "argomenti non passabili da `cmd.exe /c`, che E' una shell e li ri-analizza " +
  "(spazi, oppure uno fra & | < > ^ ( ) \" % o un carattere di controllo): " +
  `${ostili.map((a) => JSON.stringify(String(a))).join(", ")}`;

/**
 * Il percorso pieno di uno strumento, o `null` con i candidati rifiutati.
 *
 * `radiceProgetto` e' la radice del progetto AUDITATO. Il timeout c'e' perche'
 * anche la ricerca e' una chiamata a processo, e in questa casa nessuna
 * chiamata a processo resta senza limite (referto § H10).
 */
export function risolviEseguibile(nome, radiceProgetto, attesaMs = 10_000) {
  const { file, args } = comandoRicerca(nome);
  const res = spawnSync(file, args, { encoding: "utf8", timeout: attesaMs, windowsHide: true });
  if (res.error || res.status !== 0) return { percorso: null, rifiutati: [] };
  const candidati = String(res.stdout ?? "").split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const rifiutati = candidati.filter((c) => dentroLaRadice(c, radiceProgetto));
  const ammessi = candidati.filter((c) => !dentroLaRadice(c, radiceProgetto));
  return { percorso: scegliEseguibile(ammessi), rifiutati };
}

/**
 * IL LIMITE E' SCATTATO?
 *
 * `spawnSync` col `timeout` uccide il figlio e mette `error.code = "ETIMEDOUT"`
 * (misurato: `status: null`, `signal: "SIGKILL"`). Un processo ucciso NON e' un
 * processo che ha risposto male: distinguerli e' la differenza fra «lo strumento
 * dice che c'e' un problema» e «lo strumento non ha detto niente».
 *
 * Misurato il 2026-08-06 (referto § H10 e § M14): contro un socket che accetta
 * la connessione e non parla, l'audit RLS e' rimasto appeso finche' non l'hanno
 * ucciso — 100 secondi nella prova, UNA riga stampata, uscita 124. Nessuna
 * chiamata a processo di questa skill aveva un limite.
 */
export const scaduto = (res) => res?.error?.code === "ETIMEDOUT";

/**
 * Il messaggio di un limite scattato: QUALE comando, QUANTO ha aspettato, e che
 * cosa vale (MANCANTE, mai un successo). Senza queste tre cose un gate che si
 * ferma e' indistinguibile da un gate che ha misurato.
 */
export const motivoScaduto = (comando, ms) =>
  `\`${comando}\` non ha risposto entro ${Math.round(ms / 1000)} s ed e' stato interrotto. ` +
  "La verifica NON e' stata eseguita: MANCANTE, non un successo. " +
  "Un servizio che accetta la connessione e non risponde e' il guasto tipico — la porta e' aperta, il processo e' vivo, la risposta non arriva.";

/**
 * LA PASSWORD NON ESCE DAL GATE.
 *
 * Referto § M2: la URL di connessione col suo `--db-url` finisce in stdout e
 * nel `--json` di tre gate su quattro, e da li' negli handoff COMMITTATI. Il
 * 2026-08-06 il gate di launchpad ha bloccato la pubblicazione del pilota anche
 * per questo: `docs/handoff/08-vetrina-crafter.md @ fff715b` contiene una
 * `postgresql://…:…@…` scritta lo stesso giorno. E' MEDIUM finche' la password
 * e' `postgres:postgres` su loopback; torna HIGH il primo giorno in cui un
 * `--db-url` punta a un database che non e' locale — cosa che i gate accettano
 * senza obiezioni.
 *
 * PERCHE' `new URL` E NON UNA REGEXP. Il mascheramento esisteva gia' in casa,
 * a `vetrina-crafter/verify.mjs:378`, ed e' `replace(/:[^:@]*@/, ":***@")`.
 * Misurato il 2026-08-06, la regexp sbaglia in tre modi su cinque forme:
 *
 *   postgresql://postgres:p%40ss:word@db.example.com/prod
 *     regexp → postgresql://postgres:p%40ss:***@…   META' PASSWORD IN CHIARO
 *   postgresql://postgres@127.0.0.1:54322/postgres      (nessuna password)
 *     regexp → postgresql:***@127.0.0.1:54322/postgres  URL DISTRUTTA
 *   postgres://127.0.0.1:5432/db?opt=a:b@c              (nessuna password)
 *     regexp → postgres://127.0.0.1:5432/db?opt=a:***@c QUERY MANGIATA
 *
 * E' lo stesso guasto del difetto n°50 e degli altri tre di questa classe: uno
 * scanner scritto a mano che non sa dentro quale parte della struttura si trova.
 * `new URL` la struttura la conosce: `password` e' un campo, non un pezzo di
 * testo fra due caratteri. E' nel runtime, non e' una dipendenza.
 *
 * Se la URL non si interpreta affatto NON si stampa il testo originale: un
 * testo che contiene una `@` puo' contenere una credenziale, e un mascheratore
 * che in caso di dubbio stampa tutto non e' un mascheratore.
 */
export function mascheraUrl(url) {
  const testo = String(url ?? "");
  if (testo === "") return testo;
  const nascosta = "<url non interpretabile: nascosta perche' poteva contenere una password>";
  try {
    const analizzata = new URL(testo);
    if (analizzata.password !== "") {
      analizzata.password = "***";
      return analizzata.href;
    }
    // `new URL` non solleva su cio' che ha una forma di schema: `postgres:pw@host`
    // si analizza come schema + percorso opaco, con `password` VUOTA — e senza
    // questa riga il testo uscirebbe intero. Misurato mentre si scriveva il test
    // che doveva vederlo nascosto. Se il parser non ha riconosciuto nessun host,
    // non ha riconosciuto nemmeno l'autorita': una `@` li' dentro non si stampa.
    if (analizzata.host === "" && testo.includes("@")) return nascosta;
    return testo;
  } catch {
    return testo.includes("@") ? nascosta : testo;
  }
}
