#!/usr/bin/env node
/**
 * Entry point eseguibile della CLI `bugbay`. Sottile di proposito: delega tutta
 * la logica a src/cli/index.mjs così il bin resta uno shim stabile.
 */
import { run } from '../src/cli/index.mjs';

run(process.argv.slice(2)).catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
