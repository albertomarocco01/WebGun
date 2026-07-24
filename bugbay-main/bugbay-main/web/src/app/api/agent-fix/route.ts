/** Shell di route: re-esporta gli handler del fix agentico dal modulo BugBay. */
export { GET, POST } from '@/modules/bugbay/api/agent-fix';

// Config di segmento dichiarata inline: Next non riconosce i const re-esportati.
export const runtime = 'nodejs';
export const maxDuration = 600;
