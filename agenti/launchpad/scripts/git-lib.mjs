/**
 * git-lib.mjs — l'unico posto in cui questa skill parla con git.
 *
 * Nasce da un rilievo di `jscpd` il 2026-08-06: `leggiStoria` era copiata in
 * `verify.mjs` e in `segreti.mjs` (44 righe identiche) e il risolutore
 * dell'eseguibile in tutti e tre i gusci. Non e' una questione di eleganza:
 * **due copie divergono**, e in questa casa e' gia' successo — la copia globale
 * di code-maniac e quella committata differivano su 15 file, ed e' il motivo
 * per cui `.claude/skills/` e' una junction invece che una copia
 * (`DECISIONI.md` §7). Una delle due copie di `leggiStoria` era gia' rimasta
 * indietro di una correzione per qualche minuto.
 */

import { spawnSync } from "node:child_process";

/**
 * Cio' che nessun deploy carica, nemmeno da CLI: artefatti di build, cache,
 * artefatti di runtime dello stack Supabase locale, e — la piu' importante —
 * `.claude/`, che in questa casa e' una JUNCTION verso la regia. Senza
 * quest'ultima riga il controllo dei segreti attraversa il link e legge un
 * altro repository intero: misurato sul pilota il 2026-08-06, 181 file
 * «ignorati» di cui la maggior parte erano i verbali di un'altra skill.
 */
export const FUORI_DAL_PACCHETTO =
  /(^|[/\\])(node_modules|\.next|\.git|\.claude|\.turbo|\.vercel|\.wrangler|out|dist|coverage|test-results|playwright-report|\.perf)([/\\]|$)|(^|[/\\])supabase[/\\]\.(temp|branches)([/\\]|$)|(^|[/\\])e2e[/\\]\.auth([/\\]|$)/;

// --------------------------------------- eseguibili risolti a mano su Windows
// `spawnSync(cmd, args)` senza shell non consulta PATHEXT: uno shim `.cmd`
// risulta ENOENT sul nome nudo. NON si abilita `shell: true`: li' gli argomenti
// vengono concatenati invece che passati come vettore. Prezzo gia' pagato da
// Schema Forge, Flow Sentinel e Speed Demon; non si ripaga.
let GIT = null;

export function trovaGit() {
  if (GIT !== null) return GIT;
  const res = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" });
  if (res.error || res.status !== 0) return (GIT = false);
  const righe = res.stdout.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  // Su Windows la prima riga di `where` puo' essere uno script senza
  // estensione, che il sistema non sa eseguire: si prende la prima ESEGUIBILE.
  // Difetto gia' misurato da Speed Demon il 2026-07-30 su `where npx`.
  const scelta = process.platform === "win32"
    ? righe.find((r) => /\.(exe|cmd|bat)$/i.test(r))
    : righe[0];
  return (GIT = scelta || false);
}

/**
 * Un comando git. Ritorna `{ ok, out, troncato }`: mai un'eccezione, mai un
 * `pass` finto.
 *
 * `-c core.quotepath=false` — rilievo IO-2 del tribunale del 2026-08-06.
 * Con il default, `git ls-files` **quota e sfugge in ottale** i percorsi con
 * byte non-ASCII: `docs/handoff/03-caffè.md` diventa
 * `"docs/handoff/03-caff\303\250.md"`, virgolette comprese. Il percorso
 * mangled non esiste, `readFileSync` dava `ENOENT`, e il `catch` lo
 * attribuiva a «file sparito fra `ls-files` e la lettura» — che e' una
 * condizione di gara, non quello che stava succedendo. Un segreto in un file
 * con un accento nel nome non veniva mai visto, **in una casa che scrive in
 * italiano**.
 *
 * `troncato` — rilievo IO-5. Superato `maxBuffer`, `spawnSync` mette `error` E
 * ha gia' bufferizzato dati parziali: buttarli via senza dirlo rendeva «storia
 * enorme» indistinguibile da «nessuna storia».
 */
export function git(dir, args, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  const exe = trovaGit();
  if (!exe) return { ok: false, out: "", troncato: false };
  const res = spawnSync(exe, ["-c", "core.quotepath=false", "-C", dir, ...args], { encoding: "utf8", maxBuffer });
  const troncato = res.error?.code === "ENOBUFS";
  if (res.error || res.status !== 0) return { ok: false, out: res.stdout ?? "", troncato };
  return { ok: true, out: res.stdout ?? "", troncato: false };
}

export function gitRighe(dir, args) {
  const { ok, out } = git(dir, args);
  return ok ? out.split(/\r?\n/).map((r) => r.trim()).filter(Boolean) : null;
}

// Il marcatore di commit, come escape: un byte 0x01 scritto grezzo nel
// sorgente sarebbe invisibile a chi legge e lo segnala `no-irregular-whitespace`.
const MARCATORE = "\u0001";

/**
 * Le righe AGGIUNTE dagli ultimi N commit, raggruppate per FILE dentro il commit.
 *
 * Un segreto tolto da HEAD con un commit successivo e' ancora consegnato: chi
 * ha clonato ce l'ha, e un deploy connesso a git da' al provider la STORIA.
 * Si guardano le sole righe aggiunte perche' una riga rimossa e' gia' contata
 * dal commit che l'aveva introdotta.
 *
 * PER FILE, e non per commit: la prima stesura appiattiva tutte le righe
 * aggiunte di un commit in un blocco solo, etichettato col solo sha — e quella
 * scelta rendeva CIECA la famiglia `credenziale-sql`, che si applica ai soli
 * `.sql`, perche' nessuna etichetta finiva per `.sql`. Una password committata
 * in un seed e tolta il giorno dopo non veniva vista da nessuno. Trovato da un
 * test il 2026-08-06.
 */
export function leggiStoria(dir, quanti) {
  if (quanti <= 0) return [];
  const { ok, out, troncato } = git(dir, [
    "log", "--all", `-n${quanti}`, "-p", "--unified=0", "--no-color", "--format=%x01%H %cI", "--", ".",
  ]);
  // Una storia TRONCATA non e' una storia vuota: chi legge deve poterlo sapere,
  // o «0 pezzi letti» su un repo enorme somiglia a «0 pezzi letti» su un repo
  // pulito (rilievo IO-5). Si segnala con un pezzo sentinella, che le famiglie
  // ignorano e il chiamante riconosce.
  if (troncato) return [{ percorso: "", etichetta: "", testo: "", troncata: true }];
  if (!ok || !out) return [];
  const pezzi = [];
  let sha = null;
  let data = null;
  let file = null;
  let righeAggiunte = [];
  const chiudi = () => {
    if (file && righeAggiunte.length > 0) {
      pezzi.push({
        percorso: file,
        etichetta: `${file} @ ${sha} (${(data ?? "").slice(0, 10)})`,
        testo: righeAggiunte.join("\n"),
      });
    }
    righeAggiunte = [];
  };
  for (const riga of out.split(/\r?\n/)) {
    if (riga.startsWith(MARCATORE)) {
      chiudi();
      file = null;
      [sha, data] = riga.slice(1).split(" ");
      sha = (sha ?? "").slice(0, 12);
      continue;
    }
    if (riga.startsWith("+++ ")) {
      chiudi();
      const p = riga.slice(4).trim();
      file = p === "/dev/null" ? null : p.replace(/^b\//, "");
      continue;
    }
    if (riga.startsWith("--- ") || riga.startsWith("+++")) continue;
    if (riga.startsWith("+") && file) righeAggiunte.push(riga.slice(1));
  }
  chiudi();
  return pezzi;
}
