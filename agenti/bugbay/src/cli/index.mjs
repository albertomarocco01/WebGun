/**
 * Dispatcher della CLI `bugbay`. Parsing argomenti minimale (zero dipendenze),
 * sufficiente per `init` e `dev` con flag long-form (--flag / --flag=valore).
 */
import { readFileSync } from 'node:fs';
import { initCommand } from './init.mjs';
import { setupCommand } from './setup.mjs';
import { devCommand } from './dev.mjs';
import { startCommand } from './start.mjs';
import { installCommand, uninstallCommand } from './lifecycle.mjs';
import { watchdogCommand } from './watchdog.mjs';
import { wireCommand } from './wire.mjs';
import { updateCommand } from './update.mjs';
import { c, log } from './util.mjs';

// Versione reale dal package.json (niente stringa hardcoded che resta indietro).
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

export async function run(argv) {
  const { command, opts } = parse(argv);

  if (opts.version || command === 'version') return void log(`bugbay ${VERSION}`);
  if (!command || command === 'help' || opts.help) return void usage();

  switch (command) {
    case 'setup':
      return setupCommand(opts);
    case 'init':
      return initCommand(opts);
    case 'wire':
      return wireCommand();
    case 'dev':
      return devCommand(opts);
    case 'hub':
      // Console CENTRALE: un solo daemon che aggrega le segnalazioni di TUTTI i
      // progetti (db machine-scoped ~/.bugbay/reports, viste raggruppate per
      // project_id). Alias esplicito di `dev --hub` — nel modello a hub è QUESTO
      // l'unico processo bugbay da tenere vivo; i progetti montano solo il widget.
      return devCommand({ ...opts, hub: true });
    case 'start':
      return startCommand(opts);
    case 'install':
      return installCommand(opts);
    case 'uninstall':
      return uninstallCommand(opts);
    case 'watchdog':
      return watchdogCommand(opts);
    case 'update':
      return updateCommand();
    default:
      log(c.red(`Comando sconosciuto: ${command}`));
      usage();
      process.exitCode = 1;
  }
}

/** Parsing: primo token non-flag = comando; --k / --k=v / --k v = opzioni. */
function parse(argv) {
  let command = null;
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        opts[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          opts[key] = next;
          i++;
        } else {
          opts[key] = true;
        }
      }
    } else if (!command) {
      command = a;
    }
  }
  return { command, opts };
}

function usage() {
  log(`
${c.bold(c.magenta('BugBay'))} — debugging agentico in locale, agganciabile a qualsiasi webapp

${c.bold('Uso')}
  bugbay <comando> [opzioni]

${c.bold('Comandi')}
  ${c.cyan('setup')}   Installer "fa tutto": config + widget + storage + online + hub (guidato)
  ${c.cyan('init')}    Installa nel progetto: registra + aggancia il widget puntato all'hub
  ${c.cyan('wire')}    (Ri)aggancia il widget al layout (se init non l'ha fatto)
  ${c.cyan('hub')}     Console CENTRALE: aggrega le segnalazioni di TUTTI i progetti (= dev --hub)
  ${c.cyan('dev')}     Avvia un daemon per il SOLO progetto corrente (next dev, hot-reload)
  ${c.cyan('start')}   Avvia il daemon di PRODUZIONE (next build una volta → next start)
  ${c.cyan('install')} Registra il daemon 24/7 nel Task Scheduler (at-logon + watchdog 5min)
  ${c.cyan('uninstall')} Rimuove i task 24/7 dal Task Scheduler
  ${c.cyan('update')}  Aggiorna BugBay all'ultima versione (e riallinea il widget)
  ${c.cyan('help')}    Mostra questo aiuto

${c.bold('Opzioni')}
  --yes             (setup) Non interattivo: usa i default / le flag
  --storage <s>     (setup) local | supabase
  --supabase-url    (setup) URL del progetto Supabase
  --supabase-key    (setup) service_role key (scritta in .env.local)
  --online          (setup) Prepara anche l'ingestione dell'app deployata
  --anthropic-key   (setup) Chiave API Anthropic per la riformulazione AI
  --gemini-key      (setup) Chiave API Gemini (alternativa alla precedente)
  --hub             (dev/start/install) Governa i fix di più repo locali (vista hub)
  --dry-run         (init)  Mostra cosa farebbe senza scrivere nulla
  --force           (setup/init) Sovrascrive un bugbay.config.json esistente
  --port <n>        (dev/setup) Porta del daemon (default 7331)
  --root <path>     (start/install) Repo target del daemon (default: cwd)
  --healthchecks <url> (install) Heartbeat esterno opt-in (healthchecks.io) sul watchdog
  --version         Stampa la versione

${c.dim('Esempi')}
  ${c.dim('$')} npx bugbay setup
  ${c.dim('$')} npx bugbay setup --storage supabase --online
  ${c.dim('$')} npx bugbay dev --hub
`);
}
