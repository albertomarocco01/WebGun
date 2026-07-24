/**
 * Shell del segmento /debugging: re-esporta layout + metadata del modulo BugBay.
 * Vincolo Next.js App Router (i file di route vivono nell'host), non un
 * accoppiamento: la logica sta tutta nel modulo.
 */
export { BugBayConsoleLayout as default, bugBayMetadata as metadata } from '@/modules/bugbay';
