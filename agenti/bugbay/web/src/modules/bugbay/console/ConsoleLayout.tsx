/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Layout del segmento /debugging — console BUG BAY. Carica i font dedicati del
 * modulo (Chakra Petch display, Saira body, IBM Plex Mono) e applica lo scope
 * `.bugbay` (bugbay.css) che sovrascrive le CSS variable tipografiche e
 * definisce la palette hazard: il modulo ha un design indipendente dal
 * gestionale. page.tsx è un client component e non può esportare metadata.
 *
 * @indice
 * - metadata        → titolo della tab del browser
 * - DebuggingLayout → wrapper con font e scope di stile del modulo
 */

import type { Metadata } from 'next';
import { Chakra_Petch, Saira, IBM_Plex_Mono } from 'next/font/google';
import '../bugbay.css';

const display = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--bugbay-display',
});

const body = Saira({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--bugbay-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--bugbay-mono',
});

export const metadata: Metadata = {
  title: 'BUG BAY — Debug Console',
  description: 'Issue pipeline — from intake to final verification, with agentic resolution.',
};

export default function DebuggingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`bugbay ${display.variable} ${body.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
