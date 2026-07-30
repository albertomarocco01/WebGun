"use client";

import { useState } from "react";

/**
 * Il calcolatore di rata, scritto come lo scrive chi ha fretta: tutto il piano
 * di ammortamento di trenta possibili importi, calcolato **in modo sincrono
 * durante l'idratazione**, sul filo principale, prima che la pagina risponda a
 * un clic.
 *
 * E' il difetto che questo banco esiste per contenere: non e' un ciclo a vuoto
 * messo li' per far salire un numero, e' un conto vero fatto nel posto
 * sbagliato e nel momento sbagliato. Speed Demon deve trovarlo come TBT, e la
 * sua correzione — calcolare solo l'importo scelto, e solo quando serve — deve
 * produrre un guadagno misurabile.
 */
type Riga = { mese: number; quota: number; interessi: number; residuo: number };

function ammortamento(capitale: number, tassoAnnuo: number, anni: number): Riga[] {
  const i = tassoAnnuo / 12;
  const n = anni * 12;
  const rata = (capitale * i) / (1 - Math.pow(1 + i, -n));
  const piano: Riga[] = [];
  let residuo = capitale;
  for (let mese = 1; mese <= n; mese++) {
    const interessi = residuo * i;
    const quota = rata - interessi;
    residuo -= quota;
    piano.push({ mese, quota, interessi, residuo });
  }
  return piano;
}

const IMPORTI = Array.from({ length: 30 }, (_, k) => 80_000 + k * 10_000);

function tuttiIPiani() {
  const piani = new Map<number, Riga[]>();
  for (const importo of IMPORTI) {
    // trenta importi x quattro durate x trenta tassi: il conto e' banale, e'
    // la quantita' a essere assurda. Nessuno di questi piani viene mostrato.
    for (let anni = 10; anni <= 40; anni += 10) {
      for (let punti = 100; punti <= 400; punti += 10) {
        const piano = ammortamento(importo, punti / 10000, anni);
        if (anni === 30 && punti === 320) piani.set(importo, piano);
      }
    }
  }
  return piani;
}

export default function CalcolatoreRata() {
  const [piani] = useState(tuttiIPiani);
  const [importo, setImporto] = useState(200_000);
  const piano = piani.get(importo) ?? [];
  const rata = piano.length > 0 ? piano[0].quota + piano[0].interessi : 0;

  return (
    <section className="mt-10 rounded-lg border border-stone-300 p-6">
      <h2 className="text-xl font-semibold">Calcola la rata</h2>
      <label className="mt-4 block text-sm" htmlFor="importo">
        Importo del mutuo
      </label>
      <select
        id="importo"
        className="mt-1 rounded border border-stone-400 px-3 py-2"
        value={importo}
        onChange={(e) => setImporto(Number(e.target.value))}
      >
        {IMPORTI.map((v) => (
          <option key={v} value={v}>
            {v.toLocaleString("it-IT")} €
          </option>
        ))}
      </select>
      <p className="mt-4 text-lg">
        Rata mensile stimata: <strong>{rata.toFixed(2)} €</strong> — 30 anni al 3,20%
      </p>
    </section>
  );
}
