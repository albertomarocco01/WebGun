import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Carica `.env.e2e.local` (chiave amministrativa, URL) dentro `process.env`.
 *
 * Perche' a mano invece di `dotenv`: servono sei righe e una dipendenza in meno.
 * Le variabili gia' presenti nell'ambiente NON vengono sovrascritte, cosi' un
 * `E2E_BASE_URL=... npx playwright test` ha sempre la precedenza sul file.
 *
 * Va importato sia dalla configurazione sia da `helpers/db.ts`: Playwright
 * rivaluta la configurazione dentro ogni worker, e un worker senza chiave
 * fallirebbe con "manca SUPABASE_SECRET_KEY" invece che con l'esito del flusso.
 */
export function caricaEnvE2E(radice: string = process.cwd()): void {
  for (const file of [".env.e2e.local", ".env.local"]) {
    const percorso = join(radice, file);
    if (!existsSync(percorso)) continue;
    for (const riga of readFileSync(percorso, "utf8").split(/\r?\n/)) {
      const trovato = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(riga);
      if (!trovato) continue;
      const [, nome, grezzo] = trovato;
      if (process.env[nome] !== undefined) continue;
      process.env[nome] = grezzo.trim().replace(/^["']|["']$/g, "");
    }
  }
}
