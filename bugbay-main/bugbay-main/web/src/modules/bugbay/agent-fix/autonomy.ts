/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Stato del loop autonomo (F3), letto dall'env impostato da `bugbay dev`. OFF di
 * default: l'autonomia esiste solo con opt-in esplicito (agent.autonomy.enabled in
 * bugbay.config.json). Questo modulo espone solo la LETTURA del flag e l'intervallo
 * di poll; il poller WATCH e l'esecuzione isolata in worktree vivono in runner.ts
 * (`startWatchLoop`/`watchTick` → `runAutonomous`, che consumano createWorktree/
 * withRunRoot). Questi getter alimentano quel loop e l'endpoint health.
 *
 * @indice
 * - autonomyEnabled  → true se il loop autonomo è attivo (default false)
 * - autonomyPollMs   → intervallo di scansione in ms (default 60s)
 * - autonomyGate     → gate+ opzionali (test/build) prima del commit autonomo
 * - notifyWebhook    → URL webhook di notifica fine run (vuoto = disattivato)
 */

/** true se il loop autonomo è attivo (flag esplicito, default OFF). */
export function autonomyEnabled(): boolean {
  return process.env.BUGBAY_AUTONOMY_ENABLED === '1';
}

/** Intervallo di scansione delle segnalazioni aperte, in ms (default 60s). */
export function autonomyPollMs(): number {
  const s = Number(process.env.BUGBAY_AUTONOMY_POLL);
  return Number.isFinite(s) && s > 0 ? s * 1000 : 60_000;
}

/** Gate+ opzionali eseguiti nel worktree prima del commit autonomo (default OFF). */
export function autonomyGate(): { test: boolean; build: boolean } {
  return {
    test: process.env.BUGBAY_AUTONOMY_GATE_TEST === '1',
    build: process.env.BUGBAY_AUTONOMY_GATE_BUILD === '1',
  };
}

/** URL del webhook di notifica (Slack/Discord/Mattermost); vuoto/assente = disattivato. */
export function notifyWebhook(): string | undefined {
  const u = process.env.BUGBAY_NOTIFY_WEBHOOK?.trim();
  return u || undefined;
}

/** Stato completo dell'autonomia per l'endpoint health (observability F4). */
export function autonomyState(): {
  enabled: boolean;
  pollSeconds: number;
  gate: { test: boolean; build: boolean };
  notifyConfigured: boolean;
} {
  return {
    enabled: autonomyEnabled(),
    pollSeconds: Math.round(autonomyPollMs() / 1000),
    gate: autonomyGate(),
    notifyConfigured: Boolean(notifyWebhook()),
  };
}
