/**
 * frammento.test.mjs — il rimedio che questa skill SCRIVE nel progetto altrui.
 *
 * Perche' un file di test a parte, e perche' con il compilatore vero.
 *
 * `generateBuildId` e' l'unica riga di codice di un altro agente che launchpad
 * tocca, e la tocca in un file che il progetto **costruisce**. Un rimedio che
 * rompe chi lo applica e' peggio di qualunque falso verde: il tribunale del
 * 2026-08-06 l'aveva gia' misurato una volta (rilievo IO-1, `require` in un
 * `.mjs`) e la correzione era stata verificata su un `.mjs` — cioe' sull'unica
 * delle tre forme che **non e' tipizzata**.
 *
 * Il collaudo del 2026-08-06 ha misurato il fratello rimasto scoperto: sotto
 * `strict` (lo stack standard del `CLAUDE.md`, e il default di
 * `create-next-app`) il binding di `catch` ha tipo `unknown`, quindi
 * `e.message` NON COMPILA. `next build` di un progetto Web Gun vero moriva con
 *
 *     ./next.config.ts:29:69
 *     Type error: Property 'message' does not exist on type '{}'.
 *
 * Un test che guardasse il testo del frammento con un regex avrebbe provato la
 * forma e non la proprieta'. Qui il frammento passa dal **compilatore vero**,
 * nella forma che `conFrammento()` produce davvero — e c'e' un controllo
 * negativo: la stesura pre-correzione **deve** essere rifiutata, altrimenti
 * questo test non ha denti.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { eSoloFrammentoImpronta } from "./gate-lib.mjs";
import { conFrammento, FRAMMENTO } from "./impronta.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));

/** Il `next.config.ts` che vetrina-crafter lascia in un progetto Web Gun. */
const BASE_TS = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;

/**
 * Il tipo `NextConfig` in una riga: cosi' il test non ha bisogno che `next` sia
 * installato nella cartella della skill, e la forma del file resta quella vera
 * (l'`import type` c'e', ed e' la riga sopra la quale il frammento si inserisce).
 */
const SHIM = `declare module "next" {
  export type NextConfig = {
    generateBuildId?: () => string | Promise<string>;
    reactStrictMode?: boolean;
  };
}
`;

/** Errori di TIPO del sorgente dato, compilato come lo compila `next build`. */
function erroriTypeScript(sorgenteTs) {
  const dir = mkdtempSync(join(tmpdir(), "launchpad-frammento-"));
  try {
    const config = join(dir, "next.config.ts");
    const shim = join(dir, "shim.d.ts");
    writeFileSync(config, sorgenteTs, "utf8");
    writeFileSync(shim, SHIM, "utf8");
    const programma = ts.createProgram([config, shim], {
      // `strict` e' il punto di tutto il test: senza, il binding di `catch` e'
      // `any` e il difetto non si vede. E' l'impostazione che
      // `create-next-app` scrive e che il `CLAUDE.md` prescrive.
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
      types: ["node"],
      typeRoots: [join(QUI, "..", "node_modules", "@types")],
    });
    return ts.getPreEmitDiagnostics(programma)
      .filter((d) => d.file && d.file.fileName.endsWith("next.config.ts"))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("il frammento scritto in un `next.config.ts` COMPILA sotto `strict`", () => {
  const esito = conFrammento(BASE_TS, { esm: true });
  assert.equal(esito.cambiato, true, "il frammento non e' stato inserito: il test non prova niente");
  const errori = erroriTypeScript(esito.testo);
  assert.deepEqual(errori, [],
    "il rimedio che questa skill scrive nel progetto altrui deve compilare: `next build` type-checka `next.config.ts`");
});

/**
 * IL CONTROLLO NEGATIVO. Senza, questo test passerebbe anche se domani
 * qualcuno rimettesse la stesura vecchia e il compilatore smettesse di essere
 * `strict` per un'altra ragione.
 */
test("la stesura PRE-correzione viene rifiutata dal compilatore (il difetto misurato)", () => {
  const esito = conFrammento(BASE_TS, { esm: true });
  const vecchia = esito.testo.replace(
    /const motivo = e instanceof Error \? e\.message : String\(e\);\n(\s*)throw new Error\(\n\s*"impronta: `git rev-parse HEAD` non eseguibile \(" \+ motivo \+/,
    'throw new Error(\n$1  "impronta: `git rev-parse HEAD` non eseguibile (" + (e && e.message ? e.message : e) +',
  );
  assert.notEqual(vecchia, esito.testo, "la sostituzione non ha agganciato niente: il controllo negativo non prova niente");
  const errori = erroriTypeScript(vecchia);
  assert.ok(errori.length > 0, "il compilatore deve rifiutare l'accesso a una proprieta' del binding di `catch`");
  assert.ok(errori.some((e) => /message/.test(e)), `atteso un errore su \`message\`, ricevuto: ${errori.join(" | ")}`);
});

/**
 * Nessun accesso a proprieta' del binding di `catch` senza averlo ristretto.
 *
 * La regola generale dietro il difetto, controllata sul testo del frammento:
 * il compilatore prova QUESTA stesura, questo controllo protegge le prossime.
 */
test("il frammento non legge nessuna proprieta' del binding di `catch` senza restringerlo", () => {
  // I commenti si tolgono: il frammento SPIEGA il difetto citandolo, e una
  // regola che legge la propria spiegazione accusa il testo che la documenta.
  // E' lo stesso errore che il tribunale ha misurato su `references/segreti.md`
  // (rilievo SEG-5), qui in miniatura.
  const codice = FRAMMENTO.split("\n").filter((r) => !/^\s*\/\//.test(r)).join("\n");
  const catture = [...codice.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map((m) => m[1]);
  assert.ok(catture.length > 0, "il frammento deve avere un `catch`: e' li' che dichiara perche' non sa il commit");
  for (const nome of catture) {
    const senzaGuardia = new RegExp(`(?<!instanceof Error \\? )\\b${nome}\\s*\\.[A-Za-z_$]`, "g");
    const usi = [...codice.matchAll(senzaGuardia)].map((m) => m[0]);
    assert.deepEqual(usi, [],
      `sotto \`strict\` \`${nome}\` ha tipo \`unknown\`: leggerne una proprieta' non compila`);
  }
});

/**
 * La forma CJS resta senza `import` — la meta' del rilievo IO-1 gia' chiusa,
 * qui bloccata da un test invece che da un ricordo.
 */
test("la forma CJS non porta `import` e risolve `execSync` con `require`", () => {
  const BASE_CJS = "const nextConfig = {\n  reactStrictMode: true,\n};\n\nmodule.exports = nextConfig;\n";
  const esito = conFrammento(BASE_CJS, { esm: false });
  assert.equal(esito.cambiato, true);
  assert.ok(!/^import\s/m.test(esito.testo), "un `import` in un file CommonJS e' un errore di sintassi");
  assert.match(esito.testo, /require\("node:child_process"\)\.execSync\(/);
});

/**
 * La forma ESM porta l'`import` e NON porta `require`: e' il rilievo IO-1
 * misurato dal tribunale su una build Next.js 16.3.0 vera.
 */
test("la forma ESM porta `import` e non nomina mai `require`", () => {
  const esito = conFrammento(BASE_TS, { esm: true });
  assert.match(esito.testo, /^import \{ execSync \} from "node:child_process";$/m);
  assert.ok(!/\brequire\(/.test(esito.testo), "`require` non esiste in un modulo ESM: e' il difetto IO-1");
});

/**
 * L'ESENZIONE DI FRESCHEZZA, misurata sul diff vero e non dedotta dall'autore.
 *
 * Il collaudo del 2026-08-06 ha misurato un rosso strutturale: il flusso di
 * questa skill scrive `generateBuildId` (passo 5) DOPO che gli agenti a monte
 * hanno depositato i loro handoff, quindi quel commit e' il piu' recente che
 * tocca il codice spedito e fa scadere **tutti** i certificati a monte. Su un
 * banco corretto in tutto il resto: quattro `block` su quattro handoff, e
 * nessuno dei quattro agenti poteva farci niente.
 *
 * L'esenzione vale per il frammento e per niente altro: se in quel commit
 * entra una riga in piu', la freschezza torna a scattare.
 */
function righeAggiunte(prima, dopo) {
  const a = prima.split("\n");
  const b = dopo.split("\n");
  let i = 0;
  const agg = [];
  for (const riga of b) {
    if (i < a.length && a[i] === riga) { i++; continue; }
    agg.push(riga);
  }
  return agg;
}

test("il commit che porta SOLO il frammento non fa scadere i certificati a monte", () => {
  const esito = conFrammento(BASE_TS, { esm: true });
  const aggiunte = righeAggiunte(BASE_TS, esito.testo);
  assert.ok(aggiunte.some((r) => /generateBuildId/.test(r)), "il diff simulato non contiene il rimedio: il test non prova niente");
  assert.equal(eSoloFrammentoImpronta(aggiunte, FRAMMENTO), true);
});

test("una riga in piu' nello stesso commit e la freschezza torna a scattare", () => {
  const esito = conFrammento(BASE_TS, { esm: true });
  const aggiunte = [...righeAggiunte(BASE_TS, esito.testo), "  poweredByHeader: false,"];
  assert.equal(eSoloFrammentoImpronta(aggiunte, FRAMMENTO), false,
    "l'esenzione non deve coprire una modifica che qualcun altro ha infilato nello stesso commit");
});

test("un commit su next.config senza il frammento non e' esente", () => {
  assert.equal(eSoloFrammentoImpronta(["  reactStrictMode: false,"], FRAMMENTO), false);
  assert.equal(eSoloFrammentoImpronta([], FRAMMENTO), false, "un diff vuoto non e' il rimedio: e' un diff vuoto");
});
