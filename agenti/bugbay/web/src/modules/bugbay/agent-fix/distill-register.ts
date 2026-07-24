/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * BARILE DEGLI IMPORT POINT dei distiller (v0.8). QUESTO è l'unico file che i
 * track E e A modificano per agganciare i loro distiller al hook `onVerdict`:
 * né `distill.ts` (il call-site) né `hub.ts` vanno toccati.
 *
 * `distill.ts` importa questo barile a SOLO EFFETTO, così i distiller sono
 * registrati (via `registerDistiller`) prima del primo verdetto. Vuoto ⇒
 * `onVerdict` è un no-op sicuro.
 *
 * COME AGGIUNGERE UN DISTILLER (E / A):
 *   1. Crea il tuo modulo (es. `./distill-episodic` per E, `./distill-ace` per A)
 *      che chiama `registerDistiller('<nome>', fn)` al top-level.
 *   2. Aggiungi qui SOTTO una riga di import a solo effetto:
 *          import './distill-episodic';   // E
 *          import './distill-ace';        // A
 *   NON modificare `distill.ts` né `hub.ts`.
 */

// ── Registrazioni distiller (E, A, C) — aggiungere le import qui sotto ───────
import './distill-episodic'; // E — memoria episodica (casi ExpeRepair)
import './ace'; // A — distiller ACE: bullet semantici in .bugbay/knowledge/*.md
import './credit'; // C — credit-assignment: accredita utilità ai casi iniettati (F5)

export {};
