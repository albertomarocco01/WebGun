#!/usr/bin/env node
/**
 * genera-foto.mjs — le fotografie pesanti del banco.
 *
 * PERCHE' ESISTE. Questo banco serve a collaudare Speed Demon, e Speed Demon su
 * `banco-prova-negozio` non aveva niente da ottimizzare: due pagine di testo,
 * 100/100 in partenza. Un agente che ottimizza va provato su qualcosa di lento,
 * e la prima causa di lentezza di un sito immobiliare vero sono le foto messe
 * online come sono uscite dalla macchina.
 *
 * PERCHE' RUMORE. I pixel sono casuali con un seme fisso, non un'immagine vera:
 * il rumore non si comprime, quindi il peso e' garantito e non dipende dal
 * soggetto. Un seme fisso rende i byte identici su due macchine, e una misura
 * fatta su file diversi non e' confrontabile con la precedente.
 *
 * PERCHE' PNG SCRITTO A MANO. Nessuna dipendenza: un generatore di banco che si
 * porta dietro `sharp` aggiunge alla catena di build del banco un binario
 * nativo, per fare una cosa che sta in quaranta righe di `zlib`.
 *
 * USO: node scripts/genera-foto.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), "public", "foto");

// CRC32, tabella compresa: il PNG lo pretende in coda a ogni chunk.
const TABELLA = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABELLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (tipo, dati) => {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, crc]);
};

/** Generatore congruenziale lineare: deterministico, e qui basta e avanza. */
function rumore(seme) {
  let s = seme >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 24) & 0xff;
  };
}

function png(larghezza, altezza, seme) {
  const prossimo = rumore(seme);
  // Ogni riga: un byte di filtro (0 = nessuno) piu' larghezza*3 byte RGB.
  const righe = Buffer.alloc(altezza * (1 + larghezza * 3));
  let i = 0;
  for (let y = 0; y < altezza; y++) {
    righe[i++] = 0;
    for (let x = 0; x < larghezza * 3; x++) righe[i++] = prossimo();
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8; // bit per campione
  ihdr[9] = 2; // colore vero, senza canale alfa
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    // livello 0: non si tenta nemmeno di comprimere il rumore, e cosi' la
    // generazione dura secondi invece di minuti.
    chunk("IDAT", deflateSync(righe, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FOTO = [
  { nome: "cascina-langa.png", larghezza: 1800, altezza: 1200, seme: 1 },
  { nome: "borgo-alto.png", larghezza: 1600, altezza: 1100, seme: 2 },
  { nome: "casa-vigna.png", larghezza: 1600, altezza: 1100, seme: 3 },
  { nome: "rustico-noce.png", larghezza: 1600, altezza: 1100, seme: 4 },
];

mkdirSync(DIR, { recursive: true });
let totale = 0;
for (const f of FOTO) {
  const dati = png(f.larghezza, f.altezza, f.seme);
  writeFileSync(join(DIR, f.nome), dati);
  totale += dati.length;
  console.log(`${f.nome.padEnd(22)} ${f.larghezza}x${f.altezza}  ${(dati.length / 1024 / 1024).toFixed(2)} MB`);
}
console.log(`\n${FOTO.length} foto · ${(totale / 1024 / 1024).toFixed(2)} MB in public/foto/`);
