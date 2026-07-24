/**
 * Shell del segmento /hub: riusa il layout del modulo BugBay (scope `.bugbay` +
 * font dedicati), con il titolo tab della console-hub. La logica sta nel modulo.
 */
import type { Metadata } from 'next';

export { BugBayConsoleLayout as default } from '@/modules/bugbay';

export const metadata: Metadata = {
  title: 'BUG BAY — Hub',
  description: 'Run observability — events & traces from intake to verdict.',
};
