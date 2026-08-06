/**
 * eseguibili.test.mjs — Chi sceglie il binario che esegue il gate.
 *
 * Nasce dal § C1 del referto del 2026-08-06: i gate si lanciano dalla radice del
 * progetto AUDITATO, e sia `where` sia `spawnSync` col nome nudo cercano prima
 * nella directory corrente. Un `supabase.cmd` piantato nella radice portava a
 * casa sei passi su nove.
 *
 * Quattro dei test qui sotto vengono da `verify.test.mjs` (shim `.cmd` di
 * Windows, 2026-07-27) e ne CORREGGONO due, che asserivano il comportamento poi
 * risultato difettoso:
 *   - «fuori da Windows non si cerca niente: il nome basta» → ora si cerca
 *     ovunque, perche' il nome nudo non si lancia piu';
 *   - «comando davvero assente: si torna al nome» → ora si torna a `null`, che
 *     e' strumento assente, cioe' verifica MANCANTE.
 *
 * Runner nativo, zero dipendenze:  node --test "scripts/**\/*.test.mjs"
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  argomentiOstiliACmd,
  comandoRicerca,
  motivoOstile,
  dentroLaRadice,
  formaEseguibile,
  scegliEseguibile,
  shellDiSistema,
} from "./eseguibili.mjs";

// --------------------------------------------- chi cerca, e dove NON cerca
test("su Windows si cerca col percorso pieno di where.exe e col prefisso $PATH:", () => {
  assert.deepEqual(
    comandoRicerca("supabase", "win32", { SystemRoot: "C:\\Windows" }),
    { file: "C:\\Windows\\System32\\where.exe", args: ["$PATH:supabase"] },
  );
});

test("senza SystemRoot si ripiega su C:\\Windows, mai sul nome nudo `where`", () => {
  const { file } = comandoRicerca("psql", "win32", {});
  assert.equal(file, "C:\\Windows\\System32\\where.exe");
});

test("fuori da Windows si cerca con which, che legge il PATH e non la cartella corrente", () => {
  assert.deepEqual(comandoRicerca("psql", "linux", {}), { file: "which", args: ["psql"] });
});

test("la shell degli shim e' quella dichiarata da ComSpec, col percorso pieno", () => {
  assert.equal(shellDiSistema({ ComSpec: "C:\\Windows\\System32\\cmd.exe" }), "C:\\Windows\\System32\\cmd.exe");
  assert.equal(shellDiSistema({ SystemRoot: "D:\\Win" }), "D:\\Win\\System32\\cmd.exe");
});

// ------------------------------------- il candidato dentro il progetto auditato
test("un eseguibile dentro il progetto auditato e' dentro la radice", () => {
  assert.equal(dentroLaRadice("C:\\prog\\node_modules\\.bin\\supabase.cmd", "C:\\prog"), true);
  assert.equal(dentroLaRadice("C:\\prog\\supabase.cmd", "C:\\prog"), true);
});

test("un eseguibile fuori dal progetto non lo e', e nemmeno un altro disco", () => {
  assert.equal(dentroLaRadice("C:\\Users\\x\\scoop\\shims\\supabase.exe", "C:\\prog"), false);
  assert.equal(dentroLaRadice("D:\\strumenti\\supabase.exe", "C:\\prog"), false);
});

test("la radice non e' dentro se stessa, e senza radice non si rifiuta niente", () => {
  assert.equal(dentroLaRadice("C:\\prog", "C:\\prog"), false);
  assert.equal(dentroLaRadice("C:\\prog\\x.exe", null), false);
  assert.equal(dentroLaRadice(null, "C:\\prog"), false);
});

// `C:\prog-altro` comincia per `C:\prog`: un confronto per prefisso di stringa
// lo direbbe dentro. Il confronto a segmenti no, ed e' il motivo per cui si usa quello.
test("una cartella sorella col nome che comincia uguale non e' dentro", () => {
  assert.equal(dentroLaRadice("C:\\prog-altro\\supabase.exe", "C:\\prog"), false);
});

// ---------------------------------------------------- quale candidato si lancia
test("fra lo script senza estensione e lo shim .cmd si sceglie quello lanciabile", () => {
  assert.equal(scegliEseguibile(["C:\\nodejs\\npx", "C:\\nodejs\\npx.cmd"]), "C:\\nodejs\\npx.cmd");
});

test("un .exe vince su tutto, anche se elencato dopo", () => {
  assert.equal(scegliEseguibile(["C:\\x\\tool.cmd", "C:\\x\\tool.exe"]), "C:\\x\\tool.exe");
});

test("su POSIX il candidato senza estensione e' l'unico, e va bene", () => {
  assert.equal(scegliEseguibile(["/usr/bin/psql"]), "/usr/bin/psql");
});

test("nessun candidato: null, non una stringa vuota", () => {
  assert.equal(scegliEseguibile([]), null);
  assert.equal(scegliEseguibile(["", "  "]), null);
  assert.equal(scegliEseguibile(undefined), null);
});

// ------------------------------------------- shim .cmd di Windows (2026-07-27)
// `spawnSync(cmd, args)` senza shell non consulta PATHEXT (ENOENT sullo shim) e
// col percorso pieno Node rifiuta .cmd/.bat (EINVAL, mitigazione della
// CVE-2024-27980): quattro passi risultavano `skipped` con scritto «Supabase
// CLI assente» su una macchina dove la CLI c'era.
test("shim .cmd su Windows: si passa da cmd.exe, non da shell:true", () => {
  assert.deepEqual(
    formaEseguibile("supabase", () => "C:\\Users\\x\\AppData\\Roaming\\npm\\supabase.cmd", "win32", "C:\\Windows\\System32\\cmd.exe"),
    { file: "C:\\Windows\\System32\\cmd.exe", prefisso: ["/c", "C:\\Users\\x\\AppData\\Roaming\\npm\\supabase.cmd"] },
  );
});

test("la shell dello shim si lancia col percorso pieno, mai come `cmd.exe` nudo", () => {
  const { file } = formaEseguibile("supabase", () => "C:\\x\\supabase.cmd", "win32", "D:\\Win\\System32\\cmd.exe");
  assert.equal(file, "D:\\Win\\System32\\cmd.exe");
});

test("un .exe su Windows si esegue diretto: nessun cmd.exe di mezzo", () => {
  assert.deepEqual(
    formaEseguibile("supabase", () => "C:\\Users\\x\\scoop\\shims\\supabase.exe", "win32"),
    { file: "C:\\Users\\x\\scoop\\shims\\supabase.exe", prefisso: [] },
  );
});

// CORREZIONE del 2026-08-06. Prima: «fuori da Windows non si cerca niente: il
// nome basta», e il nome nudo finiva in `spawnSync` — che su Windows lo risolve
// dalla directory corrente, e su POSIX pure se il PATH contiene `.`.
test("fuori da Windows si cerca lo stesso: il nome nudo non si lancia piu'", () => {
  let cercato = false;
  const forma = formaEseguibile("psql", () => { cercato = true; return "/usr/bin/psql"; }, "linux");
  assert.deepEqual(forma, { file: "/usr/bin/psql", prefisso: [] });
  assert.equal(cercato, true);
});

// CORREZIONE del 2026-08-06. Prima: «comando davvero assente: si torna al nome,
// e il probe fallira' come prima». Il probe NON falliva come prima: falliva solo
// se nella directory corrente non c'era un omonimo.
test("comando davvero assente: file null, e chi lancia deve dire MANCANTE", () => {
  assert.deepEqual(formaEseguibile("squawk", () => null, "win32"), { file: null, prefisso: [] });
  assert.deepEqual(formaEseguibile("squawk", () => null, "linux"), { file: null, prefisso: [] });
});

// -------- argomenti ostili a `cmd /c` (referto § H2/L1, 2026-08-06)
// Questo gate non aveva nessun filtro. Misurato su uno shim `.cmd` vero, con
// `cmd.exe /c`:
//   /&ver         → lo shim riceve `/`, e `ver` ESEGUE. status 0
//   %USERNAME%    → lo shim riceve `Utente`: l'argomento arriva espanso
//   /|ver         → lo shim non parte affatto, parte `ver`. status 0
//   />rubato.txt  → status 0, e su disco compare `rubato.txt`
// Il commento della casa «NON si abilita `shell: true`» era una garanzia falsa:
// `cmd.exe /c` E' una shell.

test("i metacaratteri di cmd sono ostili: attraverso `cmd /c` eseguono codice", () => {
  for (const arg of ["/&ver", "%USERNAME%", "/|ver", "/>rubato.txt", "a<b", "(x)", 'dice"quello', "a^b"]) {
    assert.deepEqual(argomentiOstiliACmd([arg], "win32"), [arg], `passava: ${arg}`);
  }
});

test("gli spazi restano ostili: con lo shim in `C:/Program Files` il programma si tronca", () => {
  assert.deepEqual(argomentiOstiliACmd(["--config C:/x/.sqlfluff"], "win32"), ["--config C:/x/.sqlfluff"]);
});

test("gli argomenti veri di `supabase db reset` restano leciti", () => {
  assert.deepEqual(argomentiOstiliACmd(["db", "reset"], "win32"), []);
  assert.deepEqual(argomentiOstiliACmd(["db", "advisors", "--local", "--level", "warn", "--fail-on", "error"], "win32"), []);
});

test("fuori da Windows non c'e' cmd, e nessun argomento e' ostile", () => {
  assert.deepEqual(argomentiOstiliACmd(["/&ver", "db reset"], "linux"), []);
});

test("il motivo nomina i caratteri colpevoli, non dice solo `errore`", () => {
  const motivo = motivoOstile(["/&ver"]);
  assert.match(motivo, /E' una shell/);
  assert.ok(motivo.includes('"/&ver"'));
});
