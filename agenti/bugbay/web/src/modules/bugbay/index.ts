/**
 * BUG BAY — superficie pubblica del modulo.
 *
 * Modulo autoconsistente e portabile: console di triage, runner del fix
 * agentico, widget flottante di segnalazione, tipi e config. Le rotte
 * (`app/debugging`, `app/api/{agent-fix,debug-reports,debug-checklist}`) restano
 * nell'host come shell sottili che re-esportano da qui — vincolo di Next.js
 * App Router, non un accoppiamento.
 *
 * Unico punto di contatto con l'host: il root layout monta `<DebugWidget />`.
 * Storage: client Supabase self-contained in `lib/supabase-admin` (credenziali
 * dalle env). Per estrarre il modulo: copia questa cartella + ricrea gli shell.
 */
export { default as BugBayConsole } from './console/ConsolePage';
export { default as BugBayHubConsole } from './console/HubConsole';
export { default as BugBayConsoleLayout, metadata as bugBayMetadata } from './console/ConsoleLayout';
export { DebugWidget, DebugWidget as BugBayWidget } from './components/DebugWidget';

export * from './types';
export * from './config';
