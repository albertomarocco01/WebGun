/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Guardia di attivazione del fix agentico. La feature lascia a un agente AI
 * modificare i file e usare git: deve girare SOLO nel daemon locale BugBay e
 * SOLO se esplicitamente abilitata via env (interruttore di sicurezza).
 *
 * NON si gatea più su `NODE_ENV !== 'production'`: dal v0.7 il daemon 24/7 gira
 * di proposito in `next start` (= production), e quel check lo spegnerebbe. Il
 * segnale strutturale di "daemon locale BugBay" è la presenza di
 * `BUGBAY_DAEMON_TOKEN` — il token per-repo che SOLO il CLI daemon genera e che
 * il middleware usa per l'auth (T1/T2). Un deploy hosted nudo non ce l'ha → la
 * feature resta disattiva lì. In sviluppo (`NODE_ENV !== 'production'`, es.
 * `npm run dev`) resta abilitata col solo flag, per non rompere il loop dev.
 *
 * @indice
 * - isAgentFixEnabled → true solo se daemon locale (token o dev) + flag abilitato
 * - assertEnabled     → lancia se non abilitato (per le route)
 */

export function isAgentFixEnabled(): boolean {
  if (process.env.ENABLE_AGENT_FIX !== '1') return false;
  // Production (`next start`): richiede il token del daemon locale. Dev: basta il flag.
  return !!process.env.BUGBAY_DAEMON_TOKEN || process.env.NODE_ENV !== 'production';
}

export function assertEnabled(): void {
  if (!isAgentFixEnabled()) {
    throw new Error(
      'Fix agentico disabilitato. Attivo solo in locale con ENABLE_AGENT_FIX=1 (es. in .env.local).',
    );
  }
}
