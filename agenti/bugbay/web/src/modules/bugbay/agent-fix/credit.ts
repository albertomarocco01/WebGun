/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * DISTILLER DI CREDIT-ASSIGNMENT (v1.0, fix concilio F5) — chiude l'anello mancante
 * dell'apprendimento: a ogni VERDETTO accredita l'UTILITÀ ai casi episodici che erano
 * stati iniettati in quella run. Registrato su `onVerdict` via `./distill-register`
 * (come E e A), quindi parte in automatico senza toccare il call-site (hub.addScore).
 *
 * Peso dell'accredito = fiducia della SORGENTE (finalmente USATA, non solo mostrata
 * nel KPI): HUMAN 1.0 > JUDGE 0.5 > IMPLICIT 0.25. Un verdetto positivo su una run
 * accredita `useful`, uno negativo `harmful` sui casi che le sono stati mostrati →
 * `memory-rank` ne tiene conto al recupero successivo (i casi che aiutano salgono,
 * quelli che precedono fallimenti scendono). NON scrive scores (nessun loop).
 *
 * @indice
 * - creditDistiller → Distiller registrato: accredita i casi iniettati nella run
 */

import { registerDistiller, type Distiller, type VerdictSource } from './distill';
import { creditRun } from './memory-feedback';
import { verdictPolarity } from './verdict-polarity';

/** Peso dell'accredito per fiducia della sorgente (design memo: HUMAN>JUDGE>IMPLICIT). */
const SOURCE_WEIGHT: Record<VerdictSource, number> = {
  HUMAN: 1.0,
  JUDGE: 0.5,
  IMPLICIT: 0.25,
};

const creditDistiller: Distiller = (runId, verdict) => {
  const polarity = verdictPolarity(verdict.verdict);
  if (!polarity) return; // verdetto intermedio/ignoto → nessun credito
  creditRun(runId, polarity, SOURCE_WEIGHT[verdict.source] ?? 0.25);
};

registerDistiller('credit', creditDistiller);
