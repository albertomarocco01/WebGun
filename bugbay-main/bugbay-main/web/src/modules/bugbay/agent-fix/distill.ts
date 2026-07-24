/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * HOOK DI DISTILLAZIONE (v0.8) — punto di innesco UNICO che, a ogni VERDETTO,
 * dispaccia i distiller registrati (E = memoria episodica, A = bullet ACE). Il
 * distiller trasforma la run appena verdettata in memoria riusabile.
 *
 * CONTRATTO DI FAN-OUT (perché E e A non tocchino né questo call-site né hub.ts):
 *  - `onVerdict(runId, verdict)` è chiamato in UN SOLO punto: `addScore()` in
 *    hub.ts — il collo di bottiglia più stretto dove QUALSIASI verdetto/score
 *    (HUMAN approve/merge/"Risolto", IMPLICIT, JUDGE) viene registrato. Così lo
 *    steward lo cabla una volta e i track non lo replicano.
 *  - E e A registrano i loro distiller da MODULI PROPRI via `registerDistiller`.
 *    I moduli sono agganciati dal barile `./distill-register` (l'UNICO import
 *    point che E e A modificano). Nessuno tocca questo file.
 *  - FIRE-AND-FORGET & NON-THROWING: ogni distiller gira in `setImmediate`
 *    (dopo il commit della transazione del verdetto) e ogni errore è inghiottito.
 *    La distillazione NON deve MAI rompere la scrittura del verdetto sulla spina.
 *  - I distiller FILTRANO: `onVerdict` scatta per OGNI score; sta al distiller
 *    decidere se un dato (source, verdict) merita un caso/bullet.
 *
 * @indice
 * - VerdictSource / VerdictContext → forma del verdetto passato ai distiller
 * - Distiller                      → firma di un distiller (E/A la implementano)
 * - registerDistiller              → registrazione idempotente (E, A)
 * - onVerdict                      → innesco UNICO (chiamato solo da hub.addScore)
 */

// Barile degli import point: E e A vi aggiungono la registrazione dei loro
// distiller. Import a SOLO EFFETTO — caricato quando distill.ts è caricato
// (cioè quando hub.ts importa `onVerdict`), così i distiller sono registrati
// prima del primo verdetto. Vuoto all'inizio: nessun distiller, `onVerdict` no-op.
import './distill-register';

export type VerdictSource = 'HUMAN' | 'JUDGE' | 'IMPLICIT';

export interface VerdictContext {
  source: VerdictSource;
  /** Esito del verdetto (es. 'approved'|'merged'|'discarded'|'pass'|'fail'). */
  verdict: string;
  reportId?: string | null;
  detail?: string | null;
}

export type Distiller = (runId: string, verdict: VerdictContext) => void | Promise<void>;

// Registro su `globalThis`: gli hot-reload del dev server ri-valutano il modulo;
// una Map di modulo perderebbe/duplicherebbe le registrazioni. La chiave (nome)
// rende `registerDistiller` idempotente attraverso i reload.
// NB: il riferimento a `globalThis` è letto DENTRO la funzione, non in un const di
// modulo. Con un const di modulo, l'`import './distill-register'` in cima (che a
// module-eval registra i distiller E/A/credito) chiamerebbe `registry()` PRIMA che
// il const sia inizializzato → TDZ ("Cannot access before initialization") una
// volta che webpack bundla il ciclo. Leggendolo qui il ciclo diventa innocuo.
function registry(): Map<string, Distiller> {
  const g = globalThis as unknown as { __bugbay_distillers__?: Map<string, Distiller> };
  if (!g.__bugbay_distillers__) g.__bugbay_distillers__ = new Map();
  return g.__bugbay_distillers__;
}

/**
 * Registra (o rimpiazza, per lo stesso `name`) un distiller. Idempotente: ri-
 * registrare con lo stesso nome dopo un hot-reload aggiorna, non duplica.
 * Chiamata da E e A dai propri moduli, agganciati via `./distill-register`.
 */
export function registerDistiller(name: string, fn: Distiller): void {
  registry().set(name, fn);
}

/**
 * INNESCO UNICO. Chiamato SOLO da `hub.addScore` dopo aver scritto uno score.
 * Dispaccia ogni distiller registrato in `setImmediate` (post-commit) con ogni
 * errore inghiottito: non blocca né rompe MAI il chiamante (la scrittura del
 * verdetto). I distiller filtrano da soli su `verdict.source`/`verdict.verdict`.
 */
export function onVerdict(runId: string, verdict: VerdictContext): void {
  const distillers = registry();
  if (distillers.size === 0) return;
  for (const [, fn] of distillers) {
    setImmediate(() => {
      try {
        void Promise.resolve(fn(runId, verdict)).catch(() => {
          /* distillazione best-effort: mai propagare */
        });
      } catch {
        /* distillazione best-effort: mai propagare */
      }
    });
  }
}
