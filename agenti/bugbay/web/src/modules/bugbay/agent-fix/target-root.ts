/**
 * @descrizione
 * Radice del progetto da debuggare (l'host), disaccoppiata dal cwd del daemon.
 * Il daemon Next gira dalla cartella del pacchetto (web/), ma il motore
 * (scoping, git, tsc, edit, store, DB locale) deve operare sul repo DELL'UTENTE:
 * BUGBAY_TARGET_ROOT lo indica. Senza la env, fallback al cwd (uso legacy/in-host).
 */
import path from 'path';
import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';

// Override per-run della radice effettiva: una run autonoma gira in un git
// worktree isolato (bugbay/auto/<id>), quindi git/tsc/edit devono operare su
// QUELLA cartella, non sul working tree dell'utente. L'override viaggia via
// AsyncLocalStorage lungo tutta la catena async della run (default: nessun
// override → comportamento identico a prima).
const runRootStore = new AsyncLocalStorage<string>();

export function targetRoot(): string {
  const override = runRootStore.getStore();
  if (override) return override;
  const t = process.env.BUGBAY_TARGET_ROOT;
  return t ? path.resolve(t) : process.cwd();
}

/**
 * Esegue `fn` con `root` come radice effettiva (targetRoot()) per tutta la sua
 * catena async. Usato per confinare una run autonoma nel suo worktree isolato.
 */
export function withRunRoot<T>(root: string, fn: () => T): T {
  return runRootStore.run(path.resolve(root), fn);
}

/**
 * Cartella dei dati di runtime del daemon (run store, settings, registro PID).
 * Configurabile via BUGBAY_DATA_DIR: nel sandbox DEVE puntare FUORI dalla copia
 * sincronizzata del modulo (che lo script di sync rigenera/cancella a ogni
 * dev/build), altrimenti i dati andrebbero persi a ogni restart. Default: `.bugbay`
 * dentro il repo target. Fonte UNICA del path, condivisa da store e registro PID.
 */
export function bugbayDataDir(): string {
  const d = process.env.BUGBAY_DATA_DIR;
  if (d) return path.resolve(d);
  // Fallback SENZA l'override ALS: i dati di runtime (store/settings/registro PID)
  // sono CONDIVISI tra tutte le run — worktree inclusi — quindi sempre relativi al
  // target root reale (env), mai al worktree isolato della run corrente.
  const t = process.env.BUGBAY_TARGET_ROOT;
  return path.join(t ? path.resolve(t) : process.cwd(), '.bugbay');
}

/**
 * Cartella MACHINE-SCOPED della spina (`hub.sqlite`), condivisa da TUTTI i repo.
 * Invariante v0.6 (Wave 0): un solo `~/.bugbay/hub.sqlite` per macchina — NON
 * per-repo — così la transizione di fase di una run e il suo evento commitano
 * nella stessa transazione su un'unica autorità di stato. Diversa da
 * `bugbayDataDir()`, che resta per-repo (daemon-token, registro PID, settings).
 *
 * Override via `BUGBAY_HUB_DIR` (test/sandbox); default `os.homedir()/.bugbay`.
 * Il default vive già FUORI dalla copia sincronizzata del modulo, quindi non
 * viene azzerato dagli hot-reload/rebuild come `bugbayDataDir()` nel sandbox.
 */
export function bugbayHubDir(): string {
  const d = process.env.BUGBAY_HUB_DIR;
  if (d) return path.resolve(d);
  return path.join(os.homedir(), '.bugbay');
}

/** Percorso completo del file spina machine-scoped. */
export function hubDbPath(): string {
  return path.join(bugbayHubDir(), 'hub.sqlite');
}
