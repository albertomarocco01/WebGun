#!/usr/bin/env node
/**
 * verifica-regia.mjs — Il gate della REGIA.
 *
 * Non verifica un sito: verifica questo repo, cioe' il posto da cui gli agenti
 * partono. Lo dichiarava mancante `DECISIONI.md` §26 con la frase «il posto
 * giusto dove chiuderlo e' un gate della regia, che oggi non esiste».
 *
 * COSA MISURA: cinque coerenze fra quello che la regia RACCONTA e quello che
 * nel repo C'E'. Tutte e cinque hanno un precedente misurato, nessuna e' una
 * preoccupazione:
 *   docx-txt          — `webgun_content.txt` ha mentito per due giorni sul
 *                       contenuto del `.docx` (§26);
 *   skill-elencate    — `installa-skill.ps1` ne elencava quattro quando erano
 *                       cinque, e chi seguiva il manuale non installava
 *                       `speed-demon` senza accorgersene (README §Installazione);
 *   stato-presente    — un agente senza `STATO.md` e' un agente che chi lo
 *                       riprende deve dedurre dal codice;
 *   epiloghi-vivi     — `if (import.meta.main)` su Node 20 fa uscire un gate
 *                       `0` senza stampare una riga (P.0-igiene, 2026-08-03);
 *   segnaposto-radice — un `{{…}}` rimasto e' un documento mai riempito.
 *
 * USO:  node scripts/verifica-regia.mjs [--json]   (dalla radice della regia)
 * USCITA: 0 = verde · 1 = rosso · 2 = errore di esecuzione (niente JSON su 2)
 *
 * `skipped` NON e' un successo: e' una verifica mancante, e il gate resta rosso
 * (CLAUDE.md, Regola dei guardiani). Uno strumento assente vale MANCANTE.
 *
 * IL GATE MISURA, NON CORREGGE. In particolare non riscrive `webgun_content.txt`:
 * un gate che sana quello che misura chiude verde a ogni giro e non dice mai che
 * il documento madre e' cambiato senza che nessuno rilanciasse l'estrazione.
 *
 * Le regole vivono in `regia-lib.mjs` e hanno i loro test: qui c'e' solo il
 * guscio di I/O, e l'ORDINE della lista `PASSI` e' il gate.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  conBarre,
  contaGravita,
  dettaglioFindings,
  findingsDocx,
  findingsEpiloghi,
  findingsSegnaposto,
  findingsSkillElencate,
  findingsStato,
  skillDaPs1,
  skillDaReadme,
  statoDaFindings,
  tabellaAgenti,
} from "./regia-lib.mjs";

const REGIA = process.cwd();
const DOCX = "Web Gun.docx";
const TXT = "webgun_content.txt";
const ESTRAI = "scripts/estrai-docx.ps1";
const INSTALLA = "scripts/installa-skill.ps1";
const README = "README.md";

/** L'ordine di questa lista E' il gate, e un test lo blocca (DECISIONI.md §15).
 *  I primi tre leggono quello che la regia dichiara, gli ultimi due quello che
 *  ha scritto. */
export const ID = Object.freeze({
  docx: "docx-txt",
  skill: "skill-elencate",
  stato: "stato-presente",
  epiloghi: "epiloghi-vivi",
  segnaposto: "segnaposto-radice",
});

export const CONTRATTO_JSON = 1;

/** Cartelle che non contengono codice di questo repo. `node_modules` prima di
 *  tutte: ci sono decine di migliaia di file, e nessuno l'ha scritto qui. */
const NON_SI_ENTRA = new Set(["node_modules", ".git", ".next", ".claude", "dist", "build", "coverage"]);
const SORGENTI = /\.(mjs|cjs|js)$/;

const steps = [];
const record = (id, name, status, detail = "") => {
  const passo = { id, name, status, detail };
  steps.push(passo);
  return passo;
};

/** `counts` sta SOLO sui passi che producono findings per gravita': gli altri
 *  non hanno niente da contare, e una chiave a zero direbbe che hanno guardato. */
function conFindings(id, nome, findings, testa) {
  const passo = record(id, nome, statoDaFindings(findings),
    [testa, findings.length > 0 ? dettaglioFindings(findings) : "nessun rilievo"].filter(Boolean).join("\n"));
  passo.counts = contaGravita(findings);
  return passo;
}

const leggiSeCe = (relativo) => {
  const pieno = join(REGIA, relativo);
  return existsSync(pieno) ? readFileSync(pieno, "utf8") : null;
};

function dove(nome) {
  const res = spawnSync(process.platform === "win32" ? "where" : "which", [nome], { encoding: "utf8" });
  if (res.error || res.status !== 0) return null;
  const prima = String(res.stdout).split(/\r?\n/).map((r) => r.trim()).find(Boolean);
  return prima || null;
}

/** I file sorgente sotto una cartella, `node_modules` esclusa. Percorsi
 *  relativi alla radice della regia, con le barre in avanti. */
function sorgentiSotto(relativo) {
  const trovati = [];
  const scendi = (dir) => {
    let voci;
    try { voci = readdirSync(join(REGIA, dir), { withFileTypes: true }); } catch { return; }
    for (const voce of voci) {
      if (NON_SI_ENTRA.has(voce.name)) continue;
      const percorso = `${dir}/${voce.name}`;
      if (voce.isDirectory()) scendi(percorso);
      else if (SORGENTI.test(voce.name)) trovati.push(percorso);
    }
  };
  scendi(conBarre(relativo));
  return trovati;
}

/** Le cartelle di `agenti/`, con quello che ognuna ha dentro. */
function cartelleAgenti() {
  const radice = join(REGIA, "agenti");
  if (!existsSync(radice)) return null;
  return readdirSync(radice, { withFileTypes: true })
    .filter((v) => v.isDirectory() && !NON_SI_ENTRA.has(v.name))
    .map((v) => ({
      nome: v.name,
      haVerify: existsSync(join(radice, v.name, "scripts", "verify.mjs")),
      haStato: existsSync(join(radice, v.name, "STATO.md")),
      haSkill: existsSync(join(radice, v.name, "SKILL.md")),
    }));
}

/** La tabella §Natura del README, o `null`. Serve a due passi, e si legge una
 *  volta sola. */
function leggiTabella(ctx) {
  if (ctx.tabella !== undefined) return ctx.tabella;
  const testo = leggiSeCe(README);
  ctx.tabella = testo ? tabellaAgenti(testo) : null;
  return ctx.tabella;
}

/** L'ora di modifica in ora LOCALE, non UTC: chi legge il dettaglio la
 *  confronta con quella che gli stampa `ls`, e due orari diversi per lo stesso
 *  file fanno dubitare del file invece che del fuso. */
const quando = (relativo) => {
  try { return statSync(join(REGIA, relativo)).mtime.toLocaleString("sv-SE").slice(0, 16); } catch { return "?"; }
};
const byte = (relativo) => {
  try { return statSync(join(REGIA, relativo)).size; } catch { return 0; }
};

// ------------------------------------------------------------------ i passi
const PASSI = [
  {
    id: ID.docx,
    nome: "documento madre e copia di testo",
    esegui() {
      for (const [percorso, perche] of [
        [DOCX, "il documento madre non c'e': non c'e' niente da cui riestrarre"],
        [TXT, "la copia di testo non c'e': non c'e' niente da confrontare"],
        [ESTRAI, "lo script di estrazione non c'e': il confronto lo farebbe una seconda implementazione, che e' esattamente il modo di misurare se stessi"],
      ]) {
        if (!existsSync(join(REGIA, percorso))) return record(this.id, this.nome, "skipped", `${percorso} assente: ${perche}`);
      }
      const guscio = dove("powershell") ?? dove("pwsh");
      if (!guscio) {
        return record(this.id, this.nome, "skipped",
          "ne' `powershell` ne' `pwsh` nel PATH: l'estrazione NON e' stata rifatta, quindi non si sa se il `.txt` sia allineato. Uno strumento assente vale MANCANTE, mai PASS");
      }

      // Si lancia LO SCRIPT DI CASA con un'uscita temporanea, non una seconda
      // estrazione scritta qui: due implementazioni della stessa cosa divergono,
      // e il gate misurerebbe la propria idea di `.docx` invece del `.txt` che
      // il repo produce davvero.
      const cartella = mkdtempSync(join(tmpdir(), "regia-docx-"));
      const uscita = join(cartella, "riestratto.txt");
      try {
        const res = spawnSync(guscio,
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(REGIA, ESTRAI), "-Uscita", uscita],
          { encoding: "utf8", cwd: REGIA, maxBuffer: 64 * 1024 * 1024 });
        if (res.error || res.status !== 0 || !existsSync(uscita)) {
          const perche = res.error ? res.error.message : `uscita ${res.status}\n${(res.stderr || res.stdout || "").trim().split(/\r?\n/).slice(0, 6).join("\n")}`;
          return record(this.id, this.nome, "skipped",
            `\`${ESTRAI}\` non ha prodotto niente: ${perche}\nla riestrazione non e' avvenuta, quindi il confronto non e' stato fatto`);
        }
        const attesa = readFileSync(uscita, "utf8");
        const trovata = readFileSync(join(REGIA, TXT), "utf8");
        const { findings } = findingsDocx({ attesa, trovata, percorso: TXT });
        // Il bersaglio si stampa SEMPRE, anche sul verde (DECISIONI.md §11).
        const testa =
          `${DOCX} (${byte(DOCX)} byte, modificato ${quando(DOCX)}) → riestratto in un file temporaneo\n` +
          `confrontato con ${TXT} (${byte(TXT)} byte, modificato ${quando(TXT)}) · il gate NON riscrive il .txt`;
        return conFindings(this.id, this.nome, findings, testa);
      } finally {
        rmSync(cartella, { recursive: true, force: true });
      }
    },
  },

  {
    id: ID.skill,
    nome: "skill vere ed elenchi che le dichiarano",
    esegui(ctx) {
      const cartelle = cartelleAgenti();
      if (!cartelle) return record(this.id, this.nome, "skipped", "nessuna cartella `agenti/`: non c'e' niente da elencare");
      const tabella = leggiTabella(ctx);
      if (!tabella) {
        return record(this.id, this.nome, "skipped",
          `tabella \`## Natura degli agenti\` non leggibile in ${README}: e' li' che il repo dichiara quali agenti sono finiti e quali sono snapshot di altri repo. Senza, il gate non ripiega su un elenco cablato qui — direbbe una cosa mentre il README ne dice un'altra (DECISIONI.md §18)`);
      }
      const testoPs1 = leggiSeCe(INSTALLA);
      const ps1 = testoPs1 ? skillDaPs1(testoPs1) : null;
      if (!ps1) {
        return record(this.id, this.nome, "skipped",
          `array \`$skill = @(…)\` non trovato in ${INSTALLA}: un elenco non trovato non e' un elenco vuoto`);
      }
      const readme = skillDaReadme(leggiSeCe(README) ?? "");
      if (!readme) {
        return record(this.id, this.nome, "skipped",
          `frase «Installa **…**» non trovata in ${README} §Installazione delle skill: il confronto fra i due elenchi non e' stato fatto`);
      }

      const { findings, esenti } = findingsSkillElencate({ cartelle, tabella, ps1, readme });
      const testa = [
        `${INSTALLA}: ${ps1.join(", ")}`,
        `${README} §Installazione: ${readme.join(", ")}`,
        `tabella §Natura: ${[...tabella.values()].filter((r) => r.verde && r.diCasa).map((r) => r.nome).join(", ") || "nessun agente 🟢 di questo repo"} dichiarati 🟢 e di questo repo`,
        // Le esenti si stampano: sono il buco della regola, e un buco che si
        // stampa a ogni giro non e' un buco silenzioso.
        esenti.length > 0
          ? `non pretese in elenco (${esenti.length}): ${esenti.map((e) => `${e.nome} — ${e.perche}`).join(" · ")}\n  regola di casa: una skill entra in README e nello script A GATE VERDE, non prima`
          : "",
      ].filter(Boolean).join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.stato,
    nome: "STATO.md di ogni agente di casa",
    esegui(ctx) {
      const cartelle = cartelleAgenti();
      if (!cartelle) return record(this.id, this.nome, "skipped", "nessuna cartella `agenti/`: non c'e' niente da guardare");
      const tabella = leggiTabella(ctx);
      if (!tabella) {
        return record(this.id, this.nome, "skipped",
          `tabella \`## Natura degli agenti\` non leggibile in ${README}: senza, non si distingue un agente di casa da uno snapshot di un altro repo, e pretendere uno \`STATO.md\` da uno snapshot sarebbe un rosso su codice di cui questo repo non e' la fonte di verita' (DECISIONI.md §2)`);
      }
      const { findings, saltate } = findingsStato({ cartelle, tabella });
      const testa = [
        `${cartelle.length} cartelle in agenti/ · ${cartelle.length - saltate.length} di casa guardate`,
        saltate.length > 0
          ? `saltate perche' snapshot esterni (${saltate.length}): ${saltate.map((s) => `${s.nome} (${s.origine})`).join(" · ")}`
          : "",
      ].filter(Boolean).join("\n");
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.epiloghi,
    nome: "epiloghi degli script di casa",
    esegui(ctx) {
      const cartelle = cartelleAgenti();
      const tabella = leggiTabella(ctx);
      if (!cartelle || !tabella) {
        return record(this.id, this.nome, "skipped",
          `senza le cartelle di \`agenti/\` e la tabella §Natura di ${README} non si sa quali script siano di casa: gli snapshot esterni non si giudicano qui`);
      }
      const diCasa = cartelle.filter((c) => {
        const riga = tabella.get(c.nome.toLowerCase());
        return !riga || riga.diCasa;
      });
      const percorsi = [
        ...sorgentiSotto("scripts"),
        ...diCasa.flatMap((c) => sorgentiSotto(`agenti/${c.nome}`)),
      ];
      if (percorsi.length === 0) {
        return record(this.id, this.nome, "skipped", "nessun sorgente `.mjs`/`.js` trovato: non e' stato letto niente, e uno strumento che non ha letto niente non produce un `pass` (DECISIONI.md §18)");
      }
      const file = percorsi.map((percorso) => ({ percorso, testo: readFileSync(join(REGIA, percorso), "utf8") }));
      const findings = findingsEpiloghi(file);
      const testa =
        `${file.length} sorgenti letti (scripts/ della regia + ${diCasa.length} agenti di casa; snapshot esterni e node_modules esclusi)\n` +
        "si cerca `import.meta.main` nelle sole righe di CODICE: i commenti che spiegano perche' non si usa, e le stringhe dei test che lo verificano, non contano";
      return conFindings(this.id, this.nome, findings, testa);
    },
  },

  {
    id: ID.segnaposto,
    nome: "segnaposto nei documenti di radice",
    esegui() {
      const nomi = readdirSync(REGIA, { withFileTypes: true })
        .filter((v) => v.isFile() && v.name.endsWith(".md"))
        .map((v) => v.name)
        .sort();
      if (nomi.length === 0) {
        return record(this.id, this.nome, "skipped", "nessun `.md` nella radice: non e' stato letto niente");
      }
      const file = nomi.map((percorso) => ({ percorso, testo: readFileSync(join(REGIA, percorso), "utf8") }));
      const findings = findingsSegnaposto(file);
      const testa =
        `${nomi.length} documenti letti: ${nomi.join(", ")}\n` +
        "fuori dai blocchi ``` e dal `codice inline`: e' li' che questi documenti CITANO i segnaposto dei template invece di averne uno dimenticato";
      return conFindings(this.id, this.nome, findings, testa);
    },
  },
];

// ------------------------------------------------------------------- verdetto
export function riepilogo(passi) {
  const per = (stato) => passi.filter((s) => s.status === stato).length;
  return { passi: passi.length, pass: per("pass"), fail: per("fail"), skipped: per("skipped") };
}

function verdetto(json) {
  const riassunto = riepilogo(steps);
  const verde = riassunto.fail === 0 && riassunto.skipped === 0;

  if (json) {
    console.log(JSON.stringify({ contract: CONTRATTO_JSON, ok: verde, summary: riassunto, steps }, null, 2));
    return verde ? 0 : 1;
  }

  console.log(`GATE REGIA: ${verde ? "VERDE" : "ROSSO"} (${riassunto.fail} falliti, ${riassunto.skipped} verifiche mancanti su ${riassunto.passi} passi)`);
  console.log(`repo: ${conBarre(REGIA)}\n`);
  for (const s of steps) {
    console.log(`${{ pass: "OK  ", fail: "FAIL", skipped: "MANC" }[s.status]}  ${s.name}`);
    // Il dettaglio si stampa anche sui passi verdi: e' li' che finiscono i
    // bersagli — quali file, quali elenchi, cosa e' stato saltato e perche'
    // (DECISIONI.md §11).
    if (s.detail) for (const riga of s.detail.split("\n")) console.log(`        ${riga}`);
  }
  if (riassunto.skipped > 0) console.log("\nUna verifica mancante non e' una verifica superata: il gate resta rosso.");
  return verde ? 0 : 1;
}

function parseArgs(argv) {
  const args = { json: false };
  for (const voce of argv) if (voce === "--json") args.json = true;
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mancanti = ["CLAUDE.md", README, "agenti"].filter((n) => !existsSync(join(REGIA, n)));
  if (mancanti.length > 0) {
    console.error(
      `${conBarre(REGIA)} non e' la radice della regia Web Gun (manca: ${mancanti.join(", ")}).\n` +
      "Un ROSSO da qui direbbe qualcosa su un repo che il gate non ha guardato: si lancia dalla radice, `node scripts/verifica-regia.mjs`.",
    );
    process.exit(2);
  }
  const ctx = {};
  for (const passo of PASSI) passo.esegui(ctx);
  process.exit(verdetto(args.json));
}

// `import.meta.main` NON si usa: e' arrivato in Node 24, e su Node 20 vale
// `undefined` — il corpo non gira, il processo esce 0 senza stampare niente, e
// chi legge il codice d'uscita crede di aver visto un verde. E' il difetto che
// il passo `epiloghi-vivi` di questo stesso gate cerca: se lo avesse in casa,
// sarebbe il primo a doverlo dichiarare.
// E il confronto e' doppio perche' una junction non e' il suo bersaglio:
// invocato da `.claude/skills/<skill>/...`, `resolve(argv[1])` restituisce il
// percorso della junction mentre `import.meta.url` e' gia' canonico — il
// confronto secco era falso e i cinque gate delle skill uscivano 0 muti
// (misurato il 2026-08-04, P.4-pre, `PILOTA-PRE-2026-08-04.md` §2b).
// A `scripts/` della regia nessuna junction punta, e quindi qui la forma non
// corregge niente: e' allineata perche' e' quella che l'`hint` di
// `epiloghi-vivi` prescrive due file piu' in la', e chi prescrive una forma la
// porta in casa. `realpathSync` scioglie la junction; se solleva si ricade sul
// confronto testuale: mai un errore che ammutolisce.
if (process.argv[1]) {
  const questoModulo = fileURLToPath(import.meta.url);
  const invocato = resolve(process.argv[1]);
  let invocatoReale = invocato;
  try { invocatoReale = realpathSync(invocato); } catch { /* percorso sparito: vale il testuale */ }
  if (invocato === questoModulo || invocatoReale === questoModulo) main();
}
