/**
 * banco.test.mjs — l'elenco che `banco.mjs` STAMPA e' un contratto.
 *
 * PERCHE' QUESTO FILE ESISTE. Il 2026-08-07 la direzione ha rigenerato il banco
 * da zero seguendo **soltanto** l'elenco che `banco.mjs` stampa, che e'
 * esattamente cio' che l'elenco chiede di fare, e `npm run build` e' caduta con
 * exit 1 e `Error: supabaseUrl is required.` sul prerender di `/prenota`. Le due
 * `NEXT_PUBLIC_*` che servono erano scritte in `docs/deploy.md` e in
 * `.env.example` — due file che il banco produce e che chi segue l'elenco non ha
 * ancora aperto. Una premessa vera, scritta dove nessuno la legge, e' una
 * premessa non dichiarata.
 *
 * La correzione e' una riga stampata; senza un test, e' una riga che il
 * prossimo riordino dell'output porta via senza che nessuno se ne accorga —
 * fino al prossimo che rigenera il banco e ci perde mezz'ora.
 *
 * PERCHE' SI LANCIA LO SCRIPT VERO invece di leggerne il sorgente con un regex.
 * Un test che cerca `NEXT_PUBLIC_SUPABASE_URL` dentro `banco.mjs` sarebbe verde
 * anche se il nome vivesse solo in un commento, o in un ramo di codice che non
 * si esegue mai. Quello che deve reggere e' **cio' che l'utente legge sul
 * terminale**, quindi il test esegue `node banco.mjs` in una cartella
 * temporanea e guarda il suo `stdout`. Costa un `git init` e qualche decina di
 * file scritti su disco: e' il prezzo di provare la cosa vera.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const BANCO = join(QUI, "banco.mjs");

/**
 * Costruisce un banco in una cartella temporanea e torna cio' che lo script ha
 * stampato. La cartella la cancella chi chiama, nel `finally`: qui non si
 * nasconde la pulizia dentro il produttore, perche' un test che fallisce deve
 * poter lasciare la cartella in piedi se serve guardarla.
 */
function costruisciBanco(radice) {
  const dove = join(radice, "banco-lp");
  return execFileSync(process.execPath, [BANCO, "--dove", dove, "--porta", "3199"], {
    encoding: "utf8",
    // Il remoto nudo che `banco.mjs` crea finisce in `<dove>/..`, cioe' dentro
    // `radice`: tutto quello che questo test tocca sta sotto una sola cartella.
    cwd: radice,
  });
}

function conBancoTemporaneo(fn) {
  const radice = mkdtempSync(join(tmpdir(), "launchpad-banco-"));
  try {
    fn(radice);
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
}

test("l'elenco stampato nomina le due NEXT_PUBLIC_* che la build pretende", () => {
  conBancoTemporaneo((radice) => {
    const uscita = costruisciBanco(radice);

    // I due nomi sono scritti a mano QUI, e non importati da `banco.mjs`: un
    // test che li leggesse dalla stessa costante che stampa non potrebbe mai
    // accorgersi che la costante e' cambiata. Chi rinomina una variabile
    // d'ambiente di Supabase rompe questo test, ed e' giusto cosi'.
    assert.match(uscita, /NEXT_PUBLIC_SUPABASE_URL/,
      "l'elenco stampato non nomina NEXT_PUBLIC_SUPABASE_URL: chi lo segue alla lettera vedra' `Error: supabaseUrl is required.` al passo della build");
    assert.match(uscita, /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
      "l'elenco stampato non nomina NEXT_PUBLIC_SUPABASE_ANON_KEY: chi lo segue alla lettera vedra' la build cadere al prerender di /prenota");
  });
});

test("la premessa sta PRIMA del passo che ci casca, non dopo", () => {
  conBancoTemporaneo((radice) => {
    const uscita = costruisciBanco(radice);

    // L'ancora e' la RIGA DEL PASSO 3, non la prima occorrenza di `npm run
    // build`: la premessa stessa nomina quel comando mentre spiega perche' cade,
    // e un `indexOf` nudo confronterebbe la premessa con se stessa. (Preso da
    // questo test alla sua prima esecuzione, il 2026-08-07.)
    const passo3 = uscita.match(/^ {2}3\. {2}npm run build/m);
    const premessa = uscita.indexOf("NEXT_PUBLIC_SUPABASE_URL");
    assert.ok(premessa >= 0, "la premessa non e' stampata affatto");
    assert.ok(passo3, "il passo 3 non e' piu' la riga `  3.  npm run build`: questo test guarda un elenco che non esiste piu', e va riscritto prima di fidarsene");
    assert.ok(premessa < passo3.index,
      `la premessa e' stampata DOPO il passo 3 (premessa a ${premessa}, passo 3 a ${passo3.index}): chi legge dall'alto in basso ha gia' lanciato la build quando la trova`);
  });
});

test("i valori d'esempio sono dichiaratamente finti, e la falsita' e' scritta accanto", () => {
  conBancoTemporaneo((radice) => {
    const uscita = costruisciBanco(radice);

    // `.invalid` e' il dominio riservato di RFC 2606: non risolve per
    // costruzione. Un valore d'esempio che ASSOMIGLIA a un progetto Supabase
    // vero (`https://abcdefgh.supabase.co`) sarebbe la cosa peggiore da
    // stampare: chi lo copia non sa di aver copiato un segnaposto.
    assert.match(uscita, /\.invalid/,
      "il valore d'esempio non usa un dominio che non risolve: un esempio che sembra vero verra' preso per vero");
    assert.match(uscita, /FINTI|finti/,
      "da nessuna parte l'elenco dice che i valori sono finti");
  });
});

test("nessun `.env.local` compare nel progetto senza che nessuno l'abbia scritto", () => {
  conBancoTemporaneo((radice) => {
    costruisciBanco(radice);
    const dove = join(radice, "banco-lp");

    // La tentazione alternativa era scriverlo: una riga di codice in meno, e un
    // file di configurazione comparso in silenzio nel progetto di qualcun
    // altro. E' la classe di difetto che questa skill misura negli altri, e il
    // banco non la commette in casa.
    for (const nome of [".env.local", ".env", ".env.production"]) {
      assert.equal(existsSync(join(dove, nome)), false,
        `banco.mjs ha scritto ${nome} senza dirlo: un file di configurazione inventato in silenzio e' la classe di difetto che questa skill misura negli altri`);
    }
    // `.env.example` invece c'e', ed e' un'altra cosa: nomi senza valori.
    assert.equal(existsSync(join(dove, ".env.example")), true,
      ".env.example non c'e' piu': e' il file che dichiara i NOMI delle variabili, e il gate `ambiente` lo legge");
  });
});

test("il banco non lascia niente fuori dalla cartella che gli si e' indicata", () => {
  conBancoTemporaneo((radice) => {
    costruisciBanco(radice);

    // Il remoto nudo e' un effetto collaterale dichiarato (`<dove>/..`), e resta
    // dentro la radice temporanea. Se un giorno finisse nella cartella corrente
    // di chi lancia, questo test lo direbbe.
    const dentro = readdirSync(radice).sort();
    assert.deepEqual(dentro, ["banco-launchpad-remoto.git", "banco-lp"],
      `il banco ha scritto in ${radice} qualcosa che non e' ne' il progetto ne' il suo remoto locale: ${dentro.join(", ")}`);
  });
});
