/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Client di accesso ai dati di BUG BAY. In produzione (o quando le env Supabase
 * sono configurate) restituisce un client Supabase service-role (bypassa RLS).
 * Per lo SVILUPPO LOCALE, quando le credenziali Supabase mancano — oppure
 * BUGBAY_LOCAL_DB=1 — restituisce un client locale Supabase-compatibile
 * (SQLite, con fallback JSON) così il modulo gira offline senza un backend
 * remoto. Self-contained: nessuna dipendenza dalla config dell'host.
 * Non importare mai questo modulo in componenti client.
 *
 * @indice
 * - createAdminClient → factory: client Supabase service-role o client locale di dev
 */

import { createClient } from '@supabase/supabase-js';
import { createLocalClient } from './local-db';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // DB locale di sviluppo: forzato esplicitamente, oppure usato come default
  // quando Supabase non è configurato fuori produzione. In produzione, env
  // mancanti restano un errore esplicito (niente fallback silenzioso).
  const forceLocal = process.env.BUGBAY_LOCAL_DB === '1';
  if (forceLocal || !url || !serviceRoleKey) {
    if (!forceLocal && process.env.NODE_ENV === 'production') {
      throw new Error(
        '[bugbay] Variabili d\'ambiente mancanti in produzione: NEXT_PUBLIC_SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY',
      );
    }
    return createLocalClient();
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
