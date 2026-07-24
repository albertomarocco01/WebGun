/**
 * Schema e default di `bugbay.config.json` — il contratto che aggancia BugBay a
 * un'app qualsiasi. È JSON (non .ts) di proposito: il daemon lo legge a runtime
 * senza transpile, e funziona anche in progetti non-TypeScript o non-JS.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const CONFIG_FILENAME = 'bugbay.config.json';
export const DEFAULT_PORT = 7331;
export const STORAGE_DIR = '.bugbay';

/** Legge la porta dal bugbay.config.json del progetto (default 7331). */
export function readConfigPort(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILENAME), 'utf8'));
    return cfg.server?.port || DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

/**
 * Token per-daemon STABILE per progetto (escape-hatch per embedding del widget
 * genuinamente cross-site; il caso comune localhost passa via Fetch-Metadata).
 * Persistito in `<dataDir>/daemon-token` (gitignored con `.bugbay/`). Creato se
 * assente, riusato altrimenti — così snippet e daemon condividono lo stesso valore.
 */
export function readOrCreateToken(dataDir) {
  const file = path.join(dataDir, 'daemon-token');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch { /* assente → crea */ }
  const token = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, token, { mode: 0o600 }); // mode ignorato su Windows
  } catch { /* best-effort: se non scrivibile, il token resta valido per questa sessione */ }
  return token;
}

/**
 * Identità del progetto per il hub multi-progetto: un DB Supabase centrale può
 * raccogliere le segnalazioni di TUTTE le tue app, ciascuna taggata col proprio
 * project_id. L'id è STABILE: preso da `project.id` in bugbay.config.json se
 * presente, altrimenti derivato in modo deterministico dal path del repo (così un
 * install esistente ottiene comunque un id stabile senza modifiche alla config).
 */
export function projectIdForRepo(root) {
  const h = crypto.createHash('sha1').update(path.resolve(root)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** { id, name } del progetto: da config se presente, altrimenti derivato dal path. */
export function readProject(root) {
  const name = path.basename(path.resolve(root)) || 'progetto';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILENAME), 'utf8'));
    if (cfg.project?.id) return { id: String(cfg.project.id), name: cfg.project.name || name };
  } catch { /* config assente → derivo */ }
  return { id: projectIdForRepo(root), name };
}

/**
 * Impostazioni del loop AUTONOMO (F3), OFF di default. Quando `enabled`, un poller
 * prende in carico da solo le segnalazioni aperte e le fixa su un branch isolato
 * (bugbay/auto/<id>), senza mai toccare il working tree. `pollSeconds` è l'intervallo
 * di scansione. Restano dietro flag: nessuna autonomia senza opt-in esplicito.
 */
export function readAutonomy(root) {
  const dflt = { enabled: false, pollSeconds: 60, gate: { test: false, build: false }, notify: { webhook: '' } };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILENAME), 'utf8'));
    const a = cfg.agent?.autonomy;
    if (a && typeof a === 'object') {
      return {
        enabled: a.enabled === true,
        pollSeconds: Number.isFinite(a.pollSeconds) && a.pollSeconds > 0 ? a.pollSeconds : dflt.pollSeconds,
        // Gate+ opzionali (test/build) prima del commit autonomo; default OFF.
        gate: {
          test: a.gate?.test === true,
          build: a.gate?.build === true,
        },
        // Webhook di notifica di fine run (Slack/Discord/Mattermost); vuoto = off.
        notify: { webhook: typeof a.notify?.webhook === 'string' ? a.notify.webhook : '' },
      };
    }
  } catch { /* config assente → default OFF */ }
  return dflt;
}

/** Perimetro di scrittura dell'agente dal bugbay.config.json (con default). */
export function readAgentGuards(root) {
  const dflt = {
    writeScope: ['src/**'],
    sensitiveFiles: ['**/auth/**', '**/middleware.*', '**/.env*', '**/*.config.*'],
  };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILENAME), 'utf8'));
    return {
      writeScope: Array.isArray(cfg.agent?.writeScope) ? cfg.agent.writeScope : dflt.writeScope,
      sensitiveFiles: Array.isArray(cfg.agent?.sensitiveFiles) ? cfg.agent.sensitiveFiles : dflt.sensitiveFiles,
    };
  } catch {
    return dflt;
  }
}

/** Costruisce la config di default a partire dal rilevamento del progetto. */
export function buildDefaultConfig(inspect, root) {
  const projRoot = root || process.cwd();
  return {
    // Versione dello schema: permette migrazioni future della config.
    version: 1,
    framework: inspect.framework,
    packageManager: inspect.packageManager,
    // Identità del progetto nel hub multi-progetto (id stabile, derivato dal path).
    project: {
      id: projectIdForRepo(projRoot),
      name: path.basename(path.resolve(projRoot)) || 'progetto',
    },
    app: {
      // root dell'app relativa a questo file (nei monorepo es. "apps/web").
      root: '.',
      srcDir: inspect.layout.srcDir,
      routes: inspect.layout.routes,
    },
    server: {
      // Modello "hub centrale": UN daemon sulla porta di default governa tutte le
      // app registrate (il widget passa ?p=<projectId>). Override manuale possibile.
      port: DEFAULT_PORT,
    },
    storage: {
      // 'local' = SQLite/JSON nel repo; 'supabase' = backend remoto (più avanti).
      driver: 'local',
      dir: STORAGE_DIR,
    },
    domain: {
      // Tassonomia generica e sovrascrivibile (niente più aree cablate a un progetto).
      areas: {
        Generale: ['Errore generico', 'Problema di layout', 'Navigazione', 'Autenticazione'],
      },
      categories: ['Bug', 'Miglioria', 'Nuova Feature'],
      priorities: ['Bassa', 'Media', 'Alta', 'Urgente', 'Critica'],
    },
    agent: {
      // Provider del fix: 'claude-headless' (CLI locale), 'gemini', 'deepseek', 'anthropic'.
      provider: 'claude-headless',
      // File che l'agente non tocca senza conferma esplicita (allow-list di sicurezza).
      sensitiveFiles: ['**/auth/**', '**/middleware.*', '**/.env*', '**/*.config.*'],
      // Confinamento delle scritture: l'agente edita solo qui dentro.
      writeScope: [`${inspect.layout.srcDir}/**`],
      // Loop autonomo (F3): OFF di default. Se true, il daemon prende in carico da
      // solo le segnalazioni aperte e le fixa su branch isolati (bugbay/auto/<id>).
      autonomy: {
        enabled: false,
        pollSeconds: 60,
        // Gate+ opzionali eseguiti nel worktree prima del commit autonomo (opt-in).
        gate: { test: false, build: false },
        // Notifica di fine run: URL webhook (Slack/Discord/Mattermost). Vuoto = off.
        notify: { webhook: '' },
      },
    },
  };
}
