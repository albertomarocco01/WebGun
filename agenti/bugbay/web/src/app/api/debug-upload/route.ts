/** Shell di route: re-esporta l'endpoint di upload allegati dal modulo BugBay. */
export { POST } from '@/modules/bugbay/api/debug-upload';

// Config di segmento dichiarata inline (Next non riconosce i const re-esportati).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
